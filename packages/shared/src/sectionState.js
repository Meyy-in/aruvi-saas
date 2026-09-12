/* ───────── section teaching-state: server-backed, localStorage-cached ─────────
 * Which chapter each section tracks (`current_chapter_*`), how far along (`lu_pointer_*`),
 * and whether it's done (`lu_done_*`) USED to live only in the browser's localStorage — so
 * two devices (e.g. Chrome desktop vs iPhone Safari) never agreed. These helpers keep the
 * SAME localStorage keys as an OPTIMISTIC CACHE (the UI stays synchronous + instant) while
 * making the server the source of truth for cross-device consistency (CLOUD_DATA_MODEL.md
 * §2.4). Writes push a snapshot; loads reconcile the cache from the server.
 *
 * The three keys per section, so the naming can never drift between reader and writer: */
import { API, withUser, getJSON } from "./format.js";
import { storage } from "./storage.js";
import { verifiedWrite, sectionStateMatches } from "./verify.js";

const chapterKey = (sk) => `current_chapter_${sk}`;
const pointerKey = (sk) => `lu_pointer_${sk}`;
const doneKey = (sk) => `lu_done_${sk}`;
// The teacher's ONE bookmark on this section's chapter — a place-marker on a phase of the
// in-progress unit (LessonView's PhaseBookmark). Stored as "unit:phase" (both 0-based).
// Rides the SAME per-section row + push/pull path as the pointer, so it migrates to Supabase
// with it at Phase 4 (CLOUD_DATA_MODEL.md §2.4) — no separate plumbing. One bookmark per
// section-chapter (founder decision 2026-07-23).
const bookmarkKey = (sk) => `lu_bookmark_${sk}`;

/* Bind a prepared chapter to a section — the single shared writer for "attach a lesson to a
 * class", used by BOTH My Classes' "+" and the My Lessons preview's "Attach to a class" CTA so
 * the two paths can never drift. Writes the optimistic localStorage cache (fresh pointer, not
 * done) then pushes to the server. Switching to a new chapter resets pointer + done so the new
 * chapter starts at its first learning unit. */
export function bindSectionChapter(sectionKey, filename) {
  if (!sectionKey || !filename) return;
  try {
    storage.setItem(chapterKey(sectionKey), filename);
    storage.removeItem(pointerKey(sectionKey));
    storage.removeItem(doneKey(sectionKey));
    storage.removeItem(bookmarkKey(sectionKey));   // fresh chapter → no bookmark yet
  } catch {}
  pushSectionState(sectionKey);
}

/* Clear a section's binding (pointer + done too). The chapter itself is untouched (still in My
 * Lessons); the card returns to the unstarted "Pick a chapter" state. Shared unbind writer. */
export function unbindSection(sectionKey) {
  if (!sectionKey) return;
  try {
    storage.removeItem(chapterKey(sectionKey));
    storage.removeItem(pointerKey(sectionKey));
    storage.removeItem(doneKey(sectionKey));
    storage.removeItem(bookmarkKey(sectionKey));
  } catch {}
  pushSectionState(sectionKey);   // no chapter now → the server row is deleted (untrack)
}

/* Read this section's bookmark from the localStorage cache → {unit, phase} (both 0-based),
 * or null if none set. */
export function readLocalBookmark(sectionKey) {
  if (!sectionKey) return null;
  try {
    const raw = storage.getItem(bookmarkKey(sectionKey));
    if (!raw) return null;
    const [u, p] = String(raw).split(":");
    const unit = Number(u), phase = Number(p);
    if (!Number.isFinite(unit) || !Number.isFinite(phase)) return null;
    return { unit, phase };
  } catch {
    return null;
  }
}

/* Move (or clear) this section's bookmark. Writes the optimistic localStorage cache then
 * pushes the whole section snapshot to the server (same fire-and-forget path as the pointer).
 * Pass unit=null (or phase=null) to clear it. */
export function writeLocalBookmark(sectionKey, unit, phase) {
  if (!sectionKey) return;
  try {
    if (unit == null || phase == null) storage.removeItem(bookmarkKey(sectionKey));
    else storage.setItem(bookmarkKey(sectionKey), `${unit}:${phase}`);
  } catch {}
  pushSectionState(sectionKey);
}

/* Read one section's current state straight from the localStorage cache. */
/* ───────── the teaching pointer + done flag (shared 2026-09-12, Track D step 3) ─────────
 * The web's LessonView wrote lu_pointer_ / lu_done_ inline (its writePointer/setDone). The
 * phone's LessonView needs the same two writes, so they live here as named helpers keyed by
 * the SAME keys and each pushes to the server — one implementation both apps can call. The
 * web keeps its inline copy for now; these are additive. Pointer + phase are 0-based. */
export function readUnitPointer(sectionKey) {
  if (!sectionKey) return 0;
  try { const n = Number(storage.getItem(pointerKey(sectionKey))); return Number.isFinite(n) && n >= 0 ? n : 0; }
  catch { return 0; }
}
export function setUnitPointer(sectionKey, unitIndex) {
  if (!sectionKey) return;
  const i = Math.max(0, Number(unitIndex) || 0);
  try {
    if (i === 0) storage.removeItem(pointerKey(sectionKey));   // 0 is the implicit default — mirror pullSectionState
    else storage.setItem(pointerKey(sectionKey), String(i));
  } catch {}
  pushSectionState(sectionKey);
}
export function readChapterDone(sectionKey) {
  if (!sectionKey) return false;
  try { return storage.getItem(doneKey(sectionKey)) === "1"; } catch { return false; }
}
export function setChapterDone(sectionKey, done) {
  if (!sectionKey) return;
  try {
    if (done) storage.setItem(doneKey(sectionKey), "1");
    else storage.removeItem(doneKey(sectionKey));
  } catch {}
  pushSectionState(sectionKey);
}

export function readLocalSection(sectionKey) {
  try {
    return {
      chapter: storage.getItem(chapterKey(sectionKey)) || null,
      unit: storage.getItem(pointerKey(sectionKey)),
      done: storage.getItem(doneKey(sectionKey)) === "1",
    };
  } catch {
    return { chapter: null, unit: null, done: false };
  }
}

/* Sync one section to the server AFTER the caller has already written localStorage
 * (optimistic). Fire-and-forget — a failed sync never blocks or breaks the UI; the local
 * cache still reflects the teacher's action, and the next successful push reconciles.
 * No chapter bound → the section is untracked → DELETE the row. */
/* Callers register here to hear about a VERIFIED mismatch — the server was read back and this
 * section is not in the state the teacher just put it in (areas 4 and 5 of the founder's six:
 * attaching a lesson to a class, and marking it complete). Not called on a throw, and not
 * called when the server could not be reached: those are "we cannot tell", not "it failed".
 * A module-level sink rather than a return value because pushSectionState is fire-and-forget
 * from a dozen call sites, and threading a promise through all of them would change every one. */
let onSectionMismatch = null;
export function setSectionMismatchHandler(fn) { onSectionMismatch = fn; }

/* ★ COALESCED AND SERIALIZED PER SECTION (2026-08-29 — the "that didn't save" ghost,
 * found live on 1000000002, Class 6 Roja, ch 1). Completing a chapter's LAST unit fires
 * TWO pushes in one tick: writePointer's (snapshotted BEFORE lu_done is set → done:false)
 * and setDone's (done:true). Two in-flight POSTs with DIFFERENT payloads race; whenever
 * the network delivered the stale one second, the server ended done:false, the read-back
 * truthfully disagreed with her screen, and the mismatch toast fired — "randomly",
 * because it needed the reorder. On ordinary units both payloads are identical, so any
 * ordering converges — which is why only chapter COMPLETION ever complained.
 *
 * The fix is here, not at the callers (a dozen call sites, any pair can race):
 *   · same-tick calls COALESCE — the snapshot is taken in a microtask, after every
 *     localStorage write of the tick has settled, so one push carries the final state;
 *   · pushes for the SAME section SERIALIZE — a call landing mid-flight queues one
 *     follow-up push (which snapshots fresh) instead of racing the wire.
 * Cross-section pushes still run in parallel; the server's per-process lock keeps the
 * file whole, and different sections are different rows. */
const pushQueues = new Map();   // sectionKey → { queued, chain }

export function pushSectionState(sectionKey) {
  if (!sectionKey) return;
  let q = pushQueues.get(sectionKey);
  if (!q) { q = { queued: false, chain: Promise.resolve() }; pushQueues.set(sectionKey, q); }
  if (q.queued) return;          // a push is already scheduled — it will snapshot the final state
  q.queued = true;
  q.chain = q.chain.then(() => {
    q.queued = false;            // from here a new call schedules a fresh push AFTER this one
    return syncSectionNow(sectionKey);
  }).catch(() => {});
}

function syncSectionNow(sectionKey) {
  const { chapter, unit, done } = readLocalSection(sectionKey);
  const bm = readLocalBookmark(sectionKey);
  // Y, known upfront: this section tracks `chapter` and is (or is not) done — or, when there is
  // no chapter, has NO row at all, which is what an unbind must produce.
  const want = chapter ? { chapter, done: !!done } : { chapter: null };
  const verify = (doWrite) => verifiedWrite({
    write: doWrite,
    read: () => getJSON("/section-state").then((d) => (d && d.states) || {}),
    expect: (states) => sectionStateMatches(states, sectionKey, want),
  }).then(({ status }) => {
    if (status === "mismatch" && onSectionMismatch) onSectionMismatch(sectionKey, want);
  });
  try {
    if (!chapter) {
      return verify(() => fetch(`${API}/section-state/${encodeURIComponent(sectionKey)}`,
        withUser({ method: "DELETE" })).then((r) => { if (!r.ok) throw new Error(String(r.status)); }));
    }
    return verify(() => fetch(`${API}/section-state`, withUser({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section_key: sectionKey,
        chapter,
        unit_index: unit === null || unit === "" ? null : Number(unit),
        done: !!done,
        // The bookmark rides the same snapshot (null when unset). An older API that doesn't
        // know these fields simply ignores them (Pydantic drops extras) — the cache still holds
        // the bookmark; cross-device sync of it lights up once the field lands server-side.
        bookmark_unit: bm ? bm.unit : null,
        bookmark_phase: bm ? bm.phase : null,
      }),
    })).then((r) => { if (!r.ok) throw new Error(String(r.status)); }));
  } catch { return Promise.resolve(); }
}

/* ★ CUTOVER'S ONE EXCEPTION (founder, 2026-08-26). `pullSectionState` below deliberately
 * ADOPTS NOTHING and DELETES NOTHING when the server returns a wholesale-empty payload,
 * because that is far more likely a transient/corrupt read than a teacher having untracked
 * every class — a guard added after a corrupt state.json flashed every card back to "pick a
 * chapter". An academic-year cutover is the one moment when empty genuinely means empty:
 * the new year's folder has no rows because she has not taught in it yet. Found live —
 * after cutting over, My Classes still read "Teaching now Ch 5" from the browser's cache.
 *
 * So cutover clears the cache EXPLICITLY rather than by weakening the guard, which still
 * protects the failure mode it was written for. Nothing on the server is touched; only this
 * device's optimistic copy, which the next reconcile would rebuild from server truth anyway.
 */
export function clearLocalSectionCache() {
  const prefixes = ["current_chapter_", "lu_pointer_", "lu_done_", "lu_bookmark_"];
  let removed = 0;
  try {
    const doomed = [];
    for (const k of storage.keys()) {
      if (k && prefixes.some((p) => k.startsWith(p))) doomed.push(k);
    }
    doomed.forEach((k) => { storage.removeItem(k); removed += 1; });
  } catch { /* private mode / storage disabled — the server is the authority regardless */ }
  return removed;
}

/* Authoritative reconcile on load: pull every tracked section from the server and rewrite
 * the localStorage cache to match. For each KNOWN section key (from the readiness profile),
 * apply the server row, or clear the local cache if the server has none — so a device that
 * missed a track (or an untrack) done elsewhere converges to server truth. Resolves TRUE
 * when the server answered (the cache now reflects server truth) and FALSE when it could
 * not (offline / server down — cache untouched, and NOT trustworthy as "nothing is
 * attached"). Callers bump a render tick either way; the boolean lets first-run-shaped
 * UI (the tour offer) wait for a real answer instead of mistaking an empty cache for a
 * new teacher (kumar1's phantom tour, 2026-08-24). */
export async function pullSectionState(sectionKeys) {
  let states = {};
  try {
    states = (await getJSON("/section-state")).states || {};
  } catch {
    return false; // offline / server down → keep the existing local cache untouched
  }
  // SAFETY GUARD (2026-07-03): a WHOLESALE-empty server response ({} for every section) is far
  // more likely a transient/corrupt-empty read than the teacher having genuinely untracked every
  // single class — and the old code responded by DELETING every local binding, which is exactly
  // how a corrupted state.json flashed all the cards back to "pick a chapter". So when the server
  // returns nothing at all, we ADOPT nothing and DELETE nothing: local optimistic state is kept
  // intact. Per-section untrack from another device still propagates, because that case returns a
  // NON-empty payload (the other tracked sections are present) and the absent key is cleared below.
  const serverEmpty = Object.keys(states).length === 0;
  (sectionKeys || []).forEach((sk) => {
    const st = states[sk];
    try {
      if (st && st.chapter) {
        storage.setItem(chapterKey(sk), st.chapter);
        if (st.unit_index === null || st.unit_index === undefined) {
          storage.removeItem(pointerKey(sk));
        } else {
          storage.setItem(pointerKey(sk), String(st.unit_index));
        }
        if (st.done) storage.setItem(doneKey(sk), "1");
        else storage.removeItem(doneKey(sk));
        // Bookmark rides the same row — but ADOPT it only when the server actually carries one.
        // When the server row has NO bookmark (an API that doesn't persist the fields yet, or a
        // row written before this feature), we must NOT wipe the local optimistic value: doing
        // so erased the teacher's saved phase on every sign-in, so it snapped back to the top of
        // the unit. Same spirit as the serverEmpty guard above — keep local truth until the
        // server has something real to override it with. A bound chapter always carries a
        // bookmark locally; the only legitimate clear is unbind/bind, which deletes the whole
        // row (the untrack branch below).
        if (st.bookmark_unit != null && st.bookmark_phase != null) {
          storage.setItem(bookmarkKey(sk), `${st.bookmark_unit}:${st.bookmark_phase}`);
        }
      } else if (!serverEmpty) {
        // Server has state for OTHER sections but not this one → a genuine untrack; clear local.
        // (Skipped entirely when serverEmpty — see the guard above.)
        storage.removeItem(chapterKey(sk));
        storage.removeItem(pointerKey(sk));
        storage.removeItem(doneKey(sk));
        storage.removeItem(bookmarkKey(sk));
      }
    } catch {}
  });
  return true;
}
