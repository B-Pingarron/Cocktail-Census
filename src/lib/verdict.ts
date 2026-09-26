/**
 * The verdict — the arithmetic and the copy of the roast's last screen, in one pure module.
 *
 * ZERO IMPORTS, AND THAT IS LOAD-BEARING. This module is run directly under node
 * (`node src/lib/verdict.ts`), the way frameGeometry.ts is, so the numbers the screen renders come from
 * the code that computes them rather than from a copy of it. The roast surface has no test harness on
 * purpose; the direct run at the bottom is where its arithmetic is checked and printed.
 *
 * ZERO WRITES, AND ZERO KNOWLEDGE OF THE DATABASE — no client, no table name, no query. It is handed
 * rows and gives back numbers and sentences, which is what lets it run with no browser and no network.
 *
 * THE COPY LIVES WITH THE ARITHMETIC, because the two are one product decision: a bucket no line names,
 * or a line no bucket reaches, is a screen a visitor cannot be given. Every string a visitor reads here
 * is either the author's own (marked as such) or marked DRAFT.
 *
 * AGGREGATE ONLY. There is no per-drink comparison anywhere in this file, by design: one rate against
 * the classics, one against the author, and the per-spec rows are the room's own split.
 */

// ── rows ─────────────────────────────────────────────────────────────────────────────────────

/** The two values the tables' CHECK constraints allow. */
export type VoteValue = "agree" | "disagree";

/** One row of `roast_votes`, narrowed to the columns the verdict reads. */
export interface RoastVoteRow {
  session_id: string;
  /** The spec's id — a plain string, deliberately not a foreign key (types/roast.ts). */
  spec_ref: string;
  vote: VoteValue;
  /** Premade note ids. An empty array is a legal vote; a null is read as empty. */
  labels: string[] | null;
}

/** One row of the census `votes` table, narrowed to the columns the verdict reads. */
export interface CensusVoteRow {
  cocktail_id: string;
  vote: VoteValue;
}

// ── tallies ──────────────────────────────────────────────────────────────────────────────────

/**
 * A count of votes plus the rate they produce.
 *
 * `rate` IS NULL WHEN THE SAMPLE IS EMPTY, and null is deliberately not 0: 0% would claim the visitor
 * disagreed with everything, the opposite of "has not voted yet", and the bucket table below depends
 * on telling the two apart.
 */
export interface Tally {
  agree: number;
  disagree: number;
  /** The sample size — agree + disagree, which is what the author's rules call "rated". */
  total: number;
  /** agree / total, or null when nothing has been voted on. */
  rate: number | null;
}

/**
 * The one tally implementation, used for every rate on this screen — the visitor's own, the classics,
 * and each spec's share of the room. A second copy for one of those is exactly the pair that drifts.
 */
export function tally(votes: readonly { vote: VoteValue }[]): Tally {
  let agree = 0;
  let disagree = 0;
  for (const row of votes) {
    if (row.vote === "agree") agree++;
    else disagree++;
  }
  const total = agree + disagree;
  return { agree, disagree, total, rate: total === 0 ? null : agree / total };
}

/**
 * Deduplicate the visitor's census votes by cocktail: LAST VOTE WINS.
 *
 * The `votes` table can hold more than one row for one session and one cocktail — a reset and a second
 * walk through the census does exactly that — and counting both would skew the rate. The rows must
 * already be in write order (the read orders by timestamp); without that, "last" would mean whatever
 * order the server happened to return. Map.set keeps the position of the first insert and replaces the
 * value, so the survivor is the last row written.
 */
export function dedupeCensusVotes(rows: readonly CensusVoteRow[]): CensusVoteRow[] {
  const byCocktail = new Map<string, CensusVoteRow>();
  for (const row of rows) byCocktail.set(row.cocktail_id, row);
  return [...byCocktail.values()];
}

// ── the author's own verdict on the visitor ──────────────────────────────────────────────────

export type OwnBucketId = "held-the-phone" | "agreed" | "disagreed" | "disagreed-more" | "agreed-more" | "split";

export interface OwnBucket {
  id: OwnBucketId;
  text: string;
  test: (tally: Tally) => boolean;
}

/**
 * THE SIX LINES ARE THE AUTHOR'S OWN, inherited verbatim from the hub prototype — not reworded, not
 * shortened, not softened. Nobody is called a loser, and that is the whole tone.
 *
 * ORDER IS THE ALGORITHM, first match wins, and the first row is what makes the order load-bearing:
 * with no votes at all `agree === total` is also true (0 === 0), so "Held the phone" has to be asked
 * before "Agreed with everything", or an empty deck is congratulated for agreeing with all fifteen.
 * The last row is the catch-all: rows 2–5 plus this one are total, so no tally falls through.
 */
export const OWN_BUCKETS: readonly OwnBucket[] = [
  { id: "held-the-phone", test: (t) => t.total === 0, text: "Held the phone. Committed to nothing. Respect, of a kind." },
  { id: "agreed", test: (t) => t.agree === t.total, text: "Agreed with everything. Either generous, or dangerously easy to please." },
  { id: "disagreed", test: (t) => t.disagree === t.total, text: "Disagreed with every single spec. Somebody get this one a bar." },
  { id: "disagreed-more", test: (t) => t.disagree > t.agree, text: "Disagreed more than agreed. The industry needs people like you and resents them." },
  { id: "agreed-more", test: (t) => t.agree > t.disagree, text: "Mostly agreed, with reservations. A diplomat behind the stick." },
  { id: "split", test: () => true, text: "Split straight down the middle. Diplomatic, or undecided about rum." },
];

/** The visitor's bucket: the first matching row of {@link OWN_BUCKETS}. */
export function ownBucket(t: Tally): OwnBucket {
  for (const bucket of OWN_BUCKETS) {
    if (bucket.test(t)) return bucket;
  }
  // Unreachable — the table's last row accepts everything. Returned rather than thrown so a verdict
  // always has a line to show even if the table is one day reordered by mistake.
  return OWN_BUCKETS[OWN_BUCKETS.length - 1];
}

// ── the cross-comparison ─────────────────────────────────────────────────────────────────────

export interface CrossInput {
  /** The visitor's roast tally: their agreement with the author. */
  own: Tally;
  /** The visitor's census tally, already deduplicated: their agreement with the classics. */
  classics: Tally;
}

export type CrossBranchId = "both-low" | "consistent" | "harder" | "kinder";

export interface CrossLine {
  id: CrossBranchId;
  text: string;
  test: (input: CrossInput) => boolean;
}

/** The low bar for "does not agree". Both rates under it is its own observation. */
export const LOW_RATE = 0.35;

/** How far apart the two rates may sit and still count as one palate. */
export const RATE_BAND = 0.1;

/**
 * The author's line for a visitor who has not voted the classics yet. Checked BEFORE the table below,
 * because every branch in it compares two rates and this visitor has only one.
 */
export const NO_CLASSICS_LINE =
  "You haven't done the classics yet. Do the Census and come back — then we'll know if it's your taste or just mine.";

/**
 * DRAFT — AWAITING THE AUTHOR'S APPROVAL. He did not pick a wording for these four branches; three
 * alternatives were offered for the hint and none was picked, and these are the agent's on the same
 * footing. Kept in ONE exported table, ordered, first match wins, so replacing a line is a one-line edit
 * and moving a branch is moving a row. Each test requires both rates to exist — `Tally.rate` is null
 * whenever its sample is empty, which is why {@link crossLine} can return null rather than a branch that
 * quietly matched nothing.
 */
export const CROSS_LINES: readonly CrossLine[] = [
  { id: "both-low", text: "You don't agree with the classics or with me. You might just be right.",
    test: (i) => bothRates(i, (own, classics) => own < LOW_RATE && classics < LOW_RATE) },
  { id: "consistent", text: "You agree with the classics about as often as you agree with me. Consistent palate.",
    test: (i) => bothRates(i, (own, classics) => Math.abs(own - classics) <= RATE_BAND) },
  { id: "harder", text: "You're harder on mine than on the classics. Noted.",
    test: (i) => bothRates(i, (own, classics) => own < classics - RATE_BAND) },
  { id: "kinder", text: "Kinder to me than the classics. I'll take it, but I'm suspicious.",
    test: (i) => bothRates(i, (own, classics) => own > classics + RATE_BAND) },
];

/** Both rates, or no branch. One place for the null guard every test in the table needs. */
function bothRates(
  input: CrossInput,
  compare: (own: number, classics: number) => boolean
): boolean {
  const own = input.own.rate;
  const classics = input.classics.rate;
  return own !== null && classics !== null && compare(own, classics);
}

export type CrossVerdict =
  | { id: "no-classics"; text: string }
  | { id: CrossBranchId; text: string };

/**
 * The cross-comparison line, or null.
 *
 * Null means "say nothing", and there is exactly one way to reach it: the visitor rated none of the
 * author's specs, so there is no own rate to compare. Every branch would have to invent a rate, and a
 * rate with no votes behind it is a claim about nothing. It is not a lost state — the bucket line
 * above already answers for an empty tally.
 */
export function crossLine(input: CrossInput): CrossVerdict | null {
  if (input.classics.total === 0) return { id: "no-classics", text: NO_CLASSICS_LINE };
  const hit = CROSS_LINES.find((line) => line.test(input));
  return hit ? { id: hit.id, text: hit.text } : null;
}

// ── the room ─────────────────────────────────────────────────────────────────────────────────

export interface RoomSpecTally {
  specRef: string;
  tally: Tally;
}

/**
 * The room's votes grouped by spec. A spec with no votes has NO ENTRY, and that is the interface: the
 * screen looks a spec up, and a miss is what it renders as "waiting". A spec reading 0 / 0 would be a
 * claim the room has not made.
 */
export function tallyBySpec(rows: readonly RoastVoteRow[]): Map<string, RoomSpecTally> {
  const grouped = new Map<string, { vote: VoteValue }[]>();
  for (const row of rows) {
    const group = grouped.get(row.spec_ref);
    if (group) group.push(row);
    else grouped.set(row.spec_ref, [row]);
  }

  const tallies = new Map<string, RoomSpecTally>();
  for (const [specRef, votes] of grouped) tallies.set(specRef, { specRef, tally: tally(votes) });
  return tallies;
}

export interface LabelCount { id: string; count: number; }

/**
 * Every label id in these rows, counted — the aggregate the derived line reads. A vote carries at most
 * one id per axis; a vote with no labels contributes nothing.
 */
export function labelCounts(rows: readonly RoastVoteRow[]): LabelCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const id of row.labels ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  // Ties break on the id so the array has one order on every run; the winner is chosen elsewhere.
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/**
 * The most-picked label among `ids` (the element axis, supplied by the caller — this module has no
 * import and cannot read the vocabulary itself). Ties go to the earlier id in `ids`, which is the
 * vocabulary's own order, so the line is stable rather than dependent on a Map's iteration order.
 */
export function topLabel(counts: readonly LabelCount[], ids: readonly string[]): LabelCount | null {
  let best: LabelCount | null = null;
  for (const id of ids) {
    const hit = counts.find((count) => count.id === id);
    if (hit && (!best || hit.count > best.count)) best = hit;
  }
  return best;
}

/**
 * The one mechanically derived line on the screen: the room's most-picked element among its
 * disagreements. NO NEW VOICE IS AUTHORED — the label text is the chip's own and the sentence around it
 * is generated. A null label text (no labelled disagree votes at all) skips the line entirely rather
 * than printing "the room mostly fights you on nothing".
 */
export function fightLine(labelText: string | null): string | null {
  return labelText ? `the room mostly fights you on ${labelText}` : null;
}

/** The blocks a split bar is drawn with. */
export const SPLIT_BLOCKS = 12;

export interface SplitBar {
  agree: number;
  disagree: number;
  empty: number;
  /** How many blocks the bar has, so the caller never restates the number. */
  blocks: number;
}

/**
 * The per-spec split, as blocks. TWO RULES, AND THEY ARE DIFFERENT THINGS:
 *   - the bar fills in proportion to the SAMPLE, up to `blocks`, so a spec with two votes cannot look
 *     like a spec with forty;
 *   - within the filled part the split is proportional, with a floor of one block for a side that has
 *     votes at all — a lone vote in a large sample is not the same as no vote, and rounding would erase
 *     it.
 * The counts are always printed beside the bar: the bar is the glance, the counts are the record.
 */
export function splitBar(t: Tally, blocks: number = SPLIT_BLOCKS): SplitBar {
  if (t.total === 0) return { agree: 0, disagree: 0, empty: blocks, blocks };

  const filled = Math.min(t.total, blocks);
  let agree = Math.round((t.agree / t.total) * filled);
  if (t.agree > 0 && agree === 0) agree = 1;
  if (t.disagree > 0 && agree === filled) agree = filled - 1;

  return { agree, disagree: filled - agree, empty: blocks - filled, blocks };
}

// ── rates, printed ───────────────────────────────────────────────────────────────────────────

/** A rate as a whole percentage, or an em dash when there is no sample to take a rate from. */
export function formatPercent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/**
 * DRAFT — AWAITING THE AUTHOR'S APPROVAL. Written by the agent; the author picked no wording for it.
 * It sits under the two tallies and points at them, which is why the tallies are not optional on the
 * screen: the line is meaningless without the numbers.
 */
export const VERDICT_HINT = "Both tallies are on the board. Read them like a closing count.";

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
  // Every check throws, so a wrong table exits non-zero: the run's output is the evidence.
  let checks = 0;
  const check = (ok: boolean, what: string): void => {
    checks++;
    if (!ok) throw new Error(`verdict self-check failed: ${what}`);
  };

  /** A line on its own, with the blank line that separates it from the block above. */
  const block = (text: string): void => { console.log(); console.log(text); };

  // A tally built THROUGH `tally`, so the printed numbers come from the function the screen calls.
  const sample = (agree: number, disagree: number): Tally =>
    tally(
      Array.from({ length: agree + disagree }, (_, i) => ({
        vote: (i < agree ? "agree" : "disagree") as VoteValue,
      }))
    );

  const row = (specRef: string, vote: VoteValue, labels: string[]): RoastVoteRow => ({
    session_id: "s",
    spec_ref: specRef,
    vote,
    labels,
  });

  // ── 1. the visitor's own buckets ──────────────────────────────────────────────────────────────
  const ownCases: [number, number, OwnBucketId][] = [
    [0, 0, "held-the-phone"],
    [5, 0, "agreed"],
    [0, 5, "disagreed"],
    [2, 5, "disagreed-more"],
    [5, 2, "agreed-more"],
    [3, 3, "split"],
    [1, 1, "split"],
  ];

  console.log("own bucket — the author's six lines, first match wins");
  console.log("rated  agree  disagree   rate  bucket                          line");
  for (const [agree, disagree, expected] of ownCases) {
    const t = sample(agree, disagree);
    const bucket = ownBucket(t);
    check(bucket.id === expected, `own bucket for ${agree}/${disagree}: expected ${expected}, got ${bucket.id}`);
    console.log(
      `${String(t.total).padStart(5)}${String(t.agree).padStart(7)}${String(t.disagree).padStart(10)}` +
        `${formatPercent(t.rate).padStart(7)}  ${bucket.id.padEnd(30)}  ${bucket.text}`
    );
  }

  const reachedBuckets = new Set<OwnBucketId>();
  for (let agree = 0; agree <= 8; agree++) {
    for (let disagree = 0; disagree <= 8; disagree++) {
      reachedBuckets.add(ownBucket(sample(agree, disagree)).id);
    }
  }
  check(reachedBuckets.size === OWN_BUCKETS.length, `six own buckets reachable, got ${reachedBuckets.size}`);
  block(
    `own buckets reached by a 0..8 x 0..8 sweep: ${reachedBuckets.size}/6 — ` +
      `${[...reachedBuckets].sort().join(", ")}`
  );

  // ── 2. the cross-comparison ───────────────────────────────────────────────────────────────────
  const crossCases: { name: string; own: [number, number]; classics: [number, number]; expected: string | null }[] = [
    { name: "no census votes at all", own: [3, 2], classics: [0, 0], expected: "no-classics" },
    { name: "both rates low", own: [2, 8], classics: [1, 4], expected: "both-low" },
    { name: "both low outranks the band", own: [2, 8], classics: [2, 8], expected: "both-low" },
    { name: "inside the band", own: [1, 1], classics: [11, 9], expected: "consistent" },
    { name: "exactly -10pt", own: [4, 6], classics: [1, 1], expected: "consistent" },
    { name: "exactly +10pt", own: [6, 4], classics: [1, 1], expected: "consistent" },
    { name: "past -10pt", own: [39, 61], classics: [1, 1], expected: "harder" },
    { name: "past +10pt", own: [61, 39], classics: [1, 1], expected: "kinder" },
    { name: "nothing rated by the visitor", own: [0, 0], classics: [1, 1], expected: null },
  ];

  block("cross-comparison — aggregate only, never per drink, first match wins");
  console.log("case                           own  classics   diff  branch        line");
  for (const c of crossCases) {
    const own = sample(c.own[0], c.own[1]);
    const classics = sample(c.classics[0], c.classics[1]);
    const line = crossLine({ own, classics });
    const id = line ? line.id : "(no line)";
    check(id === (c.expected ?? "(no line)"), `cross branch for ${c.name}: expected ${c.expected ?? "(no line)"}, got ${id}`);
    const delta = own.rate === null || classics.rate === null ? null : own.rate - classics.rate;
    console.log(
      `${c.name.padEnd(30)}${formatPercent(own.rate).padStart(4)}${formatPercent(classics.rate).padStart(10)}` +
        `${(delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`).padStart(7)}  ` +
        `${id.padEnd(13)} ${line ? line.text : "—"}`
    );
  }

  const reachedCross = new Set<string>();
  const fractions: [number, number][] = [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]];
  for (const [agree, total] of fractions) {
    for (const [cAgree, cTotal] of fractions) {
      const line = crossLine({ own: sample(agree, total - agree), classics: sample(cAgree, cTotal - cAgree) });
      check(line !== null, `rates ${agree}/${total} vs ${cAgree}/${cTotal} always match a branch`);
      if (line) reachedCross.add(line.id);
    }
  }
  check(reachedCross.size === CROSS_LINES.length, `four draft branches reachable, got ${reachedCross.size}`);
  block(
    `cross branches reached by a 0/25/50/75/100% grid: ${reachedCross.size}/4 + "no-classics" — ` +
      `${[...reachedCross].sort().join(", ")}`
  );

  // ── 3. the room, spec by spec ─────────────────────────────────────────────────────────────────
  const roomRows: RoastVoteRow[] = [
    row("old-fashioned", "agree", []),
    row("old-fashioned", "disagree", ["el-balance", "lvl-cringe"]),
    row("daiquiri", "agree", ["el-ingredients"]),
    row("daiquiri", "disagree", ["el-balance"]),
    row("toronto", "disagree", ["el-balance", "lvl-gross"]),
  ];
  const bySpec = tallyBySpec(roomRows);

  check(bySpec.size === 3, `grouping three specs, got ${bySpec.size}`);
  check(bySpec.get("old-fashioned")?.tally.agree === 1, "a mixed spec counts both sides");
  check(bySpec.get("old-fashioned")?.tally.total === 2, "a mixed spec's sample is both sides");
  check(bySpec.get("toronto")?.tally.rate === 0, "an all-disagree spec rates 0, not null");
  check(bySpec.get("espresso-martini") === undefined, "an unvoted spec has no entry — the screen reads it as waiting");

  block(`room tally — one row per spec with votes (the screen adds the rest as waiting, ${SPLIT_BLOCKS}-block bars)`);
  console.log("spec                        agree  disagree  total   rate  bar");
  for (const [specRef, entry] of bySpec) {
    const bar = splitBar(entry.tally);
    console.log(
      `${specRef.padEnd(28)}${String(entry.tally.agree).padStart(5)}${String(entry.tally.disagree).padStart(10)}` +
        `${String(entry.tally.total).padStart(7)}${formatPercent(entry.tally.rate).padStart(7)}  ` +
        `${"=".repeat(bar.agree)}${"x".repeat(bar.disagree)}${".".repeat(bar.empty)}`
    );
  }
  console.log("(bar: '=' agree, 'x' disagree, '.' unfilled — filled by sample size up to the block count)");

  // ── 4. the derived line ───────────────────────────────────────────────────────────────────────
  const elementIds = ["el-balance", "el-ingredients", "el-glass-garnish"];
  const disagreeLabels = labelCounts(roomRows.filter((r) => r.vote === "disagree"));
  const top = topLabel(disagreeLabels, elementIds);

  check(top?.id === "el-balance" && top.count === 3, "the top element label is the most-picked one");
  check(topLabel(labelCounts([]), elementIds) === null, "no labelled disagree votes means no top label");
  check(fightLine(null) === null, "the derived line is skipped entirely, not printed empty");
  check(fightLine("balance") === "the room mostly fights you on balance", "the derived line is generated, never authored");
  block(`disagree labels counted: ${disagreeLabels.map((l) => `${l.id}=${l.count}`).join(" ")}`);
  console.log(`derived line: ${fightLine(top ? "balance" : null)}`);

  // ── 5. the census read ────────────────────────────────────────────────────────────────────────
  const censusRows: CensusVoteRow[] = [
    { cocktail_id: "negroni", vote: "disagree" },
    { cocktail_id: "daiquiri", vote: "agree" },
    { cocktail_id: "negroni", vote: "agree" },
  ];
  const deduped = dedupeCensusVotes(censusRows);

  check(deduped.length === 2, `duplicate census rows collapse to one per cocktail, got ${deduped.length}`);
  check(deduped.find((r) => r.cocktail_id === "negroni")?.vote === "agree", "the last vote for a cocktail wins");
  check(tally(deduped).rate === 1, "the rate comes from the deduplicated rows");
  block(`census dedupe: ${censusRows.length} rows -> ${deduped.length} cocktails, rate ${formatPercent(tally(deduped).rate)}`);

  // ── 6. the split bar's two rules ──────────────────────────────────────────────────────────────
  check(splitBar(sample(0, 0)).empty === SPLIT_BLOCKS, "no votes means an entirely unlit bar");
  check(Object.values(splitBar(sample(1, 1))).join() === `1,1,${SPLIT_BLOCKS - 2},${SPLIT_BLOCKS}`, "a two-vote split is one block each");
  check(Object.values(splitBar(sample(60, 40))).join() === `7,5,0,${SPLIT_BLOCKS}`, "60/40 of 100 fills the bar 7 to 5");
  check(splitBar(sample(1, 1000)).agree === 1, "one agreement in a thousand still shows, never as zero");
  check(splitBar(sample(1000, 1)).disagree === 1, "one disagreement in a thousand still shows");
  block(`split bar rules checked (${SPLIT_BLOCKS} blocks, presence floor, sample-scaled fill)`);

  block(`all ${checks} verdict checks passed`);
}
