/**
 * The amount arithmetic — how a quantity and a unit become the string a recipe shows.
 *
 * WHY THIS IS ITS OWN MODULE: the editor writes `spec_ingredients.amount`, which is TEXT. The corpus
 * writes it as `number + space + unit` — `1.5 cl`, `3 cl`, `2 dash`, `2 drops` — and there is no unit
 * vocabulary anywhere in the schema: 253 distinct values, and ZERO of them are a bare number. So the
 * editor has to compose that string, and composing it is arithmetic and grammar, not layout. Arithmetic
 * does not belong in a component.
 *
 * THE VOCABULARY IS A TABLE, NOT THIS FILE. `public.units` (27 rows, `id · label · plural · kind ·
 * position`) holds the values; this module only decides WHICH of `label` and `plural` to use and how to
 * write the number. Section 7b's rule — "every controlled vocabulary in this project is a table" — is
 * why the list is not an array here.
 *
 * THE PLURAL IS A COLUMN, NOT GRAMMAR IN THE CLIENT. `cl` is an abbreviation and never changes; `gram`
 * becomes `grams`; `dash` becomes `dashes`; `leaf` becomes `leaves`. English pluralisation is irregular
 * enough that a rule here would be wrong somewhere, so the table carries both forms and this file picks
 * between them. The pick is `quantity === 1 ? label : plural` — which means **0.5 takes the plural**,
 * because English does that and because `0.5 gram` reads wrong.
 *
 * NO IMPORTS, AND RUNNABLE DIRECTLY UNDER NODE (`node src/lib/units.ts`), the same rule as `rounds.ts`
 * and `verdict.ts`. A `.ts` file that imports nothing can be run by node with no bundler, so the strings
 * the editor renders come from the same code the check below exercises — never from a replica written to
 * agree with it. That rule has already caught three wrong numbers in this project.
 *
 * THE CORPUS IS NOT THE EDITOR'S TARGET. The corpus also holds `fresh`, `dried` and `candied` in this
 * field — states that leaked in, 15 and 12 distinct amounts each — and prose like `Top up with` and
 * `Float`. Those are deliberately NOT units: a state belongs to the element, and `Top up with` is the
 * `filler` ROLE. `parseAmount` returns null for them, which is the honest answer.
 *
 * TWO THINGS THE AUTHOR'S OWN LIST TAUGHT THIS FILE, both fixed 2026-10-06:
 *
 *   1. DECIMALS ARE DOTS. `Data/burn_hard_420_roast_list.json` writes `1,5 cl`, `1,75`, `4,5` — the
 *      German convention, and the author's. The corpus writes `1.5 cl`, all 31,907 rows of it. ONE
 *      CONVENTION IN THE COLUMN: the author chose the dot, so `composeAmount` writes dots and
 *      `parseAmount` ACCEPTS BOTH, because a comma can still arrive from a paste.
 *
 *   2. A BARE NUMBER IS A REAL AMOUNT. Six amounts in his list carry no unit at all — `1`, `1,5`,
 *      `1,75`, `4,5`, `1,25` — and `roastSpecs.ts` says of them: "they stay that way — the amount is
 *      a label, not a measurement." This file used to assert the opposite in a check ("a bare number
 *      is not an amount — every corpus amount has a unit"), which is true of the CORPUS and false of
 *      the author's data. The unit is now nullable, which is the honest type.
 */

/** One row of `public.units`, matching the table's columns exactly. */
export type Unit = {
  id: string;
  label: string;
  /** The form used when the quantity is not 1. */
  plural: string;
  /** `measure` = a quantity of something (cl, gram, dash). `countable` = a piece of the thing. */
  kind: "measure" | "countable";
  position: number;
};

/**
 * A parsed amount. `unit` is NULL when the amount is a bare number — a real case, not a failure.
 */
export type Amount = { quantity: number; unit: Unit | null };

/**
 * The number as a recipe writes it: no trailing zeros, no exponent, and A DOT rather than a comma.
 * `2` stays `2`, `2.0` becomes `2`, `4.5` stays `4.5`, `0.5` stays `0.5`.
 *
 * THE DOT IS DECIDED HERE AND NOWHERE ELSE. The author's source list writes `1,5 cl` — the German
 * convention — while the corpus and every row in the column write `1.5 cl`. Asked which to standardise
 * on, 2026-10-06, the author chose the dot: *"lets stick to '.' for decimals if thats the simplest
 * most effective thing to do."* One convention in the column; `parseAmount` still accepts a comma,
 * because one can arrive from a paste.
 *
 * Fractions are NOT produced. The corpus writes `1⁄2` and `2 1⁄2`, but an author typing into a number
 * field means a decimal, and `0.5 cl` and `1⁄2 cl` are the same fact. The corpus's fraction forms are
 * its own parse history, not a shape the editor needs to reproduce.
 */
export function formatQuantity(quantity: number): string {
  if (!Number.isFinite(quantity)) return "";
  // Round to three places first: 4.4999999 from a slider or a division is 4.5, not a lie.
  const rounded = Math.round(quantity * 1000) / 1000;
  return String(rounded);
}

/**
 * Compose the stored amount string: the quantity, then the right form of the unit if there is one.
 *
 * A quantity of 1 takes `label`; everything else, including 0.5, takes `plural`. A NULL unit produces
 * a bare number — `1`, `4.5` — which is how the author's own list writes six of its amounts.
 */
export function composeAmount(quantity: number, unit: Unit | null): string {
  const number = formatQuantity(quantity);
  if (number === "") return "";
  if (!unit) return number;
  return `${number} ${quantity === 1 ? unit.label : unit.plural}`;
}

/**
 * Read a stored amount back into a quantity and a unit — what the editor needs to re-open a saved spec.
 *
 * ACCEPTS A COMMA AS THE DECIMAL SEPARATOR, because the author's source list writes `1,5 cl` while the
 * column holds dots. Reading both costs one `replace` and removes a whole class of surprise.
 *
 * A BARE NUMBER IS A VALID AMOUNT with a null unit. Six of the author's amounts have no unit at all.
 *
 * Returns null when the string is prose rather than an amount: the corpus's `Top up with`, `Float`,
 * `fresh`, `1 dash (4 drops)` and `1⁄2 fresh` all land here, and null is the correct answer for every
 * one of them rather than a guessed unit.
 *
 * BOTH FORMS ARE TRIED, because a stored string may carry either: `1 cl` has the label, `3 grams` has
 * the plural. The lookup is case-insensitive — the corpus writes both `Splash` and `splash`.
 */
export function parseAmount(amount: string, units: Unit[]): Amount | null {
  if (typeof amount !== "string") return null;
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*(.*?)\s*$/.exec(amount);
  if (!match) return null;

  const quantity = Number(match[1].replace(",", "."));
  if (!Number.isFinite(quantity)) return null;

  // NO UNIT. A bare number is a label, not a measurement — and it is valid.
  const word = match[2].toLowerCase();
  if (word === "") return { quantity, unit: null };

  const unit = units.find(
    (u) => u.label.toLowerCase() === word || u.plural.toLowerCase() === word,
  );
  // A trailing word that is not a unit means the whole string was prose, not an amount.
  return unit ? { quantity, unit } : null;
}

/** The picker's order: measures first, then countable, each by `position`. */
export function orderUnits(units: Unit[]): Unit[] {
  const rank = (u: Unit): number => (u.kind === "measure" ? 0 : 1);
  return [...units].sort((a, b) => rank(a) - rank(b) || a.position - b.position);
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
    if (!ok) throw new Error(`units self-check failed: ${what}`);
  };
  const block = (text: string): void => {
    console.log();
    console.log(text);
  };

  // The real rows, copied from `public.units` so the checks exercise the same shapes the database holds.
  const u = (id: string, label: string, plural: string, kind: Unit["kind"], position: number): Unit =>
    ({ id, label, plural, kind, position });

  const UNITS: Unit[] = [
    u("cl", "cl", "cl", "measure", 10),
    u("dash", "dash", "dashes", "measure", 20),
    u("drop", "drop", "drops", "measure", 30),
    u("spoon", "spoon", "spoons", "measure", 40),
    u("gram", "gram", "grams", "measure", 50),
    u("pinch", "pinch", "pinches", "measure", 60),
    u("splash", "splash", "splashes", "measure", 70),
    u("scoop", "scoop", "scoops", "measure", 80),
    u("grind", "grind", "grinds", "measure", 90),
    u("inch", "inch", "inches", "measure", 100),
    u("knob", "knob", "knobs", "measure", 110),
    u("pea", "pea", "peas", "measure", 120),
    u("cupful", "cupful", "cupfuls", "measure", 130),
    u("pint", "pint", "pints", "measure", 140),
    u("litre", "litre", "litres", "measure", 150),
    u("bottle", "bottle", "bottles", "measure", 160),
    u("bag", "bag", "bags", "measure", 170),
    u("unit", "unit", "units", "countable", 200),
    u("whole", "whole", "whole", "countable", 210),
    u("leaf", "leaf", "leaves", "countable", 220),
    u("sprig", "sprig", "sprigs", "countable", 230),
    u("slice", "slice", "slices", "countable", 240),
    u("wedge", "wedge", "wedges", "countable", 250),
    u("cube", "cube", "cubes", "countable", 260),
    u("segment", "segment", "segments", "countable", 270),
    u("twist", "twist", "twists", "countable", 280),
    u("ring", "ring", "rings", "countable", 290),
  ];
  const by = (id: string): Unit => {
    const found = UNITS.find((x) => x.id === id);
    if (!found) throw new Error(`no such unit in the fixture: ${id}`);
    return found;
  };

  // ── 1. the number as a recipe writes it ────────────────────────────────────────────────────────
  check(formatQuantity(2) === "2", "a whole number has no decimal point");
  check(formatQuantity(2.0) === "2", "2.0 is written 2, not 2.0");
  check(formatQuantity(4.5) === "4.5", "4.5 keeps its decimal");
  check(formatQuantity(0.5) === "0.5", "0.5 keeps its leading zero");
  check(formatQuantity(0.125) === "0.125", "0.125 cl is the corpus's smallest amount");
  check(formatQuantity(4.4999999) === "4.5", "floating-point dust rounds away");
  check(formatQuantity(NaN) === "" && formatQuantity(Infinity) === "", "a non-number is empty, not NaN");
  block("the number: no trailing zeros, no exponent, 0.125 survives, floating-point dust does not");

  // ── 2. singular, plural, and the irregular ones ────────────────────────────────────────────────
  check(composeAmount(1, by("cl")) === "1 cl", "one cl");
  check(composeAmount(3, by("cl")) === "3 cl", "cl is an abbreviation and never pluralises");
  check(composeAmount(1, by("gram")) === "1 gram", "one gram takes the label");
  check(composeAmount(3, by("gram")) === "3 grams", "three grams takes the plural");
  check(composeAmount(2, by("dash")) === "2 dashes", "dash pluralises to dashes, not dashs");
  check(composeAmount(2, by("leaf")) === "2 leaves", "leaf pluralises to leaves");
  check(composeAmount(1, by("splash")) === "1 splash", "one splash");
  check(composeAmount(3, by("splash")) === "3 splashes", "three splashes");
  check(composeAmount(3, by("whole")) === "3 whole", "whole is invariant -- '3 whole' is how the corpus writes it");
  block("singular and plural, including the irregulars: dashes, leaves, splashes, and invariant whole");

  // ── 3. 0.5 takes the plural, because English does ──────────────────────────────────────────────
  check(composeAmount(0.5, by("gram")) === "0.5 grams", "0.5 takes the plural -- '0.5 gram' reads wrong");
  check(composeAmount(1.5, by("cl")) === "1.5 cl", "1.5 cl, the corpus's most common amount");
  check(composeAmount(0.5, by("dash")) === "0.5 dashes", "half a dash pluralises too");
  block("the quantity that decides it is 1, not 'less than one'");

  // ── 4. reading a stored amount back ────────────────────────────────────────────────────────────
  const p1 = parseAmount("1 cl", UNITS);
  check(p1 !== null && p1.quantity === 1 && p1.unit?.id === "cl", "parse '1 cl' by its label");
  const p2 = parseAmount("3 grams", UNITS);
  check(p2 !== null && p2.quantity === 3 && p2.unit?.id === "gram", "parse '3 grams' by its plural");
  const p3 = parseAmount("4.5 cl", UNITS);
  check(p3 !== null && p3.quantity === 4.5 && p3.unit?.id === "cl", "parse a decimal");
  const p4 = parseAmount("2 dashes", UNITS);
  check(p4 !== null && p4.unit?.id === "dash", "parse an irregular plural back to its id");
  const p5 = parseAmount("  2   drops  ", UNITS);
  check(p5 !== null && p5.unit?.id === "drop", "surrounding whitespace does not matter");
  const p6 = parseAmount("3 SPLASHES", UNITS);
  check(p6 !== null && p6.unit?.id === "splash", "the lookup is case-insensitive -- the corpus writes both Splash and splash");
  block("parseAmount finds the unit by label OR plural, case-insensitively, and tolerates whitespace");

  // ── 4b. THE COMMA. The author's source list writes `1,5 cl`; the column holds dots. ─────────────
  const c1 = parseAmount("1,5 cl", UNITS);
  check(c1 !== null && c1.quantity === 1.5 && c1.unit?.id === "cl", "a COMMA decimal parses: '1,5 cl' is 1.5 cl");
  const c2 = parseAmount("2,5 cl", UNITS);
  check(c2 !== null && c2.quantity === 2.5, "'2,5 cl' is 2.5 cl");
  const c3 = parseAmount("0,75 cl", UNITS);
  check(c3 !== null && c3.quantity === 0.75, "'0,75 cl' is 0.75 cl");
  const c4 = parseAmount("1.5 cl", UNITS);
  check(c4 !== null && c4.quantity === 1.5, "and the dot form still parses -- both are read");
  check(
    composeAmount(c1!.quantity, c1!.unit) === "1.5 cl",
    "but it is WRITTEN with a dot: one convention in the column",
  );
  block("the comma is READ and the dot is WRITTEN -- the author's 1,5 cl round-trips to 1.5 cl");

  // ── 4c. THE AUTHOR'S OWN AMOUNTS, verbatim from Data/burn_hard_420_roast_list.json ─────────────
  // Five distinct values, six occurrences. roastSpecs.ts: "they stay that way -- the amount is a
  // label, not a measurement." This file used to call them invalid.
  const BARE = ["1", "1,5", "1,75", "4,5", "1,25"];
  for (const raw of BARE) {
    const got = parseAmount(raw, UNITS);
    check(got !== null && got.unit === null, `'${raw}' is a bare amount with a null unit, not a failure`);
  }
  const WITH_COMMA_UNIT = ["1,5 cl", "2,5 cl", "1,75 cl", "0,75 cl", "0,5 cl", "1,25 cl"];
  for (const raw of WITH_COMMA_UNIT) {
    const got = parseAmount(raw, UNITS);
    check(got !== null && got.unit?.id === "cl", `'${raw}' is a comma decimal WITH a unit`);
  }
  const composed = composeAmount(1, null);
  check(composed === "1", "composing a bare amount writes just the number");
  check(composeAmount(4.5, null) === "4.5", "and 4.5 with no unit is '4.5', not '4.5 undefined'");
  block(`the author's ${BARE.length} bare amounts and ${WITH_COMMA_UNIT.length} comma amounts all parse`);

  // ── 5. the strings that are NOT an amount, and must not be guessed at ───────────────────────────
  check(parseAmount("Top up with", UNITS) === null, "'Top up with' is the filler ROLE, not a unit");
  check(parseAmount("Float", UNITS) === null, "'Float' is a process, not a unit");
  check(parseAmount("fresh", UNITS) === null, "'fresh' is a STATE that leaked into the amount field");
  check(parseAmount("1 dash (4 drops)", UNITS) === null, "compound prose is not an amount");
  check(parseAmount("", UNITS) === null, "empty is null, not a zero");
  const bare = parseAmount("2", UNITS);
  check(
    bare !== null && bare.quantity === 2 && bare.unit === null,
    "a bare number IS an amount with a null unit -- six of the author's 15 are written that way",
  );
  check(parseAmount("1⁄2 fresh", UNITS) === null, "the corpus's fraction forms are its parse history, not an amount");
  block("the corpus's non-units return null rather than a guess: the role, the process, the states, the prose");

  // ── 5b. THE TYPED FRACTION, PINNED (ITEM F12) ───────────────────────────────────────────────────
  // Measured 2026-10-13: an author typing `1/2` with `cl` selected left the input reading `1/2 cl`
  // while the unit control read "no unit". These checks pin the parser's side of that story: the
  // grammar has NO fraction form — accepting `1/2` as 0.5 would be new grammar and a product
  // decision, not a fix — and appending the selected unit does NOT rescue the string. The fix lives
  // in the editor (validate() blocks it; the field no longer appends a unit to unreadable text),
  // and these pins make sure no later change quietly invents the grammar here.
  check(parseAmount("1/2", UNITS) === null, "a typed fraction '1/2' is not an amount -- no fraction grammar, by decision");
  check(parseAmount("1/2 cl", UNITS) === null, "and appending the unit does not rescue it: '1/2 cl' is unreadable too");
  check(parseAmount("2 1/2 cl", UNITS) === null, "nor the mixed form -- the corpus's 1⁄2 is its parse history, not input grammar");
  block("the typed fraction stays rejected, with or without a unit -- F12's fix moves the REJECTION to validate(), it does not invent grammar");

  // ── 6. round trip: compose then parse returns the same fact, for every unit ────────────────────
  let roundTripped = 0;
  for (const unit of UNITS) {
    for (const qty of [1, 2, 0.5, 4.5, 12]) {
      const composed = composeAmount(qty, unit);
      const parsed = parseAmount(composed, UNITS);
      check(
        parsed !== null && parsed.quantity === qty && parsed.unit?.id === unit.id,
        `round trip failed for ${qty} ${unit.id}: composed '${composed}', parsed ${parsed ? (parsed.unit?.id ?? "no unit") : "null"}`,
      );
      roundTripped++;
    }
  }
  check(roundTripped === 135, `expected 135 round trips over 27 units, ran ${roundTripped}`);
  block(`round trip: ${roundTripped} compose/parse pairs over all ${UNITS.length} units, every one exact`);

  // ── 7. the picker's order ──────────────────────────────────────────────────────────────────────
  const shuffled = [...UNITS].reverse();
  const ordered = orderUnits(shuffled);
  check(ordered.length === UNITS.length, "ordering keeps every unit");
  check(ordered[0].id === "cl", "cl comes first -- it is 48 of the corpus's 253 distinct amounts");
  check(ordered[16].id === "bag", "the measures end at bag");
  check(ordered[17].id === "unit", "the countable forms begin at unit");
  check(ordered[ordered.length - 1].id === "ring", "ring is last");
  check(
    orderUnits(UNITS).map((x) => x.id).join() === orderUnits(shuffled).map((x) => x.id).join(),
    "the order does not depend on the input order",
  );
  block("the picker's order: measures first, then countable, each by position, input order ignored");

  // ── 8. a bare amount round-trips too ───────────────────────────────────────────────────────────
  for (const qty of [1, 1.5, 1.75, 4.5, 0.5]) {
    const written = composeAmount(qty, null);
    const read = parseAmount(written, UNITS);
    check(
      read !== null && read.quantity === qty && read.unit === null,
      `bare round trip failed for ${qty}: wrote '${written}'`,
    );
  }
  block("a unit-less amount survives compose -> parse unchanged");

  block(`all ${checks} unit checks passed`);

}
