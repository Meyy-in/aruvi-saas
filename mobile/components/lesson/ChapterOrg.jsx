/* ───────── ChapterOrg — the chapter's organisation, ported 1:1 from the web (2026-09-12) ─────────
 * web/app/components/LessonView.jsx `ChapterOrg` + `SSFlowBody` + `ChapterNotesModal`. Same
 * header (kicker · "← back"), title, "{n} Learning Units 1 × 50 min" meta, the tick rail, the
 * axis legend with the "Notes" tab in the gutter, then the body by subject shape: the SS
 * competency MAP (ribbons between units and competencies — measured with onLayout instead of
 * getBoundingClientRect, the one technical translation), the maths-prep flat list, or the
 * accordion of groups. Tapping a unit card opens it (navigation only; the pointer is unmoved).
 * Chapter notes ride the shared plan-notes helpers — server authoritative, device cache. */
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fetchEntitlement, fetchPlanNotes, savePlanNote, planNoteKey, userKey } from "@aruvi/shared/format";
import { storage } from "@aruvi/shared/storage";
import { useTheme } from "../../theme/ThemeContext";
import { type } from "../../theme/type";
import { display, mono } from "../../theme/fonts";

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

/* ── one unit card (accordion / flat list) ── */
function UnitCard({ t, n, p, status, onOpen }) {
  const dur = p.meta && p.meta.duration_minutes;
  const edge = status === "cur" ? t.clay : status === "done" ? t.pine : t.edge;
  return (
    <Pressable onPress={() => onOpen(n)} style={[s.card, { backgroundColor: t.paper_2, borderColor: edge }]}>
      <Text style={[s.num, { color: t.clay }]}>{n + 1}.</Text>
      <Text style={[type.body, { color: t.ink, flex: 1 }]}>{p.title || `Unit ${n + 1}`}</Text>
      <View style={s.side}>
        {status === "cur" ? <Text style={[s.now, { color: t.clay, borderColor: t.clay }]}>now</Text> : null}
        {dur ? <Text style={[type.mono, { fontSize: 12, color: t.ink_soft }]}>{dur}<Text style={{ fontSize: 10 }}> min</Text></Text> : null}
        {status === "done" ? <Text style={[type.small, { color: t.pine }]}>✓ taught</Text> : null}
      </View>
      <Text style={{ color: t.ink_soft }}>→</Text>
    </Pressable>
  );
}

/* ── the Social Sciences map ── */
function SSFlowBody({ t, units, pointer, doneAll, onOpenUnit, gapNote }) {
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
      <View style={s.cofWrap} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setCols((c) => ({ ...c, w: width, h: height })); }}>
        {cols.w ? (
          <Svg width={cols.w} height={cols.h} style={StyleSheet.absoluteFill} pointerEvents="none">
            {paths.map((p, k) => <Path key={k} d={p.d} fill="none" stroke={p.color} strokeWidth={p.w} strokeOpacity={p.o} strokeLinecap="round" />)}
          </Svg>
        ) : null}
        <View style={s.cofUnits} onLayout={(e) => { const l = e.nativeEvent.layout; setCols((c) => ({ ...c, u: l })); }}>
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
                  style={[s.cofU, { opacity: dimmed ? 0.35 : 1, borderLeftColor: rule }]}>
                  <Text style={[type.mono, { fontSize: 11, color: st === "cur" ? t.clay : st === "done" ? t.pine : t.ink_soft, width: 24 }]}>{pad2(i + 1)}</Text>
                  <Text style={[type.small, { color: t.ink, flex: 1 }]} numberOfLines={1}>{(u.title || `Unit ${i + 1}`).split(":")[0]}</Text>
                  {edges.length ? null : <Text style={{ color: t.ink_soft }}>—</Text>}
                  <Pressable onPress={() => onOpenUnit(i)} hitSlop={8} accessibilityLabel={`Open unit ${pad2(i + 1)}`}>
                    <Text style={{ color: t.pine, paddingHorizontal: 4 }}>→</Text>
                  </Pressable>
                </Pressable>
                {open ? (
                  <Pressable onPress={() => onOpenUnit(i)} style={[s.pop, { backgroundColor: t.paper_2, borderLeftColor: rule }]}>
                    <Text style={[type.small, { color: t.ink }]}>
                      <Text style={{ fontFamily: mono(500) }}>{pad2(i + 1)}</Text> · {u.title || `Unit ${i + 1}`}
                      {u.meta && u.meta.duration_minutes ? ` · ${u.meta.duration_minutes} min` : ""}  <Text style={{ color: t.pine }}>→</Text>
                    </Text>
                    {!edges.length ? <Text style={[type.small, { color: t.ink_soft, marginTop: 4 }]}>Taught in full — builds no competency edge, by design</Text> : null}
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={s.cofComps} onLayout={(e) => { const l = e.nativeEvent.layout; setCols((c) => ({ ...c, c: l })); }}>
          {comps.map((c) => {
            const dimmed = focus && ((focus.t === "c" && focus.id !== c.code) || (focus.t === "u" && !c.units.includes(focus.id)));
            const open = focus && focus.t === "c" && focus.id === c.code;
            const openViaUnit = !open && focus && focus.t === "u" && c.units.includes(focus.id);
            return (
              <View key={c.code}>
                <Pressable onPress={() => setFocus(open ? null : { t: "c", id: c.code })}
                  onLayout={(e) => { const { y, height } = e.nativeEvent.layout; setCPos((p) => ({ ...p, [c.code]: { y, h: height } })); }}
                  style={[s.cofC, { opacity: dimmed ? 0.35 : 1, borderColor: t.line, backgroundColor: t.paper_2 }]}>
                  <Text style={[type.mono, { fontSize: 12, color: c.color, fontFamily: mono(600) }]}>{c.code}</Text>
                  <Text style={[type.small, { color: t.ink_soft }]}>{c.tier}</Text>
                  <Text style={{ color: c.color, fontSize: 11, letterSpacing: 1 }}>{SS_TIER_DOTS[c.tier]}</Text>
                </Pressable>
                {open || openViaUnit ? (
                  <View style={[s.pop, { backgroundColor: t.paper_2, borderLeftColor: c.color }]}>
                    <Text style={[type.small, { color: t.ink }]}>{c.text}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
      {gapNote ? <Text style={[type.small, { color: t.ink_soft, marginTop: 12 }]}>{gapNote}</Text> : null}
      {!focus ? <Text style={[type.small, { color: t.ink_soft, marginTop: 12, textAlign: "center" }]}>Tap a unit or a competency to follow its connections</Text> : null}
    </View>
  );
}

/* ── the notes modal ── */
function ChapterNotesModal({ t, chapterTitle, subjectGrade, initial, onSave, onClose, readOnly }) {
  const [text, setText] = useState(initial || "");
  const ref = useRef(null);
  const wc = cnWordCount(text);
  const change = (v) => { if (cnWordCount(v) > CN_CAP && cnWordCount(v) > wc) return; setText(v); };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.cnHead}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[type.label, { color: t.ink_soft }]}>Chapter notes</Text>
            <Text style={[type.title, { color: t.ink }]}>{chapterTitle}</Text>
            {subjectGrade ? <Text style={[type.small, { color: t.ink_soft }]}>{subjectGrade}</Text> : null}
            <Text style={[type.small, { color: t.ink_soft }]}>Shared across every section on this plan</Text>
            <Text style={[type.small, { color: t.ink_soft }]}>Saved to your account · opens on any device you sign in from</Text>
            <Text style={[type.small, { color: t.clay }]}>Private data like name, age of child must not be recorded. Meyy reserves right to delete if entered.</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><Text style={[type.body, { color: t.ink_soft }]}>✕</Text></Pressable>
        </View>
        <TextInput ref={ref} multiline autoFocus={!readOnly} editable={!readOnly} value={text} onChangeText={change}
          placeholder={readOnly ? "No notes were written for this chapter." : CN_GUIDE} placeholderTextColor={t.ink_soft}
          textAlignVertical="top" style={[type.body, s.cnPaper, { color: t.ink, backgroundColor: t.paper_2, borderColor: t.edge }]} />
        <View style={s.cnFoot}>
          {readOnly ? (
            <>
              <Text style={[type.small, { color: t.ink_soft, flex: 1 }]}>Renew to write notes — what you wrote stays yours.</Text>
              <Pressable onPress={onClose} style={[s.cnSave, { backgroundColor: t.pine }]}><Text style={[type.button, { color: "#f3efe6" }]}>Close</Text></Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => ref.current && ref.current.focus()} hitSlop={6}><Text style={[type.small, { color: t.pine }]}>🎙 Speak</Text></Pressable>
              <Text style={[type.mono, { fontSize: 12, color: wc >= CN_CAP ? t.danger : t.ink_soft, flex: 1, marginLeft: 12 }]}>{wc} / {CN_CAP} words</Text>
              <Pressable onPress={() => onSave(text)} style={[s.cnSave, { backgroundColor: t.pine }]}><Text style={[type.button, { color: "#f3efe6" }]}>Save</Text></Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ChapterOrg({ lp, units, pointer, doneAll, onOpenUnit, onBack }) {
  const { t } = useTheme();
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

  let idx = -1;
  const renderGroup = (g, keyPrefix) => {
    const out = [];
    if (g.label) out.push(<Text key={`${keyPrefix}-bar`} style={[type.label, { color: t.ink_soft, marginTop: 10, marginBottom: 6 }]}>{lp.subject === "science" && g.type === "section" ? sectionTitleOnly(g.label) : g.label}</Text>);
    (g.periods || []).forEach((p, i) => {
      idx += 1; const n = idx;
      const status = pointer == null ? "" : (doneAll || n < pointer) ? "done" : n === pointer ? "cur" : "up";
      out.push(<UnitCard key={`${keyPrefix}-${i}`} t={t} n={n} p={p} status={status} onOpen={onOpenUnit} />);
    });
    (g.children || []).forEach((c, i) => out.push(...renderGroup(c, `${keyPrefix}-${i}`)));
    return out;
  };

  const axisWrap = (
    <View style={s.axisWrap}>
      <View style={{ flex: 1, gap: 8 }}>
        {ssFlow ? <AxisRow t={t} name="The map" blurb="every line connects a unit to an NCF competency it genuinely builds — the competency-based design at the heart of the NCF. Tap either side to follow its connections." />
        : mathsFlat ? <AxisRow t={t} name="Units" blurb="one continuous run of learning units in the textbook's own teaching order — the activity-led, play-way flow the NCF asks of the preparatory stage. Tap a unit to open it." />
        : axisTypes.map((ty) => <AxisRow key={ty} t={t} name={AXIS_INFO[ty][0]} blurb={`${AXIS_INFO[ty][1]} Click each card to access units underneath.`} />)}
      </View>
      <Pressable onPress={() => setNotesOpen(true)} accessibilityLabel={hasNote ? "Chapter notes — edit" : "Chapter notes — add"}
        style={[s.noteTab, { backgroundColor: t.ochre }]}>
        <Text style={[type.label, { color: "#fff", letterSpacing: 1 }]}>Notes</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <View style={[s.stick, { borderBottomColor: t.line }]}>
        <View style={s.topbar}>
          <Text style={[type.label, { color: t.ink_soft, flex: 1 }]} numberOfLines={1}>{kickerOf(lp)}</Text>
          <Pressable onPress={onBack} hitSlop={8}><Text style={[type.small, { color: t.pine }]}>← back</Text></Pressable>
        </View>
        <Text style={[s.title, { color: t.ink }]}>{lp.chapter_title}</Text>
        <Text style={[type.small, { color: t.ink_soft, marginTop: 4 }]}>
          {total} Learning Unit{total !== 1 ? "s" : ""}{durParts.length ? ` ${durParts.join(". ")}` : ""}
        </Text>
        {pointer != null && !ssFlow ? (
          <View style={s.rail} accessibilityLabel={`${taught} of ${total} units taught`}>
            {units.map((_, i) => <View key={i} style={[s.tick, { backgroundColor: doneAll || i < pointer ? t.pine : i === pointer ? t.clay : t.card_tick }]} />)}
          </View>
        ) : null}
        {ssFlow ? null : axisWrap}
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {ssFlow ? axisWrap : null}
        {ssFlow ? (
          <SSFlowBody t={t} units={units} pointer={pointer} doneAll={doneAll} onOpenUnit={onOpenUnit} gapNote={(lp.meta && lp.meta.competency_gap_note) || ""} />
        ) : mathsFlat ? (
          (lp.groups[0].periods || []).map((p, i) => {
            const status = pointer == null ? "" : (doneAll || i < pointer) ? "done" : i === pointer ? "cur" : "up";
            return <UnitCard key={i} t={t} n={i} p={p} status={status} onOpen={onOpenUnit} />;
          })
        ) : (lp.groups || []).map((g, gi) => {
          const open = openIdx === gi;
          const cnt = countUnits(g);
          const rawLabel = (lp.subject === "science" && g.type === "section" ? sectionTitleOnly(g.label) : g.label) || `Section ${gi + 1}`;
          const shownLabel = (lp.subject === "social_sciences" && g.type === "competency" && !open) ? truncateWords(rawLabel, 12) : rawLabel;
          return (
            <View key={gi} style={[s.acc, { borderColor: t.line, backgroundColor: open ? t.paper_2 : "transparent" }]}>
              <Pressable onPress={() => setOpenIdx(open ? -1 : gi)} style={s.accHead} accessibilityState={{ expanded: open }}>
                <Text style={[type.body, { color: t.ink, flex: 1 }]}>{shownLabel}</Text>
                <Text style={[type.mono, { fontSize: 12, color: t.ink_soft }]}>{cnt}</Text>
                <Text style={{ color: t.ink_soft, transform: [{ rotate: open ? "180deg" : "0deg" }] }}>⌄</Text>
              </Pressable>
              {open ? <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>{renderGroup({ periods: g.periods, children: g.children, type: g.type }, `g${gi}`)}</View> : null}
            </View>
          );
        })}
      </ScrollView>
      {notesOpen ? (
        <ChapterNotesModal t={t} chapterTitle={lp.chapter_title} subjectGrade={cnSubjectGrade(lp)} initial={noteText}
          onSave={saveNote} readOnly={notesLocked} onClose={() => setNotesOpen(false)} />
      ) : null}
    </View>
  );
}

const AxisRow = ({ t, name, blurb }) => (
  <Text style={[type.small, { color: t.ink_soft }]}>
    <Text style={{ fontFamily: display(600), color: t.ink }}>{name}</Text> — {blurb}
  </Text>
);

const s = StyleSheet.create({
  stick: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: "Fraunces_500Medium", fontSize: 21, lineHeight: 26, marginTop: 8 },
  rail: { flexDirection: "row", gap: 3, marginTop: 10 },
  tick: { flex: 1, height: 4, borderRadius: 2 },
  axisWrap: { flexDirection: "row", gap: 12, marginTop: 12, alignItems: "flex-start" },
  noteTab: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 6, alignItems: "center" },
  body: { paddingHorizontal: 18, paddingVertical: 14, paddingBottom: 40 },
  card: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8 },
  num: { fontFamily: "Fraunces_600SemiBold", fontSize: 16 },
  side: { alignItems: "flex-end", gap: 2 },
  now: { fontFamily: "IBMPlexMono_500Medium", fontSize: 10, borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, textTransform: "uppercase", letterSpacing: 0.5 },
  acc: { borderWidth: 1, borderRadius: 11, marginBottom: 10 },
  accHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  cofWrap: { flexDirection: "row", gap: 28, position: "relative" },
  cofUnits: { flex: 1.35, gap: 6 },
  cofComps: { flex: 1, gap: 6 },
  cofU: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingLeft: 8, borderLeftWidth: 3 },
  cofC: { borderWidth: 1, borderRadius: 9, padding: 9, alignItems: "center", gap: 2 },
  pop: { borderLeftWidth: 3, borderRadius: 6, padding: 10, marginVertical: 4, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cnHead: { flexDirection: "row", gap: 12, padding: 20, paddingTop: 22 },
  cnPaper: { flex: 1, marginHorizontal: 20, borderWidth: 1, borderRadius: 10, padding: 14 },
  cnFoot: { flexDirection: "row", alignItems: "center", padding: 20 },
  cnSave: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 9 },
});
