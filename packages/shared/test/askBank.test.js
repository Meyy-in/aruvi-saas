/* ───────── the Ask Meyy bank's freshness check ─────────
 *
 * The bank is ~90KB and the whole point of the ETag is that a teacher pays for it only in the
 * month the answers change. These tests pin the two halves of that bargain: the check is sent,
 * and every way the server can say "you already have it" leaves the stored copy standing.
 *
 * ★ WHY THIS FILE EXISTS AT ALL (2026-09-16). `refreshBank` swallows every failure by design —
 * offline, a dead server, a 401 must never blank the HELP screen — and that is exactly what
 * made the Render bug invisible for as long as it was: the freshness check was answering 503
 * for every returning teacher, the catch kept the stored bank, Ask Meyy went on answering, and
 * the bank could never update again. Nothing on any screen would have shown it. So the
 * behaviour has to be asserted here, where a silent failure is a red test rather than nothing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { setStorage } from "../src/storage.js";
import { setUser } from "../src/format.js";
import { loadBank, refreshBank, clearBank } from "../src/ask-aruvi/bank.js";

const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});

const BANK = { categories: [{ id: "cat_a" }], pairs: [{ id: "a01", question: "q", answer: "a" }] };
const ETAG = '"v1"';

let calls = [];
/* `unchangedAs` is how the server says "you already have it": `marker` is what it sends since
   2026-09-16 (a 200 carrying {unchanged:true}, because Render's edge turns an empty 304 into a
   503), `notmodified` the standard 304, which a direct server still sends. `fail` is the bug
   as it was in the wild, and the offline case besides. */
let unchangedAs = "marker";
globalThis.fetch = async (url, opts) => {
  const inm = (opts && opts.headers && opts.headers["If-None-Match"]) || "";
  calls.push({ url: String(url), inm });
  if (inm === ETAG) {
    if (unchangedAs === "notmodified") return { status: 304, ok: false, headers: { get: () => ETAG } };
    if (unchangedAs === "fail") return { status: 503, ok: false, headers: { get: () => null } };
    return { status: 200, ok: true, headers: { get: (h) => (h === "ETag" ? ETAG : null) },
             json: async () => ({ unchanged: true }) };
  }
  return { status: 200, ok: true, headers: { get: (h) => (h === "ETag" ? ETAG : null) },
           json: async () => BANK };
};

function reset(mode = "marker") {
  box.clear(); calls = []; unchangedAs = mode; setUser("9000000001");
}

test("the first fetch sends no ETag and stores the bank", async () => {
  reset();
  const kb = await refreshBank();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].inm, "", "a device with nothing stored must not offer a tag");
  assert.ok(calls[0].url.endsWith("/ask-aruvi"));
  assert.equal(kb.pairs.length, 1);
  assert.equal(loadBank().pairs.length, 1);
});

test("the second fetch offers the stored ETag", async () => {
  reset();
  await refreshBank();
  await refreshBank();
  assert.equal(calls[1].inm, ETAG);
});

/* ★ THE SHAPE THE SERVER ACTUALLY SENDS. The marker must never be mistaken for a bank: it has
   no `pairs`, and a client that stored it would wipe the help screen it was trying to keep. */
test("a 200 + {unchanged} keeps the stored bank untouched", async () => {
  reset();
  await refreshBank();
  const kb = await refreshBank();
  assert.equal(kb.pairs.length, 1, "unchanged must resolve to the copy we already hold");
  assert.equal(loadBank().pairs.length, 1, "and must not overwrite it");
});

test("a 304 does the same, for a direct server or a fixed edge", async () => {
  reset("notmodified");
  await refreshBank();
  const kb = await refreshBank();
  assert.equal(kb.pairs.length, 1);
});

/* The Render bug as it was. The stored copy stands — that part was always right — but this is
   the case the product must stop being in, so the test names it rather than blessing it. */
test("a failed check falls back to the stored bank rather than blanking it", async () => {
  reset("fail");
  await refreshBank();
  const kb = await refreshBank();
  assert.equal(kb.pairs.length, 1);
  assert.equal(loadBank().pairs.length, 1);
});

test("an orphaned ETag is never offered — it would earn an unchanged we cannot honour", async () => {
  reset();
  await refreshBank();
  clearBank();
  calls = [];
  const kb = await refreshBank();
  assert.equal(calls[0].inm, "", "with no bank held, the tag must not be sent");
  assert.equal(kb.pairs.length, 1);
});
