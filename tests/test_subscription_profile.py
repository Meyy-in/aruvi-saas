"""
Tests for what a CHECKOUT does to her teaching profile (2026-09-17).

`_apply_subscription_profile` turns every purchased scope into a ready-made profile entry.
It is given the FULL held list rather than this cart — it has to be, or a second checkout
would drop the subjects she bought first — and that is exactly what made the two defects
below possible.

  1. ONLY THIS PURCHASE SEEDS A CLASS. Seeding off the held list meant buying subject C
     could quietly put a default class back into subject A, on a path where nobody is
     looking at the profile.
  2. A SUBJECT SHE EMPTIED ON PURPOSE STAYS EMPTY, and stays. Since 2026-09-17 a subject
     she has PAID for survives losing its last class (@aruvi/shared/profile
     `subjectSurvivesEmpty`), so `{name, grades: []}` is a real state a teacher can put her
     profile in. This function used to read it as "no class in the purchased stage" and
     hand her back a Class 6 · Section A on her next checkout — and the `if not grades:
     continue` below it would otherwise have dropped the record altogether, which is the
     very loss the change was made to stop.

Run standalone:  python3 tests/test_subscription_profile.py     (also pytest-compatible)
"""
from __future__ import annotations

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Throwaway state dir BEFORE importing api.main (see test_account.py).
_TMP_STATE = tempfile.mkdtemp(prefix="aruvi-test-state-")
os.environ.setdefault("ARUVI_STATE_DIR", _TMP_STATE)

from tests.test_consent import accept_current  # noqa: E402  (one signature, one place)


def _headers(user: str) -> dict:
    return {"X-Aruvi-User": user}


def _client():
    from fastapi.testclient import TestClient
    from api import main as api_main
    return TestClient(api_main.app, raise_server_exceptions=False), api_main


def _buy(c, H, scopes):
    r = c.post("/onboarding/checkout", headers=H, json={
        "scopes": scopes, "name": "T", "email": "", "role": "Teacher",
        "state": "Kerala", "city": "Kochi", "school": ""})
    assert r.status_code == 200, r.json()
    return r.json()


def _profile(c, H):
    return {s["name"]: s for s in (c.get("/readiness", headers=H).json()
                                   .get("readiness") or {}).get("subjects", [])}


def _save(c, H, subjects):
    r = c.post("/readiness", headers=H, json={"subjects": subjects, "cascade": True})
    assert r.status_code == 200, r.json()


def test_a_purchase_still_seeds_the_stages_lowest_class():
    """The 2026-08-25 rule, unchanged — the guard for everything below."""
    c, _ = _client()
    H = _headers("SeedBuyer")
    accept_current(c, H)
    _buy(c, H, ["science/middle"])

    prof = _profile(c, H)
    assert "Science" in prof, "a purchased scope arrives as a profile entry"
    grades = [g["grade"].lower() for g in prof["Science"]["grades"]]
    assert grades == ["vi"], f"the stage's lowest class, section A: {grades}"
    assert prof["Science"]["grades"][0]["sections"], "and it arrives with a section"
    print("✓ A purchase still seeds the stage's lowest class")


def test_an_emptied_subject_is_kept_and_never_reseeded():
    """★ The founder's case: a subject she owns, emptied of classes, must survive a later
    checkout — neither dropped nor handed a class back."""
    c, _ = _client()
    H = _headers("EmptierBuyer")
    accept_current(c, H)
    _buy(c, H, ["science/middle"])

    prof = _profile(c, H)
    prof["Science"]["grades"] = []
    prof["Science"]["grids"] = []
    prof["Science"]["budget"] = {}
    _save(c, H, list(prof.values()))
    assert _profile(c, H)["Science"]["grades"] == [], "the empty record persists as saved"

    # …and a later purchase of something else must leave it exactly as she left it.
    _buy(c, H, ["english/middle"])
    after = _profile(c, H)
    assert "Science" in after, \
        "a subject she OWNS is never dropped by a checkout — that is the whole loss"
    assert after["Science"]["grades"] == [], \
        "and it is not handed a Class 6 back on a path she is not even looking at"
    assert "English" in after, "the thing she actually bought still arrives"
    print("✓ An emptied subject is kept, and never re-seeded, by a later checkout")


def test_only_this_cart_seeds_a_class():
    """A scope she already HELD is not a reason to seed: she bought science/middle and
    science/secondary, then stopped teaching the middle class. Buying English must not put
    Class 6 back."""
    c, _ = _client()
    H = _headers("HeldScopeBuyer")
    accept_current(c, H)
    _buy(c, H, ["science/middle", "science/secondary"])

    prof = _profile(c, H)
    seeded = sorted(g["grade"].lower() for g in prof["Science"]["grades"])
    assert seeded == ["ix", "vi"], f"one class per purchased stage: {seeded}"

    # She keeps the secondary class and drops the middle one.
    prof["Science"]["grades"] = [g for g in prof["Science"]["grades"]
                                if g["grade"].lower() != "vi"]
    prof["Science"]["grids"] = prof["Science"]["grids"][-1:]
    prof["Science"]["budget"] = {"0": (prof["Science"]["budget"] or {}).get("1")
                                 or {"method": "periods", "value": 200}}
    _save(c, H, list(prof.values()))

    _buy(c, H, ["english/middle"])
    after = sorted(g["grade"].lower() for g in _profile(c, H)["Science"]["grades"])
    assert after == ["ix"], \
        f"buying English must not re-seed Science's middle class: {after}"
    print("✓ Only the scopes in THIS cart seed a class")


if __name__ == "__main__":
    test_a_purchase_still_seeds_the_stages_lowest_class()
    test_an_emptied_subject_is_kept_and_never_reseeded()
    test_only_this_cart_seeds_a_class()
    print("\n✅ All subscription-profile tests passed!")
