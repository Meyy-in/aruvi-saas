/* ★ WHICH BUILD IS SHE ON (WALK-A-136, founder 2026-09-29). About Meyy is gone; what it was
 * for — telling support which build a teacher is running — is a quiet line at the foot of
 * Settings and a field in every Support message's context. The version is package.json's;
 * a build id is shown only when the deploy sets NEXT_PUBLIC_BUILD_ID. */
import pkg from "../../package.json";

export const APP_VERSION = pkg.version || "";
export const APP_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || "";
export const versionLine = () =>
  `Meyy ${APP_VERSION}${APP_BUILD ? ` · build ${APP_BUILD}` : ""}`;
