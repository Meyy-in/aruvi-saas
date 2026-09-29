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
import { useEffect, useRef, useState } from "react";
import { View, ScrollView, Keyboard, Platform, Switch } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { Text } from "../../../components/Text";
import { getJSON, postJSON, idInUse, ROLES, STATES, EMAIL_TAKEN,
         ROLE_OTHER, roleChoice, roleOtherText, roleToSave } from "@aruvi/shared/format";
import { invalidateAccount } from "@aruvi/shared/account";
import { Field, Input, Button, Link, Quiet, ErrorLine } from "../../../components/ui";
import Dropdown from "../../../components/Dropdown";
import EmailEntry, { matchedDraft } from "../../../components/EmailEntry";
import { Sheet } from "../../../components/AttachSheet";
import { useTheme } from "../../../theme/ThemeContext";
import { useWebStyles } from "../../../theme/web";

export default function PersonalProfile() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();

  const navigation = useNavigation();
  const [acct, setAcct] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");               // the drop-down CHOICE (WALK-A-126)
  const [roleOther, setRoleOther] = useState("");     // her own words when the choice is Other
  const [stateName, setStateName] = useState("");
  const [city, setCity] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");              // the CONFIRMED value
  /* The open change, if any — EmailEntry reports every keystroke (WALK-A-125). */
  const [emailDraft, setEmailDraft] = useState({ editing: false, first: "", second: "" });
  /* ★ WHATSAPP SUPPORT (WALK-A-142 — the web's 2026-09-26 rule, ported). AT LEAST ONE CHANNEL,
     ALWAYS: she can switch WhatsApp off only while a CONFIRMED email is on the form; without one
     the switch stays on, locked, and says why. The server enforces the same rule (409). */
  const [wa, setWa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    getJSON("/account").then((a) => {
      if (!live || !a) return;
      setAcct(a);
      setName(a.display_name || ""); setRole(roleChoice(a.role)); setRoleOther(roleOtherText(a.role));
      setStateName(a.state || ""); setCity(a.city || ""); setSchool(a.school_name || "");
      setEmail(a.email || "");
      setWa(!!a.whatsapp);
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  /* ★ LEAVING WITH UNSAVED CHANGES ASKS FIRST (WALK-A-133). `beforeRemove` catches every way this
     screen can go — the bar's ✕ (router.back), hardware Back, the swipe, and a nav tab that pops
     the Settings stack — so one listener covers them all. Save is the default answer. */
  const dirtyRef = useRef(false);
  /* WALK-A-140 (iPhone): once a save has succeeded, THIS exit is not a question. A render between
     the save and router.back() recomputes dirtyRef from the not-yet-refreshed `acct`, so the
     guard cannot rely on dirtyRef alone — `leavingRef` says "we are going, on purpose". */
  const leavingRef = useRef(false);
  const [askLeave, setAskLeave] = useState(null);
  /* WALK-A-141 (Android): with the keyboard up, Save at the foot could not be scrolled into view —
     `automaticallyAdjustKeyboardInsets` is iOS-only and edge-to-edge Android does not shrink the
     window. Pad the content by the keypad's measured height while it is up (Support's idiom). */
  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const up = Keyboard.addListener("keyboardDidShow",
      (e) => setKbH(Math.round((e && e.endCoordinates && e.endCoordinates.height) || 320)));
    const down = Keyboard.addListener("keyboardDidHide", () => setKbH(0));
    return () => { up.remove(); down.remove(); };
  }, []);
  dirtyRef.current = !!acct && (
    name !== (acct.display_name || "") || roleToSave(role, roleOther) !== (acct.role || "")
    || stateName !== (acct.state || "") || city !== (acct.city || "")
    || school !== (acct.school_name || "") || email !== (acct.email || "")
    || wa !== !!acct.whatsapp
    || (emailDraft.editing && !!(emailDraft.first.trim() || emailDraft.second.trim())));
  useEffect(() => navigation.addListener("beforeRemove", (e) => {
    if (leavingRef.current || !dirtyRef.current) return;
    e.preventDefault();
    setAskLeave(() => () => { leavingRef.current = true; navigation.dispatch(e.data.action); });
  }), [navigation]);

  const canSave = !!String(name || "").trim() && !!String(city || "").trim()
    && (role !== ROLE_OTHER || !!roleToSave(role, roleOther));

  /* An open email change: a matched pair is folded into Save; an unmatched one stops it and says
     so — never the old address saved behind her back (WALK-A-125). */
  const pendingEmail = async () => {
    if (!emailDraft.editing) return email;
    const v = matchedDraft(emailDraft);
    if (v === null) {
      if (!emailDraft.first.trim() && !emailDraft.second.trim()) return email;
      setNote("Your new email isn’t confirmed yet — type it twice and tap Confirm, or tap change to keep the old one.");
      return null;
    }
    if (await idInUse(v, acct && acct.account_id)) { setNote(EMAIL_TAKEN); return null; }
    setEmail(v);
    return v;
  };

  /* Resolves true once saved. `leave` = go back to the cards (the plain Save); the leave-window
     passes false and runs the exit she chose instead. */
  const save = async (leave = true) => {
    setBusy(true); setNote("");
    const mail = await pendingEmail();
    if (mail === null) { setBusy(false); return false; }
    try {
      await postJSON("/account", { name, email: mail, role: roleToSave(role, roleOther),
                                   state: stateName, city, school, whatsapp: wa });
      /* ⚠️ HER NAME IS ON THE BAR AND IN THE GREETING, and both read a cached account. */
      invalidateAccount();
      dirtyRef.current = false;
      leavingRef.current = true;
      if (leave) router.back();         // back to the cards (founder, 2026-08-26)
      return true;
    } catch (e) {
      /* The SERVER'S OWN SENTENCE on a 4xx (a 409 = the address is someone else's). */
      setNote((e && e.detail) || "Couldn’t save right now — try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!acct) return <Text style={[ws.fr_loading, { padding: 18 }]}>Loading…</Text>;

  return (
    /* Same keyboard rule as Support (2026-09-16): without this the trailing Save sits below a
       scroll range the keyboard does not extend, so it cannot be reached while a field is
       focused. Not reported here — fixed because it is the identical shape. */
    <ScrollView contentContainerStyle={[ws.main, { paddingTop: 6 },
                                       Platform.OS === "android" && kbH ? { paddingBottom: kbH + 24 } : null]}
      keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {/* No heading — the Settings bar names this screen. Labels ABOVE the boxes (founder,
          2026-08-26: placeholder-only left fields ambiguous once filled). */}
      <Field label="Your name">
        <Input value={name} onChangeText={setName} placeholder="Enter your full name" />
      </Field>

      {/* Her mobile is the account identifier and is not editable here. */}
      <View style={[ws.acct_row, { borderBottomColor: t.line_soft, marginTop: 18 }]}>
        <Text style={[ws.acct_k, { color: t.ink_soft }]}>Mobile</Text>
        <Text style={[ws.acct_v, { color: t.ink }]}>{acct.phone || "—"}</Text>
      </View>

      <EmailEntry current={email} label="Email" selfId={acct.account_id} disabled={busy}
        onConfirmed={(v) => { setEmail(v); return ""; }} onDraft={setEmailDraft} />

      {(() => {
        const hasMail = !emailDraft.editing && !!String(email || "").trim();
        const locked = wa && !hasMail;
        return (
          <Field label="WhatsApp support">
            <View style={[ws.ob_email_view, { borderColor: t.line, backgroundColor: t.card_bg }]}>
              <Text style={[ws.ob_email_addr, { color: t.ink }]}>{wa
                ? "On — Meyy support on WhatsApp from your sign-in number" : "Off"}</Text>
              <Switch value={wa} disabled={locked || busy} onValueChange={setWa}
                accessibilityLabel="Use WhatsApp for Meyy support"
                trackColor={{ true: t.pine }} />
            </View>
            {locked ? (
              <Quiet>To switch WhatsApp off, add an email address above first — Meyy needs at
                least one way to reach you for your invoices and for legal and privacy notices.</Quiet>
            ) : null}
          </Field>
        );
      })()}

      <Field label="Role">
        <Dropdown value={role} onChange={setRole} options={ROLES}
          placeholder="Select your role" label="Role" />
      </Field>
      {role === ROLE_OTHER ? (
        <Field label="Your role *">
          <Input value={roleOther} onChangeText={setRoleOther}
            placeholder="e.g. Librarian, Special educator" />
        </Field>
      ) : null}
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

      <Button title={busy ? "Saving…" : "Save"} busy={busy} disabled={busy || !canSave}
        onPress={() => save(true)} style={{ marginTop: 16 }} />
      {note ? <Quiet>{note}</Quiet> : null}

      {askLeave ? (
        <Sheet visible onClose={() => setAskLeave(null)} title="Save your changes?">
          <Text style={[ws.acct_final_p, { color: t.ink_soft }]}>
            You’ve changed your personal profile and not saved it.</Text>
          <Button title={busy ? "Saving…" : "Save"} busy={busy} disabled={busy || !canSave}
            style={{ marginTop: 14 }}
            onPress={async () => { const go = askLeave; if (await save(false)) { setAskLeave(null); go(); } else setAskLeave(null); }} />
          <Button title="Leave without saving" kind="secondary"
            style={{ marginTop: 10, borderWidth: 1, borderColor: t.pine }}
            onPress={() => { const go = askLeave; setAskLeave(null); go(); }} />
        </Sheet>
      ) : null}
    </ScrollView>
  );
}
