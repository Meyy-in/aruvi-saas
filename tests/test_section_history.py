"""
Tests for the section chapter-HISTORY store — the teaching ledger, moved off the browser
(2026-09-07). It was the last piece of teaching state living in localStorage alone, so a
teacher on a phone and a laptop agreed about everything except what her classes had
actually been taught (docs/mobile_migration_assessment.md §4).

Pinned here on purpose — each of these is a decision, not an implementation detail:

  * writes MERGE, they do not replace. This is the one deliberate difference from
    SectionStateRepository and the whole reason the store is safe to write from two
    devices; a snapshot write would let the phone delete the laptop's rows.
  * latest `ts` wins, and a TIE keeps the stored row — so replaying a push is a true
    no-op (an offline device draining its queue cannot churn the file).
  * a malformed `ts` LOSES. A merge may not destroy what it cannot prove is stale.
  * untrack does not reach this store, but a SECTION leaving the profile does
    (delete_section) — otherwise re-adding the same tag inherits a phantom trail.
  * the ledger is in the data-rights export, and erase reaches it. It is the ONLY record
    that a chapter was ever taught (the pointer deletes its row when a chapter leaves the
    slot), so an export without it would show her today's classes and call that everything.
  * the export folds history into the SAME teaching rows as the pointer, and the CURRENT
    binding wins — one class must not appear twice as "taught" and "at unit 3".

Run standalone:  python3 tests/test_section_history.py     (also pytest-compatible)
"""
from __future__ import annotations

import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from aruvi_core.adapters.section_history_repository_file import (  # noqa: E402
    SectionHistoryRepositoryFileImpl,
)

T, U, Y = "Kumar1", "Kumar1", "2026-27"
SK = "science_vii_7A"


def _repo(tmp):
    return SectionHistoryRepositoryFileImpl(tmp)


def _entry(fname, status="completed", ts=1000, **kw):
    row = {"file": fname, "status": status, "ts": ts,
           "chapter_number": kw.get("chapter_number", 4),
           "chapter_title": kw.get("chapter_title", "Heat"),
           "units_done": kw.get("units_done", 10),
           "total_units": kw.get("total_units", 10)}
    return row


# ── the merge contract ────────────────────────────────────────────────────────────

def test_record_stores_and_load_all_returns_the_ledger():
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        r = _repo(tmp)
        assert r.load_all(T, U, Y) == {}, "a teacher who has taught nothing has no ledger"
        r.record(T, U, Y, SK, [_entry("ch4.json")])
        got = r.load_all(T, U, Y)
        assert list(got) == [SK]
        assert got[SK]["ch4.json"]["chapter_title"] == "Heat"
        assert got[SK]["ch4.json"]["status"] == "completed"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_second_device_adds_rows_it_does_not_replace_them():
    """THE POINT OF THE STORE. The laptop recorded ch 4; the phone, which has never seen
    that row, records ch 5. Both must survive — a snapshot write would lose ch 4."""
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        r = _repo(tmp)
        r.record(T, U, Y, SK, [_entry("ch4.json", ts=1000)])
        r.record(T, U, Y, SK, [_entry("ch5.json", ts=2000, chapter_number=5)])
        rows = r.load_all(T, U, Y)[SK]
        assert set(rows) == {"ch4.json", "ch5.json"}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_newer_ts_wins_and_older_is_ignored():
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        r = _repo(tmp)
        r.record(T, U, Y, SK, [_entry("ch4.json", status="untracked", ts=1000, units_done=2)])
        r.record(T, U, Y, SK, [_entry("ch4.json", status="completed", ts=2000)])
        assert r.load_all(T, U, Y)[SK]["ch4.json"]["status"] == "completed"
        # …and a STALE push (an offline device draining its queue) cannot undo it.
        r.record(T, U, Y, SK, [_entry("ch4.json", status="untracked", ts=1500, units_done=2)])
        assert r.load_all(T, U, Y)[SK]["ch4.json"]["status"] == "completed", \
            "a stale push overwrote a newer row — the merge order is not being honoured"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_replaying_the_same_push_changes_nothing():
    """A tie keeps the stored row, so a retry is a no-op rather than a rewrite. This is what
    lets the client push fire-and-forget and retry freely."""
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        r = _repo(tmp)
        r.record(T, U, Y, SK, [_entry("ch4.json", ts=1000)])
        before = r.load_all(T, U, Y)
        r.record(T, U, Y, SK, [_entry("ch4.json", ts=1000)])
        assert r.load_all(T, U, Y) == before
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_malformed_ts_loses_rather_than_destroying_a_good_row():
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        r = _repo(tmp)
        r.record(T, U, Y, SK, [_entry("ch4.json", status="completed", ts=5000)])
        bad = _entry("ch4.json", status="untracked", units_done=1)
        bad["ts"] = "not-a-number"
        r.record(T, U, Y, SK, [bad])
        assert r.load_all(T, U, Y)[SK]["ch4.json"]["status"] == "completed"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_rows_without_a_file_or_status_are_skipped():
    """A row with no chapter identity has nowhere to live and would accumulate under an
    empty key; a row with no status says nothing."""
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        r = _repo(tmp)
        r.record(T, U, Y, SK, [{"file": "", "status": "completed", "ts": 1},
                               {"file": "ch4.json", "status": "", "ts": 1},
                               "not-a-dict"])
        assert r.load_all(T, U, Y) == {}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_sections_years_and_tenants_are_isolated():
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        r = _repo(tmp)
        r.record(T, U, Y, SK, [_entry("ch4.json")])
        r.record(T, U, Y, "science_vii_7B", [_entry("ch9.json", chapter_number=9)])
        r.record(T, U, "2027-28", SK, [_entry("ch1.json", chapter_number=1)])
        r.record("Other", "Other", Y, SK, [_entry("ch7.json", chapter_number=7)])
        this_year = r.load_all(T, U, Y)
        assert set(this_year) == {SK, "science_vii_7B"}
        assert set(this_year[SK]) == {"ch4.json"}
        assert set(r.load_all(T, U, "2027-28")[SK]) == {"ch1.json"}
        assert set(r.load_all("Other", "Other", Y)[SK]) == {"ch7.json"}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── deletion: the two acts that reach this store, and the one that must not ────────

def test_delete_section_drops_only_that_section():
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        r = _repo(tmp)
        r.record(T, U, Y, SK, [_entry("ch4.json")])
        r.record(T, U, Y, "science_vii_7B", [_entry("ch9.json")])
        r.delete_section(T, U, Y, SK)
        assert set(r.load_all(T, U, Y)) == {"science_vii_7B"}
        r.delete_section(T, U, Y, SK)          # idempotent
        assert set(r.load_all(T, U, Y)) == {"science_vii_7B"}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_clear_all_empties_the_year_and_leaves_others_alone():
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        r = _repo(tmp)
        r.record(T, U, Y, SK, [_entry("ch4.json")])
        r.record(T, U, "2027-28", SK, [_entry("ch1.json")])
        r.clear_all(T, U, Y)
        assert r.load_all(T, U, Y) == {}
        assert r.load_all(T, U, "2027-28") != {}
        r.clear_all(T, U, Y)                    # idempotent
        assert r.load_all(T, U, Y) == {}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_the_port_has_no_per_entry_delete():
    """UNTRACK MUST NOT REACH THIS STORE. sectionHistory.js: "untracking a chapter must not
    erase the record that it was once taught." The absence of a per-entry delete is what
    makes that structural rather than a convention someone can forget."""
    from aruvi_core.ports import SectionHistoryRepository
    names = {n for n in dir(SectionHistoryRepository) if not n.startswith("_")}
    assert "delete_entry" not in names and "delete_one" not in names, \
        "a per-entry delete would let untrack erase a chapter's teaching record"


def test_a_torn_file_still_returns_the_real_ledger():
    """The section-state adapter's self-heal, here: returning {} on a damaged file is what
    lets corruption look like "she has taught nothing"."""
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        r = _repo(tmp)
        r.record(T, U, Y, SK, [_entry("ch4.json")])
        path = r._path(T, U, Y)
        with open(path, "r") as f:
            good = f.read()
        with open(path, "w") as f:
            f.write(good + "}\n")               # the classic stray trailing brace
        assert set(r.load_all(T, U, Y)[SK]) == {"ch4.json"}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── the export / erase traversal ──────────────────────────────────────────────────

def test_the_ledger_is_exported_and_erased():
    """It is the only record that a chapter was ever taught, so it must be in the export;
    and everything in the export must be reachable by erase."""
    from aruvi_core.adapters.data_rights_service_file import DataRightsServiceFileImpl
    from aruvi_core.adapters.account_repository_file import AccountRepositoryFileImpl
    from aruvi_core.adapters.academic_year_repository_file import (
        AcademicYearRepositoryFileImpl,
    )
    from aruvi_core.ports import Account, AcademicYear

    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        AccountRepositoryFileImpl(tmp).save(
            Account(account_id=U, tenant_id=T, display_name="Kumar"))
        AcademicYearRepositoryFileImpl(tmp).open_year(
            T, U, AcademicYear(year_id=Y, starts_on="2026-04-01",
                               ends_on="2027-03-31", is_current=True))
        _repo(tmp).record(T, U, Y, SK, [_entry("ch4.json", chapter_title="Heat")])

        svc = DataRightsServiceFileImpl(tmp)
        payload = svc._gather(T, U)
        year = next(y for y in payload["years"] if y["year_id"] == Y)
        assert year["section_history"][SK]["ch4.json"]["chapter_title"] == "Heat"
        taught = [s for row in year["teaching"] for s in row["sections"]]
        assert any(s["status"] == "taught" for s in taught), \
            "a completed chapter must read as taught in the export's teaching rows"

        receipt = svc.erase(T, U)
        assert any("chapters taught" in item for item in receipt.erased), \
            "the ledger must be named in the erasure receipt"
        assert _repo(tmp).load_all(T, U, Y) == {}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_the_current_binding_wins_over_the_ledger_in_the_export():
    """A section re-teaching a chapter it once set aside must appear ONCE, as where she
    stands now — not twice, "set aside" beside "at Learning Unit 3"."""
    from aruvi_core.adapters.data_rights_service_file import DataRightsServiceFileImpl
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        svc = DataRightsServiceFileImpl(tmp)
        states = {SK: {"chapter": "science_vii_ch4_x.json", "unit_index": 2, "done": False}}
        history = {SK: {"science_vii_ch4_x.json": _entry(
            "science_vii_ch4_x.json", status="untracked", units_done=2, total_units=10)}}
        rows = svc._teaching_rows(states, history)
        secs = [s for r in rows for s in r["sections"] if s["tag"] == "7A"]
        assert len(secs) == 1, f"the class appears {len(secs)} times, expected once"
        assert secs[0]["status"] == "at Learning Unit 3"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_set_aside_chapter_reads_in_plain_words():
    from aruvi_core.adapters.data_rights_service_file import DataRightsServiceFileImpl
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        svc = DataRightsServiceFileImpl(tmp)
        history = {SK: {"science_vii_ch9_x.json": _entry(
            "science_vii_ch9_x.json", status="untracked", units_done=2, total_units=10)}}
        rows = svc._teaching_rows({}, history)
        statuses = [s["status"] for r in rows for s in r["sections"]]
        assert statuses == ["set aside after 2 of 10 learning units"], statuses
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_teaching_rows_still_work_with_no_history_argument():
    """Back-compat: the second parameter is optional, so any existing caller is unaffected."""
    from aruvi_core.adapters.data_rights_service_file import DataRightsServiceFileImpl
    tmp = tempfile.mkdtemp(prefix="aruvi-hist-")
    try:
        svc = DataRightsServiceFileImpl(tmp)
        rows = svc._teaching_rows({SK: {"chapter": "science_vii_ch4_x.json",
                                        "unit_index": None, "done": True}})
        assert [s["status"] for r in rows for s in r["sections"]] == ["completed"]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── the client mirrors the server's merge rule ────────────────────────────────────

def test_the_client_merge_rule_matches_the_servers():
    """`tsOf` in sectionHistory.js and `_ts_of` in the adapter decide the SAME comparison on
    two sides of the wire. If one treats a malformed ts as 0 and the other as newest, the
    two sides disagree about which write won. Pinned by reading the source, because there
    is no way to import one into the other."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # The logic moved to the shared package in Track D step 1; web/app/lib only re-exports it.
    js = open(os.path.join(root, "packages/shared/src/sectionHistory.js")).read()
    assert "function tsOf" in js, "the client lost its merge-order helper"
    assert "Number.isFinite(n) ? n : 0" in js, \
        "the client no longer treats an unparseable ts as 0 — the server still does"
    # …and the client must never push a whole-map replace: the union is the safety property.
    assert "pullSectionHistory" in js and "owed" in js, \
        "the reconcile no longer pushes back rows the server is missing"


def _run():
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"  ✓ {fn.__name__}")
        except Exception as e:                  # noqa: BLE001
            failed += 1
            print(f"  ✗ {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(_run())
