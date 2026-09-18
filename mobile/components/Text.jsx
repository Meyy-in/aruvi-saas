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
import { StyleSheet, Text as RNText, TextInput as RNTextInput } from "react-native";
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

function sizeProps(pref, style) {
  if (pref === "system" || !TEXT_SCALES[pref]) {
    return { allowFontScaling: true, maxFontSizeMultiplier: MAX_FONT_SCALE, style };
  }
  return { allowFontScaling: false, style: scaled(style, TEXT_SCALES[pref]) };
}

export const Text = forwardRef(function Text({ style, ...props }, ref) {
  const pref = useContext(TextSizeCtx);
  return <RNText ref={ref} {...props} {...sizeProps(pref, style)} />;
});
export const TextInput = forwardRef(function TextInput({ style, ...props }, ref) {
  const pref = useContext(TextSizeCtx);
  return <RNTextInput ref={ref} {...props} {...sizeProps(pref, style)} />;
});
