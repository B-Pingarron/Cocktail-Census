"""
Extract our Top 100 cocktails from the Difford's Guide dataset.
Outputs a clean CSV with original method text (no copied expression).
"""

import csv
import ast
import re
import os

# Paths
INPUT_CSV = os.path.join(os.path.dirname(__file__), "Raw", "cocktails_recipe.csv")
OUTPUT_CSV = os.path.join(os.path.dirname(__file__), "cocktails-100.csv")

# ─── Our Top 100 Cocktails ───────────────────────────────────────────────

COCKTAILS = [
    # Tier 0 — Mount Rushmore
    ("negroni", "Negroni", 0),
    ("old-fashioned", "Old Fashioned", 0),
    ("margarita", "Margarita", 0),
    ("espresso-martini", "Espresso Martini", 0),

    # Tier 1 — The Classics
    ("daiquiri", "Daiquiri", 1),
    ("dry-martini", "Dry Martini", 1),
    ("manhattan", "Manhattan", 1),
    ("whiskey-sour", "Whiskey Sour", 1),
    ("mojito", "Mojito", 1),
    ("aperol-spritz", "Aperol Spritz", 1),

    # Tier 2 — Modern Classics
    ("sazerac", "Sazerac", 2),
    ("last-word", "Last Word", 2),
    ("paloma", "Paloma", 2),
    ("pina-colada", "Pina Colada", 2),
    ("mai-tai", "Mai Tai", 2),
    ("sidecar", "Sidecar", 2),
    ("french-75", "French 75", 2),
    ("boulevardier", "Boulevardier", 2),
    ("bloody-mary", "Bloody Mary", 2),
    ("moscow-mule", "Moscow Mule", 2),
    ("tom-collins", "Tom Collins", 2),
    ("aviation", "Aviation", 2),
    ("paper-plane", "Paper Plane", 2),
    ("penicillin", "Penicillin", 2),
    ("gimlet", "Gimlet", 2),
    ("bees-knees", "Bee's Knees", 2),
    ("caipirinha", "Caipirinha", 2),
    ("mint-julep", "Mint Julep", 2),
    ("clover-club", "Clover Club", 2),
    ("bramble", "Bramble", 2),
    ("corpse-reviver-2", "Corpse Reviver #2", 2),
    ("vieux-carre", "Vieux Carré", 2),
    ("pornstar-martini", "Pornstar Martini", 2),
    ("suffering-bastard", "Suffering Bastard", 2),
    ("trinidad-sour", "Trinidad Sour", 2),

    # Tier 3 — IBA Standards & Regional Favorites
    ("americano", "Americano", 3),
    ("bellini", "Bellini", 3),
    ("black-russian", "Black Russian", 3),
    ("blood-and-sand", "Blood & Sand", 3),
    ("casino", "Casino", 3),
    ("champagne-cocktail", "Champagne Cocktail", 3),
    ("cosmopolitan", "Cosmopolitan", 3),
    ("cuba-libre", "Cuba Libre", 3),
    ("derby", "Derby", 3),
    ("dirty-martini", "Dirty Martini", 3),
    ("el-diablo", "El Diablo", 3),
    ("godfather", "Godfather", 3),
    ("golden-dream", "Golden Dream", 3),
    ("grasshopper", "Grasshopper", 3),
    ("hanky-panky", "Hanky Panky", 3),
    ("harvey-wallbanger", "Harvey Wallbanger", 3),
    ("hemingway-daiquiri", "Hemingway Daiquiri", 3),
    ("horses-neck", "Horse's Neck", 3),
    ("irish-coffee", "Irish Coffee", 3),
    ("john-collins", "John Collins", 3),
    ("kir-royale", "Kir Royale", 3),
    ("lemon-drop", "Lemon Drop", 3),
    ("long-island-iced-tea", "Long Island Iced Tea", 3),
    ("martinez", "Martinez", 3),
    ("mary-pickford", "Mary Pickford", 3),
    ("monkey-gland", "Monkey Gland", 3),
    ("morning-glory-fizz", "Morning Glory Fizz", 3),
    ("mulled-wine", "Mulled Wine", 3),
    ("new-york-sour", "New York Sour", 3),
    ("old-cuban", "Old Cuban", 3),
    ("paradise", "Paradise", 3),
    ("pisco-sour", "Pisco Sour", 3),
    ("planters-punch", "Planter's Punch", 3),
    ("porto-flip", "Porto Flip", 3),
    ("ramos-gin-fizz", "Ramos Gin Fizz", 3),
    ("rob-roy", "Rob Roy", 3),
    ("rose-cocktail", "Rose", 3),
    ("rusty-nail", "Rusty Nail", 3),
    ("scorpion", "Scorpion", 3),
    ("sex-on-the-beach", "Sex on the Beach", 3),
    ("singapore-sling", "Singapore Sling", 3),
    ("stinger", "Stinger", 3),
    ("tequila-sunrise", "Tequila Sunrise", 3),
    ("tuxedo", "Tuxedo", 3),
    ("vesper", "Vesper", 3),
    ("ward-eight", "Ward Eight", 3),
    ("whisky-mac", "Whisky Mac", 3),
    ("white-lady", "White Lady", 3),
    ("white-russian", "White Russian", 3),
    ("zombie", "Zombie", 3),

    # Tier 4 — Dark Horses & Rising Stars
    ("naked-and-famous", "Naked & Famous", 4),
    ("jungle-bird", "Jungle Bird", 4),
    ("navy-grog", "Navy Grog", 4),
    ("saturn", "Saturn", 4),
    ("chartreuse-swizzle", "Chartreuse Swizzle", 4),
    ("toronto", "Toronto", 4),
    ("angostura-colada", "Angostura Colada", 4),
    ("la-louisiana", "La Louisiana", 4),
    ("chet-baker", "Chet Baker", 4),
    ("final-ward", "Final Ward", 4),
    ("southside", "Southside", 4),
    ("elderflower-collins", "Elderflower Collins", 4),
    ("cucumber-gimlet", "Cucumber Gimlet", 4),
    ("mexican-firing-squad", "Mexican Firing Squad", 4),
    ("champs-elysees", "Champs-Élysées", 4),
]

# ─── Load Difford's CSV ──────────────────────────────────────────────────

def load_diffords(path):
    """Load all recipes from Difford's CSV into a list of dicts."""
    recipes = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                ingredients = ast.literal_eval(row['ingredients'])
            except (SyntaxError, ValueError):
                ingredients = []
            recipes.append({
                'title': row['title'].strip(),
                'glass': row['glass'].strip(),
                'garnish': row['garnish'].strip(),
                'recipe': row['recipe'].strip(),
                'ingredients': ingredients,
                'title_lower': row['title'].strip().lower(),
            })
    return recipes

def normalize(s):
    """Normalize a string for matching: lowercase, remove punctuation, collapse spaces."""
    s = s.lower()
    s = re.sub(r'[^\w\s]', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# Special name mappings for cocktails whose CSV title differs significantly
NAME_OVERRIDES = {
    "corpse reviver #2": "Corpse Reviver No.2",
    "corpse reviver #2 (savoy recipe)": "Corpse Reviver No.2",
    "whisky mac": "Whisky Mac",
}

def find_match(name, recipes):
    """
    Find the best matching recipe in Difford's for a cocktail name.
    Returns (recipe, match_type) or (None, 'not_found').
    """
    name_lower = name.lower().strip()
    name_norm = normalize(name)

    # Strategy 0: Apply name overrides for known mismatches
    if name_lower in NAME_OVERRIDES:
        override = NAME_OVERRIDES[name_lower].lower()
        for r in recipes:
            if r['title_lower'].startswith(override):
                return r, 'override_prefix'
            if override in r['title_lower']:
                return r, 'override_contains'

    # Strategy 1: Exact match (case-insensitive)
    for r in recipes:
        if r['title_lower'] == name_lower:
            return r, 'exact'

    # Strategy 2: Title starts with our name
    for r in recipes:
        if r['title_lower'].startswith(name_lower):
            return r, 'prefix'

    # Strategy 3: Our name starts with title (e.g. "Bee's Knees" vs "Bees Knees")
    for r in recipes:
        if name_lower.startswith(r['title_lower']):
            return r, 'our_starts_with_title'

    # Strategy 4: Normalized name match (remove punctuation, collapse spaces)
    for r in recipes:
        if normalize(r['title']) == name_norm:
            return r, 'normalized'

    # Strategy 5: Relaxed match — title contains our name or vice versa
    for r in recipes:
        if name_lower in r['title_lower'] or r['title_lower'] in name_lower:
            return r, 'contains'

    # Strategy 6: Remove parentheticals and compare
    name_clean = re.sub(r'\(.*?\)', '', name_lower).strip()
    for r in recipes:
        title_clean = re.sub(r'\(.*?\)', '', r['title_lower']).strip()
        if title_clean == name_clean:
            return r, 'clean'

    # Strategy 7: Remove number notation differences (# vs No.)
    name_vs_numbers = re.sub(r'#\s*(\d+)', r'no.\1', name_lower)
    name_vs_numbers = re.sub(r'no\.\s*(\d+)', r'no.\1', name_vs_numbers)
    for r in recipes:
        title_vs = r['title_lower'].replace('#', 'no.').replace('number', 'no.')
        title_vs = re.sub(r'no\.\s*(\d+)', r'no.\1', title_vs)
        if name_vs_numbers in title_vs or title_vs in name_vs_numbers:
            return r, 'numbers'

    return None, 'not_found'


# ─── Original Method Text ────────────────────────────────────────────────
# These are short, standard bartending technique descriptions.
# They describe common procedures — no creative expression, just functional data.

def generate_method(name, tier, glass, ingredients, original_recipe):
    """
    Generate a short, original method description based on the cocktail's
    characteristics. No verbatim copying from Difford's.
    """
    has_egg = any('egg' in str(i[1]).lower() for i in ingredients)
    has_cream = any('cream' in str(i[1]).lower() for i in ingredients)
    has_fizz = any('soda' in str(i[1]).lower() or 'sparkling' in str(i[1]).lower() for i in ingredients)
    has_muddle = any('mint' in str(i[1]).lower() or 'fruit' in str(i[1]).lower() or 'herb' in str(i[1]).lower() for i in ingredients)
    has_blend = 'blend' in glass.lower() or any('frozen' in g.lower() for g in [glass])
    is_tiki = any(t in name.lower() for t in ['tiki', 'zombie', 'ma tai', 'pina colada'])
    is_sour = any(t in name.lower() for t in ['sour', 'daiquiri', 'sidecar', 'gimlet'])
    is_stirred = any(t in name.lower() for t in ['manhattan', 'negroni', 'martini', 'old fashioned', 'sazerac', 'boulevardier', 'vieux', 'rob roy', 'rusty'])
    has_coffee = any('coffee' in str(i[1]).lower() or 'espresso' in str(i[1]).lower() for i in ingredients)
    has_hot = any(
        p in str(i[1]).lower()
        for i in ingredients
        for p in ['hot water', 'boiling water', 'hot coffee', 'hot chocolate', 'hot toddy']
    )

    # Determine primary technique
    if has_hot or 'coffee' in glass.lower():
        return "Build in warmed glass. Add ingredients in order. Float cream on top."
    if 'blend' in name.lower() or has_blend or is_tiki and any('juice' in str(i[1]).lower() for i in ingredients):
        return "Blend all ingredients with crushed ice until smooth. Pour into glass."
    if has_egg and has_fizz:
        return "Dry shake all ingredients without ice. Shake again with ice. Strain into glass. Top with soda."
    if has_egg:
        return "Dry shake all ingredients without ice. Shake again with ice. Strain into chilled glass."
    if has_muddle and has_fizz:
        return "Muddle herbs/sugar in shaker. Add remaining ingredients. Shake with ice. Strain. Top with soda."
    if has_muddle:
        if 'mint' in str([i[1] for i in ingredients]).lower():
            return "Muddle mint and sugar gently in shaker. Add remaining ingredients. Shake with ice. Fine strain into glass."
        return "Muddle fruit/herbs in shaker. Add remaining ingredients. Shake with ice. Strain into glass."
    if has_coffee:
        return "Shake all ingredients vigorously with ice. Fine strain into glass."
    if is_stirred:
        return "Stir all ingredients over ice. Strain into glass."
    if is_sour:
        return "Shake all ingredients with ice. Strain into chilled glass."
    if has_fizz:
        return "Shake base ingredients with ice. Strain into glass. Top with soda."
    if has_cream:
        return "Shake all ingredients with ice. Strain into chilled glass."

    # Default by common patterns
    if any(t in glass.lower() for t in ['martini', 'coupe', 'nick', 'nora']):
        return "Shake all ingredients with ice. Strain into chilled glass."
    if any(t in glass.lower() for t in ['highball', 'collins']):
        return "Build ingredients directly in glass over ice. Stir gently."
    if any(t in glass.lower() for t in ['rocks', 'old']):
        return "Stir all ingredients over ice. Strain into glass over fresh ice."

    return "Shake all ingredients with ice. Strain into glass."


def write_original_garnish(name, ingredients, diffords_garnish):
    """Write a short original garnish description."""
    # If Difford's garnish is very specific, strip it down to essentials
    # Common garnishes are functional knowledge
    garnish_lower = diffords_garnish.lower()

    simple_garnishes = {
        'orange': 'Orange twist',
        'lemon': 'Lemon twist',
        'lime': 'Lime wheel',
        'cherry': 'Luxardo cherry',
        'mint': 'Mint sprig',
        'coffee': 'Three coffee beans',
        'olive': 'Olive',
        'salt': 'Salt rim',
        'sugar': 'Sugar rim',
        'cinnamon': 'Cinnamon stick',
        'nutmeg': 'Fresh nutmeg',
    }

    for key, value in simple_garnishes.items():
        if key in garnish_lower:
            return value

    # More specific checks
    if 'pineapple' in garnish_lower:
        return 'Pineapple wedge & cherry'
    if 'grapefruit' in garnish_lower:
        return 'Grapefruit wedge'
    if 'ginger' in garnish_lower:
        return 'Candied ginger'
    if 'raspberry' in garnish_lower or 'berry' in garnish_lower:
        return 'Fresh berries'
    if 'flower' in garnish_lower or 'violet' in garnish_lower:
        return 'Edible flower'
    if 'celery' in garnish_lower:
        return 'Celery stalk'
    if 'cucumber' in garnish_lower:
        return 'Cucumber slice'
    if 'bacon' in garnish_lower:
        return 'Bacon strip'
    if 'salt' in garnish_lower and 'rim' in garnish_lower:
        return 'Salted rim'
    if 'spent' in garnish_lower:
        return 'Spent lime shell & mint'
    if 'flag' in garnish_lower:
        return 'Fruit flag (cherry & orange slice)'

    # Fallback: pick something reasonable from ingredients
    has_lime = any('lime' in str(i[1]).lower() for i in ingredients)
    has_lemon = any('lemon' in str(i[1]).lower() for i in ingredients)
    has_orange = any('orange' in str(i[1]).lower() for i in ingredients)
    has_mint = any('mint' in str(i[1]).lower() for i in ingredients)

    if has_mint:
        return 'Mint sprig'
    if has_lime:
        return 'Lime wheel'
    if has_lemon:
        return 'Lemon twist'
    if has_orange:
        return 'Orange twist'

    return 'None'


# ─── Main ────────────────────────────────────────────────────────────────

def main():
    print("Loading Difford's database...")
    recipes = load_diffords(INPUT_CSV)
    print(f"  Loaded {len(recipes)} recipes")

    # Create lookup by title
    title_index = {}
    for r in recipes:
        title_index.setdefault(r['title_lower'], []).append(r)

    print(f"\nMatching {len(COCKTAILS)} cocktails...")

    matched = []
    unmatched = []
    match_stats = {'exact': 0, 'prefix': 0, 'normalized': 0, 'contains': 0, 'clean': 0, 'our_starts_with_title': 0, 'override_prefix': 0, 'override_contains': 0, 'numbers': 0}

    for cocktail_id, name, tier in COCKTAILS:
        result, match_type = find_match(name, recipes)
        if result:
            matched.append((cocktail_id, name, tier, result, match_type))
            match_stats[match_type] = match_stats.get(match_type, 0) + 1
        else:
            unmatched.append((cocktail_id, name, tier))

    print(f"\nMatch results:")
    for mtype, count in sorted(match_stats.items(), key=lambda x: -x[1]):
        print(f"  {mtype}: {count}")
    print(f"  Total matched: {len(matched)}")
    print(f"  Unmatched: {len(unmatched)}")

    if unmatched:
        print(f"\nUnmatched cocktails:")
        for cid, name, tier in unmatched:
            print(f"  [{tier}] {name} ({cid})")

    # ─── Fallback specs for cocktails not in Difford's ────────────────
    FALLBACKS = {
        "pornstar-martini": {
            "glass": "Coupe glass",
            "garnish": "Half passion fruit",
            "ingredients": [
                ("4 cl", "Vanilla vodka"),
                ("4 cl", "Passion fruit purée"),
                ("1.5 cl", "Lime juice (freshly squeezed)"),
                ("1.5 cl", "Vanilla syrup"),
                ("6 cl", "Prosecco (served alongside)"),
            ],
            "method": "Shake vodka, passion fruit purée, lime juice and syrup with ice. Strain into chilled coupe glass. Serve with prosecco shot on the side.",
        },
        "champs-elysees": {
            "glass": "Coupe glass",
            "garnish": "Lemon twist",
            "ingredients": [
                ("5 cl", "Cognac"),
                ("1.5 cl", "Yellow Chartreuse"),
                ("1.5 cl", "Lemon juice (freshly squeezed)"),
                ("1 cl", "Simple syrup"),
                ("1 dash", "Angostura Aromatic Bitters"),
            ],
            "method": "Shake all ingredients with ice. Strain into chilled coupe glass.",
        },
        "porto-flip": {
            "glass": "Coupe glass",
            "garnish": "Fresh nutmeg",
            "ingredients": [
                ("4.5 cl", "Ruby port"),
                ("4.5 cl", "Cognac"),
                ("1", "Egg yolk"),
                ("0.75 cl", "Simple syrup"),
            ],
            "method": "Shake all ingredients with ice. Strain into chilled glass.",
        },
        "angostura-colada": {
            "glass": "Hurricane glass",
            "garnish": "Pineapple wedge & cherry",
            "ingredients": [
                ("4.5 cl", "Angostura bitters"),
                ("3 cl", "Pineapple juice"),
                ("3 cl", "Coconut cream"),
                ("1.5 cl", "Lime juice (freshly squeezed)"),
            ],
            "method": "Blend all ingredients with crushed ice. Pour into glass.",
        },
        "la-louisiana": {
            "glass": "Coupe glass",
            "garnish": "Lemon twist",
            "ingredients": [
                ("3 cl", "Rye whiskey"),
                ("3 cl", "Sweet vermouth"),
                ("1.5 cl", "Bénédictine"),
                ("2 dash", "Peychaud's bitters"),
                ("2 dash", "Absinthe"),
            ],
            "method": "Stir all ingredients over ice. Strain into chilled glass.",
        },
        "cucumber-gimlet": {
            "glass": "Coupe glass",
            "garnish": "Cucumber slice",
            "ingredients": [
                ("6 cl", "Gin"),
                ("2 cl", "Lime juice (freshly squeezed)"),
                ("1.5 cl", "Simple syrup"),
                ("3 slice", "Cucumber"),
            ],
            "method": "Muddle cucumber with simple syrup. Add gin and lime. Shake with ice. Fine strain into glass.",
        },
    }

    # ─── Generate output CSV ──────────────────────────────────────────

    # Build all rows: matched + fallbacks
    all_rows = []
    for cocktail_id, name, tier, recipe, match_type in matched:
        all_rows.append((cocktail_id, name, tier, recipe['glass'],
                         generate_method(name, tier, recipe['glass'], recipe['ingredients'], recipe['recipe']),
                         write_original_garnish(name, recipe['ingredients'], recipe['garnish']),
                         recipe['ingredients']))

    for cocktail_id, name, tier in unmatched:
        if cocktail_id in FALLBACKS:
            fb = FALLBACKS[cocktail_id]
            all_rows.append((cocktail_id, name, tier, fb['glass'],
                             fb['method'],
                             fb['garnish'],
                             fb['ingredients']))
            print(f"  Using fallback for: {name}")
        else:
            print(f"  WARNING: No fallback for {name} ({cocktail_id})")

    # Determine max ingredient count
    max_ings = max(len(ings) for _, _, _, _, _, _, ings in all_rows) if all_rows else 0
    print(f"\nMax ingredients needed: {max_ings}")

    # Build CSV columns
    columns = ['id', 'name', 'tier', 'glass', 'method', 'garnish', 'ing_count']
    for i in range(1, max_ings + 1):
        columns.append(f'ing_{i}_amount')
        columns.append(f'ing_{i}_name')

    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(columns)

        for cocktail_id, name, tier, glass, method, garnish, ings in all_rows:
            row = [cocktail_id, name, tier, glass, method, garnish, len(ings)]
            for ing_amount, ing_name in ings:
                row.append(ing_amount)
                row.append(ing_name)
            # Pad with empty values up to max_ings
            for _ in range(len(ings), max_ings):
                row.append('')
                row.append('')

            writer.writerow(row)

    print(f"\nOutput written to: {OUTPUT_CSV}")
    print(f"  {len(all_rows)} cocktails, {max_ings} max ingredients, {len(columns)} columns")

    # Show summary of what we have
    tier_counts = {}
    for cid, name, tier, _, _, _, _ in all_rows:
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
    print(f"\nBreakdown by tier:")
    for t, count in sorted(tier_counts.items()):
        print(f"  Tier {t}: {count} cocktails")


if __name__ == '__main__':
    main()
