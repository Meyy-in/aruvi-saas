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
import { getJSON, getUser, userKey } from "@aruvi/shared/format";
import { storage } from "@aruvi/shared/storage";

let latch = { user: null, ever: false };

const forUser = (u) => { if (latch.user !== u) latch = { user: u, ever: false }; };

/** She just generated — never re-arm for HER. Called by first run's own completion. */
export function markGenerated() {
  const u = getUser();
  latch = { user: u, ever: true };
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
 * ⚠️ WHEN THE TOUR LANDS (8b) THIS BECOMES A SECOND TRIGGER. The tour's own ending is the web's,
 * and two of them would ask her twice. Retire this one there, or gate it on the tour being
 * unavailable — do not leave both firing.
 */
const CHECK_KEY = () => userKey("first_run_check_pending");

/** First run just finished: owe her the check window the next time she opens My Classes. */
export function queueFirstRunCheck() {
  try { storage.setItem(CHECK_KEY(), "1"); } catch {}
}

/** True once, ever — spending the flag as it answers, like `takeSetupCheck`. */
export function takeFirstRunCheck() {
  try {
    if (!getUser() || !storage.getItem(CHECK_KEY())) return false;
    storage.removeItem(CHECK_KEY());
    return true;
  } catch { return false; }
}
