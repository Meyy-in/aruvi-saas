/* ───────── phone boot for @aruvi/shared (Track D step 2, 2026-09-11) ─────────
 *
 * The phone twin of web/app/lib/shared-setup.js: installs the three things the shared
 * package leaves to the platform. Imported ONCE, first, by app/_layout.jsx — module
 * evaluation order does the rest, exactly as on the web.
 *
 *   · storage   → expo-sqlite/kv-store, which is SYNCHRONOUS (getItemSync …) and ships inside
 *                 Expo Go — so the founder's first screen needs no dev build. The plan named
 *                 MMKV; MMKV is a native module Expo Go does not carry, so it waits for the
 *                 development-build milestone and is then a one-adapter swap here. Both keep
 *                 the contract that matters (assessment §3): reads during render, never a
 *                 promise.
 *   · API       → EXPO_PUBLIC_API_URL (mobile/.env.local; Render, or the Mac's LAN IP:8000).
 *   · auth      → a supabase-js client whose session storage is the SAME kv-store, so the
 *                 shared accessToken() fallback (reads `sb-…-auth-token` through the shim)
 *                 works on a cold start here too. detectSessionInUrl is off — there is no URL
 *                 to detect from; the OTP flow hands the session back directly. */
import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { configure } from "@aruvi/shared/config";
import { setStorage, webStorage } from "@aruvi/shared/storage";
import { configureAuth, accessToken } from "@aruvi/shared/auth";

/* ★ THE WEB TARGET (2026-09-13). `npx expo start` → `w` renders this same app in a browser via
 * react-native-web, which is how parity with the web app is CHECKED before a build reaches the
 * founder's phone (Claude in Chrome opens localhost:8081 and localhost:3000 side by side at
 * 390px). It is a verification surface, not a product: react-native-web is not pixel-identical
 * to iOS, and the phone stays the sign-off. On that target the on-device SQLite store does not
 * exist, so storage is the browser's localStorage through the shared webStorage() adapter — the
 * very adapter the web app uses — and the Supabase client keeps its own default (localStorage). */
export const IS_WEB = Platform.OS === "web";
export const kv = IS_WEB
  ? webStorage()
  : (() => {
      const Storage = require("expo-sqlite/kv-store").default;
      return {
        getItem: (k) => Storage.getItemSync(k),
        setItem: (k, v) => Storage.setItemSync(k, String(v)),
        removeItem: (k) => Storage.removeItemSync(k),
        keys: () => Storage.getAllKeysSync(),
      };
    })();
setStorage(kv);

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/+$/, "");
configure({ apiBase: API_URL || "http://localhost:8000", accessToken });

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabase = URL && KEY
  ? createClient(URL, KEY, {
      auth: {
        ...(IS_WEB ? {} : { storage: {   // supabase-js accepts a sync adapter; it awaits whatever comes back
          getItem: (k) => kv.getItem(k),
          setItem: (k, v) => kv.setItem(k, v),
          removeItem: (k) => kv.removeItem(k),
        } }),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
configureAuth({ client: supabase });

/* supabase-js refreshes the token on a timer only while the app is in the foreground; tell it
 * when that changes (the documented Expo pattern), so a teacher returning after an hour has a
 * live bearer rather than a 401 on her first tap. */
if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
  });
}

export const authConfigured = () => !!supabase;
