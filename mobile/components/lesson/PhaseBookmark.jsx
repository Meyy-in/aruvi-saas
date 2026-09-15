/* ───────── The phase BOOKMARK — ported from the web's PhaseBookmark (2026-09-12) ─────────
 * The same chunky clay arrow in the phase spine's left rail, tail beside the minutes, tip at
 * the phase start. The teacher drags it up/down; on release it snaps to the NEAREST phase and
 * never rests between two. One per section-chapter, on the pointer unit only; the caller
 * persists the phase index (sectionState.writeLocalBookmark).
 *
 * Technical translation (CLAUDE.md §4 rule): the web measures each .uv-ph-time's offsetTop;
 * here the LessonPanel measures the rows with onLayout and passes the centres in. Drag is a
 * PanResponder. A phone has no arrow keys, so the web's ArrowUp/Down fallback becomes a TAP on
 * a phase's minutes cell (wired in LessonPanel) — same outcome, touch-native. */
import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

const H = 26;   // arrow height; centred on the time cell

export default function PhaseBookmark({ centres, phase, onMove, color }) {
  const top = useRef(new Animated.Value(0)).current;
  const startTop = useRef(0);
  const [dragging, setDragging] = useState(false);
  const centresRef = useRef(centres); centresRef.current = centres;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const curTop = useRef(0);
  useEffect(() => { const id = top.addListener(({ value }) => { curTop.current = value; }); return () => top.removeListener(id); }, [top]);

  // settle on the phase's centre whenever it or the measurements change (not mid-drag)
  useEffect(() => {
    if (dragging) return;
    const c = centres; if (!c.length) return;
    const y = c[Math.min(phase, c.length - 1)] - H / 2;
    Animated.spring(top, { toValue: y, useNativeDriver: false, bounciness: 4 }).start();
  }, [phase, centres, dragging]);

  /* ★ THE DRAG HAS TO SURVIVE THE SCROLLER IT LIVES INSIDE (founder, 2026-09-15: "bookmark moves
     in web app as well as expo but not in iphone").
     `onPanResponderTerminationRequest` DEFAULTS TO TRUE — "yes, you may take this touch from me".
     The bookmark sits in the phase spine inside a ScrollView, and on iOS that ScrollView is a
     real UIScrollView: the moment the finger moves vertically it asks for the responder, the
     default says yes, and the drag is over before it starts. react-native-web's ScrollView is a
     DOM scroller that never asks, which is exactly why the web and the Expo web target both
     looked fine and only the handset did not — the same shape as the ✕ that was painted under a
     transparent scroller, and as the wheels that lost their drag to a Pressable.
     So: claim the touch on the way DOWN (capture), and refuse to hand it back. The refusal is
     the fix; the capture is what stops the scroller getting there first on a fast flick.
     ⚠️ `onShouldBlockNativeResponder` is the Android half of the same sentence. */
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => { startTop.current = curTop.current; setDragging(true); },
    onPanResponderMove: (_, g) => {
      const c = centresRef.current; if (!c.length) return;
      const y = Math.max(c[0], Math.min(c[c.length - 1], startTop.current + H / 2 + g.dy)) - H / 2;
      top.setValue(y);
    },
    onPanResponderRelease: () => {
      const c = centresRef.current;
      if (c.length) {
        const y = curTop.current + H / 2;
        let best = 0, bestD = Infinity;
        c.forEach((cy, i) => { const d = Math.abs(cy - y); if (d < bestD) { bestD = d; best = i; } });
        Animated.spring(top, { toValue: c[best] - H / 2, useNativeDriver: false, bounciness: 4 }).start();
        if (best !== phaseRef.current) onMove(best);
      }
      setDragging(false);
    },
    onPanResponderTerminate: () => setDragging(false),
  })).current;

  if (!centres.length) return null;
  return (
    <Animated.View {...pan.panHandlers} style={[s.wrap, { top, opacity: dragging ? 0.85 : 1 }]}
      accessibilityRole="adjustable" accessibilityLabel={`Lesson bookmark — on phase ${phase + 1} of ${centres.length}; drag to move`}>
      <Svg viewBox="0 0 32 28" width={30} height={H}>
        <Path d="M3 10 H15 V3 L30 14 L15 25 V18 H3 Z" fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

const s = StyleSheet.create({ wrap: { position: "absolute", left: -4, zIndex: 2, padding: 6 } });
