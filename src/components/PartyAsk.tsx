import { useId, useState } from "react";
import type { FormEvent } from "react";
import { ASK_COPY } from "@/data/roomCopy";
import type { AskOptionId } from "@/data/roomCopy";
import { joinWaitlist } from "@/lib/waitlist";
import { cn } from "@/lib/utils";

/**
 * The ask — one form, mounted at the end of every room and in the lounge.
 *
 * ONE COMPONENT, THREE PLACES: the visitor decides once. Four copies of this form would be
 * four places to keep the consent wording correct, and the consent wording is the part that
 * must not drift.
 *
 * THE THREE BOXES ARE INDEPENDENT ON PURPOSE. Asking about the Recipe Manager is not asking
 * about the ROAST beta, and someone who only wants the newsletter must not be made to
 * volunteer for a beta to get it. Nothing is pre-ticked: an unticked box is not a request.
 *
 * WHAT HAPPENS ON SUCCESS IS EXACTLY WHAT HAPPENED. A row is written, and the confirmation
 * says the choices are in. There is no email, so the copy does not promise one — see the
 * consent line, and see the waitlist table for why nothing sends mail.
 *
 * THE FAILURE PATH IS VISIBLE ON PURPOSE. If the insert fails, the form says so and keeps
 * the address the visitor typed, so the second attempt is one tap and not a retype. A contact
 * that was only written locally would be a contact the visitor believes they gave and nobody
 * has.
 */

/** The chip styling, matching the nickname rail on the ROAST entry screen. */
const chipClass = (checked: boolean) =>
  cn(
    "flex min-h-[44px] w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
    checked
      ? "border-gold bg-gold/15 text-cream"
      : "border-cream/15 text-muted-foreground hover:border-gold/40 hover:text-cream"
  );

interface PartyAskProps {
  /** Rendered above the form. The rooms already have a title, so the ask does not add one there. */
  className?: string;
}

const PartyAsk = ({ className }: PartyAskProps) => {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<AskOptionId[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const toggle = (id: AskOptionId) => {
    setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    // Clearing the problem on the next edit is the point: a message that survives the fix is
    // a message arguing with the visitor.
    setProblem(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (state === "sending") return;

    setState("sending");
    setProblem(null);

    const result = await joinWaitlist(email, picked);

    if (result.ok) {
      setState("sent");
      return;
    }

    setState("idle");
    // Three distinct failures, three messages, each its own string in the copy. Deriving one
    // from another by string replacement is how a message ends up saying the wrong thing
    // quietly, and this is the one place where saying the wrong thing is a consent problem.
    setProblem(
      result.reason === "no-interests"
        ? ASK_COPY.noInterests
        : result.reason === "no-email"
          ? ASK_COPY.emptyEmail
          : ASK_COPY.error
    );
  };

  if (state === "sent") {
    return (
      <div className={cn("space-y-3 border-t border-gold/20 pt-6 text-center", className)}>
        <p className="font-body text-sm leading-relaxed text-cream">{ASK_COPY.success}</p>
        <p className="font-body text-xs text-muted-foreground">No email was sent. We only write when there is something to say.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn("space-y-4 border-t border-gold/20 pt-6", className)} noValidate>
      <label className="block space-y-2">
        <span className="font-body text-xs uppercase tracking-widest text-gold">{ASK_COPY.emailLabel}</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={ASK_COPY.emailPlaceholder}
          autoComplete="email"
          inputMode="email"
          aria-describedby={`${uid}-consent`}
          className="min-h-[48px] w-full rounded-xl border border-gold/20 bg-card px-4 font-body text-cream transition-colors placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="font-body text-xs uppercase tracking-widest text-gold">Pick any</legend>
        {ASK_COPY.options.map((option) => {
          const checked = picked.includes(option.id);
          return (
            <label key={option.id} className={chipClass(checked)}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]"
              />
              <span className="font-body text-sm leading-snug">{option.label}</span>
            </label>
          );
        })}
      </fieldset>

      <p id={`${uid}-consent`} className="font-body text-xs leading-relaxed text-muted-foreground">
        {ASK_COPY.consent}
      </p>

      {problem && (
        <p role="status" className="font-body text-xs leading-relaxed text-gold-light">
          {problem}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="min-h-[48px] w-full rounded-full bg-gold px-8 py-3 font-body font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state === "sending" ? "Saving…" : ASK_COPY.submit}
      </button>
    </form>
  );
};

export default PartyAsk;
