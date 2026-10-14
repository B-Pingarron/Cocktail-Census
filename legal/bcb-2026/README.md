# BarNerd — BCB 2026 standalone consent page

A self-contained, build-free consent page for capturing Bar Convent Berlin 2026
waitlist contacts. Plain HTML, inline CSS, inline JS. No framework, no build
step, no CDN, no external font, no analytics, no cookie — deployable to any
static host in minutes, independent of the main app's deploy path.

Everything here lives inside the **census repo** (`01_BarNerd/apps/census`): this
folder, the generator, the canonical legal text and the app's own notice copy.
One repository, one review surface, no path that climbs out of it. **Every path
and command below is relative to the census repo root.**

It writes to the **same** Supabase `waitlist` table as the app used to, with the same
consent-evidence columns (`consent_version`, `source`, `confirm_token`,
`confirm_sent_at`, `confirm_expires_at`) and the same honest double-opt-in
flow. **It is the only capture surface now:** the app's own ask is switched off
(2026-10-12, ADR-036), and neither writer sends the retired `session_id` any
more — the column is dropped by the second migration below.

## Files in this folder

| File | What it is |
|---|---|
| `index.html` | **GENERATED.** Do not hand-edit. See "Regenerating". |
| `datenschutz.html` | **GENERATED** — the standalone page's FULL Art. 13 notice, from `src/legal/datenschutz.template.html` in this repo, contact marker substituted. Do not hand-edit. |
| `config.example.js` | Template for the operator's `config.js`. Committed. |
| `config.js` | The real config. **You create it; it is git-ignored; never commit it.** |
| `README.md` | This runbook. |

The legal wording has **one source of truth**: `src/legal/consent.v1.json`
(in this same repo). The generator reads it and embeds the German and English
blocks byte-verbatim, verifying the frozen sha256 hashes on every run. Editing
the wording in `index.html` would create exactly the legal-text drift this
feature exists to prevent — so never do it.

The **app has its own, separate notice** at `apps/census/public/datenschutz.html`
(the URL `/datenschutz.html` on the deployed app). It is a short notice about the
random browser identifier the app stores, and it is **not** a copy of this
folder's notice — the app captures no addresses any more. Both are emitted by the
same generator; neither is hand-edited.

## Before you deploy — the pre-flight list

Nothing goes live until **every** line here is checked:

1. **`__CONTROLLER_EMAIL__` filled in the JSON.** In
   `src/legal/consent.v1.json`, set
   `controller.email` to the real contact address. Then **regenerate** (below)
   and confirm the generator's output no longer prints the `!! WARNING` lines.
   While the marker is unfilled, both generated pages show a loud red warning
   and `index.html` **refuses to submit**. A legal notice naming a placeholder
   contact is not a legal notice.
2. **`config.js` filled.** `cp config.example.js config.js`, then fill
   `supabaseUrl` and `supabaseAnonKey` from `.env.production` at the census repo
   root (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Placeholders are
   detected and are a hard failure.
3. **Migrations run** in the Supabase SQL editor, in the order given below.
   **`pg_cron` enabled first** (Database → Extensions) — the second migration schedules the
   retention job and skips itself, with a notice, if the extension is missing.
4. **Pre-consent `waitlist` rows deleted.** The rows that predate the consent columns
   are the operator's own test rows (confirmed deletable, 2026-10-12) and carry no
   provable consent: a row written before `consent_version` existed has no stored text,
   version, or hash behind it, so it cannot be relied on for follow-up. Delete exactly
   those rows — scoped, not a blanket wipe — in the Supabase SQL editor, after the
   migrations from step 3:

   ```sql
   delete from public.waitlist where consent_version is null;
   ```

5. **Retention job verified.** The second migration prints one of two notices: either
   `RETENTION SCHEDULED: waitlist-retention …` or `RETENTION NOT SCHEDULED: pg_cron is not
   enabled …`. The first is the one you want; the second means nothing is deleting rows and
   `datenschutz.html` is promising something no machine delivers. Check it in the SQL editor
   output, and confirm the job exists:

   ```sql
   select jobname, schedule, command from cron.job where jobname = 'waitlist-retention';
   ```

6. **One real end-to-end test submission.** Open the deployed page, use your
   own address, tick one box, submit, and confirm the confirmation email
   actually arrives and the link works. Do this before handing the phone to
   anyone.
7. **Notice reachable.** Open `./datenschutz.html` from the deployed URL and
   check the contact address in it is the real one, not the marker.

### The same list, run by the machine

Steps 1, 2 and 6's structural half are checked automatically. From the census
repo root:

```bash
node scripts/check-consent-ready.mjs
```

It exits non-zero on any failure, prints one line per check, and re-runs the
generator in a scratch copy of the tree to prove the committed output is not
stale. **Green is the bar.**

## Configure

```bash
cd legal/bcb-2026
cp config.example.js config.js
# then edit config.js — two values from .env.production at the census repo root
```

- `supabaseUrl` — e.g. `https://abcdefgh.supabase.co`
- `supabaseAnonKey` — the anon (publishable) key; it is meant to ship in a
  browser, but your rule is no hardcoded keys, so it lives only in the
  git-ignored `config.js`
- `confirmFunctionUrl` — **optional.** Leave `""` to default to
  `<supabaseUrl>/functions/v1/waitlist-confirm-request`

## Database — run these in the Supabase SQL editor, in this order

1. `src/db/add-waitlist-table.sql` — the base `waitlist` table. Skip if it already
   exists (the app's waitlist is live, so it does). It no longer creates the retired
   `session_id` column or its index; the second migration drops the column on a database
   that still has it.
2. `src/db/add-waitlist-consent-evidence.sql` — the consent-evidence columns, the
   `waitlist_consent_texts` table (seeded with the verbatim wording and the two
   sha256 hashes), the confirm-token index, the **drop of the retired `session_id`
   column** and the **`pg_cron` retention job**. Idempotent; safe to re-run.

Both files are run by hand (the repo has no Supabase CLI linkage). Read the
header comments once — they explain the retention the job now enforces, rather
than the rule you are agreeing to operate: unconfirmed rows are deleted 30 days after
they were written, and confirmed rows 18 months after confirmation.

**Retention is machine-enforced from now on.** This used to be a promise in the notice with
nothing behind it (the migration itself admitted "enforced operationally"). The schedule is
inside `add-waitlist-consent-evidence.sql`; if `pg_cron` is not enabled, the file says so
loudly and you must delete those rows yourself until it is.

## Deploy

The folder `legal/bcb-2026/` (inside the census repo) **is** the site. It needs
no build, no node, no npm — you only ever need node on this machine to
*regenerate*, never to deploy.

Copy the folder to any static host, **including `config.js`**:

- **Netlify Drop** — drag the folder onto <https://app.netlify.com/drop>.
- **Cloudflare Pages** — create a project, upload the folder via the dashboard
  (or `wrangler pages deploy`).
- Any static host (S3, a VPS, GitHub Pages on a *separate* repo): upload the
  folder's contents.

**What the QR code must point at:** the deployed URL of `index.html` — e.g.
`https://bcb2026.example.com/` (the folder root). Point the QR at the page
root, not at `datenschutz.html`; the notice is one tap away from the page and
also reachable directly.

Host this on a domain of your own choosing; anything Cloudflare/Netlify free
tier is fine. There are no cookies and no trackers, so no cookie banner is
needed.

**One link assumption to know about.** The app's own notice (`/datenschutz.html` on the app)
points at `./bcb-2026/datenschutz.html` for the full email-capture notice. That resolves only
if this folder is also served at `<app-root>/bcb-2026/`. If you deploy this folder somewhere
else, tell the app side so the link can be corrected — the notice is still reachable from the
page that captured the address (the link on `index.html`), so nothing is hidden, but a
mislabelled link in a privacy notice is still worth fixing.

## After deploy — verify

1. Open the page on a phone (not just the laptop).
2. The red configuration error banner must be **absent**. If it is present it
   tells you exactly what is missing — fix it, do not work around it.
3. Submit a real address. You must see one of three truthful messages:
   - **stored, confirmation email requested** — the normal path.
   - **stored, confirmation email could NOT be sent** — the contact exists and
     is valid; no message will reach the visitor until they confirm. See the
     fallback below.
   - **NOT stored** — nothing was written; retry.

## Regenerating (only when the legal text changes)

The generated files ship committed, so nobody needs node at deploy time. Only
when `consent.v1.json` changes (including filling in the controller email),
from the census repo root:

```bash
node scripts/build-bcb-standalone.mjs
```

The generator verifies the recomputed sha256 of both consent blocks against the
stored **and** frozen hashes and fails loudly on any divergence. It writes three
files, all inside the census repo: `legal/bcb-2026/index.html`,
`legal/bcb-2026/datenschutz.html` (the standalone Art. 13 notice) and
`public/datenschutz.html` (the app's short identifier notice — a different
document, not a copy). Then re-run the
pre-flight list (or `node scripts/check-consent-ready.mjs`).

## Fallback — when the mail path is not configured (no automatic double opt-in)

The confirmation mail goes through an Edge Function
(`waitlist-confirm-request`) that needs a Brevo account, an API key and a
verified sender address. If any of that is missing on the day, the
page still **stores** every contact and honestly reports "stored, confirmation
not sent". Capture never depends on the mail path being up.

To catch up afterwards, by hand:

1. In the Supabase table editor (or SQL), export the rows that are still
   unconfirmed — `confirmed_at is null`. The confirm token is already stored
   in each row (`confirm_token`), minted at capture.
2. For each row, send the confirmation email yourself: a plain, **ad-free**
   email containing the confirmation link the Edge Function would have sent
   (token in the link), addressed from your own mail account. The token
   expires 7 days after `confirm_sent_at` — rows older than that are dead and
   must be re-captured in person, not reused.
3. When someone clicks through, set `confirmed_at` in their row (the deployed
   `waitlist-confirm` function does this; until it is deployed, you do it by
   hand in the table editor).

**This fallback is weaker than an automatic double opt-in, and here is why
plainly:** the point of double opt-in is that the *mailbox owner's own click*
proves the address is theirs and that they wanted the mail — that is what makes
the consent defensible later. An email you send by hand proves you sent it; it
does not, by itself, prove the person who typed the address at the fair owned
it. Anyone can type someone else's address into a form. Until the click
happens, the row is **not** confirmed, and an unconfirmed row may not be used
for follow-up — exactly like the 30-day deletion rule assumes. Send the
catch-up mails; treat only the clickers as consented.

## Support / legal context

The wording and flow implement the spec in `odd/tasks/barnerd-bcb-consent.md` (in the
Project Central workspace, outside this repo) — DSK Orientierungshilfe Direktwerbung
§§ 3.1–3.7, § 7 Abs. 2 Nr. 2 UWG, Art. 6/13 DSGVO. The app-side decisions (the app is not a
capture surface; the session identifier is informed, not consented) are ADR-036 in the
parent repo, `docs/adr/`. Legal analysis, not legal advice.
