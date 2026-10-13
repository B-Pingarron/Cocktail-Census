-- ============================================================
-- Waitlist consent evidence — the double opt-in and its proof
-- ============================================================
--
-- WHY THIS FILE EXISTS AT ALL:
--   Under the DSK Orientierungshilfe Direktwerbung (2022) § 3.2, contact details left at a
--   trade fair are only validly consented-to if the controller can prove the consent's
--   content. Before this migration the waitlist stored an address and three ticks and
--   nothing else — no version, no wording, no hash. An unprovable consent is not a defence
--   when someone later claims the address was harvested in a hall. This migration makes
--   every row carry the version of the text it was ticked under, and keeps that text
--   (wording + sha256) in the database, not only in the repository.
--
-- WHY THE CONSENT PROOF IS RETAINED AFTER A WITHDRAWAL, AND ON WHICH BASIS:
--   DSK OH Direktwerbung § 3.7: when consent is withdrawn the address is deleted, but the
--   evidence of what was consented to is kept — on a *different* legal basis than the
--   consent itself, disclosed at the time of collection. The proof row lives on
--   Art. 6 Abs. 1 lit. c DSGVO (limitation periods for advertising-law claims, up to
--   3 years) and Art. 6 Abs. 1 lit. f DSGVO (the controller's legitimate interest in being
--   able to defend a later dispute about the very consent that authorised the sending).
--   It is not kept "because the visitor agreed" — that basis is gone the moment they
--   withdraw. `datenschutz.html` discloses this in the withdrawal section, as required.
--
-- WHY NO CONFIRMATION EMAIL WAS EVER SENT IS NO LONGER TRUE:
--   The base migration (`add-waitlist-table.sql`) documented the absence of a confirmation
--   email as a deliberate design choice. Double opt-in is now scope (operator decision,
--   2026-10-12): the capture path stores a confirm token and the app requests the
--   confirmation mail after the insert. This migration supersedes that design decision.
--   The base migration is edited too, and only where it would otherwise lie or fail on a
--   re-run: its "no confirmation email" note now points here, its retired `session_id`
--   column and index are gone (this file drops the column — see below), and its example
--   insert no longer shows a key that is no longer written.
--
-- WHY THE SEED CARRIES controller_email ALONGSIDE THE TEMPLATE TEXT:
--   The consent text is a TEMPLATE: __CONTROLLER_EMAIL__ is a parameter of the frozen
--   wording, and every renderer substitutes the real address — from consent.v1.json's
--   controller.email, the single fill point — at render time. Storing the address next to
--   the template text is what makes the template form of the sha256 legitimate rather
--   than lossy: the stored PAIR — exact template wording + the address that was
--   substituted into it — reconstructs exactly what the visitor read, byte for byte.
--   The hash covers the wording (which never changes); the address is a recorded
--   parameter. The Edge Function (waitlist-confirm-request) reads controller_email back
--   from this table, joined on the row's consent_version, instead of holding a
--   CONTROLLER_EMAIL secret: the address then has one home (controller.email in
--   src/legal/consent.v1.json, seeded here), and the withdrawal route is by construction
--   the address that was shown. A row whose controller_email is somehow empty or still
--   the marker makes the mail path refuse loudly (503) rather than send to a placeholder.
--
-- WHY THE TOKEN IS GENERATED CLIENT-SIDE:
--   The insert and the mail request are two network calls that can independently fail.
--   If the Edge Function were minted the token it could not correlate a "stored but mail
--   failed" row with the request that failed. Generating the token in the client means the
--   row is complete at insert time: token, dispatch timestamp, expiry. The mail path can
--   then fail without the stored contact losing anything.
--
-- WHY THE CONSENT TEXTS ARE READABLE BY ANON AND THE WAITLIST STILL IS NOT:
--   The wording is published legal text — the visitor is entitled to read exactly what they
--   are consenting to, before and after consenting, and a QR code to the notice points at
--   it. Making it selectable is the whole point of storing it. The waitlist keeps its own
--   posture from the base migration: anon may insert, anon may never select. A waitlist
--   anyone can read is a list of other people's addresses.
--
-- RETENTION, enforced by a machine and not by memory:
--   This file used to say retention was "enforced operationally", which meant enforced by
--   nobody: there was no delete, no job and no cron anywhere in the repository. A stated
--   period that nothing honours is worse than a vaguer honest one (Art. 5(1)(e) together
--   with Art. 5(2) DSGVO). The same migration now schedules the deletion:
--     * rows without `confirmed_at` — deleted 30 days after `created_at`. They were never
--       validly consented, so nothing may be built on them.
--     * rows with `confirmed_at` — deleted 18 months after confirmation. The notice used to
--       promise "kept until the beta concludes", which has no end date; 18 months is the
--       explicit outer bound.
--   The job is `pg_cron` (Supabase supports it). THE EXTENSION MUST BE ENABLED FIRST, in the
--   Supabase dashboard under Database → Extensions (`pg_cron`). The schedule block below
--   skips itself, with a notice, when the extension is absent — it does not fail the file
--   and it does not silently pretend a job exists. If that happens: enable `pg_cron`, then
--   re-run this file; the block is written to be safe on a re-run.
--   The published wording in `waitlist_consent_texts` carries no personal data and is never
--   touched by the job. The proof attached to one address (that row's consent_version and
--   timestamps) is deleted with the row; the 3-year period named in the header applies to a
--   row kept for a dispute, or kept after a withdrawal, past the 18-month bound.
--
-- RUN THIS IN THE SUPABASE SQL EDITOR. Idempotent: safe to run more than once.
-- The repo has no Supabase CLI linkage, so like the base migration this is run by hand.
-- ============================================================

-- The published consent texts. `version` is the primary key and the waitlist's FK target.
create table if not exists public.waitlist_consent_texts (
  version         text        primary key,
  controller_email text       not null,
  media           text        not null,
  purposes        text[]      not null,
  text_de         text        not null,
  text_en         text        not null,
  sha256_de       text        not null,
  sha256_en       text        not null,
  effective_from  timestamptz not null default now()
);

-- Upgrade path for a table created by an earlier run of this file without the column:
-- add it nullable, backfill with the real controller address — the same value the seed
-- inserts and the same value the gate checks against controller.email in
-- src/legal/consent.v1.json — then tighten to NOT NULL. All three statements are no-ops
-- once the column exists at NOT NULL, so reruns stay harmless.
alter table public.waitlist_consent_texts
  add column if not exists controller_email text;

update public.waitlist_consent_texts
set controller_email = 'barnerd_info@proton.me'
where controller_email is null;

alter table public.waitlist_consent_texts
  alter column controller_email set not null;

comment on table  public.waitlist_consent_texts is 'Published consent wordings, keyed by version. Readable by design: the visitor may read exactly what they consented to.';
comment on column public.waitlist_consent_texts.version is 'Consent-text version. The waitlist rows reference this, which is what makes the consent provable per DSK OH § 3.2.';
comment on column public.waitlist_consent_texts.controller_email is 'The real controller address that was substituted into the __CONTROLLER_EMAIL__ parameter of the template text when the visitor was shown it. Paired with text_de/text_en it reconstructs the exact rendered consent. Read back by waitlist-confirm-request as the reply_to withdrawal route — one home for the address, no secret mirror. Seeded from controller.email in src/legal/consent.v1.json, and the gate compares the seed to that field; a value that is empty or still the marker makes the mail path refuse loudly.';
comment on column public.waitlist_consent_texts.text_de is 'Verbatim German TEMPLATE wording, textLines joined with newlines, __CONTROLLER_EMAIL__ in place. Never paraphrased anywhere; the address is substituted at render time, never edited into this column.';
comment on column public.waitlist_consent_texts.sha256_de is 'sha256 of text_de over UTF-8, no trailing newline — the TEMPLATE hash, marker in place. Mirrors the frozen hash in src/legal/consent.v1.json so divergence is detectable.';

-- Seed v1 with the verbatim TEMPLATE wording from src/legal/consent.v1.json
-- (textLines.join('\n'), __CONTROLLER_EMAIL__ in place), the two frozen hashes, and the
-- REAL controller_email — the value of consent.v1.json's controller.email, with the
-- marker resolved. Storing the marker here would make the stored pair lossy: the whole
-- point of the pair is that frozen template + the substituted address reconstructs
-- exactly what the visitor read, and a placeholder is neither what was read nor a usable
-- withdrawal route. The gate (scripts/check-consent-ready.mjs) compares this literal
-- against controller.email and fails loudly on any difference, so the two cannot drift
-- apart silently — which is the whole class of mistake this seed used to risk.
-- v1 IS STILL v1, AND THE TWO HASHES CHANGED. Reason for fixing v1 in place instead of
-- shipping a v2: v1 never reached a data subject. The migration had not been run, the
-- `consent_version` column did not exist and the code that writes it was undeployed, so
-- there is no row anywhere whose evidence points at the old wording — and a version
-- registry built to describe versions nobody ever saw is machinery bought with nothing.
-- The reasoning is recorded in consent.v1.json's `_versioningNote`. Two lines changed:
-- the "und dem Blog" / "and the blog" half of the news topic is gone (it named a medium
-- the notice already names). Both sha256 values above are recomputed over the edited
-- textLines and replaced everywhere they appear: consent.v1.json, this seed, and the
-- generator's and the gate's FROZEN_SHA256 constants.
-- `on conflict do nothing` keeps reruns harmless: consent wordings are append-only, a
-- changed text would be a new version, never an update. Consequence for the address: a
-- row seeded by an earlier run while the column was still the marker is repaired by the
-- backfill at the top of this file, never by editing the wording or the hashes:
--   update public.waitlist_consent_texts
--   set controller_email = 'barnerd_info@proton.me'
--   where version = 'bcb-2026-10-12.v1' and controller_email = '__CONTROLLER_EMAIL__';
insert into public.waitlist_consent_texts
  (version, controller_email, media, purposes, text_de, text_en, sha256_de, sha256_en, effective_from)
values (
  'bcb-2026-10-12.v1',
  'barnerd_info@proton.me',
  'email',
  array['rm-beta', 'roast-beta', 'news'],
  $$Verantwortlicher: Bernardo Pingarrón, __CONTROLLER_EMAIL__

Ich willige ein, dass BarNerd mir per E-Mail Informationen zu den von mir
ausgewählten Themen sendet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO.
Zur Auswahl stehen:

  [ ] Beta des Recipe Managers
  [ ] Beta von ROAST
  [ ] Neuigkeiten zu BarNerd

Ich kann diese Einwilligung jederzeit ohne Angabe von Gründen formlos
widerrufen, per E-Mail an __CONTROLLER_EMAIL__. Der Widerruf wirkt für die
Zukunft. Danach lösche ich die E-Mail-Adresse; den Nachweis, dass und worin
ich eingewilligt habe, bewahre ich für die Dauer der gesetzlichen Fristen
(3 Jahre) auf, auf Grundlage von Art. 6 Abs. 1 lit. c und lit. f DSGVO.

Zur Bestätigung sende ich einmalig eine E-Mail mit einem Bestätigungslink
(Double-Opt-In). Diese Bestätigungs-E-Mail enthält keine Werbung. Erst nach
der Bestätigung sende ich weitere Nachrichten.

Weitere Informationen zu Empfängern, Speicherdauer und meinen Rechten:$$,
  $$Controller: Bernardo Pingarrón, __CONTROLLER_EMAIL__

I consent to BarNerd sending me email about the topics I select below. The
legal basis is Art. 6(1)(a) GDPR. The topics are:

  [ ] Recipe Manager beta
  [ ] ROAST beta
  [ ] News about BarNerd

I can withdraw this consent at any time, without giving reasons, informally
by email to __CONTROLLER_EMAIL__. Withdrawal applies going forward. After
that I delete the address; I keep the proof of what I consented to for the
statutory limitation period (3 years), on the basis of Art. 6(1)(c) and (f)
GDPR.

To confirm, I send one email with a confirmation link (double opt-in). That
confirmation email contains no advertising. Only after confirmation do I send
further messages.

More information on recipients, retention and my rights:$$,
  'b640a9a1c845353caa3ca3229e120ff74cd2b130f54f1762aadf015b04b133aa',
  '9cc8dfd32a16b5f4e2abac62d4517700904e8df429a979f38b4f873c6c35ca90',
  timestamptz '2026-10-12 00:00:00+02:00'
)
on conflict (version) do nothing;

-- The evidence columns on the waitlist itself. One column per fact, because the facts
-- have different lifetimes: the version is immutable, the token expires, the
-- confirmation timestamp is written by the Edge Function and never by the client.
alter table public.waitlist
  add column if not exists consent_version  text references public.waitlist_consent_texts(version),
  add column if not exists source           text,
  add column if not exists confirmed_at     timestamptz,
  add column if not exists confirm_token    text,
  add column if not exists confirm_sent_at  timestamptz,
  add column if not exists confirm_expires_at timestamptz;

comment on column public.waitlist.consent_version is 'The version of the consent text this row was ticked under. FK to waitlist_consent_texts. Null only on rows captured before this migration — those are not provably consented and may not be used for follow-up.';
comment on column public.waitlist.source is 'Which capture surface wrote the row, e.g. bcb-2026. Identifies the moment, not the wording — the wording is consent_version.';
comment on column public.waitlist.confirmed_at is 'Set by the waitlist-confirm Edge Function when the visitor clicks the link. Null means not double-opted-in: no message may be sent.';
comment on column public.waitlist.confirm_token is 'One-shot token minted client-side at insert, sent in the confirmation link. Unique, so a token can never match two rows.';
comment on column public.waitlist.confirm_sent_at is 'When the client handed the token to the mail path. Records the dispatch attempt; whether mail actually left is the mail path''s own record, and a row still unconfirmed is by definition one whose mail was never clicked.';
comment on column public.waitlist.confirm_expires_at is 'confirm_sent_at plus 7 days. A token minted at the fair and clicked three weeks later does not confirm anything.';

-- The token is single-use by construction: unique, and only while it exists. The partial
-- index lets a failed token simply be null rather than an error on insert.
create unique index if not exists idx_waitlist_confirm_token
  on public.waitlist (confirm_token)
  where confirm_token is not null;

-- The operational edge: every row still awaiting confirmation, i.e. exactly the rows the
-- 30-day deletion rule applies to and the rows an operator may resend by hand.
create index if not exists idx_waitlist_awaiting_confirmation
  on public.waitlist (confirmed_at)
  where confirmed_at is null;

-- ============================================================
-- The retired session_id column, dropped here rather than in a
-- file of its own
-- ============================================================
-- WHY THE DROP LIVES IN THIS UNRUN MIGRATION:
--   This file has not been run anywhere yet, so folding the drop in means one hand-run
--   migration instead of two. `if exists` keeps a re-run harmless on a database where the
--   column is already gone. Postgres drops the dependent index (`idx_waitlist_session`)
--   automatically with the column, so no `drop index` is needed — and the base migration no
--   longer creates that index, because `create index if not exists` on a dropped column
--   fails on every re-run of that hand-run apply script.
-- WHY THE ORDER MATTERS AND IS NOT NEGOTIABLE:
--   Both writers (`src/lib/waitlist.ts`, `scripts/build-bcb-standalone.mjs`) stopped sending
--   the key in the same change. If this statement ran while any client still sent
--   `session_id`, PostgREST would reject the whole insert — the capture breaks completely.
--   The column and the payloads are one release, not two.
-- WHY NOT KEEP IT AS A DEAD COLUMN: a nullable column nobody writes is an invitation for the
--   next reader to reconnect it, and this one stored a per-browser identifier next to a real
--   address, which is precisely what made the product's anonymity promise false.
alter table public.waitlist drop column if exists session_id;

-- ============================================================
-- Retention, enforced by pg_cron
-- ============================================================
-- WHY A JOB AND NOT A NOTE: the notice promises deletion at 30 days, and until now nothing
-- implemented it anywhere (see the header). The job below is the implementation of that
-- promise, plus the explicit outer bound (18 months) that the old "until the beta concludes"
-- wording never had. It is dispatched by the database, so it does not depend on anyone
-- remembering, and it stops when the project is paused — which is honest, because a paused
-- project processes nothing either.
-- WHY IT IS GUARDED: `create extension` is not run here — enabling an extension is the
-- operator's act in the Supabase dashboard, and a migration that tries and fails takes the
-- rest of this file down with it. The block below detects the extension and either schedules
-- the job or says, loudly, that retention is NOT scheduled and how to fix it. Silence here
-- would be the same failure this whole section exists to correct.
-- WHY THE JOB RE-CREATES ITSELF EVERY RUN: `cron.unschedule` by name then `cron.schedule` is
-- the idempotent shape Supabase documents; scheduling twice under one name would fail, and
-- leaving a stale definition in place would make this file's text stop describing
-- production.
do $retention$
declare
  v_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'RETENTION NOT SCHEDULED: pg_cron is not enabled in this project. Enable it (Supabase dashboard > Database > Extensions > pg_cron) and re-run this file, or schedule the same delete by hand.';
    raise notice 'Until it is scheduled, delete unconfirmed rows older than 30 days and confirmed rows older than 18 months yourself — the promise in datenschutz.html depends on it.';
  else
    for v_job_id in select jobid from cron.job where jobname = 'waitlist-retention' loop
      perform cron.unschedule(v_job_id);
    end loop;

    -- 03:23 UTC — quiet hour, fixed minute, no meaning beyond that.
    perform cron.schedule('waitlist-retention', '23 3 * * *', $job$
      delete from public.waitlist
      where (confirmed_at is null and created_at < now() - interval '30 days')
         or (confirmed_at is not null and confirmed_at < now() - interval '18 months');
    $job$);

    raise notice 'RETENTION SCHEDULED: waitlist-retention deletes unconfirmed rows after 30 days and confirmed rows after 18 months (daily, 03:23 UTC).';
  end if;
end
$retention$;

-- Published legal text: readable by anon, on purpose. Everything else keeps the base
-- migration's posture — insert without select.
grant select on public.waitlist_consent_texts to anon;

alter table public.waitlist_consent_texts enable row level security;

drop policy if exists "Anyone can read the published consent texts" on public.waitlist_consent_texts;
create policy "Anyone can read the published consent texts"
  on public.waitlist_consent_texts
  for select
  to anon
  using (true);

-- `using`, NOT `with check`. WITH CHECK applies only to INSERT and UPDATE policies; a SELECT
-- policy takes USING. The previous spelling was rejected by the server with
-- `ERROR: 42601: WITH CHECK cannot be applied to SELECT or DELETE`, which made this whole file
-- unrunnable. For a permissive SELECT policy to anon, `using (true)` permits every row — the
-- published wording is meant to be read, which is the point of storing it.

-- No select policy for anon on public.waitlist: still intentional, see base migration.

-- ============================================================
-- Done. The app's write path is now:
--   supabase.from('waitlist').insert({
--     email, interests,
--     consent_version, source, confirm_token, confirm_sent_at, confirm_expires_at
--   })
-- followed by a POST of the token to
--   ${VITE_SUPABASE_URL}/functions/v1/waitlist-confirm-request
-- which reads the controller address back from waitlist_consent_texts.controller_email
-- (one home for the address; no CONTROLLER_EMAIL secret) and reports honestly on the
-- mail path: non-2xx — loudly — whenever it cannot send, and 200 with mailed:false when
-- no mail is due (already confirmed), never a success that implies a mail left.
-- The same payload without the consent columns is what the standalone page sends; neither
-- writer sends `session_id` any more, which is why the drop above and their change are one
-- release.
-- ============================================================
