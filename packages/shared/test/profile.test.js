/* The record a save actually puts on the wire (F2).
 *
 * ★ THE STAKE HERE IS NOT COSMETIC. `readinessFingerprint` compares the facts a teacher can
 * change, and `saveReadiness` calls a write a MISMATCH when the read-back differs. So if the
 * phone composed a record even slightly differently from the web — a name written "" where the
 * web omits it, a section written as a bare letter where the web writes {tag, sec} — every phone
 * save would report her work as lost when it was merely spelled differently. These tests hold
 * the spellings still.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setStorage } from "../src/storage.js";
import {
  SEC_NAME_MAX, secLetter, secName, cleanSecName, secObj, namesFromSections, secSummary,
  gradeDraftFrom, finalizeSubject, portalGradeIdxs, setGradeNumbers,
  resolvePortalPick, goalWord, PER_CLASS_GOALS,
} from "../src/profile.js";
import { rekeyBudget } from "../src/budget.js";
import { readinessFingerprint } from "../src/verify.js";

setStorage({ getItem: () => null, setItem: () => {}, removeItem: () => {}, keys: () => [] });

/* ── section labels ───────────────────────────────────────────────────────────────── */

test("cleanSecName collapses runs, refuses a LEADING space, keeps a trailing one", () => {
  assert.equal(cleanSecName("Blue   Ho"), "Blue Ho");
  // …and the 8-char cap applies AFTER collapsing, so "Blue   House" lands as "Blue Hou"
  assert.equal(cleanSecName("Blue   House"), "Blue Hou");
  assert.equal(cleanSecName("  Rose"), "Rose");
  // kept while she is still typing "Blue " + "House" — the trim happens at save, in secObj
  assert.equal(cleanSecName("Blue "), "Blue ");
  assert.equal(cleanSecName("abcdefghijk").length, SEC_NAME_MAX);
  assert.equal(cleanSecName(null), "");
});

test("★ secObj OMITS `name` entirely when unnamed — never writes an empty string", () => {
  const bare = secObj("IX", "A", {});
  assert.deepEqual(bare, { tag: "9A", sec: "A" });
  assert.ok(!("name" in bare), '"" is a third spelling of "unnamed" and reads as a change');
  assert.deepEqual(secObj("IX", "A", { A: "  " }), { tag: "9A", sec: "A" });
  assert.deepEqual(secObj("IX", "A", { A: "Rose " }), { tag: "9A", sec: "A", name: "Rose" });
});

test("secLetter and secName read both the legacy and the current shape", () => {
  assert.equal(secLetter("B"), "B");
  assert.equal(secLetter({ tag: "9B", sec: "B" }), "B");
  assert.equal(secName("B"), "");
  assert.equal(secName({ sec: "B", name: "Rose" }), "Rose");
});

test("namesFromSections and secSummary", () => {
  assert.deepEqual(namesFromSections([{ sec: "A", name: "Rose" }, { sec: "B" }, "C"]), { A: "Rose" });
  assert.equal(secSummary("IX", "A", { A: "Rose" }), "9A (Rose)");
  assert.equal(secSummary("IX", "A", {}), "9A");
});

/* ── draft ⇄ record ───────────────────────────────────────────────────────────────── */

const REC = {
  grade: "IX",
  sections: [{ tag: "9A", sec: "A", name: "Rose" }, { tag: "9B", sec: "B" }],
  durations: [40, 60], ppw_by_duration: { 40: 5, 60: 3 }, ppw_anchor: 40, periods_per_week: 8,
};

test("gradeDraftFrom flattens sections to letters and carries her labels alongside", () => {
  const d = gradeDraftFrom(REC);
  assert.deepEqual(d.sections, ["A", "B"]);
  assert.deepEqual(d.section_names, { A: "Rose" });
  assert.equal(d.periods_per_week, 8);
  assert.equal(d.ppw_anchor, 40);
  assert.equal(d.budget, null, "the draft never carries a budget — that edit has its own screen");
});

test("★ a record survives the round trip UNCHANGED under the fingerprint", () => {
  const before = [{ name: "Science", grades: [REC], budget: { 0: { method: "periods", value: 215 } } }];
  const draft = { name: "Science", grades: [{ ...gradeDraftFrom(REC), budget: before[0].budget[0] }] };
  const after = [finalizeSubject(draft)];
  assert.equal(readinessFingerprint(after), readinessFingerprint(before),
    "draft → record must be a no-op for anything a teacher can change");
});

test("finalizeSubject: grids keep their shape, an unanswered class gets {auto,0}", () => {
  const rec = finalizeSubject({ name: "Science", grades: [gradeDraftFrom(REC)] });
  assert.deepEqual(rec.budget, { 0: { method: "auto", value: 0 } });
  assert.deepEqual(rec.grids, [[[-1, -1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1]]]);
  assert.deepEqual(rec.grades[0].sections, [{ tag: "9A", sec: "A", name: "Rose" }, { tag: "9B", sec: "B" }]);
});

/* ── the index-key trap ───────────────────────────────────────────────────────────── */

test("★ rekeyBudget follows the GRADE, not the position", () => {
  const oldG = [{ grade: "VI" }, { grade: "VII" }, { grade: "VIII" }];
  const oldB = { 0: { method: "periods", value: 100 }, 1: { method: "periods", value: 200 },
                 2: { method: "periods", value: 300 } };
  // Class VII leaves; VIII slides from index 2 to index 1.
  const out = rekeyBudget(oldG, oldB, [{ grade: "VI" }, { grade: "VIII" }]);
  assert.deepEqual(out, { 0: { method: "periods", value: 100 }, 1: { method: "periods", value: 300 } },
    "VIII must keep its own 300, not inherit VII's 200");
});

test("rekeyBudget leaves a class with no stored budget ABSENT, not zeroed", () => {
  const out = rekeyBudget([{ grade: "VI" }], { 0: { method: "periods", value: 100 } },
                          [{ grade: "VI" }, { grade: "X" }]);
  assert.deepEqual(out, { 0: { method: "periods", value: 100 } });
  assert.ok(!(1 in out), "inventing a record for a class she never answered for is what put every such class on 180");
});

/* ── scope ────────────────────────────────────────────────────────────────────────── */

const GRADES = [{ grade: "VI" }, { grade: "VII" }, { grade: "VIII" }, { grade: "X" }];

test("portalGradeIdxs: exact narrows to the one class (the Year Plan pencil's case)", () => {
  assert.deepEqual(portalGradeIdxs(GRADES, { grade: "VII", exact: true }), [1]);
});

test("portalGradeIdxs: stage scope offers that stage's classes", () => {
  assert.deepEqual(portalGradeIdxs(GRADES, { grade: "VII" }), [0, 1, 2]);
});

test("★ portalGradeIdxs NEVER returns blank", () => {
  // the named class is gone since the pencil was drawn → fall through to its stage…
  assert.deepEqual(portalGradeIdxs(GRADES, { grade: "IX", exact: true }), [3],
    "IX is secondary; X is the only secondary class she has left");
  // …and an unscoped or unknown ask offers everything
  assert.deepEqual(portalGradeIdxs(GRADES, null), [0, 1, 2, 3]);
  assert.deepEqual(portalGradeIdxs(GRADES, { grade: "" }), [0, 1, 2, 3]);
  assert.deepEqual(portalGradeIdxs([], { grade: "VII", exact: true }), []);
});

/* ── the numbers editor's writer ───────────────────────────────────────────────────── */

test("★ setGradeNumbers touches four fields and nothing else", () => {
  const before = [{
    name: "Science",
    grades: [REC, { grade: "X", sections: [{ tag: "10A", sec: "A" }], durations: [40], periods_per_week: 6 }],
    budget: { 0: { method: "periods", value: 215 }, 1: { method: "periods", value: 150 } },
  }];
  const after = setGradeNumbers(before, "Science", "IX",
    { durations: [40, 60], ppw_by_duration: { 40: 7, 60: 3 }, ppw_anchor: 40 });
  const g = after[0].grades[0];
  assert.equal(g.periods_per_week, 10);
  assert.deepEqual(g.ppw_by_duration, { 40: 7, 60: 3 });
  // …and her OTHER answers are untouched
  assert.deepEqual(g.sections, REC.sections, "sections belong to another screen");
  assert.deepEqual(after[0].budget, before[0].budget, "so does the budget");
  assert.deepEqual(after[0].grades[1], before[0].grades[1], "and so does her other class");
  assert.deepEqual(before[0].grades[0], REC, "the input is never mutated");
});

test("setGradeNumbers reconciles the split, its anchor and the total as ONE fact", () => {
  // A caller hands it a split for a length that is no longer ticked; the anchor absorbs it and
  // the record cannot come out contradicting itself.
  const before = [{ name: "Science", grades: [REC], budget: {} }];
  const g = setGradeNumbers(before, "Science", "IX",
    { durations: [40], ppw_by_duration: { 40: 5, 60: 3 }, ppw_anchor: 40 })[0].grades[0];
  assert.deepEqual(g.durations, [40]);
  assert.deepEqual(g.ppw_by_duration, { 40: 8 });
  assert.equal(g.ppw_anchor, 40);
  assert.equal(g.periods_per_week, 8, "the total is the sum of the map it ships with");
});

test("setGradeNumbers is a no-op off-scope", () => {
  const p = [{ name: "Science", grades: [REC], budget: {} }];
  assert.equal(setGradeNumbers(p, "Physics", "IX", { durations: [40] }), p);
});


/* ───────── resolvePortalPick — what a portal row should DO (5d item 3, 2026-09-15) ─────────
   The rule the phone's pick screens route on. Two skips carry the whole design, and both say the
   same thing: a question with one possible answer is not a question. */
const PICK_SUBS = [
  { name: "Science", grades: [{ grade: "VI" }, { grade: "VII" }, { grade: "IX" }] },
  { name: "English", grades: [{ grade: "III" }] },
];

test("resolvePortalPick: more than one subject asks which subject", () => {
  assert.deepEqual(resolvePortalPick(PICK_SUBS, "section"), { ask: "subject" });
});

test("resolvePortalPick: one subject skips that question and asks which class", () => {
  assert.deepEqual(resolvePortalPick([PICK_SUBS[0]], "section"),
    { ask: "class", subject: "Science" });
});

test("★ resolvePortalPick: one subject AND one class asks nothing at all", () => {
  // The common teacher, and the behaviour that existed before the pick screens. She must not
  // start meeting a screen the day they land.
  assert.deepEqual(resolvePortalPick([PICK_SUBS[1]], "ppw"),
    { open: { subject: "English", grade: "III" } });
});

test("resolvePortalPick: a STAGE scope narrows the class question to that stage", () => {
  // Science·Secondary just bought: IX is the only secondary class she teaches, so there is
  // nothing left to ask — and the settled VI/VII are never offered.
  assert.deepEqual(
    resolvePortalPick(PICK_SUBS, "budget", { subject: "Science", grade: "IX" }, "Science"),
    { open: { subject: "Science", grade: "IX" } });
});

test("resolvePortalPick: an EXACT scope skips both screens (the Year Plan pencil)", () => {
  assert.deepEqual(
    resolvePortalPick(PICK_SUBS, "budget", { subject: "Science", grade: "VII", exact: true }, "Science"),
    { open: { subject: "Science", grade: "VII" } });
});

test("★ resolvePortalPick: a scope naming ANOTHER subject does not narrow this one", () => {
  // The scope narrows only the subject it names — otherwise an English scope would silently
  // filter Science's classes by English's stage.
  assert.deepEqual(
    resolvePortalPick(PICK_SUBS, "section", { subject: "English", grade: "III" }, "Science"),
    { ask: "class", subject: "Science" });
});

test("resolvePortalPick: the CLASS row resolves a subject and never asks which class", () => {
  assert.deepEqual(resolvePortalPick(PICK_SUBS, "class"), { ask: "subject" });
  // Chosen: straight to the manage-classes wheel for the whole set, whatever the scope says.
  assert.deepEqual(
    resolvePortalPick(PICK_SUBS, "class", { subject: "Science", grade: "IX" }, "Science"),
    { open: { subject: "Science", grade: "VI" } });
});

test("resolvePortalPick: nothing to act on returns null, never a blank screen", () => {
  assert.equal(resolvePortalPick([], "section"), null);
  assert.equal(resolvePortalPick(null, "section"), null);
  assert.equal(resolvePortalPick(PICK_SUBS, "subject"), null, "no window has a Subject row");
  assert.equal(resolvePortalPick(PICK_SUBS, "nonsense"), null);
});

test("goalWord: the teacher's own words, one copy for both surfaces", () => {
  assert.equal(goalWord("budget"), "annual period budget");
  assert.equal(goalWord("ppw"), "periods a week");
  assert.equal(goalWord("section"), "sections");
  assert.equal(goalWord("class"), "classes");
  // An unrecognised goal is a bug; naming the commonest row beats a blank mid-sentence.
  assert.equal(goalWord("zzz"), "sections");
  assert.deepEqual(PER_CLASS_GOALS, ["section", "ppw", "budget"]);
});
