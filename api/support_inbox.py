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
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel

from aruvi_core.adapters.whatsapp_inbox_file import number_key, e164
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


class Inbox:
    """The inbox's behaviour, given the app's own objects (no import of api.main here)."""

    def __init__(self, *, config, repo, wa_client, notifier, account_repo,
                 log: Callable[[Dict[str, Any]], None], support_repo=None, category_label=None):
        self.config, self.repo, self.wa = config, repo, wa_client
        self.notifier, self.accounts, self.log = notifier, account_repo, log
        self.cases = support_repo                    # email cases (None in old wiring/tests)
        self.cat_label = category_label or (lambda k: str(k or "").replace("_", " ").capitalize())

    # ── identity ──
    def _name_for(self, n: str, fallback: str = "") -> str:
        try:
            a = self.accounts.load(n, n)
        except Exception:                                   # noqa: BLE001
            a = None
        nm = (getattr(a, "display_name", "") or "").strip() if a else ""
        return nm if nm and not nm.isdigit() else (fallback or "")

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
        before = self.repo.append(
            n, {"id": m.get("id", ""), "dir": "in", "type": m.get("type", ""), "text": text},
            name=self._name_for(n, profile_name))
        self.repo.patch(n, last_inbound_pn=to_pn or self.config.WA_PHONE_NUMBER_ID)
        now = datetime.now(timezone.utc)
        # Greeting: first ever, or first after the gap — and never in answer to STOP.
        last_in = _parse(before.get("last_inbound_at", ""))
        if text.strip().upper() != "STOP" and (
                last_in is None or now - last_in > timedelta(days=self.config.WA_GREETING_GAP_DAYS)):
            self.send_text(n, self.config.WA_GREETING, by="auto-greeting")
            self.repo.patch(n, greeted_at=now.isoformat())
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
        link = f"{self.config.PUBLIC_API_URL}/support-inbox#{n}"
        try:
            self.notifier.send(EmailMessage(
                to=to, subject=f"[Meyy WhatsApp] New message from {who}",
                text=(f"{who} (+{e164(n)}) wrote on WhatsApp:\n\n{text[:1500]}\n\n"
                      f"Reply in the Support inbox:\n{link}\n"),
                reply_to=to))
        except Exception:                                   # noqa: BLE001
            pass

    # ── outbound ──
    def send_text(self, n: str, body: str, by: str = "founder") -> Dict[str, Any]:
        res = self.wa.send_text(e164(n), body)
        ok = res.get("status") in ("sent", "written")
        self.repo.append(n, {"id": res.get("message_id", ""), "dir": "out", "type": "text",
                             "text": body, "by": by,
                             "status": "accepted" if ok else "failed",
                             **({} if ok else {"error": str(res.get("error") or res.get("reason") or "")})})
        self.log({"kind": "send_text", "by": by, "to": "…" + e164(n)[-4:], "result": res})
        if ok and by == "founder":
            self.repo.patch(n, draft={})             # a sent reply uses the draft up
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
                        by: str = "system") -> None:
        ok = res.get("status") in ("sent", "written")
        self.repo.append(n, {"id": res.get("message_id", ""), "dir": "out", "type": "template",
                             "template": template, "text": text, "by": by,
                             "status": "accepted" if ok else "failed",
                             **({} if ok else {"error": str(res.get("error") or res.get("reason") or "")})})

    # ── the one queue ──
    def queue(self) -> list:
        now = datetime.now(timezone.utc)
        items = []
        for t in self.repo.list_threads():
            items.append({"kind": "wa", "id": t["number"], "name": t.get("name") or ("+91 " + t["number"]),
                          "preview": t.get("preview", ""), "preview_dir": t.get("preview_dir", ""),
                          "at": t.get("last_activity_at", ""), "unread": t.get("unread", 0),
                          "window_open": window_open(t, now, self.config.WA_PHONE_NUMBER_ID),
                          "category": t.get("category", ""), "status": t.get("status", "open"),
                          "has_draft": t.get("has_draft", False),
                          "needs_reply": t.get("preview_dir") == "in"})
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
            if self.repo.load(ident) is None:
                return False
            extra = {"category": category} if category else {}
            self.repo.patch(ident, draft=draft, **extra)
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
        return {"items": inbox.queue(), "reopen_template": bool(cfg.WA_REOPEN_TEMPLATE)}

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

    @r.post("/support-inbox/api/thread/{n}/label")
    def thread_label(n: str, body: LabelBody, request: Request):
        need_auth(request, write=True)
        if inbox.repo.load(n) is None:
            raise HTTPException(status_code=404, detail="No such conversation.")
        fields = {}
        if body.category is not None:
            fields["category"] = body.category
        if body.status in ("open", "done"):
            fields["status"] = body.status
        inbox.repo.patch(n, **fields)
        return {"ok": True}

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

    @r.get("/support-inbox/api/thread/{n}")
    def thread(n: str, request: Request):
        who = need_read_or_token(request)
        t = inbox.repo.load(n)
        if t is None:
            raise HTTPException(status_code=404, detail="No such conversation.")
        if t.get("unread") and who == "founder":      # the drafting session never marks read
            inbox.repo.mark_read(n)
            t["unread"] = 0
        return {**t, "window_open": window_open(t, current_pn=cfg.WA_PHONE_NUMBER_ID), "phone": _pretty(n),
                "reopen_template": bool(cfg.WA_REOPEN_TEMPLATE)}

    @r.post("/support-inbox/api/thread/{n}/reply")
    def reply(n: str, body: ReplyBody, request: Request):
        need_auth(request, write=True)
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
        res = inbox.send_text(n, text)
        if res.get("status") not in ("sent", "written"):
            raise HTTPException(status_code=502, detail=f"WhatsApp refused it: {res.get('error') or res.get('reason')}")
        return {"status": "sent"}

    @r.post("/support-inbox/api/thread/{n}/reopen")
    def reopen(n: str, request: Request):
        need_auth(request, write=True)
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
                              or f"[template: {cfg.WA_REOPEN_TEMPLATE}]", res, by="founder")
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
  <button class="chip" data-f="all">All</button></div>
  <div id="list"></div><div class="empty hidden" id="listEmpty">Nothing here.</div></section>
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
.row{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:11px 14px;cursor:pointer;font:inherit;color:inherit}
.row.on{background:#ece5d6}.rtop{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.rname{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rtime{font-size:12px;color:var(--soft);white-space:nowrap}
.rtags{display:flex;gap:5px;flex-wrap:wrap;margin:3px 0 2px}
.tag{font:600 10.5px ui-monospace,Menlo,monospace;letter-spacing:.04em;text-transform:uppercase;border-radius:4px;padding:1px 6px;background:#efe9dd;color:var(--soft)}
.tag.wa{background:#e3f3ea;color:var(--wa)}.tag.mail{background:#e8ecf4;color:#4a5d86}.tag.draft{background:var(--pine);color:#fff}
.tag.done{background:#eee;color:#888}
.rprev{font-size:13px;color:var(--soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.badge{background:var(--clay);color:#fff;border-radius:10px;padding:0 7px;font-size:12px;margin-left:6px}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#4a9a6e;margin-right:6px;vertical-align:middle}
.empty{padding:24px;color:var(--soft)}
.thread{display:flex;flex-direction:column;min-width:0}
.thead{display:flex;gap:14px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--card)}
.thead #back{display:none}.tid{flex:1;min-width:0}.tname{font-weight:600}.tsub{font-size:12px;color:var(--soft);overflow-wrap:anywhere}
.tctl{display:flex;gap:8px;align-items:center}.tctl select{font:13px inherit;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:#fff}
.msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
.case{align-self:stretch;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.case dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0 0 10px;font-size:13px}
.case dt{color:var(--soft)}.case dd{margin:0}.case .said{white-space:pre-wrap;overflow-wrap:anywhere;border-left:3px solid var(--line);padding-left:10px}
.m{max-width:78%;padding:8px 12px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.m.in{align-self:flex-start;background:var(--card);border:1px solid var(--line)}
.m.out{align-self:flex-end;background:#dcebe3}.meta{display:block;font-size:11px;color:var(--soft);margin-top:4px}
.m.failed{border:1px solid var(--clay)}
.closed,.draftbar{margin:0 16px 8px;padding:9px 12px;border-radius:8px;font-size:13px}
.closed{background:#f3e3d6}.draftbar{background:var(--tint);border:1px solid #cde0d8;color:var(--pine)}
.reply{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--line);background:var(--card);align-items:flex-end}
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
async function loadList(){const j=await api('/queue');items=j.items;window._reopen=j.reopen_template;const L=$('#list');L.innerHTML='';
 const vis=items.filter(shown);$('#listEmpty').classList.toggle('hidden',vis.length>0);
 for(const t of vis){const b=document.createElement('button');b.className='row'+(cur&&key(t)===cur?' on':'');
  const kind=t.kind==='wa'?'<span class="tag wa">WhatsApp</span>':`<span class="tag mail">Email · ${esc(t.id)}</span>`;
  const cat=t.category?`<span class="tag">${esc(t.category_label||CATL[t.category]||t.category)}</span>`:'';
  const st=(t.status==='done'||t.status==='closed')?`<span class="tag done">${t.status}</span>`:'';
  b.innerHTML=`<div class="rtop"><span class="rname">${t.kind==='wa'&&t.window_open?'<span class="dot" title="Reply window open"></span>':''}${esc(t.name)}${t.unread?`<span class="badge">${t.unread}</span>`:''}</span><span class="rtime">${when(t.at)}</span></div><div class="rtags">${kind}${cat}${t.has_draft?'<span class="tag draft">Draft ready</span>':''}${st}</div><div class="rprev">${t.preview_dir==='out'?'You: ':''}${esc(t.preview)}</div>`;
  b.onclick=()=>openItem(t.kind,t.id);L.appendChild(b)}}
document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{filter=c.dataset.f;document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===c));loadList()});
async function openItem(kind,id){cur=kind+':'+id;location.hash=cur;$('.app').classList.add('open');$('#thread').classList.remove('hidden');$('#err').textContent='';await refresh(true,true);loadList()}
function bubble(m,who){return `<div class="m ${m.dir} ${m.status==='failed'?'failed':''}">${esc(m.text)}<span class="meta">${when(m.at)}${m.dir==='out'?' · '+esc(who(m))+(m.status?' · '+esc(m.status):''):''}${m.error?' — '+esc(m.error):''}</span></div>`}
async function refresh(scroll,fill){if(!cur)return;const [kind,id]=[cur.slice(0,cur.indexOf(':')),cur.slice(cur.indexOf(':')+1)];
 const M=$('#msgs'),atBottom=M.scrollHeight-M.scrollTop-M.clientHeight<60;let draft={},open=true,status='open';
 if(kind==='wa'){const t=await api('/thread/'+encodeURIComponent(id));detail={kind,...t};draft=t.draft||{};open=t.window_open;status=t.status||'open';
  $('#tname').textContent=t.name||t.phone;$('#tsub').textContent='WhatsApp · '+t.phone;
  M.innerHTML=t.messages.map(m=>bubble(m,m=>m.by==='auto-greeting'?'automatic greeting':m.by==='system'?'automatic':'you')).join('');
  $('#tcat').innerHTML=CATS.map(([v,l])=>`<option value="${v}" ${v===(t.category||'')?'selected':''}>${esc(l)}</option>`).join('');$('#tcat').classList.remove('hidden');
  $('#tstatus').textContent=status==='done'?'Reopen':'Mark done';
  $('#closed').classList.toggle('hidden',open);$('#reopen').classList.toggle('hidden',!window._reopen);$('#send').textContent='Send on WhatsApp';
 }else{const c=await api('/case/'+encodeURIComponent(id));detail={kind,...c};draft=c.draft||{};status=c.status||'open';
  $('#tname').textContent=c.name||c.user_id;$('#tsub').textContent=`Email · ${c.reference} · ${c.email||'no email on the case'}`;
  const ctx=c.context||{},rows=[['About',c.category_label],['Received',when(c.created_at)],['Class',[String(ctx.subject||'').replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase()),ctx.grade].filter(Boolean).join(' · ')],['Chapter',ctx.chapter],['Unit',[ctx.unit,ctx.phase].filter(Boolean).join(' · ')],['Activity',ctx.unit_title],['Plan ref',ctx.plan_ref],['Screen',ctx.screen],['App',ctx.version]].filter(r=>r[1]);
  M.innerHTML=`<div class="case"><dl>${rows.map(r=>`<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl><div class="said">${esc(c.message)}</div></div>`+(c.thread||[]).map(m=>bubble(m,()=> 'you')).join('');
  $('#tcat').classList.add('hidden');$('#tstatus').textContent=status==='closed'?'Reopen':'Mark closed';
  $('#closed').classList.add('hidden');open=!!c.email;$('#send').textContent='Send email';}
 if(scroll||atBottom)M.scrollTop=M.scrollHeight;
 const T=$('#replyText');T.disabled=!open;$('#send').disabled=!open;
 $('#draftbar').classList.toggle('hidden',!draft.text);$('#draftwho').textContent=draft.by==='claude'?'Draft from your drafting session':'Saved draft';
 if(fill||(!T.value&&draft.text)){T.value=draft.text||'';}T.classList.toggle('drafted',!!draft.text&&T.value===draft.text)}
$('#replyForm').onsubmit=async e=>{e.preventDefault();const v=$('#replyText').value.trim();if(!v||!detail)return;
 const isWa=detail.kind==='wa';if(!confirm(isWa?'Send this on WhatsApp?':'Email this reply to '+(detail.email||'her')+'?'))return;
 $('#send').disabled=true;$('#err').textContent='';
 try{await api(isWa?'/thread/'+encodeURIComponent(detail.number)+'/reply':'/case/'+encodeURIComponent(detail.reference)+'/reply',{method:'POST',body:JSON.stringify({text:v})});
  $('#replyText').value='';await refresh(true,true);loadList()}catch(x){$('#err').textContent=x.message||'Could not send.';$('#send').disabled=false}};
$('#discard').onclick=async()=>{if(!detail)return;await api('/draft',{method:'POST',body:JSON.stringify({kind:detail.kind,id:detail.kind==='wa'?detail.number:detail.reference,text:''})});$('#replyText').value='';await refresh(false,true);loadList()};
$('#tcat').onchange=async()=>{if(detail&&detail.kind==='wa'){await api('/thread/'+encodeURIComponent(detail.number)+'/label',{method:'POST',body:JSON.stringify({category:$('#tcat').value})});loadList()}};
$('#tstatus').onclick=async()=>{if(!detail)return;const wa=detail.kind==='wa';const now=wa?(detail.status||'open'):(detail.status||'open');
 const next=wa?(now==='done'?'open':'done'):(now==='closed'?'open':'closed');
 await api(wa?'/thread/'+encodeURIComponent(detail.number)+'/label':'/case/'+encodeURIComponent(detail.reference)+'/label',{method:'POST',body:JSON.stringify({status:next})});await refresh(false,false);loadList()};
$('#reopen').onclick=async()=>{if(!confirm('Send the re-open template to this customer?'))return;
 try{await api('/thread/'+encodeURIComponent(detail.number)+'/reopen',{method:'POST'});await refresh(true,false)}catch(x){$('#err').textContent=x.message}};
$('#back').onclick=()=>{cur=null;history.replaceState(null,'',location.pathname);$('.app').classList.remove('open');loadList()};
loadList().then(()=>{const h=decodeURIComponent(location.hash.slice(1));if(h.includes(':'))openItem(h.split(':')[0],h.slice(h.indexOf(':')+1));else if(/^\d+$/.test(h))openItem('wa',h)});
setInterval(()=>{loadList();refresh(false,false)},15000);
"""
