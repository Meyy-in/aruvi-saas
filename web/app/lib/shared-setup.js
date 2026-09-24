/* ───────── web boot for @aruvi/shared (Track D step 1, 2026-09-11) ─────────
 *
 * The client logic that used to live in this folder now lives in packages/shared and runs
 * on the phone too. It knows nothing about browsers: this module installs the three things
 * the web supplies, and every lib/*.js wrapper imports it FIRST so the install has happened
 * before any shared function runs, whichever wrapper a component imported.
 *   · storage      → window.localStorage (SSR: the in-memory stand-in; nothing renders from
 *                    it there anyway — every cache is read on the client after mount)
 *   · API          → NEXT_PUBLIC_API_URL when set (web/.env.local — e.g. the deployed
 *                    https://meyy-api.onrender.com); otherwise the host the page loaded
 *                    from, so a plain `npm run dev` works on localhost and on the Mac's LAN
 *                    IP (phone testing over WiFi) with no hand-edited IP per session
 *   · accessToken  → the shared auth module's mirror of the supabase-js session, whose
 *                    client is created here when NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set */
import { createClient } from "@supabase/supabase-js";
import { configure } from "@aruvi/shared/config";
import { setStorage, webStorage } from "@aruvi/shared/storage";
import { configureAuth, accessToken } from "@aruvi/shared/auth";

setStorage(webStorage());

configure({
  apiBase:
    (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000"),
  accessToken,
});

/* ★ ONE PLACE WHERE A REFUSED SESSION IS NOTICED (WALK-A-077, 2026-09-24).
 *
 * A 401 is the server refusing this session; it is NOT a network failure. The rule was already
 * written down in account.js ("never fall back to a cached identity for a refused one") and
 * honoured there — but plans.js's catch treated a refusal exactly like being offline and
 * returned the stored listing, and every other caller swallows its own error locally
 * (`.catch(() => setPlans([]))`, seven of them). So a teacher whose session had expired went on
 * reading her own device copy while every write failed silently, with nothing to tell her why
 * her work was not saving. Walked and confirmed at 05.32.
 *
 * ⚠️ THE FIX DOES NOT BELONG IN THOSE CATCHES. There are 22 raw fetches in the components and 5
 * more in the shared package; writing the rule into each is how one rule becomes twenty-seven
 * and drifts — the mistake this codebase has already paid for three times (the 14-vs-19 defect,
 * ppw_from_annual mirrored across two languages, and the Prepare/Year-Plan split of WALK-A-074).
 * It is noticed ONCE, here, at the only point every call passes through: the fetch itself.
 * The wrapper is installed beside the other seams for the same reason they are — this module is
 * what the web supplies to shared code, and it runs before anything else does.
 *
 * Scope is deliberately narrow: only responses from OUR API base, so a 401 from Supabase's own
 * token endpoint (which supabase-js handles by refreshing) can never sign her out. The handler
 * is installed by the shell; until it is, a refusal is simply remembered and replayed on
 * install, so a 401 during the very first paint is not lost. */
let onRefused = null;
let refusedBeforeInstall = false;

export function onSessionRefused(fn) {
  onRefused = fn;
  if (refusedBeforeInstall && fn) { refusedBeforeInstall = false; fn(); }
}

if (typeof window !== "undefined" && !window.__meyyFetchWrapped) {
  window.__meyyFetchWrapped = true;
  const base =
    (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "") ||
    `http://${window.location.hostname}:8000`;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const r = await original(input, init);
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (r.status === 401 && base && url.startsWith(base)) {
        if (onRefused) onRefused();
        else refusedBeforeInstall = true;
      }
    } catch {
      /* Never let the notice break the response it is riding on. */
    }
    return r;
  };
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
if (URL && KEY && typeof window !== "undefined") {
  configureAuth({ client: createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } }) });
}
