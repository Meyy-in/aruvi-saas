"""MSG91 SMS adapter — sends the sign-in code (2026-10-07).

Supabase Auth issues, stores and checks the one-time code; this adapter only DELIVERS it.
It is called by the Send-SMS auth hook (`POST /auth/sms-hook` in api/main.py).

    POST https://control.msg91.com/api/v5/flow
    header  authkey: <ARUVI_MSG91_AUTHKEY>
    body    {"template_id": <MSG91 template id>, "short_url": "0",
             "recipients": [{"mobiles": "91XXXXXXXXXX", "otp": "123456"}]}

The MSG91 template (meyy_signin_otp_v2, MSG91 id 6ac52060a8bc430f4c03d7a2) is bound to the
Airtel DLT template 1077585560028067580, header MEYYIN, entity 1001173771984363043:
    "Your Meyy sign-in code is ##otp##. Never share it with anyone."
The variable is named `otp` — the recipient key below MUST match it, or the SMS goes out
with an empty gap where the code should be (seen on the founder's phone with Test DLT).

Credentials come from the environment only (api/config.py), never the repo. Never raises.
"""
from __future__ import annotations

from typing import Any, Dict

import httpx

FLOW_URL = "https://control.msg91.com/api/v5/flow"


def indian_mobile(phone: str) -> str:
    """Digits only, with the 91 country code. '' if it is not a 10-digit Indian mobile."""
    d = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if len(d) == 10:
        d = "91" + d
    return d if (len(d) == 12 and d.startswith("91")) else ""


class Msg91Sms:
    def __init__(self, authkey: str, template_id: str, timeout: float = 10.0):
        self.authkey = authkey
        self.template_id = template_id
        self.timeout = timeout

    def payload(self, mobile: str, otp: str) -> Dict[str, Any]:
        """The Flow API body. Split out so a test can pin its shape without a network."""
        return {"template_id": self.template_id, "short_url": "0",
                "recipients": [{"mobiles": mobile, "otp": str(otp)}]}

    def send_otp(self, phone: str, otp: str) -> Dict[str, Any]:
        mobile = indian_mobile(phone)
        if not mobile:
            return {"status": "error", "error": "not an Indian mobile number"}
        if not str(otp or "").strip():
            return {"status": "error", "error": "empty code"}
        try:
            r = httpx.post(FLOW_URL, json=self.payload(mobile, otp), timeout=self.timeout,
                           headers={"authkey": self.authkey, "accept": "application/json",
                                    "content-type": "application/json"})
            body: Dict[str, Any] = {}
            try:
                body = r.json()
            except Exception:                                   # noqa: BLE001
                pass
            # MSG91 can answer HTTP 200 with {"type":"error"} — trust `type`, not the status.
            if r.status_code // 100 == 2 and str(body.get("type", "")).lower() == "success":
                return {"status": "sent", "request_id": body.get("message", "")}
            return {"status": "error", "http": r.status_code,
                    "error": body.get("message") or r.text[:300]}
        except Exception as e:                                  # noqa: BLE001
            return {"status": "error", "error": str(e)}
