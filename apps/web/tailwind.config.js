/** @type {import('tailwindcss').Config} */
const shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const scale = (name) =>
  Object.fromEntries(shades.map((shade) => [shade, `rgb(var(--c-${name}-${shade}) / <alpha-value>)`]));

module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /* Theme-aware palettes. Values live in globals.css so the settings page
         can switch between the editorial workspace and the classic light UI. */
      colors: {
        slate: scale("slate"),
        indigo: scale("indigo"),
        violet: scale("violet"),
        blue: scale("blue"),
        emerald: scale("emerald"),
        amber: scale("amber"),
        orange: scale("orange"),
        white: "rgb(var(--c-white) / <alpha-value>)",
        black: "rgb(var(--c-black) / <alpha-value>)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        serif: "var(--font-serif)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
      },
      boxShadow: {
        DEFAULT: "var(--shadow)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
      },
      letterSpacing: {
        tighter: "-0.025em",
        tight: "-0.015em",
        widest: "0.2em",
      },
    },
  },
  plugins: [],
};
