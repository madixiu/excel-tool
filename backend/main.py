import shutil
import tempfile
import uuid
import json
import asyncio
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORK = Path(tempfile.gettempdir()) / "excel-tool"
WORK.mkdir(exist_ok=True)


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    token = uuid.uuid4().hex
    safe_name = Path(file.filename or "uploaded").name
    dest = WORK / f"{token}_{safe_name}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"token": token, "filename": safe_name}


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

        try:
            yield emit("log", message="Loading file…")
            logs = []
            df, header_map = load_file(str(in_path), logs.append)
            for line in logs:
                yield emit("log", message=line)

            result_cols = []
            for i, f in enumerate(req.formulas, start=1):
                yield emit("log", message=f"Formula {i}: {f.name} = {f.func}({', '.join(f.args)})")
                try:
                    df = apply_formula(df, f.name, f.func, f.args, str(i), lambda m: None)
                except Exception as e:
                    yield emit("error", message=f"Formula {i} failed: {e}")
                    return
                result_cols.append(f.name)
                await asyncio.sleep(0)

            filter_applied = False
            if req.filter_rules:
                yield emit("log", message=f"Applying {len(req.filter_rules)} filter rule(s)…")
                try:
                    expr = build_filter_expr(req.filter_rules)
                    before = df.height
                    df = df.filter(expr)
                    after = df.height
                    yield emit("log", message=f"  {before:,} → {after:,} rows ({before-after:,} dropped)")
                    filter_applied = True
                except Exception as e:
                    yield emit("error", message=f"Filter rule error: {e}")
                    return

            if not filter_applied and req.filter_expr.strip():
                yield emit("log", message=f"Applying raw filter: {req.filter_expr}")
                import polars as pl
                try:
                    before = df.height
                    df = df.filter(pl.sql_expr(req.filter_expr))
                    after = df.height
                    yield emit("log", message=f"  {before:,} → {after:,} rows ({before-after:,} dropped)")
                except Exception as e:
                    yield emit("error", message=f"Filter failed: {e}")
                    return

            yield emit("log", message=f"Exporting {df.height:,} rows to XLSX…")
            try:
                export_xlsx(df, header_map, result_cols, str(out_path), req.place, lambda m: None)
            except Exception as e:
                yield emit("error", message=f"Export failed: {e}")
                return

            yield emit("done", download=f"/api/download/{token}")

        except Exception as e:
            yield emit("error", message=f"Unexpected error: {e}")

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/download/{token}")
async def download(token: str):
    out = WORK / f"{token}_output.xlsx"
    if not out.exists():
        raise HTTPException(404, "output not ready")
    return FileResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="output.xlsx",
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}