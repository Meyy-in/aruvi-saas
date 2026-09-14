"use client";

/* ───────── Ask Aruvi — deterministic Q&A screen ─────────
 * Opened from the "?" on the right of the My Classes / My Lessons row. A full-screen,
 * Settings-style panel over the app. Two modes, one dataset — the question bank, which is
 * FETCHED once after sign-in and cached on the device (./bank.js), never bundled:
 *
 *   • BROWSE (search empty): five collapsible categories. Opening one FREEZES its header
 *     (sticky) so it can be collapsed again from anywhere while its questions scroll.
 *     Tapping a question opens its answer inline.
 *
 *   • SEARCH (search has text): categories disappear entirely — only a ranked, de-duplicated
 *     list of matching Q&A, best match first, with a live result count. No LLM: matching is
 *     keyword + normalised token ranking (see lib/askAruviSearch.js).
 *
 * Same experience on every screen — no context, no pre-expansion. Warm-paper tokens from
 * globals.css, so light/dark follow the app automatically.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { search } from "./askAruviSearch";
import { loadBank } from "./bank";

export default function AskAruvi({ onClose, autoFocus = true }) {
  /* Focus the search box only where a focused field is free (founder, 2026-09-11): on a
     PHONE, focus raises the keyboard over half the screen — and during the guided tour
     it hid step 19's own window behind it. So: desktop widths only (the 2026-08-08 rule
     Login follows), and never while the tour is driving (page.jsx passes autoFocus=false
     for the step-19 open). A teacher who wants to type taps the box; a teacher who wants
     to browse the five categories is not interrupted. */
  const searchRef = useRef(null);
  useEffect(() => {
    if (!autoFocus || typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(min-width: 601px)").matches) searchRef.current?.focus();
  }, [autoFocus]);
  const [query, setQuery] = useState("");
  const [openCat, setOpenCat] = useState(null);   // the frozen (expanded) category id
  const [openPair, setOpenPair] = useState(null); // the expanded answer id

  /* The bank is no longer bundled (2026-08-30) — it is fetched once after sign-in and kept
   * in localStorage; see ./bank.js for why. `loadBank()` returns the STORED copy
   * synchronously when there is one, so opening this panel never waits on the network. It
   * is only empty for a teacher whose very first session lost signal between signing in and
   * the fetch landing — page.jsx primes it at sign-in precisely to make that rare. */
  const [kb, setKb] = useState(() => loadBank());
  useEffect(() => {
    if (kb) return;
    let live = true;
    import("./bank").then((m) => m.refreshBank()).then((b) => { if (live && b) setKb(b); }).catch(() => {});
    return () => { live = false; };
  }, [kb]);

  const cats = kb?.categories || [];
  const pairs = kb?.pairs || [];

  // The accent rail is a SINGLE moving marker, not one bar per category: it starts beside the
  // first category and hops to whichever header is tapped (open or collapse — it marks
  // "where you are", so it never disappears).
  const [markedCat, setMarkedCat] = useState(null);
  useEffect(() => {
    if (!markedCat && cats.length) setMarkedCat(cats[0].id);
  }, [cats, markedCat]);

  const result = useMemo(() => search(pairs, query), [pairs, query]);
  const searching = result !== null;

  // category id → {title, description, tag, accent} (all driven by the JSON, no hardcoding)
  const catMap = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats]);

  const byCat = useMemo(() => {
    const m = {};
    pairs.forEach((p) => (m[p.category] = m[p.category] || []).push(p));
    return m;
  }, [pairs]);

  // Esc closes; lock body scroll while open.
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = prev; };
  }, [onClose]);

  const togglePair = (id) => setOpenPair((cur) => (cur === id ? null : id));

  /* aria-modal is FALSE deliberately: the bottom nav stays OUTSIDE this dialog and stays
     operable (2026-09-13), so claiming the rest of the app is inert would be a lie to a screen
     reader. Escape still closes it, and there is no focus trap to undo. */
  return (
    <div className="aa-scrim" role="dialog" aria-modal="false" aria-label="Ask Meyy">
      {/* data-tour: guided-tour step 18 rings the OPEN panel (page.jsx opens it on 17→18). */}
      <div className="aa-panel" data-tour="ask-aruvi-root">

        {/* fixed title bar */}
        <div className="aa-top">
          <div className="aa-title">
            <span className="aa-q" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 6.5c6 1 6 5 3.5 7.5S6 18 6 18" />
                <path d="M10.5 14c3.5 0 5.5-1.8 6.5-4" />
                <circle cx="17.3" cy="8.6" r="1.6" fill="#e8b4a0" stroke="none" />
              </svg>
            </span>
            <span>Ask Meyy</span>
          </div>
          <button className="aa-close" onClick={onClose} aria-label="Close Ask Meyy">✕</button>
        </div>

        {/* sticky search bar */}
        <div className="aa-search">
          <input
            type="search" value={query} ref={searchRef}
            onChange={(e) => { setQuery(e.target.value); setOpenPair(null); }}
            placeholder="Search…"
            aria-label="Search questions"
          />
          {searching && (
            <div className="aa-count">
              {result.count === 0
                ? "No matches — try fewer or different words"
                : `${result.count} ${result.count === 1 ? "result" : "results"}`}
            </div>
          )}
        </div>

        {/* scroll region */}
        <div className="aa-body">
          {!kb ? (
            /* The ONLY state with no answers: a first session that lost signal between
               sign-in and the priming fetch. Say what is true and what fixes it — never a
               spinner that implies something is arriving, because offline nothing is. */
            <div className="aa-empty">
              <p>Ask Meyy needs to download its answers once before it can work offline.</p>
              <p>Open it again when you next have a connection, and it will be ready from then on.</p>
            </div>
          ) : searching ? (
            /* ── SEARCH MODE — ranked list only, no categories ── */
            <div className="aa-results">
              {result.results.map((p) => (
                <Answer key={p.id} p={p} open={openPair === p.id} onToggle={() => togglePair(p.id)} tag={catMap[p.category]?.tag} />
              ))}
            </div>
          ) : (
            /* ── BROWSE MODE — five collapsible, freezable categories ── */
            cats.map((c) => {
              const pairs = byCat[c.id] || [];
              const isOpen = openCat === c.id;
              return (
                <section
                  key={c.id}
                  className={`aa-cat ${isOpen ? "open" : ""} ${markedCat === c.id ? "marked" : ""}`}
                  style={{ "--accent": c.accent }}
                >
                  <button
                    className="aa-cat-head"
                    aria-expanded={isOpen}
                    onClick={() => { setOpenCat(isOpen ? null : c.id); setMarkedCat(c.id); setOpenPair(null); }}
                  >
                    <span className="aa-cat-bar" aria-hidden="true" />
                    <span className="aa-cat-text">
                      <span className="aa-cat-title">{c.title}</span>
                      <span className="aa-cat-desc">{c.description}</span>
                    </span>
                    <span className="aa-cat-meta">
                      <span className="aa-cat-n">{pairs.length}</span>
                      <span className={`aa-chev ${isOpen ? "up" : ""}`} aria-hidden="true">⌄</span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="aa-cat-list">
                      {pairs.map((p) => (
                        <Answer key={p.id} p={p} open={openPair === p.id} onToggle={() => togglePair(p.id)} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

      <style jsx>{`
        /* Opens BELOW the frozen header — its grey bottom border (the line under the
           "Aruvi · lesson studio" logo) stays visible and frozen. --hdr-h is the header
           height page.jsx measures live; 72px is the pre-measure fallback.
           ★ AND IT STOPS ABOVE THE BOTTOM NAV (founder, 2026-09-13). The scrim ran to
           bottom:0 and buried the bar, so opening Ask Meyy took the app's ENTIRE nav off
           the screen and the only way out was the panel's own ✕ — the one screen where she
           could not simply go to My Classes. The bar is the app's nav; it does not disappear
           behind a panel. --bnav-h is measured live in page.jsx; since 2026-09-14 the bar is up
           on every screen, so it is simply the bar's height, and 0px only on a surface that has
           no bar at all (Login, first run). One line, correct everywhere. */
        .aa-scrim { position: fixed; top: var(--hdr-h, 72px); left: 0; right: 0;
          bottom: var(--bnav-h, 0px);
          z-index: 40; background: rgba(20,16,10,.34);
          display: flex; justify-content: center; align-items: stretch; }
        /* NOTE: the section palette (--sec-a…d) that the category accents resolve against is
           declared for .aa-panel in globals.css (light + dark), NOT here — it is scoped to
           .rd/.myclasses/.fr-wrap there, and without .aa-panel every accent but cat_e's
           :root --ss-plum resolved to nothing (only the last category showed a rail). */
        .aa-panel { width: 100%; max-width: 720px; height: 100%; background: var(--paper);
          display: flex; flex-direction: column; box-shadow: 0 0 60px rgba(0,0,0,.28); }
        @media (min-width: 721px) { .aa-panel { border-radius: 0 0 16px 16px; overflow: hidden; } }

        /* Only ever seen on a first session that lost signal before the bank arrived. Set as
           quiet prose, not an error: nothing is broken, it simply has not downloaded yet. */
        .aa-empty { padding: 34px 22px; color: var(--ink-soft); font-family: var(--f-body);
          font-size: 15px; line-height: 1.6; max-width: 46ch; }
        .aa-empty p { margin: 0 0 10px; }

        .aa-top { display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px 12px; border-bottom: 1px solid var(--line); background: var(--paper); }
        .aa-title { display: flex; align-items: center; gap: 10px; font-family: var(--f-display);
          font-size: 20px; font-weight: 600; color: var(--ink); }
        .aa-q { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;
          border-radius: 50%; background: var(--pine); color: #fff; font-family: var(--f-mono); font-size: 15px; }
        .aa-close { background: none; border: none; font-size: 17px; color: var(--ink-soft); cursor: pointer; padding: 6px; }
        .aa-close:hover { color: var(--clay); }

        .aa-search { padding: 12px 20px 10px; border-bottom: 1px solid var(--line-soft);
          background: var(--paper); position: sticky; top: 0; z-index: 3; }
        .aa-search input { width: 100%; font-family: var(--f-body); font-size: 16px; color: var(--ink);
          background: var(--paper-2); border: 1px solid var(--line); border-radius: 10px;
          padding: 11px 14px; outline: none; }
        .aa-search input:focus { border-color: var(--pine); }
        .aa-count { font-family: var(--f-mono); font-size: 11px; letter-spacing: .04em; text-transform: uppercase;
          color: var(--ink-soft); margin: 9px 2px 1px; }

        /* No top padding on the scroll area: it would leave a band above the stuck category
           header where a scrolling question flashes into view before sliding under it. */
        .aa-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
          padding: 0 20px 40px; }
        .aa-results { padding-top: 6px; }

        /* categories */
        .aa-cat { border-bottom: 1px solid var(--line-soft); }
        /* Sticky header sits ABOVE the scrolling rows (raised z-index) on its own paint layer
           (translateZ) with an opaque paper fill, so questions pass cleanly underneath it. */
        .aa-cat-head { position: sticky; top: 0; z-index: 5; width: 100%; display: flex; align-items: center; gap: 12px;
          background: var(--paper); border: none; cursor: pointer; text-align: left; padding: 15px 2px;
          transform: translateZ(0); }
        .aa-cat.open .aa-cat-head { border-bottom: 1px solid var(--line-soft); }
        /* One marker, not five: the rail keeps its 4px of gutter on every row (so titles stay
           aligned) but only paints on the marked category. */
        .aa-cat-bar { flex: none; width: 4px; align-self: stretch; min-height: 30px; border-radius: 3px;
          background: transparent; transition: background .18s ease; }
        .aa-cat.marked .aa-cat-bar { background: var(--accent); }
        .aa-cat-text { flex: 1; min-width: 0; }
        .aa-cat-title { display: block; font-family: var(--f-display); font-size: 16.5px; font-weight: 600; color: var(--ink); }
        .aa-cat-desc { display: block; font-family: var(--f-body); font-size: 13px; color: var(--ink-soft); margin-top: 2px; line-height: 1.35; }
        .aa-cat-meta { flex: none; display: flex; align-items: center; gap: 10px; }
        .aa-cat-n { font-family: var(--f-mono); font-size: 12px; color: var(--accent); min-width: 20px; text-align: right; }
        .aa-chev { font-size: 18px; color: var(--ink-soft); transition: transform .18s ease; }
        .aa-chev.up { transform: rotate(180deg); }
        .aa-cat-list { padding: 2px 0 10px; }
      `}</style>

      {/* Answer rows carry their own styles (shared by both modes) */}
      <style jsx global>{`
        .aa-item { border-top: 1px solid var(--line-soft); }
        .aa-results > .aa-item:first-child { border-top: none; }
        .aa-item-q { width: 100%; display: flex; align-items: flex-start; gap: 10px; background: none; border: none;
          cursor: pointer; text-align: left; padding: 13px 2px; font-family: var(--f-body); font-size: 15.5px;
          color: var(--ink); line-height: 1.4; }
        .aa-item-q:hover { color: var(--pine-d); }
        .aa-item-plus { flex: none; font-family: var(--f-mono); font-size: 14px; color: var(--ink-soft); margin-top: 1px; width: 14px; }
        .aa-item.open .aa-item-plus { color: var(--clay); }
        .aa-item-tag { flex: none; font-family: var(--f-mono); font-size: 9px; letter-spacing: .08em; text-transform: uppercase;
          color: var(--ink-soft); border: 1px solid var(--line); border-radius: 20px; padding: 2px 7px; margin-top: 1px; }
        .aa-item-a { font-family: var(--f-body); font-size: 15px; color: var(--ink-soft); line-height: 1.6;
          padding: 0 2px 15px 24px; white-space: pre-wrap; }
      `}</style>
    </div>
  );
}

function Answer({ p, open, onToggle, tag }) {
  return (
    <div className={`aa-item ${open ? "open" : ""}`}>
      <button className="aa-item-q" aria-expanded={open} onClick={onToggle}>
        <span className="aa-item-plus" aria-hidden="true">{open ? "–" : "+"}</span>
        <span className="aa-item-qtext">{p.question}</span>
        {tag && <span className="aa-item-tag">{tag}</span>}
      </button>
      {open && <div className="aa-item-a">{p.answer}</div>}
    </div>
  );
}
