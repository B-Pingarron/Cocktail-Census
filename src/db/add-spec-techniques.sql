-- ============================================================
-- BarNerd Phase 0b — spec_techniques
--
-- A spec can need MORE THAN ONE technique. `build, stir` means dissolve the sugar,
-- build the drink, then stir it -- and the ORDER is the method. One column cannot hold
-- that, so this is the child-table pattern the schema already uses for spec_ingredients.
--
-- RUN IN THE SUPABASE SQL EDITOR. Idempotent.
-- ============================================================

create table if not exists public.spec_techniques (
  spec_id       uuid     not null references public.specs(id) on delete cascade,
  step          integer  not null,   -- 0 is the first act; the order is the method
  technique_id  text     not null references public.techniques(id) on delete restrict,
  primary key (spec_id, step)
);

comment on table public.spec_techniques is
  'Ordered techniques for a spec. Multiple rows = several acts (build then stir).';
comment on column public.spec_techniques.step is
  'Order of the act within the method. 0-based.';

create index if not exists idx_spec_techniques_technique
  on public.spec_techniques (technique_id);

grant select, insert on public.spec_techniques to anon;

-- The 12 ruled values. `roll` is merged into `throw`; `top` is not here -- it is an
-- ingredient ROLE (filler), not a technique. `special` was added by the user's ruling
-- 2026-10-02: "special can become a 12th value". It is reachable ONLY through an override
-- in barnerd_lib/rulings.py -- there is no verb pattern for it and there must never be one.
-- Used by Hot Cherry, Sorrelade (Non-alcoholic) and Voodoo of Pele.
--
-- THIS INSERT MUST MATCH barnerd_lib/techniques.py TECHNIQUES EXACTLY. A spec_techniques row
-- carrying an id that is not in this table fails the FK (on delete restrict) and stops the load.
insert into public.techniques (id, name) values
  ('shake', 'shake'),
  ('dry shake', 'dry shake'),
  ('stir', 'stir'),
  ('churn', 'churn'),
  ('blend', 'blend'),
  ('muddle', 'muddle'),
  ('throw', 'throw'),
  ('layer', 'layer'),
  ('build', 'build'),
  ('syphon', 'syphon'),
  ('pour', 'pour'),
  ('special', 'special')
on conflict (id) do nothing;
