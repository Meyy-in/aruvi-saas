"""
Email replies → the Support inbox (2026-10-03).

A teacher answers a case mail ("Re: [MEY-S-772] …") from her own mail app. That reply lands
in support@meyy.in's Gmail, not in the app — so the case looked answered while she was still
waiting. This module reads support@'s INBOX over IMAP (the same account and app password the
server already SENDS with), picks out replies whose subject carries a case reference, strips
the quoted history, and hands each to Inbox.case_inbound, which:
  * files it only if it came FROM the address on the case (anything else is ignored),
  * never files the same mail twice (the Message-ID is the key),
  * reopens the case so it shows under "Needs reply".

Read-only on the mailbox: it selects INBOX read-only and fetches with BODY.PEEK, so nothing is
marked read, moved or deleted in Gmail.
"""
from __future__ import annotations

import email
import email.policy
import html as _html
import imaplib
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr, parsedate_to_datetime
from typing import Any, Callable, Dict, List, Optional

REF_RE = re.compile(r"\[((?:MEY|ARV)-S-\d+)\]", re.I)

# Where the quoted history starts. Gmail wraps "On <date>, <name> <addr> wrote:" over two lines,
# so the first line alone ("On Sat, 3 Oct 2026 at 21:30, MEYY support <") must be enough.
_QUOTE_STARTS = [
    re.compile(r"^\s*On\b.{4,200}\bwrote:\s*$", re.I),
    re.compile(r"^\s*On\b.{4,200}<\s*$", re.I),                        # Gmail's wrapped header
    re.compile(r"^\s*-{2,}\s*Original Message\s*-{2,}", re.I),
    re.compile(r"^\s*-{2,}\s*Forwarded message\s*-{2,}", re.I),
    re.compile(r"^\s*From:\s.+", re.I),                                 # Outlook's header block
    re.compile(r"^\s*Sent from my \w+", re.I),
    re.compile(r"^\s*>"),
]


def strip_quoted(text: str) -> str:
    out = []
    for line in (text or "").replace("\r\n", "\n").split("\n"):
        if any(p.match(line) for p in _QUOTE_STARTS):
            break
        out.append(line.rstrip())
    body = "\n".join(out).strip()
    return re.sub(r"\n{3,}", "\n\n", body)


def _html_to_text(h: str) -> str:
    h = re.sub(r"(?is)<(script|style).*?</\1>", "", h)
    h = re.sub(r"(?is)<blockquote.*", "", h)                         # Gmail's quoted history
    h = re.sub(r"(?is)<div class=\"gmail_quote.*", "", h)
    h = re.sub(r"(?i)<br\s*/?>|</p>|</div>", "\n", h)
    return _html.unescape(re.sub(r"<[^>]+>", "", h))


def body_text(msg) -> str:
    part = msg.get_body(preferencelist=("plain",))
    if part is not None and part.get_content().strip():
        return part.get_content()
    part = msg.get_body(preferencelist=("html",))
    return _html_to_text(part.get_content()) if part is not None else ""


def parse_reply(raw: bytes) -> Optional[Dict[str, str]]:
    """One raw RFC 822 message → {ref, message_id, sender, at, text}, or None if it is not a
    reply to a case (no reference in the subject, or nothing left once the quote is gone)."""
    msg = email.message_from_bytes(raw, policy=email.policy.default)
    m = REF_RE.search(str(msg.get("Subject", "")))
    if not m:
        return None
    text = strip_quoted(body_text(msg))
    if not text:
        return None
    try:
        at = parsedate_to_datetime(str(msg.get("Date"))).astimezone(timezone.utc).isoformat()
    except Exception:                                                  # noqa: BLE001
        at = ""
    return {"ref": m.group(1).upper(), "message_id": str(msg.get("Message-ID", "")).strip(),
            "sender": parseaddr(str(msg.get("From", "")))[1].lower(), "at": at, "text": text[:8000]}


def is_automatic(msg) -> bool:
    """Bounces, auto-replies and lists — never a teacher writing (RFC 3834 and the usual headers)."""
    auto = str(msg.get("Auto-Submitted", "no")).strip().lower()
    prec = str(msg.get("Precedence", "")).strip().lower()
    frm = parseaddr(str(msg.get("From", "")))[1].lower()
    return (auto not in ("", "no") or prec in ("bulk", "junk", "list", "auto_reply")
            or bool(msg.get("List-Id")) or frm.startswith(("mailer-daemon@", "postmaster@", "no-reply@",
                                                            "noreply@", "do-not-reply@")))


def parse_fresh(raw: bytes) -> Optional[Dict[str, str]]:
    """A mail she wrote to support@ from her own mail app, with NO case reference: {subject,
    message_id, sender, at, text}, or None (automatic mail, or nothing left to read)."""
    msg = email.message_from_bytes(raw, policy=email.policy.default)
    if is_automatic(msg) or REF_RE.search(str(msg.get("Subject", ""))):
        return None
    text = strip_quoted(body_text(msg))
    subject = re.sub(r"^\s*((re|fwd?|fw)\s*:\s*)+", "", str(msg.get("Subject", "")), flags=re.I).strip()
    if not (text or subject):
        return None
    try:
        at = parsedate_to_datetime(str(msg.get("Date"))).astimezone(timezone.utc).isoformat()
    except Exception:                                                  # noqa: BLE001
        at = ""
    return {"kind": "fresh", "subject": subject[:200], "message_id": str(msg.get("Message-ID", "")).strip(),
            "sender": parseaddr(str(msg.get("From", "")))[1].lower(), "at": at, "text": text[:8000]}


def fetch_replies(host: str, user: str, password: str, days: int = 14,
                  imap_factory: Callable[..., Any] = imaplib.IMAP4_SSL,
                  fresh_since: Optional[datetime] = None,
                  wanted: Optional[Callable[[str], bool]] = None,
                  skip: Optional[set] = None) -> List[Dict[str, str]]:
    """Replies to cases ([MEY-S-n] in the subject) — and, when `fresh_since` is given, FRESH mail
    (no reference) received since then from an address `wanted` accepts (a teacher on record).
    `skip` is a set of Message-IDs already handled; fresh ones read here are added to it."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%d-%b-%Y")
    box = imap_factory(host)
    try:
        box.login(user, password)
        box.select("INBOX", readonly=True)
        seen, out = set(), []
        for prefix in ("MEY-S-", "ARV-S-"):
            typ, data = box.search(None, "SINCE", since, "SUBJECT", f'"{prefix}"')
            if typ != "OK":
                continue
            for num in (data[0] or b"").split():
                if num in seen:
                    continue
                seen.add(num)
                typ, parts = box.fetch(num, "(BODY.PEEK[])")
                raw = next((p[1] for p in parts or [] if isinstance(p, tuple)), None)
                if typ == "OK" and raw:
                    r = parse_reply(raw)
                    if r:
                        out.append(r)
        if fresh_since is not None:
            fs = fresh_since.strftime("%d-%b-%Y")
            typ, data = box.search(None, "SINCE", fs, "NOT", "SUBJECT", '"MEY-S-"',
                                   "NOT", "SUBJECT", '"ARV-S-"')
            for num in ((data[0] or b"").split() if typ == "OK" else []):
                if num in seen:
                    continue
                seen.add(num)
                # Headers first: most of support@'s mail is not from a teacher, and only hers is read.
                typ, parts = box.fetch(num, "(BODY.PEEK[HEADER])")
                head = next((p[1] for p in parts or [] if isinstance(p, tuple)), None)
                if typ != "OK" or not head:
                    continue
                h = email.message_from_bytes(head, policy=email.policy.default)
                mid = str(h.get("Message-ID", "")).strip()
                if skip is not None and mid and mid in skip:
                    continue
                try:
                    when = parsedate_to_datetime(str(h.get("Date")))
                    if when.tzinfo is None:
                        when = when.replace(tzinfo=timezone.utc)
                except Exception:                                      # noqa: BLE001
                    continue
                sender = parseaddr(str(h.get("From", "")))[1].lower()
                if when < fresh_since or is_automatic(h) or (wanted and not wanted(sender)):
                    if skip is not None and mid:
                        skip.add(mid)
                    continue
                typ, parts = box.fetch(num, "(BODY.PEEK[])")
                raw = next((p[1] for p in parts or [] if isinstance(p, tuple)), None)
                r = parse_fresh(raw) if typ == "OK" and raw else None
                if r:
                    out.append(r)
        return out
    finally:
        try:
            box.logout()
        except Exception:                                              # noqa: BLE001
            pass


class MailSync:
    """Runs fetch_replies at most once a minute, in the background, when the inbox is looked at."""

    def __init__(self, inbox, host: str, user: str, password: str, every: int = 60,
                 fetch: Callable[..., List[Dict[str, str]]] = fetch_replies):
        self.inbox, self.host, self.user, self.password = inbox, host, user, password
        self.every, self.fetch = every, fetch
        self.last = 0.0
        self.skip: set = set()          # Message-IDs of fresh mail already handled (this process)
        self.status: Dict[str, Any] = {"enabled": self.enabled}
        self._lock = threading.Lock()

    @property
    def enabled(self) -> bool:
        return bool(self.host and self.user and self.password)

    FLOOR_KEY = "support/_series/mail_floor.json"

    def floor(self) -> Optional[datetime]:
        """★ FRESH MAIL COUNTS FROM THE DAY THIS WAS SWITCHED ON (2026-10-04) — never support@'s
        back catalogue. Stored once, on the first sync, beside the reference series."""
        be = getattr(getattr(self.inbox, "repo", None), "backend", None)
        if be is None:
            return None
        raw = be.get_json(self.FLOOR_KEY)
        at = (raw or {}).get("at") if isinstance(raw, dict) else None
        if not at:
            at = datetime.now(timezone.utc).isoformat()
            be.put_json(self.FLOOR_KEY, {"at": at})
        return datetime.fromisoformat(at)

    def run_once(self) -> Dict[str, Any]:
        added = 0
        try:
            fresh_on = getattr(self.inbox, "open_case_from_mail", None) is not None
            kw = ({"fresh_since": self.floor(), "wanted": self.inbox.is_teacher_email, "skip": self.skip}
                  if fresh_on else {})
            for r in self.fetch(self.host, self.user, self.password, **kw):
                if r.get("kind") == "fresh":
                    res = self.inbox.mail_fresh(r)
                    if r.get("message_id"):
                        self.skip.add(r["message_id"])
                else:
                    res = self.inbox.case_inbound(r["ref"], r["text"], r["message_id"], r["at"], r["sender"])
                added += res in ("added", "joined")
            self.status = {"enabled": True, "at": datetime.now(timezone.utc).isoformat(),
                           "added": added, "error": ""}
        except Exception as e:                                         # noqa: BLE001
            msg = str(e)
            if "AUTHENTICATIONFAILED" in msg.upper() or "Invalid credentials" in msg:
                msg = "Gmail refused the sign-in (check the app password / IMAP access)."
            self.status = {"enabled": True, "at": datetime.now(timezone.utc).isoformat(),
                           "added": 0, "error": msg[:300]}
            self.inbox.log({"kind": "mail_sync_error", "error": msg[:300]})
        return self.status

    def kick(self, wait: bool = False) -> None:
        """Start a sync if none ran in the last minute and none is running."""
        if not self.enabled or time.time() - self.last < self.every:
            return
        if not self._lock.acquire(blocking=False):
            return
        self.last = time.time()

        def go():
            try:
                self.run_once()
            finally:
                self._lock.release()
        if wait:
            go()
        else:
            threading.Thread(target=go, daemon=True).start()
