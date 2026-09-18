"""File-backed reference implementation of DataRightsService (Step 4: export + erase).

One traversal, two directions. EXPORT walks every Bucket-B store a teacher owns —
account, academic years, teaching profile, support messages, and per year: chapter
notes, allocations, section state, prepared register, archive flags — and renders it
as one editable Word
document (export_data_rights_docx.build_export_docx). ERASE walks the same path
destructively (account record last) and returns an ErasureReceipt naming what was kept
and why (§2.6: backups ≤30 days, statutory tax records, shared content).

Reads go through the same file adapters the API uses, so the walk can never drift from
what the app actually stores. The ONE filesystem-level read is enumerating which
subject·grade allocation registers exist for a year (the AllocationRepository port
addresses by subject·grade and deliberately has no listing method); the partner's DB
adapter replaces that with a WHERE tenant_id=… scan — which is also the isolation
proof: if this traversal can reach another tenant's row, RLS was never real.

Erase notes:
  * shutil.rmtree per {kind}/{tenant}/{user} — a folder boundary, exactly what the
    Step-1 re-filing bought us. Nothing outside the identity's folders is touched.
  * The user ID is NOT reserved afterwards: signing in again JIT-creates a fresh empty
    account (founder 2026-08-22 — a tombstone would itself be a remnant).
  * Idempotent: erasing an empty identity returns an empty `erased` list, no error.
"""
import re
from dataclasses import asdict
from datetime import datetime, timezone
from aruvi_core.adapters.document_backend import as_backend, slug as _slug_shared
from typing import Any, Callable, Dict, List, Optional, Tuple

from aruvi_core.ports import DataRightsService, ErasureReceipt
from aruvi_core.adapters.account_repository_file import AccountRepositoryFileImpl
from aruvi_core.adapters.academic_year_repository_file import AcademicYearRepositoryFileImpl
from aruvi_core.adapters.readiness_repository_file import ReadinessRepositoryFileImpl
from aruvi_core.adapters.allocation_repository_file import AllocationRepositoryFileImpl
from aruvi_core.adapters.section_state_repository_file import SectionStateRepositoryFileImpl
from aruvi_core.adapters.section_history_repository_file import SectionHistoryRepositoryFileImpl
from aruvi_core.adapters.plan_archive_repository_file import PlanArchiveRepositoryFileImpl
from aruvi_core.adapters.prepared_plans_repository_file import PreparedPlansRepositoryFileImpl
from aruvi_core.adapters.plan_note_repository_file import PlanNoteRepositoryFileImpl
from aruvi_core.adapters.consent_repository_file import ConsentRepositoryFileImpl
from aruvi_core.adapters.support_repository_file import SupportRepositoryFileImpl


_slug = _slug_shared


# The year-scoped teaching-state kinds, in erase order. readiness (the profile) is
# tenant-keyed but NOT year-scoped; accounts/academic_years are handled explicitly.
_YEAR_KINDS = ("plan_notes", "section_state", "section_history", "allocations",
               "prepared_plans", "plan_archive")

# §2.6 verbatim — the receipt's wording is pinned by test_data_rights and must match
# what the privacy policy promises. Change both together or neither.
# ★ FOUR PLACES SAY WHAT SURVIVES AN ERASURE, AND THEY MUST AGREE (2026-09-04): this
#   list · the Privacy Notice §7 (data/cloud/content/legal/privacy_policy_v*.md) · §G of
#   the user agreement · the placement of the consent ledger. tests/test_privacy_notice.py
#   reads the notice and checks every row here against it — the receipt is the one
#   document a teacher holds AFTER her account is gone, so it may not name less than the
#   notice did, and it may not name more.
_KEPT = [
    {"what": "Disaster-recovery backups",
     "why": "Deleted from the live system immediately; purged from backups within 30 days."},
    {"what": "Tax records for payments made",
     "why": "Invoices are books of account and outlive the account for the period the law "
            "requires (8 years under the Companies Act, 2013); they carry your name, "
            "email, mobile, school name if given, place and amount."},
    # ★ Settled 2026-09-04 (founder): mail copies are kept WITH the invoice records, for
    #   the same period — not deleted at erasure, not on a shorter clock of their own.
    {"what": "Email we exchanged",
     "why": "Payment confirmations with their invoices, and support threads, stay in our "
            "business mailbox as part of the same records, for the same 8 years, then "
            "are deleted."},
    # ★ Settled 2026-09-04 (founder): the erasure log keeps the MOBILE NUMBER as the
    #   identifier and SAYS so — the alternative (a one-way hash) was declined. Its
    #   store is erasure_log/{tenant}.json, outside every folder this walk visits.
    {"what": "The record that you asked us to erase",
     "why": "Your sign-in mobile number, the time you confirmed, and a count of what was "
            "removed — kept as evidence of the erasure itself. Nothing else."},
    # ★ 2026-08-27 — the consent ledger. Retained deliberately (founder), and therefore
    # named here: an erase that quietly leaves something behind is the one kind of
    # erasure receipt that is worse than none. Its store sits outside every {tenant}
    # folder this traversal walks (consent_repository_file.py), so this entry and that
    # placement must always agree, along with §G of the agreement itself.
    {"what": "Your acceptance of the User Agreement",
     "why": "The record that you read and accepted the agreement — your sign-in mobile "
            "number, its version, the date, which points you confirmed, and your "
            "browser's identification string — is kept as evidence of the agreement "
            "itself. It holds no teaching content, notes or profile details. It no "
            "longer applies from today: if you use Meyy again, you will be asked to "
            "read and accept the agreement afresh."},
    # ★ 2026-09-18 — the trial ledger (trial_ledger_file.py). Retained so the free trial stays
    #   once per number across an erasure; its store sits outside every folder this walk visits.
    #   Five places agree: this row, Privacy Notice §7, Agreement §C and §G, and that placement.
    {"what": "The record that this number has used its free trial",
     "why": "A keyed one-way code made from your mobile number (never the number itself) and "
            "how many trial chapters it used — kept for 24 months so the free trial stays "
            "once per number, then deleted. Nothing else."},
    {"what": "Shared lesson-plan library content",
     "why": "Lesson plans are Meyy's shared library, not personal data; your account "
            "held references to them, and those references are erased."},
]


# Grade slugs as they appear inside section keys ("{subjectSlug}_{gradeSlug}_{tag}").
_GRADE_SLUGS = {"iii", "iv", "v", "vi", "vii", "viii", "ix", "x"}


def _parse_section_key(key: str) -> Tuple[str, str, str]:
    """"the_world_around_us_iv_4A" → ("the_world_around_us", "iv", "4A"). The subject
    slug itself contains underscores, so parse from the RIGHT: last token is the
    section tag, the token before it must be a grade slug. Unparseable keys come back
    whole as the subject so nothing is ever dropped from an export."""
    toks = (key or "").split("_")
    if len(toks) >= 3 and toks[-2].lower() in _GRADE_SLUGS:
        return "_".join(toks[:-2]), toks[-2].lower(), toks[-1]
    return key or "", "", ""


def _chapter_num_from_file(filename: str) -> Optional[int]:
    """"ch_05_canonical.json" → 5 (the live shape); a bare "3" → 3 (older rows).
    None when neither form matches — the row still exports, chapter shown as "—"."""
    s = str(filename or "")
    m = re.match(r"ch_(\d+)", s)
    if m:
        return int(m.group(1))
    try:
        return int(s)
    except ValueError:
        return None


class DataRightsServiceFileImpl(DataRightsService):
    """File-backed export/erase traversal over the Bucket-B stores."""

    def __init__(self, data_dir: str,
                 chapter_title: Optional[Callable[[str, str, int], str]] = None):
        """
        Args:
            data_dir: Base directory holding the Bucket-B folders (e.g. ARUVI_STATE_DIR).
            chapter_title: optional resolver (subject_slug, grade_slug, chapter_number)
                → display title, injected by the API layer from the shared content
                store (Bucket A). The service itself never reads content — this seam
                keeps the Bucket split intact. Absent (tests, bare use), chapter
                titles simply render empty.
        """
        self.chapter_title = chapter_title
        # One backend (file or Postgres — Track C, 2026-09-09) shared by every store the
        # walk reads, so export and erase address exactly the documents the API wrote.
        self.backend = as_backend(data_dir)
        data_dir = self.backend
        self.accounts = AccountRepositoryFileImpl(data_dir)
        self.years = AcademicYearRepositoryFileImpl(data_dir)
        self.readiness = ReadinessRepositoryFileImpl(data_dir)
        self.allocations = AllocationRepositoryFileImpl(data_dir)
        self.sections = SectionStateRepositoryFileImpl(data_dir)
        # The teaching ledger — the ONLY record that a chapter was ever taught, since the
        # pointer above deletes its row when a chapter leaves the slot. An export without it
        # would show her only what she is teaching today and call that everything we hold.
        self.history = SectionHistoryRepositoryFileImpl(data_dir)
        self.archive = PlanArchiveRepositoryFileImpl(data_dir)
        self.prepared = PreparedPlansRepositoryFileImpl(data_dir)
        self.notes = PlanNoteRepositoryFileImpl(data_dir)
        # Support requests (2026-08-27) — her own words to us, so they export AND erase
        # like everything else here. Joined this traversal the day the store was born,
        # which is the rule the entitlement store had to learn the hard way.
        self.support = SupportRepositoryFileImpl(data_dir)
        # Not part of the destructive walk — erase() STAMPS this one (see the call site).
        self.consents = ConsentRepositoryFileImpl(data_dir)

    # ── the one traversal ─────────────────────────────────────────────────────────

    def _year_ids(self, tenant_id: str, user_id: str) -> List[str]:
        """Every year that exists for this identity: the opened years, plus any year
        folder present on disk under a teaching kind (belt-and-braces — data must
        never be invisible to its owner because a year record went missing)."""
        ids = [y.year_id for y in self.years.list_years(tenant_id, user_id)]
        for kind in _YEAR_KINDS:
            for name in self.backend.list_children(f"{kind}/{_slug(tenant_id)}/{_slug(user_id)}"):
                if name not in ids:
                    ids.append(name)
        return sorted(ids)

    def _allocation_registers(self, tenant_id: str, user_id: str,
                              year_id: str) -> Dict[str, Any]:
        """{"subject/grade": register} for one year — enumerated from the folder
        layout, loaded through the port."""
        out: Dict[str, Any] = {}
        base = f"allocations/{_slug(tenant_id)}/{_slug(user_id)}/{_slug(year_id)}"
        for key in self.backend.list_keys(base):
            rel = key[len(base) + 1:].split("/")
            if len(rel) != 3 or rel[2] != "allocation.json":
                continue
            subject, grade = rel[0], rel[1]
            reg = self.allocations.load_register(tenant_id, user_id, year_id, subject, grade)
            if reg:
                out[f"{subject}/{grade}"] = reg
        return out

    def _gather(self, tenant_id: str, user_id: str) -> Dict[str, Any]:
        """Everything this teacher owns, as one plain-dict payload."""
        acct = self.accounts.load(tenant_id, user_id)
        payload: Dict[str, Any] = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "account": asdict(acct) if acct else None,
            "profile": self.readiness.load_profile(tenant_id, user_id),
            # Not year-scoped: a support case belongs to the day it was raised, and an
            # export that hid the messages she sent us would not be a copy of everything
            # Aruvi holds about her.
            "support": [asdict(r) for r in self.support.load_all(tenant_id, user_id)],
            "years": [],
        }
        for year_id in self._year_ids(tenant_id, user_id):
            notes = self.notes.load_all(tenant_id, user_id, year_id)
            states = self.sections.load_all(tenant_id, user_id, year_id)
            history = self.history.load_all(tenant_id, user_id, year_id)
            payload["years"].append({
                "year_id": year_id,
                "notes": {k: {"text": n.text, "updated_at": n.updated_at,
                              "chapter_title": self._title_for_key(k)}
                          for k, n in notes.items()},
                "teaching": self._teaching_rows(states, history),
                # Raw stores ride along for completeness (the erase walk and any future
                # machine-readable export); the Word renderer shows the reader-facing
                # `teaching` rows instead — no filenames, no period internals (founder,
                # 2026-08-22).
                "allocations": self._allocation_registers(tenant_id, user_id, year_id),
                "section_state": states,
                "section_history": history,
                "prepared": self.prepared.load_all(tenant_id, user_id, year_id),
                "archived": self.archive.load_all(tenant_id, user_id, year_id),
            })
        return payload

    def _title_for_key(self, note_key: str) -> str:
        """Chapter display title for a note key "subject/grade/chapter" — via the
        injected content resolver; empty when unresolvable."""
        parts = (note_key or "").split("/")
        if self.chapter_title and len(parts) == 3:
            try:
                return self.chapter_title(parts[0], parts[1], int(parts[2])) or ""
            except (TypeError, ValueError):
                return ""
        return ""

    def _teaching_rows(self, states: Dict[str, Any],
                       history: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Reader-facing teaching-state rows, one per subject·grade·chapter, with the
        sections teaching it and each section's plain-words status. Deliberately free
        of filenames, canonical identities and period counts.

        `history` (the teaching ledger) is folded into the SAME rows, so the document reads
        as one account of the year rather than two tables the teacher has to reconcile — a
        chapter she finished in July and one she is teaching today are the same kind of fact
        about the same class. The CURRENT binding wins wherever both describe one
        section·chapter: the ledger is by definition the past, and only the pointer knows
        where she stands now."""
        grouped: Dict[Tuple[str, str, Optional[int]], Dict[str, Any]] = {}

        def row_for(subject: str, grade: str, num: Optional[int]) -> Dict[str, Any]:
            return grouped.setdefault((subject, grade, num), {
                "subject": subject, "grade": grade, "chapter_number": num,
                "chapter_title": (self.chapter_title(subject, grade, num) or ""
                                  if self.chapter_title and num else ""),
                "sections": [],
            })

        # The CURRENT bindings first, claiming their (section, chapter-file) pairs.
        # ★ Claimed by FILE, never by chapter number: the number is DERIVED here from the
        #   filename and a legacy row's shape can derive None, while the ledger carries the
        #   number the app stamped. Deduping on the number therefore missed — the same class
        #   on the same chapter landed in two different rows and the export said both "set
        #   aside" and "at Learning Unit 3" about it. The file is the identity; the number is
        #   a display value.
        claimed: set = set()
        for key in sorted(states):
            st = states[key] or {}
            subject, grade, tag = _parse_section_key(key)
            fname = st.get("chapter")
            num = _chapter_num_from_file(fname)
            if st.get("done"):
                status = "completed"
            elif st.get("unit_index") is None:
                status = "started"
            else:
                status = f"at Learning Unit {int(st['unit_index']) + 1}"
            row_for(subject, grade, num)["sections"].append(
                {"tag": tag or key, "status": status})
            claimed.add((key, str(fname or "")))

        # …then the ledger, for every section·chapter the present tense did not claim.
        for key in sorted(history or {}):
            subject, grade, tag = _parse_section_key(key)
            rows = (history or {}).get(key) or {}
            for fname in sorted(rows):
                if (key, str(fname)) in claimed:
                    continue                    # she is teaching it now; that reading wins
                h = rows.get(fname) or {}
                num = h.get("chapter_number")
                if num is None:
                    num = _chapter_num_from_file(fname)
                done_n, total_n = h.get("units_done"), h.get("total_units")
                if str(h.get("status")) == "completed":
                    status = "taught"
                elif done_n and total_n:
                    status = f"set aside after {int(done_n)} of {int(total_n)} learning units"
                elif done_n:
                    status = f"set aside after {int(done_n)} learning units"
                else:
                    status = "set aside"
                row_for(subject, grade, num)["sections"].append(
                    {"tag": tag or key, "status": status})
        return list(grouped.values())

    # ── export ────────────────────────────────────────────────────────────────────

    def export(self, tenant_id: str, user_id: str, fmt: str = "docx") -> bytes:
        """One document with everything she owns (never the shared library), as Word
        (default, editable) or PDF — the same payload through two renderers, so the
        two formats can never disagree on content. Lazy imports so a missing
        python-docx/xhtml2pdf breaks only this feature, with a clear message — the
        same posture as the allocation exporters."""
        payload = self._gather(tenant_id, user_id)
        fmt = (fmt or "docx").strip().lower()
        if fmt == "docx":
            from aruvi_core.export_data_rights_docx import build_export_docx
            return build_export_docx(payload)
        if fmt == "pdf":
            from aruvi_core.export_data_rights_pdf import export_data_rights_pdf
            return export_data_rights_pdf(payload)
        raise ValueError(f"Unknown export format {fmt!r} — use 'docx' or 'pdf'.")

    # ── erase ─────────────────────────────────────────────────────────────────────

    def _rm(self, prefix: str) -> bool:
        """Remove every document under a key prefix. On the file backend this is the
        folder plus a climb that removes each now-empty ancestor up to the store root —
        an empty folder named after her is still a remnant, while a school tenant with
        other teachers keeps its folder (non-empty, so the climb halts). On Postgres it
        is one DELETE by prefix. Returns whether anything was removed."""
        return self.backend.delete_prefix(prefix)

    def erase(self, tenant_id: str, user_id: str) -> ErasureReceipt:
        """Destroy everything export() reaches — teaching state per year, profile,
        year records, account record LAST — and name what was kept and why."""
        t, u = _slug(tenant_id), _slug(user_id)
        erased: List[str] = []
        label = {"plan_notes": "chapter notes", "section_state": "section progress",
                 "section_history": "chapters taught", "allocations": "period allocations",
                 "prepared_plans": "prepared plans", "plan_archive": "archived-plan flags"}
        year_ids = self._year_ids(tenant_id, user_id)
        for kind in _YEAR_KINDS:
            for year_id in year_ids:
                if self._rm(f"{kind}/{t}/{u}/{_slug(year_id)}"):
                    erased.append(f"{label[kind]} ({year_id})")
            self._rm(f"{kind}/{t}/{u}")   # any stray un-year-scoped leftovers
        if self._rm(f"readiness/{t}/{u}"):
            erased.append("teaching profile")
        # Support requests — hers, so they go. The reference SERIES is untouched: it
        # lives in support/_series/, which is not under any {tenant}/{user} path this
        # walk visits (support_repository_file.py), so the next teacher's reference
        # still follows the last one issued rather than repeating it.
        if self._rm(f"support/{t}/{u}"):
            erased.append("support messages")
        if self._rm(f"academic_years/{t}/{u}"):
            erased.append("academic-year records")
        # Subscription/entitlement record (Step 5, added to the walk 2026-08-24 — a new
        # Bucket-B store MUST join this traversal the day it is born, or an erased
        # teacher's trial counter survives her erasure). Tenant-keyed with no user
        # segment, so remove it ONLY for an individual (tenant == user): erasing one
        # teacher of a school must never destroy the school's subscription.
        if _slug(tenant_id) == _slug(user_id):
            if self._rm(f"entitlements/{t}"):
                erased.append("subscription record")
        # ★ The consent ledger is NOT walked — it is STAMPED (founder, 2026-08-27). Its
        #   rows survive (they are the proof the agreement was accepted, and _KEPT says
        #   so), but they stop being a standing signature: erasure ends the relationship
        #   they belonged to, so an id that returns signs afresh. Before this, a teacher
        #   who erased and came back walked past the agreement entirely — and a
        #   REASSIGNED mobile number would have done the same to a different person.
        #   Tenant-scoped like the entitlement above, and for the same reason: one
        #   teacher's erasure must not end a school's agreement.
        if _slug(tenant_id) == _slug(user_id):
            self.consents.supersede(tenant_id)
        # Account record LAST — identity must outlive its data during the walk.
        if self.accounts.load(tenant_id, user_id) is not None:
            self._rm(f"accounts/{t}/{u}")
            erased.append("account record")
        return ErasureReceipt(
            erased=erased,
            kept=[dict(k) for k in _KEPT] if erased else [],
            erased_at=datetime.now(timezone.utc).isoformat(),
        )
