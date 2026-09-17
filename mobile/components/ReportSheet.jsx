/* ───────── Reports — the one document whose shape she chooses (Track D step 7) ─────────
 *
 * A port of the web's `ReportModal` / `ReportButton` (MyLessonPlans.jsx 92-212, app. 05 C30-C36),
 * per CLAUDE.md §4. Opened from a small glyph at the bottom-right of a My Lessons card, so it is
 * asked of a LESSON (subject · class · chapter) and never of a section: a report is a property of
 * the plan, and which of her sections happens to be teaching it does not change a word of it.
 *
 * The three rules the web states and this keeps to the letter:
 *   · composition is SINGLE-select, Lesson Plan first and by default — the common ask;
 *   · the answers tick appears ONLY on the two compositions that contain an assessment, and
 *     defaults OFF. The answer layer is a separate server-side render (`answers=1`), so a clean
 *     copy can never carry answers — and on this surface that is a property of the descriptor in
 *     lib/download.js, not a rule this window has to keep remembering;
 *   · format is PDF by default, Word beside it.
 *
 * ★ THE CARD IS THE APP'S ONE WINDOW (`Sheet`), NOT A SECOND COPY OF `.rpt-modal`. The two shapes
 * differ by a 20px cap and 2px of radius, and a second window implementation is how two windows
 * begin to differ in ways that do matter. The Sheet's own ✕ serves as `.rpt-x`, so the title
 * reserves that corner rather than sharing a row with a second one. Same call as the paywall
 * window took on 2026-09-16.
 *
 * ★ A FAILURE IS SAID IN THE WINDOW, NOT IN AN ALERT — the one deliberate divergence, and it is
 * the web's OWN newer rule rather than a phone idea: when the year-plan export was built on
 * 2026-08-30 the founder's note was explicit that an `alert()` covers the very table she is
 * trying to take away, so it says its failure in a line under the control instead. This window
 * still has the older `alert()` on the web; the sentence and the measures here are `.yp-export-
 * msg`'s, and ⚠️ THE WEB OWES THE SAME CHANGE (recorded, not done — a shared defect fixed on one
 * surface first, the Settings-Support precedent of 2026-09-16).
 *
 * ⚠️ AND IT IS UNWALKABLE BY ANYTHING BUT A HANDSET past the button: `downloadDocument` hands the
 * file to the OS share sheet, which exists only on the phone. On Expo web the request, the auth,
 * the composition, the format and the failure sentence are all still exercised — everything but
 * the sheet itself.
 *
 * Measures live in theme/web.js under `rpt_*` / `sc_report` (§4 rule 2).
 */
import { useState } from "react";
import { View, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "./Text";
import { Sheet } from "./AttachSheet";
import Checkbox from "./Checkbox";
import { useRouter } from "expo-router";
import { canPreview, downloadDocument, fetchDocument, planReport } from "../lib/download";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* The web's report glyph, path for path (a document with lines) — the only mark in the flow;
   the window itself is icon-free by design. */
const ReportIcon = ({ size = 17, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <Path d="M14 3v5h5" /><Path d="M9 13h6" /><Path d="M9 17h6" />
  </Svg>
);

/* The web's own three, in its own words and its own order. */
const REPORT_COMPS = [
  { id: "lesson", title: "Lesson Plan", desc: "Teaching plan, activities, steps and resources" },
  { id: "assessment", title: "Assessment", desc: "Questions and instructions" },
  { id: "integrated", title: "Lesson Plan + Assessment", desc: "Teaching plan together with assessment" },
];

function ReportWindow({ visible, sSlug, gSlug, filename, chapterTitle, onClose }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  const [comp, setComp] = useState("lesson");
  const [answers, setAnswers] = useState(false);
  const [fmt, setFmt] = useState("pdf");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");

  const showAnswers = comp === "assessment" || comp === "integrated";

  const download = () => {
    if (busy) return;
    setBusy(true); setFail("");
    /* `answers` is passed only where it can be carried — see the descriptor. */
    const doc = planReport({ sSlug, gSlug, filename, comp, fmt,
                             answers: showAnswers && answers });
    /* ★ SHOW IT BEFORE SENDING IT, WHERE THAT IS POSSIBLE (founder, 2026-09-17). A PDF on iOS
       goes to the preview screen and the share sheet becomes HER choice, made from the arrow
       there; a Word file has no renderer, so it keeps the straight-to-the-sheet path. The test
       and its reasons live in `canPreview`, not here — this window should not be the place that
       knows what a WebView can draw.
       ⚠️ The window CLOSES either way, and on the preview path it must close BEFORE the push or
       it would sit as a Modal over the screen it just opened. */
    const run = canPreview(doc.mime)
      ? fetchDocument(doc).then((f) => {
          onClose();
          router.push({ pathname: "/preview",
                        params: { uri: f.uri, name: f.name, mime: f.mime, label: chapterTitle } });
        })
      /* The web closes on success; so does this — the document has left, and a window still
         standing over the list invites a second tap that would send it twice. */
      : downloadDocument(doc).then(() => onClose());
    run
      .catch((e) => setFail(
        e?.status === 404 ? "This Meyy server doesn’t have reports yet."
          : e?.status === 501 ? "That format isn’t available on this server."
          : "Couldn’t create the report just now."))
      .finally(() => setBusy(false));
  };

  return (
    /* No kicker/title/sub: this window carries `.rpt-hd`'s own 23px title, which is larger than
       the Sheet's `.ap-title` and pine rather than ink. Passing them would render a second,
       smaller heading above this one. */
    <Sheet visible={visible} onClose={onClose} scroll>
      <Text style={ws.rpt_title}>Reports</Text>
      <Text style={ws.rpt_sub}>Create a report of this lesson or its assessment.</Text>

      <View style={ws.rpt_opts}>
        {REPORT_COMPS.map((c) => {
          const on = comp === c.id;
          const canAns = c.id === "assessment" || c.id === "integrated";
          return (
            <View key={c.id}
              style={[ws.rpt_opt, { borderColor: on ? t.pine : t.line,
                                    backgroundColor: on ? t.tint_pine : t.paper_2 }]}>
              {/* ⚠️ The PRESS is the row, not the box — the answers tick lives inside the same
                  box, and on the web it calls stopPropagation so that ticking it never re-fires
                  the card's select. RN has no bubbling to stop between siblings, so the same
                  intent is said structurally: only the row is pressable, and the tick sits
                  outside it. */}
              <Pressable onPress={() => setComp(c.id)} accessibilityRole="radio"
                accessibilityState={{ checked: on }} style={ws.rpt_opt_row}>
                <View style={ws.rpt_opt_body}>
                  <Text style={ws.rpt_opt_t}>{c.title}</Text>
                  <Text style={ws.rpt_opt_d}>{c.desc}</Text>
                </View>
                <View style={[ws.rpt_radio, { borderColor: on ? t.pine : t.edge,
                                              backgroundColor: on ? t.pine : t.paper_2 }]}>
                  {on ? <View style={[ws.rpt_radio_dot, { backgroundColor: t.paper }]} /> : null}
                </View>
              </Pressable>
              {on && canAns ? (
                <Pressable onPress={() => setAnswers((v) => !v)} accessibilityRole="checkbox"
                  accessibilityState={{ checked: answers }}
                  style={[ws.rpt_ans, { borderTopColor: t.line }]}>
                  <Checkbox checked={answers} size={16} />
                  <Text style={ws.rpt_ans_t}>Include answers / model responses</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={ws.rpt_kicker}>Format</Text>
      <View style={ws.rpt_fmt}>
        {[["pdf", "PDF"], ["docx", "Word"]].map(([id, label]) => {
          const on = fmt === id;
          return (
            <Pressable key={id} onPress={() => setFmt(id)} accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[ws.rpt_fmt_btn, { borderColor: on ? t.pine : t.line,
                                        backgroundColor: on ? t.tint_pine : t.paper_2 }]}>
              <Text style={[ws.rpt_fmt_btn_t, on && ws.rpt_fmt_btn_on_t,
                            { color: on ? t.pine_d : t.ink_soft }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={ws.rpt_foot}>
        <Pressable onPress={onClose} accessibilityRole="button"
          style={[ws.rpt_btn, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
          <Text style={[ws.rpt_btn_label, { color: t.ink }]}>Cancel</Text>
        </Pressable>
        <Pressable onPress={download} disabled={busy} accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          style={[ws.rpt_btn, { borderColor: t.pine, backgroundColor: t.pine,
                                opacity: busy ? 0.6 : 1 }]}>
          <Text style={[ws.rpt_btn_label, ws.rpt_primary_label, { color: t.paper }]}>
            {busy ? "Preparing…" : `Download ${fmt === "pdf" ? "PDF" : "Word"}`}
          </Text>
        </Pressable>
      </View>

      {fail ? (
        <Text accessibilityRole="alert" style={ws.rpt_fail}>
          {fail} Tap Download to try again.
        </Text>
      ) : null}
    </Sheet>
  );
}

/* The trigger on a card. ⚠️ It is a SIBLING of the card's press target, never a child of it —
   react-native-web renders a role="button" Pressable as a real <button>, and a nested button is
   invalid; the card already splits this way for its archive icon (step 4a), and this simply
   takes the corner the card has been reserving for it since then (`mlp2_cardpad`). */
export default function ReportButton({ sSlug, gSlug, filename, chapterTitle }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={6}
        accessibilityLabel={`Create a report of ${chapterTitle}`} style={ws.sc_report}>
        <ReportIcon color={t.ink_soft} />
      </Pressable>
      {open ? (
        <ReportWindow visible sSlug={sSlug} gSlug={gSlug} filename={filename}
          chapterTitle={chapterTitle} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
