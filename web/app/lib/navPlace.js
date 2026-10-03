/* ★ WHERE THE NAV IS — the one source the web's copy asks (WALK-A-174, founder 2026-10-03).
 * At phone width the four-item nav is at the foot of the screen; the website view lifts it into
 * a row under the brand bar from 1024px (globals.css, "THE WEBSITE VIEW", 2a). The few sentences
 * that tell her where the nav IS — "the Add window from the bottom tool bar", the tour's "at the
 * foot of the screen" — follow the bar, so they never point at an empty edge. Below 1024px every
 * word is exactly as before, and the phone app (whose bar never moves) is untouched.
 * The query MUST match the CSS breakpoint of the 2a block. */
import { useEffect, useState } from "react";

export const NAV_TOP_QUERY = "(min-width: 1024px)";

// Read once, now — for code that renders on a poll anyway (GuidedTour re-measures every 200ms).
export const navAtTop = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(NAV_TOP_QUERY).matches;

// For a component that must re-render when the window crosses the breakpoint.
export function useNavAtTop() {
  const [top, setTop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const m = window.matchMedia(NAV_TOP_QUERY);
    const on = () => setTop(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return top;
}

// "the Add window from the bottom tool bar" ↔ "… from the tool bar at the top".
export const addBarPhrase = (top) => (top ? "the tool bar at the top" : "the bottom tool bar");
