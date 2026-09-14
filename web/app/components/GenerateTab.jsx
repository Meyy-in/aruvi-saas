"use client";
import { useState, useEffect } from "react";
import PrepareLesson from "./PrepareLesson";
import { pretty, classNum } from "../lib/format";

/* ───────── Generate tab ─────────
 * Reached ONLY through page.jsx's onEnterGenerate (the "Ready to plan…" button, My Lesson
 * Plans "Need a chapter", etc.). `entry` says how to open:
 *   { mode: "scoped", subject, grade } → skip the picker, go straight to PrepareLesson
 *   { mode: "pick" }                   → run the picker: choose subject (if >1 taught), then
 *                                        grade (if the chosen subject has >1), THEN PrepareLesson.
 *
 * DECOUPLED FROM ALLOCATION (2026-07-03): the everyday path is now the single-chapter
 * PrepareLesson flow (pick chapter → periods → generate) — it does NOT require, run, or gate on
 * the annual-budget allocator. The top-down Allocate + PDF report is kept as its own
 * independent capability (its home is TBD), not the path to a lesson. See PrepareLesson.jsx.
 *
 * Readiness still gates the tab — before setup it shows the G1 locked state. */

const subjectSlug = (n) => (n || "").toLowerCase().replace(/ /g, "_");
const gradeSlugOf = (g) => (g || "").toLowerCase();

export default function GenerateTab({ subject, grade, ready, readiness, onNavigate, entry, onScope, onConsumeEntry, onPrepared,
                                     onPreparing, onPrepareError, onPaywall, onBack}) {
  // Picker local state: which subject has been chosen (by name) while in "pick" mode. Defaults to
  // the only subject when there's just one (so "pick" mode then only asks for grade).
  const subs0 = (readiness && readiness.subjects) || [];
  const [pickedSubject, setPickedSubject] = useState(subs0.length === 1 ? subs0[0].name : null);

  if (!ready) {
    return (
      <div className="gate">
        <div className="gate-lock">🔒</div>
        <p className="h2 gate-title">Preparing lessons unlocks after setup</p>
        <p className="gate-sub">
          Meyy needs your classes and annual budget first — that&rsquo;s how the plans it
          makes can fit your real classes and your real year.
        </p>
        <button className="primary" onClick={() => onNavigate && onNavigate("myplans")}>
          Finish setup →
        </button>
      </div>
    );
  }

  const subjects = (readiness && readiness.subjects) || [];

  // ── G1.9 picker (only when entry.mode === "pick") ──
  if (entry && entry.mode === "pick") {
    // Step 1 — which subject? (only the subjects she teaches)
    const curSub = pickedSubject != null ? subjects.find((s) => s.name === pickedSubject) : null;

    if (!curSub) {
      return (
        <div className="gpick">
          <div className="gpick-hd">
            <div className="kicker kicker-ochre">Prepare a lesson · choose what to plan</div>
            <h2 className="gpick-q">Which subject do you want to plan for?</h2>
          </div>
          <div className="gpick-grid">
            {subjects.map((s) => (
              <button className="gpick-card" key={s.name} onClick={() => setPickedSubject(s.name)}>
                <span className="gpick-card-name">{pretty(subjectSlug(s.name))}</span>
                <span className="gpick-card-meta">{(s.grades || []).length} grade{(s.grades || []).length !== 1 ? "s" : ""}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Step 2 — which grade? (only the grades she teaches for this subject)
    const grades = curSub.grades || [];
    const enter = (gradeRoman) => {
      const sSlug = subjectSlug(curSub.name);
      const gSlug = gradeSlugOf(gradeRoman);
      onScope && onScope(sSlug, gSlug);
      onConsumeEntry && onConsumeEntry();   // entry consumed → Allocate renders for this scope
      setPickedSubject(null);
    };
    // Single grade for this subject → enter directly (effect, not during render).
    if (grades.length === 1) return <SingleGradeAutoEnter onEnter={() => enter(grades[0].grade)} />;
    return (
      <div className="gpick">
        <div className="gpick-hd">
          <div className="kicker kicker-ochre">{pretty(subjectSlug(curSub.name))}</div>
          <h2 className="gpick-q">For which grade do you want to plan?</h2>
        </div>
        <div className="gpick-grid">
          {grades.map((g) => (
            <button className="gpick-card" key={g.grade} onClick={() => enter(g.grade)}>
              <span className="gpick-card-name">Class {classNum(g.grade)}</span>
              <span className="gpick-card-meta">{(g.sections || []).length} section{(g.sections || []).length !== 1 ? "s" : ""}</span>
            </button>
          ))}
        </div>
        {subjects.length > 1 && (
          <button className="back gpick-back" onClick={() => setPickedSubject(null)}>← choose a different subject</button>
        )}
      </div>
    );
  }

  // ── scoped (or already consumed) → the everyday single-chapter generate flow for the
  // active subject·grade. No allocation gate — pick a chapter, set its periods, generate. ──
  return <PrepareLesson subject={subject} grade={grade} readiness={readiness} onNavigate={onNavigate}
    onBack={onBack} onPrepared={onPrepared}
    onPreparing={onPreparing} onPrepareError={onPrepareError} onPaywall={onPaywall} />;
}

// When a chosen subject has exactly one grade, enter it once (in an effect, never during render).
function SingleGradeAutoEnter({ onEnter }) {
  useEffect(() => { onEnter(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
