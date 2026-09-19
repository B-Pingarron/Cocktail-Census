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

-- 2. Grant base permissions to the anon role (required by Supabase)
grant usage on schema public to anon;
grant select, insert on public.votes to anon;

-- 3. Row-Level Security: allow anonymous inserts, deny reads
alter table public.votes enable row level security;

drop policy if exists "Anyone can insert a vote" on public.votes;
create policy "Anyone can insert a vote"
  on public.votes
  for insert
  to anon
  with check (true);

-- Votes are public-read for the stats view in future phases
drop policy if exists "Anyone can read votes" on public.votes;
create policy "Anyone can read votes"
  on public.votes
  for select
  to anon
  using (true);

-- 4. Optional: prevent duplicate votes from the same browser session
--    (handled client-side; this is a safety net)
-- create policy "No update, no delete"
--   on public.votes
--   for all
--   to anon
--   using (false)
--   with check (false);

-- ============================================================
-- 5. Aggregate tally view — feeds the "top loved / top hated" tables on the results page.
--
--    A view, NOT a table or a materialized view. It is a stored query: every SELECT
--    re-runs it against current data, so there is nothing to refresh and it cannot go
--    stale. A materialized view would need REFRESH MATERIALIZED VIEW, which the anon
--    role cannot run — exposing that through a SECURITY DEFINER function would let any
--    visitor trigger a full recompute.
--
--    Kept identical to src/db/add-cocktail-tally-view.sql, which is the migration to run
--    against an already-provisioned database. Change one, change the other.
-- ============================================================

create or replace view public.cocktail_tally as
select
  cocktail_id,
  count(*) filter (where vote = 'agree')    as agrees,
  count(*) filter (where vote = 'disagree') as disagrees,
  count(*)                                  as total
from public.votes
group by cocktail_id;

grant select on public.cocktail_tally to anon;

-- ============================================================
-- Done. Your app can now insert votes via:
--   supabase.from('votes').insert({ cocktail_id, recipe_id, vote, timestamp })
-- ============================================================
