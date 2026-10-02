#!/usr/bin/env python3
"""batch_build.py — run build_library.py across a whole subject·stage, resumably (v1.0, 2026-08-12).

    python3 genon/batch_build.py the_world_around_us v iv iii            # the S5 corpus
    python3 genon/batch_build.py the_world_around_us v --chapters 1-4,7  # a slice
    python3 genon/batch_build.py the_world_around_us v iv iii --plan     # price it, spend nothing

WHY THIS EXISTS. `build_library.py` builds ONE chapter and is already resumable and
idempotent — it skips any canonical already on disk, so a failure never re-buys a paid
file. What it does not do is decide WHICH chapters, keep the per-chapter logs apart, price
the run before it starts, or stop when a stage-wide defect is burning money one chapter at a
time. A shell `for` loop does the first and none of the rest. At 90 runs for TWAU alone
(≈ ₹2.8k) those four are the difference between a batch you can read afterwards and a bill.

WHAT IT DOES NOT DO, deliberately:
  * it never authors anything itself — every metered call is `build_library.py`'s, unchanged,
    one subprocess per chapter (the 2026-08-11 lesson: a second copy of a paid code path is
    the original bug waiting to come back);
  * it never certifies and never approves. Each chapter's certification report is written by
    `build_library.py` where it always was (`genon/out/library_reports/`); the HUMAN GATE is
    unchanged and still the founder's, at whatever sampling rate is chosen. This script's
    summary tells you which reports to open, not what they say.

RESUME. Re-running is the resume: a chapter whose library is complete on disk is skipped
before the subprocess starts, so an interrupted batch continues where it stopped. `--redo`
forces regeneration (passed straight through), `--certify-only` re-runs only the free steps
across the worklist — the cheap way to re-certify a whole stage after an engine or gate change.

STOPPING. `--max-fails N` (default 2) aborts the batch after N chapters fail. A one-off
generation defect should not end an overnight run; a systematic one should not be paid for
thirty-one times.

NETWORK DROPS AUTO-RESUME (v1.1, 2026-08-12). The SDK retries a dropped connection only a
couple of times, seconds apart, and a streamed generation cannot be resumed mid-flight — so a
three-minute outage kills the run in progress AND, without this, the next chapters in the
worklist, each failing in seconds until `--max-fails` aborts a batch the network was about to
come back for. So: when a chapter fails, its log is classified. TRANSIENT (connection reset,
timeout, DNS, 429/500/502/503/529 overloaded) → wait for `api.anthropic.com` to answer again,
then re-run the SAME chapter, up to `--net-retries` times, NOT counted against `--max-fails`.
Anything else — a validation failure, a certification failure, a bad key — is a DEFECT and is
never retried: retrying a defect is how you pay twice for the same mistake.

Re-running is safe because `build_library.py` skips canonicals already on disk, so a retry
resumes at the file the outage interrupted. What it cannot recover is the in-flight generation
itself: if the stream died after the model had produced its output, that run is billed and
there is no file, so the retry re-buys it (~₹31). That is the whole cost of an outage.

FLAGS: --plan (print the worklist + estimate, spend nothing) · --yes (skip the confirm) ·
--top-only / --certify-only / --redo (passed through per chapter) · --chapters 1-4,7 (single
grade only) · --max-fails N · --rate R (₹ per authoring run for the estimate, default 31) ·
--net-retries N (default 3) · --net-wait S (seconds to wait for the network per retry,
default 1800) · --no-net-retry (treat every failure as a defect).
"""
from __future__ import annotations

import csv
import json
import re
import socket
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent            # genon/
REPO = HERE.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(HERE))

# Reuse build_library's own constants rather than restating them — KLASS and the library
# directory are exactly the kind of fact that drifts when it is written down twice.
import build_library as bl                                        # noqa: E402
from aruvi_core.genon.carriers import (                           # noqa: E402
    CarrierNotImplemented, require_carrier,
)

MASTER = REPO / "data" / "cloud" / "content" / "allocation_norms" / "master_plan.json"  # path fix 2026-10-02
TOKEN_LOG = REPO / "runtime_data" / "token_log.csv"
RUNLOGS = HERE / "out" / "runlogs"
BATCHDIR = HERE / "out" / "batch_runs"
DEFAULT_RATE_INR = 31.0        # TWAU S5 C2: ₹94.00 for 3 runs. Re-measure per stage.


# ── worklist ────────────────────────────────────────────────────────────────────
def counts_for(row) -> list[int]:
    """The chapter's canonical counts. `canonical_plan.counts` once variant_plans has
    annotated the row; `canonical_periods` (equal dispersion) before that — they agree,
    and a chapter that has never been touched only has the second."""
    cp = row.get("canonical_plan") or {}
    return list(cp.get("counts") or row.get("canonical_periods") or [])


def content_present(subject: str, grade: str, ch: int) -> bool:
    """Eligibility as testing.md defines it: BOTH a summary and a mapping on disk.
    Summaries are .json for maths/english/TWAU and .txt for science/SS — glob the suffix."""
    # Path fix 2026-10-02: since the 2026-08-23 split, summaries live in the founder-secure
    # authoring root and mappings in the runtime content root (CLOUD_DATA_MODEL.md §0.5).
    summaries = REPO / "data" / "authoring" / "chapters" / subject / grade / "summaries"
    mappings = REPO / "data" / "cloud" / "content" / "chapters" / subject / grade / "mappings"
    has_summary = any(summaries.glob(f"ch_{ch:02d}_summary.*"))
    has_mapping = (mappings / f"ch_{ch:02d}_mapping.json").is_file()
    return has_summary and has_mapping


def missing_runs(subject: str, grade: str, ch: int, counts: list[int]) -> list[str]:
    """Which of the chapter's canonicals are NOT yet on disk — i.e. what this chapter
    would actually be charged for. Same filenames build_library skips on."""
    lib = bl.lib_dir_of(subject, grade)
    out = []
    for i, k in enumerate(counts):
        name = f"ch_{ch:02d}_canonical.json" if i == 0 else f"ch_{ch:02d}_canonical_p{k:02d}.json"
        if not (lib / name).is_file():
            out.append(f"{k}p")
    return out


def parse_chapter_filter(spec: str) -> set[int]:
    picked: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            picked.update(range(int(a), int(b) + 1))
        else:
            picked.add(int(part))
    return picked


def build_worklist(subject: str, grades: list[str], only: set[int] | None):
    mp = json.loads(MASTER.read_text())
    work, skipped = [], []
    for grade in grades:
        klass = bl.KLASS[grade]
        combo = mp["combos"].get(f"{subject}|{klass}")
        if combo is None:
            skipped.append((grade, "-", "no master_plan combo"))
            continue
        for row in combo["chapters"]:
            ch = row["chapter"]
            if only is not None and ch not in only:
                continue
            counts = counts_for(row)
            if row.get("placeholder"):
                skipped.append((grade, ch, "placeholder row"))
            elif not counts:
                skipped.append((grade, ch, "no canonical counts"))
            elif not content_present(subject, grade, ch):
                skipped.append((grade, ch, "no summary and/or mapping"))
            else:
                work.append({
                    "grade": grade, "ch": ch, "title": row.get("title", ""),
                    "counts": counts, "missing": missing_runs(subject, grade, ch, counts),
                })
    return work, skipped


# ── cost ────────────────────────────────────────────────────────────────────────
def token_log_rows() -> list[dict]:
    if not TOKEN_LOG.is_file():
        return []
    with TOKEN_LOG.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def cost_since(n_before: int) -> tuple[float, int]:
    """(₹, generations) appended to token_log.csv since the mark. This is C2's source,
    so the batch summary and the C2 step read the same numbers."""
    rows = token_log_rows()[n_before:]
    total = 0.0
    for r in rows:
        try:
            total += float(r.get("cost_inr") or 0)
        except ValueError:
            pass
    return round(total, 2), len(rows)


# ── network ─────────────────────────────────────────────────────────────────────
API_HOST = "api.anthropic.com"

# What a dropped network looks like in a build log. Deliberately a WHITELIST: a failure is
# retried only when it matches, so an unrecognised failure is treated as a defect and costs
# nothing. The overload/rate-limit codes are here because they are transient in the same way
# and answer to the same remedy — wait, then re-run the resumable step.
TRANSIENT = re.compile(
    r"APIConnectionError|APITimeoutError|ConnectionError|ConnectionResetError"
    r"|Connection reset|Connection aborted|Remote end closed|Server disconnected"
    r"|Temporary failure in name resolution|Name or service not known"
    r"|nodename nor servname|getaddrinfo failed|Network is unreachable|No route to host"
    r"|SSLError|SSLEOFError|ReadTimeout|WriteTimeout|PoolTimeout|timed out"
    r"|InternalServerError|OverloadedError|RateLimitError"
    r"|\b(429|500|502|503|504|529)\b.{0,40}(overload|rate.?limit|unavailable|gateway|error)",
    re.IGNORECASE,
)


def net_ok(timeout: float = 5.0) -> bool:
    try:
        socket.create_connection((API_HOST, 443), timeout=timeout).close()
        return True
    except OSError:
        return False


def wait_for_network(max_wait: int, poll: int = 20) -> bool:
    """Block until the API host answers again, or give up. Printed loudly: an unattended
    batch that sat quiet for twenty minutes should say so in its own log."""
    if net_ok():
        return True
    t0 = time.time()
    print(f"   network unreachable ({API_HOST}) — waiting up to {max_wait}s", flush=True)
    while time.time() - t0 < max_wait:
        time.sleep(poll)
        if net_ok():
            print(f"   network back after {int(time.time() - t0)}s — resuming", flush=True)
            return True
        print(f"   still down ({int(time.time() - t0)}s)", flush=True)
    print(f"   network still down after {max_wait}s — giving up on this chapter", flush=True)
    return False


def looks_transient(logpath: Path) -> str:
    """The matched marker, or "" if this failure is a defect. Reads the tail only — the
    traceback is at the end and the rest is a streamed generation."""
    try:
        text = logpath.read_text(encoding="utf-8", errors="replace")[-20000:]
    except OSError:
        return ""
    m = TRANSIENT.search(text)
    return m.group(0) if m else ""


# ── the run ─────────────────────────────────────────────────────────────────────
def run_chapter(subject: str, item: dict, passthrough: list[str], logpath: Path) -> dict:
    """One build_library.py subprocess, teed to its own log. Returns the row for the CSV."""
    argv = [sys.executable, str(HERE / "build_library.py"),
            subject, item["grade"], str(item["ch"])] + passthrough
    before = len(token_log_rows())
    t0 = time.time()
    report, verdict = "", ""
    with logpath.open("w", encoding="utf-8") as log:
        log.write(f"$ {' '.join(argv)}\n\n")
        proc = subprocess.Popen(argv, cwd=REPO, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in proc.stdout:                      # tee: the operator watches, the log keeps
            sys.stdout.write(line)
            log.write(line)
            if line.startswith("== report:"):
                report = line.split("== report:")[1].replace("==", "").strip()
            if line.startswith("deterministic checks:"):
                verdict = line.split(":", 1)[1].strip()
        rc = proc.wait()
    secs = round(time.time() - t0, 1)
    cost, gens = cost_since(before)
    return {"grade": item["grade"], "chapter": item["ch"], "title": item["title"],
            "counts": "/".join(str(c) for c in item["counts"]),
            "generations": gens, "cost_inr": cost, "seconds": secs,
            "exit": rc, "verdict": verdict or ("ok" if rc == 0 else "FAILED"),
            "attempts": 1, "retried": "", "report": report,
            "log": str(logpath.relative_to(REPO))}


def run_chapter_resilient(subject: str, item: dict, passthrough: list[str], stamp: str,
                          net_retries: int, net_wait: int) -> dict:
    """run_chapter, plus: a TRANSIENT failure waits for the network and re-runs the same
    chapter. The re-run is not a second purchase — build_library skips every canonical
    already installed, so it resumes at the file the outage interrupted."""
    attempt, spent, gens, secs, markers = 0, 0.0, 0, 0.0, []
    while True:
        attempt += 1
        suffix = "" if attempt == 1 else f"_try{attempt}"
        logpath = (RUNLOGS /
                   f"batch_{subject}_{item['grade']}_ch{item['ch']:02d}_{stamp}{suffix}.log")
        row = run_chapter(subject, item, passthrough, logpath)
        spent += row["cost_inr"]
        gens += row["generations"]
        secs += row["seconds"]
        row.update(cost_inr=round(spent, 2), generations=gens, seconds=round(secs, 1),
                   attempts=attempt, retried="; ".join(markers))
        if row["exit"] == 0 or attempt > net_retries:
            return row
        marker = looks_transient(logpath)
        if not marker:
            return row                      # a defect — never retried, never re-bought
        markers.append(marker)
        print(f"\n   TRANSIENT failure on attempt {attempt} ({marker}) — "
              f"retry {attempt}/{net_retries} after the network returns", flush=True)
        if not wait_for_network(net_wait):
            # The probe is a plain socket to api.anthropic.com:443, which a corporate
            # proxy can refuse on a machine where the SDK itself works fine. So a probe
            # that never recovers does NOT end the chapter — retry anyway. A retry into a
            # genuinely dead network fails in seconds and costs nothing; treating the
            # probe as authoritative would turn a recoverable outage into a give-up.
            print("   probe never recovered — retrying anyway (a dead network fails fast)",
                  flush=True)


def write_summary(path: Path, subject: str, grades: list[str], rows: list[dict],
                  skipped: list, started: str, aborted: str = "") -> None:
    done = [r for r in rows if r["exit"] == 0]
    bad = [r for r in rows if r["exit"] != 0]
    total = round(sum(r["cost_inr"] for r in rows), 2)
    gens = sum(r["generations"] for r in rows)
    lines = [
        f"# Batch build · {subject} · grades {', '.join(grades)} · started {started}", "",
        f"chapters attempted **{len(rows)}** — {len(done)} clean, {len(bad)} failed  ",
        f"authoring runs **{gens}** · spend **₹{total}**"
        + (f" · mean ₹{round(total / gens, 2)}/run" if gens else ""), "",
    ]
    if aborted:
        lines += [f"> **ABORTED** — {aborted}", ""]
    lines += ["| grade | ch | title | counts | runs | ₹ | secs | tries | verdict | report |",
              "|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        lines.append(f"| {r['grade']} | {r['chapter']:02d} | {r['title'][:34]} | {r['counts']} "
                     f"| {r['generations']} | {r['cost_inr']} | {r['seconds']} "
                     f"| {r.get('attempts', 1)} | {r['verdict']} "
                     f"| {Path(r['report']).name if r['report'] else '—'} |")
    retried = [r for r in rows if r.get("retried")]
    if retried:
        lines += ["", "## Network retries", ""] + [
            f"- {r['grade']} ch {r['chapter']:02d} — {r['attempts']} attempt(s): {r['retried']}"
            for r in retried]
    if bad:
        lines += ["", "## Failed — fix worklist", ""]
        for r in bad:
            lines.append(f"- **{r['grade']} ch {r['chapter']:02d}** exit {r['exit']} — log `{r['log']}`. "
                         f"Repair, then `python3 genon/build_library.py {subject} {r['grade']} "
                         f"{r['chapter']} --certify-only` (paid files are on disk; nothing is re-bought).")
    if skipped:
        lines += ["", "## Skipped", ""] + [f"- {g} ch {c} — {why}" for g, c, why in skipped]
    lines += ["", "---", "",
              "Deterministic ALL PASS is a precondition, not the verdict. The HUMAN GATE is "
              "unchanged: present these reports in a Cowork session at the founder's chosen "
              "sampling rate before any chapter is called certified.", ""]
    path.write_text("\n".join(lines), encoding="utf-8")


VALUE_FLAGS = ("--chapters", "--max-fails", "--rate", "--net-retries", "--net-wait")


def parse_argv(argv: list[str], value_flags: tuple = VALUE_FLAGS
               ) -> tuple[list[str], list[str], dict]:
    """positionals, bare flags, {value-flag: value}. Hand-rolled because a value-taking
    flag in the `--chapters 5` form otherwise leaves its value in the positionals, where
    it reads as a grade — the first bug this script had. `value_flags` is a parameter so
    batch_api can reuse the parser with its own flags (`--wave top` has the same trap)."""
    pos, flags, vals, i = [], [], {}, 0
    while i < len(argv):
        a = argv[i]
        if a.startswith("--"):
            name, _, inline = a.partition("=")
            if name in value_flags:
                if inline:
                    vals[name] = inline
                elif i + 1 < len(argv) and not argv[i + 1].startswith("--"):
                    vals[name] = argv[i + 1]
                    i += 1
                else:
                    raise SystemExit(f"{name} needs a value")
            else:
                flags.append(name)
        else:
            pos.append(a)
        i += 1
    return pos, flags, vals


def main() -> int:
    args, flags, vals = parse_argv(sys.argv[1:])
    if len(args) < 2:
        raise SystemExit(__doc__)
    subject, grades = args[0], [g.lower() for g in args[1:]]
    unknown = [f for f in flags if f not in
               ("--plan", "--yes", "--top-only", "--certify-only", "--redo", "--no-net-retry")]
    if unknown:
        raise SystemExit(f"unknown flag(s): {', '.join(unknown)}\n{__doc__}")

    plan_only = "--plan" in flags
    assume_yes = "--yes" in flags
    max_fails = int(vals.get("--max-fails", 2))
    rate = float(vals.get("--rate", DEFAULT_RATE_INR))
    chspec = vals.get("--chapters")
    net_retries = 0 if "--no-net-retry" in flags else int(vals.get("--net-retries", 3))
    net_wait = int(vals.get("--net-wait", 1800))
    only = parse_chapter_filter(chspec) if chspec else None
    if only and len(grades) > 1:
        raise SystemExit("--chapters applies to ONE grade; name a single grade or drop the filter.")
    passthrough = [f for f in flags if f in ("--top-only", "--certify-only", "--redo")]
    certify_only = "--certify-only" in passthrough

    # PRE-FLIGHT, before any spend and before any plan is printed. Same gate build_library
    # runs per chapter (S4's lesson: a carrier gate cannot be forgotten) — run it once here
    # so an ineligible stage is refused in a second rather than at the first paid step.
    bad = [g for g in grades if g not in bl.KLASS]
    if bad:
        raise SystemExit(f"unknown grade(s): {', '.join(bad)} — expected one of "
                         f"{', '.join(bl.KLASS)}")
    for grade in grades:
        try:
            require_carrier(subject, grade)
        except CarrierNotImplemented as e:
            raise SystemExit(f"STOP before spending — {e}")
    if not certify_only:
        import os
        if not os.environ.get("ANTHROPIC_API_KEY") and not (REPO / "runtime_data" / "anthropic.key").is_file():
            raise SystemExit("No API key: set ANTHROPIC_API_KEY or put it in runtime_data/anthropic.key. "
                             "(Metered runs must be in Terminal — the Cowork sandbox proxy blocks them.)")

    work, skipped = build_worklist(subject, grades, only)
    todo = work if (certify_only or "--redo" in passthrough) else [w for w in work if w["missing"]]
    complete = [w for w in work if not w["missing"]]
    runs = sum(len(w["missing"]) for w in todo) if not certify_only else 0

    print(f"\n=== BATCH PLAN · {subject} · grades {', '.join(grades)} ===")
    for w in todo:
        state = "certify" if certify_only else ", ".join(w["missing"]) + " to buy"
        print(f"  {w['grade']:>4} ch {w['ch']:02d}  {w['title'][:38]:<38} "
              f"counts {'/'.join(str(c) for c in w['counts']):<10} {state}")
    if complete and not certify_only:
        print(f"  ({len(complete)} chapter(s) already complete on disk — skipped; --redo to rebuild)")
    for g, c, why in skipped:
        print(f"  SKIP {g} ch {c} — {why}")
    print(f"\nchapters {len(todo)} · authoring runs {runs} · "
          f"estimate ₹{round(runs * rate)} at ₹{rate}/run"
          + (" (free — certify only)" if certify_only else "")
          + f" · abort after {max_fails} defect failure(s)"
          + (f" · network retries {net_retries} (wait up to {net_wait}s each)"
             if net_retries else " · network retries OFF"))
    if plan_only:
        print("\n--plan: nothing run.")
        return 0
    if not todo:
        print("\nNothing to do.")
        return 0
    if not assume_yes:
        if input("\nProceed? [y/N] ").strip().lower() not in ("y", "yes"):
            print("Aborted — nothing spent.")
            return 0

    RUNLOGS.mkdir(parents=True, exist_ok=True)
    BATCHDIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = BATCHDIR / f"{subject}_{'-'.join(grades)}_{stamp}.csv"
    md_path = BATCHDIR / f"{subject}_{'-'.join(grades)}_{stamp}.md"
    rows: list[dict] = []
    fails, aborted = 0, ""

    for n, item in enumerate(todo, 1):
        print(f"\n\n######## [{n}/{len(todo)}] {subject} {item['grade']} ch {item['ch']:02d} "
              f"· {item['title']} ########")
        row = run_chapter_resilient(subject, item, passthrough, stamp, net_retries, net_wait)
        rows.append(row)
        # Write both artefacts after EVERY chapter: a batch that dies at 3 a.m. still leaves
        # a readable record of what it bought.
        with csv_path.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
        write_summary(md_path, subject, grades, rows, skipped, stamp)
        print(f"-- ch {item['ch']:02d}: exit {row['exit']} · {row['verdict']} · "
              f"₹{row['cost_inr']} · {row['seconds']}s"
              + (f" · {row['attempts']} attempts" if row["attempts"] > 1 else "")
              + f" · log {row['log']}")
        if row["exit"] != 0:
            fails += 1
            # THE BRAKE IS FOR MONEY, AND --certify-only SPENDS NONE (2026-08-12, found on
            # S5's wave-1 certify). The abort exists so a systematic defect is not BOUGHT
            # thirty-one times. A free pass has nothing to protect: stopping at the second
            # failure only hides the other twenty-nine reports — and between the two batch
            # waves EVERY chapter fails the "library complete" check by construction,
            # because its compacts do not exist yet. So the brake is off when nothing is
            # being purchased. It also means the annotate step (which unlocks wave 2's
            # briefs) reaches every chapter instead of the first two.
            if fails >= max_fails and not certify_only:
                aborted = (f"{fails} chapter(s) failed (limit {max_fails}) — stopped at "
                           f"{item['grade']} ch {item['ch']:02d}. Paid artefacts are on disk; "
                           f"re-running this command resumes without re-buying them.")
                print(f"\n!! {aborted}")
                break

    write_summary(md_path, subject, grades, rows, skipped, stamp, aborted)
    total = round(sum(r["cost_inr"] for r in rows), 2)
    gens = sum(r["generations"] for r in rows)
    print(f"\n=== BATCH DONE · {len(rows)} chapter(s) · {gens} run(s) · ₹{total} ===")
    print(f"summary: {md_path.relative_to(REPO)}")
    print(f"csv:     {csv_path.relative_to(REPO)}")
    print("Next: present the per-chapter certification reports at the human gate.")
    return 1 if (fails or aborted) else 0


if __name__ == "__main__":
    sys.exit(main())
