"""Razorpay adapter — web payments (2026-10-07).

★ PAY ONCE FOR A YEAR (founder, 2026-10-07, after the first test): no subscription, no
mandate, no auto-debit. Each purchase is one Razorpay ORDER for (subject-stages x Rs 699),
paid by any UPI app, card or netbanking; a year of access per subject-stage. She renews by
buying again (allowed in the last RENEW_WINDOW_DAYS before a subject ends, extending from
its end). Auto-renew (Razorpay Subscriptions) was built first and dropped: the checkout
showed only cards/e-mandate, and a mandate is a hard ask of a teacher who wants to try.
The app stores (Apple / Google) are separate and never use this adapter.

    POST https://api.razorpay.com/v1/orders        (Basic auth key_id:key_secret)

Two signatures, both HMAC-SHA256, hex:
  * checkout success  — hmac(key_secret, order_id + "|" + payment_id)
  * webhook           — hmac(webhook_secret, raw request body), header X-Razorpay-Signature

Credentials come from the environment only (api/config.py). Never raises.
"""
from __future__ import annotations

import hashlib
import hmac
from typing import Any, Dict

import httpx

API = "https://api.razorpay.com/v1"


def _hmac_hex(secret: str, msg: bytes) -> str:
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def verify_payment_signature(key_secret: str, order_id: str, payment_id: str,
                             signature: str) -> bool:
    if not (key_secret and order_id and payment_id and signature):
        return False
    want = _hmac_hex(key_secret, f"{order_id}|{payment_id}".encode())
    return hmac.compare_digest(want, str(signature))


def verify_webhook_signature(webhook_secret: str, raw: bytes, signature: str) -> bool:
    if not (webhook_secret and signature):
        return False
    return hmac.compare_digest(_hmac_hex(webhook_secret, raw or b""), str(signature))


class RazorpayGateway:
    def __init__(self, key_id: str, key_secret: str, timeout: float = 15.0):
        self.key_id, self.key_secret, self.timeout = key_id, key_secret, timeout

    def create_order(self, amount_inr: int, receipt: str,
                     notes: Dict[str, str]) -> Dict[str, Any]:
        """→ {"status": "created", "id": "order_…", "amount": paise} or {"status": "error"}."""
        body = {"amount": int(amount_inr) * 100, "currency": "INR",
                "receipt": str(receipt)[:40],
                # Razorpay notes: at most 15 keys, string values of at most 256 characters.
                "notes": {str(k)[:40]: str(v)[:255] for k, v in list((notes or {}).items())[:15]}}
        try:
            r = httpx.post(f"{API}/orders", json=body, timeout=self.timeout,
                           auth=(self.key_id, self.key_secret))
            data: Dict[str, Any] = {}
            try:
                data = r.json()
            except Exception:                                   # noqa: BLE001
                pass
            if r.status_code // 100 == 2 and data.get("id"):
                return {"status": "created", "id": data["id"], "amount": data.get("amount")}
            err = data.get("error") or {}
            return {"status": "error", "http": r.status_code,
                    "error": err.get("description") or r.text[:300]}
        except Exception as e:                                  # noqa: BLE001
            return {"status": "error", "error": str(e)}
