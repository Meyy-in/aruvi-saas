"use client";
import { useEffect, useState } from "react";
import { authHeaders } from "../lib/auth";
import { API, getJSON, postJSON, errDetail } from "../lib/format";
import { renderMarkdown, dateWords } from "../lib/legalmd";
import PrivacyNotice from "./PrivacyNotice";

/* ★ THE FINAL TICK'S OWN WORDS ARE A LINK (2026-09-04). The tick reads "I have read the
 * full User Agreement and Privacy Notice …" — so the notice must be one tap from those
 * words, or the sentence asks her to confirm reading something she was never shown.
 * The phrase is found in the document's text rather than hard-coded, so a future
 * version that rewords the tick still links wherever the two words appear; a version
 * without them renders the plain sentence. Opens the notice in a SHEET over the wizard
 * (below), not a navigation — she is mid-signature and must land back on the tick. */
const NOTICE_WORDS = "Privacy Notice";
function withNoticeLink(text, onOpen, keyBase = "fin") {
  const s = String(text || "");
  const i = s.indexOf(NOTICE_WORDS);
  if (i < 0) return s;
  return [
    s.slice(0, i),
    <button type="button" className="lgl-link" key={`${keyBase}-pn`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(); }}>
      {NOTICE_WORDS}
    </button>,
    s.slice(i + NOTICE_WORDS.length),
  ];
}

/* ── The user agreement, on screen (founder, 2026-08-27) ──
 *
 * ONE component, two modes, because they are the same document and a teacher must not
 * be able to find two versions of what she signed:
 *
 *   mode="sign"  — the subscribe wizard's Agreement step. Five individual ticks, then
 *                  the full agreement, then the final tick. Continue is dead until all
 *                  six are down. Calls onAccepted() after POST /legal/consent succeeds.
 *   mode="read"  — Settings › Legal. The same text, no checkboxes, with her acceptance
 *                  record at the top ("Accepted 27 August 2026 · version 0.1").
 *
 * WHERE IT SITS IN THE WIZARD: before Subjects, not before Pay. That is the founder's
 * placement and the document's own. The five points are about what Aruvi IS — a teaching
 * aid, not endorsed, no student data, AI-assisted, personally licensed — and she should
 * know all five BEFORE she picks what to buy, not after she has built a cart and is one
 * tap from paying, where a refusal costs her the work of choosing.
 *
 * THE TEXT IS NEVER TYPED HERE. It arrives parsed from GET /legal/consent, which reads
 * the founder's markdown out of the content store. A legal document that exists twice
 * will disagree with itself, and the copy she ticked is the copy that binds.
 *
 * The ticks are recorded per point (the server stamps each id), which is why this screen
 * asks for five separate checkboxes rather than one "I agree to all of the above" — the
 * whole reason the document separates them is that "she saw point 3" is a fact worth
 * being able to state on its own. */

/* ★ `userId` IS NOT OPTIONAL ON THE FRONT DOOR (2026-08-27). getJSON/postJSON attach
 * X-Aruvi-User from localStorage, and on the front-door subscribe path localStorage is
 * still EMPTY — Login only calls setUser after checkout completes. A signature filed
 * against the fallback identity would be filed against the wrong tenant, and the
 * checkout gate (which runs as her real id) would then refuse a teacher who had just
 * ticked all six boxes. So the caller passes the id the checkout will run as, and every
 * request here uses it. Settings passes nothing: there, she is signed in and localStorage
 * is the authority. Same asymmetry, same reason, as SubscribeFlow's own /account fetch. */
export default function Agreement({ mode = "read", userId = "", onAccepted, onBack,
                                    backLabel = "← Back",
                                    context = "subscription_checkout" }) {
  const [state, setState] = useState(null);      // the GET payload
  const [failed, setFailed] = useState("");
  const [ticks, setTicks] = useState({});        // ack id → bool
  const [final, setFinal] = useState(false);
  /* ★ The OPTIONAL marketing tick (v0.4+). Its own state, never merged into `ticks` —
     `allTicked` is computed from `ticks`, so anything living there becomes mandatory by
     construction, and a marketing consent that gates the service is exactly what DPDP §6
     forbids. Default false, and it stays false unless she says otherwise. */
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    let live = true;
    const load = userId
      ? fetch(`${API}/legal/consent`, { headers: authHeaders(userId) })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      : getJSON("/legal/consent");
    load
      .then((d) => { if (live) setState(d); })
      .catch(() => { if (live) setFailed(
        "The agreement couldn't be loaded just now. Check your connection and try again."); });
    return () => { live = false; };
  }, [userId]);

  if (failed) return <p className="lgl-fail" role="alert">{failed}</p>;
  if (!state) return <div className="fr-loading">Loading the agreement…</div>;

  const doc = state.document || {};
  const acks = doc.acknowledgements || [];
  const signing = mode === "sign";
  const allTicked = acks.length > 0 && acks.every((a) => ticks[a.id]) && final;

  const accept = async () => {
    setBusy(true); setErr("");
    const body = {
      version: doc.version,
      acknowledgements: acks.map((a) => a.id),
      final: true,
      context,
      language: doc.language || "en",
      // Sent beside the ticks, never among them (see the state note above).
      marketing_email: !!marketing,
    };
    try {
      if (userId) {
        const r = await fetch(`${API}/legal/consent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(userId) },
          body: JSON.stringify(body),
        });
        /* The server's own sentence when it wrote one for her (a superseded version is a
           409 with real advice); our fallback otherwise. Same rule as postJSON's. */
        if (!r.ok) {
          setErr(await errDetail(r,
            "Couldn't record your acceptance. Try again in a moment."));
          setBusy(false);
          return;
        }
      } else {
        await postJSON("/legal/consent", body);
      }
      onAccepted && onAccepted();
    } catch (e) {
      setErr(e.detail || "Couldn't record your acceptance. Try again in a moment.");
      setBusy(false);
    }
  };

  /* The five-box row's boxes are buttons, not decorations: a teacher at 4 of 5 with a
     dead button needs to find the ONE she missed, and hunting for it in a scrolled
     document is the whole reason the row exists. */
  const jumpTo = (id) => {
    const el = typeof document !== "undefined" && document.getElementById(`lgl-ack-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className={`lgl ${signing ? "lgl-sign" : "lgl-read"}`}>
      {/* ── Frozen band 1: the heading (founder, 2026-08-27) ── In sign mode the screen
          is a THREE-BAND frame — heading pinned, document scrolling between, accept bar
          pinned — so that a teacher scrolling a long legal document never loses either
          what she is reading or the way out of it. Read mode ignores the frame. */}
      <div className="lgl-head">
        <h1 className="ob-title">Legal Agreement with User</h1>
      </div>

      <div className="lgl-scroll">

      {/* READ mode leads with the fact she came for: did I accept this, and when. A
          teacher opening Settings › Legal is usually checking exactly that. */}
      {!signing && (
        state.accepted || state.prior_version ? (
          <p className="lgl-accepted">
            <span className="lgl-tick">✓</span> Accepted on{" "}
            {dateWords(state.accepted_at || state.prior_accepted_at)} · version{" "}
            {state.accepted_version || state.prior_version}
            {!state.accepted && state.prior_version && (
              <span className="lgl-stale"> — a newer version applies from your next
                subscription</span>)}
          </p>
        ) : (
          <p className="lgl-hint">You haven&rsquo;t accepted this agreement yet — you&rsquo;ll
            be asked to when you subscribe. It&rsquo;s here to read at any time.</p>
        )
      )}

      {/* A teacher who signed an earlier version is not a new signatory, and the screen
          should not greet her as one. */}
      {signing && state.prior_version && (
        <p className="lgl-hint">The agreement has been updated since you accepted version{" "}
          {state.prior_version}. Please read it again and confirm each point.</p>
      )}

      {doc.intro && <div className="lgl-intro">{renderMarkdown(doc.intro, "intro")}</div>}

      {/* ── The five ── */}
      <ol className="lgl-acks">
        {acks.map((a) => (
          <li className={`lgl-ack ${signing && ticks[a.id] ? "on" : ""}`} key={a.id}
              id={`lgl-ack-${a.id}`}>
            <div className="lgl-ack-head">
              <span className="lgl-ack-n">{a.n}</span>
              <span className="lgl-ack-title">{a.title}</span>
            </div>
            <div className="lgl-ack-body">{renderMarkdown(a.body, a.id)}</div>
            {signing && (
              <label className="lgl-check">
                <input type="checkbox" checked={!!ticks[a.id]}
                  onChange={(e) => setTicks((t) => ({ ...t, [a.id]: e.target.checked }))} />
                <span>I understand and agree.</span>
              </label>
            )}
          </li>
        ))}
      </ol>

      {/* ── The body the final tick accepts ── */}
      <div className="lgl-agreement">{renderMarkdown(doc.agreement, "agr")}</div>

      {signing && (
        <div className="lgl-final">
          <label className="lgl-check lgl-check-final">
            <input type="checkbox" checked={final}
              onChange={(e) => setFinal(e.target.checked)} />
            <span>{withNoticeLink(doc.final?.text, () => setShowPrivacy(true))}</span>
          </label>
        </div>
      )}

      {/* ── The OPTIONAL tick (v0.4+) ── Its own block, below the final acknowledgement
          and outside `.lgl-final`, because everything inside that box is required and a
          box that mixes the two teaches her that the optional one is required too. It
          does not appear at all on v0.1–v0.3, which have no "## Optional" section, so an
          older version renders exactly as it always did. Marked OPTIONAL in words rather
          than by styling alone — the one property she has to be sure of is the one a
          faint border cannot state. */}
      {signing && doc.optional && (
        <div className="lgl-optional">
          <span className="lgl-optional-tag">Optional</span>
          <label className="lgl-check lgl-check-opt">
            <input type="checkbox" checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)} />
            <span>{doc.optional.text}</span>
          </label>
        </div>
      )}

      <p className="lgl-version">Version {doc.version} · {doc.language === "en" ? "English" : doc.language}
        {" "}· This agreement is available at any time under Settings &rsaquo; Legal.</p>

      </div>{/* /.lgl-scroll */}

      {/* ── Frozen band 3: the five-point tally and the way out ── Nothing scrolls below
          this. The tally repeats the five ticks as boxes because by the time she reaches
          the accept button the points themselves are far up the document, and "which one
          did I miss?" must be answerable without scrolling back through all of them. */}
      {signing && (
        <div className="ob-foot lgl-foot">
          <div className="lgl-tally" role="group" aria-label="The five points">
            <span className="lgl-tally-lbl">Five points</span>
            <span className="lgl-tally-boxes">
              {acks.map((a) => (
                <button type="button" key={a.id}
                  className={`lgl-box ${ticks[a.id] ? "on" : ""}`}
                  onClick={() => jumpTo(a.id)}
                  aria-label={`Point ${a.n}: ${ticks[a.id] ? "confirmed" : "not yet confirmed"}`}
                  title={a.title}>
                  {ticks[a.id] ? "✓" : a.n}
                </button>
              ))}
            </span>
          </div>
          {/* Said where the button is, so a teacher staring at a dead button knows why —
              the alternative is a disabled control with no explanation, which reads as
              a broken page rather than an unfinished form. */}
          {/* WALK-A-084 (founder, 2026-09-24, wording his): say the boxes are jump links. */}
          {!allTicked && (
            <p className="lgl-need lgl-jumphint">Tap a box to go straight to that point.</p>
          )}
          {!allTicked && (
            <p className="lgl-need">Confirm each of the five points and accept the
              full agreement to continue.</p>
          )}
          {err && <p className="ob-err" role="alert">{err}</p>}
          <button className="primary fr-cta" disabled={!allTicked || busy} onClick={accept}>
            {busy ? "Recording…" : "I accept — continue →"}
          </button>
          {onBack && <button className="fr-link" onClick={onBack}>{backLabel}</button>}
        </div>
      )}

      {/* ── The notice, as a sheet over the wizard ── Its own scroll, its own ✕; the
          agreement and its ticks are untouched underneath, so closing lands her exactly
          where she was. */}
      {showPrivacy && (
        <div className="lgl-sheet" role="dialog" aria-modal="true" aria-label="Privacy Notice">
          <div className="lgl-sheet-bar">
            <span className="lgl-sheet-title">Privacy Notice</span>
            <button type="button" className="ap-close" aria-label="Close"
              onClick={() => setShowPrivacy(false)}>✕</button>
          </div>
          <div className="lgl-sheet-body">
            <PrivacyNotice />
          </div>
        </div>
      )}
    </div>
  );
}
