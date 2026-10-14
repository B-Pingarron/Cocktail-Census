import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * The feedback door — where there is an exit, there is a way to speak.
 *
 * WHY IT EXISTS: FeedbackForm used to be reachable from exactly one place — the Census completion
 * screen, after a hundred cards. A visitor with an opinion about a room, a drink or the app had no
 * way to say it unless they finished the whole survey first. The author's ruling: "there is no
 * quick access feedback space." This door is that space, and it is a door rather than a form
 * because the form already exists at /feedback and duplicating it into every room is how two
 * copies of one artifact drift apart.
 *
 * WHY ONE COMPONENT, ON ExitLink'S CONTRACT: same reasoning as ExitLink's header — the label, the
 * destination and the 44px hit area are one decision, and seven copies of one link is how the
 * wording drifts. It is ExitLink's quiet register on purpose: a door that looks like a call to
 * action competes with the thing the visitor came to do, and this sits beside exits, which are
 * quiet by law.
 *
 * THE SLUG MAP LIVES HERE, as a frozen `as const` map — the same house shape as ExitLink's `EXITS`,
 * for the same reason: the slug and the mount that mints it are ONE decision. The door's `where`
 * prop is typed off this map, so a mount cannot send an origin that does not exist, and
 * `isFeedbackSlug` is exported so the /feedback page can validate `?from=` against the SAME map —
 * one list, two consumers, no drift and no schema change (provenance rides inside the message
 * text; see FeedbackForm).
 *
 * WHY IT IS NEVER INSIDE A SWIPE CONTAINER: identical to ExitLink's rule. The Census card and the
 * ROAST deck both use horizontal drag to mean "agree" and "disagree", so a control inside that
 * area is a control whose taps get read as votes. Every mount places this beside the room's
 * existing exit cluster, never on a card face.
 */

/** The seven legitimate origins — one per mount. Slugs, short and stable, and the ONLY mint of them. */
const FEEDBACK_SLUGS = {
  hub: true,
  census: true,
  "roast-menu": true,
  "round-end": true,
  "roast-review": true,
  editor: true,
  roster: true,
} as const;

/** An origin slug. The only value `FeedbackForm.from` and the door's `where` will accept. */
export type FeedbackSlug = keyof typeof FEEDBACK_SLUGS;

/**
 * The one gate for raw URL input. A missing or unrecognised `?from=` is not an error — it means no
 * prefix on the message, never an empty bracket and never arbitrary text smuggled into the table.
 */
export const isFeedbackSlug = (value: string | null): value is FeedbackSlug =>
  value !== null && value in FEEDBACK_SLUGS;

const FeedbackDoor = ({
  where,
  className,
}: {
  where: FeedbackSlug;
  /** The room's own exit className — `.exit` in the ROAST rooms, the lounge's Tailwind register at the hub and the Census. */
  className?: string;
}) => (
  <Link
    to={`/feedback?from=${where}`}
    className={cn(
      "inline-flex min-h-[44px] items-center px-2 font-body text-xs text-muted-foreground",
      "underline underline-offset-2 transition-colors hover:text-cream focus-visible:text-cream",
      className
    )}
  >
    say something
  </Link>
);

export default FeedbackDoor;
