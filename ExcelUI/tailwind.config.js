/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base:   "#0f172a",
          deep:   "#0a0f1e",
          card:   "#131c31",
        },
        line: {
          subtle: "#1e293b",
          strong: "#334155",
        },
      },
    },
  },
  plugins: [],
};