/* ───────── My Lessons — the lesson library, one class at a time (Track D step 4b) ─────────
 *
 * A port of `web/app/components/MyLessonPlans.jsx`. A teacher comes here with ONE class in mind
 * ("what's left to prepare for VI Science"), so the screen scopes to a single subject·class and
 * gives the whole body to that list. It mirrors My Classes structurally: the paired switch at the
 * dash-title size, then Subject + Class as the two RollWheels (only what she teaches), pinned in a
 * frozen header while the list scrolls beneath. Cards reuse `sc_*` so the two screens read as one
 * family.
 *
 * Card colour = teaching lifecycle, lifted from section to lesson (the basis chosen 2026-07-03):
 *   · sage spine  — no section has taken this chapter yet ("ready to teach", on the shelf)
 *   · green       — ANY section is mid-chapter on it ("teaching now" wins — it's live)
 *   · clay        — every engaged section has finished and none is live
 * The status line is EXHAUSTIVE and single-colour: "Completed 6A, 6C · Teaching now 6B, 6D"
 * (completed first). No per-section drill-down here — that's the section card's job; tapping a
 * card opens the READ-ONLY lesson plan. Per-section state is read from the same server-backed
 * cache My Classes writes (readLocalSection), so the two screens always agree.
 *
 * ★ A LESSON PLAN IS A DOCUMENT, NOT A CLASS — PLAIN PAPER (founder, 2026-08-30). The two screens
 * shared one status palette, so a My Lessons card and a My Classes card were the same object to
 * the eye while affording different things. The PLANE now says what KIND of thing this is
 * (card_doc), and only the 4px spine says where it stands. Nothing is lost: the lesson card
 * already spells its status out in words, where the section card has no such line and colour is
 * its only carrier.
 *
 * Data: readiness stores subject as DISPLAY NAME ("Science") and class as UPPERCASE ROMAN ("VI");
 * the plans API uses SLUGS. We convert at the boundary. Section tags are already stored as "6A".
 *
 * ⚠️ FOUR THINGS THE WEB HAS HERE AND THIS DOES NOT YET, each named as CLAUDE.md §4 requires:
 *   1. The PROPOSED card — a lesson mid-prepare, drawn at full strength where the finished card
 *      will land. The prepare CTA below the list is LIVE as of step 5 and opens /prepare; the
 *      card is not, because the web's shell holds `preparing` across a tab switch and the phone's
 *      routes have no shell between them. The wait therefore happens on the prepare screen
 *      itself (the web's own `prep-wait` fallback, "for a caller that has nowhere to put one").
 *      A cross-route store is what moves it here, and is the next step rather than a redesign.
 *   2. The REPORTS modal and its card trigger. The web downloads a blob through an anchor with
 *      `download`; saving a file on a phone is expo-file-system + expo-sharing — a native
 *      dependency and a founder decision about where the document lands. The card still reserves
 *      the right column and the 82px floor (see `mlp2_cardpad`), so adding it later moves nothing.
 *   3. LAST YEAR'S FOLDERS (`.mlp-prior`). They hang off `yearInfo.prior_years`, and the phone
 *      does not read the year record yet — the same reason step 4a deferred the picker's
 *      `.ap-prior`. `notePlansYear` is likewise not called here, so the shared store is never told
 *      about a cutover from this surface; the web still tells it, and sign-out still clears it.
 *   4. The guided tour's steps 3–7. The tour is a web surface; there is no phone counterpart to
 *      drive.
 * Everything else — the paired switch, both wheels, the prepared filter, the archive (both
 * directions, verified), and the Year Plan pane — is here.
 *
 * Measures live in theme/web.js under `mlp2_*` / `sc_*` (§4 rule 2).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, Pressable, AppState, RefreshControl, StyleSheet } from "react-native";
import Svg, { Defs, Pattern, Path, Rect } from "react-native-svg";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../components/Text";
import {
  API, classNum, getJSON, getUser, pad, pretty, subjectSlug, userKey, withUser,
} from "@aruvi/shared/format";
import { storage } from "@aruvi/shared/storage";
import { cachedPlans, fetchPlans, invalidatePlans } from "@aruvi/shared/plans";
import { cachedReadiness, fetchReadiness } from "@aruvi/shared/readiness";
import { pullSectionState, readLocalSection } from "@aruvi/shared/sectionState";
import { verifiedWrite, planIsArchived } from "@aruvi/shared/verify";
import { endSession as endSessionShared } from "../../lib/session";
import Bar from "../../components/Bar";
import { RollWheel } from "../../components/RollWheel";
import YearPlan from "../../components/YearPlan";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";
import { type } from "../../theme/type";

const gradeSlug = (g) => (g || "").toLowerCase();
/* Display abbreviation for the compact Subject wheel: the full "The World Around Us" shows as
   "TWAU". Only the visible LABEL is shortened — the subject id/slug used everywhere else is the
   full name, so selection, plans and API calls are unaffected. */
const subjectLabel = (name) => (/world around us/i.test(name || "") ? "TWAU" : name);

/* Persist the chosen Subject + Class so the screen REMEMBERS where she was when she crosses to My
   Classes and back (she flips between the two to pick chapters — resetting to the first
   subject/class each time is exactly the annoyance to avoid). Scoped by user id, as the web's is,
   so one teacher's remembered pair never carries into another's session on a shared device. */
const lsGet = (k) => { try { return storage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { storage.setItem(k, v); } catch {} };

/* Line-icons, `currentColor` stroke on the web so they inherit the warm-paper palette; here the
   colour is passed in from the theme for the same reason. Paths are the web's, point for point. */
const ICON = { fill: "none", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
const ArchiveIcon = ({ size = 22, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...ICON}>
    <Rect x={3} y={4} width={18} height={4} rx={1} />
    <Path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <Path d="M10 12h4" />
  </Svg>
);
/* The SAME archive box, but OPEN — the lid swung a full 90° UP so it stands vertical, hinged at
   the box's back corner. Shown when you're inside the archive so the icon reads as "the box is
   open, you're in it"; tapping it closes it back to your lessons. */
const OpenArchiveIcon = ({ size = 22, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...ICON}>
    <Rect x={6.4} y={12} width={12.2} height={8} rx={1.4} />
    <Rect x={3.4} y={2.6} width={3.2} height={9.4} rx={1} />
    <Path d="M10.8 16h4" />
  </Svg>
);

export default function MyLessons() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  const LS_SUBJECT = userKey("mylessons_subject");
  const LS_CLASS = userKey("mylessons_class");

  /* ★ SEEDED SYNCHRONOUSLY FROM THE DEVICE COPY (founder, 2026-09-14). Her profile comes from
     the shared store, which holds it in module memory and on the device — so a returning teacher
     arrives with her wheels already populated and no round trip in front of them. On the web
     these two screens are COMPONENTS under one shell that fetched /readiness once; on the phone
     they are ROUTES that each asked for themselves, which is the whole of the difference she
     saw. The full account is in @aruvi/shared/readiness. */
  const [readiness, setReadiness] = useState(() => cachedReadiness());
  /* ★ "NOT ASKED YET" IS NOT "NOTHING THERE" (the live-walk finding, 2026-09-12). Without this
     flag the screen reads `subjects = []` while /readiness is still in flight and tells her "No
     subjects set up yet. Finish setup in My Classes" — a false statement about her own record.
     It now starts TRUE whenever the device already holds her profile: there is nothing to wait
     for, so there is nothing to say. */
  const [loaded, setLoaded] = useState(() => !!cachedReadiness());
  const [loadErr, setLoadErr] = useState("");
  const [plansByKey, setPlansByKey] = useState({});
  const [view, setView] = useState("active");       // active | archived — one list, a server flag
  /* Which pane is showing: the prepared-chapter card list ("lessons") or the whole-year "plan" —
     the same Subject·Class scope, two lenses.
     ★ NOT persisted (founder, 2026-08-29): every ordinary revisit of My Lessons opens on "Your
     lessons" — a teacher who checked the Year Plan yesterday should not find the repository
     hiding behind it today. The web's ONE exception is the budget pencil's round trip, and that
     pencil is step 5 here, so there is nothing yet to except. */
  const [pane, setPane] = useState("lessons");
  const [toast, setToast] = useState(null);         // { kind: "ok" | "block", text } | null
  const [tick, setTick] = useState(0);              // bumped after a section-state sync → re-read

  const subjects = useMemo(() => (readiness && readiness.subjects) || [], [readiness]);

  /* Subject in focus (by display name); class in focus (uppercase Roman). RESTORE the last choice;
     fall back to the first taught subject/class on a first ever visit. A stale saved class is
     harmless — the validation effect below snaps it back. */
  const [activeSubject, setActiveSubject] = useState("");
  const [activeGrade, setActiveGrade] = useState("");

  // True while a lesson is open over this screen — read by the section sync below.
  const busyRef = useRef(false);

  const endSession = useCallback(() => endSessionShared(router), [router]);

  const loadReadiness = useCallback(async ({ force = false } = {}) => {
    try {
      setReadiness(await fetchReadiness({ force }));
      setLoadErr("");
      setLoaded(true);
    } catch (e) {
      /* ★ A 401 is not "no profile" — the server REFUSED this session, and ending the session is
         one act whichever door it comes through (the rule My Classes states at length). An
         unreachable server is NOT a refusal and must never sign her out on a school network, so
         it only ever produces a message — and only when the screen had nothing to draw anyway. */
      if (String(e.message) === "401") { await endSession(); return; }
      if (!cachedReadiness()) setLoadErr("Couldn’t reach Meyy right now.");
      setLoaded(true);
    }
  }, [endSession]);

  useEffect(() => { loadReadiness(); }, [loadReadiness]);

  /* Seed the wheels from storage the first time subjects arrive, then keep both valid as the
     profile changes. The class is RESTRICTED to the classes she has enrolled for this subject, so
     a stale saved class — from a prior profile, another user on this device, or a deleted
     enrolment — must be snapped back to one she actually teaches, never left pointing at a class
     that is no longer hers. (The web carries the same effect and the same reason: prepared
     english/iii on disk, My Lessons opening on a stale Class 7 and reading "no lessons
     prepared".) */
  useEffect(() => {
    if (!subjects.length) return;
    const savedSub = lsGet(LS_SUBJECT);
    const s = subjects.find((x) => x.name === activeSubject)
      || (savedSub && subjects.find((x) => x.name === savedSub))
      || subjects[0];
    if (s.name !== activeSubject) {
      setActiveSubject(s.name); lsSet(LS_SUBJECT, s.name);
    }
    const taught = (s.grades || []).map((g) => g.grade);
    if (!taught.includes(activeGrade)) {
      const saved = lsGet(LS_CLASS);
      const g0 = (saved && taught.includes(saved) ? saved : taught[0]) || "";
      setActiveGrade(g0); lsSet(LS_CLASS, g0);
    }
  }, [subjects, activeSubject, activeGrade, LS_SUBJECT, LS_CLASS]);

  const current = subjects.find((s) => s.name === activeSubject) || subjects[0] || null;
  const grades = useMemo(() => (current && current.grades) || [], [current]);
  const taughtGradeObj = grades.find((g) => g.grade === activeGrade) || null;

  const sSlug = current ? subjectSlug(current.name) : "";
  const gSlug = gradeSlug(activeGrade);
  const key = sSlug && gSlug ? `${sSlug}/${gSlug}` : "";
  const plans = key ? plansByKey[key] : undefined;

  /* The saved plans for the scoped subject·class — from the SHARED STORE, not from here. One
     module-level copy per subject·class that My Classes and this screen share, a device copy read
     synchronously so the list paints before the network is consulted, and one revalidation per
     session per key. This screen remounts on every trip through the bottom bar; without the store
     each trip re-read a list that had not moved. */
  useEffect(() => {
    if (!key) return;
    const cached = cachedPlans(key);
    setPlansByKey((prev) => (key in prev && prev[key] ? prev : { ...prev, [key]: cached || undefined }));
    fetchPlans(key)
      .then((rows) => setPlansByKey((prev) => ({ ...prev, [key]: rows })))
      .catch(() => setPlansByKey((prev) => ({ ...prev, [key]: prev[key] || [] })));
  }, [key]);

  /* Reconcile this class's section teaching-state from the server into the local cache so the
     status lines match what she set on My Classes or another device. Re-syncs on load, when the
     app returns to the foreground, and on a light interval — the same pattern My Classes uses,
     with AppState standing in for the web's visibilitychange + focus pair. */
  useEffect(() => {
    const keys = (taughtGradeObj ? taughtGradeObj.sections || [] : [])
      .map((s) => `${sSlug}_${gSlug}_${s.tag}`).filter(Boolean);
    if (!keys.length) return;
    let live = true;
    /* Skipped while a plan is open so an in-flight read is never interrupted — this screen stays
       mounted behind the lesson route, so without the guard the 20s interval goes on pulling and
       re-rendering underneath her. The web holds the same guard on `openPlan`. */
    const sync = () => {
      if (!live || busyRef.current) return;
      pullSectionState(keys).then(() => { if (live) setTick((n) => n + 1); }).catch(() => {});
    };
    sync();
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") sync(); });
    const iv = setInterval(() => { if (AppState.currentState === "active") sync(); }, 20000);
    return () => { live = false; sub.remove(); clearInterval(iv); };
  }, [sSlug, gSlug, taughtGradeObj]);

  // Returning from a lesson: re-read the local section cache so the status lines are current.
  useFocusEffect(useCallback(() => { busyRef.current = false; setTick((n) => n + 1); }, []));

  const onSubject = (name) => {
    setActiveSubject(name); lsSet(LS_SUBJECT, name);
    const s = subjects.find((x) => x.name === name);
    const g = s && s.grades && s.grades[0] ? s.grades[0].grade : "";
    setActiveGrade(g); lsSet(LS_CLASS, g);
  };
  const onGrade = (g) => { setActiveGrade(g); lsSet(LS_CLASS, g); };

  /* READ-ONLY. The old "Attach to a class" CTA and its section chooser are RETIRED (2026-07-06):
     attaching happens ONLY via the "+" on a My Classes section card — one true way. Opening
     WITHOUT a section is exactly what `lesson.jsx` reads as preview. */
  const openLesson = (p) => {
    busyRef.current = true;
    router.push({ pathname: "/lesson", params: { subject: sSlug, grade: gSlug, filename: p.filename } });
  };

  /* Exhaustive per-section state for one chapter: which sections completed it, which are on it
     now. A section counts only if it is currently tracking THIS chapter. */
  const statusFor = (plan) => {
    const completed = [];
    const live = [];
    (taughtGradeObj ? taughtGradeObj.sections || [] : []).forEach((s) => {
      const st = readLocalSection(`${sSlug}_${gSlug}_${s.tag}`);
      if (st.chapter && st.chapter === plan.filename) (st.done ? completed : live).push(s.tag);
    });
    return { completed, live };
  };
  /* A plan is "attached" if any section is teaching or has completed it — the same signal that
     colours the card. Attached plans are BLOCKED from archiving (she would lose the class's
     pointer), so the archive control is simply absent for them: attachment removes the
     affordance rather than warning about it. */
  const isAttached = (plan) => {
    const { completed, live } = statusFor(plan);
    return completed.length > 0 || live.length > 0;
  };

  // Flip a plan's archived flag locally (optimistic) so it moves between the two views at once.
  const setArchivedFlag = (filename, val) => {
    setPlansByKey((prev) => {
      const arr = prev[key];
      if (!Array.isArray(arr)) return prev;
      return {
        ...prev,
        [key]: arr.map((p) => (p.filename === filename
          ? { ...p, archived: val, archived_at: val ? new Date().toISOString() : null }
          : p)),
      };
    });
  };

  const body = (p) => ({ subject: sSlug, grade: gSlug, filename: p.filename });

  /* One verifier for both directions — archive and restore are the same fact inverted. On a
     verified mismatch the optimistic flag is put back to the truth and she is told; on
     "unverified" nothing is said and nothing is reverted, because we do not know that it failed.
     READ-AFTER-WRITE: a throw is not the criterion — the archive may have landed with the
     response lost. Y = "this plan IS in the archive"; Y′ = GET /plan-archive. */
  const verifyArchive = (p, want, doWrite) => {
    verifiedWrite({
      write: doWrite,
      read: () => getJSON("/plan-archive").then((d) => (d && (d.archived || d.plans)) || d || {}),
      expect: (y) => planIsArchived(y, sSlug, gSlug, p.filename) === want,
    }).then(({ status }) => {
      /* ★ ARCHIVING MOVES HER FLAGS TOO (2026-09-14) — the listing carries `archived` per
         teacher, so an archive that does not invalidate leaves the store holding the pre-archive
         truth, and `fetchPlans` answers a `fresh` entry without asking the server. The card comes
         back on the next read. Invalidated once the write is SETTLED (verifiedWrite has resolved),
         never beside the optimistic flip: an earlier invalidation races the POST and a read that
         overtook it would pull the old truth back over the new flag. On a mismatch the flag is
         put back below, so cache and screen agree either way. The twin note in the web's
         MyLessonPlans says the same. */
      invalidatePlans(key);
      if (status !== "mismatch") return;
      setArchivedFlag(p.filename, !want);
      setToast({
        kind: "block",
        text: want ? "That didn’t archive — it’s still in your lessons."
                   : "That didn’t restore — it’s still archived.",
      });
    }).catch(() => {});
  };

  const archivePlan = (p) => {
    if (isAttached(p)) return;   // safety only — the icon is never rendered for an attached plan
    setArchivedFlag(p.filename, true);
    setToast({ kind: "ok", text: "Moved to Archive — find it in the box above." });
    verifyArchive(p, true, () => fetch(`${API}/plan-archive`, withUser({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body(p)),
    })).then((r) => { if (!r.ok) throw new Error(); }));
  };

  const restorePlan = (p) => {
    setArchivedFlag(p.filename, false);
    setToast({ kind: "ok", text: "Restored to your lessons." });
    verifyArchive(p, false, () => fetch(`${API}/plan-archive`, withUser({
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body(p)),
    })).then((r) => { if (!r.ok) throw new Error(); }));
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  /* ── the two lists ─────────────────────────────────────────────────────────────────
     My Lessons shows ONLY what this teacher has prepared — never the whole shared sample library.
     The server sets `prepared` per tenant; a plan any section is attached to counts as prepared
     too, so a lesson a class is actively teaching can never vanish even if its prepared write was
     lost.
     ★ THIS YEAR'S LIST HOLDS THIS YEAR'S WORK ONLY (founder, 2026-08-26). A plan carrying
     `prepared_source_year` but NOT `prepared` was prepared in a past year: her section card still
     shows it (stamped) and the web's folder still holds it, so nothing becomes unreachable — it
     simply stops pretending to be current. Getting this wrong in either direction is visible: too
     loose and last year's shelf floods the list; too tight and a chapter she is actively teaching
     disappears from My Lessons altogether.
     ── NEWEST PREPARED FIRST (founder, 2026-08-06). GET /plans hands back library order, which put
     a freshly prepared lesson wherever its chapter number fell — usually the bottom of a long
     list. The one card she is certain to want next is the one she just made. The fallback keeps
     the order STABLE rather than arbitrary when the stamp is missing or tied. */
  const byRecency = (a, b) => {
    const at = String(a.prepared_at || ""), bt = String(b.prepared_at || "");
    if (at !== bt) return bt.localeCompare(at);      // ISO strings sort lexically
    return (Number(a.chapter_number) || 0) - (Number(b.chapter_number) || 0);
  };
  const preparedPlans = (Array.isArray(plans) ? plans : [])
    .filter((p) => (p.prepared || isAttached(p)) && !(p.prepared_source_year && !p.prepared))
    .slice()
    .sort(byRecency);
  const activePlans = preparedPlans.filter((p) => !p.archived);
  const archivedPlans = preparedPlans.filter((p) => p.archived);
  const hasArchived = archivedPlans.length > 0;
  const effView = hasArchived ? view : "active";     // auto-fall-back when nothing's archived
  const shown = effView === "archived" ? archivedPlans : activePlans;

  /* Subject filter, alphabetical by LABEL (profile order is arbitrary — a stable A–Z list is
     easier to scan). Copy before sort so the source order is untouched. */
  const subjectItems = useMemo(() => subjects
    .map((s) => ({ id: s.name, label: subjectLabel(s.name) }))
    .sort((a, b) => a.label.localeCompare(b.label)), [subjects]);
  /* ONLY the classes she has enrolled for this subject, low to high — never the content superset.
     The teacher's word is "Class", shown as a plain number: never "Grade", never Roman. */
  /* ★ MEMOISED — RollWheel reparks the box on `[items]`, so a freshly built array (a new
     identity every render) made that effect fire on every render, including the one `stepCycle`
     causes when it commits the pick before animating, cancelling the ▼'s roll. The web carries
     the same fix and the fuller note. */
  const gradeItems = useMemo(() => grades
    .map((g) => g.grade)
    .sort((a, b) => classNum(a) - classNum(b))
    .map((g) => ({ id: g, label: `${classNum(g)}` })), [grades]);

  const insets = useSafeAreaInsets();

  /* The frozen header is drawn ONLY when there are wheels to put in it. The web returns before
     rendering anything at all in these two states, and a switch with two empty wheel boxes above
     "No subjects set up yet" is worse than the sentence alone. */
  const bare = (msg, style) => (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar user={getUser()} />
      <View style={ws.main}><Text style={style}>{msg}</Text></View>
    </View>
  );
  if (loadErr && !current) return bare(loadErr, [type.body, { color: t.danger }]);
  if (!loaded) return bare("Loading your lessons…", ws.mlp2_loading);
  if (!current) {
    return bare("No subjects set up yet. Finish setup in My Classes to see your lessons here.",
      ws.mlp2_emptybody);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar user={getUser()} />
      {/* ★ THE HEADER STARTS A ROW DOWN FROM THE BAR (founder, 2026-09-14). The switch was
          sitting almost ON the bar: `.mlp2-frozen`'s own 6px is all it has, and on the web that
          6px is measured from the top of `main`, which already opens with 26px of page padding
          (`ws.main.paddingTop`). Here the header lives OUTSIDE the scroller — that is what makes
          it frozen without a sticky — so it took none of `main`'s padding with it and the 6px
          was the whole gap. My Classes has the same shape and the same 26 above its greeting;
          this is the row that was missing, not a new one. */}
      <View style={{ paddingHorizontal: 18, paddingTop: 26 }}>
        {/* ── the frozen header ──
            The web pins this with `position: sticky` at the top of the one scroll region; here it
            sits ABOVE the scroller, which is the same thing on a screen that owns its own scroll
            region — the pattern My Classes' greeting already uses. */}
        <View style={[ws.mlp2_frozen, { borderBottomColor: t.line }]}>
          <View style={ws.mlp2_titlerow}>
            {/* ★ THE TWO WORDS ARE PAIRED (founder, 2026-09-13). They used to hold opposite ends
                of the row with the archive box between them, and a word alone at the far end
                reads as a HEADING for whatever sits under it, not as the other half of a choice.
                ADJACENCY is what makes two words read as a switch, so they sit together behind a
                hairline "/" and the archive box takes the right end. Words, not tabs: no boxes,
                no chrome — the title itself IS the switch, and only the live one is inked and
                ruled in clay. */}
            <View style={ws.mlp2_titleleft}>
              <Pressable onPress={() => pane !== "lessons" && setPane("lessons")}
                accessibilityRole="tab" accessibilityState={{ selected: pane === "lessons" }}>
                <Text style={[ws.mlp2_vtab, pane === "lessons" && ws.mlp2_vtab_on]}>
                  {pane === "lessons" && effView === "archived" ? "Archive" : "Your lessons"}
                </Text>
              </Pressable>
              {/* Decorative: the two buttons carry the semantics. */}
              <Text style={ws.mlp2_vsep} accessibilityElementsHidden importantForAccessibility="no">/</Text>
              <Pressable onPress={() => pane !== "plan" && setPane("plan")}
                accessibilityRole="tab" accessibilityState={{ selected: pane === "plan" }}>
                <Text style={[ws.mlp2_vtab, pane === "plan" && ws.mlp2_vtab_on]}>Year plan</Text>
              </Pressable>
            </View>
            {/* The archive box is a sub-state of the LESSONS pane, so it renders only while that
                pane is live. Open box = you are inside the archive; tapping it closes the box and
                drops you back to your lessons — the one, symmetric way in and out. */}
            {pane !== "lessons" ? null : effView === "archived" ? (
              <Pressable onPress={() => setView("active")} accessibilityRole="button"
                accessibilityLabel="Close archive, back to your lessons"
                style={[ws.mlp2_archfolder, { borderColor: t.pine, backgroundColor: t.tint_pine }]}>
                <OpenArchiveIcon color={t.pine} />
                <Text style={[ws.mlp2_archcount, { color: t.pine }]}>{archivedPlans.length}</Text>
              </Pressable>
            ) : hasArchived ? (
              <Pressable onPress={() => setView("archived")} accessibilityRole="button"
                accessibilityLabel={`Open archive (${archivedPlans.length})`}
                style={ws.mlp2_archfolder}>
                <ArchiveIcon color={t.ink_soft} />
                <Text style={ws.mlp2_archcount}>{archivedPlans.length}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Subject box wider than Class at 2:1 — Subject gains a third of its width, taken from
              Class. A single-option axis renders STATIC, at the wheel's exact footprint so the two
              boxes are never uneven. */}
          <View style={ws.mlp2_wheels}>
            <View style={ws.mlp2_wcol_s}>
              {subjectItems.length > 1 ? (
                <RollWheel items={subjectItems} value={activeSubject} onChange={onSubject}
                  ariaLabel="Subject" rowPx={72} padLeft={16} peek />
              ) : (
                <View style={ws.mlp2_static}>
                  <Text style={ws.mlp2_static_t} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {current ? subjectLabel(current.name) : ""}
                  </Text>
                </View>
              )}
            </View>
            <View style={ws.mlp2_wcol_g}>
              {gradeItems.length > 1 ? (
                /* Class wheel: short numbers, nudged LEFT (not hard against the edge) — an
                   inset-left position keeps the number visible beside the rolling thumb instead
                   of under it. */
                <RollWheel items={gradeItems} value={activeGrade} onChange={onGrade}
                  ariaLabel="Class" rowPx={72} padLeft={28} peek />
              ) : (
                <View style={ws.mlp2_static}>
                  <Text style={ws.mlp2_static_t}>Class {classNum(activeGrade)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[ws.main, { paddingTop: 0 }]}
        /* Pull-to-refresh is her own "check again": `force` re-reads but KEEPS the ETag, so a
           listing that has not moved costs a 304 rather than a full payload. Invalidating here
           instead would throw the ETag away and buy the whole body every time — the opposite of
           what the store is for. My Classes refreshes the same way. */
        refreshControl={<RefreshControl refreshing={false} tintColor={t.pine} onRefresh={() => {
          loadReadiness({ force: true });
          if (key) fetchPlans(key, { force: true })
            .then((rows) => setPlansByKey((prev) => ({ ...prev, [key]: rows })))
            .catch(() => {});
        }} />}>

        {pane === "plan" ? (
          <YearPlan subjectName={current.name} sSlug={sSlug} gSlug={gSlug} readiness={readiness} />
        ) : plans === undefined ? (
          <Text style={ws.mlp2_loading}>Loading plans…</Text>
        ) : shown.length === 0 ? (
          <Text style={ws.mlp2_emptybody}>
            {effView === "archived"
              ? "Nothing archived here."
              : hasArchived
                ? `Every prepared lesson for ${pretty(sSlug)} · Class ${classNum(activeGrade)} is archived.`
                : `There are no lesson plans prepared for ${pretty(sSlug)} · Class ${classNum(activeGrade)} yet.`}
          </Text>
        ) : (
          <View style={ws.sc_list}>
            {shown.map((p) => (
              <PlanCard key={p.filename} p={p} archived={effView === "archived"}
                status={statusFor(p)} attached={isAttached(p)}
                onOpen={() => openLesson(p)}
                onArchive={() => archivePlan(p)} onRestore={() => restorePlan(p)} />
            ))}
          </View>
        )}

        {/* ── "Need a chapter you don't have yet?" ──
            ⚠️ LAPSED HIDES IT ENTIRELY (§2.5 as amended, founder 2026-08-24): My Lessons becomes
            the reading room — open, export, print — and renewal is offered in Settings, never
            pushed here. The phone does not read entitlement on this screen yet, so the bar shows
            for everyone for now; when Settings lands (step 6) this takes the same `lapsed` flag
            the web's does. Only in the lessons pane, and never over the archive. */}
        {!loadErr && current && pane === "lessons" && effView !== "archived" && plans !== undefined ? (
          <View style={[ws.mlp_allocate, { backgroundColor: t.paper, borderColor: t.line }]}>
            <Text style={ws.mlp_allocate_q}>Need a chapter you don’t have yet?</Text>
            <Pressable accessibilityRole="button" style={[ws.mlp_allocate_btn, { backgroundColor: t.pine }]}
              onPress={() => router.push({ pathname: "/prepare", params: { subject: sSlug, grade: gSlug } })}>
              <Text style={ws.mlp_allocate_t}>Prepare a new lesson →</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Transient confirmation / block message — bottom-centre, non-blocking, auto-dismissed.
          It sits clear of the bottom bar rather than under it. */}
      {toast ? (
        <View style={[ws.mlp2_toast, {
          bottom: 56.85 + insets.bottom + 16,
          backgroundColor: toast.kind === "block" ? t.clay : t.ink,
          borderColor: toast.kind === "block" ? t.clay : t.line,
        }]} accessibilityLiveRegion="polite">
          <Text style={[ws.mlp2_toast_t, { color: t.paper }]}>{toast.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ───────── The constant graph rule ─────────
 * The same 11px rule on every card whatever its state — a MATERIAL, not a code: because it never
 * varies it carries no meaning, needs no legend, and cannot compete with the status colours.
 * ⚠️ It belongs HERE because the web puts it on the `.sc-card` BASE rule (two repeating
 * linear-gradients, globals.css ~2577), and My Lessons' document plane overrides only
 * `background-color` — so these cards inherit the rule on the web and were the one place on the
 * phone without it. Identical to My Classes' copy: RN has no repeating gradient, so it is an SVG
 * <Pattern> — a true tile, not an approximation — with the line on the TOP and LEFT edge of each
 * 11px cell, as the web's gradients are. The weight lives in ONE place, --card-grid.
 * The pattern id is scoped to this file: two <Defs> sharing an id in one tree is undefined, and
 * My Classes already owns "sc-grid". */
function CardGrid({ color }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="mlp-grid" width={11} height={11} patternUnits="userSpaceOnUse">
          <Path d="M0 0.5 H11 M0.5 0 V11" stroke={color} strokeWidth={1} fill="none" />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#mlp-grid)" />
    </Svg>
  );
}

/* ───────── ONE lesson card ─────────
 * The `.sc-card` the section list uses, on the DOCUMENT plane: only the 4px spine carries the
 * lifecycle (sage on the shelf · pine teaching now · clay all done), and the status line spells
 * it out in words underneath. The archive icon sits top-right, absolutely placed so it never
 * reflows the title, and the card reserves the right column and a three-row floor for it.
 *
 * ⚠️ The tappable area is the tag + body, NOT the whole card — the archive icon sits OUTSIDE it.
 * The web nests a <button> in a clickable <div> and calls stopPropagation; react-native-web
 * renders a role="button" Pressable as a real <button>, and a nested button is invalid (it warns,
 * and the inner press is unreliable). The row is split instead: identical on screen, and the
 * action simply is not inside the card's press target — which is what stopPropagation was
 * simulating. Same divergence, same reason, as the section card's (step 4a).
 */
function PlanCard({ p, archived, status, attached, onOpen, onArchive, onRestore }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const { completed, live } = status;
  const spine = archived ? t.edge
    : live.length ? t.pine
    : completed.length ? t.clay
    : t.spine_shelf;
  const fill = archived ? t.paper_sunk : t.card_doc;
  const edge = archived ? t.line_soft : t.card_doc_edge;
  const stamp = p.lp_year_display || p.prepared_source_year;

  return (
    <View style={[ws.sc_card, !archived && ws.mlp2_cardpad,
      { backgroundColor: fill, borderColor: edge }]}>
      <CardGrid color={t.card_grid} />
      <View style={[ws.sc_spine, { backgroundColor: spine }]} />
      <Pressable onPress={onOpen} accessibilityRole="button"
        accessibilityLabel={`Open ${p.chapter_title}`}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", columnGap: 13 }}>
        <Text style={ws.sc_tag}>{pad(p.chapter_number)}</Text>
        <View style={ws.sc_body}>
          {/* Two lines, because `.sc-title` clamps to two in CSS (-webkit-line-clamp, globals.css
              2614) — the JSX just doesn't say so. numberOfLines is RN's equivalent. */}
          <Text style={[ws.sc_title, archived && { color: t.ink_soft }]} numberOfLines={2}>
            {p.chapter_title}
          </Text>
          {/* ★ ONE META ROW, not two stacked lines (founder, 2026-08-27). The matrix and the year
              stamp are both small-print provenance and each was taking a full line of a compact
              card. Side by side they read as the one thing they are — which version of this
              chapter she holds. EVERY plan carries its matrix, library canonicals included: ch 3
              is {12, 9, 7} and three cards reading only "Atmosphere and Climate" are
              indistinguishable. */}
          {p.duration_label || stamp ? (
            <View style={ws.sc_metarow}>
              {p.duration_label ? (
                <Text style={[ws.sc_durline, ws.sc_metarow_item]}>{p.duration_label}</Text>
              ) : null}
              {stamp ? (
                <Text style={[ws.sc_yearstamp, ws.sc_metarow_item]}>{stamp} version</Text>
              ) : null}
            </View>
          ) : null}
          {archived ? (
            <Text style={ws.mlp2_ready}>Archived</Text>
          ) : completed.length || live.length ? (
            /* EXHAUSTIVE and single-colour, completed first. */
            <View style={ws.mlp2_status}>
              {completed.length > 0 ? (
                <Text style={ws.mlp2_status_t}>Completed {completed.join(", ")}</Text>
              ) : null}
              {completed.length > 0 && live.length > 0 ? (
                <Text style={[ws.mlp2_status_t, ws.mlp2_status_sep]}>·</Text>
              ) : null}
              {live.length > 0 ? (
                <Text style={ws.mlp2_status_t}>Teaching now {live.join(", ")}</Text>
              ) : null}
            </View>
          ) : (
            <Text style={ws.mlp2_ready}>Ready to teach</Text>
          )}
        </View>
      </Pressable>

      {archived ? (
        <Pressable onPress={onRestore} accessibilityRole="button"
          accessibilityLabel={`Restore ${p.chapter_title}`}
          style={[ws.mlp2_restore, { backgroundColor: t.pine, borderColor: t.pine }]}>
          <Text style={[ws.mlp2_restore_t, { color: t.paper }]}>Restore</Text>
        </Pressable>
      ) : !attached ? (
        <Pressable onPress={onArchive} accessibilityRole="button" hitSlop={6}
          accessibilityLabel={`Archive ${p.chapter_title}`} style={ws.mlp2_iconbtn}>
          <ArchiveIcon size={18} color={t.ink_soft} />
        </Pressable>
      ) : null}
    </View>
  );
}
