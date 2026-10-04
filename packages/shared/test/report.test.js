import { test } from "node:test";
import assert from "node:assert/strict";
import { problemReport, reportWhatsAppText, supportWhatsAppText, gradeRoman, phaseOptionLabel } from "../src/report.js";

const lp = { subject: "mathematics", grade: "grade_9", chapter_number: 2, chapter_title: "Polynomials" };

test("two short rows for her; the code stays internal", () => {
  const r = problemReport({ lp, unitNumber: 3, unitTitle: "Zeroes of a polynomial" });
  assert.equal(r.line1, "Class IX · Mathematics");
  assert.equal(r.line2, "Polynomials · Unit 3");
  assert.equal(r.ref, "IX-MAT-02-U3");
  assert.equal(r.context.plan_ref, "IX-MAT-02-U3");
  assert.equal(r.context.unit_title, "Zeroes of a polynomial");
  assert.equal(r.line2.includes("Zeroes"), false, "the activity name is not shown to her");
});

test("a phase report names the phase; an assessment report says so", () => {
  const r = problemReport({ lp, unitNumber: 3, phase: 2 });
  assert.equal(r.line2, "Polynomials · Unit 3 · Phase 2");
  assert.equal(r.ref, "IX-MAT-02-U3-P2");
  assert.equal(r.context.phase, "Phase 2");
  assert.equal(problemReport({ lp, unitNumber: 3, phase: "" }).line2, "Polynomials · Unit 3");
  const a = problemReport({ lp, unitNumber: 3, phase: 2, part: "assess" });
  assert.equal(a.line2, "Polynomials · Unit 3 · Assessment");
  assert.equal(a.ref, "IX-MAT-02-U3-A");
  assert.equal(phaseOptionLabel(1, 5), "Phase 1 - 5 min");
  assert.equal(phaseOptionLabel(4, null), "Phase 4");
});

test("dropped sections and missing fields degrade quietly", () => {
  const r = problemReport({ lp: { subject: "the_world_around_us", grade: "3" }, unitNumber: 1, dropped: true });
  assert.equal(r.ref, "III-TWA-00-D1");
  assert.equal(r.line2, "Dropped section 1");
  assert.equal("chapter" in r.context, false);
  assert.equal(gradeRoman("Class 10"), "X");
});

test("WhatsApp text puts the lesson first, then her words, with no code", () => {
  const r = problemReport({ lp, unitNumber: 3, phase: 2 });
  const t = reportWhatsAppText(r, "  Q7 guide is wrong. ");
  assert.equal(t, "Problem in: Class IX · Mathematics · Polynomials · Unit 3 · Phase 2\n\nQ7 guide is wrong.");
  assert.equal(t.includes("IX-MAT"), false);
});

test("Support text: header, sign-in, then her words", () => {
  assert.equal(supportWhatsAppText("Billing or account", "98000 00306", " Charged twice "),
    "Support: Billing or account\nSign-in: 98000 00306\n\nCharged twice");
  assert.equal(supportWhatsAppText("A suggestion", "", "Hi"), "Support: A suggestion\n\nHi");
});
