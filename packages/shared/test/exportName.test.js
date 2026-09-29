import test from "node:test";
import assert from "node:assert/strict";
import { dataExportName } from "../src/account.js";

const SEP = new Date(2026, 8, 29);

test("first name, short month, year (WALK-A-132)", () => {
  assert.equal(dataExportName({ display_name: "kumar radhakrishnan" }, "docx", SEP),
    "Meyy_Kumar_Sep_2026_data.docx");
  assert.equal(dataExportName({ display_name: "Priya" }, "pdf", SEP), "Meyy_Priya_Sep_2026_data.pdf");
});

test("no name → the last four digits of her mobile", () => {
  assert.equal(dataExportName({ display_name: "9000000013", phone: "9876543210" }, "docx", SEP),
    "Meyy_3210_Sep_2026_data.docx");
  assert.equal(dataExportName(null, "docx", SEP, "9000000013"), "Meyy_0013_Sep_2026_data.docx");
});

test("punctuation in a name never reaches the file name", () => {
  assert.equal(dataExportName({ display_name: "O'Neil" }, "docx", SEP), "Meyy_ONeil_Sep_2026_data.docx");
});
