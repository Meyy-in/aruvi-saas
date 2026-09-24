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
 * the ScrollView instead of a measured `--nav-h` sticky; the bookmark is press-then-place
 * (tap on the minutes also moves it — the phone's stand-in for the web's arrow keys); the
 * teacher-notes <details> is a Pressable that toggles. Everything else — order, labels, copy,
 * which field feeds which row — is the web's. */
import { useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, AppState } from "react-native";
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
import { useTourAnchor, registerTourScroller } from "../lib/tour";
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
      {/* `.uv-va-legacy` — 13px italic ink-soft, set apart from a typed prose aid (app. 06 row 69a). */}
      {legacyAid ? <Text style={ws.uv_va_legacy}>{legacyAid}</Text> : null}
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
    /* The web's `.uv-va-table`, measured at 390px (2026-09-18): it was a boxed table with a sunk
       header and the assessment's overview type; the web draws a RULED one. */
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
      <View>
        {table.caption ? <Text style={ws.uv_va_cap}>{table.caption}</Text> : null}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: t.ink }}>
          {(table.header || []).map((h, i) => (
            <Text key={i} style={[ws.uv_va_th, s.cell, i === 0 ? { paddingLeft: 0 }
              : { borderLeftWidth: 1, borderLeftColor: t.line }]}>{h}</Text>
          ))}
        </View>
        {(table.rows || []).map((row, ri, all) => (
          <View key={ri} style={{ flexDirection: "row",
            borderBottomWidth: ri < all.length - 1 ? 1 : 0, borderBottomColor: t.line }}>
            {row.map((c, ci) => (
              <Text key={ci} style={[ws.uv_va_td, s.cell, ci === 0 ? { paddingLeft: 0 }
                : { borderLeftWidth: 1, borderLeftColor: t.line }]}>{c}</Text>
            ))}
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
  /* ★ HELD — her finger is on the bookmark (founder, 2026-09-15). For as long as it lasts the
     spine FREEZES and the phase the arrow is over LIGHTS UP. The highlight is the feedback
     channel: her thumb covers the arrow, so the answer has to be readable somewhere her hand is
     not, and a whole row is the widest target on this screen. `over` follows the arrow live. */
  const [held, setHeld] = useState(false);
  const [over, setOver] = useState(0);
  /* ★ THE CENTRE COMES FROM THE PHASE'S OWN PADDING (app. 06 row 75). `13` was `ws.uv_phase`'s
     paddingVertical hard-copied into arithmetic — so re-measuring that one style against the web
     would have silently walked every bookmark centre off its row, and the checker cannot see a
     number that is not in `web.js`. Read it from the style and the two cannot drift. */
  const bookmarkTourRef = useTourAnchor("phase-bookmark");    // tour step 12
  const firstPhaseTourRef = useTourAnchor("lesson-phase-1");  // step 11's tip fallback
  const phasePadTop = (ws.uv_phase && ws.uv_phase.paddingVertical) || 13;
  const centres = useMemo(
    () => phases.map((_, i) => (rows[i] ? rows[i].y + phasePadTop + rows[i].timeH / 2 : null))
                .filter((v) => v != null),
    [rows, phases.length, phasePadTop]);
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
          {/* ⚠️ NO INSTRUCTION ROW. One was added when "not movable" was read as a
              discoverability problem, and the founder struck it: "No need for that row that pops
              up how to use in the top". He is right — with the frame and the highlight appearing
              on touch-down, holding and sliding is the obvious next move, and a banner that
              explains a gesture she is already performing is a banner that arrived too late. */}
          {bookmark ? (
            /* ⚠️ A WRAPPER, and `pointerEvents="box-none"` on it — the bookmark is a drag target
               and an ordinary View over it would eat the gesture that 2026-09-16 took four
               attempts to get right. The wrapper exists only to be measured (tour step 12). */
            /* ⚠️ THE ANCHOR IS ON THE BOOKMARK, NOT A WRAPPER (founder, 2026-09-17, reported four
               times: card 12 *"still does not highlight the bookmark"*). `PhaseBookmark`'s root is
               `position: "absolute"`, so a wrapping View contributes NOTHING to layout and
               measures as a zero box — which `measureAnchor` correctly treats as absent, leaving
               the ring with nothing to draw. Same mistake, same day, as the report icon's wrapper.
               The wrapper is gone entirely: it existed only to be measured, and it could not be. */
            <PhaseBookmark anchorRef={bookmarkTourRef}
              centres={centres} phase={Math.min(bookmark.phase, phases.length - 1)}
              color={t.clay} onMove={bookmark.onMove} onOver={setOver}
              onHold={(on) => { setHeld(on); if (bookmark.onLift) bookmark.onLift(on); }} />
          ) : null}
          {phases.map((ph, i) => {
            const mins = phaseMin(ph);
            /* ★ EXACTLY ONE ROW LIGHTS UP, and only while she is holding the bookmark — the
               one the arrow is currently over. It starts on the phase the bookmark is on and
               FOLLOWS the arrow as she slides ("when the highlight also moves"), which is what
               makes the answer readable with her thumb over the arrow. It goes when she lifts. */
            const here = held && i === over;
            return (
              /* ⚠️ THE ROWS ARE NOT TOUCH TARGETS. They were briefly, when placing was a tap;
                 the bookmark is dragged again now, so a tappable row would only be a way to move
                 this mark by accident while she reads the plan mid-lesson — the one moment it
                 must not move. They light up and nothing more. */
              <View key={i} ref={i === 0 ? firstPhaseTourRef : undefined} collapsable={false}
                style={[ws.uv_phase, i === phases.length - 1 && { borderBottomWidth: 0 },
                  here && ws.uv_phase_arm]}
                onLayout={(e) => { const { y } = e.nativeEvent.layout; setRows((r) => ({ ...r, [i]: { ...(r[i] || { timeH: 18 }), y } })); }}>
                <View style={ws.uv_ph_time}
                  onLayout={(e) => { const { height } = e.nativeEvent.layout; setRows((r) => ({ ...r, [i]: { ...(r[i] || { y: 0 }), timeH: height } })); }}>
                  <Text style={ws.uv_ph_n}>{mins != null ? mins : (ph.label || "—")}</Text>
                  {mins != null ? <Text style={ws.uv_ph_u}>min</Text> : null}
                </View>
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
  /* ⚠️ DECLARED HERE, NOT IN `LessonView`. It was in `LessonView` and used down here, which babel
     parses happily and which throws the moment a unit renders — `PreviewUnit` is a sibling
     function, not a closure over it. A tour anchor belongs to the component that puts it on a
     View. */
  const unitTabsTourRef = useTourAnchor("unit-tabs");   // tour step 11 positions its tip here
  /* ★ THIS IS THE SCROLLER THE TOUR PINS (steps 7 and 11). One screen, one scroller: whichever
     unit is mounted owns it, and the registration is torn down with it, so the tour never holds
     a handle to a screen that has gone. It scrolls; it does not fight her afterwards. */
  const scrollTourRef = useRef(null);
  const scrollYRef = useRef(0);          // the offset only this scroller knows
  useEffect(() => registerTourScroller({
    top: () => {
      try { scrollTourRef.current && scrollTourRef.current.scrollTo({ y: 0, animated: true }); } catch {}
    },
    /* `dy` is a delta in window coordinates, because that is what the overlay measures in and
       the offset is what only this component tracks. Clamped at 0: a target above the top means
       scrolling to the top, never to a negative offset. */
    by: (dy) => {
      try {
        const y = Math.max(0, scrollYRef.current + dy);
        scrollTourRef.current && scrollTourRef.current.scrollTo({ y, animated: true });
      } catch {}
    },
  }), []);
  /* ⚠️ THE SPINE FREEZES WHILE SHE IS CHOOSING (founder, 2026-09-15: "Important that when arrow
     is pressed it must freeze the phase screen"). While the bookmark is armed the rows are
     targets, and a target that slides away under the finger is worse than no target at all — it
     is the relative motion that made the old drag read as confusing in the first place. Disabled
     from the press on the arrow until she picks a phase or backs out. */
  const [locked, setLocked] = useState(false);
  const tabs = [["overview", "Overview"], ["material", "Material"], ["lesson", "Lesson"], ...(items.length ? [["assess", "Assess"]] : [])];
  return (
    <>
      <View style={[ws.lv_stick, { paddingHorizontal: 18 }]}>
        {header}
        <View ref={unitTabsTourRef} collapsable={false}
          style={ws.uv_tabs} accessibilityRole="tablist">
          {tabs.map(([id, label]) => (
            <Pressable key={id} onPress={() => setTab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}
              style={[ws.uv_tab, tab === id && ws.uv_tab_on]}>
              <Text style={[ws.uv_tab_t, tab === id && ws.uv_tab_on_t]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView ref={scrollTourRef} contentContainerStyle={s.body} scrollEnabled={!locked}
        scrollEventThrottle={16}
        onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}>
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

export default function LessonView({ view, sectionKey = "", sectionLabel = "", onExit, preview = false, tourUnit = false }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const lp = view.lesson_plan;
  const units = useMemo(() => flattenUnits(lp), [lp]);
  const droppedUnits = useMemo(() => (view.dropped_lp ? flattenUnits(view.dropped_lp) : []), [view.dropped_lp]);
  const total = units.length;
  const tracking = !!sectionKey && !preview;
  /* ★ ONE ROOT, TWO NAMES (tour steps 7 and 11). The web has two separate mounts; the phone has
     one screen that is either a read-only PREVIEW (opened from My Lessons, step 7) or the
     TRACKING view (opened from a section card, step 11). Which anchor it claims follows that,
     so the ring lands on the right screen without the tour having to know how she arrived. */
  const rootTourRef = useTourAnchor(tracking ? "lesson-root" : "preview-root");

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
  /* ⚠️ THE TOUR IS THE ONE CALLER THAT MUST NOT LAND ON THE MAP. Steps 7 and 11-13 describe the
     four tabs, the phase bookmark and Mark complete — every one of them on the UNIT — and a
     chapter with no progress opens on the org page by design (founder, 2026-09-14). So the tour
     says which it wants rather than the landing rule guessing for it. Nothing else passes this. */
  const [showOrg, setShowOrg] = useState(() => !tourUnit && (preview
    || !(tracking && (readUnitPointer(sectionKey) > 0 || readChapterDone(sectionKey)))));
  const [previewAt, setPreviewAt] = useState(cur);
  const [doneFlag, setDoneFlag] = useState(() => (tracking ? readChapterDone(sectionKey) : false));
  const [undoTo, setUndoTo] = useState(null);
  const [bkmkPhase, setBkmkPhase] = useState(() => {
    if (!tracking) return 0;
    const b = readLocalBookmark(sectionKey);
    return b && b.unit === cur ? b.phase : 0;
  });
  /* ★ THE RESET IS PERSISTED, NOT JUST SHOWN (app. 06 row 81). This set state and stopped, so
     after "Mark complete" the SCREEN showed the bookmark at the new unit's top phase while the
     stored row still pointed into the OLD unit — and `pushSectionState` carries the stored row,
     so her other device inherited the stale one. The web writes the reset for exactly this
     reason (`writeLocalBookmark(sectionKey, cur, 0)`).
     ⚠️ GUARDED BY A REF SO IT CANNOT FIRE ON MOUNT. `[cur]` runs on the first render too, and on
     a freshly-opened lesson `prevCur === cur` — without the guard, simply opening a lesson would
     overwrite the phase she left off at with 0, which is the opposite of what the bookmark is
     for. The web carries the same ref and the same comment. */
  const prevCurRef = useRef(cur);
  useEffect(() => {
    if (!tracking) return;
    if (prevCurRef.current === cur) return;      // mount / no real change → leave the saved phase
    prevCurRef.current = cur;
    const b = readLocalBookmark(sectionKey);
    if (b && b.unit === cur) {
      setBkmkPhase(b.phase);                     // returning to a unit → where she left it
    } else {
      setBkmkPhase(0);                           // advanced to a new unit → top level
      writeLocalBookmark(sectionKey, cur, 0);    // persist it, so the server row agrees
    }
  }, [cur, sectionKey, tracking]);

  /* ★ COMING BACK TO THE APP RE-READS THE BOOKMARK (app. 06 rows 83, 125). The web listens on
     `focus`, `pageshow` and `storage`; AppState going `active` is the phone's equivalent and the
     one that matters on a handset — she moves a bookmark on the laptop, picks the phone up, and
     the spine should agree. ⚠️ Only when the stored row is for the unit she is ON: a bookmark
     belonging to another unit is not this screen's business, and adopting it would jump her
     mid-lesson. Cheap by construction — a local read, no request. */
  useEffect(() => {
    if (!tracking) return undefined;
    const resync = (st) => {
      if (st !== "active") return;
      const b = readLocalBookmark(sectionKey);
      if (b && b.unit === cur) setBkmkPhase((prev) => (prev === b.phase ? prev : b.phase));
    };
    const sub = AppState.addEventListener("change", resync);
    return () => sub.remove();
  }, [cur, sectionKey, tracking]);

  /* ⚠️ MOVING BACK OFF THE LAST UNIT MEANS IT IS NO LONGER DONE (app. 06 row 5). The phone set
     the pointer and stopped, so an undo from the final unit left `done` TRUE underneath a
     pointer that had moved — and `done` is what paints the section card clay and what the
     history ledger reads as "completed". She would have undone the completion on screen and left
     the chapter still filed as finished. The web has cleared it here since its own writer was
     written; `setChapterDone` pushes, so the correction reaches her other device too. */
  const writePointer = (i) => {
    const n = Math.min(Math.max(i, 0), total - 1);
    setCur(n);
    setUnitPointer(sectionKey, n);
    if (n < total - 1) setDone(false);
  };
  const setDone = (v) => { setDoneFlag(v); setChapterDone(sectionKey, v); };
  const markComplete = () => {
    if (cur < total - 1) { const from = cur; writePointer(cur + 1); setUndoTo(from); }
    else { writePointer(total - 1); setDone(true); }
  };
  const undoComplete = () => { if (undoTo == null) return; writePointer(undoTo); setUndoTo(null); };
  const moveBookmark = (phase) => { setBkmkPhase(phase); writeLocalBookmark(sectionKey, cur, phase); };

  if (!total) {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        <View style={{ padding: 18 }}>
          <Pressable onPress={onExit} style={{ alignSelf: "flex-start" }}><Text style={ws.back_tr}>← back</Text></Pressable>
          <Text style={[ws.empty, { marginTop: 14 }]}>This plan has no units.</Text>
        </View>
      </View>
    );
  }

  if (showOrg) {
    return (
      /* ★ THE RING GOES ROUND THE ORG PAGE TOO. Steps 7 and 11 ring "the whole screen", and a
         chapter she has not started opens on the map, not on a unit — without the anchor here
         the ring had nothing to measure on exactly the plan a new teacher is shown. */
      <View ref={rootTourRef} collapsable={false} style={{ flex: 1, backgroundColor: t.paper }}>
        <ChapterOrg lp={lp} units={units} pointer={tracking ? cur : null} doneAll={tracking && doneFlag}
          onOpenUnit={(n) => { setPreviewAt(n); setShowOrg(false); }} onBack={onExit}
          sectionLabel={sectionLabel} />
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
        <Text style={[ws.kicker, { flex: 1 }]} numberOfLines={1}>{kickerOf(lp, sectionLabel)}</Text>
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
    <DoneCard ws={ws} t={t} title="Unit complete" action="↺ Undo" onAction={undoComplete} />
  ) : cur >= total - 1 ? (
    doneFlag ? <DoneCard ws={ws} t={t} title="Chapter complete" action="↺ Reopen" onAction={() => setDone(false)} chapter />
      : <MarkBtn ws={ws} label="Mark chapter complete" onPress={markComplete} />
  ) : <MarkBtn ws={ws} label="Mark this unit complete" onPress={markComplete} />;

  return (
    <View ref={rootTourRef} collapsable={false} style={{ flex: 1, backgroundColor: t.paper }}>
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
  <View ref={useTourAnchor("mark-complete")} collapsable={false} style={ws.lv_markcard}><Pressable onPress={onPress} style={ws.lv_markbtn}><Text style={ws.lv_markbtn_t}>{label}</Text></Pressable></View>
);
/* ★ THE CARD RECOLOURS WHOLE WHEN THE CHAPTER IS DONE (app. 06 rows 86, 87). A finished UNIT is
   pine; a finished CHAPTER is clay, and the mark, the title and the undo pill all move with the
   card — on the web that is four rules under `.lv-chapterdone`, and here it is one `ink`. */
const DoneCard = ({ ws, t, title, action, onAction, chapter }) => {
  const ink = chapter ? t.clay : t.pine_d;
  return (
    <View style={[ws.lv_donecard, chapter && ws.lv_chapterdone]}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={[ws.lv_donemark, { backgroundColor: chapter ? t.clay : "#2f7d54" }]}>
          <Text style={ws.lv_donemark_t}>✓</Text>
        </View>
        <Text style={[ws.lv_donetitle, { color: ink }]}>{title}</Text>
      </View>
      <Pressable onPress={onAction} hitSlop={6}
        style={[ws.lv_undo, { borderColor: chapter ? t.edge_clay : t.edge_green }]}>
        <Text style={[ws.lv_undo_t, { color: ink }]}>{action}</Text>
      </Pressable>
    </View>
  );
};

const s = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30 },   // main: 26px 18px 72px, minus the pinned block
  cell: { minWidth: 110 },
});
