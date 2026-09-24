/* WALK-A-070 — "Prepare again" greys only when the SERVER says a press would hand back a plan
 * she already holds. The device never guesses the name: any doubt must leave the button live. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { configure } from "../src/config.js";
import { planNameFor } from "../src/format.js";

configure({ apiBase: "http://api.test" });
let seen = null;
let reply = async () => ({ ok: true, status: 200, json: async () => ({ filename: "ch_01_canonical.json" }) });
globalThis.fetch = async (url, opts) => { seen = { url: String(url), body: JSON.parse(opts.body) }; return reply(); };

test("asks the server, with her rows cleaned, and returns its name", async () => {
  const name = await planNameFor("english", "iii", "01",
    [{ duration: "40", count: "6" }, { duration: 45, count: 0 }]);
  assert.equal(name, "ch_01_canonical.json");
  assert.equal(seen.url, "http://api.test/genon/english/iii/1/plan-name");
  assert.deepEqual(seen.body, { rows: [{ duration: 40, count: 6 }] });
});

test("offline, an older API, or no answer -> '' so the button stays live", async () => {
  reply = async () => { throw new TypeError("Failed to fetch"); };
  assert.equal(await planNameFor("english", "iii", 1, [{ duration: 40, count: 6 }]), "");
  reply = async () => ({ ok: false, status: 404, json: async () => ({ detail: "Not Found" }) });
  assert.equal(await planNameFor("english", "iii", 1, [{ duration: 40, count: 6 }]), "");
  reply = async () => ({ ok: true, status: 200, json: async () => ({ filename: null }) });
  assert.equal(await planNameFor("english", "iii", 1, [{ duration: 40, count: 6 }]), "");
});

test("nothing to ask about -> no request, ''", async () => {
  seen = null;
  assert.equal(await planNameFor("english", "iii", 1, []), "");
  assert.equal(await planNameFor("english", "iii", "x", [{ duration: 40, count: 6 }]), "");
  assert.equal(seen, null);
});
