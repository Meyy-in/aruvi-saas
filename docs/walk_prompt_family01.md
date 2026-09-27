# Prompt to start family 01 in a new Cowork thread

Paste everything below the line into a new Cowork conversation with the `aruvi-saas` folder connected.

---

We're continuing THE WALK of Meyy — family **01 · the shell** (32 rows: Boot & sign-in · Top bar & Settings bar · Bottom nav · Set-up window (Add / check) · Ask Meyy & notices · Trial, lapsed & year).

Before anything else, read in this order:
1. `docs/walk_session_brief.md` — the standing brief (rules of engagement, accounts, environment).
2. `docs/walk_handoff_family02_done.md` — the latest state, amendments to date, test accounts, and the web-cache lesson.
3. The family 01 rows: `docs/walk_tracker.html` (the `FEATURES` array, `family: "01"`) and their state in `data/testing/walk_state.json`.

State: families 03, T, 05, 06 and 02 are done on web, iPhone and Android. **Last amendment WALK-A-114 — next is 115.** Open: 048 (parked, lapsed session) and 077 (on watch). 01.11 already passes on iPhone and Android.

How we work (same as family 02):
- **Web first on 9000000003**, then a web fix point, then iPhone + Android together, then a phone fix point. Walk, then fix — never mid-walk, except a blocker (crash / flow stopped).
- Give me rows in **batches of about 4–6**, one message each: what to tap and what to check, in plain words; mark Android-only checks [A]. I answer per row; you record every result straight into `walk_state.json` (cell: status, by "Kumar", at, comment, build) and raise amendments there for fails or my change requests.
- For anything that needs a decision from me, ask with options and a recommendation. Copy (wording) is mine — propose drafts.
- Before a fix: read the code; after: parse-check the changed files and run `node --test` in `packages/shared`. After any `packages/shared` change, if the web doesn't pick it up: `./dev.sh stop && rm -rf web/.next && ./dev.sh`, ⌘⇧R, sign in again. Phones: `npx expo start --lan` in `mobile/`, press r to reload.

Rows that need a special state — flag them, don't force them:
- **01.03** new teacher → first run: needs a fresh number that has never set up (add one in Supabase test numbers if needed).
- **01.32** Erase my account: destructive — only on an expendable number, never 9000000003.
- **01.05 / 01.21** offline: DevTools Offline on the web, airplane mode on the phones.
- **01.24** privacy-notice update bar: needs a server-side version bump — skip unless we set it up.
- **01.27** paywall and **01.28** Subscribe on the phone: need a trial account with enforcement ON — likely park with 05.26.
- **01.29** lapsed and **01.30** new academic year: park with the expired-subscription and prior-year sessions.

Test accounts: 9000000003 (subscribed, main) · 9000000013 / 011 (trials, English, generated) · 015 (subscribed middle) · 017 won't sign in · 004 is NOT a trial. OTP 123456.

Start by confirming what you read in two or three lines, then give me the first batch (01.01 onward) for the web.
