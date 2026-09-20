import { useState } from "react";
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
 *  2. No identifier is attached. No session id, no vote count, no timestamp from the client.
 *     The table stores the message and when the server received it. That keeps the promise the
 *     landing page makes: no account, no email, no personal data.
 *  3. Length-capped client-side AND by a CHECK constraint on the table, because this is a
 *     public write endpoint with a free-text field.
 */

/** Mirrors the CHECK constraint in src/db/add-feedback-table.sql. */
const MAX_LENGTH = 1000;

type Status = "idle" | "sending" | "sent" | "failed";

const FeedbackForm = () => {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const client = supabase;
  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && status !== "sending";

  const submit = async () => {
    if (!client || !canSend) return;
    setStatus("sending");
    const { error } = await client.from("feedback").insert({ message: trimmed });
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
          Thanks — that helps.
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
            className="w-full resize-none rounded-lg border border-concrete/30 bg-card p-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-gold/50 focus:outline-none"
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
          <p className="font-body text-xs text-muted-foreground/50">
            Anonymous — no name or email needed.
          </p>
        </>
      )}
    </div>
  );
};

export default FeedbackForm;
