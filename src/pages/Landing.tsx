import CensusIntro from "@/components/CensusIntro";
import MenuCard from "@/components/MenuCard";

/**
 * The Census intro, when it is reached directly.
 *
 * This is the same component the hub mounts as a face of its own card. It is a page here rather
 * than only a hub state so that anything already pointing at /census — a bookmark, a QR from an
 * earlier run, the route table in the plan — lands on something that explains itself instead of
 * being dropped straight into the deck.
 *
 * The long version of the explanation is not gone; it is at /census/learn-more, which the second
 * button points at. Everything that used to live on this page still exists, one click further in.
 *
 * No turn when this page arrives: a turn needs two sheets, and a route change only ever has one.
 * That is why the hub's own face changes are animated and this is not — see the note in MenuCard.
 */
const Landing = () => (
  <div className="relative flex min-h-screen items-center justify-center overflow-x-clip px-6 py-12">
    {/* Texture belongs to the room, not to the card — the same backdrop the hub uses, so arriving
        here still feels like the same object. */}
    <div className="grain" />

    <MenuCard className="w-full max-w-md">
      <CensusIntro />
    </MenuCard>
  </div>
);

export default Landing;
