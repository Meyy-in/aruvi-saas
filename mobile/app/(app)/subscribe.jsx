/* ───────── The subscribe wizard (6b·D2, Q11) ─────────
 *
 * ★ IT REALLY BUYS. `POST /onboarding/checkout` is a server-side DEV STUB that activates through
 * the ManualBillingProvider — so every walk of this grants real scopes to a real account. There
 * is no fake gateway and the Pay screen says so in its own words rather than pretending.
 *
 * ★ THE IN-APP DOOR, which is the one the phone has. The web serves two: the FRONT DOOR (Login's
 * subscribe path, entered after OTP, which also raises the Trial/Subscribe fork) and IN-APP (the
 * paywall's and Settings' Subscribe, for a teacher already signed in). ⚠️ The trial fork is
 * deliberately absent here and must stay absent: it belongs to a teacher who has not started,
 * and offering a trial to one whose trial has ended is an offer Aruvi cannot honour. The front
 * door arrives with Login's own subscribe path.
 *
 * ★ THE AGREEMENT SITS BEFORE THE CART, not before Pay (founder, 2026-08-27). The five points say
 * what Meyy IS — a teaching aid, not endorsed by any board, no student data, AI-assisted,
 * personally licensed — and she should have those five facts before she picks what to buy. After
 * the cart it would arrive as an obstacle between her and a purchase she had already assembled.
 *
 * ★ A KNOWN PROFILE SKIPS "About you" (founder, 2026-08-26): a subscriber adding a subject gave
 * her name, email, role and state at her first checkout, and asking again is friction with no
 * purpose. It skips to the AGREEMENT, never past it — and the agreement step forwards ITSELF to
 * the cart when the current version is already accepted. One door, one rule, so a third entrance
 * cannot forget. ⚠️ And `skippedAbout` is why Back then leaves the wizard rather than walking
 * into a personal-details form she was never shown.
 *
 * ★ PREFILL ALWAYS, even when skipping: checkout OVERWRITES the account fields, so resending her
 * existing values is what preserves them.
 *
 * ⚠️ A PAIR MAY BE BOUGHT ONCE. The billing unit is subject × stage, so `cartScopes` de-dupes —
 * which means a second row of the same pair would show her two rows and charge for one. Rather
 * than validate after the fact the choice is not offered: a pair taken by another row or already
 * held is disabled and says which, and a subject whose every stage is spoken for is disabled
 * whole. Never disable a row's OWN value, or changing her mind strands the wheel on a dead option.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text, TextInput } from "../../components/Text";
import { getJSON, postJSON, pretty, subjectStageMap, idInUse,
         ROLES, STATES, EMAIL_OK, EMAIL_TAKEN } from "@aruvi/shared/format";
import { dateWords } from "@aruvi/shared/legalmd";
import { invalidateEntitlement } from "@aruvi/shared/entitlement";
import { invalidateAccount } from "@aruvi/shared/account";
import Agreement from "../../components/Agreement";
import Dropdown from "../../components/Dropdown";
import { Button, Link, Input, Quiet, ErrorLine } from "../../components/ui";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";
import { type } from "../../theme/type";

/* Secondary says Class 9 only for now — the Class 10 books are not out yet (founder,
   2026-08-25). ⚠️ NOT `shared/format`'s `STAGE_CLASSES`, which is the SUBSCRIPTION ledger's
   wording ("6, 7 & 8"); this one says "Class 6, 7 & 8" because it stands alone under a row
   rather than in a column headed CLASS. Two strings, two jobs, both the founder's. */
const CART_STAGE_CLASSES = { preparatory: "Class 3, 4 & 5", middle: "Class 6, 7 & 8",
                             secondary: "Class 9 (Class 10 coming soon)" };
const scopeLabel = (scope) => {
  const [s, st] = String(scope).split("/");
  return `${pretty(s)} · ${pretty(st)}`;
};
const maskEmail = (e) => {
  const [u, d] = String(e).split("@");
  if (!d) return "•••";
  return `${u.slice(0, 1)}•••@${d}`;
};
const STEP_NAMES = ["Verify", "About you", "Agreement", "Subjects", "Pay"];

function Steps({ at }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <View style={ws.ob_steps}>
      {STEP_NAMES.map((n, i) => {
        const lit = i <= at;
        return (
          <View key={n} style={ws.ob_step}>
            {i < STEP_NAMES.length - 1 ? (
              <View style={[ws.ob_step_rule, { backgroundColor: t.line }]} />
            ) : null}
            <View style={[ws.ob_step_n, { borderColor: lit ? t.pine : t.line,
                                          backgroundColor: lit ? t.pine : t.card_bg }]}>
              <Text style={[ws.ob_step_n_t, { color: lit ? "#fdfaf4" : t.ink_soft }]}>{i + 1}</Text>
            </View>
            <Text style={[ws.ob_step_l, { color: i === at ? t.ink : t.ink_soft }]}>{n}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function Subscribe() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();

  /* ★ NULL UNTIL WE KNOW WHICH SCREEN THIS IS (founder, 2026-09-16: "pressing 'add subjects &
     stages' momentarily pops up profile (tell us something about you) page and then the
     subscription page"). It used to start at "about" and be MOVED by the /account answer, so
     every subscriber adding a subject met a personal-details form for one frame — a form she
     had never asked for and which then vanished, which reads as a glitch and, worse, as though
     Meyy had forgotten her. The entry screen is a DECISION, and a decision cannot be painted
     before it is made. The shell's activation gate holds on bare paper for exactly this reason. */
  const [screen, setScreen] = useState(null);       // null | about | agreement | cart | pay
  /* null = the account has not answered yet; true = her details are complete. */
  const [profileKnown, setProfileKnown] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [emailStage, setEmailStage] = useState("enter");   // enter | confirm | ok
  const [emailErr, setEmailErr] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [role, setRole] = useState("");
  const [stateName, setStateName] = useState("");
  const [city, setCity] = useState("");
  const [school, setSchool] = useState("");
  const [consent, setConsent] = useState(null);
  const [stageMap, setStageMap] = useState(null);
  const [owned, setOwned] = useState([]);
  const [skippedAbout, setSkippedAbout] = useState(false);
  const [trialChapters, setTrialChapters] = useState([]);
  const [rows, setRows] = useState([{ subject: "", stage: "" }]);
  const [price, setPrice] = useState(500);
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState("");
  const acctRef = useRef(null);

  /* ★ A FINISHED PURCHASE MUST LAND SOMEWHERE, however she arrived (found walking the
     checkout, 2026-09-16: reached by a deep link the stack had nothing behind it, the POST
     returned 200 and `router.back()` threw "The action 'GO_BACK' was not handled" — so the
     money moved and the screen did not). From Settings there is always a stack; from a
     notification, a deep link or a cold start there may not be, and that is exactly when it
     matters most. Subscription & billing is the honest destination either way: it is where
     what she just bought now appears. */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/settings/subscription");
  };

  useEffect(() => {
    let live = true;
    getJSON("/account").then((a) => {
      if (!live || !a) return;
      acctRef.current = a;
      const nm = (a.display_name || "").trim();
      const looksReal = nm && !/^\d+$/.test(nm);          // a number is not a name
      if (looksReal) setName(nm);
      if (a.email) { setEmail(a.email); setEmailStage("ok"); }
      if (a.role) setRole(a.role);
      if (a.state) setStateName(a.state);
      if (a.city) setCity(a.city);
      if (a.school_name) setSchool(a.school_name);
      setProfileKnown(!!(looksReal && a.email && a.role && a.state));
    }).catch(() => { if (live) setProfileKnown(false); });
    return () => { live = false; };
  }, []);

  /* ── Where she starts, decided once both answers are in ──────────────────────────────
     Waiting for the CONSENT answer too is what keeps the second flash away: a known profile
     goes to the agreement, which forwards itself to the cart, so deciding on the account alone
     would paint the agreement for a frame instead of the profile. One decision, one paint. */
  useEffect(() => {
    if (screen !== null || profileKnown === null || consent === null) return;
    if (!profileKnown) { setScreen("about"); return; }
    /* Remember that About-you was SKIPPED: Back should undo what she did, and what she did was
       open the chooser — not walk into a details form she was never shown. */
    setSkippedAbout(true);
    setScreen(consent.accepted ? "cart" : "agreement");
  }, [screen, profileKnown, consent]);

  /* Ask once. A failure leaves consent at a NOT-accepted shape rather than null: if we cannot
     tell whether she has signed, the honest move is to show her the agreement, not to wave her
     through to a checkout the server will refuse anyway. */
  useEffect(() => {
    let live = true;
    getJSON("/legal/consent/status")
      .then((d) => { if (live) setConsent(d || { accepted: false }); })
      .catch(() => { if (live) setConsent({ accepted: false }); });
    return () => { live = false; };
  }, []);

  /* The agreement step forwards itself when there is nothing to sign. An effect rather than a
     branch at each entrance, because there are two entrances and a third would forget. */
  useEffect(() => {
    if (screen === "agreement" && consent && consent.accepted) setScreen("cart");
  }, [screen, consent]);

  useEffect(() => {
    if (screen !== "cart" || stageMap) return;
    getJSON("/entitlement").then((d) => {
      if (d && d.price_per_subject_stage) setPrice(d.price_per_subject_stage);
      /* What she already holds, LIVE, is not for sale again — the server's own answer; the
         client never compares dates. A trial's "*" is not a holding: it would swallow the
         whole catalogue. */
      const live = (d && Array.isArray(d.live_scopes)) ? d.live_scopes : [];
      setOwned(d && d.status === "trial" ? [] : live.filter((s) => s !== "*"));
      setTrialChapters(d && d.status === "trial" ? (d.trial_chapters || []) : []);
    }).catch(() => {});
    /* ONE shared call, and it fans the per-subject requests out in PARALLEL — see
       `subjectStageMap`. The serial version was six round trips to Render. */
    subjectStageMap().then(setStageMap).catch(() => setStageMap({}));
  }, [screen, stageMap]);

  const cartScopes = useMemo(() => Array.from(new Set(
    rows.filter((r) => r.subject && r.stage).map((r) => `${r.subject}/${r.stage}`))), [rows]);
  const total = cartScopes.length * price;

  const verifyEmail = async () => {
    if (email2.trim().toLowerCase() !== email.trim().toLowerCase()) {
      /* A mismatch says only that the two DISAGREE, and the typo is at least as likely to be in
         the first — so it returns to the first field with her text intact and visible, which is
         the only place the real address can be established (founder, 2026-08-27). */
      setEmailErr("The two entries don’t match — try again.");
      setEmail2(""); setEmailStage("enter");
      return;
    }
    setEmailBusy(true);
    const taken = await idInUse(email, (acctRef.current || {}).account_id);
    setEmailBusy(false);
    if (taken) { setEmailErr(EMAIL_TAKEN); setEmail2(""); setEmailStage("enter"); return; }
    setEmailErr(""); setEmailStage("ok");
  };

  const doCheckout = () => {
    setPayBusy(true); setPayErr("");
    postJSON("/onboarding/checkout", {
      scopes: cartScopes, name, email: email.trim(), role, state: stateName, city, school,
    })
      .then(() => {
        /* Both stores hold what this just changed — her scopes and her account fields — and
           both are read by screens she lands on next. */
        invalidateEntitlement();
        invalidateAccount();
        leave();
      })
      .catch((e) => {
        const detail = (e && e.detail)
          || "Couldn’t complete the activation. Try again in a moment.";
        /* A consent refusal has a PLACE to send her, so send her there: the server refuses a
           checkout without a current-version acceptance, which realistically means a new version
           was published between her reading one and paying. An error on the Pay screen would
           leave her with advice she cannot act on from where she is standing. */
        if (e && e.status === 409 && /User Agreement/i.test(detail)) {
          setConsent((c) => ({ ...(c || {}), accepted: false }));
          setPayBusy(false);
          setScreen("agreement");
          return;
        }
        setPayErr(detail);
        setPayBusy(false);
      });
  };

  /* Hold on bare paper while the entry screen is being decided — no words and no spinner: it
     is one round trip, and a message that flashes is the thing being removed. */
  if (screen === null) return <View style={{ flex: 1, backgroundColor: t.paper }} />;

  /* ── 2 · About you ───────────────────────────────────────────── */
  if (screen === "about") {
    const ready = name.trim() && emailStage === "ok" && role && stateName;
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        <ScrollView contentContainerStyle={ws.ob_body} keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          <Steps at={1} />
          <Text style={[ws.ob_title, { color: t.ink }]}>Tell us a bit about yourself</Text>
          <Text style={[ws.ob_sub, { color: t.ink_soft }]}>
            For your receipt and your account — nothing more.</Text>

          <Field label="Your name">
            <Input value={name} onChangeText={setName} placeholder="Enter your full name" />
          </Field>

          {/* Email — DOUBLE BLIND: she types it once, it is then hidden, and she types it
              again fresh. Only a match confirms; a typo cannot be rubber-stamped by reading
              the first entry back. */}
          {emailStage === "enter" ? (
            <>
              <Field label="Email">
                <Input value={email} placeholder="Enter your email"
                  onChangeText={(v) => { setEmail(v); setEmailErr(""); }}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              </Field>
              <ErrorLine>{emailErr}</ErrorLine>
              {EMAIL_OK(email) ? (
                <Link title="Confirm this email →" style={{ textAlign: "left" }}
                  onPress={() => { setEmail2(""); setEmailStage("confirm"); }} />
              ) : null}
            </>
          ) : null}
          {emailStage === "confirm" ? (
            <>
              <Field label="Re-enter your email">
                <Input value={email2} placeholder="Type it again to confirm" autoFocus
                  onChangeText={(v) => { setEmail2(v); setEmailErr(""); }}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              </Field>
              <ErrorLine>{emailErr}</ErrorLine>
              <Link title={emailBusy ? "Checking…" : "Verify →"} style={{ textAlign: "left" }}
                onPress={!EMAIL_OK(email2) || emailBusy ? undefined : verifyEmail} />
            </>
          ) : null}
          {emailStage === "ok" ? (
            <Field label="Email">
              <View style={[ws.ob_email_view, { borderColor: t.line, backgroundColor: t.card_bg }]}>
                <Text style={[ws.ob_email_addr, { color: t.ink }]}>
                  <Text style={[ws.ob_tick, { color: t.pine }]}>✓ </Text>{maskEmail(email)}
                </Text>
                <Link title="change" onPress={() => {
                  setEmail(""); setEmail2(""); setEmailStage("enter");
                }} />
              </View>
            </Field>
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
        </ScrollView>
        <View style={[ws.ob_foot, { backgroundColor: t.paper }]}>
          <Button title="Save & continue →" disabled={!ready}
            onPress={() => setScreen("agreement")} style={{ width: "100%" }} />
          <Link title="← Back" onPress={leave} />
        </View>
      </View>
    );
  }

  /* ── 3 · Agreement ───────────────────────────────────────────────────────── */
  if (screen === "agreement") {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        <Agreement mode="sign" context="subscribe"
          onAccepted={() => {
            setConsent((c) => ({ ...(c || {}), accepted: true }));
            setScreen("cart");
          }}
          onBack={() => (skippedAbout ? leave() : setScreen("about"))} />
      </View>
    );
  }

  /* ── 4 · Subjects ────────────────────────────────────────────────────────── */
  if (screen === "cart") {
    const subjectsAvail = stageMap ? Object.keys(stageMap) : [];
    const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const dropRow = (i) => setRows((rs) =>
      rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ subject: "", stage: "" }]);
    const takenElsewhere = (subject, stage, self) => rows.some(
      (r, j) => j !== self && r.subject === subject && r.stage === stage)
      || owned.includes(`${subject}/${stage}`);
    const alreadyOwned = (subject, stage) => owned.includes(`${subject}/${stage}`);
    const subjectFull = (subject, self) => {
      const stages = stageMap[subject] || [];
      return stages.length > 0 && stages.every((st) => takenElsewhere(subject, st, self));
    };
    const nothingLeft = subjectsAvail.length > 0 && subjectsAvail.every((s) => subjectFull(s, -1));
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        <ScrollView contentContainerStyle={ws.ob_body} keyboardShouldPersistTaps="handled">
          <Steps at={3} />
          <Text style={[ws.ob_title, { color: t.ink }]}>What do you teach?</Text>
          <Text style={[ws.ob_sub, { color: t.ink_soft }]}>
            Each subject & stage is its own subscription — unlimited lesson plans across all its
            classes. The total updates as you add.</Text>

          {!stageMap ? <Text style={ws.fr_loading}>Loading subjects…</Text> : null}
          {stageMap ? rows.map((r, i) => (
            <View key={i} style={[ws.ob_row, { borderColor: t.line, backgroundColor: t.card_bg }]}>
              <View style={ws.ob_row_selects}>
                <View style={ws.ob_rowdd}>
                  <Dropdown value={r.subject} placeholder="Subject" label="Subject"
                    onChange={(v) => setRow(i, { subject: v, stage: "" })}
                    options={subjectsAvail.map((s) => {
                      const full = subjectFull(s, i);
                      return { value: s, disabled: full,
                               label: pretty(s) + (full ? " — all stages added" : "") };
                    })} />
                </View>
                <View style={ws.ob_rowdd}>
                  <Dropdown value={r.stage} disabled={!r.subject} placeholder="Stage"
                    label="Stage" onChange={(v) => setRow(i, { stage: v })}
                    options={(stageMap[r.subject] || []).map((st) => {
                      const dup = takenElsewhere(r.subject, st, i);
                      const mine = alreadyOwned(r.subject, st);
                      return { value: st, disabled: dup,
                               label: pretty(st) + (mine ? " · you have this"
                                                         : dup ? " · already added" : "") };
                    })} />
                </View>
                <Pressable onPress={() => dropRow(i)} hitSlop={8} style={ws.ob_row_x}
                  accessibilityRole="button" accessibilityLabel="Remove this row">
                  <Text style={[ws.ob_row_x_t, { color: t.ink_soft }]}>✕</Text>
                </Pressable>
              </View>
              {r.stage ? (
                <Text style={[ws.ob_row_classes, { color: t.pine }]}>
                  {CART_STAGE_CLASSES[r.stage]}</Text>
              ) : null}
            </View>
          )) : null}

          {stageMap ? (
            <Pressable disabled={nothingLeft} style={ws.ob_addrow}
              accessibilityRole="button"
              onPress={() => setRows((rs) => [...rs, { subject: "", stage: "" }])}>
              <Text style={[ws.ob_addrow_t, { color: nothingLeft ? t.ink_soft : t.pine,
                                              opacity: nothingLeft ? 0.55 : 1 }]}>
                + Add another subject & stage</Text>
            </Pressable>
          ) : null}

          <View style={[ws.ob_total, { borderTopColor: t.line }]}>
            <Text style={[ws.ob_total_t, { color: t.ink }]}>Total</Text>
            <Text style={[ws.ob_total_b, { color: t.ink }]}>₹{total} / year</Text>
          </View>

          {/* Said once, quietly, where it is true: she is past the agreement. It also tells the
              returning subscriber — who never saw the step — WHY she didn't, and where to read
              it again. */}
          {consent && consent.accepted ? (
            <Text style={[ws.ob_quiet, ws.ob_consent_note, { color: t.ink_soft }]}>
              <Text style={[ws.ob_tick, { color: t.pine }]}>✓ </Text>
              User Agreement v{consent.accepted_version || consent.current_version} accepted
              {consent.accepted_at ? ` on ${dateWords(consent.accepted_at)}` : ""} · always
              readable under Settings › Legal.
            </Text>
          ) : null}
        </ScrollView>
        <View style={[ws.ob_foot, { backgroundColor: t.paper }]}>
          <Button title="Continue →" disabled={!cartScopes.length}
            onPress={() => setScreen("pay")} style={{ width: "100%" }} />
          <Link title="← Back"
            onPress={() => (skippedAbout ? leave() : setScreen("about"))} />
        </View>
      </View>
    );
  }

  /* ── 5 · Pay ─────────────────────────────────────────────────────────────── */
  const buying = new Set(cartScopes.map((s) => s.split("/")[0]));
  const droppedTrial = Array.from(new Set(
    (trialChapters || []).map((k) => String(k).split("/")[0]).filter((s) => s && !buying.has(s))));
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <ScrollView contentContainerStyle={ws.ob_body}>
        <Steps at={4} />
        <Text style={[ws.ob_title, { color: t.ink }]}>Review & pay</Text>
        {cartScopes.map((cid) => (
          <View key={cid} style={[ws.ob_payrow, { borderBottomColor: t.line_soft }]}>
            <Text style={[ws.ob_payrow_t, { color: t.ink }]}>{scopeLabel(cid)}</Text>
            <Text style={[ws.ob_payrow_t, { color: t.ink }]}>₹{price}</Text>
          </View>
        ))}
        <View style={[ws.ob_total, { borderTopColor: t.line }]}>
          <Text style={[ws.ob_total_t, { color: t.ink }]}>Total</Text>
          <Text style={[ws.ob_total_b, { color: t.ink }]}>₹{total} / year</Text>
        </View>

        {/* ★ SAID BEFORE SHE PAYS (founder, 2026-08-26 evening). Subscribing clears what the
            trial left in subjects she is NOT buying. That is her work disappearing, so it is
            stated on the screen with the money on it — the one place she can still change the
            cart — and not discovered afterwards in an emptier My Lessons. Named, because "some
            trial lessons" would send her hunting for which. */}
        {droppedTrial.length > 0 ? (
          <Text style={[ws.ob_quiet, ws.ob_purge_note,
                        { color: t.clay, borderLeftColor: t.edge_clay }]}>
            Your trial lessons in {droppedTrial.map(pretty).join(" and ")} will be cleared when
            this activates — {droppedTrial.length > 1 ? "those subjects are" : "that subject is"}
            {" "}not in your subscription. Everything in what you are subscribing to stays.
          </Text>
        ) : null}

        <Quiet>Preview build: online payment opens soon — this activates your subscription right
          away.</Quiet>
        {payErr ? (
          <Text accessibilityRole="alert" style={[ws.ob_err, { color: t.danger }]}>{payErr}</Text>
        ) : null}
      </ScrollView>
      <View style={[ws.ob_foot, { backgroundColor: t.paper }]}>
        <Button title={payBusy ? "Activating…" : `Pay ₹${total} & start →`} busy={payBusy}
          disabled={payBusy} onPress={doCheckout} style={{ width: "100%" }} />
        <Link title="← Back" onPress={() => setScreen("cart")} />
      </View>
    </View>
  );
}

/* The wizard's field wrapper — label above, the web's `.ob-field` 12px above each. */
function Field({ label, children }) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 12, rowGap: 6 }}>
      <Text style={[type.label, { color: t.ink_soft }]}>{label}</Text>
      {children}
    </View>
  );
}
