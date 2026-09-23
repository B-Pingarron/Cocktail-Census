# Cocktail Census — State

**Last updated**: 2026-09-22
**Status**: 🟢 **LIVE.** Deployed to GitHub Pages. All 100 cards render their own illustration. Landing page, vote receipt, results ranking, and feedback form are built and shipping.

## Running
**Live:** `b-pingarron.github.io/Cocktail-Census/` — GitHub Pages deploy via `.github/workflows/deploy.yml`.
**Dev server:** not running (run `npm run dev` from `apps/census/`).

## Source Files
```
src/
  App.tsx                   ← HashRouter: / → /census, /census, /census/vote
  main.tsx                  ← ReactDOM.createRoot
  vite-env.d.ts             ← Vite type reference
  index.css                 ← Tailwind directives + Dark Academia CSS vars

  types/
    cocktail.ts             ← Ingredient, Recipe, Cocktail (+ tier), Vote

  data/
    cocktails.ts            ← 100 cocktails (generated from CSV; 2207 lines)

  lib/
    utils.ts                ← cn() utility (clsx + tailwind-merge)
    supabase.ts             ← Supabase client (env-keyed; null-safe when env is absent)
    cocktailArt.ts          ← recipe id → its SVG (import.meta.glob over assets/cocktails/*.svg)
    censusState.ts          ← localStorage persistence (votes, position, finished)

  components/
    ui/button.tsx           ← shadcn Button (4 variants, 4 sizes)
    ProgressBar.tsx         ← Gradient progress bar (current/total)
    RecipeDetails.tsx       ← Ingredients + method/glass/garnish grid
    CocktailCard.tsx        ← Main voting card (vote → next)
    VoteReceipt.tsx         ← Post-vote confirmation chip with consensus reveal (delayed)
    CensusResults.tsx       ← Top-5 agreed/disagreed ranking tables (from Supabase tally view)
    FeedbackForm.tsx        ← Free-text feedback → Supabase feedback table
    Wordmark.tsx            ← BarNerd wordmark in gold frame (header.jpg)
    CardSkeleton.tsx        ← Loading skeleton for cocktail cards

  pages/
    Census.tsx              ← Survey flow (100 cards → completion stats → Supabase insert)
    Landing.tsx             ← Landing page (/census): wordmark, mission, CTA, effort estimate

  assets/
    header.jpg              ← BarNerd wordmark image (1280×591, mid-green background)
    cocktails/              ← 100 printed SVGs — one per recipe, sourced from the compositor
    cocktail-placeholder.svg ← fallback (no card uses it today — all 100 have artwork)
    fonts/                  ← Self-hosted fonts (Playfair Display, DM Sans)
```

## Config Files
- package.json, vite.config.ts (`base: "./"`), tsconfig.json, tsconfig.app.json, tsconfig.node.json
- tailwind.config.ts, postpostcss.config.js
- index.html (Google Fonts: Playfair Display + DM Sans)
- `.github/workflows/deploy.yml` (GitHub Pages deploy)
- `.env`, `.env.example`, `.env.production` — all three tracked in git (see Known Issues)

## What Works
- [x] 100 cocktails (4 tiers, Top 100 All Time list from 15+ sources)
- [x] Ingredient data sourced from Difford's dataset (facts only)
- [x] Methods rewritten as functional technique descriptions (no copyright exposure)
- [x] **No cocktail photography or AI illustration renders anywhere.** Every card shows the cocktail's own printed SVG, wired by `src/lib/cocktailArt.ts` — business rule 14
- [x] Agree/Disagree voting on standard recipe (swipe or arrow keys)
- [x] **Votes post to Supabase** (`.from("votes").insert(...)`)
- [x] Next/Previous navigation with auto-advance
- [x] Progress bar updates in real-time
- [x] **VoteReceipt** — post-vote confirmation chip with delayed consensus reveal from `cocktail_tally` view
- [x] **CensusResults** — top-5 agreed/disagessed ranking tables (reads from `cocktail_tally` view, min sample = 2)
- [x] **FeedbackForm** — free-text feedback → Supabase `feedback` table (length-capped 1000, CHECK constraint)
- [x] **Landing page** — BarNerd wordmark, mission copy, effort estimate ("about 3 minutes for all 100"), keyboard hints (desktop), continue/start-over logic
- [x] **Wordmark** component — `header.jpg` in a gold frame, used on Landing + completion screen
- [x] Completion screen with agree/disagree stats + Retry + CensusResults ranking tables
- [x] localStorage persistence (votes, position, finished state survive refresh) — local-first
- [x] Reset progress button (header + completion screen)
- [x] Dark Academia theme (gold `#c7a34b`, forest `#0e2a21`, background `#0e0e0e`, cream `#f3efe6`)
- [x] Build passes clean (tsc + vite)
- [x] **GitHub Pages deploy, verified end-to-end**

## Images — 50 JPGs on disk, 0 used, on purpose

- **50 `.jpg` files** sit in `src/assets/`. **43** are referenced by `cocktails.ts`; **7** are orphans from an old IBA list.
- The 43 are **AI-generated illustrations that are factually wrong about the drinks** — wrong glasses, wrong garnishes, same glossy product-render signature.
- They are imported but **never rendered**: `cocktail.image` is referenced nowhere in `src/`. The card draws `src/assets/cocktails/<recipe id>.svg` through `src/lib/cocktailArt.ts`.
- **This is a decision, not an oversight** — business rule 14: *no AI artwork, and no photo fallback, in anything a stranger sees.*
- **The degradation ladder is `SVG → placeholder`. There is no photo tier.** All 100 specs now have printed SVGs, so the first tier is the one in use.

## Data Pipeline
- Data/Raw/cocktails_recipe.csv       ← Difford's 6,956-record dataset
- Data/cocktails-100.csv              ← Clean 100-cocktail extract (generated)
- Data/Research/Top-100-Cocktails-Research.md  ← Full research report
- Data/extract_cocktails.py           ← Extraction script (re-runnable)
- scripts/generate_cocktails_ts.py    ← CSV-to-TypeScript generator
- apps/census/src/data/cocktails.ts   ← Generated output (2207 lines, auto-generated)

## Known Issues
- **43 factually-wrong AI illustrations are still in the tree**, imported and unused. They must never be wired into the card (business rule 14).
- **7 orphaned JPGs** in `assets/` from an old IBA list (harmless, not imported).
- **`.env`, `.env.example` and `.env.production` are tracked in git.** The values are the public Supabase URL + anon key, so this is not a leaked secret, but a tracked `.env` is a bad habit.
- **A failed vote insert is not retried.** Local-first works and the flow never blocks; a vote that does not reach Supabase stays on the device (business rule 6). Accepted for BCB — Supabase project is Healthy.
- **No anonymous identity yet.** `signInAnonymously()` is called nowhere in `src/`; votes carry no user identity. The schema and RLS are designed for it but it is not wired.
- **No controversy-first ordering.** Specs appear in their generated order, not by most-disputed.

## Source Control
**This IS a git repo.**

- Remote: `B-Pingarron/Cocktail-census`, branch `main`
- **HEAD `10c9036`** ("feat(census): drop the AI images, brand the app, and polish the swipe") — working tree **clean**, `main` level with `origin/main`
- Recent: `24e8b37` (feedback confirmation copy) · `45c4735` (self-host fonts) · `4e187ee` (one swipe = one vote) · `fc08657` (recipe-not-drink framing + feedback form)
- `STATE.md` itself is tracked — editing it leaves the repo dirty, which is expected

## Dependencies
Key: react 18.3, react-router-dom 6, lucide-react, class-variance-authority,
     tailwindcss 3.4, vite 5.4, @vitejs/plugin-react-swc, typescript 5.8,
     @supabase/supabase-js

## Routing
| Path | Component | Purpose |
|------|-----------|---------|
| `/` | → `/census` | Redirect (keeps old bookmarks working) |
| `/census` | `Landing.tsx` | Landing page, CTA, effort estimate |
| `/census/vote` | `Census.tsx` | Survey flow (100 cards → completion) |

## Next Session Tasks
Per `openspec/changes/barnerd-bcb-demo/proposal.md` §5.1, the real Census gaps are:
1. **Anonymous identity** — `signInAnonymously()` + `profiles(display_name, role)` + RLS `user_id = auth.uid()`
2. **Controversy-first ordering** — show most-disputed specs first
3. **About page** — the BarNerd story, the anti-IMBIBE argument
4. **Waitlist capture** — Recipe Manager beta access (email + explicit consent)
5. **Untrack `.env`** before it holds anything that matters
6. **Keep Supabase awake through 2026-10-12** (Bar Convent Berlin)
