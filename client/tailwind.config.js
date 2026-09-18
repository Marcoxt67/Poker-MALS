/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    screens: {
      xs: "360px",
      sm: "481px",
      md: "769px",
      lg: "1281px",
      xl: "1920px",
    },
    extend: {
      colors: {
        felt: {
          DEFAULT: "#0b3d24",
          dark: "#082c1a",
          darker: "#051c11",
        },
        panel: {
          DEFAULT: "#161a18",
          light: "#20241f",
        },
        gold: {
          DEFAULT: "#e8b93f",
          light: "#f5d372",
        },
        chip: {
          red: "#c0392b",
          green: "#1f9c5a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        table: "inset 0 0 120px rgba(0,0,0,0.55), 0 20px 60px rgba(0,0,0,0.5)",
      },
      keyframes: {
        "chip-in": {
          "0%": { transform: "scale(0.4) translateY(-16px)", opacity: "0" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(232,185,63,0.55)" },
          "100%": { boxShadow: "0 0 0 12px rgba(232,185,63,0)" },
        },
      },
      animation: {
        "chip-in": "chip-in 0.35s ease-out",
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
