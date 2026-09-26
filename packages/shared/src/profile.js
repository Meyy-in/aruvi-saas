/* ───────── the teaching-profile record: its draft form, and back again ─────────
 *
 * Lifted out of `web/app/components/TeachingProfile.jsx` (Track D step 5d F2, 2026-09-15). Pure
 * functions that decide what a SAVED profile looks like — section records and their labels, the
 * per-grade draft the conversational screens edit, and the canonical record that draft folds
 * back into.
 *
 * ★ WHY THESE HAD TO MOVE BEFORE THE PHONE COULD WRITE ANYTHING. `readinessFingerprint` compares
 * the facts a teacher can change, and `saveReadiness` refuses a write whose read-back does not
 * match. So if the phone composed a record even slightly differently from the web — a trimmed
 * name kept where the web drops it, a section written `{sec}` where the web writes `{tag, sec}` —
 * every phone save would read back as a MISMATCH and she would be told her work was lost when it
 * was merely spelled differently. Both surfaces must emit byte-identical records, and the only
 * way to be sure of that is one implementation.
 */
import { classNum, holdsSubject, stageOfGrade } from "./format.js";
import { budgetPeriods, findScope } from "./budget.js";
import { DEFAULT_DURATION, normPpw, ppwAnchor, ppwMapSum } from "./ppw.js";

export const SEC_NAME_MAX = 8;

/* A stored section is either a bare letter (legacy) or a record; these two read both. */
export const secLetter = (s) => (typeof s === "string" ? s : s.sec);
export const secName = (s) => (typeof s === "string" ? "" : String((s && s.name) || ""));

/* Typed input → storable label. Collapses runs of whitespace and refuses a LEADING space (so the
 * caret can never sit past an invisible character) but KEEPS a trailing one while she is still
 * typing "Blue " + "House"; the trim happens at save, in `secObj`. */
export const cleanSecName = (v) =>
  String(v == null ? "" : v).replace(/\s+/g, " ").replace(/^ /, "").slice(0, SEC_NAME_MAX);

/* The canonical section record. `name` is OMITTED ENTIRELY when she has not given one — not
 * written as "" — because the fingerprint distinguishes a named section from an unnamed one and
 * an empty string is a third spelling of "unnamed" that would read as a change. */
export const secObj = (grade, sec, names) => {
  const nm = cleanSecName((names || {})[sec]).trim();
  const o = { tag: `${classNum(grade)}${sec}`, sec };
  if (nm) o.name = nm;
  return o;
};

/* Stored sections → the { letter: name } map the pick screens edit. */
export const namesFromSections = (list) => {
  const out = {};
  (list || []).forEach((x) => { const n = secName(x); if (n) out[secLetter(x)] = n; });
  return out;
};

/* How a section reads in the running "Chosen (n)" line: the tag, and her name for it if any. */
export const secSummary = (grade, s, names) => {
  const nm = cleanSecName((names || {})[s]).trim();
  return nm ? `${classNum(grade)}${s} (${nm})` : `${classNum(grade)}${s}`;
};

/* The per-grade draft the conversational screens edit: sections as plain LETTERS, with her
 * custom labels riding alongside in a map keyed by letter. `secObj` folds them back on save. */
export const gradeDraftFrom = (rec) => {
  const durations = (rec.durations && rec.durations.length) ? [...rec.durations] : [DEFAULT_DURATION];
  const ppw_by_duration = normPpw(durations, rec.ppw_by_duration, rec.periods_per_week, rec.ppw_anchor);
  return {
    grade: rec.grade,
    sections: (rec.sections || []).map(secLetter),
    section_names: namesFromSections(rec.sections),
    durations,
    ppw_by_duration,
    ppw_anchor: ppwAnchor(durations, ppw_by_duration, rec.ppw_anchor),
    periods_per_week: ppwMapSum(ppw_by_duration),
    budget: null,
  };
};

/* A draft → the canonical subject record that goes on the wire.
 *
 * ⚠️ `grids` is emitted as all −1 for SHAPE COMPATIBILITY only — the timetable grid it once held
 * is gone, but consumers still index it, so the array must keep its shape.
 * ⚠️ A class she never answered for gets `{method:"auto", value:0}`, which is this codebase's
 * spelling of "no budget set" and is read as such everywhere (see budget.js). It is NOT a budget
 * of ppw × 30.
 */
export const finalizeSubject = (d, { daysInWeek = 6 } = {}) => {
  const budget = {};
  d.grades.forEach((g, i) => { budget[i] = g.budget || { method: "auto", value: 0 }; });
  return {
    name: d.name,
    grades: d.grades.map((g) => {
      const ppwMap = normPpw(g.durations, g.ppw_by_duration, g.periods_per_week, g.ppw_anchor);
      return {
        grade: g.grade,
        sections: g.sections.map((sec) => secObj(g.grade, sec, g.section_names)),
        durations: [...g.durations],
        ppw_by_duration: ppwMap,
        ppw_anchor: ppwAnchor(g.durations, ppwMap, g.ppw_anchor),
        periods_per_week: ppwMapSum(ppwMap),
      };
    }),
    grids: d.grades.map((g) => g.sections.map(() => Array(daysInWeek).fill(-1))),
    budget,
  };
};

/* Write ONE class's weekly numbers back onto the profile — the numbers editor's save.
 *
 * ★ IT TOUCHES FOUR FIELDS AND NOTHING ELSE, which is the whole discipline of a spot edit. Her
 * sections, her section names and her budget are other screens' answers; a save that helpfully
 * "normalised" them would be one screen's defaults quietly overwriting another screen's work, and
 * because the record round-trips through a fingerprint she would not even be told.
 * ⚠️ The four are written TOGETHER because they are one fact: a split, its anchor and the total
 * it sums to cannot be updated independently without a moment where the record contradicts
 * itself. `normPpw`/`ppwAnchor`/`ppwMapSum` reconcile them here rather than at the call site, so
 * every caller gets the same consistent shape.
 */
export function setGradeNumbers(subjects, subject, grade, { durations, ppw_by_duration, ppw_anchor }) {
  const at = findScope(subjects, subject, grade);
  if (!at) return subjects;
  const durs = (durations && durations.length) ? [...durations] : [DEFAULT_DURATION];
  const map = normPpw(durs, ppw_by_duration, null, ppw_anchor);
  return subjects.map((s, i) => (i !== at.si ? s : {
    ...s,
    grades: s.grades.map((g, gi) => (gi !== at.gi ? g : {
      ...g,
      durations: durs,
      ppw_by_duration: map,
      ppw_anchor: ppwAnchor(durs, map, ppw_anchor),
      periods_per_week: ppwMapSum(map),
    })),
  }));
}

/* Which class indices a scoped edit may act on.
 *
 * ★ EXACT IS THE YEAR-PLAN PENCIL'S CASE and it is the opposite of the portal's. From the "+"
 * window "which class did you mean?" is a real question; from a screen already showing Class 7's
 * year plan it is an insult, so `exact` narrows to that one class and both pick screens are
 * skipped. Stage-scope is the middle case (a Science·Middle teacher may mean 6, 7 or 8).
 * ⚠️ NEVER BLANK. If the named class is gone — removed since the pencil was drawn — this falls
 * through to the stage filter rather than opening her on a class she no longer teaches, and the
 * stage filter falls through to every class rather than to nothing.
 */
/* ───────── what the two pick screens ask about ─────────
 *
 * Lifted from `web/app/components/TeachingProfile.jsx` (Track D step 5d item 3, 2026-09-15) with
 * the pick screens themselves, for the reason `portalGradeIdxs` below was lifted: BOTH surfaces
 * now render those screens, and the words are the teacher's own. A phone that said "period
 * budget" where the web says "annual period budget" would be a divergence nobody chose, invisible
 * until she read the two screens side by side.
 *
 * `PER_CLASS_GOALS` are the portal rows that resolve to ONE subject·class, and so are the only
 * ones the pick screens serve. "class" is not among them and that is not an omission: classes are
 * managed at the level ABOVE a class, so its row asks for a subject and then goes straight to the
 * manage-classes wheel. "subject" is not among them either — neither window has a Subject row.
 */
export const PER_CLASS_GOALS = ["section", "ppw", "budget"];
export const GOAL_WORD = {
  class: "classes", section: "sections",
  ppw: "periods a week", budget: "annual period budget",
};
/* The fallback is "sections" on both surfaces — an unrecognised goal is a bug, and naming the
   commonest row is a better failure than a blank in the middle of a sentence. */
export const goalWord = (goal) => GOAL_WORD[goal] || "sections";

/* ───── does a subject SURVIVE losing its last class? (founder, 2026-09-17) ─────
 *
 * Until now it never did: "a subject with no classes is not a subject she teaches", so unticking
 * the last class took the whole record with it, on both surfaces. The founder walked it and
 * found what that costs a SUBSCRIBER — "when a subscribed subject is deleted by removing all
 * classes, the lessons in my lessons and the subject option in add button goes too. both should
 * remain". Both losses are the same loss: My Lessons’ wheels and the "+" window’s subject
 * question are built from the profile, so a subject that leaves the profile takes her prepared
 * lessons out of reach and leaves her no door back to a subject she has PAID for.
 *
 * ★ THE LINE IS OWNERSHIP, NOT USE (founder’s answer, 2026-09-17: "only a live paid scope").
 * A subject she bought is hers until the subscription ends, whether or not she teaches a class
 * of it this term — so it stays, with no classes, and the doors back stay open. A TRIAL subject
 * still goes: she owns nothing, and a trial artifact that could never be removed would be the
 * "detached plans" defect made permanent.
 * ⚠️ Read `heldScopesOf`, never `paidScopesOf` — the latter is a display filter and says "no
 * limit" while enforcement is off, which is every teacher in the beta. See format.js.
 * ⚠️ An unreachable entitlement yields NO held scopes, so the old cascade stands. That is the
 * safe direction: a removal she confirmed still happens, and the worst case is a subject she can
 * add back, rather than a record the server refuses to reconcile. */
/* ★ AND IT IS PERMANENT FOR THE TERM (founder, 2026-09-17, answering app. 02 question 6).
 * Surviving an empty class list means a subscriber has NO way to take a held subject out of her
 * profile on either surface until the subscription ends — the accordion dustbin was retired on
 * 2026-09-16 and this rule shuts the last-class door. That was a consequence of the cascade fix
 * rather than a decision, so it was put to the founder as one, and the answer is that OWNERSHIP
 * RUNS FOR THE TERM: she bought a subject-stage, it is hers until it lapses, and Meyy does not
 * offer to take it away. ⚠️ The cost is real and was accepted with the rule — a teacher who buys
 * the wrong subject looks at it all year. If that turns up in support traffic, the fix is a
 * "stop teaching this, keep the subscription" door in the removal redesign (app. 02 row 62),
 * NOT a change here: this function answers "has she bought it?", which is a different question
 * from "does she want it on screen?". Do not soften it into the second one. */
export const subjectSurvivesEmpty = (heldScopes, subjectName) =>
  holdsSubject(heldScopes, subjectName);

export const portalGradeIdxs = (grades, scope) => {
  const list = grades || [];
  const all = list.map((_, gi) => gi);
  if (!scope || !scope.grade) return all;
  if (scope.exact) {
    const want = String(scope.grade).toLowerCase();
    const one = all.filter((gi) => String(list[gi].grade).toLowerCase() === want);
    if (one.length) return one;
  }
  const st = stageOfGrade(scope.grade);
  if (!st) return all;
  const hit = all.filter((gi) => stageOfGrade(list[gi].grade) === st);
  return hit.length ? hit : all;
};

/* ───────── what a portal row should DO — the whole of the pick-screen rule ─────────
 *
 * Lifted out of the phone's `(app)/_layout.jsx` the day the pick screens were built (5d item 3,
 * 2026-09-15), because it is a RULE and CLAUDE.md §3 says a rule lives in one place. It was
 * spelled twice in that file within twenty lines — once when the portal row is tapped and again
 * when the subject question is answered — and the two spellings have to agree or a screen is
 * shown with one row in it, or skipped when two were owed.
 *
 * Takes her subjects, the row she tapped, the window's scope, and (on the second call) the
 * subject she has already chosen. Returns exactly one of:
 *   · `{ ask: "subject" }`         — more than one subject and she has not said which
 *   · `{ ask: "class", subject }`  — subject known, more than one class in play
 *   · `{ open: { subject, grade } }` — nothing left to ask; go straight to the editor
 *   · `null`                       — nothing to act on (an empty profile, an unknown goal)
 *
 * ★ A QUESTION WITH ONE POSSIBLE ANSWER IS NOT A QUESTION. That is the whole of both skips, and
 * it is why a teacher of one subject and one class has never seen either screen and must not
 * start seeing them now.
 * ★ THE CLASS ROW NEVER ASKS WHICH CLASS. Classes are managed at the level ABOVE a class, so
 * "class" resolves a SUBJECT and then opens the manage-classes wheel for the whole set. Its
 * `grade` is a seed for the record the editor reads, never a class it claims she is editing —
 * which is why the editor's kicker for that step names no class.
 */
export function resolvePortalPick(subjects, goal, scope = null, chosenSubject = null) {
  const subs = subjects || [];
  if (!subs.length) return null;
  /* An unrecognised goal is answered before anything is asked — reordering this below the
     subject question would put a pick screen in front of a row that leads nowhere. */
  if (goal !== "class" && !PER_CLASS_GOALS.includes(goal)) return null;
  const recOf = (name) => subs.find((s) => s && s.name === name) || null;

  /* ★ A SCOPED VISIT NAMES THE SUBJECT UP FRONT (founder, 2026-09-17: the check window "must
     only select for the subject & stage in question and not for all"). The added-a-subject
     window is ABOUT one subject·stage, so asking "in which subject?" over her whole profile is
     asking a question she has already answered — and answering it wrongly puts her in a
     subject the window was never about. The web has routed past that screen on a scope since
     2026-08-27 (`sSi >= 0` in TeachingProfile's intent effect); this rule was lifted from the
     PHONE, which never had that half, so the two had diverged in the one direction nobody
     looks: the web was right and the shared rule was not.
     ⚠️ RESOLVED AGAINST HER SUBJECTS, never trusted — a scope naming something she has since
     removed falls back to the ordinary pick screens rather than opening on nothing.
     ⚠️ `chosenSubject` still wins: she cannot reach the subject screen on a scoped visit, but
     if she ever does, her own answer outranks the window's. */
  const named = scope && scope.subject && recOf(scope.subject) ? scope.subject : null;
  const name = chosenSubject || named || (subs.length === 1 ? subs[0].name : null);
  if (!name) return { ask: "subject" };

  const grades = ((recOf(name) || {}).grades) || [];
  /* The scope narrows only the subject it names. A stage scope from an added-subject window must
     reach the class list — a teacher who has just bought Science·Secondary is asked about 9 and
     10, never about the 6, 7, 8 she settled months ago. */
  const sc = scope && scope.subject === name ? scope : null;
  const idxs = portalGradeIdxs(grades, sc);

  if (goal === "class") {
    /* The class row never asks WHICH class — but the record it seeds must come from the stage
       the window is about, or a teacher who bought Science·Secondary opens the manage wheel
       seeded with the Class 6 she settled months ago. `idxs[0]` is `grades[0]` when there is no
       scope, which is exactly what this returned before. */
    const g = grades[idxs[0]];
    return { open: { subject: name, grade: g ? g.grade : undefined } };
  }

  if (idxs.length === 1) return { open: { subject: name, grade: grades[idxs[0]].grade } };
  return { ask: "class", subject: name };
}


/* ───────── what the ACCORDION shows (Track D step 6d, 2026-09-16) ─────────
 *
 * Settings › Teaching profile is a READ of the record above: four headline tiles, one row per
 * subject, one card per class. None of it is stored — every number is derived from `readiness`
 * every time it is drawn, which is the only way a profile screen cannot go stale.
 *
 * ★ THEY ARE HERE RATHER THAN IN EITHER SCREEN because the two surfaces must agree about what a
 * teacher teaches. "41 periods a week" is an arithmetic claim about her working life; a phone
 * that counted sections where the web counted classes would not look broken on either screen —
 * it would simply tell her two different things about the same account, and she would have no
 * way to know which was right. That is the failure mode this package exists to prevent.
 */

/* A class with no sections recorded still teaches ONE. The fallback is load-bearing: an
   older record (or one mid-edit) can carry an empty list, and counting it as zero would
   silently zero the periods-a-week for that class in the headline. */
export const secCount = (g) => ((g && g.sections) || []).length || 1;

/* ★ PERIODS A WEEK IS PER SECTION, MULTIPLIED UP. `periods_per_week` on the record is what ONE
   section meets for; a teacher with three sections of Class 3 stands in front of three of them.
   The headline tile and the subject row both state the multiplied figure, and the class card
   states the per-section split — which is why the card's label says "per section" out loud. */
export const gradePpw = (g) => ((g && g.periods_per_week) || 0) * secCount(g);
export const subjectPpw = (s) => (((s && s.grades) || []).reduce((a, g) => a + gradePpw(g), 0));

/* The four headline tiles. CLASSES are counted as a SET across subjects: a teacher who takes
   Class 6 for both Science and Maths stands in one Class 6.
   ★ SECTIONS ARE COUNTED PER SUBJECT (founder, 2026-09-26, WALK-A-101). 8A taken for Social
   Science and again for Science is two teaching loads — two plans, two budgets, two sets of
   lessons — so it counts twice. The key carries the subject; within one subject a section
   still counts once. (SS in 6/7/8 with 3+4+5 sections = 12; add Science for the same five
   Class 8 sections = 17, not 12.) */
export function profileStats(subjects) {
  const canon = subjects || [];
  const classSet = new Set();
  const secSet = new Set();
  let ppw = 0;
  canon.forEach((s) => ((s.grades) || []).forEach((g) => {
    classSet.add(classNum(g.grade));
    (g.sections || []).forEach((x) => secSet.add(`${s.name}|${classNum(g.grade)}${secLetter(x)}`));
    ppw += gradePpw(g);
  }));
  return { subjects: canon.length, classes: classSet.size, sections: secSet.size, ppw };
}

/* One class card, fully resolved: its name, its section chips, and the two value lines.
 *
 * ⚠️ THE BUDGET IS KEYED BY GRADE INDEX, not by grade, and the key may be a number or a string
 * depending on which surface last wrote it — hence the double lookup. Getting this wrong shows
 * as "—" on a class that has a budget, which reads as "you never set one".
 *
 * ★ A NAMED SECTION CARRIES HER WORD ALONE (founder, 2026-08-30). The class is already stated,
 * in display serif, at the top of the same card, so "6" in "6A · Rose" would be the third time
 * that fact appeared on one card — and it pushes her own name to third place behind it. The
 * letter is not lost: `tag` is what the screen reader announces. */
export function classCard(s, gi) {
  const g = ((s && s.grades) || [])[gi];
  if (!g) return null;
  const n = classNum(g.grade);
  const ppw = g.periods_per_week;
  const b = (s.budget || {})[gi] ?? (s.budget || {})[String(gi)];
  const total = ppw && b ? budgetPeriods(ppw, b) : null;
  const durs = g.durations || [];
  const pmap = g.ppw_by_duration || {};
  /* Periods a week is stated as the SPLIT itself — "7 × 50 min, 1 × 60 min" — never as a bare
     total with the lengths parked in another column (founder, 2026-07-26): the number alone
     never answered the question a teacher actually asks of this card, "what does my week look
     like?". A single-length class reads the same way, so there is one format, not two. */
  const perWeek = durs.length
    ? durs.map((d) => `${pmap[d] ?? pmap[String(d)] ?? 0} × ${d} min`).join(", ")
    : null;
  return {
    grade: g.grade,
    className: `Class ${n}`,
    chips: (g.sections || []).map((x) => {
      const sec = secLetter(x);
      const nm = secName(x);
      return { sec, tag: `${n}${sec}`, label: nm || `${n}${sec}`, named: !!nm };
    }),
    perWeek: perWeek || (ppw ? `${ppw} a week` : "—"),
    annual: total ? `${total} periods` : "—",
  };
}

/* Every card of a subject, in record order. */
export const classCards = (s) => (((s && s.grades) || []).map((_g, gi) => classCard(s, gi)));
