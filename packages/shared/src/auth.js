/* ───────── Supabase Auth, the app-agnostic half (Track B 2026-09-09; shared 2026-09-11) ─────────
 *
 * The API accepts two credentials, never both (api/config.AUTH_PROVIDER): the X-Aruvi-User
 * dev header, or a Supabase access token as `Authorization: Bearer`. This module owns the
 * client side of the second one and is deliberately small:
 *   · `configureAuth({ client })` — the app hands in a supabase-js client it created with
 *     ITS storage (web: localStorage, the supabase-js default; phone: an MMKV adapter and
 *     detectSessionInUrl:false). This package imports no Supabase code, so the two apps can
 *     pin their own versions and the web build never bundles a phone dependency.
 *   · `authEnabled()` — true once a client is installed. Without one the front door keeps
 *     its honest 0000 stub and withUser() sends the header, so a local `npm run dev` against
 *     a header-mode API is unchanged.
 *   · `sendOtp` / `verifyOtp` — Supabase issues, delivers (via the SMS provider) and checks
 *     the code. The client never sees the code's truth, only the verdict. Both resolve to ""
 *     on success or the SENTENCE TO SHOW — the wording is the product's, so it lives here.
 *   · `accessToken()` — SYNCHRONOUS, because withUser() is (every fetch helper builds its
 *     headers inline). supabase-js keeps the session in its storage and refreshes it in the
 *     background; we mirror the current token into a module variable from onAuthStateChange,
 *     and fall back to reading supabase-js's own storage key (`sb-<ref>-auth-token`) through
 *     the storage shim so the very first call after a cold start is not empty — which works
 *     on the phone only if the client was given the SAME storage the shim wraps.
 *   · `signOutAuth()` — ends the Supabase session; the app calls it beside clearUser().
 *
 * The IDENTITY the app runs under is still the 10-digit mobile: the API derives it from the
 * token's verified phone claim and hands it back from /onboarding/verified, and the front
 * door uses THAT (not the number she typed) for setUser — one source, server-side. */
import { storage } from "./storage.js";

export const OTP_LEN = 6;   // Supabase's default code length

/* ★ HOW LONG A CODE LIVES — **60s (founder, 2026-09-17), AND THE SERVER MUST AGREE.**
   ⚠️ **THIS NUMBER IS A CLAIM ABOUT SUPABASE, NOT A SETTING**, and the two have already
   disagreed once. It was first written as 60 by guess; the project was then ASKED
   (`GET https://api.supabase.com/v1/projects/<ref>/config/auth`) and answered
   **`"sms_otp_exp": 300`** — so for a while the screen would have killed a code the server was
   still accepting, telling her to resend four minutes early. That is the failure this warning
   exists for: **a number describing something else's behaviour is a fact to look up, not a
   decision to take.**
   ★ The founder has since chosen 60 deliberately, so the SERVER was changed to match rather
   than the other way round. ⚠️ **IF `sms_otp_exp` IS NOT 60 ON THE PROJECT, THIS IS A LIE.**
   Verify, do not assume:
     curl -s -H "Authorization: Bearer $PAT" \
       https://api.supabase.com/v1/projects/<ref>/config/auth | tr ',' '\n' | grep sms_otp_exp
   ⚠️ 60s is TIGHT on a slow network — an Indian SMS can take 20-30s to land. That is why the
   resend below unlocks at 30s rather than at expiry: she must have a way out before the code
   dies, not only after. */
export const OTP_TTL_MS = 60 * 1000;

/* ★ HOW LONG BEFORE SHE MAY ASK FOR ANOTHER — and why this constant had to exist the moment the
   one above changed. Supabase refuses a second SMS to the same number inside `sms_max_frequency`
   (default 60s), so "Send a new code" before then comes back refused.
   ⚠️ **THE 60→300 CORRECTION QUIETLY CREATED A WORSE BUG THAN THE ONE IT FIXED.** The front doors
   were written to hide Resend until the code EXPIRES — correct at a 60-second life, where the
   wait is a moment. At FIVE MINUTES it strands her: the SMS never arrives, and the screen offers
   her nothing at all for five minutes. **A rule that is kind at one duration can be cruel at
   another, and changing the duration is exactly when nobody re-reads the rule.**
   ★ So the offer is gated on THIS, not on expiry: nothing to press early, available part-way
   through, and the only thing left once the code is dead.
   ⚠️ **IT MUST STAY BELOW `sms_otp_exp`, OR IT NEVER SHOWS AT ALL** — equal values put the
   unlock and the expiry on the same instant, and a teacher whose SMS never arrived sits the
   whole minute with nothing to press.
   ★ **THIS IS OURS, NOT THE SERVER'S.** The project was asked and answers `sms_max_frequency: 5`,
   so Supabase would honour a resend after five seconds. We wait 30 anyway, for two reasons it is
   worth stating rather than rediscovering: a resend offered before the first SMS has realistically
   landed (20-30s on an Indian network) just sends a second message she does not need, and the
   project is capped at **30 SMS per hour** — a beta with a handful of testers can spend that on
   impatience alone. ⚠️ So this is a DELIBERATE delay, not a mirror of the server's limit; if the
   cap is ever raised this is still the number to think about, not `sms_max_frequency`. */
export const OTP_RESEND_LOCK_MS = 30 * 1000;

/* ★ THE TWO THINGS A REJECTED CODE CAN MEAN, AND WHY THE SERVER CANNOT TELL US WHICH.
   Supabase answers BOTH a mistyped code and a dead one with the same sentence — "Token has
   expired or is invalid" — so the old `/expired/i` test matched a teacher who had simply fat-
   fingered a digit and told her to tap Resend (founder, 2026-09-17: "when wrong code is put for
   otp, it says 'code has expired'"). It was reading the word "expired" out of a message that
   means "expired OR invalid".
   ★ **SO THE CALLER DECIDES, BY THE CLOCK.** A rejection while the timer is still running is a
   WRONG CODE; a rejection after it is a DEAD one — and once it is dead the screen stops offering
   to verify at all and offers only Resend. `verifyOtp` never guesses again: it reports that the
   code was refused, and the surface that owns the countdown supplies the words. */
export const OTP_WRONG = "That code didn't match. Please check and try again.";
export const OTP_EXPIRED = "That code has expired — tap Resend to get a new one.";

let client = null;
let token = "";

export function configureAuth({ client: c } = {}) {
  client = c || null;
  token = "";
  if (!client) return;
  try {
    client.auth.getSession().then(({ data }) => { token = data?.session?.access_token || ""; }).catch(() => {});
    client.auth.onAuthStateChange((_event, session) => { token = session?.access_token || ""; });
  } catch { /* a client without auth — nothing to mirror */ }
}

export const authEnabled = () => !!client;

/* The current access token, or "" — synchronous by contract (see the header). */
export function accessToken() {
  if (!client) return "";
  if (token) return token;
  try {
    const k = storage.keys().find((x) => x.startsWith("sb-") && x.endsWith("-auth-token"));
    if (k) {
      const s = JSON.parse(storage.getItem(k) || "null");
      token = (s && s.access_token) || "";
    }
  } catch {}
  return token;
}

const e164 = (mobile10) => `+91${String(mobile10 || "").replace(/\D/g, "")}`;

/* Ask Supabase to send the OTP. Resolves to "" on success, or the sentence to show. */
export async function sendOtp(mobile10) {
  if (!client) return "Sign-in service is not configured.";
  const { error } = await client.auth.signInWithOtp({ phone: e164(mobile10) });
  if (!error) return "";
  if (/rate|too many|limit/i.test(error.message)) return "Too many attempts — please wait a minute and try again.";
  return "Couldn't send the OTP right now. Please try again.";
}

/* Check the code. Resolves to "" on success (the session is now live), else the sentence. */
export async function verifyOtp(mobile10, code) {
  if (!client) return "Sign-in service is not configured.";
  const { data, error } = await client.auth.verifyOtp({ phone: e164(mobile10), token: String(code || ""), type: "sms" });
  if (error) {
    /* ⚠️ Do NOT re-introduce a `/expired/i` test here — see OTP_WRONG above. Supabase says
       "Token has expired or is invalid" for both cases, so the word carries no information and
       reading it blamed the network for the teacher's typo. The only honest signal is the
       caller's own clock; a rate-limit or outage still speaks for itself. */
    if (/rate|too many/i.test(error.message)) {
      return "Too many attempts just now — wait a moment and tap Resend.";
    }
    return OTP_WRONG;
  }
  token = data?.session?.access_token || token;
  return "";
}

export async function signOutAuth() {
  token = "";
  if (!client) return;
  try { await client.auth.signOut(); } catch {}
}

/* Identity headers for the few fetches that run BEFORE setUser (front-door subscribe path:
 * Agreement, SubscribeFlow). Bearer when a Supabase session exists, else the dev header —
 * the same rule withUser() applies for signed-in calls. */
export function authHeaders(userId) {
  const t = accessToken();
  if (t) return { Authorization: `Bearer ${t}` };
  return userId ? { "X-Aruvi-User": userId } : {};
}
