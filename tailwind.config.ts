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

        // Destructive — error text only. Defined 2026-09-20: it was already being used in
        // Census.tsx, but with no entry here `text-destructive` generated no CSS rule and
        // silently did nothing. Matches --destructive in index.css.
        destructive: "#ef4444",

        // === Theme tokens declared in :root but missing here ===
        // Added 2026-09-24. This is the `destructive` failure mode again, four more times and
        // much wider: a colour declared in index.css is NOT available as a utility unless it is
        // also registered here. `text-muted-foreground` (33 uses), `text-foreground` (18),
        // `bg-muted` (4) and `ring-ring` (1) were all in use across src/, and every one of them
        // generated no CSS rule at all, so each silently inherited body's cream instead of painting
        // its own colour. Measured before the fix: every secondary line on the live Census
        // — "Reset progress", "0 of 100", "Glass:", "Swipe right" — rendered
        // rgb(243, 239, 230) at 16.82:1. There was no secondary hierarchy at all.
        //
        // Literal hex rather than var(--x), and that is load-bearing: Tailwind can only apply an
        // opacity modifier to a value it is able to rewrite, so the /50, /70 and /90 usages in src/
        // would quietly stop working against a var(). These must be kept in step with :root in
        // index.css by hand; that is the price of working alpha.
        background: "#0e0e0e", // --background
        foreground: "#f3efe6", // --foreground
        "card-foreground": "#f3efe6", // --card-foreground
        muted: "#2a2a2a", // --muted
        "muted-foreground": "#9ca3af", // --muted-foreground
        ring: "#c7a34b", // --ring
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
