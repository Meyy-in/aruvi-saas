/* ───────── the annual period budget: ONE reader, ONE writer ─────────
 *
 * A teacher's year for one subject·class is a single number — "I have 215 periods for Science
 * with Class 9" — and it is stored on her teaching-profile record as `subject.budget[gradeIndex]`.
 * This module is that number's arithmetic, lifted out of `TeachingProfile.jsx` (Track D step 5c,
 * 2026-09-15) so the phone's budget editor and the web's read exactly the same record rather
 * than each deriving it. CLAUDE.md §4: the phone matches the web by default, and the safest way
 * to make that true of a NUMBER is to give both surfaces the same function.
 *
 * ★ ONE METHOD IS WRITTEN, FOUR ARE READ (founder, 2026-08-27). There used to be four ways to
 * construct the figure — "I know my teaching weeks" | "my period count" | "my working days" |
 * "estimate it". They existed because Aruvi could not tell her what her year should be; the
 * calibrated master plan ended that (it knows 245 for social_sciences·ix), so she is no longer
 * BUILDING a budget from raw materials, she is DISAGREEING with one. That needs one input.
 * Three of the four also multiplied by periods-a-week, so a wrong ppw corrupted the money, and
 * nothing reconciled them: at 7 a week, "200 periods" implies 28.6 teaching weeks, "170 working
 * days" implies 24, "220" implies 31 — three inputs describing one year.
 *
 * ⚠️ THE READER MUST KEEP UNDERSTANDING ALL FOUR. Teachers have saved weeks/days/auto records;
 * retiring the WRITER is safe, retiring the reader would silently move their years. Nothing new
 * is ever written in those shapes.
 *
 * ⚠️ AND THERE IS A SECOND READER IN THIS PACKAGE, `annualBudgetPeriods` in format.js, which the
 * Year Plan and the class cards use. It is NOT redundant and not a candidate for merging here
 * without a decision: it derives its weekly periods from the marked GRID cells ÷ section count,
 * falling back to `periods_per_week`, where this one takes `periods_per_week` as given. On the
 * one shape now written (`periods`) both return `b.value` and cannot disagree. They can only
 * part company on a legacy weeks/days/auto record whose grid and `periods_per_week` tell
 * different stories — a real but pre-existing question, recorded here rather than resolved blind.
 */

export const DAYS_IN_WEEK = 6;
export const ESTIMATE_WEEKS = 30;   // mirrors format.js; kept local so this module stands alone

/* The reader. `ppw` is the class's periods a week; `b` the stored record. */
export function budgetPeriods(ppw, b) {
  if (!b) return null;
  if (b.method === "weeks") return ppw * b.value;                            // legacy record
  if (b.method === "periods") return b.value;                                // the only shape written now
  if (b.method === "days") return Math.round(ppw * b.value / DAYS_IN_WEEK);  // legacy
  return b.value ? b.value : ppw * ESTIMATE_WEEKS;                           // legacy "auto"
}

/* ★ THE ONE PLACE a stored budget becomes the editable period count. Whatever shape is on disk
   — a legacy weeks/days/auto record, or nothing at all — the editor opens on the ANNUAL TOTAL it
   evaluates to, and saves it back as `periods`. So a teacher who once answered in weeks sees the
   same year she has always had, and it simply stops being expressed as a multiplier. That is the
   conversion the old `setMethod` never did: it REPLACED the value with a fresh default, which is
   how a calibrated 245 silently became 6 × 30 = 180 (the 19→14 defect of 2026-08-21, reachable
   through a second door).

   With NO record at all, Aruvi's calibrated figure leads (`rec`); the ppw-based estimate is the
   last resort, for a subject·class the master plan has no row for.

   ★ `{method:"auto", value:0}` IS "no budget set", not a budget of ppw × 30. That is the record
   `finalizeSubject` writes for any class she has not answered for, and reading it as a real
   figure is what kept the calibrated year from ever being consulted on that path — every such
   class silently landed on 180 while Aruvi's own answer for it was 245. `budgetPeriods` must
   keep resolving it to a number (Year Plan and the class cards have to print something), so the
   distinction is drawn HERE, where the question is "has she actually chosen?" rather than "what
   does this evaluate to?". */
export function normalizeBudget(stored, ppw, rec) {
  const unset = !stored || (stored.method === "auto" && !stored.value);
  const evaluated = unset ? null : budgetPeriods(ppw, stored);
  const value = evaluated && evaluated > 0
    ? evaluated
    : (rec && rec > 0 ? rec : Math.max(1, ppw * ESTIMATE_WEEKS));
  return { method: "periods", value };
}

/* Floor at 1 (B3, 2026-07-06) — a 0-period year is never valid, by typing or by stepping. */
export const clampPeriods = (v) => Math.max(1, Number(v) || 0);

/* Locate one subject·class on a profile's `subjects` array. Returns {si, gi} or null.
   `subject` is the DISPLAY name and `grade` the Roman class, because that is what the profile
   record keys on — the slugs the Year Plan fetches with are a different alphabet. */
export function findScope(subjects, subject, grade) {
  const si = (subjects || []).findIndex((s) => s.name === subject);
  if (si < 0) return null;
  const want = String(grade || "").toLowerCase();
  const gi = ((subjects[si].grades) || []).findIndex((g) => (g.grade || "").toLowerCase() === want);
  return gi < 0 ? null : { si, gi };
}

/* The WRITER. Returns a NEW subjects array with this class's budget set to `periods`, as the
 * only shape now written. Everything else on the record is left exactly as it was — this is the
 * budget pencil's whole remit, and a spot edit that rewrote neighbouring fields would be a way
 * for one screen's defaults to overwrite another screen's answers.
 *
 * ⚠️ The budget map is keyed by grade INDEX, which is why it is re-keyed whenever the grade list
 * changes shape elsewhere (`rekeyBudget`). Nothing here changes that list, so the index is safe.
 * Keys are written as NUMBERS and read with a String() fallback, because both spellings exist on
 * records already saved.
 */
export function setGradeBudget(subjects, subject, grade, periods) {
  const at = findScope(subjects, subject, grade);
  if (!at) return subjects;
  const value = clampPeriods(periods);
  return subjects.map((s, i) => (i !== at.si ? s : {
    ...s,
    budget: { ...(s.budget || {}), [at.gi]: { method: "periods", value } },
  }));
}

/* ⚠️ THE MAP IS KEYED BY GRADE INDEX, so it must be RE-KEYED whenever the grade list changes
 * shape. Removing Class 7 from a teacher of 6·7·8 shifts 8 from index 2 to index 1 — and without
 * this, index 1's budget (7's) would silently become Class 8's year. Re-keying goes through the
 * GRADE NAME, which is the stable identity the index is only ever a position of.
 * A grade with no stored budget stays absent rather than being written as a zero record: absent
 * is "not set", and inventing a record for a class she never answered for is what put every such
 * class on 180 instead of Aruvi's calibrated year. */
export function rekeyBudget(oldGrades, oldBudget, newGrades) {
  const byGrade = {};
  (oldGrades || []).forEach((g, i) => {
    const b = (oldBudget || {})[i] ?? (oldBudget || {})[String(i)];
    if (b) byGrade[g.grade] = b;
  });
  const out = {};
  (newGrades || []).forEach((g, i) => { if (byGrade[g.grade]) out[i] = byGrade[g.grade]; });
  return out;
}

/* The stored record for one subject·class, in either key spelling. */
export function gradeBudgetRecord(subjects, subject, grade) {
  const at = findScope(subjects, subject, grade);
  if (!at) return null;
  const map = subjects[at.si].budget || {};
  return map[at.gi] ?? map[String(at.gi)] ?? null;
}
