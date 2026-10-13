/**
 * The picker — how an author finds an ingredient or a garnish element, and in what order the
 * candidates come back.
 *
 * WHY THIS IS ITS OWN MODULE: the picker is the editor's most-used control, and its behaviour is
 * ARITHMETIC ON LISTS, not layout. What comes first, what matches what, and what wins a tie are rules
 * — and rules do not belong in a component. The same reasoning as `rounds.ts` and `units.ts`.
 *
 * SECTION 7b DECIDED THE RULES, measured against the vocabulary:
 *
 *   "Category-first is disproved: `parent_id` has ZERO rows, the 22 categories are flat, and 49% of
 *    everything sits in three of them. Decided: RECENTS FIRST, falling back to most-used, with search
 *    over canonical names AND aliases, ranked by usage count. Category is a filter chip, not a first
 *    step. On pick, store BOTH `ingredient_id` and `raw_name`."
 *
 * THE THREE RULES, restated by the author on 2026-10-06 as checks:
 *
 *   1. "recents beat frequents"        -> `defaults` puts a recent above a more-used one
 *   2. "aliases match to generics"     -> searching an alias returns the GENERIC it resolves to
 *   3. "fernet branca matches fernet liqueur"  -> the worked example, and it is in the checks below
 *
 * WHY ALIASES ARE THE WHOLE POINT. Section 7b again: "brands arrive via `raw_name`". A bartender types
 * "Fernet Branca"; the vocabulary holds `fernet liqueur` with `Fernet Branca` as an alias. Without
 * alias matching the picker would return nothing for most of what a bartender knows. That is not
 * hypothetical — it is how `Benedictine D.O.M.` and `Fernet Branca` were both reported as missing from
 * the lego box by a pass that searched only the generics.
 *
 * FOLDING, NOT JUST LOWERCASING. The vocabulary holds `jalapeño`, `bacardí rum`, `Crème de Menthe`.
 * An author typing `jalapeno` must find `jalapeño`, or the picker fails on a keyboard that has no
 * accents. `fold` strips diacritics, lowercases, and collapses punctuation and spacing.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not fetch anything, does not touch localStorage, and does not
 * know what a React component is. It takes lists and returns lists. `raw_name` is not its business:
 * that is written at pick time, from whatever the author actually chose.
 *
 * NO IMPORTS, AND RUNNABLE DIRECTLY UNDER NODE (`node src/lib/picker.ts`), the same rule as `rounds.ts`
 * and `units.ts`.
 */

/** One row of `public.ingredients`. */
export type Ingredient = {
  id: string;
  canonical_name: string;
  category: string | null;
};

/** One row of `public.ingredient_aliases`. */
export type Alias = { alias: string; ingredient_id: string };

/** How many specs use each generic, keyed by id. Built from `spec_ingredients`. */
export type Usage = Record<string, number>;

/** One candidate, ready to render. `via` is the alias that matched, or null for a canonical hit. */
export type Candidate = {
  ingredient: Ingredient;
  /** How many specs use it. 0 when unknown. */
  usage: number;
  /** The alias text that matched the query, or null when the canonical name matched. */
  via: string | null;
  /** True when a recent pick put it at the top of the defaults. */
  recent: boolean;
};

/**
 * Fold a string for matching: lowercase, strip diacritics, collapse anything that is not a letter or a
 * digit into a single space, and trim.
 *
 * `jalapeño` and `jalapeno` fold to the same thing, which is the point. So do `Fernet  Branca` and
 * `fernet-branca`.
 */
export function fold(value: string): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    // Strip the combining marks NFD just separated: the accent, not the letter.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The list before the author types anything: RECENTS FIRST, then the most used.
 *
 * RULE 1. A recent pick outranks a more-used one, because the author's last action is the best
 * predictor of their next one and usage counts never decay. Recents come in recency order — the array
 * is assumed most-recent-first — and everything else follows by usage.
 *
 * Ids in `recents` that are not in `ingredients` are skipped rather than trusted: localStorage is
 * user-editable and a stale id must not put a hole in the list.
 */
export function defaults(
  ingredients: Ingredient[],
  usage: Usage,
  recents: string[],
  limit = 12,
): Candidate[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const out: Candidate[] = [];
  const seen = new Set<string>();

  for (const id of recents) {
    const ingredient = byId.get(id);
    if (!ingredient || seen.has(id)) continue;
    seen.add(id);
    out.push({ ingredient, usage: usage[id] ?? 0, via: null, recent: true });
  }

  const rest = ingredients
    .filter((i) => !seen.has(i.id))
    .sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.canonical_name.localeCompare(b.canonical_name));

  for (const ingredient of rest) {
    out.push({ ingredient, usage: usage[ingredient.id] ?? 0, via: null, recent: false });
  }

  return out.slice(0, limit);
}

/**
 * Search by canonical name OR alias, ranked by usage.
 *
 * RULE 2 and RULE 3. An alias match returns the GENERIC it resolves to, with `via` carrying the alias
 * so the row can show why it appeared: search `fernet branca` and the result is `fernet liqueur`,
 * `via: "Fernet Branca"`.
 *
 * AN EXACT MATCH WINS OUTRIGHT, before usage is consulted. Typing `gin` and getting `ginger` above
 * `gin` because ginger is more used would be a picker that argues with its user. Exact folded equality
 * on the canonical name or on an alias puts the row first; everything after it is ranked by usage.
 *
 * AN EMPTY QUERY returns `defaults`, so the control has something to show before a keystroke.
 */
export function search(
  query: string,
  ingredients: Ingredient[],
  aliases: Alias[],
  usage: Usage,
  recents: string[] = [],
  limit = 12,
): Candidate[] {
  const needle = fold(query);
  if (needle === "") return defaults(ingredients, usage, recents, limit);

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const matched = new Map<string, Candidate>();

  // Canonical names first, so a canonical hit wins the `via` slot over an alias hit.
  for (const ingredient of ingredients) {
    if (fold(ingredient.canonical_name).includes(needle)) {
      matched.set(ingredient.id, {
        ingredient,
        usage: usage[ingredient.id] ?? 0,
        via: null,
        recent: recents.includes(ingredient.id),
      });
    }
  }

  // Then aliases. An alias only ADDS an ingredient, or fills in a row the canonical pass missed.
  for (const a of aliases) {
    if (!fold(a.alias).includes(needle)) continue;
    const ingredient = byId.get(a.ingredient_id);
    if (!ingredient) continue;
    if (matched.has(ingredient.id)) continue;
    matched.set(ingredient.id, {
      ingredient,
      usage: usage[ingredient.id] ?? 0,
      via: a.alias,
      recent: recents.includes(ingredient.id),
    });
  }

  const isExact = (c: Candidate): boolean =>
    fold(c.ingredient.canonical_name) === needle || (c.via !== null && fold(c.via) === needle);

  return [...matched.values()]
    .sort((a, b) => {
      const ea = isExact(a) ? 1 : 0;
      const eb = isExact(b) ? 1 : 0;
      if (ea !== eb) return eb - ea;
      return b.usage - a.usage || a.ingredient.canonical_name.localeCompare(b.ingredient.canonical_name);
    })
    .slice(0, limit);
}

// ── direct run ───────────────────────────────────────────────────────────────────────────────

/**
 * One row of `public.garnish_elements`.
 *
 * A SECOND VOCABULARY, and the reason it lives here rather than in the component: it shares `fold` with
 * the ingredient picker, and folding is exactly the rule an author would get wrong twice if each control
 * implemented its own. `jalapeño` is a garnish as well as an ingredient, and `crème` is spelt the same
 * way in both tables.
 */
export type GarnishElement = { id: string; name: string };

/**
 * Match a garnish element by name. Same control as the ingredient picker, and three differences, every
 * one of them a fact about the table rather than a choice:
 *
 *   * NO ALIASES. `garnish_elements` holds `id, name` and nothing else, so there is no `via` to carry.
 *   * NO USAGE, NO RECENTS. No `spec_garnish` count is fetched here and there is no localStorage list,
 *     so there is no ranking signal to rank against.
 *   * THEREFORE ALPHABETICAL, which is the only honest order available. This module's own reason for
 *     ranking ingredients -- "recents beat frequents" -- has nothing to say where neither exists.
 *
 * AN EXACT MATCH STILL WINS OUTRIGHT, the same rule as `search` above and for the same reason: typing
 * `cherry` while `cherry tomato` sorts beside it must not put the variant first.
 *
 * AN EMPTY QUERY RETURNS NOTHING, deliberately, and it is the one place this differs from the ingredient
 * picker's `defaults`. The vocabulary is over a thousand rows and no "first eight" of it is a
 * suggestion -- any eight would be an arbitrary slice wearing the authority of a recents list. The
 * field's placeholder is the invitation instead.
 */
export function matchElements(query: string, elements: GarnishElement[], limit = 8): GarnishElement[] {
  const needle = fold(query);
  if (needle === "") return [];
  const exact = (el: GarnishElement): number => (fold(el.name) === needle ? 1 : 0);
  return elements
    .filter((el) => fold(el.name).includes(needle))
    .sort((a, b) => exact(b) - exact(a) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

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
    if (!ok) throw new Error(`picker self-check failed: ${what}`);
  };
  const block = (text: string): void => {
    console.log();
    console.log(text);
  };

  // A fixture built from the REAL rows, including the two brands that were reported missing from the
  // lego box by a pass that searched the generics only.
  const g = (id: string, canonical_name: string, category: string | null = "liqueur"): Ingredient =>
    ({ id, canonical_name, category });

  const ING: Ingredient[] = [
    g("gin", "gin", "spirit"),
    g("ginger", "ginger", "fresh produce"),
    g("ginger-beer", "ginger beer", "carbonated mixer"),
    g("fernet", "fernet liqueur"),
    g("benedictine", "benedictine liqueur"),
    g("triple-sec", "triple sec"),
    g("elderflower", "elderflower liqueur"),
    g("jalapeno", "jalapeño", "fresh produce"),
    g("bacardi", "bacardí rum", "spirit"),
    g("maraschino", "maraschino liqueur"),
    g("lime", "lime", "fresh produce"),
    g("cherry", "cherry", "fresh produce"),
  ];

  const AL: Alias[] = [
    { alias: "Fernet Branca", ingredient_id: "fernet" },
    { alias: "Fernet Branca digestive bitter liqueur", ingredient_id: "fernet" },
    { alias: "Benedictine D.O.M.", ingredient_id: "benedictine" },
    { alias: "Cointreau triple sec liqueur", ingredient_id: "triple-sec" },
    { alias: "St-Germain elderflower liqueur", ingredient_id: "elderflower" },
    { alias: "Luxardo Maraschino liqueur", ingredient_id: "maraschino" },
  ];

  // Usage in the shape the query would produce: `maraschino` is used far more than `fernet`.
  const USE: Usage = {
    lime: 1200, cherry: 900, gin: 800, "triple-sec": 549, maraschino: 324,
    elderflower: 274, ginger: 90, "ginger-beer": 40, jalapeno: 6, fernet: 62,
    benedictine: 0, bacardi: 0,
  };

  // ── 1. fold ────────────────────────────────────────────────────────────────────────────────────
  check(fold("Fernet Branca") === "fernet branca", "fold lowercases");
  check(fold("jalapeño") === "jalapeno", "fold strips the tilde");
  check(fold("bacardí rum") === "bacardi rum", "fold strips the accent");
  check(fold("Crème de Menthe") === "creme de menthe", "fold strips the grave");
  check(fold("St-Germain  elderflower") === "st germain elderflower", "fold collapses punctuation and runs of space");
  check(fold("") === "" && fold("   ") === "", "blank folds to blank");
  block("fold: diacritics gone, punctuation collapsed, so 'jalapeno' can find 'jalapeño'");

  // ── 2. THE WORKED EXAMPLE. "fernet branca matches fernet liqueur." ─────────────────────────────
  const fernet = search("fernet branca", ING, AL, USE);
  check(fernet.length > 0, "searching 'fernet branca' returns something");
  check(fernet[0].ingredient.id === "fernet", `first result is fernet liqueur, got ${fernet[0].ingredient.id}`);
  check(fernet[0].ingredient.canonical_name === "fernet liqueur", "and it is the GENERIC, not the alias");
  check(fernet[0].via === "Fernet Branca", `via carries the alias that matched, got ${fernet[0].via}`);
  check(fernet[0].usage === 62, "and it carries the generic's usage, not the alias's");
  block("RULE 3: 'fernet branca' finds `fernet liqueur`, via the alias, ranked by the generic's usage");

  // ── 3. RULE 2. aliases match to generics ───────────────────────────────────────────────────────
  const benedictine = search("benedictine d.o.m.", ING, AL, USE);
  check(benedictine.length === 1 && benedictine[0].ingredient.id === "benedictine", "the Benedictine brand finds its generic");
  check(benedictine[0].via === "Benedictine D.O.M.", "via is the brand as written");

  const cointreau = search("cointreau", ING, AL, USE);
  check(cointreau.length === 1 && cointreau[0].ingredient.id === "triple-sec", "Cointreau finds `triple sec`");
  check(cointreau[0].ingredient.canonical_name === "triple sec", "the generic, not the brand");

  const stgermain = search("st germain", ING, AL, USE);
  check(stgermain.length === 1 && stgermain[0].ingredient.id === "elderflower", "St-Germain finds `elderflower liqueur`");

  const luxardo = search("luxardo", ING, AL, USE);
  check(luxardo.length === 1 && luxardo[0].ingredient.id === "maraschino", "Luxardo finds `maraschino liqueur`");
  block("RULE 2: four brands, four generics, every one reached through an alias");

  // ── 4. the accent, which is the other half of folding ──────────────────────────────────────────
  const jalapeno = search("jalapeno", ING, AL, USE);
  check(jalapeno.length === 1 && jalapeno[0].ingredient.id === "jalapeno", "'jalapeno' finds 'jalapeño'");
  check(jalapeno[0].via === null, "and it is a canonical hit, not an alias hit");
  const bacardi = search("bacardi", ING, AL, USE);
  check(bacardi.length === 1 && bacardi[0].ingredient.id === "bacardi", "'bacardi' finds 'bacardí rum'");
  block("a keyboard without accents still finds the accented vocabulary");

  // ── 5. an exact match beats a more-used substring ──────────────────────────────────────────────
  const gin = search("gin", ING, AL, USE);
  check(gin[0].ingredient.id === "gin", `'gin' returns gin first, got ${gin[0].ingredient.id}`);
  check(gin.some((c) => c.ingredient.id === "ginger"), "and ginger is still offered below it");
  check(gin.some((c) => c.ingredient.id === "ginger-beer"), "so is ginger beer");
  block("an exact match wins before usage is consulted: 'gin' does not return ginger first");

  // ── 6. RULE 1. recents beat frequents ──────────────────────────────────────────────────────────
  const plain = defaults(ING, USE, []);
  check(plain[0].ingredient.id === "lime", "with no recents, the most-used is first");
  check(plain[0].recent === false, "and it is not marked recent");

  const withRecents = defaults(ING, USE, ["fernet", "jalapeno"]);
  check(withRecents[0].ingredient.id === "fernet", `a recent with 62 uses outranks lime's 1,200, got ${withRecents[0].ingredient.id}`);
  check(withRecents[1].ingredient.id === "jalapeno", "recents keep their order: fernet, then jalapeno");
  check(withRecents[0].recent === true && withRecents[1].recent === true, "both are marked recent");
  check(withRecents[2].ingredient.id === "lime", "and the most-used follows the recents");
  block("RULE 1: recents beat frequents -- fernet (62) and jalapeno (6) both outrank lime (1,200)");

  // ── 7. recents that are stale must not put a hole in the list ──────────────────────────────────
  const stale = defaults(ING, USE, ["no-such-id", "fernet", "fernet"]);
  check(stale[0].ingredient.id === "fernet", "an unknown id is skipped");
  check(new Set(stale.map((c) => c.ingredient.id)).size === stale.length, "and a repeated recent is not listed twice");
  block("a stale or duplicated localStorage id is skipped, not trusted");

  // ── 8. an empty query falls back to the defaults ───────────────────────────────────────────────
  const empty = search("", ING, AL, USE, ["fernet"]);
  check(empty[0].ingredient.id === "fernet", "an empty query shows the recents first");
  check(empty.length === defaults(ING, USE, ["fernet"]).length, "and is exactly the defaults list");
  block("an empty query is the defaults list, so the control has something to show before a keystroke");

  // ── 9. no match is an honest empty, not a guess ────────────────────────────────────────────────
  check(search("zzzznotathing", ING, AL, USE).length === 0, "an unmatched query returns nothing");
  check(search("unobtainium", ING, AL, USE).length === 0, "and another one does too");
  block("no match returns nothing rather than a nearest guess");

  // ── 10. the limit is respected, and the order is stable ────────────────────────────────────────
  check(defaults(ING, USE, [], 3).length === 3, "the limit is respected");
  check(search("i", ING, AL, USE, [], 2).length <= 2, "the limit is respected in search too");
  check(
    defaults(ING, USE, []).map((c) => c.ingredient.id).join() === defaults(ING, USE, []).map((c) => c.ingredient.id).join(),
    "the order does not change between calls",
  );
  block("the limit holds and the order is deterministic");

  // ── 11. THE SECOND VOCABULARY. A garnish element matches by name, and there is no ranking to invent ─
  const EL: GarnishElement[] = [
    { id: "orange", name: "orange" },
    { id: "orange-twist", name: "orange twist" },
    { id: "orange-wedge", name: "orange wedge" },
    { id: "cherry", name: "cherry" },
    { id: "cherry-tomato", name: "cherry tomato" },
    { id: "jalapeno", name: "jalapeño" },
    { id: "lemon", name: "lemon" },
  ];
  check(matchElements("", EL).length === 0, "an empty query shows nothing -- there is no default worth inventing");
  check(matchElements("   ", EL).length === 0, "and neither does whitespace");
  check(matchElements("orange", EL).length === 3, "a substring matches every variant");
  check(matchElements("orange", EL)[0].id === "orange", "'orange' returns `orange` before its own variants");
  check(matchElements("cherry", EL)[0].id === "cherry", "'cherry' beats `cherry tomato`, which sorts beside it");
  check(matchElements("jalapeno", EL)[0].id === "jalapeno", "the same folding that finds 'jalapeño' as an ingredient");
  check(matchElements("zzzznotathing", EL).length === 0, "no match is an honest empty, not a nearest guess");
  check(matchElements("o", EL, 2).length === 2, "the limit is respected");
  check(
    matchElements("orange", EL).map((e) => e.id).join() === matchElements("orange", EL).map((e) => e.id).join(),
    "the order is deterministic",
  );
  block("garnish elements: folded name match, exact wins, alphabetical below it, nothing invented");

  block(`all ${checks} picker checks passed`);
}
