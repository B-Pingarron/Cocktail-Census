import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RoastSpecCard, { type RoastPalette } from "@/components/RoastSpecCard";
import RoundEnd from "@/components/RoundEnd";
import ExitLink from "@/components/ExitLink";
import { ROAST_LIST_AUTHOR, ROAST_LIST_ID, roastSpecs } from "@/data/roastSpecs";
import { getSessionId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { isRoundEnd, recapRound, roundCount, roundOf, type RoundRecap } from "@/lib/rounds";
import {
  deal,
  pickContender,
  toRoastSpecs,
  type Contender,
  type GarnishRow,
  type IngredientRow,
  type SpecRow,
} from "@/lib/deal";
import type { RoastSide, RoastSpec } from "@/types/roast";
/*
 * BOTH STYLESHEETS, AND THE ORDER IS THE CONTRACT. `roast.css` owns the family tokens this room
 * reads — `--a`/`--b`/`--c`/`--d`, `--plate`, `--dim`, `--txt`, `--edge`, `--ink`, `--rim`,
 * `--ease` and the display stack. `roast-arena.css` scopes everything else under
 * `.roast.roast-arena`, which is (0,3,0) against `roast.css`'s (0,2,0), so the room wins on
 * specificity rather than on source order — but it is loaded second anyway so the two agree.
 */
import "@/roast.css";
import "@/roast-arena.css";

/**
 * The deck — the author's specs, one per card, each one voted on and then annotated.
 *
 * THE DECK IS A LOOP, NOT A COMMITMENT (2026-10-05).
 *   It used to be fifteen cards in a row, and you either finished all fifteen or you left with a
 *   half-collected set of votes. It is now rounds of five. The difference is not the number — it
 *   is that a round is a COMPLETE unit: a visitor who stops at a round boundary has a finished
 *   thing, and a visitor who stops mid-round has the same as before. Fifteen is exactly three
 *   rounds of five, which is why the library cap and the round size are the same decision seen
 *   twice.
 *
 *   The boundary is a state of THIS component and not a route, because the deck owns the `votes`
 *   array the recap is counted from — and that array is also the record of the session the card's
 *   header counter reads. A route would unmount the deck and lose it.
 *
 * THE VOTE IS ONE INSERT, ON ADVANCE, AND THAT IS STRUCTURAL:
 *   `roast_votes` has insert and select policies and no update policy, so a label cannot be
 *   patched in after the fact. A row therefore has to be complete when it is written, and the
 *   visitor's picks are not complete until they leave the card. So the row is built in memory as
 *   they choose and written once, when they advance — never on the vote press, and never twice.
 *
 * THREE WAYS OFF A CARD, TWO KINDS OF ROW:
 *   vote → reasons → next   one row, with whatever labels were picked (an empty array is legal)
 *   skip                    no row at all, for a spec the visitor has no opinion about
 *   leaving the deck        no row for the specs never reached
 *   Forcing a vote on a spec nobody has an opinion about would fabricate signal, and the whole
 *   premise of this product is honest consensus from the people behind the bar. Skip is what
 *   protects that, so it shares `advance` with `next` rather than being a second code path.
 *
 * `?dry=1` READS THROUGH `useSearchParams`, NOT `location.search`:
 *   There is no server here — the app is one static file behind a HashRouter, so the query lives
 *   on the hash location and `window.location.search` is empty. Dry mode runs the whole flow and
 *   skips the write, which is the only way to walk the deck in a browser without writing real
 *   votes to the production table.
 *
 * ── THE ROOM, WIRED 2026-10-12 ──────────────────────────────────────────────
 *
 * This component used to render Tailwind utilities over `.roast` — a centred 360px column with a
 * bare `<p>` for the brief and a `MenuCard` for the empty Pool. The approved study has a ROOM:
 * a dark-half ground with a masked halftone field, a sticky standing strip, a brief on its own
 * plate, the card on its stage, and the boundary in the same plate vocabulary as everything else.
 *
 * WHAT DID NOT MOVE: every behaviour. `dealFromPool`, the dry branch, the synchronous advance
 * mutex, the round arithmetic from `lib/rounds.ts`, the fire-and-forget write and its failure
 * sentence, and the Pool's three outcomes (no Pool → the static deck stands; an empty Pool → an
 * invitation; a Pool → its specs replace the fifteen).
 *
 * WHAT DID: `handleToggleNote` is now `handleSelectNotes`. The old handler toggled one chip and
 * evicted anything on the same axis, because two axes of chips could each hold one answer. The
 * card's three bipolar rails produce the pair directly — one level id plus one element id — so
 * the axis arithmetic has nothing left to do, and a toggle-shaped API would have been wrong:
 * re-selecting the id you already hold must be a no-op, not a removal.
 */

/**
 * Deal a round from the Pool — §29 of the grill decisions, in code.
 *
 *   "The Pool is every listed Submission. A Roaster is dealt a Contender they have not exhausted,
 *    then five drinks from that Submission. An empty Pool is not an error."
 *
 * RETURNS NULL WHEN THERE IS NO POOL AT ALL, and that is the whole fallback: the deck then keeps
 * the STATIC rung-1 deck it started with. That is deliberate rather than lazy — section 15 puts it
 * plainly: "the Arena is a loop here, with no editor", and rung 1's fifteen are what make the room
 * demonstrable before anybody has submitted anything. A Pool that exists but is exhausted is a
 * DIFFERENT answer, and comes back as an empty round so the screen can invite the visitor to the
 * Census instead.
 *
 * "EXHAUSTED" IS READ FROM `roast_votes`, not from localStorage. The votes carry `list_id`, so the
 * table answers it — and a flag beside the votes would be a second source of truth that can
 * disagree with them, which is the mistake RoastMenu already documents avoiding.
 */
async function dealFromPool(dealtThisRun: string[] = []): Promise<{ listId: string; author: string; specs: RoastSpec[] } | null> {
  if (!supabase) return null;
  const sessionId = getSessionId();

  const { data: lists } = await supabase
    .from("roast_lists")
    .select("id,name,author,is_tutorial")
    .eq("listed", true);
  if (!lists || lists.length === 0) return null;

  const ids = lists.map((l) => l.id);

  const { data: fighters } = await supabase
    .from("submission_specs")
    .select("list_id")
    .in("list_id", ids);
  const counts: Record<string, number> = {};
  for (const row of (fighters ?? []) as { list_id: string }[]) {
    counts[row.list_id] = (counts[row.list_id] ?? 0) + 1;
  }

  // COUNTS PER LIST, NOT A SET OF IDS. Exhaustion means every drink in a Submission has been voted
  // on (section 29), and a set of ids cannot tell five votes from fifteen -- the bug a visitor
  // walked into when finishing round one produced "Nobody left to roast" with ten drinks unroasted.
  const { data: mine } = await supabase
    .from("roast_votes")
    .select("list_id")
    .eq("session_id", sessionId);
  const votedCounts: Record<string, number> = {};
  for (const row of (mine ?? []) as { list_id: string | null }[]) {
    if (row.list_id) votedCounts[row.list_id] = (votedCounts[row.list_id] ?? 0) + 1;
  }

  const picked = pickContender(lists as Contender[], votedCounts, counts, Date.now(), dealtThisRun);
  if (!picked) return { listId: "", author: "", specs: [] };

  const { data: order } = await supabase
    .from("submission_specs")
    .select("spec_id,position")
    .eq("list_id", picked.id)
    .order("position");
  const specIds = (order ?? []).map((r) => r.spec_id as string);
  if (specIds.length === 0) return { listId: "", author: "", specs: [] };

  // `cocktail_slug` IS NOT OPTIONAL HERE, and its absence was the defect: this select used to omit it, so
  // every dealt spec carried a uuid as its `id` and the card drew the placeholder illustration for it.
  const { data: specRows } = await supabase
    .from("specs")
    .select("id,name,cocktail_slug,glass_id,technique_id,notes")
    .in("id", specIds);
  const { data: ingRows } = await supabase
    .from("spec_ingredients")
    .select("spec_id,position,amount,raw_name,ingredient_id")
    .in("spec_id", specIds);
  const { data: garRows } = await supabase
    .from("spec_garnishes")
    .select("spec_id,garnish_group,position,element_id")
    .in("spec_id", specIds);

  const glassIds = [...new Set((specRows ?? []).map((s) => s.glass_id).filter(Boolean))] as string[];
  const elementIds = [...new Set((garRows ?? []).map((g) => g.element_id))];
  const { data: glasses } = glassIds.length
    ? await supabase.from("glassware").select("id,name").in("id", glassIds)
    : { data: [] as { id: string; name: string }[] };
  const { data: elements } = elementIds.length
    ? await supabase.from("garnish_elements").select("id,name").in("id", elementIds)
    : { data: [] as { id: string; name: string }[] };

  const glassNames: Record<string, string> = {};
  for (const g of glasses ?? []) glassNames[g.id] = g.name;
  const elementNames: Record<string, string> = {};
  for (const e of elements ?? []) elementNames[e.id] = e.name;

  // The submission's order, then the round taken from it. `deal` is the checked rule, not a slice
  // written a second time here.
  const ordered = specIds
    .map((id) => (specRows ?? []).find((s) => s.id === id))
    .filter(Boolean) as SpecRow[];
  const assembled = toRoastSpecs(ordered, (ingRows ?? []) as IngredientRow[], (garRows ?? []) as GarnishRow[], glassNames, elementNames);

  // THE WHOLE SUBMISSION IS DEALT, NOT ONE ROUND OF IT -- and that is the fix for the dead end the
  // author walked into. Dealing five cards made the deck five long, so `roundCount(5)` was 1 and the
  // FIRST boundary called itself "Round 1 of 1": the last round, offering a summary instead of a
  // continue. The deck has to hold the whole Submission so `rounds.ts` can count three rounds from
  // fifteen, exactly as it does for the static deck.
  //
  // CAPPED AT THREE ROUNDS, per section 87(b): "Up to 3 rounds, then end." A Submission of fifty
  // drinks is a ten-round sitting nobody asked for.
  const wholeRound = deal(assembled.map((s) => s.id), 15);

  return {
    listId: picked.id,
    author: picked.author,
    specs: assembled.filter((s) => wholeRound.includes(s.id)),
  };
}

/**
 * HOW MANY CARDS OPEN A ROUND.
 *
 * `lib/rounds.ts` owns the arithmetic and this constant exists only so the flick's cadence and the
 * boundary's cadence are visibly the same number rather than two fives that agree by accident.
 */
const ROUND_SIZE = 5;

const RoastDeck = () => {
  const [searchParams] = useSearchParams();
  const dry = searchParams.get("dry") === "1";

  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<RoastSide | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  /**
   * THE SPECS ARE STATE, AND THEY START AS THE STATIC DECK.
   *
   * Rung 1's fifteen are the initial value, so the screen is never empty and nothing about the
   * verified static flow changes while the Pool is being read. The effect below replaces them ONLY
   * when a listed Submission exists to deal from — which, on the day this was written, none did.
   */
  const [specs, setSpecs] = useState<RoastSpec[]>(roastSpecs);
  /** The Submission the votes are attached to. Rung 1's constant list until the Pool deals another. */
  const [listId, setListId] = useState<string>(ROAST_LIST_ID);
  /**
   * WHOSE DRINKS THESE ARE. `roast_lists.author` is a snapshot taken at publish, so a later rename
   * does not rewrite a byline that is already out (section 7b). Rung 1's constant is the default,
   * which is what the static deck needs.
   */
  const [author, setAuthor] = useState<string>(ROAST_LIST_AUTHOR);
  /**
   * THE CONTENDERS ALREADY DEALT IN THIS SITTING. Section 87(b): "Then round 2 loads a DIFFERENT
   * user." Kept apart from exhaustion on purpose -- five of the author's fifteen leaves his
   * Submission far from exhausted, and round 2 still loads somebody else.
   */
  const [dealtThisRun, setDealtThisRun] = useState<string[]>([]);
  /** The Pool exists but there is nobody left to roast. §29: not an error, an invitation. */
  const [poolEmpty, setPoolEmpty] = useState(false);

  /**
   * THE PALETTE, ON THE ROOM ROOT.
   *
   * The family convention is the menu's: `data-pal` on the room root, and the absence of the
   * attribute means heat. Nothing writes it yet — the settings layer the menu's stylesheet defers to
   * does not exist — so this is a plain constant rather than state, and the three override rules in
   * `roast-arena.css` wait for the same writer the menu's three wait for. It becomes `useState` the
   * day that layer lands, and not a line before: a `useState` with no setter in reach is a hook that
   * says "someday" for no reason.
   */
  const palette: RoastPalette = "heat";

  /**
   * The round recap, or null while a card is showing. Non-null means the boundary is up and the
   * card is off screen — the two never render together, because the recap replaces the round's
   * last card rather than sitting over it.
   */
  const [recap, setRecap] = useState<RoundRecap | null>(null);

  /**
   * The vote cast on each spec, by position — null until the visitor answers, and null forever if
   * they skip.
   *
   * The record in the card's header reads this, which is what turns the bar from a plain progress
   * meter into the record of the session: green for what was agreed with, hatched red for what was
   * not, neutral for what was seen without an opinion. The DECK has to own it, not the card: the
   * card is remounted per spec (see its `key`), so it cannot remember the votes that came before
   * it. The round recap reads it too, which is the second reason it lives here.
   */
  const [votes, setVotes] = useState<(RoastSide | null)[]>(() =>
    Array.from({ length: roastSpecs.length }, () => null)
  );
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  /**
   * DEAL A ROUND FROM THE POOL, ONCE, ON MOUNT.
   *
   * Three outcomes, and only the middle one changes anything:
   *   * no Pool at all -> `null`, and the static deck above stands. Section 15's "the Arena is a loop
   *     here, with no editor" depends on this: rung 1's fifteen are what make the room demonstrable.
   *   * a Pool, but nothing left to roast -> an empty round, and the invitation renders instead.
   *   * a Pool with somebody in it -> their five drinks replace the static fifteen, and the votes
   *     attach to THEIR submission rather than to the author's constant list.
   *
   * The votes array is resized with the specs, because it is indexed by position: a fifteen-long
   * array beside a three-card round would leave twelve stale slots the recap counts as skipped.
   */
  useEffect(() => {
    let cancelled = false;
    dealFromPool()
      .then((dealt) => {
        if (cancelled || !dealt) return;
        if (dealt.specs.length === 0) {
          setPoolEmpty(true);
          return;
        }
        setSpecs(dealt.specs);
        setListId(dealt.listId);
        setAuthor(dealt.author || ROAST_LIST_AUTHOR);
        setVotes(Array.from({ length: dealt.specs.length }, () => null));
        setIndex(0);
      })
      .catch(() => {
        // A failed read must not empty the deck: the static fifteen are already showing and they are
        // a valid place to be. Silence is the honest response -- the visitor did not ask for a Pool.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Synchronous mutex for "this card has already been advanced past". State is too late: two events
  // in one tick both read the value from before the update, and each one writes a row for the same
  // spec. It is released when the new index is committed, so the next card can be advanced normally.
  const advancingRef = useRef(false);
  useEffect(() => {
    advancingRef.current = false;
  }, [index]);

  const spec = specs[index];

  const handleVote = useCallback((picked: RoastSide) => {
    setSide(picked);
  }, []);

  /**
   * The note pair, written by the card's rails.
   *
   * The rails produce at most one level id and one element id — that is what a level ladder and a
   * category ARE — so this is a plain replacement rather than the axis-evicting toggle the chip
   * drawer needed. `slice(0, 2)` is a backstop, not the rule: it exists so a future caller cannot
   * push a third id into a column the app documents as holding "at most two ids per vote".
   *
   * The callback is stable on purpose. The card pushes through an effect keyed on the derived pair,
   * so an unstable handler here would re-fire it on every render of the deck.
   */
  const handleSelectNotes = useCallback((ids: string[]) => {
    setSelected(ids.slice(0, 2));
  }, []);

  /**
   * Advance past the current card, writing the row for it if there was a vote.
   *
   * Shared by the front face's skip and the back face's next, on purpose: two copies of "write then
   * move on" is exactly the pair that drifts, and one of them would end up writing a row on a skip.
   *
   * THE ROUND BOUNDARY IS DECIDED HERE, and only here. A round's last card does not move the index on
   * — it raises the recap instead, so there is exactly one place that knows where a round ends and no
   * second copy of that rule in the view. Note that `votes` is a dependency of this callback, which it
   * was not before: the recap has to be counted from the votes INCLUDING the one just cast, and React
   * state does not update synchronously, so the array is built locally.
   */
  const advance = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    if (side) {
      const row = {
        session_id: getSessionId(),
        list_id: listId,
        spec_ref: spec.id,
        vote: side === "likes" ? "agree" : "disagree",
        labels: selected,
      };

      if (dry) {
        // Logged rather than written, so a dry pass still shows the exact row shape it would have
        // sent to the table.
        console.info("[roast] dry run — no row written:", row);
      } else if (supabase) {
        // Fire and forget. A failed write must never block the visitor: the row is the product's
        // data, not their progress, so the only honest response is to say so and keep going.
        supabase
          .from("roast_votes")
          .insert(row)
          .then(({ error }) => {
            if (error) {
              console.warn("[roast] Vote sync failed:", error.message);
              setSyncWarning("that one didn't reach the tally");
            }
          });
      } else {
        console.warn("[roast] No database client — the roast stays on this device.");
      }
    }

    // Built before the reset, because `side` is what is about to be cleared. A skip records null,
    // which is the honest value: no opinion is not a disagreement.
    const nextVotes = [...votes];
    nextVotes[index] = side;

    setVotes(nextVotes);

    setSide(null);
    setSelected([]);
    setSyncWarning(null);

    if (isRoundEnd(index, specs.length)) {
      setRecap(recapRound(nextVotes, roundOf(index), roundCount(specs.length)));
      return;
    }

    setIndex((i) => i + 1);
  }, [side, selected, votes, spec, index, dry, specs.length, listId]);

  /**
   * Leave the boundary and go on.
   *
   * TWO THINGS CAN HAPPEN, and the index decides which:
   *
   *   THERE IS MORE OF THIS SUBMISSION -- walk on to the next card. `rounds.ts` already knows a boundary
   *     falls every five, so a fifteen-drink Submission is three rounds with no extra machinery here.
   *
   *   IT IS SPENT -- ask the Pool for somebody else, or show the invitation. Section 29: "an empty Pool
   *     is not an error."
   *
   * WHAT THIS REPLACED, AND WHY IT WAS WRONG. The first version dealt five cards and re-dealt at each
   * boundary. That made the deck five long, so `roundCount(5)` was 1 and the FIRST boundary called
   * itself "Round 1 of 1" -- the last round, offering a summary instead of a continue, with ten drinks
   * unreachable. The author hit exactly that. Holding the whole Submission is both simpler and what the
   * round arithmetic was always written for.
   */
  const handleContinue = useCallback(async () => {
    setRecap(null);

    if (index + 1 < specs.length) {
      setIndex((i) => i + 1);
      return;
    }

    // Spent: somebody else, or the invitation.
    const next = await dealFromPool([...dealtThisRun, listId]);
    if (!next || next.specs.length === 0) {
      setPoolEmpty(true);
      return;
    }
    setDealtThisRun((d) => [...d, listId]);
    setSpecs(next.specs);
    setListId(next.listId);
    setAuthor(next.author || ROAST_LIST_AUTHOR);
    setVotes(Array.from({ length: next.specs.length }, () => null));
    setIndex(0);
  }, [index, specs.length, dealtThisRun, listId]);

  // Three states worth telling the visitor about, and none of them blocks the deck. The note is a
  // `role="status"` line, so the failure sentence is announced as well as shown.
  const note = syncWarning
    ? { text: syncWarning, warn: true }
    : dry
      ? { text: "dry run — nothing is written", warn: false }
      : supabase
        ? null
        : { text: "no tally connected — nothing is written", warn: false };

  const showBrief = !recap && !poolEmpty && index === 0 && dealtThisRun.length === 0;

  return (
    <div className="roast roast-arena" data-pal={palette}>
      {/*
        THE SKIP LINK. The room's first focusable is the exit in the sticky strip, and a keyboard
        visitor should not have to walk past it to reach the card. Off-screen above the frame until
        it takes focus, which is the only state in which a skip link is useful.
      */}
      <a className="jump" href="#roast-card-name">Skip to the card</a>

      {/*
        THE STANDING STRIP. It carries the byline and the exit and NOTHING ELSE: `handle · roasted ·
        rate` is the MENU's three facts and §11's contract, and this room has no count of its own to
        invent. The flick is decided by the deck — one per round — so fifteen cards do not each
        announce themselves.
      */}
      <header className="hud plate-room">
        <div className="who">
          <small>Who wrote the list</small>
          <span>{author}</span>
        </div>
        {/*
          The emergency exit. The deck is full-height cards with horizontal drag on every one of
          them, and before this there was no way off the screen at all. It sits in the strip and
          outside the card's gesture surface, so a tap here can never be counted as a vote or a
          skip. Hidden at the round boundary, which has its own exits and does not need a fourth.
        */}
        {!recap && !poolEmpty && <ExitLink where="menu" className="exit" />}
      </header>

      <main className="page">
        {/*
         * THE INSTRUCTIONS, which the deck did not have at all. The author's read, 2026-10-06: "where is
         * this tutorial even? its just the damn deck, no instructions, no help text, nothing." A first
         * visitor was shown a card and had to work out the gesture, the two buttons and the chips by
         * guessing -- and a tutorial that explains nothing is not a tutorial, it is a deck.
         *
         * Shown only while the round is running, and only on the FIRST round of a sitting, because help
         * that reappears every round stops being help and becomes furniture. It sits on a plate: the
         * ground is a fixed gradient and text on it is the defect the author rejected outright.
         */}
        {showBrief && (
          <p className="brief plate-room" id="brief">
            {author === ROAST_LIST_AUTHOR ? "The author's fifteen, five a round." : `${author}'s round.`}{" "}
            Take a side, add a note if you have one, and skip anything you have no opinion about. You can
            stop after any round.
          </p>
        )}

        {poolEmpty ? (
          /*
           * THE EMPTY POOL. Section 29: "An empty Pool is not an error. It is an invitation to the
           * Census, or a line sending them to the bar." This is the first of those two.
           *
           * It is NOT the same as having no Pool at all -- that case keeps the static deck, because
           * section 15's "the Arena is a loop here, with no editor" depends on rung 1's fifteen being
           * playable. This state means there IS a Pool and this Roaster has been through all of it.
           *
           * ON THE ROOM'S OWN PLATE, NOT A MenuCard: that component is the Dark Academia hub's and
           * this is the arena. One plate, the room's own `.rd` vocabulary, and the CTA in the accent
           * because it is the only thing left to do on the screen.
           */
          <section className="rd plate-room" aria-labelledby="pool-empty-line">
            <div className="rd-head">
              <span className="rd-kick">Roast · the arena</span>
            </div>
            <h2 className="rd-line" id="pool-empty-line">Nobody left to roast</h2>
            <p className="rd-sub">the pool is spent</p>
            <Link to={dry ? "/census?dry=1" : "/census"} className="rd-go">
              to the Census
            </Link>
            <div className="rd-exits">
              <Link to={dry ? "/roast?dry=1" : "/roast"} className="rd-exit">
                back to the menu
              </Link>
            </div>
          </section>
        ) : recap ? (
          <RoundEnd recap={recap} onContinue={handleContinue} dry={dry} votes={votes} />
        ) : (
          <RoastSpecCard
            // Remounting per spec is what keeps a neighbour's rails and side out of the next card.
            key={spec.id}
            spec={spec}
            index={index}
            total={specs.length}
            author={author}
            side={side}
            votes={votes}
            selected={selected}
            onVote={handleVote}
            onSelectNotes={handleSelectNotes}
            onSkip={advance}
            onNext={advance}
            // ONE FLICK PER ROUND, not per card: fifteen opacity steps in a sitting is a flash risk.
            flick={index % ROUND_SIZE === 0}
          />
        )}

        {note && !recap && !poolEmpty && (
          <p className={note.warn ? "decknote warn" : "decknote"} role="status">{note.text}</p>
        )}
      </main>
    </div>
  );
};

export default RoastDeck;
