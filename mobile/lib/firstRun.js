/* ───────── has she ever generated? — the activation gate's second half (app. 01 row 15) ─────────
 *
 * The web's `firstGenNeeded` effect (page.jsx:392-439), as a module because the phone's shell is a
 * LAYOUT and the question has to survive the screens under it changing.
 *
 * ★ A DIRECT SUBSCRIBER STILL GETS THE GUIDED FIRST GENERATION (founder, 2026-08-25): checkout
 * creates her default profile, so `ready` is true — but first run is how she LEARNS to generate.
 * Server-derived, never a stored flag: ready + NOTHING ever prepared + NOTHING bound + no PRIOR
 * YEAR = she has never generated.
 *
 * ⚠️ UNKNOWN IS NEVER "YES". A failed fetch must not throw a veteran into the welcome screen, so
 * every uncertain answer resolves false.
 *
 * ⚠️ AND THE ANSWER LATCHES, per teacher. Completing first run flips `ready` false→true, which
 * re-asks the question at the exact moment the serve it fired is still in flight — so the server
 * truthfully answers "nothing prepared, nothing bound" and first run re-arms, bouncing her back to
 * the welcome screen seconds after her first success (found in the web's 2026-08-26 persona run).
 * The question is "has she EVER generated?", and once this session has watched her do it the
 * answer can never revert. The latch is keyed by USER: signing out and in as someone else must not
 * inherit a veteran's latch and suppress the next teacher's first run.
 *
 * ★ THE PRIOR YEAR IS PART OF THE PROOF (cutover, 2026-08-26). Both teaching reads are
 * YEAR-SCOPED, so the morning after a cutover they answer "nothing prepared, nothing bound" —
 * truthfully, the new year is empty — and a ten-year veteran met the guided first run. Last
 * year's folder answers the question the heuristic is actually asking.
 */
import { getJSON, getUser } from "@aruvi/shared/format";

let latch = { user: null, ever: false };

const forUser = (u) => { if (latch.user !== u) latch = { user: u, ever: false }; };

/** She just generated — never re-arm for HER. Called by first run's own completion. */
export function markGenerated() {
  const u = getUser();
  latch = { user: u, ever: true };
}

/* ★ THE LATCH DIES WITH THE SESSION (founder, 2026-09-17, on the handset: deleted 9000000002,
 * signed up again on the same number, and landed on My Classes with a tour running over an
 * account that had no teaching profile at all).
 * ⚠️ IT IS KEYED BY THE MOBILE NUMBER, which is the identity — so a number that ERASES and then
 * signs up again inside the same app run matches a latch set by the account that no longer
 * exists. `hasActivated()` then answers "I watched her finish first run" about a teacher the
 * server has never met, the gate stands down, and she is dropped into an empty app instead of
 * into first run. The server side of the erasure is correct and complete; this was the client
 * remembering across it.
 * `clearSession` is the one choke point both doors pass through — the bar's Log out, Settings'
 * erase, and every 401 branch — so it is the honest place to forget. Worst case on a plain log
 * out is that `firstGenNeeded` asks the server again, which is what it is for. */
export function resetActivation() {
  latch = { user: null, ever: false };
}

/** Has THIS session watched her complete first run? The gate's own latch: her profile is written
 *  through the store before she leaves, but the serve is still in flight, so the heuristic below
 *  would answer "never generated" for a few seconds and bounce her back. */
export function hasActivated() {
  const u = getUser();
  return !!u && latch.user === u && latch.ever;
}

/** true → show first run. Resolves false on any uncertainty. */
export async function firstGenNeeded() {
  const u = getUser();
  if (!u) return false;
  forUser(u);
  if (latch.ever) return false;
  const [p, s, y] = await Promise.all([
    getJSON("/plans-prepared").catch(() => null),
    getJSON("/section-state").catch(() => null),
    getJSON("/academic-year").catch(() => null),
  ]);
  if (latch.ever) return false;                 // she generated while these were in flight
  if (!p || !s) return false;                   // unknown → never force
  const veteran = !!(y && (y.prior_years || []).length > 0);
  const prepared = Object.keys((p && p.prepared) || {}).length > 0;
  const bound = Object.values((s && s.states) || {}).some((st) => st && st.chapter);
  if (prepared || bound || veteran) latch = { user: u, ever: true };
  return !prepared && !bound && !veteran;
}


/* ───────── "are these your sections?" after first run (founder, 2026-09-16) ─────────
 *
 * On the web this window is raised by `finishTour` — the tour's own ending, Done and Skip alike.
 * The phone has no tour until step 8b, so nothing raised it at all: a teacher finished first run,
 * met her first card, and was never shown what Meyy had ASSUMED for her (a section, a periods a
 * week, a year's total) — which is the entire reason the window exists. Founder, having walked it:
 * "the window that pops up after first run did not pop up … since the tour is not built in expo it
 * should have come immediately when My Classes is chosen after first run."
 *
 * So first run leaves a one-shot flag and My Classes spends it. Stored rather than held in memory
 * because she lands on My LESSONS — her lesson is the promise — and may well close the app before
 * she ever taps My Classes; a flag that died with the session would lose the question for good.
 *
 * ★ WHEN THE TOUR LANDS (8b), **THIS ONE STAYS AND THE TOUR'S OWN TRIGGER GOES** (founder,
 * 2026-09-17). Two things would otherwise raise the same window and she would be asked twice.
 * The tour's ending was the web's trigger and is the obvious one to keep — and it is the wrong
 * one, because **it can only fire for a teacher who ran the tour.** A teacher who skips it, or
 * never starts it, was assumed-for exactly as much as one who did: Meyy still picked her a
 * section, a periods a week and a year's total, and the window exists to disclose that. A
 * trigger that misses everyone who declines a tour is not a disclosure.
 * ⚠️ So at 8b: `finishTour` must NOT raise `{mode:"check"}` — delete that clause rather than
 * adding a guard beside it, and leave this one alone. The order still works out: first run
 * queues the flag, My Classes spends it on her first visit, and the tour is offered after that.
 */
/* Moved to `@aruvi/shared/setupCheck` on 2026-09-18 so the web runs the same one-shot (same storage key,
   so a flag queued before the move is still spent). Re-exported so first-run.jsx and index.jsx are unchanged. */
export { queueFirstRunCheck, takeFirstRunCheck } from "@aruvi/shared/setupCheck";
