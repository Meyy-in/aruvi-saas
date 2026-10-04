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
        assert len(reps) == 1 and reps[0]["ref"].startswith("MEY-W-") and int(reps[0]["ref"].rsplit("-", 1)[1]) >= 1234 and reps[0]["report"]["unit"] == "Unit 1"
        assert t["last_ref"] == reps[0]["ref"]
        acks = [b for b in sent if reps[0]["ref"] in b]
        assert len(acks) == 1 and len(sent) == 1, "the acknowledgement replaces the greeting"
        # the greeting and the acknowledgement are automatic: she still NEEDS A REPLY
        item = next(i for i in c.get("/support-inbox/api/queue", headers=BEARER).json()["items"]
                    if i["id"] == "9800000303~" + reps[0]["ref"])
        assert item["needs_reply"] and item["ref"] == reps[0]["ref"]
    finally:
        m.wa_client.send_text, m.notifier.send = orig_wa, orig_mail
    print("✓ A WhatsApp report gets one MEY-W reference, parsed rows and one acknowledgement")


def test_a_follow_up_reopens_a_resolved_whatsapp_thread_without_a_new_number():
    m, c, _ = _setup()
    orig_wa, orig_mail = m.wa_client.send_text, m.notifier.send
    m.wa_client.send_text = lambda to, body: {"status": "sent", "message_id": "x"}
    m.notifier.send = lambda msg: {"status": "sent"}
    try:
        m.support_inbox.on_message({"from": "919800000304", "id": "f1", "type": "text",
            "text": {"body": "Problem in: Class VIII · Science · Stars · Unit 2\n\nWrong date"}})
        ref = m.wa_inbox_repo.load("9800000304")["last_ref"]
        m.wa_inbox_repo.patch_issue("9800000304", ref, status="done")
        m.support_inbox.on_message({"from": "919800000304", "id": "f2", "type": "text",
                                    "text": {"body": "I do not agree with your answer"}})
        t = m.wa_inbox_repo.load("9800000304")
        assert t["issues"][ref]["status"] == "open" and t["last_ref"] == ref
        assert [x.get("ref") for x in t["messages"] if x.get("ref")] == [ref]
    finally:
        m.wa_client.send_text, m.notifier.send = orig_wa, orig_mail
    print("✓ A follow-up reopens a resolved thread and keeps its reference")


def test_an_email_reply_joins_its_case_once_and_reopens_it():
    m, c, ref = _setup()
    m.support_repo.find(ref)
    cs = m.support_repo.find(ref); cs.status = "answered"; m.support_repo.save(cs)
    body = {"text": "I do not agree.", "message_id": "gm-1", "sender": "Asha@Example.com"}
    assert c.post(f"/support-inbox/api/case/{ref}/inbound", json=body, headers=BEARER).json()["status"] == "added"
    assert c.post(f"/support-inbox/api/case/{ref}/inbound", json=body, headers=BEARER).json()["status"] == "duplicate"
    assert c.post(f"/support-inbox/api/case/{ref}/inbound",
                  json={**body, "message_id": "gm-2", "sender": "someone@else.com"}, headers=BEARER).status_code == 409
    cs = m.support_repo.find(ref)
    assert cs.status == "open" and [t["text"] for t in cs.thread if t["dir"] == "in"] == ["I do not agree."]
    item = next(i for i in c.get("/support-inbox/api/queue", headers=BEARER).json()["items"] if i["id"] == ref)
    assert item["needs_reply"]
    print("✓ Her email reply joins its case once, from her address only, and reopens it")



def test_new_message_retires_a_stale_ai_draft_and_a_resend_is_one_message():
    m, c, ref = _setup()
    m.support_inbox.set_draft("case", ref, "Old AI answer", by="claude")
    body = {"text": "I do not agree.", "message_id": "<s1>", "sender": "asha@example.com"}
    assert c.post(f"/support-inbox/api/case/{ref}/inbound", json=body, headers=BEARER).json()["status"] == "added"
    assert m.support_repo.find(ref).draft == {}
    again = {**body, "message_id": "<s2>", "text": "I do not  agree.\n"}
    assert c.post(f"/support-inbox/api/case/{ref}/inbound", json=again, headers=BEARER).json()["status"] == "duplicate"
    m.support_inbox.set_draft("case", ref, "Kumar typing", by="founder")
    c.post(f"/support-inbox/api/case/{ref}/inbound", json={**body, "message_id": "<s3>", "text": "Also Q8."},
           headers=BEARER)
    assert m.support_repo.find(ref).draft["text"] == "Kumar typing"
    # WhatsApp: same rule; Meta re-delivering the SAME message does not clear a fresh draft.
    n = "9800000307"
    m.support_inbox.on_message({"from": "91" + n, "id": "w1", "type": "text",
                                "text": {"body": "Problem in: Class III · English · Shapes · Unit 1\n\nStar"}})
    r = m.wa_inbox_repo.load(n)["last_ref"]
    m.support_inbox.set_draft("wa", f"{n}~{r}", "AI reply", by="claude")
    m.support_inbox.on_message({"from": "91" + n, "id": "w1", "type": "text", "text": {"body": "x"}})
    assert m.wa_inbox_repo.load(n)["issues"][r]["draft"]["text"] == "AI reply"
    m.support_inbox.on_message({"from": "91" + n, "id": "w2", "type": "text", "text": {"body": "Anyone?"}})
    assert not m.wa_inbox_repo.load(n)["issues"][r].get("draft")
    print("✓ Her new message retires a stale AI draft (not the founder's); a resend is one message")


def test_each_whatsapp_report_is_its_own_issue_with_only_its_messages():
    m, c, _ = _setup()
    n = "9800000305"
    orig_wa, orig_mail = m.wa_client.send_text, m.notifier.send
    m.wa_client.send_text = lambda to, body: {"status": "sent", "message_id": "o" + str(abs(hash(body)))}
    m.notifier.send = lambda msg: {"status": "sent"}
    try:
        say = lambda mid, body: m.support_inbox.on_message({"from": "91" + n, "id": mid, "type": "text",
                                                            "text": {"body": body}})
        say("g1", "Hello, a general question")
        g = m.wa_inbox_repo.load(n)["last_ref"]                 # a first plain message is its own issue
        say("r1", "Problem in: Class III · English · Paper Boats · Unit 6\n\nFirst issue")
        r1 = m.wa_inbox_repo.load(n)["last_ref"]
        say("r2", "Problem in: Class III · English · Paper Boats · Unit 6\n\nA second issue")
        r2 = m.wa_inbox_repo.load(n)["last_ref"]
        assert r1 != r2
        q = {i["id"]: i for i in c.get("/support-inbox/api/queue", headers=BEARER).json()["items"]
             if i.get("number") == n}
        assert set(q) == {f"{n}~{g}", f"{n}~{r1}", f"{n}~{r2}"}
        assert q[f"{n}~{r1}"]["needs_reply"] and q[f"{n}~{r2}"]["needs_reply"]
        assert q[f"{n}~{r2}"]["unread"] and not q[f"{n}~{r1}"]["unread"]
        t2 = c.get(f"/support-inbox/api/thread/{n}~{r2}", headers=BEARER).json()
        texts = [x["text"] for x in t2["messages"]]
        assert any("A second issue" in x for x in texts) and not any("First issue" in x or "general" in x for x in texts)
        assert t2["ref"] == r2 and t2["category"] == "plan"
        # the founder answers the FIRST issue after the second arrived: it stays in the first
        _login(c)
        assert c.post(f"/support-inbox/api/thread/{n}~{r1}/reply", json={"text": "About your first issue"},
                      headers=H).json()["status"] == "sent"
        t1 = c.get(f"/support-inbox/api/thread/{n}~{r1}", headers=BEARER).json()
        assert t1["messages"][-1]["text"] == f"Re {r1}\n\nAbout your first issue"
        assert not any("About your first issue" in x["text"] for x in
                                                c.get(f"/support-inbox/api/thread/{n}~{r2}", headers=BEARER).json()["messages"])
        # resolving one issue leaves the other open; drafts are per issue
        c.post(f"/support-inbox/api/thread/{n}~{r1}/label", json={"status": "done"}, headers=H)
        c.post("/support-inbox/api/draft", json={"kind": "wa", "id": f"{n}~{r2}", "text": "Draft 2"}, headers=BEARER)
        q = {i["id"]: i for i in c.get("/support-inbox/api/queue", headers=BEARER).json()["items"]
             if i.get("number") == n}
        assert q[f"{n}~{r1}"]["status"] == "done" and q[f"{n}~{r2}"]["status"] == "open"
        assert q[f"{n}~{r2}"]["has_draft"] and not q[f"{n}~{r1}"]["has_draft"] and not q[f"{n}~{g}"]["has_draft"]
        # a plain follow-up joins the LATEST report
        say("f1", "Any update?")
        assert c.get(f"/support-inbox/api/thread/{n}~{r2}", headers=BEARER).json()["messages"][-1]["text"] == "Any update?"
    finally:
        m.wa_client.send_text, m.notifier.send = orig_wa, orig_mail
    print("✓ Each WhatsApp report is its own issue: own row, own messages, own status and draft")


def test_support_header_opens_an_issue_and_the_cap_counts_email_and_whatsapp_together():
    m, c, _ = _setup()
    from aruvi_core.ports import SupportRequest
    n = "9800000306"
    orig_wa, orig_mail = m.wa_client.send_text, m.notifier.send
    sent = []
    m.wa_client.send_text = lambda to, body: (sent.append(body), {"status": "sent", "message_id": f"s{len(sent)}"})[1]
    m.notifier.send = lambda msg: {"status": "sent"}
    try:
        say = lambda mid, body: m.support_inbox.on_message({"from": "91" + n, "id": mid, "type": "text",
                                                            "text": {"body": body}})
        say("a1", "Support: Billing or account\nSign-in: 98000 00306\n\nI was charged twice")
        t = m.wa_inbox_repo.load(n)
        r1 = t["last_ref"]
        msg = next(x for x in t["messages"] if x.get("ref") == r1)
        assert msg["support"] == {"about": "Billing or account", "signin": "98000 00306"}
        assert t["issues"][r1]["category"] == "billing"
        assert any(r1 in b for b in sent), "acknowledged with its number"
        # four email cases today → five requests in all: the cap is reached
        for k in range(4):
            ref = m.support_repo.next_reference()
            m.support_repo.save(SupportRequest(reference=ref, tenant_id=n, user_id=n, category="other",
                                               category_label="Something else", message=f"e{k}",
                                               created_at=__import__("datetime").datetime.now(
                                                   __import__("datetime").timezone.utc).isoformat()))
        assert m.support_inbox.new_today(n) == 5 and m.support_inbox.over_cap(n)
        say("a2", "Problem in: Class III · English · Paper Boats · Unit 6\n\nSixth one")
        t = m.wa_inbox_repo.load(n)
        assert t["last_ref"] == r1, "past the cap a fresh request joins her latest issue"
        assert [x["text"] for x in t["messages"] if x.get("id") == "a2"]
        m.config.TEST_SUPPORT_UNCAPPED = {n}
        assert not m.support_inbox.over_cap(n)
    finally:
        m.config.TEST_SUPPORT_UNCAPPED = set()
        m.wa_client.send_text, m.notifier.send = orig_wa, orig_mail
    print("✓ A Support: message opens its own issue; the cap counts email and WhatsApp together")


def test_plain_whatsapp_messages_are_routed_to_the_right_issue_or_open_a_new_one():
    m, c, _ = _setup()
    from api.support_inbox import route_message
    n = "9800000308"
    sent = []
    orig_wa, orig_mail = m.wa_client.send_text, m.notifier.send
    m.wa_client.send_text = lambda to, body: (sent.append(body), {"status": "sent", "message_id": f"out{len(sent)}"})[1]
    m.notifier.send = lambda msg: {"status": "sent"}
    try:
        say = lambda mid, body, **kw: m.support_inbox.on_message({"from": "91" + n, "id": mid, "type": "text",
                                                                  "text": {"body": body}, **kw})
        load = lambda: m.wa_inbox_repo.load(n)
        issue_of = lambda mid: next(r for r, x in __import__("api.support_inbox", fromlist=["x"]).issues_of(
            load()["messages"]) if x.get("id") == mid)
        # a first plain message is a FRESH request: its own number and an acknowledgement
        say("p1", "Hello, the app will not open")
        a = load()["last_ref"]
        assert a and issue_of("p1") == a and load()["issues"][a]["category"] == "other"
        assert any(a in b for b in sent)
        say("p2", "It shows a white screen")                  # one open issue → joins it
        assert issue_of("p2") == a
        say("r1", "Problem in: Class III · English · Shapes · Unit 1\n\nStar missing")
        b = load()["last_ref"]
        assert b != a
        # we answer A (after B arrived): our reply names A; her swipe-reply to it goes to A
        _login(c)
        c.post(f"/support-inbox/api/thread/{n}~{a}/reply", json={"text": "Please update the app"}, headers=H)
        ours = load()["messages"][-1]
        assert ours["text"].startswith(f"Re {a}\n\n") and issue_of(ours["id"]) == a
        say("p3", "Done, thanks", context={"id": ours["id"]})
        assert issue_of("p3") == a
        say("p4", f"About {b.lower()}: also the moon")       # quoting a reference → that issue
        assert issue_of("p4") == b
        say("p5", "Any news?")                               # two open → the one we last answered
        assert issue_of("p5") == a
        # both resolved: within 3 days she reopens the latest resolved; later it is a NEW issue
        c.post(f"/support-inbox/api/thread/{n}~{a}/label", json={"status": "done"}, headers=H)
        c.post(f"/support-inbox/api/thread/{n}~{b}/label", json={"status": "done"}, headers=H)
        say("p6", "I do not agree")
        assert issue_of("p6") == b and load()["issues"][b]["status"] == "open"
        t = load()
        later = __import__("datetime").datetime.now(__import__("datetime").timezone.utc) + __import__("datetime").timedelta(days=4)
        t["issues"][b]["status"] = "done"
        assert route_message(t, {"id": "z"}, "New question", now=later) is None
    finally:
        m.wa_client.send_text, m.notifier.send = orig_wa, orig_mail
    print("✓ Plain WhatsApp messages: swipe-reply, quoted reference, open issue, recent reopen, else new")

if __name__ == "__main__":
    test_queue_lists_both_kinds_and_needs_auth()
    test_token_drafts_but_can_never_send_or_close()
    test_founder_email_reply_threads_and_uses_up_the_draft()
    test_whatsapp_report_is_numbered_parsed_and_acknowledged_once()
    test_a_follow_up_reopens_a_resolved_whatsapp_thread_without_a_new_number()
    test_an_email_reply_joins_its_case_once_and_reopens_it()
    test_new_message_retires_a_stale_ai_draft_and_a_resend_is_one_message()
    test_each_whatsapp_report_is_its_own_issue_with_only_its_messages()
    test_support_header_opens_an_issue_and_the_cap_counts_email_and_whatsapp_together()
    test_plain_whatsapp_messages_are_routed_to_the_right_issue_or_open_a_new_one()
