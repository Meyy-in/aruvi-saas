"""
Tests for Razorpay web payments — pay once for a year (2026-10-07).

What must never go wrong with money: a forged "paid" is refused; one payment grants once
(the browser's verify and Razorpay's webhook race each other); renewing early starts the
new year where the old one ends; and once Razorpay is on, the old no-money checkout is
closed to everyone but the founder's test numbers.

Run standalone:  python3 tests/test_razorpay.py     (also pytest-compatible)
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import tempfile
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_TMP_STATE = tempfile.mkdtemp(prefix="aruvi-test-razorpay-")
os.environ.setdefault("ARUVI_STATE_DIR", _TMP_STATE)

from aruvi_core.adapters import razorpay_gateway as rg  # noqa: E402
from tests.test_consent import accept_current  # noqa: E402

KEY_ID, KEY_SECRET, WH_SECRET = "rzp_test_abc", "sekret", "whsec"


def _sig(secret: str, msg: bytes) -> str:
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


class _Resp:
    def __init__(self, code, data):
        self.status_code, self._d, self.text = code, data, json.dumps(data)

    def json(self):
        return self._d


def _client():
    """A TestClient with Razorpay switched on and the HTTP call to Razorpay faked."""
    from fastapi.testclient import TestClient
    from api import main as api_main
    cfg = api_main.config
    cfg.RAZORPAY_KEY_ID, cfg.RAZORPAY_KEY_SECRET = KEY_ID, KEY_SECRET
    cfg.RAZORPAY_WEBHOOK_SECRET = WH_SECRET
    cfg.MANUAL_CHECKOUT_NUMBERS = ["+91 90000 00001"]
    calls = []

    def fake_post(url, json=None, timeout=None, auth=None):
        calls.append({"url": url, "json": json, "auth": auth})
        return _Resp(200, {"id": f"order_T{len(calls)}_{os.getpid()}",
                           "amount": json["amount"]})
    rg.httpx.post = fake_post
    return TestClient(api_main.app, raise_server_exceptions=True), api_main, calls


def _off(api_main):
    cfg = api_main.config
    cfg.RAZORPAY_KEY_ID = cfg.RAZORPAY_KEY_SECRET = cfg.RAZORPAY_WEBHOOK_SECRET = ""
    cfg.MANUAL_CHECKOUT_NUMBERS = []


def _hook(c, evt):
    raw = json.dumps(evt).encode()
    return c.post("/payments/razorpay/webhook", content=raw,
                  headers={"X-Razorpay-Signature": _sig(WH_SECRET, raw)})


def _paid_evt(order_id, pay_id, notes=None):
    return {"event": "order.paid", "payload": {
        "order": {"entity": {"id": order_id, "notes": notes or {}}},
        "payment": {"entity": {"id": pay_id, "order_id": order_id}}}}


BODY = {"scopes": ["science/middle", "english/middle"], "name": "Rz Teacher",
        "email": "rz@example.com", "role": "Teacher", "state": "Kerala", "city": "Kochi",
        "school": "KV"}


def test_signatures():
    assert rg.verify_payment_signature(KEY_SECRET, "order_1", "pay_1",
                                       _sig(KEY_SECRET, b"order_1|pay_1"))
    assert not rg.verify_payment_signature(KEY_SECRET, "order_1", "pay_1", "00")
    assert not rg.verify_payment_signature("", "order_1", "pay_1", "x")
    raw = b'{"event":"x"}'
    assert rg.verify_webhook_signature(WH_SECRET, raw, _sig(WH_SECRET, raw))
    assert not rg.verify_webhook_signature(WH_SECRET, raw + b" ", _sig(WH_SECRET, raw))
    print("✓ Razorpay signatures: good accepted, forged refused")


def test_start_verify_once_and_race():
    c, api_main, calls = _client()
    try:
        H = {"X-Aruvi-User": "9000000099"}
        accept_current(c, H)
        ent = c.get("/entitlement", headers=H).json()
        assert ent["payment_provider"] == "razorpay" and ent["razorpay_key_id"] == KEY_ID

        # The no-money checkout is closed to her …
        r = c.post("/onboarding/checkout", headers=H, json=BODY)
        assert r.status_code == 409 and "meyy.in" in r.json()["detail"]

        # … start makes ONE order for cart x price, and grants nothing yet.
        P = api_main.config.PRICE_PER_SUBJECT_STAGE
        st = c.post("/payments/razorpay/start", headers=H, json=BODY).json()
        assert calls[-1]["url"].endswith("/orders")
        assert calls[-1]["json"]["amount"] == 2 * P * 100 and calls[-1]["json"]["currency"] == "INR"
        assert calls[-1]["auth"] == (KEY_ID, KEY_SECRET)
        assert st["amount_paise"] == 2 * P * 100 and st["key_id"] == KEY_ID
        assert c.get("/entitlement", headers=H).json()["status"] == "trial"

        oid, pid = st["order_id"], "pay_first"
        bad = c.post("/payments/razorpay/verify", headers=H, json={
            "razorpay_payment_id": pid, "razorpay_order_id": oid,
            "razorpay_signature": "forged"})
        assert bad.status_code == 400
        good = {"razorpay_payment_id": pid, "razorpay_order_id": oid,
                "razorpay_signature": _sig(KEY_SECRET, f"{oid}|{pid}".encode())}
        # Another teacher cannot claim her payment, even with a good signature.
        assert c.post("/payments/razorpay/verify", headers={"X-Aruvi-User": "Thief"},
                      json=good).status_code == 404

        out = c.post("/payments/razorpay/verify", headers=H, json=good).json()
        assert out["status"] == "active" and set(out["added"]) == set(BODY["scopes"])
        year = (date.today() + timedelta(days=365)).isoformat()
        assert all(v == year for v in out["scope_valid_until"].values())

        # The webhook for the same order (the race), and a retried verify: nothing new.
        assert _hook(c, _paid_evt(oid, pid)).status_code == 200
        again = c.post("/payments/razorpay/verify", headers=H, json=good).json()
        assert again["invoice_number"] == out["invoice_number"]
        assert len(c.get("/invoices", headers=H).json()["invoices"]) == 1
        # A bad webhook signature is refused.
        assert c.post("/payments/razorpay/webhook", content=b"{}",
                      headers={"X-Razorpay-Signature": "nope"}).status_code == 400
        # A live subject far from its end cannot be bought again.
        r = c.post("/payments/razorpay/start", headers=H,
                   json=dict(BODY, scopes=["science/middle"]))
        assert r.status_code == 409 and "renew it from" in r.json()["detail"]
        print("✓ Razorpay: order, verify once, race-safe webhook, no double purchase")
    finally:
        _off(api_main)


def test_early_renewal_extends_from_the_end():
    c, api_main, _ = _client()
    try:
        H = {"X-Aruvi-User": "9000000088"}
        accept_current(c, H)
        # She holds Science·Middle ending in 10 days (inside the 30-day window).
        ends = (date.today() + timedelta(days=10)).isoformat()
        api_main.billing_provider.create_subscription(
            "9000000088", "individual_annual", scopes=["science/middle"],
            valid_until=ends, source="razorpay")
        ent = c.get("/entitlement", headers=H).json()
        assert ent["renewable_scopes"] == ["science/middle"]
        st = c.post("/payments/razorpay/start", headers=H,
                    json=dict(BODY, scopes=["science/middle"],
                              email="renew@example.com")).json()
        oid = st["order_id"]
        _hook(c, _paid_evt(oid, "pay_renew"))
        e2 = c.get("/entitlement", headers=H).json()
        want = (date.fromisoformat(ends) + timedelta(days=365)).isoformat()
        assert e2["scope_valid_until"]["science/middle"] == want, e2
        print("✓ Razorpay: renewing early starts the new year where the old one ends")
    finally:
        _off(api_main)


def test_webhook_rebuilds_a_lost_start_record():
    c, api_main, _ = _client()
    try:
        H = {"X-Aruvi-User": "9000000077"}
        accept_current(c, H)
        _hook(c, _paid_evt("order_lost1", "pay_lost1", notes={
            "tenant_id": "9000000077", "user_id": "9000000077", "scopes": "science/middle"}))
        e = c.get("/entitlement", headers=H).json()
        assert e["status"] == "active" and "science/middle" in e["scopes"]
        print("✓ Razorpay: a paid order is granted even if the start record is gone")
    finally:
        _off(api_main)


def test_manual_checkout_allowlist_and_off_mode():
    c, api_main, _ = _client()
    try:
        H = {"X-Aruvi-User": "919000000001"}      # on the allowlist (last 10 digits)
        accept_current(c, H)
        # a test number sees the no-money checkout on the website; anyone else sees Razorpay
        assert c.get("/entitlement", headers=H).json()["payment_provider"] == "manual"
        Hx = {"X-Aruvi-User": "9000000077"}
        accept_current(c, Hx)
        assert c.get("/entitlement", headers=Hx).json()["payment_provider"] == "razorpay"
        r = c.post("/onboarding/checkout", headers=H, json=dict(BODY, email="al@example.com"))
        assert r.status_code == 200 and r.json()["status"] == "active", r.json()
    finally:
        _off(api_main)
    H2 = {"X-Aruvi-User": "9000000055"}
    accept_current(c, H2)
    assert c.post("/payments/razorpay/start", headers=H2, json=BODY).status_code == 409
    assert c.get("/entitlement", headers=H2).json()["payment_provider"] == "manual"
    print("✓ Manual checkout: allowlisted while Razorpay is on, open when it is off")


if __name__ == "__main__":
    test_signatures()
    test_start_verify_once_and_race()
    test_early_renewal_extends_from_the_end()
    test_webhook_rebuilds_a_lost_start_record()
    test_manual_checkout_allowlist_and_off_mode()
