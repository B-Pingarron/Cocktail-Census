/**
 * ProgressBar — the "N of 100" readout above the card.
 *
 * Wave 6 bug fix: the old prop was `current`, and Census.tsx passed `currentIndex + 1`. That is
 * a POSITION, not a COUNT, so the bar read "100 of 100" / "100%" while the visitor was still
 * looking at — and had not yet voted on — the last card. The last vote was never represented:
 * the bar hit its maximum one vote early, which is exactly the moment a visitor is deciding
 * whether to finish.
 *
 * `completed` is the number of votes actually cast. It now reaches 100% only after the last
 * vote lands. The prop was renamed rather than reinterpreted so the call site cannot silently
 * pass a position again.
 */

interface ProgressBarProps {
  /** Votes actually cast. 0 on the first card, `total` only once the last vote is in. */
  completed: number;
  total: number;
}

export const ProgressBar = ({ completed, total }: ProgressBarProps) => {
  // Guard the divide: a zero-length cocktail list would otherwise render "NaN%".
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-full max-w-lg mx-auto space-y-1.5">
      <div className="flex justify-between text-xs font-body text-muted-foreground">
        <span>
          {completed} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-forest to-gold transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
