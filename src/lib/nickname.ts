/**
 * Nickname — the optional display name a visitor picks before the roast.
 *
 * DESIGN (D5, hub at /):
 *   - Browser-local only. No account, no email, no network, no Supabase.
 *   - Stored in localStorage under a dedicated key, separate from census state
 *     and separate from the session id (session.ts).
 *   - Picking a nickname is optional: "Anonymous" and "skip" both clear it, so
 *     the absence of a value is a legitimate state and never an error.
 *
 * WHY A SEPARATE KEY:
 *   The session id identifies the device across both census votes and roast
 *   votes. The nickname is a display label the visitor can change or drop at
 *   any time without touching their identity or their progress.
 *
 * DEFENSIVE STYLE:
 *   Mirrors session.ts. localStorage can throw (Safari private mode, storage
 *   disabled, quota) so every access is wrapped. These functions never throw:
 *   a missing nickname is represented as null, never as an exception.
 */

const NICKNAME_KEY = "barnerd-nickname";

/**
 * Read the stored nickname.
 *
 * @returns The trimmed nickname, or null when unset, empty or whitespace-only.
 */
export function getNickname(): string | null {
  try {
    const raw = localStorage.getItem(NICKNAME_KEY);
    const trimmed = raw ? raw.trim() : "";
    return trimmed ? trimmed : null;
  } catch {
    // localStorage unavailable — treat as "no nickname".
    return null;
  }
}

/**
 * Store a nickname.
 *
 * An empty or whitespace-only value is treated as "no nickname" and clears the
 * key instead of writing an empty string, so getNickname() never has to guess
 * what an empty entry means.
 *
 * @param value The nickname to store.
 */
export function setNickname(value: string): void {
  const trimmed = value.trim();

  if (!trimmed) {
    clearNickname();
    return;
  }

  try {
    localStorage.setItem(NICKNAME_KEY, trimmed);
  } catch {
    // localStorage full or unavailable — the nickname still works for this
    // page load, it just will not survive a reload.
  }
}

/** Remove the stored nickname. Safe to call when none is stored. */
export function clearNickname(): void {
  try {
    localStorage.removeItem(NICKNAME_KEY);
  } catch {
    // localStorage unavailable — nothing to remove.
  }
}
