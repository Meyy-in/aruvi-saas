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
 * ⚠️ PHONE-ONLY (a technical limitation, §0): the DELETE GATES AVOID THE KEYBOARD. The web has no
 * soft keyboard, so its two gates simply appear under the card; here they open at the very bottom
 * of the longest screen in the app, with an autofocused field, so the keyboard covers the thing it
 * just asked her to read. `automaticallyAdjustKeyboardInsets` + a scroll-to-end on open is the
 * same answer support.jsx reached on 2026-09-16, and for the same reason — see its note on why
 * this is NOT a `KeyboardAvoidingView` job.
 *
 * ⚠️ Rows whose destinations arrive later in 6b are drawn but dark — the card list is the founder's
 * structure and shipping half of it would teach her a shape that then changes under her. A row
 * with no handler renders at half strength and does not respond, which is the gear's own idiom
 * from before it was lit.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Text } from "../../../components/Text";
import { API, getJSON, postJSON, withUser } from "@aruvi/shared/format";
import { entitlementState, subscribeEntitlement } from "@aruvi/shared/entitlement";
import { clearSession, endSession } from "../../../lib/session";
import { forgetDevice } from "@aruvi/shared/signout";
import { downloadDocument, dataExport, fetchDocument, canPreview, openInViewer, discardFile } from "../../../lib/download";
import { hasDownloaded, markDownloaded } from "../../../lib/dataRights";
import { Sheet } from "../../../components/AttachSheet";
import { Button, Input } from "../../../components/ui";
import Checkbox from "../../../components/Checkbox";
import ThemeToggle from "../../../components/ThemeToggle";
import TextSizeToggle from "../../../components/TextSizeToggle";
import { useTheme } from "../../../theme/ThemeContext";
import { useWebStyles } from "../../../theme/web";
import { openAsk } from "../../../lib/ask";

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

  /* ── The delete flow (6b·H) — two gates and a receipt ───────────────────────────────────
     ★ TWO GATES, SAYING DIFFERENT THINGS. Typing "erase" states INTENT; the last window states
     that she HAS HER DATA. Deletion is irreversible and the export is the only copy she can
     keep, so the download stops being a suggestion and becomes a question she must answer — and
     her answer is recorded server-side, in a log that outlives the erasure.
     ★ IT LIVES ON THIS LIST, not on a route of its own, because the RECEIPT replaces the whole
     screen. A pushed route would leave the Settings list underneath it, for an account the
     server has already destroyed. */
  /* ★ BOTH GATES LIVE AT THE BOTTOM OF THE LONGEST SCREEN IN THE APP, and the first one autofocuses
     a field — so opening one raises the keyboard over the very warning it is asking her to read
     (founder, 2026-09-17, on the handset). The inset on the ScrollView makes the gate REACHABLE;
     this brings it into view without her having to drag for it. `scrollToEnd` and not a measured
     offset because the gate IS the end of the content in both cases, and a measure would have to
     be re-taken every time a row above it appears or hides on trial. The delay lets the gate lay
     out first — scrolling to an end that has not grown yet lands short. */
  const scrollRef = useRef(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [finalOpen, setFinalOpen] = useState(false);
  const [downloadConfirmed, setDownloadConfirmed] = useState(false);
  const [busy, setBusy] = useState("");            // "docx" | "erase" | ""
  const [failMsg, setFailMsg] = useState("");
  const [receipt, setReceipt] = useState(null);
  useEffect(() => {
    if (!confirmOpen && !finalOpen) return undefined;
    const id = setTimeout(() => {
      try { scrollRef.current && scrollRef.current.scrollToEnd({ animated: true }); } catch {}
    }, 120);
    return () => clearTimeout(id);
  }, [confirmOpen, finalOpen]);

  /* Download site #4. ⚠️ WORKS ON TRIAL, unlike the Your-data card — this is the one export a
     trial teacher keeps, and G3's whole promise is that she has it before anything is
     destroyed. */
  /* ★ SHE SEES THE DOCUMENT, NOT A SHARE SHEET (WALK-A-030, founder 2026-09-20). This button went
     straight to the sheet on both phones while Settings › Your data already showed the file first.
     iOS gets Quick Look (`canPreview` → /preview); Android hands it to her own document app
     (`openInViewer`), and only falls back to the sheet when nothing can open it. Either way the
     file has reached her, which is what the final delete question asks about. */
  const downloadFirst = async () => {
    setBusy("docx"); setFailMsg("");
    const doc = dataExport("docx");
    try {
      if (canPreview(doc.mime)) {
        const f = await fetchDocument(doc);
        markDownloaded();
        /* ★ THE WINDOW MUST STAND DOWN FIRST (WALK-A-043, founder 2026-09-20, iPhone). The
           last-step window is a React Native Modal — its own native window, above the whole app —
           and the preview is a pushed ROUTE, so it opened BEHIND the window: she was asked to keep
           her data and then shown the same delete window again. Close it, let her read the
           document or send it on, and bring the window back when she returns — alone. */
        reopenFinal.current = true;
        setFinalOpen(false);
        router.push({ pathname: "/preview",
          params: { uri: f.uri, name: f.name, mime: f.mime, label: "Your data", from: "settings" } });
      } else {
        const f = await fetchDocument(doc);
        const shown = await openInViewer(f);
        if (!shown) { await downloadDocument(doc); discardFile(f.uri); }
        markDownloaded();
      }
    } catch {
      setFailMsg("Couldn’t prepare your download right now. Try again in a moment.");
    } finally {
      setBusy("");
    }
  };

  const erase = async () => {
    if (confirmText.trim().toLowerCase() !== "erase") return;
    if (!downloadConfirmed) { setFinalOpen(true); return; }
    setBusy("erase"); setFailMsg("");
    try {
      const r = await fetch(`${API}/data-rights/erase`, withUser({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "erase", downloaded_confirmed: true }),
      }));
      if (!r.ok) throw new Error(String(r.status));
      const got = await r.json();
      setFinalOpen(false);
      setReceipt(got);
      /* ★ THE SESSION ENDS HERE, NOT AT "DONE" (the web found this live on 2026-09-13). The
         account is gone the moment the receipt arrives, so the device is cleared now and the
         farewell simply stays on screen to be read. Leaving it until Done meant every other
         exit — the bar's ✕, the bottom nav — led back into a fully-rendered app for an account
         that no longer existed. `clearSession` is `endSession` without the navigation. */
      clearSession("settings: account erased");
      /* ★ AND THE DEVICE FORGETS IT WAS EVER SIGNED IN — erasure only, never a log out. The next
         person to open Meyy on this handset meets the Choose screen and its trial card, not a
         Sign in door for an account that no longer exists. See `forgetDevice`. */
      forgetDevice();
    } catch {
      setFailMsg("Couldn’t delete the account right now. Nothing was removed — try again.");
    } finally {
      setBusy("");
    }
  };
  /* ★ ON FOCUS, NOT ONLY ON MOUNT (founder, 2026-09-16, on the handset: the Marketing emails box
     showed ticked when the account says it is not). A `useEffect([])` reads ONCE — and this
     screen is never unmounted while she is inside Settings, because the subviews are PUSHED on
     top of it. So every value on this list is whatever it was when she first arrived: change
     something in a subview, or on the web, or from a terminal, come back, and the list is still
     telling her the old answer. My Classes and My Lessons have used `useFocusEffect` for exactly
     this since step 4; the Settings home never got it, and the web has no equivalent bug because
     its `syncTick` re-runs the same read. */
  const loadAccount = useCallback(() => {
    let live = true;
    getJSON("/account").then((a) => { if (live && a) setMarketing(!!a.marketing_email); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  useFocusEffect(loadAccount);

  /* WALK-A-043: she left this screen holding the last-step window open, to read her data. Put it
     back exactly as it was the moment she returns — the tick stays hers to give. */
  const reopenFinal = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!reopenFinal.current) return;
    reopenFinal.current = false;
    setFinalOpen(true);
  }, []));

  /* Optimistic, with a rollback: the tick is the answer, so it moves at once and goes back if
     the server refuses. Saved ON TAP — there is no Save button on a switch. */
  const saveMarketing = (next) => {
    const before = marketing;
    setMarketing(next); setMktBusy(true); setMktNote("");
    /* ⚠️ `enabled`, NOT `marketing_email` — the API's body is `MarketingPref {enabled: bool}`
       (api/main.py:2102) and the web has always sent that. The first port read the field name
       off the GET /account RESPONSE, where it IS `marketing_email`, and the two are simply not
       the same shape. Reported live on the handset, 2026-09-16: FastAPI rejected every tick
       with a 422. */
    postJSON("/account/marketing-email", { enabled: next })
      .then(() => setMktNote(next
        ? "Saved — you’ll hear from us occasionally."
        : "Saved — no more marketing emails."))
      .catch((e) => {
        setMarketing(before);
        /* ★ `e.detail`, never `e.message`. `postJSON` puts the SERVER's sentence in `detail`
           for a 4xx and leaves it empty otherwise, while `message` falls back to the bare
           status code — which is how a teacher came to be shown the word "422". A status code
           is not a sentence. ⚠️ A 422's own detail is a LIST of validation errors, not a
           string, so `detail` is empty there too and the fallback is what she reads. */
        setMktNote((e && e.detail) || "Couldn’t save that just now — try again.");
      })
      .finally(() => setMktBusy(false));
  };

  /* The farewell replaces everything. No bar item, no list — there is nothing left to go back
     to, and "Done" is the only control on screen. */
  if (receipt) {
    return (
      <ScrollView contentContainerStyle={[ws.main, { paddingTop: 12 }]}>
        <Text style={[ws.acct_farewell, { color: t.ink }]}>
          Your account and all your data have been deleted.
          {Array.isArray(receipt.kept) && receipt.kept.length > 0
            ? " Backup copies are purged within 30 days." : ""}
        </Text>
        <Button title="Done" style={ws.acct_bye}
          onPress={() => router.replace("/login")} />
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={[ws.main, { paddingTop: 12 }]}
      keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {/* ✅ LIVE AS OF 6d — the accordion, read-only. What she can CHANGE is the bar's "+";
          this is where she reads what she has told Meyy she teaches. */}
      <BigCard label="Teaching profile"
        sub="Subjects, classes, sections and periods you teach"
        onPress={() => router.push("/settings/profile")} />
      {/* ✅ LIVE AS OF 6c. `openAsk`, not a route: Ask Meyy is a panel over the shell, so it opens
          OVER Settings with the bar still live — the web's own behaviour (B3). Nothing is pushed,
          so the ✕ she closes it with leaves her exactly here. */}
      <BigCard label="Help" sub="Ask Meyy guide" onPress={openAsk} />
      <BigCard label="Support" sub="Write to us — we reply by email"
        onPress={() => router.push("/settings/support")} />
      <BigCard label="Subscription & billing" sub="Plan, billing & usage"
        onPress={() => router.push("/settings/subscription")} />
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
      {/* ★ TEXT SIZE (founder, 2026-09-18) — the iPhone's own size up to 1.2×, or a size chosen
          here that overrides it. Same card, the control where the chevron would be. */}
      <BigCard label="Text size" sub="Match your Device default or choose between standard, large and larger."
        right={<TextSizeToggle />} />
      {marketing !== null ? (
        <BigCard label="Marketing emails"
          sub="Occasional news on new subjects, features and teaching ideas — receipts, replies and agreement notices are sent either way"
          right={
            <Pressable onPress={mktBusy ? undefined : () => saveMarketing(!marketing)}
              disabled={mktBusy} hitSlop={10} accessibilityRole="switch"
              accessibilityState={{ checked: marketing, disabled: mktBusy }}
              accessibilityLabel="Send me occasional emails about new subjects and features">
              {/* ONE checkbox for the whole app (components/Checkbox.jsx) — the same square
                  the agreement's five ticks and its final tick use. It was drawn inline here
                  first, which is how it came to disagree with the web; a primitive is what
                  stops the next site disagreeing too. */}
              <Checkbox checked={!!marketing} busy={mktBusy} />
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
          {!onTrial ? <Row label="Your data & export"
            onPress={() => router.push("/settings/data")} /> : null}
          <Row label="Log out" onPress={() => endSession(router, "settings: Log out")} />
          <Row label="Delete my account…" danger last
            onPress={() => { setConfirmOpen(true); setConfirmText(""); }} />
        </View>
      </View>

      {/* Gate 1 — intent, typed. Inline under the card, framed in danger, as on the web. */}
      {confirmOpen ? (
        <View style={[ws.acct_del, { borderColor: t.danger }]}>
          <Text style={[ws.acct_del_warn, { color: t.ink }]}>
            This permanently deletes your account and all your data — it cannot be recovered
            afterwards. Type <Text style={ws.lgl_b}>erase</Text> to continue; we’ll ask you to
            confirm you have your data before anything is deleted.
          </Text>
          <View style={ws.acct_del_row}>
            <Input value={confirmText} onChangeText={setConfirmText} autoFocus
              autoCapitalize="none" autoCorrect={false} placeholder={'Type "erase"'}
              style={[ws.acct_del_input, { color: t.ink }]} />
            <Pressable
              disabled={busy === "erase" || confirmText.trim().toLowerCase() !== "erase"}
              onPress={erase} accessibilityRole="button"
              style={[ws.acct_del_go, { backgroundColor: t.danger,
                                        opacity: confirmText.trim().toLowerCase() === "erase"
                                          ? 1 : 0.45 }]}>
              <Text style={[ws.acct_del_go_t, { color: t.paper }]}>Continue →</Text>
            </Pressable>
            <Pressable onPress={() => { setConfirmOpen(false); setConfirmText(""); }}
              accessibilityRole="button" style={ws.acct_del_cancel}>
              <Text style={[ws.acct_del_cancel_t, { color: t.ink_soft }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {failMsg ? (
        <Text accessibilityRole="alert" style={[ws.acct_fail, { color: t.danger }]}>{failMsg}</Text>
      ) : null}

      {/* Gate 2 — "do you have your data?", as a window, because it is the last thing between
          her and an irreversible act and nothing else should be reachable behind it. */}
      {finalOpen ? (
        <Sheet visible scroll onClose={() => { setFinalOpen(false); setDownloadConfirmed(false); }}
          kicker="Last step" title="Have you downloaded your Meyy data?">
          <Text style={[ws.acct_final_p, { color: t.ink_soft }]}>
            Everything — your lesson plans, your teaching profile, your chapter notes and your
            progress — is deleted permanently and cannot be recovered. The download is the only
            copy you can keep.
          </Text>
          {/* Invoices are the one thing deletion does NOT destroy — they are tax records with a
              statutory retention. But she loses the ACCOUNT that reaches them, so the honest
              thing is to tell her to save them now. */}
          <Text style={[ws.acct_final_p, ws.acct_final_inv, { color: t.ink_soft }]}>
            Your invoices are kept as tax records, but you will no longer be able to download
            them here — save any you need from Subscription & billing first.
          </Text>
          {!hasDownloaded() ? (
            <Pressable onPress={busy ? undefined : downloadFirst} disabled={!!busy}
              accessibilityRole="button"
              style={[ws.acct_final_dl, { borderColor: t.pine, opacity: busy ? 0.5 : 1 }]}>
              <Text style={[ws.acct_final_dl_t, { color: t.pine }]}>
                {busy === "docx" ? "Preparing…" : "Download my data first (Word)"}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setDownloadConfirmed((v) => !v)}
            accessibilityRole="checkbox" accessibilityState={{ checked: downloadConfirmed }}
            style={[ws.acct_final_check, { borderColor: t.line, backgroundColor: t.field_bg }]}>
            {/* Clay, not pine — the web's `accent-color: var(--clay)` on this one input: it is
                a confirmation attached to a destructive act, not an ordinary preference. */}
            <Checkbox checked={downloadConfirmed} tone="clay" />
            <Text style={[ws.acct_final_check_t, { color: t.ink }]}>
              I confirm I have downloaded my Meyy data.</Text>
          </Pressable>
          <Text style={[ws.acct_final_note, { color: t.ink_soft }]}>
            Your confirmation is recorded against your account.
          </Text>
          {failMsg ? (
            <Text accessibilityRole="alert" style={[ws.acct_fail, { color: t.danger }]}>{failMsg}</Text>
          ) : null}
          <View style={ws.acct_final_row}>
            <Pressable disabled={!downloadConfirmed || busy === "erase"} onPress={erase}
              accessibilityRole="button"
              style={[ws.acct_del_go, { backgroundColor: t.danger,
                                        opacity: downloadConfirmed ? 1 : 0.45 }]}>
              <Text style={[ws.acct_del_go_t, { color: t.paper }]}>
                {busy === "erase" ? "Deleting…" : "Delete forever"}</Text>
            </Pressable>
            <Pressable onPress={() => { setFinalOpen(false); setDownloadConfirmed(false); }}
              accessibilityRole="button" style={ws.acct_del_cancel}>
              <Text style={[ws.acct_del_cancel_t, { color: t.ink_soft }]}>Cancel</Text>
            </Pressable>
          </View>
        </Sheet>
      ) : null}
    </ScrollView>
  );
}
