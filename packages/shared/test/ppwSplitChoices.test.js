import test from "node:test";
import assert from "node:assert/strict";
import { splitChoices, setPpwSplit } from "../src/ppw.js";

/* WALK-A-111 — the split drop-down offers 1 … X−1, and the shortest length keeps ≥ 1. */
test("two lengths: 1 … X−1", () => {
  assert.deepEqual(splitChoices({ 40: 6, 80: 2 }, 80), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(splitChoices({ 40: 6, 80: 2 }, 40), [], "the anchor has no drop-down");
});
test("three lengths: ceiling leaves the others and one for the anchor", () => {
  // total 8; 60 holds 2, so 80 may take 1 … 8−2−1 = 5
  assert.deepEqual(splitChoices({ 40: 4, 60: 2, 80: 2 }, 80), [1, 2, 3, 4, 5]);
});
test("setPpwSplit never drains the anchor to zero", () => {
  const m = setPpwSplit([40, 80], { 40: 6, 80: 2 }, 40, 80, 99);
  assert.equal(m[80], 7); assert.equal(m[40], 1);
});
