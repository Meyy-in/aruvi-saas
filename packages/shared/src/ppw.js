/* ───────── periods a week, and how a week splits across period lengths ─────────
 *
 * Lifted VERBATIM out of `web/app/components/wheels.jsx` (Track D step 5d F2, 2026-09-15) — pure
 * arithmetic that happened to live in a JSX file, which is the same move step 5c made for the
 * budget. The phone's numbers editor and `prepare.jsx`'s `seedRows` (which already re-derives a
 * split from `ppw_by_duration`) must read the same constants and the same functions as the web's
 * wheels, or a teacher's week means two things on two surfaces. Nothing below changed in the
 * move; `wheels.jsx` now re-exports from here.
 *
 * ★ TOTAL-PRESERVING SPLIT (founder, 2026-07-26). The old model made a second duration ADDITIVE:
 * adding 45 min to a class already set at 8 × 50 min seeded the new row at a hardcoded 1 and the
 * week silently became 9 — which then rode all the way through annualBudgetPeriods() as
 * 9 × 30 = 270 periods a year. Wrong: a teacher who names a second period length is telling us
 * how her SAME week is split, not that she gained a class.
 *
 * ★ FLIPPED QUESTION ORDER (founder, 2026-07-26). periods/week is asked BEFORE duration, in every
 * flow. She states the size of her week once, unattached to any length; the duration question then
 * carries the split inline as a second column (PickWheel's `trailing`), so the separate
 * periods-per-duration screen is gone. Because the week is stated first, the ANCHOR is simply the
 * LOWEST length she ticks — no "which length owns the week" question arises. The one exception is
 * editing durations from the profile WITHOUT restating the total, where the stored `ppw_anchor` is
 * preserved so an 8 × 50 class does not silently become 8 × 45 the moment she adds 45.
 *
 * So the weekly total is INVARIANT under any duration change. One duration is the ANCHOR and it
 * carries the REMAINDER: anchor = total − Σ(others).
 * A newly added duration starts at 0. Bumping it to 1 takes 1 from the anchor; removing a
 * duration gives its periods back to the anchor. The anchor is persisted as `ppw_anchor` on the
 * grade record so it survives the ascending sort applied to `durations` (durations[0] is the
 * SMALLEST length, which is emphatically not the same thing as the original one). ───────── */
export const DEFAULT_DURATION = 40;
export const DEFAULT_PPW = 6;
export const DURATION_CHOICES = Array.from({ length: 21 }, (_, i) => 20 + i * 5); // 20,25,…120 min
export const PPW_CHOICES = Array.from({ length: 14 }, (_, i) => i + 1);           // 1…14 periods/week

export const ppwMapSum = (m) => Object.keys(m || {}).reduce((a, k) => a + (Number(m[k]) || 0), 0);

const _durs = (durations) => {
  const a = (durations || []).map(Number).filter((n) => n > 0);
  return a.length ? a : [DEFAULT_DURATION];
};
const _get = (map, d) => Number((map || {})[d] ?? (map || {})[String(d)]) || 0;

/* Which duration carries the remainder. The stored `anchor` wins whenever it is still one of
 * the current durations; otherwise fall back to the duration holding the largest count (right
 * after a second length is added that IS the original, since it still holds the whole week),
 * and finally to the first. Deriving it rather than trusting array order is what keeps the
 * behaviour correct after `durations` is sorted ascending by the pickers. */
/* The anchor under the flipped order: the shortest length she has ticked. Deterministic, needs no
 * memory of tick order, and matches how the split column reads top-down. */
export const lowestDuration = (durations) => Math.min(..._durs(durations));

export const ppwAnchor = (durations, map, anchor) => {
  const durs = _durs(durations);
  if (anchor != null && durs.includes(Number(anchor))) return Number(anchor);
  let best = durs[0], bestV = -1;
  durs.forEach((d) => { const v = _get(map, d); if (v > bestV) { best = d; bestV = v; } });
  return best;
};

/* Reconcile a per-duration map to the CURRENT durations while HOLDING THE WEEKLY TOTAL FIXED.
 * The total is the sum of the incoming map (which still holds any just-removed duration's
 * count, so removals flow back to the anchor), or `fallbackPpw` on a cold start. Every
 * non-anchor duration keeps its own count or starts at 0; the anchor absorbs the rest. */
export const normPpw = (durations, map, fallbackPpw, anchor) => {
  const durs = _durs(durations);
  const prev = map || {};
  const prevTotal = ppwMapSum(prev);
  const total = prevTotal > 0 ? prevTotal : Math.max(1, Number(fallbackPpw) || DEFAULT_PPW);
  const a = ppwAnchor(durs, prev, anchor);
  const out = {};
  let others = 0;
  durs.forEach((d) => { if (d !== a) { const n = Math.max(0, _get(prev, d)); out[d] = n; others += n; } });
  out[a] = Math.max(0, total - others);
  if (ppwMapSum(out) <= 0) out[a] = 1;            // a week of zero periods is never an answer
  return out;
};

/* Set ONE non-anchor duration's weekly count, holding the total fixed — the anchor absorbs the
 * delta. Clamped so the anchor can never go negative. Setting the anchor itself is a no-op here
 * (it is derived); use setPpwTotal to change the size of the week. */
export const setPpwSplit = (durations, map, anchor, d, v) => {
  const durs = _durs(durations);
  const base = normPpw(durs, map, DEFAULT_PPW, anchor);
  const a = ppwAnchor(durs, base, anchor);
  if (Number(d) === a) return base;
  const total = ppwMapSum(base);
  const fixed = durs.reduce((s, x) => (x === a || x === Number(d) ? s : s + base[x]), 0);
  const n = Math.min(Math.max(0, Math.round(Number(v) || 0)), Math.max(0, total - fixed));
  return { ...base, [Number(d)]: n, [a]: total - fixed - n };
};

/* Change the SIZE of the week (the one control that legitimately moves the total). The split of
 * the non-anchor durations is preserved where it still fits; the anchor takes the remainder. */
export const setPpwTotal = (durations, map, anchor, total) => {
  const durs = _durs(durations);
  const base = normPpw(durs, map, DEFAULT_PPW, anchor);
  const a = ppwAnchor(durs, base, anchor);
  const want = Math.max(1, Math.round(Number(total) || 0));
  const out = { ...base };
  let others = 0;
  durs.forEach((d) => {
    if (d === a) return;
    const n = Math.min(out[d], Math.max(0, want - others));   // shrink the split to fit a smaller week
    out[d] = n; others += n;
  });
  out[a] = Math.max(0, want - others);
  if (ppwMapSum(out) <= 0) out[a] = 1;
  return out;
};

