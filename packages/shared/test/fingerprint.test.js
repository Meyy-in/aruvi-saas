/* `readinessFingerprint` — what the read-after-write check is entitled to notice.
 *
 * The budget joined the fingerprint on 2026-09-15 because the budget editor changes it and
 * nothing else. Adding a field to a comparator makes every save on BOTH surfaces stricter, so
 * the risk it carries is the false alarm: a difference that is a spelling, not lost work. These
 * tests hold both halves at once — every artefact collapses, and a real change in her year does
 * not.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readinessFingerprint as fp } from "../src/verify.js";

const sub = (budget, grades) => ([{
  name: "Science",
  grades: grades || [{ grade: "IX", sections: [{ tag: "9A" }], durations: [40], periods_per_week: 8 }],
  budget,
}]);

test("a different YEAR is a different fingerprint — the point of the change", () => {
  assert.notEqual(fp(sub({ 0: { method: "periods", value: 215 } })),
                  fp(sub({ 0: { method: "periods", value: 180 } })));
});

test("dropping her budget entirely is caught", () => {
  assert.notEqual(fp(sub({ 0: { method: "periods", value: 215 } })), fp(sub({})));
  assert.notEqual(fp(sub({ 0: { method: "periods", value: 215 } })), fp(sub(undefined)));
});

/* ── the three artefacts, which must NOT alarm ─────────────────────────────────────── */

test("the index key in either spelling is the same fact", () => {
  assert.equal(fp(sub({ 0: { method: "periods", value: 215 } })),
               fp(sub({ "0": { method: "periods", value: 215 } })));
});

test("a numeric string value is the same fact", () => {
  assert.equal(fp(sub({ 0: { method: "periods", value: 215 } })),
               fp(sub({ 0: { method: "periods", value: "215" } })));
});

test("every spelling of 'not set' is one fact", () => {
  const a = fp(sub({}));
  assert.equal(fp(sub({ 0: { method: "auto", value: 0 } })), a);   // finalizeSubject's record
  assert.equal(fp(sub({ 0: null })), a);
  assert.equal(fp(sub(undefined)), a);
  // …but an auto record carrying a real figure is an ANSWER, not an absence
  assert.notEqual(fp(sub({ 0: { method: "auto", value: 199 } })), a);
});

/* ── the ordering trap the header warns about ──────────────────────────────────────── */

test("the budget is read against the record's OWN grade order, not the sorted one", () => {
  // Same teacher, same two classes, same two budgets — written in opposite orders.
  const ix = { grade: "IX", sections: [{ tag: "9A" }], durations: [40], periods_per_week: 8 };
  const x  = { grade: "X",  sections: [{ tag: "10A" }], durations: [40], periods_per_week: 6 };
  const forward  = sub({ 0: { method: "periods", value: 215 }, 1: { method: "periods", value: 150 } }, [ix, x]);
  const reversed = sub({ 0: { method: "periods", value: 150 }, 1: { method: "periods", value: 215 } }, [x, ix]);
  assert.equal(fp(forward), fp(reversed),
    "IX keeps its 215 and X its 150 whichever order the record lists them in");
  // And swapping only the FIGURES really is a different profile.
  const swapped = sub({ 0: { method: "periods", value: 150 }, 1: { method: "periods", value: 215 } }, [ix, x]);
  assert.notEqual(fp(forward), fp(swapped));
});

/* ── what was already guarded stays guarded ────────────────────────────────────────── */

test("order she cannot control is still normalised away", () => {
  const a = [{ name: "Science", grades: [
    { grade: "IX", sections: [{ tag: "9B" }, { tag: "9A" }], durations: [60, 40], periods_per_week: 8 }] }];
  const b = [{ name: "Science", grades: [
    { grade: "IX", sections: [{ tag: "9A" }, { tag: "9B" }], durations: [40, 60], periods_per_week: 8 }] }];
  assert.equal(fp(a), fp(b));
});

test("a section's own name is still part of it (2026-08-30)", () => {
  const plain  = [{ name: "Science", grades: [{ grade: "IX", sections: [{ tag: "9A" }], durations: [40], periods_per_week: 8 }] }];
  const named  = [{ name: "Science", grades: [{ grade: "IX", sections: [{ tag: "9A", name: "Rose" }], durations: [40], periods_per_week: 8 }] }];
  assert.notEqual(fp(plain), fp(named));
});

test("the ppw SPLIT stays out — it is derived from the total, which is in", () => {
  const one = [{ name: "Science", grades: [{ grade: "IX", sections: [{ tag: "9A" }], durations: [40, 60],
    periods_per_week: 8, ppw_by_duration: { 40: 5, 60: 3 } }] }];
  const two = [{ name: "Science", grades: [{ grade: "IX", sections: [{ tag: "9A" }], durations: [40, 60],
    periods_per_week: 8, ppw_by_duration: { 40: 6, 60: 2 } }] }];
  assert.equal(fp(one), fp(two));
});
