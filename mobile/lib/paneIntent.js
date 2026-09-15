/* ───────── "come back to the pane I was reading" — one shot (Track D step 5c) ─────────
 *
 * My Lessons opens on "Your lessons" on every ordinary visit (founder, 2026-08-29): a teacher
 * who checked the Year Plan yesterday should not find the repository hiding behind it today. So
 * the pane is deliberately NOT persisted.
 *
 * ★ THE ONE EXCEPTION IS THE BUDGET PENCIL'S ROUND TRIP. She taps it FROM the Year Plan; if the
 * return landed on the card list the pencil would be a one-way door out of the very pane it
 * belongs to. The web solved this with a one-shot ref in page.jsx, above the tab. The phone's
 * screens are ROUTES with nothing above them — the same gap `lib/preparing.js` fills for the
 * proposed card — so this is the same shape: a module-level stamp, consumed by the My Lessons
 * remount, gone the moment it is read.
 *
 * ⚠️ CONSUMED, NOT MERELY READ. `takePane()` clears as it returns, which is what makes it
 * one-shot: without that, every later arrival at My Lessons would keep landing on the plan and
 * the exception would quietly become the rule — the persistence that was retired, restored by
 * accident. It is also why this is not a route PARAM: a param stays on the route, so the ordinary
 * /lessons → /lesson → back would re-read it and re-steer her.
 *
 * The web's `goClasses` clears the stamp for the same reason — a detour through My Classes is an
 * ordinary visit, not the round trip. Here the stamp is only ever set one navigation before it is
 * read, so there is no interval in which a detour could happen; `clearPane` exists for the day
 * that stops being true.
 */

let pending = null;   // "lessons" | "plan" | null

export function stampPane(pane) { pending = pane || null; }

/* Read AND clear. Call once, from the screen that acts on it. */
export function takePane() {
  const p = pending;
  pending = null;
  return p;
}

export function clearPane() { pending = null; }
