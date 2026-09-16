/* ───────── Settings › About Meyy (6b·H1) ─────────
 * One card and one hint, exactly as the web. No title — the bar says "⚙ About Meyy".
 * ⚠️ The pointer to Legal is load-bearing: the agreement promises a permanent home, and a
 * teacher who goes looking for it under "version info" is the reader this line catches. */
import { View, ScrollView } from "react-native";
import { Text } from "../../../components/Text";
import { useTheme } from "../../../theme/ThemeContext";
import { useWebStyles } from "../../../theme/web";

export default function About() {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <ScrollView contentContainerStyle={[ws.main, { paddingTop: 12 }]}>
      <View style={[ws.set_card, { borderColor: t.line, backgroundColor: t.card_bg }]}>
        <Text style={[ws.set_plan_txt, { color: t.ink }]}>
          Meyy · Lesson Studio — preview build.{"\n"}NCF 2023 aligned.
        </Text>
      </View>
      <Text style={[ws.set_hint, { color: t.ink_soft }]}>
        Version details will live here. The user agreement and privacy notice are under
        Settings › Legal.
      </Text>
    </ScrollView>
  );
}
