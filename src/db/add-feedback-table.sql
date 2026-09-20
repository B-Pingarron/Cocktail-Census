-- ============================================================
-- Cocktail Census — add the feedback table
--
-- ON THE READ POLICY, WHICH IS THE OPPOSITE OF THE VOTES TABLE
--   Votes carry no identity and their aggregate IS the deliverable, so votes are publicly
--   readable. Feedback is free text a stranger typed, and it must stay private to the
--   project. The anon role therefore gets INSERT only — never SELECT. Read it in the
--   Supabase dashboard table editor, not from the client.
--
--   If you ever add a SELECT policy here, every visitor with the public anon key can read
--   everyone else's feedback.
--
-- RUN THIS IN THE SUPABASE SQL EDITOR. Idempotent: safe to run more than once.
-- ============================================================

create table if not exists public.feedback (
  id         uuid        not null default gen_random_uuid() primary key,
  message    text        not null,
  created_at timestamptz not null default now(),
  -- Bounds the damage from a public write endpoint with a free-text field.
  constraint feedback_message_length check (char_length(message) between 1 and 2000)
);

grant insert on public.feedback to anon;

alter table public.feedback enable row level security;

drop policy if exists "Anyone can leave feedback" on public.feedback;
create policy "Anyone can leave feedback"
  on public.feedback
  for insert
  to anon
  with check (true);

-- Deliberately absent: a select policy for anon.
