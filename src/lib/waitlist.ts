import { supabase } from "@/lib/supabase";
import { getSessionId } from "@/lib/session";
import type { AskOptionId } from "@/data/roomCopy";

/**
 * The waitlist write.
 *
 * WHY IT IS A PLAIN INSERT AND NOT SUPABASE AUTH:
 *   ADR-035. The ask collects a contact, it does not create an identity. Auth would mean
 *   OTP, an email send, and a second identity path on top of the local session that already
 *   exists — and it would spend a 2-per-hour email quota that a hall on shared wifi shares
 *   with everyone else in it. A table insert costs nothing, sends nothing, and has no quota.
 *
 * WHY THERE IS NO "ARE YOU SURE" AND NO CONFETTI:
 *   Nothing was sent. Saying "thanks, we'll be in touch" would imply a message exists. The
 *   confirmation says the choices are in, which is the whole truth of the request.
 *
 * WHY A MISSING CLIENT IS A FAILURE AND NOT A SILENT LOCAL SAVE:
 *   `supabase` is null when the env vars are missing, and the rest of the app fails soft to
 *   a local vote. That is right for a vote and wrong here: a contact that was only written
 *   to localStorage is a contact the visitor believes they gave and nobody has. So this
 *   reports the failure rather than pretending. A vote can be re-cast; an email cannot.
 */

export type WaitlistResult = { ok: true } | { ok: false; reason: "no-client" | "no-email" | "no-interests" | "failed" };

/**
 * A shape check, not a validator. The database has its own bound and the honest thing is to
 * reject the obvious mistakes here and let a genuinely odd address through to the
 * constraint rather than arguing with a regex.
 */
const looksLikeAnEmail = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length >= 3 && trimmed.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

/**
 * Store one contact and the interests they ticked.
 *
 * `interests` is de-duplicated and the empty case is rejected before the network call: an
 * insert that cannot satisfy the table's own constraint should not be sent to find out.
 */
export async function joinWaitlist(email: string, interests: AskOptionId[]): Promise<WaitlistResult> {
  const address = email.trim();

  if (!looksLikeAnEmail(address)) return { ok: false, reason: "no-email" };

  const picked = Array.from(new Set(interests));
  if (picked.length === 0) return { ok: false, reason: "no-interests" };

  if (!supabase) {
    console.warn("[waitlist] no Supabase client, so the contact was not stored");
    return { ok: false, reason: "no-client" };
  }

  const { error } = await supabase.from("waitlist").insert({
    email: address,
    interests: picked,
    // Nullable by design, and never asked for: it exists so a later beta invite can find
    // someone who also voted. getSessionId is local and never blocks.
    session_id: getSessionId(),
  });

  if (error) {
    console.warn("[waitlist] the contact did not save", error);
    return { ok: false, reason: "failed" };
  }

  return { ok: true };
}
