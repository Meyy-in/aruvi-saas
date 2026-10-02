"""TEST-ONLY cutover switch (config.TEST_CUTOVER). A listed number still in today's academic
year rolls into the next one — once — and keeps her bindings; everyone else stays put."""
from __future__ import annotations

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ARUVI_STATE_DIR", tempfile.mkdtemp(prefix="aruvi-test-state-"))

from api import config, main as m  # noqa: E402


def test_listed_number_rolls_once_and_others_stay():
    today_year = m._default_academic_year().year_id
    nxt = m.YearCutoverFileImpl.next_year_id(today_year)
    config.TEST_CUTOVER = {"9000000028"}
    try:
        assert m._resolve_year("9000000028", "9000000028") == today_year   # bootstrap
        assert m._resolve_year("9000000028", "9000000028") == nxt          # rolled
        assert m._resolve_year("9000000028", "9000000028") == nxt          # and only once
        cur = m.academic_year_repo.current("9000000028", "9000000028")
        assert cur.cleanup_pending                                           # the offer is armed
        assert m._resolve_year("9000000029", "9000000029") == today_year   # unlisted
        assert m._resolve_year("9000000029", "9000000029") == today_year
    finally:
        config.TEST_CUTOVER = set()


def test_off_by_default():
    config.TEST_CUTOVER = set()
    y = m._default_academic_year().year_id
    assert m._resolve_year("9000000030", "9000000030") == y
    assert m._resolve_year("9000000030", "9000000030") == y


def test_fresh_start_is_stamped_and_reported():
    """WALK-A-163: other devices learn of a fresh start from `fresh_started_at`."""
    config.TEST_CUTOVER = {"9000000031"}
    try:
        ident = ("9000000031", "9000000031")
        m._resolve_year(*ident); m._resolve_year(*ident)            # bootstrap, then roll
        assert m.get_academic_year(identity=ident)["fresh_started_at"] == ""
        out = m.do_cutover(m.CutoverRequest(confirm=True), identity=ident)
        assert out["status"] == "cutover"
        stamp = m.get_academic_year(identity=ident)["fresh_started_at"]
        assert stamp                                                 # set, and survives a read
        assert m.get_academic_year(identity=ident)["fresh_started_at"] == stamp
    finally:
        config.TEST_CUTOVER = set()


if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
