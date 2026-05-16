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
            className="flex items-center justify-between text-sm font-body"
          >
            <span className="text-foreground/80">{ing.name}</span>
            <span className="text-gold font-medium tabular-nums">
              {ing.amount}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-gold/20" />

      {/* Method, Glass, Garnish */}
      <div className="grid grid-cols-3 gap-2 text-xs font-body">
        <div>
          <span className="text-muted-foreground block uppercase tracking-wider mb-0.5">
            Method
          </span>
          <span className="text-foreground/90">{recipe.method}</span>
        </div>
        <div>
          <span className="text-muted-foreground block uppercase tracking-wider mb-0.5">
            Glass
          </span>
          <span className="text-foreground/90">{recipe.glass}</span>
        </div>
        <div>
          <span className="text-muted-foreground block uppercase tracking-wider mb-0.5">
            Garnish
          </span>
          <span className="text-foreground/90">{recipe.garnish}</span>
        </div>
      </div>
    </div>
  );
};
