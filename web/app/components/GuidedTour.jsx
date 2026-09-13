"use client";
import { useEffect, useRef, useState } from "react";

/* ───────── GuidedTour — the one-time first-run walk, 20 steps (bookmark step added
 * 2026-08-25) ─────────
 * Launched from the "Show me how" nudge on My Classes after the first lesson is generated but not
 * yet attached. Guide-driven: every step has Back · Skip · Next and an "N of 20" counter; Next
 * itself performs the move (nav, opening the preview, the popup, the attach, the profile), with a
 * TRANSPARENT outline hand (SVG, not the filled emoji) showing where the real tap would land.
 * Steps 13–15 demo the completed state without touching her real progress.
 *
 * Step model (1-based; page.jsx owns shell navigation, MyPlans/MyLessonPlans own view state):
 *    1 My Classes (bottom nav) — where your classes sit
 *    2 My Lessons (bottom nav) — where your generated lesson plans sit
 *    3 the lesson row + hand  — the plan she just generated (hand centred on the card)
 *    4 the report button + hand — generate PDF reports of the lesson plan / assessment
 *    5 the archive button + hand — archive a lesson plan (restore it anytime)
 *    6 open the lesson + hand — the same card as step 3; Next opens the preview
 *    7 the open preview       — the preview is now open (no hand)
 *    8 section card's "+"     — hand on +; Next opens the picker (the app itself now ALWAYS
 *                               routes + through the window — no direct attach)
 *    9 the track-a-chapter popup, hand on the just-generated lesson row — Next attaches it
 *   10 the attached card      — success; Next opens it
 *   11 the tracking view      — box lifted above the notes/mark-complete tail so both stay visible
 *   12 the phase BOOKMARK + hand — drag it to where you stopped / begin next; per section
 *   13 Mark-complete + hand   — demo only, never really clicked
 *   14 completed card's "+"   — card demoed as Complete; box pinned to the viewport bottom so the
 *                               progress rail AND the second section card stay visible
 *   15 the popup again        — pick the next chapter (bound one excluded)
 *   16 the bottom nav's "Add"  — add/amend sections, classes or subjects (the standing portal)
 *   17 the settings gear      — where the teaching profile lives
 *   18 the bottom nav's Ask Meyy — up to 100 Q&A across 5 categories + intelligent search
 *   19 Ask Aruvi OPEN          — page.jsx opens the panel on 18→19; the box rings the panel itself
 *   20 "Welcome to Aruvi"      — a centred sign-off, no anchor, no hand; Done lands on My Classes
 *
 * Anchor extras per step: `handAnchor` (hand on a different element than the ring, e.g. the row
 * inside the popup), `tipAnchor` (tooltip placed off another element — first match in the array
 * wins, e.g. above the teacher-notes block), `scrollAnchor` (what to scroll into view).
 *
 * The tooltip is the SAME thematic sage-pine "window" as the nudge (.dash-nudge) — one visual
 * voice across the whole first-run journey. Sits ABOVE ap-overlay modals (z 70 > 60). */

const fallback = { tag: "your section", chapter: "your lesson" };

// The circled "+" exactly as it appears on the section card (mini .sc-add look).
const Plus = () => <span className="gt-plus" aria-hidden="true">+</span>;

// Transparent outline hand (white, see-through body — NOT the filled emoji): an index-up pointing
// hand silhouette, stroked in ink with a translucent paper fill so the target shows through.
const Hand = () => (
  <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
    <path
      d="M12 1.5c-1.4 0-2.5 1.1-2.5 2.5v9.2L7.6 11.3c-1-1-2.6-1-3.5 0-1 1-1 2.5 0 3.5l6 6.2c1.3 1.4 3.2 2.2 5.1 2.2h1.3c3.9 0 7-3.1 7-7v-4.2c0-1.4-1.1-2.5-2.5-2.5-.5 0-.9.1-1.3.4-.4-1-1.3-1.6-2.4-1.6-.5 0-1 .2-1.4.4-.4-.9-1.3-1.6-2.4-1.6-.3 0-.7.1-1 .2V4c0-1.4-1.1-2.5-2.5-2.5z"
      fill="rgba(255,255,255,.42)" stroke="#2b2b26" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const STEPS = [
  { anchor: "nav-classes", place: "above",
    title: "This is where your classes sit.",
    body: () => "The bar at the foot of the screen is how you move around Meyy. ‘My Classes’ is where your sections always are — each one points to where you have reached in its lesson plan. Soon we will see how." },
  { anchor: "nav-lessons", place: "above",
    title: "This is where your generated lesson plans sit.",
    body: () => "‘My Lessons’, beside it at the foot of the screen, holds every lesson plan you have generated — and is where you generate new ones." },
  { anchor: "lesson-first", place: "below", hand: true, handPos: "center",
    title: "See the lesson plan you just now generated.",
    body: () => "You can filter your lesson plans by subject and class to see them all in one place." },
  // Step 4 — the report button on the just-generated lesson card. Hand centred on the icon.
  { anchor: "lesson-report", place: "below",
    title: "Generate PDF reports",
    body: () => "You can generate PDF reports of Lesson plan and assessment by clicking this button." },
  // Step 5 — the archive button on the lesson card. Hand centred on the icon.
  { anchor: "lesson-archive", place: "below",
    title: "You can archive a Lesson plan",
    body: () => "Push those lesson plans you no more want to see into the archive box. Restore it back anytime you need it." },
  // Step 6 — "open the lesson": rings the same lesson card as step 3 (identical anchor + centred
  // hand). Next opens the preview (MyLessonPlans drives that off tourStep === 7).
  { anchor: "lesson-first", place: "below",
    title: "Let us open the lesson",
    body: () => "click on the lesson card to open a particular lesson" },
  // Box LIFTED above the sticky "Attach to a class" bar (lift 130) so the bottom stays visible.
  // No hand here — the copy no longer asks her to tap anything; Next moves on to My Classes.
  { anchor: "preview-root", place: "over", lift: 130,
    scrollTop: true,
    title: "Let us open the plan to have a quick view.",
    body: (i) => `You may review a lesson plan in its entirety here anytime. We will now attach this lesson to section ${i.tag} from ‘My Classes’ at the foot of the screen.` },
  { anchor: "section-add", place: "below", hand: true,
    title: "Let us attach a lesson plan to a section.",
    body: (i) => `You want to attach “${i.chapter}” to section ${i.tag}. Click the + sign of that section card.` },
  { anchor: "attach-pop", handAnchor: "attach-pop-row", handPos: "center", place: "over", hand: true,
    title: (i) => `Select a lesson plan to track for Section ${i.tag}.`,
    body: () => "Here is where you select the different lessons to attach to your sections. You can also generate new lessons here." },
  { anchor: "section-card-target", handPos: "center", place: "below", hand: true,
    title: "You are now ready to track.",
    body: (i) => `You have successfully attached “${i.chapter}” for section ${i.tag}. Let us click it to see how tracking works.` },
  // Box hangs just BELOW the unit's tab bar, view held at the top — the chapter header,
  // progress bar and the tabs all stay visible above it (tabs replaced the stacked
  // anatomy 2026-07-10; lesson-phase-1 kept as a fallback for mid-transition renders).
  { anchor: "lesson-root", place: "below", tipAnchor: ["unit-tabs", "lesson-phase-1"], scrollTop: true,
    title: "You are now ready to use the plan to teach and track progress.",
    body: () => "Everything for a unit sits under four tabs — Overview, Material, Lesson and Assess — with clear timed steps and teacher guidance." },
  // Step 12 — the phase BOOKMARK (founder, 2026-08-25): visible because step 11 opened
  // the tracking view on the in-progress unit's Lesson tab, which is the bookmark's home.
  // Box ABOVE the bookmark — placed below it covered the very thing being introduced
  // (founder, live, 2026-08-25).
  { anchor: "phase-bookmark", place: "above",
    title: "Bookmark where you left a particular section",
    body: () => "Move this bookmark to any particular phase to indicate where you stopped or wish to begin next for a section. Each section will have independent bookmarks." },
  { anchor: "mark-complete", place: "above", hand: true,
    title: "Track progress.",
    body: (i) => `Track chapter progress of “${i.chapter}” with section ${i.tag} unit by unit. Upon completion of a unit, click this button to mark it complete.` },
  // Box lifted off the bottom edge of the phone screen (lift = 10% of the viewport height) —
  // high enough to clear mobile browser bars, low enough to keep the SECOND section card visible.
  { anchor: "section-add", place: "over", lift: 0.1, hand: true,
    title: "You have completed the chapter and are now ready for the next.",
    body: () => <>Once all units of the chapter are marked complete by you, you are ready to teach another chapter. All you need is to click <Plus />.</> },
  { anchor: "attach-pop", place: "over",
    title: "Select a plan.",
    body: () => "You can use the same window shown in step 8 to select an existing chapter or generate a new plan." },
  { anchor: "grow-add", place: "above",
    title: "Add/amend sections, classes and/or subjects.",
    body: () => "Use this button to quickly add sections, classes or subjects to your teaching profile." },
  /* Step 17 — the settings gear. ★ RE-WORDED 2026-08-28 (founder): the profile is now a VIEW.
     Every pencil moved to the "+" window of step 16 when the two doors onto one record were
     closed to one (CLAUDE.md, 2026-08-27) — so a card promising she can "build and edit" here
     was pointing her at controls that no longer exist. The single act left behind the master
     toggle is REMOVING a subject, which the "+" deliberately cannot do (adding one is a
     purchase), and that is what this card now says. */
  { anchor: "settings-gear", place: "below",
    title: "Your teaching profile.",
    body: () => "Your profile is built from what you do — read it whole here, at any time. Changes are made with ‘Add’ at the foot of the screen; removing a subject is the one thing done here." },
  // Step 18 — Ask Meyy (the stream-a mark in the bottom nav). Transparent hand centred on it.
  { anchor: "ask-aruvi", place: "above",
    title: "Use Ask Meyy to answer your queries",
    body: () => "Get answers for up to 100 questions across 5 categories and use intelligent search to narrow your query." },
  // Step 18 — the panel is now OPEN (page.jsx opened it on Next from 17), so she sees the thing
  // itself rather than a mark that promises it. "over" because the target IS the whole modal.
  { anchor: "ask-aruvi-root", place: "over",
    title: "Use Ask Meyy to answer your queries",
    body: () => "Use either the categories or the intelligent search to look for answers to your queries." },
  // Step 19 — the sign-off. No anchor and no hand: nothing to point at, so the scrim dims the whole
  // screen and the greeting sits dead centre. `center` is the third placement mode (see tipStyle).
  { anchor: null, place: "center", center: true, welcome: true,
    title: "Welcome to Meyy",
    body: null },
];
const TOTAL = STEPS.length;

const rectOf = (el) => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};
const q = (name) => (name ? document.querySelector(`[data-tour="${name}"]`) : null);
const qFirst = (names) => {
  for (const n of [].concat(names || [])) { const el = q(n); if (el) return el; }
  return null;
};

export default function GuidedTour({ step, info, onNext, onBack, onSkip }) {
  const cfg = step >= 1 && step <= TOTAL ? STEPS[step - 1] : null;
  const [rects, setRects] = useState(null);   // { ring, tip, hand } viewport rects
  // Auto-scroll bookkeeping. INSTANT scrolls with a few retries — smooth scrollIntoView proved
  // unreliable here (silently no-oped on some layouts, and mid-scroll screenshots look broken);
  // retries cover targets whose page grows after mount (fonts, async content).
  const scrollRef = useRef({ step: null, tries: 0, last: 0 });

  // Measure the targets on a light poll so the spotlight tracks navigation, scrolls, resizes and
  // targets that mount after the step transition (previews / modals open asynchronously).
  useEffect(() => {
    if (!cfg) { setRects(null); return; }
    let live = true;
    const measure = () => {
      if (!live) return;
      const el = q(cfg.anchor);
      if (!el) { setRects(null); return; }
      const tipEl = cfg.tipAnchor ? (qFirst(cfg.tipAnchor) || el) : el;
      const handEl = cfg.handAnchor ? (qFirst(cfg.handAnchor) || el) : el;
      const scrollEl = cfg.scrollAnchor ? (q(cfg.scrollAnchor) || el) : el;
      // Bring an off-screen target into view (e.g. Mark complete below the fold) — instant,
      // retried a few times per step in case the layout is still settling. cfg.scrollTop pins
      // the view to the very top instead (step 8: header → phase 1 visible).
      const st = scrollRef.current;
      if (st.step !== step) { st.step = step; st.tries = 0; st.last = 0; }
      const now = Date.now();
      if (cfg.scrollTop) {
        // At most TWO pins to the top — never keep snapping back if the teacher then scrolls
        // to read the plan under the box (the repeated snap read as "garbled" on a phone).
        // In shell mode the app scrolls .bodycontent, not the window (html.app-shell).
        const sc = document.querySelector(".bodycontent");
        const sy = sc ? sc.scrollTop : window.scrollY;
        if (sy > 0 && st.tries < 2 && now - st.last > 400) {
          st.tries += 1; st.last = now;
          (sc || window).scrollTo(0, 0);
        }
      } else {
        const sr = scrollEl.getBoundingClientRect();
        if ((sr.top < 0 || sr.bottom > window.innerHeight) && st.tries < 5 && now - st.last > 400) {
          st.tries += 1; st.last = now;
          scrollEl.scrollIntoView({ block: "center" });
        }
      }
      setRects({ ring: rectOf(el), tip: rectOf(tipEl), hand: rectOf(handEl) });
    };
    measure();
    const iv = setInterval(measure, 200);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      live = false;
      clearInterval(iv);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [cfg, step]);

  if (!cfg) return null;
  const i = { ...fallback, ...(info || {}) };

  const PAD = 8;
  const pad = (r) => ({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  const ring = rects ? pad(rects.ring) : null;
  const tipBox = rects ? pad(rects.tip) : null;
  const handBox = rects ? pad(rects.hand) : null;

  // Tooltip placement. "below"/"above" hang off the tip target (clamped to the viewport); "over"
  // pins the box near the bottom of the screen — used when the target IS the whole view or a
  // modal. cfg.lift raises an "over" box off the bottom: a fraction (<1) of the viewport height,
  // or an absolute px value (e.g. above the sticky attach bar).
  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const tw = Math.min(vw * 0.88, 330);
  let tipStyle;
  if (cfg.center) {
    // Dead centre, both axes — the sign-off card, anchored to nothing.
    tipStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  } else if (cfg.place === "over" || !tipBox) {
    const lift = cfg.lift ? (cfg.lift < 1 ? Math.round(vh * cfg.lift) : cfg.lift) : 18;
    tipStyle = { bottom: lift, left: "50%", transform: "translateX(-50%)" };
  } else {
    const left = Math.min(Math.max(12, tipBox.left), Math.max(12, vw - tw - 12));
    if (cfg.place === "above") {
      tipStyle = { top: tipBox.top - 12, left, transform: "translateY(-100%)" };
    } else {
      // "below" — but CLAMPED to the viewport: if the target's underside is near/past the fold
      // (long chapter titles push phase 1 down on phones), the box settles onto the lower body
      // of the view instead of dropping off-screen.
      const top = Math.min(tipBox.top + tipBox.height + 12, Math.max(80, vh - 260));
      tipStyle = { top, left };
    }
  }

  // The hand — lower-right corner of its target by default; handPos "center" places it in the
  // middle of the target (e.g. centred on a listed lesson row / section card). Viewport-clamped.
  const handStyle = handBox && cfg.hand
    ? (cfg.handPos === "center"
        ? { top: Math.min(handBox.top + handBox.height / 2 - 18, vh - 52),
            left: Math.min(handBox.left + handBox.width / 2 - 18, vw - 46) }
        : { top: Math.min(handBox.top + handBox.height - 16, vh - 52),
            left: Math.min(handBox.left + handBox.width - 24, vw - 46) })
    : null;

  const title = typeof cfg.title === "function" ? cfg.title(i) : cfg.title;

  return (
    <div className="gt-root gt-block">
      {/* Scrim: hit-blocking everywhere (the guide drives every move); the visual dim comes from
          the ring's box-shadow cutout once a target is measured. */}
      <div className="gt-scrim" style={{ background: ring ? "transparent" : "rgba(31,42,36,.42)" }}
        onClick={(e) => e.stopPropagation()} />

      {ring && (
        <div className="gt-ring" style={{ top: ring.top, left: ring.left, width: ring.width, height: ring.height }} />
      )}
      {handStyle && (
        <div className="gt-hand" style={handStyle} aria-hidden="true"><Hand /></div>
      )}

      <div className={`gt-tip${cfg.welcome ? " gt-tip-welcome" : ""}`} style={{ ...tipStyle, width: tw }}
        role="dialog" aria-label="Getting started">
        <div className="gt-tip-title">{title}</div>
        {cfg.body ? <div className="gt-tip-body">{cfg.body(i)}</div> : null}
        <div className="gt-tip-foot">
          <span className="gt-count">{step} of {TOTAL}</span>
          <span className="gt-tip-actions">
            <button type="button" className="gt-back" onClick={onBack}>&larr; Back</button>
            <button type="button" className="gt-skip" onClick={onSkip}>Skip</button>
            <button type="button" className="gt-next" onClick={onNext}>
              {step === TOTAL ? "Done ✓" : "Next →"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
