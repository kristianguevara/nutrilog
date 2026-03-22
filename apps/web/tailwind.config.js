/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "Noto Sans",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
