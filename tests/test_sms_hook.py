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



def _subscriber(m, n, *, status="active", whatsapp=True, email="t@example.com"):
    from aruvi_core.ports import Account, Entitlement
    m.account_repo.save(Account(account_id=n, tenant_id=n, display_name="T", email=email, phone=n,
                                notify={"whatsapp": whatsapp}))
    m.entitlement_repo.save(n, Entitlement(plan_id="trial" if status == "trial" else "individual_annual",
                                           status=status, scopes=["*"]))


def _capture(m):
    wa, mail = [], []
    old = (m.wa_client.send_template, m.notifier.send)
    m.wa_client.send_template = lambda t: (wa.append(t), {"status": "sent"})[1]
    m.notifier.send = lambda e: (mail.append(e), {"status": "sent"})[1]
    return wa, mail, lambda: (setattr(m.wa_client, "send_template", old[0]), setattr(m.notifier, "send", old[1]))


def test_subscriber_gets_the_same_code_on_one_second_channel():
    m, c = _client()
    n = "9800000601"
    _subscriber(m, n)
    wa, mail, undo = _capture(m)
    old_tpl = m.config.WA_OTP_TEMPLATE
    try:
        m.config.WA_OTP_TEMPLATE = "meyy_otp"
        # email on record → email, and only email (it costs nothing)
        assert m._otp_second_channel("91" + n, "482913") == "email"
        assert len(mail) == 1 and not wa and "482913" in mail[0].subject and mail[0].to == "t@example.com"
        # no email → WhatsApp, with the code in the body and on the copy-code button
        _subscriber(m, "9800000604", email="")
        assert m._otp_second_channel("919800000604", "555666") == "whatsapp"
        t = wa[0]
        assert t.template == "meyy_otp" and t.params == ["555666"] and t.code_button == "555666"
        from aruvi_core.adapters.cloud_whatsapp import CloudWhatsApp
        comps = CloudWhatsApp.payload(t, "919800000604")["template"]["components"]
        assert {"type": "button", "sub_type": "url", "index": "0",
                "parameters": [{"type": "text", "text": "555666"}]} in comps
        # the mail failing → WhatsApp instead
        m.notifier.send = lambda e: {"status": "error", "error": "smtp"}
        assert m._otp_second_channel("91" + n, "111222") == "whatsapp"
        # no email and no template → nothing
        m.config.WA_OTP_TEMPLATE = ""
        assert m._otp_second_channel("919800000604", "333444") == ""
        # not opted into WhatsApp and no email → nothing; trial → nothing
        _subscriber(m, "9800000602", whatsapp=False, email="")
        assert m._otp_second_channel("919800000602", "1") == ""
        _subscriber(m, "9800000603", status="trial")
        assert m._otp_second_channel("919800000603", "1") == ""
        assert m._otp_second_channel("919800000699", "1") == ""   # no account at all
    finally:
        m.config.WA_OTP_TEMPLATE = old_tpl
        undo()


def test_sms_failure_still_succeeds_when_the_second_copy_went():
    m, c = _client()
    n = "9363795723"
    _subscriber(m, n, whatsapp=False)
    wa, mail, undo = _capture(m)
    calls, undo2 = _patch_post(_FakeResp(200, {"type": "error", "message": "DLT"}))
    try:
        r = c.post("/auth/sms-hook", content=BODY, headers=_signed(BODY))
        assert r.status_code == 200 and len(mail) == 1 and "482913" in mail[0].text
    finally:
        undo2(); undo()
        m.entitlement_repo.save(n, __import__("aruvi_core.ports", fromlist=["x"]).Entitlement(
            plan_id="trial", status="trial", scopes=["*"]))


def test_email_with_every_code_whatsapp_only_on_resend():
    m, c = _client()
    import time as _t
    n, w = "9800000611", "9800000612"
    _subscriber(m, n)                       # has email
    _subscriber(m, w, email="")             # WhatsApp only
    wa, mail, undo = _capture(m)
    calls, undo2 = _patch_post(_FakeResp(200, {"type": "success", "message": "r1"}))
    old_tpl = m.config.WA_OTP_TEMPLATE
    m.config.WA_OTP_TEMPLATE = "meyy_otp"

    def hook(num, code):
        b = json.dumps({"user": {"phone": "91" + num}, "sms": {"otp": code}}).encode()
        assert c.post("/auth/sms-hook", content=b, headers=_signed(b)).status_code == 200

    def wait(lst, k):
        for _ in range(30):
            if len(lst) >= k:
                return
            _t.sleep(0.1)
    try:
        m._OTP_LAST.clear()
        hook(n, "246810"); wait(mail, 1)
        assert len(mail) == 1 and "246810" in mail[0].subject, "email goes with the FIRST code too"
        hook(w, "135790"); _t.sleep(0.4)
        assert wa == [], "WhatsApp-only: the first code is SMS only"
        hook(w, "975310"); wait(wa, 1)
        assert len(wa) == 1 and wa[0].code_button == "975310", "…and the resend brings WhatsApp"
        assert m._otp_is_resend("91" + w, now=_t.time() + 3600) is False
    finally:
        m.config.WA_OTP_TEMPLATE = old_tpl
        undo2(); undo()

if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok", name)
