# Next Session — Supabase + Deploy

## Context
Cocktail Census is a Vite + React + TypeScript SPA at `01_BarNerd/apps/census/` with 100 cocktails and a voting flow that currently stores votes only in localStorage. Decision made to use **Supabase** as the backend to persist votes.

## What to Do (in order)

### 1. Initialize Git
```powershell
cd 01_BarNerd
git init
git add .
git commit -m "feat: scaffold Cocktail Census with 100 cocktails and Dark Academia theme"
```
Add `.gitignore` already exists in plan.

### 2. Create Supabase Project
- Go to [supabase.com](https://supabase.com) → Create new project
- Table `votes` with schema:
  - `id` uuid PK (default gen_random_uuid())
  - `cocktail_id` text NOT NULL
  - `recipe_id` text NOT NULL
  - `vote` text NOT NULL ('agree' | 'disagree')
  - `timestamp` bigint NOT NULL
  - `created_at` timestamptz default now()

### 3. Install Supabase Client
```powershell
cd apps/census
bun add @supabase/supabase-js
```

### 4. Wire Voting Flow
- Create `src/lib/supabase.ts` — init client from env vars
- In `Census.tsx` or a custom hook, POST vote to Supabase after each `handleVote` call
- Keep localStorage as optimistic/local cache; Supabase as the source of truth
- Add `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### 5. Fix Vite Config for GitHub Pages
In `vite.config.ts`, set `base: "./"` or a script to switch it for deploy.

### 6. Deploy to GitHub Pages
- Create `.github/workflows/deploy.yml` — build on push to main, deploy to Pages
- Or just push and use the GitHub Actions + Pages static site config

### 7. Verify
- Submit votes from the browser
- Query Supabase dashboard: `SELECT cocktail_id, vote, count(*) FROM votes GROUP BY cocktail_id, vote`

## Design Work Pending
User mentioned wanting to work on design before backend. If design work comes first, the Supabase wiring is independent — it's just adding POST calls to the existing vote handler. No design changes needed for the backend integration.

## Files of Interest
- `STATE.md` — full project state
- `src/pages/Census.tsx` — voting logic lives here (handleVote, handleNext)
- `src/types/cocktail.ts` — Vote interface
- `vite.config.ts` — needs base path fix for Pages
