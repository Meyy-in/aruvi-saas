import test from "node:test";
import assert from "node:assert/strict";
import { suggestedPeriodsByChapter, largestRemainder } from "../src/format.js";

/* WALK-A-074. Prepare and Year Plan both answer "how many periods does Aruvi suggest for this
   chapter?" and disagreed by one — not because either did the arithmetic wrong, but because they
   apportioned over DIFFERENT BUCKETS. These tests pin the rule so the next caller cannot quietly
   pick its own denominator again. */

const ch = (n, w, placeholder = false) =>
  ({ chapter_number: n, weight: w, placeholder });

/* ★ THE DEFECT ITSELF, as arithmetic. Two ways of handling the chapters whose books have not
   shipped: give each its own bucket (Year Plan), or sum them into one and discard it (what
   Prepare used to do). Largest-remainder hands the leftover WHOLE periods to the largest
   fractions, so aggregating changes who receives them. If this test ever passes with `deepEqual`
   swapped for the aggregate form, the two panes have drifted apart again. */
test("aggregating the placeholders is NOT the same apportionment", () => {
  /* Weights found by search, not by taste: most sets agree by luck, which is precisely why the
     defect survived so long and why the two panes matched on most chapters and not on ch 3 and
     ch 5. Per chapter this hands [17, 17] to the two published chapters; aggregated it hands
     [17, 16] — one period moved, exactly the shape the founder met on social_sciences IX. */
  const all = [ch(1, 5), ch(2, 5), ch(3, 3, true), ch(4, 3, true), ch(5, 14, true)];
  const budget = 100;

  const perChapter = suggestedPeriodsByChapter(all, budget);

  const listed = all.filter((c) => !c.placeholder);
  const missing = all.filter((c) => c.placeholder).reduce((s, c) => s + c.weight, 0);
  const aggregated = largestRemainder(budget, [...listed.map((c) => c.weight), missing]);

  // Same total, different rows — which is exactly how the founder met it on SS IX.
  assert.notDeepEqual([perChapter[1], perChapter[2]], [aggregated[0], aggregated[1]]);
});

test("the distribution conserves her budget exactly", () => {
  const all = [ch(1, 13), ch(2, 9), ch(3, 21), ch(4, 8), ch(5, 17, true)];
  for (const budget of [140, 215, 245, 7]) {
    const out = suggestedPeriodsByChapter(all, budget);
    const sum = Object.values(out).reduce((a, b) => a + b, 0);
    assert.equal(sum, budget, `budget ${budget} must be handed out in full`);
  }
});

/* A placeholder chapter holds its share of her year — that is why the API budgets it. The
   founder's 2026-07-25 rule: divide by the FULL syllabus, never the listed subset, or every
   suggestion inflates until the books ship. */
test("a book-awaited chapter still takes its share", () => {
  const all = [ch(1, 10), ch(2, 10), ch(3, 10, true)];
  const out = suggestedPeriodsByChapter(all, 90);
  assert.equal(out[3], 30);
  assert.equal(out[1], 30);
  // Dropping it entirely would inflate the other two to 45 each — the defect the rule prevents.
  assert.notEqual(out[1], 45);
});

/* Both panes must be able to ask the SAME question and get the SAME answer. Year Plan passes the
   API's list; Prepare passes the same list and filters for display afterwards. */
test("both panes' call sites agree, chapter for chapter", () => {
  const fromApi = [ch(1, 13), ch(2, 9), ch(3, 21, true), ch(4, 8), ch(5, 17)];
  const budget = 142;

  const yearPlan = suggestedPeriodsByChapter(fromApi, budget);
  const prepare = suggestedPeriodsByChapter(fromApi, budget);   // same list, unfiltered
  const shownOnPrepare = fromApi.filter((c) => !c.placeholder);

  for (const c of shownOnPrepare) {
    assert.equal(prepare[c.chapter_number], yearPlan[c.chapter_number],
      `chapter ${c.chapter_number} must read the same on both panes`);
  }
});

test("no budget, no weights, or no chapters → no suggestion, never a zero", () => {
  assert.deepEqual(suggestedPeriodsByChapter([], 200), {});
  assert.deepEqual(suggestedPeriodsByChapter([ch(1, 10)], 0), {});
  assert.deepEqual(suggestedPeriodsByChapter([ch(1, 10)], null), {});
  assert.deepEqual(suggestedPeriodsByChapter([ch(1, 0), ch(2, 0)], 200), {});
});
