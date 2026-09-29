/* ───────── Text size: the iPhone's, capped — or the teacher's own choice (2026-09-18) ─────────
 *
 * History: on 2026-09-13 the founder decided the design OWNS its sizes and the app ignored the
 * iPhone's Text Size slider entirely (ceiling 1.0), because a phone ~12–15% above default wrapped
 * lines the design does not wrap. On 2026-09-18 he asked for the slider (Control Centre › Text
 * Size) to be honoured after all — within a limit — AND for an in-app choice that overrides it:
 *
 *   "system"   Match iPhone — the iPhone's own size, capped at MAX_FONT_SCALE (1.2×). Default.
 *   "standard" The design's own sizes, whatever the iPhone says (the 2026-09-13 behaviour).
 *   "large"    1.1× · "larger" 1.2×
 *
 * ONE ceiling for both paths, so there is one size to check on the parity page and the handset.
 * The fixed modes switch the OS scaling OFF and multiply the style themselves (font size, line
 * height, letter spacing) — the only way to be larger than the design and ALSO independent of
 * the slider. Nested <Text> inherits a scaled parent size and scales its own, so a run of bold
 * inside a paragraph grows with it.
 *
 * React 19 ignores defaultProps on function components, so this cannot be set globally on
 * react-native's Text; every Text/TextInput in this app imports from HERE instead. */
import { forwardRef, useContext } from "react";
import { StyleSheet, Platform, useWindowDimensions,
         Text as RNText, TextInput as RNTextInput } from "react-native";
import { TextSizeCtx, TEXT_SCALES } from "../theme/ThemeContext";

export const MAX_FONT_SCALE = 1.2;

function scaled(style, k) {
  if (k === 1 || !style) return style;
  const f = StyleSheet.flatten(style) || {};
  const out = { ...f };
  if (typeof f.fontSize === "number") out.fontSize = f.fontSize * k;
  if (typeof f.lineHeight === "number") out.lineHeight = f.lineHeight * k;
  if (typeof f.letterSpacing === "number") out.letterSpacing = f.letterSpacing * k;
  return out;
}

/* ★ ANDROID CAPS IT OURSELVES (WALK-A-139, founder 2026-09-29, emulator: with Android's Font size
   at max, "Device default" drew 4.5 section cards where "Larger" (1.2×) draws 6.5 — so the
   1.2× cap was not holding). `maxFontSizeMultiplier` is not honoured by Android's current
   renderer, so on Android the "system" path reads the phone's font scale itself, caps it, and
   scales the style exactly as the fixed modes do. iOS keeps the native cap, which works. */
function sizeProps(pref, style, fontScale) {
  if (pref === "system" || !TEXT_SCALES[pref]) {
    if (Platform.OS === "android") {
      return { allowFontScaling: false,
               style: scaled(style, Math.min(fontScale || 1, MAX_FONT_SCALE)) };
    }
    return { allowFontScaling: true, maxFontSizeMultiplier: MAX_FONT_SCALE, style };
  }
  return { allowFontScaling: false, style: scaled(style, TEXT_SCALES[pref]) };
}

/* `fixed` — this text NEVER scales, at any setting (founder, 2026-09-18: the bottom bar's
   "My Classes" / "My Lessons" went to two lines at Larger and grew the bar). Use sparingly: only
   where a fixed-height strip of chrome would break, never for reading text. */
export const Text = forwardRef(function Text({ style, fixed, ...props }, ref) {
  const pref = useContext(TextSizeCtx);
  const { fontScale } = useWindowDimensions();
  if (fixed) return <RNText ref={ref} {...props} allowFontScaling={false} style={style} />;
  return <RNText ref={ref} {...props} {...sizeProps(pref, style, fontScale)} />;
});
export const TextInput = forwardRef(function TextInput({ style, ...props }, ref) {
  const pref = useContext(TextSizeCtx);
  const { fontScale } = useWindowDimensions();
  return <RNTextInput ref={ref} {...props} {...sizeProps(pref, style, fontScale)} />;
});
