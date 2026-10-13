/**
 * The roster — the author's library, and the rules for turning part of it into a Submission.
 *
 * WHY THIS IS ITS OWN MODULE: the roster is where the author's SPECS meet the SUBMISSION rules, and
 * those rules are arithmetic and selection, not layout. Which specs are in the library, which state
 * each one is in, and whether a selection is legal are all answerable without a screen.
 *
 * THE DEFINITION, which three documents used without defining until 2026-10-06:
 *
 *   "the user creates a spec, right? then he creates more. those are NOT submissions, those are simply
 *    their specs. their library. a submission is a selection of those drinks, minimum of 3, that the
 *    author want to submit to the arena."
 *
 * So there are two different things on this screen and they must not be confused:
 *
 *   THE LIBRARY is `specs where session_id = me and retired_at is null`. Section 7b is explicit that
 *   it is NOT a Collection: "One fact, one place -- under the alternative, `specs.session_id` and
 *   `collection_specs` would both answer 'whose is this' and nothing would prevent them diverging."
 *
 *   A SUBMISSION is a SELECTION of at least three of them, entered deliberately. Writing drinks
 *   enters you in nothing.
 *
 * THE THREE STATES A SPEC CAN BE IN, and the database is what decides them:
 *   * `live`    -- `is_live`. `save_spec_draft` makes the FIRST version of a cocktail live and every
 *                  later one a draft: `not v_has_live, -- the first version is live; later ones are drafts`
 *   * `draft`   -- saved, not live. Waiting for `publish_spec`.
 *   * `retired` -- `retired_at` set by `retire_spec`. Out of the library, kept in the table.
 *
 * THE MINIMUM IS MIRRORED, NOT INVENTED. `save_submission` refuses fewer than three, and it is the
 * AUTHORITY -- this module's copy exists so the author is told before a round trip, not so the rule
 * lives in two places. If they ever disagree, the database wins and this is the bug.
 *
 * NO IMPORTS, AND RUNNABLE DIRECTLY UNDER NODE (`node src/lib/roster.ts`), the same rule as `rounds.ts`,
 * `units.ts`, `picker.ts` and `editor.ts`.
 */

/** One row of `specs`, as the roster reads it. */
export type LibrarySpec = {
  id: string;
  name: string;
  cocktail_slug: string | null;
  /**
   * The recipe glass — a name out of the 46 the `glassware` table holds, NOT a drawing.
   *
   * IT IS HERE FOR THE MINI COMPOSITOR. Each row carries a link into
   * `roast-drink-card.html`, and the preview's four layers are all keyed off `state.glass`, so the
   * row cannot offer one without this column. `lib/compositor.ts` owns the two joins that turn it
   * into a drawing; this module only reads it.
   */
  glass_id: string | null;
  is_live: boolean;
  retired_at: string | null;
  created_at: string;
};

/** The three states, derived rather than stored -- `retired_at` and `is_live` are the facts. */
export type SpecState = "live" | "draft" | "retired";

/**
 * The library: everything not retired, newest first.
 *
 * `retired_at is null` is the whole filter, and it is why a retired spec does not need deleting --
 * section 7b's rule that `anon` has no DELETE anywhere means retiring is a flag, not a removal.
 */
export function library(specs: LibrarySpec[]): LibrarySpec[] {
  return specs
    .filter((s) => s.retired_at === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.name.localeCompare(b.name));
}

/**
 * Which state a spec is in. RETIRED WINS OVER LIVE, because a retired spec that still carried
 * `is_live = true` would be a contradiction -- and `retire_spec` clears both, so the order here is a
 * guard rather than a case that should arise.
 */
export function stateOf(spec: LibrarySpec): SpecState {
  if (spec.retired_at !== null) return "retired";
  return spec.is_live ? "live" : "draft";
}

/**
 * The problems with a selection, as human sentences. EMPTY MEANS VALID.
 *
 * THE TWO RULES, both enforced by `save_submission` in the database:
 *   1. AT LEAST THREE. The author's minimum.
 *   2. EVERY SPEC MUST BE THE CALLER'S OWN, AND IN THEIR LIBRARY. A retired spec is not selectable,
 *      and an id that is not in the library at all -- a stale one from a previous render -- is
 *      refused rather than ignored, because silently dropping it would submit a different selection
 *      from the one the author made.
 */
export function submitProblems(selectedIds: string[], specs: LibrarySpec[]): string[] {
  const problems: string[] = [];
  const byId = new Map(specs.map((s) => [s.id, s]));

  if (selectedIds.length < 3) {
    problems.push(
      selectedIds.length === 0
        ? "Pick at least three drinks to submit."
        : `A submission needs at least three drinks, and ${selectedIds.length} ${selectedIds.length === 1 ? "is" : "are"} picked.`,
    );
  }

  const missing = selectedIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    problems.push(`${missing.length} of the picked drinks are not in your library.`);
  }

  const retired = selectedIds.filter((id) => {
    const spec = byId.get(id);
    return spec !== undefined && spec.retired_at !== null;
  });
  if (retired.length > 0) {
    problems.push(`${retired.length} of the picked drinks ${retired.length === 1 ? "is" : "are"} retired.`);
  }

  const duplicated = selectedIds.length !== new Set(selectedIds).size;
  if (duplicated) problems.push("The same drink is picked twice.");

  return problems;
}

/**
 * A sentence about the current submission, for the toggle's label.
 *
 * `listed` is the fact; the sentence is what the author reads. A submission below the minimum cannot
 * be listed -- `set_submission_listed` refuses it -- so the wording says so rather than offering a
 * switch that would fail.
 */
export function submissionSummary(count: number, listed: boolean): string {
  if (count < 3) {
    return count === 0
      ? "No drinks entered yet."
      : `${count} entered — a submission needs three before it can go in.`;
  }
  return listed
    ? `${count} drinks in the arena.`
    : `${count} drinks ready, not in the arena yet.`;
}

/**
 * What the toggle should say. Null when there is nothing to toggle.
 *
 * THIS IS THE ONLY CONTROL THAT SUBMITS. The primary below it SAVES the selection, and until
 * 2026-10-12 it was labelled "Submit N to the roast" -- so two buttons doing different things wore
 * nearly the same word, and `save_submission` does not list anything. The proof was in this module's
 * own success sentence, which had to say "toggle them in when you are ready": the copy was admitting
 * the button it belonged to had not submitted. ONE VERB PER ACT -- the toggle submits and withdraws,
 * `selectionLabel` saves and updates. Do not put "submit" back on the primary.
 */
export function toggleLabel(count: number, listed: boolean): string | null {
  if (count < 3) return null;
  return listed ? "Withdraw from the arena" : "Submit to the arena";
}

/**
 * What the primary should say -- the act that writes a SELECTION.
 *
 * `hasSubmission` is whether a submission already exists for this session, which is what separates
 * the first write from the second. A count of zero is the disabled case and the only label that
 * carries the reason rather than the act, because the button cannot be pressed: `submitProblems`
 * owns the full sentences and the button points at them with `aria-describedby`.
 *
 * THE COUNT IS DELIBERATELY NOT IN THE LABEL. It was ("Submit 3 to the roast") and the status line
 * above the button already prints it in full ("3 of 9 picked"), so the number was said twice while
 * the act was said wrongly twice.
 */
export function selectionLabel(count: number, hasSubmission: boolean): string {
  if (count === 0) return "Pick at least three";
  return hasSubmission ? "Update my selection" : "Save this selection";
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
    if (!ok) throw new Error(`roster self-check failed: ${what}`);
  };
  const block = (text: string): void => {
    console.log();
    console.log(text);
  };

  const s = (
    id: string,
    name: string,
    is_live: boolean,
    retired_at: string | null = null,
    created_at = "2026-10-06T00:00:00Z",
    cocktail_slug: string | null = "old-fashioned",
  ): LibrarySpec => ({ id, name, cocktail_slug, glass_id: null, is_live, retired_at, created_at });

  // ── 1. the library excludes retired, and is newest first ───────────────────────────────────────
  const all = [
    s("a", "Old Fashioned v1", true, null, "2026-10-01T00:00:00Z"),
    s("b", "Old Fashioned v2", false, null, "2026-10-05T00:00:00Z"),
    s("c", "Gone", true, "2026-10-04T00:00:00Z"),
    s("d", "Daiquiri", true, null, "2026-10-03T00:00:00Z"),
  ];
  const lib = library(all);
  check(lib.length === 3, `the library holds 3 of 4, got ${lib.length}`);
  check(lib.map((x) => x.id).join() === "b,d,a", `newest first, got ${lib.map((x) => x.id).join()}`);
  check(!lib.some((x) => x.id === "c"), "the retired one is out");
  block("the library is everything not retired, newest first -- retiring is a flag, not a delete");

  // ── 2. the three states ────────────────────────────────────────────────────────────────────────
  check(stateOf(s("x", "live", true)) === "live", "is_live is live");
  check(stateOf(s("x", "draft", false)) === "draft", "saved but not live is a draft");
  check(stateOf(s("x", "gone", true, "2026-10-04T00:00:00Z")) === "retired", "retired_at wins over is_live");
  check(stateOf(s("x", "gone", false, "2026-10-04T00:00:00Z")) === "retired", "and over not-live too");
  block("three states from two facts, and retired wins: a retired spec is never called live");

  // ── 3. THE MINIMUM IS THREE ────────────────────────────────────────────────────────────────────
  const three = ["a", "b", "d"];
  check(submitProblems(three, all).length === 0, `three of your own is valid, got ${submitProblems(three, all).join(" | ")}`);
  check(submitProblems(["a", "b"], all).some((p) => p.includes("at least three")), "two is refused");
  check(submitProblems(["a"], all).some((p) => p.includes("at least three")), "one is refused");
  check(submitProblems([], all)[0] === "Pick at least three drinks to submit.", "none is refused in plain words");
  check(submitProblems(["a", "b"], all)[0].includes("2 are picked"), "and the sentence counts them");
  check(submitProblems(["a"], all)[0].includes("1 is picked"), "with a singular verb for one");
  block("the minimum of three, mirrored from save_submission, refused with a sentence that counts");

  // ── 4. not yours, and not in the library ───────────────────────────────────────────────────────
  check(
    submitProblems(["a", "b", "nope"], all).some((p) => p.includes("not in your library")),
    "an id that is not in the library is refused rather than silently dropped",
  );
  check(
    submitProblems(["a", "b", "c"], all).some((p) => p.includes("retired")),
    "a retired spec cannot be submitted",
  );
  check(
    submitProblems(["a", "b", "nope", "also-nope"], all)[0].includes("2 of the picked"),
    "the count of unknown ids is reported",
  );
  check(submitProblems(["a", "a", "b"], all).some((p) => p.includes("twice")), "the same drink twice is caught");
  block("unknown ids are refused, not dropped -- dropping them would submit a DIFFERENT selection");

  // ── 5. the sentences, and the toggle ───────────────────────────────────────────────────────────
  check(submissionSummary(0, false) === "No drinks entered yet.", "nothing entered");
  check(submissionSummary(2, false).includes("needs three"), "two cannot go in");
  check(submissionSummary(5, true) === "5 drinks in the arena.", "five listed");
  check(submissionSummary(5, false) === "5 drinks ready, not in the arena yet.", "five ready but not listed");
  check(toggleLabel(2, false) === null, "no toggle below the minimum -- set_submission_listed would refuse it");
  check(toggleLabel(3, false) === "Submit to the arena", "the toggle offers to submit");
  check(toggleLabel(3, true) === "Withdraw from the arena", "and to withdraw");
  block("the sentences, and no toggle below the minimum: a switch that would fail is worse than no switch");

  // ── 5b. one verb per act ───────────────────────────────────────────────────────────────────────
  check(selectionLabel(0, false) === "Pick at least three", "nothing picked is the disabled case");
  check(selectionLabel(3, false) === "Save this selection", "the first write SAVES the selection");
  check(selectionLabel(3, true) === "Update my selection", "a later one updates it");
  check(!selectionLabel(3, true).includes("ubmit"), "and no control but the toggle says 'submit'");
  block("save_submission writes the selection, set_submission_listed submits it -- one verb each");

  // ── 6. the order is stable and the input is not mutated ────────────────────────────────────────
  const frozen = JSON.stringify(all);
  library(all);
  check(JSON.stringify(all) === frozen, "library does not mutate its input");
  check(library(all).map((x) => x.id).join() === library(all).map((x) => x.id).join(), "and is deterministic");
  block("sorting a copy, never the caller's array");

  block(`all ${checks} roster checks passed`);
}
