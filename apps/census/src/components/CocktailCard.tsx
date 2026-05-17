/**
 * CocktailCard - Displays a cocktail card for voting via swipe
 *
 * Phase 1.1, Wave 4: Swipe-based voting with auto-advance
 *   - Swipe right to agree, left to disagree
 *   - Card follows finger with CSS transform (translateX + rotate)
 *   - 40% threshold triggers fly-off animation and vote callback
 *   - Placeholder icon replaces cocktail photo (no images in Phase 1.1)
 *
 * Annotation Convention: data-section attributes map to DevTools → grep
 *   - data-section="swipe-container" → outermost swipeable wrapper
 *   - data-section="card"            → main card container
 *   - data-section="card-header"    → header flex container
 *   - data-section="swipe-indicator" → swipe direction overlay
 *   - data-section="nav-disagree"    → subtle "X" button (left)
 *   - data-section="nav-agree"       → subtle "✓" button (right)
 */
import { useState, useCallback, useEffect } from "react";
import type { Cocktail } from "@/types/cocktail";
import { RecipeDetails } from "./RecipeDetails";
import { useSwipeable } from "react-swipeable";
import placeholderIcon from "@/assets/cocktail-placeholder.svg";

/** Duration of the fly-off animation in ms — synchronized with SWIPE_FLYOFF_DURATION_MS in Census.tsx (Wave 4) */
export const SWIPE_FLYOFF_DURATION_MS = 250;

/** Fraction of card width that triggers a swipe vote (40%) */
const SWIPE_THRESHOLD = 0.4;

interface CocktailCardProps {
  cocktail: Cocktail;
  onVote: (cocktailId: string, recipeId: string, vote: "agree" | "disagree") => void;
}

export const CocktailCard = ({
  cocktail,
  onVote,
}: CocktailCardProps) => {
  // Tracks horizontal swipe progress as percentage of card width (negative=left, positive=right)
  const [swipeOffset, setSwipeOffset] = useState(0);
  // Track direction after threshold crossed — "left" for disagree, "right" for agree
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  // Whether card is currently flying off-screen
  const [isFlying, setIsFlying] = useState(false);

  /** Handle swipe completion — called when user releases past threshold */
  const handleSwiped = useCallback(
    (direction: "left" | "right") => {
      if (isFlying) return;
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
    [cocktail.id, cocktail.standardRecipe.id, onVote, isFlying]
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
    onSwiping: ({ deltaX }) => {
      if (isFlying) return;
      // Clamp the swipe offset — CSS transforms use percentage, so calculate relative to card width
      const el = document.querySelector("[data-section='swipe-container']") as HTMLElement | null;
      if (el) {
        const cardWidth = el.offsetWidth;
        const percent = (deltaX / cardWidth) * 100;
        setSwipeOffset(percent);
      }
    },
    onSwiped: (_eventData) => {
      if (isFlying) return;
      const absPercent = Math.abs(swipeOffset);
      if (absPercent > SWIPE_THRESHOLD * 100) {
        handleSwiped(swipeOffset > 0 ? "right" : "left");
      } else {
        // Snap back
        setSwipeOffset(0);
        setSwipeDirection(null);
      }
    },
    onTouchEndOrOnMouseUp: () => {
      if (isFlying) return;
      const absPercent = Math.abs(swipeOffset);
      if (absPercent > SWIPE_THRESHOLD * 100) {
        handleSwiped(swipeOffset > 0 ? "right" : "left");
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
              : `translateX(${swipeOffset}%) rotate(${swipeOffset * 0.15}deg)`,
        transition: isFlying
          ? `transform ${SWIPE_FLYOFF_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
          : swipeOffset !== 0
            ? "none"
            : `transform ${SWIPE_FLYOFF_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        opacity: swipeDirection && isFlying ? 0 : 1,
      }}
    >
      {/* Main card */}
      <div className="relative rounded-2xl border border-gold/30 bg-card overflow-hidden shadow-lg" data-section="card">
        {/* === Gold Accent Line === */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />

        <div className="p-6 space-y-5">
          {/* === Header (Name + Placeholder Image) === */}
          <div className="flex items-start justify-between" data-section="card-header">
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">
                {cocktail.name}
              </h2>
              <p className="text-sm text-gold font-body font-medium mt-1 uppercase tracking-widest">
                {cocktail.standardRecipe.label}
              </p>
            </div>
            <img
              src={placeholderIcon}
              alt="cocktail"
              className="w-14 h-14 opacity-80 flex-shrink-0"
            />
          </div>

          {/* === Recipe Details === */}
          <RecipeDetails recipe={cocktail.standardRecipe} />

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
            </div>
          )}
        </div>

          {/* === Subtle Nav Buttons (Phase 1.1)
           * Tinder-style click fallback for non-swipe interaction.
           * Semi-transparent by default, full opacity on hover.
           * Hidden during fly-off. data-section attributes for DevTools mapping.
           * Added after Momus review — swipe-only was an accessibility gap for keyboard users. */}
          {!isFlying && (
            <>
              <button
                data-section="nav-disagree"
                onClick={(e) => { e.stopPropagation(); handleSwiped("left"); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                  bg-card/70 border border-gold/20 flex items-center justify-center
                  text-gold/60 hover:text-gold hover:border-gold/50 hover:bg-card
                  opacity-50 hover:opacity-100 transition-all duration-200 cursor-pointer z-10
                  backdrop-blur-sm"
                aria-label="Disagree (swipe left)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
              <button
                data-section="nav-agree"
                onClick={(e) => { e.stopPropagation(); handleSwiped("right"); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                  bg-card/70 border border-gold/20 flex items-center justify-center
                  text-gold/60 hover:text-gold hover:border-gold/50 hover:bg-card
                  opacity-50 hover:opacity-100 transition-all duration-200 cursor-pointer z-10
                  backdrop-blur-sm"
                aria-label="Agree (swipe right)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </button>
            </>
          )}
      </div>
    </div>
  );
};