-- ============================================================
-- Cocktail Census — Supabase Schema
-- Run this in the Supabase SQL Editor after creating a project.
-- ============================================================

-- 1. Votes table
create table if not exists public.votes (
  id          uuid        not null default gen_random_uuid() primary key,
  cocktail_id text        not null,
  recipe_id   text        not null,
  vote        text        not null check (vote in ('agree', 'disagree')),
  timestamp   bigint      not null,
  created_at  timestamptz not null default now()
);

-- Speed up queries like "count votes per cocktail"
create index if not exists idx_votes_cocktail_id on public.votes (cocktail_id);
create index if not exists idx_votes_recipe_id  on public.votes (recipe_id);

-- 2. Row-Level Security: allow anonymous inserts, deny reads
alter table public.votes enable row level security;

create policy "Anyone can insert a vote"
  on public.votes
  for insert
  to anon
  with check (true);

-- Votes are public-read for the stats view in future phases
create policy "Anyone can read votes"
  on public.votes
  for select
  to anon
  using (true);

-- 3. Optional: prevent duplicate votes from the same browser session
--    (handled client-side; this is a safety net)
-- create policy "No update, no delete"
--   on public.votes
--   for all
--   to anon
--   using (false)
--   with check (false);

-- ============================================================
-- Done. Your app can now insert votes via:
--   supabase.from('votes').insert({ cocktail_id, recipe_id, vote, timestamp })
-- ============================================================
