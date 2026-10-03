use anyhow::Result;
use polars::prelude::*;
use rust_xlsxwriter::{Format, Workbook};

pub fn write_xlsx(df: &mut DataFrame, path: &str) -> Result<()> {
    let mut wb = Workbook::new();
    let ws = wb.add_worksheet();

    // Header
    let header_fmt = Format::new().set_bold();
    for (c, name) in df.get_column_names().iter().enumerate() {
        ws.write_string_with_format(0, c as u16, name.as_str(), &header_fmt)?;
    }

    // Rows — iterate column by column (faster than row by row in Polars)
    for (c, name) in df.get_column_names().iter().enumerate() {
        let s = df.column(name)?.clone();
        match s.dtype() {
            DataType::Float64 => {
                let ca = s.f64()?;
                for (r, v) in ca.into_iter().enumerate() {
                    if let Some(x) = v {
                        ws.write_number((r + 1) as u32, c as u16, x)?;
                    }
                }
            }
            DataType::Int64 => {
                let ca = s.i64()?;
                for (r, v) in ca.into_iter().enumerate() {
                    if let Some(x) = v {
                        ws.write_number((r + 1) as u32, c as u16, x as f64)?;
                    }
                }
            }
            DataType::Boolean => {
                let ca = s.bool()?;
                for (r, v) in ca.into_iter().enumerate() {
                    if let Some(x) = v {
                        ws.write_boolean((r + 1) as u32, c as u16, x)?;
                    }
                }
            }
            _ => {
                // Fallback: string
                let ca = s.cast(&DataType::String)?;
                let ca = ca.str()?;
                for (r, v) in ca.into_iter().enumerate() {
                    if let Some(x) = v {
                        ws.write_string((r + 1) as u32, c as u16, x)?;
                    }
                }
            }
        }
    }

    wb.save(path)?;
    Ok(())
}