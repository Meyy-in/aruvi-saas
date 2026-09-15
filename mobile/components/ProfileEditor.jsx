/* ───────── the teaching profile, one edit at a time (Track D step 5c/5d) ─────────
 *
 * ★ IT IS A WINDOW, NOT A SCREEN (founder, 2026-09-15: "ADD opens a window but individual changes
 * — sections/class/week — open full screen both on web and expo. Suggest the changes also be
 * contained in a window"). The journey used to start in a window and then throw her onto a full
 * page for what is meant to be ONE small change, which is a context switch the change does not
 * deserve. Now the edit floats over whatever she was looking at, so "each item changes only
 * itself" is true of the NAVIGATION as well as of the record.
 *   ⚠️ And it deleted a whole mechanism rather than adding one: `lib/paneIntent` existed to put
 *   her back on the Year Plan pane after the editor navigated her away from it. She is not
 *   navigated away any more, so the round trip — and the one-shot stamp that made it work — is
 *   simply gone.
 *   ⚠️ The window must be able to hold a 260px wheel, which is what `Sheet`'s `scroll` prop and
 *   its 82% cap are for. Before this the phone's window had NO height cap at all, because nothing
 *   tall had ever been put in one.
 *
 * ★ ONE COMPONENT, MANY INTENTS — the shape the web itself arrived at. `TeachingProfile.jsx` is
 * 1,700 lines because it is a dozen screens under one roof, reached by `portalIntent`; every
 * spot edit she can make (a class, a section, periods a week, the period lengths, the annual
 * budget) is the SAME journey with a different destination. The phone takes that structure rather
 * than a component per edit: a component per edit would have meant a save path, a scope resolver
 * and an exit rule copied five times.
 *
 * It serves THREE steps today — `budget`, `ppw` and `duration` — the web's `editNums` screen
 * whole. `intent` picks the one she lands on; inside, they are one journey, because they are one
 * teacher's answer looked at from three sides. 5d's `section` and `class` intents land here next.
 *
 * ★ ONE INPUT, BECAUSE SHE IS DISAGREEING, NOT BUILDING (founder, 2026-08-27). There used to be
 * four ways to construct the figure — teaching weeks · period count · working days · estimate —
 * and they existed because Aruvi could not tell her what her year should be. The calibrated
 * master plan ended that: Aruvi says 245 for social_sciences·ix, and she is answering "I say
 * 215". That is one number. The full account, and the four shapes the READER still understands,
 * are in @aruvi/shared/budget.
 *
 * ★ THE WEEKS LINE IS THE REASON THE OTHER THREE COULD GO. It gives her the weeks those methods
 * were clumsily trying to provide, without a second input to contradict the first: she types 215,
 * Aruvi says "27 weeks (@ 8 periods/week)", and she can tell at once whether that is her year.
 * A READING, not a sentence (founder, 2026-08-28) — it sits in the small mono of a caption
 * directly under the figure it describes. Aruvi adjusts NOTHING on her behalf.
 *
 * ★ AND SAVE SITS WELL CLEAR OF IT (same day): 88px of air above the footer, because the gap is
 * what separates "what I am being told" from "what I am about to do".
 *
 * ★ THE SENSE-CHECK PENCIL NOW LEADS SOMEWHERE — Q1 CLOSED (founder, 2026-09-15). Asked whether
 * to ship the budget screen with a dead pencil as a named divergence or hold until the ppw editor
 * existed, the founder chose HOLD. This is that editor, so the pencil below the weeks line goes
 * to `ppw` → `duration` and back, and the Year Plan's own pencil lights with it.
 *
 * ★ AND THE PENCIL STAYS INSIDE THIS EDITOR. She is one step from the wheel, and coming back
 * lands her on the budget screen with her figure intact — the round trip is a detour within one
 * answer, not a journey out of it.
 *
 * ★ THE WEEK IS ASKED BEFORE THE LENGTHS, AND THAT ORDER IS THE POINT (founder, 2026-07-26). She
 * states the SIZE of her week once, unattached to any period length; the duration question then
 * carries the split inline as a second column, so there is no third screen. Because the week is
 * stated first, the anchor is simply the lowest length she ticks and "which length owns the week?"
 * never has to be asked. The weekly total is INVARIANT under every duration change — naming a
 * second length tells us how her same week is split, not that she gained a class.
 *
 * ★ CLOSING RESTORES THE PORTAL WINDOW SHE CAME FROM, on save AND on cancel alike — "a teacher
 * who has just amended one item is exactly the person most likely to want the next" (founder,
 * 2026-08-27). Closing that window stays her own explicit act.
 */
import { useEffect, useMemo, useState } from "react";
import { View, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "./Text";
import {
  ROMAN, classNum, fetchSupportedGrades, getJSON, ppwFromAnnual, pretty, subjectSlug,
  weeksFromAnnual,
} from "@aruvi/shared/format";
import { normalizeBudget, setGradeBudget, gradeBudgetRecord, clampPeriods } from "@aruvi/shared/budget";
import {
  gradeDraftFrom, setGradeNumbers, secLetter, secObj, secSummary, namesFromSections,
} from "@aruvi/shared/profile";
import { clearSectionState } from "@aruvi/shared/sectionState";
import {
  DEFAULT_DURATION, DEFAULT_PPW, DURATION_CHOICES, PPW_CHOICES, lowestDuration, normPpw,
  ppwMapSum, setPpwSplit, setPpwTotal,
} from "@aruvi/shared/ppw";
import { rekeyBudget } from "@aruvi/shared/budget";
import { cachedReadiness, fetchReadiness, saveReadiness } from "@aruvi/shared/readiness";
import { closeEdit } from "../lib/portal";
import { RollWheel } from "./RollWheel";
import PickWheel from "./PickWheel";
import PpwSplitCell from "./PpwSplitCell";
import SecNameCell from "./SecNameCell";
import { Sheet } from "./AttachSheet";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

const SECTION_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A…Z

export default function ProfileEditor({ intent = "budget", subject = "", grade = "" }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  /* `intent` is the destination; `subject`/`grade` the scope it acts on. The web resolves a scope
     through two pick screens when it is ambiguous — the Year Plan's pencil is the opposite case,
     "she is standing on Class 7's year plan", so it passes `exact` and both pick screens are
     skipped (`portalGradeIdxs`, 5d row 21). An unrecognised intent is treated as `budget`. */

  /* Seeded synchronously from the device copy, like every other screen on this app: her profile
     is already in module memory, so the figure is on screen before any network is consulted. */
  const [readiness, setReadiness] = useState(() => cachedReadiness());
  const [recTotal, setRecTotal] = useState(null);   // Aruvi's calibrated annual periods
  const [ncfTotal, setNcfTotal] = useState(null);   // the published NCF norm
  const [value, setValue] = useState(null);         // null until the record is normalized
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  /* Which of the three she is looking at. Seeded from the route and then owned here, because the
     pencil and ← Back move BETWEEN steps without leaving the screen — they are one answer. */
  const [step, setStep] = useState(() => (["budget", "ppw", "duration", "section", "class"].includes(String(intent))
    ? String(intent) : "budget"));
  /* The working copy of this class's weekly numbers. `gradeDraftFrom` is the web's own seeder, so
     the record she edits is shaped exactly as the web shapes it — which is what stops a phone save
     reading back as a mismatch (see @aruvi/shared/profile). Null until her record arrives. */
  const [draft, setDraft] = useState(null);

  useEffect(() => { fetchReadiness().then(setReadiness).catch(() => {}); }, []);

  const subjects = useMemo(() => (readiness && readiness.subjects) || [], [readiness]);
  const subjectRec = useMemo(
    () => subjects.find((x) => x.name === subject) || null, [subjects, subject]);
  const gradeRec = useMemo(() => {
    const sub = subjects.find((s) => s.name === subject);
    const want = String(grade || "").toLowerCase();
    return (sub && (sub.grades || []).find((g) => (g.grade || "").toLowerCase() === want)) || null;
  }, [subjects, subject, grade]);
  useEffect(() => { if (!draft && gradeRec) setDraft(gradeDraftFrom(gradeRec)); }, [gradeRec, draft]);

  /* ── the section editor's own working copy ──
     Letters she has ticked, and her display names for them keyed by LETTER. Seeded from the record
     once it arrives; `null` until then so the wheel does not open on an empty selection and then
     jump. */
  const [picked, setPicked] = useState(null);
  const [secNames, setSecNames] = useState({});
  const [secConfirm, setSecConfirm] = useState(null);
  /* ── the class editor's working copy ──
     Roman classes she has ticked, and the catalogue Meyy actually has content for. The catalogue
     is fetched, not assumed: offering a class with no chapters behind it is a promise Meyy cannot
     keep, and `fetchSupportedGrades` is the one authority both surfaces use. */
  const [pickedGrades, setPickedGrades] = useState(null);
  const [gradeOptions, setGradeOptions] = useState(null);   // null = still loading
  const [classConfirm, setClassConfirm] = useState(null);
  /* Which length's split strip is showing, if any. Lifted OUT of the cell (2026-09-15): the cell
     used to own a Sheet, and once the editor became a window that was a window over a window. */
  const [splitOpen, setSplitOpen] = useState(null);
  useEffect(() => {
    if (picked || !gradeRec) return;
    setPicked((gradeRec.sections || []).map(secLetter));
    setSecNames(namesFromSections(gradeRec.sections));
  }, [gradeRec, picked]);

  /* ── her week, as the two number steps see it ───────────────────────────────────────
     ⚠️ The anchor here is `lowestDuration`, NOT the stored `ppw_anchor`, and the web says why:
     this screen is only ever reached THROUGH the weekly total, so she has just restated the size
     of her week and the anchor is simply the shortest length she ticks. The stored-anchor
     exception exists for editing lengths WITHOUT restating the total, and there is no longer a
     door that does that. */
  const durations = (draft && draft.durations) || [];
  const anchor = durations.length ? lowestDuration(durations) : null;
  const splitMap = useMemo(
    () => (draft ? normPpw(durations, draft.ppw_by_duration, draft.periods_per_week, anchor) : {}),
    [draft, durations, anchor]);
  const weekTotal = ppwMapSum(splitMap);
  const multi = durations.length > 1;

  /* The budget step reads the week from the DRAFT, so a ppw change she has just made is already
     reflected in the sense-check when the pencil brings her back — which is the entire reason the
     pencil goes there and returns rather than leaving. */
  const ppw = weekTotal || (gradeRec && gradeRec.periods_per_week) || DEFAULT_PPW;

  // Aruvi's own recommendation for this subject·class — the figure she is invited to disagree with.
  useEffect(() => {
    if (!subject || !grade) return;
    let live = true;
    setRecTotal(null); setNcfTotal(null);
    getJSON(`/subjects/${subjectSlug(subject)}/${String(grade).toLowerCase()}/ncf-periods`)
      .then((d) => {
        if (!live || !d) return;
        setNcfTotal(d.ncf_total_periods != null ? d.ncf_total_periods : null);
        setRecTotal(d.recommended_total_periods != null ? d.recommended_total_periods : null);
      })
      .catch(() => { if (live) { setNcfTotal(null); setRecTotal(null); } });
    return () => { live = false; };
  }, [subject, grade]);

  /* ★ THE FIELD OPENS ON THE YEAR SHE ALREADY HAS, whatever shape it is stored in — that is the
     whole of `normalizeBudget`, and the conversion the old four-method `setMethod` never did (it
     replaced the value with a fresh default, which is how a calibrated 245 silently became 180).
     Seeded ONCE the record and the recommendation are both in: seeding earlier would open her on
     the ppw estimate and then jump under her when the calibrated figure arrived. */
  useEffect(() => {
    if (value != null || !gradeRec) return;
    const stored = gradeBudgetRecord(subjects, subject, grade);
    const hasChoice = stored && !(stored.method === "auto" && !stored.value);
    if (!hasChoice && recTotal == null) return;    // wait for Aruvi's figure to lead
    setValue(normalizeBudget(stored, ppw, recTotal).value);
  }, [gradeRec, subjects, subject, grade, ppw, recTotal, value]);

  const weeks = weeksFromAnnual(value, ppw);
  const recLine = recTotal != null
    /* ★ "based on general norms" (founder, 2026-08-28) — the figure is a calibrated standard for
       the CLASS, not a reading of HER year, and the line has to say so: she is being invited to
       disagree with it, which she cannot do if it sounds like a fact about her. */
    ? `Meyy recommends ${recTotal} periods a year based on general norms for this class.`
      + (ncfTotal != null && ncfTotal !== recTotal ? ` (NCF norm: ${ncfTotal})` : "")
    : ncfTotal != null ? `As per NCF, this class requires ${ncfTotal} periods.` : null;

  /* ★ NOTHING NAVIGATES ANY MORE. The editor is a window over the screen she was already on, so
     leaving it is closing it — and the portal window she opened it from comes back, on save and
     on cancel alike. The Year Plan's pane round trip is gone with the navigation that made it
     necessary: she never left the pane. */
  const leave = () => closeEdit();

  /* ── SAVE ────────────────────────────────────────────────────────────────────────────
     The write itself is `saveReadiness` (@aruvi/shared/readiness), which owns the whole
     read-after-write doctrine — the POST throwing is not failure, an unreachable server is not
     failure, and only a verified MISMATCH is. Its three outcomes map onto exactly two things
     this screen does: leave, or stay and say so.
     ★ AND ON A MISMATCH SHE STAYS, LOOKING AT THE SERVER'S COPY. Sending her back to the Year
     Plan with a banner would put the message on one screen and the wrong number on another;
     the store has already adopted the server's array, so re-seeding the field from it is what
     makes the banner's sentence literally true of what she is reading. */
  const commit = (next, onMismatch) => {
    setSaving(true); setErr("");
    saveReadiness(next).then(({ status, profile }) => {
      setSaving(false);
      setReadiness(profile);
      if (status !== "mismatch") { leave(); return; }
      onMismatch();
      setErr("That change didn’t save — this is your teaching profile as it stands.");
    }).catch(() => { setSaving(false); leave(); });
  };

  const save = () => {
    if (saving || value == null) return;
    commit(setGradeBudget(subjects, subject, grade, value),
      () => setValue(null));        // re-seeds from the adopted server copy
  };

  /* ★ THE LENGTHS AND THEIR SPLIT SAVE TOGETHER, from the duration step — that is why there is no
     Save on the periods-a-week step, only Continue. The size of a week and its division are ONE
     answer, and a teacher who set 8 and walked away having never named a length would have left
     the record saying something she was not asked. */
  const saveNumbers = () => {
    if (saving || !draft) return;
    commit(setGradeNumbers(subjects, subject, grade, {
      durations, ppw_by_duration: splitMap, ppw_anchor: anchor,
    }), () => { setDraft(null); setStep("ppw"); });
  };

  /* ── CLASSES ─────────────────────────────────────────────────────────────────────────
     Seeded once her record and the catalogue are both in. Every enrolled class is pre-ticked,
     INCLUDING any the catalogue no longer lists: removals are read off `pickedGrades`, so a class
     missing from the options must never be readable as an unticking. */
  useEffect(() => {
    if (step !== "class" || !subject) return;
    let live = true;
    fetchSupportedGrades(subject)
      .then((g) => { if (live) setGradeOptions(g || []); })
      .catch(() => { if (live) setGradeOptions([]); });
    return () => { live = false; };
  }, [step, subject]);
  useEffect(() => {
    if (pickedGrades || !subjectRec) return;
    setPickedGrades((subjectRec.grades || []).map((g) => g.grade));
  }, [subjectRec, pickedGrades]);

  const haveGrades = (subjectRec && (subjectRec.grades || []).map((g) => g.grade)) || [];
  /* Her enrolled classes always stay listed even if the catalogue dropped one — otherwise a class
     she teaches would quietly vanish from a screen whose job is to show what she teaches. */
  const classOptions = (gradeOptions || [])
    .concat(haveGrades.filter((g) => !(gradeOptions || []).includes(g)))
    .sort((a, b) => ROMAN.indexOf(a.toLowerCase()) - ROMAN.indexOf(b.toLowerCase()));

  const requestClasses = () => {
    if (!subjectRec || !pickedGrades) return;
    const adds = pickedGrades.filter((g) => !haveGrades.includes(g));
    const removes = haveGrades.filter((g) => !pickedGrades.includes(g));
    if (!adds.length && !removes.length) { leave(); return; }
    if (removes.length) setClassConfirm({ removes, adds });
    else applyClasses([...(subjectRec.grades || [])], adds, []);
  };

  /* ★ AN ADDED CLASS ARRIVES SET UP, and this screen does not ask her about it. Section A, the
     default period length, and — where Meyy has a calibrated year for that class — a real annual
     budget with the periods-a-week derived from it. First run's own rule: do not stack
     configuration on configuration. The hint says what it arrives as and points at the row that
     changes it. */
  const applyClasses = async (keep, adds, removes) => {
    if (saving) return;
    setSaving(true); setErr("");
    const totals = await Promise.all(adds.map((roman) =>
      getJSON(`/subjects/${subjectSlug(subject)}/${roman.toLowerCase()}/ncf-periods`)
        .then((d) => (d && d.recommended_total_periods) || null)
        .catch(() => null)));
    setSaving(false);

    const built = adds.map((roman, i) => {
      const annual = totals[i];
      const ppwFor = (annual && ppwFromAnnual(annual)) || DEFAULT_PPW;
      return {
        grade: roman,
        sections: [{ tag: `${classNum(roman)}A`, sec: "A" }],
        durations: [DEFAULT_DURATION],
        ppw_by_duration: { [DEFAULT_DURATION]: ppwFor },
        ppw_anchor: DEFAULT_DURATION,
        periods_per_week: ppwFor,
        _budget: annual ? { method: "periods", value: annual } : null,
      };
    });
    const all = [...keep, ...built]
      .sort((a, b) => ROMAN.indexOf(a.grade.toLowerCase()) - ROMAN.indexOf(b.grade.toLowerCase()));

    const at = subjects.findIndex((x) => x.name === subject);
    /* ⚠️ THE BUDGET MAP IS KEYED BY GRADE INDEX, so it is RE-KEYED against the new list before
       anything is written — remove Class VII from a teacher of VI·VII·VIII and VIII slides from
       index 2 to 1, inheriting VII's year unless this runs. */
    let budget = rekeyBudget(subjectRec.grades, subjectRec.budget, all);
    all.forEach((g, i) => { if (g._budget) budget = { ...budget, [i]: g._budget }; });
    const grades = all.map(({ _budget, ...g }) => g);

    const next = (grades.length
      ? subjects.map((sub, si) => (si !== at ? sub : {
          ...sub, grades,
          budget,
          grids: grades.map((g) => (g.sections || []).map(() => Array(6).fill(-1))),
        }))
      /* ★ HER LAST CLASS TAKEN AWAY TAKES THE SUBJECT WITH IT — which is why the confirm says so
         in words before she presses it. A subject with no classes is not a subject she teaches. */
      : subjects.filter((x) => x.name !== subject));

    setClassConfirm(null);
    commit(next, () => setPickedGrades(null));
  };

  const applyClassChanges = () => {
    const { removes, adds } = classConfirm;
    /* Removed classes lose their sections' bookmarks — and the push inside `clearSectionState`
       is what stops them coming back on her next device. */
    (subjectRec.grades || []).forEach((g) => {
      if (!removes.includes(g.grade)) return;
      (g.sections || []).forEach((x) =>
        clearSectionState(subject, g.grade, x.tag || `${classNum(g.grade)}${secLetter(x)}`));
    });
    applyClasses((subjectRec.grades || []).filter((g) => !removes.includes(g.grade)), adds, removes);
  };

  /* ── SECTIONS ────────────────────────────────────────────────────────────────────────
     ★ REMOVAL IS CONFIRMED, ADDITION IS NOT. Ticking a new section costs her nothing; unticking
     one takes a card and a bookmark away, and she may well have meant to tick a different row.
     So Save asks only when something is being REMOVED, and names exactly what. */
  const requestSections = () => {
    if (!gradeRec || !picked || !picked.length) return;
    const removed = (gradeRec.sections || []).map(secLetter).filter((x) => !picked.includes(x));
    if (removed.length) setSecConfirm(removed.map((sec) => `${classNum(grade)}${sec}`));
    else applySections();
  };

  const applySections = () => {
    if (saving || !gradeRec || !picked) return;
    const before = (gradeRec.sections || []).map(secLetter);
    const after = [...picked].sort();
    /* ⚠️ THE LOCAL TEACHING STATE OF A REMOVED SECTION GOES FIRST, and `clearSectionState` also
       pushes, so the server drops that section's row too — without the push it would reappear on
       her next device the moment state was pulled back down. Her LESSONS are untouched: a section
       losing its bookmark is not a lesson being deleted, which is the promise the hint makes to
       her in words and this code has to keep. */
    before.filter((x) => !after.includes(x))
      .forEach((sec) => clearSectionState(subject, grade, `${classNum(grade)}${sec}`));

    const at = subjects.findIndex((x) => x.name === subject);
    const want = String(grade || "").toLowerCase();
    const next = subjects.map((sub, si) => (si !== at ? sub : {
      ...sub,
      grades: sub.grades.map((g) => ((g.grade || "").toLowerCase() !== want ? g : {
        ...g, sections: after.map((sec) => secObj(g.grade, sec, secNames)),
      })),
      /* `grids` is shape-compat only, but its shape follows the section count, so it is rebuilt
         here for the same reason `finalizeSubject` rebuilds it. */
      grids: sub.grades.map((g) => ((g.grade || "").toLowerCase() !== want
        ? (g.sections || []).map(() => Array(6).fill(-1))
        : after.map(() => Array(6).fill(-1)))),
    }));
    setSecConfirm(null);
    commit(next, () => { setPicked(null); setSecNames({}); });
  };

  const setWeekTotal = (n) => setDraft((d) => {
    const next = setPpwTotal(d.durations, splitMap, anchor, n);
    return { ...d, ppw_by_duration: next, periods_per_week: ppwMapSum(next) };
  });
  const setSplit = (d, v) => setDraft((prev) => {
    const next = setPpwSplit(prev.durations, splitMap, anchor, d, v);
    return { ...prev, ppw_by_duration: next, periods_per_week: ppwMapSum(next) };
  });
  /* ⚠️ THE LAST LENGTH CANNOT BE UNTICKED. A class with no period length is not a shorter answer,
     it is an unanswerable record — every figure downstream (the mix line, the budget's weeks
     reading, the serve's duration matrix) is derived from it. */
  const toggleDuration = (d) => setDraft((prev) => {
    const has = prev.durations.includes(d);
    if (has && prev.durations.length === 1) return prev;
    const durs = has ? prev.durations.filter((x) => x !== d)
      : [...prev.durations, d].sort((a, b) => a - b);
    const a2 = lowestDuration(durs);
    const map = normPpw(durs, prev.ppw_by_duration, prev.periods_per_week, a2);
    return { ...prev, durations: durs, ppw_by_duration: map, ppw_anchor: a2,
             periods_per_week: ppwMapSum(map) };
  });

  const bump = (d) => setValue((v) => clampPeriods((Number(v) || 0) + d));

  /* ★ THE KICKER IS THE WINDOW'S, NOT A HEADING INSIDE IT. `Sheet` already draws a kicker above
     its title, so the screen's own `.kicker` line is handed up rather than repeated — a window
     carrying "ENGLISH · CLASS 3 · SECTIONS" twice, once in its header and once under it, is the
     kind of doubling that made the web's window too tall in the first place.
     ⚠️ And NO `title` is passed: each step already opens with its own question ("How many periods
     a week?", "Edit sections of Class 3"), which IS the title. Passing both would push the ✕ off
     the top of a 360px phone, which is exactly what happened to the web's portal in August. */
  const kicker = `${pretty(subject)} · Class ${classNum(grade)} · ${
    step === "ppw" ? "periods / week" : step === "duration" ? "duration"
      : step === "section" ? "sections" : step === "class" ? "classes" : "annual budget"}`;

  return (
    <Sheet visible scroll onClose={leave} kicker={kicker}>
      <View>

        {step === "class" ? (
          <>
            <Text style={ws.fr_q}>Which classes do you teach {pretty(subject)} to?</Text>
            {/* Says what an added class ARRIVES as, because this screen does not ask — and points
                at the row that changes it. */}
            <Text style={[ws.fr_hint, { color: t.ink_soft }]}>
              Tick a class to add it — untick one to remove it. A new class starts with Section A;
              change that under Section.
            </Text>
            {gradeOptions === null || !pickedGrades ? (
              <Text style={[ws.fr_hint, { color: t.ink_soft }]}>Loading classes…</Text>
            ) : classOptions.length === 0 ? (
              <Text style={[ws.fr_hint, { color: t.ink_soft }]}>
                Every class Meyy offers for {pretty(subject)} is already in your profile.
              </Text>
            ) : (
              /* ★ CLUSTERED, knowingly (founder, 2026-08-29): the picked classes gather adjacent
                 on top, at the recorded cost that with VI and IX ticked, VII and VIII hide inside
                 the cluster until IX is unticked. The SUBJECTS wheel keeps the older no-cluster
                 rule — it is the site of the swallowed-Mathematics defect and was not part of
                 that reversal. */
              <PickWheel options={classOptions} selected={pickedGrades}
                onToggle={(g) => setPickedGrades((a) => (a.includes(g) ? a.filter((x) => x !== g) : [...a, g]))}
                ariaLabel={`Classes for ${pretty(subject)}`} labelFor={(g) => `Class ${classNum(g)}`}>
                {/* "Save", not "Continue" (founder, 2026-08-27): the word states whether anything
                    follows, and here nothing does — the tick applies and she is returned.
                    ⚠️ NOT DISABLED AT ZERO, unlike the section screen, and the difference is the
                    point. Zero SECTIONS is not an act she can mean — it cascades the class away by
                    a side door. Zero CLASSES is an act she can mean: it removes the subject, and
                    the confirm says exactly that in words before she presses it. Disabling here
                    would make that path unreachable and its warning dead code — which is what the
                    first draft of this screen did, copied from the section wheel above. The web
                    says the same thing in one expression: `disabled={manageC ? false : …}`. */}
                <Pressable onPress={requestClasses} disabled={saving}
                  accessibilityRole="button" accessibilityState={{ disabled: saving }}
                  style={[ws.fr_cta, { backgroundColor: saving ? t.paper_sunk : t.pine }]}>
                  {saving ? <ActivityIndicator size="small" color={t.ink_soft} />
                          : <Text style={[ws.fr_cta_t, ws.fr_cta_ink]}>Save</Text>}
                </Pressable>
              </PickWheel>
            )}
            <Pressable onPress={leave} accessibilityRole="button" hitSlop={8} style={ws.fr_link}>
              <Text style={ws.fr_link_t}>← Back</Text>
            </Pressable>
          </>
        ) : step === "section" ? (
          <>
            <Text style={ws.fr_q}>Edit sections of Class {classNum(grade)}</Text>
            {/* ★ THE LAST SENTENCE NAMES A CONTROL THAT EXISTS (founder, Q4, 2026-09-15). The web
                said "use the basket on the class"; that basket was retired when removing a class
                moved into the Add window, so a teacher reading it went looking for a bin that is
                not there. Amended on BOTH surfaces in the same commit — the phone never carried
                the stale wording. */}
            <Text style={[ws.fr_hint, { color: t.ink_soft }]}>
              Tick to keep or add a section, untick to remove one. A removed section loses its
              bookmark — your lessons stay in the library. To remove the whole class, use Class in
              the Add window.
            </Text>
            {picked ? (
              /* ★ CLUSTERED, knowingly (founder, 2026-08-29, reversing an earlier call): ticked
                 sections gather adjacent at the top, accepting the recorded cost that a class
                 holding A and R hides B…Q inside the cluster until R is unticked. */
              <PickWheel options={SECTION_LETTERS} selected={picked}
                onToggle={(x) => setPicked((a) => (a.includes(x) ? a.filter((y) => y !== x) : [...a, x]))}
                ariaLabel="Sections" labelFor={(x) => `${classNum(grade)}${x}`}
                leadingHeader="Section" trailingHeader="customize"
                summaryFor={(x) => secSummary(grade, x, secNames)}
                trailing={(x, on) => (
                  <SecNameCell on={on} tag={`${classNum(grade)}${x}`} value={secNames[x] || ""}
                    onChange={(v) => setSecNames((m) => ({ ...m, [x]: v }))} />
                )}>
                {/* ⚠️ Save is disabled at ZERO sections. A class with no sections is not a smaller
                    class — removing the last one cascades the whole class away on the web, and that
                    is a different, more destructive act than the one this screen is for. */}
                <Pressable onPress={requestSections} disabled={saving || !picked.length}
                  accessibilityRole="button" accessibilityState={{ disabled: !picked.length }}
                  style={[ws.fr_cta, { backgroundColor: (saving || !picked.length) ? t.paper_sunk : t.pine }]}>
                  {saving ? <ActivityIndicator size="small" color={t.ink_soft} />
                          : <Text style={[ws.fr_cta_t, ws.fr_cta_ink]}>Save</Text>}
                </Pressable>
              </PickWheel>
            ) : <ActivityIndicator style={{ marginTop: 28 }} color={t.pine} />}
            <Pressable onPress={leave} accessibilityRole="button" hitSlop={8} style={ws.fr_link}>
              <Text style={ws.fr_link_t}>← Back</Text>
            </Pressable>
          </>
        ) : step === "ppw" ? (
          <>
            <Text style={ws.fr_q}>How many periods a week?</Text>
            <Text style={[ws.fr_hint, { color: t.ink_soft }]}>
              A number, not a timetable — you’ll set the period lengths next.
            </Text>
            {draft ? (
              <RollWheel ariaLabel="Periods per week" large value={String(weekTotal || DEFAULT_PPW)}
                onChange={(v) => setWeekTotal(Number(v))}
                items={PPW_CHOICES.map((p) => ({
                  id: String(p), chip: p, label: p === 1 ? "period a week" : "periods a week",
                }))} />
            ) : <ActivityIndicator style={{ marginTop: 28 }} color={t.pine} />}
            <View style={ws.fr_foot}>
              {/* ALWAYS continues into the duration screen — that is where the lengths and their
                  split are set, and it is the only way in now. No Save here: see saveNumbers. */}
              <Pressable onPress={() => setStep("duration")} disabled={!draft}
                accessibilityRole="button"
                style={[ws.fr_cta, { backgroundColor: draft ? t.pine : t.paper_sunk }]}>
                <Text style={[ws.fr_cta_t, ws.fr_cta_ink]}>Continue</Text>
              </Pressable>
              <Pressable onPress={leave} accessibilityRole="button" hitSlop={8} style={ws.fr_link}>
                <Text style={ws.fr_link_t}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : step === "duration" ? (
          <>
            <Text style={ws.fr_q}>How long are the periods?</Text>
            <Text style={[ws.fr_hint, { color: t.ink_soft }]}>
              {multi
                ? `Split your ${weekTotal} periods between the lengths — ${anchor} min takes whatever is left over.`
                : "If more than one duration, select multiple."}
            </Text>
            {draft ? (
              <PickWheel options={DURATION_CHOICES} selected={durations} onToggle={toggleDuration}
                ariaLabel="Period durations" labelFor={(d) => `${d} min`}
                initialScrollTo={durations[0]}
                leadingHeader={multi ? "Duration" : null}
                trailingHeader={multi ? "Periods / week" : null}
                summaryFor={multi ? (d) => `${d} min × ${splitMap[d] || 0}` : null}
                trailing={(d, on) => (
                  <PpwSplitCell duration={d} selected={on} map={splitMap}
                    isAnchor={d === anchor} show={multi}
                    open={splitOpen === d} onOpen={setSplitOpen} />
                )}>
                {/* The chosen length's 0…total strip, inline under the wheel rather than in a
                    second window. It names the length because by the time she reaches it the row
                    she tapped may have scrolled out of sight. */}
                {splitOpen != null ? (
                  <View style={[ws.ppw_strip, { borderTopColor: t.line_soft }]}>
                    <Text style={[ws.ppw_strip_k, { color: t.ink_soft }]}>{splitOpen} min</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled">
                      {Array.from({ length: weekTotal + 1 }, (_, n) => n).map((n) => (
                        <Pressable key={n} onPress={() => { setSplit(splitOpen, n); setSplitOpen(null); }}
                          accessibilityRole="button" accessibilityState={{ selected: n === (splitMap[splitOpen] || 0) }}
                          accessibilityLabel={`${n} periods a week at ${splitOpen} minutes`}
                          style={[ws.ppw_opt, n === (splitMap[splitOpen] || 0) && { backgroundColor: t.pine }]}>
                          <Text style={[ws.ppw_opt_t, { color: n === (splitMap[splitOpen] || 0) ? t.paper_2 : t.ink }]}>{n}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                {/* Step 2 of 2 — the lengths AND their split, so this is where it saves. */}
                <Pressable onPress={saveNumbers} disabled={saving} accessibilityRole="button"
                  style={[ws.fr_cta, { backgroundColor: saving ? t.paper_sunk : t.pine }]}>
                  {saving ? <ActivityIndicator size="small" color={t.ink_soft} />
                          : <Text style={[ws.fr_cta_t, ws.fr_cta_ink]}>Save</Text>}
                </Pressable>
              </PickWheel>
            ) : <ActivityIndicator style={{ marginTop: 28 }} color={t.pine} />}
            <Pressable onPress={() => { setSplitOpen(null); setStep("ppw"); }}
              accessibilityRole="button" hitSlop={8} style={ws.fr_link}>
              <Text style={ws.fr_link_t}>← Back</Text>
            </Pressable>
          </>
        ) : (
        <>
        {/* No sub-hint (founder, 2026-08-27). It restated the heading in longer words, and the
            screen already answers it twice more below: the weeks reading, then Aruvi's figure. */}
        <Text style={ws.fr_q}>How many periods for the year?</Text>

        {/* ★ THE BANNER SITS ABOVE THE FIGURE, AND OUTSIDE THE LOADING SPLIT. It is raised on a
            mismatch, and a mismatch is exactly when `value` is cleared so the field can re-seed
            from the server's copy — so written INSIDE the `value != null` branch it could never
            once appear, which is how it was first written. A message about a value cannot live
            in a subtree that only exists when the value does.
            `role="alert"` on the web; `assertive` is its RN counterpart, so a teacher using a
            screen reader hears that the number under her has changed rather than being left
            with a figure she did not type. */}
        {err ? (
          <View style={[ws.tp_savefail, { borderColor: t.edge_clay, backgroundColor: t.paper_2 }]}
            accessibilityLiveRegion="assertive">
            <Text style={[ws.tp_savefail_t, { color: t.ink }]}>{err}</Text>
            <Pressable onPress={() => setErr("")} accessibilityRole="button" hitSlop={8}
              style={[ws.tp_savefail_btn, { borderBottomColor: t.edge_clay }]}>
              <Text style={[ws.tp_savefail_bt, { color: t.clay }]}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

        {value == null ? (
          <ActivityIndicator style={{ marginTop: 28 }} color={t.pine} />
        ) : (
          <>
            <View style={ws.tp_val_row}>
              <Pressable onPress={() => bump(-1)} hitSlop={6} accessibilityRole="button"
                accessibilityLabel="Fewer periods"
                style={[ws.tp_val_btn, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
                <Text style={ws.tp_val_btn_t}>−</Text>
              </Pressable>
              {/* `selectTextOnFocus` so tapping replaces the year rather than making her clear it
                  digit by digit — the prepare screen's stepper made the same call. */}
              <TextInput value={String(value)} keyboardType="number-pad" selectTextOnFocus
                onChangeText={(v) => setValue(v === "" ? "" : clampPeriods(parseInt(v, 10)))}
                onBlur={() => setValue((v) => clampPeriods(v))}
                accessibilityLabel="Annual period budget"
                style={[ws.tp_val_input, { borderColor: t.line, backgroundColor: t.paper_2 }]} />
              <Pressable onPress={() => bump(1)} hitSlop={6} accessibilityRole="button"
                accessibilityLabel="More periods"
                style={[ws.tp_val_btn, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
                <Text style={ws.tp_val_btn_t}>+</Text>
              </Pressable>
              <Text style={ws.tp_val_unit}>periods / year</Text>
            </View>

            {/* The sense-check, directly under the figure it reads. Advisory, never corrective.
                ★ AND ITS PENCIL IS LIVE AS OF 5d (Q1). "If the weeks look wrong because the ppw
                is wrong, the pencil goes and fixes that side" — it stays INSIDE this editor, so
                coming back lands her here with her figure intact. Aruvi adjusts nothing on her
                behalf; it only opens the other side of the arithmetic. */}
            {weeks && ppw > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={ws.tp_weeks}>{weeks} weeks (@ {ppw} periods/week)</Text>
                <Pressable onPress={() => setStep("ppw")} hitSlop={10} accessibilityRole="button"
                  accessibilityLabel="Change periods a week for this class"
                  style={ws.yp_budget_edit}>
                  <Text style={{ color: t.pine_d, fontSize: 13 }}>✎</Text>
                </Pressable>
              </View>
            ) : null}
            {recLine ? <Text style={ws.tp_estimate_sub}>{recLine}</Text> : null}

            <View style={ws.fr_foot}>
              <Pressable onPress={save} disabled={saving} accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
                style={[ws.fr_cta, { backgroundColor: saving ? t.paper_sunk : t.pine }]}>
                {saving
                  ? <ActivityIndicator size="small" color={t.ink_soft} />
                  : <Text style={[ws.fr_cta_t, ws.fr_cta_ink]}>Save</Text>}
              </Pressable>
              <Pressable onPress={leave} accessibilityRole="button" hitSlop={8} style={ws.fr_link}>
                <Text style={ws.fr_link_t}>Cancel</Text>
              </Pressable>
            </View>
          </>
        )}
        </>
        )}
      </View>

      {/* ★ THE CONFIRM NAMES WHAT GOES, AND WHAT STAYS. "Remove 3B?" — and then, in the same
          breath, that her lessons stay in the library, because the fear this dialog answers is
          not "did I mean to untick" but "have I just thrown away my work". The keep-option is
          worded as a choice ("Keep it"), not as a cancel. */}
      {classConfirm ? (() => {
        const names = classConfirm.removes.map((r) => `Class ${classNum(r)}`).join(", ");
        const tags = classConfirm.removes.map((roman) => {
          const g = (subjectRec.grades || []).find((x) => x.grade === roman);
          return g && (g.sections || []).length
            ? g.sections.map((x) => x.tag || `${classNum(roman)}${secLetter(x)}`).join(", ")
            : `Class ${classNum(roman)}`;
        }).join(", ");
        /* ★ AND IF IT TAKES THE WHOLE SUBJECT, SHE IS TOLD SO HERE — before she presses it, in
           the same sentence as what else goes. A subject disappearing as a side effect of
           removing a class would be the most surprising thing this screen could do. */
        const allGone = classConfirm.removes.length === (subjectRec.grades || []).length
          && !classConfirm.adds.length;
        return (
          <Sheet visible confirm onClose={() => setClassConfirm(null)}
            kicker={pretty(subject)}
            title={`Remove ${names} from ${pretty(subject)}?`}
            sub={`${tags} — their cards and bookmarks — will be removed.${allGone ? ` No class is left — ${pretty(subject)} goes with it.` : ""} Your lessons stay in the library.`}>
            <View style={ws.ap_actions}>
              {/* "Keep them" re-ticks what she was about to remove, rather than abandoning the
                  whole edit — the same rule the subjects confirm follows (founder, 2026-08-24). */}
              <Pressable onPress={() => { setPickedGrades(haveGrades.concat(classConfirm.adds)); setClassConfirm(null); }}
                accessibilityRole="button" style={[ws.ap_btn, { borderColor: t.line }]}>
                <Text style={[ws.ap_btn_label, { color: t.ink }]}>
                  Keep {classConfirm.removes.length === 1 ? "it" : "them"}
                </Text>
              </Pressable>
              <Pressable onPress={applyClassChanges} accessibilityRole="button"
                style={[ws.ap_btn, { borderColor: t.edge_clay, backgroundColor: t.paper_2 }]}>
                <Text style={[ws.ap_btn_label, { color: t.clay }]}>Yes, remove {names}</Text>
              </Pressable>
            </View>
          </Sheet>
        );
      })() : null}

      {secConfirm ? (
        <Sheet visible confirm onClose={() => setSecConfirm(null)}
          kicker={`${pretty(subject)} · Class ${classNum(grade)}`}
          title={`Remove ${secConfirm.join(", ")}?`}
          sub={`${secConfirm.length === 1 ? "Its card and bookmark" : "Their cards and bookmarks"} will be removed. Your lessons stay in the library.`}>
          <View style={ws.ap_actions}>
            <Pressable onPress={() => setSecConfirm(null)} accessibilityRole="button"
              style={[ws.ap_btn, { borderColor: t.line }]}>
              <Text style={[ws.ap_btn_label, { color: t.ink }]}>
                Keep {secConfirm.length === 1 ? "it" : "them"}
              </Text>
            </Pressable>
            <Pressable onPress={applySections} accessibilityRole="button"
              style={[ws.ap_btn, { borderColor: t.edge_clay, backgroundColor: t.paper_2 }]}>
              <Text style={[ws.ap_btn_label, { color: t.clay }]}>
                Yes, remove {secConfirm.join(", ")}
              </Text>
            </Pressable>
          </View>
        </Sheet>
      ) : null}
    </Sheet>
  );
}
