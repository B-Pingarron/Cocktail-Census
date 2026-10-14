import { useSearchParams } from "react-router-dom";
import ExitLink from "@/components/ExitLink";
import { isFeedbackSlug } from "@/components/FeedbackDoor";
import FeedbackForm from "@/components/FeedbackForm";

/**
 * The feedback page — the one destination every room's feedback door leads to.
 *
 * WHY A DEDICATED ROUTE: the form used to exist in exactly one place, the Census completion
 * screen, so an opinion about a ROAST room required finishing a hundred-card survey first. The
 * form is NOT duplicated into each room; every door links here, and the form lives once.
 *
 * `?from=` DEGRADES SANELY: a missing or unrecognised slug means NO prefix, never an empty bracket
 * and never arbitrary text. `isFeedbackSlug` is the door's own frozen map, so the URL can never
 * smuggle a value into the message table that the app did not mint.
 *
 * WHY IT CARRIES ITS OWN ExitLink: ExitLink exists because "the two screens that mattered most had
 * no way out at all" — a new reachable page with no way back repeats that sin. The exit is HUB,
 * chosen rather than derived: this page is reachable from every room, so no single room is "back",
 * and the hub is the one place every room hangs off. It sits above the fold, first in the column,
 * for the same reason every room's exit cluster does.
 */
const Feedback = () => {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get("from");
  const from = isFeedbackSlug(raw) ? raw : undefined;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <ExitLink />
        <h1 className="font-display text-2xl font-bold text-gold">Feedback</h1>
        <p className="font-body text-sm text-muted-foreground leading-relaxed">
          A recipe, a room, or the app itself — wrong, missing, or worth saying.
          No account, no email needed.
        </p>
        <FeedbackForm from={from} />
      </div>
    </div>
  );
};

export default Feedback;
