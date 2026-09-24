import { Link, useParams } from "react-router-dom";
import MenuCard from "@/components/MenuCard";
import MartiniMark from "@/components/MartiniMark";

/**
 * Coming soon — the honest dead end for rooms that do not exist yet.
 *
 * The hub's "learn more" doors all point here rather than at a route that 404s or at
 * a fake preview. The room name comes from the URL so one route covers every future
 * room and nothing has to be wired up twice.
 *
 * The line is deliberately first-person and specific: it tells the visitor the room
 * is unfinished and that asking is the fastest way to get it, instead of the usual
 * "sign up to be notified" that promises an email list this project does not have.
 */

/** "recipe-manager" -> "Recipe Manager". Falls back to "This room" for a bare path. */
const titleCase = (value: string) =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const ComingSoon = () => {
  const { room } = useParams<{ room: string }>();
  const name = titleCase(room ?? "") || "This room";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-clip px-6 py-12">
      <div className="grain" />
      <MenuCard className="w-full max-w-md space-y-4 text-center">
        <MartiniMark />
      <h1 className="font-display text-3xl font-bold text-gold">{name}</h1>

      <p className="font-body text-sm leading-relaxed text-muted-foreground">
        {"This one's coming — ask me and I'll show you."}
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
};

export default ComingSoon;
