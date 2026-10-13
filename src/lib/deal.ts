/**
 * The deal — how the Arena chooses whose drinks a Roaster is shown.
 *
 * WHY THIS IS ITS OWN MODULE: the deal is a rule about lists, and a rule does not belong in a page.
 * It is also the one piece of rung 2 that decides WHO a visitor meets, so it is the piece most worth
 * being able to check without a browser.
 *
 * SECTION 29 OF THE GRILL DECISIONS SETTLED IT, and this file implements it rather than re-deciding:
 *
 *   "The Pool is every listed Submission. A Contender submitting enters it with their Submission.
 *    A Roaster is dealt a Contender they have NOT EXHAUSTED, then five drinks from that Submission.
 *    An empty Pool is not an error. It is an invitation to the Census, or a line sending them to the bar."
 *
 * And §87(b) on the shape of a run: "A random user from the Pool; 5 drinks from their selection. Then
 * round 2 loads a different user. Up to 3 rounds, then end." So EACH ROUND IS A DIFFERENT CONTENDER --
 * the Roaster meets three people, not three slices of one.
 *
 * "EXHAUSTED" IS MEASURED, NOT REMEMBERED. A Contender is exhausted when this Roaster has already voted
 * on that Submission -- and the votes carry `list_id`, so `roast_votes` answers it. A localStorage flag
 * beside the votes would be a second source of truth that can disagree with the table, which is the
 * mistake `RoastMenu` already documents avoiding for "has roasted anything".
 *
 * THE RANDOM IS SEEDED, ON PURPOSE. "A random user from the Pool" must not be `Math.random()` here: a
 * seeded pick is the same pick for the same seed, which is what makes the rule checkable. The caller
 * passes a seed; the browser passes something varying.
 *
 * NO IMPORTS, AND RUNNABLE DIRECTLY UNDER NODE (`node src/lib/deal.ts`), the same rule as `rounds.ts`,
 * `units.ts`, `picker.ts`, `editor.ts` and `roster.ts`.
 */

/** A Submission as the Arena sees it: a `roast_lists` row that is listed. */
export type Contender = {
  id: string;
  name: string;
  /** The snapshot taken at publish, so a later rename does not rewrite a byline. */
  author: string;
  is_tutorial: boolean;
};

/** The Pool: every listed Submission. Order is preserved so a seeded pick is reproducible. */
export function pool(contenders: Contender[], listedIds: string[]): Contender[] {
  const listed = new Set(listedIds);
  return contenders.filter((c) => listed.has(c.id));
}

/**
 * The Contenders this Roaster has NOT exhausted, in the order given.
 *
 * A CONTENDER IS EXHAUSTED WHEN ALL THEIR DRINKS HAVE BEEN VOTED ON -- not when any of them has.
 *
 * THE FIRST VERSION GOT THIS WRONG, and it was a bug a visitor could walk straight into: it treated a
 * single vote on a list as exhausting it, so finishing ROUND ONE of the author's fifteen produced
 * "Nobody left to roast" with ten drinks unroasted. Section 29 only makes sense the other way round:
 * "a Contender they have not exhausted, then five drinks from that Submission" -- which requires the
 * rest of the Submission to still be reachable after a round.
 *
 * A Contender with NO drinks is not exhausted either; it is simply not dealable, and `pickContender`
 * filters it out, so the caller can tell "already roasted" from "nothing to roast".
 */
export function unexhausted(
  pooled: Contender[],
  votedCounts: Record<string, number>,
  drinkCounts: Record<string, number>,
): Contender[] {
  return pooled.filter((c) => (votedCounts[c.id] ?? 0) < (drinkCounts[c.id] ?? 0));
}

/**
 * Deal one Contender: a seeded pick from the eligible Pool, or NULL when there is nothing to deal.
 *
 * TWO DIFFERENT REASONS A CONTENDER IS NOT ELIGIBLE, and they are not the same thing:
 *
 *   EXHAUSTED -- every one of their drinks has been voted on, ever. Section 29's rule, and it is
 *     permanent: they are out of the Pool for this Roaster.
 *
 *   DEALT THIS RUN -- they have already had a round in this sitting. Section 87(b): "A random user from
 *     the Pool; 5 drinks from their selection. Then round 2 loads a DIFFERENT user." So a Roaster meets
 *     three people, not three slices of one -- which means the author's fifteen is not dealt again in
 *     round 2 even though five of fifteen leaves it far from exhausted.
 *
 * THE FIRST VERSION HAD ONLY THE FIRST RULE, AND IT WAS TOO STRICT: it treated any vote as exhausting the
 * whole Submission, so finishing round one produced "Nobody left to roast". Fixing that alone broke
 * 87(b) instead, because a Submission that is not exhausted stays eligible. Both rules are needed, and
 * they answer different questions.
 *
 * NULL IS THE EMPTY-POOL STATE, and §29 is explicit that it is not an error: "It is an invitation to
 * the Census, or a line sending them to the bar."
 */
export function pickContender(
  pooled: Contender[],
  votedCounts: Record<string, number>,
  drinkCounts: Record<string, number>,
  seed: number,
  dealtThisRun: string[] = [],
): Contender | null {
  const spent = new Set(dealtThisRun);
  const available = unexhausted(pooled, votedCounts, drinkCounts).filter(
    (c) => (drinkCounts[c.id] ?? 0) > 0 && !spent.has(c.id),
  );
  if (available.length === 0) return null;
  // A seeded, stable index. `Math.abs` because a seed can be negative and `%` keeps the sign.
  return available[Math.abs(Math.trunc(seed)) % available.length];
}

/**
 * Five drinks from a Submission.
 *
 * WHY IT TAKES THE COUNT RATHER THAN THE SPECS: the round length is `min(5, available)`, exactly the
 * rule `rounds.ts` already implements for the static deck. A Contender who entered three gets a
 * three-card round -- which is why the minimum for a Submission is three and not five.
 */
export function deal(specIds: string[], perRound: number): string[] {
  return specIds.slice(0, Math.max(0, perRound));
}

/**
 * THE NEXT ROUND FROM THE SAME SUBMISSION: the first `perRound` drinks not yet dealt.
 *
 * THIS IS WHAT MAKES A FIFTEEN-CARD SUBMISSION THREE ROUNDS, and it settles a tension between two
 * decisions that read as if they disagree:
 *
 *   section 29  "dealt a Contender they have not exhausted, then FIVE DRINKS FROM THAT SUBMISSION"
 *   section 87  "Then round 2 loads a DIFFERENT user"
 *
 * Read together with the author's own ask -- "we should allow people to continue with the rest of the
 * rounds" -- the shape is: five more from the SAME Submission while it still has drinks left, and a new
 * Contender only once it is exhausted. 87(b)'s "different user" is the general case when several are
 * listed; it is not a rule that a lone Submission may only ever show five cards.
 *
 * Without this, the author's fifteen showed five cards and then "Nobody left to roast" with ten
 * unroasted -- which is the dead end the author walked into on 2026-10-06.
 */
export function nextRound(allSpecIds: string[], dealtSpecIds: string[], perRound: number): string[] {
  const dealt = new Set(dealtSpecIds);
  return allSpecIds.filter((id) => !dealt.has(id)).slice(0, Math.max(0, perRound));
}

/**
 * How many rounds this Roaster can still be given: one per unexhausted Contender, capped.
 *
 * §87(b): "Up to 3 rounds, then end."
 */
export function roundsAvailable(unexhaustedCount: number, cap: number): number {
  return Math.max(0, Math.min(cap, unexhaustedCount));
}

/**
 * A spec as the card needs it. STRUCTURALLY IDENTICAL TO `RoastSpec` in `@/types/roast`, and written
 * out here rather than imported so this module keeps the zero-import rule that lets node run it. A
 * structural type is assignable to the interface, so the deck passes these straight to the card.
 */
export type DealtSpec = {
  id: string;
  /**
   * Which drink it LOOKS like — `specs.cocktail_slug`, the key `cocktailArt` is keyed by. Absent when the
   * two ids agree, which is the static deck's case and only that one. See `@/types/roast`'s `art` for why
   * they are two ids: `id` is the row uuid a vote is stored against, this is the illustration.
   */
  art?: string;
  name: string;
  ingredients: { name: string; amount: string }[];
  glass: string;
  garnish: string;
  method: string;
};

export type SpecRow = {
  id: string;
  /**
   * THE CENSUS SLUG, and the reason this type is not just "the card's spec". `specs.id` is
   * `gen_random_uuid()`; the slug the illustration is named after lives here. Optional because the column
   * is nullable — a corpus row may predate it — and `toRoastSpecs` falls back to `id` rather than
   * dropping the artwork.
   */
  cocktail_slug?: string | null;
  name: string;
  glass_id: string | null;
  technique_id: string | null;
  notes: string | null;
};

export type IngredientRow = {
  spec_id: string;
  position: number;
  amount: string | null;
  raw_name: string | null;
  ingredient_id: string;
};

export type GarnishRow = {
  spec_id: string;
  garnish_group: number;
  position: number;
  element_id: string;
};

/**
 * Assemble database rows into the shape the card renders, in the submission's order.
 *
 * THE INGREDIENT NAME IS THE BRAND, NOT THE GENERIC. `raw_name` is what the recipe actually said --
 * `Fernet Branca` -- and `canonical_name` is what it resolves to. Section 7b stores both precisely so
 * the card can show the first while the data keeps the second. Falling back to the generic is for the
 * case where an older row has no raw name, which is why it is a `??` and not a choice.
 *
 * THE GARNISH IS A PROSE STRING HERE, because that is what the card renders. The axes are NOT lost --
 * they live in `spec_garnish_axes` and are the editor's business -- but a card says `orange twist`, and
 * reconstructing that from nine axes is a different job than dealing a round.
 */
export function toRoastSpecs(
  specs: SpecRow[],
  ingredients: IngredientRow[],
  garnishes: GarnishRow[],
  glassNames: Record<string, string>,
  elementNames: Record<string, string>,
): DealtSpec[] {
  return specs.map((spec) => ({
    id: spec.id,
    // THE ILLUSTRATION KEY, FROM ITS OWN COLUMN. `id` stays the row uuid because that is what
    // `spec_ref` writes into `roast_votes`; `art` is the Census slug the svg is named after.
    art: spec.cocktail_slug ?? spec.id,
    name: spec.name,
    ingredients: ingredients
      .filter((i) => i.spec_id === spec.id)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ name: i.raw_name ?? i.ingredient_id, amount: i.amount ?? "" })),
    glass: spec.glass_id ? glassNames[spec.glass_id] ?? spec.glass_id : "",
    garnish: garnishes
      .filter((g) => g.spec_id === spec.id)
      .sort((a, b) => a.garnish_group - b.garnish_group || a.position - b.position)
      .map((g) => elementNames[g.element_id] ?? g.element_id)
      .join(", "),
    method: spec.notes ?? "",
  }));
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
    if (!ok) throw new Error(`deal self-check failed: ${what}`);
  };
  const block = (text: string): void => {
    console.log();
    console.log(text);
  };

  const c = (id: string, name: string, author = "Anonymous", is_tutorial = false): Contender =>
    ({ id, name, author, is_tutorial });

  const ALL: Contender[] = [
    c("barnerd-15", "BarNerd_420 roast list", "BarNerd_420", true),
    c("list-aaa", "Ana's martinis", "Ana"),
    c("list-bbb", "Ben's tiki", "Ben"),
    c("list-ccc", "Cleo's sours", "Cleo"),
  ];
  const COUNTS: Record<string, number> = { "barnerd-15": 15, "list-aaa": 5, "list-bbb": 3, "list-ccc": 8 };

  // ── 1. the Pool is every LISTED submission ─────────────────────────────────────────────────────
  const listed = pool(ALL, ["barnerd-15", "list-bbb"]);
  check(listed.length === 2, `only listed submissions are in the Pool, got ${listed.length}`);
  check(listed.map((x) => x.id).join() === "barnerd-15,list-bbb", "and the order is preserved");
  check(pool(ALL, []).length === 0, "nothing listed is an empty Pool");
  check(pool(ALL, ["nope"]).length === 0, "a listed id that does not exist contributes nothing");
  block("the Pool is every listed Submission, and nothing else");

  // ── 2. exhaustion is about ALL their drinks, not one vote ──────────────────────────────────────
  const VOTED = (n: number): Record<string, number> => ({ "barnerd-15": n });
  check(unexhausted(listed, VOTED(0), COUNTS).length === 2, "with nothing roasted, both are available");
  check(
    unexhausted(listed, VOTED(5), COUNTS).length === 2,
    "FIVE OF FIFTEEN DOES NOT EXHAUST: the first version said it did, and a visitor who finished round one was told nobody was left",
  );
  check(unexhausted(listed, VOTED(14), COUNTS).length === 2, "fourteen of fifteen is still not exhausted");
  check(unexhausted(listed, VOTED(15), COUNTS).length === 1, "fifteen of fifteen IS, and only that Contender drops out");
  check(
    unexhausted(listed, VOTED(20), COUNTS).length === 1,
    "and more votes than drinks is still just exhausted, not a crash",
  );
  check(
    unexhausted(listed, { "barnerd-15": 15, "list-bbb": 3 }, COUNTS).length === 0,
    "both fully roasted leaves nothing",
  );
  block("exhaustion is all-their-drinks, so finishing a round leaves the next round reachable");

  // ── 3. THE DEAL: a seeded pick, stable for a seed ──────────────────────────────────────────────
  const a = pickContender(listed, {}, COUNTS, 0);
  const b = pickContender(listed, {}, COUNTS, 0);
  check(a !== null && b !== null && a.id === b.id, "the same seed deals the same Contender");
  check(a !== null && a.id === "barnerd-15", `seed 0 takes the first, got ${a?.id}`);
  const c1 = pickContender(listed, {}, COUNTS, 1);
  check(c1 !== null && c1.id === "list-bbb", `seed 1 takes the second, got ${c1?.id}`);
  const c2 = pickContender(listed, {}, COUNTS, 2);
  check(c2 !== null && c2.id === "barnerd-15", `seed 2 wraps around, got ${c2?.id}`);
  // A negative seed must still land on a REAL Contender. `Math.abs(Math.trunc(-3)) % 2` is `1`, so
  // this lands on the second -- the property under test is "in range", not which index.
  const cNeg = pickContender(listed, {}, COUNTS, -3);
  check(
    cNeg !== null && listed.some((x) => x.id === cNeg.id),
    `a negative seed still lands on a real Contender, got ${cNeg?.id}`,
  );
  check(
    pickContender(listed, {}, COUNTS, -1) !== null && pickContender(listed, {}, COUNTS, -99) !== null,
    "and so does any other negative seed",
  );
  block("a seeded pick: the same seed is the same Contender, and a negative seed is still in range");

  // ── 4. round 2 IS A DIFFERENT CONTENDER, and round 1's Submission is not finished ─────────────
  const r1 = pickContender(listed, {}, COUNTS, 0);
  const r2 = pickContender(listed, { "barnerd-15": 5 }, COUNTS, 0, ["barnerd-15"]);
  check(
    r1 !== null && r2 !== null && r1.id === "barnerd-15" && r2.id === "list-bbb",
    `after five of the author's fifteen, round 2 loads somebody else, got ${r2?.id}`,
  );
  check(
    pickContender(listed, { "barnerd-15": 5 }, COUNTS, 0, [])?.id === "barnerd-15",
    "and WITHOUT the run-list, the author's fifteen is still eligible -- five of fifteen is not exhausted",
  );
  const r3 = pickContender(listed, { "barnerd-15": 5, "list-bbb": 3 }, COUNTS, 0, ["barnerd-15", "list-bbb"]);
  check(r3 === null, "with both dealt this run there is no round 3, and that is NULL not an error");
  block("§87(b): each round loads a DIFFERENT Contender, while §29 keeps a part-roasted one in the Pool");

  // ── 5. THE EMPTY POOL IS NOT AN ERROR ──────────────────────────────────────────────────────────
  check(pickContender([], {}, {}, 0) === null, "an empty Pool deals null");
  check(
    pickContender(listed, { "barnerd-15": 15, "list-bbb": 3 }, COUNTS, 0) === null,
    "a fully exhausted Pool deals null",
  );
  check(pickContender(listed, {}, { "barnerd-15": 0, "list-bbb": 0 }, 0) === null, "so does a Pool of empty submissions");
  block("§29: the empty Pool returns null, because the screen decides whether that is the Census or the bar");

  // ── 6. a listed submission with no drinks is not dealt ─────────────────────────────────────────
  const half = pickContender(listed, {}, { "barnerd-15": 15, "list-bbb": 0 }, 1);
  check(half !== null && half.id === "barnerd-15", `an empty submission is skipped, got ${half?.id}`);
  check(
    pickContender(listed, {}, { "barnerd-15": 15 }, 1) !== null,
    "and a missing count is treated as zero rather than as dealable",
  );
  block("a listed submission with no drinks is not dealt -- it would be a round of nothing");

  // ── 7. the round is min(five, available) ───────────────────────────────────────────────────────
  check(deal(["a", "b", "c", "d", "e", "f", "g"], 5).length === 5, "seven drinks deal five");
  check(deal(["a", "b", "c"], 5).length === 3, "three drinks deal three -- the minimum is three, not five");
  check(deal([], 5).length === 0, "no drinks deal nothing");
  check(deal(["a", "b", "c"], 0).length === 0, "a zero-length round deals nothing");
  check(deal(["a", "b", "c"], -2).length === 0, "a negative round deals nothing rather than throwing");
  check(deal(["a", "b", "c"], 5).join() === "a,b,c", "the order is the submission's order");
  block("the round is min(5, available), the same rule rounds.ts already applies to the static deck");

  // ── 7b. THE NEXT ROUND FROM THE SAME SUBMISSION ────────────────────────────────────────────────
  const fifteen = Array.from({ length: 15 }, (_, i) => `s${i + 1}`);
  const n1 = nextRound(fifteen, [], 5);
  check(n1.join() === "s1,s2,s3,s4,s5", `round 1 takes the first five, got ${n1.join()}`);
  const n2 = nextRound(fifteen, n1, 5);
  check(n2.join() === "s6,s7,s8,s9,s10", `round 2 takes the NEXT five, got ${n2.join()}`);
  const n3 = nextRound(fifteen, [...n1, ...n2], 5);
  check(n3.join() === "s11,s12,s13,s14,s15", `round 3 takes the last five, got ${n3.join()}`);
  check(nextRound(fifteen, [...n1, ...n2, ...n3], 5).length === 0, "and a fourth round has nothing left");
  check(nextRound([], [], 5).length === 0, "an empty Submission gives an empty round");
  check(nextRound(["a", "b", "c"], [], 5).length === 3, "three drinks give a three-card round");
  check(
    nextRound(fifteen, ["s3"], 5).join() === "s1,s2,s4,s5,s6",
    "and it skips a drink already dealt, wherever it sits",
  );
  check(nextRound(fifteen, [], 0).length === 0, "a zero-length round takes nothing");
  block("a fifteen-card Submission is three rounds of five, not one round and a dead end");

  // ── 8. how many rounds are left, capped at three ───────────────────────────────────────────────
  check(roundsAvailable(0, 3) === 0, "no unexhausted Contenders is no rounds");
  check(roundsAvailable(1, 3) === 1, "one Contender is one round");
  check(roundsAvailable(3, 3) === 3, "three is three");
  check(roundsAvailable(9, 3) === 3, "§87(b): up to 3 rounds, then end");
  check(roundsAvailable(-1, 3) === 0, "a negative count is no rounds");
  block("up to three rounds, one per Contender the Roaster has not exhausted");

  // ── 9. assembling a dealt spec for the card ──────────────────────────────────────────────────
  const SPECS: SpecRow[] = [
    { id: "s1", cocktail_slug: "old-fashioned", name: "Ana's Old Fashioned", glass_id: "old-fashioned-glass", technique_id: "stir", notes: "Stir long." },
    { id: "s2", name: "Ana's Daiquiri", glass_id: "coupe-glass", technique_id: "shake", notes: null },
  ];
  const INGS: IngredientRow[] = [
    { spec_id: "s1", position: 0, amount: "4.5 cl", raw_name: "Bourbon whiskey", ingredient_id: "bourbon" },
    { spec_id: "s1", position: 1, amount: "1", raw_name: null, ingredient_id: "sugar" },
    { spec_id: "s2", position: 0, amount: "6 cl", raw_name: "Havana Club 3 Year Old", ingredient_id: "white-rum" },
  ];
  const GARNS: GarnishRow[] = [
    { spec_id: "s1", garnish_group: 0, position: 0, element_id: "orange" },
    { spec_id: "s1", garnish_group: 1, position: 0, element_id: "cherry" },
  ];
  const GLASSES = { "old-fashioned-glass": "Old-fashioned glass", "coupe-glass": "Coupe glass" };
  const ELEMENTS = { orange: "orange", cherry: "cherry" };

  const dealt = toRoastSpecs(SPECS, INGS, GARNS, GLASSES, ELEMENTS);
  check(dealt.length === 2, `two specs in, two out, got ${dealt.length}`);
  check(dealt[0].id === "s1" && dealt[1].id === "s2", "in the order given");
  check(dealt[0].glass === "Old-fashioned glass", `the glass is its NAME, got '${dealt[0].glass}'`);
  check(dealt[0].ingredients.length === 2, "only its own ingredients");
  check(dealt[0].ingredients[0].name === "Bourbon whiskey", "THE BRAND, not the generic");
  check(dealt[0].ingredients[1].name === "sugar", "and the generic only when there is no raw name");
  check(dealt[0].ingredients[1].amount === "1", "a bare amount survives as written");
  check(dealt[0].garnish === "orange, cherry", `the garnish is a prose string in order, got '${dealt[0].garnish}'`);
  check(dealt[1].garnish === "", "a spec with no garnish renders an empty string, not 'undefined'");
  check(dealt[1].method === "", "and no notes renders an empty string");
  check(dealt[0].method === "Stir long.", "notes become the method");
  check(dealt[0].art === "old-fashioned", `the illustration key is the SLUG, not the row id, got '${dealt[0].art}'`);
  check(dealt[1].art === "s2", "a row with no slug falls back to its id rather than losing its artwork");
  check(dealt[0].id === "s1", "and the vote's spec_ref is still the row id");

  const outOfOrder = toRoastSpecs(
    SPECS,
    [...INGS].reverse(),
    [...GARNS].reverse(),
    GLASSES,
    ELEMENTS,
  );
  check(outOfOrder[0].ingredients[0].name === "Bourbon whiskey", "ingredients sort by position, not by arrival");
  check(outOfOrder[0].garnish === "orange, cherry", "garnishes sort by group then position");
  block("the card's shape is assembled in the submission's order, showing the brand the recipe wrote");

  block(`all ${checks} deal checks passed`);
}
