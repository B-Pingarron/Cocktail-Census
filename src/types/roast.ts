/**
 * ROAST types.
 *
 * Rung 1's specs are STATIC APP DATA, exactly like the Census's cocktails.ts —
 * no catalogue, no database rows, no foreign key. That is the decision that lets
 * rung 1 ship before Phase 0b (the generic ingredient layer), which gates rung 2
 * and nothing else.
 */

/**
 * One ordered ingredient line.
 *
 * `amount` is an OPAQUE STRING on purpose, and this is the same shape the Census
 * already uses (`{ name, amount }`). Nothing parses units: "3 cl", "1 dash",
 * "top" and "4,5" are all the same class of value. That is why the deck's source
 * list needs no normalisation and why "top" does not need a special case —
 * it is a label meaning "fill it up", not a number.
 */
export interface RoastIngredient {
  name: string;
  amount: string;
}

export interface RoastSpec {
  /**
   * spec_ref — stored in roast_votes as a PLAIN STRING, deliberately not a
   * foreign key, so a static spec ("old-fashioned") and a future database row
   * (a uuid) are the same thing to the vote table. Rung 2 becomes a data
   * problem, not a migration.
   *
   * The slug convention deliberately matches the Census cocktail ids: 14 of
   * these 15 specs exist in the Census under exactly this slug, which is what
   * makes the aggregate cross-comparison possible without any new column.
   */
  id: string;
  name: string;
  ingredients: RoastIngredient[];
  glass: string;
  garnish: string;
  method: string;
}

/** Which button produced the vote. The DB still stores agree/disagree — see below. */
export type RoastSide = "yikes" | "likes";

/** The two note axes. They are orthogonal: one is how much, one is what about. */
export type RoastAxis = "level" | "element";

export interface RoastNote {
  /**
   * What actually lands in roast_votes.labels. An id, never the display text:
   * rewording a chip must not split the aggregation in two, and the verdict
   * needs to group by these.
   */
  id: string;
  /** What the chip renders. Free to change; the id is not. */
  text: string;
  axis: RoastAxis;
  /** Which side(s) show this chip. Level words are side-specific by design. */
  sides: RoastSide[];
  /**
   * Only meaningful on the `level` axis: 1 is the mildest reaction, 3 the strongest.
   * It is DERIVED from this table and never stored on the vote — the verdict averages
   * it at query time. Two sources for one fact can disagree; one cannot.
   */
  degree?: 1 | 2 | 3;
}
