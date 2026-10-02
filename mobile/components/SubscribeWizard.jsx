/* ───────── The subscribe wizard (6b·D2, Q11) ─────────
 *
 * ★ IT REALLY BUYS. `POST /onboarding/checkout` is a server-side DEV STUB that activates through
 * the ManualBillingProvider — so every walk of this grants real scopes to a real account. There
 * is no fake gateway and the Pay screen says so in its own words rather than pretending.
 *
 * ★ TWO DOORS, ONE WIZARD — which is why this is a COMPONENT and not a screen (app. 03 rows 7,
 * 24, 40, owed since 2026-09-15 and closed 2026-09-17 on the founder's report that the phone's
 * choose screen offered *"only free to try ... subscribe does not"*). The web has had both since
 * the start and serves them from one `SubscribeFlow`; the phone had only the IN-APP door, as a
 * route, so the front door had nowhere to mount. The doors differ in exactly three things and
 * they are all props: where DONE goes, where CANCEL goes, and whether the Trial fork is offered.
 * ⚠️ `trialFork` IS THE FRONT DOOR'S ALONE and must stay so: it belongs to a teacher who has not
 * started, and offering a trial to one whose trial has ended is an offer Meyy cannot honour.
 * ⚠️ AND THE FRONT DOOR IS NOT "BEFORE SIGN-IN". By the time it mounts, the OTP is verified and
 * `POST /onboarding/verified` has created the account — she IS authenticated, and every call in
 * here needs that. What the front door skips is the APP, not the sign-in.
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
import { View, ScrollView, Pressable, KeyboardAvoidingView, Platform, BackHandler, Linking, Switch, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "./Text";
import { getJSON, postJSON, pretty, subjectStageMap, idInUse,
         ROLES, STATES, EMAIL_OK, EMAIL_TAKEN,
         ROLE_OTHER, roleChoice, roleOtherText, roleToSave,
         getUser, waLink, mobileWords, WHATSAPP_DISPLAY, invoiceLine } from "@aruvi/shared/format";
import EmailEntry from "./EmailEntry";
import { storage } from "@aruvi/shared/storage";
import { dateWords } from "@aruvi/shared/legalmd";
import { syncEntitlement } from "@aruvi/shared/entitlement";
import { notePurchase } from "../lib/purchase";
import { noteBoughtScopes } from "@aruvi/shared/setupCheck";
import { invalidateAccount } from "@aruvi/shared/account";
import { fetchReadiness } from "@aruvi/shared/readiness";
import Agreement from "./Agreement";
import Dropdown from "./Dropdown";
import { Button, Link, Input, Quiet, ErrorLine } from "./ui";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";
import { type } from "../theme/type";

/* ★ THE TRIAL OFFER IS ASKED ONCE PER APP RUN (WALK-A-045, founder 2026-09-20, iPhone). The web
   uses `sessionStorage`, which dies with the tab; the phone's `storage` is PERMANENT, so writing
   the flag there meant the window was answered once on a device and never shown again — to any
   teacher, on any number, for the life of the install. A module variable is the honest port: it
   lives exactly as long as the app process, which is what "this session" means here. */
let trialOfferSeen = false;

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

export default function SubscribeWizard({ onDone, onCancel, trialFork = false, notice = "" }) {
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
  const aboutScroll = useRef(null);   // WALK-A-040: the About-you form's scroller
  /* WALK-A-046: the foot must clear the navigation bar — ~48dp on 3-button navigation, and
     edge-to-edge is mandatory from Android 16. */
  const insets = useSafeAreaInsets();
  const footPad = { paddingBottom: 26 + insets.bottom };
  /* WALK-A-154 (founder, 2026-09-29): with the keypad up, About you shrank to ONE field between
     the frozen top and a lifted foot. The notice now scrolls with the form, and so does the foot
     (Save & continue · Back) — see the About screen. The step rail stays frozen (2026-09-20). */
  /* WALK-A-156 (founder, Android, 2026-09-29): with the keypad up she could not scroll past
     School name to the (now scrolling) Save & continue — under edge-to-edge the padding the
     KeyboardAvoidingView adds does not fully clear the keys on Android, so the end of the form
     stayed beneath them. Android gets exactly the covered strip as extra scroll room while it
     is up — and, as of the iPhone report the same day, on iOS too. */
  const [kbPad, setKbPad] = useState(0);
  useEffect(() => {
    /* BOTH phones (founder, iPhone, same day): the iPhone showed the same wall. The measure is
       exact, so where the KeyboardAvoidingView already clears the keys it adds nothing. */
    /* Only the part of the form the keys still COVER — measured, not the keypad's full height,
       which over-scrolled (City/School jumped the form up and left a blank under ← Back). The
       KeyboardAvoidingView has already cleared some of it; this is the remainder. */
    const a = Keyboard.addListener("keyboardDidShow", (e) => {
      const kbTop = e && e.endCoordinates ? e.endCoordinates.screenY : null;
      setTimeout(() => {
        const sv = aboutScroll.current;
        if (!sv || kbTop == null || !sv.measureInWindow) { setKbPad(0); return; }
        sv.measureInWindow((x, y, w, h) => setKbPad(Math.max(0, Math.round(y + h - kbTop))));
      }, 60);
    });
    const b = Keyboard.addListener("keyboardDidHide", () => setKbPad(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  /* WALK-A-040: bring the tail of the form (City + School) clear of the lifted foot. Twice — the
     keyboard is still rising at 120ms and the scroll range is not final until it has landed. */
  const tailUp = () => {
    setTimeout(() => aboutScroll.current?.scrollToEnd({ animated: true }), 120);
    setTimeout(() => aboutScroll.current?.scrollToEnd({ animated: true }), 420);
  };
  const [emailStage, setEmailStage] = useState("enter");   // enter | confirm | ok
  const [emailErr, setEmailErr] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  /* ★ WHATSAPP SUPPORT — ASKED, NEVER ASSUMED (WALK-A-142: the web's 2026-09-26 rule, ported).
     null = not yet answered and the step cannot continue; neither answer is preselected (a
     consent that arrives ticked is not one, DPDP §6). On her SIGN-IN mobile only. Yes makes the
     email OPTIONAL. `done` holds the checkout answer for the hello screen. */
  const [wa, setWa] = useState(null);
  const [done, setDone] = useState(null);
  const [role, setRole] = useState("");            // the drop-down CHOICE (WALK-A-126)
  const [roleOther, setRoleOther] = useState("");  // her own words when the choice is Other
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
  /* ★ THE TRIAL FORK, ON MOUNT — after Verify, before About-you, and once (the web's `offeredRef`).
     No screen test: the wizard's first screen IS About-you, so the offer has to be the thing
     standing in front of it, and firing on mount also covers the known-profile skip without
     naming a second entrance. Front door only — `trialFork` is false everywhere else. */
  const [offerTrial, setOfferTrial] = useState(false);
  const offeredRef = useRef(false);
  useEffect(() => {
    if (!trialFork || offeredRef.current) return;
    offeredRef.current = true;
    /* WALK-A-021 (2026-09-20): once per SESSION, not per mount — the wizard's own ← Back sends her
       to re-verify, which remounts this component, and the offer came back every time. The flag is
       `trialOfferSeen` above: app run, not install (WALK-A-045). */
    /* One-off cleanup: devices that took the persisted flag before WALK-A-045 would never be
       offered the trial again. Clearing it costs nothing on a device that never had it. */
    try { storage.removeItem("aruvi_trial_offer_seen"); } catch {}
    if (trialOfferSeen) return;
    trialOfferSeen = true;
    setOfferTrial(true);
  }, [trialFork]);

  /* WALK-A-042: the window's own exit. Forgetting `aruvi_trial_offer_seen` is deliberate — the
     flag exists so the wizard's ← Back (which remounts this component) does not re-ask, not to
     hold her to a question she declined to answer. `offeredRef` is per-mount and goes with it. */
  const leaveOffer = () => {
    trialOfferSeen = false;
    offeredRef.current = false;
    setOfferTrial(false);
    cancel();
  };
  /* Android's hardware Back is the same act. Registered only while the window is up, so every
     other screen's Back keeps its own meaning. */
  useEffect(() => {
    if (!offerTrial || Platform.OS !== "android") return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { leaveOffer(); return true; });
    return () => sub.remove();
  }, [offerTrial]);

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
  /* ★ DONE AND CANCEL ARE DIFFERENT DOORS, and only the front one knows it. In-app they are the
     same act — back to where she came from — so both default to `leave`. From the front door a
     finished purchase enters the APP and a cancelled one returns to the OTP screen, which is not
     a place this component can name. */
  /* ★ SHE LANDS ON WHAT SHE BOUGHT (WALK-A-129, founder 2026-09-28). In-app, a finished purchase
     goes to Subscription & billing — popping back to it when she came from there, taking this
     screen's place when she came from anywhere else (a paywall) — where the new card waits,
     scrolled to and tagged "New" (lib/purchase `recent`). Cancel still simply goes back. */
  const landOnPurchase = () => {
    try { router.dismissTo("/settings/subscription"); } catch { leave(); }
  };
  const finish = () => (onDone ? onDone() : landOnPurchase());
  const cancel = () => (onCancel ? onCancel() : leave());

  useEffect(() => {
    let live = true;
    getJSON("/account").then((a) => {
      if (!live || !a) return;
      acctRef.current = a;
      const nm = (a.display_name || "").trim();
      const looksReal = nm && !/^\d+$/.test(nm);          // a number is not a name
      if (looksReal) setName(nm);
      if (a.email) { setEmail(a.email); setEmailStage("ok"); }
      // Prefill only a YES: `false` is also what an account that was never asked reads as.
      if (a.whatsapp === true) setWa(true);
      if (a.role) { setRole(roleChoice(a.role)); setRoleOther(roleOtherText(a.role)); }
      if (a.state) setStateName(a.state);
      if (a.city) setCity(a.city);
      if (a.school_name) setSchool(a.school_name);
      /* A WhatsApp customer with no email is a COMPLETE profile — email is optional for her. */
      setProfileKnown(!!(looksReal && (a.email || a.whatsapp) && a.role && a.role !== "Other"
        && a.state));
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

  const doCheckout = () => {
    setPayBusy(true); setPayErr("");
    noteBoughtScopes(cartScopes);   // WALK-A-173: noted BEFORE the post — see setupCheck.js
    postJSON("/onboarding/checkout", {
      scopes: cartScopes, name, email: emailStage === "ok" ? email.trim() : "",
      /* null on the known-profile skip = "leave the stored choice" (server rule). */
      whatsapp: wa,
      role: roleToSave(role, roleOther), state: stateName, city, school,
    })
      .then((out) => {
        /* Both stores hold what this just changed — her scopes and her account fields — and
           both are read by screens she lands on next. */
        /* ★ RE-READ, DON'T BLANK (founder, 2026-09-18). `invalidateEntitlement()` dropped the copy,
           so Subscription & billing fell to "Your plan details will appear here" — her EXISTING
           subscriptions and their invoices vanished — until the 20-second poll came round. A
           forced read keeps what she had on screen until the new answer lands. Chained twice:
           a poll already in flight carries the pre-purchase answer, and `syncEntitlement` hands
           that same promise back to a second caller. */
        syncEntitlement().then(() => syncEntitlement());
        notePurchase(cartScopes);
        invalidateAccount();
        /* ★ AND SO DOES HER PROFILE (founder, 2026-09-17: "in expo, when i add, it does not
           appear there — it should mimic web app"). Every purchased scope becomes a ready-made
           profile entry SERVER-side (`_apply_subscription_profile`, api/main.py), so the subject
           she just bought is already in /readiness before she leaves this screen. The web
           rehydrates it in the same breath — "rehydrate it so the new cards appear without a
           reload" (page.jsx:1447) — and the phone did not, so `fetchReadiness` kept answering
           from the session copy (`fresh`) and My Lessons drew the profile she had BEFORE the
           purchase: no subject on the wheel, no card in My Classes, and no "would you like to
           check your set-up?" either, because the shell's diff (app/(app)/_layout.jsx) had
           nothing new to see.
           ⚠️ FORCED READ, not `invalidateReadiness()`. Invalidating drops the copy and sends the
           next screen to the network for a profile we are about to hold; the forced read
           write-throughs and EMITS, which is what the screens listening to the store redraw on.
           ⚠️ Not awaited: she leaves now, and the emit lands on whatever she lands on. */
        fetchReadiness({ force: true }).catch(() => {});
        /* ★ THE HELLO (WALK-A-142). A teacher who chose WhatsApp gets ONE more screen — keyed on
           the SERVER's stored answer, not on `wa`. Everyone else goes straight on, as before. */
        if (out && out.whatsapp) { setDone(out); setPayBusy(false); setScreen("done"); return; }
        finish();
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
  /* Drawn OVER whatever the wizard is showing, including the bare hold below — the web's
     `.ob-offer-back` is a backdrop at z-index 80, not a screen of its own. Dismissing with
     "Subscribe" simply closes it: she is already where she was going. */
  /* ★ WHY SHE IS HERE, when the door did not leave it to her (2026-09-18): a number whose free
     trial was used before an account deletion is sent straight to Subscribe, and must be told
     so in words — otherwise the Free-to-try card she tapped seems to have been ignored. The
     privacy-note bar's skin: a pine-edged line above the step, not an error. */
  /* ★ THE NOTICE HAS SAID ITS PIECE (founder, 2026-09-21, WALK-A-057). "This mobile number has
     already used its free trial" explains why she is on this path — and then sat above every
     screen of the wizard, pushing the step rail down and taking room she needs to fill the form.
     The moment she starts answering, she has accepted the answer; the bar goes. It never comes
     back in this wizard, because the reason has not changed and repeating it is nagging. */
  const started = !!(name || email || role || stateName || city || school);
  const noticeBar = notice && !started ? (
    <View style={[ws.pn_note, { borderColor: t.line, borderLeftColor: t.pine,
                                backgroundColor: t.paper_2, marginHorizontal: 16, marginTop: 12 }]}
      accessibilityRole="summary">
      <Text style={[ws.pn_note_t, { color: t.ink }]}>{notice}</Text>
    </View>
  ) : null;
  const trialWindow = offerTrial ? (
    /* ⚠️ `zIndex`, because it is the FIRST child of each screen's root and RN paints siblings in
       order — without it the scroller beneath would draw straight over the window. 80 is the
       web's own `.ob-offer-back` z-index, and `elevation` is what makes zIndex bite on Android. */
    <View style={[ws.ap_ground, { alignItems: "center", justifyContent: "center", padding: 20,
                                  zIndex: 80, elevation: 80 }]}>
      <View style={[ws.ap_modal, ws.ob_offer_box,
                    { backgroundColor: t.paper, borderColor: t.line }]}>
        <Text style={ws.ob_offer_title}>Would you like to try Meyy free first?</Text>
        <Text style={ws.ob_offer_body}>
          The free trial gives you any 3 chapters, unlimited lesson plans in each, and every
          feature you need to plan and assess — at no cost, with no time limit. You can subscribe
          whenever you{"\u2019"}re ready.
        </Text>
        {/* Said here because this is the FIRST screen of the wizard: choosing Trial costs her
            nothing she has already done. */}
        <Text style={ws.ob_offer_note}>
          Nothing to fill in — the trial starts straight away. Subscribing asks for your details
          first.
        </Text>
        <View style={ws.ob_offer_actions}>
          <Button title="Trial" onPress={() => { setOfferTrial(false); finish(); }} />
          <Pressable accessibilityRole="button" style={ws.ob_offer_alt}
            onPress={() => setOfferTrial(false)}>
            <Text style={ws.ob_offer_alt_t}>Subscribe</Text>
          </Pressable>
          {/* ★ WALK-A-042 (founder, 2026-09-20, iPhone): THIS WINDOW MUST HAVE A WAY OUT. It is a
              full-screen ground, so the wizard's own "← Back" sits beneath it and cannot be
              tapped, and the phone has no browser Back to escape with — a teacher who changed her
              mind had to buy a door to leave. Backing out un-spends the once-per-session offer:
              she has answered nothing, so a genuine return must ask again. */}
          <Link title="← Back" onPress={leaveOffer} />
        </View>
      </View>
    </View>
  ) : null;

  if (screen === null) {
    return <View style={{ flex: 1, backgroundColor: t.paper }}>{trialWindow}</View>;
  }

  /* ── 2 · About you ───────────────────────────────────────────── */
  if (screen === "about") {
    /* WALK-A-022 (founder, 2026-09-20): City is mandatory, and every required field is starred. */
    /* WALK-A-142: the WhatsApp question must be answered; with Yes, email is optional. */
    const ready = name.trim() && (wa === true || emailStage === "ok")
      && roleToSave(role, roleOther) && stateName && city.trim();
    /* WALK-A-031 (walk blocker, 2026-09-20): with a field focused the keyboard covered the foot,
       so "Save & continue" could not be reached without dismissing it. The screen now lifts its
       foot above the keyboard, so the CTA is ALWAYS visible — she may continue with the minimum. */
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.paper }}
        /* ⚠️ BOTH SURFACES (WALK-A-040, Android half, 2026-09-21). `undefined` on Android was
           right while the window resized for the keypad; under mandatory edge-to-edge it does
           not, so the keys simply covered City and School and the form could not be finished —
           the founder could not get past State. Same correction as the sign-in screen. */
        behavior="padding">
        {trialWindow}
        {/* The step rail stays FROZEN at the top (founder, walk 2026-09-20); only the form
            scrolls. automaticallyAdjustKeyboardInsets is dropped — the KeyboardAvoidingView
            already lifts the screen, and the two together over-shrank the scroll area. */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, backgroundColor: t.paper }}>
          <Steps at={1} />
        </View>
        <ScrollView ref={aboutScroll} contentContainerStyle={[ws.ob_body, { paddingTop: 10 }]} keyboardShouldPersistTaps="handled">
          {noticeBar ? <View style={{ marginHorizontal: -16, marginBottom: 12 }}>{noticeBar}</View> : null}
          <Text style={[ws.ob_title, { color: t.ink }]}>Tell us a bit about yourself</Text>
          <Text style={[ws.ob_sub, { color: t.ink_soft }]}>
            For your receipt and your account — nothing more.</Text>

          <Field label="Your name" required>
            <Input value={name} onChangeText={setName} placeholder="Enter your full name" />
          </Field>

          {/* Email — typed twice (EmailEntry, WALK-A-125): frozen + "change" once on record, two
              boxes and one Confirm while open, a mismatch that resets nothing. */}
          {/* WhatsApp — asked BEFORE email, because its answer decides whether email is required.
              ★ PERSONAL PROFILE'S SWITCH, SAME WORDS (founder, 2026-09-29, WALK-A-153) — the web's
              SubscribeFlow made the same change. Starts OFF (opt-in stays her own act); `wa` stays
              null until touched, which the server reads as "leave the stored choice". */}
          <Field label="WhatsApp support">
            <View style={[ws.ob_email_view, { borderColor: t.line, backgroundColor: t.card_bg }]}>
              <Text style={[ws.ob_email_addr, { color: t.ink }]}>{wa === true
                ? "On — Meyy support on WhatsApp from your sign-in number" : "Off"}</Text>
              <Switch value={wa === true} onValueChange={setWa}
                accessibilityLabel="Use WhatsApp for Meyy support"
                trackColor={{ false: t.edge, true: t.pine }}
                /* WALK-A-155: iOS draws the OFF track white with no fill; give both phones the same grey. */
                ios_backgroundColor={t.edge} />
            </View>
            <Quiet>Service messages only — never marketing.</Quiet>
          </Field>

          <EmailEntry current={emailStage === "ok" ? email : ""} mask
            selfId={(acctRef.current || {}).account_id}
            label={wa === true
              ? <>Email<Text style={{ color: t.ink_soft }}> (optional)</Text></>
              : <>Email<Text style={{ color: t.clay }}> *</Text></>}
            onConfirmed={(v) => { setEmail(v); setEmailStage("ok"); return ""; }} />

          <Field label="Role" required>
            <Dropdown value={role} onChange={setRole} options={ROLES}
              placeholder="Select your role" label="Role" />
          </Field>
          {role === ROLE_OTHER ? (
            <Field label="Your role" required>
              <Input value={roleOther} onChangeText={setRoleOther}
                placeholder="e.g. Librarian, Special educator" />
            </Field>
          ) : null}
          <Field label="State" required>
            {/* WALK-A-040 (founder, 2026-09-20): answering State used to light up Save while City
                and School sat below the fold — she could finish without ever seeing School. The
                rest of the form is brought into view when this question is answered. No-op when
                it already is, which is the common case once the email step has collapsed. */}
            <Dropdown value={stateName} onChange={(v) => {
              setStateName(v);
              setTimeout(() => aboutScroll.current?.scrollToEnd({ animated: true }), 180);
            }} options={STATES} placeholder="Select your state" label="State" />
          </Field>
          {/* ★ THE LAST TWO FIELDS COME UP TOGETHER (WALK-A-040, founder 2026-09-20, iPhone). The
              form is whole until City takes focus; then the foot lifts to sit above the keyboard
              and lands squarely over School, so a teacher filling in her city cannot see that a
              school was ever asked for. Focusing either one scrolls the pair clear of the foot —
              twice, because the first pass runs while the keyboard is still on its way up and the
              screen has not finished shrinking. */}
          <Field label="City" required>
            <Input value={city} onChangeText={setCity} placeholder="Enter your city"
              onFocus={tailUp} />
          </Field>
          <Field label="School name (optional)">
            <Input value={school} onChangeText={setSchool} placeholder="Enter your school name"
              onFocus={tailUp} />
          </Field>
          {/* ★ THE FOOT SCROLLS WITH THE FORM (founder, 2026-09-29, WALK-A-154) — it SUPERSEDES
              WALK-A-031's always-visible CTA. Save & continue arrives as she scrolls, like the
              fields above it, and gives the form the room it was holding. Focusing City or School
              still scrolls to the end (tailUp), so the button is on screen when the last field is. */}
          <View style={{ marginTop: 22, rowGap: 10, alignItems: "center", paddingBottom: insets.bottom + kbPad }}>
            <Button title="Save & continue →" disabled={!ready}
              onPress={() => setScreen("agreement")} style={{ width: "100%" }} />
            <Link title="← Back" onPress={cancel} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  /* ── 3 · Agreement ───────────────────────────────────────────────────────── */
  if (screen === "agreement") {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        {trialWindow}
        {noticeBar}
        {/* WALK-A-058 (founder, 2026-09-21): step 2 was the one screen of five with no rail, so
            the teacher lost her place in the middle of a five-step commitment — on the longest
            screen, the one she is least sure about. The rail is frozen here exactly as it is on
            About you; the Agreement scrolls beneath it. */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, backgroundColor: t.paper }}>
          <Steps at={2} />
        </View>
        <Agreement mode="sign" context="subscribe"
          onAccepted={() => {
            setConsent((c) => ({ ...(c || {}), accepted: true }));
            setScreen("cart");
          }}
          onBack={() => (skippedAbout ? cancel() : setScreen("about"))} />
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
        {trialWindow}
        {noticeBar}
        <ScrollView contentContainerStyle={ws.ob_body} keyboardShouldPersistTaps="handled">
          <Steps at={3} />
          <Text style={[ws.ob_title, { color: t.ink }]}>What do you teach?</Text>
          <Text style={[ws.ob_sub, { color: t.ink_soft }]}>
            Each subject & stage is its own subscription — unlimited lesson plans across all its
            classes. The total amount updates as you add.</Text>

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
        <View style={[ws.ob_foot, footPad, { backgroundColor: t.paper }]}>
          <Button title="Continue →" disabled={!cartScopes.length}
            onPress={() => setScreen("pay")} style={{ width: "100%" }} />
          <Link title="← Back"
            onPress={() => (skippedAbout ? cancel() : setScreen("about"))} />
        </View>
      </View>
    );
  }

  /* ── ★ The hello, after a WhatsApp checkout (WALK-A-142 — the web's 04.34) ── */
  if (screen === "done") {
    const welcomed = !!(done && done.whatsapp_welcome === "sent");
    const me = getUser();
    const hello = `Hello Meyy! I've just subscribed. My sign-in number is ${mobileWords(me)}`
      + (name.trim() ? ` — ${name.trim()}.` : ".");
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        <ScrollView contentContainerStyle={ws.ob_body}>
          <Text style={[ws.ob_title, { color: t.ink }]}>You’re subscribed</Text>
          <Text style={[ws.ob_sub, { color: t.ink_soft }]}>{welcomed
            ? <>We’ve sent a welcome message to your WhatsApp on {mobileWords(me)}. Message us
                there whenever you need help.</>
            : <>One last thing — say hello to Meyy on WhatsApp, so our chat is there when you
                need help.</>}</Text>
          <Button title={welcomed ? "Open WhatsApp" : "Say hello on WhatsApp"}
            style={{ marginTop: 16 }}
            onPress={() => { Linking.openURL(waLink(welcomed ? "" : hello, done && done.whatsapp_number))
              .catch(() => {}); }} />
          <Quiet>{welcomed
            ? ""
            : `Opens a chat with Meyy (${WHATSAPP_DISPLAY}) with a short note ready to send. `}
            {/* WALK-A-166: one line, naming only the channels the invoice really went by
                (the phone used to ignore whatsapp_invoice). */}
            {done && done.invoice_number
              ? invoiceLine(done.whatsapp_invoice === "sent", emailStage === "ok")
              : ""}</Quiet>
        </ScrollView>
        <View style={[ws.ob_foot, footPad, { backgroundColor: t.paper }]}>
          <Link title="Continue to Meyy →" onPress={finish} />
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
      <View style={[ws.ob_foot, footPad, { backgroundColor: t.paper }]}>
        <Button title={payBusy ? "Activating…" : `Pay ₹${total} & start →`} busy={payBusy}
          disabled={payBusy} onPress={doCheckout} style={{ width: "100%" }} />
        <Link title="← Back" onPress={() => setScreen("cart")} />
      </View>
    </View>
  );
}

/* The wizard's field wrapper — label above, the web's `.ob-field` 12px above each. */
function Field({ label, children, required = false }) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 12, rowGap: 6 }}>
      {/* WALK-A-022: a clay * marks a required field; School name carries none. */}
      <Text style={[type.label, { color: t.ink_soft }]}>{label}
        {required ? <Text style={{ color: t.clay }}> *</Text> : null}</Text>
      {children}
    </View>
  );
}
