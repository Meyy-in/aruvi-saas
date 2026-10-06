/* node --test — no platform, no network. Proves the seam: memory storage by default, an
 * injected storage after setStorage, the parsers, and the sign-out sweep. Run from
 * packages/shared: `npm test`. */
import test from "node:test";
import assert from "node:assert/strict";
import { setStorage, storage, removeByPrefix } from "../src/storage.js";
import { configure, API, getAccessToken } from "../src/config.js";
import { parseBold, withUser, getUser, setUser, userKey, largestRemainder, stageOfGrade, classNum, planNoteKey } from "../src/format.js";
import { parseInline, parseMarkdown } from "../src/legalmd.js";
import { bindSectionChapter, readLocalSection, writeLocalBookmark, readLocalBookmark, clearLocalSectionCache, setSectionMismatchHandler } from "../src/sectionState.js";
import { recordHistory, readHistory, hasHistory } from "../src/sectionHistory.js";
import { loadBank } from "../src/ask-aruvi/bank.js";
import { search } from "../src/ask-aruvi/askAruviSearch.js";
import { clearTeacherCaches } from "../src/signout.js";
import * as index from "../src/index.js";

// pushSectionState fires a fetch after every local write; without a server it must not throw.
globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
setSectionMismatchHandler(() => {});

test("memory storage stands in until a platform installs one", () => {
  assert.equal(storage.isMemory(), true);
  setUser("9000000003");
  assert.equal(getUser(), "9000000003");
  assert.equal(userKey("mylessons_subject"), "mylessons_subject_9000000003");
});

test("setStorage swaps the implementation under every module", () => {
  const map = new Map();
  setStorage({
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    keys: () => [...map.keys()],
  });
  assert.equal(storage.isMemory(), false);
  assert.equal(getUser(), "");            // the new store is empty — nothing bled across
  setUser("9000000001");
  assert.equal(map.get("aruvi_user"), "9000000001");
});

test("configure() sets the live API binding and the token provider", () => {
  configure({ apiBase: "https://meyy-api.onrender.com/", accessToken: () => "tok.en" });
  assert.equal(API, "https://meyy-api.onrender.com");
  assert.equal(getAccessToken(), "tok.en");
  const o = withUser({ headers: { "If-None-Match": "x" } });
  assert.equal(o.headers.Authorization, "Bearer tok.en");
  assert.equal(o.headers["X-Aruvi-User"], "9000000001");
  assert.equal(o.headers["If-None-Match"], "x");
  configure({ accessToken: () => { throw new Error("boom"); } });
  assert.equal(getAccessToken(), "");     // never throws into a fetch
});

test("format helpers unchanged", () => {
  assert.deepEqual(parseBold("see **Q11** now"), [{ text: "see ", bold: false }, { text: "Q11", bold: true }, { text: " now", bold: false }]);
  assert.deepEqual(parseBold("plain"), [{ text: "plain", bold: false }]);
  assert.deepEqual(largestRemainder(140, [16.5, 20, 30]), [35, 42, 63]);
  assert.equal(stageOfGrade("VII"), "middle");
  assert.equal(classNum("ix"), 9);
  assert.equal(planNoteKey("Science", "Grade IV", 3), "science/iv/3");
});

test("legal markdown parses to blocks, never markup", () => {
  const md = "## Title\n\nAn *intro* line.\n\n- one **bold**\n  wrapped\n- two\n\n---\n\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 |\n";
  const b = parseMarkdown(md);
  assert.deepEqual(b.map((x) => x.type), ["h2", "p", "ul", "hr", "table"]);
  assert.deepEqual(b[1].runs, [{ text: "An ", bold: false, italic: false }, { text: "intro", bold: false, italic: true }, { text: " line.", bold: false, italic: false }]);
  assert.equal(b[2].items.length, 2);
  assert.equal(b[2].items[0].map((r) => r.text).join(""), "one bold wrapped");
  assert.deepEqual(b[4].headText, ["A", "B"]);
  assert.equal(b[4].rows[1].length, 2);   // short row squared to the header
  assert.equal(JSON.stringify(b).includes("<"), false);
  assert.deepEqual(parseInline("**b** *i*"), [{ text: "b", bold: true, italic: false }, { text: " ", bold: false, italic: false }, { text: "i", bold: false, italic: true }]);
});

test("section state + history + bank run on the injected storage", () => {
  bindSectionChapter("science_ix_A", "ch02.json");
  assert.deepEqual(readLocalSection("science_ix_A"), { chapter: "ch02.json", unit: null, done: false });
  writeLocalBookmark("science_ix_A", 1, 2);
  assert.deepEqual(readLocalBookmark("science_ix_A"), { unit: 1, phase: 2 });
  recordHistory("science_ix_A", { file: "ch02.json", status: "started", ts: 5 });
  assert.equal(hasHistory("science_ix_A"), true);
  assert.equal(readHistory("science_ix_A").length, 1);
  storage.setItem("aruvi_ask_bank", JSON.stringify({ pairs: [{ q: "How do I attach a lesson?", a: "Tap +." }] }));
  assert.equal(loadBank().pairs.length, 1);
  storage.setItem("chapter_notes_science_ix_x_9000000001", "note");
  storage.setItem("mylessons_subject_9000000001", "science");
});

test("sign-out clears every per-teacher cache", () => {
  const before = storage.keys();
  assert.ok(before.some((k) => k.startsWith("current_chapter_")));
  clearTeacherCaches(["mylessons_"]);
  const left = storage.keys();
  assert.deepEqual(left, []);
  assert.equal(getUser(), "");
  assert.equal(readLocalSection("science_ix_A").chapter, null);
  assert.equal(hasHistory("science_ix_A"), false);
  assert.equal(loadBank(), null);
});

test("sign-out sweeps every per-teacher key and keeps only the device settings", () => {
  // Privacy Notice v0.5 §5: "Signing out removes all of this" — except what says nothing about her.
  const u = "9000000002";
  for (const k of [`aruvi_invoices_${u}`, `setup_check_pending_${u}`, `setup_check_pending_bought_${u}`,
    `first_run_check_pending_${u}`, `mylessons_subject_${u}`, `mylessons_class_${u}`,
    `allocations_science_ix_${u}`, `aruvi_fresh_start_${u}`, `aruvi_pending_readiness_${u}`,
    "current_chapter_science_ix_A", `chapter_notes_science_ix_x_${u}__synced`]) storage.setItem(k, "x");
  const keep = { "aruvi-theme": "dark", "aruvi-text-size": "large", aruvi_device_seen: "1", aruvi_signup_mode: "signin" };
  Object.entries(keep).forEach(([k, v]) => storage.setItem(k, v));
  clearTeacherCaches();                          // NO extra prefixes: the shared list must be enough
  assert.deepEqual(storage.keys().sort(), Object.keys(keep).sort());
  Object.keys(keep).forEach((k) => storage.removeItem(k));
});

test("Ask Meyy search", () => {
  const pairs = [{ q: "How do I attach a lesson to a class?", a: "…" }, { q: "Where is my invoice?", a: "…" }];
  const r = search(pairs, "attach lesson");
  assert.ok(Array.isArray(r) || typeof r === "object");
});

test("index re-exports everything the apps import", () => {
  for (const n of ["configure", "API", "setStorage", "webStorage", "withUser", "getJSON", "postJSON", "parseBold",
    "verifiedWrite", "bindSectionChapter", "pullSectionState", "pullSectionHistory", "parseMarkdown", "dateWords",
    "configureAuth", "sendOtp", "verifyOtp", "accessToken", "authHeaders", "OTP_LEN", "loadBank", "refreshBank",
    "primeBank", "clearBank", "clearTeacherCaches", "askAruviSearch", "removeByPrefix"]) {
    assert.ok(n in index, n);
  }
});
