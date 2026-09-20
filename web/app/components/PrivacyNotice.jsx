"use client";
import { useEffect, useState } from "react";
import { API } from "../lib/format";
import { renderMarkdown, dateWords } from "../lib/legalmd";

/* ── The Privacy Notice, on screen (2026-09-04) ──
 *
 * GIVEN, NOT SIGNED. DPDP §5 makes a privacy notice something Meyy GIVES at or before
 * it collects anything; consent (§6) is a separate act, asked for only where consent is
 * the basis — the agreement's optional marketing tick. So this component has no
 * checkbox and records nothing: it renders the document, whole, wherever it is opened —
 *
 *   · the sign-in screen, BEFORE she types her mobile (Login.jsx) — the moment of first
 *     collection, which is where the law wants the notice; no account exists yet, so
 *     GET /legal/privacy takes no X-Aruvi-User;
 *   · the agreement's final tick, whose own words are "…and Privacy Notice" — the words
 *     are a link that opens this in a sheet over the wizard (Agreement.jsx);
 *   · Settings › Legal, permanently, beside the agreement (Settings.jsx).
 *
 * The version she was shown is stamped on her ACCOUNT by the server (at registration
 * and when she dismisses the "updated" note), never by this component: the record must
 * name the version that was current on the server at that moment, not what a client
 * believed. It is erased with her — it is a fact about the record, not a consent.
 *
 * THE TEXT IS NEVER TYPED HERE. It is the founder's markdown, front matter dropped,
 * from the content store (api/legal.py) — one copy, versioned by filename, never edited
 * once shown. `version` shows an older published version when a caller wants the one
 * her record names. */
/* `frame` (founder, 2026-09-04: "freeze it from top down to … Privacy Notice"): the
 * pre-sign-in screen is a THREE-BAND FRAME like the agreement's sign step — title pinned,
 * document scrolling, Back pinned — so a teacher scrolling a long document never loses
 * either what she is reading or the way out. The container must stop growing for that
 * to work (`.ob-wrap-lock` / `.ob-body-lock`, applied by the caller — a component cannot
 * reach its own container); here the class is `lgl-frame`, which shares the sign
 * frame's CSS without implying a signature. Read mode in Settings ignores it. */
export default function PrivacyNotice({ version = "", onBack, backLabel = "← Back",
                                        frame = false }) {
  const [state, setState] = useState(null);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    let live = true;
    const q = version ? `?version=${encodeURIComponent(version)}` : "";
    // Deliberately a bare fetch — no withUser(): this must load with NO identity.
    fetch(`${API}/legal/privacy${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (live) setState(d); })
      .catch(() => { if (live) setFailed(
        "The privacy notice couldn't be loaded just now. Check your connection and try again."); });
    return () => { live = false; };
  }, [version]);

  /* ★ THE WAY OUT IS DRAWN IN EVERY STATE (WALK-A-003, 2026-09-20). Loading and failure used to
     return early, BEFORE the head that carries onBack — so a signed-out teacher on a bad
     connection met "couldn't be loaded" with no way back at all (only a reload got out). Both
     states now render inside the same frame, with the same Back, as the loaded document. */
  if (failed || !state) {
    return (
      <div className={`lgl lgl-privacy ${frame ? "lgl-frame" : "lgl-read"}`}>
        <div className="lgl-head">
          {frame && onBack && (
            <button type="button" className="fr-link lgl-back" onClick={onBack}>{backLabel}</button>
          )}
          <h1 className="ob-title">Privacy Notice</h1>
        </div>
        <div className="lgl-scroll">
          {failed
            ? <p className="lgl-fail" role="alert">{failed}</p>
            : <div className="fr-loading">Loading the privacy notice…</div>}
        </div>
        {!frame && onBack && (
          <div className="lgl-privacy-foot">
            <button className="fr-link" onClick={onBack}>{backLabel}</button>
          </div>
        )}
      </div>
    );
  }

  const doc = state.document || {};
  const older = state.current_version && doc.version && doc.version !== state.current_version;

  return (
    <div className={`lgl lgl-privacy ${frame ? "lgl-frame" : "lgl-read"}`}>
      <div className="lgl-head">
        {/* Framed: Back sits at the TOP, inside the pinned band, above the title
            (founder, 2026-09-04) — the way out is visible from the first line, not
            only after the last. */}
        {frame && onBack && (
          <button type="button" className="fr-link lgl-back" onClick={onBack}>{backLabel}</button>
        )}
        <h1 className="ob-title">{doc.title || "Privacy Notice"}</h1>
      </div>
      <div className="lgl-scroll">
        {older && (
          <p className="lgl-hint">This is version {doc.version}, which you were shown. The
            current notice is version {state.current_version}.</p>
        )}
        <div className="lgl-agreement lgl-privacy-body">{renderMarkdown(doc.body, "pn")}</div>
        <p className="lgl-version">Version {doc.version}
          {doc.published ? <> · {dateWords(doc.published)}</> : null}
          {" "}· {doc.language === "en" ? "English" : doc.language}
          {" "}· This notice is available at any time under Settings &rsaquo; Legal.</p>
      </div>
      {/* Unframed with a way out: a plain row after the document. (Framed puts Back
          in the pinned head above, and nothing below the scroll.) */}
      {!frame && onBack && (
        <div className="lgl-privacy-foot">
          <button className="fr-link" onClick={onBack}>{backLabel}</button>
        </div>
      )}
    </div>
  );
}
