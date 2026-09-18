/* The web import path for the shared readiness store (2026-09-18) — the phone has read it since
   Track D step 3; the web now does too, so a teacher who opens Meyy on a flaky connection sees
   HER classes from the device copy instead of the first-run welcome screen. */
import "./shared-setup";
export * from "@aruvi/shared/readiness";
