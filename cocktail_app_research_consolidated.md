# Cocktail Consensus App -- Research Consolidation

Generated: 2026-03-30 23:58 UTC

This document consolidates the findings and development ideas from a
ChatGPT design/research session about building a cocktail survey web
application.\
The purpose is to allow another parallel session to ingest this file and
merge insights between branches.

------------------------------------------------------------------------

# 1. Core Project Idea

Create a **web app that surveys users about cocktail recipes from
different sources**.

Users are shown a **randomized card** containing: - Cocktail name -
Illustration (minimal sketch style) - Standard recipe - Preparation
method

Example card:

Old Fashioned - 60 ml Bourbon - 1 sugar cube - 2 dashes Angostura
bitters - Stir - Tumbler with ice - Orange zest

User interaction: - 👍 Agree with recipe - 👎 Disagree - Optionally view
alternative recipes

Goal: Collect crowd feedback to identify **consensus cocktail
specifications** and create a **standardized cocktail list**.

Future vision: A second application that exposes the dataset and
consensus results.

------------------------------------------------------------------------

# 2. Visual Direction

Design inspiration: - Modern iOS minimal UI - Brutalist architecture -
Classic wooden libraries - Green banker lamps

Palette suggestion:

Deep green: #0e2a21\
Walnut brown: #3a2a1c\
Gold/brass: #c7a34b\
Parchment: #f3efe6

Design characteristics:

-   Elegant brutalist cards
-   Thin gold borders
-   Dark backgrounds
-   Minimal icons
-   Heavy serif headings
-   Subtle texture similar to old paper or wood

Conceptual vibe:

"Cocktail archive in a vintage library."

------------------------------------------------------------------------

# 3. Illustration Style Development

Illustrations should:

-   Be **2D**
-   Look **hand sketched**
-   Lines traced multiple times
-   Marker style coloring
-   Imperfect fill
-   Minimal geometric forms

Example structure:

Glass outline → grey sketch lines\
Liquid → red marker strokes\
Ice cubes → light blue squares\
Garnish → orange wedge

Style goal: Minimal abstract cocktail icons instead of realistic images.

------------------------------------------------------------------------

# 4. Public Cocktail Databases

## 4.1 TheCocktailDB

Best public API.

Features: - \~600 cocktails - Ingredients - Measurements -
Instructions - Images - JSON API

Example endpoint:

https://www.thecocktaildb.com/api/json/v1/1/search.php?s=negroni

Advantages: - Easy integration - Free tier - Large community usage

------------------------------------------------------------------------

## 4.2 Mixology.tools

Research oriented database.

Focus:

-   ingredient taxonomy
-   drink structure classification

Example structure model:

Margarita = Spirit + Citrus + Sweetener\
Daiquiri = Spirit + Citrus + Sweetener

Useful for trend analysis.

------------------------------------------------------------------------

## 4.3 International Bartenders Association (IBA)

Authoritative reference list.

Includes:

-   \~90 official cocktails
-   standardized specifications

Example:

Old Fashioned - 4.5 cl Bourbon - 1 sugar cube - 2 dash Angostura

Useful as baseline canonical recipes.

------------------------------------------------------------------------

## 4.4 Webtender

Older but very large cocktail repository.

Advantages:

-   thousands of cocktails
-   alternative variations

Downside:

-   messy data structure

------------------------------------------------------------------------

# 5. Editorial Sources

Major cocktail websites:

-   Liquor.com
-   Imbibe Magazine
-   Punch

These contain high quality recipes but are **editorial content**.

Important distinction:

Recipes themselves are factual formulas.

But the following are copyrighted:

-   Photos
-   Editorial text
-   Narrative instructions
-   Articles

Safe approach: Use normalized recipe format rather than copying
descriptions.

Example normalized format:

Old Fashioned

Ingredients: 60 ml Bourbon\
1 sugar cube\
2 dash Angostura

Method: Stir\
Serve on ice\
Orange zest

------------------------------------------------------------------------

# 6. Suggested Data Model

## Cocktails Table

id\
name\
glass\
method\
image

------------------------------------------------------------------------

## Recipes Table

cocktail_id\
source\
ingredients\
ratios\
votes

------------------------------------------------------------------------

## Ingredients Table

name\
category\
alcoholic

------------------------------------------------------------------------

## Votes Table

user_id\
recipe_id\
agree\
disagree

------------------------------------------------------------------------

# 7. Example Survey Card Flow

Card displays:

Cocktail name\
Illustration\
Standard recipe

User choices:

👍 Agree\
👎 Disagree

Alternative recipe option:

Example:

Recipe A 60 ml Bourbon\
1 sugar cube\
2 dash Angostura

Recipe B 60 ml Rye\
7.5 ml simple syrup\
2 dash Angostura

------------------------------------------------------------------------

# 8. Additional Data Worth Collecting

User preferences:

-   preferred base spirit
-   sweetener type
-   bitters type
-   garnish type
-   glass type

This allows analytics such as:

-   most agreed Negroni ratio
-   most common Old Fashioned sweetener
-   regional preferences

------------------------------------------------------------------------

# 9. Potential Analytics

Possible outputs:

Global consensus ratios\
Ingredient frequency analysis\
Bitters usage trends\
Regional drink preferences

Examples:

Most accepted Negroni ratio worldwide\
Old Fashioned sweetener preference by country

------------------------------------------------------------------------

# 10. High Potential Feature

Bartender Mode

Allows professionals to submit:

-   preferred recipe
-   bar name
-   city

This enables:

Global bartender consensus dataset.

Possible visualizations:

Most accepted Negroni ratio globally\
Regional recipe differences

Potential value:

High for: - bars - cocktail researchers - spirits brands

------------------------------------------------------------------------

# 11. Long-Term Vision

The survey application acts as a **data collection engine**.

Future products:

1.  Consensus cocktail specification database\
2.  Cocktail trend analytics platform\
3.  Public cocktail API based on real user agreement\
4.  Visual cocktail encyclopedia

Conceptual positioning:

"IMDb for cocktail recipes."
