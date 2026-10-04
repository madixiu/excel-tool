import os
os.environ.setdefault("POLARS_MAX_THREADS", "8")  # set before Polars import

import shutil
import tempfile
import uuid
import json
import asyncio
import time
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from models import ProcessRequest, InspectResponse, ColumnInfo
from core import load_file, apply_formula, export_xlsx, build_filter_expr


app = FastAPI(title="Excel Formula API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.12.206",
        "https://192.168.12.206",
        "http://excel.pak",
        "https://excel.pak",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORK = Path(tempfile.gettempdir()) / "excel-tool"
WORK.mkdir(exist_ok=True)


# ============================================================
# UPLOAD
# ============================================================
@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    token = uuid.uuid4().hex
    safe_name = Path(file.filename or "uploaded").name
    dest = WORK / f"{token}_{safe_name}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"token": token, "filename": safe_name}


# ============================================================
# INSPECT
# ============================================================
@app.post("/api/inspect")
async def inspect(token: str = Form(...)):
    matches = [m for m in WORK.glob(f"{token}_*") if not m.name.endswith("_output.xlsx")]
    if not matches:
        raise HTTPException(404, "file not found")
    path = matches[0]
    df, header_map = load_file(str(path), lambda m: None)
    col_map = [ColumnInfo(letter=k, original_header=v) for k, v in header_map.items()]
    return InspectResponse(
        filename=path.name.split("_", 1)[1] if "_" in path.name else path.name,
        rows=df.height,
        columns=df.width,
        column_map=col_map,
    )


# ============================================================
# PROCESS (SSE stream with timing)
# ============================================================
@app.post("/api/process")
async def process(token: str = Form(...), payload: str = Form(...)):
    try:
        req = ProcessRequest(**json.loads(payload))
    except Exception as e:
        raise HTTPException(400, f"Invalid payload: {e}")

    matches = [m for m in WORK.glob(f"{token}_*") if not m.name.endswith("_output.xlsx")]
    if not matches:
        raise HTTPException(404, "file not found")
    in_path = matches[0]
    out_path = WORK / f"{token}_output.xlsx"

    async def event_stream():
        def emit(kind: str, **data) -> str:
            return f"event: {kind}\ndata: {json.dumps(data)}\n\n"

        timings = {}

        try:
            # ---------- LOAD ----------
            yield emit("log", message="Loading file…")
            t0 = time.perf_counter()
            logs = []
            df, header_map = load_file(str(in_path), logs.append)
            for line in logs:
                yield emit("log", message=line)
            timings["Load"] = time.perf_counter() - t0
            yield emit("log", message=f"⏱ Load: {timings['Load']:.3f}s")

            # ---------- FORMULAS ----------
            result_cols = []
            timings["Formulas"] = 0.0
            for i, f in enumerate(req.formulas, start=1):
                yield emit("log", message=f"Formula {i}: {f.name} = {f.func}({', '.join(f.args)})")
                tf = time.perf_counter()
                try:
                    df = apply_formula(df, f.name, f.func, f.args, str(i), lambda m: None)
                except Exception as e:
                    yield emit("error", message=f"Formula {i} failed: {e}")
                    return
                dt = time.perf_counter() - tf
                timings["Formulas"] += dt
                result_cols.append(f.name)
                yield emit("log", message=f"⏱ Formula {i} ({f.func}): {dt:.3f}s")
                await asyncio.sleep(0)

            # ---------- FILTER ----------
            filter_applied = False
            timings["Filter"] = 0.0
            if req.filter_rules:
                yield emit("log", message=f"Applying {len(req.filter_rules)} filter rule(s)…")
                tf = time.perf_counter()
                try:
                    expr = build_filter_expr(req.filter_rules)
                    before = df.height
                    df = df.filter(expr)
                    after = df.height
                    timings["Filter"] = time.perf_counter() - tf
                    yield emit("log", message=f"  {before:,} → {after:,} rows ({before-after:,} dropped)")
                    yield emit("log", message=f"⏱ Filter: {timings['Filter']:.3f}s")
                    filter_applied = True
                except Exception as e:
                    yield emit("error", message=f"Filter rule error: {e}")
                    return

            if not filter_applied and req.filter_expr.strip():
                yield emit("log", message=f"Applying raw filter: {req.filter_expr}")
                import polars as pl
                tf = time.perf_counter()
                try:
                    before = df.height
                    df = df.filter(pl.sql_expr(req.filter_expr))
                    after = df.height
                    timings["Filter"] = time.perf_counter() - tf
                    yield emit("log", message=f"  {before:,} → {after:,} rows ({before-after:,} dropped)")
                    yield emit("log", message=f"⏱ Filter: {timings['Filter']:.3f}s")
                except Exception as e:
                    yield emit("error", message=f"Filter failed: {e}")
                    return

            # ---------- EXPORT ----------
            yield emit("log", message=f"Exporting {df.height:,} rows to XLSX…")
            te = time.perf_counter()
            try:
                export_xlsx(df, header_map, result_cols, str(out_path), req.place, lambda m: None)
            except Exception as e:
                yield emit("error", message=f"Export failed: {e}")
                return
            timings["Export"] = time.perf_counter() - te
            yield emit("log", message=f"⏱ Export: {timings['Export']:.3f}s")

            # ---------- TIMING SUMMARY ----------
            total = sum(timings.values()) or 1
            yield emit("log", message="━━━━━━━ TIMING SUMMARY ━━━━━━━")
            for stage, t in timings.items():
                pct = t / total * 100
                bar = "█" * int(pct / 5)
                yield emit("log", message=f"  {stage:<10} {t:7.3f}s  {pct:5.1f}%  {bar}")
            yield emit("log", message=f"  {'TOTAL':<10} {total:7.3f}s")
            yield emit("log", message="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

            yield emit("done", download=f"/api/download/{token}")

        except Exception as e:
            yield emit("error", message=f"Unexpected error: {e}")

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ============================================================
# DOWNLOAD (with auto-cleanup)
# ============================================================
@app.get("/api/download/{token}")
async def download(token: str, bg: BackgroundTasks):
    out = WORK / f"{token}_output.xlsx"
    if not out.exists():
        raise HTTPException(404, "output not ready")

    def _cleanup():
        time.sleep(120)  # give the browser time to finish the download
        for f in WORK.glob(f"{token}_*"):
            try:
                f.unlink()
            except Exception:
                pass

    bg.add_task(_cleanup)

    return FileResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="output.xlsx",
    )


# ============================================================
# HEALTH
# ============================================================
@app.get("/api/health")
async def health():
    return {"status": "ok"}