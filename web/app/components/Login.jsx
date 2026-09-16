"use client";
import { useEffect, useRef, useState } from "react";
import { API, getJSON, idInUse } from "../lib/format";
import { authEnabled, sendOtp, verifyOtp as verifyOtpRemote, OTP_LEN, authHeaders } from "../lib/auth";
import SubscribeFlow, { MOBILE_TAKEN } from "./SubscribeFlow";
import MeyyMark from "./MeyyMark";
import PrivacyNotice from "./PrivacyNotice";

/* ───────── The front door — onboarding + sign-in (founder, 2026-08-24/25) ─────────
 *
 * FIRST-TIME device → CHOOSE (benefits + Free-to-try/Subscribe cards, honest bullets)
 * → OTP (mobile IS the identity; four auto-advancing boxes; ★ stub code 0000, labeled)
 * → TRIAL: straight in · SUBSCRIBE: SubscribeFlow (About you → Subjects-cart →
 * ★ Trial-or-Subscribe offer → Pay stub — ONE implementation shared with the in-app
 * paywall's Subscribe button, which passes no `onTrial` and so never sees the offer).
 * OTP verification REGISTERS the number in the tenant database (/onboarding/verified);
 * the SIGN-IN screen (returning device) admits registered identities only
 * (/onboarding/known) and points unknown numbers at Create sign in.
 *
 * ★ TRACK B (2026-09-09): with Supabase configured (lib/auth.js `authEnabled()`), the OTP is
 * REAL — Supabase sends it and checks it, six boxes — and the returning sign-in ALSO verifies
 * by OTP (under the stub it admitted a known number on sight). The id the session runs under
 * comes back from /onboarding/verified (the API derives the mobile from the verified token),
 * not from the box she typed in. Without the env vars the 0000 stub stays, labelled. */

const Benefits = () => (
  <>
    <h1 className="ob-headline">Plan engaging, NCF-aligned lessons in seconds.</h1>
    <p className="ob-benefits">
      <span className="ob-tick">✓</span> Lesson plan in seconds, not hours&ensp;
      <span className="ob-tick">✓</span> NCF / NCERT aligned&ensp;
      <span className="ob-tick">✓</span> Assessment built in&ensp;
      <span className="ob-tick">✓</span> Every section&rsquo;s status at one glance
    </p>
  </>
);

/* The ONE bar — the same chrome the shell and first run wear, un-fixed for these
 * scrolling screens. */
const Bar = () => (
  <div className="fr-brand ob-bar">
    <header className="hdr">
      <div className="brand">
        <MeyyMark />
        <span className="hdr-brand-tag">lesson studio</span>
      </div>
    </header>
  </div>
);

const SEEN_KEY = "aruvi_device_seen";

export default function Login({ onEnter }) {
  const [screen, setScreen] = useState("signin");   // choose | signin | otp | subscribe
  const [mode, setMode] = useState("trial");        // trial | subscribe (the page-1 choice)
  // create = the front-door Create path (number typed here); return = a known number
  // arriving from the sign-in screen, which only needs the OTP.
  const [flow, setFlow] = useState("create");
  const live = authEnabled();
  const otpLen = live ? OTP_LEN : 4;
  // OTP — four boxes, auto-advance (founder, 2026-08-25). `otp` is the joined string.
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  // "Already in use" on the CREATE path, checked before the OTP goes out.
  const [mobErr, setMobErr] = useState("");
  const [mobBusy, setMobBusy] = useState(false);
  const otpRefs = useRef([]);   // one per box; the count follows otpLen
  // Sign-in
  const [id, setId] = useState("");
  const [signinErr, setSigninErr] = useState("");
  const inputRef = useRef(null);
  /* ★ THE NOTICE IS GIVEN WHERE THE NUMBER IS ASKED FOR (2026-09-04). DPDP §5 wants the
     privacy notice at or before first collection, and the mobile — the account's
     identity — is collected on the OTP screen, not at subscription. So that screen and
     the returning sign-in both link to the notice, and it opens as a screen of its own
     with no account yet (GET /legal/privacy needs none). `privacyFrom` is the screen to
     return to; every field she has typed survives, because the screens are state. */
  const [privacyFrom, setPrivacyFrom] = useState("");
  const openPrivacy = () => { setPrivacyFrom(screen); setScreen("privacy"); };

  // First-time device → the choose screen; returning → sign-in.
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) setScreen("choose");
    } catch {}
  }, []);

  // Desktop-only autofocus on the sign-in field (2026-08-08 rule).
  useEffect(() => {
    if (screen !== "signin") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(min-width: 601px)").matches) inputRef.current?.focus();
  }, [screen]);

  const markSeen = () => { try { window.localStorage.setItem(SEEN_KEY, "1"); } catch {} };
  const enter = (theId) => { markSeen(); onEnter && onEnter(theId); };

  const mobileOk = /^\d{10}$/.test(mobile.trim());

  /* One OTP box changed: keep digits only, write it into position i, advance. */
  const setOtpDigit = (i, v) => {
    const digits = v.replace(/\D/g, "");
    // A pasted/autofilled whole code lands in one box: spread it.
    if (digits.length >= otpLen) { setOtp(digits.slice(0, otpLen)); otpRefs.current[otpLen - 1]?.focus(); return; }
    const d = digits.slice(-1);
    setOtp((cur) => {
      const arr = Array.from({ length: otpLen }, (_, k) => cur[k] || "");
      arr[i] = d;
      return arr.join("");
    });
    if (d && i < otpLen - 1) otpRefs.current[i + 1]?.focus();
  };
  const otpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !(otp[i] || "") && i > 0) otpRefs.current[i - 1]?.focus();
  };

  /* Ask for the code (live) or just open the boxes (stub). Returns true when sent. */
  const requestOtp = async (num) => {
    if (!live) return true;
    const err = await sendOtp(num);
    if (err) { setMobErr(err); return false; }
    return true;
  };

  /* OTP verified → the number JOINS THE TENANT DATABASE; then route by mode. Live, the
     verdict is Supabase's and the session id is the API's; the stub keeps its 0000. */
  const verifyOtp = async () => {
    const num = mobile.trim();
    setOtpErr("");
    if (live) {
      setOtpBusy(true);
      const err = await verifyOtpRemote(num, otp);
      if (err) { setOtpBusy(false); setOtpErr(err); return; }
    } else if (otp !== "0000") {
      setOtpErr("That code didn't match. (Preview build: use 0000.)"); return;
    }
    let uid = num;
    try {
      const r = await fetch(`${API}/onboarding/verified`, { method: "POST", headers: authHeaders(num) });
      if (r.ok) { const d = await r.json(); if (d && d.user_id) uid = d.user_id; }
    } catch {}
    setOtpBusy(false);
    if (mode === "subscribe" && flow === "create") { setMobile(uid); setScreen("subscribe"); }
    else enter(uid);
  };

  /* ── SUBSCRIBE — the shared wizard (also reachable in-app from the paywall) ── */
  if (screen === "subscribe") {
    /* ★ `onTrial` is what makes the cart's Trial/Subscribe offer exist (SubscribeFlow's
       header note): she is one screen from paying for a product she has not used yet.
       Trial lands exactly where the Free-to-try card lands — signed in, first run next.
       Her number is already OTP-verified and registered, so nothing further is owed.
       The in-app door (page.jsx) deliberately passes no onTrial. */
    return <SubscribeFlow userId={mobile.trim()} chrome={<Bar />}
      onDone={(uid) => enter(uid)} onCancel={() => setScreen("otp")}
      onTrial={() => enter(mobile.trim())} />;
  }

  /* ── THE PRIVACY NOTICE, before any account exists ── */
  if (screen === "privacy") {
    /* Locked frame (the agreement step's idiom): bar + title pinned, the document
       scrolls between them, Back pinned below. The lock lives here because the notice
       cannot reach its own container. */
    return (
      <div className="ob-wrap ob-wrap-lock">
        <Bar />
        <div className="ob-body ob-body-lock">
          <PrivacyNotice frame onBack={() => setScreen(privacyFrom || "signin")} />
        </div>
      </div>
    );
  }

  /* ── 1 · CHOOSE ── */
  if (screen === "choose") {
    return (
      <div className="ob-wrap">
        <Bar />
        <div className="ob-body">
          <Benefits />
          <h2 className="ob-h2">Choose what works for you</h2>

          <button type="button" className={`ob-plan ${mode === "trial" ? "on" : ""}`}
            onClick={() => setMode("trial")}>
            <span className="ob-plan-hd"><b>Free to try</b></span>
            <span className="ob-plan-sub">Try Meyy with no cost. Perfect to explore and get started.</span>
            <span className="ob-plan-points">Any 3 chapters · unlimited lesson plans per chapter · all core features to plan &amp; assess</span>
          </button>

          <button type="button" className={`ob-plan ob-plan-sub2 ${mode === "subscribe" ? "on" : ""}`}
            onClick={() => setMode("subscribe")}>
            <span className="ob-plan-hd"><b>Subscribe</b></span>
            <span className="ob-plan-sub">Unlimited access to plan across your entire syllabus.</span>
            <span className="ob-plan-points">Unlimited chapters · your full subject &amp; stage, every class in it</span>
          </button>
        </div>
        <div className="ob-foot">
          <button className="primary fr-cta" onClick={() => { setFlow("create"); setOtpSent(false); setOtp(""); setScreen("otp"); }}>
            Create sign in →
          </button>
          <button className="fr-link" onClick={() => setScreen("signin")}>Already have an ID? Sign in</button>
        </div>
      </div>
    );
  }

  /* ── 2 · OTP (both paths) ── */
  if (screen === "otp") {
    return (
      <div className="ob-wrap">
        <Bar />
        <div className="ob-body">
          <h1 className="ob-title">Let&rsquo;s verify your mobile</h1>
          <p className="ob-sub">We&rsquo;ll send you a one-time password (OTP) to sign in securely.</p>
          <label className="login-field ob-field">
            <span>Enter your mobile number</span>
            <div className="ob-mobile-row">
              <span className="ob-cc">+91</span>
              {/* ★ ONCE THE CODE IS IN FLIGHT, THE NUMBER IS FIXED (founder, 2026-09-16, Q21a —
                  the phone had done this since it was built and the divergence was unnamed).
                  The OTP was sent TO this number, so a field she can still edit under the boxes
                  is a field that lies about where the code went — and the verify call would be
                  checking a code against a number that no longer matches what she is reading.
                  "Back" is the way to change it, which re-sends. `flow === "return"` locks it for
                  the other reason: there the number came from her account, not from her. */}
              <input type="tel" inputMode="numeric" maxLength={10} value={mobile}
                readOnly={flow === "return" || otpSent}
                onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "")); setMobErr(""); }}
                placeholder="Enter mobile number" />
            </div>
          </label>
          <p className="ob-quiet">We&rsquo;ll never share your number.</p>
          {/* The notice, at the moment of first collection. A statement, not a tick:
              the mobile is processed to provide the service (DPDP §7(a)), and a consent
              box here would claim a basis the notice does not (see PrivacyNotice.jsx). */}
          <p className="ob-quiet ob-legal">By continuing you confirm you are 18 or older and
            have read Meyy&rsquo;s{" "}
            <button type="button" className="lgl-link" onClick={openPrivacy}>Privacy Notice</button>.</p>

          {mobErr && <p className="ob-err" role="alert">{mobErr}</p>}
          {!otpSent && flow === "create" ? (
            /* ★ A REGISTERED NUMBER CANNOT CREATE A SECOND SIGN-IN (founder, 2026-08-26).
               This screen's button says "Create sign in", and the mobile IS the account
               id — so a number already in the tenant database is not a new teacher, it
               is her, arriving at the wrong door. Told before the OTP is sent, with the
               right door one tap away and her number carried across. */
            <button className="primary fr-cta ob-cta" disabled={!mobileOk || mobBusy}
              onClick={async () => {
                setMobErr(""); setMobBusy(true);
                const taken = await idInUse(mobile.trim());
                if (taken) { setMobBusy(false); setMobErr(MOBILE_TAKEN); return; }
                const sent = await requestOtp(mobile.trim());
                setMobBusy(false);
                if (sent) { setOtp(""); setOtpSent(true); }
              }}>
              {mobBusy ? (live ? "Sending…" : "Checking…") : "Generate OTP →"}
            </button>
          ) : (
            <>
              {/* Boxes auto-advance; backspace steps back (founder, 2026-08-25); a pasted
                  code spreads across them. Six live, four under the stub. */}
              <div className="ob-field">
                <span className="ob-otp-label">Enter the OTP</span>
                <div className="ob-otp-row">
                  {Array.from({ length: otpLen }, (_, i) => (
                    <input key={i} ref={(el) => { otpRefs.current[i] = el; }} className="ob-otp-box" type="tel"
                      inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"}
                      maxLength={i === 0 ? otpLen : 1} value={otp[i] || ""}
                      onChange={(e) => setOtpDigit(i, e.target.value)}
                      onKeyDown={(e) => otpKeyDown(i, e)}
                      aria-label={`OTP digit ${i + 1}`} />
                  ))}
                </div>
              </div>
              {live ? (
                <p className="ob-quiet">Sent by SMS to +91 {mobile.trim()}.{" "}
                  <button type="button" className="lgl-link" disabled={otpBusy}
                    onClick={async () => { setOtpErr(""); setOtp(""); const ok = await requestOtp(mobile.trim()); if (ok) setOtpErr(""); }}>
                    Resend</button></p>
              ) : (
                /* Honest stub — no SMS goes out in the preview. */
                <p className="ob-quiet">Preview build: enter <b>0000</b>.</p>
              )}
              {otpErr && <p className="ob-err" role="alert">{otpErr}</p>}
              <button className="primary fr-cta ob-cta" disabled={otp.length !== otpLen || otpBusy}
                onClick={verifyOtp}>{otpBusy ? "Verifying…" : "Verify & continue →"}</button>
            </>
          )}
        </div>
        <div className="ob-foot">
          <button className="fr-link" onClick={() => { setOtpSent(false); setOtp(""); setScreen(flow === "return" ? "signin" : "choose"); }}>← Back</button>
        </div>
      </div>
    );
  }

  /* ── SIGN IN (returning) — registered identities only, MOBILE or EMAIL only
   * (founder, 2026-08-26: no free-form user IDs at the front door; an email resolves
   * server-side to its account's mobile, which is what the session runs under). ── */
  const trimmed = id.trim();
  const signinOk = /^\d{10}$/.test(trimmed) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const submitSignin = async (e) => {
    e.preventDefault();
    if (!signinOk) return;
    setSigninErr("");
    try {
      const d = await getJSON(`/onboarding/known?id=${encodeURIComponent(trimmed)}`);
      if (d && d.known) {
        const uid = d.id || trimmed;
        if (!live) { enter(uid); return; }
        // Known number, so no "already in use" check — straight to the code.
        setMobile(uid); setFlow("return"); setMode("trial"); setMobErr(""); setOtp("");
        const err = await sendOtp(uid);
        if (err) { setSigninErr(err); return; }
        setOtpSent(true); setScreen("otp");
        return;
      }
      if (d && d.reason === "ambiguous_email") {
        // More than one account carries this address — only the mobile identifies her.
        setSigninErr("More than one Meyy account uses this email. Please sign in with your mobile number.");
        return;
      }
      setSigninErr("We don't recognise this mobile or email yet — tap “New to Meyy? Get started” below to create your sign in.");
    } catch {
      setSigninErr("Couldn't reach Meyy right now. Try again in a moment.");
    }
  };
  return (
    <div className="ob-wrap">
      <Bar />
      <div className="ob-body">
        <Benefits />
        <div className="ob-rule" />
        <div className="kicker login-kicker">Sign in</div>
        <h1 className="login-q">Who&rsquo;s planning today?</h1>
        <form onSubmit={submitSignin}>
          <label className="login-field ob-field">
            <span>Mobile number or email</span>
            <input ref={inputRef} type="text" value={id} onChange={(e) => setId(e.target.value)}
              placeholder="98xxxxxxxx or you@example.com" autoComplete="off" spellCheck={false} />
          </label>
          <button type="submit" className="primary login-btn" disabled={!signinOk}>
            Enter →
          </button>
        </form>
        {signinErr && <p className="ob-err" role="alert">{signinErr}</p>}
        <p className="fr-secure">🛡 Your data is private and secure ·{" "}
          <button type="button" className="lgl-link" onClick={openPrivacy}>Privacy Notice</button></p>
      </div>
      <div className="ob-foot">
        <button className="fr-link" onClick={() => setScreen("choose")}>New to Meyy? Get started →</button>
      </div>
    </div>
  );
}
