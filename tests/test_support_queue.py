"""
Tests for the integrated Support inbox (2026-10-03): one queue for WhatsApp conversations and
email cases, email replies from the inbox, drafts written by the drafting session's token, and
the human gate — the token can read and draft, never send or close.

Run standalone:  python3 tests/test_support_queue.py     (also pytest-compatible)
"""
from __future__ import annotations

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ARUVI_STATE_DIR", tempfile.mkdtemp(prefix="aruvi-test-state-"))
os.environ.setdefault("ARUVI_WA_VERIFY_TOKEN", "test-verify")
os.environ.setdefault("ARUVI_WA_APP_SECRET", "test-secret")
os.environ.setdefault("ARUVI_SUPPORT_INBOX_PASSWORD", "correct horse")

TOKEN = "draft-token-for-tests"
H = {"X-Meyy-Inbox": "1"}
BEARER = {"Authorization": f"Bearer {TOKEN}"}


def _setup():
    from fastapi.testclient import TestClient
    import api.main as m
    from aruvi_core.ports import SupportRequest
    m.config.SUPPORT_DRAFT_TOKEN = TOKEN
    c = TestClient(m.app, base_url="https://testserver")
    ref = m.support_repo.next_reference()
    m.support_repo.save(SupportRequest(
        reference=ref, tenant_id="9800000301", user_id="9800000301", category="plan",
        category_label="Something in a lesson plan looks wrong", message="Q7 guide is wrong.",
        created_at="2026-10-03T10:00:00+00:00", email="asha@example.com", name="Asha Rao",
        context={"subject": "mathematics", "grade": "IX", "unit": "Unit 3", "plan_ref": "IX-MAT-02-U3"}))
    m.wa_inbox_repo.append("9800000302", {"id": "q1", "dir": "in", "type": "text", "text": "Hello"}, name="Meena")
    return m, c, ref


def _login(c):
    c.post("/support-inbox/login", data={"password": os.environ["ARUVI_SUPPORT_INBOX_PASSWORD"]},
           follow_redirects=False)


def test_queue_lists_both_kinds_and_needs_auth():
    m, c, ref = _setup()
    assert c.get("/support-inbox/api/queue").status_code == 401
    assert c.get("/support-inbox/api/queue", headers={"Authorization": "Bearer wrong"}).status_code == 401
    items = c.get("/support-inbox/api/queue", headers=BEARER).json()["items"]
    kinds = {(i["kind"], i["id"]) for i in items}
    assert ("case", ref) in kinds and ("wa", "9800000302") in kinds
    case = next(i for i in items if i["id"] == ref)
    assert case["needs_reply"] and case["category"] == "plan" and case["name"] == "Asha Rao"
    print("✓ One queue, both kinds, closed without a session or the token")


def test_token_drafts_but_can_never_send_or_close():
    m, c, ref = _setup()
    sent = []
    orig = m.notifier.send
    m.notifier.send = lambda msg: (sent.append(msg), {"status": "sent"})[1]
    try:
        r = c.post("/support-inbox/api/draft", json={"kind": "case", "id": ref, "text": "Hello Asha, thank you."},
                   headers=BEARER)
        assert r.status_code == 200
        assert m.support_repo.find(ref).draft["by"] == "claude"
        r = c.post("/support-inbox/api/draft", json={"kind": "wa", "id": "9800000302", "text": "Hi Meena",
                   "category": "billing"}, headers=BEARER)
        assert r.status_code == 200 and m.wa_inbox_repo.load("9800000302")["category"] == "billing"
        # the human gate: the token cannot send, reply or change status
        assert c.post(f"/support-inbox/api/case/{ref}/reply", json={"text": "x"}, headers=BEARER).status_code == 401
        assert c.post("/support-inbox/api/thread/9800000302/reply", json={"text": "x"}, headers=BEARER).status_code == 401
        assert c.post(f"/support-inbox/api/case/{ref}/label", json={"status": "closed"}, headers=BEARER).status_code == 401
        assert sent == []
        # reading a WhatsApp thread with the token does not mark it read
        c.get("/support-inbox/api/thread/9800000302", headers=BEARER)
        assert m.wa_inbox_repo.load("9800000302")["unread"] >= 1
    finally:
        m.notifier.send = orig
    print("✓ The drafting token reads and drafts; it cannot send, reply or close")


def test_founder_email_reply_threads_and_uses_up_the_draft():
    m, c, ref = _setup()
    _login(c)
    sent = []
    orig = m.notifier.send
    m.notifier.send = lambda msg: (sent.append(msg), {"status": "sent"})[1]
    try:
        c.post("/support-inbox/api/draft", json={"kind": "case", "id": ref, "text": "draft"}, headers=BEARER)
        r = c.post(f"/support-inbox/api/case/{ref}/reply",
                   json={"text": "Hello Asha,\n\nYou are right — fixed today."}, headers=H)
        assert r.status_code == 200, r.text
        assert len(sent) == 1 and sent[0].to == "asha@example.com"
        assert sent[0].subject == f"Re: [{ref}] We have your message — Meyy support"
        assert "fixed today" in sent[0].text and "Q7 guide is wrong." in sent[0].text
        assert "IX-MAT" not in sent[0].text, "the plan code stays internal"
        c_ = m.support_repo.find(ref)
        assert c_.status == "answered" and c_.draft == {} and c_.thread[-1]["by"] == "founder"
        item = next(i for i in c.get("/support-inbox/api/queue", headers=H).json()["items"] if i["id"] == ref)
        assert not item["needs_reply"]
        # close and reopen
        assert c.post(f"/support-inbox/api/case/{ref}/label", json={"status": "closed"}, headers=H).json()["status"] == "closed"
        assert c.post("/support-inbox/api/thread/9800000302/label", json={"status": "done"}, headers=H).status_code == 200
        assert m.wa_inbox_repo.load("9800000302")["status"] == "done"
    finally:
        m.notifier.send = orig
    print("✓ An email reply goes to her address, threads under the case, and clears the draft")


if __name__ == "__main__":
    test_queue_lists_both_kinds_and_needs_auth()
    test_token_drafts_but_can_never_send_or_close()
    test_founder_email_reply_threads_and_uses_up_the_draft()


def test_whatsapp_report_is_numbered_parsed_and_acknowledged_once():
    import hashlib, hmac, json
    from api.support_inbox import parse_report
    m, c, _ref = _setup()
    r = parse_report("Problem in: Class IX · Mathematics · Polynomials · Unit 3 · Phase 2\n\nQ7 is wrong")
    assert r == {"line": "Class IX · Mathematics · Polynomials · Unit 3 · Phase 2", "grade": "IX",
                 "subject": "Mathematics", "chapter": "Polynomials", "unit": "Unit 3", "phase": "Phase 2"}
    assert parse_report("Hello Meyy") is None
    sent = []
    orig_wa, orig_mail = m.wa_client.send_text, m.notifier.send
    m.wa_client.send_text = lambda to, body: (sent.append(body), {"status": "sent", "message_id": f"o{len(sent)}"})[1]
    m.notifier.send = lambda msg: {"status": "sent"}
    try:
        body = json.dumps({"entry": [{"changes": [{"field": "messages", "value": {
            "metadata": {"phone_number_id": m.config.WA_PHONE_NUMBER_ID},
            "messages": [{"from": "919800000303", "id": "rep1", "type": "text",
                          "text": {"body": "Problem in: Class III · English · Shapes · Unit 1 · Phase 2\n\nThe star is missing"}}],
            "statuses": [], "contacts": []}}]}]}).encode()
        sig = "sha256=" + hmac.new(b"test-secret", body, hashlib.sha256).hexdigest()
        for _ in range(2):   # Meta re-delivers: still ONE reference, ONE acknowledgement
            assert c.post("/whatsapp/webhook", content=body, headers={"X-Hub-Signature-256": sig}).status_code == 200
        t = m.wa_inbox_repo.load("9800000303")
        reps = [x for x in t["messages"] if x.get("ref")]
        assert len(reps) == 1 and reps[0]["ref"].startswith("MEY-W-") and reps[0]["report"]["unit"] == "Unit 1"
        assert t["last_ref"] == reps[0]["ref"]
        acks = [b for b in sent if reps[0]["ref"] in b]
        assert len(acks) == 1 and len(sent) == 1, "the acknowledgement replaces the greeting"
        # the greeting and the acknowledgement are automatic: she still NEEDS A REPLY
        item = next(i for i in c.get("/support-inbox/api/queue", headers=BEARER).json()["items"]
                    if i["id"] == "9800000303")
        assert item["needs_reply"] and item["ref"] == reps[0]["ref"]
    finally:
        m.wa_client.send_text, m.notifier.send = orig_wa, orig_mail
    print("✓ A WhatsApp report gets one MEY-W reference, parsed rows and one acknowledgement")
