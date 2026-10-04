/* "Show me" — the tour taken again from Ask Meyy must leave her classes EXACTLY as it found them
 * (founder, 2026-10-04). The tour really unbinds and rebinds a section to demonstrate attaching;
 * these tests pin that a replay puts back chapter, pointer, done AND bookmark, on every section it
 * borrowed, and never restores one teacher's snapshot into another's account. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { setStorage } from "../src/storage.js";
import { configure } from "../src/config.js";
import { setUser } from "../src/format.js";
import { readLocalSection, readLocalBookmark, bindSectionChapter, unbindSection,
         setUnitPointer, writeLocalBookmark } from "../src/sectionState.js";
import { beginTourReplay, snapshotForReplay, restoreAfterReplay, isTourReplay } from "../src/tourReplay.js";

configure({ apiBase: "http://api.test" });
const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});
let rows = {};
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || "GET").toUpperCase();
  if (method === "POST" && String(url).endsWith("/section-state")) {
    const b = JSON.parse(opts.body);
    rows[b.section_key] = { chapter: b.chapter, unit_index: b.unit_index, done: b.done };
  }
  if (method === "DELETE") { const k = String(url).split("/").pop(); delete rows[k]; }
  return { ok: true, status: 200, json: async () => ({ states: rows }) };
};
const settle = () => new Promise((r) => setTimeout(r, 30));
const A = "science_ix_9A", B = "science_ix_9B";
function reset() { box.clear(); rows = {}; setUser("9000000003"); }

test("a replay puts back chapter, pointer and bookmark after the demo unbinds and rebinds", async () => {
  reset();
  bindSectionChapter(A, "ch_04.json"); setUnitPointer(A, 5); writeLocalBookmark(A, 5, 2);
  await settle();
  beginTourReplay(A);
  assert.equal(isTourReplay(), true);
  unbindSection(A);                       // steps 1-9
  bindSectionChapter(A, "ch_09.json");    // step 10: the demo plan
  snapshotForReplay(A);                   // a later capture must NOT overwrite the first
  await settle();
  assert.equal(restoreAfterReplay(), true);
  await settle();
  const s = readLocalSection(A);
  assert.equal(s.chapter, "ch_04.json");
  assert.equal(Number(s.unit), 5);
  assert.deepEqual(readLocalBookmark(A), { unit: 5, phase: 2 });
  assert.equal(rows[A].chapter, "ch_04.json");
  assert.equal(isTourReplay(), false);
});

test("a section that was EMPTY goes back to empty, and every borrowed section is restored", async () => {
  reset();
  bindSectionChapter(B, "ch_01.json");
  beginTourReplay(A);                     // A unbound before the replay
  snapshotForReplay(B);                   // the target moved mid-tour
  bindSectionChapter(A, "ch_09.json");
  unbindSection(B);
  restoreAfterReplay();
  await settle();
  assert.equal(readLocalSection(A).chapter, null);
  assert.equal(readLocalSection(B).chapter, "ch_01.json");
});

test("another teacher's leftover snapshot is discarded, never restored", async () => {
  reset();
  bindSectionChapter(A, "ch_04.json");
  beginTourReplay(A);
  setUser("9000000099");                  // shared browser: someone else signs in
  bindSectionChapter(A, "ch_07.json");
  assert.equal(restoreAfterReplay(), false);
  assert.equal(readLocalSection(A).chapter, "ch_07.json");
  assert.equal(isTourReplay(), false);
});

test("outside a replay nothing is captured and restore is a no-op", () => {
  reset();
  snapshotForReplay(A);
  assert.equal(isTourReplay(), false);
  assert.equal(restoreAfterReplay(), false);
});
