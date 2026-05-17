import { useState, useCallback, useEffect } from "react";
import { cocktails } from "@/data/cocktails";
import { CocktailCard } from "@/components/CocktailCard";
import { ProgressBar } from "@/components/ProgressBar";
import type { Vote } from "@/types/cocktail";
import { supabase } from "@/lib/supabase";
import { SWIPE_FLYOFF_DURATION_MS } from "@/components/CocktailCard";

const STORAGE_KEY = "barnerd-census-state";

interface SavedState {
  votes: Vote[];
  currentIndex: number;
  finished: boolean;
}

function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

function saveState(state: SavedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

const Census = () => {
  const [initialised, setInitialised] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [finished, setFinished] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

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
    }
    setInitialised(true);
  }, []);

  // Persist state whenever votes/index/finished change (but not before initial load)
  useEffect(() => {
    if (!initialised) return;
    saveState({ votes, currentIndex, finished });
  }, [votes, currentIndex, finished, initialised]);

  const handleVote = useCallback(
    (cocktailId: string, recipeId: string, vote: "agree" | "disagree") => {
      const newVote: Vote = {
        cocktailId,
        recipeId,
        vote,
        timestamp: Date.now(),
      };

      setVotes((prev) => [...prev, newVote]);

      if (supabase) {
        supabase
          .from("votes")
          .insert({
            cocktail_id: cocktailId,
            recipe_id: recipeId,
            vote,
            timestamp: newVote.timestamp,
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
    [currentIndex]
  );

  const handlePrevious = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
    setFinished(false);
    setVotes((prev) => prev.slice(0, -1));
  }, []);

  const handleReset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setVotes([]);
    setCurrentIndex(0);
    setFinished(false);
  }, []);

  if (!initialised) {
    return null; // prevent flash of empty state
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
          <div className="w-16 h-16 mx-auto rounded-full bg-gold/10 flex items-center justify-center">
            <span className="text-2xl">🥃</span>
          </div>
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
                <p className="text-2xl font-display font-bold text-forest">
                  {votes.filter((v) => v.vote === "agree").length}
                </p>
                <p className="text-xs text-muted-foreground">Agreed</p>
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-destructive">
                  {votes.filter((v) => v.vote === "disagree").length}
                </p>
                <p className="text-xs text-muted-foreground">Disagreed</p>
              </div>
            </div>
          </div>
          {/* Sync status */}
          {supabase && (
            <p className="text-xs text-muted-foreground/60">
              {syncedCount === votes.length
                ? `✓ ${syncedCount} votes synced to cloud`
                : `Syncing votes… (${syncedCount}/${votes.length})`}
            </p>
          )}
          {syncError && (
            <p className="text-xs text-destructive/80">{syncError}</p>
          )}
          <div className="flex flex-col items-center gap-3" data-section="completion-actions">
            <button
              onClick={handleReset}
              className="text-sm text-muted-foreground hover:text-gold transition-colors underline underline-offset-2"
            >
              Retry
            </button>
            <a
              href="https://github.com/B-Pingarron/Cocktail-Census/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-gold transition-colors underline underline-offset-2"
            >
              Feedback
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="pt-8 pb-4 px-4 text-center">
        <h1 className="font-display text-2xl font-bold text-gold tracking-tight">
          The Cocktail Census
        </h1>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Vote on recipes. Shape the standard.
        </p>
        <button
          onClick={handleReset}
          className="mt-2 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors underline underline-offset-2"
        >
          Reset progress
        </button>
      </header>

      {/* Progress */}
      <div className="px-4 pb-6">
        <ProgressBar current={currentIndex + 1} total={cocktails.length} />
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
    </div>
  );
};

export default Census;
