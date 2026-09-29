import test from "node:test";
import assert from "node:assert/strict";
import { ROLES, STATES, roleChoice, roleOtherText, roleToSave } from "../src/format.js";

test("every state and union territory, Other last (WALK-A-127)", () => {
  assert.equal(STATES.length, 28 + 8 + 1);
  assert.equal(STATES[STATES.length - 1], "Other");
  const body = STATES.slice(0, -1);
  assert.deepEqual([...body].sort((a, b) => a.localeCompare(b)), body, "alphabetical");
  for (const s of ["Meghalaya", "Sikkim", "Puducherry", "Ladakh", "Jammu and Kashmir"]) {
    assert.ok(STATES.includes(s), s);
  }
});

test("role Other carries her own words (WALK-A-126)", () => {
  assert.equal(roleChoice("Teacher"), "Teacher");
  assert.equal(roleOtherText("Teacher"), "");
  assert.equal(roleChoice("Librarian"), "Other");
  assert.equal(roleOtherText("Librarian"), "Librarian");
  assert.equal(roleChoice("Other"), "Other");
  assert.equal(roleOtherText("Other"), "", "a bare Other from an older record asks again");
  assert.equal(roleChoice(""), "");
  assert.equal(roleToSave("Other", "  Special educator "), "Special educator");
  assert.equal(roleToSave("Other", "  "), "", "Other with nothing typed cannot be saved");
  assert.equal(roleToSave("Head of school", "ignored"), "Head of school");
  assert.ok(ROLES.includes("Other"));
});
