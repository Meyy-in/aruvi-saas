/* The shared plan-listing store (packages/shared/src/plans.js, 2026-09-14) — this is the web
 * import path. Importing shared-setup here guarantees localStorage is installed before the
 * store's synchronous first read runs, whatever order a component's imports happen to be in. */
import "./shared-setup";
export * from "@aruvi/shared/plans";
