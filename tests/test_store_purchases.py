"""
Tests for in-app purchases through RevenueCat — pay once for a year (2026-10-09).

What must never go wrong with money: a webhook without the secret is refused; one store
transaction grants once (webhook and the app's sync race each other); a sandbox purchase
grants only the founder's test numbers; renewing early starts the new year where the old one
ends; and the phone sees "store" while a test number keeps the no-money checkout.

Run standalone:  python3 tests/test_store_purchases.py     (also pytest-compatible)
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_TMP_STATE = tempfile.mkdtemp(prefix="aruvi-test-store-")
os.environ.setdefault("ARUVI_STATE_DIR", _TMP_STATE)

from aruvi_core.adapters import revenuecat as rc  # noqa: E402
from tests.test_consent import accept_current  # noqa: E402

SECRET, WH = "sk_test_rc", "whsecret-rc"


class _Resp:
    def __init__(self, code, data):
        self.status_code, self._d, self.text = code, data, json.dumps(data)

    def json(self):
        return self._d


def _client(subscriber=None):
    """A TestClient with RevenueCat switched on and the REST call to RevenueCat faked."""
    from fastapi.testclient import TestClient
    from api import main as api_main
    cfg = api_main.config
    cfg.REVENUECAT_SECRET_KEY, cfg.REVENUECAT_WEBHOOK_SECRET = SECRET, WH
    cfg.MANUAL_CHECKOUT_NUMBERS = ["+91 90000 00001"]
    cfg.STORE_INVOICE = False
    box = {"subscriber": subscriber or {}, "calls": []}

    def fake_get(url, headers=None, timeout=None):
        box["calls"].append({"url": url, "headers": headers})
        return _Resp(200, {"subscriber": box["subscriber"]})
    rc.httpx.get = fake_get
    return TestClient(api_main.app, raise_server_exceptions=True), api_main, box


def _off(api_main):
    cfg = api_main.config
    cfg.REVENUECAT_SECRET_KEY = cfg.REVENUECAT_WEBHOOK_SECRET = ""
    cfg.MANUAL_CHECKOUT_NUMBERS = []


def _evt(user, product, txn, store="PLAY_STORE", env="PRODUCTION", typ="NON_RENEWING_PURCHASE"):
    return {"api_version": "1.0", "event": {
        "type": typ, "app_user_id": user, "product_id": product, "transaction_id": txn,
        "store": store, "environment": env, "purchased_at_ms": 1}}


def _hook(c, evt, auth=WH):
    return c.post("/payments/revenuecat/webhook", json=evt,
                  headers={"Authorization": auth} if auth else {})


BODY = {"scopes": ["science/middle", "english/middle"], "name": "Store Teacher",
        "email": "store@example.com", "role": "Teacher", "state": "Kerala", "city": "Kochi",
        "school": "KV"}


def test_product_ids_round_trip():
    for scope in ["science/middle", "social_sciences/secondary", "the_world_around_us/preparatory"]:
        assert rc.scope_for_product(rc.product_for_scope(scope)) == scope
    assert rc.scope_for_product("meyy.science.middle:base-plan") == "science/middle"
    assert rc.scope_for_product("com.other.thing") is None
    assert rc.webhook_authorized(WH, "Bearer " + WH) and not rc.webhook_authorized(WH, "x")
    print("✓ RevenueCat: product ids derive from scopes and back")


def test_start_webhook_once_and_race_with_sync():
    c, api_main, box = _client()
    try:
        H = {"X-Aruvi-User": "9000000199"}
        accept_current(c, H)
        ent = c.get("/entitlement", headers=H).json()
        assert ent["store_purchases"] == "store"
        # The no-money checkout is closed to her (Razorpay off, so it is still open on the
        # web path — the phone never calls it when store_purchases == "store").
        st = c.post("/payments/store/start", headers=H, json=BODY).json()
        assert st["app_user_id"] == "9000000199"
        assert [p["product_id"] for p in st["products"]] == ["meyy.science.middle",
                                                             "meyy.english.middle"]
        assert c.get("/entitlement", headers=H).json()["status"] == "trial"

        # No secret, wrong secret: refused. Right secret: granted — once.
        assert _hook(c, _evt("9000000199", "meyy.science.middle", "GPA.1"), auth=None).status_code == 401
        assert _hook(c, _evt("9000000199", "meyy.science.middle", "GPA.1"), auth="nope").status_code == 401
        r = _hook(c, _evt("9000000199", "meyy.science.middle", "GPA.1"))
        assert r.status_code == 200 and r.json()["status"] == "active", r.json()
        e = c.get("/entitlement", headers=H).json()
        year = (date.today() + timedelta(days=365)).isoformat()
        assert e["live_scopes"] == ["science/middle"] and e["scope_valid_until"]["science/middle"] == year
        # No Meyy invoice for a store sale (X10) …
        assert c.get("/invoices", headers=H).json()["invoices"] == []
        # … and the same transaction again (RevenueCat retries) grants nothing new.
        assert _hook(c, _evt("9000000199", "meyy.science.middle", "GPA.1")).json()["status"] == "active"
        assert c.get("/entitlement", headers=H).json()["live_scopes"] == ["science/middle"]

        # The second product arrives by SYNC before its webhook: granted by sync, then the
        # webhook for the same transaction is a no-op.
        box["subscriber"] = {"non_subscriptions": {
            "meyy.science.middle": [{"id": "GPA.1", "store": "play_store", "is_sandbox": False}],
            "meyy.english.middle": [{"id": "GPA.2", "store": "play_store", "is_sandbox": False}]}}
        sy = c.post("/payments/store/sync", headers=H).json()
        assert box["calls"][-1]["url"].endswith("/subscribers/9000000199")
        assert box["calls"][-1]["headers"]["Authorization"] == "Bearer " + SECRET
        assert sy["granted"] == 1 and set(sy["entitlement"]["live_scopes"]) == set(BODY["scopes"])
        _hook(c, _evt("9000000199", "meyy.english.middle", "GPA.2"))
        e = c.get("/entitlement", headers=H).json()
        assert set(e["live_scopes"]) == set(BODY["scopes"])
        assert all(v == year for v in e["scope_valid_until"].values())
        # An unknown product id is ignored, not an error.
        assert _hook(c, _evt("9000000199", "com.other.sku", "GPA.9")).json()["status"] == "ignored"
        # A live subject far from its end cannot be started again.
        r = c.post("/payments/store/start", headers=H, json=dict(BODY, scopes=["science/middle"]))
        assert r.status_code == 409 and "renew it from" in r.json()["detail"]
        print("✓ RevenueCat: start, webhook once, sync races safely, no double purchase")
    finally:
        _off(api_main)


def test_sandbox_grants_only_test_numbers():
    c, api_main, _ = _client()
    try:
        Hs = {"X-Aruvi-User": "9000000177"}          # a stranger
        accept_current(c, Hs)
        r = _hook(c, _evt("9000000177", "meyy.science.middle", "SBX.1", env="SANDBOX"))
        assert r.json()["status"] == "sandbox_ignored"
        assert c.get("/entitlement", headers=Hs).json()["status"] == "trial"
        Ht = {"X-Aruvi-User": "919000000001"}        # the founder's test number
        accept_current(c, Ht)
        assert c.get("/entitlement", headers=Ht).json()["store_purchases"] == "manual"
        r = _hook(c, _evt("919000000001", "meyy.science.middle", "SBX.2", env="SANDBOX",
                          store="APP_STORE"))
        assert r.json()["status"] == "active"
        assert c.get("/entitlement", headers=Ht).json()["live_scopes"] == ["science/middle"]
        print("✓ RevenueCat: sandbox purchases grant only the founder's test numbers")
    finally:
        _off(api_main)


def test_early_renewal_extends_from_the_end():
    c, api_main, _ = _client()
    try:
        H = {"X-Aruvi-User": "9000000188"}
        accept_current(c, H)
        ends = (date.today() + timedelta(days=10)).isoformat()
        api_main.billing_provider.create_subscription(
            "9000000188", "individual_annual", scopes=["science/middle"],
            valid_until=ends, source="store:play_store")
        assert c.get("/entitlement", headers=H).json()["renewable_scopes"] == ["science/middle"]
        st = c.post("/payments/store/start", headers=H,
                    json=dict(BODY, scopes=["science/middle"],
                              email="store-renew@example.com")).json()   # email is per-account
        assert st["products"][0]["product_id"] == "meyy.science.middle", st
        _hook(c, _evt("9000000188", "meyy.science.middle", "GPA.renew"))
        e2 = c.get("/entitlement", headers=H).json()
        want = (date.fromisoformat(ends) + timedelta(days=365)).isoformat()
        assert e2["scope_valid_until"]["science/middle"] == want, e2
        print("✓ RevenueCat: renewing early starts the new year where the old one ends")
    finally:
        _off(api_main)


def test_off_mode():
    from fastapi.testclient import TestClient
    from api import main as api_main
    _off(api_main)
    c = TestClient(api_main.app, raise_server_exceptions=True)
    H = {"X-Aruvi-User": "9000000166"}
    accept_current(c, H)
    assert c.get("/entitlement", headers=H).json()["store_purchases"] == "manual"
    assert c.post("/payments/store/start", headers=H, json=BODY).status_code == 409
    assert c.post("/payments/store/sync", headers=H).status_code == 409
    assert _hook(c, _evt("9000000166", "meyy.science.middle", "T")).status_code == 401
    print("✓ RevenueCat off: the phone keeps the no-money checkout; nothing else answers")


if __name__ == "__main__":
    test_product_ids_round_trip()
    test_start_webhook_once_and_race_with_sync()
    test_sandbox_grants_only_test_numbers()
    test_early_renewal_extends_from_the_end()
    test_off_mode()
