/* The ONE bar — pine fill, cream mark, "LESSON STUDIO" tag (.hdr-brand-tag: 10px uppercase mono, measured 2026-09-13) — the chrome every screen wears
 * (the web's .topbar / .fr-brand). Sits under the status bar via the safe-area inset; there is
 * no measured --nav-h here, native layout does it (assessment §3). */
import { View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MeyyMark from "./MeyyMark";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export default function Bar({ right = null }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { backgroundColor: t.bar_fill, paddingTop: insets.top + 10 }]}>
      <View style={s.brand}>
        <MeyyMark height={22} color={t.bar_ink} dot="#e0705f" />
        <Text style={[ws.hdr_brand_tag, { marginLeft: 10 }]}>lesson studio</Text>
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "baseline" },
});
