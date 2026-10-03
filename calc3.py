#!/usr/bin/env python3
"""
General Excel Formula Tool
--------------------------
- Reads CSV or XLSX
- Lets you define SUMIFS-style formulas
- Lets you filter the OUTPUT
- Preserves all original columns and headers
- Adds new result columns at the FRONT (or BACK)

Column references use Excel letters (A, B, ..., Z, AA, AB, ..., AE)
computed by POSITION in the file, not by header name.
"""

import sys
import re
import time
from pathlib import Path

import polars as pl
import pandas as pd


# ============================================================
# HELPERS
# ============================================================
def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def index_to_excel_col(n: int) -> str:
    """0 -> A, 25 -> Z, 26 -> AA, 30 -> AE."""
    s = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def sniff_separator(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        head = "".join(f.readline() for _ in range(5))
    counts = {sep: head.count(sep) for sep in [",", ";", "\t", "|"]}
    best = max(counts, key=counts.get)
    log(f"  Candidate counts: {counts}")
    log(f"  Chosen separator: {best!r}")
    return best


# ============================================================
# LOAD — keep original headers, ALSO track Excel-letter mapping
# ============================================================
def load_file(path: str):
    """
    Returns:
      df                — Polars DataFrame with original headers preserved
      header_by_letter  — dict { "A": "original header of col A", ... }
    """
    ext = Path(path).suffix.lower()
    t0 = time.time()

    if ext == ".csv":
        sep = sniff_separator(path)
        log(f"Reading CSV as strings ...")
        raw = pl.read_csv(
            path,
            separator=sep,
            infer_schema_length=0,
            quote_char='"',
            encoding="utf8-lossy",
        )
    elif ext in (".xlsx", ".xls"):
        log("Reading Excel (first sheet) ...")
        raw = pl.read_excel(path, read_csv_options={"infer_schema_length": 0})
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    log(f"✅ Loaded {raw.height:,} rows × {raw.width} columns in {time.time()-t0:.2f}s")

    # Build letter -> original header map (BEFORE any renaming)
    header_by_letter = {
        index_to_excel_col(i): name
        for i, name in enumerate(raw.columns)
    }

    # Ensure every column has a unique, non-empty internal name so Polars
    # doesn't complain about duplicates. We use letters internally.
    internal_names = [index_to_excel_col(i) for i in range(raw.width)]
    raw.columns = internal_names

    log(f"🏷️  Mapped {raw.width} columns → letters A ... {internal_names[-1]}")

    return raw, header_by_letter


# ============================================================
# NUMERIC COERCION
# ============================================================
def to_number(series: pl.Series) -> pl.Series:
    s = series.cast(pl.Utf8, strict=False)
    s = s.str.strip_chars()
    s = s.str.replace_all(r"[^\d\.\-\+eE]", "")
    return s.cast(pl.Float64, strict=False)


# ============================================================
# FORMULA PARSER
# ============================================================
# Accepts:  NAME = SUMIFS(SUM_COL, MATCH_COL, KEY_COL)
# Where NAME is any free-text name (no spaces, no '=' in it).
# Column refs are Excel letters.
FORMULA_RE = re.compile(
    r"^\s*([A-Za-z0-9_]+)\s*=\s*SUMIFS\s*\(\s*([A-Za-z]+)\s*,\s*([A-Za-z]+)\s*,\s*([A-Za-z]+)\s*\)\s*$",
    re.IGNORECASE,
)

def parse_formula(line: str):
    m = FORMULA_RE.match(line)
    if not m:
        raise ValueError(
            f"Cannot parse formula: {line!r}\n"
            f"Expected:  NAME = SUMIFS(SUM_COL, MATCH_COL, KEY_COL)\n"
            f"Example:   RefTax = SUMIFS(H, E, AE)"
        )
    return m.group(1), m.group(2).upper(), m.group(3).upper(), m.group(4).upper()


# ============================================================
# APPLY ONE FORMULA (adds a NEW column, never overwrites)
# ============================================================
def apply_formula(
    df: pl.DataFrame,
    target_name: str,
    sum_col: str,
    match_col: str,
    key_col: str,
    label: str,
) -> pl.DataFrame:
    log(f"\n📐 Applying: {target_name} = SUMIFS({sum_col}, {match_col}, {key_col})")

    # Validate columns exist
    for c in (sum_col, match_col, key_col):
        if c not in df.columns:
            raise ValueError(f"Column '{c}' not found. Available: {df.columns}")

    # Work with temp names so we never touch originals
    k_norm = f"__key_{label}"
    m_norm = f"__match_{label}"
    s_num  = f"__sum_{label}"
    t_tot  = f"__total_{label}"

    df = df.with_columns([
        pl.col(key_col).cast(pl.Utf8).str.strip_chars().alias(k_norm),
        pl.col(match_col).cast(pl.Utf8).str.strip_chars().alias(m_norm),
    ])
    df = df.with_columns(to_number(df[sum_col]).alias(s_num))

    # Group by match_col, sum sum_col
    log(f"  Grouping by {match_col} and summing {sum_col} ...")
    totals = (
        df.lazy()
          .group_by(m_norm)
          .agg(pl.col(s_num).sum().alias(t_tot))
          .collect()
    )
    log(f"  Built {totals.height:,} unique keys")

    # Join
    log(f"  Joining back via {key_col} ...")
    df = df.join(totals, left_on=k_norm, right_on=m_norm, how="left")

    # Rename total -> target_name (fresh column, no clash)
    df = df.rename({t_tot: target_name})

    # Drop temps
    df = df.drop([k_norm, m_norm, s_num])

    filled = df[target_name].is_not_null().sum()
    log(f"  ✅ {target_name}: {filled:,} rows filled, {df.height - filled:,} blank")
    return df


# ============================================================
# EXPORT — keep original headers, add new result columns at FRONT
# ============================================================
def export_xlsx(
    df: pl.DataFrame,
    header_by_letter: dict,
    result_cols: list,
    output_path: str,
    place: str = "front",
) -> None:
    """
    Export with a REAL progress bar (writes in chunks of 5000 rows).
    place = "front" → result columns first
    place = "back"  → result columns last
    """
    from tqdm import tqdm
    import xlsxwriter

    log(f"\n💾 Preparing export (result columns → {place}) ...")
    t0 = time.time()

    # ---- Build final column order ----
    original_letters = [c for c in df.columns if c not in result_cols]
    if place == "front":
        order = result_cols + original_letters
    else:
        order = original_letters + result_cols

    # ---- Map internal letter names -> human-readable headers ----
    final_headers = []
    for c in order:
        if c in result_cols:
            final_headers.append(c)
        else:
            final_headers.append(header_by_letter.get(c, c))

    # ---- Reorder and rename ----
    df = df.select(order)
    df.columns = final_headers

    pdf = df.to_pandas()
    pdf = pdf.where(pdf.notna(), None)

    n_rows, n_cols = pdf.shape
    log(f"  Rows: {n_rows:,}   Columns: {n_cols}")
    log(f"  Writing {output_path} ...")

    # ---- Open workbook in constant memory mode ----
    wb = xlsxwriter.Workbook(output_path, {"constant_memory": True})
    ws = wb.add_worksheet()

    # ---- Write header row ----
    for c, name in enumerate(pdf.columns):
        ws.write(0, c, str(name))

    # ---- Write data in chunks with progress ----
    chunk_size = 5000
    pbar = tqdm(
        total=n_rows,
        desc="Writing XLSX",
        unit="row",
        unit_scale=True,
        mininterval=0.3,
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}]",
    )

    # Pre-extract columns as numpy arrays for speed
    col_arrays = [pdf.iloc[:, c].to_numpy() for c in range(n_cols)]

    for start in range(0, n_rows, chunk_size):
        stop = min(start + chunk_size, n_rows)
        for r in range(start, stop):
            row_idx = r + 1  # +1 because row 0 is the header
            for c in range(n_cols):
                v = col_arrays[c][r]
                if v is None:
                    continue
                # numpy NaN check
                if isinstance(v, float) and v != v:
                    continue
                if isinstance(v, (int, float)):
                    ws.write_number(row_idx, c, float(v))
                else:
                    ws.write_string(row_idx, c, str(v))
        pbar.update(stop - start)

    pbar.close()
    wb.close()

    elapsed = time.time() - t0
    size_mb = Path(output_path).stat().st_size / 1024 / 1024
    rate = n_rows / elapsed if elapsed > 0 else 0
    log(f"  ✅ Saved {n_rows:,} rows × {n_cols} cols in {elapsed:.1f}s "
        f"({rate:,.0f} rows/s, {size_mb:.1f} MB)")
    
# ============================================================
# MAIN
# ============================================================
def main():
    log("=" * 60)
    log("General Excel Formula Tool")
    log("=" * 60)

    # ---- Input file ----
    default_input = sys.argv[1] if len(sys.argv) >= 2 else "input.csv"
    raw = input(f"Input file path [{default_input}]: ").strip()
    input_file = raw if raw else default_input

    # ---- Output file ----
    default_output = sys.argv[2] if len(sys.argv) >= 3 else "output.xlsx"
    raw = input(f"Output .xlsx path [{default_output}]: ").strip()
    output_file = raw if raw else default_output

    # ---- Filter (applied to the OUTPUT) ----
    print()
    print("Filter to apply to OUTPUT (optional). Use SINGLE quotes for strings.")
    print("Examples:  AC != '-'  |  CAST(H AS DOUBLE) > 1000  |  AC != '-' AND H IS NOT NULL")
    print("Press Enter to keep all rows.")
    filter_expr = input("Filter: ").strip()

    # ---- Formulas ----
    print()
    print("Enter formulas. Format:  NAME = SUMIFS(SUM_COL, MATCH_COL, KEY_COL)")
    print("  NAME      = any name you like for the new column (no spaces)")
    print("  SUM_COL   = Excel letter of the column to sum")
    print("  MATCH_COL = Excel letter of the criteria column")
    print("  KEY_COL   = Excel letter of the per-row lookup key")
    print()
    print("Examples:")
    print("  RefTaxTotal  = SUMIFS(H, E, AC)")
    print("  RefGoodsTotal = SUMIFS(G, E, AC)")
    print("Press Enter on an empty line to finish.")
    formulas = []
    while True:
        line = input(f"Formula #{len(formulas)+1}: ").strip()
        if not line:
            break
        formulas.append(line)

    if not formulas:
        log("❌ No formulas entered. Exiting.")
        return

    # ---- Where to place results? ----
    print()
    print("Where should the new result columns go?")
    print("  [1] Front  (recommended — easy to see)")
    print("  [2] Back   (keeps original order, new columns at the end)")
    choice = input("Choice [1]: ").strip() or "1"
    place = "back" if choice == "2" else "front"

    # ---- Load ----
    log("\n📥 STEP 1: Loading input")
    df, header_by_letter = load_file(input_file)

    # ---- Apply formulas ----
    result_cols = []
    for i, line in enumerate(formulas, start=1):
        name, sum_c, match_c, key_c = parse_formula(line)
        log(f"\n🧮 STEP {i+1}: {name} = SUMIFS({sum_c}, {match_c}, {key_c})")

        # Validate letters exist
        for c in (sum_c, match_c, key_c):
            if c not in df.columns:
                log(f"  ❌ Column '{c}' out of range. Available: A ... {df.columns[-1]}")
                return

        df = apply_formula(df, name, sum_c, match_c, key_c, f"f{i}")
        result_cols.append(name)

    # ---- Filter OUTPUT ----
    if filter_expr:
        log(f"\n🔎 STEP FILTER: {filter_expr}")
        before = df.height
        try:
            df = df.filter(pl.sql_expr(filter_expr))
            log(f"  ✅ {before:,} → {df.height:,} rows ({before - df.height:,} dropped)")
        except Exception as e:
            log(f"  ❌ Filter failed: {e}")
            log(f"  → Keeping all rows.")
    else:
        log("\n🔎 STEP FILTER: (skipped)")

    # ---- Export ----
    log(f"\n📤 STEP EXPORT (result columns → {place})")
    export_xlsx(df, header_by_letter, result_cols, output_file, place)

    log("\n✅ DONE")
    log(f"   → {output_file}")


if __name__ == "__main__":
    main()