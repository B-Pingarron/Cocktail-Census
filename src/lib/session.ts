/**
 * Session identity — the anonymous, browser-local id that a vote is attached to.
 *
 * DESIGN (ADR-035):
 *   - A session_id is minted client-side on first visit. It is a random UUID.
 *   - No account, no email, no password, no PII.
 *   - Stored in localStorage under a dedicated key, separate from census state.
 *   - The column is shaped so Supabase Auth can arrive later without a migration:
 *     session_id holds either a local UUID or, one day, a Supabase auth uid.
 *
 * WHY A SEPARATE KEY:
 *   The census state (barnerd-census-state) holds votes and progress. The session
 *   identity is a different concern: it survives a "Reset progress" action, and it
 *   is the same id used by both census votes and roast votes. A visitor who resets
 *   their census still has the same session.
 *
 * CROSS-DEVICE:
 *   Not delivered by accounts (there are none). Delivered by export: the visitor
 *   can download their roasts as CSV and their created cocktails as assets.
 */

const SESSION_KEY = "barnerd-session-id";

/**
 * A v4 UUID generator using the Web Crypto API.
 * Falls back to a simple random hex string if crypto.randomUUID is unavailable
 * (older browsers, non-HTTPS dev environments).
 */
function mintUuid(): string {
  // crypto.randomUUID() is available in all modern browsers and over HTTPS.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback: generate 16 random bytes and format as UUID v4.
  // This is less elegant but works everywhere.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version (4) and variant (10xx) bits per RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/**
 * Get the current session id, minting one if this is the first visit.
 *
 * The id is stable across page reloads and "Reset progress" actions.
 * It is NOT stable across browser clears (localStorage wipe) or
 * different devices — by design (ADR-035).
 *
 * @returns The session id string (a UUID).
 */
export function getSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
  } catch {
    // localStorage unavailable — mint fresh, don't persist
  }

  const id = mintUuid();

  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    // localStorage full or unavailable — the id still works for this page load,
    // it just won't survive a reload.
  }

  return id;
}
