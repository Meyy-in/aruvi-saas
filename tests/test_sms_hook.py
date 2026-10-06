"""
Tests for the Supabase Send-SMS hook → MSG91 (2026-10-07).

  1. UNSIGNED OR WRONGLY SIGNED CALLS ARE REFUSED — anyone could otherwise spend our SMS credit.
  2. A STALE SIGNATURE IS REFUSED — a captured request cannot be replayed later.
  3. A SIGNED CALL SENDS THE CODE to the right number, under the right MSG91 template, with the
     variable named `otp` (the founder's Test DLT SMS arrived with an empty gap without it).
  4. AN MSG91 FAILURE BECOMES A NON-2XX, so Supabase reports "could not send" to the app.
  5. NOT CONFIGURED → 503, never a silent success.

Run standalone:  python3 tests/test_sms_hook.py     (also pytest-compatible)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ARUVI_STATE_DIR", tempfile.mkdtemp(prefix="aruvi-test-state-"))

_KEY = b"meyy-test-hook-key-32-bytes-long!"
SECRET = "v1,whsec_" + base64.b64encode(_KEY).decode()


def _client():
    from fastapi.testclient import TestClient
    import api.main as m
    m.config.SMS_HOOK_SECRET = SECRET
    m.config.MSG91_AUTHKEY = "test-authkey"
    m.config.MSG91_OTP_TEMPLATE_ID = "tpl-123"
    return m, TestClient(m.app)


def _signed(body: bytes, ts: int = 0, key: bytes = _KEY):
    ts = ts or int(time.time())
    mid = "msg_abc"
    sig = base64.b64encode(hmac.new(key, f"{mid}.{ts}.".encode() + body,
                                    hashlib.sha256).digest()).decode()
    return {"webhook-id": mid, "webhook-timestamp": str(ts), "webhook-signature": "v1," + sig,
            "content-type": "application/json"}


BODY = json.dumps({"user": {"id": "u1", "phone": "919363795723"},
                   "sms": {"otp": "482913"}}).encode()


class _FakeResp:
    def __init__(self, status, body):
        self.status_code, self._b, self.text = status, body, json.dumps(body)

    def json(self):
        return self._b


def _patch_post(answer):
    import aruvi_core.adapters.msg91_sms as mod
    calls = []

    def fake(url, json=None, timeout=None, headers=None):
        calls.append({"url": url, "json": json, "headers": headers})
        return answer
    old = mod.httpx.post
    mod.httpx.post = fake
    return calls, lambda: setattr(mod.httpx, "post", old)


def test_unsigned_and_badly_signed_are_refused():
    m, c = _client()
    calls, undo = _patch_post(_FakeResp(200, {"type": "success", "message": "r1"}))
    try:
        assert c.post("/auth/sms-hook", content=BODY).status_code == 401
        bad = _signed(BODY, key=b"some-other-key")
        assert c.post("/auth/sms-hook", content=BODY, headers=bad).status_code == 401
        assert calls == []
    finally:
        undo()


def test_stale_signature_is_refused():
    m, c = _client()
    calls, undo = _patch_post(_FakeResp(200, {"type": "success", "message": "r1"}))
    try:
        old = _signed(BODY, ts=int(time.time()) - 3600)
        assert c.post("/auth/sms-hook", content=BODY, headers=old).status_code == 401
        assert calls == []
    finally:
        undo()


def test_signed_call_sends_the_code_with_the_otp_variable():
    m, c = _client()
    calls, undo = _patch_post(_FakeResp(200, {"type": "success", "message": "r1"}))
    try:
        r = c.post("/auth/sms-hook", content=BODY, headers=_signed(BODY))
        assert r.status_code == 200, r.text
        assert len(calls) == 1
        sent = calls[0]
        assert sent["url"] == "https://control.msg91.com/api/v5/flow"
        assert sent["headers"]["authkey"] == "test-authkey"
        assert sent["json"]["template_id"] == "tpl-123"
        assert sent["json"]["recipients"] == [{"mobiles": "919363795723", "otp": "482913"}]
    finally:
        undo()


def test_msg91_failure_is_reported_as_failure():
    m, c = _client()
    calls, undo = _patch_post(_FakeResp(200, {"type": "error", "message": "Invalid authkey"}))
    try:
        r = c.post("/auth/sms-hook", content=BODY, headers=_signed(BODY))
        assert r.status_code == 502
        assert r.json()["error"]["http_code"] == 502
    finally:
        undo()


def test_not_configured_is_503():
    m, c = _client()
    m.config.MSG91_AUTHKEY = ""
    try:
        assert c.post("/auth/sms-hook", content=BODY, headers=_signed(BODY)).status_code == 503
    finally:
        m.config.MSG91_AUTHKEY = "test-authkey"


def test_number_normalisation():
    from aruvi_core.adapters.msg91_sms import indian_mobile
    assert indian_mobile("+91 93637 95723") == "919363795723"
    assert indian_mobile("9363795723") == "919363795723"
    assert indian_mobile("12345") == ""
    assert indian_mobile("447700900123") == ""


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok", name)
