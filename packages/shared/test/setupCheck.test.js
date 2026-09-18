/* The check-window queue (F3) — "are these your sections?", asked once.
 *
 * Small, but every rule in it is a rule about not pestering a teacher, so each gets a test: the
 * question is spent when asked, a key is never queued twice, and the queue self-heals against her
 * profile so it cannot silently accumulate keys nothing can ever spend.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setStorage } from "../src/storage.js";
import { setUser, clearUser } from "../src/format.js";
import {
  setupKey, queueSetupCheck, takeSetupCheck, pruneSetupCheck, SETUP_CHECK_CAP,
} from "../src/setupCheck.js";

const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});
const reset = () => { box.clear(); setUser("t1"); };

test("setupKey uppercases the class, so VII and vii are one key", () => {
  assert.equal(setupKey("Science", "vii"), "Science|VII");
  assert.equal(setupKey("Science", "VII"), "Science|VII");
  assert.equal(setupKey("Science", ""), "Science|");
});

test("★ asked ONCE, ever — take spends the key", () => {
  reset();
  const k = setupKey("Science", "IX");
  queueSetupCheck([k]);
  assert.equal(takeSetupCheck(k), true, "the first use raises the window");
  assert.equal(takeSetupCheck(k), false, "and it never comes back — a repeat reads as not listening");
});

test("a key not queued is never asked about", () => {
  reset();
  assert.equal(takeSetupCheck(setupKey("Science", "IX")), false);
});

test("queueing is idempotent — the same class twice is one question", () => {
  reset();
  const k = setupKey("Science", "IX");
  queueSetupCheck([k]); queueSetupCheck([k]); queueSetupCheck([k, k]);
  assert.equal(takeSetupCheck(k), true);
  assert.equal(takeSetupCheck(k), false);
});

test("several classes queue independently", () => {
  reset();
  const a = setupKey("Science", "IX"), b = setupKey("Science", "X");
  queueSetupCheck([a, b]);
  assert.equal(takeSetupCheck(b), true);
  assert.equal(takeSetupCheck(a), true, "spending one must not spend the other");
});

test("★ the queue self-heals: prune drops keys nothing could ever spend", () => {
  reset();
  const mine = setupKey("Science", "IX"), notMine = setupKey("Physics", "XI");
  queueSetupCheck([mine, notMine]);
  pruneSetupCheck([mine]);
  assert.equal(takeSetupCheck(notMine), false, "a class she does not teach can never be scoped to");
  assert.equal(takeSetupCheck(mine), true, "…and hers survives");
});

test("prune with nothing queued does nothing and does not throw", () => {
  reset();
  pruneSetupCheck(["anything"]);
  // `setUser` itself writes an `aruvi_user` key, so the assertion is about the QUEUE key only.
  assert.equal([...box.keys()].filter((k) => k.startsWith("setup_check_pending")).length, 0,
    "an empty queue is not written back");
});

test("the cap keeps the NEWEST keys — the newest addition is the one she is about to use", () => {
  reset();
  const keys = Array.from({ length: SETUP_CHECK_CAP + 5 }, (_, i) => setupKey("S" + i, "IX"));
  queueSetupCheck(keys);
  assert.equal(takeSetupCheck(keys[0]), false, "the oldest fell off");
  assert.equal(takeSetupCheck(keys.at(-1)), true);
});

test("a mangled entry is read as an empty queue, never thrown on", () => {
  reset();
  box.set([...box.keys()][0] || "setup_check_pending_t1", "{not json");
  for (const k of [...box.keys()]) box.set(k, "{not json");
  assert.equal(takeSetupCheck(setupKey("Science", "IX")), false);
});

test("nothing is queued or read without a signed-in teacher", () => {
  reset();
  const k = setupKey("Science", "IX");
  queueSetupCheck([k]);
  clearUser();
  assert.equal(takeSetupCheck(k), false, "a prompt belongs to a session, not to a device");
  setUser("t1");
  assert.equal(takeSetupCheck(k), true);
  clearUser();
});

/* ───────── the window's WORDS and its VALUES (app. 01 rows 75-76, lifted 2026-09-16) ─────────
 *
 * These were computed inline in the web's page.jsx until the phone needed them. They decide what a
 * window whose whole question is "did Meyy get your set-up right?" says about her record — so the
 * rules that matter most here are the ones about staying QUIET: a value nothing can vouch for
 * renders nothing at all, never a dash, a zero or a guess.
 */
import { setupCheckSub, setupCheckValues } from "../src/setupCheck.js";

const profile = {
  subjects: [
    { name: "English",
      grades: [{ grade: "III", periods_per_week: 6,
                 sections: [{ tag: "3A", sec: "A" }, { tag: "3B", sec: "B" }] }],
      budget: { 0: { method: "periods", value: 210 } },
      grids: [[[], []]] },
    { name: "Mathematics",
      grades: [
        { grade: "V", periods_per_week: 8, sections: [{ tag: "5A", sec: "A" }] },
        { grade: "IV", periods_per_week: 5, sections: [{ tag: "4A", sec: "A" }] },
      ],
      budget: { 0: { method: "periods", value: 245 }, 1: { method: "periods", value: 200 } },
      grids: [[[]], [[]]] },
  ],
};

test("no sub-line and no values outside check mood — the '+' window is unscoped by nature", () => {
  const win = { mode: "change" };
  assert.equal(setupCheckSub(profile, win), null);
  assert.equal(setupCheckValues(profile, win), null);
});

test("★ the added line names the SUBJECT and the STAGE, not the class", () => {
  const parts = setupCheckSub(profile, { mode: "check", reason: "added", subject: "Mathematics", grade: "V" });
  assert.deepEqual(parts, { reason: "added", subject: "Mathematics", stage: "Preparatory" });
});

test("the tour line counts sections, and never says 'with 0 sections'", () => {
  assert.deepEqual(setupCheckSub(profile, { mode: "check", reason: "tour" }),
    { reason: "tour", count: 4, tag: null });
  const one = { subjects: [{ name: "English", grades: [{ grade: "III", sections: [{ tag: "3A" }] }] }] };
  assert.deepEqual(setupCheckSub(one, { mode: "check", reason: "tour" }),
    { reason: "tour", count: 1, tag: "3A" }, "one section is named, not counted");
  assert.deepEqual(setupCheckSub({ subjects: [] }, { mode: "check", reason: "tour" }),
    { reason: "tour", count: 0, tag: null }, "a profile that moved under us names no count");
});

test("★ the added window is scoped to ONE subject·stage — the classes she settled months ago stay out", () => {
  const v = setupCheckValues(profile, { mode: "check", reason: "added", subject: "Mathematics", grade: "V" });
  assert.equal(v.class, "5, 4", "V and IV are both preparatory, so both are in scope");
  assert.equal(v.section, "5A, 4A");
  assert.equal(v.ppw, null, "8 and 5 disagree — several classes disagreeing is not a value to show");
  assert.equal(v.budget, null);
  const eng = setupCheckValues(profile, { mode: "check", reason: "added", subject: "English", grade: "III" });
  assert.equal(eng.class, "3");
  assert.equal(eng.section, "3A, 3B");
  assert.equal(eng.ppw, "6 a week", "one shared figure reads as fact");
  assert.equal(eng.budget, "210 periods");
});

test("a list of more than three is elided, never wrapped onto a second line", () => {
  const many = { subjects: [{ name: "Science",
    grades: ["VI", "VII", "VIII", "IX"].map((g) => ({ grade: g, periods_per_week: 6, sections: [] })) }] };
  const v = setupCheckValues(many, { mode: "check", reason: "tour" });
  assert.equal(v.class, "6, 7, 8…");
  assert.equal(v.section, null, "no sections yet → the row says nothing at all");
});

test("a scope naming a subject she no longer teaches shows nothing rather than guessing", () => {
  assert.equal(
    setupCheckValues(profile, { mode: "check", reason: "added", subject: "Science", grade: "IX" }), null);
});

test("★ first run's check is owed ONCE and spent on the first ask (2026-09-18)", async () => {
  const { queueFirstRunCheck, takeFirstRunCheck } = await import("../src/setupCheck.js");
  reset();
  assert.equal(takeFirstRunCheck(), false, "nothing queued, nothing asked");
  queueFirstRunCheck();
  assert.equal(takeFirstRunCheck(), true);
  assert.equal(takeFirstRunCheck(), false, "spent");
  queueFirstRunCheck(); clearUser();
  assert.equal(takeFirstRunCheck(), false, "no teacher, no question");
  setUser("t2");
  assert.equal(takeFirstRunCheck(), false, "another teacher never spends hers");
  setUser("t1");
  assert.equal(takeFirstRunCheck(), true, "still hers after the other teacher");
});

test("★ the question is for a SUBSCRIPTION, not for a class she added herself (2026-09-18)", async () => {
  const { setupCheckAdds } = await import("../src/setupCheck.js");
  const g = (grade) => ({ grade, sections: [{ tag: "x", sec: "A" }] });
  const base = [{ name: "Science", grades: [g("VI")] }];
  assert.deepEqual(setupCheckAdds(null, base), [], "no baseline, nothing asked");
  assert.deepEqual(setupCheckAdds(base, [...base, { name: "English", grades: [g("IX")] }]),
    ["English|IX"], "a new subject is asked about");
  assert.deepEqual(setupCheckAdds(base, [{ name: "Science", grades: [g("VI"), g("VII")] }]),
    [], "Add › Class in a stage she has asks nothing");
  assert.deepEqual(setupCheckAdds(base, [{ name: "Science", grades: [g("VI"), g("IX")] }]),
    ["Science|IX"], "a newly bought stage of a subject she teaches is asked about");
  assert.deepEqual(setupCheckAdds([{ name: "Science", grades: [] }], [{ name: "Science", grades: [g("VII")] }]),
    [], "refilling a subject she emptied asks nothing");
});
