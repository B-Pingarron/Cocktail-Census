import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FRAME_VARIANTS, buildQuad, mulberry32, neonSegments } from "@/lib/frameGeometry";
import type { FrameVariant, FrameVariantId, Quad } from "@/lib/frameGeometry";
import { AXIS_LABEL, ROAST_AXES, notesFor, phraseFor } from "@/data/roastNotes";
import { ROAST_LIST_AUTHOR } from "@/data/roastSpecs";
import { cocktailArt } from "@/lib/cocktailArt";
import type { RoastAxis, RoastSide, RoastSpec } from "@/types/roast";

/**
 * The roast spec card — one spec of the deck, on the frame the author wrote it on.
 *
 * Ported from the v10 visual reference
 * (`.pi/visual-companion/roast-mockup/content/card-starter-10-standalone.html`). The look is not
 * re-designed here: the layers, their order, the palette and the geometry are the reference's.
 *
 * THE FRAME IS MEASURED, NOT DECLARED:
 *   The stack's real width and height are read after layout, a quad is rejection-sampled for that
 *   box (lib/frameGeometry.ts), and every layer that has to follow the cut — the two misregister
 *   plates, the ink frame, the pixel canvas — is clipped to it. The neon is rendered along the same
 *   quad. A frame drawn in a stylesheet could not do this: the card's height depends on the recipe
 *   text and the font, so a declared cut would be wrong on the next spec.
 *
 * WHY BOTH FACES ARE ALWAYS MOUNTED:
 *   A CSS transition cannot start from the value an element mounts with, so a back face created on
 *   demand appears already turned with nothing to interpolate — no flip at all. The back is out of
 *   flow and its own content is what the deck turns to, so it has to exist before the turn starts.
 */

/**
 * The pixel surface, in cells.
 *
 * Sized so the cells read as blocks and not as noise. At the card's own width of ~374px this is 40
 * cells of ~9.3px; the author asked for the cells 25% smaller than the first pass, which is 1/0.75 =
 * 1.333x more of them.
 *
 * The cells are NOT square, and the reason is worth keeping: the row count is a constant while the
 * card's height is text-driven, so a longer recipe stretches every cell vertically. Measured on a
 * 699px card: 12.5 x 20.6 before, 9.3 x 15.5 now. Squaring them means deriving the rows from the
 * measured height at paint time, which is a change to how the canvas is sized rather than to these
 * numbers.
 */
const PIXEL_COLS = 40;
const PIXEL_ROWS = 45;
const PIXEL_SEED = 1337;

/**
 * Ink, in px, placed as the reference places it: absolute positions against a 360px card. At any
 * other width the drips keep their size and slide with the left edge, which is the behaviour the
 * reference has and is only visible on a narrower phone.
 */
const INK_DRIPS: Record<FrameVariant["ink"], [number, number, number][]> = {
  none: [],
  light: [
    [92, 5, 58],
    [244, 6, 44],
    [58, 5, 20],
  ],
  heavy: [
    [26, 6, 46],
    [92, 5, 64],
    [168, 4, 38],
    [244, 7, 54],
    [306, 5, 30],
    [58, 5, 22],
    [210, 4, 28],
    [288, 6, 18],
  ],
};

/** Tape: [left, top, rotation]. */
const INK_TAPE: Record<FrameVariant["tape"], [number, number, number][]> = {
  0: [],
  1: [[6, 4, -24]],
  3: [
    [6, 4, -24],
    [300, 110, 17],
    [24, 232, -8],
  ],
};

export type RoastPalette = "heat" | "mag" | "lime" | "amber";

interface RoastSpecCardProps {
  spec: RoastSpec;
  /** 0-based position in the deck. The readout prints `index + 1`, which is what a visitor counts. */
  index: number;
  total: number;
  /** Null until a vote button is pressed; that is also what turns the card over. */
  side: RoastSide | null;
  /**
   * The vote already cast on each spec, by position. Only the counter reads it: the card cannot know
   * what came before it, because the deck remounts it per spec.
   */
  votes: (RoastSide | null)[];
  /** At most one id per axis — enforced by the deck. */
  selected: string[];
  onVote: (side: RoastSide) => void;
  onToggleNote: (id: string) => void;
  onSkip: () => void;
  onNext: () => void;
  palette?: RoastPalette;
  frame?: FrameVariantId;
}

/**
 * The pixel dither, drawn into the canvas the frame is clipped to.
 *
 * A vignette rather than an even field: the dither dies out in the middle so the recipe text has
 * something flat to sit on, and only the rim is loud. Even noise behind 11px body copy is
 * unreadable, and the reference's own note says the pixel layer used to be a grey veil because it
 * sat at 55% under the ink.
 */
function paintPixelBackground(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rand = mulberry32(PIXEL_SEED);
  ctx.fillStyle = "#0f0a1e";
  ctx.fillRect(0, 0, PIXEL_COLS, PIXEL_ROWS);

  for (let y = 0; y < PIXEL_ROWS; y++) {
    for (let x = 0; x < PIXEL_COLS; x++) {
      const nx = (x / (PIXEL_COLS - 1) - 0.5) * 2;
      const ny = (y / (PIXEL_ROWS - 1) - 0.5) * 2;
      const radius = Math.sqrt(nx * nx + ny * ny);
      const edge = Math.max(0, Math.min(1, (radius - 0.3) / 0.85));
      if (edge <= 0) continue;

      const roll = rand();
      let alpha = 0;
      if (roll > 0.86) alpha = 0.3 * edge;
      else if (roll > 0.62) alpha = 0.16 * edge;
      else if (roll > 0.42) alpha = 0.07 * edge;
      if (alpha <= 0) continue;

      ctx.fillStyle = `rgba(170,146,226,${alpha.toFixed(3)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // A few accent pixels, rim only: inside the vignette they would be specks on the text.
  // They used to be pink and cyan. The author asked for the whole field to be a purple grayscale
  // instead of a grey one with two coloured details, so the accents are now two steps of the same
  // purple — one lighter than any dither tone, one deeper — and carry the same information.
  for (let k = 0; k < 14; k++) {
    const ax = Math.floor(rand() * PIXEL_COLS);
    const ay = Math.floor(rand() * PIXEL_ROWS);
    const nx = (ax / (PIXEL_COLS - 1) - 0.5) * 2;
    const ny = (ay / (PIXEL_ROWS - 1) - 0.5) * 2;
    if (Math.sqrt(nx * nx + ny * ny) < 0.55) continue;
    ctx.fillStyle = k % 2 ? "rgba(216,186,255,0.5)" : "rgba(126,98,182,0.45)";
    ctx.fillRect(ax, ay, 1, 1);
  }
}

const polygonOf = (quad: Quad) =>
  `polygon(${quad.pts.map((p) => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(",")})`;

interface FrameStackProps {
  variant: FrameVariant;
  seed: number;
  children: ReactNode;
}

/**
 * One measured surface: the frame layers and the content that sits on them.
 *
 * Each face measures itself rather than inheriting the other's measurement: the card's height is
 * text-driven, so a frame cut once would be cut for a size the card no longer has. The two faces no
 * longer end up different heights — the stylesheet fills the back's stack to the front's box, so the
 * card keeps one size through the flip — but a back whose content genuinely needs more room still
 * grows the card, which is why the measurement stays per face. Both faces use the same seed, so the
 * two cuts are the same card.
 */
const FrameStack = ({ variant, seed, children }: FrameStackProps) => {
  const stackRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frame, setFrame] = useState<{ quad: Quad; keyline: Quad | null } | null>(null);

  useLayoutEffect(() => {
    const el = stackRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;

      const quad = buildQuad(w, h, variant.pad, seed);
      // The hairline is its own cut, inset 10px by the stylesheet, so its quad is built for the
      // smaller box. Same seed family so the two cuts lean the same way.
      const keyline =
        variant.keyline === "none"
          ? null
          : buildQuad(
              Math.max(40, w - 20),
              Math.max(40, h - 20),
              [
                Math.max(2, Math.round(variant.pad[0] * 0.8)),
                Math.max(2, Math.round(variant.pad[1] * 0.8)),
              ],
              seed + 3
            );

      setFrame({ quad, keyline });
    };

    measure();

    // The card's height is text-driven and changes after mount, when a face's content changes, and
    // when the font lands. A frame measured once would be cut for a size the card no longer has.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [variant, seed]);

  useLayoutEffect(() => {
    if (canvasRef.current) paintPixelBackground(canvasRef.current);
  }, []);

  const segments = useMemo(
    () => (frame ? neonSegments(frame.quad.pts, seed) : []),
    [frame, seed]
  );
  const clip = frame ? polygonOf(frame.quad) : undefined;

  return (
    <div className="stack" ref={stackRef}>
      {/* Misregister: the two plates the card was printed off, one red, one pink, each turned a
          little further than the frame. The bloom on the first is what lifts the card off the
          backdrop. */}
      <div
        className="mis-a mis-plate"
        style={{
          clipPath: clip,
          background: "var(--a)",
          boxShadow: "0 0 36px -8px var(--a)",
          transform: "rotate(1.7deg) translate(7px,8px)",
        }}
      />
      <div
        className="mis-b mis-plate"
        style={{
          clipPath: clip,
          background: "var(--d, var(--b))",
          transform: "rotate(-1.2deg) translate(14px,16px)",
        }}
      />
      <div className="inkfr" style={{ clipPath: clip }} />
      <canvas
        className="pixbg"
        ref={canvasRef}
        width={PIXEL_COLS}
        height={PIXEL_ROWS}
        style={{ clipPath: clip }}
      />
      <div className="grit" />

      {/* Ink sits on top of the pixels, never under them. */}
      {INK_DRIPS[variant.ink].map(([left, width, height]) => (
        <div
          key={`drip-${left}`}
          className="drip"
          style={{
            left,
            bottom: -height,
            width,
            height,
            transform: `rotate(${(left % 7) - 3}deg)`,
          }}
        />
      ))}
      {INK_TAPE[variant.tape].map(([left, top, rotation]) => (
        <div
          key={`tape-${left}`}
          className="tape"
          style={{ left, top, transform: `rotate(${rotation}deg)` }}
        />
      ))}
      {variant.bracket && (
        <>
          <div className="brk" style={{ left: -8, top: -8, borderRight: "none", borderBottom: "none" }} />
          <div className="brk" style={{ right: -8, top: -8, borderLeft: "none", borderBottom: "none" }} />
          <div className="brk" style={{ left: -8, bottom: -8, borderRight: "none", borderTop: "none" }} />
          <div className="brk" style={{ right: -8, bottom: -8, borderLeft: "none", borderTop: "none" }} />
        </>
      )}
      {variant.ink !== "none" && (
        <div
          className="scrib"
          style={{ left: 24, top: 74, width: 120, transform: "rotate(-3deg) skewX(-30deg)" }}
        />
      )}

      {frame?.keyline && <div className="keyline" style={{ clipPath: polygonOf(frame.keyline) }} />}

      {segments.length > 0 && (
        <svg className="neonwrap" preserveAspectRatio="none" aria-hidden="true">
          {segments.map((segment, i) => (
            <path
              key={i}
              className={segment.flicker ? "n-flick" : undefined}
              d={`M${segment.x1.toFixed(1)} ${segment.y1.toFixed(1)}L${segment.x2.toFixed(1)} ${segment.y2.toFixed(1)}`}
              fill="none"
              stroke={segment.colour}
              strokeWidth={segment.width}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              filter="url(#roast-neon)"
            />
          ))}
        </svg>
      )}

      <div className="content">{children}</div>
    </div>
  );
};

/**
 * The two filters the frame layers reference by id. Declared once per card: ids are document-wide, and
 * one card is mounted at a time, so one copy is all a document needs.
 */
const FrameFilters = () => (
  <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
    <defs>
      {/* The rough edge: turbulence displacing the ink frame's own rectangle. */}
      <filter id="roast-rough">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.021 0.034"
          numOctaves="3"
          seed="7"
          result="n"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="n"
          scale="7"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
      {/*
        The sticker border.
        `feMorphology` DILATES the artwork's alpha — every part of the ink grows outward by the same
        radius, so the border has one width everywhere and follows the drawing's real contour. A
        scaled-up copy cannot do this: scaling displaces every stroke away from the centre, so the
        internal lines get a halo too and a line drawing turns into a white ghost. Measured on
        Espresso Martini, the copy landed at 1.46x — an absolutely positioned element resolves
        against the padding box while the in-flow artwork resolves against the content box — and the
        drink lost its outline to the white behind it.
        The filter region is opened to 160% so the border can paint OUTSIDE the artwork's box, which
        is what lets the sticker run over the panel's ring.
      */}
      <filter id="roast-sticker" x="-30%" y="-30%" width="160%" height="160%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="fat" />
        <feFlood floodColor="#fff" result="white" />
        <feComposite in="white" in2="fat" operator="in" result="sticker" />
        <feMerge>
          <feMergeNode in="sticker" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* The tube's glow: three passes of blur under the stroke, not one. */}
      <filter id="roast-neon" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
);

/** The number plus the 15-block bar. Both faces carry it, so it is one component, not two copies. */
const ProgressReadout = ({ index, total, votes, side }: { index: number; total: number; votes: (RoastSide | null)[]; side: RoastSide | null }) => {
  const position = index + 1;
  return (
    <span className="prog">
      {/*
       * The bar first, the number at the card's edge.
       *
       * The number used to sit mid-row and the author's read was that a count in the middle of a
       * row reads as something off-centre rather than as a count. Against the edge it stops
       * competing with the bar for the middle.
       */}
      <span className="hp" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i
            key={i}
            className={`${i < position ? "on " : ""}${
              // The block under the visitor's own finger takes the live vote, not the recorded one:
              // the vote is only stored when they advance, and a counter that waits for the next
              // card to acknowledge a press reads as a counter that missed it.
              (i === index ? (side ?? votes[i]) : votes[i]) === "likes"
                ? "ag "
                : (i === index ? (side ?? votes[i]) : votes[i]) === "yikes"
                  ? "dg "
                  : ""
            }${i % 3 === 0 ? "hi" : i % 3 === 1 ? "md" : "lo"}`}
          />
        ))}
      </span>
      <span className="pnum">{`${String(position).padStart(2, "0")} / ${total}`}</span>
    </span>
  );
};

/**
 * The sticker sheet on the level chips.
 *
 * The first pass tiled a background image, and the author's read was that the direction was right and
 * the execution was not: the stickers came out as fat filled shapes on a perfect grid, at a density
 * that made level 1 look like level 2. Three things follow from that.
 *
 * They are drawn as ELEMENTS, not as a repeated background, because a sticker sheet is placed by hand:
 * each one gets its own position, rotation and size, scattered by a seeded generator so the layout is
 * varied but never different between two renders. Nothing lines up.
 *
 * They are OUTLINES — a hairline cross and a hairline star, `fill="none"` — so they read as marks
 * rather than as badges, and the label stays the loudest thing in the chip.
 *
 * And the count is the author's own: three at level 1 (his words: "one to three"), seven at level 2,
 * and at level 3 enough that the chip's own frame is hard to see behind them.
 */
const STICKER_COUNT: Record<1 | 2 | 3, number> = { 1: 3, 2: 7, 3: 14 };

/** A five-point star outline, centred in a 12x12 box. `fill="none"` is what keeps it a line. */
const STAR_PATH =
  "M6 1.4 L7.2 4.3 L10.4 4.6 L8 6.7 L8.7 9.7 L6 8.1 L3.3 9.7 L4 6.7 L1.6 4.6 L4.8 4.3 Z";
const CROSS_PATH = "M3 3 L9 9 M9 3 L3 9";

/** FNV-1a, so a chip's scatter is a pure function of its id and cannot drift between renders. */
function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const StickerSheet = ({
  side,
  degree,
  seed,
}: {
  side: RoastSide;
  degree: 1 | 2 | 3;
  seed: number;
}) => {
  const rand = mulberry32(seed);
  const places = Array.from({ length: STICKER_COUNT[degree] }, () => ({
    left: 9 + rand() * 82,
    top: 10 + rand() * 80,
    rot: -48 + rand() * 96,
    scale: 0.78 + rand() * 0.5,
  }));

  return (
    <span className="sheet" aria-hidden="true">
      {places.map((place, i) => (
        <svg
          key={i}
          className="stk"
          viewBox="0 0 12 12"
          style={{
            left: `${place.left.toFixed(1)}%`,
            top: `${place.top.toFixed(1)}%`,
            transform: `translate(-50%, -50%) rotate(${place.rot.toFixed(1)}deg) scale(${place.scale.toFixed(2)})`,
          }}
        >
          <path
            d={side === "likes" ? STAR_PATH : CROSS_PATH}
            fill="none"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
};

const RoastSpecCard = ({
  spec,
  index,
  total,
  side,
  votes,
  selected,
  onVote,
  onToggleNote,
  onSkip,
  onNext,
  palette = "heat",
  frame = "neon",
}: RoastSpecCardProps) => {
  const variant = FRAME_VARIANTS[frame];
  // Each spec is cut differently, so the deck reads as fifteen cards rather than one frame fifteen
  // times. Derived from the position, so it costs no state and cannot drift between renders.
  const seed = index + 1;
  // The chips are the data; this sentence is presentation, and it is derived rather than stored.
  const phrase = side ? phraseFor(side, selected) : "";

  return (
    <div className="deck" data-palette={palette}>
      <FrameFilters />
      <div className="persp">
        <div className={side ? "inner flip" : "inner"}>
          {/* ── front: the spec ────────────────────────────────────────── */}
          <div className="face front">
            <FrameStack variant={variant} seed={seed}>
              <div className="cardtop">
                <span className="kick">{ROAST_LIST_AUTHOR}</span>
                <ProgressReadout index={index} total={total} votes={votes} side={side} />
              </div>


              <div className="titlebox glass">
                <div className="name">{spec.name}</div>
                <div className="nline" />
              </div>

              {/*
               * THE DRINK ITSELF.
               *
               * `cocktailArt` is keyed by the file name, and this deck's spec ids follow the Census slug
               * convention on purpose — 14 of the 15 exist in the Census already, so their illustrations were
               * already drawn and this is the whole of the wiring. Lion's Tail is the fifteenth and the only
               * one that needed a new file.
               *
               * The illustration is of the DRINK, not of this spec, and the two can disagree: the card states
               * its own glass and garnish a few lines below. That is a deliberate trade — the art is the
               * compositor's rendition and the card's text is the author's claim, and seeing both is closer to
               * the point of the deck than hiding one.
               *
               * `alt` is empty because the card already names the drink; the picture is not the label.
               */}
              <div className="art glass">
                {/* One element: the sticker border is a filter on the artwork, not a second copy. */}
                <img src={cocktailArt(spec.id)} alt="" />
              </div>

              <div className="rule" />

              <div className="textbox glass">
                {spec.ingredients.map((ingredient) => (
                  <div className="ing" key={`${ingredient.name}-${ingredient.amount}`}>
                    <b>{ingredient.name}</b>
                    <span>{ingredient.amount}</span>
                  </div>
                ))}

                <div className="rule" />
                <div className="kv">
                  <i>GLASS</i>
                  <b>{spec.glass}</b>
                </div>
                <div className="kv">
                  <i>GARNISH</i>
                  <b>{spec.garnish}</b>
                </div>
                <div className="rule" />
                <div className="method">{spec.method}</div>
              </div>

              <div className="btnrow">
                <button type="button" className="vbtn b1" onClick={() => onVote("yikes")}>
                  Yikes ✗
                </button>
                <button type="button" className="vbtn b2" onClick={() => onVote("likes")}>
                  Likes ✓
                </button>
              </div>

              {/* A link, not a third button: "no opinion" is not an answer, and a visual peer of
                  the two votes would read as one. */}
              <button type="button" className="skip" onClick={onSkip}>
                skip
              </button>
            </FrameStack>
          </div>

          {/* ── back: the notes ────────────────────────────────────────── */}
          <div className="face back">
            <FrameStack variant={variant} seed={seed}>
              <div className="cardtop">
                <span className="kick">Verdict</span>
                <ProgressReadout index={index} total={total} votes={votes} side={side} />
              </div>

              <div className="markrow">
                <div className={`mark ${side === "likes" ? "m-ag" : "m-dg"}`} aria-hidden="true">
                  {side === "likes" ? "✓" : "✗"}
                </div>
                <div>
                  <div className={`markword ${side === "likes" ? "mw-likes" : "mw-yikes"}`}>{side === "likes" ? "Likes" : "Yikes"}</div>
                </div>
              </div>

              <div className="rule" />

              {/* The chips are rendered per side because the level words are side-specific by
                  design: "meh" and "fresh" are not two ends of one scale. */}
              {/* The notes drawer. Rendered only when there IS a side: both faces are always mounted,
                  so an unconditional panel would show an empty glass box on the back before the
                  first vote. */}
              {side && (
                <div className="notesbox glass">
                  {ROAST_AXES.map((axis: RoastAxis) => (
                    <div key={axis}>
                      <div className="axis kick">{AXIS_LABEL[axis]}</div>
                      <div className="chips">
                        {notesFor(side, axis).map((note) => {
                          const on = selected.includes(note.id);
                          const colour = axis === "level" ? "c-a" : "c-b";
                          // Only the level chips carry the sticker sheet: the element chips have no
                          // degree, so there is no density for them to express.
                          const degree = axis === "level" ? note.degree : undefined;
                          const sticker = degree ? ` s-${side} lv-${degree}` : "";
                          return (
                            <button
                              key={note.id}
                              type="button"
                              className={`chip ${colour}${sticker}${on ? " c-on" : ""}`}
                              aria-pressed={on}
                              onClick={() => onToggleNote(note.id)}
                            >
                              {degree ? (
                                <StickerSheet
                                  side={side}
                                  degree={degree}
                                  seed={hashOf(note.id) + index}
                                />
                              ) : null}
                              <span className="lbl">{note.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Rendered only when there is a sentence. An empty chip pair is a legal vote, and an
                  empty dashed box would read as something that failed to load. */}
              {phrase && (
                <div className="phrase">
                  <span>{phrase}</span>
                </div>
              )}

              <button type="button" className="next" onClick={onNext}>
                next
              </button>
            </FrameStack>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoastSpecCard;
