/* ───────── LessonView — the screen a teacher teaches from (Track D step 3, 2026-09-12) ─────────
 *
 * A 1:1 port of web/app/components/LessonView.jsx (CLAUDE.md §4: the phone matches the web).
 * Same anatomy: a chapter-org landing (the front door until she has taught a unit; reachable
 * thereafter via "← Orgn."),
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
import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { parseBold } from "@aruvi/shared/format";
import {
  readUnitPointer, setUnitPointer, readChapterDone, setChapterDone,
  readLocalBookmark, writeLocalBookmark,
} from "@aruvi/shared/sectionState";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";
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

/* ── Overview: ledger rows, exactly the web's four (.uv-ovrows) ── */
function OverviewPanel({ ws, u, chapterTitle }) {
  const m = u.meta || {};
  const axisVal = m.section_label || u.context;
  const isSS = u.groupType === "competency" || (u.groupType === "unit" && m.section_anchor);
  const axisRow = isSS ? ["Section", m.section_anchor] : [CTX_LABEL[u.groupType] || "Spine", axisVal];
  const rows = [["Chapter", chapterTitle], axisRow, ["Time", m.duration_minutes ? `${m.duration_minutes} mins` : null], ["Pedagogy", u.approach]].filter(([, v]) => v);
  if (!rows.length) return <Text style={ws.empty}>No overview details recorded for this unit.</Text>;
  return (
    <View style={ws.uv_ovrows}>
      {rows.map(([k, v]) => (
        <View key={k} style={ws.uv_ovrow}>
          <Text style={[ws.kicker, { width: 84 }]}>{k}</Text>
          <Text style={ws.uv_ovval}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

/* ── Material: the checklist + prepared tables/text (.uv-mat) ── */
function MaterialPanel({ ws, t, u }) {
  const va = u.meta && u.meta.visual_aids;
  const aids = Array.isArray(va) ? va : [];
  const legacyAid = typeof va === "string" && va ? va : null;
  const mats = u.materials || [];
  if (!mats.length && !aids.length && !legacyAid) return <Text style={ws.empty}>Nothing to prepare — this unit needs no materials.</Text>;
  return (
    <View style={ws.uv_mat}>
      {mats.map((mm, i) => <Text key={i} style={ws.uv_mat_li}>•  {mm}</Text>)}
      {legacyAid ? <Text style={ws.uv_va_prose}>{legacyAid}</Text> : null}
      {aids.map((a, i) => (
        <View key={i} style={ws.uv_va_kicker}>
          <Text style={ws.kicker}>{a.type === "table" ? "Prepared table" : "Prepared text"}{a.title ? ` · ${a.title}` : ""}</Text>
          {a.type === "table" && a.table ? <AidTable ws={ws} t={t} table={a.table} /> : null}
          {a.type === "table" && a.table && a.table.source_note ? <Text style={ws.uv_va_src}>{a.table.source_note}</Text> : null}
          {a.type === "prose" ? <Text style={ws.uv_va_prose}>{a.text}</Text> : null}
        </View>
      ))}
    </View>
  );
}
function AidTable({ ws, t, table }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
      <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 6, overflow: "hidden" }}>
        {table.caption ? <Text style={[ws.uv_va_src, { padding: 8, marginTop: 0 }]}>{table.caption}</Text> : null}
        <View style={{ flexDirection: "row", backgroundColor: t.paper_sunk }}>
          {(table.header || []).map((h, i) => <Text key={i} style={[ws.assess_ovk, s.td]}>{h}</Text>)}
        </View>
        {(table.rows || []).map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }}>
            {row.map((c, ci) => <Text key={ci} style={[ws.uv_mat_li, s.td, { paddingLeft: 10 }]}>{c}</Text>)}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ── Lesson: the notes ribbon → the phase spine (with the bookmark) → homework ── */
function LessonPanel({ ws, t, u, bookmark, footer }) {
  const phases = (u.phases || []).filter((ph) => ph.text || ph.label);
  const notes = u.teacher_notes && u.teacher_notes.length ? u.teacher_notes.join(" ") : null;
  const POINTER = /^(Refer to Prepared Table[^.]*\.)\s*/;
  const m = notes ? notes.match(POINTER) : null;
  const notesLead = m ? m[1] : null;
  const notesRest = notes ? notes.replace(POINTER, "") : "";
  const [notesOpen, setNotesOpen] = useState(true);   // <details open> on the web
  const [rows, setRows] = useState({});
  const centres = useMemo(() => phases.map((_, i) => rows[i] ? rows[i].y + 13 + rows[i].timeH / 2 : null).filter((v) => v != null), [rows, phases.length]);
  return (
    <View>
      {notes ? (
        <View style={ws.uv_tnotes_rib}>
          <Pressable onPress={() => setNotesOpen((o) => !o)} style={ws.uv_tnotes_sum}>
            <Text style={ws.uv_tnotes_k}>Teacher notes</Text>
            {notesOpen ? <Text style={[ws.uv_tnotes_k, { marginLeft: "auto" }]}>–</Text> : <Text style={ws.uv_tnotes_teaser} numberOfLines={1}>{notes}</Text>}
          </Pressable>
          {notesOpen ? (
            <Text style={ws.uv_tnotes_p}>
              {notesLead ? <Text style={ws.uv_tnotes_ref}>{notesLead} </Text> : null}{notesLead ? notesRest : notes}
            </Text>
          ) : null}
        </View>
      ) : null}

      {phases.length ? (
        <View style={ws.uv_phases}>
          {/* ★ `onLift` FREEZES THE SCROLLER (founder, 2026-09-15). While the arrow is lifted the
              phases must not slide under her — that relative motion is half of why dragging read
              as confusing on the handset. `labelFor` gives the callout the phase's own minutes
              and opening words, so the answer is legible with her thumb over the arrow. */}
          {bookmark ? (
            <PhaseBookmark centres={centres} phase={Math.min(bookmark.phase, phases.length - 1)}
              onMove={bookmark.onMove} color={t.clay} onLift={bookmark.onLift}
              labelFor={(i) => {
                const ph = phases[i]; if (!ph) return "";
                const mins = phaseMin(ph);
                const words = String(ph.text || ph.label || "").split(/\s+/).slice(0, 5).join(" ");
                return `${mins != null ? `${mins} min · ` : ""}${words}${words ? "…" : ""}`;
              }} />
          ) : null}
          {phases.map((ph, i) => {
            const mins = phaseMin(ph);
            return (
              <View key={i} style={[ws.uv_phase, i === phases.length - 1 && { borderBottomWidth: 0 }]}
                onLayout={(e) => { const { y } = e.nativeEvent.layout; setRows((r) => ({ ...r, [i]: { ...(r[i] || { timeH: 18 }), y } })); }}>
                <Pressable disabled={!bookmark} onPress={() => bookmark && bookmark.onMove(i)} style={ws.uv_ph_time}
                  onLayout={(e) => { const { height } = e.nativeEvent.layout; setRows((r) => ({ ...r, [i]: { ...(r[i] || { y: 0 }), timeH: height } })); }}>
                  <Text style={ws.uv_ph_n}>{mins != null ? mins : (ph.label || "—")}</Text>
                  {mins != null ? <Text style={ws.uv_ph_u}>min</Text> : null}
                </Pressable>
                <Text style={ws.uv_ph_t}>{ph.text}</Text>
              </View>
            );
          })}
        </View>
      ) : (u.activities && u.activities.length) ? u.activities.map((a, i) => (
        <Text key={i} style={ws.phaserow}>{a}</Text>
      )) : <Text style={ws.empty}>No phases recorded for this unit.</Text>}

      {u.homework ? (
        <View style={ws.uv_hw}>
          <Text style={ws.kicker}>Homework</Text>
          <Text style={ws.uv_hw_p}>{parseBold(u.homework).map((r, i) => r.bold ? <Text key={i} style={ws.uv_tnotes_ref}>{r.text}</Text> : r.text)}</Text>
        </View>
      ) : null}
      {footer}
    </View>
  );
}

/* ── one unit: pinned header + tab bar (.lv-stick), the panel beneath ── */
/* `defaultTab = "lesson"` is a DEFAULT PARAMETER, as it is on the web (`useUnitTabsParts` and
   `PreviewUnit` both carry it), so a caller that forgets to pass one still opens on the teaching
   spine rather than on an undefined tab. */
function PreviewUnit({ ws, t, header, u, assessment, chapterTitle, lessonFooter,
                       defaultTab = "lesson", bookmark, tail }) {
  const items = unitAssessItems(assessment, u);
  const [tab, setTab] = useState(defaultTab);
  /* ⚠️ THE SCROLLER IS THE BOOKMARK'S PROBLEM, so the bookmark gets to stop it. On iOS a
     UIScrollView will take a JS gesture the moment the finger moves vertically; the responder
     now refuses to give it up, but refusing is not enough on its own — a scroller that is still
     LIVE slides the phases under the arrow, and that relative motion is what read as the arrow
     drifting. Disabled for the length of the hold, restored on release. */
  const [locked, setLocked] = useState(false);
  const tabs = [["overview", "Overview"], ["material", "Material"], ["lesson", "Lesson"], ...(items.length ? [["assess", "Assess"]] : [])];
  return (
    <>
      <View style={[ws.lv_stick, { paddingHorizontal: 18 }]}>
        {header}
        <View style={ws.uv_tabs} accessibilityRole="tablist">
          {tabs.map(([id, label]) => (
            <Pressable key={id} onPress={() => setTab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}
              style={[ws.uv_tab, tab === id && ws.uv_tab_on]}>
              <Text style={[ws.uv_tab_t, tab === id && ws.uv_tab_on_t]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={s.body} scrollEnabled={!locked}>
        {tab === "overview" ? <OverviewPanel ws={ws} u={u} chapterTitle={chapterTitle} /> : null}
        {tab === "material" ? <MaterialPanel ws={ws} t={t} u={u} /> : null}
        {tab === "lesson" ? (
          <LessonPanel ws={ws} t={t} u={u} footer={lessonFooter}
            bookmark={bookmark ? { ...bookmark, onLift: setLocked } : null} />
        ) : null}
        {tab === "assess" ? <AssessPanel ws={ws} t={t} items={items} assessment={assessment} /> : null}
        {tail}
      </ScrollView>
    </>
  );
}

export default function LessonView({ view, sectionKey = "", onExit, preview = false }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const lp = view.lesson_plan;
  const units = useMemo(() => flattenUnits(lp), [lp]);
  const droppedUnits = useMemo(() => (view.dropped_lp ? flattenUnits(view.dropped_lp) : []), [view.dropped_lp]);
  const total = units.length;
  const tracking = !!sectionKey && !preview;

  const [cur, setCur] = useState(() => Math.min(tracking ? readUnitPointer(sectionKey) : 0, Math.max(0, total - 1)));
  /* ★ THE CHAPTER'S FRONT DOOR IS THE ORG PAGE UNTIL SHE HAS TAUGHT SOMETHING (founder,
     2026-09-14): "first time when someone clicks a lesson plan from My Lessons as well as My
     Class, it should by default open in the org page. When they click on a specific spine or
     section, it should open in the Lesson tab. Once they complete the first unit, clicking the
     lesson must henceforth take them to the sitting that they are now teaching."
     So the landing is about PROGRESS, not about which screen she came from. It used to be
     `useState(preview)` — preview landed on the org page and tracking went straight to a unit,
     which meant a chapter she had never opened dropped her into unit 1 with no sense of the
     shape of the thing. Now: no progress → the map; any progress → the sitting she is on.
     ⚠️ THE STORED POINTER *IS* THE COUNT OF COMPLETED UNITS (0-based index of the current unit),
     which is why `> 0` is the test and not `>= 0`. `doneAll` is checked too, for the one-unit
     chapter whose pointer never leaves 0 even when it is finished — without it, a completed
     one-unit chapter would keep opening on the map for ever.
     Preview has no pointer to consult, so it always lands on the map, which is what it already
     did and what "first time" means for a plan attached to no class. */
  const [showOrg, setShowOrg] = useState(() => preview
    || !(tracking && (readUnitPointer(sectionKey) > 0 || readChapterDone(sectionKey))));
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
        <View style={{ padding: 18 }}>
          <Pressable onPress={onExit} style={{ alignSelf: "flex-start" }}><Text style={ws.back_tr}>← back</Text></Pressable>
          <Text style={[ws.empty, { marginTop: 14 }]}>This plan has no units.</Text>
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
    <View style={ws.lv_pvnav}>
      {previewAt <= 0 ? <NavBtn ws={ws} onPress={goOrg} label="‹ Chapter org." />
        : previewAt === units.length ? <NavBtn ws={ws} onPress={() => pvGoto(units.length - 1)} label={`← Back to unit ${units.length}`} />
        : <NavBtn ws={ws} onPress={() => pvGoto(previewAt - 1)} label="← Previous unit" />}
      <Text style={ws.lv_pvmid}>
        {inDropped ? `Dropped ${previewAt - units.length + 1} / ${droppedUnits.length}` : `Unit ${previewAt + 1} / ${units.length}`}
      </Text>
      {previewAt === units.length - 1 && droppedUnits.length ? <NavBtn ws={ws} onPress={() => pvGoto(units.length)} label="Dropped sections →" />
        : <NavBtn ws={ws} onPress={() => previewAt < totalAll - 1 && pvGoto(previewAt + 1)} label="Next unit →" off={previewAt >= totalAll - 1} />}
    </View>
  );

  const header = (
    <View style={ws.lv_hd}>
      <View style={ws.co_topbar}>
        <Text style={[ws.kicker, { flex: 1 }]} numberOfLines={1}>{kickerOf(lp)}</Text>
        <Pressable onPress={goOrg} hitSlop={8}><Text style={ws.back_tr}>← Orgn.</Text></Pressable>
      </View>
      <Text style={ws.lv_title}>
        <Text style={ws.lv_unum}>{inDropped ? "✦ " : `${previewAt + 1}.`}</Text>  {pu.title}
      </Text>
      {inDropped ? <Text style={ws.uv_durline}>Dropped section · for self-study · not scheduled</Text> : null}
    </View>
  );

  const actUnit = undoTo != null ? undoTo : cur;
  const completionUI = !tracking ? null : undoTo != null ? (
    <DoneCard ws={ws} title="Unit complete" action="↺ Undo" onAction={undoComplete} />
  ) : cur >= total - 1 ? (
    doneFlag ? <DoneCard ws={ws} title="Chapter complete" action="↺ Reopen" onAction={() => setDone(false)} chapter />
      : <MarkBtn ws={ws} label="Mark chapter complete" onPress={markComplete} />
  ) : <MarkBtn ws={ws} label="Mark this unit complete" onPress={markComplete} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar />
      {/* ★ ALWAYS THE LESSON TAB (founder, 2026-09-14). The web's `useUnitTabsParts` and
          `PreviewUnit` both DEFAULT to "lesson", and page.jsx passes it explicitly too, so a unit
          opens on the teaching spine whether she is tracking or previewing. This opened a preview
          on Overview — a ledger of chapter, time and pedagogy — when what she came for, either
          way, is the lesson. */}
      <PreviewUnit key={previewAt} ws={ws} t={t} header={header} u={pu} assessment={view.assessment} chapterTitle={lp.chapter_title}
        defaultTab="lesson"
        lessonFooter={tracking && !inDropped && previewAt === actUnit ? completionUI : null}
        bookmark={tracking && !inDropped && previewAt === cur ? { phase: bkmkPhase, onMove: moveBookmark } : null}
        tail={pvNav} />
    </View>
  );
}

const NavBtn = ({ ws, label, onPress, off }) => (
  <Pressable onPress={onPress} disabled={off} hitSlop={6}><Text style={[ws.lv_pvbtn, off && ws.lv_pvbtn_off]}>{label}</Text></Pressable>
);
const MarkBtn = ({ ws, label, onPress }) => (
  <View style={ws.lv_markcard}><Pressable onPress={onPress} style={ws.lv_markbtn}><Text style={ws.lv_markbtn_t}>{label}</Text></Pressable></View>
);
const DoneCard = ({ ws, title, action, onAction, chapter }) => (
  <View style={[ws.lv_donecard, chapter && ws.lv_chapterdone]}>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text style={ws.lv_donemark}>✓</Text>
      <Text style={ws.lv_donetitle}>{title}</Text>
    </View>
    <Pressable onPress={onAction} hitSlop={6}><Text style={ws.lv_undo}>{action}</Text></Pressable>
  </View>
);

const s = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30 },   // main: 26px 18px 72px, minus the pinned block
  td: { paddingVertical: 7, paddingHorizontal: 10, minWidth: 110 },
});
