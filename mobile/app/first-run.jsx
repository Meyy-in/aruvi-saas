/* ───────── FIRST RUN — the guided first generation (Track D step 5e) ─────────
 *
 * A port of `web/app/components/FirstRun.jsx`. Three steps, and only three: Welcome → Subject →
 * Class → Chapter, then the lesson is fired and the shell opens on My Lessons. The rail promises
 * Subject · Class · Chapter and nothing else may stand between her and her first lesson — four
 * screens once did (sections · periods a week · durations · annual budget) and were struck on
 * 2026-08-21 for inverting §0's benefit-first rule at the exact moment of her first success.
 *
 * ★ THERE IS NO WAITING SCREEN. The chapter CTA fires the serve and hands off in the SAME TICK;
 * the shell opens on My Lessons and the ORDINARY preparing card holds the wait, replaced in place
 * when the plan lands. One wait, one place, learnt once — the identical mechanism an everyday
 * prepare uses (`lib/preparing` + ProposedCard). The request is deliberately NOT awaited before
 * the handoff: this screen unmounts instantly, and the fetch keeps running in its closure.
 *
 * ★ PHASE 1 IS SHELL-LESS, so this route lives OUTSIDE `(app)` — no bottom nav — and its bar
 * carries the brand and her identity but NO GEAR (founder, 2026-09-16): there is no shell to open
 * settings into, and an inert control is worse than none on the one screen she meets first.
 *
 * ★ AND THE VALUES TRAVEL AS AN ARGUMENT, not through state. Seeding the profile and handing off
 * happen in one tick, so reading them back off state would read the previous render's — the
 * `finishActivation(over)` rule the web arrived at the hard way.
 */
import { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, BackHandler } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../components/Text";
import {
  ROMAN, classNum, fetchEntitlement, getJSON, getUser, gradeUp, markPrepared, paidScopesOf, postJSON,
  ppwFromAnnual, pretty, stageOfGrade,
} from "@aruvi/shared/format";
import { DEFAULT_DURATION, DEFAULT_PPW, DURATION_CHOICES, lowestDuration, normPpw, ppwMapSum }
  from "@aruvi/shared/ppw";
import { cachedReadiness, adoptReadiness, saveReadiness } from "@aruvi/shared/readiness";
import { invalidatePlans } from "@aruvi/shared/plans";
import { bindSectionChapter, unbindSection } from "@aruvi/shared/sectionState";
import Bar from "../components/Bar";
import PrepareCta from "../components/PrepareCta";
import { RollWheel, wheelChapterTitle } from "../components/RollWheel";
import { markGenerated, queueFirstRunCheck } from "../lib/firstRun";
import { startPreparing, failPreparing, paywallPreparing, clearPreparing } from "../lib/preparing";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

const DEFAULT_PERIODS = 12;                                          // last resort only
const PERIOD_CHOICES = Array.from({ length: 60 }, (_, i) => i + 1);  // 1…60
const PREPARING_MS = 5000;
const DAYS = [0, 1, 2, 3, 4, 5];

/* The three-step rail (`.fr-prog`). The connector is the web's `::before` — one absolute bar per
   step reaching back to the step before it, under the dots, never on the first. */
function Progress({ active }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const steps = ["Subject", "Class", "Chapter"];
  const idx = steps.indexOf(active);
  return (
    <View style={ws.fr_prog} accessibilityLabel="Setup progress">
      {steps.map((label, i) => {
        const done = i < idx;
        const current = i === idx;
        const lit = done || current;
        return (
          <View key={label} style={ws.fr_prog_step}>
            {i > 0 ? (
              <View style={[ws.fr_prog_line, { left: "-50%", width: "100%" },
                { backgroundColor: lit ? t.pine : t.line }]} />
            ) : null}
            <View style={[ws.fr_prog_dot, lit
              ? { backgroundColor: t.pine, borderColor: t.pine }
              : { backgroundColor: t.paper_sunk, borderColor: t.line }]}>
              <Text style={[ws.fr_prog_dot_t, { color: lit ? "#fff" : t.ink_soft }]}>
                {done ? "✓" : String(i + 1)}
              </Text>
            </View>
            <Text style={[ws.fr_prog_label, current && ws.fr_prog_label_on]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function FirstRun() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();   // WALK-A-046: the navigation bar's own room
  const user = getUser();

  const [step, setStep] = useState("welcome");   // welcome | subject | grade | chapter
  /* WALK-A-035: Android's Back walks the steps back, as the on-screen links do; on Welcome it
     leaves (the default). */
  useEffect(() => {
    const prev = { subject: "welcome", grade: "subject", chapter: "grade" };
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (prev[step]) { setStep(prev[step]); return true; }
      return false;
    });
    return () => sub.remove();
  }, [step]);
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("");    // slug
  const [grades, setGrades] = useState([]);
  const [grade, setGrade] = useState("");        // slug
  const [chapters, setChapters] = useState([]);
  const [chapterNo, setChapterNo] = useState("");
  const [durationMin, setDurationMin] = useState(DEFAULT_DURATION);
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  /* The recommendation is per CHAPTER, and the "Meyy recommended" tag compares the CURRENT value
     against it live — roll back onto the number and the tag returns. */
  const [defaultPeriods, setDefaultPeriods] = useState(DEFAULT_PERIODS);
  const [stdDuration, setStdDuration] = useState(DEFAULT_DURATION);
  const [editingField, setEditingField] = useState(null);   // null | "duration" | "periods"
  const [annualBudget, setAnnualBudget] = useState(null);
  const [genonChs, setGenonChs] = useState([]);
  const [canonMinutes, setCanonMinutes] = useState({});
  const [trialInfo, setTrialInfo] = useState(null);
  const [activating, setActivating] = useState(false);
  const sections = ["A"];    // STATED, not asked (founder, 2026-08-21) — see the Class step

  /* ★ HAS SHE MOVED EITHER WHEEL BY HAND? (the web's "it generated at the default" bug, 2026-08-21.)
     Both defaults are seeded from async fetches, and a late arrival used to overwrite a hand-set
     value — 60 × 16 went out as 50 × 19. The reset points DIFFER because the facts do: the periods
     recommendation is per CHAPTER, so a new chapter re-earns the right to seed; duration is a
     property of the CLASS, so only changing class does. */
  const periodsTouched = useRef(false);
  const durationTouched = useRef(false);

  /* ★ THREE STATES, NOT TWO (founder, 2026-09-17, on the web: *"stuck in loading subjects"*).
     `catch(() => setSubjects([]))` and a render that tests `length === 0` cannot tell "has not
     arrived yet" from "will never arrive" — so a failed `/subjects` sat under the word
     **Loading…** for ever, on the very first step of first run, with no error and nothing to
     press. A spinner that never ends is the worst failure shape there is: it blames the network
     for as long as she is willing to wait.
     ⚠️ AND AN EMPTY LIST IS NOT A FAILURE. A teacher who arrives already PAID sees only her
     scopes' subjects, so a subscription whose scopes match nothing we serve legitimately filters
     the wheel to nothing — and that needs its own sentence, not a retry she can press for ever. */
  const [subjLoad, setSubjLoad] = useState("");        // "" in flight · "ok" · "fail"
  const [subjTry, setSubjTry] = useState(0);           // bumped by Try again
  useEffect(() => {
    setSubjLoad("");
    getJSON("/subjects")
      .then((d) => { setSubjects((d && d.subjects) || []); setSubjLoad("ok"); })
      .catch((e) => {
      /* ⚠️ THE REASON GOES TO THE CONSOLE, NEVER TO HER. "Couldn't load the subject list" is
         the right sentence for a teacher — a status code is not — but when this is reported from
         a handset the one thing nobody can see is WHICH failure it was. `getJSON` now retries
         transients three times before it gives up, so anything that reaches here has already
         survived that, and the message says whether it was a status or a dead socket. */
        console.warn("[meyy] /subjects failed:", (e && e.message) || e);
        setSubjects([]); setSubjLoad("fail");
      });
    fetchEntitlement().then(setTrialInfo).catch(() => {});
  }, [subjTry]);

  // Arriving on the chapter step never re-opens a wheel she left open.
  useEffect(() => { if (step === "chapter") setEditingField(null); }, [step]);

  useEffect(() => {
    if (!subject) { setGrades([]); return; }
    let live = true;
    getJSON(`/subjects/${subject}/grades`)
      .then((d) => { if (live) setGrades([...((d && d.grades) || [])].sort((a, b) => ROMAN.indexOf(a) - ROMAN.indexOf(b))); })
      .catch(() => { if (live) setGrades([]); });
    return () => { live = false; };
  }, [subject]);

  useEffect(() => {
    if (!subject || !grade) { setChapters([]); setGenonChs([]); setCanonMinutes({}); return; }
    let live = true;
    getJSON(`/subjects/${subject}/${grade}/chapters`).then((d) => {
      if (!live) return;
      /* Chapters the master plan budgets for but NCERT has not published (`placeholder`, titled
         "Book awaited") belong to the YEAR, not to a picker — there is nothing to generate from. */
      setChapters(((d && d.chapters) || []).filter((c) => !c.placeholder));
      const sd = Number(d && d.standard_duration_minutes) || DEFAULT_DURATION;
      setStdDuration(sd);
      if (!durationTouched.current) setDurationMin(sd);
      /* ★ THE CALIBRATED ANNUAL BUDGET, not a guess. Year Plan does not show the per-chapter
         recommendation — it distributes HER budget across the chapters by weight. Seeding a
         plausible 30 weeks × 6 for a class whose calibrated year is 245 is what made Year Plan
         suggest 14 for a chapter the chapter step had just recommended at 19. */
      const ab = Number(d && d.annual_budget_periods);
      setAnnualBudget(ab > 0 ? ab : null);
    }).catch(() => { if (live) setChapters([]); });
    getJSON(`/genon/${subject}/${grade}/chapters`)
      .then((d) => { if (!live) return; setGenonChs((d && d.chapters) || []); setCanonMinutes((d && d.canonical_minutes) || {}); })
      .catch(() => { if (live) { setGenonChs([]); setCanonMinutes({}); } });
    return () => { live = false; };
  }, [subject, grade]);

  const genonAvailable = !!chapterNo && genonChs.includes(Number(chapterNo));

  /* The CALIBRATED figure from the master plan (`recommended_periods`), the API already falling
     back to the NCF norm where it has no row. The flat 12 is the last resort. */
  const estimateFor = (no) => {
    const c = chapters.find((x) => String(x.chapter_number) === String(no));
    const rec = c && c.recommended_periods != null ? Math.round(c.recommended_periods) : null;
    return rec && rec > 0 ? rec : DEFAULT_PERIODS;
  };

  /* Pick the chapter AND reset its estimate in the SAME event, so both land in one render — set
     apart, the estimate trailed the wheel by a frame and flashed the previous chapter's number. */
  const pickChapter = (no) => {
    /* ★ ONLY A REAL CHANGE RE-SEEDS (WALK-A-026, founder 2026-09-20: "periods - not able to change,
       pressing change quickly restores to default"). The chapter wheel commits on settle, and it
       settles whenever the page moves under it — opening the periods editor is itself a layout
       change — so it re-committed the SAME chapter, and this function then reset periodsTouched,
       put the recommendation back and closed the editor she had just opened. A re-pick of the
       chapter she is already on must do nothing at all. */
    if (String(no) === String(chapterNo)) return;
    setChapterNo(no);
    const est = estimateFor(no);
    setDefaultPeriods(est);
    periodsTouched.current = false;
    setPeriods(est);
    setEditingField((f) => (f === "periods" ? null : f));
  };

  // Chapters arrive AFTER a chapter can be seeded: keep the tag's figure in step, and the WHEEL
  // too — but only while she has not set it herself.
  useEffect(() => {
    const c = chapters.find((x) => String(x.chapter_number) === String(chapterNo));
    if (!c) return;
    const est = estimateFor(chapterNo);
    setDefaultPeriods(est);
    if (periodsTouched.current) return;
    setPeriods(est);
    setEditingField((f) => (f === "periods" ? null : f));
  }, [chapters]);   // eslint-disable-line react-hooks/exhaustive-deps

  const chosenChapter = chapters.find((c) => String(c.chapter_number) === String(chapterNo));
  const tagFor = (letter) => `${classNum(grade)}${letter}`;

  /* ★ SUBSCRIBED-ENTRY SCOPE FILTER (founder, 2026-08-24). A teacher who arrives already PAID is
     offered only what she bought — the subject wheel filtered to her scopes' subjects, the class
     wheel to their STAGES. Trial and "*" grants see everything: breadth in trial is deliberate. */
  /* ⚠️ THIS WAS A THIRD SPELLING OF `paidScopesOf`, AND IT HAD DRIFTED (found 6a F5,
     2026-09-16). It read `scopes` where the rule reads `live_scopes` — every scope she has
     ever held, rather than the ones still live — so a teacher arriving with one expired
     subject-stage and one running would have been offered both on her very first screen. It
     also missed the `lapsed` half. One rule, one place: CLAUDE.md §3.
     `paidScopesOf` returns null for "*" of its own accord (null = NO LIMIT), which is what the
     explicit `includes("*")` here was reaching for. */
  const frPaidScopes = paidScopesOf(trialInfo);
  const visibleSubjects = frPaidScopes
    ? subjects.filter((s) => frPaidScopes.some((sc) => sc.split("/")[0] === s))
    : subjects;
  const visibleGrades = frPaidScopes
    ? grades.filter((g) => frPaidScopes.some((sc) =>
        sc.split("/")[0] === subject && sc.split("/")[1] === stageOfGrade(g)))
    : grades;

  /* The CANONICAL profile record for this one subject·class: her section, the duration, the
     weekly split (and its derived total), and the annual budget under grade index 0. `grids` ships
     all −1 — Meyy never asks which days. */
  const buildActivationPayload = (over) => {
    const durs = over.durations;
    const ppwMap = normPpw(durs, over.ppwByDur, over.weekTotal, lowestDuration(durs));
    return {
      subjects: [{
        name: pretty(subject),
        grades: [{
          grade: gradeUp(grade),
          sections: sections.map((s) => ({ tag: tagFor(s), sec: s })),
          durations: [...durs],
          ppw_by_duration: ppwMap,
          ppw_anchor: lowestDuration(durs),
          periods_per_week: ppwMapSum(ppwMap),
        }],
        grids: [sections.map(() => DAYS.map(() => -1))],
        budget: { 0: over.budget || { method: "auto", value: 0 } },
      }],
    };
  };

  /* ★ PREPARE AND HAND OFF. Everything the payload needs is passed DOWN as `over` rather than set
     on state first: the seeding and the handoff happen in one tick. */
  const prepareAndHandOff = () => {
    if (!chosenChapter || activating) return;
    setActivating(true);
    const rows = [{ duration: Number(durationMin), count: Number(periods) }];
    const descriptor = {
      section: null, sectionTag: "",
      subject, grade,
      chapterNo: Number(chapterNo),
      chapterTitle: chosenChapter.chapter_title,
      rows,
    };
    /* ★ PERIODS A WEEK IS DERIVED, NOT GUESSED, and derived from `annual_budget_periods` — the API
       field — never from a stored budget record, which is itself ppw × 30 when there is no
       master-plan row: round(ppw×30/30) = ppw, a fixed point that justifies whatever it held. No
       calibrated figure means no derivation, and DEFAULT_PPW stands as the honest fallback. */
    const seededPpw = annualBudget ? ppwFromAnnual(annualBudget) : DEFAULT_PPW;
    const over = {
      durations: [Number(durationMin)],
      ppwByDur: { [Number(durationMin)]: seededPpw },
      weekTotal: seededPpw,
      budget: annualBudget ? { method: "periods", value: annualBudget } : { method: "weeks", value: 30 },
    };

    /* Clear any STALE binding for this section key, locally AND on the server: a reused key
       (english_iii_3A left over from an earlier account on this device) would otherwise resurrect
       its old chapter the moment section state is pulled back down. */
    const secKey = `${subject}_${grade}_${tagFor(sections[0])}`;
    try { unbindSection(secKey); } catch {}

    /* MERGE, never replace (founder, 2026-08-25): a direct subscriber's other purchased subjects
       must survive the activation write. Same-name records are replaced by hers; the rest keep
       their place. A fresh trial teacher has no base, so this is her one record. */
    const mine = buildActivationPayload(over).subjects;
    const base = (cachedReadiness() || {}).subjects || [];
    const merged = base.length
      ? base.map((b) => mine.find((n) => n.name === b.name) || b)
          .concat(mine.filter((n) => !base.some((b) => b.name === n.name)))
      : mine;

    /* She has generated: never re-arm first run for HER this session (the web's `everGeneratedRef`
       — completing first run flips `ready`, which re-asks the question at the exact moment the
       serve is still in flight, and the honest answer "nothing prepared yet" would bounce her back
       to the welcome screen seconds after her first success). */
    markGenerated();
    /* And she is owed the "did Meyy get your set-up right?" question — Meyy chose a section, a
       periods a week and a year's total on her behalf, and this is the first moment she can judge
       them. My Classes raises it; see lib/firstRun. */
    queueFirstRunCheck();
    /* The store takes her profile NOW — the shell's gate and My Lessons' wheels both read it in
       the next tick — and the verified write runs behind, adopting the SERVER's copy on mismatch
       (@aruvi/shared/readiness). */
    adoptReadiness(merged);
    saveReadiness(merged).catch(() => {});

    /* WALK-A-019: the serve is a named closure, handed to the store, so a failed card can run it
       again — including the binding, exactly as the first attempt would have. */
    const runServe = () => {
      /* ★ THE SERVE IS NOT AWAITED. This screen is already gone; the fetch resolves into the
         preparing store from a closure nobody is watching. */
      const startedAt = Date.now();
      postJSON(`/genon/${subject}/${grade}/${chapterNo}/plan`, { rows })
      .then(async (resp) => {
        /* ★ HOLD THE BAR. A genon serve is ~0.3 ms, so without this the card is replaced in the
           breath it appears and she sees nothing — reported on the web the day this handoff first
           shipped. Five seconds, the same beat every prepare holds, and this is her FIRST lesson:
           the one moment the pause is most worth having. Never skipped here — on first run nothing
           can be already hers. */
        await new Promise((res) => setTimeout(res, Math.max(0, PREPARING_MS - (Date.now() - startedAt))));
        markPrepared(subject, grade, resp.filename);
        invalidatePlans(`${subject}/${grade}`);   // her flags moved — the shared listing must re-read
        /* ★ IT LANDS ATTACHED (founder, 2026-08-21), reversing the 2026-07-05 "cards land
           unattached" rule for first run alone. That rule was written when binding here made the
           first class look finished while the profile behind it was never built; the profile IS
           built now, and what was left was an empty card at the end of a flow whose whole promise
           was a lesson. */
        bindSectionChapter(secKey, resp.filename);
        clearPreparing();
      })
      .catch((e) => {
        const msg = (e && e.detail) || "Couldn’t build the lesson plan right now. Try again in a moment.";
        /* ⚠️ A PAYWALL IS NOT A FAILED BUILD (prepare.jsx's rule, which the web's first run does
           not have — app. 03 open question 5, taken as recommended). It pulls the card and raises
           the window instead. On first run a 402 can only reach a lapsed account with no profile,
           which is rare and not a reason to show her a broken lesson. */
        if (e && e.status === 402) paywallPreparing(msg);
        else failPreparing(msg);
      });
    };
    startPreparing(descriptor, runServe);
    /* `replace`, not navigate: first run is not a place she can come back to. */
    router.replace("/lessons");
    runServe();
  };


  /* ── WELCOME ─────────────────────────────────────────────────────────────────────
     Orientation only: the benefits list lives on the front door. The trial card renders for a
     TRIAL teacher; a subscribed entrant gets the clean version (title · To get started · CTA). */
  /* ⚠️ THESE STAY INSIDE, for now (2026-09-21). Hoisting them to module scope was the right
     answer to WALK-A-049 — a component defined in a render is a new type every time, so React
     threw this screen away and rebuilt it on every keystroke — but it also coincided exactly with
     a hard Fabric crash at the moment first run hands over to My Lessons ("addViewAt: failed to
     insert view … the specified child already has a parent"), three runs in a row. The flash it
     was fixing is now fixed at its own source: the wheel starts at the right offset instead of
     parking there a frame later, so a remount costs a rebuild but shows nothing wrong. The hoist
     is still worth doing once the crash is understood — it is real waste — but not blind, and
     not while it is the only thing standing between a teacher and a dead app. */
  /* `.fr-foot`: a centred column with 12px between the CTA and the link. The web's own
     padding-top here is 20 (web.js's fr_foot carries the profile window's 108, a different
     screen's measure), and `alignSelf: "stretch"` is what lets a full-width CTA be full width
     inside a centred column. */
  const Foot = ({ children }) => (
    <View style={[ws.fr_foot, { paddingTop: 20, alignSelf: "stretch" }]}>{children}</View>
  );
  const Cta = ({ label, onPress, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[ws.fr_cta, { backgroundColor: disabled ? t.paper_sunk : t.pine }]}>
      <Text style={[ws.fr_cta_t, disabled ? { color: t.ink_soft } : ws.fr_cta_ink]}>{label}</Text>
    </Pressable>
  );
  const BackLink = ({ label, onPress }) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={ws.fr_link} hitSlop={6}>
      <Text style={ws.fr_link_t}>{label}</Text>
    </Pressable>
  );

  const Frame = ({ children, foot }) => (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar user={user} gear={false} />
      {/* WALK-A-046: 28 cleared the gesture pill; the three buttons need the real inset. */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22,
                                           paddingBottom: 28 + insets.bottom }}>
        {children}
        {foot}
      </ScrollView>
    </View>
  );

  /* ── STEP 1 · SUBJECT ── */
  if (step === "welcome") {
    const onTrial = trialInfo && trialInfo.enforced && trialInfo.status === "trial";
    return (
      <Frame foot={
        <Foot>
          <PrepareCta size="fr" style={{ alignSelf: "stretch" }}
            label="Prepare my first lesson →" onPress={() => setStep("subject")} />
        </Foot>
      }>
        <Text style={ws.fr_welcome_title}>Welcome to Meyy!</Text>
        {onTrial ? (
          <>
            <View style={[ws.fr_welcome_rule, { backgroundColor: t.pine }]} />
            <View style={[ws.fr_trial_card, { backgroundColor: t.card_bg, borderColor: t.line }]}>
              <View style={[ws.fr_trial_tick, { backgroundColor: t.tint_pine }]}>
                <Text style={ws.fr_trial_tick_t}>✓</Text>
              </View>
              <Text style={ws.fr_trial_h}>Your free trial</Text>
              <Text style={ws.fr_trial_p}>
                {/* WALK-A-012 (2026-09-20): a rejoining number starts with its used chapters already
                    counted (the trial ledger), so say what is LEFT rather than the cap. */}
                {(() => {
                  const cap = trialInfo.trial_chapter_cap;
                  const left = Math.max(0, cap - (trialInfo.trial_chapters_used || 0));
                  return left < cap
                    ? `You have ${left} of your ${cap} free chapters left. `
                    : `Your free trial covers any ${cap} chapters. `;
                })()}For any single
                chapter, you can generate unlimited number of Lesson plans.
              </Text>
              <Text style={ws.fr_trial_h}>To get started</Text>
              <Text style={ws.fr_trial_p}>
                Answer three quick questions and Meyy will create your first lesson plan.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={ws.fr_welcome_h2}>To get started</Text>
            <Text style={ws.fr_welcome_sub}>
              Answer three quick questions and Meyy will create your first lesson plan.
            </Text>
          </>
        )}
      </Frame>
    );
  }

  if (step === "subject") {
    return (
      <Frame foot={
        <Foot>
          <Cta label="Continue" disabled={!subject} onPress={() => setStep("grade")} />
          <BackLink label="← Back" onPress={() => setStep("welcome")} />
        </Foot>
      }>
        <Progress active="Subject" />
        <Text style={ws.fr_q}>What do you teach?</Text>
        <Text style={[ws.fr_hint, { color: t.ink_soft }]}>
          Let’s start with one subject. Roll the box or use the arrows — the subject shown is your pick.
        </Text>
        {visibleSubjects.length === 0 ? (
          subjLoad === "fail" ? (
            <Text style={ws.fr_loading}>Couldn’t load the subject list.{"  "}
              <Text style={{ color: t.pine, textDecorationLine: "underline" }}
                onPress={() => setSubjTry((n) => n + 1)}>Try again</Text>
            </Text>
          ) : subjLoad === "ok" ? (
            <Text style={ws.fr_loading}>
              {frPaidScopes ? "Your subscription doesn’t cover any subject we currently offer. Please contact support."
                            : "No subjects are available just now. Please contact support."}
            </Text>
          ) : <Text style={ws.fr_loading}>Loading subjects…</Text>
        ) : (
          <RollWheel ariaLabel="Subject" value={subject} onChange={setSubject} large loop rowPx={92}
            items={visibleSubjects.map((s) => ({ id: s, chip: pretty(s).charAt(0), label: pretty(s) }))} />
        )}
      </Frame>
    );
  }

  /* ── STEP 2 · CLASS ── */
  if (step === "grade") {
    return (
      <Frame foot={
        <Foot>
          <Cta label="Continue" disabled={!grade} onPress={() => setStep("chapter")} />
          <BackLink label="← Change subject" onPress={() => setStep("subject")} />
        </Foot>
      }>
        <Progress active="Class" />
        <Text style={ws.fr_q}>Which class do you teach {pretty(subject)} to?</Text>
        <Text style={[ws.fr_hint, { color: t.ink_soft }]}>
          You can add more classes later. Roll the box or use the arrows — the class shown is your pick.
        </Text>
        {visibleGrades.length === 0 ? (
          <Text style={ws.fr_loading}>Loading classes…</Text>
        ) : (
          /* Changing class re-earns the right to seed the duration wheel: 50 minutes is a fact
             about Class 9, not about her, so a new class means a new standard. */
          <RollWheel ariaLabel="Class" value={grade} large loop rowPx={92}
            onChange={(v) => { durationTouched.current = false; setGrade(v); }}
            items={visibleGrades.map((g) => ({ id: g, chip: classNum(g), label: `Class ${classNum(g)}` }))} />
        )}
        {/* ★ SECTIONS ARE STATED, NOT ASKED (founder, 2026-08-21). A picker stood here for one
            day and was cut too ("too complicated in first run"). She still gets a real section
            card before the tour — whose steps all anchor on one — without being asked a question
            whose answer is almost always "just the one". */}
        {grades.length > 0 && grade ? (
          <Text style={[ws.fr_sec_note, { borderTopColor: t.line }]}>
            We’ll start you with <Text style={ws.fr_sec_note_b}>Section {tagFor("A")}</Text>. You can
            add or rename sections any time from your teaching profile.
          </Text>
        ) : null}
      </Frame>
    );
  }

  /* ── STEP 3 · CHAPTER (+ the calibrated duration and period count) ── */
  const floorNote = (() => {
    /* The same sub-0.6 coverage floor Prepare shows, applied to her very first lesson. Only
       meaningful for a chapter that HAS a canonical to measure against, and deliberately silent
       about WHICH sections go — Meyy teaches the textbook in its own order.
       ⚠️ TESTED IN PERIODS, NOT MINUTES: the old minutes guard fired AT the floor wherever
       0.6×A rounds down, so asking for 7 warned about being below 7. */
    const cm = Number(canonMinutes[String(chapterNo)]) || 0;
    const dur = Number(durationMin) || 0;
    const totalP = Number(periods) || 0;
    if (!genonAvailable || !cm || !dur || !totalP) return null;
    const floorP = Math.round((0.6 * cm) / dur);
    if (!floorP || totalP >= floorP) return null;
    return `Below ${floorP} periods the plan compresses; some sections may move to guided `
      + "self-study — the plan still closes the chapter and names them.";
  })();

  return (
    <Frame foot={
      <Foot>
        {/* `alignSelf: "stretch"` on the GLOW wrapper, not the box: `.fr-cta` is width 100%, and
            inside `.fr-foot`'s centred column the wrapper would otherwise shrink to its label and
            take the button with it. */}
        <PrepareCta size="fr" style={{ alignSelf: "stretch" }} label="Prepare the lesson →"
          onPress={prepareAndHandOff} disabled={!chosenChapter || activating} busy={activating} />
        <BackLink label="← Change class" onPress={() => setStep("grade")} />
      </Foot>
    }>
      <Progress active="Chapter" />
      <Text style={ws.fr_q}>Choose the chapter to teach</Text>
      <Text style={[ws.fr_hint, { color: t.ink_soft }]}>Roll the box or use arrows to pick one chapter.</Text>
      {chapters.length === 0 ? (
        <Text style={ws.fr_loading}>Loading chapters…</Text>
      ) : (
        <RollWheel ariaLabel="Chapter" value={chapterNo} onChange={pickChapter} rowPx={92}
          padLeft={14} clamp={2}
          items={chapters.map((c) => ({ id: String(c.chapter_number), chip: c.chapter_number,
            // WALK-A-006: the chip already carries the number — drop a leading "Chapter N:".
            label: wheelChapterTitle(c.chapter_title) }))} />
      )}

      <View style={ws.fr_defaults}>
        {/* Class duration — the NCF-derived band (40 ≤VII / 45 VIII / 50 IX–X). */}
        <View style={[editingField === "duration" ? ws.fr_default_edit : ws.fr_default,
          editingField === "duration" ? null : { backgroundColor: t.paper_sunk, borderColor: t.line_soft }]}>
          <View style={ws.fr_default_krow}>
            <Text style={ws.fr_default_kick}>Class duration</Text>
            {/* ⚠️ The two tags read differently ON PURPOSE (founder, 2026-07-26): the DURATION
                bands trace back to the NCF-adapted workbook, the PERIOD count is Meyy's own
                calibration. Do not harmonise them. */}
            {durationMin === stdDuration ? <Text style={ws.fr_tag_rec}>NCF recommended</Text> : null}
          </View>
          {editingField !== "duration" ? (
            <View style={ws.fr_default_row}>
              <Text style={[ws.fr_default_val, ws.fr_default_val_muted]}>{durationMin}-minute classes</Text>
              <Pressable onPress={() => setEditingField("duration")} accessibilityRole="button"
                style={[ws.fr_change_btn, { borderColor: t.line }]}>
                <Text style={ws.fr_change_btn_t}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <RollWheel ariaLabel="Class duration" rowPx={92} large value={String(durationMin)}
                onChange={(v) => { durationTouched.current = true; setDurationMin(Number(v)); }}
                items={DURATION_CHOICES.map((m) => ({ id: String(m), chip: m, label: "minute classes" }))} />
              <Text style={[ws.fr_hint, { color: t.ink_soft, marginTop: 10, marginBottom: 0 }]}>
                Some classes run longer than others. Let’s keep to one duration for now — you can
                add more later.
              </Text>
              <Pressable onPress={() => setEditingField(null)} accessibilityRole="button"
                style={[ws.fr_done_btn, { backgroundColor: t.pine }]}>
                <Text style={ws.fr_done_btn_t}>Done</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Estimated periods — Meyy's own calibration for THIS chapter. */}
        <View style={[editingField === "periods" ? ws.fr_default_edit : ws.fr_default,
          editingField === "periods" ? null : { backgroundColor: t.paper_sunk, borderColor: t.line_soft }]}>
          <View style={ws.fr_default_krow}>
            <Text style={ws.fr_default_kick}>Estimated periods</Text>
            {periods === defaultPeriods ? <Text style={ws.fr_tag_rec}>Meyy recommended</Text> : null}
          </View>
          {editingField !== "periods" ? (
            <View style={ws.fr_default_row}>
              <Text style={[ws.fr_default_val, ws.fr_default_val_muted]}>{periods} periods</Text>
              <Pressable onPress={() => setEditingField("periods")} accessibilityRole="button"
                style={[ws.fr_change_btn, { borderColor: t.line }]}>
                <Text style={ws.fr_change_btn_t}>Change</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <RollWheel ariaLabel="Estimated periods" rowPx={92} large value={String(periods)}
                onChange={(v) => { periodsTouched.current = true; setPeriods(Number(v)); }}
                items={PERIOD_CHOICES.map((p) => ({ id: String(p), chip: p, label: p === 1 ? "period" : "periods" }))} />
              <Pressable onPress={() => setEditingField(null)} accessibilityRole="button"
                style={[ws.fr_done_btn, { backgroundColor: t.pine }]}>
                <Text style={ws.fr_done_btn_t}>Done</Text>
              </Pressable>
            </View>
          )}
          {/* A soft sanity band, never a block — and SILENT while she is sitting ON the
              recommendation: a handful of chapters are calibrated below 5 periods, and warning her
              about a number Meyy itself proposed reads as a bug. */}
          {periods !== defaultPeriods && (periods < 5 || periods > 25) ? (
            <Text style={ws.fr_bud_warn}>
              {periods < 5
                ? "That’s very few periods for a chapter — you can still go ahead."
                : "That’s a lot of periods for one chapter — you can still go ahead."}
            </Text>
          ) : null}
          {floorNote ? <Text style={ws.prep_floor}>{floorNote}</Text> : null}
        </View>
      </View>
    </Frame>
  );
}
