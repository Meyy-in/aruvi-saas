import { test } from "node:test";
import assert from "node:assert/strict";
import { problemReport, reportWhatsAppText, gradeRoman } from "../src/report.js";

const lp = { subject: "mathematics", grade: "grade_9", chapter_number: 2, chapter_title: "Polynomials" };

test("ref, line and context name the unit", () => {
  const r = problemReport({ lp, unitNumber: 3, unitTitle: "Zeroes of a polynomial" });
  assert.equal(r.ref, "IX-MAT-02-U3");
  assert.equal(r.line, "Class IX · Mathematics · Ch 2 Polynomials · Unit 3 · Zeroes of a polynomial");
  assert.equal(r.context.plan_ref, "IX-MAT-02-U3");
  assert.equal(r.context.grade, "IX");
  assert.equal(r.context.unit, "Unit 3 · Zeroes of a polynomial");
  assert.equal(r.context.screen, "Lesson › Report a problem");
});

test("dropped sections and missing fields degrade quietly", () => {
  const r = problemReport({ lp: { subject: "the_world_around_us", grade: "3" }, unitNumber: 1, dropped: true });
  assert.equal(r.ref, "III-TWA-00-D1");
  assert.equal(r.line, "Class III · The World Around Us · Dropped section 1");
  assert.equal("chapter" in r.context, false);
  assert.equal(gradeRoman("Class 10"), "X");
});

test("WhatsApp text puts the lesson first, then her words", () => {
  const r = problemReport({ lp, unitNumber: 3 });
  assert.equal(reportWhatsAppText(r, "  Q7 guide is wrong. "),
    "Problem in: Class IX · Mathematics · Ch 2 Polynomials · Unit 3 (Ref IX-MAT-02-U3)\n\nQ7 guide is wrong.");
  assert.equal(reportWhatsAppText(r, ""), "Problem in: Class IX · Mathematics · Ch 2 Polynomials · Unit 3 (Ref IX-MAT-02-U3)");
});
