import { Link } from "react-router-dom";
import MartiniMark from "@/components/MartiniMark";
import MenuCard from "@/components/MenuCard";
import PartyAsk from "@/components/PartyAsk";
import type { Room } from "@/data/roomCopy";

/**
 * The room explainer — one layout, four rooms, copy from `data/roomCopy`.
 *
 * WHY ONE COMPONENT FOR FOUR ROOMS:
 *   The four rooms differ in words and in whether they have a door. They do not differ in
 *   shape. Four near-identical page components is the way a heading and its body drift apart
 *   across two files, which this project has already paid for once.
 *
 * THE ORDER IS FIXED AND IT IS THE ARGUMENT:
 *   what it is, why it exists, who it is for, when it is real, then a way in, then a way to
 *   stay in touch. The door comes before the ask because the door is the product and the ask
 *   is a request about the future. Reversing them reads as a funnel before the visitor knows
 *   what they walked into.
 *
 * A ROOM WITH NO DOOR IS NOT A GAP IN THE TEMPLATE. The Recipe Manager has no app to enter
 * and the Compositor's destination is a later build, so neither invents one; the ask is how
 * out of the Recipe Manager, and the demo is how the Compositor explains itself.
 *
 * NO ARRIVAL ANIMATION HERE, and the reason is in MenuCard: a page turn needs two mounted
 * layers, a route change has one, and three attempts have already failed at this.
 */

/** The Compositor's non-interactive demo: real stills, then the three clips that move. */
const CompositorDemo = ({ demo }: { demo: NonNullable<Room["demo"]> }) => (
  <div className="space-y-5">
    <h2 className="font-body text-xs uppercase tracking-widest text-gold">The tool, recorded</h2>

    {/* Stills first. They establish what the tool is before anything moves. */}
    <ul className="grid grid-cols-2 gap-3">
      {demo.frames.map((frame) => (
        <li key={frame.src}>
          <img
            src={frame.src}
            alt={frame.alt}
            loading="lazy"
            decoding="async"
            className="w-full rounded-md border border-gold/15"
          />
        </li>
      ))}
    </ul>

    {/* Then the clips. Capped at half the card width and centred, because a portrait clip at
        full width turns the page into a very tall scroll and stops being a room. */}
    <ul className="space-y-4">
      {demo.clips.map((clip) => (
        <li key={clip.src} className="flex justify-center">
          <img
            src={clip.src}
            alt={clip.alt}
            loading="lazy"
            decoding="async"
            className="w-1/2 max-w-[240px] rounded-md border border-gold/15"
          />
        </li>
      ))}
    </ul>
  </div>
);

const RoomExplainer = ({ room }: { room: Room }) => (
  <div className="relative flex min-h-screen items-start justify-center overflow-x-clip px-6 py-12">
    <div className="grain" />
    <MenuCard className="w-full max-w-md space-y-6">
      <MartiniMark />

      <header className="space-y-3">
        <h1 className="font-display text-3xl font-bold text-gold">{room.title}</h1>
      </header>

      {room.blocks.map((block, index) => (
        <section
          key={block.label}
          /* The Compositor's demo sits after WHY: it is the evidence for the why, so it reads
             as illustration of the argument rather than as an interruption of it. */
          className="space-y-2"
        >
          <h2 className="font-body text-xs uppercase tracking-widest text-gold">{block.label}</h2>
          <p className="font-body text-sm leading-relaxed text-cream">{block.text}</p>

          {room.demo && index === 1 && <CompositorDemo demo={room.demo} />}
        </section>
      ))}

      {room.door && (
        <Link
          to={room.door.to}
          className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-gold px-8 py-3 font-body text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          {room.door.label}
        </Link>
      )}

      <PartyAsk />

      <Link
        to="/"
        className="inline-flex min-h-[44px] items-center font-body text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-gold"
      >
        back to the hub
      </Link>
    </MenuCard>
  </div>
);

export default RoomExplainer;
