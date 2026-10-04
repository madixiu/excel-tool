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

    # ================= CONDITIONAL AGGREGATION =================
    if func in ("SUMIFS", "COUNTIFS", "AVGIFS", "MINIFS", "MAXIFS", "MEDIANIFS", "STDIFS"):
        if len(args) != 3:
            raise ValueError(f"{func} requires exactly 3 args: (VALUE_COL, MATCH_COL, KEY_COL)")
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
            "SUMIFS":    pl.col(s).sum(),
            "COUNTIFS":  pl.col(s).sum(),
            "AVGIFS":    pl.col(s).mean(),
            "MINIFS":    pl.col(s).min(),
            "MAXIFS":    pl.col(s).max(),
            "MEDIANIFS": pl.col(s).median(),
            "STDIFS":    pl.col(s).std(),
        }[func]

        totals = df.lazy().group_by(m).agg(agg.alias(t)).collect()
        df = df.join(totals, left_on=k, right_on=m, how="left")
        df = df.rename({t: name}).drop([k, m, s])

    # ================= SIMPLE AGGREGATES (broadcast) =================
    elif func in ("SUM", "AVG", "MEAN", "MIN", "MAX", "COUNT", "STD", "VAR",
                  "MEDIAN", "MODE", "PRODUCT", "COUNTA", "COUNTBLANK", "RANGE", "PERCENTILE"):
        # PERCENTILE needs 2 args (COL, percent)
        if func == "PERCENTILE":
            if len(args) != 2:
                raise ValueError("PERCENTILE requires 2 args: (COL, 0.90)")
            col_letter, pct_str = args[0], args[1]
            try:
                pct = float(pct_str)
            except ValueError:
                raise ValueError(f"PERCENTILE pct must be numeric, got {pct_str!r}")
        else:
            if len(args) != 1:
                raise ValueError(f"{func} requires exactly 1 arg")
            col_letter = args[0]
            pct = None

        if func == "COUNTA":
            value = float(df.height)
        elif func == "COUNTBLANK":
            num = to_number(df[col_letter])
            value = float(num.null_count())
        elif func == "COUNT":
            num = to_number(df[col_letter])
            value = float(num.drop_nulls().len())
        else:
            num = to_number(df[col_letter])
            value = {
                "SUM":       num.sum(),
                "AVG":       num.mean(),
                "MEAN":      num.mean(),
                "MIN":       num.min(),
                "MAX":       num.max(),
                "STD":       num.std(),
                "VAR":       num.var(),
                "MEDIAN":    num.median(),
                "MODE":      num.mode().first() if num.len() else None,
                "PRODUCT":   num.drop_nulls().product() if num.len() else None,
                "RANGE":     (num.max() - num.min()) if num.len() else None,
                "PERCENTILE": num.quantile(pct) if pct is not None else None,
            }[func]

        df = df.with_columns(pl.lit(value, dtype=pl.Float64).alias(name))

    # ================= ROW-WISE (across columns) =================
    elif func in ("ROWSUM", "ROWAVG", "ROWMIN", "ROWMAX", "ROWMEDIAN", "ROWSTD"):
        if len(args) < 2:
            raise ValueError(f"{func} requires at least 2 args")
        tmp = [f"__row_{label}_{i}" for i in range(len(args))]
        df = df.with_columns([
            to_number(df[a]).alias(tmp[i]) for i, a in enumerate(args)
        ])
        combined = pl.concat_list([pl.col(t) for t in tmp])
        expr = {
            "ROWSUM":    combined.list.sum(),
            "ROWAVG":    combined.list.mean(),
            "ROWMIN":    combined.list.min(),
            "ROWMAX":    combined.list.max(),
            "ROWMEDIAN": combined.list.median(),
            "ROWSTD":    combined.list.std(),
        }[func]
        df = df.with_columns(expr.alias(name)).drop(tmp)

    # ================= TWO-ARG ARITHMETIC =================
    elif func in ("ADD", "SUB", "MUL", "DIV"):
        if len(args) != 2:
            raise ValueError(f"{func} requires exactly 2 args")
        a = to_number(df[args[0]])
        b = to_number(df[args[1]])
        result = {"ADD": a + b, "SUB": a - b, "MUL": a * b, "DIV": a / b}[func]
        df = df.with_columns(result.alias(name))

    # ================= MATH / ROUNDING =================
    elif func in ("ABS", "ROUND", "ROUNDUP", "ROUNDDOWN", "INT", "SQRT"):
        if len(args) != 1:
            raise ValueError(f"{func} requires exactly 1 arg")
        num = to_number(df[args[0]])
        expr = {
            "ABS":       num.abs(),
            "ROUND":     num.round(0),
            "ROUNDUP":   num.ceil(),
            "ROUNDDOWN": num.floor(),
            "INT":       num.cast(pl.Int64, strict=False).cast(pl.Float64),
            "SQRT":      num.sqrt(),
        }[func]
        df = df.with_columns(expr.alias(name))

    elif func == "ROUNDN":
        # ROUNDN(COL, N) → round to N decimals
        if len(args) != 2:
            raise ValueError("ROUNDN requires 2 args: (COL, decimals)")
        num = to_number(df[args[0]])
        try:
            decimals = int(args[1])
        except ValueError:
            raise ValueError(f"ROUNDN decimals must be integer, got {args[1]!r}")
        df = df.with_columns(num.round(decimals).alias(name))

    elif func == "POWER":
        if len(args) != 2:
            raise ValueError("POWER requires 2 args: (COL, exponent)")
        num = to_number(df[args[0]])
        try:
            exp = float(args[1])
        except ValueError:
            raise ValueError(f"POWER exponent must be numeric, got {args[1]!r}")
        df = df.with_columns((num ** exp).alias(name))

    elif func == "MOD":
        if len(args) != 2:
            raise ValueError("MOD requires 2 args: (COL, divisor)")
        num = to_number(df[args[0]])
        try:
            div = float(args[1])
        except ValueError:
            raise ValueError(f"MOD divisor must be numeric, got {args[1]!r}")
        df = df.with_columns((num % div).alias(name))

    # ================= LOGIC =================
    elif func in ("AND", "OR"):
        if len(args) < 2:
            raise ValueError(f"{func} requires at least 2 args (0 or 1 values)")
        cols = [to_number(df[a]).cast(pl.Boolean, strict=False) for a in args]
        expr = pl.all_horizontal(cols) if func == "AND" else pl.any_horizontal(cols)
        df = df.with_columns(expr.cast(pl.Int64).cast(pl.Float64).alias(name))

    elif func == "NOT":
        if len(args) != 1:
            raise ValueError("NOT requires exactly 1 arg")
        num = to_number(df[args[0]]).cast(pl.Boolean, strict=False)
        df = df.with_columns((~num).cast(pl.Int64).cast(pl.Float64).alias(name))

    elif func == "COALESCE":
        # COALESCE(A, B, C, ...) → first non-null value
        if len(args) < 2:
            raise ValueError("COALESCE requires at least 2 args")
        cols = [to_number(df[a]) for a in args]
        expr = pl.coalesce(cols)
        df = df.with_columns(expr.alias(name))

    elif func == "IF":
        # IF(CONDITION_COL, THEN_COL, ELSE_COL)
        # Treats CONDITION_COL as boolean: >0 → true
        if len(args) != 3:
            raise ValueError("IF requires 3 args: (CONDITION_COL, THEN_COL, ELSE_COL)")
        cond = to_number(df[args[0]]).cast(pl.Boolean, strict=False)
        then_v = to_number(df[args[1]])
        else_v = to_number(df[args[2]])
        df = df.with_columns(pl.when(cond).then(then_v).otherwise(else_v).alias(name))

    # ================= TEXT =================
    elif func == "LEN":
        if len(args) != 1:
            raise ValueError("LEN requires 1 arg")
        s = df[args[0]].cast(pl.Utf8, strict=False).str.len_chars()
        df = df.with_columns(s.cast(pl.Float64).alias(name))

    elif func == "UPPER":
        if len(args) != 1:
            raise ValueError("UPPER requires 1 arg")
        df = df.with_columns(df[args[0]].cast(pl.Utf8, strict=False).str.to_uppercase().alias(name))

    elif func == "LOWER":
        if len(args) != 1:
            raise ValueError("LOWER requires 1 arg")
        df = df.with_columns(df[args[0]].cast(pl.Utf8, strict=False).str.to_lowercase().alias(name))

    elif func == "TRIM":
        if len(args) != 1:
            raise ValueError("TRIM requires 1 arg")
        df = df.with_columns(df[args[0]].cast(pl.Utf8, strict=False).str.strip_chars().alias(name))

    elif func in ("LEFT", "RIGHT"):
        # LEFT(COL, N) — N as second arg (literal number)
        if len(args) != 2:
            raise ValueError(f"{func} requires 2 args: (COL, N)")
        try:
            n = int(args[1])
        except ValueError:
            raise ValueError(f"{func} N must be integer, got {args[1]!r}")
        s = df[args[0]].cast(pl.Utf8, strict=False)
        if func == "LEFT":
            expr = s.str.slice(0, n)
        else:
            expr = s.str.slice(-n, n)
        df = df.with_columns(expr.alias(name))

    elif func == "MID":
        # MID(COL, start, length)
        if len(args) != 3:
            raise ValueError("MID requires 3 args: (COL, start, length)")
        try:
            start = int(args[1])
            length = int(args[2])
        except ValueError:
            raise ValueError("MID start and length must be integers")
        s = df[args[0]].cast(pl.Utf8, strict=False)
        df = df.with_columns(s.str.slice(start, length).alias(name))

    elif func == "REPLACE":
        # REPLACE(COL, find, replacement) — string args
        if len(args) != 3:
            raise ValueError("REPLACE requires 3 args: (COL, find, replace_with)")
        s = df[args[0]].cast(pl.Utf8, strict=False)
        find = args[1]
        repl = args[2]
        df = df.with_columns(s.str.replace_all(find, repl, literal=True).alias(name))

    elif func == "CONCAT":
        # CONCAT(A, B, C, ...) — string concatenation
        if len(args) < 2:
            raise ValueError("CONCAT requires at least 2 args")
        cols = [pl.col(a).cast(pl.Utf8, strict=False).fill_null("") for a in args]
        df = df.with_columns(pl.concat_str(cols).alias(name))

    # ================= DATE (from date strings) =================
    elif func in ("YEAR", "MONTH", "DAY"):
        if len(args) != 1:
            raise ValueError(f"{func} requires 1 arg")
        s = df[args[0]].cast(pl.Utf8, strict=False)
        # Try to parse as date; extract the part
        try:
            d = s.str.strptime(pl.Date, format="%Y/%m/%d", strict=False)
        except Exception:
            # Fallback: try parsing as datetime string
            d = s.str.slice(0, 10).str.strptime(pl.Date, format="%Y-%m-%d", strict=False)
        part = {
            "YEAR":  d.dt.year(),
            "MONTH": d.dt.month(),
            "DAY":   d.dt.day(),
        }[func]
        df = df.with_columns(part.cast(pl.Float64).alias(name))

    # ================= PERCENTAGE / CHANGE =================
    elif func == "PERCENTAGE":
        # PERCENTAGE(A, B) → A / B * 100
        if len(args) != 2:
            raise ValueError("PERCENTAGE requires 2 args: (VALUE, TOTAL)")
        a = to_number(df[args[0]])
        b = to_number(df[args[1]])
        df = df.with_columns((a / b * 100).alias(name))

    elif func == "GROWTH":
        # GROWTH(NEW, OLD) → (NEW - OLD) / OLD * 100
        if len(args) != 2:
            raise ValueError("GROWTH requires 2 args: (NEW, OLD)")
        new_v = to_number(df[args[0]])
        old_v = to_number(df[args[1]])
        df = df.with_columns(((new_v - old_v) / old_v * 100).alias(name))

    elif func == "CHANGE":
        # CHANGE(NEW, OLD) → NEW - OLD
        if len(args) != 2:
            raise ValueError("CHANGE requires 2 args: (NEW, OLD)")
        new_v = to_number(df[args[0]])
        old_v = to_number(df[args[1]])
        df = df.with_columns((new_v - old_v).alias(name))

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