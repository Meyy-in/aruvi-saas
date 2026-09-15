/* What her subscription covers — the rule the class chooser filters by.
 *
 * It lives here because it had been living in ONE place, web/app/page.jsx, and the phone's
 * class chooser shipped without it: on 2026-09-15 the founder found 9000000003 (English,
 * preparatory) being offered Classes 6 through 10 on the phone and only 3, 4 and 5 on the web.
 * These tests pin the two halves that make that bug impossible to re-introduce silently —
 * that null means NO LIMIT, and that a class she already teaches is never filtered away. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { paidScopesOf, entLapsed, allowedStagesFor, stageOfGrade } from "../src/format.js";

test("paidScopesOf: a paid, live teacher gets her live scopes", () => {
  assert.deepEqual(
    paidScopesOf({ enforced: true, status: "active", live_scopes: ["english/preparatory"] }),
    ["english/preparatory"]);
  assert.deepEqual(
    paidScopesOf({ enforced: true, status: "grace", live_scopes: ["science/middle"] }),
    ["science/middle"]);
});

test("paidScopesOf: live_scopes wins over the older `scopes` field, which is the fallback", () => {
  assert.deepEqual(paidScopesOf({
    enforced: true, status: "active",
    live_scopes: ["english/preparatory"], scopes: ["english/preparatory", "english/middle"],
  }), ["english/preparatory"]);
  assert.deepEqual(
    paidScopesOf({ enforced: true, status: "active", scopes: ["english/middle"] }),
    ["english/middle"]);
});

test("paidScopesOf: null — NO LIMIT — for trial, lapsed, enforcement off, and no answer at all", () => {
  assert.equal(paidScopesOf(null), null);                                    // server unreachable
  assert.equal(paidScopesOf({ enforced: false, status: "active", live_scopes: ["a/b"] }), null);
  assert.equal(paidScopesOf({ enforced: true, status: "trial" }), null);
  assert.equal(paidScopesOf({ enforced: true, status: "active", lapsed: true, live_scopes: ["a/b"] }), null);
  assert.equal(paidScopesOf({ enforced: true, status: "expired", live_scopes: ["a/b"] }), null);
});

test("entLapsed: the server's word first, the status only as a fallback", () => {
  assert.equal(entLapsed({ lapsed: true, enforced: true, status: "active" }), true);
  assert.equal(entLapsed({ lapsed: false, enforced: true, status: "expired" }), false);
  assert.equal(entLapsed({ enforced: true, status: "expired" }), true);
  assert.equal(entLapsed({ enforced: false, status: "expired" }), false);
  assert.equal(entLapsed(null), false);
});

test("allowedStagesFor: the stages bought for THAT subject, and no others", () => {
  const scopes = ["english/preparatory", "science/middle", "science/secondary"];
  assert.deepEqual([...allowedStagesFor(scopes, "English")], ["preparatory"]);
  assert.deepEqual([...allowedStagesFor(scopes, "Science")].sort(), ["middle", "secondary"]);
  // A subject she has bought nothing in is an EMPTY set, not null: nothing new is offered.
  assert.deepEqual([...allowedStagesFor(scopes, "Mathematics")], []);
  // The subject name is slugged, so "Social Sciences" finds "social_sciences/…".
  assert.deepEqual([...allowedStagesFor(["social_sciences/middle"], "Social Sciences")], ["middle"]);
});

test("allowedStagesFor: null for no limit — unpaid, and the '*' grant", () => {
  assert.equal(allowedStagesFor(null, "English"), null);
  assert.equal(allowedStagesFor(["*"], "English"), null);
});

test("the founder's case: English · preparatory offers 3, 4 and 5 — and keeps a class she has", () => {
  const catalogue = ["III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const stages = allowedStagesFor(["english/preparatory"], "English");
  const offered = (have) => catalogue
    .filter((g) => !stages || stages.has(stageOfGrade(g)) || have.includes(g));
  assert.deepEqual(offered([]), ["III", "IV", "V"]);
  /* ⚠️ A class she ALREADY teaches survives the filter even when its stage is not paid for.
     Without this the chooser would drop it, and the save reads removals off what is NOT
     ticked — so a subscription lapse would silently delete a class she still teaches. */
  assert.deepEqual(offered(["VIII"]), ["III", "IV", "V", "VIII"]);
});
