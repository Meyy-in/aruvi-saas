"""ManualBillingProvider — the founder IS the gateway (Step 5 reference impl).

Implements the BillingProvider port with no vendor: create_subscription writes an
active entitlement, cancel expires it, fetch_status reads it. Real behaviour — grant,
expire, revoke — exercised via aruvi-scripts/entitlement.py, so the subscription
machinery is testable end-to-end before any gateway exists. The partner's Razorpay /
Play Billing / Apple IAP adapters replace THIS CLASS behind the same port and populate
Entitlement.source with the real platform of purchase; nothing above the port changes.

verify_webhook raises: there is no webhook when the founder is the gateway, and a
silent success here would mask a mis-wired gateway integration later.
"""
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from aruvi_core.ports import BillingProvider, Entitlement, EntitlementRepository


class ManualBillingProvider(BillingProvider):
    """Founder-operated billing: entitlements written by hand, no gateway."""

    def __init__(self, entitlement_repo: EntitlementRepository):
        self.repo = entitlement_repo

    def create_subscription(self, tenant_id: str, plan_id: str,
                            scopes: Optional[List[str]] = None,
                            valid_until: str = "",
                            source: str = "manual",
                            replace: bool = False) -> Dict[str, Any]:
        """Grant an active subscription. `scopes` defaults to ["*"] (all
        subject-stages) — the founder narrows it for individual subject-stage grants.
        `valid_until` defaults to one year from today (the rolling annual, §2.5).

        ★ ADDITIVE BY DEFAULT (founder, 2026-08-26). This used to WRITE A WHOLE NEW
        entitlement, so a teacher who owned Social Sciences and then bought English was
        left holding English alone — she paid ₹500 and lost a subject. Scopes she
        already holds are kept, and each scope carries ITS OWN expiry (a subject added
        in November runs to the following November, not to the first purchase's
        anniversary). `replace=True` is the deliberate wipe, for the CLI only.

        A scope named here is (re)stamped with `until` — the caller decides whether that
        is allowed. The web chooser does not offer a scope that is still live, so in
        practice this restamps only an EXPIRED scope, which is a renewal.
        """
        until = valid_until or (date.today() + timedelta(days=365)).isoformat()
        asked = list(scopes) if scopes else ["*"]
        prior = None if replace else self.repo.load(tenant_id)
        # ★ WHAT THE TRIAL SPENT OUTLIVES THE TRIAL (founder, 2026-09-21, WALK-A-048). The free
        #   chapters belong to the NUMBER and are spent only by using them, so the count has to
        #   survive the purchase that supersedes the trial — otherwise a teacher who tried two
        #   chapters, subscribed, then later deleted her account came back to all three again,
        #   and the old rule papered over that by burning the whole quota of anyone who had ever
        #   paid. Inert while she is subscribed: every gate that reads this list first checks
        #   `status == "trial"`.
        carried_trial = list(prior.trial_chapters or []) if prior is not None else []
        # A trial is not a holding to preserve — the first purchase supersedes it whole
        # (its breadth is "*", which would otherwise swallow every later scope check).
        if prior is not None and prior.status == "trial":
            prior = None

        merged: List[str] = list(prior.scopes) if prior else []
        for s in asked:
            if s not in merged:
                merged.append(s)

        per_scope: Dict[str, str] = {}
        if prior:
            # Backfill: scopes granted before per-scope dates existed inherit the old
            # entitlement-level date, which is exactly what they meant at the time.
            for s in prior.scopes:
                inherited = (prior.scope_valid_until or {}).get(s) or prior.valid_until
                if inherited:
                    per_scope[s] = inherited
        for s in asked:
            # "*" is dated like any other scope. It was skipped in the first cut, and
            # an enterprise "*" granted on top of an old expired scope then inherited
            # THAT scope's past date through the derived top-level field — a grant that
            # was dead the moment it was written (caught by test_paid_scope_and_expiry).
            per_scope[s] = until

        ent = Entitlement(
            plan_id=plan_id, status="active",
            # The entitlement-level date is DERIVED: the latest any scope runs to. Old
            # readers see a sane single date; the gates read the per-scope map.
            valid_until=(max(per_scope.values()) if per_scope else until),
            source=source, scopes=merged,
            trial_chapters=carried_trial,
            scope_valid_until=per_scope,
        )
        self.repo.save(tenant_id, ent)
        return {"tenant_id": tenant_id, "plan_id": plan_id, "status": "active",
                "valid_until": ent.valid_until, "scopes": ent.scopes,
                "scope_valid_until": ent.scope_valid_until,
                # What this call actually granted, for the receipt and the mail.
                "granted": [s for s in asked]}

    def verify_webhook(self, payload: bytes, signature: str) -> Dict[str, Any]:
        raise NotImplementedError(
            "ManualBillingProvider has no webhooks — the founder is the gateway. "
            "A real gateway adapter implements this.")

    def cancel(self, tenant_id: str) -> Dict[str, Any]:
        """Expire the tenant's entitlement (revoke). No-op result if none exists.
        The record is kept, marked expired — an audit trace, not an erasure (erasure
        is Step 4's job and only ever the teacher's own action)."""
        ent = self.repo.load(tenant_id)
        if ent is None:
            return {"tenant_id": tenant_id, "status": "none"}
        ent.status = "expired"
        self.repo.save(tenant_id, ent)
        return {"tenant_id": tenant_id, "status": "expired"}

    def fetch_status(self, tenant_id: str) -> Dict[str, Any]:
        """Current entitlement state, as a plain dict for tooling/routes."""
        ent = self.repo.load(tenant_id)
        if ent is None:
            return {"tenant_id": tenant_id, "status": "none"}
        return {"tenant_id": tenant_id, "plan_id": ent.plan_id, "status": ent.status,
                "valid_until": ent.valid_until, "source": ent.source,
                "scopes": ent.scopes, "trial_chapters": ent.trial_chapters,
                "scope_valid_until": ent.scope_valid_until}
