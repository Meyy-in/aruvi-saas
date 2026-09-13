/* The signed-in shell. Step 2 holds one screen; step 3 puts LessonView here and the BOTTOM NAV
 * (founder, 2026-09-13) at the foot of every signed-in screen; step 4 gives My Lessons and the
 * "+" portal their own destinations. Redirects to the front door when there is no user, so a
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
      {/* My Lessons, the "+" portal and Ask Meyy get their screens in step 4 — until then the
          items render (the bar must not change shape later) and do nothing. */}
      <BottomNav
        active={active}
        onClasses={() => router.push("/")}
        onLessons={() => {}}
        onAdd={() => {}}
        onAsk={() => {}}
      />
    </View>
  );
}
