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
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect, Stack, useRouter, usePathname } from "expo-router";
import { getUser } from "@aruvi/shared/format";
import { cachedReadiness } from "@aruvi/shared/readiness";
import { useTheme } from "../../theme/ThemeContext";
import BottomNav from "../../components/BottomNav";
import ProfilePortal, { portalChrome } from "../../components/ProfilePortal";
import ProfileEditor from "../../components/ProfileEditor";
import { subscribePortal, setPortalWin, enterPortal, openEdit, closeEdit } from "../../lib/portal";
import { Sheet } from "../../components/AttachSheet";

export default function AppLayout() {
  const { t } = useTheme();
  const router = useRouter();
  const pathname = usePathname() || "/";
  /* ⚠️ The subscription sits ABOVE the sign-in redirect below, because hooks may not follow a
     conditional return — the lesson `MyLessonPlans.jsx` taught this repo the hard way on
     2026-09-14 ("Rendered fewer hooks than expected"). */
  const [win, setWin] = useState(null);
  const [edit, setEdit] = useState(null);
  /* What the open edit needs from the window's chrome — today just its ← , which exists only on
     the duration step. Reported up by the editor, because the Sheet is owned here. */
  const [editChrome, setEditChrome] = useState(null);
  useEffect(() => subscribePortal((p) => { setWin(p.win); setEdit(p.edit); }), []);
  if (!getUser()) return <Redirect href="/login" />;

  /* ⚠️ THERE IS NO `/profile` CASE ANY MORE, and there must not be one. The editor used to be a
     route, and the bar lit NOTHING while she was on it — the web's own answer for a profile
     screen. Now the editor is a window OVER a screen, so the bar should keep showing where she
     actually is, which is where she was when she opened it. Re-adding a "none" case would blank
     the bar for a window, which is the opposite of what that rule was for. */
  const active = pathname.startsWith("/lessons") ? "lessons" : "classes";

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
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
      {(win || edit) ? (
        <Sheet visible scroll={!!edit}
          onClose={edit ? closeEdit : () => setPortalWin(null)}
          onBack={edit ? (editChrome && editChrome.onBack) : undefined}
          {...(edit ? {} : portalChrome(win.mode, win.sub))}>
          {edit ? (
            <ProfileEditor {...edit} onChrome={setEditChrome} />
          ) : (
            <ProfilePortal mode={win.mode} values={win.values}
              onPick={(kind) => {
                /* Each row is a spot edit on ONE subject·class, and the window does not resolve
                   WHICH — the pick screens do that (5d item 3). Until they exist, the scope is
                   resolved the way the web resolves it when there is nothing to ask: if she
                   teaches exactly one subject·class, go straight in. That is `portalPickClass`'s
                   own "straight in when only ONE is in play" rule, not a shortcut.
                   ⚠️ A teacher with more than one is NOT sent somewhere arbitrary — she is left
                   on the window, which is honest, until item 3 lands. */
                const subs = (cachedReadiness() || {}).subjects || [];
                const only = subs.length === 1 && (subs[0].grades || []).length === 1
                  ? { subject: subs[0].name, grade: subs[0].grades[0].grade } : null;
                if (!only) return;
                enterPortal({ originRoute: pathname, win, scope: { ...only, exact: true } });
                openEdit({ intent: kind, ...only });
              }}
              onOpenProfile={() => { /* the full accordion arrives with Settings, step 6 */ }} />
          )}
        </Sheet>
      ) : null}

      {/* My Lessons is live as of step 4b; the "+" portal is live as of 5d. Ask Meyy gets its
          screen in step 6 — until then that item renders (the bar must not change shape later)
          and does nothing.

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
        onClasses={() => router.navigate("/")}
        onLessons={() => router.navigate("/lessons")}
        /* ★ ADD IS LIVE (2026-09-15). It was held until all four of the window's rows led
           somewhere — the call the founder made twice before, on 4b's Year Plan pencil and on
           Q1's HOLD. Class was the last of the four.
           ⚠️ WHEN F5 LANDS (6a): the window must NOT open while she is lapsed. The growth entry
           points hide on an expired subscription — that is the web's rule and the phone owes it.
           Enforcement is off server-side for every teacher today, so this is a note to keep, not
           a gap to close now. */
        onAdd={() => setPortalWin({ mode: "change" })}
        onAsk={() => {}}
      />
    </View>
  );
}
