# THE WALK — hand-off after family X (written 2026-09-29)

Read `docs/walk_session_brief.md` first, then `walk_handoff_family04_done.md` (accounts, lessons);
this note records what changed since.

## Where things stand
- **Family X (cross-cutting): 13 of 19 rows pass on web, iPhone and Android** (n/a on web by
  design: X.08, X.18 phone-only; X.19 — the website stays light only, see 01.10/04.06).
- **Held for the special-state session** (with 01.18/19, 01.27–30, 02.30, 04.10, 04.32, 04.34,
  04.37, 05.26, 048):
  - X.02 save-failed banner — the read-back mismatch cannot be made by hand (the check runs a
    split second after the save; offline is "unverified" and silent). Needs a small TEST-ONLY
    switch that makes the read-back disagree.
  - X.03 empty My Classes + the third welcome sentence ("Tap + on a class to prepare its first
    lesson.") — needs a profile with no classes / nothing bound.
  - X.04 set-up check after first run + after a purchase — needs a never-set-up number.
  - X.05 a paid subject with no classes — 004 may still carry "Science with no classes".
  - X.13 first-run subject list retry — needs a never-set-up number.
  - X.14 paywall + lapsed — enforcement on + a spent trial.
  → Add a fresh number in Supabase (e.g. `919000000026=123456`) for X.03/X.04/X.13.
- **X.12 owes one half on a real build:** cold relaunch in airplane mode (Expo Go loses Metro).
- **Last amendment: WALK-A-150. Next: 151.** Open: 048 (parked), 077 (on watch), 142 (WhatsApp
  on the phone — walked except 04.34/04.37).

## What family X changed (all closed)
144 web: `.brand-mark` 19px rule moved AFTER the base rule in globals.css (source-order trap; the
wordmark had been 22px at every width) · 145 Assess item tabs one line, shrink only if they would
wrap · 146 phone keeps a per-teacher copy of her invoices (`aruvi_invoices_{user}`, swept at
sign-out via lib/session EXTRA) — Subscription & billing paints complete, works offline · 147
Android Settings keypad padding subtracts what the window already lost (no double inset under the
delete box) · 148 **new `mobile/lib/chrome.js`**: the shell publishes the MEASURED bar height;
statusBarTranslucent Modals (Sheet's hanging windows, chapter notes) open below it, + the status
bar on Android where insets.top is 0 · 149 Text size value in a fixed box pinned to the card's top
(founder chose: the card may still slide as cards above grow) · 150 chapter notes window stops
above the bottom nav.

## Test-account state (2026-09-29)
- 003: English·VI·Ch 16 on 6B now COMPLETED (X.10); 6B's name and periods a week restored after
  X.09; chapter note for Ch 16 cleared.
- 013, 015 used for OTP / sign-out rows only (no chapters spent).

## Still owed outside the code
- Push + Render redeploy for 135 (support refusal + cap) and 132 (export header) — unchanged.

## Uncommitted
Everything in family X: `web/app/globals.css`, `mobile/lib/chrome.js` (new),
`mobile/app/(app)/_layout.jsx`, `mobile/app/(app)/settings/{index,subscription}.jsx`,
`mobile/lib/session.js`, `mobile/components/{AttachSheet,TextSizeToggle}.jsx`,
`mobile/components/lesson/{AssessPanel,ChapterOrg}.jsx`, `data/testing/walk_state.json`, this note.
