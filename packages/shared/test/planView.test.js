/* A lesson opened once can be opened again offline (2026-09-18). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setStorage } from "../src/storage.js";
import { setUser } from "../src/format.js";
import { fetchPlanView, cachedPlanView } from "../src/plans.js";

const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});
setUser("t1");

let mode = "ok";
globalThis.fetch = async () => {
  if (mode === "offline") throw new TypeError("Failed to fetch");
  if (mode === "404") return { status: 404, ok: false, json: async () => ({}) };
  return { status: 200, ok: true, json: async () => ({ view: { title: "Ch 4" } }) };
};

test("opened online → kept → opens offline", async () => {
  mode = "ok";
  assert.equal((await fetchPlanView("science", "vi", "ch4.json")).view.title, "Ch 4");
  mode = "offline";
  assert.equal((await fetchPlanView("science", "vi", "ch4.json")).view.title, "Ch 4");
});

test("never opened → offline still fails, loudly", async () => {
  mode = "offline";
  await assert.rejects(fetchPlanView("science", "vi", "never.json"));
});

test("a 404 is never papered over by the copy", async () => {
  mode = "404";
  await assert.rejects(fetchPlanView("science", "vi", "ch4.json"), /404/);
});

test("bounded: only the most recent twelve are kept", async () => {
  mode = "ok";
  for (let i = 0; i < 15; i++) await fetchPlanView("maths", "vii", `c${i}.json`);
  assert.equal(cachedPlanView("maths", "vii", "c0.json"), null);
  assert.ok(cachedPlanView("maths", "vii", "c14.json"));
});

test("keys sit under the plans prefix, so sign-out sweeps them", () => {
  assert.ok([...box.keys()].filter((k) => k.includes("view")).every((k) => k.startsWith("aruvi_plans_")));
});
