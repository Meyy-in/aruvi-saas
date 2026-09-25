# THE WALK — hand-off for family 06 (written 2026-09-24)

## What THE WALK is
A three-surface acceptance walk of the Meyy app — **web** (localhost:3000 → Render API meyy-api.onrender.com), **iPhone** (Expo Go) and **Android emulator** (dev build) — row by row against `docs/walk_tracker.html` (the FEATURES list), with verdicts and amendments recorded in `data/testing/walk_state.json`.

## Working method (unchanged)
- Claude says what to do; Kumar runs it and reports; Claude records the verdict in `walk_state.json` directly with python over the device shell (the API on :8000 is not reachable).
- Amendments are numbered **WALK-A-NNN** — last used **WALK-A-086**; the next is **087**.
- Rules: never fix mid-walk except a blocker; a fail needs words; fixed ≠ done; a re-walk is recorded by appending "✓ re-walked {date} after WALK-A-0NN" to the cell comment and closing the amendment only on that evidence.
- Cycle per family: **web walk → web fix point → phone walk (iPhone + Android together) → phone fix point.** Rows in batches of ~4, one message each; Kumar answers per surface.
- Copy is Kumar's: propose drafts, he approves wording. Keep explanations simple.
- Cell format: `{"status","by":"Kumar","at","comment","build"}` — build "Expo Go" (ios), "dev build" (and_emu).

## Accounts (10-digit, OTP 123456 — only for numbers added in Supabase › Auth › Phone › test numbers)
- 9000000001 leave alone · 9000000002 trial · **9000000003 subscribed, the shared main account** · 9000000004 trial, expendable (Science with no classes, lessons for VI and VII).
- Test numbers added today: 9000000009 (erased/rejoined, trial spent, in Subscribe) · 010 (trial left, backed out at Pay) · 011 · 012 (erased + rejoined on web) · 013 · 014 · 015 · 016 · 017. Add more in Supabase as `9190000000NN=123456` when a fresh account is needed.

## Environment notes
- Phones: `npx expo start --lan` in `mobile/`; reload from the device (iPhone shake → Reload; emulator Cmd+M → Reload) and confirm an "iOS/Android Bundled" line in the Expo terminal — if "No apps connected", the phones are on a stale bundle (this caused false fails today). Emulator link: `adb reverse tcp:8081 tcp:8081`, then `a`.
- Server changes need `git push` (Render autodeploys main). Always `rm -f .git/index.lock` before committing (the session's git reads can leave one).
- Checks: `cd mobile && node check-tdz.mjs <files>` (works on web files too); shared tests `cd packages/shared && npm test` (238/238 at hand-off); API via FastAPI TestClient with `ARUVI_DATA_DIR=/tmp/t070/content ARUVI_STATE_DIR=/tmp/t070/state PYTHONPATH=.` on a scratch copy.
- **Uncommitted at hand-off:** web ← Back on the trial-or-subscribe window (WALK-A-042 web half: `web/app/components/SubscribeFlow.jsx`, `web/app/globals.css`) + `walk_state.json`. Commit with the next push.

## Where things stand
- **Done on all three surfaces:** families **03, T, 05**. Family 05: 28/28 walkable rows pass everywhere; 05.11 / 05.12 / 05.19 / 05.26 (and the lapsed half of 05.21) parked.
- **Amendments:** 81 closed, 3 closed-no-defect, 2 awaiting: **048** (parked with the expired-subscription session) and **077** (401 → sign-out on the phones; verified by code, on watch — any unexplained phone sign-out points here).
- **Founder decisions today:** 055, 056, 059 and the 40-second OTP wait — ignored/closed. 086: a returning sign-in with the trial spent and nothing set up goes to Subscribe; with trial left → first run (not forced to pay).
- **Still open for a founder decision (not blocking):** a warning at sign-out when progress (080) or a first-run profile (085) has not reached Meyy yet; archive/restore using the same save-until-online queue as progress marks.
- **Special sessions still owed:** (1) year rollover on a throwaway account → 05.11, 05.12, 05.19, the year rows of family 01, two unexercised clauses of 05.04; (2) expired subscription → lapsed half of 05.21, 05.26, lapsed rows of family 01, 048.

## Next: family 06 — the lesson itself (30 rows)
Groups: Opening a lesson (4) · Chapter organization (6) · Chapter notes (5) · Unit view (4) · Bookmark & completion (5) · Assess tab (6). Start with the **web walk** on 9000000003, 4 rows per batch, from `docs/walk_tracker.html` (rows `06.xx`, fields how / expect / divergence / android_watch).
Then: families 02 (profile & Add window), 01 (app shell), 04 (Settings), X (edge cases), each through the same cycle.

## Settled founder rules worth remembering
- The Settings teaching profile is READ-ONLY; every edit goes through **Add** on the bottom bar. Copy says "the Add window from the bottom tool bar".
- LO DOES show in the lesson plan (PDF and Word).
- First run repeats until her first lesson actually exists.
- Download names: `{Subject}-{class}-{LP|Assess|Assess-Answers|LP-Assess|LP-Assess-Answers}-{chapter name}[-Unit n]`, Year Plan `{Subject}-{class}-YearPlan.docx`; Roman class.
- Prepare-again at the same length is greyed (the grey equivalent of the clay bar); a different length makes a second plan.
- Toasts are plain paper boxes above the bottom bar; failures are said in the window, never alert().
