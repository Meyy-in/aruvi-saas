"""
Tests for the WhatsApp Support inbox (2026-09-30) — api/support_inbox.py.

  1. A customer message is STORED in her thread, GREETED once (not again inside the gap, never
     for STOP), and ALERTS the founder once per conversation per half hour.
  2. Delivery statuses land on the right message and never move backwards.
  3. The page and its API are closed without the password; the login sets a session; a
     wrong password is refused and throttled; writes need the inbox header.
  4. Replies go out only inside WhatsApp's 24-hour window.
  5. Her conversation is erased with her account.

Run standalone:  python3 tests/test_support_inbox.py     (also pytest-compatible)
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_TMP_STATE = tempfile.mkdtemp(prefix="aruvi-test-state-")
os.environ.setdefault("ARUVI_STATE_DIR", _TMP_STATE)
os.environ.setdefault("ARUVI_WA_VERIFY_TOKEN", "test-verify")
os.environ.setdefault("ARUVI_WA_APP_SECRET", "test-secret")
os.environ.setdefault("ARUVI_SUPPORT_INBOX_PASSWORD", "correct horse")

PW = os.environ["ARUVI_SUPPORT_INBOX_PASSWORD"]


def _client():
    from fastapi.testclient import TestClient
    import api.main as m
    return m, TestClient(m.app, base_url="https://testserver")


def _hook(c, messages=None, statuses=None, contacts=None, pn=None):
    import api.main as m
    pn = m.config.WA_PHONE_NUMBER_ID if pn is None else pn
    body = json.dumps({"entry": [{"changes": [{"field": "messages", "value": {
        "metadata": {"phone_number_id": pn},
        "messages": messages or [], "statuses": statuses or [], "contacts": contacts or []}}]}]}).encode()
    sig = "sha256=" + hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()
    return c.post("/whatsapp/webhook", content=body, headers={"X-Hub-Signature-256": sig})


def _msg(frm, text, mid):
    return {"from": frm, "id": mid, "type": "text", "text": {"body": text}}


def _login(c):
    return c.post("/support-inbox/login", data={"password": PW}, follow_redirects=False)


def test_inbound_is_stored_greeted_once_and_alerts_once():
    m, c = _client()
    sent_mail = []
    orig = m.notifier.send
    m.notifier.send = lambda msg: (sent_mail.append(msg), {"status": "sent"})[1]
    try:
        assert _hook(c, [_msg("919800000201", "My assessment answer key has an error", "w1")],
                     contacts=[{"wa_id": "919800000201", "profile": {"name": "Priya"}}]).status_code == 200
        t = m.wa_inbox_repo.load("9800000201")
        texts = [(x["dir"], x.get("by", ""), x["text"]) for x in t["messages"]]
        assert texts[0] == ("in", "", "My assessment answer key has an error")
        assert texts[1][:2] == ("out", "auto-greeting") and "not calls" in texts[1][2]
        assert t["name"] == "Priya" and t["unread"] == 1
        assert len(sent_mail) == 1 and "Priya" in sent_mail[0].subject
        # a second message minutes later: no second greeting, no second alert
        _hook(c, [_msg("919800000201", "It is in chapter 4", "w2")])
        t = m.wa_inbox_repo.load("9800000201")
        assert [x.get("by") for x in t["messages"]].count("auto-greeting") == 1
        assert len(sent_mail) == 1 and t["unread"] == 2
        # Meta re-delivering the same message id is not a new message
        _hook(c, [_msg("919800000201", "It is in chapter 4", "w2")])
        assert len(m.wa_inbox_repo.load("9800000201")["messages"]) == 3
    finally:
        m.notifier.send = orig


def test_stop_is_not_greeted():
    m, c = _client()
    _hook(c, [_msg("919800000202", "STOP", "s1")])
    t = m.wa_inbox_repo.load("9800000202")
    assert [x["dir"] for x in t["messages"]] == ["in"]


def test_statuses_apply_and_never_go_backwards():
    m, c = _client()
    m.wa_inbox_repo.append("9800000203", {"id": "out1", "dir": "out", "type": "text", "text": "hi"})
    _hook(c, statuses=[{"id": "out1", "status": "read", "recipient_id": "919800000203"}])
    _hook(c, statuses=[{"id": "out1", "status": "delivered", "recipient_id": "919800000203"}])
    assert m.wa_inbox_repo.load("9800000203")["messages"][0]["status"] == "read"


def test_inbox_is_closed_without_login_and_throttles_bad_passwords():
    m, c = _client()
    r = c.get("/support-inbox")
    assert r.status_code == 200 and 'name="password"' in r.text and "<script>" not in r.text
    assert c.get("/support-inbox/api/threads").status_code == 401
    bad = c.post("/support-inbox/login", data={"password": "nope"}, follow_redirects=False)
    assert bad.status_code == 401
    ok = _login(c)
    assert ok.status_code == 303 and "meyy_inbox" in ok.headers.get("set-cookie", "")
    assert "httponly" in ok.headers["set-cookie"].lower() and "secure" in ok.headers["set-cookie"].lower()
    assert c.get("/support-inbox/api/threads").status_code == 200
    # a write without the inbox header is refused even when signed in
    assert c.post("/support-inbox/api/thread/9800000201/reply", json={"text": "x"}).status_code == 403


def test_reply_only_inside_the_24_hour_window():
    m, c = _client()
    _login(c)
    H = {"X-Meyy-Inbox": "1"}
    _hook(c, [_msg("919800000204", "Hello", "r1")])
    r = c.post("/support-inbox/api/thread/9800000204/reply", json={"text": "We are looking into it."}, headers=H)
    assert r.status_code == 200, r.text
    t = c.get("/support-inbox/api/thread/9800000204").json()
    assert t["messages"][-1]["text"] == "We are looking into it." and t["unread"] == 0
    # age her last message past 24 hours
    old = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
    m.wa_inbox_repo.patch("9800000204", last_inbound_at=old)
    r = c.post("/support-inbox/api/thread/9800000204/reply", json={"text": "Still there?"}, headers=H)
    assert r.status_code == 409 and "24 hours" in r.json()["detail"]


def test_window_is_per_business_number_and_other_numbers_are_ignored():
    m, c = _client()
    _login(c)
    old = m.config.WA_PHONE_NUMBER_ID
    try:
        m.config.WA_PHONE_NUMBER_ID = "PN-NEW"
        # a message to a number Meyy no longer sends from is not filed
        _hook(c, [_msg("919800000207", "to the old number", "o1")], pn="PN-OLD")
        assert m.wa_inbox_repo.load("9800000207") is None
        # to the current number: filed, window open
        _hook(c, [_msg("919800000207", "to the new number", "o2")], pn="PN-NEW")
        t = c.get("/support-inbox/api/thread/9800000207").json()
        assert t["window_open"] is True
        # if the sending number changes, the old window no longer counts
        m.config.WA_PHONE_NUMBER_ID = "PN-OTHER"
        t = c.get("/support-inbox/api/thread/9800000207").json()
        assert t["window_open"] is False
    finally:
        m.config.WA_PHONE_NUMBER_ID = old


def test_reopen_template_sends_her_first_name_when_the_window_is_closed():
    m, c = _client()
    _login(c)
    old = m.config.WA_REOPEN_TEMPLATE
    try:
        m.config.WA_REOPEN_TEMPLATE = "meyy_followup"
        _hook(c, [_msg("919800000208", "hello", "f1")],
              contacts=[{"wa_id": "919800000208", "profile": {"name": "Geetha R"}}])
        r = c.post("/support-inbox/api/thread/9800000208/reopen", headers={"X-Meyy-Inbox": "1"})
        assert r.status_code == 200, r.text
        last = m.wa_inbox_repo.load("9800000208")["messages"][-1]
        assert last.get("template") == "meyy_followup" and "Hello Geetha" in last["text"]
    finally:
        m.config.WA_REOPEN_TEMPLATE = old


def test_conversation_is_erased_with_the_account():
    m, c = _client()
    _hook(c, [_msg("919800000205", "hi", "e1")])
    assert m.wa_inbox_repo.load("9800000205") is not None
    h = {"X-Aruvi-User": "9800000205"}
    c.post("/onboarding/verified", headers=h, json={})
    r = c.post("/data-rights/erase", headers=h, json={"confirm": "erase", "downloaded_confirmed": True})
    assert r.status_code == 200, r.text
    assert m.wa_inbox_repo.load("9800000205") is None


def test_day_log_holds_no_message_text():
    m, c = _client()
    _hook(c, [_msg("919800000206", "a private sentence", "d1")])
    d = os.path.join(m.config.STATE_DIR, "whatsapp_inbox")
    text = "".join(open(os.path.join(d, f)).read() for f in os.listdir(d))
    assert "a private sentence" not in text


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn(); print("ok", name)
