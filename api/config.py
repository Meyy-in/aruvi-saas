"""API config — the data layer, laid out along the cloud/local boundary (2026-08-23).

`data/cloud/` is the literal migration unit — everything under it goes to production
(CLOUD_DATA_MODEL.md §0.5). Two seams live under it, kept strictly apart (§0):

  DATA_DIR    — Bucket A-serve: shared, read-only CONTENT the runtime reads (chapter
                mappings, framework glossaries/spine map, allocation norms, saved plans =
                canonical libraries + served-plan cache). Default:
                aruvi-saas/data/cloud/content/. Env override: ARUVI_DATA_DIR.
                The cloud object store replaces this.

  STATE_DIR   — Bucket B: per-user / per-tenant STATE the app writes at runtime
                (accounts, academic years, readiness, allocations, section state,
                prepared plans, plan archive, plan notes). Default:
                aruvi-saas/data/cloud/state/. Env override: ARUVI_STATE_DIR.
                Supabase Postgres replaces this folder.

  TESTING_DIR — the founder's testing-campaign state (api/testing_campaign.py).
                LOCAL-only, never syncs; deliberately outside data/cloud/. Default:
                aruvi-saas/data/testing/. Env override: ARUVI_TESTING_DIR.

Founder-secure authoring content (constitutions, chapter summaries) lives at
data/authoring/ and is read ONLY by the genon pipeline / chapter skill — never from
api/ or aruvi_core/ (§0.5's grep-able invariant). Paths are derived from this file's
location (never hardcoded to a machine); env vars override for other layouts.
"""
import os
from pathlib import Path

# Repo root derived from this file: api/config.py → parent.parent.
_REPO_ROOT = Path(__file__).resolve().parent.parent

# Bucket A-serve — read-only runtime content, at data/cloud/content/.
_DEFAULT_DATA = str(_REPO_ROOT / "data" / "cloud" / "content")
DATA_DIR = os.environ.get("ARUVI_DATA_DIR", _DEFAULT_DATA)

# Bucket B — per-user/tenant state, at data/cloud/state/ (subfolders per state kind).
_DEFAULT_STATE = str(_REPO_ROOT / "data" / "cloud" / "state")
STATE_DIR = os.environ.get("ARUVI_STATE_DIR", _DEFAULT_STATE)

# Testing-campaign state — local-only, outside the migration unit.
_DEFAULT_TESTING = str(_REPO_ROOT / "data" / "testing")
TESTING_DIR = os.environ.get("ARUVI_TESTING_DIR", _DEFAULT_TESTING)

# ── State backend (Track C, 2026-09-09) ─────────────────────────────────────────
# Where Bucket B lives. Every repository adapter takes a DocumentBackend
# (aruvi_core/adapters/document_backend.py) and `state_backend()` below builds THE one:
#   file      — the folder tree at STATE_DIR (default; local dev, tests, the Render disk)
#   postgres  — one `documents` table at DATABASE_URL (Supabase). Migration:
#               aruvi-scripts/migrate_state_to_postgres.py
# The ports and every route are identical in both; only this switch differs.
STATE_BACKEND = os.environ.get("ARUVI_STATE_BACKEND", "file").strip().lower() or "file"
DATABASE_URL = os.environ.get("ARUVI_DATABASE_URL", "").strip()


def state_backend():
    """Construct the configured Bucket-B backend. Called once by api/main.py (and by
    the founder scripts), never per request."""
    from aruvi_core.adapters.document_backend import FileBackend, PostgresBackend
    if STATE_BACKEND == "postgres":
        if not DATABASE_URL:
            raise RuntimeError("ARUVI_STATE_BACKEND=postgres needs ARUVI_DATABASE_URL")
        return PostgresBackend(DATABASE_URL)
    return FileBackend(STATE_DIR)

# ── Identity provider (Track B, 2026-09-09) ────────────────────────────────────
# AUTH_PROVIDER picks the adapter behind the AuthProvider port:
#   header    — the X-Aruvi-User dev stub (default; what every local run and test uses)
#   supabase  — Supabase Auth: the request carries `Authorization: Bearer <access token>`,
#               verified offline (aruvi_core/adapters/supabase_auth_provider.py). X-Aruvi-User
#               is IGNORED in this mode, so a forged header buys nothing.
# SUPABASE_URL is the project URL (https://<ref>.supabase.co); SUPABASE_JWT_SECRET is the
# legacy HS256 secret, needed only for projects (or tests) still signing with it.
AUTH_PROVIDER = os.environ.get("ARUVI_AUTH_PROVIDER", "header").strip().lower() or "header"
SUPABASE_URL = os.environ.get("ARUVI_SUPABASE_URL", "").strip()
SUPABASE_JWT_SECRET = os.environ.get("ARUVI_SUPABASE_JWT_SECRET", "")

# ── CORS (Track A, 2026-09-09) ─────────────────────────────────────────────────
# Browser origins allowed to call the API, comma-separated. "*" (the default, and what
# every local dev setup wants) keeps the open behaviour the API has always had. On the
# deployed host set it to the web channel's origin(s). Native apps send no Origin header,
# so this fences the WEB channel only — the identity check (_current_identity) is the
# fence that applies to everyone.
CORS_ORIGINS = [o.strip() for o in os.environ.get("ARUVI_CORS_ORIGINS", "*").split(",")
                if o.strip()] or ["*"]

# ── Entitlement (administrative architecture Step 5) ────────────────────────────
# ENTITLEMENT_ENFORCED: the gate in front of generation. Default OFF — the seam is
# fully built and tested, but daily dev is undisturbed until the founder flips it
# (set ARUVI_ENTITLEMENT_ENFORCED=1) for persona testing and at launch.
ENTITLEMENT_ENFORCED = os.environ.get("ARUVI_ENTITLEMENT_ENFORCED", "").strip().lower() in (
    "1", "true", "yes", "on")

# TRIAL_CHAPTER_CAP: the free trial covers ANY N chapters across all subject-stages,
# with unlimited re-serves per chapter (period-fitting takes several attempts — that IS
# the trial; docs/subscription_model_discussion.md §0). Counted in CHAPTERS, never
# serves. Empirical; env-overridable for the field test.
TRIAL_CHAPTER_CAP = int(os.environ.get("ARUVI_TRIAL_CHAPTERS", "3"))

# TRIAL LEDGER (founder, 2026-09-18): a free trial is once per mobile number, including across
# an account erasure. The number is stored only as an HMAC under this key — SET IT on every real
# deployment (Render secret) and never rotate it casually: a new key orphans every entry, which
# silently reopens the loophole. The dev fallback exists so a fresh clone runs; the API prints a
# warning at startup while it is in use. Retention: entries are forgotten after this many days
# (Privacy Notice §7 states 24 months — change both together).
TRIAL_LEDGER_KEY = os.environ.get("ARUVI_TRIAL_LEDGER_KEY", "").strip()
TRIAL_LEDGER_DEV_KEY = "meyy-dev-trial-ledger-key-not-for-production"
TRIAL_LEDGER_DAYS = int(os.environ.get("ARUVI_TRIAL_LEDGER_DAYS", "730"))

# PRICE_PER_SUBJECT_STAGE (₹/year): the working figure from the subscription-model
# discussion (§0 — ₹500 pending the field test). Config, never code; the onboarding
# cart reads it via GET /entitlement.
PRICE_PER_SUBJECT_STAGE = int(os.environ.get("ARUVI_PRICE_PER_SUBJECT_STAGE", "500"))

# ── Invoicing (2026-08-26) ─────────────────────────────────────────────────────
# Aruvi is NOT GST-registered today (founder's call), so an invoice carries no GSTIN
# and no tax row — it says so in words instead, because a "₹0.00 tax" line reads like a
# rate that happens to be zero rather than a seller who does not charge it. The day
# registration happens: set ARUVI_GSTIN (and ARUVI_TAX_RATE, a percentage) and the
# document grows its tax rows. TAX_INCLUSIVE says whether PRICE_PER_SUBJECT_STAGE
# already contains the tax — the answer changes what she PAYS, so it is stated, never
# assumed.
GSTIN = os.environ.get("ARUVI_GSTIN", "").strip()
TAX_RATE = float(os.environ.get("ARUVI_TAX_RATE", "0") or 0)
TAX_INCLUSIVE = os.environ.get("ARUVI_TAX_INCLUSIVE", "1").strip().lower() in (
    "1", "true", "yes", "on")
TAX_LABEL = os.environ.get("ARUVI_TAX_LABEL", "GST").strip() or "GST"
# What the seller's books call this financial year's series. Indian FY runs April→March,
# which is also the academic-year anchor already in the code.
# ★ MEY since 2026-09-03 (founder: the series follows the name). The counter under
# invoices/_series/ is keyed by financial year only, so the prefix change does not restart
# it — numbers issued as ARV/… stay valid records; new ones read MEY/2026-27/NNNN.
INVOICE_PREFIX = os.environ.get("ARUVI_INVOICE_PREFIX", "MEY").strip() or "MEY"
# ★ THE SELLER'S LEGAL NAME (founder, 2026-09-03). Printed on the invoice and in the tax
# note — an Indian invoice names the registered entity, not the brand. "Meyy" alone is the
# brand; this is the company. Change it only when the registered entity does.
SELLER_NAME = os.environ.get("ARUVI_SELLER_NAME", "").strip() or "Meyy (OPC) Private Limited"
# ★ Each financial year's series OPENS here, not at 1 (founder, 2026-08-26). The number
# is the one part of an invoice a customer can read volume from, and "0001" tells an
# early teacher she is the first sale Aruvi ever made. An offset, not a fiction: the
# series is still gapless and still counts real invoices.
INVOICE_START = int(os.environ.get("ARUVI_INVOICE_START", "7834"))

# ── Outbound mail (administrative architecture Step 6 — the Notifier port) ──────
# Credentials NEVER live in the repo. With SMTP_HOST/USER/PASSWORD all set, main.py
# installs SmtpNotifier and confirmations really send; otherwise FileNotifier writes
# them to STATE_DIR/outbox/ and nothing leaves the machine. For Gmail, PASSWORD must
# be an APP PASSWORD (2-step verification on) — the account password is refused.
SMTP_HOST = os.environ.get("ARUVI_SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("ARUVI_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("ARUVI_SMTP_USER", "").strip()
SMTP_PASSWORD = os.environ.get("ARUVI_SMTP_PASSWORD", "")
# ★ THE ONE SUPPORT ADDRESS (founder, 2026-09-03: support@meyy.in). It is what a teacher
# is told to write to, where every Aruvi mail's replies land, and where each filed
# support case is delivered. Sender identity (MAIL_FROM) stays separate: Gmail rewrites
# a From it does not own, so the SMTP account keeps sending and this address receives.
SUPPORT_ADDRESS = os.environ.get("ARUVI_SUPPORT_ADDRESS", "").strip() or "support@meyy.in"

# ★ THE WHATSAPP SUPPORT NUMBER (founder, 2026-09-26). A second support channel, OPT-IN at
# subscription: the Meyy WhatsApp Business number, in international form with no "+" (the
# shape wa.me links take). Mirrors WHATSAPP_NUMBER in @aruvi/shared/format — move one, move
# the other. Service only, never marketing (privacy notice §9, agreement §K).
WHATSAPP_NUMBER = os.environ.get("ARUVI_WHATSAPP_NUMBER", "").strip() or "919363795723"
# ── WhatsApp Cloud API (2026-09-26) — all four empty = dev: sends go to the file outbox.
# TOKEN is a SYSTEM-USER token (permanent); PHONE_NUMBER_ID is Meta's id for the number,
# not the number. WELCOME_TEMPLATE must exist and be APPROVED in WhatsApp Manager, with ONE
# body variable {{1}} = the teacher's first name. VERIFY_TOKEN is any string you also type
# into the webhook config in the Meta app; APP_SECRET verifies each webhook POST's signature.
WA_TOKEN = os.environ.get("ARUVI_WA_TOKEN", "").strip()
WA_PHONE_NUMBER_ID = os.environ.get("ARUVI_WA_PHONE_NUMBER_ID", "").strip()
WA_API_VERSION = os.environ.get("ARUVI_WA_API_VERSION", "").strip() or "v25.0"
WA_WELCOME_TEMPLATE = os.environ.get("ARUVI_WA_WELCOME_TEMPLATE", "").strip() or "meyy_welcome"
WA_TEMPLATE_LANG = os.environ.get("ARUVI_WA_TEMPLATE_LANG", "").strip() or "en"
WA_VERIFY_TOKEN = os.environ.get("ARUVI_WA_VERIFY_TOKEN", "").strip()
WA_APP_SECRET = os.environ.get("ARUVI_WA_APP_SECRET", "").strip()
# The address mail is SENT from — the SMTP account itself unless overridden.
MAIL_FROM = os.environ.get("ARUVI_MAIL_FROM", "").strip() or SMTP_USER or "kumar.radhakrishnan2@gmail.com"
# ★ THE SENDER'S NAME (founder, 2026-09-04). Mail composed in Gmail arrives as
# "MEYY support"; mail the API sent arrived as the bare "support@meyy.in", so one
# correspondence showed two senders and the machine-sent half looked the less legitimate
# of the two — exactly backwards, since it is the half carrying case references. This is
# the display name only; the address is still MAIL_FROM, and Gmail still rewrites a From
# the authenticated account does not own. Spelled MEYY (the wordmark), matching the
# Workspace account's own name rather than the "Meyy" used in prose — the inbox shows
# these side by side and the account name is the one already in her thread list.
MAIL_FROM_NAME = os.environ.get("ARUVI_MAIL_FROM_NAME", "").strip() or "MEYY support"
# Where a reply to any Aruvi mail goes: the support inbox, never the sending account.
MAIL_REPLY_TO = os.environ.get("ARUVI_MAIL_REPLY_TO", "").strip() or SUPPORT_ADDRESS
# Send the founder a copy of every subscription confirmation (his own sales log).
MAIL_BCC_FOUNDER = os.environ.get("ARUVI_MAIL_BCC_FOUNDER", "1").strip().lower() in (
    "1", "true", "yes", "on")

# ── Support (2026-08-27) ───────────────────────────────────────────────────────
# Email is the only channel, so the acknowledgement carries the whole weight of "your
# message arrived and it is somebody's job now". The reference is the handle both sides
# use afterwards; SUPPORT_START is where the series opens (see support_repository_file
# for why it is not 1). SUPPORT_REPLY_DAYS is the promise the screen and the mail BOTH
# make — one value, so they cannot drift apart and leave the teacher with two answers.
# ★ MEY-S since 2026-09-03 (founder) — the invoice series' own move (ARV → MEY). The
# counter is one plain integer, not keyed by prefix, so numbering CONTINUES; records
# filed as ARV-S-… stay valid handles and are never renamed.
SUPPORT_PREFIX = os.environ.get("ARUVI_SUPPORT_PREFIX", "MEY-S").strip() or "MEY-S"
SUPPORT_START = int(os.environ.get("ARUVI_SUPPORT_START", "742"))
SUPPORT_REPLY_DAYS = int(os.environ.get("ARUVI_SUPPORT_REPLY_DAYS", "2"))
# Billing questions get the firmer promise: money carries a different anxiety, and a
# teacher who thinks she has paid twice should not wait as long as one with a layout
# question.
SUPPORT_BILLING_REPLY_DAYS = int(os.environ.get("ARUVI_SUPPORT_BILLING_REPLY_DAYS", "1"))

# ── Academic-year cutover (administrative architecture Step 2) ──────────────────
# CUTOVER_MONTH_DAY: the date each year on which Aruvi starts OFFERING the new academic
# year. June 1 by default — Indian schools reopen late May/early June, and a teacher
# still finishing a chapter in April must not be cut over out from under her. Config,
# never code: boards differ and the founder will move this after the first June.
CUTOVER_MONTH_DAY = os.environ.get("ARUVI_CUTOVER_MONTH_DAY", "06-01").strip()

# SIMULATED_TODAY: pretend it is this date (ISO, e.g. "2027-06-01"). ★ TESTING ONLY —
# cutover's whole behaviour hangs on the calendar, and waiting until June to find out it
# is wrong is not a test strategy. Every date decision in api/main.py goes through
# _today(), so setting this makes the WHOLE system agree about what day it is
# (entitlement expiry included) rather than only the piece under test. Unset in
# production; the server logs a warning when it is set.
SIMULATED_TODAY = os.environ.get("ARUVI_TODAY", "").strip()

# ── The lesson-plan library year (administrative architecture §2.2, 2026-08-27) ──
# ★ TWO DIFFERENT YEARS LIVE IN THIS SYSTEM AND CONFLATING THEM IS THE BUG §2.2 EXISTS
# TO PREVENT.
#
#   · the TEACHER's academic year  — AcademicYear/{year_id}, per teacher, Bucket B,
#     the year she is TEACHING in. Step 1 scopes her state by it.
#   · the LIBRARY's year (this)    — which authored edition a lesson plan came from,
#     Bucket A, the same for everybody.
#
# They are independent: a teacher can teach one 2026-27 plan for several years running,
# and two teachers in different years can be served the same edition. My Lessons already
# shows her PRIOR-YEAR FOLDER — that is her year, not the plan's, and once a second
# edition exists, showing one while she assumes the other is exactly the confusion the
# stamp is for.
#
# LP_YEAR is the edition CURRENTLY BEING SERVED: the folder new generation reads from and
# writes into (saved_plans/{subject}/{grade}/{LP_YEAR}/), and the value stamped into every
# canonical's genon_canonical block. Bump it when a new edition is published — the January
# re-authoring batch (§2.1: the new canonicals must exist by roughly January, before the
# March–June peak).
#
# ★ The stamp is a LABEL, never a cache key. Derived plans stay keyed by
# (engine, constitution-run) — see data.genon_plan_filename. That is what lets a carried
# chapter keep its whole variant cache across an edition bump instead of re-paying to
# regenerate content that did not change. aruvi-scripts/carry_over_year.py copies the
# canonical AND its derived plans, rewriting only this field. Put the year in the key and
# you buy the entire library again every June, at peak load.
LP_YEAR = os.environ.get("ARUVI_LP_YEAR", "2026-27").strip() or "2026-27"
