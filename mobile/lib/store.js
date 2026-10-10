/* ───────── In-app purchase through RevenueCat (2026-10-09) ─────────
 *
 * ★ SAME DEAL AS THE WEBSITE: pay once for ONE YEAR per subject-stage, no auto-renew. The store
 * sheet (Apple / Google) takes the money; RevenueCat validates the receipt and tells Meyy's
 * server; the server grants the year. This file is the only place the SDK is touched.
 *
 * ★ EXPO GO HAS NO STORE. `react-native-purchases` is a native module, so it exists only in a
 * development/production build. In Expo Go the require throws and `storeAvailable()` is false;
 * the wizard then shows its "preview build" note instead of a Pay button that cannot work.
 *
 * Keys: EXPO_PUBLIC_REVENUECAT_IOS_KEY / _ANDROID_KEY — RevenueCat's PUBLIC SDK keys (designed to
 * ship in an app; the secret key lives on Render only). Set in mobile/eas.json `env`.
 *
 * Identity: RevenueCat's app_user_id is the id the SERVER hands back from /payments/store/start
 * (her mobile number as the API knows it) — never a locally computed one, so the webhook's
 * app_user_id → account mapping is the server's own. */
import { Platform } from "react-native";

let Purchases = null;
try {
  // eslint-disable-next-line global-require
  Purchases = require("react-native-purchases").default;
} catch { Purchases = null; }

const KEY = Platform.OS === "ios"
  ? (process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "")
  : (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "");

let configuredFor = null;

/* Is a store purchase possible in THIS build? (native module present + a key for this OS) */
export function storeAvailable() {
  return !!(Purchases && KEY && Platform.OS !== "web");
}

/* Configure once, then log in as the server's app_user_id. Idempotent per id. */
export async function storeLogin(appUserId) {
  if (!storeAvailable()) throw new Error("store_unavailable");
  if (configuredFor === null) {
    Purchases.configure({ apiKey: KEY, appUserID: appUserId });
    configuredFor = appUserId;
  } else if (configuredFor !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredFor = appUserId;
  }
}

/* Buy ONE product (one subject-stage). Resolves {ok:true, transactionId} on success,
   {ok:false, cancelled:true} when she backed out of the sheet; throws on anything else with
   `message` in her words. */
export async function storeBuy(productId) {
  if (!storeAvailable()) throw new Error("store_unavailable");
  const category = Purchases.PRODUCT_CATEGORY ? Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION : undefined;
  let products = [];
  try {
    products = await Purchases.getProducts([productId], category);
  } catch { products = []; }
  if (!products || !products.length) {
    // Google needs the product ACTIVE and the build from a testing track; Apple needs the
    // product approved for sandbox. Say so without jargon.
    throw new Error("This subject isn’t available in the store yet. Please try again later.");
  }
  try {
    const out = await Purchases.purchaseStoreProduct(products[0]);
    return { ok: true, transactionId: out && out.transaction ? out.transaction.transactionIdentifier : "" };
  } catch (e) {
    if (e && e.userCancelled) return { ok: false, cancelled: true };
    const msg = (e && (e.message || e.underlyingErrorMessage)) || "The store couldn’t complete the purchase.";
    throw new Error(msg);
  }
}

/* Restore purchases: ask the store again for what this account bought (new phone, reinstall). */
export async function storeRestore() {
  if (!storeAvailable()) throw new Error("store_unavailable");
  try { await Purchases.restorePurchases(); } catch { /* the server sync below is the truth */ }
}

/* The store's own price for a product, in her currency, for the Pay screen — or null. */
export async function storePrice(productId) {
  if (!storeAvailable()) return null;
  try {
    const category = Purchases.PRODUCT_CATEGORY ? Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION : undefined;
    const p = await Purchases.getProducts([productId], category);
    return p && p[0] ? { price: p[0].price, priceString: p[0].priceString, currency: p[0].currencyCode } : null;
  } catch { return null; }
}
