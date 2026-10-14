import { supabase } from "@/lib/supabase";
import { BCB_SOURCE, CONSENT_VERSION } from "@/lib/consentText";
import type { AskOptionId } from "@/data/roomCopy";

/**
 * The waitlist write.
 *
 * WHY IT IS A PLAIN INSERT AND NOT SUPABASE AUTH:
 *   ADR-035. The ask collects a contact, it does not create an identity. Auth would mean
 *   OTP, an email send, and a second identity path on top of the local session that already
 *   exists — and it would spend Supabase's built-in 2-per-hour email quota that a hall on
 *   shared wifi shares with everyone else in it. The insert itself costs nothing, sends
 *   nothing, and has no quota. The confirmation email below is a separate, explicit
 *   request to a separate mail path (an Edge Function + Brevo), not a side effect of
 *   the insert and not Supabase Auth.
 *
 * WHY THERE IS A CONFIRMATION EMAIL AT ALL NOW:
 *   Double opt-in. DSK OH Direktwerbung § 3.3 treats it as geboten for consent collected
 *   electronically, and § 3.2 requires the consent's content to be provable — so the row
 *   stores the consent-text version and the token, not just the address. The confirmation
 *   email itself must contain no advertising (BGH VI ZR 134/15); that is the mail path's
 *   concern, not this one's.
 *
 * WHY THE INSERT IS THE PRIMARY OUTCOME AND THE MAIL IS NOT:
 *   Capture happens on the operator's phone, in a hall, once. If the mail path is down and
 *   the insert were rolled into it, the contact would be lost over an outage that the
 *   operator can repair later by sending the confirmation by hand. So the insert commits
 *   first, and a mail failure is reported as exactly what it is — stored, confirmation
 *   not sent — never folded into a success that implies mail went out. This file's rule
 *   from the start has been that a capture which silently did nothing is worse than a
 *   visible error; "stored but not confirmed, and saying so" is the same rule applied to
 *   the mail half of the flow.
 *
 * WHY THE ROW CARRIES NO session_id ANY MORE (removed 2026-10-12, do not put it back):
 *   The column existed so that "the same person who voted on the Census can be recognised" — and
 *   that one write made the anonymity promise the rest of the product makes false, because it
 *   stored a real per-browser identifier next to a real address. The session id is what a Census
 *   vote is attached to, and the app's own notice now says so; joining it to a contact turns an
 *   anonymous vote trail into a named one, which is a processing nobody asked for and no purpose
 *   the consent block disclosed. So the column is dropped in
 *   `src/db/add-waitlist-consent-evidence.sql` and both writers stopped sending it. The column
 *   drop and THIS change are hard-coupled in one release: if the column is gone while a client
 *   still sends the key, PostgREST rejects the whole insert and the capture breaks outright.
 *   Rejected alternatives: keeping the column nullable and simply not writing it (a dead column
 *   that a future reader reconnects), and asking for the id in the consent block (a purpose that
 *   does not exist for a contact list).
 *
 * WHY A MISSING CLIENT IS A FAILURE AND NOT A SILENT LOCAL SAVE:
 *   `supabase` is null when the env vars are missing, and the rest of the app fails soft to
 *   a local vote. That is right for a vote and wrong here: a contact that was only written
 *   to localStorage is a contact the visitor believes they gave and nobody has. So this
 *   reports the failure rather than pretending. A vote can be re-cast; an email cannot.
 */

/**
 * Three honest outcomes, and they are not collapsed into one `ok`:
 *   - "sent": stored, and the confirmation email was actually sent — the mail path
 *     answered 2xx AND said `mailed: true`.
 *   - "not-sent": stored, but no confirmation email left. Either the confirmation
 *     request failed (non-2xx, network) or the endpoint answered 2xx with
 *     `mailed: false` — which it does for an already-confirmed row, where no mail is
 *     due. The consent is valid and the contact exists; `failure` carries why, for the
 *     console — the visitor-facing copy is its own string in roomCopy, never derived
 *     from this one. A non-send must never read as a send: claiming a confirmation is
 *     on its way when nothing left is the lie this feature exists to prevent.
 *   - not ok: nothing was stored. Nothing was sent either.
 */
export type WaitlistResult =
  | { ok: true; confirmation: "sent" }
  | { ok: true; confirmation: "not-sent"; failure: string }
  | { ok: false; reason: "no-client" | "no-email" | "no-interests" | "failed" };

/** The confirmation token's lifetime. Seven days: long enough to open on a laptop later,
 *  short enough that a token copied out of a lost phone is not a live subscription months
 *  on. crypto.randomUUID gives 122 random bits, far beyond what a 7-day online token needs. */
const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Same env var the client is built from; no new variable for the mail path. */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

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
 * Store one contact, the interests they ticked, and the evidence of the consent.
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

  // Minted before the insert so the row is complete at write time: token, dispatch
  // timestamp, expiry. The mail path can then fail without the stored row being partial.
  const confirmToken = crypto.randomUUID();
  const now = Date.now();

  const { error } = await supabase.from("waitlist").insert({
    email: address,
    interests: picked,
    // No session_id: deliberately absent, see the header. The row records a contact and the
    // proof of what they agreed to, and nothing that joins either to the browser's identifier.
    // The evidence. consent_version is the exact wording version the boxes were ticked
    // under (DSK OH § 3.2); source says which surface captured it. Both are why a later
    // dispute is answerable at all.
    consent_version: CONSENT_VERSION,
    source: BCB_SOURCE,
    confirm_token: confirmToken,
    confirm_sent_at: new Date(now).toISOString(),
    confirm_expires_at: new Date(now + CONFIRM_TOKEN_TTL_MS).toISOString(),
  });

  if (error) {
    console.warn("[waitlist] the contact did not save", error);
    return { ok: false, reason: "failed" };
  }

  // From here on the contact exists and the consent is valid; only the mail is in
  // question. Nothing below may undo the success of the insert — it can only report
  // distinctly on top of it.
  //
  // WHY A PLAIN fetch AND NOT THE SUPABASE SDK: the Edge Function is not Supabase Auth
  // and not a table RPC; it is a mail request, and it is expected to be absent until it
  // is built (T6). A bare fetch keeps that boundary honest and fails visibly when the
  // function does not exist — which is the correct behaviour, not a bug to route around.
  try {
    if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL is not set, so the mail path has no address");

    const response = await fetch(`${supabaseUrl}/functions/v1/waitlist-confirm-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: confirmToken }),
    });

    if (!response.ok) {
      throw new Error(`waitlist-confirm-request answered ${response.status} ${response.statusText}`.trim());
    }

    // A 2xx is NOT by itself a send. The endpoint answers 200 with { mailed: false } for an
    // already-confirmed row, where no mail is due — telling the visitor their confirmation
    // is on its way would be a claim nothing backs. Only `mailed: true` is a send; a body
    // that is missing, unparseable, or carries mailed:false is the "stored, not sent"
    // outcome. Erring toward "not sent" is the only safe direction: it never claims a mail
    // that did not leave.
    const body = (await response.json().catch(() => null)) as { mailed?: boolean } | null;
    if (body?.mailed !== true) {
      console.error("[waitlist] contact stored, but no confirmation email was sent:", body);
      return {
        ok: true,
        confirmation: "not-sent",
        failure: `waitlist-confirm-request answered 2xx without mailing (mailed: ${body?.mailed ?? "absent"})`,
      };
    }

    return { ok: true, confirmation: "sent" };
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    // Loud on purpose. The Edge Function does not exist yet, so this branch is the one
    // that will actually run today, and a silent skip here is how "we do double opt-in"
    // quietly becomes another unprovable consent.
    console.error("[waitlist] contact stored, but the confirmation email was not sent:", failure);
    return { ok: true, confirmation: "not-sent", failure };
  }
}
