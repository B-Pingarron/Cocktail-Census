-- ============================================================
-- THE AUTHOR'S FIFTEEN -- TWO `cocktail_slug` VALUES THAT ARE NOT POOL IDS
--
-- applied with: psql -1 -f this-file
-- Run it AFTER add-rung2-roast.sql and after the cocktails seed. It repairs rows those two created.
-- ============================================================
--
-- WHAT WENT WRONG, and nothing was mistyped. `Data/barnerd_lib/load_roast_list.py` COMPUTES each
-- spec's `cocktail_slug` from the recipe's display name -- `slugify(name)`: lower-case, every run of
-- non-alphanumerics collapsed to one dash. That reproduces the Census convention for a plain name,
-- and for thirteen of the fifteen it happens to land on the Pool's own id. Two titles carry
-- punctuation the source SPELLED OUT rather than dropped:
--
--   name            slugify wrote      the Pool's id       where that id comes from
--   Lion's Tail     lion-s-tail        lions-tail          load_cocktails.py, ADOPTED
--   Blood & Sand    blood-sand         blood-and-sand      Data/cocktails-100.csv, id column
--
-- WHY IT SURVIVED A BUILD, A TYPECHECK AND A BROWSER PASS. `specs.cocktail_slug` is plain text with
-- an index and NO FOREIGN KEY -- add-rung2-roast.sql's own comment says the `cocktails` table exists
-- precisely so it CAN have one, and the constraint was never added. So the wrong value is legal SQL
-- and nothing raises. The app's only reader is `cocktailArt()`, a Map lookup that misses and returns
-- the shared placeholder. One card in fifteen draws a grey box; the other fourteen draw fine -- which
-- is what makes it read as a broken image rather than as a wrong id.
--
-- TWO CONSEQUENCES, NOT ONE:
--   1. THE PICTURE. `cocktailArt('lion-s-tail')` misses, so the arena card shows the placeholder.
--   2. THE EDITOR RAISES. `save_spec_draft()` refuses a slug that is not in `cocktails` by design --
--      `raise exception 'save_spec_draft: unknown cocktail_slug %'`. The roster links to
--      `/roast/edit?cocktail=<slug>`, so opening either drink from **My drinks** and saving errors.
--
-- WHAT IS *NOT* AFFECTED, checked rather than assumed. `roast_votes.spec_ref` is the spec's ROW UUID
-- (`RoastDeck.tsx`: `spec_ref: spec.id`), never the slug. No vote is misfiled, no tally moves, and
-- the verdict page reads counts by `spec_ref`, so it is untouched. This is a display-and-address
-- defect, not a data-integrity one -- which is why the repair is two UPDATEs and not a rebuild, and
-- why nothing needs re-voting.
--
-- WHY A REPAIR FILE AT ALL, WHEN THE GENERATOR IS ALSO FIXED. The seed's spec insert is
-- `where not exists (... and s.name = ...)`, so re-running it against THIS database skips both rows:
-- the names already exist. A regenerated seed fixes a FRESH database; this file fixes this one.
-- ============================================================


-- ============================================================
-- 1. THE REPAIR
-- ============================================================
-- Scoped to the author's own session, so a visitor's spec that happens to carry one of these two
-- values is not silently rewritten. The guard, if `one_live_per_cocktail` raises, is the constraint
-- doing its job: a second live spec already holds the correct slug for that (session, drink), and
-- those two rows need a human rather than a repair.
update public.specs
   set cocktail_slug = 'lions-tail'
 where session_id = 'barnerd-420-author'
   and cocktail_slug = 'lion-s-tail';

update public.specs
   set cocktail_slug = 'blood-and-sand'
 where session_id = 'barnerd-420-author'
   and cocktail_slug = 'blood-sand';


-- ============================================================
-- 2. THE RECEIPT -- rows 1 and 2 must read 0, rows 3 and 4 must read 1
-- ============================================================
-- Row 5 is the one that matters beyond this file: it counts THE CLASS, not the two, so any other
-- derived slug that missed is visible here rather than discovered by a missing picture.
select '1 specs on lion-s-tail (should be 0)' as check, count(*)::text as n
  from public.specs where cocktail_slug = 'lion-s-tail'
union all
select '2 specs on blood-sand (should be 0)', count(*)::text
  from public.specs where cocktail_slug = 'blood-sand'
union all
select '3 specs on lions-tail (should be 1)', count(*)::text
  from public.specs where cocktail_slug = 'lions-tail'
union all
select '4 specs on blood-and-sand (should be 1)', count(*)::text
  from public.specs where cocktail_slug = 'blood-and-sand'
union all
select '5 ANY spec whose slug is not a Pool id (the class)', count(*)::text
  from public.specs s
 where s.cocktail_slug is not null
   and not exists (select 1 from public.cocktails c where c.id = s.cocktail_slug);


-- ============================================================
-- 3. THE STRUCTURAL FIX -- the foreign key add-rung2-roast.sql asked for by name
-- ============================================================
-- Its own comment: "`specs.cocktail_slug` needs a real foreign key, or the name becomes 'a string
-- that ought to match'". With the constraint, this whole class is impossible rather than merely
-- repaired: the next derived slug that misses is rejected by the database at insert time, loudly.
--
-- WHY `on update cascade` AND NO `on delete`. The Pool is append-only and its ids are keys that
-- responses already point at through `spec_ref`, so a rename must propagate rather than orphan --
-- that is the one operation that should stay possible. Nothing deletes a Cocktail.
--
-- WHY IT IS GUARDED. It may only be added once every existing `cocktail_slug` is a real Pool id, and
-- a migration must not fail over a row a human should look at. It raises a NOTICE and skips instead;
-- check 5 above is what says why. Idempotent: re-running does nothing.
do $$
begin
  if exists (
    select 1 from public.specs s
     where s.cocktail_slug is not null
       and not exists (select 1 from public.cocktails c where c.id = s.cocktail_slug)
  ) then
    raise notice 'specs_cocktail_slug_fk NOT added: some specs.cocktail_slug is still not a Pool id -- see check 5.';
  elsif not exists (select 1 from pg_constraint where conname = 'specs_cocktail_slug_fk') then
    alter table public.specs
      add constraint specs_cocktail_slug_fk
      foreign key (cocktail_slug) references public.cocktails (id) on update cascade;
    raise notice 'specs_cocktail_slug_fk added.';
  else
    raise notice 'specs_cocktail_slug_fk already present.';
  end if;
end $$;


-- ============================================================
-- 4. THE RECEIPT FOR THE CONSTRAINT -- 1 after a clean run, 0 if it skipped
-- ============================================================
select '6 specs_cocktail_slug_fk present (should be 1)' as check, count(*)::text as n
  from pg_constraint where conname = 'specs_cocktail_slug_fk';
