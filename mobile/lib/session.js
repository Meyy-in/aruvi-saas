/* ───────── Ending the session is ONE act (2026-09-13) ─────────
 *
 * Sign out, and a 401 from the server, are the same thing seen from two sides: the account this
 * device holds is no longer usable. Both must clear EVERYTHING per-teacher — a phone is more
 * often shared than a laptop, and the identity is a mobile number, so a leftover cache is
 * another teacher's record on the next sign-in (packages/shared/src/signout.js).
 *
 * It lives here rather than in a screen because two places now need it: the bar's Log out, and
 * My Classes' 401 branch. The web learnt the same lesson — its `onSignOut` in page.jsx is the
 * single function both its doors call.
 *
 * ⚠️ ONLY a refusal ends a session. An unreachable server is not a refusal, and signing a
 * teacher out mid-lesson because a school network dropped is worse than the bug this fixes.
 */
import { signOutAuth } from "@aruvi/shared/auth";
import { clearTeacherCaches } from "@aruvi/shared/signout";

/* The web's own extra prefixes, kept in step with page.jsx's onSignOut. */
const EXTRA = ["setup_check_pending_", "mylessons_subject_", "mylessons_class_", "allocations_"];

/* ★ EVERY CALLER NAMES ITSELF, and that is not decoration (2026-09-16). A teacher was found
 * signed out mid-session with no way to tell which of the six doors had done it: the bar's Log
 * out, Settings' row, or one of four 401 branches, all landing on the same screen with the same
 * empty storage behind them. `reason` costs one argument and turns "she got logged out" into a
 * line that says which code path decided that, which is the difference between a bug you can fix
 * and one you can only re-observe.
 * ⚠️ It is a `warn`, not a `log`: ending a session is never routine. */
export async function endSession(router, reason = "unknown") {
  await clearSession(reason);
  router.replace("/login");
}

/* ★ THE SAME ACT WITHOUT THE NAVIGATION (6b·H, 2026-09-16). An ERASURE has to clear the device
 * the moment the receipt arrives — the account no longer exists — but the farewell must stay on
 * screen to be read, so this half cannot move her. The web learnt it live on 2026-09-13: its
 * farewell was the only thing between a deleted account and the shell, and the Settings bar's ✕
 * sat directly above it knowing nothing, so closing that way returned her to a fully-rendered My
 * Classes for an account the server had already destroyed. The receipt is the moment of death;
 * "Done" is only the way out of the room. */
export async function clearSession(reason = "unknown") {
  console.warn(`[meyy] session ended — ${reason}`);
  await signOutAuth();
  clearTeacherCaches(EXTRA);
}
