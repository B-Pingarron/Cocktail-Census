import { useId, useState } from "react";
import type { FormEvent } from "react";
import { ASK_COPY } from "@/data/roomCopy";
import type { AskOptionId } from "@/data/roomCopy";
import { CONTROLLER_EMAIL_FILLED } from "@/lib/consentText";
import { joinWaitlist } from "@/lib/waitlist";
import { cn } from "@/lib/utils";

/**
 * The ask — one form, mounted at the end of every room and in the lounge.
 *
 * CURRENTLY SWITCHED OFF. `ASK_DISABLED` below returns `null` before anything renders, so the
 * three mounts are still in place but nothing is captured in this app. The decision, and the
 * standalone page that captures instead, are ADR-036.
 *
 * ONE COMPONENT, THREE PLACES: the visitor decides once. Four copies of this form would be
 * four places to keep the consent wording correct, and the consent wording is the part that
 * must not drift.
 *
 * THE THREE BOXES ARE INDEPENDENT ON PURPOSE. Asking about the Recipe Manager is not asking
 * about the ROAST beta, and someone who only wants the newsletter must not be made to
 * volunteer for a beta to get it. Nothing is pre-ticked: an unticked box is not a request.
 *
 * THE CONSENT BLOCK IS RENDERED, NOT REWRITTEN, AND IN BOTH LANGUAGES. The audience is an
 * international trade fair in Berlin; German-only or English-only is both wrong. The text
 * comes from `consent.v1.json` via `consentText.ts`, with the controller-email parameter
 * substituted at load — `whitespace-pre-wrap` so the line breaks survive, `lang`
 * attributes so a screen reader switches voice — and the
 * trailing notice label links relatively to `datenschutz.html` (`base: "./"`; an absolute
 * path would break on GitHub Pages).
 *
 * WHILE THE CONTROLLER ADDRESS IS STILL THE PLACEHOLDER, THIS FORM REFUSES. The consent
 * text names a contact address a data subject must be able to write to and withdraw by
 * (Art. 13(1)(a) DSGVO). If `controller.email` in consent.v1.json is still the
 * `__CONTROLLER_EMAIL__` marker, the blocks would name a placeholder — so the form shows
 * a loud banner and the submit button does nothing. Failing quiet here would mean
 * capturing a stranger's address under a consent that names nobody.
 *
 * WHAT HAPPENS ON SUCCESS IS EXACTLY WHAT HAPPENED, AND THERE ARE TWO REAL SUCCESSES. The
 * insert is the primary outcome; the confirmation-email request can fail on top of it.
 * "Stored and sent" and "stored but not sent" are different facts for the visitor and get
 * different strings — a confirmation that implies mail went out when it did not is the
 * same class of lie the old "no confirmation email" line was, just facing the other way.
 *
 * THE FAILURE PATH IS VISIBLE ON PURPOSE. If the insert fails, the form says so and keeps
 * the address the visitor typed, so the second attempt is one tap and not a retype. A contact
 * that was only written locally would be a contact the visitor believes they gave and nobody
 * has.
 */

/**
 * The ask is switched off in the app (2026-10-12, ADR-036 — "the app is not a capture surface").
 *
 * WHY A FLAG AND NOT A DELETED COMPONENT: the decision is that this app stops collecting
 * addresses while the standalone BCB 2026 page collects them. That is one product decision and it
 * should cost one line to reverse — `true` back to `false` — because the copy, the consent block
 * and the double-opt-in write are all still correct and still tested. Deleting the component would
 * make a later re-enable a rewrite. The three mounts (`RoomExplainer`, `About`, `Hub`) are left
 * exactly where they are for the same reason: they are correct, and touching three files to hide
 * one component would put this change into files it has no business in.
 *
 * WHY NOT A RUNTIME SWITCH: an address capture that can be toggled by configuration is a capture
 * that can be live by accident. This is a build-time fact, in one place, with a file header that
 * says why — and the consent surface that replaced it is a different page in a different deploy.
 *
 * WHAT STILL GUARDS THE RE-ENABLE: `CONTROLLER_EMAIL_FILLED` below. If the flag is ever turned
 * back on while `controller.email` is still the placeholder marker, the form refuses to submit and
 * says so. Nothing here was weakened to disable the ask.
 */
const ASK_DISABLED: boolean = true;

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
  // The flag is a module constant, so the hook order below is identical on every render.
  if (ASK_DISABLED) return null;

  const uid = useId();
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<AskOptionId[]>([]);
  // "sent" and "sent-no-confirm" are both successes of the primary outcome (the row exists)
  // and are kept apart because the visitor is owed the distinction.
  const [state, setState] = useState<"idle" | "sending" | "sent" | "sent-no-confirm">("idle");
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
    // Belt and braces: the button is already disabled while the address is the marker —
    // a submit that got past that must still not capture under a placeholder contact.
    if (!CONTROLLER_EMAIL_FILLED) return;

    setState("sending");
    setProblem(null);

    const result = await joinWaitlist(email, picked);

    if (result.ok) {
      setState(result.confirmation === "sent" ? "sent" : "sent-no-confirm");
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

  if (state === "sent" || state === "sent-no-confirm") {
    return (
      <div className={cn("space-y-3 border-t border-gold/20 pt-6 text-center", className)}>
        <p className="font-body text-sm leading-relaxed text-cream">
          {state === "sent" ? ASK_COPY.success : ASK_COPY.successNoConfirm}
        </p>
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

      {/* Loud, unmissable configuration refusal: the consent text would name the
          placeholder contact address. Nothing is captured while this banner shows. */}
      {!CONTROLLER_EMAIL_FILLED && (
        <p
          role="alert"
          className="rounded-xl border-2 border-red-500/70 bg-red-950/60 px-4 py-3 font-body text-xs leading-relaxed text-red-200"
        >
          Kontaktadresse nicht ausgefüllt: die Einwilligung nennt noch die Platzhalteradresse
          __CONTROLLER_EMAIL__. Diese Oberfläche darf so nicht live gehen.
          <br />
          Contact address not filled: the consent still names the placeholder
          __CONTROLLER_EMAIL__. This surface must not go live.
        </p>
      )}

      {/* The verbatim legal text, both languages, German first. `pre-wrap` keeps the line
          breaks and the two-space checkbox indent of the canonical block; nothing here
          rewords or reorders a single line — only the controller-email parameter is
          substituted (consentText.ts). */}
      <div
        id={`${uid}-consent`}
        className="space-y-4 rounded-xl border border-cream/10 bg-card/50 px-4 py-4"
      >
        <p lang="de" className="whitespace-pre-wrap font-body text-xs leading-relaxed text-muted-foreground">
          {ASK_COPY.consent.de}
        </p>
        <p lang="en" className="whitespace-pre-wrap font-body text-xs leading-relaxed text-muted-foreground">
          {ASK_COPY.consent.en}
        </p>
        <p className="font-body text-xs leading-relaxed">
          <a href={ASK_COPY.consent.noticeHref} className="text-gold underline underline-offset-2 hover:text-gold-light">
            {ASK_COPY.consent.noticeDe}
          </a>
          <span className="text-muted-foreground"> · </span>
          <a href={ASK_COPY.consent.noticeHref} className="text-gold underline underline-offset-2 hover:text-gold-light">
            {ASK_COPY.consent.noticeEn}
          </a>
        </p>
      </div>

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
              <span className="font-body text-sm leading-snug">
                <span lang="de" className="block">
                  {option.labelDe}
                </span>
                <span lang="en" className="block text-muted-foreground">
                  {option.label}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {problem && (
        <p role="status" className="font-body text-xs leading-relaxed text-gold-light">
          {problem}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending" || !CONTROLLER_EMAIL_FILLED}
        className="min-h-[48px] w-full rounded-full bg-gold px-8 py-3 font-body font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state === "sending" ? "Saving…" : ASK_COPY.submit}
      </button>
    </form>
  );
};

export default PartyAsk;
