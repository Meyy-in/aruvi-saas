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
 * takes, for the same reason.
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

let state = { originRoute: null, win: null, scope: null, edit: null, winBack: null, pick: null };
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
  state = { ...state, originRoute: originRoute || null, win, scope };
  emit();
}

/* ★ AN EDIT IS A WINDOW OVER WHERE SHE IS, NOT A PLACE SHE GOES (founder, 2026-09-15: "ADD opens
 * a window but individual changes open full screen — suggest the changes also be contained in a
 * window"). `edit` is `{ intent, subject, grade }` and the layout renders the editor over
 * whatever screen is underneath, so "each item changes only itself" is true of the NAVIGATION as
 * well as of the record.
 * ⚠️ One consequence worth naming: because she never leaves My Lessons, the Year Plan pencil no
 * longer needs a pane round trip at all. `lib/paneIntent` existed only to put her back on a pane
 * the editor had navigated her away from; it was DELETED in the same commit, which is the good
 * kind of change — the mechanism went away rather than gaining a case. */
/* ★ THE PICK SCREENS SIT BETWEEN THE WINDOW AND THE EDITOR (5d item 3, 2026-09-15).
 * `pick` is `{ goal, subject }` — `subject` null while she is being asked WHICH SUBJECT, and set
 * once she has answered and the question becomes WHICH CLASS. One field, two screens, because
 * they are two steps of one question and the window's arrow walks back along them.
 *
 * It does NOT discard the window she came from. The portal is still the thing a close should
 * restore her to, exactly as an edit restores it — so `winBack` is stamped here too, and by the
 * same rule: closing is her explicit act, never a side effect of answering a question.
 */
export function openPick(pick) {
  state = { ...state, pick: pick || null, winBack: state.win || state.winBack, win: null };
  emit();
}

/* Answering "In which subject?" — the same pick, one field further on. */
export function pickSubject(subject) {
  if (!state.pick) return;
  state = { ...state, pick: { ...state.pick, subject } };
  emit();
}

/* The window's back arrow on the class screen: back to the subject question, not out of the
   journey. */
export function pickBackToSubject() {
  if (!state.pick) return;
  state = { ...state, pick: { ...state.pick, subject: null } };
  emit();
}

/* Close the picks and restore the window she came from — the close button's job, and identical
   to `closeEdit`'s, because to her they are the same act on the same window. */
export function closePick() {
  state = { ...state, pick: null, win: state.winBack || null, winBack: null };
  emit();
}

export function openEdit(edit) {
  /* ⚠️ THE WINDOW SHE CAME FROM IS REMEMBERED, not just closed. `closeEdit` used to restore
     `state.win` — which this line had already set to null, so the portal never came back and a
     teacher who amended one item was dropped onto the bare screen instead of the list she opened
     it from. The web has restored it since 2026-08-27 ("a teacher who has just amended one item
     is exactly the person most likely to want the next"); this is that, on the phone.
     Null when she came from somewhere else — the Year Plan pencil opens no window first, so
     there is nothing to put back. */
  /* ⚠️ `state.win || state.winBack`, NOT `state.win`. Reached through the PICK SCREENS `win` is
     already null (openPick moved it to winBack), so reading `win` alone would overwrite the
     remembered window with null — and the close button would drop her on the bare screen, which
     is the very bug the paragraph above records, arriving through the door item 3 opened. */
  state = { ...state, edit: edit || null, winBack: state.win || state.winBack, win: null, pick: null };
  emit();
}

/* Close the edit and restore the window she came from, if she came from one — on save AND on
   cancel alike, because a teacher who has just amended one item is the person most likely to want
   the next (founder, 2026-08-27). */
export function closeEdit() {
  state = { ...state, edit: null, win: state.winBack || null, winBack: null };
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
  state = { originRoute: null, win: null, scope: null, edit: null, winBack: null };
  emit();
}
