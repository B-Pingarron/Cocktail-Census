# Cocktail Census — State

**Last updated**: 2026-09-18
**Status**: 🟢 **LIVE.** Deployed to GitHub Pages and writing votes to Supabase.

## Running
**Live:** `b-pingarron.github.io/Cocktail-Census/` — GitHub Pages deploy succeeded **2026-09-16 23:04** (workflow: `.github/workflows/deploy.yml`).
**Dev server:** not running.

## Source Files
```
src/
  App.tsx                   ← Router entry, / → Census
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
  components/
    ui/button.tsx           ← shadcn Button (4 variants, 4 sizes)
    ProgressBar.tsx         ← Gradient progress bar (current/total)
    RecipeDetails.tsx       ← Ingredients + method/glass/garnish grid
    CocktailCard.tsx        ← Main voting card (vote → next)
  pages/
    Census.tsx              ← Survey flow (100 cards → completion stats → Supabase insert)
  assets/
    cocktail-placeholder.svg ← THE ONLY ARTWORK THAT RENDERS
    50 cocktail .jpg        ← 43 referenced by cocktails.ts, 7 orphaned — ALL deliberately unused
```

## Config Files
- package.json, vite.config.ts (`base: "./"`), tsconfig.json, tsconfig.app.json, tsconfig.node.json
- tailwind.config.ts, postcss.config.js
- index.html (Google Fonts: Playfair Display + DM Sans)
- `.github/workflows/deploy.yml` (GitHub Pages deploy)
- `.env`, `.env.example`, `.env.production` — **all three are tracked in git** (see Known Issues)

## What Works
- [x] 100 cocktails (4 tiers, Top 100 All Time list from 15+ sources)
- [x] Ingredient data sourced from Difford's dataset (facts only)
- [x] Methods rewritten as functional technique descriptions (no copyright exposure)
- [x] **No cocktail photography or AI illustration renders anywhere.** Every card shows `cocktail-placeholder.svg` — deliberate, business rule 14 (see Images below)
- [x] Agree/Disagree voting on standard recipe
- [x] **Votes post to Supabase** (`.from("votes").insert(...)`, `src/pages/Census.tsx:78-81`)
- [x] Next/Previous navigation
- [x] Progress bar updates in real-time
- [x] Completion screen with agree/disagree stats + JSON export + Start Over
- [x] localStorage persistence (votes, position, finished state survive refresh) — local-first, the flow never blocks on the network
- [x] Reset progress button (header + completion screen)
- [x] Export Votes as downloadable JSON file
- [x] Dark Academia theme (gold `#c7a34b`, forest `#0e2a21`, background `#0e0e0e`, cream `#f3efe6`)
- [x] Build passes clean (tsc + vite, ~2.3s, 70KB JS gzipped)
- [x] **GitHub Pages deploy, verified end-to-end**

## Images — 50 JPGs on disk, 0 used, on purpose

- **50 `.jpg` files** sit in `src/assets/`. **43** are referenced by `cocktails.ts`; **7** are orphans from an old IBA list (`amaretto-sour`, `blood-sand`, `corpse-reviver`, `dark-stormy`, `gin-tonic`, `martini`, `naked-famous`).
- The 43 are **AI-generated illustrations that are factually wrong about the drinks** — `negroni.jpg` shows a **wine glass**; `margarita.jpg` shows ice cubes in a coupe with **no salt rim**. They share one AI product-render signature (glossy shading, floating diamond ice, off-white background). In front of a hall of bartenders, a wrong-glass Negroni reads as *doesn't know* — worse than a placeholder reading as *unfinished*.
- They are imported but **never rendered**: `CocktailCard.tsx:171` renders `cocktail-placeholder.svg` unconditionally, and `cocktail.image` is not referenced anywhere in `src/`.
- **This is a decision, not an oversight** — business rule 14: *no AI artwork, and no photo fallback, in anything a stranger sees.*
- **The degradation ladder is `SVG → placeholder`. There is no photo tier.** Which means the printed Compositor SVGs are the only acceptable card artwork, and there is no plan B behind them.
- Do not describe the app as "100 cocktails with images" or "43 cocktails with images". It has 100 cocktails and one placeholder icon.

## Data Pipeline
- Data/Raw/cocktails_recipe.csv       ← Difford's 6,956-record dataset
- Data/cocktails-100.csv              ← Clean 100-cocktail extract (generated)
- Data/Research/Top-100-Cocktails-Research.md  ← Full research report
- Data/extract_cocktails.py           ← Extraction script (re-runnable)
- scripts/generate_cocktails_ts.py    ← CSV-to-TypeScript generator
- apps/census/src/data/cocktails.ts   ← Generated output (2207 lines, auto-generated)

## Known Issues
- **All 100 cards show a placeholder.** The only fix is the Compositor's export job, which is 0% built (see `apps/compositor/STATE.md`, item 1). The Census card cannot improve until printed SVGs exist.
- **43 factually-wrong AI illustrations are still in the tree**, imported and unused. They must never be wired into the card (business rule 14). Their continued presence is a standing invitation to wire them in by mistake.
- **7 orphaned JPGs** in `assets/` from an old IBA list (harmless, not imported).
- **`.env`, `.env.example` and `.env.production` are tracked in git.** The values are the public Supabase URL + anon key, so this is not a leaked secret, but a tracked `.env` is a bad habit that will bite the moment a real secret is added.
- **A failed vote insert is not retried.** Local-first works and the flow never blocks; a vote that does not reach Supabase stays on the device (business rule 6). Accepted for BCB — the Supabase project was restored to **Healthy** on 2026-09-16, so the live failure mode is a transient wifi blip rather than an unreachable backend.
- ~~Build uses absolute paths. GitHub Pages subpath deploy needs `base: "./"`~~ — **fixed** (`vite.config.ts` → `base: "./"`) and the subpath deploy works.

## Dependencies
Key: react 18.3, react-router-dom 6.30, lucide-react, class-variance-authority,
     tailwindcss 3.4, vite 5.4, @vitejs/plugin-react-swc, typescript 5.8,
     **@supabase/supabase-js**

*(The old "169 packages" figure was stale; the installed tree holds ~102 entries.)*

## Source Control
**This IS a git repo.** The previous claim — *"This directory is not a git repo. No .git initialized yet"* — was flatly false.

- Remote: `B-Pingarron/Cocktail-census`, branch `main`
- **Pushed and deployed:** `8f59d6f` ("feat: census app — 100 cocktails, Dark Academia theme") — `origin/main`, Pages deploy succeeded 2026-09-16 23:04
- **Local HEAD:** `4642bcf` ("Create garnish_cleaning.ipynb", 2026-09-17) — **1 commit ahead of `origin/main`, not pushed**
- `STATE.md` itself is tracked — editing it leaves the repo dirty, which is expected

## Backend Decision (2026-05-16)
**Chosen: Supabase** — Postgres-hosted REST API for collecting votes when the app goes live on GitHub Pages.

**All seven original next-session tasks are DONE:**
1. ✅ Git repo initialized
2. ✅ Supabase project created (`votes` table)
3. ✅ `@supabase/supabase-js` wired (`src/lib/supabase.ts`, env-keyed via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`)
4. ✅ Voting flow posts on each vote action
5. ✅ Environment config added
6. ✅ Deployed to GitHub Pages with the `base: "./"` fix and `.github/workflows/deploy.yml`
7. ✅ Verified end-to-end

**The project was later paused for inactivity and restored to Healthy on 2026-09-16** — the key wiring was never at fault.

**Identity:** there is no login and no session. Votes carry **no user identity at all**; the client only needs the public URL + anon key. Note for the record: `signInAnonymously()` is called **nowhere in `src/`**, so anonymous-identity *authority* is not yet implemented — and the project's own gap list still names *identity* as open.

### Next Session Tasks (what actually remains)
Per the current source of truth (`openspec/changes/barnerd-bcb-demo/proposal.md` §5.1), the real Census gaps are **identity, controversy ordering, completion insights, feedback, About, waitlist**. Plus, in this repo:

1. **Feed real artwork into the card** — blocked upstream on the Compositor export job; nothing to do here until printed SVGs exist.
2. **Decide the fate of the 43 AI illustrations and the 7 orphans** — remove them so nobody wires them in, or park them somewhere that is not `src/`.
3. **Untrack `.env`** before it holds anything that matters.
4. **Keep Supabase awake through 2026-10-12** (Bar Convent Berlin) — it paused once for inactivity.
