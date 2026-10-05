/* ───────── "Report an issue" — the phone's port of the web's ReportCard + ReportProblem ─────────
 * Founder, 2026-10-03. The Support box opened on the spot from a lesson, sending through the two
 * channels Meyy already answers on. Same words, same rules as web/app/components/ReportProblem.jsx;
 * the lesson facts come from `@aruvi/shared/report`, so both surfaces describe a unit identically.
 *
 *   The LINK ("Report an issue ›", a right-aligned pill — the card it replaced was "too
 *   dominating") ends the Lesson tab ABOVE "Mark this unit complete", and ends the Assess tab —
 *   only those two (they improve the lesson; Overview/Material are marginal).
 *   The WINDOW is the app's own Sheet (not the web's bottom sheet — on the phone every window is
 *   this one, and a second shape is how windows start to differ). Inside: a green box with two
 *   rows in the nav-label style, an optional compact phase picker on row 1 (Lesson tab only,
 *   empty by default, "Phase 2 - 15 min"), a text box, then by channel —
 *     WhatsApp only → "Send on WhatsApp": opens HER WhatsApp with the text ready; she taps Send.
 *     Email only    → "Send": POST /support, category "plan", the lesson as context.
 *     Both          → two buttons, she picks one.   Neither → a note; no form (WALK-A-135).
 *   No how-to line, no activity name, and the internal plan code is never shown or put in her
 *   WhatsApp — it rides in the case context for Meyy only. */
import { useEffect, useState } from "react";
import { View, Pressable, Linking, Platform } from "react-native";
import { Text, TextInput } from "../Text";
import { getJSON, postJSON, waLink } from "@aruvi/shared/format";
import { problemReport, reportWhatsAppText, phaseOptionLabel, SUPPORT_CAP_NOTE } from "@aruvi/shared/report";
import { Sheet } from "../AttachSheet";
import Dropdown from "../Dropdown";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";
import { useTourAnchor } from "../../lib/tour";
import TourRing from "../TourRing";
import { versionLine } from "../../lib/version";

const MAX = 4000;
/* Android's TextInput hint ignores lineHeight, so there the prompt is drawn by hand (see the box). */
const ANDROID_HINT = Platform.OS === "android";

/* ★ JUST THE LINK (founder, 2026-10-03: the card "looks too dominating"). One quiet pill,
   right-aligned under the last phase — above Mark complete on the Lesson tab, and at the end of
   the Assess tab. `tour` names the anchor only where the tour rings it (Lesson tab, step 13). */
export function ReportCard({ onPress, tour = false }) {
  const ws = useWebStyles();
  const ref = useTourAnchor(tour ? "report-issue" : null);
  return (
    <View ref={ref} collapsable={false} style={ws.lv_rlink}>
      <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}
        style={({ pressed }) => [ws.lv_rcard_btn, pressed && { opacity: 0.7 }]}>
        <Text fixed style={ws.lv_rcard_btn_t}>Report an issue ›</Text>
        {tour ? <TourRing name="report-issue" radius={999} out={3} /> : null}
      </Pressable>
    </View>
  );
}

/* The window. `phases` = the unit's phases as minutes (null where the plan has none). */
export default function ReportIssue({ lp, unitNumber, unitTitle = "", dropped = false, part = "lesson",
                                      phases = [], planFile = "", onClose }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const [phase, setPhase] = useState("");
  const [meta, setMeta] = useState(null);
  const [metaErr, setMetaErr] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(null);
  const report = problemReport({ lp, unitNumber, unitTitle, dropped, phase, part, planFile });
  // "0" not "" — an empty value would match this option and hide the placeholder.
  const phaseOpts = part === "lesson" && phases.length
    ? [{ value: "0", label: "No particular phase" },
       ...phases.map((mins, i) => ({ value: String(i + 1), label: phaseOptionLabel(i + 1, mins) }))]
    : [];

  useEffect(() => {
    let live = true;
    getJSON("/support")
      .then((d) => { if (live) { if (d) setMeta(d); else setMetaErr(true); } })
      .catch(() => { if (live) setMetaErr(true); });
    return () => { live = false; };
  }, []);

  const known = !!meta && !metaErr;
  const hasEmail = known && !!meta.email;
  const hasWa = known && !!meta.whatsapp;
  const ready = !!text.trim() && !busy;
  const capped = known && !!meta.cap_reached;      // 5 new requests today, email + WhatsApp (2026-10-04)

  const sendWa = () => {
    if (!ready) return;
    Linking.openURL(waLink(reportWhatsAppText(report, text), meta.whatsapp_number)).catch(() => {});
    onClose();
  };
  const sendEmail = () => {
    if (!ready) return;
    setBusy(true); setErr("");
    postJSON("/support", { category: "plan", message: text.trim(),
                           context: { ...report.context, version: versionLine() } })
      .then((r) => setSent(r))
      .catch((e) => setErr((e && e.detail) || "Couldn’t send that just now — try again."))
      .finally(() => setBusy(false));
  };

  const Btn = ({ title, onPress, primary }) => (
    <Pressable onPress={onPress} disabled={!ready} accessibilityRole="button"
      style={({ pressed }) => [ws.rp_btn,
        primary ? { backgroundColor: t.pine } : { backgroundColor: t.paper_2, borderWidth: 1, borderColor: t.pine },
        { opacity: !ready ? 0.45 : pressed ? 0.85 : 1 }]}>
      {/* ONE LINE, ALWAYS (founder, 2026-10-05, Pixel: "Send on WhatsApp" broke onto two rows,
          one row on iPhone). Sixteen spaced mono capitals need ~131px and a half-width button on a
          360dp phone has about that, so Android's measurement wrapped it. It may shrink a shade to
          fit — the header labels' WALK-A-027 treatment — but never break. */}
      <Text fixed numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
        style={[ws.rp_btn_t, { color: primary ? "#f6f1e7" : t.pine_d }]}>{title}</Text>
    </Pressable>
  );

  if (sent) {
    return (
      <Sheet visible scroll belowBar onClose={onClose} title="Sent — thank you">
        <Text style={[ws.sup_refcap, { color: t.ink_soft, marginTop: 4 }]}>Your reference</Text>
        <Text style={[ws.sup_ref, { color: t.pine }]}>{sent.reference}</Text>
        <Text style={ws.rp_msg}>{sent.emailed
          ? <>We’ve emailed a copy to <Text style={{ fontWeight: "600" }}>{sent.email}</Text>. Expect a reply
              within {sent.reply_window || "1 working day"}.</>
          : <>Your report is with us. Expect a reply within {sent.reply_window || "1 working day"}.</>}</Text>
        <View style={ws.rp_two}><Btn title="Back to the lesson" onPress={onClose} primary /></View>
      </Sheet>
    );
  }

  return (
    <Sheet visible scroll belowBar onClose={onClose} title="Report an issue">
      {/* Two short rows, nothing else; the phase picker shares row 1 (founder, 2026-10-03). */}
      <View style={ws.rp_ctx}>
        <View style={ws.rp_ctx_row}>
          <Text fixed style={[ws.rp_ctx_v, { flexShrink: 1 }]} numberOfLines={1}>{report.line1}</Text>
          {phaseOpts.length ? (
            <View style={ws.rp_phase}>
              <Dropdown compact value={phase} onChange={(v) => setPhase(v === "0" ? "" : v)}
                options={phaseOpts} placeholder="Phase (optional)" label="Which phase" />
            </View>
          ) : null}
        </View>
        <Text fixed style={[ws.rp_ctx_v, ws.rp_ctx_2]}>{report.line2}</Text>
      </View>

      {!meta && !metaErr ? <Text style={[ws.rp_msg, { color: t.ink_soft }]}>One moment…</Text> : null}
      {metaErr ? <Text style={ws.rp_msg}>We couldn’t load your support details just now. Close this and try again in a moment.</Text> : null}
      {known && !hasEmail && !hasWa ? (
        <Text style={ws.rp_msg}>Meyy replies only to an email address or WhatsApp on your account. Add one in
          Settings › Personal profile, then report this again.</Text>
      ) : null}
      {known && capped && (hasEmail || hasWa) ? (
        <>
          <Text style={ws.rp_msg}>{meta.cap_note || SUPPORT_CAP_NOTE}</Text>
          {hasWa ? (
            <View style={ws.rp_two}>
              <Pressable accessibilityRole="button" onPress={() => {
                  Linking.openURL(waLink("", meta.whatsapp_number)).catch(() => {}); onClose(); }}
                style={({ pressed }) => [ws.rp_btn, { backgroundColor: t.pine, opacity: pressed ? 0.85 : 1 }]}>
                <Text fixed style={[ws.rp_btn_t, { color: "#f6f1e7" }]}>Open WhatsApp chat</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
      {known && !capped && (hasEmail || hasWa) ? (
        <>
          <Text fixed style={ws.rp_lab}>What looks wrong?</Text>
          {/* ★ ANDROID DRAWS ITS OWN PLACEHOLDER (founder, 2026-10-05, Pixel: the prompt's lines sat
              "too close", where the iPhone spaces them well). Android's TextInput hint ignores
              `lineHeight` — only typed text gets the 22px — so the two-line prompt came out at the
              font's tight default. There the prompt is a plain Text laid over the empty box, at the
              box's own padding (10/12 + the 1px border) and the same body face, so it spaces as
              typed text will; it never takes a touch, and goes the moment she types. iOS keeps the
              native placeholder, which already honours the line height. */}
          <View>
            <TextInput multiline textAlignVertical="top" value={text} onChangeText={setText} maxLength={MAX}
              accessibilityLabel="What looks wrong?"
              placeholder={ANDROID_HINT ? undefined
                : "Describe what looks wrong. You can paste the line from the lesson here."}
              placeholderTextColor={t.ink_soft}
              style={[ws.rp_text, { borderColor: t.line, backgroundColor: t.field_bg, color: t.ink }]} />
            {ANDROID_HINT && !text ? (
              <Text pointerEvents="none" importantForAccessibility="no"
                style={[ws.rp_text_hint, { color: t.ink_soft }]}>
                Describe what looks wrong. You can paste the line from the lesson here.
              </Text>
            ) : null}
          </View>
          {err ? <Text style={ws.rp_err}>{err}</Text> : null}
          <View style={ws.rp_two}>
            {hasWa ? <Btn title="Send on WhatsApp" onPress={sendWa} primary /> : null}
            {hasEmail ? <Btn title={busy ? "Sending…" : hasWa ? "Send by email" : "Send"} onPress={sendEmail} primary={!hasWa} /> : null}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}
