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
import { View } from "react-native";
import { Redirect, Stack, useRouter, usePathname } from "expo-router";
import { getUser } from "@aruvi/shared/format";
import { useTheme } from "../../theme/ThemeContext";
import BottomNav from "../../components/BottomNav";

export default function AppLayout() {
  const { t } = useTheme();
  const router = useRouter();
  const pathname = usePathname() || "/";
  if (!getUser()) return <Redirect href="/login" />;

  const active = pathname.startsWith("/lessons") ? "lessons" : "classes";

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.paper } }} />
      {/* My Lessons is live as of step 4b. The "+" portal and Ask Meyy get their screens in
          steps 5 and 6 — until then those two items render (the bar must not change shape
          later) and do nothing.

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
        onAdd={() => {}}
        onAsk={() => {}}
      />
    </View>
  );
}
