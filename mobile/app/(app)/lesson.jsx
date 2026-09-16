/* The lesson route (Track D step 3). Receives subject/grade/filename/section via params,
 * fetches the live /view, reconciles this section's server state (so the pointer + bookmark
 * are what the teacher last left — 9A at unit 2), then renders LessonView. A loading state
 * holds until BOTH the view and the pull are in — the live-walk finding (no false first
 * frame) applied here too. */
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Text } from "../../components/Text";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getJSON } from "@aruvi/shared/format";
import { pullSectionState } from "@aruvi/shared/sectionState";
import LessonView from "../../components/LessonView";
import { Button } from "../../components/ui";
import { useTheme } from "../../theme/ThemeContext";
import { type } from "../../theme/type";

export default function Lesson() {
  const { t } = useTheme();
  const router = useRouter();
  const { subject, grade, filename, section } = useLocalSearchParams();
  const sectionKey = section ? `${subject}_${grade}_${section}` : "";
  const [state, setState] = useState({ loading: true, data: null, err: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (sectionKey) { try { await pullSectionState([sectionKey]); } catch {} }
        const d = await getJSON(`/plans/${subject}/${grade}/${filename}/view`);
        if (alive) setState({ loading: false, data: d, err: "" });
      } catch (e) {
        const m = String(e.message) === "404" ? "This lesson could not be found." : "Couldn't load this lesson right now.";
        if (alive) setState({ loading: false, data: null, err: m });
      }
    })();
    return () => { alive = false; };
  }, [subject, grade, filename, section]);

  if (state.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        <View style={st.center}><ActivityIndicator color={t.pine} /><Text style={[type.small, { color: t.ink_soft, marginTop: 10 }]}>Opening the lesson…</Text></View>
      </View>
    );
  }
  if (state.err || !state.data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        <View style={st.center}>
          <Text style={[type.body, { color: t.ink, textAlign: "center" }]}>{state.err || "Nothing to show."}</Text>
          <Button kind="link" title="‹ Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }
  return <LessonView view={state.data.view} meta={state.data.meta} sectionKey={sectionKey} onExit={() => router.back()} />;
}

const st = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 } });
