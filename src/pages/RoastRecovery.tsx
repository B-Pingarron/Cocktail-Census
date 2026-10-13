import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ExitLink from "@/components/ExitLink";
import { getSessionId, setSessionId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { columnsFor, csv, type ExportSpec } from "@/lib/exportCsv";
import { decodeKey, encodeKey, keyAdvice } from "@/lib/recovery";
import "@/roast.css";
import "@/roast-keep.css";

/**
 * Recovery, and the export — TWO DIFFERENT THINGS, which is why they share a screen rather than a
 * mechanism.
 *
 * Section 7b draws the line and it is the whole design of this page:
 *
 *   "Recovery is the SESSION KEY, exported as a saveable string or QR: the data is already server-side,
 *    only the key is lost. The CSV export stays recipes-only."
 *
 * So the two halves do opposite things. RECOVERY restores a CLAIM — the specs never left the database,
 * and pasting a key back is all it takes. The EXPORT takes a COPY — it is for leaving with your work,
 * not for coming back to it. Mixing them would produce a screen that promises one and delivers the
 * other, so they are labelled separately and say what they are for.
 *
 * WHY THE KEY IS SHOWN IN FULL RATHER THAN BEHIND A REVEAL. It is not a password. ADR-035 has no
 * accounts, so there is nothing this string unlocks that its holder was not already given — and hiding
 * it behind a "show" toggle would imply a secrecy the design does not have. It is a KEY in the sense of
 * "the thing that claims your table", and the copy says so in those words.
 *
 * `?dry=1` DOES NOT CHANGE THIS SCREEN: nothing here writes to the database. Recovery writes to
 * localStorage, and the export writes a file. The flag is honoured anyway, so a dry walk of the app
 * stays a dry walk, but the honest statement is that this page has no server writes to skip.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE WIRING PASS (2026-10-12) replaced the Tailwind utilities and the shared <MenuCard> with the
 * room's own vocabulary in "@/roast-keep.css". The page is the same page: `loadForExport`, `copy`,
 * `restore`, `download`, and every one of the app's sentences. What changed is the layering — the
 * frame, the film, the patches, the docked foot — and ONE addition, the generated CSV header row,
 * which is printed from the real `columnsFor()` so the export's "no cap" shape is visible instead
 * of asserted. That row is aria-hidden: it is 204 characters of column names and the count sentence
 * directly above it already carries the fact as a sentence.
 *
 * THE ACTION BAR IS INSIDE THE FRAME, as the plate's docked foot. The study had it as a sibling
 * under the plate; the roster and the editor both dock theirs, and a bar outside the frame reads as
 * a second object under the card rather than as the card's last line. The revert is one element move
 * and is documented in roast-keep.css.
 */

type Loaded = {
  specs: ExportSpec[];
  truncated: boolean;
};

/** Read the author's specs, assembled the way the export needs them. */
async function loadForExport(): Promise<Loaded> {
  if (!supabase) return { specs: [], truncated: false };
  const sessionId = getSessionId();

  const { data: specs } = await supabase
    .from("specs")
    .select("id,name,glass_id,technique_id,notes,ice_id")
    .eq("session_id", sessionId)
    .is("retired_at", null)
    .order("created_at", { ascending: false });

  const rows = specs ?? [];
  if (rows.length === 0) return { specs: [], truncated: false };

  const ids = rows.map((s) => s.id);
  const { data: ings } = await supabase
    .from("spec_ingredients")
    .select("spec_id,position,amount,raw_name,ingredient_id")
    .in("spec_id", ids);
  const { data: garns } = await supabase
    .from("spec_garnishes")
    .select("spec_id,garnish_group,position,element_id")
    .in("spec_id", ids);

  const glassIds = [...new Set(rows.map((s) => s.glass_id).filter(Boolean))] as string[];
  const iceIds = [...new Set(rows.map((s) => s.ice_id).filter(Boolean))] as string[];
  const elementIds = [...new Set((garns ?? []).map((g) => g.element_id))];

  const { data: glasses } = glassIds.length
    ? await supabase.from("glassware").select("id,name").in("id", glassIds)
    : { data: [] as { id: string; name: string }[] };
  const { data: ices } = iceIds.length
    ? await supabase.from("ice").select("id,label").in("id", iceIds)
    : { data: [] as { id: string; label: string }[] };
  const { data: elements } = elementIds.length
    ? await supabase.from("garnish_elements").select("id,name").in("id", elementIds)
    : { data: [] as { id: string; name: string }[] };

  const nameOf = (list: { id: string; name?: string; label?: string }[], id: string | null): string => {
    if (!id) return "";
    const found = list.find((x) => x.id === id);
    return found?.name ?? found?.label ?? "";
  };

  return {
    specs: rows.map((spec) => ({
      name: spec.name,
      glass: nameOf(glasses ?? [], spec.glass_id),
      ice: nameOf(ices ?? [], spec.ice_id),
      method: spec.technique_id ?? "",
      notes: spec.notes ?? "",
      garnish: (garns ?? [])
        .filter((g) => g.spec_id === spec.id)
        .sort((a, b) => a.garnish_group - b.garnish_group || a.position - b.position)
        .map((g) => nameOf(elements ?? [], g.element_id) || g.element_id)
        .join(", "),
      ingredients: (ings ?? [])
        .filter((i) => i.spec_id === spec.id)
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ name: i.raw_name ?? i.ingredient_id, amount: i.amount ?? "" })),
    })),
    truncated: false,
  };
}

const RoastRecovery = () => {
  const dry = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("dry") === "1";
  const sessionId = getSessionId();
  const key = encodeKey(sessionId);

  const [pasted, setPasted] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [copied, setCopied] = useState(false);

  /* The label is the app's own two words; `copied` is what the button reports after the clipboard
     write, and the failure sentence is the app's, not a new one. */

  useEffect(() => {
    loadForExport()
      .then(setLoaded)
      .catch(() => setLoaded({ specs: [], truncated: false }));
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setNote("copied — keep it somewhere you will find it");
    } catch {
      setNote("your browser would not copy it — select the string above and copy it by hand");
    }
  };

  const restore = () => {
    const id = decodeKey(pasted);
    if (!id) {
      setNote("that is not a session key — it should look like barnerd-session:v1:…");
      return;
    }
    if (id === sessionId) {
      setNote("that is the key this device is already using");
      return;
    }
    const ok = setSessionId(id);
    setNote(ok ? "adopted — reloading to your drinks" : "this browser would not store the key");
    if (ok) window.setTimeout(() => window.location.reload(), 600);
  };

  const download = () => {
    if (!loaded || loaded.specs.length === 0) return;
    const text = csv(loaded.specs);
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `barnerd-recipes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNote(`exported ${loaded.specs.length} recipes`);
  };

  /** How wide the generated file is: as wide as the longest recipe, with no cap. */
  const width = loaded ? loaded.specs.reduce((w, s) => Math.max(w, s.ingredients.length), 0) : 0;
  /** The real header row, from the real `columnsFor()`. Not a description of the file — the file. */
  const header = loaded && loaded.specs.length > 0 ? columnsFor(loaded.specs).join(",") : "";

  return (
    <div className="roast roast-keep">
      <div className="col">
        <div className="exitrow">
          <ExitLink where="menu" className="exit" />
        </div>

        <section className="frame" aria-labelledby="keep-title">
          <div className="film" aria-hidden="true" />

          <div className="bar">
            <span className="kick">Roast · your things</span>
            <h1 className="title" id="keep-title">
              <span className="tf-plate big">
                <span className="t triple">Keep your work</span>
              </span>
            </h1>
          </div>

          {/* ── HALF ONE — THE CLAIM. The object is the key, and it is shown in full: the page's
              own comment insists. "It is not a password… hiding it behind a 'show' toggle would
              imply a secrecy the design does not have." ─────────────────────────────────────── */}
          <div className="sec">
            <span className="kick">Your key</span>
            <span className="hair" aria-hidden="true" />
          </div>
          <p className="note" id="key-advice">{keyAdvice(sessionId)}</p>

          <div className="key-wrap">
            <p className="key" id="session-key" tabIndex={0}>
              {key}
            </p>
          </div>

          <button id="copy-key" type="button" className="btn2" onClick={copy}>
            {copied ? "Copied" : "Copy the key"}
          </button>

          <label className="lbl" htmlFor="restore-key">
            Have a key from another device?
          </label>
          <textarea
            id="restore-key"
            rows={2}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="barnerd-session:v1:…"
            spellCheck={false}
            autoComplete="off"
            className="restore"
          />
          <button
            id="restore"
            type="button"
            disabled={pasted.trim() === ""}
            onClick={restore}
            className="btn2"
          >
            Use this key
          </button>

          {/* ── HALF TWO — THE COPY. A readout, not a patch, and the file's real shape. ──────── */}
          <div className="sec">
            <span className="kick">The export</span>
            <span className="hair" aria-hidden="true" />
          </div>
          <p className="note">
            A copy of your recipes — name, glass, ice, method, notes, garnish, and every ingredient with
            its amount. No pictures: the artwork is the compositor&apos;s, not something you wrote.
          </p>

          <div className="readout">
            {/* No count sentence while `loaded` is null: the app has none to show, and inventing
                a placeholder would be a claim about a library nobody has read yet. */}
            {loaded && (
              <p className="note" id="ready" aria-live="polite">
                {loaded.specs.length === 0
                  ? "Nothing to export yet — your library is empty."
                  : `${loaded.specs.length} ${loaded.specs.length === 1 ? "recipe" : "recipes"}, ${width} ingredient ${width === 1 ? "column" : "columns"} — as wide as the longest one, with no cap.`}
              </p>
            )}
            {header && (
              <pre className="rowline" aria-hidden="true">
                {header}
              </pre>
            )}
          </div>

          {/* ── THE DOCKED FOOT — the room's one act. ───────────────────────────────────────── */}
          <div className="actionbar">
            <button
              id="export-csv"
              type="button"
              disabled={!loaded || loaded.specs.length === 0}
              onClick={download}
              className="primary"
              /* The reason the button is disabled, said once. Guarded because `#ready` does not exist
                 while the library is still being read — a dangling reference is not a description. */
              aria-describedby={loaded ? "ready" : undefined}
            >
              Download the CSV
            </button>
            {/* `role="status"` already implies `aria-live="polite"`, and the empty region has to
                exist before it has anything to say, or the first message is not announced. */}
            <p className="status" role="status">
              {note}
            </p>
          </div>
        </section>

        <p className="footlink">
          <Link to={dry ? "/roast?dry=1" : "/roast"} className="exit">
            back to the room
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RoastRecovery;
