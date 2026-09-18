/* The subscription DISPLAY rules, shared by Settings.jsx and the phone's
 * settings/subscription.jsx (Track D 6b·D, 2026-09-16). They were web-only until the phone
 * needed the same four; these tests are what stop the two surfaces drifting apart on the one
 * screen where drifting means telling a paying teacher two different things. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGE_CLASSES, fmtValidity, scopeRows, subsFromEntitlement } from "../src/format.js";

test("stage classes are the promise, verbatim", () => {
  assert.equal(STAGE_CLASSES.preparatory, "3, 4 & 5");
  assert.equal(STAGE_CLASSES.middle, "6, 7 & 8");
  /* ⚠️ If class 10 ever opens, this string and this assertion change together — and that is
     the point of the test: one place, both surfaces. */
  assert.equal(STAGE_CLASSES.secondary, "9 (10 coming soon)");
});

test("validity reads as a date a teacher can say out loud", () => {
  assert.equal(fmtValidity("2027-03-31"), "31-Mar-27");
  assert.equal(fmtValidity("2026-09-01T00:00:00Z"), "01-Sep-26");
});

test("a validity that is not a date comes back unchanged, never blank", () => {
  assert.equal(fmtValidity(""), "");
  assert.equal(fmtValidity("soon"), "soon");
  assert.equal(fmtValidity(null), "");
});

test("a scope becomes its three ledger rows", () => {
  assert.deepEqual(scopeRows("social_sciences/secondary"),
    { subject: "Social Sciences", stage: "Secondary", classes: "9 (10 coming soon)" });
});

test("the wildcard scope is everything", () => {
  assert.deepEqual(scopeRows("*"),
    { subject: "All subjects", stage: "All stages", classes: "3 to 10" });
});

test("an unknown stage shows a dash, not an empty cell", () => {
  assert.equal(scopeRows("science/tertiary").classes, "—");
});

test("latest expiry first, and a tie keeps cart order", () => {
  const subs = subsFromEntitlement({
    scopes: ["a/middle", "b/middle", "c/middle"],
    scope_valid_until: { "a/middle": "2027-01-01", "b/middle": "2027-06-01",
                         "c/middle": "2027-01-01" },
    live_scopes: ["a/middle", "b/middle", "c/middle"],
  });
  assert.deepEqual(subs.map((s) => s.scope), ["b/middle", "a/middle", "c/middle"]);
});

test("live comes from the server's list, not from a date the client compared", () => {
  /* `until` is far in the future, so a date test would call this live. The server says it is
     not — and the server is the authority, because it honours ARUVI_TODAY and no client can. */
  const [s] = subsFromEntitlement({
    scopes: ["x/middle"], scope_valid_until: { "x/middle": "2099-01-01" },
    live_scopes: [],
  });
  assert.equal(s.live, false);
});

test("without live_scopes it falls back to the date — the older-API path", () => {
  const subs = subsFromEntitlement({
    scopes: ["past/middle", "future/middle"],
    scope_valid_until: { "past/middle": "2000-01-01", "future/middle": "2099-01-01" },
  });
  assert.equal(subs.find((s) => s.scope === "past/middle").live, false);
  assert.equal(subs.find((s) => s.scope === "future/middle").live, true);
});

test("an expired subscription is still returned — she owned it", () => {
  const subs = subsFromEntitlement({
    scopes: ["gone/middle"], scope_valid_until: { "gone/middle": "2000-01-01" },
    live_scopes: [],
  });
  assert.equal(subs.length, 1);
  assert.equal(subs[0].live, false);
});

test("a scope with no per-scope date falls back to the account's valid_until", () => {
  const [s] = subsFromEntitlement({ scopes: ["x/middle"], valid_until: "2027-03-31",
                                    live_scopes: ["x/middle"] });
  assert.equal(s.until, "2027-03-31");
});

test("no entitlement is no rows, never a throw", () => {
  assert.deepEqual(subsFromEntitlement(null), []);
  assert.deepEqual(subsFromEntitlement({}), []);
});

/* `subjectStageMap` — the cart's chooser data, and the reason it is here: it was a `for await`
 * loop in web/SubscribeFlow.jsx, which is imperceptible against a dev API and six round trips
 * against a deployed one. The phone found it, because the phone is the only surface that talks
 * to production. */
test("every subject's grades are fetched in parallel, not in series", async () => {
  const { subjectStageMap } = await import("../src/format.js");
  let open = 0, peak = 0;
  globalThis.fetch = async (url) => {
    const path = String(url);
    if (path.endsWith("/subjects")) {
      return { ok: true, status: 200, json: async () => ({ subjects: ["a", "b", "c", "d"] }) };
    }
    open += 1; peak = Math.max(peak, open);
    await new Promise((r) => setTimeout(r, 15));
    open -= 1;
    return { ok: true, status: 200, json: async () => ({ grades: ["vi", "vii", "ix"] }) };
  };
  const map = await subjectStageMap();
  /* Serial would peak at 1. Anything above it proves they overlap. */
  assert.ok(peak > 1, `expected overlapping requests, peaked at ${peak}`);
  assert.deepEqual(Object.keys(map).sort(), ["a", "b", "c", "d"]);
  assert.deepEqual(map.a, ["middle", "secondary"]);
});

test("a subject whose grades fail is omitted, never listed empty", async () => {
  const { subjectStageMap } = await import("../src/format.js");
  globalThis.fetch = async (url) => {
    const path = String(url);
    if (path.endsWith("/subjects")) {
      return { ok: true, status: 200, json: async () => ({ subjects: ["good", "bad"] }) };
    }
    if (path.includes("/bad/")) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ grades: ["iii"] }) };
  };
  const map = await subjectStageMap();
  /* An entry with no stages is a subject she can pick and find nothing behind. */
  assert.deepEqual(Object.keys(map), ["good"]);
  assert.deepEqual(map.good, ["preparatory"]);
});

test("★ newest PURCHASE first — the invoice's issue time decides (2026-09-18)", () => {
  const ent = { scopes: ["old/middle", "new/middle", "grant/middle"],
    scope_valid_until: { "old/middle": "2027-01-10", "grant/middle": "2027-05-01" },
    valid_until: "2027-09-18",            // new/middle has only the account-wide date
    live_scopes: ["old/middle", "new/middle", "grant/middle"] };
  const inv = [{ scopes: ["new/middle"], issued_at: "2026-09-18T09:00:00+00:00" },
               { scopes: ["old/middle"], issued_at: "2026-01-10T09:00:00+00:00" }];
  assert.deepEqual(subsFromEntitlement(ent, inv).map((s) => s.scope),
    ["new/middle", "grant/middle", "old/middle"]);
});
