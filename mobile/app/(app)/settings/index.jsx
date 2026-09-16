/* ───────── Settings home — the gear's own screen (Track D 6b·B, app. 04 rows B1-B18) ─────────
 *
 * ★ ORDERED BY HOW OFTEN SHE OPENS IT (founder, 2026-09-11), not by importance and not
 * alphabetically: the teaching profile she returns to all year on top; Help and Support next;
 * billing; then the once-a-year items — personal details, the two quiet toggles, legal, about —
 * and the account rows last, under the ONE caption that survives.
 *
 * ★ NO HEADING. The frozen bar above says "⚙ Settings", and two different-sized "Settings" on one
 * screen is what the founder struck on 2026-09-03.
 *
 * ★ TWO PROFILES, CLEARLY TOLD APART (founder, 2026-08-25): PERSONAL — who she is, her account
 * details — and TEACHING — what she teaches. They are different things and the phone must not
 * blur them just because both say "profile".
 *
 * ⚠️ TRIAL HIDES TWO ITEMS, and only two: Personal profile and Your data & export. Marketing
 * emails is UNGATED on purpose — it is the withdrawal half of a consent, and a right to withdraw
 * that depends on subscription state is not a right. Legal is shown on trial too.
 *
 * ⚠️ Rows whose destinations arrive later in 6b are drawn but dark — the card list is the founder's
 * structure and shipping half of it would teach her a shape that then changes under her. A row
 * with no handler renders at half strength and does not respond, which is the gear's own idiom
 * from before it was lit.
 */
import { useEffect, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "../../../components/Text";
import { getJSON, postJSON } from "@aruvi/shared/format";
import { entitlementState, subscribeEntitlement } from "@aruvi/shared/entitlement";
import { endSession } from "../../../lib/session";
import ThemeToggle from "../../../components/ThemeToggle";
import { useTheme } from "../../../theme/ThemeContext";
import { useWebStyles } from "../../../theme/web";

/* One card. `onPress` absent → the destination is not built yet: dimmed and inert, never hidden,
 * because the LIST is the founder's structure. */
function BigCard({ label, sub, onPress, right }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const dark = !onPress && !right;
  return (
    <Pressable onPress={onPress || undefined} disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={[ws.set_bigcard, { backgroundColor: t.card_bg, borderColor: t.line,
                                opacity: dark ? 0.5 : 1 }]}>
      <View style={ws.set_bigtext}>
        <Text style={[ws.set_biglab, { color: t.ink }]}>{label}</Text>
        <Text style={[ws.set_bigsub, { color: t.ink_soft }]}>{sub}</Text>
      </View>
      {right || <Text style={[ws.set_chev, { color: t.ink_soft }]}>›</Text>}
    </Pressable>
  );
}

function Row({ label, onPress, danger, last }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <Pressable onPress={onPress || undefined} disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={[ws.set_row, { borderBottomColor: last ? "transparent" : t.line_soft,
                            opacity: onPress ? 1 : 0.5 }]}>
      <Text style={[ws.set_lab, { color: danger ? t.danger : t.ink }]}>{label}</Text>
      {onPress && !danger ? null : null}
      {danger ? <Text style={[ws.set_chev, { color: t.ink_soft }]}>›</Text> : null}
    </Pressable>
  );
}

export default function SettingsHome() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();

  const [ent, setEnt] = useState(() => entitlementState());
  useEffect(() => subscribeEntitlement(setEnt), []);
  const onTrial = ent.trial;

  /* ★ RENDERED ONLY ONCE THE ANSWER IS KNOWN (`null` = not yet). An unchecked box drawn
     mid-fetch is a screen inventing an answer about her record — the Support `metaErr` rule,
     and it matters more here because the thing being invented is a consent. */
  const [marketing, setMarketing] = useState(null);
  const [mktBusy, setMktBusy] = useState(false);
  const [mktNote, setMktNote] = useState("");
  useEffect(() => {
    let live = true;
    getJSON("/account").then((a) => { if (live && a) setMarketing(!!a.marketing_email); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  /* Optimistic, with a rollback: the tick is the answer, so it moves at once and goes back if
     the server refuses. Saved ON TAP — there is no Save button on a switch. */
  const saveMarketing = (next) => {
    const before = marketing;
    setMarketing(next); setMktBusy(true); setMktNote("");
    postJSON("/account/marketing-email", { marketing_email: next })
      .then(() => setMktNote(next
        ? "Saved — you’ll hear from us occasionally."
        : "Saved — no more marketing emails."))
      .catch((e) => {
        setMarketing(before);
        setMktNote(String((e && e.message) || "") || "Couldn’t save that just now — try again.");
      })
      .finally(() => setMktBusy(false));
  };

  return (
    <ScrollView contentContainerStyle={[ws.main, { paddingTop: 12 }]}>
      <BigCard label="Teaching profile"
        sub="Subjects, classes, sections and periods you teach" />
      <BigCard label="Help" sub="Ask Meyy guide" />
      <BigCard label="Support" sub="Write to us — we reply by email" />
      <BigCard label="Subscription & billing" sub="Plan, billing & usage" />
      {!onTrial ? (
        <BigCard label="Personal profile"
          sub="Your name, email, role and school details"
          onPress={() => router.push("/settings/personal")} />
      ) : null}

      {/* ★ APPEARANCE AND MARKETING EMAILS WEAR THE SAME CARD as everything else, with the
          control where the chevron would be (founder, 2026-09-11). ⚠️ Unlike the web, the
          Appearance card does NOT hide itself: there it is a phone-only setting on a surface
          that is usually a desktop, so it vanishes above 600px. Here every surface is the
          phone. */}
      <BigCard label="Appearance" sub="Light or dark, or follow your phone"
        right={<ThemeToggle />} />
      {marketing !== null ? (
        <BigCard label="Marketing emails"
          sub="Occasional news on new subjects, features and teaching ideas — receipts, replies and agreement notices are sent either way"
          right={
            <Pressable onPress={mktBusy ? undefined : () => saveMarketing(!marketing)}
              disabled={mktBusy} hitSlop={10} accessibilityRole="switch"
              accessibilityState={{ checked: marketing, disabled: mktBusy }}
              accessibilityLabel="Send me occasional emails about new subjects and features">
              {/* The web draws a 22px native checkbox in pine. RN has no checkbox, so this is
                  the app's own square — same size, same colour, same two states. */}
              <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5,
                             alignItems: "center", justifyContent: "center",
                             opacity: mktBusy ? 0.6 : 1,
                             borderColor: marketing ? t.pine : t.line,
                             backgroundColor: marketing ? t.pine : "transparent" }}>
                {marketing ? <Text style={{ color: t.paper, fontSize: 13, lineHeight: 15 }}>✓</Text> : null}
              </View>
            </Pressable>
          } />
      ) : null}
      {mktNote ? <Text style={[ws.set_hint, { color: t.ink_soft }]}>{mktNote}</Text> : null}

      <BigCard label="Legal" sub="User agreement & privacy notice"
        onPress={() => router.push("/settings/legal")} />
      <BigCard label="About Meyy" sub="Version info"
        onPress={() => router.push("/settings/about")} />

      {/* Account: her data, her session, her account — the three rows that are about the
          ACCOUNT rather than the teaching (founder, 2026-09-11: "data & export can go to
          account"). The one caption that survives, because it sits over the destructive row. */}
      <View style={[ws.set_group, ws.set_group_tail]}>
        <Text style={[ws.set_cap, { color: t.ink_soft }]}>Account</Text>
        <View style={[ws.set_card, { borderColor: t.line, backgroundColor: t.card_bg }]}>
          {!onTrial ? <Row label="Your data & export" /> : null}
          <Row label="Log out" onPress={() => endSession(router, "settings: Log out")} />
          <Row label="Delete my account…" danger last />
        </View>
      </View>
    </ScrollView>
  );
}
