/**
 * VoteReceipt — the short-lived confirmation chip shown after each vote.
 *
 * Purpose: a swipe is a gesture with no acknowledgement. The card flies away and the next card
 * arrives, which is fast but leaves a sliver of doubt ("did that count?"). The chip answers that
 * immediately and then gets out of the way.
 *
 * It also carries the consensus reveal, which is the only read this screen performs.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PRODUCT RULE — THE TALLY IS REVEALED ONLY AFTER THE VISITOR HAS VOTED ON THAT COCKTAIL.
 *
 * Never before. Not on the pre-vote card, not as a hover, not as a hint. The entire product
 * thesis is an UNCONTAMINATED community consensus: the census is only worth anything if each
 * vote is an independent judgement of the recipe as written. Showing a running tally next to a
 * card the visitor has not voted on turns every subsequent vote into a conformity signal — the
 * numbers would measure agreement with the crowd, not with the recipe, and the dataset the
 * census exists to produce would be worthless. This is why the component takes `cocktailId` and
 * is mounted by the parent only AFTER the vote has been recorded, and why the fetch is gated
 * behind a deliberate delay below rather than fired on mount.
 *
 * Do not move this read to CocktailCard. Do not render it on the pre-vote screen.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MIN_SAMPLE } from "./CensusResults";

/**
 * Delay before the consensus line is appended, in ms.
 *
 * Deliberate, not decorative: the receipt has to land and be read first. The confirmation is the
 * primary message and must not be competing with a number for attention at the moment of
 * arrival. 900ms is roughly the receipt's own settle time plus a beat.
 */
export const CONSENSUS_REVEAL_DELAY_MS = 900;

/** The tally view's row, narrowed to the three columns this component reads. */
interface TallyRow {
  agrees: number;
  disagrees: number;
  total: number;
}

interface VoteReceiptProps {
  cocktailId: string;
  /** Votes actually cast, including this one. */
  completed: number;
  total: number;
}

export const VoteReceipt = ({ cocktailId, completed, total }: VoteReceiptProps) => {
  // The consensus sentence, or null while it is pending / unavailable.
  const [consensus, setConsensus] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let cancelled = false;

    const load = async () => {
      try {
        // One cocktail, one row. `maybeSingle` rather than `single` because "no row yet" is a
        // normal state (this visitor may be the first vote) and must not throw.
        const { data, error } = await client
          .from("cocktail_tally")
          .select("agrees,disagrees,total")
          .eq("cocktail_id", cocktailId)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;

        const row = data as TallyRow | null;
        if (!row) return;

        // count(*) comes back as a bigint, which the client can hand over as a string. Coerce
        // before any arithmetic, or `agrees / total` silently produces NaN.
        const agrees = Number(row.agrees);
        const totalVotes = Number(row.total);
        if (!Number.isFinite(agrees) || !Number.isFinite(totalVotes)) return;

        // Same sample floor as the ranking tables: below it the percentage is noise, and a
        // "100% of 1 agree" line would teach the visitor something false about the census.
        if (totalVotes < MIN_SAMPLE) return;

        const pct = Math.round((agrees / totalVotes) * 100);
        setConsensus(`${pct}% of ${totalVotes} agree`);
      } catch (err) {
        // Fail soft, exactly like CensusResults.tsx: no error, no row, no sample, or a view that
        // does not exist yet all mean the same thing here — show the receipt and say nothing
        // about the tally. The visitor's vote is already saved either way.
        console.warn("[census] consensus unavailable, showing the receipt only", err);
      }
    };

    const timer = window.setTimeout(() => {
      void load();
    }, CONSENSUS_REVEAL_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cocktailId]);

  return (
    /*
     * Centering lives on this fixed wrapper rather than on the chip itself.
     *
     * `receipt-in` animates `transform`, and an animation on `transform` overrides a utility
     * class on the same element for the whole animation plus the `both` fill. `-translate-x-1/2`
     * on the chip would therefore be wiped out the instant the animation ran, and the chip would
     * jump half its width to the right. Centering the wrapper with flex avoids the collision
     * entirely and leaves the keyframes exactly as specified.
     *
     * `pointer-events-none`: the chip is decoration over the bottom of the screen and must never
     * intercept a tap on the vote buttons.
     *
     * `bg-card/[0.97]` rather than `bg-card/97`: Tailwind only accepts opacity values from its own
     * scale (multiples of 5) after the slash, and a bare `/97` compiles to NO rule at all — the
     * chip would end up fully transparent and the receipt would be invisible. Bracket syntax takes
     * any value. The 3% transparency is the point: the card edge is faintly visible through it.
     */
    <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
      <div
        data-section="vote-receipt"
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-full border border-gold/45 bg-card/[0.97] px-4 py-2.5 text-xs shadow-lg"
        style={{ animation: "receipt-in 500ms cubic-bezier(0.2,1.2,0.3,1) both" }}
      >
        {/* Gold tick badge. aria-hidden: the word "Noted" next to it is the real message. */}
        <span
          aria-hidden="true"
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold leading-none text-[var(--background)]"
        >
          ✓
        </span>
        <span className="font-body font-medium text-foreground">Noted</span>
        <span className="font-body text-muted-foreground">
          · {completed} of {total}
        </span>
        {consensus && <span className="font-body text-gold">· {consensus}</span>}
      </div>
    </div>
  );
};
