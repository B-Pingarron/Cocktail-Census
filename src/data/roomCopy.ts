import { CONSENT_LABELS, CONSENT_NOTICE_LABEL, CONSENT_TEXT } from "@/lib/consentText";

/**
 * Phase 4 copy — the four room explainers and the shared ask.
 *
 * WHY A DATA FILE AND NOT A COMPONENT:
 *   The same reason `hubEntries.ts` exists. The lounge has one card component and five
 *   entries, and the copy lives beside the entries rather than inside the card. Adding four
 *   rooms multiplies the number of places the same sentence could live, and the failure
 *   this project has already paid for is a headline and a blurb drifting apart across two
 *   files. Copy is data. Components render it; they do not author it.
 *
 * EVERY WORD HERE IS ACCEPTED COPY. It was written with the user and approved before a single
 * component existed. Do not reword it while building the screens — if a line does not fit a
 * layout, change the layout, or ask. The one exception already ruled: the Recipe Manager is
 * under construction, so it is never described as absent.
 *
 * THE CONSENT SURFACE IS NOT AUTHORED HERE. The legal block and the checkbox labels are
 * derived from `consent.v1.json` via `consentText.ts`, because that wording must have one
 * home and this file has already once been the place where two halves of one message
 * drifted apart. What lives here is layout data: which block, which link, which outcome
 * message — never the legal wording itself.
 */

/** One door out of a room. A room with no door says so, and the ask is its way in instead. */
export type RoomDoor = {
  /** Lowercase in data. Rendered uppercase by CSS, so the copy stays readable here. */
  label: string;
  /** Router path, absolute. */
  to: string;
};

/**
 * The non-interactive Compositor demo.
 *
 * WHY REAL SCREEN RECORDINGS AND NOT A RENDER: these are the actual Compositor, recorded
 * and cut. Nothing here is illustrated or reconstructed, which is the one rule the RM room
 * cannot bend and the one these assets honour by existing at all.
 *
 * WHY FRAMES BEFORE CLIPS: the stills establish what the tool is — the picker, the empty
 * glass, the normalisation sheet, the finished drink, the review. The clips then show the
 * only three moments that move. Read in the other order the clips look like decoration.
 *
 * WHY THE CLIPS ARE NOT DESCRIBED AS A BUILD-UP: the garnish does not simply accumulate. It
 * is tried, removed and swapped before it settles, and two of the three clips are honest
 * about a different thing — one swaps the glass, one moves a garnish's position. Only the
 * second clip is an accumulation, and it is three frames long because that is all the
 * recording contains.
 *
 * WHY NO ICE AND NO FOAM: ice art is not shippable and is not chased. Foam is a fill
 * parameter in the Compositor's UI, not a distinct layer in this footage. The layers these
 * assets can honestly show are glass, liquid and garnish.
 *
 * FORMATS: the clips are GIF and the stills are WebP, ~307 KB for the nine. Animated WebP
 * was tried and rejected: this machine's ffmpeg writes animated WebP that its own decoder
 * rejects, and the hand-tuned GIFs are smaller than that broken output anyway.
 */
export const COMPOSITOR_DEMO = {
  frames: [
    {
      src: new URL("../assets/compositor/shot-001.webp", import.meta.url).href,
      alt: "The Compositor with the glassware list open, showing coupe, flute, highball, rocks, wine and more. A coupe with an amber drink sits in the preview.",
    },
    {
      src: new URL("../assets/compositor/shot-070.webp", import.meta.url).href,
      alt: "Glass selection. An empty glass outline above a grid of glass shapes. Nothing has been poured yet.",
    },
    {
      src: new URL("../assets/compositor/shot-170.webp", import.meta.url).href,
      alt: "The garnish contact sheet, a grid of garnish variants around the centre of each cell, with compression, rotation and mirror variants marked.",
    },
    {
      src: new URL("../assets/compositor/shot-180.webp", import.meta.url).href,
      alt: "The drink half built. A coupe with amber liquid, a cherry on a pick and a long garnish stick.",
    },
    {
      src: new URL("../assets/compositor/shot-280.webp", import.meta.url).href,
      alt: "The finished drink with the recipe panel open, listing Martini Dry. A cherry and a lemon twist on the rim.",
    },
    {
      src: new URL("../assets/compositor/shot-310.webp", import.meta.url).href,
      alt: "A review screen with the express manifest beside it, and Good, Improve and Neutral buttons for the reviewer.",
    },
  ],
  clips: [
    {
      src: new URL("../assets/compositor/glass.gif", import.meta.url).href,
      alt: "Four glasses in turn, as the glassware is swapped: a coupe, a highball, a champagne flute, then a coupe again.",
    },
    {
      src: new URL("../assets/compositor/grow.gif", import.meta.url).href,
      alt: "The garnish landing on a built drink. A cherry and a long stick, then a green element joining them, then the finished garnish.",
    },
    {
      src: new URL("../assets/compositor/settle.gif", import.meta.url).href,
      alt: "A cherry and a lemon twist on the finished drink, shifting position as the placement is adjusted.",
    },
  ],
};

/** One room: the name, the four blocks in order, and the way in. */
export type Room = {
  id: string;
  /** The room's own name, as the product calls it. */
  title: string;
  /** WHAT / WHY / WHO / WHEN, in that order, verbatim. */
  blocks: { label: string; text: string }[];
  /**
   * Absent means there is honestly nowhere to go. The Recipe Manager does not exist as an app
   * yet and the Compositor's destination is a later build, so neither room invents a door —
   * the demo is how the Compositor explains itself, and the Recipe Manager ends on `closing`.
   */
  door?: RoomDoor;
  /**
   * A closing statement for a room that has nothing to enter. Rendered where a door would be.
   *
   * Set only on the Recipe Manager, and only since 2026-10-12: the app's ask is switched off
   * (`PartyAsk`), and the ask was that room's only way in, so without a line the page simply
   * stopped mid-thought and read as broken rather than as unfinished. TEMPORARY — if the ask
   * returns, or the room gets a real door, this line goes.
   */
  closing?: string;
  /** Set only on the Compositor: the non-interactive demo, rendered between WHY and WHO. */
  demo?: typeof COMPOSITOR_DEMO;
};

export const ROOMS: Room[] = [
  {
    id: "roast",
    title: "ROAST my spec",
    blocks: [
      {
        label: "What",
        text: "ROAST is the arena where specs get measured by peers. Mine are first up. Take a side, tap a note, see where your palate lands. My specs, your taste. No mercy.",
      },
      {
        label: "Why",
        text: "The Census looks for common ground. ROAST is the rowdy way in: one person's spec meets your palate, and the room gets a say. Fernet in an Espresso Martini? Peychaud's in a French 75? The commentator calls the round; the vote is yours. The longer play is a loop: versions that find agreement in ROAST can return to the Census as alternatives. Some magazine lists and awards are popularity contests in a nice jacket. Here, the spec gets tested by the room.",
      },
      {
        label: "Who",
        text: "Bartenders and the wider bar industry first. Barflies are welcome too. Anyone can vote.",
      },
      {
        label: "When",
        text: "The first round is my fifteen. Work through the deck, then see where the room lands. The plan is to let you bring a list of your own into the arena.",
      },
    ],
    door: { label: "straight in", to: "/roast/enter" },
  },
  {
    id: "census",
    title: "The Cocktail Census",
    blocks: [
      {
        label: "What",
        text: "A hundred classics, one at a time. The Census asks whether the spec on screen should be the standard pour.",
      },
      {
        label: "Why",
        text: "A standard is a claim about what people actually do. The Census puts that claim to the people who make the drinks and records what comes back. One at a time, the votes build a live picture of where the industry agrees and where it doesn't. The aim is a useful, current reference, open to everyone who wants a say.",
      },
      {
        label: "Who",
        text: "For bartenders and the wider bar industry first. Barflies are welcome, and anyone can vote.",
      },
      {
        label: "When",
        text: "It's live now: one classic at a time, then see where the room lands. The plan is to connect it with ROAST: variants that find agreement in the arena can come back to the Census as alternatives.",
      },
    ],
    door: { label: "straight in", to: "/census" },
  },
  {
    id: "compositor",
    title: "Compositor",
    blocks: [
      {
        label: "What",
        text: "The Compositor joins a recipe with its visual assets and prints the result as a layered SVG. The illustrations are the same ones you see in the Census.",
      },
      {
        label: "Why",
        text: "Presentation is part of the drink. In a competition, the jury judges the look as well as the liquid, and garnish is always a matter of taste. The Compositor brings that visual side into the spec, joining the recipe to the assets that show its serve. Future patches will open up more glassware, styles and vibes to build with.",
      },
      {
        label: "Who",
        text: "For people writing and working with cocktail specs, especially bartenders and bar teams.",
      },
      {
        label: "When",
        text: "The printer is already working, and the Census is already using its illustrations. At BCB, we'll show what it makes. We're trying to get a small build-your-own version ready next.",
      },
    ],
    demo: COMPOSITOR_DEMO,
  },
  {
    id: "recipe-manager",
    title: "Recipe Manager",
    blocks: [
      {
        label: "What",
        text: "A quick place to find the spec you need mid-shift, draft your own drinks, and organize your library.",
      },
      {
        label: "Why",
        text: "No shame in not having a million specs memorized. When you need to check a drink, you shouldn't have to dig through search results or bounce between ad-heavy apps. Find a respectable spec, then work on your own: draft drinks, organize your library, and take your recipes with you. Import and export are the first, simple way to share. The longer-term idea is a social hub: managers share this season's specs, and teams trade drafts and ideas with colleagues, rivals, or the world.",
      },
      {
        label: "Who",
        text: "For bartenders who need a reliable reference on shift, and for people and teams developing their own drinks.",
      },
      {
        label: "When",
        text: "The Recipe Manager is under construction, with its foundations in place. The first step is a simple list-maker with file import and export, so your library can travel. The fuller manager and social sharing come next.",
      },
    ],
    // No door on purpose. There is no app to enter. The ask below used to be the honest way
    // in; it is switched off in the app (PartyAsk, 2026-10-12), so the room closes on a line
    // that says the room is unfinished rather than leaving the page mid-air.
    closing:
      "That is the whole room for now — no door, no demo, no list box. It is unfinished on purpose, not broken: the first build is a simple list-maker with import and export, and the door will appear here when there is an app behind it.",
  },
];

/** The room behind a URL, or undefined if the room does not exist. */
export function roomById(id: string | undefined): Room | undefined {
  return ROOMS.find((room) => room.id === id);
}

/**
 * The ask — one component, mounted at the end of every room and in the lounge.
 *
 * WHY ONE FORM AND NOT FOUR: the visitor decides once. A separate form per room means the
 * same decision asked four times, and four places to keep the consent wording correct.
 *
 * WHY THESE THREE: they are the three genuinely different relationships someone can have
 * with this project. They are independent on purpose — asking about one is not asking about
 * the others, and a person who only wants the newsletter should not have to also volunteer
 * for a beta.
 *
 * WHY THE CONSENT SURFACE IS BILINGUAL AND DERIVED: the audience is an international trade
 * fair in Berlin, so German-only or English-only is both wrong. The block is the canonical
 * wording from `consent.v1.json` — rendered, never rewritten, in either language — and the
 * checkbox labels are the same wording's purpose labels, so what the visitor reads and what
 * the consent evidence says cannot differ. The consent line that used to promise no email
 * would now be a lie: double opt-in sends exactly one confirmation email and the messages
 * only follow a click on it. The three outcome strings below each describe one real path.
 *
 * NONE OF IT RENDERS TODAY. `PartyAsk` returns null while the app's ask is switched off
 * (2026-10-12, ADR-036) — the app is not a capture surface while the standalone BCB page is
 * the one that takes addresses. The copy stays here, unedited and ready, because one line
 * switches it back on and a deleted copy would be a rewrite rather than a toggle.
 */
export const ASK_COPY = {
  heading: "Get in touch",
  emailLabel: "Your email address",
  emailPlaceholder: "you@example.com",
  /** The interactive boxes, labelled with the canonical purpose labels, both languages. */
  options: [
    { id: "rm-beta", label: CONSENT_LABELS["rm-beta"].en, labelDe: CONSENT_LABELS["rm-beta"].de },
    { id: "roast-beta", label: CONSENT_LABELS["roast-beta"].en, labelDe: CONSENT_LABELS["roast-beta"].de },
    { id: "news", label: CONSENT_LABELS["news"].en, labelDe: CONSENT_LABELS["news"].de },
  ] as const,
  /**
   * The consent blocks, German first, with the controller-email parameter already
   * substituted (consentText.ts does it at load; the wording itself is untouched — the
   * frozen hashes cover the template). `noticeLabel` is not part of the hashed
   * text; it is rendered after the block, carrying a *relative* link to the Art. 13 notice
   * (`base: "./"` — an absolute path would break on GitHub Pages).
   */
  consent: {
    de: CONSENT_TEXT.de,
    en: CONSENT_TEXT.en,
    noticeDe: CONSENT_NOTICE_LABEL.de,
    noticeEn: CONSENT_NOTICE_LABEL.en,
    noticeHref: "./datenschutz.html",
  },
  submit: "Save my choices",
  /** Stored, and the confirmation email request succeeded. Says what is really on its way. */
  success:
    "Saved — your choices are in, and the confirmation email is on its way. Open it and click the link; only after that will we write to you.",
  /**
   * Stored, but the confirmation email request failed. Its own string on purpose: this is
   * not a success (no email left) and not an error (the contact exists). Saying "thanks,
   * check your inbox" here would be the lie the old consent line used to tell in reverse.
   */
  successNoConfirm:
    "Saved — your choices are in, but the confirmation email could not be sent; nothing left here. Until the confirmation link is clicked, nothing will be written to you.",
  /** Shown only when the write fails. Names the failure rather than pretending it worked. */
  error: "That didn't save. Nothing was sent — try again in a moment.",
  /** Shown when the field is empty. */
  emptyEmail: "An email address, so we can write to you.",
  /** Shown when nothing is ticked. Its own string, never derived from another one. */
  noInterests: "Tick at least one — that is the whole form.",
};

export type AskOptionId = (typeof ASK_COPY.options)[number]["id"];
