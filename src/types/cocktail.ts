export interface Ingredient {
  name: string;
  amount: string;
}

export interface Recipe {
  id: string;
  label: string;
  ingredients: Ingredient[];
  method: string;
  glass: string;
  garnish: string;
  source?: string;
}

export interface Cocktail {
  id: string;
  name: string;
  image: string;
  tier: number;
  standardRecipe: Recipe;
  alternativeRecipes: Recipe[];
}

export interface Vote {
  cocktailId: string;
  recipeId: string;
  vote: "agree" | "disagree";
  timestamp: number;
}
