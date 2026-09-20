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
 * ★ It is up on EVERY screen, Settings included (founder, 2026-09-14). It used to hide behind
 * the frozen Settings bar; that was struck for the same reason as Ask Meyy's scrim — the nav is
 * the app's nav, and a screen that takes it away leaves exactly one way out of itself. In
 * Settings nothing lights, so the bar says "you are somewhere else" without claiming Settings is
 * one of its four places.
 *
 * ★ THE ONE EXCEPTION — ANDROID, WHILE THE KEYBOARD IS UP (founder, 2026-09-19, the walk's
 * smoke test on the Pixel 7 emulator: "hide the bottom bar as it is in iPhone"). Technical
 * divergence, not a product one: Android RESIZES the window for the keyboard, so a bar at the
 * foot of the column rides up and sits on top of the keys, taking ~57px from the little room
 * left to type in (on a 360x640 budget phone, most of the message box). iOS does not resize —
 * the keyboard simply covers the bar — so on the iPhone it was never visible while typing.
 * Hiding it on Android makes the two phones LOOK the same. It returns the moment the keyboard
 * goes; hardware Back dismisses the keyboard first, so she is never without a way out. */
import { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, Keyboard, Platform } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";
import { useTourAnchor } from "../lib/tour";

/* The bar's own height ABOVE the safe-area inset — `.bnav`'s 56.85, measured 2026-09-13 at
   390×844 and recorded in theme/web.js's bnav comment. Published for the same reason
   `BAR_CONTENT_H` is: anything that must sit CLEAR of the nav (the My Lessons toast, and in 6a
   the Ask panel) had to carry a copy of the number, and a copy is a thing that goes stale on
   the day the nav is re-measured and nobody re-measures the toast. */
export const BNAV_H = 56.85;

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

/* `tour` is the web's own `data-tour` string — see `lib/tour.js` on why the keys must match. */
function Item({ Icon, label, active, onPress, hint, tour, fixed }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const color = active ? t.clay : t.ink_soft;
  const ref = useTourAnchor(tour);
  return (
    <Pressable ref={ref} onPress={onPress} style={ws.bnav_item} accessibilityRole="button"
      accessibilityState={{ selected: !!active }} accessibilityLabel={hint || label}>
      <Icon color={color} />
      {/* `fixed`: one line at the design's size whatever the text-size setting (2026-09-18). */}
      <Text fixed={fixed} numberOfLines={fixed ? 1 : undefined} style={[ws.bnav_label, { color }]}>{label}</Text>
      <View style={[ws.bnav_rule, active && { backgroundColor: t.clay }]} />
    </Pressable>
  );
}

export default function BottomNav({ active = null, onClasses, onLessons, onAdd, onAsk,
                                    showClasses = true, showAdd = true }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const insets = useSafeAreaInsets();
  const [kbUp, setKbUp] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const a = Keyboard.addListener("keyboardDidShow", () => setKbUp(true));
    const b = Keyboard.addListener("keyboardDidHide", () => setKbUp(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  if (kbUp) return null;
  return (
    <View style={[ws.bnav, { backgroundColor: t.paper_sunk, borderTopColor: t.edge, paddingBottom: insets.bottom }]}
      accessibilityRole="tablist">
      <View style={ws.bnav_in}>
        {/* Lapsed hides My Classes — the reading room is My Lessons (§2.5 as amended). */}
        {showClasses && (
          <Item Icon={ClassesIcon} label="My Classes" fixed active={active === "classes"} onPress={onClasses} tour="nav-classes" />
        )}
        <Item Icon={LessonsIcon} label="My Lessons" fixed active={active === "lessons"} onPress={onLessons} tour="nav-lessons" />
        {/* The standing "+" portal — "what would you like to change?" An expired subscription
            hides it (§2.5 as amended; the server 402s regardless). */}
        {showAdd && (
          <Item Icon={AddIcon} label="Add" onPress={onAdd} tour="grow-add"
            hint="Add or change subjects, classes, or sections" />
        )}
        {/* ★ IT LIGHTS LIKE A PLACE WHILE THE PANEL IS UP (6c) — `active === "ask"`, the web's
            `askOpen ? "active" : ""`. And while it is lit the other three are not: the shell
            computes `active` as "ask" first, so the bar never claims she is in two places. */}
        <Item Icon={AskIcon} label="Ask Meyy" active={active === "ask"} onPress={onAsk} tour="ask-aruvi" />
      </View>
    </View>
  );
}

/* Kept for reference; every measure lives in theme/web.js. */
export const _styles = StyleSheet.create({});
