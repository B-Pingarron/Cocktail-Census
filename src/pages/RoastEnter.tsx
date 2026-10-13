import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { prefersReducedMotion } from "@/lib/motion";
import MenuCard from "@/components/MenuCard";
import MartiniMark from "@/components/MartiniMark";
import { playRoastWipe } from "@/lib/roastWipe";
import "@/roast-enter.css";

/**
 * The roast's threshold — what the room says before it lets you in.
 *
 * NO FORM, AND THAT IS THE REDESIGN (2026-10-06).
 *   This page used to ask for a name before the visitor had seen anything at all. The name now lives
 *   on the menu, where it is displayed — the form and the display became one thing, and what is left
 *   here is the brief: what the room is, in the room's own voice, and one door.
 *
 *   It keeps the LOUNGE'S LANGUAGE on purpose — dark, gold, serif, the same card every other page of
 *   the menu is. This is the last moment before the arena; the wipe is the crossing and the menu's
 *   sunset is what is on the other side. The contrast between the two surfaces IS the change of scene,
 *   which is why this page must not borrow the arena's colours.
 *
 * WIRED 2026-10-12 — THE SEVENTH AND LAST ROOM. roast-enter.css carried only the lede's glitch and
 *   the room around it was Tailwind utilities: `bg-gold`, `rounded-full`, `w-full`, `hover:opacity-90`
 *   and a `<div className="grain" />`. That is the PRE-STUDY treatment, not the lounge's language —
 *   so the app was rendering neither the approved design (roast-enter.html) nor a coherent
 *   alternative. This file now renders the approved design. The vocabulary and the measurements live
 *   in roast-enter.css; what changed HERE is four things:
 *
 *     1. THE ROOT carries `roast roast-enter`, the family convention the other six rooms follow. It
 *        also joins the root to `.roast` (roast.css) — which is where the shared tokens live — with
 *        one deliberate override: `.roast.roast-enter` keeps the app's own page ground rather than
 *        the arena's `--ink` floor. The lounge is a different universe (constitution §7, law 3).
 *     2. THE HALFTONE REPLACED THE GRAIN. `<div className="grain" />` is gone from this page; the
 *        study's gold monochrome dot field took its place as the card's ground. The study's header
 *        records the ruling: his note assigns grain here AND assigns halftone to grounds, both point
 *        here, so one-texture-per-element breaks the tie and the VISIBLE layer stays. The page had
 *        been shipping the layer the study deleted and omitting the one it kept.
 *     3. THE DOOR IS THE STUDY'S. It was `hover:opacity-90`, which LOWERS the ink's contrast at the
 *        moment the visitor is closest to it — a fade on a fill drags the ink toward the ground. The
 *        study's door inverts both sides of the pair instead, so no state can fall.
 *     4. THE BUSY STATE EXISTS NOW, and it is the half of this pass that is behaviour rather than
 *        paint. `enter()` has always set `wiping`; nothing rendered from it, so while playRoastWipe
 *        covered the screen for ~1.5s the door was a DEAD PRESS. It now carries `aria-busy` and says
 *        "Lighting the grill" for exactly that window.
 *
 * WHAT WAS NOT CHANGED, and each for a reason:
 *   · `<MenuCard>` stays. It is the shared lounge surface — its own header says the same card is what
 *     makes the hub and the Census one object rather than two products. The study is full-bleed
 *     because a standalone study has no app around it; its §11 maps `.lounge / .ask → MenuCard`.
 *   · `<MartiniMark>` stays, at its own 40px. The study draws the mark in CSS so it could add no
 *     asset; here the shared component does that job, and its header says one mark is what keeps the
 *     pages one product. The study drew it that way for a reason it did not have.
 *   · The `back` link is untouched. It is a working control with no defect behind it, and this pass
 *     was not asked to restyle it — so its Tailwind treatment is left beside the room's CSS rather
 *     than quietly rewritten. Named in roast-enter.css too, so it does not read as an oversight.
 *   · `space-y-6` came OFF the card. The halftone field is now the card's first child, and Tailwind's
 *     `space-y-*` puts a top margin on every child but the first — so keeping it would have shifted
 *     the mark down by 1.5rem the moment the field moved inside. The study's own spacing (32px under
 *     the mark, 14px under the lede, 36px above the door) is what the room uses instead, and it is
 *     declared in roast-enter.css rather than split across two systems.
 *
 * THE GLITCH IS THE ANTICIPATION, and it is small on purpose: one line of type, cutting. What it is,
 * what it deliberately is not, and what is parked for a revision all live in roast-enter.css. This
 * pass fixed one thing in it: the dark chroma plate was a hardcoded #7a6530 while the approved study
 * derives it from the palette — a drift of the kind a wiring pass exists to remove.
 *
 * THE COPY IS PICKED (2026-10-12). Four options were drafted for this page
 * (01_BarNerd/docs/design/roast/menu/intro-menu-v3.html); this is option B, and the pick is recorded
 * rather than left as a caption. Option A ("You're going to roast them. They're going to roast you
 * back." / "The first rule of the Roast is simple: no mercy.") is retired, and the author's own lines
 * from the page this replaced — "ROAST is the arena where specs get measured…" and "My specs, your
 * taste. No mercy." — stay in the design doc §1 as the seed they always were.
 *
 * The pick changed the page's shape, not just its words: A stated the premise twice and put the rule
 * third, B states the rule first and makes the third line the joke that closes it ("there is no
 * second rule"). So the h1 still carries the visitor's own line, the middle line is now the room's
 * RULE rather than its description, and the last line is the rule's own deflation — which is the
 * tone the rest of the room has.
 *
 * THE DOOR'S LABEL IS PICKED TOO: "get roastin'". Retired: "join the roast" and "Light the grill".
 * The busy label — "Lighting the grill" — is the study's, and it is a different thing: not a label
 * for the door but a statement of what the door is doing. That is why the retired alternative can
 * now appear INSIDE the control without contradicting the pick.
 */
const RoastEnter = () => {
  const navigate = useNavigate();

  /*
   * THE WIPE, and why it is started here rather than at the router.
   *
   *   A page change in this product is a page of the menu arriving, and that already belongs to
   *   MenuCard, which turns itself in on mount. This is a different gesture: ONE deliberate press, the
   *   single action on this page, arriving at a loud card. A router-level wrapper could only have
   *   expressed it as "every route change" — including the ones where it would be wrong.
   *
   *   The router-level version was written and cut twice. The reason is not taste: a sheet laid over a
   *   route change freezes a blank full-screen rectangle for the length of the turn, and a blank
   *   rectangle during a page change reads as LOADING. Here it covers a page that is deliberately
   *   being left, once. And the black it ends on is the black the menu opens ON, not the black it
   *   opens after — the wipe closes, changes the page underneath itself while it is fully closed, and
   *   then reopens. So there is no frame anywhere in the sequence a visitor could read as a stall.
   *
   *   WHICH IS WHY THE OVERLAY IS NOT PART OF THIS TREE. A wipe that reopens has to still be on screen
   *   after the navigation, and a component mounted here is unmounted by exactly that navigation. So
   *   the overlay is appended to `document.body` by a plain module (lib/roastWipe.ts) and outlives the
   *   route change by construction. This page hands the transition the page change to make; it does
   *   not render it.
   *
   *   The destination is `/roast` — the menu — and not the deck. A visitor who has just been told what
   *   the room is deserves to be shown the room rather than dropped into a card.
   */
  const [wiping, setWiping] = useState(false);

  /*
   * THE GUARD, and the reduced-motion path.
   *
   *   The wipe's canvas covers the screen for about a second and a half and takes pointer events, so in
   *   practice a second press cannot reach this page. But the canvas is the mitigation for the click,
   *   and the click is not the only way here: a keyboard on the button, a script, or a stylesheet that
   *   failed to load all arrive at this handler directly. If `wiping` is true the intent has already
   *   been acted on, and acting on it twice would run a second transition and push a history entry the
   *   visitor never made. The cheapest check that cannot be wrong.
   *
   *   `wiping` is purely a latch: set once and never cleared, because the page it belongs to is
   *   unmounted about a second and a half later by the navigation the transition makes itself. It
   *   stays state rather than becoming a ref because a ref is not a latch a render can see — and since
   *   this pass it is ALSO what the button renders from, which a ref could not drive at all.
   *
   *   Under reduced motion the effect being opted out of is the wipe itself, and holding the page for a
   *   second and a half with nothing on it is a stall rather than a transition. So the reduced path is
   *   a plain navigate and `wiping` is never set at all — not set and then immediately cleared, which
   *   would be the same stall with a wasted render attached. The BUSY STATE IS THEREFORE SKIPPED
   *   RATHER THAN SHORTENED: there is no wipe for it to stand in for, so announcing one would be the
   *   lie the study's header also refuses. `playRoastWipe` checks the setting itself too and returns
   *   without creating an overlay; the check is repeated here because this one is what stops the page
   *   starting a transition that will not run.
   */
  const enter = () => {
    if (wiping) return;
    if (prefersReducedMotion()) {
      navigate("/roast");
      return;
    }
    setWiping(true);
    // Fire-and-forget, deliberately. Nothing on this page renders from the resolution — the page change
    // is made BY the transition, mid-sequence, not by this promise — so there is nothing to await and
    // nothing to store. The `void` says so out loud, because a floating promise that cannot reject
    // (see lib/roastWipe.ts) is otherwise the first thing a reviewer would ask about.
    void playRoastWipe(() => navigate("/roast"));
  };

  return (
    <div className="roast roast-enter relative flex min-h-screen items-center justify-center overflow-x-clip px-6 py-12">
      {/*
        * THE CARD IS THE ROOM. `aria-labelledby` points at the h1, so the region announces itself by
        * the line it opens on rather than as an unnamed section. `space-y-6` is off — see the header;
        * the spacing is the study's and lives in roast-enter.css.
        */}
      <MenuCard className="ask mx-auto w-full max-w-md" aria-labelledby="enter-lede">
        {/*
          * ONE texture on this ground: the gold monochrome halftone, absolutely positioned behind the
          * content. It replaced `<div className="grain" />` from index.css — the layer the approved
          * study deleted from this page and the reason it shipped the wrong texture. The `.grain` rule
          * itself is untouched; six other lounge pages still render it.
        */}
        <div className="field f-dots" aria-hidden="true" />

        <MartiniMark className="mark" />

        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center font-body text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-gold"
        >
          back
        </Link>

        {/*
          * THE BRIEF. Three lines and no question: the page used to open on "What should we call you?"
          * at 24px, which made the form the largest thing on it and the subject of the page the
          * smallest. Now the loudest thing is what the room is, and there is nothing to fill in.
          *
          * The lede carries the glitch (`.re-lede`, see roast-enter.css).
          */}
        <div className="copy">
          <h1 className="re-lede" id="enter-lede">Here are my specs.</h1>
          <p className="body">The first rule of the Roast: you do not hold back.</p>
          <p className="ruleline">The second rule: there is no second rule. There's only the grill.</p>
        </div>

        {/*
          * THE DOOR. The study's outlined serif door, not the app's `rounded-full bg-gold`. Three
          * channels carry the busy state, only one of them colour: the empty fill, the dashed edge,
          * and the label — law 5, on a button.
          *
          * `aria-busy={wiping || undefined}` rather than `={wiping}`: React renders a false boolean
          * aria-* value as the STRING "false", and `[aria-busy="false"]` is not `[aria-busy="true"]`,
          * so the stylesheet would not match — but "false" would still sit in the DOM claiming a state
          * the control is not in. `undefined` omits the attribute entirely, which is what "not busy"
          * means here.
          *
          * The label swaps rather than a spinner appears: the button says what it is doing, and the
          * control cannot grow or shift while it does. A `disabled` was considered and rejected — the
          * wipe takes pointer events anyway, and disabling would drop focus off the control for the
          * second and a half a keyboard user is most likely to be waiting on it.
          */}
        <button
          type="button"
          onClick={enter}
          className="door"
          aria-busy={wiping || undefined}
        >
          {wiping ? "Lighting the grill" : "get roastin'"}
        </button>
      </MenuCard>
    </div>
  );
};

export default RoastEnter;
