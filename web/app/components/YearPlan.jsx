"use client";
import { useEffect, useMemo, useState } from "react";
import { API, annualBudgetPeriods, getJSON, largestRemainder, pad, withUser } from "../lib/format";
import { fetchPlans } from "../lib/plans";

/* ───────── YearPlan — the whole teaching year for ONE subject·class, at a glance ─────────
 * This is the restructured "allocation report" (founder decision, 2026-07-21): a LIVING mobile
 * view, never a PDF. It answers the one question My Lessons' per-chapter cards can't — "across
 * all my chapters and my finite annual periods, how does the year shape up, and how much have I
 * committed so far?" It reaches the teacher as the "Year Plan" pane of the My Lessons toggle, so
 * it inherits that tab's Subject·Class scope (this artifact is a class-level thing; it never sits
 * inside a chapter and there's nowhere else it belongs).
 *
 * What it deliberately does NOT show (the whole point of the restructure):
 *   • no competencies / competency weightages — those now live in the LP at chapter level;
 *   • no effort-index VALUES — an internal calibration signal, meaningless to a teacher. The
 *     index's information survives only as its consequence: raw periods (9 for Force vs 7 for
 *     Optics = "Force needs more time"), which is the value she can actually use.
 *
 * Two period figures, side by side:
 *   • Suggested — Aruvi's proposal: her annual budget distributed across chapters by the same
 *     effort/competency weight the allocator uses (largest-remainder, whole periods, sums to
 *     budget). Computed client-side so it always reconciles to the budget with no extra call.
 *   • Your plan — the periods she actually set when she prepared each lesson (prepared_periods
 *     from /plans). A class-level COMMITMENT, not classroom execution — so it stays honest and
 *     needs zero new input from her, and there is deliberately no "actual taught" column (that
 *     lives per-section on My Classes and Aruvi does not supervise it).
 *
 * The budget ledger (budget / committed / left) is the "must return" hook: pure arithmetic of her
 * own choices, updated whenever she prepares a lesson — reflection, never a verdict on her pace.
 *
 * Data: GET /subjects/{s}/{g}/chapters → {chapters:[{chapter_number,chapter_title,weight,
 * recommended_periods, recommended_source, ncf_estimated_periods}], standard_duration_minutes,
 * annual_budget_periods, allocation_basis}; GET /plans/{s}/{g} → prepared + prepared_periods
 * per chapter; budget from readiness via annualBudgetPeriods().
 *
 * NOTE — duration combos (40m/60m split per chapter) are not shown yet: prepared_periods stores
 * a single total, so a per-chapter by-duration breakdown isn't available on the committed side.
 * Reinstating it is a fast-follow that needs markPrepared to persist periods_by_duration.
 *
 * Props: subjectName (display), sSlug, gSlug (slugs), readiness (page projection), onAllocate.
 */

// `largestRemainder` moved to lib/format.js on 2026-08-13 so PrepareLesson shares it rather
// than re-deriving its suggestion with a per-chapter Math.round (ARV-D-142). The method is
// unchanged; this screen was already the correct one.

// Pencil (edit) — the SAME glyph the teaching profile uses (TeachingProfile.jsx `Pencil`).
// Duplicated rather than shared because the two files have no common component module and a
// four-line SVG is not worth one; if a third copy ever appears, lift it to lib/ instead.
const Pencil = ({ size = 13 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L18.5 9.5a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

/* Export — an arrow leaving a tray, upward (founder, 2026-08-30: "show export (upward arrow)
   symbol for the download"). Deliberately NOT the file-page glyph the allocation report's Word
   button uses: that one sits beside a written "Word" label and can afford to name the FORMAT,
   where this one sits bare beside the pencil and must name the ACT. Upward rather than the
   download-tray's downward arrow because the teacher's sense here is "take this out of Aruvi
   and away with me", not "pull something down into this device".
   Drawn on the same 24-box and stroke weight as `Pencil` so the pair reads as one set. */
const ExportIcon = ({ size = 13 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15V3" />
    <path d="M8 7l4-4 4 4" />
    <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </svg>
);

export default function YearPlan({ subjectName, sSlug, gSlug, readiness, onAllocate,
                                   onEditBudget }) {
  const [chapters, setChapters] = useState(null); // null = loading, [] = none
  const [plans, setPlans] = useState([]);
  const [err, setErr] = useState(false);
  // "idle" | "working" | "failed" — the export's own state, plus the REASON when it failed.
  // A failure is said under the totals row, not in an alert(): a modal would cover the very
  // table she was trying to take away with her.
  // ★ AND IT SAYS WHAT WENT WRONG (2026-08-30, founder: "it says could not download - try
  // again"). The first build printed one sentence for every failure, which is the Support
  // `metaErr` defect in miniature — a screen that cannot tell "the server has no such route"
  // (an API that needs restarting) from "the server refused" from "the network dropped" tells
  // her nothing she can act on, and tells the next person debugging it nothing either.
  const [exporting, setExporting] = useState("idle");
  const [exportErr, setExportErr] = useState("");
  /* ★ THE "PLAN" SUMMARY IS NO LONGER A DISCLOSURE AT ALL (founder, 2026-08-27, in three steps).
     It used to open under the column header and default CLOSED, so it would not eat the frozen
     head on arrival — sound while the note was only an explanation. It stopped being sound once
     the note carried the annual-budget figure: a number behind a disclosure cannot be judged,
     and the pencil beside it could not be found. So the note moved BELOW the totals row (where
     defaulting open pushes no chapter rows down), then opened by default, and then lost its
     chevron — because an arrow that reveals something already on screen is only a way to hide
     the explanation, which nobody wants. `showPlan` and `setShowPlan` are gone with it; the
     note simply renders. `.yp-hbtn` / `.yp-chev` in globals.css are now dead rules. */

  // Scoped fetch: chapters (weights + NCF estimate) and this teacher's prepared plans (for the
  // committed periods). Both are small, single calls per combo. Reset on subject/class change.
  useEffect(() => {
    if (!sSlug || !gSlug) return;
    let live = true;
    setChapters(null); setPlans([]); setErr(false);
    Promise.all([
      getJSON(`/subjects/${sSlug}/${gSlug}/chapters`),
      fetchPlans(`${sSlug}/${gSlug}`).then((plans) => ({ plans })).catch(() => ({ plans: [] })),
    ])
      .then(([ch, pl]) => {
        if (!live) return;
        setChapters(Array.isArray(ch.chapters) ? ch.chapters : []);
        setPlans(Array.isArray(pl.plans) ? pl.plans : []);
      })
      .catch(() => { if (live) { setErr(true); setChapters([]); } });
    return () => { live = false; };
  }, [sSlug, gSlug]);

  const model = useMemo(() => {
    const chs = (chapters || [])
      .slice()
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

    // Committed ("Your plan") periods per chapter, from prepared plans. prepared_periods can be
    // null on legacy prepares — such a chapter counts as prepared (a dot) but adds nothing to the
    // committed total, so the ledger only ever reflects periods she actually set.
    const committedByCh = {};
    const preparedSet = new Set();
    (plans || []).forEach((p) => {
      if (!p.prepared) return;
      preparedSet.add(p.chapter_number);
      if (p.prepared_periods != null) committedByCh[p.chapter_number] = p.prepared_periods;
    });

    // Budget: her configured annual budget; fall back to Aruvi's CALIBRATED year total when unset
    // (2026-07-26 — was the NCF sum). `recommended_periods` is the master plan's per-chapter
    // figure, with the API falling back to the NCF estimate itself where no master-plan row exists,
    // so this one field is the single number the whole product defaults to.
    const recSum = chs.reduce((s, c) => s + (c.recommended_periods || 0), 0);
    let budget = annualBudgetPeriods(readiness, sSlug, gSlug);
    if (!budget) budget = recSum || null;

    // Suggested per chapter: distribute the budget by weight; fall back to the calibrated
    // per-chapter recommendation when weights or budget are unavailable.
    const weights = chs.map((c) => (typeof c.weight === "number" && c.weight > 0 ? c.weight : 0));
    const wSum = weights.reduce((a, b) => a + b, 0);
    const sugByCh = {};
    if (budget && wSum > 0) {
      const dist = largestRemainder(budget, weights);
      chs.forEach((c, i) => { sugByCh[c.chapter_number] = dist[i]; });
    } else {
      chs.forEach((c) => { sugByCh[c.chapter_number] = c.recommended_periods ?? null; });
    }

    const rows = chs.map((c) => {
      const cn = c.chapter_number;
      const prepared = preparedSet.has(cn);
      const plan = committedByCh[cn] ?? null;
      const sug = sugByCh[cn] ?? null;
      return {
        n: cn,
        title: c.chapter_title || "",
        // Budgeted but unpublished — the API titles these "Book awaited" and flags them
        // (2026-08-06). They belong here: her year is 18 chapters whether or not the books
        // have shipped, and their periods are already held in the budget. They just can't
        // carry a plan, so the "not yet" pending tag is suppressed below — it isn't
        // waiting on HER.
        awaited: !!c.placeholder,
        sug,
        plan,
        prepared,
        delta: plan != null && sug != null ? plan - sug : null,
      };
    });

    const committedTotal = Object.values(committedByCh).reduce((a, b) => a + b, 0);
    const sugTotal = rows.reduce((s, r) => s + (r.sug || 0), 0);
    const preparedCount = preparedSet.size;
    const left = budget != null ? budget - committedTotal : null;
    const pct = budget ? Math.max(0, Math.min(100, Math.round((committedTotal / budget) * 100))) : 0;

    return { rows, budget, committedTotal, sugTotal, preparedCount, left, pct, remaining: rows.length - preparedCount };
  }, [chapters, plans, readiness, sSlug, gSlug]);

  /* ★ THE EXPORT SENDS THE SCREEN'S OWN MODEL — it does not ask the server to rebuild it.
     `sug` is computed right here (her budget, distributed by chapter weight with
     largest-remainder) and `plan` comes from her prepared plans. A server-side rebuild would
     be a SECOND implementation of that arithmetic, and the day the two drift she has a Word
     document contradicting the screen she exported it from — which is exactly the 2026-08-21
     defect (Year Plan said 14 where the chapter step said 19) reached through a new door.
     So the payload IS the render: whatever the table shows is what the file says.
     Download by blob + anchor, the same path Allocate.jsx and MyLessonPlans' ReportModal use;
     the filename comes off Content-Disposition so the server names its own file. */
  const downloadWord = async () => {
    if (exporting === "working") return;
    setExporting("working"); setExportErr("");
    try {
      const resp = await fetch(`${API}/api/year-plan/export-docx`, withUser({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectName, grade: gSlug,
          budget: model.budget ?? null,
          generated_at: new Date().toISOString(),
          rows: model.rows.map((r) => ({
            n: r.n, title: r.title, sug: r.sug, plan: r.plan,
            prepared: !!r.prepared, awaited: !!r.awaited,
          })),
          sug_total: model.sugTotal, plan_total: model.committedTotal,
        }),
      }));
      if (!resp.ok) {
        // Unwrap FastAPI's `detail` when there is one — it carries the real reason (and, on a
        // 500, the frame that raised). 404 gets its own words: it is not a broken export, it is
        // an API process older than this route, and "restart" is the only useful thing to say.
        let detail = "";
        try {
          const j = await resp.json();
          detail = typeof j.detail === "string" ? j.detail
            : Array.isArray(j.detail) ? j.detail.map((d) => d.msg).join("; ") : "";
        } catch { /* not JSON — the status alone is what we have */ }
        console.error("[year-plan export]", resp.status, detail || resp.statusText);
        throw new Error(
          resp.status === 404 ? "This Meyy server doesn't have the export yet."
            : resp.status === 501 ? "Word export isn't available on this server."
            : `${resp.status}${detail ? ` — ${detail}` : ""}`
        );
      }
      const blob = await resp.blob();
      const cd = resp.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = m ? m[1] : `year-plan-${sSlug}-${gSlug}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      setExporting("idle");
    } catch (e) {
      // Say what happened and leave it said — no auto-clear, or she looks away and the line
      // silently disappears. The next press resets it. A fetch that never reached the server
      // throws a TypeError with no status: that is the one case where "couldn't reach Aruvi"
      // is the honest sentence, and it must not be printed for a server that answered 500.
      console.error("[year-plan export]", e);
      setExportErr(e && e.message && !/^Failed to fetch/i.test(e.message)
        ? e.message : "Couldn't reach Meyy just now.");
      setExporting("failed");
    }
  };

  if (chapters === null) return <div className="yp-loading">Loading your year…</div>;
  if (err && !model.rows.length) return <div className="yp-empty">Couldn&rsquo;t load the year plan just now. Please try again.</div>;
  if (!model.rows.length) return <div className="yp-empty">No chapters found for {subjectName}.</div>;

  const { rows, budget, committedTotal, sugTotal } = model;
  const dash = <span className="yp-dash">&mdash;</span>;

  return (
    <div className="yp">
      {/* ★ THE TABLE IS RAISED OFF THE PAGE (founder, 2026-08-30): "the consistent colour
          palette across is nice but there is lack of differentiation between the table and the
          rest". One wrapper, so the column header, the chapter rows and the totals read as ONE
          object on its own plane, with the prose note and the prepare row left outside on the
          page where they belong. Nothing inside it changes.
          The sticky head stays sticky: `position: sticky` resolves against the nearest scroll
          container, and this wrapper sets no overflow — it only bounds how far the head can
          travel, which is an improvement (it now stops at the table's own end). */}
      <div className="yp-table">
      {/* Frozen head — everything down to and including the Chapter/Suggested/Your-plan line stays
          put while the chapter rows scroll beneath it (sticks under My Lessons' own frozen header
          via the measured --mlp2-frozen-h). */}
      <div className="yp-head">
      {/* Column header — the last frozen line (its bottom border is "the line below the row").
          The standalone "Plan" row that used to sit above this was removed (2026-08-06): it was a
          second, competing header for a table that already has one.
          ★ 2026-08-27: the disclosure CHEVRON is gone too, and with it the toggle. Its copy now
          sits below the totals and always shows, so the arrow was pointing at something already
          on screen — a control whose only remaining job was to take the explanation away. All
          three columns are now plain labels, which is what a column header should be. */}
      <div className="yp-colhd">
        <div className="yp-c chap">Chapter</div>
        <div className="yp-c">Suggested periods</div>
        <div className="yp-c yp-c-plan"><span className="yp-hlbl">Your<br />plan</span></div>
      </div>
      </div>{/* /yp-head */}

      {/* Chapter rows (scroll beneath the frozen head) */}
      <div className="yp-rows">
        {rows.map((r) => (
          <div className={`yp-row${r.prepared ? "" : " pend"}${r.awaited ? " awaited" : ""}`} key={r.n}>
            <div className="yp-cell-ch">
              <span className="yp-cn">{pad(r.n)}</span>
              <span className="yp-cname">{r.title}</span>
            </div>
            <div className="yp-sug">{r.sug != null ? r.sug : dash}</div>
            <div className="yp-planw">
              {r.awaited ? (
                <span className="yp-plan">{dash}</span>
              ) : r.plan != null ? (
                <span className="yp-plan">{r.plan}</span>
              ) : r.prepared ? (
                <span className="yp-plan yp-set">set</span>
              ) : (
                <><span className="yp-plan">{dash}</span><span className="yp-pend">not yet</span></>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="yp-tot">
        {/* ★ THE BUDGET PENCIL SITS ON THIS ROW (founder, 2026-08-27). It began beside the
            "a budget of N periods" sentence in the note below — which labels the number in
            words — but this is the row a teacher is actually reading when she judges her
            year, and the label is the last thing her eye passes before the figures. One
            pencil only; the sentence below stays plain prose.
            It goes in the LABEL cell (the 1fr column) so the two numeric columns stay aligned
            with the chapter rows above — .yp-tot is a 3-column grid keyed to those. */}
        {/* ★ THE EXPORT MOVED HERE, BESIDE THE PENCIL (founder, 2026-08-30). It was a labelled
            button in its own row below the card, on the reasoning that a download and an edit
            are different kinds of act and should not share a cell. That was the wrong unit of
            difference: BOTH of these are things you do to the table as a whole, and the totals
            row is where the table's own controls now live. Two icons in the label cell also
            cost less height than a whole row — which is the scarce thing on a phone — and the
            column of chapters stays uninterrupted down to the note.
            Same treatment as the pencil (.yp-budget-edit), so the pair reads as a set rather
            than as one control and one decoration. */}
        <span className="yp-tot-l">
          Total periods
          {onEditBudget ? (
            <button type="button" className="yp-budget-edit" onClick={onEditBudget}
              title="Change your annual periods"
              aria-label={`Change your annual period budget for ${subjectName}`}>
              <Pencil />
            </button>
          ) : null}
          <button type="button" className="yp-budget-edit yp-export-btn"
            onClick={downloadWord} disabled={exporting === "working"}
            title="Download this table as a Word document"
            aria-label={`Download the ${subjectName} year plan table as a Word document`}>
            <ExportIcon />
          </button>
        </span>
        <span className="yp-tot-n sug">{sugTotal}</span>
        <span className="yp-tot-n plan">{committedTotal}</span>
      </div>
      </div>{/* /yp-table */}

      {/* The export's only words. An icon button cannot say "preparing" or why it failed, and
          those two things must still be said — so they are said HERE, under the row the icon
          sits on, and only while there is something to say. Nothing renders when idle: a
          permanent caption explaining an icon is a sign the icon is wrong. */}
      {exporting === "working" ? (
        <p className="yp-export-msg">Preparing your Word document…</p>
      ) : exporting === "failed" ? (
        <p className="yp-export-msg bad">
          Couldn&rsquo;t download the year plan. {exportErr} Tap the arrow to try again.
        </p>
      ) : null}

      {/* ★ THE NOTE SITS BELOW THE TOTALS AND ALWAYS SHOWS (founder, 2026-08-27 — "put text
          below the total row with default open", then "no drop down needed").
          It explains the figures directly above it, so it reads in the order the eye moves:
          table, total, then what the total means and how to change it. It was a collapsed
          disclosure under the column header, which is why the budget figure — and for a while
          its pencil — could not be found. Still outside .yp-head, so it never freezes at the
          top; it simply scrolls in at the end of the pane. */}
      <p className="yp-note">
        {/* Plain prose — the pencil is on the Total periods row above, not here. This sentence
            names the number in words, which is why the control started here, but two pencils
            for one action is clutter and the totals row is where she is looking. */}
        Your teaching year at a glance — how{budget != null ? <> a budget of <b>{budget} periods</b></> : <> your periods</>} spread
        across all {rows.length} chapters. <b>Suggested periods</b> is Meyy&rsquo;s proposal, giving heavier chapters more
        room. Each time you prepare a lesson you set your own periods for that chapter; those appear
        in <b>Your plan</b>, beside the suggestion, so you can see where you&rsquo;ve adjusted and how much of
        the year you&rsquo;ve committed. To know how Meyy suggests, refer to Ask Meyy time allocation section.
      </p>
    </div>
  );
}
