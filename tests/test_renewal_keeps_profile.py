"""WALK-A-160 (founder, 2026-10-02): a lapse HIDES, it never deletes — and a renewal that
covers FEWER subject-stages than she held must not drop the rest. Only trial remnants may be
cleared. Pinned here because the profile step DROPS every subject outside `held`, so the
guarantee rests on the billing provider keeping previously PAID scopes in `held` (merge, not
replace) even after a revoke."""
from __future__ import annotations

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ARUVI_STATE_DIR", tempfile.mkdtemp(prefix="aruvi-test-state-"))

from api import main as m  # noqa: E402

SS, SCI = "social_sciences/secondary", "science/secondary"


def _subjects(t):
    return {s["name"]: [g["grade"] for g in s["grades"]]
            for s in (m.readiness_repo.load_profile(t, t) or {}).get("subjects", [])}


def test_renewing_one_of_two_lapsed_subjects_keeps_the_other():
    t = "9000000160"
    m.billing_provider.create_subscription(t, "individual_annual", scopes=[SS, SCI], source="web")
    m._apply_subscription_profile(t, t, [SS, SCI], buying=[SS, SCI])
    before = _subjects(t)
    assert set(before) == {"Social Sciences", "Science"}
    m.billing_provider.cancel(t)                                  # lapse
    r = m.billing_provider.create_subscription(t, "individual_annual", scopes=[SS], source="web")
    held = r.get("scopes")
    assert SCI in held                                            # the paid scope is remembered
    m._apply_subscription_profile(t, t, held, buying=[SS])
    assert _subjects(t) == before                                 # nothing dropped, nothing reseeded


def test_first_purchase_still_clears_a_trial_subject():
    t = "9000000161"
    m.readiness_repo.save_profile(t, t, {"subjects": [
        {"name": "English", "grades": [{"grade": "III", "sections": [{"tag": "3A", "sec": "A"}]}]}]})
    r = m.billing_provider.create_subscription(t, "individual_annual", scopes=[SS], source="web")
    m._apply_subscription_profile(t, t, r.get("scopes"), buying=[SS])
    assert set(_subjects(t)) == {"Social Sciences"}               # trial remnant gone


if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
