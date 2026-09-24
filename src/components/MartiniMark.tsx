import coverGlass from "@/assets/cover-martini-glass.svg";
import { cn } from "@/lib/utils";

/**
 * The martini mark that heads every page of the menu.
 *
 * WHY ONE COMPONENT AND NOT AN <img> PER PAGE:
 *   The mark is what makes the hub and the Census read as one product instead of two —
 *   the hard cut between them was the thing that gave the seam away. That only works if
 *   every page carries the same mark at the same size, which means one place to change
 *   it rather than five. The asset it points at is named for its job for the same reason.
 *
 * TWO SIZES, ON PURPOSE:
 *   The default here is the head mark — 40px, a quarter of what the asset was drawn for,
 *   so it reads as the bar's stamp at the top of a page. The cover is the one page that
 *   passes its own size (`w-40`, the full 160px) because there the mark is not a header,
 *   it is the composition. The size lives with the page rather than being baked in here,
 *   because only the page knows which of the two jobs it is doing.
 *
 *   It is a filled drawing rather than a stroked outline, so it survives being small —
 *   thin strokes would disappear first, and at 40px there is no room for them.
 *
 * alt is empty on purpose. The mark is decoration; every page it heads already says what
 * it is in words, and announcing an unnamed glass to a screen reader adds nothing.
 */
const MartiniMark = ({ className }: { className?: string }) => (
  <img src={coverGlass} alt="" className={cn("mx-auto block h-auto w-10", className)} />
);

export default MartiniMark;
