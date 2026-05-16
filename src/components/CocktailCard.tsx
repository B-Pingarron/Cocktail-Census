import { useState, useMemo } from "react";
import type { Cocktail } from "@/types/cocktail";
import { RecipeDetails } from "./RecipeDetails";
import { Check, X, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CocktailCardProps {
  cocktail: Cocktail;
  onVote: (cocktailId: string, recipeId: string, vote: "agree" | "disagree") => void;
  onNext: () => void;
  onPrevious?: () => void;
  showPrevious?: boolean;
}

const layoutVariants = [
  "layout-classic",
  "layout-wide",
  "layout-centered",
] as const;

export const CocktailCard = ({
  cocktail,
  onVote,
  onNext,
  onPrevious,
  showPrevious,
}: CocktailCardProps) => {
  const [selectedAlt, setSelectedAlt] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<string, "agree" | "disagree">>({});

  const layout = useMemo(
    () => layoutVariants[Math.floor(Math.random() * layoutVariants.length)],
    [cocktail.id]
  );

  const handleVote = (recipeId: string, vote: "agree" | "disagree") => {
    setVoted((prev) => ({ ...prev, [recipeId]: vote }));
    onVote(cocktail.id, recipeId, vote);
  };

  const standardVoted = voted[cocktail.standardRecipe.id];

  return (
    <div className={`w-full max-w-lg mx-auto ${layout === "layout-wide" ? "max-w-2xl" : ""}`}>
      {/* Main card */}
      <div className="relative rounded-2xl border border-gold/30 bg-card overflow-hidden shadow-lg">
        {/* Gold accent line */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />

        {/* Image */}
        {cocktail.image && (
          <div className="w-full h-48 overflow-hidden bg-muted/30 flex items-center justify-center">
            <img
              src={cocktail.image}
              alt={cocktail.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Title */}
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-foreground tracking-tight">
              {cocktail.name}
            </h2>
            <p className="text-sm text-gold font-body font-medium mt-1 uppercase tracking-widest">
              {cocktail.standardRecipe.label}
            </p>
          </div>

          {/* Standard Recipe */}
          <RecipeDetails recipe={cocktail.standardRecipe} />

          {/* Vote buttons */}
          {!standardVoted ? (
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-forest/40 text-forest hover:bg-forest hover:text-cream transition-all duration-200"
                onClick={() => handleVote(cocktail.standardRecipe.id, "agree")}
              >
                <Check className="w-4 h-4 mr-2" />
                Agree
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
                onClick={() => handleVote(cocktail.standardRecipe.id, "disagree")}
              >
                <X className="w-4 h-4 mr-2" />
                Disagree
              </Button>
            </div>
          ) : (
            <div className="text-center py-2">
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium ${
                  standardVoted === "agree"
                    ? "bg-forest/15 text-forest"
                    : "bg-destructive/15 text-destructive"
                }`}
              >
                {standardVoted === "agree" ? (
                  <><Check className="w-3.5 h-3.5" /> You agreed</>
                ) : (
                  <><X className="w-3.5 h-3.5" /> You disagreed</>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Alternative Recipes */}
      {standardVoted && cocktail.alternativeRecipes.length > 0 && (
        <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <p className="text-sm font-body text-muted-foreground text-center uppercase tracking-wider">
            Alternative recipes
          </p>
          {cocktail.alternativeRecipes.map((alt) => (
            <div
              key={alt.id}
              className="rounded-xl border border-gold/20 bg-parchment overflow-hidden"
            >
              <button
                onClick={() => setSelectedAlt(selectedAlt === alt.id ? null : alt.id)}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gold/5 transition-colors"
              >
                <div>
                  <span className="font-display text-lg text-foreground font-semibold">
                    {alt.label}
                  </span>
                  {alt.source && (
                    <span className="ml-2 text-xs text-gold-muted font-body">
                      — {alt.source}
                    </span>
                  )}
                </div>
                <ArrowRight
                  className={`w-4 h-4 text-gold transition-transform duration-200 ${
                    selectedAlt === alt.id ? "rotate-90" : ""
                  }`}
                />
              </button>

              {selectedAlt === alt.id && (
                <div className="px-5 pb-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <RecipeDetails recipe={alt} compact />

                  {!voted[alt.id] ? (
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-forest/40 text-forest hover:bg-forest hover:text-cream"
                        onClick={() => handleVote(alt.id, "agree")}
                      >
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                        Prefer this
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                        onClick={() => handleVote(alt.id, "disagree")}
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        Not for me
                      </Button>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground">
                      {voted[alt.id] === "agree" ? "✓ Preferred" : "✗ Passed"}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Navigation buttons */}
      {standardVoted && (
        <div className="mt-6 flex items-center justify-center gap-3 animate-in fade-in duration-500">
          {showPrevious && onPrevious && (
            <Button
              variant="outline"
              onClick={onPrevious}
              className="border-gold/30 text-gold hover:bg-gold/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
          )}
          <Button
            onClick={onNext}
            className="bg-forest text-cream hover:bg-forest-light px-8"
          >
            Next Cocktail
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
};
