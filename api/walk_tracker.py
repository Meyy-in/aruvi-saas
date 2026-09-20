"""The three-surface WALK register — docs/walk_tracker.html.

The full walk before Step 9 (TestFlight / Play): every teacher-visible feature is walked
on the WEB, on the iPHONE and on ANDROID (emulator during the walk, a real device at the
end), ticked off per surface, and every fix the walk forces is recorded as an AMENDMENT.
Same design as testing_campaign.py, and for the same reasons: state lives INSIDE Aruvi
(LOCAL-only, under TESTING_DIR = data/testing/, outside the data/cloud/ migration unit) so
it survives restarts and both actors — the founder on the page, Claude on the file — see
one register.

Schema-light on purpose: the PAGE owns the feature list; this store holds only what was
recorded against it.

    items:       feature id → surface → {status, comment, by, at, build}
    amendments:  [{id "WALK-A-001", feature, found_on[], applies_to, title, what, fix,
                   files, commit, native_rebuild, status, recheck[], opened, closed}]
    gate:        release-switch check id → {status, comment, by, at}

Surfaces: web · ios · and_emu · and_real.
Campaign tooling only — no teacher surface, no tenancy, no LLM.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from .config import TESTING_DIR

router = APIRouter(prefix="/api/testing/walk", tags=["testing-walk"])

_LOCK = threading.Lock()
SURFACES = ("web", "ios", "and_emu", "and_real")
_SCOPES = ("items", "gate")
_AMEND_STATUS = ("open", "fixing", "fixed-awaiting-rewalk", "closed", "accepted")


def _state_path() -> str:
    return os.path.join(TESTING_DIR, "walk_state.json")


def _default_state() -> Dict[str, Any]:
    return {"version": 1, "walk": "meyy-three-surface-walk", "updated_at": None,
            "items": {}, "gate": {}, "amendments": []}


def _load() -> Dict[str, Any]:
    p = _state_path()
    if not os.path.isfile(p):
        return _default_state()
    try:
        with open(p, encoding="utf-8") as f:
            state = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Walk state unreadable: {e}")
    base = _default_state()
    base.update(state if isinstance(state, dict) else {})
    return base


def _save(state: Dict[str, Any]) -> None:
    """Atomic write (tmp + rename); in-place fallback for mounts that refuse the sidecar."""
    state["updated_at"] = datetime.now().isoformat(timespec="seconds")
    p = _state_path()
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        os.replace(tmp, p)
    except OSError:
        with open(p, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)


@router.get("")
def get_walk() -> Dict[str, Any]:
    with _LOCK:
        return _load()


class FullState(BaseModel):
    state: Dict[str, Any]


@router.put("")
def put_walk(req: FullState) -> Dict[str, Any]:
    """Full replace — the page's 'restore from export' path only."""
    with _LOCK:
        base = _default_state()
        base.update(req.state or {})
        _save(base)
        return {"status": "saved", "updated_at": base["updated_at"]}


class ItemPatch(BaseModel):
    """One observation: scope 'items' → key = feature id, step = surface;
    scope 'gate' → key = check id, step = 'check'. A null field deletes it."""
    scope: str = "items"
    key: str
    step: str
    patch: Dict[str, Any] = {}


@router.post("/item")
def post_item(req: ItemPatch) -> Dict[str, Any]:
    if req.scope not in _SCOPES:
        raise HTTPException(status_code=400, detail=f"Unknown scope: {req.scope}")
    if not req.key or not req.step:
        raise HTTPException(status_code=400, detail="key and step are required.")
    if req.scope == "items" and req.step not in SURFACES:
        raise HTTPException(status_code=400, detail=f"Unknown surface: {req.step}")
    with _LOCK:
        state = _load()
        item = state[req.scope].setdefault(req.key, {}).setdefault(req.step, {})
        for k, v in (req.patch or {}).items():
            if v is None:
                item.pop(k, None)
            else:
                item[k] = v
        item["at"] = datetime.now().isoformat(timespec="seconds")
        _save(state)
        return {"status": "saved", "item": item, "updated_at": state["updated_at"]}


class AmendmentUpsert(BaseModel):
    """Upsert one amendment by id; omit id to open a new WALK-A-NNN."""
    id: Optional[str] = None
    feature: str = ""                 # feature id, e.g. "05.07"
    found_on: List[str] = []          # surfaces where it was seen
    applies_to: str = "both"          # web | phone | both | shared | api
    title: str = ""
    what: str = ""                    # what was wrong
    fix: str = ""                     # what was changed
    files: str = ""
    commit: str = ""
    native_rebuild: bool = False      # the fix cannot ship as a JS reload
    status: str = "open"
    recheck: List[str] = []           # surfaces that must be re-walked after the fix
    owner: str = ""
    delete: bool = False


@router.post("/amendment")
def post_amendment(req: AmendmentUpsert) -> Dict[str, Any]:
    if req.status not in _AMEND_STATUS:
        raise HTTPException(status_code=400, detail=f"Unknown status: {req.status}")
    with _LOCK:
        state = _load()
        rows: List[Dict[str, Any]] = state.setdefault("amendments", [])
        now = datetime.now().isoformat(timespec="seconds")
        if req.delete:
            if not req.id:
                raise HTTPException(status_code=400, detail="delete needs an id.")
            state["amendments"] = [a for a in rows if a.get("id") != req.id]
            _save(state)
            return {"status": "deleted", "id": req.id}
        aid = req.id
        if not aid:
            n = 1 + max((int(str(a.get("id", "WALK-A-0")).rsplit("-", 1)[-1] or 0)
                         for a in rows if str(a.get("id", "")).startswith("WALK-A-")),
                        default=0)
            aid = f"WALK-A-{n:03d}"
        row = next((a for a in rows if a.get("id") == aid), None)
        if row is None:
            row = {"id": aid, "opened": now, "closed": None}
            rows.append(row)
        row.update({"feature": req.feature, "found_on": req.found_on,
                    "applies_to": req.applies_to, "title": req.title, "what": req.what,
                    "fix": req.fix, "files": req.files, "commit": req.commit,
                    "native_rebuild": req.native_rebuild, "status": req.status,
                    "recheck": req.recheck, "owner": req.owner, "at": now})
        done = req.status in ("closed", "accepted")
        row["closed"] = (row.get("closed") or now) if done else None
        _save(state)
        return {"status": "saved", "amendment": row, "updated_at": state["updated_at"]}


@router.get("/tracker")
def tracker_page() -> HTMLResponse:
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    p = os.path.join(repo_root, "docs", "walk_tracker.html")
    if not os.path.isfile(p):
        raise HTTPException(status_code=404, detail="docs/walk_tracker.html not found.")
    with open(p, encoding="utf-8") as f:
        return HTMLResponse(f.read())
