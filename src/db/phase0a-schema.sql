-- ============================================================
-- BarNerd Phase 0a — Foundation schema
--
-- WHAT THIS IS
--   The catalogue (reference data) and instance (particular drinks) tables,
--   plus roast_votes and session_id on the existing votes table.
--
-- WHAT THIS IS NOT
--   This creates the SCHEMA ONLY. Populating the catalogue data
--   (1,742 ingredient names → ~200–300 generics) is Phase 0b.
--
-- DESIGN DECISIONS (from plan §7, do not re-litigate)
--   - Child tables, not wide columns (ingredient_A/B/C rejected)
--   - spec→ingredient is a FOREIGN KEY (controlled vocabulary = constraint)
--   - Collections are FLAT (no rooms/shelves tables)
--   - Generics only at BCB (brands table designed, not populated)
--   - Export width is computed, never capped
--   - session_id is nullable on votes (backward-compatible)
--
-- RUN THIS IN THE SUPABASE SQL EDITOR. Idempotent: safe to run more than once.
-- ============================================================


-- ============================================================
-- 1. CATALOGUE — reference data, every element has its own identity
-- ============================================================

-- 1a. Ingredients — the generic layer (~200–300 entries after Phase 0b normalisation)
--     parent_id allows a tree (e.g. "citrus juice" → "lime juice") or a flat list.
--     The column exists either way; the taxonomy is Phase 0b's job.
create table if not exists public.ingredients (
  id            uuid        not null default gen_random_uuid() primary key,
  canonical_name text       not null unique,
  category      text,       -- spirit · liqueur · wine/vermouth · juice · syrup · bitters · non-alcoholic · dairy/egg · …
  parent_id     uuid        references public.ingredients(id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table  public.ingredients is 'Generic ingredient layer. One row per unique ingredient, ~200–300 after normalisation.';
comment on column public.ingredients.canonical_name is 'The display name (e.g. "lime juice", not "fresh lime juice" or "lime cordial").';
comment on column public.ingredients.category is 'Top-level classification. Values are Phase 0b deliverable.';
comment on column public.ingredients.parent_id is 'Optional tree structure. Null = root node.';

create index if not exists idx_ingredients_category on public.ingredients (category);
create index if not exists idx_ingredients_parent   on public.ingredients (parent_id);

grant select on public.ingredients to anon;


-- 1b. Ingredient aliases — brand names and alternative spellings that point to a generic
--     e.g. "giffard orgeat syrup" → ingredients row for "orgeat syrup"
--     This is what normalises 1,742 names into ~200–300 generics.
create table if not exists public.ingredient_aliases (
  alias         text        not null unique,
  ingredient_id uuid        not null references public.ingredients(id) on delete cascade,
  created_at    timestamptz not null default now()
);

comment on table  public.ingredient_aliases is 'Maps brand names and variant spellings to a generic ingredient.';
comment on column public.ingredient_aliases.alias is 'The exact string from the raw data (e.g. "giffard orgeat syrup").';
comment on column public.ingredient_aliases.ingredient_id is 'FK to the generic ingredient this alias resolves to.';

create index if not exists idx_ingredient_aliases_ingredient on public.ingredient_aliases (ingredient_id);

grant select on public.ingredient_aliases to anon;


-- 1c. Brands — designed, NOT populated at BCB
--     A 1,742-entry dropdown is unusable on a phone. The table exists so the schema
--     is ready when the brand layer is needed later.
create table if not exists public.brands (
  id            uuid        not null default gen_random_uuid() primary key,
  name          text        not null,
  ingredient_id uuid        not null references public.ingredients(id) on delete cascade,
  category      text,       -- e.g. "distillery", "syrup producer", "juice brand"
  created_at    timestamptz not null default now()
);

comment on table public.brands is 'Brand names linked to generic ingredients. Designed but not populated at BCB.';

create index if not exists idx_brands_ingredient on public.brands (ingredient_id);

grant select on public.brands to anon;


-- 1d. Glassware — the 15 compositor glasses, reconciled with the 17 raw values
--     The alias table (already existing as task A0) maps raw names like "Nick & Nora"
--     to the canonical "nic-and-nora" used by the compositor.
create table if not exists public.glassware (
  id            text        not null primary key,  -- compositor slug: "old-fashioned", "coupe", etc.
  name          text        not null,               -- display name: "Old Fashioned"
  created_at    timestamptz not null default now()
);

comment on table  public.glassware is 'Canonical glass types. The compositor uses the id; the UI uses the name.';
comment on column public.glassware.id is 'Slug matching the compositor SVG filename (e.g. "old-fashioned").';

grant select on public.glassware to anon;


-- 1e. Garnishes — the 30 compositor assets
--     The prose→asset mapping lives in garnish-map.json (compositor). This table
--     is the database mirror of that vocabulary.
create table if not exists public.garnishes (
  id            text        not null primary key,  -- compositor slug: "cherry", "mint1", etc.
  name          text        not null,               -- display name: "Cherry", "Mint Sprig"
  created_at    timestamptz not null default now()
);

comment on table  public.garnishes is 'Canonical garnish assets. Mirrors the compositor asset vocabulary.';
comment on column public.garnishes.id is 'Slug matching the compositor SVG filename (e.g. "cherry").';

grant select on public.garnishes to anon;


-- 1f. Techniques — extracted from the leading verb of the recipe prose
--     6 distinct values in the curated data: SHAKE, STIR, POUR, BLEND, ROLL, OTHER
create table if not exists public.techniques (
  id            text        not null primary key,  -- slug: "shake", "stir", etc.
  name          text        not null,               -- display name: "Shake"
  created_at    timestamptz not null default now()
);

comment on table  public.techniques is 'Cocktail techniques. Extracted from the leading verb of recipe instructions.';

grant select on public.techniques to anon;


-- ============================================================
-- 2. INSTANCES — a particular drink, built from the catalogue
-- ============================================================

-- 2a. Specs — a cocktail recipe (the "particular drink")
create table if not exists public.specs (
  id            uuid        not null default gen_random_uuid() primary key,
  name          text        not null,
  glass_id      text        references public.glassware(id) on delete set null,
  technique_id  text        references public.techniques(id) on delete set null,
  method        text,       -- free-text preparation notes (the full recipe prose, if needed)
  source        text,       -- provenance: "IBA", "Difford's", "user-submitted", etc.
  created_at    timestamptz not null default now()
);

comment on table  public.specs is 'A cocktail spec — the particular drink built from catalogue elements.';
comment on column public.specs.glass_id is 'FK to glassware. Null if the glass is unknown or irrelevant.';
comment on column public.specs.technique_id is 'FK to techniques. Null if the technique is compound or unknown.';
comment on column public.specs.source is 'Provenance of this recipe. For the default 100: "IBA", "Difford", etc.';

create index if not exists idx_specs_glass      on public.specs (glass_id);
create index if not exists idx_specs_technique  on public.specs (technique_id);

grant select, insert on public.specs to anon;


-- 2b. Spec ingredients — an ordered list of ingredients for one spec
--     The child table pattern: one row per ingredient, FK to the generic layer.
--     role = base / modifier / filler (Phase 0b: build column, populate if cheap).
create table if not exists public.spec_ingredients (
  spec_id       uuid        not null references public.specs(id) on delete cascade,
  "position"    integer     not null,  -- order within the recipe (0-based)
  role          text,                  -- base / modifier / filler (deferred, nullable)
  amount        text,                  -- the amount string as-is: "4.5 cl", "3 dash", etc.
  ingredient_id uuid        not null references public.ingredients(id) on delete restrict,
  primary key (spec_id, "position")
);

comment on table  public.spec_ingredients is 'Ordered ingredient list for a spec. FK to generic ingredients.';
comment on column public.spec_ingredients.role is 'base / modifier / filler. Deferred: build column, populate if cheap.';
comment on column public.spec_ingredients.amount is 'Raw amount string from the source data. Unit conversion is a Phase 0b concern.';
comment on column public.spec_ingredients.ingredient_id is 'FK to ingredients — enforced vocabulary. A typo is impossible at the DB level.';

create index if not exists idx_spec_ingredients_ingredient on public.spec_ingredients (ingredient_id);

grant select, insert on public.spec_ingredients to anon;


-- 2c. Spec garnishes — an ordered list of garnishes for one spec
--     Same child-table pattern as spec_ingredients.
create table if not exists public.spec_garnishes (
  spec_id       uuid        not null references public.specs(id) on delete cascade,
  "position"    integer     not null,  -- order within the garnish list (0-based)
  garnish_id    text        not null references public.garnishes(id) on delete restrict,
  primary key (spec_id, "position")
);

comment on table  public.spec_garnishes is 'Ordered garnish list for a spec. FK to canonical garnish assets.';

create index if not exists idx_spec_garnishes_garnish on public.spec_garnishes (garnish_id);

grant select, insert on public.spec_garnishes to anon;


-- 2d. Collections — flat lists of specs (no rooms/shelves)
--     The room/shelf metaphor is a presentation choice, expressed in the UI.
--     A "room" is a collection of collections — not a table.
create table if not exists public.collections (
  id            uuid        not null default gen_random_uuid() primary key,
  session_id    text,                  -- who owns this collection (nullable for now; minted with session)
  name          text        not null,
  created_at    timestamptz not null default now()
);

comment on table  public.collections is 'A flat list of specs. The room/shelf metaphor is UI, not data.';
comment on column public.collections.session_id is 'The session that owns this collection. Nullable until session minting is wired.';

create index if not exists idx_collections_session on public.collections (session_id);

grant select, insert on public.collections to anon;


-- 2e. Collection specs — the join table (a collection is an ordered list of specs)
--     Same child-table pattern as spec_ingredients and spec_garnishes.
--     "One pattern, three uses" — ingredients, garnishes, and collections
--     are all "an ordered list of references."
create table if not exists public.collection_specs (
  collection_id uuid        not null references public.collections(id) on delete cascade,
  "position"    integer     not null,  -- order within the collection (0-based)
  spec_id       uuid        not null references public.specs(id) on delete cascade,
  primary key (collection_id, "position")
);

comment on table  public.collection_specs is 'Ordered spec list for a collection. The same child-table pattern as spec_ingredients.';

create index if not exists idx_collection_specs_spec on public.collection_specs (spec_id);

grant select, insert on public.collection_specs to anon;


-- ============================================================
-- 3. ROAST — the vote table for "ROAST my spec"
-- ============================================================

-- 3a. Roast votes — separate from census votes (different lifecycle, different payload)
--     spec_ref is NOT a foreign key: a static app spec ("old-fashioned") and a future
--     DB row (uuid) are both just strings to this table. Rung 2 becomes a data problem,
--     not a migration.
create table if not exists public.roast_votes (
  session_id    text        not null,
  list_id       text        not null default 'barnerd-15',  -- constant today; a real id at rung 2
  spec_ref      text        not null,  -- NOT a FK — works for static and DB specs alike
  vote          text        not null check (vote in ('agree', 'disagree')),
  labels        text[],               -- premade clickable notes (array of text)
  created_at    timestamptz not null default now()
);

comment on table  public.roast_votes is 'Votes on the user own specs. Separate from census votes (different lifecycle, different payload).';
comment on column public.roast_votes.session_id is 'The anonymous session that cast this vote. Join key for cross-comparison with census votes.';
comment on column public.roast_votes.list_id is 'Which list this spec belongs to. "barnerd-15" today; a real list id at rung 2.';
comment on column public.roast_votes.spec_ref is 'Plain string, NOT a FK. Works for static specs and future DB rows alike.';
comment on column public.roast_votes.labels is 'Premade clickable notes the visitor chose. No free text = no moderation obligation.';

create index if not exists idx_roast_votes_session on public.roast_votes (session_id);
create index if not exists idx_roast_votes_list   on public.roast_votes (list_id);

grant select, insert on public.roast_votes to anon;

alter table public.roast_votes enable row level security;

drop policy if exists "Anyone can insert a roast vote" on public.roast_votes;
create policy "Anyone can insert a roast vote"
  on public.roast_votes
  for insert
  to anon
  with check (true);

drop policy if exists "Anyone can read roast votes" on public.roast_votes;
create policy "Anyone can read roast votes"
  on public.roast_votes
  for select
  to anon
  using (true);


-- ============================================================
-- 4. SESSION IDENTITY — add session_id to the existing votes table
-- ============================================================

-- 4a. Add the column (nullable — no backfill needed for existing rows)
--     The column is shaped to hold either a local UUID or, later, a Supabase auth uid.
--     The reconciliation when auth arrives is a single UPDATE, recorded in ADR-035.
alter table public.votes
  add column if not exists session_id text;

comment on column public.votes.session_id is 'Anonymous session id. Client-side UUID (ADR-035). Nullable for pre-existing rows.';

create index if not exists idx_votes_session on public.votes (session_id);


-- ============================================================
-- 5. RLS policies for the new tables (anon can read + insert)
-- ============================================================

-- 5a. Specs — anon can read (needed for the arena) and insert (for rung 2)
alter table public.specs enable row level security;

drop policy if exists "Anyone can read specs" on public.specs;
create policy "Anyone can read specs"
  on public.specs
  for select
  to anon
  using (true);

drop policy if exists "Anyone can insert a spec" on public.specs;
create policy "Anyone can insert a spec"
  on public.specs
  for insert
  to anon
  with check (true);


-- 5b. Spec ingredients — anon can read + insert
alter table public.spec_ingredients enable row level security;

drop policy if exists "Anyone can read spec ingredients" on public.spec_ingredients;
create policy "Anyone can read spec ingredients"
  on public.spec_ingredients
  for select
  to anon
  using (true);

drop policy if exists "Anyone can insert spec ingredients" on public.spec_ingredients;
create policy "Anyone can insert spec ingredients"
  on public.spec_ingredients
  for insert
  to anon
  with check (true);


-- 5c. Spec garnishes — anon can read + insert
alter table public.spec_garnishes enable row level security;

drop policy if exists "Anyone can read spec garnishes" on public.spec_garnishes;
create policy "Anyone can read spec garnishes"
  on public.spec_garnishes
  for select
  to anon
  using (true);

drop policy if exists "Anyone can insert spec garnishes" on public.spec_garnishes;
create policy "Anyone can insert spec garnishes"
  on public.spec_garnishes
  for insert
  to anon
  with check (true);


-- 5d. Collections — anon can read + insert
alter table public.collections enable row level security;

drop policy if exists "Anyone can read collections" on public.collections;
create policy "Anyone can read collections"
  on public.collections
  for select
  to anon
  using (true);

drop policy if exists "Anyone can insert a collection" on public.collections;
create policy "Anyone can insert a collection"
  on public.collections
  for insert
  to anon
  with check (true);


-- 5e. Collection specs — anon can read + insert
alter table public.collection_specs enable row level security;

drop policy if exists "Anyone can read collection specs" on public.collection_specs;
create policy "Anyone can read collection specs"
  on public.collection_specs
  for select
  to anon
  using (true);

drop policy if exists "Anyone can insert collection specs" on public.collection_specs;
create policy "Anyone can insert collection specs"
  on public.collection_specs
  for insert
  to anon
  with check (true);


-- ============================================================
-- Done. Summary of what was created:
--
--   Catalogue (6 tables):
--     ingredients, ingredient_aliases, brands,
--     glassware, garnishes, techniques
--
--   Instances (5 tables):
--     specs, spec_ingredients, spec_garnishes,
--     collections, collection_specs
--
--   Roast (1 table):
--     roast_votes
--
--   Alteration (1 column):
--     votes.session_id (text, nullable)
--
-- All tables have RLS enabled with anon read + insert policies.
-- All tables are granted to the anon role.
-- The child-table pattern (spec_ingredients, spec_garnishes, collection_specs)
-- is used three times for "ordered list of references."
-- ============================================================
