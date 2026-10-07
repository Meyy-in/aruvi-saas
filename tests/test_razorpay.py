"""
Tests for the Razorpay web subscriptions (2026-10-07).

What must never go wrong with money: a forged "paid" is refused; one payment grants once
(the browser's verify and Razorpay's webhook race each other); a yearly renewal moves each
subject-stage on by a year from where it ends; and once Razorpay is on, the old no-money
checkout is closed to everyone but the founder's test numbers.

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

KEY_ID, KEY_SECRET, PLAN, WH_SECRET = "rzp_test_abc", "sekret", "plan_X", "whsec"


def _sig(secret: str, msg: bytes) -> str:
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


class _Resp:
    def __init__(self, code, data):
        self.status_code, self._d, self.text = code, data, json.dumps(data)

    def json(self):
        return self._d


def _client(monkey_subs):
    """A TestClient with Razorpay switched on and the HTTP call to Razorpay faked."""
    from fastapi.testclient import TestClient
    from api import main as api_main
    cfg = api_main.config
    cfg.RAZORPAY_KEY_ID, cfg.RAZORPAY_KEY_SECRET = KEY_ID, KEY_SECRET
    cfg.RAZORPAY_PLAN_ID, cfg.RAZORPAY_WEBHOOK_SECRET = PLAN, WH_SECRET
    cfg.MANUAL_CHECKOUT_NUMBERS = ["+91 90000 00001"]
    calls = []

    def fake_post(url, json=None, timeout=None, auth=None):
        calls.append({"url": url, "json": json, "auth": auth})
        sid = f"sub_T{len(calls)}"
        monkey_subs.append(sid)
        return _Resp(200, {"id": sid, "short_url": "https://rzp.io/x"})
    rg.httpx.post = fake_post
    return TestClient(api_main.app, raise_server_exceptions=True), api_main, calls


def _off(api_main):
    cfg = api_main.config
    cfg.RAZORPAY_KEY_ID = cfg.RAZORPAY_KEY_SECRET = cfg.RAZORPAY_PLAN_ID = ""
    cfg.RAZORPAY_WEBHOOK_SECRET = ""
    cfg.MANUAL_CHECKOUT_NUMBERS = []


BODY = {"scopes": ["science/middle", "english/middle"], "name": "Rz Teacher",
        "email": "rz@example.com", "role": "Teacher", "state": "Kerala", "city": "Kochi",
        "school": "KV"}


def test_signatures():
    assert rg.verify_payment_signature(KEY_SECRET, "pay_1", "sub_1",
                                       _sig(KEY_SECRET, b"pay_1|sub_1"))
    assert not rg.verify_payment_signature(KEY_SECRET, "pay_1", "sub_1", "00")
    assert not rg.verify_payment_signature("", "pay_1", "sub_1", "x")
    raw = b'{"event":"x"}'
    assert rg.verify_webhook_signature(WH_SECRET, raw, _sig(WH_SECRET, raw))
    assert not rg.verify_webhook_signature(WH_SECRET, raw + b" ", _sig(WH_SECRET, raw))
    print("✓ Razorpay signatures: good accepted, forged refused")


def test_start_verify_once_and_webhook_renewal():
    subs = []
    c, api_main, calls = _client(subs)
    try:
        H = {"X-Aruvi-User": "9000000099"}
        accept_current(c, H)
        ent = c.get("/entitlement", headers=H).json()
        assert ent["payment_provider"] == "razorpay" and ent["razorpay_key_id"] == KEY_ID

        # The no-money checkout is closed to her …
        r = c.post("/onboarding/checkout", headers=H, json=BODY)
        assert r.status_code == 409 and "meyy.in" in r.json()["detail"]

        # … start makes ONE subscription, quantity = cart size, and grants nothing yet.
        st = c.post("/payments/razorpay/start", headers=H, json=BODY).json()
        assert st["subscription_id"] == subs[-1] and st["key_id"] == KEY_ID
        assert calls[-1]["json"]["quantity"] == 2 and calls[-1]["json"]["plan_id"] == PLAN
        assert calls[-1]["auth"] == (KEY_ID, KEY_SECRET)
        assert st["amount_inr"] == 2 * api_main.config.PRICE_PER_SUBJECT_STAGE
        assert c.get("/entitlement", headers=H).json()["status"] == "trial"

        sid, pid = st["subscription_id"], "pay_first"
        # A forged signature grants nothing.
        bad = c.post("/payments/razorpay/verify", headers=H, json={
            "razorpay_payment_id": pid, "razorpay_subscription_id": sid,
            "razorpay_signature": "forged"})
        assert bad.status_code == 400
        # Another teacher cannot claim her payment, even with a good signature.
        good = {"razorpay_payment_id": pid, "razorpay_subscription_id": sid,
                "razorpay_signature": _sig(KEY_SECRET, f"{pid}|{sid}".encode())}
        assert c.post("/payments/razorpay/verify", headers={"X-Aruvi-User": "Thief"},
                      json=good).status_code == 404

        out = c.post("/payments/razorpay/verify", headers=H, json=good).json()
        assert out["status"] == "active" and set(out["added"]) == set(BODY["scopes"])
        inv1 = out["invoice_number"]
        assert inv1.startswith("MEY/")
        year = (date.today() + timedelta(days=365)).isoformat()
        assert all(v == year for v in out["scope_valid_until"].values())

        # The webhook for the SAME payment (the race) changes nothing.
        evt = {"event": "subscription.charged", "payload": {
            "subscription": {"entity": {"id": sid, "notes": {}}},
            "payment": {"entity": {"id": pid}}}}
        raw = json.dumps(evt).encode()
        w = c.post("/payments/razorpay/webhook", content=raw,
                   headers={"X-Razorpay-Signature": _sig(WH_SECRET, raw),
                            "Content-Type": "application/json"})
        assert w.status_code == 200
        invs = c.get("/invoices", headers=H).json()["invoices"]
        assert len(invs) == 1, "one payment, one invoice"
        # A verify retried by the browser is the same answer too.
        again = c.post("/payments/razorpay/verify", headers=H, json=good).json()
        assert again["invoice_number"] == inv1

        # A bad webhook signature is refused.
        assert c.post("/payments/razorpay/webhook", content=raw,
                      headers={"X-Razorpay-Signature": "nope"}).status_code == 400

        # Next year's charge: a NEW payment id extends each scope a year from its end.
        evt["payload"]["payment"]["entity"]["id"] = "pay_year2"
        raw2 = json.dumps(evt).encode()
        c.post("/payments/razorpay/webhook", content=raw2,
               headers={"X-Razorpay-Signature": _sig(WH_SECRET, raw2)})
        e2 = c.get("/entitlement", headers=H).json()
        two = (date.fromisoformat(year) + timedelta(days=365)).isoformat()
        for s in BODY["scopes"]:
            assert e2["scope_valid_until"][s] == two, e2
        invs = c.get("/invoices", headers=H).json()["invoices"]
        assert len(invs) == 2, "the renewal issues its own invoice"
        print("✓ Razorpay: start, verify once, race-safe webhook, yearly renewal")
    finally:
        _off(api_main)


def test_webhook_rebuilds_a_lost_start_record():
    subs = []
    c, api_main, _ = _client(subs)
    try:
        H = {"X-Aruvi-User": "9000000077"}
        accept_current(c, H)
        evt = {"event": "subscription.charged", "payload": {
            "subscription": {"entity": {"id": "sub_lost1", "notes": {
                "tenant_id": "9000000077", "user_id": "9000000077",
                "scopes": "science/middle"}}},
            "payment": {"entity": {"id": "pay_lost1"}}}}
        raw = json.dumps(evt).encode()
        c.post("/payments/razorpay/webhook", content=raw,
               headers={"X-Razorpay-Signature": _sig(WH_SECRET, raw)})
        e = c.get("/entitlement", headers=H).json()
        assert e["status"] == "active" and "science/middle" in e["scopes"]
        print("✓ Razorpay: a paid charge is granted even if the start record is gone")
    finally:
        _off(api_main)


def test_manual_checkout_allowlist_and_off_mode():
    subs = []
    c, api_main, _ = _client(subs)
    try:
        H = {"X-Aruvi-User": "919000000001"}      # on the allowlist (last 10 digits)
        accept_current(c, H)
        r = c.post("/onboarding/checkout", headers=H, json=dict(BODY, email="al@example.com"))
        assert r.status_code == 200 and r.json()["status"] == "active", r.json()
    finally:
        _off(api_main)
    # Razorpay off: the start endpoint refuses, the manual checkout is open as before.
    H2 = {"X-Aruvi-User": "9000000055"}
    accept_current(c, H2)
    assert c.post("/payments/razorpay/start", headers=H2, json=BODY).status_code == 409
    assert c.get("/entitlement", headers=H2).json()["payment_provider"] == "manual"
    print("✓ Manual checkout: allowlisted while Razorpay is on, open when it is off")


if __name__ == "__main__":
    test_signatures()
    test_start_verify_once_and_webhook_renewal()
    test_webhook_rebuilds_a_lost_start_record()
    test_manual_checkout_allowlist_and_off_mode()
