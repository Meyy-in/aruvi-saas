/* The clustering rule (F8) — which rows a pick wheel shows, and where it rests.
 *
 * The founder's own worked example is the first test, verbatim from the diagram in the source:
 * a teacher picks 50, then 30, and the wheel must read 20 25 [30 50] 55 60 resting on 30. Every
 * other test here guards one way that shape can go wrong — clustering at the head of the list
 * instead of at the lowest pick's own slot, keeping the skipped middle, or losing the options
 * above the cluster, each of which was a thing this rule was written NOT to do.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterOrder } from "../src/pick.js";

const D = [20, 25, 30, 35, 40, 45, 50, 55, 60];

test("★ the founder's worked example: pick 50, then 30", () => {
  const { ordered, start } = clusterOrder(D, [50, 30]);
  assert.deepEqual(ordered, [20, 25, 30, 50, 55, 60]);
  assert.equal(ordered[start], 30, "the wheel rests on the LOWEST pick");
  assert.equal(start, 2, "…at its own natural slot, not at the head of the list");
});

test("the options ABOVE the cluster stay, one wheel-up away", () => {
  const { ordered } = clusterOrder(D, [40]);
  assert.deepEqual(ordered.slice(0, 4), [20, 25, 30, 35]);
});

test("the unchosen middle between lowest and highest pick is DROPPED", () => {
  const { ordered } = clusterOrder(D, [25, 55]);
  assert.deepEqual(ordered, [20, 25, 55, 60]);
  assert.ok(!ordered.includes(40), "she has already scrolled past it; carrying it just pads the window");
});

test("picks are shown in natural order however she tapped them", () => {
  assert.deepEqual(clusterOrder(D, [55, 25, 40]).ordered, clusterOrder(D, [25, 40, 55]).ordered);
  assert.deepEqual(clusterOrder(D, [55, 25, 40]).ordered, [20, 25, 40, 55, 60]);
});

test("nothing chosen — the list is untouched and rests at the top", () => {
  assert.deepEqual(clusterOrder(D, []), { ordered: D, start: 0 });
  assert.deepEqual(clusterOrder(D, null), { ordered: D, start: 0 });
});

test("everything chosen — every row is a pick, resting on the first", () => {
  const { ordered, start } = clusterOrder(D, [...D]);
  assert.deepEqual(ordered, D);
  assert.equal(start, 0);
});

test("the lowest pick being first leaves nothing above it", () => {
  assert.deepEqual(clusterOrder(D, [20, 30]), { ordered: [20, 30, 35, 40, 45, 50, 55, 60], start: 0 });
});

test("the highest pick being last leaves nothing below it", () => {
  const { ordered } = clusterOrder(D, [50, 60]);
  assert.deepEqual(ordered, [20, 25, 30, 35, 40, 45, 50, 60]);
});

/* The trade-off the header names: a hidden middle value is reachable by UNTICKING, because the
   order is recomputed from `selected` every render and nothing is remembered. Asserting it means
   the escape hatch cannot be closed by accident. */
test("★ untick is the escape hatch — dropping the top pick brings the middle back", () => {
  assert.ok(!clusterOrder(D, [50, 30]).ordered.includes(45));
  assert.ok(clusterOrder(D, [30]).ordered.includes(45), "45 is reachable again the moment 50 is let go");
});

test("a selection holding values not in the list is ignored, not crashed on", () => {
  assert.deepEqual(clusterOrder(D, [999]), { ordered: D, start: 0 });
  assert.deepEqual(clusterOrder(D, [30, 999]).ordered, [20, 25, 30, 35, 40, 45, 50, 55, 60]);
});

test("string options cluster the same way — sections, not just durations", () => {
  const S = ["A", "B", "C", "D", "E", "F"];
  const { ordered, start } = clusterOrder(S, ["E", "B"]);
  assert.deepEqual(ordered, ["A", "B", "E", "F"]);
  assert.equal(ordered[start], "B");
});

test("an empty or missing option list never throws", () => {
  assert.deepEqual(clusterOrder([], ["A"]), { ordered: [], start: 0 });
  assert.deepEqual(clusterOrder(null, ["A"]), { ordered: [], start: 0 });
});
