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

export async function endSession(router) {
  await signOutAuth();
  clearTeacherCaches(EXTRA);
  router.replace("/login");
}
