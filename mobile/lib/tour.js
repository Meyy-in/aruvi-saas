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
import { router } from "expo-router";
import { openAsk, closeAsk } from "./ask";
import { readLocalSection, bindSectionChapter, unbindSection } from "@aruvi/shared/sectionState";
import { cachedReadiness } from "@aruvi/shared/readiness";
import { cachedPlans } from "@aruvi/shared/plans";
import { subjectSlug, gradeSlug, postJSON } from "@aruvi/shared/format";

/* ★ TWENTY STEPS, DECLARED HERE. It lived in `GuidedTour.jsx` until the navigation moved into
   this module; importing the component from here to read one number would be a cycle, and the
   count is a fact about the tour rather than about the overlay that draws it. */
export const TOUR_TOTAL = 20;

const anchors = new Map();          // data-tour name → { measure(cb) }
let state = { step: 0, info: {}, target: null };  // step 0 = not running
let ranThisSession = false;   // started or finished a tour in this app run — see tourRanHere
const listeners = new Set();

const emit = () => { listeners.forEach((fn) => { try { fn({ ...state }); } catch {} }); };

/* ── the registry ───────────────────────────────────────────────────────────────────────── */

/* ★ REGISTRATION IS AN EVENT, because an anchor can arrive long after the step does (founder,
 * 2026-09-17, on the handset: cards 3-6 "stuck at the bottom", which is what the tip does when
 * it has no rect to sit under). My Lessons paints "Loading plans…" until the server answers, so
 * on a cold Render instance the lesson card does not exist for a second or more after the step
 * changes — and the overlay's single 220ms retry had long since given up. Rather than poll
 * (a battery cost with no payer), the registry TELLS the overlay when a name appears. */
const anchorWatchers = new Set();
export function onAnchorRegistered(fn) {
  anchorWatchers.add(fn);
  return () => anchorWatchers.delete(fn);
}

/** Register a measurable node under the web's own `data-tour` name. Returns an unregister. */
export function registerAnchor(name, node) {
  if (!name || !node) return () => {};
  const had = anchors.get(name);
  anchors.set(name, node);
  /* Only a CHANGE is news. `useTourAnchor` re-registers on every render of its owner, and
     announcing the same node each time would put the overlay in a measure loop. */
  if (had !== node) anchorWatchers.forEach((fn) => { try { fn(name); } catch {} });
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
  ranThisSession = true;
  /* ★ THE OFFER IS SPENT WHEN SHE TAKES IT (WALK-A-009, founder decision; ported from the web's
     markTourOffered-in-startTour 2026-09-24). It used to be spent the moment the nudge SHOWED, so
     leaving before answering — the app closed, a dropped connection — removed the tour for good.
     Skip and Done happen inside a taken tour, so they are covered. */
  spendTourOffer((p) => postJSON(p, {}));
  state = { ...state, step: 1, info: { ...state.info, ...(info || {}) } };
  rememberBinding();
  syncDemo(1);
  /* ★ STEPS 1 AND 2 STAND ON MY LESSONS (founder, 2026-09-17: on the web they showed *"My Classes
     background but it should be in My Lessons only"*). The web opened the tour with `goClasses()`;
     it now opens where the teacher already is — the offer's own screen, and the one first run
     leaves her on. Steps 1 and 2 ring the two nav items, which are on screen either way. */
  router.navigate("/lessons");
  emit();
}

/* ★ "THE TOUR HAS RUN HERE" — NOT the same fact as "the offer was made" (founder, 2026-09-17: at
 * Done *"the tour beginning card comes back"*). `offeredHere` flips the instant the nudge becomes
 * eligible, so testing it would hide the nudge she is looking at, mid-look — the trap the note on
 * `spendTourOffer` warns about. This flips when she STARTS or FINISHES one, which is the fact the
 * account cache cannot know until it is re-read, and it is what keeps the nudge from springing
 * back under her the moment `step` returns to 0. */
export function tourRanHere() { return ranThisSession; }

/* ★ THE SECTION AND LESSON THE TOUR DEMONSTRATES ON, published by My Classes because that is the
   screen that knows which they are. The SHELL needs it too — steps 11-13 open the real lesson,
   and only the shell can navigate — so it lives here rather than being passed down a tree that
   does not connect the two. `{ subjectSlug, gradeSlug, sectionKey, filename, tag, chapter }`. */
export function noteTourTarget(target) {
  const a = JSON.stringify(state.target || null);
  const b = JSON.stringify(target || null);
  if (a === b) return;                     // idempotent: this is called from a render effect
  state = { ...state, target: target || null };
  /* The target can arrive AFTER the tour has started — My Classes has to load its listing first —
     so the borrow is taken and the step re-applied here as well as at `startTour`. */
  rememberBinding();
  syncDemo(state.step);
  emit();
}

export function setTourStep(n) {
  state = { ...state, step: Math.max(0, n) };
  pinPending = false;               // a pin belongs to the step that asked for it, never the next
  syncDemo(state.step);             // the demo's binding follows the step, wherever she is standing
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
  ranThisSession = true;
  restoreBinding();                 // give back what the demo borrowed, if it left the section empty
  state = { step: 0, info: {}, target: null };
  pinPending = false;
  emit();
}

/* ───────── The scroller the tour can pin (step 7 and step 11, app. 06 row 118) ─────────
 * ★ TWO STEPS PIN THEIR SCREEN TO THE TOP, and they are the two whose ring is the whole screen:
 * the lesson preview and the tracking view. Without it a long plan opens wherever she last left
 * it, the chapter head and the tab strip are off-screen, and the tip describes something she
 * cannot see.
 * ⚠️ **AT MOST ONCE PER STEP.** The web allows two pins 400ms apart and its own note says
 * repeated snapping "read as garbled" the moment the teacher scrolled to read under the box.
 * Here the screen registers a scroller and the tour asks it once, on arrival; if she then
 * scrolls, that is her business and nothing fights her for it.
 */
let scroller = null;
/* ⚠️ THE STEP CAN ARRIVE BEFORE THE SCREEN DOES. Steps 11 and 13 navigate and advance the step in
   the same tick (`openTourLesson(); setTourStep(11)`), so the tour asks for its pin while the
   screen that owns the scroller is still mounting and there is nobody to ask. The pin then waits
   here for the scroller about to register — and for nobody else: it is spent the instant it is
   taken, cleared by the next step, and cleared by `endTour`, so it can never fire into a screen
   the teacher opened herself a minute later. */
let pinPending = false;
/* ★ A SCROLLER DOES TWO THINGS, AND THE PHONE ONLY EVER IMPLEMENTED ONE (founder, 2026-09-17,
 * asking what was wrong with card 13 alone). The web's overlay has both halves and its own
 * comment names this exact step: *"Bring an off-screen target into view (e.g. Mark complete below
 * the fold)"*. The phone ported the PIN (`scrollTop`, steps 7 and 11) and never ported the other
 * half — so Mark complete, which sits at the very bottom of a unit's lesson panel and is off
 * screen the moment the phases run past one screenful, had nothing bringing it up. The ring was
 * drawn correctly, below the fold, where she could not see it; `place: "above"` then computed a
 * negative offset and the tip fell to the foot of the screen. Everything worked and nothing was
 * visible, which is why four fixes to the anchor changed nothing.
 * `by` takes a DELTA because the overlay knows the rect in WINDOW coordinates and only the
 * scroller knows its own offset. */
export function registerTourScroller(fn) {
  scroller = fn;
  if (pinPending) { pinPending = false; try { fn.top(); } catch {} }
  return () => { if (scroller === fn) scroller = null; };
}
export function pinTourScroll() {
  if (scroller) { try { scroller.top(); } catch {} return; }
  pinPending = true;
}
/** Scroll the current screen by `dy` so an off-screen anchor comes into view. No-op with none. */
export function nudgeTourScroll(dy) {
  if (!scroller || !dy) return;
  try { scroller.by(dy); } catch {}
}

/** Subscribe to the tour from a component. */
export function useTour() {
  const [s, setS] = useState(() => tourState());
  useEffect(() => subscribeTour(setS), []);
  return s;
}

/* ───────── WHERE THE TOUR GOES, AND WHO MAY DRAW IT ─────────────────────────────────────────
 *
 * ★ THE NAVIGATION LIVES WITH THE TOUR, not in the shell (founder, 2026-09-17, after three walks
 * reported the same thing: at steps 9 and 15 *"pressing next shows the erroneous window"*).
 * The cause was structural. The attach picker is a React Native `Modal`, which is presented in
 * its OWN NATIVE WINDOW above the whole app — so an overlay rendered in `(app)/_layout.jsx` can
 * never draw over it. She saw the ring from the step before, could not reach Next, and the only
 * thing she COULD press was the lesson row: that attaches and closes the sheet while the step
 * never moves, which is exactly the "erroneous window" in the report.
 * The fix is not to fight the Modal but to let the SHEET render the overlay itself — and it can
 * only do that if advancing the tour is something any screen can call. Hence these three
 * functions. `router` is expo-router's module-level singleton and works outside a component;
 * Ask Meyy is opened through its own store rather than the shell's local state, which also
 * closes a small existing hole where `isAskOpen()` disagreed with what was on screen.
 *
 * ⚠️ THE MOVES ARE A TABLE, NOT A CHAIN OF `if`s — the web's `tourNext`/`tourBack` are two switch
 * statements twenty lines apart and drifted there at least once. Next and Back read the same
 * table from opposite ends, so a step cannot advance somewhere it will not come back from. */
const MOVES = { 7: "/", 15: "/", 16: "/settings/profile", 17: "/" };   // 1-6 are all My Lessons
const BACK_MOVES = { 8: "/lessons", 17: "/", 18: "/settings/profile" };  // 3→2 stays put now

/* ★ `preview: true` OPENS IT THE WAY MY LESSONS DOES — with NO section, which is what makes
   `LessonView` a read-only preview and makes it claim `preview-root` rather than `lesson-root`.
   ★ `tour: "1"` FORCES THE UNIT, NOT THE CHAPTER MAP: a chapter with no progress opens on the org
   page by design, which is right for a teacher meeting it and wrong for steps 11-13.
   ⚠️ THE TAG, NOT THE KEY. `lesson.jsx` builds the section key itself, so passing the built key
   made `science_ix_science_ix_9A` — a key matching no stored section. The screen still counted as
   tracking and looked right while every read behind it answered from nothing. */
function openTourLesson(opts) {
  const tg = currentTarget();
  if (!tg) {
    console.warn("[meyy] tour: no target published — step", state.step, "cannot open a lesson");
    return;
  }
  const preview = !!(opts && opts.preview);
  router.navigate({ pathname: "/lesson", params: {
    subject: tg.subjectSlug, grade: tg.gradeSlug, filename: tg.filename,
    /* ⚠️ `tour: "1"` IS FOR THE TRACKING OPEN ONLY. It forces the UNIT instead of the chapter map,
       which steps 11-13 need — they describe the four tabs, the bookmark and Mark complete, all
       of them on the unit. Step 7 is the opposite case and I got it wrong first time: a PREVIEW
       opens on the org page on the web and must here too (founder, 2026-09-17: *"card 7 does not
       show the org page unlike web app"*). One flag, two journeys; it rides only the one that
       asked for it. */
    ...(preview ? {} : { section: tg.tag, tour: "1" }) } });
}

/* ───────── WHICH SECTION AND PLAN THE DEMO USES ─────────
 *
 * ★ DERIVED HERE, NOT WAITED FOR (founder, 2026-09-17: step 7 failed walk after walk and the
 * diagnostic said *"no target published"*). It was published by My Classes — the screen that
 * knows — which was fine while the tour opened there. It does not any more: the offer lives on
 * My Lessons, first run leaves her on My Lessons, and steps 1 and 2 now stand there too, so My
 * Classes may never mount at all. A tour whose target depends on a screen the teacher never
 * visits is a tour that breaks from step 7 onward.
 * Both caches are already warm by the time any offer is eligible — `fetchTourEligible` has read
 * `/section-state`, first run has written readiness, and My Lessons holds the plan listing — so
 * this reads what is there rather than fetching. `noteTourTarget` still WINS when a screen has
 * published one: My Classes knows about bands and ordering that readiness alone does not. */
function deriveTarget() {
  const classes = [];
  ((cachedReadiness() || {}).subjects || []).forEach((sub) => {
    const sSlug = subjectSlug(sub.name);
    (sub.grades || []).forEach((g) => {
      const gSlug = gradeSlug(g.grade);
      (g.sections || []).forEach((sec) => classes.push({
        subjectName: sub.name, subjectSlug: sSlug, grade: g.grade, gradeSlug: gSlug,
        sectionTag: sec.tag, sectionKey: `${sSlug}_${gSlug}_${sec.tag}`,
      }));
    });
  });
  for (const c of classes) {
    const rows = cachedPlans(`${c.subjectSlug}/${c.gradeSlug}`);
    const list = Array.isArray(rows) ? rows : rows ? Object.values(rows) : [];
    /* The most recently prepared, not merely the first — the tour is demonstrating on the lesson
       she has just made, and "just made" is what `prepared_at` orders by. */
    const plan = list.filter((p) => p && p.prepared && !p.archived)
      .sort((a, b) => String(b.prepared_at || "").localeCompare(String(a.prepared_at || "")))[0];
    if (plan) {
      return { subjectSlug: c.subjectSlug, gradeSlug: c.gradeSlug, sectionKey: c.sectionKey,
               filename: plan.filename, tag: c.sectionTag, chapter: plan.chapter_title, c };
    }
  }
  return null;
}

/** The published target if a screen gave us one, else what the caches can tell us. */
function currentTarget() {
  if (state.target) return state.target;
  const t = deriveTarget();
  if (t) {
    state = { ...state, target: t, info: { ...state.info, tag: t.tag, chapter: t.chapter } };
  }
  return t;
}

/* ───────── THE DEMO'S OWN BINDING — driven here, NOT by a screen ─────────
 *
 * ★ IT HAS TO LIVE IN THE MODULE BECAUSE MY CLASSES UNMOUNTS (founder, 2026-09-17: on expo the
 * report button and the archive control were still missing at cards 4 and 5, walk after walk).
 * The web runs this from `MyPlans`, which is a TAB and stays mounted the whole way through. On
 * the phone every screen is a ROUTE: the tour walks to My Lessons for steps 3-6 and the screen
 * holding the orchestration is gone — so the unbind that steps 1-9 depend on never ran, the
 * lesson card still read as attached, and the archive control (hidden on an attached plan) never
 * appeared for the ring to find. The same reasoning as the navigation move above, and the same
 * answer: what the tour must do at a step belongs to the tour.
 *
 * ★ BORROW AND GIVE BACK. The demo needs an UNBOUND section for steps 1-9 — the archive control
 * hides on an attached plan, the section card draws its "+" only when nothing is bound, and the
 * picker lists a chapter only when it is not the bound one. First run ATTACHES what it generates,
 * so the tour's audience always arrives bound. What was there is remembered, 1-9 unbind, 10 binds
 * the demo plan, and a tour that ENDS with the section empty gets it back. A completed tour ends
 * bound to the demo plan — which for a new teacher is what she had — so nothing is restored and
 * nothing is lost either way. */
let borrowed = { section: null, pre: null };

function syncDemo(n) {
  const tg = currentTarget();
  if (!tg || !tg.sectionKey || !tg.filename) return;
  const bound = readLocalSection(tg.sectionKey).chapter;
  if (n >= 10 && bound !== tg.filename) bindSectionChapter(tg.sectionKey, tg.filename);
  else if (n >= 1 && n <= 9 && bound) unbindSection(tg.sectionKey);
}

/* Captured the first time this section is the target while a tour is running — never again for
   the same section, or it would re-read a binding the demo has already taken away. */
function rememberBinding() {
  const tg = currentTarget();
  if (!state.step || !tg || !tg.sectionKey) return;
  if (borrowed.section === tg.sectionKey) return;
  borrowed = { section: tg.sectionKey,
               pre: readLocalSection(tg.sectionKey).chapter || null };
}

function restoreBinding() {
  const { section, pre } = borrowed;
  if (section && pre && !readLocalSection(section).chapter) bindSectionChapter(section, pre);
  borrowed = { section: null, pre: null };
}

/* ★ STEP 5 IS SKIPPED WHEN THERE IS NO ARCHIVE CONTROL TO RING (founder, 2026-09-18: an
   attached lesson is never archivable). My Lessons reports whether its first card shows one;
   Next from 4 then goes to 6 and Back from 6 to 4, so the step never points at nothing. */
let archivable = true;
export function noteTourArchivable(v) { archivable = v !== false; }

export function tourNext() {
  const n = state.step;
  if (n === 4 && !archivable) { setTourStep(6); return; }
  if (n === TOUR_TOTAL) { closeAsk(); endTour(); router.navigate("/"); return; }
  if (n === 18) openAsk();
  if (n === 19) closeAsk();
  if (n === 6) { openTourLesson({ preview: true }); setTourStep(7); return; }  // into the preview
  if (n === 10) { openTourLesson(); setTourStep(11); return; }                 // into the lesson
  if (n === 13) { router.navigate("/"); setTourStep(14); return; }             // and back out of it
  if (MOVES[n]) router.navigate(MOVES[n]);
  setTourStep(n + 1);
}

export function tourBack() {
  const n = state.step;
  if (n === 6 && !archivable) { setTourStep(4); return; }
  if (n === 1) { endTour(); return; }            // Back out of step 1 IS leaving the tour
  if (n === 19 || n === 20) { if (n === 20) openAsk(); else closeAsk(); }
  if (n === 7) { router.navigate("/lessons"); setTourStep(6); return; }   // back out of the preview
  if (n === 11) { router.navigate("/"); setTourStep(10); return; }        // back out of the lesson
  if (n === 14) { openTourLesson(); setTourStep(13); return; }            // and back into it
  if (BACK_MOVES[n]) router.navigate(BACK_MOVES[n]);
  setTourStep(n - 1);
}

/* ★ ONE EXIT FOR DONE AND SKIP, and it does NOT raise the set-up check window — the phone raises
   that from first run's own one-shot. Two triggers would ask her twice, and the one that survives
   is the one that also reaches a teacher who SKIPPED. See `lib/firstRun.js`.
   ⚠️ Whatever the tour opened, leaving it lands on My Classes — the web's `goClasses()` on every
   exit. Without this, Skip at step 12 would leave her inside a lesson with the overlay gone. */
export function tourSkip() { closeAsk(); endTour(); router.navigate("/"); }

/* ───────── WHO DRAWS THE OVERLAY ─────────
 * Exactly one place at a time. The shell draws it for nineteen steps out of twenty; while the
 * attach sheet is up it claims the job, because only a component INSIDE that Modal can appear
 * above it. Two overlays drawing at once would double the scrim and stack two tips. */
let overlayHost = null;                 // null = the shell · "sheet" = the attach picker
const hostListeners = new Set();
export function setTourOverlayHost(h) {
  if (overlayHost === h) return;
  overlayHost = h;
  hostListeners.forEach((fn) => { try { fn(overlayHost); } catch {} });
}
export function useTourOverlayHost() {
  const [h, setH] = useState(overlayHost);
  useEffect(() => {
    setH(overlayHost);
    hostListeners.add(setH);
    return () => hostListeners.delete(setH);
  }, []);
  return h;
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

/* ★ ONE CONDITION, BECAUSE TWO SCREENS SHOW THE NUDGE (founder, 2026-09-17: *"on expo, the tour
 * pop up comes before the lesson is complete even now. Web app is fine"*).
 * The web shows it from ONE place — `page.jsx`, above the tab — so its single `tourOnOffer` is
 * the whole rule. The phone has no shell above its routes, so My Classes and My Lessons each
 * render their own, and each had hand-rolled the terms: My Classes carried all four, My Lessons
 * carried ONE. Every fix to the offer had therefore been landing on the screen first run does
 * NOT finish on — it `replace`s to `/lessons`, which is exactly where the generation she is
 * watching appears, and exactly where the nudge was still jumping the queue.
 * ⚠️ `preparing` differs between the two screens BY DESIGN and must be passed, not read here: My
 * Classes owns a descriptor WITH a section, My Lessons owns one WITHOUT (the wait belongs where
 * the lesson will appear). Each screen knows which is its own; this function must not guess.
 *
 * The four terms, and why each is there:
 *   fit         — ≤1 bound section and nothing taught. `null` means we could not tell, and an
 *                 unknown must never look like a new teacher, so only an explicit `true` offers.
 *   step        — a tour already running is not a tour to offer.
 *   preparing   — *"it should pop up immediately after the completion of the lesson generation
 *                 and not at the same time"*. The nudge was landing on top of the wait she is
 *                 watching; two things asking for the same attention, and the one she cares about
 *                 is the chapter. It also stops the tour opening with its own target half-built,
 *                 since the demo needs a PREPARED plan to point at.
 *   acct + ran  — "once" lives on the account (`tour_offered_at`) so it survives a sign-out and a
 *                 second phone. But `cachedAccount()` is a CACHE that the spend POST does not
 *                 rewrite, so at Done every term went true again and the nudge sprang back — and
 *                 taking it again re-ran the demo over her real section. `tourRanHere()` is the
 *                 missing half. ⚠️ NOT `offeredHere()`, which flips the moment the nudge becomes
 *                 ELIGIBLE and would hide it while she is still looking at it. */
export function tourOfferOpen({ fit, step, acct, preparing }) {
  return fit === true && !step && !preparing
    && !(acct && acct.tour_offered_at) && !tourRanHere();
}
