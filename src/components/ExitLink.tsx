import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * The emergency exit — a way back to the menu from inside a room.
 *
 * WHY IT EXISTS: the two screens that mattered most had no way out at all. The Census voting
 * screen and the ROAST deck are full-bleed, thumb-driven and have no chrome, so a visitor
 * who opens one and wants something else has exactly two options — the browser's back button,
 * which on a phone is a gesture most people never find, or leaving. Neither is an answer.
 * The intro screens had a back link; the screens people actually land in did not. The exit was
 * on the doormat and not in the room.
 *
 * WHY ONE COMPONENT: the label, the destination and the 44px hit area are one decision, and
 * four copies of one link is how the wording drifts. It is a shared component for the same
 * reason MenuCard is: two copies of one artifact is a bug this project has already paid for.
 *
 * WHY IT IS SMALL AND PLAIN: it is an exit, not a call to action. A button in gold would
 * compete with the thing the visitor came to do — cast a vote, roast a spec — and an exit
 * that looks like a prompt is one they stop trusting. The text is quiet on purpose and lifts
 * to full contrast on hover and focus.
 *
 * WHY THE 44px: the project rule is a 44px minimum touch target, and a bare text link with
 * no padding is about 16px tall. The padding is invisible; the hit area is not.
 *
 * WHY IT IS NEVER INSIDE A SWIPE CONTAINER: the deck and the card both use horizontal drag to
 * mean "agree" and "disagree". A control placed inside that area is a control whose taps get
 * read as votes, which is the failure mode that cost this project a long debugging session
 * once already. Every caller puts this outside the gesture surface.
 */
const ExitLink = ({ className }: { className?: string }) => (
  <Link
    to="/"
    className={cn(
      "inline-flex min-h-[44px] items-center px-2 font-body text-xs text-muted-foreground",
      "underline underline-offset-2 transition-colors hover:text-cream focus-visible:text-cream",
      className
    )}
  >
    back to the hub
  </Link>
);

export default ExitLink;
