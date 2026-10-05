/* ───────── The guided tour, twenty-one steps (step 8b; rebuilt 2026-10-05) ─────────
 *
 * ★ THE COPY IS THE WEB'S, WORD FOR WORD. Same twenty-one steps, same order, same sentences.
 *
 * ★★ THE MACHINERY WAS REBUILT ON 2026-10-05 (founder, Redmi A5: "every card highlight is above or
 * below where it should show"; asked for an approach "lighter for navigation, smoother and accurate
 * on any device"). Until then this overlay MEASURED each target in window coordinates and drew a
 * ring, a four-piece scrim and a floating tip at those numbers on its own layer — and on many
 * Androids the window's origin and this layer's origin differ by the status bar, so every ring
 * landed a bar's height off. A 500 ms re-measure, retries, scroll nudges and glides then chased
 * targets that moved as lists loaded, so the tour felt different on every run.
 * Now this component measures NOTHING to draw:
 *   · the RING is drawn by the target itself (components/TourRing.jsx, chosen per step by
 *     `TOUR_TARGETS` in lib/tour.js), so it is where the target is on every phone;
 *   · the TIP is a panel DOCKED just above the bottom bar, on every step,
 *     the same title, words and Back / Skip / Next — placed by layout, never by a coordinate;
 *   · there is no scrim. Steps that must hold the screen still lay a clear sheet under the panel;
 *     `free` steps leave it live (the preview, the lesson, the taps the copy asks for).
 * The one measurement left is SCROLLING a ringed target into view above the panel, and that sum
 * takes all three of its numbers from `measureInWindow`, so any offset a phone adds cancels.
 * ⚠️ NAMED DIVERGENCE from the web (§0, technical limitation): the web keeps its spotlight.
 */
import { useEffect, useRef } from "react";
import { View, Pressable, Animated, Easing, StyleSheet } from "react-native";
import { Text } from "./Text";
import { pinTourScroll, onAnchorRegistered, bringTourTargetIntoView, measureNodeBand,
         tourTarget, setTourPanelHeight, TOUR_TOTAL } from "../lib/tour";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BNAV_H } from "./BottomNav";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* WALK-A-016 (2026-09-20): a missing section name must still read as English. `tag` only ever
   follows the word "section", so the fallback is phrased to follow it too. */
const sec = (i) => (i.tag ? `section ${i.tag}` : "one of your sections");

/* The step table — the WORDS only. What each step points at, and how, lives in lib/tour.js
   `TOUR_TARGETS`, because the targets themselves read it to decide whether to wear the ring. */
export const STEPS = [
  { n: 1, title: "This is where your classes sit.",
    body: "The bar at the foot of the screen is how you move around Meyy. ‘My Classes’ is where your sections always are — each one points to where you have reached in its lesson plan. Soon we will see how." },
  { n: 2, title: "This is where your generated lesson plans sit.",
    body: "‘My Lessons’, beside it at the foot of the screen, holds every lesson plan you have generated — and is where you generate new ones." },
  { n: 3, title: "See the lesson plan you just now generated.",
    body: "You can filter your lesson plans by subject and class to see them all in one place." },
  { n: 4, title: "Generate PDF reports",
    body: "You can generate PDF reports of Lesson plan and assessment by clicking this button." },
  { n: 5, title: "You can archive a Lesson plan",
    body: "Push those lesson plans you no more want to see into the archive box. Restore it back anytime you need it." },
  /* WALK-A-015 (founder, 2026-09-20): steps whose copy asks her to tap something let that tap DO
     the step — `tap` in lib/tour.js TOUR_TARGETS; the ringed target advances exactly as Next does. */
  { n: 6, title: "Let us open the lesson",
    body: "Tap a lesson card to open it. Tap this one now (or press Next)." },
  { n: 7, title: "Let us open the plan to have a quick view.",
    body: (i) => `You may review a lesson plan in its entirety here anytime. We will now attach this lesson to ${sec(i)} from ‘My Classes’ at the foot of the screen.` },
  { n: 8, title: "Let us attach a lesson plan to a section.",
    body: (i) => `You want to attach “${i.chapter}” to ${sec(i)}. Click the + sign of that section card.` },
  { n: 9, title: (i) => (i.tag ? `Select a lesson plan to track for Section ${i.tag}.`
                         : "Select a lesson plan to track for this section."),
    body: "Here is where you select the different lessons to attach to your sections. You can also generate new lessons here." },
  { n: 10, title: "You are now ready to track.",
    body: (i) => `You have successfully attached “${i.chapter}” to ${sec(i)}. Tap it to see how tracking works.` },
  { n: 11, title: "You are now ready to use the plan to teach and track progress.",
    body: "Everything for a unit sits under four tabs — Overview, Material, Lesson and Assess — with clear timed steps and teacher guidance." },
  { n: 12, title: "Bookmark where you left a particular section",
    body: "Move this bookmark to any particular phase to indicate where you stopped or wish to begin next for a section. Each section will have independent bookmarks." },
  /* Step 13 — "Report an issue" (founder, 2026-10-03), the web's words: the card sits just above
     Mark complete, so it is met before completion — problems first, then progress. */
  { n: 13, title: "Spotted something wrong? Tell us.",
    body: "If anything in a unit looks wrong, report it here before you mark the unit complete. Choose WhatsApp or email, and pick the phase if you like — each report helps us improve the lesson for every teacher." },
  { n: 14, title: "Track progress.",
    body: (i) => `Track chapter progress of “${i.chapter}” with ${sec(i)} unit by unit. Upon completion of a unit, click this button to mark it complete.` },
  /* ⚠️ Step 14's body carries an inline "+" GLYPH on the web (`.gt-plus`, a 19px circled plus
     mimicking the section card's own control), not the characters "[+]". It is rendered as a
     real node below rather than substituted into the string. */
  /* Step 15 rings the "+" on the section card (founder, 2026-09-17); the ring is drawn by that "+"
     itself since 2026-10-05, so "placed just below the card" is now simply "the card is ringed". */
  { n: 15, plusBody: true,
    title: "You have completed the chapter and are now ready for the next.",
    body: "Once all units of the chapter are marked complete by you, you are ready to teach another chapter. All you need is to click " },
  { n: 16, title: "Select a plan.",
    body: "Use the same window you used a moment ago to select an existing chapter or generate a new plan." },
  { n: 17, title: "Add or amend your classes and sections.",
    body: "Use this button to add a class or a section, or to change periods a week and the annual period budget." },
  { n: 18, title: "Your teaching profile.",
    body: "Your profile is built from what you do — read it whole here, at any time. Changes are made with ‘Add’ at the foot of the screen." },
  { n: 19, title: "Use Ask Meyy to answer your queries",
    body: "Get answers to over 100 questions across 5 categories, and use intelligent search to narrow your query." },
  { n: 20, title: "Use Ask Meyy to answer your queries",
    body: "Use either the categories or the intelligent search to look for answers to your queries." },
  { n: 21, welcome: true,
    title: "Welcome to Meyy", body: null },
];

export const stepCfg = (n) => STEPS.find((s) => s.n === n) || null;

export default function GuidedTour({ step, info, onNext, onBack, onSkip }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const insets = useSafeAreaInsets();
  const cfg = stepCfg(step);
  const tg = tourTarget(step) || {};
  const panelRef = useRef(null);

  /* ── the panel arrives with each step: a short fade and rise, on the native driver ── */
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic),
                             useNativeDriver: true }).start();
  }, [step]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── keep the ringed target in view, above the panel ──
     Pinned steps (7, 11) go to the top once, on arrival — never again, or a teacher reading under
     the panel would be snapped back. Scroll steps ask `bringTourTargetIntoView` a BOUNDED number
     of times: once the screen has had a beat to settle, again after each scroll it asked for, again
     the moment a late target registers (a list waiting on the server), and once more a second
     after it first reads "in view" — a long list can still shift as its status lines fill in.
     Then it stops. No interval, no chase: the ring needs none of this to be RIGHT, only to be SEEN. */
  useEffect(() => {
    if (!cfg) return undefined;
    if (tg.scrollTop) pinTourScroll();
    if (!tg.scroll || !tg.ring) return undefined;
    let alive = true;
    let tries = 0;
    let confirmed = false;
    let timer = null;
    const later = (ms) => { clearTimeout(timer); timer = setTimeout(attempt, ms); };
    async function attempt() {
      if (!alive || tries >= 7) return;
      tries += 1;
      const band = await measureNodeBand(panelRef.current);
      if (!alive) return;
      const res = await bringTourTargetIntoView(tg.ring, band ? band.top : null);
      if (!alive) return;
      if (res === "moved") later(450);
      else if (res === "absent") later(300);
      else if (res === "ok" && !confirmed) { confirmed = true; later(1000); }
    }
    later(250);
    const off = onAnchorRegistered((name) => { if (alive && name === tg.ring) later(120); });
    return () => { alive = false; clearTimeout(timer); off(); };
  }, [step]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg || step < 1 || step > TOUR_TOTAL) return null;

  const txt = (v) => (typeof v === "function" ? v({ tag: "", chapter: "your lesson", ...(info || {}) }) : v);
  const last = step === TOUR_TOTAL;
  /* Above the bottom bar, ALWAYS (WALK-A-028: a tip must never sit over the app's nav). Inside the
     attach picker too (founder, 2026-10-05: step 16 "hides the bottom nav partly") — the bar stays
     in view under that window, so the panel keeps the one place it has on every other step. */
  const bottom = BNAV_H + (insets.bottom || 0) + 10;

  return (
    <View style={ws.gt_root} pointerEvents="box-none">
      {/* Holding the screen still, as the old scrim did — but clear, so nothing is dimmed and
          nothing has to line up with anything. Absent on `free` steps. */}
      {!tg.free ? <View style={StyleSheet.absoluteFill} pointerEvents="auto" /> : null}

      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom,
                                              alignItems: "center", paddingHorizontal: 12 }}>
        <Animated.View ref={panelRef} collapsable={false}
          style={[ws.gt_tip, { position: "relative", width: "100%", maxWidth: 460,
                               backgroundColor: t.tint_pine, borderColor: t.pine },
                  { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
          onLayout={(e) => setTourPanelHeight(e.nativeEvent.layout.height)}
          accessibilityLiveRegion="polite" accessibilityLabel="Getting started">
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
        </Animated.View>
      </View>
    </View>
  );
}
