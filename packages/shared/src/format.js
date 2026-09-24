/* ───────── shared formatting + API helpers ─────────
 * Lifted from web/app/lib/format.js on 2026-09-11 (Track D step 1) so the phone app runs the
 * SAME code. Three things changed, nothing else:
 *   · the API host and the bearer token are injected by config.js (configure()), not derived
 *     from the page's location / imported from the web's auth module;
 *   · the signed-in user id lives in the storage shim (storage.js), not the browser's storage;
 *   · boldMarks() — the one helper that built React elements — is now parseBold(), which
 *     returns plain runs; each app renders them (web: <strong>, phone: <Text>). */
import { API, getAccessToken } from "./config.js";
import { storage } from "./storage.js";
export { API } from "./config.js";
export const ROMAN = ["iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

export const pretty = (s) => (s || "").split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
export const gradeUp = (g) => (g || "").replace(/grade/i, "").trim().toUpperCase();
// Teacher-facing label: teachers say "Class 7", not "Grade VII". Roman grade slug → Arabic class
// number (ROMAN[0] "iii" → 3). Falls back to the upper-cased input for anything unrecognised.
export const classNum = (g) => {
  const idx = ROMAN.indexOf((g || "").toLowerCase());
  return idx >= 0 ? idx + 3 : (g || "").toUpperCase();
};
/* Grade → NCF stage. The web had FOUR byte-identical copies of this mapping (FirstRun,
   SubscribeFlow, TeachingProfile, and nearly a fifth in page.jsx) — against CLAUDE.md §3's own
   rule, "stage is derived from grade, never a separate input; everyone calls it, nobody
   re-implements the mapping" (the engine's single source is aruvi_core/grades.stage_for).
   This is the web's one copy; the components alias it. Accepts the Roman grade slug in any case.
   The stage matters more than it looks: it is the BILLING UNIT (teacher × subject-stage). */
export const stageOfGrade = (g) => {
  const r = (g || "").toLowerCase();
  if (["iii", "iv", "v"].includes(r)) return "preparatory";
  if (["vi", "vii", "viii"].includes(r)) return "middle";
  return "secondary";
};
export const kickerOf = (t) => (t || "").replace(/_/g, " ").toUpperCase();
export const pad = (n) => String(n ?? "").padStart(2, "0");

/* ───────── current user (pre-auth tenanting) ─────────
 * No password stage yet: the login portal stores the entered user ID here, and every API
 * call carries it as the X-Aruvi-User header. The API treats each user ID as its own
 * tenant (tenant_id == user_id). Phase 4 swaps this for a real auth token; the header seam
 * and the per-call injection below stay the same. localStorage so the login survives a
 * refresh — re-entering the ID each session would defeat the persistence we just added. */
const USER_KEY = "aruvi_user";
export function getUser() {
  try { return storage.getItem(USER_KEY) || ""; } catch { return ""; }
}
export function setUser(id) {
  try { storage.setItem(USER_KEY, (id || "").trim()); } catch {}
}
export function clearUser() {
  try { storage.removeItem(USER_KEY); } catch {}
}

/* Build a per-user localStorage key so one teacher's client state never bleeds into another's
 * on a shared browser (A3, 2026-07-06). (It was modelled on the plus_portal_{user}/expand_*_{user}
 * keys in MyPlans, all of which were retired on 2026-08-21 when the standing "+" was ungated —
 * this helper is now the scheme.) Pre-login (no user yet) it falls back to a bare "_" suffix, so the
 * key is still stable and non-leaking. Use for any per-user client cache/preference key. */
export function userKey(base) {
  return `${base}_${getUser() || ""}`;
}

/* Split a string on `**…**` markdown-bold spans into runs: [{ text, bold }]. Used for
 * homework lines, where the maths normalizer wraps the textbook locator (e.g. "Figure it Out
 * Q11, section 5.2 p.115") in `**…**` so the reference alone reads bold. A plain string (no
 * markers) comes back as one unbolded run. Rendering is the app's job — the web's
 * lib/format.js `boldMarks` maps these to <strong>, the phone maps them to <Text> — because
 * this package builds no elements of either kind. */
export function parseBold(text) {
  const s = String(text ?? "");
  const out = [];
  if (!s.includes("**")) return [{ text: s, bold: false }];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false });
  return out;
}

/* Merge the identity into any fetch options, preserving caller-set headers. Under Supabase
 * Auth (lib/auth.js) that is `Authorization: Bearer <access token>`; the X-Aruvi-User dev
 * header still rides along so a header-mode API keeps working — the API honours exactly one
 * of them by its own config, never both. */
export function withUser(opts = {}) {
  const user = getUser();
  const headers = { ...(opts.headers || {}) };
  const t = getAccessToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  if (user) headers["X-Aruvi-User"] = user;
  /* ★ NEVER SERVE ONE TEACHER A STORED ANSWER (2026-09-16). Every response from this API is
     about ONE teacher and can change the moment she or the founder changes it, and the API sends
     no `Cache-Control` at all — its only headers are content-type and content-length. A browser
     treats that as "do not reuse"; iOS's NSURLSession is far more willing to reuse an unmarked
     GET, so the phone can go on showing a figure the server has already changed. A plain REQUEST
     header is the portable lever: React Native's fetch is XHR underneath and IGNORES the `cache`
     option, but it sends headers like any other. Costs no extra round trip — `Authorization`
     already forces a CORS preflight on the web, so the preflight was happening anyway.
     ⚠️ `no-cache` (revalidate), not `no-store`: a 304 must stay cheap, which is what
     `/ask-aruvi`'s ETag depends on. The server says `no-store` for the rest; see api/main.py. */
  headers["Cache-Control"] = "no-cache";
  return { ...opts, headers };
}

/* ★ A GET RETRIES ITSELF (founder, 2026-09-17, on the handset: first run's subject step showed
 * "Couldn't load the subject list" on a brand-new account and *"seems to be ok after 3 or 4
 * presses"*). Three or four presses is the shape of a TRANSIENT — a backend still coming up, a
 * first TLS handshake to a host this device has never met, a radio that has just reattached —
 * and the teacher who meets it is, by definition, on the first screen she has ever seen. She
 * should not be the retry loop.
 *
 * ⚠️ ONLY GET, AND ONLY TRANSIENT STATUSES. A GET is idempotent by definition, so repeating one
 * is safe; `postJSON` is deliberately NOT given this, because repeating a checkout or a plan
 * generation is not. And a clean 4xx is an ANSWER, not a failure: `/onboarding/known` answers
 * 404 for a number we do not hold, `/plans/…/view` answers 404 for a deleted plan, and callers
 * read those codes. Retrying them would turn a correct instant answer into a three-second wait
 * for the same one. Only a thrown fetch (no response at all) and 408 · 429 · 502 · 503 · 504
 * come back for another try.
 *
 * ⚠️ AND EACH ATTEMPT NEEDS ITS OWN DEADLINE, or the retry never happens: a socket that hangs
 * blocks the first attempt for as long as the platform allows, which on a mobile network can be
 * a minute or more. 15s × 3 attempts bounds the worst case at ~48s including the backoff, which
 * is the same order as the cold start it exists to absorb. */
const RETRY_STATUS = new Set([408, 429, 502, 503, 504]);
const GET_TRIES = 3;
const GET_TIMEOUT_MS = 15000;
const GET_BACKOFF_MS = [500, 1500];

export async function getJSON(path, opts) {
  let lastErr;
  for (let attempt = 0; attempt < GET_TRIES; attempt += 1) {
    /* AbortController is available in React Native and every browser we support. If a host ever
       lacks it, `ctl` stays undefined and the attempt simply runs without a deadline rather than
       throwing — a slower failure is better than a broken one. */
    let ctl;
    let timer;
    try { ctl = new AbortController(); } catch { ctl = null; }
    if (ctl) timer = setTimeout(() => { try { ctl.abort(); } catch {} }, GET_TIMEOUT_MS);
    try {
      const r = await fetch(API + path, withUser(ctl ? { ...opts, signal: ctl.signal } : opts));
      if (r.ok) return await r.json();
      if (!RETRY_STATUS.has(r.status) || attempt === GET_TRIES - 1) {
        throw new Error(`${r.status}`);
      }
      lastErr = new Error(`${r.status}`);
    } catch (e) {
      /* The status throw above lands here too; rethrow it rather than retrying a decided answer. */
      if (e && e.message && /^\d{3}$/.test(e.message) && !RETRY_STATUS.has(Number(e.message))) throw e;
      lastErr = e;
      if (attempt === GET_TRIES - 1) throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
    await new Promise((res) => setTimeout(res, GET_BACKOFF_MS[attempt] || 1500));
  }
  throw lastErr || new Error("failed");
}

/* POST a JSON body and parse the JSON response (X-Aruvi-User attached like getJSON).
 * Added for the genon adaptation endpoint (PrepareLesson → POST /genon/.../plan); generic
 * on purpose — any future JSON POST should use this instead of hand-rolling fetch. */
/* NOTE (test campaign step 0, docs/testing.md §2, 2026-07-29): the seam-polish path —
 * SEAM_POLISH_ENABLED here and the ARUVI_SEAM_POLISH server gate — was REMOVED, not
 * merely off. Every generation is a pure partition of the certified canonical. */

/* ★ A POST NEEDS A DEADLINE TOO (founder, 2026-09-21, Pixel 7, WALK-A-052). In airplane mode the
 * lesson serve never came back and the preparing card sat at "Preparing…" for as long as anyone
 * was willing to watch — fifty seconds and counting, with no failure and nothing to press. The
 * GET path has had its own deadline since 2026-09-17 for exactly this reason; the POST was left
 * without one, so a socket that hangs hangs for ever.
 * ⚠️ NOT RETRIED, deliberately: a GET can be asked twice safely and a POST cannot — a second
 * serve could bill a second chapter. One attempt, bounded. The default is generous because
 * building a lesson plan legitimately takes time; callers with a shorter promise pass their own.
 * Aborting surfaces as a thrown fetch with no `status`, which every caller already treats as
 * "couldn't do it right now" — the failure a teacher can act on.
 * 45s, not two minutes (founder, 2026-09-21): a serve itself takes MILLISECONDS — the five
 * seconds she sees is the preparing card's own hold — so the only thing this has to absorb is a
 * cold start, which is what bounds the GET path at ~48s. Beyond that there is nothing to wait
 * for, and silence is its own failure. */
const POST_TIMEOUT_MS = 45000;

export async function postJSON(path, body, timeoutMs = POST_TIMEOUT_MS) {
  let ctl;
  let timer;
  /* If a host ever lacks AbortController the call simply runs without a deadline rather than
     throwing — a slower failure is better than a broken one. */
  try { ctl = new AbortController(); } catch { ctl = null; }
  if (ctl && timeoutMs) timer = setTimeout(() => { try { ctl.abort(); } catch {} }, timeoutMs);
  let r;
  try {
    r = await fetch(API + path, withUser({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      ...(ctl ? { signal: ctl.signal } : {}),
    }));
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!r.ok) {
    // Carry the SERVER'S OWN SENTENCE up to the caller (ARV-D-088, 2026-08-10). This used to
    // throw the status code alone, so every teacher-facing failure collapsed into one generic
    // line — and that line said "try again in a moment" for two cases where trying again can
    // never work (a chapter we have not authored; a period count that is not possible). The
    // API's 4xx strings are already written FOR HER — testing.md C13 check 1 exists to police
    // exactly that ("canonical" is our word, not hers) — so showing them is safe by
    // construction. 5xx detail is engine talk ("Canonical cannot be compiled: …") and is
    // deliberately NOT surfaced: `detail` is populated for 4xx only, and the caller falls
    // back to its own wording otherwise.
    let detail = "";
    try {
      const body = await r.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch { /* no JSON body — the status alone is all we have */ }
    const err = new Error(detail || `${r.status}`);
    err.status = r.status;
    err.detail = (r.status >= 400 && r.status < 500) ? detail : "";
    throw err;
  }
  return r.json();
}

/* ───────── the two refusals the CREATE door can give (lifted 2026-09-16) ─────────
 * Both surfaces now import these; the phone had re-declared the mobile one in its own words.
 * ⚠️ A client-side copy exists only because the early check (`/onboarding/known`) has no sentence
 * of its own to return — the SERVER's text stays the authority on the Pay path. If one is
 * reworded, reword both: `api/main.py _guard_email_not_taken`.
 */
/* ───────── the account form's fixed choices (lifted from SubscribeFlow 2026-09-16) ─────────
 * ROLES and STATES were declared inside `web/app/components/SubscribeFlow.jsx`, which meant the
 * phone's Personal profile could only have them by RETYPING them — and a list of Indian states
 * retyped once is a list that disagrees with itself the first time one is added. They are now
 * one array, imported by both surfaces (CLAUDE.md §3), and SubscribeFlow re-exports them so its
 * own call sites are untouched.
 * ⚠️ "Other" is LAST in both and is not sorted with the rest — it is an escape hatch, not a
 * state. */
export const ROLES = ["Teacher", "Academic coordinator", "Head of school", "Other"];
export const STATES = ["Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu",
  "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other"];

/* Deliberately loose — "has an @ and a dot after it". The server and the mail provider are the
 * real validators, and a client regex strict enough to be interesting is a client regex that
 * rejects somebody's valid address. Spelled identically in SubscribeFlow and Settings on the
 * web; one copy now. */
export const EMAIL_OK = (e) => /^\S+@\S+\.\S+$/.test((e || "").trim());

export const EMAIL_TAKEN =
  "This email is already in use by another Meyy account. Use a different address.";
/* ★ Founder, 2026-08-26, re-confirmed 2026-09-16 (Q21b): this screen CREATES a sign-in, so its
 * refusal stays inside that job — "use a different number". An earlier cut sent her to the sign-in
 * door with a link, and the phone had shipped exactly that wording ("…Tap Sign in below."). It is
 * wrong for two reasons: she is standing at the CREATE door and the instruction there is to create;
 * and whoever typed the number is told that this number holds an account, which is not theirs to
 * learn. */
export const MOBILE_TAKEN =
  "This mobile number is already in use. Create using a different number.";


/* ── "ALREADY IN USE" — one answer for the front door and the profile alike ──
 * Mobile and email are both CREDENTIALS (A5, 2026-08-26): a second account may never take
 * one that is already held. `/onboarding/known` answers for either shape and deliberately
 * creates nothing, so it is safe to ask before she has an account. `selfId` is excluded —
 * re-saving your OWN address is always fine. A shared address (`ambiguous_email`, >1
 * holder) is in use too: more so, not less.
 *
 * Returns true only on a DEFINITE answer. A network failure returns false and lets the
 * server's 409 be the authority — this check exists to tell her early, never to be the
 * thing that decides. */
export async function idInUse(value, selfId = "") {
  const v = String(value || "").trim();
  if (!v) return false;
  try {
    const r = await fetch(`${API}/onboarding/known?id=${encodeURIComponent(v)}`);
    if (!r.ok) return false;
    const d = await r.json();
    if (d && d.reason === "ambiguous_email") return true;
    if (!d || !d.known) return false;
    return String(d.id || v).toLowerCase() !== String(selfId || "").trim().toLowerCase();
  } catch {
    return false;
  }
}

/* The server's own sentence for a 4xx, or the caller's fallback — the RAW-FETCH twin of
 * postJSON's `err.detail` (ARV-D-088, and see the reasoning there). For callers that
 * cannot use postJSON because they run before sign-in and must set X-Aruvi-User by hand.
 * 5xx detail is engine talk and is never surfaced. */
export async function errDetail(r, fallback) {
  if (r && r.status >= 400 && r.status < 500) {
    try {
      const b = await r.json();
      if (typeof b?.detail === "string" && b.detail.trim()) return b.detail;
    } catch { /* no JSON body — the fallback is all we have */ }
  }
  return fallback;
}

/* Record a saved plan as PREPARED by this teacher (POST /plans-prepared). Called when she
 * actually generates/attaches a lesson — first-run activation and the everyday PrepareLesson
 * flow — so My Lessons lists only her own work, not the whole shared sample library. Fire-and-
 * forget: the UI never blocks on it, and the flag simply stays false if the write is lost.
 * subject/grade are SLUGS; filename is the saved-plan file. */
export function markPrepared(subject, grade, filename, periods, sourceYear) {
  if (!subject || !grade || !filename) return Promise.resolve();
  // `sourceYear` (2026-08-26) marks a chapter she carried forward from an earlier academic
  // year, so her section card can say "2026-27 version". Omitted for a fresh generation.
  // `periods` (optional) is the teacher's chosen period count for this chapter — stored server-
  // side so budget tracking reflects what she allocated, not the served plan's authored length.
  // Returns the (error-swallowed) promise so callers that need the write to land before they
  // refetch /plans — e.g. PrepareLesson's auto-attach return — can await it. Fire-and-forget
  // callers can still ignore the return value.
  const body = { subject, grade, filename };
  if (periods != null) body.periods = periods;
  if (sourceYear) body.source_year = sourceYear;
  return fetch(`${API}/plans-prepared`, withUser({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })).catch(() => {});
}

/* ───────── chapter notes — server-backed (admin architecture Step 3, 2026-08-22) ─────
 * Notes were the last teacher data living ONLY in the browser (CLOUD_DATA_MODEL.md §2.8).
 * They are now a year-scoped server record — ONE note per chapter per academic year —
 * keyed "{subjectSlug}/{gradeSlug}/{chapter_number}". localStorage stays an optimistic
 * cache (same pattern as section state): the server is authoritative on load, the cache
 * keeps the editor instant and offline-tolerant. NO version history, by design (§2.4):
 * the server keeps one text + one updated_at, and refuses only a WRITE that is older
 * than what it holds (409 carries the newer copy so the stale device adopts it). */

/* The server's canonical note key for a chapter. MUST mirror api/main.py's _note_key:
 * grade normalized to the common slug ("iv", never "Grade IV" — the view model's display
 * grade varies by subject port, and the un-normalized key filed a TWAU note under
 * "Grade IV" while every sibling store said "iv"; found in the first live export,
 * 2026-08-22). Used for the GET-side lookup; the POST side is normalized by the server. */
export function planNoteKey(subject, grade, chapter) {
  let g = String(grade || "").trim().toLowerCase();
  for (const p of ["grade", "class"]) if (g.startsWith(p)) g = g.slice(p.length).trim();
  g = g.replace(/ /g, "_") || "unknown";
  return `${String(subject || "").trim().toLowerCase()}/${g}/${String(chapter || "").trim()}`;
}

/* All of this teacher's notes for the current year: {note_key: {text, updated_at}}.
 * Returns null when the server is unreachable — callers keep their local cache then. */
export async function fetchPlanNotes() {
  try {
    const d = await getJSON("/plan-notes");
    return d.notes || {};
  } catch {
    return null;
  }
}

/* Save one chapter's note (empty text deletes it — editing IS deleting, §2.4).
 * Resolves {ok:true} on success; {ok:false, stale:true, note} when the server holds a
 * newer copy (the caller should adopt `note`); {ok:false} on any other failure (the
 * local cache still has the text — nothing is lost, the next save retries). */
export async function savePlanNote(subject, grade, chapter, text) {
  if (!subject || !grade || !chapter) return { ok: false };
  try {
    const r = await fetch(`${API}/plan-notes`, withUser({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject, grade, chapter: String(chapter), text: text || "",
        updated_at: new Date().toISOString(),
      }),
    }));
    if (r.status === 409) {
      let note = null;
      try { note = (await r.json())?.detail?.note || null; } catch {}
      return { ok: false, stale: true, note };
    }
    return { ok: r.ok };
  } catch {
    return { ok: false };
  }
}

/* ───────── entitlement (admin architecture Step 5/6, 2026-08-24) ─────────
 * The caller's subscription/trial state, for the disclosure surfaces: the first-run
 * chapter step's coverage line and Prepare Lesson's counter ("2 of 3 free chapters
 * used"). Returns null when unreachable — every caller treats null as "show nothing"
 * (a missing counter must never block a screen). Fields used by the UI: status
 * ('trial'|'active'|...), trial_chapters_used, trial_chapter_cap, trial_chapters,
 * enforced (false in dev → all trial chrome hidden, since nothing is actually gated). */
export async function fetchEntitlement() {
  try {
    return await getJSON("/entitlement");
  } catch {
    return null;
  }
}

/* ───────── which WALL she hit (2026-08-24 on the web; lifted 2026-09-16 for the phone) ─────────
 * A 402 is not an error, and the server's sentence is written FOR HER — it travels to both
 * surfaces unchanged. What the client chooses is the HEADING above it, and it chooses it by
 * reading the sentence, because the sentence is the only thing that knows which of the three
 * walls this is: the trial running out · a subject she has not bought · a subscription that has
 * ended. There is no separate code on the 402 to switch on, and inventing one would put the same
 * fact in two places.
 *
 * ★ LIFTED BECAUSE THE PHONE WAS SHOWING THE WRONG ONE. It hardcoded "Your free chapters are used
 * up" over every 402, so a teacher blocked for a DIFFERENT SUBJECT was told she had used up
 * chapters she had not touched (app. 01 row 47; founder's Q6 answer, 2026-09-16: "mimic web").
 * CLAUDE.md §3 — one rule, one place, both callers calling it. */
export function paywallKicker(message) {
  const m = String(message || "");
  if (/free trial/i.test(m)) return "Free trial ends";
  if (/different subject/i.test(m)) return "Separate subscription";
  return "Subscription ended";
}

/* ───────── what her subscription actually covers ─────────
 * THE BILLING UNIT IS subject·STAGE (stageOfGrade above), and the choosers must offer only
 * what she has bought: post-trial, a paid teacher is shown the classes inside her paid
 * stages and nothing else, with the upsell line below the wheel. `null` means NO LIMIT —
 * trial, unpaid, a "*" grant, or enforcement off — and every caller must read null that way
 * rather than as "nothing allowed".
 *
 * ⚠️ LIVE scopes, not every scope she has ever held (2026-08-26): each subject-stage carries
 * its own expiry, so one may have run out while another runs on. The SERVER derives the list
 * (`live_scopes`); the client compares no dates, the same rule as `lapsed`. `e.scopes` is the
 * fallback for an older API.
 *
 * Lifted out of web/app/page.jsx on 2026-09-15 because the phone needed the same rule and the
 * founder had just found it missing there: "the web app only shows those classes that the
 * teacher has subscribed for … but expo shows all classes". CLAUDE.md §3 — everyone calls it,
 * nobody re-implements it. */
export function entLapsed(e) {
  if (!e) return false;
  return e.lapsed !== undefined ? !!e.lapsed : !!(e.enforced && e.status === "expired");
}
export function paidScopesOf(e) {
  if (!e) return null;
  return (e.enforced && !entLapsed(e) && (e.status === "active" || e.status === "grace"))
    ? (Array.isArray(e.live_scopes) ? e.live_scopes : (e.scopes || []))
    : null;
}
/* The cart's subject → stages map, in ONE round of requests (lifted from web/SubscribeFlow.jsx,
 * 2026-09-16).
 *
 * ★ PARALLEL, NOT A `for await` LOOP (founder, on the handset: "expo shows a little more delay
 * showing 'loading subjects' … something that does not happen on web app"). It was not the
 * phone's code — it was the DISTANCE. Both surfaces ran the same serial loop, one `/subjects`
 * followed by one `/subjects/{s}/grades` per subject; against a dev API on localhost that is
 * imperceptible, and against Render it is six round trips end to end. `Promise.all` makes it two.
 * ⚠️ The lesson generalises: a loop of awaited fetches is invisible in dev and slow in
 * production, and the phone is the only surface that ever talks to production here.
 *
 * A subject whose grades cannot be fetched is OMITTED rather than listed empty — an entry with no
 * stages is a subject she can pick and then find nothing behind. */
const CART_STAGES = ["preparatory", "middle", "secondary"];
export async function subjectStageMap() {
  const d = await getJSON("/subjects");
  const pairs = await Promise.all((d.subjects || []).map(async (s) => {
    try {
      const g = await getJSON(`/subjects/${s}/grades`);
      const stages = new Set((g.grades || []).map(stageOfGrade));
      return [s, CART_STAGES.filter((st) => stages.has(st))];
    } catch { return null; }
  }));
  const map = {};
  pairs.forEach((pair) => { if (pair) map[pair[0]] = pair[1]; });
  return map;
}

/* ── What a SUBSCRIPTION looks like on screen (lifted from web/Settings.jsx, 2026-09-16) ──
 * Lifted for Track D 6b·D, where the phone grew a Subscription & billing screen and would
 * otherwise have retyped all three. CLAUDE.md §3 — everyone calls it, nobody re-implements it.
 *
 * ★ `STAGE_CLASSES` is CONTENT, not a lookup of convenience. The billing unit is teacher ×
 * subject-STAGE, so the class list is a fact OF the stage rather than a choice — and
 * "9 (10 coming soon)" is a promise to a paying teacher. The day class 10 opens it must change
 * in ONE place, or one surface goes on promising it after the other has delivered. */
export const STAGE_CLASSES = { preparatory: "3, 4 & 5", middle: "6, 7 & 8",
                               secondary: "9 (10 coming soon)" };
const VALIDITY_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/* "2027-03-31" → "31-Mar-27". Returns the input unchanged when it is not a date, because a
 * validity she cannot read is still better than a blank where a date should be. */
export const fmtValidity = (iso) => {
  const s = String(iso || "").slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s;
  return `${String(d).padStart(2, "0")}-${VALIDITY_MONTHS[m - 1]}-${String(y).slice(-2)}`;
};
/* One scope ("science/middle", or "*") as the three ledger rows that describe it. */
export const scopeRows = (scope) => {
  if (scope === "*") return { subject: "All subjects", stage: "All stages", classes: "3 to 10" };
  const [subj, stage] = String(scope).split("/");
  return { subject: pretty(subj), stage: pretty(stage), classes: STAGE_CLASSES[stage] || "\u2014" };
};
/* One record per subscription, LATEST EXPIRY FIRST.
 *
 * ★ Every term is exactly one year, so the latest expiry IS the latest purchase and a renewal
 * correctly returns to the top. (If terms ever differ, this needs a real purchase date to sort
 * on — which is the reason this is one function and not two copies.) Ties — the ordinary case
 * of several bought in one checkout — keep CART ORDER, the order she chose them in.
 * ★ `live` comes from the server's `live_scopes`; the date comparison is only the fallback for
 * an older API, and the server is the authority because it honours ARUVI_TODAY, which no client
 * can. An EXPIRED subscription is still returned: she owned it, and its row is the explanation
 * for anything she can no longer prepare there. */
/* ★ NEWEST PURCHASE FIRST (founder, 2026-09-18: "latest top, oldest last"). The order is WHEN
 * SHE BOUGHT IT: the issue time of the newest invoice that lists the scope. A scope with no
 * invoice (a manual grant) falls back to one year before its validity date — every subscription
 * runs a year from purchase — and that fallback is what the sort used alone until now, which put
 * a scope carrying only the account-wide date in the wrong place. `invoices` is optional so a
 * caller without them still gets the old order. Ties keep cart order. */
const yearBefore = (d) => (d && /^\d{4}-/.test(d) ? `${Number(d.slice(0, 4)) - 1}${d.slice(4, 10)}` : "");
export function subsFromEntitlement(e, invoices = null) {
  if (!e) return [];
  const today = new Date().toISOString().slice(0, 10);
  const boughtAt = {};
  (invoices || []).forEach((iv) => (iv.scopes || []).forEach((sc) => {
    const at = String(iv.issued_at || "");
    if (at && (!boughtAt[sc] || at > boughtAt[sc])) boughtAt[sc] = at;
  }));
  return (e.scopes || []).map((scope, i) => {
    const until = (e.scope_valid_until || {})[scope] || e.valid_until || "";
    const liveList = e.live_scopes;
    return {
      scope, until, i, bought: boughtAt[scope] || yearBefore(until),
      live: Array.isArray(liveList) ? liveList.includes(scope)
                                    : !(until && until < today),
    };
  }).sort((a, b) => (b.bought || "").localeCompare(a.bought || "") || a.i - b.i);
}

/* ───── what she HOLDS, as against what she may be OFFERED (founder, 2026-09-17) ─────
 *
 * `paidScopesOf` above answers "which scopes should narrow what this teacher is SHOWN", and it
 * returns null — NO LIMIT — whenever enforcement is off, which is every teacher on Render
 * today. That is the right answer for a filter and the wrong one for a question about her
 * RECORD. "Has she bought Mathematics?" has an answer whether or not the gate is switched on,
 * and asking the filter would come back "no limit", which is not an answer at all.
 * ★ A TRIAL HOLDS NOTHING. Its "*" is a licence to look at everything for three chapters, not a
 * purchase, and reading it as ownership would make every trial subject permanent.
 * ⚠️ LIVE scopes, like everything else here — the server derives them and the client compares no
 * dates. `e.scopes` is the fallback for an older API, and on that path an expired scope can
 * still be counted; that is the same trade every other reader of this field makes. */
export function heldScopesOf(e) {
  if (!e || e.status === "trial") return [];
  const live = Array.isArray(e.live_scopes) ? e.live_scopes : (e.scopes || []);
  return live.filter((s) => s && s !== "*");
}
/* Does she hold ANY stage of this subject? */
export const holdsSubject = (heldScopes, subjectName) =>
  (heldScopes || []).some((s) => String(s).split("/")[0] === subjectSlug(subjectName));
/* The stages of ONE subject she holds, as stage slugs. */
export const heldStagesFor = (heldScopes, subjectName) => {
  const slug = subjectSlug(subjectName);
  return [...new Set((heldScopes || [])
    .filter((s) => String(s).split("/")[0] === slug)
    .map((s) => String(s).split("/")[1]).filter(Boolean))];
};
/* The classes she holds for one subject — her held stages, intersected with the classes Meyy
   actually has content for (`fetchSupportedGrades`), so this can never offer a class that would
   open on an empty shelf. Uppercase Roman, in the catalogue's own order. */
export const heldClassesFor = (heldScopes, subjectName, supportedGrades) => {
  const stages = new Set(heldStagesFor(heldScopes, subjectName));
  if (!stages.size) return [];
  return (supportedGrades || []).map((g) => String(g).toUpperCase())
    .filter((g) => stages.has(stageOfGrade(g)));
};

/* The stages she may be offered classes in, for ONE subject. null = no limit. */
export function allowedStagesFor(paidScopes, subjectName) {
  if (!Array.isArray(paidScopes) || paidScopes.includes("*")) return null;
  const slug = subjectSlug(subjectName);
  return new Set(paidScopes.filter((s) => String(s).split("/")[0] === slug)
    .map((s) => String(s).split("/")[1]));
}

/* ───────── period apportionment — ONE method, defined once (2026-08-13) ─────────
 * Largest-remainder: split `total` whole periods across `weights`, giving every
 * remainder-ranked chapter one extra until the total is exactly used. This is the method
 * `genon/master_plan.py` used to compute each chapter's `recommended_periods`, and the one
 * `aruvi_core/allocate.py` uses server-side — so a client figure computed this way matches
 * both the number the canonicals were AUTHORED at and the number the backend would allocate.
 *
 * IT LIVES HERE BECAUSE DIVIDING AND ROUNDING PER CHAPTER IS NOT THE SAME THING, and the
 * difference reached a teacher. PrepareLesson used to compute its own suggestion as
 * `Math.round(weight / ΣweightS × budget)`, independently per chapter. On english VI ch 8 that
 * is `16.5 / 182.5 × 140 = 12.658 → 13`, where the master plan says 12: eleven chapters were
 * entitled to the +1 and ch 8's .658 remainder came twelfth. Two consequences, both real:
 * the column summed to 142 against a 140 budget, and — because the chapter's TOP canonical is
 * authored at 12 — a teacher accepting the default asked for 13 against a 12-period library and
 * was served the "above the top" SURRENDER path. It affects 40 of the master plan's 340
 * chapters (11.8%), across five subjects. Any screen suggesting periods must call this, never
 * re-derive it. (ARV-D-142.) */
export function largestRemainder(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!total || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const base = raw.map(Math.floor);
  const rem = total - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const out = base.slice();
  for (let k = 0; k < rem; k++) out[order[k % order.length].i] += 1;
  return out;
}

/* ───────── ONE distribution of her year across the chapters (WALK-A-074, 2026-09-24) ─────────
 *
 * ★ WHY THIS EXISTS. Prepare and Year Plan both answer "how many periods does Aruvi suggest for
 * this chapter?", both from her annual budget, both by effort weight, both through
 * largestRemainder — and they DISAGREED BY ONE PERIOD (social_sciences IX: ch 5 suggested 22 on
 * Prepare and 21 on Year Plan; ch 3, 13 against 12). Not a rounding curiosity: Prepare then fired
 * its own boundary message against its own recommendation, so the founder was offered 22 and told
 * in the same breath that one period of it was surplus and would return to her budget. A pane
 * contradicting itself in consecutive sentences reads as a product that cannot count.
 *
 * ★ THE CAUSE WAS THE BUCKET SET, NOT THE MATHS. Year Plan keeps every chapter the API returns —
 * placeholders included, marked "Book awaited" — and gives each its own bucket. Prepare FILTERS
 * placeholders out of its picker (there is nothing to generate from), then reconstructed their
 * weight as ONE synthetic bucket from syllabus_total_weight, distributed over [...listed, missing]
 * and discarded it. Those two are equal only if largest-remainder were invariant under AGGREGATING
 * buckets, and it is not: the leftover whole periods go to the largest fractional remainders, and
 * three placeholders carrying 0.4 each behave nothing like one bucket carrying 1.2.
 *
 * ★ SO THE RULE IS: distribute across ALL chapters INDIVIDUALLY, placeholders and all. A chapter
 * whose book has not shipped still holds its share of her year — that is why the API budgets it —
 * and a screen that cannot show it simply filters it out AFTERWARDS. Callers display what they
 * like; they no longer each decide what the denominator is.
 *
 * ⚠️ This is the third time one arithmetic written twice has cost this codebase: the 2026-08-21
 * first-run defect (Year Plan said 14 where the chapter step said 19), ppw_from_annual mirrored
 * across JS and Python, and now this. The pattern is always the same — two callers, one formula,
 * a quiet difference in the inputs. Keep it here, and keep the test that pins the two together.
 */
export function suggestedPeriodsByChapter(chapters, budget) {
  const out = {};
  const list = Array.isArray(chapters) ? chapters : [];
  const b = Number(budget);
  if (!b || b <= 0 || !list.length) return out;
  const weights = list.map((c) => (Number(c && c.weight) > 0 ? Number(c.weight) : 0));
  if (weights.reduce((a, w) => a + w, 0) <= 0) return out;
  const dist = largestRemainder(b, weights);
  list.forEach((c, i) => { out[c.chapter_number] = dist[i]; });
  return out;
}

/* Annual budget in PERIODS for a subject·grade, read from the CANONICAL readiness.subjects[]
 * (not the active-subject projection). Mirrors Readiness.computeBudget / Allocate's copy so the
 * Prepare screen's budget meter and Allocate agree. budget is { gradeIdx: {method, value} }:
 *   periods → value directly; weeks → weeklyPeriods×value; days → weeklyPeriods×(days/6);
 *   estimate/auto/none → weeklyPeriods×30. weeklyPeriods = grid cells for that grade ÷ #sections,
 *   falling back to the grade's periods_per_week (post calendar-purge profiles). null when the
 *   subject·grade isn't in the profile or no basis can be derived. */
/* ★ The weeks Aruvi assumes in a teaching year, and the two readings derived from it
   (2026-08-27). ONE definition, here, because three screens need it — first run seeds
   periods-a-week from it, the profile's budget step shows the implied weeks, and the check
   window displays the ppw. It was about to become a fourth byte-identical copy, which is the
   trap `stageOfGrade` was lifted out of earlier the same day (CLAUDE.md §3: nobody
   re-implements the mapping).

   30 is not a new assumption — it is the one already hardcoded in annualBudgetPeriods below,
   in TeachingProfile's ESTIMATE_WEEKS and in api/main.py's provisioning fallback. Naming it
   makes it honest rather than introducing it.

   ⚠️ Derive ppw from a CALIBRATED annual figure (the master plan's annual_budget_periods),
   never from a stored budget record: with no master-plan row the record is itself ppw × 30, so
   round(ppw × 30 / 30) = ppw — a fixed point that silently justifies whatever it already held. */
export const ESTIMATE_WEEKS = 30;
export const ppwFromAnnual = (annual) =>
  annual > 0 ? Math.max(1, Math.round(annual / ESTIMATE_WEEKS)) : null;
export const weeksFromAnnual = (annual, ppw) =>
  annual > 0 && ppw > 0 ? Math.round(annual / ppw) : null;

export function annualBudgetPeriods(readiness, subjectSlugArg, gradeSlugArg) {
  const subs = (readiness && readiness.subjects) || [];
  const slugify = (n) => (n || "").toLowerCase().replace(/ /g, "_");
  const sub = subs.find((s) => slugify(s.name) === subjectSlugArg);
  if (!sub) return null;
  const gi = (sub.grades || []).findIndex((g) => (g.grade || "").toLowerCase() === gradeSlugArg);
  if (gi < 0) return null;
  const b = (sub.budget || {})[String(gi)];
  // weekly periods for this grade: marked grid cells ÷ section count, else periods_per_week.
  const gridG = (sub.grids || [])[gi] || [];
  const secCount = gridG.length || 1;
  let cells = 0;
  gridG.forEach((row) => (row || []).forEach((v) => { if (v != null && v >= 0) cells++; }));
  let weeklyPeriods = Math.round(cells / secCount);
  if (!weeklyPeriods) weeklyPeriods = Number((sub.grades[gi] || {}).periods_per_week) || 0;
  if (!b) return weeklyPeriods ? weeklyPeriods * 30 : null;      // no budget set → estimate
  if (b.method === "periods") return b.value;
  if (b.method === "weeks") return weeklyPeriods * b.value;
  if (b.method === "days") return Math.round(weeklyPeriods * (b.value / 6));
  return weeklyPeriods ? weeklyPeriods * 30 : null;             // estimate / auto / unknown
}

/* ───────── subject·grade coverage (single source of truth) ─────────
 * Which grades Aruvi actually has chapter content for, per subject (Science → VI–IX, TWAU →
 * III–V, …). The authority is the backend (GET /subjects/{slug}/grades, derived from the chapter
 * dirs). BOTH the setup flow (Readiness) and the editor (MyClasses) must restrict grade choices
 * to this — defined ONCE here so the rule can't drift between the two screens. */
export const ALL_GRADES = ["III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export const subjectSlug = (name) => (name || "").toLowerCase().replace(/ /g, "_");
/* ★ ITS PAIR, LIFTED 2026-09-17. `subjectSlug` has always lived here; `gradeSlug` was copied into
   four screens (two per surface) and into nothing shared — so `lib/tour.js` importing it from
   here got `undefined`, which is a runtime TypeError that no parse and no scope check can see.
   One name, one definition: a helper that half the app already agrees on belongs beside its twin. */
export const gradeSlug = (g) => (g || "").toLowerCase();

// Module-level cache so we fetch each subject's supported grades at most once per session.
const _supportedGradesCache = {};   // { slug: ["VI","VII",…] (uppercase Roman) }
export async function fetchSupportedGrades(subjectName) {
  const slug = subjectSlug(subjectName);
  if (!slug) return [];
  if (_supportedGradesCache[slug]) return _supportedGradesCache[slug];
  try {
    const d = await getJSON(`/subjects/${slug}/grades`);
    const ups = (d.grades || []).map((g) => String(g).toUpperCase());
    _supportedGradesCache[slug] = ups;
    return ups;
  } catch {
    return [];
  }
}

/* Regenerate the denormalized "active subject" projection from a persisted readiness
 * profile. The API stores ONLY the canonical subjects[] (CLOUD_DATA_MODEL.md §2.1); the
 * current consumers (MyPlans.classesFromReadiness, Allocate.weeklyRatioFromReadiness)
 * still read the projection keys (grades/durations/grids/budget). This mirrors the tail
 * of Readiness.jsx buildPayload() so a rehydrated profile is byte-for-byte what those
 * consumers expect — keeping the projection derived-on-read, never persisted.
 * `profile` is {subjects:[...]}; `activeIdx` selects which subject to project (default 0). */
export function projectReadiness(profile, activeIdx = 0) {
  const subjects = (profile && profile.subjects) || [];
  if (!subjects.length) return null;
  const i = Math.min(Math.max(activeIdx, 0), subjects.length - 1);
  const active = subjects[i];
  return {
    subjects,
    activeSubjectIndex: i,
    // derived active-subject projection (NOT source of truth):
    subject: active.name,
    grades: active.grades,
    durations: active.grades.map((gr) => gr.durations), // per-grade durations
    grids: active.grids,
    budget: active.budget,
  };
}


/* ── the name a Prepare press would give its plan (WALK-A-070, 2026-09-24) ─────────────
 * Mirrors api/data.py genon_plan_filename + norm_matrix EXACTLY: rows aggregated by duration,
 * zero rows dropped, longest duration first, "{d}m{count}" joined by "-"; then the server's
 * per-chapter suffix ("_e{engine}_c{canonical version}.json" from /genon/.../chapters).
 * Returns "" when the suffix is unknown (an older API), so callers treat it as "can't tell"
 * and leave the button live — the safe direction. */
export function normMatrix(rows) {
  const agg = {};
  (rows || []).forEach((r) => {
    const d = parseInt(r && r.duration, 10), c = parseInt(r && r.count, 10);
    if (d > 0 && c > 0) agg[d] = (agg[d] || 0) + c;
  });
  return Object.keys(agg).map(Number).sort((a, b) => b - a).map((d) => `${d}m${agg[d]}`).join("-");
}
export function genonPlanFilename(chapterNumber, rows, suffix) {
  const n = parseInt(chapterNumber, 10);
  const m = normMatrix(rows);
  if (!suffix || !Number.isFinite(n) || !m) return "";
  return `ch_${String(n).padStart(2, "0")}_${m}${suffix}`;
}
