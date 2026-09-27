 /**
 * Hub copy — the single source for the lounge.
 *
 * Every string the hub lounge renders lives here, not in a component. The cover,
 * the lounge and the entries are one surface; when the copy is spread across three
 * files the headline and the blurb drift apart, which is exactly how the landing
 * page and the census ended up disagreeing about the effort estimate.
 *
 * Copy is data. Components render it, they do not author it.
 */

/** A door out of an entry: where it goes and how loud it is. */
export type HubDoor = {
  /** Lowercase in data. Rendered uppercase by CSS, so the copy stays readable here. */
  label: string;
  /** Router path, absolute. */
  to: string;
  /** The primary door is gold; the secondary door is muted. Exactly one per entry. */
  primary: boolean;
};

/** One seat in the lounge. */
export type HubEntry = {
  id: string;
  title: string;
  blurb: string;
  doors: HubDoor[];
};

/**
 * The standfirst: what BarNerd is, in the visitor's own terms, before any choices.
 *
 * Sits under the "Pick a seat" heading and above the entries. Deliberately plain:
 * no account, no email, two minutes, and the joke about who is doing the judging.
 */
export const HUB_STANDFIRST =
  "BarNerd is an open database of specs, built by bartenders instead of journalists. The classics are up for a vote. Mine are up for a roast. No account, no email, two minutes.";

/**
 * The five seats.
 *
 * WHY ROAST IS FIRST: it is the primary door and the Census is the second. The Census is
 * the pipeline, Roast is the game, and the funnel runs toward the data rather than away from
 * it. The order of this array is the order of the menu, so it is a decision, not a sort.
 *
 * Every secondary door is now a real room. They used to point at /soon/:room, which existed
 * because Compositor and Recipe Manager had nowhere honest to send a guest. They have rooms
 * now, so the placeholders are gone rather than left answering "coming" about things that
 * have arrived.
 *
 * THE COMPOSITOR AND THE RECIPE MANAGER EACH HAVE ONE DOOR, not two. There is no app to
 * enter: the Compositor's room explains itself with its recorded demo, and the Recipe
 * Manager's ask is how you get in. A second door with nothing behind it is the exact thing
 * the /soon page used to be.
 *
 * About is one line and one door: there is nothing to learn about a page that does
 * not exist yet, so a second door would be a lie with extra steps.
 */
export const HUB_ENTRIES: HubEntry[] = [
  {
    id: "roast",
    title: "Roast",
    blurb: "My 15 specs. Roast them.",
    doors: [
      { label: "straight in", to: "/roast/enter", primary: true },
      { label: "learn more", to: "/room/roast", primary: false },
    ],
  },
  {
    id: "census",
    title: "Census",
    blurb: "The 100 classics. Agree or disagree.",
    doors: [
      { label: "straight in", to: "/census", primary: true },
      { label: "learn more", to: "/room/census", primary: false },
    ],
  },
  {
    id: "compositor",
    title: "Compositor",
    blurb: "Build a drink, layer by layer.",
    doors: [{ label: "see it", to: "/room/compositor", primary: true }],
  },
  {
    id: "recipe-manager",
    title: "Recipe Manager",
    blurb: "Your own library. Closed beta.",
    doors: [{ label: "learn more", to: "/room/recipe-manager", primary: true }],
  },
  {
    id: "about",
    title: "About",
    blurb: "Who's asking.",
    doors: [{ label: "read it", to: "/about", primary: true }],
  },
];
