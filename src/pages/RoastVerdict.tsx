import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import ExitLink from "@/components/ExitLink";
import { noteById, roastNotes } from "@/data/roastNotes";
import { ROAST_LIST_ID, roastSpecs } from "@/data/roastSpecs";
import { getSessionId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import {
  formatPercent,
  crossLine,
  dedupeCensusVotes,
  fightLine,
  labelCounts,
  ownBucket,
  splitBar,
  tally,
  tallyBySpec,
  topLabel,
  VERDICT_HINT,
} from "@/lib/verdict";
import type { CensusVoteRow, RoastVoteRow, Tally, VoteValue } from "@/lib/verdict";
import "@/roast.css";

/**
 * The verdict — screen 3 of ROAST, and the payoff of the whole game (plan §5).
 *
 * IT READS AND IT DOES NOTHING ELSE. Three selects, no insert, no update, no local storage. A verdict
 * is a report on votes that have already been cast; a screen that could also write would be a second
 * way for a vote to exist, and the deck is the only one.
 *
 * IT IS A LIVE QUERY, NOT A CANNED LINE (plan §2, decision 8). The three reads are:
 *   - the room: every roast vote on this list, which is what the per-spec tally is made of;
 *   - the visitor's own roast votes, which is their rate against the author;
 *   - the visitor's census votes, which is their rate against the classics. Deduplicated by cocktail
 *     (last vote wins) because the table can hold more than one row per session per cocktail.
 * The arithmetic and every sentence are in lib/verdict.ts, which has no imports and is run directly
 * under node. This file is deliberately only: fetch, hand rows to that module, render what it returns.
 *
 * AGGREGATE ONLY. The two rates are compared to each other and never to a per-drink number: there is
 * no per-spec comparison on this screen and there must not be one. The per-spec rows are the room's
 * own split, which is a different statement.
 */

/** The element ids, in the vocabulary's order. verdict.ts cannot import the vocabulary, so it takes
 *  these as an argument — and the order is what breaks a tie in the derived line. */
const ELEMENT_IDS = roastNotes.filter((note) => note.axis === "element").map((note) => note.id);

/** The tally of nothing, for a spec the room has not reached yet. */
const NO_VOTES: Tally = { agree: 0, disagree: 0, total: 0, rate: null };

interface VerdictData {
  /** Every roast vote on the list — the room's, including this visitor's. */
  room: RoastVoteRow[];
  /** This visitor's roast votes. */
  mine: RoastVoteRow[];
  /** This visitor's census votes, in write order. */
  classics: CensusVoteRow[];
}

type LoadState =
  | { status: "offline" }
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; data: VerdictData };

/**
 * `vote` is checked rather than trusted. The table's CHECK constraint is the real gate, but this is a
 * system boundary and a row that is neither of the two values (a hand-edited table, a value added
 * later) must not be counted as an agreement.
 */
const asVote = (value: unknown): VoteValue | null =>
  value === "agree" || value === "disagree" ? value : null;

const asRoastRows = (data: unknown): RoastVoteRow[] => {
  if (!Array.isArray(data)) return [];
  const rows: RoastVoteRow[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    const vote = asVote(raw.vote);
    if (!vote) continue;
    rows.push({
      session_id: String(raw.session_id ?? ""),
      spec_ref: String(raw.spec_ref ?? ""),
      vote,
      labels: Array.isArray(raw.labels) ? raw.labels.map(String) : [],
    });
  }
  return rows;
};

const asCensusRows = (data: unknown): CensusVoteRow[] => {
  if (!Array.isArray(data)) return [];
  const rows: CensusVoteRow[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    const vote = asVote(raw.vote);
    if (!vote) continue;
    rows.push({ cocktail_id: String(raw.cocktail_id ?? ""), vote });
  }
  return rows;
};

/** One rate, its label and its sample size. The sample is not decoration: a percentage alone cannot
 *  be read, and this screen is read at a bar. */
const TallyCard = ({ label, tally: t, unit }: { label: string; tally: Tally; unit: string }) => (
  <div className="vd-tally">
    <span className="kick">{label}</span>
    <span className="vd-pct">{formatPercent(t.rate)}</span>
    <span className="vd-sample">
      {t.total === 0 ? "nothing voted yet" : `${t.agree} of ${t.total} ${unit}`}
    </span>
  </div>
);

/**
 * The segmented bar, on the deck's healthbar block treatment. The counts are printed beside it as
 * text: the bar is the glance, the numbers are the record, and the bar is aria-hidden for exactly
 * that reason.
 */
const SplitBlocks = ({ tally: t }: { tally: Tally | null }) => {
  const bar = splitBar(t ?? NO_VOTES);
  return (
    <div className="hp vd-hp" aria-hidden="true">
      {Array.from({ length: bar.blocks }, (_, i) => {
        const height = i % 3 === 0 ? "hi" : i % 3 === 1 ? "md" : "lo";
        if (i < bar.agree) return <i key={i} className={`on ag ${height}`} />;
        if (i < bar.agree + bar.disagree) return <i key={i} className={`on dg ${height}`} />;
        return <i key={i} className={height} />;
      })}
    </div>
  );
};

/** One spec of the deck, in deck order. No votes reads as waiting, never as a zero. */
const SpecRow = ({ name, t }: { name: string; t: Tally | null }) => (
  <li className="vd-spec">
    <div className="vd-specname">
      <b>{name}</b>
      {t ? (
        <span className="vd-count">{`${t.agree} agree · ${t.disagree} disagree`}</span>
      ) : (
        <span className="vd-wait">waiting</span>
      )}
    </div>
    <SplitBlocks tally={t} />
  </li>
);

/**
 * The way onward, rendered in every state — including the two that cannot show a verdict. A visitor
 * who arrives while the database is unreachable must still be able to leave the room.
 *
 * "Now do the classics." is the author's own copy for the Census door (plan §5).
 *
 * The beta door used to be a placeholder pointing at /soon/beta, on the reasoning that the
 * ask form is phase 4 and did not exist yet. It does now, and /soon/:room is gone, so that
 * link would have landed on no route at all. It points at the Recipe Manager room, which is
 * where the ask actually is, and its label stops claiming the ask is closed: the beta is not
 * open, but the ask is, and "ask for the beta" says exactly that without over-claiming.
 */
const exits = (
  <div className="vd-exits">
    <Link to="/census" className="vd-cta">
      Now do the classics.
    </Link>
    <Link to="/room/recipe-manager" className="vd-beta">
      ask for the beta
    </Link>
  </div>
);

const RoastVerdict = () => {
  const [state, setState] = useState<LoadState>(() =>
    supabase ? { status: "loading" } : { status: "offline" }
  );

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let cancelled = false;

    const load = async () => {
      try {
        const sessionId = getSessionId();

        const [room, mine, census] = await Promise.all([
          client
            .from("roast_votes")
            .select("session_id,spec_ref,vote,labels")
            .eq("list_id", ROAST_LIST_ID),
          client
            .from("roast_votes")
            .select("session_id,spec_ref,vote,labels")
            .eq("session_id", sessionId),
          // Ordered by timestamp even though it is not selected, because the dedupe below is
          // "last vote wins" and without an order "last" would mean the order the server happened to
          // return, which is not a defined thing.
          client
            .from("votes")
            .select("cocktail_id,vote")
            .eq("session_id", sessionId)
            .order("timestamp", { ascending: true }),
        ]);

        const failure = room.error ?? mine.error ?? census.error;
        if (failure) throw failure;
        if (cancelled) return;

        setState({
          status: "ready",
          data: {
            room: asRoastRows(room.data),
            mine: asRoastRows(mine.data),
            classics: asCensusRows(census.data),
          },
        });
      } catch (err) {
        // One verdict, one query set: a partial read would render two rates that were taken at
        // different moments, or a room tally missing rows it should have counted. All or nothing is
        // the honest answer here, and the failure state still offers both doors.
        console.warn("[roast] the tally did not answer, so there is no verdict to read", err);
        if (!cancelled) setState({ status: "failed" });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * AT CONFERENCE VOLUME THIS AGGREGATES IN THE CLIENT, deliberately. `roast_votes` holds one row per
   * card advanced, so a busy day is a few hundred rows on one list — small enough that grouping them
   * in the browser costs nothing and avoids an aggregate view that would have to be dropped and
   * recreated every time a rate is defined.
   *
   * AT SCALE THIS WANTS A VIEW OR AN RPC. Past roughly a hundred thousand rows the whole table would
   * cross the wire to compute six numbers, and the honest fix is a `roast_tally` view (grouped by
   * list_id and spec_ref) or one RPC returning the per-spec counts and the label histogram. The
   * surrounding shapes — the tallies, the buckets, the copy — do not change when that arrives.
   */
  const shell = (children: ReactNode) => (
    <div className="roast vd">
      <div className="vd-wrap">
        <span className="kick">Roast · the review</span>
        <h1 className="vd-title">The verdict</h1>
      {/*
        The emergency exit, in the header rather than with the doors below. The two forward
        doors belong at the end of the page — you read the result, then you choose where to go —
        but an escape hatch that only appears after scrolling a fifteen-row tally is not an
        escape hatch. This leaves the doors where they are and puts the way out where it is
        already on screen.
      */}
      <div className="mb-2">
        <ExitLink where="menu" />
      </div>
        {children}
        {exits}
      </div>
    </div>
  );

  if (state.status === "offline") {
    return shell(
      <p className="vd-state">
        No tally connected. This screen is a read of the room's votes, and with no database client
        there is nothing to read. The roast still works — the deck just writes nothing.
      </p>
    );
  }

  if (state.status === "loading") {
    return shell(<p className="vd-state">Reading the room…</p>);
  }

  if (state.status === "failed") {
    return shell(
      <p className="vd-state">
        The tally didn't answer. It is one read, so it is worth a reload in a minute.
      </p>
    );
  }

  const { room, mine: myRows, classics: classicRows } = state.data;

  const myTally = tally(myRows);
  const classicsTally = tally(dedupeCensusVotes(classicRows));
  const bucket = ownBucket(myTally);
  const comparison = crossLine({ own: myTally, classics: classicsTally });

  const bySpec = tallyBySpec(room);
  const disagreeLabels = labelCounts(room.filter((r) => r.vote === "disagree"));
  const top = topLabel(disagreeLabels, ELEMENT_IDS);
  const fight = fightLine(top ? (noteById(top.id)?.text ?? null) : null);

  return shell(
    <>
      {/*
        TWO READINGS ON ONE PAGE (decided 2026-10-05). This screen used to be the place the deck
        ENDED — a terminus. It is now a destination: reachable from the menu and from the round
        boundary, at any point in a session. So it has to answer two different questions, because the
        moment you submit you are both a Roaster and a Contender, and an adaptive page would hide your
        own Submission the moment you had one — which is backwards.

        The two shapes were already being rendered here: `TallyCard` and `SplitBlocks` carry both
        readings. This is a split, not a new screen.
      */}
      <h2 className="vd-sub">Your record, as a Roaster</h2>
      <p className="vd-line">{bucket.text}</p>

      <div className="vd-tallies">
        <TallyCard label="you vs the classics" tally={classicsTally} unit="classics" />
        <TallyCard label="you vs the author" tally={myTally} unit="specs" />
      </div>
      <p className="vd-hint">{VERDICT_HINT}</p>

      {/* Absent only when the visitor rated nothing at all — see crossLine. Silence beats a branch
          invented to fill the gap. */}
      {comparison && (
        <p className="vd-cross">
          <span>{comparison.text}</span>
        </p>
      )}

      <h2 className="vd-sub">The room, spec by spec</h2>
      {fight && <p className="vd-fight">{fight}</p>}
      <ul className="vd-specs">
        {roastSpecs.map((spec) => (
          <SpecRow key={spec.id} name={spec.name} t={bySpec.get(spec.id)?.tally ?? null} />
        ))}
      </ul>

      {/*
        THE CONTENDER READING — and the empty state is the real design work, not an afterthought.
        A visitor who has submitted nothing is the FIRST-RUN case, and the menu's gate sends a
        first-run Session to the ask rather than here. So this is only ever seen by someone who has
        roasted but not yet submitted — which is every visitor until 5c ships the editor. It says what
        will fill it and how, and it does not dress itself up as a result.
      */}
      <h2 className="vd-sub">Your Submission</h2>
      <p className="vd-empty">
        Nothing submitted yet. When you write your own specs and send them to the arena, the room's
        answer lands here — who agreed, who didn't, and on which of them.
      </p>
    </>
  );
};

export default RoastVerdict;
