"""RevenueCat adapter — in-app purchases on the phone (2026-10-09).

★ SAME DEAL AS THE WEBSITE (founder, 2026-10-09): pay once for ONE YEAR per subject-stage,
no auto-renew, no mandate. On Apple each subject-stage is a NON-RENEWING SUBSCRIPTION, on
Google a one-time (consumable) product, so the same teacher can buy it again next year.
RevenueCat sits in front of both stores: the app buys through its SDK, RevenueCat
validates the receipt with Apple/Google and tells Meyy's server by WEBHOOK; the server
can also ASK RevenueCat what a teacher holds (the REST API), which is how "restore
purchases" and a missed webhook are both covered by one code path.

Product ids are derived from the server's scope string and nothing else, so no table can
drift:   scope "social_sciences/middle"  <->  product "meyy.social_sciences.middle"
(the LAST dot separates subject from stage; subjects themselves may carry underscores).

    GET https://api.revenuecat.com/v1/subscribers/{app_user_id}   (Bearer secret key)

Webhooks carry the Authorization header value typed into the RevenueCat dashboard; the
server compares it in constant time. Credentials come from api/config.py only. Never
raises on the network.
"""
from __future__ import annotations

import hmac
import re
from urllib.parse import quote
from typing import Any, Dict, List, Optional

import httpx

API = "https://api.revenuecat.com/v1"
PRODUCT_PREFIX = "meyy."
# RevenueCat event types that mean "money was taken for this product".
PAID_EVENTS = {"INITIAL_PURCHASE", "NON_RENEWING_PURCHASE", "RENEWAL", "PRODUCT_CHANGE"}


def product_for_scope(scope: str) -> str:
    """"science/middle" -> "meyy.science.middle"."""
    subject, _, stage = scope.strip().partition("/")
    return f"{PRODUCT_PREFIX}{subject}.{stage}"


def scope_for_product(product_id: str) -> Optional[str]:
    """"meyy.social_sciences.middle" -> "social_sciences/middle"; None if not ours.
    Google may suffix the base plan / offer after a colon — cut it."""
    pid = (product_id or "").split(":", 1)[0].strip()
    if not pid.startswith(PRODUCT_PREFIX):
        return None
    body = pid[len(PRODUCT_PREFIX):]
    subject, dot, stage = body.rpartition(".")
    if not (dot and subject and stage):
        return None
    if not re.fullmatch(r"[a-z_]+", subject) or not re.fullmatch(r"[a-z]+", stage):
        return None
    return f"{subject}/{stage}"


def webhook_authorized(expected: str, header: str) -> bool:
    """RevenueCat sends the dashboard's Authorization value verbatim; accept it bare or
    as "Bearer <value>"."""
    if not expected or not header:
        return False
    got = header.strip()
    if got.lower().startswith("bearer "):
        got = got[7:].strip()
    return hmac.compare_digest(expected, got)


def parse_webhook(body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """The one record a paid event boils down to, or None for anything else."""
    evt = (body or {}).get("event") or {}
    if evt.get("type") not in PAID_EVENTS:
        return None
    txn = str(evt.get("transaction_id") or evt.get("id") or "")
    if not txn:
        return None
    return {
        "transaction_id": txn,
        "product_id": str(evt.get("product_id") or ""),
        "app_user_id": str(evt.get("app_user_id") or evt.get("original_app_user_id") or ""),
        "aliases": [str(a) for a in (evt.get("aliases") or [])],
        "store": str(evt.get("store") or ""),
        "sandbox": str(evt.get("environment") or "").upper() == "SANDBOX",
        "type": evt.get("type"),
    }


class RevenueCatClient:
    """Asks RevenueCat what one app user has bought. Returns purchases in the same shape
    the webhook does, so the server activates them through one function."""

    def __init__(self, secret_key: str, timeout: float = 12.0):
        self.secret_key = secret_key
        self.timeout = timeout

    def purchases(self, app_user_id: str) -> Dict[str, Any]:
        if not (self.secret_key and app_user_id):
            return {"status": "off", "purchases": []}
        try:
            r = httpx.get(f"{API}/subscribers/{quote(app_user_id, safe='')}",
                          headers={"Authorization": f"Bearer {self.secret_key}",
                                   "Content-Type": "application/json"},
                          timeout=self.timeout)
        except Exception as e:                                   # noqa: BLE001
            return {"status": "error", "error": str(e), "purchases": []}
        if r.status_code != 200:
            return {"status": "error", "error": f"HTTP {r.status_code}: {r.text[:200]}",
                    "purchases": []}
        try:
            sub = (r.json() or {}).get("subscriber") or {}
        except Exception as e:                                   # noqa: BLE001
            return {"status": "error", "error": str(e), "purchases": []}
        out: List[Dict[str, Any]] = []
        # Non-renewing subscriptions (Apple) and consumables (Google) both land here.
        for pid, rows in (sub.get("non_subscriptions") or {}).items():
            for row in rows or []:
                out.append({"transaction_id": str(row.get("id") or ""), "product_id": pid,
                            "app_user_id": app_user_id, "aliases": [],
                            "store": str(row.get("store") or ""),
                            "sandbox": bool(row.get("is_sandbox")),
                            "type": "NON_RENEWING_PURCHASE"})
        # Defensive: should a store ever file one as a subscription, read that too.
        for pid, row in (sub.get("subscriptions") or {}).items():
            txn = str(row.get("original_transaction_id") or row.get("store_transaction_id")
                      or f"{pid}@{row.get('purchase_date', '')}")
            out.append({"transaction_id": txn, "product_id": pid,
                        "app_user_id": app_user_id, "aliases": [],
                        "store": str(row.get("store") or ""),
                        "sandbox": bool(row.get("is_sandbox")),
                        "type": "INITIAL_PURCHASE"})
        return {"status": "ok", "purchases": [p for p in out if p["transaction_id"]]}
