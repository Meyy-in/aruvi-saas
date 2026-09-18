#!/usr/bin/env python3
"""Pull Bucket B out of Postgres onto this machine — the disaster-recovery snapshot.

    python3 aruvi-scripts/pull_state_from_postgres.py --dry-run
    python3 aruvi-scripts/pull_state_from_postgres.py            # snapshot + verify
    python3 aruvi-scripts/pull_state_from_postgres.py --keep 30  # prune older snapshots

THE EXACT INVERSE of migrate_state_to_postgres.py, and deliberately so: both are
`copy_all` over the same document_backend seam, with the arguments swapped. There is no
second implementation to keep in step, and no schema to reason about — the Postgres row
key IS the folder path, so a snapshot is the folder tree the file backend always used.

WHY THIS EXISTS (STORAGE_POLICY.md). Supabase's own daily backups die with the project:
a deletion or a lapsed card takes every copy with it. That is the ONE failure this
guards. It is not version history and never will be — the product promises chapter notes
have no history and means it. What lands here is "the state as it was at 02:00", nothing
more, and it exists so the books of account and every teacher's account survive an
accident that is not Supabase's fault.

WHERE IT WRITES, AND WHY NOT INTO data/cloud/state/.
    backups/state/YYYY-MM-DD/     ← here: gitignored, mirrored to iCloud by the rsync
    data/cloud/state/             ← NOT here: that is the DEV database and it is TRACKED
A snapshot written into the tracked tree would put live teachers' accounts, consents and
invoices onto GitHub on the next push. `backups/` is in .gitignore for exactly this
reason; do not "tidy" these two together.

DATED, NOT MIRRORED. Each run writes its own dated folder rather than overwriting one
copy, because a single mirror protects you against Supabase vanishing but not against
damage you notice three days late. Old snapshots are pruned with --keep (default: keep
everything — pass a number to prune). NOTE: how many days you keep is a PRIVACY
commitment, not just an ops choice — the privacy notice's backup-purge row must not
promise a shorter window than you actually hold.

RESTORING. The pair is symmetric, so a restore is the forward script pointed at a
snapshot:
    ARUVI_STATE_DIR=backups/state/2026-09-18 \
    ARUVI_DATABASE_URL=… python3 aruvi-scripts/migrate_state_to_postgres.py
Read that script's warnings first. Restoring overwrites live keys.

NEEDS: ARUVI_DATABASE_URL (the SESSION-POOLER string from Supabase; the direct db.<ref>
host is IPv6-only and will simply fail to resolve on an IPv4 connection), and
psycopg[binary] — `pip3 install "psycopg[binary]"`.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

REPO = Path(__file__).resolve().parent.parent

# Load .env if present, without a dependency — the same two-line habit dev.sh has.
_envfile = REPO / ".env"
if _envfile.is_file():
    for _line in _envfile.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

from aruvi_core.adapters.document_backend import (  # noqa: E402
    FileBackend, PostgresBackend, copy_all,
)

# The dev mail spool is not teacher state; the forward script skips it and so does this.
SKIP_PREFIXES = ("outbox/",)


def _keys(backend):
    return [k for k in backend.list_keys("") if not k.startswith(SKIP_PREFIXES)]


def case_collisions(keys):
    """Keys that differ ONLY in case — they collapse onto one file on a case-insensitive
    filesystem (macOS APFS by default, and most Windows volumes).

    Postgres keys are case-sensitive, so `accounts/Kumar1/...` and `accounts/kumar1/...`
    are two different tenants; on this Mac they are one filename, and the second write
    silently overwrites the first. Found 2026-09-18 by the verify step, which is the only
    reason it was not a silent hole in the backup. Named here so the NEXT occurrence
    explains itself instead of reading as "1 missing, 1 differing".

    New collisions should not arise from real teachers: production identity is a mobile
    number from the Supabase token. They come from hand-typed dev ids under the old
    X-Aruvi-User stub, where slug() preserves case.
    """
    seen, clashes = {}, []
    for k in keys:
        seen.setdefault(k.lower(), []).append(k)
    for _, group in sorted(seen.items()):
        if len(group) > 1:
            clashes.append(sorted(group))
    return clashes


def verify(src, dst) -> int:
    """Read every key back off disk and compare it to Postgres, document by document."""
    sk, dk = _keys(src), _keys(dst)
    missing = sorted(set(sk) - set(dk))
    diff = []
    for k in sk:
        if k in missing:
            continue
        same = (src.get_json(k) == dst.get_json(k)) if k.endswith(".json") \
            else (src.get_bytes(k) == dst.get_bytes(k))
        if not same:
            diff.append(k)
    print(f"  verify: {len(sk)} in postgres · {len(dk)} on disk · "
          f"{len(missing)} missing · {len(diff)} differing")
    for label, lst in (("missing", missing), ("differs", diff)):
        for k in lst[:10]:
            print(f"    {label}: {k}")
    return 0 if not missing and not diff else 1


def prune(root: Path, keep: int) -> None:
    """Keep the newest `keep` dated snapshots; remove the rest.

    Dated folders sort lexically in date order, which is the whole reason for YYYY-MM-DD.
    A snapshot that cannot be removed (a read-only mount, a sandbox that forbids unlink)
    is REPORTED, never silently skipped — a prune you believe ran and did not is how a
    retention promise quietly becomes untrue.
    """
    snaps = sorted(p for p in root.iterdir() if p.is_dir())
    for old in snaps[:-keep] if keep > 0 else []:
        try:
            shutil.rmtree(old)
            print(f"  pruned {old.name}")
        except OSError as e:
            print(f"  COULD NOT PRUNE {old.name}: {e}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true",
                    help="count what is there and write nothing")
    ap.add_argument("--keep", type=int, default=0,
                    help="keep only the newest N snapshots (0 = keep all, the default)")
    ap.add_argument("--database-url", default=os.environ.get("ARUVI_DATABASE_URL", ""))
    ap.add_argument("--out", default=str(REPO / "backups" / "state"),
                    help="snapshot root (default: backups/state/)")
    args = ap.parse_args()

    if not args.database_url:
        print("error: ARUVI_DATABASE_URL is not set.\n"
              "  Supabase dashboard → the CONNECT button at the top of the project page →\n"
              "  Session pooler. Note the username is postgres.<PROJECT-REF>, not plain\n"
              "  postgres, and the port is 5432. (It is also already set in Render →\n"
              "  Environment → ARUVI_DATABASE_URL — copying it from there is safest.)\n"
              "  Put it in .env as ARUVI_DATABASE_URL=… (never commit it), or pass "
              "--database-url.", file=sys.stderr)
        return 2

    try:
        src = PostgresBackend(args.database_url, ensure_schema=False)
    except RuntimeError as e:
        print(f"error: {e}", file=sys.stderr)
        return 3

    try:
        keys = _keys(src)
        by_kind: dict = {}
        for k in keys:
            by_kind[k.split("/")[0]] = by_kind.get(k.split("/")[0], 0) + 1
        print(f"source: {src.describe()} — {len(keys)} documents")
        for kind, n in sorted(by_kind.items()):
            print(f"  {kind:18s} {n}")
        if not keys:
            print("REFUSING to write an empty snapshot — the database returned no "
                  "documents. Check the connection string points at the right project.",
                  file=sys.stderr)
            return 4
        if args.dry_run:
            print("dry run — nothing written.")
            return 0

        clashes = case_collisions(keys)
        if clashes:
            print("WARNING — keys differing only in case. This filesystem cannot hold "
                  "both, so one will overwrite the other and verify will fail:")
            for group in clashes:
                print("    " + "  ==  ".join(group))
            print("  These are almost certainly duplicate dev tenants. Resolve them in "
                  "the database; see the docstring of case_collisions().")

        stamp = _dt.date.today().isoformat()
        root = Path(args.out)
        dest = root / stamp
        # Re-running on the same day replaces that day's snapshot rather than merging
        # into it: copy_all never deletes, so a merge would keep keys the database no
        # longer has and quietly misreport the day's state.
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True, exist_ok=True)

        dst = FileBackend(dest)
        stats = copy_all(src, dst)
        print(f"wrote {dest}  —  copied {stats['copied']} · skipped {stats['skipped']}")
        rc = verify(src, dst)
        (root / "LATEST.txt").write_text(
            f"{stamp}  {stats['copied']} documents  "
            f"{'OK' if rc == 0 else 'VERIFY FAILED'}\n")
        if args.keep:
            prune(root, args.keep)
        print("done." if rc == 0 else "DONE WITH DIFFERENCES — see above.")
        return rc
    finally:
        src.close()


if __name__ == "__main__":
    sys.exit(main())
