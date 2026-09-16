/* ───────── sign-out: clear EVERY per-teacher cache on this device (2026-09-11) ─────────
 *
 * The live product check on the production stack (MEMORY.md 2026-09-11) found the web's
 * sign-out leaving `current_chapter_*`, `lu_*` and `chapter_notes_*` behind — each store had
 * its own clear function and page.jsx called some of them. A phone is more often shared than
 * a laptop (a staffroom device, a family phone), and the identity is the mobile number, so a
 * leftover cache is another teacher's record on the next sign-in. One function, called by
 * both apps' sign-out, that names every prefix this package (and the screens) write:
 *
 *   aruvi_user               the signed-in id (format.js)
 *   current_chapter_ lu_*    section state incl. bookmarks (sectionState.js)
 *   section_history_ + owner section chapter ledger (sectionHistory.js)
 *   chapter_notes_           the notes editor's optimistic cache (LessonView / web page.jsx)
 *   aruvi_ask_bank(_etag)    the Ask Meyy bank (ask-aruvi/bank.js)
 *   aruvi_entitlement_       her subscription (entitlement.js) — what the shell hides on a lapse
 *   aruvi_plans_            the per-subject·class plan listing, with her prepared flags (plans.js)
 *   sb-…-auth-token          supabase-js's own session, when the app gave it the same storage
 *
 * `extraPrefixes` lets an app add keys only it writes (the web's per-user `userKey()` caches
 * such as the profile-portal queue). Returns the number of keys removed. Never throws. */
import { removeByPrefix, storage } from "./storage.js";
import { clearLocalSectionCache } from "./sectionState.js";
import { clearLocalHistoryCache } from "./sectionHistory.js";
import { clearBank } from "./ask-aruvi/bank.js";
import { clearPlans, PLANS_CACHE_PREFIX } from "./plans.js";
import { clearReadiness, READINESS_CACHE_PREFIX } from "./readiness.js";
import { clearAccount, ACCOUNT_CACHE_PREFIX } from "./account.js";
import { clearEntitlement, ENTITLEMENT_CACHE_PREFIX } from "./entitlement.js";
import { clearYear } from "./year.js";
import { clearUser } from "./format.js";

export const TEACHER_CACHE_PREFIXES = [
  "current_chapter_", "lu_pointer_", "lu_done_", "lu_bookmark_",
  "section_history_",            // includes the owner stamp, section_history_owner
  "chapter_notes_",
  "aruvi_ask_bank",
  PLANS_CACHE_PREFIX,            // the per-subject plan listing (plans.js) — carries HER flags
  READINESS_CACHE_PREFIX,        // her teaching profile (readiness.js) — subjects, classes, sections
  ACCOUNT_CACHE_PREFIX,          // her account (account.js) — the NAME on the bar and in the greeting
  ENTITLEMENT_CACHE_PREFIX,      // her subscription (entitlement.js) — what the shell hides on a lapse
];

export function clearTeacherCaches(extraPrefixes = []) {
  let n = 0;
  n += clearLocalSectionCache();
  n += clearLocalHistoryCache();
  clearBank();
  clearPlans();                  // the memory copy, which no prefix sweep can reach
  clearReadiness();              // likewise — her classes must not outlive her session
  clearAccount();                // …and neither must her NAME: on a shared phone the next
                                 // teacher to sign in must not be greeted as this one.
  clearEntitlement();            // …nor her SUBSCRIPTION: a lapsed teacher's stored entitlement
                                 // would paint the next teacher's first frame without My Classes.
  clearYear();                   // …nor her cutover DISMISSAL. Memory only (nothing is stored),
                                 // and the store keys itself to the teacher besides — but a
                                 // module that keeps running across a sign-out is exactly how
                                 // the web handed one teacher's dismissal to the next.
  clearUser();
  // belt and braces: anything the named clears missed, plus the app's own per-user keys
  n += removeByPrefix([...TEACHER_CACHE_PREFIXES, ...extraPrefixes]);
  try { storage.removeItem("aruvi_user"); } catch {}
  return n;
}
