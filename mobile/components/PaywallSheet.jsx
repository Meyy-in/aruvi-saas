/* PaywallSheet — the 402 window, mounted ONCE in the signed-in shell (WALK-A-152, 2026-09-29).
 *
 * It lived inside My Lessons, which was fine while every prepare ended there. It stopped being
 * fine when a prepare started from a CLASS CARD settles back on My Classes (`fromSection` →
 * navigate "/"): the 402 pulled the card down and raised a window on a screen she was not on,
 * so on the iPhone she saw the preparing card vanish and nothing else — no sentence, no Subscribe.
 * The web has always held its paywall at the shell (page.jsx), which is why it never showed this.
 * Mounted beside BottomNav in (app)/_layout.jsx, it now answers wherever she is standing.
 *
 * Body unchanged from lessons.jsx — see the notes that travelled with it: the server's sentence is
 * hers and goes up unchanged, the kicker is read off it by the SHARED `paywallKicker`, and ONE
 * Sheet whose children swap (never two Modals).
 */
import { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./Text";
import { Sheet } from "./AttachSheet";
import { paywallKicker } from "@aruvi/shared/format";
import { subscribePreparing, clearPaywall } from "../lib/preparing";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export default function PaywallSheet() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  const [paywall, setPaywall] = useState("");
  useEffect(() => subscribePreparing((s) => setPaywall((s && s.paywall) || "")), []);
  const close = () => clearPaywall();
  return (
    <Sheet visible={!!paywall} onClose={close} confirm>
      <View style={ws.paywall_body}>
        <Text style={ws.kicker}>{paywallKicker(paywall)}</Text>
        <Text style={ws.paywall_msg}>{paywall}</Text>
        <Pressable onPress={() => { close(); router.push("/subscribe"); }}
          accessibilityRole="button"
          style={[ws.paywall_sub, { backgroundColor: t.pine }]}>
          <Text style={[ws.paywall_sub_t, { color: t.paper }]}>Subscribe</Text>
        </Pressable>
        <Pressable onPress={close} accessibilityRole="button" hitSlop={6}>
          <Text style={ws.paywall_later}>Not now</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
