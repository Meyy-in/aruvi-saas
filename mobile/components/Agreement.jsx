/* ───────── the User Agreement — READ and SIGN (Track D 6b·G + 6b·D2; app. 03 rows 59-71) ─────────
 *
 * ★ ONE DOCUMENT, NEVER A RE-TYPED SUMMARY. This serves both the subscribe wizard (sign mode) and
 * Settings › Legal (read mode) from `GET /legal/consent`, which parses the one file on disk — so
 * what a teacher reads back is literally what she accepted. ✅ SIGN MODE LANDED 2026-09-16 with
 * SubscribeFlow (Q11); until then read mode shipped alone, deliberately, because a sign-mode half
 * nothing can reach is the dead end this project keeps refusing to ship.
 *
 * ★ SIGN MODE IS A THREE-BAND FRAME on the web and is one here too: the document scrolls, and the
 * tally + accept bar are a foot OUTSIDE the scroller. The five boxes in that foot are BUTTONS,
 * not decorations — by the time she reaches the CTA the five points are far up the document, and
 * "which one did I miss?" has to be answerable without scrolling back through all of them. On the
 * phone that means each acknowledgement reports its own y via `onLayout` and the box scrolls to
 * it; the web gets it free from `scrollIntoView`.
 *
 * ★ THE OPTIONAL TICK IS NOT AMONG THE FIVE. `allTicked` is computed from `ticks`, so anything
 * living in that map becomes mandatory by construction — and a marketing consent that gates the
 * service is exactly what DPDP §6 forbids. It travels beside them, in its own state, and is drawn
 * quieter (`tone="soft"`, the web's `accent-color: var(--ink-soft)`).
 *
 * ★ IT LEADS WITH THE FACT SHE CAME FOR — did I accept this, and when. A teacher opening Settings
 * › Legal is usually checking exactly that, and the web puts the acceptance line above everything
 * for that reason.
 *
 * ★ AND THE VERSION SHE READS IS THE ONE SHE SIGNED. The server picks `accepted_version` over
 * `current_version` on its own (`/legal/consent`'s docstring), so a teacher who accepted v0.1
 * after v0.2 was published reads v0.1 back — with a line saying a newer one applies from her next
 * subscription. Nothing here asks for a version; asking would break that.
 */
import { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "./Text";
import { getJSON, postJSON } from "@aruvi/shared/format";
import { dateWords } from "@aruvi/shared/legalmd";
import Markdown from "./Markdown";
import Checkbox from "./Checkbox";
import PrivacyNotice from "./PrivacyNotice";
import { Sheet } from "./AttachSheet";
import { Button, Link } from "./ui";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

const NOTICE_WORDS = "Privacy Notice";

/* A tick's label, with "Privacy Notice" made tappable where it appears. RN has no inline
   button, so it is a nested Text with an onPress — which is the only inline-pressable text
   react-native offers and behaves correctly inside a wrapping paragraph. */
function NoticeLine({ text, onOpen, style, linkStyle }) {
  const str = String(text || "");
  const i = str.indexOf(NOTICE_WORDS);
  if (i < 0) return <Text style={style}>{str}</Text>;
  return (
    <Text style={style}>
      {str.slice(0, i)}
      <Text style={linkStyle} onPress={onOpen}>{NOTICE_WORDS}</Text>
      {str.slice(i + NOTICE_WORDS.length)}
    </Text>
  );
}

export default function Agreement({ mode = "read", onAccepted, onBack, backLabel = "← Back",
                                    context = "subscribe" }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const [state, setState] = useState(null);
  const [failed, setFailed] = useState("");
  const [ticks, setTicks] = useState({});
  const [final, setFinal] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const scrollRef = useRef(null);
  const ackY = useRef({});

  useEffect(() => {
    let live = true;
    getJSON("/legal/consent")
      .then((d) => { if (live) setState(d); })
      .catch(() => { if (live) setFailed(
        "The agreement couldn’t be loaded just now. Check your connection and try again."); });
    return () => { live = false; };
  }, []);

  if (failed) return <Text style={ws.lgl_fail}>{failed}</Text>;
  if (!state) return <Text style={ws.fr_loading}>Loading the agreement…</Text>;

  const doc = state.document || {};
  const acks = doc.acknowledgements || [];
  const accepted = state.accepted || state.prior_version;
  const signing = mode === "sign";
  const allTicked = acks.length > 0 && acks.every((a) => ticks[a.id]) && final;

  const accept = () => {
    setBusy(true); setErr("");
    postJSON("/legal/consent", {
      version: doc.version,
      acknowledgements: acks.map((a) => a.id),
      final: true,
      context,
      language: doc.language || "en",
      /* Beside the ticks, never among them — see the header note. */
      marketing_email: !!marketing,
    })
      .then(() => onAccepted && onAccepted())
      /* The server's own sentence when it wrote one for her (a superseded version is a 409
         with real advice); our fallback otherwise. */
      .catch((e) => {
        setErr((e && e.detail) || "Couldn’t record your acceptance. Try again in a moment.");
        setBusy(false);
      });
  };

  const jumpTo = (id) => {
    const y = ackY.current[id];
    if (scrollRef.current && typeof y === "number") {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 40), animated: true });
    }
  };

  const body = (
    <View>
      {/* Read mode leads with the fact she came for: did I accept this, and when. In sign
          mode there is nothing to report yet — except to a teacher who signed an EARLIER
          version, who is not a new signatory and should be told so. */}
      {signing ? (
        state.prior_version ? (
          <Text style={[ws.lgl_hint, { color: t.ink_soft }]}>
            The agreement has been updated since you accepted version {state.prior_version}.
            Please read it again and confirm the five points.
          </Text>
        ) : null
      ) : accepted ? (
        <View style={[ws.lgl_accepted, { backgroundColor: t.tint_pine }]}>
          <Text style={[ws.lgl_accepted_t, { color: t.ink }]}>
            <Text style={[ws.lgl_tick, { color: t.pine }]}>✓ </Text>
            Accepted on {dateWords(state.accepted_at || state.prior_accepted_at)} · version{" "}
            {state.accepted_version || state.prior_version}
            {!state.accepted && state.prior_version ? (
              <Text style={[ws.lgl_stale, { color: t.ink_soft }]}>
                {" "}— a newer version applies from your next subscription
              </Text>
            ) : null}
          </Text>
        </View>
      ) : (
        <Text style={[ws.lgl_hint, { color: t.ink_soft }]}>
          You haven’t accepted this agreement yet — you’ll be asked to when you subscribe.
          It’s here to read at any time.
        </Text>
      )}

      {/* The intro is italic, ink-soft prose on the web (`.lgl-intro .lgl-p`). The phone's
          Markdown renderer owns the paragraph; this only carries the spacing. */}
      {doc.intro ? <View style={ws.lgl_intro}><Markdown md={doc.intro} /></View> : null}

      {/* ── The five. Each is a card with a mono marginal number in clay, the way the rest of
          Aruvi numbers things. ⚠️ No ticks and no jump-row: both belong to sign mode, and the
          five-box row exists there so a teacher stuck at 4 of 5 can find the one she missed —
          a question that cannot arise on a screen with nothing to tick. */}
      <View style={ws.lgl_acks}>
        {acks.map((a) => (
          <View key={a.id}
            onLayout={(e) => { ackY.current[a.id] = e.nativeEvent.layout.y; }}
            style={[ws.lgl_ack, { backgroundColor: t.card_bg, borderColor: t.line }]}>
            <View style={ws.lgl_ack_head}>
              <Text style={[ws.lgl_ack_n, { color: t.clay }]}>{a.n}</Text>
              <Text style={[ws.lgl_ack_title, { color: t.ink }]}>{a.title}</Text>
            </View>
            <Markdown md={a.body} />
            {signing ? (
              <Pressable accessibilityRole="checkbox"
                accessibilityState={{ checked: !!ticks[a.id] }}
                accessibilityLabel={`Point ${a.n}: I understand and agree`}
                onPress={() => setTicks((prev) => ({ ...prev, [a.id]: !prev[a.id] }))}
                style={[ws.lgl_check, { borderTopColor: t.line }]}>
                <Checkbox checked={!!ticks[a.id]} />
                <Text style={[ws.lgl_check_t, { color: t.ink }]}>I understand and agree.</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      {/* The body the final tick accepts — separated by a rule, as on the web. */}
      <View style={[ws.lgl_agreement, { borderTopColor: t.line }]}>
        <Markdown md={doc.agreement} />
      </View>

      {/* The final tick, in its own sunk box — everything inside it is required. */}
      {signing && doc.final ? (
        <View style={[ws.lgl_final, { backgroundColor: t.paper_sunk, borderColor: t.line }]}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: final }}
            onPress={() => setFinal((v) => !v)}
            style={[ws.lgl_check, ws.lgl_check_flat]}>
            <Checkbox checked={final} />
            <NoticeLine text={doc.final.text} onOpen={() => setShowPrivacy(true)}
              style={[ws.lgl_check_t, ws.lgl_check_final_t, { color: t.ink }]}
              linkStyle={{ color: t.pine, textDecorationLine: "underline" }} />
          </Pressable>
        </View>
      ) : null}

      {/* The OPTIONAL tick (v0.4+). Plain paper and a hairline, never the sunk box, and the
          word "Optional" in the house mono — the one property she must be sure of is the one
          a faint border cannot state. Absent on v0.1–v0.3, which have no Optional section. */}
      {signing && doc.optional ? (
        <View style={[ws.lgl_optional, { borderTopColor: t.line }]}>
          <Text style={[ws.lgl_optional_tag, { color: t.ink_soft }]}>Optional</Text>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: marketing }}
            onPress={() => setMarketing((v) => !v)}
            style={[ws.lgl_check, ws.lgl_check_flat]}>
            <Checkbox checked={marketing} tone="soft" />
            <Text style={[ws.lgl_check_t, { color: t.ink_soft }]}>{doc.optional.text}</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={ws.lgl_version}>
        {doc.title} · version {doc.version}
        {state.current_version && state.current_version !== doc.version
          ? ` · current version ${state.current_version}` : ""}
      </Text>
    </View>
  );

  /* Read mode hands the document back as a plain block — Settings › Legal owns the scroller
     and the card around it. */
  if (!signing) return body;

  /* Sign mode owns its own frame: the document scrolls, the tally and the way out do not. */
  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scrollRef} contentContainerStyle={ws.ob_body}>{body}</ScrollView>
      <View style={[ws.ob_foot, { backgroundColor: t.paper }]}>
        <View style={ws.lgl_tally} accessibilityLabel="The five points">
          <Text style={[ws.lgl_tally_lbl, { color: t.ink_soft }]}>Five points</Text>
          <View style={ws.lgl_tally_boxes}>
            {acks.map((a) => (
              <Pressable key={a.id} onPress={() => jumpTo(a.id)} accessibilityRole="button"
                accessibilityLabel={`Point ${a.n}: ${ticks[a.id] ? "confirmed" : "not yet confirmed"}`}
                style={[ws.lgl_box, { borderColor: ticks[a.id] ? t.pine : t.line,
                                      backgroundColor: ticks[a.id] ? t.pine : t.card_bg }]}>
                <Text style={[ws.lgl_box_t, ticks[a.id] && ws.lgl_box_on_t,
                              { color: ticks[a.id] ? t.paper : t.ink_soft }]}>
                  {ticks[a.id] ? "✓" : a.n}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {/* Said where the button is, so a teacher staring at a dead CTA knows why — a disabled
            control with no explanation reads as a broken page, not an unfinished form. */}
        {!allTicked ? (
          <Text style={[ws.lgl_need, { color: t.ink_soft }]}>
            Confirm each of the five points and accept the full agreement to continue.
          </Text>
        ) : null}
        {err ? (
          <Text accessibilityRole="alert" style={[ws.ob_err, { color: t.danger }]}>{err}</Text>
        ) : null}
        <Button title={busy ? "Recording…" : "I accept — continue →"} busy={busy}
          disabled={!allTicked || busy} onPress={accept} style={{ width: "100%" }} />
        {onBack ? <Link title={backLabel} onPress={onBack} /> : null}
      </View>

      {/* The notice as a sheet OVER the wizard: its own scroll, its own ✕, and the agreement
          and its ticks untouched underneath, so closing lands her exactly where she was. */}
      {showPrivacy ? (
        <Sheet visible scroll onClose={() => setShowPrivacy(false)} title="Privacy Notice">
          <PrivacyNotice />
        </Sheet>
      ) : null}
    </View>
  );
}
