# Storage & Backup Policy

**Last reviewed: 2026-09-17**

## The principle

**Disaster recovery, not version history.** We protect against losing a *machine* or an
*account*. We do not keep versions, and we do not offer teachers retrieval of anything they
deleted — the privacy notice promises chapter notes have no history, and we mean it. A wrong
section, a misplaced bookmark, a cleared note: the teacher fixes these herself in seconds.
Nothing in Meyy today is a disaster she cannot undo by hand.

## Where data lives

| Place | Holds | Written by |
|---|---|---|
| **The Mac** | Everything — code, content, authoring IP, textbooks (4 GB) | Kumar |
| **GitHub** (`Meyy-in/aruvi-saas`) | Everything on the Mac except the named exceptions below | `git push` — which also redeploys Render |
| **iCloud mirror** | Everything on the Mac, textbooks and secrets included | the rsync one-liner |
| **Supabase Postgres** | Live teacher state only (accounts, profiles, progress, notes, invoices) | the running app, never the Mac |
| **Render** | Nothing original — a rebuilt copy of the content, plus a disused disk | the deploy, from GitHub |

## What GitHub does NOT hold — the complete list of exceptions

Everything is tracked **unless** it is one of these. There is no other exclusion.

- **Secrets** — `.env`, `web/.env*.local`, `mobile/.env*.local`, `*.key`
- **Textbooks** — `/textbooks/` (1.7 GB of source PDFs; authoring input only)
- **Regenerable** — `node_modules/`, `web/.next/`, `web/out/`, `/out/`, `mobile/ios/`,
  `mobile/android/`, `mobile/.expo/`, `mobile/dist/`, `.venv/`, `__pycache__/`, `*.pyc`,
  `.pytest_cache/`, `build/`, `dist/`, `*.egg-info/`
- **genon scratch** — prompt dumps and parsed canonicals under `genon/out/`
  (the raw model replies ARE tracked — they are evidence, not scratch)
- **Noise** — `.DS_Store`, `*.tmp`, `.devlogs/`

Everything under `data/` is tracked on purpose — constitutions, chapters, framework, saved
plans and the state tree. The iCloud mirror is what covers the exceptions, textbooks and
secrets above all.

## What `data/cloud/state/` is now

Since the Supabase cutover it is **not** a copy of production and must never be treated as
one. It has exactly two live jobs:

1. **The local dev database.** No `ARUVI_STATE_BACKEND` in `.env`, so local runs and tests
   read and write these files. This is why it stays.
2. **Three build seeds** — `invoices/_series/`, `support/_series/`, `consents/_ledger/` are
   copied into the Docker image so numbering continues on an empty disk.

Everything else in it is frozen test data from before the cutover. **Live teacher state never
lands here.** A pull from Supabase goes to `backups/state/<date>/`, gitignored — or real
teachers' records end up on GitHub.

## Render holds no original data

Render is compute, not storage. `Dockerfile` copies `data/cloud/content/` into the image at
build time from the GitHub clone, so the content on Render is a **build output**: it lives in
the container's ephemeral filesystem and is wiped and recreated on every deploy and restart.
GitHub and the Mac are its only durable homes. The served-plan cache under `saved_plans/` is
written there at runtime and lost the same way — by design, it rebuilds in milliseconds.

Render does snapshot the one persistent disk (`aruvi-state` at `/var/aruvi`) daily, kept at
least seven days and restorable from the dashboard. But since the Postgres cutover that disk
holds nothing current — pre-cutover state, plus seed copies the entrypoint still writes at
boot that nothing reads. It is being faithfully backed up and there is nothing on it worth
restoring. **Nothing on Render needs backing up by us.**

## Invoices are records, not state — treat them apart

Everything else in Bucket B is **current state**: one bookmark, one profile, one section
binding. If it were lost the teacher restores it herself in seconds, which is why none of it
needs a recovery window at all.

Invoices are the exception, and they are the opposite in every respect. They **accumulate**,
they **outlive the teacher's account** on purpose, they must be kept **8 years** as books of
account (Companies Act 2013 §128 — the privacy notice and the erasure receipt both promise
it), and they are **unreconstructable**: the PDF is stored rather than re-rendered precisely
so the bytes she was mailed never change. The seller's counter at `invoices/_series/` is a
single document whose loss restarts numbering.

An 8-year duty is not covered by a 7-day backup window. So invoices get their own answer:

1. **The mailbox is the real second copy.** Every subscription confirmation mails the invoice
   PDF as an attachment, and those stay in the business mailbox for the same 8 years. Confirm
   this is live — the container prints `[aruvi] mail: SENDS as …` or `FILE OUTBOX — nothing
   will send` at boot. If it says FILE OUTBOX, no invoice has ever been mailed and Supabase is
   the only copy that exists.
2. **BCC a founder address on invoice mail**, so a permanent dated copy is filed the moment an
   invoice is issued rather than whenever a dump next runs.
3. **The monthly dump covers the structured record** (amounts, lines, GST note, seller name)
   that the PDF alone does not.

## What to do, and how often

| Action | How | How often |
|---|---|---|
| **Push to GitHub** | commit + push `main` | Every working session. This is also the deploy. |
| **Mirror the Mac** | the rsync line below | Weekly, and before anything risky |
| **Dump Supabase** | `supabase db dump` → `backups/state/<date>.sql` | Monthly — and before anything destructive |
| **Confirm invoice mail is sending** | Render logs, the `[aruvi] mail:` line at boot | After any deploy that touches mail config |
| **Confirm the Supabase plan is paid** | dashboard | Whenever billing changes |

```
rsync -avh --delete \
  "/Users/kumar_radhakrishnan/main/kumar/AI/aruvi-saas/" \
  "/Users/kumar_radhakrishnan/Library/Mobile Documents/com~apple~CloudDocs/kumar/AI/Aruvi-Saas/"
```

## If the Mac is lost

**Teachers are unaffected.** Render, Supabase and the apps never touch the Mac. This is a
lost workshop, not an outage — do not rush a fix from a borrowed machine.

**Until the new one arrives**, everything needed is in a browser: Render (logs, restart,
roll back), Supabase (SQL on `documents`), GitHub (read, and edit-and-commit, which deploys),
Gmail (support). Local dev, the genon pipeline and the founder CLI all stop. A teacher who
pays meanwhile cannot be granted her subscription — her trial (3 chapters, no time limit)
carries her; tell her activation follows within two days. Edit content from GitHub web if
you must, never code: a push deploys and nothing can be tested first.

**On the new Mac** — not simply an iCloud download:

1. `git clone` from GitHub — canonical and integrity-checked.
2. From iCloud, restore only the three things git does not hold: `textbooks/`, `.env`,
   `runtime_data/anthropic.key`. That is the entire delta.
3. Rebuild: Node, Python 3.12, Xcode CLI tools · `npm install` at the repo ROOT (workspace —
   `--prefix web` alone won't link `@aruvi/shared`) · `pip install -r api/requirements.txt` ·
   in `mobile/`, `npm install`, `npx expo install --fix`, `.env.local` from the example.
4. Reinstall the Claude desktop app and re-paste the `chapter` and `canonical` skills into
   Settings › Capabilities.

⚠️ **The weak point is credentials, not files.** The files are covered three times over;
access to them may not be. Confirm the password vault and the 2FA codes for GitHub, Render,
Supabase and the Apple ID are reachable **from the phone alone**. Also confirm `.env` is
visible at icloud.com — it is a dotfile, and the web interface may not list it. Check both
now, not then. (GitHub is safe either way: the remote is HTTPS, so a fresh token from a
browser restores push access — there is no SSH key to lose.)

## The three things this policy is actually guarding against

1. **The Mac dies.** Covered twice over — GitHub for everything but the exceptions, iCloud
   for everything including them.
2. **The Supabase project disappears** — deletion, or a lapsed card. Supabase's own backups
   die with the project, so the monthly dump is the only thing that survives this. It is the
   sole reason the dump exists.
3. **Something destructive runs against the live database.** Supabase's daily backups cover
   this on a paid plan, within their retention window.

⚠️ **This policy assumes Supabase is on a paid plan** (daily backups, 7-day retention). On the
Free plan there are **no backups of any kind**, and the monthly dump stops being belt-and-braces
and becomes the only copy of every teacher's account that exists anywhere. Check this before
the first teacher pays.

*Note: `rsync --delete` mirrors rather than accumulates — a file deleted on the Mac goes from
iCloud too. That is the right trade for disaster recovery, and iCloud's own 30-day recovery
for deleted files is the backstop.*
