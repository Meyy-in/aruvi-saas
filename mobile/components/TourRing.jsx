/* ───────── The tour's ring, drawn BY its target (2026-10-05) ─────────
 *
 * ★ WHY THIS EXISTS (founder, Redmi A5: "every card highlight is above or below where it should
 * show"). The ring used to be aimed: the overlay measured the target in WINDOW coordinates and
 * drew the ring on its own layer in LAYOUT coordinates. Those two origins agree on an iPhone and
 * disagree by a status bar on many Androids — and a measured ring also has to chase a target that
 * moves while a list loads. A ring rendered INSIDE its target is part of the target's own layout:
 * it is where the card is on every phone, at every text size, mid-scroll and mid-load, and there
 * is nothing to measure, poll or glide.
 *
 * Usage — the LAST child of the element that should wear it, so it paints over that element's
 * contents:   {tourName ? <TourRing name={tourName} radius={11} /> : null}
 * It renders nothing unless `name` is the current step's `ring` in lib/tour.js `TOUR_TARGETS`.
 *
 *   radius — the target's own corner radius, so the ring follows its shape
 *   out     — how far OUTSIDE the target to draw (small controls: a ring on the edge of a 30px
 *             circle reads as its own border, so it stands off a few points). Mind clipping:
 *             a parent with `overflow: hidden` cuts whatever stands outside it.
 *   inner   — draw the halo's wash INSIDE the line instead of outside it: for targets that clip
 *             their own children (the section/lesson cards, `overflow: hidden`) or sit in a
 *             clipping list (the picker's rows), where an outside wash would be cut away.
 *   onBar   — the target sits on the pine top bar, where a pine line would vanish: use the bar's
 *             own cream ink instead.
 *
 * ★ THE LOOK IS THE "PINE HALO" (founder, 2026-10-05, option C of five shown side by side —
 * the ochre ring "is quite unlike Meyy colors"): a crisp pine line, and a soft pine wash 2 points
 * beyond it that breathes. Meyy's own green, the same as the tour panel's border and its Next
 * button, so the ring and the panel read as one thing.
 *
 * ⚠️ `pointerEvents="none"` on the ring and the hand, always — the target stays exactly as
 * pressable as it was. Only a `tap` step adds a press layer, and that one advances the tour the
 * way Next does (WALK-A-015), which is why the ringed "+" at step 8 opens the picker by moving the
 * TOUR rather than by opening it behind the tour's back.
 */
import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, Easing, AccessibilityInfo, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTour, tourTarget, tourNext, useTourPanelHeight } from "../lib/tour";
import { useTheme } from "../theme/ThemeContext";

/* The translucent outline hand — deliberately NOT the filled emoji, which reads as a sticker and
   carries whatever the platform font decides about skin tone. Moved here from GuidedTour.jsx. */
const Hand = () => (
  <Svg width={34} height={34} viewBox="0 0 24 24" fill="rgba(255,255,255,0.55)"
    stroke="#2b2b26" strokeWidth={1.4} strokeLinejoin="round">
    <Path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5v-3a1.5 1.5 0 0 1 3 0v4m0-2.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5.2-3L4 16.2a1.6 1.6 0 0 1 2.7-1.7L9 17" />
  </Svg>
);

export default function TourRing({ name, radius = 12, out = 0, inner = false, onBar = false }) {
  const tour = useTour();
  const cfg = tour.step ? tourTarget(tour.step) : null;
  const on = !!name && !!cfg && cfg.ring === name;
  const { t } = useTheme();

  /* A slow breath on the WASH's opacity (the line stays crisp) — the native driver animates
     opacity off the JS thread, so a busy budget phone cannot stutter it. Reduce Motion → steady. */
  const pulse = useRef(new Animated.Value(1)).current;
  const [still, setStill] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setStill(!!v); }).catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!on || still) { pulse.setValue(1); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [on, still]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!on) return null;
  const line = onBar ? t.bar_ink : t.pine_d;
  const wash = onBar ? t.bar_ink : t.pine;
  /* The wash: 5 points wide, 2 points clear of the line — outside it, or inside it for `inner`.
     Its peak opacity is the mock-up's 0.24; the breath takes it down to about a third of that. */
  const w = inner ? out - 4 : out + 7;   // the wash box sits at -w: outside the line, or 4 points in
  return (
    <>
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: -w, left: -w, right: -w, bottom: -w,
        borderWidth: 5, borderColor: wash, borderRadius: Math.max(2, radius + w),
        opacity: Animated.multiply(pulse, 0.24),
      }} />
      <View pointerEvents="none" style={{
        position: "absolute", top: -out, left: -out, right: -out, bottom: -out,
        borderWidth: 2, borderColor: line, borderRadius: radius + out,
      }} />
      {cfg.tap ? (
        <Pressable onPress={tourNext} accessibilityRole="button" accessibilityLabel="Continue the tour"
          style={StyleSheet.absoluteFill} />
      ) : null}
      {cfg.hand === "left" ? (
        /* MIRRORED, the hand hanging off to the LEFT (founder, 2026-10-05, Android: on step 15 "the
           finger is slightly hidden on right side"). The "+" sits against the card's right edge
           and the card clips what overhangs it, so a hand hanging right was cut off. Flipped, the
           fingertip lands at (21, 5) of the glyph and the hand's body falls back over the card. */
        <View pointerEvents="none" style={{
          position: "absolute", top: "55%", left: "50%", marginTop: -5, marginLeft: -21,
          transform: [{ scaleX: -1 }],
        }}>
          <Hand />
        </View>
      ) : cfg.hand ? (
        /* The fingertip sits at roughly (13, 5) of the 34px glyph — so "center" puts the fingertip on
           the target's middle, and "corner" on its lower right, the hand hanging off it. */
        <View pointerEvents="none" style={{
          position: "absolute",
          top: cfg.hand === "center" ? "50%" : "62%",
          left: cfg.hand === "center" ? "50%" : "58%",
          marginTop: -5, marginLeft: -12,
        }}>
          <Hand />
        </View>
      ) : null}
    </>
  );
}

/* The foot-of-list room for the docked panel — see `setTourPanelHeight` in lib/tour.js. Put it as
   the LAST child of a scrolling screen's content. Zero height whenever no tour is up. */
export function TourSpacer() {
  const tour = useTour();
  const h = useTourPanelHeight();
  if (!tour.step || !h) return null;
  return <View pointerEvents="none" style={{ height: h + 24 }} />;
}
