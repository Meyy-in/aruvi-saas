/* ───────── The Prepare CTA — "the supreme, token-costing act" ─────────
 *
 * `button.prepare-cta` in globals.css (3371), ported whole. Every ordinary primary button in
 * this app is calm pine; the ONE action that actually spends tokens to build a plan gets a
 * singular warm identity — a clay→ochre gradient, a soft warm glow, a leading ✦ — so it reads
 * as "this is the moment" wherever it appears.
 *
 * ⚠️ WHY THIS IS A COMPONENT AND NOT A STYLE (2026-09-14, founder: "the color of 'prepare a new
 * lesson' button and letters on expo must match web app" — twice). On the web `prepare-cta` is a
 * class LAYERED on top of `.mlp-allocate-btn` (My Lessons) or `.primary` (the prepare screen):
 * each context keeps its own SIZE and this overrides only colour and weight. Porting the base
 * rules alone produced a pine button with a cream label — correct for the layer underneath and
 * wrong on screen, because the layer on top is the whole identity. A component is the faithful
 * analogue of that layering: one implementation of the identity, a `size` for the context.
 *
 * ⚠️ AND TWO THINGS RN CANNOT DO THE WEB'S WAY, both named as CLAUDE.md §4 requires:
 *   · NO CSS GRADIENT. Drawn with react-native-svg instead — the same call the graph rule made
 *     (a true tile, not an approximation), and it adds no native dependency, where
 *     expo-linear-gradient would. CSS `135deg` runs top-left → bottom-right, which is SVG
 *     x1,y1 = 0,0 → x2,y2 = 1,1.
 *     ⚠️ AND IT IS MEASURED, not sized at 100% (founder, 2026-09-14: the gradient drew on the
 *     iPhone and NOT on the Expo web target). react-native-svg defaults an `<Svg>` to 100% × 100%
 *     ONLY when it is not absolutely positioned — `elements/Svg.js`: `if (width === undefined &&
 *     height === undefined && position !== 'absolute')`. An absolutely-positioned Svg with no
 *     size therefore gets bounds from the native layout engine and NOTHING on web, where it is a
 *     real `<svg>` with no intrinsic size. `onLayout` gives it a size that is right on both.
 *     The gradient id is per instance for the same reason: on web these are real DOM ids, and a
 *     duplicate makes `url(#…)` resolve to whichever element the browser saw first.
 *   · NO INSET SHADOW. The web's `inset 0 1px 0 rgba(255,255,255,.14)` is a 1px highlight along
 *     the top edge; RN has only outer shadows. It is drawn as a hairline rather than dropped,
 *     because on a saturated fill that highlight is what keeps the button from looking flat.
 * The outer glow is a real RN shadow. ⚠️ It needs TWO views: `overflow: "hidden"` (which the
 * gradient needs, to be clipped to the radius) clips the shadow too on iOS, so the shadow lives
 * on an outer wrapper and the clipping on an inner one.
 *
 * Disabled drops the whole identity, exactly as the web does — sunk paper, soft ink, no glow, no
 * spark, normal weight. It is not the same button dimmed; it is a button that is not offering
 * anything.
 */
import { useRef, useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

let seq = 0;

/* HELD (WALK-A-070): the grey equivalent of a theme colour — the same luminance weights a
   CSS grayscale(1) filter uses, so the phone's held bar matches the web's. */
function greyOf(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return "#8a8a8a";
  const n = parseInt(m[1], 16);
  const y = Math.round(0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255));
  const h = y.toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
}

export default function PrepareCta({ label, onPress, disabled = false, busy = false,
                                     held = false, size = "primary", style }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const gid = useRef(`pcta-${++seq}`).current;
  const [box, setBox] = useState(null);
  const off = disabled || busy || held;
  /* HELD is disabled but NOT absent (founder, 2026-09-24): the whole identity stays — gradient,
     spark, weight, inset — drawn in grey, no glow. The other disabled states still drop it. */
  const drawn = !off || (held && !busy);
  const c0 = held ? greyOf(t.clay) : t.clay;
  const c1 = held ? greyOf(t.ochre) : t.ochre;
  // Each context keeps its own size; the identity below is shared. (The web's own division.)
  const boxStyle = size === "allocate" ? ws.pcta_box_allocate
    : size === "fr" ? ws.pcta_box_fr : ws.pcta_box_primary;
  const lbl = size === "allocate" ? ws.pcta_t_allocate : ws.pcta_t_primary;

  return (
    <View style={[off ? null : ws.pcta_glow, style]}>
      <Pressable onPress={onPress} disabled={off} accessibilityRole="button"
        accessibilityState={{ disabled: off }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setBox((b) => (b && b.width === width && b.height === height ? b : { width, height }));
        }}
        style={[boxStyle, ws.pcta_clip, off && !drawn && { backgroundColor: t.paper_sunk }]}>
        {drawn ? (
          <>
            {box && box.width > 0 && box.height > 0 ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg width={box.width} height={box.height}>
                  <Defs>
                    <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={c0} />
                      <Stop offset="1" stopColor={c1} />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width={box.width} height={box.height} fill={`url(#${gid})`} />
                </Svg>
              </View>
            ) : null}
            {/* the inset highlight, as a hairline */}
            <View style={ws.pcta_inset} pointerEvents="none" />
          </>
        ) : null}
        <View style={ws.pcta_row}>
          {busy ? (
            /* The spark is suppressed while working so the spinner reads as the only signal —
               the web does the same (`:disabled::before { content: none }`). */
            <ActivityIndicator size="small" color={t.ink_soft} />
          ) : drawn ? (
            <Text style={[lbl, ws.pcta_ident, ws.pcta_spark]}>✦</Text>
          ) : null}
          <Text style={[lbl, drawn ? ws.pcta_ident : { color: t.ink_soft }]}>{label}</Text>
        </View>
      </Pressable>
    </View>
  );
}
