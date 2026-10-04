/* ───────── "Show me" — the guided tour taken AGAIN, from Ask Meyy, changing nothing ─────────
 * (founder, 2026-10-04: "a question in Ask Meyy … will lead her to the tour … she can always
 * skip … do it any number of times … keep it simple".)
 *
 * ★ WHY A REPLAY NEEDS THIS AT ALL. The tour was written for a teacher ninety seconds old, with
 * one lesson. To DEMONSTRATE attaching, it really detaches her section for steps 1-9 and really
 * attaches its demo plan at step 10 (the "borrow and give back" in page.jsx / lib/tour.js), and it
 * only gives back what was there when the section ends EMPTY. For a teacher half way through a
 * chapter that rule ends the replay with her section on a different chapter and her pointer and
 * bookmark gone. So a replay remembers EVERYTHING the tour can touch on every section it borrows
 * — chapter, pointer, done, bookmark — and puts back EXACTLY that when it ends, however it ends.
 *
 * ★ THE SNAPSHOT LIVES IN STORAGE, NOT MEMORY, because a replay can end without Done or Skip: a
 * closed tab, a killed app, a dead battery. Each app calls `restoreAfterReplay()` once on start;
 * a snapshot still there means a replay was cut short, and it is put back then.
 *
 * ⚠️ WHOSE SNAPSHOT? Section keys are not tagged to a teacher, so on a shared browser a leftover
 * snapshot must never be restored into the next teacher's account. It carries its OWNER, and one
 * that is not the signed-in teacher's is discarded unread (the pending-mark rule, sectionState.js).
 *
 * The snapshot's existence IS the replay flag: a first-run tour never writes one, so it keeps its
 * own ending (a completed first tour ends bound to the lesson she just made — that is the point).
 */
import { storage } from "./storage.js";
import { getUser } from "./format.js";
import {
  readLocalSection, readLocalBookmark, bindSectionChapter, unbindSection,
  setUnitPointer, setChapterDone, writeLocalBookmark,
} from "./sectionState.js";

export const TOUR_REPLAY_KEY = "tour_replay_restore";

function read() {
  try {
    const raw = storage.getItem(TOUR_REPLAY_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s && typeof s === "object" && s.sections && typeof s.sections === "object" ? s : null;
  } catch { return null; }
}
function write(s) {
  try { storage.setItem(TOUR_REPLAY_KEY, JSON.stringify(s)); } catch {}
}

function capture(sectionKey) {
  const s = readLocalSection(sectionKey);
  const unit = Number(s.unit);
  return {
    chapter: s.chapter || null,
    unit: Number.isFinite(unit) && unit > 0 ? unit : 0,
    done: !!s.done,
    bookmark: readLocalBookmark(sectionKey),
  };
}

/** Start a replay: a fresh snapshot, owned by the signed-in teacher, holding `sectionKey`. */
export function beginTourReplay(sectionKey) {
  const s = { owner: getUser() || "", sections: {} };
  if (sectionKey) s.sections[sectionKey] = capture(sectionKey);
  write(s);
}

/** True while a replay is running (or was cut short and not yet put back). */
export function isTourReplay() { return !!read(); }

/** Remember a section the replay is ABOUT to borrow. ONLY the first capture counts — a second
 *  call would read back a state the demo has already changed. No-op outside a replay. */
export function snapshotForReplay(sectionKey) {
  const s = read();
  if (!s || !sectionKey || s.sections[sectionKey]) return;
  s.sections[sectionKey] = capture(sectionKey);
  write(s);
}

/** Put every borrowed section back exactly as it was, and end the replay. Returns true when it
 *  restored something. Safe to call at any time: with no snapshot it does nothing. */
export function restoreAfterReplay() {
  const s = read();
  try { storage.removeItem(TOUR_REPLAY_KEY); } catch {}
  if (!s) return false;
  if ((s.owner || "") !== (getUser() || "")) return false;   // not hers — never restored
  Object.entries(s.sections).forEach(([sk, v]) => {
    if (!v || !v.chapter) { unbindSection(sk); return; }
    // bind resets pointer/done/bookmark; the three writes below put hers back. All in one tick,
    // so sectionState coalesces them into ONE push carrying the final state.
    bindSectionChapter(sk, v.chapter);
    if (v.unit) setUnitPointer(sk, v.unit);
    if (v.done) setChapterDone(sk, true);
    if (v.bookmark) writeLocalBookmark(sk, v.bookmark.unit, v.bookmark.phase);
  });
  return true;
}
