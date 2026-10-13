-- ---------------------------------------------------------------------------------------------
-- Four units the editor's dropdown asked for and `public.units` did not have
-- ---------------------------------------------------------------------------------------------
-- `add-rung2-units-and-read-policies.sql` seeded 27 rows. The editor's amount control offers the
-- table, and four of the values the author named (2026-10-11) had no row to offer:
--
--   ml          — metric, and the unit a reader coming from a cocktail book expects first. The table
--                 measured in `cl` because the 100-recipe corpus wrote `cl`, but that is a fact about
--                 the corpus, not a reason to make the visitor convert.
--   oz          — imperial. Same argument, and the book the corpus is drawn from prints `oz` on
--                 every page.
--   bar spoon   — a real measure with a real volume (about 5 ml). `spoon` already exists as a
--                 casual measure, and a bar spoon is not one: it is the tool the drink was built
--                 with, and the corpus uses the phrase as a unit.
--   tea spoon   — the same argument on the other side. `spoon` is the loose form; a tea spoon is
--                 5 ml in every recipe that prints it.
--
-- THE SPOON FAMILY IS ONE SHAPE, TWO SPELLINGS. `spoon` stays and is not deprecated: the corpus
-- writes it, and a row that deletes an existing id would break every saved amount that used it.
-- The three sit together in `position` order so the picker reads as a family rather than as a list
-- with an interloper at the end.
--
-- IDEMPOTENT BY THE SAME CLAUSE THE ORIGINAL USED. Re-running this file updates the four rows and
-- touches nothing else. No policy, no grant and no table is created here: `public.units` already
-- carries its `grant select to anon` and its read policy, and a second copy of either would be a
-- second thing to keep in step.
--
-- `position` VALUES ARE CHOSEN AGAINST THE EXISTING SEED, NOT APPENDED. `cl` is 10 and `dash` is 20,
-- so `ml` takes 5 and `oz` takes 15: the measures the corpus already used keep their relative order,
-- and the two metric/imperial forms land next to the unit they convert to. `spoon` is 40, so the two
-- named spoons take 42 and 44 and read directly beneath it.
--
-- MIGRATION, NOT AN EDIT: `add-rung2-units-and-read-policies.sql` is applied. Editing its `values`
-- list would change nothing on a database that has already run it, and would make the file on disk
-- disagree with the data in every environment that exists.

insert into public.units (id, label, plural, kind, position) values
  ('ml',        'ml',        'ml',         'measure',  5),
  ('oz',        'oz',        'oz',         'measure', 15),
  ('bar spoon', 'bar spoon', 'bar spoons', 'measure', 42),
  ('tea spoon', 'tea spoon', 'tea spoons', 'measure', 44)
on conflict (id) do update
  set label    = excluded.label,
      plural   = excluded.plural,
      kind     = excluded.kind,
      position = excluded.position;
