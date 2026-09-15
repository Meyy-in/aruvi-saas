/* Moved to packages/shared/src/profile.js (Track D step 5d F2, 2026-09-15) — this is the web
   import path. Lifted out of components/TeachingProfile.jsx so the phone composes byte-identical
   records: the fingerprint compares what a teacher can change, so a record spelled differently
   on one surface would read back as a MISMATCH and tell her work was lost that was merely
   spelled differently. */
import "./shared-setup";
export * from "@aruvi/shared/profile";
