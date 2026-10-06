"""The three-row re-acceptance rule (founder, 2026-10-06).

Each agreement version from v1.0 says, in a `> **Re-acceptance:**` line, what a teacher who
accepted an EARLIER version must do: `none` (carried over + an "updated" bar), a list of points
(re-confirm only those), or `all`. A version without the line counts as `all`.

These tests publish scratch versions in a TEMPORARY content root — never in the real one — and
walk a teacher through all three rows. Run: python3 tests/test_reacceptance.py
"""
from __future__ import annotations

import os
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.environ.setdefault("ARUVI_STATE_DIR", tempfile.mkdtemp(prefix="meyy-state-"))
os.environ.setdefault("ARUVI_ACCESS_LOG", "0")

from api import data, legal  # noqa: E402

REAL_LEGAL = os.path.join(ROOT, "data", "cloud", "content", "legal")
BASE = "1.0"


def _content_root():
    """A temp content root holding ONLY v1.0 of each document (copied from the real files)."""
    tmp = tempfile.mkdtemp(prefix="meyy-legal-")
    os.makedirs(os.path.join(tmp, "legal"))
    for name in (f"consent_and_disclaimer_v{BASE}.md", f"privacy_policy_v{BASE}.md"):
        shutil.copy(os.path.join(REAL_LEGAL, name), os.path.join(tmp, "legal", name))
    return tmp


def _publish(tmp, version, spec, retitle_point=None):
    """A scratch agreement version: v1.0's text with a new trigger line (and optionally one
    acknowledgement's title reworded, as a real 'changed point' would be)."""
    src = open(os.path.join(tmp, "legal", f"consent_and_disclaimer_v{BASE}.md"), encoding="utf-8").read()
    src = src.replace("> **Re-acceptance:** none", f"> **Re-acceptance:** {spec}" if spec else "> (no trigger line)")
    if retitle_point:
        src = src.replace(f"### ☐ {retitle_point}. ", f"### ☐ {retitle_point}. (reworded) ", 1)
    with open(os.path.join(tmp, "legal", f"consent_and_disclaimer_v{version}.md"), "w", encoding="utf-8") as f:
        f.write(src)
    legal._cache.clear()


def _sign(c, h, ids=None, final=True):
    doc = c.get("/legal/consent", headers=h).json()["document"]
    return c.post("/legal/consent", headers=h, json={
        "version": doc["version"], "final": final,
        "acknowledgements": ids if ids is not None else [a["id"] for a in doc["acknowledgements"]]})


def test_parser_reads_the_trigger_line():
    tmp = _content_root()
    real, data.DATA_DIR = data.DATA_DIR, tmp
    try:
        legal._cache.clear()
        assert legal.reacceptance(BASE) == set(), "v1.0 is published with `none`"
        _publish(tmp, "1.1", "3, final")
        assert legal.reacceptance("1.1") == {"ack3", "final"}
        _publish(tmp, "1.2", "all")
        assert legal.reacceptance("1.2") == legal.ALL
        _publish(tmp, "1.3", "")
        assert legal.reacceptance("1.3") == legal.ALL, "no line = all (every pre-v1.0 draft)"
        assert legal.required_since("1.0", "1.1") == {"ack3", "final"}
        assert legal.required_since("1.0", "1.3") == legal.ALL
    finally:
        data.DATA_DIR = real
        legal._cache.clear()
    print("✓ The Re-acceptance line parses: none · points · all · missing = all")


def test_three_rows_end_to_end():
    from fastapi.testclient import TestClient
    import api.main as m
    tmp = _content_root()
    real, data.DATA_DIR = data.DATA_DIR, tmp
    legal._cache.clear()
    try:
        c = TestClient(m.app)
        h = {"X-Aruvi-User": "9000000777"}
        c.get("/account", headers=h)                              # JIT the account
        assert _sign(c, h).status_code == 200
        s = c.get("/legal/consent/status", headers=h).json()
        assert s["accepted"] and not s["carried"] and s["reaccept"] == []

        # ROW 1 — housekeeping: carried over, the bar shows once, checkout is open
        _publish(tmp, "1.1", "none")
        s = c.get("/legal/consent/status", headers=h).json()
        assert s["accepted"] and s["carried"] and s["updated"] and s["accepted_version"] == BASE, s
        assert not m._consent_outstanding("9000000777")
        assert c.get("/legal/consent", headers=h).json()["document"]["version"] == "1.1", \
            "a carried acceptance reads the CURRENT text"
        assert c.post("/legal/consent/seen", headers=h, json={"context": "test"}).status_code == 200
        assert c.get("/legal/consent/status", headers=h).json()["updated"] is False, "bar once only"

        # ROW 2 — one point changed: only point 3 (and the final tick) are asked again
        _publish(tmp, "1.2", "3, final", retitle_point=3)
        s = c.get("/legal/consent/status", headers=h).json()
        assert not s["accepted"] and s["reaccept"] == ["ack3", "final"] and s["prior_version"] == BASE, s
        assert m._consent_outstanding("9000000777"), "checkout waits for the re-confirmation"
        assert _sign(c, h, ids=["ack1"], final=True).status_code == 400, "point 3 is owed"
        assert _sign(c, h, ids=["ack3"], final=False).status_code == 400, "the final tick is owed"
        assert _sign(c, h, ids=["ack3"], final=True).status_code == 200
        rows = [r for r in m.consent_repo.load_all("9000000777") if r.document_version == "1.2"]
        assert len(rows) == 1 and rows[0].context == "reconfirm"
        first = [r for r in m.consent_repo.load_all("9000000777") if r.document_version == BASE][0]
        assert rows[0].acknowledgements["ack1"] == first.acknowledgements["ack1"], \
            "an unasked point keeps the moment she first confirmed it"
        assert rows[0].acknowledgements["ack3"] != first.acknowledgements["ack3"]
        assert c.get("/legal/consent/status", headers=h).json()["accepted"]

        # ROW 3 — everything: all five and the final tick again
        _publish(tmp, "1.3", "all")
        s = c.get("/legal/consent/status", headers=h).json()
        assert not s["accepted"] and s["reaccept"] == ["ack1", "ack2", "ack3", "ack4", "ack5", "final"]
        assert _sign(c, h, ids=["ack3"], final=True).status_code == 400
        assert _sign(c, h).status_code == 200

        # A NEW teacher always signs in full, whatever the trigger line says
        _publish(tmp, "1.4", "none")
        n = {"X-Aruvi-User": "9000000778"}
        c.get("/account", headers=n)
        s = c.get("/legal/consent/status", headers=n).json()
        assert not s["accepted"] and len(s["reaccept"]) == 6
        assert _sign(c, n, ids=["ack1"]).status_code == 400
    finally:
        data.DATA_DIR = real
        legal._cache.clear()
    print("✓ Three rows: carried + bar · only the changed points · everything; new users sign in full")


def test_pre_launch_privacy_drafts_are_not_served():
    from fastapi.testclient import TestClient
    import api.main as m
    legal._privacy_cache.clear()
    c = TestClient(m.app)
    r = c.get("/legal/privacy")
    assert r.status_code == 200 and r.json()["current_version"] >= BASE
    assert all(legal._version_key(v) >= legal._version_key("1.0") for v in r.json()["versions"])
    for v in ("0.1", "0.4", "0.6"):
        r = c.get("/legal/privacy", params={"version": v})
        assert r.status_code == 404 and "support@meyy.in" in r.json()["detail"], (v, r.text)
    assert "Radhakrishnan" not in c.get("/legal/privacy").json()["document"]["body"]
    print("✓ The pre-launch privacy drafts are not served; earlier versions on request")


def test_lawyer_notes_never_reach_a_teacher():
    """Everything between a published document's title and its first `---` is a note to the
    lawyer and must be a `>` line, or the app shows it as the opening paragraph (found live,
    2026-10-06: six note lines lost their `>` and topped the Privacy Notice)."""
    for v, name in ((legal.current_version(), "consent_and_disclaimer"),
                    (legal.current_privacy_version(), "privacy_policy")):
        lines = open(os.path.join(REAL_LEGAL, f"{name}_v{v}.md"), encoding="utf-8").read().split("\n")
        end = lines.index("---")
        stray = [ln for ln in lines[1:end] if ln.strip() and not ln.lstrip().startswith(">")]
        assert not stray, f"{name} v{v}: lawyer-note lines without '>': {stray[:2]}"
    body = legal.load_privacy_document()["body"]
    assert body.lstrip().startswith("## The short version"), body[:120]
    for leak in ("api/", "packages/", ".py", "What changed in"):
        assert leak not in body, f"a note leaked into the notice: {leak!r}"
    intro = legal.load_consent_document()["intro"]
    for leak in ("Re-acceptance", "api/", "What changed"):
        assert leak not in intro, f"a note leaked into the agreement: {leak!r}"
    print("✓ Lawyer notes stay hidden in both published documents")


if __name__ == "__main__":
    test_parser_reads_the_trigger_line()
    test_three_rows_end_to_end()
    test_pre_launch_privacy_drafts_are_not_served()
    test_lawyer_notes_never_reach_a_teacher()
    print("✅ re-acceptance tests passed")
