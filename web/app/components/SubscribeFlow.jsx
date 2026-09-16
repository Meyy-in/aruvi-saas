"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { authHeaders } from "../lib/auth";
import { API, getJSON, pretty, stageOfGrade, idInUse, errDetail } from "../lib/format";
import Agreement from "./Agreement";
import Dropdown from "./Dropdown";
import MeyyMark from "./MeyyMark";
import { dateWords as consentDateWords } from "../lib/legalmd";

/* ★ THE TWO "already in use" SENTENCES MOVED to @aruvi/shared/format (2026-09-16), so the phone stops re-declaring
 * the mobile one in its own words (Q21b). The reasoning travelled with them; this re-export keeps
 * every existing import in this repo working. */
/* ⚠️ Imported AND re-exported: `export … from` alone serves importers without binding the names
 * in this module's own scope, and the email path below calls EMAIL_TAKEN (the PPW_CHOICES /
 * setupKey lesson, third sighting). */
import { EMAIL_TAKEN, MOBILE_TAKEN } from "../lib/format";
export { EMAIL_TAKEN, MOBILE_TAKEN };

/* ── The subscribe wizard: About you → Agreement → Subjects & stages → Pay ──
 *
 * ★ THE AGREEMENT STEP (founder, 2026-08-27) sits BEFORE the subject/stage cart, not
 * before Pay. The five acknowledgements say what Aruvi IS — a teaching aid, not
 * endorsed by any board, no student data, AI-assisted, personally licensed — and she
 * should have those five facts before she picks what to buy. Placed after the cart it
 * would arrive as an obstacle between her and a purchase she had already assembled.
 * Component: Agreement.jsx (shared with Settings › Legal). Re-consent is per DOCUMENT
 * VERSION, resolved server-side, so a subscriber adding a subject walks straight past.
 *
 * ONE implementation, two doors (founder, 2026-08-25):
 *   · the FRONT DOOR — Login's subscribe path, entered after OTP verification;
 *   · IN-APP — the trial-exhausted paywall's Subscribe button, for a teacher who is
 *     already signed in (her mobile already verified), landing at About you with the
 *     rail showing Verify done.
 *
 * Props: userId (the mobile/id the checkout runs as — the X-Aruvi-User header),
 * chrome (optional bar element rendered on top; Login passes its Bar, the in-app
 * overlay passes none), onDone(userId) after activation, onCancel for backing out of
 * the first step, onTrial (see below). Pay is the HONEST STUB (no fake gateway;
 * activates instantly via the server's dev checkout and says so).
 *
 * ★ THE TRIAL OFFER — FRONT DOOR ONLY (founder, 2026-08-27). A teacher who chose
 * Subscribe on the very first screen has committed to money before she has seen a
 * single lesson, so the wizard raises a Trial / Subscribe choice. Subscribe walks on
 * exactly as before. Trial calls `onTrial()` — Login signs her straight in, the same
 * path its own Free-to-try card takes. The offer exists ONLY when the caller passes
 * `onTrial`: the IN-APP door (paywall / Settings) belongs to a teacher whose trial has
 * ended or lapsed, and offering her a trial there would be an offer Aruvi cannot
 * honour. Do not make this unconditional.
 *
 * ★ MOVED TO THE VERY FRONT — after Verify, BEFORE About-you (founder, 2026-08-27).
 * It first fired on the CART's Continue, then before the Agreement; both were too late
 * for the same reason, and the second move made the reason plain. A teacher who takes
 * the trial and decides Aruvi is not for her should not have typed her name, email,
 * role, state and school first — that is a profile built for a purchase that never
 * happens. Everything the wizard collects is only needed by someone who is buying, so
 * the fork belongs before the first field. The trial is an OFFER, never a gate: she may
 * decline it and subscribe straight away, which is why this is a modal with two live
 * choices and not a step in the rail. It fires on MOUNT, once per session
 * (`offeredRef`), and the modal renders on every screen it can still be open over. */

export const ROLES = ["Teacher", "Academic coordinator", "Head of school", "Other"];
export const STATES = ["Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu",
  "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other"];
const STAGE_OF = stageOfGrade;   // lib/format is the web's ONE copy of the mapping
/* Secondary says Class 9 only for now — the Class 10 books are not out yet
 * (founder, 2026-08-25). */
const STAGE_CLASSES = { preparatory: "Class 3, 4 & 5", middle: "Class 6, 7 & 8",
                        secondary: "Class 9 (Class 10 coming soon)" };
const scopeLabel = (scope) => {
  const [s, st] = String(scope).split("/");
  return `${pretty(s)} · ${pretty(st)}`;
};
const EMAIL_OK = (e) => /^\S+@\S+\.\S+$/.test((e || "").trim());
const maskEmail = (e) => {
  const [u, d] = String(e).split("@");
  if (!d) return "•••";
  return `${u.slice(0, 1)}•••@${d}`;
};

const Steps = ({ at }) => {
  /* Five, since 2026-08-27 — Agreement sits between About you and Subjects. It is a
     STEP, not a modal or a footnote: she is meant to see it coming, and to see that it
     is behind her. */
  const names = ["Verify", "About you", "Agreement", "Subjects", "Pay"];
  return (
    <div className="ob-steps">
      {names.map((n, i) => (
        <span key={n} className={`ob-step ${i === at ? "on" : ""} ${i < at ? "done" : ""}`}>
          <span className="ob-step-n">{i + 1}</span>
          <span className="ob-step-l">{n}</span>
        </span>
      ))}
    </div>
  );
};

/* The ONE bar (same chrome the shell/first-run/front-door wear) — the wizard's default
 * when the caller passes none, so the in-app paywall path is never bare-headed
 * (founder, 2026-08-25). */
const DefaultBar = () => (
  <div className="fr-brand ob-bar">
    <header className="hdr">
      <div className="brand">
        <MeyyMark />
        <span className="hdr-brand-tag">lesson studio</span>
      </div>
    </header>
  </div>
);

export default function SubscribeFlow({ userId, chrome = <DefaultBar />, onDone, onCancel,
                                        onTrial = null }) {
  const [screen, setScreen] = useState("about");    // about | agreement | cart | pay
  const [offerTrial, setOfferTrial] = useState(false);  // the front-door Trial/Subscribe ask
  const offeredRef = useRef(false);                     // …asked once per session, not per screen
  const [name, setName] = useState("");
  /* Email — DOUBLE-BLIND confirmation (founder, 2026-08-25): she types it once; it is
     then HIDDEN (masked) and she types it again fresh. Only a match confirms — a typo
     can't be rubber-stamped by reading the first entry back. Stages:
     enter → confirm → ok. "Change" restarts.

     ★ A MISMATCH RETURNS TO `enter`, NOT TO A CLEARED `confirm` (founder, 2026-08-27).
     It used to blank the second field and hold her in confirm, which silently assumed
     the FIRST entry was the right one — but a mismatch says only that the two disagree,
     and the typo is at least as likely to be in the first. Held in confirm she could
     retype the second entry forever against a wrong original she could not see or
     reach. So the disagreement sends her back to the first field with her text intact
     and visible, which is the only place the real address can be established. The
     double blind is not weakened: she still typed it twice unseen to get here, and
     confirming again still requires a fresh matching pass. */
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [emailStage, setEmailStage] = useState("enter");   // enter | confirm | ok
  /* Focused when a mismatch or a taken address sends her BACK to the first field. Not an
     autoFocus, which would steal the caret from Name on the step's first paint. */
  const emailRef = useRef(null);
  const schoolRef = useRef(null);   // scrolled into view when she leaves City
  const [emailErr, setEmailErr] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);   // the "already in use" round-trip
  const [role, setRole] = useState("");
  const [stateName, setStateName] = useState("");
  const [city, setCity] = useState("");
  const [school, setSchool] = useState("");
  const [stageMap, setStageMap] = useState(null);
  const [owned, setOwned] = useState([]);            // live scopes — not for sale again
  const [skippedAbout, setSkippedAbout] = useState(false);  // her details were already on file
  const [trialChapters, setTrialChapters] = useState([]);   // for the purge notice on Pay
  const [rows, setRows] = useState([{ subject: "", stage: "" }]);
  const [price, setPrice] = useState(500);
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState("");
  /* ★ THE AGREEMENT STEP (founder, 2026-08-27). null until the status lands, then
     {accepted, current_version, accepted_at, ...}. Asked on MOUNT — while she is still
     typing her name — so the answer is ready by the time she presses Continue and the
     step either appears or doesn't, with no pause to think about it. Re-consent is per
     VERSION: a subscriber adding a subject walks past this; the same teacher after a new
     version is published takes all six ticks again. The server owns that rule
     (_consent_outstanding) — this only reads its answer. */
  const [consent, setConsent] = useState(null);

  /* A KNOWN personal profile skips About-you (founder, 2026-08-26): a lapsed teacher
     re-subscribing already gave her name/email/role/state at first checkout — asking
     again is friction with no purpose. Prefill ALWAYS (checkout overwrites account
     fields, so resending her existing values is what preserves them); jump straight to
     the SUBJECTS step when the essentials are complete. A fresh post-OTP account has
     empty fields → About-you shows as normal. */
  useEffect(() => {
    let live = true;
    fetch(`${API}/account`, { headers: authHeaders(userId) })
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (!live || !a) return;
        const nm = (a.display_name || "").trim();
        const looksReal = nm && !/^\d+$/.test(nm);           // a number is not a name
        if (looksReal) setName(nm);
        if (a.email) { setEmail(a.email); setEmailStage("ok"); }
        if (a.role) setRole(a.role);
        if (a.state) setStateName(a.state);
        if (a.city) setCity(a.city);
        if (a.school_name) setSchool(a.school_name);
        if (looksReal && a.email && a.role && a.state) {
          /* Skips About-you, NOT the agreement: the landing is the Agreement step, which
             forwards itself to the cart when the current version is already accepted
             (see the effect below). One door, one rule. */
          setScreen("agreement");
          /* ★ Remember that About-you was SKIPPED (founder, 2026-08-26). The cart's
             Back used to walk to the previous STEP unconditionally, so a subscriber
             adding a subject was taken into a personal-details form she had never been
             shown — from Settings, that reads as "Back took me to Personal profile".
             Back should undo what she did, and what she did was open the chooser. */
          setSkippedAbout(true);
        }
      })
      .catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* Ask once, on mount. A failure leaves `consent` at a NOT-accepted shape rather than
     null: if we cannot tell whether she has signed, the honest move is to show her the
     agreement, not to wave her through to a checkout the server will refuse anyway. */
  useEffect(() => {
    let live = true;
    /* Explicit header, not getJSON: on the FRONT DOOR localStorage is still empty (Login
       calls setUser only after checkout), so the ambient identity is not hers. Same
       reason the /account fetch above does it, and the same reason Agreement takes a
       userId prop — a signature filed against the wrong tenant is worse than no answer. */
    fetch(`${API}/legal/consent/status`, { headers: authHeaders(userId) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setConsent(d || { accepted: false }); })
      .catch(() => { if (live) setConsent({ accepted: false }); });
    return () => { live = false; };
  }, [userId]);

  /* The Agreement step forwards itself when there is nothing to sign. Written as an
     effect rather than a branch at every entrance because there are two entrances (the
     About-you Continue and the known-profile skip) and a third would forget. */
  useEffect(() => {
    if (screen === "agreement" && consent && consent.accepted) setScreen("cart");
  }, [screen, consent]);

  /* ★ The trial offer, on MOUNT — after Verify, before About-you (see the header note).
     No screen test: the wizard's first screen is About-you, so the offer must be the
     thing standing in front of it, and firing on mount also covers the known-profile
     skip without naming a second entrance. `offeredRef` makes it once per session. */
  useEffect(() => {
    if (!onTrial || offeredRef.current) return;
    offeredRef.current = true;
    setOfferTrial(true);
  }, [onTrial]);

  useEffect(() => {
    if (screen !== "cart" || stageMap) return;
    getJSON("/entitlement").then((d) => {
      if (d && d.price_per_subject_stage) setPrice(d.price_per_subject_stage);
      /* ★ What she ALREADY holds, live, is not for sale again (founder, 2026-08-26).
         `live_scopes` is the server's own answer — the client never compares dates. A
         trial's "*" is not a holding: it would swallow the entire catalogue. */
      const live = (d && Array.isArray(d.live_scopes)) ? d.live_scopes : [];
      setOwned(d && d.status === "trial" ? [] : live.filter((s) => s !== "*"));
      // Only a teacher still ON the trial has trial artifacts left to lose.
      setTrialChapters(d && d.status === "trial" ? (d.trial_chapters || []) : []);
    }).catch(() => {});
    getJSON("/subjects").then(async (d) => {
      const map = {};
      for (const s of d.subjects || []) {
        try {
          const g = await getJSON(`/subjects/${s}/grades`);
          const stages = Array.from(new Set((g.grades || []).map(STAGE_OF)));
          map[s] = ["preparatory", "middle", "secondary"].filter((st) => stages.includes(st));
        } catch {}
      }
      setStageMap(map);
    }).catch(() => setStageMap({}));
  }, [screen, stageMap]);

  const cartScopes = useMemo(() => Array.from(new Set(
    rows.filter((r) => r.subject && r.stage).map((r) => `${r.subject}/${r.stage}`))),
    [rows]);

  const doCheckout = async () => {
    setPayBusy(true); setPayErr("");
    try {
      const r = await fetch(`${API}/onboarding/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(userId) },
        body: JSON.stringify({ scopes: cartScopes, name, email: email.trim(),
                               role, state: stateName, city, school }),
      });
      /* ★ THE SERVER'S OWN SENTENCE (2026-08-26). This used to throw the status code
         away and print "Try again in a moment" — advice that can never work for a
         deterministic 409 (a taken email), and which hid a CORRECT refusal well enough
         to read as a broken product. Same lesson as ARV-D-088, same rule: 4xx strings
         are written for her, 5xx are engine talk and keep the generic line. The
         Verify-step check above should have caught the clash already; this is the net
         for the address taken in between, or reached by a path that skipped it. */
      if (!r.ok) {
        const detail = await errDetail(r,
          "Couldn't complete the activation. Try again in a moment.");
        /* ★ A consent refusal has a PLACE to send her, so send her there (2026-08-27).
           The server refuses a checkout without a current-version acceptance — which
           realistically means a new version was published between her reading one and
           paying — and an error message on the Pay screen would leave her with advice
           she cannot act on from where she is standing. Same lesson as the taken-email
           409: a deterministic refusal must be shown at the step that can fix it. */
        if (r.status === 409 && /User Agreement/i.test(detail)) {
          setConsent((c) => ({ ...(c || {}), accepted: false }));
          setPayBusy(false);
          setScreen("agreement");
          return;
        }
        setPayErr(detail);
        setPayBusy(false);
        return;
      }
      onDone && onDone(userId);
    } catch {
      setPayErr("Couldn't complete the activation. Try again in a moment.");
      setPayBusy(false);
    }
  };

  /* ── The email confirmation, in one place (founder, 2026-08-27) ──
     Called two ways, and the difference is the whole design:

       · AUTOMATICALLY, the moment the re-typed address MATCHES. A second entry that
         agrees with the first has nothing left to ask her — making her press Verify
         after that is a keystroke that can only produce the answer she already gave.
       · BY THE BUTTON, which now exists for exactly one case: a completed second entry
         that does NOT match. Nothing may fire on a mismatch while she is still typing,
         because every address is a mismatch until its last character — telling her so
         mid-word would be wrong on every keystroke but the final one. So the button is
         how she says "this IS what I meant", and only then does the mismatch surface. */
  const verifyEmail = async () => {
    if (emailBusy) return;
    if (email2.trim().toLowerCase() !== email.trim().toLowerCase()) {
      /* Back to ENTER — the same move the taken-address branch makes, for the same
         reason: put her in the field where the fix can be. */
      setEmailErr("The two entries didn't match. This is what you typed first — "
                  + "correct it if it's wrong, then confirm again.");
      setEmail2(""); setEmailStage("enter");
      setTimeout(() => emailRef.current && emailRef.current.focus(), 0);
      return;
    }
    setEmailBusy(true);
    const taken = await idInUse(email, userId);
    setEmailBusy(false);
    if (taken) {
      // Back to ENTER with her text intact: the fix is to edit this field.
      setEmailErr(EMAIL_TAKEN); setEmail2(""); setEmailStage("enter");
      setTimeout(() => emailRef.current && emailRef.current.focus(), 0);
      return;
    }
    setEmailStage("ok"); setEmailErr("");
  };

  /* Auto-verify on match. Deliberately NOT in the input's onChange: a paste, an
     autofill or a browser restore can set the field without one, and the match is a
     fact about the VALUE, not about how it arrived. */
  useEffect(() => {
    if (emailStage !== "confirm" || emailBusy) return;
    if (!EMAIL_OK(email2)) return;
    if (email2.trim().toLowerCase() !== email.trim().toLowerCase()) return;
    verifyEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email2, email, emailStage]);

  /* The trial offer, defined once and rendered by every screen it can still be open
     over. It is declared HERE, above the first screen branch, because it now fires on
     mount and About-you is what it opens in front of. Dismissing it with "Subscribe"
     simply closes it — she is already where she was going, and the wizard's first field
     is the next thing in front of her. */
  const trialModal = offerTrial ? (
    <div className="modal-backdrop ob-offer-back" role="dialog" aria-modal="true"
      aria-labelledby="ob-offer-t">
      <div className="modal-box ob-offer-box">
        <h2 className="ob-offer-title" id="ob-offer-t">Would you like to try Meyy free first?</h2>
        <p className="ob-offer-body">
          The free trial gives you any 3 chapters, unlimited lesson plans in each, and
          every feature you need to plan and assess — at no cost, with no time limit.
          You can subscribe whenever you&rsquo;re ready.
        </p>
        {/* Said here because this is now the FIRST screen of the wizard: choosing Trial
            costs her nothing she has already done. */}
        <p className="ob-offer-note">
          Nothing to fill in — the trial starts straight away. Subscribing asks for your
          details first.
        </p>
        <div className="ob-offer-actions">
          <button className="primary" onClick={() => { setOfferTrial(false); onTrial(); }}>
            Trial
          </button>
          <button className="ob-offer-alt" onClick={() => setOfferTrial(false)}>
            Subscribe
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (screen === "about") {
    return (
      <div className="ob-wrap">
        {chrome}
        {trialModal}
        <div className="ob-body">
          <Steps at={1} />
          <h1 className="ob-title">Tell us a bit about yourself</h1>
          <p className="ob-sub">For your receipt and your account — nothing more.</p>
          <label className="login-field ob-field"><span>Your name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" /></label>

          {/* Email — double-blind confirm (see the state note above). */}
          {emailStage === "enter" && (
            <>
              <label className="login-field ob-field"><span>Email</span>
                <input type="email" inputMode="email" autoComplete="off" value={email}
                  ref={emailRef}
                  onChange={(e) => { setEmail(e.target.value); setEmailErr(""); }}
                  placeholder="Enter your email" /></label>
              {/* The taken-address message lands HERE — the stage the fix belongs to. */}
              {emailErr && <p className="ob-err" role="alert">{emailErr}</p>}
              {EMAIL_OK(email) && (
                <button type="button" className="fr-link ob-email-next"
                  onClick={() => { setEmail2(""); setEmailStage("confirm"); }}>
                  Confirm this email →
                </button>
              )}
            </>
          )}
          {emailStage === "confirm" && (
            <>
              <label className="login-field ob-field"><span>Re-enter your email</span>
                <input type="email" inputMode="email" autoComplete="off" autoFocus value={email2}
                  onChange={(e) => { setEmail2(e.target.value); setEmailErr(""); }}
                  placeholder="Type it again to confirm" /></label>
              {emailErr && <p className="ob-err" role="alert">{emailErr}</p>}
              {/* ★ The "already in use" check happens inside verifyEmail, HERE rather
                  than at Pay (2026-08-26). The server's 409 was always right; arriving
                  at the END of a checkout is what made it useless — she had chosen
                  subjects and pressed Pay before anything told her, and the only advice
                  on screen was "try again", which for a deterministic clash can never
                  work. One tap from the field she would have to change anyway.
                  A MATCHING entry never reaches this button — the effect above has
                  already run — so it is only ever pressed to commit a mismatch, and it
                  says so. `emailBusy` keeps it visible during the auto-verify's own
                  round trip, which is the one moment it doubles as a progress note. */}
              <button type="button" className="fr-link ob-email-next"
                disabled={!EMAIL_OK(email2) || emailBusy}
                onClick={verifyEmail}>
                {emailBusy ? "Checking…" : "Verify →"}
              </button>
            </>
          )}
          {emailStage === "ok" && (
            <label className="login-field ob-field"><span>Email</span>
              <div className="ob-email-view">
                <span><span className="ob-tick">✓</span> {maskEmail(email)}</span>
                <button type="button" className="fr-link"
                  onClick={() => { setEmail(""); setEmail2(""); setEmailStage("enter"); }}>
                  change
                </button>
              </div>
            </label>
          )}

          <label className="login-field ob-field"><span>Role</span>
            <Dropdown value={role} onChange={setRole} options={ROLES}
              placeholder="Select your role" ariaLabel="Role" /></label>
          <label className="login-field ob-field"><span>State</span>
            <Dropdown value={stateName} onChange={setStateName} options={STATES}
              placeholder="Select your state" ariaLabel="State" /></label>
          <label className="login-field ob-field"><span>City</span>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
              /* Leaving City brings the LAST field into view. The sticky footer no longer
                 covers it (see .ob-body's bottom padding), but it is still the field
                 furthest down a step she has been filling top-to-bottom, and an optional
                 field nobody scrolls to is an optional field nobody answers.
                 `relatedTarget` guards the one case that must not scroll: tapping Save,
                 where moving the page under her thumb would fight the press. */
              onBlur={(e) => {
                const to = e.relatedTarget;
                if (to && to.closest && to.closest(".ob-foot")) return;
                if (!city.trim()) return;
                schoolRef.current && schoolRef.current.scrollIntoView(
                  { behavior: "smooth", block: "center" });
              }}
              placeholder="Enter your city" /></label>
          <label className="login-field ob-field" ref={schoolRef}><span>School name (optional)</span>
            <input type="text" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Enter your school name" /></label>
        </div>
        <div className="ob-foot">
          <button className="primary fr-cta"
            disabled={!name.trim() || emailStage !== "ok" || !role || !stateName}
            onClick={() => setScreen("agreement")}>Save &amp; continue →</button>
          <button className="fr-link" onClick={() => onCancel && onCancel()}>← Back</button>
        </div>
      </div>
    );
  }

  /* ── Agreement — the step between About you and Subjects (founder, 2026-08-27) ──
     Deliberately BEFORE the cart: the five points say what Aruvi is, and she should know
     them before she picks what to buy, not after she has built a cart and is one tap
     from paying. The document, the ticks and the recording all live in Agreement.jsx;
     the wizard only says where the step sits and where it goes next. */
  if (screen === "agreement") {
    /* Nothing is drawn until we know whether there IS anything to sign — see the
       forwarding effect. Showing five checkboxes and then yanking them away half a
       second later is worse than half a second of nothing. */
    if (!consent) {
      return (
        <div className="ob-wrap">
          {chrome}
          <div className="ob-body"><Steps at={2} /><div className="fr-loading">Loading…</div></div>
        </div>
      );
    }
    /* `ob-wrap-lock`/`ob-body-lock`: this ONE step is a fixed-height frame rather than a
       page that grows (founder, 2026-08-27). The agreement's heading and its accept bar
       are pinned and the document scrolls between them, which only works if the shell
       above it stops growing — hence the locked wrap here rather than in Agreement.jsx,
       which cannot reach its own container. */
    return (
      <div className="ob-wrap ob-wrap-lock">
        {chrome}
        <div className="ob-body ob-body-lock">
          <Steps at={2} />
          <Agreement
            mode="sign"
            userId={userId}
            context="subscription_checkout"
            onAccepted={() => {
              setConsent((c) => ({ ...(c || {}), accepted: true,
                                   accepted_at: new Date().toISOString(),
                                   accepted_version: (c && c.current_version) || "" }));
              setScreen("cart");
            }}
            /* Back leaves the wizard when About-you was never shown — the same rule the
               cart's Back follows, for the same reason. */
            onBack={() => (skippedAbout ? (onCancel && onCancel()) : setScreen("about"))}
          />
        </div>
        {trialModal}
      </div>
    );
  }

  if (screen === "cart") {
    const total = cartScopes.length * price;
    const subjectsAvail = stageMap ? Object.keys(stageMap) : [];
    const setRow = (i, patch) => setRows((rs) =>
      rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const dropRow = (i) => setRows((rs) =>
      rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ subject: "", stage: "" }]);
    /* ★ A PAIR MAY BE BOUGHT ONCE (founder, 2026-08-26). The billing unit is
       subject × stage, so a second row of the same pair is meaningless in both
       directions: `cartScopes` de-dupes, so she would see two rows and be charged for
       one — a discrepancy that reads as a bug whichever way she notices it. Rather than
       validate after the fact, the choice is simply not offered: a pair taken by ANOTHER
       row is disabled and says why, and a subject whose every stage is spoken for is
       disabled whole. Never disable this row's OWN value (hence `j !== self`), or
       changing your mind would strand the select on a dead option. */
    /* Taken = in another row of THIS cart, or already held and still running. The two
       are one question to her ("can I pick this?") and so they are one predicate; only
       the wording differs, because "already added" and "you have this" are different
       facts and telling her the wrong one would be worse than saying nothing. */
    const takenElsewhere = (subject, stage, self) => rows.some(
      (r, j) => j !== self && r.subject === subject && r.stage === stage)
      || owned.includes(`${subject}/${stage}`);
    const alreadyOwned = (subject, stage) => owned.includes(`${subject}/${stage}`);
    const subjectFull = (subject, self) => {
      const stages = stageMap[subject] || [];
      return stages.length > 0 && stages.every((st) => takenElsewhere(subject, st, self));
    };
    const nothingLeft = subjectsAvail.length > 0
      && subjectsAvail.every((s) => subjectFull(s, -1));
    return (
      <div className="ob-wrap">
        {chrome}
        <div className="ob-body">
          <Steps at={3} />
          <h1 className="ob-title">What do you teach?</h1>
          <p className="ob-sub">Each subject &amp; stage is its own subscription — unlimited
            lesson plans across all its classes. The total updates as you add.</p>
          {!stageMap && <div className="fr-loading">Loading subjects…</div>}
          {stageMap && rows.map((r, i) => (
            <div className="ob-row" key={i}>
              {/* No per-row price (founder, 2026-08-25) — the total below carries the
                  money; the row is all Subject + Stage. Placeholder words bold. */}
              <div className="ob-row-selects">
                {/* Aruvi dropdowns, not <select>s (2026-08-27) — the open list of a
                    native select is drawn by macOS and comes up black over the cream
                    page whatever CSS says. See Dropdown.jsx. `unsetClass="ob-ph"`
                    keeps the bold placeholder words these two rows always had. */}
                <Dropdown value={r.subject} placeholder="Subject" ariaLabel="Subject"
                  className="ob-rowdd" unsetClass="ob-ph"
                  onChange={(v) => setRow(i, { subject: v, stage: "" })}
                  options={subjectsAvail.map((s) => {
                    const full = subjectFull(s, i);
                    return { value: s, disabled: full,
                             label: pretty(s) + (full ? " — all stages added" : "") };
                  })} />
                <Dropdown value={r.stage} disabled={!r.subject} placeholder="Stage"
                  ariaLabel="Stage" className="ob-rowdd" unsetClass="ob-ph"
                  onChange={(v) => setRow(i, { stage: v })}
                  options={(stageMap[r.subject] || []).map((st) => {
                    const dup = takenElsewhere(r.subject, st, i);
                    const mine = alreadyOwned(r.subject, st);
                    return { value: st, disabled: dup,
                             label: pretty(st) + (mine ? " · you have this"
                                                       : dup ? " · already added" : "") };
                  })} />
                <button type="button" className="ob-row-x" aria-label="Remove this row"
                  onClick={() => dropRow(i)}>✕</button>
              </div>
              {r.stage && <p className="ob-row-classes">{STAGE_CLASSES[r.stage]}</p>}
            </div>
          ))}
          {stageMap && (
            // Nothing left to add = no empty row to add it in.
            <button type="button" className="ob-addrow" disabled={nothingLeft}
              onClick={() => setRows((rs) => [...rs, { subject: "", stage: "" }])}>
              + Add another subject &amp; stage
            </button>
          )}
          <div className="ob-total"><span>Total</span><b>₹{total} / year</b></div>
          {/* Said once, quietly, where it is true: she is past the agreement. It also
              tells the returning subscriber — who never saw the step — WHY she didn't,
              and where to go if she wants to read it again. */}
          {consent && consent.accepted && (
            <p className="ob-quiet ob-consent-note">
              <span className="ob-tick">✓</span> User Agreement v
              {consent.accepted_version || consent.current_version} accepted
              {consent.accepted_at ? ` on ${consentDateWords(consent.accepted_at)}` : ""} ·
              always readable under Settings &rsaquo; Legal.
            </p>
          )}
        </div>
        <div className="ob-foot">
          {/* Plain Continue on both doors: the trial offer now stands BEFORE the
              agreement, not here (see the header note). */}
          <button className="primary fr-cta" disabled={!cartScopes.length}
            onClick={() => setScreen("pay")}>Continue →</button>
          {/* Back leaves the wizard when About-you was never shown (see setSkippedAbout);
              otherwise it returns to the step she actually came from. */}
          <button className="fr-link"
            onClick={() => (skippedAbout ? (onCancel && onCancel()) : setScreen("about"))}>
            ← Back
          </button>
        </div>

        {trialModal}
      </div>
    );
  }

  /* pay */
  const total = cartScopes.length * price;
  /* Subjects she TRIALLED but is not buying — their lessons go when this activates.
     Derived from the trial chapter keys ("{subject}/{grade}/{chapter}"), which
     GET /entitlement already returns; nothing new is fetched to ask this. */
  const buying = new Set(cartScopes.map((s) => s.split("/")[0]));
  const droppedTrial = Array.from(new Set(
    (trialChapters || []).map((k) => String(k).split("/")[0]).filter((s) => s && !buying.has(s))));
  return (
    <div className="ob-wrap">
      {chrome}
      <div className="ob-body">
        <Steps at={4} />
        <h1 className="ob-title">Review &amp; pay</h1>
        {cartScopes.map((cid) => (
          <div className="ob-payrow" key={cid}><span>{scopeLabel(cid)}</span><span>₹{price}</span></div>
        ))}
        <div className="ob-total"><span>Total</span><b>₹{total} / year</b></div>
        {/* ★ SAID BEFORE SHE PAYS (founder, 2026-08-26 evening). Subscribing clears
            what the trial left in subjects she is NOT buying. That is her work
            disappearing, so it is stated on the screen with the money on it — the one
            place she can still change the cart — and not discovered afterwards in an
            emptier My Lessons. Named, because "some trial lessons" would send her
            hunting for which. */}
        {droppedTrial.length > 0 && (
          <p className="ob-quiet ob-purge-note">
            Your trial lessons in {droppedTrial.map(pretty).join(" and ")} will be cleared
            when this activates — {droppedTrial.length > 1 ? "those subjects are" : "that subject is"} not
            in your subscription. Everything in what you are subscribing to stays.
          </p>
        )}
        <p className="ob-quiet">Preview build: online payment opens soon — this activates your
          subscription right away.</p>
        {payErr && <p className="ob-err" role="alert">{payErr}</p>}
      </div>
      <div className="ob-foot">
        <button className="primary fr-cta" disabled={payBusy} onClick={doCheckout}>
          {payBusy ? "Activating…" : `Pay ₹${total} & start →`}
        </button>
        <button className="fr-link" onClick={() => setScreen("cart")}>← Back</button>
      </div>
    </div>
  );
}
