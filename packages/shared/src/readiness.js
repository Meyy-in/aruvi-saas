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

import { API, getJSON, userKey, withUser } from "./format.js";
import { verifiedWrite, readinessFingerprint } from "./verify.js";
import { storage } from "./storage.js";

/* Sign-out sweeps this prefix (signout.js). Keep the two in step. */
export const READINESS_CACHE_PREFIX = "aruvi_readiness_";

/* { profile, ready, fresh } for this session. Module-level ON PURPOSE: surviving unmounts is the
 * whole point. */
let mem = null;
let inflight = null;

const storeKey = () => userKey(READINESS_CACHE_PREFIX);

/* ───────── who is watching the profile (Track D step 5d item 10, 2026-09-16) ─────────
 * The check window's queue is fed by DIFFING her profile against the last one seen, and the web
 * can do that in a `useEffect` because `readiness` is page-level state there. On the phone the
 * profile is this module, so a screen that wants to know it CHANGED has to be told. Same shape as
 * `lib/preparing` and `lib/portal` on the app side, for the same reason.
 * ⚠️ Best-effort, like everything around it: a listener that throws must not break a save. */
const listeners = new Set();
function emit() {
  const profile = mem ? mem.profile : null;
  listeners.forEach((fn) => { try { fn(profile); } catch {} });
}

/* Fires IMMEDIATELY with the profile in hand (or null), so a subscriber mounting mid-session sees
 * the current one rather than waiting for the next write. Returns an unsubscribe. */
export function subscribeReadiness(fn) {
  listeners.add(fn);
  try { fn(mem ? mem.profile : null); } catch {}
  return () => listeners.delete(fn);
}

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
      let next = {
        profile: (d && d.readiness) || null,
        ready: !!(d && d.ready),
        fresh: true,
      };
      /* WALK-A-020: the server has nothing, but this device holds a profile whose write was never
         confirmed — her first run. Keep her on it and send it again, rather than handing her
         first run a second time. */
      const pending = (!next.profile || !(next.profile.subjects || []).length) ? readPending() : null;
      if (pending) {
        next = { profile: { subjects: pending }, ready: true, fresh: true };
        saveReadiness(pending).catch(() => {});
      }
      mem = next;
      persist(next);
      emit();
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

/* ───────── THE ONE WAY A PROFILE IS WRITTEN (F1, Track D step 5d, 2026-09-15) ─────────
 *
 * Every edit a teacher makes to her teaching record — a subject, a class, a section, its name,
 * periods a week, the period lengths, the annual budget — ends here. The web has done this inline
 * in `TeachingProfile.jsx` since 2026-08-10; the phone needs the same act from a dozen screens,
 * and a write duplicated a dozen times is a write that will drift in one of them.
 *
 * ★ READ-AFTER-WRITE (founder doctrine, 2026-08-10; verify.js). X is the profile before this
 * edit · A is this save · Y is `subjects`, which the CALLER just composed and which we therefore
 * know upfront · Y′ is GET /readiness. Error IF AND ONLY IF Y′ ≠ Y.
 *   ⚠️ The POST throwing is NOT a criterion. A 200 can lie, and a lost response can hide a write
 *   that landed — so the request's own outcome is evidence about the network, not about her data.
 *   ⚠️ And an unreachable server is NOT an error. It is a state in which the check cannot be RUN,
 *   and reporting failure there would invent a fact about her profile. Hence THREE outcomes:
 *     · "ok"          — Y′ === Y. The write is real. Silence.
 *     · "unverified"  — the read could not be made. Also silence: we do not know, and saying so
 *                       would be a guess dressed as a finding.
 *     · "mismatch"    — Y′ ≠ Y, and Y′ IS THE TRUTH. The caller must adopt `actual` and say so.
 *                       Leaving her edit on screen while telling her it failed would recreate the
 *                       exact divergence this check exists to catch.
 *
 * `cascade: true` rides along because every destructive edit upstream is already behind its own
 * scoped confirm; without it the server's 409 guard would ask a second time for the same act.
 *
 * ★ THE STORE IS WRITTEN THROUGH, NOT INVALIDATED, on ok and unverified. Invalidating would send
 * the very next screen to the network for a profile we are holding in our hand, and on a phone
 * that is a spinner in front of a teacher who just pressed Save. On MISMATCH the server's copy is
 * adopted instead — the same write-through, with the other array.
 */
/* ★ TAKE THIS PROFILE AS THE TRUTH, NOW — the optimistic half of a write (2026-09-16).
 * `saveReadiness` adopts when the round trip resolves, which is right for an edit: she is looking
 * at the screen and nothing depends on the store in the meantime. ACTIVATION is different. First
 * run composes her first profile and then LEAVES, in the same tick, for a shell whose gate asks
 * "does she have a profile?" and whose My Lessons reads her subjects to scope its wheels — so a
 * store that is still empty for the length of a round trip bounces her back to the welcome screen
 * she just finished. The web has no such gap because `setReadiness` is a state call; this is that
 * call. The verified write still runs behind it and still adopts the SERVER's copy on a mismatch.
 */
export function adoptReadiness(subjects, ready) {
  const profile = { subjects: subjects || [] };
  mem = { profile, ready: ready != null ? ready : (subjects || []).length > 0, fresh: true };
  persist(mem);
  emit();
  return profile;
}

/* ★ AN UNVERIFIED PROFILE WRITE IS KEPT AND RETRIED (WALK-A-020, 2026-09-20 — the web's fix,
 * now the phone's). First run finished with the network off: the POST never landed, the check
 * came back "unverified" (correctly silent — we could not know), and the shell opened on a
 * profile that lived only in memory. The next launch asked the server, heard "no profile", and
 * put her back in first run. So an unverified write is stored as PENDING for this teacher and
 * re-sent: on a timer while the app is open, and on the next read that finds the server empty.
 * "unverified" still says nothing to her — the doctrine is untouched; we simply do not give up. */
function pendingKey() { return `${storeKey()}__pending`; }
function readPending() {
  try { const raw = storage.getItem(pendingKey()); const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) && v.length ? v : null; } catch { return null; }
}
function writePending(subjects) {
  try {
    if (subjects) storage.setItem(pendingKey(), JSON.stringify(subjects));
    else storage.removeItem(pendingKey());
  } catch {}
}
let retryTimer = null;
function scheduleRetry(subjects, attempt) {
  if (attempt >= 40 || retryTimer) return;
  retryTimer = setTimeout(() => { retryTimer = null; saveReadiness(subjects, attempt + 1); }, 15000);
}

export async function saveReadiness(subjects, attempt = 0) {
  if (attempt === 0) writePending(subjects);
  // Static imports: verify.js pulls in nothing from here, so there is no cycle to dodge and no
  // reason to make a phone's first save wait on a dynamic module fetch.
  const want = readinessFingerprint(subjects);

  const { status, actual } = await verifiedWrite({
    write: () => fetch(`${API}/readiness`, withUser({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjects, cascade: true }),
    })).then((r) => { if (!r.ok) throw new Error(String(r.status)); }),
    read: () => getJSON("/readiness").then((d) => (d && d.readiness) || d || {}),
    expect: (y) => readinessFingerprint(y && y.subjects) === want,
  });

  if (status === "unverified") {
    scheduleRetry(subjects, attempt);      // kept as pending; nothing is said to her
    return { status, profile: adoptReadiness(subjects) };
  }
  writePending(null);                      // the server answered — ok or mismatch, it is settled
  if (status === "mismatch") {
    const server = (actual && actual.subjects) || [];
    return { status, profile: adoptReadiness(server) };
  }
  return { status, profile: adoptReadiness(subjects) };
}

/* ───────── entitlement, kept off the critical path ─────────
 * Not a cache with a device copy — her trial counter genuinely moves as she prepares chapters,
 * and it feeds one status line at the foot of My Classes. The only thing wrong with it was
 * WHERE it was awaited: My Classes held the whole screen behind it before asking for the
 * profile, so a small, unimportant response sat in front of the one the screen cannot draw
 * without. The fix is sequencing, not storage — see the load in app/(app)/index.jsx — and this
 * note is here so the next person does not "fix" it by caching a counter that must stay live.
 */
