#!/usr/bin/env python3
"""Put ONE teacher's teaching profile back from a nightly snapshot — a walk/testing aid.

    python3 aruvi-scripts/restore_profile_from_backup.py 9000000013            # latest snapshot
    python3 aruvi-scripts/restore_profile_from_backup.py 9000000013 2026-09-25 # a given day
    python3 aruvi-scripts/restore_profile_from_backup.py 9000000013 --dry-run

Copies `readiness/<tenant>/<tenant>/profile.json` — and nothing else — from
`backups/state/<date>/` into the live store (Postgres via ARUVI_DATABASE_URL). Written for
THE WALK (2026-09-27): a trial account whose last class was removed cannot add its subject back
from the app, so re-walking the row needs the profile put back. Lessons, entitlements and
section state are untouched. Loads .env itself.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

_envfile = REPO / ".env"
if _envfile.is_file():
    for _line in _envfile.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip().strip("'\""))

from aruvi_core.adapters.document_backend import PostgresBackend  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("tenant")
    ap.add_argument("date", nargs="?", default="")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    snaps = REPO / "backups" / "state"
    date = a.date or (snaps / "LATEST.txt").read_text().split()[0]
    src = snaps / date / "readiness" / a.tenant / a.tenant / "profile.json"
    if not src.is_file():
        print(f"No profile for {a.tenant} in the {date} snapshot ({src}).", file=sys.stderr)
        return 1
    doc = json.loads(src.read_text())
    key = f"readiness/{a.tenant}/{a.tenant}/profile.json"
    summary = [(s.get("name"), [g.get("grade") for g in s.get("grades", [])]) for s in doc.get("subjects", [])]
    url = os.environ.get("ARUVI_DATABASE_URL")
    if not url:
        print("ARUVI_DATABASE_URL is not set (.env).", file=sys.stderr)
        return 1
    be = PostgresBackend(url, ensure_schema=False)
    print(f"{key}\n  now:      {[(s.get('name'), [g.get('grade') for g in s.get('grades', [])]) for s in ((be.get_json(key) or {}).get('subjects') or [])]}\n  snapshot: {summary}  ({date})")
    if a.dry_run:
        print("Dry run — nothing written.")
        return 0
    be.put_json(key, doc)
    print("Restored.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
