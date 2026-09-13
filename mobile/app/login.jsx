/* ───────── The front door — the web's Login.jsx, on the phone ─────────
 *
 * FIRST-TIME device → CHOOSE (benefits + Free-to-try) → OTP (mobile IS the identity; six
 * auto-advancing boxes) → in. RETURNING device → SIGN-IN (number or email) → /onboarding/known
 * → OTP → in. OTP verification REGISTERS the number (/onboarding/verified) and the id the
 * session runs under is the one that call returns — the API derives it from the verified
 * token — never the box she typed in. All of that is @aruvi/shared: sendOtp / verifyOtp /
 * authHeaders / idInUse / getJSON are the web's own functions.
 *
 * What is NOT here, by decision: the Subscribe card and SubscribeFlow. The beta runs on manual
 * grants with no purchase screen in the app (plan §0, assessment §5B), so the phone has one
 * door — Free to try — and subscription comes later behind BillingProvider. Without Supabase
 * env the stub stays (four boxes, 0000), labelled, so a header-mode dev API still works. */
import { useEffect, useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Text } from "../components/Text";
import { useRouter } from "expo-router";
import { API, getJSON, idInUse, setUser } from "@aruvi/shared/format";
import { authEnabled, sendOtp, verifyOtp as verifyOtpRemote, OTP_LEN, authHeaders } from "@aruvi/shared/auth";
import { primeBank } from "@aruvi/shared/ask-aruvi/bank";
import { storage } from "@aruvi/shared/storage";
import Bar from "../components/Bar";
import OtpBoxes from "../components/OtpBoxes";
import { Button, Link, Field, Input, Quiet, ErrorLine } from "../components/ui";
import { useTheme } from "../theme/ThemeContext";
import { type } from "../theme/type";

const SEEN_KEY = "aruvi_device_seen";
const MOBILE_TAKEN = "This mobile number already has a Meyy sign in. Tap Sign in below.";

const Benefits = ({ t }) => (
  <View>
    <Text style={[type.headline, { color: t.ink }]}>Plan engaging, NCF-aligned lessons in seconds.</Text>
    <Text style={[type.small, { color: t.ink_soft, marginTop: 10 }]}>
      ✓ Lesson plan in seconds, not hours   ✓ NCF / NCERT aligned   ✓ Assessment built in   ✓ Every section's status at one glance
    </Text>
  </View>
);

/* Module-level on purpose: a frame defined inside Login would be a NEW component type on
 * every render, remounting its subtree and blurring the input on each keystroke. */
function Wrap({ children, foot }) {
  const { t } = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Bar />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      <View style={[s.foot, { borderTopColor: t.line }]}>{foot}</View>
    </KeyboardAvoidingView>
  );
}

export default function Login() {
  const { t } = useTheme();
  const router = useRouter();
  const live = authEnabled();
  const otpLen = live ? OTP_LEN : 4;
  const [screen, setScreen] = useState(() => { try { return storage.getItem(SEEN_KEY) ? "signin" : "choose"; } catch { return "signin"; } });
  const [flow, setFlow] = useState("create");   // create | return
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [mobErr, setMobErr] = useState("");
  const [mobBusy, setMobBusy] = useState(false);
  const [id, setId] = useState("");
  const [signinErr, setSigninErr] = useState("");
  const [signinBusy, setSigninBusy] = useState(false);

  useEffect(() => { if (screen !== "otp") { setOtp(""); setOtpErr(""); } }, [screen]);

  const enter = (uid) => {
    try { storage.setItem(SEEN_KEY, "1"); } catch {}
    setUser(uid);
    primeBank();   // the one moment she is certainly online — the Ask Meyy bank's offline guarantee
    router.replace("/(app)");
  };

  const mobileOk = /^\d{10}$/.test(mobile.trim());

  const requestOtp = async (num) => {
    if (!live) return true;
    const err = await sendOtp(num);
    if (err) { setMobErr(err); return false; }
    return true;
  };

  const verifyOtp = async () => {
    const num = mobile.trim();
    setOtpErr("");
    if (live) {
      setOtpBusy(true);
      const err = await verifyOtpRemote(num, otp);
      if (err) { setOtpBusy(false); setOtpErr(err); return; }
    } else if (otp !== "0000") {
      setOtpErr("That code didn't match. (Preview build: use 0000.)"); return;
    }
    let uid = num;
    try {
      const r = await fetch(`${API}/onboarding/verified`, { method: "POST", headers: authHeaders(num) });
      if (r.ok) { const d = await r.json(); if (d && d.user_id) uid = d.user_id; }
    } catch {}
    setOtpBusy(false);
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
        const err = await sendOtp(uid);
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
        <Link title="Already have an ID? Sign in" onPress={() => setScreen("signin")} style={s.footLink} />
      </>}>
        <Benefits t={t} />
        <Text style={[type.h2, { color: t.ink, marginTop: 26 }]}>Choose what works for you</Text>
        <View style={[s.plan, { backgroundColor: t.tint_pine, borderColor: t.pine }]}>
          <Text style={[type.bodyStrong, { color: t.ink }]}>Free to try</Text>
          <Text style={[type.body, { color: t.ink, marginTop: 4 }]}>Try Meyy with no cost. Perfect to explore and get started.</Text>
          <Text style={[type.small, { color: t.ink_soft, marginTop: 6 }]}>Any 3 chapters · unlimited lesson plans per chapter · all core features to plan & assess</Text>
        </View>
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
              const sent = await requestOtp(mobile.trim());
              setMobBusy(false);
              if (sent) { setOtp(""); setOtpSent(true); }
            }} />
        ) : (
          <>
            <Field label="Enter the OTP">
              <OtpBoxes value={otp} onChange={(v) => { setOtp(v); setOtpErr(""); }} length={otpLen} autoFocus />
            </Field>
            {live ? (
              <Quiet>Sent by SMS to +91 {mobile.trim()}.{"  "}
                <Text style={{ color: t.pine, textDecorationLine: "underline" }}
                  onPress={async () => { if (otpBusy) return; setOtpErr(""); setOtp(""); await requestOtp(mobile.trim()); }}>Resend</Text>
              </Quiet>
            ) : <Quiet>Preview build: enter 0000.</Quiet>}
            <ErrorLine>{otpErr}</ErrorLine>
            <Button title={otpBusy ? "Verifying…" : "Verify & continue →"} disabled={otp.length !== otpLen} busy={otpBusy} style={{ marginTop: 22 }} onPress={verifyOtp} />
          </>
        )}
      </Wrap>
    );
  }

  // signin (returning device)
  const trimmed = id.trim();
  const signinOk = /^\d{10}$/.test(trimmed) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return (
    <Wrap foot={<Link title="New to Meyy? Get started" onPress={() => setScreen("choose")} />}>
      <Benefits t={t} />
      <Field label="Sign in with your mobile or email">
        <Input value={id} onChangeText={(v) => { setId(v); setSigninErr(""); }} placeholder="Mobile number or email"
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="username"
          returnKeyType="go" onSubmitEditing={submitSignin} />
      </Field>
      {live ? <Quiet>We'll send a one-time password to the mobile on the account.</Quiet> : null}
      <ErrorLine>{signinErr}</ErrorLine>
      <Button title="Sign in →" disabled={!signinOk} busy={signinBusy} style={{ marginTop: 22 }} onPress={submitSignin} />
    </Wrap>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingVertical: 22, paddingBottom: 30 },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingVertical: 12, gap: 10, alignItems: "stretch" },
  footLink: { textAlign: "center" },
  plan: { borderWidth: 1.5, borderRadius: 12, padding: 16, marginTop: 14 },
  mobileRow: { flexDirection: "row", alignItems: "center" },
});
