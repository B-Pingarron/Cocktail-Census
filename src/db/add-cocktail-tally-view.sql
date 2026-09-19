-- ============================================================
-- Cocktail Census — add the aggregate tally view
--
-- WHY A VIEW AND NOT A TABLE OR A MATERIALIZED VIEW
--   A view is a stored query, not a snapshot: every SELECT re-runs it against current
--   data. There is therefore nothing to refresh, it can never go stale, and a visitor who
--   has just finished sees counts that already include their own votes.
--
--   A materialized view would be worse here. REFRESH MATERIALIZED VIEW cannot be run by
--   the anon role, so it would have to be exposed through a SECURITY DEFINER function —
--   which would let any visitor trigger a full recompute at will.
--
-- RUN THIS IN THE SUPABASE SQL EDITOR (anon keys cannot create views).
-- Idempotent: safe to run more than once.
-- ============================================================

create or replace view public.cocktail_tally as
select
  cocktail_id,
  count(*) filter (where vote = 'agree')    as agrees,
  count(*) filter (where vote = 'disagree') as disagrees,
  count(*)                                  as total
from public.votes
group by cocktail_id;

-- The anon role needs explicit read access to the view.
grant select on public.cocktail_tally to anon;

-- ============================================================
-- NOTE — deliberately NOT changed here
--   schema.sql currently grants anon `select` on public.votes with `using (true)`,
--   so the complete raw vote set is readable by anyone holding the public anon key.
--   There is no personal data in those rows (votes carry no user identity), so this is
--   not a GDPR exposure — but it does mean the whole dataset is scrapable, and the
--   dataset is the asset the census exists to produce.
--
--   Once this view is live, the app reads ONLY the aggregate, so that raw policy could be
--   dropped. That is a security decision for the project owner, not for this migration.
-- ============================================================
