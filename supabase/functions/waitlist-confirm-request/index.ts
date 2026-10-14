// waitlist-confirm-request — the outgoing half of the double opt-in.
//
// WHAT THIS DOES:
//   POST { token } → looks the waitlist row up by its confirm token (service role) and
//   sends exactly one confirmation email to the stored address via Brevo. It is not
//   Supabase Auth, not a magic link, not a session — the token was minted client-side at
//   insert (src/lib/waitlist.ts); this function only spends it.
//
// WHY EVERY CONFIGURATION ERROR IS A NON-2xx HERE:
//   The client (src/lib/waitlist.ts and the standalone page) decides between "stored +
//   sent" and "stored + not sent" purely by this function's HTTP status. A 200 while the
//   mail did not leave would make the app tell a stranger their confirmation is on its
//   way — the exact lie this whole feature exists to prevent. So: unconfigured → 503 with
//   a machine-readable reason, a provider failure → 502, and 200 is reserved for "the
//   provider accepted the mail" or "already confirmed" (where no mail is due at all).
//
// WHY THE CONFIRMATION MAIL CONTAINS NO ADVERTISING (the hardest rule here):
//   A confirmation email that advertises is advertising without prior consent —
//   BGH VI ZR 134/15 — and it destroys the very protection the DOI is meant to
//   establish. The body states what is being confirmed, restates the topics the person
//   ticked, carries the confirmation link, names the withdrawal route, links the Art. 13
//   notice, and signs with the controller's name. Nothing else. No promo line, no product
//   pitch, no "follow us in the meantime", no logo. Anything anyone is tempted to add to
//   that body belongs in a separate email that fires only after waitlist-confirm has set
//   confirmed_at — never in this one.
//
// WHY reply_to IS THE CONTROLLER AND THE SENDER IS NOT A NO-REPLY:
//   DSK Orientierungshilfe Direktwerbung § 5.3 treats no-reply senders as a risk
//   precisely because they cut off the data subject's withdrawal route. Withdrawal must
//   stay one reply away, so `reply_to` is the controller address authored as
//   `controller.email` in src/legal/consent.v1.json. A deployed Edge Function cannot read
//   that file (`supabase functions deploy` uploads only this function's directory), so the
//   address is read back from the database instead: the seed in
//   src/db/add-waitlist-consent-evidence.sql copies controller.email into
//   waitlist_consent_texts.controller_email, this function joins that table on the
//   waitlist row's consent_version, and the address therefore has exactly one authored
//   home. There is deliberately no CONTROLLER_EMAIL secret: a secret would be a second
//   home, and a second home is precisely the thing that silently fails to be set. A row
//   whose consent_version resolves to an empty or still-marker controller_email fails as
//   loudly as a missing API key — this function never sends to a placeholder, and a
//   MAIL_FROM that looks like a no-reply address is refused outright.
//
// CORS, AND THE TRADEOFF ACCEPTED:
//   This endpoint is called from the app (GitHub Pages) and from the standalone BCB page
//   on a static host whose origin cannot be known in advance, so the origin is allowed
//   broadly rather than enumerated. The tradeoff, stated plainly: the request carries no
//   credentials — no cookie, no Authorization header — and the single-use, expiring
//   confirm token in the body is the only authority it carries. A hostile page that had
//   already stolen a token could trigger one confirmation mail to the address that token
//   belongs to; it could not read any data back beyond this endpoint's own status codes,
//   and the rate limit below bounds even that. Enumerating origins would buy little
//   security and break the standalone page the moment its host changes.

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, ...extra },
  });

/** The marker from consent.v1.json. A reply_to still carrying this is a failure, not a value. */
const MARKER = "__CONTROLLER_EMAIL__";

/** One mail per token per two minutes. Long enough to blunt a mail bomb, short enough
 *  for an honest "resend after it vanished in spam" to work. */
const RATE_WINDOW_MS = 2 * 60 * 1000;

/** The token is a crypto.randomUUID() on the client. Enforcing the shape doubles as the
 *  injection guard: the token goes into PostgREST query strings, and only hex and hyphens
 *  may reach them. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Topic labels, mirrored from consent.v1.json. The Edge Function cannot import that file
 * (the deploy uploads only this directory), so the three labels live here as well. They
 * are presentation only — the hashed consent blocks are untouched by this mirror — and
 * the mail body re-states exactly what the row says the person ticked, nothing more.
 * Keep in sync with consent.v1.json `labels` if the purposes ever gain a v2.
 */
const TOPIC_LABELS: Record<string, { de: string; en: string }> = {
  "rm-beta": { de: "Beta des Recipe Managers", en: "Recipe Manager beta" },
  "roast-beta": { de: "Beta von ROAST", en: "ROAST beta" },
  news: { de: "Neuigkeiten zu BarNerd und dem Blog", en: "News about BarNerd and the blog" },
};

/** Canonical order, so the mail lists topics in the order the form presented them. */
const TOPIC_ORDER = ["rm-beta", "roast-beta", "news"];

/**
 * Rate-limit layer 1: a per-token timestamp in this isolate's memory. It is the layer
 * that refuses a second click two seconds later without touching the network.
 *
 * Layer 2 is the atomic claim in the handler below (a conditional UPDATE), which makes
 * two *concurrent* invocations across isolates race for one slot instead of both sending.
 *
 * THE ACCEPTED GAP: the frozen schema (add-waitlist-consent-evidence.sql) has no
 * dedicated "last send by the mail path" column — confirm_sent_at is written by the
 * client at insert to record the dispatch *attempt*, and re-purposing it for the rate
 * limit would refuse the very first send. So a sequential duplicate that lands in a
 * *cold* isolate after the in-memory window expired could send one extra copy of a
 * no-advertising confirmation mail to the same address. Bounded by the 7-day token TTL,
 * harmless to the DOI (waitlist-confirm is idempotent), and fixable later with one
 * column (mail_sent_at) in a future migration — not with a change in this file.
 */
const lastSendByToken = new Map<string, number>();

const pruneRateWindow = () => {
  const now = Date.now();
  for (const [token, sentAt] of lastSendByToken) {
    if (now - sentAt > RATE_WINDOW_MS) lastSendByToken.delete(token);
  }
};

type WaitlistRow = {
  email: string;
  interests: string[] | null;
  consent_version: string | null;
  confirmed_at: string | null;
  confirm_sent_at: string | null;
  confirm_expires_at: string | null;
};

const postgrestUrl = (path: string) => `${Deno.env.get("SUPABASE_URL") ?? ""}/rest/v1/${path}`;

const serviceHeaders = (key: string, extra: Record<string, string> = {}) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  ...extra,
});

/** Format the expiry for the mail: unambiguous UTC, no locale guessing in a legal mail. */
const formatExpiry = (iso: string) => new Date(iso).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");

/**
 * Parse MAIL_FROM into the two fields Brevo wants SEPARATELY.
 *
 * WHY THIS EXISTS AT ALL: Resend accepted the whole `"Name <addr>"` string in one `from`
 * field. Brevo's transactional API takes `sender: { name, email }` as an object, so the
 * shape the operator writes in the secret has to be split here rather than passed through.
 * Accepts both `Name <addr>` and a bare address; a bare address simply carries no name —
 * it is NOT guessed from the local part, because a wrong display name in a confirmation
 * mail is worse than none.
 */
const parseFrom = (raw: string): { name?: string; email: string } => {
  const angled = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angled) {
    const name = angled[1].trim().replace(/^"|"$/g, "");
    const email = angled[2].trim();
    return name ? { name, email } : { email };
  }
  return { email: raw.trim() };
};

/**
 * The confirmation email body, in full. Bilingual (German, then English), plain text,
 * and — see the header comment — legally incapable of containing advertising without a
 * deliberate edit to this function. It states what is being confirmed, restates the
 * topics the person ticked, links the confirmation, says how to withdraw, links the
 * Art. 13 notice, and signs. Nothing else may be added here.
 */
const buildConfirmationEmail = (args: {
  confirmUrl: string;
  expiresAt: string;
  topics: { de: string; en: string }[];
  controllerEmail: string;
  noticeUrl: string;
}) => {
  const topicLines = args.topics.length
    ? args.topics.map((t) => `  - ${t.de} / ${t.en}`).join("\n")
    : "  - (alle ausgewählten Themen / all ticked topics)";

  const text = `BarNerd — Bestätigungs-E-Mail / Confirmation email

Hallo / Hello,

diese E-Mail-Adresse wurde für die BarNerd-Warteliste (Bar Convent Berlin 2026)
eingetragen. Der Eintrag wird erst mit dem Klick auf den Bestätigungslink unten
wirksam (Double-Opt-in). Diese E-Mail dient ausschließlich dieser Bestätigung.

This email address was added to the BarNerd waitlist (Bar Convent Berlin 2026).
The signup becomes effective only when you click the confirmation link below
(double opt-in). This email serves that confirmation only.

Themen, die Sie angekreuzt haben / Topics you ticked:
${topicLines}

Bestätigungslink, gültig bis ${formatExpiry(args.expiresAt)} / Confirmation link, valid until then:
${args.confirmUrl}

Diese Bestätigungs-E-Mail enthält keine Werbung.
This confirmation email contains no advertising.

Sie können die Einwilligung jederzeit ohne Angabe von Gründen formlos widerrufen,
per E-Mail an ${args.controllerEmail}. Der Widerruf wirkt für die Zukunft.
You can withdraw this consent at any time, without giving reasons, informally by
email to ${args.controllerEmail}. Withdrawal applies going forward.

Datenschutzhinweise (Art. 13 DSGVO / Art. 13 GDPR):
${args.noticeUrl}

Bernardo Pingarrón
Verantwortlicher / Controller`;

  return {
    subject: "BarNerd: Bitte bestätigen Sie Ihre E-Mail-Adresse / Please confirm your email address",
    text,
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "method-not-allowed", expected: "POST" });
  }

  let token: unknown;
  try {
    ({ token } = await request.json());
  } catch {
    return json(400, { ok: false, error: "bad-request", detail: "body must be JSON: { token }" });
  }
  if (typeof token !== "string" || !UUID_RE.test(token)) {
    return json(400, { ok: false, error: "bad-token", detail: "token must be the UUID minted at insert" });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !supabaseUrl) {
    // The platform injects both; their absence is a deployment accident, not a visitor error.
    return json(500, { ok: false, error: "server-misconfigured", missing: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] });
  }

  // 1. Look the row up by token. The service role is required: anon may insert into
  //    waitlist and may never select it — a readable waitlist is other people's addresses.
  //    consent_version is selected too: it is the join key to the consent text, which is
  //    where the controller address (one home) is read from below.
  //
  //    NOTE ON THE KEY: this table has NO `id` column. A previous version selected `id`,
  //    PostgREST answered 400, and every call returned 502 before it could even check
  //    whether the mail path was configured — which is why this failed at every stage of
  //    setup without ever naming the real cause.
  const lookup = await fetch(
    postgrestUrl(
      `waitlist?select=email,interests,consent_version,confirmed_at,confirm_sent_at,confirm_expires_at&confirm_token=eq.${encodeURIComponent(token)}`,
    ),
    { headers: serviceHeaders(serviceKey) },
  );
  if (!lookup.ok) {
    return json(502, { ok: false, error: "database-unavailable", detail: `waitlist select answered ${lookup.status}` });
  }
  const rows = (await lookup.json()) as WaitlistRow[];
  const row = rows[0];
  if (!row) {
    return json(404, { ok: false, error: "unknown-token" });
  }

  // 2. Already confirmed → success, and no mail. Idempotent from the visitor's side:
  //    a second click on the link leads here and must not re-send anything either.
  if (row.confirmed_at) {
    return json(200, { ok: true, status: "already-confirmed", mailed: false });
  }

  // 3. Expired → 410 Gone. A token minted at the fair and clicked weeks later confirms
  //    nothing; the row must be re-captured in person, not reused.
  if (!row.confirm_expires_at || Date.parse(row.confirm_expires_at) < Date.now()) {
    return json(410, { ok: false, error: "token-expired" });
  }

  // 4. Rate limit, layer 1 (per-isolate memory). See lastSendByToken for the tradeoff.
  pruneRateWindow();
  const lastSend = lastSendByToken.get(token);
  if (lastSend !== undefined && Date.now() - lastSend < RATE_WINDOW_MS) {
    return json(
      429,
      { ok: false, error: "recently-requested", retryAfterSeconds: Math.ceil((RATE_WINDOW_MS - (Date.now() - lastSend)) / 1000) },
      { "Retry-After": String(Math.ceil((RATE_WINDOW_MS - (Date.now() - lastSend)) / 1000)) },
    );
  }

  // 5. Configuration, checked only now: an already-confirmed or expired token must still
  //    answer truthfully even on a misconfigured day, and only an actual send needs the
  //    mail path. Missing values are reported by NAME only — never by value.
  //
  //    The controller address is NOT a secret. It has one authored home — controller.email
  //    in src/legal/consent.v1.json — which the seed mirrors into
  //    waitlist_consent_texts.controller_email. This function cannot read the JSON file
  //    (deploy uploads only this directory), so it reads the seeded row back, joined on the
  //    waitlist row's consent_version. A missing or still-marker address is reported in the
  //    same 503, by the DB column name, and nothing is sent to a placeholder.
  //    The mail transport is Brevo, not Resend, and the reason is worth recording because
  //    it is a constraint on the OPERATOR, not a preference: Resend refuses to deliver to
  //    anyone but the account owner until a DOMAIN is verified, and this operator has no
  //    domain. Brevo's free tier sends after verifying a SINGLE SENDER ADDRESS. Both are
  //    HTTP APIs, which is why this swap is confined to one fetch below and needed no
  //    change to the status contract the client routes on.
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  const missing = [
    !apiKey ? "BREVO_API_KEY" : null,
    !from ? "MAIL_FROM" : null,
  ].filter((name): name is string => name !== null);
  if (missing.length > 0) {
    return json(503, {
      ok: false,
      error: "mail-not-configured",
      missing,
      detail: "the contact is stored; no confirmation email can be sent until these secrets are set (see supabase/functions/README.md)",
    });
  }

  let controllerEmail = "";
  if (row.consent_version) {
    const consentLookup = await fetch(
      postgrestUrl(
        `waitlist_consent_texts?select=controller_email&version=eq.${encodeURIComponent(row.consent_version)}`,
      ),
      { headers: serviceHeaders(serviceKey) },
    );
    if (!consentLookup.ok) {
      return json(502, {
        ok: false,
        error: "database-unavailable",
        detail: `waitlist_consent_texts select answered ${consentLookup.status}`,
      });
    }
    const consentRows = (await consentLookup.json()) as { controller_email: string | null }[];
    controllerEmail = (consentRows[0]?.controller_email ?? "").trim();
  }
  if (!row.consent_version || controllerEmail === "" || controllerEmail === MARKER) {
    // The withdrawal route is exactly the address that was shown, and that address is read
    // from the evidence row. If it cannot be recovered, the mail path has no honest
    // withdrawal route and no valid reply_to — refuse loudly rather than send a mail whose
    // reply goes nowhere (or worse, to a placeholder).
    return json(503, {
      ok: false,
      error: "mail-not-configured",
      missing: ["waitlist_consent_texts.controller_email"],
      detail:
        "the waitlist row's consent_version does not resolve to a filled controller_email; the confirmation email's withdrawal route cannot be named, so nothing is sent (seed the address from src/legal/consent.v1.json — see supabase/functions/README.md)",
    });
  }
  const sender = parseFrom(from as string);
  if (/no-?reply/i.test(sender.email)) {
    // DSK OH Direktwerbung § 5.3: a no-reply sender cuts off the withdrawal route.
    return json(503, {
      ok: false,
      error: "no-reply-sender-forbidden",
      detail: "MAIL_FROM must be a reachable address you have verified as a sender in Brevo; withdrawal lives in replyTo",
    });
  }

  // 6. Rate limit, layer 2: the atomic claim. The conditional UPDATE — same token, still
  //    unconfirmed, confirm_sent_at still holding the value we read — lets exactly one
  //    concurrent invocation win; every other one gets 0 rows and is refused. The claim
  //    is taken BEFORE the send so a slow provider cannot be raced.
  const claim = await fetch(
    postgrestUrl(
      `waitlist?confirm_token=eq.${encodeURIComponent(token)}&confirmed_at=is.null` +
        (row.confirm_sent_at === null
          ? "&confirm_sent_at=is.null"
          : `&confirm_sent_at=eq.${encodeURIComponent(row.confirm_sent_at)}`),
    ),
    {
      method: "PATCH",
      headers: serviceHeaders(serviceKey, { Prefer: "return=representation" }),
      body: JSON.stringify({ confirm_sent_at: new Date().toISOString() }),
    },
  );
  if (!claim.ok) {
    return json(502, { ok: false, error: "database-unavailable", detail: `waitlist claim answered ${claim.status}` });
  }
  const claimed = (await claim.json()) as WaitlistRow[];
  if (claimed.length === 0) {
    // Someone else sent this token's mail between our read and our claim.
    return json(429, { ok: false, error: "recently-requested", retryAfterSeconds: 120 }, { "Retry-After": "120" });
  }

  // 7. Send exactly one ad-free confirmation email.
  //
  //    THE LINK DOES NOT POINT AT THE FUNCTION. It used to, and that was wrong: *.supabase.co
  //    rewrites Content-Type to text/plain and adds `X-Content-Type-Options: nosniff` plus a
  //    sandboxed CSP to anything an Edge Function returns, so the page rendered as raw HTML
  //    source in the recipient's browser. The confirmation itself worked (confirmed_at was
  //    written) but it looked broken — which for a consent flow is its own kind of broken.
  //
  //    So the link points at a wrapper on a host we DO control, which fetches this same
  //    function and writes its HTML into the document. The function stays the single place
  //    the page is authored.
  const confirmPage = Deno.env.get("CONFIRM_PAGE_URL") ||
    "https://b-pingarron.github.io/Cocktail-Census/confirm.html";
  const confirmUrl = `${confirmPage}?token=${encodeURIComponent(token)}`;
  const noticeUrl = Deno.env.get("NOTICE_URL") || "https://b-pingarron.github.io/Cocktail-Census/datenschutz.html";
  const topics = TOPIC_ORDER.filter((id) => (row.interests ?? []).includes(id)).map((id) => TOPIC_LABELS[id]);
  const email = buildConfirmationEmail({
    confirmUrl,
    expiresAt: row.confirm_expires_at as string,
    topics,
    controllerEmail,
    noticeUrl,
  });

  const send = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      // Brevo authenticates with its own header name, not a Bearer token.
      "api-key": apiKey as string,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{ email: row.email }],
      // The withdrawal route, always one reply away. Never a no-reply address.
      replyTo: { email: controllerEmail },
      subject: email.subject,
      // Plain text on purpose: this mail carries no HTML by design, and Brevo takes the
      // text body under its own key name.
      textContent: email.text,
    }),
  });

  if (!send.ok) {
    // Brevo says WHY in the response body (an unverified sender, an unactivated account,
    // a bad key). That reason is the difference between a five-minute fix and an hour of
    // guessing.
    //
    // It goes BOTH to the function log and into this response. The status code alone
    // cannot tell "key not found" from "sender not valid" from "account not activated",
    // and all three are 401/400 here — so a caller who only sees the number is stuck. The
    // provider's message carries no secret. The key's SHAPE is logged (length and prefix)
    // and never the key itself: a truncated paste is invisible from the status alone.
    const providerDetail = (await send.text()).slice(0, 300);
    const keyShape = `${(apiKey as string).length} chars, starts "${(apiKey as string).slice(0, 8)}"`;
    console.error("brevo rejected the send", send.status, `key looks like: ${keyShape}`, providerDetail);
    // Revert the claim so an honest retry is not locked out for the whole window, and
    // report the failure as exactly what it is. The client will say "stored, not sent".
    await fetch(
      // Keyed on confirm_token, not on an `id` this table does not have — and on the
      // exact confirm_sent_at we claimed, so a later attempt is not clobbered.
      postgrestUrl(`waitlist?confirm_token=eq.${encodeURIComponent(token)}&confirm_sent_at=eq.${encodeURIComponent(claimed[0].confirm_sent_at as string)}`),
      {
        method: "PATCH",
        headers: serviceHeaders(serviceKey),
        body: JSON.stringify({ confirm_sent_at: row.confirm_sent_at }),
      },
    );
    return json(502, {
      ok: false,
      error: "mail-provider-failed",
      provider: "brevo",
      providerStatus: send.status,
      // The provider's own words, so the next person does not have to open a dashboard to
      // learn which of the four different 401s this is. Brevo's messages are specific
      // ("Key not found", "sender not valid") and carry no secret.
      providerDetail,
    });
  }

  // Only a real send starts the rate-limit window. A failed send never locks a retry out.
  lastSendByToken.set(token, Date.now());
  return json(200, { ok: true, status: "sent", mailed: true });
});