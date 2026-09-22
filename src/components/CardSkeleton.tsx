/**
 * CardSkeleton — the placeholder shown while saved progress is read on first paint.
 *
 * Why this exists: Census.tsx used to `return null` until `initialised` flipped, so a visitor on
 * a slow phone saw a blank dark screen for the first frame(s) and then the whole page appeared
 * at once. Worse, the card arrived at full height and pushed the layout, so the page "jumped".
 *
 * This component therefore mirrors the REAL card's geometry — same `max-w-lg`, same 2px gold
 * hairline, same `p-6`, same 124x105 illustration box, same footer row — and stands in for the
 * text with shimmering blocks. It is deliberately not a generic spinner: the point is that when
 * the real card mounts, nothing above or below it moves.
 *
 * `shimmer-block` (defined in index.css) owns the paint; this file owns only the box sizes.
 */

export const CardSkeleton = () => {
  return (
    <>
      {/*
       * The `role="status"` text sits OUTSIDE the placeholder below, on purpose.
       *
       * The placeholder is `aria-hidden="true"` because it is decoration. But `aria-hidden`
       * hides an entire subtree from assistive technology, so a `role="status"` element nested
       * inside it would announce nothing at all — the accessible name would exist in the DOM
       * and never reach a screen reader. Keeping the status as a sibling of the hidden block is
       * what makes the announcement real.
       */}
      <span role="status" className="sr-only">
        Loading
      </span>

      {/* Automation hook: data-section="card-skeleton". aria-hidden because the real card,
          with the real content, follows immediately behind it. */}
      <div data-section="card-skeleton" aria-hidden="true" className="w-full max-w-lg mx-auto">
        <div className="rounded-2xl border border-gold/30 bg-card overflow-hidden shadow-lg">
          {/* Same 2px gold hairline as the real card, so the top edge never shifts on swap. */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />

          <div className="p-6">
            {/* === Header (name + recipe label left, illustration box right) === */}
            <div className="flex justify-between items-end" data-section="card-skeleton-header">
              <div className="flex-1 min-w-0 pr-4">
                {/* Cocktail name → a 58%-wide line at the real 20px cap height. */}
                <div className="shimmer-block h-5 w-[58%]" />
                {/* Recipe label → a 34%-wide line at the real 10px uppercase height. */}
                <div className="shimmer-block mt-2 h-[10px] w-[34%]" />
              </div>
              {/*
               * Same 124x105 box as the real card, so the header keeps its exact height and the
               * recipe text below it does not move when the illustration loads.
               *
               * The 74px circle wraps the shimmer block instead of relying on `rounded-full`
               * beating `.shimmer-block`'s own `border-radius`: `.shimmer-block` is declared at
               * top level (after `@tailwind utilities`), so a `rounded-*` utility on the same
               * element loses. Clipping from the parent's `overflow-hidden` sidesteps that.
               */}
              <div className="relative flex h-[124px] w-[105px] flex-shrink-0 items-center justify-center">
                <div className="h-[74px] w-[74px] rounded-full overflow-hidden">
                  <div className="shimmer-block h-full w-full" />
                </div>
              </div>
            </div>

            {/* === Identity divider — same spacing as the real card === */}
            <div className="h-px bg-gold/20 mt-2 mb-4" />

            {/* === Body — three full-width lines standing in for the ingredient list === */}
            <div className="space-y-2">
              <div className="shimmer-block h-[11px] w-full" />
              <div className="shimmer-block h-[11px] w-full" />
              <div className="shimmer-block h-[11px] w-full" />
            </div>

            {/* === Footer — the same three-block vote row as the real card === */}
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-gold/20">
              <div className="h-12 w-12 rounded-full overflow-hidden">
                <div className="shimmer-block h-full w-full" />
              </div>
              <div className="shimmer-block h-6 w-28" />
              <div className="h-12 w-12 rounded-full overflow-hidden">
                <div className="shimmer-block h-full w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
