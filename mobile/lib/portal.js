/* ───────── where a profile edit CAME FROM, and what to reopen after it (F7) ─────────
 *
 * The phone twin of page.jsx's `portalOriginRef` / `portalWin` pair. A profile edit is always a
 * DETOUR: she is standing somewhere — My Classes, the Year Plan, the "+" window — and steps out to
 * change one thing. Every exit from that edit has to put her back exactly where she stepped out
 * from, or the edit becomes a one-way door and she has to navigate home from a screen she never
 * chose to be on.
 *
 * The web keeps this above the tab, in the shell. The phone's screens are ROUTES with nothing
 * above them, so this is a module-level store with a subscription — the same shape `lib/preparing`
 * and `lib/paneIntent` take, for the same reason.
 *
 * ★ TWO THINGS ARE REMEMBERED, and they are not the same thing:
 *   · `originRoute` — the screen to return to. Set on the way IN, so a system back gesture lands
 *     where Cancel does.
 *   · `win` — the portal window to RE-OPEN on the way out. The web restores it on EVERY ending,
 *     save and cancel alike, because "a teacher who has just amended one item is exactly the
 *     person most likely to want the next" (founder, 2026-08-27). Closing the window is her own
 *     explicit act, never a side effect of finishing an edit.
 *
 * ★ AND A DETOUR THROUGH SOMEWHERE ELSE CLEARS IT. The web's `goClasses` drops the stamp: a trip
 * to My Classes in the middle is an ordinary visit, not part of the round trip, and returning her
 * to a window she left behind ten minutes ago would be a ghost.
 */

let state = { originRoute: null, win: null, scope: null };
const listeners = new Set();

function emit() {
  const snapshot = { ...state };
  listeners.forEach((fn) => { try { fn(snapshot); } catch {} });
}

/* Fires immediately with the current state, so a screen mounting mid-detour draws the window on
   its FIRST render rather than a frame later. Returns an unsubscribe. */
export function subscribePortal(fn) {
  listeners.add(fn);
  try { fn({ ...state }); } catch {}
  return () => listeners.delete(fn);
}

export function getPortal() { return { ...state }; }

/* Stepping OUT to an edit. `win` is the window to restore afterwards (null when she came from a
   screen rather than from the window itself); `scope` narrows which subject·class the edit acts
   on — `{ subject, grade, exact }`, where `exact` means "she is standing on it, do not ask". */
export function enterPortal({ originRoute, win = null, scope = null }) {
  state = { originRoute: originRoute || null, win, scope };
  emit();
}

/* The window itself, opened or closed without an edit in flight. */
export function setPortalWin(win) {
  state = { ...state, win: win || null };
  emit();
}

/* Finishing an edit: hand back where she goes and what to reopen, and clear the origin — but NOT
   the window, which the caller restores by rendering it. */
export function leavePortal() {
  const { originRoute, win } = state;
  state = { originRoute: null, win, scope: null };
  emit();
  return { originRoute, win };
}

/* An ordinary visit somewhere else — the round trip is over and there is nothing to return to. */
export function clearPortal() {
  state = { originRoute: null, win: null, scope: null };
  emit();
}
