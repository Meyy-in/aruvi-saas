/* ───────── her subscription, and the rules that hang off it (Track D 6a F5, 2026-09-16) ─────────
 *
 * ★ WHY A STORE AND NOT A FETCH (founder's Q7 answer, 2026-09-16: "port now, let the server flag
 * drive it"). The phone asked `/entitlement` in three places for three different reasons — My
 * Classes for its status line, Prepare for the free-chapter counter, first run for its trial card
 * — and derived NOTHING from the answer. So every consequence the web hangs off a lapsed
 * subscription (the reading room: My Lessons only, My Classes and Add out of the bar, the prepare
 * CTA gone, the profile read-only) was simply absent here, and would have stayed absent on the day
 * enforcement is switched on at Render, because nothing on the phone was watching.
 *
 * ★ IT IS THE OPPOSITE OF `readiness.js`, ON PURPOSE, AND THE DIFFERENCE IS THE POINT.
 * A teaching profile is the most stable record she has, so that store revalidates ONCE per session
 * and is otherwise read from memory. A subscription is the least stable: it can be revoked in a
 * terminal while she is looking at the screen (founder, 2026-08-24 — he revokes and switches back
 * to the phone to watch). So this one is POLLED, on the web's own cadence: on mount, whenever the
 * app comes back to the foreground, and every 20 seconds while it is there. The server's 402s are
 * the authority regardless; the poll is only what keeps the UI from lying in between.
 * ⚠️ The cadence wiring is NOT in here. `AppState` is react-native and this package is imported by
 * the web too — the layer that owns the app's lifecycle owns the timer, and calls `syncEntitlement`.
 *
 * ★ THE DEVICE COPY PAINTS THE FIRST FRAME, AND IS NEVER THE LAST WORD. The web needs none: its
 * tab stays open. A phone COLD-STARTS, so without a stored copy a lapsed teacher relaunches, meets
 * My Classes and Add for as long as the round trip takes, and has them vanish under her thumb —
 * the worst version of this screen, and one only the phone can produce. So the last answer is
 * kept and the first paint uses it. It is a HINT: the moment the server replies, the server wins,
 * whichever way it goes. That is the app's "paint first, then check" doctrine (the activation
 * gate in `(app)/_layout.jsx` states it in full), applied to the one record that changes hourly.
 *
 * ★ THE DERIVATIONS LIVE IN `format.js` AND ARE NOT RE-SPELLED HERE. `entLapsed` and
 * `paidScopesOf` were lifted there on 2026-09-15, the day the founder found the phone offering a
 * teacher classes she had not bought. This file OWNS THE COPY; those two own the MEANING
 * (CLAUDE.md §3). The one derivation added here is `entTrial`, which had been spelled inside
 * page.jsx alone — and the phone's first run had quietly grown a THIRD spelling of `paidScopesOf`
 * that read `scopes` where the rule says `live_scopes`, which is exactly the drift §3 exists to
 * stop. It now calls the rule like everyone else.
 */

import { fetchEntitlement as getEntitlement, entLapsed, paidScopesOf, userKey } from "./format.js";
import { invalidateAccount } from "./account.js";
import { storage } from "./storage.js";

/* Sign-out sweeps this prefix (signout.js). Keep the two in step. */
export const ENTITLEMENT_CACHE_PREFIX = "aruvi_entitlement_";

let mem = null;          // the last entitlement object we have, server-fresh or stored
let inflight = null;

const storeKey = () => userKey(ENTITLEMENT_CACHE_PREFIX);

const listeners = new Set();
function emit() {
  const st = entitlementState();
  listeners.forEach((fn) => { try { fn(st); } catch {} });
}

/* Fires IMMEDIATELY with the state in hand, so a screen mounting mid-session gets the current
 * answer rather than waiting for the next poll. Returns an unsubscribe. */
export function subscribeEntitlement(fn) {
  listeners.add(fn);
  try { fn(entitlementState()); } catch {}
  return () => listeners.delete(fn);
}

function hydrate() {
  if (mem !== null) return mem;
  try {
    const raw = storage.getItem(storeKey());
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") mem = saved;
    }
  } catch { /* private mode, cleared data, a mangled entry — treat as nothing stored */ }
  return mem;
}

function persist(e) {
  try {
    if (e) storage.setItem(storeKey(), JSON.stringify(e));
    else storage.removeItem(storeKey());
  } catch { /* quota, private mode — this session still holds it in memory */ }
}

/* Her entitlement if we hold one, else null. SYNCHRONOUS: the shell reads it during render. */
export function cachedEntitlement() {
  return hydrate();
}

/* ★ TRIAL IS WHAT HER RECORD SAYS, NOT WHETHER THE GATE IS ON (web, 2026-09-11). This used to
 * require `e.enforced`, so on the deployed API — where enforcement is OFF for the beta, by
 * design — NO teacher was ever "on trial": Subscription & billing offered no Subscribe button
 * and Personal profile showed to a trial account. Found by the founder on 9000000003.
 * ★ Enforcement decides what is REFUSED; the status decides what is TRUE. */
export function entTrial(e) {
  if (!e) return false;
  return e.status === "trial" || e.plan_id === "trial";
}

/* The whole derived answer, in the shape a screen wants it. Never throws, never null:
 * an unreachable server means "nothing is known", and nothing known must read as NOT lapsed —
 * losing a connection is not a reason to take her classes away. */
export function entitlementState() {
  const e = hydrate();
  return {
    ent: e,
    lapsed: entLapsed(e),
    trial: entTrial(e),
    paidScopes: paidScopesOf(e),
  };
}

/* Re-read from the server and tell everyone watching. Resolves with the derived state; it never
 * rejects, because every caller of this is a cadence (a mount, a foreground, a timer) and a
 * failed poll is not an event any screen should handle.
 *
 * ⚠️ A 401 is the server REFUSING this session. It is NOT swallowed into "no change": the caller
 * signs her out on it, exactly as the readiness store's does, and a stored subscription must
 * never stand in for a refused identity. `onUnauthorized` is how that reaches the app without
 * this file importing a router. */
export function syncEntitlement({ onUnauthorized } = {}) {
  if (inflight) return inflight;
  const p = (async () => {
    const before = hydrate();
    let e;
    try {
      e = await getEntitlement();          // format.js swallows everything into null…
    } catch (err) {                        // …but a future transport may not, so both are handled
      if (String(err && err.message) === "401" && onUnauthorized) onUnauthorized();
      return entitlementState();
    }
    /* null is "unreachable", not "no subscription" — keep what we hold. A dropped connection
       must never hide My Classes. */
    if (e == null) return entitlementState();

    mem = e;
    persist(e);

    /* ★ HER NAME IS CAPTURED AT THE MOMENT HER SUBSCRIPTION CHANGES, so this is when to go and
       look again. On the web that is `entSyncTick` — SubscribeFlow bumps a counter and the
       `/account` effect re-runs. The phone has no subscribe flow (purchases are manual grants
       today), so nothing would ever bump it: the POLL is the phone's notice. A status or scope
       change is precisely the event the web's tick stands for, so it does the same work here.
       ⚠️ Compared, not fired every poll — invalidating on a 20-second timer would re-fetch
       `/account` three times a minute for a teacher whose name has not changed since April. */
    if (before && (before.status !== e.status
                   || JSON.stringify(before.live_scopes || before.scopes || [])
                      !== JSON.stringify(e.live_scopes || e.scopes || []))) {
      invalidateAccount();
    }
    emit();
    return entitlementState();
  })().finally(() => { inflight = null; });
  inflight = p;
  return p;
}

/* Drop what we hold so the next sync goes to the server — after anything that could change her
 * subscription from inside the app. */
export function invalidateEntitlement() {
  mem = null;
  inflight = null;
  persist(null);
  emit();
}

/* Sign-out. The prefix sweep in signout.js catches storage; this clears the memory copy, which
 * no prefix sweep can reach. */
export function clearEntitlement() {
  mem = null;
  inflight = null;
}
