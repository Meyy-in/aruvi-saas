"""The WhatsApp support inbox — one conversation per customer number (2026-09-30).

Meyy's WhatsApp number is served by the Cloud API, so customer messages arrive at the server
(the webhook) rather than on a phone. They are kept here, one thread per customer, over the
document backend (file tree in dev, the Postgres `documents` table in production):

    whatsapp_chats/{n}/{n}/thread.json

`{n}` is the customer's number as Meyy keys accounts — the 10-digit national number for +91,
the full digits otherwise — so a thread sits at the SAME {tenant}/{user} as her account and
the erase traversal reaches it by folder boundary (data_rights_service_file.py). A thread for
a number that has no Meyy account is simply a thread nobody's account owns.

A message is a small dict: {id, dir: "in"|"out", type, text, at, status, by}. Statuses
(sent → delivered → read, or failed) are applied by id as Meta reports them. The thread keeps
the two times the inbox's rules hang on: `last_inbound_at` (WhatsApp's 24-hour reply window
opens on her last message) and `unread`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from aruvi_core.adapters.document_backend import as_backend, slug as _slug

_MAX_MESSAGES = 2000          # a thread is a support conversation, not an archive


def number_key(wa_id: str) -> str:
    """"919876543210" / "+91 98765 43210" / "9876543210" → "9876543210"."""
    d = "".join(c for c in str(wa_id or "") if c.isdigit())
    if len(d) == 12 and d.startswith("91"):
        return d[2:]
    return d


def e164(n: str) -> str:
    d = "".join(c for c in str(n or "") if c.isdigit())
    return ("91" + d) if len(d) == 10 else d


_AUTO = ("auto-greeting", "auto-ack", "system")


def _last_human_dir(msgs: List[Dict[str, Any]]) -> str:
    for m in reversed(msgs):
        if m.get("dir") == "out" and m.get("by") in _AUTO:
            continue
        return m.get("dir", "")
    return ""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WhatsAppInboxFileImpl:
    def __init__(self, data_dir):
        self.backend = as_backend(data_dir)

    def _key(self, n: str) -> str:
        s = _slug(number_key(n))
        return f"whatsapp_chats/{s}/{s}/thread.json"

    def load(self, n: str) -> Optional[Dict[str, Any]]:
        raw = self.backend.get_json(self._key(n))
        return raw if isinstance(raw, dict) else None

    def _blank(self, n: str) -> Dict[str, Any]:
        return {"number": number_key(n), "name": "", "messages": [], "unread": 0,
                "last_inbound_at": "", "last_activity_at": "", "greeted_at": "",
                "last_alert_at": ""}

    def has_message(self, n: str, message_id: str) -> bool:
        t = self.load(n)
        return bool(t and message_id and any(m.get("id") == message_id for m in t.get("messages", [])))

    def next_reference(self, prefix: str = "MEY-W", start: int = 1) -> str:
        """Next in the WhatsApp report series ("MEY-W-12"), gapless, under the backend lock.
        The counter is the SELLER'S and lives outside every customer's folder, beside the email
        series (support/_series/), so an erasure can never hand a used number out again."""
        key = "support/_series/whatsapp.json"
        with self.backend.lock(key):
            raw = self.backend.get_json(key)
            try:
                k = int((raw or {}).get("last", 0)) if isinstance(raw, dict) else 0
            except (TypeError, ValueError):
                k = 0
            k = max(k + 1, int(start))
            self.backend.put_json(key, {"last": k})
        return f"{prefix}-{k}"

    def append(self, n: str, msg: Dict[str, Any], name: str = "") -> Dict[str, Any]:
        """Add one message; returns the thread AS IT WAS BEFORE (so the caller can decide
        on a greeting or an alert from the prior state)."""
        key = self._key(n)
        with self.backend.lock(key):
            t = self.load(n) or self._blank(n)
            before = dict(t)
            msg = {"at": _now(), "status": "", **msg}
            # Meta re-delivers a webhook it thinks we missed — a message id seen before is
            # not a second message.
            if msg.get("id") and any(m.get("id") == msg["id"] for m in t["messages"]):
                return before
            t["messages"] = (t["messages"] + [msg])[-_MAX_MESSAGES:]
            t["last_activity_at"] = msg["at"]
            if msg.get("dir") == "in":
                t["last_inbound_at"] = msg["at"]
                t["unread"] = int(t.get("unread") or 0) + 1
            if name:
                t["name"] = name
            self.backend.put_json(key, t)
            return before

    def patch(self, n: str, **fields) -> None:
        key = self._key(n)
        with self.backend.lock(key):
            t = self.load(n)
            if t is None:
                return
            t.update(fields)
            self.backend.put_json(key, t)

    def update(self, n: str, fn) -> None:
        """Change a thread in place under its lock — `fn(thread)` mutates it (merge / split)."""
        key = self._key(n)
        with self.backend.lock(key):
            t = self.load(n)
            if t is None:
                return
            fn(t)
            self.backend.put_json(key, t)

    def patch_issue(self, n: str, ref: str, **fields) -> None:
        """Set the founder's own state (status, draft, category) on ONE issue of the chat — a
        lesson report MEY-W-n — kept under thread["issues"][ref]. ref "" is the general chat,
        whose state stays on the thread itself (as before issues existed)."""
        if not ref:
            self.patch(n, **fields)
            return
        key = self._key(n)
        with self.backend.lock(key):
            t = self.load(n)
            if t is None:
                return
            issues = dict(t.get("issues") or {})
            issues[ref] = {**(issues.get(ref) or {}), **fields}
            t["issues"] = issues
            self.backend.put_json(key, t)

    def set_status(self, n: str, message_id: str, status: str, error: str = "") -> bool:
        """Apply a delivery status. Never moves BACKWARDS (a late 'delivered' after 'read'
        is ignored) — Meta does not promise ordering."""
        rank = {"": 0, "accepted": 1, "sent": 2, "delivered": 3, "read": 4, "failed": 5}
        key = self._key(n)
        with self.backend.lock(key):
            t = self.load(n)
            if t is None:
                return False
            for m in t["messages"]:
                if m.get("id") == message_id:
                    if rank.get(status, 0) >= rank.get(m.get("status", ""), 0):
                        m["status"] = status
                        if error:
                            m["error"] = error
                    self.backend.put_json(key, t)
                    return True
        return False

    def mark_read(self, n: str) -> None:
        self.patch(n, unread=0)

    def list_threads(self) -> List[Dict[str, Any]]:
        """Summaries, most recent activity first."""
        out = []
        for key in self.backend.list_keys("whatsapp_chats"):
            if not key.endswith("/thread.json"):
                continue
            t = self.backend.get_json(key)
            if not isinstance(t, dict):
                continue
            last = (t.get("messages") or [{}])[-1]
            out.append({"number": t.get("number", ""), "name": t.get("name", ""),
                        "unread": int(t.get("unread") or 0),
                        "last_inbound_at": t.get("last_inbound_at", ""),
                        "last_inbound_pn": t.get("last_inbound_pn", ""),
                        "last_activity_at": t.get("last_activity_at", ""),
                        "preview": (last.get("text") or "")[:120],
                        "preview_dir": last.get("dir", ""),
                        # The integrated inbox (2026-10-03): the founder's own labels.
                        "category": t.get("category", ""),
                        "status": t.get("status", "open"),
                        "has_draft": bool((t.get("draft") or {}).get("text")),
                        "last_ref": t.get("last_ref", ""),
                        # Who spoke last, IGNORING the automatic greeting / report acknowledgement:
                        # an automatic message is not an answer, so it must not take her off
                        # "Needs reply".
                        "needs_reply": _last_human_dir(t.get("messages") or []) == "in"})
        out.sort(key=lambda s: s.get("last_activity_at") or "", reverse=True)
        return out

    def delete(self, n: str) -> bool:
        s = _slug(number_key(n))
        return self.backend.delete_prefix(f"whatsapp_chats/{s}/{s}")
