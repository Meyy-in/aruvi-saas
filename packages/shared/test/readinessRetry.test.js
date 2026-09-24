/* WALK-A-085 — a first-run profile saved offline is retried, but never into another teacher's
 * account: the retry dies at sign-out and only ever fires for the teacher who armed it. */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { setStorage } from "../src/storage.js";
import { configure } from "../src/config.js";
import { setUser, clearUser } from "../src/format.js";
import { saveReadiness, clearReadiness } from "../src/readiness.js";

configure({ apiBase: "http://api.test" });
const box = new Map();
setStorage({ getItem: (k) => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, String(v)),
             removeItem: (k) => box.delete(k), keys: () => Array.from(box.keys()) });

let online = false;
const posts = [];
globalThis.fetch = async (url, opts = {}) => {
  if (!online) throw new TypeError("Failed to fetch");
  if ((opts.method || "GET") === "POST") {
    posts.push({ as: (opts.headers && (opts.headers["X-Aruvi-User"] || opts.headers["x-aruvi-user"])) || "?", body: opts.body });
    return { ok: true, status: 200, json: async () => ({}) };
  }
  return { ok: true, status: 200, json: async () => ({ readiness: null }) };
};
const SUBJ = [{ name: "English", grades: [{ grade: "III", sections: [{ tag: "3A" }] }] }];

test("offline save arms a retry; signing out cancels it — nothing is ever sent", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  box.clear(); posts.length = 0; online = false; setUser("9000000012");
  const p = saveReadiness(SUBJ);
  for (let i = 0; i < 10; i++) { t.mock.timers.tick(2000); await Promise.resolve(); }
  await p;                                   // unverified → retry armed
  clearReadiness();                          // sign-out
  clearUser(); setUser("9000000003");        // the next teacher on this phone
  online = true;
  t.mock.timers.tick(20000); await new Promise((r) => setImmediate(r));
  assert.equal(posts.length, 0, "no profile was POSTed after she signed out");
});

test("even if a sweep were skipped, a retry fires only for the teacher who armed it", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  box.clear(); posts.length = 0; online = false; setUser("9000000013");
  const p = saveReadiness(SUBJ);
  for (let i = 0; i < 10; i++) { t.mock.timers.tick(2000); await Promise.resolve(); }
  await p;
  setUser("9000000003");                     // switched WITHOUT clearReadiness
  online = true;
  t.mock.timers.tick(20000); await new Promise((r) => setImmediate(r));
  assert.equal(posts.length, 0, "A's profile was not sent under B's sign-in");
});
