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
        assert sent == [], "nothing is sent while her burst may still be going on"
        later = __import__("datetime").datetime.now(__import__("datetime").timezone.utc) + __import__("datetime").timedelta(minutes=16)
        m.support_inbox.send_due_acks(now=later)
        assert len(sent) == 1 and reps[0]["ref"] not in sent[0], "one acknowledgement, no reference"
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
        assert t1["messages"][-1]["text"] == "About your first issue"
        assert t1["messages"][-1]["reply_to"] == "r1", "a quote-reply to her message in that issue"
        assert not any("About your first issue" in x["text"] for x in
                                                c.get(f"/support-inbox/api/thread/{n}~{r2}", headers=BEARER).json()["messages"])
        # resolving one issue leaves the other open; drafts are per issue
        c.post(f"/support-inbox/api/thread/{n}~{r1}/label", json={"status": "done"}, headers=H)
        c.post("/support-inbox/api/draft", json={"kind": "wa", "id": f"{n}~{r2}", "text": "Draft 2"}, headers=BEARER)
        q = {i["id"]: i for i in c.get("/support-inbox/api/queue", headers=BEARER).json()["items"]
             if i.get("number") == n}
        assert q[f"{n}~{r1}"]["status"] == "done" and q[f"{n}~{r2}"]["status"] == "open"
        assert q[f"{n}~{r2}"]["has_draft"] and not q[f"{n}~{r1}"]["has_draft"] and not q[f"{n}~{g}"]["has_draft"]
        # a plain message straight after our reply on the FIRST issue answers that reply
        say("f1", "Any update?")
        assert c.get(f"/support-inbox/api/thread/{n}~{r1}", headers=BEARER).json()["messages"][-1]["text"] == "Any update?"
    finally:
        m.wa_client.send_text, m.notifier.send = orig_wa, orig_mail
    print("✓ Each WhatsApp report is its own issue: own row, own messages, own status and draft")


def _age(m, n, minutes):
    """Move a chat back in time — as if `minutes` had passed since every message in it."""
    from datetime import datetime, timedelta
    def shift(th):
        for x in th.get("messages") or []:
            x["at"] = (datetime.fromisoformat(x["at"]) - timedelta(minutes=minutes)).isoformat()
        if th.get("last_inbound_at"):
            th["last_inbound_at"] = (datetime.fromisoformat(th["last_inbound_at"]) - timedelta(minutes=minutes)).isoformat()
    m.wa_inbox_repo.update(n, shift)


class _Wa:
    def __init__(self, m):
        self.m, self.sent = m, []
    def __enter__(self):
        self.orig = (self.m.wa_client.send_text, self.m.notifier.send)
        self.m.wa_client.send_text = lambda to, body, **kw: (self.sent.append((body, kw)),
                                                             {"status": "sent", "message_id": f"out{len(self.sent)}"})[1]
        self.m.notifier.send = lambda msg: {"status": "sent"}
        return self
    def __exit__(self, *a):
        self.m.wa_client.send_text, self.m.notifier.send = self.orig


def _issue_of(m, n, mid):
    from api.support_inbox import issues_of
    return next(r for r, x in issues_of(m.wa_inbox_repo.load(n)["messages"]) if x.get("id") == mid)


def test_app_messages_always_open_an_issue_and_there_is_no_daily_cap():
    m, c, _ = _setup()
    n = "9800000306"
    with _Wa(m):
        say = lambda mid, body: m.support_inbox.on_message({"from": "91" + n, "id": mid, "type": "text",
                                                            "text": {"body": body}})
        say("a1", "Support: Billing or account\nSign-in: 98000 00306\n\nI was charged twice")
        t = m.wa_inbox_repo.load(n)
        r1 = t["last_ref"]
        msg = next(x for x in t["messages"] if x.get("ref") == r1)
        assert msg["support"] == {"about": "Billing or account", "signin": "98000 00306"}
        assert t["issues"][r1]["category"] == "billing"
        refs = {r1}
        for k in range(7):                                   # far past the old five-a-day cap
            say(f"b{k}", f"Problem in: Class III · English · Paper Boats · Unit {k + 1}\n\nIssue {k}")
            refs.add(m.wa_inbox_repo.load(n)["last_ref"])
        assert len(refs) == 8, "every message from the app is its own issue, however many"
    print("✓ App messages always open their own issue; no daily cap")


def test_plain_messages_join_only_on_clear_evidence():
    m, c, _ = _setup()
    n = "9800000308"
    with _Wa(m) as wa:
        say = lambda mid, body, **kw: m.support_inbox.on_message({"from": "91" + n, "id": mid, "type": "text",
                                                                  "text": {"body": body}, **kw})
        say("p1", "Hi")
        a = m.wa_inbox_repo.load(n)["last_ref"]
        say("p2", "The unit 3 plan is wrong")                 # same burst
        assert _issue_of(m, n, "p2") == a
        _age(m, n, 20)
        say("p3", "How do I change periods?")                 # 20 min later: a NEW issue
        b = m.wa_inbox_repo.load(n)["last_ref"]
        assert b != a and _issue_of(m, n, "p3") == b
        # we answer A; within 30 minutes what she writes answers that reply
        _age(m, n, 60)
        _login(c)
        c.post(f"/support-inbox/api/thread/{n}~{a}/reply", json={"text": "Which class?"}, headers=H)
        ours = m.wa_inbox_repo.load(n)["messages"][-1]
        assert ours["reply_to"] == "p2" and "MEY" not in ours["text"]
        say("p4", "Class 7")
        assert _issue_of(m, n, "p4") == a
        # hours later: a swipe-reply still finds its issue; a typed reference too
        _age(m, n, 300)
        say("p5", "Still wrong", context={"id": ours["id"]})
        assert _issue_of(m, n, "p5") == a
        _age(m, n, 300)
        say("p6", f"about mey {b.rsplit('-', 1)[1]}: any news?")
        assert _issue_of(m, n, "p6") == b
        # and a stray message hours later with no evidence is new — with a merge hint
        _age(m, n, 300)
        say("p7", "It still doesn't work")
        cnew = m.wa_inbox_repo.load(n)["last_ref"]
        assert cnew not in (a, b)
        th = c.get(f"/support-inbox/api/thread/{n}~{cnew}").json()
        assert th["hint"] and th["hint"]["ref"] == a and {o["ref"] for o in th["others"]} == {a, b}
    print("✓ Plain messages join only on a swipe, a reference, a burst or an answer to us; else new")


def test_acknowledgement_waits_for_the_burst_and_fits_what_she_said():
    m, c, _ = _setup()
    from datetime import datetime, timedelta, timezone
    with _Wa(m) as wa:
        def say(n, mid, body):
            m.support_inbox.on_message({"from": "91" + n, "id": mid, "type": "text", "text": {"body": body}})
        later = lambda: datetime.now(timezone.utc) + timedelta(minutes=16)
        say("9800000401", "g1", "Hi")                              # only a greeting → an invitation
        say("9800000402", "t1", "Thanks 🙏")                        # only thanks → nothing
        say("9800000403", "q1", "Hello")
        say("9800000403", "q2", "Why is LCM asked here?")          # a question → the acknowledgement
        assert m.support_inbox.send_due_acks() == 0                 # not before 15 quiet minutes
        m.support_inbox.send_due_acks(now=later())
        by = {}
        for n in ("9800000401", "9800000402", "9800000403"):
            by[n] = [x["text"] for x in m.wa_inbox_repo.load(n)["messages"] if x.get("by") == "auto-ack"]
        assert len(by["9800000401"]) == 1 and "what you need" in by["9800000401"][0]
        assert by["9800000402"] == []
        assert len(by["9800000403"]) == 1 and "received" in by["9800000403"][0]
        # at most three a day per number
        n = "9800000404"
        for k in range(5):
            say(n, f"x{k}", f"Problem in: Class III · English · Shapes · Unit {k + 1}\n\nQ{k}")
            _age(m, n, 20)
            m.support_inbox.send_due_acks()
        assert sum(1 for x in m.wa_inbox_repo.load(n)["messages"] if x.get("by") == "auto-ack") == 3
    print("✓ The acknowledgement waits for the burst, fits what she said, at most three a day")


def test_merge_and_split():
    m, c, _ = _setup()
    n = "9800000309"
    with _Wa(m):
        say = lambda mid, body: m.support_inbox.on_message({"from": "91" + n, "id": mid, "type": "text",
                                                            "text": {"body": body}})
        say("s1", "The LCM question is wrong")
        a = m.wa_inbox_repo.load(n)["last_ref"]
        _age(m, n, 30)
        say("s2", "It is in unit 4")
        b = m.wa_inbox_repo.load(n)["last_ref"]
        say("s3", "Also, how do I download a plan?")         # same burst as s2 — joined to b
        _login(c)
        r = c.post(f"/support-inbox/api/thread/{n}~{b}/merge", json={"into": a}, headers=H)
        assert r.status_code == 200 and r.json()["id"] == f"{n}~{a}"
        q = {i["id"] for i in c.get("/support-inbox/api/queue").json()["items"] if i.get("number") == n}
        assert q == {f"{n}~{a}"}
        texts = [x["text"] for x in c.get(f"/support-inbox/api/thread/{n}~{a}").json()["messages"]]
        assert texts == ["The LCM question is wrong", "It is in unit 4", "Also, how do I download a plan?"]
        # the merged reference still routes: she types it, it lands in a
        _age(m, n, 120)
        say("s4", f"About MEY-W-{b.rsplit('-', 1)[1]}")
        assert _issue_of(m, n, "s4") == a
        # split the download question (and what followed it) off into a new issue
        r = c.post(f"/support-inbox/api/thread/{n}~{a}/split", json={"message_id": "s3"}, headers=H)
        new = r.json()["id"].split("~")[1]
        assert _issue_of(m, n, "s3") == new and _issue_of(m, n, "s4") == new and _issue_of(m, n, "s2") == a
        assert c.post(f"/support-inbox/api/thread/{n}~{a}/split", json={"message_id": "s1"}, headers=H).status_code == 400
        assert c.post(f"/support-inbox/api/thread/{n}~{a}/merge", json={"into": a}, headers=BEARER).status_code in (401, 403)
    print("✓ Merge folds an issue in (its reference still routes); split moves a topic out")


if __name__ == "__main__":
    test_queue_lists_both_kinds_and_needs_auth()
    test_token_drafts_but_can_never_send_or_close()
    test_founder_email_reply_threads_and_uses_up_the_draft()
    test_whatsapp_report_is_numbered_parsed_and_acknowledged_once()
    test_a_follow_up_reopens_a_resolved_whatsapp_thread_without_a_new_number()
    test_an_email_reply_joins_its_case_once_and_reopens_it()
    test_new_message_retires_a_stale_ai_draft_and_a_resend_is_one_message()
    test_each_whatsapp_report_is_its_own_issue_with_only_its_messages()
    test_app_messages_always_open_an_issue_and_there_is_no_daily_cap()
    test_plain_messages_join_only_on_clear_evidence()
    test_acknowledgement_waits_for_the_burst_and_fits_what_she_said()
    test_merge_and_split()
