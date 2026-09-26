"use client";
import { useEffect, useState } from "react";
import { API, withUser, fetchEntitlement, getJSON, pretty, idInUse, errDetail,
         ROLES, STATES, EMAIL_OK, EMAIL_TAKEN, waLink, mobileWords,
         fmtValidity, scopeRows, subsFromEntitlement } from "../lib/format";
import ThemeToggle from "./ThemeToggle";
import Agreement from "./Agreement";
import PrivacyNotice from "./PrivacyNotice";
import Dropdown from "./Dropdown";

const maskEmail = (e) => {
  const [u, d] = String(e).split("@");
  if (!d) return "•••";
  return `${u.slice(0, 1)}•••@${d}`;
};

/* Her own profile shows the address IN FULL (founder, 2026-08-27) — masking is for
 * places where the address is merely REFERRED to (the support promise, the subscribe
 * tick); the profile is the one screen whose job is to answer "which address does
 * Aruvi hold for me?", and "k•••@gmail.com" cannot answer it. Long addresses step the
 * type DOWN rather than truncate: an elided address is the same failure as a masked
 * one. Thresholds are character counts against the field's width at 360px (the
 * budget-phone case, §4); `.ob-email-addr` also wraps as a last resort, so no address
 * is ever cut off however long it is. */
const emailFit = (e) => {
  const n = String(e || "").length;
  if (n <= 22) return "";
  if (n <= 28) return " ob-email-addr-s";
  if (n <= 36) return " ob-email-addr-xs";
  return " ob-email-addr-xxs";
};

/* ── Settings — the gear's own screen (founder, 2026-08-24 second pass) ──
 *
 * CARD list in the founder's order, each a plain-fill card (--card-bg, distinct from
 * the paper background) with icon · title · small text · chevron:
 *
 *   Subscription & billing · "Plan, billing & usage"      → subview (plan state now;
 *                             billing/invoices arrive with online payments)
 *   Your data & export     · "Download your Aruvi data"   → subview (Word / PDF)
 *   Help                   · "Ask Aruvi guide"            → opens Ask Aruvi
 *   Support                · "Write to us — we reply by email"
 *                                                         → subview (REAL as of
 *                             2026-08-27 — SupportForm above: Ask Aruvi first, then a
 *                             categorised message that posts to /support and comes back
 *                             with a reference)
 *   About Aruvi            · "Version info"               → subview (placeholder)
 *   Legal                  · "User agreement & privacy"   → subview (the real document,
 *                             Agreement.jsx in read mode — 2026-08-27)
 *
 * Below the cards, two quiet rows: Appearance (the ThemeToggle, moved off the top
 * bar) and Account (Log out · Delete my account — Apple 5.1.1(v), typed-"erase"
 * confirmation mirroring the API guard). NO Profile card — the person icon beside
 * the gear is the profile's dedicated door (founder point 3).
 *
 * Some cards are deliberately UI-first: the founder's direction is to shape the
 * surface now and fill content as features land (payments → billing; legal texts →
 * About). Placeholders say so honestly. Support was one of these until 2026-08-27.
 *
 * ★ ON TRIAL two of these cards are not offered — Personal profile and Your data &
 * export (founder, 2026-08-26). See `onTrial` in the component for the rule and for
 * the two lines it deliberately does not cross: the ROUTES stay open (data-rights is
 * never gated on subscription state, §2.5 — this is a choice about what Settings
 * SHOWS), and Delete my account keeps its own download button on trial. */

const scopeLabel = (s) =>
  s === "*" ? "All subjects" : pretty(String(s).replace("/", " · "));

/* Settings › Personal profile — view + edit of the account record. Self-contained:
 * fetches GET /account on mount, saves via POST /account (partial). */
function PersonalProfile({ onSaved }) {
  const [acct, setAcct] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [stateName, setStateName] = useState("");
  const [city, setCity] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");            // confirmed value (unchanged = keep)
  const [emailStage, setEmailStage] = useState("ok"); // ok | enter | confirm
  const [emailNew, setEmailNew] = useState("");
  const [email2, setEmail2] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);   // the "already in use" round-trip
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  /* WhatsApp support (2026-09-26) lives HERE, beside the email it trades off against —
     one door onto the choice. ★ AT LEAST ONE CHANNEL, ALWAYS (founder): she can switch
     WhatsApp off only while a CONFIRMED email is on the form, because Meyy must be able to
     reach a paying customer for invoices and legal/privacy notices. Without an email the
     switch stays on, locked, and says why. The server enforces the same rule (409). */
  const [wa, setWa] = useState(false);
  useEffect(() => {
    fetch(`${API}/account`, withUser()).then((r) => (r.ok ? r.json() : null)).then((a) => {
      if (!a) return;
      setAcct(a);
      setWa(!!a.whatsapp);
      setName(a.display_name || ""); setRole(a.role || ""); setStateName(a.state || "");
      setCity(a.city || ""); setSchool(a.school_name || ""); setEmail(a.email || "");
      setEmailStage(a.email ? "ok" : "enter");
    }).catch(() => {});
  }, []);

  /* ★ THE EMAIL CHANGE MUST NOT SILENTLY EVAPORATE (founder, 2026-09-26, live: "email
     when changed using 'change' after saving switches back to old mail"). The change was
     committed only by pressing Verify; a teacher who typed the address twice and pressed
     Save got the OLD address saved and the new one dropped. Now (a) two matching entries
     verify themselves, as the subscribe wizard's do, and (b) Save folds in a pending
     change whose two entries match — it never saves an unconfirmed one. Returns the
     address to save, or null when the pending change must be fixed first. */
  const verifyPending = async () => {
    if (emailStage !== "confirm") return email;
    if (!EMAIL_OK(email2)
        || email2.trim().toLowerCase() !== emailNew.trim().toLowerCase()) {
      setEmailErr("The two entries don't match — try again."); setEmail2("");
      return null;
    }
    setEmailBusy(true);
    const taken = await idInUse(emailNew, acct && acct.account_id);
    setEmailBusy(false);
    if (taken) {
      setEmailErr(EMAIL_TAKEN); setEmail2(""); setEmailStage("enter");
      return null;
    }
    const v = emailNew.trim();
    setEmail(v); setEmailStage("ok"); setEmailErr("");
    return v;
  };

  useEffect(() => {
    if (emailStage !== "confirm" || emailBusy || !EMAIL_OK(email2)) return;
    if (email2.trim().toLowerCase() !== emailNew.trim().toLowerCase()) return;
    verifyPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email2, emailNew, emailStage]);

  const save = async () => {
    setBusy(true); setNote("");
    const mail = await verifyPending();
    if (mail === null) { setBusy(false); return; }
    try {
      const r = await fetch(`${API}/account`, withUser({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: mail, role, state: stateName, city, school,
                               whatsapp: wa }),
      }));
      /* The SERVER'S OWN SENTENCE on a 4xx (2026-08-26) — a 409 here means the address
         belongs to another account, and "try again" is advice that can never work for
         it. Same fix as the checkout path; see SubscribeFlow.doCheckout. */
      if (!r.ok) {
        setNote(await errDetail(r, "Couldn't save right now — try again."));
        return;
      }
      // Back to the Settings cards (founder, 2026-08-26) AND tell the shell to re-read
      // the account, so a changed name lands on the bar/greeting without a reload.
      onSaved && onSaved();
      return;
    } catch {
      setNote("Couldn't save right now — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!acct) return <div className="setwrap"><div className="fr-loading">Loading…</div></div>;
  return (
    <div className="setwrap setwrap-tight">
      {/* No heading — the Settings bar names this screen (2026-09-03). */}
      {/* Labels ABOVE the boxes (founder, 2026-08-26 — placeholder-only left fields
          ambiguous once filled; reverted same day). */}
      <label className="login-field ob-field"><span>Your name <span className="ob-req" aria-hidden="true">*</span></span>
        <input type="text" value={name} placeholder="Enter your full name"
          onChange={(e) => setName(e.target.value)} /></label>
      <div className="acct-row"><span className="acct-k">Mobile</span>
        <span className="acct-v">{acct.phone || "—"}</span></div>

      {emailStage === "ok" && (
        /* Field-styled, like every other row (founder, 2026-08-26 — the confirmed
           email read too small as a bare line). */
        <label className="login-field ob-field"><span>Email</span>
          <div className="ob-email-view">
            <span className={"ob-email-addr" + emailFit(email)}>{email || "—"}</span>
            <button type="button" className="fr-link"
              onClick={() => { setEmailNew(""); setEmail2(""); setEmailStage("enter"); }}>
              change
            </button>
          </div>
        </label>
      )}
      {emailStage === "enter" && (
        <>
          <label className="login-field ob-field"><span>New email</span>
            <input type="email" autoComplete="off" value={emailNew}
              onChange={(e) => { setEmailNew(e.target.value); setEmailErr(""); }}
              placeholder="Enter your email" /></label>
          {/* The taken-address message lands HERE — the stage the fix belongs to. */}
          {emailErr && <p className="ob-err" role="alert">{emailErr}</p>}
          {EMAIL_OK(emailNew) && (
            <button type="button" className="fr-link"
              onClick={() => { setEmail2(""); setEmailStage("confirm"); }}>
              Confirm this email →
            </button>
          )}
        </>
      )}
      {emailStage === "confirm" && (
        <>
          <label className="login-field ob-field"><span>Re-enter your email</span>
            <input type="email" autoComplete="off" autoFocus value={email2}
              onChange={(e) => { setEmail2(e.target.value); setEmailErr(""); }}
              placeholder="Type it again to confirm" /></label>
          {emailErr && <p className="ob-err" role="alert">{emailErr}</p>}
          {/* Told at VERIFY, not at Save — the twin of the checkout check. */}
          <button type="button" className="fr-link"
            disabled={!EMAIL_OK(email2) || emailBusy}
            onClick={verifyPending}>
            {emailBusy ? "Checking…" : "Verify →"}
          </button>
        </>
      )}

      {/* WhatsApp support — see the state note above. `hasMail` is the CONFIRMED email on
          this form (an address mid-change does not count until Verify completes). */}
      {(() => {
        const hasMail = emailStage === "ok" && !!String(email || "").trim();
        const locked = wa && !hasMail;
        return (
          <div className="login-field ob-field">
            <span>WhatsApp support</span>
            <div className="ob-email-view pp-wa">
              <span className="pp-wa-txt">{wa
                ? <>On — Meyy support on WhatsApp from your sign-in number</>
                : <>Off</>}</span>
              <label className="set-switch">
                <input type="checkbox" checked={wa} disabled={locked || busy}
                  onChange={(e) => setWa(e.target.checked)}
                  aria-label="Use WhatsApp for Meyy support" />
              </label>
            </div>
            {locked && (
              <p className="ob-quiet">To switch WhatsApp off, add an email address above
                first — Meyy needs at least one way to reach you for your invoices and for
                legal and privacy notices.</p>
            )}
          </div>
        );
      })()}

      <label className="login-field ob-field"><span>Role <span className="ob-req" aria-hidden="true">*</span></span>
        <Dropdown value={role} onChange={setRole} options={ROLES}
          placeholder="Select your role" ariaLabel="Role" /></label>
      <label className="login-field ob-field"><span>State <span className="ob-req" aria-hidden="true">*</span></span>
        <Dropdown value={stateName} onChange={setStateName} options={STATES}
          placeholder="Select your state" ariaLabel="State" /></label>
      <label className="login-field ob-field"><span>City <span className="ob-req" aria-hidden="true">*</span></span>
        <input type="text" value={city} placeholder="Enter your city"
          onChange={(e) => setCity(e.target.value)} /></label>
      <label className="login-field ob-field"><span>School name (optional)</span>
        <input type="text" value={school} placeholder="Enter your school name"
          onChange={(e) => setSchool(e.target.value)} /></label>

      {/* Marketing emails (§K) deliberately do NOT live here — see the "Emails" group on
          the Settings home. Personal profile is hidden on trial, and a withdrawal right
          that disappears with a subscription state is not a withdrawal right. */}

      {/* Save never waits on the email step (founder, 2026-08-26): other fields save
          freely; a half-done email change is simply not saved until Verify completes —
          the previously confirmed email (or none) stays. */}
      {/* WALK-A-022: the same required fields as the subscribe wizard (City is mandatory). */}
      <button className="primary fr-cta ob-cta" disabled={busy || !String(name || "").trim() || !String(city || "").trim()}
        onClick={save}>{busy ? "Saving…" : "Save"}</button>
      {emailStage !== "ok" && (
        <p className="ob-quiet">Email isn't saved until you confirm it — everything else
          saves now.</p>
      )}
      {note && <p className="ob-quiet">{note}</p>}
    </div>
  );
}

/* ── Settings › Support (2026-08-27) ──────────────────────────────────────────────
 *
 * ★ AMENDED 2026-09-26 — WHATSAPP IS NOW A SECOND CHANNEL, OPT-IN. A teacher who said Yes
 * to WhatsApp at subscription sees a "Chat on WhatsApp" card under Ask Meyy. If she ALSO has
 * no email, the email form is replaced by a plain note — add an email to use email support,
 * meanwhile use WhatsApp — because a form whose reply cannot reach her is a dead end dressed
 * as a door. Everything below still describes the EMAIL channel, which is unchanged.
 *
 * EMAIL WAS THE ONLY SUPPORT CHANNEL. No phone, no WhatsApp, no chat. That single
 * constraint shapes every decision on this screen, because email's one failure mode is
 * SILENCE — a teacher who writes and hears nothing writes again, or gives up on the
 * product rather than on the message.
 *
 *   1. DEFLECT BEFORE INVITING. Ask Aruvi sits above the form, not below it. It answers
 *      "how does this work?" instantly; without that door first, the slowest channel in
 *      the product becomes its FAQ, and she waits two days for something she could have
 *      had in four seconds.
 *   2. THE FORM IS NOT A `mailto:`. A mailto: assumes a configured mail client — on a
 *      budget Android with only the Gmail web view, it is a dead link — and it leaves
 *      Aruvi with no record, no reference, and no way to attach what the app already
 *      knows. It posts to /support instead.
 *   3. A CATEGORY, NOT A SUBJECT LINE. A dropdown (founder, 2026-08-27 — chips first,
 *      then this: five labels as chips wrapped to three rows on a phone and pushed the
 *      message box below the fold, which is the one thing that must be visible). She
 *      does not have to compose a title for her own problem, and billing can carry its
 *      own faster promise. "Something else" is the last option deliberately — a list
 *      with no escape hatch gets the nearest wrong bucket picked instead.
 *   4. THE PROMISE IS STATED ONCE, AFTER SENDING, AND IT COMES FROM THE SERVER.
 *      "Within 2 working days" is the value POST /support returns, the same one the
 *      acknowledgement quotes. A stated window beats a fast unstated one: the anxiety is
 *      not the wait, it is not knowing there is an end to it — but the moment that
 *      matters is when she is actually waiting, i.e. after the send. It was stated twice
 *      until 2026-09-04 (once above the button, once on "Message sent", in the same
 *      words), and a promise repeated verbatim two screens apart reads as two promises.
 *   5. THE CONFIRMATION IS A REFERENCE. Not "thanks, we'll be in touch" — a case
 *      number, on screen and in her inbox, which is what turns a message into something
 *      somebody owes an answer on.
 *
 * What this screen deliberately does NOT do: apologise on behalf of an answer nobody
 * has written yet, promise an outcome, or list channels that do not exist. */
const SUPPORT_FALLBACK = [
  { key: "problem", label: "Something isn't working" },
  { key: "plan", label: "Something in a lesson plan looks wrong" },
  { key: "billing", label: "Billing or account" },
  { key: "suggestion", label: "A suggestion" },
  { key: "other", label: "Something else" },
];
const SUPPORT_MAX = 4000;
/* Hardcoded by decision (founder, 2026-09-03) — mirrors api/config.SUPPORT_ADDRESS.
   Move one, move the other. */
const SUPPORT_ADDRESS = "support@meyy.in";
const replyWords = (n) => `${n} working day${Number(n) === 1 ? "" : "s"}`;

/* The Ask Aruvi mark — the same hand-drawn stream-and-dot that sits on the tab row
   (page.jsx `.ask-q`). Repeated here rather than shown as a generic "?" so the row and
   the thing it opens are recognisably one object; a teacher who has met the mark once
   should not have to read the label to know where this goes. */
function AskMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 6.5c6 1 6 5 3.5 7.5S6 18 6 18" />
      <path d="M10.5 14c3.5 0 5.5-1.8 6.5-4" />
      <circle cx="17.3" cy="8.6" r="1.6" fill="#c0392b" stroke="none" />
    </svg>
  );
}

function SupportForm({ onOpenProfile, onAsk }) {
  const [meta, setMeta] = useState(null);          // categories + windows + her email
  const [cat, setCat] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(null);          // the server's reference + window
  /* ★ "COULDN'T LOAD" IS NOT "YOU HAVE NO EMAIL" (founder, 2026-08-27, live: account
     1000000001 was told there was no address on it, and there was). The first build
     fell back to an empty object on a failed fetch, and every downstream test then read
     that silence as a FACT about her account. A screen may say it does not know
     something; it may never invent an answer about her record. `metaErr` keeps the two
     apart, and the send path is unaffected either way — the server is the authority on
     where the acknowledgement went, and its response says so. */
  const [metaErr, setMetaErr] = useState(false);

  useEffect(() => {
    let live = true;
    getJSON("/support")
      .then((d) => { if (live) { if (d) setMeta(d); else setMetaErr(true); } })
      .catch(() => { if (live) setMetaErr(true); })
      .finally(() => { if (live) setMeta((m) => m || {}); });
    return () => { live = false; };
  }, []);

  const cats = (meta && meta.categories && meta.categories.length)
    ? meta.categories : SUPPORT_FALLBACK;
  /* ★ NO LOCAL `days` (2026-09-04). It existed to resolve billing's firmer window for
     the pre-send promise; with that promise gone the confirmation screen reads
     `sent.reply_window` straight off the POST response, so the window is resolved in ONE
     place — the server — and the two can no longer disagree. `meta.reply_days` /
     `meta.billing_reply_days` still arrive from GET /support and are deliberately left
     unread here: they are the screen's furniture if the promise is ever restated. */
  // Three states, not two: has one · known to have none · we could not ask.
  const emailKnown = !!meta && !metaErr;
  const hasEmail = emailKnown && !!meta.email;
  // WhatsApp only for a teacher who opted in — and only when we KNOW she did.
  const hasWa = emailKnown && !!meta.whatsapp;
  const waOnly = hasWa && !hasEmail;
  const openWa = () => {
    const note = `Hello Meyy, I need help. My sign-in number is ${mobileWords(meta && meta.mobile)}.`;
    window.open(waLink(note, meta && meta.whatsapp_number), "_blank", "noopener");
  };

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/support`, withUser({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: cat,
          message: text.trim(),
          /* What the app knows and she should not have to type. Only the screen today —
             richer context (subject · class · chapter) arrives when Support is also
             reachable FROM a lesson, which is where a "this plan looks wrong" report
             actually belongs. */
          context: { screen: "Settings › Support" },
        }),
      }));
      if (!r.ok) { setErr(await errDetail(r, "Couldn't send that just now — try again.")); return; }
      setSent(await r.json());
    } catch {
      setErr("Couldn't send that just now — try again.");
    } finally {
      setBusy(false);
    }
  };

  /* ── after sending: the reference, and where the copy went ── */
  if (sent) {
    return (
      <div className="setwrap">
        <h1 className="set-title">Message sent</h1>
        <div className="set-card set-card-pad">
          <div className="sup-refcap">Your reference</div>
          <div className="sup-ref">{sent.reference}</div>
          <p className="set-plan-txt">
            {sent.emailed
              ? <>A copy is on its way to <strong>{sent.email}</strong>. You can expect a
                  response within {sent.reply_window || replyWords(sent.reply_days || 2)},
                  Monday to Friday.</>
              : <>Your message is with us and you can expect a response within{" "}
                  {sent.reply_window || replyWords(sent.reply_days || 2)}, Monday to
                  Friday. There is no email address on your account, so write to us at{" "}
                  <strong>{SUPPORT_ADDRESS}</strong> — quote your reference — and we will
                  reply there.</>}
          </p>
        </div>
        {/* On TRIAL the account has only a mobile, so this is the common case, not the
            edge one. The plain address above is the working answer; adding an email is
            the better one, offered second. */}
        {!sent.emailed && (
          <button className="fr-link sup-addmail"
            onClick={() => onOpenProfile && onOpenProfile()}>
            Or add an email address to your account →</button>
        )}
        <p className="set-hint">Quote {sent.reference} if you write to us about this
          again — it keeps everything in one place.</p>
      </div>
    );
  }

  return (
    <div className="setwrap">
      {/* No heading (founder, 2026-09-03): the Settings bar reads "⚙ Support" — the
          frozen `.set-title-stick` title of 2026-08-27 was a second sticky row saying
          the same word, and on a phone it was the row that pushed Send under the fold.
          `.set-first` pulls the first line up into main's top padding, which is what
          `.sup-title`'s -26px used to do for the heading. */}

      {/* 1 · the fast door first */}
      <p className="set-hint set-first">Most questions about how Meyy works are answered straight
        away by Ask Meyy. For anything else, write to us below.</p>
      <button className="set-bigcard sup-ask" onClick={() => onAsk && onAsk()}>
        <span className="sup-askmark"><AskMark /></span>
        <span className="set-bigtext"><span className="set-biglab">Ask Meyy</span>
          <span className="set-bigsub">Answers about how Meyy works — instantly</span></span>
        <span className="set-chev">›</span>
      </button>

      {/* 1b · WhatsApp — opted-in teachers only. For a WhatsApp-only teacher (no email) this
          IS the written channel, so it is said as such and the email form below gives way
          to the add-email note. */}
      {hasWa && (
        <button className="set-bigcard sup-wa" onClick={openWa}>
          <span className="set-bigtext"><span className="set-biglab">Chat on WhatsApp</span>
            <span className="set-bigsub">Message Meyy support</span></span>
          <span className="set-chev">›</span>
        </button>
      )}

      {waOnly && (
        <div className="set-group">
          <div className="set-cap">Email support</div>
          <div className="set-card set-card-pad">
            <p className="set-plan-txt">To use email support, first add an email address to
              your account — our replies need somewhere to go. Meanwhile, you can reach us on
              WhatsApp above.</p>
            <button className="fr-link sup-addmail"
              onClick={() => onOpenProfile && onOpenProfile()}>
              Add an email address →</button>
          </div>
        </div>
      )}

      {/* 2 · the form — not for a WhatsApp-only teacher (see 1b) */}
      {!waOnly && (
      <div className="set-group">
        <div className="set-cap">Write to us</div>
        <div className="set-card set-card-pad">
          {/* ★ THE FORM IS SHAPED LIKE A MAIL (founder, 2026-09-03): To · Subject ·
              message. The To line is HARDCODED, not read from GET /support — the
              running API had handed the screen the founder's Gmail (a process older
              than the config change), and an address a teacher is told to write to
              must not depend on which server answered. A read-only VALUE, not a field:
              no plane, no border, nothing that invites a tap. */}
          <div className="login-field ob-field sup-field sup-to-row">
            <span>To</span>
            <div className="sup-to">{SUPPORT_ADDRESS}</div>
          </div>
          <label className="login-field ob-field sup-field">
            <span>Subject</span>
            {/* No preselection — a dropdown that answers for her files a suggestion as
                a fault, and the choice also sets which reply window she is promised. */}
            <Dropdown value={cat} onChange={setCat} placeholder="Choose one"
              ariaLabel="Subject"
              options={cats.map((c) => ({ value: c.key, label: c.label }))} />
          </label>
          <label className="login-field ob-field sup-field">
            <span>Your message</span>
            {/* No placeholder (founder, 2026-08-27). Prompt text inside the box tells a
                teacher what shape her trouble is supposed to be, and she trims it to
                fit; an empty box asks nothing and gets the whole story. */}
            <textarea className="sup-text" rows={7} value={text}
              maxLength={SUPPORT_MAX}
              onChange={(e) => setText(e.target.value)} /></label>
          {/* Only near the cap — a live counter on an empty box reads as a word limit
              on how much trouble she is allowed to be in. */}
          {text.length > SUPPORT_MAX - 500 && (
            <p className="ob-quiet">{SUPPORT_MAX - text.length} characters left</p>
          )}
          {/* ★ THE PROMISE IS MADE ONCE, AFTER SENDING (founder, 2026-09-04). It used
                 to be stated here too, above the button, and then again on the "Message
                 sent" screen in the same words — so the only thing the second telling
                 added was the suspicion that it was a different promise. The moment it
                 is load-bearing is the one where she is waiting, which is after she has
                 sent, and that screen quotes the SERVER's own `reply_window` rather than
                 a locally-derived guess. Removed with it: billing's "Billing questions
                 come first", which was true and unactionable before sending — she cannot
                 make her problem a billing problem, and the confirmation still states
                 billing's own firmer window because the SERVER resolves it. */}
          {/* ★ IN FULL, NOT MASKED (founder, 2026-09-04). It read "k•••@gmail.com", a
                 privacy treatment borrowed from the subscribe flow's confirmation —
                 where the address is being CONFIRMED BACK to her and the only job is
                 recognition. Here the job is the opposite: this is the last moment she
                 can catch a wrong or stale address, before spending effort writing to
                 somewhere she will never be answered. A mask defeats exactly that check,
                 since "k•••@gmail.com" matches every address she owns.
                 `overflow-wrap` because an address has no spaces to break at, and a long
                 one would otherwise push the card sideways at 360px. */}
          {hasEmail && (
            <p className="ob-quiet">Our reply goes to{" "}
              <span className="sup-replyto">{meta.email}</span>.</p>
          )}
          {/* ONLY when the server actually told us she has none. Said BEFORE she
              writes, not after: a teacher who types out a problem and only then learns
              nobody can answer her has been wasted. The address is spelled out so she
              can write from her own mail app instead. When the lookup FAILED we say
              nothing here — see `metaErr` above. */}
          {emailKnown && !hasEmail && (
            <p className="ob-quiet">There is no email address on your account, so we
              cannot write back — add one under Personal profile, or write to us
              directly at {SUPPORT_ADDRESS}.</p>
          )}
          {err && <p className="ob-err" role="alert">{err}</p>}
          <button className="primary fr-cta ob-cta"
            disabled={!cat || !text.trim() || busy}
            onClick={send}>{busy ? "Sending…" : "Send message"}</button>
        </div>
      </div>
      )}

      {/* ★ THE "YOUR EARLIER MESSAGES" LIST IS GONE (founder, 2026-09-04). It listed
             category · reference · date and opened nothing — a row that cannot be
             read is furniture, and it invited the tap it then refused. Building the
             detail view was the obvious repair and is the wrong one, because the list
             CANNOT be complete: support is an email channel and a teacher may write
             to {SUPPORT_ADDRESS} straight from her own mail app, at which point Aruvi
             never sees the message and has nothing to file. A history that silently
             omits half of what she remembers sending is worse than none — she reads
             the absence as "they lost it".
             Her inbox already holds the whole record, both directions, searchable, and
             every acknowledgement carries its reference. That IS the history, and it is
             the one place that has all of it. GET /support still returns `requests`
             (unread here) — the cases are stored either way, and the founder-side view
             is where they belong. */}
    </div>
  );
}

/* ★ `STAGE_CLASSES`, `fmtValidity`, `scopeRows` and the subscription SORT moved to
 * `@aruvi/shared/format` on 2026-09-16 (Track D 6b·D), because the phone grew a Subscription &
 * billing screen and would otherwise have retyped all four. CLAUDE.md §3 — one function, both
 * surfaces. The reasoning that used to live here (the billing unit is subject-STAGE, so the
 * class list is a fact of the stage; latest expiry first because every term is one year; ties
 * keep cart order) travelled with them.
 * ⚠️ `todayISO` went too: it was only ever the fallback for an API that sends no
 * `live_scopes`, and that fallback is now inside `subsFromEntitlement`. */

/* `view` is LIFTED to page.jsx (founder 2026-08-24: the frozen Settings bar's back
 * button is hierarchical — subview → home → origin — so the shell must know which
 * level is showing). Values: home | subscription | data | support | about. */
export default function Settings({ view, setView, onOpenProfile, onAsk, onSignOut,
                                   onSubscribe, onAccountSaved, syncTick = 0,
                                   trial = false,
                                   /* Fired the instant the erasure receipt lands. The account
                                      is GONE at that moment, so the shell ends the session
                                      underneath this screen — see page.jsx onErased. */
                                   onErased = () => {},
                                   /* Which document the Legal card shows — "agreement" |
                                      "privacy". Lifted to page.jsx so the shell's
                                      "notice updated" note can open Legal ON the notice. */
                                   legalDoc = "agreement", setLegalDoc = () => {} }) {
  const [ent, setEnt] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [busy, setBusy] = useState("");        // "docx" | "pdf" | "erase" | ""
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [failMsg, setFailMsg] = useState("");
  const [receipt, setReceipt] = useState(null);
  // The LAST window: "have you downloaded your data?" (founder, 2026-08-26).
  const [finalOpen, setFinalOpen] = useState(false);
  const [downloadConfirmed, setDownloadConfirmed] = useState(false);
  // Did she actually download in this session? Used only to word the question honestly —
  // the confirmation is HERS to give either way (she may have exported last week).
  const [didDownload, setDidDownload] = useState(false);
  /* ★ MARKETING EMAILS (§K) LIVE AT THIS LEVEL, NOT IN PERSONAL PROFILE (2026-09-04).
     It was built inside Personal profile — the obvious home, since it is a contact
     preference — and that was wrong twice over. Personal profile is HIDDEN ON TRIAL, so
     the withdrawal disappeared for the teachers most likely to want it; and DPDP §6
     requires withdrawing to be as easy as consenting was, which one tap on the agreement
     screen is and two levels of navigation is not. It is now a row on the Settings HOME
     list, ungated, beside Appearance — the existing pattern for a preference you flip in
     place. ONE door: it was removed from Personal profile rather than shown in both,
     because two doors onto one record is how they drift. */
  const [marketing, setMarketing] = useState(null);   // null = not yet known
  const [mktBusy, setMktBusy] = useState(false);
  const [mktNote, setMktNote] = useState("");

  useEffect(() => {
    let live = true;
    fetch(`${API}/account`, withUser())
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (live && a) setMarketing(!!a.marketing_email);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [syncTick]);

  /* Optimistic, then reconciled: the box moves the instant she taps it and reverts only
     if the write actually failed. A withdrawal that appears not to have registered is
     the one outcome worth spending a rollback on — she will tap it again, and again. */
  const saveMarketing = async (next) => {
    const prev = marketing;
    setMarketing(next); setMktBusy(true); setMktNote("");
    try {
      const r = await fetch(`${API}/account/marketing-email`, withUser({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      }));
      if (!r.ok) {
        setMarketing(prev);
        setMktNote(await errDetail(r, "Couldn't save that just now — try again."));
        return;
      }
      setMktNote(next ? "Saved — you'll hear from us occasionally."
                      : "Saved — no more marketing emails.");
    } catch {
      setMarketing(prev);
      setMktNote("Couldn't save that just now — try again.");
    } finally {
      setMktBusy(false);
    }
  };

  // Re-fetch when the shell signals a subscription change (in-app subscribe done).
  useEffect(() => { fetchEntitlement().then(setEnt); }, [syncTick]);

  /* Her invoices, newest first (2026-08-26). Fetched with the entitlement and on the
     same tick, so a fresh purchase's invoice appears with the subscription it paid for
     rather than a refresh later. */
  useEffect(() => {
    let live = true;
    getJSON("/invoices")
      .then((d) => { if (live) setInvoices((d && d.invoices) || []); })
      .catch(() => { if (live) setInvoices([]); });
    return () => { live = false; };
  }, [syncTick]);

  /* ★ ON TRIAL, NEITHER "Personal profile" NOR "Your data & export" IS OFFERED
     (founder, 2026-08-26, after the persona run). The trial is a look at the teaching
     product; the account around it belongs to a teacher who has one. Both cards are
     hidden and both subviews are unreachable while the trial runs, and both return
     whole the moment she subscribes.
     Two boundaries deliberately NOT crossed:
       · UI ONLY. `POST /account` and `/data-rights/*` stay open — checkout writes the
         account record itself, and §2.5's "data rights are never gated" is a promise
         about the routes, not about which cards Settings chooses to show.
       · Delete my account keeps its download. The export is the only copy she can keep
         and G3's whole point is that she has it before anything is destroyed — so the
         last window's "Download my data first" button works on trial exactly as it does
         on a subscription.
     `trial` comes from the SHELL, which has already synced by the time the gear is
     pressed; this component's own `ent` is the fallback and also catches a state change
     landing while Settings is open. */
  // Trial is her RECORD's word, not the gate's (2026-09-11; see page.jsx's setEntTrial).
  const onTrial = !!trial || !!(ent && (ent.status === "trial" || ent.plan_id === "trial"));

  // If the trial answer lands while she is standing in one of those subviews, leave.
  useEffect(() => {
    if (onTrial && (view === "personal" || view === "data")) setView("home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTrial, view]);

  const download = async (fmt) => {
    setBusy(fmt); setFailMsg("");
    try {
      const r = await fetch(`${API}/data-rights/export?format=${fmt}`, withUser());
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aruvi-your-data.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDidDownload(true);        // only to word the final question honestly
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setFailMsg("Couldn't prepare your download right now. Try again in a moment.");
    } finally {
      setBusy("");
    }
  };

  /* One invoice PDF. Same blob-download shape as the data export above — the file
     arrives with the API's own filename, and a failure says so instead of leaving a
     dead link (2026-08-26). */
  const downloadInvoice = async (number) => {
    setBusy(`inv-${number}`); setFailMsg("");
    try {
      const r = await fetch(`${API}/invoices/${encodeURI(number)}`, withUser());
      if (!r.ok) throw new Error(String(r.status));
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Meyy-invoice-${String(number).replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setFailMsg("Couldn't fetch that invoice right now. Try again in a moment.");
    } finally {
      setBusy("");
    }
  };

  /* Typing "erase" no longer deletes — it opens the LAST window (founder, 2026-08-26).
     Deletion is irreversible and the export is the only copy she can keep, so she has to
     state that she has it. Her answer is recorded server-side, tenant/user wise, in a log
     that outlives the erasure. */
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
      setReceipt(await r.json());
      /* ★ THE SESSION ENDS HERE, NOT AT "DONE" (founder, 2026-09-13 — found live).
         The farewell used to be the ONLY thing standing between a deleted account and the
         shell, and its Done button the only control that signed her out. The frozen Settings
         bar's ✕ sits directly above it and knew nothing about the erasure, so closing that
         way returned her to a fully-rendered My Classes for an account the server had already
         destroyed — page.jsx re-reads /readiness only when `user` changes, so it persisted
         until a manual refresh (which 401s and signs out). Reported as "after deletion the
         profile continues to show". The receipt is the moment of death: the shell clears the
         device and arms its exits now, and the farewell simply stays on screen to be read. */
      onErased();
    } catch {
      setFailMsg("Couldn't delete the account right now. Nothing was removed — try again.");
    } finally {
      setBusy("");
    }
  };

  if (receipt) {
    return (
      <div className="setwrap">
        <p className="acct-farewell">
          Your account and all your data have been deleted.
          {Array.isArray(receipt.kept) && receipt.kept.length > 0 &&
            " Backup copies are purged within 30 days."}
        </p>
        <button className="primary acct-bye" onClick={() => onSignOut && onSignOut()}>
          Done
        </button>
      </div>
    );
  }

  // No in-content back links: the frozen Settings bar above carries the one exit — its ✕,
  // which closes the screen the bar names, so a subview lands back on this list
  // (page.jsx settingsClose, 2026-09-07).
  const back = null;

  /* ── PERSONAL PROFILE subview (founder, 2026-08-25): her account details, editable.
     Email edits use the same double-blind confirmation as acquisition. The mobile
     (her sign-in) is shown, never editable here. */
  if (view === "personal" && !onTrial) {
    return <PersonalProfile onSaved={() => { onAccountSaved && onAccountSaved(); setView("home"); }} />;
  }

  /* ── subviews ── */
  if (view === "subscription") {
    /* `lapsed` is the SERVER's derived answer — revoked OR run out by date (2026-08-26);
       the status test is only the fallback for an older API. `active` must then EXCLUDE
       lapsed, or a date-expired teacher would read "SUBSCRIBED" here while every write
       of hers is being refused. */
    /* `onTrial` is the component-level flag above (it also reads the shell's prop) — not
       re-derived here, so the subscription card and the hidden cards can never disagree. */
    const lapsed = ent && (ent.lapsed !== undefined
      ? !!ent.lapsed
      : !!(ent.enforced && ent.status === "expired"));
    /* ★ WHAT SHE HAS DOES NOT DEPEND ON WHETHER THE GATE IS ON (2026-08-26). `active`
       used to require `ent.enforced`, so with ARUVI_ENTITLEMENT_ENFORCED unset — the
       DEFAULT, and easy to lose when the API is restarted — a teacher who had really
       paid saw "Your plan details will appear here" and no Add button. Enforcement
       decides what is REFUSED, never what is TRUE. `lapsed` still comes from the server
       (which reports false when the gate is off), so dev mode never shows "Ended". */
    const active = ent && !lapsed && ent.plan_id !== "trial"
      && (ent.status === "active" || ent.status === "grace");
    // One record per subscription, NEWEST PURCHASE first (founder, 2026-09-18) — the rule is
    // shared with the phone and reads the invoices' issue times.
    const subs = subsFromEntitlement(ent, invoices);
    /* ★ NOTHING TO SAY, NOTHING DRAWN (founder, 2026-09-16: "in both web and phone active
       subscriptions must not show that sliver"). The card below has exactly three things it can
       say, and an ACTIVE teacher — not on trial, not ended — matches none of them, so it used
       to render as an empty bordered strip above her subscriptions. An empty strip at the top of
       a screen is what a row looks like while it is still loading, and the only teacher who saw
       it was the paying one. */
    const planCard = onTrial || lapsed || !active;
    return (
      <div className="setwrap">
        {back}
        {/* No heading — the fixed Settings bar names this screen (2026-09-03), which
            also retires the frozen title of 2026-08-26: the list it named is now named
            by a row that never scrolls at all. */}
        {planCard && (
        <div className="set-card set-card-pad set-first">
          {onTrial && (
            <div className="set-plan"><span className="set-pill">Free trial</span>
              <span className="set-plan-txt">{ent.trial_chapters_used} of {ent.trial_chapter_cap} chapters used</span></div>
          )}
          {lapsed && (
            <div className="set-plan"><span className="set-pill set-pill-off">Ended</span>
              <span className="set-plan-txt">Your plans remain yours to open, export and print</span></div>
          )}
          {!(onTrial || active || lapsed) && (
            <div className="set-plan"><span className="set-plan-txt">Your plan details will appear here.</span></div>
          )}
        </div>
        )}

        {/* ★ ONE BOX PER SUBSCRIPTION, LATEST FIRST (founder, 2026-08-26 evening).
            They were rows stacked inside a single card, under one shared "Validity"
            that could only ever be true of one of them. Each subject-stage is now its
            own purchase, with its own year and its own end date, so each gets its own
            box — the card IS the unit of what she bought.
            ORDER: by expiry, descending. Every term is exactly one year, so the latest
            expiry IS the latest purchase; a renewal correctly returns to the top. (If
            terms ever differ, this needs a real purchase date to sort on.) Ties — the
            ordinary case of several bought in one checkout — keep cart order, which is
            the order she chose them in.
            An EXPIRED one is still shown: she owned it, and this row is the explanation
            for anything she can no longer prepare there. */}
        {active && subs.map(({ scope, until, live }, idx) => {
          const r = scopeRows(scope);
          /* The invoice that bought THIS subscription — the newest one listing this
             scope (a renewal issues a second invoice for the same scope, and the one
             that explains today's validity is the latest). */
          const inv = invoices.find((iv) => (iv.scopes || []).includes(scope));
          return (
            <div key={scope} className={`set-card set-card-pad set-sub-card${
              !planCard && idx === 0 ? " set-first" : ""}`}>
              <div className="set-plan">
                <span className={`set-pill ${live ? "set-pill-on" : "set-pill-off"}`}>
                  {live ? "Subscribed" : "Ended"}
                </span>
              </div>
              <div className="acct-row"><span className="acct-k">Subject</span><span className="acct-v">{r.subject}</span></div>
              <div className="acct-row"><span className="acct-k">Stage</span><span className="acct-v">{r.stage}</span></div>
              <div className="acct-row"><span className="acct-k">Class</span><span className="acct-v">{r.classes}</span></div>
              {until && (
                <div className="acct-row"><span className="acct-k">Validity</span>
                  <span className={`acct-v ${live ? "" : "set-scope-done"}`}>
                    {live ? "until " : "ended "}{fmtValidity(until)}
                  </span></div>
              )}
              {/* ★ THE INVOICE SITS WITH THE SUBSCRIPTION IT PAID FOR (founder,
                  2026-08-26). Not a separate billing list to go hunting in: the
                  question "what did I pay for this?" is asked while looking at the
                  thing. The number is shown even when the PDF is missing — the
                  number is the record; the file is a convenience. */}
              {inv && (
                <div className="acct-row"><span className="acct-k">Invoice</span>
                  <span className="acct-v">
                    {inv.has_pdf ? (
                      <button type="button" className="fr-link set-inv-dl"
                        disabled={busy === `inv-${inv.number}`}
                        onClick={() => downloadInvoice(inv.number)}>
                        {busy === `inv-${inv.number}` ? "Preparing…" : `${inv.number} ↓`}
                      </button>
                    ) : inv.number}
                  </span></div>
              )}
            </div>
          );
        })}
        {/* Subscribe from here too (founder, 2026-08-25): on trial or ended, the same
            wizard the paywall and the front door open. */}
        {(onTrial || lapsed) && onSubscribe && (
          <button className="paywall-subscribe set-subscribe" onClick={onSubscribe}>
            Subscribe
          </button>
        )}
        {/* ★ A SUBSCRIBED TEACHER CAN ADD MORE (founder, 2026-08-26). Same wizard, same
            cart; it opens at the subjects step because her details are already on file,
            and the chooser omits what she already holds live. Each addition runs a full
            year from the day she makes it — hence the line below the button. */}
        {active && !onTrial && onSubscribe && (
          <>
            <button className="paywall-subscribe set-subscribe" onClick={onSubscribe}>
              Add subjects &amp; stages
            </button>
            <p className="set-hint">Anything you add runs for a full year from the day you
              add it, alongside what you already have.</p>
          </>
        )}
        {failMsg && <p className="acct-fail" role="alert">{failMsg}</p>}
        <p className="set-hint">Online payments open soon. Your invoices are here already —
          one per purchase, on the subscription it paid for.</p>
      </div>
    );
  }

  if (view === "data" && !onTrial) {
    return (
      <div className="setwrap">
        {back}
        <p className="set-hint set-first">Everything you've created — your profile, notes and teaching
          progress — in one document.</p>
        <div className="set-card">
          <button className="set-row" disabled={!!busy} onClick={() => download("docx")}>
            <span className="set-lab">{busy === "docx" ? "Preparing…" : "Download as Word"}</span>
            <span className="set-chev">›</span>
          </button>
          <button className="set-row" disabled={!!busy} onClick={() => download("pdf")}>
            <span className="set-lab">{busy === "pdf" ? "Preparing…" : "Download as PDF"}</span>
            <span className="set-chev">›</span>
          </button>
        </div>
        {failMsg && <p className="acct-fail" role="alert">{failMsg}</p>}
      </div>
    );
  }

  /* ── Support (2026-08-27) — the real thing, replacing the placeholder. Never hidden
     on trial: a teacher whose trial is the thing that is broken must be able to say so,
     and the /support route is ungated for the same reason data rights are (§2.5). */
  if (view === "support") {
    return <SupportForm onAsk={onAsk}
                        onOpenProfile={() => setView("personal")} />;
  }

  if (view === "about") {
    return (
      <div className="setwrap">
        {back}
        <div className="set-card set-card-pad set-first">
          <p className="set-plan-txt">Meyy · Lesson Studio — preview build.<br />
            NCF 2023 aligned.</p>
        </div>
        <p className="set-hint">Version details will live here. The user agreement and
          privacy notice are under Settings &rsaquo; Legal.</p>
      </div>
    );
  }

  /* ── Legal (2026-08-27) — the agreement's permanent home ──
     The document promises it is "permanently available under Settings → Legal", so it is
     a card of its own rather than a row inside About: a teacher looking for what she
     signed should not have to guess that it is filed under version information. Same
     component the subscribe wizard uses, in read mode — one document, never a retyped
     summary. Never hidden on trial: what Aruvi is and what it does with her data is not
     a subscriber benefit. */
  if (view === "legal") {
    return (
      <div className="setwrap">
        {back}
        {/* No "Legal" page title (founder, 2026-08-27): the document's own heading —
            "Legal Agreement with User" — is the title, and a settings label stacked
            above it made the screen read as two headings for one thing. */}
        {/* ★ TWO DOCUMENTS, ONE CARD (2026-09-04). The Privacy Notice is a document of
            its own — DPDP Rule 3(a) wants it readable independently of the agreement —
            but it is not a second Settings card: "Legal" is where a teacher looks for
            what Meyy holds her to, and both belong under that word. A two-pill switch
            above the document; the bar keeps saying "⚙ Legal".
            ★ THE SWITCH IS FROZEN under the Settings bar (founder, same day: "freeze
            the legal screen from above … when scrolling") — both documents are long,
            and the other one must stay one tap away from anywhere in this one. It sits
            OUTSIDE the card because `.set-card` is overflow:hidden, which makes the
            card the sticky container and pins nothing (the `.dash-hd` idiom instead:
            sticky at --nav-h, paper fill, hairline below). It is the subview's first
            element, so it carries `.set-first`. Not a title — the bar names the screen
            (2026-09-03); this is the choice inside it. */}
        {/* ★ ONE PINNED BAND: pills + the document's heading (founder, same day, second
            pass: "the buttons are frozen but rest all are moving above and below it …
            top down to the button and the words … visible at all times"). Two sticky
            elements at different offsets would need the pills' height known; one band
            needs nothing. It starts FLUSH under the Settings bar — main's top padding is
            pulled into the band as its own padding, so the air above the pills is
            painted paper and no scrolled line shows through it. The components' own
            `.lgl-head` is hidden under `.set-legal-headless`; the heading here is the
            band's, and says exactly what the document's would. */}
        <div className="lgl-stick">
          <div className="lgl-switch" role="tablist" aria-label="Legal documents">
            <button type="button" role="tab" aria-selected={legalDoc !== "privacy"}
              className={`lgl-switch-btn ${legalDoc !== "privacy" ? "on" : ""}`}
              onClick={() => setLegalDoc("agreement")}>User agreement</button>
            <button type="button" role="tab" aria-selected={legalDoc === "privacy"}
              className={`lgl-switch-btn ${legalDoc === "privacy" ? "on" : ""}`}
              onClick={() => setLegalDoc("privacy")}>Privacy notice</button>
          </div>
          <h1 className="ob-title lgl-stick-title">
            {legalDoc === "privacy" ? "Privacy Notice" : "Legal Agreement with User"}
          </h1>
        </div>
        <div className="set-card set-card-pad set-legal set-legal-headless">
          {legalDoc === "privacy" ? <PrivacyNotice /> : <Agreement mode="read" />}
        </div>
      </div>
    );
  }

  /* ── home: the five cards, then the quiet rows ── */
  return (
    <div className="setwrap">
      {/* No heading here — the frozen bar above IS the one "Settings" title
          (founder: two different-size "Settings" texts were showing). */}
      {/* Two profiles, clearly told apart (founder, 2026-08-25): PERSONAL (who she is —
          account details, editable here) on top, TEACHING (what she teaches) below. */}
      {/* ★ ORDERED BY HOW OFTEN SHE OPENS IT (founder, 2026-09-11): the teaching profile
          she returns to all year on top; Help and Support next; billing; then the
          once-a-year items — personal details, the two quiet toggles, export, legal,
          about — and the account rows last under the ONE caption that survives. The
          "Emails"/"App" captions went the same day: a heading over a single row is noise
          on a phone; "Account" stays because it sits over the destructive row. */}
      <button className="set-bigcard" onClick={() => onOpenProfile && onOpenProfile()}>
        <span className="set-bigtext"><span className="set-biglab">Teaching profile</span>
          <span className="set-bigsub">Subjects, classes, sections and periods you teach</span></span>
        <span className="set-chev">›</span>
      </button>
      <button className="set-bigcard" onClick={() => onAsk && onAsk()}>
        <span className="set-bigtext"><span className="set-biglab">Help</span>
          <span className="set-bigsub">Ask Meyy guide</span></span>
        <span className="set-chev">›</span>
      </button>
      <button className="set-bigcard" onClick={() => setView("support")}>
        <span className="set-bigtext"><span className="set-biglab">Support</span>
          <span className="set-bigsub">Write to us — we reply by email</span></span>
        <span className="set-chev">›</span>
      </button>
      <button className="set-bigcard" onClick={() => setView("subscription")}>
        <span className="set-bigtext"><span className="set-biglab">Subscription &amp; billing</span>
          <span className="set-bigsub">Plan, billing &amp; usage</span></span>
        <span className="set-chev">›</span>
      </button>
      {/* Personal profile — hidden on trial (see `onTrial` above). */}
      {!onTrial && (
      <button className="set-bigcard" onClick={() => setView("personal")}>
        <span className="set-bigtext"><span className="set-biglab">Personal profile</span>
          <span className="set-bigsub">Your name, email, role and school details</span></span>
        <span className="set-chev">›</span>
      </button>
      )}

      {/* Appearance and Marketing emails wear the SAME card as every other item — bold
          title, one-line description — with the control where the chevron would be
          (founder, 2026-09-11). Marketing emails (§K, 2026-09-04) is the withdrawal half of
          the optional marketing consent — UNGATED on purpose (shown on trial and to a lapsed
          teacher, unlike Personal profile, because a right to withdraw that depends on
          subscription state is not a right), rendered only once the answer is KNOWN (an
          unchecked box drawn mid-fetch is a screen inventing an answer about her record —
          the Support `metaErr` rule), and saved ON TAP. The description now says what the
          ⓘ used to; the transient save note keeps its place below. */}
      {/* Appearance is a PHONE setting (dark theme exists only ≤600px; ThemeToggle hides
          itself at ≥601px), so the whole card hides with it — a card with no control is
          a question with no answer. */}
      <div className="set-bigcard set-bigcard-static set-appearance">
        <span className="set-bigtext"><span className="set-biglab">Appearance</span>
          <span className="set-bigsub">Light or dark, or follow your phone</span></span>
        <ThemeToggle />
      </div>
      {marketing !== null && (
      <div className="set-bigcard set-bigcard-static">
        <span className="set-bigtext"><span className="set-biglab">Marketing emails</span>
          <span className="set-bigsub">Occasional news on new subjects, features and teaching ideas —
            receipts, replies and agreement notices are sent either way</span></span>
        <label className="set-switch">
          <input type="checkbox" checked={marketing} disabled={mktBusy}
            onChange={(e) => saveMarketing(e.target.checked)}
            aria-label="Send me occasional emails about new subjects and features" />
        </label>
      </div>
      )}
      {mktNote && <p className="set-hint">{mktNote}</p>}

      {/* Legal — its own card, per the agreement's own placement promise (see the
          `legal` view above). Shown on trial too. */}
      <button className="set-bigcard" onClick={() => setView("legal")}>
        <span className="set-bigtext"><span className="set-biglab">Legal</span>
          <span className="set-bigsub">User agreement &amp; privacy notice</span></span>
        <span className="set-chev">›</span>
      </button>
      <button className="set-bigcard" onClick={() => setView("about")}>
        <span className="set-bigtext"><span className="set-biglab">About Meyy</span>
          <span className="set-bigsub">Version info</span></span>
        <span className="set-chev">›</span>
      </button>

      {/* Account: her data, her session, her account — the three rows that are about the
          ACCOUNT rather than the teaching (founder, 2026-09-11: "data & export can go to
          account"). Export is hidden on trial (see `onTrial` above); the delete flow keeps
          its own download regardless. */}
      <div className="set-group">
        <div className="set-cap">Account</div>
        <div className="set-card">
          {!onTrial && (
          <button className="set-row" onClick={() => setView("data")}>
            <span className="set-lab">Your data &amp; export</span>
            <span className="set-chev">›</span>
          </button>
          )}
          <button className="set-row" onClick={() => onSignOut && onSignOut()}>
            <span className="set-lab">Log out</span>
          </button>
          <button className="set-row set-row-danger" onClick={() => setConfirmOpen(true)}>
            <span className="set-lab">Delete my account…</span>
            <span className="set-chev">›</span>
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div className="acct-del">
          <p className="acct-del-warn">
            This permanently deletes your account and all your data — it cannot be
            recovered afterwards. Type <b>erase</b> to continue; we&rsquo;ll ask you to
            confirm you have your data before anything is deleted.
          </p>
          <div className="acct-del-row">
            <input className="acct-del-input" value={confirmText} autoFocus
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "erase"' />
            <button className="acct-del-go"
              disabled={busy === "erase" || confirmText.trim().toLowerCase() !== "erase"}
              onClick={erase}>
              Continue →
            </button>
            <button className="acct-del-cancel"
              onClick={() => { setConfirmOpen(false); setConfirmText(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ★ THE LAST WINDOW (founder, 2026-08-26). Typing "erase" states intent; this
          states that she HAS HER DATA. Deletion is irreversible and the export is the
          only copy she can keep, so the download stops being a suggestion and becomes a
          question she must answer. Her answer is recorded server-side, tenant/user wise,
          in a log that survives the erasure — until now nothing evidenced that she ever
          confirmed. Deliberately a separate window, not a checkbox beside the input: the
          two confirmations mean different things and should not be given in one glance. */}
      {finalOpen && (
        <div className="acct-final-bg" onClick={() => setFinalOpen(false)}>
          <div className="acct-final" onClick={(e) => e.stopPropagation()}>
            <div className="kicker kicker-soft">Last step</div>
            <h2 className="acct-final-t">Have you downloaded your Meyy data?</h2>
            <p className="acct-final-p">
              Everything — your lesson plans, your teaching profile, your chapter notes and
              your progress — is deleted permanently and cannot be recovered. The download
              is the only copy you can keep.
            </p>
            {/* Invoices are the one thing deletion does NOT destroy — they are tax
                records with a statutory retention (the erasure receipt says so). But
                she loses the ACCOUNT that reaches them, so the honest thing is to tell
                her to save them now (2026-08-26). */}
            <p className="acct-final-p acct-final-inv">
              Your invoices are kept as tax records, but you will no longer be able to
              download them here — save any you need from Subscription &amp; billing first.
            </p>
            {!didDownload && (
              <button className="acct-final-dl" disabled={!!busy}
                onClick={() => download("docx")}>
                {busy === "docx" ? "Preparing…" : "Download my data first (Word)"}
              </button>
            )}
            <label className="acct-final-check">
              <input type="checkbox" checked={downloadConfirmed}
                onChange={(e) => setDownloadConfirmed(e.target.checked)} />
              <span>I confirm I have downloaded my Meyy data.</span>
            </label>
            <p className="acct-final-note">
              Your confirmation will be recorded against your account.
            </p>
            <div className="acct-final-row">
              <button className="acct-del-go"
                disabled={!downloadConfirmed || busy === "erase"}
                onClick={erase}>
                {busy === "erase" ? "Deleting…" : "Delete forever"}
              </button>
              <button className="acct-del-cancel"
                onClick={() => { setFinalOpen(false); setDownloadConfirmed(false); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {failMsg && <p className="acct-fail" role="alert">{failMsg}</p>}
    </div>
  );
}
