"""The free trial is once per mobile number, across an erasure (founder, 2026-09-18).

Delete → sign up again used to hand out three more free chapters, for ever. The trial ledger keeps
one line per number — a KEYED hash, never the number — with the chapters it used, for 24 months.
These tests pin: the number is not stored; a returning number starts with its used chapters
counted; a paid account counts as spent; an entry never shrinks; an expired entry is forgotten;
and the ledger sits outside the erase walk. Stdlib + the API's own deps.
"""
from __future__ import annotations

import os, sys, tempfile, json, pathlib
_TMP = tempfile.mkdtemp(prefix="aruvi-test-trial-")
os.environ["ARUVI_STATE_DIR"] = _TMP
os.environ["ARUVI_ENTITLEMENT_ENFORCED"] = "1"
os.environ.setdefault("ARUVI_TRIAL_LEDGER_KEY", "test-key")
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from api import main  # noqa: E402
from aruvi_core.adapters.trial_ledger_file import TrialLedgerFileImpl  # noqa: E402

c = TestClient(main.app)
H = lambda m: {"X-Aruvi-User": m}


def _use(mobile, n):
    """Count n trial chapters the way a real serve does."""
    for i in range(n):
        main._count_trial_chapter(mobile, "science", "vi", i + 1)


def _erase(mobile):
    r = c.post("/data-rights/erase", headers=H(mobile),
               json={"confirm": "erase", "downloaded_confirmed": True})
    assert r.status_code == 200, r.text


def test_number_is_never_stored():
    led = TrialLedgerFileImpl(_TMP, "k")
    assert led.note_erased("9000000011", 2)
    blob = "".join(p.read_text() + p.name for p in pathlib.Path(_TMP, "trial_ledger").glob("*.json"))
    assert "9000000011" not in blob
    # the three spellings of one number are one entry
    assert led.lookup("+91 90000 00011")["chapters_used"] == 2
    assert led.lookup("919000000011")["chapters_used"] == 2
    assert TrialLedgerFileImpl(_TMP, "another-key").lookup("9000000011") is None, "a different key matches nothing"


def test_returning_number_keeps_its_used_chapters():
    m = "9000000021"
    assert c.post("/onboarding/verified", headers=H(m)).json()["trial_remaining"] == 3
    _use(m, 2)
    _erase(m)
    assert main.entitlement_repo.load(m) is None, "the account really is gone"
    assert c.post("/onboarding/verified", headers=H(m)).json()["trial_remaining"] == 1


def test_all_used_returns_with_nothing_left():
    m = "9000000031"
    c.post("/onboarding/verified", headers=H(m))
    _use(m, 3)
    _erase(m)
    assert c.post("/onboarding/verified", headers=H(m)).json()["trial_remaining"] == 0
    # and a second delete-and-return does not shrink it
    _erase(m)
    assert c.post("/onboarding/verified", headers=H(m)).json()["trial_remaining"] == 0


def test_a_paid_account_counts_the_trial_as_spent():
    m = "9000000041"
    c.post("/onboarding/verified", headers=H(m))
    main.billing_provider.create_subscription(m, "individual_annual", scopes=["science/middle"], source="manual")
    _erase(m)
    assert c.post("/onboarding/verified", headers=H(m)).json()["trial_remaining"] == 0


def test_an_unused_trial_leaves_no_line():
    m = "9000000051"
    c.post("/onboarding/verified", headers=H(m))
    _erase(m)
    assert main.trial_ledger.lookup(m) is None
    assert c.post("/onboarding/verified", headers=H(m)).json()["trial_remaining"] == 3


def test_expired_entry_is_forgotten():
    led = TrialLedgerFileImpl(_TMP, "k2", retention_days=-1)
    led.note_erased("9000000061", 3)
    assert led.lookup("9000000061") is None


def test_ledger_is_outside_the_erase_walk_and_on_the_receipt():
    m = "9000000071"
    c.post("/onboarding/verified", headers=H(m))
    _use(m, 1)
    r = c.post("/data-rights/erase", headers=H(m), json={"confirm": "erase", "downloaded_confirmed": True}).json()
    assert main.trial_ledger.lookup(m)["chapters_used"] == 1, "erasing did not take the ledger with it"
    assert any("free trial" in k["what"] for k in r["kept"]), "the receipt names what it kept"


if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"):
            f(); print("✓", n)
    print("✅ All trial-ledger tests passed!")
