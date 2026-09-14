/* The shared teaching-profile store. Written for the founder-reported delay of 2026-09-14 —
 * "web My Classes is instantaneous but on Expo it first shows 'Loading your classes'" — so the
 * CACHING half is the point here, unlike the plan store where invalidation was. Two rules carry
 * the fix and are pinned first: the device copy must be readable SYNCHRONOUSLY (or the screen
 * has nothing to paint and the spinner comes back), and a second mount must issue NO request
 * (or the crossing still costs a round trip).
 *
 * The rest guard the ways a cache like this goes wrong: a refused session must not be papered
 * over with cached classes, a dead server must not blank them, and one teacher's profile must
 * never outlive her session on a shared phone.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { setStorage, storage } from "../src/storage.js";
import { setUser, clearUser } from "../src/format.js";
import {
  cachedReadiness, cachedReady, fetchReadiness, invalidateReadiness, clearReadiness,
  READINESS_CACHE_PREFIX,
} from "../src/readiness.js";

/* A storage that survives between the sub-tests, standing in for localStorage / MMKV. */
const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});

let calls = 0;
let profile = { subjects: [{ name: "Science", grades: [{ grade: "IX", sections: [{ tag: "9A" }] }] }] };
let mode = "ok";           // "ok" | "401" | "down"
globalThis.fetch = async () => {
  calls += 1;
  if (mode === "401") return { status: 401, ok: false, text: async () => "" };
  if (mode === "down") throw new TypeError("Failed to fetch");
  return {
    status: 200, ok: true,
    headers: { get: () => null },
    json: async () => ({ ready: true, readiness: profile }),
  };
};

function reset() {
  clearReadiness(); box.clear(); calls = 0; mode = "ok";
  setUser("teacher-a");
}

test("the first fetch stores a device copy that cachedReadiness reads SYNCHRONOUSLY", async () => {
  reset();
  // Nothing held yet: a screen mounting now genuinely has nothing to draw, and says so.
  assert.equal(cachedReadiness(), null);
  await fetchReadiness();
  clearReadiness();                       // drop the memory copy, keep the device one
  // THE RULE THE FIX RESTS ON: no await. A screen reads this during render.
  const held = cachedReadiness();
  assert.deepEqual(held, profile);
  assert.equal(cachedReady(), true);
});

test("a second mount in the same session issues NO request", async () => {
  reset();
  await fetchReadiness();
  assert.equal(calls, 1);
  await fetchReadiness();
  await fetchReadiness();
  assert.equal(calls, 1, "a crossing between screens must not cost a round trip");
});

test("two screens mounting in the same tick share ONE request", async () => {
  reset();
  const [a, b] = await Promise.all([fetchReadiness(), fetchReadiness()]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
});

test("invalidateReadiness sends the next read back to the server", async () => {
  reset();
  await fetchReadiness();
  assert.equal(calls, 1);
  invalidateReadiness();
  await fetchReadiness();
  assert.equal(calls, 2, "a profile write must be followed by a real re-read");
  // and it clears the device copy too, or the next cold start paints the old classes
  clearReadiness();
  invalidateReadiness();
  assert.equal(cachedReadiness(), null);
});

test("force re-reads even when the session already checked", async () => {
  reset();
  await fetchReadiness();
  await fetchReadiness({ force: true });
  assert.equal(calls, 2, "pull-to-refresh is her own 'check again'");
});

test("a dead server falls back to the stored copy rather than blanking her classes", async () => {
  reset();
  await fetchReadiness();
  clearReadiness();                       // a fresh session, device copy intact
  mode = "down";
  const held = await fetchReadiness();
  assert.deepEqual(held, profile, "offline may not empty a teacher's class list");
});

test("a dead server with NOTHING stored rejects, so the screen can say it couldn't ask", async () => {
  reset();
  mode = "down";
  await assert.rejects(() => fetchReadiness());
});

test("⚠️ a 401 is RETHROWN even with a copy on the device — a refusal is not a network failure",
  async () => {
    reset();
    await fetchReadiness();
    clearReadiness();
    mode = "401";
    // Falling back here would leave an erased account rendering its own cached classes for ever.
    await assert.rejects(() => fetchReadiness(), (e) => String(e.message) === "401");
  });

test("the copy is PER TEACHER — a shared phone never shows the last teacher's classes", async () => {
  reset();
  await fetchReadiness();
  const keysA = [...box.keys()].filter((k) => k.startsWith(READINESS_CACHE_PREFIX));
  assert.equal(keysA.length, 1);
  assert.match(keysA[0], /teacher-a/, "the key must be stamped with the signed-in teacher");

  clearReadiness();
  setUser("teacher-b");
  assert.equal(cachedReadiness(), null, "teacher B must not read teacher A's device copy");
  clearUser();
});

test("a mangled device entry is treated as nothing stored, never as a profile", () => {
  reset();
  clearReadiness();
  box.set([...box.keys()][0] || `${READINESS_CACHE_PREFIX}x`, "{ not json");
  assert.doesNotThrow(() => cachedReadiness());
  assert.equal(cachedReadiness(), null);
});
