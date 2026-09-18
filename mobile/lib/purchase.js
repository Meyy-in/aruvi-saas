/* ───────── A purchase that is still settling (founder, 2026-09-18) ─────────
 *
 * "Once subscribed a message comes saying [your plan details will appear here]… instead it should
 * be a progress chart for the new invoice, while the old invoice should already be displayed."
 * Two causes, both fixed: the wizard used to BLANK the entitlement store after checkout (so the
 * screen fell to its "no subscription" line until the next 20-second poll), and nothing told the
 * Subscription screen that an invoice was on its way. This is that telling: the wizard notes the
 * scopes it just bought; the screen draws a progress line on each until an invoice lists it.
 * Module memory only — a purchase settles in seconds, and a relaunch simply re-reads /invoices. */
let pending = [];

export function notePurchase(scopes) {
  pending = Array.from(new Set([...(pending || []), ...(scopes || [])]));
}
export function pendingPurchase() { return pending; }
/* Drop every scope an invoice now covers; returns what is still waiting. */
export function settlePurchase(invoices) {
  const covered = new Set((invoices || []).flatMap((iv) => iv.scopes || []));
  pending = pending.filter((s) => !covered.has(s));
  return pending;
}
export function clearPurchase() { pending = []; }
