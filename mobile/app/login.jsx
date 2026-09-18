/* ───────── The front door — the web's Login.jsx, on the phone ─────────
 *
 * FIRST-TIME device → CHOOSE (benefits + Free-to-try) → OTP (mobile IS the identity; six
 * auto-advancing boxes) → in. RETURNING device → SIGN-IN (number or email) → /onboarding/known
 * → OTP → in. OTP verification REGISTERS the number (/onboarding/verified) and the id the
 * session runs under is the one that call returns — the API derives it from the verified
 * token — never the box she typed in. All of that is @aruvi/shared: sendOtp / verifyOtp /
 * authHeaders / idInUse / getJSON are the web's own functions.
 *
 * ★ BOTH DOORS, since 2026-09-17 (app. 03 rows 7 · 24 · 40; founder, on the handset after a
 * delete-and-rejoin: *"only free to try shows and subscribe does not"*). The old note here said
 * the beta ran on manual grants with "no purchase screen in the app" — that stopped being true
 * on 2026-09-16, when Q11 shipped `SubscribeWizard`, and a stale reason is worse than none: it
 * is what kept the card off the choose screen for a day after the screen behind it existed.
 * `mode` is the page-1 choice, exactly as on the web, and it is read in ONE place — after the
 * OTP verifies. Without Supabase env the stub stays (four boxes, 0000), labelled, so a
 * header-mode dev API still works. */
import { useEffect, useRef, useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Keyboard, Platform, Pressable, StyleSheet } from "react-native";
import { Text } from "../components/Text";
import { useRouter } from "expo-router";
import { API, getJSON, idInUse, MOBILE_TAKEN, setUser } from "@aruvi/shared/format";
import { DEVICE_SEEN_KEY as SEEN_KEY } from "@aruvi/shared/signout";
import { authEnabled, sendOtp, verifyOtp as verifyOtpRemote, OTP_LEN, OTP_TTL_MS, OTP_EXPIRED,
         OTP_RESEND_LOCK_MS, authHeaders } from "@aruvi/shared/auth";
import { primeBank } from "@aruvi/shared/ask-aruvi/bank";
import { storage } from "@aruvi/shared/storage";
import Bar from "../components/Bar";
import OtpBoxes from "../components/OtpBoxes";
import { Button, Link, Field, Input, Quiet, ErrorLine } from "../components/ui";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";
import { type } from "../theme/type";



/* ★ `MOBILE_TAKEN` now comes from @aruvi/shared/format (2026-09-16, Q21b). This file used to
 * declare its own — "…already has a Meyy sign in. Tap Sign in below." — and the web's own comment
 * had already rejected exactly that: she is standing at the CREATE door, where the instruction is
 * to create, and whoever typed the number is not owed the news that it holds an account. */

/* The web's `.ob-headline` + `.ob-benefits`, ticks and all. The ticks are their own spans on the
 * web (`.ob-tick`, pine, bold) — here they are nested Texts for the same reason the check window's
 * bold is: RN picks a face by name. The web separates the four with `&ensp;`, which is one em-half
 * space; three plain spaces was the phone's stand-in and is kept, since RN has no `&ensp;`. */
const Benefits = () => {
  const { t } = useTheme();
  const ws = useWebStyles();
  const Tick = () => <Text style={ws.ob_tick}>✓</Text>;
  return (
    <View>
      <Text style={ws.ob_headline}>Plan engaging, NCF-aligned lessons in seconds.</Text>
      <Text style={ws.ob_benefits}>
        <Tick /> Lesson plan in seconds, not hours   <Tick /> NCF / NCERT aligned   <Tick /> Assessment
        built in   <Tick /> Every section’s status at one glance
      </Text>
    </View>
  );
};

/* Module-level on purpose: a frame defined inside Login would be a NEW component type on
 * every render, remounting its subtree and blurring the input on each keystroke. */
/* ★ THE PRIMARY BUTTON WENT UNDER THE KEYPAD (founder, 2026-09-17, iPhone 16: "when i put the
 * cursor where mobile phone number must be put in..the enter button hides behind the key pad
 * though 'new to Meyy? Get started' does appear immediately below the mobile").
 * The foot appeared because it IS outside the scroll — `padding` shrinks this view and the foot
 * rides up with the keyboard. "Enter →" / "Generate OTP →" are the LAST children of the scroll,
 * so shrinking pushed them past the bottom of a view nobody had scrolled: reachable, but
 * invisible, on the one screen where the button is the whole point.
 * Two halves to the cure, and both are needed:
 *   · `keyboardDidShow` → scrollToEnd, so the moment the keypad opens the scroll lands on the
 *     action rather than leaving her to discover it. `Did`, not `Will`: the KAV padding must be
 *     in place before the end is where we think it is. It also fires on FRAME changes (predictive
 *     text bar, a switch from number-pad to letters), so the button stays put as the keypad grows.
 *   · `KEYPAD_SLACK` of bottom padding, so the last control clears the foot's hairline instead of
 *     sitting flush against it. Applied only while the keypad is up — the closed-keypad screen is
 *     the web's spacing and must not change.
 * Shared by all three screens (choose / otp / signin) because the frame is: the OTP door had the
 * same fault one field earlier. */
const BODY_PAD_BOTTOM = 30;   /* must equal s.body.paddingBottom below */
const KEYPAD_SLACK = 24;

function Wrap({ children, foot }) {
  const { t } = useTheme();
  const scroller = useRef(null);
  const [keypad, setKeypad] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      setKeypad(true);
      /* One frame for the padding to land, then go to the action. */
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => setKeypad(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Bar />
      <ScrollView ref={scroller} contentContainerStyle={[s.body, keypad && { paddingBottom: BODY_PAD_BOTTOM + KEYPAD_SLACK }]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="none">{children}</ScrollView>
      <View style={[s.foot, { borderTopColor: t.line }]}>{foot}</View>
    </KeyboardAvoidingView>
  );
}

/* One plan card on the choose screen — `.ob-plan`, with `.ob-plan-sub2` for the second.
   ⚠️ THE TWO HEADINGS ARE DIFFERENT COLOURS, and that is the whole visual difference between the
   offers: `.ob-plan-hd` is PINE and `.ob-plan-sub2 .ob-plan-hd` is CLAY. The phone drew both in
   `ink` from a local StyleSheet, which is also why nothing here was ever under the parity
   checker (founder, 2026-09-17: *"align color of 'subscribe' with that of web app"*).
   ⚠️ AND `on` DOES NOT TINT THE FILL. The web keeps `--card-bg` and adds a pine border plus a 1px
   pine ring; the fill never changes. Tinting the chosen card was the phone's own invention and it
   made the UNCHOSEN one read as disabled — on a screen whose entire job is offering a choice. */
function PlanCard({ on, onPress, title, sub, points, sub2 }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[ws.ob_plan, on && ws.ob_plan_on,
              { backgroundColor: t.card_bg, borderColor: on ? t.pine : t.line }]}>
      <Text style={[ws.ob_plan_hd, sub2 && ws.ob_plan_hd_sub2]}>{title}</Text>
      <Text style={ws.ob_plan_sub}>{sub}</Text>
      <Text style={ws.ob_plan_points}>{points}</Text>
    </Pressable>
  );
}

export default function Login() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  const live = authEnabled();
  const otpLen = live ? OTP_LEN : 4;
  const [screen, setScreen] = useState(() => { try { return storage.getItem(SEEN_KEY) ? "signin" : "choose"; } catch { return "signin"; } });
  const [flow, setFlow] = useState("create");   // create | return
  const [mode, setMode] = useState("trial");    // trial | subscribe — the page-1 choice
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  /* ★ THE CODE'S OWN CLOCK (founder, 2026-09-17: "there is no timer too … at end of timer, it
     should show resend only"). ⚠️ It runs from the moment the SMS was REQUESTED, because that is
     when Supabase's own expiry starts — anchoring it to when the screen appeared would drift by
     however long the send took, and the drift always runs in the direction that flatters us.
     ★ It is also what tells a WRONG code from a DEAD one: Supabase answers both with the same
     sentence (see `OTP_WRONG` in shared/auth), so the clock is the only honest discriminator. */
  const [otpAt, setOtpAt] = useState(0);        // ms timestamp of the last successful send
  const [otpLeft, setOtpLeft] = useState(0);    // whole seconds remaining, 0 once dead
  useEffect(() => {
    if (!otpAt) return undefined;
    const tick = () => setOtpLeft(Math.max(0, Math.ceil((otpAt + OTP_TTL_MS - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [otpAt]);
  const otpDead = otpAt > 0 && otpLeft === 0;
  /* Resend appears once the server would actually honour it — see OTP_RESEND_LOCK_MS. Offering
     it sooner is offering a button that comes back refused. */
  const otpElapsed = otpAt > 0 ? OTP_TTL_MS / 1000 - otpLeft : 0;
  const otpCanResend = otpAt > 0 && otpElapsed >= OTP_RESEND_LOCK_MS / 1000;
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [mobErr, setMobErr] = useState("");
  const [mobBusy, setMobBusy] = useState(false);
  const [id, setId] = useState("");
  const [signinErr, setSigninErr] = useState("");
  const [signinBusy, setSigninBusy] = useState(false);

  useEffect(() => { if (screen !== "otp") { setOtp(""); setOtpErr(""); } }, [screen]);

  /* ★ `to` IS THE ONLY THING THE SUBSCRIBE DOOR CHANGES. Everything else about entering is the
     same act whichever card she chose — the device is marked seen, the user is set, the bank is
     primed — and the subscribe wizard needs all three, because by the time it mounts she is a
     real authenticated account. She is not "entering later"; she is entering somewhere else
     first. */
  const enter = (uid, to = "/(app)") => {
    try { storage.setItem(SEEN_KEY, "1"); } catch {}
    setUser(uid);
    primeBank();   // the one moment she is certainly online — the Ask Meyy bank's offline guarantee
    router.replace(to);
  };

  const mobileOk = /^\d{10}$/.test(mobile.trim());

  /* ★ THE ONE PLACE THE CLOCK STARTS, and EVERY door must come through it. The returning-device
     flow called `sendOtp` directly and never set `otpAt` — so the countdown sat at 0:00 for ever
     and `otpDead` stayed FALSE (it tests `otpAt > 0`), which meant she was neither told how long
     she had nor ever shown Resend. A dead timer is worse than no timer: it says the code is gone
     while the screen still asks her to type it.
     It RETURNS the error rather than writing it, because the two doors show errors on different
     lines (`mobErr` on the create screen, `signinErr` on the returning one) and the previous
     version wrote to `mobErr` from a screen that does not render it. */
  const requestOtp = async (num) => {
    if (live) {
      const err = await sendOtp(num);
      if (err) return err;
    }
    setOtpAt(Date.now());   // the clock starts when the code was ASKED FOR, not when it arrives
    return null;
  };

  const verifyOtp = async () => {
    const num = mobile.trim();
    setOtpErr("");
    /* Past the timer there is nothing to ask: the code is gone at the server too, and a round
       trip would only return the same ambiguous sentence a second later. */
    if (otpDead) { setOtpErr(OTP_EXPIRED); return; }
    if (live) {
      setOtpBusy(true);
      const err = await verifyOtpRemote(num, otp);
      if (err) { setOtpBusy(false); setOtpErr(err); return; }
    } else if (otp !== "0000") {
      setOtpErr("That code didn't match. (Preview build: use 0000.)"); return;
    }
    let uid = num;
    let trialLeft = null;
    try {
      const r = await fetch(`${API}/onboarding/verified`, { method: "POST", headers: authHeaders(num) });
      if (r.ok) {
        const d = await r.json();
        if (d && d.user_id) uid = d.user_id;
        if (d && typeof d.trial_remaining === "number") trialLeft = d.trial_remaining;
      }
    } catch {}
    setOtpBusy(false);
    /* ★ THE ONE PLACE `mode` IS READ (the web's `Login.jsx:177`). Only on the CREATE path: a
       returning teacher who signs in never saw the choose screen, so her `mode` is the default
       and would send her to a purchase she did not ask for. */
    if (mode === "subscribe" && flow === "create") { enter(uid, "/front-subscribe"); return; }
    /* ★ A NUMBER WHOSE FREE TRIAL IS ALREADY USED (the trial ledger, 2026-09-18) goes to Subscribe
       with a sentence saying why, instead of into first run to meet a paywall on its first
       lesson. Create path only — a returning teacher is not choosing a plan. */
    if (flow === "create" && trialLeft === 0) {
      enter(uid, { pathname: "/front-subscribe", params: { trialUsed: "1" } }); return;
    }
    enter(uid);
  };

  const submitSignin = async () => {
    const trimmed = id.trim();
    const ok = /^\d{10}$/.test(trimmed) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!ok) return;
    setSigninErr(""); setSigninBusy(true);
    try {
      const d = await getJSON(`/onboarding/known?id=${encodeURIComponent(trimmed)}`);
      if (d && d.known) {
        const uid = d.id || trimmed;
        if (!live) { setSigninBusy(false); enter(uid); return; }
        setMobile(uid); setFlow("return"); setMobErr(""); setOtp("");
        const err = await requestOtp(uid);   // NOT `sendOtp` — see requestOtp: this is the clock
        setSigninBusy(false);
        if (err) { setSigninErr(err); return; }
        setOtpSent(true); setScreen("otp");
        return;
      }
      setSigninBusy(false);
      if (d && d.reason === "ambiguous_email") { setSigninErr("More than one Meyy account uses this email. Please sign in with your mobile number."); return; }
      setSigninErr("We don't recognise this mobile or email yet — tap “New to Meyy? Get started” below to create your sign in.");
    } catch {
      setSigninBusy(false);
      setSigninErr("Couldn't reach Meyy right now. Try again in a moment.");
    }
  };

  if (screen === "choose") {
    return (
      <Wrap foot={<>
        <Button title="Create sign in →" onPress={() => { setFlow("create"); setOtpSent(false); setScreen("otp"); }} />
        <Link title="Already have an ID? Sign in" onPress={() => setScreen("signin")} />
      </>}>
        <Benefits />
        {/* `.ob-h2` carries a RULE ABOVE IT (border-top + 16px padding) — it is what separates the
            pitch from the choice. The phone had a bare 26px gap and no line. */}
        <Text style={[ws.ob_h2, { borderTopColor: t.line }]}>Choose what works for you</Text>
        {/* ★ TWO CARDS, AND THEY ARE BUTTONS. The web's `.ob-plan` carries an `on` class and the
            choice is real — it decides where Verify sends her. The phone drew ONE card, as a
            static View, so Subscribe was not merely unselected: it did not exist, and a teacher
            who wanted to pay had no way to say so at the door. */}
        <PlanCard on={mode === "trial"} onPress={() => setMode("trial")}
          title="Free to try"
          sub="Try Meyy with no cost. Perfect to explore and get started."
          points="Any 3 chapters · unlimited lesson plans per chapter · all core features to plan & assess" />
        <PlanCard on={mode === "subscribe"} onPress={() => setMode("subscribe")}
          title="Subscribe"
          sub="Unlimited access to plan across your subject & stage."
          points="In addition to core features to plan & assess, Unlimited chapters · every class in that subject & stage" sub2 />
      </Wrap>
    );
  }

  if (screen === "otp") {
    return (
      <Wrap foot={<Link title="← Back" onPress={() => { setOtpSent(false); setScreen(flow === "return" ? "signin" : "choose"); }} />}>
        <Text style={[type.title, { color: t.ink }]}>Let's verify your mobile</Text>
        <Text style={[type.body, { color: t.ink_soft, marginTop: 6 }]}>We'll send you a one-time password (OTP) to sign in securely.</Text>
        <Field label="Enter your mobile number">
          <View style={s.mobileRow}>
            <Text style={[type.body, { color: t.ink_soft, marginRight: 10 }]}>+91</Text>
            {/* ★ ONCE THE CODE IS IN FLIGHT, THE NUMBER IS FIXED (founder, 2026-09-16, Q21a). The
                phone has done this since it was built and the divergence was never named; it is
                now the rule on BOTH surfaces. The OTP was sent TO this number, so a field she can
                still edit under the boxes is a field that lies about where the code went. "← Back"
                is the way to change it, and that re-sends. `flow === "return"` locks it for the
                other reason: there the number came from her account, not from her. */}
            <Input style={{ flex: 1 }} keyboardType="number-pad" inputMode="numeric" maxLength={10} value={mobile}
              editable={flow !== "return" && !otpSent} placeholder="Enter mobile number" textContentType="telephoneNumber"
              onChangeText={(v) => { setMobile(v.replace(/\D/g, "")); setMobErr(""); }} />
          </View>
        </Field>
        <Quiet>We'll never share your number.</Quiet>
        <Text style={[type.small, { color: t.ink_soft, marginTop: 8 }]}>
          By continuing you confirm you are 18 or older and have read Meyy's{" "}
          <Text style={{ color: t.pine, textDecorationLine: "underline" }} onPress={() => router.push("/privacy")}>Privacy Notice</Text>.
        </Text>
        <ErrorLine>{mobErr}</ErrorLine>
        {!otpSent && flow === "create" ? (
          <Button title={mobBusy ? (live ? "Sending…" : "Checking…") : "Generate OTP →"} disabled={!mobileOk} busy={mobBusy} style={{ marginTop: 22 }}
            onPress={async () => {
              setMobErr(""); setMobBusy(true);
              const taken = await idInUse(mobile.trim());
              if (taken) { setMobBusy(false); setMobErr(MOBILE_TAKEN); return; }
              const err = await requestOtp(mobile.trim());
              setMobBusy(false);
              if (err) { setMobErr(err); return; }
              setOtp(""); setOtpSent(true);
            }} />
        ) : (
          <>
            <Field label="Enter the OTP">
              <OtpBoxes value={otp} onChange={(v) => { setOtp(v); setOtpErr(""); }} length={otpLen} autoFocus />
            </Field>
            {live ? (
              /* ★ WHILE IT RUNS she is told how long she has and is NOT offered Resend — a fresh
                 code would invalidate the one she is halfway through typing. ONCE IT IS DEAD the
                 countdown, the boxes' purpose and Verify all go, and Resend is the only thing
                 left, which is the founder's rule: "at end of timer, it should show resend
                 only". One state, one action. */
              otpDead ? (
                <Quiet>The code sent to +91 {mobile.trim()} has expired.{"  "}
                  <Text style={{ color: t.pine, textDecorationLine: "underline" }}
                    onPress={async () => { if (otpBusy) return; setOtpErr(""); setOtp("");
                      const err = await requestOtp(mobile.trim()); if (err) setOtpErr(err); }}>Send a new code</Text>
                </Quiet>
              ) : (
                <Quiet>Sent by SMS to +91 {mobile.trim()}.{"  "}
                  <Text style={type.bodyStrong}>{Math.floor(otpLeft / 60)}:{String(otpLeft % 60).padStart(2, "0")}</Text> left.
                  {otpCanResend ? (
                    <Text>{"  "}
                      <Text style={{ color: t.pine, textDecorationLine: "underline" }}
                        onPress={async () => { if (otpBusy) return; setOtpErr(""); setOtp("");
                      const err = await requestOtp(mobile.trim()); if (err) setOtpErr(err); }}>Resend</Text>
                    </Text>
                  ) : null}
                </Quiet>
              )
            ) : <Quiet>Preview build: enter <Text style={type.bodyStrong}>0000</Text>.</Quiet>}
            <ErrorLine>{otpErr}</ErrorLine>
            {otpDead ? null : (
              <Button title={otpBusy ? "Verifying…" : "Verify & continue →"} disabled={otp.length !== otpLen} busy={otpBusy} style={{ marginTop: 22 }} onPress={verifyOtp} />
            )}
          </>
        )}
      </Wrap>
    );
  }

  // signin (returning device)
  const trimmed = id.trim();
  const signinOk = /^\d{10}$/.test(trimmed) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return (
    <Wrap foot={<Link title="New to Meyy? Get started →" onPress={() => setScreen("choose")} />}>
      <Benefits />
      {/* The web's `.ob-rule` — the hairline that separates what Meyy IS from the act of signing
          in. Without it the benefits and the field read as one block. */}
      <View style={[ws.ob_rule, { borderTopColor: t.line }]} />
      {/* ★ THE QUESTION WAS MISSING (app. 03 rows 28-29, restored 2026-09-16). The phone went
          straight to the field, so a screen the web opens by ASKING something ("Sign in · Who's
          planning today?") arrived as a bare input — product copy dropped in the port, not a
          divergence anyone chose. The field's own label and placeholder are the web's too; the
          phone had rewritten both. */}
      <Text style={ws.login_kicker}>Sign in</Text>
      <Text style={ws.login_q}>Who’s planning today?</Text>
      <Field label="Mobile number or email">
        <Input value={id} onChangeText={(v) => { setId(v); setSigninErr(""); }}
          placeholder="98xxxxxxxx or you@example.com"
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="username"
          returnKeyType="go" onSubmitEditing={submitSignin} />
      </Field>
      {/* ⚠️ A phone-only line stood here — "We'll send a one-time password to the mobile on the
          account." — with no counterpart on the web and no founder note. Dropped in the same pass
          (the phone matches the web by default); the trust line below is what the web puts in this
          slot. If it is wanted, it belongs on BOTH surfaces. */}
      <ErrorLine>{signinErr}</ErrorLine>
      <Button title="Enter →" disabled={!signinOk} busy={signinBusy} style={{ marginTop: 22 }} onPress={submitSignin} />
      {/* ★ THE NOTICE IS LINKED FROM BOTH DOORS, not just the OTP screen (the web's DPDP reasoning,
          Login.jsx:75-80): it is given at or before collection, and this screen collects. */}
      <Text style={[ws.fr_secure, { marginTop: 14 }]}>🛡 Your data is private and secure ·{" "}
        <Text style={ws.lgl_link} onPress={() => router.push("/privacy")}>Privacy Notice</Text></Text>
    </Wrap>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingVertical: 22, paddingBottom: BODY_PAD_BOTTOM },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingVertical: 12, gap: 10, alignItems: "stretch" },
  mobileRow: { flexDirection: "row", alignItems: "center" },
});
