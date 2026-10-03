use anyhow::{bail, Result};
use polars::prelude::*;
use regex::Regex;
use crate::excel_col_to_index;

/// Applies a filter like:  E == "Apple" AND G > 100
pub fn apply(df: DataFrame, expr: &str) -> Result<DataFrame> {
    // Split on AND / OR (uppercase only, surrounded by spaces)
    let and_re = Regex::new(r"\s+AND\s+").unwrap();
    let or_re  = Regex::new(r"\s+OR\s+").unwrap();

    let has_or  = or_re.is_match(expr);
    let has_and = and_re.is_match(expr);

    let mut lf = df.lazy();

    if has_or && !has_and {
        // OR: combine with | (Polars: union of masks)
        let parts: Vec<&str> = or_re.split(expr).collect();
        let mut mask: Option<Expr> = None;
        for p in parts {
            let e = build_expr(p.trim())?;
            mask = Some(match mask {
                None => e,
                Some(m) => m.or(e),
            });
        }
        lf = lf.filter(mask.unwrap());
    } else if has_and && !has_or {
        // AND: chain filters
        for p in and_re.split(expr) {
            lf = lf.filter(build_expr(p.trim())?);
        }
    } else if has_and && has_or {
        bail!("Mixing AND and OR in one filter is not supported. Use only one.")
    } else {
        lf = lf.filter(build_expr(expr.trim())?);
    }

    Ok(lf.collect()?)
}

/// Build a single comparison:  E == "Apple"   or   G > 100
fn build_expr(clause: &str) -> Result<Expr> {
    // Operators in priority order (longest first to avoid `=` matching `==`)
    for op in ["==", "!=", ">=", "<=", ">", "<"] {
        if let Some(pos) = clause.find(op) {
            let left  = clause[..pos].trim();
            let right = clause[pos + op.len()..].trim();

            let col_name = resolve_column(left)?;
            let col = col(&col_name);

            // Is right side a quoted string or a number?
            let is_quoted = right.starts_with('"') && right.ends_with('"');

            if is_quoted {
                let s = &right[1..right.len() - 1]; // strip quotes
                let lit = lit(s);
                return Ok(match op {
                    "==" => col.eq(lit),
                    "!=" => col.neq(lit),
                    _    => bail!("String comparison only supports == and !="),
                });
            } else {
                let n: f64 = right.parse().map_err(|_| {
                    anyhow::anyhow!("Right side of '{op}' must be a number or quoted string: {right}")
                })?;
                let lit = lit(n);
                return Ok(match op {
                    "==" => col.eq(lit),
                    "!=" => col.neq(lit),
                    ">"  => col.gt(lit),
                    "<"  => col.lt(lit),
                    ">=" => col.gt_eq(lit),
                    "<=" => col.lt_eq(lit),
                    _    => unreachable!(),
                });
            }
        }
    }
    bail!("Filter clause has no operator: {clause}")
}

/// If the token is "A" or "AE" (a letter), map it to the real column name.
/// Otherwise treat it as a literal column name.
fn resolve_column(token: &str) -> Result<String> {
    let t = token.trim().trim_matches('"');
    // If it's 1-3 uppercase letters, treat as Excel letter address
    if t.len() <= 3 && t.chars().all(|c| c.is_ascii_uppercase()) {
        let idx = excel_col_to_index(t);
        // We can't know the real name here without the DataFrame, so return the letter itself
        // and rely on the fact that in main.rs we renamed columns to letters already.
        return Ok(crate::index_to_excel_col(idx));
    }
    Ok(t.to_string())
}