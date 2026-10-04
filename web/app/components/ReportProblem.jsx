"use client";
import { useEffect, useRef, useState } from "react";
import { API, withUser, getJSON, errDetail, waLink } from "../lib/format";
import { problemReport, reportWhatsAppText, phaseOptionLabel, SUPPORT_CAP_NOTE } from "@aruvi/shared/report";
import Dropdown from "./Dropdown";
import { versionLine } from "../lib/version";

/* ───────── "Report an issue" — Support, opened on the spot from a lesson ─────────
 * Founder, 2026-10-03. Not a third channel: it is the Support box brought to where the fault
 * was seen, and it sends through the two channels Meyy already answers on.
 *
 *   Opened from the "Spotted something wrong?" card at the end of the Lesson tab (above
 *   "Mark this unit complete") or the Assess tab. An optional phase picker turns the second
 *   row into "Polynomials · Unit 3 · Phase 2".
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

/* `part`   — the tab she opened it from: "lesson" or "assess" (founder, 2026-10-03: only the
              two that improve the lesson carry the card).
   `phases` — the unit's phases as minutes (null where the plan has none), for the optional
              picker. Empty by default: she can ignore it and the report is for the whole unit. */
export default function ReportProblem({ lp, unitNumber, unitTitle = "", dropped = false, part = "lesson",
                                        phases = [], planFile = "", onClose }) {
  const [phase, setPhase] = useState("");
  const report = problemReport({ lp, unitNumber, unitTitle, dropped, phase, part, planFile });
  const phaseOpts = part === "lesson" && phases.length
    // "0" not "" — an empty value would match this option and hide the placeholder.
    ? [{ value: "0", label: "No particular phase" },
       ...phases.map((mins, i) => ({ value: String(i + 1), label: phaseOptionLabel(i + 1, mins) }))]
    : [];
  const [meta, setMeta] = useState(null);      // {email, whatsapp, whatsapp_number} from GET /support
  const [metaErr, setMetaErr] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(null);      // POST /support's reply (email route only)
  const taRef = useRef(null);
  /* ★ MOVABLE ON A COMPUTER (founder, 2026-10-03): dragging the title bar slides the window,
     so the lesson underneath stays readable while she writes about it. Phones keep the bottom
     sheet — a drag there is a scroll. The offset is clamped so the bar can never leave the screen. */
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const sheetRef = useRef(null);
  const onDragStart = (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    if (!window.matchMedia("(min-width: 601px)").matches) return;
    const r = sheetRef.current?.getBoundingClientRect();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, r };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    let dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (d.r) {   // keep at least the title bar on screen
      const W = window.innerWidth, H = window.innerHeight;
      dx = Math.max(-d.r.left - d.r.width + 120, Math.min(W - d.r.left - 120, dx));
      dy = Math.max(-d.r.top, Math.min(H - d.r.top - 60, dy));
    }
    setPos({ x: d.ox + dx, y: d.oy + dy });
  };
  const onDragEnd = () => { dragRef.current = null; };

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
  // The day's cap on new requests (email + WhatsApp together, 2026-10-04): a note instead of the form.
  const capped = known && !!meta.cap_reached;

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
        <div className="rp-head" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}><h2 className="rp-title">Sent — thank you</h2>
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
        <div className="rp-head" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}><h2 className="rp-title">Report an issue</h2>
          <button className="rp-x" aria-label="Close" onClick={onClose}>✕</button></div>
        {/* ★ TWO SHORT ROWS, NOTHING ELSE (founder, 2026-10-03): "You were reading", the
            activity's name and the plan code all went — the first was furniture, the second
            does not concern her (the unit number is enough for Meyy), and the code is
            internal (it still travels in the case's context, for us). */}
        <div className="rp-ctx">
          {/* Row 1: class · subject, and — from the Lesson tab — the optional phase picker on
              the RIGHT of the same row (founder, 2026-10-03: "we do not need to waste a whole
              row"), one notch smaller than a form field. Empty by default; "Phase 2 - 15 min"
              so she recognises it by its length, not by counting. */}
          <div className="rp-ctx-row">
            <div className="rp-ctx-v">{report.line1}</div>
            {phaseOpts.length ? (
              <div className="rp-phase">
                <Dropdown value={phase} onChange={(v) => setPhase(v === "0" ? "" : v)} options={phaseOpts}
                  placeholder="Phase (optional)" ariaLabel="Which phase" />
              </div>
            ) : null}
          </div>
          <div className="rp-ctx-v rp-ctx-2">{report.line2}</div>
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
        {known && capped && (hasEmail || hasWa) ? (
          <>
            <p className="rp-msg">{meta.cap_note || SUPPORT_CAP_NOTE}</p>
            {hasWa ? (
              <button className="primary rp-btn" onClick={() => {
                window.open(waLink("", meta.whatsapp_number), "_blank", "noopener"); onClose(); }}>
                Open WhatsApp chat</button>
            ) : null}
          </>
        ) : null}
        {known && !capped && (hasEmail || hasWa) ? (
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
            {/* No how-to line under the buttons (founder, 2026-10-03): she learns what each
                does the first time and does not need telling every time after. */}
          </>
        ) : null}
      </>
    );
  }

  return (
    <div className="rp-bg" onClick={onClose}>
      <div className="rp-sheet" role="dialog" aria-modal="true" aria-label="Report an issue"
        ref={sheetRef} onClick={(e) => e.stopPropagation()}
        style={pos.x || pos.y ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}>
        <div className="rp-grab" aria-hidden="true" />
        {body}
      </div>
    </div>
  );
}
