/* ───────── The document, shown before it is sent (Track D step 7) ─────────
 *
 * ★ FOUNDER, 2026-09-17: *"this pdf in the bottom of iphone has the upload icon on bottom right.
 * it displays the pdf on the full screen and from there gives option to choose. Whereas our
 * current export does not display and directly opens app."* He was holding the Files app's own
 * preview beside ours. The share sheet we raised was never wrong — Mail, WhatsApp and Save to
 * Files were all one tap away — but it arrived before he had seen what he was about to send, so
 * the first thing Meyy did with a document it had just built was ask him where to put it.
 *
 * ★ SO THE DOCUMENT COMES FIRST, AND SHARING IS A CHOICE MADE FROM IT. She reads the report, and
 * the arrow is there if she wants to send it. If she does not, she closes it — which is a thing
 * she previously could not do without first dismissing a sheet she had not asked for.
 *
 * ★ AND IT IS OUR SCREEN, NOT THE SYSTEM'S. The screen he photographed is iOS's Quick Look
 * (`QLPreviewController`), which would also preview Word — but it has no Expo module (there is
 * no `expo-quick-look` on npm, and `react-native-file-viewer`, the usual answer, was last
 * published in 2021, before the new architecture this app runs on), so it means hand-written
 * native code and leaving Expo Go for a dev build. Against that, an in-app preview keeps her
 * inside Meyy, under Meyy's own bar, with the bottom nav still up — which is the founder's
 * standing rule that a screen must not take away the app's nav and leave one way out of itself.
 * When this app does move to a dev build, Quick Look is the upgrade to revisit: it is the only
 * thing that would give a .docx the same treatment.
 *
 * ⚠️ PDF ONLY, AND iOS ONLY — `canPreview` in lib/download.js owns that test and says why. The
 * YEAR PLAN is Word-only and therefore still goes straight to the sheet; that raggedness is
 * named rather than hidden, and closing it means giving the year-plan route a PDF format.
 *
 * ⚠️ THE FILE IS A COURIER COPY AND THIS SCREEN OWNS ITS LIFE. `downloadDocument` deletes in a
 * `finally` because the sheet is the end of the story there; here the file must outlive the
 * fetch, so it is deleted on UNMOUNT — by the ✕, by the back gesture, by the bottom nav, by any
 * way out there is. Best-effort, as it is everywhere else: a cache file that survives is the
 * OS's to reclaim.
 *
 * ⚠️ `allowingReadAccessToURL` is not optional. WKWebView will not open a `file://` it has not
 * been granted access to, and a PDF that silently renders blank is exactly the kind of failure
 * that reads as "the export is broken".
 */
import { useEffect, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import Svg, { Path } from "react-native-svg";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "../../components/Text";
import { cacheDirUri, discardFile, shareFile } from "../../lib/download";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";

/* The Year Plan's export glyph, unchanged — an arrow leaving a tray. The same mark for the same
   act, so a teacher who has met it once on the year plan knows it here. */
const ExportIcon = ({ size = 17, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 15V3" />
    <Path d="M8 7l4-4 4 4" />
    <Path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </Svg>
);

export default function DocumentPreview() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  const { uri, name, mime, label } = useLocalSearchParams();
  /* ★ THE BAR NAMES THE ITEM, NOT THE FILE (the Settings bar's own rule, 2026-09-03). The item
     here is a report of a chapter, so the bar reads "Force and Pressure" — the words she chose
     it by — while the FILENAME stays what it always was and is what travels with the file into
     Mail. A 40-character slug in 19px display serif would clip to nothing and tell her less. */
  const title = label || name;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  /* The courier copy's whole life is this screen. Deliberately keyed on `uri` alone so a
     re-render cannot delete the file out from under the WebView. */
  useEffect(() => () => discardFile(uri), [uri]);

  if (!uri) {
    /* Reached only by a hand-typed route or a lost param — say so plainly rather than render an
       empty grey rectangle that looks like a broken document. */
    return (
      <View style={[ws.main, { paddingTop: 20 }]}>
        <Text style={[ws.mlp2_loading, { color: t.ink_soft }]}>
          There’s no document to show. Create the report again from your lesson.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* The frozen row in the slot Settings' bar uses — same measures, no gear, because this is
          the same KIND of thing: a screen that names what she is looking at and offers the one
          way out. The document's own name is the label, truncated rather than wrapped. */}
      <View style={ws.set_bar}>
        <View style={[ws.set_bar_title, { flex: 1 }]}>
          <Text style={[ws.set_bar_lab, { color: t.ink }]} numberOfLines={1}>{title}</Text>
        </View>
        <Pressable onPress={() => shareFile({ uri, name, mime })} accessibilityRole="button"
          accessibilityLabel={`Share ${title}`} hitSlop={8}
          style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
          <ExportIcon color={t.pine_d} />
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button"
          accessibilityLabel={`Close ${title}`} hitSlop={6} style={ws.set_bar_x}>
          <Text style={[ws.set_bar_x_glyph, { color: t.ink_soft }]}>✕</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, backgroundColor: t.paper_sunk }}>
        <WebView
          source={{ uri }}
          originWhitelist={["*"]}
          allowingReadAccessToURL={cacheDirUri()}
          style={{ flex: 1, backgroundColor: t.paper_sunk }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setFailed(true); }}
        />
        {loading || failed ? (
          <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
                         alignItems: "center", justifyContent: "center",
                         backgroundColor: t.paper_sunk }}>
            {failed ? (
              /* It was built and written — only the rendering failed — so the arrow above still
                 works, and that is the useful thing to say. */
              <Text style={[ws.mlp2_loading, { color: t.ink_soft, textAlign: "center" }]}>
                Couldn’t show this document here.{"\n"}Tap the arrow above to send or save it.
              </Text>
            ) : (
              <ActivityIndicator color={t.pine} />
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}
