-- ============================================================
-- BarNerd Phase 5 (5c) -- GLASSWARE -> DRAWING, and the `highball-glass` canon
--
-- Design of record: .sisyphus/plans/2026-09-22-hub-and-roast-plan.md  section 7b
-- The garnish equivalent: `garnish_asset_map`, created by add-garnish-layer.sql
--
-- WHY THIS EXISTS, IN THE USER'S OWN TERMS (2026-10-06):
--
--   "the main limitation to alias glassware is for the compositors sake, im not going to add new
--    svgs at this moment of the race, so im thinking, having a full glassware list for the recipes
--    but being honest in the fact that i picked the most used glasses, and theres no illustration
--    for a lot of more unique pieces, same as for the garnishes."
--
-- So the RECIPE VOCABULARY STAYS AT 46. Nothing is removed, no glass is merged away, and
-- `specs.glass_id` is untouched. What this table adds is the honest answer to the compositor's one
-- question: for this glass, WHICH DRAWING?
--
-- MEASURED, 2026-10-06:
--   glassware          46 recipe names      drawings  15      specs covered by a drawing  91%
--   garnish_elements 1,117 recipe names     drawings  30      garnish rows covered       17.6%
--
-- The glassware art covers the common bar because 15 drawings against 46 names is a good ratio. The
-- garnish side is the same pattern with a far worse one, which is why its preview will say "no art
-- yet" much more often. Both are honest about the same thing.
--
-- ============================ THE SHAPE, AND THE ONE THING NOT COPIED ==========================
--
-- `garnish_asset_map` has a good shape and a fatal flaw. The good half:
--
--     asset_id  text     null
--     renders   boolean  not null
--     check ((asset_id is null) = (not renders))      <- renders agrees with asset_id, always
--
-- THE FATAL FLAW, and it is why that table has never held a row: its `asset_id` is a FOREIGN KEY to
-- `garnishes(id)` -- a table with ZERO ROWS, superseded by `garnish_elements` when the garnish layer
-- landed. So EVERY insert carrying an asset fails the foreign key, and the garnish art bridge cannot
-- be populated at all.
--
-- THE ASSETS ARE SVG FILES, NOT TABLE ROWS. `svg/glasses/glass-*.svg` -- fifteen of them. So the
-- asset here is the drawing's basename, checked against the list that is actually on disk rather than
-- pointed at a table. A CHECK is the right tool and the house already uses one
-- (`garnish_axis_values` checks its nine axis names the same way).
--
-- ============================ THE ROWS =========================================================
--
-- EVERY glass gets a row, and the ones with no drawing get an EXPLICIT null. The user's call:
-- "explicit null". A missing row would be an omission; a null row is a recorded fact. Same reasoning
-- that made `none` a VALUE in the garnish layer rather than an absence.
--
-- MAPPINGS THE USER GAVE DIRECTLY, 2026-10-06:
--   * `shot-old-fashioned-glass` -> the SHOT drawing, not null.
--   * `margarita-glass` -> coupe. "we dont talk about this one, change for coupe (or coupette)."
--   * the old-fashioned family collapses onto one drawing; `shot-old-fashioned-glass` is the
--     exception and it is the shot.
--
-- MAPPINGS I CHOSE FROM THE NAME, flagged here so they are easy to overrule:
--   * `rocks-glass` -> old-fashioned. A rocks glass IS an old-fashioned glass.
--   * the "or collins" compounds -> collins. The name says which alternative it is.
--   * `rum-barrel-mug-or-pint-glass` -> pint. The name says it.
--   * `copita-sherry-glass` -> wine. A copita is a small wine glass; it is a JUDGEMENT.
--   * `sling-glass` -> collins. A sling is served long; also a JUDGEMENT.
--   * `tiki-mug-or-collins` -> tiki-mug. There is a tiki-mug drawing and a collins drawing, and the
--     mug is the more specific of the two.
--
-- IDEMPOTENT. Re-running re-creates the table, re-adds the canon, and re-syncs the rows.
-- ============================================================


-- ---------------------------------------------------------------------------------------------
-- 1. THE CANON. The user: "i still want to keep highball-glass as canon."
--
-- No recipe uses this exact name -- the corpus writes `highball-max-10oz-300ml` and
-- `fizz-or-highball-8oz-to-10oz` -- and that is the point. A highball is a SIZE, which is what
-- separates it from a collins, so the measured names carry the size and the plain word does not
-- exist in the data. The canon exists for the EDITOR to offer, and the measured names map onto it.
-- ---------------------------------------------------------------------------------------------
insert into public.glassware (id, name)
values ('highball-glass', 'Highball glass')
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------------------------
-- 2. THE MAP
-- ---------------------------------------------------------------------------------------------
create table if not exists public.glass_asset_map (
  glass_id  text primary key references public.glassware(id) on delete cascade,
  asset_id  text null,          -- the drawing's basename, e.g. 'old-fashioned'
  renders   boolean not null,   -- true iff asset_id is set
  note      text null,
  constraint glass_asset_map_consistent check ((asset_id is null) = (not renders)),
  constraint glass_asset_map_known_asset check (
    asset_id is null or asset_id in (
      'collins', 'coupe', 'flute', 'goblet', 'hurricane', 'martini', 'nic-and-nora',
      'old-fashioned', 'pint', 'shot', 'snifter', 'tiki-mug', 'toddy', 'wine', 'highball'
    )
  )
);

comment on table public.glass_asset_map is
  'Which compositor drawing to use for a recipe glass. 46 recipe names, 15 drawings; a null asset_id is a RECORDED fact, not an omission.';
comment on column public.glass_asset_map.asset_id is
  'The basename of svg/glasses/glass-<asset_id>.svg. NOT a foreign key -- see the header: garnish_asset_map points at an empty table and cannot be filled.';

alter table public.glass_asset_map enable row level security;
grant select on public.glass_asset_map to anon;
drop policy if exists "Anyone can read glass assets" on public.glass_asset_map;
create policy "Anyone can read glass assets"
  on public.glass_asset_map for select to anon using (true);


insert into public.glass_asset_map (glass_id, asset_id, renders, note) values
  -- ---- the drawn fifteen, and everything that collapses onto them -------------------------------
  ('coupe-glass',                            'coupe',        true,  null),
  ('sour-or-martini-coupette-glass',         'coupe',        true,  'a coupette is a coupe'),
  ('margarita-glass',                        'coupe',        true,  'the user: "change for coupe (or coupette)"'),
  ('martini-glass',                          'martini',      true,  null),
  ('martini-large-10oz-glass',               'martini',      true,  'the size, not a different glass'),
  ('martini-small-glass',                    'martini',      true,  'the size, not a different glass'),
  ('old-fashioned-glass',                    'old-fashioned',true,  null),
  ('double-old-fashioned',                   'old-fashioned',true,  'a larger old-fashioned'),
  ('absinthe-glass-or-old-fashioned-glass',  'old-fashioned',true,  'the name says which alternative'),
  ('medical-cup-or-old-fashioned-glass',     'old-fashioned',true,  'the name says which alternative'),
  ('rocks-glass',                            'old-fashioned',true,  'CHOSEN: a rocks glass IS an old-fashioned glass'),
  ('collins-glass',                          'collins',      true,  null),
  ('copper-mug-or-collins-glass',            'collins',      true,  'the name says which alternative'),
  ('collins-or-pineapple-shell-glass',       'collins',      true,  'the name says which alternative'),
  ('coconut-shell-or-collins-glass',         'collins',      true,  'the name says which alternative'),
  ('cantaritos-clay-pot-or-collins-glass',   'collins',      true,  'the name says which alternative'),
  ('cartridge-mug-or-collins-glass',         'collins',      true,  'the name says which alternative'),
  ('sling-glass',                            'collins',      true,  'CHOSEN: a sling is served long'),
  ('highball-glass',                         'highball',     true,  'the canon; no recipe uses this exact name yet'),
  ('highball-max-10oz-300ml',                'highball',     true,  'the measured form of the canon'),
  ('fizz-or-highball-8oz-to-10oz',           'highball',     true,  'the measured form of the canon'),
  ('nick-nora-glass',                        'nic-and-nora', true,  'the drawing is spelled nic-and-nora; the glassware says nick-nora'),
  ('flute-glass',                            'flute',        true,  null),
  ('goblet-glass',                           'goblet',       true,  null),
  ('hurricane-glass',                        'hurricane',    true,  null),
  ('pint-glass',                             'pint',         true,  null),
  ('rum-barrel-mug-or-pint-glass',           'pint',         true,  'the name says which alternative'),
  ('wine-glass',                             'wine',         true,  null),
  ('large-wine-glass',                       'wine',         true,  'the size, not a different glass'),
  ('copita-sherry-glass',                    'snifter',      true,  'the USER: a copita is a tasting/snifter glass. No tasting drawing exists -- snifter is the one.'),
  ('copa-glass',                             'wine',         true,  'CHOSEN: a copa is a large balloon glass; a judgement'),
  ('shot-glass',                             'shot',         true,  null),
  ('boston-shot-glass',                      'shot',         true,  'the name says shot'),
  ('shot-and-beer-glass',                    'shot',         true,  'the name says shot'),
  ('shot-old-fashioned-glass',               'shot',         true,  'the USER: this one is the shot, not the old-fashioned'),
  ('snifter-glass',                          'snifter',      true,  null),
  ('toddy-glass',                            'toddy',        true,  null),
  ('tiki-mug-or-collins',                    'tiki-mug',     true,  'CHOSEN: the mug is the more specific of the two drawings'),

  -- ---- explicitly NOT drawn, and recorded as such ------------------------------------------------
  ('cup',                                    null, false, 'a cup, not a glass'),
  ('espresso-cup',                           null, false, 'a cup'),
  ('tin',                                    null, false, 'a tin'),
  ('julep-tin',                              null, false, 'a metal tin'),
  ('poco-grande',                            null, false, 'a small clay cup'),
  ('jam-jar-glass',                          null, false, 'a jar'),
  ('belgium-beer-glass',                     null, false, 'a beer glass'),
  ('boston-glass',                           null, false, 'a MIXING glass, not a serving glass'),
  ('pineapple-shell-frozen-glass',           null, false, 'a pineapple shell')
on conflict (glass_id) do update
  set asset_id = excluded.asset_id,
      renders  = excluded.renders,
      note     = excluded.note;
