use anyhow::{bail, Result};
use polars::prelude::*;
use regex::Regex;
use crate::excel_col_to_index;

pub fn apply(df: DataFrame, formula: &str) -> Result<DataFrame> {
    // Split "I = SUMIFS(G, E, AE)" on first '='
    let (target, rhs) = formula
        .split_once('=')
        .ok_or_else(|| anyhow::anyhow!("Formula must contain '='"))?;
    let target = target.trim();
    let rhs = rhs.trim();

    // --- AGGREGATE FORMULAS: SUMIFS / COUNTIFS / AVGIFS ---
    let agg_re = Regex::new(r"^(SUMIFS|COUNTIFS|AVGIFS)\s*\(\s*([A-Za-z]+)(?::[A-Za-z]+)?\s*,\s*([A-Za-z]+)(?::[A-Za-z]+)?\s*,\s*([A-Za-z]+)(?::[A-Za-z]+)?\s*\)$")?;
    if let Some(caps) = agg_re.captures(rhs) {
        let op        = &caps[1];
        let sum_col   = &caps[2];
        let match_col = &caps[3];
        let key_col   = &caps[4];

        return apply_agg(df, target, op, sum_col, match_col, key_col);
    }

    // --- ROW-WISE ARITHMETIC:  K = G + H * 2 ---
    return apply_arithmetic(df, target, rhs);
}

fn apply_agg(
    df: DataFrame,
    target: &str,
    op: &str,
    sum_col: &str,
    match_col: &str,
    key_col: &str,
) -> Result<DataFrame> {
    // Build aggregation from the source df
    let agg_expr = match op {
        "SUMIFS"   => col(sum_col).sum().alias("_val"),
        "AVGIFS"   => col(sum_col).mean().alias("_val"),
        "COUNTIFS" => col(sum_col).count().alias("_val"),
        _ => bail!("Unknown aggregate: {op}"),
    };

    let totals = df
        .clone()
        .lazy()
        .group_by([col(match_col)])
        .agg([agg_expr])
        .collect()?;

    // Join on:  df.key_col == totals.match_col
    let result = df
        .lazy()
        .join(
            totals.lazy(),
            [col(key_col)],
            [col(match_col)],
            JoinArgs::new(JoinType::Left),
        )
        .with_column(col("_val").alias(target))
        .drop(["_val"])
        .collect()?;

    Ok(result)
}

fn apply_arithmetic(df: DataFrame, target: &str, rhs: &str) -> Result<DataFrame> {
    // Very small evaluator:  supports  + - * /  between column letters and numbers
    // Examples:  G + H  |  G * 2  |  G + H * 0.15 - 100
    let expr = parse_arithmetic(rhs)?;
    let result = df
        .lazy()
        .with_column(expr.alias(target))
        .collect()?;
    Ok(result)
}

/// Tiny recursive-descent parser for arithmetic expressions.
/// Term  := Factor (('+' | '-') Factor)*
/// Factor:= Atom   (('*' | '/') Atom)*
/// Atom  := Column | Number | '(' Term ')'
fn parse_arithmetic(input: &str) -> Result<Expr> {
    let tokens = tokenize(input)?;
    let mut p = Parser { tokens, pos: 0 };
    let e = p.parse_expr()?;
    if p.pos != p.tokens.len() {
        bail!("Unexpected token at position {}", p.pos);
    }
    Ok(e)
}

#[derive(Debug, Clone)]
enum Tok {
    Num(f64),
    Col(String),
    Plus, Minus, Star, Slash,
    LParen, RParen,
}

fn tokenize(s: &str) -> Result<Vec<Tok>> {
    let mut out = Vec::new();
    let mut chars = s.chars().peekable();
    while let Some(&c) = chars.peek() {
        match c {
            ' ' | '\t' => { chars.next(); }
            '+' => { out.push(Tok::Plus); chars.next(); }
            '-' => { out.push(Tok::Minus); chars.next(); }
            '*' => { out.push(Tok::Star); chars.next(); }
            '/' => { out.push(Tok::Slash); chars.next(); }
            '(' => { out.push(Tok::LParen); chars.next(); }
            ')' => { out.push(Tok::RParen); chars.next(); }
            c if c.is_ascii_digit() || c == '.' => {
                let mut n = String::new();
                while let Some(&c) = chars.peek() {
                    if c.is_ascii_digit() || c == '.' { n.push(c); chars.next(); } else { break; }
                }
                out.push(Tok::Num(n.parse()?));
            }
            c if c.is_ascii_alphabetic() => {
                let mut name = String::new();
                while let Some(&c) = chars.peek() {
                    if c.is_ascii_alphanumeric() || c == '_' { name.push(c); chars.next(); } else { break; }
                }
                // Uppercase single/double letter -> Excel column address
                if name.len() <= 3 && name.chars().all(|c| c.is_ascii_uppercase()) {
                    out.push(Tok::Col(name));
                } else {
                    out.push(Tok::Col(name)); // treat as raw column name
                }
            }
            other => bail!("Unexpected character in formula: {other}"),
        }
    }
    Ok(out)
}

struct Parser { tokens: Vec<Tok>, pos: usize }

impl Parser {
    fn parse_expr(&mut self) -> Result<Expr> {
        let mut left = self.parse_term()?;
        while let Some(t) = self.tokens.get(self.pos) {
            match t {
                Tok::Plus  => { self.pos += 1; left = left + self.parse_term()?; }
                Tok::Minus => { self.pos += 1; left = left - self.parse_term()?; }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_term(&mut self) -> Result<Expr> {
        let mut left = self.parse_atom()?;
        while let Some(t) = self.tokens.get(self.pos) {
            match t {
                Tok::Star  => { self.pos += 1; left = left * self.parse_atom()?; }
                Tok::Slash => { self.pos += 1; left = left / self.parse_atom()?; }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_atom(&mut self) -> Result<Expr> {
        let t = self.tokens.get(self.pos).cloned()
            .ok_or_else(|| anyhow::anyhow!("Unexpected end of formula"))?;
        self.pos += 1;
        match t {
            Tok::Num(n) => Ok(lit(n)),
            Tok::Col(name) => {
                // Map letter to real column name (columns are already named A..AE)
                let resolved = if name.len() <= 3 && name.chars().all(|c| c.is_ascii_uppercase()) {
                    crate::index_to_excel_col(excel_col_to_index(&name))
                } else {
                    name
                };
                Ok(col(&resolved))
            }
            Tok::LParen => {
                let e = self.parse_expr()?;
                match self.tokens.get(self.pos) {
                    Some(Tok::RParen) => { self.pos += 1; Ok(e) }
                    _ => bail!("Missing ')'"),
                }
            }
            _ => bail!("Unexpected token in formula"),
        }
    }
}