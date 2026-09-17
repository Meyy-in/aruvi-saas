/* ───────── My Classes — the home screen (Track D step 3, 2026-09-12) ─────────
 *
 * The teaching loop's front door: one card per class the teacher handles (subject · grade ·
 * section, from her readiness profile). A class with an attached chapter shows CONTINUE —
 * the chapter title and where she stopped (unit N) — and opens it in LessonView with tracking.
 * Any other prepared chapter opens read-only. Section state is reconciled from the server on
 * load (pullSectionState), and a LOADING state holds until /plans arrives so no false
 * "pick a chapter" flashes on a real network (the live-walk finding, designed in).
 *
 * Plan status, theme and sign-out live at the foot for now; they move to Settings in step 6.
 * The section→lesson binding ("+") and the full My Lessons library are step 4. */
import { useEffect, useState, useCallback, useRef } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet, RefreshControl, AppState } from "react-native";
import { Text } from "../../components/Text";
import { useRouter, useFocusEffect } from "expo-router";
import { getUser, subjectSlug, classNum, pad, getJSON, postJSON, markPrepared } from "@aruvi/shared/format";
import { cutoverOffered, dismissCutover, dismissCutoverResult, fetchYear, runCutover,
         subscribeYear } from "@aruvi/shared/year";
import { markGenerated } from "../../lib/firstRun";
import { CutoverOffer, CutoverDone } from "../../components/YearNudge";
import { cachedPlans, fetchPlans, invalidatePlans } from "@aruvi/shared/plans";
import { cachedReadiness, fetchReadiness, subscribeReadiness } from "@aruvi/shared/readiness";
import { cachedAccount, cachedFirstName, fetchAccount, accountFirstName } from "@aruvi/shared/account";
import { endSession as endSessionShared } from "../../lib/session";
import { pullSectionState, readLocalSection, bindSectionChapter, unbindSection } from "@aruvi/shared/sectionState";
import { useTourAnchor, useTour, startTour, fetchTourEligible, spendTourOffer,
         noteTourInfo } from "../../lib/tour";
import TourOffer from "../../components/TourOffer";
import { recordHistory, hasHistory, pullSectionHistory } from "@aruvi/shared/sectionHistory";
import CardGrid from "../../components/CardGrid";
import { AttachSheet, UntrackSheet, HistorySheet } from "../../components/AttachSheet";
import Svg, { Path } from "react-native-svg";
import { subscribePreparing, clearPreparing } from "../../lib/preparing";
import { raisePortalCheck } from "../../lib/portal";
import { takeFirstRunCheck } from "../../lib/firstRun";
import { SETUP_CHECK_DELAY_MS } from "@aruvi/shared/setupCheck";
import ProposedCard from "../../components/ProposedCard";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";
import { type } from "../../theme/type";

/* The web's pointerFor / unitsDoneFor, over the shared cache rather than window.localStorage.
   The stored pointer is 0-BASED; the rail and "unit N" are 1-based, and an ABSENT pointer means
   untouched — which is why a bound-but-unstarted chapter is still the sand "st-new" card. */
const pointerOf = (sectionKey) => {
  const raw = readLocalSection(sectionKey).unit;
  const n = Number(raw);
  return raw != null && raw !== "" && Number.isFinite(n) && n >= 0 ? n + 1 : null;
};
const unitsDone = (sectionKey) => {
  const n = Number(readLocalSection(sectionKey).unit);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const gradeSlug = (g) => (g || "").toLowerCase();
const classNo = (g) => (g || "").replace(/grade/i, "").trim().toUpperCase();

/* readiness → one entry per subject·grade·section */
function classesFrom(readiness) {
  const out = [];
  ((readiness && readiness.subjects) || []).forEach((s) => {
    const sSlug = subjectSlug(s.name);
    (s.grades || []).forEach((g) => {
      const gSlug = gradeSlug(g.grade);
      (g.sections || []).forEach((sec) => out.push({
        subjectName: s.name, subjectSlug: sSlug, grade: g.grade, gradeSlug: gSlug,
        sectionTag: sec.tag, sectionName: (sec.name || "").trim(),
        sectionKey: `${sSlug}_${gSlug}_${sec.tag}`,
      }));
    });
  });
  return out;
}

/* ★ SUBJECT BANDS — but ONLY for a teacher who teaches more than one (the web's rule, founder
   2026-08-30: "teachers compartmentalize subjects"). A flat list made her read the subject off
   every card to find the three that belong together; a single-subject teacher — the common case —
   renders none of this and sees exactly the list she saw before.
   NOTHING MOVES. `classesFrom` already walks subjects → grades → sections in profile order, so
   same-subject cards are ALREADY adjacent; this only inserts headings into an order that was
   always there. Built by ADJACENCY rather than by a map keyed on the subject, which is what
   guarantees that: a map would silently reorder if the underlying walk ever changed, where
   adjacency can only ever mis-SPLIT, which is visible. Ported verbatim from MyPlans.jsx:865-871
   (appendix 05 B11) — the phone's `sectionKey` stands in for the web's positional `i`, because
   nothing here addresses a card by index. */
function bandsOf(classes) {
  const bands = [];
  classes.forEach((c) => {
    const last = bands[bands.length - 1];
    if (last && last.subject === c.subjectName) last.items.push(c);
    else bands.push({ subject: c.subjectName, slug: c.subjectSlug, items: [c] });
  });
  return bands;
}

export default function Home() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  const user = getUser();
  const [st, setSt] = useState({ loading: true, err: "", classes: [], plansBySG: {} });

  /* ── THE ACADEMIC-YEAR CUTOVER (6a F6) ──────────────────────────────────────────────────
     The offer and its result sit at the TOP of this screen, above the greeting, because from
     the cutover date onwards this is the first thing she is being asked. `@aruvi/shared/year`
     holds every rule about when and what it clears; this screen only draws and dispatches.
     ⚠️ RE-READ ON FOCUS, not only on mount. `navigate` does not remount this screen, and a
     teacher who leaves the app open across midnight on 1 June should be offered it without
     relaunching — the same reason the web listens on `visibilitychange`. */
  const [year, setYear] = useState(null);
  useEffect(() => subscribeYear(setYear), []);
  useFocusEffect(useCallback(() => { fetchYear(); }, []));
  const [tick, setTick] = useState(0);   // re-read local section state after returning from a lesson
  /* ★ AN EMPTY CACHE IS NOT AN ANSWER UNTIL THE SERVER HAS GIVEN ONE (app. 05 row A7; the web's
     `bindingsKnown`). The greeting asks "has she bound anything yet?" and reads the LOCAL
     section cache to decide — which on a new device is empty for a beat whatever the truth is.
     So a teacher signing in on a second phone was greeted "Tap + on a class to prepare its first
     lesson" over classes she has been teaching for a term. False on its face, and it is the
     first sentence the app says to her. It stays quiet until the reconcile lands. */
  const [bindingsKnown, setBindingsKnown] = useState(false);

  /* ★ ENDING THE SESSION IS ONE ACT, AND A 401 IS ONE OF ITS DOORS (2026-09-13).
     The web has held this since its own live check: "a 401 is not 'no profile' — the server
     REFUSED this session" (page.jsx), and it signs out on the spot. The phone only PRINTED
     "your sign-in has expired" and carried on rendering the shell, with getUser() reading the
     stale `aruvi_user` out of local storage — so an ERASED account went on announcing "signed
     in as 9000000003", over its own cached pointers and bookmarks, for ever. Found live after
     a real account deletion. The pieces were all here; nothing called them.
     Note it is only a 401 — an unreachable server is NOT a refusal and must never sign her
     out mid-lesson on a school network (the existing "couldn't reach Meyy" path). */
  const endSession = useCallback(() => endSessionShared(router, "my classes: 401"), [router]);

  /* Index a plan listing by filename — the shape the cards read.
     ★ **UNDEFINED IS A STATE, AND IT USED TO BE FLATTENED HERE** (app. 05 rows B14, B21).
     `cachedPlans` returns null when this device has never asked; `(rows || [])` turned that
     into `{}`, which is indistinguishable from "asked, and she has none". So a bound section on
     a cold cache drew "Pick a chapter to begin" — the sand, no-chapter card — for the beat
     before the listing arrived, and the picker announced "No other lessons prepared for this
     section yet." about a class with a full shelf. **A screen may say it does not know; it may
     never invent an answer about her record** — the Support `metaErr` rule of 2026-08-27,
     reached through a third door. `undefined` now travels all the way to the card. */
  const indexPlans = (rows) => {
    if (!rows) return undefined;
    const byFile = {};
    rows.forEach((p) => { byFile[p.filename] = p; });
    return byFile;
  };
  const keysOf = (classes) => [...new Set(classes.map((c) => `${c.subjectSlug}/${c.gradeSlug}`))];

  /* ★ PAINT FIRST, THEN CHECK (founder, 2026-09-14: "web My Classes is instantaneous but on
     Expo it first shows 'Loading your classes' which takes a second").
     THE SHAPE OF THE BUG WAS THE SEQUENCE, NOT ANY ONE CALL. This screen used to hold the whole
     view behind `loading: true` while it awaited FOUR round trips IN SERIES — entitlement, then
     /readiness, then pullSectionState, then the plan listings — so the wait was the sum of them,
     on a link where the bill is latency. Three of those four had no business being there:
       · ENTITLEMENT feeds one status line at the foot and nothing else can need it, yet it was
         awaited FIRST, in front of the one response the screen cannot draw without.
       · SECTION STATE is a RECONCILE. The cards read their pointers from the local cache during
         render, so the pull corrects what is already on screen — it was never a precondition for
         drawing it. (My Lessons always had this right, which is why it felt faster.)
       · THE PLAN LISTINGS already paint from `cachedPlans` synchronously; awaiting the refresh
         held the screen for a correction it could apply later.
     So the load now does the synchronous part — her profile and her listings, both from the
     device copy — and PAINTS. Everything else lands behind it and updates in place. A returning
     teacher sees her classes with no spinner at all; a first-ever load still shows one, honestly,
     because there is genuinely nothing yet to draw.
     ⚠️ The one thing that must NOT move behind the paint is the 401: that is the server refusing
     the session, and it still ends it. `fetchReadiness` rethrows it for exactly this. */
  const load = useCallback(async ({ force = false } = {}) => {
    // ── synchronous: whatever the device already holds ──
    const cached = cachedReadiness();
    if (cached) {
      const classes = classesFrom(cached);
      const plansBySG = {};
      keysOf(classes).forEach((key) => { plansBySG[key] = indexPlans(cachedPlans(key)); });
      setSt((prev) => ({ ...prev, loading: false, err: "", classes, plansBySG }));
    }

    /* ⚠️ THE STATUS LINE NO LONGER ASKS FOR ITSELF (6a F5, 2026-09-16). It used to fire its own
       `/entitlement` on every mount of this screen — and this screen remounts on every crossing
       — while the shell above it is already polling the same endpoint every 20 seconds. One
       copy, one cadence: the subscription below reads it. */

    // ── behind the paint: the profile, then what depends on it ──
    let readiness = null;
    try {
      readiness = await fetchReadiness({ force });
    } catch (e) {
      if (String(e.message) === "401") { await endSession(); return; }
      // Nothing stored and the server is unreachable — say so, but only if we painted nothing.
      setSt((prev) => (prev.loading
        ? { ...prev, loading: false, err: "Couldn't reach Meyy right now." }
        : prev));
      return;
    }
    const classes = classesFrom(readiness);
    const plansBySG = {};
    keysOf(classes).forEach((key) => { plansBySG[key] = indexPlans(cachedPlans(key)); });
    setSt((prev) => ({ ...prev, loading: false, err: "", classes, plansBySG }));

    /* The listing comes from the SHARED STORE (@aruvi/shared/plans), which the web uses too —
       one copy per subject·class kept in module memory and on the device, one request in
       flight, and one revalidation per session unless something invalidated it. Pull-to-refresh
       passes force, which is the teacher's own "check again". */
    keysOf(classes).forEach((key) => {
      fetchPlans(key, { force })
        .then((rows) => setSt((prev) => ({
          ...prev, plansBySG: { ...prev.plansBySG, [key]: indexPlans(rows) },
        })))
        .catch(() => {});
    });

    // The reconcile: corrects the pointers the cards already drew from the local cache.
    if (classes.length) {
      pullSectionState(classes.map((c) => c.sectionKey))
        .then(() => { setBindingsKnown(true); setTick((n) => n + 1); })
        .catch(() => {});
      /* ★ AND THE TEACHING LEDGER ALONGSIDE, ON ITS OWN TICK (app. 05 row A6). `hasHistory` is
         read during render to decide whether a card offers its history glyph, and it reads a
         cache that NOTHING on this surface had ever filled from the server — so on a second
         device the glyph would have been absent for every chapter she has taught. Its own
         `.catch`, deliberately: the ledger failing must not cost her the pointers, which are
         what the cards are actually drawn from. */
      pullSectionHistory(classes.map((c) => c.sectionKey))
        .then(() => setTick((n) => n + 1))
        .catch(() => {});
    } else {
      // Nothing to reconcile — the question is answered, and the answer is "none".
      setBindingsKnown(true);
    }
  }, [endSession]);

  useEffect(() => { load(); }, [load]);

  /* ★ THE TWIN OF MY LESSONS’ SUBSCRIPTION (founder, 2026-09-17), and for the same reason:
     `load` runs on mount, the bar navigates rather than remounting, so the cards on screen are
     the cards her profile had when this screen first drew. A subject bought in the subscribe
     wizard is exactly the case — the server turns every purchased scope into a ready-made card,
     and she should find it here without restarting the app.
     ⚠️ The immediate fire is the copy `load()` is already drawing from — skipped, or every mount
     would run the load twice. And `load()` rather than a setState: a card carries its plan
     listing and its section pointer, and assembling those IS this function. */
  useEffect(() => {
    let first = true;
    return subscribeReadiness(() => { if (first) { first = false; return; } load(); });
  }, [load]);
  useFocusEffect(useCallback(() => { setTick((n) => n + 1); }, []));

  /* ★ THE CHECK WINDOW AFTER FIRST RUN (founder, 2026-09-16, having walked it: "the window that
     pops up after first run did not pop up … since the tour is not built in expo it should have
     come immediately when My Classes is chosen after first run").
     On the web this is raised by the tour's own ending. The phone has no tour until 8b, so nothing
     raised it and a brand-new teacher was never shown what Meyy had ASSUMED for her — a section,
     a periods a week, a year's total — which is the whole reason the window exists.
     First run leaves the one-shot; this spends it. On FOCUS rather than on mount, because she
     lands on My Lessons and arrives here by tapping the bar, which does not remount this screen.
     ⚠️ The same one-second beat the added-a-subject window waits: she has just arrived to see her
     first card, and a window in the same frame covers the thing she came for.
     ★ At 8b this one STAYS and the TOUR'S trigger is the one that goes (founder, 2026-09-17):
     the tour's ending can only fire for a teacher who ran the tour, and Meyy assumed just as
     much for the one who skipped it. `finishTour` must not raise the check window — full
     reasoning in `lib/firstRun.js`. */
  useFocusEffect(useCallback(() => {
    if (!takeFirstRunCheck()) return undefined;
    const id = setTimeout(() => raisePortalCheck({ mode: "check", reason: "tour" }),
                          SETUP_CHECK_DELAY_MS);
    return () => clearTimeout(id);
  }, []));


  const openAttached = (c, plan) => router.push({ pathname: "/lesson",
    params: { subject: c.subjectSlug, grade: c.gradeSlug, filename: plan.filename, section: c.sectionTag } });

  /* ── the "+" / "−" binding (Track D step 4) — the web's MyPlans handlers, verbatim in effect.
     Every write goes through @aruvi/shared, so the phone and the web agree on disk and on the
     server; this screen only decides WHEN. `bump` forces the re-render that shows the new state
     at once: the card reads its binding from the local cache during render, so without it the
     card would only refresh on the next incidental render — the web's own "+ works late" lag. */
  const [attachFor, setAttachFor] = useState(null);    // { c, sectionKey }
  const [untrackFor, setUntrackFor] = useState(null);  // { c, sectionKey, plan }
  const [historyFor, setHistoryFor] = useState(null);  // { c, sectionKey } — the teaching ledger
  const [openPrior, setOpenPrior] = useState(null);    // which prior year's folder is expanded
  const [priorPlans, setPriorPlans] = useState({});    // { _for, [yearId]: plans[] | undefined }

  /* ★ LAST YEAR'S LESSONS, FETCHED ONLY WHEN SHE OPENS THE FOLDER (app. 05 row B16). Lazy by
     design: most visits to the picker never touch it, and a prior year is an extra round trip
     for a list she may not want.
     ⚠️ FILTERED TO WHAT SHE ACTUALLY PREPARED THAT YEAR — the library is SHARED, so an
     unfiltered `/plans` read would offer her every sample plan Meyy owns as though it were her
     own work. `prepared && !archived` is the ownership test on this endpoint.
     ⚠️ AND EXCLUDING WHAT THIS YEAR'S LIST ALREADY OFFERS, including the bound chapter: a plan
     she has already brought forward is current work, and listing it in both halves of one small
     window is noise. The folder answers "what ELSE do I have from last year?".
     ★ The cache key carries HOW MANY of this class's plans are prepared this year, so bringing
     one back INVALIDATES the folder's own list — otherwise the chapter she just attached is
     still sitting in the folder when she reopens it (the web's own note). */
  useEffect(() => {
    if (!openPrior || !attachFor) return undefined;
    const { c } = attachFor;
    const key = `${c.subjectSlug}/${c.gradeSlug}`;
    const here = Object.values(st.plansBySG[key] || {}).filter((p) => p.prepared);
    const cacheKey = `${openPrior}|${key}|${here.length}`;
    if (priorPlans._for === cacheKey) return undefined;
    let live = true;
    setPriorPlans({ _for: cacheKey });
    getJSON(`/plans/${c.subjectSlug}/${c.gradeSlug}?year_id=${encodeURIComponent(openPrior)}`)
      .then((d) => {
        if (!live) return;
        const bound = readLocalSection(attachFor.sectionKey).chapter;
        const hereFiles = new Set(here.map((p) => p.filename));
        const mine = ((d && d.plans) || []).filter((p) => p.prepared && !p.archived
          && p.filename !== bound && !hereFiles.has(p.filename));
        setPriorPlans({ _for: cacheKey, [openPrior]: mine });
      })
      .catch(() => { if (live) setPriorPlans({ _for: cacheKey, [openPrior]: [] }); });
    return () => { live = false; };
  }, [openPrior, attachFor, st.plansBySG, priorPlans._for]);
  const bump = () => setTick((n) => n + 1);

  /* ★ THE SECOND DEVICE, AND THE HOLD THAT MAKES IT SAFE (app. 05 rows A4, A5).
     She teaches from a phone and plans on a laptop; the pointers move on whichever she used
     last. My Lessons already re-pulls on its own cadence — this screen only read the server
     once per mount, so a chapter completed on the laptop stayed stale here until she navigated
     away and back. The web re-pulls on an interval plus `visibilitychange`; the phone's
     equivalent of the second is AppState going `active`, which is the moment that actually
     matters on a handset (it is the one the teacher notices).
     ⚠️ **THE HOLD IS NOT A NICETY — A PULL MID-ATTACH CAN UNDO HER (`uiBusyRef`).** A reconcile
     writes the server's answer over the local cache; fire it while the attach picker is open,
     or in the gap between her tap and the write landing, and the card reverts under her hand.
     So the tick is SKIPPED, never queued, whenever a sheet is up — she is about to change the
     very thing being reconciled, and the next tick is twenty seconds away. */
  const uiBusyRef = useRef(false);
  uiBusyRef.current = !!(attachFor || untrackFor || historyFor);
  useEffect(() => {
    const sync = () => {
      if (uiBusyRef.current) return;
      const keys = st.classes.map((c) => c.sectionKey);
      if (!keys.length) return;
      pullSectionState(keys).then(() => setTick((n) => n + 1)).catch(() => {});
      pullSectionHistory(keys).then(() => setTick((n) => n + 1)).catch(() => {});
    };
    const id = setInterval(sync, 20000);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") sync(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [st.classes]);

  /* ★ THE LESSON BEING PREPARED FOR ONE OF THESE SECTIONS (founder, 2026-09-15). The wait
     happens where the lesson will appear — that is the 2026-08-06 rule — and for a prepare
     launched from a section card's "+", that is THIS SCREEN, on THAT CARD. The descriptor
     carries the section, so at most one card is ever waiting.
     ⚠️ A descriptor with NO section belongs to My Lessons and is ignored here, or the same wait
     would be drawn twice in two places. */
  const [prep, setPrep] = useState({ descriptor: null, paywall: "" });
  useEffect(() => subscribePreparing(setPrep), []);
  const preparing = prep.descriptor && prep.descriptor.section ? prep.descriptor : null;
  /* The plan landed and `prepare.jsx` bound it before clearing, so the listing has moved on:
     re-read it and re-render, which is what turns the waiting card into the attached one. */
  /* The descriptor is GONE by the time we notice it went, so the key it named is kept here.
     The edge is "was preparing, and is no longer" — the same shape My Lessons uses. */
  const lastPrep = useRef(null);
  if (preparing) lastPrep.current = `${preparing.subject}/${preparing.grade}`;
  const wasPreparing = useRef(false);
  useEffect(() => {
    const now = !!preparing;
    if (wasPreparing.current && !now) {
      const key = lastPrep.current;
      bump();                                  // the binding is written; redraw the card from it
      if (key) {
        invalidatePlans(key);
        fetchPlans(key)
          .then((rows) => setSt((prev) => ({
            ...prev, plansBySG: { ...prev.plansBySG, [key]: indexPlans(rows) },
          })))
          .catch(() => {});
      }
    }
    wasPreparing.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparing]);

  /* ★ BRINGING A CHAPTER FORWARD (app. 05 row A17). Attaching from last year's folder is not
     the same act as attaching from this year's list: the plan has to become HERS in the CURRENT
     year, which is what `markPrepared(..., sourceYear)` records — and the source year rides
     along so the card can carry its "2025-26 version" stamp.
     ⚠️ MERGE, NEVER INVALIDATE-THEN-HOPE (the web's bug of 2026-08-26). The cached row is
     upgraded in place so the card is correct the instant she taps, and the authoritative list is
     refetched behind it; dropping the cache instead left every card for that class reading "Pick
     a chapter to begin" until a remount, which looked like every attachment had been wiped.
     ⚠️ The `markPrepared` failure is swallowed on purpose — the BIND still stands, and the next
     `/plans` read reconciles. Losing the stamp is a smaller harm than losing the attach. */
  const attachPriorChapter = async (c, sectionKey, plan, sourceYear) => {
    const key = `${c.subjectSlug}/${c.gradeSlug}`;
    try {
      await markPrepared(c.subjectSlug, c.gradeSlug, plan.filename, plan.prepared_periods, sourceYear);
    } catch { /* the bind still stands; the next /plans read reconciles */ }
    setSt((prev) => {
      const cur = prev.plansBySG[key];
      if (!cur) return prev;                       // nothing cached yet; the fetch below fills it
      const stamped = { ...plan, prepared: true, archived: false,
                        prepared_source_year: sourceYear || null };
      return { ...prev, plansBySG: { ...prev.plansBySG,
        [key]: { ...cur, [plan.filename]: { ...(cur[plan.filename] || {}), ...stamped } } } };
    });
    setOpenPrior(null);
    attachChapter(c, sectionKey, plan);
  };

  const attachChapter = (c, sectionKey, plan) => {
    bindSectionChapter(sectionKey, plan.filename);
    setAttachFor(null);
    bump();
    /* ★ THE ATTACH CHANGED THE LISTING, NOT JUST THE BINDING (2026-09-14) — the web has done
       this since MyPlans.jsx:548 and the phone had not caught up. It became visible with the
       speed work's part 3: `total_units` is now computed only for chapters she ACTUALLY HOLDS
       (api/main.py derives it from her bound files), so attaching is itself a payload change.
       Without the invalidation the store answers the next read from its `fresh` copy, where this
       chapter still has total_units = null — and the card renders with NO UNIT RAIL until the app
       is restarted and the once-per-session revalidation finally sees a different ETag.
       Invalidate, then re-read: the binding is already written locally, so the card is correct on
       screen throughout and the fetch only fills the rail in. A failed fetch changes nothing —
       the optimistic card stands, exactly as the web's does. */
    const key = `${c.subjectSlug}/${c.gradeSlug}`;
    invalidatePlans(key);
    fetchPlans(key)
      .then((rows) => setSt((prev) => (
        { ...prev, plansBySG: { ...prev.plansBySG, [key]: indexPlans(rows) } }
      )))
      .catch(() => {});
  };
  /* Untracking logs a history row ONLY when at least one unit was done — the anti-noise gate, so
     a casual attach-then-untrack leaves no trace — and stamps how far the section got. */
  const untrackChapter = (sectionKey, plan) => {
    const done = unitsDone(sectionKey);
    if (plan && done >= 1) {
      recordHistory(sectionKey, {
        file: plan.filename, chapter_number: plan.chapter_number, chapter_title: plan.chapter_title,
        status: "untracked", units_done: done, total_units: plan.total_units || null, ts: Date.now(),
      });
    }
    unbindSection(sectionKey); setUntrackFor(null); bump();
  };
  /* A finished chapter has no progress to lose, so moving on needs no confirm: it frees the
     section and opens the picker for the next chapter. It always earns its history row. */
  const moveOnFromCompleted = (c, sectionKey, plan) => {
    if (plan) {
      recordHistory(sectionKey, {
        file: plan.filename, chapter_number: plan.chapter_number, chapter_title: plan.chapter_title,
        status: "completed", units_done: plan.total_units || null,
        total_units: plan.total_units || null, ts: Date.now(),
      });
    }
    unbindSection(sectionKey); setAttachFor({ c, sectionKey }); bump();
  };

  /* Every chapter bound to ANY section of this subject·class. A chapter she already teaches to
     9A is the ordinary thing to offer 9B, so the picker lets those through even though the
     plans listing marks only HER prepared ones. */
  const boundFilesForGrade = (sSlug, gSlug) => {
    const set = new Set();
    st.classes.forEach((c) => {
      if (c.subjectSlug !== sSlug || c.gradeSlug !== gSlug) return;
      const f = readLocalSection(c.sectionKey).chapter;
      if (f) set.add(f);
    });
    return set;
  };

  const bands = bandsOf(st.classes);
  /* ONE card, rendered the same whether or not it sits inside a subject band. The only thing
     the band changes is the KICKER: with the subject named above the group, repeating it on
     every card is the same word three times on one screen (the web's own note, MyPlans.jsx). */
  /* ★ THE TOUR'S CARD IS THE FIRST ONE, and only the steps that ring it get the anchor (the web
     does the same with `i === tourIdx`). Steps 8 and 14 ring its "+", step 10 rings the card. */
  const tourNow = useTour();
  /* ★ THE OFFER (app. 01 rows 59-61). Eligible = at most one bound section and nothing taught —
     she has a lesson and has not started using it, which is exactly the moment a walkthrough is
     worth her time. ⚠️ `null` from the check means we could not tell, and an unknown must never
     look like a new teacher, so only an explicit `true` offers. */
  const [tourFit, setTourFit] = useState(null);
  useEffect(() => {
    let live = true;
    fetchTourEligible(getJSON).then((v) => { if (live) setTourFit(v); });
    return () => { live = false; };
  }, []);
  const acct = cachedAccount();
  const tourOnOffer = tourFit === true && !tourNow.step && !(acct && acct.tour_offered_at);
  useEffect(() => { if (tourOnOffer) spendTourOffer((p) => postJSON(p, {})); }, [tourOnOffer]);
  const card = (c, banded, idx) => (
    <ClassCard key={c.sectionKey} c={c} banded={banded}
      tourAdd={idx === 0 && (tourNow.step === 8 || tourNow.step === 14)}
      tourTarget={idx === 0 && tourNow.step === 10}
      plans={st.plansBySG[`${c.subjectSlug}/${c.gradeSlug}`]}
      preparing={preparing && preparing.section === c.sectionKey ? preparing : null}
      onDismissPreparing={clearPreparing}
      onOpen={openAttached}
      onAttach={() => setAttachFor({ c, sectionKey: c.sectionKey })}
      onUntrack={(plan) => setUntrackFor({ c, sectionKey: c.sectionKey, plan })}
      onMoveOn={(plan) => moveOnFromCompleted(c, c.sectionKey, plan)}
      onHistory={() => setHistoryFor({ c, sectionKey: c.sectionKey })} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      {/* ★ THE CUTOVER COMES BEFORE THE GREETING. From the cutover date onwards it is the first
          thing this screen has to say, and a greeting above it would read as the app changing
          the subject. `markGenerated()` on the way out: she has just emptied her current year ON
          PURPOSE, so the activation gate must never mistake her for a teacher who has never
          generated and send her to first run. */}
      {year && cutoverOffered() ? (
        <CutoverOffer info={year.info} busy={year.busy}
          onStart={() => runCutover({ onDone: markGenerated })}
          onDismiss={dismissCutover} />
      ) : null}
      {year && year.result ? (
        <CutoverDone result={year.result} onDismiss={dismissCutoverResult} />
      ) : null}
      {/* ★ THE GREETING (the web's .dash-hd). It is sticky on the web — pinned under the bar at
          the top of the one scroll region — so here it sits ABOVE the scroller, which is the
          same thing without a sticky. The "My classes" mono label that used to open this screen
          is GONE: the web has no such label, and two headers is worse than either. */}
      {!st.loading && !st.err
        ? <DashHead classes={st.classes} plansBySG={st.plansBySG} user={user}
                    bindingsKnown={bindingsKnown} />
        : null}
      {/* ★ BELOW THE GREETING, ABOVE THE CARDS — she reads who she is, then what is offered. */}
      {tourOnOffer ? (
        <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
          <TourOffer onStart={() => {
            /* The copy of steps 7-13 names the section and the chapter she is about to use. */
            const first = st.classes[0];
            if (first) {
              const sec = readLocalSection(first.sectionKey);
              const listing = st.plansBySG[`${first.subjectSlug}/${first.gradeSlug}`];
              const plan = sec.chapter && listing ? listing[sec.chapter] : null;
              noteTourInfo({ tag: first.sectionTag,
                             chapter: plan ? plan.chapter_title : "your lesson" });
            }
            startTour();
          }} />
        </View>
      ) : null}
      {/* The header sits outside the scroller, so it takes main's 26px top padding with it and
          the scroller must not repeat it — otherwise the card list starts 26px too low. */}
      <ScrollView contentContainerStyle={[ws.main, (!st.loading && !st.err) && { paddingTop: 0 }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load({ force: true })} tintColor={t.pine} />}>

        {st.loading ? (
          <View style={s.loading}><ActivityIndicator color={t.pine} /><Text style={[type.small, { color: t.ink_soft, marginLeft: 10 }]}>Loading your classes…</Text></View>
        ) : st.err ? (
          <Text style={[type.body, { color: t.danger, marginTop: 18 }]}>{st.err}</Text>
        ) : st.classes.length === 0 ? (
          <Text style={[type.body, { color: t.ink_soft, marginTop: 14 }]}>No classes yet — set up your teaching profile (first run comes in a later step).</Text>
        ) : (
          /* Banded (>1 subject) or the plain list she has always had. The CARD itself is one
             renderer either way — `card` — so the two paths can never drift apart. */
          bands.length > 1 ? (
            <View style={ws.sc_bands} key={tick}>
              {bands.map((b, bi) => (
                <View key={b.slug} style={bi ? ws.sc_band_gap : null}>
                  {/* The subject, said ONCE per band. */}
                  <Text style={ws.sc_band_hd}>{b.subject}</Text>
                  <View style={ws.sc_band_list}>{b.items.map((c, i) => card(c, true, i))}</View>
                </View>
              ))}
            </View>
          ) : (
            <View style={ws.sc_list} key={tick}>{st.classes.map((c, i) => card(c, false, i))}</View>
          )
        )}

        {/* ★ THE FOOT CARD IS GONE (6b·B, 2026-09-16), and both halves went where they were
            always going. Identity and Log out had already moved to the bar in 2026-09-13; the
            APPEARANCE choice is now the Appearance card in Settings — founder's Q10 answer took
            the web's cycling glyph, so the interim Auto/Light/Dark segments were DELETED here
            rather than moved, segments and all. The trial counter goes with them: the web has
            never shown it on My Classes, and its home is Subscription & billing. What is left
            is a screen that is only her classes, which is what this screen is for. */}
      </ScrollView>

      <AttachSheet target={attachFor}
        onPrepareNew={(tg) => {
          /* Leave the picker for the Prepare screen, carrying the SECTION so the journey can come
             back to the slot she opened it for. `push`, not `navigate`: this is a step in a
             journey she will return from, not one of the four places. */
          setAttachFor(null);
          router.push({ pathname: "/prepare", params: {
            subject: tg.c.subjectSlug, grade: tg.c.gradeSlug,
            section: tg.sectionKey, tag: tg.c.sectionTag } });
        }}
        plans={attachFor ? st.plansBySG[`${attachFor.c.subjectSlug}/${attachFor.c.gradeSlug}`] : null}
        boundFile={attachFor ? readLocalSection(attachFor.sectionKey).chapter : null}
        alsoAttachable={attachFor ? boundFilesForGrade(attachFor.c.subjectSlug, attachFor.c.gradeSlug) : null}
        onAttach={attachChapter} onClose={() => { setAttachFor(null); setOpenPrior(null); }}
        priorYears={((year && year.info && year.info.prior_years) || []).slice().sort().reverse()}
        openPrior={openPrior} onOpenPrior={setOpenPrior}
        priorPlans={priorPlans} onAttachPrior={attachPriorChapter} />
      <UntrackSheet target={untrackFor} onUntrack={untrackChapter} onClose={() => setUntrackFor(null)} />
      <HistorySheet target={historyFor} onClose={() => setHistoryFor(null)}
        plans={historyFor ? st.plansBySG[`${historyFor.c.subjectSlug}/${historyFor.c.gradeSlug}`] : null} />
    </View>
  );
}

/* ───────── The greeting (the web's .dash-hd) ─────────
 * Time of day, and her name only when there IS one: the id is a mobile number for every teacher
 * who has not subscribed, and "Good evening, 9000000003!" is nobody's name (founder, 2026-08-25).
 * A named dev id keeps the personal touch.
 * The sub-line is the web's rule too: "Continue where you left off" appears only once at least
 * one section is actually bound. Before that the WELCOME copy speaks instead — telling a teacher
 * to tap "+" the second her classes appear is an instruction she has no context for yet. */
function DashHead({ classes, plansBySG, user, bindingsKnown }) {
  const ws = useWebStyles();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  /* ★ FROM HER ACCOUNT, NOT FROM HER ID (founder, 2026-09-15 — the same report that put her name
     back on the bar). This used to test the signed-in id for digits, which meant the greeting
     could only ever be personal for a named DEV id: a teacher who subscribed and gave her name
     still got a bare "Good evening!" because her id is a mobile number and always will be. The
     name now comes from `/account` through the shared store, and `accountFirstName` keeps the
     same rule the bar uses — a numeric display_name is the server's default, not a name.
     Read synchronously so the greeting does not change under her a beat after it appears. */
  const [fromAccount, setFromAccount] = useState(() => cachedFirstName());
  useEffect(() => {
    let live = true;
    fetchAccount().then((a) => { if (live) setFromAccount(accountFirstName(a)); }).catch(() => {});
    return () => { live = false; };
  }, [user]);
  const rawId = (user || "").trim();
  const firstName = fromAccount || (/^\d+$/.test(rawId) ? "" : rawId);
  const anyBound = classes.some((c) => !!readLocalSection(c.sectionKey).chapter);
  const anyPlans = Object.values(plansBySG || {}).some((m) => Object.values(m || {}).some((p) => p.prepared));

  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 26 }}>
      <View style={ws.dash_hd}>
        <Text style={ws.dash_title}>{greeting}{firstName ? `, ${firstName}` : ""}!</Text>
        {classes.length > 0 && anyBound ? (
          <Text style={ws.dash_sub}>Continue where you left off with every class.</Text>
        ) : null}
      </View>
      {/* ⚠️ `bindingsKnown` gates ONLY the not-yet-bound copy. The "continue where you left off"
          line above needs no gate — it appears when something IS bound, and a false negative
          there costs a sentence, where a false positive here tells a working teacher she has
          not started. Silence is the safe direction. */}
      {classes.length > 0 && !anyBound && bindingsKnown ? (
        <View style={{ paddingBottom: 10 }}>
          <Text style={ws.dash_welcome_title}>Your classes are ready</Text>
          <Text style={ws.dash_welcome_sub}>
            {anyPlans
              ? "Your lesson is waiting in My Lessons — tap + on a class to start teaching it."
              : "Tap + on a class to prepare its first lesson."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}


/* ───────── ONE section card, in the web's three states (Track D step 4) ─────────
 * st-new (sand) · st-going (green) · st-done (clay) — the FILL carries the teaching status and
 * the 4px left spine repeats it (founder, 2026-08-30). A chapter bound but never opened is
 * still st-new: the status is about TEACHING, not about binding.
 * The right slot is one position holding opposite acts, exactly as the web: "+" to track (pine)
 * on an empty or finished card, "−" to untrack (clay) while she is teaching. Measures in
 * theme/web.js under sc_*; the web's 11px graph rule is the one thing not ported (RN has no
 * repeating gradient) — the card keeps its fill, which is what carries the status anyway. */
function ClassCard({ c, banded, plans, preparing, onDismissPreparing, onOpen, onAttach, onUntrack,
                     onMoveOn, onHistory, tourAdd, tourTarget }) {
  /* ⚠️ ONLY THE TOUR'S OWN CARD carries these, and only on the step that rings them — the web
     stamps its `data-tour` conditionally for the same reason. Put them on every card and
     `measureAnchor` returns whichever mounted first, which is rarely the one she is looking at. */
  const addRef = useTourAnchor(tourAdd ? "section-add" : null);
  const targetRef = useTourAnchor(tourTarget ? "section-card-target" : null);
  const { t } = useTheme();
  const ws = useWebStyles();
  const sec = readLocalSection(c.sectionKey);
  /* `plans` is UNDEFINED until this device has a listing for this subject·class — a different
     fact from "she has no lessons" (see `indexPlans`). A bound section whose listing has not
     landed is LOADING, never empty. */
  const listingKnown = !!plans;
  const plan = sec.chapter && plans ? plans[sec.chapter] : null;
  const hist = hasHistory(c.sectionKey);
  /* ★ THE CORNER OF THE CARD, THE WEB'S RULE (founder, 2026-08-30 — reported against the phone
     on 2026-09-16). Un-named it is the tag she has always seen, "6A". NAMED, THE LETTER GIVES
     WAY TO HER WORD: the class number stands alone with her name in fine print beneath it. A
     teacher who calls that room "Rose" scans this list for "Rose", and "6A · Rose" — which is
     what the phone was drawing — makes her read two labels to find one card. The letter is not
     lost: it is the key everything is filed under, and the teaching profile still shows it.
     DISPLAY ONLY — `c.sectionTag` remains the key behind every binding, pointer and bookmark. */
  const name = c.sectionName;
  const tag = name ? String(classNum(c.grade)) : c.sectionTag;

  /* ★ THE HISTORY GLYPH (app. 05 row B20). `hasHistory` has been computed on this screen since
     the cards were built and thrown away every time — the one line of this feature that was
     already here. It appears on EVERY card state, because the question it answers ("what has
     this class already been taught?") does not depend on what is in the slot today; a section
     with a term behind it and nothing bound right now is exactly the case where the card itself
     says least. Drawn as a stroke glyph rather than the `Round` +/− pair: those two are ACTIONS
     on the chapter in the slot, and this opens a record. */
  const HistoryGlyph = ({ onPress }) => (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel="Section history for this section" hitSlop={6}
      style={[ws.sc_hist, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
      <Svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke={t.ink_soft}
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M3 3v5h5" />
        <Path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
        <Path d="M12 7v5l3 2" />
      </Svg>
    </Pressable>
  );

  const Round = ({ glyph, color, label, onPress }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={[ws.sc_round, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
      <Text style={[ws.sc_round_glyph, { color }]}>{glyph}</Text>
    </Pressable>
  );
  const Tag = ({ muted }) => (
    <View style={{ minWidth: 40 }}>
      <Text style={[ws.sc_tag, muted && ws.sc_tag_muted]}>{tag}</Text>
      {name ? <Text style={ws.sc_tag_name} numberOfLines={1}>{name}</Text> : null}
    </View>
  );

  /* No chapter bound — "Pick a chapter to begin". The card is NOT tappable-to-generate; the
     "+" opens the picker (founder, 2026-07-09: a freshly generated lesson lands in My Lessons
     and is never auto-named onto a section card). */
  /* ★ THE LESSON THIS CARD IS WAITING FOR (founder, 2026-09-15). Prepared from this card's own
     "+", so the wait belongs HERE — the 2026-08-06 rule is that the bar sits where the finished
     thing will appear, and the finished thing appears on this card.
     It is the SAME card, not a different kind of thing: same tag, same fill, same height. What
     changes is the title line (the chapter she asked for, known and final — nothing is fetched to
     draw it) and the last line, a progress bar where "Pick a chapter to begin" was. The dashed
     edge is the one "not yet" signal, and it is STRUCTURE, never colour — `ProposedCard`'s rule,
     stated once on each screen.
     ⚠️ The "+" is GONE while it waits: opening the picker mid-prepare offers her a second
     chapter for a slot that is about to be filled. */
  if (preparing) {
    return (
      <View style={[ws.sc_card, ws.sc_proposed,
        { backgroundColor: t.card_new, borderColor: t.card_new_edge }]}
        accessibilityLiveRegion="polite">
        <CardGrid color={t.card_grid} />
        <View style={[ws.sc_spine, { backgroundColor: t.clay }]} />
        <Tag />
        <View style={ws.sc_body}>
          {banded ? null : <Text style={ws.sc_kicker}>{c.subjectName}</Text>}
          <Text style={ws.sc_title} numberOfLines={1}>
            {preparing.chapterNo ? `Ch ${pad(preparing.chapterNo)}: ` : ""}{preparing.chapterTitle}
          </Text>
          {/* ★ THE SAME PROGRESS LINE MY LESSONS DRAWS, not a second one. `ProposedCard`'s
              `bare` mode exists for exactly this — mark something busy in place — so the two
              screens cannot drift in wording, timing, easing or the failed row. */}
          <ProposedCard preparing={preparing} onDismiss={onDismissPreparing} bare />
        </View>
      </View>
    );
  }

  /* ★ BOUND, BUT THE LISTING HAS NOT LANDED (app. 05 row B21). She HAS a chapter here — the
     pointer says so — and the only thing missing is its title. Drawing the sand no-chapter card
     would tell her the opposite of the truth about her own class, and it flickers back a beat
     later, which is how a teacher learns not to trust what this screen says. The web guards the
     same case with `bindingsKnown`. Deliberately NOT the green teaching card either: the fill
     carries the status and this card does not yet know its own; it keeps the neutral plane and
     says plainly what it is doing. */
  if (!plan && sec.chapter && !listingKnown) {
    return (
      <View style={[ws.sc_card, { backgroundColor: t.card_new, borderColor: t.card_new_edge }]}>
        <CardGrid color={t.card_grid} />
        <View style={[ws.sc_spine, { backgroundColor: t.edge }]} />
        <Tag />
        <View style={ws.sc_body}>
          {banded ? null : <Text style={ws.sc_kicker}>{c.subjectName}</Text>}
          <Text style={[ws.sc_title, ws.sc_title_muted]}>Loading your lesson…</Text>
        </View>
        <View style={ws.sc_right} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={[ws.sc_card, { backgroundColor: t.card_new, borderColor: t.card_new_edge }]}>
        <CardGrid color={t.card_grid} />
        <View style={[ws.sc_spine, { backgroundColor: t.edge }]} />
        <Tag muted />
        <View style={ws.sc_body}>
          {/* No kicker at all inside a band: the subject is the heading above, and this card
              has no chapter to name, so an empty line is all that would be left. */}
          {banded ? null : <Text style={ws.sc_kicker}>{c.subjectName}</Text>}
          <Text style={[ws.sc_title, ws.sc_title_muted]}>Pick a chapter to begin</Text>
        </View>
        <View style={ws.sc_right}>
          <View ref={addRef} collapsable={false}>
            <Round glyph="+" color={t.pine_d} label="Attach a lesson to this section" onPress={onAttach} />
          </View>
          {hist ? <HistoryGlyph onPress={onHistory} /> : null}
        </View>
      </View>
    );
  }

  /* ★ ATTACHING A CHAPTER MEANS SHE IS TEACHING IT, FROM UNIT 1 (founder, 2026-09-14).
     So a bound card is green unless it is finished, and the sand card belongs to the
     no-chapter case alone. The web reached the same place by accident — Number(null) is 0, so
     its pointer read an untouched section as unit 1 — and now says so on purpose in MyPlans;
     this is the same rule stated once on each surface. */
  const lu = pointerOf(c.sectionKey) || 1;
  const done = sec.done;
  const total = plan.total_units || null;
  const fill = done ? t.card_done : t.card_going;
  const edge = done ? t.card_done_edge : t.card_going_edge;
  const spine = done ? t.clay : t.pine;

  /* ⚠️ The tappable area is the tag + body, NOT the whole card — the right slot's "+"/"−" sit
     OUTSIDE it. The web can nest a <button> inside a clickable <div> and call stopPropagation;
     react-native-web renders an accessibilityRole="button" Pressable as a real <button>, and a
     button inside a button is invalid (it warns, and the inner one's press is unreliable). So
     the row is split instead: same flex row, same 13px gap, identical on screen, and the
     actions simply are not inside the card's own press target — which is what stopPropagation
     was simulating anyway. */
  return (
    <View ref={targetRef} collapsable={false}
      style={[ws.sc_card, { backgroundColor: fill, borderColor: edge }]}>
      <CardGrid color={t.card_grid} />
      <View style={[ws.sc_spine, { backgroundColor: spine }]} />
      <Pressable onPress={() => onOpen(c, plan)} accessibilityRole="button"
        accessibilityLabel={`Open ${plan.chapter_title} for ${c.sectionTag}`}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", columnGap: 13 }}>
      <Tag />
      <View style={ws.sc_body}>
        {/* Banded: the subject is overhead, so the kicker is just the chapter — and nothing
            at all when the plan carries no chapter number. */}
        {banded
          ? (plan.chapter_number ? <Text style={ws.sc_kicker}>{`Ch ${plan.chapter_number}`}</Text> : null)
          : (
            <Text style={ws.sc_kicker}>
              {c.subjectName}{plan.chapter_number ? ` · Ch ${plan.chapter_number}` : ""}
            </Text>
          )}
        <Text style={ws.sc_title} numberOfLines={2}>{plan.chapter_title}</Text>
        {/* ★ A PLAN SHE BROUGHT FORWARD KEEPS SAYING SO (app. 05 row B23). The server returns
            `lp_year_display` ONLY when the edition differs from the year she is teaching in, so
            the comparison is made once, server-side, and this screen cannot disagree with the
            rule. `prepared_source_year` is the other half — the year she prepared it in, stamped
            by `markPrepared` when she pulls a chapter out of last year's folder. */}
        {(plan.lp_year_display || plan.prepared_source_year) ? (
          <Text style={[ws.sc_yearstamp, { color: t.ochre }]}>
            {plan.lp_year_display || plan.prepared_source_year} version
          </Text>
        ) : null}
        {total ? (
          <View style={ws.sc_rail} accessibilityLabel={
            done ? `${total} units, completed` : lu ? `Unit ${lu} of ${total}` : `${total} units, not started`}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[ws.sc_tick, {
                backgroundColor: done || (lu && i < lu - 1) ? t.pine
                  : lu && i === lu - 1 ? t.ochre : t.card_tick,
              }]} />
            ))}
          </View>
        ) : null}
      </View>
      </Pressable>
      {done ? (
        <View style={ws.sc_actions_col}>
          <Text style={ws.sc_status_done}>Complete</Text>
          <Round glyph="+" color={t.pine_d} label="Finish with this chapter and track the next"
            onPress={() => onMoveOn(plan)} />
          {hist ? <HistoryGlyph onPress={onHistory} /> : null}
        </View>
      ) : (
        <View style={ws.sc_right}>
          <Round glyph="−" color={t.clay} label="Stop tracking this chapter"
            onPress={() => onUntrack(plan)} />
          {hist ? <HistoryGlyph onPress={onHistory} /> : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flexDirection: "row", alignItems: "center", marginTop: 20 },
});
