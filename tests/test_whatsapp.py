"""
Tests for the WhatsApp support channel (2026-09-26).

  1. OPT-IN IS STORED, AND EMAIL BECOMES OPTIONAL. A WhatsApp checkout with no email
     activates, stores the opt-in, and still sends the founder his sales log.
  2. THE WELCOME GOES ONCE. Checkout sends the approved template with her first name;
     adding it again never greets her twice; it can be switched off only while an email
     is on record, and an email can be cleared only while WhatsApp is on (one channel, always).
  3. THE WEBHOOK IS AUTHENTICATED. The GET handshake checks the verify token; an unsigned
     POST is refused (it can switch an opt-in off); a signed STOP withdraws the opt-in.
  4. THE CLOUD PAYLOAD HAS META'S SHAPE — pinned without a network.

Run standalone:  python3 tests/test_whatsapp.py     (also pytest-compatible)
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_TMP_STATE = tempfile.mkdtemp(prefix="aruvi-test-state-")
os.environ.setdefault("ARUVI_STATE_DIR", _TMP_STATE)
os.environ.setdefault("ARUVI_WA_VERIFY_TOKEN", "test-verify")
os.environ.setdefault("ARUVI_WA_APP_SECRET", "test-secret")

from aruvi_core.adapters.cloud_whatsapp import CloudWhatsApp  # noqa: E402
from aruvi_core.ports import WhatsAppTemplate  # noqa: E402


def _client():
    from fastapi.testclient import TestClient
    import api.main as m
    return m, TestClient(m.app)


def _subscribe(c, user, **extra):
    from api import legal
    h = {"X-Aruvi-User": user}
    c.post("/onboarding/verified", headers=h, json={})
    ver = c.get("/legal/consent/status", headers=h).json()["current_version"]
    c.post("/legal/consent", headers=h, json={
        "version": ver, "acknowledgements": legal.acknowledgement_ids(ver), "final": True})
    body = {"scopes": ["science/middle"], "name": "Priya S", "role": "Teacher",
            "state": "Tamil Nadu", "city": "Chennai", **extra}
    return c.post("/onboarding/checkout", headers=h, json=body)


def _outbox(m):
    d = os.path.join(m.config.STATE_DIR, "whatsapp_outbox")
    return sorted(os.listdir(d)) if os.path.isdir(d) else []


def test_whatsapp_checkout_without_email_welcomes_once_and_logs_for_founder():
    m, c = _client()
    sent = []
    orig = m.notifier.send
    m.notifier.send = lambda msg: (sent.append(msg), {"status": "sent"})[1]
    try:
        before = len(_outbox(m))
        r = _subscribe(c, "9800000101", whatsapp=True)
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["whatsapp"] is True and out["whatsapp_number"]
        assert out["whatsapp_welcome"] == "written"       # file outbox in tests
        acct = c.get("/account", headers={"X-Aruvi-User": "9800000101"}).json()
        assert acct["whatsapp"] is True and acct["email"] == ""
        files = _outbox(m)
        assert len(files) == before + 1
        msg = json.load(open(os.path.join(m.config.STATE_DIR, "whatsapp_outbox", files[-1])))
        assert msg["to"] == "919800000101" and msg["params"] == ["Priya"]
        # the founder's log went although she has no email, and names WhatsApp
        assert any("WhatsApp: YES" in s.text for s in sent), [s.subject for s in sent]
        h = {"X-Aruvi-User": "9800000101"}
        # AT LEAST ONE CHANNEL: no email on record → WhatsApp cannot be switched off
        off = c.post("/account/whatsapp", headers=h, json={"enabled": False})
        assert off.status_code == 409
        off2 = c.post("/account", headers=h, json={"whatsapp": False})
        assert off2.status_code == 409 and "at least one way" in off2.json()["detail"]
        assert c.get("/account", headers=h).json()["whatsapp"] is True
        # adding again never greets her twice
        again = c.post("/account/whatsapp", headers=h, json={"enabled": True}).json()
        assert again["welcome_status"] == "skipped"
        assert len(_outbox(m)) == before + 1
    finally:
        m.notifier.send = orig


def test_support_meta_reports_whatsapp_only_when_opted_in_and_it_can_be_added_later():
    m, c = _client()
    h = {"X-Aruvi-User": "9800000102"}
    _subscribe(c, "9800000102", whatsapp=False, email="x9800000102@example.com")
    meta = c.get("/support", headers=h).json()
    assert meta["whatsapp"] is False and meta["whatsapp_number"]
    assert c.post("/account/whatsapp", headers=h, json={"enabled": True}).status_code == 200
    assert c.get("/support", headers=h).json()["whatsapp"] is True


def test_one_channel_always_in_personal_profile():
    m, c = _client()
    h = {"X-Aruvi-User": "9800000104"}
    _subscribe(c, "9800000104", whatsapp=True)
    # adding an email opens the way off — in the SAME save or later
    r = c.post("/account", headers=h, json={"email": "t9800000104@example.com", "whatsapp": False})
    assert r.status_code == 200, r.text
    a = c.get("/account", headers=h).json()
    assert a["whatsapp"] is False and a["email"] == "t9800000104@example.com"
    # and now the email cannot be cleared, because it is her only channel
    assert c.post("/account", headers=h, json={"email": ""}).status_code == 409
    # switching WhatsApp back on is always allowed, and then the email may go
    assert c.post("/account", headers=h, json={"whatsapp": True}).status_code == 200
    assert c.post("/account", headers=h, json={"email": ""}).status_code == 200


def test_webhook_handshake_and_signature():
    m, c = _client()
    ok = c.get("/whatsapp/webhook", params={"hub.mode": "subscribe",
               "hub.verify_token": "test-verify", "hub.challenge": "123"})
    assert ok.status_code == 200 and ok.text == "123"
    bad = c.get("/whatsapp/webhook", params={"hub.mode": "subscribe",
                "hub.verify_token": "nope", "hub.challenge": "123"})
    assert bad.status_code == 403
    _subscribe(c, "9800000103", whatsapp=True)
    body = json.dumps({"entry": [{"changes": [{"value": {"messages": [
        {"from": "919800000103", "type": "text", "text": {"body": "STOP"}}]}}]}]}).encode()
    assert c.post("/whatsapp/webhook", content=body).status_code == 401
    sig = "sha256=" + hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()
    assert c.post("/whatsapp/webhook", content=body,
                  headers={"X-Hub-Signature-256": sig}).status_code == 200
    assert c.get("/account", headers={"X-Aruvi-User": "9800000103"}).json()["whatsapp"] is False


def test_cloud_payload_shape():
    p = CloudWhatsApp.payload(WhatsAppTemplate(
        to="x", template="meyy_welcome", params=["Priya"],
        document={"link": "https://x/inv.pdf", "filename": "inv.pdf"}), "919800000101")
    assert p["messaging_product"] == "whatsapp" and p["type"] == "template"
    assert p["to"] == "919800000101"
    comps = p["template"]["components"]
    assert comps[0]["type"] == "header" and comps[0]["parameters"][0]["type"] == "document"
    assert comps[1] == {"type": "body", "parameters": [{"type": "text", "text": "Priya"}]}


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn(); print("ok", name)
