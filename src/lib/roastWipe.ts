/**
 * roastWipe — the Pokemon Gen I `BattleTransition_DoubleCircle`, ported tile for tile, and the two
 * things the ROM does not do: a dimmer instead of a strobe, and a wipe that reopens.
 *
 * ONE USE ONLY: the exit from /roast/enter into /roast/deck. It is started by RoastEnter and
 * nowhere else. It is deliberately not a route wrapper — see the long note on the caller in
 * RoastEnter.tsx and the shorter one in App.tsx. Two attempts at a router-level sheet were
 * rejected before this existed: a frozen frame of the sheet was a blank full-screen rectangle,
 * which reads as LOADING rather than as turning, and a blank sheet over a page change is the one
 * thing the hub's own MenuCard turn must not be confused with.
 *
 * WHY IT IS A MODULE AND NOT A COMPONENT:
 *   It used to be a component, and it stopped being one because the transition had to grow a
 *   REVEAL — the deck arriving out of black rather than appearing after a black pause. A reveal
 *   needs the overlay to still be on screen AFTER `navigate("/roast/deck")` has run, and a
 *   component mounted inside RoastEnter is unmounted by exactly that navigation, taking its
 *   canvas with it. There is no way to reopen a wipe from inside the page the wipe just left.
 *
 *   So the overlay moved out of React's tree and into `document.body`, owned by a plain module
 *   with a single entry point: `playRoastWipe(swap)`. There is no portal primitive in this
 *   project to reach for — `createPortal` has zero hits and `src/components/ui/` holds a single
 *   `button.tsx` — and one would have been the wrong shape anyway. This is a fire-and-forget
 *   full-screen effect with no props, no state, no render and a lifetime deliberately longer than
 *   its caller's; a portal is a mechanism for keeping a subtree in the DOM, and the subtree here
 *   is one `<div>` with one `<canvas>` and no behaviour of its own.
 *
 *   The stylesheet moved with it. A module that creates DOM owns the CSS for that DOM; a lib that
 *   silently depends on some other file importing a sheet globally is a trap for the next reader,
 *   and this is the only consumer of `.roast-wipe`.
 *
 * WHY CANVAS AND NOT CSS:
 *   The dimmer phase is a wash over the WHOLE screen, and the obvious web translation — a
 *   `filter: brightness()` or `opacity` ramp on the page — was tried first and rejected for a
 *   mechanical reason, not a taste one. Any ancestor with a `filter` becomes the containing block
 *   for `position: fixed` descendants, so the `.grain` overlay (fixed, full-bleed, on every roast
 *   page) would snap to the filtered ancestor's box and the vignette would jump the moment the ramp
 *   started. A wash drawn on a canvas of its own has no such relationship to the page: it is a
 *   sibling that covers it, so nothing underneath can be re-parented by it. On a page this close to
 *   black the wash and a real palette crush are almost indistinguishable anyway, which is the
 *   second reason it was worth taking the trade.
 *
 * WHY NO LIBRARY: the plan bans framer-motion outright (`.sisyphus/plans/2026-09-22-hub-and-roast-plan.md`
 * §12) and the project already weighed it and refused it on bundle size. A transition is ~200 lines
 * of integers here. The whole effect is a frame table and a painter, and a dependency would be a
 * larger diff than the effect.
 *
 * THE CLOCK IS AN INTEGER, NOT A TIMESTAMP:
 *   The DMG ran its LCD at 59.7275 Hz, so a frame is 1000/59.7275 ms — the number the phase table
 *   below was written against. Nothing here subtracts it from an accumulator: the loop advances ONE
 *   integer frame per `requestAnimationFrame` tick and the phase boundaries are compared against that
 *   integer. The accumulator version was tried first and it drifts — a long frame early in the
 *   dimmer shifts every later step, and the reveal's last step is the frame the visitor is left
 *   looking at, so drift there is drift on the landing. Comparing integers cannot drift; it also
 *   cannot skip, which is the behaviour the ROM has and the one that makes the cut land on a full
 *   black frame.
 *
 * THE 7-FRAME PROLOGUE IS CUT, AND THAT IS THE ONLY CUT:
 *   The original spends seven frames letting the tiles settle before the flash starts. On a DMG that
 *   is the LCD's own latency being waited out; on the web rAF has already presented the frame we
 *   asked for, so it is seven frames (~117 ms) of nothing between the click and the effect. The rest
 *   of the table is intact.
 */

// The stylesheet is imported by the module that creates the overlay, not by the app entry point.
// See the header: four positioning declarations that describe exactly the DOM built below, and
// nothing else in the project paints this transition.
import "./roastWipe.css";
import { prefersReducedMotion } from "./motion";

/**
 * The reference grid. 20x18 tiles of 8x8 pixels is the whole DMG screen, so this is not a scaled-down
 * approximation of the effect — it IS the effect, at the resolution it was authored at.
 */
const COLS = 20;
const ROWS = 18;
const CELLS = COLS * ROWS;

/**
 * THE DIMMER. `[alpha]` per step, six steps, four frames each, one pass.
 *
 * IT IS A DIMMER, NOT A STROBE, and that is the whole safety argument. There is no polarity
 * reversal and no white peak: alpha goes 0.25, 0.50, 0.75 and comes back down the same way, in one
 * monotonic-in-then-monotonic-out pass. A wash like that has no large-amplitude oscillation in it
 * for the whole screen to be caught by, which is what the photosensitivity question is actually
 * about — the hazard is the oscillation and the full-field luminance swing, not motion.
 *
 * WHAT IT REPLACED, and why the replacement was not optional. The ROM's table, quoted:
 *
 *   [0, 0.35] [0, 0.72] [0, 1.00]   1-3   crush to black
 *   [0, 0.85] [0, 0.55] [0, 0.15]   4-6   coming back up
 *   [1, 0.10] [1, 0.35] [1, 0.75]   7-9   the blowout
 *   [1, 0.30] [1, 0.08] [0, 0.00]   10-12 settle back to normal
 *
 * 12 steps at 2 frames, cycled 3 times over 72 frames. That is twelve full-screen luminance
 * transitions per cycle, three cycles inside 1.2 seconds, with the screen going all the way to black
 * and then all the way to WHITE and back — i.e. a full-field light/dark alternation repeated three
 * times in about a second. That is above the WCAG 2.3.1 general flash threshold and it is a real
 * photosensitivity trigger, not a theoretical one: a full-screen flash at 3 Hz with a polarity flip
 * is close to the worst case the guidance names.
 *
 * It is quoted here rather than deleted because the next reader will otherwise look at a six-entry
 * fade, decide a plain opacity transition would do, and put the ROM table back — which is exactly
 * what it was, and it was a hazard. The ROM could afford it: a DMG panel at ~4 luminance levels
 * cannot do the alpha ramp a browser can, and a person holding a Game Boy on a small screen is not
 * being shown twenty inches of light at 60Hz.
 *
 * The provenance of the quoted table is `BattleTransition_FlashScreenPalettes` in
 * `pret/pokered engine/battle/battle_transitions.asm`. The ROM's own table carries a terminator
 * after the twelfth entry; the terminator is not a step, it is a sentinel for the reading loop, and
 * the ported loop above no longer exists either. Nothing is read from the ROM at run time — the
 * numbers above are transcribed, and the six below are new.
 */
const FLASH_STEPS: number[] = [0.25, 0.50, 0.75, 0.75, 0.50, 0.25];
const FLASH_FRAMES_PER_STEP = 4;
const FLASH_FRAMES = FLASH_STEPS.length * FLASH_FRAMES_PER_STEP; // 24

    /**
     * THE REVEAL IS CAPPED AT 30 FRAMES, whatever the close took.
     *
     * It used to be the close's own length, which was free when there was one wipe. With four of
     * them the cap earns its keep: a faithful Spiral inward close is 156 frames, and a reveal that
     * mirrored it would put the whole transition at 339 frames — five and a half seconds on a single
     * press. That is a stall, and a stall is the exact thing the two rejected router-level transitions
     * were rejected for (App.tsx lines 12-19).
     *
     * So the close runs at its authentic tempo and the reveal does not. Thirty frames is the
     * DoubleCircle's own reveal length — the one that was watched and approved — and holding it fixed
     * means every variant ends on the same hand. A long close therefore reveals at more than one step
     * per frame, which is invisible: the reveal is a smooth un-cover either way.
     */
    const REVEAL_FRAMES = 30;

    /**
     * THE CLEAR PHASE, three frames with NOTHING painted, and it is load-bearing rather than padding.
     *
     * Snapshot 0 is not empty. It is 32 of 360 cells — the ROM's first record is a real wedge opening
     * out of the centre, not a point, which is the same fact the coverage curve starts on. So the
     * reveal's last three frames are the first step of the wipe, and the instant the clear phase starts
     * the canvas goes from "32 cells of black in the middle of the deck" to "nothing", which is a pop of
     * exactly that wedge, on the frame the transition is supposed to have ended on. Three frames of
     * nothing lets the compositor retire the last painted frame first.
     *
     * The longer variants leave more than 32 cells in snapshot 0 and so pop more, but the clear frame
     * is still the right place for the discontinuity: it is already three frames of nothing, and a
     * reveal that eased all the way to a perfect zero would be a lie about the ROM's data.
     */
    const CLEAR_FRAMES = 3;

/**
 * THE REVEAL IS NOT WHAT THE HARDWARE DOES. Say so before the tables below, because everything in
 * this file is otherwise a faithful port and a reader will assume otherwise.
 *
 * `BattleTransition_DoubleCircle` does not reverse. It ends in `jp BattleTransition_BlackScreen`
 * and never reopens: the destination is drawn under a black screen and the transition simply
 * finishes, and the cut to the next scene happens on that black. A real DoubleCircle has no way to
 * un-paint itself, because the tiles it wrote are gone the moment it wrote them.
 *
 * So the reveal below is a deliberate departure, and the reason is the product, not the port: this
 * page must not read as LOADING. A wipe that ends on black and holds there for even half a second
 * presents a full-screen black rectangle at the exact moment the visitor is wondering whether
 * something broke — which is the same reading that killed the router-level sheet (see App.tsx) and
 * it is a worse version of it, because there the black was incidental and here it would be the
 * whole experience. Showing the deck ARRIVING out of black says the page is here and the button
 * worked, in the same gesture, without a spinner and without a stall. The deck visibly arrives
 * instead of appearing after a pause.
 *
 * The cost is honest and worth recording: the ROM's version is one clean cut on black and this is
 * a cut plus thirty frames of animation after it, so the transition is half again as long at the
 * front of the landing as the hardware's would be. That is the price of the better reading.
 */

/**
 * The circle's run-length data, from `BattleTransition_CircleData`. Each array is a sequence of
 * `(runLength, nextByte)` pairs, where nextByte is read AFTER the run is painted and AFTER the
 * pointer has stepped to the next row:
 *
 *   0   run again in the same direction, one row on
 *   >0  step BACK that many tiles against the run direction, then run again
 *   -1  end of record
 *
 * The vertical step happens before the back-off is applied, so the back-off moves the next run's
 * START COLUMN, not its end. The run lengths are what give the wedge its curve: they grow along a
 * record and shrink again, and that is the arc of the circle, drawn as a staircase.
 */
const CIRCLE_DATA: number[][] = [
  [],
  [2, 3, 5, 4, 9, -1],
  [1, 1, 2, 2, 4, 2, 4, 2, 3, -1],
  [2, 1, 3, 1, 4, 1, 4, 1, 4, 1, 3, 1, 2, 1, 1, 1, 1, -1],
  [4, 1, 4, 0, 3, 1, 3, 0, 2, 1, 2, 0, 1, -1],
  [4, 0, 3, 0, 3, 0, 2, 0, 2, 0, 1, 0, 1, 0, 1, 0, 1, -1],
];

/**
 * THE 17-BYTE PROBLEM IN `CIRCLE_DATA[5]`, AND WHY THIS TABLE IS 18.
 *
 * `pret` carries the last record as seventeen bytes, which is odd. The pair reader therefore consumes
 * the `-1` sentinel into a runLength slot, gets a run it can paint, looks for the terminator that
 * follows, and finds nothing — at which point it reads whatever the next byte in memory is. On the
 * Game Boy that is the next routine's first instruction, and the loop either paints garbage or runs
 * off the screen. Translated to a browser it is worse than garbage: it is an unbounded loop on a
 * value the page does not own.
 *
 * The table above is the 18-byte form — the same nine runs as `CIRCLE_DATA[3]`, which is the record
 * shape this one belongs to. It is not a guess about the data: with it, the coverage curve is 32, 60,
 * 108, 146, 180, 216, 254, 300, 328, 360 of 360 — monotonic, and full on the last step, which is the
 * only reading under which the last wipe frame is a black screen for the page change to cut out of.
 * It is also the only reading under which the REVEAL opens correctly: the reveal's first frame is
 * snapshot 9, so a snapshot 9 with a hole in it opens the reveal on a partially drawn screen, and
 * the same measurement that put the black on the cut puts it at the top of the reopen.
 *
 * The `guard` and the undefined checks in `paintRecord` are therefore not defensive noise, and they
 * are not going to be argued away in a later cleanup. They are the reason a future edit to any of
 * these five arrays costs a missing transition instead of a hung tab or a page stuck under an
 * invisible overlay — see the `try` around `buildSteps` for where those throws are caught and what
 * the visitor gets instead.
 */

/**
 * The two half-circles, ten records each, walking the same boundary in opposite senses and therefore
 * advancing in lockstep: record N of one is always the same radial band as record N of the other.
 *
 * Each record is [quadrantX, dataId, targetCol, targetRow], which is FIVE bytes in the ROM and
 * four fields here: the macro emits one direction byte, a two-byte data pointer and a two-byte
 * target coordinate, so the two pointer words are flattened into the two columns above. The
 * vertical direction is NOT among them - see paintRecord, which is where that byte comes from.
 *
 * Read down the dataId column - 1, 2, 3, 4, 5, 5, 4, 3, 2, 1 - and it is a palindrome, which is what a
 * half-circle traversal looks like: the records walk in to the longest run and back out again. The
 * targets trace one continuous boundary, from the right middle edge up and over the top to the left
 * middle edge. Both halves carry the same ten bands, which is why they advance in lockstep — and
 * which is also why one array of ten snapshots serves the close and the reveal unchanged.
 *
 * quadrantX is the only direction byte in the record: 1 runs the pointer right (inc hl), 0 runs it
 * left (dec hl).
 */
const HALF_CIRCLE_1: number[][] = [
  [1, 1, 18, 6], [1, 2, 19, 3], [1, 3, 18, 0], [1, 4, 14, 0], [1, 5, 10, 0],
  [0, 5, 9, 0], [0, 4, 5, 0], [0, 3, 1, 0], [0, 2, 0, 3], [0, 1, 1, 6],
];
const HALF_CIRCLE_2: number[][] = [
  [0, 1, 1, 11], [0, 2, 0, 14], [0, 3, 1, 17], [0, 4, 5, 17], [0, 5, 9, 17],
  [1, 5, 10, 17], [1, 4, 14, 17], [1, 3, 18, 17], [1, 2, 19, 14], [1, 1, 18, 11],
];

/**
 * Indexing a plain array returns `number` under this tsconfig (`noUncheckedIndexedAccess` is off),
 * which would make the "did we walk off the end" checks below a type error and, worse, would let
 * `tsc` delete the reason they exist. Going through this helper is what puts the value back to
 * `number | undefined` so the checks are both legal and load-bearing.
 */
const at = (data: number[], i: number): number | undefined => data[i];

/**
 * One record of one half-circle, painted into `black`.
 *
 * `hl` is a linear cell index (`col + row * COLS`), which is how the ROM addresses it, and `dx`/`dy`
 * are the two directions the pointer can move in. `dy` is one ROW, always — a record walks a
 * contiguous band of rows, and the record's own run count is how many of them there are.
 */
function paintRecord(
  black: Uint8Array,
  quadrantX: number,
  quadrantY: number,
  dataId: number,
  tx: number,
  ty: number
) {
  const data = CIRCLE_DATA[dataId];
  if (!data) throw new Error("no such CircleData record: " + dataId);

  let di = 0;
  let hl = tx + ty * COLS;
  const dx = quadrantX ? 1 : -1; // RIGHT -> inc hl, LEFT -> dec hl
  /*
   * THE VERTICAL DIRECTION IS NOT IN THE RECORD, which is the one thing in this file that has to be
   * right and the one thing that is easiest to get plausibly wrong.
   *
   * The record carries a horizontal direction byte and nothing else. The vertical one lives in
   * wBattleTransitionCircleScreenQuadrantY, which the CALLER sets in the accumulator before the
   * call (BattleTransition_DoubleCircle does xor-a ahead of the first half-circle and ld-a-1 ahead
   * of the second) and which Circle_Sub3 reads back to choose the row stride. So it is per
   * HALF-CIRCLE, not per-record: the first half walks its runs down a row, the second walks them up.
   *
   * There is a reading of these tables that needs no flag at all, and it was tried here first:
   * infer the direction from the record's own target row, above the midline down and below it up. On
   * THIS data it is exactly equivalent - every first-half target row is below 9 and every second-half
   * target row is above it, so all twenty records agree with the flag and the two produce
   * byte-identical grids. It was dropped anyway, and the reason is the point: that equivalence is a
   * property of these twenty rows, not a rule. Edit one target row and the inferred form diverges
   * from the hardware while still looking reasonable, and a flag cannot.
   *
   * The dead end that DID fail, and the reason this is threaded through as its own argument rather
   * than inferred: driving both axes off the single quadrantX byte. That covers 246 of 360 and
   * stops, leaving a band of uncovered page straight down the middle of the screen at the exact
   * moment the transition is supposed to have finished. Never ship a transition that ends on a hole —
   * and on a transition that reopens, a hole is worse: it is a hole at the top of the reveal too,
   * where it would sit in the middle of the deck for a third of a second.
   *
   * The shape this produces is measured, not asserted: 32, 60, 108, 146, 180, 216, 254, 300, 328,
   * 360 of 360 - monotonic, and full on the last step. Two wedges opening out of the centre and
   * meeting on the midline, which is the DoubleCircle.
   */
  const dy = quadrantY ? -COLS : COLS;

  let guard = 0;
  for (;;) {
    // See the note above the table. 64 is far more iterations than the longest record here (9), so
    // it can only trip on a table that has been edited into something the reader cannot walk.
    if (++guard > 64) throw new Error("run-length data overrun");

    const rowStart = hl;
    const run = at(data, di);
    if (run === undefined) throw new Error("past end of CircleData" + dataId);
    di++;
    for (let i = 0; i < run; i++) {
      // Out-of-range writes are dropped, not clamped: a wedge that runs off an edge is the ROM's
      // own behaviour on a grid the shape was not drawn for, and the visible result is identical.
      if (hl >= 0 && hl < CELLS) black[hl] = 1;
      hl += dx;
    }

    hl = rowStart + dy;
    const v = at(data, di);
    if (v === undefined) throw new Error("missing terminator in CircleData" + dataId);
    di++;
    if (v === -1) return;
    if (v === 0) continue;
    for (let i = 0; i < v; i++) hl -= dx;
  }
}

/**
 * The ten steps, precomputed once, before the overlay exists.
 *
 * Each entry is a CUMULATIVE snapshot: step N already contains steps 0..N. The transition paints a
 * shape that only ever grows, so redrawing from a snapshot is both cheaper and more honest than
 * re-walking the run-length tables every frame — and, more to the point, it is the only version
 * where frame N is guaranteed to be the same pixels as the measurement of step N.
 *
 * Precomputed rather than drawn on demand so that a resize mid-flight cannot change the geometry
 * under the user's eyes. The transition is under a second and a half; a wipe that reshaped itself
 * half way through would be worse than one that was a little off at the edges, and the caller does
 * not listen for resize anyway. It is also computed BEFORE the overlay is appended, which is one
 * better than the old component's order: the throw path below then costs the visitor nothing at all
 * — no node in the document, no frame painted, no promise waiting on a loop that will never run —
 * instead of mounting a canvas and tearing it back down.
 */

    /**
     * THE FOUR WIPES, and why the choice is random.
     *
     * All four are ports of BattleTransition_* from pret/pokered, and all four are painted by the
     * same paintRecord and the same cumulative-snapshot machinery. The first three are three
     * traversals of one idea and the fourth is that idea with no table at all; what differs is only
     * how many records the ROM walks and how long it pauses between them.
     *
     *   doublecircle  10 records x 3f =  30f   %000  wild, non-dungeon, enemy not stronger
     *   circle        20 records x 3f =  60f   %010  wild, non-dungeon, enemy 3+ levels stronger
     *   hstripes      20 steps   x 3f =  60f   %100  wild, dungeon
     *   spiral-in     52 steps   x 3f = 156f   %001  trainer, non-dungeon
     *
     * RANDOM PER PRESS, and the reason is not variety for its own sake. Four wipes of very different
     * lengths and shapes, seen once each, cannot be compared: a visitor who draws the 156-frame spiral
     * once concludes the transition is slow, and a visitor who draws the 30-frame DoubleCircle once
     * concludes it is punchy. Randomising says neither, and it is the more honest model of the
     * product anyway - these are four renderings of the same encounter and none of them is canonical,
     * so picking arbitrarily is truer than pretending the grass encounter has one fixed animation.
     *
     * Note what is NOT here: a declared step count. The frame budget is derived from what each
     * builder actually returns, because a hand-written 10 here would be a second source of truth
     * about a table that already has one, and the two would drift the first time a data edit landed.
     */
    type VariantId = "doublecircle" | "circle" | "hstripes" | "spiral-in";

    type Variant = {
      id: VariantId;
      label: string;
      /** The ROM's own pause between records. Every variant here is three frames; the spiral's is three too. */
      framesPerStep: number;
      build: () => Uint8Array[];
    };

    const VARIANTS: Variant[] = [
      {
        id: "doublecircle",
        label: "DoubleCircle",
        framesPerStep: 3,
        build: () => {
          const black = new Uint8Array(CELLS);
          const steps: Uint8Array[] = [];
          for (let s = 0; s < 10; s++) {
            // The index IS the quadrant-Y flag: 0 for the first half-circle, 1 for the second, which is
            // what the ROM's xor-a / ld-a-1 amounts to. Both halves step in the same iteration because
            // record N of one is the same radial band as record N of the other.
            for (const [halfIndex, half] of [HALF_CIRCLE_1, HALF_CIRCLE_2].entries()) {
              const r = half[s];
              paintRecord(black, r[0], halfIndex, r[1], r[2], r[3]);
            }
            steps.push(black.slice());
          }
          return steps;
        },
      },
      {
        id: "circle",
        label: "Circle",
        framesPerStep: 3,
        build: () => {
          // Same tables, opposite traversal. BattleTransition_Circle plays the two half-circles
          // SEQUENTIALLY where DoubleCircle plays them in lockstep, so it is one full circle instead
          // of two, and it takes twice as many records to get there. Its tell is in the coverage
          // curve: 16, 30, 54 ... 180 ... 360, sitting near exactly half for ten straight records
          // while the second half-circle plays. That long unbalanced sweep is the whole effect.
          const black = new Uint8Array(CELLS);
          const steps: Uint8Array[] = [];
          for (const [halfIndex, half] of [HALF_CIRCLE_1, HALF_CIRCLE_2].entries()) {
            for (let s = 0; s < 10; s++) {
              const r = half[s];
              paintRecord(black, r[0], halfIndex, r[1], r[2], r[3]);
              steps.push(black.slice());
            }
          }
          return steps;
        },
      },
      {
        id: "hstripes",
        label: "HorizontalStripes",
        framesPerStep: 3,
        build: () => {
          // The literal black-bar curtain. Two columns march inward from the left and right edges
          // together: the left pointer fills every other tile ROW and the right pointer the
          // interleaved rows, so the bars interleave rather than meet. BattleTransition_
          // HorizontalStripes_ paints nine tiles at stride SCREEN_WIDTH*2 - every other row - from
          // hlcoord 0,0 walking right and decoord 19,1 walking left, twenty times.
          const black = new Uint8Array(CELLS);
          const steps: Uint8Array[] = [];
          for (let s = 0; s < COLS; s++) {
            for (let k = 0; k < ROWS / 2; k++) {
              black[(k * 2) * COLS + s] = 1;
              black[(k * 2 + 1) * COLS + (COLS - 1 - s)] = 1;
            }
            steps.push(black.slice());
          }
          return steps;
        },
      },
      {
        id: "spiral-in",
        label: "Spiral (inward)",
        framesPerStep: 3,
        build: () => {
          // BattleTransition_InwardSpiral: a rectangular ring at a time, walked exactly as the
          // assembly does - down a column, right a row, up a column, left a row, each ring two tiles
          // tighter than the last.
          //
          // TWO THINGS THAT ARE EASY TO GET WRONG, both of which produce a shape that looks almost
          // right and is not. First, jr .skip: the loop body's down-a-column leg is skipped on the
          // first pass only, and running it on every pass walks hl off the bottom of the map and
          // stalls the whole thing at 18 cells. Second, the pacing is not a fixed step at all -
          // InwardSpiral_ carries a counter starting at 7 and calls TransferDelay3 whenever it hits
          // zero, so a frame happens every EIGHTH cell painted. One snapshot per delay is the
          // faithful unit, which is why this is 52 steps and not 9.
          const black = new Uint8Array(CELLS);
          const steps: Uint8Array[] = [];
          let hl = 0;
          let c = ROWS - 1;
          let counter = 7;
          let guard = 0;
          const paint = (count: number, stride: number) => {
            for (let i = 0; i < count; i++) {
              if (++guard > 40000) throw new Error("InwardSpiral walk did not terminate");
              if (hl >= 0 && hl < CELLS) black[hl] = 1;
              hl += stride;
              if (--counter === 0) {
                counter = 7;
                steps.push(black.slice());
              }
            }
          };
          paint(c, COLS);
          c += 1;
          let firstPass = true;
          for (;;) {
            if (!firstPass) paint(c, COLS);
            firstPass = false;
            c += 1;
            paint(c, 1);
            c -= 2;
            paint(c, -COLS);
            c += 1;
            paint(c, -1);
            c -= 2;
            if (c === 0) break;
          }
          // The ROM leaves the centre tile unpainted, because every caller follows the walk with
          // BattleTransition_BlackScreen (ld a,$ff / ldh [rBGP],a) which blacks the whole screen and
          // takes that cell with it. This module has no such caller, so it is painted here; without
          // it the shape ends at 359 of 360.
          if (hl >= 0 && hl < CELLS) black[hl] = 1;
          steps.push(black.slice());
          return steps;
        },
      },
    ];


/**
 * The whole transition, and it is a single call because a single call is the whole point.
 *
 * `swap` is the page change. It runs in the middle, on the last frame of the close, when the
 * screen is fully black — so the visitor never sees the cut — and the reveal then plays over
 * whatever `swap` put on screen.
 *
 * WHY THE OVERLAY SURVIVES THE ROUTE CHANGE, since that is the whole reason this stopped being a
 * component: the overlay is appended to `document.body` and is owned by this module's closure, not
 * by any React tree. `navigate("/roast/deck")` unmounts RoastEnter, but there is nothing in
 * RoastEnter's tree to unmount — the old `<RoastWipe>` element and the `wiping` render that
 * produced it are both gone from the file. React's reconciler can only remove nodes that are
 * reachable from its roots, and this one is not: it is a child of `document.body`, above the
 * `#root` div. The only code that can remove it is the `finished` path in `tick` below, which runs
 * off the `requestAnimationFrame` handle and has no dependency on any component being mounted.
 *
 * THE PROMISSE ALWAYS RESOLVES, and never rejects. The caller fires it with `void` and nothing
 * renders from it, so a rejection would be an unhandled rejection with no handler and, worse, a
 * transition that silently gave up — the visitor would be left either on the entry page with a
 * full-screen overlay on top of them, or on the deck with no transition and no way to know it was
 * meant to be there. Both failure modes are worse than showing nothing at all, which is why every
 * path below ends in either `swap()` or a resolved promise, and the two of them together.
 *
 * The reduced-motion path is here because this is the thing being opted out of, and the caller
 * checks as well (see RoastEnter.tsx). Belt and braces, same as it always was: the caller's check
 * is what keeps it from awaiting an animation that will not run, and this one is what keeps a
 * direct caller from getting one. Under reduced motion this creates NO overlay at all — not one
 * that is painted and immediately torn down — because the failure mode of that is a frame of black
 * over a live page, which is a flash, which is the one thing the setting asked not to see.
 */
    export async function playRoastWipe(swap: () => void, pick?: VariantId): Promise<void> {
  // Nothing below can throw out of this function. `resolve` is captured up front so that every
  // early return can take the same exit, and `safeSwap` is the only way `swap` is ever called.
  await new Promise<void>((resolve) => {
    let raf = 0;
    let finished = false;
    let swapped = false;
    let overlay: HTMLDivElement | null = null;

    /**
     * The one exit. Everything that ends the transition goes through here, so the overlay cannot
     * be left in the document and the promise cannot settle twice.
     *
     * `finished` is checked first, which is what makes it exactly-once: the completion path fires
     * from the frame counter, the catch path fires from a throw, and a throw can happen on the same
     * frame that completes the table.
     */
    const settle = () => {
      if (finished) return;
      finished = true;
      // Cancel the handle before removing the node, so a tick that is already queued cannot paint
      // into a canvas that is no longer in the document.
      cancelAnimationFrame(raf);
      overlay?.remove();
      resolve();
    };

    /**
     * The page change, called at most once, and never allowed to take the transition down with it.
     * `navigate` cannot throw in any real sense, but the cost of being wrong here is a visitor who
     * never reaches the deck, and the caller has already written their name by this point — a thrown
     * navigation is not worth losing the page over.
     */
    const runSwap = () => {
      if (swapped) return;
      swapped = true;
      try {
        swap();
      } catch {
        // Nothing useful to do. The overlay is still on screen and still resolves below.
      }
    };

    /** The no-transition case, for every path that cannot run the animation. Never leaves a node. */
    const bail = () => {
      runSwap();
      settle();
    };

    // Belt and braces with the caller, which already skips the wipe entirely under reduced motion.
    // A caller that is told to animate on a machine that asked not to be shown animation must still
    // do the one thing the transition is for: arrive. This is the FIRST check and not the last
    // because "immediately" is the point — it must not wait on a table walk, and it must not have
    // created a node it then has to tear down.
    if (prefersReducedMotion()) {
      bail();
      return;
    }

    /*
     * THE MALFORMED-TABLE CASE IS A THROW, and it is caught here rather than left to propagate.
     *
     * `buildSteps` is the only thing that walks the run-length tables, so every guard in the painter
     * fires inside this one call. In the component version of this file that mattered because a
     * throw out of an effect is not a recoverable event in React — it unmounts the whole tree, which
     * would cost the visitor their place in the roast AND lose the name they just typed, over a
     * typo in a table that ships as constants. Nothing has thrown out of an effect for a while now
     * (there is no effect), but the argument is unchanged and so is the fallback: degrade to the
     * no-transition case by calling `swap` and resolving, rather than to nothing at all.
     */
        // PICKED HERE, ONCE, BEFORE ANYTHING IS PAINTED. The choice is not a property of the session
        // and nothing reads it back, so it is not persisted: persisting it would make the wipe
        // predictable across a reload for no benefit. `pick` is an override for a caller that wants
        // one specific variant, so the wipe can be pinned in a test without a seed.
        // PICKED HERE, ONCE, BEFORE ANYTHING IS PAINTED. The choice is not a property of the session
        // and nothing reads it back, so it is not persisted: persisting it would make the wipe
        // predictable across a reload for no benefit. `pick` is an override for a caller that wants
        // one specific variant, so the wipe can be pinned in a test without a seed.
        //
        // Resolved THROUGH the table rather than trusted, so a stale id from a caller falls back to
        // the first variant instead of reading a property off a string.
        const variant =
          (pick ? VARIANTS.find((v) => v.id === pick) : undefined) ??
          VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
        let steps: Uint8Array[];
        try {
          steps = variant.build();
        } catch {
          bail();
          return;
        }
        /*
         * The frame budget, DERIVED rather than declared. `steps.length` is what the builder actually
         * produced, so a variant cannot disagree with itself about how long it is - which is exactly
         * the failure a hand-written `steps: 10` in the table below would invite.
         */
        const closeFrames = steps.length * variant.framesPerStep;
        const swapFrame = FLASH_FRAMES + closeFrames;
        const totalFrames = swapFrame + REVEAL_FRAMES + CLEAR_FRAMES;

    // Built the long way round for the same reason `buildSteps` runs first: every check that can
    // fail without painting anything happens before the overlay exists, so the only way an overlay
    // is in the document is if it is going to be painted. The `aria-hidden` is because the canvas
    // has nothing to say: it is a picture of a wipe, it holds no text, no focusable content and no
    // state a screen reader can report. Announcing it would be inventing a role the element does
    // not have. The click-swallowing is CSS — see roastWipe.css.
    const root = document.createElement("div");
    root.className = "roast-wipe";
    root.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    canvas.className = "roast-wipe__canvas";
    root.appendChild(canvas);
    document.body.appendChild(root);
    overlay = root;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // No 2D context: the canvas cannot be half-drawn, and a stuck invisible overlay over a live
      // page is the worst possible failure. Go straight to the destination instead.
      bail();
      return;
    }

    /*
     * THE BACKING STORE IS IN DEVICE PIXELS AND THE MATH IS DONE IN DEVICE PIXELS.
     *
     * Sizing the canvas to CSS pixels and letting the context scale it puts a fractional edge on
     * every rectangle, and adjacent cells of a tile wipe share edges: a hairline of page shows
     * through every one of them on a high-DPI screen, which is the one artefact that would make this
     * look like a bug rather than like a transition. So the transform is left at identity and every
     * coordinate below is rounded once, in the pixel grid that is actually going to be painted.
     */
    // Clamped at 3 rather than taken raw. A wipe is a black shape with one curved edge; there is no
    // detail in it for a fourth device pixel to carry, and the canvas is repainted 87 times in about
    // a second and a half, so the fill rate is the one number here worth spending less on. (The
    // count was 102 when this table was longer; the clamp was never about the frame count, it is
    // about edge quality.)
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const W = Math.max(1, Math.round(vw * dpr));
    const H = Math.max(1, Math.round(vh * dpr));
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";

    /**
     * Paint one step of the circle, filling whatever it covers. Used by the close AND the reveal,
     * which is why it takes the snapshot rather than an index: the two phases differ in which
     * snapshot they hand it and in nothing else.
     *
     * THE GRID IS STRETCHED, NOT RE-TILED — and this is the second decision this port had to make
     * against the plan. The plan asked for a square-cell grid sized to the viewport, with the 20x18
     * shape scaled into it by lengthening run lengths by `sx` and the row step by `sy`. That was built
     * and measured at ten viewport sizes, and it does not close the screen in any of them: 80.2% of
     * the cells at 1280x720, 72.9% at 1440x900, 65.7% at 1920x1080, 44.7% on a 390x844 phone, and it
     * cannot reach 100% at any size, because an integer row step multiplied by `sy` is a fraction of
     * a row and the shape falls between two bands. The failure is not subtle — it is a margin the
     * width of several cells along the screen's edges, at the exact moment the transition is
     * supposed to have finished.
     *
     * So the shape is computed once, at the resolution it was authored at, and each of its 360
     * cells is then drawn as a rectangle of the viewport proportional to it. On the DMG that is
     * 8x8-pixel cells; on a 1440x900 screen it is 72x50. The circle becomes the ellipse the screen's
     * aspect ratio asks for, which is what a circle drawn to cover a screen that is not 20:18 is
     * supposed to look like, and the granularity stays fixed as a FRACTION of the screen — one cell is
     * always 1/20th of the width and 1/18th of the height, exactly as it was on the hardware. The
     * square-cell alternative was not finer, only more distorted: it bought a square edge by
     * stretching the horizontal runs by up to 2.2x and still left the screen uncovered.
     *
     * Rows are run-lengthed before they are drawn. Twenty rects per row instead of one per cell is
     * both fewer draw calls and, more usefully, no shared interior edges to seam.
     */
    const paintStep = (step: Uint8Array) => {
      for (let y = 0; y < ROWS; y++) {
        const y0 = Math.round((y * H) / ROWS);
        const y1 = Math.round(((y + 1) * H) / ROWS);
        const h = Math.max(1, y1 - y0);
        let x = 0;
        while (x < COLS) {
          if (!step[y * COLS + x]) {
            x++;
            continue;
          }
          let end = x;
          while (end + 1 < COLS && step[y * COLS + end + 1]) end++;
          const x0 = Math.round((x * W) / COLS);
          const x1 = Math.round(((end + 1) * W) / COLS);
          // `max(1, ...)` rather than a seam-filler: on a very narrow viewport a cell can round to
          // zero device pixels wide, and dropping it would drop a slice of the wipe.
          ctx.fillRect(x0, y0, Math.max(1, x1 - x0), h);
          x = end + 1;
        }
      }
    };

    let frame = 0;

    const tick = () => {
      if (finished) return;

      /*
       * A THROW INSIDE THIS CALLBACK IS THE ONE FAILURE THE CALLER CANNOT SEE, so it is caught
       * here and turned into the same bail the malformed-table path uses. An exception thrown in a
       * `requestAnimationFrame` callback is not routed through the promise this function returns —
       * the caller `void`s it — so the sequence would simply stop mid-wipe: promise never settled,
       * overlay never removed, and if the throw happened before the swap the visitor would be
       * stranded on the entry page behind a dead full-screen canvas. The painter cannot throw on
       * precomputed snapshots, so this is not expected to fire; it costs one try and it is the
       * difference between "the animation did not run" and "the app is stuck".
       */
      try {
        ctx.clearRect(0, 0, W, H);

        // The page change, on the last frame of the close and under a full black screen. It runs
        // BEFORE the first reveal frame is painted, and the first reveal frame is snapshot 9 — a
        // full black screen, the same pixels as the frame before it — so the swap frame is free
        // visually even though the new page is not committed to the DOM until React gets a task
        // of its own after this callback returns. From the second reveal frame the deck is
        // mounted and what the wipe opens onto is the destination.
            if (frame === swapFrame) runSwap();

        if (frame < FLASH_FRAMES) {
          // Six steps, four frames each, one pass, black only. Clamped rather than trusted so a
          // future edit to the table length cannot walk off it.
          const step = Math.min(FLASH_STEPS.length - 1, Math.floor(frame / FLASH_FRAMES_PER_STEP));
          const alpha = FLASH_STEPS[step];
          if (alpha > 0) {
            ctx.fillStyle = "rgba(0,0,0," + alpha + ")";
            ctx.fillRect(0, 0, W, H);
          }
            } else if (frame < swapFrame) {
              // The close: this variant's cumulative snapshots, forwards, at its own tempo.
              const local = frame - FLASH_FRAMES;
              // Clamped rather than trusted, so a variant whose builder returns fewer steps than its
              // frame budget assumes repeats the last step instead of reading past the table.
              const step = Math.min(
                steps.length - 1,
                Math.max(0, Math.floor(local / variant.framesPerStep))
              );
              ctx.fillStyle = "#000";
              paintStep(steps[step]);
            } else if (frame < swapFrame + REVEAL_FRAMES) {
              // The reveal: THE SAME SNAPSHOTS, BACKWARDS, and CAPPED at REVEAL_FRAMES regardless of
              // how long the close took - see that constant for why. The mapping is written over
              // (REVEAL_FRAMES - 1) rather than per-step so the LAST reveal frame is always step 0,
              // which is the frame the clear phase exists to leave behind. Dividing by the step count
              // instead would leave a long variant stranded on step 1 and pop the rest of it.
              const local = frame - swapFrame;
              const step = Math.max(
                0,
                steps.length - 1 - Math.round((local * (steps.length - 1)) / (REVEAL_FRAMES - 1))
              );
              ctx.fillStyle = "#000";
              paintStep(steps[step]);
            }
        // Else: the clear phase. Nothing is painted, and that is the point — see CLEAR_FRAMES.

        frame += 1;
            if (frame >= totalFrames) {
          // The frame after the last one, so the final painted frame is the last frame of the
          // clear phase rather than a stray partial. `settle` is what makes the completion path
          // run exactly once: see the note on it above.
          settle();
          return;
        }
        raf = requestAnimationFrame(tick);
      } catch {
        bail();
      }
    };

    raf = requestAnimationFrame(tick);

    /*
     * There is no cleanup function and no teardown from outside, which is the one thing that
     * changed shape with the move out of React and is worth being explicit about. The old component
     * returned a disposer so a re-mount could cancel the loop; here the only thing that can cancel
     * it is `settle`, and the only thing that can call `settle` is this loop, so the loop ends when
     * the loop ends. There is no window listener, no observer, no timer and no resize handler,
     * because there is nothing here that needs to know about anything outside its own frame — which
     * is the same reason there was nothing to clean up before.
     *
     * The one caller that can still walk away is the one that fires and forgets: if the visitor hits
     * back, or the tab is closed, the overlay is destroyed with the document, and the pending rAF
     * goes with it. There is no path in which this module holds a canvas that is not in a document
     * for longer than the sequence itself.
     */
  });
}