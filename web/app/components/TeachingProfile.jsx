"use client";
import { useEffect, useRef, useState } from "react";
import { getJSON, pretty, ROMAN, stageOfGrade, projectReadiness, API, withUser,
         ESTIMATE_WEEKS, weeksFromAnnual, ppwFromAnnual } from "../lib/format";
import { DAYS_IN_WEEK, budgetPeriods, normalizeBudget, rekeyBudget } from "../lib/budget";
import { SEC_NAME_MAX, secLetter, secName, cleanSecName, secObj, namesFromSections,
         secSummary, gradeDraftFrom, finalizeSubject } from "../lib/profile";
import { verifiedWrite, readinessFingerprint } from "../lib/verify";
import { pushSectionState } from "../lib/sectionState";
import { RollWheel, PickWheel, PpwTotalWheel, PpwSplitCell, normPpw, ppwMapSum, ppwAnchor,
         setPpwSplit, setPpwTotal, lowestDuration,
         DEFAULT_DURATION, DEFAULT_PPW, DURATION_CHOICES } from "./wheels";

/* ───────── TeachingProfile — Settings → "Your teaching profile" (rebuilt 2026-07-02) ─────────
 * The ONE profile editor, reached through the header settings gear.
 *
 * Founder spec (this iteration):
 *   • ACCORDION — subjects are collapsible rows; ONLY ONE subject (and its classes) is open
 *     at a time, so the page never shows more than one subject's tree. Tap a header to open.
 *   • MASTER EDIT — a single Edit toggle reveals ALL mutation controls at once: red dustbins
 *     (delete a subject / a class / a section chip), "edit →" on the numbers line, and the
 *     green add buttons (+ section · + add a class · + add a subject). View mode is clean —
 *     nothing but her data.
 *   • STRUCTURE vs VALUES — things in her tree (subjects/classes/sections) are added/removed
 *     in place; numbers about a thing (duration · periods/week · annual budget) open the same
 *     single-question wheel screens from day one, prefilled, Save and back. One editing idiom.
 *   • NO whole-profile actions — "Delete profile" and "Redo whole profile" are gone. The
 *     profile is only ever edited at a point.
 *
 * Every dustbin gets ONE scoped confirm naming exactly what goes (a section names one card;
 * a class names its sections; a subject names its classes) and always ends with: lessons stay
 * in the library. Removals cascade upward (last section takes its class; last class takes its
 * subject) and clear the removed sections' local state (lu_pointer_*, current_chapter_*).
 *
 * Adding a subject runs that ONE subject through the conversational loop (classes → per class:
 * sections → duration → periods/week → the 4-method annual-budget estimator), with the
 * "subject saved ✓ — continue / finish for now" checkpoint between subjects when several are
 * added at once. Adding a class runs ONLY the new class(es) through the per-class questions —
 * existing classes are never re-asked. All time-facts remain NUMBERS (no day schedule, ever —
 * the calendar purge, MEMORY.md 2026-07-02); grids[] ships all -1 for shape-compat.
 *
 * Props: readiness (projection carrying canonical .subjects[]), onChange(projection).
 */

const SECTION_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A…Z
/* The My Classes "+" portal intents that resolve to ONE subject·class (ProfilePortal.jsx's rows).
   "subject" and "class" are not here: they are managed at the level ABOVE a class. The words are
   the teacher's own, and they are what the two pick screens say aloud. */
const PER_CLASS_GOALS = ["section", "ppw", "budget"];
const GOAL_WORD = {
  class: "classes", section: "sections",
  ppw: "periods a week", budget: "annual period budget",
};
/* ★ THE BUDGET ARITHMETIC MOVED TO `lib/budget` (Track D step 5c, 2026-09-15).
 * `DAYS_IN_WEEK`, `budgetPeriods` (the reader, which still understands all four legacy shapes)
 * and `normalizeBudget` (the one place a stored record becomes the editable period count) are
 * now in @aruvi/shared, because the PHONE's budget editor must read the same record by the same
 * arithmetic — CLAUDE.md §4, and the safest way to make that true of a number is to give both
 * surfaces the same function. Nothing about their behaviour changed in the move; the full
 * account of why there is one written method and four read ones lives in that file's header.
 */

const classNum = (g) => {
  const idx = ROMAN.indexOf((g || "").toLowerCase());
  return idx >= 0 ? idx + 3 : g;
};

/* periods/week is stored PER DURATION TYPE (ppw_by_duration: { [minutes]: count }); the weekly
 * total is their DERIVED sum on `periods_per_week`, so every existing consumer (budget
 * estimator, view totals, format.projectReadiness) is unchanged. The helpers and the capture
 * table now live in wheels.jsx as the SINGLE implementation — this file used to carry a
 * byte-identical private copy, which is exactly how the additive-second-duration bug survived
 * in two places at once (founder, 2026-07-26). Do not re-fork them. */

const subjectSlugOf = (name) => (name || "").toLowerCase().replace(/ /g, "_");
const deepCopy = (x) => JSON.parse(JSON.stringify(x));
const byRoman = (a, b) => ROMAN.indexOf(a.toLowerCase()) - ROMAN.indexOf(b.toLowerCase());

/* ★ A SECTION MAY CARRY A NAME OF HER OWN (founder, 2026-08-30).
 * The LETTER is Aruvi's key and stays the key: `sec` and `tag` are what every bookmark,
 * chapter binding and localStorage key in the product is built from (clearSectionState,
 * MyPlans' sectionKey, the tour's `i.tag`), so a rename must never touch them. `name` is a
 * DISPLAY LABEL laid over the tag — "Rose", "Blue", "Tamil-B", whatever her school calls the
 * room — and nothing keys off it. That is the whole design: renaming a section can therefore
 * never orphan the work attached to it.
 * Eight characters, because it has to sit in a card's corner beside the class number and in a
 * 96px column on a 360px phone; a label that wraps is not a label. Blank = not customized, and
 * the field is simply ABSENT from the record then (never an empty string), so "has a name" is
 * one truthiness test everywhere. */
/* One "customize" cell — the box that opens on the row she ticks. Deliberately NOT autofocused:
 * PickWheel re-rests the wheel on every toggle (an animated scroll), and pulling focus into a
 * field inside that scroller mid-animation fights it and throws up the phone keyboard over the
 * list she is still picking from. The box appearing IS the invitation. */
function SecNameCell({ on, tag, value, onChange }) {
  if (!on) return null;
  return (
    <input type="text" className="tp-secname" value={value} maxLength={SEC_NAME_MAX}
      autoComplete="off" spellCheck={false}
      aria-label={`Your own name for section ${tag} (optional, up to ${SEC_NAME_MAX} characters)`}
      onChange={(e) => onChange(cleanSecName(e.target.value))}
      onClick={(e) => e.stopPropagation()} />
  );
}

// red dustbin (stroke inherits color — .tp-bin sets the red)
const Bin = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 6.5h17M9.5 6.5V4.4h5v2.1M18.8 6.5l-1 14h-11.6l-1-14M10 11v6M14 11v6" />
  </svg>
);

// pencil (edit) — stroke inherits color via .tp-icon-btn
const Pencil = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L18.5 9.5a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

// clear the local teaching state (bookmark + chapter binding) of one removed section
const clearSectionState = (subjName, gradeRoman, tag) => {
  const key = `${subjectSlugOf(subjName)}_${(gradeRoman || "").toLowerCase()}_${tag}`;
  try {
    window.localStorage.removeItem(`lu_pointer_${key}`);
    window.localStorage.removeItem(`current_chapter_${key}`);
    window.localStorage.removeItem(`lu_done_${key}`);
  } catch {}
  pushSectionState(key);   // chapter gone → the server drops this section's row too
};

/* Stage of a roman grade (client copy of grades.stage_for — the scope unit is
 * "{subject}/{stage}"). */
const stageOfRoman = stageOfGrade;   // lib/format is the web's ONE copy of the mapping

export default function TeachingProfile({ readiness, onChange, onBack, lapsed, paidScopes, autoAddClassSubject, onConsumeAutoAdd, portalIntent, onConsumePortal, portalScope, onSubscribe }) {
  // SINGLE SOURCE OF TRUTH: the profile lives in the parent's `readiness` prop. Derive the
  // canonical subjects[] straight from it — no mirrored local copy. That way an edit (which
  // routes through persist → onChange → setReadiness) re-renders THIS view and every other
  // consumer from the exact same object, so edits reflect live the instant they save, exactly
  // like adds do. `canon` is READ-only here; every mutation deep-copies before touching it, so
  // deriving (not copying into state) is safe and removes the mirror-state desync.
  const canon = (readiness && readiness.subjects) || [];

  /* view state */
  const [openSubject, setOpenSubject] = useState(null);  // accordion: name of the ONE open subject
  const [editing, setEditing] = useState(false);         // master edit toggle
  const [confirm, setConfirm] = useState(null);          // { kind:"subject"|"grade"|"section", si, gi?, sec? }

  /* flow state (conversational screens) */
  // screen: view | pickSubjects | classes | class | subjectDone | addSection | editNums
  //         | editSections | portalSubject | portalClass
  const [screen, setScreen] = useState("view");
  // "add" (the gear's + buttons: only NEW options offered) vs "manage" (the My Classes "+"
  // portal: enrolled options shown pre-ticked; unticking one = removal behind the same scoped
  // warning the dustbins use — warned, never blocked, since mid-year reassignments are real).
  const [pickMode, setPickMode] = useState("add");      // pickSubjects screen
  const [classMode, setClassMode] = useState("add");    // classes screen
  // "class" | "section" | "ppw" | "budget" — what the portal pick leads to once the subject
  // (and, where needed, the class) is known. ppw/budget joined on 2026-08-27: the "+" window
  // now offers all FIVE things first run assumes, not just the three structural levels.
  const [portalGoal, setPortalGoal] = useState(null);
  const [portalSi, setPortalSi] = useState(null);       // portal: chosen subject index (section goal)
  const [subConfirm, setSubConfirm] = useState(null);   // { removes:[names], adds:[names] } — manage-subjects warning
  /* ★ The DOUBLE confirmation for removing a subject (founder, 2026-08-27: "ok to suggestion on
     master edit to remove subject with double strong warning now before it is done").
     { si, name, step } — step 1 states exactly what goes; step 2 asks her to mean it. Two steps
     rather than one because this is now the ONLY destructive act left on this screen and it is
     unrecoverable: her classes, sections, bookmarks and chapter bindings for that subject go
     with it. The lesson PLANS survive — they are shared library content, never per-teacher
     copies (CLOUD_DATA_MODEL §2.3) — and step 1 says so, because a teacher who thinks she is
     about to delete her lesson plans will not read the rest of the warning. */
  const [removeSubject, setRemoveSubject] = useState(null);
  const [classConfirm, setClassConfirm] = useState(null); // { removes:[romans], adds:[romans] } — manage-classes warning
  const [fromPortal, setFromPortal] = useState(false);  // visit began at My Classes' "+" → every exit returns there
  // Back links still route through setScreen("view"); on a portal visit the bounce effect
  // (below) forwards that to My Classes, so the label says where she'll actually land.
  // A portal visit is launched from the ONE portal window, and every exit re-opens it
  // (founder, 2026-08-27: "back should lead to the window and not to class") — so the label is
  // a plain "← Back". It said "← Back to My Classes" while the window's rows were a one-way
  // door: each amendment dropped her on her cards and she had to reopen the window per item.
  const backLabel = fromPortal ? "← Back" : "← Back to profile";
  const [catalogue, setCatalogue] = useState([]);        // all offerable subject display names
  const [queue, setQueue] = useState([]); const [qi, setQi] = useState(0); // addSubject queue
  const [picked, setPicked] = useState([]);              // generic multi-pick buffer
  // { letter: her own name } while a SECTION pick screen is open (addSection / editSections).
  // The conversational class run keeps its copy on the grade draft instead (g.section_names),
  // because that whole flow is one draft object saved at the end.
  const [secNames, setSecNames] = useState({});
  const [gradeOptions, setGradeOptions] = useState([]);  // roman uppercase, current subject
  const [draft, setDraft] = useState(null);              // { name, grades:[gradeDraft], existingCount }
  const [pendingIdxs, setPendingIdxs] = useState([]);    // draft.grades indices still to be asked
  const [pi, setPi] = useState(0);                       // position inside pendingIdxs
  const [classStep, setClassStep] = useState("sections"); // sections | durations | ppw | budget
  const [numCtx, setNumCtx] = useState(null);            // editNums: { si, gi, g(draft), step }
  // Annual-period figures for the budget "estimate" method. `recTotal` is Aruvi's CALIBRATED
  // budget for this subject·class (master_plan.json) and leads the line; `ncfTotal` is the
  // published NCF norm, shown alongside (founder, 2026-07-26 — show both). Kept identical to
  // FirstRun's copy of the same screen.
  const [ncfTotal, setNcfTotal] = useState(null);        // NCF published annual periods
  const [recTotal, setRecTotal] = useState(null);        // Aruvi's calibrated annual periods
  const [secConfirm, setSecConfirm] = useState(null);    // { removed:[tags] } — warn before an edit-sections save drops sections

  // pin the top block just below the app's sticky header — measure the header so the offset
  // is exact across desktop/mobile rather than a guessed pixel value
  const rootRef = useRef(null);
  useEffect(() => {
    const setTop = () => {
      const el = rootRef.current;
      if (!el) return;
      // In shell mode (html.app-shell) the scrollport is .bodycontent, which starts BELOW the
      // static top bar — so the pinned block sits at the scrollport's own top, offset 0.
      const shell = typeof document !== "undefined" && document.documentElement.classList.contains("app-shell");
      const h = shell ? 0 : ((typeof document !== "undefined" && document.querySelector(".hdr")?.offsetHeight) || 60);
      el.style.setProperty("--tp-sticky-top", `${h}px`);
      const sticky = el.querySelector(".tp-sticky");
      const sh = sticky ? sticky.offsetHeight : 0;
      el.style.setProperty("--tp-sub-top", `${h + sh}px`); // open subject header pins just below the top block
    };
    setTop();
    window.addEventListener("resize", setTop);
    return () => window.removeEventListener("resize", setTop);
  }, [canon, editing]);

  useEffect(() => {
    getJSON("/subjects").then((d) => setCatalogue((d.subjects || []).map(pretty))).catch(() => setCatalogue([]));
  }, []);
  // keep the accordion pointing at a real subject
  useEffect(() => {
    if (!canon.length) { setOpenSubject(null); return; }
    if (!canon.some((s) => s.name === openSubject)) setOpenSubject(canon[0].name);
  }, [canon]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arrived from the My Classes "add more classes in this subject" prompt: open that subject
  // and launch the SAME add-a-class flow the "+ add a class" button uses, then tell the parent
  // to clear the directive. Guarded to run once (a re-render must not relaunch it).
  const autoAddDoneRef = useRef(false);
  useEffect(() => {
    if (!autoAddClassSubject || autoAddDoneRef.current) return;
    const si = canon.findIndex((s) => s.name === autoAddClassSubject);
    if (si < 0) return; // wait until canon carries the subject
    autoAddDoneRef.current = true;
    setOpenSubject(autoAddClassSubject);
    startAddClass(si);
    onConsumeAutoAdd && onConsumeAutoAdd();
  }, [autoAddClassSubject, canon]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arrived from My Classes' standing "+" portal (founder, 2026-07-06): launch the manage
  // screen for the chosen level — Subject straight in; Class/Section via a subject (and class)
  // pick first, skipped when there is only one. Same one-shot guard as the auto-add directive.
  const portalDoneRef = useRef(false);
  useEffect(() => {
    if (!portalIntent || portalDoneRef.current || !canon.length) return;
    portalDoneRef.current = true;
    setFromPortal(true);
    /* ★ A SCOPED visit names the SUBJECT up front — the added-a-subject window is about one new
       thing, so asking "in which subject?" over her whole profile is asking her a question she
       has already answered (founder, 2026-08-27). Resolved against `canon` rather than trusted,
       so a scope naming something she has since removed falls back to the ordinary pick screens.
       ★ IT DOES NOT NAME THE CLASS (founder, same day — the bug): the scope carries the grade
       she was SEEDED with, and this used to route straight into that one class's sections. So a
       teacher who added SS·Middle and then ticked 6, 7 and 8 tapped Section and landed in 6's
       section letters, never asked which of the three she meant. The scope's grade is only ever
       a STAGE marker here (see portalGradeIdxs); which class is a question, and the pick screen
       asks it — skipped only when the stage leaves exactly one. */
    const sSi = portalScope ? canon.findIndex((s) => s.name === portalScope.subject) : -1;
    if (portalIntent === "subject") {
      // Never scoped in practice — neither window has a Subject row any more (ProfilePortal's
      // ROWS). Whole-profile by nature in any case: this is the add/remove-a-subject chooser.
      startManageSubjects();
    } else if (portalIntent === "class") {
      if (sSi >= 0) startManageClasses(sSi);
      else if (canon.length === 1) startManageClasses(0);
      else { setPortalGoal("class"); setScreen("portalSubject"); }
    } else if (PER_CLASS_GOALS.includes(portalIntent)) {
      // section | ppw | budget — all per subject·class. Set the goal for the pick screens AND
      // pass it along, since the direct cases route before that state has settled.
      setPortalGoal(portalIntent);
      if (sSi >= 0) portalPickClass(portalIntent, sSi);
      else if (canon.length === 1) portalPickClass(portalIntent, 0);
      else setScreen("portalSubject");
    }
    onConsumePortal && onConsumePortal();
  }, [portalIntent, canon]); // eslint-disable-line react-hooks/exhaustive-deps

  // A portal-initiated visit ALWAYS ends where it BEGAN, never on the profile accordion
  // (founder, 2026-07-06): every exit — completing the flow, cancelling, or any "back" link —
  // returns her to the door she came in by. Every flow ending funnels through setScreen("view"),
  // so this one bounce covers them all. onBack is page.jsx's goPortalHome, which was plain
  // goClasses until 2026-08-27: the door is now the PORTAL WINDOW itself (restored over the tab
  // she was on), because a window that says "amend any of these items" must still be there for
  // the second item.
  useEffect(() => {
    if (fromPortal && screen === "view") onBack && onBack();
  }, [fromPortal, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set ONLY on a verified mismatch (never on a throw, never on an unreachable server).
  const [saveFailed, setSaveFailed] = useState(false);

  const persist = (subjectsOut) => {
    // Optimistic: push straight to the parent so the view reflects instantly — no local mirror
    // to keep in step. setReadiness re-renders this component with the new subjects[] (which
    // `canon` derives from) and every consumer.
    onChange && onChange(projectReadiness({ subjects: subjectsOut }));

    // ── READ-AFTER-WRITE (founder doctrine, 2026-08-10; lib/verify.js) ────────────────
    // X = the profile before this edit · A = this save · Y = subjectsOut, which she just
    // composed and which we therefore know UPFRONT · Y′ = GET /readiness.
    // Error IF AND ONLY IF Y′ ≠ Y. The POST throwing is not a criterion (a 200 can lie; a
    // lost response can hide a write that landed), and an unreachable server is NOT an
    // error — it is a state in which the check cannot be run, and presuming failure there
    // would invent a fact. Hence three outcomes, and only the middle one speaks.
    //
    // cascade:true stays, and is unrelated to this: every destructive edit here is already
    // behind its own scoped confirm, so the server's 409 guard would be a second ask.
    const want = readinessFingerprint(subjectsOut);
    verifiedWrite({
      write: () => fetch(`${API}/readiness`, withUser({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects: subjectsOut, cascade: true }),
      })).then((r) => { if (!r.ok) throw new Error(String(r.status)); }),
      read: () => getJSON("/readiness").then((d) => (d && d.readiness) || d || {}),
      expect: (y) => readinessFingerprint(y.subjects) === want,
    }).then(({ status, actual }) => {
      if (status !== "mismatch") return;          // ok → silence; unverified → silence
      // Y′ is the truth. Telling her AND leaving her edit on screen would recreate the exact
      // divergence this check exists to catch, so the view is re-synced to what is actually
      // stored — she sees the real state and the sentence that explains it.
      onChange && onChange(projectReadiness({ subjects: (actual && actual.subjects) || [] }));
      setSaveFailed(true);
    });
  };

  /* ── granular removals (each behind its scoped confirm) ── */
  const doRemove = () => {
    const { kind, si, gi, sec } = confirm;
    const next = deepCopy(canon);
    const sub = next[si];
    if (kind === "section") {
      const g = sub.grades[gi];
      clearSectionState(sub.name, g.grade, `${classNum(g.grade)}${sec}`);
      g.sections = g.sections.filter((x) => secLetter(x) !== sec);
      if (!g.sections.length) {              // cascade: last section takes the class
        const oldGrades = sub.grades;
        sub.grades = sub.grades.filter((_, i) => i !== gi);
        sub.budget = rekeyBudget(oldGrades, sub.budget, sub.grades);
        sub.grids = sub.grades.map((gr) => gr.sections.map(() => Array(DAYS_IN_WEEK).fill(-1)));
      } else {
        sub.grids = sub.grades.map((gr) => gr.sections.map(() => Array(DAYS_IN_WEEK).fill(-1)));
      }
    }
    if (kind === "grade") {
      const g = sub.grades[gi];
      g.sections.forEach((x) => clearSectionState(sub.name, g.grade, `${classNum(g.grade)}${secLetter(x)}`));
      const oldGrades = sub.grades;
      sub.grades = sub.grades.filter((_, i) => i !== gi);
      sub.budget = rekeyBudget(oldGrades, sub.budget, sub.grades);
      sub.grids = sub.grades.map((gr) => gr.sections.map(() => Array(DAYS_IN_WEEK).fill(-1)));
    }
    if (kind === "subject") {
      sub.grades.forEach((g) => g.sections.forEach((x) =>
        clearSectionState(sub.name, g.grade, `${classNum(g.grade)}${secLetter(x)}`)));
    }
    const out = (kind === "subject" || !next[si].grades.length)
      ? next.filter((_, i) => i !== si)      // cascade: last class takes the subject
      : next;
    persist(out);
    setConfirm(null);
  };

  // scoped confirm copy: name exactly what goes, promise what stays
  const confirmCopy = () => {
    const { kind, si, gi, sec } = confirm;
    const sub = canon[si];
    if (kind === "section") {
      const g = sub.grades[gi];
      const tag = `${classNum(g.grade)}${sec}`;
      const last = g.sections.length === 1;
      return {
        title: `Remove Section ${tag}?`,
        body: `Its card and bookmark will be removed.${last ? ` It is the last section — Class ${classNum(g.grade)} goes with it.` : ""} Your lessons stay in the library.`,
        cta: `Yes, remove ${tag}`,
      };
    }
    if (kind === "grade") {
      const g = sub.grades[gi];
      const tags = g.sections.map((x) => `${classNum(g.grade)}${secLetter(x)}`).join(", ");
      const last = sub.grades.length === 1;
      return {
        title: `Remove Class ${classNum(g.grade)} from ${sub.name}?`,
        body: `${tags} — their cards and bookmarks — will be removed.${last ? ` It is the last class — ${sub.name} goes with it.` : ""} Your lessons stay in the library.`,
        cta: `Yes, remove Class ${classNum(g.grade)}`,
      };
    }
    const classes = sub.grades.map((g) => `Class ${classNum(g.grade)}`).join(", ");
    return {
      title: `Remove ${sub.name}?`,
      body: `${classes || "Its classes"} — all cards and bookmarks — will be removed. Your lessons stay in the library.`,
      cta: `Yes, remove ${sub.name}`,
    };
  };

  /* ── add flows ── */
  const startAddSubject = () => { setPicked([]); setPickMode("add"); setClassMode("add"); setScreen("pickSubjects"); };

  /* ── manage flows (the My Classes "+" portal) — same screens, enrolled options pre-ticked;
     unticking removes behind ONE scoped warning. Warned, never blocked. ── */
  const startManageSubjects = () => {
    setPicked(canon.map((s) => s.name));
    setPickMode("manage"); setClassMode("add");
    setScreen("pickSubjects");
  };
  const startManageClasses = (si) => {
    setClassMode("manage");
    setQueue([canon[si].name]); setQi(0);
    beginSubjectRun(canon[si].name);
    setPicked((canon[si].grades || []).map((g) => g.grade)); // pre-tick enrolled (beginSubjectRun clears picked)
  };
  // ── Per-CLASS portal goals (section · periods a week · the year's total) ──
  // All three are edits to ONE subject·class, so they share the same two pick screens and differ
  // only in the screen they land on. `goal` is passed explicitly rather than read off portalGoal
  // state, because the intent effect below chooses and routes in the SAME tick (state would still
  // hold the previous render's value) — the same argument-not-state rule FirstRun's
  // finishActivation follows.
  const portalOpen = (goal, si, gi) => {
    if (goal === "section") startEditSections(si, gi);
    else startEditNums(si, gi, goal === "budget" ? "budget" : "ppw");
  };
  /* The class indices a portal goal may act on for subject `si`: all of them, or — on a scoped
     visit — only the purchased STAGE's, since the settled stage's classes are not what this
     window is about. Falls back to all if the filter leaves nothing (a scope whose stage she has
     since emptied), so a pick screen is never rendered blank. ONE definition, used by both the
     skip-the-screen test below and the screen itself, or the two could disagree.

     ★ `exact` (2026-08-27) — the scope names the CLASS, not just its stage. This is the
     deliberate exception to "the scope narrows the subject, never the class": that rule exists
     because a teacher who just bought a STAGE may teach several classes in it, so which one she
     means is a real question. Year Plan's budget pencil is the opposite case — she is standing
     IN one subject·class looking at its chapter split, so asking is re-asking something the
     screen has already answered. Expressed as a narrower FILTER rather than a second routing
     branch, so the single-index case falls through portalPickClass's existing "straight in when
     only ONE class is in play" and the skip test cannot drift from the screen. */
  const portalGradeIdxs = (si) => {
    const sub = canon[si]; const grades = (sub && sub.grades) || [];
    const scoped = portalScope && portalScope.grade && sub && portalScope.subject === sub.name;
    if (scoped && portalScope.exact) {
      const want = String(portalScope.grade).toLowerCase();
      const one = grades.map((g, gi) => (String(g.grade).toLowerCase() === want ? gi : -1))
        .filter((i) => i >= 0);
      if (one.length) return one;
      // The named class is gone (removed since the pencil was drawn) — fall through to the
      // stage filter below rather than opening on a class she no longer teaches.
    }
    const st = scoped ? stageOfRoman(portalScope.grade) : null;
    if (!st) return grades.map((_, gi) => gi);
    const hit = grades.map((g, gi) => (stageOfRoman(g.grade) === st ? gi : -1)).filter((i) => i >= 0);
    return hit.length ? hit : grades.map((_, gi) => gi);
  };
  // Subject chosen → straight in when only ONE class is in play, else ask which class first.
  const portalPickClass = (goal, si) => {
    const idxs = portalGradeIdxs(si);
    if (idxs.length === 1) portalOpen(goal, si, idxs[0]);
    else { setPortalSi(si); setScreen("portalClass"); }
  };

  const startSubjectAdds = (adds) => { setClassMode("add"); setQueue(adds); setQi(0); beginSubjectRun(adds[0]); };
  const onManageSubjectsContinue = () => {
    const enrolled = canon.map((s) => s.name);
    const adds = picked.filter((n) => !enrolled.includes(n));
    const removes = enrolled.filter((n) => !picked.includes(n));
    if (!adds.length && !removes.length) { setScreen("view"); return; }
    if (removes.length) setSubConfirm({ removes, adds });
    else startSubjectAdds(adds);
  };
  /* Remove ONE subject, from the accordion's dustbin, after both confirmations. Clears the same
     per-section teaching state `applySubjectChanges` clears — one subject's worth — so a removal
     from here and a removal from the manage screen leave the profile in the same condition.
     ★ Removing the LAST subject is allowed (the keep-≥1 rule was retired 2026-08-24): an emptied
     profile shows the empty state's "+ add a subject" in-session, and lands on first run after a
     fresh sign-in. Warned, never blocked — the profile's standing rule. */
  const applyRemoveSubject = () => {
    const name = removeSubject && removeSubject.name;
    const next = deepCopy(canon).filter((s) => {
      if (s.name !== name) return true;
      (s.grades || []).forEach((g) => (g.sections || []).forEach((x) =>
        clearSectionState(s.name, g.grade, `${classNum(g.grade)}${secLetter(x)}`)));
      return false;
    });
    persist(next);
    setRemoveSubject(null);
    setEditing(false);          // the one act edit mode exists for is done
  };
  const applySubjectChanges = () => {
    const { removes, adds } = subConfirm;
    const next = deepCopy(canon).filter((s) => {
      if (!removes.includes(s.name)) return true;
      s.grades.forEach((g) => g.sections.forEach((x) =>
        clearSectionState(s.name, g.grade, `${classNum(g.grade)}${secLetter(x)}`)));
      return false;
    });
    persist(next);
    setSubConfirm(null);
    if (adds.length) startSubjectAdds(adds);
    else setScreen("view");
  };

  // seed the conversational run for ONE subject; pending = which grades still get questions
  const beginSubjectRun = (name) => {
    const existing = canon.find((s) => s.name === name);
    const grades = existing ? (existing.grades || []).map(gradeDraftFrom) : [];
    if (existing && existing.budget) {
      grades.forEach((g, i) => {
        const b = existing.budget[i] ?? existing.budget[String(i)];
        if (b) g.budget = { ...b };
      });
    }
    setDraft({ name, grades });
    setPicked([]);
    setGradeOptions([]);
    getJSON(`/subjects/${subjectSlugOf(name)}/grades`).then((d) => {
      const gs = [...(d.grades || [])].sort((a, b) => ROMAN.indexOf(a) - ROMAN.indexOf(b));
      setGradeOptions(gs.map((g) => g.toUpperCase()));
    }).catch(() => setGradeOptions([]));
    setScreen("classes");
  };

  const onSubjectsPicked = () => {
    const q = [...picked];
    setQueue(q); setQi(0);
    beginSubjectRun(q[0]);
  };

  const startAddClass = (si) => {
    setClassMode("add");
    setQueue([canon[si].name]); setQi(0);
    beginSubjectRun(canon[si].name);
  };

  // classes step continue: NEW grades only get questions; existing ones keep their answers.
  // Shared by the add path (base = current draft grades) and the manage path (base = the
  // grades KEPT after a removal confirm).
  const continueWithGrades = (baseGrades, addedRomans) => {
    const all = [...baseGrades, ...addedRomans.map((roman) => ({
      grade: roman, sections: [], durations: [DEFAULT_DURATION],
      ppw_by_duration: { [DEFAULT_DURATION]: DEFAULT_PPW },
      ppw_anchor: DEFAULT_DURATION,
      periods_per_week: DEFAULT_PPW, budget: null,
    }))].sort((a, b) => byRoman(a.grade, b.grade));
    const pend = all.map((g, i) => (addedRomans.includes(g.grade) ? i : -1)).filter((i) => i >= 0);
    setDraft((d) => ({ ...d, grades: all }));
    setPendingIdxs(pend); setPi(0); setClassStep("sections");
    setScreen("class");
  };
  const onClassesContinue = () => {
    const have = draft.grades.map((g) => g.grade);
    continueWithGrades(draft.grades, picked.filter((g) => !have.includes(g)));
  };
  // Manage-classes continue: unticked enrolled classes = removals (warned first); newly ticked
  // ones queue the usual per-class questions afterwards.
  /* ★ MANAGE-MODE ADDS ARE APPLIED WITH DEFAULTS — NO DOWNSTREAM RUN (founder, 2026-08-27).
   * The bug: a teacher who bought Science·Middle and was started on 6A opens the window, ticks
   * Class 7, and is then walked through 7's sections · durations · periods · budget — "it asks
   * only 7's sections and leaves 6 behind". Two things were wrong with that. It made ONE row of
   * the window ask four questions, when the window's own promise is that each item changes only
   * itself; and it silently divided her classes into one that had been interrogated and one that
   * had not. So a class added HERE is added the way first run adds one: **Section A**, the
   * default period length, the default periods a week, and the auto budget. She sets the rest,
   * per class, through the window's OTHER rows — which is what they are for.
   * Applies to `manage` mode only (both portal windows AND the accordion's class pencil, which
   * is the same tick-to-add/untick-to-remove screen). The green "+ add a class" button keeps its
   * conversational run: there she is building something new and has asked to be asked. */
  /* ★ SEEDED FROM THE CALIBRATED STANDARD, like first run (2026-08-27). This path adds a class
     WITHOUT asking anything, so whatever it seeds is what she will be shown — and a flat
     DEFAULT_PPW of 6 beside a calibrated year of 245 is the contradiction this day's work
     exists to end (the profile printed both on one line: "245 periods for the year, at 6 a
     week" = 40.8 weeks). The check window raised for a newly added class shows these very
     figures, so they have to agree the moment they are written, not after she corrects them.

     Fetched per added class because the calibrated total is per subject·CLASS. Failure is
     harmless and silent: `null` leaves the old flat defaults, which is exactly where this
     path stood before. */
  const applyManageClasses = async (keep, adds) => {
    const totals = await Promise.all(adds.map((roman) =>
      getJSON(`/subjects/${subjectSlugOf(draft.name)}/${roman.toLowerCase()}/ncf-periods`)
        .then((d) => (d && d.recommended_total_periods) || null)
        .catch(() => null)));
    const all = [...keep, ...adds.map((roman, i) => {
      const annual = totals[i];
      const ppw = (annual && ppwFromAnnual(annual)) || DEFAULT_PPW;
      return {
        grade: roman,
        sections: ["A"],                                 // first run's own rule — start her on {n}A
        durations: [DEFAULT_DURATION],
        ppw_by_duration: { [DEFAULT_DURATION]: ppw },
        ppw_anchor: DEFAULT_DURATION,
        periods_per_week: ppw,
        // The calibrated year when Aruvi has one; null falls through to finalizeSubject's
        // legacy auto record, which the budget step now normalizes on open.
        budget: annual ? { method: "periods", value: annual } : null,
      };
    })].sort((a, b) => byRoman(a.grade, b.grade));
    saveSubject({ ...draft, grades: all });
    setScreen("view");
  };
  const onManageClassesContinue = () => {
    const have = draft.grades.map((g) => g.grade);
    const adds = picked.filter((g) => !have.includes(g));
    const removes = have.filter((g) => !picked.includes(g));
    if (!adds.length && !removes.length) { setScreen("view"); return; }
    if (removes.length) setClassConfirm({ removes, adds });
    else applyManageClasses(draft.grades, adds);
  };
  const applyClassChanges = () => {
    const { removes, adds } = classConfirm;
    // Removed classes lose their section bookmarks (draft grade sections are letters).
    draft.grades.forEach((g) => {
      if (removes.includes(g.grade)) g.sections.forEach((sec) =>
        clearSectionState(draft.name, g.grade, `${classNum(g.grade)}${sec}`));
    });
    const keep = draft.grades.filter((g) => !removes.includes(g.grade));
    setClassConfirm(null);
    // Only ever reached from manage mode (classConfirm is set nowhere else), so adds are applied
    // with defaults here too — see applyManageClasses.
    if (adds.length) applyManageClasses(keep, adds);
    else if (keep.length) { saveSubject({ ...draft, grades: keep }); setScreen("view"); }
    else {
      // last class taken away and nothing added — the subject goes with it (warned in the confirm)
      persist(deepCopy(canon).filter((s) => s.name !== draft.name));
      setScreen("view");
    }
  };

  const gIdx = pendingIdxs[pi];
  const updGrade = (patch) => setDraft((d) => ({
    ...d, grades: d.grades.map((g, i) => (i === gIdx ? { ...g, ...patch } : g)),
  }));

  // fetch the NCF-recommended annual periods whenever a budget screen is showing, so the
  // "estimate" option reflects the National Curricular Framework figure for this subject·grade
  const inClassBudget = screen === "class" && classStep === "budget";
  const inEditBudget = screen === "editNums" && numCtx && numCtx.step === "budget";
  const budgetSubject = inClassBudget ? (draft && draft.name)
    : inEditBudget ? (canon[numCtx.si] && canon[numCtx.si].name) : null;
  const budgetGrade = inClassBudget ? (draft && draft.grades[gIdx] && draft.grades[gIdx].grade)
    : inEditBudget ? (numCtx.g && numCtx.g.grade) : null;
  useEffect(() => {
    if (!budgetSubject || !budgetGrade) return;
    let live = true;
    setNcfTotal(null);
    setRecTotal(null);
    getJSON(`/subjects/${subjectSlugOf(budgetSubject)}/${budgetGrade.toLowerCase()}/ncf-periods`)
      .then((d) => {
        if (!live || !d) return;
        setNcfTotal(d.ncf_total_periods != null ? d.ncf_total_periods : null);
        setRecTotal(d.recommended_total_periods != null ? d.recommended_total_periods : null);
      })
      .catch(() => { if (live) { setNcfTotal(null); setRecTotal(null); } });
    return () => { live = false; };
  }, [budgetSubject, budgetGrade]);

  /* Aruvi's own recommendation for this subject·class, shown under the input she is about to
     disagree with. The calibrated master-plan figure leads; the published NCF norm sits in
     brackets behind it when it differs. */
  const recommendSubLine = () => {
    if (recTotal != null) {
      // ★ "based on general norms" (founder, 2026-08-28) — the figure is a calibrated standard
      // for the class, not a reading of HER year, and the line has to say so: she is being
      // invited to disagree with it, which she cannot do if it sounds like a fact about her.
      return `Meyy recommends ${recTotal} periods a year based on general norms for this class.`
        + (ncfTotal != null && ncfTotal !== recTotal ? ` (NCF norm: ${ncfTotal})` : "");
    }
    if (ncfTotal != null) return `As per NCF, this class requires ${ncfTotal} periods.`;
    return null;
  };

  /* ════════════ THE BUDGET STEP — ONE renderer, TWO callers ════════════
   * Class set-up and the numbers editor showed byte-identical budget screens, which is how the
   * four-method version came to need the same fix twice. One function now, so they cannot drift.
   *
   * The weeks reading under the input is the whole reason the other three methods could go: it
   * gives her the WEEKS those methods were clumsily trying to provide, without a second input to
   * contradict the first. She types 215, Aruvi says "27 weeks (@ 8 periods/week)" — and she can
   * tell at once whether that is her year. If the weeks look wrong because the ppw is wrong, the
   * pencil goes and fixes that side. Aruvi adjusts NOTHING on her behalf.
   *
   * ★ THE SENSE-CHECK IS A READING, NOT A SENTENCE (founder, 2026-08-28). It used to be a full
   * line of prose — "Based on 8 periods a week ✎ for this subject, 245 periods is about 31
   * teaching weeks." — and this screen was carrying it BELOW a recommendation that is itself a
   * sentence, under a heading, over a footer. Three paragraphs to change one number. The same
   * two facts now sit directly under the figure they describe, in the small mono of a caption:
   * "31 weeks (@ 8 periods/week)". The pencil rides along, because it is still the only door to
   * the other side of that arithmetic. */
  const renderBudgetStep = ({ kicker, heading, ppw, b, setValue, stepValue,
                              onPpwPencil, footer }) => {
    const annual = budgetPeriods(ppw, b);
    const weeks = weeksFromAnnual(annual, ppw);
    const rec = recommendSubLine();
    return (
      <div className="tp tp-budget">
        <div className="kicker kicker-ochre">{kicker}</div>
        <h1 className="fr-q">{heading}</h1>
        {/* No sub-hint here (founder, 2026-08-27). It restated the heading in longer words —
            "How many periods for the year?" / "How many periods do you have for this subject
            over the year?" — and the screen already answers it twice more below: Aruvi's
            recommendation, then the implied-weeks sense-check. */}
        <div className="tp-val-row tp-val-solo">
          <button type="button" className="tp-val-btn" onClick={() => stepValue(-1)} aria-label="Fewer periods">−</button>
          <input type="number" className="tp-val-input" min="1" value={b.value}
            onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
            aria-label="Annual period budget" />
          <button type="button" className="tp-val-btn" onClick={() => stepValue(1)} aria-label="More periods">+</button>
          <span className="tp-val-unit">periods / year</span>
        </div>
        {/* The sense-check, directly under the figure it reads. Advisory, never corrective. */}
        {annual > 0 && ppw > 0 ? (
          <p className="tp-weeks">
            {weeks} weeks (@ {ppw} periods/week)
            {onPpwPencil ? (
              <button type="button" className="tp-implies-edit" onClick={onPpwPencil}
                title="Change periods a week"
                aria-label="Change periods a week for this class"><Pencil size={13} /></button>
            ) : null}
          </p>
        ) : null}
        {rec ? <p className="tp-estimate-sub">{rec}</p> : null}
        {footer}
      </div>
    );
  };

  // finalize the draft into a canonical record and persist (upsert by name)
  /* Build the canonical record and SAVE it. The building half moved to @aruvi/shared/profile
     (Track D 5d F2, 2026-09-15) so the phone emits byte-identical records — the fingerprint
     compares what a teacher can change, so a record spelled differently on one surface would
     read back as a mismatch and tell her work was lost that was merely spelled differently.
     What stays here is the half that is this component's own: where the record goes. */
  const saveSubject = (d) => {
    const rec = finalizeSubject(d, { daysInWeek: DAYS_IN_WEEK });
    const idx = canon.findIndex((s) => s.name === rec.name);
    persist(idx >= 0 ? canon.map((s, i) => (i === idx ? rec : s)) : [...canon, rec]);
    setOpenSubject(rec.name);
  };

  const onClassDone = () => {
    if (pi + 1 < pendingIdxs.length) { setPi(pi + 1); setClassStep("sections"); return; }
    saveSubject(draft);
    if (qi + 1 < queue.length) setScreen("subjectDone");  // checkpoint between added subjects
    else setScreen("view");
  };

  /* ── spot edits ── */
  const startAddSection = (si, gi) => {
    setNumCtx({ si, gi }); setPicked([]);
    // The letters already enrolled keep their names even though this screen cannot see them —
    // seeded so a save re-emits them rather than silently dropping every existing label.
    setSecNames(namesFromSections(canon[si].grades[gi].sections));
    setScreen("addSection");
  };

  // pencil next to the sections → one screen to add AND remove (keep ≥1; whole-class delete stays on the basket)
  const startEditSections = (si, gi) => {
    setNumCtx({ si, gi });
    setPicked(canon[si].grades[gi].sections.map(secLetter));
    setSecNames(namesFromSections(canon[si].grades[gi].sections));
    setScreen("editSections");
  };
  // Save intent: if the edit drops any existing sections, warn first (same as the basket removals);
  // pure additions save straight through.
  const requestEditSections = () => {
    const { si, gi } = numCtx;
    const g = canon[si].grades[gi];
    const removed = g.sections.map(secLetter).filter((s) => !picked.includes(s));
    if (removed.length) setSecConfirm({ removed: removed.map((sec) => `${classNum(g.grade)}${sec}`) });
    else applyEditSections();
  };
  const applyEditSections = () => {
    const { si, gi } = numCtx;
    const next = deepCopy(canon);
    const sub = next[si]; const g = sub.grades[gi];
    const before = g.sections.map(secLetter);
    const after = [...picked].sort();
    before.filter((s) => !after.includes(s)).forEach((sec) =>
      clearSectionState(sub.name, g.grade, `${classNum(g.grade)}${sec}`));
    g.sections = after.map((sec) => secObj(g.grade, sec, secNames));
    sub.grids = sub.grades.map((gr) => gr.sections.map(() => Array(DAYS_IN_WEEK).fill(-1)));
    persist(next);
    setSecConfirm(null);
    setScreen("view");
  };
  const saveAddSection = () => {
    const { si, gi } = numCtx;
    const next = deepCopy(canon);
    const g = next[si].grades[gi];
    const have = g.sections.map(secLetter);
    [...picked].sort().forEach((sec) => {
      if (!have.includes(sec)) g.sections.push(secObj(g.grade, sec, secNames));
    });
    g.sections.sort((a, b) => (secLetter(a) < secLetter(b) ? -1 : 1));
    next[si].grids = next[si].grades.map((gr) => gr.sections.map(() => Array(DAYS_IN_WEEK).fill(-1)));
    persist(next);
    setScreen("view");
  };

  const startEditNums = (si, gi, step = "ppw") => {
    const sub = canon[si];
    const g = gradeDraftFrom(sub.grades[gi]);
    const b = (sub.budget || {})[gi] ?? (sub.budget || {})[String(gi)];
    if (b) g.budget = { ...b };
    setNumCtx({ si, gi, g, step });
    setScreen("editNums");
  };
  const updNum = (patch) => setNumCtx((c) => ({ ...c, g: { ...c.g, ...patch } }));
  // save from ANY single field-edit screen; unedited fields keep their loaded values
  const saveEditNums = (finalBudget) => {
    const { si, gi, g } = numCtx;
    const next = deepCopy(canon);
    const rec = next[si].grades[gi];
    const ppwMap = normPpw(g.durations, g.ppw_by_duration, g.periods_per_week, g.ppw_anchor);
    rec.durations = [...g.durations];
    rec.ppw_by_duration = ppwMap;
    rec.ppw_anchor = ppwAnchor(g.durations, ppwMap, g.ppw_anchor);
    rec.periods_per_week = ppwMapSum(ppwMap);
    const budget = finalBudget || g.budget
      || (next[si].budget || {})[gi] || (next[si].budget || {})[String(gi)]
      || { method: "auto", value: 0 };
    next[si].budget = { ...(next[si].budget || {}), [gi]: budget };
    persist(next);
    setScreen("view");
  };

  /* ════════════════════ conversational screens ════════════════════ */

  // Portal pick screens — the "+" chose Class or Section; ask which subject (and class) first.
  if (screen === "portalSubject") {
    const what = GOAL_WORD[portalGoal] || "sections";
    return (
      <div className="tp">
        <div className="kicker kicker-ochre">Your teaching · {what}</div>
        <h1 className="fr-q">In which subject?</h1>
        <p className="fr-hint">{portalGoal === "class"
          ? "Pick the subject whose classes you want to change."
          : `Pick the subject, then the class whose ${what} you want to change.`}</p>
        <div className="tp-portal-list">
          {canon.map((s, si) => (
            <button key={s.name} type="button" className="tp-portal-row"
              onClick={() => (portalGoal === "class" ? startManageClasses(si) : portalPickClass(portalGoal, si))}>
              <span>{s.name}</span><span className="tp-portal-go" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <button className="fr-link" onClick={() => setScreen("view")}>{backLabel}</button>
      </div>
    );
  }

  if (screen === "portalClass") {
    const sub = canon[portalSi];
    if (!sub) return null;
    const what = GOAL_WORD[portalGoal] || "sections";
    return (
      <div className="tp">
        <div className="kicker kicker-ochre">{sub.name} · {what}</div>
        <h1 className="fr-q">Which class?</h1>
        <p className="fr-hint">Pick the class whose {what} you want to change.</p>
        {/* Rendered from portalGradeIdxs — the SAME list portalPickClass counted when it decided
            whether to show this screen at all, so the two can never disagree. On a scoped visit
            that is the purchased stage's classes only; the settled stage's are not what this
            window is about. */}
        <div className="tp-portal-list">
          {portalGradeIdxs(portalSi).map((gi) => {
            const g = sub.grades[gi];
            return (
              <button key={g.grade} type="button" className="tp-portal-row"
                onClick={() => portalOpen(portalGoal, portalSi, gi)}>
                <span>Class {classNum(g.grade)}</span><span className="tp-portal-go" aria-hidden="true">›</span>
              </button>
            );
          })}
        </div>
        <button className="fr-link" onClick={() => setScreen("view")}>{backLabel}</button>
      </div>
    );
  }

  if (screen === "pickSubjects") {
    const manage = pickMode === "manage";
    const enrolled = canon.map((s) => s.name);
    /* ★ POST-TRIAL SCOPE FILTER (founder, 2026-08-24; §0 gating-at-add-time): a PAID
       teacher's chooser shows ONLY her entitled subjects — unpaid catalogue entries
       never clog the wheel, and the quiet line below is the ONE upsell (her moment,
       pull never push). ENROLLED subjects always stay listed even when unpaid
       (trial-era additions are her profile; hiding them from a pre-ticked manage list
       would silently count them as removals on Continue). Trial = all 11, unchanged. */
    const scoped = Array.isArray(paidScopes) && !paidScopes.includes("*");
    const allowedSubj = scoped ? new Set(paidScopes.map((s) => s.split("/")[0])) : null;
    const options = (manage ? catalogue : catalogue.filter((n) => !enrolled.includes(n)))
      .filter((n) => !allowedSubj || allowedSubj.has(subjectSlugOf(n)) || enrolled.includes(n));
    const toggle = (n) => setPicked((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]));
    return (
      <div className="tp">
        <div className="kicker kicker-ochre">{manage ? "Your teaching · subjects" : "Teaching profile · add a subject"}</div>
        <h1 className="fr-q">{manage ? "What do you teach?" : "What else do you teach?"}</h1>
        {/* keep-≥1-subject RETIRED (founder, 2026-08-24, kumar3 live): removing her only
            subject is allowed — warned like any removal, never blocked. An emptied
            profile lands on the empty state's "+ add a subject". */}
        <p className="fr-hint">{manage
          ? "Tick a subject to add it — untick one to remove it."
          : "Pick the subject — or several — to add."}</p>
        {/* ★ AN EMPTY CHOOSER MEANS TWO DIFFERENT THINGS, AND ONLY ONE OF THEM IS A DEAD END
            (founder, 2026-08-30). Unscoped (trial, or "*"), it really is "you already teach
            everything Aruvi offers" — nothing to do. SCOPED, it means her subscription covers
            no subject she has not already added, which is not a fact about Aruvi's catalogue
            and must not be reported as one; the honest answer names the limit and offers the
            way past it. `onSubscribe` opens the SAME SubscribeFlow the front door and Settings
            use — this screen never learns anything about billing beyond "ask for it". */}
        {options.length === 0 && (scoped ? (
          <div className="tp-nomore">
            <p className="fr-hint">
              Your subscription covers {enrolled.length === 1 ? "the subject" : "the subjects"} you
              already teach. Another subject is a separate subscription.
            </p>
            {onSubscribe && (
              <button type="button" className="primary fr-cta" onClick={onSubscribe}>
                Add a subject to my subscription
              </button>
            )}
          </div>
        ) : (
          <p className="fr-hint">Every subject Meyy offers is already in your profile.</p>
        ))}
        {/* ★ Clustering is keyed to the MODE, not the screen (founder, 2026-07-26).
            ADD  → options already exclude what she has and `picked` starts empty, so she is building
                   a selection up from nothing: cluster, exactly as on the section and duration wheels.
            MANAGE → the full catalogue with her enrolled entries pre-ticked, and the whole point is
                   to reveal what she does NOT have. Clustering hides unchosen options between the
                   lowest and highest pick, which on Kumar1 (English · Science · Social Sciences ·
                   The World Around Us ticked) silently swallowed Mathematics — the one subject the
                   screen existed to offer. Never cluster an add/remove wheel over a full list. */}
        {options.length > 0 && (
          <PickWheel options={options} selected={picked} onToggle={toggle} cluster={!manage}
            ariaLabel={manage ? "Your subjects" : "Subjects to add"}>
            <button type="button" className="primary fr-cta"
              disabled={manage ? false : !picked.length}
              onClick={manage ? onManageSubjectsContinue : onSubjectsPicked}>
              Continue
            </button>
          </PickWheel>
        )}
        {/* Only when there IS a wheel — with an empty chooser the block above has already said
            this, at more length and with the way out attached. */}
        {scoped && options.length > 0 && (
          <p className="trial-note">
            Your subscription covers what's shown here. Another subject or stage is a
            separate subscription.
          </p>
        )}
        <button className="fr-link" onClick={() => setScreen("view")}>{backLabel}</button>

        {/* Manage-mode removal warning — one scoped confirm naming exactly what goes, same
            voice as the dustbins'. Confirming applies removals, then queues any adds. */}
        {subConfirm && (() => {
          const names = subConfirm.removes.join(", ");
          const classesOf = subConfirm.removes.map((n) => {
            const s = canon.find((x) => x.name === n);
            return s ? (s.grades || []).map((g) => `Class ${classNum(g.grade)}`).join(", ") : "";
          }).filter(Boolean).join(" · ");
          return (
            <div className="fr-modal-bg" onClick={(e) => { if (e.currentTarget === e.target) setSubConfirm(null); }}>
              <div className="fr-modal">
                <h2 className="fr-q">Remove {names}?</h2>
                <p className="fr-hint">{classesOf || "Its classes"} — all cards and bookmarks — will be removed. Your lessons stay in the library.</p>
                <button type="button" className="tp-remove-confirm" onClick={applySubjectChanges}>Yes, remove {names}</button>
                {/* "Keep it" must MEAN keep it (founder, 2026-08-24, kumar3 live): re-tick
                    the subjects she was about to remove, so the picker returns showing them
                    kept — not unticked and waiting to be re-chosen. Adds she ticked stay. */}
                <button type="button" className="fr-link fr-center"
                  onClick={() => {
                    setPicked((cur) => Array.from(new Set([...cur, ...subConfirm.removes])));
                    setSubConfirm(null);
                  }}>Keep {subConfirm.removes.length === 1 ? "it" : "them"}</button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  if (screen === "classes") {
    const manageC = classMode === "manage";
    const have = draft.grades.map((g) => g.grade);
    /* Same post-trial scope filter as the subjects wheel, at STAGE granularity: a paid
       SS·Middle teacher sees classes 6–8 only. Enrolled grades always stay listed
       (same silent-removal hazard). Trial and "*" scopes see everything. */
    const scopedC = Array.isArray(paidScopes) && !paidScopes.includes("*");
    const allowedStages = scopedC
      ? new Set(paidScopes.filter((s) => s.split("/")[0] === subjectSlugOf(draft.name))
          .map((s) => s.split("/")[1]))
      : null;
    /* ★ A SCOPED portal visit shows ONLY the newly-purchased STAGE's classes (founder,
       2026-08-27: "only classes relevant to the stage purchased should show — the previously
       existing stage classes are a settled matter"). A Science·Middle teacher who buys
       Science·Secondary is asked about 9 and 10, not about the 6/7/8 she settled long ago.
       SAFE because `startManageClasses` pre-ticks EVERY enrolled grade into `picked`, including
       the ones this hides — `onManageClassesContinue` reads removals off `picked`, not off the
       visible list, so a hidden class can never be read as an unticking. Removing a settled
       class is still possible, through the "+" portal, which carries no scope. */
    const portalStage = (portalScope && portalScope.grade && portalScope.subject === draft.name)
      ? stageOfRoman(portalScope.grade) : null;
    const options = (manageC ? gradeOptions : gradeOptions.filter((g) => !have.includes(g)))
      .filter((g) => !allowedStages || allowedStages.has(stageOfRoman(g)) || have.includes(g))
      .filter((g) => !portalStage || stageOfRoman(g) === portalStage);
    const toggle = (roman) => setPicked((a) => (a.includes(roman) ? a.filter((x) => x !== roman) : [...a, roman]));
    const adding = have.length > 0; // add-a-class on an existing subject vs a brand-new subject
    return (
      <div className="tp">
        <div className="kicker kicker-ochre">{manageC ? `${draft.name} · classes` : `${draft.name}${queue.length > 1 ? ` · subject ${qi + 1} of ${queue.length}` : ""}`}</div>
        <h1 className="fr-q">{manageC ? `Which classes do you teach ${draft.name} to?`
          : adding ? `Which classes are you adding for ${draft.name}?` : `Which classes do you teach ${draft.name} to?`}</h1>
        {/* Says what an added class ARRIVES as, because this screen no longer asks (see
            applyManageClasses) — and points at the row that changes it. */}
        {manageC && <p className="fr-hint">Tick a class to add it — untick one to remove it.
          A new class starts with Section A; change that under Section.</p>}
        {!manageC && adding && <p className="fr-hint">Your current classes stay as they are — pick only the new ones.</p>}
        {gradeOptions.length === 0 && <div className="fr-loading">Loading classes…</div>}
        {gradeOptions.length > 0 && options.length === 0 && (
          <p className="fr-hint">Every class Meyy offers for {draft.name}
            {portalStage ? " at this stage" : ""} is already in your profile.</p>
        )}
        {/* ★ REVERSED 2026-08-29 (founder, knowingly): manage mode clusters again. The
            2026-07-26 rule ("never cluster an add/remove wheel over a full list") was struck for
            classes and sections — the founder prefers the picked classes gathered adjacent on
            top, accepting the recorded cost: with VI + IX ticked, VII and VIII are hidden inside
            the cluster until IX is unticked. The subject manage wheel above KEEPS the old rule —
            it is the site of the original swallowed-Mathematics defect and was not part of the
            reversal. */}
        {options.length > 0 && (
          <PickWheel options={options} selected={picked} onToggle={toggle}
            ariaLabel={`Classes for ${draft.name}`} labelFor={(g) => `Class ${classNum(g)}`}>
            {/* ★ "Save", not "Continue", in manage mode (founder, 2026-08-27): the word states
                whether anything follows. Manage ENDS here now — the tick applies and the window
                comes back (applyManageClasses). Adding a class from the profile's green button
                genuinely continues, into that class's sections · duration · periods · budget, so
                it keeps "Continue". The only "Continue" left inside a portal visit is periods a
                week, which continues into the period lengths. */}
            <button type="button" className="primary fr-cta" disabled={manageC ? false : !picked.length}
              onClick={manageC ? onManageClassesContinue : onClassesContinue}>
              {manageC ? "Save" : "Continue"}
            </button>
          </PickWheel>
        )}
        {scopedC && (
          <p className="trial-note">
            Your subscription covers what's shown here. Another subject or stage is a
            separate subscription.
          </p>
        )}

        {/* Manage-mode removal warning — names the classes AND their section cards; if nothing
            is left the subject goes with them (warned, never blocked). */}
        {classConfirm && (() => {
          const names = classConfirm.removes.map((r) => `Class ${classNum(r)}`).join(", ");
          const tags = classConfirm.removes.map((roman) => {
            const g = draft.grades.find((x) => x.grade === roman);
            return g && g.sections.length ? g.sections.map((sec) => `${classNum(roman)}${sec}`).join(", ") : `Class ${classNum(roman)}`;
          }).join(", ");
          const allGone = classConfirm.removes.length === draft.grades.length && !classConfirm.adds.length;
          return (
            <div className="fr-modal-bg" onClick={(e) => { if (e.currentTarget === e.target) setClassConfirm(null); }}>
              <div className="fr-modal">
                <h2 className="fr-q">Remove {names} from {draft.name}?</h2>
                <p className="fr-hint">{tags} — their cards and bookmarks — will be removed.{allGone ? ` No class is left — ${draft.name} goes with it.` : ""} Your lessons stay in the library.</p>
                <button type="button" className="tp-remove-confirm" onClick={applyClassChanges}>Yes, remove {names}</button>
                {/* "Keep it" re-ticks the classes she was about to remove — same rule as
                    the subjects confirm (founder, 2026-08-24). */}
                <button type="button" className="fr-link fr-center"
                  onClick={() => {
                    setPicked((cur) => Array.from(new Set([...cur, ...classConfirm.removes])));
                    setClassConfirm(null);
                  }}>Keep {classConfirm.removes.length === 1 ? "it" : "them"}</button>
              </div>
            </div>
          );
        })()}
        <button className="fr-link" onClick={() => setScreen("view")}>{backLabel}</button>
      </div>
    );
  }

  if (screen === "class") {
    const g = draft.grades[gIdx];
    const kicker = `${draft.name} · Class ${classNum(g.grade)} · ${pi + 1} of ${pendingIdxs.length}`;

    if (classStep === "sections") {
      const names = g.section_names || {};
      const toggle = (s) => updGrade({
        sections: g.sections.includes(s) ? g.sections.filter((x) => x !== s) : [...g.sections, s].sort(),
      });
      const setName = (s, v) => updGrade({ section_names: { ...names, [s]: v } });
      return (
        <div className="tp">
          <div className="kicker kicker-ochre">{kicker}</div>
          <h1 className="fr-q">Which sections of Class {classNum(g.grade)}?</h1>
          <p className="fr-hint">Every ticked section gets its own class card and its own bookmark.</p>
          <PickWheel options={SECTION_LETTERS} selected={g.sections} onToggle={toggle}
            ariaLabel={`Sections of Class ${classNum(g.grade)}`} labelFor={(s) => `${classNum(g.grade)}${s}`}
            leadingHeader="Section" trailingHeader="customize"
            summaryFor={(s) => secSummary(g.grade, s, names)}
            trailing={(s, on) => (
              <SecNameCell on={on} tag={`${classNum(g.grade)}${s}`} value={names[s] || ""}
                onChange={(v) => setName(s, v)} />
            )}>
            <button type="button" className="primary fr-cta" disabled={!g.sections.length}
              onClick={() => setClassStep("ppw")}>
              Continue
            </button>
          </PickWheel>
          <button className="fr-link" onClick={() => setScreen("view")}>{backLabel}</button>
        </div>
      );
    }

    if (classStep === "ppw") {
      /* Asked BEFORE duration (founder, 2026-07-26): she sizes her week once, unattached to any
       * period length, and the duration screen then divides it. */
      const total = ppwMapSum(normPpw(g.durations, g.ppw_by_duration, g.periods_per_week, g.ppw_anchor));
      const setTotal = (t) => {
        const next = setPpwTotal(g.durations, normPpw(g.durations, g.ppw_by_duration, g.periods_per_week, g.ppw_anchor),
                                 g.ppw_anchor, t);
        updGrade({ ppw_by_duration: next, periods_per_week: ppwMapSum(next) });
      };
      return (
        <div className="tp">
          <div className="kicker kicker-ochre">{kicker}</div>
          <h1 className="fr-q">How many periods a week does Class {classNum(g.grade)} get for {draft.name}?</h1>
          <p className="fr-hint">A number, not a timetable — Meyy never asks which days.</p>
          <PpwTotalWheel value={total} onChange={setTotal} />
          <div className="fr-foot">
            <button className="primary fr-cta" onClick={() => setClassStep("durations")}>Continue</button>
            <button className="fr-link" onClick={() => setClassStep("sections")}>← Back</button>
          </div>
        </div>
      );
    }

    if (classStep === "durations") {
      const toggle = (d) => updGrade({
        durations: g.durations.includes(d)
          ? (g.durations.length > 1 ? g.durations.filter((x) => x !== d) : g.durations)
          : [...g.durations, d].sort((x, y) => x - y),
      });
      /* She has just stated the size of her week, so the split belongs HERE as a second column —
       * no separate screen. The lowest ticked length is the non-editable remainder. */
      const anchor = lowestDuration(g.durations);
      const map = normPpw(g.durations, g.ppw_by_duration, g.periods_per_week, anchor);
      const total = ppwMapSum(map);
      const multi = (g.durations || []).length > 1;
      const setCount = (d, v) => {
        const next = setPpwSplit(g.durations, map, anchor, d, v);
        updGrade({ ppw_by_duration: next, periods_per_week: ppwMapSum(next) });
      };
      return (
        <div className="tp">
          <div className="kicker kicker-ochre">{kicker}</div>
          <h1 className="fr-q">How long are your {draft.name} periods for Class {classNum(g.grade)}?</h1>
          <p className="fr-hint">{multi
            ? `Split your ${total} periods between the lengths — the shortest one takes whatever is left over.`
            : "If more than one duration, select multiple."}</p>
          <PickWheel options={DURATION_CHOICES} selected={g.durations} onToggle={toggle}
            ariaLabel="Period durations" labelFor={(d) => `${d} min`} initialScrollTo={DEFAULT_DURATION}
            leadingHeader={multi ? "Duration" : null}
            trailingHeader={multi ? "Periods / week" : null}
            summaryFor={multi ? (d) => `${d} min × ${map[d] || 0}` : null}
            trailing={(d, on) => (
              <PpwSplitCell duration={d} selected={on} map={map} total={total}
                isAnchor={d === anchor} onSet={setCount} show={multi} />
            )}>
            <button type="button" className="primary fr-cta" onClick={() => {
              updGrade({ ppw_by_duration: map, ppw_anchor: anchor, periods_per_week: total });
              setClassStep("budget");
            }}>Continue</button>
          </PickWheel>
          <button className="fr-link" onClick={() => setClassStep("ppw")}>← Back</button>
        </div>
      );
    }

    /* budget — ONE input, the annual period count. See the METHODS note at the top of the file
       for why the other three went. The value opens on Aruvi's calibrated figure when she has
       not set one; `recTotal` is already in state from the /ncf-periods effect. */
    const ppw = g.periods_per_week || DEFAULT_PPW;
    const b = normalizeBudget(g.budget, ppw, recTotal);
    // Floor the entered figure at 1 (B3, 2026-07-06) — a 0-period year is never valid.
    const stepValue = (delta) => updGrade({ budget: { ...b, value: Math.max(1, b.value + delta) } });
    const setValue = (v) => updGrade({ budget: { ...b, value: Math.max(1, v || 0) } });
    const isLast = pi + 1 >= pendingIdxs.length;
    return renderBudgetStep({
      kicker,
      heading: `How many periods for Class ${classNum(g.grade)} this year?`,
      ppw, b, setValue, stepValue,
      onPpwPencil: () => setClassStep("ppw"),
      footer: (
        <div className="fr-foot">
          <button className="primary fr-cta" onClick={() => { updGrade({ budget: b }); onClassDone(); }}>
            {isLast ? "Save ✓" : "Next class →"}
          </button>
          <button className="fr-link" onClick={() => setClassStep("durations")}>← Back</button>
        </div>
      ),
    });
  }

  if (screen === "subjectDone") {
    return (
      <div className="tp">
        <div className="kicker kicker-ochre">Teaching profile</div>
        <div className="fr-ready-note">
          <span className="fr-ready-check">✓</span>
          <div className="fr-ready-text">
            <strong>{draft.name} saved.</strong>
            <span>You can continue now, or come back for the rest later.</span>
          </div>
        </div>
        <div className="fr-foot">
          <button className="primary fr-cta" onClick={() => { const n = qi + 1; setQi(n); beginSubjectRun(queue[n]); }}>
            Continue to {queue[qi + 1]} →
          </button>
          <button className="fr-link fr-center" onClick={() => setScreen("view")}>Finish for now</button>
        </div>
      </div>
    );
  }

  if (screen === "addSection") {
    const { si, gi } = numCtx;
    const sub = canon[si]; const g = sub.grades[gi];
    const have = g.sections.map(secLetter);
    const options = SECTION_LETTERS.filter((s) => !have.includes(s));
    const toggle = (s) => setPicked((a) => (a.includes(s) ? a.filter((x) => x !== s) : [...a, s]));
    return (
      <div className="tp">
        <div className="kicker kicker-ochre">{sub.name} · Class {classNum(g.grade)} · sections</div>
        <h1 className="fr-q">Add sections to Class {classNum(g.grade)}</h1>
        <p className="fr-hint">You already have {have.map((s) => `${classNum(g.grade)}${s}`).join(", ")}. Tick the new ones.</p>
        <PickWheel options={options} selected={picked} onToggle={toggle}
          ariaLabel="Sections to add" labelFor={(s) => `${classNum(g.grade)}${s}`}
          leadingHeader="Section" trailingHeader="customize"
          summaryFor={(s) => secSummary(g.grade, s, secNames)}
          trailing={(s, on) => (
            <SecNameCell on={on} tag={`${classNum(g.grade)}${s}`} value={secNames[s] || ""}
              onChange={(v) => setSecNames((m) => ({ ...m, [s]: v }))} />
          )}>
          <button type="button" className="primary fr-cta" disabled={!picked.length} onClick={saveAddSection}>Save</button>
        </PickWheel>
        <button className="fr-link" onClick={() => setScreen("view")}>{backLabel}</button>
      </div>
    );
  }

  if (screen === "editSections") {
    const { si, gi } = numCtx;
    const sub = canon[si]; const g = sub.grades[gi];
    const toggle = (s) => setPicked((a) => (a.includes(s) ? a.filter((x) => x !== s) : [...a, s]));
    return (
      <div className="tp">
        <div className="kicker kicker-ochre">{sub.name} · Class {classNum(g.grade)} · sections</div>
        <h1 className="fr-q">Edit sections of Class {classNum(g.grade)}</h1>
        <p className="fr-hint">Tick to keep or add a section, untick to remove one. A removed section loses its bookmark — your lessons stay in the library. To remove the whole class, use the basket on the class.</p>
        {/* ★ REVERSED 2026-08-29 (founder, knowingly): clusters again — picked sections gather
            adjacent on top (6C + 6E side by side, 6F… below), accepting the recorded cost that
            a class holding A and R hides B…Q inside the cluster until R is unticked. */}
        <PickWheel options={SECTION_LETTERS} selected={picked} onToggle={toggle}
          ariaLabel="Sections" labelFor={(s) => `${classNum(g.grade)}${s}`}
          leadingHeader="Section" trailingHeader="customize"
          summaryFor={(s) => secSummary(g.grade, s, secNames)}
          trailing={(s, on) => (
            <SecNameCell on={on} tag={`${classNum(g.grade)}${s}`} value={secNames[s] || ""}
              onChange={(v) => setSecNames((m) => ({ ...m, [s]: v }))} />
          )}>
          <button type="button" className="primary fr-cta" disabled={!picked.length} onClick={requestEditSections}>Save</button>
        </PickWheel>
        <button className="fr-link" onClick={() => setScreen("view")}>{backLabel}</button>

        {secConfirm && (
          <div className="fr-modal-bg" onClick={(e) => { if (e.currentTarget === e.target) setSecConfirm(null); }}>
            <div className="fr-modal">
              <h2 className="fr-q">Remove {secConfirm.removed.join(", ")}?</h2>
              <p className="fr-hint">{secConfirm.removed.length === 1 ? "Its card and bookmark" : "Their cards and bookmarks"} will be removed. Your lessons stay in the library.</p>
              <button type="button" className="tp-remove-confirm" onClick={applyEditSections}>Yes, remove {secConfirm.removed.join(", ")}</button>
              <button type="button" className="fr-link fr-center" onClick={() => setSecConfirm(null)}>Keep {secConfirm.removed.length === 1 ? "it" : "them"}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === "editNums") {
    const { si, gi, g, step } = numCtx;
    const sub = canon[si];
    const kicker = `${sub.name} · Class ${classNum(g.grade)}`;

    if (step === "duration") {
      const toggle = (d) => updNum({
        durations: g.durations.includes(d)
          ? (g.durations.length > 1 ? g.durations.filter((x) => x !== d) : g.durations)
          : [...g.durations, d].sort((x, y) => x - y),
      });
      /* This screen is only ever reached THROUGH the periods/week total (the standalone duration
       * pencil is gone), so she has just restated the size of her week and the anchor is the
       * lowest ticked length — the same rule as first run. No stored-anchor exception is needed
       * any more, because there is no longer a way to change lengths without passing the total. */
      const anchor = lowestDuration(g.durations);
      const map = normPpw(g.durations, g.ppw_by_duration, g.periods_per_week, anchor);
      const total = ppwMapSum(map);
      const multi = g.durations.length > 1;
      const setCount = (d, v) => {
        const next = setPpwSplit(g.durations, map, anchor, d, v);
        updNum({ ppw_by_duration: next, periods_per_week: ppwMapSum(next) });
      };
      return (
        <div className="tp">
          <div className="kicker kicker-ochre">{kicker} · duration</div>
          <h1 className="fr-q">How long are the periods?</h1>
          <p className="fr-hint">{multi
            ? `Split your ${total} periods between the lengths — ${anchor} min takes whatever is left over.`
            : "If more than one duration, select multiple."}</p>
          <PickWheel options={DURATION_CHOICES} selected={g.durations} onToggle={toggle}
            ariaLabel="Period durations" labelFor={(d) => `${d} min`} initialScrollTo={g.durations[0]}
            leadingHeader={multi ? "Duration" : null}
            trailingHeader={multi ? "Periods / week" : null}
            summaryFor={multi ? (d) => `${d} min × ${map[d] || 0}` : null}
            trailing={(d, on) => (
              <PpwSplitCell duration={d} selected={on} map={map} total={total}
                isAnchor={d === anchor} onSet={setCount} show={multi} />
            )}>
            {/* Step 2 of 2 — the lengths and their split together, so this is where it saves. */}
            <button type="button" className="primary fr-cta"
              onClick={() => { updNum({ ppw_by_duration: map, ppw_anchor: anchor, periods_per_week: total }); saveEditNums(); }}>
              Save
            </button>
          </PickWheel>
          <button className="fr-link" onClick={() => setNumCtx((c) => ({ ...c, step: "ppw" }))}>← Back</button>
        </div>
      );
    }

    if (step === "ppw") {
      /* Step 1 of 2 behind the periods/week pencil: the weekly TOTAL. It is now the ONLY way
       * into the period lengths — the standalone duration pencil is gone, because the size of the
       * week and its division are one answer, not two. Continue → step "duration". */
      const anchor = ppwAnchor(g.durations, g.ppw_by_duration, g.ppw_anchor);
      const map = normPpw(g.durations, g.ppw_by_duration, g.periods_per_week, anchor);
      const setTotal = (t) => {
        const next = setPpwTotal(g.durations, map, anchor, t);
        updNum({ ppw_by_duration: next, periods_per_week: ppwMapSum(next) });
      };
      return (
        <div className="tp">
          <div className="kicker kicker-ochre">{kicker} · periods / week</div>
          <h1 className="fr-q">How many periods a week?</h1>
          <p className="fr-hint">A number, not a timetable — you&rsquo;ll set the period lengths next.</p>
          <PpwTotalWheel value={ppwMapSum(map)} onChange={setTotal} />
          <div className="fr-foot">
            {/* Always continues into the duration screen — that is where the lengths and their
                split are set, and it is the only way in now. */}
            <button className="primary fr-cta"
              onClick={() => setNumCtx((c) => ({ ...c, step: "duration" }))}>Continue</button>
            <button className="fr-link" onClick={() => setScreen("view")}>Cancel</button>
          </div>
        </div>
      );
    }

    const ppw = g.periods_per_week || DEFAULT_PPW;
    const b = normalizeBudget(g.budget, ppw, recTotal);
    // Floor the entered figure at 1 (B3, 2026-07-06) — a 0-period year is never valid.
    const stepValue = (delta) => updNum({ budget: { ...b, value: Math.max(1, b.value + delta) } });
    const setValue = (v) => updNum({ budget: { ...b, value: Math.max(1, v || 0) } });
    return renderBudgetStep({
      kicker: `${kicker} · annual budget`,
      heading: "How many periods for the year?",
      ppw, b, setValue, stepValue,
      // The pencil stays INSIDE this editor — she is one step from the periods-a-week wheel,
      // and coming back lands her on this same budget screen with her figure intact.
      onPpwPencil: () => setNumCtx((c) => ({ ...c, step: "ppw" })),
      footer: (
        <div className="fr-foot">
          <button className="primary fr-cta" onClick={() => saveEditNums(b)}>Save</button>
          <button className="fr-link" onClick={() => setScreen("view")}>Cancel</button>
        </div>
      ),
    });
  }

  /* ════════════════════ VIEW — the accordion ════════════════════ */
  /* ★ A WEEKLY TOTAL IS COUNTED PER SECTION, NOT PER CLASS (founder, 2026-08-30).
   * `periods_per_week` is a property of the CLASS — "Class 9 gets 8 periods a week for
   * Science" — and it is what she was ASKED for ("How many periods a week does Class 9 get?").
   * But she does not teach Class 9; she teaches 9A, 9B and 9C, and each of them gets those 8.
   * Summing the class figure told a teacher of three sections that her week is 8 periods long
   * when she actually stands in front of 24. So every AGGREGATE multiplies by the number of
   * sections enrolled in that class. The per-class card is left stating the per-section week
   * (that is the figure she entered, and the one the budget derives from) — its label now says
   * so, or the subject header would not add up from the rows beneath it.
   * A class always carries ≥1 section (removing the last one cascades the class away, see
   * `removeSection`), so `.length` is the multiplier; the `|| 1` covers only a legacy record
   * that has no sections array at all, where the old behaviour is the safest reading. */
  const secCount = (g) => (g.sections || []).length || 1;
  const gradePpw = (g) => (g.periods_per_week || 0) * secCount(g);

  // headline totals across the whole profile
  const stats = (() => {
    const classSet = new Set(); const secSet = new Set(); let ppw = 0;
    canon.forEach((s) => (s.grades || []).forEach((g) => {
      classSet.add(classNum(g.grade));
      (g.sections || []).forEach((x) => secSet.add(`${classNum(g.grade)}${secLetter(x)}`));
      ppw += gradePpw(g);
    }));
    return { subjects: canon.length, classes: classSet.size, sections: secSet.size, ppw };
  })();

  return (
    <div className="tp" ref={rootRef}>
      {/* Shown ONLY when the server was read back and genuinely disagrees with the edit
          (lib/verify.js). Not on a throw, not when the server could not be reached — in both
          of those we do not know, and saying so would be a guess. The view above has already
          been re-synced to what IS stored, so this line explains what she is now looking at
          rather than warning about something invisible. She dismisses it; nothing navigates. */}
      {saveFailed && (
        <div className="tp-savefail" role="alert">
          <span>That change didn’t save — this is your teaching profile as it stands.</span>
          <button type="button" onClick={() => setSaveFailed(false)}>Dismiss</button>
        </div>
      )}
      <div className="tp-sticky">
        {onBack && (
          <div style={{ textAlign: "right", marginTop: "-8px", marginBottom: "12px" }}>
            <button className="back back-tr" onClick={onBack}>← back</button>
          </div>
        )}
        <div className="tp-hd">
          <div>
            <h1 className="lvl-title">Your teaching profile</h1>
            <div className="tp-hd-spacer" aria-hidden="true"></div>
          </div>
          {/* ★ THE TOGGLE IS A PENCIL AGAIN, BECAUSE IT NOW DOES BOTH (founder, 2026-08-30).
              On 2026-08-27 it became a dustbin, on the reasoning that "a control that promises
              editing and delivers only deletion is a trap" — removal really was all it did,
              because the "+" portal had taken every other pencil and adding a subject was
              assumed to be a purchase and therefore not a profile act at all.
              That assumption was wrong for the teacher who ALREADY HOLDS the subscription: she
              deleted her way down to one subject and then found no way back, with entitlement
              for the others sitting unused (account 1000000002, live). Edit mode now reveals
              the per-subject dustbins AND "+ add a subject" below them, so the pencil is
              truthful — it opens editing, and editing means both directions.
              `!lapsed`: an expired subscription makes the profile READ-ONLY — she keeps seeing
              what she taught, but this hides (§2.5 as amended; the server refuses writes
              regardless). */}
          {canon.length > 0 && !lapsed && (
            editing ? (
              <button className="tp-edit-toggle on" onClick={() => setEditing(false)} aria-label="Done">Done</button>
            ) : (
              <button className="tp-edit-pencil" onClick={() => setEditing(true)}
                aria-label="Edit your subjects" title="Add or remove subjects">
                <Pencil size={15} />
              </button>
            )
          )}
        </div>

        {canon.length === 0 && (
          <p className="tp-empty">No profile yet — add a subject to begin.</p>
        )}

        {canon.length > 0 && (
          <div className="tp-stats">
            <div className="tp-stat"><span className="tp-stat-n">{stats.subjects}</span><span className="tp-stat-l">Subjects</span></div>
            <div className="tp-stat"><span className="tp-stat-n">{stats.classes}</span><span className="tp-stat-l">Classes</span></div>
            <div className="tp-stat"><span className="tp-stat-n">{stats.sections}</span><span className="tp-stat-l">Sections</span></div>
            <div className="tp-stat"><span className="tp-stat-n">{stats.ppw}</span><span className="tp-stat-l">Periods / week</span></div>
          </div>
        )}
      </div>

      {canon.map((s, si) => {
        const open = s.name === openSubject;
        // per SECTION, like the headline stat — see `gradePpw` above.
        const subPpw = (s.grades || []).reduce((a, g) => a + gradePpw(g), 0);
        return (
          <div className={`tp-sub ${open ? "open" : ""}`} key={s.name}>
            <div className="tp-sub-hd" onClick={() => setOpenSubject(open ? null : s.name)}>
              <span className="tp-sub-left">
                <span className="tp-sub-name">{s.name}</span>
                {/* ★ THE PROFILE IS A VIEW NOW, WITH ONE EXCEPTION (founder, 2026-08-27).
                    Every other pencil on this screen is gone — class, section, periods a week,
                    annual budget. Those all live in the "+" portal, which reaches the same
                    screens in fewer taps, and two doors onto one record is how the two drift.

                    REMOVING A SUBJECT is what could not go with them. The portal deliberately
                    has NO Subject row (adding one is a purchase, so removal would have been its
                    only working half, one tap from a window opened to add a section). So the
                    master EDIT toggle survives for this single act, which is also the most
                    destructive thing a teacher can do here — it takes her classes, sections,
                    bookmarks and chapter bindings with it. Hence the DOUBLE confirmation in
                    `subConfirm`: the first states what goes, the second asks her to mean it. */}
                {editing && open && (
                  <button className="tp-icon-btn tp-icon-danger" aria-label={`Remove ${s.name}`}
                    title={`Remove ${s.name} from your teaching profile`}
                    onClick={(e) => { e.stopPropagation(); setRemoveSubject({ si, name: s.name, step: 1 }); }}>
                    <Bin />
                  </button>
                )}
              </span>
              <span className="tp-sub-side">
                <span className="tp-sub-ppw">{subPpw} periods / week</span>
                <span className="tp-caret">{open ? "▾" : "▸"}</span>
              </span>
            </div>

            {open && (s.grades || []).map((g, gi) => {
              const ppw = g.periods_per_week;
              const b = (s.budget || {})[gi] ?? (s.budget || {})[String(gi)];
              const total = ppw && b ? budgetPeriods(ppw, b) : null;
              const durs = g.durations || [];
              const pmap = g.ppw_by_duration || {};
              /* Periods/week is stated as the SPLIT itself — "7 × 50 min, 1 × 60 min" — not as a
               * bare total with the lengths parked in a separate column (founder, 2026-07-26).
               * The number on its own never answered the question a teacher actually asks of this
               * card ("what does my week look like?"), and the Duration column was only ever the
               * other half of this one sentence. Dropping that column is what buys the room. A
               * single-length class reads the same way ("8 × 45 min"), so there is one format. */
              const perWeek = durs.length
                ? durs.map((d) => `${pmap[d] ?? pmap[String(d)] ?? 0} × ${d} min`).join(", ")
                : null;
              return (
                <div className="tp-classcard" key={g.grade}>
                  <div className="tp-cc-hd">
                    <span className="tp-cc-left">
                      <span className="tp-cc-name">Class {classNum(g.grade)}</span>
                    </span>
                    <div className="tp-cc-right">
                      <span className="tp-cc-seclbl">Sections</span>
                      <div className="tp-chips">
                        {(g.sections || []).map((x) => {
                          const sec = secLetter(x);
                          const nm = secName(x);
                          const tag = `${classNum(g.grade)}${sec}`;
                          /* ★ A NAMED SECTION SHOWS HER NAME AND NOTHING ELSE (founder,
                             2026-08-30) — REVERSING the "tag first, name appended" rule of
                             earlier the same day. That rule argued the profile is where she
                             audits her set-up, so the key belongs in front. The founder's
                             correction: the CLASS is already stated, in display serif, at the
                             top of this very card — so the "6" in "6A · Rose" is the third time
                             the same fact appears on one card, and it pushes her own word to
                             third place behind it. The letter is not lost: it is in `title`,
                             which is also what the screen reader announces, and every chip
                             without a name still reads as the plain tag. */
                          return (
                            <span className={`tp-chip${nm ? " named" : ""}`} key={sec}
                              title={`Section ${tag}`}>
                              {nm || tag}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="tp-cc-cols">
                    <div className="tp-cc-col tp-cc-col--center">
                      {/* "per section" is load-bearing, not decoration: the subject header
                          above sums the sections, so without it a class of three sections
                          reading "8 × 45 min" makes the 24 up there look like a mistake. */}
                      <div className="tp-cc-col-l">Periods / week per section
                      </div>
                      <div className="tp-cc-col-v">{perWeek || (ppw ? `${ppw} a week` : "—")}</div>
                    </div>
                    <div className="tp-cc-col">
                      <div className="tp-cc-col-l">Annual budget
                      </div>
                      <div className="tp-cc-col-v">{total ? `${total} periods` : "—"}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* "+ add a class" retired — adding happens by ticking in the class pen's
                full list (startManageClasses), same screen as removing. */}
          </div>
        );
      })}

      {/* ★ ADDING A SUBJECT IS AN EMPTY SUBJECT ROW, NOT A BUTTON (founder, 2026-08-30).
          The green pill said "here is a control"; the row says "here is where the next subject
          goes" — the same card, the same padding, the same display-serif name as every subject
          above it, so the list reads as a list with one slot still open. Only two things mark
          it as not-yet-a-subject: a DASHED edge (the .sc-proposed idiom — structure, not
          colour) and pine ink on the name, because it is the one row on this screen that acts
          rather than opens. No periods/week and no caret: it has neither.
          It renders on an EMPTY profile (where it is the only way in) and inside edit mode —
          the fix for 1000000002, who removed her way down to one subject and found the door
          gone, with entitlement for four more sitting unused. The chooser it opens is already
          scoped to what she has paid for, so nothing here needs to know about billing. */}
      {(canon.length === 0 || (editing && !lapsed)) && (
        <div className="tp-sub tp-sub-add">
          <div className="tp-sub-hd" role="button" tabIndex={0}
            onClick={startAddSubject}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startAddSubject(); } }}>
            <span className="tp-sub-left">
              <span className="tp-sub-name">+ add a subject</span>
            </span>
          </div>
        </div>
      )}

      {/* ★ REMOVE A SUBJECT — TWO CONFIRMATIONS (founder, 2026-08-27). This is the only
          destructive act left on the profile, and it is unrecoverable. The steps do different
          jobs on purpose: STEP 1 tells her exactly what goes and, just as importantly, what
          does NOT — a teacher who believes she is about to lose her lesson plans will not read
          any further. STEP 2 asks her to mean it, naming the subject again so a mis-tap on a
          phone cannot carry through two screens. Cancel is the plain, easy exit at both. */}
      {removeSubject && (() => {
        const s = canon[removeSubject.si];
        const classes = s ? (s.grades || []).map((g) => `Class ${classNum(g.grade)}`).join(", ") : "";
        const secCount = s ? (s.grades || []).reduce((n, g) => n + ((g.sections || []).length), 0) : 0;
        const first = removeSubject.step === 1;
        return (
          <div className="fr-modal-bg"
            onClick={(e) => { if (e.currentTarget === e.target) setRemoveSubject(null); }}>
            <div className="fr-modal">
              <h2 className="fr-q">
                {first ? <>Remove {removeSubject.name}?</> : <>Are you sure?</>}
              </h2>
              {first ? (
                <>
                  <p className="fr-hint">
                    {classes || "Its classes"}
                    {secCount ? ` — ${secCount} section${secCount === 1 ? "" : "s"}` : ""} will be
                    removed from your teaching profile, along with every bookmark and chapter
                    binding in them. This cannot be undone.
                  </p>
                  <p className="fr-hint tp-rm-keep">
                    Your <b>lesson plans stay in the library</b> — removing a subject never
                    deletes a plan.
                  </p>
                  <button type="button" className="tp-remove-confirm"
                    onClick={() => setRemoveSubject((r) => ({ ...r, step: 2 }))}>
                    Continue
                  </button>
                </>
              ) : (
                <>
                  <p className="fr-hint">
                    This removes <b>{removeSubject.name}</b> and everything you have set up
                    inside it. There is no way back.
                  </p>
                  <button type="button" className="tp-remove-confirm" onClick={applyRemoveSubject}>
                    Yes, remove {removeSubject.name}
                  </button>
                </>
              )}
              <button type="button" className="fr-link fr-center"
                onClick={() => setRemoveSubject(null)}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {confirm && (() => {
        const c = confirmCopy();
        return (
          <div className="fr-modal-bg" onClick={(e) => { if (e.currentTarget === e.target) setConfirm(null); }}>
            <div className="fr-modal">
              <h2 className="fr-q">{c.title}</h2>
              <p className="fr-hint">{c.body}</p>
              <button type="button" className="tp-remove-confirm" onClick={doRemove}>{c.cta}</button>
              <button type="button" className="fr-link fr-center" onClick={() => setConfirm(null)}>Keep it</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
