/* ───────── what the teaching-profile accordion SHOWS ─────────
 *
 * Four tiles, a per-subject total and a class card, all derived from `readiness` — and since
 * 2026-09-16 derived by ONE implementation that the web and the phone both call.
 *
 * ★ WHY THESE ARE WORTH TESTING AT ALL, given they are four lines of arithmetic. Because they
 * are a CLAIM ABOUT A TEACHER'S WORKING LIFE. "41 periods a week" is either her week or it is
 * not, and both surfaces draw it in the same warm serif with the same confidence. If the phone
 * counted sections where the web counted classes, neither screen would look broken — she would
 * simply be told two different things about one account, with no way to know which was right.
 * That is the failure this package exists to prevent, so the arithmetic gets pinned here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { classCard, classCards, gradePpw, profileStats, secCount, subjectPpw } from "../src/profile.js";

/* One teacher, close to the founder's live account: English across three classes with named
   sections, Maths with a plain one, and a class shared between the two subjects. */
const SUBJECTS = [
  {
    name: "English",
    grades: [
      { grade: "iii", periods_per_week: 5, durations: [40], ppw_by_duration: { 40: 5 },
        sections: [{ tag: "3A", sec: "A", name: "Aruvi" }, { tag: "3B", sec: "B", name: "Kadal" },
                   { tag: "3C", sec: "C", name: "Vanam" }] },
      { grade: "iv", periods_per_week: 5, durations: [40], ppw_by_duration: { 40: 5 },
        sections: [{ tag: "4A", sec: "A", name: "Nadhi" }] },
      { grade: "vi", periods_per_week: 5, durations: [40], ppw_by_duration: { 40: 5 },
        sections: [{ tag: "6A", sec: "A" }] },
    ],
    budget: { 0: { method: "periods", value: 145 }, 1: { method: "periods", value: 140 } },
  },
  {
    name: "Mathematics",
    grades: [
      { grade: "vi", periods_per_week: 6, durations: [45, 60], ppw_by_duration: { 45: 4, 60: 2 },
        sections: [{ tag: "6A", sec: "A" }] },
    ],
    budget: {},
  },
];

test("periods a week is per section, multiplied by the sections she stands in front of", () => {
  assert.equal(secCount(SUBJECTS[0].grades[0]), 3);
  assert.equal(gradePpw(SUBJECTS[0].grades[0]), 15);   // 5 × 3, not 5
  assert.equal(subjectPpw(SUBJECTS[0]), 15 + 5 + 5);
  assert.equal(subjectPpw(SUBJECTS[1]), 6);
});

test("a class with no sections recorded still teaches one", () => {
  assert.equal(secCount({ sections: [] }), 1);
  assert.equal(secCount({}), 1);
  assert.equal(gradePpw({ periods_per_week: 4 }), 4);
});

/* ★ A CLASS SHARED BETWEEN SUBJECTS IS ONE CLASS. She stands in one Class 6; a profile that
   told her she had two would be counting her timetable rather than her school. Sections are
   counted the same way, by their tag — 6A is 6A whichever subject she takes it for. */
test("classes and sections are counted as sets across subjects, not summed per subject", () => {
  const s = profileStats(SUBJECTS);
  assert.equal(s.subjects, 2);
  assert.equal(s.classes, 3, "iii, iv, vi — vi is shared and counts once");
  assert.equal(s.sections, 5, "3A 3B 3C 4A 6A — 6A is shared and counts once");
  assert.equal(s.ppw, 31, "15 + 5 + 5 for English, 6 for Maths");
});

test("an empty profile is four honest zeroes, not a crash", () => {
  assert.deepEqual(profileStats([]), { subjects: 0, classes: 0, sections: 0, ppw: 0 });
  assert.deepEqual(profileStats(null), { subjects: 0, classes: 0, sections: 0, ppw: 0 });
});

test("the class card states the split itself, not a bare total", () => {
  const cc = classCard(SUBJECTS[1], 0);
  assert.equal(cc.className, "Class 6");
  assert.equal(cc.perWeek, "4 × 45 min, 2 × 60 min");
});

test("a single-length class reads in the same format — one format, not two", () => {
  assert.equal(classCard(SUBJECTS[0], 0).perWeek, "5 × 40 min");
});

/* ★ HER WORD ALONE. The class is already stated in display serif at the top of the same card, so
   a named chip showing "3A · Aruvi" would be that fact a third time and would push her own name
   to third place behind it. The letter is not lost — it is in `tag`, which is what the screen
   reader announces. */
test("a named section shows her name; an unnamed one shows the tag", () => {
  const eng = classCard(SUBJECTS[0], 0);
  assert.deepEqual(eng.chips.map((c) => c.label), ["Aruvi", "Kadal", "Vanam"]);
  assert.deepEqual(eng.chips.map((c) => c.tag), ["3A", "3B", "3C"]);
  assert.ok(eng.chips.every((c) => c.named));
  const maths = classCard(SUBJECTS[1], 0);
  assert.deepEqual(maths.chips.map((c) => c.label), ["6A"]);
  assert.equal(maths.chips[0].named, false);
});

/* ⚠️ The budget map is keyed by GRADE INDEX, and the key may be a number or a string depending
   on which surface last wrote it. Getting that wrong shows as "—" on a class that HAS a budget,
   which reads to a teacher as "you never set one". */
test("the budget is found whether its index key is a number or a string", () => {
  assert.equal(classCard(SUBJECTS[0], 0).annual, "145 periods");
  const stringKeyed = { ...SUBJECTS[0], budget: { "0": { method: "periods", value: 145 } } };
  assert.equal(classCard(stringKeyed, 0).annual, "145 periods");
});

test("a class with no budget says so with an em-dash, and does not invent one", () => {
  assert.equal(classCard(SUBJECTS[0], 2).annual, "—");   // grade vi, absent from the budget map
  assert.equal(classCard(SUBJECTS[1], 0).annual, "—");
});

test("a class with no durations falls back to the bare weekly figure", () => {
  const s = { name: "X", grades: [{ grade: "v", periods_per_week: 4, sections: [{ sec: "A" }] }], budget: {} };
  assert.equal(classCard(s, 0).perWeek, "4 a week");
});

test("a class with neither durations nor a weekly figure says nothing rather than zero", () => {
  const s = { name: "X", grades: [{ grade: "v", sections: [{ sec: "A" }] }], budget: {} };
  assert.equal(classCard(s, 0).perWeek, "—");
});

test("classCards walks the whole subject in record order, and a missing index is null", () => {
  assert.deepEqual(classCards(SUBJECTS[0]).map((c) => c.className),
                   ["Class 3", "Class 4", "Class 6"]);
  assert.equal(classCard(SUBJECTS[0], 9), null);
  assert.deepEqual(classCards(null), []);
});
