/* ───────── is Ask Meyy open? (6c, I1/I2) ─────────
 *
 * The web keeps one `askOpen` boolean in `page.jsx` and hands `onAsk` to whatever needs it —
 * the bottom bar, the Settings Help card, the Support screen's deflect card. It can, because
 * on the web those are all children of the one component that owns the flag.
 *
 * On the phone they are not. The bar lives in the SHELL (`(app)/_layout.jsx`) and the two cards
 * live in ROUTES pushed inside it, with nothing above them to thread a prop through. So the
 * flag is a module store with a subscription — the same shape `lib/portal` and `lib/preparing`
 * take, for the same reason, and the panel itself stays mounted in the shell where the web's is.
 *
 * ★ TOGGLE, NOT OPEN, on the bar item: the web's `setAskOpen((v) => !v)`. Ask Meyy is the one
 * bar item that is a PANEL rather than a place, and tapping it again is how she puts it away —
 * the ✕ is not the only door. The other three items CLOSE it and go (see the layout).
 */

let open = false;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => { try { fn(open); } catch {} });
}

/* Fires immediately with the current value, so a mount mid-session draws the panel on its FIRST
   render rather than a frame later. Returns an unsubscribe. */
export function subscribeAsk(fn) {
  listeners.add(fn);
  try { fn(open); } catch {}
  return () => listeners.delete(fn);
}

export function isAskOpen() { return open; }

export function openAsk() { if (!open) { open = true; emit(); } }
export function closeAsk() { if (open) { open = false; emit(); } }
export function toggleAsk() { open = !open; emit(); }
