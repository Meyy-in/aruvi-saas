/* The weekly total and how it splits across period lengths (F2).
 *
 * This arithmetic has one governing rule and it is a rule about a TEACHER, not about numbers:
 * naming a second period length tells us how her SAME week is split, not that she gained a
 * class. The founder's own defect of 2026-07-26 is what that rule was written for — adding
 * 45 min to a class already at 8 × 50 seeded the new row at 1, her week silently became 9, and
 * that 9 rode all the way through annualBudgetPeriods as 9 × 30 = 270 periods a year. So the
 * total-preserving property is asserted at every door that could break it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DURATION, DEFAULT_PPW, DURATION_CHOICES, PPW_CHOICES,
  ppwMapSum, lowestDuration, ppwAnchor, normPpw, setPpwSplit, setPpwTotal,
} from "../src/ppw.js";

test("the choice lists are the ones the wheels offer", () => {
  assert.equal(DEFAULT_DURATION, 40);
  assert.equal(DEFAULT_PPW, 6);
  assert.deepEqual([DURATION_CHOICES[0], DURATION_CHOICES.at(-1), DURATION_CHOICES.length], [20, 120, 21]);
  assert.deepEqual([PPW_CHOICES[0], PPW_CHOICES.at(-1), PPW_CHOICES.length], [1, 14, 14]);
});

/* ── the defect this file exists for ──────────────────────────────────────────────── */

test("★ adding a second length SPLITS the week, it does not grow it (2026-07-26)", () => {
  const before = { 50: 8 };
  const after = normPpw([45, 50], before, DEFAULT_PPW, 50);
  assert.equal(ppwMapSum(after), 8, "her week is still 8 periods long");
  assert.equal(after[45], 0, "a newly named length starts at 0, never at 1");
  assert.equal(after[50], 8);
});

test("removing a length gives its periods BACK to the anchor", () => {
  const split = { 50: 5, 45: 3 };
  const after = normPpw([50], split, DEFAULT_PPW, 50);
  assert.equal(ppwMapSum(after), 8);
  assert.equal(after[50], 8);
});

test("the total is invariant under every split move", () => {
  let m = normPpw([40, 60], { 40: 8 }, DEFAULT_PPW, 40);
  for (const v of [0, 1, 3, 8, 99, -4]) {
    m = setPpwSplit([40, 60], m, 40, 60, v);
    assert.equal(ppwMapSum(m), 8, `total moved when 60 was set to ${v}`);
    assert.ok(m[40] >= 0 && m[60] >= 0, "no negative week");
  }
});

/* ── the anchor ───────────────────────────────────────────────────────────────────── */

test("the anchor is the shortest length she ticked", () => {
  assert.equal(lowestDuration([60, 40, 50]), 40);
  assert.equal(lowestDuration([]), DEFAULT_DURATION);
});

test("a STORED anchor survives the ascending sort — an 8 × 50 class stays 8 × 50", () => {
  // She adds 45 to a class set at 8 × 50. `durations` sorts to [45, 50]; without the stored
  // anchor the remainder would move to 45 and her week would quietly become 8 × 45.
  const after = normPpw([45, 50], { 50: 8 }, DEFAULT_PPW, 50);
  assert.equal(after[50], 8);
  assert.equal(after[45], 0);
  assert.equal(ppwAnchor([45, 50], after, 50), 50);
});

test("a stored anchor that is no longer ticked falls back to the biggest holder", () => {
  assert.equal(ppwAnchor([40, 60], { 40: 2, 60: 7 }, 50), 60);
});

test("setting the anchor itself is a no-op — it is derived, not set", () => {
  const base = normPpw([40, 60], { 40: 5, 60: 3 }, DEFAULT_PPW, 40);
  assert.deepEqual(setPpwSplit([40, 60], base, 40, 40, 99), base);
});

/* ── changing the size of the week ────────────────────────────────────────────────── */

test("setPpwTotal keeps the split where it fits, and SHRINKS it where it cannot", () => {
  const base = { 40: 5, 60: 3 };                       // a week of 8, anchored at 40
  const grown = setPpwTotal([40, 60], base, 40, 12);
  assert.equal(ppwMapSum(grown), 12);
  assert.equal(grown[60], 3, "the named split is preserved; the anchor takes the growth");
  assert.equal(grown[40], 9);
  const shrunk = setPpwTotal([40, 60], base, 40, 2);
  assert.equal(ppwMapSum(shrunk), 2);
  assert.ok(shrunk[60] <= 2 && shrunk[40] >= 0, "the split shrinks to fit rather than going negative");
});

test("a week of zero periods is never an answer", () => {
  assert.equal(ppwMapSum(setPpwTotal([40], {}, 40, 0)), 1);
  assert.equal(ppwMapSum(setPpwTotal([40], {}, 40, -9)), 1);
});

/* A map that sums to zero is not a zero WEEK — it is a cold start, and `normPpw` reads it as
   one: the total comes from `fallbackPpw`, then DEFAULT_PPW. Worth pinning because the obvious
   reading (that the `<= 0` guard catches it and yields 1) is wrong, and the two are only one
   character apart in a diff. Inside `normPpw` that guard is in fact unreachable — `total` is
   floored at 1 before the split — so it is defence, not behaviour, and should not be tested as
   behaviour. */
test("a duration map summing to zero is a COLD START, not a zero week", () => {
  assert.equal(ppwMapSum(normPpw([40], { 40: 0 }, 0, 40)), DEFAULT_PPW);
  assert.equal(ppwMapSum(normPpw([40], { 40: 0 }, 9, 40)), 9);
});

test("a cold start falls back to the given ppw, then to DEFAULT_PPW", () => {
  assert.equal(ppwMapSum(normPpw([40], {}, 9, 40)), 9);
  assert.equal(ppwMapSum(normPpw([40], {}, null, 40)), DEFAULT_PPW);
  assert.equal(ppwMapSum(normPpw([], null, null, null)), DEFAULT_PPW);
});

test("both key spellings of a duration map read the same", () => {
  assert.equal(ppwMapSum({ 40: 5, 60: 3 }), 8);
  assert.equal(normPpw([40, 60], { "40": 5, "60": 3 }, DEFAULT_PPW, 40)[60], 3);
});
