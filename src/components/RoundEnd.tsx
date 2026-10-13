import { Link } from "react-router-dom";
import { recapLine, recapSubline, type RoundRecap } from "@/lib/rounds";
import type { RoastSide } from "@/types/roast";

/**
 * The round boundary — one round's recap, and the ways on.
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
 *
 * ── THE PLATE VOCABULARY (wired 2026-10-12) ─────────────────────────────────
 *
 * This screen used to wear `.roundend*` classes written in the old `roast.css` — a bare centred
 * column with no plate and no ground. It is now the room's own `.rd plate-room`: the same 5px black
 * edge, hard offset shadow and dither as the standing strip and the empty-Pool invitation, so the
 * deck's stopping point is visibly the same object as the rest of the arena rather than a fourth
 * language inside it.
 */
const RoundEnd = ({
  recap,
  onContinue,
  dry = false,
  votes,
}: {
  recap: RoundRecap;
  onContinue: () => void;
  /**
   * Preserve the run mode across the boundary. Without it, a dry walk lands on the gate on the next
   * page, finds no votes (because a dry run writes none) and is sent back to the ask — which makes
   * the menu unreachable exactly when someone is testing it.
   */
  dry?: boolean;
  /**
   * The session's votes, by deck position. Optional, and used for ONE thing: the round's own record
   * bar in the head, which is the same component the card carries — so the visitor can see the
   * round they just finished as a shape rather than only as a count.
   *
   * The round's size is DERIVED from the array and the recap rather than passed as a third prop:
   * `rounds` is the count the recap already carries, and a separate constant here would be a second
   * source of truth for a number `lib/rounds.ts` owns.
   */
  votes?: (RoastSide | null)[];
}) => {
  const isLastRound = recap.round === recap.rounds;
  const withMode = (to: string) => (dry ? `${to}?dry=1` : to);

  const size = votes && recap.rounds > 0 ? Math.ceil(votes.length / recap.rounds) : 0;
  const roundVotes = votes ? votes.slice((recap.round - 1) * size, recap.round * size) : [];

  return (
    <section className="rd plate-room" aria-labelledby="round-end-line">
      <div className="rd-head">
        <span className="rd-kick">Roast · the round</span>
        {roundVotes.length > 0 && (
          /*
           * The record, blown up to the round rather than the deck: one block per card in THIS
           * round, and every lit block carries the vote its spec got. Same four shapes as the
           * card's — agreement solid, disagreement hatched, skip short and dotted and NEVER red.
           * `here` is not used: nothing is in front of the visitor at a boundary.
           */
          <div className="record">
            <span
              className="hp"
              role="img"
              aria-label={`The record for round ${recap.round} of ${recap.rounds}.`}
            >
              {roundVotes.map((cast, i) => (
                <i key={i} className={cast === "likes" ? "ag" : cast === "yikes" ? "dis" : "skip"} />
              ))}
            </span>
          </div>
        )}
      </div>

      <h2 className="rd-line" id="round-end-line">{recapLine(recap)}</h2>
      <p className="rd-sub">{recapSubline(recap)}</p>

      {isLastRound ? (
        <Link to={withMode("/roast/review")} className="rd-go">
          See the summary
        </Link>
      ) : (
        <button type="button" className="rd-go" onClick={onContinue}>
          Keep going
        </button>
      )}

      <div className="rd-exits">
        {!isLastRound && (
          <Link to={withMode("/roast/review")} className="rd-exit">
            see the summary
          </Link>
        )}
        <Link to={withMode("/roast")} className="rd-exit">
          back to the menu
        </Link>
      </div>
    </section>
  );
};

export default RoundEnd;
