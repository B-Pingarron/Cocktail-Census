-- ============================================================
-- BarNerd Phase 5 rung 2 (5c) -- THE LEGO BOX BECOMES READABLE, plus `units`
--
-- Design of record: .sisyphus/plans/2026-09-22-hub-and-roast-plan.md  section 7b
-- Execution breakdown: 01_BarNerd/.sisyphus/plans/2026-10-06-5c-mini-rm.md  (T1b, T2a)
--
-- ============================ PART 1: WHY THE POLICIES =========================================
--
-- THE EDITOR HAD NO DROPDOWNS. Section 7b calls this surface "the lego box, measured -- the entire
-- surface an author builds from": ingredients 1,174, glassware 46, techniques 12, ice 5. Measured
-- against the live database on 2026-10-06, AS `anon`:
--
--     ingredients            anon -> 0        postgres -> 1,174
--     ingredient_aliases     anon -> 0        postgres -> 1,950
--     glassware              anon -> 0        postgres ->    46
--     techniques             anon -> 0        postgres ->    12
--     ice                    anon -> 0        postgres ->     5
--     garnish_elements       anon -> 1,117    (readable -- it has a policy)
--     cocktails              anon ->   101    (readable)
--     specs                  anon -> 6,956    (readable)
--
-- THE GRANT IS NOT THE PROBLEM. `anon` holds SELECT on all of them. The problem is that these five
-- tables have **ROW LEVEL SECURITY ENABLED WITH ZERO POLICIES**, and in Postgres that means DENY
-- EVERYTHING. The tables were created in phase 0a, before any of this had readers, and nothing ever
-- gave them a policy.
--
-- THE PATTERN ALREADY EXISTS IN THIS CODEBASE. `add-garnish-layer.sql` gave the garnish tables
-- exactly this treatment (`anon_read_garnish_elements`, `anon_read_garnish_axis_values`, ...). That
-- is why the garnish vocabulary is readable and the ingredient vocabulary is not: the garnish layer
-- was revisited when the compositor needed it, and the lego box never was.
--
-- WHAT THIS FILE DOES NOT CHANGE. No INSERT, no UPDATE, no DELETE. `anon` still has ZERO UPDATE and
-- ZERO DELETE on every table -- re-verified after applying. These are READ policies, and read is all
-- the editor needs from a controlled vocabulary.
--
-- ============================ PART 2: WHY `units` ==============================================
--
-- THE EDITOR NEEDS A UNIT VOCABULARY AND THERE WAS NONE. `spec_ingredients.amount` is free text with
-- 253 distinct values, and ZERO of them are a bare number -- every one is `number + unit`. Measured
-- units, by how many distinct amounts use each: cl 48, fresh 15, dried 12, dash 10, drop 10, gram 9,
-- unit 9, whole 9, leaf 8, cube 7, spoon 7, sprig 7, slice 6, grind 5, segment 5, wedge 5, inch 4,
-- pinch 4, Splash 4, scoop 3, twist 3, ring 2, knob 2, pea 2, then a long tail.
--
-- SECTION 7b'S OWN RULE DECIDES THE SHAPE: "Every controlled vocabulary in this project is a table."
-- So `units` is a table, like `ice`, and not a hardcoded list in the client.
--
-- THE USER CHOSE OPTION B ON 2026-10-06: measures AND countable forms. Option A (measures only) would
-- have expressed `3 basil leaves` through the garnish axes instead, on the "one concept, one place"
-- reasoning. Option B is more convenient at the keyboard and accepts that `leaf`, `sprig`, `wedge`,
-- `slice`, `twist`, `ring`, `cube`, `segment` duplicate eight garnish axis values. That duplication is
-- a known and accepted cost, not an oversight.
--
-- WHAT IS DELIBERATELY NOT A UNIT:
--   * `fresh`, `dried`, `candied` -- those are STATES that leaked into the amount field (15 and 12
--     distinct amounts each). A state belongs to the element, not to the quantity.
--   * `Top up with` -- that is the `filler` ROLE, already identified in phase 0b (542 rows carry it).
--   * `Float`, `Float lightly whipped`, `grated zest of`, `fill glass with`, `dash dash` -- prose and
--     parse artefacts, not units.
--
-- `plural` IS A COLUMN, NOT GRAMMAR IN THE CLIENT. The corpus writes `1 dash` and `2 drops`; the
-- editor composes `number + space + (label | plural)`. Putting both forms in the table keeps the
-- rule in the data, where every other controlled vocabulary in this project lives.
--
-- IDEMPOTENT, like phase0a, add-rung2-roast.sql and add-rung2-submission-functions.sql.
-- ============================================================


-- ---------------------------------------------------------------------------------------------
-- PART 1 -- the five read policies
-- ---------------------------------------------------------------------------------------------
drop policy if exists "Anyone can read ingredients" on public.ingredients;
create policy "Anyone can read ingredients"
  on public.ingredients for select to anon using (true);

drop policy if exists "Anyone can read ingredient aliases" on public.ingredient_aliases;
create policy "Anyone can read ingredient aliases"
  on public.ingredient_aliases for select to anon using (true);

drop policy if exists "Anyone can read glassware" on public.glassware;
create policy "Anyone can read glassware"
  on public.glassware for select to anon using (true);

drop policy if exists "Anyone can read techniques" on public.techniques;
create policy "Anyone can read techniques"
  on public.techniques for select to anon using (true);

drop policy if exists "Anyone can read ice" on public.ice;
create policy "Anyone can read ice"
  on public.ice for select to anon using (true);

-- `spec_techniques` WAS MISSING TOO, AND IT IS NOT OBVIOUS. It has 9,195 rows and, like the five
-- above, RLS on with zero policies -- so `anon` could read a spec's ingredients, garnishes and axes,
-- and NOT its techniques. Reading a whole spec would have failed on one table. Caught 2026-10-06 by
-- re-counting the zero-policy tables after the first apply: 8 before, and the 3 left were `brands`
-- (0 rows, by design), `garnishes` (superseded, 0 rows) and this one.
--
-- Note the two-key rule this file tripped over: a READ needs BOTH a table-level GRANT and an RLS
-- policy. The five tables above already had their grants from phase 0a and were missing only the
-- policy. `units`, created below, is new and had the reverse problem.
drop policy if exists "Anyone can read spec techniques" on public.spec_techniques;
create policy "Anyone can read spec techniques"
  on public.spec_techniques for select to anon using (true);


-- ---------------------------------------------------------------------------------------------
-- PART 2 -- `units`, the vocabulary the editor's amount control needs
-- ---------------------------------------------------------------------------------------------
create table if not exists public.units (
  id        text primary key,
  label     text not null,          -- written with one:  "1 cl"
  plural    text not null,          -- written with many: "3 grams"
  kind      text not null,          -- 'measure' = a quantity of something
                                    -- 'countable' = a piece of the thing itself
  position  integer not null default 0,
  constraint units_kind_known check (kind in ('measure', 'countable'))
);

comment on table  public.units is
  'The amount vocabulary for the spec editor. Section 7b: every controlled vocabulary is a table.';
comment on column public.units.kind is
  'measure = a quantity of something (cl, gram, dash). countable = a piece of the thing (leaf, sprig, wedge). The user chose both, 2026-10-06.';
comment on column public.units.plural is
  'The form used when the number is not one. Kept in the table so the rule lives in the data.';

alter table public.units enable row level security;

-- THE GRANT IS A SEPARATE KEY FROM THE POLICY, and a brand-new table has neither. Without this line
-- `anon` gets `permission denied for table units` even with the policy in place -- measured, not
-- assumed: the first apply of this file produced exactly that error.
grant select on public.units to anon;

drop policy if exists "Anyone can read units" on public.units;
create policy "Anyone can read units"
  on public.units for select to anon using (true);

-- THE SEED. Ordered by how the corpus actually uses them: `cl` dominates (48 distinct amounts), then
-- the measures, then the countable forms. `position` drives the picker's order.
insert into public.units (id, label, plural, kind, position) values
  -- measures
  ('cl',      'cl',      'cl',      'measure',   10),
  ('dash',    'dash',    'dashes',  'measure',   20),
  ('drop',    'drop',    'drops',   'measure',   30),
  ('spoon',   'spoon',   'spoons',  'measure',   40),
  ('gram',    'gram',    'grams',   'measure',   50),
  ('pinch',   'pinch',   'pinches', 'measure',   60),
  ('splash',  'splash',  'splashes','measure',   70),
  ('scoop',   'scoop',   'scoops',  'measure',   80),
  ('grind',   'grind',   'grinds',  'measure',   90),
  ('inch',    'inch',    'inches',  'measure',  100),
  ('knob',    'knob',    'knobs',   'measure',  110),
  ('pea',     'pea',     'peas',    'measure',  120),
  ('cupful',  'cupful',  'cupfuls', 'measure',  130),
  ('pint',    'pint',    'pints',   'measure',  140),
  ('litre',   'litre',   'litres',  'measure',  150),
  ('bottle',  'bottle',  'bottles', 'measure',  160),
  ('bag',     'bag',     'bags',    'measure',  170),
  -- countable
  ('unit',    'unit',    'units',   'countable', 200),
  ('whole',   'whole',   'whole',   'countable', 210),
  ('leaf',    'leaf',    'leaves',  'countable', 220),
  ('sprig',   'sprig',   'sprigs',  'countable', 230),
  ('slice',   'slice',   'slices',  'countable', 240),
  ('wedge',   'wedge',   'wedges',  'countable', 250),
  ('cube',    'cube',    'cubes',   'countable', 260),
  ('segment', 'segment', 'segments','countable', 270),
  ('twist',   'twist',   'twists',  'countable', 280),
  ('ring',    'ring',    'rings',   'countable', 290)
on conflict (id) do update
  set label    = excluded.label,
      plural   = excluded.plural,
      kind     = excluded.kind,
      position = excluded.position;
