/* ───────── Prepare a lesson — the everyday, single-chapter generate flow (Track D step 5) ─────────
 *
 * A port of `web/app/components/PrepareLesson.jsx`. The bottom-up utilization path: the teacher
 * prepares ONE chapter at a time, sets that chapter's periods, and the certified canonical is
 * adapted to them. Her consumption accrues from these individual acts — no annual plan is
 * required, and this flow NEVER calls the allocator or touches the allocation register. It is
 * deliberately decoupled from the top-down annual-budget allocator, which answers a different
 * question ("how do I spread my 180 periods across the year?") and which the two never gate.
 *
 * ★ ONE CONTROL ON THIS SCREEN (founder, 2026-07-26): a period stepper. The duration matrix the
 * server needs is DERIVED from that number — her declared lengths, in the weekly ratio she
 * teaches them — and only echoed back underneath as small print ("6 × 45 min · 3 × 50 min"). A
 * period length is a fact about her school's timetable, not a per-chapter decision; the bell
 * decides it, she doesn't. A duration field here silently diverged from the profile once
 * (Prepare said 50, My Classes still said 45) and made the budget meter incoherent, because
 * "periods" then meant two different things on one screen.
 *
 * ★ APPORTIONED, NOT ROUNDED (ARV-D-142). The suggestion is this chapter's effort-index SHARE of
 * her own annual budget, taken with `largestRemainder` over the whole chapter list — the same
 * method `master_plan.py` used to author `recommended_periods` and the one Year Plan displays.
 * An independent per-chapter `round(weight/Σweights × budget)` is a DIFFERENT number that does
 * not conserve the budget: on english VI ch 8 it suggested 13 where the master plan says 12, and
 * since that chapter's top canonical is authored at 12, accepting the default asked for more
 * periods than the library holds and fell into the serve engine's surrender path. Both surfaces
 * call the shared `largestRemainder`, so they cannot drift.
 *
 * ★ WHO WAITS (founder, 2026-08-04). A genon serve is ~0.3 ms, so without a hold the plan is
 * simply THERE and the screen changes before the tap finishes — which reads as artificial. The
 * five-second hold is skipped for a plan that is `already_yours`: her own second look is instant,
 * where a plan another teacher happened to warm is still HER first sight of it and gets the full
 * wait. That makes the pause a property of her experience rather than of our infrastructure.
 *
 * ★ THE WAIT DOES NOT HAPPEN HERE (founder, 2026-09-14: "iPhone and expo when preparing a new
 * plan takes us out into a new screen, whereas web app shows the lesson plan generating in My
 * Lessons itself at the top with a progress bar"). Step 5a shipped the web's own `prep-wait`
 * fallback and named it a divergence; this is it closed. Pressing Prepare hands the descriptor
 * to `lib/preparing` and navigates to My Lessons in the SAME tick, where the proposed card is
 * drawn at the head of the list — which is where the web has put it since 2026-08-06, because
 * "she left the place the lesson was going to appear."
 *   ⚠️ THE REQUEST IS DELIBERATELY NOT AWAITED BEFORE THE HANDOFF. This component unmounts
 * immediately, but the async function's closure does not: the fetch keeps running, holds the
 * five-second beat and resolves into the store the screen she is now looking at is watching.
 * Awaiting it is exactly what would keep her here. Same trick the web's `prepareAndHandOff`
 * relies on, and the reason `setState` after the await is never used on this path.
 *
 * ⚠️ ONE DIVERGENCE LEFT, named as CLAUDE.md §4 requires: NO PREVIEW STEP. The web falls back to
 * rendering the built plan inline when no `onPrepared` handler is passed; here there is always
 * somewhere to go, so a successful prepare leaves the chapter in My Lessons' list. Attaching it
 * to a class stays a separate, deliberate act from the "+" on a section card — one true way.
 *
 * Measures live in theme/web.js under `prep_*` (§4 rule 2).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "../../components/Text";
import {
  annualBudgetPeriods, classNum, getJSON, largestRemainder, pad,
  postJSON, pretty,
} from "@aruvi/shared/format";
import { cachedReadiness, fetchReadiness, subscribeReadiness } from "@aruvi/shared/readiness";
import { entitlementState, subscribeEntitlement } from "@aruvi/shared/entitlement";
import { cachedPlans, fetchPlans, invalidatePlans } from "@aruvi/shared/plans";
import { readLocalSection, bindSectionChapter } from "@aruvi/shared/sectionState";
import { verifiedWrite, planIsPrepared } from "@aruvi/shared/verify";
import { startPreparing, clearPreparing, failPreparing, paywallPreparing } from "../../lib/preparing";
import { Sheet } from "../../components/AttachSheet";
import { RollWheel } from "../../components/RollWheel";
import PrepareCta from "../../components/PrepareCta";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";
import { type } from "../../theme/type";

const DEFAULT_PERIODS = 12;   // only when neither a budget-based suggestion nor a weight exists
const PREPARING_MS = 5000;

export default function Prepare() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  /* `section` / `tag` arrive only when this screen was opened from a section card's "+" picker
     (AttachSheet's footer). They change the whole shape of the journey — see `fromSection`. */
  const { subject, grade, section, tag } = useLocalSearchParams();
  const fromSection = !!section;

  const [readiness, setReadiness] = useState(() => cachedReadiness());
  const [chapters, setChapters] = useState([]);
  const [chapterNo, setChapterNo] = useState("");
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  const [plans, setPlans] = useState(() => cachedPlans(`${subject}/${grade}`) || []);
  const [genonChs, setGenonChs] = useState([]);
  const [canonMinutes, setCanonMinutes] = useState({});
  const [canonPeriods, setCanonPeriods] = useState({});
  const [syllabusW, setSyllabusW] = useState(null);
  const [trialInfo, setTrialInfo] = useState(() => entitlementState().ent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [warnRegen, setWarnRegen] = useState(false);
  /* Re-entry guard, kept although a partition is free and instant: a second press during an
     in-flight request would still double-register and can race the return. The ref blocks
     re-entry even if a press slips past the disabled button. */
  const inFlight = useRef(false);

  /* The free-chapter counter reads the shell's store rather than asking again (6a F5). This
     screen is pushed and popped several times in a sitting; the shell polls throughout. */
  useEffect(() => subscribeEntitlement((e) => setTrialInfo(e.ent)), []);
  /* Paint from the store and KEEP LISTENING (2026-09-17) — a subject bought in the subscribe
     wizard has to be choosable here too, and this screen is pushed and popped rather than
     remounted on every crossing. The fetch no longer sets state itself: the store emits on every
     write, the subscription above is the one path in. */
  useEffect(() => subscribeReadiness((r) => { if (r) setReadiness(r); }), []);
  useEffect(() => { fetchReadiness().catch(() => {}); }, []);

  /* Chapters (+ effort weight), her plan listing, and which chapters have a certified canonical.
     `placeholder: true` = budgeted but unpublished ("Book awaited") — nothing to generate from,
     so it never enters this picker; the Year Plan is where those rows live. */
  useEffect(() => {
    if (!subject || !grade) return;
    let live = true;
    getJSON(`/subjects/${subject}/${grade}/chapters`)
      .then((d) => {
        if (!live) return;
        setChapters((d.chapters || []).filter((c) => !c.placeholder));
        setSyllabusW(d.syllabus_total_weight || null);
      })
      .catch(() => { if (live) { setChapters([]); setSyllabusW(null); } });
    fetchPlans(`${subject}/${grade}`).then((r) => { if (live) setPlans(r); }).catch(() => {});
    getJSON(`/genon/${subject}/${grade}/chapters`)
      .then((d) => {
        if (!live) return;
        setGenonChs(d.chapters || []);
        setCanonMinutes(d.canonical_minutes || {});
        setCanonPeriods(d.canonical_periods || {});
      })
      .catch(() => { if (live) { setGenonChs([]); setCanonMinutes({}); } });
    return () => { live = false; };
  }, [subject, grade]);

  const genonAvailable = !!chapterNo && genonChs.includes(Number(chapterNo));

  /* Her period LENGTHS and the weekly ratio she teaches them in, from the canonical profile
     (grade-level first, subject-level fallback). */
  const classProfile = useMemo(() => {
    const subs = (readiness && readiness.subjects) || [];
    const slug = (n) => (n || "").toLowerCase().replace(/ /g, "_");
    const sub = subs.find((s) => slug(s.name) === subject);
    const g = sub && (sub.grades || []).find((x) => (x.grade || "").toLowerCase() === grade);
    const raw = (g && g.durations) || (sub && sub.durations) || [];
    const durations = raw.length ? raw.map(Number).filter((n) => n > 0) : [40];
    return { durations, ppw: (g && g.ppw_by_duration) || {} };
  }, [readiness, subject, grade]);

  /* Split `n` periods across her declared lengths in the SAME weekly ratio she teaches them
     (largest remainder, so the parts sum to n exactly). Dumping all n on `durations[0]` — the
     SHORTEST length after the profile's ascending sort, not her main one — is what made a 45/50
     class read as "45 min" flat. */
  const seedRows = useCallback((n) => {
    const ppw = classProfile.ppw || {};
    const ds = classProfile.durations;
    const at = (d) => Number(ppw[d] ?? ppw[String(d)]) || 0;
    const active = ds.filter((d) => at(d) > 0);
    const fallback = [{ duration: ds[0] || 40, count: n }];
    if (active.length < 2) return active.length === 1 ? [{ duration: active[0], count: n }] : fallback;
    const tot = active.reduce((s, d) => s + at(d), 0);
    const parts = active.map((d) => {
      const x = (n * at(d)) / tot;
      return { d, c: Math.floor(x), frac: x - Math.floor(x) };
    });
    let rem = n - parts.reduce((s, p) => s + p.c, 0);
    [...parts].sort((a, b) => b.frac - a.frac).forEach((p) => { if (rem > 0) { p.c++; rem--; } });
    const out = parts.filter((p) => p.c > 0).map((p) => ({ duration: p.d, count: p.c }));
    return out.length ? out : fallback;
  }, [classProfile]);

  const annualBudget = useMemo(
    () => annualBudgetPeriods(readiness, subject, grade), [readiness, subject, grade]);

  /* Denominator of each chapter's share: the FULL syllabus weight from the master plan (it
     INCLUDES placeholder chapters with no content yet — founder, 2026-07-25), falling back to the
     listed chapters' sum only when no master plan exists. Dividing by the listed sum alone
     inflates every suggestion until the full book lands. */
  const sumW = useMemo(
    () => Number(syllabusW) || chapters.reduce((s, c) => s + (Number(c.weight) || 0), 0),
    [syllabusW, chapters]);

  const sugByChapter = useMemo(() => {
    const out = {};
    if (annualBudget == null || !chapters.length) return out;
    const wts = chapters.map((c) => (Number(c.weight) > 0 ? Number(c.weight) : 0));
    const listed = wts.reduce((a, b) => a + b, 0);
    if (listed <= 0) return out;
    /* Guard for the case the API could not supply the placeholder rows: apportion across the
       listed chapters PLUS one synthetic bucket carrying the syllabus weight they don't cover,
       then discard it. With a complete list the bucket is 0 and this is a plain apportionment. */
    const missing = Math.max(0, (Number(sumW) || listed) - listed);
    const dist = largestRemainder(annualBudget, missing > 0 ? [...wts, missing] : wts);
    chapters.forEach((c, i) => { out[c.chapter_number] = dist[i] > 0 ? dist[i] : 1; });
    return out;
  }, [chapters, annualBudget, sumW]);

  const suggestionFor = (c) => {
    if (!c) return DEFAULT_PERIODS;
    const v = sugByChapter[c.chapter_number];
    return v != null ? v : DEFAULT_PERIODS;
  };
  const chosen = chapters.find((c) => String(c.chapter_number) === String(chapterNo));
  const suggestion = suggestionFor(chosen);

  // The suggestion becomes the default the moment a chapter is chosen — still editable.
  useEffect(() => {
    const c = chapters.find((x) => String(x.chapter_number) === String(chapterNo));
    if (c) setPeriods(suggestionFor(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterNo, chapters, annualBudget, sumW]);

  /* ★ MEMOISED, and the wheel does not work without it. RollWheel reparks the box on `[items]`;
     a list rebuilt inline is a new identity on EVERY render, so the effect fired on every render
     and dragged the box back to whatever `value` still held. Paired with the missing web scroll
     event above, that is precisely "it goes back to chapter 1": the pick never committed, and the
     repark then restored the stale one. The same fix the two My Lessons wheels already carry —
     this one was written after them and missed it. */
  const chapterItems = useMemo(() => chapters.map((c) => ({
    id: String(c.chapter_number), chip: c.chapter_number, label: c.chapter_title,
  })), [chapters]);

  const rows = useMemo(() => seedRows(Math.max(0, Number(periods) || 0)), [periods, seedRows]);
  const mixLabel = rows.map((r) => `${r.count} × ${r.duration} min`).join(" · ");

  /* Files currently ATTACHED to a section of this class — so a chapter a class is actively
     teaching counts toward the budget even if its `prepared` write was lost (mirrors My Lessons'
     `p.prepared || isAttached(p)`). */
  const attachedFiles = useMemo(() => {
    const set = new Set();
    const subs = (readiness && readiness.subjects) || [];
    const slug = (n) => (n || "").toLowerCase().replace(/ /g, "_");
    const sub = subs.find((s) => slug(s.name) === subject);
    const g = sub && (sub.grades || []).find((x) => (x.grade || "").toLowerCase() === grade);
    ((g && g.sections) || []).forEach((sec) => {
      const f = readLocalSection(`${subject}_${grade}_${sec.tag}`).chapter;
      if (f) set.add(f);
    });
    return set;
  }, [readiness, subject, grade]);

  /* Chapters already prepared for THIS class — one row per chapter, each contributing its chosen
     period count. Excludes the chapter she is preparing now (that is proposed, not committed) and
     anything archived. */
  const committed = useMemo(() => {
    const arr = (plans || []).filter(
      (p) => (p.prepared || attachedFiles.has(p.filename)) && !p.archived
        && String(p.chapter_number) !== String(chapterNo));
    const byCh = {};
    arr.forEach((p) => {
      const k = String(p.chapter_number);
      const prev = byCh[k];
      if (!prev || String(p.prepared_at || "") > String(prev.prepared_at || "")) byCh[k] = p;
    });
    return Object.values(byCh).map((p) => ({
      filename: p.filename,
      chapter_number: p.chapter_number,
      chapter_title: p.chapter_title,
      /* Her CHOSEN periods. Fall back to the served plan's authored unit count only when no
         chosen count was stored (a first-run prepare). */
      periods: (p.prepared_periods != null ? Number(p.prepared_periods) : Number(p.total_units)) || 0,
    })).sort((a, b) => (Number(a.chapter_number) || 0) - (Number(b.chapter_number) || 0));
  }, [plans, attachedFiles, chapterNo]);

  const chosenAlreadyPrepared = useMemo(
    () => !!chapterNo && (plans || []).some(
      (p) => String(p.chapter_number) === String(chapterNo)
        && (p.prepared || attachedFiles.has(p.filename))),
    [plans, chapterNo, attachedFiles]);

  const committedTotal = committed.reduce((s, c) => s + c.periods, 0);
  const left = annualBudget != null ? annualBudget - committedTotal : null;
  const over = left != null && left < 0;

  const holdPreparing = (startedAt, alreadyYours) => {
    if (alreadyYours) return Promise.resolve();
    const remaining = Math.max(0, PREPARING_MS - (Date.now() - startedAt));
    return new Promise((res) => setTimeout(res, remaining));
  };

  const runGenerate = async () => {
    if (!chosen) return;
    /* ── NO CANONICAL → NO LESSON (founder, 2026-08-10). The saved-plan fallback is RETIRED: it
       used to serve a DIFFERENT CHAPTER as a "stand-in preview", which hid the one thing she and
       we both need to know — that we have not authored her chapter yet. Deliberately the SAME
       sentence the API returns for the same condition, so a chapter silently losing its canonical
       shows up as this line rather than as a plausible-looking wrong lesson. */
    if (!genonAvailable) { setError("No underlying chapter yet."); return; }

    const matrix = rows
      .map((r) => ({ duration: Number(r.duration) || 0, count: Number(r.count) || 0 }))
      .filter((r) => r.duration > 0 && r.count > 0);
    if (!matrix.length) { setError("Add at least one duration row."); return; }

    setBusy(true); setError("");
    const startedAt = Date.now();
    /* The card goes up FIRST, from what she just told us — chapter, class, period shape. Nothing
       here is invented and nothing is fetched to draw it. Then we LEAVE, in the same tick, and
       everything below resolves into the store from a closure this screen no longer owns. */
    const descriptor = {
      /* `section`/`tag` ride along so My Classes knows WHICH CARD is waiting. Absent on an
         ordinary prepare, which is what puts the card in My Lessons instead. */
      section: fromSection ? String(section) : null,
      sectionTag: tag ? String(tag) : "",
      subject, grade, chapterNo,
      chapterTitle: (chosen.chapter_title || chosen.title) || `Chapter ${chapterNo}`,
      rows: matrix,
    };
    /* ★ ONE WAIT, ON THE CARD THE LESSON IS FOR (founder, 2026-09-15: "The result of 'prepare a
       lesson plan' from section card should be consistent with what happens upon similar action
       in My Lessons: it should show progress on the section card from which it was generated and
       upon completion, settle in the section card with the new LP attached").
       ⚠️ THIS OVERRULES THE WEB, and the web moved with it. page.jsx had EXCLUDED this path from
       the 2026-08-06 rule — "it lands in My Classes, not My Lessons, so there is nowhere to put
       this card" — which read the rule as being about My Lessons. It is not: it is about the
       wait happening WHERE THE LESSON WILL APPEAR. Launched from a section card, the thing she
       is waiting for appears on THAT CARD, so that is where the bar belongs. The premise was
       wrong, not the rule.
       So both surfaces now hand off immediately and go to My Classes; nobody waits on this
       screen any more. */
    startPreparing(descriptor);
    router.navigate(fromSection ? "/" : "/lessons");
    try {
      const resp = await postJSON(`/genon/${subject}/${grade}/${chapterNo}/plan`, { rows: matrix });
      /* READ-AFTER-WRITE (area 2). The serve returned a filename, so Y is now knowable: "that
         lesson is in MY prepared register". A mismatch means the plan was built but never became
         hers — she would find it missing from My Lessons with no idea why. The write is already
         done, so this only READS. */
      verifiedWrite({
        write: async () => {},
        read: () => getJSON("/plans-prepared").then((d) => (d && (d.prepared || d.plans)) || d || {}),
        expect: (y) => planIsPrepared(y, subject, grade, resp.filename),
      }).then(({ status }) => {
        if (status === "mismatch") {
          /* ★ IT HAS TO LAND ON THE CARD, BECAUSE THIS SCREEN IS GONE (app. 05 row D9).
             `router.navigate` fired several lines above — the handoff is immediate and nobody
             waits here any more — so `setError` was writing into a component that is no longer
             mounted, and the ONE case this check exists for said nothing at all: the plan built,
             never became hers, and she would have gone looking for it in My Lessons with no
             idea why it was missing. The verified-write is the whole point of the read-back;
             losing its only output made the check decorative.
             This is the ARV-D-087 shape: **a message must be delivered where the teacher is
             looking, not where the code that produced it happened to live.** `failPreparing`
             puts it on the preparing card — My Lessons or the section card, wherever the wait
             is being drawn — which is the same place every other failure on this path appears. */
          failPreparing("The lesson was built but didn’t reach your lessons — please prepare it again.");
        }
      }).catch(() => {});

      await holdPreparing(startedAt, !!resp.already_yours);
      /* Her flags just moved, so the shared listing must be re-read rather than re-used — the
         same rule every other prepare path follows. Invalidate BEFORE clearing: My Lessons
         refetches on the clear, and it must not be served the copy that predates this plan. */
      invalidatePlans(`${subject}/${grade}`);
      /* ★ IT SETTLES ATTACHED (founder, same report). She opened the picker for THIS section and
         asked for a chapter that does not exist yet; making her pick it again out of a list, on
         a screen she is already standing on, is a question whose answer she has already given.
         The binding is written BEFORE the card comes down, so the card never blinks through an
         unattached state on its way to being attached. */
      if (fromSection) bindSectionChapter(String(section), resp.filename);
      clearPreparing();
    } catch (e) {
      /* ── THE PAYWALL IS NOT AN ERROR (founder, 2026-08-24). A 402 (trial exhausted / out of
         subscription) must never render as a failed card or an inline message — the card comes
         DOWN and a window carries the sentence instead. The server's own wording travels up
         unchanged: it is written FOR HER, and testing.md C13 exists to police exactly that. */
      const msg = (e && e.detail)
        ? e.detail
        : "Couldn’t build the lesson plan right now. Try again in a moment.";
      /* She is in My Lessons watching the card, so the failure has to reach HER, not this
         screen — it goes back up the way it went down. The 402 pulls the card and raises the
         window there instead, because a paywall is not a failed build. */
      /* She is watching the SECTION CARD now, exactly as the My Lessons path watches its own
         card, so a failure goes back up the way it went down on both. */
      if (e && e.status === 402) paywallPreparing(msg);
      else failPreparing(msg);
    } finally {
      setBusy(false);
    }
  };

  const doGenerate = async () => {
    if (!chosen || inFlight.current) return;
    inFlight.current = true;
    try { await runGenerate(); } finally { inFlight.current = false; }
  };
  // Already prepared? Warn first — re-preparing replaces the tracked version.
  const onPrepareClick = () => {
    if (!chosen) return;
    if (chosenAlreadyPrepared) { setWarnRegen(true); return; }
    doGenerate();
  };

  const setP = (n) => setPeriods(Number.isFinite(n) && n >= 0 ? n : 0);

  const Box = ({ children, style }) => (
    <View style={[ws.prep_box, { backgroundColor: t.paper, borderColor: t.line }, style]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <ScrollView contentContainerStyle={ws.main} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 16 }}>
          <Text style={[ws.prep_h2, { flex: 1, minWidth: 0 }]}>Prepare a lesson plan</Text>
          {/* Back to MY LESSONS, which is where she came from and where the lesson will land —
              `navigate` so it returns to the screen already on the stack rather than pushing a
              second copy of it (the bar's own rule). The web was changed to match this the same
              day: it had been landing on My Classes. */}
          {/* ⚠️ CANCEL RETURNS HER WHERE SHE CAME FROM. Launched from a section card's "+" picker
              this screen is a DETOUR out of My Classes, and a back that lands on My Lessons
              abandons her somewhere she did not ask to be — with the slot she opened the picker
              to fill still empty and no sign of it. The same rule the profile portal follows:
              every exit from a detour ends at the door it came in by. */}
          <Pressable onPress={() => router.navigate(fromSection ? "/" : "/lessons")}
            accessibilityRole="button" hitSlop={8}
            style={[ws.prep_back, { borderColor: t.pine }]}>
            <Text style={[ws.prep_back_t, { color: t.pine }]}>← back</Text>
          </Pressable>
        </View>
        <Text style={ws.prep_scope}>{pretty(subject)} · Class {classNum(grade)}</Text>
        <Text style={ws.prep_instr}>
          Pick one chapter and enter the periods you plan to spend teaching it.
        </Text>

        {/* Trial counter — shown only once a chapter has actually been spent (the welcome page
            already stated the terms, so a fresh trial shows nothing here; founder, 2026-08-24).
            This is the moment she is about to spend one, which is the only moment the number
            informs a decision. Hidden when the gate is off, she isn't on trial, or the fetch
            failed — a failure never blocks and never invents an answer about her record. */}
        {trialInfo && trialInfo.enforced && trialInfo.status === "trial"
          && trialInfo.trial_chapters_used > 0 ? (
          <Text style={ws.trial_note}>
            {trialInfo.trial_chapters_used} of {trialInfo.trial_chapter_cap} free chapters used.
            Regenerating same chapter allowed.
          </Text>
        ) : null}

        {!chapters.length ? (
          <Text style={ws.empty}>No chapter mappings for this subject &amp; grade yet.</Text>
        ) : (
          <>
            {/* Clear the refusal the moment she moves the wheel: the message is about the chapter
                that WAS selected, so leaving it under a different one would accuse the wrong
                chapter. Only the error is cleared — the period count she set is hers to keep. */}
            <RollWheel ariaLabel="Chapter" value={chapterNo} rowPx={92} padLeft={14} clamp={2}
              onChange={(id) => { setChapterNo(id); setError(""); }}
              items={chapterItems} />

            <View style={ws.prep_block}>
              <View style={ws.prep_left}>
                <Text style={ws.prep_fieldlab}>Periods for this chapter</Text>
                <View style={ws.prep_stepper}>
                  <Pressable onPress={() => setP((Number(periods) || 0) - 1)} hitSlop={6}
                    accessibilityRole="button" accessibilityLabel="fewer periods"
                    style={[ws.prep_step_btn, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
                    <Text style={ws.prep_step_glyph}>–</Text>
                  </Pressable>
                  {/* `selectTextOnFocus` so tapping it replaces the number rather than making
                      her clear it digit by digit — the one number on this screen she is most
                      likely to want to overwrite outright. */}
                  <TextInput value={String(periods)} keyboardType="number-pad" selectTextOnFocus
                    onChangeText={(v) => setP(parseInt(v, 10))}
                    accessibilityLabel="Periods for this chapter"
                    style={[ws.prep_step_v, { borderColor: t.line, backgroundColor: t.paper_2 }]} />
                  <Pressable onPress={() => setP((Number(periods) || 0) + 1)} hitSlop={6}
                    accessibilityRole="button" accessibilityLabel="more periods"
                    style={[ws.prep_step_btn, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
                    <Text style={ws.prep_step_glyph}>+</Text>
                  </Pressable>
                </View>
                {genonAvailable && mixLabel ? <Text style={ws.prep_mix}>{mixLabel}</Text> : null}
                {genonAvailable ? <CoverageNote ws={ws} rows={rows}
                  canonMin={canonMinutes[String(chapterNo)]}
                  canonTop={canonPeriods[String(chapterNo)]} /> : null}
              </View>

              {chosen ? (
                <View style={[ws.prep_right, { borderLeftColor: t.line }]}>
                  <Box>
                    <View style={ws.prep_sugg_hd}>
                      <Text style={ws.prep_sugg_k}>Suggestion</Text>
                      <Pressable onPress={() => setShowInfo((v) => !v)} hitSlop={8}
                        accessibilityRole="button" accessibilityLabel="How the suggestion is made"
                        style={ws.prep_info}>
                        <Text style={ws.prep_info_t}>i</Text>
                      </Pressable>
                    </View>
                    <View style={ws.prep_sugg_body}>
                      <Text style={ws.prep_sugg_val}>{suggestion}</Text>
                      {periods === suggestion ? (
                        <Text style={ws.prep_sugg_ok} accessibilityLabel="matches the suggestion">✓</Text>
                      ) : (
                        <Pressable onPress={() => setPeriods(suggestion)} hitSlop={6}
                          accessibilityRole="button" style={ws.prep_use}>
                          <Text style={ws.prep_use_t}>use</Text>
                        </Pressable>
                      )}
                    </View>
                  </Box>

                  {annualBudget != null ? (
                    <Box>
                      <View style={ws.prep_brow}>
                        <Text style={ws.prep_brow_k}>Total periods</Text>
                        <Text style={[ws.prep_brow_v, { color: t.pine_d }]}>{annualBudget}</Text>
                      </View>
                      <Pressable disabled={!committed.length} onPress={() => setShowBreakdown(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Used ${committedTotal} periods${committed.length ? " — view breakdown" : ""}`}
                        style={[ws.prep_brow, ws.prep_brow_div, { borderTopColor: t.line_soft }]}>
                        <Text style={ws.prep_brow_k}>
                          Used{committed.length ? <Text style={{ color: t.pine }}> ⓘ</Text> : null}
                        </Text>
                        <Text style={[ws.prep_brow_v, { color: t.clay }]}>{committedTotal}</Text>
                      </Pressable>
                      <View style={[ws.prep_brow, ws.prep_brow_div, { borderTopColor: t.line_soft }]}>
                        <Text style={ws.prep_brow_k}>Available</Text>
                        <Text style={[ws.prep_brow_v, over && { color: t.clay }]}>
                          {over ? `−${-left}` : left}
                        </Text>
                      </View>
                    </Box>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* The info note sits UNDER the two columns rather than as a floating popover: a
                230px-wide absolute tip anchored to a 152px column has nowhere to go on a phone
                without covering the figures it explains. Same words, same trigger. */}
            {showInfo ? (
              <View style={[ws.prep_tip, { backgroundColor: t.paper_2, borderColor: t.line }]}>
                <Text style={ws.prep_tip_t}>
                  Meyy shares your annual budget for this class across its chapters by each
                  chapter’s effort index — heavier chapters get more periods. It’s a starting
                  point, so you can change it freely.
                </Text>
              </View>
            ) : null}

            {/* The error belongs WHERE SHE IS — beside the button she pressed, with the picker
                still in front of her so the fix (choose another chapter) is one tap away. */}
            {!busy && error ? (
              <Text style={ws.prep_floor} accessibilityLiveRegion="assertive">{error}</Text>
            ) : null}

            <View style={ws.prep_savebar}>
              <PrepareCta size="primary" disabled={!chosen} busy={busy} onPress={onPrepareClick}
                label={busy ? "Building the lesson…"
                  : chosenAlreadyPrepared ? "Prepare again →" : "Prepare the lesson →"} />
              {busy ? (
                <Text style={ws.prep_hint} accessibilityLiveRegion="polite">Working on it…</Text>
              ) : !chosen ? (
                <Text style={ws.prep_hint}>Pick a chapter to continue.</Text>
              ) : chosenAlreadyPrepared ? (
                <Text style={ws.prep_hint}>
                  Already prepared — preparing again replaces the tracked version.
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── re-prepare confirm ── */}
      <Sheet visible={!!warnRegen && !!chosen} onClose={() => setWarnRegen(false)} confirm
        kicker={`${pretty(subject)} · Class ${classNum(grade)}`} title="Prepare this chapter again?"
        sub={chosen ? `You’ve already prepared “${chosen.chapter_title}” for this class. Preparing it again makes a fresh lesson plan — and for budget tracking, only this latest version will count.` : ""}>
        <View style={ws.ap_actions}>
          <Pressable onPress={() => setWarnRegen(false)} accessibilityRole="button"
            style={[ws.ap_btn, { borderColor: t.line }]}>
            <Text style={[ws.ap_btn_label, { color: t.ink_soft }]}>Cancel</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => { setWarnRegen(false); doGenerate(); }}
            accessibilityRole="button" style={[ws.ap_btn, { borderColor: t.clay, backgroundColor: t.clay }]}>
            {/* `#fff`, matching .ap-btn-danger — not --paper, which goes near-black in dark.
                The same literal AttachSheet's "Stop tracking" already uses. */}
            <Text style={[ws.ap_btn_label, { color: "#fff" }]}>Prepare again</Text>
          </Pressable>
        </View>
      </Sheet>

      {/* ── committed breakdown ── */}
      <Sheet visible={showBreakdown} onClose={() => setShowBreakdown(false)}
        kicker={`${pretty(subject)} · Class ${classNum(grade)}`} title="Committed so far"
        sub="Periods already taken by the lessons you’ve prepared for this class.">
        <View>
          {committed.map((c, i) => (
            <View key={c.filename}
              style={[ws.prep_brk_row, i > 0 && { borderTopWidth: 1, borderTopColor: t.line_soft }]}>
              <Text style={ws.prep_brk_ch}>Ch {pad(c.chapter_number)}</Text>
              <Text style={ws.prep_brk_name} numberOfLines={1}>{c.chapter_title}</Text>
              <Text style={ws.prep_brk_p}>{c.periods}</Text>
            </View>
          ))}
          <View style={[ws.prep_brk_total, { borderTopColor: t.line }]}>
            <Text style={ws.prep_brk_tot_k}>Total committed</Text>
            <Text style={ws.prep_brk_tot_v}>{committedTotal} periods</Text>
          </View>
        </View>
      </Sheet>

    </View>
  );
}

/* ── the ONE coverage warning worth showing (founder, 2026-07-26) ──
 * Below 60% of the certified plan's minutes, trailing sections cannot be scheduled at all. The
 * 60–80% "compressed" note is dropped — compression is normal, not news. We deliberately do NOT
 * name which sections go: Aruvi teaches the textbook in its own order, so "the later ones" is
 * something she can already deduce. The minimum is expressed in periods like the ones she
 * actually has — against the average length of HER mix, not a hardcoded length.
 *
 * ⚠️ THE TEST IS IN PERIODS, NOT MINUTES (fix 2026-08-02). The old guard asked
 * `totalMin / cm < 0.6` while the sentence printed the ROUNDED period floor, so the two
 * disagreed wherever 0.6 × A rounds DOWN — at A=12 the floor is round(7.2)=7 but 7/12=0.583, so
 * a teacher asking for exactly 7 was warned about being below 7. That band is the common case,
 * not an edge. The floor is defined in PERIODS in master_plan, so the comparison has to be too —
 * and now the test and the sentence use one number by construction.
 *
 * Surrender sits in the same place (founder, 2026-08-01): above the chapter's fullest plan the
 * extra periods return to her budget, said HERE, before Generate, and nowhere else. Count-based
 * from the API, because surrender compares COUNTS — a minutes/average approximation misfires on
 * mixed-duration profiles.
 */
function CoverageNote({ ws, rows, canonMin, canonTop }) {
  const cm = Number(canonMin) || 0;
  const totalMin = rows.reduce((s, r) => s + (Number(r.duration) || 0) * (Number(r.count) || 0), 0);
  const totalP = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
  if (!cm || !totalMin || !totalP) return null;

  const topP = Number(canonTop) || Math.round(cm / (totalMin / totalP));
  if (totalP > topP) {
    const back = totalP - topP;
    return (
      <Text style={ws.prep_floor}>
        Above {topP} periods, the extra {back} return{back === 1 ? "s" : ""} to your budget —
        this chapter’s fullest plan uses {topP}.
      </Text>
    );
  }
  const floorP = Math.round((0.6 * cm) / (totalMin / totalP));
  if (!floorP || totalP >= floorP) return null;
  return (
    <Text style={ws.prep_floor}>
      Below {floorP} periods the plan compresses; some sections may move to guided self-study —
      the plan still closes the chapter and names them.
    </Text>
  );
}
