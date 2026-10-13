-- ============================================================
-- BarNerd Phase 5 (5c) -- `save_submission`, and the rules a Submission actually has
--
-- Design of record: .sisyphus/plans/2026-09-22-hub-and-roast-plan.md  section 7b
-- The definition, and the three rules this file closes:  section 7b, "A Submission -- DEFINED 2026-10-06"
--
-- THE AUTHOR'S DEFINITION, which three documents used without defining:
--
--   "the user creates a spec, right? then he creates more. those are NOT submissions, those are
--    simply their specs. their library. a submission is a selection of those drinks, minimum of 3,
--    that the author want to submit to the arena."
--
-- So: a SPEC is a drink. A LIBRARY is all of an author's specs. A SUBMISSION is a SELECTION of the
-- author's OWN specs, AT LEAST THREE, that they choose to enter. Writing drinks enters you in nothing.
--
-- ============================ WHY A FUNCTION, AND WHY THE POLICIES GO ==========================
--
-- Both rules are UNENFORCEABLE BY ROW LEVEL SECURITY, and that is not a preference -- it is a fact
-- about the setup. `roast_lists` and `submission_specs` each carry a raw anon INSERT policy, and
-- Postgres has NO WAY to know the caller's `session_id`: ADR-035 mints the session client-side with
-- no Supabase Auth, so there is no `auth.uid()` to check against. A policy can therefore enforce
-- nothing about who is inserting.
--
-- Worse, the raw INSERT policies are a BYPASS of both rules. Anyone could insert a submission
-- referencing another author's spec, or a submission of one. So they are DROPPED here, and the only
-- write path becomes this function -- which is `SECURITY DEFINER`, runs as the owner, and can check
-- everything a policy cannot.
--
-- The same reasoning gave `save_spec_draft` its shape, and the browser's lack of transactions gives
-- it a second reason: a submission touches two tables and must land whole or not at all.
--
-- ============================ THE THREE FIXES ==================================================
--
--   1. `set_submission_listed` refused an EMPTY submission. The rule is FEWER THAN THREE. It was
--      written before the definition existed, and it was wrong.
--   2. `save_submission` -- the missing verb. Creates or replaces a Submission atomically.
--   3. The two raw anon INSERT policies are dropped, so the rules stop being decoration.
--
-- WHAT THE PAYLOAD CANNOT SET. `is_tutorial` is NOT in the payload and never will be. It marks the
-- list a first-time visitor is walked through, which is a property of the deployment, not of anything
-- an author types. Letting a payload set it would let any visitor declare themselves the tutorial.
--
-- THE AUTHOR IS A SNAPSHOT. Section 7b: "`author text not null default 'Anonymous'` -- a snapshot at
-- publish, so a later rename does not rewrite a published byline." So `author` is written ON CREATE
-- and NOT on update. Renaming yourself does not rewrite a byline that is already out.
--
-- IDEMPOTENT. Re-running replaces both functions and re-drops the policies safely.
-- ============================================================


-- ---------------------------------------------------------------------------------------------
-- FIX 1 -- the minimum is THREE, not one.
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_submission_listed(
  p_session_id text,
  p_list_id    text,
  p_listed     boolean
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_fighters integer;
begin
  if p_session_id is null or p_list_id is null or p_listed is null then
    raise exception 'set_submission_listed: session_id, list_id and listed are required';
  end if;

  perform 1
  from public.roast_lists l
  where l.id = p_list_id and l.session_id = p_session_id;

  if not found then
    raise exception 'set_submission_listed: no such list for this session';
  end if;

  -- THE MINIMUM IS THREE. The author: "a selection of those drinks, minimum of 3".
  -- Unlisting is always allowed -- a submission below the minimum can be withdrawn, just not entered.
  if p_listed then
    select count(*) into v_fighters
    from public.submission_specs s
    where s.list_id = p_list_id;

    if v_fighters < 3 then
      raise exception 'set_submission_listed: a submission needs at least 3 drinks, this one has %', v_fighters;
    end if;
  end if;

  update public.roast_lists
     set listed = p_listed
   where id = p_list_id and session_id = p_session_id;

  return p_listed;
end $function$;


-- ---------------------------------------------------------------------------------------------
-- FIX 2 -- THE MISSING VERB.
--
-- payload:
--   {
--     "session_id": "uuid",                 required
--     "list_id":    "barnerd-15",           optional -- absent CREATES a list
--     "name":       "my fighters",          optional on create, ignored on update
--     "author":     "BarNerd_420",          optional, WRITTEN ON CREATE ONLY (the snapshot)
--     "listed":     true,                   optional, defaults false
--     "spec_ids":   ["uuid", "uuid", ...]   required, AT LEAST THREE, all the caller's own
--   }
--
-- Returns the list id, so the caller can render without a second read.
-- ---------------------------------------------------------------------------------------------
create or replace function public.save_submission(payload jsonb)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_session_id text;
  v_list_id    text;
  v_name       text;
  v_author     text;
  v_listed     boolean;
  v_count      integer;
  v_owned      integer;
  v_existing   boolean;
begin
  if payload is null then
    raise exception 'save_submission: payload is required';
  end if;

  v_session_id := nullif(trim(payload->>'session_id'), '');
  if v_session_id is null then
    raise exception 'save_submission: session_id is required';
  end if;

  -- ---- the selection, and RULE 1: at least three -------------------------------------------
  if payload->'spec_ids' is null or jsonb_typeof(payload->'spec_ids') <> 'array' then
    raise exception 'save_submission: spec_ids must be an array';
  end if;

  v_count := jsonb_array_length(payload->'spec_ids');
  if v_count < 3 then
    raise exception 'save_submission: a submission needs at least 3 drinks, got %', v_count;
  end if;

  -- ---- RULE 2: every one of them is the CALLER'S OWN -----------------------------------------
  -- Joined on the text form rather than casting to uuid, so a malformed id is simply "not owned"
  -- rather than a cast error that says nothing useful.
  select count(*) into v_owned
  from jsonb_array_elements_text(payload->'spec_ids') as t(spec_id)
  join public.specs s on s.id::text = t.spec_id
  where s.session_id = v_session_id;

  if v_owned <> v_count then
    raise exception 'save_submission: % of the % drinks are not this session''s own specs',
      v_count - v_owned, v_count;
  end if;

  -- ---- the list: existing, or new --------------------------------------------------------------
  v_list_id := nullif(trim(payload->>'list_id'), '');

  if v_list_id is null then
    v_list_id := 'list-' || replace(gen_random_uuid()::text, '-', '');
    v_existing := false;
  else
    select true into v_existing
    from public.roast_lists l
    where l.id = v_list_id and l.session_id = v_session_id;

    if not found then
      raise exception 'save_submission: no such list for this session';
    end if;
  end if;

  -- ---- write the list ---------------------------------------------------------------------------
  if v_existing then
    -- `author` is deliberately NOT updated: it is the snapshot at publish (section 7b).
    update public.roast_lists
       set name = coalesce(nullif(trim(payload->>'name'), ''), name)
     where id = v_list_id;
  else
    insert into public.roast_lists (id, session_id, name, author, listed, is_tutorial)
    values (
      v_list_id,
      v_session_id,
      coalesce(nullif(trim(payload->>'name'), ''), 'My submission'),
      coalesce(nullif(trim(payload->>'author'), ''), 'Anonymous'),
      false,        -- created unlisted; listing is set_submission_listed's job, and it re-checks
      false         -- is_tutorial is NEVER set from a payload
    );
  end if;

  -- ---- replace the selection, in the payload's order --------------------------------------------
  delete from public.submission_specs where list_id = v_list_id;

  insert into public.submission_specs (list_id, position, spec_id)
  select v_list_id, (t.ordinality - 1), t.spec_id::uuid
  from jsonb_array_elements_text(payload->'spec_ids') with ordinality as t(spec_id, ordinality);

  -- ---- and list it if asked, THROUGH the guarded path --------------------------------------------
  v_listed := coalesce((payload->>'listed')::boolean, false);
  if v_listed then
    perform public.set_submission_listed(v_session_id, v_list_id, true);
  end if;

  return v_list_id;
end $function$;


-- ---------------------------------------------------------------------------------------------
-- FIX 3 -- the bypass goes.
--
-- With these two policies in place, everything above is advisory: any visitor could insert a
-- submission of one drink referencing somebody else's spec, straight into the table. A rule the
-- database cannot see is not a rule.
--
-- READ stays. The arena has to read submissions and their specs.
-- ---------------------------------------------------------------------------------------------
drop policy if exists "Anyone can insert a roast list" on public.roast_lists;
drop policy if exists "Anyone can add to a submission" on public.submission_specs;
