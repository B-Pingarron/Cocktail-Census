-- ============================================================
-- BarNerd -- THE TEQUILA CLEANUP, and the ten aliases the author's 15 needed
--
-- Asked for by the user, 2026-10-06, while resolving his fifteen specs:
--
--   1. "for tequila, the general should be tequila. agave is the plant where its made from, theres no
--      tequila made out of anything that is agave, so, take agave out."
--   2. "if i should pick from the list, i would pick blanco tequila."
--   3. and on silver vs blanco: "one generic: blanco tequila"
--
-- ============================ WHY `agave tequila` IS NONSENSE ==================================
--
-- Tequila is BY DEFINITION made from agave. Every `… agave tequila` generic therefore carries a word
-- that distinguishes it from nothing -- and the cleaning pass created four of them, each duplicating a
-- sibling that already existed without the redundant word:
--
--   agave tequila         2 rows   vs   (nothing -- this becomes the GENERAL)
--   añejo agave tequila   1 row    vs   añejo tequila        29 rows
--   blanco agave tequila  4 rows   vs   blanco tequila       49 rows
--   silver agave tequila  1 row    vs   silver blanco tequila 95 rows
--
-- AND SILVER IS BLANCO. In tequila both words mean unaged, so `silver blanco tequila` (95) and
-- `blanco tequila` (49) were one liquid split in two. The user's call: one generic, `blanco tequila`.
-- 103 rows move in total.
--
-- THE GENERAL IS MADE BY RENAMING, NOT BY INSERTING. `agave tequila` becomes `tequila` in place, so its
-- id survives and its two rows never move. A new row would have orphaned both.
--
-- ============================ THE TEN ALIASES ==================================================
--
-- With the tequila family settled, TEN of the author's thirty-four ingredient names still resolved by
-- near-miss rather than exactly -- and a near-miss is fine for a human reading a list and useless for a
-- generator. Each becomes an alias, so the generator matches exactly and the next author typing
-- "simple syrup" finds `sugar syrup`.
--
--   Simple syrup              -> sugar syrup              (the same thing; his list uses both names)
--   passionfruit puree        -> passion fruit puree       (only the SPACE differed)
--   Absinth                   -> absinthe                  (his spelling variant)
--   Citrus Cordial            -> cordial                   (his own cordial; the general exists)
--   Angostura bitters         -> aromatic bitters          (how the corpus already resolves it)
--   Blended Scotch            -> blended scotch whisky
--   Espresso                  -> espresso coffee
--   Peychaud's bitters        -> peychaud's aromatic bitters
--   Pimento Dram              -> pimento dram liqueur
--   Straight Rye (100 proof)  -> rye                       (the parenthetical is a MODIFIER, so it stays
--                                                           in raw_name -- but the alias records what
--                                                           he wrote, so the generator finds it)
--
-- `tequila` IS NOT IN THAT LIST, because it needs no alias: the rename above makes it an exact
-- canonical match.
--
-- ORDER MATTERS, as in the fernet merge: `spec_ingredients.ingredient_id` is ON DELETE RESTRICT and
-- `ingredient_aliases.ingredient_id` is ON DELETE CASCADE, so rows and aliases are repointed BEFORE a
-- generic is retired. Every delete is guarded by NOT EXISTS, so a mistake is a no-op and not a loss.
--
-- IDEMPOTENT. Re-running repoints nothing, re-adds nothing, and deletes nothing.
-- ============================================================


-- ---------------------------------------------------------------------------------------------
-- 1. THE GENERAL -- a rename, so the id and its two rows stay put
-- ---------------------------------------------------------------------------------------------
update public.ingredients
   set canonical_name = 'tequila'
 where canonical_name = 'agave tequila'
   and not exists (select 1 from public.ingredients x where x.canonical_name = 'tequila');


-- ---------------------------------------------------------------------------------------------
-- 2. THE FOUR MERGES -- rows, then aliases, then the generic
-- ---------------------------------------------------------------------------------------------
do $$
declare
  pair text[];
  src  text;
  dst  text;
  pairs text[][] := array[
    array['añejo agave tequila',   'añejo tequila'],
    array['blanco agave tequila',  'blanco tequila'],
    array['silver agave tequila',  'blanco tequila'],
    array['silver blanco tequila', 'blanco tequila']
  ];
begin
  foreach pair slice 1 in array pairs loop
    src := pair[1];
    dst := pair[2];

    -- rows first: RESTRICT would refuse the delete otherwise
    update public.spec_ingredients
       set ingredient_id = (select id from public.ingredients where canonical_name = dst)
     where ingredient_id = (select id from public.ingredients where canonical_name = src);

    -- then the aliases: CASCADE would have taken them with the generic
    update public.ingredient_aliases
       set ingredient_id = (select id from public.ingredients where canonical_name = dst)
     where ingredient_id = (select id from public.ingredients where canonical_name = src);

    -- and only then retire it, guarded
    delete from public.ingredients
     where canonical_name = src
       and not exists (select 1 from public.spec_ingredients si where si.ingredient_id = ingredients.id)
       and not exists (select 1 from public.ingredient_aliases a where a.ingredient_id = ingredients.id);

    raise notice 'merged % -> %', src, dst;
  end loop;
end $$;


-- ---------------------------------------------------------------------------------------------
-- 3. THE TEN ALIASES
-- ---------------------------------------------------------------------------------------------
insert into public.ingredient_aliases (alias, ingredient_id)
select v.alias, i.id
from (values
  ('Simple syrup',             'sugar syrup'),
  ('passionfruit puree',       'passion fruit puree'),
  ('Absinth',                  'absinthe'),
  ('Citrus Cordial',           'cordial'),
  ('Angostura bitters',        'aromatic bitters'),
  ('Blended Scotch',           'blended scotch whisky'),
  ('Espresso',                 'espresso coffee'),
  ('Peychaud''s bitters',      'peychaud''s aromatic bitters'),
  ('Pimento Dram',             'pimento dram liqueur'),
  ('Straight Rye (100 proof)', 'rye')
) as v(alias, canonical)
join public.ingredients i on i.canonical_name = v.canonical
on conflict (alias) do update set ingredient_id = excluded.ingredient_id;
