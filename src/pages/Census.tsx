import { useState, useCallback, useEffect, useRef } from "react";
import { cocktails } from "@/data/cocktails";
import { CocktailCard } from "@/components/CocktailCard";
import { CardSkeleton } from "@/components/CardSkeleton";
import { ProgressBar } from "@/components/ProgressBar";
import { VoteReceipt } from "@/components/VoteReceipt";
import CensusResults from "@/components/CensusResults";
import FeedbackForm from "@/components/FeedbackForm";
import Wordmark from "@/components/Wordmark";
import type { Vote } from "@/types/cocktail";
import { supabase } from "@/lib/supabase";
import { SWIPE_FLYOFF_DURATION_MS } from "@/components/CocktailCard";
// Local census state lives in one module so the landing page can read saved progress
// without duplicating the storage key.
import { clearState, loadState, saveState } from "@/lib/censusState";
import { getSessionId } from "@/lib/session";

/** How long the vote receipt stays on screen, in ms. Long enough to read both lines. */
const RECEIPT_VISIBLE_MS = 2600;

const Census = () => {
  const [initialised, setInitialised] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [finished, setFinished] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  // Wave 6: the vote receipt currently on screen, or null. `completed` is snapshotted at vote
  // time (see handleVote) and `key` forces a remount so the arrival animation replays on every
  // vote rather than only the first.
  const [lastReceipt, setLastReceipt] = useState<{
    cocktailId: string;
    completed: number;
    key: number;
  } | null>(null);
  // Pending "hide the receipt" timeout. Held in a ref so a new vote can cancel the previous one.
  const receiptTimerRef = useRef<number | null>(null);

  /** Hide the vote receipt now and cancel its pending timeout. */
  const dismissReceipt = useCallback(() => {
    if (receiptTimerRef.current !== null) {
      window.clearTimeout(receiptTimerRef.current);
      receiptTimerRef.current = null;
    }
    setLastReceipt(null);
  }, []);

  // Load saved state on mount
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      // Validate saved state — currentIndex may be stale if cocktail data changed between sessions
      const validIndex = Math.min(saved.currentIndex, cocktails.length - 1);
      // Trim votes that reference cocktails no longer in the data
      const validVotes = saved.votes.filter((v) =>
        cocktails.some((c) => c.id === v.cocktailId)
      );
      setVotes(validVotes);
      setCurrentIndex(Math.max(0, validIndex));
      setFinished(saved.finished && validIndex >= cocktails.length - 1);
      // A restored session has no in-flight syncs. Without this the completion screen
      // claims "Syncing votes… (0/N)" forever after a reload.
      setSyncedCount(saved.syncedCount ?? 0);
    }
    setInitialised(true);
  }, []);

  // Persist state whenever votes/index/finished change (but not before initial load)
  useEffect(() => {
    if (!initialised) return;
    saveState({ votes, currentIndex, finished, syncedCount });
  }, [votes, currentIndex, finished, syncedCount, initialised]);

  // Never leave a receipt timer running after the page is gone. The card is remounted per
  // cocktail via `key`, but this page component outlives every one of them.
  useEffect(() => {
    return () => {
      if (receiptTimerRef.current !== null) window.clearTimeout(receiptTimerRef.current);
    };
  }, []);

  const handleVote = useCallback(
    (cocktailId: string, recipeId: string, vote: "agree" | "disagree") => {
      const newVote: Vote = {
        cocktailId,
        recipeId,
        vote,
        timestamp: Date.now(),
        sessionId: getSessionId(),
      };

      setVotes((prev) => [...prev, newVote]);

      // === Vote receipt (Wave 6) ===
      // `completed` is snapshotted here rather than read from `votes` at render time, so the chip
      // keeps reporting the count it was raised for even if the visitor immediately taps
      // "previous drink". Cancelling the old timer first matters: two quick votes must not leave
      // the first timer alive to hide the second receipt early.
      dismissReceipt();
      setLastReceipt({
        cocktailId,
        completed: votes.length + 1,
        key: newVote.timestamp,
      });
      receiptTimerRef.current = window.setTimeout(() => {
        setLastReceipt(null);
        receiptTimerRef.current = null;
      }, RECEIPT_VISIBLE_MS);

      if (supabase) {
        supabase
          .from("votes")
          .insert({
            cocktail_id: cocktailId,
            recipe_id: recipeId,
            vote,
            timestamp: newVote.timestamp,
            session_id: newVote.sessionId,
          })
          .then(({ error }) => {
            if (error) {
              console.warn("[census] Vote sync failed:", error.message);
              setSyncError("Some votes couldn't sync — they're saved locally.");
            } else {
              setSyncedCount((n) => n + 1);
              setSyncError(null);
            }
          });
      }

      // Auto-advance after swipe fly-off animation completes
      if (currentIndex < cocktails.length - 1) {
        setTransitioning(true);
        setTimeout(() => {
          setCurrentIndex((i) => i + 1);
          setTransitioning(false);
        }, SWIPE_FLYOFF_DURATION_MS);
      } else {
        setFinished(true);
      }
    },
    // `votes.length` is a dependency because the receipt snapshots the count as of this vote.
    [currentIndex, votes.length, dismissReceipt]
  );

  const handlePrevious = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
    setFinished(false);
    setVotes((prev) => prev.slice(0, -1));
  }, []);

  const handleReset = useCallback(() => {
    clearState();
    setVotes([]);
    setCurrentIndex(0);
    setFinished(false);
    // Zero the counter as well, or a second run reports more synced than votes cast.
    setSyncedCount(0);
    setSyncError(null);
    // The only change to reset in Wave 6, and it is a consistency fix rather than new behaviour:
    // a receipt left over from before the reset would keep announcing "Noted · N of 100" for up
    // to 2.6s next to a progress bar that has just gone back to 0.
    dismissReceipt();
  }, [dismissReceipt]);

  // === Sync pill (Wave 6) ===
  // The voting screen had no sync feedback at all: a visitor whose votes were only landing in
  // localStorage saw a progress bar that looked identical to a syncing one. The pill says which
  // one it is, in muted grey rather than the red `text-destructive` used on the completion
  // screen — a sync failure is not an error state while the vote is safely stored locally.
  // `votes.length - syncedCount` is exactly the number of votes still waiting for the cloud.
  const pendingSync = Math.max(0, votes.length - syncedCount);
  const syncLabel =
    syncError && pendingSync > 0
      ? `${pendingSync} vote${pendingSync === 1 ? "" : "s"} waiting`
      : "Saved on this device";

  // Shared page chrome. Defined once and used by both the loading and the voting screens, so the
  // skeleton sits in exactly the same frame the real card will occupy and nothing shifts on swap.
  const pageHeader = (
    <header className="pt-8 pb-4 px-4 text-center">
      <h1 className="font-display text-2xl font-bold text-gold tracking-tight">
        The Cocktail Census
      </h1>
      <p className="font-body text-sm text-muted-foreground mt-1">
        Vote on recipes. Shape the standard.
      </p>
      <button
        onClick={handleReset}
        className="mt-2 text-xs text-muted-foreground hover:text-cream transition-colors underline underline-offset-2"
      >
        Reset progress
      </button>
    </header>
  );

  if (!initialised) {
    // Wave 6: this used to be `return null`, which is a blank dark screen for the frame(s) it
    // takes to read localStorage and then a full-height layout jump when the card appeared.
    // The page chrome now renders immediately with a card-shaped placeholder inside it.
    return (
      <div className="min-h-screen flex flex-col">
        {pageHeader}
        <div className="px-4 pb-6">
          <ProgressBar completed={0} total={cocktails.length} />
        </div>
        <main className="flex-1 px-4 pb-12">
          <CardSkeleton />
        </main>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          {/* === Completion Screen (Wave 5) === 
           * data-section="completion-heading" → heading text
           * data-section="completion-stats" → stats box
           * data-section="completion-actions" → Retry + Feedback buttons
           */}
          <Wordmark />
          <h1 className="font-display text-4xl font-bold text-gold">
            {votes.length >= cocktails.length ? "Thanks champ!" : "Welcome back champ!"}
          </h1>
          <p className="font-body text-muted-foreground leading-relaxed">
            You've reviewed all {cocktails.length} cocktails and cast{" "}
            {votes.length} votes. Your input helps build a standardized,
            community-agreed cocktail reference.
          </p>
          <div className="inline-block border border-gold/30 rounded-xl px-6 py-4 bg-card">
            <p className="text-sm text-gold font-body font-medium uppercase tracking-wider mb-2">
              Your Stats
            </p>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-2xl font-display font-bold text-gold">
                  {votes.filter((v) => v.vote === "agree").length}
                </p>
                <p className="text-xs text-muted-foreground">Agreed</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-gold">
                  {votes.filter((v) => v.vote === "disagree").length}
                </p>
                <p className="text-xs text-muted-foreground">Disagreed</p>
              </div>
            </div>
          </div>
          {/* Rankings, read from the aggregate tally view. Fail-soft: renders nothing
              at all when the query is unavailable, so the stats above always survive. */}
          <CensusResults />
          {/* Sync status */}
          {supabase && (
            <p className="text-xs text-muted-foreground">
              {syncedCount === votes.length
                ? `✓ ${syncedCount} votes synced to cloud`
                : `${syncedCount} of ${votes.length} votes synced to cloud`}
            </p>
          )}
          {syncError && (
            <p className="text-xs text-destructive">{syncError}</p>
          )}
          {/* Replaces the old GitHub-issues link: a stranger will type a sentence, but will
              not open a GitHub account. Deliberately NOT fail-soft — a silently lost message
              is worse than an error, so this one reports failure and keeps the text. */}
          <FeedbackForm />
          <div className="flex flex-col items-center gap-3" data-section="completion-actions">
            <button
              onClick={handleReset}
              className="text-sm text-muted-foreground hover:text-gold transition-colors underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      {pageHeader}

      {/* Progress */}
      <div className="px-4 pb-6">
        {/* `completed` is the number of votes actually cast. The old `current={currentIndex + 1}`
            was a position, which read "100 of 100" / "100%" on the last card before it was voted
            on. See ProgressBar.tsx. */}
        <ProgressBar completed={votes.length} total={cocktails.length} />
        {/* Inline sync pill — the voting screen's only sync feedback. Hidden entirely when there
            is no Supabase client, because "saved on this device" is then the only truth and the
            app already logs a warning at startup. */}
        {supabase && (
          <div className="mt-2 flex justify-center">
            <span
              data-section="sync-pill"
              className="inline-flex items-center gap-2 rounded-full border border-concrete/25 px-3 py-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-gold/70 animate-pulse"
              />
              {syncLabel}
            </span>
          </div>
        )}
      </div>

      {/* Card with fade transition */}
      <main className="flex-1 px-4 pb-12">
        <div
          className={`transition-opacity duration-200 ${
            transitioning ? "opacity-0" : "opacity-100"
          }`}
        >
          {cocktails[currentIndex] ? (
            <CocktailCard
              key={cocktails[currentIndex].id}
              cocktail={cocktails[currentIndex]}
              onVote={handleVote}
              onPrevious={currentIndex > 0 ? handlePrevious : undefined}
            />
          ) : (
            <div data-section="error-state" className="text-center py-12">
              <p className="text-muted-foreground">No cocktail data available.</p>
              <button
                onClick={handleReset}
                className="mt-4 text-sm text-gold hover:text-gold/80 underline underline-offset-2"
              >
                Reset and start over
              </button>
            </div>
          )}
        </div>
      </main>

      {/* === Vote receipt (Wave 6) ===
          Mounted only after a vote has been recorded, and unmounted after RECEIPT_VISIBLE_MS.
          `key` is the vote's timestamp, so each new vote remounts the chip: the arrival animation
          replays and VoteReceipt's one-shot consensus fetch re-runs for the new cocktail. */}
      {lastReceipt && (
        <VoteReceipt
          key={lastReceipt.key}
          cocktailId={lastReceipt.cocktailId}
          completed={lastReceipt.completed}
          total={cocktails.length}
        />
      )}
    </div>
  );
};

export default Census;
