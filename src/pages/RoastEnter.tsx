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
import { cn } from "@/lib/utils";
import MenuCard from "@/components/MenuCard";
import MartiniMark from "@/components/MartiniMark";

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

  /** Persist a name (or the absence of one). Never throws — see lib/nickname.ts. */
  const save = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed) setNickname(trimmed);
    else clearNickname();
  };

  const commit = () => {
    save(value);
    navigate("/roast/deck");
  };

  const skip = () => {
    setValue("");
    save("");
    navigate("/roast/deck");
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
