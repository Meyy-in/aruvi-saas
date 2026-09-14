/* ───────── the plan listing, fetched once per device and shared by every screen ─────────
 *
 * ★ WHY THIS FILE EXISTS (founder-reported delay, 2026-09-14). GET /plans/{subject}/{grade}
 * answers one question — "which chapters exist in this library, and which are hers?" — and the
 * answer does not change while she works. Yet FOUR screens asked for it independently
 * (My Classes, My Lessons, Prepare, Year Plan), each holding its own copy in a component ref.
 * A ref dies with the component and these views REMOUNT on every visit, so the listing was
 * re-fetched on every trip to My Lessons and back: measured in the founder's browser after the
 * N+1 fix, six calls in one session, 315–471 ms each — about two seconds of waiting for a list
 * that never moved.
 *
 * ★ THREE THINGS, IN ORDER OF HOW MUCH THEY MATTER:
 *
 *   1. ONE COPY PER SUBJECT·CLASS, OUTSIDE REACT. The memory cache below is module-level, so it
 *      OUTLIVES every mount. The second screen to ask gets the first screen's answer for free,
 *      and so does the same screen on its second visit.
 *
 *   2. ONE REQUEST IN FLIGHT. Two screens mounting in the same tick (My Classes' effect and a
 *      deep-link's) used to fire two identical requests. They now share one promise.
 *
 *   3. A DEVICE COPY, SO THE FIRST PAINT IS INSTANT. The listing is written to storage the same
 *      way the Ask Meyy bank is (ask-aruvi/bank.js, which this file follows deliberately):
 *      `cachedPlans` is SYNCHRONOUS and may be read during render, so a returning teacher sees
 *      her chapters before the network is consulted at all. The ETag is stored beside it and
 *      sent back as If-None-Match, so the freshness check costs a few hundred bytes once the
 *      server answers 304.
 *
 * ★ THE COPY IS PER TEACHER, AND MUST BE. The response is not a pure library listing: each row
 * carries HER `prepared` / `archived` / `prepared_source_year` flags. So every key is stamped
 * with `userKey()`, and PLANS_CACHE_PREFIX is in TEACHER_CACHE_PREFIXES so sign-out takes it
 * with everything else. A shared staffroom phone must never show the last teacher's chapters.
 *
 * ★ INVALIDATION IS THE PART THAT HAS TO BE RIGHT. A stale `prepared` flag after an attach is a
 * worse bug than a slow list — the "+" picker would offer a chapter she already tracks. So the
 * listing is re-read, not merely re-used, whenever the thing it describes changes:
 *     a prepare finished            → invalidatePlans(key)   (PrepareLesson return, plansNonce)
 *     a chapter was attached        → invalidatePlans(key)   (attach / auto-attach paths)
 *     her academic year cut over    → notePlansYear(newYear) clears everything (flags are
 *                                     year-scoped; see the twin note in MyPlans)
 *     sign-out                      → clearPlans() + the prefix sweep
 * Within a session those four cover every way HER flags can move. A change made on ANOTHER
 * device is picked up on the next session load, when the revalidation runs.
 *
 * ★ ONE REVALIDATION PER SESSION PER KEY, NOT ONE PER MOUNT. `fresh` marks a key already checked
 * against the server in this session; later mounts read memory and issue nothing. That is what
 * turns six calls into one. `fetchPlans(key, { force: true })` is the deliberate override the
 * invalidation paths use.
 *
 * ★ FAILURE IS SILENT AND FALLS BACK TO THE STORED COPY, as with the bank: offline or a dead
 * server may not blank a teacher's chapter list. Only a failure with nothing stored rejects,
 * which is the case the callers already handle by showing an empty library.
 *
 * ⚠️ PRIOR-YEAR LISTINGS (`?year_id=…`, the archive folder) do NOT go through this store. They
 * are opened rarely, deliberately, and by definition ask for a different year's answer than the
 * one cached here. They stay direct getJSON calls.
 */

import { API, userKey, withUser } from "./format.js";
import { storage } from "./storage.js";

/* Sign-out sweeps this prefix (signout.js). Keep the two in step. */
export const PLANS_CACHE_PREFIX = "aruvi_plans_";

/* key → { plans, etag, year, fresh } for this session. Module-level ON PURPOSE: surviving
 * unmounts is the whole point. */
const mem = new Map();
const inflight = new Map();

/* The academic year the cached flags belong to. null until a screen tells us (notePlansYear). */
let knownYear = null;

const storeKey = (key) => userKey(`${PLANS_CACHE_PREFIX}${key}`);
const etagKey = (key) => `${storeKey(key)}_etag`;

/* Lift the device copy into memory the first time a key is asked for. */
function hydrate(key) {
  if (mem.has(key)) return mem.get(key);
  let entry = null;
  try {
    const raw = storage.getItem(storeKey(key));
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && Array.isArray(saved.plans)) {
        entry = { plans: saved.plans, etag: saved.etag || "", year: saved.year || null, fresh: false };
      }
    }
  } catch { /* private mode, cleared site data, a mangled entry — treat as nothing stored */ }
  if (entry) mem.set(key, entry);
  return entry;
}

function persist(key, entry) {
  try {
    storage.setItem(storeKey(key), JSON.stringify({ plans: entry.plans, etag: entry.etag, year: entry.year }));
    if (entry.etag) storage.setItem(etagKey(key), entry.etag);
  } catch { /* quota or private mode: this session still has it in memory */ }
}

/* The listing for `key` if we hold one, else null. SYNCHRONOUS by design — screens read this
 * during render so the first paint carries her chapters. Never throws. */
export function cachedPlans(key) {
  if (!key) return null;
  const entry = hydrate(key);
  return entry ? entry.plans : null;
}

/* Fetch the listing unless this session already has a checked copy.
 *
 *   force: true  — re-read from the server regardless (the invalidation paths use this)
 *
 * Resolves with the plan array. Rejects only when the request failed AND nothing is stored. */
export function fetchPlans(key, { force = false } = {}) {
  if (!key) return Promise.resolve([]);
  const entry = hydrate(key);
  if (!force && entry && entry.fresh) return Promise.resolve(entry.plans);
  if (inflight.has(key)) return inflight.get(key);

  const [sSlug, gSlug] = key.split("/");
  const p = (async () => {
    const stored = mem.get(key) || null;
    try {
      const opts = withUser({ headers: {} });
      // Only offer the ETag when we still hold the body it belongs to — an orphaned etag would
      // earn a 304 and leave us with nothing to show (the bank's lesson, same shape).
      if (stored && stored.etag && stored.plans) opts.headers["If-None-Match"] = stored.etag;
      const r = await fetch(`${API}/plans/${sSlug}/${gSlug}`, opts);
      if (r.status === 304 && stored) {
        stored.fresh = true;
        return stored.plans;
      }
      if (!r.ok) throw new Error(`${r.status}`);
      const d = await r.json();
      const next = {
        plans: (d && d.plans) || [],
        etag: r.headers.get("ETag") || "",
        year: knownYear,
        fresh: true,
      };
      mem.set(key, next);
      persist(key, next);
      return next.plans;
    } catch (e) {
      // Offline, CORS, a 5xx — the stored copy stands, unmarked, so the next mount tries again.
      if (stored && stored.plans) return stored.plans;
      throw e;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/* Paint-then-refresh in one call, for the screens that keep the listing in state.
 * `onPlans` is called immediately with the stored copy when there is one (so the first render
 * after it is already populated), and again with the server's answer if it differs. Returns the
 * promise for callers that need to sequence on it. */
export function readPlans(key, onPlans, opts) {
  const cached = cachedPlans(key);
  if (cached && onPlans) onPlans(cached);
  return fetchPlans(key, opts).then((plans) => {
    if (onPlans && plans !== cached) onPlans(plans);
    return plans;
  });
}

/* Drop what we hold for `key` (or everything, with no argument) so the next read goes to the
 * server. Called after a prepare, an attach, or anything else that moves HER flags. */
export function invalidatePlans(key) {
  if (!key) {
    const keys = Array.from(mem.keys());
    mem.clear();
    keys.forEach((k) => {
      try { storage.removeItem(storeKey(k)); storage.removeItem(etagKey(k)); } catch {}
    });
    return;
  }
  mem.delete(key);
  inflight.delete(key);
  try { storage.removeItem(storeKey(key)); storage.removeItem(etagKey(key)); } catch {}
}

/* Tell the store which academic year the current screens are working in. `prepared` and
 * `archived` are YEAR-SCOPED, so a REAL change (known → a different known year, i.e. a cutover)
 * invalidates everything. unknown → known is not a change: it is the year simply arriving, and
 * treating it as one cost an extra request in the ref-based version this replaces. */
export function notePlansYear(year) {
  if (!year) return;
  if (knownYear && knownYear !== year) invalidatePlans();
  knownYear = year;
}

/* Sign-out. The prefix sweep in signout.js catches the storage side; this clears the memory
 * copy, which no prefix sweep can reach. */
export function clearPlans() {
  mem.clear();
  inflight.clear();
  knownYear = null;
}
