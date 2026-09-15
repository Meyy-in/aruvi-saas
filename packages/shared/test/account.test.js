/* Her name on the bar (F4).
 *
 * Founder, 2026-09-15: "since I have subscribed under 9000000003, the web app correctly shows my
 * name (Kk) but Expo and my iPhone continue to show the phone number on the top bar."
 * The rule is small and the ways it goes wrong are specific, so each is a test: a numeric
 * display_name is the server's just-in-time default and NOT a name; only the first word is used;
 * and on a shared phone one teacher's name must never outlive her session.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setStorage } from "../src/storage.js";
import { setUser, clearUser } from "../src/format.js";
import { configure } from "../src/config.js";
import {
  accountFirstName, cachedAccount, cachedFirstName, fetchAccount, invalidateAccount, clearAccount,
} from "../src/account.js";

const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});
configure({ apiBase: "http://api.test" });

/* ── the rule ─────────────────────────────────────────────────────────────────────── */

test("★ a NUMERIC display_name is the JIT default, not a name", () => {
  assert.equal(accountFirstName({ display_name: "9000000003" }), "",
    "she has not told us her name — the id is what Meyy should show");
  assert.equal(accountFirstName({ display_name: "  9000000003  " }), "");
});

test("first name only, capitalised — bar and greeting both", () => {
  assert.equal(accountFirstName({ display_name: "kk" }), "Kk");
  assert.equal(accountFirstName({ display_name: "kavitha krishnan" }), "Kavitha");
  assert.equal(accountFirstName({ display_name: "  priya   raman " }), "Priya");
  assert.equal(accountFirstName({ display_name: "KAVITHA" }), "KAVITHA", "her own capitals are hers");
});

test("nothing to show falls back to \"\", never to undefined or a crash", () => {
  for (const a of [null, undefined, {}, { display_name: "" }, { display_name: "   " }])
    assert.equal(accountFirstName(a), "");
});

test("a name that merely CONTAINS digits is still a name", () => {
  assert.equal(accountFirstName({ display_name: "Kk2" }), "Kk2");
});

/* ── the store ────────────────────────────────────────────────────────────────────── */

const stub = (a, { fail = false } = {}) => {
  globalThis.fetch = async () => {
    if (fail) throw new Error("network");
    return { ok: true, status: 200, json: async () => a };
  };
};
const reset = () => { box.clear(); invalidateAccount(); setUser("9000000003"); };

test("the device copy is readable SYNCHRONOUSLY, so the bar paints her name first time", async () => {
  reset();
  stub({ display_name: "Kk" });
  await fetchAccount();
  clearAccount();                       // a fresh session: memory gone, device copy remains
  assert.equal(cachedFirstName(), "Kk", "no await — the bar reads this during render");
});

test("a second read in the same session issues NO request", async () => {
  reset();
  stub({ display_name: "Kk" });
  await fetchAccount();
  let called = false;
  globalThis.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  await fetchAccount();
  assert.equal(called, false);
});

test("a dead server keeps the name we hold — it does not put her number back", async () => {
  reset();
  stub({ display_name: "Kk" });
  await fetchAccount();
  clearAccount();
  stub(null, { fail: true });
  assert.equal(accountFirstName(await fetchAccount()), "Kk");
});

test("a REFUSED session (401) is never papered over with a cached identity", async () => {
  reset();
  stub({ display_name: "Kk" });
  await fetchAccount();
  clearAccount();
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(() => fetchAccount({ force: true }), /401/);
});

test("★ invalidate is what makes a RENAME show up — the 2026-08-26 bug", async () => {
  reset();
  stub({ display_name: "Kk" });
  await fetchAccount();
  assert.equal(cachedFirstName(), "Kk");
  stub({ display_name: "Kavitha" });            // she renames herself in Personal profile
  await fetchAccount();
  assert.equal(cachedFirstName(), "Kk", "without invalidating, the old name stands — the bug");
  invalidateAccount();
  await fetchAccount();
  assert.equal(cachedFirstName(), "Kavitha");
});

test("on a shared phone one teacher's name does not outlive her session", async () => {
  reset();
  stub({ display_name: "Kk" });
  await fetchAccount();
  setUser("9000000004");
  clearAccount();
  assert.equal(cachedAccount(), null, "the next teacher hydrates from HER key, which is empty");
  clearUser();
});
