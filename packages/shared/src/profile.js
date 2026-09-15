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
import { classNum, stageOfGrade } from "./format.js";
import { findScope } from "./budget.js";
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
  const recOf = (name) => subs.find((s) => s && s.name === name) || null;

  if (goal === "class") {
    const name = chosenSubject || (subs.length === 1 ? subs[0].name : null);
    if (!name) return { ask: "subject" };
    const rec = recOf(name);
    const g = ((rec && rec.grades) || [])[0];
    return { open: { subject: name, grade: g ? g.grade : undefined } };
  }

  if (!PER_CLASS_GOALS.includes(goal)) return null;

  const name = chosenSubject || (subs.length === 1 ? subs[0].name : null);
  if (!name) return { ask: "subject" };
  const rec = recOf(name);
  const grades = (rec && rec.grades) || [];
  /* The scope narrows only the subject it names. A stage scope from an added-subject window must
     reach the class list — a teacher who has just bought Science·Secondary is asked about 9 and
     10, never about the 6, 7, 8 she settled months ago. */
  const sc = scope && scope.subject === name ? scope : null;
  const idxs = portalGradeIdxs(grades, sc);
  if (idxs.length === 1) return { open: { subject: name, grade: grades[idxs[0]].grade } };
  return { ask: "class", subject: name };
}
