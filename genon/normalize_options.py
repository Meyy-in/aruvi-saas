#!/usr/bin/env python3
"""normalize_options.py — the MCQ option arrangement, moved out of prose into code (v1.0, 2026-08-03).

WHY THIS EXISTS. Rule 7's arrangement convention ("author the four options first; then, as the
LAST step before emitting the item, arrange all four alphabetically from the first word at which
they differ, and label them A–D in that order") is a SORT. It was asked of the model in prose
through four constitution versions and one ₹6 probe, and the failure rate went UP:

    v1.1 (2026-07-16)  the old "vary the position" rule   5 of 6 correct answers on B
    v1.5 library (2026-08-01)                             10 of 18 not arranged
    v1.6 library (2026-08-03)                             15 of 18 not arranged   ← ARV-D-032

with the correct option landing at A or B on 16 of 18 and never at D — a guessable answer key,
which is teacher-visible wrongness (S2), not contract drift. The break sits at word 2–4 of the
option text in 11 of the 15: exactly where lexicographic comparison stops being visual and
becomes an algorithm, 26k output tokens into a creative task.

FOUNDER RULING 2026-08-03: enforce it here and STRIKE the sentence from the constitution
(SS·secondary assessment v1.6 → v1.7). A rule the pipeline enforces spends prompt tokens for
nothing, and naming the arrangement at all keeps position salient to a model that should never
be reasoning about position.

HOW THIS DIFFERS FROM repair_register.py, and why it may be automatic where that one may not.
repair_register declares every edit as a stated (old → new) pair because a register fix needs a
human to decide which clause dies. An option sort needs no judgement: the output is a pure
function of the input, so it is applied automatically. The line both tools share is that NEITHER
authors text. Here, option `text` and `is_correct` are never touched — only the array order, the
labels, and the guide keys that point at those labels.

WHAT IT USED TO DO AND NO LONGER DOES: record. Until 2026-08-04 every run appended a
genon_canonical.repairs[] entry with the per-item move detail, on the theory that the count would
eventually say whether the model had learned to arrange options unaided. FOUNDER RULING
2026-08-04: it never did — four constitution versions and a probe moved the rate the WRONG way
(5/6-on-B → 10 of 18 → 15 of 18), which is precisely why the sort was moved into code. There is
no outside authority to report to and no path from this data back into the model, so the record
was weight in every canonical and nothing else. It is removed from the artefacts and no longer
written. The run still PRINTS its count, which is free; read it on the first pass of a freshly
generated library, where it means something, and ignore it on a re-run, where 0 only means there
was nothing left to move. repairs[] itself stays — repair_register.py and repair_anchors.py write
declared human judgements, which is a different thing from a pure function of the input.

    python3 genon/normalize_options.py <subject> <grade> <chapter>          # apply
    python3 genon/normalize_options.py <subject> <grade> <chapter> --list   # dry run
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent

TOOL = "genon/normalize_options.py v1.0"

# An option that talks about another option's LABEL cannot be reordered without rewriting it —
# and rewriting is authoring, which this tool must never do. Such items are skipped and reported.
CROSSREF = re.compile(r"\b(option|options)\s+[A-D]\b|\b(both|either|neither)\s+[A-D]\b"
                      r"|\b[A-D]\s+and\s+[A-D]\b|\ball of the above\b|\bnone of the above\b", re.I)

# The option must OPEN with the number ("23.5°N", "1,200 mm"). Deliberately strict: an earlier
# draft skipped leading non-digits, so "Arctic Circle (66.5°N) and…" read as numeric and a
# correctly-arranged prose item was re-sorted by a latitude buried mid-sentence.
NUMERIC = re.compile(r"^\s*([-+]?\d[\d,]*\.?\d*)")

# A FLAT label — one question, one option set. Anything else means the labels are GROUPED
# ("1A"–"1D" for sub-question 1, "2A"–"2D" for sub-question 2) and the grouping is
# load-bearing: sorting all the texts as one list moves options ACROSS the sub-question
# boundary while the label sequence stays put, so sub-question 1's labels end up holding
# sub-question 2's answers. That is ARV-D-156 (english·ix ch 5 Q-LST-A-1, 2026-08-14), and
# it was invisible to certification because the result IS in arrangement order — faithfully,
# and wrongly. The sort has no way to know where one group ends, so it must not try.
FLAT_LABEL = re.compile(r"^[A-Da-d1-9]$")



def _numeric_key(text):
    """Ascending numeric key when an option OPENS with a number; None when it does not."""
    m = NUMERIC.match(text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def _word_key(text):
    """'Alphabetically from the first word at which they differ' — compared word by word,
    case-insensitively, with surrounding punctuation ignored so that 'high-pressure,' and
    'high-pressure' sort together."""
    return [w.lower().strip(".,;:!?'\"()[]—–-") for w in text.split()]


def sort_options(options):
    """Return options in arrangement order. Numeric ascending when EVERY option leads with a
    number (a mixed set falls back to words, which is what the constitution's 'ascending where
    they are numeric' means in practice)."""
    nums = [_numeric_key(o["text"]) for o in options]
    if all(n is not None for n in nums):
        return [o for _, o in sorted(zip(nums, options), key=lambda p: p[0])]
    return sorted(options, key=lambda o: _word_key(o["text"]))


def skip_reason(item):
    """Why this item must not be arranged, or None when it may be. THE SINGLE RULE — both the
    normalizer and certify()'s `unarranged` gate ask it, so a file this tool refuses can never
    be failed by the gate for still being unarranged. They disagreed once (2026-08-14): the
    guard below landed in `normalize_item` only, and the gate went on applying the flat sort to
    the very item the normalizer had just declined, so a correctly repaired compound MCQ would
    have FAILED certification in perpetuity with no legal way to pass."""
    opts = item.get("options") or []
    if len(opts) < 2:
        return ""                                       # nothing to arrange; not a refusal
    if any(CROSSREF.search(o.get("text", "")) for o in opts):
        return "cross-references an option label — left untouched, needs a human"
    # A compound item (grouped labels, or one correct answer per sub-question) cannot be
    # sorted as a single list — see FLAT_LABEL. Refuse it; do not partially arrange it.
    bad = [str(o.get("label")) for o in opts if not FLAT_LABEL.match(str(o.get("label", "")))]
    if bad:
        return (f"grouped option labels {sorted(set(bad))} — a compound item, "
                f"arrangement would cross its sub-question boundary; needs a human")
    # Scoped to MCQ deliberately. A TRUE_FALSE statement list legitimately marks several
    # entries true, so "more than one correct" only signals a compound item for the type
    # whose distractors Rule 7 arranges. (Whether STEP 6 should be sorting TRUE_FALSE
    # statements at all is a separate, open question — it does today, and this guard
    # deliberately does not change that.)
    if item.get("question_type") == "MCQ" and sum(1 for o in opts if o.get("is_correct")) > 1:
        return ("more than one correct option on an MCQ — a compound item; "
                "arrangement would cross its sub-question boundary; needs a human")
    return None


def normalize_item(item):
    """Arrange one item's options in place. Returns (changed, detail) where detail records the
    label movement, or (False, reason) when the item is skipped."""
    opts = item.get("options") or []
    reason = skip_reason(item)
    if reason is not None:
        return False, (reason or None)

    labels = sorted(o["label"] for o in opts)          # A–D, or 1–4 where a stage uses digits
    before = [o["label"] for o in opts]
    order_before = list(opts)
    arranged = sort_options(opts)
    if arranged == order_before and before == labels:
        return False, None                              # already arranged — idempotent no-op

    # the map from an option's OLD label to its NEW one, keyed by identity, so the guide follows
    remap = {}
    for new_label, opt in zip(labels, arranged):
        remap[opt["label"]] = new_label
    for new_label, opt in zip(labels, arranged):
        opt["label"] = new_label
    item["options"] = arranged

    # THE GUIDE LIVES IN TWO PLACES, AND THIS ONLY KNEW ONE (2026-08-10, S7 · C3).
    #
    #   guide[QUESTION_TYPE].what_each_option_reveals   constitution family — science, SS,
    #                                                   TWAU, and maths SECONDARY (the hybrid)
    #   teacher_guide.what_each_option_reveals          maths MIDDLE + PREPARATORY, per the
    #                                                   registry spec's maths column
    #
    # Reading only the first meant that on maths·middle the options were sorted and relabelled
    # while their diagnostics stayed keyed to the OLD labels — so the teacher's "what this
    # choice reveals" line described a different option than the one beside it. On ch 7 the
    # CORRECT answer carried the text "Same misconception as A — the student picks the other
    # adjacent side." That is worse than a missing diagnostic: it is a confident wrong one, on
    # the answer the class got right.
    #
    # Fourth recurrence of the container-shape class (science's `questions` wrapper at S3,
    # carriers.raw_item_list and extract_determinate.py at S7). Both paths are remapped now,
    # and the lookup is by SHAPE — any dict of label→text under either key — never by subject.
    for block in (item.get("teacher_guide"), (item.get("guide") or {}).get(item.get("question_type"))):
        if not isinstance(block, dict):
            continue
        reveals = block.get("what_each_option_reveals")
        if isinstance(reveals, dict) and reveals:
            block["what_each_option_reveals"] = {remap.get(k, k): v for k, v in reveals.items()}

    correct = next((o["label"] for o in arranged if o.get("is_correct")), None)
    # `came_from` reads positionally: the label each NEW slot's option used to carry, so
    # "BADC" means the option now at A was authored as B. `labels_before` is kept for the
    # degenerate case where the labels themselves were out of sequence.
    inverse = {v: k for k, v in remap.items()}
    return True, {"labels_before": before,
                  "came_from": [inverse[o["label"]] for o in arranged],
                  "correct_before": next((k for k, v in remap.items()
                                          if v == correct), None),
                  "correct_now": correct}


def _items_of(doc):
    """The LIVE item list — this tool mutates items in place and writes the file back.

    Via the carrier seam (2026-08-05): only SS and TWAU keep a flat list under
    `assessment_items`. Science secondary wraps its items under a "questions" key, and
    reading the wrapper directly iterated its KEY NAMES, killing STEP 6 with
    `'str' object has no attribute 'get'`.
    """
    sys.path.insert(0, str(REPO))
    from aruvi_core.genon.carriers import raw_item_list       # noqa: E402
    return raw_item_list(doc.get("result", doc))


def normalize_file(path, apply=True):
    """Arrange every MCQ in one library file. Returns a report dict; writes only when apply."""
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    items = _items_of(doc)
    moved, skipped, scanned = [], [], 0
    for n, item in enumerate(items, 1):
        if not (item.get("options") or []):
            continue
        scanned += 1
        changed, detail = normalize_item(item)
        if changed:
            # `anchor` is a display label, not a join — the handoff-bridged subjects carry
            # no period_ref at all (science secondary's constitution forbids it), which is
            # what crashed this report with 'NoneType' object is not subscriptable.
            from aruvi_core.genon.carriers import item_anchor_label   # noqa: E402
            moved.append({"item": n, "competency": item.get("competency", {}).get("c_code"),
                          "anchor": item_anchor_label(item, n), **detail})
        elif detail:
            skipped.append({"item": n, "reason": detail})

    rep = {"file": Path(path).name, "scanned": scanned,
           "moved": len(moved), "skipped": skipped, "detail": moved}
    if apply and moved:
        # NOTHING IS RECORDED IN THE ARTEFACT (founder ruling 2026-08-04). This step used to
        # append a genon_canonical.repairs[] entry carrying the per-item move detail, on the
        # theory that the count would eventually say whether the model had learned to arrange
        # options unaided. It never did: four constitution versions and a probe took the rate
        # from 5/6-on-B to 15 of 18 unarranged (ARV-D-032), which is why the sort moved into
        # code in the first place. There is no outside authority to report to and no path from
        # this data back into the model, so the record was pure weight in every canonical.
        # The run-time report below still prints THIS run's count; repairs[] stays in use by
        # repair_register.py and repair_anchors.py, whose edits are declared judgements rather
        # than a pure function of the input.
        Path(path).write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    return rep


def library_files(subject, grade, ch):
    # ★ PATH FIX 2026-10-02: the served library is DATA_DIR/saved_plans/<s>/<g>/<LP_YEAR>
    # (restructures of 2026-08-23 and 2026-08-27) — the same place build_library certifies.
    if str(REPO) not in sys.path:
        sys.path.insert(0, str(REPO))
    from api import config  # noqa: PLC0415
    d = Path(config.DATA_DIR) / "saved_plans" / subject / grade / config.LP_YEAR
    return sorted(d.glob(f"ch_{ch:02d}_canonical*.json"))


def normalize_library(subject, grade, ch, apply=True, backup=True):
    """The stage build_library.py calls. Returns (report_lines, total_moved, total_scanned)."""
    files = library_files(subject, grade, ch)
    if not files:
        return [f"NOTE  no library files for {subject} {grade} ch {ch}"], 0, 0
    if apply and backup:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        bdir = REPO / "backup" / "option_normalize" / stamp
        bdir.mkdir(parents=True, exist_ok=True)
        for f in files:
            shutil.copy2(f, bdir / f.name)

    lines, total, scanned = [], 0, 0
    for f in files:
        rep = normalize_file(f, apply=apply)
        total += rep["moved"]
        scanned += rep["scanned"]
        lines.append(f"      {rep['file']}: {rep['moved']} of {rep['scanned']} item(s) re-ordered")
        for e in rep["detail"]:
            lines.append(f"          #{e['item']} {e['competency']} {e['anchor']}: "
                         f"A–D now hold {''.join(e['came_from'])} "
                         f"· correct {e['correct_before']} -> {e['correct_now']}")
        for s in rep["skipped"]:
            lines.append(f"          #{s['item']} SKIPPED — {s['reason']}")
    if apply and total:
        # A rewritten canonical invalidates the plans derived from it (ARV-D-034).
        from purge_derived import purge
        purge(subject, grade, ch, reason="genon/normalize_options.py")
    head = (f"options arranged: {total} of {scanned} item(s) re-ordered this run. "
            "Nothing is written to the artefact (founder ruling 2026-08-04), so a 0 here means "
            "only that nothing was left to move — on a re-run that is expected, and it is NOT "
            "evidence the model arranged them unaided. Read this number on the FIRST pass of a "
            "freshly generated library or not at all.")
    return [head] + lines, total, scanned


def unarranged(path):
    """Read-only check for certify(): item numbers whose options are not in arrangement order."""
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    bad = []
    for n, item in enumerate(_items_of(doc), 1):
        opts = item.get("options") or []
        if skip_reason(item) is not None:               # the same rule the normalizer applies
            continue
        if [o["text"] for o in opts] != [o["text"] for o in sort_options(list(opts))] \
           or [o["label"] for o in opts] != sorted(o["label"] for o in opts):
            bad.append(n)
    return bad


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 3:
        raise SystemExit(__doc__)
    subject, grade, ch = args[0], args[1].lower(), int(args[2])
    apply = "--list" not in sys.argv
    lines, total, scanned = normalize_library(subject, grade, ch, apply=apply)
    print(("APPLIED" if apply else "DRY RUN") + " · " + "\n".join(lines))
    if apply:
        left = sum(len(unarranged(f)) for f in library_files(subject, grade, ch))
        print(f"re-check: {left} item(s) still unarranged (expected 0)")
        return 0 if left == 0 else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
