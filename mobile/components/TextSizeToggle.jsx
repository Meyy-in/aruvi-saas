/* ───────── Settings › Appearance › Text size (founder, 2026-09-18) ─────────
 * Cycles Match iPhone → Standard → Large → Larger, the Appearance toggle's own idiom. Unlike the
 * theme glyph it shows a WORD, because a size has no glyph a teacher would read without trying
 * it — and the ThemeToggle note already records that a cycling glyph is hard to discover on a
 * phone with no hover. Phone-only: the web follows the browser's own zoom. */
import { Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

const ORDER = ["system", "standard", "large", "larger"];
const WORD = { system: "Device\nDefault", standard: "Standard", large: "Large", larger: "Larger" };
const LABEL = {
  system: "Text size: device default",
  standard: "Text size: Standard",
  large: "Text size: Large",
  larger: "Text size: Larger",
};

export default function TextSizeToggle() {
  const { t, textSize, setTextSize } = useTheme();
  const ws = useWebStyles();
  const cur = ORDER.includes(textSize) ? textSize : "system";
  return (
    <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel={LABEL[cur]}
      accessibilityHint="Tap to change"
      onPress={() => setTextSize(ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length])}>
      {/* "Device Default" sits on TWO lines, smaller, so it fits the chevron's slot without making
          the card taller (founder, 2026-09-18). Fixed size: the control must not grow with the
          very setting it changes. */}
      <Text fixed numberOfLines={cur === "system" ? 2 : 1}
        style={[ws.set_pill_t, { color: t.pine, textAlign: "right" },
                cur === "system" ? { fontSize: 8.5, lineHeight: 11 } : null]}>{WORD[cur]}</Text>
    </Pressable>
  );
}
