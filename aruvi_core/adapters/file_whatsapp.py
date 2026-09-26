"""File-based WhatsApp adapter — the dev/preview transport (2026-09-26).

The WhatsApp twin of FileNotifier: each template send is written to
ARUVI_STATE_DIR/whatsapp_outbox/{timestamp}-{to}.json instead of calling Meta, so the
whole subscribe → welcome flow runs with no Meta account and no credentials, and the
founder can read exactly what would have gone out. Never raises.
"""
from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from aruvi_core.ports import WhatsAppClient, WhatsAppTemplate


class FileWhatsApp(WhatsAppClient):
    def __init__(self, data_dir: str):
        self.outbox_dir = Path(data_dir) / "whatsapp_outbox"

    def send_template(self, msg: WhatsAppTemplate) -> Dict[str, Any]:
        to = "".join(ch for ch in str(msg.to or "") if ch.isdigit())
        if not to:
            return {"status": "skipped", "reason": "no recipient number"}
        try:
            self.outbox_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
            path = self.outbox_dir / f"{stamp}-{to}.json"
            path.write_text(json.dumps({**asdict(msg), "to": to,
                                        "written_at": datetime.now(timezone.utc).isoformat()},
                                       indent=2), encoding="utf-8")
            return {"status": "written", "path": str(path)}
        except Exception as e:                                  # noqa: BLE001
            return {"status": "error", "error": str(e)}
