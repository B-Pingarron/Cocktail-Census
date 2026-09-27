-- ============================================================
-- The waitlist — one email, three independent interests
-- ============================================================
--
-- WHY THIS IS A PLAIN INSERT AND NOT SUPABASE AUTH (ADR-035, do not re-litigate):
--   The ask is a contact, not an identity. Integrating auth would mean OTP, a magic link,
--   an email send, and a second identity path sitting on top of the local session that
--   already exists. It would also spend Supabase's built-in quota of 2 emails per hour,
--   which is a shared limit in a crowded hall on shared wifi. A table insert does none of
--   that and collects unlimited contacts.
--
-- WHY NO CONFIRMATION EMAIL IS SENT:
--   Nothing in this product sends mail. The form's consent line says so, and this file is
--   what makes that true — there is no trigger, no provider, no queue.
--
-- WHY session_id IS HERE EVEN THOUGH THE ASK ASKS FOR NOTHING:
--   It is nullable and never required. It exists so the same person who voted on the Census
--   can be recognised if a beta invite is later sent, and so a duplicate submission is
--   detectable later. Same column and same meaning as votes.session_id, per ADR-035.
--
-- WHY NO SELECT POLICY:
--   Same reasoning as the feedback table: the client only ever writes. A waitlist that
--   anyone can read is a list of other people's addresses.
--
-- RUN THIS IN THE SUPABASE SQL EDITOR. Idempotent: safe to run more than once.
-- ============================================================

create table if not exists public.waitlist (
  email       text        not null,
  interests   text[]      not null default '{}',
  session_id  text,
  created_at  timestamptz not null default now(),

  -- The three boxes are the only three interests that exist. Contained-by, so an unknown
  -- or misspelled interest is rejected at the database rather than stored and ignored.
  constraint waitlist_interests_known
    check (interests <@ array['rm-beta', 'roast-beta', 'news']),

  -- Not an email parser on purpose: a database regex is a second, worse copy of the one in
  -- the client. This is a length bound and a "has an @ and something around it" floor.
  constraint waitlist_email_shape
    check (char_length(email) between 3 and 320 and position('@' in email) > 1),

  -- At least one interest, or the row says nothing. An empty submit is a mistake, not a
  -- subscription.
  constraint waitlist_interests_not_empty check (cardinality(interests) > 0)
);

comment on table  public.waitlist is 'Contacts from the ask. One email, up to three independent interests.';
comment on column public.waitlist.email is 'The address the visitor typed. Stored only to follow up on the interests they ticked.';
comment on column public.waitlist.interests is 'Which of the three boxes were ticked. Empty is rejected by constraint.';
comment on column public.waitlist.session_id is 'Optional local session id, so a beta invite can find someone who also voted. Nullable by design.';

create index if not exists idx_waitlist_session on public.waitlist (session_id);

grant insert on public.waitlist to anon;

alter table public.waitlist enable row level security;

drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- No select policy for anon: intentional.

-- ============================================================
-- Done. Your app can now insert a contact via:
--   supabase.from('waitlist').insert({ email, interests, session_id })
-- ============================================================
