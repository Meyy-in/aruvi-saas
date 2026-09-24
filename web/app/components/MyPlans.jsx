"use client";
import { useEffect, useRef, useState } from "react";
import { getJSON, pretty, pad, classNum, markPrepared, gradeSlug } from "../lib/format";
import { pullSectionState, bindSectionChapter, unbindSection } from "../lib/sectionState";
import { readHistory, recordHistory, hasHistory, pullSectionHistory } from "../lib/sectionHistory";
import { cachedPlans, fetchPlans, fetchPlanView, invalidatePlans, notePlansYear } from "../lib/plans";
import Readiness from "./Readiness";
import LessonView from "./LessonView";

/* ★ THE YEAR STAMP — ONE component, used on every surface a plan can appear on
   (founder, 2026-08-26: "all plans in section cards and LP view get a year stamp").
   A plan carries it when it was prepared in an EARLIER academic year than the one she is
   in now, and it keeps carrying it after she re-attaches it, because the plan may have
   been written against an earlier constitution or textbook edition and she must never be
   uncertain which version is in her hand. Rendered from either source: the year the
   server derived (`prepared_source_year`) or, inside a prior-year folder, that folder's
   own year — the folder knows, and its rows are fetched under that year so the server's
   own flag is naturally absent there. */
/* ★ AMENDED 2026-08-27 — `lpYear` is the REAL answer; `year` was always a proxy for it.
   Read the paragraph above: the reason a stamp exists at all is "the plan may have been
   written against an earlier constitution or textbook edition". That is a fact about the
   LIBRARY EDITION, and until §2.2 landed nothing recorded it — so the year she PREPARED
   in was used as a stand-in, on the assumption that an older preparation means older
   material. The assumption does not hold: a chapter carried forward unchanged is stamped
   with the NEW edition, and a plan she prepared last year may be the current edition.
   So prefer the edition when the server sends one, and keep the proxy for plans authored
   before the stamp existed.

   The server sends `lp_year_display` ALREADY FILTERED — null unless it is a prior
   edition (api/main.py get_plans; the founder's rule: never show the year for the
   current edition, even though every canonical carries it). Do not re-derive that
   comparison here; a second copy of the rule is how the screen and the rule drift. */
export function YearStamp({ year, lpYear }) {
  const shown = lpYear || year;
  if (!shown) return null;
  return <div className="sc-yearstamp">{shown} version</div>;
}

const subjectSlug = (name) => (name || "").toLowerCase().replace(/ /g, "_");
/* `gradeSlug` now comes from @aruvi/shared/format (lifted 2026-09-17) — one definition. */

// Nudge glyph — a transparent, stroke-only ROUTE (start point → dotted path → destination):
// "I'll walk you through it". Deliberately not a filled emoji; inherits the pine of the nudge.
const RouteIcon = (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="19" r="2.6" />
    <path d="M9.5 19h8a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" strokeDasharray="3 3.4" />
    <circle cx="18" cy="5" r="2.6" />
  </svg>
);

// Small "history" glyph (clock + counter-clockwise arrow) for the section card's history button.
const HistoryIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3v5h5" />
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    <path d="M12 7v5l3 2" />
  </svg>
);
// History-status → the label shown on the popup pill.
const HISTORY_LABEL = { ongoing: "Ongoing", completed: "Completed", untracked: "Untracked" };
// Back-compat: an earlier build stored the untracked status as "set_aside". Normalize legacy
// localStorage entries so they still render with a label + slate pill instead of a blank status.
const normStatus = (s) => (s === "set_aside" ? "untracked" : s);

/* ONE CARD PER subject·grade·section the teacher handles — across ALL subjects (walks the
 * canonical readiness.subjects[], not the single active projection). NO day derivation
 * (2026-07-02): My Classes is pointer-organized ("where did I stop?"), never day-organized —
 * the calendar was a category error against the section-pointer model (MEMORY.md). Each entry
 * carries the slugs + section tag so the card can look up that class's plans and pointer. */
function classesFromReadiness(readiness) {
  const subjects = (readiness && readiness.subjects) || [];
  const out = [];
  subjects.forEach((s) => {
    const sSlug = subjectSlug(s.name);
    (s.grades || []).forEach((g) => {
      const gSlug = gradeSlug(g.grade);
      (g.sections || []).forEach((sec) => {
        out.push({
          subjectName: s.name, subjectSlug: sSlug, grade: g.grade, gradeSlug: gSlug,
          sectionTag: sec.tag,
          /* ★ Her own name for this section, if she gave one (founder, 2026-08-30). DISPLAY
             ONLY — every key below is still built from `sectionTag`, so renaming a section
             never moves a bookmark, a chapter binding or a localStorage row. */
          sectionName: (sec.name || "").trim(),
        });
      });
    });
  });
  return out;
}

/* The corner of a section card. Un-named it is the tag she has always seen — "6A". Named, the
 * LETTER gives way to her word: the class number stands alone with her name in fine print
 * beneath it (founder, 2026-08-30). A teacher who calls that room "Rose" scans this list for
 * "Rose", and "6A · Rose" would make her read two labels to find one card. The letter is not
 * lost — it is the key everything is filed under and the teaching profile still shows it. */
const SectionTag = ({ c, muted }) => (
  <div className={`sc-tag${muted ? " muted" : ""}`}>
    {c.sectionName ? classNum(c.grade) : c.sectionTag}
    {c.sectionName ? <span className="sc-tag-name">{c.sectionName}</span> : null}
  </div>
);

export default function MyPlans({ subject, grade, ready, readiness, onReady, onNavigate, onEnterGenerate, user, onSignOut, lapsed, pendingOpen, onConsumePending, pendingAttach, onConsumeAttach, onStartTour, tourActive, tourStep, onTourInfo, onOpenPortal, sectionCheck, yearInfo, onCutover, cutoverBusy, cutoverResult, onDismissCutoverResult, cutoverDismissed, onDismissCutover, preparingCard, preparingSection, onDismissPreparing, onRetryPreparing }) {
  const [openPlan, setOpenPlan] = useState(null);  // { view, sectionKey } for LessonView
  // WALK-A-008: the browser's Back closes an open lesson first (page.jsx dispatches "aruvi:back").
  useEffect(() => {
    if (!openPlan) return undefined;
    const onBack = (e) => { setOpenPlan(null); e.preventDefault(); };
    window.addEventListener("aruvi:back", onBack);
    return () => window.removeEventListener("aruvi:back", onBack);
  }, [openPlan]);
  const [loading, setLoading] = useState(false);
  const [setupStarted, setSetupStarted] = useState(false); // 2a welcome → grid flow gate
  const [attachFor, setAttachFor] = useState(null); // { c, sectionKey } — "+" track-a-chapter picker
  const [untrackFor, setUntrackFor] = useState(null); // { c, sectionKey, plan } — "−" untrack confirm
  const [historyFor, setHistoryFor] = useState(null); // { c, sectionKey } — chapter-history popup
  const [, setSyncTick] = useState(0); // bumped after a server pull so cards re-read the refreshed cache
  // plans for EVERY subject·grade the teacher handles, keyed `${subjectSlug}/${gradeSlug}`.
  const [plansByKey, setPlansByKey] = useState({});
  /* Last year's lessons INSIDE the "+" picker (founder, 2026-08-26). A teacher who taught
     Ch 5 last June should be able to teach it again this June without regenerating it —
     the plan is shared library content and was never year-scoped; only her attachment to
     it was. Fetched lazily, per open folder. */
  const [apPrior, setApPrior] = useState(null);        // which prior year is expanded
  const [apPriorPlans, setApPriorPlans] = useState({}); // { [yearId]: plans[] | undefined }

  // All classes across all subjects (one card per subject·grade·section).
  const classes = ready ? classesFromReadiness(readiness) : [];

  // Onboarding gate — used ONLY for the welcome copy below (which instruction she is ready to
  // read). She is past onboarding when she has COMPLETED the guided tour, SKIPPED it (at
  // inception or mid-way), or attached a lesson without ever taking it.
  //   • onStartTour → page.jsx passes this ONLY while the tour is still offered (it becomes
  //     undefined the instant she Skips or finishes — both route through finishTour/tourDismissed).
  //     So `!onStartTour` == "she has resolved the tour this session (skipped or done)".
  //   • anyBoundTop → she attached a lesson (covers the never-offered / manual-attach path).
  const anyBoundTop = ready && classes.some((c) => {
    if (typeof window === "undefined") return false;
    try { return !!window.localStorage.getItem(`current_chapter_${c.subjectSlug}_${c.gradeSlug}_${c.sectionTag}`); }
    catch { return false; }
  });
  const tourResolved = anyBoundTop || !onStartTour; // attached, or skipped/completed the tour

  // The standing "+" profile portal — the gliding path to acquisition. PERMANENT: from the
  // moment she has classes, growth is always available as PULL. Placed BELOW the "Your classes
  // are ready" box but ABOVE the section cards: classes encompass new subjects too, so the
  // portal governs the whole card list, never the welcome.
  //
  // ★ 2026-08-21 — the "+" was UNGATED and the window in front of it REMOVED (founder). Until
  // now a one-time "Do you teach {subject} to other classes?" window appeared after her first
  // generation, and the "+" unlocked only once that window was resolved — used, ✕-ed, or spent
  // in a past session — via a sticky per-user flag plus four storage keys
  // (expand_shown/_subject/_session/_dismiss). Two reasons it went: (a) it asked for more
  // configuration at the exact moment of her FIRST success, inverting §0's benefit-first rule;
  // (b) it was the third mechanism for one job, alongside tour step 15 and this "+" itself.
  // NOTE the coupling that made this more than a modal deletion: with the window gone, none of
  // the old unlock paths could ever fire, so a new one-class teacher — precisely the person the
  // gliding path exists for — would have been left with no "+" at all and only the settings
  // gear. Ungating it also means she reaches it EARLIER than before: no wait on tour resolution
  // plus a window render. Do not re-gate it.
  //
  // Never competes with the guided tour — EXCEPT step 15, which deliberately features this "+"
  // (the guide rings it and the transparent hand lands on it), so it is surfaced then even
  // though the tour is active.
  // `!lapsed`: an expired subscription hides the growth portal — profile changes are
  // productivity tools she lets go of (§2.5 as amended; the server 402s regardless).
  // ★ 2026-09-13 — the "+" left this screen for the bottom nav (page.jsx .bnav "Add"), where
  // it is always on hand and no longer competes with the tour; `plusShow` and the two greeting-
  // row buttons went with it. the ringed-plus glyph now lives in page.jsx.

  /* ★ RE-ASSERT THE BINDING WHEN THE TOUR ENDS (founder, 2026-08-21: "all actions should end up
   * with LP being loaded onto the default section"). First run binds the lesson to her section
   * as it lands, but the tour's own orchestration FORCES the card unbound at steps ≤9 so it can
   * demonstrate attaching — so a teacher who skips at, say, step 5 is dropped on a card the tour
   * emptied on her behalf and never refilled. Only step 10 re-binds, and she never reached it.
   * `sectionCheck` turns true exactly once, in finishTour, for both endings — so this is the one
   * place that sees every exit. Idempotent: if she completed the tour the card is already bound
   * to this plan and bindSectionChapter is not called. */
  useEffect(() => {
    if (!sectionCheck || typeof window === "undefined") return;
    classes.forEach((c) => {
      const key = `${c.subjectSlug}/${c.gradeSlug}`;
      const plan = latestPrepared(plansByKey[key]);
      if (!plan) return;
      const secKey = `${c.subjectSlug}_${c.gradeSlug}_${c.sectionTag}`;
      let bound = null;
      try { bound = window.localStorage.getItem(`current_chapter_${secKey}`); } catch {}
      if (!bound) bindSectionChapter(secKey, plan.filename);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionCheck, plansByKey]);

  /* Fetch saved plans once per distinct subject·grade the teacher handles.
     ★ ALSO re-fetches when her ACADEMIC YEAR changes (bug found live, 2026-08-26). The
     `prepared` flag on each plan is YEAR-SCOPED, but this effect used to depend only on
     [ready, readiness] — neither of which cutover touches. So a teacher who cut over
     while standing on My Classes kept last year's flags in memory, and the "+" picker
     went on offering last year's lessons as though they were this year's (while the
     prior-year folder, correctly excluding them, sat empty). The year is part of what
     this data means, so it belongs in the dependencies. */
  /* ★ ONE COPY OF THE LISTING, SHARED AND KEPT ON THE DEVICE (founder-reported, 2026-09-14).
     This effect used to hold its own copy in a ref and fetch three times on a cold load — its
     three dependencies settle at different moments, and the guard below it only ever protected
     the placeholder, never the request (measured: /plans/english/iii at 9.6s, 6.8s and 3.4s).
     A per-component ref fixed the triple-fire but not the re-fetch, because the ref dies with
     the component and My Lessons holds a second copy of the same list.
     The store (@aruvi/shared/plans) owns both problems: one module-level copy per subject·class
     that outlives every mount, one request in flight, a device copy read SYNCHRONOUSLY so the
     cards paint before the network is consulted, and one revalidation per session per key.
     Invalidation is explicit and lives at the four places her flags can move — prepare, attach,
     cutover, sign-out. See that file's header for why each one is there. */
  useEffect(() => { setOpenPlan(null);
    if (!ready) return;
    notePlansYear((yearInfo && yearInfo.current_year) || null);
    const seen = new Set();
    classes.forEach((c) => {
      const key = `${c.subjectSlug}/${c.gradeSlug}`;
      if (seen.has(key)) return; seen.add(key);
      const cached = cachedPlans(key);
      setPlansByKey((prev) => (key in prev && prev[key] ? prev : { ...prev, [key]: cached || undefined }));
      fetchPlans(key)
        .then((plans) => setPlansByKey((prev) => ({ ...prev, [key]: plans })))
        .catch(() => setPlansByKey((prev) => ({ ...prev, [key]: prev[key] || [] })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, readiness, yearInfo && yearInfo.current_year]);

  // Reconcile section teaching-state (tracked chapter + pointer + done) from the SERVER into the
  // localStorage cache, so a device shows the same tracking/progress the teacher set elsewhere
  // (fixes the Chrome-vs-iPhone divergence). localStorage stays the optimistic cache; the server
  // row is authoritative here. Bump syncTick when done so the cards re-read the cache.
  //
  // Re-syncs WITHOUT a manual refresh: on load, whenever the tab regains focus / becomes visible
  // (the "I just switched to my iPhone" moment), and on a light interval while visible. We skip a
  // sync while a modal or the lesson view is open so an in-flight action is never clobbered.
  // Hold the section-state sync while an auto-attach (a lesson just generated from a section card)
  // is pending: the mount pull could otherwise read the server before the fresh binding's push
  // lands and clear it. Set during render so it's true before any effect runs.
  const autoBindHoldRef = useRef(false);
  autoBindHoldRef.current = !!pendingAttach;
  const uiBusyRef = useRef(false);
  uiBusyRef.current = !!(attachFor || untrackFor || openPlan || historyFor);
  // Has the local bindings cache been confirmed against the server at least once this
  // mount? Until then an EMPTY cache is not evidence of anything — a cleared browser +
  // a server-restart window made kumar1 (25 bound sections server-side) look like a
  // brand-new teacher and offered him the guided tour (2026-08-24). The tour offer and
  // the "nothing attached" welcome copy wait for this; the cards themselves never do.
  const [reconciled, setReconciled] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const keys = classesFromReadiness(readiness)
      .map((c) => `${c.subjectSlug}_${c.gradeSlug}_${c.sectionTag}`);
    if (!keys.length) { setReconciled(true); return; }   // nothing to reconcile
    let live = true;
    const sync = () => {
      if (!live || uiBusyRef.current || autoBindHoldRef.current) return;
      pullSectionState(keys).then((ok) => {
        if (!live) return;
        if (ok) setReconciled(true);
        setSyncTick((t) => t + 1);
      });
      // The teaching LEDGER reconciles on the same beat — it is read during this very render
      // (the history glyph on every card, and the popup), so a device that has not pulled it
      // shows a class as never having taught anything. Fired ALONGSIDE, not chained: the
      // ledger is a card ORNAMENT, and `reconciled` gates the tour offer and the "nothing
      // attached yet" copy, which must not wait on it. Its own tick keeps the glyph honest
      // without re-rendering on the section pull's schedule.
      pullSectionHistory(keys).then((ok) => {
        if (live && ok) setSyncTick((t) => t + 1);
      });
    };
    sync(); // initial reconcile
    const onVis = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", sync);
    const iv = setInterval(() => { if (document.visibilityState === "visible") sync(); }, 20000);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", sync);
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, readiness, user]);

  // Deep-link from Track (My Lesson Plans): open a specific SECTION's plan, pointer-enabled.
  // Uses the request's OWN subject/grade (My Week is no longer scoped to one subject·grade).
  useEffect(() => {
    if (!pendingOpen || !ready) return;
    const { subject: pSub, grade: pGrade, sectionTag, filename } = pendingOpen;
    if (!pSub || !pGrade || !filename) { onConsumePending && onConsumePending(); return; }
    const sectionKey = `${pSub}_${pGrade}_${sectionTag}`;
    let live = true;
    setLoading(true);
    fetchPlanView(pSub, pGrade, filename)
      .then((d) => {
        if (!live) return;
        // Same label rule as openLesson: her name for the section where she gave one.
        const card = classes.find((c) => c.subjectSlug === pSub && c.gradeSlug === pGrade
          && c.sectionTag === sectionTag);
        setOpenPlan({ view: d.view, sectionKey,
                      sectionLabel: (card && (card.sectionName || card.sectionTag)) || sectionTag || "" });
      })
      .catch(() => {})
      .finally(() => { if (live) { setLoading(false); onConsumePending && onConsumePending(); } });
    return () => { live = false; };
  }, [pendingOpen, ready, onConsumePending]);

  // Return from Prepare-a-lesson launched FROM a section card: the chapter was just prepared, so
  // AUTO-ATTACH it to that section (the card loads it directly — no popup). Refetch this class's
  // plans first so the card can render the chapter title + progress rail. The sync hold above
  // keeps the mount pull from clearing the fresh binding before its push lands.
  useEffect(() => {
    if (!pendingAttach || !ready) return;
    const { subject: pSub, grade: pGrade, sectionTag, filename } = pendingAttach;
    if (!pSub || !pGrade || !sectionTag || !filename) { onConsumeAttach && onConsumeAttach(); return; }
    const key = `${pSub}/${pGrade}`;
    const sectionKey = `${pSub}_${pGrade}_${sectionTag}`;
    let live = true;
    invalidatePlans(key);                         // a prepare just changed HER flags
    fetchPlans(key)
      .then((plans) => { if (live) setPlansByKey((prev) => ({ ...prev, [key]: plans })); })
      .catch(() => {})
      .finally(() => {
        if (!live) return;
        bindSectionChapter(sectionKey, filename);   // auto-attach: localStorage + server push
        setSyncTick((t) => t + 1);                  // re-read the cache → card shows the chapter
        onConsumeAttach && onConsumeAttach();
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAttach, ready]);

  /* ── Guided-tour orchestration (steps 8–15 live on this view; 17 steps total, 2026-07-23) ──
   * Step 15 features the big "+" grow portal on the My Classes home (no bound/popup change — the
   * card stays attached, the popup closes; plusShow surfaces the "+" for the ring + hand).
   * The tour's TARGET is the first class that already has a prepared plan (the first-run case:
   * exactly one lesson, generated for the section fan-out's subject·grade). All tour moves are
   * IDEMPOTENT and keyed off the numeric tourStep, so Next AND Back both land on a consistent
   * state:  ≤9 unbound (Back from 10 undoes the attach) · 9 the track-a-chapter popup is open
   * (the picker moment — mirrors the app's always-through-the-window attach) · ≥10 bound (the
   * REAL attach — the activation) · 11–12 the tracking lesson view is open · 13–14 the card DEMOS
   * the completed state (render-only — her real pointer/done are never touched) · 14 the popup
   * again (now excluding the bound chapter). Skip mid-flight → prev-ref cleanup closes it all.
   * NOTE: these hooks sit ABOVE the !ready early-return (rules of hooks); helper fns declared
   * further down (openLesson, currentChapterFile) resolve at effect run-time, which is fine. */
  // The tour's plan is the teacher's most recently PREPARED lesson — "the lesson you just now
  // generated" — NEVER a raw library entry. /plans returns the whole shared library with a
  // per-tenant `prepared` flag (api/main.py); picking gp[0] unfiltered made the guide demo an
  // arbitrary library chapter (kumar23 generated ch 2, the guide walked ch 9 — 2026-07-06).
  const latestPrepared = (gp) => {
    if (!Array.isArray(gp)) return null;
    const prepped = gp.filter((p) => p.prepared && !p.archived)   // an archived plan never fronts the tour
      .sort((a, b) => String(b.prepared_at || "").localeCompare(String(a.prepared_at || "")));
    return prepped[0] || null;
  };
  const tourTarget = (() => {
    if (tourStep == null) return null;
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i];
      const plan = latestPrepared(plansByKey[`${c.subjectSlug}/${c.gradeSlug}`]);
      if (plan) {
        return { idx: i, c, sectionKey: `${c.subjectSlug}_${c.gradeSlug}_${c.sectionTag}`, plan };
      }
    }
    return null;
  })();
  const tourIdx = tourTarget ? tourTarget.idx : -1;
  const tourDemoDone = tourStep === 14 || tourStep === 15;   // demo-complete rendering only

  // Report the target's name + chapter up so the step copy can say "attach {chapter} to {tag}".
  useEffect(() => {
    if (tourTarget && onTourInfo) {
      onTourInfo({ tag: tourTarget.c.sectionTag, chapter: tourTarget.plan.chapter_title });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep, tourIdx]);

  /* ★ BORROW AND GIVE BACK — which is NOT "only undo what the tour attached", and the difference
     cost a whole walk (founder, 2026-09-17: cards 4, 5, 8 and 9 broken on BOTH surfaces, and
     *"the lesson card shows lesson already attached! and that is why archive box does not show"*).
     ⚠️ THE DEMO REQUIRES AN UNBOUND SECTION FOR STEPS 1-9: the archive control hides on an
     attached plan (step 5), the section card draws its "+" only when nothing is bound (step 8),
     and the picker lists a chapter only when it is not the bound one (step 9). First run ATTACHES
     what it generates, so the tour's own audience always arrives bound — which made a guard that
     "never touches an existing binding" a guard that breaks four steps out of twenty.
     ⚠️ AND THE ORIGINAL HARM WAS REAL: Skip at step 5 used to leave her section stripped. So the
     tour BORROWS — what was bound when it started is remembered, 1-9 unbind, 10 binds the demo
     plan, and if the tour ENDS with the section empty what was there goes back. Declared here,
     above its readers: this file has been bitten by a late const before (ed8fc93d). */
  useEffect(() => {
    if (tourStep == null || !tourTarget) return;
    const { c, sectionKey, plan } = tourTarget;
    /* ⚠️ THE BINDING IS NO LONGER DONE HERE (2026-09-17). It was, and that was the bug the
       founder reported four times: *"Card 5 is still not showing the archive. The archive icon is
       also not showing in the lesson card"*. **This component UNMOUNTS for steps 3-6** — page.jsx
       renders `MyLessonPlans` INSTEAD of `MyPlans` when `editFlow === "lessonplans"`, a ternary
       chain, not two tabs kept alive — so the unbind those steps depend on never ran, the plan
       still read as attached, and `.mlp2-iconbtn.archive` (absent on an attached plan) was never
       in the DOM for `[data-tour]` to find. I had assumed the web kept both mounted and spent
       three walks fixing the phone alone. It now lives in `page.jsx`, which is the shell and is
       always mounted — the same move the phone made into `lib/tour.js`, for the same reason. */
    // Steps 11–13: the tracking lesson view is open (11 tracking · 12 the bookmark ·
    // 13 mark-complete); any other step closes it.
    if (tourStep === 11 || tourStep === 12 || tourStep === 13) {
      if (!openPlan && !loading) openLesson(c.subjectSlug, c.gradeSlug, plan, sectionKey,
        c.sectionName || c.sectionTag);
    } else if (openPlan) setOpenPlan(null);
    // Steps 9 and 14: the "Track a chapter for this section" popup; any other step closes it.
    // (At 9 nothing is bound, so the just-generated lesson is IN the list — the hand points at
    // it; at 14 the bound chapter is excluded, matching the "pick the NEXT chapter" moment.)
    if (tourStep === 9 || tourStep === 15) {
      if (!attachFor) setAttachFor({ c, sectionKey });
    } else if (attachFor) setAttachFor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep, tourIdx, plansByKey, openPlan, loading, attachFor]);

  /* Fetch an opened prior-year folder's lessons for the section's subject·class, filtered
     to what she actually PREPARED that year (the library is shared, so an unfiltered list
     would offer her every sample plan Aruvi owns). */
  useEffect(() => {
    if (!apPrior || !attachFor) return;
    const { c } = attachFor;
    /* The cache key carries HOW MANY of this class's plans are already prepared this
       year, so bringing one back from the folder invalidates the folder's own list —
       otherwise the chapter she just attached is still sitting there when she reopens it. */
    const here = (plansByKey[`${c.subjectSlug}/${c.gradeSlug}`] || []).filter((p) => p.prepared);
    const cacheKey = `${apPrior}|${c.subjectSlug}/${c.gradeSlug}|${here.length}`;
    if (apPriorPlans._for === cacheKey) return;
    let live = true;
    setApPriorPlans({ _for: cacheKey });
    getJSON(`/plans/${c.subjectSlug}/${c.gradeSlug}?year_id=${encodeURIComponent(apPrior)}`)
      .then((d) => {
        if (!live) return;
        const bound = currentChapterFile(`${c.subjectSlug}_${c.gradeSlug}_${c.sectionTag}`);
        /* Exclude anything already offered in THIS year's list above (the same rule the
           My Lessons folder follows): a chapter she has brought back into this year is
           current work, and listing it in both halves of one small modal is just noise.
           The folder answers "what ELSE do I have from last year?". */
        const hereFiles = new Set(here.map((p) => p.filename));
        const mine = (d.plans || []).filter((p) => p.prepared && !p.archived
          && p.filename !== bound && !hereFiles.has(p.filename));
        setApPriorPlans({ _for: cacheKey, [apPrior]: mine });
      })
      .catch(() => { if (live) setApPriorPlans({ _for: cacheKey, [apPrior]: [] }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apPrior, attachFor, plansByKey]);

  // Tour ended (Done or Skip) → close anything the tour opened, back to the plain cards view.
  const prevTourRef = useRef(null);
  useEffect(() => {
    if (prevTourRef.current != null && tourStep == null) {
      /* Closing what the tour opened is this screen's own job and stays. Giving back the borrowed
         binding is page.jsx's — see `tourDemo` there — because this component is not mounted for
         every step that could end the tour. */
      setOpenPlan(null); setAttachFor(null);
      setSyncTick((t) => t + 1);
    }
    prevTourRef.current = tourStep;
  }, [tourStep]);

  // Readiness incomplete → first the 2a welcome landing, then the readiness grid flow.
  if (!ready) {
    if (!setupStarted) {
      // Screen 2a — welcome / readiness-incomplete empty state.
      return (
        <div className="welcome">
          <div className="kicker kicker-ochre welcome-kicker">Welcome to Meyy</div>
          <div className="welcome-title">Let&rsquo;s get your week set up</div>
          <div className="welcome-sub">Meyy needs two quick things before it can plan with you — your weekly grid of classes, and how long your teaching year is.</div>
          <div className="welcome-sub">This only takes a few minutes, and you&rsquo;ll only do it once.</div>
          <button className="welcome-begin" onClick={() => setSetupStarted(true)}>Let&rsquo;s begin →</button>
        </div>
      );
    }
    // Readiness grid flow (ported from readiness-grid-flow.html). Completing it unlocks Generate.
    return (
      <Readiness
        subject={pretty(subject)}
        onComplete={(payload) => { onReady && onReady(payload); /* stay in My Plans → 2b welcome */ }}
      />
    );
  }

  /* `sectionLabel` is what SHE calls the section — her own name where she has given one
     (the 2026-08-30 rename), the tag otherwise — carried into the lesson so the header can say
     which class she is teaching it to (WALK-A-076). The KEY is still the tag, as everything
     else is; this is display only. */
  const openLesson = async (sSlug, gSlug, p, sectionKey, sectionLabel = "") => {
    setLoading(true);
    /* The view is kept on the device when it opens, and read back from there when the network
       is not (2026-09-18: Wi-Fi off → an unhandled "Failed to fetch"). A lesson never opened on
       this browser still cannot open offline — that is said, not thrown. */
    try {
      const view = (await fetchPlanView(sSlug, gSlug, p.filename)).view;
      setOpenPlan({ view, sectionKey, sectionLabel });
    } catch (e) {
      window.alert(String(e && e.message) === "404" ? "This lesson could not be found."
        : "Couldn’t open this lesson — it hasn’t been saved on this device yet. Try again when you’re online.");
    } finally { setLoading(false); }
  };

  // current-LU pointer (per section) from localStorage, for the "On: Learning Unit N" line
  /* ★ ATTACHING A CHAPTER MEANS SHE IS TEACHING IT, FROM UNIT 1 (founder, 2026-09-14).
     This function used to say so BY ACCIDENT: it read the pointer straight into Number(), and
     Number(null) is 0, which passed `n >= 0` and came back as unit 1. The behaviour was right
     and the reason was not — anyone tidying that away would have silently changed the product,
     and the phone (which guarded for null honestly) rendered a DIFFERENT colour for the same
     section, which is how the parity audit found it. So the function is now honest — absent
     means null — and the card states the rule itself. `unitsDoneFor` below still counts 0 for
     an untouched section, so the untrack history gate is unaffected. */
  const pointerFor = (sectionKey) => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(`lu_pointer_${sectionKey}`);
    const n = Number(raw);
    return raw != null && raw !== "" && Number.isFinite(n) && n >= 0 ? n + 1 : null;
  };
  // How many learning units this section has marked complete (= the raw pointer index; 0 when
  // untouched). This is the anti-noise gate for history: a chapter only enters the log if ≥1 unit
  // was completed before it left the current slot (teacher's rule — track/untrack is used casually).
  const unitsDoneFor = (sectionKey) => {
    if (typeof window === "undefined") return 0;
    const n = Number(window.localStorage.getItem(`lu_pointer_${sectionKey}`));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  // Which chapter (filename) a section is currently tracking. Written when a chapter is bound to
  // a class; absent = nothing started yet ("pick a chapter to begin tracking").
  const currentChapterFile = (sectionKey) => {
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem(`current_chapter_${sectionKey}`) || null; } catch { return null; }
  };
  // Every chapter filename currently bound to ANY section of this subject·grade. This is the API's
  // documented "belt-and-braces": a plan a sibling section is actively teaching counts as prepared
  // even when its `prepared` flag was never written (older bindings, or a lost/absent prepared
  // record) — so a chapter 7A/7B are teaching is still offered when attaching to a newly-added 7C.
  const boundFilesForGrade = (sSlug, gSlug) => {
    const set = new Set();
    classes.forEach((c) => {
      if (c.subjectSlug !== sSlug || c.gradeSlug !== gSlug) return;
      const f = currentChapterFile(`${c.subjectSlug}_${c.gradeSlug}_${c.sectionTag}`);
      if (f) set.add(f);
    });
    return set;
  };
  // Completion flag written by LessonView when the last learning unit is marked complete.
  const isDone = (sectionKey) => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(`lu_done_${sectionKey}`) === "1"; } catch { return false; }
  };
  // Bind an already-prepared chapter to a section and return to the cards view — the originating
  // section card now shows this chapter (closing the modal re-renders it). We deliberately do NOT
  // open the lesson: the teacher lands back on My Classes, where she tapped "+", not inside the plan.
  // The pointer + done flag are PER-SECTION, so switching to a new chapter (e.g. from a completed
  // one) resets them — the new chapter starts fresh at its first learning unit.
  /* Attaching a PRIOR-YEAR lesson (2026-08-26). Teaching it again this year makes it this
     year's work, so it is marked prepared in the CURRENT year before binding — otherwise
     the section card would track a chapter that My Lessons could not show, and the plan
     would be stranded in a folder while she taught from it. Awaited so the refetch that
     follows sees the write. */
  const attachPriorChapter = async (c, sectionKey, plan, sourceYear) => {
    const key = `${c.subjectSlug}/${c.gradeSlug}`;
    try {
      // sourceYear rides along so the card can carry a "2026-27 version" stamp.
      await markPrepared(c.subjectSlug, c.gradeSlug, plan.filename, plan.prepared_periods, sourceYear);
    } catch { /* the bind still stands; the next /plans read will reconcile */ }
    /* ★ MERGE, never invalidate (bug found by the founder, 2026-08-26). This used to
       DELETE the cached plan list to force a refetch — but the fetch effect only runs on
       [ready, readiness], so nothing refetched, and every card for this class rendered
       "Pick a chapter to begin" until a remount (navigating to My Lessons and back) put
       the list back. It looked like every attachment had been wiped.
       The plan asset is the same object in either year, so the cached row is upgraded in
       place — instantly correct — and the authoritative list is refetched behind it. */
    setPlansByKey((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : null;
      if (!list) return prev;                       // nothing cached yet; the fetch below fills it
      const has = list.some((p) => p.filename === plan.filename);
      const stamped = { prepared: true, archived: false, prepared_source_year: sourceYear || null };
      const upgraded = has
        ? list.map((p) => (p.filename === plan.filename ? { ...p, ...stamped } : p))
        : list.concat([{ ...plan, ...stamped }]);
      return { ...prev, [key]: upgraded };
    });
    setApPrior(null);
    attachChapter(c, sectionKey, plan);
    invalidatePlans(key);                           // the attach changed HER flags
    fetchPlans(key)
      .then((plans) => setPlansByKey((prev) => ({ ...prev, [key]: plans })))
      .catch(() => {});                             // the optimistic row already stands
  };

  const attachChapter = (c, sectionKey, plan) => {
    bindSectionChapter(sectionKey, plan.filename);   // shared writer (same path the preview uses)
    setAttachFor(null);
    // Force an immediate re-render so the card reflects the new binding at once. On the DIRECT
    // first-run "+" path attachFor is already null, so setAttachFor(null) is a no-op that React
    // skips — without this bump the card only refreshed on the next incidental render (the 20s
    // sync / a tab focus), which read as the "+ works late" lag.
    setSyncTick((t) => t + 1);
  };

  // Clear a section's chapter binding + pointer + done. The chapter itself is untouched (still in
  // My Lessons); the card returns to the unstarted "Pick a chapter" (grey) state.
  const clearBinding = (sectionKey) => unbindSection(sectionKey);
  // Untrack (ongoing/started cards) — the reversal of tracking, via a confirm window. Logs an
  // "untracked" history entry ONLY when ≥1 unit was completed (the anti-noise gate); a casual
  // attach→untrack with no progress leaves no trace. We stamp the progress reached (units done /
  // total) so the history row can say how far the section got before untracking.
  const untrackChapter = (sectionKey, plan) => {
    if (plan && unitsDoneFor(sectionKey) >= 1) {
      recordHistory(sectionKey, {
        file: plan.filename, chapter_number: plan.chapter_number, chapter_title: plan.chapter_title,
        status: "untracked", units_done: unitsDoneFor(sectionKey), total_units: plan.total_units || null,
        ts: Date.now(),
      });
    }
    clearBinding(sectionKey); setUntrackFor(null);
  };
  // Move on from a COMPLETED chapter: one click frees it (card reverts to unstarted grey) and opens
  // the picker to track the next chapter — no confirm, since a finished chapter has no place to lose.
  // A completed chapter always earns its history row (all units done).
  const moveOnFromCompleted = (c, sectionKey, plan) => {
    if (plan) {
      recordHistory(sectionKey, {
        file: plan.filename, chapter_number: plan.chapter_number, chapter_title: plan.chapter_title,
        status: "completed", units_done: plan.total_units || null, total_units: plan.total_units || null,
        ts: Date.now(),
      });
    }
    clearBinding(sectionKey); setAttachFor({ c, sectionKey });
  };

  if (loading) return <div className="spin">Opening plan…</div>;
  if (openPlan) return <LessonView view={openPlan.view} sectionKey={openPlan.sectionKey}
    sectionLabel={openPlan.sectionLabel || ""}
    tourUnit={tourStep === 11 || tourStep === 12 || tourStep === 13} onExit={() => setOpenPlan(null)} />;

  // "+" attach-a-lesson picker — a focused MODAL layered over the cards (not a separate screen),
  // scoped to ONE subject·class. Lists chapters already prepared for that subject·grade (tap =
  // attach + open) and offers to prepare a brand-new one. Rendered at the bottom of the main
  // cards view; see attachModal below.
  const attachModal = attachFor ? (() => {
    const { c, sectionKey } = attachFor;
    const gradePlans = plansByKey[`${c.subjectSlug}/${c.gradeSlug}`];
    // Only chapters SHE PREPARED (never raw library entries — /plans returns the whole shared
    // library; My Lessons applies the same filter), excluding the chapter already bound to this
    // section (e.g. the just-completed one) — she's here to pick a DIFFERENT chapter.
    // ARCHIVED plans are excluded too (founder, 2026-08-01): the archive box holds a plan
    // OUT of circulation — restore it in My Lessons first, then attach. (An attached plan
    // can never be archived, so the sibling-section pass-through below is unaffected.)
    const boundFile = currentChapterFile(sectionKey);
    const alsoAttachable = boundFilesForGrade(c.subjectSlug, c.gradeSlug); // bound to a sibling section
    const listPlans = Array.isArray(gradePlans)
      ? gradePlans.filter((p) => (p.prepared || alsoAttachable.has(p.filename)) && p.filename !== boundFile && !p.archived)
      : gradePlans;
    return (
      <div className="ap-overlay" onClick={() => setAttachFor(null)}>
        {/* data-tour="attach-pop": the tour's step-8 and step-13 spotlights wrap this popup. */}
        <div className="ap-modal" data-tour="attach-pop" onClick={(e) => e.stopPropagation()}>
          <button className="ap-close" aria-label="Close" onClick={() => setAttachFor(null)}>✕</button>
          <div className="ap-head">
            <div className="ap-kicker">{pretty(c.subjectSlug)} · Class {classNum(c.grade)} · {c.sectionTag}</div>
            <div className="ap-title">Track a chapter for this section</div>
            <div className="ap-sub">Pick a chapter you&rsquo;ve already prepared to track for this section, or build a new one.</div>
          </div>
          {/* More than two prepared chapters → the list caps at TWO visible rows and wheels
              (drag / scroll) through the rest, so the modal never grows tall enough to push
              its header — and the ✕ — off-screen. */}
          <div className={`ap-list${Array.isArray(listPlans) && listPlans.length > 2 ? " ap-list-capped" : ""}`}>
            {listPlans === undefined ? (
              <div className="ap-loading">Loading lessons…</div>
            ) : listPlans.length === 0 ? (
              <div className="ap-none">No other lessons prepared for this section yet.</div>
            ) : (
              listPlans.map((p, pi) => (
                // First row carries data-tour="attach-pop-row" — the tour's step-8 hand sits on
                // it ("select the lesson you just generated").
                <button key={p.filename} className="ap-row" data-tour={pi === 0 ? "attach-pop-row" : undefined}
                  onClick={() => attachChapter(c, sectionKey, p)}>
                  {/* One line, one sentence: "Ch. 05: Force and Pressure" (founder 2026-07-25).
                      The number keeps its pine emphasis — .ch-no carries the colour the old
                      .ch-meta-tx b had — and the title follows it in ink after the colon. */}
                  <span className="ch-meta">
                    <span className="ch-name" title={p.chapter_title}>
                      <b className="ch-no">Ch. {pad(p.chapter_number)}:</b> {p.chapter_title}
                    </span>
                    <span className="ch-go" aria-hidden="true">›</span>
                  </span>
                  {p.duration_label ? <span className="sc-durline">{p.duration_label}</span> : null}
                  {/* A plan she brought forward keeps saying so, even in the picker. */}
                  <YearStamp year={p.prepared_source_year} lpYear={p.lp_year_display} />
                </button>
              ))
            )}
          </div>
          {/* ★ LAST YEAR'S LESSONS, right here in the picker (founder, 2026-08-26). She
              taught Ch 5 last June and wants it again this June — asking her to regenerate
              a plan she already has would be absurd. Sits BELOW this year's list and above
              "prepare a new one", collapsed, so it never competes with current work.
              Attaching one makes it this year's work (see attachPriorChapter). */}
          {((yearInfo && yearInfo.prior_years) || []).slice().sort().reverse().map((yid) => (
            <div className="ap-prior" key={yid}>
              <button className="ap-prior-head" aria-expanded={apPrior === yid}
                onClick={() => setApPrior(apPrior === yid ? null : yid)}>
                <span className="ap-prior-caret" aria-hidden="true">{apPrior === yid ? "▾" : "▸"}</span>
                <span className="ap-prior-yr">{yid}</span>
                <span className="ap-prior-note">lessons you prepared last year</span>
              </button>
              {apPrior === yid && (
                apPriorPlans[yid] === undefined ? (
                  <div className="ap-loading">Loading lessons…</div>
                ) : apPriorPlans[yid].length === 0 ? (
                  <div className="ap-none">Nothing prepared for this class in {yid}.</div>
                ) : (
                  <div className="ap-list ap-list-capped">
                    {apPriorPlans[yid].map((p) => (
                      <button key={p.filename} className="ap-row"
                        onClick={() => attachPriorChapter(c, sectionKey, p, yid)}>
                        <span className="ch-meta">
                          <span className="ch-name" title={p.chapter_title}>
                            <b className="ch-no">Ch. {pad(p.chapter_number)}:</b> {p.chapter_title}
                          </span>
                          <span className="ch-go" aria-hidden="true">›</span>
                        </span>
                        {p.duration_label ? <span className="sc-durline">{p.duration_label}</span> : null}
                        {/* The folder's own year IS the stamp — these rows were fetched
                            under it, so the server flag is absent by construction. */}
                        <YearStamp year={yid} />
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          ))}

          <div className="mlp-allocate">
            <span className="mlp-allocate-q">Need a chapter you don&rsquo;t have yet?</span>
            <button className="mlp-allocate-btn prepare-cta"
              onClick={() => onEnterGenerate && onEnterGenerate({ subject: c.subjectSlug, grade: c.gradeSlug, single: true, returnSection: c.sectionTag })}>
              Prepare a new lesson →
            </button>
          </div>
        </div>
      </div>
    );
  })() : null;

  // Untrack confirmation — a deliberate window so she's sure. Reversal of tracking; makes the plan
  // available to track again and clears her place in it.
  const untrackModal = untrackFor ? (() => {
    const { c, sectionKey, plan } = untrackFor;
    // Same chapter phrasing as the "+" picker: "Ch. 05: Force and Pressure".
    const chLabel = `${plan.chapter_number ? `Ch. ${pad(plan.chapter_number)}: ` : ""}${plan.chapter_title}`;
    return (
      <div className="ap-overlay" onClick={() => setUntrackFor(null)}>
        <div className="ap-modal ap-confirm" onClick={(e) => e.stopPropagation()}>
          <button className="ap-close" aria-label="Close" onClick={() => setUntrackFor(null)}>✕</button>
          <div className="ap-head">
            <div className="ap-kicker">{pretty(c.subjectSlug)} · Class {classNum(c.grade)} · {c.sectionTag}</div>
            <div className="ap-title">Stop tracking this chapter?</div>
            <div className="ap-sub">{c.sectionTag} will stop tracking &ldquo;{chLabel}&rdquo;. It will be available to track again for this section.</div>
          </div>
          <div className="ap-confirm-actions">
            <button className="ap-btn-ghost" onClick={() => setUntrackFor(null)}>Keep tracking</button>
            <button className="ap-btn-danger" onClick={() => untrackChapter(sectionKey, plan)}>Stop tracking</button>
          </div>
        </div>
      </div>
    );
  })() : null;

  // Chapter-history popup — an instant in/out list (a function, not a screen). Shows ONE row per
  // chapter (the log is keyed by file → latest action wins), newest first. The still-bound current
  // chapter is overlaid live as "Ongoing"/"Completed" ONLY when it has progress (≥1 unit), so a
  // freshly-attached, untouched chapter never appears (matches the anti-noise gate).
  const historyModal = historyFor ? (() => {
    const { c, sectionKey } = historyFor;
    const gradePlans = plansByKey[`${c.subjectSlug}/${c.gradeSlug}`];
    const byFile = {};
    readHistory(sectionKey).forEach((h) => { byFile[h.file] = { ...h }; });
    const curFile = currentChapterFile(sectionKey);
    if (curFile) {
      const done = isDone(sectionKey);
      if (done || unitsDoneFor(sectionKey) >= 1) {
        const cp = Array.isArray(gradePlans) ? gradePlans.find((p) => p.filename === curFile) : null;
        const prev = byFile[curFile];
        const total = cp ? (cp.total_units || null) : (prev ? prev.total_units : null);
        byFile[curFile] = {
          file: curFile,
          chapter_number: cp ? cp.chapter_number : (prev ? prev.chapter_number : null),
          chapter_title: cp ? cp.chapter_title : (prev ? prev.chapter_title : ""),
          status: done ? "completed" : "ongoing",
          units_done: done ? total : unitsDoneFor(sectionKey),
          total_units: total,
          ts: Date.now() + 1,   // current action sorts to the top
        };
      }
    }
    const rows = Object.values(byFile).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return (
      <div className="ap-overlay" onClick={() => setHistoryFor(null)}>
        <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
          <button className="ap-close" aria-label="Close" onClick={() => setHistoryFor(null)}>✕</button>
          <div className="ap-head">
            <div className="ap-kicker">{pretty(c.subjectSlug)} · Class {classNum(c.grade)} · {c.sectionTag}</div>
            <div className="ap-title">Section history</div>
            <div className="ap-sub">Where each chapter stands for this section.</div>
          </div>
          <div className="ap-list">
            {rows.length === 0 ? (
              <div className="ap-none">No chapters taught yet.</div>
            ) : (
              rows.map((r) => {
                const st = normStatus(r.status);
                return (
                <div className="ch-row" key={r.file}>
                  {/* "Ch. 05: Force and Pressure" — same one-line phrasing as the "+" picker,
                      status pill still pinned to the right end of that line. */}
                  <div className="ch-meta">
                    <span className="ch-name" title={r.chapter_title}>
                      <b className="ch-no">Ch. {r.chapter_number ? pad(r.chapter_number) : "—"}:</b> {r.chapter_title}
                    </span>
                    <span className={`ch-pill ch-${st}`}>{HISTORY_LABEL[st] || "Untracked"}</span>
                  </div>
                  {r.total_units ? (
                    <div className="sc-rail ch-rail"
                      aria-label={`${r.units_done || 0} of ${r.total_units} units completed`}>
                      {Array.from({ length: r.total_units }).map((_, t) => (
                        <span key={t} className={`sc-tick ${t < (r.units_done || 0) ? "done" : (st === "ongoing" && t === r.units_done ? "cur" : "")}`} />
                      ))}
                    </div>
                  ) : null}
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  })() : null;

  // Home header: time-of-day greeting (repeat view only — see below).
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  // Never greet her by her mobile number (founder, 2026-08-25): the id is now the
  // mobile for onboarded teachers, and "Good evening, 1234567890!" is nobody's name.
  // Until a real name is acquired (subscription checkout), a numeric id greets plainly:
  // "Good evening!". Named dev ids (kumar1) keep the personal touch.
  const rawId = (user || "").trim();
  const firstName = /^\d+$/.test(rawId) ? "" : rawId;

  // Ready but the teacher has no classes at all (empty profile).
  if (!classes.length) {
    return (
      <div>
        <div className="dash-hd">
          <div>
            <div className="dash-title">{greeting}{firstName ? `, ${firstName}` : ""}!</div>
          </div>
        </div>
        <div className="slotcard slot-empty">
          <div className="slotrail dim" />
          <div className="slotbody">
            <div className="slot-title muted">No classes set up yet</div>
            <div className="slot-meta">To start planning, add the classes you teach under Class in the Add window from the bottom tool bar.</div>
          </div>
        </div>
      </div>
    );
  }

  // Nothing planned yet? The class cards still show — each as "Pick a chapter to begin" —
  // with a welcome CTA banner ABOVE them. Cards are never hidden.
  const anyBound = classes.some((c) => currentChapterFile(`${c.subjectSlug}_${c.gradeSlug}_${c.sectionTag}`));
  // "No bindings" is only BELIEVABLE once the server has confirmed it (or the cache
  // already shows a binding, which needs no confirmation). Until then, neither the
  // welcome copy nor the tour offer may treat her as new — see the reconcile note above.
  const bindingsKnown = anyBound || reconciled;
  // Any lesson SHE PREPARED for one of her classes? After first-gen this is TRUE (the lesson
  // was deposited but left unattached), so the welcome nudge points her at the "+" to attach it.
  // Prepared-only — a raw library entry must never trigger the nudge/welcome copy.
  const anyPlans = Object.values(plansByKey).some((v) => Array.isArray(v) && v.some((p) => p.prepared));

  /* My Classes home: a FLAT list of section cards — no day buckets, no "today", no pace pills.
   * Each card answers one question — "where did I stop with this class?" — via the LU progress
   * rail and a status shade (grey=not started, green=ongoing, gold=completed) carried on a
   * left-edge accent bar. FIRST-TIME view (no chapter bound anywhere) drops the greeting and
   * shows the welcome banner; REPEAT view shows the greeting + "continue where you left off". */

  /* ★ SUBJECT BANDS — but ONLY for a teacher who teaches more than one (founder, 2026-08-30).
   * "Teachers compartmentalize subjects", and the flat list made her read the subject off every
   * card to find the three that belong together. A single-subject teacher — the common case —
   * sees exactly what she saw before: no heading, no band, nothing added to a screen where the
   * grouping would have one member.
   * NOTHING MOVES. `classesFromReadiness` already walks subjects → grades → sections in profile
   * order, so same-subject cards are already adjacent; this only inserts headings into an order
   * that was always there. The band is built by ADJACENCY rather than by a map keyed on the
   * subject, which is what guarantees that: a map would silently reorder if the underlying walk
   * ever changed, where adjacency can only ever mis-SPLIT, which is visible.
   * Each item keeps its ORIGINAL index `i` — the guided tour addresses its target card by
   * position (`i === tourIdx` on three separate elements), so re-indexing inside a band would
   * point the hand at the wrong card. */
  const bands = [];
  classes.forEach((c, i) => {
    const last = bands[bands.length - 1];
    if (last && last.subject === c.subjectName) last.items.push({ c, i });
    else bands.push({ subject: c.subjectName, slug: c.subjectSlug, items: [{ c, i }] });
  });
  const banded = bands.length > 1;

  return (
    <div>
      {/* The standing "+" portal (see the unlock note above) opens the Subject · Class ·
          Section chooser; each option routes into the SAME profile flows the settings gear
          uses (one implementation, two doors). PLACEMENT (founder, 2026-07-06): on the repeat
          view it sits IN the greeting row, right side — no row of its own, no lost real estate
          (and it rides the sticky greeting, so it stays reachable while the cards scroll). On
          the first-time view it keeps its own row BELOW "Your classes are ready" — classes
          encompass new subjects too, so it never sits above the welcome. */}
      {anyBound && (
        <div className="dash-hd">
          <div>
            <div className="dash-title">{greeting}{firstName ? `, ${firstName}` : ""}!</div>
            <div className="dash-sub">Continue where you left off with every class.</div>
          </div>
        </div>
      )}

      {!anyBound && bindingsKnown && (
        <div className="dash-welcome dash-welcome-row">
          <div className="dash-welcome-text">
            <div className="dash-welcome-title">Your classes are ready</div>
            {/* Reassurance while the tour is still on offer; the instruction only after she has
                taken it or skipped it (tourResolved). Telling a teacher to tap "+" the second her
                classes appear is an instruction she has no context for yet. */}
            <div className="dash-welcome-sub">{
              anyPlans && !tourResolved
                ? <>Your first lesson is saved in My Lessons — it will wait there for you.</>
                : anyPlans
                  ? <>Your lesson is waiting in My Lessons — tap <b>+</b> on a class to start teaching it.</>
                  : <>Tap <b>+</b> on a class to prepare its first lesson.</>
            }</div>
          </div>
        </div>
      )}

      {/* ★ ACADEMIC-YEAR CUTOVER (founder, 2026-08-26 — administrative architecture Step 2).
          From the cutover date onwards this sits at the TOP of My Classes on every visit
          until she acts. It is deliberately an OFFER, never a timer: a teacher still
          finishing a chapter in early June must not find her pointers wiped out from
          under her, so nothing moves until she taps. It also states plainly what will
          and will not happen — the fear here is losing last year's work, and the answer
          is that nothing is deleted at all. */}
      {yearInfo && (yearInfo.cleanup_due ?? yearInfo.cutover_due) && !tourActive && !cutoverResult && !cutoverDismissed && (
        <div className="dash-nudge yr-nudge">
          {/* A REAL dismiss control (founder, 2026-08-26 — "Not now" had been a plain
              <span>, so tapping it did nothing). Session-only: closing it clears this
              visit, and the offer returns on her next sign-in, which is the founder's
              rule — every login until she acts. Nothing is persisted, because a stored
              "don't ask again" would quietly strand a teacher in last year. */}
          <button className="yr-x" aria-label="Not now — ask me next time"
            title="Not now" onClick={() => onDismissCutover && onDismissCutover()}>✕</button>
          <div className="dash-nudge-row">
            <div className="dash-nudge-text">
              {/* The YEAR has already turned — Aruvi does that on its own date. What is
                  left is hers: whether to clear last year's tracking and start the new
                  cohort on empty cards. So the question is about her CLASSES, not the
                  calendar (founder, 2026-08-26). */}
              <div className="dash-nudge-title">
                {yearInfo.current_year} has begun — start your classes fresh?
              </div>
              <div className="dash-nudge-sub">
                You are still tracking last year&rsquo;s chapters, so you can finish
                anything you were part-way through. When you&rsquo;re ready for the new
                batch, clear them and your section cards start empty. Your class list stays
                as it is, and nothing is deleted — every{" "}
                {(yearInfo.prior_years || []).slice(-1)[0] || "earlier"} lesson plan and
                note stays in My Lessons under that year.
              </div>
            </div>
          </div>
          <div className="yr-nudge-row">
            <button className="yr-nudge-go" disabled={cutoverBusy}
              onClick={() => onCutover && onCutover()}>
              {cutoverBusy ? "Clearing…" : "Start my classes fresh →"}
            </button>
            {/* A real "Not yet" BESIDE the start button (founder, 2026-08-26) — the same
                act as the ✕, but where a teacher deciding between two options actually
                looks. The ✕ stays for the corner-tap habit; both defer, neither is
                remembered beyond this visit. */}
            <button className="yr-nudge-later"
              onClick={() => onDismissCutover && onDismissCutover()}>
              Not yet
            </button>
          </div>
        </div>
      )}

      {/* What actually happened, stated as fact rather than promise. */}
      {cutoverResult && (
        <div className="dash-nudge yr-done">
          <div className="dash-nudge-row">
            <div className="dash-nudge-text">
              <div className="dash-nudge-title">
                {cutoverResult.already_done
                  ? `Your classes are already set for ${cutoverResult.opened_year}.`
                  : `Ready for ${cutoverResult.opened_year}.`}
              </div>
              <div className="dash-nudge-sub">
                {cutoverResult.already_done ? (
                  <>Nothing changed.</>
                ) : (
                  <>
                    {cutoverResult.sections_cleared ?? cutoverResult.sections_carried} section
                    {(cutoverResult.sections_cleared ?? cutoverResult.sections_carried) === 1 ? "" : "s"} cleared
                    and ready for your new batch.
                    {cutoverResult.plans_archived > 0 && (
                      <> Your {cutoverResult.plans_archived} {cutoverResult.closed_year} lesson
                        plan{cutoverResult.plans_archived === 1 ? "" : "s"} {cutoverResult.plans_archived === 1 ? "is" : "are"} still
                        in My Lessons under <b>{cutoverResult.closed_year}</b>.</>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="yr-nudge-row">
            <button className="yr-nudge-go"
              onClick={() => onDismissCutoverResult && onDismissCutoverResult()}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ★ THE TOUR COMES FIRST (founder, 2026-07-26). This used to sit BELOW the card list,
          under a welcome box that told her to "tap + on a class" — so the first thing she read was
          an instruction, and with more than one section it did not even say which card to tap. The
          lesson is already safe in My Lessons; attaching it is a deliberate act she can do any
          time. So the invitation now sits directly under the welcome, above the cards, and says
          out loud that the lesson will wait. The "+" instruction is held back until the tour is
          resolved (taken or skipped) — see the welcome sub above. */}
      {/* WALK-A-014 (founder, 2026-09-20): the offer shows on My Classes too. It used to require
          !anyBound — but first run now attaches her lesson, so a first-run teacher could never see
          it here. Eligibility (≤1 bound section, no progress) is page.jsx's job: it passes
          onStartTour only while the tour is genuinely on offer. */}
      {bindingsKnown && anyPlans && !tourActive && onStartTour && (
        /* The WHOLE window is the target (founder, 2026-07-26) — a teacher reading an invitation
           should not have to hunt for the small link at the bottom of it. It is a real button for
           assistive tech too: role + tabIndex + Enter/Space, with ONE accessible name covering the
           lot. The "Show me how →" line is now a plain <span>: a button inside a button is invalid
           markup, and a direct hit on it would have fired onStartTour twice. */
        <div className="dash-nudge dash-nudge-click" role="button" tabIndex={0}
          aria-label="Show me how — start the guided walkthrough"
          onClick={() => onStartTour()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
              e.preventDefault(); onStartTour();
            }
          }}>
          <div className="dash-nudge-row">
            <span className="dash-nudge-hand" aria-hidden="true">{RouteIcon}</span>
            <div className="dash-nudge-text">
              <div className="dash-nudge-title">Let me show you around first</div>
              <div className="dash-nudge-sub">
                A short walk through tracking sections and handling lesson plans. Your lesson stays
                safe while we look around.
              </div>
            </div>
          </div>
          <span className="dash-nudge-cta" aria-hidden="true">Show me how&nbsp;&rarr;</span>
        </div>
      )}

      {/* Banded (>1 subject) or the plain list she has always had. The CARD itself is one
          renderer either way — `renderCard` — so the two paths can never drift apart. */}
      {banded ? (
        <div className="sc-bands">
          {bands.map((b) => (
            <div className="sc-band" key={b.slug}>
              {/* The subject, said ONCE per band. It is a structural label, so it takes the
                  house's mono uppercase kicker rather than a display-serif heading — this is
                  the spine of the list, not a title competing with the chapter names. */}
              <div className="sc-band-hd">{b.subject}</div>
              <div className="sc-list">{b.items.map(({ c, i }) => renderCard(c, i))}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="sc-list">{classes.map((c, i) => renderCard(c, i))}</div>
      )}

      {/* (The one-time "Do you teach {subject} to other classes?" window stood here until
          2026-08-21 — removed with its storage keys; see the plusShow note above. All growth
          is now PULL, via the standing "+" portal.) */}

      {/* (Both the "Would you like to check your set-up?" prompt and the "+" portal chooser stood
          here until 2026-08-27. They are ONE window now — ProfilePortal.jsx — owned by page.jsx,
          because the check mood also opens over My Lessons and because every row has to be able
          to come back to it after a trip through the teaching profile. The "+" below just asks
          for it.) */}

      {attachModal}
      {untrackModal}
      {historyModal}
    </div>
  );

  /* ONE card, rendered the same whether or not it sits inside a subject band. The only thing
     the band changes is the KICKER: with the subject named above the group, repeating it on
     every card is the same word three times on one screen — so banded cards carry just
     "Ch 4", and an unattached card carries no kicker at all rather than an empty line.
     A function DECLARATION, deliberately: it is hoisted, so it can sit below the return where
     it does not push 90 lines of card markup between the reader and the shape of the screen. */
  function renderCard(c, i) {
          const sectionKey = `${c.subjectSlug}_${c.gradeSlug}_${c.sectionTag}`;
          const gradePlans = plansByKey[`${c.subjectSlug}/${c.gradeSlug}`];
          const file = currentChapterFile(sectionKey);
          const plan = file && Array.isArray(gradePlans) ? gradePlans.find((p) => p.filename === file) : null;
          const hist = hasHistory(sectionKey);   // any PAST chapters logged → show the history glyph

          /* ★ A BOUND CHAPTER WHOSE LIST HAS NOT ARRIVED IS NOT AN UNBOUND SECTION
             (founder-reported, 2026-09-14). `plan` needs TWO things — the binding, which is in
             localStorage and known instantly, and the plan object, which comes from /plans and
             may take seconds against the deployed API. With only the second missing the card
             used to fall through to "Pick a chapter to begin" — telling her, in words, that a
             class she is teaching has nothing attached, then correcting itself a second later.
             On the Mac's local API the fetch was a few milliseconds and nobody ever saw it.
             `file` is the tell: it says a chapter IS bound, so the card waits instead of
             claiming otherwise. The phone already did this ("no false 'pick a chapter' flashes
             on a real network", app/(app)/index.jsx); the web did not. */
          if (!plan && file && gradePlans === undefined) {
            return (
              <div className="sc-card st-going" key={i}>
                <SectionTag c={c} />
                <div className="sc-body">
                  {banded ? null : <span className="sc-kicker">{pretty(c.subjectSlug)}</span>}
                  <div className="sc-title muted">Loading your lesson…</div>
                </div>
              </div>
            );
          }

          // No chapter bound to this class yet → "pick a chapter to begin" (grey / not started).
          // The card is NOT tappable-to-generate anymore; the "+" opens the attach picker instead.
          /* Is THIS card the one waiting? One card at most: the descriptor names a section tag
             and `preparingSection` is set only for a prepare launched from a section's "+". */
          const waiting = !!preparingCard && preparingSection === c.sectionTag
            && preparingCard.subject === c.subjectSlug && preparingCard.grade === c.gradeSlug;
          const prepTotal = waiting
            ? (preparingCard.rows || []).reduce((a, r) => a + (Number(r.count) || 0), 0) : 0;

          if (!plan) {
            // The card stays EMPTY even after first-run generation (founder's call, 2026-07-09):
            // the freshly generated lesson lands ONLY in My Lessons and is never auto-named onto a
            // section card. The card just reads "Pick a chapter to begin" until she taps "+" and
            // attaches a lesson herself through the track-a-chapter picker.
            /* ★ THE LESSON THIS CARD IS WAITING FOR (founder, 2026-09-15: "it should show
               progress on the section card from which it was generated and upon completion,
               settle in the section card with the new LP attached").
               The 2026-08-06 rule is that the wait happens WHERE THE LESSON WILL APPEAR. For a
               prepare launched from this card's own "+", that is HERE — so the bar sits on the
               card, not on an otherwise-empty Generate screen. Same card, same height, same
               fill; what changes is the title (the chapter she asked for — known and final,
               nothing fetched to draw it) and the last line.
               ⚠️ The "+" is GONE while it waits: offering her a second chapter for a slot that
               is about to be filled is an invitation to a collision. */
            if (waiting) {
              return (
                <div className="sc-card st-new sc-proposed" key={i} aria-live="polite">
                  <SectionTag c={c} />
                  <div className="sc-body">
                    {banded ? null : <span className="sc-kicker">{pretty(c.subjectSlug)}</span>}
                    <div className="sc-title">
                      {preparingCard.chapterNo ? <b>Ch {pad(preparingCard.chapterNo)}: </b> : null}
                      {preparingCard.chapterTitle}
                    </div>
                    {preparingCard.failed ? (
                      <div className="sc-prep sc-prep-failed">
                        {/* WALK-A-019, second half (founder, 2026-09-21, web sweep): the My
                            Lessons card got "Try again" and both phone cards got it; THIS card —
                            the section card, where a first lesson fails — was missed, so she was
                            left with Dismiss and a walk back through chapter, duration and
                            periods to retry a choice she had already made. */}
                        <span className="sc-prep-note" title={preparingCard.message}>
                          {preparingCard.message
                            || "Couldn’t build the lesson plan right now. Try again in a moment."}
                        </span>
                        <span className="sc-prep-actions">
                          {onRetryPreparing && (
                            <button type="button" className="sc-prep-dismiss"
                              onClick={() => onRetryPreparing(preparingCard)}
                              aria-label="Try preparing this lesson again">Try again</button>
                          )}
                          <button type="button" className="sc-prep-dismiss" onClick={onDismissPreparing}
                            aria-label="Dismiss this failed lesson">Dismiss</button>
                        </span>
                      </div>
                    ) : (
                      <div className="sc-prep">
                        <div className="sc-prep-bar"><i /></div>
                        <span className="sc-prep-note">
                          Preparing your {prepTotal} {prepTotal === 1 ? "period" : "periods"} lesson plan…
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return (
              // On the tour's TARGET card, the "+" carries data-tour="section-add" — step 7's
              // spotlight + hand sit on it ("click the + sign of that section card").
              <div className="sc-card st-new" key={i}>
                <SectionTag c={c} muted />
                <div className="sc-body">
                  {/* No kicker at all inside a band: the subject is the heading above, and this
                      card has no chapter to name, so an empty line is all that would be left. */}
                  {banded ? null : <span className="sc-kicker">{pretty(c.subjectSlug)}</span>}
                  <div className="sc-title muted">
                    Pick a chapter to begin
                  </div>
                </div>
                <div className="sc-right">
                  <button className="sc-add" data-tour={i === tourIdx ? "section-add" : undefined}
                    aria-label="Attach a lesson to this section"
                    onClick={() => setAttachFor({ c, sectionKey })}>+</button>
                  {hist && (
                    <button className="sc-hist" aria-label="Section history for this section"
                      onClick={() => setHistoryFor({ c, sectionKey })}>{HistoryIcon}</button>
                  )}
                </div>
              </div>
            );
          }

          // A bound chapter is BEING TAUGHT, from unit 1 until the pointer says otherwise
          // (founder, 2026-09-14) — so a bound card is never the unstarted sand one, and
          // `st-new` below belongs to the no-chapter card alone.
          const lu = pointerFor(sectionKey) || 1;     // current LU, 1-based
          // Steps 9–10 DEMO the target card as completed (render-only — her real done flag and
          // pointer are untouched; the underlying state stays "attached, not started").
          const done = isDone(sectionKey) || (tourDemoDone && i === tourIdx);
          const total = plan.total_units || null;      // LU count from the plans listing
          const ticks = total ? Array.from({ length: total }) : null;
          const status = done ? "st-done" : "st-going";
          return (
            <div className={`sc-card ${status}`} key={i}
              data-tour={i === tourIdx ? "section-card-target" : undefined}
              onClick={() => openLesson(c.subjectSlug, c.gradeSlug, plan, sectionKey,
                c.sectionName || c.sectionTag)}>
              <SectionTag c={c} />
              <div className="sc-body">
                {/* Banded: the subject is overhead, so the kicker is just the chapter — and
                    nothing at all when the plan carries no chapter number. */}
                {banded
                  ? (plan.chapter_number ? <span className="sc-kicker">Ch {plan.chapter_number}</span> : null)
                  : <span className="sc-kicker">{pretty(c.subjectSlug)}{plan.chapter_number ? ` · Ch ${plan.chapter_number}` : ""}</span>}
                <div className="sc-title" title={plan.chapter_title}>{plan.chapter_title}</div>
                {/* ★ YEAR STAMP (founder, 2026-08-26). A chapter she carried forward from an
                    earlier academic year says so, in small print, on the card she teaches
                    from. It matters because the plan may have been written against an
                    earlier constitution or an earlier textbook edition — she should never
                    be uncertain which version is in her hand. Absent for anything she
                    prepared this year, which is the ordinary case. */}
                <YearStamp year={plan.prepared_source_year} lpYear={plan.lp_year_display} />
                {ticks && (
                  <div className="sc-rail" aria-label={done ? `${total} units, completed` : lu ? `Unit ${lu} of ${total}` : `${total} units, not started`}>
                    {ticks.map((_, t) => (
                      <span key={t} className={`sc-tick ${done || (lu && t < lu - 1) ? "done" : lu && t === lu - 1 ? "cur" : ""}`} />
                    ))}
                  </div>
                )}
              </div>
              {/* Right-slot actions. COMPLETED → a "Complete" label + "+"; clicking "+" frees the
                  finished chapter (card reverts to unstarted) and opens the picker for the next one.
                  STILL TRACKING → "−" untrack, the deliberate reversal via a confirm window.
                  stopPropagation so neither opens the lesson. */}
              {done ? (
                <div className="sc-actions sc-actions-col">
                  <span className="sc-status-done">Complete</span>
                  {/* Step 10's spotlight + hand land on this "+" (the demo-complete target card). */}
                  <button className="sc-add" data-tour={i === tourIdx ? "section-add" : undefined}
                    aria-label="Finish with this chapter and track the next"
                    onClick={(e) => { e.stopPropagation(); moveOnFromCompleted(c, sectionKey, plan); }}>+</button>
                  {hist && (
                    <button className="sc-hist" aria-label="Section history for this section"
                      onClick={(e) => { e.stopPropagation(); setHistoryFor({ c, sectionKey }); }}>{HistoryIcon}</button>
                  )}
                </div>
              ) : (
                <div className="sc-right">
                  <button className="sc-remove" aria-label="Stop tracking this chapter"
                    onClick={(e) => { e.stopPropagation(); setUntrackFor({ c, sectionKey, plan }); }}>−</button>
                  {hist && (
                    <button className="sc-hist" aria-label="Section history for this section"
                      onClick={(e) => { e.stopPropagation(); setHistoryFor({ c, sectionKey }); }}>{HistoryIcon}</button>
                  )}
                </div>
              )}
            </div>
          );
  }
}
