/* ───────── where the brand bar ENDS, for windows drawn over the app (WALK-A-148, 2026-09-29) ─────────
 *
 * Founder, Pixel 7: Add › Class / Section / Periods a week / Annual budget — the window "hides part of
 * the top bar". Those windows (AttachSheet's `Sheet`, the chapter-notes window) are React Native
 * `Modal`s with `statusBarTranslucent`, so they are laid out from the TOP OF THE SCREEN, and they
 * placed themselves at `insets.top + BAR_CONTENT_H` — a constant measured on the iPhone at the
 * design text size. Two things break that on a phone that is not the iPhone at Standard:
 *   · the bar is taller when its text scales (name, "Log out", "lesson studio" all grow), and
 *   · where Android draws the app BELOW an opaque status bar, `insets.top` is 0 inside the app
 *     while the translucent Modal still starts under the status bar — so it sits that much high.
 * So the shell publishes the bar's MEASURED height (the same onLayout Ask Meyy already uses), and a
 * Modal adds the status bar only where the app's own insets did not already count it.
 * Before the first measurement it falls back to the old constant, so nothing regresses. */
import { useEffect, useState } from "react";
import { Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BAR_CONTENT_H } from "../components/Bar";

let barH = 0;
const listeners = new Set();

export function setBarHeight(h) {
  const v = Math.round(h || 0);
  if (!v || v === barH) return;
  barH = v;
  listeners.forEach((fn) => { try { fn(v); } catch {} });
}

/* The bar's bottom edge measured from the top of the SCREEN — what a statusBarTranslucent Modal
   needs as its top offset. */
export function useBarBottom() {
  const insets = useSafeAreaInsets();
  const [h, setH] = useState(barH);
  useEffect(() => {
    listeners.add(setH);
    if (barH !== h) setH(barH);
    return () => { listeners.delete(setH); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const top = insets.top || 0;
  const below = Platform.OS === "android" && top === 0 ? (StatusBar.currentHeight || 0) : 0;
  return (h || top + BAR_CONTENT_H) + below;
}
