import type { Vote } from "@/types/cocktail";

/**
 * Local census state, shared by the landing page and the voting flow.
 *
 * Extracted from Census.tsx so the landing page can read saved progress without
 * duplicating the storage key or re-implementing the parse. The key is per-origin, so the
 * app must be opened at a consistent host — `127.0.0.1` and `localhost` are different
 * sessions with different votes.
 */

export const STORAGE_KEY = "barnerd-census-state";

export interface SavedState {
  votes: Vote[];
  currentIndex: number;
  finished: boolean;
  syncedCount?: number;
}

export function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

export function saveState(state: SavedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // unresettable storage is not worth failing a reset over
  }
}
