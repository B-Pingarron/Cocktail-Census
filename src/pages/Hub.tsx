import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CensusIntro from "@/components/CensusIntro";
import LoungeEntry from "@/components/LoungeEntry";
import MartiniMark from "@/components/MartiniMark";
import MenuCard from "@/components/MenuCard";
import { HUB_ENTRIES, HUB_STANDFIRST } from "@/data/hubEntries";
import { getIntroHidden } from "@/lib/intro";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The hub — one menu card, and the faces of it.
 *
 * WHY ONE ROUTE FOR EVERY STATE:
 *   The cover is not a page, it is a door. A history entry between the visitor and the back
 *   button they actually want (out of the site) would be worse than no state at all, and it
 *   would make the cover linkable as if it were a destination. Stage is component state; the
 *   URL stays `/` throughout.
 *
 * THE MECHANIC, WHICH IS THE WHOLE POINT OF THIS FILE:
 *   The face you are on lifts away, pivoting on the card's left edge, and the face you are
 *   going to is already underneath it, being revealed. Two layers, one of them moving. That is
 *   what makes a change read as turning a page rather than as a page load, and it is the reason
 *   this is component state and not a route: a route change unmounts the outgoing page, so there
 *   is only ever one layer, and one layer can only wobble. Three separate attempts to animate a
 *   route change all failed for exactly that reason — a blank sheet read as loading, and a single
 *   card rotating in place read as the menu closing.
 *
 *   Cover -> menu and menu -> intro are therefore the *same* transition, and `goTo` implements it
 *   once. The only asymmetry is that the cover never exists without the menu beneath it, because
 *   the menu is what gives the card its height; the cover is a face laid over it.
 *
 * WHY sessionStorage, NOT localStorage:
 *   "Entered" is a property of this visit, not of this device. A visitor who closed the tab
 *   should still be met by the cover; one who is mid-session and taps a back link should not be
 *   asked to enter again. Read inside try/catch because storage throws when disabled — the cover
 *   is the safe fallback, never a crash.
 *
 * MOTION:
 *   CSS only, no new runtime dependency. `backface-visibility: hidden` matters because the panel
 *   turns *towards* the viewer: its right edge crosses to the front, and the back face is never
 *   painted, so no mirrored page can be exposed. Reduced motion is handled in JS rather than left
 *   to the global duration guard in index.css, because that guard only zeroes durations — a fixed
 *   JS timer would still hold a frozen card for the whole turn and then jump.
 */

const ENTERED_KEY = "barnerd-hub-entered";

/*
 * The turn is two beats, and the numbers are the design.
 *
 * The swing stops at -85deg and never reaches -90deg. At -90deg the panel is exactly edge-on and
 * past it the panel is behind its own plane, showing an unpainted back face — a swing to -108deg
 * spent its last 40% painting no card at all, which is why a screenshot taken mid-turn once showed
 * an empty page. Stopping short of edge-on keeps a real, foreshortened face on screen for the
 * whole arc.
 *
 * The fade is the second beat: the swing lands, the panel fades out, and only then does it unmount.
 * The reveal underneath runs on the swing's clock, never on the fade's, so the arriving face has
 * finished settling before the departing one disappears.
 */
const SWING_MS = 900;
const FADE_MS = 250;
const TOTAL_MS = SWING_MS + FADE_MS;

/** The curve lives in index.css so the card, the shade and anything later share one definition. */
const TURN_EASING = "var(--turn-easing)";

/** The faces of the card, in the order a visitor meets them. */
type Face = "cover" | "menu" | "intro";

/**
 * Per-face layout. Everything structural is shared by MenuCard; only how the face arranges its
 * own content differs. The cover is the one that needs the card's height given to it rather than
 * earned, so it is laid out from the top with the void left below.
 */
const FACE_LAYOUT: Record<Face, string> = {
  cover: "flex flex-col items-center justify-start gap-7 pt-12 pb-8",
  menu: "isolate",
  intro: "isolate",
};

/** Read the "already entered this session" flag. Never throws. */
function readEntered(): boolean {
  try {
    return sessionStorage.getItem(ENTERED_KEY) === "1";
  } catch {
    // Storage unavailable — always start on the cover.
    return false;
  }
}

const Hub = () => {
  const navigate = useNavigate();
  const [face, setFace] = useState<Face>(() => (readEntered() ? "menu" : "cover"));
  const [leaving, setLeaving] = useState<Face | null>(null);
  const [fading, setFading] = useState(false);
  /* Set one frame after `leaving`, so the overlay has a painted 0deg to move away from. */
  const [turning, setTurning] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const baseRef = useRef<HTMLElement>(null);
  
  /*
   * The two layers, derived rather than stored.
   *
   * `beneath` is the face being revealed — the one the visitor is going to. `overlay` is the face
   * on top: the one lifting away during a turn, or the cover sitting closed over the menu while
   * the visitor is still outside.
   */
  const beneath: Face = leaving ? face : face === "cover" ? "menu" : face;
  const overlay: Face | null = leaving ?? (face === "cover" ? "cover" : null);
  /*
   * WHY THE SWING NEEDS A SECOND FRAME:
   *   A CSS transition interpolates between two computed values, and an element that MOUNTS
   *   with its end value already applied has nothing to interpolate from — it simply appears
   *   there. The first version of this turn did exactly that: the probe caught the departing
   *   face sitting at -85deg within 144ms of the click, because the menu had just been mounted
   *   as the overlay with its final transform already on it. Setting `turning` on the next
   *   animation frame gives the browser one painted frame at 0deg to move away from.
   *
   *   This is also why the cover never showed the bug: it is mounted and parked before the turn,
   *   so it always had a starting value.
   */
  useEffect(() => {
    if (!leaving) return;
    const frame = requestAnimationFrame(() => setTurning(true));
    return () => cancelAnimationFrame(frame);
  }, [leaving]);

  /*
   * The two beats, owned by the effect rather than by stored timer ids: leaving the face clears
   * them and unmounting clears them, without either path having to remember to.
   */
  useEffect(() => {
    if (!turning) return;
    const fade = window.setTimeout(() => setFading(true), SWING_MS);
    const done = window.setTimeout(() => {
      setLeaving(null);
      setTurning(false);
      setFading(false);
    }, TOTAL_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [turning]);



  /*
   * Set imperatively: `inert` has no React 18 prop, and the DOM attribute is what does the work.
   * Browsers without support ignore it and the page stays reachable — the card degrades to the
   * earlier behaviour rather than breaking.
   *
   * Held for as long as anything is on top, including during the swing: the overlay is still an
   * opaque face for the whole turn, so what is behind it stays out of reach until it is gone.
   */
  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;
    if (overlay) base.setAttribute("inert", "");
    else base.removeAttribute("inert");
  }, [overlay]);

  // Move focus to the heading of the face that has just arrived, so a keyboard or screen reader
  // user is told where they landed instead of being left on the control they pressed. Runs after
  // the effect above, so the face is already out of `inert` when it fires. tabIndex={-1} makes a
  // heading focusable without adding it to the tab order.
  useEffect(() => {
    if (leaving === null) headingRef.current?.focus();
  }, [leaving, face]);

  /**
   * Turn to the next face. The one transition, used by every pair.
   */
  const goTo = useCallback(
    (next: Face) => {
      if (next === face) return;

      if (prefersReducedMotion()) {
        // No turn at all. An instant swap is the only honest reduced-motion reading of "the card
        // opens": the swing is the effect being opted out of, and holding the card for the full
        // turn would be a stall, not a transition.
        setFace(next);
        return;
      }

      setLeaving(face);
      setFading(false);
      setTurning(false);
      setFace(next);
    },
    [face]
  );

  const enter = useCallback(() => {
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {
      // Storage unavailable — the cover still yields for this page load, the flag just will not
      // survive a reload.
    }
    goTo("menu");
  }, [goTo]);

  /*
   * The Census door does not always leave the hub.
   *
   * A visitor who has not turned the intro off gets it as a face of this card, which costs no page
   * change at all. One who has turned it off goes straight to the deck. Returned as a boolean
   * because the door component has no business knowing what a census intro is — it only asks
   * whether anyone took the click.
   */
  const onDoorActivate = useCallback(
    (to: string) => {
      if (to !== "/census") return false;
      if (getIntroHidden()) navigate("/census/vote");
      else goTo("intro");
      return true;
    },
    [goTo, navigate]
  );

  const renderFace = (which: Face, isBase: boolean) => {
    if (which === "cover") {
      return (
        <>
          <MartiniMark className="w-40" />

          <button
            type="button"
            onClick={enter}
            className="inline-flex min-h-[44px] items-center px-4 font-display text-4xl tracking-widest text-gold transition-colors hover:text-gold-light"
          >
            ENTER
          </button>
        </>
      );
    }

    if (which === "intro") {
      return (
        <CensusIntro
          headingRef={isBase ? headingRef : undefined}
          onBack={() => goTo("menu")}
        />
      );
    }

    return (
      <>
        <MartiniMark className="mb-5" />
        <h1
          ref={isBase ? headingRef : undefined}
          tabIndex={-1}
          className="font-display text-4xl font-bold text-gold outline-none"
        >
          Pick a seat
        </h1>

        <hr className="mt-5 border-gold/20" />

        {/*
          The standfirst is a preamble, not the first item on the list, so the space above the
          first row is deliberately much larger than the space between rows — otherwise the blurb
          reads as a seat with no doors.
        */}
        <p className="mt-5 font-body text-[15px] leading-relaxed text-gold-light">
          {HUB_STANDFIRST}
        </p>

        {/* The rules between rows are the only lines on the list: `divide-y` draws them, so no
            row owns a border of its own. */}
        <div className="mt-10 divide-y divide-gold/15">
          {HUB_ENTRIES.map((entry) => (
            <LoungeEntry key={entry.id} entry={entry} onDoorActivate={onDoorActivate} />
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-clip px-6 py-12">
      {/*
        The horizontal clip, and NOT the hidden mode. A hidden overflow axis makes the other axis
        compute to auto, so this page would become a scroll container and clip the card on the
        vertical axis too — which the turning panel needs, because it swings out of its own box as
        it comes round. Clipping does not create a scroll container, so the horizontal risk is
        closed without touching the vertical axis.
      */}
      {/*
        Texture belongs to the room, not to the card: the film grain goes on the page backdrop so
        the card reads as paper laid on the wall, not as a grey box.
      */}
      <div className="grain" />

      {/*
        `perspective` is on this element and not on the page wrapper because the CSS perspective
        property only projects an element's *own* children — the turning face has to be a direct
        child of it, or the rotateY is a flat flip.
      */}
      <div className="relative mx-auto w-full max-w-md" style={{ perspective: "1200px" }}>
        {/*
          The face being revealed, or the face in use. It carries the card's footprint, which is
          why it is never the cover: a cover with nothing under it would collapse to the height of
          its own two elements, and the void below the mark is the point of the cover.

          It dims while something is parked on top of it and comes up to full as that thing leaves
          — the paper catching the light as the sheet above it is lifted away.
        */}
        <MenuCard
          ref={baseRef}
          data-hub={beneath}
          className={cn(FACE_LAYOUT[beneath])}
          style={{
            opacity: overlay && !turning ? 0.75 : 1,
            transform: overlay && !turning ? "scale(0.985)" : "scale(1)",
            transition: `opacity ${SWING_MS}ms ${TURN_EASING}, transform ${SWING_MS}ms ${TURN_EASING}`,
          }}
        >
          {renderFace(beneath, true)}
        </MenuCard>

        {overlay && (
          <MenuCard
            data-hub={overlay}
            className={cn("absolute inset-0", FACE_LAYOUT[overlay])}
            style={{
              transformOrigin: "left center",
              backfaceVisibility: "hidden",
              willChange: "transform",
              transform: turning ? "rotateY(-85deg)" : "rotateY(0deg)",
              opacity: fading ? 0 : 1,
              transition: `transform ${SWING_MS}ms ${TURN_EASING}, opacity ${FADE_MS}ms ease-out`,
            }}
          >
            {renderFace(overlay, false)}

            {/* The shade. Same clock as the turn, so the lifting face darkens as it leaves the
                light instead of snapping dark at the end. */}
            <div
              data-hub="shade"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-md bg-[var(--background)]"
              style={{
                opacity: turning ? 0.55 : 0,
                transition: `opacity ${SWING_MS}ms ${TURN_EASING}`,
              }}
            />
          </MenuCard>
        )}
      </div>
    </div>
  );
};

export default Hub;
