"""The WhatsApp Support inbox (2026-09-30).

Once Meyy's WhatsApp number runs on the Cloud API, customer messages no longer land on a phone —
they arrive at the server's webhook. This module is everything that happens to them after that:

  * STORE    — each message joins that customer's thread (whatsapp_inbox_file.py).
  * GREET    — her first message (or first after a long silence) gets the automatic greeting
               the WhatsApp Business app used to send: "we reply to messages only, not calls".
  * ALERT    — the founder is emailed that someone wrote, at most once per conversation per
               half hour, with a link to the inbox.
  * ANSWER   — /support-inbox: a private page (any browser, phone or laptop) listing the
               conversations, with a reply box. Replies go out from the Meyy number.

WhatsApp's 24-HOUR RULE is enforced here, not left to Meta's error: a free-text reply is
allowed only within 24 hours of the customer's last message. After that the inbox says the
window is closed and, if ARUVI_WA_REOPEN_TEMPLATE names an approved template, offers to send it.

ONE QUEUE (2026-10-03): the inbox also lists the EMAIL cases teachers file from the app (Settings ›
Support and a lesson's "Report an issue"), side by side with WhatsApp conversations. An email case
is answered from here by email (from SUPPORT_ADDRESS, subject threaded under the acknowledgement's
"[MEY-S-…]"). Every item can hold a DRAFT reply — written by the founder's drafting session on his
Mac with ARUVI_SUPPORT_DRAFT_TOKEN — which fills the reply box and is sent only when he presses Send.
The token can read the queue and write drafts and labels; it can never send or close anything.

ACCESS: one password (ARUVI_SUPPORT_INBOX_PASSWORD, set on Render only). A successful login sets
an HttpOnly, Secure, SameSite=Strict cookie signed with a key derived from the password, so
changing the password signs everyone out. Failed logins are throttled per client address. Every
write call also requires a custom header, which a cross-site form cannot send.
"""
from __future__ import annotations

import hashlib
import hmac
import html
import json
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel

from aruvi_core.adapters.whatsapp_inbox_file import number_key, e164, _last_human_dir
from aruvi_core.ports import EmailMessage, WhatsAppTemplate

COOKIE = "meyy_inbox"
SESSION_DAYS = 30
WINDOW_HOURS = 24
_FAILS: Dict[str, list] = {}          # client → timestamps of failed logins (in-process)


def _parse(ts: str) -> Optional[datetime]:
    try:
        d = datetime.fromisoformat(str(ts))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def first_name(full: Any) -> str:
    """The first name a WhatsApp template greets her by — "kumar radhakrishnan" → "Kumar".
    Only the first letter is raised, so "McKenzie" stays as she wrote it. A missing or numeric
    name (an account whose name is still its mobile) becomes "there": "Hello there"."""
    first = (str(full or "").strip().split() or [""])[0]
    if not first or first.isdigit():
        return "there"
    return first[:1].upper() + first[1:]


def _pretty(n: str) -> str:
    d = e164(n)
    return f"+91 {d[2:7]} {d[7:]}" if len(d) == 12 and d.startswith("91") else "+" + d


def window_open(thread: Optional[Dict[str, Any]], now: Optional[datetime] = None,
                current_pn: str = "") -> bool:
    """WhatsApp's 24-hour window is per (customer, BUSINESS NUMBER). A customer who last wrote to
    a different Meyy number — the test number before the 2026-09-30 move — has no open window
    with the current one, and Meta refuses a free-text reply with "Re-engagement message"."""
    t = thread or {}
    pn = t.get("last_inbound_pn", "")
    if current_pn and pn and pn != current_pn:
        return False
    if current_pn and not pn:
        return False                     # recorded before numbers were tracked — can't vouch
    last = _parse(t.get("last_inbound_at", ""))
    now = now or datetime.now(timezone.utc)
    return bool(last and now - last < timedelta(hours=WINDOW_HOURS))


REPORT_HEAD = "Problem in:"
SUPPORT_HEAD = "Support:"


def parse_report(text: str) -> Optional[Dict[str, str]]:
    """The lesson line @aruvi/shared/report puts at the top of a WhatsApp report —
    "Problem in: Class IX · Mathematics · Polynomials · Unit 3 · Phase 2" — read back into rows.
    None when the message is not a report. Tolerant: she may have edited the line."""
    t = (text or "").strip()
    if not t.lower().startswith(REPORT_HEAD.lower()):
        return None
    head = t[len(REPORT_HEAD):].split("\n", 1)[0].strip()
    parts = [p.strip() for p in head.split("·") if p.strip()]
    out: Dict[str, str] = {"line": head}
    rest = []
    for p in parts:
        low = p.lower()
        if low.startswith("class "):
            out["grade"] = p[6:].strip()
        elif low.startswith("unit ") or low.startswith("dropped section"):
            out["unit"] = p
        elif low.startswith("phase ") or low == "assessment":
            out["phase"] = p
        else:
            rest.append(p)
    if rest:
        out["subject"] = rest[0]
    if len(rest) > 1:
        out["chapter"] = " · ".join(rest[1:])
    return out


def parse_support(text: str) -> Optional[Dict[str, str]]:
    """The header Settings › Support puts on a WhatsApp message (2026-10-04) —
    "Support: Billing or account" / "Sign-in: 98…" — read back. None when it is not one."""
    t = (text or "").strip()
    if not t.lower().startswith(SUPPORT_HEAD.lower()):
        return None
    lines = t.split("\n")
    out: Dict[str, str] = {"about": lines[0][len(SUPPORT_HEAD):].strip()}
    for ln in lines[1:4]:
        if ln.lower().startswith("sign-in:"):
            out["signin"] = ln.split(":", 1)[1].strip()
    return out


def describe(m: Dict[str, Any]) -> str:
    """A WhatsApp message as one line of text for the thread."""
    t = m.get("type") or ""
    if t == "text":
        return ((m.get("text") or {}).get("body") or "").strip()
    if t == "button":
        return ((m.get("button") or {}).get("text") or "").strip()
    if t == "interactive":
        i = m.get("interactive") or {}
        return ((i.get("button_reply") or i.get("list_reply") or {}).get("title") or "").strip()
    cap = ((m.get(t) or {}).get("caption") or "").strip() if isinstance(m.get(t), dict) else ""
    label = {"image": "photo", "video": "video", "audio": "voice note", "document": "document",
             "sticker": "sticker", "location": "location", "contacts": "contact card"}.get(t, t or "message")
    return f"[{label} — open WhatsApp Manager to view]" + (f" {cap}" if cap else "")


# ★ ONE REPORT, ONE ISSUE (founder, 2026-10-04). WhatsApp is ONE chat per number, but each lesson
# report (a "Problem in:" message, MEY-W-n) is its own issue in the inbox — like an email case: its
# own row, its own status and draft, and only ITS messages on screen and for the drafting session.
# An issue's id is "<number>~<ref>"; the bare number is the general chat before any report.
# A message's issue: its explicit "issue" field (a reply the founder sent from that issue), else
# the report it starts, else the issue in force when it arrived (follow-ups join the latest report).
SEP = "~"


# ★ A CONVERSATION IS ADDRESSED BY A HANDLE, NEVER BY HER NUMBER (Privacy Notice v0.5 §2/§7,
# 2026-10-06). Every inbox call names a conversation in its URL — /support-inbox/api/thread/{id} —
# and a URL is written into every access log on the way (ours, the host's, any proxy's), kept a
# year. Her WhatsApp number IS her sign-in mobile, so `{number}~MEY-W-n` put a year of
# IP↔mobile pairs into the logs. The id the inbox hands out is now `c<16 hex>~MEY-W-n`: a keyed
# one-way code of the number (the trial ledger's key, so it is stable across restarts and cannot
# be reversed by trying all ~10^10 numbers without the key). The server maps it back by looking
# it up; the number still travels in response BODIES, which are never logged.
# A raw number is still ACCEPTED in a path (old links, tests, a hand-typed call) — only what
# Meyy itself hands out changed.
_HANDLE_KEY = b"meyy-dev-inbox-handle-key"
_HANDLES: Dict[str, str] = {}
_THREAD_NUMBERS: Optional[Callable[[], Any]] = None
_HANDLE_RE = re.compile(r"^c[0-9a-f]{16}$")


def _set_handle_source(key: str, numbers: Optional[Callable[[], Any]]) -> None:
    global _HANDLE_KEY, _THREAD_NUMBERS
    if key:
        _HANDLE_KEY = ("support-inbox-handle:" + key).encode("utf-8")
    _THREAD_NUMBERS = numbers
    _HANDLES.clear()


def handle_of(n: str) -> str:
    n = number_key(n) or str(n or "")
    h = "c" + hmac.new(_HANDLE_KEY, n.encode("utf-8"), hashlib.sha256).hexdigest()[:16]
    _HANDLES[h] = n
    return h


def _number_for(head: str) -> str:
    if not _HANDLE_RE.match(head):
        return number_key(head) or head
    if head not in _HANDLES and _THREAD_NUMBERS is not None:
        try:                                   # a cold process: learn every handle once
            for num in _THREAD_NUMBERS() or []:
                if num:
                    handle_of(num)
        except Exception:                      # noqa: BLE001 — unknown handle → 404 upstream
            pass
    return _HANDLES.get(head, head)


def split_id(ident: str):
    head, _, ref = str(ident or "").partition(SEP)
    return _number_for(head), ref


def item_id(n: str, ref: str) -> str:
    h = handle_of(n)
    return f"{h}{SEP}{ref}" if ref else h


def issues_of(messages):
    """[(issue_ref, message)] in order — see the note above."""
    cur, out = "", []
    for m in messages or []:
        if m.get("ref") and m.get("dir") == "in":
            cur = m["ref"]
        out.append((m["issue"] if "issue" in m else cur, m))
    return out


def issue_state(t: Dict[str, Any], ref: str) -> Dict[str, Any]:
    if not ref:
        return {"status": t.get("status", "open"), "draft": t.get("draft") or {},
                "category": t.get("category", ""), "resolved_at": t.get("resolved_at", "")}
    st = (t.get("issues") or {}).get(ref) or {}
    return {"status": st.get("status", "open"), "draft": st.get("draft") or {},
            "category": st.get("category", "plan"), "resolved_at": st.get("resolved_at", "")}


_AUTO_BY = ("auto-greeting", "auto-ack", "auto-nonmember", "system")
# A reference as she might type it (founder, 2026-10-04: "Mey 1236" must find MEY-W-1236): the
# prefix is required, the separators and the "W" are not — MEY-W-1236, mey w 1236, MEY1236, Mey-1236.
_REF_RE = re.compile(r"\b(MEY|ARV)\s*[-–]?\s*(?:W\s*[-–]?\s*)?(\d{3,7})\b", re.I)
BURST_MIN = 15          # her messages this close together are one burst — one issue
AFTER_REPLY_MIN = 30    # what she writes this soon after OUR reply answers it
ACKS_PER_DAY = 10       # automatic acknowledgements per number per day (founder, 2026-10-05: as email)
FLOOD_ISSUES = 10       # more new issues than this in a day → "Many messages"


def resolve_ref(t: Dict[str, Any], ref: str) -> str:
    """A merged issue's reference still works: follow merged_into to where its messages went."""
    seen = set()
    while ref and ref not in seen:
        seen.add(ref)
        nxt = ((t.get("issues") or {}).get(ref) or {}).get("merged_into")
        if not nxt:
            break
        ref = nxt
    return ref


def route_message(t: Dict[str, Any], m: Dict[str, Any], text: str,
                  now: Optional[datetime] = None) -> Optional[str]:
    """★ WHICH ISSUE IS A PLAIN WHATSAPP MESSAGE ABOUT? (founder, 2026-10-04 — "split liberally,
    merge deliberately"). Only on clear evidence does it join an existing issue:
      1. she swiped to reply to a message → that message's issue
      2. she typed one of her references (loosely: "Mey 1236"), merged ones included
      3. it is part of her burst — within 15 minutes of her previous message — or it answers
         OUR reply, sent within the last 30 minutes (whichever happened later)
    None = a NEW issue. Anything ambiguous is new: a wrong split is one click to merge; a wrong
    join silently mixes two problems."""
    now = now or datetime.now(timezone.utc)
    pairs = issues_of(t.get("messages") or [])
    known = set(r for r, _ in pairs) | set((t.get("issues") or {}).keys())
    quoted = ((m.get("context") or {}).get("id") or "").strip()
    if quoted:
        for r, msg in pairs:
            if msg.get("id") == quoted:
                return resolve_ref(t, r)
    for prefix, num in _REF_RE.findall(text or ""):
        up = f"{prefix.upper()}-W-{num}"
        if up in known:
            return resolve_ref(t, up)
    cands = []
    for r, msg in reversed(pairs):
        if msg.get("dir") == "in":
            at = _parse(msg.get("at", ""))
            if at and now - at <= timedelta(minutes=BURST_MIN):
                cands.append((at, r))
            break
    # Our reply — or our acknowledgement (2026-10-05): "Hello! Please tell us what you need help
    # with" invites her next message, and what she adds after "we've received it" belongs there too.
    for r, msg in reversed(pairs):
        if msg.get("dir") == "out" and (msg.get("by") not in _AUTO_BY or msg.get("by") == "auto-ack"):
            at = _parse(msg.get("at", ""))
            if at and now - at <= timedelta(minutes=AFTER_REPLY_MIN):
                cands.append((at, r))
            break
    if cands:
        return resolve_ref(t, max(cands)[1])
    return None


_GREET = set("hi hii hiii hello helo hlo hey heyy good morning afternoon evening gm namaste namaskar "
             "namaskaram vanakkam meyy team sir madam mam maam there dear all".split())
_COURTESY = set("thanks thank you thankyou thanku thx tq ty ok okay okk k noted sure fine great got it "
                "dhanyavaad dhanyavad shukriya nandri welcome much so very alright good".split())


def ack_kind(texts) -> str:
    """What to say when her burst goes quiet (founder, 2026-10-04): "greet" if she only said hello
    (invite her to go on — never "we will revert" to a bare Hi), "none" if she only said thanks /
    ok / an emoji, otherwise "ack"."""
    words = []
    for x in texts:
        w = re.sub(r"[^a-z0-9\s]", " ", str(x or "").lower()).split()
        words.extend(w)
    if not words or all(w in _COURTESY for w in words):
        return "none"
    if all(w in _GREET or w in _COURTESY for w in words):
        return "greet"
    return "ack"


class Inbox:
    """The inbox's behaviour, given the app's own objects (no import of api.main here)."""

    def __init__(self, *, config, repo, wa_client, notifier, account_repo,
                 log: Callable[[Dict[str, Any]], None], support_repo=None, category_label=None):
        self.config, self.repo, self.wa = config, repo, wa_client
        self.notifier, self.accounts, self.log = notifier, account_repo, log
        self.cases = support_repo                    # email cases (None in old wiring/tests)
        self.cat_label = category_label or (lambda k: str(k or "").replace("_", " ").capitalize())
        self.mail_sync = None                        # api.mail_sync.MailSync, wired in main.py
        # main.py's "file a case from a mail she wrote" (account, subject, text, message_id, at)
        # → "added" | "joined" | …; None = fresh mail is not filed (old wiring, tests).
        self.open_case_from_mail = None
        # Inbox ids are keyed handles, not numbers (see handle_of). The key is the trial
        # ledger's — already a never-rotate Render secret — so a handle in a bookmarked link or
        # the founder's alert email stays valid across restarts and deploys.
        _set_handle_source(getattr(config, "TRIAL_LEDGER_KEY", "")
                           or getattr(config, "TRIAL_LEDGER_DEV_KEY", ""),
                           lambda: [s.get("number") for s in repo.list_threads()])

    # ── identity ──
    def _name_for(self, n: str, fallback: str = "") -> str:
        try:
            a = self.accounts.load(n, n)
        except Exception:                                   # noqa: BLE001
            a = None
        nm = (getattr(a, "display_name", "") or "").strip() if a else ""
        return nm if nm and not nm.isdigit() else (fallback or "")

    def is_member(self, n: str) -> bool:
        """True when this mobile is on a Meyy account (a trial counts). If the lookup fails we
        answer True — the safe side: a member must never get the 'please sign up' message."""
        try:
            return self.accounts.load(n, n) is not None
        except Exception:                                   # noqa: BLE001
            return True

    # ── inbound (called by the webhook) ──
    def on_message(self, m: Dict[str, Any], profile_name: str = "", to_pn: str = "") -> None:
        n = number_key(m.get("from") or "")
        if not n:
            return
        if to_pn and self.config.WA_PHONE_NUMBER_ID and to_pn != self.config.WA_PHONE_NUMBER_ID:
            # Written to a Meyy number the server no longer sends from (the retired test number):
            # log it, but don't file it, greet it or alert on it — a reply would come from a
            # different number than the one she wrote to.
            self.log({"kind": "ignored_other_number", "to_pn": to_pn})
            return
        text = describe(m)
        # A lesson report gets its number BEFORE it is filed — and only once: Meta re-delivering
        # the same message must not spend a second reference.
        report = parse_report(text)
        support = None if report else parse_support(text)
        ref = ""
        is_new = not self.repo.has_message(n, m.get("id", ""))
        t0 = self.repo.load(n) or {}
        issue: Optional[str] = None             # the existing issue a plain message joins
        # ★ EVERY NEW REQUEST IS ITS OWN ISSUE, NO DAILY LIMIT (founder, 2026-10-04). A message from
        # the app (Report an issue / Settings › Support) always is; a plain one only when nothing
        # says it continues an issue (route_message). STOP is filed, never numbered.
        if is_new:
            if report or support:
                pass
            elif text.strip().upper() == "STOP":
                issue = t0.get("last_ref") or ""
            else:
                issue = route_message(t0, m, text)
        if is_new and issue is None:
            ref = self.repo.next_reference(getattr(self.config, "WA_REPORT_PREFIX", "MEY-W"),
                                           getattr(self.config, "WA_REPORT_START", 1234))
        before = self.repo.append(
            n, {"id": m.get("id", ""), "dir": "in", "type": m.get("type", ""), "text": text,
                **({"ref": ref, "issue": ref} if ref else {}),
                **({"issue": issue} if issue is not None else {}),
                **({"report": report} if ref and report else {}),
                **({"support": support} if ref and support else {})},
            name=self._name_for(n, profile_name))
        if ref:
            # The reference is OURS (founder, 2026-10-04): never shown in the chat. The
            # acknowledgement waits for her burst to go quiet — see send_due_acks.
            self.repo.patch(n, last_ref=ref)
            self.log({"kind": "wa_issue", "ref": ref})
        # ★ SHE WROTE AGAIN → THE CONVERSATION IS OPEN AGAIN (2026-10-03). A thread the founder
        # marked resolved comes back to "Needs reply" on her next message — a follow-up ("I do not
        # agree") must never sit unseen under "All". Same thread, same last reference: a follow-up
        # is not a new report, so it gets no new number.
        # ★ A DRAFT WRITTEN BEFORE HER NEW MESSAGE IS STALE (2026-10-03): it answers what she said
        # earlier, not this. The drafting session's draft goes; one the founder typed is kept.
        self.repo.patch(n, last_inbound_pn=to_pn or self.config.WA_PHONE_NUMBER_ID)
        if is_new:
            # The issue this message belongs to: a new report is its own; a plain message joins
            # the latest report (or the general chat before any).
            iss = ref or (issue if issue is not None else (before.get("last_ref") or ""))
            st = issue_state(before, iss)
            fields = {}
            if (st["draft"] or {}).get("by") == "claude":
                fields["draft"] = {}
            if st["status"] == "done" or ref:
                fields["status"] = "open"
            if ref:
                fields["category"] = ("plan" if report else
                                      self.category_for(support.get("about", "")) if support else "other")
                fields["ack"] = "pending"
                fields["opened_at"] = datetime.now(timezone.utc).isoformat()
            if fields:
                self.repo.patch_issue(n, iss, **fields)
        now = datetime.now(timezone.utc)
        # (No greeting any more: the end-of-burst acknowledgement does its job — 2026-10-04.)
        # Alert the founder — throttled per conversation.
        last_alert = _parse(before.get("last_alert_at", ""))
        if last_alert is None or now - last_alert > timedelta(minutes=self.config.INBOX_ALERT_GAP_MIN):
            self._alert(n, text)
            self.repo.patch(n, last_alert_at=now.isoformat())

    def on_status(self, st: Dict[str, Any]) -> None:
        n = number_key(st.get("recipient_id") or "")
        errs = st.get("errors") or []
        err = (errs[0].get("title") or errs[0].get("message") or "") if errs else ""
        if n and st.get("id"):
            self.repo.set_status(n, st["id"], st.get("status", ""), err)

    def _alert(self, n: str, text: str) -> None:
        to = (self.config.INBOX_ALERT_TO or "").strip()
        if not to:
            return
        t = self.repo.load(n) or {}
        who = t.get("name") or ("+" + e164(n))
        link = f"{self.config.PUBLIC_API_URL}/support-inbox#wa:{item_id(n, t.get('last_ref') or '')}"
        try:
            self.notifier.send(EmailMessage(
                to=to, subject=f"[Meyy WhatsApp] New message from {who}",
                text=(f"{who} (+{e164(n)}) wrote on WhatsApp:\n\n{text[:1500]}\n\n"
                      f"Reply in the Support inbox:\n{link}\n"),
                reply_to=to))
        except Exception:                                   # noqa: BLE001
            pass

    # ── outbound ──
    def send_text(self, n: str, body: str, by: str = "founder",
                  issue: Optional[str] = None, reply_to: str = "") -> Dict[str, Any]:
        if reply_to:
            try:
                res = self.wa.send_text(e164(n), body, reply_to=reply_to)
            except TypeError:                                   # an adapter without quote-replies
                res = self.wa.send_text(e164(n), body)
        else:
            res = self.wa.send_text(e164(n), body)
        ok = res.get("status") in ("sent", "written")
        self.repo.append(n, {"id": res.get("message_id", ""), "dir": "out", "type": "text",
                             "text": body, "by": by, **({} if issue is None else {"issue": issue}),
                             **({"reply_to": reply_to} if reply_to else {}),
                             "status": "accepted" if ok else "failed",
                             **({} if ok else {"error": str(res.get("error") or res.get("reason") or "")})})
        self.log({"kind": "send_text", "by": by, "to": "…" + e164(n)[-4:], "result": res})
        if ok and by == "founder":
            self.repo.patch_issue(n, issue or "", draft={})     # a sent reply uses the draft up
        return res

    # ── email cases ──
    def case_reply(self, ref: str, body: str) -> Dict[str, Any]:
        """Answer an email case: one mail to the address on her case, threaded under the
        acknowledgement's subject, then filed on the case. Gmail keeps the sent copy, since
        the mail leaves through support@'s own account."""
        c = self.cases.find(ref) if self.cases else None
        if c is None:
            return {"status": "missing"}
        if not (c.email or "").strip():
            return {"status": "no_email"}
        mail = case_reply_mail(name=c.name, reference=c.reference, reply=body, original=c.message,
                               label=c.category_label or self.cat_label(c.category))
        res = self.notifier.send(EmailMessage(to=c.email, subject=mail["subject"], text=mail["text"],
                                              html=mail["html"], reply_to=self.config.SUPPORT_ADDRESS))
        ok = str(res.get("status", "")) in ("sent", "written")
        c.thread = list(c.thread or []) + [{"at": datetime.now(timezone.utc).isoformat(), "dir": "out",
                                            "text": body, "by": "founder",
                                            "status": "sent" if ok else "failed",
                                            **({} if ok else {"error": str(res.get("error") or "")})}]
        if ok:
            c.status, c.draft = "answered", {}
        self.cases.save(c)
        self.log({"kind": "case_reply", "ref": c.reference, "result": str(res.get("status"))})
        return {"status": "sent" if ok else "failed", "error": res.get("error")}

    def record_template(self, n: str, template: str, text: str, res: Dict[str, Any],
                        by: str = "system", issue: Optional[str] = None) -> None:
        ok = res.get("status") in ("sent", "written")
        self.repo.append(n, {"id": res.get("message_id", ""), "dir": "out", "type": "template",
                             "template": template, "text": text, "by": by,
                             **({} if issue is None else {"issue": issue}),
                             "status": "accepted" if ok else "failed",
                             **({} if ok else {"error": str(res.get("error") or res.get("reason") or "")})})

    def case_inbound(self, ref: str, text: str, message_id: str = "", at: str = "",
                     sender: str = "") -> str:
        """Her email reply to a case, attached by the drafting session from support@'s Gmail
        (2026-10-03). Joins the case thread, reopens the case, and never duplicates: the Gmail
        message id is the key. Returns "added" | "duplicate" | "missing" | "stranger"."""
        c = self.cases.find(ref) if self.cases else None
        if c is None:
            return "missing"
        # Only HER address may add to her case — a reply quoting a reference from anyone else
        # is not filed (it could be a forward, or someone guessing a number).
        if sender and c.email and sender.strip().lower() != c.email.strip().lower():
            return "stranger"
        if message_id and any(m.get("id") == message_id for m in (c.thread or [])):
            return "duplicate"
        # The same words sent twice (she pressed Send again, or resent because nothing seemed to
        # happen) are one message, not two.
        norm = " ".join(text.split())
        if any(m.get("dir") == "in" and " ".join(str(m.get("text", "")).split()) == norm
               for m in (c.thread or [])):
            return "duplicate"
        # A draft by the drafting session answered what she said BEFORE this — it is stale.
        if (c.draft or {}).get("by") == "claude":
            c.draft = {}
        c.thread = list(c.thread or []) + [{"at": at or datetime.now(timezone.utc).isoformat(),
                                            "dir": "in", "text": text, "id": message_id,
                                            "by": "email"}]
        c.status = "open"
        self.cases.save(c)
        self.log({"kind": "case_inbound", "ref": c.reference})
        return "added"

    # ── fresh email: she wrote to support@ from her own mail app, no reference (2026-10-04) ──
    def is_teacher_email(self, addr: str) -> bool:
        try:
            return bool(addr) and self.accounts.find_by_email(addr) is not None
        except Exception:                                      # noqa: BLE001
            return False

    def mail_fresh(self, r: Dict[str, str]) -> str:
        """A fresh mail → a NEW case (MEY-S-n, acknowledged like the app's form) when it comes from
        the ONE account carrying that address; past the day's cap it joins her latest case. Mail
        from an address on no account (or on two) is not filed — it stays in support@'s Gmail:
        Meyy writes back only to what is on record. Returns added | joined | stranger | duplicate."""
        if self.open_case_from_mail is None:
            return "off"
        try:
            acct = self.accounts.find_by_email(r.get("sender", ""))
        except Exception:                                      # noqa: BLE001
            acct = None
        if acct is None:
            return "stranger"
        mid = r.get("message_id", "")
        if mid and self.cases:
            for c in self.cases.load_all(acct.tenant_id, acct.account_id):
                if (c.context or {}).get("mail_id") == mid or any(
                        x.get("id") == mid for x in (c.thread or [])):
                    return "duplicate"
        return self.open_case_from_mail(acct, r.get("subject", ""), r.get("text", ""), mid, r.get("at", ""))

    # ── the day's cap on NEW requests (2026-10-04) ──
    def new_today(self, n: str, tenant_id: str = "") -> int:
        """New requests she opened today (UTC day — 5:30 am in India): her email cases plus
        her WhatsApp issues. Replies and follow-ups are not requests."""
        today = datetime.now(timezone.utc).date().isoformat()
        key = number_key(n) or n
        t = self.repo.load(key) or {}
        k = sum(1 for m in t.get("messages") or []
                if m.get("ref") and m.get("dir") == "in" and str(m.get("at", ""))[:10] == today)
        if self.cases:
            try:
                k += sum(1 for c in self.cases.load_all(tenant_id or key, key)
                         if str(c.created_at or "")[:10] == today)
            except Exception:                                  # noqa: BLE001
                pass
        return k

    def over_cap(self, n: str, tenant_id: str = "") -> bool:
        key = number_key(n) or n
        if key in getattr(self.config, "TEST_SUPPORT_UNCAPPED", set()):
            return False
        return self.new_today(key, tenant_id) >= int(getattr(self.config, "SUPPORT_DAILY_CAP", 5))

    def category_for(self, label: str) -> str:
        low = (label or "").strip().lower()
        for k in ("problem", "plan", "billing", "suggestion", "other"):
            if self.cat_label(k).strip().lower() == low:
                return k
        return "other"

    # ── the acknowledgement, when her burst goes quiet (founder, 2026-10-04) ──
    def send_due_acks(self, now: Optional[datetime] = None) -> int:
        """Run every minute by main.py. For each new issue still waiting: once she has been quiet
        for 15 minutes, send ONE short message — no reference in it — or none:
          · she asked something        → WA_ACK_TEXT ("we'll reply here soon")
          · she only said hello        → WA_ACK_GREET ("please tell us what you need help with")
          · she only said thanks / ok  → nothing
        Never if the founder has already answered, never past the 24-hour window, and at most
        ACKS_PER_DAY a day per number (a flood gets silence, not a hundred replies)."""
        now = now or datetime.now(timezone.utc)
        today = now.date().isoformat()
        sent = 0
        for summary in self.repo.list_threads():
            n = summary["number"]
            t = self.repo.load(n) or {}
            pending = [r for r, st in (t.get("issues") or {}).items() if (st or {}).get("ack") == "pending"]
            if not pending:
                continue
            last_in = _parse(t.get("last_inbound_at", ""))
            if last_in is None or now - last_in < timedelta(minutes=BURST_MIN):
                continue                                    # she may still be typing
            pairs = issues_of(t.get("messages") or [])
            acks_today = sum(1 for _, x in pairs if x.get("by") == "auto-ack"
                             and str(x.get("at", ""))[:10] == today)
            for ref in pending:
                msgs = [x for r, x in pairs if r == ref]
                if any(x.get("dir") == "out" and x.get("by") not in _AUTO_BY for x in msgs):
                    self.repo.patch_issue(n, ref, ack="answered")
                    continue
                if now - last_in > timedelta(hours=23):
                    self.repo.patch_issue(n, ref, ack="expired")
                    continue
                if getattr(self.config, "WA_NONMEMBER_REPLY", False) and not self.is_member(n):
                    # ★ A NON-MEMBER GETS ONE MESSAGE, EVER (founder, 2026-10-07) — this instead
                    # of the acknowledgement, whatever she wrote; every later issue gets silence.
                    if (self.repo.load(n) or {}).get("nonmember_info_at"):
                        self.repo.patch_issue(n, ref, ack="nonmember-quiet")
                        continue
                    body = str(getattr(self.config, "WA_NONMEMBER_TEXT", "") or "").strip()
                    self.repo.patch_issue(n, ref, ack="sent")   # claimed BEFORE sending: never twice
                    self.repo.patch(n, nonmember_info_at=now.isoformat())
                    if body:
                        self.send_text(n, body, by="auto-nonmember", issue=ref)
                        sent += 1
                    continue
                kind = ack_kind([x.get("text", "") for x in msgs if x.get("dir") == "in"])
                if kind == "none":
                    self.repo.patch_issue(n, ref, ack="not-needed")
                    continue
                if acks_today >= ACKS_PER_DAY:
                    self.repo.patch_issue(n, ref, ack="over-limit")
                    continue
                body = (getattr(self.config, "WA_ACK_GREET", "") if kind == "greet"
                        else getattr(self.config, "WA_ACK_TEXT", "")).strip()
                self.repo.patch_issue(n, ref, ack="sent")   # claimed BEFORE sending: never twice
                if body:
                    self.send_text(n, body, by="auto-ack", issue=ref)
                    acks_today += 1
                    sent += 1
        return sent

    # ── merge and split (founder, 2026-10-04) ──
    def merge(self, n: str, src: str, dst: str) -> str:
        """Fold issue `src` into `dst`: its messages move, `src` stays as a pointer (a teacher who
        types its reference lands in `dst`). Returns ok | missing | same."""
        t = self.repo.load(n)
        if t is None or not src or not dst:
            return "missing"
        dst = resolve_ref(t, dst)
        if src == dst:
            return "same"
        refs = set(r for r, _ in issues_of(t.get("messages") or []))
        if src not in refs or dst not in refs:
            return "missing"

        def change(th):
            for r, x in issues_of(th.get("messages") or []):
                if r == src:
                    x["issue"] = dst
            issues = dict(th.get("issues") or {})
            issues[src] = {**(issues.get(src) or {}), "merged_into": dst, "status": "done", "draft": {}}
            issues[dst] = {**(issues.get(dst) or {}), "status": "open"}
            th["issues"] = issues
        self.repo.update(n, change)
        self.log({"kind": "wa_merge", "src": src, "dst": dst})
        return "ok"

    def split(self, n: str, src: str, message_id: str) -> str:
        """Move one message — and what followed it in that issue — to a NEW issue (a different
        topic that was joined by mistake). No acknowledgement. Returns the new reference, or ""."""
        t = self.repo.load(n)
        if t is None or not message_id:
            return ""
        msgs = [x for r, x in issues_of(t.get("messages") or []) if r == src]
        ids = [x.get("id") for x in msgs]
        if message_id not in ids or ids.index(message_id) == 0:
            return ""                                        # the first message IS the issue
        new = self.repo.next_reference(getattr(self.config, "WA_REPORT_PREFIX", "MEY-W"),
                                       getattr(self.config, "WA_REPORT_START", 1234))
        moving = set(i for i in ids[ids.index(message_id):] if i)

        def change(th):
            for r, x in issues_of(th.get("messages") or []):
                if r == src and x.get("id") in moving:
                    x["issue"] = new
            issues = dict(th.get("issues") or {})
            issues[new] = {"status": "open", "category": "other", "ack": "not-needed",
                           "opened_at": datetime.now(timezone.utc).isoformat(), "split_from": src}
            th["issues"] = issues
        self.repo.update(n, change)
        self.log({"kind": "wa_split", "src": src, "new": new})
        return new

    def hint_for(self, t: Dict[str, Any], ref: str) -> Optional[Dict[str, Any]]:
        """"Possibly continues MEY-W-241 — you replied there 8 hours earlier": for an issue that
        began as a plain message, the issue we last answered in the 72 hours before it began."""
        pairs = issues_of(t.get("messages") or [])
        msgs = [x for r, x in pairs if r == ref]
        if not ref or not msgs or msgs[0].get("report") or msgs[0].get("support"):
            return None
        # Once the founder has answered in this issue he has treated it as its own — no hint.
        if any(x.get("dir") == "out" and x.get("by") not in _AUTO_BY for x in msgs):
            return None
        start = _parse(msgs[0].get("at", ""))
        if start is None:
            return None
        best = None
        for r, x in pairs:
            if r in (ref, "") or ((t.get("issues") or {}).get(r) or {}).get("merged_into"):
                continue
            at = _parse(x.get("at", ""))
            if (x.get("dir") == "out" and x.get("by") not in _AUTO_BY and at and at < start
                    and start - at <= timedelta(hours=72)):
                if best is None or at > best[0]:
                    best = (at, r)
        if best is None:
            return None
        hours = max(1, int((start - best[0]).total_seconds() // 3600))
        return {"ref": best[1], "hours": hours}

    # ── the one queue ──
    def queue(self) -> list:
        now = datetime.now(timezone.utc)
        items = []
        for summary in self.repo.list_threads():
            n = summary["number"]
            t = self.repo.load(n) or {}
            pairs = issues_of(t.get("messages") or [])
            last_in = next((r for r, m in reversed(pairs) if m.get("dir") == "in"), None)
            member = self.is_member(n)
            today = now.date().isoformat()
            flood = sum(1 for _, x in pairs if x.get("ref") and x.get("dir") == "in"
                        and str(x.get("at", ""))[:10] == today) > FLOOD_ISSUES
            for ref in dict.fromkeys(r for r, _ in pairs):   # one row per issue (and the general chat)
                msgs = [m for r, m in pairs if r == ref]
                if not msgs or ((t.get("issues") or {}).get(ref) or {}).get("merged_into"):
                    continue
                last, st = msgs[-1], issue_state(t, ref)
                items.append({"kind": "wa", "id": item_id(n, ref), "number": n, "ref": ref,
                              "name": t.get("name") or ("+91 " + n),
                              "preview": (last.get("text") or "")[:120], "preview_dir": last.get("dir", ""),
                              "at": last.get("at", ""),
                              "unread": int(t.get("unread") or 0) if ref == last_in else 0,
                              "window_open": window_open(summary, now, self.config.WA_PHONE_NUMBER_ID),
                              "category": st["category"], "status": st["status"],
                              "has_draft": bool(st["draft"].get("text")),
                              # ★ A FLOOD (more than FLOOD_ISSUES new issues today) leaves "Needs
                              # reply" so it cannot bury other teachers; still under Open and All.
                              "flood": flood,
                              "member": member,
                              "needs_reply": _last_human_dir(msgs) == "in" and not flood})
        for c in (self.cases.load_everyone() if self.cases else []):
            last = (c.thread or [])[-1] if c.thread else None
            items.append({"kind": "case", "id": c.reference, "name": c.name or c.user_id,
                          "preview": (last or {}).get("text") or c.message,
                          "preview_dir": (last or {}).get("dir", "in"),
                          "at": (last or {}).get("at") or c.created_at, "unread": 0,
                          "category": c.category, "category_label": c.category_label or self.cat_label(c.category),
                          "status": c.status or "open", "has_draft": bool((c.draft or {}).get("text")),
                          "needs_reply": (last or {}).get("dir", "in") == "in" and (c.status or "open") == "open"})
        items.sort(key=lambda i: i.get("at") or "", reverse=True)
        return items

    def set_draft(self, kind: str, ident: str, text: str, by: str = "claude",
                  category: str = "") -> bool:
        draft = {"text": text, "by": by, "at": datetime.now(timezone.utc).isoformat()} if text else {}
        if kind == "wa":
            n, ref = split_id(ident)
            if self.repo.load(n) is None:
                return False
            extra = {"category": category} if category else {}
            self.repo.patch_issue(n, ref, draft=draft, **extra)
            return True
        c = self.cases.find(ident) if self.cases else None
        if c is None:
            return False
        c.draft = draft
        self.cases.save(c)
        return True

    # ── the password session ──
    def _key(self) -> bytes:
        return hashlib.sha256(("meyy-inbox|" + self.config.SUPPORT_INBOX_PASSWORD).encode()).digest()

    def make_cookie(self) -> str:
        exp = int(time.time()) + SESSION_DAYS * 86400
        sig = hmac.new(self._key(), f"inbox|{exp}".encode(), hashlib.sha256).hexdigest()
        return f"{exp}.{sig}"

    def authed(self, request: Request) -> bool:
        if not self.config.SUPPORT_INBOX_PASSWORD:
            return False
        raw = request.cookies.get(COOKIE, "")
        try:
            exp_s, sig = raw.split(".", 1)
            exp = int(exp_s)
        except ValueError:
            return False
        want = hmac.new(self._key(), f"inbox|{exp}".encode(), hashlib.sha256).hexdigest()
        return exp > time.time() and hmac.compare_digest(sig, want)


class ReplyBody(BaseModel):
    text: str


class DraftBody(BaseModel):
    kind: str                  # "wa" | "case"
    id: str                    # the WhatsApp number key, or the case reference
    text: str = ""             # empty clears the draft
    category: str = ""         # WhatsApp only: problem | plan | billing | suggestion | other


class MergeBody(BaseModel):
    into: str


class SplitBody(BaseModel):
    message_id: str


class InboundBody(BaseModel):
    text: str
    message_id: str = ""       # the Gmail message id — the de-duplication key
    at: str = ""               # when she sent it (ISO)
    sender: str = ""           # her From address; must match the case's email


class LabelBody(BaseModel):
    category: Optional[str] = None
    status: str = ""           # open | answered | closed (cases) · open | done (WhatsApp)


def case_reply_mail(*, name: str, reference: str, reply: str, original: str, label: str) -> Dict[str, str]:
    """The founder's answer to an email case. HIS words lead, untouched; her original message
    follows, quoted, so the mail stands on its own; the subject threads under the
    acknowledgement ("[MEY-S-768] We have your message — Meyy support")."""
    body = (reply or "").strip()
    quoted = "\n".join(f"> {ln}" for ln in (original or "").strip().splitlines())
    text = (f"{body}\n\n— Meyy support\n\nCase {reference} · {label}\n"
            "Reply to this email to continue the conversation.\n"
            + (f"\nYou wrote:\n{quoted}\n" if quoted else ""))
    paras = "".join(f'<p style="margin:0 0 12px;font:14px/1.6 Georgia,serif;color:#1f2a24;">'
                    f'{html.escape(p_).replace(chr(10), "<br>")}</p>'
                    for p_ in body.split("\n\n") if p_.strip())
    quote = (f'<div style="margin-top:18px;border-left:3px solid #e4ddd0;padding:2px 0 2px 14px;'
             f'font:13px/1.6 Georgia,serif;color:#6b6a63;white-space:pre-wrap;">{html.escape(original or "")}</div>'
             if (original or "").strip() else "")
    page = (f'<!DOCTYPE html><html><body style="margin:0;background:#faf7f1;padding:24px 12px;">'
            f'<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e4ddd0;'
            f'border-radius:4px;padding:26px 30px;">{paras}'
            f'<p style="margin:16px 0 0;font:13px Helvetica,Arial,sans-serif;color:#1f2a24;">— Meyy support</p>'
            f'{quote}<p style="margin:22px 0 0;padding-top:12px;border-top:1px solid #e4ddd0;'
            f'font:11px Helvetica,Arial,sans-serif;color:#6b6a63;">Case {html.escape(reference)} · '
            f'{html.escape(label)} · reply to this email to continue.</p></div></body></html>')
    return {"subject": f"Re: [{reference}] We have your message — Meyy support", "text": text, "html": page}


def build_router(inbox: Inbox) -> APIRouter:
    r = APIRouter(include_in_schema=False)
    cfg = inbox.config

    def need_auth(request: Request, write: bool = False) -> None:
        if not inbox.authed(request):
            raise HTTPException(status_code=401, detail="Please sign in to the Support inbox.")
        if write and request.headers.get("X-Meyy-Inbox") != "1":
            raise HTTPException(status_code=403, detail="Refused.")

    def token_ok(request: Request) -> bool:
        want = getattr(cfg, "SUPPORT_DRAFT_TOKEN", "") or ""
        got = request.headers.get("Authorization", "")
        return bool(want) and got.startswith("Bearer ") and hmac.compare_digest(
            got[7:].strip().encode(), want.encode())

    def need_read_or_token(request: Request) -> str:
        """The founder's browser, or the drafting session's token. Returns who."""
        if token_ok(request):
            return "token"
        need_auth(request)
        return "founder"

    def need_draft(request: Request) -> str:
        if token_ok(request):
            return "claude"
        need_auth(request, write=True)
        return "founder"

    # ── the one queue (2026-10-03) ──
    @r.get("/support-inbox/api/queue")
    def queue(request: Request):
        need_read_or_token(request)
        ms = inbox.mail_sync
        if ms is not None:
            ms.kick()                 # pulls email replies in the background, at most once a minute
        return {"items": inbox.queue(), "reopen_template": bool(cfg.WA_REOPEN_TEMPLATE),
                "mail_sync": ms.status if ms is not None else {"enabled": False}}

    @r.post("/support-inbox/api/mail/sync")
    def mail_sync_now(request: Request):
        """Pull email replies now and say what happened (founder's button, or the drafting session)."""
        if not token_ok(request):
            need_auth(request, write=True)
        ms = inbox.mail_sync
        if ms is None or not ms.enabled:
            return {"enabled": False, "error": "Email sync is not set up on this server."}
        ms.last = 0
        ms.kick(wait=True)
        return ms.status

    @r.get("/support-inbox/api/case/{ref}")
    def case(ref: str, request: Request):
        need_read_or_token(request)
        c = inbox.cases.find(ref) if inbox.cases else None
        if c is None:
            raise HTTPException(status_code=404, detail="No such case.")
        return {"reference": c.reference, "name": c.name, "email": c.email, "user_id": c.user_id,
                "category": c.category, "category_label": c.category_label or inbox.cat_label(c.category),
                "message": c.message, "created_at": c.created_at, "context": c.context or {},
                "status": c.status or "open", "thread": c.thread or [], "draft": c.draft or {}}

    @r.post("/support-inbox/api/case/{ref}/reply")
    def case_reply(ref: str, body: ReplyBody, request: Request):
        need_auth(request, write=True)                # the founder only — never the token
        text = (body.text or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Write a reply first.")
        if len(text) > 8000:
            raise HTTPException(status_code=400, detail="That reply is too long (8000 characters).")
        res = inbox.case_reply(ref, text)
        if res["status"] == "missing":
            raise HTTPException(status_code=404, detail="No such case.")
        if res["status"] == "no_email":
            raise HTTPException(status_code=409, detail="This case has no email address to reply to.")
        if res["status"] != "sent":
            raise HTTPException(status_code=502, detail=f"The email did not go: {res.get('error') or 'unknown error'}")
        return {"status": "sent"}

    @r.post("/support-inbox/api/case/{ref}/label")
    def case_label(ref: str, body: LabelBody, request: Request):
        need_auth(request, write=True)
        c = inbox.cases.find(ref) if inbox.cases else None
        if c is None:
            raise HTTPException(status_code=404, detail="No such case.")
        if body.status in ("open", "answered", "closed"):
            c.status = body.status
        inbox.cases.save(c)
        return {"status": c.status}

    @r.post("/support-inbox/api/thread/{ident}/label")
    def thread_label(ident: str, body: LabelBody, request: Request):
        need_auth(request, write=True)
        n, ref = split_id(ident)
        if inbox.repo.load(n) is None:
            raise HTTPException(status_code=404, detail="No such conversation.")
        fields = {}
        if body.category is not None:
            fields["category"] = body.category
        if body.status in ("open", "done"):
            fields["status"] = body.status
            fields["resolved_at"] = datetime.now(timezone.utc).isoformat() if body.status == "done" else ""
        inbox.repo.patch_issue(n, ref, **fields)
        return {"ok": True}

    @r.post("/support-inbox/api/thread/{ident}/merge")
    def thread_merge(ident: str, body: MergeBody, request: Request):
        need_auth(request, write=True)                # the founder only
        n, ref = split_id(ident)
        res = inbox.merge(n, ref, (body.into or "").strip().upper())
        if res != "ok":
            raise HTTPException(status_code=400 if res == "same" else 404,
                                detail="Those two can't be merged." if res == "same" else "No such issue.")
        return {"ok": True, "id": item_id(n, resolve_ref(inbox.repo.load(n) or {}, body.into.strip().upper()))}

    @r.post("/support-inbox/api/thread/{ident}/split")
    def thread_split(ident: str, body: SplitBody, request: Request):
        need_auth(request, write=True)
        n, ref = split_id(ident)
        new = inbox.split(n, ref, (body.message_id or "").strip())
        if not new:
            raise HTTPException(status_code=400, detail="That message can't start a new issue.")
        return {"ok": True, "id": item_id(n, new)}

    @r.post("/support-inbox/api/case/{ref}/inbound")
    def case_inbound(ref: str, body: InboundBody, request: Request):
        """Her email reply, attached to its case by the drafting session (or the founder). Adding
        HER words is reading, not sending: the token may do it; it still cannot reply or close."""
        need_draft(request)
        text = (body.text or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Empty reply.")
        res = inbox.case_inbound(ref, text[:8000], body.message_id.strip(), body.at.strip(),
                                 body.sender.strip())
        if res == "missing":
            raise HTTPException(status_code=404, detail="No such case.")
        if res == "stranger":
            raise HTTPException(status_code=409, detail="That address is not the one on the case.")
        return {"status": res}

    @r.post("/support-inbox/api/draft")
    def draft(body: DraftBody, request: Request):
        who = need_draft(request)
        if body.kind not in ("wa", "case"):
            raise HTTPException(status_code=400, detail="kind must be 'wa' or 'case'.")
        if len(body.text or "") > 8000:
            raise HTTPException(status_code=400, detail="That draft is too long.")
        if not inbox.set_draft(body.kind, body.id, (body.text or "").strip(), by=who,
                               category=(body.category or "").strip()):
            raise HTTPException(status_code=404, detail="No such conversation or case.")
        return {"ok": True}

    @r.get("/support-inbox")
    def page(request: Request):
        if not cfg.SUPPORT_INBOX_PASSWORD:
            return HTMLResponse(_shell("<p class='note'>The Support inbox is switched off. Set "
                                       "<code>ARUVI_SUPPORT_INBOX_PASSWORD</code> on the server "
                                       "to open it.</p>"), status_code=503)
        if not inbox.authed(request):
            return HTMLResponse(_shell(_LOGIN))
        return HTMLResponse(_shell(_APP, script=True))

    @r.post("/support-inbox/login")
    async def login(request: Request):
        client = (request.client.host if request.client else "?")
        now = time.time()
        fails = [t for t in _FAILS.get(client, []) if now - t < 900]
        _FAILS[client] = fails
        if len(fails) >= 10:
            return HTMLResponse(_shell(_LOGIN.replace(
                "<!--err-->", "<p class='err'>Too many attempts — wait 15 minutes.</p>")), status_code=429)
        # Parsed by hand: the one form in the API, and not worth a python-multipart dependency.
        from urllib.parse import parse_qs
        raw = (await request.body())[:4096].decode("utf-8", "replace")
        pw = (parse_qs(raw).get("password") or [""])[0]
        if not cfg.SUPPORT_INBOX_PASSWORD or not hmac.compare_digest(
                pw.encode(), cfg.SUPPORT_INBOX_PASSWORD.encode()):
            fails.append(now)
            return HTMLResponse(_shell(_LOGIN.replace(
                "<!--err-->", "<p class='err'>That password is not right.</p>")), status_code=401)
        _FAILS.pop(client, None)
        resp = RedirectResponse("/support-inbox", status_code=303)
        resp.set_cookie(COOKIE, inbox.make_cookie(), max_age=SESSION_DAYS * 86400,
                        httponly=True, secure=True, samesite="strict", path="/support-inbox")
        return resp

    @r.post("/support-inbox/logout")
    def logout():
        resp = RedirectResponse("/support-inbox", status_code=303)
        resp.delete_cookie(COOKIE, path="/support-inbox")
        return resp

    @r.get("/support-inbox/api/threads")
    def threads(request: Request):
        need_auth(request)
        out = inbox.repo.list_threads()
        now = datetime.now(timezone.utc)
        for t in out:
            t["window_open"] = window_open(t, now, cfg.WA_PHONE_NUMBER_ID)
        return {"threads": out, "reopen_template": bool(cfg.WA_REOPEN_TEMPLATE)}

    @r.get("/support-inbox/api/thread/{ident}")
    def thread(ident: str, request: Request):
        """ONE issue of a chat (or the general chat): only its messages and its own state — the
        drafting session never sees her other issues."""
        who = need_read_or_token(request)
        n, ref = split_id(ident)
        t = inbox.repo.load(n)
        if t is None:
            raise HTTPException(status_code=404, detail="No such conversation.")
        pairs = issues_of(t.get("messages") or [])
        msgs = [m for r, m in pairs if r == ref]
        if not msgs:
            raise HTTPException(status_code=404, detail="No such conversation.")
        last_in = next((r for r, m in reversed(pairs) if m.get("dir") == "in"), None)
        unread = int(t.get("unread") or 0) if last_in == ref else 0
        if unread and who == "founder":               # the drafting session never marks read
            inbox.repo.mark_read(n)
            unread = 0
        st = issue_state(t, ref)
        return {"id": item_id(n, ref), "number": n, "ref": ref, "name": t.get("name", ""),
                "messages": msgs, "unread": unread, "status": st["status"], "draft": st["draft"],
                "category": st["category"],
                "window_open": window_open(t, current_pn=cfg.WA_PHONE_NUMBER_ID), "phone": _pretty(n),
                "reopen_template": bool(cfg.WA_REOPEN_TEMPLATE)}

    @r.post("/support-inbox/api/thread/{ident}/reply")
    def reply(ident: str, body: ReplyBody, request: Request):
        need_auth(request, write=True)
        n, ref = split_id(ident)
        text = (body.text or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Write a reply first.")
        if len(text) > 4000:
            raise HTTPException(status_code=400, detail="That reply is too long (4000 characters).")
        t = inbox.repo.load(n)
        if t is None:
            raise HTTPException(status_code=404, detail="No such conversation.")
        if not window_open(t, current_pn=cfg.WA_PHONE_NUMBER_ID):
            raise HTTPException(status_code=409, detail=(
                "More than 24 hours have passed since this customer last wrote, so WhatsApp "
                "only allows an approved template now."))
        # ★ NO REFERENCE IN THE CHAT; THE ANSWER QUOTES HER QUESTION (founder, 2026-10-04). The
        # reply goes as a WhatsApp quote-reply to her latest message in this issue, so in her one
        # continuous chat she sees which question it answers — and swiping back routes to it.
        seg = [x for r, x in issues_of(t.get("messages") or []) if r == ref]
        quote = next((x.get("id") for x in reversed(seg) if x.get("dir") == "in" and x.get("id")), "")
        res = inbox.send_text(n, text, issue=ref, reply_to=quote)
        if res.get("status") not in ("sent", "written"):
            raise HTTPException(status_code=502, detail=f"WhatsApp refused it: {res.get('error') or res.get('reason')}")
        return {"status": "sent"}

    @r.post("/support-inbox/api/thread/{ident}/reopen")
    def reopen(ident: str, request: Request):
        need_auth(request, write=True)
        n, ref = split_id(ident)
        if not cfg.WA_REOPEN_TEMPLATE:
            raise HTTPException(status_code=409, detail="No re-open template is configured.")
        if inbox.repo.load(n) is None:
            raise HTTPException(status_code=404, detail="No such conversation.")
        t = inbox.repo.load(n) or {}
        first = first_name(t.get("name"))
        res = inbox.wa.send_template(WhatsAppTemplate(
            to=e164(n), template=cfg.WA_REOPEN_TEMPLATE, language=cfg.WA_TEMPLATE_LANG,
            params=[first] if getattr(cfg, "WA_REOPEN_NAME_PARAM", True) else []))
        inbox.record_template(n, cfg.WA_REOPEN_TEMPLATE,
                              getattr(cfg, "WA_REOPEN_PREVIEW", "").replace("{name}", first)
                              or f"[template: {cfg.WA_REOPEN_TEMPLATE}]", res, by="founder", issue=ref)
        if res.get("status") not in ("sent", "written"):
            raise HTTPException(status_code=502, detail=f"WhatsApp refused it: {res.get('error')}")
        return {"status": "sent"}

    return r


# ── the page ──────────────────────────────────────────────────────────────────
def _shell(body: str, script: bool = False) -> str:
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Meyy — Support inbox</title>
<style>{_CSS}</style></head><body>
<header><span class="brand">MEYY</span><span class="sub">Support inbox</span>
{'<form method="post" action="/support-inbox/logout"><button class="link">Sign out</button></form>' if script else ''}
</header>{body}{'<script>' + _JS + '</script>' if script else ''}</body></html>"""


_LOGIN = """<main class="login"><h1>Sign in</h1><!--err-->
<form method="post" action="/support-inbox/login">
<label>Password<input type="password" name="password" autocomplete="current-password" autofocus required></label>
<button class="primary">Sign in</button></form></main>"""

_APP = """<main class="app">
<section class="list"><div class="filters" role="tablist">
  <button class="chip on" data-f="reply">Needs reply</button><button class="chip" data-f="open">Open</button>
  <button class="chip" data-f="all">All</button>
  <button class="rfr" id="rfr" title="Pull in new email replies and WhatsApp messages now">&#x21bb; Refresh</button></div>
  <div id="list"></div><div class="empty hidden" id="listEmpty">Nothing here.</div><div id="mailSync" class="hidden" style="margin:10px 14px;font-size:12px;color:#a33"></div></section>
<section id="pick" class="pick">Choose a conversation on the left.</section>
<section id="thread" class="thread hidden">
  <div class="thead"><button id="back" class="link">← All</button>
    <div class="tid"><div id="tname" class="tname"></div><div id="tsub" class="tsub"></div></div>
    <div class="tctl"><select id="tcat" title="Category"></select><button id="tstatus" class="ghost"></button></div></div>
  <div id="msgs" class="msgs"></div>
  <div id="closed" class="closed hidden">24-hour window closed — WhatsApp only allows an approved
    template until the customer writes again. <button id="reopen" class="link hidden">Send re-open template</button></div>
  <div id="draftbar" class="draftbar hidden"><span id="draftwho"></span> — read it, edit it, then send.
    <button id="discard" class="link">Discard draft</button></div>
  <form id="replyForm" class="reply"><textarea id="replyText" rows="4" placeholder="Write a reply…" maxlength="8000"></textarea>
    <button class="primary" id="send">Send</button></form>
  <p id="err" class="err"></p>
</section></main>"""

_CSS = """
:root{color-scheme:light;--paper:#f7f3ea;--ink:#23201b;--soft:#6b645a;--pine:#2f5d50;--line:#d9d1c2;--card:#fffdf8;--clay:#b5553a;--tint:#eef4f0;--wa:#1f8a5b}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:var(--paper);color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--pine);color:#f6f1e7;height:55px;flex:none}
.brand{font:700 15px ui-monospace,Menlo,monospace;letter-spacing:.16em}.sub{opacity:.8;font-size:13px;flex:1}
header form{margin:0}header .link{color:#f6f1e7}
.link{background:none;border:0;color:var(--pine);cursor:pointer;font:inherit;padding:4px 0;text-decoration:underline}
.primary{background:var(--pine);color:#fff;border:0;border-radius:8px;padding:10px 18px;font-family:inherit;font-weight:600;font-size:14px;cursor:pointer}
.primary:disabled{opacity:.5}.ghost{background:none;border:1px solid var(--pine);color:var(--pine);border-radius:999px;padding:5px 12px;font:600 12px inherit;cursor:pointer}
.login{max-width:360px;margin:60px auto;padding:0 16px}.login label{display:block;margin:16px 0 8px;font-size:13px;color:var(--soft)}
.login input{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:8px;font:inherit}
.err{color:var(--clay);font-size:13px;min-height:1em}.err:empty{display:none}.note{max-width:520px;margin:40px auto;padding:0 16px}
.app{display:grid;grid-template-columns:340px 1fr;height:calc(100vh - 55px);height:calc(100dvh - 55px)}
.list{border-right:1px solid var(--line);overflow-y:auto;background:var(--card)}
.filters{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card);z-index:1}
.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 11px;font:13px inherit;cursor:pointer;color:var(--ink)}
.chip.on{background:var(--pine);border-color:var(--pine);color:#fff}
.rfr{margin-left:auto;border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 11px;font:13px inherit;cursor:pointer;color:var(--pine)}
.rfr:disabled{opacity:.55;cursor:default}
.row{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:11px 14px;cursor:pointer;font:inherit;color:inherit}
.row.on{background:#ece5d6}.rtop{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.rname{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rtime{font-size:12px;color:var(--soft);white-space:nowrap}
.rtags{display:flex;gap:5px;flex-wrap:wrap;margin:3px 0 2px}
.tag{font:600 10.5px ui-monospace,Menlo,monospace;letter-spacing:.04em;text-transform:uppercase;border-radius:4px;padding:1px 6px;background:#efe9dd;color:var(--soft)}
.tag.wa{background:#e3f3ea;color:var(--wa)}.tag.mail{background:#e8ecf4;color:#4a5d86}.tag.draft{background:var(--pine);color:#fff}
.tag.done{background:#eee;color:#888}.tag.flood{background:#fbe9e4;color:var(--clay)}
.mv{display:block;margin-top:4px;background:none;border:0;padding:0;font:11px inherit;color:var(--soft);text-decoration:underline;cursor:pointer}
.rprev{font-size:13px;color:var(--soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.badge{background:var(--clay);color:#fff;border-radius:10px;padding:0 7px;font-size:12px;margin-left:6px}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#4a9a6e;margin-right:6px;vertical-align:middle}
.empty{padding:24px;color:var(--soft)}
.thread{display:flex;flex-direction:column;min-width:0}
.thead{display:flex;gap:14px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--card)}
.thead #back{display:none}
/* One row (founder, 2026-10-04): name, then channel · reference · number beside it, cut short with … */
.tid{flex:1;min-width:0;display:flex;align-items:baseline;gap:10px}.tname{font-weight:600;white-space:nowrap}
.tsub{font-size:12px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}

.tctl{display:flex;gap:8px;align-items:center}.tctl select{font:13px inherit;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:#fff}
.msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
.case{align-self:stretch;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.case dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0 0 10px;font-size:13px}
.case dt{color:var(--soft)}.case dd{margin:0}.case .said{white-space:pre-wrap;overflow-wrap:anywhere;border-left:3px solid var(--line);padding-left:10px}
.case.wrep{align-self:flex-start;max-width:78%;padding:8px 12px;margin-bottom:-4px}.case.wrep dl{margin:0}
.m{max-width:78%;padding:8px 12px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.m.in{align-self:flex-start;background:var(--card);border:1px solid var(--line)}
.m.out{align-self:flex-end;background:#dcebe3}.meta{display:block;font-size:11px;color:var(--soft);margin-top:4px}
.m.failed{border:1px solid var(--clay)}
.closed,.draftbar{margin:0 16px 8px;padding:9px 12px;border-radius:8px;font-size:13px}
.closed{background:#f3e3d6}.draftbar{background:var(--tint);border:1px solid #cde0d8;color:var(--pine)}
.reply{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--line);background:var(--card);align-items:center}
.reply textarea{flex:1;padding:10px;border:1px solid var(--line);border-radius:8px;font:inherit;resize:vertical}
.reply textarea.drafted{border-color:var(--pine);background:#fbfdfb}
.pick{display:flex;align-items:center;justify-content:center;color:var(--soft)}.app.open .pick{display:none}
.hidden{display:none!important}
@media (max-width:760px){.app{grid-template-columns:1fr}.pick{display:none}.app.open .list{display:none}.app:not(.open) .thread{display:none!important}
 .thead{flex-wrap:wrap}.thead #back{display:inline}.tctl{width:100%}}
"""

_JS = r"""
const $=s=>document.querySelector(s);let cur=null,filter='reply',items=[],detail=null;
const CATS=[['','Category…'],['problem','Something isn\'t working'],['plan','Lesson plan looks wrong'],['billing','Billing or account'],['suggestion','A suggestion'],['other','Something else']];
const CATL=Object.fromEntries(CATS.filter(c=>c[0]));
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const when=s=>{if(!s)return'';const d=new Date(s),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString([], {day:'numeric',month:'short'})+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})};
async function api(p,o={}){const r=await fetch('/support-inbox/api'+p,{credentials:'same-origin',...o,headers:{'Content-Type':'application/json','X-Meyy-Inbox':'1',...(o.headers||{})}});
 if(r.status===401){location.reload();throw 0}const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.detail||('Error '+r.status));return j}
const key=i=>i.kind+':'+i.id;
const shut=i=>i.status==='done'||i.status==='closed';
const shown=i=>filter==='all'?true:filter==='open'?!shut(i):(i.needs_reply&&!shut(i));
const pend={};   // status changes sent but not yet confirmed — a list refresh must not undo them
async function loadList(){const j=await api('/queue');items=j.items.map(i=>pend[i.kind+':'+i.id]?{...i,status:pend[i.kind+':'+i.id]}:i);window._reopen=j.reopen_template;const ms=j.mail_sync||{},mse=document.getElementById('mailSync');if(mse){mse.textContent=ms.error?'Email replies are not syncing: '+ms.error:'';mse.classList.toggle('hidden',!ms.error)}renderList()}
function renderList(){const L=$('#list');L.innerHTML='';
 const vis=items.filter(shown);$('#listEmpty').classList.toggle('hidden',vis.length>0);
 for(const t of vis){const b=document.createElement('button');b.className='row'+(cur&&key(t)===cur?' on':'');
  const kind=t.kind==='wa'?`<span class="tag wa">WhatsApp${t.ref?' · '+esc(t.ref):''}</span>`:`<span class="tag mail">Email · ${esc(t.id)}</span>`;
  const cat=t.category?`<span class="tag">${esc(t.category_label||CATL[t.category]||t.category)}</span>`:'';
  const st=((t.status==='done'||t.status==='closed')?'<span class="tag done">Resolved</span>':'')+(t.flood?'<span class="tag flood">Many messages</span>':'')+(t.kind==='wa'&&t.member===false?'<span class="tag flood">Not a member</span>':'');
  b.innerHTML=`<div class="rtop"><span class="rname">${t.kind==='wa'&&t.window_open?'<span class="dot" title="Reply window open"></span>':''}${esc(t.name)}${t.unread?`<span class="badge">${t.unread}</span>`:''}</span><span class="rtime">${when(t.at)}</span></div><div class="rtags">${kind}${cat}${t.has_draft?'<span class="tag draft">Draft ready</span>':''}${st}</div><div class="rprev">${t.preview_dir==='out'?'You: ':''}${esc(t.preview)}</div>`;
  b.onclick=()=>openItem(t.kind,t.id);L.appendChild(b)}}
document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{filter=c.dataset.f;document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===c));renderList()});
async function openItem(kind,id){cur=kind+':'+id;location.hash=cur;$('.app').classList.add('open');$('#thread').classList.remove('hidden');$('#err').textContent='';renderList();await refresh(true,true);loadList()}
/* A WhatsApp lesson report (MEY-W-n): its number and the lesson rows, above her message —
   the email case's details panel, read back from her "Problem in:" line. */
function reportCard(m){const r=m.report||{},s=m.support;const rows=s?[['Reference',m.ref],['About',s.about],['Sign-in',s.signin]].filter(x=>x[1]):[['Reference',m.ref],['Class',[r.subject,r.grade].filter(Boolean).join(' · ')],['Chapter',r.chapter],['Unit',[r.unit,r.phase].filter(Boolean).join(' · ')]].filter(x=>x[1]);
 return `<div class="case wrep"><dl>${rows.map(x=>`<dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd>`).join('')}</dl></div>`}
function bubble(m,who){return `<div class="m ${m.dir} ${m.status==='failed'?'failed':''}">${esc(m.text)}<span class="meta">${when(m.at)}${m.dir==='out'?' · '+esc(who(m))+(m.status?' · '+esc(m.status):''):''}${m.error?' — '+esc(m.error):''}</span></div>`}
async function refresh(scroll,fill){if(!cur)return;const want=cur;const [kind,id]=[cur.slice(0,cur.indexOf(':')),cur.slice(cur.indexOf(':')+1)];
 const M=$('#msgs'),atBottom=M.scrollHeight-M.scrollTop-M.clientHeight<60;let draft={},open=true,status='open';
 if(kind==='wa'){const t=await api('/thread/'+encodeURIComponent(id));if(cur!==want)return;detail={kind,...t};draft=t.draft||{};open=t.window_open;status=t.status||'open';
  $('#tname').textContent=t.name||t.phone;$('#tsub').textContent='WhatsApp · '+(t.ref?t.ref+' · ':'')+t.phone;
  M.innerHTML=t.messages.map((m,i)=>(m.ref?reportCard(m):'')+bubble(m,m=>m.by==='auto-greeting'?'automatic greeting':m.by==='auto-ack'?'automatic acknowledgement':m.by==='system'?'automatic':'you')
   +(i>0&&m.dir==='in'&&m.id&&t.ref?`<button class="mv" data-mid="${esc(m.id)}">Move this and later messages to a new issue</button>`:'')).join('');
  M.querySelectorAll('.mv').forEach(b=>b.onclick=()=>splitAt(b.dataset.mid));

  $('#tcat').innerHTML=CATS.map(([v,l])=>`<option value="${v}" ${v===(t.category||'')?'selected':''}>${esc(l)}</option>`).join('');$('#tcat').classList.remove('hidden');
  $('#tstatus').textContent=status==='done'?'Reopen':'Mark resolved';
  $('#closed').classList.toggle('hidden',open);$('#reopen').classList.toggle('hidden',!window._reopen);$('#send').textContent='Send on WhatsApp';
 }else{const c=await api('/case/'+encodeURIComponent(id));if(cur!==want)return;detail={kind,...c};draft=c.draft||{};status=c.status||'open';
  $('#tname').textContent=c.name||c.user_id;$('#tsub').textContent=`Email · ${c.reference} · ${c.email||'no email on the case'}`;
  const ctx=c.context||{},rows=[['About',c.category_label],['Received',when(c.created_at)],['Class',[String(ctx.subject||'').replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase()),ctx.grade].filter(Boolean).join(' · ')],['Chapter',ctx.chapter],['Unit',[ctx.unit,ctx.phase].filter(Boolean).join(' · ')],['Activity',ctx.unit_title],['Plan ref',ctx.plan_ref],['Plan file',ctx.plan_file],['Screen',ctx.screen],['App',ctx.version]].filter(r=>r[1]);
  M.innerHTML=`<div class="case"><dl>${rows.map(r=>`<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl><div class="said">${esc(c.message)}</div></div>`+(c.thread||[]).map(m=>bubble(m,()=> 'you')).join('');
  $('#tcat').classList.add('hidden');$('#tstatus').textContent=status==='closed'?'Reopen':'Mark resolved';
  $('#closed').classList.add('hidden');open=!!c.email;$('#send').textContent='Send email';}
 if(scroll||atBottom)M.scrollTop=M.scrollHeight;
 $('#tstatus').disabled=false;
 const T=$('#replyText');T.disabled=!open;$('#send').disabled=!open;
 $('#draftbar').classList.toggle('hidden',!draft.text);$('#draftwho').textContent=draft.by==='claude'?'Draft from your drafting session':'Saved draft';
 if(fill||(!T.value&&draft.text)){T.value=draft.text||'';}T.classList.toggle('drafted',!!draft.text&&T.value===draft.text)}
$('#replyForm').onsubmit=async e=>{e.preventDefault();const v=$('#replyText').value.trim();if(!v||!detail)return;
 const isWa=detail.kind==='wa';if(!confirm(isWa?'Send this on WhatsApp?':'Email this reply to '+(detail.email||'her')+'?'))return;
 $('#send').disabled=true;$('#err').textContent='';
 try{await api(isWa?'/thread/'+encodeURIComponent(detail.id)+'/reply':'/case/'+encodeURIComponent(detail.reference)+'/reply',{method:'POST',body:JSON.stringify({text:v})});
  $('#replyText').value='';await refresh(true,true);loadList()}catch(x){$('#err').textContent=x.message||'Could not send.';$('#send').disabled=false}};
$('#discard').onclick=async()=>{if(!detail)return;await api('/draft',{method:'POST',body:JSON.stringify({kind:detail.kind,id:detail.kind==='wa'?detail.id:detail.reference,text:''})});$('#replyText').value='';await refresh(false,true);loadList()};
$('#tcat').onchange=async()=>{if(detail&&detail.kind==='wa'){await api('/thread/'+encodeURIComponent(detail.id)+'/label',{method:'POST',body:JSON.stringify({category:$('#tcat').value})});loadList()}};
/* ★ INSTANT (founder, 2026-10-03: "it takes a second"). The button, the row and the list flip
   at once; the server is told in the background and the list re-syncs after. One name for both
   kinds — "Mark resolved" / "Reopen" — though a case stores `closed` and a chat `done`. */
/* ⚠️ ONE CLICK, ONE ITEM (founder, 2026-10-03: "sometimes it is getting stuck in reopen"). While the
   next conversation was still loading, `detail` was still the one just resolved — a second click
   (the natural "did it work?" click) flipped THAT one back open, and the pane showed Reopen. Now the
   button is disabled and `detail` dropped the instant we move on, until the next item has loaded. */
$('#tstatus').onclick=()=>{if(!detail||$('#tstatus').disabled)return;const wa=detail.kind==='wa';const now=detail.status||'open';
 const shutNow=now==='done'||now==='closed';const next=shutNow?'open':(wa?'done':'closed');
 const myId=wa?detail.id:detail.reference,kind=detail.kind;
 const before=items.filter(shown),pos=before.findIndex(i=>i.kind===kind&&i.id===myId);
 detail.status=next;$('#tstatus').textContent=shutNow?'Mark resolved':'Reopen';
 const it=items.find(i=>i.kind===kind&&i.id===myId);if(it)it.status=next;
 /* ★ RESOLVED → OUT OF THE WAY, NEXT ONE UP (founder, 2026-10-03). In "Needs reply" and "Open" a
    resolved item leaves the list at once and the conversation below it (or above, if it was the
    last) opens in its place; with nothing left, the pane empties. Under "All" it stays, with Reopen. */
 if(!shutNow&&filter!=='all'){const after=items.filter(shown);const nxt=after[Math.min(Math.max(pos,0),after.length-1)];
  detail=null;$('#tstatus').disabled=true;$('#send').disabled=true;$('#msgs').innerHTML='';$('#replyText').value='';
  if(nxt)openItem(nxt.kind,nxt.id);else{cur=null;detail=null;history.replaceState(null,'',location.pathname);
   $('.app').classList.remove('open');$('#thread').classList.add('hidden');renderList()}}
 else renderList();
 const pk=kind+':'+myId;pend[pk]=next;
 api(wa?'/thread/'+encodeURIComponent(myId)+'/label':'/case/'+encodeURIComponent(myId)+'/label',{method:'POST',body:JSON.stringify({status:next})})
  .then(()=>{delete pend[pk];loadList()}).catch(x=>{delete pend[pk];$('#err').textContent=x.message||'Could not save that.';refresh(false,false);loadList()})};
$('#reopen').onclick=async()=>{if(!confirm('Send the re-open template to this customer?'))return;
 try{await api('/thread/'+encodeURIComponent(detail.id)+'/reopen',{method:'POST'});await refresh(true,false)}catch(x){$('#err').textContent=x.message}};
/* ↻ REFRESH (founder, 2026-10-04): pull email replies from support@ NOW (not on the once-a-minute
   background pass), then reload the list and the open conversation. WhatsApp needs no pull — the
   webhook files it the moment it arrives — so for WhatsApp this is just the reload. */
$('#rfr').onclick=async()=>{const b=$('#rfr');if(b.disabled)return;b.disabled=true;b.textContent='Refreshing…';$('#err').textContent='';
 try{const st=await api('/mail/sync',{method:'POST'});await loadList();await refresh(false,false);
  b.textContent=st&&st.added?`↻ ${st.added} new`:'↻ Up to date'}catch(x){b.textContent='↻ Refresh';$('#err').textContent=x.message||'Could not refresh.'}
 setTimeout(()=>{b.textContent='↻ Refresh';b.disabled=false},2500)};
/* ★ MOVE A TOPIC OUT (2026-10-04). The merge menu and its hint bar were removed (founder, 2026-10-05:
   the hint pointed at the issue we last ANSWERED, not the one she was waiting on — no use). */
async function splitAt(mid){if(!detail)return;if(!confirm('Move this message, and the ones after it in this issue, to a new issue?'))return;
 try{const j=await api('/thread/'+encodeURIComponent(detail.id)+'/split',{method:'POST',body:JSON.stringify({message_id:mid})});await loadList();openItem('wa',j.id)}catch(x){$('#err').textContent=x.message||'Could not move it.'}}
$('#back').onclick=()=>{cur=null;history.replaceState(null,'',location.pathname);$('.app').classList.remove('open');loadList()};
loadList().then(()=>{const h=decodeURIComponent(location.hash.slice(1));if(h.includes(':'))openItem(h.split(':')[0],h.slice(h.indexOf(':')+1));else if(/^\d+$/.test(h))openItem('wa',h)});
setInterval(()=>{loadList();refresh(false,false)},15000);
"""
