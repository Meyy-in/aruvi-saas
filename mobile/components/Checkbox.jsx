/* ───────── The app's checkbox, once (2026-09-16) ─────────
 *
 * ★ EVERY TICK IN THIS APP IS A NATIVE `<input type="checkbox">` ON THE WEB, which means its
 * look is the OPERATING SYSTEM's and appears in no stylesheet we own. Measured off the founder's
 * side-by-side of the two Settings screens: **#ffffff** inside, **#767676** border. React Native
 * has no checkbox at all, so the phone must draw one — and the first one drawn (Settings ›
 * Marketing emails) guessed a transparent interior, which made one control read as two different
 * objects on the two surfaces and cost a long afternoon to name.
 *
 * ★ THE TOKENS ARE OURS, THE WEIGHT IS THE OS's. `field_bg` is the white every other input on
 * this phone already uses, and `ink_soft` (#6b6a63, 5.43 on white) is the warm near-equivalent of
 * that #767676 (4.54) — so the surfaces match without a neutral grey entering a warm palette.
 * Checked is `pine` filled with a paper ✓, which is what `accent-color: var(--pine)` gives the
 * web.
 *
 * ★ ONE COPY, because there are four sites and they must not drift: Settings › Marketing emails,
 * the agreement's five acknowledgement ticks, its final tick, its optional marketing tick — and
 * the delete flow's "I confirm I have downloaded my data" when that lands.
 *
 * `tone` is the web's per-input `accent-color`, which really does differ by site and says
 * something each time: `soft` for `.lgl-check-opt` (the OPTIONAL tick, drawn quieter than the
 * required ones) and `clay` for `.acct-final-check` (a confirmation attached to a destructive
 * act, not an ordinary preference). Default pine.
 */
import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";

export default function Checkbox({ checked, size = 22, tone = "pine", busy = false }) {
  const { t } = useTheme();
  const on = tone === "soft" ? t.ink_soft : tone === "clay" ? t.clay : t.pine;
  return (
    <View style={{ width: size, height: size, borderRadius: 4, borderWidth: 1.5,
                   alignItems: "center", justifyContent: "center",
                   opacity: busy ? 0.6 : 1,
                   borderColor: checked ? on : t.ink_soft,
                   backgroundColor: checked ? on : t.field_bg }}>
      {checked ? (
        <Text style={{ color: t.paper, fontSize: size * 0.59, lineHeight: size * 0.68 }}>✓</Text>
      ) : null}
    </View>
  );
}
