import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cocktails } from "@/data/cocktails";
import { clearState, loadState } from "@/lib/censusState";

/**
 * Landing page — the first thing a visitor sees, and the target for a single QR code.
 *
 * Lives at /census rather than / so that / stays free for the hub (D5: one origin, hub at /,
 * census at /census). The bare / route redirects here, so an existing link or bookmark to
 * the site root keeps working.
 */
const Landing = () => {
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
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-3 text-center">
          <h1 className="font-display text-4xl font-bold text-gold">The Cocktail Census</h1>
          <p className="font-body text-muted-foreground">Vote on recipes. Shape the standard.</p>
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
              <span className="text-foreground">Swipe right</span> if the recipe looks right to
              you, <span className="text-foreground">swipe left</span> if it does not.
            </li>
            <li>
              On a keyboard, <span className="text-foreground">→</span> agrees and{" "}
              <span className="text-foreground">←</span> disagrees.
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
          {voted > 0 && (
            <p className="text-xs text-muted-foreground/60">
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
      </div>
    </div>
  );
};

export default Landing;
