import type { RoastAxis, RoastNote, RoastSide } from "@/types/roast";

/**
 * The note vocabulary — the canned remarks a visitor can click to leave.
 *
 * A ROAST IS A VOTE PLUS CLICKABLE PREMADE NOTES. Never free text, therefore no
 * moderation obligation, therefore no backend. The visitor picks chips; nothing
 * is typed; nothing has to be reviewed.
 *
 * THE TWO AXES ARE ORTHOGONAL, and that is the whole trick:
 *   axis `level`   = HOW MUCH you reacted   (3 chips)
 *   axis `element` = WHAT it is about       (3 chips)
 * One chip per axis, at most two ids per vote. Orthogonalising them is what keeps
 * the drawer at 3+3 instead of 3x3: the cross product is not enumerated in the
 * vocabulary, it is derived when the verdict groups by both.
 *
 * WHY THE LEVEL WORDS ARE SIDE-SPECIFIC:
 *   A shared scale word has to read correctly on both sides, and none do —
 *   "nothing" means "no reaction" on one side and "nothing wrong with it" on the
 *   other. Splitting the ladder per side removes the ambiguity instead of hiding
 *   it, and it is why the yikes ladder is a different kind of reaction at each
 *   step: indifference (meh) -> social embarrassment (cringe) -> physical
 *   revulsion (gross). That is better than a number.
 *
 * IDS, NOT TEXT, GO IN `roast_votes.labels`. Rewording a chip must not split the
 * aggregation in two, and the verdict has to group by these. The prefix keeps the
 * axis obvious when reading raw rows, and keeps the two axes collision-proof.
 */

export const roastNotes: RoastNote[] = [
  // ── level · how much ─────────────────────────────────────────────
  { id: "lvl-meh", text: "meh", axis: "level", sides: ["yikes"], degree: 1 },
  { id: "lvl-cringe", text: "cringe", axis: "level", sides: ["yikes"], degree: 2 },
  { id: "lvl-gross", text: "gross", axis: "level", sides: ["yikes"], degree: 3 },
  { id: "lvl-fresh", text: "fresh", axis: "level", sides: ["likes"], degree: 1 },
  { id: "lvl-sick", text: "sick", axis: "level", sides: ["likes"], degree: 2 },
  { id: "lvl-rad", text: "rad", axis: "level", sides: ["likes"], degree: 3 },

  // ── element · what it is about ────────────────────────────────────
  // Shared between sides: a glass problem is a glass problem either way.
  { id: "el-balance", text: "balance", axis: "element", sides: ["yikes", "likes"] },
  { id: "el-ingredients", text: "ingredients", axis: "element", sides: ["yikes", "likes"] },
  { id: "el-glass-garnish", text: "glass & garnish", axis: "element", sides: ["yikes", "likes"] },
];

export const ROAST_AXES: RoastAxis[] = ["level", "element"];

/** Human labels for the drawer's section headers. */
export const AXIS_LABEL: Record<RoastAxis, string> = {
  level: "How much",
  element: "What's up",
};

/** The chips to show for one side, in axis order. */
export function notesFor(side: RoastSide, axis: RoastAxis): RoastNote[] {
  return roastNotes.filter((note) => note.axis === axis && note.sides.includes(side));
}

export function noteById(id: string): RoastNote | undefined {
  return roastNotes.find((note) => note.id === id);
}

/** The degree of a level id, or undefined for elements. Derived, never stored. */
export function degreeOf(id: string): number | undefined {
  return noteById(id)?.degree;
}

/**
 * The composed sentence for a pair of chips, e.g. "glass & garnish: cringe".
 *
 * The chips are the data; the sentence is presentation. Two consequences worth
 * keeping: the table can ship EMPTY and the deck still works, and the authored
 * ones can arrive later without touching a single stored row.
 *
 * The key is `side:elementId:levelId` — 3 x 3 x 2 = 18 slots.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TODO(copy session): EVERY LINE BELOW IS AN EXAMPLE AND HAS TO BE REPLACED.
 *
 * They exist so the slot can be seen working — a real sentence in the card's
 * voice, of the right length, in the right place — and so the author can edit
 * text instead of inventing structure. They are written to be thrown away.
 * Nothing else in the deck depends on them: an empty table falls back to the
 * mechanical join, so deleting the whole object is a legal state.
 *
 * The value is an array because a slot may want variants; `phraseFor` takes [0].
 * ─────────────────────────────────────────────────────────────────────────
 */
export const ROAST_PHRASES: Partial<Record<string, string[]>> = {
  // ── yikes ──────────────────────────────────────────────────────────────
  "yikes:el-balance:lvl-meh": ["the balance is a shrug"],
  "yikes:el-balance:lvl-cringe": ["the balance is off and I can taste it"],
  "yikes:el-balance:lvl-gross": ["the balance is a crime"],
  "yikes:el-ingredients:lvl-meh": ["the shopping list is fine, the drink is not"],
  "yikes:el-ingredients:lvl-cringe": ["one of these does not belong"],
  "yikes:el-ingredients:lvl-gross": ["whoever wrote this has not tasted it"],
  "yikes:el-glass-garnish:lvl-meh": ["the glass is a shrug"],
  "yikes:el-glass-garnish:lvl-cringe": ["wrong glass, wrong garnish"],
  "yikes:el-glass-garnish:lvl-gross": ["this is served in the wrong century"],

  // ── likes ──────────────────────────────────────────────────────────────
  "likes:el-balance:lvl-fresh": ["the balance holds"],
  "likes:el-balance:lvl-sick": ["the balance is tight"],
  "likes:el-balance:lvl-rad": ["the balance is the whole trick"],
  "likes:el-ingredients:lvl-fresh": ["good list"],
  "likes:el-ingredients:lvl-sick": ["the list is doing real work"],
  "likes:el-ingredients:lvl-rad": ["nothing in here is wasted"],
  "likes:el-glass-garnish:lvl-fresh": ["served right"],
  "likes:el-glass-garnish:lvl-sick": ["the glass earns its place"],
  "likes:el-glass-garnish:lvl-rad": ["the garnish is the point"],
};

export function phraseKey(side: RoastSide, elementId: string, levelId: string): string {
  return `${side}:${elementId}:${levelId}`;
}

/**
 * The sentence for the chips that are selected. Falls back to a mechanical join
 * of the chip labels, so the deck never renders an empty slot.
 */
export function phraseFor(side: RoastSide, ids: string[]): string {
  const notes = ids.map(noteById).filter((n): n is RoastNote => Boolean(n));
  const element = notes.find((n) => n.axis === "element");
  const level = notes.find((n) => n.axis === "level");

  if (element && level) {
    const authored = ROAST_PHRASES[phraseKey(side, element.id, level.id)];
    if (authored && authored.length > 0) return authored[0];
    return `${element.text}: ${level.text}`;
  }
  if (element) return element.text;
  if (level) return level.text;
  return "";
}
