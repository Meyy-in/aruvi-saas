"""Founder entitlement CLI — grant, expire, revoke and inspect access with no gateway.

Administrative architecture Step 5's "done" test: the founder can operate subscriptions
by hand. Runs against the same adapters and the same state backend the API uses
(honours ARUVI_STATE_DIR, and ARUVI_STATE_BACKEND=postgres + ARUVI_DATABASE_URL).

Usage (from the repo root):
  python3 aruvi-scripts/entitlement.py status  <tenant>
  python3 aruvi-scripts/entitlement.py grant   <tenant> [--plan individual_annual]
          [--scopes social_sciences/middle,science/secondary | --scopes "*"]
          [--until YYYY-MM-DD] [--source manual]
  python3 aruvi-scripts/entitlement.py revoke  <tenant>          # expire now
  python3 aruvi-scripts/entitlement.py trial-reset <tenant>      # fresh 3-chapter trial

Scopes are "{subject}/{stage}" (stage: preparatory | middle | secondary); "*" = all.
`grant` with no --scopes grants "*". `trial-reset` is a testing aid for the persona
runs — it hands the tenant a brand-new trial as if she had never generated.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api import config  # noqa: E402
from aruvi_core.ports import Entitlement  # noqa: E402
from aruvi_core.adapters.entitlement_repository_file import EntitlementRepositoryFileImpl  # noqa: E402
from aruvi_core.adapters.manual_billing_provider import ManualBillingProvider  # noqa: E402
from aruvi_core.grades import stage_for  # noqa: E402
from api import data  # noqa: E402


def bad_scopes(scopes):
    """Scopes that name nothing Meyy offers, each with the reason — [] when all are good.

    ★ Added 2026-09-18 (hand-off item). `--scopes` used to be taken verbatim, so a typo
    ("scince/middle", "science/middel") was stored as a live subscription to nothing: the
    teacher's paid-scope filters then offered her no subject at all and she sat on first
    run's step 1 with no diagnosis. A scope is good when its stage is one of the three and
    the content actually has a class of that subject at that stage."""
    out = []
    for sc in scopes:
        if sc == "*":
            continue
        subject, sep, stage = sc.partition("/")
        if not sep or stage not in ("preparatory", "middle", "secondary"):
            out.append(f"{sc!r}: expected subject/stage, stage one of preparatory|middle|secondary")
            continue
        try:
            grades = data.list_grades(subject)
        except Exception:
            grades = []
        if not grades:
            out.append(f"{sc!r}: no subject {subject!r} in the content")
            continue
        stages = set()
        for g in grades:
            try:
                stages.add(stage_for(g))
            except Exception:
                pass
        if stage not in stages:
            out.append(f"{sc!r}: {subject} has no {stage} classes "
                       f"(it has: {', '.join(sorted(stages)) or 'none'})")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Founder entitlement operations (no gateway).")
    ap.add_argument("action", choices=["status", "grant", "revoke", "trial-reset"])
    ap.add_argument("tenant", help="tenant id (== user id for individual teachers)")
    ap.add_argument("--plan", default="individual_annual")
    ap.add_argument("--scopes", default="*",
                    help='comma-separated "{subject}/{stage}" entries, or "*"')
    ap.add_argument("--until", default="", help="ISO date; default = +365 days")
    ap.add_argument("--source", default="manual",
                    choices=["manual", "web", "ios", "android"])
    # grant is ADDITIVE by default (2026-08-26) — scopes she already holds keep their
    # own expiry, and each granted scope gets a year of its own. --replace is the
    # deliberate wipe, which is what grant silently did to every prior scope before.
    ap.add_argument("--replace", action="store_true",
                    help="discard scopes she already holds instead of adding to them")
    args = ap.parse_args()

    repo = EntitlementRepositoryFileImpl(config.state_backend())
    provider = ManualBillingProvider(repo)

    if args.action == "status":
        print(json.dumps(provider.fetch_status(args.tenant), indent=2))
    elif args.action == "grant":
        scopes = ["*"] if args.scopes.strip() == "*" else [
            s.strip() for s in args.scopes.split(",") if s.strip()]
        problems = bad_scopes(scopes)
        if problems:
            print("Refused — nothing was granted:\n  " + "\n  ".join(problems), file=sys.stderr)
            return 2
        prior = repo.load(args.tenant)
        result = provider.create_subscription(
            args.tenant, args.plan, scopes=scopes,
            valid_until=args.until, source=args.source,
            replace=args.replace)
        # ★ A GRANT IS A SUBSCRIPTION, SO IT LANDS IN HER PROFILE (founder, 2026-09-18: "first
        #   time subscription for a subject stage — it lists in My Lessons and default in My
        #   Classes. Listed on profile too with default class"). Checkout has always done this;
        #   the manual grant — which is how the beta subscribes — did not, so a granted subject
        #   sat outside her profile until she found it herself. The SAME two functions checkout
        #   calls, in the same order, so the two paths cannot drift. "*" seeds nothing: eleven
        #   default subjects is not a profile. Account id == tenant id (one teacher per tenant).
        if scopes != ["*"]:
            held = result.get("scopes") or scopes
            try:
                from api import main as api_main  # noqa: E402 — only on this path; inside the guard
                api_main._apply_subscription_profile(args.tenant, args.tenant, held, buying=scopes)
                if prior is None or prior.status == "trial":
                    api_main._purge_trial_artifacts(args.tenant, args.tenant, held)
                result["profile"] = "seeded"
            except Exception as exc:          # the grant stands even if the profile write fails
                result["profile"] = f"NOT seeded: {exc}"
        print(json.dumps(result, indent=2))
    elif args.action == "revoke":
        print(json.dumps(provider.cancel(args.tenant), indent=2))
    elif args.action == "trial-reset":
        repo.save(args.tenant, Entitlement(plan_id="trial", status="trial",
                                           source="trial", scopes=["*"]))
        print(json.dumps(provider.fetch_status(args.tenant), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
