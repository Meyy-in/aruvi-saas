/* F1 — the one way a profile is written (Track D step 5d).
 *
 * What is pinned here is the READ-AFTER-WRITE doctrine, because every one of its rules is a rule
 * about what we are entitled to CLAIM, and a claim is exactly the thing a test can hold still:
 *   · a POST that throws is not failure — the read is the arbiter, and it may well have landed;
 *   · a read that cannot be made is not failure either — it is "we do not know", and saying
 *     otherwise invents a fact about her profile;
 *   · a mismatch is the ONLY failure, and the server's copy is then the truth, so the store must
 *     end up holding the SERVER's array and not hers.
 * Plus the caching rule the phone needs: on ok the store is written THROUGH, so the screen after
 * Save reads her new profile out of memory rather than off the network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { setStorage } from "../src/storage.js";
import { setUser, clearUser } from "../src/format.js";
import { configure } from "../src/config.js";
import { cachedReadiness, invalidateReadiness, saveReadiness } from "../src/readiness.js";

const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});
configure({ apiBase: "http://api.test" });

const MINE = [{ name: "Science", grades: [{ grade: "IX", sections: [{ tag: "9A" }], durations: [40],
  periods_per_week: 8 }], budget: { 0: { method: "periods", value: 215 } } }];
const THEIRS = [{ name: "Science", grades: [{ grade: "IX", sections: [{ tag: "9A" }], durations: [40],
  periods_per_week: 8 }], budget: { 0: { method: "periods", value: 180 } } }];

/* One fetch stand-in for both calls: `post` decides what the POST does, `get` what the re-read
   returns. Neither knows about the other, which is the whole point of the doctrine. */
function stubFetch({ post = "ok", get }) {
  globalThis.fetch = async (url, opts) => {
    if (opts && opts.method === "POST") {
      if (post === "throw") throw new Error("network");
      if (post === "500") return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({}) };
    }
    if (get === "throw") throw new Error("network");
    return { ok: true, status: 200, json: async () => ({ readiness: { subjects: get }, ready: true }) };
  };
}

const reset = () => { box.clear(); invalidateReadiness(); setUser("t1"); };

test("ok: the write verifies, and the store is written THROUGH", async () => {
  reset();
  stubFetch({ get: MINE });
  const r = await saveReadiness(MINE);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.profile.subjects, MINE);
  // written through, not invalidated — the next screen paints from memory, no round trip
  assert.deepEqual(cachedReadiness().subjects, MINE);
});

test("a POST that THROWS is not failure — the read is the arbiter", async () => {
  reset();
  stubFetch({ post: "throw", get: MINE });      // the write landed; the response was lost
  const r = await saveReadiness(MINE);
  assert.equal(r.status, "ok");
  assert.deepEqual(cachedReadiness().subjects, MINE);
});

test("a 200 that LIES is caught — status follows the read, never the response", async () => {
  reset();
  stubFetch({ post: "ok", get: THEIRS });
  const r = await saveReadiness(MINE);
  assert.equal(r.status, "mismatch");
});

test("unverified: the read cannot be made, so nothing is claimed", async () => {
  reset();
  stubFetch({ post: "ok", get: "throw" });
  const r = await saveReadiness(MINE);
  assert.equal(r.status, "unverified");
  // Her edit still stands locally: we have no evidence against it, and blanking it would be
  // the same invention as reporting failure.
  assert.deepEqual(r.profile.subjects, MINE);
  assert.deepEqual(cachedReadiness().subjects, MINE);
});

test("mismatch: the SERVER's copy is adopted, hers is not kept", async () => {
  reset();
  stubFetch({ post: "500", get: THEIRS });
  const r = await saveReadiness(MINE);
  assert.equal(r.status, "mismatch");
  assert.deepEqual(r.profile.subjects, THEIRS);
  assert.deepEqual(cachedReadiness().subjects, THEIRS);
  assert.notDeepEqual(cachedReadiness().subjects, MINE);
});

/* The fingerprint compares the facts she can change, so a write is "the same" when those match
   even if the server hands back extra server-side fields. */
test("ok when the server echoes the same FACTS with extra fields alongside", async () => {
  reset();
  const echoed = JSON.parse(JSON.stringify(MINE));
  echoed[0].grids = [[[-1, -1]]];
  echoed[0].server_updated_at = "2026-09-15T00:00:00Z";
  stubFetch({ get: echoed });
  assert.equal((await saveReadiness(MINE)).status, "ok");
});

test("cascade:true is sent, and the body carries her subjects", async () => {
  reset();
  let body = null;
  globalThis.fetch = async (url, opts) => {
    if (opts && opts.method === "POST") { body = JSON.parse(opts.body); return { ok: true, status: 200 }; }
    return { ok: true, status: 200, json: async () => ({ readiness: { subjects: MINE }, ready: true }) };
  };
  await saveReadiness(MINE);
  assert.equal(body.cascade, true);
  assert.deepEqual(body.subjects, MINE);
});

test("the store is per teacher — a save under t1 is not visible to t2", async () => {
  reset();
  stubFetch({ get: MINE });
  await saveReadiness(MINE);
  setUser("t2");
  invalidateReadiness();                 // a new session hydrates from HER key, which is empty
  assert.equal(cachedReadiness(), null);
  clearUser();
});
