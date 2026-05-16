# Cocktail Census — State

## Running
**Dev server:** Currently not running (was http://localhost:8080)

## Source Files
```
src/
  App.tsx                   ← Router entry, / → Census
  main.tsx                  ← ReactDOM.createRoot
  vite-env.d.ts             ← Vite type reference
  index.css                 ← Tailwind directives + CSS vars (Dark Academia)
  types/
    cocktail.ts             ← Ingredient, Recipe, Cocktail (+ tier), Vote
  data/
    cocktails.ts            ← 100 cocktails (generated from CSV, 43 images)
  lib/
    utils.ts                ← cn() utility (clsx + tailwind-merge)
  components/
    ui/button.tsx           ← shadcn Button (4 variants, 4 sizes)
    ProgressBar.tsx         ← Gradient progress bar (current/total)
    RecipeDetails.tsx       ← Ingredients + method/glass/garnish grid
    CocktailCard.tsx        ← Main voting card (vote → next)
  pages/
    Census.tsx              ← Survey flow (100 cards → completion stats)
  assets/
    50 cocktail images      ← 43 used, 7 orphaned from old IBA list
```

## Config Files
- package.json, vite.config.ts, tsconfig.json, tsconfig.app.json, tsconfig.node.json
- tailwind.config.ts, postcss.config.js
- index.html (with Google Fonts: Playfair Display + DM Sans)

## What Works
- [x] 100 cocktails (4 tiers, Top 100 All Time list from 15+ sources)
- [x] Ingredient data sourced from Difford's dataset (facts only)
- [x] Methods rewritten as functional technique descriptions (no copyright exposure)
- [x] 43 cocktails with images (existing assets), 57 without (hidden gracefully)
- [x] Agree/Disagree voting on standard recipe
- [x] Next/Previous navigation
- [x] Progress bar updates in real-time
- [x] Completion screen with agree/disagree stats + JSON export + Start Over
- [x] localStorage persistence (votes, position, finished state survive refresh)
- [x] Reset progress button (header + completion screen)
- [x] Export Votes as downloadable JSON file
- [x] Dark Academia theme (gold, forest, cream, parchment)
- [x] Build passes clean (tsc + vite, ~2.3s, 70KB JS gzipped)

## Data Pipeline
- Data/Raw/cocktails_recipe.csv       ← Difford's 6,956-record dataset
- Data/cocktails-100.csv              ← Clean 100-cocktail extract (generated)
- Data/Research/Top-100-Cocktails-Research.md  ← Full research report
- Data/extract_cocktails.py           ← Extraction script (re-runnable)
- scripts/generate_cocktails_ts.py    ← CSV-to-TypeScript generator
- apps/census/src/data/cocktails.ts   ← Generated output (2208 lines, auto-generated)

## Known Issues
- Build uses absolute paths (base: "/"). GitHub Pages subpath deploy needs base: "./"
- No git repo or deploy infrastructure exists yet
- 7 orphaned JPGs in assets/ from old IBA list (harmless, not imported)

## Dependencies (169 packages)
Key: react 18.3, react-router-dom 6.30, lucide-react, class-variance-authority,
      tailwindcss 3.4, vite 5.4, @vitejs/plugin-react-swc, typescript 5.8

## Files Not in Source Control
This directory is not a git repo. No .git initialized yet.

## Backend Decision (2026-05-16)
**Chosen: Supabase** — Postgres-hosted REST API for collecting votes when the app goes live on GitHub Pages.

### Next Session Tasks (ordered)
1. **Initialize git repo** in `01_BarNerd/` — commit current state
2. **Create Supabase project** — set up table schema for votes
3. **Install @supabase/supabase-js** client in the census app
4. **Wire voting flow** to POST votes to Supabase on each vote action
5. **Add environment config** — supabase URL + anon key via .env
6. **Deploy to GitHub Pages** with base: "./" fix and deploy workflow
7. **Verify** — submit votes end-to-end, query them back from Supabase console
