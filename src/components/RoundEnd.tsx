import { Link } from "react-router-dom";
import { recapLine, recapSubline, type RoundRecap } from "@/lib/rounds";

/**
 * The round boundary — one round's recap, and the three ways on.
 *
 * WHY THIS EXISTS AT ALL: the deck used to be a single fifteen-card commitment. Either you finished
 * it or you abandoned it, and an abandoned deck is a half-collected unit of data with no clean edge.
 * A round gives the loop a stopping point that is always complete, which is the whole reason the deck
 * became a repeating five instead of one long fifteen. This screen is that stopping point.
 *
 * WHY THE RECAP AND THE PROMPT ARE THE SAME SCREEN: "continue?" on its own is a question with no
 * information in it. "You agreed with 3 of the 4 — keep going?" is the same question with the round's
 * result attached, and the result is the reason a visitor might want to continue. Two screens would
 * spend a tap to say nothing.
 *
 * WHY THE EXITS ARE QUIET AND THE CONTINUE IS NOT: the same reasoning as ExitLink's. An exit styled
 * like a prompt is an exit nobody trusts, and a prominent "back to the menu" would compete with the
 * thing the visitor came to do. So the exits are small text links and the continue is the only thing
 * that looks like a button.
 *
 * WHY THE LAST ROUND HAS NO "KEEP GOING": there is no next round to go to. The primary action becomes
 * the summary instead, and the duplicate "see the summary" link is dropped rather than shown twice —
 * and `isLastRound` is DERIVED from the recap rather than passed as a prop, because a separate flag
 * would be a second source of truth for a fact the recap already carries.
 *
 * WHY THE COPY IS NOT HERE: every sentence this screen prints comes from `recapLine` / `recapSubline`
 * in lib/rounds.ts, which is the module its self-check runs. Copy and arithmetic that disagree are a
 * bug with no error message — verdict.ts established that rule for the verdict, and this is the same
 * rule at the round boundary.
 *
 * WHY IT IS NOT A ROUTE: the deck owns the `votes` array the recap is counted from, and it is the
 * record of the session that the card's header counter reads. Navigating to a route would unmount the
 * deck and lose it, so the boundary is a state of the deck, not a page.
 */
const RoundEnd = ({
  recap,
  onContinue,
  dry = false,
}: {
  recap: RoundRecap;
  onContinue: () => void;
  /**
   * Preserve the run mode across the boundary. Without it, a dry walk lands on the gate on the next
   * page, finds no votes (because a dry run writes none) and is sent back to the ask — which makes
   * the menu unreachable exactly when someone is testing it.
   */
  dry?: boolean;
}) => {
  const isLastRound = recap.round === recap.rounds;
  const withMode = (to: string) => (dry ? `${to}?dry=1` : to);

  return (
    <div className="roundend">
      <span className="roundend-kicker">Roast · the round</span>

      <h2 className="roundend-line">{recapLine(recap)}</h2>
      <p className="roundend-sub">{recapSubline(recap)}</p>

      {isLastRound ? (
        <Link to={withMode("/roast/review")} className="roundend-continue">
          See the summary
        </Link>
      ) : (
        <button type="button" className="roundend-continue" onClick={onContinue}>
          Keep going
        </button>
      )}

      <div className="roundend-exits">
        {!isLastRound && (
          <Link to={withMode("/roast/review")} className="roundend-exit">
            see the summary
          </Link>
        )}
        <Link to={withMode("/roast")} className="roundend-exit">
          back to the menu
        </Link>
      </div>
    </div>
  );
};

export default RoundEnd;
