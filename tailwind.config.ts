import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // === Brand Colors: Mexican Brutalism Palette ===
        // Gold — worn/aged gold for highlights, active states, and gold-light accents
        gold: "#c7a34b",
        "gold-muted": "#a8862e",
        // Forest — deep green for card backgrounds, buttons, secondary areas
        forest: "#0e2a21",
        "forest-light": "#1a3d30",
        // Wood — dark walnut for nav bars, footers, structural elements
        wood: "#3a2a1c",
        // Cream — primary text on dark backgrounds, body content
        cream: "#f3efe6",
        // Parchment — lighter backgrounds, secondary cards, expandable areas
        parchment: "#e8dfc8",
        // Card — primary card surface, slightly lighter than the page background
        card: "#1a1a1a",

        // === Phase 1.1 Additions: Brutalism Concrete & Light Gold ===
        // Concrete — raw concrete gray for secondary text, muted UI borders, swipe-direction overlays
        concrete: "#8A8780",
        // Gold-light — softer gold for hover states, subtle glow effects, garnish accents
        "gold-light": "#D4C28A",
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
