# THE WALK — hand-off after family 01 (written 2026-09-27)

Read `docs/walk_session_brief.md` first; this note only records what changed since
`walk_handoff_family02_done.md`.

## Where things stand
- **Family 01 (the shell): every walked row passes on web, iPhone and Android.**
  - **01.10 web = n/a** — founder decision: the website stays light only; Appearance/dark is a phone feature.
  - **01.18 / 01.19 pending** — since the 2026-09-18 rule, adding a class to a stage she already holds raises NO
    check window; only a NEW subject-stage arriving by checkout does. Park with the subscribe session (01.27/01.28).
  - **Not walked, as planned:** 01.24 (privacy-notice bump), 01.25 (hard to provoke), 01.27–01.30 (enforcement /
    lapsed / academic year) — park with the expired-subscription and prior-year sessions.
  - **01.05 on phones** was walked with the API unreachable (EXPO_PUBLIC_API_URL → meyy-api.invalid), because in
    Expo Go airplane mode also cuts off Metro and the app cannot relaunch. TRUE airplane-mode cold launch is owed on
    the installed-build (real device) pass.
- **Last amendment: WALK-A-124. Next: 125.** Open: 048 (parked), 077 (on watch) — unchanged.

## What family 01 changed (all closed)
115 My Classes opens fully loaded: the list holds behind "Loading your classes…" until the bindings are known and every
bound card's lesson list has answered (6 s cap) — web MyPlans + phone index · 116 no "Your teaching profile" heading
under the ⚙ bar (web) · 117 ADD lights while its window is up (web `navWin`, phone `active="add"`) · 118 Add sub-line
"Pick a row to change that part of your teaching profile." · 119 the full profile opened from the window's footer
closes back to the window (web `fullProfileWinRef`, phone `profileWinRef`) · 120 shared `confirmListed()` — the
preparing card comes down only when her list carries the lesson AS PREPARED; otherwise failed with "To see your
lesson, tap Try again once you're connected." · 121 preparing from a section's "+" scrolls that card into view (order
kept) · 122 shared `subscribeAccount()` — a saved name reaches the phone bar and greeting at once · 123 phone My
Lessons seeds its wheels from storage at first render (the RollWheel child effect was overwriting the saved choice on
every remount) · 124 Android raises the window 320 ms after the back animation.

## Test accounts (2026-09-27)
- New test numbers used and ERASED: 9000000021 (web), 9000000022 (iPhone), 9000000023 (Android) — each re-signed-in
  once after erase, so each now holds a fresh first-run account.
- Others unchanged (003 main · 013/011 trials · 015 · 004 not a trial · 017 won't sign in).

## Environment lessons (2026-09-27)
- Run Expo from `mobile/` (`npx expo start --lan --clear`); from the repo root npx offers to install Expo afresh.
- ngrok `--tunnel` can fail outright — `--lan` is the default.
- `mobile/.env.local` beats a shell `EXPO_PUBLIC_API_URL=` — to point the phones elsewhere, edit the file and restart
  with `--clear` (restore it afterwards).
- Web offline tests: DevTools › Network › right-click a `meyy-api` row › **Block request domain** (or ⌘⇧P › "block").
  A plain Offline + reload only shows Chrome's own offline page.

## Uncommitted
Everything above plus `walk_state.json` and this note, on top of the family-02 hand-off's uncommitted list.
