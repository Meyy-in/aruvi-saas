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
