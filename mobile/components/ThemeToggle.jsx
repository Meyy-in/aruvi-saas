/* ───────── the Appearance control — the web's cycling glyph (founder's Q10, 2026-09-16) ─────────
 *
 * ★ THE FOUNDER CHOSE PARITY over the phone's interim Auto/Light/Dark segmented control, which
 * lived at the foot of My Classes and is DELETED by this step rather than moved. One button,
 * ◐ → ☀ → ☾, cycling system → light → dark, exactly as `web/app/components/ThemeToggle.jsx`.
 *
 * ⚠️ AND THE ONE THING TO WATCH ON A HANDSET. The web states which theme is active through the
 * button's `title` tooltip — and **a phone has no hover**, so that channel simply does not exist
 * here. The label therefore lives in `accessibilityLabel` (the web's own strings, unchanged), and
 * the three-way cycle has to be discoverable by TAPPING rather than by reading. If it turns out
 * opaque in the hand, the fix recorded with Q10 is a word beside the glyph — not a return to the
 * segments, which the founder considered and declined.
 *
 * The preference itself is `ThemeContext`, which already stores the same three values under the
 * same `aruvi-theme` key the web uses, through the shared storage shim — so it survives sign-out,
 * as it does there.
 */
import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

const ORDER = ["system", "light", "dark"];
const META = {
  system: { glyph: "◐", label: "Theme: Auto (follows your phone)", word: "Auto" },
  light: { glyph: "☀", label: "Theme: Light", word: "Light" },
  dark: { glyph: "☾", label: "Theme: Dark", word: "Dark" },
};

export default function ThemeToggle() {
  const { t, pref, setPref } = useTheme();
  const ws = useWebStyles();
  const m = META[pref] || META.system;
  return (
    <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel={m.label}
      onPress={() => setPref(ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length])}>
      {/* ★ THE WORD BESIDE THE GLYPH (WALK-A-138, founder 2026-09-29) — the fix this header
          foresaw: the glyph alone did not say which theme was on. Short words in the Text-size
          control's own pill face, so the two cards read alike; "(follows your phone)" is already
          the card's sub-line. Fixed size, so the control never grows with the text setting. */}
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 6 }}>
        <Text fixed style={[ws.set_pill_t, { color: t.pine }]}>{m.word}</Text>
        <Text style={[ws.set_bar_gear, { color: t.ink_soft }]}>{m.glyph}</Text>
      </View>
    </Pressable>
  );
}
