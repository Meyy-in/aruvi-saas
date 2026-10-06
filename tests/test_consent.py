"""
Tests for the user agreement's six ticks (2026-08-27).

What is under test, in the order it matters:

  1. THE DOCUMENT PARSES. `api/legal.py` cuts the founder's markdown into five
     acknowledgements + the full agreement + the final tick. A consent screen missing a
     tick is the kind of bug nobody notices, so a malformed document must raise rather
     than serve half of itself.
  2. THE RECORD IS APPEND-ONLY AND TENANT-KEYED, and it survives an ERASE — deliberately,
     because proof the other party can delete is not proof (founder, 2026-08-27).
  3. THE GATE. No checkout without an acceptance of the CURRENT version; a partial
     acceptance is refused rather than stored.

Run standalone:  python3 tests/test_consent.py     (also pytest-compatible)
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from dataclasses import asdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Throwaway state dir BEFORE importing api.main (see test_account.py).
_TMP_STATE = tempfile.mkdtemp(prefix="aruvi-test-state-")
os.environ.setdefault("ARUVI_STATE_DIR", _TMP_STATE)

from aruvi_core.ports import ConsentRecord  # noqa: E402
from aruvi_core.adapters.consent_repository_file import ConsentRepositoryFileImpl  # noqa: E402
from api import data, legal  # noqa: E402


def _headers(user: str) -> dict:
    return {"X-Aruvi-User": user}


def accept_current(client, headers) -> dict:
    """Tick everything the current document asks for. Exported so the checkout tests in
    test_entitlement/test_invoice can get past the gate without re-deriving the ids."""
    doc = client.get("/legal/consent", headers=headers).json()["document"]
    r = client.post("/legal/consent", headers=headers, json={
        "version": doc["version"],
        "acknowledgements": [a["id"] for a in doc["acknowledgements"]],
        "final": True})
    assert r.status_code == 200, r.json()
    return r.json()


# ── 1. the document ────────────────────────────────────────────────────────────
def test_document_parses_into_five_plus_one():
    doc = legal.load_consent_document()
    assert doc["version"], "version comes from the filename"
    acks = doc["acknowledgements"]
    assert len(acks) == 5, f"expected five acknowledgements, got {len(acks)}"
    assert [a["n"] for a in acks] == [1, 2, 3, 4, 5], "in order, numbered as authored"
    assert [a["id"] for a in acks] == ["ack1", "ack2", "ack3", "ack4", "ack5"]
    for a in acks:
        assert a["title"].strip(), "every tick has a title"
        assert len(a["body"]) > 80, f"ack {a['n']} lost its body"
        assert "I understand and agree" not in a["body"], \
            "the tick's own label belongs to the checkbox, not the body text"
    assert doc["final"]["text"].strip(), "the sixth tick exists"
    # The whole point of parsing rather than retyping: the body must actually be there.
    # v1.0 (2026-10-06): §F is "Your personal data" and points to the Privacy Notice
    assert "Your personal data" in doc["agreement"] and "Privacy Notice" in doc["agreement"]
    # The lawyer's front matter is scaffolding — a teacher never sees it.
    assert "legal review" not in doc["intro"].lower()
    print("✓ The agreement parses into five acknowledgements + a body + a final tick")


def test_a_malformed_document_refuses_to_serve():
    """Better a loud failure than a consent screen with four ticks."""
    with tempfile.TemporaryDirectory() as tmp:
        d = os.path.join(tmp, "legal")
        os.makedirs(d)
        with open(os.path.join(d, "consent_and_disclaimer_v9.9.md"), "w") as f:
            f.write("## Before you subscribe — please read\n\n"
                    "### ☐ 1. Only one point\n\nBody.\n\n**I understand and agree.**\n\n"
                    "# Full User Agreement & Information for Users\n\nStuff.\n\n"
                    "## Final acknowledgement\n\n### ☐ I accept.\n")
        # Redirect the CONTENT ROOT, not legal's own constant. Since 2026-08-29 the
        # agreement is read through the Storage port like every other Bucket A file,
        # so api/legal.py no longer holds a DATA_DIR of its own to patch — this is the
        # same `data.DATA_DIR = tmp` idiom test_lp_year and test_genon_plan_key use.
        real = data.DATA_DIR
        data.DATA_DIR = tmp
        legal._cache.clear()
        try:
            legal.load_consent_document("9.9")
            assert False, "a one-tick document must not serve"
        except legal.ConsentDocumentError as exc:
            assert "expected 5" in str(exc)
        finally:
            data.DATA_DIR = real
            legal._cache.clear()
    print("✓ A document that lost a tick raises instead of serving half of itself")


# ── 2. the record ──────────────────────────────────────────────────────────────
def test_repo_appends_and_isolates_tenants():
    with tempfile.TemporaryDirectory() as tmp:
        repo = ConsentRepositoryFileImpl(tmp)
        assert repo.load_all("Kumar1") == []
        assert repo.latest("Kumar1", "consent_and_disclaimer") is None

        repo.save(ConsentRecord(tenant_id="Kumar1", user_id="Kumar1",
                                document_id="consent_and_disclaimer",
                                document_version="0.1", accepted_at="2026-08-27T09:00:00+00:00",
                                acknowledgements={f"ack{i}": "2026-08-27T09:00:00+00:00"
                                                  for i in range(1, 6)},
                                final_accepted_at="2026-08-27T09:00:00+00:00"))
        repo.save(ConsentRecord(tenant_id="Kumar1", user_id="Kumar1",
                                document_id="consent_and_disclaimer",
                                document_version="0.2", accepted_at="2026-09-30T09:00:00+00:00",
                                final_accepted_at="2026-09-30T09:00:00+00:00"))

        rows = repo.load_all("Kumar1")
        assert len(rows) == 2, "append-only — v0.1 is not overwritten by v0.2"
        assert [r.document_version for r in rows] == ["0.1", "0.2"], "oldest first"
        assert repo.latest("Kumar1", "consent_and_disclaimer").document_version == "0.2"
        assert repo.latest("Kumar1", "consent_and_disclaimer", "0.1").document_version == "0.1"
        assert repo.latest("Kumar1", "consent_and_disclaimer", "0.9") is None
        assert repo.load_all("Priya2") == [], "tenant-keyed, isolated"
        print("✓ Consent records append, keep every version, and never cross tenants")


def test_the_optional_tick_is_optional():
    """★ The marketing consent, pinned as SEPARABLE (founder, 2026-09-04).

    DPDP §6 requires consent to be free, specific and unconditional, so a marketing
    choice may not gate the service. Everything this asserts is a way of saying that
    once:
      * it is parsed into `optional`, never into `acknowledgements` — anything in there
        is mandatory by construction (Agreement.jsx's `allTicked`, and the five-box
        tally both map over it);
      * `acknowledgement_ids()` stays five, so an acceptance validates without it;
      * an acceptance that DECLINES it is complete, not partial;
      * the answer lands on the ACCOUNT (withdrawable, erased with her) and never in the
        retained ledger, which exists to be un-erasable;
      * versions that predate it parse exactly as they did.
    """
    from fastapi.testclient import TestClient
    from api import main as api_main

    doc = legal.load_consent_document()
    assert doc["optional"], "v0.4+ carries the optional tick"
    assert doc["optional"]["id"] == "marketing_email"
    ids = legal.acknowledgement_ids()
    assert len(ids) == 5 and "marketing_email" not in ids, \
        "the optional tick is not one of the five — putting it there would bundle it"
    for v in legal.available_versions():
        d = legal.load_consent_document(v)
        assert len(d["acknowledgements"]) == 5, f"v{v} still parses as five"

    c = TestClient(api_main.app, raise_server_exceptions=False)

    # DECLINED — a complete acceptance, and nothing is switched on.
    H = _headers("OptOutTeacher")
    body = {"version": doc["version"], "acknowledgements": ids, "final": True,
            "context": "subscription_checkout", "language": "en"}
    assert c.post("/legal/consent", headers=H, json=body).status_code == 200, \
        "declining marketing is a COMPLETE acceptance, not a partial one"
    acct = api_main.account_repo.load("OptOutTeacher", "OptOutTeacher")
    assert acct.notify.get("marketing_email") is False
    assert not acct.notify.get("marketing_email_at"), "no opt-in date when she declined"

    # ACCEPTED — recorded with the date and the version she saw.
    H2 = _headers("OptInTeacher")
    r = c.post("/legal/consent", headers=H2, json=dict(body, marketing_email=True))
    assert r.status_code == 200 and r.json()["marketing_email"] is True
    acct2 = api_main.account_repo.load("OptInTeacher", "OptInTeacher")
    assert acct2.notify.get("marketing_email") is True
    assert acct2.notify.get("marketing_email_at"), "when she opted in is part of the fact"
    assert acct2.notify.get("marketing_email_version") == doc["version"]

    # …and NEVER in the ledger, which is retained through erasure. A marketing consent
    # that cannot be withdrawn is the one thing this must never become.
    for row in api_main.consent_repo.load_all("OptInTeacher"):
        blob = json.dumps(asdict(row)).lower()
        assert "marketing" not in blob, \
            "the marketing choice must not reach the un-erasable record"
        # (the tenant ids above deliberately avoid the word, or this would self-trigger)

    # Erasing her takes the preference with it — the account is where it lives.
    c.post("/data-rights/erase", headers=H2,
           json={"confirm": "erase", "downloaded_confirmed": True})
    assert api_main.account_repo.load("OptInTeacher", "OptInTeacher") is None, \
        "and the preference goes with the account, unlike the signature"
    print("✓ The marketing tick is optional, separately stored, and erasable")


def test_consent_survives_an_erase_but_stops_binding():
    """★ The retention decision AND its limit, asserted (founder, 2026-08-27).

    Two facts that are easy to confuse, which is exactly why both are pinned here:
      * the ROW survives — every other Bucket-B store is walked destructively, this one
        is not, and the receipt says so;
      * the SIGNATURE does not — erase stamps `superseded_at`, so the returning id is
        asked to sign afresh.

    The second half is a regression test for a live bug: tenant 1000000002 erased,
    came back, and walked straight past the agreement because the kept row still
    answered the gate. In production the same hole belongs to REASSIGNED mobile
    numbers, where the person waved through never signed anything at all."""
    from fastapi.testclient import TestClient
    from api import main as api_main

    c = TestClient(api_main.app, raise_server_exceptions=False)
    H = _headers("ErasingSignatory")
    accept_current(c, H)
    assert api_main.consent_repo.load_all("ErasingSignatory"), "signed"
    assert api_main.consent_repo.latest("ErasingSignatory", legal.DOCUMENT_ID), "and bound"
    # The account mirror exists too — and that one IS erased with the account.
    assert (api_main.account_repo.load("ErasingSignatory", "ErasingSignatory")
            .consent.get("accepted_at"))

    r = c.post("/data-rights/erase", headers=H,
               json={"confirm": "erase", "downloaded_confirmed": True})
    assert r.status_code == 200, r.json()
    receipt = r.json()
    assert api_main.account_repo.load("ErasingSignatory", "ErasingSignatory") is None, \
        "the account itself is gone"

    rows = api_main.consent_repo.load_all("ErasingSignatory")
    assert rows, "the signature is NOT gone — it is evidence of the agreement"
    assert all(r_.superseded_at for r_ in rows), \
        "…but every row is stamped with the date it stopped applying"
    assert api_main.consent_repo.latest("ErasingSignatory", legal.DOCUMENT_ID) is None, \
        "a kept record is not a standing signature"

    whats = [k["what"] for k in receipt.get("kept", [])]
    assert any("User Agreement" in w for w in whats), \
        "and the receipt must SAY it was kept — a silent remnant is worse than none"
    assert any("accept the agreement afresh" in k["why"] for k in receipt.get("kept", [])), \
        "the receipt's wording and §G of the agreement must promise the same thing"

    # The gate agrees with the repository — one rule, two callers.
    s = c.get("/legal/consent/status", headers=H).json()
    assert s["accepted"] is False, "she is asked again"
    body = {"scopes": ["science/middle"], "name": "T", "email": "", "role": "Teacher",
            "state": "Kerala", "city": "Kochi", "school": ""}
    assert c.post("/onboarding/checkout", headers=H, json=body).status_code == 409, \
        "and checkout refuses until she has"

    # Erasing twice must not rewrite when the agreement actually ended.
    first = [r_.superseded_at for r_ in rows]
    c.post("/data-rights/erase", headers=H,
           json={"confirm": "erase", "downloaded_confirmed": True})
    again = [r_.superseded_at for r_ in api_main.consent_repo.load_all("ErasingSignatory")]
    assert again == first, "the stamp is set once, by the erase that ended it"
    print("✓ Consent survives an erase as evidence, but stops binding — and is re-asked")


# ── 3. the gate ────────────────────────────────────────────────────────────────
def test_status_route_and_recording():
    from fastapi.testclient import TestClient
    from api import main as api_main

    c = TestClient(api_main.app, raise_server_exceptions=False)
    H = _headers("FreshSignatory")

    s = c.get("/legal/consent/status", headers=H).json()
    assert s["accepted"] is False and s["current_version"]
    assert not s["prior_version"], "she has never signed anything"

    accept_current(c, H)

    s = c.get("/legal/consent/status", headers=H).json()
    assert s["accepted"] is True and s["accepted_at"]
    assert s["accepted_version"] == s["current_version"]

    rec = api_main.consent_repo.latest("FreshSignatory", legal.DOCUMENT_ID)
    assert set(rec.acknowledgements) == set(legal.acknowledgement_ids()), \
        "one timestamp per point — the document asks for them separately"
    assert rec.final_accepted_at and rec.context == "subscription_checkout"
    assert rec.user_id == "FreshSignatory"
    print("✓ Acceptance is recorded per tick and reported back by the status route")


def test_partial_acceptance_is_refused():
    from fastapi.testclient import TestClient
    from api import main as api_main

    c = TestClient(api_main.app, raise_server_exceptions=False)
    H = _headers("PartialSignatory")
    doc = c.get("/legal/consent", headers=H).json()["document"]
    ids = [a["id"] for a in doc["acknowledgements"]]

    # Four of five.
    r = c.post("/legal/consent", headers=H, json={
        "version": doc["version"], "acknowledgements": ids[:4], "final": True})
    assert r.status_code == 400, r.status_code
    # All five, no final tick.
    r = c.post("/legal/consent", headers=H, json={
        "version": doc["version"], "acknowledgements": ids, "final": False})
    assert r.status_code == 400, r.status_code
    # A superseded version.
    r = c.post("/legal/consent", headers=H, json={
        "version": "0.0", "acknowledgements": ids, "final": True})
    assert r.status_code == 409 and "updated" in r.json()["detail"]

    assert api_main.consent_repo.load_all("PartialSignatory") == [], \
        "nothing half-signed is ever stored"
    print("✓ A partial or stale acceptance is refused, not stored")


def test_checkout_needs_a_signature():
    from fastapi.testclient import TestClient
    from api import main as api_main

    c = TestClient(api_main.app, raise_server_exceptions=False)
    H = _headers("UnsignedBuyer")
    body = {"scopes": ["science/middle"], "name": "T", "email": "", "role": "Teacher",
            "state": "Kerala", "city": "Kochi", "school": ""}

    r = c.post("/onboarding/checkout", headers=H, json=body)
    assert r.status_code == 409, r.status_code
    assert "User Agreement" in r.json()["detail"], \
        "the refusal is written for her — the client routes on these words"
    assert api_main.entitlement_repo.load("UnsignedBuyer") is None, "nothing was sold"

    accept_current(c, H)
    r = c.post("/onboarding/checkout", headers=H, json=body)
    assert r.status_code == 200, r.json()

    # And a SECOND purchase does not ask again — re-consent is per document version.
    r = c.post("/onboarding/checkout", headers=H, json=dict(body, scopes=["english/middle"]))
    assert r.status_code == 200, r.json()
    assert len(api_main.consent_repo.load_all("UnsignedBuyer")) == 1, \
        "one signature per version, not one per purchase"
    print("✓ No checkout without a current signature; one signature covers later purchases")


if __name__ == "__main__":
    test_document_parses_into_five_plus_one()
    test_a_malformed_document_refuses_to_serve()
    test_repo_appends_and_isolates_tenants()
    test_the_optional_tick_is_optional()
    test_consent_survives_an_erase_but_stops_binding()
    test_status_route_and_recording()
    test_partial_acceptance_is_refused()
    test_checkout_needs_a_signature()
    print("\n✅ All consent tests passed!")
