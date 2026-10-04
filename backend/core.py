import time
from pathlib import Path
import polars as pl


# ============================================================
# HELPERS
# ============================================================
def index_to_excel_col(n: int) -> str:
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
    return max(counts, key=counts.get)


# ============================================================
# LOAD
# ============================================================
def load_file(path: str, log):
    ext = Path(path).suffix.lower()
    t0 = time.time()

    if ext == ".csv":
        sep = sniff_separator(path)
        log(f"Sniffed separator: {sep!r}")
        raw = pl.read_csv(
            path,
            separator=sep,
            infer_schema_length=0,
            quote_char='"',
            encoding="utf8-lossy",
        )
    elif ext in (".xlsx", ".xls"):
        try:
            import fastexcel
            sheets = fastexcel.read_excel(path).sheet_names
            if len(sheets) > 1:
                log(f"⚠ File has {len(sheets)} sheets: {sheets}")
                log(f"⚠ Only reading the first sheet: {sheets[0]!r}")
            else:
                log(f"Reading sheet: {sheets[0]!r}")
        except Exception:
            pass

        raw = pl.read_excel(path)
        raw = raw.with_columns([
            pl.col(c).cast(pl.Utf8, strict=False) for c in raw.columns
        ])
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    log(f"Loaded {raw.height:,} rows × {raw.width} columns in {time.time()-t0:.2f}s")

    header_by_letter = {index_to_excel_col(i): n for i, n in enumerate(raw.columns)}
    raw.columns = [index_to_excel_col(i) for i in range(raw.width)]
    return raw, header_by_letter


# ============================================================
# NUMERIC
# ============================================================
def to_number(series: pl.Series) -> pl.Series:
    s = series.cast(pl.Utf8, strict=False).str.strip_chars()
    s = s.str.replace_all(r"[^\d\.\-\+eE]", "")
    return s.cast(pl.Float64, strict=False)


# ============================================================
# FORMULA DISPATCHER
# ============================================================
def apply_formula(df, name, func, args, label, log):
    if not func:
        raise ValueError("Formula 'func' is required")
    if not args:
        raise ValueError("Formula 'args' is required")

    func = func.upper()
    log(f"Applying {name} = {func}({', '.join(args)})")

    for a in args:
        if a and a.isalpha() and a not in df.columns:
            raise ValueError(f"Column {a} not found")

    if func in ("SUMIFS", "COUNTIFS", "AVGIFS"):
        if len(args) != 3:
            raise ValueError(f"{func} requires exactly 3 args")
        sum_col, match_col, key_col = args

        k, m, s, t = f"__k{label}", f"__m{label}", f"__s{label}", f"__t{label}"
        df = df.with_columns([
            pl.col(key_col).cast(pl.Utf8).str.strip_chars().alias(k),
            pl.col(match_col).cast(pl.Utf8).str.strip_chars().alias(m),
        ])

        if func == "COUNTIFS":
            df = df.with_columns(pl.lit(1.0).alias(s))
        else:
            df = df.with_columns(to_number(df[sum_col]).alias(s))

        agg = {
            "SUMIFS":   pl.col(s).sum(),
            "COUNTIFS": pl.col(s).sum(),
            "AVGIFS":   pl.col(s).mean(),
        }[func]

        totals = df.lazy().group_by(m).agg(agg.alias(t)).collect()
        df = df.join(totals, left_on=k, right_on=m, how="left")
        df = df.rename({t: name}).drop([k, m, s])

    elif func in ("SUM", "AVG", "MEAN", "MIN", "MAX", "COUNT", "STD", "VAR"):
        if len(args) != 1:
            raise ValueError(f"{func} requires exactly 1 arg")
        col_letter = args[0]

        if func == "COUNT":
            value = float(df.height)
        else:
            num = to_number(df[col_letter])
            value = {
                "SUM":  num.sum(),
                "AVG":  num.mean(),
                "MEAN": num.mean(),
                "MIN":  num.min(),
                "MAX":  num.max(),
                "STD":  num.std(),
                "VAR":  num.var(),
            }[func]

        df = df.with_columns(pl.lit(value, dtype=pl.Float64).alias(name))

    elif func in ("ROWSUM", "ROWAVG", "ROWMIN", "ROWMAX"):
        if len(args) < 2:
            raise ValueError(f"{func} requires at least 2 args")
        tmp = [f"__row_{label}_{i}" for i in range(len(args))]
        df = df.with_columns([
            to_number(df[a]).alias(tmp[i]) for i, a in enumerate(args)
        ])
        combined = pl.concat_list([pl.col(t) for t in tmp])
        expr = {
            "ROWSUM": combined.list.sum(),
            "ROWAVG": combined.list.mean(),
            "ROWMIN": combined.list.min(),
            "ROWMAX": combined.list.max(),
        }[func]
        df = df.with_columns(expr.alias(name)).drop(tmp)

    elif func in ("ADD", "SUB", "MUL", "DIV"):
        if len(args) != 2:
            raise ValueError(f"{func} requires exactly 2 args")
        a = to_number(df[args[0]])
        b = to_number(df[args[1]])
        result = {"ADD": a + b, "SUB": a - b, "MUL": a * b, "DIV": a / b}[func]
        df = df.with_columns(result.alias(name))

    else:
        raise ValueError(f"Unknown function: {func}")

    filled = df[name].is_not_null().sum()
    log(f"  {name}: {filled:,} rows filled")
    return df


# ============================================================
# EXPORT — Rust-powered (7-9x faster than Python xlsxwriter)
# ============================================================
def export_xlsx(df, header_by_letter, result_cols, output_path, place, log):
    t0 = time.perf_counter()

    from rustpy_xlsxwriter import FastExcel

    # Reorder columns and restore original headers
    original = [c for c in df.columns if c not in result_cols]
    order = (result_cols + original) if place == "front" else (original + result_cols)
    headers = [c if c in result_cols else header_by_letter.get(c, c) for c in order]

    final = df.select(order)
    final.columns = headers

    FastExcel(output_path).sheet("Sheet1", final).save()

    log(f"Saved → {output_path} ({final.height:,} rows × {final.width} cols) in {time.perf_counter()-t0:.2f}s")


# ============================================================
# FILTER RULES
# ============================================================
def _rule_to_expr(rule):
    col = pl.col(rule.column).cast(pl.Utf8, strict=False).str.strip_chars()
    v = (rule.value or "").strip()

    if rule.op == "is_empty":
        return (col == "") | pl.col(rule.column).is_null()
    if rule.op == "is_not_empty":
        return (col != "") & pl.col(rule.column).is_not_null()
    if rule.op == "contains":
        return col.str.contains(v, literal=True)
    if rule.op == "starts_with":
        return col.str.starts_with(v)
    if rule.op == "ends_with":
        return col.str.ends_with(v)
    if rule.op in (">", ">=", "<", "<="):
        try:
            n = float(v)
        except ValueError:
            raise ValueError(f"Rule '{rule.column} {rule.op} {v}' needs a numeric value")
        num = pl.col(rule.column).cast(pl.Float64, strict=False)
        return {">": num > n, ">=": num >= n, "<": num < n, "<=": num <= n}[rule.op]
    if rule.op == "==":
        return col == v
    if rule.op == "!=":
        return (col != v) & pl.col(rule.column).is_not_null()
    raise ValueError(f"Unknown operator: {rule.op}")


def build_filter_expr(rules):
    if not rules:
        return None
    expr = _rule_to_expr(rules[0])
    for prev, rule in zip(rules, rules[1:]):
        e = _rule_to_expr(rule)
        expr = (expr | e) if prev.connector == "OR" else (expr & e)
    return expr