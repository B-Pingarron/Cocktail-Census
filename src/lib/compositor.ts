/**
 * The mini compositor — the join between a recipe and the preview page that draws it.
 *
 * WHY THIS MODULE EXISTS, and it is the whole reason rather than a tidy-up. Two rooms now open
 * `roast-drink-card.html` and both have to hand it the same facts in the same spelling: the EDITOR,
 * carried by the draft in the form, and the ROSTER, carried by a saved row. Those two joins were
 * written into `SpecEditor.tsx` first (2026-10-12). The roster's turn would have copied them — a
 * second `COMPOSITOR_GLASS`, a second `garnishAssetOf`, a second URL builder — and this project has
 * already lost real time to exactly that shape of drift: `roastNotes.ts` records a vocabulary that
 * was written twice and read differently, and `selectionLabel()` exists because a label was written
 * twice and said two things. So the joins move here, once, and both rooms import them.
 *
 * `SpecEditor.tsx` IS NOT REWRITTEN, only relieved: `GLASS_FILE` and `GLASS_DIR` (the editor's own
 * `<img>` mark) stay there, because the mark is one room's business. What moved is what both rooms
 * share — the preset key, the garnish vocabulary, the composition rule, and the query string.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE RECEIVER'S CONTRACT, which this file obeys rather than restates. `roast-drink-card.html`'s own
 * header, written before anything read it: "The editor resolves the recipe's own prose to asset ids
 * and hands them over; this page receives IDS and parses nothing." It reads `?glass=`, `?garnish=`,
 * `?ice=`, `?color=`, and every one of them is checked against a table the page already carries — an
 * unknown value is IGNORED, never coerced. So a wrong name here is a silently defaulted layer, which
 * is why the vocabulary below is copied verbatim rather than recalled.
 *
 * ICE AND COLOUR ARE NOT CARRIED, and neither is an omission:
 *   · `ice` is accepted by the receiver and INERT — `ICE_ENABLED` is false in that page because there
 *     are no approved ice drawings yet. Sending `?ice=` would be a fact nothing draws.
 *   · `color` is the VISITOR'S. The preview's own header calls it "a starting point and stays the
 *     visitor's", so a recipe does not get to set it.
 *
 * THE FILLING IS NOT CARRIED EITHER, and that surprised this file's author before it was checked:
 * the receiver keys the liquid off `FILL_FILE[state.glass]`, not off a filling id. Four layers, one
 * key. So `glass` is the dominant parameter and the reason `previewHrefs` refuses to link without one.
 *
 * NO IMPORTS, AND RUNNABLE DIRECTLY UNDER NODE (`node src/lib/compositor.ts`), the same rule as
 * `roster.ts`, `rounds.ts`, `units.ts`, `picker.ts` and `editor.ts`.
 */

/**
 * THE MINI COMPOSITOR — the static page at `apps/census/public/roast/roast-drink-card.html`.
 *
 * RELATIVE, and that is not a style choice: `vite.config.ts` sets `base: "./"` and the site is served
 * from a subpath on GitHub Pages, so an absolute `/roast/...` breaks there. The same string is used
 * by the menu's chip and the editor's chip; it is written once here so the three cannot disagree.
 */
export const COMPOSITOR_URL = "./roast/roast-drink-card.html";

/**
 * The app's asset id -> the compositor's OWN preset key, because they are not the same set. Thirteen
 * of the fifteen are identical; the two that are not:
 *   · the app's `highball` is the compositor's `highball-outline`;
 *   · the app's `tiki-mug` is ABSENT, deliberately. The compositor has the artwork and a seat for it
 *     but no entry in `presets.json.glasses` or `presets.json.fillings`, and its own header records
 *     what happened when it was offered anyway: "a drink at a scale nobody measured". An unmapped
 *     glass therefore opens the default drink rather than an invented one — and the compositor's
 *     caption names the glass it actually drew, so the difference is visible rather than silent.
 *
 * THE KEYS ARE THE FIFTEEN `db/add-rung2-glass-asset-map.sql` ALLOWS in its own
 * `check (asset_id in (...))`, reached through `glass_asset_map.asset_id`.
 */
export const COMPOSITOR_GLASS: Record<string, string> = {
  "old-fashioned": "old-fashioned",
  shot: "shot",
  coupe: "coupe",
  martini: "martini",
  flute: "flute",
  goblet: "goblet",
  wine: "wine",
  snifter: "snifter",
  "nic-and-nora": "nic-and-nora",
  collins: "collins",
  highball: "highball-outline", // the ONE asset whose preset key is spelled differently
  hurricane: "hurricane",
  pint: "pint",
  toddy: "toddy",
};

/**
 * THE COMPOSITOR'S THIRTY GARNISH DRAWINGS, verbatim from `garnish-map.json`'s `assetVocabulary`
 * (the same list `svg/garnishes/` holds as files and `VB.garnish` keys as viewBoxes). Membership is
 * the whole guard: a composed name is passed on only if it appears here, so a typo or an unsupported
 * combination resolves to nothing instead of to a URL that 404s inside the preview.
 */
export const GARNISH_ASSETS: ReadonlySet<string> = new Set([
  "basil", "candied-ginger", "celerystick", "cherry", "cinnamon", "cinnamon-stick",
  "coffee-beans", "cucumber", "grapefruit-wedge", "lemon-twist", "lemon-wedge", "lime-twist",
  "lime-wedge", "mint1", "mint2", "mint3", "mint4", "nutmeg", "olive", "orange-twist",
  "orange-wedge", "pineapple", "raspberry", "raspberry1", "raspberry2", "saltrim", "stirrer",
  "straw", "sugar-rim", "umbrella",
]);

/**
 * The recipe's glass -> the compositor's preset key. `null` is a real answer: an unmapped glass, or
 * no glass at all, means the preview would draw the default drink, and the caller decides what to do
 * about that rather than receiving an invented key.
 */
export function compositorGlassPreset(assetId: string | null): string | null {
  if (!assetId) return null;
  return COMPOSITOR_GLASS[assetId] ?? null;
}

/**
 * A recipe's garnish -> the compositor's drawing. The recipe stores an element plus axis values
 * (`orange` + `fold:twist`); the compositor stores finished drawings (`orange-twist`). The join is a
 * COMPOSITION with a membership check, in two steps:
 *
 *   1. `elementId-valueId` for each axis carried — `orange` + `twist` -> `orange-twist`.
 *   2. the element alone — `cherry` -> `cherry`.
 *
 * Both steps are needed: citrus is composed (`orange-wedge`, `lime-twist`, `grapefruit-wedge`) while
 * `cherry`, `olive` and `pineapple` are the element's own name. A row already holding a composed id
 * (`orange-twist`) passes step 2 unchanged, because step 1 builds `orange-twist-twist`, which is not
 * in the vocabulary. Returning `null` is a real answer: the compositor then keeps its own default
 * garnish, which is the one outcome that can never draw the wrong picture.
 *
 * NOT RESOLVED, and named rather than guessed: `mint` (four drawings — `mint1`..`mint4`), and
 * `raspberry1`/`raspberry2` (the element `raspberry` resolves to the base drawing, which is the same
 * "first variant" rule the corpus uses).
 */
export function garnishAssetOf(
  elementId: string,
  axes: { axis: string; valueId: string }[],
): string | null {
  if (!elementId) return null;
  for (const { valueId } of axes) {
    const composed = `${elementId}-${valueId}`;
    if (GARNISH_ASSETS.has(composed)) return composed;
  }
  if (GARNISH_ASSETS.has(elementId)) return elementId;
  return null;
}

/**
 * The preview's URL for one drink — the ONE place a query string is assembled.
 *
 * `glassAsset` is the app's asset id, not the preset key: the mapping belongs to this module, so a
 * caller never has to know that `highball` becomes `highball-outline`. The bare page comes back when
 * nothing resolved, which is the same behaviour the editor's chip has always had.
 *
 * // GLASS FIRST, THEN GARNISH // is the order `SpecEditor.tsx` has written since 2026-10-12, kept so a
 * hand-built link and a generated one are byte-identical and diff cleanly.
 */
export function compositorUrl(opts: {
  glassAsset?: string | null;
  garnish?: string | null;
}): string {
  const q = new URLSearchParams();
  const preset = compositorGlassPreset(opts.glassAsset ?? null);
  if (preset) q.set("glass", preset);
  if (opts.garnish) q.set("garnish", opts.garnish);
  const query = q.toString();
  return query ? `${COMPOSITOR_URL}?${query}` : COMPOSITOR_URL;
}

// ── the roster's rule ────────────────────────────────────────────────────────────────────────────

/** One row of `glass_asset_map`, as this file reads it. 46 recipe glass names, 15 drawings. */
export type GlassAssetRow = { glass_id: string; asset_id: string | null };

/** One row of `spec_garnishes`. */
export type SpecGarnishRow = {
  spec_id: string;
  garnish_group: number;
  position: number;
  element_id: string;
};

/** One row of `spec_garnish_axes`. Several rows per axis is normal: `slice` AND `wheel`. */
export type SpecGarnishAxisRow = {
  spec_id: string;
  garnish_group: number;
  position: number;
  axis: string;
  value_id: string;
};

/**
 * A link per spec, for the rows the preview can actually draw — and NOT for the rows it cannot.
 *
 * THE REFUSAL IS THE POINT. The receiver falls back per field, so a bare or half-filled link does not
 * error: it opens a DIFFERENT DRINK and paints it confidently. A row reading "Lion's Tail" whose link
 * draws an Old Fashioned is worse than no link at all, because the visitor believes the picture. So a
 * spec is given a link only when its GLASS resolves to a preset — the glass is the layer the whole
 * preview is keyed off (`GLASS_PRESET`, `FILL_FILE`, `ICE_OFFSET`, `SEAT` are all `state.glass`), and
 * `glass_asset_map` records a null `asset_id` for the glasses with no drawing as "a RECORDED fact, not
 * an omission". Roughly nine per cent of glass names are in that state, and their rows simply carry no
 * link rather than a link to somebody else's drink.
 *
 * THE FIRST GARNISH, AND ONLY THE FIRST, matching `SpecEditor.tsx`'s `draft.garnishes[0]`: the
 * compositor draws one garnish drawing and a recipe may hold several, so picking which to show would
 * be a decision this file has no basis for. "First" is the lowest `(garnish_group, position)`, which is
 * the order the editor writes and the row the author sees at the top of the list.
 *
 * THE AXES COME FROM THAT GARNISH AND NO OTHER. `spec_garnish_axes` is keyed by
 * `(spec_id, garnish_group, position)`, so a spec with two garnishes has two axis sets and matching
 * them by `spec_id` alone would compose `cherry-twist` — a drawing that does not exist, from a value
 * that belongs to a different garnish. The join is per-group for exactly that reason.
 */
export function previewHrefs(
  specs: { id: string; glass_id: string | null }[],
  glassRows: GlassAssetRow[],
  garnishRows: SpecGarnishRow[],
  axisRows: SpecGarnishAxisRow[],
): Record<string, string> {
  const assetOf = new Map<string, string | null>();
  for (const row of glassRows) assetOf.set(row.glass_id, row.asset_id);

  const first = new Map<string, SpecGarnishRow>();
  for (const row of garnishRows) {
    const held = first.get(row.spec_id);
    const earlier =
      held === undefined ||
      row.garnish_group < held.garnish_group ||
      (row.garnish_group === held.garnish_group && row.position < held.position);
    if (earlier) first.set(row.spec_id, row);
  }

  const key = (specId: string, group: number, position: number) => `${specId}|${group}|${position}`;
  const axesOf = new Map<string, { axis: string; valueId: string }[]>();
  for (const row of axisRows) {
    const k = key(row.spec_id, row.garnish_group, row.position);
    const held = axesOf.get(k);
    if (held) held.push({ axis: row.axis, valueId: row.value_id });
    else axesOf.set(k, [{ axis: row.axis, valueId: row.value_id }]);
  }

  const out: Record<string, string> = {};
  for (const spec of specs) {
    const asset = spec.glass_id ? assetOf.get(spec.glass_id) ?? null : null;
    const preset = compositorGlassPreset(asset);
    if (!preset) continue;

    const garnishRow = first.get(spec.id);
    const garnish = garnishRow
      ? garnishAssetOf(
          garnishRow.element_id,
          axesOf.get(key(spec.id, garnishRow.garnish_group, garnishRow.position)) ?? [],
        )
      : null;

    out[spec.id] = compositorUrl({ glassAsset: asset, garnish });
  }
  return out;
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
    if (!ok) throw new Error(`compositor self-check failed: ${what}`);
  };
  const block = (text: string): void => {
    console.log();
    console.log(text);
  };

  // ── 1. the glass: one asset is spelled differently, and one has no preset at all ─────────────────
  check(compositorGlassPreset("highball") === "highball-outline", "the app's `highball` is the compositor's `highball-outline`");
  check(compositorGlassPreset("old-fashioned") === "old-fashioned", "and thirteen of the fifteen are identical");
  check(compositorGlassPreset("tiki-mug") === null, "`tiki-mug` has no preset there, on purpose");
  check(compositorGlassPreset(null) === null, "and no glass at all is null rather than a guess");
  block("the two glass spaces are joined in one place, and an unmeasured preset is absent rather than invented");

  // ── 2. the garnish composes, then falls back, then gives up ──────────────────────────────────────
  check(garnishAssetOf("orange", [{ axis: "fold", valueId: "twist" }]) === "orange-twist", "element + axis composes");
  check(garnishAssetOf("cherry", []) === "cherry", "an element with no axis is its own drawing");
  check(
    garnishAssetOf("orange-twist", [{ axis: "fold", valueId: "twist" }]) === "orange-twist",
    "an already-composed id passes the element step unchanged",
  );
  check(garnishAssetOf("mint", []) === null, "`mint` is four drawings and resolves to none");
  check(garnishAssetOf("malt", [{ axis: "fold", valueId: "twist" }]) === null, "an unknown element resolves to nothing");
  block("the garnish join is a composition with a membership check, and null is a real answer");

  // ── 3. the URL, in the order the editor has always written it ─────────────────────────────────────
  check(compositorUrl({}) === COMPOSITOR_URL, "nothing resolved is the bare page");
  check(compositorUrl({ glassAsset: "highball" }) === `${COMPOSITOR_URL}?glass=highball-outline`, "the preset key travels, not the asset id");
  check(
    compositorUrl({ glassAsset: "old-fashioned", garnish: "orange-twist" }) ===
      `${COMPOSITOR_URL}?glass=old-fashioned&garnish=orange-twist`,
    "glass first, then garnish",
  );
  check(compositorUrl({ garnish: "cherry" }) === `${COMPOSITOR_URL}?garnish=cherry`, "a garnish alone still travels");
  check(compositorUrl({ glassAsset: "tiki-mug" }) === COMPOSITOR_URL, "an unmapped glass sends no glass param");
  block("one place assembles the query string, so the three rooms carrying this door cannot drift apart");

  // ── 4. the roster's rule: the FIRST garnish, and ITS OWN axes ─────────────────────────────────────
  const specs = [
    { id: "a", glass_id: "old-fashioned-glass" },
    { id: "b", glass_id: "some-unmapped-glass" },
    { id: "c", glass_id: "highball-glass" },
    { id: "d", glass_id: null },
  ];
  const glassRows = [
    { glass_id: "old-fashioned-glass", asset_id: "old-fashioned" },
    { glass_id: "some-unmapped-glass", asset_id: null },
    { glass_id: "highball-glass", asset_id: "highball" },
  ];
  const garnishRows = [
    { spec_id: "a", garnish_group: 1, position: 0, element_id: "cherry" },
    { spec_id: "a", garnish_group: 0, position: 0, element_id: "orange" },
    { spec_id: "c", garnish_group: 0, position: 0, element_id: "lime-wedge" },
  ];
  const axisRows = [
    { spec_id: "a", garnish_group: 0, position: 0, axis: "fold", value_id: "twist" },
    { spec_id: "a", garnish_group: 1, position: 0, axis: "portion", value_id: "whole" },
  ];

  const hrefs = previewHrefs(specs, glassRows, garnishRows, axisRows);
  check(
    hrefs.a === `${COMPOSITOR_URL}?glass=old-fashioned&garnish=orange-twist`,
    `a: the first garnish by (group, position), with its OWN axis — got ${hrefs.a}`,
  );
  check(!("b" in hrefs), "b: an unmapped glass gets no link, because the preview would draw another drink");
  check(hrefs.c === `${COMPOSITOR_URL}?glass=highball-outline&garnish=lime-wedge`, `c: the differently-spelled glass still resolves — got ${hrefs.c}`);
  check(!("d" in hrefs), "d: a spec with no glass gets no link either");
  check(Object.keys(hrefs).length === 2, `two of four rows carry a link, got ${Object.keys(hrefs).length}`);
  block("the row's rule: first garnish, its own axes, and no link where the preview cannot draw this drink");

  console.log();
  console.log(`compositor self-check: ${checks} checks passed`);
}
