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


def _pretty(n: str) -> str:
    d = e164(n)
    return f"+91 {d[2:7]} {d[7:]}" if len(d) == 12 and d.startswith("91") else "+" + d


def window_open(thread: Optional[Dict[str, Any]], now: Optional[datetime] = None) -> bool:
    last = _parse((thread or {}).get("last_inbound_at", ""))
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
                 log: Callable[[Dict[str, Any]], None]):
        self.config, self.repo, self.wa = config, repo, wa_client
        self.notifier, self.accounts, self.log = notifier, account_repo, log

    # ── identity ──
    def _name_for(self, n: str, fallback: str = "") -> str:
        try:
            a = self.accounts.load(n, n)
        except Exception:                                   # noqa: BLE001
            a = None
        nm = (getattr(a, "display_name", "") or "").strip() if a else ""
        return nm if nm and not nm.isdigit() else (fallback or "")

    # ── inbound (called by the webhook) ──
    def on_message(self, m: Dict[str, Any], profile_name: str = "") -> None:
        n = number_key(m.get("from") or "")
        if not n:
            return
        text = describe(m)
        before = self.repo.append(
            n, {"id": m.get("id", ""), "dir": "in", "type": m.get("type", ""), "text": text},
            name=self._name_for(n, profile_name))
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
        return res

    def record_template(self, n: str, template: str, text: str, res: Dict[str, Any],
                        by: str = "system") -> None:
        ok = res.get("status") in ("sent", "written")
        self.repo.append(n, {"id": res.get("message_id", ""), "dir": "out", "type": "template",
                             "template": template, "text": text, "by": by,
                             "status": "accepted" if ok else "failed",
                             **({} if ok else {"error": str(res.get("error") or res.get("reason") or "")})})

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


def build_router(inbox: Inbox) -> APIRouter:
    r = APIRouter(include_in_schema=False)
    cfg = inbox.config

    def need_auth(request: Request, write: bool = False) -> None:
        if not inbox.authed(request):
            raise HTTPException(status_code=401, detail="Please sign in to the Support inbox.")
        if write and request.headers.get("X-Meyy-Inbox") != "1":
            raise HTTPException(status_code=403, detail="Refused.")

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
            t["window_open"] = window_open(t, now)
        return {"threads": out, "reopen_template": bool(cfg.WA_REOPEN_TEMPLATE)}

    @r.get("/support-inbox/api/thread/{n}")
    def thread(n: str, request: Request):
        need_auth(request)
        t = inbox.repo.load(n)
        if t is None:
            raise HTTPException(status_code=404, detail="No such conversation.")
        if t.get("unread"):
            inbox.repo.mark_read(n)
            t["unread"] = 0
        return {**t, "window_open": window_open(t), "phone": _pretty(n),
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
        if not window_open(t):
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
        res = inbox.wa.send_template(WhatsAppTemplate(
            to=e164(n), template=cfg.WA_REOPEN_TEMPLATE, language=cfg.WA_TEMPLATE_LANG))
        inbox.record_template(n, cfg.WA_REOPEN_TEMPLATE, f"[template: {cfg.WA_REOPEN_TEMPLATE}]",
                              res, by="founder")
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
<section id="list" class="list"><div class="empty" id="listEmpty">No conversations yet.</div></section>
<section id="pick" class="pick">Choose a conversation on the left.</section>
<section id="thread" class="thread hidden">
  <div class="thead"><button id="back" class="link">← All</button>
    <div><div id="tname" class="tname"></div><div id="tphone" class="tphone"></div></div></div>
  <div id="msgs" class="msgs"></div>
  <div id="closed" class="closed hidden">24-hour window closed — WhatsApp only allows an approved
    template until the customer writes again. <button id="reopen" class="link hidden">Send re-open template</button></div>
  <form id="replyForm" class="reply"><textarea id="replyText" rows="3" placeholder="Write a reply…" maxlength="4000"></textarea>
    <button class="primary" id="send">Send</button></form>
  <p id="err" class="err"></p>
</section></main>"""

_CSS = """
:root{color-scheme:light;--paper:#f7f3ea;--ink:#23201b;--soft:#6b645a;--pine:#2f5d50;--line:#d9d1c2;--card:#fffdf8;--clay:#b5553a}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:var(--paper);color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--pine);color:#f6f1e7}
.brand{font:700 15px ui-monospace,Menlo,monospace;letter-spacing:.16em}.sub{opacity:.8;font-size:13px;flex:1}
header form{margin:0}header .link{color:#f6f1e7}
.link{background:none;border:0;color:var(--pine);cursor:pointer;font:inherit;padding:4px 0;text-decoration:underline}
.primary{background:var(--pine);color:#fff;border:0;border-radius:8px;padding:10px 18px;font-family:inherit;font-weight:600;font-size:14px;cursor:pointer}
.primary:disabled{opacity:.5}
.login{max-width:360px;margin:60px auto;padding:0 16px}.login label{display:block;margin:16px 0 8px;font-size:13px;color:var(--soft)}
.login input{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:8px;font:inherit}
.err{color:var(--clay);font-size:13px;min-height:1em}.note{max-width:520px;margin:40px auto;padding:0 16px}
.app{display:grid;grid-template-columns:320px 1fr;height:calc(100vh - 55px);height:calc(100dvh - 55px)}
header{height:55px;flex:none}
.err:empty{display:none}.thread .err{margin:0 16px 10px}
.list{border-right:1px solid var(--line);overflow-y:auto;background:var(--card)}
.row{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:12px 14px;cursor:pointer;font:inherit;color:inherit}
.row.on{background:#ece5d6}.rtop{display:flex;justify-content:space-between;gap:8px}
.rname{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rtime{font-size:12px;color:var(--soft);white-space:nowrap}
.rprev{font-size:13px;color:var(--soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.badge{background:var(--clay);color:#fff;border-radius:10px;padding:0 7px;font-size:12px;margin-left:6px}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#4a9a6e;margin-right:6px;vertical-align:middle}
.empty{padding:24px;color:var(--soft)}
.thread{display:flex;flex-direction:column;min-width:0}.thead{display:flex;gap:14px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--card)}
.thead #back{display:none}.tname{font-weight:600}.tphone{font-size:12px;color:var(--soft)}
.msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
.m{max-width:78%;padding:8px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}
.m.in{align-self:flex-start;background:var(--card);border:1px solid var(--line)}
.m.out{align-self:flex-end;background:#dcebe3}.meta{display:block;font-size:11px;color:var(--soft);margin-top:4px}
.m.failed{border:1px solid var(--clay)}
.closed{margin:0 16px;padding:10px 12px;background:#f3e3d6;border-radius:8px;font-size:13px}
.reply{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--line);background:var(--card)}
.reply textarea{flex:1;padding:10px;border:1px solid var(--line);border-radius:8px;font:inherit;resize:vertical}
.pick{display:flex;align-items:center;justify-content:center;color:var(--soft)}.app.open .pick{display:none}
.hidden{display:none!important}
@media (max-width:700px){.app{grid-template-columns:1fr}.pick{display:none}.app.open .list{display:none}.app:not(.open) .thread{display:none!important}
 .thead #back{display:inline}}
"""

_JS = r"""
const $=s=>document.querySelector(s);let cur=null,timer=null;
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const when=s=>{if(!s)return'';const d=new Date(s),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString([], {day:'numeric',month:'short'})+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})};
async function api(p,o={}){const r=await fetch('/support-inbox/api'+p,{credentials:'same-origin',...o,headers:{'Content-Type':'application/json','X-Meyy-Inbox':'1',...(o.headers||{})}});
 if(r.status===401){location.reload();throw 0}const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.detail||('Error '+r.status));return j}
async function loadList(){const j=await api('/threads');const L=$('#list');L.querySelectorAll('.row').forEach(e=>e.remove());
 $('#listEmpty').classList.toggle('hidden',j.threads.length>0);
 for(const t of j.threads){const b=document.createElement('button');b.className='row'+(t.number===cur?' on':'');
  b.innerHTML=`<div class="rtop"><span class="rname">${t.window_open?'<span class="dot" title="Reply window open"></span>':''}${esc(t.name||('+91 '+t.number))}${t.unread?`<span class="badge">${t.unread}</span>`:''}</span><span class="rtime">${when(t.last_activity_at)}</span></div><div class="rprev">${t.preview_dir==='out'?'You: ':''}${esc(t.preview)}</div>`;
  b.onclick=()=>openThread(t.number);L.appendChild(b)}}
async function openThread(n){cur=n;location.hash=n;$('.app').classList.add('open');$('#thread').classList.remove('hidden');$('#err').textContent='';await refresh(true);loadList()}
async function refresh(scroll){if(!cur)return;const t=await api('/thread/'+encodeURIComponent(cur));
 $('#tname').textContent=t.name||t.phone;$('#tphone').textContent=t.name?t.phone:'';
 const M=$('#msgs'),atBottom=M.scrollHeight-M.scrollTop-M.clientHeight<60;
 M.innerHTML=t.messages.map(m=>`<div class="m ${m.dir} ${m.status==='failed'?'failed':''}">${esc(m.text)}<span class="meta">${when(m.at)}${m.dir==='out'?' · '+esc(m.by==='auto-greeting'?'automatic greeting':m.by==='system'?'automatic':'you')+(m.status?' · '+esc(m.status):''):''}${m.error?' — '+esc(m.error):''}</span></div>`).join('');
 if(scroll||atBottom)M.scrollTop=M.scrollHeight;
 $('#closed').classList.toggle('hidden',t.window_open);$('#reopen').classList.toggle('hidden',!t.reopen_template);
 $('#replyText').disabled=!t.window_open;$('#send').disabled=!t.window_open}
$('#replyForm').onsubmit=async e=>{e.preventDefault();const v=$('#replyText').value.trim();if(!v)return;$('#send').disabled=true;$('#err').textContent='';
 try{await api('/thread/'+encodeURIComponent(cur)+'/reply',{method:'POST',body:JSON.stringify({text:v})});$('#replyText').value='';await refresh(true);loadList()}
 catch(x){$('#err').textContent=x.message||'Could not send.';$('#send').disabled=false}};
$('#reopen').onclick=async()=>{if(!confirm('Send the re-open template to this customer?'))return;
 try{await api('/thread/'+encodeURIComponent(cur)+'/reopen',{method:'POST'});await refresh(true)}catch(x){$('#err').textContent=x.message}};
$('#back').onclick=()=>{cur=null;history.replaceState(null,'',location.pathname);$('.app').classList.remove('open');loadList()};
loadList().then(()=>{const h=location.hash.slice(1);if(h)openThread(h)});
timer=setInterval(()=>{loadList();refresh(false)},15000);
"""
