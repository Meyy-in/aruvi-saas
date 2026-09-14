/* ───────── the teaching profile, fetched once per device and shared by every screen ─────────
 *
 * ★ WHY THIS FILE EXISTS (founder-reported delay, 2026-09-14). "Web My Classes / My Lessons is
 * instantaneous but on Expo, when I click My Classes, it first shows 'Loading your classes' which
 * takes a second." The cause is structural, and it is worth stating plainly because it will recur
 * on every screen the phone gains:
 *
 *   ON THE WEB these two are COMPONENTS inside one shell. `page.jsx` fetches /readiness once per
 *   sign-in and passes it down, so crossing between them is a re-render.
 *   ON THE PHONE they are ROUTES. Each one mounts with nothing and asks the server itself, so
 *   every crossing paid a full round trip — and on a school network that round trip IS the wait.
 *
 * This is the same defect the plan listing had a day earlier, and it gets the same answer, in the
 * same shape, deliberately: `plans.js` is the model this file follows line for line.
 *
 * ★ THE PROFILE IS THE RIGHT THING TO KEEP. It is the most stable record a teacher has — her
 * subjects, classes and sections change a few times a year, not a few times an hour — and it is
 * what BOTH screens need before they can draw anything at all. My Classes builds one card per
 * section from it; My Lessons builds both wheels from it. So a screen without it has nothing
 * honest to show, which is why the loading gate was correct and the fetch was not.
 *
 * ★ THREE THINGS, IN ORDER OF HOW MUCH THEY MATTER (the plans store's list, and for the same
 * reasons):
 *
 *   1. ONE COPY, OUTSIDE REACT. Module-level, so it OUTLIVES every mount. The second screen to
 *      ask gets the first screen's answer for free, and so does the same screen on its next visit.
 *
 *   2. A DEVICE COPY, SO THE FIRST PAINT IS INSTANT. `cachedReadiness()` is SYNCHRONOUS and may
 *      be read during render, so a returning teacher sees her classes before the network is
 *      consulted at all. ★ This is the half that actually removes the WAITING — the plans work
 *      measured it and wrote it down: on a Chennai→Singapore link the bill is latency, not
 *      payload, so a device copy that lets the screen draw early beats any amount of shrinking
 *      the response. There is no ETag here because there would be nothing to gain from one:
 *      GET /readiness sends no validator, and the trip happens behind a painted screen anyway.
 *
 *   3. ONE REVALIDATION PER SESSION. `fresh` marks a profile already checked against the server
 *      in this session; later mounts read memory and issue nothing.
 *
 * ★ THE COPY IS PER TEACHER, AND MUST BE. It is her profile, so the key is stamped with
 * `userKey()` and READINESS_CACHE_PREFIX is in TEACHER_CACHE_PREFIXES — a shared staffroom phone
 * must never show the last teacher's classes.
 *
 * ★ INVALIDATION. The profile moves only when SHE changes it, and on the phone she cannot yet —
 * the profile portal is Track D step 5. `invalidateReadiness()` exists so that step is a one-line
 * wiring rather than a bug: call it after any profile write (add/remove a subject, class or
 * section, rename a section, change periods a week or the budget), exactly as the web's paths
 * call `invalidatePlans`. A change made on ANOTHER device is picked up on the next session load,
 * when the revalidation runs — the same contract the plan listing gives.
 *
 * ★ FAILURE IS SILENT AND FALLS BACK TO THE STORED COPY. Offline or a dead server may not blank
 * a teacher's class list; only a failure with nothing stored rejects, which is the case the
 * callers already handle. ⚠️ But a 401 is NOT a failure to fall back from — it is the server
 * refusing the session — so it is rethrown unchanged for the caller's sign-out path to catch.
 * Swallowing it here would leave an erased account rendering its own cached classes for ever,
 * which is the exact defect My Classes' header already warns about.
 */

import { getJSON, userKey } from "./format.js";
import { storage } from "./storage.js";

/* Sign-out sweeps this prefix (signout.js). Keep the two in step. */
export const READINESS_CACHE_PREFIX = "aruvi_readiness_";

/* { profile, ready, fresh } for this session. Module-level ON PURPOSE: surviving unmounts is the
 * whole point. */
let mem = null;
let inflight = null;

const storeKey = () => userKey(READINESS_CACHE_PREFIX);

/* Lift the device copy into memory the first time it is asked for. */
function hydrate() {
  if (mem) return mem;
  try {
    const raw = storage.getItem(storeKey());
    if (raw) {
      const saved = JSON.parse(raw);
      // A profile is an object with subjects[]; anything else is a mangled entry.
      if (saved && saved.profile && Array.isArray(saved.profile.subjects)) {
        mem = { profile: saved.profile, ready: !!saved.ready, fresh: false };
      }
    }
  } catch { /* private mode, cleared site data, a mangled entry — treat as nothing stored */ }
  return mem;
}

function persist(entry) {
  try {
    storage.setItem(storeKey(), JSON.stringify({ profile: entry.profile, ready: entry.ready }));
  } catch { /* quota or private mode: this session still has it in memory */ }
}

/* Her profile if we hold one, else null. SYNCHRONOUS by design — screens read this during render
 * so the first paint carries her classes. Never throws. */
export function cachedReadiness() {
  const entry = hydrate();
  return entry ? entry.profile : null;
}

/* The `ready` flag beside it (a saved profile with at least one subject), or false. */
export function cachedReady() {
  const entry = hydrate();
  return entry ? entry.ready : false;
}

/* Fetch the profile unless this session already has a checked copy.
 *
 *   force: true  — re-read from the server regardless (the invalidation paths use this)
 *
 * Resolves with the profile (or null when she has none). Rejects only when the request failed AND
 * nothing is stored — or when the server REFUSED the session (401), which is never fallen back
 * from. */
export function fetchReadiness({ force = false } = {}) {
  const entry = hydrate();
  if (!force && entry && entry.fresh) return Promise.resolve(entry.profile);
  if (inflight) return inflight;

  const p = (async () => {
    const stored = mem;
    try {
      const d = await getJSON("/readiness");
      const next = {
        profile: (d && d.readiness) || null,
        ready: !!(d && d.ready),
        fresh: true,
      };
      mem = next;
      persist(next);
      return next.profile;
    } catch (e) {
      /* ⚠️ A 401 is the server REFUSING this session, not a network failure — the caller signs
         her out on it, and a cached profile must never stand in for a refused identity. */
      if (String(e && e.message) === "401") throw e;
      if (stored && stored.profile) return stored.profile;
      throw e;
    } finally {
      inflight = null;
    }
  })();
  inflight = p;
  return p;
}

/* Drop what we hold so the next read goes to the server. Call after ANY write to the profile —
 * a subject, class or section added or removed, a section renamed, periods a week or the budget
 * changed. The web's equivalent paths call invalidatePlans for the same reason. */
export function invalidateReadiness() {
  mem = null;
  inflight = null;
  try { storage.removeItem(storeKey()); } catch {}
}

/* Sign-out. The prefix sweep in signout.js catches the storage side; this clears the memory
 * copy, which no prefix sweep can reach. */
export function clearReadiness() {
  mem = null;
  inflight = null;
}

/* ───────── entitlement, kept off the critical path ─────────
 * Not a cache with a device copy — her trial counter genuinely moves as she prepares chapters,
 * and it feeds one status line at the foot of My Classes. The only thing wrong with it was
 * WHERE it was awaited: My Classes held the whole screen behind it before asking for the
 * profile, so a small, unimportant response sat in front of the one the screen cannot draw
 * without. The fix is sequencing, not storage — see the load in app/(app)/index.jsx — and this
 * note is here so the next person does not "fix" it by caching a counter that must stay live.
 */
