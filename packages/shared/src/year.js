/* ───────── the academic year, and the cutover she is offered (Track D 6a F6, 2026-09-16) ─────────
 *
 * ★ THE YEAR TURNS ON ITS OWN; THE CLASSES DO NOT. Meyy rolls the academic year over on its own
 * date, server-side. What is left is hers: whether to clear last year's tracking so the new
 * cohort meets empty section cards. So `cutover_due` is an OFFER and never a timer — a teacher
 * still finishing a chapter in early June must not find her pointers wiped from under her.
 *
 * ★ AND `cutover_due` IS COMPUTED SERVER-SIDE, NEVER FROM THE CLOCK ON THIS DEVICE. A teacher can
 * change a phone's date, and a phone carried across a timezone is wrong without anyone changing
 * anything. The client asks; it does not decide.
 *
 * ★ THE STORE EXISTS BECAUSE THE PHONE IS ROUTES. On the web this is page.jsx state passed down
 * to two components. Here My Classes is a route that remounts on every crossing, so the year, the
 * in-flight cutover and its result all have to outlive a mount — `readiness.js`'s shape, third
 * time (`plans`, `readiness`, `entitlement`, now this).
 *
 * ★ WHAT A CUTOVER INVALIDATES, AND WHY EACH ONE IS NAMED HERE RATHER THAN AT THE CALLER. Her
 * year changed, so every year-scoped read on this device is stale, and two of them CANNOT
 * self-heal:
 *   · `clearLocalSectionCache()` — `pullSectionState` refuses to delete on a wholesale-empty
 *     server response (its anti-corruption guard), and after a cutover the new year is
 *     legitimately empty. Without this, My Classes goes on reading "Teaching now Ch 5" out of
 *     device storage while the server holds no such row. ⚠️ FOUND LIVE on the web.
 *   · `clearLocalHistoryCache()` — the pull UNIONS, so it can never delete a local row on its
 *     own, and every card would keep wearing last cohort's trail.
 * `invalidatePlans()` is the third, and that one `notePlansYear` would eventually catch; it is
 * done here anyway, because "eventually" is a screen showing last year's list in the meantime.
 *
 * ⚠️ THE DISMISSAL IS NOT PERSISTED, and that is the founder's answer to Q17 (2026-09-16),
 * chosen over per-day and once-then-never: the offer returns on the next LAUNCH, every launch,
 * until she acts. A phone is rarely signed out, so this is the most insistent of the three — and
 * an undone decision with a deadline should be. A stored "don't ask again" would quietly strand a
 * teacher in last year, and until Settings grows a door to the cutover there would be no way back.
 * ⚠️ AND IT IS KEYED TO THE TEACHER. On the web, sign-out is not a remount: a "session-only" flag
 * outlived the session it belonged to AND the teacher too, so the next person to sign in on that
 * tab inherited her dismissal (founder, live, 2026-08-26). Module state on the phone has exactly
 * the same property, so the same rule applies — any state holding a per-teacher answer is keyed
 * to the teacher.
 */

import { getJSON, postJSON, getUser } from "./format.js";
import { clearLocalSectionCache, pullSectionState } from "./sectionState.js";
import { clearLocalHistoryCache } from "./sectionHistory.js";
import { invalidatePlans, notePlansYear } from "./plans.js";
import { invalidateReadiness, fetchReadiness } from "./readiness.js";

let state = { user: null, info: null, busy: false, result: null, dismissed: false };
let inflight = null;

const listeners = new Set();
function emit() {
  const snap = { ...state };
  listeners.forEach((fn) => { try { fn(snap); } catch {} });
}

/* Fires IMMEDIATELY with what is in hand. Returns an unsubscribe. */
export function subscribeYear(fn) {
  listeners.add(fn);
  try { fn({ ...state }); } catch {}
  return () => listeners.delete(fn);
}

export function yearState() { return { ...state }; }

/* ⚠️ Called at the top of every read and write below. An identity that changed without passing
 * through sign-out (a deep link, a restored session, a second teacher on a staffroom phone) must
 * not inherit the previous one's dismissal, result or year. */
function forUser() {
  const u = getUser();
  if (state.user !== u) state = { user: u, info: null, busy: false, result: null, dismissed: false };
  return u;
}

/* Re-read the year. Cheap and idempotent; called on mount and whenever the app returns to the
 * foreground, so a teacher who leaves the app open across midnight on 1 June is offered it
 * without relaunching. Never throws — an unreachable server simply offers nothing, which is the
 * right failure: no offer is always safe, a wrong offer is not. */
export function fetchYear() {
  forUser();
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const y = await getJSON("/academic-year");
      if (y) {
        state = { ...state, info: y };
        /* The plan store is year-scoped and wants to hear about this from whoever learns it
           first, which is here. A known → different known year invalidates; unknown → known is
           just the year arriving, and is not a change. */
        notePlansYear(y.current_year);
        emit();
      }
    } catch { /* offer nothing */ }
    return { ...state };
  })().finally(() => { inflight = null; });
  inflight = p;
  return p;
}

/* Whether the offer should be on screen: the server says it is due, she has not dismissed it
 * this launch, and no result card is standing in its place.
 * ⚠️ `cleanup_due ?? cutover_due` — the newer field wins, the older one is the fallback for a
 * server that predates it. The web spells the same pair. */
export function cutoverOffered() {
  const { info, result, dismissed } = state;
  if (!info || result || dismissed) return false;
  return !!(info.cleanup_due ?? info.cutover_due);
}

/* "Not yet" / ✕ — this launch only, deliberately. See Q17 in the header. */
export function dismissCutover() {
  forUser();
  state = { ...state, dismissed: true };
  emit();
}

/* "Got it" on the result card. */
export function dismissCutoverResult() {
  forUser();
  state = { ...state, result: null };
  emit();
}

/* ★ THE CUTOVER ITSELF. Everything it clears is listed in this file's header with the reason it
 * cannot self-heal. `onDone` lets the app latch its own first-generation heuristic: she has just
 * emptied her current year ON PURPOSE, so she is emphatically not a new teacher and the gate must
 * never re-arm on the way out. */
export function runCutover({ onDone } = {}) {
  forUser();
  if (state.busy) return Promise.resolve({ ...state });
  state = { ...state, busy: true };
  emit();

  /* ⚠️ `busy` IS CLEARED BEFORE THE RETURN VALUE IS BUILT, and the first draft of this got it
     wrong: with the clear in a `.finally()`, every branch returned a snapshot spread while
     `busy` was still true, so a caller that awaited this held a state saying the cutover was
     still running forever. Subscribers were fine — `emit()` fires after — which is exactly what
     would have made it invisible until someone read the resolved value. Caught by its own test. */
  const settle = () => { state = { ...state, busy: false }; emit(); return { ...state }; };

  return postJSON("/academic-year/cutover", { confirm: true })
    .then(async (res) => {
      state = { ...state, result: res || null };
      clearLocalSectionCache();
      clearLocalHistoryCache();
      invalidatePlans();
      invalidateReadiness();
      if (onDone) { try { onDone(); } catch {} }
      /* Both of these are year-scoped and have just changed underneath her, so they are re-read
         BEFORE the screen redraws rather than left to the next mount. Neither is allowed to fail
         the cutover: it has already happened on the server. */
      await Promise.all([
        pullSectionState().catch(() => {}),
        fetchReadiness({ force: true }).catch(() => {}),
      ]);
      const y = await getJSON("/academic-year").catch(() => null);
      if (y) { state = { ...state, info: y }; notePlansYear(y.current_year); }
      return settle();
    })
    .catch(() => {
      /* ⚠️ A failed cutover shows NO result card. The card states what happened as fact, and
         nothing happened; the offer simply stands, which is the honest screen. */
      state = { ...state, result: null };
      return settle();
    });
}

/* Sign-out. */
export function clearYear() {
  state = { user: null, info: null, busy: false, result: null, dismissed: false };
  inflight = null;
}
