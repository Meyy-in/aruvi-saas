/* ───────── Settings › Support (6b·F, app. 04 rows F1-F14) ─────────
 *
 * ★ EMAIL IS THE ONLY CHANNEL, so this screen's whole job is to make writing feel like filing a
 * case rather than shouting into a void. No phone, no WhatsApp, no chat, no LLM answering
 * tickets. Email's one failure mode is SILENCE, and everything here is aimed at it: she picks
 * one of five categories (a choice, never a subject line to compose), writes, and gets back a
 * REFERENCE on screen and by mail within seconds.
 *
 * ★ THE FAST DOOR SITS ABOVE THE FORM. Ask Meyy answers "how does this work?" instantly, so it
 * is offered first — deflect before inviting, or the slowest channel in the product becomes its
 * FAQ. ⚠️ Its card is dark and inert until 6c: the panel does not exist yet, and the Settings
 * home's own idiom is that an unbuilt destination renders at half strength rather than vanishing.
 *
 * ★ A SCREEN MAY SAY IT DOES NOT KNOW; IT MAY NEVER INVENT AN ANSWER ABOUT HER RECORD (founder,
 * 2026-08-27, live: account 1000000001 was told there was no address on it, and there was). The
 * web's first build fell back to `{}` on a failed fetch and every downstream test read that
 * silence as a FACT. `metaErr` keeps the three states apart — has one · known to have none · we
 * could not ask — and the send path is unaffected either way, because the SERVER is the
 * authority on where the acknowledgement went and its response says so.
 *
 * ★ THE TICKET SAYS WHICH SURFACE IT CAME FROM (founder Q13, 2026-09-16): `context.screen` is
 * `"settings/support (app)"`, so the founder's copy reads `screen: settings/support (app)` and a
 * phone report is one glance from a web one. During a beta whose whole point is that the two
 * surfaces differ, that is the first thing worth knowing.
 *
 * ★ AND ON TRIAL SHE IS NOT OFFERED A DOOR THAT IS BOLTED (founder Q12, 2026-09-16). Personal
 * profile is hidden on trial, so "Or add an email address to your account →" is hidden too — a
 * link that goes nowhere is worse than no link. ⚠️ The same reasoning takes the "add one under
 * Personal profile" clause out of the no-email line below, which names the same hidden card; the
 * working answer, writing to the address directly, is what a trial teacher is left with and it
 * is stated in full. ⚠️ THE WEB STILL DEAD-ENDS in both places (its `setView("personal")` falls
 * through the `!onTrial` guard to the HOME list with no explanation) and owes the same fix.
 *
 * ⚠️ `requests` — her own case history — arrives from GET /support and is DELIBERATELY UNREAD.
 * The list was struck on the web on 2026-09-04: support is an email channel, she may write to
 * the address straight from her mail app, and a history that silently omits half of what she
 * remembers sending reads as "they lost it". Her inbox is the record that has all of it.
 *
 * ⚠️ NO HEADING, except one. The bar reads "⚙ Support"; the only `set_title` on this screen is
 * "Message sent", which is a STATE and not the name of a screen.
 */
import { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { Text, TextInput } from "../../../components/Text";
import { getJSON, postJSON } from "@aruvi/shared/format";
import { entitlementState, subscribeEntitlement } from "@aruvi/shared/entitlement";
import { Button, Link } from "../../../components/ui";
import Dropdown from "../../../components/Dropdown";
import { useTheme } from "../../../theme/ThemeContext";
import { useWebStyles } from "../../../theme/web";
import { type } from "../../../theme/type";
import { openAsk } from "../../../lib/ask";

/* Only ever a fallback for a server that sends no list — the categories are the API's
   (`mail_templates.SUPPORT_CATEGORIES`) and the stored `category_label` is what the founder
   reads, so a record says what she SAW. */
const SUPPORT_FALLBACK = [
  { key: "problem", label: "Something isn't working" },
  { key: "plan", label: "Something in a lesson plan looks wrong" },
  { key: "billing", label: "Billing or account" },
  { key: "suggestion", label: "A suggestion" },
  { key: "other", label: "Something else" },
];
const SUPPORT_MAX = 4000;
/* Hardcoded by decision (founder, 2026-09-03) — mirrors `api/config.SUPPORT_ADDRESS` and the
   web's own copy. The running API once handed the screen the founder's Gmail from a process
   older than the config change, and an address a teacher is told to write to must not depend on
   which server answered. Move one, move all three. */
const SUPPORT_ADDRESS = "support@meyy.in";
const replyWords = (n) => `${n} working day${Number(n) === 1 ? "" : "s"}`;
/* Q13's marker. The route IS the screen name here, which is why this is not the web's
   "Settings › Support" verbatim: the two surfaces name their own screens, and the parenthesis
   is what tells them apart in the founder's inbox. */
const SCREEN = "settings/support (app)";

/* The Ask Meyy mark, at the card's 20px. Same path data as the bottom nav's `AskIcon` and the
   web's two copies — repeated rather than shown as a generic "?" so the row and the thing it
   opens are recognisably one object; a teacher who has met the mark once should not have to
   read the label to know where this goes. */
function AskMark({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 6.5c6 1 6 5 3.5 7.5S6 18 6 18" />
      <Path d="M10.5 14c3.5 0 5.5-1.8 6.5-4" />
      <Circle cx={17.3} cy={8.6} r={1.6} fill="#c0392b" stroke="none" />
    </Svg>
  );
}

/* The web's `.login-field.ob-field.sup-field`: label above, 6px gap, 2px/20px outside. The LABEL
   is the phone's `type.label`, the same one Personal profile's fields carry — the web's 9.5px
   `.login-field > span` is unported on both screens, and two Settings forms disagreeing about
   their label type would be worse than either matching the web alone. */
function SupField({ label, children }) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 2, marginBottom: 20, rowGap: 6 }}>
      <Text style={[type.label, { color: t.ink_soft }]}>{label}</Text>
      {children}
    </View>
  );
}

export default function Support() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();

  const [ent, setEnt] = useState(() => entitlementState());
  useEffect(() => subscribeEntitlement(setEnt), []);
  const onTrial = ent.trial;

  const [meta, setMeta] = useState(null);       // categories + windows + her email
  const [metaErr, setMetaErr] = useState(false);
  const [cat, setCat] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(null);       // the server's reference and window

  /* ★ REACHABLE IS NOT VISIBLE (founder, 2026-09-19, on the iPhone — WALK smoke test: "the
     send button is hidden behind the keyboard"). `automaticallyAdjustKeyboardInsets` (below)
     made Send REACHABLE — the scroll range grows by the keyboard's height — but iOS only
     brings the FOCUSED FIELD into view, and Send sits below it, so she had to know to drag.
     When the keyboard rises for the message box, scroll to the end: the box and Send then sit
     together just above the keys. Same idiom as settings/index.jsx (`scrollToEnd`, never a
     measured offset). Only while the message box holds focus — the Subject dropdown raises no
     keyboard, and a scroll she did not ask for is its own annoyance.
     ⚠️ ANDROID IS UNPROVEN: the emulator's soft keyboard was off when this was written, and
     the inset prop is iOS-only. The scroll below runs on both; whether Android's window
     resizes under edge-to-edge is for the walk to say (tracker row 04 · Support). */
  const scrollRef = useRef(null);
  const msgFocused = useRef(false);
  const toEnd = () => { try { scrollRef.current && scrollRef.current.scrollToEnd({ animated: true }); } catch {} };
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow",
      () => { if (msgFocused.current) setTimeout(toEnd, 50); });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let live = true;
    getJSON("/support")
      .then((d) => { if (live) { if (d) setMeta(d); else setMetaErr(true); } })
      .catch(() => { if (live) setMetaErr(true); })
      /* `{}` so the fallback categories draw — truthy `meta` is "we asked", never "she has
         none"; that second question is `metaErr`'s. */
      .finally(() => { if (live) setMeta((m) => m || {}); });
    return () => { live = false; };
  }, []);

  const cats = (meta && meta.categories && meta.categories.length)
    ? meta.categories : SUPPORT_FALLBACK;
  /* ★ NO LOCAL `days`. The confirmation reads `sent.reply_window` straight off the POST
     response, so the window is resolved in ONE place — the server — and screen and mail can no
     longer disagree. `meta.reply_days` / `meta.billing_reply_days` arrive and stay unread. */
  const emailKnown = !!meta && !metaErr;
  const hasEmail = emailKnown && !!meta.email;

  const send = () => {
    if (!cat || !text.trim() || busy) return;
    setBusy(true); setErr("");
    postJSON("/support", { category: cat, message: text.trim(), context: { screen: SCREEN } })
      .then((r) => setSent(r))
      /* The SERVER'S OWN SENTENCE on a 4xx — the over-length message and the empty one both
         come back in words she can act on. 5xx is engine talk and `detail` is empty there, so
         the fallback stands. */
      .catch((e) => setErr((e && e.detail) || "Couldn’t send that just now — try again."))
      .finally(() => setBusy(false));
  };

  /* ── after sending: the reference, and where the copy went ── */
  if (sent) {
    return (
      <ScrollView contentContainerStyle={[ws.main, { paddingTop: 0 }]}>
        <Text style={[ws.set_title, { color: t.ink }]}>Message sent</Text>
        <View style={[ws.set_card, ws.set_card_pad, ws.set_card_inset,
                      { borderColor: t.line, backgroundColor: t.card_bg }]}>
          <Text style={[ws.sup_refcap, { color: t.ink_soft }]}>Your reference</Text>
          <Text style={[ws.sup_ref, { color: t.pine }]}>{sent.reference}</Text>
          <Text style={[ws.set_plan_txt, { color: t.ink }]}>
            {sent.emailed ? (
              <>A copy is on its way to <Text style={ws.lgl_b}>
                {sent.email}</Text>. You can expect a response within{" "}
                {sent.reply_window || replyWords(sent.reply_days || 2)}, Monday to Friday.</>
            ) : (
              <>Your message is with us and you can expect a response within{" "}
                {sent.reply_window || replyWords(sent.reply_days || 2)}, Monday to Friday. There
                is no email address on your account, so write to us at{" "}
                <Text style={ws.lgl_b}>{SUPPORT_ADDRESS}</Text> — quote your
                reference — and we will reply there.</>
            )}
          </Text>
        </View>
        {/* Offered SECOND, because the plain address above is the working answer. Hidden on
            trial (Q12): Personal profile is not there to open. */}
        {!sent.emailed && !onTrial ? (
          <Link title="Or add an email address to your account →"
            style={{ textAlign: "left" }} onPress={() => router.push("/settings/personal")} />
        ) : null}
        <Text style={[ws.set_hint, { color: t.ink_soft }]}>
          Quote {sent.reference} if you write to us about this again — it keeps everything in
          one place.
        </Text>
      </ScrollView>
    );
  }

  return (
    /* ★ THE KEYBOARD MUST NOT BURY SEND (founder, 2026-09-16, on the handset: "when the cursor
       is in the message box, it hides the 'Send message' button"). And it was not merely
       COVERED — it was unreachable: the content ends at `ws.main`'s 72px bottom padding, so
       raising the keyboard does not extend the scrollable range and no amount of dragging
       brings the button above it. `automaticallyAdjustKeyboardInsets` is the precise answer:
       iOS insets the scroll view by the keyboard's height, so the last control scrolls into
       view like any other content. ⚠️ NOT the `KeyboardAvoidingView` the three modal sites use
       (login, AttachSheet, ChapterOrg) — those LIFT a card that has nowhere to scroll; here the
       screen is already a scroller inside a Stack under two bars, which is where a KAV needs a
       `keyboardVerticalOffset` and starts guessing. If this ever stops working on a future SDK,
       the KAV wrap is the fallback, not the first choice. */
    <ScrollView ref={scrollRef} contentContainerStyle={[ws.main, { paddingTop: 12 }]}
      keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {/* 1 · the fast door first */}
      <Text style={[ws.set_hint, { color: t.ink_soft, marginTop: 0 }]}>
        Most questions about how Meyy works are answered straight away by Ask Meyy. For anything
        else, write to us below.
      </Text>
      {/* ✅ LIVE AS OF 6c (F3). It rendered dark and inert while the panel did not exist — the
          Settings idiom for an unbuilt destination. It opens the panel OVER this screen, which is
          what makes it a deflection rather than a detour: she can read an answer and come straight
          back to the half-written message underneath. */}
      <Pressable onPress={openAsk} accessibilityRole="button" accessibilityLabel="Ask Meyy"
        style={[ws.set_bigcard, { backgroundColor: t.card_bg, borderColor: t.line }]}>
        <View style={{ flexGrow: 0, flexShrink: 0 }}><AskMark color={t.pine} /></View>
        <View style={ws.set_bigtext}>
          <Text style={[ws.set_biglab, { color: t.ink }]}>Ask Meyy</Text>
          <Text style={[ws.set_bigsub, { color: t.ink_soft }]}>
            Answers about how Meyy works — instantly</Text>
        </View>
        <Text style={[ws.set_chev, { color: t.ink_soft }]}>›</Text>
      </Pressable>

      {/* 2 · the form, shaped like a mail: To · Subject · message */}
      <View style={ws.set_group}>
        <Text style={[ws.set_cap, { color: t.ink_soft }]}>Write to us</Text>
        <View style={[ws.set_card, ws.set_card_pad,
                      { borderColor: t.line, backgroundColor: t.card_bg }]}>
          {/* A read-only VALUE, not a field: no plane, no border, nothing that invites a tap. */}
          <View style={ws.sup_to_row}>
            <Text style={[type.label, { color: t.ink_soft }]}>To</Text>
            <Text style={[ws.sup_to, { color: t.ink_soft }]}>{SUPPORT_ADDRESS}</Text>
          </View>

          {/* No preselection — a dropdown that answers for her files a suggestion as a fault,
              and the choice also sets which reply window the server promises. */}
          <SupField label="Subject">
            <Dropdown value={cat} onChange={setCat} placeholder="Choose one" label="Subject"
              options={cats.map((c) => ({ value: c.key, label: c.label }))} />
          </SupField>

          {/* No placeholder (founder, 2026-08-27). Prompt text inside the box tells a teacher
              what shape her trouble is supposed to be, and she trims it to fit; an empty box
              asks nothing and gets the whole story. */}
          <SupField label="Your message">
            <TextInput multiline textAlignVertical="top" value={text} onChangeText={setText}
              maxLength={SUPPORT_MAX} accessibilityLabel="Your message"
              onFocus={() => { msgFocused.current = true; if (Keyboard.isVisible && Keyboard.isVisible()) setTimeout(toEnd, 50); }}
              onBlur={() => { msgFocused.current = false; }}
              style={[ws.sup_text, { borderColor: t.line, backgroundColor: t.paper,
                                     color: t.ink }]} />
          </SupField>

          {/* Only near the cap — a live counter on an empty box reads as a word limit on how
              much trouble she is allowed to be in. */}
          {text.length > SUPPORT_MAX - 500 ? (
            <Text style={[ws.ob_quiet, { color: t.ink_soft }]}>
              {SUPPORT_MAX - text.length} characters left</Text>
          ) : null}

          {/* IN FULL, NOT MASKED (founder, 2026-09-04): this is the last moment she can catch a
              wrong or stale address, before spending effort writing somewhere she will never be
              answered, and a mask defeats exactly that check. ⚠️ The nested Text names a COLOUR
              and nothing else — one that also named a size would stop inheriting the line it
              sits in (the `lgl_b` lesson). */}
          {hasEmail ? (
            <Text style={[ws.ob_quiet, { color: t.ink_soft }]}>Our reply goes to{" "}
              <Text style={{ color: t.ink }}>{meta.email}</Text>.</Text>
          ) : null}

          {/* ONLY when the server actually told us she has none, and said BEFORE she writes: a
              teacher who types out a problem and only then learns nobody can answer her has been
              wasted. When the lookup FAILED we say nothing — see `metaErr` above. */}
          {emailKnown && !hasEmail ? (
            <Text style={[ws.ob_quiet, { color: t.ink_soft }]}>
              {onTrial
                ? `There is no email address on your account, so we cannot write back — write to us directly at ${SUPPORT_ADDRESS}.`
                : `There is no email address on your account, so we cannot write back — add one under Personal profile, or write to us directly at ${SUPPORT_ADDRESS}.`}
            </Text>
          ) : null}

          {err ? (
            <Text accessibilityRole="alert" style={[ws.ob_err, { color: t.danger }]}>{err}</Text>
          ) : null}

          <Button title={busy ? "Sending…" : "Send message"} busy={busy}
            disabled={!cat || !text.trim() || busy} onPress={send} style={{ marginTop: 16 }} />
        </View>
      </View>
    </ScrollView>
  );
}
