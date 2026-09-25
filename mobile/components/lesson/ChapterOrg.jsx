/* ───────── ChapterOrg — the chapter's organisation, ported 1:1 from the web (2026-09-12) ─────────
 * web/app/components/LessonView.jsx `ChapterOrg` + `SSFlowBody` + `ChapterNotesModal`. Same
 * header (kicker · "← back"), title, "{n} Learning Units 1 × 50 min" meta, the tick rail, the
 * axis legend with the "Notes" tab in the gutter, then the body by subject shape: the SS
 * competency MAP (ribbons between units and competencies — measured with onLayout instead of
 * getBoundingClientRect, the one technical translation), the maths-prep flat list, or the
 * accordion of groups. Tapping a unit card opens it (navigation only; the pointer is unmoved).
 * Chapter notes ride the shared plan-notes helpers — server authoritative, device cache. */
import { useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, Pressable, Modal, StyleSheet, Keyboard, Platform } from "react-native";
import { Text, TextInput } from "../Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { fetchEntitlement, fetchPlanNotes, savePlanNote, planNoteKey, userKey } from "@aruvi/shared/format";
import { storage } from "@aruvi/shared/storage";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";
import { BAR_CONTENT_H } from "../Bar";

/* `sectionLabel` (WALK-A-076): a lesson opened from a My Classes card says WHICH section it is
   being taught to — her own name for it where she gave one, else the tag. Same line as the web's
   LessonView kicker: "english·III·Ch. 03·Section VANAM". Omitted from My Lessons (no section). */
export const kickerOf = (lp, sectionLabel = "") =>
  String(lp.subject || "").replace(/_/g, " ")
  + (lp.grade ? `·${String(lp.grade).replace(/grade|class/gi, "").trim().toUpperCase()}` : "")
  + (lp.chapter_number ? `·Ch. ${String(lp.chapter_number).padStart(2, "0")}` : "")
  + (sectionLabel ? `·Section ${sectionLabel}` : "");

function sectionTitleOnly(label) {
  if (!label) return label;
  const cleaned = label.split(" / ").map((seg) => {
    const s = seg.trim();
    const stripped = s.replace(/^(?:Section\s+)?\d+(?:\.\d+)*\s*[—–:.)-]?\s*/i, "").trim();
    return stripped || s;
  }).join(" / ");
  return cleaned || label;
}
const truncateWords = (text, n) => {
  const words = String(text || "").trim().split(/\s+/);
  return words.length <= n ? text : words.slice(0, n).join(" ") + " …";
};

const CN_CAP = 500;
const cnWordCount = (s) => { const t = (s || "").trim(); return t ? t.split(/\s+/).length : 0; };
const CN_GUIDE =
  "For next year, jot what you'll want to remember:\n" +
  "  · where the class generally struggled\n" +
  "  · materials you brought in beyond the book\n" +
  "  · what to do differently next time\n" +
  "  · anything specific to a section you want to recall";
/* ⚠️ THE FULL SCHOOL RANGE (app. 06 row 46). This stopped at 3-10, so classes I, II, XI and XII
   fell through to the bare digit and a Class XI note was headed "Mathematics 11" while every
   other class read "Mathematics IX". Meyy serves the preparatory stage upward, and the senior
   secondary classes exist in the profile whether or not content is served for them yet. */
const CN_ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI",
                   7: "VII", 8: "VIII", 9: "IX", 10: "X", 11: "XI", 12: "XII" };
function cnSubjectGrade(lp) {
  const subj = String(lp.subject || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const gm = String(lp.grade || "").match(/\d+/);
  const grade = gm ? (CN_ROMAN[parseInt(gm[0], 10)] || gm[0]) : String(lp.grade || "").replace(/grade|class/gi, "").trim().toUpperCase();
  return [subj, grade].filter(Boolean).join(" · ");
}

const AXIS_INFO = {
  stage: ["Stages", "the learning progression each group moves through, from first contact to confident practice — the staged, inquiry-led sequence the NCF asks of Science."],
  progression_stage: ["Stages", "the learning progression each group moves through, from first contact to confident practice — the staged, inquiry-led sequence the NCF asks of Science."],
  section: ["Sections", "the parts of the chapter, taught in the graded, build-from-the-familiar sequence the NCF encourages."],
  competency: ["Competencies", "the skill each group of units builds — the competency-based design at the heart of the NCF."],
  spine: ["Spines", "the language skills the units develop together, in the integrated way the NCF asks languages to be taught."],
};

const SS_TIER_OF = (w) => (Number(w) >= 3 ? "Central" : Number(w) === 2 ? "Substantive" : "Present");
const SS_TIER_DOTS = { Central: "●●●", Substantive: "●●", Present: "●" };
const SS_RIBBON_W = { Central: 5, Substantive: 3.5, Present: 2.5 };

/* ── one unit card (.co-card) ── */
/* `tight` = the web's ≤600px Science / Social Sciences rule: those two carry the longest unit
   titles, so they drop a further notch rather than wrap. */
function UnitCard({ ws, n, p, status, onOpen, tight, onCur }) {
  const dur = p.meta && p.meta.duration_minutes;
  const ref = useRef(null);
  return (
    <Pressable ref={ref} onPress={() => onOpen(n)}
      onLayout={status === "cur" && onCur ? () => onCur(ref.current) : undefined}
      style={[ws.co_card, status === "cur" && ws.co_card_cur, status === "done" && ws.co_card_done]}>
      <Text style={[ws.co_num, status === "done" && ws.co_num_done, status === "up" && ws.co_num_up]}>{n + 1}.</Text>
      <Text style={[ws.co_utitle, tight && ws.co_utitle_tight, status === "done" && ws.co_utitle_done]}
        numberOfLines={2}>{p.title || `Unit ${n + 1}`}</Text>
      <View style={ws.co_side}>
        {status === "cur" ? <Text style={ws.co_now}>now</Text> : null}
        {dur ? (
          <View style={ws.co_dur}>
            <Text style={ws.co_dur_n}>{dur}</Text>
            <Text style={ws.co_dur_u}>min</Text>
          </View>
        ) : null}
        {status === "done" ? <Text style={ws.co_mark}>✓ taught</Text> : null}
      </View>
      <Text style={ws.co_go}>→</Text>
    </Pressable>
  );
}

/* ── the Social Sciences map ── */
function SSFlowBody({ ws, t, units, pointer, doneAll, onOpenUnit, gapNote, onCur }) {
  const [focus, setFocus] = useState(null);       // null | {t:'u'|'c', id}
  const [uPos, setUPos] = useState({});           // i → {y, h} within units column
  const [cPos, setCPos] = useState({});           // code → {y, h} within comps column
  const [cols, setCols] = useState({ u: null, c: null, w: 0, h: 0 });
  const COLORS = [t.pine, t.clay, t.ochre, t.ss_slate, t.ss_plum, t.ink_soft];

  /* ★ EVERY RIBBON LEFT FROM THE SAME POINT (founder-reported, 2026-09-17).
     `onLayout` reports a view's box RELATIVE TO ITS PARENT, and both measuring handlers sat on
     the row/card itself — which is the FIRST CHILD of a per-item wrapper <View> (the wrapper
     exists so the popup can sit under its row). So every row reported y: 0, every ribbon
     anchored to the same pair of points near the top of the two columns, and the map collapsed
     into one bundle: the web's getBoundingClientRect is page-absolute and has no such trap,
     which is why the 1:1 port looked right on paper. The WRAPPER is the view whose y is
     relative to the column, so y is measured there; the row keeps reporting its own HEIGHT (a
     box's height is parent-independent). An edge needs both halves before it can be drawn. */
  const setRow = (i, patch) => setUPos((p) => ({ ...p, [i]: { ...(p[i] || {}), ...patch } }));
  const setComp = (code, patch) => setCPos((p) => ({ ...p, [code]: { ...(p[code] || {}), ...patch } }));

  const comps = useMemo(() => {
    const map = new Map();
    units.forEach((u, i) => ((u.meta && u.meta.competency_edges) || []).forEach((e) => {
      if (!e || !e.c_code) return;
      if (!map.has(e.c_code)) map.set(e.c_code, { code: e.c_code, weight: Number(e.weight) || 1, text: e.competency_text || "", units: [] });
      map.get(e.c_code).units.push(i);
    }));
    const list = [...map.values()];
    list.sort((a, b) => b.weight - a.weight || b.units.length - a.units.length || String(a.code).localeCompare(String(b.code)));
    list.forEach((c, k) => { c.tier = SS_TIER_OF(c.weight); c.color = COLORS[Math.min(k, COLORS.length - 1)]; });
    return list;
  }, [units]);
  const byCode = useMemo(() => Object.fromEntries(comps.map((c) => [c.code, c])), [comps]);

  const paths = [];
  if (cols.u && cols.c) {
    units.forEach((u, i) => ((u.meta && u.meta.competency_edges) || []).forEach((e) => {
      const a = uPos[i], b = cPos[e.c_code], comp = byCode[e.c_code];
      if (!a || !b || !comp) return;
      if (a.y == null || a.h == null || b.y == null || b.h == null) return;
      const ax = cols.u.x + cols.u.width, ay = cols.u.y + a.y + a.h / 2;
      const bx = cols.c.x, by = cols.c.y + b.y + b.h / 2;
      const hot = !focus || (focus.t === "c" && focus.id === e.c_code) || (focus.t === "u" && focus.id === i);
      const dx = (bx - ax) * 0.5;
      paths.push({ d: `M${ax},${ay} C${ax + dx},${ay} ${bx - dx},${by} ${bx},${by}`, color: comp.color, w: SS_RIBBON_W[comp.tier], o: hot ? (focus ? 0.75 : 0.28) : 0.05 });
    }));
  }
  const pad2 = (n) => String(n).padStart(2, "0");

  return (
    <View>
      {/* ★ THE INSTRUCTION READS FIRST (founder, 2026-09-17, web + phone alike). It used to sit
          UNDER the map — on a phone that is below the fold, so the one line telling her the
          columns are tappable arrived after she had already decided they were not. It is now
          PERMANENT rather than gated on `!focus` as it was at the foot: a line that vanishes
          costs nothing at the bottom of a page and would jerk the whole map upward on her
          first tap at the top of one. */}
      <Text style={ws.cof_hint}>Tap a unit or a competency to follow its connections</Text>
      <View style={ws.cof_wrap} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setCols((c) => ({ ...c, w: width, h: height })); }}>
        {cols.w ? (
          <Svg width={cols.w} height={cols.h} style={StyleSheet.absoluteFill} pointerEvents="none">
            {paths.map((p, k) => <Path key={k} d={p.d} fill="none" stroke={p.color} strokeWidth={p.w} strokeOpacity={p.o} strokeLinecap="round" />)}
          </Svg>
        ) : null}
        <View style={ws.cof_units} onLayout={(e) => { const l = e.nativeEvent.layout; setCols((c) => ({ ...c, u: l })); }}>
          {units.map((u, i) => {
            const st = pointer == null ? "" : (doneAll || i < pointer) ? "done" : i === pointer ? "cur" : "";
            const edges = (u.meta && u.meta.competency_edges) || [];
            const dimmed = focus && ((focus.t === "c" && !edges.some((e) => e.c_code === focus.id)) || (focus.t === "u" && focus.id !== i));
            const open = focus && focus.t === "u" && focus.id === i;
            const rule = st === "cur" ? t.clay : st === "done" ? t.pine : t.line;
            return (
              <UnitRow key={i} ws={ws} i={i} u={u} st={st} edges={edges} dimmed={dimmed} open={open}
                rule={rule} pad2={pad2} onOpenUnit={onOpenUnit} onCur={onCur}
                setRow={setRow} setFocus={setFocus} />
            );
          })}
        </View>
        <View style={ws.cof_comps} onLayout={(e) => { const l = e.nativeEvent.layout; setCols((c) => ({ ...c, c: l })); }}>
          {comps.map((c) => {
            const dimmed = focus && ((focus.t === "c" && focus.id !== c.code) || (focus.t === "u" && !c.units.includes(focus.id)));
            const open = focus && focus.t === "c" && focus.id === c.code;
            const openViaUnit = !open && focus && focus.t === "u" && c.units.includes(focus.id);
            return (
              <View key={c.code} onLayout={(e) => setComp(c.code, { y: e.nativeEvent.layout.y })}>
                <Pressable onPress={() => setFocus(open ? null : { t: "c", id: c.code })}
                  onLayout={(e) => setComp(c.code, { h: e.nativeEvent.layout.height })}
                  style={[ws.cof_c, dimmed && ws.cof_dim]}>
                  <Text style={[ws.cof_code, { color: c.color }]}>{c.code}</Text>
                  <Text style={ws.cof_tiername}>{c.tier}</Text>
                  {/* Dots carry the TIER, and the tier is never a colour (globals.css §cof:
                      "colour is reserved for competency IDENTITY") — they stay ink. */}
                  <Text style={ws.cof_dots}>{SS_TIER_DOTS[c.tier]}</Text>
                </Pressable>
                {open || openViaUnit ? (
                  <View style={[ws.cof_pop, { borderLeftColor: c.color }]}>
                    <Text style={ws.cof_pop_t}>{c.text}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
      {gapNote ? <Text style={ws.cof_gap}>{gapNote}</Text> : null}
    </View>
  );
}

/* One unit row + its popup. Its own component because the row needs a ref (to bring "now" into
   view on open) and the wrapper/row split above needs two separate layout handlers. */
function UnitRow({ ws, i, u, st, edges, dimmed, open, rule, pad2, onOpenUnit, onCur, setRow, setFocus }) {
  const rowRef = useRef(null);
  return (
    <View onLayout={(e) => setRow(i, { y: e.nativeEvent.layout.y })}>
      <Pressable ref={rowRef} onPress={() => setFocus(open ? null : { t: "u", id: i })}
        onLayout={(e) => {
          setRow(i, { h: e.nativeEvent.layout.height });
          if (st === "cur" && onCur) onCur(rowRef.current);
        }}
        style={[ws.cof_u, st === "cur" && ws.cof_u_cur, st === "done" && ws.cof_u_done, dimmed && ws.cof_dim]}>
        <Text style={[ws.cof_num, st === "done" && ws.cof_num_done]}>{pad2(i + 1)}</Text>
        <Text style={ws.cof_utitle} numberOfLines={1}>{(u.title || `Unit ${i + 1}`).split(":")[0]}</Text>
        {edges.length ? null : <Text style={ws.cof_noedge}>—</Text>}
        <Pressable onPress={() => onOpenUnit(i)} hitSlop={8} accessibilityLabel={`Open unit ${pad2(i + 1)}`}>
          <Text style={[ws.cof_uopen, st === "cur" && ws.cof_uopen_cur, st === "done" && ws.cof_uopen_done]}>→</Text>
        </Pressable>
      </Pressable>
      {open ? (
        <Pressable onPress={() => onOpenUnit(i)} style={[ws.cof_pop, ws.cof_pop_open, { borderLeftColor: rule }]}>
          <Text style={ws.cof_pop_t}>
            <Text style={ws.cof_pop_k}>{pad2(i + 1)}</Text> · {u.title || `Unit ${i + 1}`}
            {u.meta && u.meta.duration_minutes ? ` · ${u.meta.duration_minutes} min` : ""}
          </Text>
          {!edges.length ? <Text style={ws.cof_pop_quiet}>Taught in full — builds no competency edge, by design</Text> : null}
          <Text style={ws.cof_pop_go}>→</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── the notes modal ── */
/* ───────── Chapter notes — the web's .cn-* window (aligned 2026-09-14) ─────────
 * A CENTRED CARD over a dimmed page. It was a pageSheet sliding up from the foot, which is a
 * different object to the hand even before any styling: the web's is a 468-wide modal you tap
 * outside to dismiss, with a hairline under the head and another over the foot.
 * The writing area is RULED PAPER — a line every RULE_H, with the text set at the same
 * line-height so she writes ON the rules rather than between them. The web gets this from a
 * repeating gradient with `background-attachment: local`, which React Native has no equivalent
 * for; here the rules are real Views behind a transparent TextInput, and both live inside one
 * ScrollView sized to the text, so the rules scroll WITH the writing exactly as the web's do.
 * That is the whole reason the TextInput has scrollEnabled={false}: if it scrolled its own
 * content the text would drift off the rules the moment the note ran past one screen. */
const RULE_H = 32;

function ChapterNotesModal({ ws, t, chapterTitle, subjectGrade, initial, onSave, onClose, readOnly }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial || "");
  const [showWarn, setShowWarn] = useState(false);   // WALK-A-092: the warning behind a link
  const [paperH, setPaperH] = useState(0);      // the visible sheet
  const [contentH, setContentH] = useState(0);  // how far the writing actually runs
  const ref = useRef(null);
  /* ★ THE KEYBOARD IS MEASURED, NOT AVOIDED (WALK-A-091, founder 2026-09-25: "the keyboard covers
     Save" — fully on Android, half on the iPhone; on Android a note could not be saved at all).
     This used KeyboardAvoidingView, which did nothing on Android (behavior undefined, and this
     Modal is statusBarTranslucent, so the window is not resized for the keyboard either) and on
     iOS left the foot short by the scrim's own 20px bottom padding. Now the keyboard's height is
     read from its own events and given back as bottom padding, so the card — flex: 1 under its
     cap, head and foot flexShrink: 0 — ends exactly at the keyboard's top edge and the SHEET is
     what gives. If Android DOES resize the window (a device with adjustResize honoured inside a
     Modal), the container's own height has already shrunk by that much, and only the difference
     is padded — never both. */
  const [kb, setKb] = useState(0);            // keyboard height, 0 when down
  const baseH = useRef(0);                    // container height with the keyboard down
  const [curH, setCurH] = useState(0);        // container height now
  useEffect(() => {
    const show = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s1 = Keyboard.addListener(show, (e) => setKb((e && e.endCoordinates && e.endCoordinates.height) || 0));
    const s2 = Keyboard.addListener(hide, () => setKb(0));
    return () => { s1.remove(); s2.remove(); };
  }, []);
  const shrunk = baseH.current && curH ? Math.max(0, baseH.current - curH) : 0;
  const kbPad = Math.max(0, kb - shrunk);
  const wc = cnWordCount(text);
  const change = (v) => { if (cnWordCount(v) > CN_CAP && cnWordCount(v) > wc) return; setText(v); };

  // Enough rules to cover whichever is taller — the sheet, or the writing running past it.
  /* ★ THE RULES ARE BACK, AT THE TEXT'S OWN PITCH (WALK-A-097, founder 2026-09-25: "put a light
     line below each line … it looks a bit dull otherwise"). The old rules failed because they
     sat on a 32px grid under 16px type with 16px of leading, and the two engines seat glyphs
     differently inside that much leading. Now the pitch IS the line height (21) and the leading
     is only 7px, so each rule is the bottom edge of its own line box — under the descenders on
     both platforms — starting after the same paddingTop the text starts after. */
  const LH = (ws.cn_paper && ws.cn_paper.lineHeight) || 21;
  const PAD_T = (ws.cn_paper && ws.cn_paper.paddingTop) || 10;
  /* ★ MEASURED, NOT COMPUTED (WALK-A-097 second pass, founder: "on mobile [the lines are] random
     in relation to text lines"). A multiline TextInput does not reliably space its lines at the
     lineHeight it is given — iOS's text view and Android's EditText each apply it their own way —
     so a grid at `LH` drifts off the writing line by line. A hidden Text with the SAME style and
     the SAME words reports where each of its lines actually falls (onTextLayout); a rule goes
     under each of those, and past the last written line the measured pitch carries on down the
     empty paper. Text and TextInput share the platform's line breaking, which is what makes the
     mirror's lines the input's lines. */
  const [mLines, setMLines] = useState([]);
  const lineFeet = (() => {
    if (!mLines.length) return [];
    // onTextLayout reports y from the text's own origin on some platforms and from the view's
    // (padding included) on others; a first line starting near 0 means the padding is not in it.
    const off = mLines[0].y < PAD_T / 2 ? PAD_T : 0;
    return mLines.map((l) => off + l.y + l.height);
  })();
  const pitch = lineFeet.length > 1 ? (lineFeet[lineFeet.length - 1] - lineFeet[0]) / (lineFeet.length - 1) : LH;
  const ruleTops = (() => {
    const tops = lineFeet.length ? lineFeet.slice() : [PAD_T + LH];
    const floor = Math.max(paperH, contentH) + pitch;
    while (tops[tops.length - 1] + pitch < floor) tops.push(tops[tops.length - 1] + pitch);
    return tops;
  })();

  return (
    /* ★ IT OPENS BELOW THE BAR (founder, 2026-09-14). The window covered the top bar, and the
       app already has a rule for this: Ask Meyy's panel opens beneath the frozen header
       (`top: var(--hdr-h)`) and, since yesterday, stops above the bottom nav. A panel is a room
       INSIDE the app, so the app's own chrome stays visible and lit. The offset is the bar's
       published height plus the status-bar inset — the phone's --hdr-h.
       ★ **A NAMED DIVERGENCE — the web CENTRES this window and keeps doing so** (founder,
       2026-09-17, answering Q20). Asked which surface should follow which, he took neither:
       the placements stay different and the difference is recorded rather than resolved.
       The reasoning each way is real — on the phone a panel that covers the bar leaves exactly
       one way out of itself, which is the rule Ask Meyy's scrim already obeys here; on a desktop
       there is no bar worth preserving and a centred card reads as the modal it is. So this is
       the second of the two allowed divergence kinds in CLAUDE.md §0: a phone-shaped answer,
       named in the component that makes it. **Do not "fix" either surface to match the other
       without asking again.** */
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, paddingTop: insets.top + BAR_CONTENT_H, paddingBottom: kbPad }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (!kb && h > baseH.current) baseH.current = h;   // the keyboard-down height
          setCurH(h);
        }}>
        {/* With the keyboard up the scrim's 20px foot padding is the gap that hid half of Save
            on the iPhone; the card may sit close to the keyboard instead. */}
        <Pressable style={[ws.cn_scrim, kb ? { paddingBottom: 8 } : null]} onPress={onClose}>
          <Pressable style={[ws.cn_modal, { backgroundColor: t.paper, borderColor: t.line }]} onPress={() => {}}>
            <View style={[ws.cn_head, { borderBottomColor: t.line_soft }]}>
              <View style={{ flex: 1 }}>
                {/* WALK-A-092 (founder, 2026-09-25): the child-privacy sentence folds behind a small
                    red "(Privacy warning)" beside the kicker — the room goes to the writing. */}
                <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 8 }}>
                  <Text style={ws.kicker}>Chapter notes</Text>
                  <Pressable onPress={() => setShowWarn((v) => !v)} hitSlop={8}
                    accessibilityRole="button" accessibilityState={{ expanded: showWarn }}
                    accessibilityLabel="Privacy warning">
                    <Text style={{ fontFamily: ws.cn_sg.fontFamily, fontSize: 9.5, letterSpacing: 0.4,
                      color: "#d63a2f", textDecorationLine: "underline" }}>(Privacy warning)</Text>
                  </Pressable>
                </View>
                <Text style={ws.cn_title}>{chapterTitle}</Text>
                {subjectGrade ? <Text style={ws.cn_sg}>{subjectGrade}</Text> : null}
                {showWarn ? (
                  <Text style={[ws.cn_scope, ws.cn_warn, { borderTopColor: t.line }]}>
                    Private data like name, age of child must not be recorded. Meyy reserves
                    right to delete if entered.
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={ws.cn_x}>✕</Text>
              </Pressable>
            </View>

            <View style={ws.cn_paper_wrap} onLayout={(e) => setPaperH(e.nativeEvent.layout.height)}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={{ minHeight: paperH }}>
                  {ruleTops.map((top, i) => (
                    <View key={i} pointerEvents="none" style={[ws.cn_rule, { top: Math.round(top) - 1 }]} />
                  ))}
                  {/* The mirror: invisible, untouchable, same style and words as the input. A
                      trailing zero-width space keeps a final empty line (after Return) counted. */}
                  <Text pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
                    onTextLayout={(e) => setMLines(e.nativeEvent.lines || [])}
                    style={[ws.cn_paper, { position: "absolute", top: 0, left: 0, right: 0, opacity: 0 }]}>
                    {(text || (readOnly ? "No notes were written for this chapter." : CN_GUIDE)) + "\u200b"}
                  </Text>
                  {/* No autoFocus: the window opens whole — the child-privacy rule is readable
                      before the keyboard covers half the screen — and the sheet only gives up
                      its room once she taps to write. */}
                  <TextInput ref={ref} multiline scrollEnabled={false}
                    editable={!readOnly} value={text} onChangeText={change}
                    onContentSizeChange={(e) => setContentH(e.nativeEvent.contentSize.height)}
                    textAlignVertical="top"
                    style={[ws.cn_paper, { minHeight: paperH }]} />
                  {/* ★ THE GUIDE IS DRAWN, NOT A PLACEHOLDER (WALK-A-095, founder 2026-09-25: the
                      grey guide lines were spaced differently on Android than on the iPhone).
                      Android lays out a TextInput's placeholder with its own leading and ignores
                      lineHeight; iOS honours it. A Text with the SAME cn_paper style, sitting
                      exactly where the writing starts, spaces identically on both — and it is
                      pointerEvents none, so a tap still lands in the input underneath. */}
                  {!text ? (
                    <Text pointerEvents="none"
                      style={[ws.cn_paper, { position: "absolute", top: 0, left: 0, right: 0, color: "#b3ab9c" }]}>
                      {readOnly ? "No notes were written for this chapter." : CN_GUIDE}
                    </Text>
                  ) : null}
                </View>
              </ScrollView>
            </View>

            <View style={[ws.cn_foot, { borderTopColor: t.line_soft }]}>
              {readOnly ? (
                <>
                  <Text style={[ws.cn_count, { flex: 1 }]}>Renew to write notes — what you wrote stays yours.</Text>
                  <Pressable onPress={onClose} style={ws.cn_save}><Text style={ws.cn_save_t}>Close</Text></Pressable>
                </>
              ) : (
                <>
                  <View style={ws.cn_foot_l}>
                    {/* The "Dictate" button is GONE (WALK-A-087, founder 2026-09-25). It only put the
                        cursor in the paper — tapping the paper does that — and the dictation is the
                        keyboard's own mic. A mic inside Meyy promised that Meyy was listening. */}
                    <Text style={[ws.cn_count, wc >= CN_CAP && ws.cn_count_over]}>{wc} / {CN_CAP} words</Text>
                  </View>
                  <Pressable onPress={() => onSave(text)} style={ws.cn_save}><Text style={ws.cn_save_t}>Save</Text></Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}

export default function ChapterOrg({ lp, units, pointer, doneAll, onOpenUnit, onBack, sectionLabel = "", dropped = [] }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  /* ★ THE PAGE OPENS ON THE UNIT SHE IS TEACHING (web parity, added 2026-09-17). The web has
     always done this — `document.querySelector(".co-card.cur, .cof-u.cur").scrollIntoView({
     block: "center" })`, once, on mount, tracking only — and the port had no equivalent, so a
     chapter fifteen units deep opened at unit 1 and she had to hunt for "now". Measured rather
     than guessed: the current row hands its node to `revealCur` from its own onLayout (so the
     box is real by then), we ask for its offset inside the scroll content, and centre it in the
     viewport the ScrollView itself reports. Once per mount — `revealedRef` — or every re-layout
     (a popup opening, an accordion turning over) would yank the page back. */
  const scRef = useRef(null);
  const contentRef = useRef(null);
  const revealedRef = useRef(false);
  const vpRef = useRef(0);
  const revealCur = (node) => {
    if (!node || revealedRef.current || pointer == null) return;
    if (!contentRef.current || !scRef.current || !node.measureLayout) return;
    revealedRef.current = true;
    // Belt and braces: a measure that throws inside onLayout would take the page down with it,
    // and landing on unit 1 is a far smaller loss than not landing at all.
    try {
      node.measureLayout(contentRef.current, (x, y, w, h) => {
        const vp = vpRef.current || 0;
        const top = vp ? y - vp / 2 + h / 2 : y;
        if (scRef.current) scRef.current.scrollTo({ y: Math.max(0, top), animated: false });
      }, () => { revealedRef.current = false; });
    } catch { revealedRef.current = false; }
  };
  const [notesLocked, setNotesLocked] = useState(false);
  const [droppedOpen, setDroppedOpen] = useState(false);   // WALK-A-099: folded until tapped
  useEffect(() => { let live = true; fetchEntitlement().then((e) => { if (live && e) setNotesLocked(!!e.lapsed); }).catch(() => {}); return () => { live = false; }; }, []);

  const notesKey = userKey(`chapter_notes_${lp.subject}_${lp.grade}_${lp.chapter_title || ""}`);

  const syncedKey = `${notesKey}__synced`;   // WALK-A-094
  const noteChapter = lp.chapter_number ? String(lp.chapter_number) : (lp.chapter_title || "");
  const [noteText, setNoteText] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  /* WALK-A-096 — the reconcile runs whenever the Notes tab opens, not only on mount (see the
     web's LessonView for the full note). */
  const syncNote = () => {
    let cached = ""; try { cached = storage.getItem(notesKey) || ""; } catch {}
    const dead = false;
    return fetchPlanNotes().then((notes) => {
      if (dead || notes === null) return;
      const srv = notes[planNoteKey(lp.subject, lp.grade, noteChapter)];
      if (srv && typeof srv.text === "string") {
        setNoteText(srv.text);
        try { if (srv.text.trim()) storage.setItem(notesKey, srv.text); else storage.removeItem(notesKey); } catch {}
        try { storage.setItem(syncedKey, "1"); } catch {}
      } else if (cached.trim()) {
        /* WALK-A-094 — see the web's LessonView: a note this device has already seen on the
           server (or saved there) and the server no longer holds was DELETED elsewhere. Only a
           never-synced, pre-server note is lifted up. */
        let synced = false;
        try { synced = storage.getItem(syncedKey) === "1"; } catch {}
        if (synced) {
          setNoteText("");
          try { storage.removeItem(notesKey); } catch {}
        } else {
          savePlanNote(lp.subject, lp.grade, noteChapter, cached).then((res) => {
            if (res && res.ok) { try { storage.setItem(syncedKey, "1"); } catch {} }
          });
        }
      }
    });
  };
  useEffect(() => {
    let c = ""; try { c = storage.getItem(notesKey) || ""; } catch {}
    setNoteText(c);
    syncNote();
  }, [notesKey]);
  const openNotes = () => {
    let opened = false;
    const go = () => { if (!opened) { opened = true; setNotesOpen(true); } };
    const tm = setTimeout(go, 1500);
    syncNote().catch(() => {}).finally(() => { clearTimeout(tm); go(); });
  };
  const saveNote = (v) => {
    setNoteText(v);
    try { if (v.trim()) storage.setItem(notesKey, v); else storage.removeItem(notesKey); } catch {}
    savePlanNote(lp.subject, lp.grade, noteChapter, v).then((res) => {
      if (res && res.ok) { try { storage.setItem(syncedKey, "1"); } catch {} }
      if (res && res.stale && res.note && typeof res.note.text === "string") {
        setNoteText(res.note.text);
        try { if (res.note.text.trim()) storage.setItem(notesKey, res.note.text); else storage.removeItem(notesKey); } catch {}
      }
    });
    setNotesOpen(false);
  };
  const hasNote = !!noteText.trim();

  const countUnits = (g) => ((g.periods || []).length) + (g.children || []).reduce((a, c) => a + countUnits(c), 0);
  const groupOfPointer = () => {
    if (pointer == null) return 0;
    let acc = 0; const gs = lp.groups || [];
    for (let gi = 0; gi < gs.length; gi++) { const c = countUnits(gs[gi]); if (pointer < acc + c) return gi; acc += c; }
    return 0;
  };
  const [openIdx, setOpenIdx] = useState(groupOfPointer);
  const mathsFlat = lp.subject === "mathematics" && (lp.groups || []).length === 1 && lp.groups[0] && lp.groups[0].label === "Lesson";
  const ssFlow = lp.subject === "social_sciences" && (lp.groups || []).length === 1 && !!(lp.groups[0] && lp.groups[0].meta && lp.groups[0].meta.edge_model);

  const total = units.length;
  const taught = pointer == null ? 0 : doneAll ? total : pointer;
  const durCounts = {};
  units.forEach((u) => { const d = u.meta && u.meta.duration_minutes; if (d) durCounts[d] = (durCounts[d] || 0) + 1; });
  const durParts = Object.entries(durCounts).sort((a, b) => Number(a[0]) - Number(b[0])).map(([d, c]) => `${c} × ${d} min`);
  const axisTypes = [];
  const collectAxis = (groups) => (groups || []).forEach((g) => { if (g.type && AXIS_INFO[g.type] && !axisTypes.includes(g.type)) axisTypes.push(g.type); collectAxis(g.children); });
  collectAxis(lp.groups);

  /* ★ THE UNIT NUMBER IS CHAPTER-WIDE, NOT PER-SECTION (founder-reported, 2026-09-14).
     `idx` used to advance only inside the OPEN accordion, because renderGroup was called only
     for that one group. So every section restarted at 01, and — the same bug wearing its other
     face — the number handed to onOpenUnit was an offset within the section, so tapping the
     first sitting of ANY section opened unit 1 of the chapter.
     The web has always done it the other way and says so: "visible gates rendering but NOT the
     flat index: idx advances across every period of every group (open or collapsed) so a unit's
     number matches the pointer regardless of which drop-down is expanded." Same here now —
     renderGroup runs for every group in order and `visible` decides only what is drawn. */
  let idx = -1;
  const renderGroup = (g, keyPrefix, visible) => {
    const out = [];
    if (visible && g.label) out.push(<View key={`${keyPrefix}-bar`} style={ws.co_groupbar}><Text style={ws.co_subname}>{lp.subject === "science" && g.type === "section" ? sectionTitleOnly(g.label) : g.label}</Text></View>);
    (g.periods || []).forEach((p, i) => {
      idx += 1; const n = idx;
      if (!visible) return;
      const status = pointer == null ? "" : (doneAll || n < pointer) ? "done" : n === pointer ? "cur" : "up";
      out.push(<UnitCard key={`${keyPrefix}-${i}`} ws={ws} n={n} p={p} status={status} onOpen={onOpenUnit}
        onCur={revealCur} tight={lp.subject === "science" || lp.subject === "social_sciences"} />);
    });
    (g.children || []).forEach((c, i) => out.push(...renderGroup(c, `${keyPrefix}-${i}`, visible)));
    return out;
  };

  const axisWrap = (
    <View style={ws.co_axiswrap}>
      <View style={ws.co_axis}>
        {ssFlow ? <AxisRow ws={ws} name="The map" blurb="every line connects a unit to an NCF competency it genuinely builds — the competency-based design at the heart of the NCF. Tap either side to follow its connections." />
        : mathsFlat ? <AxisRow ws={ws} name="Units" blurb="one continuous run of learning units in the textbook's own teaching order — the activity-led, play-way flow the NCF asks of the preparatory stage. Tap a unit to open it." />
        : axisTypes.map((ty) => <AxisRow key={ty} ws={ws} name={AXIS_INFO[ty][0]} blurb={`${AXIS_INFO[ty][1]} Click each card to access units underneath.`} />)}
      </View>
      <Pressable onPress={openNotes} accessibilityLabel={hasNote ? "Chapter notes — edit" : "Chapter notes — add"} style={ws.co_notetab}>
        <Text style={[ws.co_notetab_label, { transform: [{ rotate: "-90deg" }], width: 58, textAlign: "center" }]}>Notes</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <View style={[ws.co_stick, { paddingHorizontal: 18 }]}>
        <View style={ws.co_topbar}>
          <Text fixed style={[ws.kicker, { flex: 1 }]} numberOfLines={1}>{kickerOf(lp, sectionLabel)}</Text>
          <Pressable onPress={onBack} hitSlop={8}><Text style={ws.back_tr}>← back</Text></Pressable>
        </View>
        <View style={ws.co_head}>
          <Text style={ws.co_title}>{lp.chapter_title}</Text>
          <Text style={ws.co_meta}>{total} Learning Unit{total !== 1 ? "s" : ""}{durParts.length ? ` ${durParts.join(". ")}` : ""}</Text>
          {pointer != null && !ssFlow ? (
            <View style={ws.co_rail} accessibilityLabel={`${taught} of ${total} units taught`}>
              {units.map((_, i) => <View key={i} style={[ws.co_tick, (doneAll || i < pointer) && ws.co_tick_done, i === pointer && !doneAll && ws.co_tick_cur]} />)}
            </View>
          ) : null}
        </View>
        <View style={ws.co_headrule} />
        {ssFlow ? null : axisWrap}
      </View>
      <ScrollView ref={scRef} contentContainerStyle={s.body}
        onLayout={(e) => { vpRef.current = e.nativeEvent.layout.height; }}>
        <View ref={contentRef} collapsable={false}>
        {ssFlow ? axisWrap : null}
        {ssFlow ? (
          <SSFlowBody ws={ws} t={t} units={units} pointer={pointer} doneAll={doneAll} onOpenUnit={onOpenUnit}
            onCur={revealCur} gapNote={(lp.meta && lp.meta.competency_gap_note) || ""} />
        ) : mathsFlat ? (
          /* ★ A WINDOW WITH A FADE, NOT THE WHOLE PAGE (app. 06 row 30). Maths-prep has ONE
             group, so its units render as a flat list — and a 20-unit chapter then pushed the
             chapter head, the rail and the notes button far off the top. The web caps it
             (`.co-flatscroll`, 348px at phone width) and hangs a 26px fade at the foot so the
             cut edge reads as "there is more" rather than as the end of the list.
             ⚠️ The fade is an SVG gradient, not a CSS one — RN has no `linear-gradient`; the
             same substitution `PrepareCta` makes. `pointerEvents="none"` so it cannot eat a tap
             on the card beneath it. */
          <View style={ws.co_flatwrap}>
          <ScrollView style={ws.co_flatscroll} nestedScrollEnabled
            showsVerticalScrollIndicator={false}>
          {(lp.groups[0].periods || []).map((p, i) => {
            const status = pointer == null ? "" : (doneAll || i < pointer) ? "done" : i === pointer ? "cur" : "up";
            return <UnitCard key={i} ws={ws} n={i} p={p} status={status} onOpen={onOpenUnit} onCur={revealCur} />;
          })}
          </ScrollView>
          <Svg pointerEvents="none" width="100%" height={26} style={ws.co_flatfade}>
            <Defs>
              <LinearGradient id="coFlatFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={t.paper} stopOpacity="0" />
                <Stop offset="1" stopColor={t.paper} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="26" fill="url(#coFlatFade)" />
          </Svg>
          </View>
        ) : (lp.groups || []).map((g, gi) => {
          const open = openIdx === gi;
          // Built for EVERY group, open or not — that walk is what keeps `idx` chapter-wide.
          const body = renderGroup({ periods: g.periods, children: g.children, type: g.type }, `g${gi}`, open);
          const cnt = countUnits(g);
          const rawLabel = (lp.subject === "science" && g.type === "section" ? sectionTitleOnly(g.label) : g.label) || `Section ${gi + 1}`;
          const shownLabel = (lp.subject === "social_sciences" && g.type === "competency" && !open) ? truncateWords(rawLabel, 12) : rawLabel;
          return (
            <View key={gi} style={[ws.co_acc, open && ws.co_acc_open]}>
              {/* ★ THE HEAD READS ITS SUBJECT (app. 06 rows 16, 26).
                  ⓵ Social Sciences heads are COMPETENCY STATEMENTS, not section titles — whole
                  sentences where science has two or three words — so globals.css drops them two
                  notches (18 → 16 → 13 at phone width) to stop one heading eating the screen.
                  ⓶ The unit COUNT is hidden for science and SS at phone width: both already
                  carry a rail above, the label is long, and a bare number competes for the width the
                  sentence needs. Maths and English keep it — their labels are short.
                  ⚠️ The sizes live in `web.js` (`co_acc_name`, `co_acc_name_ss`) so the parity
                  checker can see them; only the CHOICE is made here. */}
              <Pressable onPress={() => setOpenIdx(open ? -1 : gi)} style={ws.co_acchead} accessibilityState={{ expanded: open }}>
                <Text style={[ws.co_acc_name, lp.subject === "social_sciences" && ws.co_acc_name_ss]}>
                  {shownLabel}
                </Text>
                {lp.subject === "science" || lp.subject === "social_sciences"
                  ? null : <Text style={ws.co_count}>{cnt}</Text>}
                {/* An SVG path, not a rotated "⌄": the glyph's own baseline offset made it sit
                    low in the row, and a rotated text node carries that offset with it. */}
                <Svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke={t.ink_soft}
                  strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
                  <Path d="M6 9l6 6 6-6" />
                </Svg>
              </Pressable>
              {open ? <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>{body}</View> : null}
            </View>
          );
        })}
        {/* WALK-A-099 — dropped units listed at the foot of the map (see the web's ChapterOrg). */}
        {dropped.length ? (
          <View style={{ marginTop: 22, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.line }}>
            {/* Folded by default (founder, 2026-09-25): one tap reveals them. */}
            <Pressable onPress={() => setDroppedOpen((v) => !v)} accessibilityRole="button"
              accessibilityState={{ expanded: droppedOpen }}
              style={{ flexDirection: "row", alignItems: "center", columnGap: 8, paddingVertical: 4 }}>
              <Text style={ws.kicker}>{`Dropped units (${dropped.length})`}</Text>
              <Svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke={t.ink_soft}
                strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: [{ rotate: droppedOpen ? "180deg" : "0deg" }] }}>
                <Path d="M6 9l6 6 6-6" />
              </Svg>
            </Pressable>
            {droppedOpen ? <Text style={[ws.cn_scope, { marginBottom: 8 }]}>For self-study · not scheduled</Text> : null}
            {droppedOpen && dropped.map((p, j) => (
              <Pressable key={`d${j}`} onPress={() => onOpenUnit(units.length + j)}
                style={[ws.co_card, { backgroundColor: "transparent", borderStyle: "dashed" }]}>
                <Text style={[ws.co_num, { color: t.ink_soft, fontStyle: "normal" }]}>✦</Text>
                <Text style={[ws.co_utitle, { color: t.ink_soft }]} numberOfLines={2}>{p.title || "Dropped unit"}</Text>
                <View style={ws.co_side} />
                <Text style={ws.co_go}>→</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        </View>
      </ScrollView>
      {notesOpen ? (
        <ChapterNotesModal ws={ws} t={t} chapterTitle={lp.chapter_title} subjectGrade={cnSubjectGrade(lp)} initial={noteText}
          onSave={saveNote} readOnly={notesLocked} onClose={() => setNotesOpen(false)} />
      ) : null}
    </View>
  );
}

const AxisRow = ({ ws, name, blurb }) => (
  <Text style={ws.co_axis_row}><Text style={ws.co_axis_name}>{name}</Text> {blurb}</Text>
);

const s = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 40 },
});
