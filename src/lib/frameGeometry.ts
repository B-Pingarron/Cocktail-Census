/**
 * Frame geometry — the tilted quad that every layer of the roast card is cut from.
 *
 * ZERO IMPORTS, AND THAT IS LOAD-BEARING. This module runs directly under node
 * (`node src/lib/frameGeometry.ts`) so the card's corner angles can be read off the code that
 * actually draws the card rather than off a copy of it. The roast surface has no test harness on
 * purpose, so this direct run is where its numbers come from.
 *
 * Ported from the v10 visual reference
 * (`.pi/visual-companion/roast-mockup/content/card-starter-10-standalone.html`). The rejection
 * sampling is the whole design, not an implementation detail: a rectangle jittered by a few pixels
 * passes the angle band easily but still *looks* like a rectangle with a mistake in it. A quad is
 * only accepted when its four interior angles live in [83, 95] AND at least one corner is visibly
 * off 90° — that is what makes the frame read as hand-cut. A perfect rectangle is the last resort
 * after 900 failed attempts, and it is worth knowing that the fallback never fires: see
 * `verifyBand`.
 */

export type Vec2 = [number, number];

/** [inside, outside] jitter in px: how far a corner may be pulled in, and how far past the edge. */
export type Pad = [number, number];

/**
 * Every interior angle must land inside this band. Below 83° a corner reads as a fold; above 95°
 * the shape stops reading as a card at all.
 */
export const ANGLE_BAND: Pad = [83, 95];

/** The most a corner may deviate from a right angle before the shape stops reading as a card. */
export const MAX_DEVIATION_DEG = 3;

/**
 * How far a corner must fall short of `MAX_DEVIATION_DEG` to count as hand-cut. The gate is scaled
 * by the largest deviation the card's size can produce, because a 3° corner is impossible to reach
 * on a small surface — the jitter would have to exceed the padding that keeps the frame off the
 * edge. Without the scale a narrow card would fall back to a perfect rectangle every time.
 */
export const GATE_FRACTION = 0.55;

/** Attempts before the perfect rectangle. 900 is the reference's number and it has never been hit. */
export const MAX_ATTEMPTS = 900;

/** How far a jittered corner may sit past the card's own edge, in px. */
export const JITTER_TOLERANCE = 10;

/** How far a corner is clamped outside the box, so the quad never inverts on itself. */
export const EDGE_CLAMP = 4;

/** How far the tube runs past each corner of the quad, in px. The overshoot is the neon's signature. */
export const NEON_OVERSHOOT = 22;

/** The second, inner tube on the top and bottom sides. */
export const INNER_TUBE_OFFSET = 9;

/** The unlit tube stub. Grey literally: it is dead, so it takes no palette colour. */
export const DEAD_COLOUR = "#3d3856";

export interface Quad {
  /** Four corners, clockwise from the top-left. */
  pts: Vec2[];
  /** The four measured interior angles, in the same order as `pts` (corner i is between i-1 and i+1). */
  angles: number[];
  tries: number;
  /** True when 900 attempts failed and the perfect rectangle was used instead. */
  fallback: boolean;
}

export interface NeonSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** A CSS colour. Palette-dependent tubes carry `var(--a)`/`var(--c)`, so one segment list serves
   *  every palette and the palette stays in the stylesheet where the rest of it lives. */
  colour: string;
  width: number;
  /** The one run that flickers. It is the top side's first run, as in the reference. */
  flicker: boolean;
  /** The unlit stub: drawn first, so the lit tubes cross over it. */
  dead: boolean;
}

/**
 * The reference PRNG. Deterministic per seed, which is what makes the frame reproducible: the same
 * seed draws the same card, and the measured angles can be compared across runs.
 */
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The interior angle at `cur`, formed by the segments to `prev` and `next`, in degrees. */
export function interior(prev: Vec2, cur: Vec2, next: Vec2): number {
  const a1 = Math.atan2(prev[1] - cur[1], prev[0] - cur[0]);
  const a2 = Math.atan2(next[1] - cur[1], next[0] - cur[0]);
  let d = Math.abs(a1 - a2);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return (d * 180) / Math.PI;
}

/** The four interior angles of a clockwise quad, one per corner. */
export function anglesOf(p: Vec2[]): number[] {
  return [
    interior(p[3], p[0], p[1]),
    interior(p[0], p[1], p[2]),
    interior(p[1], p[2], p[3]),
    interior(p[2], p[3], p[0]),
  ];
}

/**
 * Rejection-sample a quad inside `w` x `h`.
 *
 * Each corner is jittered independently, then the whole quad is tested: every angle in the band,
 * and at least one corner past the gate. Candidates are kept by their *smallest* deviation, so the
 * winner is the quad where every corner is off — not just one dramatic one — and the loop stops
 * early once such a quad is found.
 *
 * The seed is the only input that varies: same seed and size, same card.
 */
export function buildQuad(w: number, h: number, pad: Pad, seed: number): Quad {
  const rand = mulberry32(seed * 977 + 5);
  const inside = pad[0];
  const outside = Math.min(JITTER_TOLERANCE, pad[1] * 0.6);
  const jitter = () => -outside + rand() * (inside + outside);

  // The largest deviation this card size can produce, and the fraction of it a quad must reach.
  const maxDeviation = (2 * Math.atan(inside / Math.min(w, h)) * 180) / Math.PI;
  const gate = Math.min(MAX_DEVIATION_DEG, maxDeviation * GATE_FRACTION);

  let best: Vec2[] | null = null;
  let bestMin = -1;
  let tries = 0;

  for (let t = 0; t < MAX_ATTEMPTS; t++) {
    tries++;
    const raw: Vec2[] = [
      [jitter(), jitter()],
      [w - jitter(), jitter()],
      [w - jitter(), h - jitter()],
      [jitter(), h - jitter()],
    ];
    const pts = raw.map(([x, y]): Vec2 => [
      Math.max(-EDGE_CLAMP, Math.min(w + EDGE_CLAMP, x)),
      Math.max(-EDGE_CLAMP, Math.min(h + EDGE_CLAMP, y)),
    ]);

    const angles = anglesOf(pts);
    if (!angles.every((a) => a >= ANGLE_BAND[0] && a <= ANGLE_BAND[1])) continue;

    const dev = angles.map((a) => Math.abs(a - 90));
    const mn = Math.min(...dev);
    const mx = Math.max(...dev);
    if (mx < gate) continue;

    if (mn > bestMin) {
      bestMin = mn;
      best = pts;
      if (mn >= gate) break;
    }
  }

  if (best) return { pts: best, angles: anglesOf(best), tries, fallback: false };

  const rect: Vec2[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  return { pts: rect, angles: [90, 90, 90, 90], tries, fallback: true };
}

/**
 * The neon tube, as data rather than as markup.
 *
 * The component renders whatever this returns, which is the point: the geometry can be measured,
 * printed and compared without a DOM, and the tubes stay a list of lines the card can also annotate.
 *
 * Two behaviours come from the reference and are worth naming here because they are invisible in a
 * plain list of segments:
 *   - every side overshoots its corners by `NEON_OVERSHOOT`, so the tube crosses itself at the
 *     corners and reads as one continuous bent tube;
 *   - a side may be broken into 1, 2 or 3 runs with a small gap, so the tube looks repaired.
 * The dead stub sits on the bottom side at 58%–86% of its length.
 */
export function neonSegments(quad: Vec2[], seed: number): NeonSegment[] {
  const rand = mulberry32(seed * 331 + 17);
  const dead: NeonSegment[] = [];
  const live: NeonSegment[] = [];

  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const start: Vec2 = [a[0] - ux * NEON_OVERSHOOT, a[1] - uy * NEON_OVERSHOOT];
    const end: Vec2 = [b[0] + ux * NEON_OVERSHOOT, b[1] + uy * NEON_OVERSHOOT];

    const runs: [Vec2, Vec2][] = [[start, end]];
    // The two rand() calls are ordered exactly as the reference does them: the second is only
    // reached when the first fails, so the sequence stays identical.
    const breaks = rand() < 0.55 ? 1 : rand() < 0.4 ? 2 : 0;
    for (let k = 0; k < breaks; k++) {
      const idx = Math.floor(rand() * runs.length);
      const run = runs.splice(idx, 1)[0];
      const at = 0.15 + rand() * 0.55;
      const gap = 0.03 + rand() * 0.05;
      const sx = run[1][0] - run[0][0];
      const sy = run[1][1] - run[0][1];
      runs.push(
        [run[0], [run[0][0] + sx * at, run[0][1] + sy * at]],
        [[run[0][0] + sx * (at + gap), run[0][1] + sy * (at + gap)], run[1]]
      );
    }

    runs.forEach((run, ri) => {
      live.push({
        x1: run[0][0],
        y1: run[0][1],
        x2: run[1][0],
        y2: run[1][1],
        colour: "var(--a)",
        width: 3,
        flicker: i === 0 && ri === 0,
        dead: false,
      });
    });

    // The inner tube on the top and bottom sides. The reference also dims it to 0.85; the segment
    // shape carries no opacity, and at width 2 in a different colour the difference is invisible.
    if (i === 0 || i === 2) {
      const nx = -uy * INNER_TUBE_OFFSET;
      const ny = ux * INNER_TUBE_OFFSET;
      live.push({
        x1: start[0] + nx,
        y1: start[1] + ny,
        x2: end[0] + nx,
        y2: end[1] + ny,
        colour: "var(--c)",
        width: 2,
        flicker: false,
        dead: false,
      });
    }

    if (i === 2) {
      const stub: Vec2 = [
        start[0] + (end[0] - start[0]) * 0.58,
        start[1] + (end[1] - start[1]) * 0.58,
      ];
      const stubEnd: Vec2 = [
        start[0] + (end[0] - start[0]) * 0.86,
        start[1] + (end[1] - start[1]) * 0.86,
      ];
      dead.push({
        x1: stub[0],
        y1: stub[1],
        x2: stubEnd[0],
        y2: stubEnd[1],
        colour: DEAD_COLOUR,
        width: 3,
        flicker: false,
        dead: true,
      });
    }
  }

  // Dead first: it is the unlit tube, so the lit ones have to cross over it.
  return [...dead, ...live];
}

export type FrameVariantId = "plate" | "neon" | "torn" | "drip" | "brackets";

/**
 * The five frames of the reference. Only `neon` is the deck's default; the other four are the same
 * card with different wear, which is why they are four rows of data instead of four components.
 */
export interface FrameVariant {
  pad: Pad;
  keyline: "single" | "double" | "none";
  ink: "none" | "light" | "heavy";
  /** Strips of tape: 0, 1 or 3 as the reference tapes them. */
  tape: 0 | 1 | 3;
  /** Corner brackets instead of a hairline. */
  bracket: boolean;
}

export const FRAME_VARIANTS: Record<FrameVariantId, FrameVariant> = {
  plate: { pad: [9, 12], keyline: "single", ink: "none", tape: 0, bracket: false },
  neon: { pad: [12, 16], keyline: "single", ink: "light", tape: 1, bracket: false },
  torn: { pad: [18, 22], keyline: "none", ink: "heavy", tape: 1, bracket: false },
  drip: { pad: [14, 18], keyline: "single", ink: "heavy", tape: 1, bracket: false },
  brackets: { pad: [12, 15], keyline: "single", ink: "none", tape: 0, bracket: true },
};

/** A measured card surface: the deck's card is this wide on a phone, and taller than it is wide. */
export interface StackSize {
  width: number;
  height: number;
  pad: Pad;
}

/**
 * The surface `verifyBand` measures by default.
 *
 * The WIDTH is the number that matters and it is the reference card's own: the gate is derived from
 * `min(width, height)`, so on any card taller than it is wide — every phone card — the gate is fixed
 * by the width alone. The height is a representative one; `verifyBand` takes a size, and the height
 * sweep above is the evidence that the answer does not depend on it.
 */
export const REFERENCE_STACK: StackSize = { width: 360, height: 470, pad: FRAME_VARIANTS.neon.pad };

export interface BandSample {
  seed: number;
  angles: number[];
  tries: number;
  fallback: boolean;
  /** Every angle inside ANGLE_BAND. The band is the contract; a fallback fails it. */
  inBand: boolean;
}

/**
 * Measure the frame for a list of seeds at a given card size.
 *
 * This is the module's reason to exist as a standalone file: the angles below are the same geometry
 * the card renders, not a re-derivation of it.
 */
export function verifyBand(seeds: number[], size: StackSize = REFERENCE_STACK): BandSample[] {
  return seeds.map((seed) => {
    const quad = buildQuad(size.width, size.height, size.pad, seed);
    return {
      seed,
      angles: quad.angles,
      tries: quad.tries,
      fallback: quad.fallback,
      inBand: quad.angles.every((a) => a >= ANGLE_BAND[0] && a <= ANGLE_BAND[1]),
    };
  });
}

/**
 * Direct-run detection, without an import.
 *
 * `node:url`'s pathToFileURL would be the obvious way to compare `import.meta.url` with
 * `process.argv[1]`, and importing it would break the zero-import rule that lets this file run at
 * all. Stripping the `file://` scheme and the Windows leading slash is enough for a comparison, and
 * the browser never reaches it: `process` is undefined there, which is also why the standalone block
 * below is inert inside the app bundle.
 */
function isDirectRun(): boolean {
  if (typeof process === "undefined" || !process.argv || process.argv.length < 2) return false;
  const entry = process.argv[1];
  const self = import.meta.url.replace(/^file:\/\//, "").replace(/^\/([A-Za-z]:)/, "$1");
  return decodeURIComponent(self).replace(/\\/g, "/") === entry.replace(/\\/g, "/");
}

if (isDirectRun()) {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const samples = verifyBand(seeds);

  console.log(
    `frame geometry — ${REFERENCE_STACK.width}x${REFERENCE_STACK.height}, ` +
      `pad [${REFERENCE_STACK.pad[0]}, ${REFERENCE_STACK.pad[1]}], band [${ANGLE_BAND[0]}, ${ANGLE_BAND[1]}]`
  );
  console.log("");
  console.log("seed  corner angles (deg, clockwise from top-left)      tries  band  fallback");
  for (const s of samples) {
    const corners = s.angles.map((a) => a.toFixed(1).padStart(6)).join(" ");
    console.log(
      `${String(s.seed).padStart(4)}  ${corners}${String(s.tries).padStart(10)}  ` +
        `${s.inBand ? "ok  " : "FAIL"}  ${s.fallback ? "YES" : "no"}`
    );
  }

  const inBand = samples.filter((s) => s.inBand).length;
  const fallbacks = samples.filter((s) => s.fallback).length;
  const min = Math.min(...samples.flatMap((s) => s.angles));
  const max = Math.max(...samples.flatMap((s) => s.angles));
  console.log("");
  console.log(
    `${inBand}/${samples.length} in band · fallbacks: ${fallbacks} · ` +
      `measured range ${min.toFixed(2)}° – ${max.toFixed(2)}°`
  );
  console.log("");

  // The same seeds across the heights a phone card actually takes. The gate is derived from the
  // width, so this is the evidence that the frame survives a reflow rather than a second opinion.
  const heights = [380, 420, 470, 520, 580, 660, 760];
  console.log("height sweep at width 360:");
  for (const height of heights) {
    const sweep = verifyBand(seeds, { width: 360, height, pad: FRAME_VARIANTS.neon.pad });
    const ok = sweep.filter((s) => s.inBand && !s.fallback).length;
    const lo = Math.min(...sweep.flatMap((s) => s.angles));
    const hi = Math.max(...sweep.flatMap((s) => s.angles));
    console.log(
      `  h=${String(height).padStart(3)}  ${ok}/${sweep.length} ok  range ${lo.toFixed(2)}° – ${hi.toFixed(2)}°`
    );
  }
}
