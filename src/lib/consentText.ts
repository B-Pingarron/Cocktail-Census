import consentRaw from "../legal/consent.v1.json?raw";

/**
 * The canonical legal text, typed for the app.
 *
 * WHY THIS FILE IS A RE-EXPORT AND NOT A HOME:
 *   The wording is authored in exactly one place, `src/legal/consent.v1.json`, and this
 *   module only gives the rest of the app a typed way to read it. This project has already
 *   paid for copy drifting apart across two files (see the `roomCopy.ts` header), and the
 *   legal text is the one copy where a silent drift is not a cosmetic bug but an unprovable
 *   consent. Nothing here paraphrases, shortens, or reorders anything — a component that
 *   cannot fit the text changes its layout, not the text.
 *
 * WHY `?raw` AND NOT A PLAIN JSON IMPORT:
 *   A direct `import ... from "../legal/consent.v1.json"` would need `resolveJsonModule`,
 *   and the tsconfig is not ours to change for this feature. The `?raw` import is typed by
 *   vite/client, keeps the JSON as the single source, and fails loudly at module load if
 *   the file is ever malformed — which is the honest failure mode for legal text.
 *
 * THE HASHES HERE ARE FROZEN, NOT COMPUTED. They are `sha256` over `textLines.join("\n")`,
 * UTF-8, no trailing newline, and they are also seeded into `waitlist_consent_texts` so a
 * divergence between repo and database is detectable. `scripts/check-consent-ready.mjs`
 * recomputes and refuses to pass on any mismatch. Never recompute or edit them by hand.
 *
 * THE ADDRESS IS A PARAMETER, SUBSTITUTED HERE AT RENDER TIME:
 *   `controller.email` in the JSON is the single place the operator fills the contact
 *   address; the text blocks keep `__CONTROLLER_EMAIL__` so the frozen hashes keep
 *   covering the wording TEMPLATE forever — the wording never changes, the address may.
 *   This module substitutes the parameter as it loads, so the app never shows a visitor
 *   a placeholder. While controller.email is still the marker, the substitution is the
 *   identity and CONTROLLER_EMAIL_FILLED is false — every renderer must then refuse
 *   loudly (PartyAsk does), never quietly show the marker. The rejected alternative —
 *   normalizing a filled address back to the marker before hashing — made the pre-flight
 *   gate and the standalone generator mutually unsatisfiable; never reintroduce it.
 */

/** The three purposes. The same three ids the database constraint allows, nowhere more. */
export type ConsentPurposeId = "rm-beta" | "roast-beta" | "news";

type ConsentBlock = {
  sha256: string;
  textLines: string[];
};

type ConsentV1 = {
  version: string;
  noticeVersion: string;
  media: string;
  controller: { name: string; email: string };
  purposes: ConsentPurposeId[];
  noticeLabel: { de: string; en: string };
  de: ConsentBlock;
  en: ConsentBlock;
  labels: Record<ConsentPurposeId, { de: string; en: string }>;
};

const consent: ConsentV1 = JSON.parse(consentRaw);

/** The consent-text version stored on every waitlist row. Proof requires the exact version. */
export const CONSENT_VERSION = consent.version;

/**
 * The `source` column value: which capture surface the row came from.
 *
 * WHY IT IS NOT THE CONSENT VERSION: the version identifies the *wording*, the source
 * identifies the *moment and place* — Bar Convent Berlin 2026, phone in hand. A future
 * fair gets its own source string while the consent version may well stay v1, and a
 * query for "everything captured at BCB" must not have to know the wording's version.
 */
export const BCB_SOURCE = "bcb-2026";

/** The medium the consent covers. Email — and only email; nothing else may be sent on it. */
export const CONSENT_MEDIA = consent.media;

export const CONSENT_CONTROLLER = consent.controller;

export const CONSENT_PURPOSES = consent.purposes;

/** The trailing notice labels, rendered after the blocks with the relative link to the notice. */
export const CONSENT_NOTICE_LABEL = consent.noticeLabel;

/** The bilingual checkbox labels — the German/English pair the interactive boxes render. */
export const CONSENT_LABELS = consent.labels;

/** The marker the operator replaces in controller.email — never in the text itself. */
const MARKER = "__CONTROLLER_EMAIL__";

const controllerEmail = consent.controller.email.trim();

/**
 * Whether the single fill point — controller.email — has been filled.
 *
 * While it is still the marker, every renderer must refuse loudly (see PartyAsk) rather
 * than show a visitor a placeholder contact address. This flag is how a component knows.
 */
export const CONTROLLER_EMAIL_FILLED = controllerEmail !== "" && controllerEmail !== MARKER;

/**
 * The rendered blocks: the frozen template with `__CONTROLLER_EMAIL__` substituted with
 * `controller.email` at module load. This is a PARAMETER substitution, not a rewording —
 * the frozen sha256 hashes cover the template (marker in place) precisely so the address
 * can move without the wording ever being touched or the hashes ever recomputed.
 */
export const CONSENT_TEXT = {
  de: consent.de.textLines.join("\n").split(MARKER).join(controllerEmail),
  en: consent.en.textLines.join("\n").split(MARKER).join(controllerEmail),
} as const;

/** The frozen hashes, re-exported so the standalone page and the SQL seed can be compared. */
export const CONSENT_SHA256 = {
  de: consent.de.sha256,
  en: consent.en.sha256,
} as const;
