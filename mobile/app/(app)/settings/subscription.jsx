/* ───────── Settings › Subscription & billing (6b·D, app. 04 rows D1-D9) ─────────
 *
 * ★ WHAT SHE HAS DOES NOT DEPEND ON WHETHER THE GATE IS ON (web, 2026-08-26). `active` once
 * required `ent.enforced`, so with enforcement off — which is the DEPLOYED state for the beta —
 * a teacher who had really paid was shown "Your plan details will appear here" and no Add
 * button. Enforcement decides what is REFUSED; the record decides what is TRUE. `lapsed` still
 * comes from the server (it reports false when the gate is off), so dev mode never says "Ended".
 *
 * ★ ONE CARD PER SUBSCRIPTION, LATEST FIRST (founder, 2026-08-26 evening). They were rows inside
 * one card under a single shared "Validity" that could only ever be true of one of them. Each
 * subject-stage is its own purchase with its own year and its own end date, so the CARD is the
 * unit of what she bought. The ordering rule and the live/expired test live in
 * `@aruvi/shared/format` (`subsFromEntitlement`), with the web delegating to the same function —
 * this is the one screen where a drift means telling a paying teacher two different things.
 *
 * ★ AN EXPIRED SUBSCRIPTION IS STILL SHOWN. She owned it, and its card is the explanation for
 * anything she can no longer prepare there. Clay, the ledger's "finished" colour — never red,
 * because nothing has gone wrong.
 *
 * ★ THE INVOICE SITS WITH THE SUBSCRIPTION IT PAID FOR (founder, 2026-08-26), not in a separate
 * billing list to go hunting in: "what did I pay for this?" is asked while looking at the thing.
 * The NUMBER shows even when the PDF is missing — the number is the record, the file is a
 * convenience, and a download link that 404s is worse than no link.
 *
 * ⚠️ SUBSCRIBE / ADD SUBJECTS ARE DRAWN BUT DARK, until SubscribeFlow lands (Q11 un-deferred it,
 * so this is a gap and not a decision). The Settings home's idiom: an unbuilt destination renders
 * at half strength rather than vanishing, because the LIST is the founder's structure and
 * shipping half of it would teach her a shape that then changes under her.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, Animated, Easing } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { pendingPurchase, settlePurchase } from "../../../lib/purchase";
import { Text } from "../../../components/Text";
import { getJSON, fmtValidity, scopeRows, subsFromEntitlement } from "@aruvi/shared/format";
import { entitlementState, subscribeEntitlement } from "@aruvi/shared/entitlement";
import { canPreview, downloadDocument, fetchDocument, invoicePdf } from "../../../lib/download";
import { useTheme } from "../../../theme/ThemeContext";
import { useWebStyles } from "../../../theme/web";

/* The pill: "Free trial" · "Subscribed" · "Ended". One shape, three inks — pine when it is
   merely stating what she is on, ochre for a running subscription, clay for a finished one. */
function Pill({ children, tone }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const color = tone === "on" ? t.ochre : tone === "off" ? t.clay : t.pine;
  return (
    <View style={[ws.set_pill, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
      <Text style={[ws.set_pill_t, { color }]}>{children}</Text>
    </View>
  );
}

function LedgerRow({ k, v, tone }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <View style={[ws.acct_row, { borderBottomColor: t.line_soft }]}>
      <Text style={[ws.acct_k, { color: t.ink_soft }]}>{k}</Text>
      {typeof v === "string"
        ? <Text style={[ws.acct_v, { color: tone === "off" ? t.clay : t.ink }]}>{v}</Text>
        : v}
    </View>
  );
}

/* ★ THE NEW INVOICE, ON ITS WAY (founder, 2026-09-18). A progress line in the Invoice row of a
   subscription she has just bought — the preparing card's own bar (`sc_prep*`), so it reads as
   the same kind of wait she already knows from a lesson being prepared. Grows to 96% and holds;
   the real invoice number replaces it the moment /invoices lists it. */
function InvoiceProgress() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 6000, easing: Easing.bezier(0.25, 0.8, 0.3, 1),
                            useNativeDriver: false }).start();
  }, [grow]);
  return (
    <View style={[ws.sc_prep, { flex: 1, marginTop: 0 }]} accessibilityLiveRegion="polite">
      <Text style={ws.sc_prep_note}>Preparing your invoice…</Text>
      <View style={[ws.sc_prep_bar, { backgroundColor: t.line_soft }]}>
        <Animated.View style={[ws.sc_prep_fill, { backgroundColor: t.pine,
          width: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", "96%"] }) }]} />
      </View>
    </View>
  );
}

export default function Subscription() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();

  const [st, setSt] = useState(() => entitlementState());
  useEffect(() => subscribeEntitlement(setSt), []);
  const ent = st.ent;
  const onTrial = st.trial;
  const lapsed = st.lapsed;
  /* Mirrors the web line for line. `active` must EXCLUDE lapsed, or a date-expired teacher
     would read "SUBSCRIBED" here while every write of hers is being refused. */
  const active = !!ent && !lapsed && ent.plan_id !== "trial"
    && (ent.status === "active" || ent.status === "grace");

  /* Never gated (§2.5): a document recording money she paid stays reachable after the thing it
     paid for has ended. */
  const [invoices, setInvoices] = useState([]);
  /* The scopes of a purchase still settling (lib/purchase). Re-read on FOCUS, not mount: the
     wizard is pushed on top of this screen and pops back to it, so there is no second mount. */
  const [pending, setPending] = useState(() => pendingPurchase());
  useFocusEffect(useCallback(() => {
    let live = true;
    let tries = 0;
    let timer = null;
    const load = () => getJSON("/invoices").then((d) => {
      if (!live) return;
      const list = (d && d.invoices) || [];
      setInvoices(list);
      const left = settlePurchase(list);
      setPending(left);
      /* An invoice is issued inside checkout, so it is normally there on the first read; the
         retries cover a slow disk or mail step. Two seconds apart, for up to half a minute,
         then the line simply waits for her next visit rather than spinning for ever. */
      if (left.length && ++tries < 15) timer = setTimeout(load, 2000);
    }).catch(() => { if (live && !invoices.length) setInvoices([]); });
    setPending(pendingPurchase());
    load();
    return () => { live = false; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));
  const purchasing = pending.length > 0;
  /* ⚠️ EVERYTHING BELOW READS `invoices` AND `pending`, SO IT SITS BELOW THEM. The first cut of
     2026-09-18 computed `planCard` above `purchasing` — a TDZ ReferenceError on first paint that
     no parse or scope check sees (the `tourNow` lesson in index.jsx, again). */
  const subs = subsFromEntitlement(ent, invoices);   // newest purchase first (2026-09-18)
  /* ★ NOTHING TO SAY, NOTHING DRAWN (founder, 2026-09-16: "in both web and phone active
     subscriptions must not show that sliver"). The status card has exactly three things it can
     say and an ACTIVE teacher matches none of them, so it used to render as an empty bordered
     strip above her subscriptions — which is what a row looks like while it is still loading,
     shown to the one teacher who has paid. Fixed on BOTH surfaces in the same commit. */
  /* While a purchase settles the status card has nothing true to say — she is no longer "on a
     free trial", and "your plan details will appear here" is the very line the founder reported.
     The pending cards below say what is happening instead. */
  const planCard = (onTrial || lapsed || !active) && !purchasing;
  /* Scopes just bought that her entitlement copy has not caught up with — drawn as their own
     cards, ABOVE the rest, newest purchase first. */
  const pendingOnly = pending.filter((sc) => !(active && subs.some((x) => x.scope === sc)));
  const pendingCards = pendingOnly.length > 0;

  const [busy, setBusy] = useState("");
  const [failMsg, setFailMsg] = useState("");
  const getInvoice = (number) => {
    setBusy(`inv-${number}`); setFailMsg("");
    /* ★ SHOWN BEFORE IT IS SENT (founder, 2026-09-18: "the invoice… should appear in the screen as
       it does for pdf LP export"). The report window's rule, applied here: a PDF on iOS opens in
       the preview screen and the share sheet is her choice from its arrow. `from: "settings"`
       keeps the bottom nav from lighting My Lessons, which is what `/preview` means otherwise. */
    const doc = invoicePdf(number);
    const run = canPreview(doc.mime)
      ? fetchDocument(doc).then((f) => router.push({ pathname: "/preview",
          params: { uri: f.uri, name: f.name, mime: f.mime, label: `Invoice ${number}`, from: "settings" } }))
      : downloadDocument(doc);
    run
      .catch(() => setFailMsg("Couldn’t fetch that invoice right now."))
      .finally(() => setBusy(""));
  };

  return (
    <ScrollView contentContainerStyle={[ws.main, { paddingTop: 12 }]}>
      {/* The status card. No heading — the bar reads "⚙ Subscription & billing". */}
      {planCard ? (
      <View style={[ws.set_card, ws.set_card_pad,
                    { borderColor: t.line, backgroundColor: t.card_bg }]}>
        {/* ⚠️ THE ROW IS INSIDE EACH BRANCH, as on the web — not hoisted around them. An
            ACTIVE teacher matches none of the three, and the web's card then collapses to its
            own 4px of padding: a thin sliver above her subscriptions. Hoisting the row would
            have added 24px of nothing and turned that sliver into an empty box that reads as
            something still loading. ⚠️ The sliver itself is a WEB oddity we are matching, not
            endorsing — recorded in the map as owed. */}
        {onTrial ? (
          <View style={ws.set_plan}>
            <Pill>Free trial</Pill>
            <Text style={[ws.set_plan_txt, { color: t.ink }]}>
              {ent.trial_chapters_used} of {ent.trial_chapter_cap} chapters used</Text>
          </View>
        ) : null}
        {lapsed ? (
          <View style={ws.set_plan}>
            <Pill tone="off">Ended</Pill>
            <Text style={[ws.set_plan_txt, { color: t.ink }]}>
              Your plans remain yours to open, export and print</Text>
          </View>
        ) : null}
        {!(onTrial || active || lapsed) ? (
          <View style={ws.set_plan}>
            <Text style={[ws.set_plan_txt, { color: t.ink }]}>
              Your plan details will appear here.</Text>
          </View>
        ) : null}
      </View>
      ) : null}

      {/* ★ JUST BOUGHT, NOT YET IN HER COPY — a card per scope the store has not caught up with,
          so the purchase shows at once — ON TOP, newest first (founder, 2026-09-18) — above everything she already had (whose invoices stay
          where they were). Replaced by the ordinary card the moment the entitlement read lands. */}
      {pendingOnly.map((scope, idx) => {
        const r = scopeRows(scope);
        return (
          <View key={`p-${scope}`} style={[ws.set_card, ws.set_card_pad, ws.set_sub_card,
                                          ws.set_card_inset,
                                          !planCard && idx === 0 ? { marginTop: 0 } : null,
                                          { borderColor: t.line, backgroundColor: t.card_bg }]}>
            <View style={[ws.set_plan, ws.set_plan_sub]}><Pill tone="on">Subscribed</Pill></View>
            <LedgerRow k="Subject" v={r.subject} />
            <LedgerRow k="Stage" v={r.stage} />
            <LedgerRow k="Class" v={r.classes} />
            <LedgerRow k="Invoice" v={<InvoiceProgress />} />
          </View>
        );
      })}
      {active ? subs.map(({ scope, until, live }, idx) => {
        const r = scopeRows(scope);
        /* The newest invoice listing this scope — a renewal issues a second one, and the one
           that explains today's validity is the latest. `invoices` arrives newest first. */
        const inv = invoices.find((iv) => (iv.scopes || []).includes(scope));
        return (
          <View key={scope} style={[ws.set_card, ws.set_card_pad, ws.set_sub_card,
                                    ws.set_card_inset,
                                    /* With no status card above it, the first subscription card
                                       IS the first element and gives back `set_sub_card`'s 10px
                                       so the page does not start late. The web does the same
                                       with `.set-sub-card.set-first`. */
                                    !planCard && idx === 0 && !pendingCards ? { marginTop: 0 } : null,
                                    { borderColor: t.line, backgroundColor: t.card_bg }]}>
            <View style={[ws.set_plan, ws.set_plan_sub]}>
              <Pill tone={live ? "on" : "off"}>{live ? "Subscribed" : "Ended"}</Pill>
            </View>
            <LedgerRow k="Subject" v={r.subject} />
            <LedgerRow k="Stage" v={r.stage} />
            <LedgerRow k="Class" v={r.classes} />
            {until ? (
              <LedgerRow k="Validity" tone={live ? "" : "off"}
                v={`${live ? "until " : "ended "}${fmtValidity(until)}`} />
            ) : null}
            {!inv && pending.includes(scope) ? (
              <LedgerRow k="Invoice" v={<InvoiceProgress />} />
            ) : null}
            {inv ? (
              <LedgerRow k="Invoice" v={
                inv.has_pdf ? (
                  <Pressable onPress={busy === `inv-${inv.number}` ? undefined
                                                                  : () => getInvoice(inv.number)}
                    accessibilityRole="button" hitSlop={6} style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[ws.set_inv_dl, { color: t.pine }]}>
                      {busy === `inv-${inv.number}` ? "Preparing…" : `${inv.number} ↓`}</Text>
                  </Pressable>
                ) : <Text style={[ws.acct_v, { color: t.ink }]}>{inv.number}</Text>
              } />
            ) : null}
          </View>
        );
      }) : null}


      {/* ✅ LIT 2026-09-16. Both open the SAME wizard the paywall and the front door open — and it
          really buys: `POST /onboarding/checkout` is a server-side dev stub that activates
          through the ManualBillingProvider. */}
      {(onTrial || lapsed) && !purchasing ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Subscribe"
          onPress={() => router.push("/subscribe")}
          style={[ws.set_subscribe, { backgroundColor: t.pine }]}>
          <Text style={[ws.set_subscribe_t, { color: t.paper }]}>Subscribe</Text>
        </Pressable>
      ) : null}
      {active && !onTrial ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Add subjects and stages"
            onPress={() => router.push("/subscribe")}
            style={[ws.set_subscribe, { backgroundColor: t.pine }]}>
            <Text style={[ws.set_subscribe_t, { color: t.paper }]}>Add subjects &amp; stages</Text>
          </Pressable>
          <Text style={[ws.set_hint, { color: t.ink_soft }]}>
            Anything you add runs for a full year from the day you add it, alongside what you
            already have.</Text>
        </>
      ) : null}

      {failMsg ? (
        <Text accessibilityRole="alert" style={[ws.acct_fail, { color: t.danger }]}>{failMsg}</Text>
      ) : null}
      <Text style={[ws.set_hint, { color: t.ink_soft }]}>
        Online payments open soon. Your invoices are here already — one per purchase, on the
        subscription it paid for.</Text>
    </ScrollView>
  );
}
