# 01_BarNerd — Context

## Identity
**BarNerd** is a mixology data ecosystem. "IMDb for cocktail recipes" — community consensus determines the standard.

The product strategy follows a survey-first approach: collect community data (Census) before building browse/explore tools (Compass).

## Project Structure
```
01_BarNerd/
├── apps/
│   └── census/          ← Cocktail Census: survey app (Phase 1 — RUNNING on :8083)
│       ├── src/
│       │   ├── components/   CocktailCard, ProgressBar, RecipeDetails, ui/button
│       │   ├── data/         cocktails.ts (50 IBA recipes)
│       │   ├── pages/        Census.tsx (survey + completion screen)
│       │   ├── types/        cocktail.ts (Ingredient, Recipe, Cocktail, Vote)
│       │   ├── lib/          utils.ts (cn)
│       │   └── assets/       50 cocktail images
│       ├── STATE.md          Detailed app state
│       ├── package.json, vite.config.ts, tailwind.config.ts, tsconfig*.json
│       └── index.html
├── packages/             ← Shared libraries (empty, for future cross-app types)
├── docs/                 ← Ecosystem documentation
│   └── superpowers/
│       ├── specs/        2026-05-16-barnerd-ecosystem-design.md
│       └── plans/        2026-05-16-cocktail-census-phase1.md
└── Backups/              ← Lovable-era reference artifacts (retained untouched)
    └── cocktail-compass-70/
```

## Tech Stack
- **Frontend:** Vite 5, React 18, TypeScript, Tailwind CSS 3, shadcn/ui (button only)
- **Icons:** lucide-react
- **Runtime:** bun 1.3.11
- **Architecture:** Vanilla monorepo — each app has independent configs, no workspace tooling

## Visual Theme
**Dark Academia** — cocktail archive in an old academic library.
- Dark background (`#0e0e0e`), cream text (`#f3efe6`)
- Accents: Brass gold (`#c7a34b`), Deep forest (`#0e2a21`), Walnut wood (`#3a2a1c`), Parchment (`#e8dfc8`)
- Fonts: Playfair Display (headings), DM Sans (body)
- Colored CSS custom properties in `index.css` for runtime themeability

## Roadmap
- **Phase 1 (Cocktail Census):** ✅ Running — 50 IBA cocktails, agree/disagree voting, alternative recipes, completion stats
- **Phase 2 (Consensus Database):** 📋 Not started — persist votes, calculate consensus scores
- **Phase 3 (Cocktail Compass):** 📋 Not started — browse, search, filter cocktails
- **Phase 4 (Analytics/API):** 📋 Not started — public API, data exports
- **Phase 5 (Bartender Mode):** 📋 Not started — scaling tools, batch calculator

## Active Development
- Dev server: **http://localhost:8083** (PID 46600)
- Visual polish pending: colors, spacing, card layout, transitions
- No git repository initialized yet

## Key Documents
- `docs/superpowers/specs/2026-05-16-barnerd-ecosystem-design.md` — Full ecosystem design: identity, data model, roadmap, visual theme
- `docs/superpowers/plans/2026-05-16-cocktail-census-phase1.md` — 15-task implementation plan with exact component code

## Data Source
- 50 IBA-standard cocktail recipes ported from `Backups/cocktail-compass-70/src/data/cocktails.ts`
- Recipe provenance tracked via `Recipe.source` field (e.g. "IBA Standard", "Cocktail Codex", "Sam Ross Original")
- Future: user's external source to be added (noted during planning)
