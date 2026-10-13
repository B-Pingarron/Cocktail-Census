# Supabase Edge Functions — BCB 2026 double opt-in (T6)

Two Edge Functions complete the double opt-in:

| Function | Method | What it does |
|---|---|---|
| `waitlist-confirm-request` | `POST { token }` | Looks the waitlist row up by its confirm token and sends exactly **one ad-free** confirmation email via Resend. Called by the app (`src/lib/waitlist.ts`) and by the standalone BCB page right after a successful insert. |
| `waitlist-confirm` | `GET ?token=...` | The link in that email. Sets `confirmed_at` (idempotent — a second click succeeds and re-sends nothing) and shows a small standalone bilingual page. |

Both are plain Deno/TypeScript with no npm dependencies. The confirmation mail body is
built inline in `waitlist-confirm-request/index.ts` (`buildConfirmationEmail`) — read it
before every deploy; it must stay free of advertising (BGH VI ZR 134/15).

## Project reference

The Supabase project ref is the subdomain of `VITE_SUPABASE_URL` in
`01_BarNerd/apps/census/.env.production`:

    kmkgovzuosixyiconpzq

(If that env file ever changes, the ref changes with it. Do not paste the anon key
anywhere in this repo — the pre-flight gate `scripts/check-consent-ready.mjs` scans this
folder for keys and will fail the build if one appears.)

## Deploy

From `01_BarNerd/apps/census` (the Supabase CLI needs `npx supabase@2.120.0` on this
machine; log in once with `npx supabase@2.120.0 login` and the project does not need to
be "linked" for a direct deploy):

```bash
npx supabase@2.120.0 functions deploy waitlist-confirm-request --project-ref kmkgovzuosixyiconpzq --no-verify-jwt
npx supabase@2.120.0 functions deploy waitlist-confirm        --project-ref kmkgovzuosixyiconpzq --no-verify-jwt
```

**Why `--no-verify-jwt`:** neither endpoint is called with a Supabase Auth JWT. The app
calls `waitlist-confirm-request` with a bare `fetch` (ADR-035: no Auth, no sessions), and
`waitlist-confirm` is opened from an email client that sends no headers at all. The
confirm token in the request is the only authority, and it is single-use, UUID-random,
expiring after 7 days, and rate-limited. If you ever add Auth to this project, revisit
this flag deliberately — do not flip it by habit.

**Deploy uploads only the function's own directory.** The deployed function cannot read
`src/legal/consent.v1.json`. That is why the controller address is not imported from it:
`waitlist-confirm-request` reads the address back from `waitlist_consent_texts` — the
table seeded by `src/db/add-waitlist-consent-evidence.sql` — joined on the waitlist row's
`consent_version`. The address has exactly one authored home (`controller.email` in the
JSON, seeded into that table), and there is no `CONTROLLER_EMAIL` secret on the mail path:
a secret would be a second home, and a second home is the thing that silently never gets
set.

## Secrets

Required — the mail-sending path (`waitlist-confirm-request`) needs both:

```bash
npx supabase@2.120.0 secrets set RESEND_API_KEY   # the re_… key from the Resend dashboard
npx supabase@2.120.0 secrets set RESEND_FROM="BarNerd <bestaetigung@YOUR-VERIFIED-DOMAIN>"
```

Optional:

```bash
npx supabase@2.120.0 secrets set NOTICE_URL       # only if the standalone host, not the app, is the canonical notice
npx supabase@2.120.0 secrets set CONTROLLER_EMAIL # only for the waitlist-confirm PAGE; see below
```

`NOTICE_URL` defaults to the app's deployed Art. 13 notice
(`https://b-pingarron.github.io/Cocktail-Census/datenschutz.html`).

- **There is NO `CONTROLLER_EMAIL` secret on the mail path.** The address that becomes the
  email's `reply_to` — the withdrawal route, one reply away (DSK Orientierungshilfe
  Direktwerbung § 5.3) — is read from `waitlist_consent_texts.controller_email`, joined on
  the waitlist row's `consent_version`. That table is seeded from `controller.email` in
  `src/legal/consent.v1.json` by `src/db/add-waitlist-consent-evidence.sql`, and the gate
  (`node scripts/check-consent-ready.mjs`) compares the two, so the address has one home
  and the two can never drift apart silently. If the row's `consent_version` resolves to an
  empty or still-marker `controller_email`, `waitlist-confirm-request` answers **503
  `mail-not-configured`** (naming `waitlist_consent_texts.controller_email` in `missing`) —
  it never sends with a placeholder or with a withdrawal route that goes nowhere.
- **`CONTROLLER_EMAIL` is optional, and only helps the `waitlist-confirm` page.** That
  click-through page names the withdrawal address on the confirmation screen; with the
  secret set it shows the address, and without it the page still confirms and points at the
  confirmation email's sender instead. It is not needed to send the mail, so forgetting it
  cannot break the double opt-in.
- **`RESEND_FROM` must not be a no-reply address** and must sit on the verified sending
  domain. The function refuses a `RESEND_FROM` matching /no-?reply/i with **503
  `no-reply-sender-forbidden`**.

## Verified sending domain (SPF/DKIM) — required before the first real send

In the Resend dashboard: add your domain, publish the DNS records (SPF, DKIM, and the
return-path MX), wait for the green "Verified" state, and only then set `RESEND_FROM` to
an address on that domain. A confirmation email from an unverified domain lands in spam
or is rejected outright — and a DOI email nobody receives is a DOI that never happens.
Test with your own mailbox first and check the received message's headers actually show
SPF/DKIM pass.

## What happens while the secrets are unset (today)

Nothing fails silently, and nothing pretends:

1. Capture still works. The row is inserted first, with `consent_version`, `source`,
   `confirm_token`, `confirm_sent_at`, `confirm_expires_at`.
2. The app then POSTs the token to `waitlist-confirm-request`. Until `RESEND_API_KEY` and
   `RESEND_FROM` are set it answers **503 `{"error":"mail-not-configured", ...}`**, naming
   the missing variables; if the row's `consent_version` does not resolve to a filled
   `controller_email` it answers the same 503, naming
   `waitlist_consent_texts.controller_email`. Either way the client treats it as exactly
   what it is and shows **"stored, confirmation email could NOT be sent"** — never a false
   success. (Non-2xx is the failure signal, and the endpoint reserves `mailed: true` for an
   actual send, so a `mailed: false` 2xx is read as "not sent" too.)
3. Every such row stays `confirmed_at is null`, i.e. not usable for follow-up, and is
   deleted after 30 days per the retention rule. The operator fallback (send the
   confirmation by hand, ad-free, and treat only clickers as consented) is documented in
   `legal/bcb-2026/README.md`.

## End-to-end test — run this before handing the phone to anyone

1. `node scripts/check-consent-ready.mjs` from the repo root must be green (controller
   email filled, hashes consistent, standalone output current, no secrets committed).
2. Open the deployed capture page, submit your **own** address with one topic ticked.
   You must see "stored, confirmation email requested".
3. The email must arrive within seconds, from the verified domain, with `reply_to` equal
   to the filled `controller_email` in `waitlist_consent_texts` — the same address held in
   `controller.email` in `src/legal/consent.v1.json`. **Read the body**: it must contain
   only the confirmation content — no promo, no pitch, no social links.
4. Click the link: the confirmation page appears. Click it **again**: the same page, no
   error, and the row's `confirmed_at` does not change (`select confirmed_at from
   waitlist where email = '…'`).
5. Rate limit: call the endpoint twice in quick succession with the same token and watch
   the second answer 429:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     https://kmkgovzuosixyiconpzq.supabase.co/functions/v1/waitlist-confirm-request \
     -H "Content-Type: application/json" -d '{"token":"<a-fresh-uuid-from-a-capture>"}'
   ```

6. Error paths: a made-up token answers 404; setting `confirm_expires_at` into the past
   in the table editor and re-requesting answers 410, and opening the link answers with
   the plain expired page.
7. Negative config test (optional but honest): temporarily remove a secret, capture, and
   confirm the app shows "stored, confirmation email could NOT be sent" — then restore
   it. This proves constraint 2 end to end instead of assuming it.

## Support / legal context

Spec: `odd/tasks/barnerd-bcb-consent.md` (T6). The confirmation mail carries no
advertising because BGH VI ZR 134/15 makes an advertised confirmation unlawful
advertising — and unlawful advertising in the DOI mail would destroy the consent the DOI
exists to establish. Legal analysis, not legal advice.
