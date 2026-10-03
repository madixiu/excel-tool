#!/usr/bin/env python3
"""
Excel SUMIFS Tool (Python + Polars)
-----------------------------------
Reads a CSV or XLSX file, applies per-row SUMIFS-style formulas,
and writes an XLSX with the results.

Uses Excel column letters (A, B, C, ..., Z, AA, AB, ..., AE) to
reference columns, exactly like Excel itself.
"""

import sys
import time
from pathlib import Path

import polars as pl
import pandas as pd
from tqdm import tqdm


# ============================================================
# CONFIG
# ============================================================
INPUT_FILE   = "input.csv"        # change or pass on command line
OUTPUT_FILE  = "output.xlsx"

# Formula 1 target / formula
OUT1_LETTER  = "I"
FORMULA1_SUM   = "H"     # column to sum
FORMULA1_MATCH = "E"     # criteria column
FORMULA1_KEY   = "AE"    # per-row key

# Formula 2 target / formula
OUT2_LETTER  = "J"
FORMULA2_SUM   = "G"
FORMULA2_MATCH = "E"
FORMULA2_KEY   = "AE"


# ============================================================
# HELPERS
# ============================================================
def log(msg: str) -> None:
    """Print with a timestamp prefix."""
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
    """Pick the separator that yields the most columns in the first 5 lines."""
    log(f"Sniffing CSV separator for {path} ...")
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        head = "".join(f.readline() for _ in range(5))

    candidates = [",", ";", "\t", "|"]
    counts = {sep: head.count(sep) for sep in candidates}
    best = max(counts, key=counts.get)
    log(f"  Candidate counts: {counts}")
    log(f"  Chosen separator: {best!r}")
    return best


# ============================================================
# LOAD
# ============================================================
def load_file(path: str) -> pl.DataFrame:
    ext = Path(path).suffix.lower()
    t0 = time.time()

    if ext == ".csv":
        sep = sniff_separator(path)
        log(f"Reading CSV as strings (all columns → Utf8) ...")
        df = pl.read_csv(
            path,
            separator=sep,
            infer_schema_length=0,   # read everything as strings
            quote_char='"',
            encoding="utf8-lossy",
        )
    elif ext in (".xlsx", ".xls"):
        log("Reading Excel (first sheet) ...")
        df = pl.read_excel(path, read_csv_options={"infer_schema_length": 0})
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    log(f"✅ Loaded {df.height:,} rows × {df.width} columns in {time.time()-t0:.2f}s")

    # Rename all columns to Excel letters A, B, C, ..., Z, AA, ..., AE
    new_names = [index_to_excel_col(i) for i in range(df.width)]
    df.columns = new_names
    log(f"🏷️  Renamed columns to Excel letters: A ... {new_names[-1]}")

    return df


# ============================================================
# NUMERIC DETECTION (only for sum columns)
# ============================================================
def to_number(series: pl.Series) -> pl.Series:
    """Try to convert a string series to Float64. Unparseable -> null."""
    s = series.cast(pl.Utf8, strict=False)
    s = s.str.strip_chars()
    # Remove anything not digit / . / - / + / e / E
    s = s.str.replace_all(r"[^\d\.\-\+eE]", "")
    return s.cast(pl.Float64, strict=False)


def describe_column(series: pl.Series, letter: str) -> None:
    """Print dtype and a few sample values."""
    samples = series.head(3).to_list()
    log(f"  Column {letter}: dtype={series.dtype}, sample={samples!r}")


# ============================================================
# FORMULA 1 & 2: PER-ROW SUMIFS
# ============================================================
def apply_sumifs(
    df: pl.DataFrame,
    target_col: str,
    sum_col: str,
    match_col: str,
    key_col: str,
    label: str,
) -> pl.DataFrame:
    log(f"\n📐 Applying {label}: {target_col} = SUMIFS({sum_col}, {match_col}, {key_col})")

    # ---- 1. Normalize both key columns: strip whitespace, keep case ----
    log(f"  Normalizing keys ({key_col} and {match_col}) ...")
    df = df.with_columns([
        pl.col(key_col).cast(pl.Utf8).str.strip_chars().alias(f"__key_{label}"),
        pl.col(match_col).cast(pl.Utf8).str.strip_chars().alias(f"__match_{label}"),
    ])

    # ---- 2. Coerce the sum column to numeric ----
    log(f"  Coercing {sum_col} to numeric ...")
    df = df.with_columns(to_number(df[sum_col]).alias(f"__sum_{label}"))

    n_bad = df[f"__sum_{label}"].null_count()
    log(f"  {sum_col}: {n_bad:,} unparseable values → treated as null")

    # ---- 3. Build the group-by totals table ----
    log(f"  Grouping by {match_col} and summing {sum_col} ...")
    t0 = time.time()
    totals = (
        df.lazy()
          .group_by(f"__match_{label}")
          .agg(pl.col(f"__sum_{label}").sum().alias(f"__total_{label}"))
          .collect()
    )
    log(f"  Built totals table with {totals.height:,} unique {match_col} values in {time.time()-t0:.2f}s")

    # ---- 4. Join back to every row ----
    log(f"  Joining totals back to {df.height:,} rows via {key_col} ...")
    t0 = time.time()
    df = df.join(
        totals,
        left_on=f"__key_{label}",
        right_on=f"__match_{label}",
        how="left",
    )
    log(f"  Join completed in {time.time()-t0:.2f}s")

    # ---- 5. Rename total to the target column, drop temp cols ----
     # If the target column already exists (e.g. original CSV had a column I),
    # drop it first so we can replace it with our computed values.
    if target_col in df.columns and target_col != f"__total_{label}":
        df = df.drop(target_col)
    df = df.rename({f"__total_{label}": target_col})
    df = df.drop([f"__key_{label}", f"__match_{label}", f"__sum_{label}"])

    filled = df[target_col].is_not_null().sum()
    log(f"  ✅ {target_col}: {filled:,} rows have a value, {df.height - filled:,} are blank")

    return df


# ============================================================
# EXPORT
# ============================================================
def export_xlsx(df: pl.DataFrame, path: str) -> None:
    log(f"\n💾 Exporting {df.height:,} rows to {path} ...")
    log(f"  ⏳ Large files take 20–40s. Please wait ...")

    t0 = time.time()
    pdf = df.to_pandas()
    pdf = pdf.where(pdf.notna(), None)

    # Options that speed up xlsxwriter significantly
    with pd.ExcelWriter(path, engine="xlsxwriter") as writer:
        pdf.to_excel(writer, index=False, sheet_name="Sheet1")
        wb = writer.book
        ws = writer.sheets["Sheet1"]
        # No formatting at all — fastest mode
        ws.set_column(0, len(pdf.columns) - 1, None, None)

    elapsed = time.time() - t0
    size_mb = Path(path).stat().st_size / 1024 / 1024
    log(f"  ✅ Saved in {elapsed:.1f}s  ({df.height/elapsed:,.0f} rows/s, {size_mb:.1f} MB)")
    
    

# ============================================================
# MAIN
# ============================================================
def main():
    log("=" * 60)
    log("Excel SUMIFS Tool")
    log("=" * 60)

    # ---- Ask for input file ----
    default_input = sys.argv[1] if len(sys.argv) >= 2 else "input.csv"
    raw = input(f"Input file path [{default_input}]: ").strip()
    input_file = raw if raw else default_input

    # ---- Ask for output file ----
    default_output = sys.argv[2] if len(sys.argv) >= 3 else "output.xlsx"
    raw = input(f"Output .xlsx path [{default_output}]: ").strip()
    output_file = raw if raw else default_output

    # ---- Ask for filter expression (applied AFTER formulas) ----
    print()
    print("Filter to apply to the OUTPUT (optional). Use SINGLE quotes:")
    print("  AE != '-'")
    print("  AE != '-' AND TRIM(AE) != ''")
    print("  CAST(G AS DOUBLE) > 1000000")
    print("Press Enter to keep all rows.")
    filter_expr = input("Filter: ").strip()

    # ---- Ask for formulas ----
    print()
    print("Enter formulas:  TARGET = SUMIFS(SUM_COL, MATCH_COL, KEY_COL)")
    print("  Example:  I = SUMIFS(H, E, AE)")
    print("  Example:  J = SUMIFS(G, E, AE)")
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

    # ---- Load ALL rows ----
    log("\n📥 STEP 1: Loading input")
    df = load_file(input_file)

    # ---- Apply formulas on the FULL dataset ----
    for i, line in enumerate(formulas, start=1):
        target, sum_c, match_c, key_c = parse_formula(line)
        log(f"\n🧮 STEP {i+1}: Formula — {target} = SUMIFS({sum_c}, {match_c}, {key_c})")

        for col_letter in (target, sum_c, match_c, key_c):
            if col_letter not in df.columns:
                log(f"  ❌ Column '{col_letter}' not found. Skipping.")
                break
        else:
            df = apply_sumifs(df, target, sum_c, match_c, key_c, f"f{i}")

    # ---- NOW apply the filter to the OUTPUT ----
    if filter_expr:
        log(f"\n🔎 STEP FINAL-1: Filtering output: {filter_expr}")
        before = df.height
        try:
            df = df.filter(pl.sql_expr(filter_expr))
            log(f"  ✅ {before:,} → {df.height:,} rows ({before - df.height:,} dropped)")
        except Exception as e:
            log(f"  ❌ Filter failed: {e}")
            log(f"  → Keeping all rows.")
    else:
        log("\n🔎 STEP FINAL-1: No filter")

    # ---- Reorder: put computed columns first ----
    targets = [parse_formula(f)[0] for f in formulas]
    front = [c for c in targets if c in df.columns]
    others = [c for c in df.columns if c not in front]
    df = df.select(front + others)

    # ---- Export ----
    log("\n📤 STEP FINAL-2: Export")
    export_xlsx(df, output_file)

    log("\n✅ DONE")
    log(f"   → {output_file}")


# ============================================================
# FORMULA PARSER
# ============================================================
import re

def parse_formula(line: str):
    """Parse 'I = SUMIFS(H, E, AE)' → ('I', 'H', 'E', 'AE')."""
    m = re.match(
        r"^\s*([A-Za-z]+)\s*=\s*SUMIFS\s*\(\s*([A-Za-z]+)\s*,\s*([A-Za-z]+)\s*,\s*([A-Za-z]+)\s*\)\s*$",
        line,
        re.IGNORECASE,
    )
    if not m:
        raise ValueError(f"Cannot parse formula: {line!r}")
    return m.group(1).upper(), m.group(2).upper(), m.group(3).upper(), m.group(4).upper()


if __name__ == "__main__":
    main()