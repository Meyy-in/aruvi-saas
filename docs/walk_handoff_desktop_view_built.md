# THE WEBSITE (DESKTOP) VIEW — built, awaiting its re-walk (hand-off written 2026-10-03)

Read with `docs/web_desktop_view.md` (the plan) and CLAUDE.md §0 / §4. Status of the plan doc is
still PROPOSAL — flip it to BUILT only after the re-walk below (see "Still to do").

## Founder decisions (2026-10-03)
1. Breakpoint **1024px** (an upright iPad keeps the phone layout).
2. Nav rests in **a row under the brand bar** (not inline beside the wordmark).
3. Ask Meyy: **no widen toggle** — responsive width `clamp(380px, 30vw, 620px)` only.
4. **Subtle, mouse-only hover** standard: ink deepens / border goes pine; nothing floods or moves.
5. Copy that says where the nav is **follows the bar, web only** (WALK-A-174).
6. Year Plan keeps a reading measure (800px, flush left) instead of stretching — founder accepted
   ("2b ok"); the Subject · Class choosers on My Lessons cap at the same 800px.
7. NEW, NOT BUILT: one-subject teacher → My Classes grouped by CLASS (heading per class, sections
   beneath); multi-subject keeps subject bands. Web + iPhone + Android, its own change AFTER this
   walk, amendment **WALK-A-175**, its own git add.

## What was built (all approved step by step by the founder)
All CSS is ONE block appended at the END of `web/app/globals.css` ("★ THE WEBSITE VIEW"); no base
rule was edited (diff vs the pre-work file = additions only). Every rule is inside a
`min-width: 1024px` block. Parity checker unchanged throughout: **1 · 11 · 25**.
- **2b grids** — `--desk-w: 1200px`; brand bar caps to it; `main` widens only via
  `main:has(.dash-hd), main:has(.mlp2)`; `.sc-list` → `repeat(auto-fill, minmax(320px,1fr))`.
- **2c density** — `(min-width:1024px) and (pointer:fine)`: shorter bar, less top padding, slimmer
  cards (88→~76px), 26px round card buttons. Type sizes untouched. Hover block adds tabs
  (`.uv-tab`, `.assess-mt`), `.lv-pvbtn`, Ask Meyy category heads.
- **2a nav** — `order` lifts `.bnav` between `.topbar` and `.bodycontent` (body is a flex column in
  app-shell); horizontal items, 18px glyphs, clay rule absolutely placed. `--bnav-h: 0px !important`
  at desktop (outranks page.jsx's inline value); `--dnav-h: 46px`. The Settings bar is lifted out of
  `.topbar` flow and drawn BELOW the nav row (`--dset-h: 52px`, `.bodycontent` margin-top).
  Ask Meyy scrim top = `--nav-h + --dnav-h`. GuidedTour: steps with `navItem: true` (nav-classes,
  nav-lessons, grow-add, ask-aruvi) hang **below** at ≥1024px.
- **2d Ask Meyy docks right**, below the nav row, no scrim, pushes `.bodycontent`
  (`body:has(.aa-scrim) .bodycontent { margin-right: var(--aa-w) }`). Below 1024 = today's overlay.
- **Dialogs** — `.ap-modal:has(.ap-list):not(.ap-confirm):not(.ap-grow)` → 600px; only lists of
  `.ap-row` cards become a 2-column grid (history `.ch-row` and Prepare's `.prep-brk-row` stay one
  column).
- **WALK-A-174 (open)** — `web/app/lib/navPlace.js` (`useNavAtTop`, `addBarPhrase`, `navAtTop`):
  at ≥1024 "the bottom tool bar" → "the tool bar at the top" (MyPlans empty state, MyLessonPlans
  no-class line, TeachingProfile classless subject) and the tour's "at the foot of the screen" →
  "at the top of the screen" (GuidedTour steps 1, 2, preview, settings-gear).
- Dark mode does not exist above 600px on the web (WALK-A-010), so desktop checks are light only;
  390px was checked light + dark on `localhost:3000/parity.html` after every step.

## Re-walk — 72 web rows, marked `recheck` in data/testing/walk_state.json
(69 flipped from pass; 05.11, 05.19 stay pending, T.27 stays unwalkable — all carry the note
"↻ re-walk after the desktop view…"). Walk at **≥1024px wide, Claude side panel CLOSED** (with it
open the tab is ~1022px and shows the phone layout).
- **A shell/nav/Settings (16):** 01.06 01.08 01.09 01.11 01.12 01.14 01.20 01.21 01.24 01.30 02.01 02.08 04.01 04.02 04.03 04.10
- **B My Classes & pickers (11):** 05.01 05.02 05.03 05.04 05.05 05.08 05.09 05.10 05.11* 06.01 X.03
- **C My Lessons & Year Plan (12):** 01.22 02.14 05.13 05.14 05.15 05.16 05.19* 05.20 05.21 05.23 05.28 05.29
- **D lesson tabs & Ask Meyy (5):** 06.15 06.25 04.28 04.29 04.30
- **E guided tour (28):** T.01–T.28, on a FRESH account (919000000002, code 123456; erase it first
  if it already has a profile; `ledger-forget` if its trial is spent). The FOUNDER signs in and runs
  first run; Claude drives the tour from the "Let me show you around first" offer.
  Check on every step: ring on target; steps 1, 2, 16, 18 box BELOW the nav row; copy says "top".

## Still to do, in order
1. Walk E (tour) then A–D, one batch at a time; a fail needs the founder's words, then an amendment
   (next free number **176** — 174 is the copy, 175 is reserved for the class-headings change).
2. Close WALK-A-174 when its rows pass (02.14, 05.02, 05.14, X.03 and the tour).
3. CLAUDE.md §4: a short "Desktop view (2026-10-03)" entry. `docs/web_desktop_view.md`:
   PROPOSAL → BUILT, with the decisions above.
4. Then WALK-A-175 (class headings for one-subject teachers, all three surfaces).

## Files of THIS work (the targeted git add — Maths IX in genon is separate)
```
git add web/app/globals.css web/app/lib/navPlace.js \
  web/app/components/GuidedTour.jsx web/app/components/MyPlans.jsx \
  web/app/components/MyLessonPlans.jsx web/app/components/TeachingProfile.jsx \
  data/testing/walk_state.json docs/walk_handoff_desktop_view_built.md
```
Web-only: no Render deploy needed (api/ untouched), though any push redeploys Render anyway.
