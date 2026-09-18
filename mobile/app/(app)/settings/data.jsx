/* ───────── Settings › Your data & export (6b·E, app. 04 rows E1-E4) ─────────
 *
 * ★ EVERYTHING BUCKET-B, AS ONE DOCUMENT. Her profile, her notes, her teaching progress, her
 * support messages, her consent record — what `DataRightsService` walks. Never the shared lesson
 * library, which is not hers and would swamp the thing she came for.
 *
 * ★ HIDDEN ON TRIAL, and the ROUTE stays open — the web's rule. §2.5 is a promise about the
 * ROUTES (`/data-rights/*` are never gated, not on subscription, not on entitlement), not about
 * which cards Settings chooses to show; and a gate that can strand her mid-journey is worse than
 * a card being absent.
 *
 * ★ TWO FORMATS, BOTH THE SAME DOCUMENT. Word because it is the one she can edit and keep; PDF
 * because it is the one she can send. ⚠️ Both disabled while EITHER is preparing — two exports
 * in flight would race for the same share sheet.
 */
import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "../../../components/Text";
import { useRouter } from "expo-router";
import { canPreview, downloadDocument, dataExport, fetchDocument } from "../../../lib/download";
import { markDownloaded } from "../../../lib/dataRights";
import { useTheme } from "../../../theme/ThemeContext";
import { useWebStyles } from "../../../theme/web";

export default function YourData() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [failMsg, setFailMsg] = useState("");

  const download = (fmt) => {
    setBusy(fmt); setFailMsg("");
    /* The PDF is shown before it is sent, as the invoice and the lesson reports are (2026-09-18);
       Word has no renderer here and keeps the straight-to-the-sheet path. */
    const doc = dataExport(fmt);
    (canPreview(doc.mime)
      ? fetchDocument(doc).then((f) => router.push({ pathname: "/preview",
          params: { uri: f.uri, name: f.name, mime: f.mime, label: "Your data", from: "settings" } }))
      /* Only to word the final delete question honestly — never a gate. A PREVIEW is not a copy
         in her hands, so only the path that hands the file over marks it. */
      : downloadDocument(doc).then(() => markDownloaded()))
      .catch(() => setFailMsg(
        "Couldn’t prepare your download right now. Try again in a moment."))
      .finally(() => setBusy(""));
  };

  const Row = ({ fmt, label, last }) => (
    <Pressable onPress={busy ? undefined : () => download(fmt)} disabled={!!busy}
      accessibilityRole="button" accessibilityState={{ disabled: !!busy }}
      style={[ws.set_row, { borderBottomColor: last ? "transparent" : t.line_soft,
                            opacity: busy && busy !== fmt ? 0.5 : 1 }]}>
      <Text style={[ws.set_lab, { color: t.ink }]}>
        {busy === fmt ? "Preparing…" : label}</Text>
      <Text style={[ws.set_chev, { color: t.ink_soft }]}>›</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={[ws.main, { paddingTop: 12 }]}>
      {/* No heading — the bar reads "⚙ Your data & export". */}
      <Text style={[ws.set_hint, { color: t.ink_soft, marginTop: 0 }]}>
        Everything you’ve created — your profile, notes and teaching progress — in one document.
      </Text>
      <View style={[ws.set_card, { borderColor: t.line, backgroundColor: t.card_bg }]}>
        <Row fmt="docx" label="Download as Word" />
        <Row fmt="pdf" label="Download as PDF" last />
      </View>
      {failMsg ? (
        <Text accessibilityRole="alert" style={[ws.acct_fail, { color: t.danger }]}>{failMsg}</Text>
      ) : null}
    </ScrollView>
  );
}
