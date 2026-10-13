import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ExitLink from "@/components/ExitLink";
import { getSessionId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import {
  library,
  stateOf,
  submitProblems,
  submissionSummary,
  toggleLabel,
  selectionLabel,
  type LibrarySpec,
} from "@/lib/roster";
import {
  previewHrefs,
  type GlassAssetRow,
  type SpecGarnishRow,
  type SpecGarnishAxisRow,
} from "@/lib/compositor";
import "@/roast.css";
import "@/roast-roster.css";

/**
 * The roster — the author's library, and the one act that turns part of it into a Submission.
 *
 * THE TWO NOUNS ON THIS SCREEN, kept apart on purpose because confusing them cost this project real
 * time: the LIBRARY is every spec the author has written (`specs where session_id = me and retired_at
 * is null`), and a SUBMISSION is a SELECTION of at least three of them, entered deliberately. The
 * author's words: "those are NOT submissions, those are simply their specs. their library."
 *
 * WHY THE TOGGLE IS NOT PER DRINK. Section 11 described this screen as "the library, the *submitted to
 * the roast* toggle, the Update button", and the first reading of that put a submit switch on each
 * card. That is wrong: a Submission is a selection of THREE OR MORE, so the switch belongs to the
 * submission, not to a drink. A per-card switch could only ever submit one, which the database refuses.
 *
 * WHAT THE DATABASE DOES, so this screen only has to ask:
 *   * `save_submission` creates or replaces the selection, and refuses fewer than three or a spec that
 *     is not the caller's own.
 *   * `set_submission_listed` re-checks the minimum before listing.
 *   * `publish_spec` / `retire_spec` move a spec between live, draft and retired.
 *   * `save_spec_draft` makes the FIRST version of a cocktail live and every later one a draft:
 *     "the first version is live; later ones are drafts".
 *
 * `?dry=1` SKIPS EVERY WRITE, the same flag the deck, the menu and the editor honour.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 * THE WIRING PASS — 2026-10-12. What moved and what did not.
 *
 * MOVED: the classes. Every Tailwind utility and <MenuCard> is gone; the surface is now
 * roast-roster.css, scoped `.roast.roast-roster`, which is the vocabulary the approved study
 * (roast-roster.html) drew. The ROOT is `.roast.roast-roster` rather than the old
 * `roast flex items-center justify-center px-4 py-10`, because a room in this family owns its ground,
 * its column and its exit; the centring wrappers were doing the column's job badly.
 *
 * DID NOT MOVE: `dry`, `reload`, `rpc`, `submit`, `toggle`, the four RPCs and their arguments, the
 * `failed` / `specs === null` branches and their two sentences, `library()` / `stateOf()` /
 * `submitProblems()` / `submissionSummary()` / `toggleLabel()`, the three row actions, the toggle, and
 * the label on the submit button, which is now `selectionLabel()`. Not one line of behaviour changed.
 *
 * THE TWO BUTTONS WERE SAYING THE SAME WORD — 2026-10-12. The toggle ("Submit to the arena") and the
 * primary ("Submit N to the roast") wore both the same weight AND nearly the same word, two lines
 * apart, in one flow. The weight was fixed by the study; the word is fixed here. The primary calls
 * `save_submission`, which writes the selection and lists NOTHING -- the old success sentence said
 * "toggle them in when you are ready", which was the copy admitting it. So the primary now says
 * "Save this selection" / "Update my selection", the toggle keeps the only "submit" in the room, and
 * `selectionLabel()` in roster.ts owns the wording so the app and the study cannot drift apart again.
 *
 * THREE THINGS MADE STRUCTURAL RATHER THAN PRESENTATIONAL, each because the study's mechanism needs a
 * real element:
 *   1. THE GROUND IS THE ROOT'S OWN BACKGROUND, not three sibling divs at z-index -2. `.roast` is
 *      `position:relative` with `background:#050409` and no z-index, so it creates no stacking context
 *      and a negative-z-index child paints UNDER that background — the study's three divs would have
 *      rendered nothing in this app. Same three layers, same gradient, same alphas: one background and
 *      two pseudo-elements, in roast-roster.css.
 *   2. THE FRAME'S FILM IS A REAL DIV inside the plate, because the film belongs to the frame ELEMENT
 *      — that is what stops the scanlines at the plate's edge while the ground keeps its halftone.
 *   3. THE SUBMIT BUTTON IS `aria-describedby` THE PROBLEM LIST, so the reason it is disabled is
 *      announced once instead of being restated in the label. The list keeps its own id for it.
 *
 * TWO DELIBERATE DEVIATIONS FROM THE STUDY, both flagged rather than hidden:
 *   * `<ExitLink where="menu" />`. The page previously rendered the default, which is the HUB — an exit
 *     labelled "back to the hub" sitting inside the ROAST, pointing out of the room entirely. ExitLink's
 *     own EXITS map already carries the right pair (`menu` -> `/roast`, "back to the menu"); this uses
 *     it. One prop, and it is the study's one exit, at the top where ExitLink puts it.
 *   * THE BOTTOM "back to the room" LINK STAYS. The study drops it, but it is the only exit that
 *     carries `?dry=1` forward — `<ExitLink>` takes no flag — so removing it would break dry-run
 *     navigation. It is demoted to the row-actions' quiet register (`.act`) rather than wearing the
 *     plate the top chip wears.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * A FOURTH ROW ACTION — 2026-10-13 — "OPEN IN THE MINI COMPOSITOR". The author: "theres no 'select
 * which cocktail you want to edit' direction, should we add a quick create new drink on the mini
 * compositor?" THE DOOR IS ON THE ROW, not on the preview page, and that is forced rather than chosen:
 * `roast-drink-card.html` is a static file that "receives IDS and parses nothing" and cannot read a
 * library, while this screen is the one place every spec of the author's is already listed.
 *
 * THE JOIN IS NOT HERE. `lib/compositor.ts` owns the preset key, the garnish vocabulary, the
 * composition rule and the query string, shared with the editor's own chip — so the two doors cannot
 * drift apart, which is the failure this project has already paid for twice (`roastNotes.ts`'s
 * vocabulary, `selectionLabel()`'s wording). This file only renders what that module resolved.
 *
 * A ROW WHOSE GLASS HAS NO DRAWING GETS NO LINK, and the refusal is the point rather than an oversight:
 * the preview falls back per field instead of erroring, so a half-filled link opens a DIFFERENT drink
 * and paints it confidently. `glass_asset_map` records a null `asset_id` as "a RECORDED fact, not an
 * omission", and about one glass name in ten is in that state.
 */

type Submission = { id: string; name: string; listed: boolean; is_tutorial: boolean };

const RoastRoster = () => {
  const dry = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("dry") === "1";
  const sessionId = getSessionId();

  const [specs, setSpecs] = useState<LibrarySpec[] | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  /* One link per spec, already resolved by `lib/compositor.ts`. A spec that is not a key here has no
     link, and that is a fact rather than a loading state — see the block in `reload` below. */
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  /* Guards the one-time seed below. `reload()` re-runs after every RPC, so seeding unconditionally
     would clobber the ticks of a save in flight. A ref, not state: the seed is not something a
     render needs to see. */
  const seeded = useRef(false);

  const reload = async () => {
    if (!supabase) {
      setFailed(true);
      return;
    }
    const { data, error } = await supabase
      .from("specs")
      /* `glass_id` is here for the row's preview link, not for anything the library does: the
         preview's four layers are all keyed off the recipe's glass, so the row cannot offer a door
         without it. `lib/compositor.ts` owns the join from this name to a drawing. */
      .select("id,name,cocktail_slug,glass_id,is_live,retired_at,created_at")
      .eq("session_id", sessionId)
      .is("retired_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      setFailed(true);
      return;
    }
    const rows = (data ?? []) as LibrarySpec[];
    setSpecs(rows);

    /*
     * THE MINI COMPOSITOR'S ROW LINKS — the author's ask: "theres no 'select which cocktail you want
     * to edit' direction." The library is where every spec IS listed, so the door belongs on the row
     * rather than on the preview page, which receives ids and parses nothing and cannot read a
     * library.
     *
     * THREE QUERIES, ALL SMALL AND ALL SCOPED TO THIS SESSION'S OWN SPECS: `glass_asset_map` is the
     * 46-name -> 15-drawing table, `spec_garnishes` is the recipe's garnish list, and
     * `spec_garnish_axes` carries the axis values that COMPOSE the drawing's name (`orange` +
     * `twist`). All three are readable by `anon` (`add-garnish-layer.sql` gave the garnish tables the
     * same policies, and `add-rung2-glass-asset-map.sql` gave the glass map one).
     *
     * A FAILURE HERE IS NOT A FAILURE OF THE SCREEN. Each `data` is defaulted to empty, so a refused
     * read costs the row links and nothing else — the library, the submission and the toggle are
     * unaffected, and an absent action is not an error state to report.
     */
    const { data: glassMap } = await supabase.from("glass_asset_map").select("glass_id,asset_id");

    let garnishes: SpecGarnishRow[] = [];
    let axes: SpecGarnishAxisRow[] = [];
    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      const { data: garnishRows } = await supabase
        .from("spec_garnishes")
        .select("spec_id,garnish_group,position,element_id")
        .in("spec_id", ids);
      const { data: axisRows } = await supabase
        .from("spec_garnish_axes")
        .select("spec_id,garnish_group,position,axis,value_id")
        .in("spec_id", ids);
      garnishes = (garnishRows ?? []) as SpecGarnishRow[];
      axes = (axisRows ?? []) as SpecGarnishAxisRow[];
    }

    setPreviews(previewHrefs(rows, (glassMap ?? []) as GlassAssetRow[], garnishes, axes));

    const { data: lists } = await supabase
      .from("roast_lists")
      .select("id,name,listed,is_tutorial")
      .eq("session_id", sessionId);
    setSubmissions((lists ?? []) as Submission[]);

    if (lists && lists.length > 0) {
      const { data: rows } = await supabase
        .from("submission_specs")
        .select("list_id,spec_id")
        .in("list_id", lists.map((l) => l.id));
      const pairs = (rows ?? []) as { list_id: string; spec_id: string }[];
      const tally: Record<string, number> = {};
      for (const row of pairs) {
        tally[row.list_id] = (tally[row.list_id] ?? 0) + 1;
      }
      setCounts(tally);

      /*
       * SEED THE SELECTION FROM WHAT IS ALREADY ENTERED — ONCE.
       *
       * `picked` starts as `[]`, so a returning author whose submission already holds three drinks
       * arrived at a screen reading "3 drinks ready, not in the arena yet" beside an EMPTY selection
       * and a disabled button saying "Pick at least three". They had to re-pick the three they had
       * already entered, and the only way past it was to press the control the screen was refusing.
       *
       * Keyed off the SUBMISSION ROW's presence, not its size, because that is the same fact the
       * primary's label is derived from (`mine !== undefined`) — one definition of "already entered",
       * read in two places, so the button and the selection can never disagree about it.
       *
       * The `seeded` guard is what makes this a seed rather than a reset: `reload()` runs again after
       * every save, toggle, retire and publish, and re-seeding on those would throw away ticks the
       * author had just made.
       */
      if (!seeded.current) {
        seeded.current = true;
        const mine = (lists as Submission[]).find((l) => !l.is_tutorial);
        if (mine) {
          const entered = pairs.filter((r) => r.list_id === mine.id).map((r) => r.spec_id);
          if (entered.length > 0) setPicked(entered);
        }
      }
    }
  };

  useEffect(() => {
    reload().catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rpc = async (fn: string, args: Record<string, unknown>): Promise<string | null> => {
    if (dry) return "dry run — nothing was written";
    if (!supabase) return "No database connection.";
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) return error.message;
    await reload();
    return null;
  };

  const submit = async () => {
    const problems = submitProblems(picked, specs ?? []);
    if (problems.length > 0) {
      setNote(problems[0]);
      return;
    }
    const list = submissions.find((l) => !l.is_tutorial);
    const error = await rpc("save_submission", {
      payload: {
        session_id: sessionId,
        ...(list ? { list_id: list.id } : {}),
        name: list?.name ?? "My submission",
        author: "Anonymous",
        spec_ids: picked,
      },
    });
    setNote(error ?? `saved ${picked.length} drinks — toggle them in when you are ready`);
  };

  const toggle = async (list: Submission) => {
    const error = await rpc("set_submission_listed", {
      p_session_id: sessionId,
      p_list_id: list.id,
      p_listed: !list.listed,
    });
    setNote(error ?? (list.listed ? "withdrawn from the arena" : "in the arena"));
  };

  /** The two non-list states still short-circuit the tree, but now they render on the room's plate
   *  rather than inside `<MenuCard>`: `--dim` on the ground's pink band is 1.69:1, and 1.00:1 where the
   *  gradient passes through `--dim`'s own value, so the sentence has to travel with its own ground. */
  if (failed || specs === null) {
    return (
      <div className="roast roast-roster">
        <main className="page">
          <div className="exitrow">
            <ExitLink where="menu" />
          </div>
          <div className="alt">
            <p>
              {failed ? "Your library could not be loaded." : "Opening your library…"}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const lib = library(specs);
  const problems = submitProblems(picked, specs);
  const mine = submissions.find((l) => !l.is_tutorial);
  const count = mine ? counts[mine.id] ?? 0 : 0;
  const label = toggleLabel(count, mine?.listed ?? false);
  /* Whether a submission already EXISTS, which is what makes the primary an update rather than a
     first write. It is the presence of the row, not its size: a submission the database refused
     would not be here, and `mine` is already filtered of the tutorial list. */
  const action = selectionLabel(picked.length, mine !== undefined);

  return (
    <div className="roast roast-roster">
      <main className="page">
        <div className="exitrow">
          <ExitLink where="menu" />
        </div>

        <section className="frame" aria-labelledby="roster-title">
          {/* the room's one texture: the film stops at the plate's edge, so no pixel of the
              ground outside carries halftone AND scanlines. */}
          <div className="film" aria-hidden="true" />

          <div className="bar">
            <span className="kick">Roast · the roster</span>
            <h1 className="title" id="roster-title">
              <span className="tf-plate big">
                <span className="t triple">My drinks</span>
              </span>
            </h1>
          </div>

          {/* the visitor's own state first, in roster.ts's own sentence */}
          <p className="lede" aria-live="polite">
            {submissionSummary(count, mine?.listed ?? false)}
          </p>

          {lib.length === 0 ? (
            <p className="empty">
              Nothing here yet. A spec you write lands in this library — it enters nothing.
            </p>
          ) : (
            <ul className="lib">
              {lib.map((spec) => {
                const state = stateOf(spec);
                return (
                  <li key={spec.id} className="row">
                    <label className="pick">
                      <input
                        type="checkbox"
                        className="box"
                        checked={picked.includes(spec.id)}
                        onChange={(e) =>
                          setPicked((p) =>
                            e.target.checked ? [...p, spec.id] : p.filter((id) => id !== spec.id),
                          )
                        }
                      />
                      <span className="txt">
                        <span className="nm">{spec.name}</span>
                        <span className="mt">
                          {spec.cocktail_slug ?? "no cocktail"} ·{" "}
                          <span className={`st st--${state}`}>{state}</span>
                        </span>
                      </span>
                    </label>
                    {/* the four actions sit OUTSIDE the <label>, so a click on one is never
                        also a click on the checkbox. The preview opens a new tab, so the library is
                        still here when the author comes back from it. */}
                    <p className="acts">
                      <Link
                        to={`/roast/edit?cocktail=${encodeURIComponent(spec.cocktail_slug ?? "")}${dry ? "&dry=1" : ""}`}
                        className="act"
                      >
                        write a new version
                      </Link>
                      {state === "draft" && (
                        <button
                          type="button"
                          className="act"
                          disabled={busy}
                          onClick={async () =>
                            setNote(
                              (await rpc("publish_spec", { p_session_id: sessionId, p_spec_id: spec.id })) ??
                                "now live",
                            )
                          }
                        >
                          make it live
                        </button>
                      )}
                      {state !== "retired" && (
                        <button
                          type="button"
                          className="act"
                          disabled={busy}
                          onClick={async () =>
                            setNote(
                              (await rpc("retire_spec", { p_session_id: sessionId, p_spec_id: spec.id })) ??
                                "retired",
                            )
                          }
                        >
                          retire
                        </button>
                      )}
                      {/* NO LINK WHERE THE PREVIEW CANNOT DRAW THIS DRINK. It falls back per
                          field rather than erroring, so a half-filled link would paint a DIFFERENT
                          drink confidently — worse than no door. `previewHrefs` omits the key, and
                          roughly one glass in ten has no drawing to resolve. */}
                      {previews[spec.id] && (
                        <a
                          href={previews[spec.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="act"
                        >
                          open in the mini compositor
                        </a>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          <Link to={dry ? "/roast/edit?dry=1" : "/roast/edit"} className="door">
            write a drink
          </Link>

          {/* ── the submission: a selection of three or more, and ONE toggle ────────────────────── */}
          <div className="sec">
            <span className="kick">The submission</span>
            <span className="hair" aria-hidden="true" />
          </div>
          <p className="note">
            A submission is a selection of your drinks — at least three — entered deliberately. Writing
            them enters nothing.
          </p>

          <ul className="probs" id="roster-probs" aria-live="polite">
            {picked.length > 0 &&
              problems.map((p) => <li key={p}>{p}</li>)}
          </ul>

          {/* the toggle and the sticky submit used to wear the same weight and nearly the same
              word. This one is a keyline with no fill; the primary below is the only filled
              control in the room. */}
          <button
            type="button"
            className="toggle"
            hidden={label === null}
            aria-pressed={mine?.listed ?? false}
            disabled={busy}
            onClick={() => mine && toggle(mine)}
          >
            {label}
          </button>

          {/* ── the action bar: the plate's own docked foot, INSIDE the frame ─────────────────
              It began as a sibling of the frame so its sticky ancestor would be untransformed.
              The containing block is the frame now, and the sticky offset is still measured
              against the document scrollport, which is what the app's own note requires — "the
              browser pass measured it at y=1080 on an 844-tall screen — BELOW THE FOLD". Same
              object as the editor's save bar, on the same -.6deg card. The status line sits ABOVE
              the button, so the card ends on its one act. */}
          <div className="actionbar">
            <p className="status" aria-live="polite">
              {note}
            </p>
            <button
              id="roster-submit"
              type="button"
              className="primary"
              aria-describedby="roster-probs"
              disabled={busy || problems.length > 0}
              onClick={submit}
            >
              {/* `dry` keeps the original precedence: nothing picked is the disabled case and wins,
                  because "Dry run — Pick at least three" is not a sentence. The verb still comes from
                  `selectionLabel()` -- lowercased only because it now sits mid-sentence, which keeps
                  one source of truth for the wording. */}
              {busy
                ? "Working…"
                : dry && picked.length > 0
                  ? `Dry run — ${action.charAt(0).toLowerCase()}${action.slice(1)}`
                  : action}
            </button>
          </div>
        </section>

        {/* kept because it is the only exit that carries `?dry=1`; demoted to the quiet register */}
        <p className="note foot">
          <Link to={dry ? "/roast?dry=1" : "/roast"} className="act">
            back to the room
          </Link>
        </p>
      </main>
    </div>
  );
};

export default RoastRoster;
