---
name: disaster-recovery
description: Use when Kumar's Mac is lost, stolen, broken or unavailable, or he asks for a disaster-recovery drill — keeps Meyy running, locks down accounts and sets up a replacement laptop, all from the phone or any browser.
---

# Meyy disaster recovery (no Mac needed)

Kumar (founder and sole director, MEYY (OPC) PRIVATE LIMITED) is not technical. This skill must work
from the Claude app on his phone or any browser, with NO access to his Mac. Never assume a
connected folder or a device shell exists. Guide him ONE step at a time, telling him exactly what he
should see after each step, and wait for his reply before the next.

## Start: which situation?

Ask one question first (use the multiple-choice question tool if available):

1. **Lost or stolen** — security first (Phase 1), then everything else.
2. **Broken or dead** (no theft risk) — skip to Phase 2.
3. **Just away from it for a few days** — Phase 2 only.
4. **Drill** — a practice run: walk every phase as a simulation. Change nothing, click nothing
   destructive, rotate nothing. At each step ask "could you do this right now from your phone?",
   time it, and record every gap (a password he can't find, a device not signed in, a step that
   needed the Mac). End with the gap list and offer to add each gap to the tracker.

Write the date, situation and progress into the Meyy Company Setup tracker (claude.ai artifact
"Meyy Company Setup", step X7 notes) as you go, if the ArtifactData tool is available.

## What lives where (so he knows what is safe)

| Place | Holds | Mac loss means |
|---|---|---|
| GitHub `Meyy-in/aruvi-saas` | All code, lesson content, constitutions, saved plans, skills in `.claude/skills` | Safe — nothing lost |
| Supabase project `meyy` (Mumbai, ref npgqolatfnpvxaehdjiu) | Live teacher accounts, progress, notes, invoices | Safe — the app keeps running |
| Render service `meyy-api` | Runs the app; rebuilt from GitHub; holds no original data | Safe — keeps running |
| iCloud mirror (rsync from the Mac) | Everything on the Mac incl. textbooks (~1.7 GB), secrets (.env files, runtime_data/*.key) and `backups/state/` snapshots | Safe up to the last time it ran |
| The Mac only | Anything since the last iCloud mirror; the 02:00 nightly state snapshot job (launchd `in.meyy.pullstate`) | Snapshot job STOPS until a new machine runs it |
| Claude account | Account skills: meyy-support-desk, chapter, aruvi-kb-refresh, morning, disaster-recovery; memory; the tracker | Safe |

Other services (all reachable from a browser; logins are in his password manager):
Cloudflare Pages (www.meyy.in), Hostinger (meyy.in domain, login on Kumar's personal email),
Google Workspace (support@meyy.in), MSG91 (SMS, account "meyy"), Airtel DLT (support@meyy.in),
Meta WhatsApp Business (+91 93637 95723), Apple Developer / App Store Connect, Google Play Console,
Expo / EAS, Anthropic Console.

## Phase 0 — Is Meyy still running? (2 minutes)

Check for him (WebFetch if available, else ask him to open these on the phone):
- https://www.meyy.in loads.
- https://meyy-api.onrender.com responds (any page; the Support inbox at
  https://meyy-api.onrender.com/support-inbox opens and asks for its password).
Tell him plainly: teachers are not affected by a lost Mac. The app, sign-in SMS, WhatsApp support
and the database all run in the cloud.

## Phase 1 — Lock down (lost or stolen only; do within the first hour)

One at a time:
1. **Find My** (icloud.com/find or Find My on iPhone) → select the Mac → **Mark As Lost**. Erase it
   only once he accepts it will not come back (erasing stops location tracking).
2. **Apple ID**: change the password; check Devices list; remove the Mac once erased.
3. **Password manager**: change its master password; sign the Mac out of it.
4. **GitHub** (github.com → Settings): sessions → sign out the Mac; Developer settings → personal
   access tokens and SSH keys → delete any made for the Mac. Check org `Meyy-in` too.
5. **Secrets that sat in files on the Mac — rotate each** (create new, paste into Render, delete old):
   - `support_draft.key` → new random value → Render env `ARUVI_SUPPORT_DRAFT_TOKEN` (the
     support-desk skill's key). Keep the new one in the password manager.
   - `anthropic.key` → Anthropic Console → create new key, revoke old.
   - Database URL in `.env` (if present) → Supabase → Project Settings → Database → reset the
     database password → update Render `ARUVI_DATABASE_URL`.
   - Any other value in the Mac's `.env` files that is also a live credential.
   Not on the Mac (no rotation needed unless he copied them there): MSG91 authkey, Supabase SMS hook
   secret, WhatsApp token — they live in Render and the password manager. If unsure, rotate.
6. **Google (support@meyy.in and personal)**: Security → Your devices → sign out the Mac.
7. **Claude**: Settings → sign out other sessions; in the desktop app list, remove the lost Mac.
8. If a SIM or phone was lost too: block the SIM with the operator (Meyy mobile +91 93637 95723 is
   used for sign-in codes, WhatsApp Business and two-factor on several accounts).
9. File a police report if stolen (needed for insurance) — note the Mac's serial number from
   Apple ID → Devices.

After each rotation, check https://meyy-api.onrender.com still responds (Render redeploys when
env vars change; give it 3–5 minutes, then check).

## Phase 2 — Keep the business running without a Mac

What carries on by itself: the app, sign-in SMS (MSG91 via Supabase hook), WhatsApp, payments
records, the website.

What he does from the phone instead:
- **Support**: answer in the Support inbox (https://meyy-api.onrender.com/support-inbox) in the
  phone browser, and support@meyy.in in Gmail. The meyy-support-desk drafting skill needs the Mac
  (curriculum files + drafting key) — pause it; answer by hand or ask Claude for draft wording in
  chat.
- **Urgent code fix**: github.com → the file → pencil (edit) → commit to main. Render redeploys.
  Only for small, clear fixes; never during school hours (7–10 am IST).
- **Backups**: the nightly state snapshot has stopped. If the cloud backup (tracker X5) exists,
  confirm it ran last night. If not: on Supabase's Free plan there are no restorable backups, so
  the newest copy of teacher data is the last snapshot in the iCloud mirror. Note the gap and make
  Phase 3 a priority.
- **Statutory/company work**: the documents are in the iCloud mirror and the email trail; nothing
  in this list needs the Mac.

## Phase 3 — Replacement laptop

Recommend: an Apple Silicon MacBook Air (same family as before), bought same day if possible
(Apple Store, Croma, Reliance Digital, or Apple online with express delivery). Billed to the company
if the account is open; otherwise personal and reimbursed.

Set it up in this order, one step at a time:
1. Sign in with his **Apple ID** at setup; turn on **iCloud Drive** (and Desktop & Documents).
   Wait for the iCloud mirror folder to finish downloading (textbooks make it large).
2. Install the **password manager** and sign in.
3. Turn on **FileVault** (System Settings → Privacy & Security) and set a strong login password.
4. Install **Chrome**, then the **Claude desktop app**; sign in; install Claude in Chrome.
5. Install the developer tools — give exact Terminal commands:
   - `xcode-select --install`
   - Homebrew (from brew.sh, copy the one-line installer), then `brew install git python node gh`
   - `gh auth login` (GitHub, HTTPS, browser)
6. Recreate the project folder at the SAME path, so every script and launchd file still works:
   ```
   mkdir -p ~/main/kumar/AI && cd ~/main/kumar/AI
   git clone https://github.com/Meyy-in/aruvi-saas.git
   ```
7. Copy the things GitHub does not hold back from the iCloud mirror into the clone:
   `.env`, `web/.env.local`, `mobile/.env.local`, `runtime_data/` (keys — use the ROTATED values
   if Phase 1 ran), `textbooks/`, and `backups/state/`. Prefer copying these specific items over
   copying the whole mirror on top of the clone.
8. Dependencies: `cd ~/main/kumar/AI/aruvi-saas && npm install` (root), then in `web/` and `mobile/`
   as the repo README says; Python: `pip3 install -r api/requirements.txt` and
   `pip3 install "psycopg[binary]"`.
9. Reinstall the nightly snapshot (from `deploy/in.meyy.pullstate.plist`):
   ```
   cp deploy/in.meyy.pullstate.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/in.meyy.pullstate.plist
   launchctl kickstart -p gui/$(id -u)/in.meyy.pullstate
   cat backups/state/LATEST.txt
   ```
   LATEST.txt should show today's date.
10. Reconnect Claude: in a Cowork task, connect the folders `aruvi-saas`,
    `security_docs/legal/Meyy` and `Subscriptions` (recreate them from iCloud), so the
    meyy-support-desk, chapter and aruvi-kb-refresh skills work again.
11. Expo/EAS: `npm install -g eas-cli`, `eas login`; Apple/Google signing credentials are held by
    EAS and the store consoles, not the Mac.
12. Re-set the iCloud mirror (the rsync line he used before) and confirm it runs.

## Phase 4 — Prove it is back

Check each and tick it in the tracker:
- Tests pass: `cd ~/main/kumar/AI/aruvi-saas && python3 tests/test_sms_hook.py`
- The nightly snapshot ran (`backups/state/LATEST.txt` = today).
- Support desk skill drafts one reply (it can read the drafting key and the curriculum files).
- A sign-in SMS arrives on his own number.
- Write a 5-line incident note: what happened, when, what was lost (anything newer than the last
  iCloud mirror), what was rotated, what to improve.

## Rules

- Never ask him to paste a password, key or secret into the chat. He pastes them only into the
  service's own page (Render, Supabase…) and the password manager.
- Never run destructive steps (erase, delete keys, reset DB password) in Drill mode.
- Never run git or change files on his project folder unless he asks; he commits and pushes himself.
- Plain words, one step at a time, say what he should see.
