/* ───────── "Let me show you around first" — the tour's one door (step 8b, app. 01 rows 59-61) ─────────
 *
 * ★ THE WHOLE WINDOW IS THE BUTTON, not a link inside it. The web makes the container a
 * `role="button"` and the "Show me how →" line a plain span; a teacher who taps the sentence
 * rather than the arrow should still get what she asked for.
 * ⚠️ IT IS THE SAME COMPONENT ON BOTH SCREENS with one word different in the sub-line — "safe in
 * My Lessons" on My Classes, "here in My Lessons" on My Lessons — because on one of them she is
 * looking at the thing being reassured about. Getting that word wrong is how the reassurance
 * stops landing.
 */
import { View, Pressable } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* The web's route glyph — a start point, a dotted path, a destination. Stroke only. */
const RouteIcon = ({ color }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="6" cy="19" r="2.2" />
    <Circle cx="18" cy="5" r="2.2" />
    <Path d="M8 17c2-1 3-3 3-5s1-4 3-5" strokeDasharray="1 3" />
  </Svg>
);

export default function TourOffer({ here = false, onStart }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <Pressable onPress={onStart} accessibilityRole="button"
      accessibilityLabel="Show me how — start the guided walkthrough"
      style={[ws.dash_nudge, { borderColor: t.pine, backgroundColor: t.tint_pine }]}>
      <View style={ws.yr_nudge_row}>
        <RouteIcon color={t.pine_d} />
        <View style={{ flex: 1 }}>
          <Text style={[ws.dash_nudge_title, { color: t.pine_d }]}>Let me show you around first</Text>
          <Text style={[ws.dash_nudge_sub, { color: t.ink_soft }]}>
            A short walk through tracking sections and handling lesson plans. Your lesson stays
            {here ? " here" : " safe"} in My Lessons — you can add it to a class whenever you’re ready.
          </Text>
          {/* On My Classes only — the web drops this line on My Lessons. */}
          {here ? null : (
            <Text style={[ws.yr_nudge_go_t, { color: t.pine_d, marginTop: 8 }]}>Show me how →</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
