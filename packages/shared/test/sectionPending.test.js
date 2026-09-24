/* WALK-A-080 — a mark-complete made offline must survive the connection coming back.
 *
 * Founder, 2026-09-24: offline, he marked unit 1 of English IV ch 12 complete; the card showed it;
 * back online, it was gone. The push had failed silently, and then the reconcile PULLED THE
 * SERVER'S OLDER STATE OVER HIS DEVICE COPY. These tests pin the four rules that stop that — and
 * the fifth, which stops the cure becoming a cross-account write on a shared browser. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { setStorage, storage } from "../src/storage.js";
import { configure } from "../src/config.js";
import { setUser, clearUser } from "../src/format.js";
import { setUnitPointer, pullSectionState, readLocalSection, bindSectionChapter,
         hasPendingSection } from "../src/sectionState.js";
import { sectionStateMatches } from "../src/verify.js";

configure({ apiBase: "http://api.test" });

const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});

/* A server we can switch on and off. `rows` is its truth; POSTs update it when online. */
let online = true;
let rows = {};
let posts = 0;
globalThis.fetch = async (url, opts = {}) => {
  if (!online) throw new TypeError("Failed to fetch");
  const method = (opts.method || "GET").toUpperCase();
  if (method === "POST" && String(url).endsWith("/section-state")) {
    posts += 1;
    const b = JSON.parse(opts.body);
    rows[b.section_key] = { chapter: b.chapter, unit_index: b.unit_index, done: b.done };
    return { ok: true, status: 200, json: async () => ({}) };
  }
  if (method === "GET" && String(url).endsWith("/section-state")) {
    return { ok: true, status: 200, json: async () => ({ states: rows }) };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};

const SK = "english_iv_A";
const settle = () => new Promise((r) => setTimeout(r, 30));
/* A push that failed offline holds its section's queue while the check's read retries (getJSON
   backs off 0.5s then 1.5s). Real time, not a fixed pause: wait until the thing is true. */
async function until(cond, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (cond()) return true; await new Promise((r) => setTimeout(r, 50)); }
  return cond();
}
function reset() {
  box.clear(); rows = {}; posts = 0; online = true; setUser("9000000003");
}

/* ── the check ── */
test("the save check now compares the POINTER, and spells unit 0 both ways", () => {
  const states = { [SK]: { chapter: "ch_12.json", done: false, unit_index: 3 } };
  assert.equal(sectionStateMatches(states, SK, { chapter: "ch_12.json", done: false, unit: 3 }), true);
  // the defect: before, this read back as a match because the unit was never looked at
  assert.equal(sectionStateMatches(states, SK, { chapter: "ch_12.json", done: false, unit: 4 }), false);
  // unit 0 is NO key on the device and null on the server — the same fact, not a mismatch
  const zero = { [SK]: { chapter: "ch_12.json", done: false, unit_index: null } };
  assert.equal(sectionStateMatches(zero, SK, { chapter: "ch_12.json", done: false, unit: null }), true);
  assert.equal(sectionStateMatches(zero, SK, { chapter: "ch_12.json", done: false, unit: 0 }), true);
  // callers that do not state a unit are untouched
  assert.equal(sectionStateMatches(states, SK, { chapter: "ch_12.json", done: false }), true);
});

/* ── the founder's exact case ── */
test("an OFFLINE mark-complete is NOT overwritten by the server's older pointer on reconnect", async () => {
  reset();
  rows[SK] = { chapter: "ch_12.json", unit_index: null, done: false };   // server: unit 0
  bindSectionChapter(SK, "ch_12.json"); await settle();

  online = false;
  setUnitPointer(SK, 1);                       // she marks unit 1 complete, no signal
  await settle();
  assert.equal(String(readLocalSection(SK).unit), "1", "the device shows her mark");
  assert.equal(hasPendingSection(SK), true, "and remembers it has not been confirmed");

  online = true;
  await pullSectionState([SK]);                 // the reconcile that used to erase it
  await until(() => rows[SK] && rows[SK].unit_index === 1);
  assert.equal(String(readLocalSection(SK).unit), "1",
    "her mark SURVIVES the reconcile — the server's older answer is not adopted");
  assert.equal(rows[SK].unit_index, 1, "and it has now been SENT: the server holds unit 1");
});

test("once the server confirms it, the mark is spent and the reconcile adopts normally again", async () => {
  reset();
  rows[SK] = { chapter: "ch_12.json", unit_index: null, done: false };
  bindSectionChapter(SK, "ch_12.json"); await settle();
  setUnitPointer(SK, 2);                        // online: sent and verified
  await until(() => !hasPendingSection(SK));
  assert.equal(hasPendingSection(SK), false, "a confirmed write leaves no pending mark");

  // another device moves it on; this one must follow
  rows[SK].unit_index = 5;
  await pullSectionState([SK]);
  assert.equal(String(readLocalSection(SK).unit), "5");
});

test("it keeps trying: still offline at the reconcile, the mark and the device copy both stand", async () => {
  reset();
  rows[SK] = { chapter: "ch_12.json", unit_index: null, done: false };
  bindSectionChapter(SK, "ch_12.json"); await settle();
  online = false;
  setUnitPointer(SK, 3); await settle();
  await pullSectionState([SK]); await settle();   // the reconcile runs while STILL offline
  assert.equal(String(readLocalSection(SK).unit), "3");
  assert.equal(hasPendingSection(SK), true, "nothing confirmed, so nothing forgotten");
});

test("the connection returning MID-CHECK does not read as a refusal: the mark stays and is sent", async () => {
  reset();
  rows[SK] = { chapter: "ch_12.json", unit_index: null, done: false };
  bindSectionChapter(SK, "ch_12.json");
  await until(() => !hasPendingSection(SK));
  online = false;
  setUnitPointer(SK, 6);                          // the POST fails: no signal
  await new Promise((r) => setTimeout(r, 200));
  online = true;                                  // back while the check's read is still retrying
  await new Promise((r) => setTimeout(r, 2500));  // that read now succeeds, and disagrees
  assert.equal(String(readLocalSection(SK).unit), "6",
    "an unsent write is not a mismatch — the server's older pointer was NOT adopted");
  assert.equal(hasPendingSection(SK), true, "the mark stands for the reconcile to send");
  await pullSectionState([SK]);
  await until(() => rows[SK].unit_index === 6);
  assert.equal(rows[SK].unit_index, 6, "and the reconcile delivered it");
});

test("a push waiting behind an offline retry does NOT run under the next teacher's sign-in", async () => {
  reset();
  rows[SK] = { chapter: "ch_12.json", unit_index: null, done: false };
  bindSectionChapter(SK, "ch_12.json");
  await until(() => !hasPendingSection(SK));
  online = false;
  setUnitPointer(SK, 7);                          // push 1: fails, its check retries for ~2s
  setUnitPointer(SK, 8);                          // push 2: queued behind it
  setUser("9000000004");                          // she leaves; another teacher signs in
  online = true;
  const before = posts;
  await new Promise((r) => setTimeout(r, 3000));
  assert.equal(posts, before, "nothing was sent in the new teacher's name");
});

/* ── the cure must not become a cross-account write ── */
test("a pending mark left by ANOTHER teacher on this browser is discarded, never sent", async () => {
  reset();
  setUser("9000000004");                          // teacher A, offline, marks unit 4
  rows = {};
  bindSectionChapter(SK, "ch_12.json"); await settle();
  online = false;
  setUnitPointer(SK, 4); await settle();

  setUser("9000000003");                          // teacher B signs in on the same browser
  rows = { [SK]: { chapter: "ch_12.json", unit_index: null, done: false } };
  online = true;
  const before = posts;
  await pullSectionState([SK]); await settle();

  assert.equal(posts, before, "A's unsaved mark was NOT pushed into B's account");
  assert.equal(hasPendingSection(SK), false, "and it is gone");
  assert.notEqual(String(readLocalSection(SK).unit), "4", "B sees her own server state");
});

test("sign-out sweeps pending marks with the rest of her caches", async () => {
  const { TEACHER_CACHE_PREFIXES } = await import("../src/signout.js");
  assert.ok(TEACHER_CACHE_PREFIXES.includes("lu_pending_"));
});
