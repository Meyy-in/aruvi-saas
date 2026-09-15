/* ───────── The phase BOOKMARK — ported from the web's PhaseBookmark (2026-09-12) ─────────
 * The same chunky clay arrow in the phase spine's left rail, tail beside the minutes, tip at the
 * phase start. One per section-chapter, on the pointer unit only; the caller persists the phase
 * index (sectionState.writeLocalBookmark).
 *
 * ★ ON THE PHONE THE HIGHLIGHT IS THE FEEDBACK, NOT THE ARROW (founder, 2026-09-15, arrived at
 * over three tries — a plain drag, a press-and-hold lift, a tap-to-place mode — and this is the
 * one that works: "after pressing the red button when it gets enclosed in that frame and
 * highlights the current phase, enable holding it and moving up and down when the highlight also
 * moves. Taking hand off the red button removes the frame and highlight and leaves it in the
 * desired position").
 *
 * It is still a drag, and that is fine. What made dragging bad on a phone was never the dragging
 * — it was that BOTH channels failed at once:
 *   · her fingertip (~45px) covered the arrow (26px), so the thing she aimed with hid the thing
 *     she was aiming at, and
 *   · the spine scrolled under her, so the arrow appeared to drift.
 * Both are answered here without asking her to learn a gesture. The ROW lights up, so the answer
 * is read a whole row wide, nowhere near her thumb — and the frame round the arrow says the
 * bookmark is in hand. The spine FREEZES for the length of the touch, so nothing moves but the
 * thing she is moving.
 *
 * ⚠️ FEEDBACK ON TOUCH-DOWN, NOT AFTER A DELAY. The press-and-hold version put 280ms between her
 * finger and any response, and the founder's word for it was "unnatural" — an app that does
 * nothing for a third of a second reads as an app that is not listening. The frame and the
 * highlight appear the instant she touches down.
 * ⚠️ AND IT NEVER LETS GO. `onPanResponderTerminationRequest` DEFAULTS TO TRUE — "yes, you may
 * take this touch from me" — and on iOS the enclosing UIScrollView asks the moment the finger
 * moves vertically. That default is the whole of why the original drag was impossible on the
 * handset while working on the web: react-native-web's scroller never asks.
 * ⚠️ THE ARROW DOES NOT MOVE HOUSE: `s.wrap` keeps `left: -4`, over the minutes column, exactly
 * where it has always been. No gutter is reserved for it.
 *
 * The web keeps its pointer drag untouched — a mouse has no body and hides nothing, so none of
 * this is owed there. A named divergence, CLAUDE.md §4 (a technical limitation of the phone).
 */
import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

const H = 26;   // arrow height; centred on the time cell

export default function PhaseBookmark({ centres, phase, onMove, color, onHold, onOver }) {
  const top = useRef(new Animated.Value(0)).current;
  const startTop = useRef(0);
  const curTop = useRef(0);
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  const centresRef = useRef(centres); centresRef.current = centres;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const overRef = useRef(phase);
  /* Props captured by a PanResponder built once, so they are read through refs rather than
     closures — otherwise the responder would call whatever these were on the first render. */
  const cb = useRef({ onMove, onHold, onOver });
  cb.current = { onMove, onHold, onOver };

  useEffect(() => {
    const id = top.addListener(({ value }) => { curTop.current = value; });
    return () => top.removeListener(id);
  }, [top]);

  /* Release the freeze if this unmounts mid-touch — a trip out of the unit must never leave the
     scroller disabled behind it. */
  useEffect(() => () => { if (heldRef.current && cb.current.onHold) cb.current.onHold(false); }, []);

  /* Settle on the phase's centre whenever it or the measurements change — never mid-touch, or it
     would fight her finger. */
  useEffect(() => {
    if (held) return;
    const c = centres; if (!c.length) return;
    const y = c[Math.min(phase, c.length - 1)] - H / 2;
    Animated.spring(top, { toValue: y, useNativeDriver: false, bounciness: 4 }).start();
  }, [phase, centres, held, top]);

  const nearest = (y) => {
    const c = centresRef.current;
    let best = 0, bestD = Infinity;
    c.forEach((cy, i) => { const d = Math.abs(cy - y); if (d < bestD) { bestD = d; best = i; } });
    return best;
  };
  const report = (i) => {
    if (overRef.current === i) return;        // only on a real change — this drives a re-render
    overRef.current = i;
    if (cb.current.onOver) cb.current.onOver(i);
  };
  const end = (commit) => {
    if (!heldRef.current) return;
    heldRef.current = false;
    setHeld(false);
    const i = overRef.current;
    if (commit && i !== phaseRef.current && cb.current.onMove) cb.current.onMove(i);
    if (cb.current.onHold) cb.current.onHold(false);   // unfreeze, clear the highlight
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    /* Never hand the touch back. See the header: this is the single line that made the original
       drag work on the handset at all. */
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => {
      startTop.current = curTop.current;
      heldRef.current = true;
      setHeld(true);
      overRef.current = phaseRef.current;
      if (cb.current.onHold) cb.current.onHold(true);       // freeze + light the current phase
      if (cb.current.onOver) cb.current.onOver(phaseRef.current);
    },
    onPanResponderMove: (_, g) => {
      const c = centresRef.current; if (!c.length) return;
      const y = Math.max(c[0], Math.min(c[c.length - 1], startTop.current + H / 2 + g.dy));
      top.setValue(y - H / 2);
      report(nearest(y));                                   // the highlight follows the arrow
    },
    onPanResponderRelease: () => {
      const c = centresRef.current;
      if (c.length) {
        const i = overRef.current;
        Animated.spring(top, { toValue: c[i] - H / 2, useNativeDriver: false, bounciness: 4 }).start();
      }
      end(true);
    },
    onPanResponderTerminate: () => end(false),
  })).current;

  if (!centres.length) return null;
  return (
    <Animated.View {...pan.panHandlers} style={[s.wrap, { top }]}
      accessibilityRole="adjustable"
      accessibilityLabel={`Lesson bookmark, on phase ${phase + 1} of ${centres.length}. Hold and slide to move it`}>
      {/* THE FRAME says the bookmark is in hand. A ring and a tint, never a colour change — the
          clay is what says "bookmark", and a bookmark that changes colour while she holds it
          reads as a different mark. */}
      <Animated.View style={[s.hit, held && s.hit_held]}>
        <Svg viewBox="0 0 32 28" width={30} height={H}>
          <Path d="M3 10 H15 V3 L30 14 L15 25 V18 H3 Z" fill={color} stroke={color}
            strokeWidth={1.5} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  /* left: -4 — the ORIGINAL column, over the minutes cell (founder, 2026-09-15). The arrow never
     gets a gutter of its own: the spine is already narrow, and an empty column would cost the
     phase text width on every screen to serve a touch that lasts a second. */
  wrap: { position: "absolute", left: -4, zIndex: 2 },
  hit: { padding: 6, borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  hit_held: { borderColor: "#b65a31", backgroundColor: "rgba(182,90,49,.10)" },
});
