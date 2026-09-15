"use client";
import { useEffect, useRef, useState } from "react";
import { getJSON, postJSON, pretty, gradeUp, ROMAN, stageOfGrade, classNum, annualBudgetPeriods, projectReadiness, API, withUser, getUser, setUser, clearUser, fetchEntitlement, paidScopesOf, entLapsed as lapsedOf } from "./lib/format";
import { accountFirstName } from "./lib/account";
import { verifiedWrite, readinessFingerprint } from "./lib/verify";
import { setSectionMismatchHandler, pullSectionState, clearLocalSectionCache } from "./lib/sectionState";
import { clearLocalHistoryCache } from "./lib/sectionHistory";
import { signOutAuth } from "./lib/auth";
import { clearTeacherCaches } from "@aruvi/shared/signout";
import GenerateTab from "./components/GenerateTab";
import MyPlans from "./components/MyPlans";
import Login from "./components/Login";
import SubscribeFlow from "./components/SubscribeFlow";
import FirstRun from "./components/FirstRun";
import TeachingProfile from "./components/TeachingProfile";
import Settings from "./components/Settings";
import MyLessonPlans from "./components/MyLessonPlans";
import GuidedTour from "./components/GuidedTour";
import ProfilePortal, { queueSetupCheck, takeSetupCheck, pruneSetupCheck, setupKey, SETUP_CHECK_DELAY_MS } from "./components/ProfilePortal";
// ThemeToggle moved into Settings (App › Appearance) — no longer on the shell's bar.
import AskAruvi from "./ask-aruvi/AskAruvi";
import { primeBank, clearBank, refreshBank } from "./ask-aruvi/bank";
import MeyyMark from "./components/MeyyMark";

/* ───────── app shell ─────────
 * The app is gated behind a user-ID portal (Login). No password yet: the entered ID is the
 * tenant key — stored in localStorage, sent as X-Aruvi-User on every API call, and used by
 * the server to scope all per-teacher state (tenant_id == user_id). This makes the
 * persistence testable across multiple "teachers" and is the exact seam Phase 4 swaps for
 * Supabase Auth.
 *
 * Nav (2026-07-02 restructure): TWO CENTRE TABS — "My Classes" (home: one card per section,
 * pointer-organized) and "My Lessons" (the plan repository). No sidebar, no hamburger, no
 * Calendar, no My Week — Aruvi organizes by the section pointer ("where did I stop?"), never
 * by days (see MEMORY.md 2026-07-02). The teaching profile is parked behind the header's
 * settings gear. Generate is not a tab — it's reached only through "+ Prepare Lesson".
 * Readiness is PERSISTED server-side per user (GET/POST /readiness): the teaching profile
 * (subjects/grades/sections/durations) is loaded when a user signs in, so it survives a
 * refresh, a server restart, or a fresh browser — never lost on session cut. */
/* Activation gate (Phase 1, §0): the shell stays hidden until the teacher has completed the
 * guided first run. This USED to be tracked as a separate localStorage flag per user — but
 * that flag was purely client-side and could desync from the server: e.g. deleting a test
 * user's profile/allocations server-side left the browser's stale "activated" flag in place,
 * so she'd skip straight to a now-empty shell instead of being sent back through FirstRun
 * (found testing kumar3, 2026-07-02). Fixed by dropping the separate flag entirely — `ready`
 * (rehydrated from the real GET /readiness response) is now the SOLE activation signal, since
 * FirstRun's finishActivation always produces a real subjects[] payload before calling
 * onComplete. One source of truth, server-side, never stale. */

export default function Home() {
  // null = "haven't checked localStorage yet" (avoids a login-screen flash on refresh).
  const [user, setUserState] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("");
  const [grades, setGrades] = useState([]);
  const [grade, setGrade] = useState("");
  const [tab, setTab] = useState("myplans");
  const [ready, setReady] = useState(false);      // readiness flag — rehydrated per user from GET /readiness
  const [readiness, setReadiness] = useState(null); // readiness projection (durations/grids/budget) — feeds G4's weekly ratio
  const [readinessLoaded, setReadinessLoaded] = useState(false); // has GET /readiness resolved? (gates the first-run decision, avoids a flash)
  const [editFlow, setEditFlow] = useState(null);  // "profile" (settings gear) | "lessonplans" (My Lessons tab) | null (My Classes home)
  const [profileAutoAdd, setProfileAutoAdd] = useState(null);  // subject NAME to auto-launch the add-a-class flow for. ALWAYS null since 2026-08-21 (its only caller, the "expand classes" prompt)
  const [profilePortal, setProfilePortal] = useState(null);  // "subject" | "class" | "section" — one-shot intent from My Classes' standing "+" portal
  const [pendingOpen, setPendingOpen] = useState(null);  // {subject,grade,sectionTag,filename} — deep-link from Track into My Week
  // Where a Prepare-a-lesson flow should RETURN once the chapter is prepared. Set when Prepare is
  // launched from a section's attach popup. ⚠️ This comment used to say it REOPENED that popup;
  // it has AUTO-ATTACHED since long before (onPrepared → MyPlans' pendingAttach effect, which
  // binds), and the stale sentence was corrected 2026-09-15.
  const [prepareReturn, setPrepareReturn] = useState(null);  // { subject, grade, sectionTag } | null
  const [pendingAttach, setPendingAttach] = useState(null);  // {subject,grade,sectionTag,filename} — reopen the attach popup in My Classes
  // How the Generate tab should open this time:
  //   { mode: "pick" }                     → show the G1.9 subject·grade picker (multi-choice)
  //   { mode: "scoped", subject, grade }   → skip picker, go straight in for that subject·grade
  // Cleared once Generate consumes it. Generate is only ever reached through this handler.
  const [generateEntry, setGenerateEntry] = useState(null);
  const [askOpen, setAskOpen] = useState(false);   // Ask Aruvi Q&A screen (? on the tab row)

  /* First-run guided tour (restructured 2026-07-06; extended to 17 steps 2026-07-23). `tour` is the current step, 1–17 (or null);
   * the walk is launched from the "Show me how" nudge on My Classes and is GUIDE-DRIVEN: every
   * step advances with Next / reverses with Back, and the transitions here perform whatever the
   * step implies (tab navigation, opening the preview, the real attach — done inside MyPlans —
   * opening the popup, the profile). `tourInfo` carries the target section tag + chapter title
   * (reported up by MyPlans) so the step copy can name them.
   *
   * WHY skip is SESSION-ONLY, not a persisted flag (fixed 2026-07-06, kumar23): the tour offer is
   * gated by SERVER-DERIVED first-run state — MyPlans shows the nudge only while a lesson is
   * prepared but nothing is attached yet (`!anyBound && anyPlans`), which self-closes forever the
   * moment she attaches. A standalone per-user localStorage "tour done" flag is exactly the desync
   * trap the activation-flag note (top of file) warns about: deleting a test user's profile server-
   * side left the stale browser flag behind, so the fresh first run never re-offered the guide.
   * So skipping only hides it for THIS session (in-memory); a fresh login re-derives from the
   * server. Once attached, the server state itself stops the offer — no client flag needed. */
  const [tour, setTour] = useState(null);
  const [tourInfo, setTourInfo] = useState(null);   // { tag, chapter } from MyPlans
  const [tourDismissed, setTourDismissed] = useState(false);   // session-only; never persisted
  /* ★ THE OFFER IS SERVER-CONFIRMED, ONCE, HERE (2026-08-24 — kumar1's phantom tour).
     The 2026-08-21 change put the offer on BOTH surfaces, but only MyPlans carried a
     gate; MyLessonPlans rendered it purely on `onStartTour` being passed — so a veteran
     with 25 bound sections and advanced pointers was offered the 19-step tour on every
     My Lessons visit. And the obvious gate ("nothing attached") is WRONG since first
     run auto-binds her lesson to the default section — it would kill the offer for the
     exact person it exists for. The server-derived signal for "still new enough to
     offer the tour" is therefore: AT MOST ONE bound section AND no teaching progress
     anywhere (no pointer advanced, nothing done). It self-closes forever the moment she
     actually teaches — no stored flag, no localStorage desync trap (2026-07-06 rule).
     null = not yet answered / unreachable → no offer (unknown must never look new). */
  /* Ask Aruvi's bank: check for a newer one on every app load of a signed-in session.
   * Normally a 304 with no body (bank.js sends If-None-Match), so this costs a few hundred
   * bytes; the ~90KB download happens only when the answers have actually changed. Fire and
   * forget — Ask Aruvi opens from the stored copy regardless, and offline this fails silent.
   * Covers the teacher who stays signed in for months: without it, a corrected answer would
   * never reach her, which is half the reason the bank moved off the bundle. */
  useEffect(() => {
    if (!user) return;
    refreshBank();
  }, [user]);

  const [tourEligible, setTourEligible] = useState(null);
  useEffect(() => {
    if (!ready || !user) { setTourEligible(null); return; }
    let live = true;
    getJSON("/section-state")
      .then((d) => {
        if (!live) return;
        const rows = Object.values((d && d.states) || {});
        const bound = rows.filter((st) => st && st.chapter);
        const progressed = rows.some((st) => st && (st.done || st.unit_index != null));
        setTourEligible(bound.length <= 1 && !progressed);
      })
      .catch(() => { if (live) setTourEligible(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);
  /* Declared HERE, far above the effect that fills it, because `tourOnOffer` on the very
     next line reads it — a `const` used before its declaration is a TDZ ReferenceError
     that white-screens the whole app, and it is invisible to babel-parse. (Found live,
     2026-08-26, the day the lapsed-tour rule was added.) */
  const [entLapsed, setEntLapsed] = useState(false);
  /* ON TRIAL, Settings shows neither Personal profile nor Your data & export (founder,
     2026-08-26, after the persona run). Held HERE rather than inside Settings so the
     answer is already known when the gear is pressed — Settings' own fetch resolves a
     beat later, and two cards appearing and then vanishing is worse than either state.
     Declared beside entLapsed for the same TDZ reason recorded above. */
  const [entTrial, setEntTrial] = useState(false);
  /* A LAPSED teacher is never offered the tour (founder, 2026-08-26): it walks her
     through attaching, tracking and preparing — every one of which her subscription
     has just taken away. Offering it would teach her the shape of a locked door. */
  /* ★ ONCE, EVER (founder, 2026-08-26, live: "we cannot keep invoking it again and
     again"). `tourEligible` describes a teacher who LOOKS new — at most one bound
     section, no progress — and a veteran looks new every time her bindings are cleared,
     which is exactly what the June cutover does to every teacher by design. So the
     server now records that the offer was shown (`tour_offered_at` on her account), and
     that fact outranks the heuristic. It is on the account, not in localStorage,
     because "once" must survive sign-out and a second device. */
  const [tourSpent, setTourSpent] = useState(false);
  const tourOfferedThisSession = useRef(false);
  const tourOnOffer = tourEligible === true && !tourSpent && !tourDismissed && !entLapsed;
  /* Spend it the moment it is OFFERED, not when she takes it. Skipping is a deliberate
     answer ("if he skips it deliberately its gone") and so is ignoring it; the one thing
     she must never get is the same prompt every June. The local flag is deliberately NOT
     set here — that would hide the nudge she is looking at and take away the button. The
     server write lands, and her NEXT sign-in reads it. Fire-and-forget: if the write
     fails she is offered it once more, which is the harmless direction to err in. */
  useEffect(() => {
    if (!tourOnOffer || tourOfferedThisSession.current) return;
    tourOfferedThisSession.current = true;
    fetch(`${API}/account/tour-offered`, withUser({ method: "POST" })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOnOffer]);
  // Also closes Ask Aruvi: Skip can be pressed on step 18 while the panel is open, and the
  // tour must never leave the shell in a state it opened.
  /* ★ Ending the tour asks her to check her sections (founder, 2026-08-21). First run no longer
     ASKS which sections she teaches — it states a default ("we'll start you with Section 9A")
     because the question was too much to put in front of a brand-new teacher. That default can
     of course be wrong, and by the end of the tour she knows exactly what a section is and has
     watched one being tracked — so this is the first moment the question is cheap to answer.
     It rides finishTour, which is the SINGLE exit for both endings: "Done ✓" on the last step
     and "Skip" from any step. Session-only, like tourDismissed — it is a prompt, not a gate.

     ★ AMENDED 2026-08-27 (founder) — it is the SAME WINDOW as the "+" portal, and it has a
     SECOND moment. Two changes, one idea:
       (a) the prompt no longer offers a lone "open my teaching profile" row. It renders
           ProfilePortal in "check" mode: identical rows to the "+" window (subject · class ·
           section · periods a week · the year's total), only the title, the sub-line and the
           closing button differ. A window that names what Aruvi assumed and then hands her a
           generic link to go find it was doing half the job.
       (b) it also fires when a SUBSCRIBER who has added a subject or a class first opens that
           subject·class in My Lessons. Aruvi makes the very same assumptions for an added
           subject as it made for her first one, so she deserves the very same question about it
           — asked at first USE, not at the moment she adds it (that is one more configuration
           screen stacked on the one she is standing on; §0's benefit-first rule).
     State is now a descriptor, not a boolean, and it holds BOTH moods of the one window:
       { mode:"change" }                                — she pulled the "+" on My Classes
       { mode:"check", reason:"tour" }                  — the tour just ended
       { mode:"check", reason:"added", subject, grade } — first use of a subject·class she added
     page.jsx owns it for both (the "+" state used to live inside MyPlans) because the window has
     to survive a trip into the profile and come back — see goPortalHome. MyPlans still gets the
     boolean it needs for its re-bind effect. */
  const [portalWin, setPortalWin] = useState(null);
  /* EVERY ending lands on My Classes (founder, 2026-08-21). Done, Skip and the ✕ all route
     through here, and none of them used to navigate — so skipping from steps 3–7, which run on
     My Lessons, left her there, and the prompt below (which renders inside MyPlans) had no host
     to render in. She reported exactly that: "skip … lands in My Lessons with My Classes
     remaining empty". My Classes is also where the payoff now is, since the first lesson is
     bound to her section. */
  const finishTour = () => {
    setAskOpen(false); setTour(null); setTourDismissed(true);
    goClasses();
    setPortalWin({ mode: "check", reason: "tour" });
  };

  /* ── The "she just added something" queue (see ProfilePortal.jsx) ────────────────────────
   * Every subject·class in her profile is watched here, in ONE place, rather than at each of
   * the several add paths (the profile's + buttons, the "+" portal's manage screens, a
   * subscribe flow that widens her scope). A key that appears in readiness where it was not
   * before IS an add, whichever door it came through. My Lessons spends the key on first use.
   *
   * The FIRST resolved profile only seeds the baseline and queues nothing: a teacher signing in
   * with twelve classes must not be handed twelve pending questions, and a brand-new teacher's
   * first subject is the tour prompt's job, not this one. */
  // Keyed by USER: a sign-out leaves the baseline behind, and the next teacher on this browser
  // must never have the previous one's profile diffed against hers.
  const setupKeysRef = useRef({ user: null, keys: null });
  useEffect(() => {
    if (setupKeysRef.current.user !== user) setupKeysRef.current = { user, keys: null };
    if (!ready || !readiness) return;
    const keys = [];
    (readiness.subjects || []).forEach((s) =>
      (s.grades || []).forEach((g) => keys.push(setupKey(s.name, g.grade))));
    const prev = setupKeysRef.current.keys;
    setupKeysRef.current = { user, keys };
    if (!prev) return;                                    // baseline only
    const added = keys.filter((k) => !prev.includes(k));
    if (added.length) queueSetupCheck(added);
    pruneSetupCheck(keys);   // self-heal: nothing she does not teach stays queued
  }, [ready, readiness, user]);

  /* My Lessons scoped itself to a subject·class. If that one was queued above, this is her
   * first use of it — ask now, and the key is spent for good (takeSetupCheck is idempotent).
   * Never over the tour, and never while a check window is already open.
   * takeSetupCheck is called OUTSIDE any state updater on purpose: it mutates localStorage, and
   * an updater can be invoked twice (StrictMode) — which would spend the key on the run whose
   * result React then throws away.
   *
   * ★ AND IT WAITS A BEAT (founder, 2026-08-28). The window used to open in the same tick the
   * dropdown resolved the subject·class, so it landed ON TOP of the selection she had just made —
   * she never saw the screen she asked for before being asked a question about it. A one-second
   * hold lets the pane paint first; the question then arrives as a follow-up rather than as an
   * interruption of her own tap. The timer is cancelled on unmount and superseded by a later
   * scope change (a teacher spinning the wheels queues one window, not five), and the updater
   * form re-checks `portalWin` at FIRE time — a second's worth of taps can open one in between. */
  const scopeCheckTimer = useRef(null);
  useEffect(() => () => clearTimeout(scopeCheckTimer.current), []);
  const onLessonsScope = (subjectName, grade) => {
    if (!subjectName || !grade || tour || portalWin) return;
    if (!takeSetupCheck(setupKey(subjectName, grade))) return;
    clearTimeout(scopeCheckTimer.current);
    scopeCheckTimer.current = setTimeout(() => {
      scopeCheckTimer.current = null;
      setPortalWin((w) => w || { mode: "check", reason: "added", subject: subjectName, grade });
    }, SETUP_CHECK_DELAY_MS);
  };
  /* The tour opens on My Classes. It always did implicitly, because its only entry point was a
     nudge ON My Classes; now that first run lands on My Lessons and the same nudge renders
     there too, step 1 ("this is where your classes sit") would otherwise ring the My Classes
     tab over the My Lessons view. Navigate first, then start. */
  const startTour = () => { goClasses(); setTour(1); };

  // Areas 4 + 5: a VERIFIED section mismatch — the class is not on the chapter she just
  // attached, or not marked complete. pushSectionState calls this only when the server was read
  // back and disagrees; never on a throw, never when unreachable. Re-pull so the cards show the
  // truth, then say one sentence.
  const [sectionFailed, setSectionFailed] = useState("");
  useEffect(() => {
    setSectionMismatchHandler((sectionKey) => {
      pullSectionState([sectionKey]).finally(() => {
        setSectionFailed("That didn’t save — your classes are as Meyy has them.");
      });
    });
    return () => setSectionMismatchHandler(null);
  }, []);

  // On mount, restore the signed-in user from localStorage (survives refresh).
  useEffect(() => { setUserState(getUser()); }, []);

  // App-shell scroll ownership (2026-08-09): while the signed-in shell is up, the document
  // never scrolls — html.app-shell (globals.css) locks html/body to the viewport and makes
  // .bodycontent the one scroll container, so the top bar is plain static flow that CANNOT
  // scroll away. This exists because the standalone iPhone webview dropped both sticky AND
  // fixed positioning on the document scroller. Login/first-run keep document scrolling.
  useEffect(() => {
    const on = !!(user && ready);
    document.documentElement.classList.toggle("app-shell", on);
    return () => document.documentElement.classList.remove("app-shell");
  }, [user, ready]);

  // Freeze the top chrome (the fixed .topbar, then the My Classes greeting) while the card
  // list scrolls beneath. Publish two CSS vars so every inner sticky offset stays exact across
  // breakpoints and the two-line brand — no magic numbers:
  //   --nav-h  the FULL height of the frozen bar (what inner stickies sit under)
  //   --hdr-h  the brand row's underside (AskAruvi's scrim hangs off this)
  //   --bnav-h the BOTTOM nav's height — what anything covering the body must stop ABOVE
  //            (founder, 2026-09-13: the bar must stay visible behind Ask Meyy). 0px when the
  //            bar is not rendered (Settings), so one expression works on every screen.
  // Both are measured RELATIVE TO .topbar's top edge, so the safe-area inset a home-screen
  // iPhone adds above the brand row is counted once and only once. ResizeObserver as well as
  // resize: fonts landing late or the status-bar inset changing must not leave stale offsets.
  useEffect(() => {
    const root = document.documentElement;
    const bar = document.querySelector(".topbar");
    const setVars = () => {
      const b = document.querySelector(".topbar");
      const h = document.querySelector(".hdr");
      const n = document.querySelector(".bnav");
      // Set BEFORE the .topbar early-return: the two are independent, and a screen without a
      // topbar must still publish an honest 0 rather than leave a stale height behind.
      root.style.setProperty("--bnav-h", n ? `${Math.round(n.getBoundingClientRect().height)}px` : "0px");
      if (!b) return;
      const bt = b.getBoundingClientRect();
      if (h) root.style.setProperty("--hdr-h", `${Math.round(h.getBoundingClientRect().bottom - bt.top)}px`);
      root.style.setProperty("--nav-h", `${Math.round(bt.height)}px`);
    };
    setVars();
    window.addEventListener("resize", setVars);
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(setVars);
      if (bar) ro.observe(bar);
      // The bottom bar too: the safe-area inset it carries inside itself changes on rotation
      // and on a home-screen iPhone, and a stale --bnav-h would leave a gap under the scrim.
      const bnav = document.querySelector(".bnav");
      if (bnav) ro.observe(bnav);
    }
    return () => { window.removeEventListener("resize", setVars); if (ro) ro.disconnect(); };
  }, [ready, tab, editFlow, user]);

  // Load this user's readiness profile whenever the signed-in user changes (incl. on the
  // initial restore). The API scopes the read to X-Aruvi-User; we regenerate the active-
  // subject projection the consumers read. Clearing first prevents one user's data flashing
  // for another after a sign-out/sign-in.
  useEffect(() => {
    if (!user) return;
    setReady(false); setReadiness(null); setReadinessLoaded(false);
    getJSON("/readiness").then((d) => {
      if (d && d.ready && d.readiness) {
        setReadiness(projectReadiness(d.readiness));
        setReady(true);
      }
    }).catch((e) => {
      // A 401 is not "no profile": the server REFUSED this session (a stale stub id in
      // localStorage once the API moved to Supabase Auth, or an expired token). Showing
      // first-run to a teacher the server does not recognise would let her build a profile
      // every save then rejects — so she goes back to the front door instead (Track B).
      if (e && e.message === "401") { onSignOut(); return; }
      // Otherwise (no saved profile / API down) → stay in the not-ready setup flow.
    }).finally(() => setReadinessLoaded(true));
  }, [user]);

  // First-run complete: FirstRun has now walked the FULL sequence (subject → grade → chapter →
  // preview → section fan-out → arrange-week-or-skip) and hands up the canonical readiness
  // payload it built — { subjects: [subjectRecord] }. This is the real activation moment: persist
  // it for real (same POST used by the old upfront wizard, via onReadyComplete's pattern), flip
  // `ready` so the shell opens with her new section card(s) already visible in My Plans, and
  // scope the Generate tab to what she just set up. `ready` is now the ONLY activation signal
  // (see the comment above the component) — no separate local flag to keep in sync.
  // ── READ-AFTER-WRITE for the shell's two readiness writes (founder doctrine, 2026-08-10)
  // X = the profile before setup · A = this save · Y = the subjects[] she just built · Y′ =
  // GET /readiness. Error IFF Y′ ≠ Y. A throw is not a criterion and an unreachable server is
  // not an error — it is a state in which the check cannot run. Same rule, same helper and the
  // same tested fingerprint as TeachingProfile; only the surface differs, because here she is
  // in the shell rather than on the profile screen.
  const [saveFailed, setSaveFailed] = useState(false);
  const verifyReadiness = (subs) => {
    const want = readinessFingerprint(subs);
    verifiedWrite({
      write: () => fetch(`${API}/readiness`, withUser({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects: subs }),
      })).then((r) => { if (!r.ok) throw new Error(String(r.status)); }),
      read: () => getJSON("/readiness").then((d) => (d && d.readiness) || d || {}),
      expect: (y) => readinessFingerprint(y.subjects) === want,
    }).then(({ status, actual }) => {
      if (status !== "mismatch") return;
      // Y′ is the truth, including whether she is set up at all. Leaving `ready` true over an
      // empty profile would strand her in a shell with no classes and no explanation.
      const real = (actual && actual.subjects) || [];
      setReadiness(projectReadiness({ subjects: real }));
      setReady(real.length > 0);
      setSaveFailed(true);
    });
  };

  /* ★ A DIRECT SUBSCRIBER STILL GETS THE GUIDED FIRST GENERATION (founder,
     2026-08-25): checkout creates her default profile, so `ready` is true — but the
     first-run pathway is how she LEARNS to generate. Server-derived heuristic, no
     stored flag (the 2026-07-06 rule): ready + NOTHING ever prepared + NOTHING bound
     = she has never generated → first run (scope-filtered to what she paid for).
     Completing it (or any generation) ends the condition forever. Unknown (fetch
     failed) → never force first run on a veteran. */
  const [firstGenNeeded, setFirstGenNeeded] = useState(false);
  /* ★ THE ONE-SHOT LATCH (bug found in the 2026-08-26 persona run). Completing first
     run flips `ready` false→true, which RE-RUNS this effect — and at that instant the
     serve fired by `prepareAndHandOff` is still in flight, so the server truthfully
     answers "nothing prepared, nothing bound" and the heuristic re-armed first run,
     bouncing the teacher back to the welcome screen seconds after her first success.
     Her plan was fine on disk; only a reload escaped. The heuristic answers "has she
     EVER generated?" — once this session has watched her do it, the answer can never
     revert, so latch it and never ask again. */
  const everGeneratedRef = useRef(false);
  const latchUserRef = useRef(null);   // whose latch it is — sign-out must not inherit it
  useEffect(() => {
    // The latch belongs to ONE teacher. Signing out and in as someone else does not
    // remount page.jsx, so without this a veteran's latch would suppress the NEXT
    // teacher's first run (found 2026-08-26: a direct subscriber landed in the shell
    // because the previous session's teacher had generated).
    if (latchUserRef.current !== user) { latchUserRef.current = user; everGeneratedRef.current = false; }
    if (!ready || !user) { setFirstGenNeeded(false); return; }
    if (everGeneratedRef.current) { setFirstGenNeeded(false); return; }
    let live = true;
    Promise.all([
      getJSON("/plans-prepared").catch(() => null),
      getJSON("/section-state").catch(() => null),
      /* ★ AND HER YEAR HISTORY (cutover, 2026-08-26). Both reads above are YEAR-SCOPED,
         so the morning after a teacher cuts over they answer "nothing prepared, nothing
         bound" — truthfully, because the new year is empty — and a ten-year veteran was
         thrown into the guided first run. Found live in the June simulation. A PRIOR
         YEAR is proof she has been here before; the question the heuristic asks is "has
         she ever generated?", and last year's folder answers it. */
      getJSON("/academic-year").catch(() => null),
    ]).then(([p, s, y]) => {
      if (!live || !p || !s || everGeneratedRef.current) return;
      const veteran = !!(y && (y.prior_years || []).length > 0);
      const prepared = Object.keys((p && p.prepared) || {}).length > 0;
      const bound = Object.values((s && s.states) || {}).some((st) => st && st.chapter);
      if (prepared || bound || veteran) everGeneratedRef.current = true;
      setFirstGenNeeded(!prepared && !bound && !veteran);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  const onFirstRunComplete = (payload, preparing) => {
    const subs = (payload && payload.subjects) || [];
    // latch: she just generated — never re-arm for HER (2026-08-26)
    latchUserRef.current = user;
    everGeneratedRef.current = true;
    setFirstGenNeeded(false);
    if (subs.length) {
      /* MERGE with the checkout-created defaults, never replace (founder,
         2026-08-25): first run builds ONE subject record from her choices; a direct
         subscriber's other purchased subjects (English beside her SS walk-through)
         must survive the activation write. Same-name records are replaced by hers;
         the rest keep their place. A fresh trial teacher has no base → unchanged. */
      const base = (readiness && readiness.subjects) || [];
      const merged = base.length
        ? base.map((b) => subs.find((n) => n.name === b.name) || b)
            .concat(subs.filter((n) => !base.some((b) => b.name === n.name)))
        : subs;
      setReadiness(projectReadiness({ subjects: merged }));
      setReady(true);
      const first = subs[0];
      setSubject(subjectSlugify(first.name));
      if (first.grades && first.grades[0]) setGrade((first.grades[0].grade || "").toLowerCase());
      /* ★ Land on MY LESSONS, not My Classes (founder, 2026-08-21). First run's whole promise is
         a lesson plan, so the first thing she should see when the shell opens is the lesson —
         not a section card that is empty until she attaches something to it. The tour offer
         renders below it there, and the tour itself starts by naming both tabs, so she still
         meets My Classes within seconds — with a reason to care about it.
         `preparing` is the proposed-lesson descriptor: first run fires the serve and hands off
         in the SAME tick, so the plan is still in flight when the shell opens. Setting it here
         puts the ordinary progress card at the head of My Lessons — the identical wait a normal
         run shows — and `onPrepared` replaces it in place when the serve lands. First run has no
         waiting screen of its own any more; there is one wait, in one place. */
      goLessons();
      if (preparing) setPreparingCard(preparing);
      // READ-AFTER-WRITE (lib/verify.js). This is the ACTIVATION write — the one that turns a
      // first-time teacher into a set-up one — and it used to end in an empty catch, so a lost
      // profile looked exactly like a successful setup until her next sign-in.
      verifyReadiness(merged);
    }
  };

  useEffect(() => { if (!user) return;
    getJSON("/subjects").then((d) => { setSubjects(d.subjects); setSubject(d.subjects.includes("science") ? "science" : d.subjects[0]); }).catch(() => {});
  }, [user]);

  useEffect(() => { if (!subject) return;
    getJSON(`/subjects/${subject}/grades`).then((d) => {
      const gs = [...d.grades].sort((a, b) => ROMAN.indexOf(a) - ROMAN.indexOf(b));
      setGrades(gs);
      // Keep the already-selected grade if it's valid for this subject (e.g. a section card
      // scoped us to English·VI just before this fires) — only fall back to a default when the
      // current grade isn't offered for the new subject. Functional update reads the live grade.
      setGrade((prev) => (gs.includes(prev) ? prev : (gs.includes("vii") ? "vii" : gs[0] || "")));
    }).catch(() => setGrades([]));
  }, [subject]);

  // Persist the readiness profile (canonical subjects[] only) when setup completes, then
  // flip ready. Fire-and-forget: the UI advances immediately; the write carries the user
  // header so it lands under the right tenant.
  const onReadyComplete = (payload) => {
    setReadiness(payload);
    setReady(true);
    verifyReadiness((payload && payload.subjects) || []);
  };


  // From My Lesson Plans: "Need a chapter…" pre-scopes Generate to a subject·grade and opens
  // it, so the allocation table lands on that exact combo (slugs match the scope-pill state).
  const onAllocateScoped = (subjectSlug, gradeSlug) => {
    if (subjectSlug) setSubject(subjectSlug);
    if (gradeSlug) setGrade(gradeSlug);
    setEditFlow(null);
    // My Lessons path → deposit only, never auto-attach to a section (no return section).
    setPrepareReturn(null);
    setGenerateEntry({ mode: "scoped", subject: subjectSlug, grade: gradeSlug });
    setTab("generate");
  };

  // THE single route into Generate (the "Ready to plan…" button + My Week empty cards). With one
  // subject AND one grade we skip the picker and scope directly; otherwise the G1.9 picker runs.
  // `opts.subject`/`opts.grade` (slugs) pre-scope and skip the picker (My Week row / My Lesson Plans).
  const subjectSlugify = (n) => (n || "").toLowerCase().replace(/ /g, "_");
  // opts.single === true marks a one-chapter-at-a-time entry (from a My Week card) — Allocate
  // rewords G4 to "this chapter" and shows the budget anchor. Bulk entries (Generate tab, My
  // Lesson Plans "Generate") leave it falsy and keep the multi-chapter framing.
  const onEnterGenerate = (opts = {}) => {
    const subs = (readiness && readiness.subjects) || [];
    const single = !!opts.single;
    if (opts.subject && opts.grade) {
      setSubject(opts.subject); setGrade(opts.grade);
      setGenerateEntry({ mode: "scoped", subject: opts.subject, grade: opts.grade, single });
    } else if (subs.length === 1 && (subs[0].grades || []).length === 1) {
      const sSlug = subjectSlugify(subs[0].name);
      const gSlug = (subs[0].grades[0].grade || "").toLowerCase();
      setSubject(sSlug); setGrade(gSlug);
      setGenerateEntry({ mode: "scoped", subject: sSlug, grade: gSlug, single });
    } else {
      setGenerateEntry({ mode: "pick", single });
    }
    // Launched from a section's attach popup → remember where to return once the chapter is
    // prepared, so the wait can be drawn on that card and the chapter auto-attached to it.
    setPrepareReturn(opts.returnSection && opts.subject && opts.grade
      ? { subject: opts.subject, grade: opts.grade, sectionTag: opts.returnSection } : null);
    setEditFlow(null);
    setTab("generate");
  };

  // A chapter was just prepared in the Generate flow. Don't open the lesson plan.
  //  • Launched FROM a section card → auto-ATTACH the new lesson to that section and land on My
  //    Classes, where the card now shows it (MyPlans consumes pendingAttach and binds it).
  //  • Launched from My Lessons → deposit ONLY: it's already marked prepared, so send her to the
  //    My Lessons repository where it now appears; no section is touched.
  // `filename` is the prepared plan.
  const onPrepared = ({ subject: s, grade: g, filename }) => {
    setGenerateEntry(null);
    setPreparingCard(null);            // the proposed card gives way to the real one
    if (prepareReturn) {
      setPendingAttach({ ...prepareReturn, filename });
      setPrepareReturn(null);
      setEditFlow(null); setTab("myplans");
    } else {
      if (s) setSubject(s); if (g) setGrade(g);
      setEditFlow("lessonplans"); setTab("myplans");
    }
  };

  // ── THE WAIT MOVED TO WHERE THE LESSON LANDS (founder, 2026-08-06) ──────────────
  // Preparing no longer holds her on the Generate screen behind a pale stand-in card.
  // The moment the request goes out, PrepareLesson hands the descriptor up here and we
  // put her in My Lessons, where the proposed lesson is drawn as an ordinary card at the
  // head of the list — real title, real period shape, full strength — with a progress bar
  // where "Ready to teach" will be. When the plan resolves, that card becomes the real one
  // in place; she never changes screens to watch it happen.
  //   `preparingCard` lives HERE, above the tab, because PrepareLesson unmounts the instant
  // we navigate. The request itself keeps running inside that unmounted component's closure
  // and still calls onPrepared / onPrepareError, which is why nothing had to move server-side.
  //   ★ AND THE SECTION-ATTACH PATH IS NO LONGER EXCLUDED (founder, 2026-09-15: "it should show
  // progress on the section card from which it was generated and upon completion, settle in the
  // section card with the new LP attached"). It WAS excluded, on the reasoning that it "lands in
  // My Classes, not My Lessons, so there is nowhere to put this card" — which read the rule as
  // being about My Lessons. It is not: the rule is that the wait happens WHERE THE LESSON WILL
  // APPEAR, and for this journey that is the section card she launched it from. The premise was
  // wrong, not the rule. `preparingSection` tells MyPlans which card is waiting, and nobody waits
  // on an otherwise-empty Generate screen any more.
  const [preparingCard, setPreparingCard] = useState(null);
  // Returns TRUE only if the card was actually taken. PrepareLesson falls back to its own
  // in-place wait on false — without that handshake the attach path would show her nothing
  // at all for five seconds, which is worse than either screen.
  const onPreparing = (desc) => {
    if (!desc) return false;
    setGenerateEntry(null);
    setPreparingCard(desc);
    if (desc.subject) setSubject(desc.subject);
    if (desc.grade) setGrade(desc.grade);
    /* Launched from a section card → the wait belongs on MY CLASSES, on that card. Otherwise it
       belongs in the My Lessons repository, where the finished plan will appear. */
    setEditFlow(prepareReturn ? null : "lessonplans"); setTab("myplans");
    return true;
  };
  // The serve failed. Do NOT simply pull the card: she is watching it, and a card that
  // vanishes silently reads as "I mis-tapped" (ARV-D-087 — the founder met exactly this on the
  // phone: "something seemed to flash for a micro sec but nothing readable"). Keep it, mark it
  // FAILED, and put the message on it — the card is where her attention already is, so it needs
  // no banner and no navigation. A bar that never resolves is still worse than either, which is
  // what the original note was protecting against; `failed` ends the bar.
  const onPrepareError = (desc, message) =>
    setPreparingCard(desc ? { ...desc, failed: true, message } : null);
  const onDismissPrepareError = () => setPreparingCard(null);

  // ── The paywall window (founder, 2026-08-24 — the first Step-6 surface, built early
  // because the live kumar3 trial met the raw 402 inside a section card). A 402 is not
  // an error: the proposed card comes DOWN (no failed state, no inline message) and this
  // modal carries the server's own sentence, with Subscribe bold below it. Subscribe is
  // not wired to a purchase flow yet (no gateway — Step 5's ManualBillingProvider is the
  // founder); until then it closes the window. `paywall` holds the message string.
  const [paywall, setPaywall] = useState(null);
  const onPaywall = (message) => {
    setPreparingCard(null);                       // never a card for a blocked prepare
    setPaywall(message || "Subscribe to prepare new chapters.");
  };
  /* The paywall's Subscribe opens the SAME SubscribeFlow the front door uses (founder,
     2026-08-25), landing at About you — she is already verified (signed in). On
     completion: close, and bump the entitlement sync so the trial→active flip lands
     immediately (scope filters, counters, paywall all refresh). */
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [entSyncTick, setEntSyncTick] = useState(0);

  // From My Lesson Plans → Track: deep-link into My Week to open a SECTION's pointer-enabled
  // plan (grade-level reads, section-level acts). Scope the tab, leave the library, and stash
  // a pending-open hint that MyPlans consumes on mount.
  const onOpenSection = (subjectSlug, gradeSlug, sectionTag, plan) => {
    if (subjectSlug) setSubject(subjectSlug);
    if (gradeSlug) setGrade(gradeSlug);
    setPendingOpen({ subject: subjectSlug, grade: gradeSlug, sectionTag, filename: plan && plan.filename });
    setEditFlow(null);
    setTab("myplans");
  };

  const onEnter = (id) => {
    setUser(id); setUserState(id);
    // Pull the Ask Aruvi bank down NOW, at the one moment she is certainly online (she has
    // just authenticated over the network). It is signed-in-only content cached on the
    // device, so this fetch is the whole offline guarantee — see ask-aruvi/bank.js.
    primeBank();
  };
  /* ★ ERASED, BUT STILL ON SCREEN (founder, 2026-09-13 — found live after a real deletion).
     The account is destroyed the moment the receipt lands, but Settings' farewell card kept
     rendering inside the shell and its "Done" button was the ONLY control that signed her out.
     The frozen Settings bar's ✕ sits right above it and knew nothing about the erasure, so
     closing that way dropped her back into a fully-rendered My Classes for an account that no
     longer exists — the readiness effect below re-reads only on `user`, so nothing refetched
     and the dead profile stayed until a manual refresh (which 401s and signs out properly).
     Now: the DEVICE is swept the instant the receipt arrives — nothing of hers survives even
     if she simply closes the tab — and `erased` arms settingsClose, so BOTH exits land at the
     front door. `user` is deliberately NOT cleared here: that would unmount the farewell she
     has not read yet. onSignOut is idempotent, so whichever exit she takes is safe. */
  const [erased, setErased] = useState(false);
  const onErased = () => {
    setErased(true);
    clearUser();
    signOutAuth();
    clearTeacherCaches(["setup_check_pending_", "mylessons_subject_", "mylessons_class_", "allocations_"]);
  };

  const onSignOut = () => {
    setErased(false);
    clearUser(); setUserState("");
    signOutAuth();   // the Supabase session, when there is one (lib/auth.js)
    // EVERY per-teacher cache goes: the bank (licensed content behind an account — never
    // leave it in a shared browser), the teaching ledger (the history reconcile PUSHES owed
    // rows UP, so rows left in a staff-room browser would be merged into the NEXT teacher's
    // account — sectionHistory's owner stamp refuses that; this is the belt to its braces),
    // and — new on 2026-09-11, found by the live walk on the production stack — the section
    // state (`current_chapter_*`/`lu_*`), chapter notes and the per-user screen preferences,
    // which sign-out used to leave behind. The server copy is authoritative and this device
    // rebuilds all of it on her next sign-in, so nothing is lost. One sweep, shared with the
    // phone: @aruvi/shared/signout. The extra prefixes are the web's own userKey() caches.
    clearTeacherCaches(["setup_check_pending_", "mylessons_subject_", "mylessons_class_", "allocations_"]);
    setReady(false); setReadiness(null); setReadinessLoaded(false);
    setSubjects([]); setSubject(""); setTab("myplans"); setEditFlow(null);
    setTour(null); setTourDismissed(false);
  };

  // The three destinations: the two centre tabs + the settings gear. Each leaves any
  // in-progress Generate flow and clears its pending entry/scope.
  /* ★ My Lessons always OPENS on "Your lessons" (founder, 2026-08-29) — the pane is no longer
     persisted, so leaving for My Classes/Settings and coming back lands on the repository, not
     on a Year Plan left open yesterday. The ONE exception is the Year-Plan budget pencil's
     round trip: onEditYearBudget stamps this one-shot ref and the MyLessonPlans remount
     consumes it (see its pane state), so the pencil still returns to the plan she was reading.
     goClasses clears it — a detour through My Classes is an ordinary visit, not the round trip. */
  const lessonsPaneIntentRef = useRef(null);
  const goClasses = () => { setEditFlow(null); setTab("myplans"); setGenerateEntry(null);
    lessonsPaneIntentRef.current = null; };
  const goLessons = () => { setEditFlow("lessonplans"); setTab("myplans"); setGenerateEntry(null); };

  // Tour Next — the guide performs the move each step implies before advancing. The view-level
  // work (report/archive buttons at 4/5 on My Lessons, "open the lesson" card at 6 + preview at 7,
  // popup at 9/14, attach/unbind at the 9↔10 boundary, lesson at 11–12, demo-complete at 13–14, the
  // big "+" grow button surfaced at 15) is orchestrated by MyPlans/MyLessonPlans off the numeric
  // tourStep; here we only handle SHELL navigation (numbers shifted +1 from step 12 on —
  // the bookmark step, 2026-08-25): 2→3 open My Lessons · 7→8 back to My Classes ·
  // 15→16 close the popup back to My Classes home (the "+" step) · 16→17 open the profile
  // (step 17 rings the settings gear over it) · 17→18 back to My Classes (the Ask Aruvi
  // mark) · 18→19 OPEN Ask Aruvi so step 19 rings the real panel · 19→20 close it again
  // for the centred "Welcome to Aruvi" sign-off · 20 Done → My Classes.
  const tourNext = () => {
    if (tour === 2) goLessons();
    else if (tour === 7) goClasses();
    else if (tour === 15) goClasses();
    else if (tour === 16) goProfile();
    else if (tour === 17) goClasses();          // leave the profile → show the Ask Aruvi mark on My Classes
    else if (tour === 18) setAskOpen(true);     // show her the panel itself, not just its mark
    else if (tour === 19) setAskOpen(false);    // clear the screen for the sign-off
    else if (tour === 20) { setAskOpen(false); finishTour(); goClasses(); return; }
    setTour(tour + 1);
  };
  // Tour Back — mirrors every move so each step reverses cleanly: 3→2 back to My Classes' tab
  // highlight; 8→7 back to My Lessons (the preview re-opens there); 16→15 back to My Classes
  // (the grow "+" step; 15→14 re-opens the popup, handled by MyPlans). Steps 4/5/6/7 stay within My
  // Lessons so need no shell move. Back from step 1 backs out to the nudge.
  const tourBack = () => {
    if (tour === 1) { setTour(null); return; }
    if (tour === 3) goClasses();
    else if (tour === 8) goLessons();
    else if (tour === 17) goClasses();
    else if (tour === 18) goProfile();   // back to the settings-gear step (profile open)
    else if (tour === 19) setAskOpen(false);  // 19→18: the mark on the tab row, panel closed
    else if (tour === 20) setAskOpen(true);   // 20→19: re-open the panel the step rings
    setTour(tour - 1);
  };
  const goProfile = () => { setProfileViaSettings(false); setProfileAutoAdd(null); setProfilePortal(null); setProfilePortalScope(null); portalOriginRef.current = null; setEditFlow("profile"); setTab("myplans"); setGenerateEntry(null); };
  /* ── Settings context (founder, 2026-08-24 final) ──
   * The gear opens Settings; the PROFILE is Settings' top card (no separate person
   * icon — fewer buttons). While in Settings (or the profile reached THROUGH it), the
   * tab row is REPLACED by a frozen Settings bar (back + title): the tabs and the Ask
   * mark had no role there and read as stale chrome. Back is hierarchical — subview →
   * Settings home → wherever she came FROM (captured at gear-press). Portal/tour paths
   * still open the profile directly with the ordinary tab row (they exit by their own
   * flows), so only the settings-origin visit wears the bar. */
  /* Lapsed lockout, UI half (§2.5 as amended; server 402s are the authority): when the
     subscription is positively expired, the growth/tracking entry points hide — the
     "+" portal on My Classes and the profile's edit pen. Plans stay fully open. */
  /* Her NAME on the bar once captured (founder, 2026-08-26): the account's
     display_name replaces the raw mobile/id top-right (and in the greeting) as soon
     as checkout / Personal profile captures it. A numeric display_name is the JIT
     default, not a name — keep showing the id then. Re-checked on `entSyncTick`, which
     an in-app subscribe bumps — and which Settings' Personal profile ALSO bumps on save
     (bug found 2026-08-26: renaming yourself left the old first name on the bar and in
     the greeting until a reload, because nothing re-fetched the account). */
  const [displayName, setDisplayName] = useState("");
  useEffect(() => {
    if (!user) { setDisplayName(""); return; }
    fetch(`${API}/account`, withUser()).then((r) => (r.ok ? r.json() : null)).then((a) => {
      /* FIRST name only, capitalised; a numeric display_name is the JIT default, not a name.
         The rule moved to @aruvi/shared/account on 2026-09-15 so the phone's bar and greeting
         decide it identically — the founder found them still showing her mobile number after she
         had subscribed and given her name. One rule, two surfaces. */
      setDisplayName(accountFirstName(a));
      /* Has the tour already had its one showing? (2026-08-26 — see tourOnOffer.)
         Never while it is on screen in THIS session: a mid-session re-read (a subscribe
         or a profile save bumps entSyncTick) would otherwise pull the nudge out from
         under her the instant the write we just made came back. */
      setTourSpent(!!(a && a.tour_offered_at) && !tourOfferedThisSession.current);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, entSyncTick]);

  /* ── Academic-year cutover (Step 2, founder 2026-08-26) ────────────────────────
     `yearInfo.cutover_due` is computed SERVER-side from her stored current year — never
     from the browser clock, which a teacher can change and a phone in another timezone
     gets wrong. Re-read on the same rhythm as the entitlement (focus/visibility) so a
     teacher who leaves the tab open across midnight on 1 June is offered it without a
     reload. Completing it re-reads readiness and the section state, because both are
     year-scoped and have just changed underneath her. */
  const [yearInfo, setYearInfo] = useState(null);
  const [cutoverBusy, setCutoverBusy] = useState(false);
  const [cutoverResult, setCutoverResult] = useState(null);
  // Session-only, deliberately never persisted (see the ✕ in MyPlans): closing the offer
  // clears this visit, and it returns on her next sign-in until she actually cuts over.
  const [cutoverDismissed, setCutoverDismissed] = useState(false);
  /* ★ AND IT IS CLEARED WHENEVER THE TEACHER CHANGES (founder, live, 2026-08-26): NOT
     YET, then sign out and back in, and the offer stayed gone — because SIGN-OUT IS NOT
     A REMOUNT. page.jsx keeps running, so a "session-only" flag outlives the session it
     belonged to, and outlives the teacher too: the next person to sign in on that tab
     inherited her dismissal. Exactly the defect A2 found in `everGeneratedRef` this
     morning, in different clothes — the standing rule from that fix is that ANY state
     holding a per-teacher answer must be keyed to the teacher. Keyed on `user` rather
     than added to onSignOut alone, because an identity can change without passing
     through it. */
  useEffect(() => {
    setCutoverDismissed(false);
    setCutoverResult(null);
    // Same rule, same reason: this ref answers "was the tour shown to HER this session".
    tourOfferedThisSession.current = false;
  }, [user]);
  useEffect(() => {
    if (!ready || !user) { setYearInfo(null); return; }
    let live = true;
    const read = () => getJSON("/academic-year")
      .then((y) => { if (live && y) setYearInfo(y); })
      .catch(() => {});
    read();
    const onWake = () => { if (document.visibilityState !== "hidden") read(); };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      live = false;
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  const runCutover = () => {
    setCutoverBusy(true);
    postJSON("/academic-year/cutover", { confirm: true })
      .then((res) => {
        setCutoverResult(res || null);
        /* Her year changed, so every year-scoped read is stale. The local section cache
           must be cleared EXPLICITLY: pullSectionState refuses to delete on a wholesale-
           empty server response (its anti-corruption guard), and after a cutover the new
           year is legitimately empty — without this, My Classes keeps reading "Teaching
           now Ch 5" out of the browser while the server has no such row. Found live. */
        clearLocalSectionCache();
        // …and the teaching ledger with it. The server cleared the year's ledger as part of
        // the cutover (a new cohort has taught nothing yet); this browser would otherwise
        // keep showing last cohort's trail on every card, because the pull UNIONS and so can
        // never delete a local row on its own.
        clearLocalHistoryCache();
        // She has just emptied her current year on purpose — she is emphatically not a
        // new teacher, so the first-gen heuristic must never re-arm on the way out.
        everGeneratedRef.current = true;
        latchUserRef.current = user;
        setFirstGenNeeded(false);
        return Promise.all([
          pullSectionState().catch(() => {}),
          getJSON("/academic-year").then((y) => y && setYearInfo(y)).catch(() => {}),
        ]);
      })
      .catch(() => setCutoverResult(null))
      .finally(() => setCutoverBusy(false));
  };

  /* paidScopes: the PAID teacher's subject-stage scopes (["social_sciences/middle"]),
     null when not paid / gate off / trial — TeachingProfile's choosers filter to these
     (§0: post-trial, only paid options are offered; the upsell line sits below the
     wheel). Trial and "*" grants see everything. */
  /* ★ Since 2026-08-26 these are the LIVE scopes, not every scope she has ever held:
     each subject-stage carries its own expiry, so one may have run out while another
     runs on. The server derives the list (`live_scopes`) — the client compares no
     dates, the same rule as `lapsed`. `e.scopes` is the fallback for an older API. */
  const [paidScopes, setPaidScopes] = useState(null);
  useEffect(() => {
    if (!ready || !user) {
      setEntLapsed(false); setEntTrial(false); setPaidScopes(null);
      return;
    }
    let live = true;
    const sync = () => fetchEntitlement().then((e) => {
      if (!live || !e) return;
      /* `lapsed` comes from the SERVER (2026-08-26) — revoked OR run out by date, one
         rule in one place. The status fallback keeps an older API honest. Both this and the
         scopes below now read the SHARED derivation (lib/format → @aruvi/shared), because the
         phone needs the same answer and had been going without it. */
      setEntLapsed(lapsedOf(e));
      /* ★ TRIAL IS WHAT HER RECORD SAYS, NOT WHETHER THE GATE IS ON (2026-09-11 — the
         2026-08-26 rule for `active`, now applied to its other half). This used to require
         `e.enforced`, so on the deployed API (enforcement OFF for the beta, by design) no
         teacher was ever "on trial": Subscription & billing offered no Subscribe button and
         Personal profile showed to a trial account — found by the founder on 9000000003.
         Enforcement decides what is REFUSED; the status decides what is TRUE. */
      setEntTrial(e.status === "trial" || e.plan_id === "trial");
      setPaidScopes(paidScopesOf(e));
    });
    sync();
    /* MID-SESSION REVOCATION lands fast (founder, 2026-08-24): re-check on focus /
       visibility (the founder revokes in a terminal, switches back to the phone) and
       on a light interval — same cadence idiom as the section-state sync. The server
       402s are the authority regardless; this keeps the UI honest within seconds. */
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
  }, [ready, user, entSyncTick]);

  /* LAPSED = the reading room (founder, 2026-08-24): only My Lessons (open, choose
     subject/class, export) + Settings (profile locked). A lapsed teacher standing on
     My Classes — including the moment a mid-session revoke lands — is moved to
     My Lessons; the My Classes tab itself hides below. */
  useEffect(() => {
    if (entLapsed && ready && editFlow === null) goLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entLapsed, ready, editFlow]);

  const settingsOriginRef = useRef(null);          // "lessonplans" | "profile" | null
  const [settingsView, setSettingsView] = useState("home");
  const [profileViaSettings, setProfileViaSettings] = useState(false);
  // Which document Settings › Legal shows ("agreement" | "privacy") — lifted here so the
  // privacy note below can open Legal ON the notice; the gear always opens the agreement.
  const [legalDoc, setLegalDoc] = useState("agreement");
  const goSettings = () => {
    if (editFlow !== "settings" && !profileViaSettings) settingsOriginRef.current = editFlow;
    setProfileViaSettings(false); setSettingsView("home"); setLegalDoc("agreement");
    setEditFlow("settings"); setTab("myplans"); setGenerateEntry(null);
  };

  /* ★ "THE PRIVACY NOTICE WAS UPDATED" — once per version, acknowledged not signed
     (2026-09-04). The notice is GIVEN (DPDP §5), so a new version is announced, never
     re-ticked: one quiet bar at the top of the shell, "Read it" opens Settings › Legal
     on the notice, "Dismiss" stamps the version as seen. Both stamp — a teacher who
     reads it has plainly seen it. The server decides `updated` by comparing the version
     on her account with the highest file on disk (`/legal/privacy/status`) — and ONLY
     a real bump counts: an account with no recorded version (every existing account)
     is silent (founder, same day: internal demo, no pop-up for existing users). Asked
     once per sign-in, not on a cadence: a notice changes a few times a year, and the
     bar is not the place for a version race with a founder mid-publish. */
  const [privacyNote, setPrivacyNote] = useState(null);
  useEffect(() => {
    if (!user) { setPrivacyNote(null); return; }
    let live = true;
    getJSON("/legal/privacy/status")
      .then((d) => { if (live && d && d.updated) setPrivacyNote(d); })
      .catch(() => {});     // an old server without the route shows nothing — never invents
    return () => { live = false; };
  }, [user]);
  const stampPrivacySeen = (context) => {
    setPrivacyNote(null);
    postJSON("/legal/privacy/seen", { context }).catch(() => {});
  };
  const readPrivacyNote = () => {
    goSettings(); setSettingsView("legal"); setLegalDoc("privacy");
    stampPrivacySeen("updated_note_read");
  };
  const openProfileFromSettings = () => {
    setProfileViaSettings(true); setProfileAutoAdd(null); setProfilePortal(null); setProfilePortalScope(null);
    setEditFlow("profile"); setTab("myplans"); setGenerateEntry(null);
  };
  /* ★ THE ✕ CLOSES THE ITEM THE BAR NAMES (founder, 2026-09-07). It used to close Settings
     ENTIRELY from anywhere inside it, so tapping ✕ on "⚙ Personal profile" landed her on My
     Classes — a screen she had not asked for and two taps from the list she came in by. The
     bar has named the chosen item since 2026-09-03 ("⚙ Support", "⚙ Teaching profile"), and
     the ✕ now agrees with it: close Personal profile → the Settings list; close Settings →
     the tab she was standing on at gear-press. Still ONE control in ONE slot — the 2026-08-24
     rule (no back-and-title pair; one titled row, one ✕) is untouched; what changed is that
     "close" is read against the named screen rather than against the whole of Settings. */
  const settingsClose = () => {
    // There is no account to go back TO — the ✕ is an exit from the product, not from a
    // screen (see onErased above). Checked FIRST, before every subview branch.
    if (erased) { onSignOut(); return; }
    // The teaching profile is reached THROUGH the list, so it closes back to it (it renders
    // under editFlow "profile", which is why this branch restores editFlow as well).
    if (editFlow === "profile" && profileViaSettings) {
      setProfileViaSettings(false); setSettingsView("home"); setLegalDoc("agreement");
      setEditFlow("settings"); setTab("myplans"); setGenerateEntry(null);
      return;
    }
    // Any other subview — Personal profile, Subscription, Your data, Support, About, Legal.
    if (editFlow === "settings" && settingsView !== "home") {
      setSettingsView("home"); setLegalDoc("agreement");
      return;
    }
    // The list itself: closing it leaves Settings for wherever she was at gear-press.
    setProfileViaSettings(false); setSettingsView("home");
    const o = settingsOriginRef.current;
    if (o === "lessonplans") goLessons();
    else if (o === "profile") goProfile();
    else goClasses();
  };
  const inSettingsBar = editFlow === "settings" || (editFlow === "profile" && profileViaSettings);
  /* What the bar says (2026-09-03): the chosen item's own card name, verbatim — the
     same words she tapped — so the bar reads as the card she opened. The teaching
     profile is reached through Settings but rendered by TeachingProfile, which is why
     it is decided here and not inside Settings.jsx. Unknown view → "Settings", never
     blank. */
  const settingsBarLabel = (editFlow === "profile" && profileViaSettings) ? "Teaching profile"
    : ({ personal: "Personal profile", subscription: "Subscription & billing",
         data: "Your data & export", support: "Support", about: "About Meyy",
         legal: "Legal" }[settingsView] || "Settings");
  // (The "add more classes in this subject" prompt that used to call in here was removed on
  // 2026-08-21 along with its one-time window — see the plusShow note in MyPlans.jsx. Nothing
  // sets `profileAutoAdd` to a subject any more, so TeachingProfile's `autoAddClassSubject`
  // is permanently null: its idle state, and the same value goProfile/onProfilePortal pass.
  // The state is kept because the auto-add flow it drives is still wired and may be re-used.)
  // From My Classes' standing "+" portal (founder, 2026-07-06): open the teaching profile with a
  // one-shot intent — "subject" | "class" | "section" | "ppw" | "budget" (the last two joined on
  // 2026-08-27) — and TeachingProfile launches the matching manage/edit screen (add AND remove,
  // same flows the gear uses). Consumed once, like profileAutoAdd.
  /* ★ AND IT EXITS BY THE DOOR IT CAME IN — which is the WINDOW (2026-08-27).
     "A portal visit always ends in My Classes" was written when My Classes was the portal's only
     door; the rule it encoded is "return her where she was". Two things broke that reading:
     the check window can now open over My Lessons, and — the founder's note — every row was a
     ONE-WAY door, so amending the section dropped her on her cards and she had to find the
     window again for the periods. So the ref remembers the tab AND the window descriptor, and
     goPortalHome restores both: the tab first, then the window over it. Cleared by goProfile,
     so a plain settings-gear visit is unaffected. */
  const portalOriginRef = useRef(null);   // { home: editFlow, win: portalWin } | null
  /* ★ A SCOPED VISIT (founder, 2026-08-27): "when this window pops up when a new subject is
     subscribed, only that subject should show — the previously settled subject need not be part
     of it." The added-a-subject window is ABOUT one subject·class, so its rows must not open on
     "In which subject?" listing everything she teaches. The scope travels with the intent and
     TeachingProfile routes straight past both pick screens. The "+" window carries no scope —
     it is the whole profile by definition — and neither does the tour's check window, which is
     asking about a set-up she has exactly one of. */
  const [profilePortalScope, setProfilePortalScope] = useState(null); // { subject, grade } | null
  /* ★ A SPOT EDIT IS A WINDOW OVER THE TAB SHE IS ON, NOT A PAGE INSTEAD OF IT (founder,
     2026-09-15: "the 'What would you like to change' window appears against the hazy background
     of My classes. But individual windows come up against blank background").
     The first windowing pass wrapped the profile in `.ap-overlay` but still routed through
     `editFlow = "profile"` — which renders the profile INSTEAD of the tab content, so the scrim
     was dimming an empty page. There was nothing behind it to haze. `editFlow` now stays exactly
     where she was and this renders BESIDE the main content, which is what the phone has done
     since the same day.
     ⚠️ It also retires `lessonsPaneIntentRef`: that ref existed only to put her back on the Year
     Plan pane after this flow navigated her away from My Lessons. She is not navigated away any
     more — the same mechanism, and the same deletion, as the phone's `lib/paneIntent`. */
  const [profileWin, setProfileWin] = useState(false);
  /* The window's ← corner, reported up by TeachingProfile (see its `winBack`). The window is
     THIS file's — the ✕ has always been drawn here — so its second corner is too, and the flow
     inside only says whether there is a previous step to go back to. Cleared by the effect's
     own cleanup when the flow unmounts, and again on goPortalHome for the case where the
     window closes without the child re-rendering first. */
  const [winChrome, setWinChrome] = useState(null);
  const onProfilePortal = (kind) => {
    portalOriginRef.current = { home: editFlow, win: portalWin };
    setProfilePortalScope(portalWin && portalWin.reason === "added"
      ? { subject: portalWin.subject, grade: portalWin.grade } : null);
    setPortalWin(null);
    setProfileAutoAdd(null); setProfilePortal(kind); setProfileWin(true);
  };
  /* ★ THE YEAR PLAN BUDGET PENCIL (founder, 2026-08-27) — the ONE control that had to move to
     where its number is used (administrative_architecture.md §5 Step 6, rule 1: "the annual
     budget belongs in Year Plan, beside the sentence that reads 'a budget of N periods' — the
     only place she has the context to judge it. It is currently read-only prose there").

     The distinction that makes this different from a portal row: the "+"/check window's budget
     row also reaches this screen, but from a window — she edits the total with no chapter list
     in front of her, changes it blind, comes back and looks. Here she is LOOKING at the split
     when she decides the total is wrong, and the pencil is beside the figure she is judging.

     ALWAYS SCOPED, and that is the whole point: Year Plan is already standing in one
     subject·class, so both pick screens ("In which subject?" / "Which class?") would be asking
     a question the screen has already answered. `win: null` because she came from a page, not
     a window — goPortalHome then restores only the tab.

     Coming back to the PLAN PANE rides the one-shot `lessonsPaneIntentRef` (pane persistence
     was retired 2026-08-29 — My Lessons now defaults to "Your lessons" on every ordinary
     visit): stamped here, consumed by the MyLessonPlans remount, cleared by goClasses. Without
     the stamp the return would land on the card list and the pencil becomes a one-way door —
     the thing the portal rows were just fixed for. */
  const onEditYearBudget = (subject, grade) => {
    portalOriginRef.current = { home: editFlow, win: null };
    lessonsPaneIntentRef.current = "plan";
    // `exact` — narrow to THIS class, not merely its stage (see portalGradeIdxs). Without it a
    // Science·Middle teacher tapping the pencil on Class 7's year plan would be asked whether
    // she meant 6, 7 or 8 — from the screen that is already showing 7's chapters.
    setProfilePortalScope(subject && grade ? { subject, grade, exact: true } : null);
    setPortalWin(null);
    setProfileAutoAdd(null); setProfilePortal("budget");
    setProfileWin(true);
  };
  const goPortalHome = () => {
    const o = portalOriginRef.current;
    /* Nothing navigates: the edit was a window over the tab, so leaving it is closing it. The
       `goLessons()/goClasses()` this used to do is exactly what made the background blank. */
    setProfileWin(false); setWinChrome(null);
    setProfilePortal(null); setProfilePortalScope(null);
    // Restored on EVERY ending, save and cancel alike: TeachingProfile funnels both through the
    // same setScreen("view"), and a teacher who has just amended one item is exactly the person
    // most likely to want the next. Closing the window is her explicit act (✕ / "Not now").
    if (o && o.win) setPortalWin(o.win);
  };
  /* The portal window's footer — "want to see your full teaching profile?" (founder, 2026-08-27).
     The five rows above it are spot edits; this is the panorama, so it opens the profile UNDER
     SETTINGS (the framed one, with the Settings bar and its ✕) rather than the bare accordion:
     she asked to SEE that everything is set correctly, and she can amend it directly there.
     Records the origin first, exactly as goSettings does, so the ✕ returns her to the tab she
     was standing on — My Lessons included, since this window now opens there too. */
  const openFullProfile = () => {
    if (editFlow !== "settings" && !profileViaSettings) settingsOriginRef.current = editFlow;
    openProfileFromSettings();
  };
  // Which centre tab lights up: My Lessons only when the repository is open; the profile
  // (settings) view lights neither; everything else — home cards, Generate — reads as My Classes.
  const activeNav = editFlow === "lessonplans" ? "lessons"
    : (editFlow === "profile" || editFlow === "settings") ? "none" : "classes";

  // Still restoring from localStorage — render nothing for a beat (no login flash).
  if (user === null) return null;
  // Not signed in → the portal.
  if (!user) return <Login onEnter={onEnter} />;
  // Signed in, but wait for GET /readiness to resolve before deciding first-run vs shell
  // (prevents an already-set-up teacher from flashing the guided first run).
  if (!readinessLoaded) return null;
  // Phase 1 gate (§0): no app shell until `ready` — a teacher with an existing (real,
  // server-persisted) readiness profile skips first-run; a brand-new teacher, OR one whose
  // profile was reset, gets the shell-less Guided First Experience until she completes it.
  // onPrepared / onPrepareError are page.jsx's OWN handlers, the same ones PrepareLesson uses:
  // first run fires the serve and hands off in the same tick, so the request resolves after
  // FirstRun has unmounted and must land on the shell's preparing card, not on a dead screen.
  if (!ready || firstGenNeeded) return <FirstRun user={user} onComplete={onFirstRunComplete}
                       onPrepared={onPrepared} onPrepareError={onPrepareError} onSignOut={onSignOut} />;

  /* The check window's sub-line — the ONE thing that differs between its two moments. It names
     what Aruvi ASSUMED, because that is the whole reason to ask: she never chose a section, a
     periods-per-week or a year's total, and she cannot check what she does not know was set. */
  const setupCheckSub = (() => {
    if (!portalWin || portalWin.mode !== "check") return null;
    const subs = (readiness && readiness.subjects) || [];
    /* ★ The added-a-subject line is SHORT, and it names the STAGE (founder, 2026-08-27). It first
       explained that Aruvi had started this class the way it started her first — a sentence and a
       half of reasoning above a list that already says what can be amended. Then it named the
       CLASS, which was the wrong unit: what she added is a subject-STAGE (that is the billing
       unit, and it is the scope this window's rows are filtered to), and the class is one of
       three inside it — the Class row exists precisely so she can say which ones she teaches. */
    if (portalWin.reason === "added") {
      return (
        <>You&rsquo;ve added <b>{portalWin.subject}</b>. <b>{pretty(stageOfGrade(portalWin.grade))} stage</b>.
          Amend any of these items below.</>
      );
    }
    // The tour ending keeps its fuller line: nothing here was ever her choice, so it says so.
    // "with 0 sections" is never a sentence worth showing — if the profile has moved under us,
    // fall back to naming the assumption without counting it.
    const tags = [];
    subs.forEach((s) => (s.grades || []).forEach((g) =>
      tags.push(...(((g && g.sections) || []).map((x) => x.tag)))));
    const phrase = !tags.length ? <>its own suggested set-up</>
      : tags.length === 1
        ? <>Section <b>{tags[0]}</b> and its own suggested periods for the year</>
        : <><b>{tags.length} sections</b> and its own suggested periods for the year</>;
    return (
      <>Meyy started you off with {phrase}. You can change any of it — or leave it and
        carry on teaching.</>
    );
  })();

  /* ★ THE CHECK WINDOW SHOWS ITS CURRENT VALUES (founder, 2026-08-27: "values only for first
     time including when new subject stage added, not during 'what would you like to change'
     rounds").

     Why this was missing and why it matters: the window's own title is "Would you like to check
     your set-up?" — and four bare nouns cannot be checked. She had to open each row to discover
     what Aruvi had chosen, which is four round trips to answer one glance-sized question.

     ★ NOT a sub-line. The rows deliberately carry no explanatory second line (ProfilePortal's
     ROWS note: five of them turned a glanceable list into a page and pushed the last row below
     the fold at 360px). A VALUE is different — it is short, and it sits right-aligned on the
     SAME line, before the chevron. Zero added height, so that decision stands untouched.

     ★ CHECK MOOD ONLY. The "+" window is unscoped by nature — it is the whole profile — so a
     teacher with three subjects would see "6, 7, 8" or a blank against Class, which is noise on
     a row she is using to navigate. In check mood the scope is always known: the tour ending is
     her single set-up, and the added-a-subject window is filtered to one subject·stage.

     Returns null when there is nothing safe to say — a missing value renders NOTHING rather than
     a guess or a zero. A window asking whether Aruvi got her set-up right must not itself invent
     an answer about her record (the Support screen's `metaErr` lesson, 2026-08-27). */
  const setupCheckValues = (() => {
    if (!portalWin || portalWin.mode !== "check") return null;
    const subs = (readiness && readiness.subjects) || [];
    // Scope: the added-a-subject window names its subject·stage; the tour ending is whatever
    // single set-up she has. Narrow to one subject when we can, else use the whole profile —
    // which at the tour ending IS one subject.
    const scoped = portalWin.reason === "added" && portalWin.subject
      ? subs.filter((s) => s.name === portalWin.subject) : subs;
    const stage = portalWin.reason === "added" && portalWin.grade
      ? stageOfGrade(portalWin.grade) : null;
    const grades = [];
    scoped.forEach((s) => (s.grades || []).forEach((g, gi) => {
      if (!stage || stageOfGrade(g.grade) === stage) grades.push({ s, g, gi });
    }));
    if (!grades.length) return null;

    const list = (xs) => (xs.length > 3 ? `${xs.slice(0, 3).join(", ")}…` : xs.join(", "));
    const uniq = (xs) => [...new Set(xs.filter((x) => x != null && x !== ""))];

    const classes = uniq(grades.map(({ g }) => classNum(g.grade)));
    const sections = uniq(grades.flatMap(({ g }) => ((g && g.sections) || []).map((x) => x.tag)));
    const ppws = uniq(grades.map(({ g }) => g.periods_per_week));
    /* Read through annualBudgetPeriods — the SAME function Year Plan displays from — rather than
       off `subject.budget[gi]` directly. That record holds a method (periods | weeks | days) and
       is absent entirely when the budget is still the auto estimate, so a direct read would show
       nothing for most teachers and a raw week-count for some. Two screens quoting different
       annual totals for one class is worse than a window that stays quiet. */
    const budgets = uniq(grades.map(({ s, g }) =>
      annualBudgetPeriods(readiness, (s.name || "").toLowerCase().replace(/ /g, "_"),
                          (g.grade || "").toLowerCase())));

    return {
      class: classes.length ? list(classes) : null,
      section: sections.length ? list(sections) : null,
      // One shared figure reads as fact; several classes disagreeing is not a value to show.
      ppw: ppws.length === 1 ? `${ppws[0]} a week` : null,
      budget: budgets.length === 1 ? `${budgets[0]} periods` : null,
    };
  })();

  return (
    <>
      {/* ONE FIXED top bar (2026-08-08). Two histories are baked into this element:
          (a) the brand row and the tab row used to be two INDEPENDENT sticky siblings — .hdr at
              top:0 and .main-tabs at top:var(--hdr-h) — so nothing tied them together and the
              tab row could stay frozen while the Aruvi row scrolled away behind it. Both rows
              are now STATIC inside this one wrapper; they can only move as a unit.
          (b) the wrapper was then `position: sticky`, and on an iPhone home-screen (standalone)
              web app it still scrolled away — the brand row simply left with the content and
              came back on returning to the top, i.e. sticky was not taking effect at all for a
              direct child of <body> in that webview. It was made `position: fixed` + spacer —
              and the webview scrolled THAT away too.
          (c) so scroll ownership moved off the document entirely (2026-08-09): when the shell
              is up, html.app-shell (globals.css) locks html/body and .bodycontent is the one
              scroll container — this bar is plain static flow and cannot move. The fixed rule
              in .topbar still applies pre-lock and is harmless; the spacer is display:none in
              shell mode. Do not "simplify" any of this back to sticky or fixed-on-document.
          (--hdr-h/--nav-h are still published — inner views use them for their own offsets.) */}
      <div className="topbar">
      {/* Shell header: the brand exactly as the first-run page renders it (the MEYY wordmark —
          MeyyMark.jsx, 2026-09-03 — LESSON STUDIO tag beneath); settings gear (→ teaching
          profile) + log out right. No hamburger, no drawer — the two tabs below the header
          are the whole nav. */}
      <header className="hdr">
        <div className="brand">
          <MeyyMark />
          <span className="hdr-brand-tag">lesson studio</span>
        </div>
        <div className="hdr-user">
          {/* ONE icon (founder, 2026-08-24 final — fewer buttons): the gear opens
              Settings, and the PROFILE is Settings' top card. ThemeToggle lives in
              Settings › App › Appearance. The tour's profile step keeps this anchor —
              the profile is reached through here. */}
          <button className="hdr-gear" onClick={goSettings} aria-label="Settings"
            title="Settings" data-tour="settings-gear">⚙</button>
          {/* rightmost: profile name stacked over its own log out */}
          <div className="hdr-user-id">
            <span className="hdr-user-name">{displayName || user}</span>
            <button className="hdr-user-logout" onClick={onSignOut}>Log out</button>
          </div>
        </div>
      </header>

      {/* ★ THE PRIMARY NAV MOVED TO THE FOOT (founder, 2026-09-13) — see .bnav below the
          scroll region. The top bar keeps only the brand row, plus the frozen Settings bar
          while she is in Settings (or the profile reached through it): title left, ✕ right.
          The ✕ closes whatever the bar NAMES — a subview back to the Settings list, the list
          back to where she came from (2026-09-07). */}
      {inSettingsBar && (
        <nav className="tabs main-tabs set-bar" aria-label="Settings">
          {/* ★ THE BAR NAMES THE CHOSEN ITEM, NOT THE MENU (founder, 2026-09-03: "why
              should the word Settings take so much real estate"). The gear is the
              "you are in Settings" mark; beside it sits the name of the screen she is
              actually on — "⚙ Support", "⚙ Teaching profile" — and the screen below
              carries NO heading of its own. "Settings" appears only at the home list,
              where it is the item. This is what removed every subview's frozen title:
              a fixed bar naming the screen makes a second sticky row naming it again
              pure cost, on a phone most of all. ✕ right closes the named screen. */}
          <span className="set-bar-title">
            <span className="set-bar-gear" aria-hidden="true">⚙</span>{settingsBarLabel}
          </span>
          {/* The ✕ closes the item the bar NAMES — a subview back to the Settings list, the
              list itself back to origin (see settingsClose) — so the label says which. */}
          <button className="set-bar-x" onClick={settingsClose}
            aria-label={`Close ${settingsBarLabel}`}>✕</button>
        </nav>
      )}
      </div>
      {/* reserves the fixed bar's height in the flow — see the .topbar comment above */}
      <div className="topbar-spacer" aria-hidden="true" />

      <div className="bodycontent">

        <main>
          {/* Shown only on a VERIFIED mismatch — the server was read back and disagrees with
              what she just set up. Never on a throw, never when the server could not be
              reached. `ready` and the profile above have already been re-synced to what is
              actually stored, so this is a caption for the screen she is now looking at. */}
          {saveFailed && (
            <div className="tp-savefail" role="alert">
              <span>Your teaching set-up didn’t save — this is what Meyy has for you.</span>
              <button type="button" onClick={() => setSaveFailed(false)}>Dismiss</button>
            </div>
          )}
          {sectionFailed && (
            <div className="tp-savefail" role="alert">
              <span>{sectionFailed}</span>
              <button type="button" onClick={() => setSectionFailed("")}>Dismiss</button>
            </div>
          )}
          {/* The privacy-notice bar (see `privacyNote` above). Not an alert — nothing
              is wrong — so it wears its own quiet class, not `.tp-savefail`'s. Hidden
              inside Settings › Legal itself, where it would sit above the very
              document it points at. */}
          {/* ★ THE SPOT-EDIT WINDOW, over whatever tab is rendered below (founder, 2026-09-15).
              It sits OUTSIDE the editFlow ternary on purpose: `editFlow` is untouched by a portal
              visit now, so the tab she was on is still mounted and still painted, and the scrim
              has something to haze. That was the whole bug — the overlay was real, the page
              behind it was not. */}
          {profileWin && ready && (
            <div className="ap-overlay tp-window" data-tour="profile-root"
              onClick={(e) => { if (e.currentTarget === e.target) goPortalHome(); }}>
              <div className={`ap-modal tp-window-card${winChrome && winChrome.onBack ? " tp-window-back" : ""}`}
                onClick={(e) => e.stopPropagation()}>
                {/* The ✕ is the way out, from every step — the footer links inside the flow are
                    the phone's `fr-link` equivalents and cost a row of a card whose height is the
                    standing problem (founder, 2026-09-15). */}
                {/* ★ ← ONLY WHERE A STEP HAS A PREVIOUS ONE (2026-09-15). The duration step is
                    reached THROUGH periods-a-week, and since `2d7ac21d` hid the footer links in
                    here its "← Back" went with them — leaving Save or abandon as the only two
                    answers. The phone grew this corner in that same commit; the web is catching
                    up. `winChrome.onBack` is null on every other step, so nothing is painted. */}
                {winChrome && winChrome.onBack && (
                  <button className="ap-back" aria-label="Back" onClick={winChrome.onBack}>←</button>
                )}
                <button className="ap-close" aria-label="Close" onClick={goPortalHome}>✕</button>
                <TeachingProfile readiness={readiness} onChange={setReadiness}
                  onBack={goPortalHome} lapsed={entLapsed} paidScopes={paidScopes}
                  autoAddClassSubject={null} onConsumeAutoAdd={() => {}}
                  portalIntent={profilePortal} onConsumePortal={() => setProfilePortal(null)}
                  portalScope={profilePortalScope}
                  onChrome={setWinChrome}
                  onSubscribe={() => setSubscribeOpen(true)} />
              </div>
            </div>
          )}
          {privacyNote && !(editFlow === "settings" && settingsView === "legal") && (
            <div className="pn-note" role="status">
              <span>Meyy&rsquo;s Privacy Notice has been updated (version {privacyNote.current_version}).</span>
              <span className="pn-note-acts">
                <button type="button" className="pn-note-read" onClick={readPrivacyNote}>Read it</button>
                <button type="button" onClick={() => stampPrivacySeen("updated_note_dismissed")}>Dismiss</button>
              </span>
            </div>
          )}
          {/* Edit-flow views (My Lessons / teaching profile) require a set-up profile. A
           * not-ready user is always routed to the setup flow instead of a dead-end empty
           * view — readiness gates these the same way it gates Generate. */}
          {(editFlow === "lessonplans" && ready) ? (
            /* My Lessons — the plan repository (subject → grade → chapter). */
            <div className="editflow">
              <MyLessonPlans readiness={readiness} onAllocate={onAllocateScoped} onOpenSection={onOpenSection}
                tourStep={tour} preparing={preparingCard} lapsed={entLapsed} yearInfo={yearInfo}
                onStartTour={tourOnOffer ? startTour : undefined} tourActive={!!tour}
                onScope={onLessonsScope} onEditYearBudget={onEditYearBudget}
                paneIntent={lessonsPaneIntentRef}
                onDismissPrepareError={onDismissPrepareError} />
            </div>
          ) : (editFlow === "profile" && ready) ? (
            /* Teaching profile via SETTINGS — the panorama. She asked to SEE the whole thing, so
             * this one keeps the page. A spot edit from the "+" window or the Year Plan pencil is
             * a different act and renders as a window below, over whatever tab she was on. */
            <div className="editflow" data-tour="profile-root">
              <TeachingProfile readiness={readiness} onChange={setReadiness}
                onBack={null} lapsed={entLapsed} paidScopes={paidScopes}
                autoAddClassSubject={profileAutoAdd} onConsumeAutoAdd={() => setProfileAutoAdd(null)}
                portalIntent={null} onConsumePortal={() => setProfilePortal(null)}
                portalScope={null}
                onSubscribe={() => setSubscribeOpen(true)} />
            </div>
          ) : (editFlow === "settings" && ready) ? (
            <div className="editflow">
              <Settings view={settingsView} setView={setSettingsView}
                legalDoc={legalDoc} setLegalDoc={setLegalDoc}
                onAccountSaved={() => setEntSyncTick((n) => n + 1)}
                onOpenProfile={openProfileFromSettings} syncTick={entSyncTick}
                trial={entTrial}
                onSubscribe={() => setSubscribeOpen(true)}
                onAsk={() => setAskOpen(true)} onSignOut={onSignOut} onErased={onErased} />
            </div>
          ) :
            !subject ? <div className="empty">Connecting to the Meyy engine…</div> :
            tab === "generate" ? <GenerateTab subject={subject} grade={grade} ready={ready} readiness={readiness}
              onNavigate={setTab} onBack={goLessons} entry={generateEntry} onScope={(s, g) => { setSubject(s); setGrade(g); }}
              onConsumeEntry={() => setGenerateEntry(null)} onPrepared={onPrepared}
              onPreparing={onPreparing} onPrepareError={onPrepareError} onPaywall={onPaywall} /> :
            <MyPlans subject={subject} grade={grade} ready={ready} readiness={readiness}
              onReady={onReadyComplete} onNavigate={setTab} onEnterGenerate={onEnterGenerate}
              user={displayName || user} onSignOut={onSignOut} lapsed={entLapsed}
              pendingOpen={pendingOpen} onConsumePending={() => setPendingOpen(null)}
              pendingAttach={pendingAttach} onConsumeAttach={() => setPendingAttach(null)}
              preparingCard={preparingCard}
              preparingSection={prepareReturn ? prepareReturn.sectionTag : null}
              onDismissPreparing={() => setPreparingCard(null)}
              onStartTour={tourOnOffer ? startTour : undefined}
              tourActive={!!tour} tourStep={tour}
              onTourInfo={setTourInfo} onOpenPortal={() => setPortalWin({ mode: "change" })}
              yearInfo={yearInfo} onCutover={runCutover} cutoverBusy={cutoverBusy}
              cutoverResult={cutoverResult} onDismissCutoverResult={() => setCutoverResult(null)}
              cutoverDismissed={cutoverDismissed} onDismissCutover={() => setCutoverDismissed(true)}
              sectionCheck={!!portalWin && portalWin.reason === "tour"} />}
        </main>
      </div>

      {/* ★ BOTTOM NAV (founder, 2026-09-13: "switch My Classes / My Lessons, Ask Meyy and the
          big plus to the bottom"). The app's ENTIRE nav, now a static bar at the FOOT of the
          app-shell flex column, below the one scroll container (.bodycontent) — so, like the
          top bar, it is plain flow that cannot scroll away. Four items, icon over an uppercase
          mono label, the active one in clay: My Classes · My Lessons · Add (the standing "+"
          portal, formerly in the My Classes greeting row) · Ask Meyy. Chosen skin (bottom-nav
          mock, option A + edge 4): sunk paper, a 1 px --edge top edge — the same weight as the
          clay rule between lesson phases, which is why the last phase drops its own rule
          (.uv-phase:last-child) — and no rule under the bar.
          ★ IT IS UP ON EVERY SCREEN, SETTINGS INCLUDED (founder, 2026-09-14). It used to hide
          behind the frozen Settings bar on the reasoning that Settings is a modal room and the ✕
          is its only exit. Struck for the same reason as Ask Meyy's scrim the day before: the
          nav is the app's nav, and a screen that takes it away leaves exactly one way out of
          itself. The ✕ still closes what the bar NAMES; the bottom bar is simply also there, and
          `activeNav` lights NOTHING in Settings, so the bar says "you are somewhere else"
          without pretending Settings is one of its four places.
          This bar carries to Expo as-is (CLAUDE.md §4, match-the-web): the same four items,
          the same measures in mobile/theme/web.js. */}
      {/* ★ THE BAR STAYS UP BEHIND ASK MEYY (founder, 2026-09-13). Its scrim used to run to the
          foot of the screen, so opening Ask Meyy took the app's ENTIRE nav away and the panel's
          own ✕ was the only way out — the one screen she could not simply leave. The scrim now
          stops at --bnav-h, which means the bar is not merely VISIBLE but live, so each item has
          to say what it does to an open panel: the three destinations close it and go, and Ask
          Meyy itself toggles. While it is open Ask Meyy carries the clay, and My Classes / My
          Lessons do not — the panel is where she is. */}
      <nav className="bnav" aria-label="Primary">
          <div className="bnav-in">
            {/* Lapsed hides My Classes — tracking is a productivity tool she has let go;
                the reading room is My Lessons (§2.5 as amended). */}
            {!entLapsed && (
            <button className={`bnav-item ${activeNav === "classes" && !askOpen ? "active" : ""}`}
              onClick={() => { setAskOpen(false); goClasses(); }}
              data-tour="nav-classes">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5" /></svg>
              <span>My Classes</span>
            </button>
            )}
            <button className={`bnav-item ${activeNav === "lessons" && !askOpen ? "active" : ""}`}
              onClick={() => { setAskOpen(false); goLessons(); }}
              data-tour="nav-lessons">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h11l5 5v11H4z" /><path d="M15 4v5h5M8 13h8M8 17h6" /></svg>
              <span>My Lessons</span>
            </button>
            {/* The standing "+" portal — "what would you like to change?" (ProfilePortal, change
                mood). `!entLapsed`: an expired subscription hides the growth portal (§2.5 as
                amended; the server 402s regardless). Unlike its old greeting-row seat it does
                NOT hide during the tour — a nav item that vanishes shifts the bar; step 16 rings
                it here instead. Its glyph is the ringed plus with four dots ("grow in every
                direction", founder 2026-07-06). */}
            {ready && !entLapsed && (
            <button className="bnav-item" data-tour="grow-add"
              onClick={() => { setAskOpen(false); setPortalWin({ mode: "change" }); }}
              aria-label="Add or change subjects, classes, or sections" title="Add or change what you teach">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="5.9" strokeWidth="1.5" />
                <path d="M12 8.9v6.2M8.9 12h6.2" strokeWidth="2.1" />
                <circle cx="12" cy="3.3" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="12" cy="20.7" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="3.3" cy="12" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="20.7" cy="12" r="1.4" fill="currentColor" stroke="none" />
              </svg>
              <span>Add</span>
            </button>
            )}
            {/* Ask Meyy — opens the deterministic Q&A screen. The stream-a mark with its red dot. */}
            <button className={`bnav-item ${askOpen ? "active" : ""}`}
              onClick={() => setAskOpen((v) => !v)}
              aria-label="Ask Meyy" title="Ask Meyy" data-tour="ask-aruvi">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 6.5c6 1 6 5 3.5 7.5S6 18 6 18" />
                <path d="M10.5 14c3.5 0 5.5-1.8 6.5-4" />
                <circle cx="17.3" cy="8.6" r="1.6" fill="#c0392b" stroke="none" />
              </svg>
              <span>Ask Meyy</span>
            </button>
          </div>
      </nav>

      {/* First-run guided tour overlay — 17 guide-driven steps ("N of 17", Back on every one).
          Skip closes it for this session. */}
      {tour && (
        <GuidedTour step={tour} info={tourInfo} onNext={tourNext} onBack={tourBack} onSkip={finishTour} />
      )}

      {/* ★ THE ONE PORTAL WINDOW — "what would you like to change?" (the "+") and "would you
          like to check your set-up?" (the tour's end, and the first use of a subject·class she
          has added) are one component in two moods. It renders HERE, at shell level, and not
          inside MyPlans as the "+" chooser did, for two reasons: its check mood lands on My
          Lessons, and it must survive a round trip into the profile so every row can come back
          to it. Never over the tour (all triggers exclude it); never for a lapsed subscription,
          which hides the growth surfaces altogether (§2.5 as amended — the server 402s
          regardless). */}
      {portalWin && ready && !entLapsed && (
        <ProfilePortal mode={portalWin.mode} sub={setupCheckSub} values={setupCheckValues}
          onPick={(kind) => onProfilePortal(kind)}
          onClose={() => setPortalWin(null)}
          onOpenProfile={() => { setPortalWin(null); openFullProfile(); }} />
      )}

      {/* Ask Aruvi Q&A — full-screen deterministic helpline (browse + keyword search). */}
      {/* autoFocus off while the tour drives: step 19 opens this panel to SHOW it, and a
          focused search box raises the phone keyboard over the step's own window. */}
      {askOpen && <AskAruvi onClose={() => setAskOpen(false)} autoFocus={tour == null} />}
      {subscribeOpen && (
        <div className="subflow-overlay">
          <SubscribeFlow userId={user}
            onDone={() => {
              setSubscribeOpen(false);
              setEntSyncTick((t) => t + 1);
              /* Checkout also rewrote her PROFILE server-side (every purchased scope
                 becomes a default card; trial artifacts dropped) — rehydrate it so the
                 new cards appear without a reload. */
              getJSON("/readiness").then((d) => {
                if (d && d.ready && d.readiness) {
                  setReadiness(projectReadiness(d.readiness));
                  setReady(true);
                }
              }).catch(() => {});
            }}
            onCancel={() => setSubscribeOpen(false)} />
        </div>
      )}
      {paywall && (
        <div className="paywall-bg" onClick={() => setPaywall(null)}>
          <div className="paywall-card" onClick={(e) => e.stopPropagation()}>
            {/* Kicker matches WHICH wall she hit (founder, 2026-08-24): the server's
                sentence is the source of truth, so the heading is read off it —
                trial exhaustion · lapsed/revoked subscription · out-of-scope subject. */}
            <div className="kicker kicker-soft">{
              /free trial/i.test(paywall) ? "Free trial ends"
                : /different subject/i.test(paywall) ? "Separate subscription"
                : "Subscription ended"
            }</div>
            <div className="paywall-msg">{paywall}</div>
            <button className="paywall-subscribe"
              onClick={() => { setPaywall(null); setSubscribeOpen(true); }}>
              Subscribe
            </button>
            <button className="paywall-later" onClick={() => setPaywall(null)}>
              Not now
            </button>
          </div>
        </div>
      )}

    </>
  );
}
