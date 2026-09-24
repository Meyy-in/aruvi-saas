"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { API, getJSON, pad, pretty, userKey, withUser, gradeSlug,
         fetchSupportedGrades, heldClassesFor } from "../lib/format";
import { pullSectionState, readLocalSection } from "../lib/sectionState";
import { YearStamp } from "./MyPlans";
import { cachedPlans, fetchPlans, invalidatePlans, notePlansYear, fetchPlanView } from "../lib/plans";
import { verifiedWrite, planIsArchived } from "../lib/verify";
import LessonView from "./LessonView";
import YearPlan from "./YearPlan";
import { RollWheel } from "./wheels";

/* ───────── MyLessonPlans — the lesson library, one class at a time (redesigned 2026-07-03) ─────────
 * A teacher comes here with ONE class in mind ("what's left to prepare for VI Science"), so the
 * tab scopes to a single subject·grade and gives the whole body to that list. It mirrors My
 * Classes structurally: "Your lessons" at the dash-title size, then Subject + Grade as the two
 * first-run RollWheels (only what she teaches), pinned in a frozen header while the lesson list
 * scrolls beneath. Cards reuse the .sc-card sizing so the two tabs read as one family.
 *
 * Card colour = teaching lifecycle, lifted from section to lesson (the basis chosen 2026-07-03):
 *   • sage rail  — no section has taken this chapter yet ("ready to teach", on the shelf)
 *   • green (st-going) — ANY section is mid-chapter on it ("teaching now" wins — it's live)
 *   • clay (st-done)   — every engaged section has finished and none is live
 * The status line is EXHAUSTIVE and single-colour: "Completed 6A, 6C · Teaching now 6B, 6D"
 * (completed first). No per-section drill-down here — that's the section card's job; tapping a
 * card just opens the READ-ONLY lesson plan (PDF attachment later). Per-section state is read
 * from the same server-backed section cache My Classes writes (readLocalSection), so the two
 * tabs always agree.
 *
 * Data: readiness stores subject as DISPLAY NAME ("Science") and grade as UPPERCASE ROMAN ("VI");
 * the plans API uses SLUGS. We convert at the boundary. Section tags are already stored as "6A".
 *
 * Props:
 *   readiness  — page projection carrying .subjects[] (canonical).
 *   onAllocate — (subjectSlug, gradeSlug) => void; opens Generate to prepare a new lesson.
 */

const subjectSlug = (name) => (name || "").toLowerCase().replace(/ /g, "_");
/* `gradeSlug` now comes from @aruvi/shared/format (lifted 2026-09-17) — one definition. */
// Display abbreviation for the compact Subject wheel: the full "The World Around Us" is shown as
// "TWAU". Only the visible label is shortened — the subject id/slug used everywhere else is the
// full name, so selection, plans, and API calls are unaffected.
const subjectLabel = (name) => (/world around us/i.test(name || "") ? "TWAU" : name);
// The teacher's word is "Class", shown as a plain number — never "Grade", never Roman numerals.
// Readiness still STORES the grade as Roman ("VI"); we convert to the display number only here.
const CLASS_NUM = { iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
const classNum = (g) => CLASS_NUM[(g || "").toLowerCase()] ?? (g || "");

// Persist the chosen Subject + Class so the tab REMEMBERS where she was when she toggles over to
// My Classes and back (she flips between the two to pick chapters — resetting to the first
// subject/class each time is exactly the annoyance to avoid). localStorage → survives the
// unmount/remount on tab switch AND a full refresh.
// Scoped by user ID (A3, 2026-07-06) so the remembered Subject/Class of one teacher never
// carries into another's session on a shared browser. Resolved inside the component (per
// signed-in user), not as a module constant.
const lsGet = (k) => { if (typeof window === "undefined") return null; try { return window.localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { if (typeof window === "undefined") return; try { window.localStorage.setItem(k, v); } catch {} };

/* Line-icons, currentColor stroke so they inherit the warm-paper palette. */
const ArchiveIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M10 12h4" />
  </svg>
);
// The SAME archive box, but OPEN — the lid swung a full 90° UP so it stands vertical, hinged at
// the box's back corner. Shown when you're inside the archive so the icon reads as "the box is
// open, you're in it"; tapping it closes it back to your lessons.
const OpenArchiveIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6.4" y="12" width="12.2" height="8" rx="1.4" />
    <rect x="3.4" y="2.6" width="3.2" height="9.4" rx="1" />
    <path d="M10.8 16h4" />
  </svg>
);

/* Report line-icon (a document with lines) — the only glyph in the flow; the modal itself is
   icon-free by design. */
const ReportIcon = ({ size = 17 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h6" />
  </svg>
);

/* (The Year-Plan glyph was retired 2026-08-06 — the pane is now named in words in the title row,
   not signalled by an icon. See the title row in the render below.) */

const REPORT_COMPS = [
  { id: "lesson", title: "Lesson Plan", desc: "Teaching plan, activities, steps and resources" },
  { id: "assessment", title: "Assessment", desc: "Questions and instructions" },
  { id: "integrated", title: "Lesson Plan + Assessment", desc: "Teaching plan together with assessment" },
];

/* Reports modal (2026-07-17) — the LPA/report download surface, per our placement decision:
 * opened from the report icon at the bottom-left of a My Lessons plan card (subject·class·chapter,
 * section-agnostic). Single-select composition (Lesson Plan default · Assessment · Lesson Plan +
 * Assessment); the "include answers" tick appears ONLY for the two that contain assessment and
 * defaults off — the answer layer is a separate server-side render (answers=1), so a clean copy
 * can never carry answers. Format PDF (default) or Word. Preview renders the PDF inline; Download
 * fetches the CHOSEN format. Served by GET /api/plans/{subject}/{grade}/{filename}/export/{kind}. */
function ReportModal({ sSlug, gSlug, filename, onClose }) {
  const [comp, setComp] = useState("lesson");
  const [answers, setAnswers] = useState(false);
  const [fmt, setFmt] = useState("pdf");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");     // the failure, said in the window — see download()
  const showAnswers = comp === "assessment" || comp === "integrated";

  const buildUrl = (format) => {
    let url = `${API}/api/plans/${sSlug}/${gSlug}/${filename}/export/${comp}?format=${format}`;
    if (showAnswers && answers) url += "&answers=1";
    return url;
  };

  // Download the report as a file via a blob + `download` attribute. The download attribute means
  // the browser SAVES rather than navigates, so Aruvi stays available (no trap) — including in the
  // Home-Screen PWA. On desktop it lands in Downloads; on iPhone in Files, where you open and share.
  // KNOWN iOS LIMIT: over plain http, iOS references the saved file by a blob: URL, so when you open
  // it and share, it may attach that link instead of the file. Sharing the actual file needs HTTPS
  // (the Web Share file API). There is no http workaround that both avoids the trap AND shares the
  // file — that trade-off is enforced by iOS.
  const download = async () => {
    setBusy(true); setErr("");
    try {
      const resp = await fetch(buildUrl(fmt), withUser({ method: "GET" }));
      if (!resp.ok) {
        /* A 4xx carries `detail` written FOR HER (the ARV-D-088 rule); 5xx detail is engine talk
           and is deliberately not surfaced — the status alone is thrown and the catch words it. */
        let detail = "";
        if (resp.status < 500) {
          try { const b = await resp.json(); detail = (b && b.detail) || ""; } catch {}
        }
        throw new Error(detail || String(resp.status));
      }
      const blob = await resp.blob();
      const cd = resp.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const name = m ? m[1] : `report.${fmt === "pdf" ? "pdf" : "docx"}`;
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 8000);
      onClose();
    } catch (e) {
      /* ★ SAID IN THE WINDOW, NOT IN AN alert() (WALK-A-064's family, 2026-09-24). An alert covers
         the very window she is working in, cannot be styled, and on a phone is a system slab that
         reads as though Meyy itself has crashed. The Year Plan export settled this shape on
         2026-08-30 and this follows it exactly: say WHAT went wrong — a server that has no such
         route needs restarting, a server that refused is a different matter, and a fetch that
         never reached anyone is the only case where "couldn't reach Meyy" is the honest sentence
         — and leave it said, with no auto-clear, so she does not look away and lose it. The next
         press resets it. Note the 4xx `detail` is the API's own wording, written for her. */
      console.error("[report]", e);
      const msg = String((e && e.message) || "");
      setErr(
        /^Failed to fetch/i.test(msg) || !msg
          ? "Couldn’t reach Meyy just now — check your connection."
          : msg === "404"
            ? "This Meyy server doesn’t have that report yet."
            : msg === "501"
              ? "This Meyy server can’t build Word documents yet."
              : msg
      );
    } finally { setBusy(false); }
  };

  return (
    <div className="rpt-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="rpt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rpt-hd">
          <span className="rpt-title">Reports</span>
          <button className="rpt-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="rpt-sub">Create a report of this lesson or its assessment.</p>

        <div className="rpt-opts">
          {REPORT_COMPS.map((c) => {
            const on = comp === c.id;
            const canAns = c.id === "assessment" || c.id === "integrated";
            return (
              <div key={c.id} className={`rpt-opt${on ? " on" : ""}`} role="button" tabIndex={0}
                onClick={() => setComp(c.id)}>
                <div className="rpt-opt-row">
                  <span className="rpt-opt-body">
                    <span className="rpt-opt-t">{c.title}</span>
                    <span className="rpt-opt-d">{c.desc}</span>
                  </span>
                  <span className="rpt-radio" aria-hidden="true" />
                </div>
                {on && canAns ? (
                  // The answers tick lives INSIDE the chosen box (Assessment / LP+A only) —
                  // stops propagation so toggling it never re-fires the card's select.
                  <label className="rpt-ans" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={answers}
                      onChange={(e) => setAnswers(e.target.checked)} />
                    <span className="rpt-ans-t">Include answers / model responses</span>
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="rpt-kicker">Format</div>
        <div className="rpt-fmt">
          <button type="button" className={`rpt-fmt-btn${fmt === "pdf" ? " on" : ""}`} onClick={() => setFmt("pdf")}>PDF</button>
          <button type="button" className={`rpt-fmt-btn${fmt === "docx" ? " on" : ""}`} onClick={() => setFmt("docx")}>Word</button>
        </div>

        {/* The failure sits ABOVE the buttons and pushes them down — never over the choices she
            has just made, and never an alert() covering the window itself. */}
        {err ? <p className="rpt-err" role="alert">{err}</p> : null}

        <div className="rpt-foot">
          <button className="rpt-btn" onClick={onClose} type="button">Cancel</button>
          <button className="rpt-btn rpt-primary" onClick={download} disabled={busy} type="button">
            {busy ? "Preparing…" : `Download ${fmt === "pdf" ? "PDF" : "Word"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* The report trigger on a card — a small icon at the bottom-left; opens the Reports modal.
   `dataTour` tags this button as the guided tour's step-4 anchor on the tour's target card. */
function ReportButton({ sSlug, gSlug, filename, dataTour }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="sc-report" data-tour={dataTour} onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label="Create a report" title="Reports"><ReportIcon /></button>
      {open ? (
        <ReportModal sSlug={sSlug} gSlug={gSlug} filename={filename} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

/* ── the PROPOSED lesson card (founder, 2026-08-06) ─────────────────────────────
 * Preparing used to take her AWAY: PrepareLesson swapped its whole screen for a pale
 * stand-in card with a "· · · · ·" line, and only after the hold did she arrive here.
 * Two things were wrong with it — she left the place the lesson was going to appear,
 * and a faded card reads as "something is missing" when in fact every fact on it is
 * already known and final. So the wait now happens HERE, in the repository, as a real
 * lesson card in the ordinary structure (number tag · title · duration line), drawn at
 * full strength, sitting exactly where the finished plan will sit. The only difference
 * is the last line: a determinate progress bar instead of "Ready to teach".
 * It is deliberately NOT clickable — there is nothing to open yet — and it carries
 * aria-busy so a screen reader announces the wait rather than reading a dead card. */
/* The duration line, in the SERVER's exact phrasing (api/data.py duration_label): rows
 * joined by " · ". Extracted 2026-08-07 (ARV-D-066) because the proposed card had drifted
 * to " + " while the finished card used " · ", so a MIXED matrix read
 *   proposed  60 min × 4 + 45 min × 6
 *   finished  60 min × 4 · 45 min × 6
 * — the wording changing under her, which is the one thing the old comment said must not
 * happen. Single-row matrices were identical, so it stayed invisible until a 60+45 week.
 * One function now, and it doubles as the dedupe key below. */
export function matrixLabel(rows) {
  return (rows || [])
    .filter((r) => Number(r.count) > 0)
    .map((r) => `${Number(r.duration)} min × ${Number(r.count)}`)
    .join(" · ");
}

function ProposedCard({ preparing, onDismiss, onRetry }) {
  const rows = (preparing.rows || []).filter((r) => r.count > 0);
  const total = rows.reduce((a, r) => a + (Number(r.count) || 0), 0);
  const label = matrixLabel(rows);
  // FAILED (ARV-D-087, 2026-08-10): the same card, at rest, carrying the reason. It is not
  // pulled, because she is looking at it — a card that vanishes silently reads as a mis-tap.
  // The bar stops (that is what the old note was protecting against), aria-busy goes false, and
  // the message is whatever reached us: the API's own 4xx sentence where there is one, our
  // fallback otherwise. She dismisses it herself; nothing navigates under her.
  const failed = !!preparing.failed;
  const msg = preparing.message
    || "Couldn't build the lesson plan right now. Try again in a moment.";
  return (
    <div className={`sc-card sc-proposed${failed ? " sc-proposed-failed" : ""}`}
         aria-busy={failed ? "false" : "true"} aria-live="polite">
      <div className="sc-tag">{pad(preparing.chapterNo)}</div>
      <div className="sc-body">
        <div className="sc-title">{preparing.chapterTitle}</div>
        {label ? <div className="sc-durline">{label}</div> : null}
        {failed ? (
          <div className="sc-prep sc-prep-failed">
            {/* WALK-A-019 (2026-09-20): the sentence is shown IN FULL — the two-line clamp cut the
                one line that says what happened ("Try again in a…"). And "Try again" sits beside
                Dismiss: she has already chosen the chapter, duration and periods. */}
            <span className="sc-prep-note">{msg}</span>
            <span className="sc-prep-actions">
              {onRetry && (
                <button type="button" className="sc-prep-dismiss" onClick={() => onRetry(preparing)}
                        aria-label="Try preparing this lesson again">Try again</button>
              )}
              <button type="button" className="sc-prep-dismiss" onClick={onDismiss}
                      aria-label="Dismiss this failed lesson">Dismiss</button>
            </span>
          </div>
        ) : (
          <div className="sc-prep">
            <div className="sc-prep-bar"><i /></div>
            <span className="sc-prep-note">
              Preparing your {total} {total === 1 ? "period" : "periods"} lesson plan…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyLessonPlans({ readiness, onAllocate, tourStep, preparing,
                                        onStartTour, tourActive, onDismissPrepareError, onRetryPrepare, lapsed,
                                        yearInfo, onScope, onEditYearBudget, paneIntent,
                                        heldScopes, onTourArchivable }) {
  const LS_SUBJECT = userKey("mylessons_subject");
  const LS_CLASS = userKey("mylessons_class");
  const subjects = useMemo(() => (readiness && readiness.subjects) || [], [readiness]);

  // Subject in focus (by display name); class in focus (uppercase Roman). RESTORE the last choice
  // from localStorage (see LS_* above); fall back to the first taught subject/class on first ever
  // visit. A stale saved class is harmless — the RollWheel self-corrects if it isn't offered.
  const [activeSubject, setActiveSubject] = useState(() => {
    const saved = lsGet(LS_SUBJECT);
    if (saved && subjects.some((s) => s.name === saved)) return saved;
    return subjects[0] ? subjects[0].name : "";
  });
  const [activeGrade, setActiveGrade] = useState(() => {
    // Default to a class she actually TEACHES for the initial subject. A stale saved class — from
    // another user in this same browser, or left over from before a profile delete/re-run — must
    // NOT strand My Lessons on a class where her prepared lessons don't live (the "lesson not in My
    // Lessons" bug, kumar23 2026-07-06: prepared english/iii was on disk, but My Lessons opened on a
    // stale Class 7 and showed "no lessons prepared"). Derived from the current server profile, not
    // trusted from the persisted value. She can still browse other classes via the wheel afterwards.
    const savedSub = lsGet(LS_SUBJECT);
    const s0 = (savedSub && subjects.find((s) => s.name === savedSub)) || subjects[0] || null;
    const taught = (s0 && s0.grades ? s0.grades : []).map((g) => g.grade);
    const saved = lsGet(LS_CLASS);
    if (saved && taught.includes(saved)) return saved;
    return taught[0] || "";
  });
  // Plans keyed `${subjectSlug}/${gradeSlug}` -> array (or undefined while loading).
  const [plansByKey, setPlansByKey] = useState({});
  /* Prior academic years (cutover part A, 2026-08-26): which folder is open, and that
     year's prepared plans for the CURRENT subject·class once fetched. Lazy — a teacher
     who never opens the folder never pays for the call.
     ★ ALWAYS starts closed (founder): never persisted, and re-closed whenever she changes
     subject or class, because an open folder from the last class would put LAST year's
     work in front of her before this year's. She lives in the current year. */
  const [openPrior, setOpenPrior] = useState(null);
  const [priorPlans, setPriorPlans] = useState({});
  const [openPlan, setOpenPlan] = useState(null);   // { view }
  // WALK-A-008: the browser's Back closes an open lesson first (page.jsx dispatches "aruvi:back").
  useEffect(() => {
    if (!openPlan) return undefined;
    const onBack = (e) => { setOpenPlan(null); e.preventDefault(); };
    window.addEventListener("aruvi:back", onBack);
    return () => window.removeEventListener("aruvi:back", onBack);
  }, [openPlan]);
  const [opening, setOpening] = useState(false);
  const [, setTick] = useState(0);                  // bumped after a section-state sync → re-read
  // Active vs Archived view over the SAME list. Archive is a per-tenant FLAG the server sets
  // (plan.archived); there is no hard delete. "active" is the default — a teacher lives here.
  const [view, setView] = useState("active");
  // Which pane is showing: the prepared-chapter card list ("lessons") or the whole-year "plan"
  // (YearPlan) — the same Subject·Class scope, two lenses.
  // ★ NOT persisted (founder, 2026-08-29): every ordinary revisit of My Lessons opens on
  // "Your lessons" — a teacher who checked the Year Plan yesterday should not find the
  // repository hiding behind it today. The ONE exception is the Year-Plan budget pencil's
  // round trip (pencil → profile budget step → back): page.jsx marks that departure in the
  // one-shot `paneIntent` ref, and the remount consumes it here so the pencil is not a
  // one-way door. Consumed in an effect (not the initialiser) so a double-invoked dev
  // render can't burn it before the state captures it.
  const [pane, setPane] = useState(() =>
    (paneIntent && paneIntent.current === "plan") ? "plan" : "lessons");
  useEffect(() => { if (paneIntent) paneIntent.current = null; }, [paneIntent]);
  const onPane = (p) => { setPane(p); };
  const [toast, setToast] = useState(null);         // { kind:"ok"|"block", text } | null

  // ── follow the lesson being prepared into view (2026-08-06) ──────────────────────
  // This repository remembers its OWN subject·class across visits (LS_SUBJECT/LS_CLASS),
  // which is right for browsing and wrong the one time it matters here: if she was last
  // looking at English VI and prepares Science IX, the proposed card would be drawn into
  // a list she is not on and she would arrive to an unchanged screen — a worse outcome
  // than the screen she used to wait on. So a new preparing descriptor STEERS the panes:
  // its subject·class, the lessons pane, the live view. Subject/class persist like any
  // other switch (the pane deliberately doesn't — see above). Runs on the descriptor's
  // identity, so it fires once per prepare and never fights her wheels mid-wait.
  const prepKey = preparing ? `${preparing.subject}|${preparing.grade}|${preparing.chapterNo}` : "";
  useEffect(() => {
    if (!preparing) return;
    const s = subjects.find((x) => subjectSlug(x.name) === preparing.subject);
    if (s && s.name !== activeSubject) { setActiveSubject(s.name); lsSet(LS_SUBJECT, s.name); }
    const g = (preparing.grade || "").toUpperCase();
    if (g && g !== activeGrade) { setActiveGrade(g); lsSet(LS_CLASS, g); }
    setView("active");
    setPane("lessons");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepKey]);

  const current = subjects.find((s) => s.name === activeSubject) || subjects[0] || null;
  const grades = useMemo(() => (current && current.grades) || [], [current]);   // HER enrolled classes

  /* ★ A SUBJECT SHE OWNS BUT NO LONGER TEACHES KEEPS ITS LESSONS (founder, 2026-09-17: "when a
     subscribed subject is deleted by removing all classes, the lessons in my lessons … goes too.
     both should remain"). Since the same day a paid subject SURVIVES losing its last class
     (`subjectSurvivesEmpty`) — but surviving in the profile is only half of it: this wheel is
     built from her enrolled classes, so a subject with none left would list itself and then have
     no class to scope to, and her prepared lessons would still be out of reach.
     So for such a subject the Class wheel offers THE CLASSES SHE HOLDS — her paid stages,
     intersected with what Meyy has content for. It is the smallest honest list: every class on it
     is one she has bought, and the shelf behind it is the one her lessons are on.
     ⚠️ Only for a subject with NO classes. A teacher who still teaches one is offered exactly
     what she teaches, which is the 2026-07-06 rule and is untouched.
     ⚠️ Nothing is asked while she holds nothing: an unresolved entitlement would otherwise cache
     an empty answer for the session and the wheel would stay empty after it arrived. */
  const [ownedClasses, setOwnedClasses] = useState({});   // { [subject name]: ["III", …] }
  useEffect(() => {
    if (!heldScopes || !heldScopes.length) return undefined;
    const need = subjects.filter((s) => !((s.grades || []).length)
      && ownedClasses[s.name] === undefined);
    if (!need.length) return undefined;
    let live = true;
    Promise.all(need.map((s) => fetchSupportedGrades(s.name)
      .then((gs) => [s.name, heldClassesFor(heldScopes, s.name, gs)])
      .catch(() => [s.name, []])))
      .then((pairs) => {
        if (!live) return;
        setOwnedClasses((m) => {
          const next = { ...m };
          pairs.forEach(([name, list]) => { next[name] = list; });
          return next;
        });
      });
    return () => { live = false; };
  }, [subjects, heldScopes, ownedClasses]);

  /* The classes the wheels offer for ONE subject — hers, or the ones she holds when she teaches
     none. One definition, used by the wheel AND by the validation effect below, or the two
     disagree about which class is valid and she is snapped off the one she just picked. */
  const classesOfSubject = (s) => {
    const gs = (s && s.grades) || [];
    if (gs.length) return gs.map((g) => g.grade);
    return (s && ownedClasses[s.name]) || [];
  };
  const wheelGrades = useMemo(() => classesOfSubject(current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, grades, ownedClasses]);
  // The Class wheel is RESTRICTED to the classes she has enrolled for this subject in her profile
  // (2026-07-06). It never offers a class she hasn't set up — a class shows here only once she adds
  // it (via the "add another class" flow / teaching profile). Every offered class therefore has
  // sections that drive the per-section status.
  const taughtGradeObj = grades.find((g) => g.grade === activeGrade) || null;

  const sSlug = current ? subjectSlug(current.name) : "";
  const gSlug = gradeSlug(activeGrade);
  const key = sSlug && gSlug ? `${sSlug}/${gSlug}` : "";
  const plans = key ? plansByKey[key] : undefined;

  // Keep the active subject AND class valid as the profile changes. The class is now restricted to
  // her enrolled classes, so a stale saved class (from a prior profile, another user in this
  // browser, or the old superset wheel) must be snapped back to one she actually teaches — never
  // left pointing at a class that's no longer in her profile.
  useEffect(() => {
    if (!subjects.length) return;
    const s = subjects.some((x) => x.name === activeSubject)
      ? subjects.find((x) => x.name === activeSubject)
      : subjects[0];
    if (s.name !== activeSubject) {
      const g0 = classesOfSubject(s)[0] || "";
      setActiveSubject(s.name); lsSet(LS_SUBJECT, s.name);
      setActiveGrade(g0); if (g0) lsSet(LS_CLASS, g0);
      return;
    }
    const taught = classesOfSubject(s);
    if (!taught.includes(activeGrade)) {
      const g0 = taught[0] || "";
      setActiveGrade(g0);
      /* ⚠️ NEVER PERSIST AN EMPTY CLASS (2026-09-17). A subject whose held classes have not
         arrived yet offers nothing for one render, and writing "" here put a blank into
         `mylessons_class` that outlived the visit — so the next one opened on no class at all,
         for a subject that has them. An empty list is a state to pass through, not to remember. */
      if (g0) lsSet(LS_CLASS, g0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, activeSubject, activeGrade, ownedClasses]);

  /* ★ REPORT THE SETTLED SCOPE UP (founder, 2026-08-27) — the second moment of the
   * "check your set-up?" window. A subscriber who has just added a subject or a class meets the
   * same three assumptions Aruvi made for her first class (a section, a periods-per-week, a
   * year's total), so she is asked the same question about the new one — the first time she
   * actually OPENS it here, not at the moment she added it (page.jsx's onLessonsScope holds the
   * queue; ProfilePortal.jsx explains why first use and not the add).
   * Deliberately below the validation effect above, so this only ever reports a subject·class
   * she genuinely teaches — a stale remembered class is snapped back before it is announced.
   * page.jsx ignores every pair that was not queued, so firing on each wheel turn costs a
   * localStorage read and nothing else. */
  useEffect(() => {
    if (!onScope || !activeSubject || !activeGrade) return;
    const s = subjects.find((x) => x.name === activeSubject);
    if (!s || !(s.grades || []).some((g) => g.grade === activeGrade)) return;
    onScope(activeSubject, activeGrade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubject, activeGrade, subjects]);

  /* ── REFETCH WHEN A PREPARE FINISHES (ARV-D-068, 2026-08-07) ─────────────────────
   * The fetch below keys on the subject·class alone, so preparing a lesson changed nothing
   * it watches and the finished plan never entered the list: it appeared only when the
   * teacher happened to switch subject or class and the key changed. It looked fine for a
   * RE-prepare, because that card was already there — the gap only shows on a genuinely NEW
   * plan, which is every new variant of a chapter she already has.
   *   `preparing` going non-null -> null IS the completion signal (page.jsx clears it in
   * onPrepared and in onPrepareError). Bump the nonce on that edge and the fetch re-runs for
   * the current key. On the error edge the refetch is harmless — it re-reads the list she
   * already had. Declared ABOVE the fetch: the dep array is evaluated during render, so a
   * later `const` would sit in the temporal dead zone and throw. */
  const [plansNonce, setPlansNonce] = useState(0);
  const wasPreparing = useRef(false);
  useEffect(() => {
    // A FAILED card keeps `preparing` non-null (ARV-D-087), so the completion edge is now
    // "was preparing, and is no longer preparing" — cleared OR failed. A failed prepare
    // produced no plan, so the refetch is skipped rather than merely harmless.
    const live = !!preparing && !preparing.failed;
    if (wasPreparing.current && !live && !(preparing && preparing.failed)) {
      setPlansNonce((n) => n + 1);
    }
    wasPreparing.current = live;
  }, [preparing]);

  /* The saved plans for the scoped subject·grade — from the shared store, not from here.
     ★ ONE COPY (2026-09-14). This view held its own ref-cached copy and REMOUNTS on every visit
     to My Lessons, so the same unchanging list was re-read on every trip: seven calls in one
     session, 452–899 ms each, about 4.2 seconds of waiting. The listing now lives in
     @aruvi/shared/plans — one module-level copy per subject·class that My Classes and this view
     share, a device copy read synchronously so the list paints before the network is consulted,
     and one revalidation per session per key.
     A fresh prepare (plansNonce) is a real change to HER flags, so it invalidates rather than
     re-uses; a cutover clears everything through notePlansYear, because `prepared` and
     `archived` are year-scoped (the twin note in MyPlans says why that matters). */
  const plansNonceRef = useRef(plansNonce);
  useEffect(() => {
    if (!key) return;
    notePlansYear((yearInfo && yearInfo.current_year) || null);
    if (plansNonceRef.current !== plansNonce) {
      plansNonceRef.current = plansNonce;
      invalidatePlans(key);                     // a prepare changed the listing — re-read it
    }
    const cached = cachedPlans(key);
    setPlansByKey((prev) => (key in prev && prev[key] ? prev : { ...prev, [key]: cached || undefined }));
    fetchPlans(key)
      .then((plans) => setPlansByKey((prev) => ({ ...prev, [key]: plans })))
      .catch(() => setPlansByKey((prev) => ({ ...prev, [key]: prev[key] || [] })));
  }, [key, sSlug, gSlug, plansNonce, yearInfo && yearInfo.current_year]);

  // Reconcile this grade's section teaching-state from the server into the localStorage cache so
  // the status lines match what the teacher set on My Classes / another device. Re-syncs on load,
  // on tab focus/visibility, and on a light interval — same pattern as My Classes. Skipped while a
  // plan is open so an in-flight read is never interrupted.
  // Refs to publish the frozen header's height (see effect below) so the Year Plan's own head can
  // stick directly beneath it.
  const rootRef = useRef(null);
  const frozenRef = useRef(null);

  const busyRef = useRef(false);
  busyRef.current = !!openPlan;
  useEffect(() => {
    const keys = (taughtGradeObj ? taughtGradeObj.sections || [] : [])
      .map((s) => `${sSlug}_${gSlug}_${s.tag}`).filter(Boolean);
    if (!keys.length) return;
    let live = true;
    const sync = () => {
      if (!live || busyRef.current) return;
      pullSectionState(keys).then(() => { if (live) setTick((t) => t + 1); });
    };
    sync();
    const onVis = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", sync);
    const iv = setInterval(() => { if (document.visibilityState === "visible") sync(); }, 20000);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", sync);
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sSlug, gSlug]);

  const onSubject = (name) => {
    setActiveSubject(name);
    lsSet(LS_SUBJECT, name);
    const s = subjects.find((x) => x.name === name);
    const g = s && s.grades && s.grades[0] ? s.grades[0].grade : "";
    setActiveGrade(g);
    lsSet(LS_CLASS, g);
  };
  const onGrade = (g) => { setActiveGrade(g); lsSet(LS_CLASS, g); };

  const openLesson = async (p) => {
    setOpening(true);
    /* Kept on the device when opened; read back from there offline (2026-09-18). */
    try {
      const view = (await fetchPlanView(sSlug, gSlug, p.filename)).view;
      setOpenPlan({ view, plan: p });
    } catch (e) {
      setToast({ kind: "block", text: String(e && e.message) === "404"
        ? "This lesson could not be found."
        : "Couldn’t open this lesson — it hasn’t been saved on this device yet. Try again when you’re online." });
    } finally { setOpening(false); }
  };
  // A prior year's plan opens through the SAME path: the plan asset is shared library
  // content and is not year-scoped — only her attachment to it ever was.
  const openPlanView = (p) => openLesson(p);

  /* Prior-year folders for this subject·class. `yearInfo.prior_years` comes from the
     server; the plans themselves are fetched only when a folder is opened, and are
     filtered to what she actually PREPARED that year (the library is shared, so an
     unfiltered list would show her every sample plan Aruvi owns). */
  const priorYears = useMemo(
    () => ((yearInfo && yearInfo.prior_years) || []).slice().sort().reverse(),
    [yearInfo]);
  // Changing subject or class re-closes the folder (see the state note above).
  useEffect(() => { setOpenPrior(null); }, [key]);

  useEffect(() => {
    if (!openPrior || !key) return;
    const cacheKey = `${openPrior}|${key}`;
    if (priorPlans[openPrior] !== undefined && priorPlans._for === cacheKey) return;
    let live = true;
    setPriorPlans({ _for: cacheKey });          // undefined for openPrior → "Loading…"
    getJSON(`/plans/${sSlug}/${gSlug}?year_id=${encodeURIComponent(openPrior)}`)
      .then((d) => {
        if (!live) return;
        /* Exclude anything she has ALREADY brought into this year (founder's screenshot,
           2026-08-26: a chapter attached from last year's folder then showed twice on one
           screen — "Teaching now 9A" above and "Taught in 2026-27" below). The folder
           answers "what else do I have from last year?", so once a lesson is back in play
           it belongs to this year's list alone. */
        const here = new Set((plansByKey[key] || []).filter((p) => p.prepared)
          .map((p) => p.filename));
        const mine = (d.plans || []).filter((p) => p.prepared && !here.has(p.filename));
        setPriorPlans({ _for: cacheKey, [openPrior]: mine });
      })
      .catch(() => { if (live) setPriorPlans({ _for: cacheKey, [openPrior]: [] }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPrior, key, sSlug, gSlug, plansNonce]);

  // Guided-tour orchestration (steps 3–7 live on this view: 3 the lesson row, 4 the report button,
  // 5 the archive button, 6 "open the lesson" — same card as 3, hand on it — and 7 the open
  // preview). The guide DRIVES the preview: on step 7 it opens the first prepared lesson (the hand
  // "clicked" the card at step 6); on any other step — Back to 3/4/5/6, or Back into this view from
  // step 8 — the state converges idempotently. The first prepared, unarchived plan is the same one
  // the list's top row shows (steps 3 and 6's spotlight).
  useEffect(() => {
    if (tourStep == null) return;
    if (tourStep === 7) {
      if (!openPlan && !opening) {
        const p = tourPlanOf();   // the most recently prepared lesson (see below)
        if (p) openLesson(p);
      }
    } else if (openPlan) setOpenPlan(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep, plans, openPlan, opening]);
  // Exhaustive per-section state for one chapter: which sections completed it, which are on it now.
  // A section counts only if it's currently tracking THIS chapter (current_chapter === filename).
  const statusFor = (plan) => {
    const completed = [];
    const live = [];
    (taughtGradeObj ? taughtGradeObj.sections || [] : []).forEach((s) => {
      const st = readLocalSection(`${sSlug}_${gSlug}_${s.tag}`);
      if (st.chapter && st.chapter === plan.filename) (st.done ? completed : live).push(s.tag);
    });
    return { completed, live };
  };

  // A plan is "attached" if any section is currently teaching or has completed it — the same
  // signal that colours the card. Attached plans are BLOCKED from archiving (the teacher would
  // lose the class's pointer/context), so archive is only ever offered on detached plans.
  const isAttached = (plan) => {
    const { completed, live } = statusFor(plan);
    return completed.length > 0 || live.length > 0;
  };

  // The guided tour's plan: her most recently PREPARED lesson — "the lesson you just now
  // generated" — never an arbitrary library entry (/plans returns the whole shared library;
  // gp[0] once made the guide walk a chapter she never generated). Steps 3 and 6 (row/card
  // spotlight) and 7 (auto-open preview) all key off this, so they can never diverge.
  const tourPlanOf = () => {
    const arr = (Array.isArray(plans) ? plans : [])
      .filter((p) => (p.prepared || isAttached(p)) && !p.archived)
      .sort((a, b) => String(b.prepared_at || "").localeCompare(String(a.prepared_at || "")));
    return arr[0] || null;
  };
  const tourPlan = tourStep != null ? tourPlanOf() : null;
  /* ★ TOUR STEP 5 NEEDS AN ARCHIVE BUTTON TO RING (founder, 2026-09-18: an attached lesson is
     NEVER archivable). If the tour's lesson is still attached — to a second section, or completed
     in one — the button is absent and page.jsx skips step 5 (4→6, 6→4). Declared above the
     `opening` early return so the hook count never changes. */
  const tourArchivable = !!tourPlan && view !== "archived" && !isAttached(tourPlan);
  useEffect(() => { if (onTourArchivable) onTourArchivable(tourArchivable); },
    [tourArchivable]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Flip a plan's archived flag in local state (optimistic) so it moves between the two views
  // instantly, before the server round-trip resolves.
  const setArchivedFlag = (filename, val) => {
    setPlansByKey((prev) => {
      const arr = prev[key];
      if (!Array.isArray(arr)) return prev;
      return {
        ...prev,
        [key]: arr.map((p) =>
          p.filename === filename
            ? { ...p, archived: val, archived_at: val ? new Date().toISOString() : null }
            : p),
      };
    });
  };

  const body = (p) => ({ subject: sSlug, grade: gSlug, filename: p.filename });

  /* One verifier for both directions — archive and restore are the same fact inverted, so
     `want` is a boolean rather than two near-identical blocks. On a verified mismatch the
     optimistic flag is put back to the truth and she is told; on "unverified" nothing is said
     and nothing is reverted, because we do not know that it failed. */
  const verifyArchive = (p, want, doWrite) => {
    verifiedWrite({
      write: doWrite,
      read: () => getJSON("/plan-archive").then((d) => (d && (d.archived || d.plans)) || d || {}),
      expect: (y) => planIsArchived(y, sSlug, gSlug, p.filename) === want,
    }).then(({ status }) => {
      /* ★ ARCHIVING MOVES HER FLAGS TOO (2026-09-14). The shared listing carries `archived` per
         teacher (api/main.py sets it beside `prepared`), so an archive that does not invalidate
         leaves the store holding the pre-archive truth — and because `fetchPlans` answers a
         `fresh` entry without asking the server, the very next read puts the card back in Your
         lessons. It showed on any re-entry to this view inside one session: cross to My Classes
         and back, or turn either wheel away and back. Every other write that moves her flags
         already did this (prepare here and in MyPlans, attach, first run); this pair was the one
         omission in the 2026-09-14 speed work's "explicit and exhaustive" set.
         Done HERE rather than beside the optimistic flip because the write is only settled once
         verifiedWrite resolves: invalidating earlier races the POST, and a read that overtook it
         would pull the OLD truth back over the new optimistic flag — the exact bug, by the other
         door. On a mismatch the flag is put back below, so the cache and the screen agree either
         way. */
      invalidatePlans(key);
      if (status === "ok") {
        setToast({ kind: "ok", text: want ? "Moved to Archive — find it in the box above."
                                          : "Restored to your lessons." });
        return;
      }
      /* ★ SAY NOTHING WHEN WE CANNOT PROVE FAILURE — BUT NEVER SAY SUCCESS EITHER (WALK-A-064,
         2026-09-24). "unverified" means the write may or may not have landed: offline, the POST
         and the read both died. The optimistic flag was already set and a cheerful "Moved to
         Archive" toast already shown, so she was told a thing had happened that may not have.
         And it will not merely be unconfirmed — archivePlan/restorePlan call invalidatePlans
         above regardless, so the next fetch pulls the server's pre-archive truth and the lesson
         reappears with no explanation. She archived seven lessons on a bus with no signal, was
         told each one moved, and finds them all back.
         The verdict "we do not know that it failed" is right and is kept: nothing is reverted.
         What changes is the SENTENCE — it now says what we actually know. Wording follows the
         Year Plan export's offline line, which is the one place in the product that already does
         this well: name the failure, name what it means, and leave her a way on. */
      if (status === "unverified") {
        /* ⚠️ THIS SENTENCE MUST NOT PROMISE A REPLAY. The founder's preferred wording — "will be
           updated on Meyy once connection is established" — is the right wording for behaviour
           the app does not yet have: there is no queue, and invalidatePlans above means the next
           successful fetch pulls the server's pre-archive truth back over her change. Until a
           replay exists, this says only what is true. */
        setToast({ kind: "block",
                   text: want ? "Archived here, but not saved to Meyy — check your connection."
                              : "Restored here, but not saved to Meyy — check your connection." });
        return;
      }
      if (status !== "mismatch") return;
      setArchivedFlag(p.filename, !want);
      setToast({ kind: "block",
                 text: want ? "That didn’t archive — it’s still in your lessons."
                            : "That didn’t restore — it’s still archived." });
    });
  };

  const archivePlan = (p, e) => {
    if (e) e.stopPropagation();
    // Safety only — the archive icon is never rendered for an attached plan, so this can't be
    // reached from the UI. No warning path: attachment simply removes the affordance.
    if (isAttached(p)) return;
    setArchivedFlag(p.filename, true);
    /* ★ ONE MESSAGE, NOT TWO (founder, 2026-09-24). The optimistic "Moved to Archive" used to
       fire here and then, offline, be replaced a moment later by "we couldn't confirm it" — she
       read two notices about one act and the second contradicted the first. The CARD already
       moves instantly (setArchivedFlag above), which is the feedback that matters, so the
       sentence can wait the few hundred milliseconds for the verdict and then be said once.
       verifyArchive now owns every toast for this pair. */
    // READ-AFTER-WRITE (area 3). This pair already reverted-and-toasted on a throw, which was
    // the best behaviour in the app — but a throw is not the criterion: the archive may have
    // landed with the response lost. Y = "this plan IS in the archive"; Y′ = GET /plan-archive.
    verifyArchive(p, true, () => fetch(`${API}/plan-archive`, withUser({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body(p)),
    })).then((r) => { if (!r.ok) throw new Error(); }));
  };

  const restorePlan = (p, e) => {
    if (e) e.stopPropagation();
    setArchivedFlag(p.filename, false);
    /* One message, said once the verdict is in — see archivePlan above. */
    verifyArchive(p, false, () => fetch(`${API}/plan-archive`, withUser({
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body(p)),
    })).then((r) => { if (!r.ok) throw new Error(); }));
  };

  // Auto-dismiss the toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Publish the sticky frozen header's live height as --mlp2-frozen-h so the Year Plan's own head
  // (exec + tiles + column line) can stick RIGHT BELOW it — the plan then freezes down to the
  // Chapter/Suggested/Your-plan line while its rows scroll. Re-measures on any header resize.
  useEffect(() => {
    const fz = frozenRef.current, root = rootRef.current;
    if (!fz || !root) return;
    const set = () => root.style.setProperty("--mlp2-frozen-h", `${fz.offsetHeight}px`);
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(fz);
    return () => ro.disconnect();
  });

  /* ★ MEMOISED, AND THE WHEEL'S ▼ DEPENDS ON IT (2026-09-14). RollWheel reparks the box on
     `[items]`, whose comment says "whenever the wheel (re)mounts or the list changes" — but a
     freshly built array is a new identity on EVERY render, so the effect was firing on every
     render, including the one `stepCycle` causes when it commits the pick before animating. Its
     direct `scrollTop =` then landed on the arrow's own target and cancelled the smooth roll, so
     the ▼ jumped instead of rolling. Memoised, the effect fires when the LIST changes, which is
     what it always meant.
     ⚠️ AND THEY MUST LIVE ABOVE THE EARLY RETURNS BELOW. They were first written where the plain
     arrays were — after `if (openPlan) return <LessonView/>` — which was harmless for an array
     and fatal for a HOOK: opening a lesson took that return, those two useMemos never ran, and
     React threw "Rendered fewer hooks than expected" the moment a teacher tapped a plan. A hook
     may not sit after a conditional return, however innocuous the expression it wraps. */
  const subjectItems = useMemo(() => subjects
    .map((s) => ({ id: s.name, label: subjectLabel(s.name) }))
    .sort((a, b) => a.label.localeCompare(b.label)), [subjects]);
  /* ONLY the classes she has enrolled for this subject, low-to-high — never the content superset.
     The one exception is a subject she OWNS and teaches no class of: see `wheelGrades`. */
  const gradeItems = useMemo(() => wheelGrades
    .slice()
    .sort((a, b) => classNum(a) - classNum(b))
    .map((g) => ({ id: g, label: `${classNum(g)}` })), [wheelGrades]);

  if (opening) return <div className="spin">Opening plan…</div>;
  if (openPlan) {
    // READ-ONLY preview. The old "Attach to a class" CTA + section chooser are RETIRED
    // (2026-07-06): attaching happens ONLY via the "+" on a My Classes section card → the
    // track-a-chapter window — one true way, and the tour teaches exactly that.
    return <LessonView view={openPlan.view} onExit={() => setOpenPlan(null)} preview />;
  }

  if (!current) {
    return <div className="mlp-empty">No subjects set up yet. Finish setup in My Classes to see your lessons here.</div>;
  }

  // Subject filter, alphabetical by name (profile order is arbitrary — a stable A–Z list is easier
  // to scan). Copy before sort so the source subjects[] order is untouched.
  // ONLY the classes she has enrolled for this subject, low-to-high — never the content superset.

  /* LAPSED (§2.5 as amended, founder 2026-08-24): My Lessons becomes the reading room —
     open, export, print. The prepare bar disappears entirely; renewal is offered in
     Settings, never pushed here. */
  const prepareCTA = lapsed ? null : (
    <div className="mlp-allocate">
      <span className="mlp-allocate-q">Need a chapter you don&rsquo;t have yet?</span>
      <button className="mlp-allocate-btn prepare-cta" onClick={() => onAllocate && onAllocate(sSlug, gSlug)}>
        Prepare a new lesson →
      </button>
    </div>
  );

  // My Lessons shows ONLY what this teacher has prepared — never the whole shared sample library
  // (live gen is deferred, so the saved-plan content is identical for every teacher). The server
  // sets `prepared` per tenant; a plan any section is attached to counts as prepared too, so a
  // lesson a class is actively teaching can never vanish from the repository even if its prepared
  // write was lost. Un-prepared sample plans are hidden entirely (the empty-state copy already
  // reads "no lesson plans prepared … yet").
  // ── NEWEST PREPARED FIRST (founder, 2026-08-06) ─────────────────────────────────
  // GET /plans walks the chapter directory, so it hands back library order — which put a
  // freshly prepared lesson wherever its chapter number happened to fall, usually the
  // BOTTOM of a long list. The one card she is certain to want next is the one she just
  // made, so the list is ordered by her own `prepared_at` (server-set, per teacher, from
  // her prepared-plans register), most recent first. Re-preparing an existing chapter
  // moves it back to the top, which is the same rule and the right answer: it is again
  // the most recent thing she did.
  //   The fallback keeps the order STABLE rather than arbitrary when the stamp is missing
  // or tied — a plan that is attached but never explicitly prepared has no stamp, and two
  // prepared in the same second tie — so those settle by chapter number, ascending, below
  // everything stamped. Same comparator for the archive, so the two panes never disagree.
  const byRecency = (a, b) => {
    const at = String(a.prepared_at || ""), bt = String(b.prepared_at || "");
    if (at !== bt) return bt.localeCompare(at);          // ISO strings sort lexically
    return (Number(a.chapter_number) || 0) - (Number(b.chapter_number) || 0);
  };
  /* ★ THIS YEAR'S LIST HOLDS THIS YEAR'S WORK ONLY (founder, 2026-08-26).
     `isAttached` used to be enough to list a plan here, which was right before academic
     years existed: a plan a section is teaching is obviously hers. After a cutover it is
     wrong — a chapter she is still finishing from LAST year would appear in BOTH this
     year's list and the prior-year folder, which is exactly the mixing the year boundary
     exists to prevent. A plan carrying `prepared_source_year` belongs to the year it was
     prepared in; her section card still shows it (stamped), and the folder still holds
     it, so nothing becomes unreachable — it simply stops pretending to be current. */
  const preparedPlans = (Array.isArray(plans) ? plans : [])
    /* The test is not "does it carry a year stamp?" but "is it THIS year's work?", and
       those differ for a plan she deliberately brought forward:
         · prepared THIS year, no stamp        → hers, new          → main list
         · prepared THIS year, stamped         → carried forward    → main list, stamped
         · NOT prepared this year, stamped     → last year's        → folder only
       The third case is the one cutover creates and the only one excluded here. Getting
       this wrong in either direction is visible: too loose and last year's shelf floods
       the current list; too tight and a chapter she is actively teaching disappears from
       My Lessons altogether (both happened while building this). */
    .filter((p) => (p.prepared || isAttached(p)) && !(p.prepared_source_year && !p.prepared))
    .slice()
    .sort(byRecency);
  // Split the prepared list into the two views by the server-set archived flag (archive is a
  // flag, not a separate fetch). Chips only appear once something is archived — no clutter before.
  const allPlans = preparedPlans;
  const activePlans = allPlans.filter((p) => !p.archived);
  const archivedPlans = allPlans.filter((p) => p.archived);
  const hasArchived = archivedPlans.length > 0;
  const effView = hasArchived ? view : "active";   // auto-fall-back when nothing's archived
  const shown = effView === "archived" ? archivedPlans : activePlans;
  // Show the proposed card only in the pane and scope it belongs to: the live
  // (non-archived) list of the subject·class being prepared for. Preparing scopes the view
  // to that subject·class on the way in, so this is normally true — the guard is for the
  // case where she wheels away mid-wait, and it makes the card follow the data, not a timer.
  const showProposed = !!preparing && pane === "lessons" && effView !== "archived"
    && (!preparing.subject || preparing.subject === sSlug)
    && (!preparing.grade || preparing.grade === gSlug);

  /* ── THE PLAN BEING PREPARED MAY ALREADY BE ON SCREEN (ARV-D-066, 2026-08-07) ──────
   * The proposed card is worded to read exactly like the finished card, on purpose. But it
   * was drawn UNCONDITIONALLY above the list, so whenever the run was going to land on a
   * card that already exists the teacher saw her lesson TWICE — same title, same length —
   * until the response arrived and the duplicate vanished. Two ordinary paths hit it: any
   * re-prepare, and EVERY identity serve (X equal to a canonical's own count returns that
   * canonical's filename and writes no new file, so the card is already there).
   *
   * The result lands on an existing card exactly when chapter AND matrix match — the served
   * filename is derived from chapter + matrix — so that pair is the key. On a match we do
   * not draw a second card; we mark the real one busy, which keeps the progress feedback
   * where she is already looking instead of removing it. */
  const proposedLabel = preparing ? matrixLabel(preparing.rows) : "";
  const matchIdx = showProposed
    ? shown.findIndex((p) => String(p.chapter_number) === String(preparing.chapterNo)
        && String(p.duration_label || "") === proposedLabel)
    : -1;
  const showProposedCard = showProposed && matchIdx < 0;
  /* HOIST the busy card to the head of the list while it runs (ARV-D-068). The proposed
   * card was always drawn FIRST, where she is looking; marking an existing card busy in
   * place moved the progress bar to wherever that card happened to sit — with seven cards
   * that is often below the fold, and the fix for the duplicate read as "no progress bar
   * at all". Hoisting puts the indicator back where the proposed card would have been, and
   * it is the same rule the list already follows: the plan she just acted on comes first. */
  const ordered = matchIdx > 0
    ? [shown[matchIdx], ...shown.slice(0, matchIdx), ...shown.slice(matchIdx + 1)]
    : shown;
  const busyIdx = matchIdx >= 0 ? 0 : -1;

  return (
    <div className="mlp2" ref={rootRef}>
      <div className="mlp2-frozen" ref={frozenRef}>
        <div className="mlp2-titlerow">
          {/* The two panes are NAMED, both always on screen, and the live one carries a clay
              underline (2026-08-06). Words, not tabs: no boxes, no chrome, the title itself IS
              the switch.
              ★ THE TWO WORDS ARE PAIRED (founder, 2026-09-13). They used to hold OPPOSITE ENDS
              of the row with the archive box between them, and the 2026-08-06 note's own worry
              — "nothing told a teacher the pane existed" — had not actually been answered: a
              word alone at the far end reads as a HEADING for whatever sits under it, not as
              the other half of a choice. ADJACENCY is what makes two words read as a switch, so
              they now sit together behind a hairline "/" and the archive box takes the right
              end. Nothing else changed: same face, same size, same clay rule on the live one,
              and the resting word stays --ink-soft. Deliberately NOT pine, and deliberately no
              box: inking the RESTING word louder than the live one inverts the hierarchy, and
              a box is the chrome this switch was designed without. If it still reads too quiet
              on a phone, a 1px dashed rule under the resting word is the one-line addition.
              The archive box keeps its own rule — it is a sub-state of the LESSONS pane, so it
              renders only while that pane is live, wherever it sits. */}
          <div className="mlp2-titleleft">
            <button className={`mlp2-vtab${pane === "lessons" ? " on" : ""}`}
              onClick={() => { if (pane !== "lessons") onPane("lessons"); }}
              aria-current={pane === "lessons" ? "page" : undefined}
              title="Your lessons">
              {pane === "lessons" && effView === "archived" ? "Archive" : "Your lessons"}
            </button>
            {/* The hairline that makes the pair read as one choice. Decorative: the two buttons
                carry the semantics, so it is aria-hidden and never a tab stop. */}
            <span className="mlp2-vsep" aria-hidden="true">/</span>
            <button className={`mlp2-vtab${pane === "plan" ? " on" : ""}`}
              onClick={() => { if (pane !== "plan") onPane("plan"); }}
              aria-current={pane === "plan" ? "page" : undefined}
              title="Year plan">
              Year plan
            </button>
          </div>
          {/* Archive control — only while the lessons pane is live. Holds the right end now
              that the pair holds the left. */}
          {pane !== "lessons" ? null : effView === "archived" ? (
            // Open box = you're inside the archive; tapping it closes the box and drops you back
            // to your lessons (the one, symmetric way in and out).
            <button className="mlp2-archfolder open" onClick={() => setView("active")}
              aria-label="Close archive, back to your lessons" title="Back to your lessons">
              <OpenArchiveIcon size={22} />
              <span className="mlp2-archcount">{archivedPlans.length}</span>
            </button>
          ) : hasArchived ? (
            <button className="mlp2-archfolder" onClick={() => setView("archived")}
              aria-label={`Open archive (${archivedPlans.length})`} title="Archived lessons">
              <ArchiveIcon size={22} />
              <span className="mlp2-archcount">{archivedPlans.length}</span>
            </button>
          ) : null}
        </div>
        <div className="mlp2-wheels">
          <div className="mlp2-wcol">
            {subjectItems.length > 1 ? (
              <RollWheel items={subjectItems} value={activeSubject} onChange={onSubject} ariaLabel="Subject" large rowPx={72} fit peek />
            ) : (
              <div className="mlp2-static">{subjectLabel(current.name)}</div>
            )}
          </div>
          <div className="mlp2-wcol">
            {gradeItems.length > 1 ? (
              <RollWheel items={gradeItems} value={activeGrade} onChange={onGrade} ariaLabel="Class" large rowPx={72} peek />
            ) : activeGrade ? (
              <div className="mlp2-static">Class {classNum(activeGrade)}</div>
            ) : (
              /* No class to name — an em-dash, never "Class " with a blank after it. The body
                 below says what is going on; the wheel is not the place to explain it. */
              <div className="mlp2-static">&mdash;</div>
            )}
          </div>
        </div>
      </div>

      {/* ⚠️ `&& activeGrade`: the Year Plan is a view of ONE subject·class and returns early
          without one, leaving "Loading your year…" on screen for ever. With no class it falls
          through to the body below, which says why. */}
      {pane === "plan" && activeGrade ? (
        <YearPlan subjectName={current.name} sSlug={sSlug} gSlug={gSlug} readiness={readiness}
          onAllocate={onAllocate}
          /* The pencil beside the budget figure. Bound to the pane's OWN subject·class — the
             display name and Roman class the profile keys on, not the slugs YearPlan fetches
             with, since the scope is matched against `s.name` / `g.grade` in TeachingProfile. */
          onEditBudget={onEditYearBudget
            ? () => onEditYearBudget(current.name, activeGrade) : undefined} />
      ) : (
      <>
      {!activeGrade ? (
        /* ★ NO CLASS TO SCOPE TO, so there is no shelf to read and no spinner to show. Reached by
           a subject she owns and teaches no class of, while its held classes are still being
           fetched — or when she holds none of them any more. `plans` is keyed on the class, so
           without this the pane sat on "Loading plans…" for ever, which is the one thing a
           loading line must never do. */
        <div className="mlp2-emptybody">
          {subjectLabel(current.name)} has no classes in your profile.
          Add one under Class in the &ldquo;+&rdquo; window to teach it again — your lessons are kept either way.
        </div>
      ) : plans === undefined ? (
        <div className="mlp-loading">Loading plans…</div>
      ) : shown.length === 0 && !showProposedCard ? (
        <div className="mlp2-emptybody">
          {effView === "archived"
            ? "Nothing archived here."
            : hasArchived
              ? `Every prepared lesson for ${pretty(sSlug)} · Class ${classNum(activeGrade)} is archived.`
              : `There are no lesson plans prepared for ${pretty(sSlug)} · Class ${classNum(activeGrade)} yet.`}
        </div>
      ) : (
        <div className="sc-list">
          {/* The lesson being prepared sits FIRST, where the finished card will land —
              including when this is her very first plan and the list is otherwise the
              empty state (hence the `showProposed` guard on that branch above). */}
          {showProposedCard ? <ProposedCard preparing={preparing} onDismiss={onDismissPrepareError} onRetry={onRetryPrepare} /> : null}
          {ordered.map((p, pi) => {
            const { completed, live } = statusFor(p);
            /* ★ A FAILED RE-PREPARE HAS TO BE SAID SOMEWHERE (WALK-A-071, 2026-09-24).
               `busy` used to be true for the matched card whether the run was still going or had
               already failed — and `preparing` stays non-null on a failure — so the progress bar
               span for ever and the reason never appeared anywhere: the proposed card, which is
               the ONLY home of the message, Try again and Dismiss, is deliberately suppressed
               when an existing card matches (ARV-D-066, so she is not shown her lesson twice).
               Both halves of the failure contract were lost on this one path. The split below
               ends the bar and gives the reason the same slot the bar occupied — which is truer
               to ARV-D-066's own principle than letting a second card through would be: the
               feedback stays exactly where she is already looking. */
            const matchedHere = pi === busyIdx;   // this card IS the one being re-prepared
            const failedHere = matchedHere && !!(preparing && preparing.failed);
            const busy = matchedHere && !failedHere;
            const cls = (effView === "archived"
              ? "mlp2-arch"
              : live.length ? "st-going" : completed.length ? "st-done" : "mlp2-shelf")
              /* ⚠️ NOT sc-proposed / sc-proposed-failed on a failure. Those classes neutralise the
                 edge and the spine, which is right for a card that never became a plan — but this
                 card IS her plan and it is untouched; only the re-preparing of it failed. It keeps
                 its own status colour, and the sentence below says what happened. */
              + (busy ? " sc-proposed" : "");
            // The guided tour's target card (the just-generated lesson). Steps 4/5 ring its
            // report/archive buttons — tagged only on this card and only at the matching step.
            const isTourCard = tourPlan && p.filename === tourPlan.filename;
            return (
              <div className={`sc-card ${cls}`} key={p.filename} aria-busy={busy || undefined}
                onClick={() => openLesson(p)}
                data-tour={(tourStep === 3 || tourStep === 6) && tourPlan && p.filename === tourPlan.filename ? "lesson-first" : undefined}>
                <div className="sc-tag">{pad(p.chapter_number)}</div>
                <div className="sc-body">
                  <div className="sc-title">{p.chapter_title}</div>
                  {/* EVERY plan carries its matrix in small letters below the name (e.g.
                      "50 min × 12"), library canonicals included — reverses the 2026-07-25
                      "canonical goes by its chapter name alone" rule, which predates the
                      variant library: ch 3 is {12, 9, 7} and three cards reading only
                      "Atmosphere and Climate" are indistinguishable. Source: api/data.py
                      duration_label(), served_matrix -> matrix -> period_rows_snapshot. */}
                  {/* ★ ONE META ROW, not two stacked lines (founder, 2026-08-27). The
                      matrix and the year stamp are both small-print provenance and each
                      was taking a full line of a compact card, so a shelf of ten plans
                      paid ten extra line-heights for it. Side by side they read as the
                      one thing they are — which version of this chapter she holds — and
                      the section gets its vertical space back. Wraps rather than
                      squashes on a narrow phone: see .sc-metarow. */}
                  <div className="sc-metarow">
                    {p.duration_label ? <span className="sc-durline">{p.duration_label}</span> : null}
                    {/* Same stamp, same component, as the section card and both pickers. */}
                    <YearStamp year={p.prepared_source_year} lpYear={p.lp_year_display} />
                  </div>
                  {busy ? (
                    /* Re-preparing THIS plan: the progress line replaces the status line on
                       the card she is already looking at, rather than a second card
                       appearing above it (ARV-D-066). Same markup as ProposedCard. */
                    <div className="sc-prep">
                      <div className="sc-prep-bar"><i /></div>
                      <span className="sc-prep-note">
                        Preparing your {(preparing.rows || []).reduce((a, r) => a + (Number(r.count) || 0), 0)}{" "}
                        {(preparing.rows || []).reduce((a, r) => a + (Number(r.count) || 0), 0) === 1
                          ? "period" : "periods"} lesson plan…
                      </span>
                    </div>
                  ) : failedHere ? (
                    /* The same block ProposedCard shows for a failure, in the slot the progress
                       bar was using. WALK-A-019's rule holds here too: the sentence is shown IN
                       FULL, and "Try again" sits beside Dismiss because she has already chosen
                       the chapter, the duration and the periods. */
                    <div className="sc-prep sc-prep-failed">
                      <span className="sc-prep-note">
                        {preparing.message || "Couldn’t build the lesson plan right now. Try again in a moment."}
                      </span>
                      <span className="sc-prep-actions">
                        {onRetryPrepare && (
                          <button type="button" className="sc-prep-dismiss"
                                  onClick={(e) => { e.stopPropagation(); onRetryPrepare(preparing); }}
                                  aria-label="Try preparing this lesson again">Try again</button>
                        )}
                        <button type="button" className="sc-prep-dismiss"
                                onClick={(e) => { e.stopPropagation(); onDismissPrepareError(); }}
                                aria-label="Dismiss this failed lesson">Dismiss</button>
                      </span>
                    </div>
                  ) : effView === "archived" ? (
                    <div className="mlp2-ready">Archived</div>
                  ) : completed.length || live.length ? (
                    <div className="mlp2-status">
                      {completed.length > 0 && <span>Completed {completed.join(", ")}</span>}
                      {completed.length > 0 && live.length > 0 && <span className="sep">·</span>}
                      {live.length > 0 && <span>Teaching now {live.join(", ")}</span>}
                    </div>
                  ) : (
                    <div className="mlp2-ready">Ready to teach</div>
                  )}
                </div>
                {effView === "archived" ? (
                  <button className="mlp2-restore-btn" onClick={(e) => restorePlan(p, e)}
                    aria-label={`Restore ${p.chapter_title}`}>Restore</button>
                ) : (
                  <>
                    {/* Archive in the top-right corner; report trigger in the bottom-right. Attached
                        plans can't be archived, so that control is simply absent for them. */}
                    {!isAttached(p) ? (
                      <button className="mlp2-iconbtn archive" onClick={(e) => archivePlan(p, e)}
                        aria-label={`Archive ${p.chapter_title}`} title="Archive"
                        data-tour={isTourCard && tourStep === 5 ? "lesson-archive" : undefined}>
                        <ArchiveIcon />
                      </button>
                    ) : null}
                    <ReportButton sSlug={sSlug} gSlug={gSlug} filename={p.filename}
                      dataTour={isTourCard && tourStep === 4 ? "lesson-report" : undefined} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {prepareCTA}

      {/* ★ LAST YEAR'S FOLDER (founder, 2026-08-26 — cutover part A). After a cutover the
          current year starts empty, which would look like loss if her old plans were not
          visibly SOMEWHERE. They sit here, below the current list and below the prepare
          bar: present, findable, and out of the way of this year's work. Collapsed by
          default — she is living in the new year. Read-only by nature: a prior year's
          plans open and export exactly as they always did, but nothing attaches them to
          a section, because sections belong to the year she is in now. */}
      {priorYears.map((yid) => (
        <div className="mlp-prior" key={yid}>
          <button className="mlp-prior-head" aria-expanded={openPrior === yid}
            onClick={() => setOpenPrior(openPrior === yid ? null : yid)}>
            <span className="mlp-prior-caret" aria-hidden="true">
              {openPrior === yid ? "▾" : "▸"}
            </span>
            <span className="mlp-prior-yr">{yid}</span>
            {/* Same sentence the "+" attach picker uses, so the folder reads identically
                wherever she meets it (founder, 2026-08-26). */}
            <span className="mlp-prior-count">lessons you prepared last year</span>
          </button>
          {openPrior === yid && (
            priorPlans[yid] === undefined ? (
              <div className="mlp-prior-empty">Loading…</div>
            ) : priorPlans[yid].length === 0 ? (
              <div className="mlp-prior-empty">
                No lessons were prepared for this class in {yid}.
              </div>
            ) : (
              /* CARDS, not rows (founder, 2026-08-26): last year's lessons are the same
                 kind of thing as this year's and should look it — the same `.sc-card`
                 the current list uses, on the shelf state (no tracking status, because
                 tracking belongs to the year she is in now). */
              <div className="sc-list mlp-prior-list">
                {priorPlans[yid].map((p) => (
                  <div className="sc-card mlp2-shelf" key={p.filename}
                    onClick={() => openPlanView(p)}>
                    <div className="sc-tag">{pad(p.chapter_number)}</div>
                    <div className="sc-body">
                      <div className="sc-title">{p.chapter_title}</div>
                      {/* Same one meta row as the active cards above — last year's
                          shelf is the longest list in the view, so it gains the most. */}
                      <div className="sc-metarow">
                        {p.duration_label ? <span className="sc-durline">{p.duration_label}</span> : null}
                        {/* The folder's year IS the stamp for its rows (fetched under it). */}
                        <YearStamp year={yid} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      ))}

      {/* ★ The tour offer, BELOW her lesson (founder, 2026-08-21). First run now lands here
          rather than on My Classes, so this is the first shell screen she ever sees: her lesson
          plan, then the offer to be shown around. It renders only while the tour is still on
          offer and only in the lessons pane — the Year Plan is not where a first-timer is.
          Same markup and copy as the nudge MyPlans shows on My Classes: whichever surface she
          reaches first makes the same offer, and taking it there resolves it everywhere,
          because page.jsx stops passing onStartTour the moment it is taken or skipped. */}
      {pane === "lessons" && effView !== "archived" && !tourActive && onStartTour && (
        <div className="dash-nudge dash-nudge-click" role="button" tabIndex={0}
          aria-label="Show me how — start the guided walkthrough"
          onClick={() => onStartTour()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
              e.preventDefault(); onStartTour();
            }
          }}>
          <div className="dash-nudge-row">
            <span className="dash-nudge-hand" aria-hidden="true">→</span>
            <div className="dash-nudge-text">
              <div className="dash-nudge-title">Let me show you around first</div>
              <div className="dash-nudge-sub">
                A short walk through tracking sections and handling lesson plans. Your lesson stays
                safe while we look around.
              </div>
            </div>
          </div>
          {/* WALK-A-013: say out loud that this is the way in — the whole box is the button, and
              the arrow alone did not read as an invitation. Same line as My Classes' nudge. */}
          <span className="dash-nudge-cta" aria-hidden="true">Show me how&nbsp;&rarr;</span>
        </div>
      )}
      </>
      )}

      {toast && (
        <div className={`mlp2-toast ${toast.kind}`} role="status">{toast.text}</div>
      )}
    </div>
  );
}
