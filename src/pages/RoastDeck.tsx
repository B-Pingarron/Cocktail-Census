import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import RoastSpecCard from "@/components/RoastSpecCard";
import ExitLink from "@/components/ExitLink";
import { noteById } from "@/data/roastNotes";
import { ROAST_LIST_ID, roastSpecs } from "@/data/roastSpecs";
import { getSessionId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import type { RoastSide } from "@/types/roast";
import "@/roast.css";

/**
 * The deck — the author's 15 specs, one per card, each one voted on and then annotated.
 *
 * THE VOTE IS ONE INSERT, ON ADVANCE, AND THAT IS STRUCTURAL:
 *   `roast_votes` has insert and select policies and no update policy, so a label cannot be patched
 *   in after the fact. A row therefore has to be complete when it is written, and the visitor's
 *   picks are not complete until they leave the card. So the row is built in memory as they choose
 *   and written once, when they advance — never on the vote press, and never twice.
 *
 * THREE WAYS OFF A CARD, TWO KINDS OF ROW:
 *   vote → chips → next     one row, with whatever labels were picked (an empty array is legal)
 *   skip                    no row at all, for a spec the visitor has no opinion about
 *   leaving the deck        no row for the specs never reached
 *   Forcing a vote on a spec nobody has an opinion about would fabricate signal, and the whole
 *   premise of this product is honest consensus from the people behind the bar. Skip is what
 *   protects that, so it shares `advance` with `next` rather than being a second code path.
 *
 * `?dry=1` READS THROUGH `useSearchParams`, NOT `location.search`:
 *   There is no server here — the app is one static file behind a HashRouter, so the query lives on
 *   the hash location and `window.location.search` is empty. Dry mode runs the whole flow and skips
 *   the write, which is the only way to walk the deck in a browser without writing real votes to the
 *   production table.
 */

/** Where the deck hands the visitor over. The verdict page reads the same tables and computes
 *  everything in lib/verdict.ts; the deck has no say in what the verdict says. */
const VERDICT_ROUTE = "/roast/verdict";

const RoastDeck = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dry = searchParams.get("dry") === "1";

  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<RoastSide | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  /**
   * The vote cast on each spec, by position — null until the visitor answers, and null forever if
   * they skip.
   *
   * The counter in the card's header reads this, which is what turns the bar from a plain progress
   * meter into the record of the session: green for what was agreed with, red for what was not,
   * neutral for what was seen without an opinion. The DECK has to own it, not the card: the card is
   * remounted per spec (see its `key`), so it cannot remember the votes that came before it.
   */
  const [votes, setVotes] = useState<(RoastSide | null)[]>(() =>
    Array.from({ length: roastSpecs.length }, () => null)
  );
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  // Synchronous mutex for "this card has already been advanced past". State is too late: two events
  // in one tick both read the value from before the update, and each one writes a row for the same
  // spec. It is released when the new index is committed, so the next card can be advanced normally.
  const advancingRef = useRef(false);
  useEffect(() => {
    advancingRef.current = false;
  }, [index]);

  const spec = roastSpecs[index];

  const handleVote = useCallback((picked: RoastSide) => {
    setSide(picked);
  }, []);

  /**
   * One chip per axis, at most. Picking a second word from the same axis replaces the first, because
   * the axes are orthogonal by design: `level` is how much, `element` is what about, and two answers
   * to the same question is not a richer answer.
   */
  const handleToggleNote = useCallback((id: string) => {
    const note = noteById(id);
    if (!note) return;
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((kept) => kept !== id)
        : [...prev.filter((kept) => noteById(kept)?.axis !== note.axis), id]
    );
  }, []);

  /**
   * Advance past the current card, writing the row for it if there was a vote.
   *
   * Shared by the front face's skip and the back face's next, on purpose: two copies of "write then
   * move on" is exactly the pair that drifts, and one of them would end up writing a row on a skip.
   */
  const advance = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    if (side) {
      const row = {
        session_id: getSessionId(),
        list_id: ROAST_LIST_ID,
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

    // Recorded before the reset, because `side` is what is about to be cleared. A skip records
    // null, which is the honest value: no opinion is not a disagreement.
    setVotes((previous) => {
      const next = [...previous];
      next[index] = side;
      return next;
    });

    const isLast = index >= roastSpecs.length - 1;
    setSide(null);
    setSelected([]);
    setSyncWarning(null);

    if (isLast) navigate(VERDICT_ROUTE);
    else setIndex((i) => i + 1);
  }, [side, selected, spec, index, dry, navigate]);

  // Three states worth telling the visitor about, and none of them blocks the deck.
  const note = syncWarning
    ? { text: syncWarning, warn: true }
    : dry
      ? { text: "dry run — nothing is written", warn: false }
      : supabase
        ? null
        : { text: "no tally connected — nothing is written", warn: false };

  return (
    <div className="roast flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        {/*
          The emergency exit. The deck is fifteen full-height cards with horizontal drag on every
          one of them, and before this there was no way off the screen at all. It sits above the
          card and outside the card's gesture surface, so a tap here can never be counted as a
          vote or a skip. A menu screen for the ROAST is still to come; until it exists the hub
          is the honest place to land.
        */}
        <div className="flex justify-center pb-2">
          <ExitLink />
        </div>
        <RoastSpecCard
          // Remounting per spec is what keeps a neighbour's chips and side out of the next card.
          key={spec.id}
          spec={spec}
          index={index}
          total={roastSpecs.length}
          side={side}
          votes={votes}
          selected={selected}
          onVote={handleVote}
          onToggleNote={handleToggleNote}
          onSkip={advance}
          onNext={advance}
        />
        {note && (
          <p className={note.warn ? "decknote warn" : "decknote"}>{note.text}</p>
        )}
      </div>
    </div>
  );
};

export default RoastDeck;
