/* The Privacy Notice as a screen of its own, reachable with no account yet (GET /legal/privacy
 * needs none — DPDP §5 wants the notice at or before first collection, which is the OTP
 * screen). Rendered from the shared parser; Back returns to wherever she was. */
import { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { Text } from "../components/Text";
import { useRouter } from "expo-router";
import { API } from "@aruvi/shared/config";
import Bar from "../components/Bar";
import Markdown from "../components/Markdown";
import { Button } from "../components/ui";
import { useTheme } from "../theme/ThemeContext";
import { type } from "../theme/type";

export default function Privacy() {
  const { t } = useTheme();
  const router = useRouter();
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`${API}/legal/privacy`).then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((d) => setDoc((d && d.document) || d)).catch(() => setErr("Couldn't load the notice right now."));
  }, []);
  const md = doc && (doc.body || "");
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={[type.title, { color: t.ink }]}>{(doc && doc.title) || "Privacy Notice"}</Text>
        {!doc && !err ? <ActivityIndicator color={t.pine} style={{ marginTop: 24 }} /> : null}
        {err ? <Text style={[type.body, { color: t.ink_soft, marginTop: 12 }]}>{err}</Text> : null}
        {md ? <Markdown md={md} /> : null}
        {doc && doc.version ? <Text style={[type.small, { color: t.ink_soft, marginTop: 24 }]}>Version {doc.version}</Text> : null}
      </ScrollView>
      <View style={[s.foot, { borderTopColor: t.line }]}>
        <Button kind="link" title="← Back" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingVertical: 18, paddingBottom: 40 },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, padding: 8 },
});
