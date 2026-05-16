import { useState, useCallback } from "react";
import { cocktails } from "@/data/cocktails";
import { CocktailCard } from "@/components/CocktailCard";
import { ProgressBar } from "@/components/ProgressBar";

interface Vote {
  cocktailId: string;
  recipeId: string;
  vote: "agree" | "disagree";
  timestamp: number;
}

const Index = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [finished, setFinished] = useState(false);

  const handleVote = useCallback(
    (cocktailId: string, recipeId: string, vote: "agree" | "disagree") => {
      setVotes((prev) => [
        ...prev,
        { cocktailId, recipeId, vote, timestamp: Date.now() },
      ]);
    },
    []
  );

  const handleNext = useCallback(() => {
    if (currentIndex < cocktails.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setFinished(true);
    }
  }, [currentIndex]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  if (finished) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-gold/10 flex items-center justify-center">
            <span className="text-2xl">🥃</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-gold">
            Thank You
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
      </header>

      {/* Progress */}
      <div className="px-4 pb-6">
        <ProgressBar current={currentIndex + 1} total={cocktails.length} />
      </div>

      {/* Card */}
      <main className="flex-1 px-4 pb-12">
        <CocktailCard
          key={cocktails[currentIndex].id}
          cocktail={cocktails[currentIndex]}
          onVote={handleVote}
          onNext={handleNext}
          onPrevious={handlePrevious}
          showPrevious={currentIndex > 0}
        />
      </main>
    </div>
  );
};

export default Index;
