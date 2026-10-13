#!/usr/bin/env node
/**
 * build-bcb-standalone.mjs — generate the standalone BCB 2026 consent page.
 *
 * WHY THIS EXISTS:
 *   The operator is at Bar Convent Berlin handing his phone to strangers. The app's own
 *   deploy (GitHub Pages from a dirty worktree) must not be touched today, so the
 *   standalone page ships as an independent static artifact — but it is BUILT INSIDE the
 *   census repo that owns the legal text. This script, the canonical JSON, the notice
 *   template and every output written below all live in one git repository.
 *   WHY ONE REPO: the deliverable used to live in the parent workspace, where an untracked
 *   `workspace/` directory broke the review tooling ("untracked directory workspace…") and
 *   every path here had to reach across two repositories. Both problems are the same
 *   problem: a review surface split across repos. Keeping the generator next to the text
 *   it reads makes REPO_ROOT the census repo root and every path below relative to it.
 *   One source of truth for the legal wording — `consent.v1.json` — and every consumer
 *   derives from it. `legal/bcb-2026/index.html` is a GENERATED ARTIFACT; this script is
 *   the thing you author. Never hand-edit the generated HTML.
 *
 * THE TEMPLATE MODEL — the address is a PARAMETER, not a wording change:
 *   The frozen sha256 hashes cover the legal WORDING with __CONTROLLER_EMAIL__ in place.
 *   That is deliberate: the wording never changes, the controller's address may, so the
 *   hash is taken over the TEMPLATE and the address substituted into every rendered
 *   output at generation time. `controller.email` in consent.v1.json is the single place
 *   the operator fills the address.
 *   An earlier version of this pipeline normalized a filled address back to the marker
 *   before hashing, which made the pre-flight gate and this generator mutually
 *   unsatisfiable — the gate demanded the marker be gone from every file while the
 *   generator demanded the hashed text still contain it. Never reintroduce that
 *   normalization: hash the raw template, substitute on output.
 *
 * WHAT IT DOES (every path relative to the census repo root — run it FROM there):
 *   1. Reads  src/legal/consent.v1.json           (CANONICAL legal text + the ONE filled
 *                                                 controller address)
 *   2. Reads  src/legal/datenschutz.template.html (CANONICAL Art. 13 template, markers
 *                                                 intact)
 *   3. Verifies the recomputed sha256 of each textLines.join("\n") — the raw template,
 *      never normalized — against the stored hash AND the two frozen literals. Any
 *      divergence fails the build (non-zero exit).
 *   4. Writes legal/bcb-2026/index.html      (rendered, marker substituted)
 *   5. Writes legal/bcb-2026/datenschutz.html (the standalone page's FULL Art. 13 notice:
 *      the authored template, marker substituted)
 *   6. Writes public/datenschutz.html         (the APP's notice — a DIFFERENT, short document,
 *      authored in this file. See below.)
 *
 *   THE TEMPLATE NOW SERVES ONE JOB, NOT TWO (2026-10-12).
 *   `public/datenschutz.html` used to be a copy of the standalone record; it declared its own
 *   scope as "the BCB 2026 waitlist" and never mentioned votes or specs, so it never described
 *   what the app does. The app does not collect addresses any more (the ask is switched off,
 *   ADR-036), and a notice for a capture the app does not perform is a notice that covers
 *   nothing. So the two pages are now two documents with two jobs:
 *     - legal/bcb-2026/datenschutz.html — the FULL Art. 13 notice for the email capture,
 *       authored in src/legal/datenschutz.template.html;
 *     - public/datenschutz.html — the APP's short notice about the identifier it stores.
 *       It is a legal document a visitor reads, so it is authored as text and not assembled
 *       from string fragments. It lives HERE rather than in a second template file because the
 *       sanctioned edit surface for this pass names one template file; a reviewer who wants a
 *       second template file should move it, and this comment says so on purpose.
 *
 *   The consent wording is NEVER retyped here. The full notice is NEVER retyped here.
 *   The app notice below is the one document authored in this file — read it before editing it,
 *   and keep its claims verifiable: "no name and no email" holds because the ask is off, the
 *   nickname is browser-only (`lib/nickname.ts`), and the one Submission-publish call path sends
 *   the fixed byline "Anonymous" (`RoastRoster.tsx`), never the nickname.
 *   While controller.email is still the marker, substitution is the identity and the
 *   generated pages carry loud, unmissable refusal behaviour: they say so in words and
 *   REFUSE to submit. Nothing may ship a placeholder contact address quietly.
 *
 * Usage:  cd 01_BarNerd/apps/census && node scripts/build-bcb-standalone.mjs
 *         (Node 18+, no dependencies; writes only inside the census repo)
 * Run it only when the legal text changes. The generated HTML ships committed.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The census repo root — this script lives at <census>/scripts/, so its parent IS the repo
 *  root. Everything this generator reads or writes is inside that one repository. */
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const CANONICAL_JSON = path.join(REPO_ROOT, "src", "legal", "consent.v1.json");
const NOTICE_TEMPLATE = path.join(REPO_ROOT, "src", "legal", "datenschutz.template.html");
const OUT_DIR = path.join(REPO_ROOT, "legal", "bcb-2026");
/** The app's served copy of the notice — a GENERATOR OUTPUT of the template, never hand-filled. */
const APP_NOTICE_OUT = path.join(REPO_ROOT, "public", "datenschutz.html");

/** The marker the operator must replace. Never rendered as plausible-looking contact text. */
const MARKER = "__CONTROLLER_EMAIL__";

/** The two frozen hashes, per the spec. The build fails if the JSON disagrees with them. */
const FROZEN_SHA256 = {
  de: "b640a9a1c845353caa3ca3229e120ff74cd2b130f54f1762aadf015b04b133aa",
  en: "9cc8dfd32a16b5f4e2abac62d4517700904e8df429a979f38b4f873c6c35ca90",
};

/** confirm_token lifetime — mirrors src/lib/waitlist.ts (7 days). */
const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const countOccurrences = (haystack, needle) => haystack.split(needle).length - 1;

const fail = (message) => {
  console.error(`[build-bcb-standalone] FAILED: ${message}`);
  process.exit(1);
};

/** Escape for HTML text content. The build additionally FAILS if escaping would change the
 *  legal text at all, so the blocks in index.html stay byte-identical to the template
 *  apart from the controller-email parameter substitution. */
const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------------------
// 1. Read and verify the canonical legal text.
// ---------------------------------------------------------------------------
let data;
try {
  data = JSON.parse(readFileSync(CANONICAL_JSON, "utf8"));
} catch (error) {
  fail(`cannot read canonical legal text at ${CANONICAL_JSON}: ${error.message}`);
}

const REQUIRED_PURPOSES = ["rm-beta", "roast-beta", "news"];
if (JSON.stringify(data.purposes) !== JSON.stringify(REQUIRED_PURPOSES)) {
  fail(`purposes must be exactly ${REQUIRED_PURPOSES.join(", ")} — got ${JSON.stringify(data.purposes)}`);
}
for (const id of REQUIRED_PURPOSES) {
  if (!data.labels?.[id]?.de || !data.labels?.[id]?.en) fail(`labels.${id} missing de/en text`);
}

console.log(`consent version : ${data.version}`);
console.log(`notice version  : ${data.noticeVersion}`);

for (const lang of ["de", "en"]) {
  const joined = data[lang].textLines.join("\n");
  const recomputed = sha256(joined);
  if (recomputed !== data[lang].sha256) {
    fail(`${lang}: recomputed sha256 ${recomputed} does not match stored ${data[lang].sha256}`);
  }
  if (recomputed !== FROZEN_SHA256[lang]) {
    fail(`${lang}: recomputed sha256 ${recomputed} does not match the frozen hash ${FROZEN_SHA256[lang]}`);
  }
  if (/[&<>]/.test(joined)) {
    fail(`${lang}: legal text contains &, < or > — it could not be embedded byte-verbatim in HTML`);
  }
  console.log(`sha256 (${lang})   : ${recomputed}  OK (matches stored + frozen)`);
}

const controllerEmail = data.controller.email;
const emailFilled = controllerEmail !== MARKER && !/^\s*$/.test(controllerEmail);
console.log(`controller     : ${data.controller.name}, ${controllerEmail}`);
if (!emailFilled) {
  console.log("!! WARNING    : __CONTROLLER_EMAIL__ is NOT filled in consent.v1.json.");
  console.log("!!             Generated pages carry a loud warning and REFUSE to submit.");
  console.log("!!             Nothing may be deployed while this is the marker.");
}

/** Substitute the parameter into a template. While controller.email IS the marker this is
 *  the identity — the loud refusal below is what keeps that state from shipping quietly.
 *  This is a parameter substitution, never a rewording: the frozen hashes cover the
 *  template with the marker in place, which is exactly why they stay valid forever. */
const substituteControllerEmail = (template) => template.split(MARKER).join(controllerEmail);

// ---------------------------------------------------------------------------
// 2. Render the Art. 13 notice from the authored template, substituting the
//    controller email. The SAME substituted output goes to BOTH destinations —
//    the app's public copy and the standalone page's copy — so the operator
//    fills the address once and both notice surfaces follow.
// ---------------------------------------------------------------------------
let noticeTemplate;
try {
  noticeTemplate = readFileSync(NOTICE_TEMPLATE, "utf8");
} catch (error) {
  fail(`cannot read the authored notice template at ${NOTICE_TEMPLATE}: ${error.message}`);
}

const markersInTemplate = noticeTemplate.split(MARKER).length - 1;
if (markersInTemplate === 0) {
  fail("the authored notice template contains no __CONTROLLER_EMAIL__ marker — it must not " +
    "be hand-filled; the address is a parameter substituted at render time. " +
    "Restore the markers from git.");
}
const substitutedNotice = substituteControllerEmail(noticeTemplate);

// Loud, unmissable banner when the operator has not filled the marker. Prepended into the
// copied body — the notice text itself is untouched.
const noticeBanner = emailFilled
  ? ""
  : `<div style="border:4px solid #ff3b30;background:#3a0d0a;color:#ffd9d5;padding:1rem 1.25rem;margin:0 0 1.5rem;font:700 1.05rem/1.5 system-ui,sans-serif;">` +
    `KONTAKT-ADRESSE NICHT AUSGEF&Uuml;LLT: __CONTROLLER_EMAIL__ steht noch im Datenschutztext. ` +
    `Diese Seite ist NICHT live zu stellen. / CONTACT ADDRESS NOT FILLED: the notice still names ` +
    `the placeholder __CONTROLLER_EMAIL__. DO NOT PUBLISH THIS PAGE.</div>`;

const bannerAnchoredNotice = substitutedNotice.includes("<body>")
  ? substitutedNotice.replace("<body>", "<body>\n" + noticeBanner)
  : substitutedNotice;

// The generated-file header, saying out loud what each notice copy is and where its one
// fill point lives, so a future reader never hand-edits either copy.
const generatedNoticeHeader = (source) => `<!--
  GENERATED FILE — DO NOT EDIT BY HAND. Emitted by scripts/build-bcb-standalone.mjs (in
  this same census repo) from ${source}
  with __CONTROLLER_EMAIL__ substituted from controller.email in src/legal/consent.v1.json
  — the ONE place the operator fills the contact address. Edit the source, never this.-->`;

const noticeOutput = bannerAnchoredNotice.includes("<!doctype html>")
  ? bannerAnchoredNotice.replace("<!doctype html>", `<!doctype html>\n${generatedNoticeHeader("the authored template src/legal/datenschutz.template.html,")}`)
  : `${generatedNoticeHeader("the authored template src/legal/datenschutz.template.html,")}\n${bannerAnchoredNotice}`;

// ---------------------------------------------------------------------------
// 2b. The APP's notice — a different document from the standalone record.
//
//     WHY IT IS AUTHORED HERE: the app no longer captures addresses (ADR-036), so it needs a
//     notice of its own about the one thing it does hold: a random identifier in the browser,
//     sent with the visitor's votes, rounds and specs. The full Art. 13 notice for the email
//     capture stays in src/legal/datenschutz.template.html and ships to legal/bcb-2026 only.
//     A second authored template file would have been the tidier home; this pass's sanctioned
//     edit surface names one template file, so the document is authored here, in full, as HTML
//     a reviewer can read top to bottom.
//
//     WHAT IT SAYS, AND WHY EACH CLAIM IS HERE (all verified, none of it inferred):
//       * the identifier is browser-local and is sent with the contributions — `lib/session.ts`,
//         `votes.session_id`, `roast_votes.session_id`, `specs.session_id`;
//       * no name and no email are collected or stored by this app — the ask is switched off
//         (`components/PartyAsk.tsx`) and it was the only address capture in `src/`;
//       * the Nickname stays in the browser — `lib/nickname.ts` (localStorage "barnerd-nickname");
//       * the one Submission-publish call path sends the FIXED byline "Anonymous"
//         (`pages/RoastRoster.tsx`), and the database stores that literal — so a published
//         byline is not the visitor's name. This sentence exists because the column does exist;
//         saying nothing would imply nothing is stored.
//     NOT MENTIONED ON PURPOSE: the free-text feedback box. `components/FeedbackForm.tsx`
//     writes `{ message }` with no identifier, so it is anonymous by construction and no Art. 13
//     notice attaches to it. Saying so in a notice about identifiers would misplace it.
//
//     A marker survives here only while controller.email is the placeholder, and the build then
//     fails on it (the scan in step 4 covers this output). The banner does too.
// ---------------------------------------------------------------------------
const APP_NOTICE_HTML = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Datenschutzhinweise — Privacy notice · BarNerd</title>
  <meta name="description" content="Datenschutzhinweise (Art. 13 DSGVO) für die BarNerd-App: eine zufällige Kennung im Browser, kein Name, keine E-Mail. Privacy notice under Art. 13 GDPR for the BarNerd app." />
  <style>
    /* Self-contained on purpose: no external font, no asset, no script, no cookie. */
    :root { --bg: #14110d; --panel: #1d1913; --line: rgba(232, 224, 210, 0.14); --cream: #ece4d6; --muted: #a89f8f; --gold: #c9a24b; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--cream); font: 16px/1.65 Georgia, "Times New Roman", serif; padding: 2.5rem 1.25rem 4rem; }
    main { max-width: 46rem; margin: 0 auto; }
    h1 { font-size: 1.5rem; color: var(--gold); margin: 0 0 0.25rem; }
    .meta { color: var(--muted); font-size: 0.85rem; margin-bottom: 2.5rem; }
    section { margin: 2.25rem 0; }
    h2 { font-size: 1.05rem; color: var(--gold); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 0.75rem; border-bottom: 1px solid var(--line); padding-bottom: 0.4rem; }
    p { margin: 0.75rem 0; }
    ul { margin: 0.75rem 0; padding-left: 1.25rem; }
    li { margin: 0.3rem 0; }
    .lang-en { margin-top: 3rem; padding-top: 1rem; border-top: 2px solid var(--line); }
    .lang-label { display: inline-block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 0.5rem; }
    a { color: var(--gold); }
    footer { margin-top: 4rem; border-top: 1px solid var(--line); padding-top: 1rem; font-size: 0.85rem; color: var(--muted); }
  </style>
</head>
<body>
  <main>
    <h1>Datenschutzhinweise</h1>
    <p class="meta">
      BarNerd — App (Census, ROAST, Recipe Manager) · Fassung <code>${data.noticeVersion}</code> ·
      <a href="./">Zur Anwendung / back to the app</a>
    </p>

    <div lang="de">
      <span class="lang-label">Deutsch</span>

      <section>
        <h2>1. Verantwortlicher</h2>
        <p>
          Bernardo Pingarrón, eine natürliche Person, keine Firma. Kontakt:
          <a href="mailto:__CONTROLLER_EMAIL__">__CONTROLLER_EMAIL__</a>.
          Kontaktweg ist ausdrücklich E-Mail.
        </p>
      </section>

      <section>
        <h2>2. Was diese App speichert — und was nicht</h2>
        <p>
          Diese App legt in Ihrem Browser eine <strong>zufällige Kennung</strong> ab und schickt sie
          zusammen mit Ihren Beiträgen an den Server (Supabase, Projektregion West-EU/Irland). An
          dieser Kennung hängen Ihre Votes im Census, Ihre Runden in ROAST und die Specs, die Sie
          schreiben: sie ist der Faden, der Ihre Beiträge zusammenfindet. Ein Konto gibt es nicht,
          einen Login gibt es nicht.
        </p>
        <p>
          <strong>Name und E-Mail-Adresse</strong> erhebt und speichert diese App nicht; sie
          verlangt beides nicht. Der <strong>Nickname</strong>, den Sie vor einer Runde wählen
          können, bleibt in Ihrem Browser. Veröffentlichen Sie eine Submission, wird als
          Urheberzeile nur die feste Angabe „Anonymous“ gespeichert — nie Ihr Nickname.
        </p>
        <p>
          Für die Kennung gibt es nichts zu widerrufen: sie ist keine Einwilligung, sondern die
          Voraussetzung dafür, dass ein Vote oder ein Spec überhaupt zugeordnet werden kann.
          Löschen Sie die Browserdaten dieser Seite, ist die Kennung weg — und mit ihr der Zugriff
          auf Ihre Beiträge. Ihre Beiträge selbst bleiben gespeichert, solange die Auswertung
          betrieben wird. Kriterium für diesen Zeitraum ist die Dauer der Auswertung.
        </p>
      </section>

      <section>
        <h2>3. E-Mail-Adressen erfasst eine andere Seite</h2>
        <p>
          Diese App nimmt keine E-Mail-Adressen entgegen. Wer auf der BCB-2026-Seite eine Adresse
          hinterlässt, liest die vollständigen Hinweise dort:
          <a href="https://rapid-paper-c939.b-pingarron-c.workers.dev/datenschutz">Datenschutzhinweise der BCB-2026-Seite</a>.
        </p>
      </section>

      <section>
        <h2>4. Rechtsgrundlage und Empfänger</h2>
        <p>
          Rechtsgrundlage für die Speicherung der Kennung und Ihrer Beiträge ist
          Art. 6 Abs. 1 lit. f DSGVO — das berechtigte Interesse an einer funktionierenden
          Auswertung, ohne die sich kein Vote und kein Spec zuordnen ließe. Empfänger sind der
          Hosting-Dienstleister Supabase (nach Art. 28 DSGVO, ausschließlich nach Weisung) und
          niemand sonst. Ein grenzüberschreitender Datentransfer findet für diese Daten nicht
          statt; es gibt kein Tracking, keine Werbung und keine Weitergabe an Dritte.
        </p>
      </section>

      <section>
        <h2>5. Ihre Rechte</h2>
        <p>
          Sie haben nach der DSGVO das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16),
          Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und
          Widerspruch (Art. 21). Ihre Beiträge lassen sich über die Kennung auffinden, wenn Sie
          mir diese nennen. Eine automatisierte Entscheidung einschließlich Profiling findet
          nicht statt.
        </p>
        <p>
          <strong>Beschwerderecht:</strong> Berliner Beauftragte für Datenschutz und
          Informationsfreiheit, Alt-Moabit 59-61, 10555 Berlin,
          <a href="mailto:mailbox@datenschutz-berlin.de">mailbox@datenschutz-berlin.de</a>.
        </p>
      </section>
    </div>

    <div lang="en" class="lang-en">
      <span class="lang-label">English</span>

      <section>
        <h2>1. Controller</h2>
        <p>
          Bernardo Pingarrón, a natural person, not a company. Contact:
          <a href="mailto:__CONTROLLER_EMAIL__">__CONTROLLER_EMAIL__</a>. Contact is by email.
        </p>
      </section>

      <section>
        <h2>2. What this app stores — and what it does not</h2>
        <p>
          This app puts a <strong>random identifier</strong> in your browser and sends it to the
          server along with your contributions (Supabase, project region West EU/Ireland). Your
          Census votes, your ROAST rounds and the specs you write hang on that identifier: it is
          the thread that keeps your contributions together. There is no account and no login.
        </p>
        <p>
          This app does <strong>not</strong> collect or store your name or your email address, and
          it does not ask for either. The <strong>nickname</strong> you may choose before a round
          stays in your browser. If you publish a Submission, the only byline stored for it is the
          fixed label "Anonymous" — never your nickname.
        </p>
        <p>
          There is nothing to withdraw here: the identifier is not a consent, it is the condition
          that lets a vote or a spec be attributed at all. Clearing this site's browser data
          removes it — and with it your access to your contributions. The contributions themselves
          stay stored for as long as the census runs. The criterion for that period is the duration of the evaluation.
        </p>
      </section>

      <section>
        <h2>3. Email addresses are collected elsewhere</h2>
        <p>
          This app does not accept email addresses. Anyone who leaves an address on the BCB 2026
          page reads the full notice there:
          <a href="https://rapid-paper-c939.b-pingarron-c.workers.dev/datenschutz">BCB 2026 privacy notice</a>.
        </p>
      </section>

      <section>
        <h2>4. Legal basis and recipients</h2>
        <p>
          The legal basis for storing the identifier and your contributions is
          Art. 6(1)(f) GDPR — the legitimate interest in a working census, without which no vote
          and no spec could be attributed. The recipient is the hosting provider Supabase (under
          Art. 28 GDPR, on my instructions only) and nobody else. No cross-border transfer takes
          place for this data; there is no tracking, no advertising and no sharing with third
          parties.
        </p>
      </section>

      <section>
        <h2>5. Your rights</h2>
        <p>
          Under the GDPR you have the right to access (Art. 15), rectification (Art. 16), erasure
          (Art. 17), restriction (Art. 18), data portability (Art. 20) and objection (Art. 21).
          Your contributions can be found via the identifier if you tell it to me. There is no
          automated decision-making, including profiling.
        </p>
        <p>
          <strong>Right to complain:</strong> Berliner Beauftragte für Datenschutz und
          Informationsfreiheit, Alt-Moabit 59-61, 10555 Berlin,
          <a href="mailto:mailbox@datenschutz-berlin.de">mailbox@datenschutz-berlin.de</a>.
        </p>
      </section>
    </div>

    <footer>
      <p>
        Fassung / version <code>${data.noticeVersion}</code>. Änderungen werden hier veröffentlicht /
        changes are published here. · <a href="./">Zur Anwendung / back to the app</a>
      </p>
    </footer>
  </main>
</body>
</html>
`;

const substitutedAppNotice = substituteControllerEmail(APP_NOTICE_HTML);
const bannerAnchoredAppNotice = substitutedAppNotice.includes("<body>")
  ? substitutedAppNotice.replace("<body>", "<body>\n" + noticeBanner)
  : substitutedAppNotice;

const appNoticeOutput = bannerAnchoredAppNotice.includes("<!doctype html>")
  ? bannerAnchoredAppNotice.replace("<!doctype html>", `<!doctype html>\n${generatedNoticeHeader("the app-notice document authored inside scripts/build-bcb-standalone.mjs,")}`)
  : `${generatedNoticeHeader("the app-notice document authored inside scripts/build-bcb-standalone.mjs,")}\n${bannerAnchoredAppNotice}`;

// ---------------------------------------------------------------------------
// 3. Render index.html from the JSON. The legal blocks are the frozen template
//    with the controller-email parameter substituted — verbatim otherwise.
// ---------------------------------------------------------------------------
const deBlock = substituteControllerEmail(data.de.textLines.join("\n"));
const enBlock = substituteControllerEmail(data.en.textLines.join("\n"));

const checkboxRow = (id) => `
        <label class="box" for="${id}">
          <input type="checkbox" id="${id}" name="interest" value="${id}" />
          <span><strong>${escapeHtml(data.labels[id].de)}</strong><span class="sep"> / </span>${escapeHtml(data.labels[id].en)}</span>
        </label>`;

/** One row of the generated-file box below: version + the German hash, padded to the box's
 *  inner width (74) minus its six-space indent, so the ASCII border stays square whatever
 *  the length of `version`. Padding the version alone (`.padEnd(16)`) was not enough — a
 *  17-character version like bcb-2026-10-12.v1 made that one line one column wider than the
 *  border and the box leaned. */
const boxVersionHashRow = `${data.version} sha256 de ${FROZEN_SHA256.de.slice(0, 16)}…)`.padEnd(68);

const indexHtml = `<!doctype html>
<!--
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  GENERATED FILE — DO NOT EDIT BY HAND.                                   ║
  ║  Produced by scripts/build-bcb-standalone.mjs from the single source     ║
  ║  of truth for the legal wording:                                         ║
  ║      src/legal/consent.v1.json   (version                                ║
  ║      ${boxVersionHashRow}║
  ║  The consent wording below comes from that file with the                 ║
  ║  __CONTROLLER_EMAIL__ parameter substituted — the hash covers the        ║
  ║  template; the address is a render-time parameter, so the wording itself ║
  ║  is never hand-edited here. Hand-editing this page would create exactly  ║
  ║  the legal-text drift this feature exists to prevent. Change the JSON or ║
  ║  controller.email and re-run the generator.                              ║
  ╚══════════════════════════════════════════════════════════════════════════╝

  Self-contained on purpose: no build step, no framework, no CDN, no external
  font, no analytics, no tracker, no cookie. Everything loaded from a third
  party would be a new processor and a new legal problem — and would break on
  congested fair wifi. Only two files are fetched, both same-origin:
  ./config.js (operator-created, git-ignored) and ./datenschutz.html (linked).
-->
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BarNerd — Einwilligung / Consent · Bar Convent Berlin 2026</title>
  <meta name="robots" content="noindex" />
  <style>
    /* Self-contained: system fonts only, no assets. Mobile-first — this is filled
       one-handed on a phone in a loud hall. */
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
      font: 16px/1.6 Georgia, "Times New Roman", serif;
      padding: 1.25rem 1rem 4rem;
    }
    main { max-width: 42rem; margin: 0 auto; }
    h1 { font-size: 1.4rem; color: var(--gold); margin: 0.5rem 0 0.25rem; }
    .meta { color: var(--muted); font-size: 0.85rem; margin-bottom: 1.25rem; }
    .lang-label {
      display: block;
      font: 600 0.75rem/1 system-ui, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 0.5rem;
    }
    section.lang {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 1rem 1.1rem;
      margin: 1.25rem 0;
    }
    /* The verbatim consent block. <pre> so the line breaks and the two-space
       checkbox indents survive exactly as authored in consent.v1.json. */
    pre.block {
      white-space: pre-wrap;
      overflow-wrap: break-word;
      font: inherit;
      margin: 0 0 0.75rem;
      color: var(--cream);
    }
    pre.block + .notice-link { margin-top: -0.25rem; }
    .notice-link { font-size: 0.95rem; }
    a { color: var(--gold); }
    .controller { margin: 1rem 0 0; font-size: 0.95rem; }
    .hard-error {
      display: none;
      border: 4px solid var(--danger);
      background: #3a0d0a;
      color: #ffd9d5;
      padding: 1rem 1.15rem;
      margin: 1.25rem 0;
      border-radius: 6px;
      font: 700 1rem/1.5 system-ui, sans-serif;
    }
    .hard-error.shown { display: block; }
    .marker {
      display: inline-block;
      border: 3px solid var(--danger);
      color: var(--danger);
      background: #2a0a08;
      font: 800 1rem/1.4 "Courier New", monospace;
      padding: 0.35rem 0.6rem;
      border-radius: 4px;
      letter-spacing: 0.04em;
    }
    form { margin: 2rem 0 0; }
    label.q { display: block; font: 600 0.95rem/1.4 system-ui, sans-serif; color: var(--muted); margin-bottom: 0.35rem; }
    input[type="email"] {
      width: 100%;
      font-size: 1.15rem;
      padding: 0.85rem 0.9rem;
      border-radius: 6px;
      border: 2px solid var(--line);
      background: var(--panel);
      color: var(--cream);
    }
    input[type="email"]:focus { outline: 2px solid var(--gold); border-color: var(--gold); }
    .box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 0.25rem;
      border-bottom: 1px solid var(--line);
      font-size: 1.05rem;
      cursor: pointer;
      min-height: 3.25rem; /* thumb-sized tap target */
    }
    .box input { width: 1.6rem; height: 1.6rem; flex: none; accent-color: var(--gold); }
    .sep { color: var(--muted); }
    button[type="submit"] {
      width: 100%;
      margin-top: 1.5rem;
      font: 700 1.15rem/1 system-ui, sans-serif;
      padding: 1.05rem 1rem;
      border-radius: 8px;
      border: none;
      background: var(--gold);
      color: #17130c;
      min-height: 3.5rem;
      cursor: pointer;
    }
    button[type="submit"]:disabled { opacity: 0.5; cursor: wait; }
    #status { margin-top: 1.25rem; font: 600 1rem/1.5 system-ui, sans-serif; display: none; white-space: pre-wrap; }
    #status.shown { display: block; padding: 1rem 1.1rem; border-radius: 6px; }
    #status.ok { display: block; border: 2px solid var(--ok); background: #10240f; color: #cdf0c9; }
    #status.warn { display: block; border: 2px solid var(--gold); background: #2a2210; color: #f2e3bb; }
    #status.err { display: block; border: 2px solid var(--danger); background: #3a0d0a; color: #ffd9d5; }
    footer {
      margin-top: 3rem;
      border-top: 1px solid var(--line);
      padding-top: 1rem;
      font-size: 0.78rem;
      color: var(--muted);
      font-family: system-ui, sans-serif;
    }
    noscript div {
      border: 4px solid var(--danger);
      background: #3a0d0a;
      color: #ffd9d5;
      padding: 1rem;
      border-radius: 6px;
      font: 700 1rem/1.5 system-ui, sans-serif;
      margin-bottom: 1.5rem;
    }
  </style>
</head>
<body>
  <main>
    <noscript><div>Javascript ist deaktiviert — ohne Javascript kann nichts gespeichert werden. / JavaScript is disabled — nothing can be stored without it.</div></noscript>

    <h1>BarNerd — Einwilligung / Consent</h1>
    <p class="meta">Bar Convent Berlin 2026 · Messe Berlin · Fassung / version <code>${escapeHtml(data.version)}</code></p>

    <!-- Loud, unmissable configuration error. Driven by the inline script below:
         missing config.js, placeholder values, or the unfilled controller marker all
         land here, and all of them REFUSE submission. A capture that silently
         discarded a stranger's email while he watched them type it is the worst
         possible outcome on this page. -->
    <div id="hard-error" class="hard-error" role="alert"></div>

    <p class="controller">
      Verantwortlicher / Controller:<br />
      <strong>${escapeHtml(data.controller.name)}</strong>,<br />
      ${
        emailFilled
          ? `<a href="mailto:${escapeHtml(controllerEmail)}">${escapeHtml(controllerEmail)}</a>`
          : `<span class="marker" title="NOT FILLED — do not deploy">${MARKER}</span><br />` +
            `<strong>Kontaktadresse NICHT ausgefüllt — Seite ist nicht live zu stellen.</strong><br />` +
            `<em>Contact address NOT filled in — this page must not go live.</em>`
      }
    </p>

    <noscript><div>&nbsp;</div></noscript>

    <!-- ======================= DEUTSCH (template wording, email substituted) ================== -->
    <section class="lang" lang="de">
      <span class="lang-label">Deutsch — Einwilligungstext</span>
      <pre class="block">${escapeHtml(deBlock)}</pre>
      <p class="notice-link"><a href="./datenschutz.html">${escapeHtml(data.noticeLabel.de)}</a></p>
    </section>

    <!-- ======================= ENGLISH (template wording, email substituted) ================= -->
    <section class="lang" lang="en">
      <span class="lang-label">English — consent text</span>
      <pre class="block">${escapeHtml(enBlock)}</pre>
      <p class="notice-link"><a href="./datenschutz.html">${escapeHtml(data.noticeLabel.en)}</a></p>
    </section>

    <form id="join-form" novalidate>
      <label class="q" for="email">E-Mail-Adresse / Email address</label>
      <input type="email" id="email" name="email" inputmode="email" autocomplete="email" spellcheck="false" required />
${REQUIRED_PURPOSES.map(checkboxRow).join("\n")}
      <!-- The boxes above are unticked by default, always. Consent pre-ticked is not consent. -->
      <button type="submit" id="submit">Einwilligen und speichern / Consent and save</button>
    </form>

    <div id="status" role="status" aria-live="polite"></div>

    <footer>
      <p>
        Einwilligungsfassung / consent version <code>${escapeHtml(data.version)}</code><br />
        sha256 (de) <code>${FROZEN_SHA256.de}</code><br />
        sha256 (en) <code>${FROZEN_SHA256.en}</code><br />
        Datenschutzhinweis-Fassung / notice version <code>${escapeHtml(data.noticeVersion)}</code><br />
        Generiert aus <code>src/legal/consent.v1.json</code> von <code>scripts/build-bcb-standalone.mjs</code> —
        nicht von Hand bearbeiten / do not hand-edit.
      </p>
    </footer>
  </main>

  <script src="./config.js"></script>
  <script>
    /* GENERATED inline script — same rule as the HTML above: change the generator, not this. */
    (function () {
      "use strict";

      var SOURCE = "bcb-2026";
      var CONSENT_VERSION = "${data.version}";
      var CONTROLLER_EMAIL_UNFILLED = ${emailFilled ? "false" : "true"};
      var CONFIRM_TTL_MS = ${CONFIRM_TTL_MS}; /* 7 days — mirrors src/lib/waitlist.ts */

      var hardError = document.getElementById("hard-error");
      var statusEl = document.getElementById("status");
      var form = document.getElementById("join-form");
      var emailInput = document.getElementById("email");
      var button = document.getElementById("submit");
      var boxes = [${REQUIRED_PURPOSES.map((id) => `document.getElementById("${id}")`).join(", ")}];

      /* ---- configuration ------------------------------------------------
         config.js is operator-created (from config.example.js) and git-ignored.
         Absent or placeholder values are a HARD failure: the page says so in
         words and refuses to submit. It never pretends a capture worked. */
      function configProblem() {
        var cfg = window.BCB_CONFIG;
        if (!cfg) {
          return "config.js fehlt: Diese Seite kann nichts speichern. " +
            "Lege config.example.js als config.js an und fülle Supabase-URL und Anon-Key.\\n\\n" +
            "config.js is missing: this page cannot store anything. Copy config.example.js " +
            "to config.js and fill in the Supabase URL and anon key.";
        }
        if (!cfg.supabaseUrl || String(cfg.supabaseUrl).indexOf("YOUR-PROJECT") !== -1) {
          return "Supabase-URL nicht ausgefüllt (config.js). / Supabase URL not filled in (config.js).";
        }
        if (!cfg.supabaseAnonKey || String(cfg.supabaseAnonKey).indexOf("REPLACE") === 0) {
          return "Supabase-Anon-Key nicht ausgefüllt (config.js). / Supabase anon key not filled in (config.js).";
        }
        return null;
      }

      function markerProblem() {
        if (!CONTROLLER_EMAIL_UNFILLED) return null;
        return "Kontakt-E-Mail (__CONTROLLER_EMAIL__) ist in consent.v1.json nicht ausgefüllt — " +
          "die Einwilligung nennt eine Platzhalteradresse. Nichts darf gespeichert werden. " +
          "Fülle die JSON aus und generiere die Seite neu.\\n\\n" +
          "Controller email is not filled in — the consent text names a placeholder address. " +
          "Nothing may be stored. Fill in the JSON and regenerate this page.";
      }

      function showHardError(message) {
        hardError.textContent = message;
        hardError.className = "hard-error shown";
        setStatus("", "");
      }

      function refreshHardError() {
        var problem = markerProblem() || configProblem();
        if (problem) { showHardError(problem); return false; }
        hardError.className = "hard-error";
        hardError.textContent = "";
        return true;
      }

      /* A shape check, not a validator — same floor as src/lib/waitlist.ts. */
      function looksLikeAnEmail(value) {
        return value.length >= 3 && value.length <= 320 && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
      }

      /* Three honest outcomes, never collapsed: ok / ok-but-mail-failed / failed.
         The insert is the primary outcome; a mail failure is reported as exactly
         what it is — stored, confirmation not sent — never as a success. */
      function setStatus(kind, message) {
        statusEl.className = kind ? "shown " + kind : "";
        statusEl.textContent = message;
      }

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!refreshHardError()) return;

        var email = emailInput.value.trim();
        if (!looksLikeAnEmail(email)) {
          setStatus("err",
            "Das sieht nicht nach einer E-Mail-Adresse aus. / That does not look like an email address.");
          return;
        }

        var picked = [];
        boxes.forEach(function (box) { if (box.checked) picked.push(box.value); });
        picked = picked.filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (picked.length === 0) {
          setStatus("err",
            "Mindestens ein Thema ankreuzen. / Tick at least one topic.");
          return;
        }

        var cfg = window.BCB_CONFIG;
        var baseUrl = String(cfg.supabaseUrl).replace(/\\/$/, "");
        var confirmUrl = cfg.confirmFunctionUrl ||
          baseUrl + "/functions/v1/waitlist-confirm-request";

        /* Minted before the insert so the row is complete at write time: token,
           dispatch timestamp, expiry. The mail path can then fail without the
           stored row being partial. Mirrors src/lib/waitlist.ts. */
        var token = crypto.randomUUID();
        var now = Date.now();
        var payload = {
          email: email,
          interests: picked,
          consent_version: CONSENT_VERSION,
          source: SOURCE,
          confirm_token: token,
          confirm_sent_at: new Date(now).toISOString(),
          confirm_expires_at: new Date(now + CONFIRM_TTL_MS).toISOString()
        };

        button.disabled = true;
        setStatus("", "");

        fetch(baseUrl + "/rest/v1/waitlist", {
          method: "POST",
          headers: {
            "apikey": cfg.supabaseAnonKey,
            "Authorization": "Bearer " + cfg.supabaseAnonKey,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(payload)
        }).then(function (response) {
          if (!response.ok) throw new Error("waitlist insert answered " + response.status + " " + response.statusText);
          /* The contact exists and the consent is valid from here on; only the
             mail is in question. The mail request runs in its own chain with its
             own catch, so a mail problem can never fall through to the "NOT
             stored" branch below: the insert already succeeded, and telling the
             visitor otherwise would be a lie about the one irreversible fact. */
          return fetch(confirmUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token })
          }).then(function (mailResponse) {
            if (!mailResponse.ok) {
              throw new Error("waitlist-confirm-request answered " + mailResponse.status + " " + mailResponse.statusText);
            }
            /* A 2xx is not by itself a send: the endpoint answers 200 with
               { mailed: false } for an already-confirmed row, where no mail is
               due. Read the body and claim a send only when the endpoint says
               the mail left (mailed === true). A missing or unparseable body is
               treated the same — never as a send. */
            return mailResponse.json().catch(function () { return null; });
          }).then(function (mailBody) {
            if (!mailBody || mailBody.mailed !== true) {
              throw new Error("waitlist-confirm-request answered 2xx without mailing (mailed: " +
                (mailBody ? mailBody.mailed : "absent") + ")");
            }
            setStatus("ok",
              "Gespeichert. Die Bestätigungs-E-Mail wurde angefordert — bitte den Link darin öffnen.\\n\\n" +
              "Stored. The confirmation email was requested — please open the link in it.");
          }).catch(function (mailFailure) {
            console.error("[bcb] contact stored, but no confirmation email was sent:", mailFailure);
            setStatus("warn",
              "E-Mail-Adresse gespeichert, aber es wurde keine Bestätigungs-E-Mail versandt " +
              "(kein Versand möglich oder Adresse bereits bestätigt). Es wird keine Nachricht " +
              "gesendet, bis der Bestätigungslink betätigt wurde.\\n\\n" +
              "Email stored, but no confirmation email was sent (sending was not possible, " +
              "or the address is already confirmed). No message will be sent until the " +
              "confirmation link is used.");
          });
        }).catch(function (insertFailure) {
          console.error("[bcb] the contact did not save:", insertFailure);
          setStatus("err",
            "NICHT gespeichert — kein Eintrag wurde angelegt. Bitte erneut versuchen.\\n\\n" +
            "NOT stored — no entry was created. Please try again.");
        }).finally(function () {
          button.disabled = false;
        });
      });

      /* Announce a broken configuration the moment the page opens, not on first submit. */
      refreshHardError();
    })();
  </script>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// 4. Once the address is filled, ZERO markers may survive in WHAT A VISITOR CAN
//    READ, ANYWHERE in the output — not only inside the two <pre> consent blocks.
//    The earlier four-surface whitelist (German block, English block, contact
//    value, notice) was too narrow: a marker added to index.html's footer or
//    contact paragraph — outside both <pre> blocks — would have shipped with no
//    complaint at all. This check scans the WHOLE generated output, so any
//    visitor-readable marker anywhere fails the build.
//
//    Only two kinds of occurrence are exempt, because a visitor cannot read
//    either: HTML comments (the build headers name the marker while explaining
//    the template model) and <script>/<style> bodies (the inline script's
//    markerProblem() string reports an unfilled address to a developer, and the
//    CSS opens no marker). Both are stripped before the scan. The authored
//    TEMPLATES keep their markers forever — that is what keeps the frozen hashes
//    valid; only outputs must never SHOW one.
// ---------------------------------------------------------------------------
const stripNonVisitorText = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

if (emailFilled) {
  const outputs = [
    ["legal/bcb-2026/index.html", indexHtml],
    ["the Art. 13 notice output (legal/bcb-2026/datenschutz.html)", noticeOutput],
    ["the app notice output (public/datenschutz.html)", appNoticeOutput],
  ];
  for (const [name, html] of outputs) {
    const surviving = countOccurrences(stripNonVisitorText(html), MARKER);
    if (surviving !== 0) {
      fail(`${name}: controller email is filled but ${surviving} ${MARKER} marker(s) survive substitution in visitor-readable output`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Write the output folders.
// ---------------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(path.dirname(APP_NOTICE_OUT), { recursive: true });
const indexPath = path.join(OUT_DIR, "index.html");
const noticePath = path.join(OUT_DIR, "datenschutz.html");
writeFileSync(indexPath, indexHtml, "utf8");
writeFileSync(noticePath, noticeOutput, "utf8");
writeFileSync(APP_NOTICE_OUT, appNoticeOutput, "utf8");

const deLines = deBlock.split("\n").length;
const enLines = enBlock.split("\n").length;
console.log(`wrote          : ${path.relative(REPO_ROOT, indexPath)}`);
console.log(`wrote          : ${path.relative(REPO_ROOT, noticePath)} (standalone Art. 13 notice, ${markersInTemplate} marker(s) substituted)`);
console.log(`wrote          : ${path.relative(REPO_ROOT, APP_NOTICE_OUT)} (the APP's short notice — a different document, authored in this script)`);
console.log(`embedded       : de block ${deLines} lines, en block ${enLines} lines — template wording, email parameter substituted`);
if (!emailFilled) {
  console.log("!! REMEMBER   : regenerate after filling __CONTROLLER_EMAIL__ in consent.v1.json.");
}
console.log("done.");
