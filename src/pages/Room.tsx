import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import RoomExplainer from "@/components/RoomExplainer";
import MartiniMark from "@/components/MartiniMark";
import MenuCard from "@/components/MenuCard";
import { roomById } from "@/data/roomCopy";

/**
 * The room route — /room/:room.
 *
 * WHY ONE ROUTE AND NOT FOUR: the four explainers share a component and a shape, so four
 * route entries would be four places to change the same page. The room comes out of the URL
 * and the copy comes out of the data, exactly the way ComingSoon read its own name out of
 * the URL before it.
 *
 * WHY A ROOM THAT DOES NOT EXIST IS ITS OWN PAGE: an unknown id gets an honest answer that
 * says so and offers the hub, rather than a blank card or a crash. It is the one case where
 * saying "no such room" out loud is better than quietly rendering something.
 */
const Room = () => {
  const { room } = useParams<{ room: string }>();
  const found = roomById(room);

  if (!found) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-x-clip px-6 py-12">
        <div className="grain" />
        <MenuCard className="w-full max-w-md space-y-4 text-center">
          <MartiniMark />
          <h1 className="font-display text-3xl font-bold text-gold">No such room</h1>
          <p className="font-body text-sm leading-relaxed text-muted-foreground">
            Nothing lives at that address. The lounge has the four that do.
          </p>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center font-body text-xs uppercase tracking-widest text-gold transition-colors hover:text-gold-light"
          >
            back to the hub
          </Link>
        </MenuCard>
      </div>
    );
  }

  return <RoomExplainer room={found} />;
};

export default Room;
