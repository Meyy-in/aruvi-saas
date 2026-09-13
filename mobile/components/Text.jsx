/* ───────── Text with the FONT-SCALING CEILING (founder decision, 2026-09-13) ─────────
 *
 * iOS scales every native <Text> by the phone's system text size; a web page does not. The
 * founder's iPhone 14 sits ~12–15% above default, and the same screen rendered 12–15% larger
 * than the Expo web frame and the web app — wrapping lines the design does not wrap. Decision:
 * the web's sizes ARE the design (font-size-neutral); the app follows a teacher's enlarged text
 * only up to a ceiling of 1.15× (accessibility kept, blow-outs prevented), never beyond.
 *
 * React 19 ignores defaultProps on function components, so the ceiling cannot be set globally
 * on react-native's Text; every Text/TextInput in this app imports from HERE instead. When
 * checking parity at design time, the founder's phone is set to the DEFAULT text size — the
 * ceiling is for teachers, the default notch is for comparing. */
import { forwardRef } from "react";
import { Text as RNText, TextInput as RNTextInput } from "react-native";

export const MAX_FONT_SCALE = 1.15;

export const Text = forwardRef(function Text(props, ref) {
  return <RNText ref={ref} maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
});
export const TextInput = forwardRef(function TextInput(props, ref) {
  return <RNTextInput ref={ref} maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
});
