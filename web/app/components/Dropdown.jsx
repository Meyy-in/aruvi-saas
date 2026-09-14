"use client";
import { useEffect, useRef, useState } from "react";

/* ── The Aruvi dropdown (2026-08-27) ───────────────────────────────────────────
 *
 * ★ WHY THIS EXISTS AT ALL — a native <select> CANNOT be themed on macOS.
 *
 * Reported as "the dropdowns use a dark background", and chased in the wrong direction
 * twice before the browser was actually asked. The closed control had been Aruvi cream
 * since 2026-08-25; the dark thing was the OPEN LIST. The first fix was
 * `:root { color-scheme: light }` in globals.css — correct, necessary, and KEPT (it is
 * what stops scrollbars, autofill and date pickers following the OS instead of the
 * app) — but it did not fix this. Measured live, on the founder's Mac, with the page
 * light and the OS dark:
 *
 *     html          color-scheme: light
 *     select        color-scheme: light   background: rgb(255,255,255)
 *     select option                       background: rgb(255,255,255)
 *
 * Every lever CSS has reported light, and the popup still came up black. On macOS
 * Chrome hands a <select>'s popup to a native NSMenu, which follows the OS appearance
 * and never reads the page's `color-scheme` or the `option` rules. There is no CSS
 * fix. wheels.jsx reached this conclusion first, on 2026-07-26, and built PpwSplitCell
 * as a button + listbox to escape it; this is that pattern generalised so the whole app
 * escapes it once instead of each screen rediscovering it.
 *
 * So: a real listbox, in Aruvi's own paper. Same API shape as a <select> — `value`,
 * `onChange(value)`, `options` — so a call site converts in three lines.
 *
 * Behaviour carried over from PpwSplitCell, which earned each of these the hard way:
 *   · position:FIXED, so an overflow:auto ancestor cannot clip the open list;
 *   · flips ABOVE the button when there is no room below (phones, low fields);
 *   · closes on select, Escape, outside press, resize, and a scroll of the PAGE — closing
 *     beats chasing the anchor's rect around. NOT on a scroll of its own list: the listener
 *     is on window in the capture phase, so it sees the popup's own overflow scroll too, and
 *     for months that made every list longer than its box unusable past the visible rows;
 *   · Escape calls stopPropagation, or the modal behind it closes too.
 * Added here because this one is a form field where PpwSplitCell was a number chip:
 * full keyboard support (Arrows/Home/End/Enter/Space/Escape/Tab), `aria-activedescendant`,
 * and the open list scrolls the active option into view.
 */

export default function Dropdown({
  value, onChange, options = [], placeholder = "Select", disabled = false,
  className = "", ariaLabel, id, unsetClass = "ob-unset",
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [active, setActive] = useState(-1);   // keyboard cursor, not the value
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const opts = options.map((o) =>
    (o && typeof o === "object") ? o : { value: o, label: String(o) });
  const current = opts.find((o) => String(o.value) === String(value));
  const selectedIndex = opts.findIndex((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e) => {
      if (popRef.current && popRef.current.contains(e.target)) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    /* ⚠️ CLOSE ON A SCROLL OF THE PAGE — NEVER ON A SCROLL OF THE LIST ITSELF (founder,
       2026-09-14: "'select your state' in profile is not allowing me to choose states below
       Jharkhand").
       The listener is on `window` in the CAPTURE phase, which is what lets it see a scroll in
       any overflow ancestor and close before the anchor drifts. But capture also delivers a
       scroll of the POPUP, and `.dd-pop` is `overflow-y: auto` — so the moment she scrolled the
       list to reach anything past the tenth row, the list closed under her. States is 23 long
       and Jharkhand is the tenth: exactly the last one reachable without scrolling, which is why
       the report named it. Every long Dropdown had it — the chapter adder in Allocate too; the
       short ones (Role, four; Support, five) fit and so never showed it.
       It also broke the KEYBOARD: the effect below calls `scrollIntoView` to keep the cursor
       visible, and that scroll is a scroll of the popup too, so arrowing past the tenth row
       closed the list as well. One guard fixes both. */
    const onScroll = (e) => {
      const n = e.target;
      if (popRef.current && n && n.nodeType === 1 && popRef.current.contains(n)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // Keep the keyboard cursor visible as it moves — a list you can drive but not see is
  // worse than one you cannot drive.
  useEffect(() => {
    if (!open || active < 0 || !popRef.current) return;
    const el = popRef.current.querySelector(`[data-i="${active}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  /* Anchor the list to the button and let it size ITSELF, capped by the room actually
     available. The row-height estimate is used only to CHOOSE a side, never to size:
     labels wrap ("Something in a lesson plan looks wrong" is two lines at 360px), so a
     height computed from a row count is wrong the moment a label is long, and it was —
     it clipped the last option with no way to tell there was one.

     Flipping above sets `bottom`, not `top`, so the list grows upward FROM the button.
     Computing a top from an estimated height is what put the estimate on the critical
     path in the first place. */
  const place = () => {
    const r = btnRef.current && btnRef.current.getBoundingClientRect();
    if (!r) return;
    const GAP = 5, EDGE = 12;
    const below = window.innerHeight - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const want = Math.min(opts.length, 8) * 38 + 10;   // for the choice of side only
    // Prefer below; flip up only when below cannot hold the list AND above is roomier.
    const flip = below < want && above > below;
    setRect(flip
      ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + GAP,
          maxHeight: Math.max(120, above) }
      : { left: r.left, width: r.width, top: r.bottom + GAP,
          maxHeight: Math.max(120, below) });
  };

  const toggle = () => {
    if (disabled) return;
    if (open) { setOpen(false); return; }
    place();
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const pick = (i) => {
    const o = opts[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    if (btnRef.current) btnRef.current.focus();
  };

  /* One step of the keyboard cursor, skipping disabled rows. Returns the current index
     unchanged when every remaining row is disabled, so the key press is simply inert
     rather than sending the cursor off the end of the list. */
  const step = (from, dir) => {
    for (let i = from + dir; i >= 0 && i < opts.length; i += dir) {
      if (!opts[i].disabled) return i;
    }
    return from;
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); toggle(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => step(i, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => step(i, -1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(step(-1, 1)); }
    else if (e.key === "End") { e.preventDefault(); setActive(step(opts.length, -1)); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
    else if (e.key === "Tab") setOpen(false);   // never trap focus in the list
  };

  const listId = id ? `${id}-list` : undefined;
  return (
    <span className={`dd-wrap${open ? " dd-open" : ""} ${className}`}>
      <button type="button" ref={btnRef} id={id} disabled={disabled}
        className={`dd-btn${current ? "" : ` dd-unset ${unsetClass}`}`}
        onClick={toggle} onKeyDown={onKeyDown}
        aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 && listId ? `${listId}-${active}` : undefined}>
        <span className="dd-lab">{current ? current.label : placeholder}</span>
        <span className="dd-chev" aria-hidden="true">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round"><path d="M1 1l5 5 5-5" /></svg>
        </span>
      </button>
      {open && rect ? (
        <div ref={popRef} id={listId} className="dd-pop" role="listbox"
          aria-label={ariaLabel}
          style={{ top: rect.top, bottom: rect.bottom, left: rect.left,
                   width: rect.width, maxHeight: rect.maxHeight }}>
          {opts.map((o, i) => (
            <button type="button" key={`${o.value}-${i}`} data-i={i}
              id={listId ? `${listId}-${i}` : undefined}
              role="option" aria-selected={i === selectedIndex} aria-disabled={!!o.disabled}
              className={`dd-opt${i === selectedIndex ? " on" : ""}`
                + `${i === active ? " active" : ""}${o.disabled ? " dd-off" : ""}`}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onClick={() => pick(i)}>
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
