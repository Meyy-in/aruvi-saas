"""SupportRepository over the document backend (file or Postgres — Track C, 2026-09-09).

Layout, under ARUVI_STATE_DIR:

    support/{tenant}/{user}/ARV-S-742.json     the request, as she wrote it
    support/_series/support.json               the reference counter

The two placements are deliberate and opposite:

**The request is HERS.** It is her words, filed under her identity, so the erase
traversal reaches it by folder boundary like every other Bucket-B store, and the data
export renders it. A teacher who asks for everything Aruvi holds about her and is not
shown the messages she sent has not been shown everything.

**The counter is the SELLER'S.** It sits in `support/_series/`, outside any tenant
folder — the invoice-series precedent (`_slug` strips the leading underscore, so no
tenant can ever collide with it). If it lived inside a teacher's folder her erasure
would take it with her and the next teacher would be handed a reference already in use.
The counter holds one integer and nothing about anybody.

References are short on purpose: they are quoted in email subject lines and read aloud.
No financial year, no zero padding — a case belongs to the day it was raised, not to a
book that has to balance, and 742 → 1000 is a counter growing, not a format breaking.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import List

from aruvi_core.ports import SupportRepository, SupportRequest
from aruvi_core.adapters.document_backend import as_backend, slug as _slug




def reference_to_file(reference: str) -> str:
    """Guard a hand-passed reference into a filename ("ARV-S-742")."""
    return _slug(str(reference).replace("/", "-"))


class SupportRepositoryFileImpl(SupportRepository):
    """Per-teacher support store plus the shared reference series."""

    def __init__(self, data_dir: str, prefix: str = "MEY-S", start: int = 742):
        """
        Args:
            data_dir: ARUVI_STATE_DIR — the support/ folder lives here.
            prefix:   the reference prefix ("MEY-S-742"; ARV-S until 2026-09-03).
            start:    ★ the FIRST reference ever issued (founder, 2026-08-27). Not 1.
                      A reference number is the one part of an acknowledgement a teacher
                      can read volume from, and "ARV-S-1" tells her she is the first
                      person who ever needed help — which is true, briefly, and does
                      nothing for her confidence that anyone is on the other end. Three
                      digits says nothing either way. An OFFSET, not a fiction: the
                      series is gapless and counts real cases, so it stays auditable;
                      the only thing hidden is where the count began.
        """
        self.backend = as_backend(data_dir)
        self.prefix = (prefix or "MEY-S").strip() or "MEY-S"
        self.start = int(start)

    # ── keys ──
    def _prefix(self, tenant_id: str, user_id: str) -> str:
        return f"support/{_slug(tenant_id)}/{_slug(user_id)}"

    # ── numbering ──
    def next_reference(self) -> str:
        """Next in the gapless series, under the backend's per-document lock — a process
        lock on files, a transaction-scoped advisory lock on Postgres (the "sequence or
        row lock" the file version said the DB adapter must bring). A duplicated
        reference is worse here than in most places: two teachers quoting the same
        number in two threads is a support system quietly lying to both of them."""
        key = "support/_series/support.json"
        with self.backend.lock(key):
            raw = self.backend.get_json(key)
            try:
                n = int((raw or {}).get("last", 0)) if isinstance(raw, dict) else 0
            except (TypeError, ValueError):
                n = 0
            # `start` is the FLOOR, not just the seed: a corrupt or missing counter can
            # only ever restart the series, never rewind past a reference already given
            # to somebody.
            n = max(n + 1, self.start)
            self.backend.put_json(key, {"last": n})
        return f"{self.prefix}-{n}"

    # ── read / write ──
    def save(self, request: SupportRequest) -> None:
        self.backend.put_json(
            f"{self._prefix(request.tenant_id, request.user_id)}/{reference_to_file(request.reference)}.json",
            asdict(request))

    def load_all(self, tenant_id: str, user_id: str) -> List[SupportRequest]:
        """Every request for this teacher, NEWEST FIRST (by creation time, then
        reference — the reference breaks ties within a same-second double send)."""
        base = self._prefix(tenant_id, user_id)
        out: List[SupportRequest] = []
        for key in self.backend.list_keys(base):
            if not key.endswith(".json") or "/" in key[len(base) + 1:]:
                continue
            raw = self.backend.get_json(key)
            if not isinstance(raw, dict):
                continue          # one unreadable request must not hide the others
            fields = {k: v for k, v in raw.items()
                      if k in SupportRequest.__dataclass_fields__}
            fields.setdefault("reference", key.rsplit("/", 1)[-1][:-5])
            fields.setdefault("tenant_id", tenant_id)
            fields.setdefault("user_id", user_id)
            fields.setdefault("category", "")
            fields.setdefault("message", "")
            out.append(SupportRequest(**fields))
        out.sort(key=lambda r: (r.created_at, r.reference), reverse=True)
        return out

    def _from_raw(self, raw: dict, key: str, tenant_id: str, user_id: str) -> SupportRequest:
        fields = {k: v for k, v in raw.items() if k in SupportRequest.__dataclass_fields__}
        fields.setdefault("reference", key.rsplit("/", 1)[-1][:-5])
        fields.setdefault("tenant_id", tenant_id)
        fields.setdefault("user_id", user_id)
        fields.setdefault("category", "")
        fields.setdefault("message", "")
        return SupportRequest(**fields)

    def load_everyone(self) -> List[SupportRequest]:
        """Every case from every teacher, newest first — the Support inbox's email column
        (2026-10-03). Only the founder's inbox reads this; nothing a teacher can reach does.
        The seller's counter (support/_series) is skipped by its leading underscore."""
        out: List[SupportRequest] = []
        for key in self.backend.list_keys("support"):
            parts = key.split("/")
            if len(parts) != 4 or parts[1].startswith("_") or not key.endswith(".json"):
                continue
            raw = self.backend.get_json(key)
            if isinstance(raw, dict):
                out.append(self._from_raw(raw, key, parts[1], parts[2]))
        out.sort(key=lambda r: (r.created_at, r.reference), reverse=True)
        return out

    def find(self, reference: str):
        """One case by its reference, from anyone, or None."""
        want = str(reference or "").strip().upper()
        for r in self.load_everyone():
            if r.reference.upper() == want:
                return r
        return None
