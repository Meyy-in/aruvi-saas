/* The academic-year store — the cutover she is OFFERED.
 *
 * Every test here is a way a teacher loses a year of work, or is asked about it wrongly:
 *   · the offer is an offer — nothing moves until she taps, and an unreachable server offers
 *     NOTHING rather than guessing (no offer is always safe; a wrong offer is not);
 *   · a dismissal lasts this launch and no longer (Q17, 2026-09-16) — a stored "don't ask again"
 *     would quietly strand her in last year, with no other door to the cutover;
 *   · …and it belongs to HER: sign-out is not a remount, and the web handed one teacher's
 *     dismissal to the next on exactly this defect (founder, live, 2026-08-26);
 *   · a FAILED cutover shows no result card — the card states what happened as fact;
 *   · and the two caches that cannot self-heal are cleared, because after a cutover the new year
 *     is legitimately empty and both the section pull and the history pull refuse to delete.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { setStorage } from "../src/storage.js";
import { setUser, clearUser } from "../src/format.js";
import { readLocalSection, bindSectionChapter } from "../src/sectionState.js";
import {
  yearState, fetchYear, cutoverOffered, dismissCutover, dismissCutoverResult,
  runCutover, clearYear, subscribeYear,
} from "../src/year.js";

const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});

let info = { current_year: "2026-27", cutover_due: true, prior_years: ["2025-26"] };
let cutoverRes = { opened_year: "2026-27", closed_year: "2025-26", sections_cleared: 3, plans_archived: 7 };
let mode = "ok";                       // "ok" | "down" | "cutover-fails"
globalThis.fetch = async (url, opts) => {
  const path = String(url);
  const method = (opts && opts.method) || "GET";
  if (mode === "down") throw new TypeError("Failed to fetch");
  if (path.includes("/academic-year/cutover")) {
    if (mode === "cutover-fails") return { status: 500, ok: false, text: async () => "" };
    return { status: 200, ok: true, headers: { get: () => null }, json: async () => cutoverRes };
  }
  if (path.includes("/academic-year")) {
    return { status: 200, ok: true, headers: { get: () => null }, json: async () => info };
  }
  if (path.includes("/readiness")) {
    return { status: 200, ok: true, headers: { get: () => null },
             json: async () => ({ ready: true, readiness: { subjects: [] } }) };
  }
  // section-state pull / push
  return { status: 200, ok: true, headers: { get: () => null },
           json: async () => ({ sections: [] }), text: async () => "{}" };
};

function reset() {
  box.clear();
  clearYear();
  mode = "ok";
  info = { current_year: "2026-27", cutover_due: true, prior_years: ["2025-26"] };
  setUser("t1");
}

test("the offer shows only when the SERVER says it is due", async () => {
  reset();
  await fetchYear();
  assert.equal(cutoverOffered(), true);

  reset();
  info = { current_year: "2026-27", cutover_due: false };
  await fetchYear();
  assert.equal(cutoverOffered(), false, "the client compares no dates of its own");
});

test("`cleanup_due` wins over the older `cutover_due`", async () => {
  reset();
  info = { current_year: "2026-27", cleanup_due: false, cutover_due: true };
  await fetchYear();
  assert.equal(cutoverOffered(), false, "the newer field is the answer; the older is a fallback");
});

test("★ an unreachable server offers NOTHING — no offer is safe, a wrong one is not", async () => {
  reset();
  mode = "down";
  await fetchYear();
  assert.equal(yearState().info, null);
  assert.equal(cutoverOffered(), false);
});

test("★ a dismissal lasts this launch — and is NOT persisted anywhere", async () => {
  reset();
  await fetchYear();
  assert.equal(cutoverOffered(), true);
  dismissCutover();
  assert.equal(cutoverOffered(), false, "gone for this visit");
  /* `setUser` writes `aruvi_user`, so the box is not empty — what must not be there is any
     record of the DISMISSAL. */
  assert.equal(Array.from(box.keys()).some((k) => /year|cutover|dismiss/i.test(k)), false,
    "nothing stored: a remembered 'don't ask again' would strand her in last year");
  clearYear();                          // a relaunch
  await fetchYear();
  assert.equal(cutoverOffered(), true, "…and it comes back, every launch, until she acts");
});

test("★ the dismissal belongs to HER — the next teacher on this phone is asked", async () => {
  reset();
  await fetchYear();
  dismissCutover();
  assert.equal(cutoverOffered(), false);
  setUser("t2");                        // sign-out is not a remount; the module keeps running
  await fetchYear();
  assert.equal(cutoverOffered(), true,
    "the web handed one teacher's dismissal to the next on exactly this");
});

test("a completed cutover replaces the offer with the result card", async () => {
  reset();
  await fetchYear();
  const st = await runCutover();
  assert.equal(st.result.opened_year, "2026-27");
  assert.equal(cutoverOffered(), false, "the offer yields to the result");
  dismissCutoverResult();
  assert.equal(yearState().result, null);
});

test("★ a FAILED cutover shows no result card — the card states fact, and nothing happened", async () => {
  reset();
  await fetchYear();
  mode = "cutover-fails";
  const st = await runCutover();
  assert.equal(st.result, null);
  assert.equal(st.busy, false, "and it stops being busy either way");
});

test("★ the section cache is CLEARED, because the pull cannot delete it", async () => {
  reset();
  bindSectionChapter("english|III|3A", "ch_05_canonical.json");
  assert.equal(readLocalSection("english|III|3A").chapter, "ch_05_canonical.json");
  await fetchYear();
  await runCutover();
  assert.equal(readLocalSection("english|III|3A").chapter, null,
    "without this, My Classes reads 'Teaching now Ch 5' from the device while the server has no row");
});

test("onDone fires so the caller can latch its first-generation heuristic", async () => {
  reset();
  await fetchYear();
  let latched = false;
  await runCutover({ onDone: () => { latched = true; } });
  assert.equal(latched, true,
    "she emptied her year on purpose — she is emphatically not a new teacher");
});

test("subscribers are told, and immediately on subscribing", async () => {
  reset();
  const seen = [];
  const off = subscribeYear((st) => seen.push(!!(st.info)));
  assert.deepEqual(seen, [false], "fires at once with what is in hand");
  await fetchYear();
  assert.ok(seen.length > 1 && seen[seen.length - 1] === true);
  off();
});
