# Cocktail Census — State

**Last updated**: 2026-09-27
**Status**: 🟢 **LIVE.** Deployed to GitHub Pages. **The repo is now the whole BarNerd shell** — the hub, the Census and ROAST — plus the four room explainers and About. The BCB demo is complete.
**The name is a misnomer**: the repo is `Cocktail-census`, but it hosts far more than the Census.

## Running
**Live:** `b-pingarron.github.io/Cocktail-Census/` — GitHub Pages deploy via `.github/workflows/deploy.yml`.
**Dev server:** not running (run `npm run dev` from `apps/census/`).

## Routing

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `Hub.tsx` | **The hub** — cover (the mark + `ENTER`) and the lounge (five entries, each with *straight in* / *learn more*) |
| `/census` | `CensusIntroPage.tsx` | The Census's short face |
| `/census/learn-more` | `LearnMore.tsx` | The long explanation |
| `/census/vote` | `Census.tsx` | The survey — 100 cards → completion |
| `/roast/enter` | `RoastEnter.tsx` | The Nickname — one optional question, handle generator, Anonymous chip |
| `/roast/deck` | `RoastDeck.tsx` | The 15 specs, one per card |
| `/roast/verdict` | `RoastVerdict.tsx` | What the room said, + cross-comparison against the visitor's own Census results |
| `/room/:room` | `Room.tsx` | The four explainers — census · roast · compositor · recipe-manager |
| `/about` | `About.tsx` | The full About |

`/soon/:room` is **gone** — `ComingSoon.tsx` was deleted in Phase 4.

## Source Files
```
src/
  App.tsx                   ← HashRouter, the route table above
  main.tsx                  ← ReactDOM.createRoot
  index.css                 ← Tailwind directives + Dark Academia CSS vars
  fonts.css                 ← 8 self-hosted faces (Playfair Display, DM Sans)
  roast.css                 ← the ROAST heat design system

  types/
    cocktail.ts             ← Ingredient, Recipe, Cocktail (+ tier), Vote
    roast.ts                ← RoastSpec, RoastVote and friends

  data/
    cocktails.ts            ← 100 cocktails (generated from CSV; ~2207 lines)
    hubEntries.ts           ← HUB_STANDFIRST + the five lounge entries (copy as data)
    roastSpecs.ts           ← the 15 specs, transcribed VERBATIM from
                              Data/burn_hard_420_roast_list.json — typos kept on purpose
    roastNotes.ts           ← the roast notes: 6 levels (meh·cringe·gross / fresh·sick·rad)
                              + 3 element notes (balance·ingredients·glass-garnish)
    roomCopy.ts             ← the four room explainers' copy
    aboutCopy.ts            ← the About copy

  lib/
    utils.ts                ← cn()
    supabase.ts             ← Supabase client (env-keyed; null-safe when env is absent)
    cocktailArt.ts          ← recipe id → its SVG (import.meta.glob over assets/cocktails/*.svg)
    censusState.ts          ← localStorage persistence (votes, position, finished)
    session.ts              ← the anonymous Session id (client UUID, ADR-035)
    nickname.ts             ← the optional Nickname store
    handleGenerator.ts      ← the nickname generator
    intro.ts                ← intro-visibility state
    motion.ts               ← shared motion helpers
    frameGeometry.ts        ← frame geometry for the menu card
    verdict.ts              ← the verdict arithmetic. NO imports — runs directly under node
    waitlist.ts             ← the ask's insert into the `waitlist` table
    roastWipe.ts            ← the Pokemon Gen I `BattleTransition_DoubleCircle`, ported tile for tile.
                              A MODULE, not a component: it has to survive `navigate()`, so the overlay
                              lives in document.body outside React's tree. One entry point:
                              `playRoastWipe(swap)`. Used only at the exit from /roast/enter
    roastWipe.css           ← it owns the CSS for the DOM it creates

  components/
    ui/button.tsx           ← shadcn Button
    MenuCard.tsx            ← the card that turns; every page of the menu gets the turn free
    MartiniMark.tsx         ← the cover mark
    LoungeEntry.tsx         ← one seat in the lounge
    CensusIntro.tsx         ← the Census's short face
    Wordmark.tsx            ← BarNerd wordmark in a gold frame
    ProgressBar.tsx         ← Gradient progress bar
    RecipeDetails.tsx       ← Ingredients + method/glass/garnish grid
    CocktailCard.tsx        ← The Census's voting card
    VoteReceipt.tsx         ← Post-vote chip w/ delayed consensus reveal
    CensusResults.tsx       ← Top-5 agreed/disagreed tables (from the tally view)
    FeedbackForm.tsx        ← Free-text feedback → `feedback`
    CardSkeleton.tsx        ← Loading skeleton
    RoastSpecCard.tsx       ← the ROAST card
    RoomExplainer.tsx       ← one component, four rooms
    PartyAsk.tsx            ← the ask — ONE component in five places
    ExitLink.tsx            ← the emergency exits

  pages/                    ← the routes above

  db/
    schema.sql              ← the original votes schema
    phase0a-schema.sql      ← the catalogue + instances + collections + roast_votes (404 lines)
    add-slug-and-raw-name.sql   ← 0b: specs.slug, spec_ingredients.raw_name
    add-garnish-layer.sql       ← 0b: garnish_elements, garnish_axis_values, spec_garnishes,
                                  spec_garnish_axes, garnish_prose, garnish_asset_map
    add-spec-techniques.sql     ← 0b: spec_techniques (one row per step)
    add-cocktail-tally-view.sql
    add-feedback-table.sql
    add-waitlist-table.sql

  assets/
    header.jpg              ← BarNerd wordmark image
    cover-martini-glass.svg ← the cover art
    cocktail-placeholder.svg← fallback (no card uses it — all 101 have artwork)
    cocktails/              ← 101 SVGs (the 100 + Lion's Tail)
    compositor/             ← 9 files: 6 WebP stills + 3 GIF clips (~307 KB) for the demo
    fonts/                  ← Self-hosted fonts
```

## Config Files
- package.json, vite.config.ts (`base: "./"`), tsconfig.json, tsconfig.app.json, tsconfig.node.json
- tailwind.config.ts, postcss.config.js
- index.html
- `.github/workflows/deploy.yml` (GitHub Pages deploy)
- **`.env` is UNTRACKED** (fixed 2026-09-24). `.env.example` stays tracked as the template. **`.env.production` is still tracked, deliberately** — the deploy workflow has no `env:` block, so without it the deploy has no keys. The cleaner fix is GitHub Actions secrets + an `env:` block.

## What Works
- [x] 100 cocktails (4 tiers), each showing its **own printed SVG** — business rule 14, no AI imagery
- [x] Agree/Disagree voting (swipe or arrow keys), auto-advance, progress bar, localStorage
- [x] Votes post to Supabase; `cocktail_tally` view aggregates them (**verified live 2026-09-26**)
- [x] Completion screen with stats + `CensusResults` rankings + feedback form
- [x] **The hub** — cover, lounge, five entries with two doors each
- [x] **ROAST rung 1** — enter → deck → verdict, with the heat-level notes
- [x] **The ask** — one email + three independent checkboxes → the `waitlist` table
- [x] **The four room explainers** and **About**
- [x] **The Compositor demo** — 6 stills then 3 clips, non-interactive
- [x] **Emergency exits** on the Census vote, the ROAST deck, the ROAST verdict and learn-more
- [x] Dark Academia theme; self-hosted fonts, no external dependency
- [x] Build passes clean (`tsc` + `vite`)

## Images — 50 JPGs on disk, 0 used, on purpose

- **50 `.jpg` files** sit in `src/assets/`. **43** are referenced by `cocktails.ts`; **7** are orphans from an old IBA list.
- The 43 are **AI-generated illustrations that are factually wrong about the drinks** — wrong glasses, wrong garnishes, one glossy product-render signature.
- They are imported but **never rendered**: `cocktail.image` is referenced nowhere in `src/`.
- **This is a decision, not an oversight** — business rule 14: *no AI artwork, and no photo fallback, in anything a stranger sees.*
- **The degradation ladder is `SVG → placeholder`. There is no photo tier.**

## Data Pipeline
- `Data/Raw/cocktails_recipe.csv` ← Difford's 6,956-record dataset
- `Data/cocktails-100.csv` ← Clean 100-cocktail extract (generated)
- `Data/burn_hard_420_roast_list.json` ← **the author's 15 specs.** Named `.json`, is actually plain `key: value` text, and that is fine — `roastSpecs.ts` transcribes it by hand
- `scripts/generate_cocktails_ts.py` ← CSV-to-TypeScript generator
- **`Data/barnerd_lib/`** ← the phase 0b pipeline, 0b's real deliverable: `corpus`, `catalogue`, `rulings`, `tokens`, `names`, `techniques`, `garnishes`, `components`, `spec_ids`, `load*`, `run_load`, `lesson_builder`, `lesson_01..06`. Plus `Data/__pycache__/` (should be gitignored)

## Database — loaded 2026-10-03 (phase 0b)

**Twelve tables, loaded, integrity-clean.** Five zeros on the checks that matter:

```
glassware               46      specs                  6,956   slug 6,956 / null 0
ingredients          1,174      spec_ingredients      31,907   raw_name 31,907 / null 0
ingredient_aliases   1,950      spec_techniques        9,195
techniques              12      spec_garnishes         9,624
garnish_axis_values     85      spec_garnish_axes     10,168
garnish_elements     1,120      garnish_prose          2,477
```

- **The precondition is met: `aliases_without_an_ingredient = 0`.** Every one of the 31,907 ingredient rows points at an ingredient that exists. The plan called this a precondition, not a goal — *"98% of aliases resolved means 0 specs loaded."*
- **Two non-zero counts are correct and known:** 20 specs with no technique (methods with no verb, all accounted for) and 12 with no garnish row (`NOISE` or empty cells).
- **The rule that defines a generic is INTERCHANGEABILITY**, not similarity — if you can swap one for the other in a drink, they are the same generic. It produced **1,747 raw names → 1,043 generics**, finer than the estimate, which is why the Phase 5 picker will need search or category filtering rather than a plain dropdown.
- **`specs.id` is DERIVED, not invented:** `uuid5(NAMESPACE, "barnerd-spec:" + folded_name + "#" + ordinal)`. 72 titles in the corpus are two or three *different* drinks, so joining on the name multiplies rows; a derived id cannot.
- **`raw_name` and `canonical_name` are both stored** — `Rutte Dry Gin` and `dry gin` are different facts. The generic is the vocabulary; the raw name is the recipe.
- **Transport is `psql` over `Data/barnerd_lib/run_load.py`**, not the SQL editor: measured, the editor passes 146 KB, hangs at 196 KB, refuses 391 KB. The runner has a connectivity probe, a per-file ceiling, and a **drift check** that refuses when the manifest and the directory disagree.
- **Full record:** `.sisyphus/reports/2026-10-03-phase0b-wrapup.md` — 20 decisions, 22 bugs (ten of them silent), and the six didactic notebooks.

## Known Issues
- **43 factually-wrong AI illustrations are still in the tree**, imported and unused. They must never be wired into the card (business rule 14).
- **7 orphaned JPGs** in `assets/` (harmless, not imported).
- **A failed vote insert is not retried.** Local-first works; the flow never blocks. A vote that does not reach Supabase stays on the device (business rule 6).
- **The vote count is inflated ~2× by a fixed double-vote bug.** Files under `votes` are roughly double the gestures. Do not put a traction number on any page.
- **No controversy-first ordering.** Specs appear in their generated order.
- **A single card's illustration can be ~2.9 MB** (`pina-colada`, `mai-tai`, `suffering-bastard`). Each card downloads its own. Reported, not scheduled.
- **No Supabase Auth and none planned for BCB** — by decision. See `docs/adr/ADR-035-local-session-identity.md`.

## Source Control
**This IS a git repo.**

- Remote: `B-Pingarron/Cocktail-census`, branch `main`
- **HEAD `16a98d7`** ("feat(roast): four wipes at the /roast/enter exit, picked at random") — working tree clean, `main` **level with `origin/main`**
- Recent: `7d2ff11` (the DoubleCircle transition out of /roast/enter) · `f9ed71e` (Phase 4) · `97f66a8` (ROAST rung 1) · `160c732` (untrack .env, rename Landing, order the lounge) · `613a54a` (the hub shell) · `5026ea0` (Phase 0a schema + session)
- Only untracked path: `design-ideas/` (two HTML design studies, the user's call)
- `STATE.md` itself is tracked — editing it leaves the repo dirty, which is expected

## Dependencies
react 18.3 · react-router-dom 6 · lucide-react · class-variance-authority · tailwindcss 3.4 ·
vite 5.4 · @vitejs/plugin-react-swc · typescript 5.8 · @supabase/supabase-js

## Next
**The BCB demo is complete, and the catalogue is loaded.** One phase remains, and it is unblocked:

**Phase 5 — the mini-RM.** Spec editor, list manager, arena generalised. `.sisyphus/handoffs/2026-09-22-roast-my-spec-handoff.md`

The wrap-up's own line: *"The only thing between here and a working mini recipe creator is the app code."*

**Four items from 0b remain, none blocking:** the alternatives gap (`Lillet Blanc (or other aromatized wine)` stores only `lillet`); `spec_aliases`; the 78 uncategorised ingredients (`categories.csv` has 16 rows and no review); and `spec_ingredients.role` (the column exists and is NULL).

**Parked by explicit decision:** the 209 component recipes have no table; ABV (it varies by product, not category — a number per category would be an invented fact); `8verlast`'s method writes `Special ingredient #1:` twice.

Full order: `.sisyphus/plans/2026-09-22-hub-and-roast-plan.md` §15.

**A best-case dream, not a constraint:** the three-day BCB rollout concept (Day 2 = a rustic mini-RM inside ROAST; Day 3 = an interactive mini-Compositor). It orders nothing — it is what the event looks like *if* Phase 5 lands early and clean.
