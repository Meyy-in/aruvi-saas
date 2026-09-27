/* WALK-A-122: whoever shows her name is told when a save invalidates the account store. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { setStorage } from "../src/storage.js";
import { subscribeAccount, invalidateAccount } from "../src/account.js";

const box = new Map();
setStorage({
  getItem: (k) => (box.has(k) ? box.get(k) : null),
  setItem: (k, v) => { box.set(k, String(v)); },
  removeItem: (k) => { box.delete(k); },
  keys: () => Array.from(box.keys()),
});

test("invalidateAccount tells every subscriber; unsubscribe stops it", () => {
  let a = 0, b = 0;
  const offA = subscribeAccount(() => { a += 1; });
  const offB = subscribeAccount(() => { b += 1; });
  invalidateAccount();
  assert.equal(a, 1); assert.equal(b, 1);
  offA();
  invalidateAccount();
  assert.equal(a, 1); assert.equal(b, 2);
  offB();
});

test("a throwing subscriber does not stop the others", () => {
  let ok = 0;
  const off1 = subscribeAccount(() => { throw new Error("boom"); });
  const off2 = subscribeAccount(() => { ok += 1; });
  invalidateAccount();
  assert.equal(ok, 1);
  off1(); off2();
});
