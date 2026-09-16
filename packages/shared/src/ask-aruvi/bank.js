/* ───────── Ask Aruvi — the question bank, fetched once and kept on the device ─────────
 *
 * ★ WHY THIS FILE EXISTS (2026-08-30). The bank used to be a static import inside
 * AskAruvi.jsx, which compiled all 120 answers into the main page chunk. That chunk is a
 * PUBLIC url served before anyone signs in, so the bank — which states how period
 * allocation is weighted and how each subject's assessment is built — was downloadable by
 * any crawler or competitor, in machine-readable form, without an account.
 *
 * ★ THE TWO REQUIREMENTS PULL OPPOSITE WAYS, and this file is how both are met:
 *
 *   1. SIGNED-IN ONLY. GET /ask-aruvi sits behind X-Aruvi-User. Nothing ships in the
 *      bundle any more, so there is nothing to read without an account. (The trial is
 *      free, so this is a fence, not a wall — the point is that it stops being PUBLIC.)
 *
 *   2. STILL WORKS OFFLINE. Ask Aruvi is the HELP screen; it is needed exactly when the
 *      network is poor, on a school Android, mid-corridor. So the bank is fetched ONCE and
 *      written to localStorage, and every read after that is local and synchronous.
 *
 * ★ THE ETAG IS WHAT MAKES THE FRESHNESS CHECK FREE. We store the server's ETag beside the
 * bank and send it back as If-None-Match — a 32-character fingerprint, never the bank itself.
 * On a normal app load the server answers `{"unchanged": true}` and we keep what we have. The
 * ~90KB download happens only in the month the answers actually change. So: a check every
 * load, a download almost never.
 *
 * ⚠️ "UNCHANGED" ARRIVES AS A 200, NOT A 304, and that is a deliberate server decision made on
 * 2026-09-16: Render's edge turns our empty 304 into a 503 before it reaches the device, so
 * the freshness check failed for every teacher who already held a copy. Nothing LOOKED broken —
 * the catch below kept the stored bank and the help screen went on answering — but the bank
 * could never refresh, so an edited answer would never have reached a phone again. See the
 * block above `get_plans` in api/main.py for the measurement. The 304 branch below is kept
 * anyway: it costs one comparison and it is what a direct server, or a fixed edge, will send.
 *
 * ★ FAILURE IS ALWAYS SILENT AND ALWAYS FALLS BACK TO THE STORED COPY. Offline, a dead
 * server, a 401 — none of them may blank the help screen. The only state with no answers is
 * a teacher whose first session lost signal before the priming fetch landed, and page.jsx
 * primes at sign-in (when she has just authenticated over the network) to make that rare.
 */

import { API, withUser } from "../format.js";
import { storage } from "../storage.js";

const BANK_KEY = "aruvi_ask_bank";
const ETAG_KEY = "aruvi_ask_bank_etag";

/* The stored bank, or null. Synchronous by design — AskAruvi opens from this, never from a
 * promise, so the panel is never blocked on the network. Any storage failure (private mode,
 * cleared site data, a browser that throws on access) reads as "nothing stored" and the
 * caller refreshes. */
export function loadBank() {
  try {
    const raw = storage.getItem(BANK_KEY);
    if (!raw) return null;
    const kb = JSON.parse(raw);
    // A truncated or hand-mangled entry must not render as an empty help screen that looks
    // like a working one — treat anything without pairs as absent.
    return kb && Array.isArray(kb.pairs) && kb.pairs.length ? kb : null;
  } catch {
    return null;
  }
}

function store(kb, etag) {
  try {
    storage.setItem(BANK_KEY, JSON.stringify(kb));
    if (etag) storage.setItem(ETAG_KEY, etag);
  } catch {
    /* Quota or private mode: the bank still works for THIS session from memory; it will
     * simply be re-fetched next time. Never surface this to the teacher. */
  }
}

/* Fetch the bank if the server has a newer one; return the current bank either way.
 *
 * Returns: the bank object (fresh or stored), or null if there is nothing either way.
 * Never throws — callers may fire and forget. */
export async function refreshBank() {
  const stored = loadBank();
  let etag = "";
  try { etag = storage.getItem(ETAG_KEY) || ""; } catch {}

  try {
    const opts = withUser({ headers: {} });
    // Only send If-None-Match when we actually hold the matching bank — an etag left over
    // from a cleared bank would earn a 304 and leave us with nothing.
    if (etag && stored) opts.headers["If-None-Match"] = etag;
    const r = await fetch(API + "/ask-aruvi", opts);
    if (r.status === 304) return stored;
    if (!r.ok) return stored;
    const kb = await r.json();
    // The server's "you already have it". Checked BEFORE the shape test below, which would
    // also reject it — but silently, and for the wrong reason: a marker read as "the server
    // sent something useless" is indistinguishable from a corrupt bank, and the day that
    // distinction matters is the day someone is debugging this at a school.
    if (kb && kb.unchanged) return stored;
    if (!kb || !Array.isArray(kb.pairs) || !kb.pairs.length) return stored;
    store(kb, r.headers.get("ETag") || "");
    return kb;
  } catch {
    return stored;          // offline, CORS, server down — the stored copy stands
  }
}

/* Called once at sign-in (page.jsx). Priming HERE rather than when she first opens Ask
 * Aruvi is the whole offline guarantee: at sign-in she has just authenticated over the
 * network, so this is the moment she is most certainly online. */
export function primeBank() {
  refreshBank().catch(() => {});
}

/* Sign-out clears it with everything else: the bank is licensed content behind an account,
 * and leaving it in a shared browser after log-out would undo the fence. */
export function clearBank() {
  try {
    storage.removeItem(BANK_KEY);
    storage.removeItem(ETAG_KEY);
  } catch {}
}
