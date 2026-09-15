import test from "node:test";
import assert from "node:assert/strict";
import { budgetPeriods, normalizeBudget, setGradeBudget, gradeBudgetRecord, findScope,
         clampPeriods } from "../src/budget.js";

/* The reader must keep understanding all four shapes — teachers have saved records in every
   one of them, and retiring the reader would silently move their years. */
test("budgetPeriods reads all four stored shapes", () => {
  assert.equal(budgetPeriods(8, { method: "periods", value: 215 }), 215);
  assert.equal(budgetPeriods(8, { method: "weeks", value: 30 }), 240);
  assert.equal(budgetPeriods(8, { method: "days", value: 170 }), 227);  // round(8*170/6)
  assert.equal(budgetPeriods(8, { method: "auto", value: 0 }), 240);    // ppw * 30
  assert.equal(budgetPeriods(8, { method: "auto", value: 199 }), 199);
  assert.equal(budgetPeriods(8, null), null);
});

/* The conversion the old setMethod never did: a weeks record opens on the year it evaluates to,
   not on a fresh default. This is the 245 → 180 defect, asserted. */
test("normalizeBudget converts a legacy record to its own annual total", () => {
  assert.deepEqual(normalizeBudget({ method: "weeks", value: 30 }, 8, 245),
    { method: "periods", value: 240 });
  assert.deepEqual(normalizeBudget({ method: "days", value: 170 }, 8, 245),
    { method: "periods", value: 227 });
});

test("normalizeBudget: {auto,0} is 'not set' and yields to the calibrated figure", () => {
  assert.deepEqual(normalizeBudget({ method: "auto", value: 0 }, 8, 245),
    { method: "periods", value: 245 });
  assert.deepEqual(normalizeBudget(null, 8, 245), { method: "periods", value: 245 });
  // no master-plan row for this subject·class → the ppw estimate is the last resort
  assert.deepEqual(normalizeBudget(null, 8, null), { method: "periods", value: 240 });
  assert.deepEqual(normalizeBudget(null, 0, null), { method: "periods", value: 1 });
});

const profile = () => ([
  { name: "Science", grades: [{ grade: "VIII" }, { grade: "IX" }], budget: { 0: { method: "weeks", value: 30 } } },
  { name: "Mathematics", grades: [{ grade: "VII" }] },
]);

test("findScope matches on display name and Roman class, case-insensitively", () => {
  assert.deepEqual(findScope(profile(), "Science", "ix"), { si: 0, gi: 1 });
  assert.deepEqual(findScope(profile(), "Science", "IX"), { si: 0, gi: 1 });
  assert.equal(findScope(profile(), "Science", "X"), null);
  assert.equal(findScope(profile(), "Physics", "IX"), null);
});

test("setGradeBudget writes the periods shape and touches nothing else", () => {
  const before = profile();
  const after = setGradeBudget(before, "Science", "IX", 215);
  assert.deepEqual(after[0].budget, { 0: { method: "weeks", value: 30 }, 1: { method: "periods", value: 215 } });
  assert.deepEqual(after[0].grades, before[0].grades);
  assert.deepEqual(after[1], before[1]);
  assert.notEqual(after, before);                 // a NEW array, never mutated in place
  assert.deepEqual(before, profile());            // the original is untouched
});

test("setGradeBudget floors at 1 and is a no-op off-scope", () => {
  assert.deepEqual(setGradeBudget(profile(), "Science", "IX", 0)[0].budget[1], { method: "periods", value: 1 });
  assert.deepEqual(setGradeBudget(profile(), "Science", "IX", -5)[0].budget[1], { method: "periods", value: 1 });
  const p = profile();
  assert.equal(setGradeBudget(p, "Physics", "IX", 100), p);
});

test("gradeBudgetRecord reads both key spellings", () => {
  assert.deepEqual(gradeBudgetRecord(profile(), "Science", "VIII"), { method: "weeks", value: 30 });
  const strKeyed = [{ name: "Science", grades: [{ grade: "IX" }], budget: { "0": { method: "periods", value: 199 } } }];
  assert.deepEqual(gradeBudgetRecord(strKeyed, "Science", "IX"), { method: "periods", value: 199 });
  assert.equal(gradeBudgetRecord(profile(), "Science", "IX"), null);
});

test("clampPeriods floors at 1 for every non-number", () => {
  for (const v of [0, -3, NaN, null, undefined, ""]) assert.equal(clampPeriods(v), 1);
  assert.equal(clampPeriods("215"), 215);
});
