/* ───────── The subscribe wizard, FRONT DOOR (app. 03 rows 7 · 24 · 40 · 42) ─────────
 *
 * Owed since 2026-09-15 and closed 2026-09-17 on the founder's report that the phone's choose
 * screen offered *"only free to try ... subscribe does not"*. The web has served two doors since
 * the start; the phone had only the in-app one, as a route inside `(app)`, so the front door had
 * nowhere to mount. The wizard is now `components/SubscribeWizard.jsx` and both doors render it.
 *
 * ⚠️ THE FILE NAME IS LOAD-BEARING. `(app)` is a route GROUP, so it adds no path segment:
 * `app/(app)/subscribe.jsx` already answers to `/subscribe`, and a sibling `app/subscribe.jsx`
 * would be a second route claiming the same path. Hence `/front-subscribe` — not a tidier name
 * waiting to be shortened.
 *
 * ★ IT LIVES OUTSIDE `(app)` ON PURPOSE. She is authenticated by the time she arrives — the OTP
 * is verified and `POST /onboarding/verified` has made the account, which is what every call in
 * the wizard needs — but she has NOT been through first run, and `(app)`'s gate would bounce her
 * to `/first-run` before the wizard drew a frame. What the front door skips is the APP, not the
 * sign-in. It keeps `Bar` as its chrome for the same reason the web passes `chrome={<Bar/>}`:
 * there is no shell here to belong to.
 *
 * ★ DONE ENTERS THE APP; CANCEL RETURNS TO THE SIGN-IN. A finished purchase lands her exactly
 * where the Free-to-try card lands her — signed in, first run next — because by then nothing is
 * owed. Cancel goes back to `/login`, which reopens on the OTP screen's own door.
 *
 * ⚠️ THE TRIAL FORK IS THIS DOOR'S ALONE and must stay so: it belongs to a teacher who has not
 * started, and offering a trial to one whose trial has ended is an offer Meyy cannot honour. The
 * in-app door passes no `trialFork`, exactly as the web's `page.jsx` passes no `onTrial`.
 */
import { useRouter, Redirect, useLocalSearchParams } from "expo-router";
import { getUser } from "@aruvi/shared/format";
import { storage } from "@aruvi/shared/storage";
import { View } from "react-native";
import SubscribeWizard from "../components/SubscribeWizard";
import Bar from "../components/Bar";
import { useTheme } from "../theme/ThemeContext";

export default function SubscribeFront() {
  const router = useRouter();
  const { t } = useTheme();
  /* `trialUsed` — the number's free trial was used before an account deletion (the trial ledger,
     2026-09-18). No trial offer then, and a sentence saying why she is on this screen. */
  const { trialUsed } = useLocalSearchParams();
  /* No account, no wizard — every call it makes is authenticated. This is a guard, not a flow:
     the only way here is through the OTP screen, which has already set the user. */
  if (!getUser()) return <Redirect href="/login" />;
  /* ★ THE BAR WAS NEVER DRAWN (WALK walk blocker, 2026-09-20). The header above says this door
     "keeps Bar as its chrome" — but nothing rendered it, so the wizard had no brand, no Log out,
     and NO SAFE-AREA TOP: the step rail sat under the status bar, and on the Agreement the heading
     was hidden behind it with no way to scroll up to it. Bar owns the top inset. */
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
    <Bar gear={false} />
    <SubscribeWizard trialFork={!trialUsed}
      notice={trialUsed ? "This mobile number has already used its free trial. Subscribe to keep using Meyy." : ""}
      onDone={() => {
        // WALK-A-021: the door she chose is spent once she is through it.
        try { storage.removeItem("aruvi_signup_mode"); } catch {}
        router.replace("/(app)");
      }}
      onCancel={() => router.replace("/login")} />
    </View>
  );
}
