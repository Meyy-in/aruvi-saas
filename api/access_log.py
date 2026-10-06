"""Meyy's own access log — kept ONE YEAR, and unable to say whose request it was (2026-10-06).

Privacy Notice v0.5 §2 and §7 promise two things about "technical records", and this module is
what makes both true:

  * KEPT ONE YEAR, THEN DELETED. The DPDP Rules, 2025 (rule 6) require every data fiduciary to
    keep logs of its processing for a year. A host's own log stream keeps days, not a year, so
    the API writes its own: one file per UTC day under ACCESS_LOG_DIR (on Render, the persistent
    disk), and files older than ACCESS_LOG_DAYS are deleted — at startup and on the first request
    of each new day.
  * NOT LINKED TO YOUR ACCOUNT. A line holds the time, the client's IP address, the method, the
    ROUTE PATTERN that answered (`/support-inbox/api/thread/{ident}`, never the concrete path),
    the status and the duration. No query string, no header, no body, no user id, no token. A
    request no route answered (a 404 — scanners, typos) keeps its path for abuse-spotting, with
    any run of 6+ digits masked, because a mistyped URL can still carry a number.

uvicorn's own access log is switched OFF where Meyy is deployed (deploy/entrypoint.sh,
`--no-access-log`) — it prints concrete paths with their query strings, which is exactly what
this module exists not to keep.

The ROUTE PATTERN is the design decision. Scrubbing concrete paths is a blacklist that has to
know every place an identifier can appear (it failed once already: `?id=<mobile>`); the
pattern is a whitelist — it can only ever contain text written in the source code.
"""
from __future__ import annotations

import os
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from starlette.routing import Match

_DIGITS = re.compile(r"\d{6,}")
_FILE = re.compile(r"^access-(\d{4}-\d{2}-\d{2})\.log$")


def _client_ip(scope) -> str:
    # Behind Render's proxy the socket peer is the proxy; uvicorn's --proxy-headers already
    # rewrites `client` from X-Forwarded-For, so scope["client"] is the real address there.
    # Read the header only as a fallback (dev, or a server started without the flag).
    for k, v in scope.get("headers") or []:
        if k == b"x-forwarded-for":
            return v.decode("latin-1").split(",")[0].strip()[:64]
    c = scope.get("client")
    return (c[0] if c else "-")[:64]


class AccessLog:
    """ASGI middleware. Never raises into the request: a log that cannot be written is a lost
    line, never a failed request."""

    def __init__(self, app, log_dir: str, keep_days: int = 365, enabled: bool = True):
        self.app = app
        self.dir = Path(log_dir)
        self.keep_days = max(int(keep_days), 1)
        self.enabled = enabled
        self._lock = threading.Lock()
        self._purged_for: Optional[str] = None
        if self.enabled:
            try:
                self.dir.mkdir(parents=True, exist_ok=True)
            except Exception:                    # noqa: BLE001
                self.enabled = False
                print(f"[aruvi] access log: cannot create {self.dir} — not logging")

    # ── what one line says ─────────────────────────────────────────────────────────────────
    def _route_pattern(self, scope) -> str:
        router = getattr(scope.get("app"), "router", None)
        partial = None
        for route in getattr(router, "routes", []) or []:
            try:
                match, _ = route.matches(scope)
            except Exception:                    # noqa: BLE001
                continue
            pattern = getattr(route, "path", None) or getattr(route, "path_format", "") or "?"
            if match == Match.FULL:
                return pattern
            if match == Match.PARTIAL and partial is None:
                partial = pattern               # the path matched, the METHOD did not — a CORS
                                                # preflight (OPTIONS) above all; still a pattern
        if partial is not None:
            return partial
        # No route answered: keep the path (abuse-spotting) with long digit runs masked and
        # the query string dropped — scope["path"] never includes it.
        return "!" + _DIGITS.sub("#", scope.get("path") or "")[:200]

    def _write(self, line: str, day: str) -> None:
        with self._lock:
            if self._purged_for != day:
                self.purge(today=day)
                self._purged_for = day
            with open(self.dir / f"access-{day}.log", "a", encoding="utf-8") as f:
                f.write(line)

    def purge(self, today: Optional[str] = None) -> int:
        """Delete day files older than keep_days. Returns how many went."""
        now = (datetime.strptime(today, "%Y-%m-%d").replace(tzinfo=timezone.utc)
               if today else datetime.now(timezone.utc))
        cutoff = (now - timedelta(days=self.keep_days)).strftime("%Y-%m-%d")
        gone = 0
        try:
            for p in self.dir.iterdir():
                m = _FILE.match(p.name)
                if m and m.group(1) < cutoff:
                    try:
                        p.unlink()
                        gone += 1
                    except Exception:            # noqa: BLE001
                        pass
        except Exception:                        # noqa: BLE001
            pass
        return gone

    # ── ASGI ───────────────────────────────────────────────────────────────────────────────
    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or not self.enabled:
            await self.app(scope, receive, send)
            return
        started = time.monotonic()
        status = {"code": 500}

        async def _send(message):
            if message.get("type") == "http.response.start":
                status["code"] = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, _send)
        finally:
            try:
                now = datetime.now(timezone.utc)
                ms = int((time.monotonic() - started) * 1000)
                line = "\t".join([
                    now.strftime("%Y-%m-%dT%H:%M:%SZ"), _client_ip(scope),
                    scope.get("method", "-"), self._route_pattern(scope),
                    str(status["code"]), f"{ms}ms"]) + "\n"
                self._write(line, now.strftime("%Y-%m-%d"))
            except Exception:                    # noqa: BLE001
                pass

