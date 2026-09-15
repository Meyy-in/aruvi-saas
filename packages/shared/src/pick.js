/* ───────── the clustering rule for a tick-list wheel (Track D 5d F8, 2026-09-15) ─────────
 *
 * Lifted verbatim from `web/app/components/wheels.jsx`. Pure, and it is the whole BEHAVIOUR of
 * the pick wheel — which rows are shown, in what order, and where the wheel comes to rest — so
 * the phone must run this exact function rather than an approximation of it. The web's PickWheel
 * and the phone's now share it; the markup differs, the rule cannot.
 *
 * ★ WHY IT EXISTS (founder, 2026-07-26). Only four or five rows show at a time, so in a fixed
 * order a teacher who taught 6A and 6R, or 40 min and 90 min, could never see both of her picks
 * at once and had to wheel back and forth to check what she had chosen.
 *
 * THE RULE. Chosen options gather into ONE run, in natural (ascending) order, sitting
 * at the natural slot of the LOWEST chosen one — not at the top of the array. Whatever naturally
 * precedes that item stays above it, still reachable by wheeling up. Below the cluster, the list
 * resumes only AFTER the LATEST (highest) chosen one: the unchosen options she has already scrolled
 * past, between her lowest and highest pick, are dropped from the wheel (founder, 2026-07-26).
 * Picking runs upward in practice — 40 then 45, 6A then 6C — so the rows worth showing next are the
 * ones beyond her furthest pick, and carrying the skipped middle just pads the window.
 *
 *   20 25 30 35 40 45 50 55 60   ·  pick 50, then 30
 *   20 25 [30 50] 55 60          ·  cluster at 30's slot; 20/25 above; 35 40 45 dropped
 *          ▲ first visible row
 *
 * TRADE-OFF, deliberate: a middle value cannot be added while it is hidden — to reach 45 here she
 * unticks 50 and the middle reappears, since this is recomputed from `selected` every render and
 * nothing is remembered. Untick is therefore the escape hatch, not a dead end.
 *
 * Returns { ordered, start } — start is the row index the wheel should rest on. */
export function clusterOrder(options, selected) {
  const opts = options || [];
  const sel = opts.filter((x) => (selected || []).includes(x));
  if (!sel.length) return { ordered: opts, start: 0 };
  const lowest = opts.indexOf(sel[0]);                       // natural slot of the lowest chosen
  const highest = opts.indexOf(sel[sel.length - 1]);         // ...and of the latest/highest
  const before = opts.filter((x, i) => i < lowest && !sel.includes(x));
  const after = opts.filter((x, i) => i > highest && !sel.includes(x));
  return { ordered: before.concat(sel, after), start: before.length };
}

