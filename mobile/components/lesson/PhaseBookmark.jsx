/* ───────── The phase BOOKMARK — ported from the web's PhaseBookmark (2026-09-12) ─────────
 * The same chunky clay arrow in the phase spine's left rail, tail beside the minutes, tip at
 * the phase start. One per section-chapter, on the pointer unit only; the caller persists the
 * phase index (sectionState.writeLocalBookmark).
 *
 * ★ ON THE PHONE IT IS NOT DRAGGED — IT IS PRESSED, THEN PLACED (founder, 2026-09-15, after
 * trying a press-and-hold lift: "no..this is unnatural..go back to option A with this change:
 * pressing arrow brings blue highlight … Important that when arrow is pressed it must freeze the
 * phase screen").
 * A NAMED DIVERGENCE (CLAUDE.md §4, a technical limitation of the phone). Dragging fails here for
 * two reasons, both native to touch and neither reachable with a pointer — which is why the web
 * and the Expo web target feel fine and only the handset does not:
 *   · A fingertip is ~45px across and this arrow is 26px, so THE THING SHE AIMS WITH IS THE THING
 *     SHE CANNOT SEE.
 *   · A vertical drag inside a vertical ScrollView is ambiguous by construction. Holding the
 *     responder stops the scroller STEALING the gesture, but it cannot stop her being asked to be
 *     precise about which of two gestures she means — and a hold that must fire before anything
 *     happens reads as the app not responding.
 * So the arrow is a BUTTON with two states:
 *   1. Press it → the spine ARMS. Every phase lights up as a target and the screen FREEZES, so
 *      nothing slides while she chooses.
 *   2. Press a phase → the arrow springs there and the spine disarms. Pressing the arrow again
 *      backs out, changing nothing.
 * Her finger is never on the thing she is aiming at, there is no gesture to disambiguate, and the
 * targets are whole rows rather than a 26px glyph.
 *
 * ⚠️ THE ARROW DOES NOT MOVE HOUSE (founder, same run): `s.wrap` keeps `left: -4`, over the
 * minutes column exactly where it has always been. Arming is shown on the ROWS, which already
 * have the width for it; no gutter is reserved for the arrow.
 *
 * Technical translation: the web measures each .uv-ph-time's offsetTop; here LessonPanel measures
 * the rows with onLayout and passes the centres in. The web keeps its pointer drag — a mouse can
 * do precisely what a fingertip cannot — so this file has no web counterpart to match.
 */
import { useEffect, useRef } from "react";
import { Animated, View, Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

const H = 26;   // arrow height; centred on the time cell

export default function PhaseBookmark({ centres, phase, color, armed, onToggle }) {
  const top = useRef(new Animated.Value(0)).current;

  /* Settle on the phase's centre whenever it or the measurements change. Unlike the drag version
     this has nothing to fight: the arrow only ever moves because the phase changed, so there is
     no in-flight gesture for an `animated: false` re-park to cancel. */
  useEffect(() => {
    const c = centres; if (!c.length) return;
    const y = c[Math.min(phase, c.length - 1)] - H / 2;
    Animated.spring(top, { toValue: y, useNativeDriver: false, bounciness: 4 }).start();
  }, [phase, centres, top]);

  if (!centres.length) return null;
  return (
    <Animated.View style={[s.wrap, { top }]} pointerEvents="box-none">
      <Pressable onPress={onToggle} hitSlop={12}
        accessibilityRole="button"
        accessibilityState={{ expanded: !!armed }}
        accessibilityLabel={armed
          ? `Choosing where to put the lesson bookmark — pick a phase, or press again to leave it on phase ${phase + 1}`
          : `Lesson bookmark, on phase ${phase + 1} of ${centres.length}. Press to move it`}
        style={[s.hit, armed && s.hit_armed]}>
        {/* ARMED IS SHOWN ON THE ARROW TOO, not only on the rows: she pressed this, so this has to
            answer. A ring and a lift, never a colour change — the clay is what says "bookmark",
            and a bookmark that changes colour while she is choosing reads as a different mark. */}
        <Svg viewBox="0 0 32 28" width={30} height={H}>
          <Path d="M3 10 H15 V3 L30 14 L15 25 V18 H3 Z" fill={color} stroke={color}
            strokeWidth={1.5} strokeLinejoin="round" />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  /* left: -4 — the ORIGINAL column, over the minutes cell (founder, 2026-09-15). The arrow never
     gets a gutter of its own: the spine is already narrow, and an empty column would cost the
     phase text width on every screen to serve a moment that lasts a second. */
  wrap: { position: "absolute", left: -4, zIndex: 2 },
  hit: { padding: 6, borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  hit_armed: {
    borderColor: "#b65a31",
    backgroundColor: "rgba(182,90,49,.10)",
  },
});
