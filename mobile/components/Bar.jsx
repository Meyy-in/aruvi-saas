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
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MeyyMark from "./MeyyMark";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";
import { endSession } from "../lib/session";

/* The bar's own height BELOW the status bar: the 35px lockup centred in 14 + 15 of padding.
   Published so a panel that must open beneath the bar can offset by it without re-deriving the
   number — the phone's answer to the web's measured --hdr-h. */
export const BAR_CONTENT_H = 64;

export default function Bar({ user = null, onSettings = null }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
            <Pressable onPress={onSettings || undefined} disabled={!onSettings} hitSlop={8}
              accessibilityRole="button" accessibilityLabel="Settings">
              <Text style={ws.hdr_gear}>⚙</Text>
            </Pressable>
            <View style={ws.hdr_user_id}>
              <Text style={ws.hdr_user_name} numberOfLines={1}>{user}</Text>
              <Pressable onPress={() => endSession(router)} hitSlop={8}
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
