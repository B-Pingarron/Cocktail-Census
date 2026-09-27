# Cocktail Census — State

**Last updated**: 2026-09-26
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
    phase0a-schema.sql      ← the catalogue + instances + collections + roast_votes
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
- **HEAD `f9ed71e`** ("feat(roast): phase 4 — room explainers, about, the ask, the compositor demo") — working tree clean, `main` **level with `origin/main`**
- Recent: `97f66a8` (ROAST rung 1) · `160c732` (untrack .env, rename Landing, order the lounge) · `613a54a` (the hub shell) · `5026ea0` (Phase 0a schema + session)
- Only untracked path: `design-ideas/` (two HTML design studies, the user's call)
- `STATE.md` itself is tracked — editing it leaves the repo dirty, which is expected

## Dependencies
react 18.3 · react-router-dom 6 · lucide-react · class-variance-authority · tailwindcss 3.4 ·
vite 5.4 · @vitejs/plugin-react-swc · typescript 5.8 · @supabase/supabase-js

## Next
**The BCB demo is complete.** What remains is two phases, both after a complete product:

1. **Phase 0b — the catalogue data.** The generic ingredient layer: 1,742 names → ~250 generics, categorised; the technique list; the alternatives. `.sisyphus/handoffs/2026-09-22-recipe-management-handoff.md`
2. **Phase 5 — the mini-RM.** Spec editor, list manager, arena generalised. `.sisyphus/handoffs/2026-09-22-roast-my-spec-handoff.md`

Both **blocked on nothing but time**. Full order: `.sisyphus/plans/2026-09-22-hub-and-roast-plan.md` §15.

**Deferred, not approved:** a three-day BCB rollout concept (Day 2 = a rustic mini-RM inside ROAST; Day 3 = an interactive mini-Compositor). If it becomes a commitment, **0b and 5 move onto the critical path** and the freeze stops being the end of the build.
