-- ============================================================
-- BarNerd Phase 0b — TWO COLUMNS THE RECIPE MANAGER NEEDS
--
-- 1. `specs.slug` — for URLs. Without it every route is
--    /recipe/4b6a4efc-5839-54be-9637-e949c2e10a0c
--
-- 2. `spec_ingredients.raw_name` — THE ORIGINAL NAME FROM THE CORPUS.
--
--    `spec_ingredients.ingredient_id` points at the GENERIC, so `Abbey` currently reads:
--
--        4.5 cl    dry gin
--        2.25 cl   lillet
--        2 dash    aromatic bitters
--
--    when the corpus says:
--
--        4.5 cl    Rutte Dry Gin
--        2.25 cl   Lillet Blanc (or other aromatized wine)
--        2 dash    Angostura Aromatic Bitters
--
--    `ingredient_aliases` holds the mapping, so the BRANDS of a generic are derivable -- but which brand
--    THIS recipe used was lost. The generic is the vocabulary; the raw name is the recipe.
--
-- Both are nullable at first. The load fills them, and a later statement can set NOT NULL once every row
-- carries one. A column added as NOT NULL to a table that already has rows needs a default, and a default
-- here would be a lie.
-- ============================================================

alter table public.specs
  add column if not exists slug text;

alter table public.spec_ingredients
  add column if not exists raw_name text;

-- THE SLUG IS A URL KEY AND HAS TO BE UNIQUE. 72 titles in this corpus are two or three different drinks,
-- and a drink genuinely NAMED "Cherry Blossom #2" collides with the second "Cherry Blossom" -- so the
-- loader assigns the first free suffix rather than an ordinal. This index is what proves it worked.
create unique index if not exists idx_specs_slug on public.specs (slug);

-- The recipe view reads ingredients by spec, in order.
create index if not exists idx_spec_ingredients_spec on public.spec_ingredients (spec_id, "position");

-- The receipt. Run it AFTER re-loading load-07 and load-08 and read the numbers.
select 'specs with a slug'          as check, count(*)::text as n from public.specs where slug is not null
union all
select 'specs without a slug',      count(*)::text from public.specs where slug is null
union all
select 'ingredients with raw_name', count(*)::text from public.spec_ingredients where raw_name is not null
union all
select 'ingredients without it',    count(*)::text from public.spec_ingredients where raw_name is null;
