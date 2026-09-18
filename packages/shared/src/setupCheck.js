/* ───────── "are these your sections?" — the queue behind the check window (F3) ─────────
 *
 * Lifted from `web/app/components/ProfilePortal.jsx` (Track D step 5d, 2026-09-15). When a teacher
 * ADDS a subject or a class, the next time she actually uses it Meyy asks her once to confirm its
 * set-up — sections, periods a week, the year. This module is the memory of "which ones are still
 * owed that question", and it is pure enough to test in node, which the window around it is not.
 *
 * ★ ASKED ONCE, EVER. `takeSetupCheck` SPENDS the key as it answers, so the question cannot come
 * back on a later visit. A prompt that reappears reads as Meyy not listening.
 *
 * ★ AND IT IS A PROMPT, NOT A RECORD. Everything here is best-effort: it may be dropped, pruned
 * or lost with the device copy, and the cost is at most one un-asked question. Nothing downstream
 * may depend on a key being present.
 */

import {
  annualBudgetPeriods, classNum, getUser, pretty, stageOfGrade, subjectSlug, userKey,
} from "./format.js";
import { storage } from "./storage.js";

/* ⚠️ The web's key is `setup_check_pending` (no trailing underscore) and signout.js sweeps the
   prefix `setup_check_pending_` that `userKey` produces. Keep all three in step. */
const KEY = () => userKey("setup_check_pending");

/* At most 24 keys. A teacher adding her whole timetable in one sitting queues a dozen; the cap is
   there so a runaway writer cannot grow this without bound, and dropping the OLDEST is right
   because the newest addition is the one she is about to use. */
export const SETUP_CHECK_CAP = 24;

/** How long My Lessons is left alone before the check window opens over it (founder, 2026-08-28).
 *  The window used to arrive in the same tick the dropdown resolved the added subject·class, so
 *  the screen she had just asked for was covered before she saw it. A second is enough for the
 *  pane to paint and for the tap to feel finished. */
export const SETUP_CHECK_DELAY_MS = 1000;

const read = () => {
  if (!getUser()) return [];
  try { const v = JSON.parse(storage.getItem(KEY()) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
};
const write = (list) => {
  if (!getUser()) return;
  try { storage.setItem(KEY(), JSON.stringify(list.slice(-SETUP_CHECK_CAP))); } catch {}
};

export const setupKey = (subjectName, grade) => `${subjectName}|${(grade || "").toUpperCase()}`;

/** Queue subject·class keys she has just added, so their first use raises the check window. */
export function queueSetupCheck(keys) {
  const have = read();
  const next = [...have, ...(keys || []).filter((k) => !have.includes(k))];
  if (next.length !== have.length) write(next);
}

/** Spend the key if it is queued — true means "ask her now". Idempotent: asked once, ever. */
export function takeSetupCheck(key) {
  const have = read();
  if (!have.includes(key)) return false;
  write(have.filter((k) => k !== key));
  return true;
}

/* Drop anything queued that is no longer a subject·class she teaches (2026-08-27). A queued key is
 * only ever SPENT when My Lessons scopes to it, and My Lessons offers only classes in her profile
 * — so a key for something she does not teach can never be spent and would sit in the queue
 * forever. Harmless on its own, but it makes the queue un-auditable, and during live testing this
 * store was once found holding seven keys for classes she already had plus two for classes she has
 * never taught, which no controlled repeat could reproduce. Whatever wrote them, a queue that
 * self-heals against the profile cannot carry them for long.
 * ⚠️ Deliberately NOT called on the baseline read: a transient shrink in readiness must not be
 * read as "she stopped teaching this". */
export function pruneSetupCheck(validKeys) {
  const have = read();
  if (!have.length) return;
  const ok = have.filter((k) => (validKeys || []).includes(k));
  if (ok.length !== have.length) write(ok);
}

/* ───────── WHAT THE CHECK WINDOW SAYS, AND WHAT IT SHOWS (app. 01 rows 75-76) ─────────
 *
 * Both were computed inline in `page.jsx` until the phone needed them too (Track D step 5d
 * item 10, 2026-09-16). They are pure functions of her profile and the window's descriptor, and
 * CLAUDE.md §3's rule applies: a second copy of "which value is safe to show" is a second place
 * for the window to start lying about her record.
 *
 * ★ THEY RETURN DATA, NOT A SENTENCE. The web bolds the subject with <b> and the phone with a
 * nested <Text>; giving each surface a rendered string would mean one of them loses the emphasis
 * or re-parses markup. So the shape of the line is decided here, once, and each surface renders
 * the same two or three parts its own way.
 */


/* ───────── the check window's FIRST moment: first run just finished ─────────
 * ★ ONE TRIGGER, ON BOTH SURFACES (2026-09-18; founder's 2026-09-17 call, lifted from the phone's
 * lib/firstRun.js). "Would you like to check your set-up?" used to ride `finishTour` on the web, so
 * it reached ONLY teachers who ran the tour — and Meyy assumed a section, a periods-a-week and a
 * year's total for the teacher who skipped it just as much. First run queues this flag; My Classes
 * spends it on her first visit that no tour is driving. PERSISTED (not session state) because she
 * lands on My Lessons and may close the app before she ever opens My Classes.
 * ⚠️ `finishTour` must NOT also raise the window — two triggers would ask her twice. */
const FIRST_RUN_KEY = () => userKey("first_run_check_pending");

/** First run just finished: owe her the check window the next time she opens My Classes. */
export function queueFirstRunCheck() {
  try { if (getUser()) storage.setItem(FIRST_RUN_KEY(), "1"); } catch {}
}

/** True once, ever — spending the flag as it answers, like `takeSetupCheck`. */
export function takeFirstRunCheck() {
  try {
    if (!getUser() || !storage.getItem(FIRST_RUN_KEY())) return false;
    storage.removeItem(FIRST_RUN_KEY());
    return true;
  } catch { return false; }
}

/** The sub-line's PARTS — the one thing that differs between the window's two moments.
 *  · added → { reason:"added", subject, stage }   (stage already prettified)
 *  · tour  → { reason:"tour", count, tag }        (tag only when exactly one section exists)
 *  Null when this is not a check window.
 *
 *  It names what Meyy ASSUMED, because that is the whole reason to ask: she never chose a
 *  section, a periods-a-week or a year's total, and she cannot check what she does not know was
 *  set. ⚠️ "with 0 sections" is never a sentence worth showing — a profile that has moved under
 *  us falls back to naming the assumption without counting it (count 0). */
export function setupCheckSub(readiness, win) {
  if (!win || win.mode !== "check") return null;
  /* ★ The added-a-subject line is SHORT, and it names the STAGE (founder, 2026-08-27). It named
     the CLASS once, which was the wrong unit: what she added is a subject-STAGE — the billing
     unit, and the scope this window's rows are filtered to — and a class is one of three inside
     it. The Class row exists precisely so she can say which ones she teaches. */
  if (win.reason === "added") {
    return { reason: "added", subject: win.subject || "", stage: pretty(stageOfGrade(win.grade)) };
  }
  // The tour ending keeps the fuller line: nothing there was ever her choice, so it says so.
  const tags = [];
  ((readiness && readiness.subjects) || []).forEach((s) => (s.grades || []).forEach((g) =>
    tags.push(...(((g && g.sections) || []).map((x) => x && x.tag).filter(Boolean)))));
  return { reason: "tour", count: tags.length, tag: tags.length === 1 ? tags[0] : null };
}

/** The four rows' current values, or null when there is nothing safe to say.
 *
 *  ★ CHECK MOOD ONLY (founder, 2026-08-27: "values only for first time including when new
 *  subject stage added, not during 'what would you like to change' rounds"). The "+" window is
 *  unscoped by nature — it is the whole profile — so a teacher with three subjects would see
 *  "6, 7, 8" against Class, which is noise on a row she is using to navigate. In check mood the
 *  scope is always known: the tour ending is her single set-up, and the added-a-subject window is
 *  filtered to one subject·stage.
 *
 *  ★ A MISSING VALUE RENDERS NOTHING — never a dash, a zero or a guess. A window asking whether
 *  Meyy got her set-up right must not itself invent an answer about her record (the Support
 *  screen's `metaErr` lesson). Hence one shared figure reads as fact and several classes
 *  disagreeing is not a value to show at all. */
export function setupCheckValues(readiness, win) {
  if (!win || win.mode !== "check") return null;
  const subs = (readiness && readiness.subjects) || [];
  const scoped = win.reason === "added" && win.subject
    ? subs.filter((s) => s.name === win.subject) : subs;
  const stage = win.reason === "added" && win.grade ? stageOfGrade(win.grade) : null;
  const grades = [];
  scoped.forEach((s) => (s.grades || []).forEach((g) => {
    if (!stage || stageOfGrade(g.grade) === stage) grades.push({ s, g });
  }));
  if (!grades.length) return null;

  const list = (xs) => (xs.length > 3 ? `${xs.slice(0, 3).join(", ")}…` : xs.join(", "));
  const uniq = (xs) => [...new Set(xs.filter((x) => x != null && x !== ""))];

  const classes = uniq(grades.map(({ g }) => classNum(g.grade)));
  const sections = uniq(grades.flatMap(({ g }) => ((g && g.sections) || []).map((x) => x && x.tag)));
  const ppws = uniq(grades.map(({ g }) => g.periods_per_week));
  /* Read through `annualBudgetPeriods` — the SAME function Year Plan displays from — rather than
     off `subject.budget[gi]` directly. That record holds a method (periods | weeks | days) and is
     absent entirely while the budget is still the auto estimate, so a direct read would show
     nothing for most teachers and a raw week count for some. Two screens quoting different annual
     totals for one class is worse than a window that stays quiet. */
  const budgets = uniq(grades.map(({ s, g }) =>
    annualBudgetPeriods(readiness, subjectSlug(s.name), (g.grade || "").toLowerCase())));

  return {
    class: classes.length ? list(classes) : null,
    section: sections.length ? list(sections) : null,
    ppw: ppws.length === 1 ? `${ppws[0]} a week` : null,
    budget: budgets.length === 1 ? `${budgets[0]} periods` : null,
  };
}
