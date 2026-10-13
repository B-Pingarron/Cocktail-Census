-- ============================================================
-- BarNerd Phase 5 (5c) -- INGREDIENT USAGE, for the picker's ranking
--
-- Section 7b, on the picker: "RECENTS FIRST, falling back to most-used, with search over canonical
-- names AND aliases, RANKED BY USAGE COUNT."
--
-- WHY A VIEW AND NOT A QUERY. The ranking needs, for every generic, how many specs use it.
-- `spec_ingredients` holds 31,907 rows, so the browser cannot fetch it and count for itself -- and
-- PostgREST caps a response at 1,000 rows by default, so it could not even if the browser were willing.
-- The aggregate has to happen where the rows are.
--
-- `security_invoker = true` IS THE IMPORTANT LINE. A view created without it runs with its OWNER's
-- rights, which would BYPASS the row level security on `spec_ingredients` -- the view would be a hole
-- in the wall that `add-rung2-units-and-read-policies.sql` just closed. With `security_invoker` the
-- view reads as the CALLER, so `anon` gets exactly what `anon` is allowed to read and nothing more.
-- (Postgres 15+; Supabase runs 15.)
--
-- THE GRANT IS A SEPARATE KEY FROM THE POLICY, as the lego-box fix learned the hard way: a new object
-- needs both, or `anon` gets `permission denied`.
--
-- IDEMPOTENT. `create or replace` for the view, `drop ... if exists` for the policy.
-- ============================================================


create or replace view public.ingredient_usage
with (security_invoker = true)
as
select
  si.ingredient_id,
  count(*)::integer as usage
from public.spec_ingredients si
group by si.ingredient_id;

comment on view public.ingredient_usage is
  'How many specs use each generic. For the picker''s usage ranking (section 7b). security_invoker, so it cannot read past RLS.';

grant select on public.ingredient_usage to anon;

-- A view does not carry RLS of its own; `security_invoker` makes it obey the base table's. This
-- policy is on the VIEW and is what lets `anon` select from it at all.
alter view public.ingredient_usage set (security_invoker = true);
