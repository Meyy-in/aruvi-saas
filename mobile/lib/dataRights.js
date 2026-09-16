/* ───────── Did she take her copy? (6b·E4 / H5) ─────────
 *
 * ★ ONE FACT, TWO SCREENS. On the web both live inside the same `Settings` component, so
 * `didDownload` is component state; on the phone "Your data & export" and the delete flow are
 * separate routes, so the fact needs somewhere to sit between them.
 *
 * ★ SESSION-SCOPED ON PURPOSE, not persisted. It exists ONLY to word the final delete question
 * honestly — "you downloaded your data a moment ago" is a different sentence from "you have
 * downloaded it at some point in the past", and the second one is a claim this cannot support.
 * It is not the GATE: the delete flow's own tick is (`downloadConfirmed`), and G3's promise is
 * that she has the export in hand before anything is destroyed.
 */
let taken = false;
export const markDownloaded = () => { taken = true; };
export const hasDownloaded = () => taken;
