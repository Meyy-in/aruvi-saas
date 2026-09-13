/* ───────── The bottom nav (founder, 2026-09-13: "switch My Classes / My Lessons, Ask Meyy
 * and the big plus to the bottom") ─────────
 *
 * A 1:1 port of the web's `.bnav` (web/app/page.jsx + globals.css, skin "option A + edge 4,
 * light edge"): sunk paper, a 1 px --edge top rule, nothing under it; four items, a 22 px
 * stroke icon over a 10.5 px uppercase mono label, soft ink at rest, CLAY when active with a
 * short clay underline. Measures live in theme/web.js under `bnav*` (CLAUDE.md §4 rule 2:
 * when the web's CSS changes, re-measure THERE, not here). Icon path data is the web's,
 * glyph for glyph.
 *
 * It is the app's ENTIRE nav — no sidebar, no hamburger. The safe-area bottom inset is
 * padding INSIDE the bar, so the sunk paper runs to the physical edge and the items sit above
 * the home indicator, exactly as the web reserves env(safe-area-inset-bottom).
 *
 * Hidden entirely while Settings is up (Settings is a modal room, the ✕ its only exit) —
 * the caller decides that, as the web's `!inSettingsBar` does. */
import { View, Pressable, StyleSheet } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* The web's four glyphs, same viewBox and same stroke weight (1.9, round caps/joins). */
const ICON = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };

function ClassesIcon({ color }) {
  return (
    <Svg {...ICON} stroke={color}>
      <Rect x={3} y={4} width={18} height={16} rx={2} />
      <Path d="M3 9h18M8 4v5" />
    </Svg>
  );
}
function LessonsIcon({ color }) {
  return (
    <Svg {...ICON} stroke={color}>
      <Path d="M4 4h11l5 5v11H4z" />
      <Path d="M15 4v5h5M8 13h8M8 17h6" />
    </Svg>
  );
}
/* The ringed plus with four dots — "grow in every direction" (founder, 2026-07-06). */
function AddIcon({ color }) {
  return (
    <Svg {...ICON} stroke={color}>
      <Circle cx={12} cy={12} r={5.9} strokeWidth={1.5} />
      <Path d="M12 8.9v6.2M8.9 12h6.2" strokeWidth={2.1} />
      <Circle cx={12} cy={3.3} r={1.4} fill={color} stroke="none" />
      <Circle cx={12} cy={20.7} r={1.4} fill={color} stroke="none" />
      <Circle cx={3.3} cy={12} r={1.4} fill={color} stroke="none" />
      <Circle cx={20.7} cy={12} r={1.4} fill={color} stroke="none" />
    </Svg>
  );
}
/* The stream-a mark with its red dot. */
function AskIcon({ color }) {
  return (
    <Svg {...ICON} stroke={color}>
      <Path d="M7 6.5c6 1 6 5 3.5 7.5S6 18 6 18" />
      <Path d="M10.5 14c3.5 0 5.5-1.8 6.5-4" />
      <Circle cx={17.3} cy={8.6} r={1.6} fill="#c0392b" stroke="none" />
    </Svg>
  );
}

function Item({ Icon, label, active, onPress, hint }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const color = active ? t.clay : t.ink_soft;
  return (
    <Pressable onPress={onPress} style={ws.bnav_item} accessibilityRole="button"
      accessibilityState={{ selected: !!active }} accessibilityLabel={hint || label}>
      <Icon color={color} />
      <Text style={[ws.bnav_label, { color }]}>{label}</Text>
      <View style={[ws.bnav_rule, active && { backgroundColor: t.clay }]} />
    </Pressable>
  );
}

export default function BottomNav({ active = null, onClasses, onLessons, onAdd, onAsk,
                                    showClasses = true, showAdd = true }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[ws.bnav, { backgroundColor: t.paper_sunk, borderTopColor: t.edge, paddingBottom: insets.bottom }]}
      accessibilityRole="tablist">
      <View style={ws.bnav_in}>
        {/* Lapsed hides My Classes — the reading room is My Lessons (§2.5 as amended). */}
        {showClasses && (
          <Item Icon={ClassesIcon} label="My Classes" active={active === "classes"} onPress={onClasses} />
        )}
        <Item Icon={LessonsIcon} label="My Lessons" active={active === "lessons"} onPress={onLessons} />
        {/* The standing "+" portal — "what would you like to change?" An expired subscription
            hides it (§2.5 as amended; the server 402s regardless). */}
        {showAdd && (
          <Item Icon={AddIcon} label="Add" onPress={onAdd}
            hint="Add or change subjects, classes, or sections" />
        )}
        <Item Icon={AskIcon} label="Ask Meyy" onPress={onAsk} />
      </View>
    </View>
  );
}

/* Kept for reference; every measure lives in theme/web.js. */
export const _styles = StyleSheet.create({});
