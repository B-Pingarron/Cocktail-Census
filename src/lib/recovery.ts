/**
 * Recovery — the session key, as something a person can save and paste back.
 *
 * WHY THIS IS ITS OWN MODULE, AND WHY IT IS SMALL: section 7b is explicit that export and recovery are
 * two different things.
 *
 *   "Recovery is the SESSION KEY, exported as a saveable string or QR: the data is already server-side,
 *    only the key is lost."
 *
 * That sentence is the whole design. The specs, the votes and the submission are all in the database --
 * nothing is on the device except the id that claims them. So recovering is not restoring data, it is
 * restoring the CLAIM, and the smallest artifact that can carry a claim is the id itself.
 *
 * WHY A PREFIXED FORM RATHER THAN A BARE UUID. A bare uuid pasted into a text box is indistinguishable
 * from a password, a coupon code, or a typo. `barnerd-session:v1:<uuid>` says what it is, carries a
 * version so a future format can be told apart from this one, and is still short enough to write down.
 *
 * WHAT THIS IS NOT. It is not authentication and it is not a secret in any strong sense -- whoever holds
 * the string can read and write that session's specs. ADR-035 already accepts that: there are no
 * accounts, and the alternative (an email, a password, a reset flow) is the thing that was deferred.
 * The string is therefore described to the visitor as a KEY, not as a login.
 *
 * NO IMPORTS, AND RUNNABLE DIRECTLY UNDER NODE (`node src/lib/recovery.ts`), the same rule as `rounds.ts`,
 * `units.ts`, `picker.ts`, `editor.ts`, `roster.ts` and `deal.ts`.
 */

/** The prefix, and the version. Both are checked on the way back in. */
export const KEY_PREFIX = "barnerd-session";
export const KEY_VERSION = "v1";

/**
 * A uuid, loosely. Deliberately NOT the strict RFC shape: ADR-035 says the column is "shaped to hold
 * either a local UUID or, later, a Supabase auth uid", so this accepts anything that looks like an
 * opaque id rather than pinning the format to one that a future auth provider would fail.
 */
const ID_SHAPE = /^[A-Za-z0-9._:-]{8,128}$/;

/** True when the text could be a session id at all. */
export function looksLikeSessionId(value: string): boolean {
  return ID_SHAPE.test(value.trim());
}

/** The saveable string: `barnerd-session:v1:<id>`. */
export function encodeKey(sessionId: string): string {
  const id = sessionId.trim();
  if (!looksLikeSessionId(id)) return "";
  return `${KEY_PREFIX}:${KEY_VERSION}:${id}`;
}

/**
 * Read a key back, from EITHER form.
 *
 * A BARE ID IS ACCEPTED ON PURPOSE. The visitor may have saved the string, or they may have written the
 * id down on its own, or they may be pasting it from a browser's storage panel. Refusing the bare form
 * would mean telling somebody their own id is invalid, which is a worse failure than being lenient about
 * a prefix. A WRONG PREFIX IS REFUSED, though -- a `barnerd-session:v2:` from a future version must not
 * be read as if it were this one.
 *
 * Returns null when the text is not a key: null is the honest answer, and the screen says so rather
 * than silently minting a fresh session and orphaning whatever the visitor was trying to reach.
 */
export function decodeKey(text: string): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (trimmed === "") return null;

  if (trimmed.startsWith(`${KEY_PREFIX}:`)) {
    const parts = trimmed.split(":");
    // `barnerd-session:v1:<id>` -- and an id may itself contain colons, so the rest is rejoined.
    if (parts.length < 3) return null;
    if (parts[1] !== KEY_VERSION) return null;
    const id = parts.slice(2).join(":");
    return looksLikeSessionId(id) ? id : null;
  }

  return looksLikeSessionId(trimmed) ? trimmed : null;
}

/** What to tell the visitor about their key. Words, not a boolean. */
export function keyAdvice(sessionId: string): string {
  if (!looksLikeSessionId(sessionId)) {
    return "This device has no session yet, so there is nothing to save.";
  }
  return "Save this string somewhere you will find it. It is the only way back to your drinks on another device — there is no account and no password to reset.";
}

// ── direct run ───────────────────────────────────────────────────────────────────────────────

/**
 * Direct-run detection, without an import. `node:url`'s pathToFileURL would be the obvious way to
 * compare `import.meta.url` with `process.argv[1]`, and importing it would break the zero-import rule
 * that lets this file run at all. The browser never reaches it — `process` is undefined there, which is
 * also why the block below is inert inside the app bundle.
 */
function isDirectRun(): boolean {
  if (typeof process === "undefined" || !process.argv || process.argv.length < 2) return false;
  const entry = process.argv[1];
  const self = import.meta.url.replace(/^file:\/\//, "").replace(/^\/([A-Za-z]:)/, "$1");
  return decodeURIComponent(self).replace(/\\/g, "/") === entry.replace(/\\/g, "/");
}

if (isDirectRun()) {
  // Every check throws, so a wrong answer exits non-zero: the run's output is the evidence.
  let checks = 0;
  const check = (ok: boolean, what: string): void => {
    checks++;
    if (!ok) throw new Error(`recovery self-check failed: ${what}`);
  };
  const block = (text: string): void => {
    console.log();
    console.log(text);
  };

  const ID = "3f2b1c9a-8d47-4e15-9a6b-2c7f0e1d4b83";

  // ── 1. the round trip ──────────────────────────────────────────────────────────────────────────
  const key = encodeKey(ID);
  check(key === `barnerd-session:v1:${ID}`, `the key is prefixed and versioned, got ${key}`);
  check(decodeKey(key) === ID, "and it decodes back to the id");
  check(decodeKey(encodeKey(ID)) === ID, "encode then decode is the identity");
  block("the round trip: a session id survives being written down and pasted back");

  // ── 2. a bare id is accepted, because it is still the visitor's own id ─────────────────────────
  check(decodeKey(ID) === ID, "a bare uuid decodes");
  check(decodeKey(`  ${ID}  `) === ID, "and surrounding whitespace does not matter");
  check(decodeKey(`  ${key}  `) === ID, "nor does whitespace around a full key");
  block("a bare id is accepted: telling somebody their own id is invalid is the worse failure");

  // ── 3. a WRONG VERSION is refused, and that is the point of the version ────────────────────────
  check(decodeKey(`barnerd-session:v2:${ID}`) === null, "a future version is refused, not read as v1");
  check(decodeKey("barnerd-session:" + ID) === null, "a key with no version is refused");
  check(decodeKey("barnerd-session:v1:") === null, "an empty id is refused");
  block("the version is checked: a v2 key must not be read as if it were this one");

  // ── 4. what is NOT a key ───────────────────────────────────────────────────────────────────────
  check(decodeKey("") === null, "empty is null, not a session");
  check(decodeKey("   ") === null, "so is whitespace");
  check(decodeKey("hello") === null, "a short word is not an id");
  check(decodeKey("a b c d e f g h") === null, "and neither is a sentence");
  // A LONG DASHED STRING IS ACCEPTED, and that is the design rather than a hole. `ID_SHAPE` is loose on
  // purpose: ADR-035 says the column is "shaped to hold either a local UUID or, later, a Supabase auth
  // uid", so pinning the format would refuse a future id that is perfectly valid. The first version of
  // this check asserted strictness the design does not have. A false accept costs an empty library; a
  // false REJECT tells a visitor their own id is invalid, which is the worse failure.
  check(
    decodeKey("this-is-a-long-enough-looking-string-but-no") !== null,
    "a long dashed string IS accepted -- the shape is deliberately loose for a future auth uid",
  );
  check(decodeKey("no spaces allowed at all here") === null, "but a space is never part of an id");
  block("junk with spaces returns null; a plausible opaque id is accepted, because refusing the visitor's own id is worse");

  // ── 5. an id that itself contains colons survives ──────────────────────────────────────────────
  const colonId = "auth:provider:12345678";
  check(looksLikeSessionId(colonId), "a colon-bearing id is a valid shape");
  check(decodeKey(encodeKey(colonId)) === colonId, "and survives the encode/decode round trip");
  block("an id containing colons is rejoined rather than truncated -- a future auth uid may have them");

  // ── 6. the advice is words, and it is honest about what the key is ─────────────────────────────
  check(keyAdvice("").includes("no session"), "no session says so");
  check(keyAdvice(ID).includes("Save this string"), "a session gets an instruction");
  check(keyAdvice(ID).includes("no account and no password"), "and the honest reason why it matters");
  block("the advice says KEY, not login -- ADR-035 has no accounts and the copy must not imply one");

  block(`all ${checks} recovery checks passed`);
}
