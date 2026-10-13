-- ============================================================
-- BarNerd -- LIQUEUR BRAND ALIASES, and the fernet merge that never happened
--
-- Asked for by the user, 2026-10-06, while preparing the author's 15 as a real Submission:
--
--   1. "benedictine: you are right, can you add the proper entry for the brand product?"
--   2. "merge that never happened, lets leave it as fernet liqueur. tho, for this one i do want the
--      brand displayed in my 15."
--
-- WHY THESE TWO AND NOT OTHERS. Both were reported as "lego-box gaps" by an earlier pass and BOTH
-- WERE FALSE, because that pass searched `ingredients.canonical_name` only. Section 7b says it
-- outright: "brands arrive via `raw_name`". The brand names live in `ingredient_aliases`, so a search
-- of the generics can never find `Fernet Branca` and will always report a gap that is not there.
--
-- What was actually missing was narrower, and only for the author's own wording:
--
--   'Benedictine D.O.M.'   0 aliases    <- his exact string, in roastSpecs.ts
--   'Fernet Branca'        0 aliases    <- his exact string
--
-- The generics both exist: `benedictine liqueur`, and TWO fernets.
--
-- ============================ THE FERNET MERGE =================================================
--
-- There are two fernet generics, and they are one liquid:
--
--   fernet digestive bitter liqueur   <- alias "Fernet Branca digestive bitter liqueur"  (12 rows)
--   fernet liqueur                    <- alias "Fernet liqueur"                           (50 rows)
--
-- Section 7b's rule: "if you can swap one for the other in a drink, they are the same generic."
-- `Fernet Branca` is a BRAND of fernet, not a different liquid. The user's call: merge into
-- `fernet liqueur`.
--
-- ORDER MATTERS, AND IT IS NOT OBVIOUS:
--   * `spec_ingredients.ingredient_id` is `ON DELETE RESTRICT`, so the generic cannot be deleted
--     while those 12 rows point at it.
--   * `ingredient_aliases.ingredient_id` is `ON DELETE CASCADE`, so deleting the generic WOULD have
--     silently taken its alias with it.
-- Both are handled by repointing before retiring.
--
-- `raw_name` IS NOT TOUCHED. That is the point of storing both: the recipe keeps saying "Fernet
-- Branca" -- the brand the author wrote -- while resolving to the generic `fernet liqueur`. This is
-- exactly what the user asked for: "i do want the brand displayed in my 15."
--
-- IDEMPOTENT. Re-running repoints nothing, re-adds nothing, and deletes nothing.
-- ============================================================


-- ---------------------------------------------------------------------------------------------
-- 1. BENEDICTINE -- the brand product entry
-- ---------------------------------------------------------------------------------------------
insert into public.ingredient_aliases (alias, ingredient_id)
select 'Benedictine D.O.M.', i.id
from public.ingredients i
where i.canonical_name = 'benedictine liqueur'
on conflict (alias) do update set ingredient_id = excluded.ingredient_id;


-- ---------------------------------------------------------------------------------------------
-- 2. FERNET -- repoint the corpus rows onto `fernet liqueur`
--
-- 12 rows move. Their `raw_name` stays `Fernet Branca digestive bitter liqueur`, which is what the
-- recipe wrote; only the generic they resolve to changes.
-- ---------------------------------------------------------------------------------------------
update public.spec_ingredients
   set ingredient_id = (select id from public.ingredients where canonical_name = 'fernet liqueur')
 where ingredient_id = (select id from public.ingredients where canonical_name = 'fernet digestive bitter liqueur');


-- ---------------------------------------------------------------------------------------------
-- 3. FERNET -- repoint the alias, BEFORE the generic is retired
-- ---------------------------------------------------------------------------------------------
update public.ingredient_aliases
   set ingredient_id = (select id from public.ingredients where canonical_name = 'fernet liqueur')
 where ingredient_id = (select id from public.ingredients where canonical_name = 'fernet digestive bitter liqueur');


-- ---------------------------------------------------------------------------------------------
-- 4. FERNET -- the author's exact string, so his 15 resolve
-- ---------------------------------------------------------------------------------------------
insert into public.ingredient_aliases (alias, ingredient_id)
select 'Fernet Branca', i.id
from public.ingredients i
where i.canonical_name = 'fernet liqueur'
on conflict (alias) do update set ingredient_id = excluded.ingredient_id;


-- ---------------------------------------------------------------------------------------------
-- 5. FERNET -- retire the merged generic, but ONLY once nothing points at it
--
-- The two NOT EXISTS clauses are the guard. If either is non-zero the delete does nothing rather
-- than cascading or failing -- so a mistake here is a no-op, not a loss.
-- ---------------------------------------------------------------------------------------------
delete from public.ingredients
 where canonical_name = 'fernet digestive bitter liqueur'
   and not exists (select 1 from public.spec_ingredients si where si.ingredient_id = ingredients.id)
   and not exists (select 1 from public.ingredient_aliases a where a.ingredient_id = ingredients.id);


-- ============================================================
-- 6. TRIPLE SEC -- the one REAL duplicate among the liqueur pairs
--
-- WHY ONLY THIS ONE. Five pairs looked like duplicates by name. Reading their rows killed four:
--
--   campari            -> raw_name "Cocoa nib-infused Campari"            an INFUSION
--   elderflower        -> raw_name "Elderflower presse"                   a DIFFERENT PRODUCT
--   yellow chartreuse  -> raw_name "Yellow Chartreuse foam"               a PREPARATION
--   chartreuse liqueur -> raw_name "Chartreuse Liqueur du 9 Centenaire"  a SPECIFIC BOTTLE
--
-- Not one of those is interchangeable with its partner, so not one is a duplicate. Phase 0b split
-- them out deliberately and was right to. This file's first draft called all five merges; that was
-- name-pattern-matching, not measurement.
--
-- `triple sec` IS the real one. Triple sec is a liqueur by definition, and every alias on the pair is
-- a brand of the same liquid: De Kuyper Triple Sec, Cointreau triple sec liqueur, Combier L'Original,
-- Giffard Triple Sec Liqueur.
--
-- THE TARGET IS `triple sec` -- the shorter name AND the one with more rows (379 vs 170), so fewer
-- rows move. Same reasoning that chose `fernet liqueur`.
-- ============================================================

update public.spec_ingredients
   set ingredient_id = (select id from public.ingredients where canonical_name = 'triple sec')
 where ingredient_id = (select id from public.ingredients where canonical_name = 'triple sec liqueur');

update public.ingredient_aliases
   set ingredient_id = (select id from public.ingredients where canonical_name = 'triple sec')
 where ingredient_id = (select id from public.ingredients where canonical_name = 'triple sec liqueur');

delete from public.ingredients
 where canonical_name = 'triple sec liqueur'
   and not exists (select 1 from public.spec_ingredients si where si.ingredient_id = ingredients.id)
   and not exists (select 1 from public.ingredient_aliases a where a.ingredient_id = ingredients.id);


-- ============================================================
-- NOT MERGED, AND DELIBERATELY -- recorded so nobody "fixes" them later
--
--   campari                 1 row    holds an infusion; the generic NAME is the odd thing here, not
--                                    the split. Worth a rename, not a merge.
--   elderflower             1 row    holds a presse -- a soft drink, not the liqueur.
--   yellow chartreuse       1 row    holds a foam. A PROCESS baked into an ingredient name; the same
--                                    question exists for every "X foam" row in the vocabulary.
--   chartreuse liqueur      1 row    holds the 9e Centenaire bottling.
-- ============================================================
