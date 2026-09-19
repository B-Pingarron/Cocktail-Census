import { useEffect, useState } from "react";
import { cocktails } from "@/data/cocktails";
import { supabase } from "@/lib/supabase";

/**
 * The two ranking tables shown once a visitor has voted through every cocktail.
 *
 * This is the app's ONLY read. Everything else is local-first and write-only, which is why
 * this component is built to fail soft: if the query is slow, blocked, or the tally view
 * does not exist yet, the panel renders nothing and the completion screen is unaffected.
 * A results panel is never allowed to cost the visitor their stats.
 */

/** Minimum total votes before a cocktail is eligible for a ranking. */
export const MIN_SAMPLE = 2;

/** Rows shown per table. */
export const TOP_N = 5;

interface TallyRow {
  cocktail_id: string;
  agrees: number;
  disagrees: number;
  total: number;
}

// Cocktail names come from the bundled data, so a ranking row never needs a join.
const NAMES = new Map(cocktails.map((c) => [c.id, c.name]));

const listRow = (label: string, value: number, total: number) => (
  <tr key={label} className="border-t border-gold/10">
    <td className="py-1.5 font-body text-sm text-foreground">{label}</td>
    <td className="py-1.5 text-right font-body text-sm text-gold">
      {value}
      <span className="text-muted-foreground/50"> / {total}</span>
    </td>
  </tr>
);

const CensusResults = () => {
  const [rows, setRows] = useState<TallyRow[] | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await client
          .from("cocktail_tally")
          .select("cocktail_id,agrees,disagrees,total");
        if (error) throw error;
        if (cancelled) return;
        // count(*) is a bigint; coerce so a string-typed value cannot break the sort.
        setRows(
          (data ?? []).map((r) => ({
            cocktail_id: String(r.cocktail_id),
            agrees: Number(r.agrees),
            disagrees: Number(r.disagrees),
            total: Number(r.total),
          }))
        );
      } catch (err) {
        console.warn("[census] tally unavailable, hiding the ranking tables", err);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows || rows.length === 0) return null;

  // Rankings skip two things: cocktails below the sample floor, and ids the generated
  // data no longer knows about. A tally row is only useful if it can be named.
  const eligible = rows.filter((r) => r.total >= MIN_SAMPLE && NAMES.has(r.cocktail_id));
  if (eligible.length === 0) return null;

  const censusSize = rows.reduce((sum, r) => sum + r.total, 0);

  const byAgrees = [...eligible]
    .sort((a, b) => b.agrees - a.agrees || b.total - a.total)
    .slice(0, TOP_N);
  const byDisagrees = [...eligible]
    .sort((a, b) => b.disagrees - a.disagrees || b.total - a.total)
    .slice(0, TOP_N);

  const table = (heading: string, title: string, data: TallyRow[], pick: (r: TallyRow) => number) => (
    <div className="text-left">
      <h3 className="font-body text-xs uppercase tracking-widest text-gold">{heading}</h3>
      <table className="mt-2 w-full border-collapse">
        <caption className="sr-only">{title}</caption>
        <tbody>{data.map((r) => listRow(NAMES.get(r.cocktail_id) ?? r.cocktail_id, pick(r), r.total))}</tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6" data-section="census-results">
      {table("Most agreed with", "Cocktails with the most agreement so far", byAgrees, (r) => r.agrees)}
      {table("Most disagreed with", "Cocktails with the most disagreement so far", byDisagrees, (r) => r.disagrees)}
      <p className="text-xs text-muted-foreground/60">
        Based on {censusSize.toLocaleString()} votes so far. A cocktail needs at least {MIN_SAMPLE} votes
        to appear.
      </p>
    </div>
  );
};

export default CensusResults;
