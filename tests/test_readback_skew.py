"""TEST-ONLY read-back skew (walk row X.02). Off by default; for a listed mobile, the GET
/readiness right after its own POST reports periods-a-week +1 on the first class, and the
stored record is untouched."""
from __future__ import annotations

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ARUVI_STATE_DIR", tempfile.mkdtemp(prefix="aruvi-test-state-"))

from fastapi.testclient import TestClient  # noqa: E402
from api import config, main as api_main  # noqa: E402

SUBS = [{"name": "Science", "durations": [40],
         "grades": [{"grade": "VI", "sections": [{"tag": "6A", "sec": "A"}], "periods_per_week": 6}]}]


def _client(user, phone):
    c = TestClient(api_main.app, raise_server_exceptions=False)
    h = {"X-Aruvi-User": user}
    assert c.get("/readiness", headers=h).status_code == 200      # JIT-creates the account
    acct = api_main.account_repo.load(user, user)
    acct.phone = phone
    api_main.account_repo.save(acct)
    return c, h


def _ppw(c, h):
    return c.get("/readiness", headers=h).json()["readiness"]["subjects"][0]["grades"][0]["periods_per_week"]


def test_off_by_default():
    config.TEST_READBACK_SKEW = set()
    c, h = _client("skew-off", "+919000000026")
    assert c.post("/readiness", json={"subjects": SUBS}, headers=h).status_code == 200
    assert _ppw(c, h) == 6


def test_listed_number_reads_back_skewed_and_store_is_untouched():
    config.TEST_READBACK_SKEW = {"9000000026"}
    try:
        c, h = _client("skew-on", "+919000000026")
        assert c.post("/readiness", json={"subjects": SUBS}, headers=h).status_code == 200
        assert _ppw(c, h) == 7
        stored = api_main.readiness_repo.load_profile("skew-on", "skew-on")
        assert stored["subjects"][0]["grades"][0]["periods_per_week"] == 6
        api_main._last_readiness_post.clear()                # window over → the truth again
        assert _ppw(c, h) == 6
    finally:
        config.TEST_READBACK_SKEW = set()


def test_unlisted_number_is_never_skewed():
    config.TEST_READBACK_SKEW = {"9000000026"}
    try:
        c, h = _client("skew-other", "+919000000003")
        c.post("/readiness", json={"subjects": SUBS}, headers=h)
        assert _ppw(c, h) == 6
    finally:
        config.TEST_READBACK_SKEW = set()


if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
