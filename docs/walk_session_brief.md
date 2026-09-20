# The WALK — session brief (read this first in a fresh Cowork thread)

Opened 2026-09-20. This is the standing brief for the three-surface walk. A new session starts
cold; this file plus `docs/walk_tracker.html` is how it picks up.

## 1. What the walk is, and what it is for

Every teacher-visible feature of Meyy is walked on **three surfaces** — the WEB app, the Expo app
on the founder's **iPhone 16**, and the same Expo app on an **Android emulator** — ticked off per
surface, with every fix recorded as an amendment. The point is not tidiness: it is that **the last
port to the App Store and Play must be a simple switch**, with nothing discovered at submission
that a walk would have caught.

236 items in 8 families, distilled from `docs/mobile_implementation_map/01..06`, the guided tour
and the map's cross-cutting rules.

## 2. The tracker

- Page: `docs/walk_tracker.html`, served at **`http://localhost:8000/api/testing/walk/tracker`**
- State: `data/testing/walk_state.json` (local only, outside the cloud migration unit)
- Router: `api/walk_tracker.py`, included from `api/main.py`
- Start the API from the repo root: `python3 -m uvicorn api.main:app --port 8000`

Four columns: **Web · iPhone · Android emu · Android real**. The real-device column is required
only on the 84 rows marked NATIVE (files, share sheet, keyboard, Back, storage, WebView, SVG,
fonts); elsewhere it shows "opt" and is optional. One pass at the end, from the Play internal
track — not now.

Claude can edit `walk_state.json` directly when the API is unreachable from the session.

## 3. Rules of engagement

1. **Walk, then fix. Never fix mid-walk.** The 2026-09-17 hand-off records four walks lost to
   fixes made without looking. The one exception is a **blocker** — a crash, or anything that
   stops the flow. Say so at once.
2. **The batch boundary is ONE SURFACE, with one refinement.** Web and phone are separate
   codebases, so web findings are reported when the web is done. iPhone and Android share the
   Expo code, so those two are reported together. → **web → fix → iPhone → Android → fix.**
3. **A fail needs words.** What you saw, in the cell. Then "Raise amendment", which records the
   fail and opens the amendment pre-filled. Keep walking.
4. **Fixed ≠ done.** An amendment set to `fixed-awaiting-rewalk` turns its cells amber; only a
   fresh pass turns them green. A fix in `packages/shared` or the API re-opens every surface.
5. Tick as you go. 32 rows is more than anyone reconstructs afterwards.

## 4. Front door & first run — the account plan

⚠️ **First run and the guided tour can only be walked ONCE PER ACCOUNT.** Once a teacher has a
profile and an attached lesson, those screens never appear again.

Test numbers (real SMS is parked on DLT; only these work, code **123456**):

| Number | State as of 2026-09-19 | Use |
|---|---|---|
| 919000000001 | 1 trial chapter left | LEAVE ALONE — it is the ready-made "trial nearly spent" state |
| **919000000002** | **3 chapters, clean** | **the first-run number — one chapter per surface** |
| 919000000003 | subscribed | the shared account for every OTHER family, on all three surfaces |

**The cycle, per surface:** sign in → first run → walk the **Guided tour** family straight after
(the offer appears the moment first run lands on My Lessons) → **Settings › Delete account** →
next surface. Deleting is itself a walk row that has never been walked, so it earns its place.

★ **The Choose screen is a DEVICE flag, not an account one.** `aruvi_device_seen` (see
`packages/shared/src/signout.js`) is set on first successful sign-in; a device carrying it opens
on "Who's planning today?" instead of the plan chooser. Only **erasure** clears it —
deliberately not a log out. So:
- **Web, first cycle:** use a **Chrome incognito window** at `localhost:3000`. Keep it open for
  the whole cycle; closing it loses the session and the chapter with it.
- **iPhone / Android:** no manual step — the delete flow calls `forgetDevice()` on both surfaces.
  The next sign-in landing on Choose *is* the evidence, and it is row 03.01.
- The web paints sign-in for an instant then flips to Choose; the phone shows no flash. Deliberate.

⚠️ **THREE CHAPTERS, THREE SURFACES, ZERO SLACK.** First run generates a lesson, which spends one.
Retrying the SAME chapter within one account is free; a delete-and-rejoin is not. So **before
starting, fetch `ARUVI_TRIAL_LEDGER_KEY` from the Render dashboard** — with it,
`ledger-forget 919000000002` restores a spent trial and the constraint disappears. Without it, one
bad cycle costs a surface.

```
export $(grep -v '^#' .env | xargs)
export ARUVI_STATE_BACKEND=postgres
export ARUVI_TRIAL_LEDGER_KEY='<from the Render dashboard>'
python3 aruvi-scripts/entitlement.py ledger-status 919000000002
```
⚠️ `entitlement.py` reads only real env vars — it does NOT load `.env`. Without the exports it
silently inspects LOCAL files and reports `null` for everything.

## 5. Rows to SKIP for now

Some need a state a clean account cannot reach. Leave them pending and ask:
the paywall and lapsed (needs enforcement + a CLI revoke) · a 402 during first run · the
privacy-notice update bar (needs a version bump server-side) · the academic-year cutover.

## 6. Environment

- Both phones run from ONE window: `cd mobile && npx expo start --tunnel`; scan for the iPhone,
  press **a** for the emulator. Same bundle, so a fix reloads on both.
- Emulator: **Pixel 7, API 34** (Android 14). The newest image fought the on-screen keyboard.
  `hw.keyboard=no` is set in the AVD config. A second AVD, **Meyy small phone** (720×1280 →
  360×640, API 33), is for tight-spot checks only — one emulator at a time.
- ⚠️ **The Expo web preview (`localhost:8081`) NEVER earns an Android tick** — no hardware Back,
  no soft keyboard, no expo-sqlite, no share sheet, no edge-to-edge.
- Both apps talk to **Render**, not the local API. The local API on :8000 only serves the tracker.
  So an API-side fix needs a push and a redeploy before any surface shows it.
- Keep the tracker in a NORMAL Chrome window, the app in incognito.

## 7. State as of 2026-09-20

- Smoke test passed on the Pixel 7. Two amendments raised and closed: **WALK-A-001** (Support's
  Send hidden behind the iPhone keyboard) and **WALK-A-002** (the Android bottom nav riding on
  top of the keyboard — it now hides while the keyboard is up, matching the iPhone).
- **Nothing is committed.** `api/walk_tracker.py`, `docs/walk_tracker.html`, the include in
  `api/main.py`, `mobile/app/(app)/settings/support.jsx`, `mobile/components/BottomNav.jsx`,
  `deploy/in.meyy.pullstate.plist`, `STORAGE_POLICY.md`, and the new docs
  (`web_desktop_view.md`, `going_live.md`, this file).
- **Do not touch `web/app/globals.css`.** The desktop-view work (`docs/web_desktop_view.md`) is
  deliberately held until the walk is done, so web ticks stay valid.

## 8. Related

`docs/web_desktop_view.md` — the proposed website-view changes, held until after the walk.
`docs/going_live.md` — hosting, DNS, and the store listings' public-page blocker.
