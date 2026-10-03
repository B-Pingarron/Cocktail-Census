-- ============================================================
-- BarNerd Phase 0b — the garnish layer
--
-- NINE AXES, and the schema mirrors them rather than inventing a shape.
--
--     ELEMENT       the thing              lemon · mint · salt · coffee beans · edible flower
--     PART          which piece            zest · peel · stick · leaf · sprig · petal · tip
--     CUT           how it is cut          slice · wedge · wheel · cube · chunk · grated · powder
--     STATE         what was done to it    fresh · dehydrated · frozen · candied · pickled · burn
--     FOLD          how the peel folds     twist · ribbon · spiral
--     ARRANGEMENT   the assembled form     sail · bouquet
--     SIZE          how big                coin-sized · length · thin · small
--     PORTION       how much               whole · half · quarter
--     PROCESS       the verb               dust · rim · float · express · discard · garnish
--     POSITION      where it ends up       on rim · on stick · floated · on top · centre
--
-- 86 closed values across the eight closed axes. The ELEMENT axis is the only one with a tail: 1,027
-- elements, 921 of them clean, covering 94.5% of rows.
--
-- ------------------------------------------------------------
-- WHY THIS FILE DROPS A TABLE, WHICH THE FIRST VERSION DID NOT.
--
-- `phase0a-schema.sql` already created `public.spec_garnishes`, pointing at the 30 compositor assets:
--
--     garnish_id  text  not null references public.garnishes(id) on delete restrict
--     primary key (spec_id, "position")
--
-- The first version of this file used `create table if not exists`, which DOES NOTHING when the table
-- already exists with a different shape. So the new definition never applied and the foreign key from
-- `spec_garnish_axes` referenced columns that were not there. The error was:
--
--     ERROR: 42703: column "garnish_group" of relation "public.spec_garnishes" does not exist
--
-- `if not exists` cannot tell "already correct" from "already different". It is a safe-looking clause
-- that silently does the wrong thing, and the parent wrote it for a table it had been told exists.
--
-- The old table holds 0 rows, confirmed by the user. So it is dropped -- but THROUGH A GUARD, because
-- the next person to run this may not be looking at an empty table.
-- ============================================================

-- ------------------------------------------------------------
-- 0. THE GUARD, and the drop it protects
--    Fails loudly rather than destroying. A migration that quietly deletes rows because it assumed they
--    were not there is worse than one that stops.
-- ------------------------------------------------------------
do $$
declare
  n bigint;
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'spec_garnishes') then
    select count(*) into n from public.spec_garnishes;
    if n > 0 then
      raise exception
        'REFUSING TO DROP: public.spec_garnishes holds % row(s). Migrate them first, or empty the table deliberately.', n;
    end if;
  end if;
end $$;

-- the child first, or the FK blocks the drop
drop table if exists public.spec_garnish_axes;
drop table if exists public.spec_garnishes;

-- ------------------------------------------------------------
-- 0b. THE INDEX THE LOADER NEEDS, and the reason it is here rather than in phase0a.
--
-- The load files write the per-spec garnish rows as a VALUES list JOINED to `specs` on the NAME:
--
--     select s.id, v.g, v.p, v.e from (values ('Caipirinha', 0, 0, 'lime'), ...) as v(title, g, p, e)
--     join public.specs s on s.name = v.title;
--
-- That is the right shape -- a literal UUID would have to be invented. But `phase0a-schema.sql` indexes
-- `specs.glass_id` and `specs.technique_id` and NOT `specs.name`, so the join was a nested loop with a
-- sequential scan per VALUES row, and a 196 KB chunk ran for minutes without finishing.
--
-- A file that HANGS the database is worse than one that fails, so the index ships with the layer that
-- depends on it.
-- ------------------------------------------------------------
create index if not exists idx_specs_name on public.specs (name);

-- ------------------------------------------------------------
-- 1. THE ELEMENT VOCABULARY
--    `none` is a ROW here, deliberately -- his ruling: "many recipees declare explicity that they take
--    no garnish, and i want that reflected". 302 rows, 4.34% of the corpus. Without it, a spec with no
--    garnish rows says nothing, which is the identical trap the alternatives slot had.
-- ------------------------------------------------------------
create table if not exists public.garnish_elements (
  id          text        not null primary key,   -- slug: "lemon", "coffee-beans"
  name        text        not null,               -- display: "Lemon", "Coffee beans"
  is_sentinel boolean     not null default false, -- true only for `none`
  created_at  timestamptz not null default now()
);

comment on table  public.garnish_elements is
  'The garnish ELEMENT vocabulary. One row per thing a garnish can be.';
comment on column public.garnish_elements.is_sentinel is
  'True only for `none`, the declared absence of a garnish. It is a value, not a hole.';

grant select on public.garnish_elements to anon;

-- ------------------------------------------------------------
-- 2. THE EIGHT CLOSED AXES, in one table
--    86 values between them. `axis` is constrained so a typo cannot invent a tenth axis.
-- ------------------------------------------------------------
create table if not exists public.garnish_axis_values (
  axis        text        not null,
  id          text        not null,   -- slug: "zest", "on-rim"
  name        text        not null,
  created_at  timestamptz not null default now(),
  primary key (axis, id),
  constraint garnish_axis_known check (axis in (
    'part', 'cut', 'state', 'fold', 'arrangement', 'size', 'portion', 'process', 'position'
  ))
);

comment on table public.garnish_axis_values is
  'The nine closed garnish axes, 86 values. One table because every axis has the same two columns.';

create index if not exists idx_garnish_axis_values_axis on public.garnish_axis_values (axis);

grant select on public.garnish_axis_values to anon;

-- ------------------------------------------------------------
-- 3. THE GARNISH ON A SPEC
--    ONE ROW PER ELEMENT, because `Lime wedge & salt rim` is two different treatments of two different
--    things, not one garnish. `garnish_group` keeps a compound together -- `Pineapple wedge & cherry on
--    stick` is one garnish made of two elements -- so the renderer can still draw it as one object.
-- ------------------------------------------------------------
create table if not exists public.spec_garnishes (
  spec_id        uuid     not null references public.specs(id) on delete cascade,
  garnish_group  integer  not null,   -- which garnish on the drink; a compound shares a group
  position       integer  not null,   -- order within the group
  element_id     text     not null references public.garnish_elements(id) on delete restrict,
  primary key (spec_id, garnish_group, position)
);

comment on table  public.spec_garnishes is
  'One row per garnish ELEMENT on a spec. garnish_group groups a compound garnish together.';
comment on column public.spec_garnishes.garnish_group is
  'Compounds share a group. `Pineapple wedge & cherry on stick` is group 0 positions 0 and 1.';

create index if not exists idx_spec_garnishes_element on public.spec_garnishes (element_id);

grant select, insert on public.spec_garnishes to anon;

-- ------------------------------------------------------------
-- 4. THE AXES OF ONE GARNISH ELEMENT
--    A child table, the same pattern `spec_techniques` and `spec_ingredients` already use, because an
--    element can carry MORE THAN ONE value per axis: `Apple slice wheel` is CUT slice AND CUT wheel.
-- ------------------------------------------------------------
create table if not exists public.spec_garnish_axes (
  spec_id        uuid     not null,
  garnish_group  integer  not null,
  position       integer  not null,
  axis           text     not null,
  value_id       text     not null,
  primary key (spec_id, garnish_group, position, axis, value_id),
  foreign key (spec_id, garnish_group, position)
    references public.spec_garnishes (spec_id, garnish_group, position) on delete cascade,
  foreign key (axis, value_id)
    references public.garnish_axis_values (axis, id) on delete restrict
);

comment on table public.spec_garnish_axes is
  'The axis values of one garnish element. Several rows per axis is normal: slice AND wheel.';

create index if not exists idx_spec_garnish_axes_value on public.spec_garnish_axes (axis, value_id);

grant select, insert on public.spec_garnish_axes to anon;

-- ------------------------------------------------------------
-- 5. THE RAW PROSE, kept because it is EVIDENCE
--    The corpus garnish cell as written. `carries_garnish = false` is the 60 strings that name nothing --
--    the drink's method, or the author's prose -- and they are REPORTED, never dropped.
-- ------------------------------------------------------------
create table if not exists public.garnish_prose (
  raw_string       text        not null primary key,
  carries_garnish  boolean     not null,
  note             text,
  created_at       timestamptz not null default now()
);

comment on table public.garnish_prose is
  'The corpus garnish cell verbatim. carries_garnish=false are the strings that name no garnish at all.';

grant select, insert on public.garnish_prose to anon;

-- ------------------------------------------------------------
-- 6. THE BRIDGE TO THE DRAWING VOCABULARY
--    `garnishes` holds the 30 compositor ASSETS -- the RENDERING vocabulary, which his ruling keeps
--    separate from the data vocabulary. This table is the join, and it is explicit in BOTH directions:
--    `renders = true` carries an asset, `renders = false` says the element is real and is NOT drawn.
--    A missing row would have meant the same thing as "not drawn", which is the trap `none` already
--    taught: an absence has to be able to say it is deliberate.
-- ------------------------------------------------------------
create table if not exists public.garnish_asset_map (
  element_id  text    not null primary key references public.garnish_elements(id) on delete cascade,
  asset_id    text    references public.garnishes(id) on delete restrict,
  renders     boolean not null,
  note        text,
  constraint garnish_asset_map_consistent check ((asset_id is null) = (not renders))
);

comment on table public.garnish_asset_map is
  'element -> compositor asset. renders=false means the element is real and deliberately not drawn.';

grant select on public.garnish_asset_map to anon;

-- ============================================================
-- RLS, matching the tables phase0a-schema.sql already created
-- ============================================================
alter table public.garnish_elements    enable row level security;
alter table public.garnish_axis_values enable row level security;
alter table public.spec_garnishes      enable row level security;
alter table public.spec_garnish_axes   enable row level security;
alter table public.garnish_prose       enable row level security;
alter table public.garnish_asset_map   enable row level security;

drop policy if exists anon_read_garnish_elements on public.garnish_elements;
create policy anon_read_garnish_elements on public.garnish_elements for select using (true);

drop policy if exists anon_read_garnish_axis_values on public.garnish_axis_values;
create policy anon_read_garnish_axis_values on public.garnish_axis_values for select using (true);

drop policy if exists anon_read_garnish_prose on public.garnish_prose;
create policy anon_read_garnish_prose on public.garnish_prose for select using (true);

drop policy if exists anon_read_garnish_asset_map on public.garnish_asset_map;
create policy anon_read_garnish_asset_map on public.garnish_asset_map for select using (true);

drop policy if exists anon_read_spec_garnishes on public.spec_garnishes;
create policy anon_read_spec_garnishes on public.spec_garnishes for select using (true);
drop policy if exists anon_insert_spec_garnishes on public.spec_garnishes;
create policy anon_insert_spec_garnishes on public.spec_garnishes for insert with check (true);

drop policy if exists anon_read_spec_garnish_axes on public.spec_garnish_axes;
create policy anon_read_spec_garnish_axes on public.spec_garnish_axes for select using (true);
drop policy if exists anon_insert_spec_garnish_axes on public.spec_garnish_axes;
create policy anon_insert_spec_garnish_axes on public.spec_garnish_axes for insert with check (true);

-- ============================================================
-- THE SENTINEL. `none` is a value, not a hole.
-- ============================================================
insert into public.garnish_elements (id, name, is_sentinel) values
  ('none', 'None (declared no garnish)', true)
on conflict (id) do nothing;
