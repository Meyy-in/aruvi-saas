"""AcademicYearRepository over the document backend (file or Postgres — Track C, 2026-09-09).

Persists a teacher's academic years as one JSON document at key
academic_years/{tenant_id}/{user_id}/years.json, shaped as

    {"years": [{year_id, starts_on, ends_on, is_current}, ...], "updated_at": iso}

This is administrative_architecture.md Step 1's reference adapter. The year list is
per-teacher because schools start at different times (CBSE Apr–Mar, several state
boards Jun–May) — Aruvi's d-date and the teacher's own cutover are different events
(§2.1). Exactly one year is current at a time; open_year/set_current maintain that
invariant. The API layer bootstraps a default year on first touch — this adapter never
invents one.

Step 2 (cutover) extends the port with close_year() against this same file; nothing
here anticipates it.
"""
from dataclasses import asdict
from datetime import datetime, timezone
from typing import List, Optional

from aruvi_core.ports import AcademicYear, AcademicYearRepository
from aruvi_core.adapters.document_backend import as_backend, slug as _slug


class AcademicYearRepositoryFileImpl(AcademicYearRepository):
    """Academic-year store over a document backend."""

    def __init__(self, data_dir):
        """
        Args:
            data_dir: a DocumentBackend, or a directory (→ FileBackend, e.g. ARUVI_STATE_DIR).
        """
        self.backend = as_backend(data_dir)

    def _key(self, tenant_id: str, user_id: str) -> str:
        return f"academic_years/{_slug(tenant_id)}/{_slug(user_id)}/years.json"

    def _read(self, tenant_id: str, user_id: str) -> List[AcademicYear]:
        raw = self.backend.get_json(self._key(tenant_id, user_id)) or {}
        if not isinstance(raw, dict):
            raw = {}
        out: List[AcademicYear] = []
        for y in raw.get("years", []):
            out.append(AcademicYear(
                year_id=str(y.get("year_id", "")),
                starts_on=str(y.get("starts_on", "")),
                ends_on=str(y.get("ends_on", "")),
                is_current=bool(y.get("is_current", False)),
                cleanup_pending=bool(y.get("cleanup_pending", False)),
                fresh_started_at=str(y.get("fresh_started_at", "") or ""),
            ))
        return out

    def _write(self, tenant_id: str, user_id: str, years: List[AcademicYear]) -> None:
        record = {
            "years": [asdict(y) for y in years],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self.backend.put_json(self._key(tenant_id, user_id), record)

    def current(self, tenant_id: str, user_id: str) -> Optional[AcademicYear]:
        """The teacher's current academic year, or None if none has been opened yet."""
        for y in self._read(tenant_id, user_id):
            if y.is_current:
                return y
        return None

    def list_years(self, tenant_id: str, user_id: str) -> List[AcademicYear]:
        """All years ever opened for this teacher, oldest first (by starts_on, then
        year_id, so a missing date cannot scramble the order). Empty list if none."""
        return sorted(self._read(tenant_id, user_id),
                      key=lambda y: (y.starts_on, y.year_id))

    def open_year(self, tenant_id: str, user_id: str, year: AcademicYear) -> None:
        """Add a year (idempotent on year_id — re-opening updates in place). If the year
        is marked current, every other year's is_current is cleared."""
        years = self._read(tenant_id, user_id)
        replaced = False
        for i, y in enumerate(years):
            if y.year_id == year.year_id:
                years[i] = year
                replaced = True
                break
        if not replaced:
            years.append(year)
        if year.is_current:
            for y in years:
                if y.year_id != year.year_id:
                    y.is_current = False
        self._write(tenant_id, user_id, years)

    def set_current(self, tenant_id: str, user_id: str, year_id: str) -> None:
        """Mark one existing year current (clearing the others). Raises ValueError if
        the year_id has never been opened — callers open before they point."""
        years = self._read(tenant_id, user_id)
        if not any(y.year_id == year_id for y in years):
            raise ValueError(f"Academic year {year_id!r} has never been opened for "
                             f"{_slug(tenant_id)}/{_slug(user_id)}")
        for y in years:
            y.is_current = (y.year_id == year_id)
        self._write(tenant_id, user_id, years)
