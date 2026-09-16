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

import { SETUP_CHECK_DELAY_MS, setupKey, takeSetupCheck } from "@aruvi/shared/setupCheck";

let state = { originRoute: null, win: null, scope: null, edit: null, winBack: null,
               pick: null, pickBack: null };
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
  state = { ...state, pick: null, win: state.winBack || null, winBack: null, pickBack: null };
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
  /* ★ AND THE QUESTION SHE ANSWERED ON THE WAY IN IS REMEMBERED TOO (founder, 2026-09-16: "can we
     have back arrow for Add button not just for class but for subject, periods a week and annual
     period budget"). The pick was simply DISCARDED here, so every journey that ran through it
     arrived at an editor with no way back but ✕ — which reopens the WINDOW, four rows up, and
     makes her answer the subject and the class again to fix the one she meant. `pickBack` is the
     same idiom as `winBack` a line along: one step back, not one journey back. */
  state = { ...state, edit: edit || null, winBack: state.win || state.winBack, win: null,
            pickBack: state.pick || state.pickBack, pick: null };
  emit();
}

/* The editor's ← : back to the question she came through, with her answer still on it. Only ever
   called when there IS one — a teacher of one subject and one class meets no pick screen, and for
   her the editor's only corner is the ✕ that puts the window back (two controls doing the same
   thing is what the 2026-09-15 corner rule removed). */
export function editBackToPick() {
  if (!state.pickBack) return;
  state = { ...state, edit: null, pick: state.pickBack, pickBack: null };
  emit();
}

/* Close the edit and restore the window she came from, if she came from one — on save AND on
   cancel alike, because a teacher who has just amended one item is the person most likely to want
   the next (founder, 2026-08-27). */
export function closeEdit() {
  state = { ...state, edit: null, win: state.winBack || null, winBack: null, pickBack: null };
  emit();
}

/* Raise a CHECK window, unless she is already looking at one — or at an edit, or a question.
   A window that lands on top of something she opened herself is the 2026-08-28 defect. */
export function raisePortalCheck(win) {
  if (state.win || state.edit || state.pick) return;
  setPortalWin(win);
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

/* ───────── "she has just added something" — the check window's second moment (item 10) ─────────
 *
 * The web's `onLessonsScope` (page.jsx), moved into this store because on the phone My Lessons is
 * a ROUTE with nothing above it: the screen reports the subject·class it has settled on, and the
 * decision to ask — and the window itself — belong here, where the window lives.
 *
 * ★ ASKED AT FIRST USE, NOT AT THE MOMENT SHE ADDS IT. Meyy makes the same three assumptions for
 * an added subject as it made for her first one (a section, a periods-a-week, a year's total), so
 * she deserves the same question about it — but asked when she opens the thing, not stacked on top
 * of the screen where she added it (§0's benefit-first rule).
 *
 * ★ AND IT WAITS A BEAT (founder, 2026-08-28). Opening in the same tick the wheels resolve would
 * land the window ON TOP of the selection she just made — she would never see the screen she asked
 * for before being asked a question about it. The timer is superseded by a later scope change (a
 * teacher spinning the wheels queues ONE window, not five) and re-checks at FIRE time, because a
 * second's worth of taps can open a window in between.
 *
 * ⚠️ `takeSetupCheck` SPENDS the key, so it is called once, outside any React updater — an updater
 * can run twice and would spend the key on the render React then throws away.
 * ⚠️ When the tour lands (8b) this needs the web's other guard: never over the tour. */
let scopeTimer = null;
export function noteLessonsScope(subjectName, grade) {
  if (!subjectName || !grade) return;
  if (state.win || state.edit || state.pick) return;
  if (!takeSetupCheck(setupKey(subjectName, grade))) return;
  clearTimeout(scopeTimer);
  scopeTimer = setTimeout(() => {
    scopeTimer = null;
    if (state.win || state.edit || state.pick) return;
    /* The scope is the subject and the STAGE its class sits in — never `exact`. She may teach
       three classes in the stage she just bought, and the Class row exists so she can say which. */
    setPortalWin({ mode: "check", reason: "added", subject: subjectName, grade,
                   scope: { subject: subjectName, grade } });
  }, SETUP_CHECK_DELAY_MS);
}

/* Leaving My Lessons cancels a question that was about to be asked over it. */
export function cancelLessonsScope() { clearTimeout(scopeTimer); scopeTimer = null; }

/* An ordinary visit somewhere else — the round trip is over and there is nothing to return to. */
export function clearPortal() {
  state = { originRoute: null, win: null, scope: null, edit: null, winBack: null,
            pick: null, pickBack: null };
  emit();
}
