/* WALK-A-070 — the Prepare button greys only when a press would hand back a plan she holds.
 * The JS name must match api/data.py genon_plan_filename byte for byte, or the check lies. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normMatrix, genonPlanFilename } from "../src/format.js";

test("normMatrix mirrors the server: aggregate, drop zeros, longest first", () => {
  assert.equal(normMatrix([{ duration: 50, count: 16 }]), "50m16");
  assert.equal(normMatrix([{ duration: 50, count: 10 }, { duration: 50, count: 7 }]), "50m17");
  assert.equal(normMatrix([{ duration: 40, count: 6 }, { duration: 45, count: 3 }, { duration: 30, count: 0 }]), "45m3-40m6");
  assert.equal(normMatrix([{ duration: "50", count: "16" }]), "50m16");
  assert.equal(normMatrix([]), "");
});

test("the full name matches the server's docstring example", () => {
  assert.equal(genonPlanFilename(5, [{ duration: 50, count: 16 }], "_e07_c20260726112240.json"),
    "ch_05_50m16_e07_c20260726112240.json");
  assert.equal(genonPlanFilename("12", [{ duration: 40, count: 9 }], "_e19_cabc.json"), "ch_12_40m9_e19_cabc.json");
});

test("unknown suffix or empty length -> no name, so the button stays live", () => {
  assert.equal(genonPlanFilename(5, [{ duration: 50, count: 16 }], undefined), "");
  assert.equal(genonPlanFilename(5, [], "_e19_c1.json"), "");
});
