/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#f4f7fb",
          deep: "#eef2f7",
          card: "#ffffff",
        },
        line: {
          subtle: "#e2e8f0",
          strong: "#cbd5e1",
        },
      },
    },
  },
  plugins: [],
};
