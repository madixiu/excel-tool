import streamlit as st
import pandas as pd

st.title("📊 Excel Formula App")

uploaded = st.file_uploader("Upload Excel", type=["xlsx"])
formula = st.text_input("Formula for new column", value="Quantity * Price")
col_name = st.text_input("New column name", value="Total")

if uploaded and formula:
    df = pd.read_excel(uploaded)
    st.write("Original data:", df)
    
    try:
        df[col_name] = df.eval(formula)
        st.success("✅ Formula applied!")
        st.write(df)
        st.download_button("Download Result", 
                          df.to_csv(index=False), 
                          "result.csv")
    except Exception as e:
        st.error(f"Error: {e}")
