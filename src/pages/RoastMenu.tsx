import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import MenuCard from "@/components/MenuCard";
import ExitLink from "@/components/ExitLink";
import { getSessionId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import "@/roast.css";

/**
 * The ROAST menu — the room's front door, once the ask has done its job.
 *
 * WHY THE ASK RUNS ONCE AND THIS RUNS AFTERWARDS (decided 2026-10-05):
 *   The ask is the reason a stranger plays at all — "I've been behind the bar thirteen years and these
 *   are the ones I'll defend" is what makes someone hand over five minutes. But it is also the only
 *   thing standing between a first-time visitor and an EMPTY menu: no roster, no record, nothing to
 *   review. So a Session that has never roasted anything is sent to the ask, and a Session that has
 *   comes here. Asking the same person to be impressed twice is worse than redundant — it is the app
 *   forgetting who it is talking to.
 *
 * HOW "HAS ROASTED ANYTHING" IS ANSWERED: one counted read against `roast_votes` for this session.
 *   Not a localStorage flag — the votes are the fact, and a flag beside them is a second source of
 *   truth that can disagree with the table. The cost is a brief check on entry.
 *
 * WHAT HAPPENS WHEN THE READ FAILS, AND WHY IT FAILS TOWARDS THE ASK:
 *   A newcomer at a venue on bad wifi must not land on an empty menu. The ask is always a valid place
 *   to land and re-reading the tutorial costs nothing, so any error — no client, a failed query, a
 *   count of zero — routes to the ask. The safe direction is the one whose worst case is boring.
 *
 * `?dry=1` SKIPS THE CHECK ON PURPOSE: a dry run writes no votes, so the gate would send a tester back
 *   to the ask on every pass and the menu would be unreachable while testing. The flag is honoured
 *   here for the same reason the deck honours it — it is the only way to walk the flow in a browser
 *   without touching the production table.
 *
 * WHAT IS NOT HERE YET, AND WHY IT IS NOT SHOWN GREYED OUT: the roster and the recipe editor arrive
 *   with 5c. Two dead entries would teach a visitor that this menu lies, and a menu that lies once is
 *   one they stop reading. The structure is here; the rooms get added when they exist.
 */

/** The room's entries. Data, not markup — the same move as roomCopy: an entry is an entry. */
const ENTRIES = [
  {
    to: "/roast/deck",
    kicker: "The Arena",
    blurb: "Roast the author's fifteen. Three rounds of five, and you can stop after any one of them.",
  },
  {
    to: "/roast/review",
    kicker: "Review",
    blurb: "Your record so far — what you agreed with, and what the room has said.",
  },
] as const;

type Gate = "checking" | "new" | "returning";

const RoastMenu = () => {
  const [searchParams] = useSearchParams();
  const dry = searchParams.get("dry") === "1";

  // Dry mode starts at "returning" so the menu is reachable; everything else starts by checking.
  const [gate, setGate] = useState<Gate>(dry ? "returning" : "checking");

  useEffect(() => {
    if (dry) return;
    if (!supabase) {
      setGate("new");
      return;
    }

    let cancelled = false;
    supabase
      .from("roast_votes")
      .select("spec_ref", { count: "exact", head: true })
      .eq("session_id", getSessionId())
      .then(({ count, error }) => {
        if (cancelled) return;
        setGate(!error && (count ?? 0) > 0 ? "returning" : "new");
      });

    return () => {
      cancelled = true;
    };
  }, [dry]);

  if (gate === "checking") {
    return (
      <div className="roast flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[360px]">
          <MenuCard>
            <p className="font-body text-sm text-muted-foreground">Opening the room…</p>
          </MenuCard>
        </div>
      </div>
    );
  }

  if (gate === "new") return <Navigate to="/roast/enter" replace />;

  return (
    <div className="roast flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        <div className="flex justify-center pb-2">
          <ExitLink />
        </div>

        <MenuCard>
          <span className="kick">Roast · the room</span>

          <h1 className="font-display text-2xl text-cream">My spec, roasted</h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Your taste against theirs. The classics get a consensus; this gets an argument.
          </p>

          <nav className="mt-6 flex flex-col gap-3">
            {ENTRIES.map((entry) => (
              <Link
                key={entry.to}
                to={dry ? `${entry.to}?dry=1` : entry.to}
                className="block rounded-md border border-gold/25 px-4 py-3 transition-colors hover:border-gold/60 focus-visible:border-gold/60"
              >
                <span className="block font-display text-lg text-cream">{entry.kicker}</span>
                <span className="mt-1 block font-body text-xs text-muted-foreground">
                  {entry.blurb}
                </span>
              </Link>
            ))}
          </nav>
        </MenuCard>
      </div>
    </div>
  );
};

export default RoastMenu;
