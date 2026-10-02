#!/usr/bin/env python3
"""generate_canonical.py — one CLI for canonical LP+assessment generation.

Sync mode (this version — HANDOVER step-4 execution design):

    python3 generate_canonical.py one <subject> <grade> <chapter> [options]

    e.g.  python3 generate_canonical.py one social_sciences ix 5
          python3 generate_canonical.py one social_sciences ix 5 --dry
          python3 generate_canonical.py one social_sciences ix 5 \
              --lp-const genon/amended/originals/lesson_plan_constitution_v1.0.txt \
              --assess-const genon/amended/originals/assessment_constitution_v1.1_pre_phase_ref.txt \
              --tag control_v10        # the v1.0 control test

Prompt assembly is delegated ENTIRELY to prompt_assembly.py (the verbatim
prototype wrapper) — this file only resolves inputs, makes the API call,
validates, saves, and logs. Batch mode (Message Batches API, 50% discount)
is deliberately deferred until the mass pre-warm sweep.

Defaults per the genon master plan:
- duration  = class-standard (40 ≤ VII, 45 VIII, 50 IX)
- period count = recommended_periods from genon/master_plan.json
- model = the certified generation model (claude-sonnet-4-6, thinking off —
  llm_client.py's certified baseline)

Requires ANTHROPIC_API_KEY in the environment for live runs (never --dry).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import prompt_assembly as pa

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
# (partition-era imports removed 2026-07-31 — the band/handoff layer is retired;
# see docs/variant_canonical_architecture.md §6a)

# The authoring pipeline reads DATA_DIR and LP_YEAR from the SAME place the runtime does,
# so a canonical can never be written where the API will not look for it (§2.2).
from api import config  # noqa: E402

HERE = Path(__file__).resolve().parent           # genon/
REPO = HERE.parent                                # aruvi-saas/
OUT_DIR = HERE / "out" / "canonical"
LEDGER = HERE / "ledger.csv"

# ★ WHERE AUTHORED CANONICALS LAND — module-level so it can be REDIRECTED (2026-08-27).
# install_canonical writes into the live library, so a test that cannot point it
# somewhere else is a test that edits production content. It used to be redirectable by
# accident (it built its path from REPO, which tests reassigned); moving it onto
# config.DATA_DIR silently took that away, and the next run of test_genon_plan_key
# reached for the real english/ix ch 7 — saved only by a cross-device link error.
# Redirect BOTH of these together, never one.
LIB_ROOT = Path(config.DATA_DIR) / "saved_plans"
BACKUP_ROOT = REPO / "backup" / "saved_plans"

# Certified generation config — mirrors Project Aruvi llm_client.py
# (2026-07-15 regression cycle): Sonnet 4.6, thinking off.
GENERATION_MODEL = "claude-sonnet-4-6"
MAX_TOKENS_LPA = 64000
MAX_TOKENS_LP_ONLY = 32000

# ₹ economics (HANDOVER): $3/M input, $15/M output, ₹92/$ — override via flags.
USD_PER_M_INPUT = 3.0
USD_PER_M_OUTPUT = 15.0
INR_PER_USD = 92.0

FOLDER_TO_SUBJECT = {
    "social_sciences": "Social Science",
    "mathematics": "Mathematics",
    "science": "Science",
    "english": "English",
    "the_world_around_us": "The World Around Us",
}
ROMAN = {"iii": "III", "iv": "IV", "v": "V", "vi": "VI", "vii": "VII",
         "viii": "VIII", "ix": "IX", "x": "X"}


def std_duration(grade_folder: str) -> int:
    n = ["iii", "iv", "v", "vi", "vii", "viii", "ix", "x"].index(grade_folder) + 3
    if n <= 7:
        return 40
    if n == 8:
        return 45
    return 50


def master_plan_entry(subject_folder: str, grade_folder: str, chapter: int) -> dict | None:
    # master_plan.json lives with the other allocation sources (founder layout, 2026-07-25)
    # ★ PATH FIX 2026-10-02. data/content/ has not existed since the 2026-08-23 restructure
    # (see the library write below, fixed 2026-08-27). Reading the old path returned None, so
    # a top canonical found no period count and the placeholder guard never fired.
    mp = Path(config.DATA_DIR) / "allocation_norms" / "master_plan.json"
    if not mp.exists():
        return None
    combos = json.loads(mp.read_text(encoding="utf-8"))["combos"]
    combo = combos.get(f"{subject_folder}|{ROMAN[grade_folder]}")
    if not combo:
        return None
    for row in combo["chapters"]:
        if row["chapter"] == chapter:
            return row
    return None


def strip_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t
        if t.rstrip().endswith("```"):
            t = t.rstrip()[:-3]
    return t.strip()


# ── THE ONE PARSER · every path that turns model output into a canonical goes here ──
# Extracted from cmd_one 2026-08-11 (S8's C1). It had been inline, which is how the
# recovery script came to hold a hand-copy of it — two copies of a heuristic that must
# agree exactly. Batch mode (the Message Batches sweep, deferred per this module's
# docstring) is the reason this matters beyond tidiness: whoever writes it will need a
# parse step, and an inline block invites a third copy carrying the original bug back in.
# There is now one function; call it.
MAX_QUOTE_REPAIRS = 500          # was 10 — see the note below
MAX_REPAIR_SPAN = 400            # a naked pair wider than this is not a quote glitch
                                 # was 300 (measured 2026-08-11 on maths III ch 5: max span
                                 # 159, median 83). S7's wave 1 lost mathematics viii ch 2
                                 # ENTIRELY to a pair of 319 — 40 of that file's 41 pairs
                                 # repaired and the 41st was refused by nineteen characters.
                                 # A compliant Rule 10 narration that quotes a multi-part
                                 # "Figure it Out" item runs longer than 2026-08-11's corpus
                                 # showed; 400 clears the measured worst case (319) with
                                 # headroom and still sits far below anything a genuinely
                                 # broken structure would present. Founder ruling 2026-08-19.


def _trailing_comma_fix(text: str, e: json.JSONDecodeError):
    """The THIRD known glitch (2026-08-19, S8 W1): a TRAILING COMMA before a closer.

    mathematics·v ch 6 "The Dairy Farm" arrived complete (94 KB) with exactly ONE
    defect in the whole file — `"inclusivity": "…",\\n          },` — a comma where
    JSON permits none. It cost the artefact outright: neither existing family sees it,
    so the quote heuristic thrashed 413 "repairs" past it and turned a structural
    newline into an in-string one, and `_structural_escape` then stopped at the same
    comma reporting "expecting property name". ₹15 for a correct plan nobody could read.

    Same guarantees as the other two families. Exactly ONE character is REMOVED, at the
    position a string-aware walk proves is a comma followed only by whitespace and then
    `}` or `]`. A comma in that position cannot be content — JSON has no construct where
    it is legal — so the repair is provably content-neutral in the strongest sense
    available: the parser rejected the file precisely because that character means
    nothing there. Anything else returns None and the caller falls through unchanged.

    WHY IT IS TRIED WITH `_bracket_fix` AND BEFORE THE QUOTE LOOP. The failure mode is
    the bracket typo's, not the quote glitch's: the parser stops at a position the quote
    heuristic will happily "repair" by wrapping real structure in escapes, so running it
    second means running it on a corrupted string. Both cheap checks go first, for the
    same reason, and neither can fire on a file the other would fix.

    Returns (repaired_text, note) or None.
    """
    pos = e.pos
    if pos >= len(text) or text[pos] not in "}]":
        return None
    # Walk BACK over whitespace to the character before the closer the parser choked on.
    i = pos - 1
    while i >= 0 and text[i] in " \t\r\n":
        i -= 1
    if i < 0 or text[i] != ",":
        return None
    # String-aware walk of everything before that comma: it must not be inside a string.
    in_str, esc = False, False
    for ch in text[:i]:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
    if in_str:
        return None
    return (text[:i] + text[i + 1:],
            f"trailing comma removed before {text[pos]!r} at char {i}")


def _bracket_fix(text: str, e: json.JSONDecodeError):
    """The SECOND known glitch (2026-08-17, S6 W2): a wrong CLOSER, one character.

    science·vii ch 9 p09 arrived complete (80 KB) except for `{"stage": 4)` — a `)`
    where `}` belongs — and ₹14.27 sat unrecoverable because the only repair family was
    naked quotes. Same guarantees as that family: exactly ONE character is changed, at
    the exact position the parser stopped, only when a string-aware walk of everything
    before it shows an open structure whose expected closer differs from the character
    found. Anything else returns None and the caller falls through unchanged.
    Returns (repaired_text, note) or None.
    """
    pos = e.pos
    if pos >= len(text) or text[pos] not in ")]}":
        return None
    stack, in_str, esc = [], False, False
    for ch in text[:pos]:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch in "{[":
            stack.append(ch)
        elif ch in "}]" and stack:
            stack.pop()
    if in_str or not stack:
        return None
    want = "}" if stack[-1] == "{" else "]"
    if text[pos] == want:
        return None                      # right closer already — not this glitch
    return (text[:pos] + want + text[pos + 1:],
            f"bracket {text[pos]!r}->{want!r} at char {pos}")


def parse_with_repair(full: str) -> tuple[dict | None, list[str], list[str]]:
    """Parse model output, auto-repairing the two known serialization glitches:
    naked inner quotes (below) and, since 2026-08-17, the one-character wrong
    closer (`_bracket_fix` above — tried first, because the quote heuristic
    corrupts on it).

    Returns `(parsed | None, problems, repairs)`.

    THE (first) GLITCH: naked (unescaped) double quotes inside a JSON string. Each repair
    escapes exactly ONE quote pair — provably content-neutral, no character is added or
    removed except the two backslashes — and every repair is recorded so the ledger can
    report it. Any OTHER defect still fails hard: nothing else is auto-touched.

    THE BOUND WAS 10, AND 10 WAS THE WRONG ORDER OF MAGNITUDE (2026-08-11, S8's C1).
    It was set when the glitch looked like a rare slip (4 quotes, 2026-07-26). It is not
    rare on the stages whose LP constitution MANDATES an inner-quoted band narration:
    mathematics preparatory Rule 6 and mathematics middle Rule 10 both require
    `book_ref ("description....")`, so nearly every band that invokes a textbook task
    carries a quote pair — 45 of 62 bands in maths III ch 5's standard canonical.

    Escaping is left to the model and is NOT reliable, and the failure is a whole-run
    MODE rather than a scatter: ch 5's standard escaped all 45 of its pairs and parsed
    clean; its 11-period compact escaped none of its 42 and died at the 10th repair with
    ₹40.72 already spent. So the bound must clear the worst case a COMPLIANT plan can
    present (a long chapter at ~5 bands/unit ≈ 100), not the best. Each iteration is one
    pass over ~100 KB, so the headroom costs milliseconds.

    `MAX_REPAIR_SPAN` is the other magic number here — raised 300 -> 400 on 2026-08-19
    (see the constant). A "pair" wider than that is more likely a genuinely broken
    structure than a quoted phrase, and repairing it would corrupt rather than rescue.

    THE PAIR HEURISTIC HAS A SHAPE IT CANNOT SEE, AND A LAST RESORT NOW FOLLOWS IT
    (2026-08-19, S7 · W1). It pairs a `("` with the next `")`, which is the shape the
    band-narration rule mandates. mathematics vi ch 10 wrote a legal narration in a
    different shape — `p.251 (both sets: "Complete seven expressions…" and "Evaluate
    eight…")`, two quoted phrases in one parenthetical — and the pairing walked straight
    past it, then thrashed 417 "repairs" and corrupted a file whose content was correct.
    `_structural_escape` below is tried only when this loop has failed, and it does not
    guess pairs at all. Both failures cost a whole artefact, so the fallback earns itself
    at two runs a stage.
    """
    text = strip_fences(full)
    original = text                     # the pair loop may corrupt; the fallback re-reads this
    parsed, problems, repairs = None, [], []
    for _ in range(MAX_QUOTE_REPAIRS):
        try:
            parsed = json.loads(text)
            break
        except json.JSONDecodeError as e:
            # Wrong-closer check FIRST: on a bracket typo the quote heuristic below
            # would wrap real structure in escapes and corrupt rather than rescue
            # (2026-08-17; see _bracket_fix).
            fix = _bracket_fix(text, e)
            if fix is None:
                # Third family, same reasoning: a one-character structural typo the
                # quote heuristic would corrupt rather than fix (2026-08-19; see
                # _trailing_comma_fix).
                fix = _trailing_comma_fix(text, e)
            if fix is not None:
                text, note = fix
                repairs.append(note)
                continue
            q1 = text.rfind('"', 0, e.pos)
            q2 = text.find('"', e.pos)
            if q1 == -1 or q2 == -1 or q2 - q1 > MAX_REPAIR_SPAN:
                problems = [f"JSON parse error: {e}"]
                break
            repairs.append(text[q1 + 1:q2][:50])
            text = text[:q1] + '\\"' + text[q1 + 1:q2] + '\\"' + text[q2 + 1:]
    else:
        # Exhaustion used to fall through to a generic "output is not valid JSON", which
        # named neither the cause nor the count — the ledger held the real evidence
        # ("auto-repaired 10 naked quotes") while the headline said nothing. Say it here,
        # and say what to do about it: the raw is already on disk and already paid for.
        problems = [f"gave up after {MAX_QUOTE_REPAIRS} naked-quote repairs — still not "
                    f"valid JSON. The raw output is complete and on disk; recover it with "
                    f"genon/recover_from_raw.py rather than re-generating."]
    if parsed is None:
        # LAST RESORT — see the docstring. Run on `original`, never on the loop's output.
        rescued, escaped = _structural_escape(original)
        if rescued is not None:
            parsed, problems = rescued, []
            repairs = [f"structural-escape fallback: {escaped} inner quote(s) escaped by "
                       f"the closing-context rule after the pair heuristic failed"]
    return parsed, problems, repairs


def _structural_escape(text: str) -> tuple[dict | None, int]:
    """Escape every `"` that cannot be closing a string, then parse. `(parsed|None, count)`.

    THE RULE, and why it is exhaustive rather than a guess. In well-formed JSON a string
    is a key, an array element, or an object value — nothing else — so its closing quote
    is always followed, after optional whitespace, by one of `:` `,` `}` `]`. A quote
    followed by anything else is therefore INSIDE the string and must be escaped. No
    pairing, no span bound, no iteration: one left-to-right pass that already knows
    whether it is inside a string.

    WHY IT IS THE LAST RESORT AND NOT THE FIRST. It has one false positive the pair
    heuristic does not: a string whose inner quote is itself followed by a comma —
    `he said "yes", then left` — closes early. That corrupts STRUCTURE, so the parse
    then fails and this returns None; a wrong split cannot reach `validate()` looking
    like a right one. But "cannot reach" is not "cannot exist", so the certified path
    runs first and this only ever converts a LOST artefact into a recovered one. Every
    file that installs without it installs identically byte for byte.

    Founder ruling 2026-08-19, on mathematics vi ch 10: the artefact was correct and
    unreadable, and the alternative was paying to regenerate content already on disk.
    """
    out, i, n, instr, escaped = [], 0, len(text), False, 0
    while i < n:
        c = text[i]
        if not instr:
            out.append(c)
            if c == '"':
                instr = True
        elif c == "\\":                          # an escape consumes its next character
            out.append(c)
            if i + 1 < n:
                out.append(text[i + 1])
            i += 2
            continue
        elif c == '"':
            j = i + 1
            while j < n and text[j] in " \t\r\n":
                j += 1
            if j < n and text[j] in ",:}]":
                out.append(c)
                instr = False
            else:
                out.append('\\"')
                escaped += 1
        else:
            out.append(c)
        i += 1
    try:
        return json.loads("".join(out)), escaped
    except json.JSONDecodeError:
        return None, escaped


def validate(parsed: dict, expected_periods: int, expect_v11: bool) -> list[str]:
    """Serve-era checks (2026-07-31). The band declaration layer is RETIRED —
    band ids, roles, band_refs, phase_ref and unit_handoff are no longer part of
    the contract (compile v0.5 derives band labels; anchoring is unit-level via
    period_ref). What a canonical must now get right: period count, coverage
    handoff, verbatim section anchors on every unit, exact band tiling, and a
    resolvable anchor unit on every assessment item. expect_v11 is retained in
    the signature for call-site stability; it gates nothing any more."""
    problems = []
    periods = parsed.get("lesson_plan", {}).get("periods", [])
    if len(periods) != expected_periods:
        problems.append(f"period count {len(periods)} != scheduled {expected_periods}")
    if not parsed.get("coverage_handoff"):
        problems.append("coverage_handoff missing/empty")
    # Carrier seam again (2026-08-07, S6), for the same reason the item check below
    # already uses it: `section_anchor` is the registry join key on the ten stages that
    # HAVE a registry. science·middle has none — its units belong to a cognitive
    # progression arc, so demanding an anchor here failed a perfectly good canonical
    # twelve times over and stopped the build AFTER the model had been paid. Ask the
    # seam whether this subject·stage has a section axis at all.
    _subj, _grade = parsed.get("subject"), parsed.get("grade")
    try:
        from aruvi_core.genon import carriers as _carriers
        _axis = _carriers.has_section_axis(_subj, _grade)
    except Exception:                                            # noqa: BLE001
        _carriers = None
        _axis = True                     # unknown subject -> the strict default
    unit_numbers = set()
    for p in periods:
        n = p.get("period_number")
        unit_numbers.add(n)
        # AND THE ANCHOR IS READ THROUGH THE SEAM TOO (2026-08-10, S7) — the same lesson
        # as the axis question above, one read site along. `section_anchor` is the FIELD
        # NAME on eight of the ten section-axis stages; mathematics middle and preparatory
        # carry the identical fact as `textbook_segments[].ref`, and the plugin mediates it
        # (founder ruling 2026-08-10: no field is invented to feed the engine). Reading the
        # field directly failed all twelve units of a perfectly good mathematics·VII
        # canonical — after the model had been paid, which is the expensive half. The
        # synthesis unit is exempt: on a mediated stage it anchors to no section and
        # `unit_anchor` returns None by design, while on a token stage it carries the
        # reserved token and would pass anyway.
        if _axis:
            try:
                anchor = (_carriers.unit_anchor(p, subject=_subj, grade=_grade)
                          if _carriers else p.get("section_anchor"))
            except Exception:                                    # noqa: BLE001
                anchor = None
            if not (_carriers and _carriers.is_synthesis(p)) and not str(anchor or "").strip():
                problems.append(f"P{n}: missing section_anchor (the registry join key)")
        cur = 0
        for b in p.get("time_bands", []) or []:
            try:
                a_, z_ = (int(x) for x in str(b["minutes"]).replace("\u2013", "-").split("-"))
            except Exception:
                problems.append(f"P{n}: unparseable band minutes {b.get('minutes')!r}")
                continue
            if a_ != cur:
                problems.append(f"P{n}: band gap at {b.get('minutes')}")
            cur = z_
        if cur != p.get("period_duration_minutes"):
            problems.append(f"P{n}: bands sum {cur} != {p.get('period_duration_minutes')}")
    # Carrier seam (2026-08-05): an item's anchor is `period_ref` only for the
    # item-self-sufficient family (SS, TWAU). Handoff-bridged subjects — science both
    # stages, maths secondary — carry an integer section/stage number and the platform
    # resolves the unit from coverage_handoff, so demanding period_ref here would fail
    # every science canonical by construction. Ask the seam what the anchor is.
    # A MISSING CARRIER MUST NOT PASS (2026-08-08, found at S4's P-prep). This used to be a
    # bare `except Exception`, and the combination was silently fatal: for a subject whose
    # items sit under a wrapper (`{…, questions: []}` — science·secondary, maths·secondary)
    # `parsed["assessment_items"]` is absent or a dict, so the fallback's isinstance filter
    # yielded [] and the loop below became a NO-OP. The canonical then passed validation with
    # every item anchored to nothing, was installed, and was paid for — the real failure only
    # surfacing later at certification as "does not compile" on every file. So
    # CarrierNotImplemented now propagates: a subject·stage genon cannot resolve refuses to
    # generate rather than generating unvalidated. The legacy fallback is kept for genuinely
    # shapeless files, but never for an unimplemented carrier.
    from aruvi_core.genon.carriers import (CarrierNotImplemented,
                                           assessment_items as _carrier_items)
    try:
        resolved = _carrier_items(parsed, parsed)
    except CarrierNotImplemented:
        raise
    except Exception:                                            # noqa: BLE001
        resolved = [it for it in (parsed.get("assessment_items") or [])
                    if isinstance(it, dict)]
    for item in resolved:
        if isinstance(item, dict):
            pr = [u for u in (item.get("unit_ref") or item.get("period_ref") or [])
                  if isinstance(u, int)]
            if not (set(pr) & unit_numbers):
                problems.append(f"assessment item {item.get('id', '?')}: "
                                "no resolvable anchor unit "
                                "(period_ref, or section_number via coverage_handoff)")
    return problems[:40]


def const_version(path) -> str:
    """The VERSION number from a constitution's masthead, e.g. '1.5'.

    Scans the first few lines, not just the first (2026-08-07). Every LP constitution
    carries VERSION on line 1, but the assessment constitutions put a title and a blank
    line above it — so this logged '?' for the assessment version on every science·middle
    run, and the ledger cannot attribute a result to a version it never recorded
    (testing.md §6). Case-insensitive because the assessment files write 'Version'."""
    try:
        import re
        for line in Path(path).read_text(encoding="utf-8").splitlines()[:6]:
            m = re.search(r"VERSION\s+([\d.]+)", line, re.I)
            if m:
                return m.group(1)
        return "?"
    except Exception:
        return "?"


def install_canonical(parsed: dict, subject_folder: str, grade_folder: str, ch: int,
                      ts: str, duration: int, count: int, const_label: str,
                      status: str, problems: list[str],
                      variant: int | None = None) -> Path:
    """Drop the generated canonical STRAIGHT into the saved-plans library, wrapped in
    the saved-plan shape the API reads (mirrors ch_05_canonical.json) — the live
    environment has no certification gate, so genon/out and the library are written
    simultaneously (founder decision, 2026-07-29). The validator still RUNS and its
    findings ride along in genon_canonical.validation + the ledger; they are review
    input (testing.md C3), never a block. A pre-existing canonical is archived to
    backup/saved_plans/ (never deleted) — its ledger_ts keys retire with it."""
    # ★ TWO PATH BUGS FIXED HERE 2026-08-27.
    # (a) `data/content/` has not existed since the 2026-08-23 cloud/local restructure —
    #     the live tree is `data/cloud/content/` (CLAUDE.md §7). This wrote authored
    #     canonicals into a directory the API never reads.
    # (b) The library is now foldered by EDITION YEAR (§2.2). Authoring writes into the
    #     CURRENT edition, so the January re-authoring batch lands beside the chapters
    #     carry_over_year.py brought forward, not on top of last year's.
    # Both derive from api.config so an ARUVI_DATA_DIR / ARUVI_LP_YEAR override moves
    # the authoring output and the runtime together — they must never disagree.
    lib = LIB_ROOT / subject_folder / grade_folder / config.LP_YEAR
    lib.mkdir(parents=True, exist_ok=True)
    fname = (f"ch_{ch:02d}_canonical_p{variant:02d}.json" if variant
             else f"ch_{ch:02d}_canonical.json")
    dest = lib / fname
    if dest.exists():
        bdir = BACKUP_ROOT / subject_folder / grade_folder
        bdir.mkdir(parents=True, exist_ok=True)
        try:
            old_ts = (json.loads(dest.read_text(encoding="utf-8"))
                      .get("genon_canonical") or {}).get("ledger_ts") or "unknown"
        except Exception:
            old_ts = "unparsed"
        dest.replace(bdir / f"{fname[:-5]}_{old_ts}.json")
    total = duration * count
    doc = {
        "filename": fname,
        "saved_at": datetime.now().isoformat(timespec="seconds"),
        "plan_status": "canonical",
        "chapter_number": ch,
        "chapter_title": parsed.get("chapter_title", ""),
        "grade": parsed.get("grade") or f"Grade {ROMAN[grade_folder]}",
        "subject": parsed.get("subject") or FOLDER_TO_SUBJECT[subject_folder],
        "period_rows_snapshot": [{"id": 0, "duration": duration, "count": count}],
        "period_schedule_display": (f"Period schedule:\n  Row 1: {duration} minutes × "
                                    f"{count} periods = {total} minutes\n"
                                    f"Total: {count} periods · {total // 60}h {total % 60}min"),
        "genon_canonical": {
            "generated": datetime.now().strftime("%Y-%m-%d"),
            # ★ The EDITION this canonical belongs to (§2.2, 2026-08-27). Not the same
            # fact as `generated`: a chapter authored in January 2027 belongs to the
            # 2027-28 edition, and a chapter CARRIED forward keeps its old bytes under a
            # new year. Stamped at authoring time so no future backfill is ever needed —
            # aruvi-scripts/migrate_lp_year.py existed only to catch the 990 files
            # written before this line.
            # It is a LABEL, never part of the cache key: ledger_ts below is what keys a
            # derived plan's filename, which is what lets carry_over_year.py move an
            # unchanged chapter into a new edition without re-buying its variants.
            "academic_year": config.LP_YEAR,
            "schedule": f"{count}x{duration}",
            "constitution": const_label,
            "source": f"generate_canonical.py one {subject_folder} {grade_folder} {ch}",
            "ledger_ts": ts,
            "validation": ("clean" if status == "ok" else
                           f"{len(problems)} problem(s) — see genon/ledger.csv {ts}; "
                           f"review input for testing.md C3, not a block"),
        },
        "result": {
            "lesson_plan": parsed.get("lesson_plan", {}),
            "period_schedule": parsed.get("period_schedule"),
            "coverage_handoff": parsed.get("coverage_handoff", {}),
            # ★ `role_handoff` / `unit_handoff` REMOVED 2026-08-13 (founder ruling, S10 C3).
            # Both are RETIRED declarations — they went with Amendments A2/A3/A4 and the
            # partition engine, and testing.md §1 lists them under "never tested again;
            # never reintroduced". No live constitution has defined either since, so the
            # models stopped emitting them and these two lines were writing `{}` into every
            # canonical: a retired key, present and empty, in the one artefact class that
            # reaches the cloud. Found on the ch 8 library, which carries both on all three
            # files. Nothing READS them off a new canonical — `compile.py` and `api/data.py`
            # still read them where they are POPULATED, which only prototype- and v1.3-era
            # saved plans are, and those are untouched by this.
            "assessment_items": parsed.get("assessment_items", []) or [],
            "competency_gap_note": parsed.get("competency_gap_note", ""),
            "section_coverage_note": parsed.get("section_coverage_note"),
        },
    }
    dest.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

    # ── PURGE THE DERIVED PLANS (2026-08-12, S11 · C10, ARV-D-137) ───────────────────
    # A canonical that changes invalidates every served plan built from it, and until now
    # only the REPAIR tools said so: `purge_derived` was wired into normalize_options,
    # repair_register, repair_anchors, repair_leaked_deliberation and repair_item_type —
    # every repair, and no generator.
    #
    # The reasoning that left the generator out was that regenerating mints a new
    # `ledger_ts`, so the cache key moves and no stale file can be hit
    # (`api/data.canonical_version`). That holds for the CHOSEN variant and fails for a
    # LENDER: a served plan can carry a unit BORROWED from another canonical, and the key
    # names only the variant that was served. Measured at S11's C10 after the top was
    # re-authored to remove ARV-D-136 — the X=11 and X=15 plans key on p10 and p14, whose
    # versions did not move, so both would have been served from cache still carrying the
    # withdrawn synthesis text: the two serves the re-author existed to fix.
    #
    # Same remedy as every repair tool, for the same reason, and the cost is the one
    # already accepted in purge_derived's own header — a teacher holding a purged plan
    # loses that file and re-prepares in ~11 ms. Deliberately unconditional: working out
    # whether THIS canonical lends to any existing plan means reading every derived file
    # and re-running the choice set, which is more machinery than deleting cheap artefacts.
    try:
        sys.path.insert(0, str(HERE))
        from purge_derived import purge
        purge(subject_folder, grade_folder, ch,
              reason=f"re-authoring {fname}", apply=True)
    except SystemExit:
        # purge exits non-zero when a file cannot be removed (read-only mount). The
        # canonical is already installed and correct; surfacing the failure must not undo
        # that, so it is reported and the install stands.
        print("  WARNING: derived plans could not be purged — delete them by hand before "
              "serving this chapter, or the cache will hand back pre-regeneration bytes.")
    except Exception as e:                                       # noqa: BLE001
        print(f"  WARNING: derived-plan purge skipped ({e}). Delete "
              f"ch_{ch:02d}_<matrix>_e*_c*.json by hand before serving this chapter.")
    return dest


def log_ledger(row: dict) -> None:
    new = not LEDGER.exists()
    with LEDGER.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(row.keys()))
        if new:
            w.writeheader()
        w.writerow(row)


# The founder's unified cost notebook (2026-07-25): every paid run ALSO appends to
# THIS repo's runtime_data/token_log.csv (fresh log started 2026-07-25, seeded with
# the first ch 5 canonical run; the pre-genon prototype history is archived
# alongside as token_log_old.csv). Best-effort — bookkeeping never breaks a run.
TOKEN_LOG = REPO / "runtime_data" / "token_log.csv"
_TOKEN_LOG_HEADER = ("timestamp,call_type,subject,grade,chapter_number,chapter_title,"
                     "input_tokens,output_tokens,total_tokens,cost_inr,"
                     "cache_write_input_tokens,cache_read_input_tokens")


def log_token_log(call_type, subject, grade, ch, title, it, ot, cost_inr,
                  cache_write: int = 0, cache_read: int = 0) -> None:
    """★ THE TWO CACHE COLUMNS WERE HARD-CODED TO 0 (fixed 2026-08-20).

    The header has carried `cache_write_input_tokens,cache_read_input_tokens` since the
    log was started, and this writer emitted a literal `0, 0` into both on every row —
    so the columns were a constant, not a measurement, and nothing upstream knew.

    It cost two waves of wrong analysis. S8's W1 and W2 were both read as "the cache
    never engaged" (98 runs, both columns 0 in the ledger) and recorded that way in the
    tracker, and it was flagged as the campaign's largest unclaimed saving. The collect
    output for mathematics v ch 1 p07 settled it: `cache: 7,880 read (0.1x) · 4,430
    written (1.25x) · 4,939 fresh` printed to the terminal for the very request whose
    ledger row says 0 and 0. The cache was working the whole time.

    Worth keeping as a general lesson: a column that is always zero looks exactly like a
    feature that never fires, and the pricing maths downstream is right either way, so
    nothing else in the pipeline could contradict it. `batch_api` already computes both
    values correctly for its own cost arithmetic (`it_billed = fresh + 1.25*c_write +
    0.1*c_read`) — they simply never reached here."""
    try:
        TOKEN_LOG.parent.mkdir(parents=True, exist_ok=True)
        if not TOKEN_LOG.exists():
            TOKEN_LOG.write_text(_TOKEN_LOG_HEADER + "\n", encoding="utf-8")
        with TOKEN_LOG.open("a", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow([
                datetime.now().isoformat(timespec="seconds"), call_type, subject, grade,
                ch, title, it, ot, it + ot, round(cost_inr, 4),
                int(cache_write or 0), int(cache_read or 0),
            ])
    except Exception:
        pass


# ── THE TWO HALVES OF A GENERATION, EXTRACTED (2026-08-12, for the batch path) ──
# `cmd_one` used to be one block: build the prompt, call the model, post-process the
# answer. The Message Batches path needs the FIRST and THIRD halves and replaces only
# the middle (one async submit for many chapters instead of one blocking stream), so the
# two halves are functions now and `cmd_one` is their first caller. Nothing about the
# sync path's behaviour changes — this is a move, not a rewrite. The alternative was a
# second copy of the parse/validate/install/log sequence in the batch script, which is
# the 2026-08-11 lesson ("two copies of a heuristic are one bug waiting") applied to the
# one code path where the bug would be a silently mis-installed paid artefact.

def prepare_job(subject_folder: str, grade_folder: str, ch: int, *, periods=None,
                duration=None, title=None, variant=None, brief=None, lp_only=False,
                lp_const=None, assess_const=None, quiet=False) -> dict | None:
    """Everything up to (not including) the API call. Returns the job dict the caller
    sends however it likes; None on a refusal (message already printed to stderr)."""
    subject = FOLDER_TO_SUBJECT[subject_folder]
    grade = f"Grade {ROMAN[grade_folder]}"

    mp_row = master_plan_entry(subject_folder, grade_folder, ch)
    duration = duration or std_duration(grade_folder)
    count = periods or (mp_row and mp_row["recommended_periods"])
    if variant:
        if not brief:
            print("--variant requires --brief (genon/variant_plans.py brief ...)", file=sys.stderr)
            return None
        count = periods or variant
    if not count:
        print("No period count: not in master_plan.json — pass --periods.", file=sys.stderr)
        return None
    if mp_row and mp_row.get("placeholder"):
        print(f"REFUSING: chapter {ch} is a placeholder (awaiting NCERT release).", file=sys.stderr)
        return None

    title = title or (mp_row and str(mp_row["title"]).split(": ", 1)[-1]) or ""
    chapter = {"chapter_number": ch, "chapter_title": title}
    paths = pa.resolve_paths(grade, subject, ch)
    if lp_const:
        paths["lp_constitution"] = Path(lp_const)
    if assess_const:
        paths["assessment_const"] = Path(assess_const)
    for k, p in paths.items():
        if not Path(p).exists() and not (k == "assessment_const" and lp_only):
            print(f"MISSING input {k}: {p}", file=sys.stderr)
            return None

    period_sched = pa.standard_row_schedule(duration, count)
    system_blocks, user_blocks = pa.build_lpa_prompts(
        grade, subject, chapter, period_sched, paths,
        include_assessment=not lp_only,
    )

    if brief:
        brief_text = Path(brief).read_text(encoding="utf-8")
        user_blocks = [{"type": "text", "text": brief_text}] + list(user_blocks)

    lp_text = Path(paths["lp_constitution"]).read_text(encoding="utf-8")
    expect_v11 = "RULE 14" in lp_text
    lp_v = const_version(paths["lp_constitution"])
    as_v = "" if lp_only else const_version(paths["assessment_const"])
    const_label = f"LP v{lp_v}" + (f" / assessment v{as_v}" if as_v else " (LP only)")
    sys_chars = sum(len(b["text"]) for b in system_blocks)
    usr_chars = sum(len(b["text"]) for b in user_blocks)
    if not quiet:
        print(f"{subject} · {grade} · ch {ch} — {count} × {duration} min "
              f"({'LP+A' if not lp_only else 'LP only'}; "
              f"constitution {'pre-serve (carries RULE 14)' if expect_v11 else 'serve-era'})")
        print(f"  schedule : {period_sched.splitlines()[-1]}")
        print(f"  system   : {sys_chars:,} chars   user: {usr_chars:,} chars")
    return {
        "subject_folder": subject_folder, "grade_folder": grade_folder, "ch": ch,
        "subject": subject, "grade": grade, "title": title,
        "count": count, "duration": duration, "variant": variant, "lp_only": lp_only,
        "system_blocks": system_blocks, "user_blocks": user_blocks,
        "const_label": const_label, "expect_v11": expect_v11,
        "max_tokens": MAX_TOKENS_LP_ONLY if lp_only else MAX_TOKENS_LPA,
        "sys_chars": sys_chars, "usr_chars": usr_chars,
    }


def finish_generation(job: dict, full: str, it: int, ot: int, elapsed: float, *,
                      model: str, ts: str, mode: str = "one", tag: str = "",
                      no_install: bool = False, price_mult: float = 1.0,
                      cost_inr: float | None = None,
                      cache_write: int = 0, cache_read: int = 0) -> tuple[str, list[str]]:
    """Everything after the model answers: raw file, parse+repair, validate, install,
    ledger, token log. `price_mult` is 0.5 on the Message Batches path — the ONE thing
    that legitimately differs between the two callers."""
    subject_folder, grade_folder = job["subject_folder"], job["grade_folder"]
    ch, count, duration = job["ch"], job["count"], job["duration"]
    if cost_inr is None:
        cost_inr = (it * USD_PER_M_INPUT + ot * USD_PER_M_OUTPUT) / 1e6 * INR_PER_USD * price_mult
    out_dir = OUT_DIR / subject_folder / grade_folder
    out_dir.mkdir(parents=True, exist_ok=True)
    ftag = f"_{tag}" if tag else ""

    raw_path = out_dir / f"ch_{ch:02d}{ftag}_{ts}_raw.txt"
    raw_path.write_text(full, encoding="utf-8")

    parsed, problems, repairs = parse_with_repair(full)
    if parsed is not None:
        problems = validate(parsed, count, job["expect_v11"])
        if repairs:
            print(f"  auto-repaired {len(repairs)} naked inner quote(s): "
                  + "; ".join(repr(r) for r in repairs[:4]))
    elif not problems:
        problems = ["output is not valid JSON"]
    status = "ok" if not problems else "problems"
    repair_note = [f"auto-repaired {len(repairs)} naked quotes"] if repairs else []
    if parsed is not None:
        canon_path = out_dir / f"ch_{ch:02d}{ftag}_{ts}_canonical.json"
        canon_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  saved    : {canon_path}")
        if not job["lp_only"] and not tag and not no_install:
            installed = install_canonical(parsed, subject_folder, grade_folder, ch,
                                          ts, duration, count, job["const_label"],
                                          status, problems, variant=job["variant"])
            print(f"  installed: {installed}"
                  + ("" if status == "ok" else "  (validator findings recorded, not blocking)"))
    print(f"  tokens   : {it:,} in / {ot:,} out · ₹{cost_inr:.2f} · {elapsed:.1f}s · {status}")
    for p in problems:
        print(f"  ⚠ {p}")

    log_token_log("variant_generation" if job["variant"] else "canonical_generation",
                  subject_folder, grade_folder, ch, job["title"], it, ot, cost_inr,
                  cache_write=cache_write, cache_read=cache_read)
    log_ledger({
        "ts": ts, "mode": mode, "tag": tag, "model": model,
        "variant": job["variant"] or "",
        "subject": subject_folder, "grade": grade_folder, "chapter": ch,
        "schedule": f"{count}x{duration}", "lp_only": job["lp_only"],
        "constitution": job["const_label"],
        "input_tokens": it, "output_tokens": ot,
        "cost_inr": round(cost_inr, 2), "seconds": round(elapsed, 1),
        "status": status, "problems": "; ".join(repair_note + problems)[:400],
        "raw_file": raw_path.name,
    })
    return status, problems


def cmd_one(args) -> int:
    subject_folder = args.subject
    grade_folder = args.grade.lower()
    ch = args.chapter
    job = prepare_job(subject_folder, grade_folder, ch, periods=args.periods,
                      duration=args.duration, title=args.title, variant=args.variant,
                      brief=args.brief, lp_only=args.lp_only, lp_const=args.lp_const,
                      assess_const=args.assess_const)
    if job is None:
        return 2
    system_blocks, user_blocks = job["system_blocks"], job["user_blocks"]
    count, duration = job["count"], job["duration"]

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    tag = f"_{args.tag}" if args.tag else ""
    out_dir = OUT_DIR / subject_folder / grade_folder
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.dry:
        dump = out_dir / f"ch_{ch:02d}{tag}_{ts}_promptdump.json"
        dump.write_text(json.dumps(
            {"model": args.model, "max_tokens": MAX_TOKENS_LP_ONLY if args.lp_only else MAX_TOKENS_LPA,
             "system": system_blocks, "messages": [{"role": "user", "content": user_blocks}]},
            ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  DRY RUN — prompt dump: {dump}")
        return 0

    import anthropic  # only needed live
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        # standard fallback (2026-08-01): a git-ignored key file, so Cowork skill
        # sessions need no shell-profile plumbing. Never print or log the key.
        kf = REPO / "runtime_data" / "anthropic.key"
        if kf.is_file():
            key = kf.read_text(encoding="utf-8").strip()
    if not key:
        print("No API key: set ANTHROPIC_API_KEY, or put the key (one line) in "
              "runtime_data/anthropic.key (git-ignored via *.key).", file=sys.stderr)
        return 2
    client = anthropic.Anthropic(api_key=key)
    max_tokens = MAX_TOKENS_LP_ONLY if args.lp_only else MAX_TOKENS_LPA
    t0 = time.time()
    with client.messages.stream(
        model=args.model,
        max_tokens=max_tokens,
        system=system_blocks,
        messages=[{"role": "user", "content": user_blocks}],
    ) as s:
        # Live progress: chars streamed + rough period counter + elapsed,
        # updated in place. ~4 chars/token; periods counted by their key
        # appearing in the stream.
        parts = []
        chars = 0
        last = 0.0
        for chunk in s.text_stream:
            parts.append(chunk)
            chars += len(chunk)
            now = time.time()
            if now - last >= 1.0:
                last = now
                mm, ss = divmod(int(now - t0), 60)
                sofar = "".join(parts)
                # Stage-aware progress: periods → coverage handoff → role handoff →
                # assessment items (schema emission order). period_number also appears
                # on handoff LO rows, so the period counter is capped at the schedule;
                # items are counted by their period_ref key, which only items carry.
                ai = sofar.find('"assessment_items"')
                if ai != -1:
                    # Count `question_type` (every subject's item schema has one), not
                    # `period_ref`: handoff-bridged stages anchor by section/stage number
                    # and science·middle is FORBIDDEN period_ref outright (assessment
                    # v1.4), so the old key made the live counter read 0 for a whole
                    # six-minute run while items were streaming perfectly.
                    n_items = max(sofar.count('"question_type"', ai),
                                  sofar.count('"period_ref"', ai))
                    stage = f"periods {count}/{count} · assessment item {n_items}"
                # (a `"role_handoff"` branch sat here until 2026-08-13; the sketch no longer
                # asks for the key, so it could never fire again)
                elif '"coverage_handoff"' in sofar:
                    n_los = max(0, sofar.count('"period_number"') - count)
                    stage = f"periods {count}/{count} · handoff LO {n_los}"
                else:
                    done = sofar.count('"period_number"')
                    stage = f"period {min(done, count)}/{count}"
                sys.stderr.write(
                    f"\r  streaming: {chars:>8,} chars · ~{chars // 4:>6,} tokens · "
                    f"{stage} · {mm:02d}:{ss:02d}   "
                )
                sys.stderr.flush()
        sys.stderr.write("\n")
        full = "".join(parts)
        final = s.get_final_message()
    elapsed = time.time() - t0
    it, ot = final.usage.input_tokens, final.usage.output_tokens
    # Simultaneous install into the live library (founder, 2026-07-29): the live
    # environment has no certification gate. Skipped for --lp-only (incomplete
    # artefact), --tag (control runs must not touch the library), --no-install.
    status, problems = finish_generation(
        job, full, it, ot, elapsed, model=args.model, ts=ts, mode="one",
        tag=args.tag or "", no_install=args.no_install)
    return 0 if status == "ok" else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    one = sub.add_parser("one", help="single supervised sync generation")
    one.add_argument("subject", choices=sorted(FOLDER_TO_SUBJECT))
    one.add_argument("grade", help="grade folder, e.g. ix")
    one.add_argument("chapter", type=int)
    one.add_argument("--periods", type=int, help="override period count (default: master plan)")
    one.add_argument("--duration", type=int, help="override duration (default: class standard)")
    one.add_argument("--title", help="override chapter title")
    one.add_argument("--lp-only", action="store_true", help="LP only (no assessment)")
    one.add_argument("--lp-const", help="override LP constitution path (control tests)")
    one.add_argument("--assess-const", help="override assessment constitution path")
    one.add_argument("--model", default=GENERATION_MODEL)
    one.add_argument("--tag", help="filename/ledger tag, e.g. control_v10")
    one.add_argument("--brief", help="variant brief file (from `genon/variant_plans.py "
                     "brief ...`); prepended verbatim to the user prompt as a binding block")
    one.add_argument("--variant", type=int, help="compact-variant period count KK: implies "
                     "--periods KK, installs as ch_NN_canonical_pKK.json, logs as "
                     "variant_generation; requires --brief")
    one.add_argument("--no-install", action="store_true",
                     help="write genon/out only; skip the simultaneous library install")
    one.add_argument("--dry", action="store_true", help="assemble + dump prompt, no API call")
    one.set_defaults(fn=cmd_one)
    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
