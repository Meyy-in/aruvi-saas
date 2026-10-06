/* knownLookup: the number goes in a POST body; an API older than the client (405) is answered by
 * the old GET instead of breaking sign-in (2026-10-06, found live). */
import test from "node:test";
import assert from "node:assert/strict";
import { knownLookup } from "../src/format.js";

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || "GET", body: opts.body });
    const { status, json } = handler(String(url), opts.method || "GET");
    return { ok: status >= 200 && status < 300, status, json: async () => json };
  };
  return calls;
}

test("the number travels in the body, never the URL", async () => {
  const calls = mockFetch(() => ({ status: 200, json: { known: true, id: "9876501234" } }));
  const d = await knownLookup(" 9876501234 ");
  assert.equal(d.known, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.ok(!calls[0].url.includes("9876501234"), calls[0].url);
  assert.deepEqual(JSON.parse(calls[0].body), { id: "9876501234" });
});

test("an older API (405 on POST) is asked with the old GET", async () => {
  const calls = mockFetch((url, method) => (method === "POST"
    ? { status: 405, json: { detail: "Method Not Allowed" } }
    : { status: 200, json: { known: false, id: "9876501234" } }));
  const d = await knownLookup("9876501234");
  assert.equal(d.known, false);
  assert.deepEqual(calls.map((c) => c.method), ["POST", "GET"]);
});

test("any other failure is not retried as a GET", async () => {
  const calls = mockFetch(() => ({ status: 400, json: {} }));
  await assert.rejects(() => knownLookup("9876501234"));
  assert.deepEqual(calls.map((c) => c.method), ["POST"]);
});
