"""The trial ledger — "this mobile number has already had its free trial" (2026-09-18).

★ WHY IT EXISTS (founder, 2026-09-18). Erasing an account forgets everything, including that
the number had used its 3 free chapters — so delete → sign up again → three more, for as long
as she kept doing it. This closes that loophole WITHOUT keeping her profile: one line per
number, holding only how many trial chapters it used.

★ THE NUMBER IS NEVER STORED — a KEYED hash of it is (HMAC-SHA256 with a server-held secret,
`ARUVI_TRIAL_LEDGER_KEY`). A plain hash would not do: there are only ~10^10 Indian mobile
numbers, so anyone holding the file could hash them all and read it back. With the key, the
store alone names nobody. ⚠️ It is still personal data in law — we hold the key and can test a
number against it — which is why it is DISCLOSED (Privacy Notice §7, User Agreement §C/§G,
`_KEPT` in the erasure receipt) and TIME-LIMITED: an entry is forgotten after
`retention_days` (default 730 = 24 months), after which the number may trial again.

What an entry holds: the keyed hash (as the key), chapters used, whether the trial was spent
by a purchase, when it was recorded and when it will be forgotten. No name, email, school,
profile, notes or content.

★ OUTSIDE THE ERASE WALK, by placement: `trial_ledger/{hash}.json` is two segments, so the
document backend files it with no tenant column — the `erasure_log/` and `consents/_ledger/`
precedent. Rotating the key orphans every entry (they simply stop matching); never rotate it
casually. Never raises: a ledger failure must not block an erasure or a sign-up.
"""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from aruvi_core.adapters.document_backend import as_backend


def _normalise(mobile: str) -> str:
    """Digits only, last ten — '+91 90000 00001', '919000000001' and '9000000001' are one
    number. A non-numeric id (dev accounts like 'Kumar1') is used as given, lower-cased."""
    s = str(mobile or "").strip()
    digits = "".join(ch for ch in s if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else s.lower()


class TrialLedgerFileImpl:
    def __init__(self, data_dir: Any, key: str, retention_days: int = 730):
        self.backend = as_backend(data_dir)
        self._secret = (key or "").encode("utf-8")
        self.retention_days = int(retention_days)

    def _hash(self, mobile: str) -> str:
        return hmac.new(self._secret, _normalise(mobile).encode("utf-8"),
                        hashlib.sha256).hexdigest()

    def _key(self, mobile: str) -> str:
        return f"trial_ledger/{self._hash(mobile)}.json"

    def note_erased(self, mobile: str, chapters_used: int, spent: bool = False) -> bool:
        """Record (or raise) what this number has used, at the moment its account is erased.
        Keeps the HIGHER of the old and new count — an entry never shrinks, or a second
        delete-and-return could hand back chapters the first one had already spent."""
        if not str(mobile or "").strip() or (chapters_used <= 0 and not spent):
            return False
        now = datetime.now(timezone.utc)
        try:
            key = self._key(mobile)
            with self.backend.lock(key):
                prior = self.backend.get_json(key) or {}
                self.backend.put_json(key, {
                    "chapters_used": max(int(chapters_used), int(prior.get("chapters_used") or 0)),
                    "spent": bool(spent or prior.get("spent")),
                    "recorded_at": now.isoformat(),
                    "forget_after": (now + timedelta(days=self.retention_days)).date().isoformat(),
                })
            return True
        except Exception:                                  # noqa: BLE001 — see docstring
            return False

    def lookup(self, mobile: str) -> Optional[Dict[str, Any]]:
        """What this number used, or None. An entry past `forget_after` is deleted on read
        and reported as None — the retention promise is kept even without a sweep job."""
        if not str(mobile or "").strip():
            return None
        try:
            key = self._key(mobile)
            raw = self.backend.get_json(key)
            if not raw:
                return None
            if str(raw.get("forget_after") or "") < datetime.now(timezone.utc).date().isoformat():
                self.backend.delete(key)
                return None
            return raw
        except Exception:                                  # noqa: BLE001
            return None
