import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ExitLink from "@/components/ExitLink";
import FeedbackDoor from "@/components/FeedbackDoor";
import { getSessionId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { getNickname, setNickname } from "@/lib/nickname";
import { formatPercent, tally } from "@/lib/verdict";
import "@/roast.css";
import "@/roast-menu.css";

/**
 * The ROAST menu — the room's front door.
 *
 * WHY THERE IS NO GATE HERE (2026-10-06).
 *   This page used to read the visitor's votes and, finding none, send them to `/roast/enter`. The
 *   intent was sound — a newcomer should meet the ask before an empty menu — but the implementation was
 *   a cycle, and it shipped: `/roast/enter` navigates here, and the only surface that casts a vote is
 *   the deck, which is downstream of this page. So the test could never pass on the first pass, and a
 *   new visitor bounced between the two pages forever.
 *
 *   What is left is the read itself, which the standing strip needs. It no longer decides anything, so
 *   it cannot block the render — and the strip holds its numbers back until the read lands, because a
 *   returning visitor must never see "0 roasted" for a frame and then their real count.
 *
 *   A newcomer now sees the five rooms. Four of them are not yet theirs. That was the trade the author
 *   took, and it is the honest one: the menu says what it is, and the Arena is the door that makes the
 *   other four true.
 *
 * `?dry=1` PROPAGATES TO THE ROOM LINKS. Its original reason is gone with the gate; what remains is the
 *   flag being carried onto each entry, which is what lets a tester walk the flow in a browser without
 *   touching the production table.
 *
 * WHAT IS NOT HERE YET, AND WHY IT IS NOT SHOWN GREYED OUT: nothing, as of 2026-10-06. The editor, the
 *   roster and the recovery page all landed, so the menu is complete for rung 2. Two dead entries would
 *   teach a visitor that this menu lies, and a menu that lies once is one they stop reading.
 */

/** The room's entries. Data, not markup — the same move as roomCopy: an entry is an entry. */
const ENTRIES = [
  {
    to: "/roast/deck",
    kicker: "The Arena",
    blurb: "Roast the author's fifteen. Three rounds of five, and you can stop after any one of them.",
  },
  {
    to: "/roast/edit",
    kicker: "The editor",
    blurb: "Write your own version of a classic. It goes to your library — entering it is a separate act.",
  },
  {
    to: "/roast/roster",
    kicker: "My drinks",
    blurb: "Your library, and the one act that enters three or more of them in the arena.",
  },
  {
    to: "/roast/keep",
    kicker: "Your things",
    blurb: "Your key, so another device finds your drinks — and a copy of your recipes as a CSV.",
  },
  {
    to: "/roast/review",
    kicker: "Review",
    blurb: "Your record so far — what you agreed with, and what the room has said.",
  },
] as const;

/**
 * The rows the standing strip needs, and nothing else.
 *
 * THE VOTE IS CHECKED RATHER THAN TRUSTED, the same way the verdict checks it: the table's CHECK
 * constraint is the real gate, but this is a system boundary, and a row carrying neither value (a
 * hand-edited table, a value added later) must not be counted as an agreement.
 */
type MineVote = { vote: "agree" | "disagree" };

const asVotes = (data: unknown): MineVote[] => {
  if (!Array.isArray(data)) return [];
  const votes: MineVote[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    if (raw.vote === "agree" || raw.vote === "disagree") votes.push({ vote: raw.vote });
  }
  return votes;
};

/**
 * The page's texture layers.
 *
 * THEY ARE THE ROOM, NOT THE CONTENT: they live on the page, inside the room root so the selectors stay
 * scoped, and the frame is a plate sitting on them.
 *
 * THE GROUND CARRIES HALFTONE AND NOTHING ELSE. The dither that used to sit here is gone — it moved onto
 * the patches, where it is a background LAYER under the glyph rather than a wrapper over it — and the
 * film is no longer a page layer at all: it is a child of `.rm-frame`, so the scanlines stop dead at
 * that plate's edge and no pixel of the wash carries halftone AND scanlines. That was his own diagnosis
 * of the old build: "if we have it all in the same element (menu card)".
 *
 * The three halftone densities are the menu's own, and deliberately not `--tex-dot` from roast.css: that
 * token is the family's DARK-GROUND recipe, where a dot has to darken a ground that is already dark. A
 * dot that has to make a shadow on a BRIGHT wash is a different alpha for the same job — the recipe
 * differs by ground luminance, so this file carries its own three bands.
 */
const ArenaTexture = () => (
  <div className="rm-tex" aria-hidden="true">
    <div className="rm-wash" />
    <div className="rm-halftone tight" />
    <div className="rm-halftone" />
    <div className="rm-halftone loose" />
  </div>
);

const RoastMenu = () => {
  const [searchParams] = useSearchParams();
  const dry = searchParams.get("dry") === "1";

  /*
   * THE STANDING STRIP'S FACTS. The read fills the strip; it does not decide anything.
   *
   * THE GATE IS GONE (2026-10-06). This page used to read the visitor's votes and, finding none, send
   * them to /roast/enter. That was a cycle: /roast/enter navigates here, and the only surface that
   * casts a vote is the deck — which is downstream of this page — so the test could never pass on the
   * first pass and a new visitor bounced between the two pages forever.
   *
   * What is left is the read itself, which the strip needs and which no longer gates. It cannot block
   * the render, so `loaded` exists to keep the numbers off the screen until they are real: a returning
   * visitor must never see "0 roasted" for a frame and then their actual count.
   *
   * The nickname is local and synchronous — lib/nickname.ts is browser-only by design and never touches
   * the network. Read once into state rather than on every render.
   */
  const [mine, setMine] = useState<MineVote[]>([]);
  const [loaded, setLoaded] = useState(dry);

  /*
   * THE HANDLE LIVES HERE NOW (2026-10-06). It used to be collected on /roast/enter, which asked for a
   * name before the visitor had seen anything at all. The menu is where the value is shown, so it is
   * where it is edited — the form and the display become one thing, and the ask is left to be a brief.
   */
  const [handle, setHandle] = useState(() => getNickname());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  /** Persist, then re-read. lib/nickname.ts trims and clears an empty value, so getNickname() after the
   *  write is the canonical answer rather than a second guess at what was stored. */
  const saveHandle = () => {
    setNickname(draft);
    setHandle(getNickname());
    setEditing(false);
  };

  useEffect(() => {
    if (dry) return;
    if (!supabase) {
      setLoaded(true);
      return;
    }

    let cancelled = false;
    supabase
      .from("roast_votes")
      .select("spec_ref,vote")
      .eq("session_id", getSessionId())
      .then(({ data }) => {
        if (cancelled) return;
        setMine(asVotes(data));
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [dry]);

  const myTally = tally(mine);

  return (
    <div className="roast roast-menu">
      <ArenaTexture />

      <div className="rm-col">
        {/* LAW 8: the exit sits above the frame, centred. ExitLink is a SHARED component and is not
            replaced — roast-menu.css reaches only the copy of it inside this room, which is why the
            wrapper exists and why that rule is written against `.rm-exitrow a`.

            THE MINI COMPOSITOR — roast's own drink card, and NOT the standalone compositor app
            (github.com/B-Pingarron/compositor), which composes any cocktail for the hub. This one
            belongs to the roast: it previews one drink's artwork and adjusts colour and garnish seat,
            and nothing else.

            A PLAIN <a> AND NOT A <Link>, on purpose. The page is a STATIC FILE shipped from
            `public/roast/`, so it sits outside the HashRouter — a <Link> would route it client-side
            and land on nothing. RELATIVE, because `base: "./"` and an absolute path breaks on GitHub
            Pages: the same reason `data/roomCopy.ts` carries `./datenschutz.html`.

            SAME ORIGIN is the point, not a side effect: the colour store is
            `compositor.workbench.savedColors` and localStorage is origin-scoped, so the palette saved
            in the app is the palette this page reads.

            NO `?dry=1` PROPAGATION, unlike the five room doors below — the drink card reads no data,
            so the flag would travel to nothing. NO `target="_blank"`: this stays inside the family,
            one folder hop. */}
        <div className="rm-exitrow">
          <ExitLink />
          {/* THE FEEDBACK DOOR, beside the exit as the placement rule requires. The room's
              `.rm-exitrow a` chip rule reaches it for the same reason it reaches ExitLink — the
              wrapper is the room's, and the anchor is what the rule is written against. */}
          <FeedbackDoor where="roast-menu" className="exit" />
          <a href="./roast/roast-drink-card.html">
            mini compositor <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className="rm-stage">
          {/* the two misregister plates. They are OUTSIDE .rm-frame on purpose: the frame is rotated,
              and a plate inside it would swing with it and lose the offset it exists to draw.
              shadow-plates: two colours, two plates, glow kept — his defect report. */}
          <span className="plate plate-a" aria-hidden="true" />
          <span className="plate plate-b" aria-hidden="true" />

          {/* four tapes, straddling the frame's edge, "just holding things up" */}
          <span className="rm-tape t1" aria-hidden="true" />
          <span className="rm-tape t2" aria-hidden="true" />
          <span className="rm-tape t3" aria-hidden="true" />
          <span className="rm-tape t4" aria-hidden="true" />

          <div className="rm-frame">
            {/* THE PLATE'S TEXTURE, AND THE ONLY ONE ON THIS ELEMENT. A CHILD of the frame, so the
                scanlines stop at the plate's own edge and the wash behind keeps halftone only. It sits
                ABOVE the doors — "a light film on top, gicing it like a old monitor effect" — and it is
                inert. It carries no halftone: the card's dot fields used to live on this element, and
                that collision is exactly what he marked. */}
            <div className="rm-film" aria-hidden="true" />

            {/* KEPT, AND IT IS ONE OF TWO PLACES THIS PASS DID NOT FOLLOW THE STUDY STRICTLY. §11 says
                the menu holds the strip and the five entries "and nothing else", and the approved mockup
                builds neither this eyebrow nor the sentence below. Both are the APP'S OWN COPY, though,
                and deleting real copy is a content decision rather than a styling one. They stay, on the
                plate; roast-menu.css names the one-line revert. */}
            <span className="kick">Roast · the room</span>

            {/*
              THE STANDING STRIP, AND IT IS ONE LINE BY DECISION. The menu carries five rooms; three
              panels of record would push the doors below the fold on a phone. Handle, how much has been
              roasted, and the rate — the rest of the record is one door down, in Review.
            */}
            <div className="rm-strip" aria-busy={!loaded}>
              <span className="fact">
              {editing ? (
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={saveHandle}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveHandle();
                    // Escape abandons the edit without writing. The draft is re-seeded on open, so
                    // there is nothing to restore here.
                    if (event.key === "Escape") setEditing(false);
                  }}
                  maxLength={32}
                  autoFocus
                  aria-label="Your handle"
                  className="rm-handle"
                />
              ) : (
                /*
                 * THE HANDLE IS THE EDIT CONTROL. One button rather than a value plus an "edit" link:
                 * there is nothing to explain, nothing to miss, and the target is the width of the
                 * word itself.
                 */
                <button
                  type="button"
                  className="who"
                  onClick={() => {
                    setDraft(handle ?? "");
                    setEditing(true);
                  }}
                  title="Edit your handle"
                >
                  <span className="who-t">{handle ?? "Anonymous"}</span>
                </button>
              )}
              </span>

              <span className="fact">
                <span className="lbl">roasted</span>
                {loaded ? (
                  <span className="num tf-plate">{myTally.total}</span>
                ) : (
                  <span className="pend" aria-hidden="true" />
                )}
              </span>

              <span className="fact">
                <span className="lbl">rate</span>
                {loaded ? (
                  <span className="num tf-plate">{formatPercent(myTally.rate)}</span>
                ) : (
                  <span className="pend" aria-hidden="true" />
                )}
              </span>
            </div>

            <h1 className="rm-title">
              <span className="tf-plate big">
                <span className="t triple">My spec, roasted</span>
              </span>
            </h1>

            <p className="rm-standfirst">
              Your taste against theirs. The classics get a consensus; this gets an argument.
            </p>

            <nav className="rm-entries" id="rooms" aria-label="The five rooms">
              {ENTRIES.map((entry) => {
                /*
                 * THE PRIMARY IS DERIVED FROM THE ROUTE, NOT FROM A FOURTH FIELD. §11 is explicit: an
                 * entry receives a route, a kicker and one sentence of blurb and nothing else. So "the
                 * Arena is the primary" is read off the route it already carries.
                 */
                const primary = entry.to === "/roast/deck";
                return (
                  <Link
                    key={entry.to}
                    to={dry ? `${entry.to}?dry=1` : entry.to}
                    className={primary ? "rm-entry rm-entry--primary" : "rm-entry"}
                  >
                    {/* two prints on the four dark doors — the paper and the black key. The Arena is
                        exempt on purpose: its ground is the accent fill, opaque already, and #000 on --b
                        has no room for a black plate. */}
                    <span className={primary ? "name" : "name duo"}>{entry.kicker}</span>
                    <span className="blurb">{entry.blurb}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoastMenu;
