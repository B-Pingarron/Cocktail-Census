import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import ExitLink from "@/components/ExitLink";
import FeedbackDoor from "@/components/FeedbackDoor";
import { noteById, roastNotes } from "@/data/roastNotes";
import { ROAST_LIST_ID, roastSpecs } from "@/data/roastSpecs";
import { getSessionId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { SPECS_PER_ROUND, roundCount } from "@/lib/rounds";
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
import "@/roast-review.css";

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
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE WIRING PASS (2026-10-12) replaced the `.vd-*` block of roast.css with this room's own
 * vocabulary in "@/roast-review.css", which is scoped `.roast.roast-review`. The page is the same
 * page: the same three selects, the same all-or-nothing failure, the same module calls, the same
 * sentences. Three things changed in the LAYERING, and each is one rule to revert:
 *
 *   1. THE TWO RATES LIVE IN ONE PLATE, STACKED. They were side by side; at 360px that is two 158px
 *      plates and the old CSS already needed `min-width: 0` to survive. One full-width plate gives
 *      each rate ~302px, every proportion on the page can share ONE block scale, and the comparison
 *      this page exists to make happens inside one object.
 *   2. THE SPEC LIST IS GROUPED BY THE DECK'S OWN ROUNDS — three groups of five from lib/rounds.ts's
 *      SPECS_PER_ROUND, whose "Round 1 of 3" is the app's own phrasing (`recapLine` opens every
 *      boundary sentence with it). A fifteen-row wall becomes the deck's shape.
 *   3. A WAITING SPEC HAS NO BAR. The module is explicit: "A spec reading 0 / 0 would be a claim the
 *      room has not made." The old block field printed twelve unlit blocks for a spec nobody had
 *      reached, which is exactly that claim. The word takes the count slot now and a dotted rule
 *      holds nothing.
 *
 * The `draft · awaiting approval` chips are NOT decoration: VERDICT_HINT and the four CROSS_LINES
 * branches are marked DRAFT inside the frozen module ("he did not pick a wording for these four
 * branches… and these are the agent's on the same footing"), and a screen that presents an unpicked
 * draft as the design is claiming authority it has not got. NO_CLASSICS_LINE is the author's own, so
 * the no-classics branch carries no chip.
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

/**
 * THE BLOCK FIELD. The app's own healthbar block: 12 blocks, 8px, 2px black border, heights cycling
 * hi/md/lo. That cycle is the deck's low-fi rhythm and is DECORATIVE — it repeats every three whatever
 * the state, so it cannot be misread as data. Position is the load-bearing channel (agreement always
 * left of disagreement), the black seam between the runs survives greyscale, and the counts are
 * printed as text beside every bar. aria-hidden, which is the app's own decision: "the bar is the
 * glance, the numbers are the record, and the bar is aria-hidden for exactly that reason."
 */
const BlockField = ({ tally: t, small }: { tally: Tally | null; small?: boolean }) => {
  const bar = splitBar(t ?? NO_VOTES);
  return (
    <span className={small ? "blk blk--sm" : "blk"} aria-hidden="true">
      {Array.from({ length: bar.blocks }, (_, i) => {
        const height = i % 3 === 0 ? "hi" : i % 3 === 1 ? "md" : "lo";
        if (i < bar.agree) return <i key={i} className={`${height} ag`} />;
        if (i < bar.agree + bar.disagree) return <i key={i} className={`${height} dg`} />;
        return <i key={i} className={height} />;
      })}
    </span>
  );
};

/**
 * One rate, its label and its sample size. The sample is not decoration: a percentage alone cannot be
 * read, and this screen is read at a bar. The percentage is `--txt`, not `--b`, and that is measured
 * rather than budgeted — white on --plate is 15.98:1 in all four palettes, where --b is 4.55:1 in
 * lime. Display type is AA-large either way; white is the better floor.
 */
const RateRow = ({ label, tally: t, unit }: { label: string; tally: Tally; unit: string }) => (
  <div className="rec-row">
    <div className="rec-top">
      <span className="rec-lab">{label}</span>
      <span className="rec-sam">
        {t.total === 0 ? "nothing voted yet" : `${t.agree} of ${t.total} ${unit}`}
      </span>
    </div>
    <div className="rec-mid">
      <span className="rec-pct">{formatPercent(t.rate)}</span>
      <BlockField tally={t} />
    </div>
  </div>
);

/** A provisional mark. Dashed and unfilled: it spends no accent. */
const DraftChip = () => <span className="draft">draft · awaiting approval</span>;

/**
 * THE ONE MECHANICALLY DERIVED LINE, with its label bolded. The SENTENCE is the frozen module's own —
 * the prefix is measured off `fightLine`'s output rather than retyped here, so lib/verdict.ts stays
 * the single source of that wording and this component cannot drift from it.
 */
const FightLine = ({ label, line }: { label: string; line: string }) => {
  const at = line.indexOf(label);
  if (at < 0) return <p className="fight">{line}</p>;
  return (
    <p className="fight">
      {line.slice(0, at)}
      <b>{label}</b>
    </p>
  );
};

/** One spec of the deck. No votes reads as waiting, never as a zero, and draws no bar. */
const SpecRow = ({ name, t }: { name: string; t: Tally | null }) => (
  <li className={t ? "row" : "row row--wait"}>
    <div className="row-top">
      <span className="row-name">{name}</span>
      <span className="row-count">
        {t ? `${t.agree} agree · ${t.disagree} disagree` : "waiting"}
      </span>
    </div>
    {t ? (
      <BlockField tally={t} small />
    ) : (
      <div className="row-wait">
        <span className="fill" />
      </div>
    )}
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
  <div className="exits">
    <Link to="/census" className="cta">
      Now do the classics.
    </Link>
    <Link to="/room/recipe-manager" className="beta">
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
    <div className="roast roast-review">
      <div className="col">
        <ExitLink where="menu" className="exit" />
        {/* THE FEEDBACK DOOR, beside the law-8 exit at the top of the column — and inside `shell`,
            so it is present in every state, including the two that cannot show a verdict. The
            review room's `.exit` patch is the rule it wears: same object as the exit beside it. */}
        <FeedbackDoor where="roast-review" className="exit" />
        <span className="kick">Roast · the review</span>
        <h1 className="title">The verdict</h1>
        {children}
        {exits}
      </div>
    </div>
  );

  if (state.status === "offline") {
    return shell(
      <div className="rp state">
        <p>
          No tally connected. This screen is a read of the room's votes, and with no database client
          there is nothing to read. The roast still works — the deck just writes nothing.
        </p>
      </div>
    );
  }

  if (state.status === "loading") {
    return shell(
      <div className="rp state">
        <p>Reading the room…</p>
        {/* The one animated element on the page, and the only thing the reduced-motion branch has to
            reach. It is a real pending read, not decoration. */}
        <span className="sweep" aria-hidden="true">
          <i />
        </span>
      </div>
    );
  }

  if (state.status === "failed") {
    return shell(
      <div className="rp state">
        <p>The tally didn't answer. It is one read, so it is worth a reload in a minute.</p>
      </div>
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
  const fightLabel = top ? (noteById(top.id)?.text ?? null) : null;
  const fight = fightLine(fightLabel);

  /* The deck's own shape: rounds of SPECS_PER_ROUND, from lib/rounds.ts. Both ends clamped, so a
     short deck cannot produce an inverted range. */
  const per = SPECS_PER_ROUND;
  const rounds = roundCount(roastSpecs.length, per);

  return shell(
    <>
      {/*
        TWO READINGS ON ONE PAGE (decided 2026-10-05). This screen used to be the place the deck
        ENDED — a terminus. It is now a destination: reachable from the menu and from the round
        boundary, at any point in a session. So it has to answer two different questions, because the
        moment you submit you are both a Roaster and a Contender, and an adaptive page would hide your
        own Submission the moment you had one — which is backwards.

        The two shapes were already being rendered here. This is a split, not a new screen.
      */}
      <h2 className="sub">Your record, as a Roaster</h2>

      {/* THE VERDICT PATCH — the author's line about the visitor, given the weight of an answer. Its
          fill is --plate on a --plate ground, so the only thing drawing it is the paper ring. */}
      <div className="rp verdict">
        <p>{bucket.text}</p>
      </div>

      {/* THE RECORD — both rates in one plate, stacked, then the hint, then the cross line. The
          comparison the page exists to make happens inside one object. */}
      <div className="rp record">
        <RateRow label="you vs the author" tally={myTally} unit="specs" />
        <div className="rule" />
        <RateRow label="you vs the classics" tally={classicsTally} unit="classics" />
        <div className="rec-cap">
          <p className="rec-hint">{VERDICT_HINT}</p>
          <DraftChip />
          {/* Absent only when the visitor rated nothing at all — see crossLine. Silence beats a
              branch invented to fill the gap. */}
          {comparison && (
            <div className="rec-cross">
              <span>{comparison.text}</span>
            </div>
          )}
          {/* No chip on the no-classics branch: that sentence is the author's own, not a draft. */}
          {comparison && comparison.id !== "no-classics" && <DraftChip />}
        </div>
      </div>

      <h2 className="sub">The room, spec by spec</h2>
      {fight && fightLabel && <FightLine label={fightLabel} line={fight} />}

      {Array.from({ length: rounds }, (_, r) => {
        const from = r * per;
        const to = Math.min(from + per, roastSpecs.length);
        const slice = roastSpecs.slice(from, to);
        const reached = slice.filter((spec) => bySpec.has(spec.id)).length;
        return (
          <div className="rp sheet" key={`round-${r}`}>
            <div className="sheet-head">
              {/* "Round n of m" is the app's own phrasing for this fact — `recapLine` opens every
                  boundary sentence with it — so the group header is the deck's wording. */}
              <span className="kick">{`Round ${r + 1} of ${rounds}`}</span>
              <span className="sheet-n">{`${reached} of ${slice.length} with votes`}</span>
            </div>
            <ul className="rows">
              {slice.map((spec) => (
                <SpecRow key={spec.id} name={spec.name} t={bySpec.get(spec.id)?.tally ?? null} />
              ))}
            </ul>
          </div>
        );
      })}

      {/*
        THE CONTENDER READING — and the empty state is the real design work, not an afterthought.
        A visitor who has submitted nothing is the FIRST-RUN case, and the menu's gate sends a
        first-run Session to the ask rather than here. So this is only ever seen by someone who has
        roasted but not yet submitted — which is every visitor until 5c ships the editor. It says what
        will fill it and how, and it does not dress itself up as a result.
      */}
      <h2 className="sub">Your Submission</h2>
      <div className="rp empty">
        <p>
          Nothing submitted yet. When you write your own specs and send them to the arena, the room's
          answer lands here — who agreed, who didn't, and on which of them.
        </p>
      </div>
    </>
  );
};

export default RoastVerdict;
