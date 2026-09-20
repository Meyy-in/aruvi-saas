# The website view — making the web stop looking like a stretched phone

**Status: PROPOSAL, nothing built.** Opened 2026-09-19 (founder: *"the web app is left behind
looking like mobile… same functionality and UI as mobile is as it is now, just a web feel"*).
Read with CLAUDE.md §0 (the mobile-first pivot and the 2026-09-13 surface split) and §4 (the
design system). Nothing here changes what a screen DOES, what it says, or where anything lives.

---

## 0. Why this exists now

The web was designed mobile-first, deliberately and correctly: it was the only surface, and the
phone was coming. Since 2026-09-13 the division is explicit — **the phone view is verified on
the Expo app, the web app is verified as the WEBSITE view at desktop widths** — and the
subscription model (2026-09-13) gives an individual teacher the web too, fenced by a three-device
cap rather than by channel. So the web is now a first-class surface that real teachers will open
on a laptop, and it is still wearing the phone's clothes: one 860px column, primary navigation at
the foot of the screen, finger-sized tap targets, and single-column lists.

**This is presentation only.** Same screens, same copy, same information architecture, same
component tree. If a change here would alter what a teacher can DO, it does not belong in this
document.

---

## 1. The governing principle

> **Collections take the width. Prose keeps its measure.**

The instinct is to widen `--shell-w` and stop. That is wrong for half the product. A lesson plan
is a DOCUMENT, and documents want 60–75 characters a line; stretching Newsreader across 1400px
makes it harder to read, not more desktop-like — and the lesson is the hero (§4). So:

| Widens | Keeps its measure |
|---|---|
| My Classes (section cards) | LessonView — every tab, phases, assess items |
| My Lessons (lesson cards, archive) | Settings subviews |
| Year Plan (the three-column table) | Legal documents (agreement, privacy notice) |
| The attach / history pickers' lists | Ask Meyy answers (inside a wider panel, not a wider column) |

---

## 2. The changes, in order of leverage

### 2a. The bottom nav moves up  ← does most of the work

`.bnav` at the foot is the single biggest tell. Nothing on the desktop web puts primary
navigation at the bottom of the screen, and on a 1440px display a bottom bar under an 860px
column reads unmistakably as a phone in a frame. The four items — My Classes · My Lessons · Add ·
Ask Meyy — move into a row beneath the brand bar at desktop widths. **Same labels, same glyphs,
same order, same `activeNav` rules, same lapsed hiding.** It is the same four destinations in the
place a browser user's eye already goes.

⚠️ **This is the one item that contradicts a recorded decision.** §0 says "no sidebar, no
hamburger", and the move to the foot was the founder's on 2026-09-13. That decision was made FOR
THE PHONE; whether the desktop should follow it was never separately put. This proposal says it
should not. A horizontal row under the brand bar is also not the retired hamburger sidebar — it is
closer to the `.main-tabs` strip the web carried until that date.

⚠️ **Costs, both real:**
- `.aa-scrim` stops at `--bnav-h` precisely so the foot bar stays live. Move the bar and that
  expression is wrong; `--bnav-h` would need to publish 0 at desktop widths, or the scrim's inset
  overridden in the media block.
- **GuidedTour anchors `nav-classes`, `nav-lessons`, `grow-add` and `ask-aruvi` with
  `place: "above"`** — correct only while the items are at the foot. All four need `place`
  decided by width. This is why this item must not land before the tour has been walked (§4).

### 2b. Lists become grids

Six section cards in one column is a phone necessity, not a design intent. At wide widths the
card lists become `repeat(auto-fill, minmax(320px, 1fr))`, turning a scroll into a glance.

★ **Safe by construction:** CSS grid does not reorder the DOM, and the tour addresses its target
card by POSITION (`i === tourIdx`, on three separate elements) reading measured rects. Both
survive. The subject bands (2026-08-30) keep their headings; each band becomes its own grid.

### 2c. Density follows the POINTER, not the width

A fingertip is blunt and needs ~44px targets with air around them; a mouse pointer is one pixel
and needs none of it. That padding is load-bearing on the phone and pure waste on a laptop, and
it is a large part of why the web reads as a phone app.

★ **Use `@media (min-width: 900px) and (pointer: fine)`, never width alone.** Width gets a
touchscreen laptop wrong — wide, but still a finger. The pointer query asks the question that
actually matters. Tighten padding, row gaps and card chrome; leave type sizes alone (they are the
design's, §4, and the phone's `web.js` is generated from them).

### 2d. Ask Meyy docks as a side panel  (founder, 2026-09-19)

Ask Meyy is already declared a DESTINATION, not a modal: `aria-modal` is deliberately `false` and
the scrim deliberately stops short, on the reasoning that a panel you cannot leave is the one
screen with a single exit. The phone makes it full-height only because there is nowhere else for
it to go. A laptop has room for both.

- **It pushes, it does not overlay.** Floating it over the column covers the very thing she opened
  it to ask about. 860 + a ~420 panel = 1280, which fits a MacBook Air with room over. Below that
  width, today's overlay.
- **No scrim on desktop.** A dimmed backdrop states that everything behind it is inert. Once the
  panel is docked and she can keep working, that statement is false — and the dimming is the one
  thing that would keep it feeling like a phone modal.
- **Width: responsive default FIRST.** `clamp(380px, 30vw, 620px)` gets most of the benefit with
  no new chrome. Only if long answers still read cramped, add a **widen toggle with two states** —
  never a drag handle, which needs a hit target, a cursor change and a stored pixel value for a
  design system that is deliberately sparse. Persist the choice as a DEVICE setting that survives
  sign-out, the way `aruvi-text-size` does.

★ This and 2a solve each other's problem: the scrim's `--bnav-h` term exists only to keep the foot
bar reachable, and a right-hand panel never covers a TOP bar.

---

## 3. Considered and REJECTED

**"Sheets should become dialogs."** Proposed, then struck on reading the CSS: they already ARE
dialogs. `.ap-modal` is `width: 100%; max-width: 460px; max-height: min(82vh, 100%)` centred by
the overlay's `align-items: center` over a dimmed, blurred backdrop, radius 14px, with a shadow;
`.ap-confirm` narrows to 420px. On a laptop these render as proper web dialogs today, and
`max-height` is a ceiling rather than a height, so a two-line question stays a two-line card.
**Nothing to fix** — a dividend of the web having been designed mobile-first *with the phone in
mind* rather than as a phone app.

The one tuning worth doing: 460px is narrow for the dialogs carrying a SCROLLING LIST (the attach
picker). On a phone that width is the screen; on a laptop 560–640px shows several more chapters
without scrolling. One value inside a media block.

**Widening `--shell-w` globally.** Rejected — see §1. The measure is right for the lesson.

**A left sidebar rail.** Not proposed. It is a new structural element, and the top bar is already
there and underused (brand · gear · user, and nothing else since the tabs were removed).

---

## 4. Sequencing — why this waits for the walk

Settled 2026-09-19, and the founder's challenge is recorded because it was the right one:
*"why should we not do it now at the beginning of walk so we check if it is putting out correct
content in line with phone rather than postponing it"* — don't validate what you are about to
change.

Two things answer it:

1. **The tour anchors on the nav** (2a). The guided tour is one of the eight walk families and is
   the least-proven part of the product — the 2026-09-17 hand-off records four walks lost to
   anchor bugs. Moving the nav first destabilises, unwalked, the exact thing the walk verifies.
2. **A clean baseline separates two kinds of failure.** Redesign first and every oddity on the web
   raises an unanswerable question: real bug, or something broken an hour ago? Walk it as it
   stands and anything appearing afterwards is a regression, full stop.

And the re-walk cost is smaller than it looks: most rows in `docs/walk_tracker.html` check
**content and behaviour** — what the headline says, which error appears, whether the pointer
survives a restart — none of which a desktop media block touches. It invalidates the layout and
visual rows, perhaps 30–40 of the web's 232, and the tracker names exactly which.

**Therefore:**

| When | What |
|---|---|
| May land BEFORE the walk | **2b (grid)** and **2c (density)** — pure presentation, no logic, no anchors, no `--bnav-h` |
| AFTER the walk | **2a (nav)** and **2d (Ask Meyy)** — both touch the tour's anchors and the scrim |

---

## 5. Two traps, both already paid for once

★ **Every rule here lives INSIDE a `min-width` media block, never in a base rule.**
`mobile/theme/web.js` holds the web's styles measured from the LIVE WEB at 390px, and
`theme/tokens.js` is generated from `globals.css` by `theme/gen-tokens.py`. Touch a base value and
the phone app moves silently. `node mobile/theme/check-parity.mjs` is the guard — run it after any
edit here, and expect the divergence count to be unchanged.

★ **A same-specificity override placed BEFORE its base rule does nothing.** This file has bitten
three times: `.ap-row-line` (2026-08-27, the two-line portal rows), `.mlp2-vtab` /
`.mlp2-titleleft` / `.mlp2-archfolder` (2026-09-14, rendering at desktop size on every phone), and
the card-plane `:not()` chain (2026-08-30). Desktop media blocks go AFTER the rules they override.

---

## 6. Open questions for the founder

1. **The breakpoint.** 900px, or higher? A 1024px iPad in landscape is a touch device on a wide
   screen — 2c's `pointer: fine` handles the density half, but the nav move would still apply.
2. **The nav's resting place** — a row under the brand bar (proposed), or inline in the brand bar
   beside the wordmark? The second is tighter but crowds the mark.
3. **Does the widen toggle (2d) earn its chrome**, or is the responsive default enough?
4. **Hover.** Only `.sc-card:hover` and the Dropdown carry hover states today. Should the design
   system gain a standard hover treatment, or stay quiet?
