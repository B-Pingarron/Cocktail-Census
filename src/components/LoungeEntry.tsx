import { Link } from "react-router-dom";
import type { HubEntry } from "@/data/hubEntries";
import { cn } from "@/lib/utils";

/**
 * One ruled row on the menu card: the seat, its doors, and the line that sells it.
 *
 * WHY A ROW AND NOT A BOX:
 *   A printed menu is one card with rules between its items, not one card per item. Five identical
 *   bordered boxes in a stack read as five separate products; a rule reads as a list. So the row
 *   owns no background, no border and no radius — the separator is drawn by `divide-y` on the
 *   container in Hub.tsx.
 *
 * WHY THE DOORS SIT ON THEIR OWN LINE:
 *   They do not fit beside the name at 390px, and that is measured rather than guessed. The card is
 *   342px wide with a 292px content box; "Recipe Manager" needs 144.0px on one line, the two
 *   tracked door labels need 159.9px together, and a 16px gap needs another 16 — 319.9px against
 *   292. Putting the doors on the title line wrapped that name to two lines for a 112.4px row, and
 *   a wrapped name is exactly the look being removed. So the doors drop under the blurb,
 *   right-aligned, which keeps the "price column" reading and keeps every row the same shape.
 *
 * WHY THE ROW IS SHORT BUT THE DOORS ARE NOT:
 *   The row is compact because the type is small, the padding is 8px and the separator is a
 *   hairline. The doors are the one thing that cannot shrink: each is a 44px tap target, so the
 *   door line is as tall as the target and the label sits centred inside it.
 *
 * WHY A DOOR CAN BE TAKEN IN PLACE:
 *   Most doors navigate. The Census door does not always: whether it leaves the hub at all depends
 *   on a preference this component has no business knowing about. So a door stays a real <Link> —
 *   still focusable, still middle-clickable, still a URL — and the host is given the chance to take
 *   the click first. Returning true means someone handled it, and the navigation is cancelled.
 *
 * WHY HAND-ROLLED LINKS:
 *   The shared Button (components/ui/button.tsx) has no asChild/Slot support, so it cannot render
 *   as a router Link — wrapping it would put a button inside an anchor and break both the semantics
 *   and the keyboard behaviour. The landing page already hand-rolls its CTA for the same reason.
 */
const LoungeEntry = ({
  entry,
  onDoorActivate,
}: {
  entry: HubEntry;
  /** Return true to take the click and cancel the navigation. */
  onDoorActivate?: (to: string) => boolean;
}) => (
  <article className="py-2">
    <h2 className="font-display text-xl text-cream">{entry.title}</h2>

    <p className="mt-0.5 font-body text-[13px] leading-snug text-muted-foreground">{entry.blurb}</p>

    <div className="flex min-h-[44px] items-center justify-end gap-x-5">
      {entry.doors.map((door) => (
        <Link
          key={`${entry.id}-${door.label}`}
          to={door.to}
          onClick={(event) => {
            if (onDoorActivate?.(door.to)) event.preventDefault();
          }}
          className={cn(
            "inline-flex min-h-[44px] items-center whitespace-nowrap font-body text-[10px] uppercase tracking-widest transition-colors",
            door.primary
              ? "text-gold hover:text-gold-light"
              : "text-muted-foreground hover:text-cream"
          )}
        >
          {door.label}
        </Link>
      ))}
    </div>
  </article>
);

export default LoungeEntry;
