/* A GET retries itself; a decided answer does not.
 *
 * Founder, 2026-09-17, on the handset: first run's subject step showed "Couldn't load the subject
 * list" on a brand-new account and "seems to be ok after 3 or 4 presses". Three or four presses
 * is the shape of a transient, and the teacher who meets it is on the first screen she has ever
 * seen. These tests fix the two halves of the rule that are easy to get backwards: what comes
 * back for another try, and what must NOT — because `/onboarding/known` answers 404 for a number
 * we do not hold, and retrying that would turn a correct instant answer into a slow one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { configure } from "../src/config.js";
import { getJSON } from "../src/format.js";

configure({ apiBase: "http://api.test" });

/* Replace global fetch with a scripted sequence; returns the call count by reference. */
function scripted(steps) {
  const calls = { n: 0 };
  global.fetch = async () => {
    const step = steps[Math.min(calls.n, steps.length - 1)];
    calls.n += 1;
    if (step instanceof Error) throw step;
    return { ok: step.status >= 200 && step.status < 300, status: step.status,
             json: async () => step.body };
  };
  return calls;
}

test("a transient 503 is retried and the later success is returned", async () => {
  const calls = scripted([{ status: 503 }, { status: 200, body: { subjects: ["science"] } }]);
  const d = await getJSON("/subjects");
  assert.deepEqual(d, { subjects: ["science"] });
  assert.equal(calls.n, 2, "should have taken exactly two attempts");
});

test("a thrown fetch (no response at all) is retried", async () => {
  const calls = scripted([new TypeError("Network request failed"),
                          new TypeError("Network request failed"),
                          { status: 200, body: { ok: true } }]);
  const d = await getJSON("/subjects");
  assert.deepEqual(d, { ok: true });
  assert.equal(calls.n, 3);
});

test("a 404 is an ANSWER and is never retried", async () => {
  const calls = scripted([{ status: 404 }]);
  await assert.rejects(() => getJSON("/onboarding/known?id=1"), /404/);
  assert.equal(calls.n, 1, "a decided 4xx must cost exactly one round trip");
});

test("a 402 paywall is never retried either", async () => {
  const calls = scripted([{ status: 402 }]);
  await assert.rejects(() => getJSON("/plans/x/y/z/view"), /402/);
  assert.equal(calls.n, 1);
});

test("a transient that never clears gives up and reports the status", async () => {
  const calls = scripted([{ status: 503 }]);
  await assert.rejects(() => getJSON("/subjects"), /503/);
  assert.equal(calls.n, 3, "bounded at three attempts, not unbounded");
});

test("a plain 500 is not treated as transient", async () => {
  const calls = scripted([{ status: 500 }]);
  await assert.rejects(() => getJSON("/subjects"), /500/);
  assert.equal(calls.n, 1);
});
