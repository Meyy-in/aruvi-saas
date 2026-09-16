/* ───────── The ONE bar — the chrome every screen wears (the web's .topbar / .fr-brand) ─────────
 *
 * ★ THE BRAND LOCKUP IS STACKED (founder, 2026-09-13 — parity audit). The mark sits ON TOP of the
 * "LESSON STUDIO" kicker, as it does on the web (.brand is a column, 101×35) and on every
 * letterhead since 2026-09-03. The first Expo cut set them side by side on one baseline, which
 * made the bar 46px instead of 64 and read as a different product.
 *
 * ★ AND IT CARRIES THE SHELL'S CONTROLS. The web's bar holds the ⚙ gear and, at the right end,
 * the identity block: the mobile number stacked over its own Log out. Both were missing here, so
 * the phone had pushed identity and sign-out to the foot of the scroll — a place the web has
 * never put them. They are rendered only when a `user` is passed, which is what keeps Login,
 * the privacy screen and first run (shell-less by design, §0) on the plain brand bar.
 *
 * Sits under the status bar via the safe-area inset; there is no measured --nav-h here, native
 * layout does it. Measures live in theme/web.js under hdr_*. */
import { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MeyyMark from "./MeyyMark";
import { getUser } from "@aruvi/shared/format";
import { cachedFirstName, fetchAccount, accountFirstName } from "@aruvi/shared/account";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";
import { endSession } from "../lib/session";

/* The bar's own height BELOW the status bar: the 35px lockup centred in 14 + 15 of padding.
   Published so a panel that must open beneath the bar can offset by it without re-deriving the
   number — the phone's answer to the web's measured --hdr-h. */
export const BAR_CONTENT_H = 64;

/* ⚠️ `user` DEFAULTS TO THE SIGNED-IN ID, and does not have to be passed (founder, 2026-09-14:
   "when in iphone/expo I open a lesson plan from My Class or My Lessons, the login and wheel on
   top right bar disappears").
   The whole right-hand block — gear, identity, Log out — is gated on `user`, and FIVE of the
   ELEVEN call sites there were then rendered `<Bar />` with nothing: both branches of the lesson
   route and all three of LessonView.
   ★ THAT WAS THE PATCH; the cure came with Q8 on 2026-09-16 — the signed-in shell
   (`(app)/_layout.jsx`) now draws the ONE bar and no route inside it draws any. The default
   below still earns its keep for the three shell-LESS screens (login, privacy, first run), which
   are outside `(app)` and pass either nothing or an explicit `user`.
   So the bar lost half itself on exactly the screen a teacher spends her lesson in, where the web
   (one shell, one topbar) never changes at all. Requiring every screen to hand the bar the
   session was the bug: it is the same value everywhere, and the only question a screen ever has
   is whether anyone is signed in — which this can answer for itself.
   The prop stays as an override, and login/privacy keep passing nothing: `getUser()` is null
   before sign-in, so those screens still render the bare lockup, correctly and without a
   special case. */
/* `gear: false` is FIRST RUN, and only first run (founder, 2026-09-16). Phase 1 is shell-less by
 * design (§0) — the web's first-run bar carries the brand and her identity and NO gear, because
 * there is no shell to open settings into. The phone drew one anyway, inert, wherever a user
 * existed: a control that does nothing, on the one screen a teacher meets before she has learnt
 * anything. Identity and Log out stay — the web shows both there. */
export default function Bar({ user = getUser(), onSettings = null, gear = true }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  /* ★ HER NAME, NOT HER PHONE NUMBER (founder, 2026-09-15: "since I have subscribed under
     9000000003, the web app correctly shows my name (Kk) but Expo and my iPhone continue to show
     the phone number on the top bar"). The web has read `/account` for this since 2026-08-26; the
     phone never learned to ask, so it showed the id — which is a MOBILE NUMBER for every teacher
     who has not subscribed. She subscribed, gave her name, and the phone went on calling her
     9000000003.
     ⚠️ SEEDED SYNCHRONOUSLY from the device copy, so the first paint already carries her name.
     Showing the number for a beat and then correcting it reads worse than either on its own —
     the bar is the one piece of chrome she never stops looking at.
     The id remains the fallback, and `accountFirstName` is what decides: a numeric display_name
     is the server's just-in-time default, not a name she gave us. */
  const [name, setName] = useState(() => (user ? cachedFirstName() : ""));
  useEffect(() => {
    if (!user) { setName(""); return; }
    let live = true;
    fetchAccount().then((a) => { if (live) setName(accountFirstName(a)); }).catch(() => {});
    return () => { live = false; };
  }, [user]);

  return (
    <View style={{ backgroundColor: t.bar_fill, paddingTop: insets.top + 14, paddingBottom: 15 }}>
      <View style={ws.hdr}>
        {/* The lockup: mark over kicker, as on the web and on every letterhead. */}
        <View style={ws.hdr_brand}>
          <MeyyMark height={22} color={t.bar_ink} dot="#e0705f" />
          <Text style={ws.hdr_brand_tag}>lesson studio</Text>
        </View>

        {user ? (
          <View style={ws.hdr_user}>
            {/* The gear's destination is Settings, which arrives in Track D step 6. It is mounted
                now so the bar stops changing shape under a teacher who has already learnt it —
                the same reasoning as the bottom nav's inert items. */}
            {gear ? (
              <Pressable onPress={onSettings || undefined} disabled={!onSettings} hitSlop={8}
                accessibilityRole="button" accessibilityLabel="Settings">
                <Text style={ws.hdr_gear}>⚙</Text>
              </Pressable>
            ) : null}
            <View style={ws.hdr_user_id}>
              <Text style={ws.hdr_user_name} numberOfLines={1}>{name || user}</Text>
              <Pressable onPress={() => endSession(router, "bar: Log out")} hitSlop={8}
                accessibilityRole="button" accessibilityLabel="Log out">
                <Text style={ws.hdr_user_logout}>Log out</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
