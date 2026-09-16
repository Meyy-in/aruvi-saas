/* The Privacy Notice as a screen of its own, reachable with no account yet (GET /legal/privacy
 * needs none — DPDP §5 wants the notice at or before first collection, which is the sign-in and
 * the OTP screen, and both link here). Rendered from the shared parser.
 *
 * ★ IT IS THE WEB'S LOCKED FRAME (app. 03 rows 51-52, 2026-09-16). Three bands: a pinned head,
 * the document scrolling between them, and nothing below. **Back sits at the TOP, above the
 * title, inside the pinned head** (founder, 2026-09-04: "the way out is visible from the first
 * line, not only after the last") — the phone had it at the FOOT, which is the web's UNframed
 * placement, on a document long enough that the way out scrolled away with everything else. The
 * title is pinned with it, so what she is reading is named however far down she goes.
 */
import { useEffect, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Text } from "../components/Text";
import { useRouter } from "expo-router";
import { API } from "@aruvi/shared/config";
import { dateWords } from "@aruvi/shared/legalmd";
import Bar from "../components/Bar";
import Markdown from "../components/Markdown";
import { useTheme } from "../theme/ThemeContext";
import { type } from "../theme/type";

export default function Privacy() {
  const { t } = useTheme();
  const router = useRouter();
  const [state, setState] = useState(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let live = true;
    // Deliberately a bare fetch — no user header: this must load with NO identity.
    fetch(`${API}/legal/privacy`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (live) setState(d); })
      .catch(() => { if (live) setFailed(
        "The privacy notice couldn’t be loaded just now. Check your connection and try again."); });
    return () => { live = false; };
  }, []);

  const doc = (state && (state.document || state)) || {};
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar />
      {/* The pinned head: the way out, then the title. */}
      <View style={[s.head, { borderBottomColor: t.line }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
          <Text style={[type.body, { color: t.pine }]}>← Back</Text>
        </Pressable>
        <Text style={[type.title, { color: t.ink, marginTop: 8 }]}>{doc.title || "Privacy Notice"}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {/* The web's own words in both states — a spinner says "something is happening", which is
            not the same as saying WHAT (the phone drew one and said nothing). */}
        {failed ? (
          <Text accessibilityRole="alert" style={[type.body, { color: t.ink_soft }]}>{failed}</Text>
        ) : !state ? (
          <Text style={[type.body, { color: t.ink_soft }]}>Loading the privacy notice…</Text>
        ) : (
          <>
            <Markdown md={doc.body || ""} />
            {/* The version line in full: which version, when it was published, in what language,
                and where to find it again. The phone printed the number alone. */}
            <Text style={[type.small, { color: t.ink_soft, marginTop: 24 }]}>
              Version {doc.version}
              {doc.published ? ` · ${dateWords(doc.published)}` : ""}
              {" · "}{doc.language === "en" ? "English" : doc.language}
              {" · This notice is available at any time under Settings › Legal."}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
});
