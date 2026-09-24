/**
 * Whether the Census intro still shows before the deck.
 *
 * WHY THE INTRO IS HIDEABLE AT ALL: a bartender who has already voted does not need the
 * explanation again, and asking the same question on every visit is how a product tells a
 * regular they are still a stranger. So the intro can be turned off.
 *
 * WHY IT IS REVERSIBLE FROM SOMEWHERE ELSE: the control that hides the intro sits on the
 * intro, which is exactly the page that stops appearing once it is on. On its own that is a
 * one-way door — a preference you can set and never reach again. The learn-more page carries
 * the matching control, which is the one place a visitor who turned it off might reasonably
 * look for it.
 *
 * Separate from the "skip" control on purpose: skip means "not now", and it changes nothing.
 * This means "never again", and it is the only one of the two that persists.
 *
 * Mirrors the defensive store in lib/nickname.ts — reads inside try/catch, and a failure to
 * read is treated as "show the intro", because showing it to someone who has seen it is a
 * much smaller failure than hiding it from someone who has not.
 */
const INTRO_HIDDEN_KEY = "barnerd-census-intro-hidden";

export function getIntroHidden(): boolean {
  try {
    return localStorage.getItem(INTRO_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function setIntroHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(INTRO_HIDDEN_KEY, "1");
    else localStorage.removeItem(INTRO_HIDDEN_KEY);
  } catch {
    // Storage unavailable — the preference does not persist, and the intro keeps showing.
  }
}
