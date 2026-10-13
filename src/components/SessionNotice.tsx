import { cn } from "@/lib/utils";

/**
 * The session line at the ROAST entry — what the browser keeps, said before the visitor taps in.
 *
 * WHY A LINE AND NOT A CHECKBOX:
 *   A checkbox frames a mechanism as something the visitor can refuse. They cannot: ROAST, the
 *   Census and the spec editor are all "specs where session_id = me", so without the identifier
 *   there is nothing to write a vote or a draft onto. A consent that cannot be withheld is not
 *   freely given (Art. 7 Abs. 4 DSGVO), so asking for it would be theatre. It is informed —
 *   this line — not consented. The identifier is also not a name, so there is nothing to ask
 *   *about*; there is only something to say. That decision is ADR-036.
 *
 * WHY THE WORD "ANONYMOUS" IS NOT IN THE TEXT:
 *   "Anonymous" is a contestable legal classification, and a claim like that is exactly the sort
 *   of thing this project has already had to walk back. The mechanism is the verifiable fact: a
 *   random identifier, minted in the browser, that carries your votes, your rounds and your
 *   specs. The line states the mechanism and lets the classification look after itself.
 *
 * WHY IT NAMES ALL THREE USES AND NOT ONLY ROAST:
 *   `getSessionId` (`src/lib/session.ts`) is one identifier shared by the Census votes, the ROAST
 *   rounds and the Recipe Manager's specs. Scoping this line to ROAST alone would be narrower
 *   than the truth, and a visitor who reads it here and then votes in the Census would have been
 *   told about one third of the thing. All three, or the line is false.
 *
 * WHY IT DOES NOT CONTRADICT THE APP'S PRIVACY NOTICE:
 *   The app's notice (`public/datenschutz.html`) says the nickname never leaves the browser, and
 *   that publishing a Submission stores only the fixed byline "Anonymous". This line says the same
 *   thing from the other side: the identifier carries your votes and your specs, "not your name".
 *   Neither text attaches a name to the identifier — the byline belongs to the Submission (a
 *   published act with a fixed label), not to the session. Keep the two sentences legible
 *   together if either is ever reworded.
 *
 * WHY THE MOUNT IS IN RoomExplainer AND NOT IN RoastEnter:
 *   The ROAST entry screen was being rewritten by a concurrent session while this landed. This is
 *   an informational line, so it waits for that pass rather than merging into it. The deferral is
 *   recorded in odd/tasks/barnerd-bcb-consent.md; until then the line renders on the ROAST room
 *   explainer only, which is the screen before the door.
 *
 * WHY IT HAS NO COPY COMPANION IN `roomCopy.ts`:
 *   One mount, one sentence per language, no legal wording and no canonical source to keep in
 *   step. A second home for two lines would create the drift the rest of this tree works to avoid.
 */

/** The two sentences, unchanged and in this order. Not derived, not translated at runtime. */
const SESSION_NOTICE_COPY = {
  de: "Dieser Browser merkt sich eine zufällige Kennung. Deine Votes im Census, deine Runden in ROAST und deine Specs hängen an dieser Kennung — nicht an deinem Namen und nicht an deiner E-Mail.",
  en: "This browser remembers a random identifier. Your Census votes, your ROAST rounds and your specs hang on that identifier — not on your name and not on your email.",
} as const;

const SessionNotice = ({ className }: { className?: string }) => (
  <div
    data-section="session-notice"
    className={cn("space-y-2 border-t border-cream/10 pt-6", className)}
  >
    <p lang="de" className="font-body text-sm leading-relaxed text-cream">
      {SESSION_NOTICE_COPY.de}
    </p>
    <p lang="en" className="font-body text-sm leading-relaxed text-muted-foreground">
      {SESSION_NOTICE_COPY.en}
    </p>
  </div>
);

export default SessionNotice;
