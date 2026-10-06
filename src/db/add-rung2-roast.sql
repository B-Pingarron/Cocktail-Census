-- ============================================================
-- BarNerd Phase 5 — THE RUNG-2 SHAPE (ROAST's mini recipe manager)
--
-- Decided 2026-10-05 in a grill session. Full record, with every measurement:
--   .sisyphus/reports/2026-10-05-phase5-grill-decisions.md
-- Plan: .sisyphus/plans/2026-09-22-hub-and-roast-plan.md §7b
--
-- WHAT THIS FILE IS. The structure only. It deliberately does NOT seed `cocktails`
-- with the 100 names -- that seed is GENERATED from apps/census/src/data/cocktails.ts
-- (itself generated from Data/cocktails-100.csv by scripts/generate_cocktails_ts.py).
-- Hand-typing 101 names into a migration is how a name drifts from its source, and
-- the ids here have to match the ones already sitting in roast_votes.spec_ref.
--
-- THE THREE RULES THIS FILE IS BUILT AROUND, all measured against the live database
-- on 2026-10-05:
--
--   1. `anon` HAS NO `UPDATE` AND NO `DELETE` ON ANY TABLE. Verified across
--      information_schema.role_table_grants. So every state change the app can make
--      is an INSERT, and everything that would otherwise be an UPDATE goes through a
--      SECURITY DEFINER function. `specs` NEVER GETS `UPDATE`.
--
--   2. THEREFORE THE CORPUS IS IMMUTABLE BY CONSTRUCTION. `specs` holds both the
--      6,956-row research dataset and every bartender's own versions, told apart by
--      `session_id`: NULL is the corpus. The app never writes a row with a NULL owner.
--
--   3. EVERYTHING HERE IS IDEMPOTENT, like phase0a. Re-running is safe.
--
-- RECONSTRUCTED-NOT-DUMPED WARNING: phase0a-schema.sql says of `roast_lists` that it
-- is "RECONSTRUCTED, NOT DUMPED", and it is WRONG in two ways the live database
-- corrects: `session_id` is NOT NULL (the file says nullable), and `anon` HAS an
-- INSERT grant (the file says "select ONLY"). This file uses IF NOT EXISTS and never
-- re-declares a column's nullability, so it cannot make either worse.
-- ============================================================


-- ============================================================
-- 1. CATALOGUE — the lego box gains one member
-- ============================================================

-- 1a. Ice. The user's field list included it and said "probably not really showing up
--     anywhere for now, that's fine". It is a TABLE rather than a free-text column
--     because every other controlled vocabulary in this project is a table -- §7's
--     ruling that vocabulary is "a constraint, not a convention". Nullable on the spec,
--     no editor field, no UI: it is reserved, not used.
create table if not exists public.ice (
  id            text        not null primary key,   -- none | cubed | cracked | crushed | block
  label         text        not null,
  position      integer     not null default 0
);

comment on table public.ice is 'Ice types. A catalogue, like glassware and techniques. Reserved: no editor field and no UI at rung 2.';

insert into public.ice (id, label, position) values
  ('none',    'No ice',   0),
  ('cubed',   'Cubed',    1),
  ('cracked', 'Cracked',  2),
  ('crushed', 'Crushed',  3),
  ('block',   'Block',    4)
on conflict (id) do nothing;

grant select on public.ice to anon;


-- ============================================================
-- 2. COCKTAILS — ROAST's own name registry
-- ============================================================
-- WHY ITS OWN TABLE, AND NOT THE CENSUS'S LIST. The user's ruling: "theres no
-- interaction at the moment between the roast and the census". The Pool of names a
-- bartender may write a version of is ROAST's, seeded ONCE from the 100. The Census
-- can then rename, regroup or expand its list with no consequence here.
--
-- WHY IT IS NOT "JUST id AND name" IN A VIEW. `specs.cocktail_slug` needs a real
-- foreign key, or the name becomes "a string that ought to match" -- the exact thing
-- §7 rejected for ingredients.
--
-- HOW IT GROWS. By ADOPTION: a Contender may also pick any name already in the corpus
-- (the Lion's Tail is the first such case -- a real drink, in the corpus, outside the
-- 100). Picking it inserts a row here. So there is never free text: every name came
-- from a source, not a keyboard. Adoption keys on the CORPUS SLUG, never the name --
-- 72 titles in the corpus are two or three different drinks.
create table if not exists public.cocktails (
  id            text        not null primary key,   -- the slug: "espresso-martini"
  name          text        not null,               -- the display name: "Espresso Martini"
  created_at    timestamptz not null default now()
);

comment on table  public.cocktails is 'ROAST''s pool of Cocktails: the established drinks a Contender may write a version of. Seeded once from the Census 100, grown by adoption.';
comment on column public.cocktails.id is 'The slug. Must match the id already stored in roast_votes.spec_ref and in apps/census/src/data/cocktails.ts.';

grant select, insert on public.cocktails to anon;

alter table public.cocktails enable row level security;

drop policy if exists "Anyone can read cocktails" on public.cocktails;
create policy "Anyone can read cocktails"
  on public.cocktails for select to anon using (true);

-- Adoption. A visitor adds a Cocktail by picking a corpus name; nobody edits or removes one.
drop policy if exists "Anyone can adopt a cocktail" on public.cocktails;
create policy "Anyone can adopt a cocktail"
  on public.cocktails for insert to anon with check (true);


-- ============================================================
-- 3. SPECS — four columns and one index carry the whole user model
-- ============================================================
-- (session_id, cocktail_slug) IS the version chain's root. There is no `root_id`:
-- the pair is the root, and the partial unique index below is the guard, so the
-- two-live-versions bug is impossible in the database rather than in the code that
-- remembers to flip the other one off.
alter table public.specs add column if not exists session_id    text;
alter table public.specs add column if not exists cocktail_slug text;
alter table public.specs add column if not exists is_live       boolean not null default false;
alter table public.specs add column if not exists retired_at    timestamptz;
alter table public.specs add column if not exists ice_id        text references public.ice(id) on delete set null;

comment on column public.specs.session_id    is 'Who owns this spec. NULL = the research corpus. The app never writes a row with a NULL owner.';
comment on column public.specs.cocktail_slug is 'The Cocktail this is a version of. Also the alternatives link: alternatives to a drink are the rows that share its slug.';
comment on column public.specs.is_live       is 'The version the Arena shows. Exactly one per (session_id, cocktail_slug) -- enforced by one_live_per_cocktail. Only publish_spec() may set it true.';
comment on column public.specs.retired_at    is 'Retired: out of the library and out of the Pool. The row is never deleted -- nothing in this schema is ever destroyed.';
comment on column public.specs.ice_id        is 'FK to ice. Nullable and unused at rung 2.';

-- THE GUARD. Exactly one live version per drink per owner.
create unique index if not exists one_live_per_cocktail
  on public.specs (session_id, cocktail_slug)
  where is_live;

-- The library read: `where session_id = :me and retired_at is null`.
create index if not exists idx_specs_session  on public.specs (session_id) where session_id is not null;
create index if not exists idx_specs_cocktail on public.specs (cocktail_slug) where cocktail_slug is not null;
create index if not exists idx_specs_live     on public.specs (session_id, cocktail_slug) where is_live;

-- USER SLUGS STAY NULL. `specs.slug` is a unique index across all 6,956 corpus rows, and
-- an authored "Old Fashioned" collides with `old-fashioned` before anything else goes
-- wrong. Postgres permits many NULLs in a unique index, so an authored spec carries no
-- slug at all: a Submission is the addressable thing, not a single spec.


-- ============================================================
-- 4. THE METHOD / NOTES RENAME
-- ============================================================
-- `Method` means the TECHNIQUE -- shake, stir, build. That is what bartenders say, and
-- `techniques` was built from "the leading verb of recipe instructions". The column
-- currently named `method` holds PROSE, and it has NO READERS in the app: the three
-- `.method` reads in the codebase are the static cocktails.ts and roastSpecs.ts arrays.
-- So this rename is free.
--
-- GUARDED, because `rename column` is not idempotent and the IF NOT EXISTS form does
-- not exist for a rename.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'specs' and column_name = 'method'
  ) then
    alter table public.specs rename column method to notes;
    comment on column public.specs.notes is 'The author''s free prose: instructions, a story, a poem, or empty. One optional field, unbounded in content. Renamed from `method` on 2026-10-05.';
  end if;
end $$;


-- ============================================================
-- 5. ROAST — the Submission
-- ============================================================
-- A Submission is a SELECTION from a Collection, so `collection_specs` cannot express
-- it -- that table holds the whole roster. Hence its own membership table: the fourth
-- use of "an ordered list of references."
--
-- `list_id` is deliberately NOT a foreign key, on the same reasoning as
-- roast_votes.spec_ref: the membership table stays independent of the table it names.
create table if not exists public.submission_specs (
  list_id       text        not null,   -- roast_lists.id
  "position"    integer     not null,
  spec_id       uuid        not null references public.specs(id) on delete cascade,
  primary key (list_id, "position")
);

comment on table  public.submission_specs is 'Ordered membership of a Submission. Fourth use of the child-table pattern.';
comment on column public.submission_specs.list_id is 'roast_lists.id. Not a foreign key, by the same ruling as roast_votes.spec_ref.';

create index if not exists idx_submission_specs_spec on public.submission_specs (spec_id);

grant select, insert on public.submission_specs to anon;

alter table public.submission_specs enable row level security;

drop policy if exists "Anyone can read submission specs" on public.submission_specs;
create policy "Anyone can read submission specs"
  on public.submission_specs for select to anon using (true);

drop policy if exists "Anyone can add to a submission" on public.submission_specs;
create policy "Anyone can add to a submission"
  on public.submission_specs for insert to anon with check (true);

-- 5b. roast_lists gains three columns. It loses `collection_id`, which an earlier draft
--     of the plan called for: a user's library is NOT a Collection (it is
--     `specs where session_id = me`), so there is nothing to point at.
--
--     `author` IS REQUIRED, and this was a hard blocker rather than a nicety. The
--     Nickname lives only in localStorage (`barnerd-nickname`) and NO TABLE carried a
--     nickname, author or display_name column -- verified across
--     information_schema.columns. So "the drinks go to the pool tied to the user's
--     name" was unimplementable. It is a SNAPSHOT at publish: a later rename does not
--     rewrite a published byline, the same principle as the Update button.
alter table public.roast_lists add column if not exists author      text    not null default 'Anonymous';
alter table public.roast_lists add column if not exists listed      boolean not null default false;
alter table public.roast_lists add column if not exists is_tutorial boolean not null default false;

comment on column public.roast_lists.author      is 'The display name this Submission was published under. A snapshot, not a live lookup: a later rename does not rewrite it.';
comment on column public.roast_lists.listed      is 'In the Pool: dealt to Roasters. Unlisted is reachable only by its own link.';
comment on column public.roast_lists.is_tutorial is 'The author''s own 15, always listed, always the first-run flow. The tutorial is data, not a hardcoded behaviour.';


-- ============================================================
-- 6. THE THREE FUNCTIONS
-- ============================================================
-- WHY FUNCTIONS AT ALL, since three of them is not nothing:
--
--   a) The browser has NO TRANSACTIONS. Saving a version writes specs +
--      spec_ingredients + spec_techniques + spec_garnishes. Over the Supabase client
--      that is four round trips, and a failure between them leaves a half-written
--      drink in the database. Atomicity alone requires a function.
--
--   b) "MAKE IT LIVE" IS A WRITE, and `anon` can only INSERT. It cannot be an UPDATE,
--      and granting UPDATE on `specs` would let any visitor rewrite the research
--      corpus. So the flip happens behind SECURITY DEFINER, with the ownership check
--      inside.
--
--   c) NOTHING IS EVER DELETED. `retire_spec` sets a timestamp. There is no DELETE
--      grant anywhere and there will not be one.
--
-- Each function is SECURITY DEFINER and pins `search_path`, so it cannot be redirected
-- by a caller. Each verifies ownership before touching anything.

-- 6a. save_spec_draft — one transaction, one new version.
--
--     The FIRST version of a drink goes live immediately (there is no previous one);
--     every later version lands as a draft, and the Update button publishes it. That
--     is the whole of the draft/publish rule, and it is decided here rather than in
--     the client so the invariant cannot be got wrong in two places.
create or replace function public.save_spec_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   text := nullif(trim(coalesce(payload->>'session_id', '')), '');
  v_slug      text := nullif(trim(coalesce(payload->>'cocktail_slug', '')), '');
  v_spec_id   uuid := gen_random_uuid();
  v_has_live  boolean;
  v_item      jsonb;
  v_pos       integer;
begin
  if v_session is null then
    raise exception 'save_spec_draft: session_id is required';
  end if;
  if v_slug is null then
    raise exception 'save_spec_draft: cocktail_slug is required';
  end if;
  if not exists (select 1 from public.cocktails c where c.id = v_slug) then
    raise exception 'save_spec_draft: unknown cocktail_slug %', v_slug;
  end if;

  select exists (
    select 1 from public.specs s
    where s.session_id = v_session and s.cocktail_slug = v_slug and s.is_live
  ) into v_has_live;

  insert into public.specs
    (id, name, glass_id, technique_id, notes, source, session_id, cocktail_slug, is_live, slug, ice_id)
  values (
    v_spec_id,
    coalesce(nullif(trim(coalesce(payload->>'name', '')), ''), v_slug),
    nullif(trim(coalesce(payload->>'glass_id', '')), ''),
    nullif(trim(coalesce(payload->>'technique_id', '')), ''),
    nullif(payload->>'notes', ''),
    'user-submitted',
    v_session,
    v_slug,
    not v_has_live,     -- the first version is live; later ones are drafts
    null,               -- user specs carry no slug
    nullif(trim(coalesce(payload->>'ice_id', '')), '')
  );

  -- ingredients: [{ingredient_id, amount, raw_name, role}]
  -- raw_name is REQUIRED, not optional. add-slug-and-raw-name.sql exists because
  -- "which brand this recipe used was lost"; writing only the generic re-introduces
  -- that bug in every authored spec.
  v_pos := 0;
  for v_item in select * from jsonb_array_elements(coalesce(payload->'ingredients', '[]'::jsonb)) loop
    insert into public.spec_ingredients (spec_id, "position", role, amount, ingredient_id, raw_name)
    values (
      v_spec_id, v_pos,
      nullif(trim(coalesce(v_item->>'role', '')), ''),
      nullif(v_item->>'amount', ''),
      (v_item->>'ingredient_id')::uuid,
      nullif(v_item->>'raw_name', '')
    );
    v_pos := v_pos + 1;
  end loop;

  -- techniques: [{technique_id}] -- ORDERED. 1,914 corpus specs carry two or more
  -- steps and the maximum is six, so a single dropdown would be a lossy summary.
  v_pos := 0;
  for v_item in select * from jsonb_array_elements(coalesce(payload->'techniques', '[]'::jsonb)) loop
    insert into public.spec_techniques (spec_id, step, technique_id)
    values (v_spec_id, v_pos, v_item->>'technique_id');
    v_pos := v_pos + 1;
  end loop;

  -- garnishes: [{garnish_group, position, element_id}]
  for v_item in select * from jsonb_array_elements(coalesce(payload->'garnishes', '[]'::jsonb)) loop
    insert into public.spec_garnishes (spec_id, garnish_group, "position", element_id)
    values (
      v_spec_id,
      coalesce((v_item->>'garnish_group')::integer, 0),
      coalesce((v_item->>'position')::integer, 0),
      v_item->>'element_id'
    );
  end loop;

  -- garnish axes: [{garnish_group, position, axis, value_id}]
  for v_item in select * from jsonb_array_elements(coalesce(payload->'garnish_axes', '[]'::jsonb)) loop
    insert into public.spec_garnish_axes (spec_id, garnish_group, "position", axis, value_id)
    values (
      v_spec_id,
      coalesce((v_item->>'garnish_group')::integer, 0),
      coalesce((v_item->>'position')::integer, 0),
      v_item->>'axis',
      v_item->>'value_id'
    );
  end loop;

  return v_spec_id;
end $$;

comment on function public.save_spec_draft(jsonb) is 'Insert one new immutable version of a drink, with its children, in one transaction. The first version is live; later ones are drafts. SECURITY DEFINER because the browser has no transactions and `anon` has no UPDATE.';


-- 6b. publish_spec — the Update button.
create or replace function public.publish_spec(p_session_id text, p_spec_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  if p_session_id is null or p_spec_id is null then
    raise exception 'publish_spec: session_id and spec_id are required';
  end if;

  select s.cocktail_slug into v_slug
  from public.specs s
  where s.id = p_spec_id and s.session_id = p_session_id;

  if not found then
    raise exception 'publish_spec: no such spec for this session';
  end if;
  if v_slug is null then
    raise exception 'publish_spec: this spec is not a version of any Cocktail';
  end if;

  -- clear the incumbent FIRST: one_live_per_cocktail would reject the second update
  update public.specs
     set is_live = false
   where session_id = p_session_id and cocktail_slug = v_slug and is_live;

  update public.specs
     set is_live = true
   where id = p_spec_id;

  return p_spec_id;
end $$;

comment on function public.publish_spec(text, uuid) is 'Make a draft version live. Clears the incumbent first, because one_live_per_cocktail forbids two. The votes already cast stay on the old row: nothing moves, and nothing is reset.';


-- 6c. retire_spec — free a slot in a library capped at 15.
--
--     The cap is real (three rounds of five IS the cap of fifteen) and `anon` can
--     never DELETE, so a recipe book with no way to prune is worse than one with a
--     way. Retiring sets a timestamp, clears the live flag, and removes the spec from
--     its Submission -- a membership row, not content. Nothing is destroyed.
create or replace function public.retire_spec(p_session_id text, p_spec_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_id is null or p_spec_id is null then
    raise exception 'retire_spec: session_id and spec_id are required';
  end if;

  if not exists (
    select 1 from public.specs s where s.id = p_spec_id and s.session_id = p_session_id
  ) then
    raise exception 'retire_spec: no such spec for this session';
  end if;

  update public.specs
     set retired_at = now(), is_live = false
   where id = p_spec_id;

  delete from public.submission_specs where spec_id = p_spec_id;

  return p_spec_id;
end $$;

comment on function public.retire_spec(text, uuid) is 'Retire a version: out of the library and out of the Pool, freeing a slot in the cap of 15. Sets a timestamp; never deletes.';

grant execute on function public.save_spec_draft(jsonb)          to anon;
grant execute on function public.publish_spec(text, uuid)        to anon;
grant execute on function public.retire_spec(text, uuid)         to anon;


-- ============================================================
-- 7. THE RECEIPT
-- ============================================================
-- Read these numbers after running the file. This is the same convention as
-- add-slug-and-raw-name.sql: the file proves itself.
select 'specs columns added (session_id, cocktail_slug, is_live, retired_at, ice_id)' as check,
       count(*)::text as n
  from information_schema.columns
 where table_schema = 'public' and table_name = 'specs'
   and column_name in ('session_id','cocktail_slug','is_live','retired_at','ice_id')
union all
select 'specs.method still present (should be 0)', count(*)::text
  from information_schema.columns
 where table_schema = 'public' and table_name = 'specs' and column_name = 'method'
union all
select 'specs.notes present (should be 1)', count(*)::text
  from information_schema.columns
 where table_schema = 'public' and table_name = 'specs' and column_name = 'notes'
union all
select 'one_live_per_cocktail index exists (should be 1)', count(*)::text
  from pg_indexes where schemaname = 'public' and indexname = 'one_live_per_cocktail'
union all
select 'ice rows (should be 5)', count(*)::text from public.ice
union all
select 'cocktails rows (0 until the generated seed is run)', count(*)::text from public.cocktails
union all
select 'roast_lists columns added (author, listed, is_tutorial)', count(*)::text
  from information_schema.columns
 where table_schema = 'public' and table_name = 'roast_lists'
   and column_name in ('author','listed','is_tutorial')
union all
select 'functions present (should be 3)', count(*)::text
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('save_spec_draft','publish_spec','retire_spec')
union all
select 'anon still cannot UPDATE specs (should be 0)', count(*)::text
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'specs'
   and grantee = 'anon' and privilege_type in ('UPDATE','DELETE');


-- ============================================================
-- 8. WHAT THIS FILE DOES NOT DO, ON PURPOSE
-- ============================================================
-- 1. IT DOES NOT SEED `cocktails`. The 100 names + the Lion's Tail are generated from
--    apps/census/src/data/cocktails.ts, because the ids must match the slugs already in
--    roast_votes.spec_ref (14 of the author's 15 match one exactly) and a hand-typed
--    copy is how that match breaks silently.
--
-- 2. IT DOES NOT MAKE THE AUTHOR'S 15 A SUBMISSION. That is a data step: 15 specs rows
--    with `cocktail_slug` set, owned by the house, plus a roast_lists row with
--    `is_tutorial = true`, `listed = true`, `author = 'BarNerd_420'`, and
--    submission_specs membership. 14 of the 15 take a Census slug; the 15th is
--    `lions-tail`, its own Pool entry.
--
-- 3. IT DOES NOT TOUCH THE CENSUS. No `votes`, no `cocktail_tally`, no RLS change on
--    the shipping table. ROAST and the Census do not interact.
--
-- 4. IT DOES NOT CREATE `collections` OR `collection_specs` BEHAVIOUR. A user's library
--    is `specs where session_id = me`; collections stay reserved for curated lists.
--
-- 5. IT DOES NOT ENABLE DELETE, ANYWHERE. Retirement is a timestamp.
