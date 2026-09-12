/* ───────── LessonView — the screen a teacher teaches from (Track D step 3, 2026-09-12) ─────────
 *
 * A 1:1 port of web/app/components/LessonView.jsx (CLAUDE.md §4: the phone matches the web).
 * Same anatomy: a chapter-org landing (preview opens on it; tracking reaches it via "← Orgn."),
 * a pinned header (kicker · "← Orgn." · "{n}. title") + the Overview/Material/Lesson/Assess tab
 * bar, the active panel scrolling beneath, and the pvNav strip at the END of the body
 * ("‹ Chapter org." / "← Previous unit" · "Unit n / N" · "Next unit →"). Paging remounts the
 * tabs (key={previewAt}) so a new unit opens on the default tab — Lesson when tracking,
 * Overview in preview. Dropped units page after the served ones and never touch the pointer.
 *
 * `view` is the inner {lesson_plan, assessment, dropped_lp?} from GET /plans/…/view; this
 * component never fetches. A unit = one period of lesson_plan.groups[].periods[].
 *
 * Named translations (the only deviations, per the rule): the frozen header is a View outside
 * the ScrollView instead of a measured `--nav-h` sticky; the bookmark is a PanResponder drag
 * (tap on the minutes also moves it — the phone's stand-in for the web's arrow keys); the
 * teacher-notes <details> is a Pressable that toggles. Everything else — order, labels, copy,
 * which field feeds which row — is the web's. */
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { parseBold } from "@aruvi/shared/format";
import {
  readUnitPointer, setUnitPointer, readChapterDone, setChapterDone,
  readLocalBookmark, writeLocalBookmark,
} from "@aruvi/shared/sectionState";
import { useTheme } from "../theme/ThemeContext";
import { type } from "../theme/type";
import { display, mono } from "../theme/fonts";
import Bar from "./Bar";
import ChapterOrg, { kickerOf } from "./lesson/ChapterOrg";
import PhaseBookmark from "./lesson/PhaseBookmark";
import AssessPanel from "./lesson/AssessPanel";

/* Walk groups (and children) into a flat unit list; each unit carries its group context. */
export function flattenUnits(lp) {
  const out = [];
  const walk = (groups, ctx) => (groups || []).forEach((g) => {
    const c = [...ctx, g.label].filter(Boolean);
    (g.periods || []).forEach((p) => out.push({ ...p, context: c.join(" · "), groupType: g.type }));
    if (g.children && g.children.length) walk(g.children, c);
  });
  walk(lp && lp.groups, []);
  return out;
}

/* Items anchored to this unit (meta.anchor_period === unit.number); legacy plans show all. */
function unitAssessItems(assessment, u) {
  const all = ((assessment && assessment.groups) || []).flatMap((g) => g.items || []);
  const anchored = all.some((it) => it.meta && it.meta.anchor_period != null);
  return anchored ? all.filter((it) => it.meta && it.meta.anchor_period === u.number) : all;
}

const phaseMin = (ph) =>
  Number.isFinite(ph && ph.start_min) && Number.isFinite(ph && ph.end_min) ? ph.end_min - ph.start_min : null;

const CTX_LABEL = { spine: "Spine", section: "Section", competency: "Competency", stage: "Stage", progression_stage: "Stage" };

/* ── Overview: ledger rows, exactly the web's four ── */
function OverviewPanel({ t, u, chapterTitle }) {
  const m = u.meta || {};
  const axisVal = m.section_label || u.context;
  const isSS = u.groupType === "competency" || (u.groupType === "unit" && m.section_anchor);
  const axisRow = isSS ? ["Section", m.section_anchor] : [CTX_LABEL[u.groupType] || "Spine", axisVal];
  const rows = [["Chapter", chapterTitle], axisRow, ["Time", m.duration_minutes ? `${m.duration_minutes} mins` : null], ["Pedagogy", u.approach]].filter(([, v]) => v);
  if (!rows.length) return <Text style={[type.body, { color: t.ink_soft }]}>No overview details recorded for this unit.</Text>;
  return (
    <View>
      {rows.map(([k, v]) => (
        <View key={k} style={[s.ovrow, { borderBottomColor: t.line_soft }]}>
          <Text style={[type.label, { color: t.ink_soft, width: 92 }]}>{k}</Text>
          <Text style={[type.body, { color: t.ink, flex: 1 }]}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

/* ── Material: the checklist + prepared tables/text ── */
function MaterialPanel({ t, u }) {
  const va = u.meta && u.meta.visual_aids;
  const aids = Array.isArray(va) ? va : [];
  const legacyAid = typeof va === "string" && va ? va : null;
  const mats = u.materials || [];
  if (!mats.length && !aids.length && !legacyAid) return <Text style={[type.body, { color: t.ink_soft }]}>Nothing to prepare — this unit needs no materials.</Text>;
  return (
    <View>
      {mats.map((mm, i) => (
        <View key={i} style={s.li}><Text style={[type.body, { color: t.ink_soft }]}>•</Text><Text style={[type.body, { color: t.ink, flex: 1 }]}>{mm}</Text></View>
      ))}
      {legacyAid ? <Text style={[type.body, { color: t.ink, marginTop: 8 }]}>{legacyAid}</Text> : null}
      {aids.map((a, i) => (
        <View key={i} style={{ marginTop: 16 }}>
          <Text style={[type.label, { color: t.ink_soft, marginBottom: 6 }]}>
            {a.type === "table" ? "Prepared table" : "Prepared text"}{a.title ? ` · ${a.title}` : ""}
          </Text>
          {a.type === "table" && a.table ? <AidTable t={t} table={a.table} /> : null}
          {a.type === "table" && a.table && a.table.source_note ? <Text style={[type.small, { color: t.ink_soft, marginTop: 6 }]}>{a.table.source_note}</Text> : null}
          {a.type === "prose" ? <Text style={[type.body, { color: t.ink }]}>{a.text}</Text> : null}
        </View>
      ))}
    </View>
  );
}
function AidTable({ t, table }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 6, overflow: "hidden" }}>
        {table.caption ? <Text style={[type.small, { color: t.ink_soft, padding: 8 }]}>{table.caption}</Text> : null}
        <View style={{ flexDirection: "row", backgroundColor: t.paper_sunk }}>
          {(table.header || []).map((h, i) => <Text key={i} style={[type.label, s.td, { color: t.ink }]}>{h}</Text>)}
        </View>
        {(table.rows || []).map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }}>
            {row.map((c, ci) => <Text key={ci} style={[type.small, s.td, { color: t.ink }]}>{c}</Text>)}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ── Lesson: the notes ribbon → the phase spine (with the bookmark) → homework ── */
function LessonPanel({ t, u, bookmark, footer }) {
  const phases = (u.phases || []).filter((ph) => ph.text || ph.label);
  const notes = u.teacher_notes && u.teacher_notes.length ? u.teacher_notes.join(" ") : null;
  const POINTER = /^(Refer to Prepared Table[^.]*\.)\s*/;
  const m = notes ? notes.match(POINTER) : null;
  const notesLead = m ? m[1] : null;
  const notesRest = notes ? notes.replace(POINTER, "") : "";
  const [notesOpen, setNotesOpen] = useState(true);
  const [rows, setRows] = useState({});       // i → {y, timeH}
  const centres = useMemo(() => phases.map((_, i) => rows[i] ? rows[i].y + rows[i].timeH / 2 : null).filter((v) => v != null), [rows, phases.length]);
  return (
    <View>
      {notes ? (
        <Pressable onPress={() => setNotesOpen((o) => !o)} style={[s.ribbon, { backgroundColor: t.tint_clay, borderColor: t.edge_clay }]}>
          <Text style={[type.label, { color: t.clay }]}>Teacher notes</Text>
          {notesOpen ? (
            <Text style={[type.body, { color: t.ink, marginTop: 4 }]}>
              {notesLead ? <Text style={{ fontFamily: display(600) }}>{notesLead} </Text> : null}{notesLead ? notesRest : notes}
            </Text>
          ) : <Text style={[type.small, { color: t.ink_soft, marginTop: 2 }]} numberOfLines={1}>{notes}</Text>}
        </Pressable>
      ) : null}

      {phases.length ? (
        <View style={s.phases}>
          {bookmark ? <PhaseBookmark centres={centres} phase={Math.min(bookmark.phase, phases.length - 1)} onMove={bookmark.onMove} color={t.clay} /> : null}
          {phases.map((ph, i) => {
            const mins = phaseMin(ph);
            return (
              <View key={i} style={s.phase} onLayout={(e) => { const { y } = e.nativeEvent.layout; setRows((r) => ({ ...r, [i]: { ...(r[i] || { timeH: 20 }), y } })); }}>
                <Pressable disabled={!bookmark} onPress={() => bookmark && bookmark.onMove(i)} style={s.phTime}
                  onLayout={(e) => { const { height } = e.nativeEvent.layout; setRows((r) => ({ ...r, [i]: { ...(r[i] || { y: 0 }), timeH: height } })); }}>
                  <Text style={[s.phN, { color: t.ink }]}>{mins != null ? mins : (ph.label || "—")}</Text>
                  {mins != null ? <Text style={[s.phU, { color: t.ink_soft }]}>min</Text> : null}
                </Pressable>
                <Text style={[type.body, { color: t.ink, flex: 1 }]}>{ph.text}</Text>
              </View>
            );
          })}
        </View>
      ) : (u.activities && u.activities.length) ? u.activities.map((a, i) => (
        <Text key={i} style={[type.body, { color: t.ink, marginBottom: 10 }]}>{a}</Text>
      )) : <Text style={[type.body, { color: t.ink_soft }]}>No phases recorded for this unit.</Text>}

      {u.homework ? (
        <View style={[s.hw, { backgroundColor: t.tint_cream, borderColor: t.edge }]}>
          <Text style={[type.label, { color: t.ink_soft, marginBottom: 4 }]}>Homework</Text>
          <Text style={[type.body, { color: t.ink }]}>{parseBold(u.homework).map((r, i) => r.bold ? <Text key={i} style={{ fontFamily: display(600) }}>{r.text}</Text> : r.text)}</Text>
        </View>
      ) : null}
      {footer}
    </View>
  );
}

/* ── one unit: pinned header + tab bar, the panel beneath ── */
function PreviewUnit({ t, header, u, assessment, chapterTitle, lessonFooter, defaultTab, bookmark, tail }) {
  const items = unitAssessItems(assessment, u);
  const [tab, setTab] = useState(defaultTab);
  const tabs = [["overview", "Overview"], ["material", "Material"], ["lesson", "Lesson"], ...(items.length ? [["assess", "Assess"]] : [])];
  return (
    <>
      <View style={[s.stick, { backgroundColor: t.paper, borderBottomColor: t.line }]}>
        {header}
        <View style={s.tabbar} accessibilityRole="tablist">
          {tabs.map(([id, label]) => (
            <Pressable key={id} onPress={() => setTab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}
              style={[s.tab, tab === id && { borderBottomColor: t.clay }]}>
              <Text style={[type.small, { color: tab === id ? t.ink : t.ink_soft, fontFamily: tab === id ? display(600) : undefined }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {tab === "overview" ? <OverviewPanel t={t} u={u} chapterTitle={chapterTitle} /> : null}
        {tab === "material" ? <MaterialPanel t={t} u={u} /> : null}
        {tab === "lesson" ? <LessonPanel t={t} u={u} bookmark={bookmark} footer={lessonFooter} /> : null}
        {tab === "assess" ? <AssessPanel t={t} items={items} assessment={assessment} /> : null}
        {tail}
      </ScrollView>
    </>
  );
}

export default function LessonView({ view, sectionKey = "", onExit, preview = false }) {
  const { t } = useTheme();
  const lp = view.lesson_plan;
  const units = useMemo(() => flattenUnits(lp), [lp]);
  const droppedUnits = useMemo(() => (view.dropped_lp ? flattenUnits(view.dropped_lp) : []), [view.dropped_lp]);
  const total = units.length;
  const tracking = !!sectionKey && !preview;

  const [cur, setCur] = useState(() => Math.min(tracking ? readUnitPointer(sectionKey) : 0, Math.max(0, total - 1)));
  const [showOrg, setShowOrg] = useState(preview);
  const [previewAt, setPreviewAt] = useState(cur);
  const [doneFlag, setDoneFlag] = useState(() => (tracking ? readChapterDone(sectionKey) : false));
  const [undoTo, setUndoTo] = useState(null);
  const [bkmkPhase, setBkmkPhase] = useState(() => {
    if (!tracking) return 0;
    const b = readLocalBookmark(sectionKey);
    return b && b.unit === cur ? b.phase : 0;
  });
  // the pointer unit changed (mark complete / undo) → bookmark reappears at that unit's top phase
  useEffect(() => { if (!tracking) return; const b = readLocalBookmark(sectionKey); setBkmkPhase(b && b.unit === cur ? b.phase : 0); }, [cur]);

  const writePointer = (i) => { const n = Math.min(Math.max(i, 0), total - 1); setCur(n); setUnitPointer(sectionKey, n); };
  const setDone = (v) => { setDoneFlag(v); setChapterDone(sectionKey, v); };
  const markComplete = () => {
    if (cur < total - 1) { const from = cur; writePointer(cur + 1); setUndoTo(from); }
    else { writePointer(total - 1); setDone(true); }
  };
  const undoComplete = () => { if (undoTo == null) return; writePointer(undoTo); setUndoTo(null); };
  const moveBookmark = (phase) => { setBkmkPhase(phase); writeLocalBookmark(sectionKey, cur, phase); };

  if (!total) {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}><Bar />
        <View style={{ padding: 24 }}>
          <Pressable onPress={onExit}><Text style={[type.small, { color: t.pine }]}>← back</Text></Pressable>
          <Text style={[type.body, { color: t.ink_soft, marginTop: 14 }]}>This plan has no units.</Text>
        </View>
      </View>
    );
  }

  if (showOrg) {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}><Bar />
        <ChapterOrg lp={lp} units={units} pointer={tracking ? cur : null} doneAll={tracking && doneFlag}
          onOpenUnit={(n) => { setPreviewAt(n); setShowOrg(false); }} onBack={onExit} />
      </View>
    );
  }

  const inDropped = previewAt >= units.length && droppedUnits.length > 0;
  const pu = inDropped ? (droppedUnits[previewAt - units.length] || droppedUnits[0]) : (units[previewAt] || units[0]);
  const pvGoto = (n) => { setPreviewAt(n); setUndoTo(null); };
  const goOrg = () => setShowOrg(true);
  const totalAll = units.length + droppedUnits.length;

  const pvNav = (
    <View style={[s.pvnav, { borderTopColor: t.line }]}>
      {previewAt <= 0 ? <NavBtn t={t} onPress={goOrg} label="‹ Chapter org." />
        : previewAt === units.length ? <NavBtn t={t} onPress={() => pvGoto(units.length - 1)} label={`← Back to unit ${units.length}`} />
        : <NavBtn t={t} onPress={() => pvGoto(previewAt - 1)} label="← Previous unit" />}
      <Text style={[type.mono, { fontSize: 12, color: t.ink_soft }]}>
        {inDropped ? `Dropped ${previewAt - units.length + 1} / ${droppedUnits.length}` : `Unit ${previewAt + 1} / ${units.length}`}
      </Text>
      {previewAt === units.length - 1 && droppedUnits.length ? <NavBtn t={t} onPress={() => pvGoto(units.length)} label="Dropped sections →" />
        : <NavBtn t={t} onPress={() => previewAt < totalAll - 1 && pvGoto(previewAt + 1)} label="Next unit →" off={previewAt >= totalAll - 1} />}
    </View>
  );

  const header = (
    <View>
      <View style={s.topbar}>
        <Text style={[type.label, { color: t.ink_soft, flex: 1 }]} numberOfLines={1}>{kickerOf(lp)}</Text>
        <Pressable onPress={goOrg} hitSlop={8}><Text style={[type.small, { color: t.pine }]}>← Orgn.</Text></Pressable>
      </View>
      <Text style={[s.title, { color: t.ink }]}>
        <Text style={{ color: t.clay }}>{inDropped ? "✦ " : `${previewAt + 1}.`}</Text> {pu.title}
      </Text>
      {inDropped ? <Text style={[type.small, { color: t.ink_soft, marginTop: 2 }]}>Dropped section · for self-study · not scheduled</Text> : null}
    </View>
  );

  const actUnit = undoTo != null ? undoTo : cur;
  const completionUI = !tracking ? null : undoTo != null ? (
    <DoneCard t={t} title="Unit complete" action="↺ Undo" onAction={undoComplete} tint={t.tint_pine} edge={t.pine} />
  ) : cur >= total - 1 ? (
    doneFlag ? <DoneCard t={t} title="Chapter complete" action="↺ Reopen" onAction={() => setDone(false)} tint={t.ochre_tint || t.tint_cream} edge={t.ochre} />
      : <MarkBtn t={t} label="Mark chapter complete" onPress={markComplete} />
  ) : <MarkBtn t={t} label="Mark this unit complete" onPress={markComplete} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar />
      <PreviewUnit key={previewAt} t={t} header={header} u={pu} assessment={view.assessment} chapterTitle={lp.chapter_title}
        defaultTab={tracking ? "lesson" : "overview"}
        lessonFooter={tracking && !inDropped && previewAt === actUnit ? completionUI : null}
        bookmark={tracking && !inDropped && previewAt === cur ? { phase: bkmkPhase, onMove: moveBookmark } : null}
        tail={pvNav} />
    </View>
  );
}

const NavBtn = ({ t, label, onPress, off }) => (
  <Pressable onPress={onPress} disabled={off} hitSlop={6}><Text style={[type.small, { color: t.pine, opacity: off ? 0.35 : 1 }]}>{label}</Text></Pressable>
);
const MarkBtn = ({ t, label, onPress }) => (
  <Pressable onPress={onPress} style={[s.markbtn, { backgroundColor: t.pine }]}><Text style={[type.button, { color: "#f3efe6" }]}>{label}</Text></Pressable>
);
const DoneCard = ({ t, title, action, onAction, tint, edge }) => (
  <View style={[s.donecard, { backgroundColor: tint, borderColor: edge }]}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ color: edge, fontSize: 18 }}>✓</Text>
      <Text style={[type.bodyStrong, { color: t.ink }]}>{title}</Text>
    </View>
    <Pressable onPress={onAction} hitSlop={6}><Text style={[type.small, { color: t.pine }]}>{action}</Text></Pressable>
  </View>
);

const s = StyleSheet.create({
  stick: { paddingHorizontal: 18, paddingTop: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: "Fraunces_500Medium", fontSize: 20, lineHeight: 25, marginTop: 8 },
  tabbar: { flexDirection: "row", marginTop: 14, gap: 20 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  body: { paddingHorizontal: 20, paddingVertical: 18, paddingBottom: 30 },
  ovrow: { flexDirection: "row", gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: "flex-start" },
  li: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 8 },
  td: { paddingVertical: 7, paddingHorizontal: 10, minWidth: 110 },
  ribbon: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  phases: { position: "relative", paddingLeft: 30 },
  phase: { flexDirection: "row", gap: 12, marginBottom: 16, alignItems: "flex-start" },
  phTime: { width: 44, alignItems: "flex-end", paddingTop: 3 },
  phN: { fontFamily: "IBMPlexMono_500Medium", fontSize: 15, lineHeight: 18 },
  phU: { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, lineHeight: 12 },
  hw: { borderWidth: 1, borderRadius: 10, padding: 13, marginTop: 8 },
  markbtn: { borderRadius: 11, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  donecard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 11, padding: 14, marginTop: 22 },
  pvnav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginTop: 26, gap: 10 },
});
