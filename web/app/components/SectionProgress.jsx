"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchPlanView } from "../lib/plans";
import { getJSON, pad, gradeUp } from "../lib/format";

/* ───────── SectionProgress — per-section progress for one chapter (2026-06-29) ─────────
 * Opened from a chapter row's "Track" button in MyLessonPlans. Shows, for every section the
 * teacher has in this grade, how far that section has reached in this chapter's Learning Units.
 *
 *   • total LUs  — the chapter's own length: flatten the saved plan's lesson_plan.groups[].
 *     periods[] (a period IS a Learning Unit — same definition LessonView uses).
 *   • current LU — the per-section teaching pointer, read from localStorage key
 *     `lu_pointer_{subjectSlug}_{gradeSlug}_{sectionTag}` (the exact key LessonView/MyPlans write).
 *     This is DEVICE-LOCAL today (the pointer isn't server-backed yet) — progress reflects this
 *     browser. Consistent with how My Week already reads these pointers.
 *
 * A section with no pointer yet = "Not started" (LU 0). Pointer at the last unit = "Completed".
 * Assessment / revision rows are intentionally out of scope for now.
 *
 * Tapping a section row hands off to My Week (onOpenSection) to OPEN that section's plan with
 * its pointer — the place a teacher fixes a forgotten advance after comparing classes here.
 * Track itself never writes a pointer (it only reads the per-section localStorage values).
 *
 * Props: subjectSlug, gradeSlug, grade (display, e.g. "VII"), sections (["7A",...]), plan
 *        ({filename, chapter_number, chapter_title}), onExit,
 *        onOpenSection(subjectSlug, gradeSlug, sectionTag, plan).
 */

// Flatten groups → ordered Learning Unit count. Mirrors LessonView.flattenUnits.
function countUnits(lp) {
  if (!lp) return 0;
  let n = 0;
  (lp.groups || []).forEach((g) => { n += (g.periods || []).length; });
  return n;
}

function pointerFor(subjectSlug, gradeSlug, sectionTag) {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`lu_pointer_${subjectSlug}_${gradeSlug}_${sectionTag}`);
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;   // 0-based index of the LU the teacher is on
}

export default function SectionProgress({ subjectSlug, gradeSlug, grade, sections, plan, onExit, onOpenSection }) {
  const [total, setTotal] = useState(null);   // total LUs (null = loading)

  useEffect(() => {
    let live = true;
    fetchPlanView(subjectSlug, gradeSlug, plan.filename)
      .then((d) => { if (live) setTotal(countUnits(d.view && d.view.lesson_plan)); })
      .catch(() => { if (live) setTotal(0); });
    return () => { live = false; };
  }, [subjectSlug, gradeSlug, plan.filename]);

  const rows = useMemo(() => (sections || []).map((tag) => {
    const ptr = pointerFor(subjectSlug, gradeSlug, tag);     // 0-based, or null
    const done = ptr == null ? 0 : ptr + 1;                  // LUs reached (1-based count)
    return { tag, done };
  }), [sections, subjectSlug, gradeSlug]);

  return (
    <div className="secprog">
      <button className="back" onClick={onExit}>← back to plans</button>

      <div className="secprog-head">
        <span className="secprog-title">{plan.chapter_title}</span>
        <span className="secprog-meta">
          CH {pad(plan.chapter_number)} · Grade {gradeUp(grade)}
          {total != null ? ` · ${total} unit${total !== 1 ? "s" : ""}` : ""}
        </span>
      </div>
      <p className="secprog-sub">Where each of your Grade {gradeUp(grade)} sections has reached in this chapter.</p>

      {total == null ? (
        <div className="mlp-loading">Loading progress…</div>
      ) : rows.length === 0 ? (
        <div className="mlp-noplans">No sections set up for this grade.</div>
      ) : (
        <div className="secprog-rows">
          {rows.map(({ tag, done }) => {
            const t = total || 0;
            const complete = t > 0 && done >= t;
            const nextLabel = done <= 0 ? "Start LU 1"
              : complete ? "Completed"
              : `next: LU ${done + 1}`;
            return (
              <button className="secprog-row" key={tag}
                onClick={() => onOpenSection && onOpenSection(subjectSlug, gradeSlug, tag, plan)}
                title={`Open ${tag} in My Classes to move its place`}>
                <span className="secprog-sec">{tag}</span>
                <div className="secprog-bar" aria-label={`${done} of ${t} units`}>
                  {Array.from({ length: t }, (_, i) => (
                    <span key={i} className={`secprog-seg ${i < done ? (complete ? "done" : "fill") : ""}`} />
                  ))}
                </div>
                <span className="secprog-stat">
                  <span className={`secprog-stat-main ${complete ? "done" : ""}`}>
                    {done <= 0 ? "Not started" : complete ? "Completed" : `Unit ${done} / ${t}`}
                  </span>
                  <span className="secprog-stat-sub">{complete ? `${t} / ${t}` : nextLabel}</span>
                </span>
                <span className="secprog-go" aria-hidden="true">→</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
