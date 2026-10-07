"""Razorpay adapter — web subscriptions (2026-10-07).

Teachers on the WEBSITE pay through Razorpay Subscriptions: one yearly plan (Rs 699 per
subject-stage, `ARUVI_RAZORPAY_PLAN_ID`), bought with `quantity` = how many subject-stages
are in her cart, renewed automatically each year by UPI AutoPay or card mandate. The app
stores (Apple / Google) are separate and never use this adapter.

    POST https://api.razorpay.com/v1/subscriptions        (Basic auth key_id:key_secret)

Two signatures, both HMAC-SHA256, hex:
  * checkout success  — hmac(key_secret, payment_id + "|" + subscription_id)
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


def verify_payment_signature(key_secret: str, payment_id: str, subscription_id: str,
                             signature: str) -> bool:
    if not (key_secret and payment_id and subscription_id and signature):
        return False
    want = _hmac_hex(key_secret, f"{payment_id}|{subscription_id}".encode())
    return hmac.compare_digest(want, str(signature))


def verify_webhook_signature(webhook_secret: str, raw: bytes, signature: str) -> bool:
    if not (webhook_secret and signature):
        return False
    return hmac.compare_digest(_hmac_hex(webhook_secret, raw or b""), str(signature))


class RazorpayGateway:
    def __init__(self, key_id: str, key_secret: str, timeout: float = 15.0):
        self.key_id, self.key_secret, self.timeout = key_id, key_secret, timeout

    def create_subscription(self, plan_id: str, quantity: int, total_count: int,
                            notes: Dict[str, str]) -> Dict[str, Any]:
        """→ {"status": "created", "id": "sub_…"} or {"status": "error", ...}."""
        body = {"plan_id": plan_id, "quantity": max(1, int(quantity)),
                "total_count": max(1, int(total_count)), "customer_notify": 1,
                # Razorpay notes: at most 15 keys, string values of at most 256 characters.
                "notes": {str(k)[:40]: str(v)[:255] for k, v in list((notes or {}).items())[:15]}}
        try:
            r = httpx.post(f"{API}/subscriptions", json=body, timeout=self.timeout,
                           auth=(self.key_id, self.key_secret))
            data: Dict[str, Any] = {}
            try:
                data = r.json()
            except Exception:                                   # noqa: BLE001
                pass
            if r.status_code // 100 == 2 and data.get("id"):
                return {"status": "created", "id": data["id"], "short_url": data.get("short_url", "")}
            err = data.get("error") or {}
            return {"status": "error", "http": r.status_code,
                    "error": err.get("description") or r.text[:300]}
        except Exception as e:                                  # noqa: BLE001
            return {"status": "error", "error": str(e)}
