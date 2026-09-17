/* ───────── The guided tour — its state, and the registry its ring aims at (step 8b) ─────────
 *
 * ★ THE TOUR IS A CAPSTONE, AND THAT IS A FACT ABOUT ITS ANCHORS. It points at sixteen controls
 * across six screens; every one of them had to exist first, which is why this is 8b and not 8.
 * The four that were missing when the map was drawn — the report button, the settings gear and
 * Ask Meyy's two — landed in steps 6b, 6c and 7.
 *
 * ★ A REGISTRY REPLACES `document.querySelector`. The web finds its target with
 * `querySelector('[data-tour="nav-lessons"]')`; React Native has no document, so every anchor
 * REGISTERS its ref here under **the web's own `data-tour` string**. Keeping the keys identical
 * is not tidiness: the step table is one table, shared by both surfaces, and the moment the
 * phone invents its own names the two can drift a step apart without anything failing loudly.
 *
 * ⚠️ MEASUREMENT REPLACES THE POLL. The web re-measures on a 200 ms interval plus resize plus a
 * capture-phase scroll listener — cheap in a browser, a battery cost with no payer on a handset.
 * Here a measurement happens when the STEP changes, when the anchor LAYS OUT, and when the
 * screen rotates. Anything that moves an anchor does one of those three things.
 *
 * ⚠️ `measureInWindow` IS ASYNCHRONOUS AND CAN ANSWER AFTER UNMOUNT. Every caller checks that the
 * step it measured for is still the step on screen before it commits a rect — without that, a
 * fast Next lands the previous step's ring on the next step's screen, which reads as the ring
 * "jumping" and is very hard to reproduce deliberately.
 */
import { useEffect, useRef, useState } from "react";

const anchors = new Map();          // data-tour name → { measure(cb) }
let state = { step: 0, info: {} };  // step 0 = not running
const listeners = new Set();

const emit = () => { listeners.forEach((fn) => { try { fn({ ...state }); } catch {} }); };

/* ── the registry ───────────────────────────────────────────────────────────────────────── */

/** Register a measurable node under the web's own `data-tour` name. Returns an unregister. */
export function registerAnchor(name, node) {
  if (!name || !node) return () => {};
  anchors.set(name, node);
  return () => { if (anchors.get(name) === node) anchors.delete(name); };
}

/** Measure one anchor. Resolves to {x, y, width, height} or null when it is not mounted. */
export function measureAnchor(name) {
  return new Promise((resolve) => {
    const node = name ? anchors.get(name) : null;
    if (!node || typeof node.measureInWindow !== "function") { resolve(null); return; }
    let done = false;
    const land = (x, y, width, height) => {
      if (done) return;
      done = true;
      // A node that is laid out but not on screen measures as a zero box — treat it as absent.
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    };
    try { node.measureInWindow(land); } catch { resolve(null); return; }
    // measureInWindow can simply never call back on a node that unmounts mid-flight.
    setTimeout(() => { if (!done) { done = true; resolve(null); } }, 250);
  });
}

/** The first of several names that is actually mounted — the web's `tipAnchor: [a, b]` idiom. */
export async function measureFirst(names) {
  for (const n of [].concat(names || []).filter(Boolean)) {
    const r = await measureAnchor(n);
    if (r) return r;
  }
  return null;
}

/* ── the state ──────────────────────────────────────────────────────────────────────────── */

export function subscribeTour(fn) {
  listeners.add(fn);
  try { fn({ ...state }); } catch {}
  return () => listeners.delete(fn);
}

export function tourState() { return { ...state }; }

/** Begin at step 1. `info` carries {tag, chapter} for the steps whose copy names them. */
export function startTour(info) {
  state = { step: 1, info: { ...(info || {}) } };
  emit();
}

export function setTourStep(n) {
  state = { ...state, step: Math.max(0, n) };
  emit();
}

/** What the step copy substitutes. The web's fallbacks, so a missing value never prints blank. */
export function noteTourInfo(info) {
  if (!info) return;
  state = { ...state, info: { ...state.info, ...info } };
  emit();
}

/* ★ ONE EXIT FOR DONE AND FOR SKIP. The web also raises the set-up check window here; the phone
   deliberately does NOT (founder, 2026-09-17, closing Q9) — it already raises that window from a
   one-shot first run leaves, and two triggers would ask her twice. The one that survives is the
   one with REACH: the tour's ending can only fire for a teacher who ran the tour, and Meyy
   assumed just as much for the one who skipped it. See `lib/firstRun.js`. */
export function endTour() {
  state = { step: 0, info: {} };
  emit();
}

/** Subscribe to the tour from a component. */
export function useTour() {
  const [s, setS] = useState(() => tourState());
  useEffect(() => subscribeTour(setS), []);
  return s;
}

/* ── the anchor hook every target uses ──────────────────────────────────────────────────── */

/** `const ref = useTourAnchor("nav-lessons")` — put it on the View you want the ring around. */
export function useTourAnchor(name) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    return registerAnchor(name, ref.current);
  });
  return ref;
}

/* ───────── The OFFER — who is asked, and how "once" survives a sign-out ─────────
 *
 * ★ IT IS SPENT WHEN IT IS OFFERED, NOT WHEN IT IS TAKEN. The web posts `/account/tour-offered`
 * the moment the nudge is eligible to show, so a teacher who ignores it is not asked again on
 * her next sign-in. That is deliberate: the offer is a one-time invitation, and re-offering it
 * every morning to someone who has already decided is nagging.
 * ⚠️ **AND IT LIVES ON THE ACCOUNT, NOT THE DEVICE.** `tour_offered_at` is a server field, so
 * "once" survives a sign-out and a second phone. A per-user local flag was tried on the web and
 * was the desync trap that broke re-offer after a server-side profile delete (2026-07-06) — do
 * not reintroduce one.
 * ⚠️ The LOCAL spend flag is deliberately NOT set by the POST: doing so would hide the nudge she
 * is looking at, mid-session, the instant it appeared.
 */
let offeredThisSession = false;

/** ≤1 bound section and nothing taught yet. `null` = we could not tell, which is NOT eligible —
 *  an unknown must never look like a new teacher (the `metaErr` rule). */
export async function fetchTourEligible(getJSON) {
  try {
    const d = await getJSON("/section-state");
    const rows = Object.values((d && d.states) || {});
    const bound = rows.filter((st) => st && st.chapter);
    const progressed = rows.some((st) => st && (st.done || st.unit_index != null));
    return bound.length <= 1 && !progressed;
  } catch { return null; }
}

/** Fire-and-forget, once per session. The server field is what makes it once per ACCOUNT. */
export function spendTourOffer(postJSON) {
  if (offeredThisSession) return;
  offeredThisSession = true;
  try { Promise.resolve(postJSON("/account/tour-offered", {})).catch(() => {}); } catch {}
}

/** True while this session has not yet posted the spend — used to keep the nudge on screen
 *  across an account re-read that would otherwise yank it away mid-look. */
export function offeredHere() { return offeredThisSession; }
