"use client";
import { useEffect, useRef, useState } from "react";
// (ThemeToggle import removed 2026-08-24 — Appearance lives in Settings.)
import { getJSON, postJSON, markPrepared, pretty, gradeUp, ROMAN, stageOfGrade, fetchEntitlement,
         ppwFromAnnual } from "../lib/format";
import { bindSectionChapter, pushSectionState } from "../lib/sectionState";
import { invalidatePlans } from "../lib/plans";
import { RollWheel, wheelChapterTitle, normPpw, ppwMapSum, lowestDuration, DEFAULT_PPW } from "./wheels";
import MeyyMark from "./MeyyMark";

/* ───────── FirstRun — shell-less Guided First Experience (Phase 1, 2026-07-01) ─────────
 * The mobile-first, progressive-acquisition entry point (CLAUDE.md §0). Until the teacher has
 * generated one lesson and attached it to a section, there is NO app shell — no header, no
 * tabs, no sidebar. She just completes one meaningful task. This component owns that whole
 * pre-activation surface and renders full-screen on its own.
 *
 * Principle: benefit first, data second. We ask ONE subject, ONE grade, ONE chapter — the
 * minimum to generate a first lesson — with the CALIBRATED defaults pre-filled (2026-07-26:
 * the class's standard duration and the master plan's period count for that chapter; the old
 * flat 40 min / 12 periods is now only a fallback) and
 * only revealed for editing if the teacher taps "Want to change?". Each answer quietly becomes
 * part of the profile later; she never feels she is "building a profile."
 *
 * Steps: welcome → subject → grade → chapter (+duration). That is ALL of it. The chapter CTA
 * fires the serve and hands off immediately; page.jsx opens the shell on MY LESSONS, where the
 * ordinary preparing card shows the progress bar and is replaced in place by the real lesson,
 * with the tour offer beneath it. There is NO "Lesson plan ready!" screen and no creatingCards
 * beat — first run has no waiting screen of its own, because the shell already has one.
 *
 * ★ THREE STEPS, AND ONLY THREE (founder, 2026-08-21). Between the preview and the handoff there
 * used to be FOUR more screens — sections → periods/week → durations → annual budget — demanded
 * at the moment of her first success, in a flow whose own rail promises Subject · Class · Chapter.
 * All four are gone. Sections are STATED on the Class step ("we'll start you with Section 9A",
 * changeable in the profile); duration was already asked on the chapter step and was a straight
 * duplicate; periods/week and annual budget are seeded with the defaults those screens opened on
 * and are met later in the profile and Year Plan, where they first mean something. She lands on
 * My Lessons rather than My Classes because the promise was a lesson plan, not an empty card.
 *
 * ★ THE CARD LANDS ATTACHED (founder, 2026-08-21) — this REVERSES the 2026-07-05 "cards land
 * UNATTACHED" rule for first run. That rule existed because auto-binding made the first class
 * look finished while the profile behind it had never been built; the profile IS built now
 * (subject · class · section · duration · calibrated budget), so the reason has expired, and
 * what the rule left behind was an empty card at the end of a flow whose whole promise was a
 * lesson. `prepareAndHandOff` binds the plan to the default section the moment it lands. The
 * tour still TEACHES attaching — its orchestration forces the card unbound at steps ≤9 and
 * re-binds at 10 — so the demo is unaffected by starting from a bound card.
 *
 * NO DAY SCHEDULE (2026-07-02): the weekly-arrangement step is GONE. Aruvi organizes by the
 * section pointer ("where did I stop?"), not by days — the calendar was a category error
 * against that model (see MEMORY.md 2026-07-02). First run never asks which days she teaches;
 * the canonical payload still carries a grids[] field for shape-compat, but it is always
 * all -1 ("no schedule"). Design: warm-paper system (§4), authored mobile-first.
 *
 * The preview step deliberately does NOT render the full lesson plan (ViewModelView) — a saved
 * plan currently stands in for it, and a REAL generated plan will later live in the exact same
 * saved-plans folder, but either way showing the whole document before she's attached it to a
 * class works against the guided flow. Instead it shows a teaser of common fields (subject,
 * class, chapter title, period count, assessment item count) pulled from that plan's view model.
 *
 * Props:
 *   user        — signed-in id (for the greeting line, optional)
 *   onComplete(payload) — payload = { subjects: [subjectRecord] }, the CANONICAL readiness
 *     shape (same one Readiness.jsx's buildPayload()/onReadyComplete produce) built from
 *     everything the teacher picked: subject, grade, one section-per-fan-out. The grids[]
 *     field ships all -1 (day schedules are never collected). The caller (page.jsx) persists
 *     it via POST /readiness and flips ready — that's the real activation moment, not a flag.
 *   onExit()    — optional: back out to sign-in (from the welcome step)
 */

// ── The calibrated standard (founder, 2026-07-26) ──
// Both defaults on the chapter step now come from OUR calibrated master plan
// (data/cloud/content/allocation_norms/master_plan.json), served by GET /subjects/{s}/{g}/chapters
// as `standard_duration_minutes` (class-banded: 40 for ≤VII, 45 for VIII, 50 for IX–X) and
// per-chapter `recommended_periods` (share of the calibrated annual budget by effort weight).
// That is the same basis the certified canonicals were authored at — SS IX ch 5 is 21×50 —
// so the first lesson she is about to generate and the default she is shown finally agree.
// Before this, first run seeded a flat 12 × 40 min for every chapter of every class, which
// contradicted the canonical by a wide margin (480 min vs 1050 min on that chapter).
// The constants below are now only the pre-fetch seed / last-resort fallback for a
// subject·class the master plan and the NCF norm table both have nothing for.
const DEFAULT_DURATION = 40;   // fallback only (minutes per class)
const DEFAULT_PERIODS = 12;    // fallback only (teaching periods for the chapter)
// Duration wheel: 20–120 minutes in 5-minute steps. Periods wheel: 1–60 periods, 1 at a time.
const DURATION_CHOICES = Array.from({ length: 21 }, (_, i) => 20 + i * 5); // 20,25,…120
const PERIOD_CHOICES = Array.from({ length: 60 }, (_, i) => i + 1);        // 1,2,…60
// DAYS exists ONLY to shape the all--1 grids[] in the activation payload (readiness shape
// compat) — no day schedule is ever collected or shown. Section letters run the full A–Z
// range so a school with many parallel sections can scroll ("wheel") past the first few and
// pick any of them.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Annual-budget estimator — kept because buildActivationPayload still seeds a budget record.
// (ACQ_STEPS, the four-step rail for the deleted post-lesson set-up, went on 2026-08-21; the
// only rail left is the real one, Subject · Class · Chapter. METHOD_ORDER and budgetPeriods
// went with it — the profile and Year Plan own the estimator's UI now.)
/* ★ METHODS / defaultValueFor / DAYS_IN_WEEK / ESTIMATE_WEEKS DELETED 2026-08-27. They were
   already dead here (the comment above records METHOD_ORDER and budgetPeriods going on
   2026-08-21) and the four budget methods have now been retired product-wide: there is ONE,
   the annual period count. The weeks constant lives in lib/format.js as ESTIMATE_WEEKS, which
   is also where ppwFromAnnual reads it — see the import at the top of this file. */
// Teachers say "Class 7", not "Grade VII" — convert the Roman grade slug to its number
// for display (ROMAN starts at "iii" → 3). Falls back to the Roman form if unmapped.
const classNum = (g) => {
  const idx = ROMAN.indexOf(gradeUp(g).toLowerCase());
  return idx >= 0 ? idx + 3 : gradeUp(g);
};

// RollWheel + PickWheel live in wheels.jsx (extracted 2026-07-02) — the SAME selection UI
// is reused by the Settings profile redo, per the one-UI rule.

/* (SectionPicker — the A–Z multi-select overlay behind "Change section" — was deleted on
 * 2026-08-21 with the screens that opened it. First run no longer asks for sections at all:
 * it states the Section {N}A default on the Class step and points at the teaching profile,
 * which owns section editing. SECTION_LETTERS and toggleSection went with it. */

export default function FirstRun({ user, onComplete, onPrepared, onPrepareError, onExit, onSignOut }) {
  const [step, setStep] = useState("welcome");
  /* Her first name for the bar (founder, 2026-08-26) — see <Brand/>. Read once; a
     failure just leaves the id showing, which is what it did before. */
  const [firstName, setFirstName] = useState("");
  useEffect(() => {
    if (!user) { setFirstName(""); return; }
    let live = true;
    getJSON("/account").then((a) => {
      if (!live || !a) return;
      const nm = (a.display_name || "").trim();
      const one = nm && !/^\d+$/.test(nm) ? nm.split(/\s+/)[0] : "";
      setFirstName(one ? one.charAt(0).toUpperCase() + one.slice(1) : "");
    }).catch(() => {});
    return () => { live = false; };
  }, [user]);
  // welcome | subject | grade | chapter   — that is the whole flow (2026-08-21)

  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("");   // slug

  const [grades, setGrades] = useState([]);
  const [grade, setGrade] = useState("");       // slug

  const [chapters, setChapters] = useState([]);
  const [chapterNo, setChapterNo] = useState(""); // chapter_number as string

  const [durationMin, setDurationMin] = useState(DEFAULT_DURATION);
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  // Estimated periods' recommendation is chapter-specific (calibrated master plan, effort-weighted
  // share of the class's annual budget), so it's tracked separately from the live `periods` value —
  // the "Aruvi recommended" periods tag compares the CURRENT value against this, live, on every wheel move:
  // land back on the recommended number and the tag reappears, move off it and the tag drops.
  const [defaultPeriods, setDefaultPeriods] = useState(DEFAULT_PERIODS);
  // The calibrated class duration for this subject·grade, from the same /chapters response
  // (40 ≤VII / 45 VIII / 50 IX–X). Tracked in state for the identical live-tag comparison —
  // it is no longer a flat constant, so it cannot be compared against DEFAULT_DURATION.
  const [stdDuration, setStdDuration] = useState(DEFAULT_DURATION);
  // Both fields sit grey/read-only showing their default until "Change" is pressed, which
  // opens that field's wheel picker (the other field's wheel, if open, closes — only one
  // edit box open at a time).
  const [editingField, setEditingField] = useState(null); // null | "duration" | "periods"
  /* ★ Has she MOVED either wheel by hand? (2026-08-21 — the "it generated at the default" bug.)
   * Both defaults are seeded from async fetches, and both seeding effects used to run
   * unconditionally. The periods one carried a comment claiming it "never clobbers a manual
   * edit (chapterNo unchanged)" because React bails on an unchanged value — but that only holds
   * when the values MATCH. Her hand-set 16 against a recommendation of 19 is not a match, so the
   * late-arriving fetch overwrote it and the request went out at 50 × 19. (The engine was never
   * at fault: SS·ix ch 4 serves 60 × 16 exactly, verified against the library.)
   * Reset points differ because the two facts belong to different things: the periods
   * recommendation is per CHAPTER, so picking another chapter re-earns the right to seed;
   * duration is a property of the CLASS, so only changing subject/class does. */
  const periodsTouched = useRef(false);
  const durationTouched = useRef(false);

  // Section fan-out. `sections` is the letters she's teaching this lesson to (default one,
  // "A", matching the mockup's default "VI A" before she changes it).
  const [sections, setSections] = useState(["A"]);
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const [activating, setActivating] = useState(false);      // busy state for the final handoff
  // Calibrated periods/year for this subject·class, from /chapters. null = no master-plan row.
  const [annualBudget, setAnnualBudget] = useState(null);

  // FULL-PROFILE acquisition (2026-07-05) — after the lesson is generated, first run now collects
  // the whole teaching profile for this subject·grade (sections → durations → periods/week per
  // duration → annual budget) instead of just naming a section. This is the ONE moment she's
  // motivated (desperate to see the lesson), so we acquire everything now rather than leave the
  // first class profile-orphaned. Cards then land UNATTACHED and she taps "+" to attach the lesson.
  const [durations, setDurations] = useState([DEFAULT_DURATION]);       // acquisition durations (multi)
  const [ppwByDur, setPpwByDur] = useState({ [DEFAULT_DURATION]: DEFAULT_PPW }); // { [minutes]: count }
  const [weekTotal, setWeekTotal] = useState(DEFAULT_PPW);              // periods a week, asked FIRST
  const [budget, setBudget] = useState(null);                           // { method, value }
  // (ncfTotal / recTotal — the calibrated-vs-NCF comparison on the budget screen — went with
  // that screen on 2026-08-21. Year Plan shows the same comparison, where she can act on it.)

  // (The preview state — previewBusy/View/Note/Error/PlanFile — went with the "Lesson plan
  // ready!" screen on 2026-08-21. Nothing is previewed in first run any more: the serve is
  // fired and the shell opens on My Lessons, where the ordinary preparing card holds the wait
  // and is replaced in place by the real lesson. See prepareAndHandOff below.)
  /* genon in FIRST RUN (founder, 2026-07-26). This screen used to look only for a pre-saved plan
   * and, finding none, said "no saved test plans available yet" — even for a chapter that HAS a
   * certified canonical and could be built deterministically in milliseconds. Same wiring as
   * PrepareLesson: her one duration × her period count is the matrix, the server partitions the
   * canonical, saves it, and registers it as prepared. The saved-plan fallback stays for chapters
   * with no canonical yet. */
  const [genonChs, setGenonChs] = useState([]);          // chapter numbers with a canonical
  const [canonMinutes, setCanonMinutes] = useState({});  // {chapter: canonical total minutes}
  const [trialInfo, setTrialInfo] = useState(null);      // /entitlement, for the trial line

  /* ★ THREE STATES, NOT TWO (founder, 2026-09-17: *"the web app is stuck in loading subjects"*).
     `catch(() => setSubjects([]))` and a render that tests `length === 0` cannot tell "has not
     arrived yet" from "will never arrive" — so a failed `/subjects` sat under the word
     **Loading…** for ever, on the very first step of first run, with no error and nothing to
     press. A spinner that never ends is the worst failure shape there is: it blames the network
     for as long as she is willing to wait.
     ⚠️ AND AN EMPTY LIST IS NOT A FAILURE. A teacher who arrives already PAID sees only her
     scopes' subjects, so a subscription whose scopes match nothing we serve legitimately filters
     the wheel to nothing — and that needs its own sentence, not a retry she can press for ever.
     Hence `subjLoad`: "" while in flight, "ok" once answered, "fail" on refusal. */
  const [subjLoad, setSubjLoad] = useState("");        // "" in flight · "ok" · "fail"
  const [subjTry, setSubjTry] = useState(0);          // bumped by Try again
  // Load the subject catalogue once (used on the subject step).
  useEffect(() => {
    setSubjLoad("");
    getJSON("/subjects")
      .then((d) => { setSubjects(d.subjects || []); setSubjLoad("ok"); })
      .catch((e) => {
      /* ⚠️ THE REASON GOES TO THE CONSOLE, NEVER TO HER. "Couldn't load the subject list" is
         the right sentence for a teacher — a status code is not — but when this is reported from
         a handset the one thing nobody can see is WHICH failure it was. `getJSON` now retries
         transients three times before it gives up, so anything that reaches here has already
         survived that, and the message says whether it was a status or a dead socket. */
        console.warn("[meyy] /subjects failed:", (e && e.message) || e);
        setSubjects([]); setSubjLoad("fail");
      });
    // Trial state for the chapter step's disclosure line (Step 6 moment (a)); null on
    // failure = line simply doesn't render.
    fetchEntitlement().then(setTrialInfo);
  }, [subjTry]);

  // Stepping away from the chapter step and back (← Change class, ← Back to chapter, etc.)
  // should never re-open a duration/periods wheel the teacher left open — every fresh arrival
  // on the chapter step starts with both boxes closed.
  useEffect(() => {
    if (step === "chapter") setEditingField(null);
  }, [step]);

  // Grades for the chosen subject.
  useEffect(() => {
    if (!subject) { setGrades([]); return; }
    getJSON(`/subjects/${subject}/grades`).then((d) => {
      const gs = [...(d.grades || [])].sort((a, b) => ROMAN.indexOf(a) - ROMAN.indexOf(b));
      setGrades(gs);
    }).catch(() => setGrades([]));
  }, [subject]);

  // Chapters for the chosen subject·grade.
  useEffect(() => {
    if (!subject || !grade) { setChapters([]); setGenonChs([]); setCanonMinutes({}); return; }
    getJSON(`/subjects/${subject}/${grade}/chapters`).then((d) => {
      // Drop chapters the master plan budgets for but NCERT hasn't published (placeholder:true,
      // titled "Book awaited" — 2026-08-06). They belong to the YEAR, so the Year Plan shows
      // them, but there is no summary or mapping to generate a lesson from, so they must never
      // reach a chapter picker.
      setChapters((d.chapters || []).filter((c) => !c.placeholder));
      // Calibrated class duration for this class band — seeds BOTH the chapter-step default and
      // (via startAcquisition) the durations she carries into the profile. Falls back to 40 only
      // if the API is old or the response is malformed.
      const sd = Number(d.standard_duration_minutes) || DEFAULT_DURATION;
      setStdDuration(sd);
      // Seed the wheel ONLY if she hasn't set it herself — this fetch resolves after she can
      // already have opened "Change duration" (see the periodsTouched/durationTouched note).
      if (!durationTouched.current) setDurationMin(sd);
      /* ★ The CALIBRATED annual budget for this subject·class (2026-08-21). It seeds the
         profile's budget record at handoff. It matters that this is the master plan's own
         total and not a guess: Year Plan does not display the per-chapter recommendation, it
         distributes HER budget across the chapters by weight. So when first run seeded a
         plausible-looking 30 weeks × 6/week = 180 for a class whose calibrated year is 245,
         Year Plan scaled every chapter by 180/245 and the founder met a chapter the chapter
         step had just recommended at 19 being suggested at 14. Seeding the real total makes
         the two agree by construction, because the per-chapter recommendations ARE that
         total's effort-weighted shares. */
      const ab = Number(d.annual_budget_periods);
      setAnnualBudget(ab > 0 ? ab : null);
    }).catch(() => setChapters([]));
    getJSON(`/genon/${subject}/${grade}/chapters`)
      .then((d) => { setGenonChs(d.chapters || []); setCanonMinutes(d.canonical_minutes || {}); })
      .catch(() => { setGenonChs([]); setCanonMinutes({}); });
  }, [subject, grade]);

  /* The top bar is position:fixed (see the Brand note below), so a spacer has to reserve its
     height in the flow. MEASURED rather than hardcoded, because the brand block's height moves
     with the breakpoint's font sizes — the same reason page.jsx measures --nav-h for the
     shell's bar. `.fr-wrap` carries a fallback for the first paint, before this lands. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const measure = () => {
      const el = document.querySelector(".fr-brand");
      if (el) root.style.setProperty("--fr-bar-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--fr-bar-h");   // the shell must never inherit it
    };
  }, [step]);

  // Can this chapter be built deterministically from a certified canonical?
  const genonAvailable = !!chapterNo && genonChs.includes(Number(chapterNo));

  // Recommended teaching periods for the chosen chapter — the CALIBRATED figure from the master
  // plan (`recommended_periods` on /chapters; its share of this class's calibrated annual budget
  // by effort weight, at the class's standard duration). The API already falls back to the NCF
  // period-norms estimate where the master plan has no row, and tells us which it used via
  // `recommended_source`; the flat DEFAULT_PERIODS is the last resort when neither table has a
  // figure (e.g. Science·preparatory).
  //
  // This reverses the 2026-07-08 "neutral flat default" decision, which seeded 12 periods for
  // every chapter of every class. That was neutral only in the sense of being uniformly wrong:
  // on a chapter with a certified canonical it contradicted the plan first run was about to
  // generate. A recommendation the teacher can roll off in one gesture beats a placeholder.
  const estimateFor = (no) => {
    const c = chapters.find((x) => String(x.chapter_number) === String(no));
    const rec = c && c.recommended_periods != null ? Math.round(c.recommended_periods) : null;
    return rec && rec > 0 ? rec : DEFAULT_PERIODS;
  };

  // Pick a chapter AND reset its estimate in the SAME event so both land in one batched render
  // (B2, 2026-07-06). Previously the estimate was reset in a post-paint effect keyed on chapterNo,
  // so it trailed the wheel by one render — during fast scrolling that showed a flash of the prior
  // chapter's estimate before converging. Updating them together removes the trailing cycle.
  const pickChapter = (no) => {
    setChapterNo(no);
    const est = estimateFor(no);
    setDefaultPeriods(est);
    // A new chapter carries its own recommendation, so her previous hand-set count was about a
    // different chapter — seeding is right again here, and the wheel re-earns the right to seed.
    periodsTouched.current = false;
    setPeriods(est);
    setEditingField((f) => (f === "periods" ? null : f)); // close a stale edit box, if open
  };

  // Still needed for the initial load (chapters arrive AFTER chapterNo is seeded) and any external
  // chapterNo change: keep the estimate in step.
  // ★ The `defaultPeriods` tag ("Aruvi recommended") must ALWAYS track the chapter, but the WHEEL
  //   is only seeded while she hasn't set it herself — this effect firing late is exactly what
  //   overwrote her count before (see periodsTouched above). Leaving her edit box open matters
  //   too: closing it under her mid-edit was the visible half of the same bug.
  useEffect(() => {
    const c = chapters.find((x) => String(x.chapter_number) === String(chapterNo));
    if (!c) return;
    const est = estimateFor(chapterNo);
    setDefaultPeriods(est);
    if (periodsTouched.current) return;
    setPeriods(est);
    setEditingField((f) => (f === "periods" ? null : f)); // close a stale edit box, if open
  }, [chapters]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosenChapter = chapters.find((c) => String(c.chapter_number) === String(chapterNo));

  // Section tag matches the app-wide convention (MyClasses.jsx / Readiness.jsx): arabic grade
  // number + letter, e.g. "6A" — displayed everywhere else as "Section 6A".
  const tagFor = (letter) => `${classNum(grade)}${letter}`;

  // (startAcquisition — which seeded the profile defaults and opened the deleted four-screen
  // set-up — went on 2026-08-21 with the "Lesson plan ready!" screen that called it. The exact
  // same defaults are now passed straight into finishActivation as `over` by prepareAndHandOff.)
  // (toggleDuration / goPpwToDur / setPpwCount lived here until 2026-08-21 — they drove the
  // deleted acqDurations + acqPpw screens and had no other caller. The multi-duration split
  // they maintained is still reachable from the teaching profile, which owns it now.)

  // (The /ncf-periods fetch for the budget screen's "estimate" method stood here until
  // 2026-08-21. It was gated on `step === "acqBudget"`, a step that no longer exists, so it
  // could never fire again. Year Plan owns that comparison now.)

  // Build the CANONICAL readiness payload — the FULL profile for this one subject·grade: every
  // chosen section, the durations, the per-duration weekly counts (+ derived periods_per_week),
  // and the annual budget keyed by grade index 0. grids[] ships all -1 (no day schedule, ever).
  const buildActivationPayload = (over) => {
    const durs = (over && over.durations) || durations;
    const ppwSrc = (over && over.ppwByDur) || ppwByDur;
    const wkTotal = (over && over.weekTotal) || weekTotal;
    const bdg = (over && over.budget) || budget;
    const secObjs = sections.map((s) => ({ tag: tagFor(s), sec: s }));
    const grid = sections.map(() => DAYS.map(() => -1));
    const ppwMap = normPpw(durs, ppwSrc, wkTotal, lowestDuration(durs));
    const subjectRecord = {
      name: pretty(subject),
      grades: [{
        grade: gradeUp(grade),
        sections: secObjs,
        durations: [...durs],
        ppw_by_duration: ppwMap,
        ppw_anchor: lowestDuration(durs),
        periods_per_week: ppwMapSum(ppwMap),
      }],
      grids: [grid],
      budget: { 0: bdg || { method: "auto", value: 0 } },
    };
    return { subjects: [subjectRecord] };
  };

  // (goCreateCards — the 1.8s "Section Cards are being created…" beat — went on 2026-08-21.
  // The wait it manufactured is now the shell's own preparing card, which is a REAL wait for a
  // real request and lands on the screen where the lesson actually appears.)

  // Finalize: deposit the previewed plan in My Lessons (NOT bound to any section) and hand the
  // full-profile canonical readiness payload to onComplete. Persistence (POST /readiness) is
  // page.jsx's job, same as the old upfront wizard.
  /* `over` carries the profile values the caller has just decided but that React state has not
     caught up with yet — the handoff happens in the SAME tick as the seeding, so reading them
     back off state here would read the previous render's. */
  const finishActivation = (over) => {
    setActivating(true);
    try {
      // Clear any STALE binding for these exact section keys, locally AND on the server. A
      // reused key (e.g. english_iii_3A left over from an earlier run) otherwise resurrects its
      // old chapter via pullSectionState, so a "fresh" card shows someone else's chapter. First
      // run only runs for an empty profile, so a clear here is always safe.
      // NOTE this no longer means the card stays empty — prepareAndHandOff binds the NEW lesson
      // to the default section the moment it lands (see there; reverses 2026-07-05).
      sections.forEach((s) => {
        const secKey = `${subject}_${grade}_${tagFor(s)}`;
        try {
          window.localStorage.removeItem(`current_chapter_${secKey}`);
          window.localStorage.removeItem(`lu_pointer_${secKey}`);
          window.localStorage.removeItem(`lu_done_${secKey}`);
        } catch {}
        pushSectionState(secKey);   // no chapter in localStorage now → deletes the server row
      });
    } catch {}
    onComplete && onComplete(buildActivationPayload(over), (over && over.preparing) || null);
  };
  /* ★ PREPARE AND HAND OFF (founder, 2026-08-21) — there is no "Lesson plan ready!" screen.
   * The chapter step's CTA now fires the serve and IMMEDIATELY opens the shell on My Lessons,
   * where the ordinary preparing card takes over: the proposed lesson drawn at full strength
   * with a progress bar where "Ready to teach" will be, replaced in place when the plan lands.
   * That is exactly what a normal run does (page.jsx `onPreparing`/`onPrepared`), so first run
   * no longer has a waiting screen of its own — one wait, one place, learnt once.
   *
   * The request is deliberately NOT awaited before handing off. FirstRun unmounts the instant
   * page.jsx flips to the shell, but the fetch keeps running inside this closure and still
   * resolves to onPrepared/onPrepareError — the same trick PrepareLesson already relies on.
   *
   * Everything the payload needs is passed DOWN as `over` rather than set on state first: the
   * seeding and the handoff happen in one tick, so state would still hold the previous values.
   */
  const prepareAndHandOff = () => {
    if (!chosenChapter || activating) return;
    const rows = [{ duration: durationMin, count: periods }];
    const preparing = {
      subject, grade,
      chapterNo: Number(chapterNo),
      chapterTitle: chosenChapter.chapter_title,
      rows,
      // WALK-A-019: a retried first lesson must be attached exactly as this one would have been.
      bindKey: `${subject}_${grade}_${tagFor(sections[0] || "A")}`,
    };
    /* The four screens that used to ask for these are gone, so first run SEEDS them — and both
       seeds now come from the SAME calibrated figure (2026-08-27).

       ★ PERIODS/WEEK IS DERIVED, NOT GUESSED. It was a flat DEFAULT_PPW (6) while the budget was
       the master plan's own annual total, and the two disagreed for 18 of 25 subject·grades. The
       profile printed both on one line — "≈ 245 periods for the year, at 6 a week" for
       social_sciences·ix — which works out at 40.8 weeks and is not a school year. Deriving it
       (annual ÷ 30) makes that line read 8 a week, and 8 × 30 ≈ 245.

       ★ DERIVED FROM `annualBudget`, THE API FIELD — never from the stored budget record. The
       record is itself ppw × 30 whenever there is no master-plan row (the fallback below), so
       deriving from it would be circular: round(ppw×30/30) = ppw, a fixed point that justifies
       whatever it already held. The `?:` below is the whole guard — no master-plan figure means
       no derivation, and DEFAULT_PPW stands as the honest fallback.

       The BUDGET stays the calibrated year — see the annual_budget_periods note in the /chapters
       effect for why the old 30-weeks guess made Year Plan contradict the chapter step. */
    const seededPpw = annualBudget ? ppwFromAnnual(annualBudget) : DEFAULT_PPW;
    const over = {
      durations: [durationMin],
      ppwByDur: { [durationMin]: seededPpw },
      weekTotal: seededPpw,
      budget: annualBudget
        ? { method: "periods", value: annualBudget }
        : { method: "weeks", value: 30 },      // no master-plan row for this subject·class
      preparing,
    };
    finishActivation(over);            // profile saved, shell opens on My Lessons, bar showing
    /* ★ HOLD THE BAR (2026-08-21). A genon serve is ~0.3 ms and the round trip is barely more,
     * so without this the card is replaced in the same breath it appears and she sees nothing —
     * which is exactly what the founder reported after the first cut of this handoff. The five
     * seconds are not fake progress: PrepareLesson has held the identical beat since 2026-08-06
     * (PREPARING_MS), for the same reason, and this is her FIRST lesson — the one moment the
     * pause is most worth having. Duplicated rather than shared because PrepareLesson also
     * skips the hold for a plan she has held before (`already_yours`), which cannot apply here:
     * on first run nothing is ever already hers. */
    const startedAt = Date.now();
    const holdBar = () => new Promise((res) => setTimeout(res, Math.max(0, 5000 - (Date.now() - startedAt))));
    postJSON(`/genon/${subject}/${grade}/${chapterNo}/plan`, { rows })
      .then(async (resp) => {
        await holdBar();
        markPrepared(subject, grade, resp.filename);
        invalidatePlans(`${subject}/${grade}`);   // her flags moved — the shared listing must re-read
        /* ★ ATTACH IT (founder, 2026-08-21) — reverses the 2026-07-05 "cards land UNATTACHED"
         * rule, for first run only. That rule was written when binding here made the first class
         * look finished while the profile behind it was never built; the profile IS built now
         * (subject · class · section · duration · calibrated budget), so the reason has expired
         * and what is left is an empty card at the end of a flow whose whole promise was a
         * lesson. The tour still TEACHES attaching — its own orchestration forces the card
         * unbound at steps ≤9 and re-binds at 10, so the demo is unaffected by starting bound. */
        const secKey = `${subject}_${grade}_${tagFor(sections[0] || "A")}`;
        bindSectionChapter(secKey, resp.filename);
        onPrepared && onPrepared({ subject, grade, filename: resp.filename });
      })
      .catch((e) => {
        // Same sentence the API and PrepareLesson use for a chapter with no canonical, so a
        // missing chapter reads identically wherever it is met.
        onPrepareError && onPrepareError(preparing,
          (e && e.detail) || "Couldn't build the lesson plan right now. Try again in a moment.");
      });
  };

  /* ── shared: three-step progress rail (Subject · Grade · Chapter) ── */
  const Progress = ({ active, steps = ["Subject", "Class", "Chapter"] }) => {
    const idx = steps.indexOf(active);
    return (
      <ol className="fr-prog" aria-label="Setup progress">
        {steps.map((label, i) => (
          <li key={label} className={`fr-prog-step ${i < idx ? "done" : ""} ${i === idx ? "current" : ""}`}>
            <span className="fr-prog-dot">{i < idx ? "✓" : i + 1}</span>
            <span className="fr-prog-label">{label}</span>
          </li>
        ))}
      </ol>
    );
  };

  /* ── The top bar (2026-08-21) ──────────────────────────────────────────────────────────
   * First run now wears the SAME pine chrome as the signed-in shell (globals.css `.topbar`
   * / `.hdr`): pine fill edge to edge, cream ink, brand left, theme toggle + user/log-out
   * right, contents capped to the flow's own column. Before this it was a centred paper
   * brand with the user stacked above it — visibly an older Aruvi, and she met it for the
   * whole of her first session, from sign-in to her section cards.
   *
   * It reuses the shell's OWN class names (.hdr / .brand / .hdr-brand-tag / .hdr-user…) so
   * the two can never drift: globals.css paints `.topbar` and `.fr-brand` from one shared
   * block of rules. What it deliberately does NOT carry is NAV — no tabs, no settings gear.
   * Phase 1 is shell-less by design (CLAUDE.md §0); this is chrome, not navigation.
   *
   * Positioned `fixed` (like the shell's bar) so it never rides `.fr-wrap`'s desktop
   * vertical centring; `--fr-bar-h` below reserves its height in the flow. */
  const Brand = () => (
    <div className="fr-brand">
      <header className="hdr">
        <div className="brand">
          <MeyyMark />
          <span className="hdr-brand-tag">lesson studio</span>
        </div>
        <div className="hdr-user">
          {/* ThemeToggle removed 2026-08-24 — Appearance lives in Settings › App once
              the shell opens; first run keeps the bar to brand + identity (the founder
              met the stale toggle here on the subscribed-entry test). */}
          {user && (
            <div className="hdr-user-id">
              {/* Her FIRST NAME once the account has one (founder, 2026-08-26): a
                  direct subscriber types her name at checkout and then met her raw
                  mobile on the very next screen. Same rule as the shell's bar — a
                  numeric display_name is the JIT default, not a name. */}
              <span className="hdr-user-name">{firstName || user}</span>
              {onSignOut && <button className="hdr-user-logout" onClick={onSignOut}>Log out</button>}
            </div>
          )}
        </div>
      </header>
    </div>
  );

  /* ── SUBSCRIBED-ENTRY SCOPE FILTER (founder, 2026-08-24; §0b flow (a)) ──
     A teacher who arrives already PAID (granted before her first sign-in) is offered
     only what she bought: the subject wheel filters to her scopes' subjects, the class
     wheel to her scopes' STAGES — one subject means a one-item wheel, no clutter, no
     mid-first-run paywall possible. Trial and "*" grants see everything (breadth in
     trial is deliberate). `trialInfo` is the /entitlement fetch above. */
  const frPaidScopes = (trialInfo && trialInfo.enforced
    && (trialInfo.status === "active" || trialInfo.status === "grace")
    && !(trialInfo.scopes || []).includes("*")) ? trialInfo.scopes : null;
  const frStageOf = stageOfGrade;   // lib/format is the web's ONE copy of the mapping
  const visibleSubjects = frPaidScopes
    ? subjects.filter((s) => frPaidScopes.some((sc) => sc.split("/")[0] === s))
    : subjects;
  const visibleGrades = frPaidScopes
    ? grades.filter((g) => frPaidScopes.some((sc) =>
        sc.split("/")[0] === subject && sc.split("/")[1] === frStageOf(g)))
    : grades;

  /* ── WELCOME ── */
  if (step === "welcome") {
    return (
      <div className="fr-wrap fr-welcome">
        <Brand />
        {/* SLIMMED WELCOME (founder-approved frame, 2026-08-24): the benefits list
            moved to the front door (Login); this screen is orientation only. The trial
            card renders ONLY for a trial teacher — a subscribed entrant gets the clean
            version (title · To get started · CTA). */}
        <div className="fr-welcome-body">
          <h1 className="fr-welcome-title">Welcome to Meyy!</h1>
          {trialInfo && trialInfo.enforced && trialInfo.status === "trial" ? (
            <>
              <div className="fr-welcome-rule" aria-hidden="true" />
              <div className="fr-trial-card">
                <span className="fr-trial-tick" aria-hidden="true">✓</span>
                <h2 className="fr-trial-h">Your free trial</h2>
                <p className="fr-trial-p">
                  {/* WALK-A-012 (2026-09-20): a number that trialled before and rejoined starts with
                      its used chapters already counted (the trial ledger) — say what is LEFT, not
                      the cap, or she is promised a chapter she does not have. */}
                  {(() => {
                    const cap = trialInfo.trial_chapter_cap;
                    const left = Math.max(0, cap - (trialInfo.trial_chapters_used || 0));
                    return left < cap
                      ? <>You have {left} of your {cap} free chapters left. </>
                      : <>Your free trial covers any {cap} chapters. </>;
                  })()}For
                  any single chapter, you can generate unlimited number of Lesson plans.
                </p>
                <h2 className="fr-trial-h">To get started</h2>
                <p className="fr-trial-p">
                  Answer three quick questions and Meyy will create your first lesson plan.
                </p>
              </div>
            </>
          ) : (
            <>
              <h2 className="fr-welcome-h2">To get started</h2>
              <p className="fr-welcome-sub">
                Answer three quick questions and Meyy will create your first lesson plan.
              </p>
            </>
          )}
        </div>
        <div className="fr-foot">
          <button className="primary fr-cta prepare-cta" onClick={() => setStep("subject")}>Prepare my first lesson →</button>
        </div>
      </div>
    );
  }

  /* ── STEP 1 · SUBJECT ── */
  if (step === "subject") {
    return (
      <div className="fr-wrap">
        <Brand />
        <Progress active="Subject" />
        <div className="fr-step-body">
          <h1 className="fr-q">What do you teach?</h1>
          <p className="fr-hint">Let’s start with one subject. Roll the box or use the arrows — the subject shown is your pick.</p>
          {visibleSubjects.length === 0 && (
            subjLoad === "fail" ? (
              <div className="fr-loading">Couldn’t load the subject list.{" "}
                <button type="button" className="lgl-link" onClick={() => setSubjTry((n) => n + 1)}>Try again</button>
              </div>
            ) : subjLoad === "ok" ? (
              <div className="fr-loading">
                {frPaidScopes ? "Your subscription doesn’t cover any subject we currently offer. Please contact support."
                              : "No subjects are available just now. Please contact support."}
              </div>
            ) : <div className="fr-loading">Loading subjects…</div>
          )}
          {visibleSubjects.length > 0 && (
            <RollWheel ariaLabel="Subject" value={subject} onChange={setSubject} large loop
              items={visibleSubjects.map((s) => ({ id: s, chip: pretty(s).charAt(0), label: pretty(s) }))} />
          )}
        </div>
        <div className="fr-foot">
          <button className="primary fr-cta" disabled={!subject} onClick={() => setStep("grade")}>Continue</button>
          <button className="fr-link" onClick={() => setStep("welcome")}>← Back</button>
        </div>
      </div>
    );
  }

  /* ── STEP 2 · GRADE ── */
  if (step === "grade") {
    return (
      <div className="fr-wrap">
        <Brand />
        <Progress active="Class" />
        <div className="fr-step-body">
          <h1 className="fr-q">Which class do you teach {pretty(subject)} to?</h1>
          <p className="fr-hint">You can add more classes later. Roll the box or use the arrows — the class shown is your pick.</p>
          {visibleGrades.length === 0 && <div className="fr-loading">Loading classes…</div>}
          {/* Changing class re-earns the right to seed the duration wheel: 50 min is a fact about
              Class 9, not about her, so a new class means a new standard. */}
          {visibleGrades.length > 0 && (
            <RollWheel ariaLabel="Class" value={grade}
              onChange={(v) => { durationTouched.current = false; setGrade(v); }} large loop
              items={visibleGrades.map((g) => ({ id: g, chip: classNum(g), label: `Class ${classNum(g)}` }))} />
          )}

          {/* ★ Sections: STATED, not asked (founder, 2026-08-21). They used to be the first of
              FOUR screens demanded AFTER her first lesson generated — sections, periods/week,
              durations, annual budget — which broke the rail's own three-step promise at the
              moment of her first success. The first fix moved a section PICKER here; the founder
              then cut that too ("too complicated in first run"). So first run simply says which
              section it is starting her on and where to change it. She still gets a real section
              card before the tour — whose steps 7–14 all anchor on one — without being asked a
              question whose answer is almost always "just the one". */}
          {grades.length > 0 && grade && (
            <p className="fr-sec-note">
              We&rsquo;ll start you with <b>Section {tagFor(sections[0] || "A")}</b>. You can add or
              rename sections any time from your teaching profile.
            </p>
          )}
        </div>
        <div className="fr-foot">
          <button className="primary fr-cta" disabled={!grade}
            onClick={() => setStep("chapter")}>Continue</button>
          <button className="fr-link" onClick={() => setStep("subject")}>← Change subject</button>
        </div>
      </div>
    );
  }

  /* (The "Lesson plan ready!" screen stood here until 2026-08-21 — first the tick-and-stats
   * card, then briefly the four-unit GLIMPSE that replaced it. The founder cut the screen
   * itself: the chapter CTA now hands off straight to My Lessons and the ordinary preparing
   * card does the waiting, exactly as a normal run does. One wait, one place. Deleted with
   * it: previewView/previewBusy/previewError/previewNote/previewPlanFile and the .fr-plan-*
   * / .fr-glimpse-* styling. `prepareAndHandOff` above is what the CTA calls now.) */

  /* ── The FOUR ACQUISITION SCREENS were deleted here on 2026-08-21 (founder) ──────────────
   * acqSections → acqPpw → acqDurations → acqBudget stood between the generated lesson and
   * the shell. The rail promises three steps (Subject · Class · Chapter); these were four
   * more, demanded at the moment of her FIRST success — the same inversion of §0's
   * benefit-first rule that the "teach other classes?" window was struck for, four screens
   * deep instead of one. And annual budget is the most abstract question in the product,
   * put to someone ninety seconds old who has not yet seen a lesson.
   * Where each went: SECTIONS moved onto the Class step, where it belongs (and where it
   * guarantees a card exists before the tour, whose steps 7-14 all anchor on one). DURATION
   * was already asked on the chapter step — it was a duplicate. PERIODS/WEEK and BUDGET are
   * now seeded with the same sane defaults startAcquisition always used, and she meets them
   * in the teaching profile or Year Plan when they first mean something. ── */

  /* ── STEP · CREATING CARDS — the reward beat, then a DIRECT handoff into the shell.
   * The My Classes home she lands on shows the cards themselves (with the lesson bound),
   * so no interstitial screen re-describes them or asks her to "go" anywhere. ── */
  /* ── STEP 3 · CHAPTER (+ calibrated default duration/periods) ── */
  return (
    <div className="fr-wrap">
      <Brand />
      <Progress active="Chapter" />
      <div className="fr-step-body">
        <h1 className="fr-q">Choose the chapter to teach</h1>
        <p className="fr-hint">Roll the box or use arrows to pick one chapter.</p>

        {chapters.length === 0 && <div className="fr-loading">Loading chapters…</div>}
        {chapters.length > 0 && (
          <RollWheel ariaLabel="Chapter" value={chapterNo} onChange={pickChapter} rowPx={92}
            items={chapters.map((c) => ({ id: String(c.chapter_number), chip: c.chapter_number, label: wheelChapterTitle(c.chapter_title) }))} />
        )}

        <div className="fr-defaults">
          <div className={`fr-default ${editingField === "duration" ? "fr-default-editing" : ""}`}>
            <span className="fr-default-kicker-row">
              <span className="fr-default-kicker">Class duration</span>
              {durationMin === stdDuration && <span className="fr-tag-recommended">NCF recommended</span>}
            </span>
            {editingField !== "duration" ? (
              <div className="fr-default-row">
                <span className="fr-default-val fr-default-val-muted">{durationMin}-minute classes</span>
                <button type="button" className="fr-change-btn" onClick={() => setEditingField("duration")}>
                  Change
                </button>
              </div>
            ) : (
              <div className="fr-default-wheel-wrap">
                <RollWheel ariaLabel="Class duration" value={String(durationMin)}
                  onChange={(v) => { durationTouched.current = true; setDurationMin(Number(v)); }} large
                  items={DURATION_CHOICES.map((m) => ({ id: String(m), chip: m, label: "minute classes" }))} />
                {/* Interim (2026-07-05): first run collects a SINGLE duration on purpose — the
                    mixed-duration case (per-week count per type → count-multiset at generation)
                    lands later in gradual profile acquisition, not here (avoids a schema change +
                    keeps first run benefit-first). This note just reassures her the mix isn't lost. */}
                <p className="fr-hint fr-dur-note">
                  Some classes run longer than others. Let’s keep to one duration for now — you can add more later.
                </p>
                <button type="button" className="fr-done-btn" onClick={() => setEditingField(null)}>Done</button>
              </div>
            )}
          </div>
          <div className={`fr-default ${editingField === "periods" ? "fr-default-editing" : ""}`}>
            <span className="fr-default-kicker-row">
              <span className="fr-default-kicker">Estimated periods</span>
              {/* The two tags read differently ON PURPOSE (founder, 2026-07-26). The DURATION bands
                  (40 ≤VII / 45 VIII / 50 IX) trace back to the NCF-adapted workbook, so that field
                  keeps the NCF attribution. The PERIOD count is genuinely our own calibration —
                  the master plan's effort-weighted share of this class's annual budget — so it is
                  credited to Aruvi. Do not "harmonise" these two strings. */}
              {periods === defaultPeriods && <span className="fr-tag-recommended">Meyy recommended</span>}
            </span>
            {editingField !== "periods" ? (
              <div className="fr-default-row">
                <span className="fr-default-val fr-default-val-muted">{periods} periods</span>
                <button type="button" className="fr-change-btn" onClick={() => setEditingField("periods")}>
                  Change
                </button>
              </div>
            ) : (
              <div className="fr-default-wheel-wrap">
                <RollWheel ariaLabel="Estimated periods" value={String(periods)}
                  onChange={(v) => { periodsTouched.current = true; setPeriods(Number(v)); }} large
                  items={PERIOD_CHOICES.map((p) => ({ id: String(p), chip: p, label: p === 1 ? "period" : "periods" }))} />
                <button type="button" className="fr-done-btn" onClick={() => setEditingField(null)}>Done</button>
              </div>
            )}
            {/* Soft sanity band (2026-07-08): flag very low/high per-chapter counts, but never
                block — she can proceed. Suppressed while she is sitting ON the recommendation
                (2026-07-26): a handful of genuinely short chapters are calibrated below 5 periods
                (English III ch 5/10/14, English VI ch 16, Science VI ch 1), and warning her about
                a number Aruvi itself just proposed reads as a bug. The band only speaks once she
                has rolled the wheel away from the recommendation. */}
            {periods !== defaultPeriods && (periods < 5 || periods > 25) && (
              <p className="fr-bud-warn">
                {periods < 5
                  ? "That’s very few periods for a chapter — you can still go ahead."
                  : "That’s a lot of periods for one chapter — you can still go ahead."}
              </p>
            )}
            {(() => {
              /* The same sub-0.6 coverage floor Prepare Lesson shows, applied to her very first
               * lesson: below 60% of the certified plan's minutes the trailing sections cannot be
               * scheduled at all. Only meaningful for a chapter that HAS a canonical to measure
               * against, and deliberately silent about WHICH sections go — Aruvi teaches the
               * textbook in its own order, so "the later ones" is something she can deduce. */
              const cm = Number(canonMinutes[String(chapterNo)]) || 0;
              const dur = Number(durationMin) || 0;
              const totalP = Number(periods) || 0;
              if (!genonAvailable || !cm || !dur || !totalP) return null;
              /* nearest-whole floor + serve-era wording (2026-08-01) — see PrepareLesson.
                 TEST IN PERIODS, NOT MINUTES (fix 2026-08-02, same defect as PrepareLesson):
                 the old guard `totalMin / cm < 0.6` fired at exactly the floor wherever
                 0.6xA rounds down — at 50x12 the floor is round(7.2)=7, yet 7/12=0.583, so
                 asking for 7 warned about being below 7. One number now drives both the test
                 and the sentence. */
              const floorP = Math.round((0.6 * cm) / dur);
              if (!floorP || totalP >= floorP) return null;
              return (
                <p className="prep-floor">
                  Below {floorP} periods the plan compresses; some
                  sections may move to guided self-study — the plan still closes the chapter and
                  names them.
                </p>
              );
            })()}
          </div>
        </div>
      </div>
      <div className="fr-foot">
        {/* (The trial terms line moved to the WELCOME page, its one home — founder,
            2026-08-24. The chapter step stays clean.) */}
        <button className="primary fr-cta prepare-cta" disabled={!chosenChapter || activating} onClick={prepareAndHandOff}>Prepare the lesson →</button>
        <button className="fr-link" onClick={() => setStep("grade")}>← Change class</button>
      </div>
    </div>
  );
}
