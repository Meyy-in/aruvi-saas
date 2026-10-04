"""
Tests for email replies → Support inbox (api/mail_sync.py, 2026-10-03): a reply to a case mail in
support@'s Gmail is found over IMAP, its quoted history is stripped, and it joins its case once,
from her address only, reopening the case. A fake IMAP box stands in for Gmail.

Run standalone:  python3 tests/test_mail_sync.py     (also pytest-compatible)
"""
from __future__ import annotations

import os
import sys
import tempfile
from email.message import EmailMessage as _Mail

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ARUVI_STATE_DIR", tempfile.mkdtemp(prefix="aruvi-test-state-"))
os.environ.setdefault("ARUVI_WA_VERIFY_TOKEN", "test-verify")
os.environ.setdefault("ARUVI_WA_APP_SECRET", "test-secret")
os.environ.setdefault("ARUVI_SUPPORT_INBOX_PASSWORD", "correct horse")

from api.mail_sync import MailSync, fetch_replies, parse_reply, strip_quoted  # noqa: E402


def _raw(subject, sender, body, mid, html=None, date="Sat, 03 Oct 2026 21:34:20 +0530", extra=None):
    m = _Mail()
    m["Subject"], m["From"], m["To"] = subject, sender, "support@meyy.in"
    m["Message-ID"], m["Date"] = mid, date
    for k, v in (extra or {}).items():
        m[k] = v
    m.set_content(body)
    if html:
        m.add_alternative(html, subtype="html")
    return m.as_bytes()


GMAIL_REPLY = ("Thank you, but I am not fully convinced.\nThe paths still overlap.\n\n"
               "On Sat, 3 Oct 2026 at 21:30, MEYY support <\nsupport@meyy.in> wrote:\n\n"
               "> Hello Kumar,\n> The plan is correct.\n")


class FakeBox:
    def __init__(self, msgs):
        self.msgs, self.calls = msgs, []

    def __call__(self, host):
        self.calls.append(("connect", host))
        return self

    def login(self, u, p):
        if p == "bad":
            raise Exception("b'[AUTHENTICATIONFAILED] Invalid credentials (Failure)'")

    def select(self, box, readonly=False):
        assert readonly, "the mailbox must be opened read-only"
        return "OK", [b"3"]

    def search(self, charset, *crit):
        if "NOT" in crit:            # fresh mail: no reference in the subject
            hits = [str(i + 1).encode() for i, r in enumerate(self.msgs)
                    if b"MEY-S-" not in r.split(b"\n\n")[0] and b"ARV-S-" not in r.split(b"\n\n")[0]]
            return "OK", [b" ".join(hits)]
        word = crit[-1].strip('"')
        hits = [str(i + 1).encode() for i, r in enumerate(self.msgs) if word.encode() in r]
        return "OK", [b" ".join(hits)]

    def fetch(self, num, what):
        assert "PEEK" in what, "fetching must not mark mail read"
        raw = self.msgs[int(num) - 1]
        if "HEADER" in what:
            raw = raw.split(b"\n\n", 1)[0] + b"\n\n"
        return "OK", [(b"1 (BODY[] {n}", raw), b")"]

    def logout(self):
        pass


def test_strip_quoted_and_parse():
    assert strip_quoted(GMAIL_REPLY) == "Thank you, but I am not fully convinced.\nThe paths still overlap."
    r = parse_reply(_raw("Re: [MEY-S-772] We have your message — Meyy support",
                         "Kumar R <Kumar@Example.com>", GMAIL_REPLY, "<a1@mail.gmail.com>"))
    assert r["ref"] == "MEY-S-772" and r["sender"] == "kumar@example.com"
    assert r["message_id"] == "<a1@mail.gmail.com>" and r["at"].startswith("2026-10-03T16:04:20")
    assert parse_reply(_raw("Hello", "a@b.c", "no ref", "<x>")) is None
    h = parse_reply(_raw("Re: [MEY-S-9] x", "a@b.c", "", "<h>",
                         html="<div>Still wrong<br>see unit 3</div><div class=\"gmail_quote\">old</div>"))
    assert h["text"] == "Still wrong\nsee unit 3"
    print("✓ Quoted history is stripped; the reference, sender and time are read")


def test_fetch_is_read_only_and_finds_both_series():
    box = FakeBox([_raw("Re: [MEY-S-772] x", "a@b.c", "one", "<1>"),
                   _raw("Re: [ARV-S-745] x", "a@b.c", "two", "<2>"),
                   _raw("Newsletter", "n@x.y", "three", "<3>")])
    got = fetch_replies("imap.gmail.com", "support@meyy.in", "pw", imap_factory=box)
    assert sorted(r["ref"] for r in got) == ["ARV-S-745", "MEY-S-772"]
    print("✓ Read-only fetch finds MEY-S and ARV-S replies, ignores other mail")


def test_sync_files_her_reply_once_and_reports_auth_errors():
    from fastapi.testclient import TestClient
    import api.main as m
    from aruvi_core.ports import SupportRequest
    ref = m.support_repo.next_reference()
    m.support_repo.save(SupportRequest(
        reference=ref, tenant_id="9800000401", user_id="9800000401", category="plan",
        category_label="Something in a lesson plan looks wrong", message="Robot paths overlap.",
        created_at="2026-10-03T10:00:00+00:00", email="kumar@example.com", name="Kumar",
        status="answered"))
    box = FakeBox([
        _raw(f"Re: [{ref}] We have your message", "Kumar <kumar@example.com>", GMAIL_REPLY, "<r1>"),
        _raw(f"[{ref}] Something in a lesson plan looks wrong — Kumar", "MEYY support <support@meyy.in>",
             "Reply to: kumar@example.com\n----\nRobot paths overlap.", "<copy>"),   # our own copy
    ])
    ms = MailSync(m.support_inbox, "imap.gmail.com", "support@meyy.in", "pw",
                  fetch=lambda h, u, p, **kw: fetch_replies(h, u, p, imap_factory=box))
    old = m.support_inbox.mail_sync
    m.support_inbox.mail_sync = ms
    try:
        c = TestClient(m.app, base_url="https://testserver")
        c.post("/support-inbox/login", data={"password": "correct horse"}, follow_redirects=False)
        st = c.post("/support-inbox/api/mail/sync", headers={"X-Meyy-Inbox": "1"}).json()
        assert st["added"] == 1 and st["error"] == ""
        st = c.post("/support-inbox/api/mail/sync", headers={"X-Meyy-Inbox": "1"}).json()
        assert st["added"] == 0                                         # the same mail, not again
        cs = m.support_repo.find(ref)
        ins = [t["text"] for t in cs.thread if t["dir"] == "in"]
        assert cs.status == "open" and ins == ["Thank you, but I am not fully convinced.\nThe paths still overlap."]
        item = next(i for i in c.get("/support-inbox/api/queue").json()["items"] if i["id"] == ref)
        assert item["needs_reply"]
        ms.password = "bad"
        st = c.post("/support-inbox/api/mail/sync", headers={"X-Meyy-Inbox": "1"}).json()
        assert "refused the sign-in" in st["error"]
        assert c.get("/support-inbox/api/queue").json()["mail_sync"]["error"]
        assert c.__class__(m.app, base_url="https://testserver").post("/support-inbox/api/mail/sync").status_code == 401
    finally:
        m.support_inbox.mail_sync = old
    print("✓ Sync files her reply once (not our own copy), reopens the case, reports a refused sign-in")



def test_fresh_mail_from_a_teacher_opens_a_case_and_strangers_are_left_alone():
    from fastapi.testclient import TestClient
    from datetime import datetime, timedelta, timezone
    from email.utils import format_datetime
    import api.main as m
    from aruvi_core.ports import Account
    m.account_repo.save(Account(account_id="9800000501", tenant_id="9800000501", display_name="Lata",
                                email="lata@example.com", phone="9800000501"))
    now = format_datetime(datetime.now(timezone.utc))
    old = format_datetime(datetime.now(timezone.utc) - timedelta(days=30))
    sent = []
    orig = m.notifier.send
    m.notifier.send = lambda msg: (sent.append(msg), {"status": "sent"})[1]
    box = FakeBox([
        _raw("Cannot download my plan", "Lata <Lata@Example.com>", "The PDF button does nothing.", "<f1>", date=now),
        _raw("Hello", "stranger@else.com", "Who are you?", "<f2>", date=now),
        _raw("Out of office", "lata@example.com", "Away", "<f3>", date=now, extra={"Auto-Submitted": "auto-replied"}),
        _raw("Old mail", "lata@example.com", "Before the switch-on", "<f4>", date=old),
    ])
    ms = MailSync(m.support_inbox, "imap.gmail.com", "support@meyy.in", "pw",
                  fetch=lambda h, u, p, **kw: fetch_replies(h, u, p, imap_factory=box, **kw))
    ms.floor = lambda: datetime.now(timezone.utc) - timedelta(hours=1)
    try:
        st = ms.run_once()
        assert st["error"] == "" and st["added"] == 1, st
        cases = m.support_repo.load_all("9800000501", "9800000501")
        assert len(cases) == 1 and cases[0].category == "other"
        assert cases[0].message.startswith("Cannot download my plan") and "PDF button" in cases[0].message
        assert cases[0].context["mail_id"] == "<f1>"
        assert any(x.to == "lata@example.com" and cases[0].reference in x.subject for x in sent), "acknowledged"
        assert ms.run_once()["added"] == 0                              # never twice
        ms.skip.clear()
        assert ms.run_once()["added"] == 0                              # not even after a restart
        assert len(m.support_repo.load_all("9800000501", "9800000501")) == 1
    finally:
        m.notifier.send = orig
    print("✓ Fresh mail from a teacher on record opens a case once; strangers, auto-replies, old mail ignored")

if __name__ == "__main__":
    test_strip_quoted_and_parse()
    test_fetch_is_read_only_and_finds_both_series()
    test_sync_files_her_reply_once_and_reports_auth_errors()
    test_fresh_mail_from_a_teacher_opens_a_case_and_strangers_are_left_alone()
