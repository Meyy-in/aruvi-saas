/* ───────── "are these your sections?" — the queue behind the check window (F3) ─────────
 *
 * Lifted from `web/app/components/ProfilePortal.jsx` (Track D step 5d, 2026-09-15). When a teacher
 * ADDS a subject or a class, the next time she actually uses it Meyy asks her once to confirm its
 * set-up — sections, periods a week, the year. This module is the memory of "which ones are still
 * owed that question", and it is pure enough to test in node, which the window around it is not.
 *
 * ★ ASKED ONCE, EVER. `takeSetupCheck` SPENDS the key as it answers, so the question cannot come
 * back on a later visit. A prompt that reappears reads as Meyy not listening.
 *
 * ★ AND IT IS A PROMPT, NOT A RECORD. Everything here is best-effort: it may be dropped, pruned
 * or lost with the device copy, and the cost is at most one un-asked question. Nothing downstream
 * may depend on a key being present.
 */

import { getUser, userKey } from "./format.js";
import { storage } from "./storage.js";

/* ⚠️ The web's key is `setup_check_pending` (no trailing underscore) and signout.js sweeps the
   prefix `setup_check_pending_` that `userKey` produces. Keep all three in step. */
const KEY = () => userKey("setup_check_pending");

/* At most 24 keys. A teacher adding her whole timetable in one sitting queues a dozen; the cap is
   there so a runaway writer cannot grow this without bound, and dropping the OLDEST is right
   because the newest addition is the one she is about to use. */
export const SETUP_CHECK_CAP = 24;

/** How long My Lessons is left alone before the check window opens over it (founder, 2026-08-28).
 *  The window used to arrive in the same tick the dropdown resolved the added subject·class, so
 *  the screen she had just asked for was covered before she saw it. A second is enough for the
 *  pane to paint and for the tap to feel finished. */
export const SETUP_CHECK_DELAY_MS = 1000;

const read = () => {
  if (!getUser()) return [];
  try { const v = JSON.parse(storage.getItem(KEY()) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
};
const write = (list) => {
  if (!getUser()) return;
  try { storage.setItem(KEY(), JSON.stringify(list.slice(-SETUP_CHECK_CAP))); } catch {}
};

export const setupKey = (subjectName, grade) => `${subjectName}|${(grade || "").toUpperCase()}`;

/** Queue subject·class keys she has just added, so their first use raises the check window. */
export function queueSetupCheck(keys) {
  const have = read();
  const next = [...have, ...(keys || []).filter((k) => !have.includes(k))];
  if (next.length !== have.length) write(next);
}

/** Spend the key if it is queued — true means "ask her now". Idempotent: asked once, ever. */
export function takeSetupCheck(key) {
  const have = read();
  if (!have.includes(key)) return false;
  write(have.filter((k) => k !== key));
  return true;
}

/* Drop anything queued that is no longer a subject·class she teaches (2026-08-27). A queued key is
 * only ever SPENT when My Lessons scopes to it, and My Lessons offers only classes in her profile
 * — so a key for something she does not teach can never be spent and would sit in the queue
 * forever. Harmless on its own, but it makes the queue un-auditable, and during live testing this
 * store was once found holding seven keys for classes she already had plus two for classes she has
 * never taught, which no controlled repeat could reproduce. Whatever wrote them, a queue that
 * self-heals against the profile cannot carry them for long.
 * ⚠️ Deliberately NOT called on the baseline read: a transient shrink in readiness must not be
 * read as "she stopped teaching this". */
export function pruneSetupCheck(validKeys) {
  const have = read();
  if (!have.length) return;
  const ok = have.filter((k) => (validKeys || []).includes(k));
  if (ok.length !== have.length) write(ok);
}
