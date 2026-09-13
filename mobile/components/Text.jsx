/* ───────── Text with NO system font scaling (founder decision, 2026-09-13) ─────────
 *
 * iOS scales every native <Text> by the phone's system text size; a web page does not. The
 * founder's iPhone 14 sits ~12–15% above default, and the same screen rendered 12–15% larger
 * than the Expo web frame and the web app — wrapping lines the design does not wrap. Decision:
 * the design OWNS its sizes, as the web app already does — the app draws the web's sizes exactly
 * on every phone and does not consult the iPhone's text-size slider (ceiling 1.0). Larger text,
 * if teachers ask for it, comes later as an in-app Settings option at a size designed and checked
 * on the parity page — not as an uncontrolled multiplier from iOS.
 *
 * React 19 ignores defaultProps on function components, so this cannot be set globally on
 * react-native's Text; every Text/TextInput in this app imports from HERE instead. */
import { forwardRef } from "react";
import { Text as RNText, TextInput as RNTextInput } from "react-native";

export const MAX_FONT_SCALE = 1;   // 1 = the web's sizes exactly; raise only via a designed in-app option

export const Text = forwardRef(function Text(props, ref) {
  return <RNText ref={ref} maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
});
export const TextInput = forwardRef(function TextInput(props, ref) {
  return <RNTextInput ref={ref} maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
});
