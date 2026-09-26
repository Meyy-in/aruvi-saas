"""
Adapter ports — the seams that keep Aruvi free of vendor lock-in.

Core logic depends only on these abstract Protocols; each vendor (Anthropic, Supabase,
Upstash, Razorpay, ...) is a thin adapter implementing one of them, wired in at the edge.
Swapping a provider = write one adapter, never touch the engine or app. This is the same
pattern the prototype's `llm_client.py` already proved, applied across the board.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, Union, runtime_checkable


# ── LLM provider ──────────────────────────────────────────────────────────────
@dataclass
class Prompt:
    system: str
    messages: List[Dict[str, Any]]
    max_tokens: int = 32000
    cache_system: bool = True  # turn on Anthropic prompt-caching for the static constitution block


@dataclass
class LLMResponse:
    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0


@runtime_checkable
class LLMClient(Protocol):
    """Port over the model provider. Aruvi is certified Claude-only today; the Anthropic
    adapter is the one implementation. A version bump or provider swap is one adapter."""
    def generate(self, prompt: Prompt) -> LLMResponse: ...


# ── Output cache: the #1 economic lever ────────────────────────────────────────
@runtime_checkable
class OutputCache(Protocol):
    """Keyed by (subject, grade, chapter, normalized period_profile, constitution_version).
    A hit means the model is never called — the profitability hinge at seasonal volume.
    Applied by the service layer that wraps the engine, not by the engine itself."""
    def get(self, key: str) -> Optional[Dict[str, Any]]: ...
    def put(self, key: str, value: Dict[str, Any]) -> None: ...


# ── Object storage (the shared read-only content tree; generated artifacts) ────
@runtime_checkable
class Storage(Protocol):
    """Port over Bucket A — the content DATA_DIR holds: the certified lesson library,
    chapter mappings, framework glossaries, allocation norms, the master plan.

    ★ EXTENDED 2026-08-29 with `list_prefix` and `exists`, and the reason is the
    whole point of the port. The original three methods addressed a single object by
    name, which is all a generated PDF ever needs. But the runtime does not only read
    files it can name — it asks "which chapters exist?", "which canonicals are in this
    chapter's library?", "which editions have been published?" and reads everything it
    finds. Without a listing method those questions could only be answered by going
    around the port to the filesystem, which is exactly what api/data.py did.

    ★ PATHS ARE KEYS, NOT FILESYSTEM PATHS. Every method takes a '/'-joined path
    RELATIVE to the content root, and no adapter may treat a path component as a
    directory that must exist. `list_prefix` is therefore prefix-matching, not
    directory-listing: an object store has no directories, only keys that happen to
    share a leading substring. A local adapter maps prefixes onto folders because it
    can; an S3 adapter never needs to. This is the one design choice that decides
    whether the port survives contact with a real object store.

    Ordering is part of the contract: `list_prefix` returns results SORTED, because
    callers rely on a stable read order for the library (a plan's units and a
    chapter's canonicals are read in name order and served in the order read)."""

    def get_bytes(self, path: str) -> bytes: ...
    def put_bytes(self, path: str, data: bytes, content_type: str = "application/octet-stream") -> str: ...
    def url_for(self, path: str) -> str: ...

    def exists(self, path: str) -> bool:
        """True if an object is stored under exactly this key. Never a directory test."""
        ...

    def version_token(self, path: str) -> Optional[str]:
        """An opaque string that CHANGES when the object at `path` changes, or None
        if there is no object there.

        Exists so in-process memo caches can be invalidated without the runtime
        knowing what a modification time is. api/data.py keeps two such caches — the
        master plan and the compiled phase streams — and both previously keyed on
        os.path.getmtime(), which is a filesystem fact an object store does not
        offer. It offers ETag and LastModified instead, so the port asks for the
        weakest thing all three can honour: compare it for equality, never parse it,
        never order two of them."""
        ...

    def list_prefix(self, prefix: str, suffix: str = "") -> List[str]:
        """Every key under `prefix`, sorted, as paths relative to the content root.

        `suffix` filters by ending (".json"). A prefix that matches nothing returns
        an empty list — a missing prefix is not an error, because in an object store
        there is nothing there to be missing.

        Non-recursive by contract: returns the keys DIRECTLY under the prefix, not
        those nested deeper. Callers that want a tree walk compose calls, so the
        adapter never has to guess how deep to go."""
        ...

    def list_subprefixes(self, prefix: str) -> List[str]:
        """The next path SEGMENT under `prefix`, sorted — the answer to "which grades
        does this subject have?" and "which editions has this library published?".

        Deliberately a separate method from `list_prefix` rather than a flag on it,
        because in an object store these are genuinely different results from one
        call: S3's list-objects with Delimiter='/' returns Contents (the keys, ->
        list_prefix) and CommonPrefixes (the segments, -> here). Folding them together
        would force every adapter to re-separate what the API already separated.

        Returns bare segment names, not full paths, and never includes a trailing
        delimiter. An empty result means nothing is stored under the prefix."""
        ...


# ── Tenant data (plans, feedback, cost ledger) ─────────────────────────────────
@runtime_checkable
class Repository(Protocol):
    """Our own DB is source of truth for users, entitlements, and the cost ledger —
    so auth/billing providers stay swappable."""
    def save_plan(self, tenant_id: str, user_id: str, plan: Dict[str, Any]) -> str: ...
    def list_plans(self, tenant_id: str, user_id: str) -> List[Dict[str, Any]]: ...
    def record_cost(self, tenant_id: str, entry: Dict[str, Any]) -> None: ...


# ── Async job queue (long-running generation) ──────────────────────────────────
@runtime_checkable
class JobQueue(Protocol):
    def enqueue(self, job_type: str, payload: Dict[str, Any]) -> str: ...


# ── Auth (managed identity provider behind an adapter) ─────────────────────────
@dataclass
class Identity:
    """The verified caller, as the auth layer resolves it — the ONLY shape identity
    travels in above the port. `user_id` and `tenant_id` are separate values that today
    happen to be equal (an individual teacher is her own tenant); an institutional tier
    later makes them differ with no change to this shape."""
    user_id: str
    tenant_id: str
    role: str = "teacher"
    # The verified mobile, when the provider knows it (Supabase phone auth, 2026-09-09) —
    # copied onto the account record at JIT creation. Empty under the header stub.
    phone: str = ""
    # When the credential was issued (the token's `iat`, epoch seconds), when the provider
    # knows it — None under the header stub. Used to refuse a token minted BEFORE the account
    # was erased (WALK-A-018): such a token must never quietly re-create the account.
    issued_at: Optional[int] = None


@runtime_checkable
class AuthProvider(Protocol):
    """Port over the identity provider. The reference implementation
    (adapters/header_auth_provider.py) treats the token as the raw X-Aruvi-User header
    value — no password, dev only. A partner's IdP adapter verifies a real signed token
    behind this same method; `api/main.py:_current_identity()` is the single caller, so
    the swap touches one wiring line and nothing else."""
    def verify_token(self, token: str) -> "Identity":
        """Resolve a credential to a verified Identity. Raise ValueError on an invalid
        or expired token — the API layer translates that to 401."""
        ...


# ── Account + tenant record (administrative architecture Step 0) ────────────────
# The spine of the administrative half (docs/administrative_architecture.md §5 Step 0):
# billing, privacy, notifications and institutions all hang off this record, and it is
# the one place where `tenant` stops being an alias for `user`. Today every account is
# an individual teacher — her own tenant, tenant_id == account_id — but they are stored
# as SEPARATE fields so the institutional tier (one school tenant owning many accounts)
# is a data change, not a schema change.
@dataclass
class Account:
    """A teacher's durable account record. NOT year-scoped (a subscription is rolling,
    §2.5) and NOT the teaching profile (that stays in ReadinessRepository)."""
    account_id: str            # stable internal id, never the email; doubles as user_id
    tenant_id: str             # today == account_id; a school later owns many accounts
    display_name: str
    email: str = ""
    phone: str = ""
    locale: str = "en-IN"
    school_name: str = ""
    # Occupational/demographic fields, collected at SUBSCRIPTION checkout only (never
    # in trial — asking less is a DPDP asset; founder 2026-08-24). Optional forever.
    role: str = ""             # Teacher | Academic coordinator | ...
    state: str = ""
    city: str = ""
    status: str = "active"     # active | suspended | pending_deletion
    created_at: str = ""
    consent: Dict[str, Any] = field(default_factory=dict)   # {policy_version, accepted_at, channels}
    notify: Dict[str, Any] = field(default_factory=dict)    # {email: bool, push: bool, whatsapp: bool}
    # ★ THE GUIDED TOUR IS OFFERED ONCE, EVER (founder, 2026-08-26, live). ISO timestamp
    # of the moment the offer was first shown; empty means never. It lives on the ACCOUNT
    # and not in localStorage because "once" has to mean once across her devices and
    # across sign-outs, and it must survive a cutover — the previous rule derived
    # eligibility from having no bound sections, which is exactly what a new academic
    # year recreates, so the tour came back every June and every time she cleared a card.
    tour_offered_at: str = ""
    # ★ WHICH PRIVACY NOTICE SHE WAS SHOWN, AND WHEN (2026-09-04): {version, seen_at,
    # context}. A defensive record, NOT a consent — the notice is given, never signed
    # (api/legal.py) — so it lives on the account, is rendered in her export, and is
    # ERASED with her, unlike the agreement's ledger. Stamped at first sign-in (the
    # moment the mobile is collected, which is when DPDP §5 wants the notice given) and
    # re-stamped when she dismisses the "updated" note for a newer version. Empty on
    # records from before the field: the shell treats that as "never shown" and shows
    # the note once.
    privacy_notice: Dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class AccountRepository(Protocol):
    """Persists account + tenant records, keyed by tenant_id + user_id (== account_id).

    File-based (JSON) implementation for now (adapters/account_repository_file.py at
    STATE_DIR/accounts/{tenant}/{user}/account.json); the partner's cloud adapter swaps
    in behind this same port. `_current_identity()` in api/main.py is the only place
    that resolves a request to an Account — identity derivation must never scatter.
    """
    def load(self, tenant_id: str, user_id: str) -> Optional["Account"]:
        """Load an account record, or None if the caller has none yet."""
        ...

    def save(self, account: "Account") -> None:
        """Create or fully replace an account record (small, always written whole)."""
        ...

    def find_by_email(self, email: str) -> Optional["Account"]:
        """Look an account up by email (case-insensitive), or None. Empty emails never
        match — dev accounts have no email. A SHARED address must return None, not an
        arbitrary winner: email is a sign-in credential, and one that points at two
        accounts points at neither (see find_all_by_email)."""
        ...

    def find_all_by_email(self, email: str) -> list:
        """Every account carrying this email. Ordinarily 0 or 1; a longer list means the
        address cannot identify anyone on its own. Used to detect that ambiguity and to
        refuse an address already taken by a different account."""
        ...

    def delete(self, tenant_id: str, user_id: str) -> None:
        """Remove the account record — administrative_architecture.md §2.6 semantics
        (the full erase traversal is Step 4's DataRightsService; this removes only the
        account record itself). No-op if absent."""
        ...


# ── Academic year (administrative architecture Step 1) ──────────────────────────
# Year-scoped addressing: every piece of TEACHING state (section state, allocations,
# prepared register, plan archive — later chapter notes) is filed under an academic
# year, {kind}/{tenant}/{user}/{year}/…, so cutover (Step 2) is a folder boundary,
# never a data rewrite. The account and the teaching profile are deliberately NOT
# year-scoped: the subscription is rolling (§2.5) and the class list carries across
# years (§2.7). The year list is per-teacher because schools start at different times
# (CBSE Apr–Mar, several state boards Jun–May).
@dataclass
class AcademicYear:
    year_id: str               # "2026-27" — filesystem-safe as-is, used as the path segment
    starts_on: str             # ISO date — varies by board
    ends_on: str               # ISO date
    is_current: bool = False
    # ★ Set when Aruvi rolled the teacher into this year AUTOMATICALLY on the cutover date
    # and CARRIED her section bindings across, so she could keep teaching without a break.
    # It means "she has last year's tracking in this year's folder and has not yet chosen
    # to start fresh" — the one thing the teacher-side clean-up offer is waiting on.
    # Cleared when she confirms. (founder, 2026-08-26)
    cleanup_pending: bool = False


@runtime_checkable
class AcademicYearRepository(Protocol):
    """Persists a teacher's academic years and which one is current, keyed by
    tenant_id + user_id.

    File-based (JSON) implementation for now (adapters/academic_year_repository_file.py
    at STATE_DIR/academic_years/{tenant}/{user}/years.json).

    Cutover (Step 2, built 2026-08-26) did NOT need a close_year() here in the end — see
    YearCutover below. Because every teaching store is year-scoped by PATH, moving a
    teacher to a new year is `open_year` + `set_current`; the old year's folders are left
    exactly as they are, which is what makes last year readable and this year empty.
    """
    def current(self, tenant_id: str, user_id: str) -> Optional["AcademicYear"]:
        """The teacher's current academic year, or None if none has been opened yet.
        The API layer bootstraps a default year on first touch — adapters never invent
        one."""
        ...

    def list_years(self, tenant_id: str, user_id: str) -> List["AcademicYear"]:
        """All years ever opened for this teacher, oldest first. Empty list if none."""
        ...

    def open_year(self, tenant_id: str, user_id: str, year: "AcademicYear") -> None:
        """Add a year to the teacher's list. Idempotent on year_id — re-opening an
        existing year updates its dates/flag rather than duplicating it. If the year is
        marked current, every other year's is_current is cleared (one current, always).
        """
        ...

    def set_current(self, tenant_id: str, user_id: str, year_id: str) -> None:
        """Mark one existing year current (clearing the others). Raise ValueError if
        the year_id has never been opened."""
        ...


# ── Academic-year cutover (administrative_architecture.md Step 2) ───────────────
@dataclass
class CutoverResult:
    """What one teacher's cutover did. Returned to the UI so the confirmation screen
    states facts rather than promises."""
    closed_year: str           # the year she was in, e.g. "2026-27"
    opened_year: str           # the year she is in now, e.g. "2027-28"
    sections_carried: int      # class list / sections carried forward unchanged
    plans_archived: int        # her plans now living under the closed year's folder
    already_done: bool = False # she had already cut over — a second tap changes nothing


@runtime_checkable
class YearCutover(Protocol):
    """Moves ONE teacher from her current academic year into the next.

    ★ The design that made this small: every TEACHING store is year-scoped by path
    ({kind}/{tenant}/{user}/{year}/…) while READINESS is not (the class list carries
    across years, §2.7). So cutover neither copies nor deletes anything — it opens the
    next year and points her at it. The old year's folders stay untouched, which is
    precisely why last year stays readable and this year starts empty:

      · prepared plans      → new year's folder is empty  → My Lessons starts clean,
                              last year available as a folder below
      · section state       → new year's folder is empty  → attachments and pointers
                              cleared, which is the "fresh start" she is confirming
      · plan notes          → stay in the closed year     → notes travel with the plans
                              they were written against
      · readiness (profile) → not year-scoped             → subjects, classes, sections
                              and periods carry forward untouched

    MUST be idempotent: a teacher will tap twice, and a second tap must report
    `already_done` rather than opening a third year or wiping the year she just started.
    """
    def cutover(self, tenant_id: str, user_id: str,
                from_year: str, to_year: str) -> "CutoverResult": ...


# ── Chapter notes (administrative architecture Step 3 — the last data gap) ──────
# The teacher's own writing on a chapter — until now the ONLY teacher data living
# nowhere but the browser (CLOUD_DATA_MODEL.md §2.8's invariant violation). One note
# per CHAPTER within an academic year (founder, 2026-08-22: two notes exist only when
# two YEARS are involved — within a year, preparing the same chapter at two period
# counts still reads/writes the single note, preserving the 2026-07-23 "one surface"
# decision). The store is year-scoped like the other teaching state, which is exactly
# how notes stay with their year's plans at cutover (§2.4) — the new year simply starts
# with an empty folder.
#
# TWO RULES THAT MUST NOT SOFTEN (spec §2.4):
#   * NO VERSION HISTORY, EVER. Editing a note IS deleting its previous text; saving an
#     empty note IS deleting it. "She deleted it" must stay simply true.
#   * Last-write-wins needs a TIMESTAMP, not history: save() must refuse to overwrite a
#     newer stored copy with an older one (StaleNoteWrite) — the whole of the
#     multi-device protection, and all of it there will ever be.
@dataclass
class PlanNote:
    """One chapter's note. `note_key` is "{subject}/{grade}/{chapter_number}" — the
    chapter's identity, NOT a plan filename (one note per chapter per year)."""
    note_key: str
    text: str
    updated_at: str            # ISO timestamp — the anti-clobber field. NOT a history.


class StaleNoteWrite(ValueError):
    """Raised by save() when the incoming note's updated_at is older than the stored
    copy's — a stale device trying to overwrite a fresher edit. The caller re-reads and
    shows the newer note; it never force-writes."""


@runtime_checkable
class PlanNoteRepository(Protocol):
    """Persists a teacher's chapter notes, keyed by tenant_id + user_id + year_id.

    File-based (JSON) implementation for now (adapters/plan_note_repository_file.py at
    STATE_DIR/plan_notes/{tenant}/{user}/{year}/notes.json); the partner's cloud adapter
    swaps in behind this same port. Step 4's export traversal reads load_all() to carry
    her notes out beside their plans.
    """
    def load(self, tenant_id: str, user_id: str, year_id: str,
             note_key: str) -> Optional["PlanNote"]:
        """One chapter's note, or None if she has written nothing on it this year."""
        ...

    def save(self, tenant_id: str, user_id: str, year_id: str,
             note: "PlanNote") -> None:
        """Upsert one note. Raises StaleNoteWrite if the stored copy is newer than
        `note.updated_at`. Saving empty/whitespace text DELETES the note — the everyday
        edit flow is the delete flow (§2.4); there is no separate lifecycle."""
        ...

    def load_all(self, tenant_id: str, user_id: str, year_id: str) -> Dict[str, "PlanNote"]:
        """Every note this teacher wrote this year: {note_key: PlanNote}. Empty dict if
        none. The export/erase traversal (Step 4) walks this."""
        ...

    def delete(self, tenant_id: str, user_id: str, year_id: str, note_key: str) -> None:
        """Remove one note outright. No-op if absent. (The UI path is save-empty; this
        exists for Step 4's erase traversal and for symmetry.)"""
        ...


# ── Data rights: export + erase (administrative architecture Step 4) ────────────
# One traversal, three obligations: DPDP data portability, DPDP erasure, Apple
# 5.1.1(v) in-app account deletion. Both actions must remain reachable while the
# subscription is LAPSED (§2.5) — data rights do not lapse with payment. The export
# walks every Bucket-B store a teacher owns; it NEVER includes the shared lesson-plan
# library (that is licensed content she already has as PDFs — §2.6, and copying it
# per-tenant breaks the cache economics and the IP model). Erase walks the same path
# destructively and is precise, not absolute (§2.6): the receipt NAMES what is kept
# and why — disaster-recovery backups (purged ≤30 days), statutory tax records, and
# the shared content that was never hers. After erase the user ID is NOT reserved:
# signing in again JIT-creates a brand-new empty account (founder, 2026-08-22 — a
# tombstone would itself be a remnant).
@dataclass
class ErasureReceipt:
    """What an erase did — returned to the caller, deliberately NOT stored (a stored
    receipt under her key would itself be a remnant). `kept` wording must match what
    the privacy policy actually promises; test_data_rights pins it."""
    erased: List[str] = field(default_factory=list)     # human-readable, e.g. "chapter notes (2026-27)"
    kept: List[Dict[str, str]] = field(default_factory=list)   # [{"what": …, "why": …}]
    erased_at: str = ""


@runtime_checkable
class DataRightsService(Protocol):
    """Port over the export/erase traversal. The file reference implementation
    (adapters/data_rights_service_file.py) walks the Bucket-B file stores; the
    partner's cloud adapter re-implements both methods against their DB — for erase
    that is one tenant-scoped DELETE per table, which is also the moment RLS is
    proven real: if this traversal can reach another tenant's row, isolation never
    existed."""
    def export(self, tenant_id: str, user_id: str, fmt: str = "docx") -> bytes:
        """Everything this teacher owns, as ONE document: her account record, teaching
        profile, chapter notes across every year — each beside its chapter's identity —
        and her teaching state per year. `fmt` is "docx" (default — editable, because
        notes are notes to her future self: she will extend them, not just read them)
        or "pdf" (same document via the same xhtml2pdf engine the allocation report
        uses; founder 2026-08-22 — every Aruvi export offers both). Raise ValueError
        for any other fmt."""
        ...

    def erase(self, tenant_id: str, user_id: str) -> "ErasureReceipt":
        """Destroy everything export() reaches, account record last, and return the
        receipt. Idempotent: erasing an already-empty identity returns an empty
        `erased` list and never errors."""
        ...


# ── Entitlement (administrative architecture Step 5 — the payment-shaped hole) ──
# The structure the thing that cannot be built yet (a payment gateway) fits into.
# Model: docs/subscription_model_discussion.md §0 (founder, 2026-08-22). The billing
# unit is one teacher × one SUBJECT-STAGE, unlimited serves within scope; the trial is
# capped by CHAPTERS (3, any subject-stage), never by serves — her initial struggle is
# period-fitting and she needs several attempts per chapter, so re-serving a chapter she
# already holds is always free. Entitlement is keyed by TENANT (a school later pays once
# for many teachers), resolved SERVER-side, and carries its platform of purchase —
# `source` is why this seam must exist before any gateway is chosen: web takes
# Razorpay/UPI, Android takes Play Billing, iOS takes Apple IAP, and a subscription
# bought on her phone must be honoured wherever she signs in.
@dataclass
class Entitlement:
    """One tenant's right to generate. `scopes` entries are "{subject}/{stage}"
    (e.g. "social_sciences/middle"); the single entry "*" means all subject-stages
    (trial breadth, enterprise). `valid_until` is an ISO date; empty means no time
    limit (the trial deliberately has none — the cap is chapters, not days).
    `trial_chapters` records the chapter identities ("{subject}/{grade}/{chapter}")
    counted against the trial cap — membership is what makes re-serves free.

    ★ EVERY SCOPE CARRIES ITS OWN EXPIRY (founder, 2026-08-26). A teacher may add a
    subject-stage at any time and it runs a full year FROM THAT DAY, so one date for the
    whole entitlement cannot describe her: `scope_valid_until` maps scope → ISO date and
    is the authority. `valid_until` remains the LATEST of those dates — a derived
    convenience for display and for readers that predate this field. A scope with no
    entry falls back to `valid_until` (legacy records written before per-scope dates, and
    the "*" grants, whose breadth has no per-scope meaning)."""
    plan_id: str               # "trial" | "individual_annual" | "enterprise_annual"
    status: str                # trial | active | grace | expired
    valid_until: str = ""      # ISO date; "" = no time limit. Derived: max of the below.
    source: str = "trial"      # trial | manual | web | ios | android
    scopes: List[str] = field(default_factory=list)
    trial_chapters: List[str] = field(default_factory=list)
    scope_valid_until: Dict[str, str] = field(default_factory=dict)


@runtime_checkable
class EntitlementRepository(Protocol):
    """Persists entitlements, keyed by tenant_id ONLY (the subscription belongs to the
    tenant; every user under it rides it). File-based reference implementation now
    (adapters/entitlement_repository_file.py); the partner's cloud adapter swaps in
    behind this same port. NOT year-scoped — a subscription is rolling (§2.5)."""
    def load(self, tenant_id: str) -> Optional["Entitlement"]:
        """The tenant's entitlement, or None if never granted (the API layer decides
        whether None means 'start a trial')."""
        ...

    def save(self, tenant_id: str, ent: "Entitlement") -> None:
        """Create or fully replace the tenant's entitlement (small, written whole)."""
        ...


# ── Billing (Razorpay etc.; provider is just the charging mechanism) ───────────
@runtime_checkable
class BillingProvider(Protocol):
    """Port over the charging mechanism. The reference implementation is
    ManualBillingProvider (adapters/manual_billing_provider.py): the founder IS the
    gateway — grant, expire and revoke by hand via the entitlement CLI, real behaviour
    with no vendor. The partner's job is to implement this Protocol against the chosen
    gateway(s) and populate Entitlement.source; nothing above the port changes."""
    def create_subscription(self, tenant_id: str, plan_id: str) -> Dict[str, Any]: ...
    def verify_webhook(self, payload: bytes, signature: str) -> Dict[str, Any]: ...
    def cancel(self, tenant_id: str) -> Dict[str, Any]: ...
    def fetch_status(self, tenant_id: str) -> Dict[str, Any]: ...


# ── Notifications (email today; SMS/push later behind the same port) ───────────
@dataclass
class Attachment:
    """One file travelling with a message. `content` is the bytes themselves, not a
    path: the notifier may be a remote API adapter with no access to this machine's
    disk, and an invoice must never depend on the file still being there when the
    transport gets round to sending."""
    filename: str
    content: bytes
    mime_type: str = "application/pdf"
    # Set on an INLINE image (2026-09-03): the HTML references it as `cid:{content_id}`
    # and the transport embeds it as a `multipart/related` part of the HTML body rather
    # than a downloadable file. Empty for an ordinary attachment.
    content_id: str = ""


@dataclass
class EmailMessage:
    """One outbound message. `text` is the canonical body; `html` is optional and a
    plain-text-only transport may ignore it. `reply_to` exists because Aruvi's sender
    address and the address a teacher should WRITE to may diverge later.

    `attachments` (2026-08-26) carries the invoice PDF. A transport that cannot attach
    must still deliver the TEXT — the body always states the invoice number, so the mail
    is complete on its own and the file is a convenience, never the message.

    `inline` (2026-09-03) carries images the HTML body references by `cid:` — today
    the MEYY wordmark in the letterhead. Kept apart from `attachments` on purpose: an
    inline image is part of the HTML's rendering, not something she receives, so a
    caller counting "what came with this mail" (the invoice test does) never sees it,
    and a plain-text transport drops it with the HTML it belongs to."""
    to: str
    subject: str
    text: str
    html: str = ""
    reply_to: str = ""
    attachments: List["Attachment"] = field(default_factory=list)
    inline: List["Attachment"] = field(default_factory=list)


# ── WhatsApp (2026-09-26) ────────────────────────────────────────────────────────
# The second outbound channel, OPT-IN at subscription, on the teacher's sign-in mobile. A
# business may message a WhatsApp user first ONLY with a Meta-APPROVED TEMPLATE (free-form
# text is allowed only inside the 24h window she opens by writing to us), so the port speaks
# in templates, not in free text: `template` is the approved name, `params` fill its body's
# {{1}}, {{2}}… in order. `document` (optional) is a header attachment {link, filename} —
# the seam the invoice will use once the PDF has a fetchable URL.
@dataclass
class WhatsAppTemplate:
    to: str                                   # E.164 digits, no "+": "919876543210"
    template: str                             # approved template name, e.g. "meyy_welcome"
    language: str = "en"
    params: List[str] = field(default_factory=list)
    document: Dict[str, str] = field(default_factory=dict)   # {link, filename} or {}


@runtime_checkable
class WhatsAppClient(Protocol):
    """Port over WhatsApp sends. FileWhatsApp (dev) writes to STATE_DIR/whatsapp_outbox;
    CloudWhatsApp calls Meta's Cloud API. Same contract as Notifier: `send_template` MUST
    NOT raise — a subscription never fails because WhatsApp was slow — and returns
    {"status": "sent"|"written"|"skipped"|"error", ...}."""
    def send_template(self, msg: "WhatsAppTemplate") -> Dict[str, Any]: ...


@runtime_checkable
class Notifier(Protocol):
    """Port over outbound teacher notifications (administrative_architecture.md §6).

    Reference implementation: FileNotifier (adapters/file_notifier.py) — writes each
    message to disk instead of sending, so the whole flow is exercised with NO vendor
    and no credentials. SmtpNotifier sends for real when the founder sets the SMTP env
    vars; the partner's transactional-email adapter (SES/Postmark/Resend) implements
    this same Protocol later and nothing above the port changes.

    `send` MUST NOT raise on a transport failure — a teacher's subscription must never
    fail because a mail server was slow. It returns a result dict describing what
    happened ({"status": "sent"|"written"|"skipped"|"error", ...}) and callers log it."""
    def send(self, msg: EmailMessage) -> Dict[str, Any]: ...


# ── Invoicing (2026-08-26) ──────────────────────────────────────────────────────
@dataclass
class InvoiceLine:
    """One purchased subject-stage on an invoice. `valid_until` rides the LINE, not the
    invoice, because each subscription runs its own year from its own purchase date."""
    scope: str                 # "science/middle"
    description: str           # "Science · Middle — Classes 6, 7 and 8"
    quantity: int = 1
    unit_amount: int = 0       # ₹, whole rupees
    valid_from: str = ""       # ISO date
    valid_until: str = ""      # ISO date


@dataclass
class Invoice:
    """One purchase, as the document a teacher keeps.

    Money is held in WHOLE RUPEES as integers — Aruvi prices in whole rupees and float
    arithmetic has no place in a total someone reconciles. `tax_amount` is 0 and
    `seller_gstin` empty while Aruvi is not GST-registered; the fields exist so the day
    it registers is a config change and a template branch, not a schema migration.

    `number` is a gapless per-financial-year series (MEY/2026-27/0001) — what an Indian
    seller's books are expected to show. It is assigned once, at issue, and never reused
    even if the purchase it records is later refunded or revoked: a numbered series with
    holes in it is worse than useless."""
    number: str
    issued_at: str             # ISO timestamp
    tenant_id: str
    user_id: str
    bill_to_name: str = ""
    bill_to_email: str = ""
    bill_to_phone: str = ""
    bill_to_school: str = ""
    bill_to_place: str = ""    # "Kochi, Kerala"
    lines: List["InvoiceLine"] = field(default_factory=list)
    subtotal: int = 0
    tax_amount: int = 0
    tax_note: str = ""         # "No tax charged" while unregistered
    total: int = 0
    amount_paid: int = 0
    payment_method: str = ""   # "Recorded manually" until a gateway exists
    seller_gstin: str = ""
    seller_name: str = ""     # the registered entity ("Meyy (OPC) Private Limited"), 2026-09-03
    currency: str = "INR"


@runtime_checkable
class InvoiceRepository(Protocol):
    """Persists invoices, keyed by tenant_id + user_id (Bucket B — her own documents,
    not shared content). NOT year-scoped: an invoice belongs to the day it was issued
    and must remain readable across academic-year cutovers for as long as she has the
    account. The file adapter also stores the rendered PDF beside the record, so the
    exact bytes she was sent are the exact bytes she can download again."""
    def save(self, tenant_id: str, user_id: str, invoice: "Invoice",
             pdf: Optional[bytes] = None) -> None: ...

    def load_all(self, tenant_id: str, user_id: str) -> List["Invoice"]:
        """Newest first."""
        ...

    def load_pdf(self, tenant_id: str, user_id: str, number: str) -> Optional[bytes]: ...

    def next_number(self, financial_year: str) -> str:
        """The next number in the seller's series for that financial year ("2026-27").
        Must be atomic enough that two concurrent checkouts cannot take the same one."""
        ...


# ── Consent (the user agreement's six ticks) ───────────────────────────────────
# The agreement is shown IN FULL before she chooses subjects and stages, and the five
# acknowledgements plus the final one are ticked individually (founder, 2026-08-27; the
# document's own front matter says the same). This record is the evidence that happened.
#
# Keyed by TENANT, like the entitlement it gates — the agreement governs the paying
# relationship, and when a school later holds one tenant over many teachers it is the
# tenant that agreed. `user_id` is carried inside the record (who actually ticked),
# never in the key.
@dataclass
class ConsentRecord:
    """One acceptance of one version of one document.

    `acknowledgements` maps each tick's id to the ISO timestamp it was ticked —
    per-tick, because the document asks for them separately and "she ticked all five"
    is a weaker fact than five moments. `final_accepted_at` is the last tick, the one
    that accepts the body.

    Records are APPEND-ONLY. A new version is a new record; nothing is ever rewritten,
    because the point of the record is that it says what she saw."""
    tenant_id: str
    user_id: str
    document_id: str            # "consent_and_disclaimer"
    document_version: str       # "0.1" — the version SHE saw, not today's
    language: str = "en"        # which translation was on screen
    accepted_at: str = ""       # ISO timestamp of the completed acceptance
    acknowledgements: Dict[str, str] = field(default_factory=dict)  # ack id → ISO
    final_accepted_at: str = ""
    context: str = ""           # "subscription_checkout" | "reconsent" | …
    user_agent: str = ""        # thin provenance; no IP (we do not need one to hold her to it)
    # ★ Set when the ACCOUNT was erased (2026-08-27). The record stays — it is still
    # proof that this agreement was accepted on that date — but it stops counting as a
    # STANDING signature, because the relationship it belonged to ended. See the
    # repository docstring; this is the one field an append-only store ever writes twice.
    superseded_at: str = ""


@runtime_checkable
class ConsentRepository(Protocol):
    """Persists consent records, keyed by tenant_id. Append-only.

    ★ THESE SURVIVE ERASURE (founder, 2026-08-27). Every other Bucket-B store is walked
    destructively by DataRightsService; this one is not, because it is the proof that an
    agreement was accepted, and proof that disappears when the other party asks it to is
    not proof. The file adapter therefore stores OUTSIDE any {tenant}/{user} tree the
    erase traversal walks — the same reasoning that puts the invoice number series in
    `invoices/_series/`. The erasure receipt names it under `kept`, and the privacy text
    says so; those three must move together or none of them.

    It holds her tenant id, her user id and timestamps — no teaching content, no notes,
    no profile. That minimum is what makes retaining it defensible.

    ★ SURVIVING ERASURE IS NOT THE SAME AS STILL BEING IN FORCE (founder, 2026-08-27).
    A signature stands from the moment she gives it until her account is ERASED — across
    sign-outs, across sessions, and whether or not she ever subscribes (an agreement is
    complete when it is accepted; the next sign-in goes straight to payment). Erasure
    ends it, because it ends the relationship the signature belonged to: what comes back
    under the same id is a new account, JIT-created, holding nothing of hers. Treating
    the old signature as that new account's live consent would also be a live hazard —
    mobile numbers get REASSIGNED, and the next holder of the number would walk past an
    agreement she has never seen while the ledger claimed she signed it.
    So `erase` calls `supersede`: the rows stay as evidence, stamped with the date they
    stopped applying, and the returning teacher signs afresh. Found the hard way — see
    MEMORY.md 2026-08-27."""
    def save(self, record: "ConsentRecord") -> None:
        """Append one acceptance. Never replaces an earlier one."""
        ...

    def load_all(self, tenant_id: str) -> List["ConsentRecord"]:
        """Every acceptance this tenant has made, oldest first — superseded ones
        INCLUDED. This is the historical view: the export renders it, and a record that
        vanished from her own export would not be much of a kept record."""
        ...

    def latest(self, tenant_id: str, document_id: str,
               version: str = "") -> Optional["ConsentRecord"]:
        """The most recent acceptance IN FORCE — superseded rows are skipped, so this
        answers "is she bound today?" and never "did she ever sign?". Of a SPECIFIC
        version when one is named (the question the checkout gate asks: has she accepted
        the version that is current today?), otherwise of any version."""
        ...

    def supersede(self, tenant_id: str, at: str = "") -> int:
        """End every standing signature for this tenant, keeping the rows. Called by the
        erase traversal, and returns how many were stamped. Idempotent: a row already
        superseded keeps its original stamp, so a second erase cannot rewrite the date
        the first one ended."""
        ...


# ── Support (2026-08-27) ───────────────────────────────────────────────────────
# Email is the only support channel, and email's one failure mode is SILENCE. Every
# design decision below is aimed at that: she gets an acknowledgement with a reference
# the moment she writes, the reference is the handle both sides use afterwards, and the
# request is stored so a lost inbox on either side does not lose the case.
@dataclass
class SupportRequest:
    """One message a teacher sent to support.

    `reference` is what she is shown and what the acknowledgement quotes — the whole
    point of it is that a nameless message becomes a case with a number. It is assigned
    once and never reused.

    `context` is what the APP knows and she should not have to type: which screen she
    wrote from, which subject·grade·chapter she was on, the build. Email round-trips
    cost a day each, and a day spent asking "which chapter?" is a day she waits.

    `status` is the FOUNDER's own state, not hers — she never sees it and nothing in
    the product branches on it. It exists so a stored case can be closed out rather
    than living forever as an undifferentiated pile."""
    reference: str             # "ARV-S-742"
    tenant_id: str
    user_id: str
    category: str              # problem | plan | billing | suggestion
    message: str
    # The words that were ON SCREEN when she chose that category. Stored rather than
    # re-derived, on the consent record's principle: what a record is for is saying what
    # she actually saw. Rename or retire a category later and her export still reads back
    # the label she picked, not today's.
    category_label: str = ""
    created_at: str = ""       # ISO timestamp
    email: str = ""            # the address the acknowledgement was sent to
    name: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    acknowledged: bool = False  # did the acknowledgement actually leave?
    status: str = "open"        # open | answered | closed


@runtime_checkable
class SupportRepository(Protocol):
    """Persists support requests, keyed by tenant_id + user_id (Bucket B — her own
    words, so it joins the export and the erase traversal the day it is born).

    NOT year-scoped: a support case belongs to the day it was raised and must stay
    readable across academic-year cutovers.

    The reference SERIES, like the invoice number series, belongs to the seller and
    lives outside any tenant folder — a counter inside one would be destroyed by that
    teacher's erasure and the next teacher would be handed a number already used."""
    def next_reference(self) -> str:
        """The next reference in the series ("ARV-S-742"). Must be atomic enough that
        two concurrent requests cannot take the same one."""
        ...

    def save(self, request: "SupportRequest") -> None: ...

    def load_all(self, tenant_id: str, user_id: str) -> List["SupportRequest"]:
        """Every request this teacher has raised, NEWEST FIRST."""
        ...


# ── Allocation persistence (Persistent Annual Allocation Register) ──────────────
@dataclass
class AllocationSummary:
    """Summary of the current state of a subject/grade allocation register."""
    chapters_allocated: int
    chapters_remaining: int
    total_planned_periods: int
    total_planned_time_minutes: int


# A single chapter's saved allocation record. `periods_by_duration` is keyed by the
# period-type minutes (as a string, e.g. "45"), matching the shape the LRM/allocate
# engine and the frontend both already use — so the register is "redraw-ready" with no
# re-derivation needed (chapter_title/weight/totals travel with it, not just an int).
AllocationRecord = Dict[str, Any]  # {chapter_title, weight, periods_by_duration, total_periods, total_minutes}


@runtime_checkable
class AllocationRepository(Protocol):
    """Persists the Persistent Annual Allocation Register, per tenant + user.

    The register is per-user/tenant STATE (Bucket B, CLOUD_DATA_MODEL.md §2.2), so every
    method is keyed by tenant_id + user_id — the same identity readiness uses — in addition
    to subject·grade. Today auth is stubbed so tenant_id == user_id (the X-Aruvi-User
    header); Phase 4 derives both from the Supabase auth token with no signature change.

    Merge semantics: save_allocation() merges new/overwritten chapters into the existing
    register, preserving chapters not included in the current save.

    Year-scoped (Step 1): the register is TEACHING state, so every method also takes
    `year_id` — an allocation belongs to one academic year and cutover simply starts a
    fresh folder. The API layer resolves the year; adapters just address by it.

    File-based (JSON) implementation for now; the partner's cloud adapter swaps in later
    without touching business logic.
    """
    def load_register(self, tenant_id: str, user_id: str, year_id: str,
                      subject: str, grade: Union[str, int]) -> Dict[str, "AllocationRecord"]:
        """Load this teacher's Annual Allocation Register for a subject·grade in one
        academic year as {chapter_num: AllocationRecord}. Empty dict if none exists yet."""
        ...

    def save_allocation(self, tenant_id: str, user_id: str, year_id: str,
                        subject: str, grade: Union[str, int],
                        chapters_allocation: Dict[str, "AllocationRecord"]) -> None:
        """Save allocation data for this teacher's year, merging into the existing register.

        Chapters in chapters_allocation overwrite existing allocations for those chapters.
        Chapters not in chapters_allocation retain their previous allocations.
        """
        ...

    def get_summary(self, tenant_id: str, user_id: str, year_id: str,
                    subject: str, grade: Union[str, int]) -> AllocationSummary:
        """Return a summary of this teacher's current register state for one year."""
        ...

    def clear_register(self, tenant_id: str, user_id: str, year_id: str,
                       subject: str, grade: Union[str, int]) -> None:
        """Erase this teacher's register for a subject·grade in one year (the "Reset
        allocations" action). No-op if no register exists yet."""
        ...


# ── Readiness teaching-profile persistence (the setup payload) ──────────────────
# The per-teacher "teaching profile" emitted by web/app/components/Readiness.jsx —
# which subjects/grades/sections/durations a teacher takes, plus the weekly grid and
# annual budget. This is the single most important Bucket-B item to persist (see
# CLOUD_DATA_MODEL.md §2.1): without it the readiness flow is lost on every refresh.
#
# The CANONICAL shape is the self-contained `subjects[]` array. Each element:
#   {name, durations[], grades[{grade, sections[{tag,sec}], durations[]}],
#    grids[grade][section][day]=durationIdx|-1, budget{gradeIdx:{method,value}}}
# The denormalized "active subject" projection the component also emits
# (subject/grades/grids/durations/budget at top level) is derived sugar for current
# consumers — it is NEVER persisted (CLOUD_DATA_MODEL.md §5 invariant). The adapter
# stores subjects[] only; the projection is regenerated on read by the frontend.
#
# Every record is keyed by tenant_id + user_id. With no auth yet both stub to "local";
# Phase 4 swaps the values straight from the Supabase auth token — no schema change.
ReadinessProfile = Dict[str, Any]  # {subjects: [...], updated_at: str}


@runtime_checkable
class ReadinessRepository(Protocol):
    """Persists a teacher's readiness teaching profile, keyed by tenant_id + user_id.

    File-based (JSON) implementation for now; a Supabase adapter swaps in later behind
    this same port without touching the engine, API routes, or the React component.
    """
    def load_profile(self, tenant_id: str, user_id: str) -> Optional["ReadinessProfile"]:
        """Load the saved readiness profile, or None if the teacher has none yet.
        A None result is what the frontend reads as "not ready" (setup incomplete)."""
        ...

    def save_profile(self, tenant_id: str, user_id: str,
                     profile: "ReadinessProfile") -> None:
        """Persist the readiness profile (full replace — readiness setup is re-run whole,
        not merged chapter-by-chapter the way allocations are)."""
        ...

    def clear_profile(self, tenant_id: str, user_id: str) -> None:
        """Erase the teacher's readiness profile (the "start setup over" action).
        No-op if none exists yet."""
        ...


# ── Section teaching-state persistence (the lesson execution pointer) ───────────
# Per-section execution state: which chapter a section is tracking (`chapter`), how far
# along it is (`unit_index`, the current Learning Unit, 0-based), and whether the chapter
# is fully taught (`done`). This is the ONLY true execution state (CLAUDE.md §11: "status
# is execution, and lives in My Plans") and today lives ONLY in browser localStorage
# (current_chapter_* / lu_pointer_* / lu_done_*), so it does NOT follow a teacher across
# devices — the bug this store fixes. It is the Bucket-B "teaching pointer" of
# CLOUD_DATA_MODEL.md §2.4, whose target table `lesson_pointer(tenant_id, user_id,
# section_key, unit_index, updated_at)` is extended here with `chapter` + `done` (the same
# per-section execution state). localStorage stays as an optimistic cache; the stored row
# is authoritative for cross-device (exactly §2.4's prescription).
#
# Keyed by tenant_id + user_id (auth stubbed → tenant_id == user_id today). `section_key`
# is the frontend's `${subjectSlug}_${gradeSlug}_${sectionTag}`.
SectionState = Dict[str, Any]  # {chapter: str, unit_index: Optional[int], done: bool,
                               #  bookmark_unit: Optional[int], bookmark_phase: Optional[int],
                               #  updated_at: str}
# `bookmark_unit`/`bookmark_phase` (both 0-based, both null when unset) are the teacher's ONE
# place-marker on this section's chapter — a phase of the in-progress unit she drags to mark
# what she's finished / plans to begin next. It rides this SAME per-section row so it migrates
# to Supabase with the pointer at Phase 4, no new table (2026-07-23).


@runtime_checkable
class SectionStateRepository(Protocol):
    """Persists per-section teaching execution state, keyed by tenant_id + user_id +
    year_id (Step 1: pointers/done/bookmarks are the most year-bound state there is —
    cutover clears them by opening a new year folder, never by rewriting rows).

    File-based (JSON) implementation for now; the partner's cloud adapter (the
    `lesson_pointer` table, extended with `chapter` + `done`) swaps in behind this same
    port without touching the API routes, engine, or the React components.
    """
    def load_all(self, tenant_id: str, user_id: str, year_id: str) -> Dict[str, "SectionState"]:
        """All tracked sections for this teacher's year: {section_key: SectionState}.
        Returns an empty dict if the teacher has tracked nothing yet."""
        ...

    def save_one(self, tenant_id: str, user_id: str, year_id: str, section_key: str,
                 chapter: str, unit_index: Optional[int], done: bool,
                 bookmark_unit: Optional[int] = None,
                 bookmark_phase: Optional[int] = None) -> None:
        """Upsert one section's execution state as a full snapshot for that section
        (the client always sends the complete current state, so no field-merge needed).
        `bookmark_unit`/`bookmark_phase` default to None so pre-bookmark callers/tests are
        unaffected; passing them stores the teacher's phase place-marker on the same row."""
        ...

    def delete_one(self, tenant_id: str, user_id: str, year_id: str, section_key: str) -> None:
        """Remove one section's state — the "untrack" reversal. No-op if absent."""
        ...

    def clear_all(self, tenant_id: str, user_id: str, year_id: str) -> None:
        """Erase ALL section teaching-state for this teacher's year. Used by the 'start
        setup over' profile reset (DELETE /readiness) so stale bindings can't resurrect
        into a freshly rebuilt profile. No-op if nothing is stored. (Promoted into the
        Protocol 2026-08-22 — it was an impl-only extra the API already relied on.)"""
        ...


# ── Section chapter-history (the teaching ledger) ──────────────────────────────────
# SectionState above holds only the CURRENT chapter binding; the moment a chapter leaves
# that slot (untrack, or move-on from a completed chapter) the row is deleted, so the trail
# of what a section has actually TAUGHT lived nowhere but the browser (web/app/lib/
# sectionHistory.js, whose own header said a server mirror was owed). This store is that
# mirror: the same ledger, keyed tenant/user/year, so the trail follows a teacher across
# devices exactly as her pointer already does.
#
# ★ IT MERGES; IT DOES NOT SNAPSHOT — the one deliberate difference from
#   SectionStateRepository, and the reason `record` takes ENTRIES rather than a whole map.
#   Section state is CURRENT state, so a full per-section snapshot is right: the last writer
#   holds the truth. History is CUMULATIVE, so a full-map write would let a phone that has
#   never seen the laptop's rows delete them. Each entry is upserted under its own chapter
#   FILE with latest-`ts`-wins, which converges from any device in any order without loss.
#
# One row per chapter per section, so a re-taught chapter overwrites rather than duplicating.
# `status` ∈ {"completed", "untracked"} — "ongoing" is never stored (it is live state the UI
# overlays from the current binding). `units_done`/`total_units` stamp the progress reached,
# so a row can say "set aside at unit 2 of 10". The anti-noise gate (a chapter earns its row
# only if ≥1 unit was completed) lives in the CLIENT, where the pointer is known; this store
# keeps what it is handed.
SectionHistoryEntry = Dict[str, Any]  # {file: str, chapter_number: Optional[int],
                                      #  chapter_title: str, status: str,
                                      #  units_done: Optional[int],
                                      #  total_units: Optional[int], ts: int}


@runtime_checkable
class SectionHistoryRepository(Protocol):
    """Persists each section's ledger of chapters already taught, keyed by tenant_id +
    user_id + year_id (year-scoped for the same reason the pointer is: a new academic year
    is a new cohort, and last year's trail belongs to last year).

    File-based (JSON) implementation for now; a cloud adapter (a `section_history` table
    keyed `(tenant, user, year, section_key, chapter_file)`) swaps in behind this same port
    with no change to the API routes or the React components.
    """
    def load_all(self, tenant_id: str, user_id: str,
                 year_id: str) -> Dict[str, Dict[str, "SectionHistoryEntry"]]:
        """The whole ledger for this teacher's year:
        {section_key: {chapter_file: entry}}. Empty dict if she has taught nothing yet."""
        ...

    def record(self, tenant_id: str, user_id: str, year_id: str, section_key: str,
               entries: List["SectionHistoryEntry"]) -> None:
        """MERGE entries into one section's ledger, each keyed by its own `file`.

        Latest `ts` wins, so a stale push (a device that was offline while the same chapter
        was re-taught elsewhere) can never overwrite a newer row. Accepts a LIST so the one
        route serves both cases: a single new entry as it happens, and a device pushing its
        whole local ledger up once on first reconcile."""
        ...

    def delete_section(self, tenant_id: str, user_id: str, year_id: str,
                       section_key: str) -> None:
        """Drop one section's whole ledger. No-op if absent.

        ⚠️ NOT the untrack reversal — untracking a chapter must never erase the record that
        it was once taught, which is why `record` has no per-entry delete. This is for the
        stronger act: the SECTION itself leaving the teaching profile (edited away, or
        purged when a trialled subject is not bought). Its pointer is already deleted at
        both those sites; without this the trail survives, and a teacher who later re-adds
        a section with the same tag inherits a phantom history of chapters her new class
        never sat through."""
        ...

    def clear_all(self, tenant_id: str, user_id: str, year_id: str) -> None:
        """Erase this teacher's whole ledger for the year. Used by the 'start setup over'
        profile reset (DELETE /readiness), so a section key reused by a rebuilt profile
        cannot inherit another class's teaching trail, and by the academic-year cutover's
        start-fresh. No-op if nothing is stored."""
        ...


# ── Plan archive ───────────────────────────────────────────────────────────────────
# A teacher can ARCHIVE a lesson plan from My Lessons to declutter without ever losing it
# (there is deliberately NO hard delete — plans carry real generation cost, and the teacher-
# specific state around them — the LU pointer, notes, section attachments — is irreplaceable;
# the design decision, 2026-07-04). Archive is a per-tenant FLAG, not a physical move: the
# plan asset itself is shared read-only CONTENT under DATA_DIR (Bucket A), so archiving cannot
# relocate it. Instead we record the plan's key `{subject}/{grade}/{filename}` in this Bucket-B
# store; My Lessons lists un-archived plans, an Archived view lists the rest, and Restore just
# drops the key. Frozen identity + all back-references = restore is lossless. A plan being
# actively taught (any section attached) is blocked from archiving in the UI, so archived plans
# are only ever detached ones.
#
# Keyed by tenant_id + user_id (auth stubbed → tenant_id == user_id today). A Supabase adapter
# (an `archived_at` column on the plan row, or a small `plan_archive` table) swaps in behind
# this same port at Phase 4 with no change to the API routes or the React components.
@runtime_checkable
class PlanArchiveRepository(Protocol):
    """Persists which saved plans a teacher has archived, keyed by tenant_id + user_id +
    year_id (Step 1: My Lessons folds each closing year into its own archive folder, so
    the flag lives inside the year it was set in).

    The plan key is the frontend's `${subjectSlug}/${gradeSlug}/${filename}` — the same
    identity used to load the plan — so archive state binds to the plan without duplicating
    any of its content.
    """
    def load_all(self, tenant_id: str, user_id: str, year_id: str) -> Dict[str, str]:
        """All archived plan keys for this teacher's year: {plan_key: archived_at_iso}.
        Returns an empty dict if nothing is archived."""
        ...

    def archive(self, tenant_id: str, user_id: str, year_id: str, plan_key: str) -> None:
        """Mark one plan archived (records archived_at). Idempotent — re-archiving a plan
        that is already archived leaves the original timestamp untouched."""
        ...

    def restore(self, tenant_id: str, user_id: str, year_id: str, plan_key: str) -> None:
        """Un-archive one plan — the reversal. No-op if the plan was not archived."""
        ...


# Prepared-plans register — which saved plans a teacher has actually PREPARED (generated /
# attached), keyed by tenant_id + user_id. Live generation is deferred, so the saved-plan
# library lives in shared read-only CONTENT (Bucket A) and is identical for every teacher;
# without this register My Lessons would show every sample plan to everyone, breaking the
# "assets you've gathered over time" premise. This is the per-tenant STATE (Bucket B) that
# records the teacher's OWN preparations, so the listing can be filtered down to her work.
# First-run writes its chapter here on activation; the everyday PrepareLesson flow appends on
# each generate. A Supabase adapter (a `prepared_at` column on the saved-plan row, or once live
# generation lands, the mere EXISTENCE of the teacher's own generated plan row) swaps in behind
# this same port at Phase 4 with no change to the API routes or the React components.
@runtime_checkable
class PreparedPlansRepository(Protocol):
    """Persists which saved plans a teacher has prepared, keyed by tenant_id + user_id +
    year_id (Step 1: what she prepared belongs to the year she prepared it in — the new
    year's My Lessons starts fresh, the old year's stays openable from its folder).

    The plan key is the frontend's `${subjectSlug}/${gradeSlug}/${filename}` — the same
    identity used to load the plan and to key the archive — so prepared state binds to the plan
    without duplicating any of its content.
    """
    def load_all(self, tenant_id: str, user_id: str, year_id: str) -> Dict[str, Any]:
        """All prepared plan keys for this teacher's year, keyed by plan_key. The value is
        either a legacy prepared_at ISO string, or a record `{"at": iso, "periods": int|None}`
        once the teacher's chosen period count is stored alongside. Empty dict if nothing
        prepared yet."""
        ...

    def mark(self, tenant_id: str, user_id: str, year_id: str, plan_key: str,
             periods: "int | None" = None) -> None:
        """Record one plan as prepared. The prepared_at timestamp is set once (idempotent). When
        `periods` is given (the teacher's chosen period count for that chapter) it is stored and
        UPDATED on every call, so re-preparing tracks the latest generation's periods."""
        ...

    def unmark(self, tenant_id: str, user_id: str, year_id: str, plan_key: str) -> None:
        """Forget that this plan was prepared. No-op when absent. Added 2026-08-26 for the
        trial purge: a subject she trialled and did not subscribe to leaves records that can
        only clutter My Lessons. It removes the RECORD, never the plan asset — the saved plan
        is shared library content, not hers to delete."""
        ...
