import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: "#c7a34b",
        "gold-muted": "#a8862e",
        forest: "#0e2a21",
        "forest-light": "#1a3d30",
        wood: "#3a2a1c",
        cream: "#f3efe6",
        parchment: "#e8dfc8",
        card: "#1a1a1a",
      },
      borderColor: {
        border: "var(--border)",
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        body: ['"DM Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
