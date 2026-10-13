/**
 * The editor's payload — how the form becomes the JSON that `save_spec_draft` reads.
 *
 * WHY THIS IS ITS OWN MODULE: the payload's SHAPE is a contract with a database function, and a
 * contract is not layout. `save_spec_draft(payload jsonb)` reads eleven keys and four arrays; get one
 * name wrong and the save silently writes a spec with no ingredients, or throws a `null` into a
 * `not null` column. So the assembly is here, where it can be checked, and the screen only renders.
 *
 * THE CONTRACT, read out of the function itself rather than guessed:
 *
 *     payload->>'session_id' 'cocktail_slug' 'name' 'glass_id' 'ice_id' 'technique_id' 'notes'
 *     payload->'ingredients'    [{ position, role, amount, ingredient_id, raw_name }]
 *     payload->'techniques'     [{ position, technique_id }]
 *     payload->'garnishes'      [{ garnish_group, position, element_id }]
 *     payload->'garnish_axes'   [{ garnish_group, position, axis, value_id }]
 *
 * `ice_id` IS DELIBERATELY ABSENT. Section 7b: "`ice` is a catalogue table with `specs.ice_id`
 * nullable, NO EDITOR FIELD AND NO UI." So the payload carries null and the screen offers nothing.
 *
 * `amount` ARRIVES ALREADY COMPOSED. `types/roast.ts` states the rule this file obeys: "`amount` is an
 * OPAQUE STRING on purpose... Nothing parses units: `3 cl`, `1 dash`, `top` and `4,5` are all the same
 * class of value." `units.ts` is what composes one when the author picks a number and a unit, and
 * `buildPayload` below still passes any string through untouched.
 * ** SUPERSEDED BY ITEM F13 ** "this module never parses an amount" is no longer true, measured
 * 2026-10-13: prose in an amount field (`Top up with`) passed validation silently and reached the
 * payload as a raw string. `validate()` now calls the REAL `parseAmount` from `units.ts` and turns
 * anything unreadable into a problem that blocks the save. The OPAQUE rule is kept where it belongs:
 * the PAYLOAD does not parse, the VALIDATION checks readability before the payload is built.
 *
 * RUNNABLE DIRECTLY UNDER NODE (`node src/lib/editor.ts`), the same rule as `rounds.ts`, `units.ts`
 * and `picker.ts`. ** SUPERSEDED BY ITEM F13 ** the zero-import half of the old rule is gone:
 * `validate()` needs the real `parseAmount`, and a parser copied here would be exactly the replica
 * `units.ts`'s header forbids. The import spells the extension (`./units.ts`), which node >= 23's
 * type stripping and `allowImportingTsExtensions` (tsconfig.app.json) both accept, so the direct
 * run still works and still exercises the same code the screen does. The rest of the old reason
 * stands: the amount stays a STRING here rather than a `Unit`, because what this module checks is
 * the string, and the vocabulary is `units.ts`'s business.
 */

import { parseAmount, type Unit } from "./units.ts";

/** One ingredient line as the form holds it. `amount` is the composed string, or empty. */
export type DraftIngredient = {
  /** `ingredients.id`. The generic, always set -- `spec_ingredients.ingredient_id` is NOT NULL. */
  ingredientId: string;
  /**
   * What the author actually typed or picked, stored beside the generic.
   *
   * Section 7b: "On pick, store BOTH `ingredient_id` and `raw_name` -- `add-slug-and-raw-name.sql`
   * exists because 'which brand this recipe used was lost', and an editor writing only the generic
   * re-introduces that bug in every authored spec."
   */
  rawName: string;
  /** The composed amount: `4.5 cl`, `2 dashes`, `top`, or empty. `buildPayload` never parses it; `validate()` checks it can be read (ITEM F13). */
  amount: string;
  /** `base` / `modifier` / `filler`. Nullable, and NULL on every corpus row today. */
  role: string | null;
};

/** One garnish, as a produce plus its axes, attached at (group, position). */
export type DraftGarnish = {
  /** `garnish_elements.id` -- the produce, e.g. `orange`. */
  elementId: string;
  /** Keeps a compound garnish's parts together. */
  group: number;
  position: number;
  /** The closed axes: `{ axis: "fold", valueId: "twist" }`. */
  axes: { axis: string; valueId: string }[];
};

/** Everything the screen holds. */
export type Draft = {
  sessionId: string;
  /** The Cocktail this is a version of. Section 7b: the pair is the root, with the session. */
  cocktailSlug: string;
  name: string;
  glassId: string | null;
  /** In order. The first is also written as the spec's headline `technique_id`. */
  techniqueIds: string[];
  notes: string;
  ingredients: DraftIngredient[];
  garnishes: DraftGarnish[];
};

/**
 * The problems with a draft, as human sentences. EMPTY MEANS VALID.
 *
 * The screen renders these; the database is the authority and will refuse a bad payload anyway. This
 * exists so the author is told BEFORE a round trip, and so the browser pass has something to assert.
 *
 * `units` IS THE VOCABULARY TABLE (`public.units`, 27 rows), passed in rather than fetched, because
 * parsing an amount needs to know which words are units. The screen passes `refs.units`; the direct
 * run below passes a copied fixture. ITEM F13: any NON-EMPTY amount that `parseAmount` cannot
 * resolve is a problem, so the save is blocked while the amount field holds prose (`Top up with`) or
 * a form the grammar has no rule for (`1/2`, ITEM F12) -- the input and the unit control can no
 * longer disagree with a save standing behind them.
 */
export function validate(draft: Draft, units: Unit[]): string[] {
  const problems: string[] = [];

  if (!draft.sessionId.trim()) problems.push("A session is required.");
  if (!draft.cocktailSlug.trim()) problems.push("Pick the Cocktail this is a version of.");
  if (!draft.name.trim()) problems.push("The spec needs a name.");

  if (draft.ingredients.length === 0) {
    problems.push("A spec needs at least one ingredient.");
  }
  draft.ingredients.forEach((line, index) => {
    if (!line.ingredientId.trim()) problems.push(`Ingredient ${index + 1} has no generic picked.`);
    const amount = line.amount.trim();
    if (!amount) problems.push(`Ingredient ${index + 1} has no amount.`);
    // ITEM F13. An amount the parser cannot resolve is a problem, not a quiet pass: the row would
    // otherwise reach `save_spec_draft` as prose, and the amount input and the unit control --
    // both derived from this one string -- would be left describing different facts.
    else if (parseAmount(amount, units) === null) {
      problems.push(`Ingredient ${index + 1} has an amount that cannot be read: ${amount}.`);
    }
  });

  draft.garnishes.forEach((garnish, index) => {
    if (!garnish.elementId.trim()) problems.push(`Garnish ${index + 1} has no element picked.`);
    if (garnish.group < 0 || garnish.position < 0) {
      problems.push(`Garnish ${index + 1} has a negative group or position.`);
    }
  });

  return problems;
}

/**
 * The draft as the JSON `save_spec_draft` reads.
 *
 * TWO THINGS WORTH KNOWING:
 *
 *   1. POSITIONS ARE ASSIGNED HERE, from array order. The screen never sets them, because a list the
 *      author reorders by dragging must not be able to produce a gap or a duplicate. Order in, order
 *      out.
 *   2. `technique_id` AND `techniques` ARE BOTH WRITTEN. The function reads the singular for the
 *      spec's headline technique and the array for its steps, and they are the same fact stated twice
 *      on purpose -- the array is the ordered walk, the singular is what a card shows. Writing one
 *      without the other is how they would drift.
 */
export function buildPayload(draft: Draft): Record<string, unknown> {
  const techniques = draft.techniqueIds.filter((id) => id.trim() !== "");

  return {
    session_id: draft.sessionId.trim(),
    cocktail_slug: draft.cocktailSlug.trim(),
    name: draft.name.trim(),
    glass_id: draft.glassId?.trim() || null,
    // NO EDITOR FIELD. Section 7b, and it is a decision rather than an omission.
    ice_id: null,
    technique_id: techniques[0] ?? null,
    notes: draft.notes.trim() || null,

    ingredients: draft.ingredients.map((line, position) => ({
      position,
      role: line.role?.trim() || null,
      amount: line.amount.trim() || null,
      ingredient_id: line.ingredientId,
      raw_name: line.rawName.trim() || null,
    })),

    techniques: techniques.map((technique_id, position) => ({ position, technique_id })),

    garnishes: draft.garnishes.map((garnish) => ({
      garnish_group: garnish.group,
      position: garnish.position,
      element_id: garnish.elementId,
    })),

    // FLATTENED, because that is the table's shape: one row per (group, position, axis). A garnish
    // with no axes contributes nothing here -- and that is a REAL case, not a failure: the corpus's
    // three commonest garnishes (`orange`, `lemon`, `lime`) carry no axis at all.
    garnish_axes: draft.garnishes.flatMap((garnish) =>
      garnish.axes
        .filter((axis) => axis.axis.trim() !== "" && axis.valueId.trim() !== "")
        .map((axis) => ({
          garnish_group: garnish.group,
          position: garnish.position,
          axis: axis.axis,
          value_id: axis.valueId,
        })),
    ),
  };
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
  // Every check throws, so a wrong payload exits non-zero: the run's output is the evidence.
  let checks = 0;
  const check = (ok: boolean, what: string): void => {
    checks++;
    if (!ok) throw new Error(`editor self-check failed: ${what}`);
  };
  const block = (text: string): void => {
    console.log();
    console.log(text);
  };

  const EMPTY: Draft = {
    sessionId: "sess-1",
    cocktailSlug: "old-fashioned",
    name: "My Old Fashioned",
    glassId: "old-fashioned-glass",
    techniqueIds: ["stir"],
    notes: "Stir long.",
    ingredients: [],
    garnishes: [],
  };

  const line = (ingredientId: string, rawName: string, amount: string, role: string | null = null): DraftIngredient =>
    ({ ingredientId, rawName, amount, role });

  // The vocabulary rows the checks need, COPIED from `public.units` the same way units.ts's own
  // block copies them. validate() delegates to units.ts's REAL parseAmount, so only the ROWS live
  // here -- never a second parser.
  const AMOUNT_UNITS: Unit[] = [
    { id: "cl", label: "cl", plural: "cl", kind: "measure", position: 10 },
    { id: "dash", label: "dash", plural: "dashes", kind: "measure", position: 20 },
  ];

  // ── 1. validation says what is wrong, and nothing when nothing is ──────────────────────────────
  check(validate(EMPTY, AMOUNT_UNITS).length === 1, `an empty ingredient list is the only problem, got ${validate(EMPTY, AMOUNT_UNITS).join(" | ")}`);
  check(validate(EMPTY, AMOUNT_UNITS)[0].includes("at least one ingredient"), "and it says so in words");

  const good: Draft = { ...EMPTY, ingredients: [line("bourbon", "Bourbon whiskey", "4.5 cl")] };
  check(validate(good, AMOUNT_UNITS).length === 0, `a valid draft has no problems, got ${validate(good, AMOUNT_UNITS).join(" | ")}`);

  const noName = { ...good, name: "   " };
  check(validate(noName, AMOUNT_UNITS).some((p) => p.includes("needs a name")), "a blank name is caught");
  const noCocktail = { ...good, cocktailSlug: "" };
  check(validate(noCocktail, AMOUNT_UNITS).some((p) => p.includes("version of")), "a missing Cocktail is caught");
  const noSession = { ...good, sessionId: "" };
  check(validate(noSession, AMOUNT_UNITS).some((p) => p.includes("session")), "a missing session is caught");
  const noAmount = { ...good, ingredients: [line("bourbon", "Bourbon", "")] };
  check(validate(noAmount, AMOUNT_UNITS).some((p) => p.includes("no amount")), "an ingredient with no amount is caught");
  const noGeneric = { ...good, ingredients: [line("", "Bourbon", "4.5 cl")] };
  check(validate(noGeneric, AMOUNT_UNITS).some((p) => p.includes("no generic")), "an ingredient with no generic is caught");
  const noElement = { ...good, garnishes: [{ elementId: "", group: 0, position: 0, axes: [] }] };
  check(validate(noElement, AMOUNT_UNITS).some((p) => p.includes("no element")), "a garnish with no element is caught");
  block("validate names every problem in words, and says nothing when there is nothing wrong");

  // ── 4b. AN AMOUNT THAT CANNOT BE READ IS A PROBLEM, not a silent pass (ITEM F13) ─────────────────
  // Measured 2026-10-13: typing `Top up with` into an amount field was kept verbatim and validate()
  // had NO amount-parse check, so nothing blocked the save — and `1/2` (ITEM F12) landed the same
  // way. The AMOUNT_UNITS fixture above supplies the rows; the parser is units.ts's own.
  const prose = { ...good, ingredients: [line("gin", "Gin", "Top up with")] };
  check(validate(prose, AMOUNT_UNITS).some((p) => p.includes("cannot be read")), "prose in the amount field is a problem, not a silent pass");
  const fraction = { ...good, ingredients: [line("gin", "Gin", "1/2")] };
  check(validate(fraction, AMOUNT_UNITS).some((p) => p.includes("cannot be read")), "a typed fraction is a problem -- no grammar for it, and it must not save");
  const compound = { ...good, ingredients: [line("gin", "Gin", "1 dash (4 drops)")] };
  check(validate(compound, AMOUNT_UNITS).some((p) => p.includes("cannot be read")), "compound prose is a problem too");
  check(validate({ ...good, ingredients: [line("gin", "Gin", "4.5 cl")] }, AMOUNT_UNITS).length === 0, "a real amount still validates clean");
  check(validate({ ...good, ingredients: [line("gin", "Gin", "4.5")] }, AMOUNT_UNITS).length === 0, "a bare number still validates clean");
  check(validate({ ...good, ingredients: [line("gin", "Gin", "1,5 cl")] }, AMOUNT_UNITS).length === 0, "the comma decimal still validates clean");
  const emptyAmountProblems = validate({ ...good, ingredients: [line("gin", "Gin", "")] }, AMOUNT_UNITS);
  check(emptyAmountProblems.length === 1 && emptyAmountProblems[0].includes("no amount"), "an empty amount says 'no amount', not 'cannot be read'");
  block("validate blocks an amount its parser cannot read: prose, fractions, compounds -- and only those");

  // ── 2. the payload's keys are exactly the contract ─────────────────────────────────────────────
  const payload = buildPayload(good);
  const keys = Object.keys(payload).sort().join(",");
  check(
    keys === "cocktail_slug,garnish_axes,garnishes,glass_id,ice_id,ingredients,name,notes,session_id,technique_id,techniques",
    `the payload keys are the contract, got ${keys}`,
  );
  check(payload.ice_id === null, "ice_id is null -- section 7b: no editor field and no UI");
  check(payload.technique_id === "stir", "the headline technique is the first of the list");
  block("the payload carries exactly the eleven keys save_spec_draft reads, ice_id included as null");

  // ── 3. positions are assigned from array order, never from the screen ──────────────────────────
  const many: Draft = {
    ...good,
    ingredients: [
      line("bourbon", "Bourbon whiskey", "4.5 cl", "base"),
      line("sugar-syrup", "Sugar syrup", "1 cl", "modifier"),
      line("angostura", "Angostura Aromatic Bitters", "2 dashes", "modifier"),
    ],
  };
  const mp = buildPayload(many);
  const ings = mp.ingredients as { position: number; role: string | null; amount: string }[];
  check(ings.length === 3, "three lines in, three lines out");
  check(ings.map((i) => i.position).join() === "0,1,2", `positions are 0,1,2 in order, got ${ings.map((i) => i.position).join()}`);
  check(ings[0].role === "base" && ings[1].role === "modifier", "the role survives");
  check(ings[2].amount === "2 dashes", "an amount passes through untouched");
  block("positions come from array order, so a reordered list cannot produce a gap or a duplicate");

  // ── 4. the PAYLOAD is OPAQUE -- buildPayload passes through what it cannot parse ───────────
  // ** SUPERSEDED BY ITEM F13 ** "what units.ts cannot parse must still save" is no longer the
  // whole story: the payload still carries every string untouched (these checks prove it), but the
  // SCREEN no longer lets an unreadable amount reach here -- validate() names it a problem and
  // blocks the save first. The corpus's `top` rows are unaffected; this is the editor's gate, not a
  // rewrite of the column.────────
  const opaque: Draft = {
    ...good,
    ingredients: [
      line("gin", "Gin", "4.5"),
      line("espresso", "Espresso", "1"),
      line("fernet", "Fernet Branca", "1,5 cl"),
      line("soda", "Soda water", "top", "filler"),
    ],
  };
  const op = buildPayload(opaque);
  const opl = op.ingredients as { amount: string; role: string | null }[];
  check(opl[0].amount === "4.5", "a bare number is stored as written -- it is a label, not a measurement");
  check(opl[1].amount === "1", "so is '1'");
  check(opl[2].amount === "1,5 cl", "the comma survives verbatim: nothing here parses units");
  check(opl[3].amount === "top" && opl[3].role === "filler", "'top' is an amount AND the filler role");
  block("the amount is opaque: '4.5', '1,5 cl' and 'top' all pass through unparsed, as types/roast.ts requires");

  // ── 5. raw_name is stored beside the generic, always ───────────────────────────────────────────
  const branded = { ...good, ingredients: [line("fernet", "Fernet Branca", "1.5 cl")] };
  const bp = buildPayload(branded);
  const bl = bp.ingredients as { ingredient_id: string; raw_name: string }[];
  check(bl[0].ingredient_id === "fernet", "the generic is the id");
  check(bl[0].raw_name === "Fernet Branca", "the brand is the raw name -- section 7b, both are stored");
  block("the generic and the brand are both written: 'which brand this recipe used' is not lost again");

  // ── 6. the garnish: produce at (group, position), axes flattened ───────────────────────────────
  const garnished: Draft = {
    ...good,
    garnishes: [
      { elementId: "orange", group: 0, position: 0, axes: [{ axis: "fold", valueId: "twist" }] },
      { elementId: "cherry", group: 1, position: 0, axes: [] },
    ],
  };
  const gp = buildPayload(garnished);
  const gs = gp.garnishes as { element_id: string; garnish_group: number; position: number }[];
  const ax = gp.garnish_axes as { axis: string; value_id: string; garnish_group: number }[];
  check(gs.length === 2, "two garnishes, two rows");
  check(gs[0].element_id === "orange" && gs[0].garnish_group === 0, "the produce and its group");
  check(ax.length === 1, "one garnish has an axis, the other has none, so one axis row");
  check(ax[0].axis === "fold" && ax[0].value_id === "twist", "the axis and its value");
  block("the garnish is a produce plus optional axes, flattened into the two tables the corpus uses");

  // ── 7. A GARNISH WITH NO AXES IS A REAL CASE, not a failure ────────────────────────────────────
  const bare: Draft = { ...good, garnishes: [{ elementId: "orange", group: 0, position: 0, axes: [] }] };
  const bareP = buildPayload(bare);
  check((bareP.garnishes as unknown[]).length === 1, "the garnish row is still written");
  check((bareP.garnish_axes as unknown[]).length === 0, "and it contributes no axis rows");
  check(validate(bare, AMOUNT_UNITS).length === 0, "which is valid -- the corpus's three commonest garnishes carry no axis");
  block("a produce with no axes is valid: `orange`, `lemon` and `lime` are 36% of the corpus and carry none");

  // ── 8. empty things become null, not empty strings ─────────────────────────────────────────────
  const sparse: Draft = { ...good, glassId: null, techniqueIds: [], notes: "  ", ingredients: [line("gin", "", "4.5 cl")] };
  const sp = buildPayload(sparse);
  check(sp.glass_id === null, "no glass is null, not ''");
  check(sp.technique_id === null && (sp.techniques as unknown[]).length === 0, "no technique is null and an empty array");
  check(sp.notes === null, "blank notes are null");
  check((sp.ingredients as { raw_name: string }[])[0].raw_name === null, "a blank raw_name is null");
  block("blanks become null rather than empty strings, so the column's meaning is not diluted");

  // ── 9. techniques: the headline and the steps are the same fact ────────────────────────────────
  const steps: Draft = { ...good, techniqueIds: ["shake", "dry shake", "strain"] };
  const stp = buildPayload(steps);
  const sts = stp.techniques as { position: number; technique_id: string }[];
  check(stp.technique_id === "shake", "the headline is the first step");
  check(sts.length === 3, "all three steps are written");
  check(sts.map((s) => s.position).join() === "0,1,2", "in order");
  const blankSteps: Draft = { ...good, techniqueIds: ["stir", "", "  "] };
  const bsp = buildPayload(blankSteps);
  check((bsp.techniques as unknown[]).length === 1, "blank technique ids are dropped rather than stored");
  check(bsp.technique_id === "stir", "and the headline is the first REAL one");
  block("technique_id and techniques are written together, so the card and the steps cannot drift");

  block(`all ${checks} editor checks passed`);
}
