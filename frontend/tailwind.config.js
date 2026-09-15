/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // NiveshMitra reference palette (Gemini-inspired dark surfaces,
        // blue accent, standard green/red/yellow semantics) - PositionIQ
        // keeps its own content/terminology, the look follows the reference.
        base: "#131314",
        surface: "#1e1f20",
        "surface-raised": "#282a2c",
        "surface-3": "#2d2f31",
        border: "#444746",
        "border-soft": "#333537",

        ink: "#e3e3e3",
        "ink-muted": "#9aa0a6",
        "ink-faint": "#6b6f76",

        accent: {
          DEFAULT: "#8ab4f8",
          bright: "#aecbfa",
          deep: "#4285f4",
        },
        "accent-2": "#81c995",

        gain: "#81c995",
        loss: "#f28b82",
        caution: "#fdd663",
      },
      fontFamily: {
        display: ["'Inter'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'Inter'", "sans-serif"],
      },
      backgroundImage: {
        // NiveshMitra signature gradients
        "brand-gradient":
          "linear-gradient(74deg, #4285f4 0%, #9b72cb 46%, #d96570 92%)",
        "btn-gradient":
          "linear-gradient(100deg, #2b6cff 0%, #6a5cff 50%, #a855f7 100%)",
      },
      boxShadow: {
        "btn-glow": "0 8px 26px rgba(108, 92, 255, 0.45)",
        card: "0 8px 24px rgba(0, 0, 0, 0.18)",
        "card-lg": "0 20px 60px rgba(0, 0, 0, 0.3)",
      },
      borderRadius: {
        "4xl": "22px",
      },
    },
  },
  plugins: [],
};