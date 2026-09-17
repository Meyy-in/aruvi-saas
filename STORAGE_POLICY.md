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

## What to do, and how often

| Action | How | How often |
|---|---|---|
| **Push to GitHub** | commit + push `main` | Every working session. This is also the deploy. |
| **Mirror the Mac** | the rsync line below | Weekly, and before anything risky |
| **Dump Supabase** | `supabase db dump` → `backups/state/<date>.sql` | Monthly |
| **Confirm the Supabase plan is paid** | dashboard | Whenever billing changes |

```
rsync -avh --delete \
  "/Users/kumar_radhakrishnan/main/kumar/AI/aruvi-saas/" \
  "/Users/kumar_radhakrishnan/Library/Mobile Documents/com~apple~CloudDocs/kumar/AI/Aruvi-Saas/"
```

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
