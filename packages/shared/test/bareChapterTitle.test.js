/* WALK-A-072 — where the number is already shown, the title must not say it again. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bareChapterTitle } from "../src/format.js";

test("strips a leading 'Chapter N:' in its common spellings", () => {
  assert.equal(bareChapterTitle("Chapter 8: Building Blocks in Economics: The Problem of Choice"),
    "Building Blocks in Economics: The Problem of Choice");
  assert.equal(bareChapterTitle("chapter 12 – Water"), "Water");
  assert.equal(bareChapterTitle("Chapter 4. Light"), "Light");
});
test("leaves everything else alone, and never empties a title", () => {
  assert.equal(bareChapterTitle("Fun with Friends (Fun with Friends)"), "Fun with Friends (Fun with Friends)");
  assert.equal(bareChapterTitle("A Chapter 3: inside"), "A Chapter 3: inside");
  assert.equal(bareChapterTitle("Chapter 3"), "Chapter 3");
  assert.equal(bareChapterTitle(null), "");
});
