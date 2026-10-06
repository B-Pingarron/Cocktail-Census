/**
 * The round arithmetic — how a deck of specs becomes Rounds, and how one round is counted.
 *
 * WHY THIS IS ITS OWN MODULE: the deck's whole shape changed on 2026-10-05. It used to be one
 * fifteen-card commitment you either finished or abandoned; it is now a repeating loop of up to five,
 * which is what lets a visitor stop after any round with a complete, countable unit of data instead
 * of a half-finished deck. That boundary is arithmetic, and arithmetic does not belong in a component.
 *
 * NO IMPORTS, AND RUNNABLE DIRECTLY UNDER NODE (`node src/lib/rounds.ts`), the same rule as
 * verdict.ts. A `.ts` file that imports nothing can be run by node with no bundler, so the numbers the
 * deck renders come from the same code the check below exercises — never from a replica written to
 * agree with it. That rule has already caught three wrong numbers in this project.
 *
 * THE GENERAL CASE IS `min(5, selection size)`, and the deck is the special case where the selection
 * is the author's whole fifteen. A Contender who brings three gets a three-card round; the author's
 * fifteen gets three rounds of five. Nothing here assumes fifteen.
 */

/** Up to five specs a round. `min(SPECS_PER_ROUND, selection size)`. */
export const SPECS_PER_ROUND = 5;

/**
 * The side a visitor picked on one card, or null for a spec they skipped.
 *
 * TWO VOCABULARIES, AND THIS IS THE JOIN BETWEEN THEM. The buttons say **Likes** and **Yikes** — that
 * is the room's voice, and it is what the deck holds in state. The database stores `agree` /
 * `disagree`, which is the tally's voice. So the values here are the BUTTON ones, and the recap counts
 * them into the database's two buckets — which is why the fields below are named agreed/disagreed
 * rather than likes/yikes.
 *
 * This was wrong on the first pass: the type was written as "likes" | "dislikes", a plausible guess
 * that would have silently counted every disagreement as NEITHER side. The type-checker caught it,
 * which is the whole reason `tsc -b` runs before a browser does.
 */
export type RecapSide = "likes" | "yikes" | null;

/** Which round a spec at `index` belongs to, 0-based. */
export function roundOf(index: number, per: number = SPECS_PER_ROUND): number {
  return Math.floor(index / per);
}

/**
 * How many rounds a deck of `total` specs makes.
 *
 * A deck of zero still reports one round: the deck always shows something, and "round 0 of 0" is a
 * sentence no screen should be able to print.
 */
export function roundCount(total: number, per: number = SPECS_PER_ROUND): number {
  return Math.max(1, Math.ceil(total / per));
}

/**
 * Is `index` the last spec of its round?
 *
 * The deck's final card always ends a round, even when it lands mid-round — a three-spec deck ends at
 * index 2, not at index 4, which is the case that would otherwise strand a visitor inside a round
 * that can never complete.
 */
export function isRoundEnd(index: number, total: number, per: number = SPECS_PER_ROUND): boolean {
  if (index >= total - 1) return true;
  return (index + 1) % per === 0;
}

/**
 * The half-open bounds of a round, clamped to the deck.
 *
 * Both ends are clamped. Clamping only the end produces an inverted range for a round past the end of
 * a short deck — `[10, 3]` — which slices to nothing on a good day and to something wrong on a bad one.
 */
export function roundBounds(
  round: number,
  total: number,
  per: number = SPECS_PER_ROUND
): [number, number] {
  const start = Math.min(Math.max(0, round) * per, total);
  return [start, Math.min(start + per, total)];
}

/** The items belonging to one round, in deck order. */
export function roundVotes<T>(items: readonly T[], round: number, per: number = SPECS_PER_ROUND): T[] {
  const [start, end] = roundBounds(round, items.length, per);
  return items.slice(start, end);
}

export interface RoundRecap {
  /** 1-based, because it is printed. */
  round: number;
  rounds: number;
  agreed: number;
  disagreed: number;
  /** Seen and deliberately not voted on. Not the same as not reached. */
  skipped: number;
  /** agreed + disagreed. What the visitor actually answered. */
  seen: number;
  /** How many specs this round held. */
  total: number;
}

/**
 * One round's recap, counted from the votes the deck already holds.
 *
 * `seen` is deliberately not `total`: a skipped spec is an honest answer and the count has to keep it
 * separate from one nobody reached, or the recap reports an opinion the visitor never gave.
 */
export function recapRound(
  votes: readonly RecapSide[],
  round: number,
  rounds: number,
  per: number = SPECS_PER_ROUND
): RoundRecap {
  const slice = roundVotes(votes, round, per);
  let agreed = 0;
  let disagreed = 0;
  for (const side of slice) {
    if (side === "likes") agreed++;
    else if (side === "yikes") disagreed++;
  }
  return {
    round: round + 1,
    rounds,
    agreed,
    disagreed,
    skipped: slice.length - agreed - disagreed,
    seen: agreed + disagreed,
    total: slice.length,
  };
}

/**
 * The recap in one line. Every sentence the round boundary prints lives here, for the same reason
 * every sentence the verdict prints lives in verdict.ts: copy and arithmetic that disagree are a bug
 * with no error message.
 */
export function recapLine(r: RoundRecap): string {
  const head = `Round ${r.round} of ${r.rounds}.`;
  if (r.seen === 0) return `${head} Nothing voted — that is allowed.`;
  if (r.agreed === r.seen) return `${head} You agreed with all ${r.seen}.`;
  if (r.agreed === 0) return `${head} You agreed with none of the ${r.seen}.`;
  return `${head} You agreed with ${r.agreed} of the ${r.seen}.`;
}

/** The quiet second line: what was skipped, and what is left. */
export function recapSubline(r: RoundRecap): string {
  const parts: string[] = [];
  if (r.skipped > 0) parts.push(`${r.skipped} skipped`);
  const left = r.rounds - r.round;
  if (left > 0) parts.push(`${left} round${left === 1 ? "" : "s"} left`);
  else parts.push("that was the last round");
  return parts.join(" · ");
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
  // Every check throws, so a wrong number exits non-zero: the run's output is the evidence.
  let checks = 0;
  const check = (ok: boolean, what: string): void => {
    checks++;
    if (!ok) throw new Error(`rounds self-check failed: ${what}`);
  };
  const block = (text: string): void => {
    console.log();
    console.log(text);
  };

  // ── 1. the deck the author actually has: fifteen, five a round, three rounds ───────────────────
  check(roundOf(0) === 0 && roundOf(4) === 0, "the first five specs are round 0");
  check(roundOf(5) === 1 && roundOf(9) === 1, "the second five are round 1");
  check(roundOf(14) === 2, "the fifteenth spec is round 2");
  check(roundCount(15) === 3, `fifteen specs make three rounds, got ${roundCount(15)}`);
  check(roundBounds(0, 15).join() === "0,5", "round 0 is [0,5)");
  check(roundBounds(1, 15).join() === "5,10", "round 1 is [5,10)");
  check(roundBounds(2, 15).join() === "10,15", "round 2 is [10,15)");
  block("fifteen specs: three rounds of five, and the bounds tile the deck with no gap");

  // ── 2. the boundaries a visitor is actually stopped at ────────────────────────────────────────
  check(isRoundEnd(4, 15), "index 4 ends a round");
  check(!isRoundEnd(5, 15), "index 5 does not");
  check(isRoundEnd(9, 15), "index 9 ends a round");
  check(isRoundEnd(14, 15), "the last card ends a round");
  check(!isRoundEnd(7, 15), "index 7 does not");
  block("round ends land on 4, 9 and 14 — three stops in a deck of fifteen");

  // ── 3. the short deck, which is where clamping is actually tested ─────────────────────────────
  check(roundCount(3) === 1, `three specs make one round, got ${roundCount(3)}`);
  check(isRoundEnd(2, 3), "a three-spec deck ends at index 2, not at 4");
  check(roundBounds(0, 3).join() === "0,3", "a three-spec round is [0,3)");
  check(roundBounds(1, 3).join() === "3,3", "a round past the end of a short deck is empty, never inverted");
  check(roundCount(16) === 4, "one spec over the cap makes a fourth round");
  check(roundCount(0) === 1, "an empty deck still reports one round, so no screen prints 'round 0 of 0'");
  block("short decks: no inverted range, no stranded round, no 'round 0 of 0'");

  // ── 4. the recap counts ───────────────────────────────────────────────────────────────────────
  const deck: RecapSide[] = [
    "likes", "likes", "yikes", null, "likes", // round 0
    "yikes", "yikes", null, null, null,        // round 1
    "likes", "likes", "likes", "likes", "likes",  // round 2
  ];
  const r0 = recapRound(deck, 0, 3);
  const r1 = recapRound(deck, 1, 3);
  const r2 = recapRound(deck, 2, 3);

  check(r0.agreed === 3 && r0.disagreed === 1 && r0.skipped === 1 && r0.seen === 4, "round 0 counts 3 agree, 1 disagree, 1 skipped");
  check(r1.agreed === 0 && r1.disagreed === 2 && r1.skipped === 3, "round 1 counts 0 agree, 2 disagree, 3 skipped");
  check(r2.agreed === 5 && r2.seen === 5 && r2.skipped === 0, "round 2 counts 5 agree and nothing skipped");
  check(r0.total === 5 && r1.total === 5 && r2.total === 5, "every full round holds five specs");
  block(`recap counts: round 0 ${r0.agreed}/${r0.seen}, round 1 ${r1.agreed}/${r1.seen}, round 2 ${r2.agreed}/${r2.seen}`);

  // ── 5. a skipped spec is never counted as an opinion ──────────────────────────────────────────
  const allSkipped = recapRound([null, null, null, null, null], 0, 1);
  check(allSkipped.seen === 0 && allSkipped.skipped === 5, "five skips are five skips, not five disagreements");
  check(allSkipped.agreed === 0 && allSkipped.disagreed === 0, "a skip is neither side");
  check(recapLine(allSkipped).includes("Nothing voted"), "an empty round says so rather than reporting zero of five");
  block("a skip is not a vote: the recap separates 'no opinion' from 'not reached'");

  // ── 6. the sentences ──────────────────────────────────────────────────────────────────────────
  check(recapLine(r0) === "Round 1 of 3. You agreed with 3 of the 4.", `round 0 line: ${recapLine(r0)}`);
  check(recapLine(r1) === "Round 2 of 3. You agreed with none of the 2.", `round 1 line: ${recapLine(r1)}`);
  check(recapLine(r2) === "Round 3 of 3. You agreed with all 5.", `round 2 line: ${recapLine(r2)}`);
  check(recapSubline(r0) === "1 skipped · 2 rounds left", `round 0 subline: ${recapSubline(r0)}`);
  check(recapSubline(r2) === "that was the last round", `round 2 subline: ${recapSubline(r2)}`);
  block("the recap sentences, including 'that was the last round' on the final stop");

  block(`all ${checks} round checks passed`);
}
