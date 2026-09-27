import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { generateHandles } from "@/lib/handleGenerator";

/**
 * How many handles the rail offers. Five, plus Anonymous: the author's read was that
 * eighteen chips is a decision the visitor has to make before they can make the one they
 * came for. A short rail is a suggestion; a long one is a menu.
 */
const HANDLE_COUNT = 5;
import { clearNickname, setNickname } from "@/lib/nickname";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import MenuCard from "@/components/MenuCard";
import MartiniMark from "@/components/MartiniMark";
import { playRoastWipe } from "@/lib/roastWipe";

/**
 * The roast entry step: what to call the visitor.
 *
 * ONE QUESTION, AND IT IS OPTIONAL:
 *   The roast is a judgement of the visitor's own specs, so it needs a name to attach
 *   to it — but not an identity. There is no role question, no city, no demographics,
 *   no account and no network call here. The value is written to localStorage and
 *   nowhere else.
 *
 * WHY "ANONYMOUS" AND "SKIP" ARE THE SAME ACTION:
 *   They are the same intent reached from two places: the chip is the option sitting
 *   among the alternatives, the skip link is the escape hatch for someone who has
 *   already decided. Both clear the nickname and move on, so neither can leave a
 *   half-filled name behind.
 */

const chipClass = (selected: boolean) =>
  cn(
    "inline-flex min-h-[44px] items-center rounded-full border px-4 font-body text-sm transition-colors",
    selected
      ? "border-gold bg-gold/15 text-gold"
      : "border-concrete/25 text-muted-foreground hover:border-gold/40 hover:text-cream"
  );

const RoastEnter = () => {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [handles, setHandles] = useState<string[]>(() => generateHandles(HANDLE_COUNT));
  /*
   * The DoubleCircle wipe, out to the deck. Started by the two handlers below and by nothing else in
   * the app: not by the router, not by the deck, not on the way back.
   *
   * WHY IT LIVES HERE AND NOT AT THE ROUTER:
   *   A page change in this product is a page of the menu arriving, and that already belongs to
   *   MenuCard, which turns itself in on mount. This is a different gesture and it belongs to a
   *   different thing: ONE deliberate press of "Let's go", the single action on this page that
   *   commits the visitor to the room, arriving at a loud card. It is a transition between two
   *   specific surfaces, and a router-level wrapper could only have expressed it as "every route
   *   change" — including the ones where it would be wrong. Card to card, back to the hub, the
   *   verdict out to anywhere.
   *
   *   The router-level version was written and cut twice; App.tsx lines 12-19 are the record of it.
   *   The reason is not taste. A sheet laid over a route change freezes a blank full-screen rectangle
   *   for the length of the turn, and a blank rectangle during a page change reads as LOADING. That
   *   sheet covered the wrong thing, for the wrong length, over the wrong number of navigations.
   *   Here it covers a page that is deliberately being left, for about a second and a half, once.
   *   And the black it ends on is the black the deck opens ON, not the black it opens after: the
   *   wipe closes, changes the page underneath itself while it is fully closed, and then reopens.
   *   The deck arrives out of black instead of appearing after a pause on it, so there is no frame
   *   anywhere in the sequence a visitor could read as a stall — which is the same reading that
   *   killed the router sheet, arrived at from the other direction.
   *
   *   WHICH IS WHY THE OVERLAY IS NOT PART OF THIS TREE, and why that is not an implementation
   *   detail. A wipe that reopens has to still be on screen after the navigation, and a component
   *   mounted here is unmounted by that navigation — the reveal would have had nothing to reveal.
   *   So the overlay is appended to `document.body` by a plain module (`lib/roastWipe.ts`) and
   *   outlives the route change by construction: React's reconciler can only remove nodes that are
   *   reachable from its roots, and that one is above them. What this page does is hand the
   *   transition the page change to make, not render it.
   *
   *   `prefersReducedMotion` is the same call the hub's cover makes (see pages/Hub.tsx, `goTo`): the
   *   effect being opted out of is the wipe itself, and holding the page for a second and a half with
   *   nothing on it is a stall rather than a transition. So the reduced path is a plain navigate,
   *   below, and `wiping` is never set at all — not set and then immediately cleared, which would be
   *   the same stall with a wasted render attached. `playRoastWipe` checks the setting itself too and
   *   returns without creating an overlay; the check is repeated here because this one is what stops
   *   the page starting a transition that will not run, and the transition cannot do that for itself.
   */
  const [wiping, setWiping] = useState(false);

  /** Persist a name (or the absence of one). Never throws — see lib/nickname.ts. */
  const save = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed) setNickname(trimmed);
    else clearNickname();
  };


  /*
   * THE GUARD, and the reason it is here rather than only on the buttons.
   *
   * The wipe's canvas covers the screen for about a second and a half and takes pointer events, so
   * in practice a second press cannot reach this page at all. But the canvas is the mitigation for
   * the click, and the click is not the only way to get here: a keyboard on the button, a script, or
   * a stylesheet that failed to load all arrive at these handlers directly. If `wiping` is true the
   * intent has already been acted on, and acting on it twice would run a second transition and push
   * a history entry the visitor never made — which on a browser back button means leaving the roast
   * and having to come back in. The cheapest check that cannot be wrong.
   *
   * `wiping` no longer decides whether anything is rendered — there is nothing of the transition in
   * this tree to render. It is purely a latch now: set once, and never cleared, because the page it
   * belongs to is unmounted about a second and a half later by the navigation the transition makes
   * itself. It stays state rather than becoming a ref because a ref is not a latch a render can see,
   * and a latch a render can see is one that survives anything a future render might do to the page.
   *
   * Both handlers, and both buttons, because skip and commit are the same action: the same page, the
   * same destination, the same second and a half. A guard on one of them would leave the other open.
   *
   * PERSISTENCE IS BEFORE THE ANIMATION, in both, and that ordering is the load-bearing part of
   * this block rather than a style preference. `setNickname` is the only write on this page and it
   * happens before a single frame is painted, so a visitor whose tab dies, whose battery gives out
   * or whose browser throws away the transition's promise has still told the room who they are. The
   * animation is the one part of this action that is allowed to fail; the name is not.
   */
  const commit = () => {
    if (wiping) return;
    save(value);
    if (prefersReducedMotion()) {
      navigate("/roast/deck");
      return;
    }
    setWiping(true);
    // Fire-and-forget, deliberately. Nothing on this page renders from the resolution — the page
    // change is made BY the transition, mid-sequence, not by this promise — so there is nothing to
    // await and nothing to store. The `void` says so out loud, because a floating promise that
    // cannot reject (see lib/roastWipe.ts) is otherwise the first thing a reviewer would ask about.
    void playRoastWipe(() => navigate("/roast/deck"));
  };

  const skip = () => {
    if (wiping) return;
    setValue("");
    save("");
    if (prefersReducedMotion()) {
      navigate("/roast/deck");
      return;
    }
    setWiping(true);
    // Same three steps as commit, same order, same reasons. The cleared name is written before the
    // transition starts, so a half-finished animation cannot leave behind a nickname the visitor
    // meant to drop.
    void playRoastWipe(() => navigate("/roast/deck"));
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-clip px-6 py-12">
      <div className="grain" />
      <MenuCard className="mx-auto w-full max-w-md space-y-6">
        <MartiniMark />
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center font-body text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-gold"
        >
          back
        </Link>

        {/*
          * WHAT AND HOW, then WHY A NAME, then the question.
          *
          * The page opened straight into "What should we call you?" at 24px — the largest thing on
          * the page was the form, and the subject of the page was the smallest. The title below is an
          * h1 now and the question is an h2, so the document outline matches what the eye sees.
          * The two middle lines are the author's own, verbatim.
          */}
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-bold text-gold">The roast</h1>
          <p className="font-body text-base leading-relaxed text-cream">
          ROAST is the arena where specs get measured — by peers, not some office dude.
          </p>
          <p className="font-display text-xl font-bold text-gold">
          My specs, your taste. No mercy.
          </p>
        {/*
          * WHY A NAME IS ASKED FOR, in one line, BEFORE the question it answers.
          * TODO(copy session): this one is mine, not the author's — it says what the code does (the
          * name rides along with the verdicts and never leaves the device) and it is written to be
          * replaced.
          */}
          <p className="font-body text-sm leading-relaxed text-muted-foreground">
          The name goes on your verdicts so the room knows whose taste it was. No account, no
          email — it stays on this device.
          </p>
        </div>

        <h2 className="font-body text-base font-semibold text-cream">What should we call you?</h2>

        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Your name, or a handle"
          maxLength={32}
          className="min-h-[48px] w-full rounded-xl border border-gold/20 bg-card px-4 font-body text-cream transition-colors placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none"
        />

        <section className="space-y-3">
          <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
            Or pick a handle
          </p>

          <div className="flex flex-wrap gap-2">
            {handles.map((handle) => (
              <button
                key={handle}
                type="button"
                onClick={() => setValue(handle)}
                className={chipClass(value === handle)}
              >
                {handle}
              </button>
            ))}

            {/* Reads as selected while the input is empty, because empty IS anonymous. */}
            <button
              type="button"
              onClick={() => setValue("")}
              className={chipClass(value.trim() === "")}
            >
              Anonymous
            </button>
          </div>

          <button
            type="button"
            onClick={() => setHandles(generateHandles(HANDLE_COUNT))}
            className="inline-flex min-h-[44px] items-center font-body text-xs uppercase tracking-widest text-gold transition-colors hover:text-gold-light"
          >
            roll again
          </button>
        </section>

        <button
          type="button"
          onClick={commit}
          className="min-h-[48px] w-full rounded-full bg-gold px-8 py-3 font-body font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          Let's go
        </button>

        <button
          type="button"
          onClick={skip}
          className="mx-auto block min-h-[44px] font-body text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-gold"
        >
          skip
        </button>
      </MenuCard>
    </div>
  );
};

export default RoastEnter;
