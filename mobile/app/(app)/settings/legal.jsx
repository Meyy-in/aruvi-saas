/* ───────── Settings › Legal — the agreement's permanent home (6b·G, app. 04 rows G1-G5) ─────────
 *
 * ★ A CARD OF ITS OWN, NOT A ROW INSIDE ABOUT. The document promises it is "permanently available
 * under Settings → Legal", so a teacher looking for what she signed must not have to guess that
 * it is filed under version information. Never hidden on trial either: what Meyy is and what it
 * does with her data is not a subscriber benefit.
 *
 * ★ TWO DOCUMENTS, ONE CARD (2026-09-04). The Privacy Notice is a document of its own — DPDP Rule
 * 3(a) wants it readable independently of the agreement — but it is not a second Settings card:
 * "Legal" is where a teacher looks for what Meyy holds her to, and both belong under that word.
 *
 * ★ AND THE SWITCH IS PINNED (founder, same day, twice: "freeze the legal screen from above …
 * when scrolling", then "the buttons are frozen but rest all are moving above and below it … top
 * down to the button and the words … visible at all times"). Both documents are long, and the
 * other one must stay one tap away from anywhere inside this one. ONE band — pills AND the
 * heading together — because two pinned elements at different offsets need the pills' height
 * known, and one band needs nothing.
 * ⚠️ On the phone "pinned" is simply a View ABOVE the ScrollView, the idiom My Classes' greeting
 * and My Lessons' frozen header already use. The web needs `position: sticky` and a measured
 * `--nav-h` because it has ONE scroll region; here every screen owns its own, so the band is
 * outside it and nothing can scroll through the air above the pills.
 *
 * ⚠️ NO "Legal" TITLE. The frozen Settings bar says "⚙ Legal", and the band's heading is the
 * document's own — a settings label stacked above it made the screen read as two headings for
 * one thing (founder, 2026-08-27 and 2026-09-03).
 */
import { useEffect, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Text } from "../../../components/Text";
import { API } from "@aruvi/shared/config";
import Markdown from "../../../components/Markdown";
import Agreement from "../../../components/Agreement";
import { useTheme } from "../../../theme/ThemeContext";
import { useWebStyles } from "../../../theme/web";

/* The Privacy Notice, read signed-in. ⚠️ Still a BARE fetch with no identity header — the notice
   must load for anyone, and `app/privacy.jsx` (the pre-sign-in screen) makes the same call for
   the same reason. Two callers, one rule, stated in both. */
function PrivacyBody() {
  const ws = useWebStyles();
  const [state, setState] = useState(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let live = true;
    fetch(`${API}/legal/privacy`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (live) setState(d); })
      .catch(() => { if (live) setFailed(
        "The privacy notice couldn’t be loaded just now. Check your connection and try again."); });
    return () => { live = false; };
  }, []);
  if (failed) return <Text style={ws.lgl_fail}>{failed}</Text>;
  if (!state) return <Text style={ws.fr_loading}>Loading the privacy notice…</Text>;
  const doc = (state && (state.document || state)) || {};
  return (
    <View>
      <Markdown md={doc.body} />
      <Text style={ws.lgl_version}>
        {doc.title || "Privacy Notice"} · version {doc.version}
        {doc.effective_from ? ` · effective ${doc.effective_from}` : ""}
      </Text>
    </View>
  );
}

export default function Legal() {
  const { t } = useTheme();
  const ws = useWebStyles();
  /* The privacy-notice bar's "Read it" will land here on the notice once it points at Settings
     (6a left it going to `/privacy`); the gear always opens the agreement, which is the web's
     `legalDoc` default. */
  const { doc: wanted } = useLocalSearchParams();
  const [doc, setDoc] = useState(wanted === "privacy" ? "privacy" : "agreement");

  const Pill = ({ id, label }) => {
    const on = doc === id;
    return (
      <Pressable onPress={() => setDoc(id)} accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        style={[ws.lgl_switch_btn, {
          borderColor: on ? t.pine : t.line,
          backgroundColor: on ? t.pine : t.card_bg,
        }]}>
        <Text style={[ws.lgl_switch_t, { color: on ? t.paper : t.ink }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* The one pinned band: the choice, then what she is reading. */}
      <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10,
                     borderBottomWidth: 1, borderBottomColor: t.line, backgroundColor: t.paper }}>
        <View style={ws.lgl_switch} accessibilityRole="tablist">
          <Pill id="agreement" label="User agreement" />
          <Pill id="privacy" label="Privacy notice" />
        </View>
        <Text style={[ws.ob_title, { color: t.ink }]}>
          {doc === "privacy" ? "Privacy Notice" : "Legal Agreement with User"}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[ws.main, { paddingTop: 14 }]}>
        {doc === "privacy" ? <PrivacyBody /> : <Agreement />}
      </ScrollView>
    </View>
  );
}
