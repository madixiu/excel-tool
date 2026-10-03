mod loader;
mod filter;
mod formula;
mod exporter;

use anyhow::Result;
use dialoguer::Input;

fn main() -> Result<()> {
    println!("=== Excel Formula Tool (Rust) ===\n");

    // ---- 1. Ask for input file ----
    let input_path: String = Input::new()
        .with_prompt("Path to input file (.csv, .xlsx)")
        .interact_text()?;

    // ---- 2. Load ----
    let mut df = loader::load(&input_path)?;
    println!("✅ Loaded {} rows × {} columns", df.height(), df.width());

    // ---- Rename all columns to Excel letters A, B, ..., AE ----
    let new_names: Vec<String> = (0..df.width())
        .map(index_to_excel_col)
        .collect();
    df.set_column_names(new_names)?;

    // Show column letters (the header text is now identical to the letter)
    println!("\nAvailable columns: A ... {}", index_to_excel_col(df.width() - 1));

    // Show column letters + first few headers so user can pick
    println!("\nAvailable columns:");
    for (i, name) in df.get_column_names().iter().enumerate() {
        let letter = index_to_excel_col(i);
        println!("  {letter:>4}  {name}");
    }

    // ---- 3. Ask for filters ----
    let filter_expr: String = Input::new()
        .with_prompt("\nFilter expression (empty = no filter)\n  e.g. E == \"Apple\" AND G > 100")
        .allow_empty(true)
        .interact_text()?;

    if !filter_expr.trim().is_empty() {
        df = filter::apply(df, &filter_expr)?;
        println!("✅ After filter: {} rows", df.height());
    }

    // ---- 4. Ask for formulas (loop until empty) ----
    let mut formulas: Vec<String> = Vec::new();
    loop {
        let f: String = Input::new()
            .with_prompt(format!(
                "\nFormula #{} (empty to finish)\n  e.g. I = SUMIFS(G, E, AE)",
                formulas.len() + 1
            ))
            .allow_empty(true)
            .interact_text()?;
        if f.trim().is_empty() {
            break;
        }
        formulas.push(f);
    }

    // ---- 5. Apply each formula ----
    for f in &formulas {
        df = formula::apply(df, f)?;
        println!("✅ Applied: {f}");
    }

    // ---- 6. Ask for output path ----
    let output_path: String = Input::new()
        .with_prompt("\nOutput .xlsx path")
        .default("output.xlsx".into())
        .interact_text()?;

    // ---- 7. Export ----
    exporter::write_xlsx(&mut df, &output_path)?;
    println!("✅ Saved to {output_path}");

    Ok(())
}

/// 0 -> A, 25 -> Z, 26 -> AA, 30 -> AE
pub fn index_to_excel_col(mut n: usize) -> String {
    let mut s = String::new();
    n += 1;
    while n > 0 {
        let r = (n - 1) % 26;
        s.insert(0, (b'A' + r as u8) as char);
        n = (n - 1) / 26;
    }
    s
}

/// "A" -> 0, "AE" -> 30
pub fn excel_col_to_index(letter: &str) -> usize {
    let mut idx: usize = 0;
    for ch in letter.to_uppercase().chars() {
        idx = idx * 26 + (ch as usize - 'A' as usize + 1);
    }
    idx - 1
}