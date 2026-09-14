/* The shared plan-listing store. The caching half is an optimisation and would be fine to
 * leave untested; the INVALIDATION half is not — a stale `prepared` flag after an attach puts
 * a chapter she already tracks back into the "+" picker, which is worse than the slow listing
 * this store was written to remove. These tests pin the four rules that keep it honest. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { setStorage, storage } from "../src/storage.js";
import { setUser, clearUser } from "../src/format.js";
import {
  cachedPlans, fetchPlans, invalidatePlans, notePlansYear, clearPlans, PLANS_CACHE_PREFIX,
} from "../src/plans.js";

/* A storage that survives between the sub-tests, standing in for localStorage / MMKV. */
const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});

let calls = 0;
let plans = [{ filename: "ch_01.json", prepared: false }];
let etag = '"v1"';
globalThis.fetch = async (url, opts) => {
  calls += 1;
  const inm = (opts && opts.headers && opts.headers["If-None-Match"]) || "";
  if (inm && inm === etag) {
    return { status: 304, ok: false, headers: { get: () => etag } };
  }
  return {
    status: 200, ok: true,
    headers: { get: (h) => (h === "ETag" ? etag : null) },
    json: async () => ({ plans }),
  };
};

function reset() {
  clearPlans(); box.clear(); calls = 0; etag = '"v1"';
  plans = [{ filename: "ch_01.json", prepared: false }];
  setUser("9000000001");
}

test("one request per key per session, however many screens ask", async () => {
  reset();
  const a = await fetchPlans("english/iii");
  const b = await fetchPlans("english/iii");
  assert.equal(calls, 1);
  assert.deepEqual(b, a);
});

test("two screens mounting together share one request in flight", async () => {
  reset();
  const [a, b] = await Promise.all([fetchPlans("english/iii"), fetchPlans("english/iii")]);
  assert.equal(calls, 1);
  assert.equal(a, b);
});

test("the device copy is readable synchronously, before any fetch", async () => {
  reset();
  await fetchPlans("english/iii");
  clearPlans();                                   // a fresh session: memory gone, storage kept
  assert.deepEqual(cachedPlans("english/iii"), plans);
});

test("a stored copy is revalidated with If-None-Match and kept on 304", async () => {
  reset();
  await fetchPlans("english/iii");
  clearPlans();
  const got = await fetchPlans("english/iii");     // sends the etag, server says 304
  assert.equal(calls, 2);
  assert.deepEqual(got, plans);
});

test("invalidate forces the next read back to the server", async () => {
  reset();
  await fetchPlans("english/iii");
  invalidatePlans("english/iii");
  assert.equal(cachedPlans("english/iii"), null);  // the device copy goes too
  plans = [{ filename: "ch_01.json", prepared: true }];
  etag = '"v2"';
  const got = await fetchPlans("english/iii");
  assert.equal(calls, 2);
  assert.equal(got[0].prepared, true);
});

test("a cutover clears every key; the year merely arriving does not", async () => {
  reset();
  notePlansYear(null);                            // unknown
  await fetchPlans("english/iii");
  notePlansYear("2026-27");                       // unknown → known is not a change
  assert.deepEqual(cachedPlans("english/iii"), plans);
  notePlansYear("2027-28");                       // known → different: her flags are year-scoped
  assert.equal(cachedPlans("english/iii"), null);
});

test("the device copy is per teacher and carries the sign-out prefix", async () => {
  reset();
  await fetchPlans("english/iii");
  const keys = storage.keys().filter((k) => k.startsWith(PLANS_CACHE_PREFIX));
  assert.ok(keys.length, "expected a stored listing");
  assert.ok(keys.every((k) => k.endsWith("_9000000001")
                           || k.endsWith("_9000000001_etag")), keys.join(","));
  clearPlans();
  setUser("9000000002");                          // another teacher on the same device
  assert.equal(cachedPlans("english/iii"), null);
  clearUser();
});

test("a failed request falls back to the stored copy rather than blanking the list", async () => {
  reset();
  await fetchPlans("english/iii");
  clearPlans();
  const good = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  assert.deepEqual(await fetchPlans("english/iii"), plans);
  globalThis.fetch = good;
});

test("a failed request with nothing stored rejects, so the caller can show its empty state", async () => {
  reset();
  const good = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  await assert.rejects(() => fetchPlans("maths/iv"));
  globalThis.fetch = good;
});
