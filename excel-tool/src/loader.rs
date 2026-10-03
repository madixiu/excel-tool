use anyhow::{bail, Result};
use calamine::{open_workbook, Reader, Xlsx};
use polars::prelude::*;
use std::path::Path;

pub fn load(path: &str) -> Result<DataFrame> {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "csv" => load_csv(path),
        "xlsx" | "xls" => load_xlsx(path),
        _ => bail!("Unsupported file type: {ext}"),
    }
}

fn load_csv(path: &str) -> Result<DataFrame> {
    // Sniff the separator by trying candidates on the first few lines
    let content = std::fs::read_to_string(path)
        .map_err(|e| anyhow::anyhow!("Cannot read {path}: {e}"))?;
    let first_lines: String = content.lines().take(5).collect::<Vec<_>>().join("\n");

    let candidates = [',', ';', '\t', '|'];
    let best_sep = candidates
        .iter()
        .max_by_key(|&&sep| first_lines.matches(sep).count())
        .copied()
        .unwrap_or(',');

    println!("🔍 Detected CSV separator: {:?}", best_sep);

    // ✅ In Polars 0.44, separator lives on parse_options
    let df = CsvReadOptions::default()
        .with_has_header(true)
        .with_infer_schema_length(Some(0))
        .with_parse_options(
            CsvParseOptions::default().with_separator(best_sep as u8)
        )
        .try_into_reader_with_file_path(Some(path.into()))?
        .finish()?;

    Ok(df)
}

fn load_xlsx(path: &str) -> Result<DataFrame> {
    let mut workbook: Xlsx<_> =
        open_workbook(path).map_err(|e| anyhow::anyhow!("Cannot open {path}: {e}"))?;

    let sheet_names = workbook.sheet_names().to_owned();
    let sheet_name = sheet_names
        .first()
        .ok_or_else(|| anyhow::anyhow!("No sheets in workbook"))?
        .clone();

    // ✅ Single `?` (worksheet_range returns a plain Result, not nested)
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| anyhow::anyhow!("Cannot read sheet '{sheet_name}': {e}"))?;

    // ---- Headers from first row ----
    let mut rows_iter = range.rows();
    let header_row = rows_iter
        .next()
        .ok_or_else(|| anyhow::anyhow!("Sheet is empty"))?;

    let headers: Vec<String> = header_row
        .iter()
        .enumerate()
        .map(|(i, c)| {
            let s = c.to_string();
            if s.is_empty() {
                crate::index_to_excel_col(i)
            } else {
                s
            }
        })
        .collect();

    // ---- Data rows ----
    let data_rows: Vec<&[calamine::Data]> = rows_iter.collect();
    let n_rows = data_rows.len();

    let mut columns: Vec<Column> = Vec::with_capacity(headers.len());

    for (col_idx, header) in headers.iter().enumerate() {
        // Try numeric first
        let mut numeric_values: Vec<Option<f64>> = Vec::with_capacity(n_rows);
        let mut all_numeric = true;

        for row in &data_rows {
            let cell = row.get(col_idx).unwrap_or(&calamine::Data::Empty);
            match cell {
                // ✅ No dereference — calamine binds by value here
                calamine::Data::Float(f) => numeric_values.push(Some(*f)),
                calamine::Data::Int(i)   => numeric_values.push(Some(*i as f64)),
                calamine::Data::Empty    => numeric_values.push(None),
                calamine::Data::String(s) => {
                    // ✅ clean_and_parse accepts impl AsRef<str>
                    match clean_and_parse(s) {
                        Some(v) => numeric_values.push(Some(v)),
                        None => {
                            all_numeric = false;
                            break;
                        }
                    }
                }
                _ => {
                    all_numeric = false;
                    break;
                }
            }
        }

        if all_numeric && numeric_values.iter().any(|v| v.is_some()) {
            let series = Series::new(header.as_str().into(), numeric_values);
            columns.push(series.into_column());
        } else {
            // Fallback: strings
            let str_values: Vec<Option<String>> = data_rows
                .iter()
                .map(|row| {
                    row.get(col_idx).map(|c| match c {
                        calamine::Data::Empty => String::new(),
                        other => other.to_string(),
                    })
                })
                .collect();
            let series = Series::new(header.as_str().into(), str_values);
            columns.push(series.into_column());
        }
    }

    Ok(DataFrame::new(columns)?)
}

fn auto_cast_numeric(df: DataFrame) -> DataFrame {
    let mut out = df.clone();

    for name in df.get_column_names().iter().map(|s| s.to_string()) {
        let col = match out.column(&name) {
            Ok(c) => c.clone(),
            Err(_) => continue,
        };

        if !matches!(col.dtype(), DataType::String) {
            continue;
        }

        let str_ca = match col.str() {
            Ok(c) => c,
            Err(_) => continue,
        };

        // ✅ Flatten: opt.and_then(f) avoids Option<Option<f64>>
        let casted: Float64Chunked = str_ca
            .into_iter()
            .map(|opt| opt.and_then(clean_and_parse))
            .collect();

        let total = casted.len();
        let non_null = casted.into_iter().filter(|v| v.is_some()).count();

        if total > 0 && (non_null as f64 / total as f64) >= 0.8 {
            // ✅ with_name wants PlSmallStr
            let series = casted.into_series().with_name(name.as_str().into());
            // ✅ with_column now mutates in place and returns Result<&mut DataFrame>
            let _ = out.with_column(series);
        }
    }

    out
}

/// Accepts anything that converts to &str (String, &String, &str, etc.)
fn clean_and_parse(s: impl AsRef<str>) -> Option<f64> {
    let s = s.as_ref();
    let t = s.trim();
    if t.is_empty() || t == "-" || t.eq_ignore_ascii_case("n/a") {
        return None;
    }

    let mut negative = false;
    let mut body = t.to_string();
    if body.starts_with('(') && body.ends_with(')') {
        negative = true;
        body = body[1..body.len() - 1].to_string();
    }

    let cleaned: String = body
        .chars()
        .filter(|c| c.is_ascii_digit() || matches!(c, '.' | '-' | '+' | 'e' | 'E'))
        .collect();

    if cleaned.is_empty() {
        return None;
    }

    let mut v: f64 = cleaned.parse().ok()?;
    if negative {
        v = -v;
    }
    Some(v)
}