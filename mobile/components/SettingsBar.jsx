/* ───────── the frozen Settings bar (app. 04 rows A3-A5) ─────────
 *
 * ★ THE BAR NAMES THE ITEM, SO THE SCREEN DOES NOT (founder, 2026-09-03: "why should the word
 * Settings take so much real estate"). It reads "⚙ Support", "⚙ Subscription & billing" — the
 * CARD'S OWN WORDS — and the subviews therefore carry no heading of their own. The web deleted
 * its per-screen `.set-title` and a second sticky row saying the same word when this landed; the
 * phone never ports either back in.
 *
 * ★ AND THE ✕ CLOSES THE THING THE BAR NAMES. That is the whole rule, and it is why the label and
 * the ✕ sit on one row: on a subview it goes back one level, on home it leaves Settings entirely.
 * On the phone both are `router.back()`, because the subviews are pushed screens — the stack is
 * the origin memory the web has to keep in a ref.
 *
 * ⚠️ It sits BELOW the brand bar, in the slot the web's tab row occupies, and carries NO hairline
 * under it (founder). The bottom nav stays up throughout, lighting nothing.
 */
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* A4's map, exactly. The strings are the founder's and are shared with the cards that open
 * each view — a label that drifts from the card it names is the bar lying about where she is. */
export const SETTINGS_LABELS = {
  "/settings": "Settings",
  "/settings/personal": "Personal profile",
  "/settings/subscription": "Subscription & billing",
  "/settings/data": "Your data & export",
  "/settings/support": "Support",
  "/settings/about": "About Meyy",
  "/settings/legal": "Legal",
  "/settings/profile": "Teaching profile",
};

export function settingsLabel(pathname) {
  return SETTINGS_LABELS[pathname] || "Settings";
}

export default function SettingsBar({ label, onClose }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <View style={ws.set_bar}>
      <View style={ws.set_bar_title}>
        <Text style={[ws.set_bar_gear, { color: t.ink_soft }]}>⚙</Text>
        <Text style={[ws.set_bar_lab, { color: t.ink }]} numberOfLines={1}>{label}</Text>
      </View>
      <Pressable onPress={onClose} accessibilityRole="button"
        accessibilityLabel={`Close ${label}`} hitSlop={6} style={ws.set_bar_x}>
        <Text style={[ws.set_bar_x_glyph, { color: t.ink_soft }]}>✕</Text>
      </Pressable>
    </View>
  );
}
