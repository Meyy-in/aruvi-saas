"use client";
import { useEffect, useRef, useState } from "react";
import { API, withUser, getJSON, errDetail, waLink } from "../lib/format";
import { problemReport, reportWhatsAppText } from "@aruvi/shared/report";
import { versionLine } from "../lib/version";

/* ───────── "Report a problem" — Support, opened on the spot from a lesson ─────────
 * Founder, 2026-10-03. Not a third channel: it is the Support box brought to where the fault
 * was seen, and it sends through the two channels Meyy already answers on.
 *
 *   WhatsApp only → "Send on WhatsApp": opens HER WhatsApp chat with Meyy, her words and the
 *                   lesson line already typed. She presses Send there, so the message sits in
 *                   her own WhatsApp — and, because SHE wrote first, Meyy's reply is free and
 *                   immediate inside the 24-hour window.
 *   Email only    → "Send": the same POST /support the Settings form uses, category "plan",
 *                   with the lesson attached as context. Reference on screen, acknowledgement
 *                   (with a copy of her words and the lesson rows) to the address on record.
 *   Both          → two buttons; she picks ONE.
 *   Neither       → no form (Meyy writes only to what is on record — WALK-A-135); a note
 *                   sends her to Settings to add one.
 *
 * Sending, or ✕, or Esc, or a tap outside, returns her to the lesson exactly where she was —
 * the pop-up is an overlay, the lesson underneath never unmounts. */
const MAX = 4000;

export default function ReportProblem({ lp, unitNumber, unitTitle = "", dropped = false, onClose }) {
  const report = problemReport({ lp, unitNumber, unitTitle, dropped });
  const [meta, setMeta] = useState(null);      // {email, whatsapp, whatsapp_number} from GET /support
  const [metaErr, setMetaErr] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(null);      // POST /support's reply (email route only)
  const taRef = useRef(null);

  useEffect(() => {
    let live = true;
    getJSON("/support")
      .then((d) => { if (live) { if (d) setMeta(d); else setMetaErr(true); } })
      .catch(() => { if (live) setMetaErr(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => { if (meta) taRef.current?.focus(); }, [meta]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const known = !!meta && !metaErr;
  const hasEmail = known && !!meta.email;
  const hasWa = known && !!meta.whatsapp;
  const ready = !!text.trim() && !busy;

  // Opened straight from the click (no await first) so no browser treats it as a pop-up.
  const sendWa = () => {
    if (!ready) return;
    window.open(waLink(reportWhatsAppText(report, text), meta.whatsapp_number), "_blank", "noopener");
    onClose();
  };
  const sendEmail = async () => {
    if (!ready) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/support`, withUser({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "plan", message: text.trim(),
          context: { ...report.context, version: versionLine() } }),
      }));
      if (!r.ok) { setErr(await errDetail(r, "Couldn't send that just now — try again.")); return; }
      setSent(await r.json());
    } catch {
      setErr("Couldn't send that just now — try again.");
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (sent) {
    body = (
      <>
        <div className="rp-head"><h2 className="rp-title">Sent — thank you</h2>
          <button className="rp-x" aria-label="Close" onClick={onClose}>✕</button></div>
        <div className="sup-refcap rp-gap">Your reference</div>
        <div className="sup-ref">{sent.reference}</div>
        <p className="rp-msg">{sent.emailed
          ? <>We've emailed a copy to <strong>{sent.email}</strong>. Expect a reply within{" "}
              {sent.reply_window || "2 working days"}.</>
          : <>Your report is with us. Expect a reply within {sent.reply_window || "2 working days"}.</>}</p>
        <button className="primary rp-btn" onClick={onClose}>Back to the lesson</button>
      </>
    );
  } else {
    body = (
      <>
        <div className="rp-head"><h2 className="rp-title">Report a problem</h2>
          <button className="rp-x" aria-label="Close" onClick={onClose}>✕</button></div>
        <div className="rp-ctx">
          <div className="rp-ctx-l">You were reading</div>
          <div className="rp-ctx-v">{report.line}</div>
          <div className="rp-ctx-c">Ref {report.ref}</div>
        </div>
        {!meta && !metaErr ? <p className="rp-msg rp-quiet">One moment…</p> : null}
        {metaErr ? (
          <p className="rp-msg">We couldn't load your support details just now. Close this and
            try again in a moment.</p>
        ) : null}
        {known && !hasEmail && !hasWa ? (
          <p className="rp-msg">Meyy replies only to an email address or WhatsApp on your account.
            Add one in Settings › Personal profile, then report this again.</p>
        ) : null}
        {known && (hasEmail || hasWa) ? (
          <>
            <label className="rp-lab" htmlFor="rp-text">What looks wrong?</label>
            <textarea id="rp-text" ref={taRef} className="sup-text rp-text" rows={5}
              maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Describe what looks wrong. You can paste the line from the lesson here." />
            {err ? <p className="rp-err">{err}</p> : null}
            {hasWa && hasEmail ? (
              <div className="rp-two">
                <button className="primary rp-btn" disabled={!ready} onClick={sendWa}>Send on WhatsApp</button>
                <button className="rp-btn rp-sec" disabled={!ready} onClick={sendEmail}>
                  {busy ? "Sending…" : "Send by email"}</button>
              </div>
            ) : hasWa ? (
              <button className="primary rp-btn" disabled={!ready} onClick={sendWa}>Send on WhatsApp</button>
            ) : (
              <button className="primary rp-btn" disabled={!ready} onClick={sendEmail}>
                {busy ? "Sending…" : "Send"}</button>
            )}
            <p className="rp-note">
              {hasWa && hasEmail
                ? <>WhatsApp opens with your message ready — tap Send there. Email sends from
                    here, with a copy to <strong>{meta.email}</strong>.</>
                : hasWa
                  ? <>Opens WhatsApp with your message ready. <strong>Tap Send there</strong>,
                      then come back — your lesson stays open.</>
                  : <>A copy goes to <strong>{meta.email}</strong>.</>}
            </p>
          </>
        ) : null}
      </>
    );
  }

  return (
    <div className="rp-bg" onClick={onClose}>
      <div className="rp-sheet" role="dialog" aria-modal="true" aria-label="Report a problem"
        onClick={(e) => e.stopPropagation()}>
        <div className="rp-grab" aria-hidden="true" />
        {body}
      </div>
    </div>
  );
}
