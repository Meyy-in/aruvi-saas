/* ───────── LessonView — the screen a teacher teaches from (Track D step 3, 2026-09-12) ─────────
 *
 * Ported from web/app/components/LessonView.jsx. The data comes IN as `view` (the inner
 * {lesson_plan, assessment} object from GET /plans/{s}/{g}/{file}/view) — this component never
 * fetches. A "unit" is one period of view.lesson_plan.groups[].periods[] (a Learning Unit).
 * The teacher pages units with the strip; only Mark complete advances the persisted pointer
 * (lu_pointer_). Four tabs per unit — Overview · Material · Lesson · Assess (Assess only when
 * the unit has items). Bookmark and pointer/done are the shared sectionState helpers, so the
 * phone and web write the same keys to the same server rows.
 *
 * Props: { view, meta, sectionKey, onExit, preview } — preview (My Lessons) = read-only, no
 * sectionKey, so no pointer/bookmark/complete. */
import { useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import { parseBold } from "@aruvi/shared/format";
import {
  readUnitPointer, setUnitPointer, readChapterDone, setChapterDone,
  readLocalBookmark, writeLocalBookmark,
} from "@aruvi/shared/sectionState";
import { useTheme } from "../theme/ThemeContext";
import { type } from "../theme/type";
import { display } from "../theme/fonts";
import Bar from "./Bar";

/* Walk groups (and any children) into a flat unit list, each carrying its group context. */
function flattenUnits(lp) {
  const out = [];
  const walk = (groups, ctx) => {
    (groups || []).forEach((g) => {
      const c = [...ctx, g.label].filter(Boolean);
      (g.periods || []).forEach((p) => out.push({ ...p, context: c.join(" · "), groupType: g.type }));
      if (g.children && g.children.length) walk(g.children, c);
    });
  };
  walk(lp.groups, []);
  return out;
}

/* Assess items for one unit: filter by anchor_period===unit.number when any item is anchored,
 * else show all (legacy). Mirrors the web's unitAssessItems. */
function unitAssessItems(assessment, unit) {
  const all = (assessment.groups || []).flatMap((g) => g.items || []);
  const anchored = all.some((it) => it.meta && it.meta.anchor_period != null);
  if (!anchored) return all;
  return all.filter((it) => it.meta && it.meta.anchor_period === unit.number);
}

/* Homework / inclusivity bold runs → Text segments (parseBold is the shared splitter). */
function Bold({ text, style, boldStyle }) {
  return <Text style={style}>{parseBold(text).map((r, i) => (
    r.bold ? <Text key={i} style={boldStyle}>{r.text}</Text> : r.text
  ))}</Text>;
}

export default function LessonView({ view, meta, sectionKey = "", onExit, preview = false }) {
  const { t } = useTheme();
  const lp = view.lesson_plan;
  const assessment = view.assessment || { groups: [] };
  const units = useMemo(() => flattenUnits(lp), [lp]);
  const total = units.length;
  const tracking = !!sectionKey && !preview;

  // the persisted teaching pointer (where she stopped); read once
  const [cur, setCur] = useState(() => Math.min(tracking ? readUnitPointer(sectionKey) : 0, Math.max(0, total - 1)));
  const [at, setAt] = useState(cur);                 // which unit is on screen (defaults to the pointer)
  const [done, setDone] = useState(() => tracking ? readChapterDone(sectionKey) : false);
  const [undoTo, setUndoTo] = useState(null);        // the unit just completed (for Undo)
  const [tab, setTab] = useState(preview ? "overview" : "lesson");
  const [bkmk, setBkmk] = useState(() => {
    if (!tracking) return null;
    const b = readLocalBookmark(sectionKey);
    return b && b.unit === cur ? b.phase : 0;
  });
  const [reveal, setReveal] = useState({});          // which MCQ answers are shown

  const unit = units[at] || units[0] || {};
  const items = unitAssessItems(assessment, unit);
  const tabs = [["overview", "Overview"], ["material", "Material"], ["lesson", "Lesson"]];
  if (items.length) tabs.push(["assess", "Assess"]);
  const cls = meta && meta.chapter_title ? meta.chapter_title : lp.chapter_title;
  const classNo = String(lp.grade || "").replace(/grade/i, "").trim();

  const goto = (i) => {
    const n = Math.min(Math.max(i, 0), total - 1);
    setAt(n);
    if (!tabs.some(([k]) => k === tab)) setTab("lesson");
    // moving off the completed unit clears the transient Undo affordance
    if (undoTo != null && n !== undoTo) setUndoTo(null);
    // re-read the bookmark for the pointer unit
    if (tracking) { const b = readLocalBookmark(sectionKey); setBkmk(b && b.unit === cur ? b.phase : 0); }
  };

  const markComplete = () => {
    if (!tracking) return;
    if (cur < total - 1) {
      setUndoTo(cur); const next = cur + 1;
      setUnitPointer(sectionKey, next); setCur(next);
    } else {
      setChapterDone(sectionKey, true); setDone(true);
    }
  };
  const undoComplete = () => {
    if (undoTo == null) return;
    setUnitPointer(sectionKey, undoTo); setCur(undoTo); setUndoTo(null);
  };
  const reopen = () => { setChapterDone(sectionKey, false); setDone(false); };
  const moveBookmark = (phase) => {
    setBkmk(phase);
    if (tracking && at === cur) writeLocalBookmark(sectionKey, cur, phase);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar />
      {/* frozen header: back · subject·class·chapter · unit strip · tabs */}
      <View style={[s.head, { backgroundColor: t.paper, borderBottomColor: t.line }]}>
        <View style={s.crumb}>
          <Pressable onPress={onExit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={[type.body, { color: t.pine }]}>‹ Back</Text>
          </Pressable>
          <Text style={[type.label, { color: t.ink_soft, flex: 1, textAlign: "right" }]} numberOfLines={1}>
            {cls} · Class {classNo}
          </Text>
        </View>
        <Text style={[styleTitle(t), s.title]} numberOfLines={2}>{unit.title || `Unit ${unit.number || at + 1}`}</Text>

        {/* unit strip */}
        <View style={s.strip}>
          <Pressable onPress={() => goto(at - 1)} disabled={at === 0} hitSlop={8} style={s.step}>
            <Text style={[type.body, { color: at === 0 ? t.ink_soft : t.pine, opacity: at === 0 ? 0.4 : 1 }]}>‹</Text>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pips}>
            {units.map((u, i) => {
              const isAt = i === at, isPtr = tracking && i === cur;
              return (
                <Pressable key={i} onPress={() => goto(i)} accessibilitylabel={`Unit ${u.number || i + 1}`}
                  style={[s.pip, { borderColor: isAt ? t.pine : t.edge, backgroundColor: isAt ? t.pine : (isPtr ? t.tint_pine : t.paper_2) }]}>
                  <Text style={[type.mono, { fontSize: 13, color: isAt ? "#f3efe6" : (isPtr ? t.pine : t.ink_soft) }]}>{u.number || i + 1}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable onPress={() => goto(at + 1)} disabled={at === total - 1} hitSlop={8} style={s.step}>
            <Text style={[type.body, { color: at === total - 1 ? t.ink_soft : t.pine, opacity: at === total - 1 ? 0.4 : 1 }]}>›</Text>
          </Pressable>
        </View>
        <Text style={[type.label, { color: t.ink_soft, marginTop: 2 }]}>
          Unit {at + 1} of {total}{tracking && cur !== at ? `  ·  you're teaching unit ${cur + 1}` : ""}
        </Text>

        {/* tab bar */}
        <View style={s.tabbar}>
          {tabs.map(([k, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && { borderBottomColor: t.clay }]}>
              <Text style={[type.small, { color: tab === k ? t.ink : t.ink_soft, fontFamily: tab === k ? display(600) : undefined }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} key={`${at}-${tab}`}>
        {tab === "overview" && <Overview t={t} unit={unit} chapter={cls} />}
        {tab === "material" && <Material t={t} unit={unit} />}
        {tab === "lesson" && (
          <Lesson t={t} unit={unit} bookmark={tracking && at === cur ? bkmk : null} onMoveBookmark={moveBookmark}
            footer={tracking && at === (undoTo ?? cur)
              ? <Completion t={t} last={cur === total - 1} done={done} undo={undoTo != null}
                  onComplete={markComplete} onUndo={undoComplete} onReopen={reopen} />
              : null} />
        )}
        {tab === "assess" && <Assess t={t} items={items} reveal={reveal} setReveal={setReveal} />}
      </ScrollView>
    </View>
  );
}

/* ── panels ── */

function Row({ t, k, v }) {
  if (!v) return null;
  return (
    <View style={s.ledger}>
      <Text style={[type.label, { color: t.ink_soft, width: 92 }]}>{k}</Text>
      <Text style={[type.body, { color: t.ink, flex: 1 }]}>{v}</Text>
    </View>
  );
}

function Overview({ t, unit, chapter }) {
  const m = unit.meta || {};
  const axis = m.section_anchor || m.section_label || unit.context;
  const los = unit.learning_outcomes || [];
  return (
    <View style={s.panel}>
      <View style={[s.card, { backgroundColor: t.card_doc, borderColor: t.card_doc_edge }]}>
        <Row t={t} k="Chapter" v={chapter} />
        <Row t={t} k="Focus" v={axis} />
        <Row t={t} k="Time" v={m.duration_minutes ? `${m.duration_minutes} mins` : null} />
        <Row t={t} k="Pedagogy" v={unit.approach} />
      </View>
      {los.length ? (
        <View style={{ marginTop: 18 }}>
          <Text style={[type.label, { color: t.ink_soft, marginBottom: 8 }]}>What students will be able to do</Text>
          {los.map((lo, i) => <Bullet key={i} t={t} text={lo} />)}
        </View>
      ) : null}
    </View>
  );
}

function Material({ t, unit }) {
  const mats = unit.materials || (unit.meta && unit.meta.materials) || [];
  const aids = (unit.meta && unit.meta.visual_aids) || [];
  const typedAids = Array.isArray(aids) ? aids.filter((a) => a && typeof a === "object") : [];
  return (
    <View style={s.panel}>
      <Text style={[type.label, { color: t.ink_soft, marginBottom: 8 }]}>Bring to class</Text>
      {mats.length ? mats.map((mm, i) => (
        <View key={i} style={s.check}>
          <View style={[s.box, { borderColor: t.edge }]} />
          <Text style={[type.body, { color: t.ink, flex: 1 }]}>{mm}</Text>
        </View>
      )) : <Text style={[type.body, { color: t.ink_soft }]}>Nothing beyond the textbook.</Text>}
      {typedAids.map((a, i) => (
        <View key={`v${i}`} style={[s.card, { backgroundColor: t.paper_2, borderColor: t.edge, marginTop: 14 }]}>
          {a.title ? <Text style={[type.bodyStrong, { color: t.ink, marginBottom: 6 }]}>{a.title}</Text> : null}
          {a.type === "table" && a.table ? <AidTable t={t} table={a.table} /> : <Text style={[type.body, { color: t.ink }]}>{a.text}</Text>}
        </View>
      ))}
    </View>
  );
}

function AidTable({ t, table }) {
  const head = table.header || [];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {table.caption ? <Text style={[type.small, { color: t.ink_soft, marginBottom: 6 }]}>{table.caption}</Text> : null}
        <View style={{ flexDirection: "row" }}>
          {head.map((h, i) => <Text key={i} style={[type.label, s.td, { color: t.ink, backgroundColor: t.sunk || t.tint_pine }]}>{h}</Text>)}
        </View>
        {(table.rows || []).map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row" }}>
            {row.map((cell, ci) => <Text key={ci} style={[type.small, s.td, { color: t.ink, borderColor: t.line }]}>{cell}</Text>)}
          </View>
        ))}
        {table.source_note ? <Text style={[type.small, { color: t.ink_soft, marginTop: 6 }]}>{table.source_note}</Text> : null}
      </View>
    </ScrollView>
  );
}

function Lesson({ t, unit, bookmark, onMoveBookmark, footer }) {
  const notes = unit.teacher_notes || [];
  const phases = unit.phases || [];
  const hw = unit.homework;
  return (
    <View style={s.panel}>
      {notes.length ? (
        <View style={[s.ribbon, { backgroundColor: t.tint_cream, borderColor: t.edge_clay || t.edge }]}>
          {notes.map((n, i) => <Text key={i} style={[type.small, { color: t.ink }]}>{n}</Text>)}
        </View>
      ) : null}

      {phases.length ? phases.map((ph, i) => {
        const mins = (ph.end_min !== "" && ph.start_min !== "") ? `${ph.end_min - ph.start_min} min` : (ph.label || "");
        const marked = bookmark != null && bookmark === i;
        return (
          <Pressable key={i} onPress={() => bookmark != null && onMoveBookmark(i)} style={s.phase}>
            <View style={s.phaseRail}>
              <View style={[s.phaseDot, { backgroundColor: marked ? t.clay : t.card_tick, borderColor: t.paper }]} />
              {i < phases.length - 1 ? <View style={[s.phaseLine, { backgroundColor: t.line }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 16 }}>
              <Text style={[type.mono, { fontSize: 11, color: marked ? t.clay : t.ink_soft, marginBottom: 3 }]}>
                {mins}{marked ? "  ·  bookmark" : ""}
              </Text>
              <Text style={[type.body, { color: t.ink }]}>{ph.text}</Text>
            </View>
          </Pressable>
        );
      }) : (unit.activities || []).map((a, i) => (
        <Text key={i} style={[type.body, { color: t.ink, marginBottom: 10 }]}>{a}</Text>
      ))}

      {bookmark != null ? <Text style={[type.small, { color: t.ink_soft, marginTop: 2 }]}>Tap a step to move your bookmark.</Text> : null}

      {hw ? (
        <View style={{ marginTop: 20 }}>
          <Text style={[type.label, { color: t.ink_soft, marginBottom: 6 }]}>Homework</Text>
          <Bold text={hw} style={[type.body, { color: t.ink }]} boldStyle={{ fontFamily: display(600) }} />
        </View>
      ) : null}

      {footer}
    </View>
  );
}

function Completion({ t, last, done, undo, onComplete, onUndo, onReopen }) {
  if (done) {
    return (
      <View style={[s.done, { backgroundColor: t.ochre_tint, borderColor: t.ochre }]}>
        <Text style={[type.bodyStrong, { color: t.ink }]}>✓ Chapter complete</Text>
        <Pressable onPress={onReopen} hitSlop={6}><Text style={[type.small, { color: t.pine }]}>↺ Reopen</Text></Pressable>
      </View>
    );
  }
  if (undo) {
    return (
      <View style={[s.done, { backgroundColor: t.tint_pine, borderColor: t.pine }]}>
        <Text style={[type.bodyStrong, { color: t.ink }]}>✓ Unit complete</Text>
        <Pressable onPress={onUndo} hitSlop={6}><Text style={[type.small, { color: t.pine }]}>↺ Undo</Text></Pressable>
      </View>
    );
  }
  return (
    <Pressable onPress={onComplete} style={[s.cbtn, { backgroundColor: t.pine }]}>
      <Text style={[type.button, { color: "#f3efe6" }]}>{last ? "Mark chapter complete" : "Mark this unit complete"}</Text>
    </Pressable>
  );
}

function Assess({ t, items, reveal, setReveal }) {
  return (
    <View style={s.panel}>
      {items.map((it, idx) => {
        const n = it.normalized || {};
        const opts = n.options || it.options || [];
        const isMcq = (it.item_type || "").toUpperCase() === "MCQ" && Array.isArray(opts) && opts.length && typeof opts[0] === "object";
        const shown = reveal[idx];
        const guide = it.teacher_guide || [];
        return (
          <View key={idx} style={[s.card, { backgroundColor: t.paper_2, borderColor: t.edge, marginBottom: 14 }]}>
            <View style={s.qmeta}>
              <Text style={[type.mono, { fontSize: 10.5, color: t.pine }]}>{it.item_type || n.question_type}</Text>
              {n.cognitive_demand ? <Text style={[type.mono, { fontSize: 10.5, color: t.ink_soft }]}>· {n.cognitive_demand}</Text> : null}
            </View>
            {it.visual_stimulus && it.visual_stimulus.type === "svg" && it.visual_stimulus.content ? (
              <View style={s.stim}><SvgXml xml={it.visual_stimulus.content} width="100%" /></View>
            ) : null}
            <Text style={[type.body, { color: t.ink, marginTop: 4 }]}>{n.stem || it.prompt}</Text>
            {isMcq ? (
              <View style={{ marginTop: 10, gap: 7 }}>
                {opts.map((o, oi) => {
                  const correct = shown && o.is_correct;
                  return (
                    <View key={oi} style={[s.opt, { borderColor: correct ? t.pine : t.line, backgroundColor: correct ? t.tint_pine : "transparent" }]}>
                      <Text style={[type.mono, { fontSize: 12, color: correct ? t.pine : t.ink_soft, width: 18 }]}>{o.label}</Text>
                      <Text style={[type.body, { color: t.ink, flex: 1 }]}>{o.text}</Text>
                      {correct ? <Text style={{ color: t.pine }}>✓</Text> : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
            {guide.length ? (
              <View style={{ marginTop: 10 }}>
                <Text style={[type.label, { color: t.ink_soft, marginBottom: 4 }]}>Teacher guide</Text>
                {guide.map((gg, gi) => <Bullet key={gi} t={t} text={gg} small />)}
              </View>
            ) : null}
            {(isMcq || (it.answer && String(it.answer).trim())) ? (
              <Pressable onPress={() => setReveal((r) => ({ ...r, [idx]: !r[idx] }))} hitSlop={6} style={{ marginTop: 10 }}>
                <Text style={[type.small, { color: t.pine }]}>{shown ? "Hide answer" : "Show answer"}</Text>
              </Pressable>
            ) : null}
            {shown && it.answer && String(it.answer).trim() && !isMcq ? (
              <Text style={[type.body, { color: t.ink, marginTop: 6 }]}>Answer: {it.answer}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Bullet({ t, text, small }) {
  return (
    <View style={s.check}>
      <Text style={[type.body, { color: t.ink_soft }]}>•</Text>
      <Text style={[small ? type.small : type.body, { color: t.ink, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styleTitle = (t) => ({ color: t.ink });

const s = StyleSheet.create({
  head: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  crumb: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontFamily: "Fraunces_500Medium", fontSize: 20, lineHeight: 25, marginTop: 8 },
  strip: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 4 },
  step: { paddingHorizontal: 4, paddingVertical: 2 },
  pips: { gap: 6, paddingHorizontal: 4 },
  pip: { minWidth: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabbar: { flexDirection: "row", marginTop: 14, gap: 20 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  body: { paddingHorizontal: 20, paddingVertical: 18, paddingBottom: 48 },
  panel: { gap: 2 },
  card: { borderWidth: 1, borderRadius: 11, padding: 15 },
  ledger: { flexDirection: "row", paddingVertical: 6, gap: 10, alignItems: "flex-start" },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 8 },
  box: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, marginTop: 2 },
  ribbon: { borderWidth: 1, borderRadius: 10, padding: 13, marginBottom: 16, gap: 6 },
  phase: { flexDirection: "row", gap: 12 },
  phaseRail: { width: 14, alignItems: "center" },
  phaseDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 3 },
  phaseLine: { width: 2, flex: 1, marginTop: 2 },
  done: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 11, padding: 14, marginTop: 22 },
  cbtn: { borderRadius: 11, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  qmeta: { flexDirection: "row", gap: 5, alignItems: "center" },
  stim: { marginTop: 8, marginBottom: 4 },
  opt: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderWidth: 1, borderRadius: 8, padding: 10 },
  td: { paddingVertical: 7, paddingHorizontal: 10, minWidth: 110, borderWidth: StyleSheet.hairlineWidth, borderColor: "transparent" },
});
