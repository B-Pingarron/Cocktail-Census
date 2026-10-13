-- ============================================================
-- BarNerd Phase 5 rung 2 (5c) -- THE SUBMISSION FUNCTIONS
--
-- Design of record: .sisyphus/plans/2026-09-22-hub-and-roast-plan.md  section 7b
-- Execution breakdown: 01_BarNerd/.sisyphus/plans/2026-10-06-5c-mini-rm.md  (T1)
--
-- WHY THIS FILE EXISTS. Section 7b gives `roast_lists.listed`, and section 11 step 12 gives
-- the roster's "submitted to the roast" toggle. Section 7b then says the design is carried by
-- "three SECURITY DEFINER functions". IT IS NOT, and this was measured against the live
-- database on 2026-10-06:
--
--   public functions:  save_spec_draft(payload jsonb)
--                      publish_spec(p_session_id, p_spec_id)
--                      retire_spec(p_session_id, p_spec_id)
--                      rls_auto_enable()
--                      -> NONE of them touches `roast_lists`.
--
--   anon on roast_lists:      INSERT 1 policy - SELECT 1 policy - UPDATE 0 - DELETE 0
--   anon on submission_specs: INSERT 1 policy - SELECT 1 policy - UPDATE 0 - DELETE 0
--
-- So an author could CREATE a submission list and ADD specs to it, and could never LIST it,
-- UNLIST it, or REMOVE a spec from it. The toggle had no write path at all. That is what the
-- two functions below close, and it is a fourth and fifth function, not a third.
--
-- THE THREE RULES THIS FILE IS BUILT AROUND (same as add-rung2-roast.sql):
--
--   1. `anon` HAS NO `UPDATE` AND NO `DELETE` ON ANY TABLE. So every state change the app can
--      make is an INSERT, and everything that would otherwise be an UPDATE or a DELETE goes
--      through a SECURITY DEFINER function. These two are exactly that.
--
--   2. THE OWNERSHIP CHECK IS THE WHOLE POINT. Without `and session_id = p_session_id` any
--      visitor could unlist anyone else's submission, or delete their fighters. `publish_spec`
--      establishes the shape: select into a local, `if not found then raise exception`.
--      Both functions below copy it rather than inventing a second pattern.
--
--   3. EVERYTHING HERE IS IDEMPOTENT, like phase0a and add-rung2-roast.sql. `create or replace`
--      means re-running is safe and changes nothing.
--
-- THE GUARD WORTH KNOWING ABOUT. `set_submission_listed` REFUSES to list an EMPTY submission.
-- A listed-but-empty list is a bug state: the arena deals from listed submissions, so an empty
-- one is a contender with no fighters. Section 7b's own philosophy is that the bad state should
-- be impossible in the DATABASE rather than in the code -- the same reasoning that gave
-- `one_live_per_cocktail` a partial unique index instead of a code check. It fails loudly with
-- a message rather than silently listing nothing.
--
-- NOT HERE, DELIBERATELY:
--   * renaming a list (`roast_lists.name` is an UPDATE) -- not needed by the toggle; add a
--     function if the roster grows a rename field.
--   * reordering (`submission_specs.position` is an UPDATE) -- `position` is the order at
--     creation; nothing in section 7b asks for reordering.
--   * auto-unlisting when the last fighter is removed. That would be a surprise; a list is
--     unlisted by asking, not by arithmetic.
-- ============================================================


-- ---------------------------------------------------------------------------------------------
-- THE TOGGLE -- "submit to the roast" / "withdraw".
--
-- Returns the new state so the caller can render it without a second read.
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

  -- OWNERSHIP. The list must exist AND belong to this session. `not found` covers both:
  -- a list that does not exist and a list owned by somebody else are the same answer.
  perform 1
  from public.roast_lists l
  where l.id = p_list_id and l.session_id = p_session_id;

  if not found then
    raise exception 'set_submission_listed: no such list for this session';
  end if;

  -- LISTING AN EMPTY SUBMISSION IS REFUSED. Unlisting is always allowed.
  if p_listed then
    select count(*) into v_fighters
    from public.submission_specs s
    where s.list_id = p_list_id;

    if v_fighters = 0 then
      raise exception 'set_submission_listed: cannot list an empty submission (no fighters)';
    end if;
  end if;

  update public.roast_lists
     set listed = p_listed
   where id = p_list_id and session_id = p_session_id;

  return p_listed;
end $function$;


-- ---------------------------------------------------------------------------------------------
-- REMOVE A FIGHTER -- takes a spec out of the submission at a position.
--
-- Position, not spec_id, because (list_id, position) is the primary key and one spec may appear
-- twice in a list on purpose -- two versions of the same drink, both entered.
-- ---------------------------------------------------------------------------------------------
create or replace function public.remove_submission_spec(
  p_session_id text,
  p_list_id    text,
  p_position   integer
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_session_id is null or p_list_id is null or p_position is null then
    raise exception 'remove_submission_spec: session_id, list_id and position are required';
  end if;

  perform 1
  from public.roast_lists l
  where l.id = p_list_id and l.session_id = p_session_id;

  if not found then
    raise exception 'remove_submission_spec: no such list for this session';
  end if;

  delete from public.submission_specs
   where list_id = p_list_id and position = p_position;

  if not found then
    raise exception 'remove_submission_spec: no spec at that position';
  end if;

  return true;
end $function$;
