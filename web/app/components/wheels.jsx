"use client";
import { useEffect, useMemo, useRef, useState } from "react";

// Shared offscreen canvas for text measurement (auto-fit). One per module — cheap, never in DOM.
let _fitCanvas = null;
function _maxLabelWidth(items, font) {
  if (typeof document === "undefined") return 0;
  _fitCanvas = _fitCanvas || document.createElement("canvas");
  const ctx = _fitCanvas.getContext("2d");
  ctx.font = font;
  let w = 0;
  (items || []).forEach((it) => { w = Math.max(w, ctx.measureText(String(it.label)).width); });
  return w;
}

/* ───────── wheels — the shared selection boxes (extracted from FirstRun.jsx, 2026-07-02) ─────────
 * ONE UI for collecting values everywhere (first run AND the Settings profile redo — the
 * founder's "avoid multiple types of UI" rule):
 *   • RollWheel — single-value pick: one visible row, roll/scroll/arrow to cycle, whatever
 *     settles in the box IS the pick.
 *   • PickWheel — multi-value pick: fixed-height 4-row scroll window, tap any visible row to
 *     toggle it, ▲▼ side arrows for phones.
 * Styling lives in globals.css under .fr-wheel* / .fr-sec-* (unchanged class names, so the
 * extraction is invisible to CSS). */

export const WHEEL_ROW = 64;  // px height of RollWheel's single visible row (shared with CSS)
export const PICK_ROW = 52;   // px height of one PickWheel row (4 visible at once = 208px)

/* Step a scroll box by exactly one row, robustly (B1, 2026-07-06). The ▲▼ arrow buttons used a
 * relative scrollBy({behavior:"smooth"}), which some engines silently no-op when smooth-scroll is
 * throttled — a background/inactive tab, prefers-reduced-motion, or certain mobile browsers — so
 * the arrows appeared dead there (drag always worked). This computes the ABSOLUTE target row from
 * the current position, animates to it when motion is allowed, and GUARANTEES the move: a short
 * fallback snaps scrollTop directly if the smooth scroll didn't take. Also honours reduced-motion
 * (jump instantly rather than animate). */
export function stepScroll(el, dir, rowPx, rowCount) {
  if (!el) return;
  const cur = Math.round(el.scrollTop / rowPx);
  const max = Math.max(0, (rowCount || 0) - 1);
  const target = rowCount ? Math.min(max, Math.max(0, cur + dir)) : cur + dir;
  const top = target * rowPx;
  const reduce = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    el.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  } catch {
    el.scrollTop = top; // very old engines without the options form
  }
  // If smooth-scroll was suppressed, the box hasn't landed on the target row shortly after —
  // snap it there directly so the arrow is never a no-op.
  setTimeout(() => {
    if (el && Math.round(el.scrollTop / rowPx) !== target) el.scrollTop = top;
  }, 240);
}

// One gesture demo per page load: whichever RollWheel the teacher meets FIRST rocks a few px
// and settles back, so the box demonstrates its own gesture (words get missed).
let wheelDemoDone = false;

/* RollWheel — a single box, the footprint of one option row, showing exactly ONE item at a
 * time. Rolling (drag / scroll / mouse-wheel / arrow keys) cycles the list through it;
 * scroll-snap settles on a row and whichever item landed in the box IS the pick — no separate
 * confirm tap. items: [{ id, chip?, label }] · value: id string · onChange(id)
 * large: one-notch-bigger label for short lists; longer lists (chapter titles) stay smaller. */
// `rowPx` (default WHEEL_ROW=64) sets the single visible row's height AND the scroll-snap step —
// they MUST stay equal or snapping lands between rows. A caller wanting a more compact wheel
// (e.g. My Lessons' Subject/Grade) passes a smaller rowPx; first-run passes nothing and keeps 64.
export function RollWheel({ items, value, onChange, ariaLabel, large, rowPx = WHEEL_ROW, fit = false, peek = false }) {
  const ref = useRef(null);
  const settleTimer = useRef(null);
  const idBase = String(ariaLabel || "wheel").toLowerCase().replace(/\W+/g, "-");
  const rowStyle = rowPx !== WHEEL_ROW ? { height: rowPx } : undefined;
  // Peek mode (My Lessons Subject/Class): a single compact WHITE row showing ONLY the item in use
  // — no dimmed neighbours (founder ask, 2026-07-21). Same one-row footprint as the base wheel;
  // the styling (white box, larger font, single cycling ▼) is all in CSS + the label sizing below.
  const wheelStyle = rowStyle;
  // Continuous wheeling (peek): render the list THREE times and ride the middle copy, recentring
  // after each settle, so dragging/scrolling wraps around forever — matching the ▼ arrow (which
  // already cycles). Only in peek with >1 item; the base wheel (FirstRun) is untouched.
  const N = items.length;
  const loop = peek && N > 1;
  const selIdx = items.findIndex((it) => String(it.id) === String(value));
  const renderItems = loop
    ? Array.from({ length: 3 * N }, (_, i) => ({ ...items[i % N], _i: i }))
    : items.map((it, i) => ({ ...it, _i: i }));
  // Auto-fit (opt-in): shrink the label font just enough that the LONGEST option shows in full,
  // never clipped by the box — for long words on narrow columns (e.g. "Mathematics" on a phone).
  // Measured at the base size (never the already-shrunk inline size, so it can't compound) and at
  // the bold weight (the settled row is bold), so the visible value always fits.
  const [fitPx, setFitPx] = useState(null);

  // whatever settles in the box becomes the pick
  const onScroll = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el || !N) return;
      if (loop) {
        const raw = Math.round(el.scrollTop / rowPx);
        const real = ((raw % N) + N) % N;
        if (items[real]) onChange(String(items[real].id));
        // Silently hop back into the middle copy whenever we've drifted into the first/last one,
        // so there's always another copy to keep scrolling into (seamless — the recentred row
        // shows the identical item).
        if (raw < N || raw >= 2 * N) el.scrollTop = (N + real) * rowPx;
      } else {
        const idx = Math.min(N - 1, Math.max(0, Math.round(el.scrollTop / rowPx)));
        if (items[idx]) onChange(String(items[idx].id));
      }
    }, 120);
  };

  // moves exactly one row; shared by the keyboard handler AND the ▲▼ cue buttons below, so
  // tapping a cue behaves identically to pressing an arrow key
  const step = (dir) => stepScroll(ref.current, dir, rowPx, items.length);

  // Peek mode's single down arrow: advance to the next item and WRAP from the last back to the
  // first (founder ask, 2026-07-21). Index off the CURRENT value (not the live scrollTop, which
  // may be mid-animation) and commit the pick via onChange immediately, so the selection always
  // changes on tap even if the smooth-scroll is throttled; then move the box to match.
  const stepCycle = () => {
    if (!N) return;
    const curIdx = Math.max(0, items.findIndex((it) => String(it.id) === String(value)));
    const next = (curIdx + 1) % N;
    onChange(String(items[next].id));   // commit immediately so a throttled scroll never no-ops
    const el = ref.current;
    if (!el) return;
    const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (loop) {
      // Ride one row further DOWN the middle/last copy; onScroll recentres. Always down, so the
      // wrap (last → first) is a smooth continuation rather than a jump back up.
      try { el.scrollBy({ top: rowPx, behavior: reduce ? "auto" : "smooth" }); }
      catch { el.scrollTop = el.scrollTop + rowPx; }
    } else {
      const top = next * rowPx;
      try { el.scrollTo({ top, behavior: reduce ? "auto" : "smooth" }); }
      catch { el.scrollTop = top; }
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
  };

  // keep the value valid whenever the list (re)loads — default to the first item
  useEffect(() => {
    if (!items.length) return;
    if (!items.some((it) => String(it.id) === String(value))) onChange(String(items[0].id));
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // position the roll on the current pick whenever the wheel (re)mounts or the list changes
  useEffect(() => {
    const el = ref.current;
    const idx = items.findIndex((it) => String(it.id) === String(value));
    if (el && idx >= 0) el.scrollTop = (loop ? N + idx : idx) * rowPx;
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // one-time gesture demo (see wheelDemoDone above)
  useEffect(() => {
    if (wheelDemoDone || items.length < 2) return;
    const el = ref.current;
    if (!el) return;
    wheelDemoDone = true;
    const idx = Math.max(0, items.findIndex((it) => String(it.id) === String(value)));
    const dir = idx >= items.length - 1 ? -1 : 1; // rock away from the list's edge
    const t1 = setTimeout(() => el.scrollBy({ top: dir * 22, behavior: "smooth" }), 500);
    const t2 = setTimeout(() => el.scrollBy({ top: -dir * 22, behavior: "smooth" }), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute the fit font whenever the option set, the size class, or the viewport changes.
  useEffect(() => {
    if (!fit || typeof window === "undefined") return;
    let cancelled = false;
    const compute = () => {
      const el = ref.current;
      if (!el || cancelled) return;
      const rowEl = el.querySelector(".fr-wheel-row");
      const labelEl = el.querySelector(".fr-wheel-label");
      if (!rowEl || !labelEl) return;
      const rs = getComputedStyle(rowEl);
      const family = getComputedStyle(labelEl).fontFamily || "serif";
      const base = (large ? 17 : 15) + (peek ? 12 : 0);   // peek Subject reads ~six notches larger; design base (NOT the shrunk inline size)
      const avail = rowEl.clientWidth - parseFloat(rs.paddingLeft || 0) - parseFloat(rs.paddingRight || 0);
      if (!avail || avail <= 0) return;
      const maxW = _maxLabelWidth(items, `600 ${base}px ${family}`);
      const px = maxW > avail ? Math.max(12, Math.floor((base * avail / maxW) * 10) / 10) : base;
      if (!cancelled) setFitPx(px);
    };
    compute();
    window.addEventListener("resize", compute);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(compute).catch(() => {});
    return () => { cancelled = true; window.removeEventListener("resize", compute); };
  }, [fit, items, large, rowPx, peek]);

  const labelStyle = fit && fitPx ? { fontSize: `${fitPx}px` } : undefined;
  return (
    <div className={`fr-wheel-shell ${large ? "fr-wheel-lg" : ""} ${peek ? "peek" : ""}`}>
      <div className={`fr-wheel ${peek ? "peek" : ""}`} ref={ref} onScroll={onScroll} onKeyDown={onKeyDown}
        role="listbox" tabIndex={0} aria-label={ariaLabel} style={wheelStyle}
        aria-activedescendant={selIdx >= 0 ? `${idBase}-opt-${loop ? N + selIdx : selIdx}` : undefined}>
        {renderItems.map((it) => {
          const sel = String(value) === String(it.id);
          return (
            <div key={it._i} id={`${idBase}-opt-${it._i}`} style={rowStyle}
              className="fr-wheel-row" role="option" aria-selected={sel}>
              {it.chip != null && <span className={`fr-opt-chip ${sel ? "on" : ""}`}>{it.chip}</span>}
              <span className="fr-wheel-label" style={labelStyle}>{it.label}</span>
            </div>
          );
        })}
      </div>
      {/* real step buttons, not decoration — a tap-friendly alternative for anyone who'd
          rather not drag/scroll-wheel the box itself */}
      <span className={`fr-wheel-cue ${peek ? "single" : ""}`}>
        {peek ? (
          // One down arrow: steps forward and wraps last → first, so the whole list is reachable
          // by tapping the same control (no up arrow).
          <button type="button" className="fr-wheel-cue-btn" onClick={stepCycle}
            aria-label={`Next ${ariaLabel || "option"}`}>▼</button>
        ) : (
          <>
            <button type="button" className="fr-wheel-cue-btn" onClick={() => step(-1)} aria-label={`Previous ${ariaLabel || "option"}`}>▲</button>
            <button type="button" className="fr-wheel-cue-btn" onClick={() => step(1)} aria-label={`Next ${ariaLabel || "option"}`}>▼</button>
          </>
        )}
      </span>
    </div>
  );
}

/* PickWheel — a reusable fixed-height (exactly 4 rows visible) scrollable multi-select "wheel":
 * drag/swipe through the full option list, or tap the bare ▲▼ arrows beside it to step one row
 * (phones aren't always obviously drag-scrollable). Any visible row toggles on tap, independent
 * of scroll position — no cap on how many can be picked. Its Done/Continue button is passed in
 * as `children` so it lands in the SAME column as the wheel (its width then always equals the
 * row list's width; the arrows live outside that column entirely, so they never affect it).
 * `initialScrollTo` positions the wheel on mount without that option being pre-picked.
 * Because only 4 rows are visible at a time, a teacher who scrolls to pick from a later batch
 * can't see the earlier ones and may leave a stray tick behind — so a running "chosen so far"
 * line sits UNDER the Continue/Done button, always listing the full current selection (in option
 * order) no matter where the wheel is scrolled. Set `summaryLabel={false}` to suppress it. */
/* `trailing` turns the wheel into a two-column picker: each row keeps its tick + label on the
 * left and renders `trailing(option, isSelected)` on the right. It exists so the duration
 * question can carry its own periods/week split inline (founder, 2026-07-26) instead of pushing
 * the teacher to a second screen — one question, one format. When it is supplied the row becomes
 * a <div> wrapper rather than a <button>, because the trailing cell holds its own control and a
 * button cannot nest inside a button. `trailingHeader` labels the column, and
 * `summaryFor` overrides `labelFor` in the running "Chosen (n)" line so it can carry the split
 * ("40 min × 3, 45 min × 4") rather than just naming the lengths. `leadingHeader` names the LEFT
 * column once a trailing one exists — with two columns in play the left needs saying out loud
 * ("Duration"), where a single-column wheel never did.
 *
 * ★ CLUSTERING (founder, 2026-07-26). Ticked options gather into one run in ascending order, and
 * the wheel rests with the LOWEST of them as its first visible row. Only four or five rows show at
 * a time, so in a fixed order a teacher who taught 6A and 6R, or 40 min and 90 min, could never see
 * both picks at once and had to wheel back and forth to check what she had. The cluster forms at
 * the lowest pick's OWN slot rather than at the head of the list, so the options before it are
 * still there, one wheel-up away, and the list below resumes past her highest pick. See
 * clusterOrder for what that drops and how to get it back. Applies to every wheel — subjects, classes, sections, durations — because they all
 * come through here. Pass `cluster={false}` to opt out. */
/* The clustering rule. Chosen options gather into ONE run, in natural (ascending) order, sitting
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

export function PickWheel({ options, selected, onToggle, labelFor, initialScrollTo, ariaLabel, children,
                            summaryLabel = true, trailing, trailingHeader, leadingHeader, summaryFor,
                            cluster = true }) {
  const wheelRef = useRef(null);
  /* Bounds and the ▲▼ cue key off the VISIBLE list, not `options`: clustering drops the unchosen
   * rows between her lowest and highest pick, so the wheel can be materially shorter than the
   * option list. Using options.length here let the arrows scroll into empty space past the end,
   * and kept the arrows on show for a list that no longer needed them. */
  const { ordered } = useMemo(
    () => (cluster ? clusterOrder(options, selected) : { ordered: options, start: 0 }),
    [options, selected, cluster]);
  const step = (dir) => stepScroll(wheelRef.current, dir, PICK_ROW, ordered.length);
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
  };
  const showCue = ordered.length > 4;

  /* Every toggle re-rests the wheel on the cluster's first row, so "the lowest pick is the top
   * row" holds as an invariant rather than only at the moment of choosing. Without it the reorder
   * is invisible from a scrolled position — she taps 90 min low down, it moves into the cluster
   * off screen, and all she sees is the row vanish from under her finger. It also resets the tap
   * origin after every pick, so the next tap starts somewhere known instead of on a list that has
   * just shifted (founder, 2026-07-26). Unticking usually moves nothing: the rest position only
   * changes when the LOWEST chosen one is the one let go. */
  const restOn = (row) => {
    const el = wheelRef.current;
    if (!el) return;
    const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // One frame, so the reordered rows are committed before the scroll animates.
    requestAnimationFrame(() => {
      const top = row * PICK_ROW;
      try { el.scrollTo({ top, behavior: reduce ? "auto" : "smooth" }); }
      catch { el.scrollTop = top; }
    });
  };
  const pick = (o, wasOn) => {
    onToggle(o);
    if (!cluster) return;
    // Rest on the NEXT selection's cluster, not the current one — onToggle's state lands later.
    const next = wasOn ? selected.filter((x) => x !== o) : selected.concat([o]);
    restOn(clusterOrder(options, next).start);
  };

  // Running confirmation of the full current selection, in option order (independent of scroll
  // position), so a stray tick from an earlier, now-scrolled-away batch stays visible.
  const chosen = options.filter((o) => selected.includes(o));
  const summary = chosen.map((o) => (summaryFor ? summaryFor(o) : labelFor ? labelFor(o) : String(o))).join(", ");

  useEffect(() => {
    const el = wheelRef.current;
    if (!el || initialScrollTo == null) return;
    // An existing selection wins: open resting on her cluster, not on a seeded suggestion.
    const { start } = cluster ? clusterOrder(options, selected) : { start: 0 };
    const idx = (selected || []).length ? start : ordered.indexOf(initialScrollTo);
    if (idx >= 0) el.scrollTop = idx * PICK_ROW;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`fr-sec-wheel-wrap${trailingHeader ? " has-trail" : ""}`}>
      <div className={`fr-sec-wheel-col${trailingHeader ? " has-trail" : ""}`}>
        {trailing && trailingHeader ? (
          <div className="fr-sec-colhead" aria-hidden="true">
            <span>{leadingHeader}</span><span>{trailingHeader}</span>
          </div>
        ) : null}
        <div className="fr-sec-list fr-sec-wheel" ref={wheelRef} onKeyDown={onKeyDown} tabIndex={0}
          role="listbox" aria-label={ariaLabel} aria-multiselectable="true">
          {ordered.map((o) => {
            const on = selected.includes(o);
            if (!trailing) {
              return (
                <button type="button" key={o} className={`fr-sec-opt ${on ? "on" : ""}`} onClick={() => pick(o, on)}
                  role="option" aria-selected={on}>
                  <span className="fr-sec-check">{on ? "✓" : ""}</span>
                  <span className="fr-sec-label">{labelFor ? labelFor(o) : o}</span>
                </button>
              );
            }
            return (
              <div key={o} className={`fr-sec-optrow ${on ? "on" : ""}`} role="option" aria-selected={on}>
                <button type="button" className={`fr-sec-opt fr-sec-opt-grow ${on ? "on" : ""}`}
                  onClick={() => pick(o, on)}
                  aria-label={`${labelFor ? labelFor(o) : o}${on ? " (selected)" : ""}`}>
                  <span className="fr-sec-check">{on ? "✓" : ""}</span>
                  <span className="fr-sec-label">{labelFor ? labelFor(o) : o}</span>
                </button>
                <span className="fr-sec-trail">{trailing(o, on)}</span>
              </div>
            );
          })}
        </div>
        {children}
        {summaryLabel && (
          <p className="fr-pick-summary" role="status" aria-live="polite">
            {chosen.length
              ? <>Chosen ({chosen.length}): <b>{summary}</b></>
              : <span className="fr-pick-summary-empty">Nothing chosen yet — tap the rows above</span>}
          </p>
        )}
      </div>
      {showCue && (
        // Bare arrows beside the wheel — no bordered/background box around them, just the two
        // glyphs sitting directly on the body, height-matched to the wheel only.
        <div className="fr-sec-arrows-side">
          <button type="button" className="fr-sec-arrow-btn" onClick={() => step(-1)} aria-label="Scroll up">▲</button>
          <button type="button" className="fr-sec-arrow-btn" onClick={() => step(1)} aria-label="Scroll down">▼</button>
        </div>
      )}
    </div>
  );
}

/* ───────── periods/week capture — MOVED to @aruvi/shared/ppw (Track D 5d F2, 2026-09-15) ─────────
 * The arithmetic below this line used to live here: it is pure JS that happened to sit in a JSX
 * file, and the phone's numbers editor needs the identical functions — a teacher's week cannot
 * mean two things on two surfaces. The full account of WHY the split is total-preserving, why
 * periods-a-week is asked before duration, and what the anchor is, travelled with it and lives
 * in that file's header. This re-export keeps every existing import in this repo working.
 */
/* ⚠️ IMPORTED **AND** RE-EXPORTED, and both halves are load-bearing. `export … from` is a pure
   forward: it makes the names available to importers of this file and does NOT bind them in this
   module's own scope. `PpwTotalWheel` below still says `PPW_CHOICES`, so the forward alone left
   it a free variable and the periods-a-week wheel threw "PPW_CHOICES is not defined" the moment
   a teacher opened it — a runtime error no parse check can see, found by walking the screen. */
import {
  DEFAULT_DURATION, DEFAULT_PPW, DURATION_CHOICES, PPW_CHOICES,
  ppwMapSum, lowestDuration, ppwAnchor, normPpw, setPpwSplit, setPpwTotal,
} from "../lib/ppw";
export {
  DEFAULT_DURATION, DEFAULT_PPW, DURATION_CHOICES, PPW_CHOICES,
  ppwMapSum, lowestDuration, ppwAnchor, normPpw, setPpwSplit, setPpwTotal,
};

/* The weekly TOTAL — one number, asked before any duration is named, so it belongs to her week
 * rather than to a period length. The per-duration split is no longer its own screen: it rides
 * along as PickWheel's trailing column on the duration question (see PpwSplitCell). */
export function PpwTotalWheel({ value, onChange }) {
  return (
    <RollWheel ariaLabel="Periods per week" large value={String(Number(value) || DEFAULT_PPW)}
      onChange={(v) => onChange(Number(v))}
      items={PPW_CHOICES.map((p) => ({ id: String(p), chip: p, label: p === 1 ? "period a week" : "periods a week" }))} />
  );
}

/* One cell of that split column. The ANCHOR (lowest ticked length) shows a derived, NON-EDITABLE
 * remainder — a bare number, no label: the column heading already says what it is, and the word
 * "rest" only competed with the figure (founder, 2026-07-26). Every other ticked length gets a
 * 0…total picker, and moving it moves the anchor by the same amount, so the week never changes
 * size. Unticked rows and the single-length case show nothing — the column only earns its space
 * once a second length is ticked.
 *
 * ★ NOT a native <select> (2026-07-26). On macOS the popup list of a <select> is drawn by the OS,
 * so `option { background }` is ignored outright and the menu stays system-grey however the chip
 * is styled — the palette simply cannot reach it. This is a real listbox instead, so the open menu
 * carries the warm-paper system like everything else. It is position:FIXED because the duration
 * wheel is an overflow:auto scroller that would otherwise clip it, and it closes on select, on
 * Escape, on an outside press, and on any scroll or resize (rather than chase the anchor rect).
 *
 * The closed chip is a form field only while it is still ASKING: at 0 it reads as a pine-bordered
 * box, and the moment she picks a number it settles into the row (surface, border and figure take
 * the row's own colours, caret dims) so answered rows read as a plain column of figures beside the
 * anchor's. Both are centred in a fixed-width column under the heading, in the same mono face. */
export function PpwSplitCell({ duration, selected, map, total, isAnchor, onSet, show }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e) => {
      if (popRef.current && popRef.current.contains(e.target)) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (!show || !selected) return null;
  const v = _get(map, duration);
  if (isAnchor) return <span className="fr-ppw-num">{v}</span>;

  const choices = Array.from({ length: (Number(total) || 0) + 1 }, (_, i) => i);
  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current && btnRef.current.getBoundingClientRect();
    if (r) {
      // Flip above when there isn't room below — the wheel often sits low on a phone.
      const h = Math.min(choices.length, 5) * 36 + 10;
      const below = window.innerHeight - r.bottom;
      setRect({ left: r.left, width: r.width, top: below > h + 8 ? r.bottom + 5 : r.top - h - 5 });
    }
    setOpen(true);
  };
  const pick = (e, n) => { e.stopPropagation(); onSet(duration, n); setOpen(false); };

  return (
    <span className={`fr-ppw-selwrap${v > 0 ? " answered" : ""}${open ? " open" : ""}`}>
      <button type="button" ref={btnRef} className="fr-ppw-sel" onClick={toggle}
        aria-haspopup="listbox" aria-expanded={open}
        aria-label={`Periods a week at ${duration} minutes: ${v}`}>
        {v}
      </button>
      {open && rect ? (
        <div ref={popRef} className="fr-ppw-pop" role="listbox" style={{ top: rect.top, left: rect.left }}
          onClick={(e) => e.stopPropagation()}>
          {choices.map((n) => (
            <button type="button" key={n} role="option" aria-selected={n === v}
              className={`fr-ppw-opt${n === v ? " on" : ""}`} onClick={(e) => pick(e, n)}>
              {n}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
