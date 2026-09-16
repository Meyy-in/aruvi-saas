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
