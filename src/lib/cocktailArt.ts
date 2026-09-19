import placeholderIcon from '@/assets/cocktail-placeholder.svg'

/**
 * The illustrated artwork for a cocktail, by id.
 *
 * ONE IMAGE PER COCKTAIL, produced outside this app. The compositor composes each illustration from its own layer
 * assets and writes a flat SVG named after this app's recipe id; those files are copied into
 * `src/assets/cocktails/`, and this module is the whole of the wiring on this side. Nothing here knows about layers,
 * parts or positions — by the time a file lands here it is a single finished picture.
 *
 * `import.meta.glob` at build time rather than a hand-written import list: adding a cocktail should not need an edit
 * here, and a missing illustration should be visible as one placeholder rather than a type error. Vite emits each SVG
 * as its own file, so a reader downloads the one card they are looking at, not the set.
 *
 * The id is the file name, which is also the id the vote is posted under — so the picture and the vote can never
 * disagree about which cocktail they are for.
 */
const modules = import.meta.glob('../assets/cocktails/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const byId = new Map<string, string>()
for (const [path, url] of Object.entries(modules)) {
  byId.set(path.slice(path.lastIndexOf('/') + 1, -'.svg'.length), url)
}

/**
 * The illustration for `id`, or the shared placeholder when there is none.
 *
 * The fallback is deliberate rather than an error: a card for a cocktail nobody has drawn yet is still a card, and the
 * placeholder is what every card showed before the artwork existed — which is the state a new recipe is in until the
 * compositor catches up.
 */
export function cocktailArt(id: string): string {
  return byId.get(id) ?? placeholderIcon
}

/** How many cocktails have their own illustration. Read by the check, not by the card. */
export function illustratedCount(): number {
  return byId.size
}
