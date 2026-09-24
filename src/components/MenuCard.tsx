import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The menu card surface — the object the whole product is.
 *
 * The hub is a menu card, and the Census is a room inside it, so the cover, the open page, the
 * roast entry, the coming-soon dead end, the Census intro and the learn-more page all read as the
 * same physical object: same 6px corner, same gold hairline at a quarter opacity, same card colour,
 * same padding. Kept as one component rather than the same class string pasted into each screen,
 * because two copies of one artifact is a bug this project has already paid for — the wordmark
 * drifted between two surfaces before it was extracted.
 *
 * WHY THERE IS NO ARRIVAL ANIMATION HERE, AFTER THREE ATTEMPTS AT ONE:
 *   A page turn is a relationship between two sheets — one lifting away, one being revealed. It is
 *   not a property a card can have on its own. Two failed versions of this proved it: a blank sheet
 *   laid over a route change read as a loading screen, and a single card rotating into place read as
 *   the menu closing. Both had exactly one layer, because a route change unmounts the outgoing page
 *   before the new one appears, and one layer can only wobble.
 *
 *   The turn therefore lives where two layers genuinely exist: the hub, where the face being left
 *   and the face being reached are both mounted at once. Route changes get a plain, deliberate cut.
 *   Entering a room is allowed to feel like going somewhere.
 *
 * `ref` is forwarded because the hub holds a ref on the face being revealed — it is marked `inert`
 * while something is still parked on top of it, so a keyboard user cannot tab into a page they
 * cannot see.
 */
const MenuCard = forwardRef<HTMLElement, ComponentPropsWithoutRef<"section">>(
  ({ className, children, ...rest }, ref) => (
    <section
      ref={ref}
      className={cn("rounded-md border border-gold/25 bg-card px-6 py-8", className)}
      {...rest}
    >
      {children}
    </section>
  )
);

MenuCard.displayName = "MenuCard";

export default MenuCard;
