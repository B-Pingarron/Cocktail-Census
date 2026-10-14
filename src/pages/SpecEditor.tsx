import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { getSessionId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { composeAmount, formatQuantity, orderUnits, parseAmount, type Unit } from "@/lib/units";
import { defaults, matchElements, search, type Alias, type Candidate, type GarnishElement, type Ingredient, type Usage } from "@/lib/picker";
import { buildPayload, validate, type Draft, type DraftGarnish, type DraftIngredient } from "@/lib/editor";
import { compositorUrl, garnishAssetOf } from "@/lib/compositor";
import FeedbackDoor from "@/components/FeedbackDoor";
import "@/roast.css";
import "@/roast-edit.css";

/**
 * The spec editor — one screen, save-as-a-version through `save_spec_draft`.
 *
 * WHAT THIS IS, IN THE AUTHOR'S WORDS: "the user creates a spec, right? then he creates more. those are
 * NOT submissions, those are simply their specs. their library." So this screen writes a SPEC into the
 * author's LIBRARY. It does not enter them in anything. A Submission is a separate act — a selection of
 * at least three of these, made later.
 *
 * SECTION 7b DECIDED THE CONTROLS, measured rather than assumed:
 *   * the PICKER is recents -> most-used -> search over canonical names AND aliases, ranked by usage.
 *     Category-first was DISPROVED: `parent_id` has zero rows and 49% of everything sits in three of
 *     22 flat categories. So category is a filter chip at most, never a first step.
 *   * on pick, BOTH `ingredient_id` and `raw_name` are stored -- "which brand this recipe used was
 *     lost" once already, and an editor writing only the generic re-introduces that bug.
 *   * the GARNISH is a produce plus optional axis chips, attached at (group, position). The drawings
 *     are a PREVIEW layer, not the input vocabulary -- 30 drawings against 1,117 elements.
 *   * `ice` HAS NO FIELD. Section 7b: "nullable, no editor field and no UI."
 *
 * `?dry=1` SKIPS THE WRITE, the same flag the deck and the menu honour: the only way to walk this
 * screen in a browser without putting a row in the production table.
 *
 * ── THE WIRING PASS, 2026-10-12 ────────────────────────────────────────────────────────────────────
 *
 * THIS FILE USED TO BE TAILWIND OVER `<MenuCard>`. `MenuCard` is the Dark Academia hub's component --
 * `roast.css`'s own header calls it "a different language… gold hairline, Playfair, 6px corners" -- so
 * an arena room wearing it was the crossing run backwards. Every utility and the wrapper are gone; the
 * room's vocabulary is `roast-edit.css`, scoped `.roast.roast-edit`, which is the approved study's
 * rule block ported (that file's header carries the port notes and the exceptions).
 *
 * NOT ONE LINE OF BEHAVIOUR MOVED. `loadRefs`, `fetchAll`, `amountFor`, `defaults`, `search`,
 * `buildPayload`, `validate`, the four RPC paths, the dry flag, and every sentence are as they were.
 * What moved is the markup and the classes.
 *
 * ── THE SIX THINGS THAT ARE DECISIONS RATHER THAN MECHANICS ────────────────────────────────────────
 *
 *   1. `GLASS_FILE` BELOW -- THE REAL DRAWING, NOT A STAND-IN. The first version of this port stood
 *      THREE CSS SILHOUETTES in for art the site already served; the author's report was "roast edit
 *      is serving placeholders, not the real images i designed," and he was right. The fifteen
 *      drawings were already vendored for the drink card page at
 *      `public/roast/assets/compositor/svg/glasses/`. The keys are the compositor's OWN fifteen asset
 *      ids from `db/add-rung2-glass-asset-map.sql`'s `check (asset_id in (...))`, reached through the
 *      `glassAssets` map this page already loads -- so nothing here is invented. It is a TABLE and
 *      not a `glass-${asset}.svg` template because ONE drawing is spelled differently:
 *      `highball` is `highball-outline.svg`.
 *   2. THE MEASURE IS TWO CONTROLS. The row prints `6 cl` as one measure, but the column stores ONE
 *      string (`spec_ingredients.amount` is TEXT). So the split is `parseAmount` on the way in and
 *      `amountFor` (this file's own) on the way out -- both from `lib/units.ts`, no new parsing.
 *      A bare amount is preserved: `1.75` stays `1.75` with no unit rather than becoming
 *      `1.75 cl`, which is the data change `units.ts` protects six of the author's amounts against.
 *      ** SUPERSEDED BY ITEM F12 ** `amountFor` used to be "unchanged", and that was the defect:
 *      it appended the unit label to ANY non-empty text, so typing `1/2` with `cl` selected wrote
 *      `1/2 cl` into the field while `parseAmount("1/2 cl")` is null and the unit control rendered
 *      "no unit" beside it. It now composes ONLY what the parser can read back; anything else
 *      stays verbatim with NO unit appended, so the input and the unit control always describe the
 *      same fact. The unreadable text is not lost -- `validate()` (ITEM F13) names it a problem and
 *      blocks the save until it is fixed. No fraction grammar is invented: `1/2` is the author's
 *      to decide on, not this fix's.
 *   3. `qtyDraft` BELOW. Storing a composed string on every keystroke would eat a half-typed decimal
 *      (`4.` composes to `4 cl`). The input therefore displays the draft text while it is being typed
 *      and the composed value the rest of the time, and the caret never fights the composition.
 *   4. THE EXIT IS A `<Link>`, NOT `<ExitLink>`. `ExitLink` renders the app's own exit chip and takes
 *      no flag, and this page's `?dry=1` has to survive the way back — it is the only way to walk the
 *      room without a write. That is a deviation from the family's convention and it is deliberate.
 *   5. THE GARNISH PICKER BELOW. The garnish element was the LAST native `<select>` over an open
 *      vocabulary, and it was not merely ugly -- it was CAPPED. `refs.elements.slice(0, 400)` against
 *      1,117 rows in `garnish_elements` left 717 elements unreachable, which is why the row was hard to
 *      use and why `cherry tomato` could sit outside the list entirely. It is now the same control as
 *      the ingredient picker, over the other vocabulary: `matchElements` in `lib/picker.ts` folds the
 *      name, so `jalapeno` finds `jalapeño` here for exactly the reason it does there.
 *   6. `compositorHref` BELOW -- THE MINI COMPOSITOR, CARRIED BY THE DRAFT. The author: "the mini
 *      compositor needs to be tied to the editor so the glass and other elements loaded match the
 *      ones in the recipe." The receiver's half shipped first and is the page's own contract, written
 *      into `roast-drink-card.html`'s header long before anything used it: "The editor resolves the
 *      recipe's own prose to asset ids and hands them over; this page receives IDS and parses
 *      nothing." It now reads `?glass=`, `?garnish=`, `?ice=`, `?color=`.
 *      THE DRAFT, NOT THE SAVED ROW, and that is forced rather than chosen: the compositor is a
 *      STATIC page (`apps/census/public/roast/`), so it has no database access and no way to look a
 *      spec up. Everything it draws has to arrive in the URL, so a preview of a draft is the only
 *      preview this architecture can have.
 *      THE TWO ID SPACES DIFFER, and that is the whole of the wiring: `glass_asset_map` allows
 *      fifteen asset ids and the compositor's `GLASS_PRESET` carries fourteen. The app's `highball`
 *      is the compositor's `highball-outline`, and the app's `tiki-mug` has NO PRESET there -- its
 *      own header records that offering it "drew a drink at a scale nobody measured". So `tiki-mug`
 *      is absent from `COMPOSITOR_GLASS` on purpose and that recipe opens on the default drink.
 *      BOTH JOINS MOVED TO `lib/compositor.ts` on 2026-10-13, when the roster took the same door.
 *      That module's header carries them and says what stayed behind here.
 *      THE GARNISH JOIN IS A COMPOSITION, NOT A LOOKUP. The draft holds an element plus axis values
 *      (`orange` + `fold:twist`) and the compositor holds thirty finished drawings (`orange-twist`).
 *      `garnishAssetOf` composes `element-value` for each axis, then falls back to the element
 *      alone, and accepts the result ONLY IF IT IS ONE OF THE THIRTY -- so an unknown combination
 *      resolves to nothing and the compositor keeps its own default rather than receiving a name
 *      that 404s. The variant family (`mint1`..`mint4`, `raspberry`/`1`/`2`) is NOT resolved: four
 *      drawings share the element `mint`, and picking one would be a guess, which is exactly what
 *      this file does not do.
 *
 * TWO THINGS THE STUDY HAD THAT ARE NOT HERE, both because the app owns the fact differently:
 *   * the "draws as …" sentence under the glass select. The study deleted it -- its own note: "it
 *     described the drawing, not the drink" -- and the drawing is now the mark beside the version row.
 *   * NO GARNISH EMPTY STATE. The study printed a sentence for an empty garnish list; the app owns no
 *     such sentence (`validate()` has none), and the garnish picker below is right there. Inventing
 *     that line to fill the slot is the one thing this file will not do.
 */

type Refs = {
  cocktails: { id: string; name: string }[];
  glassware: { id: string; name: string }[];
  glassAssets: Record<string, string | null>;
  techniques: { id: string }[];
  ingredients: Ingredient[];
  aliases: Alias[];
  usage: Usage;
  elements: { id: string; name: string }[];
  axes: { axis: string; id: string; name: string }[];
  units: Unit[];
};

/** PostgREST caps a response at 1,000 rows, so every big table is walked in pages. */
async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  if (!supabase) return [];
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + page - 1);
    if (error || !data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < page) break;
  }
  return out;
}

async function loadRefs(): Promise<Refs> {
  const [cocktails, glassware, glassMap, techniques, ingredients, aliases, usage, elements, axes, units] =
    await Promise.all([
      fetchAll<{ id: string; name: string }>("cocktails", "id,name"),
      fetchAll<{ id: string; name: string }>("glassware", "id,name"),
      fetchAll<{ glass_id: string; asset_id: string | null }>("glass_asset_map", "glass_id,asset_id"),
      fetchAll<{ id: string }>("techniques", "id"),
      fetchAll<Ingredient>("ingredients", "id,canonical_name,category"),
      fetchAll<Alias>("ingredient_aliases", "alias,ingredient_id"),
      fetchAll<{ ingredient_id: string; usage: number }>("ingredient_usage", "ingredient_id,usage"),
      fetchAll<{ id: string; name: string }>("garnish_elements", "id,name"),
      fetchAll<{ axis: string; id: string; name: string }>("garnish_axis_values", "axis,id,name"),
      fetchAll<Unit>("units", "id,label,plural,kind,position"),
    ]);

  const usageMap: Usage = {};
  for (const row of usage) usageMap[row.ingredient_id] = row.usage;

  const glassAssets: Record<string, string | null> = {};
  for (const row of glassMap) glassAssets[row.glass_id] = row.asset_id;

  return {
    cocktails: [...cocktails].sort((a, b) => a.name.localeCompare(b.name)),
    glassware: [...glassware].sort((a, b) => a.name.localeCompare(b.name)),
    glassAssets,
    techniques: [...techniques].sort((a, b) => a.id.localeCompare(b.id)),
    ingredients,
    aliases,
    usage: usageMap,
    elements: [...elements].sort((a, b) => a.name.localeCompare(b.name)),
    axes,
    units: orderUnits(units),
  };
}

/** The amount, composed from what the author typed and the unit they chose. */
function amountFor(text: string, unit: Unit | null): string {
  const trimmed = text.trim();
  if (!unit) return trimmed;
  const n = Number(trimmed.replace(",", "."));
  // A number plus a unit composes properly, with the right plural.
  //
  // ANYTHING ELSE KEEPS ITS TEXT AND GETS NO UNIT (ITEM F12). This used to append the unit label
  // anyway -- `1/2` became `1/2 cl` -- while `parseAmount("1/2 cl")` is null, so the input held a
  // string its own parser could not read back and the unit control read "no unit" beside it. Both
  // controls derive from the ONE stored string, so now: what parses composes, what does not stays
  // verbatim and unit-less, and `validate()` (ITEM F13) turns that text into a problem that blocks
  // the save. `types/roast.ts` still governs the payload -- this is the editor's gate, not a
  // rewrite of what an amount may be.
  if (trimmed !== "" && Number.isFinite(n)) return composeAmount(n, unit);
  return trimmed;
}

/**
 * THE GLASS — the real drawing, keyed off the compositor's OWN asset id.
 *
 * THIS REPLACES THREE CSS SILHOUETTES. The table here used to be `GLASS_MARK`, a 15 -> 3 grouping
 * that drew three hand-made boxes in place of the fifteen drawings the compositor actually has. The
 * author's report: "roast edit is serving placeholders, not the real images i designed." He was
 * right, and the drawings were already on the served site — vendored to
 * `public/roast/assets/compositor/svg/glasses/` for the drink card page. Three generic shapes were
 * never needed; they were a stand-in for art that was one `<img>` away.
 *
 * The fifteen keys are the fifteen `db/add-rung2-glass-asset-map.sql` allows in its own
 * `check (asset_id in (...))`, and they arrive through `glass_asset_map` -> `glassAssets`, the map
 * this page already loads.
 *
 * THE FILENAMES ARE SPELLED OUT RATHER THAN BUILT. Fourteen are `glass-<id>.svg`; `highball` is NOT —
 * it is `highball-outline.svg`, the name the compositor gave that drawing. A `glass-${asset}.svg`
 * template would 404 on exactly one glass, silently, and produce a broken image for a glass the
 * editor offers as its own canon.
 *
 * NOTHING RENDERS WHEN THE MAP HAS NO ASSET. `glass_asset_map` records 46 recipe glass names against
 * 15 drawings and its null `asset_id` is "a RECORDED fact, not an omission" — so an unmapped glass
 * gets no drawing rather than a wrong one. A drawing that fails to load is dropped the same way (see
 * the `onError` at the mark). The mark is `aria-hidden` and decorative either way: the glass NAME is
 * the fact, and it lives in the labelled select beside it.
 *
 * THE PATH IS RELATIVE, and that is not a style choice: `vite.config.ts` is `base: "./"`, so an
 * absolute `/roast/...` breaks on the GitHub Pages project subpath. Same reason the menu's chip reads
 * `./roast/roast-drink-card.html`.
 */
const GLASS_FILE: Record<string, string> = {
  "old-fashioned": "glass-old-fashioned",
  shot: "glass-shot",
  coupe: "glass-coupe",
  martini: "glass-martini",
  flute: "glass-flute",
  goblet: "glass-goblet",
  wine: "glass-wine",
  snifter: "glass-snifter",
  "nic-and-nora": "glass-nic-and-nora",
  collins: "glass-collins",
  highball: "highball-outline", // the ONE drawing not spelled `glass-<id>`
  hurricane: "glass-hurricane",
  pint: "glass-pint",
  "tiki-mug": "glass-tiki-mug",
  toddy: "glass-toddy",
};

/** Where the compositor's drawings are served from. Relative — see `GLASS_FILE` for why. */
const GLASS_DIR = "./roast/assets/compositor/svg/glasses/";

/**
 * THE MINI COMPOSITOR'S URL AND ITS TWO JOINS MOVED TO `@/lib/compositor` — 2026-10-13.
 *
 * They were written here first, when the editor was the only door into the preview. The ROSTER now
 * carries the same door on every row of the library, and the alternative to moving them was a second
 * `COMPOSITOR_GLASS` and a second `garnishAssetOf` in another file — the drift this project has
 * already paid for twice (`roastNotes.ts`'s vocabulary, `selectionLabel()`'s wording). So the preset
 * key, the garnish vocabulary, the composition rule and the query-string assembly live there, once,
 * and both rooms import the same functions.
 *
 * WHAT STAYED HERE IS THIS ROOM'S OWN: `GLASS_FILE` and `GLASS_DIR` above, which serve the editor's
 * `<img>` mark and are nobody else's business.
 */

/** The nine garnish axes, in the order the card composes them in. The app's own list. */
const AXES = ["part", "cut", "fold", "portion", "size", "state", "arrangement", "position", "process"];

/** The ingredient picker: a search box over canonical names AND aliases, ranked by usage. */
function IngredientPicker({
  refs,
  recents,
  onPick,
}: {
  refs: Refs;
  recents: string[];
  onPick: (candidate: Candidate) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(
    () => search(query, refs.ingredients, refs.aliases, refs.usage, recents, 8),
    [query, refs, recents],
  );
  const resting = useMemo(
    () => defaults(refs.ingredients, refs.usage, recents, 8),
    [refs, recents],
  );
  const shown = query.trim() === "" ? resting : results;

  return (
    <>
      <input
        id="f-pick"
        type="search"
        autoComplete="off"
        aria-controls="picklist"
        aria-describedby="h-pick"
        className="ctl"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search an ingredient or a brand…"
      />
      {/* `.pick-list:empty{display:none}` in the stylesheet does the hiding, so a closed list costs
          no box and no margin. */}
      <ul className="pick-list" id="picklist" aria-label="Ingredient matches">
        {open &&
          shown.map((c) => (
            <li key={c.ingredient.id}>
              <button
                type="button"
                className="pick-row"
                onClick={() => {
                  onPick(c);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="pick-name">{c.ingredient.canonical_name}</span>
                <span className="pick-why">
                  {c.via ? (
                    <>
                      via <b>{c.via}</b>
                    </>
                  ) : c.recent ? (
                    "recent"
                  ) : (
                    `used in ${c.usage} specs`
                  )}
                </span>
              </button>
            </li>
          ))}
      </ul>
      {open && query.trim() !== "" && shown.length === 0 && (
        <p className="pick-empty">Nothing matches “{query.trim()}”.</p>
      )}
    </>
  );
}

/** The garnish picker. The same control as the ingredient picker, over the other vocabulary. */
function ElementPicker({
  elements,
  onPick,
}: {
  elements: GarnishElement[];
  onPick: (el: GarnishElement) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // No `defaults` analogue here: see `matchElements`. An empty query shows nothing rather than an
  // arbitrary slice of a thousand rows, and `.pick-list:empty` makes that cost no box at all.
  const shown = useMemo(() => matchElements(query, elements, 8), [query, elements]);

  return (
    <>
      <input
        id="f-element"
        type="search"
        autoComplete="off"
        aria-controls="ellist"
        aria-describedby="h-garnish"
        className="ctl"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search a garnish element…"
      />
      {/* A DIFFERENT LIST ID FROM THE INGREDIENT PICKER'S `picklist`: both controls are on this page at
          the same time, and a duplicated id would make `aria-controls` point at the wrong list. */}
      <ul className="pick-list" id="ellist" aria-label="Garnish element matches">
        {open &&
          shown.map((el) => (
            <li key={el.id}>
              <button
                type="button"
                className="pick-row"
                onClick={() => {
                  onPick(el);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="pick-name">{el.name}</span>
              </button>
            </li>
          ))}
      </ul>
      {open && query.trim() !== "" && shown.length === 0 && (
        <p className="pick-empty">Nothing matches “{query.trim()}”.</p>
      )}
    </>
  );
}

const SpecEditor = () => {
  const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const dry = params.get("dry") === "1";
  // `?cocktail=<slug>` comes from the roster's "write a new version", so the author lands on the same
  // drink instead of hunting for it again. A new version of a drink you already have is the whole point
  // of the Update flow, and section 7b's model makes it an INSERT: `save_spec_draft` sets
  // `not v_has_live`, so the FIRST version is live and the live one stays live while you write.
  const preselect = params.get("cocktail") ?? "";
  const [refs, setRefs] = useState<Refs | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    sessionId: getSessionId(),
    cocktailSlug: preselect,
    name: "",
    glassId: null,
    techniqueIds: [],
    notes: "",
    ingredients: [],
    garnishes: [],
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The two disclosures are keyed by index and therefore SEPARATE. One shared set would open
  // ingredient 2's fields when garnish 2 was expanded — the defect the garnish pass already recorded.
  const [openIng, setOpenIng] = useState<number[]>([]);
  const [openGn, setOpenGn] = useState<number[]>([]);
  // The number input's in-progress text. See item 3 in the header: a composed string written on every
  // keystroke eats a half-typed decimal, so the input reads this while it exists and the composed
  // value the rest of the time.
  const [qtyDraft, setQtyDraft] = useState<Record<number, string>>({});
  // A drawing that fails to load is dropped rather than left as a broken-image glyph — the same "no
  // mark rather than a wrong one" ruling the unmapped case follows. It holds the FILE NAME, not a
  // boolean, so choosing a different glass renders again instead of staying blank forever.
  const [glassFailed, setGlassFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRefs()
      .then((r) => {
        if (cancelled) return;
        if (r.ingredients.length === 0 && !dry) setFailed(true);
        setRefs(r);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [dry]);

  // While the catalogue loads, `refs` is null and the form is not rendered at all (the early return
  // below), so the empty vocabulary here cannot block anything real; once the table arrives,
  // validate() reads amounts against the SAME rows the unit control offers (ITEM F13).
  const problems = validate(draft, refs?.units ?? []);
  const glassAsset = draft.glassId ? refs?.glassAssets[draft.glassId] ?? null : null;
  const glassFile = glassAsset ? GLASS_FILE[glassAsset] : undefined;

  /**
   * THE MINI COMPOSITOR'S URL, CARRIED BY THE DRAFT — item 6 in the header. The page is static, so
   * every fact it draws has to arrive in the query string, and `lib/compositor.ts` owns both joins
   * (`compositorGlassPreset`, `garnishAssetOf`) plus the assembly — the ROSTER builds its row links
   * with the same functions, so the two doors cannot drift apart.
   *
   * IT CARRIES THE FIRST GARNISH AND ONLY THE FIRST. The compositor draws one garnish drawing and a
   * recipe may hold several; picking which to show would be a second decision this file has no basis
   * for, so `garnishes[0]` is the one the author is most likely to mean — and the compositor's own
   * caption names the glass it actually drew, so what arrived is never a guess.
   */
  const compositorHref = useMemo(
    () =>
      compositorUrl({
        glassAsset: draft.glassId ? refs?.glassAssets[draft.glassId] ?? null : null,
        garnish: draft.garnishes[0]
          ? garnishAssetOf(draft.garnishes[0].elementId, draft.garnishes[0].axes)
          : null,
      }),
    [draft.glassId, draft.garnishes, refs],
  );

  const setIngredient = (index: number, patch: Partial<DraftIngredient>) =>
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));

  const setGarnish = (index: number, patch: Partial<DraftGarnish>) =>
    setDraft((d) => ({
      ...d,
      garnishes: d.garnishes.map((g, i) => (i === index ? { ...g, ...patch } : g)),
    }));

  /** Removing a row shifts every index above it, so both open-sets are re-keyed and the drafts clear. */
  const removeIngredient = (index: number) => {
    setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((_, i) => i !== index) }));
    setOpenIng((open) => open.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)));
    setQtyDraft({});
  };

  const removeGarnish = (index: number) => {
    setDraft((d) => ({ ...d, garnishes: d.garnishes.filter((_, i) => i !== index) }));
    setOpenGn((open) => open.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)));
  };

  const save = async () => {
    setSaveError(null);
    setSaved(null);
    if (problems.length > 0) return;
    const payload = buildPayload(draft);
    if (dry) {
      setSaved(`dry run — would save “${draft.name.trim()}” with ${draft.ingredients.length} ingredients`);
      return;
    }
    if (!supabase) {
      setSaveError("No database connection, so nothing was saved.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("save_spec_draft", { payload });
    setSaving(false);
    if (error) setSaveError(error.message);
    else setSaved(`saved as ${String(data).slice(0, 8)}…`);
  };

  /* The ground is two pseudo-elements plus one field, and the page sits above all three at z-index
     10. Rendered by every branch, including the two that return no form, so the room is still the
     room when the catalogue fails. */
  const shell = (children: ReactNode) => (
    <div className="roast roast-edit">
      <div className="ed-loose" aria-hidden="true" />
      <div className="page">
        <div className="col">{children}</div>
      </div>
    </div>
  );

  if (failed) {
    return shell(
      <div className="rp blocked">
        <p>The catalogue could not be loaded, so the editor cannot open.</p>
      </div>,
    );
  }

  if (!refs) {
    return shell(
      <div className="rp blocked">
        <p>Opening the editor…</p>
      </div>,
    );
  }

  const recents = draft.ingredients.map((i) => i.ingredientId).filter(Boolean);
  // The one empty state inside the card. The sentence is `lib/editor.ts`'s own, pulled out of
  // `validate()` rather than retyped here -- so the row and the save bar cannot drift apart.
  const nothingYet = problems.find((p) => p.includes("at least one ingredient"));

  return shell(
    <>
      {/* The way out carries `?dry=1` with it, which `ExitLink` cannot. See item 4 in the header. */}
      <div className="exitrow">
        <Link to={dry ? "/roast?dry=1" : "/roast"}>back to the room</Link>
        {/* THE SAME CHIP THE MENU CARRIES, in the same place, because it is the same door — see item
            6 in the header for the two joins. `target="_blank"` keeps the draft alive in this tab:
            the preview is a deep link built from state that exists only here. */}
        <a href={compositorHref} target="_blank" rel="noopener noreferrer">
          mini compositor <span aria-hidden="true">→</span>
        </a>
        {/* THE FEEDBACK DOOR, last in the exitrow — the most peripheral link in the room's quiet
            row. The room's `.exitrow > a` rule styles it, exactly as it styles the two anchors
            beside it (that rule is scoped to the anchor, so no class is needed for the room's
            vocabulary; `exit` is kept for uniformity with the other ROAST mounts).
            NOT on the card: the exitrow is above the plate and outside any gesture surface. */}
        <FeedbackDoor where="editor" className="exit" />
      </div>

      <div className="card-wrap">
        <div className="plate-a" aria-hidden="true" />
        <div className="plate-b" aria-hidden="true" />

        <div className="card">
          {/* THE FILM — the screen surface's own texture, and the half this room never had:
              roast.css's taxonomy names exactly two film surfaces, the menu and the editor, and
              only the menu ever implemented it (ITEM F7). A CHILD of the card — the menu's
              `.rm-film` is a child of `.rm-frame` for the same reason — so the scanlines stop
              dead at the plate's edge and the ground keeps halftone only. Inert, aria-hidden,
              and it sits ABOVE the card's content exactly like the menu's sits above its doors. */}
          <div className="film" aria-hidden="true" />
          {/* ── the card's title bar: the room's name and the page's name, inside the frame ── */}
          <div className="card-bar">
            <span className="kick">Roast · the editor</span>
            <h1 className="title">My spec</h1>
          </div>

          {/* ── the head: the drink. The name plate first, then the pair it is a version of,
                 with the glass mark beside that row. ── */}
          <header className="card-head">
            <div className="field">
              <label className="flabel" htmlFor="f-name">
                Name
              </label>
              <input
                id="f-name"
                className="ctl nameplate"
                type="text"
                autoComplete="off"
                placeholder="name your version…"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>

            <div className="ch-row">
              <div className="field ch-ver">
                <label className="flabel" htmlFor="f-cocktail">
                  A version of
                </label>
                <div className="sel">
                  <select
                    id="f-cocktail"
                    className="ctl"
                    aria-describedby="h-cocktail"
                    value={draft.cocktailSlug}
                    onChange={(e) => setDraft((d) => ({ ...d, cocktailSlug: e.target.value }))}
                  >
                    <option value="">pick the Cocktail…</option>
                    {refs.cocktails.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* The compositor's own drawing, not a stand-in. `aria-hidden` and decorative: the
                  glass NAME is the fact and it lives in the labelled select above. An unmapped
                  glass — or a drawing that fails to load — gets nothing rather than a wrong shape.
                  See GLASS_FILE for the table, the filenames and why the path is relative. */}
              {glassFile && glassFile !== glassFailed && (
                <img
                  className="glassmark"
                  src={`${GLASS_DIR}${glassFile}.svg`}
                  alt=""
                  aria-hidden="true"
                  onError={() => setGlassFailed(glassFile)}
                />
              )}
            </div>

            <p className="hint plate" id="h-cocktail">
              The pair is the root, with the session: a version of a drink, not a new drink.
            </p>

            <p className="lede">
              One drink, saved to your library. It enters nothing — submitting is a separate act.
            </p>
          </header>

          <form className="form" noValidate onSubmit={(e) => e.preventDefault()}>
            <p className="sr" role="status" aria-live="polite">
              {saved ?? (saveError ? `Not saved: ${saveError}` : "")}
            </p>

            <span className="sechead" id="l-ingredients">
              Ingredients
            </span>
            <div role="group" aria-labelledby="l-ingredients">
              {draft.ingredients.length === 0 && <p className="row-none">{nothingYet}</p>}
              {draft.ingredients.map((line, index) => {
                const parsed = parseAmount(line.amount, refs.units);
                const unit = parsed?.unit ?? null;
                const qty = parsed ? formatQuantity(parsed.quantity) : line.amount.trim();
                const canonical = refs.ingredients.find((i) => i.id === line.ingredientId)?.canonical_name ?? "";
                const label = line.rawName || canonical || line.ingredientId;
                const isOpen = openIng.includes(index);
                return (
                  <div className={isOpen ? "line is-open" : "line"} key={index}>
                    <div className="pr-row">
                      <button
                        type="button"
                        className="pr-name"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setOpenIng((open) => (open.includes(index) ? open.filter((i) => i !== index) : [...open, index]))
                        }
                      >
                        <span className="pr-lbl">{label}</span>
                        <span className="pr-caret" aria-hidden="true" />
                      </button>

                      <div className="pr-amt-cell">
                        <input
                          className="pr-amt"
                          type="text"
                          inputMode="decimal"
                          placeholder="4.5"
                          aria-label={`Amount for ${label}`}
                          value={qtyDraft[index] ?? qty}
                          onChange={(e) => {
                            const text = e.target.value;
                            setQtyDraft((d) => ({ ...d, [index]: text }));
                            setIngredient(index, { amount: amountFor(text, unit) });
                          }}
                          onBlur={() =>
                            setQtyDraft((d) => {
                              const next = { ...d };
                              delete next[index];
                              return next;
                            })
                          }
                        />
                        <span className="pr-unit">
                          <select
                            aria-label={`Unit for ${label}`}
                            value={unit?.id ?? ""}
                            onChange={(e) => {
                              const next = refs.units.find((u) => u.id === e.target.value) ?? null;
                              setIngredient(index, { amount: amountFor(qtyDraft[index] ?? qty, next) });
                              setQtyDraft((d) => {
                                const rest = { ...d };
                                delete rest[index];
                                return rest;
                              });
                            }}
                          >
                            <option value="">no unit</option>
                            {refs.units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </span>
                      </div>
                    </div>

                    <div className="pr-more" hidden={!isOpen}>
                      <div className="sel">
                        <select
                          className="ctl"
                          aria-label={`Role for ${label}`}
                          value={line.role ?? ""}
                          onChange={(e) => setIngredient(index, { role: e.target.value || null })}
                        >
                          <option value="">no role</option>
                          <option value="base">base</option>
                          <option value="modifier">modifier</option>
                          <option value="filler">filler</option>
                        </select>
                      </div>
                      <button type="button" className="ghost" onClick={() => removeIngredient(index)}>
                        remove
                      </button>
                      {/* §7b's own point, made visible one step after the picker: which brand this
                          recipe used, next to the generic it was filed under. */}
                      {canonical && line.rawName && line.rawName !== canonical && (
                        <span className="line-can">stored as {canonical}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="field">
              <label className="flabel" htmlFor="f-pick">
                Add an ingredient
              </label>
              <IngredientPicker
                refs={refs}
                recents={recents}
                onPick={(c) =>
                  setDraft((d) => ({
                    ...d,
                    ingredients: [
                      ...d.ingredients,
                      {
                        ingredientId: c.ingredient.id,
                        rawName: c.via ?? c.ingredient.canonical_name,
                        amount: "",
                        role: null,
                      },
                    ],
                  }))
                }
              />
              <p className="hint plate" id="h-pick">
                Recents first, then most used. Searching also matches brands — <b>fernet branca</b> finds{" "}
                <b>fernet liqueur</b>.
              </p>
            </div>

            <div className="field sec">
              <label className="flabel" htmlFor="f-glass">
                Glass
              </label>
              <div className="sel">
                <select
                  id="f-glass"
                  className="ctl"
                  value={draft.glassId ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, glassId: e.target.value || null }))}
                >
                  <option value="">no glass picked</option>
                  {refs.glassware.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="flabel" htmlFor="f-technique">
                Technique
              </label>
              <div className="sel">
                <select
                  id="f-technique"
                  className="ctl"
                  aria-describedby="h-technique"
                  value={draft.techniqueIds[0] ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, techniqueIds: e.target.value ? [e.target.value] : [] }))
                  }
                >
                  <option value="">no technique</option>
                  {refs.techniques.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id}
                    </option>
                  ))}
                </select>
              </div>
              <p className="hint plate" id="h-technique">
                The headline technique is the spec's first step. <b>No ice field:</b> the catalogue has one
                and this screen deliberately offers none.
              </p>
            </div>

            <span className="sechead" id="l-garnish">
              Garnish
            </span>
            <div role="group" aria-labelledby="l-garnish">
              {draft.garnishes.map((garnish, index) => {
                const isOpen = openGn.includes(index);
                const set = AXES.map((axis) => {
                  const chosen = garnish.axes.find((a) => a.axis === axis);
                  if (!chosen) return null;
                  return refs.axes.find((a) => a.id === chosen.valueId)?.name ?? chosen.valueId;
                }).filter((v): v is string => Boolean(v));
                const print = set.length === 0 ? "no axes" : set.join(" · ");
                // THE NAME, NOT THE ID. `garnish.elementId` is a row key (`orange-twist`); every other
                // readout in this file resolves an id to a name with the same `?? id` fallback, and
                // printing the raw key here was the "unclean list" half of the same defect as the
                // 400-row select -- the two were one problem wearing two faces.
                const elName = refs.elements.find((el) => el.id === garnish.elementId)?.name ?? garnish.elementId;
                return (
                  <div className={isOpen ? "line is-open" : "line"} key={index}>
                    <div className="pr-row gn-row">
                      <button
                        type="button"
                        className="pr-name"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setOpenGn((open) => (open.includes(index) ? open.filter((i) => i !== index) : [...open, index]))
                        }
                      >
                        <span className="pr-lbl">{elName}</span>
                        <span className="pr-caret" aria-hidden="true" />
                      </button>
                      {/* A READOUT, NOT A CONTROL: the row's one resting focus stop is the name
                          toggle, because a garnish's most-changed field is its nine axes and those
                          cannot live on a 44px line. `title` carries the untruncated string. */}
                      <span className="pr-note" title={print}>
                        {print}
                      </span>
                    </div>

                    <div className="gn-more" hidden={!isOpen}>
                      <div className="axes">
                        {AXES.map((axis) => {
                          const chosen = garnish.axes.find((a) => a.axis === axis);
                          return (
                            <div key={axis}>
                              <span className="lbl">{axis}</span>
                              <div className="sel">
                                <select
                                  className="ctl"
                                  aria-label={`${axis} for ${elName}`}
                                  value={chosen?.valueId ?? ""}
                                  onChange={(e) => {
                                    const rest = garnish.axes.filter((a) => a.axis !== axis);
                                    setGarnish(index, {
                                      axes: e.target.value ? [...rest, { axis, valueId: e.target.value }] : rest,
                                    });
                                  }}
                                >
                                  <option value="">{axis}</option>
                                  {refs.axes
                                    .filter((a) => a.axis === axis)
                                    .map((a) => (
                                      <option key={a.id} value={a.id}>
                                        {a.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="gn-foot">
                        <button type="button" className="ghost" onClick={() => removeGarnish(index)}>
                          remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="field">
              <label className="flabel" htmlFor="f-element">
                Add a garnish element
              </label>
              {/* THE PICKER, NOT A SELECT, and the difference is a cap rather than a preference: the
                  select this replaces rendered `refs.elements.slice(0, 400)` and the table holds 1,117
                  rows, so 717 garnish elements could not be reached at all. A 400-option native list is
                  both unusable on a phone and incomplete, and it was the last one left in this room. */}
              <ElementPicker
                elements={refs.elements}
                onPick={(el) =>
                  setDraft((d) => ({
                    ...d,
                    garnishes: [
                      ...d.garnishes,
                      { elementId: el.id, group: d.garnishes.length, position: 0, axes: [] },
                    ],
                  }))
                }
              />
              <p className="hint plate" id="h-garnish">
                A produce plus optional axes. A garnish with no axes is valid — <b>orange</b>, <b>lemon</b> and{" "}
                <b>lime</b> are 36% of the corpus and carry none.
              </p>
            </div>

            <div className="field sec">
              <label className="flabel" htmlFor="f-notes">
                Notes
              </label>
              <textarea
                id="f-notes"
                className="ctl"
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </form>

          {/* ── the card's foot, docked. The app's own measured fix, now inside the object. ── */}
          <div className="card-foot">
            {/* THREE AT A TIME, and the count stands in for the rest — the study's own rule and
                its own reason (roast-edit.html:2420-2431): "a list of nine sentences above a
                button is a wall. The count is text, not colour." The study wired `.probs .more`
                for the overflow and the wiring pass dropped both halves; ITEM F10 restores the
                cap and the line, with the study's copy verbatim. The button's disable still
                counts ALL problems — the cap is presentation only. */}
            <ul className="probs" id="roast-edit-probs">
              {problems.slice(0, 3).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {problems.length > 3 && (
                <li className="more">and {problems.length - 3} more — lib/editor.ts returns every one of them.</li>
              )}
            </ul>
            {/* Both lines are always mounted and hidden by the attribute, so `.note-line[hidden]` is
                the one rule that decides whether they render. */}
            <p className="note-line" hidden={!saved}>
              <span className="stamp">{dry ? "dry run" : "saved"}</span>
              <span>{saved}</span>
            </p>
            <p className="note-line is-fail" hidden={!saveError}>
              <span className="stamp">not saved</span>
              <span>{saveError}</span>
            </p>
            <button
              type="button"
              onClick={save}
              disabled={saving || problems.length > 0}
              aria-describedby="roast-edit-probs"
              className={saving ? "primary is-loading" : "primary"}
            >
              <span>{saving ? "Saving…" : dry ? "Dry run" : "Save to my library"}</span>
              <span className="hatch" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>,
  );
};

export default SpecEditor;
