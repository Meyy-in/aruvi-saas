/* ───────── The guided tour, twenty steps (step 8b) ─────────
 *
 * ★ THE COPY IS THE WEB'S, WORD FOR WORD. This file is a transcription, not a redesign: the same
 * twenty steps, the same anchors, the same order. What was REBUILT is the machinery — see
 * `lib/tour.js` for the registry that replaces `document.querySelector` and the measure-on-event
 * rule that replaces the web's 200 ms poll.
 *
 * ★ THE RING IS FOUR VIEWS, NOT A SHADOW. The web cuts its spotlight with `box-shadow: 0 0 0
 * 9999px` — one element that is both the outline and the dimming. React Native has no such
 * trick, so the scrim is drawn as four rectangles around the ring's rect. ⚠️ That substitution
 * is a GIFT rather than a cost: four real Views give hit-blocking for free and leave the hole
 * genuinely tappable, where the web has to set `pointer-events` on a stack of layers to get the
 * same thing. The teacher can still press the control the ring is around.
 *
 * ⚠️ NO RING MEANS THE WHOLE SCREEN DIMS — that is the web's behaviour for the centred welcome
 * step, and also what happens when an anchor has not mounted yet. Both want the same thing: say
 * something is happening, point at nothing in particular, and never leave her looking at a ring
 * around empty paper.
 */
import { useEffect, useMemo, useState, useRef } from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "./Text";
import { measureAnchor, measureFirst, pinTourScroll, onAnchorRegistered } from "../lib/tour";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export const TOUR_TOTAL = 20;
const SCRIM = "rgba(31,42,36,0.42)";
const PAD = 8;          // the web inflates every measured rect by this before drawing
const RING_R = 12;

/* The step table — anchors are the web's own `data-tour` strings, and MUST stay identical:
   one table serves both surfaces, and invented names let them drift without failing loudly. */
export const STEPS = [
  { n: 1, anchor: "nav-classes", place: "above",
    title: "This is where your classes sit.",
    body: "The bar at the foot of the screen is how you move around Meyy. ‘My Classes’ is where your sections always are — each one points to where you have reached in its lesson plan. Soon we will see how." },
  { n: 2, anchor: "nav-lessons", place: "above",
    title: "This is where your generated lesson plans sit.",
    body: "‘My Lessons’, beside it at the foot of the screen, holds every lesson plan you have generated — and is where you generate new ones." },
  { n: 3, anchor: "lesson-first", place: "below", hand: true, handPos: "center",
    title: "See the lesson plan you just now generated.",
    body: "You can filter your lesson plans by subject and class to see them all in one place." },
  { n: 4, anchor: "lesson-report", place: "below",
    title: "Generate PDF reports",
    body: "You can generate PDF reports of Lesson plan and assessment by clicking this button." },
  { n: 5, anchor: "lesson-archive", place: "below",
    title: "You can archive a Lesson plan",
    body: "Push those lesson plans you no more want to see into the archive box. Restore it back anytime you need it." },
  { n: 6, anchor: "lesson-first", place: "below",
    title: "Let us open the lesson",
    body: "click on the lesson card to open a particular lesson" },
  { n: 7, anchor: "preview-root", place: "over", lift: 130, scrollTop: true,
    title: "Let us open the plan to have a quick view.",
    body: (i) => `You may review a lesson plan in its entirety here anytime. We will now attach this lesson to section ${i.tag} from ‘My Classes’ at the foot of the screen.` },
  { n: 8, anchor: "section-add", place: "below", hand: true,
    title: "Let us attach a lesson plan to a section.",
    body: (i) => `You want to attach “${i.chapter}” to section ${i.tag}. Click the + sign of that section card.` },
  { n: 9, anchor: "attach-pop", handAnchor: "attach-pop-row", handPos: "center", place: "over", hand: true,
    title: (i) => `Select a lesson plan to track for Section ${i.tag}.`,
    body: "Here is where you select the different lessons to attach to your sections. You can also generate new lessons here." },
  { n: 10, anchor: "section-card-target", place: "below", hand: true, handPos: "center",
    title: "You are now ready to track.",
    body: (i) => `You have successfully attached “${i.chapter}” for section ${i.tag}. Let us click it to see how tracking works.` },
  { n: 11, anchor: "lesson-root", place: "below", tipAnchor: ["unit-tabs", "lesson-phase-1"], scrollTop: true,
    title: "You are now ready to use the plan to teach and track progress.",
    body: "Everything for a unit sits under four tabs — Overview, Material, Lesson and Assess — with clear timed steps and teacher guidance." },
  { n: 12, anchor: "phase-bookmark", place: "above",
    title: "Bookmark where you left a particular section",
    body: "Move this bookmark to any particular phase to indicate where you stopped or wish to begin next for a section. Each section will have independent bookmarks." },
  { n: 13, anchor: "mark-complete", place: "above", hand: true,
    title: "Track progress.",
    body: (i) => `Track chapter progress of “${i.chapter}” with section ${i.tag} unit by unit. Upon completion of a unit, click this button to mark it complete.` },
  /* ⚠️ Step 14's body carries an inline "+" GLYPH on the web (`.gt-plus`, a 19px circled plus
     mimicking the section card's own control), not the characters "[+]". It is rendered as a
     real node below rather than substituted into the string. */
  { n: 14, anchor: "section-add", place: "over", lift: 0.1, hand: true, plusBody: true,
    title: "You have completed the chapter and are now ready for the next.",
    body: "Once all units of the chapter are marked complete by you, you are ready to teach another chapter. All you need is to click " },
  { n: 15, anchor: "attach-pop", place: "over",
    title: "Select a plan.",
    body: "You can use the same window shown in step 8 to select an existing chapter or generate a new plan." },
  { n: 16, anchor: "grow-add", place: "above",
    title: "Add/amend sections, classes and/or subjects.",
    body: "Use this button to quickly add sections, classes or subjects to your teaching profile." },
  { n: 17, anchor: "settings-gear", place: "below",
    title: "Your teaching profile.",
    body: "Your profile is built from what you do — read it whole here, at any time. Changes are made with ‘Add’ at the foot of the screen; removing a subject is the one thing done here." },
  { n: 18, anchor: "ask-aruvi", place: "above",
    title: "Use Ask Meyy to answer your queries",
    body: "Get answers for up to 100 questions across 5 categories and use intelligent search to narrow your query." },
  { n: 19, anchor: "ask-aruvi-root", place: "over",
    title: "Use Ask Meyy to answer your queries",
    body: "Use either the categories or the intelligent search to look for answers to your queries." },
  { n: 20, anchor: null, place: "center", welcome: true,
    title: "Welcome to Meyy", body: null },
];

export const stepCfg = (n) => STEPS.find((s) => s.n === n) || null;

/* The translucent outline hand — deliberately NOT the filled emoji, which reads as a sticker and
   carries whatever the platform font decides about skin tone. */
const Hand = () => (
  <Svg width={36} height={36} viewBox="0 0 24 24" fill="rgba(255,255,255,0.42)"
    stroke="#2b2b26" strokeWidth={1.4} strokeLinejoin="round">
    <Path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5v-3a1.5 1.5 0 0 1 3 0v4m0-2.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5.2-3L4 16.2a1.6 1.6 0 0 1 2.7-1.7L9 17" />
  </Svg>
);

export default function GuidedTour({ step, info, onNext, onBack, onSkip }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const { width: vw, height: vh } = useWindowDimensions();
  const cfg = stepCfg(step);
  const [rects, setRects] = useState(null);
  const [tick, setTick] = useState(0);

  /* ★ MEASURE ON STEP CHANGE, ON ROTATION, AND WHEN AN ANCHOR SAYS IT MOVED — never on a timer.
     ⚠️ `alive` is not ceremony: `measureInWindow` is asynchronous, and a fast Next would
     otherwise land the PREVIOUS step's rect on the next step's screen. */
  /* Pin ONCE on arriving at a step that asks for it — never on re-measure, or a teacher who
     scrolled to read under the tip would be snapped back while reading. */
  useEffect(() => { if (cfg && cfg.scrollTop) pinTourScroll(); }, [step]);   // eslint-disable-line

  useEffect(() => {
    if (!cfg) { setRects(null); return undefined; }
    let alive = true;
    (async () => {
      const ring = cfg.anchor ? await measureAnchor(cfg.anchor) : null;
      const tip = cfg.tipAnchor ? await measureFirst(cfg.tipAnchor) : ring;
      const hand = cfg.handAnchor ? await measureAnchor(cfg.handAnchor) : ring;
      if (alive) setRects({ ring, tip, hand });
    })();
    return () => { alive = false; };
  }, [step, cfg, vw, vh, tick]);

  /* ★ AN ANCHOR CAN ARRIVE LONG AFTER ITS STEP. A route change is a beat; a list that waits on
     the server is a second or more, and My Lessons paints "Loading plans…" until it answers. The
     registry now SAYS when a name appears, so the ring lands the moment its target exists rather
     than at a guessed delay — that is the mechanism, and it costs nothing while nothing changes.
     ⚠️ THE TIMED RETRY STAYS AS A BACKSTOP, but bounded: registration is not the only way a rect
     becomes measurable — a node already registered can still measure as a zero box while it is
     laying out, and no event fires for that. Four tries over ~2s, then it stops; an unbounded
     retry is the poll this design exists to avoid. */
  useEffect(() => {
    if (!cfg || !cfg.anchor) return undefined;
    return onAnchorRegistered((name) => {
      if (name === cfg.anchor || name === cfg.handAnchor
          || [].concat(cfg.tipAnchor || []).includes(name)) setTick((n) => n + 1);
    });
  }, [cfg]);

  /* ★ AND ONE CONFIRMING RE-MEASURE PER STEP, whether or not a rect was found. A measurement
     taken while the screen is still settling after a route change answers with a position that
     is real but already stale — the ring lands near its target rather than on it (founder,
     2026-09-17: card 8 *"highlights above the + and not the plus"*). The found/not-found retry
     below cannot catch that: it stops the moment there IS a ring, right or wrong. */
  useEffect(() => {
    if (!cfg || !cfg.anchor) return undefined;
    const id = setTimeout(() => setTick((n) => n + 1), 450);
    return () => clearTimeout(id);
  }, [step]);   // eslint-disable-line react-hooks/exhaustive-deps

  const tries = useRef(0);
  useEffect(() => { tries.current = 0; }, [step]);
  useEffect(() => {
    if (!cfg || !cfg.anchor || (rects && rects.ring) || tries.current >= 4) return undefined;
    const id = setTimeout(() => { tries.current += 1; setTick((n) => n + 1); }, 220 + tries.current * 500);
    return () => clearTimeout(id);
  }, [cfg, rects, step]);

  const tw = Math.min(vw * 0.88, 330);
  const ring = rects && rects.ring
    ? { x: rects.ring.x - PAD, y: rects.ring.y - PAD,
        w: rects.ring.width + PAD * 2, h: rects.ring.height + PAD * 2 }
    : null;

  const tipPos = useMemo(() => {
    if (!cfg) return null;
    if (cfg.place === "center") return { top: vh / 2 - 90, left: (vw - tw) / 2, width: tw };
    const box = rects && rects.tip
      ? { top: rects.tip.y - PAD, left: rects.tip.x - PAD,
          height: rects.tip.height + PAD * 2 }
      : null;
    if (cfg.place === "over" || !box) {
      const lift = cfg.lift ? (cfg.lift < 1 ? Math.round(vh * cfg.lift) : cfg.lift) : 18;
      return { bottom: lift, left: (vw - tw) / 2, width: tw };
    }
    const left = Math.min(Math.max(12, box.left), Math.max(12, vw - tw - 12));
    if (cfg.place === "above") {
      /* RN has no `translateY(-100%)`, so the tip is anchored by its BOTTOM edge instead —
         the same result without needing to know its height first. */
      return { bottom: Math.max(12, vh - (box.top - 12)), left, width: tw };
    }
    return { top: Math.min(box.top + box.height + 12, Math.max(80, vh - 260)), left, width: tw };
  }, [cfg, rects, vw, vh, tw]);

  const handPos = useMemo(() => {
    if (!cfg || !cfg.hand || !rects || !rects.hand) return null;
    const b = rects.hand;
    if (cfg.handPos === "center") {
      return { top: Math.min(b.y + b.height / 2 - 18, vh - 52),
               left: Math.min(b.x + b.width / 2 - 18, vw - 46) };
    }
    return { top: Math.min(b.y + b.height - 16, vh - 52),
             left: Math.min(b.x + b.width - 24, vw - 46) };
  }, [cfg, rects, vw, vh]);

  if (!cfg || step < 1 || step > TOUR_TOTAL) return null;

  const txt = (v) => (typeof v === "function" ? v({ tag: "your section", chapter: "your lesson", ...(info || {}) }) : v);
  const last = step === TOUR_TOTAL;

  /* Four rectangles around the ring — and nothing over the ring itself, so the control inside it
     stays live. With no ring, one rectangle covers everything. */
  const scrim = ring ? [
    { top: 0, left: 0, right: 0, height: Math.max(0, ring.y) },
    { top: ring.y + ring.h, left: 0, right: 0, bottom: 0 },
    { top: ring.y, left: 0, width: Math.max(0, ring.x), height: ring.h },
    { top: ring.y, left: ring.x + ring.w, right: 0, height: ring.h },
  ] : [{ top: 0, left: 0, right: 0, bottom: 0 }];

  return (
    <View style={ws.gt_root} pointerEvents="box-none">
      {scrim.map((p, i) => (
        <View key={i} pointerEvents="auto" style={[{ position: "absolute", backgroundColor: SCRIM }, p]} />
      ))}
      {ring ? (
        <View pointerEvents="none" style={[ws.gt_ring, {
          borderColor: t.ochre, top: ring.y, left: ring.x, width: ring.w, height: ring.h,
          borderRadius: RING_R,
        }]} />
      ) : null}
      {handPos ? <View pointerEvents="none" style={[ws.gt_hand, handPos]}><Hand /></View> : null}

      <View style={[ws.gt_tip, tipPos, { backgroundColor: t.tint_pine, borderColor: t.pine }]}
        accessibilityRole="none" accessibilityLabel="Getting started">
        <Text style={[ws.gt_tip_title, cfg.welcome && ws.gt_tip_title_welcome, { color: t.pine_d }]}>
          {txt(cfg.title)}
        </Text>
        {cfg.body ? (
          <Text style={[ws.gt_tip_body, { color: t.ink_soft }]}>
            {txt(cfg.body)}
            {cfg.plusBody ? <Text style={[ws.gt_plus, { color: t.pine_d, borderColor: t.pine_d }]}> + </Text> : null}
            {cfg.plusBody ? "." : null}
          </Text>
        ) : null}
        <View style={ws.gt_foot}>
          <Text style={ws.gt_count}>{step} of {TOUR_TOTAL}</Text>
          <View style={ws.gt_foot_btns}>
            <Pressable onPress={onBack} hitSlop={8}><Text style={ws.gt_btn}>← Back</Text></Pressable>
            <Pressable onPress={onSkip} hitSlop={8}><Text style={ws.gt_btn}>Skip</Text></Pressable>
            <Pressable onPress={onNext} hitSlop={8}
              style={[ws.gt_next, { backgroundColor: t.pine }]}>
              <Text style={[ws.gt_next_t, { color: t.paper }]}>{last ? "Done ✓" : "Next →"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
