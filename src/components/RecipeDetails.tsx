import type { Recipe } from "@/types/cocktail";

interface RecipeDetailsProps {
  recipe: Recipe;
  compact?: boolean;
}

export const RecipeDetails = ({ recipe, compact }: RecipeDetailsProps) => {
  return (
    <div className={`space-y-3 ${compact ? "text-sm" : ""}`}>
      {/* Ingredients */}
      <div className="space-y-1.5">
        {recipe.ingredients.map((ing, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto] items-center text-sm font-body"
          >
            <span className="text-foreground/80 truncate min-w-0">{ing.name}</span>
            <span className="text-gold font-medium tabular-nums text-right ml-4">
              {ing.amount}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-gold/20" />

      {/* Glass */}
      <div className="flex items-center gap-x-2 text-xs font-body">
        <span className="text-muted-foreground uppercase tracking-wider">Glass:</span>
        <span className="text-foreground/90">{recipe.glass}</span>
      </div>

      {/* Garnish */}
      <div className="flex items-center gap-x-2 text-xs font-body">
        <span className="text-muted-foreground uppercase tracking-wider">Garnish:</span>
        <span className="text-foreground/90">{recipe.garnish}</span>
      </div>

      {/* Divider */}
      <div className="h-px bg-gold/20" />

      {/* Method — at the very bottom, muted styling */}
      <div className="text-xs font-body mb-4">
        <span className="text-muted-foreground uppercase tracking-wider block mb-1">Method</span>
        <span className="text-foreground/60 italic leading-relaxed">{recipe.method}</span>
      </div>
    </div>
  );
};
