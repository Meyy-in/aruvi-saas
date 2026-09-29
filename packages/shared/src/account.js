/* ───────── her account, and the NAME on the bar (Track D 5d F4, 2026-09-15) ─────────
 *
 * ★ WHY THIS EXISTS (founder, 2026-09-15): "since I have subscribed under 9000000003, the web app
 * correctly shows my name (Kk) but Expo and my iPhone continue to show the phone number on the top
 * bar." The web has fetched `/account` since 2026-08-26 and puts her `display_name` top-right and
 * in the greeting; the phone never learned to ask, so both screens fell back to the id — which is
 * a MOBILE NUMBER for every teacher who has not subscribed. She subscribed, gave her name, and the
 * phone went on calling her 9000000003.
 *
 * ★ A NUMERIC display_name IS NOT A NAME. It is the just-in-time default the server writes when an
 * account is created from a mobile number, so it must be read as "she has not told us yet" and the
 * id shown instead. That test is `accountFirstName`, and it lives HERE rather than in either
 * surface, because "when does Meyy use her name?" is one rule and two copies of it would drift the
 * day one of them learned about a new default.
 *
 * ★ FIRST NAME ONLY, CAPITALISED (founder, 2026-08-26) — bar and greeting both. "Good evening,
 * Kk!" is a greeting; "Good evening, Kavitha Krishnan!" is a form letter.
 *
 * The store is the shape `readiness.js` uses and for the same reason: the phone's screens are
 * ROUTES, so every crossing remounts them, and a name that re-fetched on each one would blink.
 * Synchronous device copy, one revalidation per session, module memory that survives unmounts.
 *
 * ⚠️ AND IT MUST BE INVALIDATED WHEN SHE RENAMES HERSELF. The web learned this on 2026-08-26:
 * renaming in Personal profile left the OLD first name on the bar and in the greeting until a
 * reload, because nothing re-fetched the account. A subscribe or a profile save is exactly when
 * the name changes, so those paths call `invalidateAccount()`.
 */

import { getJSON, userKey } from "./format.js";
import { storage } from "./storage.js";

/* Sign-out sweeps this prefix (signout.js). Keep the two in step. */
export const ACCOUNT_CACHE_PREFIX = "aruvi_account_";

let mem = null;
let inflight = null;

/* ★ WHO SHOWS HER NAME IS TOLD WHEN IT CHANGES (WALK-A-122, 2026-09-27). The phone's bar and
 * greeting each read the account ONCE per sign-in, so a Personal-profile save that invalidated
 * the store changed nothing on screen: the bar kept the old name until a relaunch, and the
 * greeting only caught up when My Classes happened to remount. They now subscribe; an
 * invalidation tells them, and they re-read. Returns an unsubscribe. */
const listeners = new Set();
export function subscribeAccount(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => { try { fn(); } catch { /* a listener's failure is its own */ } });
}

const storeKey = () => userKey(ACCOUNT_CACHE_PREFIX);

function hydrate() {
  if (mem) return mem;
  try {
    const raw = storage.getItem(storeKey());
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") mem = { account: saved, fresh: false };
    }
  } catch { /* private mode, cleared data, a mangled entry — treat as nothing stored */ }
  return mem;
}

function persist(account) {
  try { storage.setItem(storeKey(), JSON.stringify(account)); } catch { /* quota, private mode */ }
}

/* ★ THE RULE, and the only place it is written.
 * Returns her first name, capitalised — or "" when Meyy should use the id instead:
 *   · no account, or no display_name at all;
 *   · a display_name that is all digits (the JIT default written from a mobile number);
 *   · whitespace only.
 * Anything else is a name she gave us, and its first word is what goes on the bar. */
export function accountFirstName(account) {
  const nm = String((account && account.display_name) || "").trim();
  if (!nm || /^\d+$/.test(nm)) return "";
  const first = nm.split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

/* Her account if we hold one, else null. SYNCHRONOUS — the bar reads this during render, so the
 * first paint carries her name rather than her phone number for a beat and then correcting
 * itself, which reads worse than either. */
export function cachedAccount() {
  const entry = hydrate();
  return entry ? entry.account : null;
}

/* The name for the bar and the greeting, straight from the device copy. "" means use the id. */
export function cachedFirstName() {
  return accountFirstName(cachedAccount());
}

export function fetchAccount({ force = false } = {}) {
  const entry = hydrate();
  if (!force && entry && entry.fresh) return Promise.resolve(entry.account);
  if (inflight) return inflight;

  const p = (async () => {
    const stored = mem;
    try {
      const a = await getJSON("/account");
      mem = { account: a || null, fresh: true };
      if (a) persist(a);
      return mem.account;
    } catch (e) {
      /* ⚠️ A 401 is the server REFUSING this session, not a network failure — never fall back to
         a cached identity for a refused one. Everything else keeps what we hold: a name is a
         nicety, and losing it to a dropped connection would put her phone number back on the bar
         for no reason she could understand. */
      if (String(e && e.message) === "401") throw e;
      if (stored && stored.account) return stored.account;
      return null;
    } finally {
      inflight = null;
    }
  })();
  inflight = p;
  return p;
}

/* After a subscribe or a Personal-profile save — the two moments her name can change. */
export function invalidateAccount() {
  mem = null;
  inflight = null;
  try { storage.removeItem(storeKey()); } catch {}
  notify();
}

/* Sign-out. The prefix sweep in signout.js catches storage; this clears the memory copy, which
 * no prefix sweep can reach. */
export function clearAccount() {
  mem = null;
  inflight = null;
}

/* ★ WHAT HER DATA EXPORT IS CALLED (WALK-A-132, founder 2026-09-28):
 *   Meyy_{FirstName}_{Mon}_{YYYY}_data.{fmt}   e.g. Meyy_Kumar_Sep_2026_data.docx
 * No name on the account (a trial teacher downloading from the delete window) → the last four
 * digits of her mobile: Meyy_3210_Sep_2026_data.docx. The first name is the bar's own rule
 * (`accountFirstName`), with anything that is not a letter or digit dropped so no platform's
 * file system can object. One function for web and phone, so the two can never disagree. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dataExportName(account, fmt = "docx", now = new Date(), mobile = "") {
  const first = accountFirstName(account).replace(/[^\p{L}\p{N}]/gu, "");
  const digits = String((account && account.phone) || mobile || "").replace(/\D/g, "");
  const who = first || digits.slice(-4) || "teacher";
  return `Meyy_${who}_${MONTHS[now.getMonth()]}_${now.getFullYear()}_data.${fmt}`;
}
