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
import { useTheme } from "../../theme/ThemeContext";
import BottomNav from "../../components/BottomNav";
import ProfilePortal from "../../components/ProfilePortal";
import { subscribePortal, setPortalWin, enterPortal } from "../../lib/portal";

export default function AppLayout() {
  const { t } = useTheme();
  const router = useRouter();
  const pathname = usePathname() || "/";
  /* ⚠️ The subscription sits ABOVE the sign-in redirect below, because hooks may not follow a
     conditional return — the lesson `MyLessonPlans.jsx` taught this repo the hard way on
     2026-09-14 ("Rendered fewer hooks than expected"). */
  const [win, setWin] = useState(null);
  useEffect(() => subscribePortal((p) => setWin(p.win)), []);
  if (!getUser()) return <Redirect href="/login" />;

  /* ★ THE BUDGET EDITOR LIGHTS NOTHING, which is the web's own answer (page.jsx `activeNav`:
     `editFlow === "profile" → "none"`). It IS the profile screen — she is amending her teaching
     record, not standing in one of the four places — and it is reached only from the Year Plan
     and returns there. Lighting My Classes under her, which the bare `: "classes"` fallback
     would do, tells her she is somewhere she is not. "none" is not a case BottomNav enumerates;
     it simply matches no item, and the bar says "you are somewhere else" without pretending. */
  const active = pathname.startsWith("/lessons") ? "lessons"
    : pathname.startsWith("/profile") ? "none" : "classes";

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.paper } }} />
      {/* ★ THE PORTAL WINDOW LIVES IN THE LAYOUT, not in a screen (Track D 5d). On the web it
          hangs off page.jsx, ABOVE the tab, because it must be reachable from anywhere and must
          survive the screen underneath it changing. The phone's routes have nothing above them
          except this layout, so this is where it goes — and it renders BELOW the Stack and ABOVE
          the BottomNav, so the bar stays live behind it. A window that took the app's whole
          navigation away would be the one screen she could not simply leave, which is the mistake
          Ask Meyy's scrim made on the web in September. */}
      {win ? (
        <ProfilePortal mode={win.mode} sub={win.sub} values={win.values}
          onClose={() => setPortalWin(null)}
          onPick={(kind) => {
            /* Each row is a spot edit on ONE subject·class. The window does not resolve WHICH —
               the pick screens do that (5d item 3) — so until they exist the two rows that can
               act without a scope are wired and the other two say so. `enterPortal` remembers
               where she stepped out from AND the window to restore, because a teacher who has
               just amended one item is exactly the person most likely to want the next. */
            enterPortal({ originRoute: pathname, win, scope: null });
            setPortalWin(null);
            router.push({ pathname: "/profile", params: { intent: kind } });
          }}
          onOpenProfile={() => { /* the full accordion arrives with Settings, step 6 */ }} />
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
        /* ★ ADD STAYS DARK UNTIL ALL FOUR ROWS LEAD SOMEWHERE (2026-09-15). The window is built
           and mounted above; two of its rows — Periods a week and Annual period budget — already
           have their screens, and Section and Class do not until 5d items 5 and 6. Opening it now
           would put a teacher in front of a list of four things to change, half of which do
           nothing. That is the call the founder made twice already (4b's Year Plan pencil, and
           Q1's HOLD on the budget screen), and it is the same call here.
           One line when they land:  onAdd={() => setPortalWin({ mode: "change" })}
           ⚠️ And when it lights: the window NEVER opens while she is lapsed — the growth entry
           points hide on an expired subscription (the web's rule). That flag arrives with F5 in
           6a; enforcement is off server-side for every teacher today, so this is a note to keep,
           not a gap to close now. */
        onAdd={() => {}}
        onAsk={() => {}}
      />
    </View>
  );
}
