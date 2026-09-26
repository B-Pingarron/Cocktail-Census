import type { RoastSpec } from "@/types/roast";

/**
 * The 15 specs of rung 1 — the author's own list, presented to be roasted.
 *
 * VERBATIM POLICY. This file is a transcription of the author's source list
 * (Data/burn_hard_420_roast_list.json). His wording, casing and typos are kept
 * as-is: "Absinth", "bum acidity", "preffered", "foamsies", "sexy", lowercase
 * "triple sec" and "sugar". They are his voice, not mistakes to be cleaned up.
 * Six amounts carry no unit ("Espresso; 1", "simple syrup; 1,75",
 * "Gin; 4,5", "Lemon juice ; 1,5", "Cherry Liqueur; 1,5", "Fernet Branca ; 1,25")
 * and they stay that way — the amount is a label, not a measurement.
 *
 * `tier` is dropped: every row in the source has it empty, so the field carries
 * no data and the prototype's tier label was provenance decoration.
 */

/** The constant list id. Rung 1 has exactly one list; rung 2 makes it a real id. */
export const ROAST_LIST_ID = "barnerd-15";

/**
 * Who wrote the list, printed as the card's kicker.
 *
 * The card used to say "House pour", which the author read and could not place — it named nothing.
 * The list has an owner, so the kicker names him. Hardcoded for rung 1, where there is exactly one
 * list; TODO: promote to a `roast_lists.author` column when rung 2 makes lists real, and read it
 * with the rest of the list row.
 */
export const ROAST_LIST_AUTHOR = "BarNerd_420";

export const roastSpecs: RoastSpec[] = [
  {
    id: "espresso-martini",
    name: "Espresso Martini",
    ingredients: [
      { name: "Vodka", amount: "6 cl" },
      { name: "Espresso", amount: "1" },
      { name: "Simple syrup", amount: "1,5 cl" },
      { name: "Fernet Branca", amount: "1 cl" },
    ],
    glass: "coupe",
    garnish: "none",
    method:
      "Build in tin, shake well, double strain to break possible air pockets and get sexy foamsies",
  },
  {
    id: "old-fashioned",
    name: "Old Fashioned",
    ingredients: [
      { name: "Bourbon", amount: "6 cl" },
      { name: "Sugar syrup", amount: "0,5 cl" },
      { name: "Angostura bitters", amount: "3 dash" },
    ],
    glass: "old fashioned",
    garnish: "orange twist",
    method:
      "Build in mixing glass, stir, strain. * Bitters dashes straight from the bottle. for japanese dasher do 6 dashes",
  },
  {
    id: "cosmopolitan",
    name: "Cosmopolitan",
    ingredients: [
      { name: "Vodka", amount: "6 cl" },
      { name: "triple sec", amount: "1,5 cl" },
      { name: "sugar", amount: "1 cl" },
      { name: "cranberry juice", amount: "1,75 cl" },
      { name: "lime juice", amount: "1,5 cl" },
    ],
    glass: "coupe",
    garnish: "orange twist, discard",
    method: "shake, double strain",
  },
  {
    id: "margarita",
    name: "Margarita",
    ingredients: [
      { name: "tequila", amount: "6 cl" },
      { name: "lime juice", amount: "2,5 cl" },
      { name: "triple sec", amount: "1,75 cl" },
    ],
    glass: "margarita",
    garnish: "half salt rim",
    method: "Shake, double strain",
  },
  {
    id: "pornstar-martini",
    name: "Pornstar Martini",
    ingredients: [
      { name: "Vodka", amount: "6 cl" },
      { name: "passionfruit puree", amount: "2 cl" },
      { name: "lemon juice", amount: "2 cl" },
      { name: "vanilla syrup", amount: "2,5 cl" },
    ],
    glass: "coupe",
    garnish: "none",
    method: "shake, double strain, top with sparkling wine",
  },
  {
    id: "daiquiri",
    name: "Daiquiri",
    ingredients: [
      { name: "Rum", amount: "6 cl" },
      { name: "lime juice", amount: "2 cl" },
      { name: "simple syrup", amount: "1,75" },
    ],
    glass: "coupe",
    garnish: "none",
    method: "shake, double strain",
  },
  {
    id: "dry-martini",
    name: "Dry Martini",
    ingredients: [
      { name: "Gin", amount: "6 cl" },
      { name: "Dry Vermouth", amount: "1,5 cl" },
      { name: "Orange bitters", amount: "1 dash" },
    ],
    glass: "Martini",
    garnish: "Lemon Twist",
    method:
      "Stir, double strain. Garnish with Olive is the guest asks for it, 3 olives if they are worth it.",
  },
  {
    id: "sazerac",
    name: "Sazerac",
    ingredients: [
      { name: "Straight Rye (100 proof)", amount: "6 cl" },
      { name: "Sugar Syrup", amount: "1 cl" },
      { name: "Peychaud's bitters", amount: "5 dash" },
      { name: "Angostura bitters", amount: "1 dash" },
      { name: "Absinth", amount: "1 cl" },
    ],
    glass: "old fashioned",
    garnish: "lemon twist",
    method:
      "Use the absinth to rinse the old fashioned glass and discard leftovers, stir the rest of the ingredients in a mixing glass, strain",
  },
  {
    id: "gimlet",
    name: "Gimlet",
    ingredients: [
      { name: "Gin", amount: "5 cl" },
      { name: "Lime Cordial", amount: "2 cl" },
      { name: "Lime juice", amount: "0,5 cl" },
    ],
    glass: "nick & nora",
    garnish: "none",
    method: "stir, double strain.",
  },
  {
    id: "lions-tail",
    name: "Lion's Tail",
    ingredients: [
      { name: "Bourbon", amount: "6 cl" },
      { name: "Pimento Dram", amount: "1,5 cl" },
      { name: "Lime juice", amount: "1,5 cl" },
      { name: "Simple syrup", amount: "0,75 cl" },
      { name: "Angostura bitters", amount: "3 dash" },
    ],
    glass: "coupe",
    garnish: "none",
    method: "shake, double strain",
  },
  {
    id: "blood-and-sand",
    name: "Blood & Sand",
    ingredients: [
      { name: "Blended Scotch", amount: "4 cl" },
      { name: "Red Vermouth", amount: "2 cl" },
      { name: "Cherry Liqueur", amount: "1,5 cl" },
      { name: "Orange Juice", amount: "2 cl" },
      { name: "Citrus Cordial", amount: "1 cl" },
    ],
    glass: "coupe",
    garnish: "orange twist",
    method:
      "Shake, double strain. Use fresh orange juice. Citrus cordial should be preferable lemon and orange, bum acidity of cordial with tartaric (preffered) or citric acid.",
  },
  {
    id: "hanky-panky",
    name: "Hanky Panky",
    ingredients: [
      { name: "Gin", amount: "4 cl" },
      { name: "Red Vermouth", amount: "5 cl" },
      { name: "Fernet Branca", amount: "1,25 cl" },
    ],
    glass: "nick & nora",
    garnish: "lemon twist",
    method: "Stir, double strain",
  },
  {
    id: "french-75",
    name: "French 75",
    ingredients: [
      { name: "Gin", amount: "4,5" },
      { name: "Lemon juice", amount: "1,5" },
      { name: "Simple syrup", amount: "1 cl" },
      { name: "Champagne", amount: "6 cl" },
      { name: "Peychaud's bitters", amount: "1 dash" },
    ],
    glass: "coupe",
    garnish: "lemon twist",
    method:
      "Shake everything except champagne, double strain, top with champagne",
  },
  {
    id: "singapore-sling",
    name: "Singapore Sling",
    ingredients: [
      { name: "Gin", amount: "6 cl" },
      { name: "Benedictine D.O.M.", amount: "1,5 cl" },
      { name: "Cherry Liqueur", amount: "1,5" },
      { name: "Lemon Juice", amount: "2,5 cl" },
      { name: "Angostura bitters", amount: "2 dash" },
      { name: "orange bitters", amount: "2 dash" },
      { name: "Peychaud's bitters", amount: "2 dash" },
      { name: "Soda", amount: "top" },
    ],
    glass: "highball",
    garnish: "lemon twist, cherry",
    method: "shake, strain, top with soda",
  },
  {
    id: "toronto",
    name: "Toronto",
    ingredients: [
      { name: "Rye", amount: "5 cl" },
      { name: "Fernet Branca", amount: "1,25" },
      { name: "Maple syrup", amount: "0,75 cl" },
      { name: "Angostura bitters", amount: "1 dash" },
    ],
    glass: "coupe",
    garnish: "cherry",
    method: "Stir, double strain",
  },
];

export function specById(id: string): RoastSpec | undefined {
  return roastSpecs.find((spec) => spec.id === id);
}
