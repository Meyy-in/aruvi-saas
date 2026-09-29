/* ★ WHICH BUILD IS SHE ON (WALK-A-136, founder 2026-09-29) — the phone's twin of
 * web/app/lib/version.js. About Meyy is gone; the version is a quiet line at the foot of the
 * Settings list and rides in every Support message's context. Version from app.json; the build
 * is the store build number (iOS buildNumber / Android versionCode) once a native build sets one.
 * Expo Go reports none, so the line then reads just "Meyy 0.1.0". */
import Constants from "expo-constants";
import { Platform } from "react-native";

const cfg = Constants.expoConfig || {};
export const APP_VERSION = cfg.version || "";
export const APP_BUILD = String(
  (Platform.OS === "ios" ? cfg.ios && cfg.ios.buildNumber : cfg.android && cfg.android.versionCode)
  || "");
export const versionLine = () =>
  `Meyy ${APP_VERSION}${APP_BUILD ? ` · build ${APP_BUILD}` : ""}`;
