import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import type { RefObject } from "react";
import MartiniMark from "@/components/MartiniMark";
import { getIntroHidden, setIntroHidden } from "@/lib/intro";

/**
 * The Census intro: six lines, two doors, and a way to never see it again.
 *
 * WHY IT IS A COMPONENT AND NOT A PAGE: it exists in two places — as a face of the hub's card and
 * as the page you land on if you reach /census directly — and two copies of one piece of copy is
 * how this project has already lost time. One definition, two hosts.
 *
 * WHY IT IS SHORT: the long version is not deleted, it lives at /census/learn-more, which the
 * second button points at. This page's only job is to get someone into the deck in a few seconds,
 * or send them to the explanation if they want it.
 *
 * WHY THE TWO LEAVING CONTROLS BEHAVE DIFFERENTLY:
 *   "i know the drill, let's go" is a skip. It remembers nothing, and the next visit asks again.
 *   That is deliberate: one impatient tap should not silently cost a first-timer the explanation
 *   forever.
 *   The quiet checkbox underneath is the preference. It persists, it is off by default, and it is
 *   reversible from /census/learn-more — which is where someone who turned it off would go looking
 *   for it, since the intro itself is precisely the thing that stopped appearing.
 *
 * The copy is a first draft in the user's voice, and is his to reword.
 */
const CensusIntro = ({
  onBack,
  headingRef,
}: {
  /** Present when the intro is a face of the hub's card, where "back" means the menu face. */
  onBack?: () => void;
  /** Attached to the heading so the host can move focus here when this face arrives. */
  headingRef?: RefObject<HTMLHeadingElement>;
}) => {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => getIntroHidden());

  return (
    <>
      <MartiniMark />

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-5 font-display text-4xl font-bold text-gold outline-none"
      >
        The Cocktail Census
      </h1>

      <hr className="mt-5 border-gold/20" />

      <p className="mt-5 font-body text-[15px] leading-relaxed text-gold-light">
        A hundred classics, one at a time. You say whether the spec on screen is how you would make
        it. No account, no email, nothing about you is stored. Three minutes, and you can stop
        whenever. Then you see what the room said.
      </p>

      <div className="mt-8 space-y-3">
        {/*
          The gold pill is the landing page's existing CTA, unchanged. It is this app's one call to
          action and reusing it is cheaper than inventing a second one that says the same thing.
        */}
        <button
          type="button"
          onClick={() => navigate("/census/vote")}
          className="min-h-[48px] w-full rounded-full bg-gold px-8 py-3 font-body font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          i know the drill, let&apos;s go
        </button>

        <Link
          to="/census/learn-more"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-gold/30 px-4 font-body text-xs uppercase tracking-widest text-gold transition-colors hover:bg-gold/10"
        >
          learn more
        </Link>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 border-t border-gold/15 pt-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[44px] items-center font-body text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-cream"
          >
            back
          </button>
        ) : (
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center font-body text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-cream"
          >
            back to the hub
          </Link>
        )}

        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-right font-body text-xs leading-tight text-muted-foreground">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(event) => {
              setHidden(event.target.checked);
              setIntroHidden(event.target.checked);
            }}
            className="h-4 w-4 shrink-0 accent-[var(--gold)]"
          />
          don&apos;t show this again
        </label>
      </div>
    </>
  );
};

export default CensusIntro;
