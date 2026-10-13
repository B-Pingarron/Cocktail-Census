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
-- WHY NO CONFIRMATION EMAIL IS SENT (SUPERSEDED 2026-10-12 — see add-waitlist-consent-evidence.sql):
--   This was true when this table was created and is no longer true. The double opt-in exists now,
--   because DSK's Orientierungshilfe Direktwerbung (2022) § 3.3 treats it as geboten for consent
--   declared electronically, and § 3.2 accepts trade-fair capture only where the consent's content
--   is provable. The columns this file creates carry no proof of what was consented to; the new
--   migration adds that proof. Do not build on the sentence below.
--
--   Historical text, kept so the change is legible:
--     "Nothing in this product sends mail. The form's consent line says so, and this file is what
--      makes that true — there is no trigger, no provider, no queue."
--
-- WHY THERE IS NO session_id COLUMN HERE ANY MORE (removed 2026-10-12):
--   This table used to carry a nullable `session_id` "so the same person who voted on the
--   Census can be recognised if a beta invite is later sent". That purpose was rejected: it
--   stored a real per-browser identifier beside a real address, which is exactly what makes the
--   product's anonymity promise false, and no consent block disclosed a purpose for it. The
--   column is therefore dropped in `add-waitlist-consent-evidence.sql` (`drop column if exists
--   session_id`, with the dependent index — nothing else referenced it). It is NOT created here
--   either, so a fresh install never grows a column the very next migration removes.
--   The two writers stopped sending the key in the same change; a client that still sent it
--   after the drop would have its whole insert rejected by PostgREST.
--   Rejected alternative: keep the column as a dead, unwritten field. A nullable column nobody
--   writes is an invitation for the next reader to reconnect it, and this one has a history.
--
-- WHY NO SELECT POLICY:
--   Same reasoning as the feedback table: the client only ever writes. A waitlist that
--   anyone can read is a list of other people's addresses.
--
-- VOCABULARY (2026-10-12): the domain terms are **Request** (one address plus the topics a
--   Visitor asked to be told about, with the proof of what they agreed to) and **Topic** (one of
--   those things). `waitlist` and `interests` are PHYSICAL names only, kept because renaming a live
--   table and a column to match the glossary buys nothing and risks the capture. The mapping is
--   deliberate: a `waitlist` row IS a Request, `interests` holds its Topics. See 01_BarNerd/CONTEXT.md.
--
-- RUN THIS IN THE SUPABASE SQL EDITOR. Idempotent: safe to run more than once.
-- ============================================================

create table if not exists public.waitlist (
  email       text        not null,
  interests   text[]      not null default '{}',
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

-- No index on a session id, and no `comment on column ... session_id`: the column is gone (see the
-- header). A `create index if not exists` on a dropped column is not idempotent — it fails on every
-- re-run of this hand-run apply script — which is why the line was removed rather than left behind.

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
--   supabase.from('waitlist').insert({ email, interests })
--
-- The consent-evidence columns the live capture needs (consent_version, source,
-- confirm_token, confirm_sent_at, confirm_expires_at) and the drop of the retired
-- session_id column are added by add-waitlist-consent-evidence.sql.
-- ============================================================
