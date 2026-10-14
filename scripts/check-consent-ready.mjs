#!/usr/bin/env node
/**
 * check-consent-ready.mjs — the pre-flight gate before a phone is handed to a stranger.
 *
 * Run from the census repo root:   cd 01_BarNerd/apps/census && node scripts/check-consent-ready.mjs
 * Node 18+, no dependencies. Exits non-zero on ANY failure. One line per check, pass or
 * fail, naming the file and the fix.
 *
 * WHY EVERY PATH HERE IS CENSUS-RELATIVE:
 *   This gate used to run from the parent workspace and reach into the census repo, so its
 *   paths crossed two git repositories and its review surface was split between them — and
 *   it listed shipping files from the parent repo, whose untracked `workspace/` directory
 *   broke the review tooling outright ("untracked directory workspace…"). The whole
 *   deliverable now lives INSIDE the census repo: REPO_ROOT is the census root and the one
 *   repository this gate inspects is the one it runs in. Do not reintroduce a path that
 *   climbs out of REPO_ROOT.
 *
 * WHAT IT VERIFIES (the checks of T7, on the template/render model):
 *   1. consent.v1.json — recomputed sha256 of textLines.join("\n") over the RAW template
 *      (never normalized — there is nothing left to normalize: the __CONTROLLER_EMAIL__
 *      markers live in textLines BY DESIGN, the frozen hashes cover the template with
 *      them in place, and controller.email is the single authored address) matches the
 *      stored AND the frozen hashes. Each block must carry the marker exactly twice
 *      (controller line + withdrawal paragraph).
 *   2. add-waitlist-consent-evidence.sql — the two $$-quoted seed blocks are byte-
 *      identical to the JSON template text (markers included), and the seed carries
 *      both frozen hashes.
 *   3. controller.email in consent.v1.json is a REAL address — not the marker, not
 *      empty. This is the one authored fill point of the whole pipeline. The marker is
 *      deliberately NOT searched for in textLines or the notice template (they keep it
 *      by design) and NOT searched for in generated outputs (the generator overwrites
 *      them; regeneration-current — check 4 — is the correct check for an output).
 *   4. The generated output is current: the REAL generator is re-run in a scratch
 *      copy of the tree and the regenerated legal/bcb-2026/index.html /
 *      legal/bcb-2026/datenschutz.html / public/datenschutz.html must byte-match what
 *      is on disk. The gate never writes into the working tree.
 *      NOTE (2026-10-12): those are no longer one notice twice. legal/bcb-2026/
 *      datenschutz.html is the standalone page's FULL Art. 13 notice, and
 *      public/datenschutz.html is the APP's short notice about the session identifier
 *      (the app captures no addresses, ADR-036). Each is still diffed against its own
 *      shipped file, so the check covers both documents.
 *   5. No Supabase key, JWT (eyJ…), Resend or Brevo key, or bare service_role string in any
 *      committed-or-to-be-committed file under legal/bcb-2026/ or supabase/ (both paths
 *      relative to the census repo root).
 *
 * This is the gate that fails LOUDLY while controller.email is still the marker. A
 * gate that passed with an unfilled controller address would be a broken gate.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The census repo root — this script lives at <census>/scripts/. Every path below is
 *  inside that one repository, so the gate inspects exactly the tree it runs in. */
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const CONSENT_JSON = path.join(REPO_ROOT, "src", "legal", "consent.v1.json");
const NOTICE_TEMPLATE = path.join(REPO_ROOT, "src", "legal", "datenschutz.template.html");
const SQL_SEED = path.join(REPO_ROOT, "src", "db", "add-waitlist-consent-evidence.sql");
const NOTICE = path.join(REPO_ROOT, "public", "datenschutz.html");
const GENERATOR = path.join(REPO_ROOT, "scripts", "build-bcb-standalone.mjs");
const OUT_INDEX = path.join(REPO_ROOT, "legal", "bcb-2026", "index.html");
const OUT_NOTICE = path.join(REPO_ROOT, "legal", "bcb-2026", "datenschutz.html");

const MARKER = "__CONTROLLER_EMAIL__";
const FROZEN_SHA256 = {
  de: "b640a9a1c845353caa3ca3229e120ff74cd2b130f54f1762aadf015b04b133aa",
  en: "9cc8dfd32a16b5f4e2abac62d4517700904e8df429a979f38b4f873c6c35ca90",
};

const rel = (p) => path.relative(REPO_ROOT, p).split(path.sep).join("/");
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const countOccurrences = (haystack, needle) => haystack.split(needle).length - 1;

let failures = 0;
const pass = (message) => console.log(`[PASS] ${message}`);
const fail = (message, fix) => {
  failures += 1;
  console.log(`[FAIL] ${message}`);
  if (fix) console.log(`       FIX: ${fix}`);
};
const fatal = (message, fix) => {
  fail(message, fix);
  summarizeAndExit();
};

function summarizeAndExit() {
  console.log("");
  if (failures > 0) {
    console.log(`RESULT: NOT READY — ${failures} check(s) failed. Nothing may be handed to anyone until this is green.`);
    process.exit(1);
  }
  console.log("RESULT: READY — every pre-flight check passed.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 1. consent.v1.json — recomputed hashes match stored + frozen.
// ---------------------------------------------------------------------------
let data;
try {
  data = JSON.parse(readFileSync(CONSENT_JSON, "utf8"));
} catch (error) {
  fatal(`${rel(CONSENT_JSON)} — cannot be read or parsed: ${error.message}`,
    "Restore the file from git; the canonical legal text is frozen and must exist.");
}

const controllerEmail = String(data.controller?.email ?? "").trim();
const emailFilled = controllerEmail !== "" && controllerEmail !== MARKER;

for (const lang of ["de", "en"]) {
  const raw = (data[lang]?.textLines ?? []).join("\n");
  // The frozen hashes cover the RAW template — markers included. No normalization:
  // an earlier version of this gate normalized a filled address back to the marker
  // before hashing, which contradicted the generator (it hashes the raw template)
  // and made the two mutually unsatisfiable. Hash the raw template; the address is
  // a render-time substitution, never part of the hashed text.
  const recomputed = sha256(raw);
  const stored = data[lang]?.sha256;

  if (stored !== FROZEN_SHA256[lang]) {
    fail(`${rel(CONSENT_JSON)} — stored sha256 (${lang}) ${stored} does not match the frozen hash ${FROZEN_SHA256[lang]}.`,
      "The stored hash is frozen: restore it to the frozen value. Never recompute hashes by hand.");
  } else if (recomputed !== FROZEN_SHA256[lang]) {
    fail(`${rel(CONSENT_JSON)} — recomputed sha256 (${lang}) ${recomputed} does not match the frozen hash ${FROZEN_SHA256[lang]}.`,
      `The ${lang} template drifted from the frozen text. Restore the verbatim block from git; the wording may not be reworded, and the two ${MARKER} markers may not be replaced — the address is authored in controller.email only and substituted at render time.`);
  } else {
    pass(`${rel(CONSENT_JSON)} — sha256 (${lang}) recomputed over the raw template and matched stored + frozen ${FROZEN_SHA256[lang].slice(0, 16)}…`);
  }

  // The marker stays in the template by design and must appear exactly twice —
  // controller line + withdrawal paragraph. A filled address inside textLines is
  // a wording change and fails both this count and the hash above.
  const occurrences = countOccurrences(raw, MARKER);
  if (occurrences !== 2) {
    fail(`${rel(CONSENT_JSON)} — the ${lang} template block must carry ${MARKER} exactly 2× (controller line + withdrawal paragraph), found ${occurrences}×.`,
      `Restore the verbatim ${lang} block from git: the marker is the permanent render-time placeholder, the real address belongs in controller.email only, and the block text is frozen.`);
  } else {
    pass(`${rel(CONSENT_JSON)} — ${lang} block carries ${MARKER} exactly 2× (template placeholder, by design)`);
  }
}

// ---------------------------------------------------------------------------
// 2. The SQL seed blocks are byte-identical to the JSON text and carry the hashes.
// ---------------------------------------------------------------------------
let sql;
try {
  sql = readFileSync(SQL_SEED, "utf8");
} catch (error) {
  fatal(`${rel(SQL_SEED)} — cannot be read: ${error.message}`, "Restore the migration from git.");
}

const blocks = [...sql.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1]);
if (blocks.length !== 2) {
  fail(`${rel(SQL_SEED)} — expected exactly 2 $$-quoted seed blocks (text_de, text_en), found ${blocks.length}.`,
    "Do not edit the seed blocks' quoting; restore the file from git.");
} else {
  const deRaw = data.de.textLines.join("\n");
  const enRaw = data.en.textLines.join("\n");
  if (blocks[0] !== deRaw) {
    fail(`${rel(SQL_SEED)} — the text_de seed block is not byte-identical to de.textLines in ${rel(CONSENT_JSON)}.`,
      `Replace the block with ${rel(CONSENT_JSON)} de.textLines joined with "\\n", byte for byte (markers included) — the DB copy must prove the exact template wording whose hashes are frozen. Then re-run this gate.`);
  } else {
    pass(`${rel(SQL_SEED)} — text_de seed block is byte-identical to the JSON German template`);
  }
  if (blocks[1] !== enRaw) {
    fail(`${rel(SQL_SEED)} — the text_en seed block is not byte-identical to en.textLines in ${rel(CONSENT_JSON)}.`,
      `Replace the block with ${rel(CONSENT_JSON)} en.textLines joined with "\\n", byte for byte (markers included). Then re-run this gate.`);
  } else {
    pass(`${rel(SQL_SEED)} — text_en seed block is byte-identical to the JSON English template`);
  }
  for (const lang of ["de", "en"]) {
    if (!sql.includes(FROZEN_SHA256[lang])) {
      fail(`${rel(SQL_SEED)} — the frozen ${lang} hash ${FROZEN_SHA256[lang]} is missing from the seed.`,
        `The seed must carry the frozen hash literal for ${lang}; restore it from git.`);
    } else {
      pass(`${rel(SQL_SEED)} — frozen sha256 (${lang}) present in the seed`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2b. The seed's controller_email must equal consent.v1.json's controller.email.
//     This is the check that turns the silent mistake — seeding the
//     __CONTROLLER_EMAIL__ marker, or any other address, as the stored controller
//     address — into a loud failure. The stored pair (frozen template + the
//     address substituted into it) reconstructs exactly what the visitor read
//     ONLY when the address is the real one, and the same address is the
//     withdrawal route the confirmation mail's reply_to points at. Both the
//     insert seed and the upgrade-path backfill update must carry it.
// ---------------------------------------------------------------------------
const seedMatch = sql.match(
  /insert\s+into\s+public\.waitlist_consent_texts[\s\S]*?values\s*\(\s*'([^']*)'\s*,\s*'([^']*)'/i,
);
const seedControllerEmail = seedMatch ? seedMatch[2] : null;
const backfillMatch = sql.match(
  /update\s+public\.waitlist_consent_texts\s+set\s+controller_email\s*=\s*'([^']*)'\s*where\s+controller_email\s+is\s+null/i,
);
const backfillControllerEmail = backfillMatch ? backfillMatch[1] : null;

if (seedControllerEmail === null) {
  fail(`${rel(SQL_SEED)} — could not find the insert seed's quoted controller_email literal.`,
    "The seed's insert must carry a quoted controller_email value; restore it from git.");
} else if (seedControllerEmail !== controllerEmail) {
  fail(`${rel(SQL_SEED)} — the insert seed stores controller_email ${JSON.stringify(seedControllerEmail)} but ${rel(CONSENT_JSON)} controller.email is ${JSON.stringify(controllerEmail)}.`,
    `Set the seed's controller_email to the same real address as controller.email (currently ${JSON.stringify(controllerEmail)}). A placeholder or a stale address makes the stored evidence lossy and the withdrawal route wrong. Then re-run this gate.`);
} else {
  pass(`${rel(SQL_SEED)} — insert seed controller_email matches ${rel(CONSENT_JSON)} controller.email (${seedControllerEmail})`);
}

if (backfillControllerEmail === null) {
  fail(`${rel(SQL_SEED)} — could not find the upgrade-path backfill update's quoted controller_email literal.`,
    "The backfill update must set controller_email to a quoted real address; restore it from git.");
} else if (backfillControllerEmail !== controllerEmail) {
  fail(`${rel(SQL_SEED)} — the backfill update stores controller_email ${JSON.stringify(backfillControllerEmail)} but ${rel(CONSENT_JSON)} controller.email is ${JSON.stringify(controllerEmail)}.`,
    `Set the backfill update's controller_email to the same real address as controller.email (currently ${JSON.stringify(controllerEmail)}). Both the seed and the upgrade path must carry the real address.`);
} else {
  pass(`${rel(SQL_SEED)} — upgrade-path backfill controller_email matches ${rel(CONSENT_JSON)} controller.email (${backfillControllerEmail})`);
}

// ---------------------------------------------------------------------------
// 3. controller.email is the ONE authored fill point — it must hold a real
//    address. The marker is deliberately NOT searched for in textLines or the
//    notice template: both keep it by design (the frozen hashes cover the
//    template, the generator substitutes at render time). Nor is it searched
//    for in public/datenschutz.html: that file is now a GENERATED OUTPUT the
//    generator overwrites, so demanding it be hand-filled was the mutually-
//    unsatisfiable requirement that made this gate and the generator contradict
//    each other. Outputs are policed by the regeneration check below instead.
// ---------------------------------------------------------------------------
if (!emailFilled) {
  fail(`${rel(CONSENT_JSON)} — controller.email is still ${JSON.stringify(controllerEmail || "(empty)")}.`,
    `Set controller.email to the real contact address (the address data subjects write to and withdraw by). It is the ONLY place the address is authored: textLines and the notice template keep ${MARKER} on purpose, and the generated pages substitute it at render time. Then run node scripts/build-bcb-standalone.mjs and re-run this gate. Nothing may go live while the marker stands.`);
} else {
  pass(`${rel(CONSENT_JSON)} — controller.email is filled: ${data.controller?.name} <${controllerEmail}>`);
}

// ---------------------------------------------------------------------------
// 4. The generated output is current — the REAL generator is re-run in a
//    scratch copy of the tree and diffed byte-for-byte against what ships, for
//    all three generated files. Two of them are notices with different jobs
//    (the standalone Art. 13 notice and the app's identifier notice, see the
//    header), so each file is diffed against its own shipped counterpart. The
//    generator now runs against the filled sources natively (it hashes the raw
//    template and substitutes controller.email on output), so the old
//    scratch-copy-of-the-GENERATOR with relaxed hard-fails is deleted: there is
//    nothing left to relax. Running in scratch rather than in place is deliberate
//    — a pre-flight check must not mutate the working tree; a gate that silently
//    regenerates stale files hides the staleness from git review instead of
//    reporting it.
// ---------------------------------------------------------------------------
let scratch = null;
try {
  scratch = mkdtempSync(path.join(tmpdir(), "bcb-gate-"));
  // A minimal mirror of the census layout, so the generator sees the same relative tree
  // it sees in the real repo: <root>/scripts + <root>/src/legal → <root>/legal, <root>/public.
  const scratchOut = path.join(scratch, "legal", "bcb-2026");
  const scratchScriptDir = path.join(scratch, "scripts");
  const scratchGenerator = path.join(scratchScriptDir, "build-bcb-standalone.mjs");

  mkdirSync(scratchScriptDir, { recursive: true });
  mkdirSync(path.join(scratch, "src", "legal"), { recursive: true });
  mkdirSync(path.join(scratch, "public"), { recursive: true });
  writeFileSync(scratchGenerator, readFileSync(GENERATOR));
  writeFileSync(path.join(scratch, "src", "legal", "consent.v1.json"), readFileSync(CONSENT_JSON));
  writeFileSync(path.join(scratch, "src", "legal", "datenschutz.template.html"), readFileSync(NOTICE_TEMPLATE));

  execFileSync(process.execPath, [scratchGenerator], { cwd: scratch, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  const pairs = [
    [path.join(scratchOut, "index.html"), OUT_INDEX],
    [path.join(scratchOut, "datenschutz.html"), OUT_NOTICE],
    [path.join(scratch, "public", "datenschutz.html"), NOTICE],
  ];
  const stale = [];
  for (const [expected, shipped] of pairs) {
    try {
      if (!readFileSync(expected).equals(readFileSync(shipped))) stale.push(rel(shipped));
    } catch {
      stale.push(`${rel(shipped)} (missing)`);
    }
  }
  if (stale.length === 0) {
    pass(`${rel(OUT_INDEX)} + the standalone notice + ${rel(NOTICE)} (the app's own notice) — current: a scratch re-run of ${rel(GENERATOR)} byte-matches what ships`);
  } else {
    fail(`${stale.join(", ")} — STALE relative to the canonical sources.`,
      `Run node ${rel(GENERATOR)} and re-run this gate; the regenerated files are what ships. Never hand-edit a generated file.`);
  }
} catch (error) {
  fatal(`${rel(GENERATOR)} — exited non-zero during the pre-flight re-run in scratch:`,
    `${(error.stderr || error.message || "").toString().trim()}\n       The standalone output could not be regenerated; fix the generator's complaint (usually hash drift in ${rel(CONSENT_JSON)}) and re-run this gate.`);
} finally {
  if (scratch && scratch.startsWith(tmpdir())) {
    rmSync(scratch, { recursive: true, force: true }); // the gate's own temp dir, nothing else
  }
}

// ---------------------------------------------------------------------------
// 5. No Supabase key / JWT / Resend or Brevo key / bare service_role in the shipping trees.
// ---------------------------------------------------------------------------
const SECRET_PATTERNS = [
  { name: "JWT (Supabase key or token)", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/ },
  { name: "new-style Supabase secret key", re: /\bsb_secret_[A-Za-z0-9]{6,}/ },
  { name: "Resend API key", re: /\bre_[A-Za-z0-9]{20,}/ },
  // Brevo keys carry their own prefix (xkeysib-). Added when the mail transport moved
  // from Resend to Brevo: an unscanned key format is the one that leaks unnoticed.
  { name: "Brevo API key", re: /\bxkeysib-[A-Za-z0-9]{20,}/ },
  // The platform's own env-var name is not a secret; anything else wearing these words is.
  { name: "service_role string", re: /service_role/i, strip: "SUPABASE_SERVICE_ROLE_KEY" },
];
const BINARY_EXT = /\.(png|jpg|jpeg|gif|webp|ico|zip|woff2?|ttf|pdf)$/i;
const MAX_SCAN_BYTES = 1024 * 1024;

function listShippingFiles(gitCwd, pathspec) {
  try {
    const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", pathspec], {
      cwd: gitCwd,
      encoding: "utf8",
    });
    return out.split("\n").filter(Boolean).map((f) => path.join(gitCwd, f));
  } catch (error) {
    fatal(`git ls-files failed in ${rel(gitCwd)}: ${error.message}`, "Run the gate from a normal git working tree.");
    return [];
  }
}

const scanTargets = [
  // The generated standalone folder AND the app's generated notice. public/datenschutz.html
  // is listed separately because it lives outside legal/bcb-2026/ — it is a generator
  // output in the app tree (its own document since 2026-10-12), and a leaked key would be
  // just as committed there.
  ...listShippingFiles(REPO_ROOT, "legal/bcb-2026"),
  ...listShippingFiles(REPO_ROOT, "public/datenschutz.html"),
  ...listShippingFiles(REPO_ROOT, "supabase"),
];

let secretHits = 0;
for (const file of scanTargets) {
  if (BINARY_EXT.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (Buffer.byteLength(text, "utf8") > MAX_SCAN_BYTES) continue;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    for (const pattern of SECRET_PATTERNS) {
      const haystack = pattern.strip ? lines[i].split(pattern.strip).join("") : lines[i];
      if (pattern.re.test(haystack)) {
        secretHits += 1;
        if (secretHits <= 10) {
          fail(`${rel(file)}:${i + 1} — looks like a committed ${pattern.name}: "${lines[i].trim().slice(0, 80)}…".`,
            "Secrets never belong in a committed file. Move the value into a Supabase secret or a git-ignored config.js and scrub this line.");
        }
      }
    }
  }
}
if (secretHits > 10) {
  console.log(`       … and ${secretHits - 10} more hit(s) suppressed.`);
}
if (secretHits === 0) {
  pass(`secret scan — ${scanTargets.length} shipping file(s) under legal/bcb-2026, public/datenschutz.html and supabase are clean`);
}

summarizeAndExit();
