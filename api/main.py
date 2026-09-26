"""
Aruvi API — the bridge between the web frontend and the Python engine.

Wraps the engine's three jobs over HTTP:
  - Allocate  : distribute a period budget across a subject's chapters (live, no LLM)
  - My Plans  : list saved plans, and serve any plan translated into the canonical view model
  - Generate  : stubbed for now (live generation deferred)

Importing the subject packages registers all five plugins with the engine registry.
Data comes from local disk (api/data.py) for now; live generation and the DB come later.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

# Register all subjects (import side-effect).
import aruvi_core.subjects.english          # noqa: F401
import aruvi_core.subjects.mathematics      # noqa: F401
import aruvi_core.subjects.science          # noqa: F401
import aruvi_core.subjects.social_sciences  # noqa: F401
import aruvi_core.subjects.the_world_around_us  # noqa: F401
from aruvi_core import subjects, engine
from aruvi_core.allocate import allocate_for_subject, allocate_schedule_for_subject
from aruvi_core.view_model import ViewModel
from aruvi_core.adapters.allocation_repository_file import AllocationRepositoryFileImpl
from aruvi_core.adapters.readiness_repository_file import ReadinessRepositoryFileImpl
from aruvi_core.adapters.section_state_repository_file import SectionStateRepositoryFileImpl
from aruvi_core.adapters.section_history_repository_file import SectionHistoryRepositoryFileImpl
from aruvi_core.adapters.plan_archive_repository_file import PlanArchiveRepositoryFileImpl
from aruvi_core.adapters.prepared_plans_repository_file import PreparedPlansRepositoryFileImpl
from aruvi_core.adapters.account_repository_file import AccountRepositoryFileImpl
from aruvi_core.adapters.academic_year_repository_file import AcademicYearRepositoryFileImpl
from aruvi_core.adapters.header_auth_provider import HeaderAuthProvider
from aruvi_core.adapters.plan_note_repository_file import PlanNoteRepositoryFileImpl
from aruvi_core.adapters.data_rights_service_file import DataRightsServiceFileImpl
from aruvi_core.adapters.entitlement_repository_file import EntitlementRepositoryFileImpl
from aruvi_core.adapters.invoice_repository_file import InvoiceRepositoryFileImpl
from aruvi_core.adapters.consent_repository_file import ConsentRepositoryFileImpl
from aruvi_core.adapters.support_repository_file import SupportRepositoryFileImpl
from aruvi_core.adapters.manual_billing_provider import ManualBillingProvider
from aruvi_core.adapters.erasure_log_file import ErasureLogFileImpl
from aruvi_core.adapters.trial_ledger_file import TrialLedgerFileImpl  # noqa: E402
from aruvi_core.adapters.document_backend import slug as _doc_slug  # noqa: E402
from aruvi_core.adapters.year_cutover_file import YearCutoverFileImpl
from aruvi_core.adapters.file_notifier import FileNotifier
from aruvi_core.adapters.smtp_notifier import SmtpNotifier
from aruvi_core.adapters.file_whatsapp import FileWhatsApp
from aruvi_core.adapters.cloud_whatsapp import CloudWhatsApp
from aruvi_core.ports import WhatsAppTemplate
from aruvi_core.ports import EmailMessage
from api import mail_templates
from aruvi_core.ports import (Account, AcademicYear, Attachment, ConsentRecord,
                              Entitlement, Invoice, InvoiceLine, PlanNote,
                              StaleNoteWrite, SupportRequest)
from aruvi_core.grades import stage_for, UnknownGradeError
from aruvi_core.report_competency import build_report as build_competency_report
# NOTE: the PDF/DOCX exporters are imported lazily inside their endpoints (not here)
# so a missing optional dependency (weasyprint, python-docx) can never break API
# startup — only the export endpoints would error, with a clear message.

from . import data, config, legal
from .report_names import report_filename, year_plan_filename

app = FastAPI(title="Aruvi API", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"],
    allow_headers=["*"], expose_headers=["ETag", "Content-Disposition"],
)

# Test-campaign tracker state (docs/testing.md §6a) — campaign tooling, not a teacher
# surface: /api/testing/campaign{,/item,/defect,/export.csv} + /api/testing/tracker.
# Without this include the tracker page loads but every fetch 404s and it sits "offline".
from .testing_campaign import router as testing_campaign_router  # noqa: E402
app.include_router(testing_campaign_router)

# The three-surface WALK register (docs/walk_tracker.html) — web · iPhone · Android ticked off
# per feature, amendments recorded, the release-switch gate. Same tooling-only status as the
# campaign tracker above: /api/testing/walk{,/item,/amendment,/tracker}.
from .walk_tracker import router as walk_tracker_router  # noqa: E402
app.include_router(walk_tracker_router)

# ── Bucket B — THE state backend (Track C, 2026-09-09) ────────────────────────────
# One DocumentBackend for every per-teacher store below: the folder tree at STATE_DIR
# (file mode — local dev, tests, the Render disk) or the `documents` table at
# DATABASE_URL (postgres mode — Supabase). config.STATE_BACKEND picks; nothing else in
# this file knows which. The repository classes keep their *FileImpl names — the
# "file" is history, the class is the port's implementation over whichever backend.
state = config.state_backend()
print(f"[aruvi] state: {state.describe()}")

# The allocation register is per-user/tenant STATE (Bucket B) — never the read-only
# content tree.
allocation_repo = AllocationRepositoryFileImpl(state)

# ── Content store (Bucket A) behind the Storage port ───────────────────────────────
# ★ The seam the provider sheet listed as declared-but-bypassed, honoured 2026-08-29.
# Everything the runtime READS — the certified lesson library, chapter mappings, framework
# glossaries, allocation norms, the master plan, the user agreement — now goes through
# this object, and api/data.py owns no filesystem call against DATA_DIR any more.
#
# It is constructed in api/data.py (that module IS the content-access layer) and named
# here so storage is CHOSEN where every other provider is chosen. The object-store
# cutover is one import and one data.set_storage(...) call on this line — no caller
# changes, which is the claim the other eleven ports could already make and this one
# could not. Deliberately no vendor here: LocalStorage is the reference adapter.
storage = data.storage()

# Initialize the readiness teaching-profile repository. This is per-user/tenant STATE
# (Bucket B), so it writes to STATE_DIR (aruvi-saas/data/) — NOT the read-only content
# mirror in DATA_DIR. File-based for now; the Supabase adapter swaps in at Phase 4 behind
# the same ReadinessRepository port, replacing this folder. (See CLOUD_DATA_MODEL.md §0/§2.)
readiness_repo = ReadinessRepositoryFileImpl(state)

# Per-section teaching-state repository (which chapter a section tracks + how far along +
# done). Bucket-B STATE, so it also writes to STATE_DIR (data/section_state/). Moving this
# off the browser's localStorage is what makes tracking/progress follow a teacher across
# devices (CLOUD_DATA_MODEL.md §2.4). File-based now; Supabase adapter swaps in at Phase 4
# behind the same SectionStateRepository port.
section_state_repo = SectionStateRepositoryFileImpl(state)

# Per-section chapter-HISTORY repository — the ledger of what each section has already been
# taught. Its sibling above holds only the CURRENT binding and deletes the row the moment a
# chapter leaves the slot, so this is the only record that a chapter was ever taught. It was
# the last teaching state living in the browser alone (sectionHistory.js's own header said the
# mirror was owed); without it a phone and a laptop keep two disagreeing accounts of the same
# class. Bucket-B STATE under STATE_DIR (data/section_history/).
section_history_repo = SectionHistoryRepositoryFileImpl(state)

# Plan-archive repository — which saved plans a teacher has archived from My Lessons (to
# declutter without ever hard-deleting a costly, back-referenced plan). A per-tenant FLAG, not
# a physical move (the plan asset is shared read-only content in DATA_DIR), so it's Bucket-B
# STATE under STATE_DIR (data/plan_archive/). File-based now; a Supabase adapter (an
# `archived_at` column / small `plan_archive` table) swaps in at Phase 4 behind the same
# PlanArchiveRepository port. (Design decision 2026-07-04 — no hard delete anywhere.)
plan_archive_repo = PlanArchiveRepositoryFileImpl(state)

# Prepared-plans register — which saved plans THIS teacher has actually prepared. Because live
# generation is deferred, the saved-plan library is shared read-only CONTENT (identical for
# everyone), so a raw listing shows every sample plan to every teacher. This per-tenant Bucket-B
# register records her own preparations (first-run writes its chapter; PrepareLesson appends on
# each generate) so /plans can flag — and My Lessons can filter to — only her work. Swaps to a
# Supabase-backed store behind the same PreparedPlansRepository port at Phase 4. (2026-07-05)
prepared_plans_repo = PreparedPlansRepositoryFileImpl(state)

# Chapter-notes repository (administrative architecture Step 3) — the teacher's own
# writing on a chapter, lifted OFF browser localStorage (the last teacher data with no
# owner, CLOUD_DATA_MODEL.md §2.8). One note per chapter per academic year; year-scoped
# like the rest of the teaching state so notes stay with their year's plans at cutover.
plan_note_repo = PlanNoteRepositoryFileImpl(state)

# Data rights: export + erase (administrative architecture Step 4). One traversal over
# every Bucket-B store — DPDP portability, DPDP erasure, Apple 5.1.1(v). Both routes must
# stay reachable regardless of subscription state (§2.5) — there is deliberately no
# entitlement check in front of them, ever. The chapter_title resolver is the export's
# ONE window into Bucket-A content (display titles beside her notes and progress);
# injected here so the service itself never crosses the bucket boundary.
def _chapter_title_resolver(subject: str, grade: str, chapter_number: int) -> str:
    try:
        for p in data.list_saved_plans(subject, grade):
            if p.get("chapter_number") == chapter_number:
                return p.get("chapter_title") or ""
    except Exception:
        pass
    return ""


data_rights = DataRightsServiceFileImpl(state,
                                        chapter_title=_chapter_title_resolver)

# Entitlement (administrative architecture Step 5 — the payment-shaped hole). Model:
# docs/subscription_model_discussion.md §0. Tenant-keyed, server-resolved, platform-
# tagged. The ONE gate sits in front of generation (genon_make_plan) — generation is
# what costs money; nothing else is ever gated, and data rights explicitly never are.
# Enforcement is OFF by default (config.ENTITLEMENT_ENFORCED) so the seam is real but
# daily dev is undisturbed; the founder operates it via aruvi-scripts/entitlement.py.
entitlement_repo = EntitlementRepositoryFileImpl(state)
invoice_repo = InvoiceRepositoryFileImpl(state, prefix=config.INVOICE_PREFIX,
                                        start=config.INVOICE_START)
billing_provider = ManualBillingProvider(entitlement_repo)

# Consent (2026-08-27) — the six ticks on the user agreement, taken BEFORE she chooses
# subjects and stages, and kept as evidence. Tenant-keyed like the entitlement it gates.
# ★ Its store deliberately sits outside every folder the erase traversal walks (see
# consent_repository_file.py): the record survives account deletion, the erasure receipt
# says so, and §G of the agreement says so.
consent_repo = ConsentRepositoryFileImpl(state)

# Support (2026-08-27) — email is the only channel, so every message she sends is filed
# here with a reference before it is mailed. Bucket-B STATE (her own words), and it
# joined the export + erase traversal the day it was born; the reference SERIES sits in
# support/_series/, outside every folder that traversal walks, for the same reason the
# invoice series does.
support_repo = SupportRepositoryFileImpl(state, prefix=config.SUPPORT_PREFIX,
                                         start=config.SUPPORT_START)
# The one store the erase walk must never traverse — see erasure_log_file.py.
erasure_log = ErasureLogFileImpl(state)
# ★ The trial ledger (2026-09-18) — the second store outside the erase walk, by design: a
# free trial is once per number, even across an erasure. See trial_ledger_file.py.
trial_ledger = TrialLedgerFileImpl(state, config.TRIAL_LEDGER_KEY or config.TRIAL_LEDGER_DEV_KEY,
                                   config.TRIAL_LEDGER_DAYS)
if not config.TRIAL_LEDGER_KEY:
    print("[aruvi] trial ledger: DEV KEY in use — set ARUVI_TRIAL_LEDGER_KEY on any real deployment")

# The WhatsApp client (2026-09-26): Meta's Cloud API only when BOTH the token and the
# phone-number id are set; otherwise the file outbox — the Notifier's own rule, one seam.
if config.WA_TOKEN and config.WA_PHONE_NUMBER_ID:
    wa_client = CloudWhatsApp(config.WA_TOKEN, config.WA_PHONE_NUMBER_ID, config.WA_API_VERSION)
    print(f"[aruvi] whatsapp: CLOUD API ({config.WA_API_VERSION}) — welcome messages WILL send")
else:
    wa_client = FileWhatsApp(config.STATE_DIR)
    print("[aruvi] whatsapp: FILE OUTBOX — nothing sends. Unset: "
          + ", ".join(n for n, v in (("ARUVI_WA_TOKEN", config.WA_TOKEN),
                                     ("ARUVI_WA_PHONE_NUMBER_ID", config.WA_PHONE_NUMBER_ID))
                      if not v))

# The Notifier: real SMTP only when the founder has set all three credentials in the
# environment; otherwise the file outbox, so the preview never needs a mail account and
# no credential ever enters the repo. One decision, made once, at the seam.
if config.SMTP_HOST and config.SMTP_USER and config.SMTP_PASSWORD:
    notifier = SmtpNotifier(config.SMTP_HOST, config.SMTP_PORT, config.SMTP_USER,
                            config.SMTP_PASSWORD, from_addr=config.MAIL_FROM,
                            from_name=config.MAIL_FROM_NAME)
    print(f"[aruvi] mail: SMTP {config.SMTP_HOST} as {config.SMTP_USER} — mail WILL send")
else:
    notifier = FileNotifier(config.STATE_DIR, from_addr=config.MAIL_FROM,
                            from_name=config.MAIL_FROM_NAME)
    # ★ SAID OUT LOUD AT STARTUP (2026-08-26). Nothing on screen distinguishes a mail
    #   that was sent from one that was written to disk — a subscription succeeds either
    #   way, by design — so a missing SMTP variable looked exactly like a mail that
    #   vanished. Twice. The one place that knows is this line, and it costs nothing.
    missing = [n for n, v in (("ARUVI_SMTP_HOST", config.SMTP_HOST),
                              ("ARUVI_SMTP_USER", config.SMTP_USER),
                              ("ARUVI_SMTP_PASSWORD", config.SMTP_PASSWORD)) if not v]
    print(f"[aruvi] mail: FILE OUTBOX ({config.STATE_DIR}/outbox) — NOTHING WILL SEND. "
          f"Unset: {', '.join(missing)}")

# ★ SAY WHAT DAY THE SERVICE THINKS IT IS (2026-08-26). A malformed ARUVI_TODAY is
#   deliberately non-fatal — a testing seam must never be the reason a server won't
#   boot — but silence made "2026-26-08" (month 26) look exactly like a working
#   simulation, and every date-dependent screen then reported the real day while the
#   tester read them as June. Loud, and still non-fatal.
if config.SIMULATED_TODAY:
    try:
        date.fromisoformat(config.SIMULATED_TODAY)
        print(f"[aruvi] date: SIMULATING {config.SIMULATED_TODAY} "
              f"(★ testing only — expiry, cutover and invoice dates all move)")
    except ValueError as _e:
        print(f"[aruvi] date: ARUVI_TODAY={config.SIMULATED_TODAY!r} is NOT a valid date "
              f"({_e}). Expected YYYY-MM-DD. Using the real date: {date.today()}")

# Account + tenant record (administrative architecture Step 0) — the durable record that
# billing, privacy, notifications and the institutional tier all hang off. NOT year-scoped
# (a subscription is rolling). Bucket-B STATE under STATE_DIR (data/accounts/).
account_repo = AccountRepositoryFileImpl(state)

# Academic years (administrative architecture Step 1) — which years exist for a teacher and
# which is current. Every piece of TEACHING state below is filed under the current year;
# the account and the teaching profile deliberately are not. STATE_DIR (data/academic_years/).
academic_year_repo = AcademicYearRepositoryFileImpl(state)

# Cutover (Step 2) — composed from repositories that already exist, because it MOVES
# NOTHING: year-scoped paths mean opening the next year is the whole operation.
year_cutover = YearCutoverFileImpl(academic_year_repo, readiness_repo,
                                   prepared_plans_repo, section_state_repo)

# Identity provider behind the AuthProvider port (config.AUTH_PROVIDER, Track B 2026-09-09).
# `header` — the raw X-Aruvi-User value is the credential (no password; dev + tests).
# `supabase` — a Supabase access token in `Authorization: Bearer`, verified offline; the
# identity is the token's verified mobile. This block is the whole swap.
if config.AUTH_PROVIDER == "supabase":
    from aruvi_core.adapters.supabase_auth_provider import SupabaseAuthProvider
    if not config.SUPABASE_URL:
        raise RuntimeError("ARUVI_AUTH_PROVIDER=supabase needs ARUVI_SUPABASE_URL")
    auth_provider = SupabaseAuthProvider(config.SUPABASE_URL, config.SUPABASE_JWT_SECRET)
    print(f"[aruvi] auth: SUPABASE ({config.SUPABASE_URL}) — X-Aruvi-User is ignored")
else:
    auth_provider = HeaderAuthProvider()
    print("[aruvi] auth: HEADER STUB (X-Aruvi-User) — dev only")


def _credential(x_aruvi_user: Optional[str], authorization: Optional[str]) -> str:
    """Pick the credential the configured provider verifies. Under Supabase only the
    bearer token counts; under the header stub only X-Aruvi-User does — never both, so
    neither mode can be talked into honouring the other's header."""
    if config.AUTH_PROVIDER == "supabase":
        a = (authorization or "").strip()
        return a[7:].strip() if a.lower().startswith("bearer ") else ""
    return x_aruvi_user or ""


# Identity (administrative architecture Step 0). The credential still arrives in the
# X-Aruvi-User request header (set by the login portal, sent on every API call), but it is
# now resolved through the AuthProvider port and the ACCOUNT RECORD rather than asserted:
# tenant_id and user_id are separate values read off the account, which today happen to be
# equal (an individual teacher is her own tenant). A first-ever request JIT-creates the
# account, preserving the "any user ID signs in" dev behaviour. This function is the ONLY
# place a request becomes an identity — derivation must never scatter.
#
# Falls back to "local" when no header is present (e.g. health checks, curl) so nothing
# 500s; a real teacher always has one because the frontend gates the app behind login.
def _erased_after_issue(ident) -> bool:
    """True when this user's latest erasure postdates the credential she is presenting.
    Needs a token `iat` (Supabase), which makes it exact. The dev header stub carries no issue
    time and cannot tell an old session from a new sign-in, so it is never refused here (a
    header-stub re-sign-in straight after an erase is exactly what the data-rights tests do)."""
    iat = getattr(ident, "issued_at", None)
    if iat is None:
        return False
    try:
        entries = [e for e in erasure_log.for_tenant(ident.tenant_id)
                   if e.get("user_id") == ident.user_id]
    except Exception:          # noqa: BLE001 — the log must never block sign-in
        return False
    if not entries:
        return False
    try:
        erased = datetime.fromisoformat(entries[-1].get("confirmed_at", "")).timestamp()
    except (TypeError, ValueError):
        return False
    return iat <= erased


def _current_identity(x_aruvi_user: Optional[str] = Header(default=None),
                      authorization: Optional[str] = Header(default=None)) -> tuple[str, str]:
    """Return (tenant_id, user_id) for the caller, resolved via the account record.
    A credential the provider refuses is a 401 in the provider's own words."""
    try:
        ident = auth_provider.verify_token(_credential(x_aruvi_user, authorization))
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e) or "Sign in to continue.")
    account = account_repo.load(ident.tenant_id, ident.user_id)
    if account is None and _erased_after_issue(ident):
        # WALK-A-018 (2026-09-20): a request still carrying the ERASED teacher's session (a poll,
        # a re-fetch, the farewell's own refresh) landed after the erase and JIT-created her
        # account again — an empty record under her number, and "Create sign in" then refused
        # her. A credential minted before the erasure can no longer create anything; a fresh
        # sign-in (a new token) is how she comes back.
        raise HTTPException(status_code=401, detail="This account was deleted. Sign in again to start afresh.")
    if account is None:
        account = Account(
            account_id=ident.user_id,
            tenant_id=ident.tenant_id,
            display_name=ident.user_id,
            phone=ident.phone or "",
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        account_repo.save(account)
    return (account.tenant_id, account.account_id)


# Academic-year resolution (administrative architecture Step 1). Year-scoped routes accept
# an OPTIONAL ?year_id= query param; when absent (always, for today's frontend) the year is
# resolved server-side from the teacher's AcademicYearRepository, bootstrapping a default
# on first touch so no request ever lacks a year in its address. The default follows the
# CBSE April–March calendar; a teacher on a June–May state board edits her year record
# later (Step 2's cutover UI) — the LABEL is what addressing needs, not the exact dates.
def _today() -> date:
    """Today — or the simulated date, if ARUVI_TODAY is set.

    ★ ONE seam for the whole service (2026-08-26). Cutover's entire behaviour hangs on
    the calendar, and "wait until June to find out" is not a test strategy. Every date
    decision goes through here, so a simulated date makes the WHOLE system agree about
    what day it is — entitlement expiry included — instead of only the piece under test,
    which is how you get a coherent June to walk through in August."""
    if config.SIMULATED_TODAY:
        try:
            return date.fromisoformat(config.SIMULATED_TODAY)
        except ValueError:
            pass          # a malformed override is ignored, never fatal
    return date.today()


def _default_academic_year() -> AcademicYear:
    """The academic year today's date falls in, April-anchored ("2026-27")."""
    today = _today()
    start_year = today.year if today.month >= 4 else today.year - 1
    return AcademicYear(
        year_id=f"{start_year}-{str(start_year + 1)[-2:]}",
        starts_on=f"{start_year}-04-01",
        ends_on=f"{start_year + 1}-03-31",
        is_current=True,
    )


def _auto_roll_year(tenant_id: str, user_id: str, current: AcademicYear) -> AcademicYear:
    """★ ARUVI'S OWN CUTOVER (founder, 2026-08-26) — automatic, on the date, for everyone.

    The academic year is Aruvi's boundary, not a preference: come the cutover date, last
    year's work belongs to last year and new work belongs to the new year. This runs
    whether or not the teacher has agreed to anything, because the alternative is a folder
    labelled 2026-27 that quietly fills with 2027-28 content — two curricula under one
    label, and no way for her to tell which version is in her hand.

    What it does NOT do is interrupt her teaching. Her SECTION BINDINGS ARE CARRIED
    ACROSS, so on the morning of 1 June her cards look exactly as they did on 31 May and
    she can finish whatever she is mid-way through. What changes is provenance: those
    plans were prepared last year, so they now sit in the prior-year folder and her cards
    stamp them "2026-27 version" — which is precisely the signal that she is teaching last
    year's material to this year's class.

    `cleanup_pending` records that the carry happened. The teacher-side offer — starting
    fresh for the new cohort — is the ONLY part that waits for her."""
    to_year = YearCutoverFileImpl.next_year_id(current.year_id)
    starts_on, ends_on = YearCutoverFileImpl.year_bounds(to_year)
    opened = AcademicYear(year_id=to_year, starts_on=starts_on, ends_on=ends_on,
                          is_current=True, cleanup_pending=True)
    academic_year_repo.open_year(tenant_id, user_id, opened)
    academic_year_repo.set_current(tenant_id, user_id, to_year)
    # Carry her tracking across so nothing breaks mid-chapter. NOTE the shape: this
    # adapter's load_all returns plain DICTS, not SectionState objects — attribute access
    # here silently carried nothing at all until it was caught (2026-08-26). Per-row
    # try/except so one malformed row cannot cost her every other binding; a whole-copy
    # failure is logged rather than swallowed, because a teacher whose tracking vanished
    # on 1 June must not be a mystery.
    try:
        carried = section_state_repo.load_all(tenant_id, user_id, current.year_id) or {}
        for skey, st in carried.items():
            try:
                section_state_repo.save_one(
                    tenant_id, user_id, to_year, skey,
                    st.get("chapter"), st.get("unit_index"), bool(st.get("done")),
                    st.get("bookmark_unit"), st.get("bookmark_phase"))
            except Exception as row_err:    # noqa: BLE001
                print(f"[cutover] could not carry {skey!r} into {to_year}: {row_err}",
                      flush=True)
    except Exception as e:                  # noqa: BLE001
        print(f"[cutover] tracking carry-forward failed for "
              f"{tenant_id}/{user_id} → {to_year}: {e}", flush=True)
    # The teaching LEDGER carries with the bindings, and for the same reason: until she
    # chooses to start fresh she is still teaching the old cohort, and a trail that emptied
    # itself at midnight on 1 April would tell her she had taught nothing all year. Starting
    # fresh clears both together (see start_fresh below) — that is where a new cohort begins,
    # not here. Same per-row try/except: one bad row must not cost her the rest.
    try:
        carried_hist = section_history_repo.load_all(tenant_id, user_id, current.year_id) or {}
        for skey, rows in carried_hist.items():
            try:
                section_history_repo.record(tenant_id, user_id, to_year, skey,
                                            list((rows or {}).values()))
            except Exception as row_err:    # noqa: BLE001
                print(f"[cutover] could not carry history {skey!r} into {to_year}: {row_err}",
                      flush=True)
    except Exception as e:                  # noqa: BLE001
        print(f"[cutover] history carry-forward failed for "
              f"{tenant_id}/{user_id} → {to_year}: {e}", flush=True)
    return opened


def _prior_years_desc(tenant_id: str, user_id: str, current_id: str) -> List[str]:
    """Her earlier academic years, most recent first. Used to trace where a plan she is
    still teaching was originally prepared."""
    years = academic_year_repo.list_years(tenant_id, user_id) or []
    return sorted([y.year_id for y in years if y.year_id != current_id], reverse=True)


def _resolve_year(tenant_id: str, user_id: str, year_id: Optional[str] = None) -> str:
    """The year a teaching-state request addresses: the explicit ?year_id= if given,
    else the teacher's current year (bootstrapped on first touch, and rolled forward
    automatically once Aruvi's cutover date has passed — see _auto_roll_year)."""
    if year_id and year_id.strip():
        return year_id.strip()
    current = academic_year_repo.current(tenant_id, user_id)
    if current is None:
        current = _default_academic_year()
        academic_year_repo.open_year(tenant_id, user_id, current)
        return current.year_id
    nxt = YearCutoverFileImpl.next_year_id(current.year_id)
    due_on = YearCutoverFileImpl.cutover_date(nxt, config.CUTOVER_MONTH_DAY)
    if nxt != current.year_id and due_on and _today() >= due_on:
        current = _auto_roll_year(tenant_id, user_id, current)
    return current.year_id


# ── Entitlement gate (administrative architecture Step 5) ───────────────────────
# One check, one place: in front of generation. Model per
# docs/subscription_model_discussion.md §0 — trial capped by CHAPTERS (any
# TRIAL_CHAPTER_CAP across all subject-stages, unlimited re-serves per chapter because
# period-fitting takes several attempts and that IS the trial); paid = unlimited within
# "{subject}/{stage}" scopes; "*" = all. Messages are teacher-facing, plain words
# (testing.md C13): they speak in chapters and subscriptions, never generations/scopes.
def _trial_chapter_key(subject: str, grade: str, chapter_number: int) -> str:
    return f"{subject}/{grade}/{chapter_number}"


def _entitlement_of(tenant_id: str) -> Entitlement:
    """The tenant's entitlement, JIT-starting the trial on first touch — a brand-new
    teacher generates immediately (benefit first), her chapter counter simply starts."""
    ent = entitlement_repo.load(tenant_id)
    if ent is None:
        ent = Entitlement(plan_id="trial", status="trial", source="trial", scopes=["*"])
        # ★ A NUMBER THAT HAS TRIALLED BEFORE STARTS WHERE IT LEFT OFF (2026-09-18). Erasure
        #   forgot the account, but the trial ledger remembers what this number used; a fresh
        #   trial is seeded with that many chapters already counted. Placeholders, not real
        #   chapter keys — the old chapters are gone, so re-serving them is not "free", and a
        #   placeholder can never match a real key. A purchase-spent trial counts as all used.
        prior = trial_ledger.lookup(tenant_id)
        if prior:
            used = config.TRIAL_CHAPTER_CAP if prior.get("spent") else int(prior.get("chapters_used") or 0)
            ent.trial_chapters = [f"_earlier/{i + 1}" for i in range(min(used, config.TRIAL_CHAPTER_CAP))]
        entitlement_repo.save(tenant_id, ent)
    return ent


def _scope_words(scope: str) -> str:
    """"science/middle" → "Science · Middle" — a scope is named to the teacher the same
    way in a 402, in the mail and in the Settings ledger."""
    return mail_templates.scope_label(scope)


def _date_words(iso: str) -> str:
    return mail_templates.fmt_date(iso)


def _scope_until(ent: Entitlement, scope: str) -> str:
    """When this scope runs to. "" = no time limit. Per-scope date first (2026-08-26),
    falling back to the entitlement-level one for records written before per-scope dates
    and for the "*" grants, whose breadth has no per-scope meaning."""
    return (ent.scope_valid_until or {}).get(scope) or ent.valid_until or ""


def _scope_live(ent: Entitlement, scope: str, today: str) -> bool:
    until = _scope_until(ent, scope)
    return (not until) or until >= today


def _live_scopes(ent: Entitlement, today: str) -> List[str]:
    """The scopes she can still USE today. The trial's "*" is live by construction — its
    cap is chapters, not days."""
    if ent.status == "expired":
        return []
    return [s for s in (ent.scopes or []) if _scope_live(ent, s, today)]


def _entitlement_lapsed(ent: Optional[Entitlement], today: str) -> bool:
    """★ LAPSED MEANS NOTHING IS LIVE (founder, 2026-08-26). With per-scope expiry a
    teacher can hold one live subject and one expired one; she is still a paying
    customer, and the productivity tools (tracker, profile, notes) are not per-subject,
    so they stay open while ANY scope is live. Generation is refused per scope — that
    gate is the one that knows which subject she asked for.

    Revocation (status "expired") still lapses everything at once: it is the founder
    withdrawing the whole subscription, not a date passing."""
    if ent is None:
        return False
    if ent.status == "trial":
        return False
    if ent.status == "expired":
        return True
    return not _live_scopes(ent, today)


def _check_entitlement(tenant_id: str, subject: str, grade: str,
                       chapter_number: int) -> None:
    """Raise HTTP 402 when generation is not covered. No-op when enforcement is off
    (config.ENTITLEMENT_ENFORCED, default False — dev undisturbed)."""
    if not config.ENTITLEMENT_ENFORCED:
        return
    ent = _entitlement_of(tenant_id)
    if ent.status == "trial":
        key = _trial_chapter_key(subject, grade, chapter_number)
        if key in ent.trial_chapters:            # re-serve: always free
            return
        if len(ent.trial_chapters) < config.TRIAL_CHAPTER_CAP:
            return
        # ★ SAYS NOTHING ABOUT WHAT SURVIVES (founder, 2026-08-26 evening, third and
        #   final cut). It began as "Your 3 chapters stay yours", which the trial purge
        #   made false. The repair — "the chapters you made in a subject you subscribe
        #   to come with you" — was true but asked her to hold a rule in her head at the
        #   moment she is deciding whether to pay. The founder's read: *"if a teacher
        #   pays for a new subject and ditches trial chapters, she does not care."*
        #   Right — the three trial chapters were a demonstration, not a body of work.
        #   So the sentence states the fact and the action, and stops.
        raise HTTPException(status_code=402, detail=(
            f"Your free trial covers {config.TRIAL_CHAPTER_CAP} chapters, and you have "
            f"used them. Subscribe to keep preparing."))
    if ent.status in ("active", "grace"):
        stage = stage_for(grade)
        today = _today().isoformat()
        scope = f"{subject}/{stage}"
        # ★ THE DATE TEST IS NOW PER SCOPE (2026-08-26). It used to gate on the
        #   entitlement-level valid_until, which with per-scope expiry would refuse a
        #   live subject because a DIFFERENT one had run out — or, worse, allow an
        #   expired one because a later-bought subject held the top-level date open.
        for held in ("*", scope):
            if held in ent.scopes:
                if _scope_live(ent, held, today):
                    return
                raise HTTPException(status_code=402, detail=(
                    f"Your subscription for {_scope_words(scope)} ended on "
                    f"{_date_words(_scope_until(ent, held))}. Renew it to keep preparing "
                    f"its chapters — everything you made stays yours."))
        raise HTTPException(status_code=402, detail=(
            "Your subscription covers a different subject. Add this one to keep "
            "preparing its chapters."))
    raise HTTPException(status_code=402, detail=(
        "Your subscription has ended. Renew to keep preparing new chapters — "
        "everything you made stays yours."))


def _check_productivity(tenant_id: str) -> None:
    """The LAPSED lockout (§2.5 as amended; founder 2026-08-24 persona pass): an
    expired subscription keeps her PLANS — open, export, print, archive, notes — but
    loses the productivity tools: profile changes (sections/classes/subjects) and
    section tracking. Trial and a LIVE active/grace pass freely.

    ★ "Expired" means either of two things, and it must mean both here (bug found in
    the 2026-08-26 persona run): a manually REVOKED entitlement (status "expired") OR
    one whose VALID_UNTIL has passed while the status still literally reads "active".
    Only the first was checked, so a subscription that lapsed BY DATE — which is how
    every real lapse will happen once payments are live; manual revocation is the rare
    case — kept its profile editing and tracker while generation was already 402ing.
    `_check_entitlement` had the date test all along; the two gates now agree."""
    if not config.ENTITLEMENT_ENFORCED:
        return
    ent = entitlement_repo.load(tenant_id)
    # ★ Per-scope expiry (2026-08-26) makes "lapsed" mean NOTHING IS LIVE — see
    #   _entitlement_lapsed. One live subject keeps the tracker and the profile open.
    if _entitlement_lapsed(ent, _today().isoformat()):
        raise HTTPException(status_code=402, detail=(
            "Your subscription has ended. Renew to use tracking and profile tools — "
            "your lesson plans stay available to open and export."))


def _count_trial_chapter(tenant_id: str, subject: str, grade: str,
                         chapter_number: int) -> None:
    """AFTER a successful serve: add the chapter to the trial counter (once). Called on
    success only, so a typo-guard 400 or an unauthored-chapter 404 never burns a trial
    chapter. Counts even when enforcement is off — the counter is honest history the
    future UI shows, not the gate itself."""
    ent = _entitlement_of(tenant_id)
    if ent.status != "trial":
        return
    key = _trial_chapter_key(subject, grade, chapter_number)
    if key not in ent.trial_chapters:
        ent.trial_chapters.append(key)
        entitlement_repo.save(tenant_id, ent)


class PeriodRow(BaseModel):
    minutes: int
    count: int


class AllocateRequest(BaseModel):
    # Either a multi-row schedule (preferred) or a single total (back-compat).
    period_rows: Optional[List[PeriodRow]] = None
    total_periods: Optional[int] = None
    # Optional subset of chapters to allocate across (teacher deselected some in the UI).
    # None/omitted = allocate across every chapter mapping, as before.
    chapter_numbers: Optional[List[Any]] = None


class SaveAllocationRequest(BaseModel):
    # Subject name (e.g., "science", "mathematics")
    subject: str
    # Grade as the roman-numeral string used everywhere else in the API ("vii"), not an
    # integer — stage_for()/grades.py and the /chapters and /allocate endpoints all key
    # off this same roman string. (req.subject/req.grade are echoed back only; the path
    # params {subject}/{grade} are what's actually used to read/write the register.)
    grade: str
    # Dict mapping chapter number (as string) to a full allocation record:
    # {chapter_title, weight, periods_by_duration: {minutes_str: count}, total_periods,
    # total_minutes}. The full record (not just a period total) is stored so the saved
    # register is "redraw-ready" for the frontend's final-allocation table.
    allocation: Dict[str, Dict[str, Any]]


class ReadinessRequest(BaseModel):
    """Body for POST /readiness — the teacher's readiness teaching profile.

    Only `subjects` (the canonical self-contained per-subject array emitted by
    Readiness.jsx) is persisted. The frontend may also send the denormalized
    active-subject projection (subject/grades/grids/durations/budget); it is ignored
    here and stripped by the adapter — see CLOUD_DATA_MODEL.md §2.1.
    """
    subjects: List[Dict[str, Any]] = []
    # When true, the server cascade-deletes the allocation registers for any subject·grade the
    # edit removed (the teacher saw the named warning and accepted). When false/omitted, a
    # destructive edit is REFUSED with HTTP 409 + the impact list so the UI can warn first.
    # Additive edits (nothing removed) save regardless.
    cascade: bool = False


class AllocationReportRequest(BaseModel):
    """Request body for the allocation-report export endpoints.

    The frontend sends the allocation result only; the API enriches each chapter
    with its competencies (code + description + justification) from the mappings
    and the framework glossary, server-side. `grade` is the roman string ("vii").
    `period_types` is [{minutes, count}]. `chapters` is the allocate output:
    [{chapter_number, chapter_title, periods_by_duration {min:count}, total_periods,
      total_minutes, weight}].
    """
    subject: str
    grade: str
    generated_at: Optional[str] = None
    notes: Optional[str] = None
    period_types: List[Dict[str, Any]] = []
    chapters: List[Dict[str, Any]] = []


class YearPlanExportRequest(BaseModel):
    """Request body for the Year Plan table export (POST /api/year-plan/export-docx).

    ★ The client sends WHAT IT IS DISPLAYING; the server does not recompute it.
    The suggested-periods column is derived client-side in YearPlan.jsx (her annual
    budget, distributed across chapters by weight with largest-remainder), and the
    committed column comes from her prepared plans. Re-deriving either here would put
    a second implementation of that arithmetic in the product — and the day the two
    drift she gets a Word document that contradicts the screen she exported it from.
    That is the 2026-08-21 defect (Year Plan said 14, the chapter step said 19)
    reached through a new door, so the seam is closed by not opening it.

    `subject` may be the display name ("Social Sciences") or the slug; `grade` is the
    roman string ("vii") or "VII". Both are normalized for display only — nothing is
    looked up, so this route reads no content and needs no entitlement (it exports
    what she can already see).
    """
    subject: str
    grade: str
    budget: Optional[int] = None
    generated_at: Optional[str] = None
    # [{n, title, sug: int|None, plan: int|None, prepared: bool, awaited: bool}]
    rows: List[Dict[str, Any]] = []
    sug_total: Optional[int] = None
    plan_total: Optional[int] = None


def _subject(name: str):
    try:
        return subjects.get(name)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Unknown subject: {name}")


# ── Readiness ↔ allocation slug bridge + cascade ────────────────────────────────
# The readiness profile stores display values (subject "Science", grade "VII"); the
# allocation register is keyed by engine slugs ("science", "vii"). A profile edit that
# removes a subject/grade/section can orphan downstream work (a saved allocation register
# per subject·grade; an in-progress lesson pointer per section). These helpers diff old vs
# new, report the impact, and (on confirm) cascade-delete exactly the removed scope.
def _subject_slug(name: str) -> str:
    return str(name or "").strip().lower().replace(" ", "_")


def _grade_slug(grade: str) -> str:
    return str(grade or "").strip().lower()


def _profile_index(subjects_list: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Index subjects[] by slug → {grades: {grade_slug: [section_tags]}} for diffing."""
    out: Dict[str, Dict[str, Any]] = {}
    for s in subjects_list or []:
        ss = _subject_slug(s.get("name"))
        if not ss:
            continue
        grades: Dict[str, List[str]] = {}
        for g in s.get("grades", []) or []:
            gs = _grade_slug(g.get("grade"))
            if not gs:
                continue
            grades[gs] = [str((sec or {}).get("tag", "")) for sec in (g.get("sections") or [])]
        out[ss] = {"grades": grades}
    return out


def _diff_profiles(old_subjects: List[Dict[str, Any]],
                   new_subjects: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute what an edit REMOVES (old minus new), normalized to slugs.

    {removed_subjects:[{subject, grades:[...]}], removed_grades:[{subject, grade}],
     removed_sections:[{subject, grade, section}]}. removed_grades excludes grades whose
     whole subject was removed (already accounted for)."""
    old, new = _profile_index(old_subjects), _profile_index(new_subjects)
    rem_subj, rem_grade, rem_sec = [], [], []
    for ss, oinfo in old.items():
        if ss not in new:
            rem_subj.append({"subject": ss, "grades": list(oinfo["grades"].keys())})
            continue
        ninfo = new[ss]
        for gs, osecs in oinfo["grades"].items():
            if gs not in ninfo["grades"]:
                rem_grade.append({"subject": ss, "grade": gs})
                continue
            nsecs = set(ninfo["grades"][gs])
            for tag in osecs:
                if tag and tag not in nsecs:
                    rem_sec.append({"subject": ss, "grade": gs, "section": tag})
    return {"removed_subjects": rem_subj, "removed_grades": rem_grade, "removed_sections": rem_sec}


def _cascade_impact(tenant_id: str, user_id: str, year_id: str,
                    diff: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Name the downstream losses for a removal diff, checking which removed scopes actually
    have a saved allocation register (in the current academic year — the profile edit only
    ever endangers current-year work). Sections carry no allocation (subject·grade keyed) but
    orphan their LU pointer — flagged so the frontend clears it."""
    impact: List[Dict[str, Any]] = []

    def reg_count(subj: str, grd: str) -> int:
        try:
            return len(engine.get_allocation_register(
                tenant_id=tenant_id, user_id=user_id, year_id=year_id,
                subject_name=subj, grade=grd, allocation_repo=allocation_repo))
        except Exception:
            return 0

    for r in diff["removed_subjects"]:
        for gs in r["grades"]:
            impact.append({"scope": "subject", "subject": r["subject"], "grade": gs,
                           "chapters_allocated": reg_count(r["subject"], gs)})
    for r in diff["removed_grades"]:
        impact.append({"scope": "grade", "subject": r["subject"], "grade": r["grade"],
                       "chapters_allocated": reg_count(r["subject"], r["grade"])})
    for r in diff["removed_sections"]:
        impact.append({"scope": "section", "subject": r["subject"], "grade": r["grade"],
                       "section": r["section"], "chapters_allocated": 0,
                       "lu_pointer": f"{r['subject']}_{r['grade']}_{r['section']}"})
    return impact


def _apply_cascade(tenant_id: str, user_id: str, year_id: str, diff: Dict[str, Any]) -> None:
    """Clear the allocation register for every removed subject·grade and removed grade
    (current year only — past years' registers are archives, never cascaded). Narrow: only
    the removed scope; siblings untouched. Sections' LU pointers are localStorage
    (frontend-cleared)."""
    for r in diff["removed_subjects"]:
        for gs in r["grades"]:
            engine.clear_allocation_register(tenant_id=tenant_id, user_id=user_id,
                year_id=year_id, subject_name=r["subject"], grade=gs,
                allocation_repo=allocation_repo)
    for r in diff["removed_grades"]:
        engine.clear_allocation_register(tenant_id=tenant_id, user_id=user_id,
            year_id=year_id, subject_name=r["subject"], grade=r["grade"],
            allocation_repo=allocation_repo)


@app.get("/health")
def health() -> Dict[str, str]:
    # `report` marker bumps when the report code changes — lets you confirm the
    # server is running the latest code (curl localhost:8000/health).
    return {"status": "ok", "report": "competency-v6-rules"}


@app.get("/subjects")
def get_subjects() -> Dict[str, Any]:
    return {"subjects": subjects.available()}


@app.get("/subjects/{subject}/grades")
def get_grades(subject: str) -> Dict[str, Any]:
    _subject(subject)
    return {"subject": subject, "grades": data.list_grades(subject)}


@app.get("/subjects/{subject}/{grade}/chapters")
def get_chapters(subject: str, grade: str) -> Dict[str, Any]:
    sub = _subject(subject)
    mappings = data.load_mappings(subject, grade)
    chapters = [
        {"chapter_number": m.get("chapter_number"),
         "chapter_title": m.get("chapter_title", ""),
         "weight": sub.chapter_weight(m)}
        for m in mappings
    ]

    # ── Single-source allocation math (founder, 2026-07-25): the master plan
    # (data/cloud/content/allocation_norms/master_plan.json, derived from the allocation
    # workbook) is authoritative for BOTH the numerator (chapter effort weight) and
    # the denominator (FULL syllabus weight — including placeholder chapters with no
    # content yet). Suggestions = weight / syllabus_total_weight × the TEACHER'S OWN
    # annual budget; the canonical's authoring schedule (e.g. 21×50) never enters it.
    combo = data.master_combo(subject, grade)
    syllabus_total_weight = None
    if combo:
        by_ch = {row.get("chapter"): row for row in combo.get("chapters", [])}
        for c in chapters:
            row = by_ch.get(c["chapter_number"])
            if row and row.get("weight") is not None:
                c["weight"] = row["weight"]
        # ── Unreleased chapters are part of the year (founder, 2026-08-06) ────────────
        # The list above is built from the MAPPING FILES on disk, so a chapter the master
        # plan budgets for but NCERT hasn't published yet (SS·IX 10–18) never appeared —
        # its weight counted in the denominator while its row was missing, and the Year
        # Plan read half-empty (120 suggested against a 245 budget). Those rows are now
        # merged in from the master plan, titled "Book awaited" and flagged
        # `placeholder: true`. The flag is the contract: the Year Plan SHOWS them (the
        # teacher's year is 18 chapters whether or not the books have shipped), while
        # every flow that leads to GENERATING a lesson — first-run's chapter wheel,
        # Allocate's select list — filters them out, since there is no summary or mapping
        # to generate from. Ordered by chapter number so the merged rows sit in sequence.
        listed = {c["chapter_number"] for c in chapters}
        for row in combo.get("chapters", []):
            n = row.get("chapter")
            if n is None or n in listed:
                continue
            chapters.append({"chapter_number": n, "chapter_title": "Book awaited",
                             "weight": row.get("weight"), "placeholder": True})
        chapters.sort(key=lambda c: (c["chapter_number"] is None, c["chapter_number"]))
        syllabus_total_weight = combo.get("total_effort_weight")
    if not syllabus_total_weight:   # no master-plan combo → listed chapters are all we know
        syllabus_total_weight = sum((c.get("weight") or 0) for c in chapters) or None

    # ── Recommended periods per chapter — CALIBRATED FIRST (founder, 2026-07-26) ──
    # `recommended_periods` is the number every default in the product shows. It comes from
    # the master plan's own per-chapter figure — its share of the CALIBRATED annual budget at
    # the class's standard duration, the same basis the certified canonicals were authored at
    # (SS IX ch 5 = 21 periods × 50 min). Only when the master plan has no row for this
    # subject·class do we fall back to the NCF period-norms table (ncf_period_norms.json —
    # annual totals by subject·STAGE in flat 40-minute periods), distributed by the same
    # effort-index allocator the Allocate flow uses. The two tables genuinely disagree
    # (SS IX: 245 calibrated vs 150 NCF), which is why the first-run default used to
    # contradict the canonical it was about to generate.
    #
    # `ncf_estimated_periods` is retained ALONGSIDE, computed exactly as before, as the
    # published-norm reference the budget screen shows next to ours — it no longer drives any
    # default. `recommended_source` says which table won, so the UI never has to guess.
    #
    # NCF per-chapter estimate (2026-07-01, unchanged): distribute the subject·stage annual
    # total across this grade's chapters with the same effort-index-weighted allocator, whole
    # periods only (largest remainder already lands on integers). None where the norm table
    # has no figure for this subject·stage (e.g. Science·preparatory).
    try:
        stage = stage_for(grade)
    except UnknownGradeError:
        stage = None
    ncf_total = data.ncf_total_periods(subject, stage) if stage else None
    if ncf_total and combo and syllabus_total_weight:
        # Master-plan denominator: each chapter's NCF estimate is its share of the FULL
        # syllabus weight — stable as placeholder chapters gain content.
        for c in chapters:
            w = c.get("weight") or 0
            c["ncf_estimated_periods"] = round(w / syllabus_total_weight * ncf_total) or None
    elif ncf_total and mappings:
        allocs = {a.chapter_number: a.periods for a in allocate_for_subject(subject, mappings, ncf_total)}
        for c in chapters:
            c["ncf_estimated_periods"] = allocs.get(c["chapter_number"])
    else:
        for c in chapters:
            c["ncf_estimated_periods"] = None

    calibrated = data.master_recommended_periods(subject, grade)
    for c in chapters:
        cal = calibrated.get(c["chapter_number"])
        if cal:
            c["recommended_periods"], c["recommended_source"] = cal, "master_plan"
        elif c.get("ncf_estimated_periods"):
            c["recommended_periods"], c["recommended_source"] = c["ncf_estimated_periods"], "ncf"
        else:
            c["recommended_periods"], c["recommended_source"] = None, None
        # the canonical plan (genon/variant_plans.py v2.0): which canonicals to
        # author/serve — counts (counts[0] = the standard, equal dispersion down
        # to the floor), authored-on-disk list, provisional flag. No spans/sigma.
        c["canonical_plan"] = data.master_canonical_plan(subject, grade, c["chapter_number"])

    return {"subject": subject, "grade": grade, "chapters": chapters,
            "syllabus_total_weight": syllabus_total_weight,
            "standard_duration_minutes": data.standard_duration_minutes(grade, subject),
            "annual_budget_periods": data.master_annual_budget(subject, grade),
            "allocation_basis": sub.allocation_basis(grade)}


@app.get("/subjects/{subject}/{grade}/ncf-periods")
def get_ncf_periods(subject: str, grade: str) -> Dict[str, Any]:
    """Annual teaching-period figures for this subject·grade, for the budget estimator.

    `recommended_total_periods` is Aruvi's CALIBRATED annual budget (master_plan.json, from
    the founder's allocation workbook) — the figure to lead with. `ncf_total_periods` is the
    published NCF norm for the subject·stage, shown ALONGSIDE for transparency and used as
    the fallback when the master plan has no row for this class (2026-07-26).
    `recommended_source` says which one `recommended_total_periods` came from.
    `standard_duration_minutes` is the calibrated class length the budget is counted in
    (40 for ≤VII, 45 for VIII, 50 for IX–X) — the NCF figure is always in 40-min periods,
    so the two are not directly comparable at secondary."""
    _subject(subject)
    try:
        stage = stage_for(grade)
    except UnknownGradeError:
        stage = None
    ncf_total = data.ncf_total_periods(subject, stage) if stage else None
    budget = data.master_annual_budget(subject, grade)
    return {"subject": subject, "grade": grade, "stage": stage,
            "ncf_total_periods": ncf_total,
            "recommended_total_periods": budget if budget is not None else ncf_total,
            "recommended_source": "master_plan" if budget is not None else ("ncf" if ncf_total else None),
            "standard_duration_minutes": data.standard_duration_minutes(grade, subject)}


@app.post("/subjects/{subject}/{grade}/allocate")
def post_allocate(subject: str, grade: str, req: AllocateRequest) -> Dict[str, Any]:
    _subject(subject)
    mappings = data.load_mappings(subject, grade)
    if not mappings:
        raise HTTPException(status_code=404, detail="No chapter mappings for that subject/grade.")

    if req.chapter_numbers is not None:
        keep = {str(n) for n in req.chapter_numbers}
        mappings = [m for m in mappings if str(m.get("chapter_number")) in keep]
        if not mappings:
            raise HTTPException(status_code=422, detail="No chapters selected.")

    if req.period_rows:
        rows = [r.model_dump() for r in req.period_rows]
        result = allocate_schedule_for_subject(subject, mappings, rows)
        return {"subject": subject, "grade": grade, **result}

    if req.total_periods is not None:  # back-compat single-total path
        allocs = allocate_for_subject(subject, mappings, req.total_periods)
        return {"subject": subject, "grade": grade, "total_periods": req.total_periods,
                "allocations": [a.__dict__ for a in allocs]}

    raise HTTPException(status_code=422, detail="Provide period_rows or total_periods.")


def _count_units(groups) -> int:
    """Learning Units in a lesson-plan view = periods across (nested) groups — the same
    flatten LessonView.jsx uses. Counted server-side so plan LISTINGS can drive the
    My Classes card progress rail without the client fetching every full view."""
    n = 0
    for g in groups or []:
        n += len(getattr(g, "periods", None) or [])
        n += _count_units(getattr(g, "children", None) or [])
    return n


# ── the LU count, memoised across requests (2026-09-14) ───────────────────────────────
# `total_units` is the only field in the listing that costs real work: it re-reads the plan
# FILE and runs the full view-model normalisation, per plan. The library is Bucket A —
# shared, read-only content that changes only when the founder publishes — so the answer for
# a given file is a constant for the life of the process. Keyed by saved_at as well as the
# filename, so a republished plan is recounted rather than remembered.
_UNIT_COUNTS: Dict[tuple, Optional[int]] = {}


def _total_units(sub, subject: str, grade: str, p: Dict[str, Any]) -> Optional[int]:
    ck = (subject, grade, p.get("filename"), p.get("saved_at"))
    if ck in _UNIT_COUNTS:
        return _UNIT_COUNTS[ck]
    n = None
    try:
        saved = data.load_saved_plan(subject, grade, p["filename"]) or {}
        r = saved.get("result", {})
        chapter = {"chapter_number": saved.get("chapter_number"),
                   "chapter_title": saved.get("chapter_title")}
        # Pass the FULL result (2026-07-09): every plugin unwraps via
        # raw.get("lesson_plan", raw), and Science secondary needs the
        # result-level coverage_handoff for its section-group rejoin.
        lp = sub.lesson_plan_to_view(r, grade=saved.get("grade", grade), chapter=chapter)
        n = _count_units(lp.groups)
    except Exception:
        n = None
    _UNIT_COUNTS[ck] = n
    return n


# ── "NOTHING HAS CHANGED", AND WHY IT IS NOT A 304 (2026-09-16) ────────────────────────
# Two routes in this API run a freshness check — this one and GET /ask-aruvi. The client keeps
# the body on the device, sends its fingerprint back as If-None-Match, and most days the answer
# is "you already have it". The HTTP way to say that is 304 Not Modified, with no body.
#
# ★ RENDER'S EDGE TURNS OUR 304 INTO A 503. Measured on the live service, 2026-09-16: the same
# URL with the same account answers 200 WITHOUT the header and 503 WITH it, while an
# unauthenticated request carrying the header gets a normal 401 — so the header reaches us
# intact and it is the REPLY that does not get back. The same route code, run locally on this
# FastAPI and Starlette with the same CORS middleware, returns a textbook 304 (no body, no
# content-length, ETag and Cache-Control present). Our end is correct; the empty 304 is what
# does not survive the trip.
#
# ★ WHAT THAT COST, BEFORE THIS. Both checks failed for every device that already held a copy —
# which is every returning teacher. Both clients swallow the failure and keep what they have, so
# nothing looked broken: Ask Meyy still answered and My Lessons still listed. But the bank could
# never REFRESH — edit an answer and no existing phone would ever see it — and this listing
# re-requested on every mount, because the client only marks a copy fresh when the server has
# actually spoken.
#
# ★ SO WE SAY IT IN A 200 INSTEAD. `{"unchanged": true}` is eighteen bytes and an ordinary
# response, and it gets through. The saving is untouched: the phone still uploads a 32-character
# fingerprint and still avoids the full body. We keep ACCEPTING If-None-Match, so no client has
# to change to benefit and a future fix at Render needs no coordination — we simply never EMIT a
# 304 again.
# ⚠️ OLD CLIENTS ARE SAFE by construction: both check the shape of what came back before
# believing it (`Array.isArray(kb.pairs)`, `d.plans`), so an unchanged marker reads to them as
# "nothing useful" and they keep the stored copy — the same outcome a 304 gave them.
# ⚠️ THE MARKER IS NOT A PAYLOAD. Anything that ever needs to ride along with "unchanged" must
# go in the ETag or in a new field the clients opt into — a client that has not been taught the
# new field would drop it silently, which is exactly the trap this comment exists to name.
UNCHANGED = {"unchanged": True}
UNCHANGED_BYTES = b'{"unchanged":true}'


@app.get("/plans/{subject}/{grade}")
def get_plans(subject: str, grade: str, response: Response,
              year_id: Optional[str] = None,
              if_none_match: Optional[str] = Header(default=None),
              identity: tuple = Depends(_current_identity)) -> Any:
    sub = _subject(subject)
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    plans = data.list_saved_plans(subject, grade)
    # This teacher's archived plan keys for this subject·grade — so each listing carries its
    # OWN archived flag and the client can split the one list into Active vs Archived views
    # (archive is a flag, not a separate location; see PlanArchiveRepository). Keys are the
    # full `${subject}/${grade}/${filename}` the frontend also uses.
    archived = plan_archive_repo.load_all(tenant_id, user_id, year)
    # This teacher's PREPARED plan keys for this subject·grade. The saved-plan library is shared
    # read-only content (live gen deferred), so without this flag My Lessons would show every
    # sample plan to every teacher. `prepared` lets the client show only what she actually made;
    # a plan a section is attached to is treated as prepared client-side too (belt-and-braces).
    prepared = prepared_plans_repo.load_all(tenant_id, user_id, year)
    # ★ HER PRIOR YEARS, READ ONCE (2026-09-14). The provenance look-back below used to call
    # _prior_years_desc() — and, inside it, prepared_plans_repo.load_all() per year — for EVERY
    # plan in the listing. The answer is identical for all of them: it depends on the teacher and
    # the year, not on the plan. For english/iii that was 48 academic-year queries per request,
    # plus 48×N prepared-record reads for a teacher with prior years, to compute one constant.
    # Hoisted here, so the loop below only tests membership in a dict it already has.
    prior_years = _prior_years_desc(tenant_id, user_id, year)
    prepared_by_prior_year = {y: (prepared_plans_repo.load_all(tenant_id, user_id, y) or {})
                              for y in prior_years}
    # ★ THE RAIL IS HERS, SO THE COUNT IS TOO (founder-reported delay, 2026-09-14).
    # `total_units` exists for ONE reader: the progress rail on a section card, which can only
    # draw a chapter she is actually teaching. Computing it for the whole library meant 48 file
    # re-reads and 48 view-model normalisations per request to serve the one or two she holds —
    # the bulk of the server time left after the N+1 fix. Her own state already names them: a
    # prepared record, a carry-forward from an earlier year, or a section bound to the file.
    # Everything else ships total_units=None, exactly as an unreadable plan always has, and the
    # catalogue screens (Prepare, Generate, Allocate, Year Plan) never read the field at all.
    # ⚠️ Each section is a plain dict in the store (2026-09-18: this read `st.chapter` through
    #   getattr, so it was ALWAYS empty and a bound-but-unprepared plan shipped no unit count).
    bound_files = {c for c in (
        (st.get("chapter") if isinstance(st, dict) else getattr(st, "chapter", None))
        for st in (section_state_repo.load_all(tenant_id, user_id, year) or {}).values()) if c}
    # Enrich each listing with total_units (LU count) for the section-card rail. Best-effort:
    # a plan that fails to normalize just ships total_units=None and the card skips its rail.
    for p in plans:
        pkey = f"{subject}/{grade}/{p['filename']}"
        p["archived"] = pkey in archived
        p["archived_at"] = archived.get(pkey)
        p["prepared"] = pkey in prepared
        # prepared value is either a legacy ISO string or a {"at", "periods"} record.
        prec = prepared.get(pkey)
        if isinstance(prec, dict):
            p["prepared_at"] = prec.get("at")
            p["prepared_periods"] = prec.get("periods")
            # Set only when she carried this chapter forward from an earlier year.
            p["prepared_source_year"] = prec.get("source_year")
        else:
            p["prepared_at"] = prec
            p["prepared_periods"] = None
            p["prepared_source_year"] = None
        # ★ DERIVED PROVENANCE (founder, 2026-08-26). Aruvi's cutover rolls her year on the
        # date and carries her BINDINGS across, but not her prepared records — so on 1 June
        # a chapter she is still teaching is bound in the new year yet prepared only in the
        # old one. Look back and say so: her card must read "2026-27 version", because she
        # is teaching last year's material to this year's class and the constitution or the
        # textbook edition may since have moved. Explicit source_year (she carried it
        # forward herself) wins; this fills in for everything the roll left behind.
        # ★ `prepared` STAYS FALSE (founder, 2026-08-26). It answers "is this THIS year's
        # work?", and the answer is no — which is exactly what puts the plan in the
        # prior-year folder rather than this year's list. Setting it true here pulled all
        # of last year's lessons back into the main list and left the folder empty, which
        # is the opposite of the cutover the founder asked for. Only the STAMP is derived:
        # a section card finds its plan by filename regardless of this flag, so a chapter
        # she is still teaching still says which version she holds.
        if not p.get("prepared") and not p.get("prepared_source_year"):
            for prior_year in prior_years:
                if pkey in prepared_by_prior_year[prior_year]:
                    p["prepared_source_year"] = prior_year
                    break
        # ★ THE LP EDITION STAMP — SHOWN ONLY WHEN IT IS A PRIOR EDITION (founder, §2.2).
        # Note what sits directly above: `prepared_source_year` is HER year, the one she
        # prepared the plan in. This is a DIFFERENT fact — which authored edition of the
        # library the plan itself is. They are independent (she can teach one 2026-27
        # plan for several years), and showing one while she assumes the other is the
        # confusion §2.2 wrote the stamp to prevent.
        #
        # The RULE lives here, not in JSX: `lp_year_display` is null unless the plan
        # comes from an edition older than the one being served, so the screen cannot
        # disagree with the rule (the `_consent_outstanding` precedent). A teacher on the
        # current edition — every teacher, today — sees nothing at all. Silence is right:
        # the year is only information when it is NOT the obvious one.
        p["lp_year_display"] = (p.get("lp_year")
                                if p.get("lp_year") and p["lp_year"] < config.LP_YEAR
                                else None)
        hers = (p.get("prepared") or p.get("prepared_source_year")
                or p["filename"] in bound_files)
        p["total_units"] = _total_units(sub, subject, grade, p) if hers else None
    # The edition currently being served, so a client can label a prior-year folder
    # without re-deriving the comparison the per-plan rule above already made.
    payload = {"subject": subject, "grade": grade, "plans": plans,
               "current_lp_year": config.LP_YEAR}
    # ★ AN ETAG, SO THE FRESHNESS CHECK IS NEARLY FREE (2026-09-14). The client keeps this
    # listing on the device (packages/shared/src/plans.js) and sends the tag back; a listing
    # that has not moved — which is most of them, most days — answers with the unchanged marker
    # and no body. The tag is over the WHOLE payload, flags included, so an attach or a prepare
    # made on another device still changes it. Per-teacher by construction, hence no shared
    # cache header.
    # ⚠️ The marker is a 200, NOT a 304 — see the block above `get_plans` for the measurement
    # that forced that, and do not "tidy" it back into a 304 without re-testing against Render.
    body = json.dumps(payload, sort_keys=True, default=str)
    etag = '"%s"' % hashlib.sha256(body.encode("utf-8")).hexdigest()[:32]
    if if_none_match and if_none_match.strip() == etag:
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = "no-cache"
        return UNCHANGED
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "no-cache"
    return payload


@app.get("/plans/{subject}/{grade}/{filename}/view")
def get_plan_view(subject: str, grade: str, filename: str) -> Dict[str, Any]:
    sub = _subject(subject)
    # Reject path-ish filenames with a 400 up front, matching the archive/prepared endpoints'
    # _plan_key guard (A4, 2026-07-06). load_saved_plan below also guards (returns None → 404),
    # but validating here keeps the error code consistent across the plan endpoints.
    _plan_key(subject, grade, filename)
    saved = data.load_saved_plan(subject, grade, filename)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved plan not found.")
    r = saved.get("result", {})
    chapter = {"chapter_number": saved.get("chapter_number"), "chapter_title": saved.get("chapter_title")}
    g = saved.get("grade", grade)
    # Full result in (2026-07-09) — see the /plans listing note: plugins unwrap
    # lesson_plan themselves; Science secondary reads result-level coverage_handoff.
    lp = sub.lesson_plan_to_view(r, grade=g, chapter=chapter)
    _lp = r.get("lesson_plan", {})
    link_context = {"periods": _lp.get("periods", []),
                    "handoff": r.get("coverage_handoff", _lp.get("coverage_handoff", []))}
    a = sub.assessment_to_view(r.get("assessment_items", []), grade=g, chapter=chapter,
                               link_context=link_context)
    vm = ViewModel(lp, a).to_dict()
    # ── Dropped sections (founder, 2026-08-01): a below-floor plan carries its
    # unreached units (result.dropped_units, serve v1.1). They ride into the VIEW
    # only — rendered through the same subject adapter so their shape matches the
    # plan's own units — never into exports (her printed artifact stays as decided
    # at generation; online is an option, not an imposition).
    du = r.get("dropped_units") or []
    if du:
        vm["dropped_lp"] = sub.lesson_plan_to_view(
            {"lesson_plan": {"periods": du},
             "coverage_handoff": r.get("coverage_handoff", {})},
            grade=g, chapter=chapter)
        sf = (saved.get("genon") or {}).get("slot_fill") or {}
        vm["dropped_sections"] = sf.get("uncovered_sections") or []
    return {"meta": chapter, "view": vm}


@app.get("/subjects/{subject}/{grade}/allocation")
def get_allocation(subject: str, grade: str, year_id: Optional[str] = None,
                   identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Load this teacher's Persistent Annual Allocation Register for a subject/grade.

    Scoped to X-Aruvi-User and to an academic year (?year_id=, defaulting server-side to
    the teacher's current year): two teachers' registers for the same subject·grade are
    independent, and so are two years'. Returns the full saved register so the frontend
    can rehydrate its final-allocation view on page load — surviving a server restart or
    a fresh browser/profile, not just a localStorage cache in the same browser.
    """
    _subject(subject)
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    register = engine.get_allocation_register(
        tenant_id=tenant_id,
        user_id=user_id,
        year_id=year,
        subject_name=subject,
        grade=grade,
        allocation_repo=allocation_repo,
    )
    return {"subject": subject, "grade": grade, "allocation": register}


@app.post("/subjects/{subject}/{grade}/save_allocation")
def save_allocation(subject: str, grade: str, req: SaveAllocationRequest,
                    year_id: Optional[str] = None,
                    identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Save allocation data to this teacher's Persistent Annual Allocation Register.

    Merges the provided allocation into the existing register for the subject/grade,
    scoped to X-Aruvi-User and the academic year (?year_id=, defaulting server-side to
    the teacher's current year). Chapters in the allocation overwrite existing
    allocations; untouched chapters persist.

    Returns the updated Annual Allocation Summary.
    """
    _subject(subject)
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    try:
        engine.save_allocation(
            tenant_id=tenant_id,
            user_id=user_id,
            year_id=year,
            subject_name=subject,
            grade=grade,
            chapters_allocation=req.allocation,
            allocation_repo=allocation_repo,
        )
        summary = engine.get_allocation_summary(
            tenant_id=tenant_id,
            user_id=user_id,
            year_id=year,
            subject_name=subject,
            grade=grade,
            allocation_repo=allocation_repo,
        )
        return {
            "subject": subject,
            "grade": grade,
            "status": "saved",
            "summary": {
                "chapters_allocated": summary.chapters_allocated,
                "chapters_remaining": summary.chapters_remaining,
                "total_planned_periods": summary.total_planned_periods,
                "total_planned_time_minutes": summary.total_planned_time_minutes,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save allocation: {str(e)}")


@app.delete("/subjects/{subject}/{grade}/allocation")
def delete_allocation(subject: str, grade: str, year_id: Optional[str] = None,
                      identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Erase this teacher's saved Annual Allocation Register for a subject/grade — the
    server-side half of the "Reset allocations" action (the frontend also clears its
    localStorage cache). Scoped to X-Aruvi-User and the academic year."""
    _subject(subject)
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    engine.clear_allocation_register(
        tenant_id=tenant_id,
        user_id=user_id,
        year_id=year,
        subject_name=subject,
        grade=grade,
        allocation_repo=allocation_repo,
    )
    return {"subject": subject, "grade": grade, "status": "cleared"}


@app.get("/readiness")
def get_readiness(identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Load the current teacher's readiness teaching profile (per X-Aruvi-User).

    Returns {"ready": bool, "readiness": {subjects:[...]} | None}. `ready` is derived
    server-side as "a saved profile with at least one subject exists" — the frontend's
    old front-end-only `ready` flag now rehydrates from here, so the subject/grades/
    sections/durations a teacher entered survive a refresh, a server restart, or a fresh
    browser. Phase 4 keys this per user/tenant from the auth token (CLOUD_DATA_MODEL §2.1).
    """
    tenant_id, user_id = identity
    profile = readiness_repo.load_profile(tenant_id, user_id)
    ready = bool(profile and profile.get("subjects"))
    return {"ready": ready, "readiness": profile}


@app.post("/readiness/impact")
def preview_readiness_impact(req: ReadinessRequest,
                             identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Dry-run a profile edit: report what downstream work the proposed subjects[] would
    DELETE, without saving. The sidebar editor calls this before a destructive save so it can
    show a contextual warning. Returns {destructive, impact:[...]}."""
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id)
    current = readiness_repo.load_profile(tenant_id, user_id) or {}
    diff = _diff_profiles(current.get("subjects", []), req.subjects)
    impact = _cascade_impact(tenant_id, user_id, year, diff)
    return {"destructive": bool(impact), "impact": impact}


@app.post("/readiness")
def save_readiness(req: ReadinessRequest,
                   identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Persist the current teacher's readiness teaching profile (full replace, per user).

    Stores only the canonical subjects[]; the projection is stripped by the adapter.
    Cascade guard: if the edit REMOVES a subject/grade/section with downstream state and
    cascade is not set, refuse with HTTP 409 + the impact list so the UI can warn. With
    cascade=true, clear exactly the removed scopes' registers, then save. Additive edits
    save normally."""
    tenant_id, user_id = identity
    _check_productivity(tenant_id)     # lapsed: profile is read-only (§2.5 amended)
    year = _resolve_year(tenant_id, user_id)
    current = readiness_repo.load_profile(tenant_id, user_id) or {}
    diff = _diff_profiles(current.get("subjects", []), req.subjects)
    impact = _cascade_impact(tenant_id, user_id, year, diff)

    if impact and not req.cascade:
        raise HTTPException(status_code=409, detail={
            "error": "destructive_edit",
            "message": "This edit removes classes that have saved work. Confirm to proceed.",
            "impact": impact,
        })

    try:
        if impact:
            _apply_cascade(tenant_id, user_id, year, diff)
        readiness_repo.save_profile(tenant_id, user_id, {"subjects": req.subjects})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save readiness: {str(e)}")
    saved = readiness_repo.load_profile(tenant_id, user_id)
    return {"status": "saved", "ready": bool(saved and saved.get("subjects")),
            "cascaded": impact if impact else [], "readiness": saved}


@app.delete("/readiness")
def clear_readiness(identity: tuple = Depends(_current_identity)) -> Dict[str, str]:
    """Erase the current teacher's readiness profile (the "start setup over" action).

    Also wipes the teacher's section teaching-state so a rebuilt profile can't inherit stale
    chapter bindings for a reused section key (e.g. first-gen would show a card already
    "attached" to a chapter from a previous run — see MEMORY.md 2026-07-05)."""
    tenant_id, user_id = identity
    _check_productivity(tenant_id)     # lapsed: profile is read-only (§2.5 amended)
    year = _resolve_year(tenant_id, user_id)
    readiness_repo.clear_profile(tenant_id, user_id)
    section_state_repo.clear_all(tenant_id, user_id, year)
    # …and the teaching ledger with it, for the same reason: a section key reused by the
    # rebuilt profile would otherwise inherit another class's trail of taught chapters.
    section_history_repo.clear_all(tenant_id, user_id, year)
    return {"status": "cleared"}


# ── Section teaching-state (the lesson pointer) — per-user, cross-device ──────────
# Which chapter each section tracks + how far along (unit_index) + done. Moved off the
# browser's localStorage so tracking/progress follow a teacher to any device
# (CLOUD_DATA_MODEL.md §2.4). localStorage remains a client optimistic cache; these rows
# are authoritative on load/reconcile.
class SectionStateRequest(BaseModel):
    """Body for POST /section-state — a full snapshot of ONE section's execution state."""
    section_key: str
    chapter: str
    unit_index: Optional[int] = None
    done: bool = False
    # The teacher's ONE phase bookmark on this section's chapter (both 0-based, both None when
    # unset). Optional so an older client that doesn't send them is unaffected; they ride the
    # same row so they migrate to Supabase with the pointer (CLOUD_DATA_MODEL.md §2.4).
    bookmark_unit: Optional[int] = None
    bookmark_phase: Optional[int] = None


@app.get("/section-state")
def get_section_state(year_id: Optional[str] = None,
                      identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """All of this teacher's tracked sections for the year (?year_id=, defaulting to her
    current year): {"states": {section_key: {chapter, unit_index, done, bookmark_unit,
    bookmark_phase, updated_at}}}. The app reconciles these into its localStorage cache on
    load, so a fresh device shows the same tracking/progress (and bookmark) the teacher set
    on another."""
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    return {"states": section_state_repo.load_all(tenant_id, user_id, year)}


@app.post("/section-state")
def save_section_state(req: SectionStateRequest, year_id: Optional[str] = None,
                       identity: tuple = Depends(_current_identity)) -> Dict[str, str]:
    """Upsert one section's teaching state (full snapshot). Called when a chapter is tracked,
    the pointer advances, a chapter is marked complete, or the teacher moves her bookmark."""
    tenant_id, user_id = identity
    _check_productivity(tenant_id)     # lapsed: tracking is locked (§2.5 amended)
    year = _resolve_year(tenant_id, user_id, year_id)
    try:
        section_state_repo.save_one(tenant_id, user_id, year, req.section_key,
                                    req.chapter, req.unit_index, req.done,
                                    req.bookmark_unit, req.bookmark_phase)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save section state: {str(e)}")
    return {"status": "saved"}


@app.delete("/section-state/{section_key}")
def clear_section_state(section_key: str, year_id: Optional[str] = None,
                        identity: tuple = Depends(_current_identity)) -> Dict[str, str]:
    """Remove one section's state — the untrack reversal (and the completed-chapter reset)."""
    tenant_id, user_id = identity
    _check_productivity(tenant_id)     # lapsed: tracking is locked (§2.5 amended)
    year = _resolve_year(tenant_id, user_id, year_id)
    section_state_repo.delete_one(tenant_id, user_id, year, section_key)
    return {"status": "cleared"}


# ── Section chapter-history (the teaching ledger) — per-user, cross-device ────────
# What each section has ALREADY been taught. The pointer above is the present tense and
# deletes its row the moment a chapter leaves the slot; this is the past tense, and until
# now it existed only in the browser. localStorage stays a synchronous cache; these rows
# are authoritative on reconcile.
class SectionHistoryEntryModel(BaseModel):
    """One chapter's row in a section's ledger. `file` is the saved-plan filename, which is
    the row's identity (one row per chapter, latest action wins)."""
    file: str
    status: str                          # "completed" | "untracked"
    chapter_number: Optional[int] = None
    chapter_title: str = ""
    units_done: Optional[int] = None
    total_units: Optional[int] = None
    # Client-stamped epoch ms. It is the MERGE ORDER, not a display value: the store keeps
    # the higher `ts` for a given file, so a device pushing a stale queue after being offline
    # cannot overwrite a newer row. Optional so a malformed client still records something
    # (it simply loses every tie).
    ts: Optional[int] = None


class SectionHistoryRequest(BaseModel):
    """Body for POST /section-history — entries to MERGE into ONE section's ledger.

    A list rather than a single entry, so the one route serves both callers: the app
    recording a chapter as it is completed or set aside, and a device pushing its whole
    local ledger up once when it first reconciles."""
    section_key: str
    entries: List[SectionHistoryEntryModel]


@app.get("/section-history")
def get_section_history(year_id: Optional[str] = None,
                        identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """This teacher's whole ledger for the year (?year_id=, defaulting to her current):
    {"history": {section_key: {chapter_file: entry}}}. The app reconciles it into its
    localStorage cache on load, so a fresh device shows the same teaching trail."""
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    return {"history": section_history_repo.load_all(tenant_id, user_id, year)}


@app.post("/section-history")
def save_section_history(req: SectionHistoryRequest, year_id: Optional[str] = None,
                         identity: tuple = Depends(_current_identity)) -> Dict[str, str]:
    """Merge entries into one section's ledger. Called when a chapter is completed or set
    aside, and once per device on first reconcile."""
    tenant_id, user_id = identity
    _check_productivity(tenant_id)     # lapsed: tracking is locked (§2.5 amended)
    year = _resolve_year(tenant_id, user_id, year_id)
    try:
        section_history_repo.record(tenant_id, user_id, year, req.section_key,
                                    [e.model_dump() for e in req.entries])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save section history: {str(e)}")
    return {"status": "saved"}


class PlanArchiveRequest(BaseModel):
    # The plan identity as the frontend keys it: subject slug, grade slug, saved-plan filename.
    subject: str
    grade: str
    filename: str
    # Optional: the teacher's chosen period count for this chapter (PrepareLesson). Only
    # /plans-prepared reads it; archive/restore ignore it. None = don't record/change periods.
    periods: Optional[int] = None
    # Optional: the academic year this plan was ORIGINALLY prepared in, set when she brings a
    # previous year's chapter forward from the prior-year folder (founder, 2026-08-26). It
    # drives the "2026-27 version" stamp on her section card — provenance, not a copy.
    source_year: Optional[str] = None


def _plan_key(subject: str, grade: str, filename: str) -> str:
    """Canonical archive key for a plan. Guards against path-ish junk in the filename so a
    stored key can never smuggle a traversal into a later lookup."""
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid plan filename.")
    return f"{subject}/{grade}/{filename}"


@app.get("/plan-archive")
def get_plan_archive(year_id: Optional[str] = None,
                     identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """All of this teacher's archived plan keys for the year: {"archived": {plan_key:
    archived_at_iso}}. The client uses this to render the Archived view (and could split
    Active/Archived without re-reading each /plans call)."""
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    return {"archived": plan_archive_repo.load_all(tenant_id, user_id, year)}


@app.post("/plan-archive")
def archive_plan(req: PlanArchiveRequest, year_id: Optional[str] = None,
                 identity: tuple = Depends(_current_identity)) -> Dict[str, str]:
    """Archive one plan (declutter without deleting). Refused (409) for a plan a section is
    attached to — the UI hides the control too. Idempotent."""
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    key = _plan_key(req.subject, req.grade, req.filename)
    # ★ AN ATTACHED LESSON IS NEVER ARCHIVED (founder, 2026-09-18). Both surfaces already hide
    #   the control on one; this is the net, so the rule does not depend on a button being absent.
    prefix = f"{(req.subject or '').lower()}_{(req.grade or '').lower()}_"
    # ⚠️ The file store holds each section as a plain dict; read either shape.
    _chap = lambda st: st.get("chapter") if isinstance(st, dict) else getattr(st, "chapter", None)
    if any(k.startswith(prefix) and _chap(st) == req.filename
           for k, st in (section_state_repo.load_all(tenant_id, user_id, year) or {}).items()):
        raise HTTPException(status_code=409, detail=(
            "This lesson is attached to a class. Remove it from the class first, then archive it."))
    try:
        plan_archive_repo.archive(tenant_id, user_id, year, key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to archive plan: {str(e)}")
    return {"status": "archived"}


@app.delete("/plan-archive")
def restore_plan(req: PlanArchiveRequest, year_id: Optional[str] = None,
                 identity: tuple = Depends(_current_identity)) -> Dict[str, str]:
    """Restore one archived plan back into My Lessons. Lossless — the plan's identity and all
    its back-references never moved. No-op if it wasn't archived."""
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    key = _plan_key(req.subject, req.grade, req.filename)
    try:
        plan_archive_repo.restore(tenant_id, user_id, year, key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore plan: {str(e)}")
    return {"status": "restored"}


@app.get("/plans-prepared")
def get_prepared_plans(year_id: Optional[str] = None,
                       identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """All of this teacher's prepared plan keys for the year: {"prepared": {plan_key:
    prepared_at_iso}}."""
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    return {"prepared": prepared_plans_repo.load_all(tenant_id, user_id, year)}


@app.post("/plans-prepared")
def mark_plan_prepared(req: PlanArchiveRequest, year_id: Optional[str] = None,
                       identity: tuple = Depends(_current_identity)) -> Dict[str, str]:
    """Record one plan as prepared by this teacher — called when she generates/attaches a lesson
    (first-run activation, or the everyday PrepareLesson flow). Idempotent. This is what lets My
    Lessons show only her own work rather than the whole shared sample library."""
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    key = _plan_key(req.subject, req.grade, req.filename)
    try:
        prepared_plans_repo.mark(tenant_id, user_id, year, key, req.periods, req.source_year)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mark plan prepared: {str(e)}")
    return {"status": "prepared"}


class PlanNoteRequest(BaseModel):
    """Body for POST /plan-notes — one chapter's note, whole (no history, §2.4)."""
    subject: str
    grade: str
    chapter: str               # chapter_number as a string (title fallback allowed)
    text: str                  # empty/whitespace = delete (editing IS deleting)
    updated_at: str            # client's edit timestamp, ISO — the anti-clobber field


def _note_key(subject: str, grade: str, chapter: str) -> str:
    """Canonical note key: the CHAPTER's identity (one note per chapter per year —
    founder 2026-08-22 — never a plan filename). Guards against path-ish junk.

    The grade is NORMALIZED to the same slug every other store uses ("iv", never
    "Grade IV"): the client sends the view model's display grade, which varies by
    subject port, and an un-normalized key made kumar23's TWAU note file under
    "Grade IV" while his prepared/section keys said "iv" (found in the first live
    Step-4 export, 2026-08-22). Normalizing HERE keeps every client honest."""
    chapter = str(chapter).strip()
    if not chapter or "/" in chapter or "\\" in chapter or ".." in chapter:
        raise HTTPException(status_code=400, detail="Invalid chapter identity.")
    g = str(grade).strip().lower()
    for prefix in ("grade", "class"):
        if g.startswith(prefix):
            g = g[len(prefix):].strip()
    g = g.replace(" ", "_") or "unknown"
    return f"{str(subject).strip().lower()}/{g}/{chapter}"


@app.get("/plan-notes")
def get_plan_notes(year_id: Optional[str] = None,
                   identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """All of this teacher's chapter notes for the year: {"notes": {note_key: {text,
    updated_at}}}. The app reconciles these into its localStorage cache on load, so her
    notes follow her to any device (localStorage remains an optimistic cache; this is
    authoritative)."""
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id, year_id)
    notes = plan_note_repo.load_all(tenant_id, user_id, year)
    return {"notes": {k: {"text": n.text, "updated_at": n.updated_at}
                      for k, n in notes.items()}}


@app.post("/plan-notes")
def save_plan_note(req: PlanNoteRequest, year_id: Optional[str] = None,
                   identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Upsert one chapter's note (empty text deletes it — the everyday edit flow IS the
    delete flow, §2.4). Returns 409 with the server's newer copy when the write is stale,
    so a stale device shows the fresher note instead of clobbering it.

    ★ LAPSED LOCKS NOTES TOO (founder, 2026-08-26, closing checklist test 49). Writing
    notes was left open on the argument that a note is her own writing rather than a
    productivity tool; the founder ruled the other way — note-taking belongs to the
    working half of Aruvi, alongside the tracker and the profile. READING stays open
    (GET is ungated), so nothing she has already written is taken away: her notes
    export with her plans and come back the day she renews."""
    tenant_id, user_id = identity
    _check_productivity(tenant_id)     # lapsed: notes are read-only (§2.5 amended)
    year = _resolve_year(tenant_id, user_id, year_id)
    key = _note_key(req.subject, req.grade, req.chapter)
    try:
        plan_note_repo.save(tenant_id, user_id, year,
                            PlanNote(note_key=key, text=req.text, updated_at=req.updated_at))
    except StaleNoteWrite:
        newer = plan_note_repo.load(tenant_id, user_id, year, key)
        raise HTTPException(status_code=409, detail={
            "error": "stale_note",
            "message": "A newer copy of this note exists.",
            "note": {"text": newer.text, "updated_at": newer.updated_at} if newer else None,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save note: {str(e)}")
    return {"status": "deleted" if not req.text.strip() else "saved"}


# ── Data rights (administrative architecture Step 4) ──────────────────────────────
# NEVER gate these behind entitlement: DPDP access/erasure rights and Apple 5.1.1(v) do
# not lapse with payment (§2.5). UI surfaces for them come in Step 6.
@app.get("/data-rights/export")
def data_rights_export(format: str = "docx",
                       identity: tuple = Depends(_current_identity)) -> StreamingResponse:
    """Download everything this teacher owns as one document — account, profile,
    chapter notes across every year (beside their chapters), and teaching state.
    `?format=docx` (default, editable Word) or `?format=pdf` — both, like every other
    Aruvi export (founder 2026-08-22). Deliberately excludes the shared lesson-plan
    library (ports.DataRightsService)."""
    tenant_id, user_id = identity
    fmt = (format or "docx").strip().lower()
    if fmt not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail="format must be 'docx' or 'pdf'.")
    try:
        blob = data_rights.export(tenant_id, user_id, fmt)
    except ImportError:
        raise HTTPException(status_code=501,
                            detail="Export needs python-docx / xhtml2pdf on the server.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
    media = ("application/pdf" if fmt == "pdf" else
             "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    fname = f"aruvi-your-data-{_safe_name(user_id)}.{fmt}"
    return StreamingResponse(
        iter([blob]), media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


class EraseRequest(BaseModel):
    """Body for POST /data-rights/erase.

    TWO confirmations, because the two say different things (founder, 2026-08-26):
      · `confirm` must be the literal string "erase" — a typed act of intent, so no
        stray client call can destroy an account;
      · `downloaded_confirmed` must be True — she states she has her data. Deletion is
        irreversible and the export is the only copy she will ever get; the old screen
        merely SUGGESTED downloading first, which is advice, not a safeguard.
    Both are recorded in the erasure log before anything is destroyed."""
    confirm: str = ""
    downloaded_confirmed: bool = False


@app.post("/data-rights/erase")
def data_rights_erase(req: EraseRequest,
                      identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Erase this teacher's account and every piece of her data (account record last),
    returning the receipt that names what was kept and why (§2.6). Idempotent. The
    user ID is not reserved — signing in again starts a brand-new empty account."""
    if (req.confirm or "").strip().lower() != "erase":
        raise HTTPException(status_code=400,
                            detail='Confirmation required: send {"confirm": "erase"}.')
    if not req.downloaded_confirmed:
        raise HTTPException(status_code=400, detail=(
            "Please confirm you have downloaded your Meyy data. Deletion cannot be "
            "undone and the download is the only copy you can keep."))
    tenant_id, user_id = identity
    # ★ THE TRIAL LEDGER, BEFORE THE ENTITLEMENT IS DESTROYED (2026-09-18): one line, keyed by a
    #   keyed hash of the number, saying how much of the free trial it used — so erasing and
    #   signing up again does not hand out a new one.
    #   ⚠️ THE QUOTA IS CONSUMED BY CHAPTERS USED, AND BY NOTHING ELSE (founder, 2026-09-21,
    #   WALK-A-048). This used to pass `spent=(status != "trial")`, so a DIRECT SUBSCRIBER who
    #   deleted his account came back to "this mobile number has already used its free trial" —
    #   with chapters_used 0. He had never taken a trial; he had paid. The free chapters belong
    #   to the NUMBER and only using them spends them, which is the same rule for everyone and
    #   still farm-proof: `chapters_used` survives the erasure, so a balance is never reset.
    #   Only when the tenant IS the teacher (one teacher = one tenant, the ICP); never raises.
    try:
        ent_before = entitlement_repo.load(tenant_id)
        if ent_before is not None and _doc_slug(tenant_id) == _doc_slug(user_id):
            real_used = len([k for k in ent_before.trial_chapters or []])
            trial_ledger.note_erased(user_id, real_used)
    except Exception:
        pass
    # Record the consent BEFORE destroying anything: written after the fact it could be
    # lost to the very failure it exists to document. The log lives outside the erase
    # walk and carries identifiers and timestamps only — never personal data.
    consent = erasure_log.record(tenant_id, user_id, True)
    try:
        receipt = data_rights.erase(tenant_id, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erase failed: {str(e)}")
    return {"status": "erased" if receipt.erased else "nothing_to_erase",
            "erased": receipt.erased, "kept": receipt.kept,
            "erased_at": receipt.erased_at,
            "confirmation_recorded": bool(consent.get("logged")),
            "confirmed_at": consent.get("confirmed_at")}


# ── Academic year + cutover (administrative architecture Step 2) ────────────────
@app.get("/academic-year")
def get_academic_year(identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Her year, her past years, and whether the next one is on offer.

    `cutover_due` is the ONLY signal the UI needs: true once the calendar has reached the
    cutover date for the next year and she has not moved yet. It is computed server-side
    from her stored current year — never from the browser's clock, which a teacher can
    change and a phone in another timezone gets wrong anyway."""
    tenant_id, user_id = identity
    current_id = _resolve_year(tenant_id, user_id)      # may roll her forward, by design
    next_id = YearCutoverFileImpl.next_year_id(current_id)
    due_on = YearCutoverFileImpl.cutover_date(next_id, config.CUTOVER_MONTH_DAY)
    years = academic_year_repo.list_years(tenant_id, user_id) or []
    prior = [y.year_id for y in years if y.year_id != current_id]
    cur = next((y for y in years if y.year_id == current_id), None)
    # The ONLY thing still waiting on her: last year's tracking was carried into this year
    # so she could finish mid-chapter, and she has not yet chosen to start fresh.
    cleanup_due = bool(cur and cur.cleanup_pending)
    return {
        "current_year": current_id,
        "next_year": next_id,
        "prior_years": prior,
        # Her carried-forward tracking is waiting to be cleared (the teacher-side half).
        "cleanup_due": cleanup_due,
        # Retained for older clients; the year itself is no longer hers to trigger.
        "cutover_due": cleanup_due,
        "cutover_date": due_on.isoformat() if due_on else None,
        "today": _today().isoformat(),
        "simulated": bool(config.SIMULATED_TODAY),
    }


class CutoverRequest(BaseModel):
    """Body for POST /academic-year/cutover. `confirm` must be True — clearing a teacher's
    tracking is destructive of her place in every chapter, so it is never implicit."""
    confirm: bool = False


@app.post("/academic-year/cutover")
def do_cutover(req: CutoverRequest,
               identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """THE TEACHER-SIDE HALF: start fresh for the new cohort, on her confirmation.

    The YEAR itself is Aruvi's and rolls automatically on the cutover date
    (_auto_roll_year) — this route no longer moves it. What is left, and what only she can
    decide, is whether to CLEAR the tracking that was carried across so she could finish
    mid-chapter. Clearing it gives her the empty cards a new cohort deserves; her class
    list, her plans and her notes are untouched either way.

    Idempotent: with nothing pending, a second tap reports `already_done` and clears
    nothing (she may have started tracking this year's chapters by then)."""
    if not req.confirm:
        raise HTTPException(status_code=400,
                            detail='Confirmation required: send {"confirm": true}.')
    tenant_id, user_id = identity
    current_id = _resolve_year(tenant_id, user_id)
    years = academic_year_repo.list_years(tenant_id, user_id) or []
    cur = next((y for y in years if y.year_id == current_id), None)
    prior = [y.year_id for y in years if y.year_id != current_id]
    if cur is None or not cur.cleanup_pending:
        return {"status": "already_done", "closed_year": (prior[-1] if prior else current_id),
                "opened_year": current_id, "sections_cleared": 0,
                "sections_carried": 0, "plans_archived": 0, "already_done": True}
    try:
        carried = section_state_repo.load_all(tenant_id, user_id, current_id) or {}
        cleared = len(carried)
        section_state_repo.clear_all(tenant_id, user_id, current_id)
        # Starting fresh IS the moment a new cohort begins, so the teaching ledger goes with
        # the bindings: 9A's trail of chapters belongs to the children who sat through them.
        section_history_repo.clear_all(tenant_id, user_id, current_id)
        cur.cleanup_pending = False
        academic_year_repo.open_year(tenant_id, user_id, cur)   # idempotent in-place update
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not start fresh: {str(e)}")
    closed = prior[-1] if prior else current_id
    plans_archived = 0
    try:
        plans_archived = len(prepared_plans_repo.load_all(tenant_id, user_id, closed) or {})
    except Exception:                       # noqa: BLE001 — a count must never fail the act
        pass
    return {
        "status": "cutover", "closed_year": closed, "opened_year": current_id,
        "sections_cleared": cleared,
        # What carried into the new year is her PROFILE, which cutover never touches.
        "sections_carried": cleared,
        "plans_archived": plans_archived, "already_done": False,
    }


@app.get("/entitlement")
def get_entitlement(identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """The caller's entitlement state, for the (Step 6) UI: trial counter ("2 of 3
    chapters used"), subscription status, scopes. JIT-starts the trial on first read so
    a brand-new teacher's counter exists before her first generation. `enforced` tells
    the client whether the gate is live at all (dev default: off)."""
    tenant_id, _user_id = identity
    ent = _entitlement_of(tenant_id)
    # ★ `lapsed` is DERIVED here so the client never re-implements the rule (bug found
    #   2026-08-26: the web half tested `status === "expired"` only, so a subscription
    #   that ran out BY DATE kept its My Classes tab, "+" and edit pen while the server
    #   was already refusing its writes). Revoked OR date-expired — one answer, one place.
    #   With per-scope expiry it means NOTHING IS LIVE; `live_scopes` carries the rest,
    #   so the client never has to compare a date either.
    today = _today().isoformat()
    lapsed = config.ENTITLEMENT_ENFORCED and _entitlement_lapsed(ent, today)
    return {
        "plan_id": ent.plan_id, "status": ent.status, "valid_until": ent.valid_until,
        "lapsed": lapsed,
        "scope_valid_until": ent.scope_valid_until,
        "live_scopes": _live_scopes(ent, today),
        "source": ent.source, "scopes": ent.scopes,
        "trial_chapters_used": len(ent.trial_chapters),
        "trial_chapter_cap": config.TRIAL_CHAPTER_CAP,
        "trial_chapters": ent.trial_chapters,
        "enforced": config.ENTITLEMENT_ENFORCED,
        "price_per_subject_stage": config.PRICE_PER_SUBJECT_STAGE,
    }


# ── The user agreement: read it, tick it, prove it (2026-08-27) ────────────────
# Placement is the founder's, and the document's own front matter says the same: shown
# IN FULL before she chooses subjects and stages — the last moment before she commits to
# anything — and permanently available under Settings › Legal. Five ticks for the five
# points, one final tick for the body.
#
# ★ RE-CONSENT IS PER VERSION (founder, 2026-08-27), which is what §J of the agreement
# already promises. A subscriber adding a subject-stage next month walks past this
# screen; the same teacher after v0.2 is published takes all six ticks again. That rule
# lives in ONE place — `_consent_outstanding` — so the screen and the gate can never
# disagree about whether she has signed.

def _consent_status(tenant_id: str) -> Dict[str, Any]:
    """What this tenant has accepted, against what is current today."""
    version = legal.current_version()
    rec = consent_repo.latest(tenant_id, legal.DOCUMENT_ID, version)
    prior = consent_repo.latest(tenant_id, legal.DOCUMENT_ID)   # any version
    return {
        "current_version": version,
        "accepted": rec is not None,
        "accepted_at": rec.accepted_at if rec else "",
        "accepted_version": rec.document_version if rec else "",
        # A teacher who signed v0.1 and is being asked for v0.2 is NOT a new signatory,
        # and the screen should not address her as one.
        "prior_version": prior.document_version if (prior and rec is None) else "",
        "prior_accepted_at": prior.accepted_at if (prior and rec is None) else "",
    }


def _consent_outstanding(tenant_id: str) -> bool:
    """True when the current version has NOT been accepted by this tenant."""
    return not _consent_status(tenant_id)["accepted"]


@app.get("/ask-aruvi")
def get_ask_aruvi(response: Response,
                  if_none_match: Optional[str] = Header(default=None),
                  identity: tuple = Depends(_current_identity)) -> Any:
    """The Ask Aruvi question bank — SIGNED-IN ONLY, and cached on the device (2026-08-30).

    ★ WHY THIS IS A ROUTE AND NOT A BUNDLED IMPORT. It used to be
    `import kb from "./qa_knowledge_base.json"` inside AskAruvi.jsx, which put all 120
    answers into the main page chunk — a PUBLIC url, served before anyone signs in, and
    machine-readable. The bank states how period allocation is weighted and how each
    subject's assessment is built; that is founder IP and it was downloadable by any
    crawler. Serving it here puts it behind `X-Aruvi-User`: a free trial still reaches it,
    so this is a fence and not a wall, but nothing reaches it without an account.

    ★ AND IT MUST STILL WORK OFFLINE. Ask Aruvi is the HELP screen — it is needed exactly
    when the network is poor, on a school Android. So the client fetches this ONCE after
    sign-in and keeps it in localStorage, reading the stored copy thereafter; see
    AskAruvi.jsx. The ETag below is what makes that cheap: the client sends If-None-Match
    on each app load and normally gets an eighteen-byte "unchanged" back, so a teacher
    pays for the ~90KB only in the month the answers actually change.

    ⚠️ THAT ANSWER IS A 200, NOT A 304, and the reason is measured rather than stylistic —
    see the block above `get_plans`. Restoring the 304 here breaks the freshness check on
    Render while leaving every symptom invisible: the panel keeps working from the stored
    bank, and the bank silently stops updating.

    Not gated on entitlement, ever — the same reasoning as data rights and support
    (§2.5): a teacher whose subscription is the broken thing must still be able to read
    how the product works.
    """
    try:
        raw = data.ask_aruvi_bank_bytes()
    except FileNotFoundError:
        raise HTTPException(status_code=503,
                            detail="The Ask Meyy question bank is not installed on this server.")
    etag = '"%s"' % hashlib.sha256(raw).hexdigest()[:32]
    if if_none_match and if_none_match.strip() == etag:
        return Response(content=UNCHANGED_BYTES, media_type="application/json",
                        headers={"ETag": etag, "Cache-Control": "no-cache"})
    return Response(content=raw, media_type="application/json",
                    headers={"ETag": etag, "Cache-Control": "no-cache"})


@app.get("/legal/consent")
def get_legal_consent(version: Optional[str] = None,
                      identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """The agreement itself, parsed into the pieces the UI ticks, plus this tenant's
    acceptance state. One source of truth (api/legal.py): the wizard's Agreement step
    and Settings › Legal render THIS, never a re-typed summary.

    `?version=` serves an older published version — what Settings shows a teacher who
    accepted v0.1 after v0.2 has been published, because the document she is entitled to
    read back is the one she actually signed."""
    tenant_id, _user_id = identity
    status = _consent_status(tenant_id)
    want = version or status["accepted_version"] or status["current_version"]
    try:
        doc = legal.load_consent_document(want)
    except legal.ConsentDocumentError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"document": doc, **status, "versions": legal.available_versions()}


@app.get("/legal/consent/status")
def get_legal_consent_status(identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Has this tenant accepted the current version? — WITHOUT the document.

    The subscribe wizard asks this on mount to decide whether the Agreement step is in
    her path at all, while she is still typing her name. Shipping the whole agreement to
    answer a yes/no would make that decision cost more than the step it might skip."""
    tenant_id, _user_id = identity
    try:
        return _consent_status(tenant_id)
    except legal.ConsentDocumentError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


class ConsentAccept(BaseModel):
    """Body for POST /legal/consent — one completed acceptance.

    `acknowledgements` is the list of tick ids she ticked; the server checks it against
    the document's own ids rather than trusting a count, because "five ticks arrived" is
    not the same fact as "these five points were accepted"."""
    version: str
    acknowledgements: List[str]
    final: bool = False
    context: str = "subscription_checkout"
    language: str = "en"
    # ★ The OPTIONAL marketing tick (v0.4+). Deliberately its own field and NOT a member
    #   of `acknowledgements`: DPDP §6 requires consent to be free and unconditional, so
    #   this may never be one of the ticks the acceptance is validated against. False —
    #   or absent, which is what every older client sends — is a complete acceptance.
    marketing_email: bool = False


@app.post("/legal/consent")
def post_legal_consent(req: ConsentAccept,
                       user_agent: str = Header(default="", alias="User-Agent"),
                       identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Record an acceptance. Append-only — a new version is a new record, and nothing
    already signed is ever rewritten.

    Refuses a PARTIAL acceptance (400) rather than storing one. A record that says four
    of five points were accepted describes a document nobody agreed to; the UI already
    disables its button, and this is the net behind it."""
    tenant_id, user_id = identity
    try:
        current = legal.current_version()
        expected = legal.acknowledgement_ids(current)
    except legal.ConsentDocumentError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    # Only the CURRENT version can be accepted — accepting a superseded one would create
    # a record that looks valid and satisfies nothing.
    if (req.version or "").strip() != current:
        raise HTTPException(status_code=409, detail=(
            "The agreement has been updated. Please read and accept the current version."))
    ticked = [a for a in (req.acknowledgements or []) if a in expected]
    missing = [a for a in expected if a not in ticked]
    if missing or not req.final:
        raise HTTPException(status_code=400, detail=(
            "Please confirm each point and accept the full agreement to continue."))
    now = datetime.now(timezone.utc).isoformat()
    record = ConsentRecord(
        tenant_id=tenant_id, user_id=user_id,
        document_id=legal.DOCUMENT_ID, document_version=current,
        language=(req.language or legal.LANGUAGE).strip() or legal.LANGUAGE,
        accepted_at=now,
        # One timestamp per tick is what the document asks to be recorded. The client
        # does not send per-tick times (it would be sending us its own clock); they are
        # stamped here, at the moment the completed acceptance arrives.
        acknowledgements={a: now for a in expected},
        final_accepted_at=now,
        context=(req.context or "subscription_checkout").strip(),
        user_agent=(user_agent or "")[:300])
    consent_repo.save(record)
    # Mirrored onto the account record's existing `consent` field, which Step 0 put there
    # for exactly this and which the account export already renders. The LEDGER is the
    # authority; this is the convenience copy, and it is the one that is erased with her
    # account.
    acct = account_repo.load(tenant_id, user_id)
    if acct is not None:
        acct.consent = {"policy_version": current, "accepted_at": now,
                        "document_id": legal.DOCUMENT_ID}
        # ★ THE MARKETING CHOICE LIVES ON THE ACCOUNT, NOT IN THE LEDGER (2026-09-04).
        #   The two records have opposite lifetimes and that is the whole reason they are
        #   kept apart: the ledger is append-only and RETAINED through erasure, because it
        #   is proof she agreed. A marketing consent must be the reverse — withdrawable at
        #   any moment, and gone when she erases her account. Writing it into the ledger
        #   would make it un-withdrawable evidence of a preference, which is neither
        #   lawful nor useful. `notify` already existed for contact preferences, so this
        #   joins it rather than inventing a field, and the export renders it from there.
        #   The version and timestamp ride along: "she opted in" is a weaker fact than
        #   "she opted in on this date, against this version of the agreement".
        notify = dict(acct.notify or {})
        notify["marketing_email"] = bool(req.marketing_email)
        notify["marketing_email_at"] = now if req.marketing_email else ""
        notify["marketing_email_version"] = current if req.marketing_email else ""
        acct.notify = notify
        account_repo.save(acct)
    # The final tick's own words are "…the full User Agreement and Privacy Notice", and
    # the notice is linked from that line — so the version current at this moment is
    # the one she was shown. Stamped after the save above (it re-reads the record).
    _stamp_privacy_seen(tenant_id, user_id, (req.context or "subscription_checkout").strip())
    return {"status": "accepted", "version": current, "accepted_at": now,
            "marketing_email": bool(req.marketing_email)}


# ── The Privacy Notice: given, not signed (2026-09-04) ───────────────────────────
# Three routes and one stamp. GET /legal/privacy has NO identity dependency — a notice
# must be readable before she gives us anything, and the sign-in screen links to it
# while the mobile field is still empty. The status/seen pair is what lets the shell
# say "the notice was updated" exactly once per version, and `_stamp_privacy_seen` is
# the ONE writer of `Account.privacy_notice`, called at first registration (the moment
# the mobile is collected) and on dismissal of the note. See api/legal.py for why there
# is no tick and no ledger.

def _stamp_privacy_seen(tenant_id: str, user_id: str, context: str) -> Dict[str, Any]:
    """Record that the CURRENT notice version was shown. Overwrites — the record answers
    "which version has she seen?", not "which versions has she ever seen?"; the ledger
    idiom is for consents, and this is not one."""
    try:
        version = legal.current_privacy_version()
    except legal.ConsentDocumentError:
        return {}
    acct = account_repo.load(tenant_id, user_id)
    if acct is None:
        return {}
    now = datetime.now(timezone.utc).isoformat()
    acct.privacy_notice = {"version": version, "seen_at": now,
                           "context": (context or "").strip() or "app"}
    account_repo.save(acct)
    return dict(acct.privacy_notice)


@app.get("/legal/privacy")
def get_legal_privacy(version: Optional[str] = None) -> Dict[str, Any]:
    """The Privacy Notice, front matter dropped, as one markdown body. OPEN — no
    X-Aruvi-User — because it is linked from the sign-in screen and must be readable by
    someone who has not yet told us her number. `?version=` serves an older published
    version (what her account says she was shown)."""
    try:
        doc = legal.load_privacy_document(version)
        return {"document": doc, "current_version": legal.current_privacy_version(),
                "versions": legal.privacy_versions()}
    except legal.ConsentDocumentError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@app.get("/legal/privacy/status")
def get_legal_privacy_status(identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Which version she has been shown against which is current — WITHOUT the document.
    The shell asks this on load; `updated` is true when a newer version has been
    published since the one on her record (or none is recorded at all)."""
    tenant_id, user_id = identity
    try:
        current = legal.current_privacy_version()
    except legal.ConsentDocumentError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    acct = account_repo.load(tenant_id, user_id)
    seen = dict((acct.privacy_notice if acct else None) or {})
    seen_version = str(seen.get("version") or "")
    # ★ `updated` means "a NEWER version than the one she was shown" — and ONLY that
    #   (founder, 2026-09-04: "do not show the pop up for existing users … internal demo
    #   only"). An account with NO record (every account from before the field, every
    #   dev account) is silent: it is stamped the next time she registers, signs the
    #   agreement or is shown a bump, never nagged for a document that predates it.
    return {"current_version": current, "seen_version": seen_version,
            "seen_at": str(seen.get("seen_at") or ""),
            "updated": bool(seen_version) and seen_version != current}


class PrivacySeen(BaseModel):
    """Body for POST /legal/privacy/seen — where the notice was shown."""
    context: str = "app"


@app.post("/legal/privacy/seen")
def post_legal_privacy_seen(req: PrivacySeen,
                            identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """She has seen (or dismissed the note about) the current version. Stamps the
    account; the next status call answers `updated: false` until a newer file exists."""
    tenant_id, user_id = identity
    rec = _stamp_privacy_seen(tenant_id, user_id, req.context)
    if not rec:
        raise HTTPException(status_code=503, detail="The privacy notice is not installed on this server.")
    return {"status": "seen", **rec}


class AccountUpdate(BaseModel):
    """Body for POST /account — the Settings › Personal profile editor. Only provided
    fields change; the id/phone (her sign-in) is never editable here."""
    name: Optional[str] = None
    email: Optional[str] = None      # double-confirmed client-side
    role: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    school: Optional[str] = None
    # The WhatsApp support choice (2026-09-26) — lives in Personal profile beside the
    # email it trades off against. See _ONE_CHANNEL.
    whatsapp: Optional[bool] = None


# ★ AT LEAST ONE CHANNEL, ALWAYS (founder, 2026-09-26). A subscriber must keep a way for
# Meyy to reach her — invoices when she pays, legal and privacy notices — so WhatsApp can
# be switched OFF only while an email is on record, and an email can be cleared only while
# WhatsApp is on. She may leave either channel; she may not leave both. (Replying STOP on
# WhatsApp is the one exception — Meta's policy — and is honoured by the webhook.)
_ONE_CHANNEL = ("Meyy needs at least one way to reach you — for your invoices and for "
                "legal and privacy notices. Add an email address first, then you can "
                "switch WhatsApp off.")


@app.get("/account")
def get_account(identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """The caller's personal-profile fields (Settings › Personal profile). Never gated
    on subscription state — seeing and correcting her own record is her right."""
    tenant_id, user_id = identity
    a = account_repo.load(tenant_id, user_id)
    if a is None:
        raise HTTPException(status_code=404, detail="No account.")
    return {"display_name": a.display_name, "email": a.email, "phone": a.phone,
            "role": a.role, "state": a.state, "city": a.city,
            "school_name": a.school_name, "created_at": a.created_at,
            # Has the guided tour already had its one showing? (2026-08-26)
            "tour_offered_at": a.tour_offered_at,
            # The optional marketing choice (v0.4), so Settings can show and change it.
            "marketing_email": bool((a.notify or {}).get("marketing_email")),
            "marketing_email_at": (a.notify or {}).get("marketing_email_at", ""),
            # The WhatsApp support opt-in (2026-09-26) — on the SIGN-IN mobile, never a
            # second number, so there is no number field to return beside it.
            "whatsapp": bool((a.notify or {}).get("whatsapp")),
            "whatsapp_at": (a.notify or {}).get("whatsapp_at", "")}


def _set_whatsapp(a: Any, enabled: bool) -> None:
    """Record the WhatsApp opt-in on the account's `notify` (the slot ports.Account has
    reserved for it since Step 0). Same shape as the marketing choice: a flag, WHEN, and
    against which agreement version — and turning it off clears the date, because an
    opt-in date beside a false flag is a record that contradicts itself."""
    now = datetime.now(timezone.utc).isoformat()
    notify = dict(a.notify or {})
    notify["whatsapp"] = bool(enabled)
    notify["whatsapp_at"] = now if enabled else ""
    notify["whatsapp_version"] = (legal.current_version() if enabled else "")
    a.notify = notify


def _wa_e164(mobile: str) -> str:
    """The sign-in id (a 10-digit Indian national number) as WhatsApp wants it: digits,
    country code first, no "+". Anything already carrying 91 + 10 digits passes through."""
    d = "".join(c for c in str(mobile or "") if c.isdigit())
    if len(d) == 12 and d.startswith("91"):
        return d
    return ("91" + d[-10:]) if len(d) >= 10 else ""


def _wa_welcome(a: Any, mobile: str) -> Dict[str, Any]:
    """Send the WhatsApp welcome ONCE per account (2026-09-26). Called when the opt-in is
    turned on — at checkout or later in Settings. `whatsapp_welcomed_at` makes it
    once-ever: a re-subscribe or a toggle off-and-on must not greet her twice. Only a real
    send or a dev outbox write stamps it, so a Meta error leaves the door open for the
    next opt-in (and the founder's log says the welcome is still owed). Never raises;
    the CALLER saves the account."""
    notify = dict(a.notify or {})
    if not notify.get("whatsapp"):
        return {"status": "skipped", "reason": "not opted in"}
    if notify.get("whatsapp_welcomed_at"):
        return {"status": "skipped", "reason": "already welcomed"}
    first = (str(a.display_name or "").strip().split() or [""])[0]
    if not first or first.isdigit():
        first = "there"                       # "Hello there" beats "Hello 9876543210"
    res = wa_client.send_template(WhatsAppTemplate(
        to=_wa_e164(mobile), template=config.WA_WELCOME_TEMPLATE,
        language=config.WA_TEMPLATE_LANG,
        params=[first] if config.WA_WELCOME_NAME_PARAM else []))
    if res.get("status") in ("sent", "written"):
        notify["whatsapp_welcomed_at"] = datetime.now(timezone.utc).isoformat()
        a.notify = notify
    return res


class WhatsAppPref(BaseModel):
    enabled: bool


@app.post("/account/whatsapp")
def set_whatsapp(req: WhatsAppPref,
                 identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Switch WhatsApp support on or off (2026-09-26) — off only while an email is on
    record (_ONE_CHANNEL). The web uses POST /account from Personal profile; this route
    stays for the phone app and scripts."""
    tenant_id, user_id = identity
    a = account_repo.load(tenant_id, user_id)
    if a is None:
        raise HTTPException(status_code=404, detail="No account.")
    # Off only while an email is on record — at least one channel, always (_ONE_CHANNEL).
    if not req.enabled and not (a.email or "").strip():
        raise HTTPException(status_code=409, detail=_ONE_CHANNEL)
    _set_whatsapp(a, bool(req.enabled))
    welcome = _wa_welcome(a, a.phone or user_id) if req.enabled else {"status": "skipped"}
    account_repo.save(a)
    return {"whatsapp": bool(req.enabled),
            "whatsapp_at": (a.notify or {}).get("whatsapp_at", ""),
            "welcome_status": welcome.get("status", "skipped")}


class MarketingPref(BaseModel):
    enabled: bool


@app.post("/account/marketing-email")
def set_marketing_email(req: MarketingPref,
                        identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Turn the optional marketing emails on or off (§K of the agreement).

    ★ ITS OWN ROUTE, and never gated — not on subscription, not on trial, not on
    entitlement. DPDP §6 requires withdrawal to be as easy as consent was, so this must
    not sit behind anything the consent itself did not sit behind; the same reasoning
    that keeps data rights and support ungated (§2.5). A lapsed teacher who wants the
    mail to stop must be able to stop it.

    Turning it OFF clears the date and version too: those record WHEN she opted in, and
    a stale opt-in date beside a false flag is a record that contradicts itself. What
    remains is simply "not opted in", which is the truth."""
    tenant_id, user_id = identity
    a = account_repo.load(tenant_id, user_id)
    if a is None:
        raise HTTPException(status_code=404, detail="No account.")
    now = datetime.now(timezone.utc).isoformat()
    notify = dict(a.notify or {})
    notify["marketing_email"] = bool(req.enabled)
    notify["marketing_email_at"] = now if req.enabled else ""
    notify["marketing_email_version"] = (legal.current_version() if req.enabled else "")
    a.notify = notify
    account_repo.save(a)
    return {"marketing_email": bool(req.enabled),
            "marketing_email_at": notify["marketing_email_at"]}


@app.post("/account/tour-offered")
def mark_tour_offered(identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """★ THE TOUR IS OFFERED ONCE, EVER (founder, 2026-08-26, live).

    Called by the client the first time the offer is actually rendered. Write-once: a
    second call never moves the timestamp, so the record answers "was it offered?" and
    not "when did she last see it".

    Why a stored flag, when the earlier rule deliberately avoided one ("no localStorage
    desync trap"): the derived rule — at most one bound section and no progress anywhere
    — describes a NEW TEACHER, and a teacher becomes indistinguishable from a new one
    every time her bindings are cleared. Which is precisely what the academic-year
    cutover does, every June, by design. So a veteran was offered the 20-step tour again
    each year, and again whenever she cleared her cards. The founder's rule is simpler
    than any heuristic: show it once, and if she skips it, it is gone. That is a FACT
    about her account, so it belongs on the account — where it also survives sign-out and
    a new device, both of which localStorage would lose.
    """
    tenant_id, user_id = identity
    a = account_repo.load(tenant_id, user_id)
    if a is None:
        raise HTTPException(status_code=404, detail="No account.")
    if not a.tour_offered_at:
        a.tour_offered_at = datetime.now(timezone.utc).isoformat()
        account_repo.save(a)
    return {"tour_offered_at": a.tour_offered_at}


def _guard_email_not_taken(email: str, self_id: str) -> None:
    """Refuse an address that already belongs to a DIFFERENT account (2026-08-26).

    Email became a sign-in credential the day sign-in started accepting it, and a
    credential that points at two accounts points at neither: whoever typed it would land
    in someone else's data, or — more likely in the field — a teacher who mistyped her
    second mobile's address would quietly split herself in two. Prevention lives here so
    duplicates cannot arise; find_by_email's ambiguity guard is the net for records that
    already exist. Re-saving your OWN address is always fine."""
    needle = (email or "").strip()
    if not needle:
        return
    for other in account_repo.find_all_by_email(needle):
        if other.account_id != self_id:
            raise HTTPException(status_code=409, detail=(
                "This email is already in use by another Meyy account. "
                "Use a different address."))


@app.post("/account")
def update_account(req: AccountUpdate,
                   identity: tuple = Depends(_current_identity)) -> Dict[str, str]:
    """Update personal-profile fields. Partial: only sent fields change."""
    tenant_id, user_id = identity
    a = account_repo.load(tenant_id, user_id)
    if a is None:
        raise HTTPException(status_code=404, detail="No account.")
    if req.name is not None:
        a.display_name = req.name.strip() or a.display_name
    had_channel = bool((a.email or "").strip()) or bool((a.notify or {}).get("whatsapp"))
    if req.email is not None:
        _guard_email_not_taken(req.email, a.account_id)
        a.email = req.email.strip()
    if req.whatsapp is not None:
        was_on = bool((a.notify or {}).get("whatsapp"))
        if bool(req.whatsapp) != was_on:
            _set_whatsapp(a, bool(req.whatsapp))
            if req.whatsapp:
                _wa_welcome(a, a.phone or user_id)
    # Checked on the RESULT, so no order of fields can slip past it — and only against an
    # account that HAD a channel, so a record from before the rule can still save its name.
    if had_channel and not (a.email or "").strip() and not (a.notify or {}).get("whatsapp"):
        raise HTTPException(status_code=409, detail=_ONE_CHANNEL)
    if req.role is not None:
        a.role = req.role.strip()
    if req.state is not None:
        a.state = req.state.strip()
    if req.city is not None:
        a.city = req.city.strip()
    if req.school is not None:
        a.school_name = req.school.strip()
    account_repo.save(a)
    return {"status": "saved"}


# ── WhatsApp webhook (2026-09-26) ─────────────────────────────────────────────
# Meta calls this for every inbound message and every delivery status on the Meyy number.
# Configure it in the Meta app: Callback URL = {API}/whatsapp/webhook, Verify token =
# ARUVI_WA_VERIFY_TOKEN, subscribe to the `messages` field. It does three things only:
#   * VERIFY — the GET handshake Meta performs once when the URL is saved.
#   * AUTHENTICATE — every POST carries X-Hub-Signature-256 (HMAC-SHA256 of the raw body
#     under the app secret); an unsigned or mis-signed POST is refused, because this route
#     can switch a teacher's opt-in off and must not be drivable by anyone on the internet.
#   * LOG + HONOUR "STOP" — events are appended to STATE_DIR/whatsapp_inbox/{date}.jsonl
#     (the founder answers chats in the Business app — coexistence — so the app does NOT
#     turn each message into a support case), and a message that is exactly STOP turns
#     her WhatsApp opt-in off: withdrawal as easy as the consent (DPDP §6).
def _wa_log(event: Dict[str, Any]) -> None:
    try:
        from pathlib import Path
        d = Path(config.STATE_DIR) / "whatsapp_inbox"
        d.mkdir(parents=True, exist_ok=True)
        with open(d / f"{datetime.now(timezone.utc).date().isoformat()}.jsonl", "a",
                  encoding="utf-8") as fh:
            fh.write(json.dumps({"at": datetime.now(timezone.utc).isoformat(), **event}) + "\n")
    except Exception:                                  # noqa: BLE001
        pass


@app.get("/whatsapp/webhook")
def whatsapp_webhook_verify(request: Request):
    q = request.query_params
    if (config.WA_VERIFY_TOKEN and q.get("hub.mode") == "subscribe"
            and q.get("hub.verify_token") == config.WA_VERIFY_TOKEN):
        return Response(content=q.get("hub.challenge", ""), media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed.")


@app.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request) -> Dict[str, Any]:
    import hmac
    raw = await request.body()
    if not config.WA_APP_SECRET:
        raise HTTPException(status_code=503, detail="WhatsApp webhook not configured.")
    sig = request.headers.get("X-Hub-Signature-256", "")
    want = "sha256=" + hmac.new(config.WA_APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, want):
        raise HTTPException(status_code=401, detail="Bad signature.")
    try:
        body = json.loads(raw or b"{}")
    except ValueError:
        return {"status": "ignored"}
    for entry in body.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            for st in value.get("statuses") or []:
                _wa_log({"kind": "status", "id": st.get("id"), "status": st.get("status"),
                         "to": st.get("recipient_id"),
                         "errors": st.get("errors") or []})
            for m in value.get("messages") or []:
                sender = str(m.get("from") or "")
                text = ((m.get("text") or {}).get("body") or "").strip()
                _wa_log({"kind": "message", "from": sender, "type": m.get("type"),
                         "text": text[:1000]})
                if text.upper() == "STOP":
                    uid = sender[-10:]
                    a = account_repo.load(uid, uid) if uid else None
                    if a is not None and (a.notify or {}).get("whatsapp"):
                        _set_whatsapp(a, False)
                        account_repo.save(a)
                        _wa_log({"kind": "opt_out", "user": uid})
    # Always 200 once authenticated — a non-2xx makes Meta retry the same event for days.
    return {"status": "ok"}


# ── Support (2026-08-27) ───────────────────────────────────────────────────────
# Email is the only support channel Aruvi offers, so this route carries the whole of
# what a chat widget would otherwise do. Three rules shape it:
#
#   * NEVER GATED. Not on subscription, not on trial state, not on entitlement. A
#     teacher whose subscription is the thing that is broken must be able to say so —
#     the same reasoning that keeps data rights ungated (§2.5).
#   * THE ACKNOWLEDGEMENT IS THE FEATURE. Email's failure mode is silence, and a
#     teacher who hears nothing writes again, or gives up. She gets a reference and a
#     stated reply window within seconds.
#   * A MAIL FAILURE MUST NOT LOSE THE MESSAGE. The request is STORED first and mailed
#     second, and the store is the record. `notifier.send` never raises by contract, so
#     the worst case is a saved case with `acknowledged: false` — recoverable, and
#     visible to the founder — rather than her words evaporating.
_SUPPORT_MAX_CHARS = 4000


class SupportMessage(BaseModel):
    """Body for POST /support. Named for the message, not the port's SupportRequest —
    the two would otherwise share a name across the HTTP and domain layers."""
    category: str = "problem"      # problem | plan | billing | suggestion
    message: str
    # What the app knew when she pressed send: {screen, subject, grade, chapter}. Sent
    # by the client rather than inferred here, because only the client knows which
    # screen she was standing on — and shown back to her in the acknowledgement.
    context: Dict[str, str] = {}


def _support_reply_days(category: str) -> int:
    """Billing gets the firmer promise. One place, so the screen's line, the mail's line
    and the founder's copy cannot end up quoting three different windows."""
    return (config.SUPPORT_BILLING_REPLY_DAYS
            if str(category or "").strip().lower() == "billing"
            else config.SUPPORT_REPLY_DAYS)


@app.post("/support")
def create_support_request(req: SupportMessage,
                           identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Record a support request, acknowledge it to the teacher, and copy the founder.

    Returns the reference and the promised window so the confirmation screen quotes
    EXACTLY what the mail quotes. `emailed` tells the client whether the acknowledgement
    actually left — an account with no email address on it still files a real case, and
    the screen then says so instead of promising a mail that was never sent."""
    tenant_id, user_id = identity
    text = (req.message or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Please write your message first.")
    if len(text) > _SUPPORT_MAX_CHARS:
        # A cap, said in her units. Long enough that nobody hits it describing a real
        # problem; low enough that a pasted logfile cannot become the support system.
        raise HTTPException(status_code=400, detail=(
            f"That message is longer than {_SUPPORT_MAX_CHARS} characters. Send the "
            f"important part and we will ask for the rest."))
    category = (req.category or "problem").strip().lower()
    if category not in mail_templates.SUPPORT_CATEGORIES:
        category = "problem"

    acct = account_repo.load(tenant_id, user_id)
    to = (acct.email if acct else "").strip()
    name = (acct.display_name if acct else "") or ""
    now = datetime.now(timezone.utc).isoformat()
    reference = support_repo.next_reference()
    days = _support_reply_days(category)

    record = SupportRequest(
        reference=reference, tenant_id=tenant_id, user_id=user_id, category=category,
        category_label=mail_templates.support_category_label(category),
        message=text, created_at=now, email=to, name=name,
        context={k: str(v) for k, v in (req.context or {}).items() if v},
    )
    support_repo.save(record)      # stored BEFORE the mail — see the note above

    emailed = False
    if to:
        body = mail_templates.support_acknowledgement(
            name=name, reference=reference, category=category, message=text,
            reply_days=days, received_on=now[:10], context=record.context)
        result = notifier.send(EmailMessage(
            to=to, subject=body["subject"], text=body["text"],
            html=body.get("html", ""), reply_to=config.SUPPORT_ADDRESS,
            inline=mail_templates.inline_images()))
        emailed = str(result.get("status", "")) in ("sent", "written")
        if emailed:
            record.acknowledged = True
            support_repo.save(record)

    # The support inbox's copy — plain text, and it leads with how to reach her, because
    # the single most common next action on reading it is replying. Sent even when she
    # has no address on file: a case with no way back is exactly the one worth seeing.
    if config.SUPPORT_ADDRESS:
        ctx = "\n".join(f"{k}: {v}" for k, v in sorted(record.context.items()))
        notifier.send(EmailMessage(
            to=config.SUPPORT_ADDRESS,
            subject=f"[{reference}] {mail_templates.support_category_label(category)}"
                    f" — {name or user_id}",
            text=(f"Reply to: {to or '(no email on the account)'}\n"
                  f"Name:     {name or '—'}\n"
                  f"Sign in:  {user_id}\n"
                  f"Category: {mail_templates.support_category_label(category)}\n"
                  f"Promised: within {mail_templates.reply_window_words(days)}\n"
                  + (f"\n{ctx}\n" if ctx else "")
                  + f"\n----\n{text}\n"),
            reply_to=(to or config.SUPPORT_ADDRESS)))

    return {"reference": reference, "emailed": emailed, "email": to,
            "reply_days": days,
            "reply_window": mail_templates.reply_window_words(days),
            # The address itself, so a teacher with no email on her account (every
            # TRIAL teacher — the trial asks for a mobile and nothing else) has
            # somewhere to write from her own mail app rather than a dead end.
            "address": config.SUPPORT_ADDRESS}


@app.get("/support")
def list_support_requests(identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Her own support history, newest first — so "did I already write about this?" is
    answerable inside the app rather than by searching her sent mail.

    Also serves the SCREEN's own furniture: the category list and the reply windows. The
    screen states a promise and the acknowledgement repeats it, so both read them from
    here — a teacher told "2 working days" on screen and "3" by email has been told
    nothing at all. Her email is included because the screen must say WHERE the
    acknowledgement will land, and offer to add an address when there is none."""
    tenant_id, user_id = identity
    acct = account_repo.load(tenant_id, user_id)
    return {"categories": [{"key": k, "label": v}
                           for k, v in mail_templates.SUPPORT_CATEGORIES.items()],
            "reply_days": config.SUPPORT_REPLY_DAYS,
            "billing_reply_days": config.SUPPORT_BILLING_REPLY_DAYS,
            "email": (acct.email if acct else "") or "",
            "address": config.SUPPORT_ADDRESS,
            # WhatsApp is offered on this screen ONLY to a teacher who opted in.
            "whatsapp": bool(acct and (acct.notify or {}).get("whatsapp")),
            "whatsapp_number": config.WHATSAPP_NUMBER,
            # Her sign-in mobile, so the tap-to-chat note can say who is writing.
            "mobile": (acct.phone if acct and acct.phone else user_id),
            "requests": [
        {"reference": r.reference, "category": r.category,
         "label": r.category_label or mail_templates.support_category_label(r.category),
         "message": r.message, "created_at": r.created_at,
         "acknowledged": r.acknowledged, "status": r.status}
        for r in support_repo.load_all(tenant_id, user_id)]}


@app.get("/onboarding/known")
def onboarding_known(id: str = "") -> Dict[str, Any]:
    """Does this mobile/ID already sit in the tenant database? An existence check that
    deliberately does NOT go through _current_identity — that dependency JIT-creates,
    and the whole point here is to answer without creating. The SIGN-IN screen gates
    on this (founder, 2026-08-25): sign-in admits REGISTERED identities only; unknown
    numbers are sent to Create sign in (OTP), which is what registers them."""
    uid = (id or "").strip()
    if not uid:
        return {"known": False}
    # Email sign-in (founder, 2026-08-26): resolve the email to its account and hand
    # the CANONICAL id (the mobile) back — the session always runs under the mobile.
    # A SHARED address identifies nobody, so say so and send her to her mobile rather
    # than guessing (find_by_email returns None on ambiguity, by design).
    if "@" in uid:
        matches = account_repo.find_all_by_email(uid)
        if len(matches) == 1:
            return {"known": True, "id": matches[0].account_id}
        if len(matches) > 1:
            return {"known": False, "reason": "ambiguous_email"}
        return {"known": False}
    acct = account_repo.load(uid, uid)
    if acct is None:
        return {"known": False, "id": uid}
    # WALK-A-021 (2026-09-20): `fresh` = the number verified once but never became a teacher —
    # no agreement signed, no profile, no subscription, no trial chapter used. Verifying used to
    # be enough to lock "Create sign in" against her, so a teacher who backed out of the
    # subscribe wizard could only reach the TRIAL door. A fresh account may come in by Create
    # sign in again (the client routes her on as new).
    return {"known": True, "id": uid, "fresh": _never_activated(acct)}


def _never_activated(acct) -> bool:
    try:
        if acct.consent:
            return False
        prof = readiness_repo.load_profile(acct.tenant_id, acct.account_id)
        if prof and (prof.get("subjects") or []):
            return False
        ent = entitlement_repo.load(acct.tenant_id)
        if ent is not None and (ent.status != "trial"
                                or [c for c in (ent.trial_chapters or []) if not str(c).startswith("_earlier/")]):
            return False
        return True
    except Exception:   # noqa: BLE001 — when unsure, she is NOT fresh (the old, safe answer)
        return False


@app.post("/onboarding/verified")
def onboarding_verified(identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Called the moment an OTP verifies (trial path; the subscribe path registers via
    checkout): the number joins the tenant database — _current_identity's JIT creation
    IS the registration. In production the real OTP/app auth replaces the 0000 stub;
    this contract stays."""
    tenant_id, user_id = identity
    # The notice was linked on the screen she just typed her number into — the moment
    # of first collection, which is when DPDP §5 wants it given. Recorded here, on the
    # server, so the record names the version that was CURRENT at that moment rather
    # than whatever a client thought it was. Never blocks registration.
    _stamp_privacy_seen(tenant_id, user_id, "trial_signin")
    # ★ How much free trial this number has left (2026-09-18) — 0 when it was used up before an
    #   erasure. The front door reads it to say so plainly and offer Subscribe, instead of
    #   letting her walk into first run and meet a paywall on her very first lesson.
    ent = _entitlement_of(tenant_id)
    remaining = (max(0, config.TRIAL_CHAPTER_CAP - len(ent.trial_chapters or []))
                 if ent.status == "trial" else None)
    return {"status": "registered", "tenant_id": tenant_id, "user_id": user_id,
            "trial_remaining": remaining, "set_up": _has_set_up(tenant_id, user_id, ent)}


def _has_set_up(tenant_id: str, user_id: str, ent) -> bool:
    """WALK-A-086 (founder, 2026-09-24): has this account ever become a working teacher — a
    teaching profile, a prepared lesson, or a subscription that is not the trial? The front door
    reads it beside `trial_remaining`: a RETURNING sign-in with no free chapters left and nothing
    set up (an erased-and-rejoined number, or one that backed out of the subscribe wizard before
    Pay after its trial was spent) goes straight to Subscribe with the reason, instead of walking
    the whole first run to meet the paywall at its last step. Unlike `_never_activated`, a signed
    agreement does NOT count: signing it is a step of the wizard she abandoned.
    When unsure → True, i.e. the old behaviour (into the app)."""
    try:
        if ent is not None and ent.status not in ("trial", None, ""):
            return True
        prof = readiness_repo.load_profile(tenant_id, user_id)
        if prof and (prof.get("subjects") or []):
            return True
        year = _resolve_year(tenant_id, user_id)
        if prepared_plans_repo.load_all(tenant_id, user_id, year):
            return True
        return False
    except Exception:   # noqa: BLE001
        return True


_STAGE_GRADES = {"preparatory": ["iii", "iv", "v"], "middle": ["vi", "vii", "viii"],
                 "secondary": ["ix", "x"]}


ESTIMATE_WEEKS = 30          # mirrors web/app/lib/format.js — see ppw_from_annual below


def ppw_from_annual(annual: Optional[int]) -> Optional[int]:
    """Periods a week implied by a CALIBRATED annual total, over a 30-week year.

    ★ Mirrors `ppwFromAnnual` in web/app/lib/format.js, and 30 mirrors its ESTIMATE_WEEKS.
    Duplicated across the language boundary rather than shared, because there is no seam
    between them — if one moves, move the other.

    ⚠️ Derive ONLY from a calibrated figure (data.master_annual_budget). Deriving from a
    STORED budget record is circular: with no master-plan row that record is itself
    ppw × 30, so round(ppw × 30 / 30) = ppw — a fixed point that silently justifies
    whatever it already held.
    """
    if not annual or annual <= 0:
        return None
    return max(1, round(annual / ESTIMATE_WEEKS))


def _default_grade_record(subject_slug: str, grade_slug: str) -> Dict[str, Any]:
    """One canonical grade record with the calibrated defaults — mirrors what first
    run's activation seeds (section A, standard duration, calibrated periods/week).

    ★ PERIODS/WEEK IS DERIVED, NOT A FLAT 6 (founder, 2026-08-27, reported live on
    account 1000000001). This function set 6 while `_apply_subscription_profile` below
    set the budget from the master plan — so buying social_sciences·secondary produced a
    profile reading "245 periods for the year, at 6 a week", i.e. 41 teaching weeks, and
    the budget screen's sense-check then told her so. Same contradiction the client-side
    seeds were fixed for the same day; this was the third seeding path and the one a
    SUBSCRIBER actually takes. Falls back to 6 only where the master plan has no row.
    """
    dur = data.standard_duration_minutes(grade_slug, subject_slug)
    n = {"iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10}.get(
        grade_slug, 0)
    ppw = ppw_from_annual(data.master_annual_budget(subject_slug, grade_slug)) or 6
    return {"grade": grade_slug.upper(),
            "sections": [{"tag": f"{n}A", "sec": "A"}],
            "durations": [dur],
            "ppw_by_duration": {str(dur): ppw},
            "ppw_anchor": dur,
            "periods_per_week": ppw}


def _apply_subscription_profile(tenant_id: str, user_id: str,
                                scopes: List[str],
                                buying: Optional[List[str]] = None) -> None:
    """★ SUBSCRIPTION CREATES THE DEFAULT PROFILE (founder, 2026-08-25). Every
    purchased scope lands as a profile entry immediately — the founder bought SS +
    English and found only SS in My Lessons' dropdown, because first run creates one
    subject and the rest waited on the "+". Rules:
      · per scope: the stage's LOWEST class offered by the content, section A,
        standard duration, 6 periods/week, the calibrated annual budget;
      · a subject she ALREADY has (trialed her real subject, then paid for it) keeps
        its existing record — her sections and numbers are never reset — but only the
        grades inside purchased stages survive; the purchased stage's default grade is
        added when missing;
      · subjects OUTSIDE every purchased scope are DROPPED (trial test artifacts —
        founder: the subscription overrides the trial profile), and their section
        pointers are cleared server-side. ★ NO EXCEPTION: a morning rule that kept a
        subject she had prepared plans in was reversed the same evening (2026-08-26)
        — see the block below and _purge_trial_artifacts.
    The tour-end "Are these your sections?" prompt is the designed amend moment, so
    defaults are safe. Full-replace save through the same repo the API uses.

    ★ ONLY THIS PURCHASE SEEDS A CLASS (2026-09-17). `scopes` is the FULL held list — it has
    to be, or a second checkout would drop the subjects she bought first — but seeding off it
    meant buying subject C could quietly put a default class back into A and B. `buying` is
    THIS cart; absent, it falls back to `scopes`, which is the old behaviour.

    ★ AND A SUBJECT SHE EMPTIED ON PURPOSE STAYS EMPTY (founder, same day). Since a paid
    subject now survives losing its last class (@aruvi/shared/profile `subjectSurvivesEmpty`),
    `{name, grades: []}` is a real state a teacher can put her profile in — and this function
    would have read it as "no class in the purchased stage" and handed her back a Class 6
    Section A on her next checkout, on a path where nobody is looking at the profile. An
    emptied subject is KEPT (it is hers) and left alone."""
    slugify = lambda name: (name or "").lower().replace(" ", "_")
    buying_set = {s.strip() for s in (scopes if buying is None else buying) if s and s.strip()}
    by_subj: Dict[str, List[str]] = {}
    for sc in scopes:
        subj, stage = (sc.split("/") + [""])[:2]
        by_subj.setdefault(subj, []).append(stage)

    existing = (readiness_repo.load_profile(tenant_id, user_id) or {}).get("subjects", [])
    existing_by_slug = {slugify(s.get("name", "")): s for s in existing}
    year = _resolve_year(tenant_id, user_id)

    new_subjects: List[Dict[str, Any]] = []
    for subj, stages in by_subj.items():
        offered = data.list_grades(subj)                     # content's grade slugs
        allowed = [g for st in stages for g in _STAGE_GRADES.get(st, []) if g in offered]
        prior = existing_by_slug.get(subj)
        # She has a record for this subject and has taken every class out of it: her own act,
        # and the profile's way of saying "I own this, I am not teaching it this term".
        emptied = prior is not None and not (prior.get("grades") or [])
        grades: List[Dict[str, Any]] = []
        if prior:
            grades = [g for g in (prior.get("grades") or [])
                      if (g.get("grade") or "").lower() in allowed]
        if not emptied:
            for st in stages:
                if f"{subj}/{st}" not in buying_set:
                    continue          # a scope she already held is not a reason to seed
                stage_grades = [g for g in _STAGE_GRADES.get(st, []) if g in offered]
                if stage_grades and not any((g.get("grade") or "").lower() in stage_grades
                                            for g in grades):
                    grades.append(_default_grade_record(subj, stage_grades[0]))
        # No classes AND no prior record means there is nothing to carry and nothing was
        # bought into it — skip. An emptied record she owns is kept, classes and all zero of
        # them, because dropping it here is the very loss this whole change is about.
        if not grades and prior is None:
            continue
        budget: Dict[str, Any] = {}
        for gi, g in enumerate(grades):
            gslug = (g.get("grade") or "").lower()
            val = (data.master_annual_budget(subj, gslug)
                   or (g.get("periods_per_week") or 6) * 30)
            # keep a prior budget where the grade survived from the old record
            prior_b = None
            if prior:
                for pj, pg in enumerate(prior.get("grades") or []):
                    if pg.get("grade") == g.get("grade"):
                        prior_b = (prior.get("budget") or {}).get(str(pj))
                        break
            budget[str(gi)] = prior_b or {"method": "periods", "value": int(val)}
        new_subjects.append({
            "name": pretty_subject(subj),
            "grades": grades,
            "grids": [[[-1] * 6 for _s in (g.get("sections") or [])] for g in grades],
            "budget": budget,
        })

    # ★★ REVERSED THE SAME DAY (founder, 2026-08-26 evening). The morning's rule KEPT an
    # out-of-scope subject she had prepared plans in, so those plans stayed reachable.
    # Live, that read as clutter, not generosity: *"the {x,y} stands there in My Lessons
    # with no use, clogging the space for a trial reason that is no longer valid."* A
    # subject she trialled and then did not subscribe to is finished — she cannot prepare
    # in it, cannot track it, and every card of it is a door that no longer opens. So
    # NOTHING out of scope survives the first purchase, and _purge_trial_artifacts
    # removes the records those subjects left behind.

    # Clear section pointers of everything dropped (the plans themselves stay).
    kept_keys = set()
    for s in new_subjects:
        sslug = slugify(s["name"])
        for g in s["grades"]:
            for sec in g.get("sections") or []:
                kept_keys.add(f"{sslug}_{(g.get('grade') or '').lower()}_{sec.get('tag')}")
    for s in existing:
        sslug = slugify(s.get("name", ""))
        for g in s.get("grades") or []:
            for sec in g.get("sections") or []:
                key = f"{sslug}_{(g.get('grade') or '').lower()}_{sec.get('tag')}"
                if key not in kept_keys:
                    try:
                        section_state_repo.delete_one(tenant_id, user_id, year, key)
                        # The section itself is gone from the profile, so its teaching
                        # ledger goes too — otherwise re-adding the same tag later inherits
                        # a phantom trail. (Untrack never does this; see the port's note.)
                        section_history_repo.delete_section(tenant_id, user_id, year, key)
                    except Exception:
                        pass

    if new_subjects:
        readiness_repo.save_profile(tenant_id, user_id, {"subjects": new_subjects})


def pretty_subject(slug: str) -> str:
    return " ".join(w.capitalize() for w in (slug or "").split("_"))


def _financial_year(d: date) -> str:
    """Indian FY, April→March: 26 Aug 2026 → "2026-27", 3 Feb 2027 → "2026-27". The same
    April anchor the academic year already uses, so a teacher's invoice series and her
    school year turn over together."""
    y = d.year if d.month >= 4 else d.year - 1
    return f"{y}-{str(y + 1)[-2:]}"


_CLASS_NO = {"iii": "3", "iv": "4", "v": "5", "vi": "6",
             "vii": "7", "viii": "8", "ix": "9", "x": "10"}


def _scope_classes(scope: str) -> str:
    """★ THE CLASSES THIS SCOPE ACTUALLY COVERS, PER SUBJECT (founder, 2026-08-26).

    An invoice may not say "Class 9 (Class 10 coming soon)". A promise about next year
    has no business on a document of record, and — the founder's real point — **the
    answer is per SUBJECT, not per stage**: the day Class 10 lands, it will land for one
    subject before another, and a stage-wide constant would then be wrong for both (too
    small for the one that has it, a promise for the one that does not).

    So it is derived from the content that EXISTS: the stage's grades intersected with
    the grades this subject is actually authored for. Science secondary is `ix` alone
    today and becomes "Classes 9 and 10" by itself, on the day its Class 10 chapters are
    added — no constant to remember to edit, and no invoice that was ever untrue.
    """
    subject, _, stage = str(scope or "").partition("/")
    if not subject or scope == "*":
        return ""
    try:
        offered = set(data.list_grades(subject))
    except Exception:                                  # noqa: BLE001
        return ""
    nums = [_CLASS_NO[g] for g in _STAGE_GRADES.get(stage, [])
            if g in offered and g in _CLASS_NO]
    if not nums:
        return ""
    if len(nums) == 1:
        return f"Class {nums[0]}"
    return "Classes " + ", ".join(nums[:-1]) + " and " + nums[-1]


def _build_invoice(tenant_id: str, user_id: str, acct: Any, scopes: List[str],
                   scope_valid_until: Dict[str, str]) -> Optional[Invoice]:
    """The invoice for ONE purchase — the scopes in THIS cart, never the whole holding.

    An invoice records a transaction, so it lists what was paid for on the day, at the
    price of the day, with each line's own validity. What she now HOLDS is a different
    question, answered by the mail's second block and by the Settings page.

    Tax: none while config.GSTIN is unset (founder, 2026-08-26) — the note says so in
    words. When a GSTIN and rate exist, TAX_INCLUSIVE decides whether the price already
    contained the tax (split it out, total unchanged) or the tax is added on top.
    Money is whole rupees throughout; the inclusive split rounds the tax DOWN so
    subtotal + tax == total exactly, and never invents a paisa.
    """
    lines: List[InvoiceLine] = []
    today = _today().isoformat()
    for s in scopes:
        # Label from the shared vocabulary; CLASSES from the content that exists, per
        # subject (see _scope_classes) — never the stage-wide "(Class 10 coming soon)".
        classes = _scope_classes(s)
        label = mail_templates.scope_label(s)
        lines.append(InvoiceLine(
            scope=s, description=f"{label} — {classes}" if classes else label,
            quantity=1, unit_amount=config.PRICE_PER_SUBJECT_STAGE,
            valid_from=today, valid_until=(scope_valid_until or {}).get(s, "")))
    if not lines:
        return None
    charged = sum(ln.unit_amount * ln.quantity for ln in lines)

    if config.GSTIN and config.TAX_RATE > 0:
        rate = config.TAX_RATE / 100.0
        if config.TAX_INCLUSIVE:
            total = charged
            subtotal = int(round(total / (1 + rate)))
            tax = total - subtotal
        else:
            subtotal = charged
            tax = int(round(subtotal * rate))
            total = subtotal + tax
        note = (f"Includes {config.TAX_LABEL} at {config.TAX_RATE:g}%."
                if config.TAX_INCLUSIVE else
                f"{config.TAX_LABEL} at {config.TAX_RATE:g}% has been added.")
    else:
        subtotal = total = charged
        tax = 0
        note = f"No tax charged — {config.SELLER_NAME} is not registered for GST."

    place = ", ".join(p for p in [getattr(acct, "city", ""), getattr(acct, "state", "")] if p)
    number = invoice_repo.next_number(_financial_year(_today()))
    return Invoice(
        number=number, issued_at=datetime.now(timezone.utc).isoformat(),
        tenant_id=tenant_id, user_id=user_id,
        bill_to_name=getattr(acct, "display_name", "") or "",
        bill_to_email=getattr(acct, "email", "") or "",
        bill_to_phone=getattr(acct, "phone", "") or user_id,
        bill_to_school=getattr(acct, "school_name", "") or "",
        bill_to_place=place,
        lines=lines, subtotal=subtotal, tax_amount=tax, tax_note=note,
        total=total, amount_paid=total,
        payment_method="Recorded manually (online payment not yet open)",
        seller_gstin=config.GSTIN,
        seller_name=config.SELLER_NAME,
    )


def _purge_trial_artifacts(tenant_id: str, user_id: str, scopes: List[str]) -> Dict[str, int]:
    """★ THE TRIAL PURGE (founder, 2026-08-26 evening).

    A teacher trials subjects {x, y}, spends her three chapters, then subscribes to
    something else. Her x and y lessons stay in My Lessons for ever after — and every
    one of them is a door that no longer opens: she cannot prepare in that subject,
    cannot track it, cannot add sections to it. The founder's words: *"the {x,y} stands
    there in My Lessons with no use, clogging the space for a trial reason that is no
    longer valid."* So on her FIRST purchase, everything the trial left behind in a
    subject she did NOT buy is removed: prepared-plan records, section state, chapter
    notes.

    Three boundaries:
      · Only on the FIRST purchase (the prior entitlement was a trial). A later addition
        never touches anything — by then there are no trial artifacts left.
      · Only subjects OUTSIDE the purchase. A subject she trialled and then bought keeps
        every chapter, every pointer and every note: that is the whole reason a trial
        exists.
      · The saved PLAN FILES are never touched. They are shared library content in
        DATA_DIR, not her property to delete — the same file may be served to another
        teacher a minute later. What is hers, and what goes, are the RECORDS in
        STATE_DIR that put those plans on her screen.

    Never raises: a purge that fails must not fail an activation she has paid for.
    """
    bought = {str(s).split("/")[0].lower() for s in (scopes or []) if s}
    counts = {"plans": 0, "sections": 0, "notes": 0}
    try:
        year = _resolve_year(tenant_id, user_id)
    except Exception:
        return counts
    subj_of = lambda key: str(key).split("/")[0].lower()

    try:
        for key in list((prepared_plans_repo.load_all(tenant_id, user_id, year) or {})):
            if "/" in str(key) and subj_of(key) not in bought:
                prepared_plans_repo.unmark(tenant_id, user_id, year, key)
                counts["plans"] += 1
    except Exception:
        pass
    # Section keys are "{subject}_{grade}_{tag}", not "/"-separated — the profile drop
    # above clears most of them, but a section whose subject never made it into the
    # readiness profile (bound during first run, then edited away) would survive it.
    try:
        for key in list((section_state_repo.load_all(tenant_id, user_id, year) or {})):
            if str(key).split("_")[0].lower() not in bought:
                section_state_repo.delete_one(tenant_id, user_id, year, key)
                section_history_repo.delete_section(tenant_id, user_id, year, key)
                counts["sections"] += 1
    except Exception:
        pass
    # …and again over the LEDGER's own keys: a section she taught and then untracked has a
    # trail but no pointer, so the sweep above would walk straight past it and leave an
    # out-of-scope subject's history behind. Not counted — `counts["sections"]` reports
    # live bindings cleared, and inflating it with ledger-only rows would misreport the act.
    try:
        for key in list((section_history_repo.load_all(tenant_id, user_id, year) or {})):
            if str(key).split("_")[0].lower() not in bought:
                section_history_repo.delete_section(tenant_id, user_id, year, key)
    except Exception:
        pass
    try:
        for key in list((plan_note_repo.load_all(tenant_id, user_id, year) or {})):
            if subj_of(key) not in bought:
                plan_note_repo.delete(tenant_id, user_id, year, key)
                counts["notes"] += 1
    except Exception:
        pass
    return counts


class CheckoutRequest(BaseModel):
    """Body for POST /onboarding/checkout — the subscribe path's final step."""
    scopes: List[str]          # ["social_sciences/middle", ...] — the cart
    name: str = ""
    email: str = ""            # double-confirmed client-side (founder, 2026-08-25)
    # The WhatsApp opt-in, asked on About-you (2026-09-26). None = not asked (an older
    # client, or the known-profile skip) — leaves the stored choice untouched.
    whatsapp: Optional[bool] = None
    role: str = ""
    state: str = ""
    city: str = ""
    school: str = ""


def _send_subscription_confirmation(to: str, name: str, scopes: List[str],
                                    amount_inr: int, valid_until: str,
                                    mobile: str,
                                    scope_valid_until: Dict[str, str] = None,
                                    added: List[str] = None,
                                    invoice: Optional[Invoice] = None,
                                    invoice_pdf: Optional[bytes] = None,
                                    whatsapp: bool = False,
                                    wa_welcome_status: str = "skipped"
                                    ) -> Dict[str, Any]:
    """Send the activation confirmation. NEVER raises and never blocks the answer the
    teacher is waiting for: a mail server having a bad minute must not turn a successful
    subscription into an error. Returns the notifier's result for the response body.

    A teacher who gave no email simply gets no mail — the app already shows her the
    subscription on screen. With MAIL_BCC_FOUNDER on, the founder gets his own copy,
    which is his sales log until invoicing exists."""
    # ★ NO EMAIL NO LONGER MEANS NO SALES LOG (2026-09-26). A WhatsApp customer may have
    # no email at all; returning early here used to skip the founder's copy too, and his
    # copy is the only place he learns there is a welcome to send on WhatsApp.
    has_to = bool((to or "").strip())
    body = mail_templates.subscription_confirmation(
        name=name, scopes=list(scopes or []), amount_inr=amount_inr,
        valid_until=valid_until, mobile=mobile,
        scope_valid_until=dict(scope_valid_until or {}),
        added=list(added) if added is not None else None,
        invoice_number=(invoice.number if invoice else ""),
        unit_amount=config.PRICE_PER_SUBJECT_STAGE,
        has_attachment=bool(invoice is not None and invoice_pdf))
    # The invoice rides along (2026-08-26). The BODY names the invoice number either
    # way, so a transport that drops attachments still delivers a complete message —
    # and she can always fetch the same file again from Settings.
    attachments = []
    if invoice is not None and invoice_pdf:
        attachments.append(Attachment(
            filename=f"Meyy-invoice-{invoice.number.replace('/', '-')}.pdf",
            content=invoice_pdf, mime_type="application/pdf"))
    result = {"status": "skipped", "reason": "no email on the account"}
    if has_to:
        result = notifier.send(EmailMessage(
            to=to.strip(), subject=body["subject"], text=body["text"],
            html=body.get("html", ""),
            reply_to=config.MAIL_REPLY_TO, attachments=list(attachments),
            inline=mail_templates.inline_images()))
    if config.MAIL_BCC_FOUNDER and config.MAIL_FROM \
            and config.MAIL_FROM.strip().lower() != (to or "").strip().lower():
        # The founder's copy is a SALES LOG, so it leads with who bought — and stays
        # plain text on purpose: a log is read as a list, not as a designed page.
        # The WhatsApp line is his to-do until the Business API sends the welcome itself.
        if not whatsapp:
            wa_line = "WhatsApp: no\n"
        elif wa_welcome_status == "sent":
            wa_line = f"WhatsApp: YES — welcome SENT via the API to +{_wa_e164(mobile)}\n"
        else:
            wa_line = (f"WhatsApp: YES — welcome NOT sent automatically ({wa_welcome_status}); "
                       f"send it by hand to +{_wa_e164(mobile)}\n")
        notifier.send(EmailMessage(
            to=config.MAIL_FROM,
            subject=(f"[Aruvi] New subscription — {name or mobile}"
                     + (" · WhatsApp" if whatsapp else "")),
            text=(f"To: {to or '(no email — WhatsApp only)' if whatsapp else to or '(no email)'}\n"
                  f"Mobile: {mobile}\n{wa_line}\n" + body["text"]),
            reply_to=config.MAIL_REPLY_TO, attachments=list(attachments)))
    return result


@app.post("/onboarding/checkout")
def onboarding_checkout(req: CheckoutRequest,
                        identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """★ DEV STUB — the preview's 'payment' (founder, 2026-08-24). No gateway exists,
    so this activates the subscription directly through the ManualBillingProvider (the
    founder IS the gateway) and saves the checkout's demographic fields onto the
    Account record. The real gateway adapter replaces the activation half wholesale
    (web → Razorpay/UPI; the iOS app routes this step to Apple IAP instead); the
    account-fields half stays. The UI never fakes a payment succeeded screen — it says
    plainly that the preview activates instantly."""
    tenant_id, user_id = identity
    scopes = [s.strip() for s in (req.scopes or []) if s.strip()]
    if not scopes:
        raise HTTPException(status_code=400, detail="Pick at least one subject & stage.")
    # ★ NO MONEY WITHOUT A SIGNATURE (founder, 2026-08-27). The wizard shows the
    #   agreement two steps before this one and cannot walk past it unticked, so this is
    #   the net — for a client that skipped the step, and for the case that matters more:
    #   a new document version published between her reading one and paying for it.
    #   Said in the words the screen would use, because a 409 body is what she reads.
    if _consent_outstanding(tenant_id):
        raise HTTPException(status_code=409, detail=(
            "Please read and accept the User Agreement before subscribing."))
    # ★ NOTHING SHE ALREADY HAS, LIVE, MAY BE BOUGHT AGAIN (founder, 2026-08-26). The
    #   chooser does not offer such a scope; this is the net, and it also states the
    #   remaining time, which is the only fact that makes the refusal make sense.
    prior = entitlement_repo.load(tenant_id)
    today = _today().isoformat()
    if prior is not None and prior.status != "trial":
        for s in scopes:
            if s in prior.scopes and _scope_live(prior, s, today):
                raise HTTPException(status_code=409, detail=(
                    f"You already have {_scope_words(s)} until "
                    f"{_date_words(_scope_until(prior, s))}. You can add it again when "
                    f"it ends."))
    acct = account_repo.load(tenant_id, user_id)
    if acct is not None:
        if req.name.strip():
            acct.display_name = req.name.strip()
        acct.phone = user_id                     # mobile IS the id on this path
        if req.email.strip():
            _guard_email_not_taken(req.email, acct.account_id)   # email is a credential
            acct.email = req.email.strip()
        acct.role = req.role.strip()
        acct.state = req.state.strip()
        acct.city = req.city.strip()
        acct.school_name = req.school.strip()
        if req.whatsapp is not None:
            _set_whatsapp(acct, req.whatsapp)
        account_repo.save(acct)
    # ADDITIVE (founder, 2026-08-26 — reported live: "I purchased science middle and
    # secondary, then added English middle, and the English addition overwrote the
    # previous subscriptions"). The provider now merges and stamps each NEW scope with
    # its own year from today; what she already holds keeps its own dates.
    result = billing_provider.create_subscription(
        tenant_id, "individual_annual", scopes=scopes, source="web")
    held = result.get("scopes") or scopes
    # Every purchased scope becomes a ready-made profile entry (founder, 2026-08-25);
    # out-of-scope trial artifacts are dropped. See _apply_subscription_profile. It is
    # given the FULL held list, not just this cart — passing the cart alone would drop
    # the subjects she bought last time, the profile-side twin of the overwrite bug.
    try:
        # `held` is everything she owns (so nothing bought earlier is dropped); `scopes` is
        # THIS cart, and only a scope in it may seed a default class.
        _apply_subscription_profile(tenant_id, user_id, held, buying=scopes)
    except Exception:
        pass   # a profile hiccup must never fail an activation
    # ★ FIRST purchase only: clear what the trial left in subjects she did not buy
    #   (founder, 2026-08-26 evening — see _purge_trial_artifacts). `prior` was read
    #   before the grant, so this is the last moment the trial is still visible.
    purged = {}
    if prior is None or prior.status == "trial":
        purged = _purge_trial_artifacts(tenant_id, user_id, held)
    amount = len(scopes) * config.PRICE_PER_SUBJECT_STAGE     # THIS purchase, not the whole holding

    # ── The invoice (2026-08-26) ──────────────────────────────────────────────
    # Issued for THIS purchase, stored under her account, attached to the mail and
    # listed on her subscription page. Wrapped whole: an invoice that fails to render
    # must not undo a subscription she has paid for — she still gets the mail, the app
    # still shows the subscription, and the founder can see the failure in the response.
    invoice = None
    invoice_pdf = None
    try:
        invoice = _build_invoice(tenant_id, user_id, acct, scopes,
                                 result.get("scope_valid_until") or {})
        if invoice is not None:
            from aruvi_core.export_invoice_pdf import export_invoice_pdf
            invoice_pdf = export_invoice_pdf(invoice)
            invoice_repo.save(tenant_id, user_id, invoice, invoice_pdf)
    except Exception:                                  # noqa: BLE001
        invoice, invoice_pdf = invoice, None           # keep the record if only the PDF failed
        try:
            if invoice is not None:
                invoice_repo.save(tenant_id, user_id, invoice, None)
        except Exception:                              # noqa: BLE001
            invoice = None

    # The WhatsApp welcome (2026-09-26) — before the mail, so the founder's sales log can
    # say whether it went or is still his to send by hand.
    wa_welcome = {"status": "skipped"}
    if acct is not None and (acct.notify or {}).get("whatsapp"):
        try:
            wa_welcome = _wa_welcome(acct, acct.phone or user_id)
            account_repo.save(acct)
        except Exception as e:                         # noqa: BLE001
            wa_welcome = {"status": "error", "error": str(e)}
    mail = _send_subscription_confirmation(
        to=(req.email or (acct.email if acct else "") or "").strip(),
        name=(req.name or (acct.display_name if acct else "") or "").strip(),
        scopes=held,
        amount_inr=amount, valid_until=result.get("valid_until") or "", mobile=user_id,
        scope_valid_until=result.get("scope_valid_until") or {},
        added=scopes,
        invoice=invoice, invoice_pdf=invoice_pdf,
        whatsapp=bool(acct and (acct.notify or {}).get("whatsapp")),
        wa_welcome_status=wa_welcome.get("status", "skipped"))
    wa_on = bool(acct and (acct.notify or {}).get("whatsapp"))
    return {"status": "active", "scopes": held,
            # The WhatsApp opt-in as STORED, so the done screen offers the hello only to a
            # teacher who actually has it on — not to one whose request merely said so.
            "whatsapp": wa_on,
            "whatsapp_number": config.WHATSAPP_NUMBER if wa_on else "",
            # "sent" only when Meta accepted it — the done screen then says "we've sent you
            # a welcome" instead of asking her to say hello first.
            "whatsapp_welcome": wa_welcome.get("status", "skipped"),
            "valid_until": result.get("valid_until"),
            "scope_valid_until": result.get("scope_valid_until") or {},
            "added": scopes,
            "purged": purged,
            "invoice_number": invoice.number if invoice else "",
            "amount_inr": amount,
            # What happened to the confirmation mail, so the UI can say so honestly
            # rather than promising an email that was never attempted.
            "email_status": mail.get("status", "skipped")}


@app.get("/invoices")
def list_invoices(identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Her invoices, newest first — for the Subscription page. Never gated on
    subscription state: a document recording money she paid must stay reachable after
    the thing it paid for has ended (the same reasoning as data rights, §2.5)."""
    tenant_id, user_id = identity
    out = []
    for inv in invoice_repo.load_all(tenant_id, user_id):
        out.append({
            "number": inv.number, "issued_at": inv.issued_at, "total": inv.total,
            "currency": inv.currency,
            "scopes": [ln.scope for ln in inv.lines],
            "lines": [{"scope": ln.scope, "description": ln.description,
                       "amount": ln.unit_amount * int(ln.quantity or 1),
                       "valid_until": ln.valid_until} for ln in inv.lines],
            # Whether the PDF is actually there — a record can survive a render failure,
            # and a download link that 404s is worse than no link.
            "has_pdf": invoice_repo.load_pdf(tenant_id, user_id, inv.number) is not None,
        })
    return {"invoices": out}


@app.get("/invoices/{number:path}")
def download_invoice(number: str, identity: tuple = Depends(_current_identity)):
    """The stored PDF — the exact bytes she was mailed, never a re-render (see the
    adapter's docstring). `:path` because the number contains slashes (MEY/2026-27/0001)
    and the adapter's own slugging is what maps it to a filename; a traversal cannot
    escape, since `_slug` strips every path character on the way in."""
    tenant_id, user_id = identity
    num = str(number or "").strip()
    if num.lower().endswith(".pdf"):
        num = num[:-4]
    pdf = invoice_repo.load_pdf(tenant_id, user_id, num)
    if pdf is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    fname = f"Meyy-invoice-{num.replace('/', '-')}.pdf"
    return Response(content=pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{fname}"'})


@app.post("/subjects/{subject}/{grade}/generate")
def generate(subject: str, grade: str) -> JSONResponse:
    """Stub — live generation is deferred. The frontend treats this as 'coming soon' and
    shows saved plans instead."""
    _subject(subject)
    return JSONResponse(
        status_code=501,
        content={"status": "deferred",
                 "detail": "Live generation is wired but intentionally deferred; "
                           "view a saved plan instead."},
    )


# ── genon: deterministic SERVE from the chapter's variant library (2026-07-31) ──
# A chapter is authored as a small LIBRARY of variant canonicals (the same section
# list planned at two or three period counts, each a complete plan + assessment, at
# the class-standard duration). A teacher's duration matrix is served in
# milliseconds — no LLM, Rs. 0 — by SELECTION: next-highest variant, first X-1
# units verbatim, slot X from the fill ladder (exact > superset > suffix >
# truncation), minutes scaled in proportion to each sitting's duration. The old
# partition engine (DP cuts, compression regimes, handoff text) is RETIRED —
# docs/variant_canonical_architecture.md records why.

class GenonRowInput(BaseModel):
    duration: int          # minutes per period
    count: int             # how many periods of this duration


class GenonPlanRequest(BaseModel):
    rows: List[GenonRowInput]


@app.get("/genon/{subject}/{grade}/chapters")
def genon_available(subject: str, grade: str) -> Dict[str, Any]:
    """Chapter numbers with a certified canonical for this subject·grade — the frontend
    uses this to decide when Prepare can run the deterministic path. canonical_minutes
    (per chapter) lets it warn when a duration mix dips under the 0.6 coverage floor."""
    _subject(subject)
    chs = data.genon_chapters(subject, grade)
    minutes: Dict[str, int] = {}
    periods: Dict[str, int] = {}
    for ch in chs:
        c = data.load_genon_canonical(subject, grade, ch) or {}
        row = (c.get("period_rows_snapshot") or [{}])[0]
        if row.get("duration") and row.get("count"):
            minutes[str(ch)] = int(row["duration"]) * int(row["count"])
            # canonical_periods (2026-08-01): surrender is COUNT-based — the frontend's
            # inline warning uses this true top count, never a minutes/avg approximation
            # (which misfires on mixed-duration profiles: 600min/52avg rounded to 11).
            periods[str(ch)] = int(row["count"])
    return {"subject": subject, "grade": grade, "chapters": chs,
            "canonical_minutes": minutes, "canonical_periods": periods}


def _genon_resolve(subject: str, grade: str, chapter_number: int, matrix, library):
    """WHICH FILE a Prepare press lands on, for this matrix (WALK-A-070, 2026-09-24).
    Extracted from genon_make_plan so the dry-run name endpoint and the real press share ONE
    implementation of the rule — the identity rule first, then serve-and-key-off-variant_used.
    A second copy of this rule is exactly the failure the e15 note below describes.
    Returns {"identity": True, "filename", "canonical"} or
            {"identity": False, "filename", "plan", "chosen"}.
    Serve errors propagate (GenonDeclarationError / ServeError) for the caller to map."""
    from aruvi_core.genon import serve_plan
    total_periods = sum(c for _, c in matrix)
    def _std_row(c) -> Dict[int, int]:
        row = (c.get("period_rows_snapshot") or [{}])[0]
        try:
            return {int(row.get("duration", -1)): int(row.get("count", -2))}
        except (TypeError, ValueError):
            return {}

    def _count(c) -> int:
        row = (c.get("period_rows_snapshot") or [{}])[0]
        try:
            return int(row.get("count") or 0)
        except (TypeError, ValueError):
            return 0

    # ── identity rule (founder, 2026-07-25; generalised to the library 2026-07-31):
    # a request whose matrix equals ANY variant's standard row IS that variant —
    # register THAT file as prepared, save no copy.
    agg: Dict[int, int] = {}
    for d_, c_ in matrix:
        agg[d_] = agg.get(d_, 0) + c_
    canonical = next((c for c in library if agg == _std_row(c)), None)
    if canonical is not None:
        return {"identity": True, "filename": canonical["filename"], "canonical": canonical}

    # ── the plan is a CACHE ENTRY, addressed by what determines its bytes ──────────
    # (chapter, normalised matrix, CHOSEN VARIANT's version, engine version). The
    # next-highest rule decides which variant keys the entry; a hit is served
    # without serving again. Per-teacher visibility still comes from the register.
    #
    # ── THE KEY IS DERIVED FROM THE SERVE, NOT FROM A COPY OF ITS RULE (2026-08-06, e15).
    # This used to recompute the next-highest canonical here — a second implementation of
    # a selection rule that lives in serve.py. Case 1b broke that copy: when the exact-fit
    # rescue fires, the plan is built from the canonical BELOW the request while this line
    # still named the one above, so the entry was stamped with the version of a file its
    # bytes do not come from. A later regeneration of the real base would then leave a
    # stale entry keyed to an untouched stranger — ARV-D-034's exact failure class.
    # Serving is selection and costs milliseconds (C11), so we serve FIRST and key the
    # entry off `genon.variant_used`, which is the base the plan was actually built from
    # after every rung of §0.4 has run. The cache still saves the WRITE, which is what it
    # was ever protecting; it no longer pretends to know the answer before asking.
    streams = data.load_genon_streams(subject, grade, chapter_number)
    plan = serve_plan(streams, matrix)

    base_count = (plan.get("genon") or {}).get("variant_used")
    chosen = next((c for c in library if _count(c) == base_count), None)
    if chosen is None:                       # never expected; fall back to the old rule
        chosen = next((c for c in reversed(library) if _count(c) >= total_periods),
                      library[0])
    filename = data.genon_plan_filename(chapter_number, matrix, chosen)
    return {"identity": False, "filename": filename, "plan": plan, "chosen": chosen}


@app.post("/genon/{subject}/{grade}/{chapter_number}/plan")
def genon_make_plan(subject: str, grade: str, chapter_number: int, req: GenonPlanRequest,
                    identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """Serve the chapter's variant library to the teacher's duration matrix, save the
    adapted plan, and register it as prepared for this teacher (it pops up in My Lessons)."""
    from aruvi_core.genon import GenonDeclarationError, ServeError, serve_plan

    _subject(subject)
    tenant_id, user_id = identity
    year = _resolve_year(tenant_id, user_id)
    matrix = [(r.duration, r.count) for r in req.rows if r.duration > 0 and r.count > 0]
    if not matrix:
        raise HTTPException(status_code=400, detail="At least one duration row is required.")
    total_periods = sum(c for _, c in matrix)
    # THE TYPO GUARD, not a teaching rule (founder 2026-08-10, lowered 60 -> 30). It exists so a
    # slipped keystroke cannot be cached as a legitimate request; it is deliberately NOT
    # chapter-aware, because it runs BEFORE the library is loaded. The per-chapter ceiling is a
    # different and softer thing: above the top canonical's count the engine serves the top and
    # returns the surplus with a note ("N period(s) … return to your budget"), which is a real
    # answer rather than a refusal. Sizing: the largest single-chapter recommendation in the
    # whole corpus is 25 periods (mathematics VI, "Prime Time") and a whole YEAR of mathematics
    # IX is 210, so 30 sits just above the largest real chapter — 60 was ~2.4x it and let
    # nonsense through. The message names the number: at 60 it did not, so a teacher could not
    # tell whether the line was 60, 20 or 16.
    # Kept SHORT on purpose (founder, 2026-08-10): this line lands on a phone, beside a
    # Dismiss, on a card that must stay the height of its neighbours — the longer wording
    # tried first did not fit. The number is the one thing worth saying, so it is said and
    # nothing else.
    PERIOD_CAP = 30
    if total_periods > PERIOD_CAP:
        raise HTTPException(status_code=400,
                            detail=f"More than {PERIOD_CAP} periods is too many for one chapter.")

    library = data.load_genon_library(subject, grade, chapter_number)
    if not library:
        # "Canonical" is our word, not hers (founder, 2026-08-04). A teacher who asks for a
        # chapter we have not authored yet should be told about the CHAPTER, in her language;
        # engine vocabulary in a teacher-facing string is a defect even when the string is
        # otherwise correct. This is the only such message on the genon path — the rest of the
        # 4xx wording is already plain ("Period count implausibly large.").
        raise HTTPException(status_code=404,
                            detail="No underlying chapter yet.")

    # ── THE entitlement gate (Step 5) — the only one in the product. After the 404 so
    # an unauthored chapter never triggers a paywall message; before any serving work.
    _check_entitlement(tenant_id, subject, grade, chapter_number)

    try:
        target = _genon_resolve(subject, grade, chapter_number, matrix, library)
    except GenonDeclarationError as e:
        # a library canonical is not declared: name the content problem instead of
        # letting it escape as a bare 500 with nothing for anyone to read
        raise HTTPException(status_code=500, detail=f"Canonical cannot be compiled: {e}")
    except ServeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if target["identity"]:
        canonical = target["canonical"]
        filename = target["filename"]
        try:
            prepared_plans_repo.mark(tenant_id, user_id, year,
                                     _plan_key(subject, grade, filename), total_periods)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not register the plan: {e}")
        _count_trial_chapter(tenant_id, subject, grade, chapter_number)
        return {
            "status": "prepared", "identity": True,
            "filename": filename,
            "chapter_number": chapter_number,
            "chapter_title": canonical.get("chapter_title"),
            "periods": total_periods,
            "compression": {"ratio": 1.0, "regime": "canonical"},
            "seam_periods": [], "coverage_note": None,
        }

    plan, chosen, filename = target["plan"], target["chosen"], target["filename"]

    # ── the edition stamp travels with the plan (§2.2, 2026-08-27) ────────────────
    # Read off `chosen` — the canonical this plan's bytes actually came from, after
    # every rung of §0.4 has run — and NOT off config.LP_YEAR. Those differ exactly
    # when they matter: a plan served from a carried-over edition must say which
    # edition wrote it, not which edition happens to be current. Deliberately NOT in
    # the filename: the year is a label, `(engine, constitution-run)` is the key, and
    # keying on the year is what would make every June re-buy the library.
    lp_year = data.plan_lp_year(chosen)
    if lp_year:
        plan.setdefault("genon", {})["academic_year"] = lp_year

    def _serve_summary(g: Dict[str, Any]) -> Dict[str, Any]:
        """The response's serve facts. `compression`/`seam_periods` keys survive
        for the frontend's sake: regime now names the serve outcome, and there
        are no seams any more — a sitting is one whole unit."""
        fill = g.get("slot_fill") or {}
        regime = ("surrender" if g.get("surrendered_periods")
                  else "full" if not fill else fill.get("mode"))
        return {
            "compression": {"ratio": round(total_periods / (g.get("variant_used") or
                                                            total_periods), 3),
                            "regime": regime},
            "seam_periods": [],
            "serve": {"variant_used": g.get("variant_used"),
                      "library": g.get("library"),
                      "slot_fill": g.get("slot_fill"),
                      "surrendered_periods": g.get("surrendered_periods"),
                      "surrender_note": g.get("surrender_note")},
        }

    # Has THIS teacher held this exact plan before? Read the register BEFORE marking, because
    # marking is what makes the answer false. The client uses it to decide whether to show the
    # preparing state: `cached` is about the SERVER's work and is the wrong question — a plan
    # another teacher warmed is still new to her, and her own second look at it is not.
    # (founder, 2026-08-04)
    plan_key = _plan_key(subject, grade, filename)
    already_yours = plan_key in prepared_plans_repo.load_all(tenant_id, user_id, year)

    hit = data.load_saved_plan(subject, grade, filename)
    if hit is not None:
        try:
            prepared_plans_repo.mark(tenant_id, user_id, year,
                                     _plan_key(subject, grade, filename), total_periods)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not register the plan: {e}")
        _count_trial_chapter(tenant_id, subject, grade, chapter_number)
        hg = hit.get("genon") or {}
        return {
            "status": "prepared", "cached": True,
            "already_yours": already_yours,
            "filename": filename,
            "chapter_number": chapter_number,
            "chapter_title": hit.get("chapter_title"),
            "periods": total_periods,
            **_serve_summary(hg),
            "coverage_note": (hit.get("result") or {}).get("section_coverage_note"),
        }

    data.save_generated_plan(subject, grade, plan, filename=filename)
    key = _plan_key(subject, grade, filename)
    prepared_periods = total_periods
    try:
        prepared_plans_repo.mark(tenant_id, user_id, year, key, prepared_periods)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plan saved but not registered: {e}")
    _count_trial_chapter(tenant_id, subject, grade, chapter_number)

    g = plan["genon"]
    return {
        "status": "prepared", "cached": False,
        "already_yours": already_yours,
        "filename": filename,
        "chapter_number": chapter_number,
        "chapter_title": plan.get("chapter_title"),
        "periods": total_periods,
        **_serve_summary(g),
        "coverage_note": plan["result"].get("section_coverage_note"),
    }


@app.post("/genon/{subject}/{grade}/{chapter_number}/plan-name")
def genon_plan_name(subject: str, grade: str, chapter_number: int, req: GenonPlanRequest,
                    identity: tuple = Depends(_current_identity)) -> Dict[str, Any]:
    """DRY RUN of a Prepare press (WALK-A-070, founder 2026-09-24): the filename it WOULD
    land on, and nothing else — no save, no register, no trial count, no entitlement gate
    (it hands out a name, not a lesson). Prepare greys "Prepare again" when this name is
    already one of her live plans, because pressing would give her back the same file.
    Same resolver as the real press, so the answer cannot drift from what a press does."""
    from aruvi_core.genon import GenonDeclarationError, ServeError
    _subject(subject)
    matrix = [(r.duration, r.count) for r in req.rows if r.duration > 0 and r.count > 0]
    if not matrix or sum(c for _, c in matrix) > 30:
        return {"filename": None}
    library = data.load_genon_library(subject, grade, chapter_number)
    if not library:
        return {"filename": None}
    try:
        target = _genon_resolve(subject, grade, chapter_number, matrix, library)
    except (GenonDeclarationError, ServeError):
        return {"filename": None}
    return {"filename": target["filename"]}


def _safe_name(s: str) -> str:
    """Filename-safe slug for the Content-Disposition header."""
    return "".join(c if c.isalnum() or c in "-_" else "-" for c in str(s)).strip("-").lower()


def _build_report(req: "AllocationReportRequest"):
    """Assemble the full per-chapter competency report from the request + server data.

    The request carries only the allocation (periods per chapter); competencies and
    their descriptions/justifications are loaded here from the mappings and the
    framework glossary so the frontend never has to ship them.
    """
    from datetime import datetime
    _subject(req.subject)  # 404 on unknown subject
    try:
        stage = stage_for(req.grade)
    except UnknownGradeError:
        raise HTTPException(status_code=422, detail=f"Unknown grade: {req.grade}")

    mappings = data.load_mappings(req.subject, req.grade)
    mappings_by_chapter = {int(m.get("chapter_number")): m for m in mappings
                           if m.get("chapter_number") is not None}
    descriptions = data.load_competency_descriptions(req.subject, req.grade)

    generated_at = datetime.now()
    if req.generated_at:
        try:
            generated_at = datetime.fromisoformat(req.generated_at)
        except ValueError:
            pass

    return build_competency_report(
        subject=req.subject,
        grade=req.grade,
        stage=stage,
        period_types=req.period_types,
        chapters_alloc=req.chapters,
        mappings_by_chapter=mappings_by_chapter,
        descriptions=descriptions,
        generated_at=generated_at,
        notes=req.notes,
    )


@app.post("/api/allocation/export-pdf")
def export_allocation_pdf(req: AllocationReportRequest) -> StreamingResponse:
    """Export the allocation report as a PDF binary."""
    try:
        from aruvi_core.export_allocation_pdf import export_allocation_report_pdf
        pdf_bytes = export_allocation_report_pdf(_build_report(req))
        fname = f"allocation-report-grade-{req.grade}-{_safe_name(req.subject)}.pdf"
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )
    except HTTPException:
        raise  # let 404/422 from _build_report pass through unchanged
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print("\n[export-pdf] FAILED:\n" + tb, flush=True)  # full traceback to server console
        last = tb.strip().splitlines()
        where = next((l.strip() for l in reversed(last) if "aruvi" in l or "api/" in l), "")
        raise HTTPException(status_code=500, detail=f"PDF export failed: {e}  [{where}]")


def _pdf_response(pdf_bytes: bytes, fname: str) -> StreamingResponse:
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


def _plan_view_bundle(subject: str, grade: str, filename: str):
    """Assemble the render-ready view (lesson_plan + assessment) plus the chapter's
    targeted competencies and the plan's saved date from a saved plan — the server-side
    enrichment the LP / assessment / integrated PDF exporters need (mirrors
    get_plan_view + _build_report). Returns (view, competencies, plan_date, chapter)."""
    from datetime import datetime
    from aruvi_core.export_lesson_pdf import targeted_competencies

    sub = _subject(subject)
    _plan_key(subject, grade, filename)
    saved = data.load_saved_plan(subject, grade, filename)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved plan not found.")
    r = saved.get("result", {})
    chapter = {"chapter_number": saved.get("chapter_number"), "chapter_title": saved.get("chapter_title")}
    g = saved.get("grade", grade)
    lp = sub.lesson_plan_to_view(r, grade=g, chapter=chapter)
    _lp = r.get("lesson_plan", {})
    link_context = {"periods": _lp.get("periods", []),
                    "handoff": r.get("coverage_handoff", _lp.get("coverage_handoff", []))}
    # A dropped unit's questions travel with it ON SCREEN (serve e13) but NOT into the
    # export — the same rule the dropped units themselves follow: her printed artifact is
    # the plan she was served, and printing questions for a sitting the export omits would
    # put un-taught content in her hand (ARV-D-037).
    #
    # THROUGH THE CARRIER SEAM, never off `result` directly (ARV-D-063, 2026-08-06). This
    # line used to iterate `r["assessment_items"]` as a bare list. Science·secondary wraps
    # its items in a dict ({grade, subject, stage, …, questions: [...]}), so the walk
    # yielded the wrapper's KEYS — strings — and `i.get("unscheduled")` raised
    # AttributeError before any renderer was reached: all six exports 500 for every
    # science·ix plan, the plain identity canonical included. Same one-way-unwrap
    # blindness as ARV-D-060, on the export path; the seam that fix built is used here.
    # The wrapper must go back on, because the port reads it to decide the stage.
    from aruvi_core.genon import carriers as _carriers
    export_items = _carriers.from_engine_items(
        [i for i in _carriers.raw_item_list(r) if not i.get("unscheduled")],
        _carriers.item_container(r))
    a = sub.assessment_to_view(export_items, grade=g, chapter=chapter,
                               link_context=link_context)
    view = ViewModel(lp, a).to_dict()

    mappings = data.load_mappings(subject, grade)
    mbc = {int(m["chapter_number"]): m for m in mappings if m.get("chapter_number") is not None}
    descriptions = data.load_competency_descriptions(subject, grade)
    cn = saved.get("chapter_number")
    comps = targeted_competencies(mbc.get(int(cn), {}) if cn is not None else {}, descriptions)

    # English uses a STANDARDIZED spine → section → competency table (same competencies every
    # chapter), so it gets `spines` instead of the per-chapter `comps`. Other subjects: spines=None.
    spines = None
    if subject == "english":
        spine_map = data.load_english_spine_map(grade)
        if spine_map:
            from aruvi_core.export_lesson_pdf import english_competency_spines
            spines = english_competency_spines(spine_map, descriptions)

    plan_date = None
    sa = saved.get("saved_at")
    if sa:
        try:
            plan_date = datetime.fromisoformat(sa)
        except ValueError:
            pass
    return view, comps, spines, plan_date, chapter


_DOCX_MT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _binary_response(data: bytes, fname: str, media_type: str, *, inline: bool = False) -> StreamingResponse:
    disp = "inline" if inline else "attachment"
    return StreamingResponse(
        iter([data]),
        media_type=media_type,
        headers={"Content-Disposition": f'{disp}; filename="{fname}"'},
    )


def _export_plan(subject: str, grade: str, filename: str, kind: str,
                 answers: bool, unit: Optional[int], fmt: str,
                 inline: bool = False) -> StreamingResponse:
    """Shared handler for the lesson-plan / assessment / integrated downloads
    (per subject·grade·chapter, section-agnostic). `answers` gates the assessment
    answer layer; `unit` scopes integrated to one unit; `fmt` is "pdf" | "docx".
    `inline=True` (PDF only) serves Content-Disposition: inline so the browser/mobile
    OS opens it in its native PDF viewer instead of force-downloading.

    ★ THE MASTHEAD IS DATED NOW, NOT FROM THE PLAN FILE (founder, 2026-09-17: "it is not
    showing current date"). Every renderer resolves its masthead as
    `generated_at or plan_date or datetime.now()`, and this handler passed only `plan_date` —
    which is the saved plan's `saved_at`, i.e. the moment that file was written into the
    SHARED library. Two things were wrong with that, and the second is the worse one:

      · it is the AUTHORING date of a certified canonical, so it never moves. 1000 of the
        1003 files in the library are stamped August 2026, and a teacher downloading in June
        would still have been handed "17 August 2026";
      · saved_plans is a SHARED serve cache, so for a served variant the stamp belongs to
        whichever teacher first caused that cache entry to be written. One teacher's
        timestamp was appearing in every other teacher's document.

    Meyy's other three documents all date themselves at generation (the year plan from the
    client's `generated_at`, the allocation report from `report.generated_at`, the invoice
    from its issue date), so these three were the outliers. `plan_date` is still PASSED — it
    remains the honest fallback if a caller ever wants the file's own date, and the ladder is
    the renderers' to resolve, not this handler's to flatten."""
    fmt = (fmt or "pdf").lower()
    if fmt not in ("pdf", "docx"):
        raise HTTPException(status_code=400, detail=f"Unknown format: {fmt}")
    is_pdf = fmt == "pdf"
    ext = "pdf" if is_pdf else "docx"
    mt = "application/pdf" if is_pdf else _DOCX_MT
    inl = inline and is_pdf  # inline only makes sense for PDF
    try:
        view, comps, spines, plan_date, chapter = _plan_view_bundle(subject, grade, filename)
        # One value for the whole response: three renderers must not disagree by a tick.
        now = datetime.now()
        cn = chapter.get("chapter_number")
        # WALK-A-066: named by chapter NAME, founder's scheme — see api/report_names.py.
        ctitle = chapter.get("chapter_title") or (view.get("chapter_title") if isinstance(view, dict) else "")
        def _name(k):
            return report_filename(k, answers, grade, subject, ctitle, ext, unit=unit,
                                   chapter_number=cn)
        if kind == "lesson":
            if is_pdf:
                from aruvi_core.export_lesson_pdf import export_lesson_plan_pdf as fn
            else:
                from aruvi_core.export_docx import export_lesson_plan_docx as fn
            data = fn(view, competencies=comps, competency_spines=spines, plan_date=plan_date,
                      generated_at=now)
            return _binary_response(data, _name("lesson"), mt, inline=inl)
        if kind == "assessment":
            if is_pdf:
                from aruvi_core.export_assessment_pdf import export_assessment_pdf as fn
            else:
                from aruvi_core.export_docx import export_assessment_docx as fn
            data = fn(view, include_answers=answers, plan_date=plan_date, generated_at=now)
            return _binary_response(data, _name("assessment"), mt, inline=inl)
        if kind == "integrated":
            if is_pdf:
                from aruvi_core.export_integrated_pdf import export_integrated_pdf as fn
            else:
                from aruvi_core.export_docx import export_integrated_docx as fn
            data = fn(view, include_answers=answers, unit_number=unit,
                      competencies=comps, competency_spines=spines, plan_date=plan_date,
                      generated_at=now)
            return _binary_response(data, _name("integrated"), mt, inline=inl)
        raise HTTPException(status_code=404, detail=f"Unknown export kind: {kind}")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"\n[export {kind}/{fmt}] FAILED:\n" + tb, flush=True)
        last = tb.strip().splitlines()
        where = next((l.strip() for l in reversed(last) if "aruvi" in l or "api/" in l), "")
        raise HTTPException(status_code=500, detail=f"Export failed: {e}  [{where}]")


@app.get("/api/plans/{subject}/{grade}/{filename}/export/lesson")
def export_plan_lesson(subject: str, grade: str, filename: str,
                       format: str = "pdf", inline: int = 0) -> StreamingResponse:
    """Whole-chapter Lesson Plan (PDF or DOCX). `inline=1` opens PDF in the native viewer."""
    return _export_plan(subject, grade, filename, "lesson", answers=False, unit=None,
                        fmt=format, inline=bool(inline))


@app.get("/api/plans/{subject}/{grade}/{filename}/export/assessment")
def export_plan_assessment(subject: str, grade: str, filename: str,
                           answers: int = 0, format: str = "pdf", inline: int = 0) -> StreamingResponse:
    """Whole-chapter Assessment (PDF or DOCX). `answers=1` includes the answer layer."""
    return _export_plan(subject, grade, filename, "assessment", answers=bool(answers), unit=None,
                        fmt=format, inline=bool(inline))


@app.get("/api/plans/{subject}/{grade}/{filename}/export/integrated")
def export_plan_integrated(subject: str, grade: str, filename: str,
                           answers: int = 0, unit: Optional[int] = None,
                           format: str = "pdf", inline: int = 0) -> StreamingResponse:
    """Integrated Lesson Plan + Assessment (PDF or DOCX). `answers=1` includes answers;
    `unit=N` scopes to a single unit (else the whole chapter)."""
    return _export_plan(subject, grade, filename, "integrated", answers=bool(answers), unit=unit,
                        fmt=format, inline=bool(inline))


@app.post("/api/year-plan/export-docx")
def export_year_plan_docx_route(req: YearPlanExportRequest) -> StreamingResponse:
    """Export the Year Plan TABLE alone as a DOCX (Word) binary.

    Word only, by decision — this is the one artifact a teacher hands to somebody else
    (a staff meeting, an HOD's file), and the thing she most often wants to do with it
    is amend a row before she does. A PDF would freeze exactly what she needs loose.

    The import is lazy for the same reason every other export route's is (main.py:58):
    a missing optional dependency must never break API import — it returns 501 here
    rather than taking the whole service down at start-up.
    """
    try:
        from aruvi_core.export_year_plan_docx import export_year_plan_docx
    except ImportError as e:
        raise HTTPException(status_code=501, detail=f"DOCX export unavailable: {e}")
    try:
        docx_bytes = export_year_plan_docx(req.model_dump())
        fname = year_plan_filename(req.grade, req.subject)   # WALK-A-066
        return _binary_response(docx_bytes, fname, _DOCX_MT)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print("\n[year-plan export-docx] FAILED:\n" + tb, flush=True)
        last = tb.strip().splitlines()
        where = next((l.strip() for l in reversed(last) if "aruvi" in l or "api/" in l), "")
        raise HTTPException(status_code=500, detail=f"DOCX export failed: {e}  [{where}]")


@app.post("/api/allocation/export-docx")
def export_allocation_docx(req: AllocationReportRequest) -> StreamingResponse:
    """Export the allocation report as a DOCX (Word) binary."""
    try:
        from aruvi_core.export_allocation_docx import export_allocation_report_docx
        docx_bytes = export_allocation_report_docx(_build_report(req))
        fname = f"allocation-report-grade-{req.grade}-{_safe_name(req.subject)}.docx"
        return StreamingResponse(
            iter([docx_bytes]),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )
    except HTTPException:
        raise  # let 404/422 from _build_report pass through unchanged
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print("\n[export-docx] FAILED:\n" + tb, flush=True)
        last = tb.strip().splitlines()
        where = next((l.strip() for l in reversed(last) if "aruvi" in l or "api/" in l), "")
        raise HTTPException(status_code=500, detail=f"DOCX export failed: {e}  [{where}]")
