/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12131a",
        paper: "#f6f5f1",
        vault: "#1c2b2e",
        signal: "#c9622c",
        wire: "#2f4d46",
        line: "#d8d4c8",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
