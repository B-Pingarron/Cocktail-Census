/**
 * CocktailCard - Displays a cocktail card for voting
 * 
 * Phase 1.1, Wave 2: Basic card structure with vote buttons
 *   - Displays cocktail name, recipe label, and placeholder icon
 *   - Provides Agree/Disagree voting buttons
 *   - Shows vote confirmation badge after voting
 *   - Swipe-based navigation comes in Wave 3
 * 
 * Annotation Convention: data-section attributes map to DevTools → grep
 *   - data-section="card"         → outermost card wrapper
 *   - data-section="card-header" → header flex container
 *   - data-section="card-vote-buttons" → vote buttons container
 *   - data-section="card-voted-badge" → vote confirmation badge
 */
import { useState } from "react";
import type { Cocktail } from "@/types/cocktail";
import { RecipeDetails } from "./RecipeDetails";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import placeholderIcon from "@/assets/cocktail-placeholder.svg";

interface CocktailCardProps {
  cocktail: Cocktail;
  onVote: (cocktailId: string, recipeId: string, vote: "agree" | "disagree") => void;
  /** @deprecated Will be removed in Wave 4 — navigation is now swipe-based */
  onNext: () => void;
  /** @deprecated Will be removed in Wave 4 — navigation is now swipe-based */
  onPrevious?: () => void;
  /** @deprecated Will be removed in Wave 4 — navigation is now swipe-based */
  showPrevious?: boolean;
}

export const CocktailCard = ({
  cocktail,
  onVote,
}: CocktailCardProps) => {
  // Tracks individual vote per recipe ID (agree/disagree)
  const [voted, setVoted] = useState<Record<string, "agree" | "disagree">>({});

  const handleVote = (recipeId: string, vote: "agree" | "disagree") => {
    setVoted((prev) => ({ ...prev, [recipeId]: vote }));
    onVote(cocktail.id, recipeId, vote);
  };

  // Check if standard recipe has been voted on
  const standardVoted = voted[cocktail.standardRecipe.id];

  return (
    <div className="w-full max-w-lg mx-auto" data-section="card">
      {/* Main card */}
      <div className="relative rounded-2xl border border-gold/30 bg-card overflow-hidden shadow-lg">
        {/* === Gold Accent Line === */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />

        <div className="p-6 space-y-5">
          {/* === Header (Name + Placeholder Image) === */}
          <div 
            className="flex items-start justify-between"
            data-section="card-header"
          >
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">
                {cocktail.name}
              </h2>
              <p className="text-sm text-gold font-body font-medium mt-1 uppercase tracking-widest">
                {cocktail.standardRecipe.label}
              </p>
            </div>
            <img
              src={placeholderIcon}
              alt="cocktail"
              className="w-14 h-14 opacity-80 flex-shrink-0"
            />
          </div>

          {/* === Recipe Details === */}
          <RecipeDetails recipe={cocktail.standardRecipe} />

          {/* === Vote Buttons === */}
          {!standardVoted ? (
            <div 
              className="flex gap-3 pt-2"
              data-section="card-vote-buttons"
            >
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
            /* === Voted Badge === */
            <div className="text-center py-2">
              <span
                data-section="card-voted-badge"
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
    </div>
  );
};