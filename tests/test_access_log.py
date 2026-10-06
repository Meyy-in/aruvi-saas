"""The one-year access log (api/access_log.py) — Privacy Notice v0.5 §2/§7.

Pins the two promises: a line can never carry a sign-in identifier (route PATTERNS only, no
query string, digits masked on unmatched paths), and day files older than the retention are
deleted. Run: python3 tests/test_access_log.py
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_LOGS = tempfile.mkdtemp(prefix="meyy-access-")
os.environ["ARUVI_ACCESS_LOG_DIR"] = _LOGS
os.environ.setdefault("ARUVI_STATE_DIR", tempfile.mkdtemp(prefix="meyy-state-"))


def _lines():
    out = []
    for p in sorted(Path(_LOGS).glob("access-*.log")):
        out += p.read_text(encoding="utf-8").splitlines()
    return out


def test_lines_hold_patterns_never_identifiers():
    from fastapi.testclient import TestClient
    import api.main as m
    c = TestClient(m.app)
    mobile = "9876501234"
    c.post("/onboarding/known", json={"id": mobile})
    c.get("/onboarding/known", params={"id": mobile})                 # the old form, still answered
    c.get(f"/support-inbox/api/thread/{mobile}~MEY-W-1234")             # an id in a path
    c.get(f"/no/such/{mobile}/page?id={mobile}")                         # nothing answers this
    c.options("/plans/science/ix", headers={"Origin": "https://app.meyy.in",
                                            "Access-Control-Request-Method": "GET"})
    lines = _lines()
    assert len(lines) >= 5, lines
    for ln in lines:
        assert mobile not in ln and "?" not in ln.split("\t")[3], ln
        assert len(ln.split("\t")) == 6, ln
    joined = "\n".join(lines)
    assert "\t/onboarding/known\t" in joined
    assert "\t/support-inbox/api/thread/{ident}\t" in joined
    assert "\t!/no/such/#/page\t" in joined
    assert "\tOPTIONS\t/plans/{subject}/{grade}\t" in joined
    print("✓ Access-log lines hold route patterns — no mobile, no query string")


def test_old_day_files_are_deleted():
    from api.access_log import AccessLog
    d = Path(tempfile.mkdtemp(prefix="meyy-purge-"))
    for day in ("2025-01-01", "2025-10-05", "2025-10-06", "2026-10-06"):
        (d / f"access-{day}.log").write_text("x\n")
    (d / "notes.txt").write_text("not a log")
    log = AccessLog(app=None, log_dir=str(d), keep_days=365)
    gone = log.purge(today="2026-10-06")
    left = sorted(p.name for p in d.iterdir())
    assert gone == 2, (gone, left)
    assert left == ["access-2025-10-06.log", "access-2026-10-06.log", "notes.txt"], left
    print("✓ Day files older than a year are deleted; the year itself is kept")


if __name__ == "__main__":
    test_lines_hold_patterns_never_identifiers()
    test_old_day_files_are_deleted()
    print("✅ access log tests passed")
