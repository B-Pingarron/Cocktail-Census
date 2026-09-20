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
-- 6. Feedback — free text from visitors, shown on the results screen.
--
--    Opposite read policy to votes, deliberately. Votes carry no identity and their
--    aggregate IS the deliverable, so votes are publicly readable. Feedback is free text
--    a stranger typed and must stay private: anon gets INSERT only, never SELECT. Read it
--    in the dashboard table editor.
--
--    Kept identical to src/db/add-feedback-table.sql, the migration for a live database.
--    Change one, change the other.
-- ============================================================

create table if not exists public.feedback (
  id         uuid        not null default gen_random_uuid() primary key,
  message    text        not null,
  created_at timestamptz not null default now(),
  -- Bounds the damage from a public write endpoint with a free-text field.
  constraint feedback_message_length check (char_length(message) between 1 and 2000)
);

grant insert on public.feedback to anon;

alter table public.feedback enable row level security;

drop policy if exists "Anyone can leave feedback" on public.feedback;
create policy "Anyone can leave feedback"
  on public.feedback
  for insert
  to anon
  with check (true);

-- No select policy for anon: intentional.

-- ============================================================
-- Done. Your app can now insert votes via:
--   supabase.from('votes').insert({ cocktail_id, recipe_id, vote, timestamp })
-- ============================================================
