# THE WALK — hand-off after family 02 (written 2026-09-27)

Read `docs/walk_session_brief.md` first; this note only records what changed.

## Where things stand
- **Family 02: 28/30 rows pass on web, iPhone and Android.** Still to walk:
  - on a TRIAL account (9000000004 or a fresh 0NN): **02.07** (empty profile), and the trial halves of **02.09** (pick screens skipped), **02.12** (trial sees every class, no note), **02.14** (last class removes the subject);
  - **02.30** (lapsed) — parked with the expired-subscription session.
- **Last amendment: WALK-A-113. Next: 114.** Open: 048, 077 (unchanged).
- Offline-wording decision still pending (see family-06 hand-off).
- 9000000003 now also holds **social_sciences/middle** (granted 2026-09-27 for 02.26).

## What family 02 changed (all closed)
101 Sections tile counts per subject (shared `profileStats`) · 102 Add › Class wheel in natural order, no clustering (Add window only) · 103 remove-section "Keep it" re-ticks · 104 "Untick all" on the Add window's sections and period-length wheels · 105 web period-length crash (`_get` orphaned by the shared move → `ppwAt`) · 106 web Add-window saves go through shared `saveReadiness` (pending + 15 s retry) · 107 phone editor kicker on one row (onTextLayout step-down) · 108 phone Sheet: with the keyboard up the window caps above it and scrolls the header away · 109 "Untick all" at the right end of the Chosen row · 110 the last period length can be unticked; Save disabled at zero · 111 split drop-down in the cell, 1 … X−1 (shared `splitChoices`; phone draws it in-editor, no second window) · 112 phone sections wheel shows 3 rows · 113 phone scrolling windows hang from under the app bar and use the height below.

## Known limit (not raised)
106: a reload before the 15 s retry lands does not re-send an edit to a NON-empty server profile — shared `fetchReadiness` adopts the pending copy only when the server is empty.

## Uncommitted
Everything above plus `walk_state.json`, `walk_tracker.html` (02.02 wording), family-06 fixes.
