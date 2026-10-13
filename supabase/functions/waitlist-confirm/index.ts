// waitlist-confirm — the consuming half of the double opt-in.
//
// WHAT THIS DOES:
//   GET ?token=... → looks the waitlist row up by its confirm token (service role) and
//   sets confirmed_at. That single timestamp is the whole point of the feature: it is
//   the mailbox owner's own click, and it is what later makes the consent defensible
//   (DSK Orientierungshilfe Direktwerbung § 3.3). Everything else here is a page around
//   it.
//
// WHY IT IS IDEMPOTENT, AND HOW:
//   The UPDATE is conditional — `confirmed_at is null` — so a second click updates zero
//   rows and gets the same confirmation page instead of an error or a second write. A
//   confirmation link gets clicked twice by every mail client that previews URLs; an
//   error page on the second click would read as "this never worked".
//
// WHY THE PAGES ARE UTTERLY STANDALONE:
//   This is reached from an email client, possibly a stripped-down webview on fair wifi.
//   Inline CSS, system fonts, no scripts, no external assets, no fonts, no images. Two
//   languages (German, then English), the Art. 13 notice linked, the withdrawal route
//   repeated on every page — including the error pages, because a person holding an
//   expired link is exactly the person who needs to know they can write to the
//   controller. Nothing on these pages advertises anything (BGH VI ZR 134/15 applies to
//   what this function's sibling *sends*; this page must not become the loophole).
//
// WHY IT NEEDS THE SERVICE ROLE:
//   anon may insert into waitlist and may never update it — confirmed_at is written by
//   this function and by nothing else (see src/db/add-waitlist-consent-evidence.sql).

type WaitlistRow = {
  id: string;
  confirmed_at: string | null;
  confirm_expires_at: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Art. 13 notice. Defaults to the app's deployed copy; NOTICE_URL points it at the
 *  standalone host instead when that is the canonical deployment. */
const noticeUrl = () => Deno.env.get("NOTICE_URL") || "https://b-pingarron.github.io/Cocktail-Census/datenschutz.html";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The controller address, when configured. The withdrawal sentence adapts: with the
 *  address configured it is named; without it, the page still confirms (this function
 *  sends nothing) and points at the confirmation email's sender instead. */
const controllerLine = () => {
  const email = Deno.env.get("CONTROLLER_EMAIL");
  if (!email || email.trim() === "__CONTROLLER_EMAIL__" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return null;
  }
  return email.trim();
};

type PageKind = "confirmed" | "already-confirmed" | "expired" | "unknown-token" | "bad-request" | "server-error";

const PAGE_STATUS: Record<PageKind, number> = {
  "confirmed": 200,
  "already-confirmed": 200,
  "expired": 410,
  "unknown-token": 404,
  "bad-request": 400,
  "server-error": 500,
};

/**
 * One self-contained page for every outcome. The success and failure variants share the
 * shell so an error page is exactly as plain, as bilingual and as withdrawal-friendly as
 * the success page — a data subject's rights do not depend on whether a link worked.
 */
const renderPage = (kind: PageKind): Response => {
  const isError = kind === "expired" || kind === "unknown-token" || kind === "bad-request" || kind === "server-error";
  const controller = controllerLine();
  const contactHtml = controller
    ? `<a href="mailto:${escapeHtml(controller)}">${escapeHtml(controller)}</a>`
    : `dem Absender dieser Bestätigungs-E-Mail / the sender of this confirmation email`;

  const titles: Record<PageKind, { de: string; en: string }> = {
    "confirmed": { de: "E-Mail-Adresse bestätigt", en: "Email confirmed" },
    "already-confirmed": { de: "E-Mail-Adresse ist bereits bestätigt", en: "Email is already confirmed" },
    "expired": { de: "Bestätigungslink abgelaufen", en: "Confirmation link expired" },
    "unknown-token": { de: "Bestätigungslink ungültig", en: "Confirmation link invalid" },
    "bad-request": { de: "Bestätigungslink unvollständig", en: "Confirmation link incomplete" },
    "server-error": { de: "Technischer Fehler", en: "Technical error" },
  };

  const bodies: Record<PageKind, { de: string; en: string }> = {
    "confirmed": {
      de: "Ihre E-Mail-Adresse ist jetzt bestätigt. Erst ab jetzt sende ich Nachrichten an diese Adresse — die von Ihnen angekreuzten Themen. Sie können die Einwilligung jederzeit widerrufen, siehe unten.",
      en: "Your email address is now confirmed. Only from now on will messages be sent to this address — about the topics you ticked. You can withdraw your consent at any time, see below.",
    },
    "already-confirmed": {
      de: "Sie haben diesen Link bereits betätigt — die Bestätigung war gespeichert und hier ist nichts zu tun. Ihre E-Mail-Adresse ist bestätigt.",
      en: "You have already used this link — the confirmation was stored and there is nothing to do here. Your email address is confirmed.",
    },
    "expired": {
      de: "Dieser Bestätigungslink ist abgelaufen (Gültigkeit: 7 Tage nach der Eintragung). Ihre Adresse ist damit NICHT bestätigt, und es wird nichts an Sie gesendet. Bitte tragen Sie sich erneut ein oder schreiben Sie an die unten genannte Adresse.",
      en: "This confirmation link has expired (valid for 7 days after signup). Your address is therefore NOT confirmed, and nothing will be sent to you. Please sign up again or write to the address below.",
    },
    "unknown-token": {
      de: "Zu diesem Link gibt es keinen Eintrag — möglicherweise wurde er bereits gelöscht (unbestätigte Einträge werden nach sptestens 30 Tagen gelöscht). Ihre Adresse ist NICHT bestätigt und es wird nichts an Sie gesendet. Wenn Sie sich erinnern, sich eingetragen zu haben: schreiben Sie an die unten genannte Adresse.",
      en: "There is no entry for this link — it may already have been deleted (unconfirmed entries are deleted after at most 30 days). Your address is NOT confirmed and nothing will be sent to you. If you remember signing up: write to the address below.",
    },
    "bad-request": {
      de: "Dieser Link enthält kein gültiges Bestätigungs-Token. Bitte öffnen Sie den Link unverändert aus der E-Mail heraus.",
      en: "This link carries no valid confirmation token. Please open the link exactly as it appears in the email.",
    },
    "server-error": {
      de: "Die Bestätigung konnte gerade nicht gespeichert werden (technischer Fehler). Ihre Adresse wurde NICHT bestätigt. Bitte versuchen Sie es später erneut oder schreiben Sie an die unten genannte Adresse.",
      en: "The confirmation could not be stored right now (technical error). Your address was NOT confirmed. Please try again later or write to the address below.",
    },
  };

  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(titles[kind].de)} / ${escapeHtml(titles[kind].en)} — BarNerd</title>
  <meta name="robots" content="noindex" />
  <!-- Self-contained on purpose: inline CSS, system fonts, no scripts, no external
       assets. This page is reached from an email client and must render anywhere. -->
  <style>
    :root {
      --bg: #14110d;
      --panel: #1d1913;
      --line: rgba(232, 224, 210, 0.14);
      --cream: #ece4d6;
      --muted: #a89f8f;
      --gold: #c9a24b;
      --danger: #ff5447;
      --ok: #7dc47d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--cream);
      font: 16px/1.65 Georgia, "Times New Roman", serif;
      padding: 2.5rem 1.25rem 4rem;
    }
    main { max-width: 40rem; margin: 0 auto; }
    .panel {
      border: 2px solid ${isError ? "var(--danger)" : "var(--ok)"};
      background: var(--panel);
      border-radius: 6px;
      padding: 1.5rem 1.6rem;
      margin-bottom: 2rem;
    }
    h1 { font-size: 1.35rem; color: ${isError ? "var(--danger)" : "var(--ok)"}; margin: 0 0 1rem; }
    .lang-en { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--line); }
    .lang-label {
      display: block;
      font: 600 0.72rem/1 system-ui, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 0.4rem;
    }
    p { margin: 0.6rem 0; }
    a { color: var(--gold); }
    h2 {
      font-size: 1rem;
      color: var(--gold);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 2rem 0 0.5rem;
      border-bottom: 1px solid var(--line);
      padding-bottom: 0.4rem;
    }
    .withdrawal {
      border: 2px solid var(--gold);
      background: var(--panel);
      padding: 1.25rem 1.5rem;
      margin: 2rem 0;
      border-radius: 6px;
    }
    footer {
      margin-top: 3rem;
      border-top: 1px solid var(--line);
      padding-top: 1rem;
      font-size: 0.85rem;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main>
    <section class="panel" lang="de">
      <span class="lang-label">Deutsch</span>
      <h1>${escapeHtml(titles[kind].de)}</h1>
      <p>${escapeHtml(bodies[kind].de)}</p>
    </section>

    <section class="panel lang-en" lang="en">
      <span class="lang-label">English</span>
      <h1>${escapeHtml(titles[kind].en)}</h1>
      <p>${escapeHtml(bodies[kind].en)}</p>
    </section>

    <div class="withdrawal">
      <h2>Widerruf / Withdrawal</h2>
      <p lang="de">
        Sie können die Einwilligung jederzeit ohne Angabe von Gründen formlos widerrufen,
        per E-Mail an ${contactHtml}. Der Widerruf wirkt für die Zukunft; danach wird Ihre
        E-Mail-Adresse gelöscht.
      </p>
      <p lang="en">
        You can withdraw this consent at any time, without giving reasons, informally by
        email to ${contactHtml}. Withdrawal applies going forward; your email address is
        then deleted.
      </p>
    </div>

    <h2>Datenschutzhinweise / Privacy notice</h2>
    <p>
      <a href="${escapeHtml(noticeUrl())}">Datenschutzhinweise (Art. 13 DSGVO)</a> ·
      <a href="${escapeHtml(noticeUrl())}">Privacy notice (Art. 13 GDPR)</a>
    </p>

    <footer>
      <p>
        Bernardo Pingarrón — Verantwortlicher / Controller.
      </p>
    </footer>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: PAGE_STATUS[kind],
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
};

Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return renderPage("bad-request");
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token || !UUID_RE.test(token)) {
    return renderPage("bad-request");
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !supabaseUrl) {
    return renderPage("server-error");
  }

  // 1. Look the row up by token.
  const lookup = await fetch(
    `${supabaseUrl}/rest/v1/waitlist?select=id,confirmed_at,confirm_expires_at&confirm_token=eq.${encodeURIComponent(token)}`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  if (!lookup.ok) {
    return renderPage("server-error");
  }
  const rows = (await lookup.json()) as WaitlistRow[];
  const row = rows[0];
  if (!row) {
    return renderPage("unknown-token");
  }

  // 2. Idempotent confirm: the conditional UPDATE is the guard. Already-confirmed rows
  //    match nothing and land on the same success page — a second click never errors.
  if (!row.confirmed_at) {
    if (!row.confirm_expires_at || Date.parse(row.confirm_expires_at) < Date.now()) {
      return renderPage("expired");
    }
    const update = await fetch(
      `${supabaseUrl}/rest/v1/waitlist?confirm_token=eq.${encodeURIComponent(token)}&confirmed_at=is.null`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ confirmed_at: new Date().toISOString() }),
      },
    );
    if (!update.ok) {
      return renderPage("server-error");
    }
    const updated = (await update.json()) as WaitlistRow[];
    if (updated.length > 0) {
      return renderPage("confirmed");
    }
    // Zero rows: a concurrent click won the same race a moment ago. Same outcome.
    return renderPage("already-confirmed");
  }

  return renderPage("already-confirmed");
});
