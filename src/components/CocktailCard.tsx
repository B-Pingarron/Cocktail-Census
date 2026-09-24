/**
 * CocktailCard - Displays a cocktail card for voting via swipe
 *
 * Phase 1.1, Wave 4: Swipe-based voting with auto-advance
 *   - Swipe right to agree, left to disagree
 *   - Card follows finger with CSS transform (translateX + rotate)
 *   - 40% threshold triggers fly-off animation and vote callback
 *   - Placeholder icon replaces cocktail photo (no images in Phase 1.1)
 *
 * Wave 6 (UI/UX): the card gained an animated conic edge, a bottom-up illustration reveal, deck
 * ghosts behind it, a commit stamp at the 40% threshold, a haptic pulse on threshold crossing,
 * and a 3D tilt toward the thumb. The gesture itself — 40% threshold, 250ms fly-off,
 * react-swipeable, `trackMouse: false`, the `flyingRef` mutex — is deliberately untouched.
 *
 * Annotation Convention: data-section attributes map to DevTools → grep
 *   - data-section="swipe-container" → outermost swipeable wrapper
 *   - data-section="card"            → main card container
 *   - data-section="card-header"    → header flex container
 *   - data-section="swipe-indicator" → swipe direction overlay
 *   - data-section="swipe-stamp"     → commit stamp shown past the 40% threshold (Wave 6)
 *   - data-section="nav-disagree"    → subtle "X" button (left)
 *   - data-section="nav-agree"       → subtle "✓" button (right)
 */
import { useState, useCallback, useEffect, useRef } from "react";
import type { Cocktail } from "@/types/cocktail";
import { RecipeDetails } from "./RecipeDetails";
import { useSwipeable } from "react-swipeable";
import { cocktailArt } from "@/lib/cocktailArt";

/** Duration of the fly-off animation in ms — synchronized with SWIPE_FLYOFF_DURATION_MS in Census.tsx (Wave 4) */
export const SWIPE_FLYOFF_DURATION_MS = 250;

/** Fraction of card width that triggers a swipe vote (40%) */
const SWIPE_THRESHOLD = 0.4;

/** Swipe offset (%) past which the commit stamp is shown. Lower than the vote threshold on purpose. */
const STAMP_THRESHOLD = 40;

/** Swipe offset (%) past which the edge switches to its agree/disagree colourway. */
const EDGE_TINT_THRESHOLD = 15;

/** Duration of the haptic pulse on threshold crossing, in ms. Short: a tick, not a buzz. */
const HAPTIC_PULSE_MS = 10;

interface CocktailCardProps {
  cocktail: Cocktail;
  onVote: (cocktailId: string, recipeId: string, vote: "agree" | "disagree") => void;
  onPrevious?: () => void;
}

export const CocktailCard = ({
  cocktail,
  onVote,
  onPrevious,
}: CocktailCardProps) => {
  // Tracks horizontal swipe progress as percentage of card width (negative=left, positive=right)
  const [swipeOffset, setSwipeOffset] = useState(0);
  // Ref to always read the latest swipeOffset in event handlers (avoids stale closure)
  const swipeOffsetRef = useRef(0);
  // Track direction after threshold crossed — "left" for disagree, "right" for agree
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  // Whether card is currently flying off-screen
  const [isFlying, setIsFlying] = useState(false);
  // Synchronous mutex for "this card has already committed a vote".
  //
  // `isFlying` above is STATE, so it is still false for every handler running in the same
  // tick. react-swipeable fires BOTH onSwiped and onTouchEndOrOnMouseUp for one touch
  // gesture, so a state guard let both through: two onVote calls, two cards advanced, and
  // two rows written per swipe. A ref is read and written synchronously, so the second path
  // sees that the first already claimed the gesture. Both paths are kept deliberately.
  //
  // No reset needed on unmount — Census remounts the card per cocktail via `key`.
  const flyingRef = useRef(false);
  // Whether THIS gesture has already fired its haptic pulse. Reset at the start of every new
  // gesture (see onTouchStartOrOnMouseDown below), so a visitor who drags back and forth across
  // the threshold feels one tick, not a stutter.
  const buzzedRef = useRef(false);

  /** Handle swipe completion — called when user releases past threshold */
  const handleSwiped = useCallback(
    (direction: "left" | "right") => {
      if (flyingRef.current) return;
      flyingRef.current = true;
      setIsFlying(true);
      setSwipeDirection(direction);

      // After fly-off animation completes, trigger the vote callback
      setTimeout(() => {
        onVote(
          cocktail.id,
          cocktail.standardRecipe.id,
          direction === "right" ? "agree" : "disagree"
        );
        // Note: Wave 4 adds auto-advance to next cocktail here
      }, SWIPE_FLYOFF_DURATION_MS);
    },
    [cocktail.id, cocktail.standardRecipe.id, onVote]
  );

  // === Keyboard Navigation (Phase 1.1) ===
  // ArrowLeft = disagree (swipe left), ArrowRight = agree (swipe right)
  // Added based on user feedback during review — swipe-only was an accessibility gap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in form elements
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSwiped("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSwiped("right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSwiped]);

  const swipeHandlers = useSwipeable({
    // A new gesture starts here, so the haptic is armed again. Without this reset the pulse
    // would fire once per card at most, and only for whichever direction was tried first.
    onTouchStartOrOnMouseDown: () => {
      buzzedRef.current = false;
    },
    onSwiping: ({ deltaX }) => {
      if (flyingRef.current) return;
      const el = document.querySelector("[data-section='swipe-container']") as HTMLElement | null;
      if (el) {
        const cardWidth = el.offsetWidth;
        const percent = (deltaX / cardWidth) * 100;
        swipeOffsetRef.current = percent;
        setSwipeOffset(percent);

        // === Haptic tick on threshold crossing (Wave 6) ===
        // Fires on the FIRST frame the drag is past 40%, once per gesture.
        //
        // Progressive enhancement only: iOS Safari ignores the Vibration API entirely, so this
        // is a bonus for Android and does nothing on the iPhone the QR code is aimed at. It must
        // never be a load-bearing part of the gesture — the stamp and the edge colour carry the
        // same information visually for everyone.
        if (Math.abs(percent) > SWIPE_THRESHOLD * 100 && !buzzedRef.current) {
          buzzedRef.current = true;
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate(HAPTIC_PULSE_MS);
          }
        }
      }
    },
    onSwiped: () => {
      if (flyingRef.current) return;
      const currentOffset = swipeOffsetRef.current;
      const absPercent = Math.abs(currentOffset);
      if (absPercent > SWIPE_THRESHOLD * 100) {
        handleSwiped(currentOffset > 0 ? "right" : "left");
      } else {
        setSwipeOffset(0);
        setSwipeDirection(null);
      }
    },
    onTouchEndOrOnMouseUp: () => {
      if (flyingRef.current) return;
      const currentOffset = swipeOffsetRef.current;
      const absPercent = Math.abs(currentOffset);
      if (absPercent > SWIPE_THRESHOLD * 100) {
        handleSwiped(currentOffset > 0 ? "right" : "left");
      } else {
        setSwipeOffset(0);
        setSwipeDirection(null);
      }
    },
    trackTouch: true,
    trackMouse: false,
    preventScrollOnSwipe: true, // CRITICAL for iOS Safari
    delta: 10,
  });

  // Direction-aware edge colourway. Idle keeps the slow gold/forest sweep; leaning right warms
  // and speeds it up, leaning left desaturates and slows it down.
  const edgeClass =
    swipeOffset > EDGE_TINT_THRESHOLD
      ? "card-edge card-edge--agree"
      : swipeOffset < -EDGE_TINT_THRESHOLD
        ? "card-edge card-edge--disagree"
        : "card-edge";

  return (
    <div
      data-section="swipe-container"
      {...swipeHandlers}
      className="relative w-full max-w-lg mx-auto cursor-grab active:cursor-grabbing"
      style={{
        transform:
          swipeDirection === "left" && isFlying
            ? "translateX(-120%) rotate(-12deg)"
            : swipeDirection === "right" && isFlying
              ? "translateX(120%) rotate(12deg)"
              // Wave 6: the existing translateX + rotate are unchanged; `rotateY` is the whole
              // addition — the card tips away from the thumb as it slides (8 lines riding on an
              // existing transform).
              //
              // Note on `perspective` below: it is declared on this element, and CSS applies
              // `perspective` to an element's DESCENDANTS, not to the element's own transform —
              // for that you need the `perspective()` transform function inline. So this rotateY
              // is rendered near-orthographically: a genuine but subtle width compression rather
              // than a true keystone. Making it fully perspective-correct is a separate change
              // (move the tilt onto the inner .card-edge, or prefix the transform function).
              : `translateX(${swipeOffset}%) rotate(${swipeOffset * 0.15}deg) rotateY(${swipeOffset * -0.06}deg)`,
        transition: isFlying
          ? `transform ${SWIPE_FLYOFF_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
          : swipeOffset !== 0
            ? "none"
            : `transform ${SWIPE_FLYOFF_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        opacity: swipeDirection && isFlying ? 0 : 1,
        // Vanishing point for the children's 3D transforms (and for the tilt once it is moved
        // onto a child). See the note above.
        perspective: "900px",
      }}
    >
      {/*
       * === Deck ghosts (Wave 6) ===
       *
       * Two rounded rectangles sitting behind the card, each pushed down a little and scaled
       * down a little, so the card reads as the front of a physical stack instead of a lone
       * panel. They ride on the card's own transform, so the whole deck leans with the thumb.
       *
       * This is a deliberate REVERSAL of the A3 amendment, which chose a plain 200ms opacity
       * fade for the card transition. The fade was cheap and safe but it taught the visitor
       * nothing about there being more cards; the deck does.
       *
       * aria-hidden: decoration. pointer-events-none: they must never swallow a drag that starts
       * on the exposed sliver at the bottom. -z-10 puts them behind the card inside the swipe
       * container's own stacking context.
       *
       * `border-gold/[0.28]` rather than `border-gold/28`: Tailwind only accepts opacity values
       * from its own scale (multiples of 5) after the slash, and a bare `/28` compiles to NO rule
       * at all — the border would silently not exist. Bracket syntax takes any value.
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl border border-gold/[0.28] bg-card translate-y-[14px] scale-90 opacity-40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl border border-gold/[0.28] bg-card translate-y-[7px] scale-95 opacity-70"
      />

      {/* === Animated conic edge (Wave 6) ===
          The wrapper owns the 1rem radius and the 2px of padding that the gradient fills. The
          card inside is the inner element, so its own radius is reduced by exactly the 2px of
          edge (1rem - 2px = 0.875rem) and the gradient reads as a hairline border rather than
          being covered by a square-cornered card. */}
      <div className={edgeClass}>
        {/* Main card */}
        <div className="relative rounded-[0.875rem] border border-gold/30 bg-card overflow-hidden shadow-lg" data-section="card">
          {/* === Gold Accent Line === */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />

          <div className="p-6">
            {/* === Header (Name + Placeholder Image) === */}
            <div className="flex justify-between items-end" data-section="card-header">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">
                  {cocktail.name}
                </h2>
                <p className="text-sm text-gold font-body font-medium mt-1 uppercase tracking-widest">
                  {cocktail.standardRecipe.label}
                </p>
              </div>
              <div className="relative flex h-[124px] w-[105px] flex-shrink-0 items-center justify-center">
                {/* Sizing rule: width is capped at 0.78x the box height. Sizing every drink to the
                    same HEIGHT made drawn area proportional to aspect ratio, so wide drinks carried
                    2.5x the visual weight of tall ones; this cap brings that to 1.57x. 97/124 =
                    0.782. Tall drinks now keep full height and the wide ones give some back. */}
                <div className="absolute inset-0 m-auto h-[74px] w-[74px] -translate-x-1 translate-y-2 rounded-full border-2 border-gold/40 bg-[#2b3a4a]" />
                {/*
                 * === The pour (Wave 6) ===
                 *
                 * The art reveals from the bottom up, which reads as the glass filling.
                 *
                 * Constraint worth recording: this is an <img src={cocktailArt(id)}> — the SVG is
                 * loaded as a separate document (Vite emits it as its own file), so its internal
                 * layers are NOT in this DOM and no selector written here can reach the liquid
                 * shape to animate it. Animating the <img> box itself with clip-path is therefore
                 * the only option that stays inside this file. A true layer-by-layer pour would
                 * require inlining the SVG markup (a separate change, and it would give up the
                 * per-cocktail file split in cocktailArt.ts).
                 *
                 * `both` holds the from-state before the animation starts, so the art is never
                 * briefly visible at full height on the frame before it runs.
                 */}
                <img
                  src={cocktailArt(cocktail.id)}
                  alt="cocktail"
                  className="relative h-auto max-h-[124px] w-[97px] rotate-3 object-contain"
                  style={{ animation: "card-enter 620ms cubic-bezier(0.2, 0.8, 0.3, 1) both" }}
                />
              </div>
            </div>

            {/* === Identity Divider === */}
            <div className="h-px bg-gold/20 mt-2 mb-4" />

            {/* === Recipe Details === */}
            <RecipeDetails recipe={cocktail.standardRecipe} />

            {/* The census judges the written spec, not the drink. Said at the moment of
                decision, because a first-time reader naturally reads the card as a drink. */}
            <p className="mt-4 text-center text-[10px] font-body uppercase tracking-widest text-muted-foreground">
              Rate the recipe, not the drink
            </p>
            {/* === Vote Buttons ===
                Wave 6: no per-button focus styling is added here on purpose. All three buttons
                inherit the global `:focus-visible` ring from index.css, and none of them sets
                `outline: none`, so a keyboard user gets a gold ring on all three for free. */}
            {!isFlying && (
              <div className="flex justify-between items-center pt-3 border-t border-gold/20">
                <button
                  data-section="nav-disagree"
                  onClick={(e) => { e.stopPropagation(); handleSwiped("left"); }}
                  className="w-12 h-12 rounded-full
                    bg-card border border-concrete/30 flex items-center justify-center
                    text-concrete/60 hover:text-concrete hover:border-concrete/50 hover:bg-card
                    transition-all duration-200 cursor-pointer"
                  aria-label="This recipe is not right (swipe left)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
                {onPrevious && (
                  <button
                    data-section="nav-previous"
                    onClick={(e) => { e.stopPropagation(); onPrevious(); }}
                    className="px-3 py-1.5 rounded-lg
                      bg-card border border-concrete/20 flex items-center justify-center
                      text-concrete/40 hover:text-concrete hover:border-concrete/40 hover:bg-card
                      transition-all duration-200 cursor-pointer"
                    aria-label="Previous cocktail"
                  >
                    <span className="text-[10px] uppercase tracking-widest font-body font-bold">
                      previous drink
                    </span>
                  </button>
                )}
                <button
                  data-section="nav-agree"
                  onClick={(e) => { e.stopPropagation(); handleSwiped("right"); }}
                  className="w-12 h-12 rounded-full
                    bg-card border border-gold/30 flex items-center justify-center
                    text-gold/60 hover:text-gold hover:border-gold/50 hover:bg-card
                    transition-all duration-200 cursor-pointer"
                  aria-label="This recipe looks right (swipe right)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
              </div>
            )}

            {/* === Swipe Indicator Overlay === */}
            {swipeOffset !== 0 && !isFlying && (
              <div className="absolute inset-0 pointer-events-none" data-section="swipe-indicator">
                {/* Right swipe (agree) glow */}
                {swipeOffset > 15 && (
                  <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-gold/10 to-transparent" />
                )}
                {/* Left swipe (disagree) glow */}
                {swipeOffset < -15 && (
                  <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-concrete/10 to-transparent" />
                )}

                {/* === Commit stamp (Wave 6) ===
                    Shown once the drag is past 40% — the same point at which the vote would
                    commit — so the visitor is told the gesture has "taken" before they let go.
                    The old feedback here was the two glows above, which peak at 10% opacity: on a
                    dark card that is essentially invisible, so the threshold was never taught and
                    the gesture had to be discovered by accident.

                    Rotation comes from `stamp-in`'s keyframes, not from a `rotate-*` utility: an
                    animation on `transform` overrides the utility for the whole animation plus the
                    `both` fill, so declaring it in one place avoids two competing sources. */}
                {Math.abs(swipeOffset) > STAMP_THRESHOLD && (
                  <div
                    data-section="swipe-stamp"
                    className={`pointer-events-none absolute top-6 rounded border-2 px-3 py-1 font-body font-bold text-sm uppercase tracking-widest ${
                      swipeOffset > 0
                        ? "right-6 border-gold text-gold"
                        : "left-6 border-concrete text-concrete"
                    }`}
                    style={{ animation: "stamp-in 700ms cubic-bezier(0.2, 1.5, 0.4, 1) both" }}
                  >
                    {swipeOffset > 0 ? "AGREED" : "NOT QUITE"}
                  </div>
                )}
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );
};
