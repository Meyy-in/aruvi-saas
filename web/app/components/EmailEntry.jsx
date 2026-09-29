"use client";
/* ★ ONE WAY TO PUT AN EMAIL ON RECORD (WALK-A-125 / 135, founder 2026-09-28).
 *
 * Used by Settings › Personal profile, Settings › Support (a teacher with no email — trial
 * included) and Subscribe › About you, so the three can never teach her three habits.
 *
 * THE SHAPE (founder's words, walk of 04.12):
 *   · the address on record shows FROZEN, with "change" at the right end;
 *   · "change" opens a New-email box and, under it, a Type-it-again box — both at once,
 *     the second with no "change" of its own;
 *   · ONE button, "Confirm" (not "Verify"). Matched → the two collapse into the single
 *     frozen row. Unmatched → a warning under the boxes and NOTHING is reset: the old flow
 *     cleared the second box and sent her back to the first, so a wrong FIRST entry
 *     followed by a right second one looped her forever;
 *   · "change" pressed again while the boxes are open takes both boxes away (cancel);
 *   · paste is allowed in the first box, NOT in the second (a pasted copy confirms
 *     nothing); the browser's own saved addresses (autofill) are allowed in both.
 *
 * No emailed code (founder, 2026-09-28): typed twice and matched is "on record". Ownership
 * proof belongs to a later, subscriber-only decision.
 *
 * Props
 *   current      the confirmed address, or "" — no frozen row, the boxes show at once
 *   label        the field label (a node, so a caller can add "*" or "(optional)")
 *   selfId       her account id, so re-entering her OWN address is never "taken"
 *   mask         show the frozen address masked (subscribe's recognition-only tick)
 *   fit          optional (addr) => extra class for long addresses
 *   onConfirmed  (addr) => undefined | "" | "sentence" | Promise of the same — a sentence
 *                is shown under the boxes and the boxes stay open (e.g. a failed save)
 *   onDraft      ({ editing, first, second }) — every keystroke, so a parent can fold a
 *                matched pair into its own Save and know when the form is dirty
 *   disabled     freeze everything (a parent save in flight)
 */
import { useEffect, useState } from "react";
import { EMAIL_OK, EMAIL_TAKEN, idInUse } from "../lib/format";

export const EMAIL_MISMATCH = "The two entries don't match — check both and try again.";

const maskEmail = (e) => {
  const [u, d] = String(e).split("@");
  if (!d) return "•••";
  return `${u.slice(0, 1)}•••@${d}`;
};
const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

export default function EmailEntry({ current = "", label = "Email", selfId = "", mask = false,
                                     fit, onConfirmed, onDraft, disabled = false }) {
  const [editing, setEditing] = useState(!current);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // A caller that learns the address later (a fetch landing) closes the boxes.
  useEffect(() => { if (current) setEditing(false); else setEditing(true); }, [current]);
  useEffect(() => { onDraft && onDraft({ editing, first, second }); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, first, second]);

  const toggle = () => {
    setFirst(""); setSecond(""); setErr("");
    setEditing((v) => !v);
  };

  const confirm = async () => {
    if (busy || disabled) return;
    if (!EMAIL_OK(first) || !EMAIL_OK(second)) return;
    if (!same(first, second)) { setErr(EMAIL_MISMATCH); return; }
    const v = first.trim();
    if (current && same(v, current)) { toggle(); return; }       // nothing changed
    setBusy(true); setErr("");
    try {
      if (await idInUse(v, selfId)) { setErr(EMAIL_TAKEN); return; }
      const msg = onConfirmed ? await onConfirmed(v) : "";
      if (msg) { setErr(msg); return; }
      setFirst(""); setSecond(""); setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const frozen = !!current && (
    <label className="login-field ob-field"><span>{label}</span>
      <div className="ob-email-view">
        <span className={"ob-email-addr" + (fit ? fit(current) : "")}>
          {mask ? <><span className="ob-tick">✓</span> {maskEmail(current)}</> : current}
        </span>
        <button type="button" className="fr-link" disabled={disabled || busy} onClick={toggle}>
          change
        </button>
      </div>
    </label>
  );

  return (
    <>
      {frozen}
      {editing && (
        <>
          <label className="login-field ob-field"><span>{current ? "New email" : label}</span>
            <input type="email" inputMode="email" autoComplete="email" value={first}
              disabled={disabled || busy}
              onChange={(e) => { setFirst(e.target.value); setErr(""); }}
              placeholder="Enter your email" /></label>
          <label className="login-field ob-field"><span>Type it again</span>
            <input type="email" inputMode="email" autoComplete="email" value={second}
              disabled={disabled || busy}
              onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}
              onChange={(e) => { setSecond(e.target.value); setErr(""); }}
              placeholder="Type it again to confirm" /></label>
          {err && <p className="ob-err" role="alert">{err}</p>}
          <button type="button" className="fr-link ob-email-next"
            disabled={disabled || busy || !EMAIL_OK(first) || !EMAIL_OK(second)}
            onClick={confirm}>
            {busy ? "Checking…" : "Confirm"}
          </button>
        </>
      )}
    </>
  );
}

/* For a parent's Save: the address a still-open pair would put on record, or null when the
   pair is not a clean match (a parent never saves an unconfirmed address). */
export const matchedDraft = (d) =>
  d && d.editing && EMAIL_OK(d.first) && same(d.first, d.second) ? d.first.trim() : null;
