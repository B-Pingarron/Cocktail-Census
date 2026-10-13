import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
// Aliased: the React event types would otherwise shadow the DOM's own `PointerEvent` /
// `KeyboardEvent` inside this module, which is a silent trap rather than a type error.
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { notesFor, phraseFor } from "@/data/roastNotes";
import { ROAST_LIST_AUTHOR } from "@/data/roastSpecs";
import { cocktailArt } from "@/lib/cocktailArt";
import type { RoastSide, RoastSpec } from "@/types/roast";

/**
 * The roast spec card — one spec of the deck.
 *
 * ── WHY THIS IS A REWRITE AND NOT A RESKIN ──────────────────────────────────
 *
 * The previous card was the v10 reference ported whole: a `<canvas>` pixel field, a
 * rejection-sampled quad frame read out of `lib/frameGeometry.ts`, ink drips, tape, a neon SVG
 * and **two axes of chips** for the notes. The author reviewed the arena study and re-decided
 * four things that no amount of reskinning could reach:
 *
 *   1. `frame-pixel` is a DON'T. The frame is a hard black square edge, 4-5px, slightly rotated,
 *      plus two misregister plates — so the measured quad and the pixel canvas are gone.
 *   2. The card has THREE GLASS PANS (name, artwork, specs), the material the author picked in
 *      `cards/glass-lens-13.html` — so `titlebox` / `textbox` / `notesbox` are gone.
 *   3. `mo-turn`: the spec is on the FRONT with the likes/yikes pair, and the back is where the
 *      vote is explained. So the chips are not on the back as a drawer — the back IS the reason.
 *   4. The chips themselves are gone: **three bipolar rails**, one per category. The author's
 *      own ruling on the redundancy: "we cant use 9 elements to reference one single option
 *      (how much and what). thats just too much."
 *
 * ── THE RAILS ARE NOT A NEW MODEL, AND THAT IS THE WHOLE POINT ──────────────
 *
 * `data/roastNotes.ts` already holds exactly what a rail needs:
 *
 *   * three ELEMENT ids — `el-balance`, `el-ingredients`, `el-glass-garnish` — which are the
 *     three rails, in order;
 *   * a per-side LEVEL ladder of three words — `meh` / `cringe` / `gross` on the yikes side,
 *     `fresh` / `sick` / `rad` on the likes side — which is the fader's magnitude.
 *
 * So a seven-detent fader is that ladder made spatial: -3..-1 is one side's ladder read outward,
 * +1..+3 is the other's, and 0 is "not graded". One rail gesture therefore produces a legal
 * `roast_votes.labels` pair — one level id plus one element id — with NO schema change, no new
 * vocabulary and nothing invented. The app's module comment even names the reason the ladder is
 * per-side: "a shared scale word has to read correctly on both sides, and none do… splitting the
 * ladder per side removes the ambiguity instead of hiding it."
 *
 * ── ONE PAIR IS STORED, AND ALL THREE RAILS ARE STILL VOTABLE ───────────────
 *
 * `roastNotes.ts`: "One chip per axis, at most two ids per vote." Three graded rails would be
 * three element ids, which that contract cannot hold. So all three rails MOVE and all three are
 * readable, and the pair that is stored is the strongest grade's — ties going to category order.
 * That is the author's ruling recorded in the arena study, not a limitation invented here. Storing
 * a row per element is a vote-row-per-element schema change and belongs to that decision, not to
 * a wiring pass.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT DO ─────────────────────────────────
 *
 * THE FIT LOOP IS NOT HERE. `roast-card-fit.html` solves `--u` by measuring both faces and
 * binary-searching the largest unit that still fits `viewportHeight - strip - padding`. The app's
 * deck is a scrolling page that carries the exit, the brief and the dry-run note, not a
 * fixed-height screen, so the loop has no height contract to solve against and it would fight the
 * page flow. `--u` is declared in `roast-arena.css` at the mockup's own 360x640 value instead.
 * This is the card's one unkept promise and it is named rather than hidden.
 *
 * LAW 11: the turn is `--turn` (0.62s), declared in the room's stylesheet. Nothing here derives,
 * shortens or lengthens it.
 */

export type RoastPalette = "heat" | "mag" | "lime" | "amber";

/**
 * The three rails, in the author's order, each carrying the app's own element id.
 *
 * The LABEL is the author's word ("presentation") and the ID is the table's ("el-glass-garnish").
 * They are not the same string on purpose: the label is what the visitor reads, the id is what
 * `roast_votes.labels` stores, and renaming the label must never split the aggregation in two —
 * which is exactly why the ids are ids and not text.
 */
const RAILS = [
  { key: "balance", elId: "el-balance", label: "balance" },
  { key: "ingredients", elId: "el-ingredients", label: "ingredients" },
  { key: "presentation", elId: "el-glass-garnish", label: "presentation" },
] as const;

type RailKey = (typeof RAILS)[number]["key"];

/** The seven detents, as the arithmetic the whole rail is built on. */
const DETENTS = 3;
const SPAN = DETENTS * 2;

interface RoastSpecCardProps {
  spec: RoastSpec;
  /** 0-based position in the deck. The readout prints `index + 1`, which is what a visitor counts. */
  index: number;
  total: number;
  /**
   * WHO WROTE THIS LIST, as the strip prints it. Rung 2 made lists real, so the card takes the
   * byline instead of assuming it; the default keeps every other caller working.
   */
  author?: string;
  /** Null until a vote button is pressed; that is also what turns the card over. */
  side: RoastSide | null;
  /**
   * The vote already cast on each spec, by position. Only the record reads it: the card cannot
   * know what came before it, because the deck remounts it per spec.
   */
  votes: (RoastSide | null)[];
  /** At most one id per axis — produced by the rails, enforced by the deck. */
  selected: string[];
  onVote: (side: RoastSide) => void;
  /** Replaces the whole note pair. The rails are the only writer, so there is nothing to toggle. */
  onSelectNotes: (ids: string[]) => void;
  onSkip: () => void;
  onNext: () => void;
  /**
   * ONE FLICK PER ROUND, not per card. Fifteen opacity steps in a sitting is a flash risk, so the
   * deck decides which card opens a round and the card only carries the class.
   */
  flick?: boolean;
}

/**
 * The record — one block per spec of the deck, and every lit block carries the vote its spec got.
 *
 * FOUR STATES IN FOUR CHANNELS, so the shape alone reads: agreement solid, disagreement a
 * diagonal hatch over the yikes red, skip a short dotted grey that is NEVER red ("a skip is not a
 * disagreement, and painting it red invents a vote nobody cast"), and the spec in front of you
 * taller and flagged. Colour is the fifth channel and only ever repeats one of the four.
 *
 * THE SPEC UNDER THE VISITOR'S FINGER TAKES THE LIVE VOTE, not the recorded one: the row is only
 * written when they advance, and a record that waits for the next card to acknowledge a press
 * reads as a record that missed it.
 *
 * The mockup carries a fifth state, `seen`. It is not rendered here because the app cannot
 * produce it — `advance` is shared by `skip` and `next`, so reaching a spec and leaving without
 * voting IS a skip — and a state nothing can reach is a dead declaration.
 */
const Record = ({
  index,
  total,
  votes,
  side,
}: {
  index: number;
  total: number;
  votes: (RoastSide | null)[];
  side: RoastSide | null;
}) => (
  <div className="record">
    <span className="hp" role="img" aria-label="Your record on the deck.">
      {Array.from({ length: total }, (_, i) => {
        const cast = i === index ? side : votes[i];
        // Reached and left without a vote IS a skip in this app (`advance` is shared by `skip` and
        // `next`), which is why there is no separate `seen` state: the two are the same act.
        const shape = cast === "likes" ? "ag" : cast === "yikes" ? "dis" : i <= index ? "skip" : "";
        return <i key={i} className={[i === index ? "here" : "", shape].filter(Boolean).join(" ")} />;
      })}
    </span>
  </div>
);

/**
 * One bipolar rail. Seven detents, 0 = not graded, negative = yikes, positive = likes.
 *
 * THE GROOVE IS 44px TALL AND THE TRACK FILLS IT, so the drag target is legal on both axes —
 * which is the arithmetic the previous rail got wrong in the other direction. It read
 * `44 / 3 = 14.6px` and concluded that three 44px targets could not fit a 44px rail. That is a
 * WIDTH sum applied to a VERTICAL stack: the honest ceiling was always the rail's height budget,
 * and laying the rail on its side removes the question entirely. The handle's 44px width is
 * bought back as a 22px inset at each end.
 *
 * FOUR CHANNELS, NEVER COLOUR ALONE. The dot count is the magnitude, the side of centre is the
 * polarity, the word is both, and colour only repeats the polarity — a lit yikes dot is HATCHED
 * (the record's own disagreement idiom) and a lit likes dot is solid. That is what keeps the
 * polarity readable in lime and amber, where `--a` and `--ok` measure 1.05:1 and 1.02:1 apart.
 */
const Rail = ({
  label,
  value,
  side,
  onChange,
}: {
  label: string;
  value: number;
  side: RoastSide | null;
  onChange: (next: number) => void;
}) => {
  const groove = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // The app's own ladder for this side, in degree order. `notesFor` filters on the side already,
  // which is the point: "meh" and "fresh" are not two ends of one scale.
  const levels = useMemo(() => (side ? notesFor(side, "level") : []), [side]);
  const word = value === 0 ? "—" : (levels[Math.abs(value) - 1]?.text ?? "—");

  const commit = useCallback(
    (next: number) => {
      const clamped = Math.max(-DETENTS, Math.min(DETENTS, next));
      if (clamped !== value) onChange(clamped);
    },
    [value, onChange]
  );

  /** Where a client x sits on the rail, as a detent. The groove's own rect, so it cannot drift. */
  const detentAt = useCallback((clientX: number) => {
    const box = groove.current?.getBoundingClientRect();
    if (!box || box.width === 0) return 0;
    const t = Math.max(0, Math.min(1, (clientX - box.left) / box.width));
    return Math.round(t * SPAN) - DETENTS;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      commit(detentAt(event.clientX));
    },
    [commit, detentAt]
  );
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragging.current) return;
      commit(detentAt(event.clientX));
    },
    [commit, detentAt]
  );
  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    dragging.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The capture can already be gone if the pointer left the document. Nothing to do.
    }
  }, []);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const step = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : 0;
      if (step !== 0) {
        event.preventDefault();
        commit(value + step);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        commit(-DETENTS);
      } else if (event.key === "End") {
        event.preventDefault();
        commit(DETENTS);
      } else if (event.key === "0" || event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        commit(0);
      }
    },
    [commit, value]
  );

  return (
    <div className="rail">
      <div className="el-head">
        <span className="kick tf-plate">{label}</span>
        {/* The word is aria-hidden because the slider's own `aria-valuetext` already says it —
            announced twice, it reads as two facts. */}
        <span className="grade-word" aria-hidden="true">{word}</span>
      </div>
      <div className="fader">
        <span className="fader-end" aria-hidden="true">yikes</span>
        {/*
          THE `--f` CUSTOM PROPERTY LIVES ON THE GROOVE, not on the handle: the handle is positioned
          from it and the groove is their only shared parent, so putting it on the handle would ask
          the element to read a value it is itself setting.
        */}
        <div className="groove" ref={groove} style={{ "--f": String((value + DETENTS) / SPAN) } as CSSProperties}>
          {/*
            ONE FOCUS STOP, AND IT IS THE TRACK. The track is a real `<button role="slider">` filling
            the groove's full 44px, so the drag target is legal on both axes and a press anywhere on
            the bar lands on it — and the knob below is `aria-hidden` and `pointer-events: none`, so
            it is a picture of the value rather than a second control. The alternative, a focusable
            handle, would be an `aria-hidden` button that takes focus, which is an accessibility
            violation rather than a convenience.
          */}
          <button
            type="button"
            role="slider"
            className="fader-track"
            aria-label={label}
            aria-valuemin={-DETENTS}
            aria-valuemax={DETENTS}
            aria-valuenow={value}
            aria-valuetext={value === 0 ? "not graded" : `${word}, ${side ?? "no side"}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          />
          <div className="fader-dots" aria-hidden="true">
            {Array.from({ length: SPAN + 1 }, (_, i) => {
              const detent = i - DETENTS;
              const lit =
                detent !== 0 && Math.abs(detent) <= Math.abs(value) && Math.sign(detent) === Math.sign(value);
              return <i key={i} className={lit ? `on${detent < 0 ? " y" : ""}` : ""} />;
            })}
          </div>
          <span className="fader-handle" aria-hidden="true">
            <span />
          </span>
        </div>
        <span className="fader-end" aria-hidden="true">likes</span>
      </div>
    </div>
  );
};

const RoastSpecCard = ({
  spec,
  index,
  total,
  author = ROAST_LIST_AUTHOR,
  side,
  votes,
  selected,
  onVote,
  onSelectNotes,
  onSkip,
  onNext,
  flick = false,
}: RoastSpecCardProps) => {
  /** The three grades, -3..+3. 0 is "not graded" and is the only clearing value. */
  const [grades, setGrades] = useState<Record<string, number>>({ balance: 0, ingredients: 0, presentation: 0 });
  /** True while the visitor has asked to look at the front again after casting. */
  const [peek, setPeek] = useState(false);
  /** The glitch plays once as the card arrives; the class is dropped so nothing lingers. */
  const [glitching, setGlitching] = useState(true);
  const [scrolls, setScrolls] = useState(false);
  const specsPan = useRef<HTMLDivElement>(null);

  const isBack = Boolean(side) && !peek;

  /*
   * A NEW SPEC PUTS THE CARD BACK ON ITS FRONT. `key={spec.id}` on the caller remounts this
   * component per spec, so this is belt-and-braces — but it is the invariant that matters: a
   * fresh card must never be dealt already turned, or the visitor grades a drink whose name they
   * have not seen.
   */
  useEffect(() => {
    setPeek(false);
  }, [spec.id]);

  useEffect(() => {
    setGlitching(true);
    const t = window.setTimeout(() => setGlitching(false), 600);
    return () => window.clearTimeout(t);
  }, [spec.id]);

  /*
   * THE OVERFLOW CUE, MEASURED. The deck's recipes run 3 to 8 ingredients and the methods 1 to 3
   * lines, so the tallest spec can be taller than the box at `--u`. The cue is a mark rather than
   * a sentence and it appears only when the pan genuinely overflows — and the pan takes a tab stop
   * when it does, so the rest of the list is reachable from the keyboard.
   */
  useLayoutEffect(() => {
    const measure = () => {
      const el = specsPan.current;
      if (el) setScrolls(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [spec.id]);

  /*
   * THE STORED PAIR. Strongest grade wins; ties go to category order. Computed from the rails and
   * pushed up in one call, so the deck never has to toggle two ids and hope the axes line up.
   */
  const pair = useMemo(() => {
    if (!side) return [];
    let best: (typeof RAILS)[number] | null = null;
    for (const rail of RAILS) {
      const grade = Math.abs(grades[rail.key]);
      if (grade === 0) continue;
      if (!best || grade > Math.abs(grades[best.key])) best = rail;
    }
    if (!best) return [];
    // The level id is derived, never stored: `degree` is the rail's magnitude and the ladder is
    // the app's. `notesFor` already filtered on the side.
    const level = notesFor(side, "level")[Math.abs(grades[best.key]) - 1];
    return level ? [level.id, best.elId] : [];
  }, [grades, side]);

  useEffect(() => {
    /*
     * NO-OP WRITES ARE SKIPPED ON PURPOSE. This effect fires on mount too, where the pair is empty
     * and the deck's `selected` is already empty — so an unguarded call would re-render the whole
     * deck once per card for nothing. The comparison is exact (length, then order) because the pair
     * the rail produces is `[levelId, elementId]` and that is precisely the array the deck stores.
     */
    const same = pair.length === selected.length && pair.every((id, i) => selected[i] === id);
    if (!same) onSelectNotes(pair);
  }, [pair, selected, onSelectNotes]);

  /**
   * CASTING ALWAYS TURNS THE CARD, INCLUDING A RE-PRESS OF THE SAME SIDE.
   *
   * `back to the drink` is a local peek, not a change of vote, so the side can be identical on the
   * next press — and a bare `onVote("yikes")` would then be a no-op in React's eyes, leaving the
   * visitor on the front with no way back to the rails except the other button. Clearing the peek
   * here is what makes the pair behave like a pair.
   */
  const castVote = useCallback(
    (next: RoastSide) => {
      setPeek(false);
      onVote(next);
    },
    [onVote]
  );

  const phrase = side ? phraseFor(side, selected) : "";
  const readout = String(index + 1).padStart(2, "0");

  return (
    <div className="stage">
      <div className="tilt">
        <span className="plate plate-b" aria-hidden="true" />
        <span className="plate plate-a" aria-hidden="true" />
        <span className="tape t1" aria-hidden="true" />
        <span className="tape t2" aria-hidden="true" />
        <span className="tape t3" aria-hidden="true" />
        <span className="tape t4" aria-hidden="true" />

        <div className={`card3d${isBack ? " is-back" : ""}${glitching ? " is-glitching" : ""}`}>
          {/* ── front: the spec ─────────────────────────────────────────── */}
          <article className="face face-front" aria-hidden={isBack} data-od-id="face-front">
            <div className="row">
              <span className="kick tf-plate">the record</span>
              <Record index={index} total={total} votes={votes} side={side} />
            </div>

            <div className="pan pan-name">
              <div className="row">
                <div>
                  <span className="kick tf-plate">{author}</span>
                  <div className="tf-plate big">
                    {/*
                      `aria-label` IS LOAD-BEARING. `::before` and `::after` are generated content
                      and they count toward an element's accessible name, so the glitch's two
                      channel copies would have the heading announce the drink three times over.
                      The label names it once and the pseudo-elements stop contributing.
                    */}
                    <h2
                      className="card-name glitch-host"
                      id="roast-card-name"
                      data-glitch={spec.name}
                      aria-label={spec.name}
                    >
                      {spec.name}
                    </h2>
                  </div>
                </div>
                <div className="numcol">
                  <span className="tf-plate big">
                    <span className="readout" aria-hidden="true">{readout}</span>
                  </span>
                  <span className="kick tf-plate" aria-hidden="true">of {total}</span>
                  <span className="sr-only">{`spec ${index + 1} of ${total}`}</span>
                </div>
              </div>
            </div>

            {/*
              THE DRINK ITSELF. `cocktailArt` is keyed by the Census slug — `spec.art`, which is the
              column the illustration file is named after. NOT `spec.id`: that is `spec_ref`, the row
              uuid a vote is stored against, and on a dealt spec it is a uuid while the slug sits in
              `specs.cocktail_slug`. Reading `id` here looked up a uuid, missed the map and drew the
              placeholder on every card dealt from the Pool. `?? spec.id` is the static deck, whose id
              already IS the slug. `alt` is empty because the card names the drink two lines above:
              the picture is not the label.
            */}
            <div className={`pan pan-art${flick ? " is-flicking" : ""}`}>
              <span className="tube" aria-hidden="true" />
              <span className="led" aria-hidden="true" />
              <div className="art">
                <img src={cocktailArt(spec.art ?? spec.id)} alt="" />
              </div>
            </div>

            {/*
              PAN 3, and the pan that scrolls when it must. The wrapper exists so the overflow cue
              does not scroll with the content — an absolutely positioned child of a scroll
              container scrolls with it, which would put the mark at the bottom of the LIST rather
              than the bottom of the BOX.
            */}
            <div className={`panwrap${scrolls ? " is-scroll" : ""}`}>
              <div
                className={`pan pan-specs${scrolls ? " is-scroll" : ""}`}
                ref={specsPan}
                tabIndex={scrolls ? 0 : -1}
                aria-label={scrolls ? "The recipe, scrollable" : undefined}
              >
                <dl className="rows">
                  {spec.ingredients.map((ingredient) => (
                    <div className="stat" key={`${ingredient.name}-${ingredient.amount}`}>
                      <dt className="ing-name">{ingredient.name}</dt>
                      <dd>{ingredient.amount}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="meta">
                  <div className="stat">
                    <dt className="kick">Glass</dt>
                    <dd>{spec.glass}</dd>
                  </div>
                  <div className="stat">
                    <dt className="kick">Garnish</dt>
                    <dd>{spec.garnish}</dd>
                  </div>
                </dl>
                <p className="how">
                  <span className="kick">Method</span> {spec.method}
                </p>
              </div>
              <span className="scroll-cue" aria-hidden="true">▾ more below</span>
            </div>

            <div className="verdict">
              <div className="vote" role="group" aria-label="Your verdict on this spec">
                <button
                  type="button"
                  className="vbtn v-yikes"
                  aria-pressed={side === "yikes"}
                  onClick={() => castVote("yikes")}
                >
                  <span>Yikes ✗</span>
                </button>
                <button
                  type="button"
                  className="vbtn v-likes"
                  aria-pressed={side === "likes"}
                  onClick={() => castVote("likes")}
                >
                  <span>Likes ✓</span>
                </button>
              </div>
              {/*
                A button, not a third vote: "no opinion" is not an answer, and a visual peer of the
                two votes would read as one. Demoted by WEIGHT only — no fill, no shadow, no display
                face, and its ink RISES from --dim to --txt on hover rather than dropping.
              */}
              <div className="skiprow">
                <button type="button" className="skip-btn" onClick={onSkip}>
                  or skip this one
                </button>
              </div>
            </div>
          </article>

          {/* ── back: the reasons ────────────────────────────────────────── */}
          {/*
            NO `inert` ATTRIBUTE, AND THAT IS DELIBERATE. The far face carries `visibility: hidden`
            from the stylesheet, which already removes it from the tab order AND from the
            accessibility tree — `inert` would be a second declaration of the same fact, and on
            React 18 it is not a typed prop, so declaring it would mean a cast to assert something
            the CSS already guarantees. `aria-hidden` stays because it is declarative and matches
            the visibility exactly.
          */}
          <article className="face face-back" aria-hidden={!isBack} data-od-id="face-back">
            <div className="row">
              <span className="kick tf-plate"><span className="mis">the reasons</span></span>
              <Record index={index} total={total} votes={votes} side={side} />
            </div>

            <div className="pan pan-reasons">
              <div className="tf-plate big">
                <h2
                  className="btitle glitch-host"
                  id="roast-card-reasons"
                  data-glitch="the reasons for both"
                  aria-label="the reasons for both"
                >
                  the reasons for both
                </h2>
              </div>
              {/*
                The composed sentence, from `phraseFor` in the app's own module. It falls back to
                a mechanical join when a slot is unwritten — the phrase table is still marked
                `TODO(copy session)` and every line in it is throwaway — so this is the one place
                the authored copy lands when it does.
              */}
              <p className="kick tf-plate" id="roast-card-why">
                {phrase || "grade a reason, then decide"}
              </p>

              <ul className="els">
                {RAILS.map((rail) => (
                  <li className="el" key={rail.key}>
                    <Rail
                      label={rail.label}
                      value={grades[rail.key]}
                      side={side}
                      onChange={(next) => setGrades((prev) => ({ ...prev, [rail.key as RailKey]: next }))}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="actions">
              <button type="button" className="back-btn" onClick={() => setPeek(true)}>
                <span>↺ back to the drink</span>
              </button>
              <button
                type="button"
                className="next-btn"
                aria-label="next spec in the deck"
                onClick={onNext}
              >
                <span>next ▸</span>
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};

export default RoastSpecCard;
