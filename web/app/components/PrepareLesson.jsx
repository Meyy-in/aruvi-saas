"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getJSON, postJSON, markPrepared, pad, pretty, ROMAN, annualBudgetPeriods, suggestedPeriodsByChapter, fetchEntitlement, planNameFor } from "../lib/format";
import { readPlans } from "../lib/plans";
import { verifiedWrite, planIsPrepared } from "../lib/verify";
import { RollWheel, wheelChapterTitle } from "./wheels";
import ViewModelView from "./ViewModelView";

/* ───────── PrepareLesson — the everyday, single-chapter generate flow (2026-07-03) ─────────
 * The bottom-up utilization path: the teacher prepares ONE chapter at a time, sets that
 * chapter's periods, and generates its lesson plan + assessment. Her actual consumption
 * accrues from these individual acts — no annual plan is required, and this flow NEVER calls
 * the allocator or touches the allocation register.
 *
 * This is deliberately decoupled from the top-down annual-budget allocator (Allocate.jsx +
 * PDF report), which stays as its own independent capability answering "how do I spread my
 * 180 periods across the whole year?" — a strategic overview a teacher may follow fully,
 * partly, or not at all. The two never gate each other.
 *
 * Flow: pick chapter → set periods (effort-index SUGGESTION default, editable) → Generate.
 * The screen also shows how this chapter sits inside the teacher's annual budget: what her
 * already-prepared lessons (the My Lessons list for this class) have committed, plus what the
 * proposed periods add. Live generation is still deferred (see api/main.py's /generate stub),
 * so "Generate" opens the closest saved plan's view as a preview.
 *
 * Props: subject (slug) · grade (slug) · readiness (for the annual budget) · onNavigate.
 */

const DEFAULT_PERIODS = 12; // fallback when neither a budget-based suggestion nor an NCF figure exists

// Teachers say "Class 7", not "Grade VII" — ROMAN starts at "iii" → 3.
const classNum = (g) => {
  const idx = ROMAN.indexOf((g || "").toLowerCase());
  return idx >= 0 ? idx + 3 : (g || "").toUpperCase();
};

export default function PrepareLesson({ subject, grade, readiness, onNavigate, onBack, onPrepared,
                                        onPreparing, onPrepareError, onPaywall }) {
  const [chapters, setChapters] = useState([]);
  const [chLoad, setChLoad] = useState("");                // "" = asking · ok · fail (WALK-A-051)
  const [chTry, setChTry] = useState(0);                   // bumped by Try again
  const [chapterNo, setChapterNo] = useState("");          // chapter_number as string
  // Trial counter for the chapter step (Step 6 moment (b), founder 2026-08-24: shown
  // HERE and only here — the moment she is about to spend a chapter is the one moment
  // the number informs a decision). null = not fetched/failed → no line, never a block.
  const [trialInfo, setTrialInfo] = useState(null);
  useEffect(() => { fetchEntitlement().then(setTrialInfo); }, []);
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);
  const [step, setStep] = useState("chapter");             // "chapter" | "preview"
  const [plans, setPlans] = useState([]);                  // saved plans (preview source + committed budget)
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  // Edge-state warnings live INLINE in the form (the prep-floor line below the period
  // stepper), BEFORE Generate — founder 2026-08-01: floor note below 60%, surrender note
  // above the top; nothing after generation ("that's it"). The served plan itself prints
  // the periods actually used (genon.served_matrix, engine e10).
  // ── The preparing state (founder, 2026-08-04; supersedes the assembly-reveal trial) ──
  // A genon serve is ~0.3 ms (C11), so without a hold the plan is simply THERE, which read as
  // artificial — the screen changed before the tap finished. The first trial staged the unit
  // cards in over ~1.3 s; the founder's verdict was that it took her away and still felt fast
  // and artificial. So: STAY ON THIS SCREEN, show the lesson card she is about to get in a
  // resting state — its real chapter, class and period shape, drawn pale, with a "· · · · ·"
  // line saying the plan is in the works — and hold for five seconds.
  //
  // WHO WAITS is the interesting rule (founder): not "was the server's cache cold" but "is
  // this plan new TO HER". `already_yours` comes from her prepared-plans register, read
  // server-side before the request marks it. Her own second look is instant; a plan another
  // teacher happened to warm is still her first sight of it, and gets the full wait. That
  // makes the pause a property of her experience rather than of our infrastructure.
  const PREPARING_MS = 5000;
  const [preparing, setPreparing] = useState(null);   // { chapterTitle, periods, durations } | null
  const [showInfo, setShowInfo] = useState(false);         // effort-index explainer popover
  const [showBreakdown, setShowBreakdown] = useState(false); // committed-chapters popup
  const [warnRegen, setWarnRegen] = useState(false);       // re-preparing an already-prepared chapter

  /* ── genon (2026-07-25): chapters with a pre-warmed canonical stream ──
   * For these, Prepare runs the DETERMINISTIC path: the teacher's duration rows go to
   * POST /genon/{subject}/{grade}/{ch}/plan, the server partitions the certified canonical
   * in milliseconds (no LLM), saves + registers the plan, and it pops up in My Lessons.
   * `rows` is the duration matrix [{duration, count}]. The seam-polish path was REMOVED at
   * test-campaign step 0 (docs/testing.md §2, 2026-07-29): every run is a pure partition,
   * deterministic and free. A repeat of the same (chapter × matrix) is served from the disk
   * cache, and a matrix equal to the canonical's own returns the certified plan untouched. */
  const [genonChs, setGenonChs] = useState([]);            // chapter numbers with a canonical
  const [canonMinutes, setCanonMinutes] = useState({});    // {chapter: canonical total minutes}
  const [canonPeriods, setCanonPeriods] = useState({});    // {chapter: top canonical period COUNT}
  // Re-entry guard, kept although a partition is free and instant: a second click during
  // an in-flight request would still double-register and can race the preview swap. The
  // ref blocks re-entry even if a click slips past the disabled button (modal path,
  // keyboard, double-fire).
  const inFlight = useRef(false);
  const [syllabusW, setSyllabusW] = useState(null);        // FULL syllabus weight (master plan)
  const [allChapters, setAllChapters] = useState([]);      // incl. "Book awaited" — the distribution's buckets

  // Load chapters (+ effort weight + NCF estimate) and saved plans for the scope.
  useEffect(() => {
    setStep("chapter"); setChapterNo(""); setView(null); setError(""); setNote("");
    setChapters([]); setAllChapters([]); setPlans([]); setShowInfo(false); setShowBreakdown(false); setWarnRegen(false);
    setChLoad("");
    getJSON(`/subjects/${subject}/${grade}/chapters`)
      // placeholder:true = budgeted but unpublished ("Book awaited"). Nothing to generate from,
      // so it never enters this picker; the Year Plan is where those rows live (2026-08-06).
      .then((d) => {
        const all = d.chapters || [];
        // ★ The FULL list — placeholders included — is what the budget is distributed across
        // (WALK-A-074). The picker still shows only what can be generated from.
        setAllChapters(all);
        setChapters(all.filter((c) => !c.placeholder));
        setSyllabusW(d.syllabus_total_weight || null); setChLoad("ok");
      })
      /* ★ THREE STATES, NOT TWO (WALK-A-051, found on the phone 2026-09-21 and true here too).
         An empty list means "she has none". A FAILED fetch also left it empty, and this screen
         then announced "No chapter mappings for this subject & grade yet" — telling a teacher
         that Meyy does not cover her subject when the truth was that the request failed. The
         reason goes to the console, never to her. */
      .catch((e) => {
        console.warn("[meyy] /chapters failed:", (e && e.message) || e);
        setChapters([]); setAllChapters([]); setSyllabusW(null); setChLoad("fail");
      });
    // The listing comes from the shared store, so the copy My Classes / My Lessons already
    // hold serves this picker too (@aruvi/shared/plans, 2026-09-14).
    readPlans(`${subject}/${grade}`, setPlans).catch(() => setPlans([]));
    getJSON(`/genon/${subject}/${grade}/chapters`)
      .then((d) => { setGenonChs(d.chapters || []); setCanonMinutes(d.canonical_minutes || {}); setCanonPeriods(d.canonical_periods || {}); })
      .catch(() => { setGenonChs([]); setCanonMinutes({}); });
  }, [subject, grade, chTry]);

  // Is the deterministic (genon) path available for the chosen chapter?
  const genonAvailable = !!chapterNo && genonChs.includes(Number(chapterNo));

  // The class's period LENGTHS and the weekly ratio she teaches them in, from the canonical
  // readiness profile (grade-level first, subject-level fallback).
  //
  // ★ Duration is not ASKED here at all (founder, 2026-07-26). A period length is a fact about
  // her school's timetable, not a per-chapter decision — the bell decides it, she doesn't. This
  // page shows one control, the period count; the lengths come from the profile and are only
  // echoed back as small print. A duration field here silently diverged from the profile (Prepare
  // said 50, My Classes still said 45) and made the budget meter incoherent, since "periods" then
  // meant two different things on one screen. A genuinely new length is a profile edit.
  const classProfile = useMemo(() => {
    const subs = (readiness && readiness.subjects) || [];
    const slugify = (n) => (n || "").toLowerCase().replace(/ /g, "_");
    const sub = subs.find((s) => slugify(s.name) === subject);
    const g = sub && (sub.grades || []).find((x) => (x.grade || "").toLowerCase() === grade);
    const raw = (g && g.durations) || (sub && sub.durations) || [];
    const durations = raw.length ? raw.map(Number).filter((n) => n > 0) : [40];
    return { durations, ppw: (g && g.ppw_by_duration) || {} };
  }, [readiness, subject, grade]);
  const classDurations = classProfile.durations;

  /* Seed the duration rows for a chapter of `n` periods by splitting n across her declared
   * lengths in the SAME weekly ratio she teaches them (largest remainder, so the parts sum to n
   * exactly). Dumping all n on `durations[0]` — which is the shortest length after the profile's
   * ascending sort, not her main one — is what made a 45/50 class read as "45 min" flat. */
  const seedRows = (n) => {
    const ppw = classProfile.ppw || {};
    const active = classDurations.filter((d) => (Number(ppw[d] ?? ppw[String(d)]) || 0) > 0);
    const fallback = [{ duration: classDurations[0] || 40, count: n }];
    if (active.length < 2) return active.length === 1 ? [{ duration: active[0], count: n }] : fallback;
    const tot = active.reduce((s, d) => s + (Number(ppw[d] ?? ppw[String(d)]) || 0), 0);
    const parts = active.map((d) => {
      const x = (n * (Number(ppw[d] ?? ppw[String(d)]) || 0)) / tot;
      return { d, c: Math.floor(x), frac: x - Math.floor(x) };
    });
    let rem = n - parts.reduce((s, p) => s + p.c, 0);
    [...parts].sort((a, b) => b.frac - a.frac).forEach((p) => { if (rem > 0) { p.c++; rem--; } });
    const out = parts.filter((p) => p.c > 0).map((p) => ({ duration: p.d, count: p.c }));
    return out.length ? out : fallback;
  };

  // Annual budget (periods) for this subject·grade, from the canonical readiness profile.
  const annualBudget = useMemo(
    () => annualBudgetPeriods(readiness, subject, grade),
    [readiness, subject, grade]
  );

  // Denominator of each chapter's budget share: the FULL syllabus weight from the master
  // allocation plan (includes placeholder chapters with no content yet — founder rule,
  // 2026-07-25), falling back to the listed chapters' sum only when no master plan exists.
  // Dividing by the listed sum alone inflates every suggestion until the full book lands.
  /* ⚠️ `sumW` is RETIRED (WALK-A-074, 2026-09-24). It existed to rebuild the syllabus denominator
     when the placeholder rows were filtered out of `chapters`; the distribution now runs over
     `allChapters`, where those rows are present, so the denominator is the whole syllabus by
     construction. `syllabusW` is kept — it is still read from the API and is the check that the
     list is complete — but nothing divides by it any more. */

  // Aruvi's suggested periods for a chapter: its effort-index SHARE of the teacher's OWN annual
  // budget — the same basis Allocate uses. NCF is deliberately NOT used here (2026-07-08): by the
  // time this route runs the class has been created and its annual budget collected, so the
  // suggestion keys off her real budget. A flat default is the only fallback (e.g. a chapter with
  // no effort weight); NCF never drives the number.
  //
  // ★ APPORTIONED, NOT ROUNDED (2026-08-13, ARV-D-142). This used to be an independent
  // `Math.round(weight_c / Σweights × budget)` per chapter, which is a different number from the
  // one the rest of the product uses and does not conserve the budget. On english VI ch 8 it
  // suggested 13 where `master_plan.recommended_periods` says 12 — and since that chapter's TOP
  // canonical is authored at 12, accepting the default asked for MORE PERIODS THAN THE LIBRARY
  // HOLDS and fell into the serve engine's "above the top" surrender path. The column also summed
  // to 142 against a 140 budget, and YearPlan (which always apportioned) disagreed with this
  // screen for the same teacher on the same chapter. 40 of 340 chapters were affected.
  // `largestRemainder` over the whole chapter list is now the one method: it conserves the budget
  // exactly and reproduces `recommended_periods` whenever her budget matches the calibrated one.
  //
  // The list INCLUDES the master plan's placeholder ("Book awaited") chapters — the API adds them
  // and their weights are what make the listed weights sum to `syllabus_total_weight` — so the
  // founder's 2026-07-25 rule (divide by the FULL syllabus, never the listed subset, or every
  // suggestion inflates until the books ship) is preserved by construction rather than by a
  // separate denominator.
  /* ★ ONE DISTRIBUTION, SHARED WITH YEAR PLAN (WALK-A-074, 2026-09-24). This used to rebuild the
     missing placeholder weight as a SINGLE synthetic bucket and discard it — which is not the same
     apportionment as giving each placeholder its own bucket, because largest-remainder hands the
     leftover periods to the largest fractions. Year Plan did the latter, this screen the former,
     and they differed by a period on real chapters (SS IX ch 5: 22 here, 21 there). Both now call
     `suggestedPeriodsByChapter` over the FULL chapter list, so the two panes cannot disagree.
     The founder's 2026-07-25 rule still holds by construction: the denominator is the whole
     syllabus, because every placeholder is in the list rather than summarised into one bucket. */
  const sugByChapter = useMemo(
    () => suggestedPeriodsByChapter(allChapters, annualBudget),
    [allChapters, annualBudget]
  );

  const suggestionFor = (c) => {
    if (!c) return DEFAULT_PERIODS;
    const v = sugByChapter[c.chapter_number];
    return v != null ? v : DEFAULT_PERIODS;
  };

  const chosen = chapters.find((c) => String(c.chapter_number) === String(chapterNo));
  const suggestion = suggestionFor(chosen);
  const planFor = (cn) => plans.find((p) => String(p.chapter_number) === String(cn));

  // The suggestion becomes the default value when a chapter is chosen (still editable).
  useEffect(() => {
    const c = chapters.find((x) => String(x.chapter_number) === String(chapterNo));
    if (!c) return;
    setPeriods(suggestionFor(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterNo, chapters, annualBudget, allChapters]);

  /* ★ ONE control on this page (founder, 2026-07-26): a period stepper, nothing else. The
   * duration matrix the server needs is DERIVED from that number — her declared lengths, in the
   * weekly ratio she teaches them — and only reported back to her as small print underneath
   * ("6 × 45 min · 3 × 50 min"). She already told Aruvi her period lengths when she set the class
   * up; asking again here was a second place for the same fact to live, and a second place for it
   * to disagree with the profile. */
  const rows = useMemo(() => seedRows(Math.max(0, Number(periods) || 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periods, classProfile]);
  const mixLabel = rows.map((r) => `${r.count} × ${r.duration} min`).join(" · ");

  // Files currently ATTACHED to a section of this class (localStorage bindings) — so a chapter a
  // class is actively teaching counts toward the budget even if its `prepared` write was lost
  // (mirrors My Lessons' `p.prepared || isAttached(p)`).
  const attachedFiles = useMemo(() => {
    const set = new Set();
    if (typeof window === "undefined") return set;
    const subs = (readiness && readiness.subjects) || [];
    const slugify = (n) => (n || "").toLowerCase().replace(/ /g, "_");
    const sub = subs.find((s) => slugify(s.name) === subject);
    const g = sub && (sub.grades || []).find((x) => (x.grade || "").toLowerCase() === grade);
    ((g && g.sections) || []).forEach((sec) => {
      try {
        const f = window.localStorage.getItem(`current_chapter_${subject}_${grade}_${sec.tag}`);
        if (f) set.add(f);
      } catch {}
    });
    return set;
  }, [readiness, subject, grade]);

  // Chapters the teacher has already prepared for THIS class (the My Lessons list) — one row per
  // chapter, each contributing its lesson plan's period count (total_units). Excludes the chapter
  // she's preparing now (that's the "proposed" segment, not yet committed) and any archived plan.
  const committed = useMemo(() => {
    const arr = (plans || []).filter(
      (p) => (p.prepared || attachedFiles.has(p.filename)) && !p.archived
        && String(p.chapter_number) !== String(chapterNo)
    );
    const byCh = {};
    arr.forEach((p) => {
      const k = String(p.chapter_number);
      const prev = byCh[k];
      if (!prev || String(p.prepared_at || "") > String(prev.prepared_at || "")) byCh[k] = p;
    });
    return Object.values(byCh)
      .map((p) => ({
        filename: p.filename,
        chapter_number: p.chapter_number,
        chapter_title: p.chapter_title,
        // Track the teacher's CHOSEN periods (what she allocated). Fall back to the served plan's
        // authored learning-unit count only when no chosen count was stored (e.g. first-run).
        periods: (p.prepared_periods != null ? Number(p.prepared_periods) : Number(p.total_units)) || 0,
      }))
      .sort((a, b) => (Number(a.chapter_number) || 0) - (Number(b.chapter_number) || 0));
  }, [plans, attachedFiles, chapterNo]);

  // Has the chosen chapter already been prepared (it's in her generated list / attached to a
  // section)? Re-preparing is allowed, but warned — and for budget tracking only the LATEST
  // generation counts (the `committed` dedupe above keeps the newest prepared_at per chapter).
  const chosenAlreadyPrepared = useMemo(
    () => !!chapterNo && (plans || []).some(
      (p) => String(p.chapter_number) === String(chapterNo) && (p.prepared || attachedFiles.has(p.filename))
    ),
    [plans, chapterNo, attachedFiles]
  );

  /* ★ WOULD A PRESS HAND BACK A PLAN SHE ALREADY HOLDS? (WALK-A-070, founder 2026-09-24)
     Same chapter + same length (periods AND minutes) + same source version = the same file, so
     "Prepare again" would deliver nothing new. The SERVER names the file a press would land on
     (a dry run, /plan-name) — the device cannot: at a variant's own length the press reuses the
     chapter's base plan, and otherwise it keys off the variant the serve actually used. Any
     doubt ("" — offline, older API) leaves the button live; it greys only on the server's word.
     An ARCHIVED match stays live on purpose — preparing it again is how she brings it back. */
  const [targetName, setTargetName] = useState("");
  const rowsKey = rows.map((r) => `${r.duration}x${r.count}`).join(",");
  useEffect(() => {
    setTargetName("");
    if (!chosenAlreadyPrepared || !chapterNo || !genonAvailable) return undefined;
    let live = true;
    const t = setTimeout(() => {
      planNameFor(subject, grade, chapterNo, rows).then((n) => { if (live) setTargetName(n); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenAlreadyPrepared, chapterNo, genonAvailable, subject, grade, rowsKey]);
  const samePlanHeld = !!targetName && (plans || []).some((p) => p.filename === targetName
    && !p.archived && (p.prepared || attachedFiles.has(p.filename)));

  const committedTotal = committed.reduce((s, c) => s + c.periods, 0);
  // "Used" / "Available" reflect only what's ACTUALLY committed (already-prepared chapters),
  // NOT the chapter she's proposing now — that lives in the Suggestion box.
  const left = annualBudget != null ? annualBudget - committedTotal : null;
  const over = left != null && left < 0;

  // "Prepare the lesson" — records the chapter as prepared, then RETURNS to where she came from
  // (the section's attach popup, or My Lessons) with the new chapter now listed — it does NOT
  // open the lesson plan. Attaching/teaching is a separate, deliberate step done from there.
  // "Prepared" means the chapter's plan, served from its certified canonical, becomes hers; we
  // await the mark so the popup's refetch sees `prepared` immediately. A chapter with NO
  // canonical cannot be prepared at all and says so (2026-08-10) — the stand-in preview that
  // used to keep testing unblocked is retired, because it concealed exactly this condition.
  // Click handler: if this chapter is already prepared, warn first (a different length makes a
  // SECOND plan; nothing is replaced — WALK-A-070); otherwise prepare straight away.
  const onPrepareClick = () => {
    if (!chosen || samePlanHeld) return;
    if (chosenAlreadyPrepared) { setWarnRegen(true); return; }
    doGenerate();
  };

  const doGenerate = async () => {
    if (!chosen || inFlight.current) return;
    inFlight.current = true;
    try { await runGenerate(); } finally { inFlight.current = false; }
  };

  // Hold the preparing card for the rest of the five seconds, then resolve. A plan she has
  // held before resolves immediately — no hold, no flicker.
  const holdPreparing = (startedAt, alreadyYours) => {
    if (alreadyYours) return Promise.resolve();
    const left = Math.max(0, PREPARING_MS - (Date.now() - startedAt));
    return new Promise((res) => setTimeout(res, left));
  };

  const runGenerate = async () => {
    if (!chosen) return;
    // ── genon path: deterministic adaptation from the chapter's certified canonical ──
    if (genonAvailable) {
      const matrix = rows
        .map((r) => ({ duration: Number(r.duration) || 0, count: Number(r.count) || 0 }))
        .filter((r) => r.duration > 0 && r.count > 0);
      if (!matrix.length) { setError("Add at least one duration row."); return; }
      setBusy(true); setError(""); setNote("");
      // The card goes up FIRST, from what she just told us — chapter, class, period shape.
      // Nothing here is invented and nothing is fetched to draw it.
      const startedAt = Date.now();
      // ── WHERE THE WAIT HAPPENS (founder, 2026-08-06) ────────────────────────────
      // With `onPreparing` wired, she does NOT wait here. The descriptor goes up to the
      // shell, which lands her in My Lessons immediately and draws the proposed lesson as
      // a real card at the head of the list — full strength, ordinary structure, a progress
      // bar on its last line. This request keeps running after this component unmounts:
      // the closure holds the fetch and `onPrepared`, both of which outlive the render, so
      // the hold and the resolve still fire from here. Without the prop (a caller that has
      // nowhere to put the card) the old in-place `prep-wait` screen is still the fallback.
      const descriptor = {
        subject, grade, chapterNo,
        chapterTitle: (chosen && (chosen.chapter_title || chosen.title)) || `Chapter ${chapterNo}`,
        rows: matrix,
      };
      /* The shell answers TRUE only if it actually took the card; on FALSE this screen falls
         back to its own in-place wait, so a silent decline can never leave her staring at an
         unchanged form for five seconds.
         ⚠️ It used to decline the section-attach path ("nowhere to put one"). It no longer does
         — that wait is drawn on the section card itself (founder, 2026-09-15) — so this fallback
         is now reached only if the shell has no handler at all. */
      const taken = onPreparing ? onPreparing(descriptor) === true : false;
      if (!taken) setPreparing(descriptor);
      try {
        const resp = await postJSON(`/genon/${subject}/${grade}/${chapterNo}/plan`,
          { rows: matrix });
        // READ-AFTER-WRITE (area 2, lib/verify.js). The serve returned a filename, so Y is now
        // knowable: "that lesson is in MY prepared register". Verified against
        // GET /plans-prepared. A mismatch means the plan was built but never became hers — she
        // would find it missing from My Lessons with no idea why. The write is already done
        // above, so this call only READS; `write` is a no-op.
        verifiedWrite({
          write: async () => {},
          read: () => getJSON("/plans-prepared").then((d) => (d && (d.prepared || d.plans)) || d || {}),
          expect: (y) => planIsPrepared(y, subject, grade, resp.filename),
        }).then(({ status }) => {
          if (status !== "mismatch") return;
          if (onPrepareError) onPrepareError(descriptor,
            "The lesson was built but didn’t reach your lessons — please prepare it again.");
        });
        await holdPreparing(startedAt, !!resp.already_yours);
        if (onPrepared) { onPrepared({ subject, grade, filename: resp.filename, chapterNo }); return; }
        // No return handler → show the freshly adapted plan.
        setStep("preview");
        if (resp.coverage_note) setNote(resp.coverage_note);
        setView((await getJSON(`/plans/${subject}/${grade}/${resp.filename}/view`)).view);
      } catch (e) {
        // She may already be in My Lessons watching the proposed card — the failure has to
        // reach HER, not this screen, so it goes back up the same way it went down.
        //
        // ARV-D-087 (2026-08-10): that sentence was the INTENT; the implementation stopped at
        // pulling the card, and `setError` below writes to a screen that has already unmounted.
        // The message now travels WITH the descriptor so the shell can show it on the card she
        // is actually looking at. `setError` stays for the section-attach path, where this
        // screen is still mounted and is the right place for it.
        const msg = (e && e.detail)
          ? e.detail                       // the API's own 4xx wording, written for her
          : "Couldn't build the lesson plan right now. Try again in a moment.";
        // ── THE PAYWALL IS NOT AN ERROR (founder, 2026-08-24). A 402 (trial exhausted /
        // out of subscription) must never render as a failed card or an inline card
        // message — the card comes DOWN and a modal carries the sentence instead, with
        // Subscribe below it. The server's own wording travels up unchanged (single
        // source of copy); the shell owns the window. Fallback without the prop: the
        // ordinary error path, so an older caller still shows her something.
        if (e && e.status === 402 && onPaywall) { onPaywall(msg); return; }
        if (onPrepareError) onPrepareError(descriptor, msg);
        setError(msg);
      } finally {
        setPreparing(null);
        setBusy(false);
      }
      return;
    }
    // ── NO CANONICAL → NO LESSON (founder, 2026-08-10). THE SAVED-PLAN FALLBACK IS RETIRED.
    // This used to reach for the prototype-era saved plans: an exact one where it existed, and
    // otherwise `plans[0]` — A DIFFERENT CHAPTER ENTIRELY — served as a "stand-in preview" in
    // the old format. That made sense while the certified library was being built and nothing
    // else existed; it is wrong now. It hands her a lesson for a chapter she did not ask for,
    // in a shape the current renderer no longer targets, and — worst — it HIDES the fact that
    // we have not authored her chapter yet, which is the one thing she and we both need to
    // know. The genon path is now the only path.
    //
    // Deliberately the SAME sentence the API returns for the same condition
    // (api/main.py, 404 "No underlying chapter yet."), so the message is one string wherever
    // she meets it — and so a chapter silently losing its canonical shows up as this line
    // rather than as a plausible-looking wrong lesson. It is a standing check for us, not
    // only a message for her.
    setError("No underlying chapter yet.");
  };

  // ── the preparing card — SHE STAYS HERE; the lesson she is about to get, at rest ──
  if (preparing) {
    const totalP = (preparing.rows || []).reduce((a, r) => a + (Number(r.count) || 0), 0);
    const shape = (preparing.rows || [])
      .map((r) => `${r.count} × ${r.duration} min`).join(" + ");
    return (
      <div className="prep-wait" aria-live="polite" aria-busy="true">
        <div className="ap-kicker prep-scope">{pretty(subject)} · Class {classNum(grade)}</div>
        <div className="prep-wait-card">
          <p className="prep-wait-title">{preparing.chapterTitle}</p>
          <p className="prep-wait-meta">
            {totalP} {totalP === 1 ? "period" : "periods"}{shape ? ` · ${shape}` : ""}
          </p>
          <p className="prep-wait-dots" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </p>
          <p className="prep-wait-note">Preparing your lesson plan…</p>
        </div>
      </div>
    );
  }

  // ── preview: the generated (saved-plan) lesson ──
  if (step === "preview") {
    return (
      <div>
        <button className="back" onClick={() => { setStep("chapter"); setView(null); }}>← back to chapter</button>
        {busy && <div className="empty">Building your lesson plan…</div>}
        {!busy && error && <div className="empty">{error}</div>}
        {!busy && !error && note && <p className="h2-sub">{note}</p>}
        {!busy && !error && view && <ViewModelView view={view} />}
      </div>
    );
  }

  // ── chapter + periods ──
  const setP = (n) => setPeriods(Number.isFinite(n) && n >= 0 ? n : 0);
  return (
    <div>
      <div className="prep-hdr-row">
        <p className="h2">Prepare a lesson plan</p>
        {/* ★ BACK LANDS ON MY LESSONS (founder, 2026-09-14: the phone did this and "latter is
            correct"). It used to call onNavigate("myplans"), which is the TAB alone — and both
            routes into this screen clear `editFlow` first (onEnterGenerate, onAllocateScoped),
            so "myplans" resolved to My Classes. She arrives here from My Lessons' own "Need a
            chapter you don't have yet?", and the lesson she is preparing lands in My Lessons; a
            back that leaves her somewhere else is a one-way door of the kind the portal rows
            were fixed for. `onBack` is page.jsx's `goLessons`, which sets the pane as well as
            the tab; the onNavigate fallback keeps an older caller working. */}
        <button className="back back-tr"
          onClick={() => (onBack ? onBack() : onNavigate && onNavigate("myplans"))}>← back</button>
      </div>
      <div className="ap-kicker prep-scope">{pretty(subject)} · Class {classNum(grade)}</div>
      <p className="h2-sub prep-instr">
        Pick one chapter and enter the periods you plan to spend teaching it.
      </p>
      {/* Trial counter — shown only once a chapter has actually been spent (the welcome
          page already stated the terms, so a fresh trial shows nothing here; founder,
          2026-08-24). Wording per founder: "Regenerating same chapter allowed". Hidden
          when the gate is off, she isn't on trial, or the fetch failed. */}
      {trialInfo && trialInfo.enforced && trialInfo.status === "trial"
        && trialInfo.trial_chapters_used > 0 ? (
        <p className="trial-note">
          {trialInfo.trial_chapters_used} of {trialInfo.trial_chapter_cap} free chapters
          used. Regenerating same chapter allowed.
        </p>
      ) : null}

      {!chapters.length ? (
        chLoad === "fail" ? (
          <div className="empty">
            We couldn&rsquo;t load the chapters just now — check your connection and try again.{" "}
            <button type="button" className="lgl-link" onClick={() => setChTry((n) => n + 1)}>
              Try again
            </button>
          </div>
        ) : chLoad === "ok" ? (
          <div className="empty">No chapter mappings for this subject &amp; grade yet.</div>
        ) : (
          <div className="empty">Loading chapters&hellip;</div>
        )
      ) : (
        <>
          {/* Clear the refusal the moment she moves the wheel: the message is about the chapter
              that was selected, so leaving it under a different one would accuse the wrong
              chapter. Only the error is cleared — the period count she set is hers to keep. */}
          <RollWheel ariaLabel="Chapter" value={chapterNo} rowPx={92}
            onChange={(id) => { setChapterNo(id); setError(""); }}
            items={chapters.map((c) => ({ id: String(c.chapter_number), chip: c.chapter_number, label: wheelChapterTitle(c.chapter_title) }))} />

          <div className="prep-block">
            <div className="prep-left">
              <p className="prep-fieldlab">Periods for this chapter</p>
              <span className="steppermini prep-stepper">
                <button type="button" onClick={() => setP((Number(periods) || 0) - 1)} aria-label="fewer periods">–</button>
                <input type="number" min="0" className="v g4-vinput" value={periods}
                  onChange={(e) => setP(parseInt(e.target.value, 10))} aria-label="Periods for this chapter" />
                <button type="button" onClick={() => setP((Number(periods) || 0) + 1)} aria-label="more periods">+</button>
              </span>
              {genonAvailable && mixLabel ? <p className="prep-mix">{mixLabel}</p> : null}
              {genonAvailable ? (() => {
                /* The ONE warning worth showing (founder, 2026-07-26): below 60% of the certified
                 * plan's minutes, trailing sections cannot be scheduled at all. The 60–80%
                 * "compressed" note is dropped — compression is normal, not news. We deliberately
                 * do NOT name which sections go: Aruvi teaches the textbook in its own order, so
                 * "the later ones" is something she can already deduce. The minimum is expressed
                 * in periods like the ones she actually has — i.e. against the average length of
                 * HER mix, not a single hardcoded length. */
                const cm = Number(canonMinutes[String(chapterNo)]) || 0;
                const totalMin = rows.reduce((s, r) => s + (Number(r.duration) || 0) * (Number(r.count) || 0), 0);
                const totalP = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
                if (!cm || !totalMin || !totalP) return null;
                /* Surrender, same place as the floor note (founder 2026-08-01): above the
                   chapter's fullest plan, the extra periods return to her budget — said HERE,
                   before Generate, and nowhere else. Top ≈ canonical minutes / her avg length. */
                /* Count-based, from the API (surrender compares COUNTS — a minutes/avg
                   approximation misfires on mixed-duration profiles). */
                const topP = Number(canonPeriods[String(chapterNo)])
                  || Math.round(cm / (totalMin / totalP));
                if (totalP > topP) return (
                  <p className="prep-floor">
                    Above {topP} periods, the extra {totalP - topP} return{totalP - topP === 1 ? "s" : ""} to
                    your budget — this chapter&rsquo;s fullest plan uses {topP}.
                  </p>
                );
                /* Floor = round(0.6 x canonical / duration), matching master_plan's
                   floor_periods_at_standard (nearest-whole, founder 2026-07-31; was ceil).
                   TEST IN PERIODS, NOT MINUTES (fix 2026-08-02): the old guard asked
                   `totalMin / cm < 0.6` while the sentence printed the ROUNDED period floor,
                   so the two disagreed wherever 0.6xA rounds DOWN — at A=12 the floor is
                   round(7.2)=7 but 7/12=0.583, so a teacher asking for exactly 7 was warned
                   about being below 7. That band is the common case, not an edge (A=9 -> 5,
                   A=7 -> 4, likewise). The floor is defined in PERIODS in master_plan, so the
                   comparison has to be too — and now the test and the sentence use one number
                   by construction, which is what stops this drifting apart again.
                   Wording is the serve engine's (2026-08-01): below the floor the plan still
                   closes the chapter — unreached sections are NAMED and handed over, never
                   silently dropped. */
                const floorP = Math.round((0.6 * cm) / (totalMin / totalP));
                if (!floorP || totalP >= floorP) return null;
                return (
                  <p className="prep-floor">
                    Below {floorP} periods the plan compresses; some sections
                    may move to guided self-study — the plan still closes the chapter and names them.
                  </p>
                );
              })() : null}
            </div>

            {chosen ? (
              <div className="prep-right">
                <div className="prep-box prep-sugg2">
                  <div className="prep-sugg-hd">
                    <span className="prep-sugg-k">Suggestion</span>
                    <button type="button" className="prep-info" aria-label="How the suggestion is made"
                      onClick={() => setShowInfo((v) => !v)}>i</button>
                  </div>
                  <div className="prep-sugg-body">
                    <span className="prep-sugg-val">{suggestion}</span>
                    {periods === suggestion
                      ? <span className="prep-sugg-ok" aria-label="matches the suggestion">✓</span>
                      : <button type="button" className="prep-use"
                          onClick={() => setPeriods(suggestion)}>use</button>}
                  </div>
                  {showInfo && (
                    <div className="prep-tip" role="note">
                      {/* WALK-A-082: close where she is reading, as the phone does. */}
                      <button type="button" className="prep-tip-x" aria-label="Close this note"
                        onClick={() => setShowInfo(false)}>✕</button>
                      Meyy shares your annual budget for this class across its chapters by each
                      chapter&rsquo;s effort index — heavier chapters get more periods. It&rsquo;s a
                      starting point, so you can change it freely.
                    </div>
                  )}
                </div>

                {annualBudget != null ? (
                  <div className="prep-box prep-budget2">
                    <div className="prep-brow">
                      <span className="prep-brow-k">Total periods</span>
                      <span className="prep-brow-v pine">{annualBudget}</span>
                    </div>
                    <button type="button" className="prep-brow prep-brow-btn" disabled={!committed.length}
                      onClick={() => setShowBreakdown(true)}
                      aria-label={`Used ${committedTotal} periods${committed.length ? " — view breakdown" : ""}`}>
                      <span className="prep-brow-k">Used{committed.length ? <span className="prep-brow-info" aria-hidden="true"> ⓘ</span> : null}</span>
                      <span className="prep-brow-v clay">{committedTotal}</span>
                    </button>
                    <div className="prep-brow">
                      <span className="prep-brow-k">Available</span>
                      <span className={`prep-brow-v${over ? " clay" : ""}`}>{over ? `−${-left}` : left}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* The error line for the CHAPTER step (2026-08-10). It had none: the only {error}
              block sits inside the "preview" step, so the retired stand-in path used to
              navigate there just to be seen. Now that a chapter without a canonical simply
              refuses, the message has to appear WHERE SHE IS — beside the button she pressed,
              with the picker still in front of her so the fix (choose another chapter) is one
              tap away. Navigating to an empty "preview" to show a refusal would be theatre. */}
          {!busy && error ? <p className="prep-floor" role="alert">{error}</p> : null}

          <div className="savebar savebar-prep">
            <button className={`primary prepare-cta${samePlanHeld && !busy ? " is-held" : ""}`}
                    disabled={!chosen || busy || samePlanHeld} onClick={onPrepareClick}>
              {busy
                ? <span className="prep-working"><span className="prep-spin" aria-hidden="true" />
                    Building the lesson…</span>
                : chosenAlreadyPrepared ? "Prepare again →" : "Prepare the lesson →"}
            </button>
            {busy
              ? <span className="savebar-hint" aria-live="polite">
                  {/* A genon build is a pure partition — milliseconds. No wait warning
                      is warranted (the seam-polish path was removed at campaign step 0). */}
                  Working on it…
                </span>
              : !chosen
                ? <span className="savebar-hint">Pick a chapter to continue.</span>
                : samePlanHeld
                  ? <span className="savebar-hint">You already have this plan at {Number(periods) || 0} periods. Change the number of periods to prepare a second one.</span>
                  : chosenAlreadyPrepared
                    ? <span className="savebar-hint">Already prepared. Preparing it again at a different length makes a second plan. Existing plans remain unaffected.</span>
                    : null}
          </div>
        </>
      )}

      {warnRegen && chosen ? (
        <div className="ap-overlay" onClick={() => setWarnRegen(false)}>
          <div className="ap-modal ap-confirm" onClick={(e) => e.stopPropagation()}>
            <button className="ap-close" aria-label="Close" onClick={() => setWarnRegen(false)}>✕</button>
            <div className="ap-head">
              <div className="ap-kicker">{pretty(subject)} · Class {classNum(grade)}</div>
              <div className="ap-title">Prepare this chapter again?</div>
              <div className="ap-sub">
                You&rsquo;ve already prepared &ldquo;{chosen.chapter_title}&rdquo; for this class.
                Preparing it again at a different length makes a second plan — and for budget
                tracking, only this latest version will count.
              </div>
            </div>
            <div className="ap-confirm-actions">
              <button className="ap-btn-ghost" onClick={() => setWarnRegen(false)}>Cancel</button>
              <button className="ap-btn-danger" disabled={busy}
                      onClick={() => { setWarnRegen(false); doGenerate(); }}>Prepare again</button>
            </div>
          </div>
        </div>
      ) : null}

      {showBreakdown ? (
        <div className="ap-overlay" onClick={() => setShowBreakdown(false)}>
          <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
            <button className="ap-close" aria-label="Close" onClick={() => setShowBreakdown(false)}>✕</button>
            <div className="ap-head">
              <div className="ap-kicker">{pretty(subject)} · Class {classNum(grade)}</div>
              <div className="ap-title">Committed so far</div>
              <div className="ap-sub">Periods already taken by the lessons you&rsquo;ve prepared for this class.</div>
            </div>
            <div className="ap-list">
              {committed.map((c) => (
                <div className="prep-brk-row" key={c.filename}>
                  <span className="prep-brk-ch">Ch {pad(c.chapter_number)}</span>
                  <span className="prep-brk-name" title={c.chapter_title}>{c.chapter_title}</span>
                  <span className="prep-brk-p">{c.periods}</span>
                </div>
              ))}
              <div className="prep-brk-total">
                <span>Total committed</span>
                <span>{committedTotal} periods</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
