// ============================================================================
// BarNerd BCB 2026 — standalone consent page configuration (EXAMPLE)
// ============================================================================
//
// HOW TO USE:
//   1. Copy this file to `config.js` in the SAME folder. (`config.js` is
//      git-ignored — it must never be committed.)
//   2. Fill the two values below from
//      `.env.production` at the census repo root (this repo,
//      `01_BarNerd/apps/census`):
//
//         VITE_SUPABASE_URL       ->  supabaseUrl
//         VITE_SUPABASE_ANON_KEY  ->  supabaseAnonKey
//
//   3. Leave the placeholders exactly as they are until you have the real
//      values: the page detects them and refuses to submit, loudly. A capture
//      that silently discarded a stranger's email is the worst outcome this
//      page could produce, so a placeholder is a hard failure by design.
//
// WHY THE ANON KEY IS STILL NOT IN GIT:
//   The Supabase anon key is publishable by design — it is meant to ship in a
//   browser. The operator's standing rule is that no key is ever hardcoded or
//   committed, and this folder honours that: the key lives only in the local,
//   git-ignored `config.js` the operator carries to the deploy.
// ============================================================================

window.BCB_CONFIG = {
  // Your Supabase project URL, e.g. "https://abcdefgh.supabase.co"
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",

  // The anon (publishable) key from the same project.
  supabaseAnonKey: "REPLACE_WITH_SUPABASE_ANON_KEY",

  // OPTIONAL. The Edge Function that sends the double-opt-in confirmation email
  // (`waitlist-confirm-request`, deployed from this repo, needs Resend).
  // Leave as "" to use the default:
  //     <supabaseUrl>/functions/v1/waitlist-confirm-request
  // If this is unset/unreachable the page still STORES the contact and then
  // says so plainly: "stored, confirmation not sent". Capture never depends on
  // the mail path being up.
  confirmFunctionUrl: ""
};
