/* The signed-in shell. Step 2 holds one screen; step 3 puts LessonView here and the BOTTOM NAV
 * (founder, 2026-09-13) at the foot of every signed-in screen; step 4 gives My Lessons its own
 * destination (4b, /lessons) and the "+" portal its own (step 5). Redirects to the front door when there is no user, so a
 * deep link cannot land inside without an identity.
 *
 * The nav is the web's `.bnav`, ported item for item (components/BottomNav.jsx, measures in
 * theme/web.js) — CLAUDE.md §4, the phone matches the web. Which item lights up follows the
 * web's `activeNav` exactly: My Lessons only when the repository is open; everything else —
 * the class cards, a lesson opened from them — reads as My Classes; Settings lights neither
 * and hides the bar entirely (its screen arrives in step 6). */
import { useEffect, useRef, useState } from "react";
import { AppState, BackHandler, View } from "react-native";
import { Redirect, Stack, useGlobalSearchParams, useRouter, usePathname } from "expo-router";
import { getJSON, getUser, postJSON } from "@aruvi/shared/format";
import { pullSectionState, setSectionMismatchHandler } from "@aruvi/shared/sectionState";
import { refreshBank } from "@aruvi/shared/ask-aruvi/bank";
import { cachedReadiness, cachedReady, fetchReadiness, subscribeReadiness } from "@aruvi/shared/readiness";
import { entitlementState, subscribeEntitlement, syncEntitlement } from "@aruvi/shared/entitlement";
import { fetchYear } from "@aruvi/shared/year";
import { useTheme } from "../../theme/ThemeContext";
import Bar from "../../components/Bar";
import BottomNav from "../../components/BottomNav";
import SettingsBar, { settingsLabel } from "../../components/SettingsBar";
import { SectionFailedBar, PrivacyNoteBar } from "../../components/Notices";
import ProfilePortal, { portalChrome, SetupCheckSub } from "../../components/ProfilePortal";
import ProfileEditor from "../../components/ProfileEditor";
import ProfilePick from "../../components/ProfilePick";
import { resolvePortalPick } from "@aruvi/shared/profile";
import { firstGenNeeded, hasActivated } from "../../lib/firstRun";
import {
  pruneSetupCheck, queueSetupCheck, setupCheckAdds, setupCheckSub, setupCheckValues, setupKey,
} from "@aruvi/shared/setupCheck";
import { subscribePortal, setPortalWin, enterPortal, openEdit, closeEdit, editBackToPick,
         openPick, pickSubject, pickBackToSubject, closePick, clearPortal } from "../../lib/portal";
import { Sheet } from "../../components/AttachSheet";
import AskMeyy from "../../components/AskMeyy";
import GuidedTour from "../../components/GuidedTour";
import { useTour, tourNext, tourBack, tourSkip, useTourOverlayHost } from "../../lib/tour";
import { closeAsk, subscribeAsk, toggleAsk } from "../../lib/ask";

export default function AppLayout() {
  const { t } = useTheme();
  const router = useRouter();
  const pathname = usePathname() || "/";
  /* A document opened from Settings (an invoice, her data export) rides `from: "settings"` so the
     preview lights nothing in the bar, as Settings itself does. */
  const fromSettings = useGlobalSearchParams().from === "settings";
  /* ⚠️ The subscription sits ABOVE the sign-in redirect below, because hooks may not follow a
     conditional return — the lesson `MyLessonPlans.jsx` taught this repo the hard way on
     2026-09-14 ("Rendered fewer hooks than expected"). */
  const [win, setWin] = useState(null);
  const [edit, setEdit] = useState(null);
  /* The pick screens (5d item 3) — `{ goal, subject }`, the second field filled once she has
     answered the first question. Held here with `win`/`edit` because all three are bodies of the
     ONE Sheet this layout owns. */
  const [pick, setPick] = useState(null);
  const [scope, setScope] = useState(null);
  /* Whether the open edit was reached THROUGH a pick screen — i.e. whether there is a question
     behind it to step back to. See the window's ← below. */
  const [pickBack, setPickBack] = useState(null);
  /* ★ ANDROID'S BACK INSIDE THE APP (WALK-A-035, 2026-09-20 — the web's WALK-A-008 rule). It did
     nothing at all. Now: an open window closes first; then the Stack pops (a lesson, a Settings
     screen, a preview); then any other tab returns to My Classes; at My Classes it leaves.
     First run is a separate route that was REPLACED, so Back can never reach it. Screens that own
     their own Back (Ask Meyy, the tour) register later and so run first. */
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (win || edit || pick) { setWin(null); setEdit(null); setPick(null); return true; }
      if (router.canGoBack()) { router.back(); return true; }
      if (pathname !== "/" && pathname !== "/(app)") { router.replace("/(app)"); return true; }
      return false;
    });
    return () => sub.remove();
  }, [win, edit, pick, pathname, router]);
  /* What the open edit needs from the window's chrome — today just its ← , which exists only on
     the duration step. Reported up by the editor, because the Sheet is owned here. */
  const [editChrome, setEditChrome] = useState(null);
  useEffect(() => subscribePortal((p) => {
    setWin(p.win); setEdit(p.edit); setPick(p.pick); setScope(p.scope); setPickBack(p.pickBack);
  }), []);

  /* ── the check window's queue: every add, watched in ONE place (app. 01 row 72) ──────────
     A subject·class KEY that appears in her profile where it was not before IS an add, whichever
     door it came through — the portal's class screen, a subscribe flow that widens her scope, a
     change she made on the web. Watching the profile rather than each add path is what makes that
     true; wiring the doors one by one is how a door gets missed.
     ★ THE FIRST PROFILE SEEDS THE BASELINE AND QUEUES NOTHING: a teacher signing in with twelve
     classes must not be handed twelve pending questions, and a brand-new teacher's first subject
     belongs to the tour's own prompt, not to this one.
     ⚠️ Keyed by USER — a sign-out leaves the baseline behind, and the next teacher on this device
     must never have the previous one's profile diffed against hers.
     ⚠️ The phone needs a SUBSCRIPTION where the web needs none: `readiness` is page state there
     and a module store here, so nothing re-renders on a write unless the store says so. */
  const [readiness, setReadiness] = useState(() => cachedReadiness());
  useEffect(() => subscribeReadiness(setReadiness), []);
  const setupKeysRef = useRef({ user: null, subjects: null });
  useEffect(() => {
    const who = getUser();
    if (setupKeysRef.current.user !== who) setupKeysRef.current = { user: who, subjects: null };
    if (!readiness || !cachedReady()) return;
    const keys = [];
    (readiness.subjects || []).forEach((s) =>
      (s.grades || []).forEach((g) => keys.push(setupKey(s.name, g.grade))));
    const prev = setupKeysRef.current.subjects;
    setupKeysRef.current = { user: who, subjects: readiness.subjects || [] };
    if (!prev) return;                                   // baseline only
    /* ★ Only a SUBSCRIPTION's defaults earn the question (founder, 2026-09-18): a class she added
       herself to a subject already in her profile — even one she had emptied — asks nothing. */
    const added = setupCheckAdds(prev, readiness.subjects || []);
    if (added.length) queueSetupCheck(added);
    pruneSetupCheck(keys);        // self-heal: nothing she does not teach stays queued
  }, [readiness]);

  /* ── HER SUBSCRIPTION, AND WHAT IT HIDES (6a F5; founder's Q7 answer, 2026-09-16) ──────
     ★ "Port now and let the server flag drive it." Enforcement is OFF on Render, so no teacher
     is lapsed today and every consequence below is dormant. That is the point: the alternative
     was a phone that quietly disagrees with the web for however long the beta runs, and a list
     of consequences to remember on the day the flag is flipped.

     ★ POLLED, WHERE READINESS IS CACHED (entitlement.js says why at length). A subscription can
     be revoked in a terminal while she is looking at the screen — the founder does exactly this
     and switches back to the phone to watch. So: on mount, whenever the app returns to the
     foreground, and every 20 seconds while it is there, which is the web's own cadence.
     ⚠️ The timer runs only while ACTIVE. A phone in a pocket polling every 20 seconds is a
     battery complaint, and a backgrounded app has no screen that could be lying.
     ⚠️ A 401 signs her out through the ONE door (`lib/session`), as every other fetch here does;
     a refused session must not be papered over with a stored subscription. */
  const [ent, setEnt] = useState(() => entitlementState());
  useEffect(() => subscribeEntitlement(setEnt), []);

  /* ── ASK MEYY (6c) ─────────────────────────────────────────────────────────────────────
     The web's `askOpen`, which lives in `page.jsx` because everything that opens the panel is a
     child of it. Here the bar is in the shell and the two cards that also open it (Settings ›
     Help, Support › Ask Meyy) are ROUTES inside the Stack, with nothing above them to thread a
     prop through — so the flag is a module store (`lib/ask`) and this subscribes to it.
     `barH` is the phone's `--hdr-h`, and the web says in as many words what that is: "the brand
     row's underside (AskAruvi's scrim hangs off this)" (page.jsx:301). So the panel starts under
     the BRAND BAR and covers everything below it — the Settings bar and any notice included,
     exactly as the web's scrim covers its tab row.
     ⚠️ AND THAT IS NOT A DETAIL. Left under the Settings bar, the panel put TWO ✕ on the screen
     at once — one saying "Support", one saying "Ask Meyy" — and the top one would have closed the
     screen UNDERNEATH, leaving the help hanging over a screen it was never opened from. Measured
     rather than taken from `BAR_CONTENT_H`, because the bar's height includes a safe-area inset
     that differs by handset. */
  const [askOpen, setAskOpen] = useState(false);

  /* ───────── THE GUIDED TOUR (step 8b) ─────────
     ★ THE SHELL ONLY DRAWS IT NOW. Next, Back, Skip and the seven route changes moved to
     `lib/tour.js` on 2026-09-17, because the attach picker is a `Modal` — its own native window,
     above everything — so at steps 9 and 15 an overlay rendered HERE could never appear over it,
     and Next was unreachable for three walks running. Only a component inside that Modal can draw
     above it, and it can only advance the tour if advancing is something any screen may call.
     ⚠️ AND ONLY ONE PLACE DRAWS IT AT A TIME (`useTourOverlayHost`). While the sheet is up it
     claims the job; two overlays would double the scrim and stack two tips. */
  const tour = useTour();
  const overlayHost = useTourOverlayHost();
  useEffect(() => subscribeAsk(setAskOpen), []);
  const [barH, setBarH] = useState(0);
  useEffect(() => {
    let live = true;
    let iv = null;
    /* ⚠️ THE YEAR RIDES THE SAME CADENCE, and that is not laziness — it is the web's own
       pairing: both are server-decided facts that can turn while she is looking at the screen,
       and both are re-read on focus there. It also means the plan store learns the current year
       (`notePlansYear`, inside `fetchYear`) wherever she lands, not only on My Classes. */
    const sync = () => {
      if (!live) return;
      /* ⚠️ NO sign-out handler here. A 20-second heartbeat must not be able to end her session —
         see the note in `shared/entitlement`. The screens' own fetches still do, on a refusal
         she is actually waiting for. */
      syncEntitlement();
      fetchYear();
    };
    const start = () => { sync(); if (!iv) iv = setInterval(sync, 20000); };
    const stop = () => { if (iv) { clearInterval(iv); iv = null; } };
    start();
    const sub = AppState.addEventListener("change", (st) => (st === "active" ? start() : stop()));
    return () => { live = false; stop(); sub.remove(); };
  }, []);

  /* ── THE NOTICES SLOT (6a F10; app. 01 rows 43, 44, 24) ────────────────────────────────
     What the APP has to say, as opposed to what a screen has. `components/Notices.jsx` carries
     the reasoning for each; what lives here is the state, because each is true of the whole
     shell and there must be exactly one of it.

     ⓵ A VERIFIED SECTION MISMATCH. `pushSectionState` reads the server back and calls this only
     when it DISAGREES — never on a throw, never when unreachable, because those are "we cannot
     tell" and not "it failed". ★ The phone had never installed the handler, so a disagreement
     about the chapter she just attached, or the unit she just completed, was SILENT here while
     the web said one sentence about it. Re-pull first so the cards show the truth, THEN speak —
     a caption for a corrected screen, not a floating alert about one that still lies. */
  const [sectionFailed, setSectionFailed] = useState("");
  useEffect(() => {
    setSectionMismatchHandler((sectionKey) => {
      pullSectionState([sectionKey]).finally(() => {
        setSectionFailed("That didn’t save — your classes are as Meyy has them.");
      });
    });
    return () => setSectionMismatchHandler(null);
  }, []);

  /* ⓶ THE PRIVACY NOTICE WAS UPDATED — asked ONCE PER SIGN-IN, not on a cadence. A notice
     changes a few times a year, and this bar is not the place for a version race with a founder
     mid-publish. An old server without the route shows nothing: it never invents an update.
     ✅ "Read it" goes to **Settings › Legal, on the notice** (6b·G, 2026-09-16) — the web's own
     destination. It used to go to `/privacy`, the pre-sign-in screen, which was honest while
     Settings did not exist and is now the wrong door: it has no way back into the app but the
     system gesture, and it cannot show her the agreement she may want to read next to it. */
  const [privacyNote, setPrivacyNote] = useState(null);
  useEffect(() => {
    let live = true;
    getJSON("/legal/privacy/status")
      .then((d) => { if (live && d && d.updated) setPrivacyNote(d); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const stampPrivacySeen = (context) => {
    setPrivacyNote(null);
    postJSON("/legal/privacy/seen", { context }).catch(() => {});
  };

  /* ⓷ The Ask Meyy bank, refreshed on every signed-in load (row 24). It is an ETag request, so
     an unchanged bank costs a 304 and nothing else. Sign-in primes it; this is what keeps a
     teacher who has not signed out in a fortnight from reading a fortnight-old bank. */
  useEffect(() => { refreshBank().catch(() => {}); }, []);

  /* ★ LAPSED = THE READING ROOM (founder, 2026-08-24; app. 01 rows 54-55). Her lessons stay
     hers — she can open them, read them, export them — but nothing that GROWS the account is
     offered: My Classes and Add leave the bar, the "+" window will not open, the prepare CTA
     goes, and the profile is read-only. Renewal is offered in Settings, never pushed at her
     from the screen she was working on.
     ⚠️ A REVOKE LANDS MID-SESSION, so this is not only a first-paint rule: she may be STANDING
     on My Classes when the poll comes back, and a bar item disappearing under a screen that is
     still showing is worse than either. `navigate`, not `push` — she is being moved, not taken
     somewhere she can come back from.
     ⚠️ And anything already OPEN closes with it: a profile window she opened a second before
     the revoke would otherwise stay up, editable, over a shell that has just decided she may
     not edit. */
  useEffect(() => {
    if (!ent.lapsed) return;
    clearPortal();
    if (!pathname.startsWith("/lessons")) router.navigate("/lessons");
  }, [ent.lapsed, pathname]);

  /* ── THE ACTIVATION GATE (app. 01 rows 14-15; founder's Q5 answer, 2026-09-16) ──────────
     ★ IT LIVES IN THE LAYOUT, NOT IN `index.jsx`, and that is the whole of the choice. Decided
     once on the way in, a profile WIPED mid-session (an erase from Settings, a reset on the web)
     would leave her sitting in a shell with nothing behind it until she relaunched. Here the
     question is re-asked whenever her profile changes, which is the web's own behaviour — its
     gate is an expression in `page.jsx`'s render, re-evaluated whenever `ready` flips.

     ★ PAINT FIRST, THEN CHECK, as everywhere else on this app: a DEVICE COPY with subjects is
     proof enough to open the shell, so a returning teacher sees no gate at all. Only a phone with
     nothing stored waits for `/readiness`, and it waits on a bare paper screen rather than
     flashing My Classes at someone who is about to be sent to the welcome screen.

     ⚠️ `hasActivated()` is what stops the BOUNCE. Finishing first run writes her profile through
     the store, but the serve it fired is still in flight, so the second half of the question
     ("has she ever generated?") would truthfully answer no and send her straight back to the
     welcome screen seconds after her first success. Once this session has watched her do it, the
     answer can never revert. */
  const [resolved, setResolved] = useState(() => cachedReady());
  const [needFirstGen, setNeedFirstGen] = useState(false);
  useEffect(() => {
    let live = true;
    fetchReadiness().then(() => { if (live) setResolved(true); })
      .catch(() => { if (live) setResolved(true); });   // unreachable server → never gate her
    return () => { live = false; };
  }, []);
  const ready = !!(readiness && (readiness.subjects || []).length);
  useEffect(() => {
    if (!ready || hasActivated()) { setNeedFirstGen(false); return; }
    let live = true;
    firstGenNeeded().then((need) => { if (live) setNeedFirstGen(need); }).catch(() => {});
    return () => { live = false; };
  }, [ready]);

  if (!getUser()) return <Redirect href="/login" />;
  if (!hasActivated() && ((resolved && !ready) || needFirstGen)) return <Redirect href="/first-run" />;
  // Nothing stored and /readiness still in flight: hold on paper rather than flash a shell she
  // may not be entitled to see.
  if (!resolved && !ready) return <View style={{ flex: 1, backgroundColor: t.paper }} />;

  /* ⚠️ THERE IS NO `/profile` CASE ANY MORE, and there must not be one. The editor used to be a
     route, and the bar lit NOTHING while she was on it — the web's own answer for a profile
     screen. Now the editor is a window OVER a screen, so the bar should keep showing where she
     actually is, which is where she was when she opened it. Re-adding a "none" case would blank
     the bar for a window, which is the opposite of what that rule was for. */
  const inSettings = pathname.startsWith("/settings");
  /* Settings lights NOTHING — the bar stays up (founder, 2026-09-14: a screen that takes the
     app's nav away leaves exactly one way out of itself) but claims none of its four places. */
  /* ★ WHILE ASK MEYY IS OPEN IT CARRIES THE CLAY AND NOTHING ELSE DOES — the web's
     `activeNav === "classes" && !askOpen`. The bar answers "where are you", and while the panel
     is up she is in the panel; two lit items would be the bar disagreeing with itself. */
  const active = askOpen ? "ask"
    : (inSettings || (pathname.startsWith("/preview") && fromSettings)) ? null
    /* `/preview` is a report OF a lesson, reached from a My Lessons card, so it keeps that
       item lit — she has not left the repository, she is looking at something it made. */
    : (pathname.startsWith("/lessons") || pathname.startsWith("/preview")) ? "lessons" : "classes";

  /* ★ THE LINE AND THE VALUES ARE COMPUTED AT RENDER, NOT FROZEN INTO THE WINDOW. She opens a row,
     changes her periods a week and the window comes back — and it must come back saying SEVEN.
     A descriptor stamped when the window opened would show her the figure she has just replaced,
     which on a window whose entire question is "did Meyy get this right?" is the worst possible
     answer. `saveReadiness` writes through to the store before `closeEdit` restores the window, so
     the value on screen is the value on record. */
  const checkSub = win && win.mode === "check"
    ? <SetupCheckSub parts={setupCheckSub(readiness, win)} /> : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      {/* ★ ONE BAR, IN THE SHELL (founder Q8, answered 2026-09-16: "yes agreed").
          Until now every route drew its own: My Classes one, My Lessons THREE (one per branch),
          Prepare one, the lesson route two and LessonView three more — eleven copies of a strip
          that never changes. The web has never had more than one; `.topbar` is written once in
          page.jsx and the view beneath it swaps.
          ★ THE BUG CLASS THIS CLOSES is a screen FORGETTING. On 2026-09-14 the founder reported
          "when I open a lesson plan from My Class or My Lessons, the login and wheel on top right
          bar disappears" — five of those eleven call sites passed no `user`, so the bar shed its
          own right-hand half on the screen a teacher spends her lesson in. That was patched by
          giving `user` a default; this removes the thing that can be got wrong.
          ★ AND IT IS THE ANCHOR THE REST OF 6a NEEDS. The notices (save-failed, a section
          mismatch, a bumped privacy notice) belong to the APP, not to whichever screen happens to
          be showing; so does the gear, and so will Ask Meyy's panel. Threading each of those
          through four route files is how they end up disagreeing.
          ✅ **THE GEAR IS LIT** (6b·A, 2026-09-16) — `/settings` exists now. ⚠️ `push`, NOT
          `navigate`: the four bar items are PLACES and returning to one must not stack a second
          copy, but Settings is a JOURNEY she comes back from, and the stack is what remembers
          where she was. That is also what row A2's `settingsOriginRef` buys on the web, where
          there is no stack to keep it for you.
          ⚠️ Shell-LESS screens keep their own: login, the privacy notice and first run live
          OUTSIDE `(app)` by design (§0, Q23), and first run's carries `gear={false}`. */}
      {/* The onLayout is Ask Meyy's `--hdr-h` — see `barH` above. It wraps the BRAND BAR and
          nothing else, because that is what the web measures. */}
      <View onLayout={(e) => setBarH(e.nativeEvent.layout.height)}>
        <Bar onSettings={() => router.push("/settings")} />
      </View>
      {/* ★ THE FROZEN SETTINGS BAR (app. 04 rows A3-A5) sits in the slot the web's tab row
          occupies, below the brand bar, with NO hairline under it (founder). It is drawn HERE
          rather than by each Settings screen for the reason the brand bar is: one shell, and a
          label derived from the route cannot disagree with the route.
          ⚠️ Its ✕ is `router.back()` on every level. On the web, closing a subview has to
          restore an origin held in a ref; the phone's subviews are PUSHED screens, so the stack
          already remembers — and closing home leaves Settings for wherever she came from, which
          is the same call. */}
      {inSettings ? (
        <SettingsBar label={settingsLabel(pathname)} onClose={() => router.back()} />
      ) : null}
      {/* The notices ride between the bar and the screen — see components/Notices.jsx for why
          they are pinned here rather than at the top of a scroller. */}
      <View style={{ paddingTop: (sectionFailed || privacyNote) ? 14 : 0 }}>
        <SectionFailedBar message={sectionFailed} onDismiss={() => setSectionFailed("")} />
        {/* ⚠️ AND NOW THE "hide it inside Legal" CASE IS OWED AFTER ALL. While the destination
            was `/privacy` — a route outside `(app)` — this layout was not even mounted while she
            read, so there was nothing to hide. Settings › Legal is INSIDE the shell, so without
            this the bar would announce the document over the document, which is the web's own
            reason for its `settingsView === "legal"` guard. Both actions stamp the version seen
            besides, so in practice it is already down; this is for the teacher who arrives at
            Legal by the gear while the bar is still up. */}
        {!pathname.startsWith("/settings/legal") ? (
        <PrivacyNoteBar version={privacyNote && privacyNote.current_version}
          onRead={() => {
            stampPrivacySeen("updated_note_read");
            router.push({ pathname: "/settings/legal", params: { doc: "privacy" } });
          }}
          onDismiss={() => stampPrivacySeen("updated_note_dismissed")} />
        ) : null}
      </View>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.paper } }} />
      {/* ★ ONE WINDOW, WHOSE CONTENTS CHANGE (founder, 2026-09-15: "when 'x' is used to click off,
          it goes back to my classes for a moment before showing 'what would you like to change?'
          — that time gap should not be there").
          The portal and the editor each used to own a Sheet, so moving between them UNMOUNTED one
          Modal and MOUNTED another: two fade transitions back to back, and in the gap between them
          there was no scrim at all, so the bare screen flashed through. The state was already
          batched — the flash was the Modals, not the data.
          Now there is ONE Sheet. It stays mounted for the whole visit and only its children swap,
          so there is no gap to show. It lives in the LAYOUT because on the web this hangs above
          the tab: it must be reachable from anywhere and survive the screen underneath changing.
          And it renders BELOW the Stack and ABOVE the BottomNav, so the bar stays live behind it —
          a window that took the app's whole navigation away would be the one screen she could not
          simply leave, which is the mistake Ask Meyy's scrim made on the web in September. */}
      {/* ⚠️ `!ent.lapsed` is the web's `page.jsx:1438` — the portal simply does not render for a
          lapsed teacher. The effect above closes what is open; this is what keeps it shut. */}
      {(win || edit || pick) && !ent.lapsed ? (
        <Sheet visible scroll={!!(edit || pick)}
          onClose={edit ? closeEdit : pick ? closePick : () => setPortalWin(null)}
          /* ★ THE ← IS THE JOURNEY'S, NOT ONLY THE SCREEN'S (founder, 2026-09-16: "can we have
              back arrow for Add button not just for class but for subject, periods a week and
              annual period budget"). It used to be drawn only where a SCREEN knew of a step
              before it — the duration step, and the class question — so every other destination
              arrived with ✕ as its only corner, and ✕ goes all the way back to the window's four
              rows: to fix the class she had just answered she had to answer the subject again too.
              The two halves stay separate because they know different things: the EDITOR reports
              its own internal step (duration → periods a week), and the LAYOUT, which owns the
              journey, supplies the step behind that — the question she came through. */
          onBack={(edit || pick)
            ? ((editChrome && editChrome.onBack)
               || (edit && pickBack ? editBackToPick : undefined))
            : undefined}
          {...((edit || pick) ? {} : portalChrome(win.mode, checkSub))}>
          {edit ? (
            /* `hasBack` only tells the editor a corner is being DRAWN, so its kicker clears
               it; the editor never navigates with it. */
            <ProfileEditor {...edit} onChrome={setEditChrome} hasBack={!!pickBack} />
          ) : pick ? (
            /* ★ THE PICK SCREENS (5d item 3). They carry their own `.tp` header exactly as the
               editor does, so the Sheet draws no header of its own — `scroll` is on for the same
               reason it is on for the editor: a teacher of six subjects is a taller card than a
               four-row menu, and the 82% cap plus an inner scroller is what stops it running off
               the screen. The ← is reported up through the same `onChrome` channel, so the
               window has one back mechanism and not two. */
            <ProfilePick {...pick} subjects={(cachedReadiness() || {}).subjects || []}
              scope={scope} onChrome={setEditChrome}
              onBackToSubject={pickBackToSubject}
              onPickSubject={(name) => {
                /* Subject answered — ask the SAME rule what is left to do. It decides the second
                   skip too (one class in play → straight in), so the screen cannot be shown with
                   a single row on it. */
                const r = resolvePortalPick((cachedReadiness() || {}).subjects, pick.goal, scope, name);
                if (!r) return;
                if (r.open) openEdit({ intent: pick.goal, ...r.open });
                else pickSubject(name);
              }}
              onPickClass={(grade) => openEdit({ intent: pick.goal, subject: pick.subject, grade })} />
          ) : (
            <ProfilePortal mode={win.mode} values={setupCheckValues(readiness, win)}
              onPick={(kind) => {
                /* ★ EVERY ROW NOW LEADS SOMEWHERE FOR EVERY TEACHER (5d item 3, 2026-09-15).
                   A row is a spot edit on ONE subject·class and the window does not resolve
                   WHICH; the pick screens ask. Until they existed this handler simply RETURNED
                   for a teacher with more than one subject·class — honest, and a dead end.
                   The two skips below are the web's own and are not shortcuts: a question with
                   one possible answer is not a question. */
                enterPortal({ originRoute: pathname, win, scope: win.scope || null });
                /* ⚠️ THE SCOPE IS THE WINDOW'S, NOT AN INVENTED `exact` ONE. Until item 3 this
                   line stamped `{ ...only, exact: true }` — harmless while the only teacher who
                   got anywhere was the one with a single subject·class, and wrong the moment the
                   pick screens exist: `exact` means "she is standing on it, do not ask", which is
                   true of the Year Plan pencil and false of a portal row. An added-subject window
                   carries a STAGE scope and that is what must reach the class screen, or a
                   teacher who just bought Science·Secondary would be offered the 6, 7, 8 she
                   settled months ago. */
                const r = resolvePortalPick((cachedReadiness() || {}).subjects, kind,
                  win.scope || null);
                if (!r) return;
                if (r.open) openEdit({ intent: kind, ...r.open });
                else openPick({ goal: kind, subject: r.ask === "class" ? r.subject : null });
              }}
              /* ★ IT GOES TO THE PROFILE (founder, 2026-09-17, at the end of the tour: the link
                 *"does not take us to the full profile"*). This was an EMPTY handler whose note
                 said "the full accordion arrives with Settings, step 6" — and Settings arrived in
                 6b. Second time today a placeholder outlived its reason and went on being obeyed:
                 the login header kept the Subscribe card off a screen that already existed, and
                 this kept a link inert next to the screen it names. **A note that states a
                 dependency must name the thing that lifts it, and be deleted the day it lands.**
                 ⚠️ CLOSING FIRST IS A PHONE-ONLY DIVERGENCE, and a technical limitation (§0): the
                 web's `openFullProfile` leaves the window standing because its profile replaces
                 the view beneath it, and its own note says closing is "her explicit act". Here
                 the window is a `Modal`, which floats above every route — navigate under it and
                 she gets the profile she cannot see. Same destination, one extra act. */
              onOpenProfile={() => { setPortalWin(null); router.navigate("/settings/profile"); }} />
          )}
        </Sheet>
      ) : null}

      {/* ★ ASK MEYY (6c) — ABOVE THE STACK, BELOW THE BAR. That ordering is the whole design: the
          nav stays live behind the panel, so the one screen a teacher opens when she is stuck is
          not also the one screen she cannot leave. It is the founder's 2026-09-13 call on the
          web's scrim, ported as a placement rather than as a z-index.
          ⚠️ It is held until `barH` has been reported. For one frame after mount the height is 0
          and the panel would start at the top of the window, over the brand bar — one frame of a
          panel jumping down the screen, for nothing. */}
      {askOpen && barH > 0 ? <AskMeyy top={barH} onClose={closeAsk} /> : null}

      {/* ⚠️ ABOVE Ask Meyy and the bottom nav, because steps 18-19 ring them while they are open —
          a tour that sits under the thing it is pointing at cannot point at anything. */}
      {/* Not while the attach sheet holds it — see `useTourOverlayHost`. */}
      {tour.step > 0 && overlayHost === null ? (
        <GuidedTour step={tour.step} info={tour.info}
          onNext={tourNext} onBack={tourBack} onSkip={tourSkip} />
      ) : null}

      {/* My Lessons is live as of step 4b; the "+" portal is live as of 5d; Ask Meyy as of 6c.

          ⚠️ `navigate`, NEVER `push` (founder-reported delay, 2026-09-14). These four are PLACES,
          not steps in a journey: pushing put a SECOND copy of My Classes on the stack every time
          she came back to it, so a morning of crossing between the two screens grew the stack
          without bound — and, because every push is a fresh MOUNT, it is what made both screens
          re-run their loads and show a spinner at all. `navigate` returns to the instance already
          on the stack, so a crossing costs nothing and the screen she returns to is the one she
          left, scroll position and all. The stores behind them (plans, readiness) make a genuine
          first mount cheap; this is what stops most of the mounts happening. */}
      <BottomNav
        active={active}
        /* ✅ WIRED 2026-09-16 (6a F5, Q7). These two props have existed since the nav was
           ported and nothing ever passed them, so the phone's bar offered a lapsed teacher
           two doors the web had already closed. `showAdd` takes `ready` as well, because the
           "+" window is about a profile and there is nothing to change before there is one. */
        showClasses={!ent.lapsed}
        showAdd={ready && !ent.lapsed}
        /* ⚠️ THE THREE DESTINATIONS CLOSE THE PANEL AND GO — the web's `setAskOpen(false)` on
           each of them. Ask Meyy is help ABOUT the app; leaving it up over a screen she has just
           navigated to would be the panel outliving the question that opened it. */
        onClasses={() => { closeAsk(); router.navigate("/"); }}
        onLessons={() => { closeAsk(); router.navigate("/lessons"); }}
        /* ★ ADD IS LIVE (2026-09-15). It was held until all four of the window's rows led
           somewhere — the call the founder made twice before, on 4b's Year Plan pencil and on
           Q1's HOLD. Class was the last of the four.
           ✅ F5 LANDED (6a, 2026-09-16): the window no longer opens while she is lapsed — the
           item is not in the bar (`showAdd` above), the Sheet does not render, and anything
           open is closed. Enforcement is still off server-side, so this is dormant, not dead. */
        onAdd={() => { closeAsk(); setPortalWin({ mode: "change" }); }}
        /* ★ TOGGLE, not open (the web's `setAskOpen((v) => !v)`). Ask Meyy is the one item in the
           bar that is a PANEL and not a place, so the item that raised it is also how she puts it
           away — the ✕ is a second door, not the only one. */
        onAsk={toggleAsk}
      />
    </View>
  );
}
