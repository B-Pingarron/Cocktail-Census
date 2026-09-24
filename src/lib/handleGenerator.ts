/**
 * Handle generator — anonymous nicknames for the roast.
 *
 * PORTED from the BarNerd funnel prototype (apps/BarNerd_Hub/hub/index.tsx and the
 * control defaults in that app's package.json: nameWordsA, nameWordsB, nameNumbers,
 * nameSuggestions). The word lists and the join rule are the prototype's, not an
 * invention: `A_B`, optionally suffixed with `_<number>`, joined with underscores.
 *
 * WHAT CHANGED IN THE PORT:
 *   - The prototype merged the handwritten suggestions into the generated pool and
 *     then shuffled. Here the two are separate concerns: SUGGESTED_HANDLES is the
 *     handwritten list verbatim, and generateHandles() generates only from the word
 *     lists. The roast step shows one rail of generated chips, not a mix.
 *   - The prototype's number chance arrived as a percentage (0-100) from a slider.
 *     Here it is a fraction (0-1), which is what the caller wants.
 *   - The prototype shuffled the combined pool. The shuffle is kept, so a re-roll
 *     visibly reorders the rail and not only the words.
 *
 * No network, no Supabase, no state. Pure functions over the lists below.
 */

/** First words. Ported from the funnel's `nameWordsA` default. */
const WORDS_A: string[] = [
  "bratty",
  "dirty",
  "salty",
  "neat",
  "overproof",
  "bitter",
  "house",
  "well",
  "double",
  "stirred",
  "shaken",
  "clarified",
  "batched",
  "spent",
  "chilled",
  "jigger",
  "agave",
  "mezcal",
  "rum",
  "gin",
  "amaro",
  "vermouth",
  "tiki",
  "garnish",
  "backbar",
  "guest",
  "session",
  "closing",
  "sticky",
  "feral",
  "humble",
  "unbothered",
  "mildly",
  "allegedly",
  "barely",
  "certified",
];

/** Second words. Ported from the funnel's `nameWordsB` default. */
const WORDS_B: string[] = [
  "tender",
  "machine",
  "master",
  "goblin",
  "gremlin",
  "menace",
  "diva",
  "evangelist",
  "truther",
  "apologist",
  "denier",
  "stan",
  "warrior",
  "somm",
  "wizard",
  "hands",
  "pour",
  "shift",
  "sinner",
  "saint",
  "legend",
  "rookie",
  "veteran",
  "nerd",
  "enjoyer",
  "hater",
  "defender",
  "historian",
  "disaster",
  "supremacy",
  "andy",
  "energy",
];

/** Optional numeric suffixes. Ported from the funnel's `nameNumbers` default. */
const NUMBERS: string[] = [
  "69",
  "86",
  "151",
  "420",
  "1312",
  "1944",
  "1806",
  "2026",
  "007",
  "99",
  "13",
  "24",
];

/**
 * The handwritten handles, verbatim from the funnel's `nameSuggestions` default.
 *
 * Kept as data rather than folded into generateHandles() so a surface can show a
 * curated list without depending on the random generator.
 */
export const SUGGESTED_HANDLES: string[] = [
  "vodka_soda_lime_guy",
  "extra_dirty_please",
  "negroni_evangelist",
  "orgeat_truther",
  "jigger_denier",
  "free_poured_it_anyway",
  "shaker_machine_69",
  "muddles_too_hard",
  "garnish_goblin",
  "dry_shake_diva",
  "clarified_my_milk",
  "last_word_stan",
  "espresso_martini_apologist",
  "tiki_purist_1944",
  "two_straws_no_ice",
  "double_strain_andy",
  "ice_program_haver",
  "guest_shift_menace",
  "agave_master",
  "batches_nothing",
];

const pick = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];

/**
 * Generate anonymous handles.
 *
 * Every handle is `wordA_wordB`, optionally with a `_number` suffix. No handle is
 * ever repeated within a single call — a rail of chips with a duplicate in it reads
 * as a bug, and the visitor has no way to tell which one they picked.
 *
 * The loop is guarded so a tiny word list can never spin forever: if the guard runs
 * out the function returns what it managed to build rather than hanging the render.
 *
 * @param count How many handles to return. Defaults to 18. Values below 1 yield [].
 * @param numberChance Probability (0-1) that a handle carries a numeric suffix.
 *   Defaults to 0.5. Clamped.
 * @returns A shuffled array of unique handles.
 */
export function generateHandles(count = 18, numberChance = 0.5): string[] {
  const target = Math.max(0, Math.floor(count));
  if (target === 0) return [];

  const chance = Math.min(Math.max(numberChance, 0), 1);

  const seen = new Set<string>();
  const out: string[] = [];
  let guard = 0;

  while (out.length < target && guard < 600) {
    guard++;

    let handle = `${pick(WORDS_A)}_${pick(WORDS_B)}`;
    if (Math.random() < chance) handle += `_${pick(NUMBERS)}`;

    const key = handle.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(handle);
  }

  // Shuffle, so a re-roll reorders the rail rather than only swapping words.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}
