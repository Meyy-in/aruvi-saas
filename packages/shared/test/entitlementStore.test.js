/* The shared ENTITLEMENT STORE — the copy, not the meaning.
 *
 * `entitlement.test.js` beside this one pins the DERIVATIONS (`paidScopesOf`, `entLapsed`,
 * `allowedStagesFor`) that live in format.js. This file pins the things a STORE can get wrong,
 * and each of them is a way a teacher loses her classes for a reason she cannot see:
 *
 *   · an unreachable server must read as "nothing known", never as "lapsed" — a dropped
 *     connection is not a reason to take My Classes out of her bar;
 *   · the device copy must be readable SYNCHRONOUSLY, or a lapsed teacher's cold start shows
 *     her My Classes and Add for the length of a round trip and then snatches them back;
 *   · a stored copy is a HINT — the server's answer wins the moment it lands, both ways;
 *   · her NAME is re-read when her subscription CHANGES and not on every poll (the phone's
 *     stand-in for the web's `entSyncTick`, which a phone with no subscribe flow never gets);
 *   · and nothing survives a sign-out, because the identity here is a mobile number and the
 *     next teacher on a staffroom phone must not inherit this one's subscription.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { setStorage } from "../src/storage.js";
import { setUser, clearUser } from "../src/format.js";
import { cachedAccount, fetchAccount } from "../src/account.js";
import {
  cachedEntitlement, entitlementState, entTrial, syncEntitlement,
  invalidateEntitlement, clearEntitlement, ENTITLEMENT_CACHE_PREFIX,
} from "../src/entitlement.js";

const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});

let ent = { enforced: true, status: "active", live_scopes: ["english/preparatory"] };
let account = { display_name: "Kavitha" };
let mode = "ok";                        // "ok" | "down"
let entCalls = 0, accountCalls = 0;
globalThis.fetch = async (url) => {
  const path = String(url);
  if (mode === "down") throw new TypeError("Failed to fetch");
  if (path.includes("/entitlement")) {
    entCalls += 1;
    return { status: 200, ok: true, headers: { get: () => null }, json: async () => ent };
  }
  accountCalls += 1;
  return { status: 200, ok: true, headers: { get: () => null }, json: async () => account };
};

function reset() {
  box.clear();
  clearEntitlement();
  mode = "ok"; entCalls = 0; accountCalls = 0;
  ent = { enforced: true, status: "active", live_scopes: ["english/preparatory"] };
  setUser("9000000003");
}

test("★ an unreachable server is NOT a lapse — nothing known reads as not lapsed", async () => {
  reset();
  mode = "down";
  const st = await syncEntitlement();
  assert.equal(st.lapsed, false, "a dropped connection must never hide My Classes");
  assert.equal(st.ent, null);
  assert.equal(st.paidScopes, null, "and null scopes means NO LIMIT, not 'nothing allowed'");
});

test("★ a failed poll keeps what we already hold, rather than blanking it", async () => {
  reset();
  await syncEntitlement();
  assert.equal(entitlementState().lapsed, false);
  ent = { enforced: true, status: "expired", lapsed: true };
  await syncEntitlement();
  assert.equal(entitlementState().lapsed, true, "the server said lapsed");
  mode = "down";
  await syncEntitlement();
  assert.equal(entitlementState().lapsed, true,
    "…and a failed poll must not quietly un-lapse her either — it is not news");
});

test("★ the device copy is SYNCHRONOUS, so a lapsed cold start never flashes My Classes", async () => {
  reset();
  ent = { enforced: true, status: "expired", lapsed: true };
  await syncEntitlement();
  clearEntitlement();                    // a relaunch: memory gone, storage kept
  assert.equal(cachedEntitlement().lapsed, true, "read during render, before any fetch");
  assert.equal(entitlementState().lapsed, true);
  assert.equal(entCalls, 1, "and the first paint cost no round trip");
});

test("the stored copy is a HINT — the server wins the moment it answers, both ways", async () => {
  reset();
  ent = { enforced: true, status: "expired", lapsed: true };
  await syncEntitlement();
  clearEntitlement();
  assert.equal(entitlementState().lapsed, true, "painted from the stored copy");
  ent = { enforced: true, status: "active", live_scopes: ["english/preparatory"] };
  const st = await syncEntitlement();
  assert.equal(st.lapsed, false, "she renewed — the store follows the server, not its own memory");
  assert.deepEqual(st.paidScopes, ["english/preparatory"]);
});

test("entTrial reads the STATUS, not whether the gate is on", () => {
  assert.equal(entTrial({ enforced: false, status: "trial" }), true,
    "enforcement decides what is refused; the status decides what is true");
  assert.equal(entTrial({ enforced: true, plan_id: "trial" }), true);
  assert.equal(entTrial({ enforced: true, status: "active" }), false);
  assert.equal(entTrial(null), false);
});

test("★ her NAME is re-read when the subscription CHANGES, and not on every poll", async () => {
  reset();
  await syncEntitlement();
  await fetchAccount();
  assert.equal(accountCalls, 1);
  assert.ok(cachedAccount(), "the name is cached");

  await syncEntitlement();               // same answer
  assert.equal(cachedAccount() != null, true,
    "an unchanged subscription must not throw her name away three times a minute");

  ent = { enforced: true, status: "grace", live_scopes: ["english/preparatory"] };
  await syncEntitlement();               // status changed
  assert.equal(cachedAccount(), null,
    "a status change is the phone's entSyncTick — the name is captured at exactly that moment");
});

test("a scope change invalidates the name too (she bought a second subject)", async () => {
  reset();
  await syncEntitlement();
  await fetchAccount();
  ent = { enforced: true, status: "active", live_scopes: ["english/preparatory", "mathematics/preparatory"] };
  await syncEntitlement();
  assert.equal(cachedAccount(), null);
});

test("invalidate drops the device copy, so the next paint assumes nothing", async () => {
  reset();
  ent = { enforced: true, status: "expired", lapsed: true };
  await syncEntitlement();
  invalidateEntitlement();
  assert.equal(cachedEntitlement(), null);
  assert.equal(entitlementState().lapsed, false, "unknown is not lapsed");
});

test("★ nothing survives a sign-out — the next teacher inherits no subscription", async () => {
  reset();
  ent = { enforced: true, status: "expired", lapsed: true };
  await syncEntitlement();
  /* `userKey` joins with its own "_", so the stored key carries her id at the end. */
  assert.ok(Array.from(box.keys()).some((k) =>
    k.startsWith(ENTITLEMENT_CACHE_PREFIX) && k.endsWith("9000000003")),
    "stored under HER id");
  clearEntitlement();
  clearUser();
  setUser("9000000009");
  assert.equal(cachedEntitlement(), null,
    "a different teacher on a staffroom phone starts from nothing, not from this one's lapse");
});

test("subscribers are told, and are told immediately on subscribing", async () => {
  reset();
  const seen = [];
  const off = (await import("../src/entitlement.js")).subscribeEntitlement((st) => seen.push(st.lapsed));
  assert.deepEqual(seen, [false], "fires at once with the state in hand");
  ent = { enforced: true, status: "expired", lapsed: true };
  await syncEntitlement();
  assert.deepEqual(seen, [false, true]);
  off();
  ent = { enforced: true, status: "active" };
  await syncEntitlement();
  assert.deepEqual(seen, [false, true], "and stops when it unsubscribes");
});

test("★ nothing happens without a teacher — no request, and nothing written", async () => {
  reset();
  clearUser();
  const before = entCalls;
  const st = await syncEntitlement();
  assert.equal(entCalls, before, "a poll with no identity must not go out at all");
  assert.equal(st.lapsed, false);
  assert.equal(Array.from(box.keys()).some((k) => k.startsWith(ENTITLEMENT_CACHE_PREFIX)), false,
    "…and must never persist under an empty-user key, which is what was found in storage after " +
    "a sign-out on 2026-09-16");
});
