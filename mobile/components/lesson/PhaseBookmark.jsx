/* ───────── The phase BOOKMARK — ported from the web's PhaseBookmark (2026-09-12) ─────────
 *
 * ★ ON THE PHONE IT IS PRESS-AND-HOLD, NOT DRAG (founder, 2026-09-15: "the Iphone experience of
 * using the red horizontal arrow bookmark is not as good on mobile as it is on web app or expo …
 * when hand is used to toggle the arrow, it also moves the phases screen leading to relative
 * motion of the arrow causing confusion. Also fat finger hides the bookmark").
 * A NAMED DIVERGENCE (CLAUDE.md §4, a technical limitation of the phone), and it is two faults,
 * not one — both native to touch and neither reachable with a mouse, which is why the web and the
 * Expo web target feel fine and the handset does not:
 *   · A fingertip is ~45px across and this arrow is 26px, so THE THING SHE AIMS WITH IS THE THING
 *     SHE CANNOT SEE. A pointer has no body; a finger does.
 *   · A vertical drag inside a vertical ScrollView is genuinely ambiguous. Even with the
 *     responder claimed, she is being asked to be precise about which of two gestures she means.
 * So: a LONG PRESS lifts the arrow (~280ms). Until it fires nothing is claimed, so an ordinary
 * scroll that happens to start on the arrow still scrolls. Once lifted, the page is LOCKED (the
 * scroller is disabled through `onLift`) so the phases cannot slide under her, and a CALLOUT
 * rides beside the arrow naming the phase she is over — the answer stays readable even while the
 * arrow itself is under her thumb. Releasing drops it on the nearest phase.
 * ⚠️ THE ARROW DOES NOT MOVE HOUSE (founder, same message: "let the arrow remain in the same
 * vertical column as it is now rather than creating a dedicated empty column"). `s.wrap` keeps
 * `left: -4`, overlaying the minutes column exactly as before; the callout is what needs room,
 * and it borrows the phase text's width transiently rather than reserving a gutter for ever.
 * ⚠️ And the TAP on a phase's minutes cell (wired in LessonPanel) is untouched and is still the
 * quick way — press-and-hold is for the fine correction, the tap for the jump.
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
import { Text } from "../Text";
import { useWebStyles } from "../../theme/web";

const H = 26;     // arrow height; centred on the time cell
/* Long enough that a scroll beginning on the arrow is never mistaken for a lift, short enough
   that the lift feels like an answer rather than a wait. iOS's own long-press is 500ms; this is
   picking something up, not opening a menu, so it is shorter. */
const HOLD_MS = 280;
const SLOP = 8;   // move further than this before the hold fires and she meant to scroll

export default function PhaseBookmark({ centres, phase, onMove, color, onLift, labelFor }) {
  const ws = useWebStyles();
  const top = useRef(new Animated.Value(0)).current;
  const startTop = useRef(0);
  const [dragging, setDragging] = useState(false);
  /* `lifted` is the press-and-hold having fired. `dragging` alone is not enough: between touch-down
     and the hold firing we are holding the responder but must still behave as if we had not. */
  const [lifted, setLifted] = useState(false);
  const liftedRef = useRef(false);
  const holdTimer = useRef(null);
  const startXY = useRef({ x: 0, y: 0 });
  const [overPhase, setOverPhase] = useState(0);
  const centresRef = useRef(centres); centresRef.current = centres;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const curTop = useRef(0);
  useEffect(() => { const id = top.addListener(({ value }) => { curTop.current = value; }); return () => top.removeListener(id); }, [top]);
  /* The hold timer must not outlive the wheel — it calls into the parent and locks the scroller. */
  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (liftedRef.current && onLift) onLift(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  /* Nearest phase to an offset — the release rule, also used live to label the callout. */
  const nearest = (y) => {
    const c = centresRef.current;
    let best = 0, bestD = Infinity;
    c.forEach((cy, i) => { const d = Math.abs(cy - y); if (d < bestD) { bestD = d; best = i; } });
    return best;
  };
  const endLift = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    liftedRef.current = false;
    setLifted(false); setDragging(false);
    if (onLift) onLift(false);
  };

  const pan = useRef(PanResponder.create({
    /* Claim the touch that starts ON the arrow so the hold timer can run — but see
       `onPanResponderTerminationRequest`: until the hold fires we give it straight back, so a
       scroll that merely began on the arrow still scrolls. */
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    /* ⚠️ ONCE LIFTED WE DO NOT LET GO. `onPanResponderTerminationRequest` DEFAULTS TO TRUE —
       "yes, you may take this touch from me" — and on iOS the enclosing UIScrollView asks the
       moment the finger moves vertically. That default is what made the drag impossible on the
       handset while working everywhere else: react-native-web's scroller never asks.
       Before the hold fires we answer TRUE on purpose, which is what keeps ordinary scrolling
       alive; after it, FALSE, and the page is locked anyway. */
    onPanResponderTerminationRequest: () => !liftedRef.current,
    onShouldBlockNativeResponder: () => liftedRef.current,
    onPanResponderGrant: (e) => {
      startTop.current = curTop.current;
      startXY.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      setOverPhase(phaseRef.current);
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        liftedRef.current = true;
        setLifted(true); setDragging(true);
        if (onLift) onLift(true);        // freeze the scroller under her
      }, HOLD_MS);
    },
    onPanResponderMove: (e, g) => {
      /* Moved before the hold fired → she meant to scroll, not to pick the arrow up. Drop the
         timer; the responder goes back to the scroller on the next request. */
      if (!liftedRef.current) {
        if (Math.abs(g.dy) > SLOP || Math.abs(g.dx) > SLOP) {
          if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
        }
        return;
      }
      const c = centresRef.current; if (!c.length) return;
      const y = Math.max(c[0], Math.min(c[c.length - 1], startTop.current + H / 2 + g.dy));
      top.setValue(y - H / 2);
      setOverPhase(nearest(y));
    },
    onPanResponderRelease: () => {
      const c = centresRef.current;
      if (liftedRef.current && c.length) {
        const best = nearest(curTop.current + H / 2);
        Animated.spring(top, { toValue: c[best] - H / 2, useNativeDriver: false, bounciness: 4 }).start();
        if (best !== phaseRef.current) onMove(best);
      }
      endLift();
    },
    onPanResponderTerminate: endLift,
  })).current;

  if (!centres.length) return null;
  const lbl = lifted && labelFor ? labelFor(overPhase) : null;
  return (
    /* ⚠️ `s.wrap` is UNCHANGED — left: -4, over the minutes column. The lift shows itself by
       growing a shadow and a ring, never by moving house. */
    <Animated.View {...pan.panHandlers}
      style={[s.wrap, { top }, lifted && s.wrap_lifted]}
      accessibilityRole="adjustable"
      accessibilityLabel={`Lesson bookmark — on phase ${phase + 1} of ${centres.length}; press and hold, then slide, or tap a phase's minutes`}>
      <Svg viewBox="0 0 32 28" width={lifted ? 34 : 30} height={lifted ? H + 4 : H}>
        <Path d="M3 10 H15 V3 L30 14 L15 25 V18 H3 Z" fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>
      {/* ★ THE CALLOUT IS THE WHOLE POINT OF THE LIFT. Her thumb is on the arrow, so the arrow
          cannot be the feedback — this is. It sits to the RIGHT, borrowing the phase text's width
          for as long as the hold lasts, which is why no permanent column is reserved. */}
      {lbl ? (
        <View style={ws.bkmk_callout} pointerEvents="none">
          <Text style={ws.bkmk_callout_k}>{`Phase ${overPhase + 1} of ${centres.length}`}</Text>
          <Text style={ws.bkmk_callout_t} numberOfLines={1}>{lbl}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  /* left: -4 — the ORIGINAL column, over the minutes cell. Do not give the arrow a gutter of its
     own (founder, 2026-09-15): the spine is already narrow and an empty column would cost the
     phase text width on every screen to serve a gesture that lasts a second. */
  wrap: { position: "absolute", left: -4, zIndex: 2, padding: 6 },
  wrap_lifted: {
    zIndex: 5,
    shadowColor: "#1f2a24", shadowOpacity: 0.3, shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
});
