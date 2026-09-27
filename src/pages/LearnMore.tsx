import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cocktails } from "@/data/cocktails";
import { clearState, loadState } from "@/lib/censusState";
import MartiniMark from "@/components/MartiniMark";
import { setIntroHidden } from "@/lib/intro";
import MenuCard from "@/components/MenuCard";
import ExitLink from "@/components/ExitLink";

/**
 * Landing page — the first thing a visitor sees, and the target for a single QR code.
 *
 * Lives at /census rather than / so that / stays free for the hub (D5: one origin, hub at /,
 * census at /census). The bare / route redirects here, so an existing link or bookmark to
 * the site root keeps working.
 */
const LearnMore = () => {
  const [introVisible, setIntroVisible] = useState(false);
  const navigate = useNavigate();

  // Read once on mount: the landing only needs to know whether to offer "continue".
  const saved = useMemo(() => loadState(), []);
  const voted = saved?.votes.length ?? 0;
  const finished = Boolean(saved?.finished) && voted > 0;

  const start = () => navigate("/census/vote");

  const startOver = () => {
    clearState();
    navigate("/census/vote");
  };

  const label = finished
    ? "See the results"
    : voted > 0
      ? "Continue where you left off"
      : "Start the census";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-clip px-6 py-12">
      <div className="grain" />
      <MenuCard className="w-full max-w-md space-y-8">
        <MartiniMark />

        <header className="space-y-3 text-center">
          <h1 className="font-display text-4xl font-bold text-gold">The Cocktail Census</h1>
          <p className="font-body text-muted-foreground">Vote on recipes. Shape the standard.</p>
          {/*
            The emergency exit, in the header. The intro sends you here and the CTA sends you
            into the vote, so a visitor who came to read and then changed their mind was left
            with only the browser's back gesture — and at the foot of a long page it is not an
            escape hatch, it is a footer. Same reasoning as the ROAST verdict: the way out
            belongs where it is already on screen, not at the end.
          */}
          <div className="flex justify-center">
            <ExitLink />
          </div>
        </header>

        <section className="space-y-4 font-body text-sm leading-relaxed text-muted-foreground">
          <p>
            Every bartender builds a Negroni a little differently. The Cocktail Census is an
            attempt to find out which version most people actually agree with.
          </p>
          <p>
            It is part of <span className="text-foreground">BarNerd</span>: a project working
            towards a shared, community-agreed reference for the classics — the spec you would
            write down if everyone had to settle on one.
          </p>
          <p>
            One hundred classics, two buttons. No account, no email, no personal data. Every
            vote is anonymous, and you can step back and change your mind as you go.
          </p>
        </section>

        <section className="space-y-3 border-t border-gold/20 pt-6 font-body text-sm text-muted-foreground">
          <h2 className="text-xs uppercase tracking-widest text-gold">How it works</h2>
          <ul className="space-y-2 leading-relaxed">
            <li>
              You are judging the <span className="text-foreground">recipe</span>, not the
              drink: the ingredients, the method, the glass, the garnish. Agree if that is how
              you would make it.
            </li>
            <li>
              <span className="text-foreground">Swipe right</span> to agree,{" "}
              <span className="text-foreground">swipe left</span> to disagree. On a keyboard,{" "}
              <span className="text-foreground">→</span> and{" "}
              <span className="text-foreground">←</span> do the same.
            </li>
            <li>
              Changed your mind? <span className="text-foreground">Previous drink</span> steps
              back one.
            </li>
            <li>
              Nothing here is marked correct or incorrect. One vote per cocktail, and you can
              stop and come back at any time.
            </li>
          </ul>
        </section>

        <div className="space-y-4 text-center">
          <button
            onClick={start}
            className="w-full min-h-[48px] rounded-full bg-gold px-8 py-3 font-body font-medium text-[var(--background)] transition-opacity hover:opacity-90"
          >
            {label}
          </button>

          {/*
           * Wave 6: the honest effort estimate.
           *
           * The page asked for a hundred judgements and never said how long that takes. For a
           * survey this size the effort is the main drop-off risk: a visitor who assumes "this
           * will take forever" leaves before the first card, and one who assumes two minutes
           * feels misled by card twenty. Saying the number up front — and saying that stopping is
           * allowed — costs a little click-through and buys the completion rate, which is the
           * only metric that matters here.
           */}
          <p className="font-body text-xs text-muted-foreground">
            About 3 minutes for all 100 — and you can stop any time.
          </p>

          {/*
           * Wave 6: the keyboard hint row, desktop only.
           *
           * `trackMouse: false` on the swipe container is deliberate — mouse-drag swiping fights
           * text selection and feels wrong on desktop — so a desktop visitor CANNOT drag the card
           * at all. Their only fast path is the arrow keys, and until now nothing next to the CTA
           * said so: the only mention lived inside the "How it works" list further up the page.
           * Hidden below `md:` because a phone has a thumb and no arrow keys, and the hint would
           * be noise there.
           */}
          <div className="hidden md:flex items-center justify-center gap-2 font-body text-[11px] text-muted-foreground">
            <kbd className="rounded border border-concrete/30 bg-muted px-1.5 py-0.5 font-body text-[11px] leading-none text-foreground/80">
              ←
            </kbd>
            <span>disagree</span>
            <span className="text-muted-foreground">·</span>
            <kbd className="rounded border border-concrete/30 bg-muted px-1.5 py-0.5 font-body text-[11px] leading-none text-foreground/80">
              →
            </kbd>
            <span>agree</span>
          </div>

          {voted > 0 && (
            <p className="text-xs text-muted-foreground">
              {voted} of {cocktails.length} done.{" "}
              <button
                onClick={startOver}
                className="underline underline-offset-2 hover:text-gold transition-colors"
              >
                Start over
              </button>
            </p>
          )}
        </div>
              {/*
          The other half of the intro's preference. The control that turns the intro off lives
          on the intro itself, which is precisely the screen that stops appearing once it is
          on — so the control that turns it back on has to live somewhere else, and this is
          where someone who switched it off would look for it.
        */}
        <div className="border-t border-gold/20 pt-6">
          {introVisible ? (
            <p className="font-body text-xs text-muted-foreground">
              The intro will show again next time you pick the Census.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIntroHidden(false);
                setIntroVisible(true);
              }}
              className="inline-flex min-h-[44px] items-center font-body text-xs uppercase tracking-widest text-gold transition-colors hover:text-gold-light"
            >
              show the intro again
            </button>
          )}
        </div>
      </MenuCard>
    </div>
  );
};

export default LearnMore;
