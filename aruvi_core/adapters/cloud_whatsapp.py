"""WhatsApp Cloud API adapter — real sends through Meta (2026-09-26).

POST https://graph.facebook.com/{version}/{phone_number_id}/messages with a template
payload. Credentials come from the environment only (api/config.py), never the repo:

    ARUVI_WA_TOKEN            a SYSTEM-USER access token (permanent), not the 24h test token
    ARUVI_WA_PHONE_NUMBER_ID  the Cloud API id of the Meyy number (NOT the number itself)
    ARUVI_WA_API_VERSION      Graph version, e.g. v25.0

Business-initiated messages must be APPROVED TEMPLATES; free text is legal only inside the
24-hour window the teacher opens by writing to us, which is why this adapter sends
templates and nothing else. Never raises — a subscription must not fail on Meta.
"""
from __future__ import annotations

from typing import Any, Dict

import httpx

from aruvi_core.ports import WhatsAppClient, WhatsAppTemplate


class CloudWhatsApp(WhatsAppClient):
    def __init__(self, token: str, phone_number_id: str, api_version: str = "v25.0",
                 timeout: float = 10.0):
        self.token = token
        self.url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
        self.timeout = timeout

    @staticmethod
    def payload(msg: WhatsAppTemplate, to: str) -> Dict[str, Any]:
        """The Cloud API body. Split out so a test can pin its shape without a network."""
        components = []
        if msg.document and msg.document.get("link"):
            components.append({"type": "header", "parameters": [{
                "type": "document",
                "document": {"link": msg.document["link"],
                             "filename": msg.document.get("filename", "document.pdf")}}]})
        if msg.params:
            components.append({"type": "body", "parameters": [
                {"type": "text", "text": str(p)} for p in msg.params]})
        tpl: Dict[str, Any] = {"name": msg.template, "language": {"code": msg.language}}
        if components:
            tpl["components"] = components
        return {"messaging_product": "whatsapp", "recipient_type": "individual",
                "to": to, "type": "template", "template": tpl}

    def send_template(self, msg: WhatsAppTemplate) -> Dict[str, Any]:
        to = "".join(ch for ch in str(msg.to or "") if ch.isdigit())
        if not to:
            return {"status": "skipped", "reason": "no recipient number"}
        try:
            r = httpx.post(self.url, json=self.payload(msg, to), timeout=self.timeout,
                           headers={"Authorization": f"Bearer {self.token}"})
            body = {}
            try:
                body = r.json()
            except Exception:                                   # noqa: BLE001
                pass
            if r.status_code // 100 == 2:
                mid = ((body.get("messages") or [{}])[0] or {}).get("id", "")
                return {"status": "sent", "message_id": mid}
            err = (body.get("error") or {})
            return {"status": "error", "http": r.status_code,
                    "error": err.get("message") or r.text[:300], "code": err.get("code")}
        except Exception as e:                                  # noqa: BLE001
            return {"status": "error", "error": str(e)}
