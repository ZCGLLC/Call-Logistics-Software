/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070a10",
          900: "#0b0f16",
          800: "#121826",
          700: "#182033",
          600: "#243049",
        },
        signal: {
          DEFAULT: "#3ddc97",
          dim: "#1f8f62",
        },
        copper: "#e8a87c",
        ice: "#6ea8fe",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular"],
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
