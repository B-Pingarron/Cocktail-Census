/**
 * Motion primitives, kept in one place because more than one surface turns a page.
 *
 * The arrival turn itself is pure CSS — MenuCard carries the animation class, and the global
 * prefers-reduced-motion guard in index.css neutralises its duration, so no JavaScript is
 * involved in the page change at all. What needs asking in JS is the hub's cover, which
 * chooses between an instant swap and a full swing rather than relying on a zeroed duration.
 */

/**
 * Queried at the moment it matters rather than at import time, so it follows the OS setting
 * without a reload.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
