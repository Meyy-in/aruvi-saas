"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { pushSectionState, readLocalBookmark, setUnitPointer, writeLocalBookmark } from "../lib/sectionState";
import { userKey, boldMarks, fetchPlanNotes, savePlanNote, planNoteKey, fetchEntitlement } from "../lib/format";

/* ───────── Lesson view (Screen 3) + assessment artifact (Screen 3b) ─────────
 * A COMPLETION surface, not a navigation one (2026-06-29 redesign). The plan's periods
 * (lesson_plan.groups[].periods[]) ARE the Learning Units; each period's activities are its
 * phases (no fabricated per-phase minutes — Phase 5 decision).
 *
 * Tracking mode (opened from My Week, has a section): shows ONLY the current unit + a segmented
 * progress bar (same look as Track) + one "Mark unit complete" action. Marking advances the
 * per-section pointer (localStorage) by one and shows a confirmation with the next unit and an
 * Undo that lives only for this visit (cleared on refresh/leave — no persisted trail). There is
 * no per-unit forward/back navigation and no rail; the WHOLE plan is one tap away via "View full
 * lesson plan", which re-renders this view in preview layout.
 *
 * Preview mode (opened from My Lesson Plans, or the in-view "View full lesson plan"): every unit
 * stacked top-to-bottom for reading, no pointer, no completion controls.
 *
 * Assessment "tags along" as the green ASSESS tab of the unit's tab bar (2026-07-10) — present
 * in BOTH the tracking view (scoped to the current unit) and the unit preview (scoped to the
 * previewed unit; §I-ter: preview shows future periods, their assessment comes along for free),
 * and only rendered when the unit actually anchors items. */

// Flatten groups → a single ordered Unit list, carrying the parent group label
// (progression stage / section / spine / competency) as context for each unit.
function flattenUnits(lp) {
  const units = [];
  const walk = (groups, ctx) => {
    (groups || []).forEach((g) => {
      const label = [ctx, g.label].filter(Boolean).join(" · ");
      (g.periods || []).forEach((p) => units.push({ ...p, context: label, groupType: g.type }));
      if (g.children) walk(g.children, label);
    });
  };
  walk(lp.groups, "");
  return units;
}

// Phase duration in minutes (end − start, parsed once by the engine); null when unparsed.
const phaseMin = (ph) =>
  Number.isFinite(ph?.start_min) && Number.isFinite(ph?.end_min) ? ph.end_min - ph.start_min : null;

/* ───────── The TABBED unit anatomy (2026-07-10, founder-directed) ─────────
 * The 2026-07-09 stacked anatomy is re-organized behind four per-unit tabs so nothing
 * reads "jumbled" on a phone: the header keeps ONLY the unit number + title, and the
 * content splits into
 *   OVERVIEW  — spine (group context) · time · pedagogy as ledger rows + teacher notes
 *   MATERIAL  — the pre-class checklist
 *   LESSON    — the timed phase spine (durations in the marginal rail) + homework
 *   ASSESS    — the unit's anchored assessment items, green language — the tab EXISTS
 *               only when the unit actually carries items (§I-ter anchor rule)
 * Overview/Material/Lesson always show (a slot simply says so when empty); LO is still
 * NEVER rendered in the LP (founder rule 2026-07-09) — it lives on the assess cards.
 * Spec mockup: docs/mockups/lesson-unit-tabs.html. */

// Which assessment items belong to THIS unit — same §I-ter anchor logic the old 3b
// sub-view used: an item surfaces once, at its anchor (closing) period; legacy views
// without anchor metadata fall back to all items so we never hide data by mistake.
function unitAssessItems(assessment, u) {
  if (!assessment?.groups?.length) return [];
  const all = assessment.groups.flatMap((g) => g.items || []);
  const anyAnchored = all.some((it) => it.meta?.anchor_period != null);
  return anyAnchored ? all.filter((it) => it.meta?.anchor_period === u.number) : all;
}

// Row label for the unit's group context, spelled from the plugin's group type.
const CTX_LABEL = { spine: "Spine", section: "Section", competency: "Competency", stage: "Stage", progression_stage: "Stage" };

function OverviewPanel({ u, chapterTitle }) {
  const dur = u.meta?.duration_minutes;
  // Axis row value: normally the group label (u.context). But where "section" is only a PROXY
  // for the axis and the grouping collapsed (maths prep → a single "Lesson" group), the plugin
  // hands the period its OWN anchored section in meta.section_label — use it so the row shows the
  // real section, not "Lesson". No-op elsewhere (TWAU's context already IS the section; maths
  // middle/secondary leave section_label empty and fall back to the group label).
  const axisVal = u.meta?.section_label || u.context;
  // Social Sciences groups periods by COMPETENCY, so the group axis would surface a single
  // "Competency" here — misleading, because a period routinely carries several competencies
  // (the Assess tab proves it: items anchored to one period span multiple c-codes). For SS we
  // suppress that competency axis and show the period's own textbook SECTION (section_anchor)
  // instead — a stable, honest "where are we in the chapter?" label. Other subjects keep their
  // native axis (spine / section / stage).
  // Same rule for SS EDGE-MODEL plans (flat "unit" group, competencies as per-unit edges):
  // the group axis carries no honest label, so the Overview shows the unit's own
  // section_anchor there too.
  const isSS = u.groupType === "competency"
    || (u.groupType === "unit" && u.meta?.section_anchor);
  const axisRow = isSS
    ? ["Section", u.meta?.section_anchor]
    : [CTX_LABEL[u.groupType] || "Spine", axisVal];
  const rows = [
    ["Chapter", chapterTitle],
    axisRow,
    ["Time", dur ? `${dur} mins` : null],
    ["Pedagogy", u.approach],
  ].filter(([, v]) => v);
  return (
    <>
      {rows.length ? (
        <div className="uv-ovrows">
          {rows.map(([k, v]) => (
            <div className="uv-ovrow" key={k}>
              <span className="kicker kicker-soft">{k}</span>
              <span className="uv-ovval">{v}</span>
            </div>
          ))}
        </div>
      ) : null}
      {/* Teacher notes moved to the LESSON tab (founder 2026-07-10) — one home only:
          a collapsed clay teaser ribbon at the top of the phase spine. */}
      {!rows.length ? (
        <div className="empty">No overview details recorded for this unit.</div>
      ) : null}
    </>
  );
}

function MaterialPanel({ u }) {
  // Typed prepared content (polish pass, 2026-08-18): the science port pre-splits
  // table payloads via normalize.parse_table, so this renders STRUCTURE only —
  // never re-splitting a raw pipe string. Legacy string visual_aids stay a quiet
  // reference line; the typed list renders as real blocks under the checklist.
  const aids = Array.isArray(u.meta?.visual_aids) ? u.meta.visual_aids : [];
  const legacyAid = typeof u.meta?.visual_aids === "string" && u.meta.visual_aids
    ? u.meta.visual_aids : null;
  if (!u.materials?.length && !aids.length && !legacyAid)
    return <div className="empty">Nothing to prepare — this unit needs no materials.</div>;
  return (
    <div className="uv-mat">
      {u.materials?.length ? <ul>{u.materials.map((m, i) => <li key={i}>{m}</li>)}</ul> : null}
      {legacyAid ? <p className="uv-va-legacy">{legacyAid}</p> : null}
      {aids.map((va, i) => (
        <div className="uv-va" key={i}>
          <div className="kicker kicker-soft uv-va-kicker">
            {va.type === "table" ? "Prepared table" : "Prepared text"}
            {va.title ? <span className="uv-va-title"> · {va.title}</span> : null}
          </div>
          {va.type === "table" && va.table ? (
            <table className="uv-va-table">
              {va.table.caption ? <caption>{va.table.caption}</caption> : null}
              <thead><tr>{(va.table.header || []).map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
              <tbody>
                {(va.table.rows || []).map((r, j) => (
                  <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {va.type === "table" && va.table?.source_note ? (
            <p className="uv-va-src">{va.table.source_note}</p>
          ) : null}
          {va.type === "prose" ? <p className="uv-va-prose">{va.text}</p> : null}
        </div>
      ))}
    </div>
  );
}

/* ───────── The phase BOOKMARK — the teacher's one place-marker on the chapter ─────────
 * A clay arrow (the SAME colour as the unit-title number, .lv-unum → var(--clay)) living in
 * the phase spine's left time rail: tail beside the mono minutes, tip pointing right at the
 * beginning of the phase. The teacher highlights it and drags it up/down; on release it
 * animates to the NEAREST phase and never rests between two. It marks whatever she wants —
 * what she finished, or what she'll begin next session (founder spec 2026-07-23).
 *
 * Scope + persistence: ONE bookmark per section-chapter. Its unit is always the in-progress
 * (pointer) unit — "Mark unit complete" advances the pointer and the arrow reappears at the
 * top phase of the next unit (handled in LessonView). Only the phase index is dragged here;
 * the caller persists it via sectionState.writeLocalBookmark, riding the same per-section row
 * as the pointer so it follows the teacher across devices and migrates to Supabase with it
 * (CLOUD_DATA_MODEL.md §2.4).
 *
 * Positioning is measured, not hard-coded: it anchors to each phase's .uv-ph-time centre
 * (offsetTop within the position:relative .uv-phases), so it lands exactly beside the minutes
 * whatever the phase text wraps to. */
function PhaseBookmark({ phaseCount, phase, onMove }) {
  const elRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [top, setTop] = useState(null);   // px within .uv-phases; null until first measure

  // Vertical centre (relative to .uv-phases) of every phase's time cell — the snap targets.
  const timeCentres = () => {
    const wrap = elRef.current?.parentElement;   // .uv-phases (position:relative)
    if (!wrap) return [];
    return Array.from(wrap.querySelectorAll(".uv-phase .uv-ph-time"))
      .map((t) => t.offsetTop + t.offsetHeight / 2);
  };

  // Rest at the current phase; re-measure on layout changes and viewport resize.
  useLayoutEffect(() => {
    if (dragging) return;
    const place = () => {
      const c = timeCentres();
      if (c.length) setTop(c[Math.min(phase, c.length - 1)]);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, phaseCount, dragging]);

  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { elRef.current?.setPointerCapture?.(e.pointerId); } catch {}
    setDragging(true);
  };
  const onMoveDrag = (e) => {
    if (!dragging) return;
    const wrap = elRef.current?.parentElement;
    const c = timeCentres();
    if (!wrap || !c.length) return;
    const y = e.clientY - wrap.getBoundingClientRect().top;
    setTop(Math.max(c[0], Math.min(c[c.length - 1], y)));   // clamp to the spine
  };
  const endDrag = (e) => {
    if (!dragging) return;
    const c = timeCentres();
    if (c.length && top != null) {
      let best = 0, bestD = Infinity;
      c.forEach((cy, i) => { const d = Math.abs(cy - top); if (d < bestD) { bestD = d; best = i; } });
      setTop(c[best]);                 // snap home to the chosen phase
      if (best !== phase) onMove(best);
    }
    setDragging(false);
    try { elRef.current?.releasePointerCapture?.(e.pointerId); } catch {}
  };
  // Keyboard nudge — focus the arrow, then ↑/↓ to step it phase by phase.
  const onKey = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = e.key === "ArrowUp" ? Math.max(0, phase - 1) : Math.min(phaseCount - 1, phase + 1);
      if (next !== phase) onMove(next);
    }
  };

  return (
    <button
      ref={elRef}
      type="button"
      className={`uv-bkmk${dragging ? " dragging" : ""}`}
      style={{ top: top == null ? 0 : top, visibility: top == null ? "hidden" : "visible" }}
      onPointerDown={startDrag}
      onPointerMove={onMoveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKey}
      aria-label={`Lesson bookmark — on phase ${phase + 1} of ${phaseCount}; drag or use arrow keys to move`}
      title="Your bookmark — drag to the phase you want to mark"
      data-tour="phase-bookmark"
    >
      {/* One CHUNKY solid arrow (no thin stem — too fine to grab on a phone; founder
          2026-07-23). Short fat body by the time, big head pointing right at the phase start. */}
      <svg viewBox="0 0 32 28" width="30" height="26" aria-hidden="true">
        <path d="M3 10 H15 V3 L30 14 L15 25 V18 H3 Z" fill="currentColor"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function LessonPanel({ u, bookmark = null }) {
  const phases = (u.phases || []).filter((ph) => ph.text || ph.label);
  const notes = u.teacher_notes?.length ? u.teacher_notes.join(" ") : null;
  // THE MATERIAL POINTER IS BOLD (founder, 2026-08-20). A re-authored closing unit keeps
  // its problems and worked solutions in the Material tab, and its notes open by saying
  // so — "Refer to Prepared Table (see material: '…')". Set in the same weight as the
  // prose around it, that sentence reads as more prose and the teacher does not go and
  // look. It is the one place in a note that is an INSTRUCTION about where to find
  // something, so it is the one place that earns emphasis.
  //
  // Matched, not marked up. teacher_notes is plain text everywhere else in the corpus and
  // giving one field a markdown parser would be a precedent the design system has to keep
  // — every other note would then have to be checked for stray asterisks. The sentence is
  // written by `repair_c3.pass_synthesis_points_at_its_table`, which PREPENDS a fixed
  // shape, so a leading-anchored match is exact rather than a guess; anything else falls
  // through and renders as it always did.
  const POINTER = /^(Refer to Prepared Table[^.]*\.)\s*/;
  const [, notesLead, notesRest] = notes
    ? (notes.match(POINTER) || [null, null, null]).concat(notes.replace(POINTER, ""))
    : [null, null, null];
  return (
    <>
      {/* Teacher notes — a colleague's margin note, living WHERE IT'S READ: the top of
          the lesson spine (its only home — founder 2026-07-10). Open in FULL by default
          across My Classes and My Lessons (founder 2026-07-23); one tap collapses it to a
          one-line clay teaser. data-tour="lesson-notes" kept for tour positioning. */}
      {notes ? (
        <details className="uv-tnotes-rib" data-tour="lesson-notes" open>
          <summary>
            <span className="kicker">Teacher notes</span>
            <span className="uv-tnotes-teaser">{notes}</span>
          </summary>
          <p>
            {notesLead ? <strong className="uv-tnotes-ref">{notesLead}</strong> : null}
            {notesLead ? " " : null}
            {notesLead ? notesRest : notes}
          </p>
        </details>
      ) : null}
      {/* Phases — the hero; durations in the marginal rail, one aligned column.
          Legacy fallback: plans normalized before Phase landed render activities lines. */}
      {phases.length ? (
        <div className="uv-phases">
          {/* The teacher's bookmark — tracking view, in-progress unit only (bookmark != null).
              Anchored to the phase time cells; drag to move, snaps to the nearest phase. */}
          {bookmark ? (
            <PhaseBookmark
              phaseCount={phases.length}
              phase={Math.min(bookmark.phase, phases.length - 1)}
              onMove={bookmark.onMove}
            />
          ) : null}
          {phases.map((ph, i) => {
            const mins = phaseMin(ph);
            return (
              <div className="uv-phase" key={i} data-tour={i === 0 ? "lesson-phase-1" : undefined}>
                <div className="uv-ph-time">
                  <span className="uv-ph-n">{mins != null ? mins : (ph.label || "—")}</span>
                  {mins != null ? <span className="uv-ph-u">min</span> : null}
                </div>
                <p className="uv-ph-t">{ph.text}</p>
              </div>
            );
          })}
        </div>
      ) : (u.activities && u.activities.length) ? u.activities.map((act, i) => (
        <div className="phaserow" key={i} data-tour={i === 0 ? "lesson-phase-1" : undefined}><span className="phasetext">{act}</span></div>
      )) : <div className="empty">No phases recorded for this unit.</div>}

      {/* Homework — the single tinted block, full text (no word caps). */}
      {u.homework ? (
        <div className="uv-hw">
          <span className="kicker">Homework</span>
          <p>{boldMarks(u.homework)}</p>
        </div>
      ) : null}
    </>
  );
}

// The unit's assessment tab — flat on the unit's paper (the green box was retired in the
// same-day revision; assessment keeps its own voice via PINE accents). ONE anchored item
// renders bare; more than one introduces the one-at-a-time PINE question pager — pine,
// never clay, so it can't be mistaken for the unit strip. Paging resets the item's tabs
// to Overview.
//
// FROZEN CHROME (founder 2026-07-10): everything down to and including the item tab bar
// stays pinned — the pager + item tabs sit in ONE sticky group that stacks directly
// below whatever is already frozen above (in preview, .lv-stick pins the header + UNIT
// tab bar). The group's `top` is measured at mount (app nav + .lv-stick height when
// present) since those heights vary with title wrapping. Only panel content scrolls.
function AssessPanel({ items, mathsMiddle = false, mathsSecondary = false }) {
  const [at, setAt] = useState(0);
  const [itab, setITab] = useState("ov");
  const grpRef = useRef(null);
  const idx = Math.min(at, items.length - 1);
  const many = items.length > 1;
  const it = items[idx];
  const n = it?.normalized;
  const set = n && n.template ? itemTabSet(n) : null;
  // Guard: if paging lands on an item without the previously-active tab, fall back.
  const tab = set && set.tabs.some(([id]) => id === itab) ? itab : "ov";
  const goto = (i) => { setAt(i); setITab("ov"); };

  useEffect(() => {
    const el = grpRef.current;
    if (!el || typeof window === "undefined") return;
    const place = () => {
      // In shell mode (html.app-shell) the scrollport is .bodycontent, which starts BELOW the
      // top bar — the bar no longer overlays content, so NO --nav-h compensation (this inline
      // top overrides the `html.app-shell … { top:0 }` rule in globals.css, so it must account
      // for the shell itself). Outside the shell the bar overlays, so keep the offset.
      const shell = document.documentElement.classList.contains("app-shell");
      const navH = shell ? 0
        : (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h"), 10) || 118);
      const stick = document.querySelector(".lv-stick");
      el.style.top = `${navH + (stick ? stick.offsetHeight : 0)}px`;
    };
    place();
    const raf = requestAnimationFrame(place);   // re-measure after the frozen header settles
    window.addEventListener("resize", place);
    window.addEventListener("orientationchange", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("orientationchange", place);
    };
  }, []);

  return (
    <>
      <div className="uv-assess-stick" ref={grpRef}>
        {many ? (
          <div className="uv-apager">
            <button className={`uv-apgbtn ${idx <= 0 ? "off" : ""}`} disabled={idx <= 0}
              onClick={() => goto(idx - 1)}>← Previous</button>
            <span className="uv-apgmid">Question {idx + 1} / {items.length}</span>
            <button className={`uv-apgbtn ${idx >= items.length - 1 ? "off" : ""}`} disabled={idx >= items.length - 1}
              onClick={() => goto(idx + 1)}>Next →</button>
          </div>
        ) : null}
        {set ? (
          <div className="assess-mtabs" role="tablist">
            {set.tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id}
                className={`assess-mt${tab === id ? " on" : ""}`}
                onClick={() => setITab(id)}>{label}</button>
            ))}
          </div>
        ) : null}
      </div>
      <AssessBody it={it} tab={tab} qn={many ? idx + 1 : null} mathsMiddle={mathsMiddle} mathsSecondary={mathsSecondary}
        onNext={many && idx < items.length - 1 ? () => goto(idx + 1) : null} onTab={setITab} key={idx} />
    </>
  );
}

/* Tab state + rendered parts (bar / panel) for a unit. Split so the preview view can pin the
 * bar inside its frozen header while the panel scrolls beneath. Callers key the consuming
 * component by unit index, so paging to another unit resets the active tab to the default —
 * LESSON (founder, 2026-07-25): a unit opens on the teaching script itself, and Next lands
 * there too; Overview/Material are reference tabs a teacher visits deliberately.
 * data-tour="unit-tabs": tour step 10's tooltip hangs below the bar. */
function useUnitTabsParts(u, assessment, chapterTitle, lessonFooter = null, defaultTab = "lesson", bookmark = null) {
  const items = unitAssessItems(assessment, u);
  // Inclusivity keyword-bolding is stage-specific: middle maths writes differentiation as
  // "…struggling student…; challenge: …", so those two words are weighted (see InclusivityText).
  // Secondary maths writes it as "Support: … Challenge: …" — both labels weighted, each on its
  // own row.
  const g = String(assessment?.grade || "").toLowerCase().replace(/grade|class/g, "").trim();
  const mathsMiddle = assessment?.subject === "mathematics" && ["vi", "vii", "viii"].includes(g);
  const mathsSecondary = assessment?.subject === "mathematics" && ["ix", "x"].includes(g);
  const [tab, setTab] = useState(defaultTab);
  const tabs = [
    ["overview", "Overview"],
    ["material", "Material"],
    ["lesson", "Lesson"],
    ...(items.length ? [["assess", "Assess"]] : []),
  ];
  const bar = (
    <div className="uv-tabs" data-tour="unit-tabs" role="tablist">
      {tabs.map(([id, label]) => (
        <button
          key={id} role="tab" aria-selected={tab === id}
          className={`uv-tab${tab === id ? " on" : ""}`}
          onClick={() => setTab(id)}
        >{label}</button>
      ))}
    </div>
  );
  const panel = (
    <>
      {tab === "overview" ? <OverviewPanel u={u} chapterTitle={chapterTitle} /> : null}
      {tab === "material" ? <MaterialPanel u={u} /> : null}
      {/* lessonFooter (tracking only): the "Mark this unit complete" action lives HERE — at the
          END of the Lesson tab, the natural close of a period — so it stops appearing under every
          tab. Passed only for the pointer/just-completed unit; null everywhere else. */}
      {tab === "lesson" ? <><LessonPanel u={u} bookmark={bookmark} />{lessonFooter}</> : null}
      {tab === "assess" ? <AssessPanel items={items} mathsMiddle={mathsMiddle} mathsSecondary={mathsSecondary} /> : null}
    </>
  );
  return { bar, panel };
}

// Preview view: the header + tab bar are frozen together (one sticky block); only the panel
// scrolls. `headerContent` is the topbar + name-plate built by the caller. Shared by My Lessons
// preview, the read-only "View full lesson plan", AND the My Classes tracking view.
function PreviewUnit({ headerContent, u, assessment, chapterTitle, lessonFooter = null, defaultTab = "lesson", bookmark = null }) {
  const { bar, panel } = useUnitTabsParts(u, assessment, chapterTitle, lessonFooter, defaultTab, bookmark);
  return (
    <>
      <div className="lv-stick">
        {headerContent}
        {bar}
      </div>
      {panel}
    </>
  );
}

/* ───────── Screen 3b — normalized assessment cards (question-type registry) ─────────
 * SUBJECT-AGNOSTIC by contract: every card reads ONLY item.normalized (the NormalizedItem
 * shape from aruvi_core/view_model.py, spec docs/assessment-question-type-registry.md §2)
 * and switches on n.template — 6 card templates for the 12 registry types. Card order is
 * always LO (absent, not blank, when null — the Maths middle/prep case) → type/meta →
 * stem → stimulus → the template's marking surface → inclusivity. Items normalized before
 * the contract shipped fall back to the legacy card. Tables arrive PRE-SPLIT from the
 * engine (normalize.parse_table) — this renderer never re-splits pipe strings. */

// A maths number line — an ordered tick line (labels + blank ticks) the engine parsed from a
// pipe row, drawn as an axis with ticks, NOT a grid. Blank ticks are the positions a student
// marks; the instruction sits below.
function ANumberLine({ nl }) {
  const ticks = nl?.ticks || [];
  if (!ticks.length) return null;
  const W = 320, padX = 26, y = 26, n = ticks.length;
  const step = n > 1 ? (W - 2 * padX) / (n - 1) : 0;
  const x = (i) => padX + i * step;
  return (
    <div className="assess-vs assess-vs-nl">
      <svg viewBox={`0 0 ${W} 52`} className="assess-nl-svg" role="img" aria-label="Number line">
        <line x1={padX - 12} y1={y} x2={W - padX + 12} y2={y} className="assess-nl-axis" />
        <polygon points={`${padX - 12},${y} ${padX - 4},${y - 4} ${padX - 4},${y + 4}`} className="assess-nl-arrow" />
        <polygon points={`${W - padX + 12},${y} ${W - padX + 4},${y - 4} ${W - padX + 4},${y + 4}`} className="assess-nl-arrow" />
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={x(i)} y1={y - 6} x2={x(i)} y2={y + 6} className="assess-nl-tick" />
            {t.label ? <text x={x(i)} y={y + 20} className="assess-nl-lab" textAnchor="middle">{t.label}</text> : null}
          </g>
        ))}
      </svg>
      {nl.instruction ? <div className="assess-nl-instr">{nl.instruction}</div> : null}
    </div>
  );
}

// Typed stimulus/passage block — same typing as LP visuals (svg / table / number_line / prose).
function ATyped({ b, passage = false }) {
  if (!b || !b.content) return null;
  if (b.type === "svg") return <div className="assess-vs assess-vs-svg" dangerouslySetInnerHTML={{ __html: b.content }} />;
  if (b.type === "number_line" && b.number_line) return <ANumberLine nl={b.number_line} />;
  if (b.type === "table" && b.table) {
    // A word bank (no column semantics) arrives with an empty header — render every cell the
    // same, with no bold/filled header row. Data tables keep their header.
    // `caption` / `source_note` (2026-08-04): the generator puts non-data lines inside the
    // pipe payload — a title row above the header, a trailing attribution line. parse_table
    // lifts them OUT so the grid's columns line up (they used to render as a short header
    // over wider body rows, here and in PDF/Word alike); they are printed around the table
    // rather than dropped, because both carry text the reader is meant to see.
    const header = b.table.header || [];
    const caption = b.table.caption || "";
    const srcNote = b.table.source_note || "";
    return (
      <div className="assess-vs">
        {caption ? <div className="assess-table-cap">{caption}</div> : null}
        <table className="assess-table">
          {header.length ? <thead><tr>{header.map((c, i) => <th key={i}>{c}</th>)}</tr></thead> : null}
          <tbody>{(b.table.rows || []).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
        {srcNote ? <div className="assess-table-src">{srcNote}</div> : null}
      </div>
    );
  }
  return <div className={passage ? "assess-passage" : "assess-vs assess-vs-prose"}>{b.content}</div>;
}

// A labelled prose block (SUGGESTED ANSWER / ANSWER KEY / METHOD / SCAFFOLD / …).
function ABlock({ k, text }) {
  if (!text) return null;
  return (
    <div className="assess-look">
      <span className="assess-look-k">{k}</span>
      <div className="assess-look-t">{text}</div>
    </div>
  );
}

// A fill-in scaffold template. The SPLIT into rows is done ONCE in the engine
// (assessment_norm.split_scaffold_lines) so a numbered/step template never runs together in
// one paragraph — the renderer just lays out whatever rows it produced (blank string = a
// spacer between blocks, e.g. Part A / Part B). Falls back to plain prose when unsplit.
function AScaffold({ n }) {
  if (!n.scaffold) return null;
  const lines = n.scaffold_lines;
  if (!lines?.length) return <ABlock k="SCAFFOLD" text={n.scaffold} />;
  return (
    <div className="assess-look">
      <span className="assess-look-k">SCAFFOLD</span>
      <div className="assess-scaf">
        {lines.map((ln, i) =>
          ln
            ? <div className="assess-scaf-row" key={i}>{ln}</div>
            : <div className="assess-scaf-gap" key={i} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

// A numbered/lettered part list — {marker, text} rows, marker in the mono margin. The
// SPLIT is done ONCE in the engine (assessment_norm.split_parts), never here — the
// renderer only renders whatever list the normalizer produced, so any subject/notation
// the normalizer understands lands the same way. Shared by the question stem and the
// answer key.
function APartsList({ lead, parts }) {
  return (
    <>
      {lead ? <p className="assess-parts-lead">{lead}</p> : null}
      <div className="assess-ansrows">
        {parts.map((p, i) => (
          <div className="assess-ansrow" key={i}>
            {p.marker ? <span className="assess-ans-lab">{p.marker}</span> : null}
            <span className="assess-ans-t">{p.text}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/* A COMPOUND item's options, split back under the sub-question each belongs to.
 *
 * Some listening items ask two questions in one item and carry BOTH option sets in the
 * single `options[]` array the schema gives them. They are distinguished by a GROUPED
 * label — "1A".."1D" for sub-question 1, "2A".."2D" for sub-question 2 — which is the
 * storage key and was never meant to be read by a teacher. On screen the sets belong
 * under their own question, each lettered A–D, exactly as a simple MCQ is
 * (founder, 2026-08-14).
 *
 * Returns null for anything that is NOT compound — a flat A–D list, a TRUE_FALSE
 * statement list, an empty array, or a single group — so every ordinary item keeps the
 * existing render path untouched. That null is deliberate: this is the only new branch,
 * and it can only be entered by the two items in the corpus that need it.
 */
/* PREFIX + LETTER, separator optional — NOT one fixed notation. The corpus holds two
 * ("1A"…"2D" from the wave-1 tops, "Q1-A"…"Q2-D" from the wave-2 compacts) because the
 * assessment constitution declares none for a compound item, so the model invents one per
 * run. Match the SHAPE. The prefix must contain a digit — that is the sub-question number,
 * and requiring it stops a two-letter label grouping by accident. Mirrors
 * aruvi_core/compound_options.py; keep the two in step. */
const GROUPED_LABEL = /^(.+?)[\s\-_.]*([A-Z])$/;

function splitLabel(label) {
  const m = String(label || "").match(GROUPED_LABEL);
  if (!m) return null;
  const digits = m[1].match(/\d+/);
  return digits ? [digits[0], m[2]] : null;   // group = the sub-question NUMBER
}

export function groupedOptionSets(opts) {
  const list = opts || [];
  if (list.length < 2) return null;
  const marks = list.map((o) => splitLabel(o.label));
  if (marks.some((m) => !m)) return null;
  const order = [];
  const by = new Map();
  list.forEach((o, i) => {
    const [group, letter] = marks[i];
    if (!by.has(group)) { by.set(group, []); order.push(group); }
    // `display` is what the teacher reads; `label` stays the storage key so the reveals
    // map, the correct-answer list and the choice popup all still join on it.
    by.get(group).push({ ...o, display: letter });
  });
  return order.length > 1 ? order.map((group) => ({ group, opts: by.get(group) })) : null;
}

// A labelled answer block. Renders the engine-structured multi-part key (n.answer_parts)
// as rows when present; otherwise the plain model_answer prose.
function AAnswerBlock({ k, n }) {
  if (!n || !n.model_answer) return null;
  if (!n.answer_parts?.length) return <ABlock k={k} text={n.model_answer} />;
  return (
    <div className="assess-look">
      <span className="assess-look-k">{k}</span>
      <APartsList lead={n.answer_lead} parts={n.answer_parts} />
    </div>
  );
}

// A labelled tick-list (LOOK FOR / EXPECTED ELEMENTS / SPEAKING RUBRIC / WHAT TO PRODUCE).
function ATicks({ k, items }) {
  if (!items?.length) return null;
  return (
    <div className="assess-look">
      <span className="assess-look-k">{k}</span>
      <ul className="assess-ticks">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

// "What each choice reveals" — label → misconception rows. The "note" key is the
// tolerated legacy prose fallback (un-migrated English MCQs, older SS/TWAU annotations)
// and renders as a plain paragraph, not a labelled row.
function AReveals({ reveals, opts = [], sets = null }) {
  const entries = Object.entries(reveals || {});
  // Which choice's wording is popped open (label), or null. Lets the teacher relate a
  // "what this reveals" line back to the actual choice text (founder 2026-07-11).
  const [shown, setShown] = useState(null);
  if (!entries.length) return null;
  const optFor = (lab) => opts.find((o) => o.label === lab) || null;
  // On a compound item the reveals are keyed by the STORAGE label (1A…2D) but must read
  // as the sub-question's own letter — "Q2 · C", never "2C".
  const setFor = (lab) => sets?.find((s) => s.opts.some((x) => x.label === lab)) || null;
  const shownLab = (lab) => {
    const s = setFor(lab);
    return s ? s.opts.find((x) => x.label === lab).display : lab;
  };
  const popped = shown ? optFor(shown) : null;
  return (
    <div className="assess-look">
      <span className="assess-look-k">WHAT EACH CHOICE REVEALS</span>
      <div className="assess-rev">
        {entries.map(([lab, txt], i) =>
          lab === "note"
            ? <div className="assess-look-t" key={i}>{txt}</div>
            : (
              <div className="assess-revrow" key={i}>
                {setFor(lab) ? <span className="assess-corr-q">Q{setFor(lab).group}</span> : null}
                <span className="assess-rev-lab">{shownLab(lab)}</span>
                <span>
                  {txt}
                  {optFor(lab) ? (
                    <button type="button" className="assess-rev-choice" onClick={() => setShown(lab)}>
                      Choice {shownLab(lab)}
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
      </div>
      {/* Choice-wording popup — Aruvi paper/ink/pine, ✕ pinned top-LEFT. Backdrop click
          or ✕ closes. */}
      {popped ? (
        <div className="assess-choicepop" role="dialog" aria-modal="true" onClick={() => setShown(null)}>
          <div className="assess-choicepop-box" onClick={(e) => e.stopPropagation()}>
            <button className="assess-choicepop-x" aria-label="Close" onClick={() => setShown(null)}>✕</button>
            <span className="assess-choicepop-lab">
              {setFor(shown) ? `Question ${setFor(shown).group} · ` : ""}Choice {shownLab(shown)}
            </span>
            <p className="assess-choicepop-t">{popped.text}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// The pre-contract card (plans normalized before NormalizedItem shipped).
function ALegacyCard({ it }) {
  return (
    <>
      <div className="assess-qtype">{qtypeName(it.item_type)}</div>
      <div className="assess-prompt">{it.prompt}</div>
      {it.options?.length ? (
        <ol className="assess-opts">{it.options.map((o, k) => <li key={k}>{o}</li>)}</ol>
      ) : null}
      {it.answer ? <div className="assess-ans">Answer: {it.answer}</div> : null}
      {it.teacher_guide?.length ? (
        <div className="assess-look">
          <span className="assess-look-k">LOOK FOR</span>
          <div className="assess-look-t">{it.teacher_guide.join(" · ")}</div>
        </div>
      ) : null}
    </>
  );
}

/* ── The per-item TAB SET (founder spec 2026-07-10): OVERVIEW · QUESTION · ANSWER ·
 * INCLUSIVITY — the unit-tabs interaction grammar. Same-day palette revision: the green
 * artifact box is RETIRED — items sit flat on the unit's paper in the site's pine voice;
 * what stays distinctly "assessment" is the PINE question pager (vs the clay unit strip)
 * and pine accents. Slotting by the audience test:
 *   OVERVIEW    — why it's asked: LO (absent, not blank, when null) · type · cognitive
 *                 demand · competency. The old always-visible LO strip lives here now.
 *   QUESTION    — everything said/shown to the class: extract, stem, listening cue,
 *                 stimulus, PLAIN options (NO correct tick — the phone can face the
 *                 class), what-to-produce, scaffold, the open-task reading guide
 *                 (format / demonstrates / reading-the-scaffold; still collapsed),
 *                 textbook ref.
 *   ANSWER      — everything student work is checked against: correct option(s) ✓,
 *                 model answer / key, what-each-choice-reveals, expected elements,
 *                 look-fors, method line. Tab exists only when any of these is populated.
 *   INCLUSIVITY — its own tab (class diversity is first-class); exists only when populated.
 * strong_vs_weak_markers is DATA-ONLY (carried in NormalizedItem, never rendered —
 * founder 2026-07-10: verbose, and it restates expected elements + look-fors).
 * Pre-contract items keep the flat legacy card, no tabs. */

// Full-word display names for question types — NEVER acronyms on screen (founder
// 2026-07-10). Long forms per the registry §3; unknown types fall back to the raw
// value with underscores spaced.
const QTYPE_NAME = {
  MCQ: "Multiple choice question",
  TRUE_FALSE: "True or false",
  SCR: "Short constructed response",
  ECR: "Extended constructed response",
  OPEN_TASK: "Open task",
  PROJECT: "Project",
  WRITING_TASK: "Writing task",
  FILL_IN: "Fill in the blanks",
  MATCH: "Match the following",
  ORAL_PROMPT: "Oral prompt",
  NUM: "Numerical problem",
  EXTRACT_ANALYSIS: "Extract analysis",
  SOURCE_INTERPRETATION: "Source interpretation",
};
const qtypeName = (t) => QTYPE_NAME[t] || String(t || "").replace(/_/g, " ");

function AOverviewPanel({ n, lo, nav }) {
  const comp = n.competency ? [n.competency.code, n.competency.text].filter(Boolean).join(" — ") : null;
  // Every field leads with a BOLD single-row heading, its value below as a normal paragraph.
  // Order (founder 2026-07-11): Competency → Learning outcome → Question type → Cognitive
  // demand. Built as a list so the forward nav ("Question →") can ride the LAST field's value
  // row — sharing the line when the value is short, wrapping below (still right) when it fills.
  // Maths middle/prep fill NONE of Competency, Learning outcome or (until 2026-08-10)
  // Cognitive demand — LP Rule 8 forbids competencies at that stage, 8-rule row 4 has no
  // LO source at all, and cognitive_demand is a secondary-only key. The panel rendered a
  // single row, "Question type", and read as bare beside secondary's four. Two rows the
  // item was already carrying now surface: the SECTION under test (which the handoff-
  // bridged stages spend on the LO instead), and the goal — recall/reason/apply — which
  // that stage's own assessment Rule 3 defines as the item's cognitive level, normalized
  // into cognitive_demand at the seam. Nothing new is asked of any generator.
  const rows = [];
  if (comp) rows.push(["Competency", comp]);
  if (lo) rows.push(["Learning outcome", lo]);
  if (n.section) rows.push(["Section", n.section]);
  rows.push(["Question type", qtypeName(n.question_type)]);
  if (n.cognitive_demand) rows.push(["Cognitive demand", n.cognitive_demand]);
  // BOOK EXERCISE IS NOT REPEATED HERE (founder, 2026-08-19). It was added to this panel
  // on 2026-08-10 for the reason the comment above gives — maths middle and preparatory
  // fill none of Competency or Learning outcome, so Overview looked bare beside
  // secondary's four rows. But the Question tab already shows it, in full, under
  // TEXTBOOK EXERCISE, and a field that appears twice on one item reads as two different
  // facts until the teacher checks. The bareness it was patching is already answered by
  // the other two rows added that day: Section and Cognitive demand. Removing this leaves
  // three rows at those stages, not one.
  //
  // Where it BELONGS is a separate question worth noting rather than acting on here: both
  // exports (export_assessment_pdf.py, export_docx.py) place it in the ANSWER section, as
  // a teacher-facing companion, while the screen places it in the Question tab. Screen and
  // print are supposed to read alike (CLAUDE.md §4). One of the two is wrong; deciding
  // which is a founder call, not a tidy-up.
  return (
    <div className="assess-ovrows">
      {rows.map(([k, v], i) => (
        <div className="assess-ovlo" key={i}>
          <span className="assess-ovk assess-ovk-b">{k}</span>
          <div className="assess-ovlo-main">
            <p className="assess-ovlo-t">{v}</p>
            {i === rows.length - 1 ? nav : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function AQuestionPanel({ n, opts, sets, nav }) {
  // TRUE_FALSE: statements are stored twice at source (in the stem AND as options). The
  // engine folds them into `tf_statements`; show that ONCE as the statement list and NEVER
  // the options block (which would repeat every statement). The instruction line is stem_lead.
  const isTF = n.template === "true_false" && n.tf_statements?.length;
  // A compound item's sets can sit under their own sub-question only when the engine's
  // stem split produced exactly one part per set. When it did not, they are still shown
  // grouped (below), never merged back into one list.
  const interleaved = !!(sets && !isTF && n.stem_parts?.length === sets.length);
  return (
    <div className="assess-qnavwrap">
      <div className="assess-qnavmain">
      {/* T6c (EXTRACT_ANALYSIS): the extract is set off BEFORE the multi-part stem. */}
      {n.template === "passage" ? <ATyped b={n.passage} passage /> : null}
      {isTF ? (
        <div className="assess-prompt assess-prompt-tab">
          {n.stem_lead || n.stem ? <p className="assess-parts-lead">{n.stem_lead || n.stem}</p> : null}
          <div className="assess-ansrows">
            {n.tf_statements.map((s, i) => (
              <div className="assess-ansrow" key={i}>
                {s.marker ? <span className="assess-ans-lab">{s.marker}</span> : null}
                <span className="assess-ans-t">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : interleaved ? (
        /* COMPOUND: each sub-question followed by its OWN choices, lettered A–D. The
           grouped storage label (1A…2D) is never shown. */
        <div className="assess-prompt assess-prompt-tab">
          {n.stem_lead ? <p className="assess-parts-lead">{n.stem_lead}</p> : null}
          {sets.map((set, si) => (
            <div className="assess-subq" key={set.group}>
              <div className="assess-ansrow">
                {n.stem_parts[si].marker
                  ? <span className="assess-ans-lab">{n.stem_parts[si].marker}</span> : null}
                <span className="assess-ans-t">{n.stem_parts[si].text}</span>
              </div>
              <ul className="assess-opts2 assess-opts-sub">
                {set.opts.map((o, i) => (
                  <li key={i}>
                    <span className="assess-opt-lab">{o.display}</span>
                    <span>{o.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : n.stem_parts?.length ? (
        /* When the engine found a numbered/lettered list inside the stem, render the intro
           then the parts as rows; otherwise the plain stem prose. */
        <div className="assess-prompt assess-prompt-tab">
          <APartsList lead={n.stem_lead} parts={n.stem_parts} />
        </div>
      ) : (
        <div className="assess-prompt assess-prompt-tab">{n.stem}</div>
      )}
      {/* Listening input the item can't run without — a cue, never a citation. */}
      {n.audio_ref ? (
        <div className="assess-audio">
          <svg className="assess-audio-ico" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10v4" /><path d="M8 7v10" /><path d="M12 4v16" /><path d="M16 8v8" /><path d="M20 11v2" />
          </svg>
          <span className="assess-audio-t"><i>Listening passage</i>
            <span className="assess-audio-ref"> — {n.audio_ref}, read aloud</span></span>
        </div>
      ) : null}
      <ATyped b={n.visual_stimulus} />
      {/* Options are PLAIN here — the tick lives in the ANSWER tab. TRUE_FALSE never shows
          them (the statements above ARE the options; showing both duplicates every line). */}
      {opts.length && !isTF && !interleaved ? (
        sets ? (
          /* Compound, but the stem's parts did not line up one-to-one with the option
             sets — so the sets could not be placed under their questions above. Show them
             grouped and NUMBERED here rather than as one undifferentiated list: the
             grouping is still the truth, only its placement is degraded. */
          sets.map((set) => (
            <div className="assess-subq" key={set.group}>
              <span className="assess-opt-grp">Question {set.group}</span>
              <ul className="assess-opts2 assess-opts-sub">
                {set.opts.map((o, i) => (
                  <li key={i}>
                    <span className="assess-opt-lab">{o.display}</span>
                    <span>{o.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <ul className="assess-opts2">
            {opts.map((o, i) => (
              <li key={i}>
                <span className="assess-opt-lab">{o.label}</span>
                <span>{o.text}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
      <ATicks k="WHAT TO PRODUCE" items={n.format_of_output} />
      <AScaffold n={n} />
      {/* Task-setting part of the open-task guide — belongs to the question process
          (founder 2026-07-10); stays collapsed so the card isn't a wall on a phone. */}
      {n.open_task_guide ? (
        <details className="assess-otg">
          <summary>READING THIS TASK</summary>
          <div className="assess-otg-body">
            <ABlock k="FORMAT" text={[n.open_task_guide.format_type, n.open_task_guide.format_rationale].filter(Boolean).join(" — ")} />
            <ABlock k="WHAT THIS DEMONSTRATES" text={n.open_task_guide.what_this_demonstrates} />
            <ABlock k="READING THE SCAFFOLD" text={n.open_task_guide.reading_the_scaffold} />
          </div>
        </details>
      ) : null}
      {n.exercise_ref || n.exercise_desc ? (
        <div className="assess-look">
          <span className="assess-look-k">TEXTBOOK EXERCISE</span>
          <div className="assess-look-t">
            {/* The book item (book_ref) is bold; the task description follows in normal weight,
                IN QUOTATION MARKS — it is the textbook's own wording, and until 2026-08-20 it
                rendered unmarked, indistinguishable from Aruvi's prose. F2/C14: this surface
                carries a >12-word verbatim NCERT run 15.5% of the time (Aruvi's own prose:
                1.8%), which is what the companion is FOR — so the fix is to show the borrowing,
                not remove it. Mirrors `export_assessment_pdf.textbook_companion`; a description
                the author already quoted is left alone. */}
            {n.exercise_ref ? <strong className="assess-book-item">{n.exercise_ref}</strong> : null}
            {n.exercise_ref && n.exercise_desc ? " — " : null}
            {n.exercise_desc
              ? (/^["'“‘]/.test(n.exercise_desc.trim())
                  ? n.exercise_desc
                  : `“${n.exercise_desc.trim()}”`)
              : null}
          </div>
        </div>
      ) : null}
      </div>
      {nav}
    </div>
  );
}

function AAnswerPanel({ n, correct, opts = [], sets = null }) {
  // TRUE_FALSE: one verdict + reason per statement, from the engine's collapsed key. This
  // REPLACES both the "CORRECT ANSWER" tick-list (which showed only the true statements, a
  // misleading half-answer) and the standalone suggested-answer prose (already folded in).
  if (n.template === "true_false" && n.tf_statements?.length) {
    const hasReasons = n.tf_statements.some((s) => s.reason);
    // Fallback shape: the suggested-answer prose could NOT be split into per-statement reasons
    // (grouped like "Statements 2, 3 and 4 are TRUE", or an odd format), so the engine kept the
    // whole prose with the key's reasons empty. That prose already states every verdict — show
    // it ALONE, never beside a bare verdict list (that pairing was the residual duplication).
    if (!hasReasons && n.model_answer) {
      return <ABlock k="SUGGESTED ANSWER" text={n.model_answer} />;
    }
    // Aligned shape: the key carries marker · verdict · reason and IS the whole answer
    // (model_answer was folded away in the engine). Bare-verdict list only if neither survives.
    return (
      <div className="assess-look">
        <span className="assess-look-k">ANSWER KEY</span>
        <div className="assess-ansrows">
          {n.tf_statements.map((s, i) => (
            <div className="assess-tf-row" key={i}>
              {s.marker ? <span className="assess-ans-lab">{s.marker}</span> : null}
              <span className="assess-ans-t">
                <span className={s.verdict ? "assess-tf-t" : "assess-tf-f"}>
                  {s.verdict ? "True" : "False"}
                </span>
                {s.reason ? <> — {s.reason}</> : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <>
      {correct.length ? (
        <div className="assess-look">
          <span className="assess-look-k">CORRECT ANSWER</span>
          {/* A compound item has one correct answer PER sub-question. Naming which
              question each belongs to is the whole point — an unlabelled pair of ticks
              reads as a two-answer question. */}
          {correct.map((o, i) => {
            const set = sets?.find((s) => s.opts.some((x) => x.label === o.label));
            const shown = set ? set.opts.find((x) => x.label === o.label).display : o.label;
            return (
              <div className="assess-corr-row" key={i}>
                {set ? <span className="assess-corr-q">Q{set.group}</span> : null}
                <span className="assess-opt-lab">{shown}</span>
                <span>{o.text}<span className="assess-tickmark"> ✓</span></span>
              </div>
            );
          })}
        </div>
      ) : null}
      {n.template === "selected_response" ? (
        <>
          {/* TRUE_FALSE verdict+justification arrives as model_answer, not reveals. */}
          <AAnswerBlock k="ANSWER" n={n} />
          <AReveals reveals={n.option_reveals} opts={opts} sets={sets} />
        </>
      ) : n.template === "scr" ? (
        <>
          {n.model_answer
            ? <AAnswerBlock k="SUGGESTED ANSWER" n={n} />
            : <ATicks k="LOOK FOR" items={n.expected_elements} />}
          {/* Maths-only "how to solve" — method_one_line is null for other families, so
              ABlock renders nothing (no subject branch needed). */}
          <ABlock k="METHOD" text={n.method_one_line} />
        </>
      ) : n.template === "ecr" ? (
        <>
          <ATicks k="LOOK FOR" items={n.look_fors} />
          <ATicks k="EXPECTED ELEMENTS" items={n.expected_elements} />
          <AAnswerBlock k="SUGGESTED ANSWER" n={n} />
          <ABlock k="METHOD" text={n.method_one_line} />
        </>
      ) : n.template === "open_task" ? (
        <>
          <ATicks k="EXPECTED ELEMENTS" items={n.expected_elements} />
          <ATicks k="LOOK FOR" items={n.look_fors} />
        </>
      ) : n.template === "cloze_match" ? (
        <AAnswerBlock k="ANSWER KEY" n={n} />
      ) : n.template === "match" ? (
        n.match_pairs?.length ? (
          <div className="assess-look">
            <span className="assess-look-k">ANSWER KEY</span>
            <div className="assess-ansrows">
              {n.match_pairs.map((p, i) => (
                <div className="assess-match-row" key={i}>
                  <span className="assess-match-l">{p.left}</span>
                  <span className="assess-match-arw" aria-hidden="true">→</span>
                  <span className="assess-match-r">{p.right}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <AAnswerBlock k="ANSWER KEY" n={n} />
        )
      ) : n.template === "oral" ? (
        <ATicks k="SPEAKING RUBRIC" items={n.expected_elements} />
      ) : n.template === "numeric" ? (
        <>
          <AAnswerBlock k="WORKED ANSWER" n={n} />
          <ABlock k="METHOD" text={n.method_one_line} />
        </>
      ) : n.template === "passage" ? (
        <ATicks k="EXPECTED ELEMENTS" items={n.expected_elements} />
      ) : null}
    </>
  );
}

// Which tabs a normalized item offers (ANSWER / INCLUSIVITY only when populated),
// plus the derived option lists both panels need.
function itemTabSet(n) {
  const opts = (n.options || []).map((o, i) => ({ ...o, label: o.label || String.fromCharCode(65 + i) }));
  const correct = opts.filter((o) => o.is_correct);
  const hasAnswer = !!(correct.length || n.model_answer || n.expected_elements?.length
    || n.look_fors?.length || Object.keys(n.option_reveals || {}).length || n.method_one_line
    || n.tf_statements?.length || n.match_pairs?.length);
  return {
    // `opts` stays the FLAT list on purpose — hasAnswer above, and every non-compound
    // consumer, still read it. `sets` is the compound view layered on top, null otherwise.
    opts, correct, sets: groupedOptionSets(opts),
    tabs: [
      ["ov", "Overview"],
      ["q", "Question"],
      ...(hasAnswer ? [["an", "Answer"]] : []),
      ...(n.inclusivity ? [["inc", "Inclusivity"]] : []),
    ],
  };
}

/* Inclusivity prose with differentiation cues bolded. Three families:
 *   • Colon-LABELS ("Support: …; stretch: …", maths prep) — only a token followed by ":" is
 *     emphasised (a bare "support" in another subject's note stays plain) and it is normalised
 *     to a capitalised form so the pair reads matched. Middle maths adds "challenge:" here.
 *   • In-prose KEYWORD ("…a struggling student…", middle maths) — bolded WHERE it sits, casing
 *     left untouched (it is an adjective mid-sentence, not a label). Middle-maths only, via
 *     `mathsMiddle`, so no other subject's inclusivity prose is touched.
 *   • Secondary maths ("Support: … Challenge: …", via `mathsSecondary`) — both labels are
 *     colon-labelled/weighted, and the note is broken so each label starts its OWN row rather
 *     than running on continuously. */
function InclusivityText({ text, mathsMiddle = false, mathsSecondary = false }) {
  if (!text) return null;
  const labels = mathsMiddle ? "support|stretch|challenge"
    : mathsSecondary ? "support|challenge"
    : "support|stretch";
  // Bold colon-labels (title-cased) + middle-maths in-prose "struggling" within one chunk.
  const render = (chunk, keyBase) => {
    const parts = [`\\b(?:${labels})\\b(?=\\s*:)`];             // colon-labelled → title-cased
    if (mathsMiddle) parts.push(`\\b(?:struggling)\\b`);        // in-prose keyword → bold in place
    const re = new RegExp(`(${parts.join("|")})`, "gi");
    const out = [];
    let last = 0, m, k = 0;
    while ((m = re.exec(chunk)) !== null) {
      if (m.index > last) out.push(chunk.slice(last, m.index));
      const w = m[0];
      const isLabel = new RegExp(`^(?:${labels})$`, "i").test(w);  // labels capitalise; keywords don't
      const shown = isLabel ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w;
      out.push(<strong key={`${keyBase}-${k++}`}>{shown}</strong>);
      last = m.index + w.length;
    }
    out.push(chunk.slice(last));
    return out;
  };
  // Maths SECONDARY and MIDDLE: split before each "Support:"/"Challenge:" so the two land on
  // separate rows. Middle joined this on 2026-08-10 (S7): it authors inclusivity as a
  // {support, challenge} OBJECT, which used to reach the screen as a stringified Python dict
  // — braces, keys and quotes. The normalizer now flattens it to the same colon-labelled form
  // secondary emits, so the two stages read identically and this branch serves both.
  if (mathsSecondary || mathsMiddle) {
    const rows = text.split(/(?=\b(?:support|challenge)\s*:)/i).map((s) => s.trim()).filter(Boolean);
    if (rows.length > 1) {
      return <>{rows.map((r, i) => <div key={i} className="assess-inc-row">{render(r, i)}</div>)}</>;
    }
  }
  return <>{render(text, 0)}</>;
}

/* The item's ACTIVE PANEL only — no card chrome, no Q-number/type header (the pager
 * carries position; type lives in Overview). The item's tab BAR is rendered by
 * AssessPanel inside the frozen chrome group (see below), so `tab` arrives as a prop.
 * Legacy pre-contract items keep the old flat white card, whatever the tab. */
function AssessBody({ it, tab, qn, onNext, onTab, mathsMiddle = false, mathsSecondary = false }) {
  const n = it.normalized;
  const lo = n ? n.linked_lo : (it.meta?.linked_lo || it.implied_lo);
  // A light nudge so a teacher who reaches the bottom of an item doesn't miss that the unit
  // anchors more questions. Placed at the END of the Answer AND Inclusivity panels — the two
  // tabs a teacher tends to finish on (Answer almost always; Inclusivity is often skipped, so
  // the link rides both to catch either exit). Null on the last question / single-item units.
  // Bare inline element (founder 2026-07-16) so it rides the panel's LAST row, dropping to
  // its own right-aligned line only when that row is full — same as the forward tab nav.
  const nextQ = onNext ? (
    <span className="assess-tabnav" role="button" tabIndex={0} onClick={onNext}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNext(); } }}>
      Next question →
    </span>
  ) : null;
  // `qn` (Q1., Q2., …) is set ONLY when the unit anchors more than one item. FLOATED
  // (never a full row) so it shares the line with each panel's opening words —
  // Learning outcome / stem / answer / inclusivity — and the teacher always knows
  // which question the panel belongs to.
  const qmark = qn ? <span className="assess-qmark">Q{qn}.</span> : null;
  if (!n || !n.template) {
    return (
      <div className="assess-card">
        {qmark}
        {lo ? (
          <div className="assess-lo">
            <span className="assess-lo-k">LEARNING OUTCOME</span>
            <div className="assess-lo-t">{lo}</div>
          </div>
        ) : null}
        <ALegacyCard it={it} />
      </div>
    );
  }
  const set = itemTabSet(n);
  const { opts, correct, sets } = set;
  const hasTab = (id) => set.tabs.some(([t]) => t === id);
  // Forward tab nav (founder 2026-07-16): a right-aligned link carrying the teacher to the
  // next window — Overview → Question, Question → Answer. Same pine-mono look as "Next
  // question →". A BARE inline element so it can ride the panel's LAST row, dropping to its
  // own right-aligned line only when that row is already full (CSS: flex-wrap). Shown only
  // when the target tab exists.
  const tabNav = (id, label) => (onTab && hasTab(id) ? (
    <span className="assess-tabnav" role="button" tabIndex={0} onClick={() => onTab(id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTab(id); } }}>
      {label} →
    </span>
  ) : null);
  return (
    <div className="assess-flat">
      {qmark}
      {tab === "ov" ? <AOverviewPanel n={n} lo={lo} nav={tabNav("q", "Question")} /> : null}
      {tab === "q" ? <AQuestionPanel n={n} opts={opts} sets={sets} nav={tabNav("an", "Answer")} /> : null}
      {tab === "an" ? (
        <div className="assess-qnavwrap">
          <div className="assess-qnavmain"><AAnswerPanel n={n} correct={correct} opts={opts} sets={sets} /></div>
          {nextQ}
        </div>
      ) : null}
      {tab === "inc" ? (
        <div className="assess-qnavwrap">
          <div className="assess-qnavmain assess-inc"><InclusivityText text={n.inclusivity} mathsMiddle={mathsMiddle} mathsSecondary={mathsSecondary} /></div>
          {nextQ}
        </div>
      ) : null}
    </div>
  );
}

/* ── Chapter Notes — the notebook popup (arch-plan §I-bis). The teacher's ONE writable
 * surface on an otherwise read-only plan: a school-ruled notebook keyed to the PLAN ASSET
 * (subject·grade·chapter, section-independent) so the SAME note surfaces in preview (My
 * Lessons) and in tracking — one record at two altitudes, nothing to sync. It now DOUBLES as
 * the section notebook too (the separate per-unit section note was removed 2026-07-23 — one
 * surface, less to confuse). Grey guidance rides the ruled lines as the field's placeholder →
 * vanishes on the first keystroke. Soft 500-word cap (the counter turns clay past it, never
 * blocks). localStorage today; migrates to the per-tenant overlay (CLOUD_DATA_MODEL §2.3) at
 * Phase 4, alongside the pointer. */
const CN_CAP = 500;
const cnWordCount = (s) => { const t = (s || "").trim(); return t ? t.split(/\s+/).length : 0; };
const CN_GUIDE =
  "For next year, jot what you'll want to remember:\n" +
  "  · where the class generally struggled\n" +
  "  · materials you brought in beyond the book\n" +
  "  · what to do differently next time\n" +
  "  · anything specific to a section you want to recall";
// "Subject · Grade" for the modal header — subject title-cased, grade in Roman numerals.
const CN_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
function cnSubjectGrade(lp) {
  const subj = String(lp.subject || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const gm = String(lp.grade || "").match(/\d+/);
  const grade = gm
    ? (CN_ROMAN[parseInt(gm[0], 10)] || gm[0])
    : String(lp.grade || "").replace(/grade|class/gi, "").trim().toUpperCase();
  return [subj, grade].filter(Boolean).join(" · ");
}

/* `readOnly` = her subscription has lapsed (founder, 2026-08-26). She can still READ
   every note she wrote — nothing is taken away, and they export with her plans — but
   note-taking is part of Aruvi's working half, alongside the tracker and the profile,
   so it stops until she renews. The server refuses the write regardless; this just
   makes the UI say so instead of failing silently. */
function ChapterNotesModal({ chapterTitle, subjectGrade, initial, onSave, onClose,
                             readOnly = false }) {
  const [text, setText] = useState(initial || "");
  const taRef = useRef(null);
  useEffect(() => { if (!readOnly) taRef.current?.focus(); }, [readOnly]);
  const wc = cnWordCount(text);
  // Hard cap: block input that would push past 400 words; deletions/edits still allowed
  // (only reject when the new value grows the count beyond the cap).
  const changeText = (e) => {
    const v = e.target.value;
    if (cnWordCount(v) > CN_CAP && cnWordCount(v) > wc) return;
    setText(v);
  };
  return (
    /* ★ THIS WINDOW IS CENTRED, AND THE PHONE'S IS NOT — a NAMED divergence (founder,
       2026-09-17, answering Q20). The phone opens the same panel BELOW its top bar, because a
       panel covering the app's own nav leaves one way out of itself; a desktop has no such bar
       to preserve and a centred card reads as the modal it is. Both stand; neither is a bug.
       See `mobile/components/lesson/ChapterOrg.jsx` for the other half of this note. */
    <div className="cn-modal-bg" onClick={onClose}>
      <div className="cn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cn-head">
          <div className="cn-head-t">
            <div className="kicker kicker-soft">Chapter notes</div>
            <div className="cn-title">{chapterTitle}</div>
            {subjectGrade ? <div className="cn-sg">{subjectGrade}</div> : null}
            {/* ★ THE TWO SCOPE LINES ARE GONE (founder, 2026-09-14, from the phone): the window
                had grown to five lines of preamble above a writing area she opens in order to
                WRITE. "Shared across every section on this plan" was pure scope information.
                The second was the Step-3 disclosure — "holding her notes server-side is
                legitimate because she is TOLD" — written on 2026-08-22, BEFORE the privacy
                notice existed. The notice now carries it almost verbatim in its own data table
                ("Saved to your account so your note opens on any device. There is no version
                history…"), is given at or before collection as DPDP §5 requires, and is linked
                from the front door. The inline line was reinforcement, not the disclosure
                itself. ⚠️ If that row ever leaves the notice, this line has to come back. */}
            {/* CHILD-PRIVACY WARNING (founder, 2026-08-26). Notes are free text a teacher
                writes right after class, which is exactly the moment she might name a
                child. Aruvi holds these on the server, so the boundary has to be stated
                where she types, not buried in a policy page. Wording is the founder's. */}
            <div className="cn-scope cn-warn">
              Private data like name, age of child must not be recorded. Meyy reserves
              right to delete if entered.
            </div>
          </div>
          <button className="cn-x" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <textarea
          ref={taRef}
          className="cn-paper"
          spellCheck={false}
          value={text}
          onChange={changeText}
          readOnly={readOnly}
          placeholder={readOnly ? "No notes were written for this chapter." : CN_GUIDE}
        />
        {readOnly ? (
          <div className="cn-foot">
            <div className="cn-foot-l">
              <span className="cn-count">Renew to write notes — what you wrote stays yours.</span>
            </div>
            <button className="cn-save" onClick={onClose}>Close</button>
          </div>
        ) : (
        <div className="cn-foot">
          <div className="cn-foot-l">
            {/* ★ RENAMED FROM "Speak" (founder, 2026-09-17, answering Q18). It never listened:
                it focuses the writing area, and the dictation belongs to the operating system's
                own mic. ⚠️ On the WEB that leaves the button close to a no-op — focusing a
                textarea offers a desktop user nothing, and there is no keyboard mic to point
                at. Recorded, not resolved: whether it should exist here at all is a separate
                call from what it should be called. */}
            <button className="cn-speak" onClick={() => taRef.current?.focus()}
              aria-label="Start writing — then use your system's dictation to speak">
              <svg className="cn-speak-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
              Dictate
            </button>
            <span className={`cn-count${wc >= CN_CAP ? " over" : ""}`}>{wc} / {CN_CAP} words</span>
          </div>
          <button className="cn-save" onClick={() => onSave(text)}>Save</button>
        </div>
        )}
      </div>
    </div>
  );
}

/* Science SECONDARY section anchors carry a leading NCF section number, in either notation:
 * a bare number ("8.1 Rediscovering the Roots of Atomic Theory", "8.2 … / 8.2.1 …") or a
 * "Section N.N — Title" label ("Section 2.1 — The Challenge of Studying Cells"). On the
 * Chapter Organization page the title alone is enough — strip the number (and any leading
 * "Section" word / dash separator) from each " / "-joined segment. A pure-number anchor with
 * no title (e.g. "2.1") keeps its number; a trailing " (Revisit)" is preserved
 * (founder 2026-07-14). */
function sectionTitleOnly(label) {
  if (!label) return label;
  const cleaned = label.split(" / ").map((seg) => {
    const s = seg.trim();
    const stripped = s.replace(/^(?:Section\s+)?\d+(?:\.\d+)*\s*[—–:.)-]?\s*/i, "").trim();
    return stripped || s;   // number-only segment → keep as-is
  }).join(" / ");
  return cleaned || label;
}

/* Social Sciences competency labels run long ("C-2.1 — Explains and analyses major changes
 * in the past and their impact on society"). On the Chapter Organization page we show only
 * the first N whitespace tokens (the C-X.Y code counts as one) + an ellipsis while the
 * competency accordion is COLLAPSED; opening it reveals the full text (founder 2026-07-14). */
function truncateWords(text, n) {
  const words = String(text || "").trim().split(/\s+/);
  if (words.length <= n) return text;
  return words.slice(0, n).join(" ") + " …";
}

/* ── Social Sciences FLOW VIEW (edge model, founder-picked concept 2026-07-15;
 * spec docs/mockups/ss-chapter-organization.html, Concept 4). Under the rewritten SS
 * constitutions a unit carries ZERO/ONE/MANY competency edges, so competency is no longer
 * a grouping spine — the Chapter Organization body becomes a bipartite map: units (the
 * teaching order, left) ↔ the chapter's competency set (right), SVG ribbons between.
 * Ribbons are CONNECTIONS, never time — a unit's minutes are never divided across its
 * edges (weights are emphasis, not arithmetic) — so ribbon width follows the weight TIER
 * (Central/Substantive/Present, shown as plain name + the allocation report's dots, never
 * a tier colour; colour is reserved for competency IDENTITY). Tap either side to focus:
 * only that node's ribbons draw, a popup opens below it (competency → its full text;
 * unit → number · full title · minutes, plus the "open unit →" navigation — tap-to-focus
 * replaces tap-to-open here, so navigation moved INTO the popup). Zero-edge units show a
 * quiet "—": taught in full, builds no LO, by design (rewrite brief §2.5). */
const SS_TIER_OF = (w) => (Number(w) >= 3 ? "Central" : Number(w) === 2 ? "Substantive" : "Present");
const SS_TIER_DOTS = { Central: "●●●", Substantive: "●●", Present: "●" };
const SS_RIBBON_W = { Central: 5, Substantive: 3.5, Present: 2.5 };
// Identity palette, assigned in ledger order (weight desc, reach desc): pine, clay, ochre,
// then the two SS-flow additions (slate, plum). SS mappings run ~5 primaries; a 6th+
// competency falls back to ink-soft rather than inventing more hues.
const SS_FLOW_COLORS = ["var(--pine)", "var(--clay)", "var(--ochre)", "var(--ss-slate)", "var(--ss-plum)", "var(--ink-soft)"];

function SSFlowBody({ units, pointer, doneAll, onOpenUnit, gapNote }) {
  const [focus, setFocus] = useState(null);           // null | {t:'u'|'c', id}
  const wrapRef = useRef(null);
  const unitsColRef = useRef(null);
  const compsColRef = useRef(null);
  const [paths, setPaths] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Wheeling is a FALLBACK, not the default (founder 2026-07-15): a unit-focus popup shows
  // its FULL text unless the open boxes would outgrow the unit column ("hit" the cards
  // below) — only then do the popups collapse to capped scroll-wheels. Detected by a
  // measure pass: render full first; if the competency column's content ends up taller
  // than the unit column's, flip wheelOn and re-render. Reset on every focus change.
  const [wheelOn, setWheelOn] = useState(false);
  const focusTo = (f) => { setWheelOn(false); setFocus(f); };

  // The chapter's competency ledger, derived from the units' edges (weight desc, then
  // reach desc, then code) — the SAME set the mapping settled; never re-selected here.
  const comps = useMemo(() => {
    const map = new Map();
    units.forEach((u, i) => (u.meta?.competency_edges || []).forEach((e) => {
      if (!e || !e.c_code) return;
      if (!map.has(e.c_code)) {
        map.set(e.c_code, { code: e.c_code, weight: Number(e.weight) || 1,
          text: e.competency_text || "", units: [] });
      }
      map.get(e.c_code).units.push(i);
    }));
    const list = [...map.values()];
    list.sort((a, b) => b.weight - a.weight || b.units.length - a.units.length
      || String(a.code).localeCompare(String(b.code)));
    list.forEach((c, k) => {
      c.tier = SS_TIER_OF(c.weight);
      c.color = SS_FLOW_COLORS[Math.min(k, SS_FLOW_COLORS.length - 1)];
    });
    return list;
  }, [units]);
  const byCode = useMemo(() => Object.fromEntries(comps.map((c) => [c.code, c])), [comps]);

  // Ribbons: measured AFTER layout (popups push content, so re-measure on every focus
  // change) — from each unit row's right edge to its competency card's left edge.
  const measure = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // NO automatic wheeling (founder, live-verified 2026-07-15): popups in this layout PUSH
    // the cards — a box can never physically hit another — and on phone-width viewports the
    // competency texts are long enough that ANY height threshold (unit column, viewport)
    // trips for every multi-edge unit, capping texts the teacher wanted to read. So open
    // popups always show FULL text; the page grows and scrolls. The wheel markup/CSS
    // (`wheelOn`, .cof-pop-wheel) is kept dormant should a genuine collision case appear.
    const wr = wrap.getBoundingClientRect();
    const uPos = {}, cPos = {};
    wrap.querySelectorAll("[data-cof-u]").forEach((r) => {
      const b = r.getBoundingClientRect();
      uPos[r.getAttribute("data-cof-u")] = { x: b.right - wr.left, y: b.top - wr.top + b.height / 2 };
    });
    wrap.querySelectorAll("[data-cof-c]").forEach((r) => {
      const b = r.getBoundingClientRect();
      cPos[r.getAttribute("data-cof-c")] = { x: b.left - wr.left, y: b.top - wr.top + b.height / 2 };
    });
    const out = [];
    units.forEach((u, i) => (u.meta?.competency_edges || []).forEach((e) => {
      const a = uPos[i], b = cPos[e.c_code], comp = byCode[e.c_code];
      if (!a || !b || !comp) return;
      const hot = !focus || (focus.t === "c" && focus.id === e.c_code) || (focus.t === "u" && focus.id === i);
      const dx = (b.x - a.x) * 0.5;
      out.push({ d: `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`,
        color: comp.color, w: SS_RIBBON_W[comp.tier], o: hot ? (focus ? 0.75 : 0.28) : 0.05 });
    }));
    setPaths(out);
    setSize({ w: wr.width, h: wr.height });
  };
  /* eslint-disable react-hooks/exhaustive-deps */
  useLayoutEffect(() => { measure(); }, [focus, units, comps, wheelOn]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const pad2 = (n) => String(n).padStart(2, "0");
  return (
    <>
      {/* ★ THE INSTRUCTION READS FIRST (founder, 2026-09-17, web + phone alike). It sat UNDER
          the map, which on a narrow viewport is below the fold — the one line telling her the
          two columns are tappable arrived after she had already decided they were not. It is
          also PERMANENT now rather than gated on `!focus` as it was at the foot: a line that
          vanishes costs nothing at the bottom of a page and would jerk the whole map upward on
          the first tap at the top of one. */}
      <div className="cof-hint">Tap a unit or a competency to follow its connections</div>
      {/* Navigation now lives on each unit row (the per-title "→", founder 2026-07-16). The
          old top-pinned "open unit NN →" button is retired — the row arrows replace it. */}
      <div className="cof-wrap" ref={wrapRef}>
        <svg className="cof-svg" width={size.w} height={size.h} aria-hidden="true">
          {paths.map((p, k) => (
            <path key={k} d={p.d} fill="none" style={{ stroke: p.color }}
              strokeWidth={p.w} strokeOpacity={p.o} strokeLinecap="round" />
          ))}
        </svg>
        <div className="cof-units" ref={unitsColRef}>
          {units.map((u, i) => {
            const st = pointer == null ? "" : (doneAll || i < pointer) ? "done" : i === pointer ? "cur" : "";
            const edges = u.meta?.competency_edges || [];
            const dimmed = focus && ((focus.t === "c" && !edges.some((e) => e.c_code === focus.id))
              || (focus.t === "u" && focus.id !== i));
            const open = focus && focus.t === "u" && focus.id === i;
            return (
              <div key={i}>
                <div className={`cof-u ${st}${dimmed ? " dim" : ""}`} data-cof-u={i}
                  onClick={() => focusTo(open ? null : { t: "u", id: i })}>
                  <span className="cof-num">{pad2(i + 1)}</span>
                  <span className="cof-utitle">{(u.title || `Unit ${i + 1}`).split(":")[0]}</span>
                  {edges.length ? null : <span className="cof-noedge">—</span>}
                  {/* Direct open — a "→" beside the title jumps straight into the unit
                      (founder 2026-07-16), independent of tap-to-focus (which draws ribbons).
                      stopPropagation so the row's focus handler doesn't also fire. */}
                  <button className="cof-uopen" aria-label={`Open unit ${pad2(i + 1)}`}
                    onClick={(e) => { e.stopPropagation(); onOpenUnit(i); }}>→</button>
                </div>
                {/* Lifted-note popup (founder-picked style A, 2026-07-15): paper-white card,
                    soft lift shadow, 3px LEFT identity rule — unit popups take their STATE
                    colour (clay = now, pine = taught, hairline = ahead).
                    The popup IS a second door into the unit (founder 2026-08-04): tapping the
                    expanded name box opens it, exactly as the row's "→" does. The row tap keeps
                    its own job (focus → ribbons + this box); only the box navigates. */}
                {open ? (
                  <div className="cof-pop cof-pop-open" role="button" tabIndex={0}
                    title={`Open unit ${pad2(i + 1)}`}
                    onClick={(e) => { e.stopPropagation(); onOpenUnit(i); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onOpenUnit(i); }
                    }}
                    style={{ borderLeftColor:
                      st === "cur" ? "var(--clay)" : st === "done" ? "var(--pine)" : "var(--line)" }}>
                    <span className="cof-pop-k">{pad2(i + 1)}</span> · {u.title || `Unit ${i + 1}`}
                    {u.meta?.duration_minutes ? ` · ${u.meta.duration_minutes} min` : ""}
                    <span className="cof-pop-go" aria-hidden="true">→</span>
                    {!edges.length ? (
                      <div className="cof-pop-quiet">Taught in full — builds no competency edge, by design</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="cof-comps" ref={compsColRef}>
          {comps.map((c) => {
            const dimmed = focus && ((focus.t === "c" && focus.id !== c.code)
              || (focus.t === "u" && !c.units.includes(focus.id)));
            const open = focus && focus.t === "c" && focus.id === c.code;
            // Focusing a UNIT also opens the popups of every competency it connects to
            // (founder 2026-07-15). They show FULL text; only when the open boxes would
            // outgrow the unit column (the measured wheelOn fallback above) do they cap
            // into scroll-wheels. A direct competency tap is always full-height.
            const openViaUnit = !open && focus && focus.t === "u" && c.units.includes(focus.id);
            return (
              <div key={c.code}>
                {/* Stacked card (founder 2026-07-15): code → tier name → prominent dots.
                    No unit count — the ribbons say where it lives. */}
                <div className={`cof-c${dimmed ? " dim" : ""}`} data-cof-c={c.code}
                  onClick={() => focusTo(open ? null : { t: "c", id: c.code })}>
                  <span className="cof-code" style={{ color: c.color }}>{c.code}</span>
                  <span className="cof-tiername">{c.tier}</span>
                  <span className="cof-dots">{SS_TIER_DOTS[c.tier]}</span>
                </div>
                {/* Competency popup: the left rule takes the tapped thread's identity colour. */}
                {open || (openViaUnit && !wheelOn) ? (
                  <div className="cof-pop" style={{ borderLeftColor: c.color }}>{c.text}</div>
                ) : openViaUnit ? (
                  <div className="cof-pop cof-pop-wheel" style={{ borderLeftColor: c.color }}>
                    <div className="cof-pop-scroll">{c.text}</div>
                    <div className="cof-pop-fade" aria-hidden="true" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {gapNote ? <div className="cof-gap">{gapNote}</div> : null}
    </>
  );
}

/* ── Chapter Organization — the chapter's front door (chapter altitude, arch-plan §E).
 * The My Classes section card, opened up: the same tick rail expands into one card per
 * unit (pine = taught · ochre = now · hairline = ahead), grouped under quiet mono
 * dividers from the plugin's Group tree. Tapping a card is NAVIGATION, never pointer
 * movement. `pointer` is the live unit index, or null (preview — no place-marker). */
function ChapterOrg({ lp, units, pointer, doneAll, onOpenUnit, onBack, backTour }) {
  /* Notes lock when the subscription lapses (founder, 2026-08-26). Asked here rather
     than threaded down as a prop: LessonView is reached from two surfaces by different
     routes, and the entitlement is one cheap cached read. Unknown → not locked; the
     server is the authority either way. */
  const [notesLocked, setNotesLocked] = useState(false);
  useEffect(() => {
    let live = true;
    fetchEntitlement().then((e) => { if (live && e) setNotesLocked(!!e.lapsed); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  // Chapter Notes state — asset-keyed (NOT the per-section pointer key), so preview and
  // tracking, and every section, read/write ONE shared note (arch-plan §I-bis).
  // Per-user scope (userKey appends _{user}) so chapter notes never bleed across teachers on
  // a shared browser — the asset key alone (subject·grade·chapter) is identical across users.
  //
  // SERVER-BACKED as of 2026-08-22 (admin architecture Step 3): the note is a year-scoped
  // per-tenant record — ONE note per chapter per academic year — and localStorage is now the
  // optimistic CACHE, same pattern as section state. On mount: show the cache instantly,
  // then reconcile from GET /plan-notes (server wins); a cache-only note with no server copy
  // is a legacy browser-only note and is MIGRATED UP once, so nothing she wrote before this
  // landed is stranded. On save: cache + POST; a 409 (stale write from another device) adopts
  // the server's newer copy instead of clobbering it (§2.4 — timestamp, not history).
  const notesKey = userKey(`chapter_notes_${lp.subject}_${lp.grade}_${lp.chapter_title || ""}`);
  // The server key uses the chapter NUMBER (stable identity); title only as a fallback for
  // plans without one. Must stay in sync with api/main.py's _note_key.
  const noteChapter = lp.chapter_number ? String(lp.chapter_number) : (lp.chapter_title || "");
  const [noteText, setNoteText] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.localStorage.getItem(notesKey) || "";
    setNoteText(cached);
    let dead = false;
    fetchPlanNotes().then((notes) => {
      if (dead || notes === null) return;          // server unreachable → keep the cache
      const srv = notes[planNoteKey(lp.subject, lp.grade, noteChapter)];
      if (srv && typeof srv.text === "string") {
        setNoteText(srv.text);                      // server is authoritative
        try {
          if (srv.text.trim()) window.localStorage.setItem(notesKey, srv.text);
          else window.localStorage.removeItem(notesKey);
        } catch {}
      } else if (cached.trim()) {
        savePlanNote(lp.subject, lp.grade, noteChapter, cached);  // one-time legacy lift
      }
    });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesKey]);
  const saveNote = (t) => {
    setNoteText(t);
    if (typeof window !== "undefined") {
      if (t.trim()) window.localStorage.setItem(notesKey, t);
      else window.localStorage.removeItem(notesKey);
    }
    savePlanNote(lp.subject, lp.grade, noteChapter, t).then((res) => {
      if (res && res.stale && res.note && typeof res.note.text === "string") {
        // Another device wrote a fresher note — adopt it, never overwrite it.
        setNoteText(res.note.text);
        try {
          if (res.note.text.trim()) window.localStorage.setItem(notesKey, res.note.text);
          else window.localStorage.removeItem(notesKey);
        } catch {}
      }
    });
    setNotesOpen(false);
  };
  const hasNote = !!noteText.trim();
  // Total units under a group (its own periods + all descendants) — shown on the group header,
  // and used to work out which top-level group holds the current pointer unit.
  const countUnits = (g) => (g.periods?.length || 0) + (g.children || []).reduce((s, c) => s + countUnits(c), 0);
  // Which top-level group holds the pointer (current) unit — so opening chapter-org from a unit
  // lands on the group you're teaching, not always the first (founder 2026-07-23; the SS flow
  // view already surfaces "now" because it lists every unit flat). Null pointer (My Lessons
  // preview) → first group, unchanged.
  const groupOfPointer = () => {
    if (pointer == null) return 0;
    let acc = 0;
    const gs = lp.groups || [];
    for (let gi = 0; gi < gs.length; gi++) {
      const c = countUnits(gs[gi]);
      if (pointer < acc + c) return gi;
      acc += c;
    }
    return 0;
  };
  // Each top-level group is a collapsible drop-down; only ONE is open at a time (accordion).
  // Defaults to the group holding the current unit (falls back to the first); opening another
  // closes the rest (re-tapping the open one collapses it). -1 = all closed.
  const [openIdx, setOpenIdx] = useState(groupOfPointer);
  // On open, bring the current ("now") unit into view — matching the SS flow view, which
  // already surfaces its highlighted unit. Runs once after mount; the right accordion group is
  // already expanded (groupOfPointer), so the card is in the DOM. Only in tracking (pointer set).
  useEffect(() => {
    if (pointer == null || typeof window === "undefined") return;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(".co-view .co-card.cur, .co-view .cof-u.cur");
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Maths PREPARATORY is the one subject·stage with no real section axis: its periods carry
  // many-to-many markers (S2+S3, S3+S4…) that can't cleanly nest, so the normalizer collapses
  // every period into a single fallback group labelled "Lesson" (see mathematics/subject.py).
  // For that one case we DON'T show the pointless one-item accordion — we render the units flat
  // under the chapter header inside a fixed-height "wheel" window (~4 units); units beyond the
  // fold are reached by scrolling INSIDE that region (founder 2026-07-13, replacing the earlier
  // click-to-reveal link). "Lesson" (the exact fallback string) is unique to the maths middle/
  // prep branch and only actually fires for prep, so it's a safe, precise signature.
  const mathsFlat = lp.subject === "mathematics" && (lp.groups || []).length === 1
    && lp.groups[0]?.label === "Lesson";
  // Social Sciences EDGE-MODEL plans (competency_edges per unit; SS port emits ONE flat
  // "unit" group flagged meta.edge_model) render the bipartite FLOW VIEW instead of the
  // accordion — competency is a many-to-many overlay there, not a grouping axis. Old
  // single-competency SS plans keep the competency accordion below unchanged.
  const ssFlow = lp.subject === "social_sciences" && (lp.groups || []).length === 1
    && !!lp.groups[0]?.meta?.edge_model;
  const FLAT_SHOWN = 4;   // units shown before the window starts scrolling
  // Rebuild the group walk so cards sit under their group bars (flat index kept in sync
  // with flattenUnits — same traversal order). `visible` gates rendering but NOT the flat
  // index: idx advances across every period of every group (open or collapsed) so a unit's
  // number matches the pointer regardless of which drop-down is expanded.
  let idx = -1;
  const renderGroup = (g, depth, keyPrefix, visible) => {
    const bars = [];
    if (visible && g.label) {
      bars.push(
        <div className="co-groupbar" key={`${keyPrefix}-bar`}>
          <span className="co-subname">{lp.subject === "science" && g.type === "section" ? sectionTitleOnly(g.label) : g.label}</span>
        </div>
      );
    }
    if (g.periods?.length) {
      const cards = g.periods.map((p, i) => {
        idx += 1;
        const n = idx;
        if (!visible) return null;
        const status = pointer == null ? "" : (doneAll || n < pointer) ? "done" : n === pointer ? "cur" : "up";
        const dur = p.meta?.duration_minutes;
        return (
          <div className={`co-card ${status}`} key={i} onClick={() => onOpenUnit(n)}>
            <span className="co-num">{n + 1}.</span>
            <div className="co-body"><div className="co-utitle">{p.title || `Unit ${n + 1}`}</div></div>
            <div className="co-side">
              {status === "cur" ? <span className="co-now">now</span> : null}
              {dur ? <span className="co-dur"><span className="co-dur-n">{dur}</span><span className="co-dur-u">min</span></span> : null}
              {status === "done" ? <span className="co-mark">✓ taught</span> : null}
            </div>
            {/* "→" at the capsule's right end — signals the card leads into the unit
                (founder 2026-07-16, matching the SS map's per-row arrow). The whole card
                is the click target, so this is a non-interactive cue. */}
            <span className="co-go" aria-hidden="true">→</span>
          </div>
        );
      });
      if (visible) bars.push(<div className="co-list" key={`${keyPrefix}-list`}>{cards}</div>);
    }
    (g.children || []).forEach((c, i) => bars.push(...renderGroup(c, depth + 1, `${keyPrefix}-${i}`, visible)));
    return bars;
  };

  const total = units.length;
  const taught = pointer == null ? 0 : doneAll ? total : pointer;
  // Duration breakdown for the meta line, e.g. "2 units × 35 min · 1 unit × 45 min"
  // (grouped by each unit's period duration, shortest first).
  const durCounts = {};
  units.forEach((u) => { const d = u.meta?.duration_minutes; if (d) durCounts[d] = (durCounts[d] || 0) + 1; });
  // Period combination, stacked one per line, e.g. "3 × 40 min" / "4 × 50 min"
  // (grouped by duration, shortest first).
  const durParts = Object.entries(durCounts)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([d, c]) => `${c} × ${d} min`);
  // The organizing axis (or axes) of this chapter — the type of the top-level groups, plus any
  // nested grouping type. Named + explained below the header rule so the teacher knows what the
  // drop-downs represent. Each blurb carries a DEFINITE BUT MILD nod to the NCF (founder
  // 2026-07-13): the reference is made only where the axis genuinely reflects NCF pedagogy —
  // Science's staged inquiry (§4.6.1), the NCF's competency-based design (Social Sciences), and
  // the integrated language-skills the NCF asks of languages (English spine). Section is the
  // most structural axis, so its nod is the lightest (graded, build-from-the-familiar sequencing).
  const AXIS_INFO = {
    stage: ["Stages", "the learning progression each group moves through, from first contact to confident practice — the staged, inquiry-led sequence the NCF asks of Science."],
    progression_stage: ["Stages", "the learning progression each group moves through, from first contact to confident practice — the staged, inquiry-led sequence the NCF asks of Science."],
    section: ["Sections", "the parts of the chapter, taught in the graded, build-from-the-familiar sequence the NCF encourages."],
    competency: ["Competencies", "the skill each group of units builds — the competency-based design at the heart of the NCF."],
    spine: ["Spines", "the language skills the units develop together, in the integrated way the NCF asks languages to be taught."],
  };
  const axisTypes = [];
  const collectAxis = (groups) => (groups || []).forEach((g) => {
    if (g.type && AXIS_INFO[g.type] && !axisTypes.includes(g.type)) axisTypes.push(g.type);
    collectAxis(g.children);
  });
  collectAxis(lp.groups);
  /* Axis legend — names the organizing axis + a small explanation. Maths PREP (the flat
     case) has no group axis, but the legend must not simply vanish (founder 2026-07-14) —
     it gets its own row; same for the SS flow view ("The map"). The legend shares its row
     with the Chapter Notes bookmark: the text column is narrowed, freeing a committed right
     gutter the tab rides (founder 2026-07-14). Normally frozen with the header
     (founder 2026-07-11); in the SS flow view it SCROLLS instead (founder 2026-07-15) —
     see the placement below. */
  const axisWrap = (
    <div className="co-axiswrap">
      <div className="co-axis">
        {ssFlow ? (
          <div className="co-axis-row">
            <span className="co-axis-name">The map</span>
            <span className="co-axis-blurb">every line connects a unit to an NCF competency it genuinely builds — the competency-based design at the heart of the NCF. Tap either side to follow its connections.</span>
          </div>
        ) : mathsFlat ? (
          <div className="co-axis-row">
            <span className="co-axis-name">Units</span>
            <span className="co-axis-blurb">one continuous run of learning units in the textbook&apos;s own teaching order — the activity-led, play-way flow the NCF asks of the preparatory stage. Tap a unit to open it.</span>
          </div>
        ) : axisTypes.length ? (
          axisTypes.map((t) => (
            <div className="co-axis-row" key={t}>
              <span className="co-axis-name">{AXIS_INFO[t][0]}</span>
              <span className="co-axis-blurb">{AXIS_INFO[t][1]} Click each card to access units underneath.</span>
            </div>
          ))
        ) : null}
      </div>
      {/* Vertical bookmark in the gutter — no icon/dot (kept short so it doesn't outrun
          the paragraph height); always the solid ochre fill. */}
      <button
        className="co-notetab"
        onClick={() => setNotesOpen(true)}
        aria-label={hasNote ? "Chapter notes — edit" : "Chapter notes — add"}
        title={hasNote ? noteText.trim() : "Chapter notes"}
      >
        <span className="co-notetab-label">Notes</span>
      </button>
    </div>
  );
  return (
    <div className="lessonview co-view" data-subject={lp.subject || ""}>
      {/* Frozen header — stays pinned down through the meta row; the unit list scrolls under it.
          data-tour="preview-back" (preview only): the guided tour's step-6 hand sits on the exit. */}
      <div className="co-stick">
        <div className="co-topbar">
          {/* {subject} · {class as Roman} · Ch. NN (founder 2026-07-10). */}
          <span className="kicker kicker-soft co-topkick">
            {String(lp.subject || "").replace(/_/g, " ")}
            {lp.grade ? `·${String(lp.grade).replace(/grade|class/gi, "").trim().toUpperCase()}` : ""}
            {lp.chapter_number ? `·Ch. ${String(lp.chapter_number).padStart(2, "0")}` : ""}
          </span>
          <button className="back back-tr" data-tour={backTour} onClick={onBack}>← back</button>
        </div>
        <div className="co-head">
          <div className="co-title">{lp.chapter_title}</div>
          <div className="co-meta">
            {total} Learning Unit{total !== 1 ? "s" : ""}{durParts.length ? ` ${durParts.join(". ")}` : ""}
          </div>
          {/* No tick rail in the SS flow view (founder 2026-07-15): the unit rows already
              carry taught/now states, so the header progress bar is redundant there. */}
          {pointer != null && !ssFlow ? (
            <div className="co-rail" aria-label={`${taught} of ${total} units taught`}>
              {units.map((_, i) => (
                <span key={i} className={`co-tick ${doneAll || i < pointer ? "done" : i === pointer ? "cur" : ""}`} />
              ))}
            </div>
          ) : null}
        </div>
        {/* Hairline divider under the meta — frozen with the header. */}
        <div className="co-headrule" aria-hidden="true"></div>
        {/* Axis legend + Notes tab: frozen with the header for every subject EXCEPT the SS
            flow view (founder 2026-07-15) — there the freeze ends at the hairline above, and
            the "The map" blurb + Notes tab scroll away with the unit list (rendered after
            co-stick below). */}
        {ssFlow ? null : axisWrap}
      </div>
      {ssFlow ? axisWrap : null}
      {ssFlow ? (
        <SSFlowBody
          units={units}
          pointer={pointer}
          doneAll={doneAll}
          onOpenUnit={onOpenUnit}
          gapNote={(lp.meta && lp.meta.competency_gap_note) || ""}
        />
      ) : mathsFlat ? (
        /* Maths prep — no axis: units flat under the header (no "Lesson" bucket header —
           founder 2026-07-13: remove the word). Beyond 4 units the list lives in a capped
           "wheel" window that scrolls internally; a soft bottom fade hints "more below".
           Flat idx = card order, so pointer status maps 1:1 to the unit. */
        (() => {
          const periods = lp.groups[0].periods || [];
          const list = (
            <div className="co-list">
              {periods.map((p, i) => {
                const n = i;
                const status = pointer == null ? "" : (doneAll || n < pointer) ? "done" : n === pointer ? "cur" : "up";
                const dur = p.meta?.duration_minutes;
                return (
                  <div className={`co-card ${status}`} key={i} onClick={() => onOpenUnit(n)}>
                    <span className="co-num">{n + 1}.</span>
                    <div className="co-body"><div className="co-utitle">{p.title || `Unit ${n + 1}`}</div></div>
                    <div className="co-side">
                      {status === "cur" ? <span className="co-now">now</span> : null}
                      {dur ? <span className="co-dur"><span className="co-dur-n">{dur}</span><span className="co-dur-u">min</span></span> : null}
                      {status === "done" ? <span className="co-mark">✓ taught</span> : null}
                    </div>
                    {/* "→" at the capsule's right end (founder 2026-07-16) — same cue as above. */}
                    <span className="co-go" aria-hidden="true">→</span>
                  </div>
                );
              })}
            </div>
          );
          return periods.length > FLAT_SHOWN ? (
            <div className="co-flatwrap">
              <div className="co-flatscroll">{list}</div>
              <div className="co-flatfade" aria-hidden="true" />
            </div>
          ) : list;
        })()
      ) : lp.groups.map((g, gi) => {
        const open = openIdx === gi;
        // Render the body (periods + children) for EVERY group so idx advances in order;
        // the group's own label becomes the clickable header, so skip it in the body walk.
        const body = renderGroup({ periods: g.periods, children: g.children, type: g.type }, 0, `g${gi}`, open);
        const cnt = countUnits(g);
        // Header label: Science strips the section number; SS competencies are truncated to
        // 12 words while COLLAPSED (full text on open) to cut clutter (founder 2026-07-14).
        const rawLabel = (lp.subject === "science" && g.type === "section" ? sectionTitleOnly(g.label) : g.label) || `Section ${gi + 1}`;
        const shownLabel = (lp.subject === "social_sciences" && g.type === "competency" && !open)
          ? truncateWords(rawLabel, 12) : rawLabel;
        return (
          // The OPEN axis is the filled one; closed axes render unfilled/white so the
          // options read as options (founder 2026-07-10).
          <div className={`co-acc${open ? " open" : ""}`} key={gi}>
            <button
              className={`co-acchead${open ? " open" : ""}`}
              onClick={() => setOpenIdx(open ? -1 : gi)}
              aria-expanded={open}
            >
              <span className="co-acc-name">{shownLabel}</span>
              <span className="co-count">{cnt}</span>
              <span className="co-chev" aria-hidden="true">
                <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 4.5L6 8l3.5-3.5" />
                </svg>
              </span>
            </button>
            {open ? <div className="co-accbody">{body}</div> : null}
          </div>
        );
      })}
      {/* Chapter Notes now lives in the axis gutter above (the notebook popup still opens
          from there — arch-plan §I-bis; moved out of the page foot 2026-07-14). */}
      {notesOpen ? (
        <ChapterNotesModal
          chapterTitle={lp.chapter_title}
          subjectGrade={cnSubjectGrade(lp)}
          initial={noteText}
          onSave={saveNote}
          readOnly={notesLocked}
          onClose={() => setNotesOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default function LessonView({ view, sectionKey = "", onExit, preview = false, tourUnit = false }) {
  const lp = view.lesson_plan;
  const units = useMemo(() => flattenUnits(lp), [lp]);
  // Dropped sections (founder 2026-08-01): a below-floor plan carries its unreached
  // units (view.dropped_lp, adapter-shaped). They page AFTER the served units — the
  // strip chains "Next" from the last unit into them and "Back" from the first of them
  // returns to the last served unit. Never counted in pointer/completion arithmetic.
  const droppedLp = view.dropped_lp || null;
  const droppedUnits = useMemo(() => (droppedLp ? flattenUnits(droppedLp) : []), [droppedLp]);
  // Preview root — used to reset scroll to the top of the unit when paging (see pvGoto).
  const pvRef = useRef(null);
  const storageKey = `lu_pointer_${sectionKey || lp.subject + "_" + lp.grade + "_" + (lp.chapter_title || "")}`;
  // Hoisted to sit beside storageKey: the org-page landing below needs it, and both are pure
  // string expressions of the same inputs.
  const doneKey = `lu_done_${sectionKey || lp.subject + "_" + lp.grade + "_" + (lp.chapter_title || "")}`;

  // current pointer (which LU the teacher is on) — restore from localStorage
  const [cur, setCur] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(saved) && saved >= 0 && saved < units.length ? saved : 0;
  });
  /* ★ THE CHAPTER'S FRONT DOOR IS THE ORG PAGE UNTIL SHE HAS TAUGHT SOMETHING (founder,
     2026-09-14): "first time when someone clicks a lesson plan from My Lessons as well as My
     Class, it should by default open in the org page. When they click on a specific spine or
     section, it should open in the Lesson tab. Once they complete the first unit, clicking the
     lesson must henceforth take them to the sitting that they are now teaching."
     So the landing is about PROGRESS, not about which screen she came from. It used to be
     `useState(preview)` — preview landed on the org page and tracking went straight to a unit,
     which meant a chapter she had never opened dropped her into unit 1 with no sense of the
     shape of the thing. Now: no progress → the map; any progress → the sitting she is on.
     ⚠️ THE STORED POINTER *IS* THE COUNT OF COMPLETED UNITS (0-based index of the current unit),
     which is why `> 0` is the test and not `>= 0`. `doneAll` is checked too, for the one-unit
     chapter whose pointer never leaves 0 even when it is finished — without it, a completed
     one-unit chapter would keep opening on the map for ever.
     Preview has no pointer to consult, so it always lands on the map, which is what it already
     did and what "first time" means for a plan attached to no class. */
  const [showOrg, setShowOrg] = useState(() => {
    /* ⚠️ THE TOUR IS THE ONE CALLER THAT MUST NOT LAND ON THE MAP (founder, 2026-09-17, seen on
       BOTH surfaces — which is the tell that it is this landing rule and not either port). Steps
       11-13 describe the four tabs, the phase bookmark and Mark complete, every one of them on
       the UNIT, and a chapter with no progress opens on the org page by design. The tour says
       which it wants rather than leaving the rule to guess. Nothing else passes this. */
    if (tourUnit) return false;
    if (preview) return true;
    if (typeof window === "undefined") return true;
    let started = false, done = false;
    try {
      const saved = Number(window.localStorage.getItem(storageKey));
      started = Number.isFinite(saved) && saved > 0;
      done = window.localStorage.getItem(doneKey) === "1";
    } catch { /* private mode — treat as no progress, which lands on the map */ }
    return !(started || done);
  });
  // After "Mark complete" we show a confirmation + an Undo that reverts to this index. The undo
  // target is INTENTIONALLY in-session only (not persisted): the pointer itself is the source of
  // truth and already saved, so undo is just a convenience for the immediate "oops, wrong button"
  // moment. It's harmless either way — a teacher can always step back by marking again from the
  // full plan — so we don't carry it across refreshes/visits, which would otherwise keep the
  // confirmation card up indefinitely and hide the plain mark-complete action for the new unit.
  const [undoTo, setUndoTo] = useState(null);    // index to revert to, or null = nothing to undo
  // "View full lesson plan" re-renders THIS view in preview layout; previewAt = which unit shows.
  const [showFullPlan, setShowFullPlan] = useState(false);
  // index of the unit shown in full-plan preview — defaults to the current pointer so the teacher
  // lands on the unit she's teaching (the next LU after the last one marked complete).
  const [previewAt, setPreviewAt] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(saved) && saved >= 0 && saved < units.length ? saved : 0;
  });

  // Completion flag (per section) — the ONLY signal that a chapter is fully taught, since the
  // pointer clamps at the last unit and can't otherwise distinguish "on the last LU" from "done".
  // My Classes reads `lu_done_${sectionKey}` to shade the card as completed. Mirrored in React
  // state so marking the chapter complete re-renders the view (confirmation card) immediately.
  const [doneFlag, setDoneFlag] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(doneKey) === "1"; } catch { return false; }
  });
  const setDone = (v) => {
    setDoneFlag(v);
    try {
      if (v) window.localStorage.setItem(doneKey, "1");
      else window.localStorage.removeItem(doneKey);
    } catch {}
    pushSectionState(sectionKey);   // sync completion to the server (cross-device)
  };

  const writePointer = (i) => {
    const clamped = Math.max(0, Math.min(units.length - 1, i));
    setCur(clamped);
    if (clamped < units.length - 1) setDone(false);   // moved back off the last unit → not done
    /* ★ THROUGH THE SHARED WRITER when tracking (2026-09-18, app. 06 row 6): it stores unit 0 as
       NO key — the shape the phone and `pullSectionState` use — where this wrote "0", so the two
       surfaces disagreed on disk about the same state. `setUnitPointer` also pushes. The
       section-less legacy key has no shared writer and keeps its old write. */
    if (sectionKey) setUnitPointer(sectionKey, clamped);
    else { try { window.localStorage.setItem(storageKey, String(clamped)); } catch {} }
    return clamped;
  };

  // Mark complete advances the POINTER (cur) but keeps the paged view (previewAt) on the just-
  // completed unit, so the confirmation surfaces in place at the end of that unit's Lesson tab.
  // "Open next unit →" is what moves the view forward (below).
  const markComplete = () => {
    if (cur >= units.length - 1) { writePointer(units.length - 1); setDone(true); setUndoTo(null); return; }
    const from = cur;
    writePointer(cur + 1);
    setUndoTo(from);
  };
  const undoComplete = () => {
    if (undoTo == null) return;
    writePointer(undoTo);   // pointer back to the un-completed unit (previewAt already there)
    setUndoTo(null);
  };

  // ── The teacher's ONE phase bookmark (tracking only) ──────────────────────────────
  // It always sits on the in-progress unit (cur). Within that unit she drags it phase to
  // phase and it stays put; when "Mark unit complete" advances cur, it reappears at the top
  // phase (0) of the next unit. Only the phase index lives in React here — it persists to the
  // per-section state row (sectionState.writeLocalBookmark, keyed by sectionKey), so it rides
  // to the server + Supabase alongside the pointer (CLOUD_DATA_MODEL.md §2.4). bkmk === null
  // means "no bookmark surface" (no section bound — e.g. the read-only preview modes).
  // Initialise from the saved bookmark for the current unit — READ ONLY, never a write, so a
  // cold open (after logout, or before a cross-device pull has landed) can't clobber the saved
  // phase. It defaults to the top phase only when nothing is stored for this unit.
  const [bkmkPhase, setBkmkPhase] = useState(() => {
    if (!sectionKey) return 0;
    const b = readLocalBookmark(sectionKey);
    return b && b.unit === cur ? b.phase : 0;
  });
  // Reset to the top phase ONLY on a genuine unit change (pointer advanced by "Mark complete",
  // or undone) — tracked via a ref so it does NOT fire on mount. On mount prevCur === cur, so a
  // freshly-opened view keeps its restored phase instead of overwriting it with 0.
  const prevCurRef = useRef(cur);
  useEffect(() => {
    if (!sectionKey) return;
    if (prevCurRef.current === cur) return;   // mount / no real change → leave the saved phase
    prevCurRef.current = cur;
    const b = readLocalBookmark(sectionKey);
    if (b && b.unit === cur) {
      setBkmkPhase(b.phase);            // returning to a unit → where she left it
    } else {
      setBkmkPhase(0);                  // advanced to a new unit → top level, by default
      writeLocalBookmark(sectionKey, cur, 0);   // persist the reset so the server row agrees
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, sectionKey]);
  const moveBookmark = (phase) => {
    setBkmkPhase(phase);
    writeLocalBookmark(sectionKey, cur, phase);
  };
  // Cross-device catch-up. On a SECOND device the reconcile (pullSectionState) may write the
  // saved bookmark into the cache AFTER this view has mounted — or the teacher may move it on
  // her desktop while the phone is still showing the unit. Re-read the cache when the tab
  // regains focus, restores from Safari's bfcache, or another tab writes it, so the arrow moves
  // to the saved phase instead of sitting at the top. Read-only (never writes), so it can't
  // clobber; it only adopts a stored bookmark that belongs to the current unit.
  useEffect(() => {
    if (!sectionKey) return;
    const resync = () => {
      const b = readLocalBookmark(sectionKey);
      if (b && b.unit === cur) setBkmkPhase((p) => (p === b.phase ? p : b.phase));
    };
    window.addEventListener("focus", resync);
    window.addEventListener("pageshow", resync);
    window.addEventListener("storage", resync);
    return () => {
      window.removeEventListener("focus", resync);
      window.removeEventListener("pageshow", resync);
      window.removeEventListener("storage", resync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, sectionKey]);

  if (!units.length) {
    return (<div><button className="back" onClick={onExit}>← back</button><div className="empty">This plan has no units.</div></div>);
  }

  // ── Chapter Organization altitude — preview's landing page; one tap away in tracking ──
  if (showOrg) {
    return (
      <div data-tour={preview ? "preview-root" : undefined}>
        <ChapterOrg
          lp={lp} units={units}
          pointer={preview ? null : cur} doneAll={doneFlag}
          onOpenUnit={(n) => {
            // Navigation, never pointer movement. Tracking (My Classes): return to the paging
            // unit view at that unit (mark-complete still shows only on the pointer unit).
            // Preview (My Lessons): open the read-only preview at that unit.
            setPreviewAt(n); setShowOrg(false);
          }}
          onBack={onExit}
          backTour={preview ? "preview-back" : undefined}
        />
      </div>
    );
  }

  // ── Preview / "View full lesson plan" — ONE unit at a time, back/forward navigation ──
  // Opened from the Chapter Organization page (card tap) or the in-view "View full lesson
  // plan" button (showFullPlan). Defaults to the current pointer so the teacher lands where
  // she's teaching, then can page through the whole plan. Read-only: no pointer controls.
  // ── Paging helpers — shared by My Lessons preview, the read-only "View full lesson plan"
  //    preview, AND the My Classes tracking view (all three use the same one-unit-at-a-time
  //    paging layout; tracking just adds the note tab + the pointer's mark-complete box). ──
  const inDropped = previewAt >= units.length && droppedUnits.length > 0;
  const pu = inDropped ? (droppedUnits[previewAt - units.length] || droppedUnits[0])
                       : (units[previewAt] || units[0]);
  // Change the shown unit AND reset scroll to the top of the unit view. Without this, paging
  // from the bottom nav strip leaves the window scrolled down at the frozen header, so the new
  // unit opens mid-way; we land the teacher at the unit's start, just under the pinned header.
  const pvGoto = (n) => {
    setPreviewAt(n);
    setUndoTo(null);   // paging away dismisses a just-completed confirmation; the new pointer
                       // unit then shows its own "Mark this unit complete" bar
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      const el = pvRef.current;
      // In shell mode (html.app-shell) the app scrolls .bodycontent, not the window; the bar
      // no longer overlays the content there, so no --nav-h compensation is needed.
      const sc = document.querySelector(".bodycontent");
      if (sc) {
        if (!el) { sc.scrollTo({ top: 0 }); return; }
        const y = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
        sc.scrollTo({ top: Math.max(0, y) });
        return;
      }
      if (!el) { window.scrollTo({ top: 0 }); return; }
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h"), 10) || 118;
      const y = el.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top: Math.max(0, y) });
    });
  };
  // Chapter-organization navigation — works from every unit-view mode: drop the read-only
  // full-plan flag (if it was set) and raise the org altitude.
  const goOrg = () => { setShowFullPlan(false); setShowOrg(true); };
  // The unit strip (bottom of the lesson body). LEFT is backward navigation: on Unit 1 (no
  // previous unit) it becomes chapter-org navigation (founder 2026-07-23); on every other unit
  // it pages to the previous unit, as before. CENTRE is "Unit N / total", RIGHT is next unit.
  const totalAll = units.length + droppedUnits.length;
  const pvNav = (endClass = "") => (
    <div className={`lv-pvnav lv-pvnav-thin ${endClass}`}>
      {previewAt <= 0 ? (
        <button className="lv-pvbtn" onClick={goOrg}>‹ Chapter org.</button>
      ) : previewAt === units.length ? (
        /* first dropped unit — back returns to the LAST SERVED unit (founder 2026-08-01) */
        <button className="lv-pvbtn" onClick={() => pvGoto(units.length - 1)}>← Back to unit {units.length}</button>
      ) : (
        <button className="lv-pvbtn" onClick={() => pvGoto(previewAt - 1)}>← Previous unit</button>
      )}
      <span className="lv-pvmid">{inDropped
        ? `Dropped ${previewAt - units.length + 1} / ${droppedUnits.length}`
        : `Unit ${previewAt + 1} / ${units.length}`}</span>
      {previewAt === units.length - 1 && droppedUnits.length ? (
        <button className="lv-pvbtn" onClick={() => pvGoto(units.length)}>Dropped sections →</button>
      ) : (
        <button className={`lv-pvbtn ${previewAt >= totalAll - 1 ? "off" : ""}`}
          onClick={() => previewAt < totalAll - 1 && pvGoto(previewAt + 1)} disabled={previewAt >= totalAll - 1}>Next unit →</button>
      )}
    </div>
  );

  // ── Read-only paging — My Lessons preview + the in-view "View full lesson plan" ──
  if (preview || showFullPlan) {
    // Header name-plate for the frozen block (the top orange prev/next strip is retired here —
    // paging now lives only in the bottom strip). data-tour="preview-back": tour step 6's hand.
    // ONE top row (founder 2026-07-10): the unit name-plate sits UP in the first row,
    // wrapping as needed, with the back button beside it top-right — no row spent on
    // the back button alone.
    const headerContent = (
      <div className="lv-hd">
        {/* ★ THE BUTTON MOVED OFF THE TITLE'S ROW (founder, 2026-08-26): "the orgn
            button is taking away so much real estate from activity name". It now sits
            on its own thin row above, exactly as the chapter-org page places its back —
            same `.co-topbar` idiom, kicker left, pill right — so the unit title gets the
            full width it needs and the two screens share one header shape. The earlier
            note here ("no row spent on the back button alone") traded horizontal space
            for vertical; on a long unit title at phone width that was the wrong way
            round, and the row is not spent alone — it carries the chapter line. */}
        <div className="co-topbar">
          <span className="kicker kicker-soft co-topkick">
            {String(lp.subject || "").replace(/_/g, " ")}
            {lp.grade ? `·${String(lp.grade).replace(/grade|class/gi, "").trim().toUpperCase()}` : ""}
            {lp.chapter_number ? `·Ch. ${String(lp.chapter_number).padStart(2, "0")}` : ""}
          </span>
          <button className="back back-tr" data-tour="preview-back"
            onClick={showFullPlan ? () => setShowFullPlan(false) : () => setShowOrg(true)}>
            {showFullPlan ? "← back" : "← Orgn."}
          </button>
        </div>
        <div className="lv-title lv-title-full"><span className="lv-unum">{inDropped ? "✦ " : `${previewAt + 1}.`}</span>{pu.title}
          {inDropped ? <div className="uv-durline">Dropped section · for self-study · not scheduled</div> : null}</div>
      </div>
    );
    return (
      // data-tour="preview-root": the guided tour's step-6 spotlight wraps the open preview.
      <div className="lessonview lv-pvview" data-tour="preview-root" ref={pvRef}>
        {/* Frozen block — header AND the Overview/Material/Lesson/Assess tab bar stay pinned;
            only the active panel scrolls beneath. Keyed by unit so paging resets to Overview. */}
        <PreviewUnit key={previewAt} headerContent={headerContent} u={pu} assessment={view.assessment} chapterTitle={lp.chapter_title} />
        {/* Prev/next paging strip at the end of the lesson body. */}
        {pvNav("lv-pvnav-end")}
        {/* The preview is READ-ONLY: the old "Attach to a class" CTA is retired (2026-07-06) —
            attaching happens only via the "+" on a My Classes section card. */}
      </div>
    );
  }

  // ── My Classes tracking view — the SAME one-unit-at-a-time paging layout as My Lessons
  //    (frozen header + Overview/Material/Lesson/Assess tabs + prev/next), landing on the
  //    pointer unit. The one tracking-only element is the "Mark this unit complete" action,
  //    now handed to the LESSON tab as its footer (see below) so a teacher meets it once, at
  //    the natural end of the period — not under every tab. Segmented progress bar retired. ──
  const total = units.length;
  // The unit the completion UI belongs to: the pointer normally, or the just-completed unit
  // while its confirmation is up (previewAt is held there until "Open next unit"). The UI is
  // handed to the Lesson tab of THAT unit only; every other unit (and every other tab) is
  // read-only, so "Mark complete" no longer appears under Overview / Material / Assess.
  const actUnit = undoTo != null ? undoTo : cur;
  const trackHeader = (
    <div className="lv-hd">
      {/* Its own thin row above the title — see headerContent above for why. */}
      <div className="co-topbar">
        <span className="kicker kicker-soft co-topkick">
          {String(lp.subject || "").replace(/_/g, " ")}
          {lp.grade ? `·${String(lp.grade).replace(/grade|class/gi, "").trim().toUpperCase()}` : ""}
          {lp.chapter_number ? `·Ch. ${String(lp.chapter_number).padStart(2, "0")}` : ""}
        </span>
        <button className="back back-tr" onClick={goOrg}>← Orgn.</button>
      </div>
      <div className="lv-title lv-title-full"><span className="lv-unum">{inDropped ? "✦ " : `${previewAt + 1}.`}</span>{pu.title}
        {inDropped ? <div className="uv-durline">Dropped section · for self-study · not scheduled</div> : null}</div>
    </div>
  );

  // The completion action / confirmation / chapter-complete card. Rendered at the END of the
  // Lesson tab (via lessonFooter). Deliberately minimal (founder 2026-07-23): just the bar to
  // mark, and a "✓ Unit complete · Undo" row once marked — the teacher learns the effect quickly,
  // so the explanatory line is dropped. Advancing to the next unit is the pv strip's "Next unit →".
  const completionUI = undoTo != null ? (
    <div className="lv-donecard">
      <div className="lv-donerow">
        <div className="lv-doneleft">
          <div className="lv-donemark">✓</div>
          <div className="lv-donetitle">Unit complete</div>
        </div>
        <button className="lv-undo" onClick={undoComplete}>↺ Undo</button>
      </div>
    </div>
  ) : cur >= total - 1 ? (
    doneFlag ? (
      // Chapter fully taught — the confirmation the section card reads as "completed" (gold).
      <div className="lv-donecard lv-chapterdone">
        <div className="lv-donerow">
          <div className="lv-doneleft">
            <div className="lv-donemark">✓</div>
            <div className="lv-donetitle">Chapter complete</div>
          </div>
          <button className="lv-undo" onClick={() => setDone(false)}>↺ Reopen</button>
        </div>
      </div>
    ) : (
      // Final unit: marking finishes the chapter for this section.
      <div className="lv-markcard">
        <button className="primary lv-markbtn" data-tour="mark-complete" onClick={markComplete}>Mark chapter complete</button>
      </div>
    )
  ) : (
    // data-tour="mark-complete": the guided tour's step-11 spotlight + hand sit here.
    <div className="lv-markcard">
      <button className="primary lv-markbtn" data-tour="mark-complete" onClick={markComplete}>Mark this unit complete</button>
    </div>
  );

  return (
    // data-tour="lesson-root": the guided tour's step-10 spotlight wraps the tracking view.
    <div className="lessonview lv-pvview" data-tour="lesson-root" ref={pvRef}>
      {/* Frozen block — header + tab bar pinned; only the active panel scrolls (My Lessons look).
          The completion UI is the Lesson tab's footer, and only for the active unit — so
          "Mark this unit complete" is met once, at the end of the lesson, not under every tab. */}
      {/* My Classes opens on the LESSON tab (teaching mode), not Overview (founder 2026-07-23) —
          which also lands the mark-complete footer in view on open. My Lessons stays on Overview. */}
      <PreviewUnit key={previewAt} headerContent={trackHeader} u={pu} assessment={view.assessment}
        chapterTitle={lp.chapter_title} lessonFooter={previewAt === actUnit ? completionUI : null} defaultTab="lesson"
        bookmark={sectionKey && previewAt === cur ? { phase: bkmkPhase, onMove: moveBookmark } : null} />
      {/* Unit strip (chapter-org on the left, Unit N/total, next unit). */}
      {pvNav("lv-pvnav-end")}
    </div>
  );
}
