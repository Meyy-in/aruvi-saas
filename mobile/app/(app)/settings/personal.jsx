/* ───────── Settings › Personal profile (6b·C, app. 04 rows C1-C13) ─────────
 *
 * ★ WHO SHE IS, not what she teaches. The two profiles are told apart deliberately (founder,
 * 2026-08-25) and the Settings list keeps them apart; blurring them because both say "profile"
 * is the mistake that naming avoids.
 *
 * ★ HIDDEN ON TRIAL — the card is not drawn and this route is not offered. ⚠️ The ROUTE stays
 * open, as it does on the web: a teacher who reaches it by a link is not the threat model, and a
 * gate that can strand her mid-journey is worse than the card being absent.
 *
 * ★ THE EMAIL CHANGE IS A DOUBLE BLIND: view → enter → confirm, and it is checked at VERIFY, not
 * at Save. Typing an address twice catches the typo that a single field cannot, and finding out
 * at Save that the address belongs to somebody else — after everything else has been written —
 * is the shape of failure this ordering exists to avoid.
 *
 * ★ AND SAVE NEVER WAITS ON THE EMAIL STEP (founder, 2026-08-26). Her name, role, state, city and
 * school save freely; a half-finished email change is simply not saved, and the previously
 * confirmed address stays. The line under Save says so, because otherwise "I pressed Save" and
 * "my email changed" look like the same act.
 *
 * ⚠️ Marketing emails deliberately does NOT live here — it is on the Settings home, ungated,
 * because a withdrawal right that disappears with a subscription state is not a withdrawal right.
 */
import { useEffect, useState } from "react";
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "../../../components/Text";
import { getJSON, postJSON, idInUse, ROLES, STATES, EMAIL_OK, EMAIL_TAKEN } from "@aruvi/shared/format";
import { invalidateAccount } from "@aruvi/shared/account";
import { Field, Input, Button, Link, Quiet, ErrorLine } from "../../../components/ui";
import Dropdown from "../../../components/Dropdown";
import { useTheme } from "../../../theme/ThemeContext";
import { useWebStyles } from "../../../theme/web";

/* The web's `emailFit`: the type steps DOWN as the address grows, and never truncates. */
const emailSize = (e) => {
  const n = String(e || "").length;
  return n <= 22 ? 14 : n <= 28 ? 13 : n <= 36 ? 12 : 11;
};

export default function PersonalProfile() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();

  const [acct, setAcct] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [stateName, setStateName] = useState("");
  const [city, setCity] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");              // the CONFIRMED value
  const [stage, setStage] = useState("ok");            // ok | enter | confirm
  const [emailNew, setEmailNew] = useState("");
  const [email2, setEmail2] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    getJSON("/account").then((a) => {
      if (!live || !a) return;
      setAcct(a);
      setName(a.display_name || ""); setRole(a.role || ""); setStateName(a.state || "");
      setCity(a.city || ""); setSchool(a.school_name || ""); setEmail(a.email || "");
      /* No address on file → open straight at the entry step; there is nothing to view. */
      setStage(a.email ? "ok" : "enter");
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  const save = () => {
    setBusy(true); setNote("");
    postJSON("/account", { name, email, role, state: stateName, city, school })
      .then(() => {
        /* ⚠️ HER NAME IS ON THE BAR AND IN THE GREETING, and both read a cached account. Without
           this, she renames herself and Meyy goes on calling her the old name until a relaunch —
           which is exactly what the web learnt on 2026-08-26. */
        invalidateAccount();
        router.back();                 // back to the cards (founder, 2026-08-26)
      })
      .catch((e) => {
        /* The SERVER'S OWN SENTENCE on a 4xx: a 409 here means the address belongs to another
           account, and "try again" is advice that can never work for it. */
        setNote(String((e && e.message) || "") || "Couldn’t save right now — try again.");
      })
      .finally(() => setBusy(false));
  };

  const verify = async () => {
    if (email2.trim().toLowerCase() !== emailNew.trim().toLowerCase()) {
      setEmailErr("The two entries don’t match — try again."); setEmail2("");
      return;
    }
    setEmailBusy(true);
    const taken = await idInUse(emailNew, acct && acct.account_id);
    setEmailBusy(false);
    if (taken) { setEmailErr(EMAIL_TAKEN); setEmail2(""); setStage("enter"); return; }
    setEmail(emailNew.trim()); setStage("ok"); setEmailErr("");
  };

  if (!acct) return <Text style={[ws.fr_loading, { padding: 18 }]}>Loading…</Text>;

  return (
    /* Same keyboard rule as Support (2026-09-16): without this the trailing Save sits below a
       scroll range the keyboard does not extend, so it cannot be reached while a field is
       focused. Not reported here — fixed because it is the identical shape. */
    <ScrollView contentContainerStyle={[ws.main, { paddingTop: 6 }]}
      keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {/* No heading — the Settings bar names this screen. Labels ABOVE the boxes (founder,
          2026-08-26: placeholder-only left fields ambiguous once filled). */}
      <Field label="Your name">
        <Input value={name} onChangeText={setName} placeholder="Enter your full name" />
      </Field>

      {/* Her mobile is the account identifier and is not editable here. */}
      <View style={[ws.acct_row, { borderBottomColor: t.line_soft }]}>
        <Text style={[ws.acct_k, { color: t.ink_soft }]}>Mobile</Text>
        <Text style={[ws.acct_v, { color: t.ink }]}>{acct.phone || "—"}</Text>
      </View>

      {stage === "ok" ? (
        <Field label="Email">
          <View style={[ws.ob_email_view, { borderColor: t.line, backgroundColor: t.card_bg }]}>
            <Text style={[ws.ob_email_addr, { color: t.ink, fontSize: emailSize(email) }]}>
              {email || "—"}
            </Text>
            <Link title="change"
              onPress={() => { setEmailNew(""); setEmail2(""); setStage("enter"); }} />
          </View>
        </Field>
      ) : null}

      {stage === "enter" ? (
        <>
          <Field label="New email">
            <Input value={emailNew} placeholder="Enter your email"
              onChangeText={(v) => { setEmailNew(v); setEmailErr(""); }}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </Field>
          {/* The taken-address message lands HERE — the stage the fix belongs to. */}
          <ErrorLine>{emailErr}</ErrorLine>
          {EMAIL_OK(emailNew) ? (
            <Link title="Confirm this email →"
              onPress={() => { setEmail2(""); setStage("confirm"); }} />
          ) : null}
        </>
      ) : null}

      {stage === "confirm" ? (
        <>
          <Field label="Re-enter your email">
            <Input value={email2} placeholder="Type it again to confirm" autoFocus
              onChangeText={(v) => { setEmail2(v); setEmailErr(""); }}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </Field>
          <ErrorLine>{emailErr}</ErrorLine>
          <Link title={emailBusy ? "Checking…" : "Verify →"}
            onPress={!EMAIL_OK(email2) || emailBusy ? undefined : verify} />
        </>
      ) : null}

      <Field label="Role">
        <Dropdown value={role} onChange={setRole} options={ROLES}
          placeholder="Select your role" label="Role" />
      </Field>
      <Field label="State">
        <Dropdown value={stateName} onChange={setStateName} options={STATES}
          placeholder="Select your state" label="State" />
      </Field>
      <Field label="City">
        <Input value={city} onChangeText={setCity} placeholder="Enter your city" />
      </Field>
      <Field label="School name (optional)">
        <Input value={school} onChangeText={setSchool} placeholder="Enter your school name" />
      </Field>

      <Button title={busy ? "Saving…" : "Save"} busy={busy} disabled={busy}
        onPress={save} style={{ marginTop: 16 }} />
      {stage !== "ok" ? (
        <Quiet>Email isn’t saved until you confirm it — everything else saves now.</Quiet>
      ) : null}
      {note ? <Quiet>{note}</Quiet> : null}
    </ScrollView>
  );
}
