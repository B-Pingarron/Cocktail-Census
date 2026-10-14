import { useState } from "react";
import type { FeedbackSlug } from "@/components/FeedbackDoor";
import { supabase } from "@/lib/supabase";

/**
 * Free-text feedback, submitted from the completion screen.
 *
 * Replaces a link to GitHub issues: a stranger at a trade fair will not open a GitHub account,
 * but will type a sentence. Three deliberate properties:
 *
 *  1. NOT fail-soft. Votes are fire-and-forget because losing one never blocks the flow. A
 *     feedback message is different — if the insert fails the visitor must be told, or they
 *     believe it was sent and never try again.
 *  2. No identifier is attached. No session id, no vote count, no timestamp from the client. The one
 *     thing that rides INSIDE the message is the origin slug — a bracketed `[slug]` prefix when the
 *     mount supplies one (see `from`). A room name is provenance, not personal data, and it is added
 *     in exactly ONE place (submit below) so the two mount modes — the Census completion screen and
 *     the /feedback page — cannot drift. The table still stores the message and when the server
 *     received it, and the promise the landing page makes is unchanged: no account, no email, no
 *     personal data.
 *  3. Length-capped client-side AND by a CHECK constraint on the table, because this is a
 *     public write endpoint with a free-text field. The client cap is the stricter of the two on
 *     purpose, and the origin prefix is added ON TOP of it — see MAX_LENGTH.
 */

/**
 * The VISITOR'S cap. It does NOT mirror the CHECK constraint in src/db/add-feedback-table.sql —
 * that constraint allows up to 2000. The client is the stricter of the two, deliberately: a
 * textarea that stops at 1000 keeps the message a stranger can type well inside the table's
 * ceiling. The origin prefix (`[slug] `, at most `[roast-review] `) rides ON TOP of this cap at
 * submit time, so the stored message is at most the prefix plus 1000 characters — still far
 * inside the constraint.
 */
const MAX_LENGTH = 1000;

type Status = "idle" | "sending" | "sent" | "failed";

const FeedbackForm = ({ from }: { from?: FeedbackSlug }) => {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const client = supabase;
  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && status !== "sending";

  const submit = async () => {
    if (!client || !canSend) return;
    setStatus("sending");
    /*
     * THE ORIGIN PREFIX, APPLIED HERE AND NOWHERE ELSE. `from` is typed as FeedbackSlug, whose only
     * mint is FeedbackDoor's map, so this can never produce an empty bracket or smuggle arbitrary
     * text into the table; with no origin the message is the visitor's text, unchanged. The prefix
     * rides on top of the visitor's cap rather than out of it — see MAX_LENGTH.
     */
    const body = from ? `[${from}] ${trimmed}` : trimmed;
    const { error } = await client.from("feedback").insert({ message: body });
    if (error) {
      console.warn("[census] feedback insert failed", error);
      setStatus("failed");
      return;
    }
    setMessage("");
    setStatus("sent");
  };

  // No client (env absent) means no way to send — better to show nothing than a dead box.
  if (!client) return null;

  return (
    <div className="space-y-3 text-left" data-section="feedback">
      <h3 className="font-body text-xs uppercase tracking-widest text-gold">Feedback</h3>

      {status === "sent" ? (
        <p className="font-body text-sm text-muted-foreground">
          Thanks for the tip!
        </p>
      ) : (
        <>
          <label htmlFor="census-feedback" className="sr-only">
            Your feedback
          </label>
          <textarea
            id="census-feedback"
            value={message}
            maxLength={MAX_LENGTH}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Anything wrong with a recipe, or missing from the list?"
            className="w-full resize-none rounded-lg border border-concrete/30 bg-card p-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="min-h-[48px] rounded-full bg-gold px-6 py-2 font-body text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "sending" ? "Sending…" : "Send"}
          </button>
          {status === "failed" && (
            <p className="font-body text-xs text-destructive">
              Couldn't send that. Check your connection and try again.
            </p>
          )}
          <p className="font-body text-xs text-muted-foreground">
            Anonymous — no name or email needed.
          </p>
        </>
      )}
    </div>
  );
};

export default FeedbackForm;
