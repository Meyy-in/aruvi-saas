/* ───────── the User Agreement, in READ mode (Track D 6b·G; app. 03 rows 59-71) ─────────
 *
 * ★ ONE DOCUMENT, NEVER A RE-TYPED SUMMARY. The web's `Agreement.jsx` serves both the subscribe
 * wizard (sign mode) and Settings › Legal (read mode) from `GET /legal/consent`, which parses the
 * one file on disk — so what a teacher reads back is literally what she accepted. The phone ports
 * READ mode only: signing arrives with SubscribeFlow (Q11), and a sign-mode half nothing can
 * reach is the dead end this project keeps refusing to ship.
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
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { getJSON } from "@aruvi/shared/format";
import { dateWords } from "@aruvi/shared/legalmd";
import Markdown from "./Markdown";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export default function Agreement() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const [state, setState] = useState(null);
  const [failed, setFailed] = useState("");

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

  return (
    <View>
      {accepted ? (
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
          <View key={a.id} style={[ws.lgl_ack, { backgroundColor: t.card_bg, borderColor: t.line }]}>
            <View style={ws.lgl_ack_head}>
              <Text style={[ws.lgl_ack_n, { color: t.clay }]}>{a.n}</Text>
              <Text style={[ws.lgl_ack_title, { color: t.ink }]}>{a.title}</Text>
            </View>
            <Markdown md={a.body} />
          </View>
        ))}
      </View>

      {/* The body the final tick accepts — separated by a rule, as on the web. */}
      <View style={[ws.lgl_agreement, { borderTopColor: t.line }]}>
        <Markdown md={doc.agreement} />
      </View>

      <Text style={ws.lgl_version}>
        {doc.title} · version {doc.version}
        {state.current_version && state.current_version !== doc.version
          ? ` · current version ${state.current_version}` : ""}
      </Text>
    </View>
  );
}
