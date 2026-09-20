/* ───────── the lesson being prepared, held ACROSS routes (Track D step 5b) ─────────
 *
 * ★ WHY THIS EXISTS (founder, 2026-09-14: "iPhone and expo when preparing a new plan takes us
 * out into a new screen, whereas web app shows the lesson plan generating in My Lessons itself
 * at the top with a progress bar — align iphone/expo with web app").
 *
 * The web decided this on 2026-08-06 and wrote down why: preparing used to take her AWAY, and
 * "two things were wrong with it — she left the place the lesson was going to appear, and a
 * faded card reads as 'something is missing' when in fact every fact on it is already known and
 * final." So the wait happens in the REPOSITORY, as a real lesson card in the ordinary structure
 * (number tag · title · duration line) drawn at full strength, sitting exactly where the finished
 * plan will sit. The only difference is the last line: a progress bar instead of "Ready to teach".
 *
 * On the web that works because `preparing` lives in page.jsx, ABOVE the tab — My Lessons
 * unmounts and remounts around it. The phone has no shell between its routes: each screen is its
 * own route and there is nowhere above them to put state. So step 5a shipped the web's own
 * fallback (the wait on the prepare screen) and named it as the divergence. This module is the
 * missing shell: one descriptor, module-level, with a subscription so any screen can watch it.
 *
 * ★ THE REQUEST OUTLIVES THE SCREEN THAT STARTED IT, and that is deliberate — the same trick the
 * web relies on. `prepare.jsx` fires the fetch, hands the descriptor here, and navigates away in
 * the SAME tick. The component unmounts, but the async function's closure does not: it keeps
 * running, holds the five-second beat, and resolves into THIS store, which is what the screen she
 * is now looking at is subscribed to. Nothing is awaited before the handoff, because awaiting it
 * is precisely what would keep her on the old screen.
 *
 * ★ THREE TERMINAL STATES, because a prepare can end three ways and only one of them is success:
 *   · CLEARED    — the plan landed. My Lessons re-reads the listing and the real card replaces
 *                  the proposed one in place.
 *   · FAILED     — the card STAYS, at rest, carrying the reason (ARV-D-087). It is not pulled,
 *                  because she is looking at it, and a card that vanishes silently reads as a
 *                  mis-tap. She dismisses it herself; nothing navigates under her.
 *   · PAYWALL    — a 402 is NOT an error (founder, 2026-08-24). The card comes DOWN and a window
 *                  carries the server's own sentence instead. It is held here rather than on the
 *                  prepare screen because by the time the 402 arrives that screen is gone.
 */

let state = { descriptor: null, paywall: "" };

const listeners = new Set();

function emit() {
  // A copy per emit: subscribers keep it in React state and must see a new identity to re-render.
  const snapshot = { ...state };
  listeners.forEach((fn) => { try { fn(snapshot); } catch {} });
}

/* Subscribe to the preparing state. Returns an unsubscribe, so a screen can wire it straight
   into a useEffect. The callback fires immediately with the current state, so a screen that
   mounts mid-prepare draws the card on its FIRST render rather than a frame later. */
export function subscribePreparing(fn) {
  listeners.add(fn);
  try { fn({ ...state }); } catch {}
  return () => listeners.delete(fn);
}

export function getPreparing() {
  return { ...state };
}

/* { subject, grade, chapterNo, chapterTitle, rows: [{duration, count}] } — everything the card
   needs, all of it already known when she pressed the button. Nothing here is fetched to draw
   the card, which is the point: it is her lesson, stated back to her, not a placeholder. */
/* `run` is the serve itself, kept beside the descriptor so a FAILED card can offer "Try again"
   (WALK-A-019): she already chose the chapter, the duration and the periods, and the screen that
   asked for them is gone. It is not part of the descriptor — nothing renders a function. */
let runner = null;
export function startPreparing(descriptor, run) {
  state = { descriptor: { ...descriptor, failed: false, message: "" }, paywall: "" };
  runner = typeof run === "function" ? run : null;
  emit();
}

/* Re-run the same serve behind the same card. No-op when there is nothing to retry. */
export function retryPreparing() {
  if (!runner || !state.descriptor) return;
  state = { ...state, descriptor: { ...state.descriptor, failed: false, message: "" } };
  emit();
  runner();
}

/* The plan landed (or she dismissed a failure). */
export function clearPreparing() {
  state = { descriptor: null, paywall: "" };
  runner = null;
  emit();
}

/* The build failed. The card stays put and carries the reason — the API's own 4xx sentence
   where there is one, since those are written for her, and our fallback otherwise. */
export function failPreparing(message) {
  if (!state.descriptor) return;
  state = { ...state, descriptor: { ...state.descriptor, failed: true, message } };
  emit();
}

/* A 402. The card comes down; the sentence goes to the window. */
export function paywallPreparing(message) {
  state = { descriptor: null, paywall: message || "" };
  emit();
}

export function clearPaywall() {
  state = { ...state, paywall: "" };
  emit();
}
