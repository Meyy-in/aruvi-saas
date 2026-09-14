/* ───────── ChapterOrg — the chapter's organisation, ported 1:1 from the web (2026-09-12) ─────────
 * web/app/components/LessonView.jsx `ChapterOrg` + `SSFlowBody` + `ChapterNotesModal`. Same
 * header (kicker · "← back"), title, "{n} Learning Units 1 × 50 min" meta, the tick rail, the
 * axis legend with the "Notes" tab in the gutter, then the body by subject shape: the SS
 * competency MAP (ribbons between units and competencies — measured with onLayout instead of
 * getBoundingClientRect, the one technical translation), the maths-prep flat list, or the
 * accordion of groups. Tapping a unit card opens it (navigation only; the pointer is unmoved).
 * Chapter notes ride the shared plan-notes helpers — server authoritative, device cache. */
import { useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, Pressable, Modal, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput } from "../Text";
import Svg, { Path, Rect } from "react-native-svg";
import { fetchEntitlement, fetchPlanNotes, savePlanNote, planNoteKey, userKey } from "@aruvi/shared/format";
import { storage } from "@aruvi/shared/storage";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";

export const kickerOf = (lp) =>
  String(lp.subject || "").replace(/_/g, " ")
  + (lp.grade ? `·${String(lp.grade).replace(/grade|class/gi, "").trim().toUpperCase()}` : "")
  + (lp.chapter_number ? `·Ch. ${String(lp.chapter_number).padStart(2, "0")}` : "");

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
const CN_ROMAN = { 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X" };
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
function UnitCard({ ws, n, p, status, onOpen }) {
  const dur = p.meta && p.meta.duration_minutes;
  return (
    <Pressable onPress={() => onOpen(n)} style={[ws.co_card, status === "cur" && ws.co_card_cur, status === "done" && ws.co_card_done]}>
      <Text style={[ws.co_num, status === "done" && ws.co_num_done, status === "up" && ws.co_num_up]}>{n + 1}.</Text>
      <Text style={ws.co_utitle} numberOfLines={2}>{p.title || `Unit ${n + 1}`}</Text>
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
function SSFlowBody({ ws, t, units, pointer, doneAll, onOpenUnit, gapNote }) {
  const [focus, setFocus] = useState(null);       // null | {t:'u'|'c', id}
  const [uPos, setUPos] = useState({});           // i → {y, h} within units column
  const [cPos, setCPos] = useState({});           // code → {y, h} within comps column
  const [cols, setCols] = useState({ u: null, c: null, w: 0, h: 0 });
  const COLORS = [t.pine, t.clay, t.ochre, t.ss_slate, t.ss_plum, t.ink_soft];

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
              <View key={i}>
                <Pressable onPress={() => setFocus(open ? null : { t: "u", id: i })}
                  onLayout={(e) => { const { y, height } = e.nativeEvent.layout; setUPos((p) => ({ ...p, [i]: { y, h: height } })); }}
                  style={[ws.cof_u, st === "cur" && ws.cof_u_cur, st === "done" && ws.cof_u_done, { opacity: dimmed ? 0.35 : 1 }]}>
                  <Text style={[ws.cof_num, st === "cur" && { color: t.clay }]}>{pad2(i + 1)}</Text>
                  <Text style={ws.cof_utitle} numberOfLines={1}>{(u.title || `Unit ${i + 1}`).split(":")[0]}</Text>
                  {edges.length ? null : <Text style={{ color: t.ink_soft }}>—</Text>}
                  <Pressable onPress={() => onOpenUnit(i)} hitSlop={8} accessibilityLabel={`Open unit ${pad2(i + 1)}`}>
                    <Text style={ws.cof_uopen}>→</Text>
                  </Pressable>
                </Pressable>
                {open ? (
                  <Pressable onPress={() => onOpenUnit(i)} style={[ws.cof_pop, { borderLeftColor: rule }]}>
                    <Text style={ws.cof_pop_t}>
                      <Text style={ws.cof_num}>{pad2(i + 1)}</Text> · {u.title || `Unit ${i + 1}`}
                      {u.meta && u.meta.duration_minutes ? ` · ${u.meta.duration_minutes} min` : ""}  <Text style={{ color: t.pine }}>→</Text>
                    </Text>
                    {!edges.length ? <Text style={ws.cof_pop_quiet}>Taught in full — builds no competency edge, by design</Text> : null}
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={ws.cof_comps} onLayout={(e) => { const l = e.nativeEvent.layout; setCols((c) => ({ ...c, c: l })); }}>
          {comps.map((c) => {
            const dimmed = focus && ((focus.t === "c" && focus.id !== c.code) || (focus.t === "u" && !c.units.includes(focus.id)));
            const open = focus && focus.t === "c" && focus.id === c.code;
            const openViaUnit = !open && focus && focus.t === "u" && c.units.includes(focus.id);
            return (
              <View key={c.code}>
                <Pressable onPress={() => setFocus(open ? null : { t: "c", id: c.code })}
                  onLayout={(e) => { const { y, height } = e.nativeEvent.layout; setCPos((p) => ({ ...p, [c.code]: { y, h: height } })); }}
                  style={[ws.cof_c, { opacity: dimmed ? 0.35 : 1 }]}>
                  <Text style={[ws.cof_code, { color: c.color }]}>{c.code}</Text>
                  <Text style={ws.cof_tiername}>{c.tier}</Text>
                  <Text style={[ws.cof_dots, { color: c.color }]}>{SS_TIER_DOTS[c.tier]}</Text>
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
      {!focus ? <Text style={ws.cof_hint}>Tap a unit or a competency to follow its connections</Text> : null}
    </View>
  );
}

/* ── the notes modal ── */
function MicIcon({ color }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={9} y={2} width={6} height={12} rx={3} />
      <Path d="M5 11a7 7 0 0 0 14 0" />
      <Path d="M12 18v4M8 22h8" />
    </Svg>
  );
}

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
  const [text, setText] = useState(initial || "");
  const [paperH, setPaperH] = useState(0);      // the visible sheet
  const [contentH, setContentH] = useState(0);  // how far the writing actually runs
  const ref = useRef(null);
  const wc = cnWordCount(text);
  const change = (v) => { if (cnWordCount(v) > CN_CAP && cnWordCount(v) > wc) return; setText(v); };

  // Enough rules to cover whichever is taller — the sheet, or the writing running past it.
  const ruled = Math.ceil(Math.max(paperH, contentH) / RULE_H) + 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={ws.cn_scrim} onPress={onClose}>
          <Pressable style={[ws.cn_modal, { backgroundColor: t.paper, borderColor: t.line }]} onPress={() => {}}>
            <View style={[ws.cn_head, { borderBottomColor: t.line_soft }]}>
              <View style={{ flex: 1 }}>
                <Text style={ws.kicker}>Chapter notes</Text>
                <Text style={ws.cn_title}>{chapterTitle}</Text>
                {subjectGrade ? <Text style={ws.cn_sg}>{subjectGrade}</Text> : null}
                <Text style={[ws.cn_scope, ws.cn_warn, { borderTopColor: t.line }]}>
                  Private data like name, age of child must not be recorded. Meyy reserves
                  right to delete if entered.
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={ws.cn_x}>✕</Text>
              </Pressable>
            </View>

            <View style={ws.cn_paper_wrap} onLayout={(e) => setPaperH(e.nativeEvent.layout.height)}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={{ minHeight: paperH }}>
                  {Array.from({ length: ruled }).map((_, i) => (
                    <View key={i} pointerEvents="none" style={[ws.cn_rule, { top: RULE_H * (i + 1) - 1 }]} />
                  ))}
                  <TextInput ref={ref} multiline scrollEnabled={false}
                    autoFocus={!readOnly} editable={!readOnly} value={text} onChangeText={change}
                    onContentSizeChange={(e) => setContentH(e.nativeEvent.contentSize.height)}
                    placeholder={readOnly ? "No notes were written for this chapter." : CN_GUIDE}
                    placeholderTextColor="#b3ab9c" textAlignVertical="top"
                    style={[ws.cn_paper, { minHeight: paperH }]} />
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
                    <Pressable onPress={() => ref.current && ref.current.focus()} style={ws.cn_speak}>
                      <MicIcon color={t.ink_soft} />
                      <Text style={ws.cn_speak_t}>Speak</Text>
                    </Pressable>
                    <Text style={[ws.cn_count, wc >= CN_CAP && ws.cn_count_over]}>{wc} / {CN_CAP} words</Text>
                  </View>
                  <Pressable onPress={() => onSave(text)} style={ws.cn_save}><Text style={ws.cn_save_t}>Save</Text></Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ChapterOrg({ lp, units, pointer, doneAll, onOpenUnit, onBack }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const [notesLocked, setNotesLocked] = useState(false);
  useEffect(() => { let live = true; fetchEntitlement().then((e) => { if (live && e) setNotesLocked(!!e.lapsed); }).catch(() => {}); return () => { live = false; }; }, []);

  const notesKey = userKey(`chapter_notes_${lp.subject}_${lp.grade}_${lp.chapter_title || ""}`);
  const noteChapter = lp.chapter_number ? String(lp.chapter_number) : (lp.chapter_title || "");
  const [noteText, setNoteText] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  useEffect(() => {
    let cached = ""; try { cached = storage.getItem(notesKey) || ""; } catch {}
    setNoteText(cached);
    let dead = false;
    fetchPlanNotes().then((notes) => {
      if (dead || notes === null) return;
      const srv = notes[planNoteKey(lp.subject, lp.grade, noteChapter)];
      if (srv && typeof srv.text === "string") {
        setNoteText(srv.text);
        try { if (srv.text.trim()) storage.setItem(notesKey, srv.text); else storage.removeItem(notesKey); } catch {}
      } else if (cached.trim()) {
        savePlanNote(lp.subject, lp.grade, noteChapter, cached);
      }
    });
    return () => { dead = true; };
  }, [notesKey]);
  const saveNote = (v) => {
    setNoteText(v);
    try { if (v.trim()) storage.setItem(notesKey, v); else storage.removeItem(notesKey); } catch {}
    savePlanNote(lp.subject, lp.grade, noteChapter, v).then((res) => {
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
      out.push(<UnitCard key={`${keyPrefix}-${i}`} ws={ws} n={n} p={p} status={status} onOpen={onOpenUnit} />);
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
      <Pressable onPress={() => setNotesOpen(true)} accessibilityLabel={hasNote ? "Chapter notes — edit" : "Chapter notes — add"} style={ws.co_notetab}>
        <Text style={[ws.co_notetab_label, { transform: [{ rotate: "-90deg" }], width: 58, textAlign: "center" }]}>Notes</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <View style={[ws.co_stick, { paddingHorizontal: 18 }]}>
        <View style={ws.co_topbar}>
          <Text style={[ws.kicker, { flex: 1 }]} numberOfLines={1}>{kickerOf(lp)}</Text>
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
      <ScrollView contentContainerStyle={s.body}>
        {ssFlow ? axisWrap : null}
        {ssFlow ? (
          <SSFlowBody ws={ws} t={t} units={units} pointer={pointer} doneAll={doneAll} onOpenUnit={onOpenUnit} gapNote={(lp.meta && lp.meta.competency_gap_note) || ""} />
        ) : mathsFlat ? (
          (lp.groups[0].periods || []).map((p, i) => {
            const status = pointer == null ? "" : (doneAll || i < pointer) ? "done" : i === pointer ? "cur" : "up";
            return <UnitCard key={i} ws={ws} n={i} p={p} status={status} onOpen={onOpenUnit} />;
          })
        ) : (lp.groups || []).map((g, gi) => {
          const open = openIdx === gi;
          // Built for EVERY group, open or not — that walk is what keeps `idx` chapter-wide.
          const body = renderGroup({ periods: g.periods, children: g.children, type: g.type }, `g${gi}`, open);
          const cnt = countUnits(g);
          const rawLabel = (lp.subject === "science" && g.type === "section" ? sectionTitleOnly(g.label) : g.label) || `Section ${gi + 1}`;
          const shownLabel = (lp.subject === "social_sciences" && g.type === "competency" && !open) ? truncateWords(rawLabel, 12) : rawLabel;
          return (
            <View key={gi} style={[ws.co_acc, open && ws.co_acc_open]}>
              <Pressable onPress={() => setOpenIdx(open ? -1 : gi)} style={ws.co_acchead} accessibilityState={{ expanded: open }}>
                <Text style={ws.co_acc_name}>{shownLabel}</Text>
                <Text style={ws.co_count}>{cnt}</Text>
                <Text style={{ color: t.ink_soft, transform: [{ rotate: open ? "180deg" : "0deg" }] }}>⌄</Text>
              </Pressable>
              {open ? <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>{body}</View> : null}
            </View>
          );
        })}
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
