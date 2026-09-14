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
 * ⚠️ TWO DIVERGENCES FROM THE WEB, named as CLAUDE.md §4 requires:
 *   1. THE WAIT HAPPENS HERE, on this screen, not as a proposed card at the head of My Lessons.
 *      The web moved it there on 2026-08-06 because its shell holds `preparing` across a tab
 *      switch; on the phone these are separate ROUTES with no shell between them, so there is
 *      nowhere to put the card without a cross-route store. The web's own `prep-wait` card — the
 *      fallback it still keeps "for a caller that has nowhere to put one" — is what runs here,
 *      verbatim. The store and the proposed card are the next step, not a redesign.
 *   2. NO PREVIEW STEP. The web falls back to rendering the built plan inline when no
 *      `onPrepared` handler is passed; here there is always somewhere to go, so a successful
 *      prepare returns to My Lessons with the chapter now in the list. Attaching it to a class
 *      stays a separate, deliberate act from the "+" on a section card — one true way.
 *
 * Measures live in theme/web.js under `prep_*` (§4 rule 2).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "../../components/Text";
import {
  annualBudgetPeriods, classNum, fetchEntitlement, getJSON, getUser, largestRemainder, pad,
  postJSON, pretty,
} from "@aruvi/shared/format";
import { cachedReadiness, fetchReadiness } from "@aruvi/shared/readiness";
import { cachedPlans, fetchPlans, invalidatePlans } from "@aruvi/shared/plans";
import { readLocalSection } from "@aruvi/shared/sectionState";
import { verifiedWrite, planIsPrepared } from "@aruvi/shared/verify";
import Bar from "../../components/Bar";
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
  const { subject, grade } = useLocalSearchParams();

  const [readiness, setReadiness] = useState(() => cachedReadiness());
  const [chapters, setChapters] = useState([]);
  const [chapterNo, setChapterNo] = useState("");
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  const [plans, setPlans] = useState(() => cachedPlans(`${subject}/${grade}`) || []);
  const [genonChs, setGenonChs] = useState([]);
  const [canonMinutes, setCanonMinutes] = useState({});
  const [canonPeriods, setCanonPeriods] = useState({});
  const [syllabusW, setSyllabusW] = useState(null);
  const [trialInfo, setTrialInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [warnRegen, setWarnRegen] = useState(false);
  const [paywall, setPaywall] = useState("");
  /* Re-entry guard, kept although a partition is free and instant: a second press during an
     in-flight request would still double-register and can race the return. The ref blocks
     re-entry even if a press slips past the disabled button. */
  const inFlight = useRef(false);

  useEffect(() => { fetchEntitlement().then(setTrialInfo); }, []);
  useEffect(() => { fetchReadiness().then(setReadiness).catch(() => {}); }, []);

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
       here is invented and nothing is fetched to draw it. */
    setPreparing({
      chapterTitle: (chosen.chapter_title || chosen.title) || `Chapter ${chapterNo}`,
      rows: matrix,
    });
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
          setError("The lesson was built but didn’t reach your lessons — please prepare it again.");
        }
      }).catch(() => {});

      await holdPreparing(startedAt, !!resp.already_yours);
      /* Her flags just moved, so the shared listing must be re-read rather than re-used — the
         same rule every other prepare path follows. */
      invalidatePlans(`${subject}/${grade}`);
      router.replace("/lessons");
    } catch (e) {
      /* ── THE PAYWALL IS NOT AN ERROR (founder, 2026-08-24). A 402 (trial exhausted / out of
         subscription) must never render as a failed card or an inline message — the card comes
         DOWN and a window carries the sentence instead. The server's own wording travels up
         unchanged: it is written FOR HER, and testing.md C13 exists to police exactly that. */
      const msg = (e && e.detail)
        ? e.detail
        : "Couldn’t build the lesson plan right now. Try again in a moment.";
      if (e && e.status === 402) setPaywall(msg);
      else setError(msg);
    } finally {
      setPreparing(null);
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

  /* ── the preparing card — SHE STAYS HERE; the lesson she is about to get, at rest ── */
  if (preparing) {
    const totalP = (preparing.rows || []).reduce((a, r) => a + (Number(r.count) || 0), 0);
    const shape = (preparing.rows || []).map((r) => `${r.count} × ${r.duration} min`).join(" + ");
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        <Bar user={getUser()} />
        <View style={[ws.main, ws.prep_wait]} accessibilityLiveRegion="polite">
          <Text style={ws.prep_scope}>{pretty(subject)} · Class {classNum(grade)}</Text>
          <View style={[ws.prep_wait_card, { backgroundColor: t.paper_2, borderColor: t.line }]}>
            <Text style={ws.prep_wait_title}>{preparing.chapterTitle}</Text>
            <Text style={ws.prep_wait_meta}>
              {totalP} {totalP === 1 ? "period" : "periods"}{shape ? ` · ${shape}` : ""}
            </Text>
            <View style={ws.prep_wait_dots}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={[ws.prep_wait_dot, { backgroundColor: t.line }]} />
              ))}
            </View>
            <Text style={ws.prep_wait_note}>Preparing your lesson plan…</Text>
          </View>
        </View>
      </View>
    );
  }

  const Box = ({ children, style }) => (
    <View style={[ws.prep_box, { backgroundColor: t.paper, borderColor: t.line }, style]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar user={getUser()} />
      <ScrollView contentContainerStyle={ws.main} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 16 }}>
          <Text style={[ws.prep_h2, { flex: 1, minWidth: 0 }]}>Prepare a lesson plan</Text>
          {/* Back to MY LESSONS, which is where she came from and where the lesson will land —
              `navigate` so it returns to the screen already on the stack rather than pushing a
              second copy of it (the bar's own rule). The web was changed to match this the same
              day: it had been landing on My Classes. */}
          <Pressable onPress={() => router.navigate("/lessons")} accessibilityRole="button" hitSlop={8}
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
              items={chapters.map((c) => ({
                id: String(c.chapter_number), chip: c.chapter_number, label: c.chapter_title,
              }))} />

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

      {/* ── the paywall. NOT an error: the card comes down and this carries the server's own
             sentence, with nowhere to go but back. Subscribing happens on the web for now. ── */}
      <Sheet visible={!!paywall} onClose={() => setPaywall("")} confirm
        kicker={`${pretty(subject)} · Class ${classNum(grade)}`} title="Your free chapters are used up"
        sub={paywall}>
        <View style={ws.ap_actions}>
          <Pressable onPress={() => setPaywall("")} accessibilityRole="button"
            style={[ws.ap_btn, { borderColor: t.line }]}>
            <Text style={[ws.ap_btn_label, { color: t.ink_soft }]}>Close</Text>
          </Pressable>
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
