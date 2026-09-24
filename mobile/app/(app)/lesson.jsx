/* The lesson route (Track D step 3). Receives subject/grade/filename/section via params,
 * fetches the live /view, reconciles this section's server state (so the pointer + bookmark
 * are what the teacher last left — 9A at unit 2), then renders LessonView. A loading state
 * holds until BOTH the view and the pull are in — the live-walk finding (no false first
 * frame) applied here too. */
import { useEffect, useState } from "react";
import { fetchPlanView } from "@aruvi/shared/plans";
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
  const { subject, grade, filename, section, tour, sectionLabel } = useLocalSearchParams();
  const sectionKey = section ? `${subject}_${grade}_${section}` : "";
  const [state, setState] = useState({ loading: true, data: null, err: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (sectionKey) { try { await pullSectionState([sectionKey]); } catch {} }
        // Kept on the device when opened; read back from there offline (2026-09-18).
        const d = await fetchPlanView(subject, grade, filename);
        if (alive) setState({ loading: false, data: d, err: "" });
      } catch (e) {
        const m = String(e.message) === "404" ? "This lesson could not be found." : "Couldn't load this lesson right now.";
        if (alive) setState({ loading: false, data: null, err: m });
      }
    })();
    return () => { alive = false; };
  }, [subject, grade, filename, section]);

  /* ★ THE FAILURE COPY IS THE PHONE'S OWN, AND IT STAYS (founder, 2026-09-17, answering Q20).
     The web fails SILENTLY here — a lesson that will not load leaves her on the list with no
     word about it — and the phone says "This lesson could not be found." / "Couldn't load this
     lesson right now." with a way back. Asked which surface should follow which, the founder
     named it a divergence rather than moving either.
     ⚠️ So this is a phone ADDITION under CLAUDE.md §0's second allowance, not a gap in the port:
     do not delete it to "match the web", and do not file it as debt. **The web still owes its
     teacher an answer here**, and that is a web decision, recorded and not taken. */
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
  return <LessonView view={state.data.view} meta={state.data.meta} sectionKey={sectionKey}
    sectionLabel={sectionLabel ? String(sectionLabel) : ""}
    tourUnit={tour === "1"} onExit={() => router.back()} />;
}

const st = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 } });
