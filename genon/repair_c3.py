#!/usr/bin/env python3
"""repair_c3.py v1.0 — 2026-08-09

Repairs the C3 defects that can be repaired without re-authoring, on an installed library.

Two kinds of pass, deliberately kept apart, because they scale differently:

  GENERIC passes derive the correct value from an AUTHORITATIVE SOURCE — the chapter summary,
  the Pedagogy document, the mapping JSON, the schema. They take no per-chapter input and are
  intended to run over the whole corpus at the mass pre-warm, exactly as STEP 6 does for option
  order. Adding a chapter costs nothing.

  DECLARED passes apply a hand-written table of old → new strings for one chapter. They do NOT
  generalise: a register phrasing or a word-count rewrite needs language, per instance. They are
  here so this chapter's repair is reproducible and auditable, and so the shared plumbing
  (backup · refuse-on-drift · declared repairs[] · idempotent) is written once.

Every pass refuses rather than guesses: if the value on disk matches neither the expected old
nor the already-repaired new, the file is left alone and the run reports it.

Run from the repo root:
    python3 genon/repair_c3.py mathematics ix 4 --dry-run
    python3 genon/repair_c3.py mathematics ix 4
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import pathlib
import re
import shutil
import sys

TOOL = "genon/repair_c3.py v1.0"
ROOT = pathlib.Path(__file__).resolve().parents[1]
# ★ PATH FIX 2026-10-02 (same fix extract_determinate.py and build_library.lib_dir_of got):
# libraries live at DATA_DIR/saved_plans/<s>/<g>/<LP_YEAR>/, summaries under data/authoring.
sys.path.insert(0, str(ROOT))
from api import config as _config                                  # noqa: E402
PLANS = pathlib.Path(_config.DATA_DIR) / "saved_plans"
CHAPTERS = pathlib.Path(os.environ.get("ARUVI_AUTHORING_DIR", ROOT / "data/authoring")) / "chapters"
BACKUP = ROOT / "backup/c3_repair"

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT))
from purge_derived import purge                                    # noqa: E402
from aruvi_core.genon import carriers as _carriers                 # noqa: E402

# The Pedagogy document's method names, verbatim. Source of truth for ARV-D-071.
PEDAGOGY_METHODS = ["Play-way", "Discovery/Inquiry", "Problem solving", "Inductive", "Deductive"]

# Rule 8's closing requirement, in the constitution's own words.
SUBSTITUTION_CLAUSE = (
    " The teacher may substitute any other format from the Mathematics open-task menu."
)

# Both forms observed in the corpus: a bare parenthetical "(E-3)" and a narrated one
# "(from E-1)". The book_ref always precedes it, so both are pure deletion.
ID_IN_PROSE = re.compile(r"\s*\((?:from\s+)?(?:WE|E)-\d+\)")


# =======================================================================================
# GENERIC PASSES — corpus-safe, source-derived, no per-chapter input
# =======================================================================================

def pass_method_label(result, ctx):
    """ARV-D-071 — pedagogical_method named exactly as the Pedagogy document writes it."""
    edits = []
    lookup = {m.lower(): m for m in PEDAGOGY_METHODS}
    for period in result["lesson_plan"]["periods"]:
        current = period.get("pedagogical_method") or ""
        correct = lookup.get(current.lower())
        if correct and correct != current:
            edits.append({"unit": period["period_number"], "field": "pedagogical_method",
                          "old": current, "new": correct})
            period["pedagogical_method"] = correct
    return edits


def pass_strip_internal_ids(result, ctx):
    """ARV-D-073 — Rule 9 P5: no WE-N / E-N in teacher-facing text; the book_ref is already
    there, so the parenthetical is pure deletion."""
    edits = []
    for period in result["lesson_plan"]["periods"]:
        unit = period["period_number"]

        for idx, band in enumerate(period.get("time_bands", [])):
            cleaned = ID_IN_PROSE.sub("", band["activity"])
            if cleaned != band["activity"]:
                edits.append({"unit": unit, "field": f"time_bands[{idx}].activity",
                              "old": band["activity"], "new": cleaned})
                band["activity"] = cleaned

        # `homework` IS NOT A LIST OF STRINGS ON EVERY STAGE (fixed 2026-08-19). At
        # mathematics·secondary — the stage this pass was written against — it is
        # `["Exercise 4.2 Q3 (E-1)", …]`. At preparatory and middle it is a list of task
        # DICTS ({id, intent, method, section_ref, book_ref, description}), so `sub()`
        # raised TypeError on the first period of the first file, taking the whole run
        # down before any pass could report. Found by running the corpus-wide stem-deixis
        # pass, which is the first thing that ever called this tool on prep maths.
        # The id-in-prose defect lives in `description` on that shape, so both are handled.
        for idx, item in enumerate(period.get("homework", [])):
            if isinstance(item, dict):
                text = item.get("description")
                if not isinstance(text, str):
                    continue
                cleaned = ID_IN_PROSE.sub("", text)
                if cleaned != text:
                    edits.append({"unit": unit, "field": f"homework[{idx}].description",
                                  "old": text, "new": cleaned})
                    item["description"] = cleaned
                continue
            if not isinstance(item, str):
                continue
            cleaned = ID_IN_PROSE.sub("", item)
            if cleaned != item:
                edits.append({"unit": unit, "field": f"homework[{idx}]",
                              "old": item, "new": cleaned})
                period["homework"][idx] = cleaned

        for field in ("teacher_notes", "activity_title"):
            cleaned = ID_IN_PROSE.sub("", period.get(field, ""))
            if cleaned != period.get(field, ""):
                edits.append({"unit": unit, "field": field,
                              "old": period[field], "new": cleaned})
                period[field] = cleaned
    return edits


def pass_verbatim_descriptions(result, ctx):
    """ARV-D-077 — A3: textbook item description is verbatim from the summary. The summary IS
    the authority, so this is a copy, not a judgement."""
    edits = []
    canon = ctx["summary_items"]
    for period in result["lesson_plan"]["periods"]:
        for idx, item in enumerate(period.get("textbook_items_in_class", [])):
            source = canon.get(item.get("id"))
            if not source:
                continue
            want = source.get("description")
            if want and item.get("description") != want:
                edits.append({"unit": period["period_number"],
                              "field": f"textbook_items_in_class[{idx}].description",
                              "old": item.get("description"), "new": want})
                item["description"] = want
    return edits


def pass_guide_shape(result, ctx):
    """ARV-D-083 — A1: 'Populate every field; empty strings and empty arrays are not permitted
    for required fields.' Rule 9 defines ONE guide sub-block per question type. Sub-blocks for
    other types are set to null, which is the shape the other two canonicals already use."""
    edits = []
    for pos, item in enumerate(iter_items(result), 1):
        guide = item.get("guide")
        if not isinstance(guide, dict):
            continue
        keep = item.get("question_type")
        for key, block in list(guide.items()):
            if key == keep or block is None:
                continue
            if isinstance(block, dict):
                empties = sum(1 for v in block.values() if v in ("", [], {}))
                # learning_outcome is a duplicate of the kept block's own; everything else in a
                # foreign block must be empty for it to be safely prunable. A foreign block
                # carrying real content is a different defect and is not ours to delete.
                substantive = {k: v for k, v in block.items() if k != "learning_outcome"}
                if any(v not in ("", [], {}, None) for v in substantive.values()):
                    continue
                edits.append({"item": pos, "field": f"guide.{key}",
                              "old": f"<{len(block)} keys, {empties} empty>", "new": None})
                guide[key] = None
    return edits


def pass_open_task_substitution(result, ctx):
    """ARV-D-082 — Rule 8 requires the guide to state that the teacher may substitute any other
    menu format. Fixed sentence, so it is computable.

    SUBJECT-GATED SINCE 2026-08-12 (S5), AND THE GATE IS THE POINT. This pass sits in the
    GENERIC list, whose contract is "derive the correct value from an AUTHORITATIVE SOURCE …
    intended to run over the whole corpus at the mass pre-warm". It is not generic. Its
    authority is MATHEMATICS' Rule 8 open-task menu, and `SUBSTITUTION_CLAUSE` says so in
    words — "any other format from the **Mathematics** open-task menu".

    Run on TWAU it proposed **nine edits across the library** (4 + 3 + 2), appending that
    sentence to OPEN_TASK guides on a stage whose Rule 8 is EXECUTABILITY BOUNDARY and which
    has no open-task menu to substitute from. That is not a no-op that happens to be
    harmless — it writes a false statement about a rule that does not exist, in another
    subject's vocabulary, into a certified artefact. Found only because S5 ran this tool for
    an unrelated declared repair; at the mass pre-warm it would have reached every non-maths
    OPEN_TASK guide in the corpus.

    The other four passes are safe on TWAU by accident rather than by design, and it is worth
    recording which is which: `pass_method_label` keys on `pedagogical_method`, a field TWAU's
    schema does not have (its equivalent is the closed five-value `dominant_mode`);
    `pass_strip_internal_ids` matches `WE-N`/`E-N`, which TWAU never emits (its internal ids
    are `T-N`, and the LP already forbids them); `pass_verbatim_descriptions` reads
    `enumerated_worked_examples`/`enumerated_exercises` off the summary, which TWAU summaries
    do not carry. Only `pass_guide_shape` is genuinely subject-agnostic. **When a fifth stage
    arrives, check each pass's AUTHORITY, not its behaviour on one file.**"""
    if ctx.get("subject") != "mathematics":
        return []
    edits = []
    for pos, item in enumerate(iter_items(result), 1):
        if item.get("question_type") != "OPEN_TASK":
            continue
        block = (item.get("guide") or {}).get("OPEN_TASK")
        if not isinstance(block, dict):
            continue
        rationale = block.get("format_rationale") or ""
        if "substitute" in rationale.lower():
            continue
        new = rationale.rstrip() + SUBSTITUTION_CLAUSE
        edits.append({"item": pos, "field": "guide.OPEN_TASK.format_rationale",
                      "old": rationale, "new": new})
        block["format_rationale"] = new
    return edits


def pass_stem_deixis(result, ctx):
    """ARV-D-188 — a stem that points at a stimulus the item does not carry is repointed
    at the textbook page the item's OWN `exercise` block already names.

    THE DEFECT (2026-08-19, S8 · W1, founder-found by reading a served plan). mathematics
    III ch 5 Q-A-1 reads *"On the dot grid below, draw a simple rangoli design…"* with
    `visual_stimulus: ""`. There is no dot grid. Detector, its four conditions and its
    subject scoping: `genon/stem_deixis.py`; the gate is C5 check 12.

    WHY THIS IS GENERIC AND NOT DECLARED, which is the whole reason it can run corpus-wide.
    The replacement is not written here — it is DERIVED from the item, in two steps that
    both read fields the item already carries:
      1. `exercise.book_ref` names the page ("Let us Do Q1, p.44");
      2. that page IS where the referent lives — the NCERT dot grid for Q1 is printed on
         p.44, which is why the item was anchored there in the first place.
    So the edit rewrites the POINTER and nothing else: `below` → `on p.44`. No judgement,
    no per-item language, no new content. Measured across the corpus, 38 of the 68 hits
    carry a usable page in their own `book_ref`.

    It is also what the constitutions already ask for. mathematics·middle Rule 9: *"the
    prompt should reference the textbook directly (e.g. 'Refer to Fig. 5.6 in §5.3 of your
    textbook')"*; english·preparatory Rule 9: *"The teacher has the book; the image lives
    there."* Prep maths states the same default in Rule 7 (`""`, figure reached through the
    `exercise` companion) — the model simply wrote the stem as though it had a figure.

    SUBJECT-GATED TO MATHEMATICS, and the gate is the point (the lesson `pass_open_task_
    substitution` records one line above). The detector only GATES on mathematics, for the
    reasons in `stem_deixis._GATES`: english's `below` is largely poem and story content
    and its referents live in spine-varying fields. An advisory finding must not be
    repaired automatically — the shortlist is ruled on at C7 by a reader.

    IT NEVER TOUCHES A T3 ITEM. Where no page is derivable the pass returns nothing and the
    item stays exactly as it is, reported by check 12 for a human. Rewriting a pointer with
    nowhere to point would replace a visible defect with an invisible one."""
    # NOT `iter_items` — it yields from `questions` / `assessment_items` and on the
    # goal-clustered stages (mathematics preparatory, middle) `assessment_items` is a list
    # of GROUPS, each with its own `items` list. On maths III ch 5 it returns 4 objects for
    # 30 items, and this pass silently found nothing on its first run. `stem_deixis._items`
    # walks to anything whose `id` starts with "Q-", whatever the container. Worth noting
    # that `pass_guide_shape` and `pass_open_task_substitution` share the blind spot.
    from stem_deixis import _items as walk_items, classify, tier      # noqa: PLC0415
    if ctx.get("subject") != "mathematics":
        return []
    edits = []
    for pos, item in enumerate(walk_items(result), 1):
        got = classify(item)
        if not got:
            continue
        ex = item.get("exercise") or {}
        hit = {"kind": got[0], "book_ref": ex.get("book_ref") or ""}
        if tier(hit) != "T1":
            continue                      # T2/T3 are not this pass's to touch
        page = _PAGE_IN_BOOKREF.search(hit["book_ref"])
        if not page:
            continue
        loc = _tidy_page(page.group(0))
        field = "item_stem" if item.get("item_stem") is not None else "prompt"
        old = item.get(field) or ""
        new = _repoint(old, loc)
        if new and new != old:
            edits.append({"item": pos, "field": field, "old": old, "new": new})
            item[field] = new
    return edits


# "p.44" · "p. 44" · "pp. 44" · "page 44" · "section 6.2"  → the locator to point at.
_PAGE_IN_BOOKREF = re.compile(r"\b(?:pp?\.?\s*\d+|page\s+\d+|section\s+\d+\.\d+)", re.I)


def _tidy_page(raw: str) -> str:
    """'p.44' / 'p. 44' / 'page 44' -> 'on p.44'; 'section 6.2' -> 'in section 6.2'.

    The PREPOSITION belongs to the locator, not to the template: one reads "on p.44" and
    the other "in section 6.2", and a template carrying a hardcoded "on" produced "the
    figure on section 6.2" on the first maths·middle file it touched."""
    s = raw.strip()
    if s.lower().startswith("section"):
        return "in " + re.sub(r"\s+", " ", s.lower())
    return "on p." + re.search(r"\d+", s).group(0)


# The pointer forms actually observed, each rewritten to name the page instead. Ordered
# longest-first so "the dot grid below" is not eaten by "below". Every replacement keeps
# the sentence grammatical and changes only WHERE the child is told to look.
_REPOINT = [
    (re.compile(r"\bon the dot grid below\b", re.I), "on the dot grid {loc}"),
    (re.compile(r"\bon the grid below\b", re.I), "on the grid {loc}"),
    (re.compile(r"\blook at the dot grid below\b", re.I), "look at the dot grid {loc}"),
    (re.compile(r"\bin the box(es)? below\b", re.I), "in the box {loc}"),
    (re.compile(r"\bin the space below\b", re.I), "in the space {loc}"),
    (re.compile(r"\bon the blank clock face below\b", re.I), "on the blank clock face {loc}"),
    (re.compile(r"\bthe (\w+(?:\s\w+)?) shown below\b", re.I), r"the \1 {loc}"),
    (re.compile(r"\bshown below\b", re.I), "shown {loc}"),
    (re.compile(r"\bthe two tens frames below\b", re.I), "the two tens frames {loc}"),
    # THREE words, not two (widened 2026-08-20, W2). "On the triangular dot paper below,
    # a cube has been started for you" left the only unrepairable T1 item in the wave —
    # the noun phrase is three words and the pattern allowed two, so a repair that had a
    # perfectly good page to point at (p.8) simply did not fire.
    (re.compile(r"\b(?:on|in) the ([\w-]+(?:\s[\w-]+){0,2}) below\b", re.I), r"on the \1 {loc}"),
    (re.compile(r"\blook at the ([\w-]+(?:\s[\w-]+){0,2}) below\b", re.I), r"look at the \1 {loc}"),
    (re.compile(r"\bthe ([\w-]+(?:\s[\w-]+){0,2}) below\b", re.I), r"the \1 {loc}"),
    (re.compile(r"\bbelow is (a|an|the) ([\w-]+(?:\s[\w-]+)?)\b", re.I),
     r"{loc} there is \1 \2"),
]


def _repoint(stem: str, loc: str) -> str:
    """Rewrite the FIRST pointer in the stem to name `loc`. One edit per stem: a second
    pointer in the same stem is a different sentence and is reported, not guessed at.

    CASE IS RESTORED FROM THE TEXT BEING REPLACED, not from the template. The patterns are
    case-insensitive so that one entry covers "On the dot grid below" and "on the dot grid
    below", but `expand` emits the template's own casing — which turned a sentence-initial
    "On the dot grid below, draw…" into "on the dot grid on p.44, draw…" on the first file
    it touched. If the span replaced began with a capital, so does its replacement."""
    for pat, rep in _REPOINT:
        m = pat.search(stem)
        if not m:
            continue
        new = m.expand(rep).format(loc=loc)
        if m.group(0)[:1].isupper() and new[:1].islower():
            new = new[0].upper() + new[1:]
        return stem[:m.start()] + new + stem[m.end():]
    return ""


def pass_synthesis_points_at_its_table(result, ctx):
    """ARV-D-187 — a re-authored closer whose teacher_notes never mention its own table.

    THE DEFECT. The maths·middle resynth (2026-08-19) moved the problems and their worked
    solutions OUT of teacher_notes and into a `visual_aids` table, so the Material tab
    carries them. The brief describes that table at length and never says the notes must
    POINT at it — and 36 of the 38 re-authored closers duly did not. A teacher reading the
    notes sees the sitting described and the mathematics absent, with nothing telling her
    where it went. Founder, 2026-08-20.

    WHY IT IS GENERIC. Nothing here is per-chapter: the sentence is fixed, and the only
    variable — the table's title — is read off the unit itself. That is this list's
    contract ("derive the correct value from an AUTHORITATIVE SOURCE … take no per-chapter
    input"), and it is why this is not 36 declared old→new pairs against 36 different
    opening sentences.

    It PREPENDS rather than splices, because where a sentence lands inside prose the model
    wrote is a judgement, and a pass that takes no per-chapter input has no business making
    one. First thing the teacher reads is where the problems are.

    Idempotent by inspection of the note, not by a flag: a unit whose notes already reach
    for the table in any of the observed forms is left alone. Science's polish pass settled
    the pointer convention — "(see material: '…')" — and this follows it, with the
    founder's own phrase carried in front.
    """
    edits = []
    for period in result["lesson_plan"]["periods"]:
        if period.get("synthesis") is not True:
            continue
        tables = [a for a in (period.get("visual_aids") or [])
                  if isinstance(a, dict) and a.get("type") == "table" and a.get("title")]
        if not tables:
            continue
        notes = period.get("teacher_notes") or ""
        if re.search(r"see material|Prepared Table|prepared table|see the table|table below",
                     notes):
            continue
        title = tables[0]["title"]
        pointer = (f"Refer to Prepared Table (see material: '{title}') for the problems in "
                   f"full and their worked solutions. ")
        # RECORD THE PREPEND AS A PREPEND (2026-08-20, F1 notes pass · ARV-D-256).
        # The first record shape wrote truncated old/new pairs that read as a
        # REPLACEMENT of the notes — and `repairs[]` is what corpus statistics use to
        # separate generation quality from repair quality, so a record that overstates
        # its edit corrupts that measurement. Nothing is removed by this pass: `old`
        # is None, `new` carries exactly and only the text added, and `op` says how.
        # The 46 pre-correction records across mathematics·middle were amended in
        # place the same day (see the campaign register entry).
        edits.append({"unit": period["period_number"], "field": "teacher_notes",
                      "op": "prepend", "old": None, "new": pointer})
        period["teacher_notes"] = pointer + notes
    return edits


GENERIC_PASSES = [
    ("ARV-D-187", "the re-authored closer's notes point at its own Material table",
     pass_synthesis_points_at_its_table),
    ("ARV-D-188", "stem repointed at the page its own exercise block names",
     pass_stem_deixis),
    ("ARV-D-071", "method label verbatim from the Pedagogy document", pass_method_label),
    ("ARV-D-073", "internal WE-N / E-N ids out of teacher-facing text", pass_strip_internal_ids),
    ("ARV-D-077", "textbook descriptions verbatim from the summary", pass_verbatim_descriptions),
    ("ARV-D-083", "one guide sub-block per question type; no empty required fields",
     pass_guide_shape),
    ("ARV-D-082", "Rule 8 substitution statement present in OPEN_TASK guides",
     pass_open_task_substitution),
]


# =======================================================================================
# DECLARED EDITS — this chapter only; each one needed language or a judgement
# =======================================================================================

# ARV-D-069 · the register's three bans. Forward reference and completion language rewritten to
#   stand on their own ground; the calendar word removed.
# ARV-D-070 · Rule 10 continuity by CONTENT, never by position. In every case the content is
#   already named, so the repair is deletion of the positional clause.
# KEYED BY (subject, grade) SINCE 2026-08-17 — the filename key was a live trap twice
# over: (a) running `repair_c3.py science vii 4` walked ch_04_canonical*.json and applied
# MATHEMATICS·IX's declarations to the science files (crashing on a handoff shape the
# maths rows assume), and (b) adding science·vii's own "ch_04_canonical_p09.json" entry
# silently SHADOWED the maths key — the duplicate-dict-key failure repair_meta_leak's
# wave-2 header documents. Same cure as repair_register v1.3: scope the set to the
# subject·grade the run names, and a foreign filename can never be reached.
DECLARED = {
  # ── S8 · mathematics · preparatory · BATCH WAVE 1 (2026-08-19) ───────────────────────
  # The two standards certification quarantined, each for one item, and both for the SAME
  # check — the declared-type gate that landed at this stage's own C4 with assessment v1.4
  # (ARV-D-113). This is that gate's first batch, and it is worth recording that the two
  # hits resolve in OPPOSITE directions: one stimulus is not a tick line and never was,
  # the other is a good tick line wearing labels that are too long. A single rule for
  # "number_line failures" would have got one of them wrong.
  # Both restored from backup/quarantine/ before these ran (runbook trap 1).
  # APPLIED 2026-08-19 and moved behind a 3-tuple key, which the 2-tuple lookup never
  # reaches — the same device the mathematics·ix W1/W2 sets use. Kept as the record.
  # ARV-D-187 in particular CANNOT be re-asserted even in principle: STEP 6 arranged
  # Q-C-2's options after it landed and remapped the reveals' dict keys with them
  # (B/C/D as declared -> B/A/C on disk), so the declared `new` no longer matches the
  # artefact. That is the normalizer doing its job, and it is why an applied authoring
  # entry must be retired rather than left in the live set to refuse noisily.
  ("mathematics", "iii", "APPLIED-20260819"): {
    # ARV-D-185 · iii ch 4 Q-A-2 declares `number_line:` on a pair of TENS FRAMES:
    # "[Frame 1: 8+4] | [Frame 2: 8−4]". Two cells against the ≥3 the contract needs —
    # but the count is the symptom, not the defect. A tens frame is a 2×5 GRID, and
    # Rule 7 forbids a tick line from being one ("the ticks are drawn as an ordered
    # line, never as a grid"); inline SVG is prohibited at this stage, so no permitted
    # format can carry the picture. Padding the strip to three cells would satisfy the
    # regex and still be the wrong representation, which is the direction runbook trap 4
    # exists to refuse. The tag goes, and the whole field with it — same reading as
    # ARV-D-179 at middle.
    #
    # NOTHING MATERIAL IS LOST, and it is checkable rather than asserted. The two frames
    # are not information the stimulus supplies; they are the layout the CHILD draws on,
    # and the item's own `prompt` already says so in full: "Draw dots on the two tens
    # frames below — one to show 8 + 4 and one to show 8 – 4. Then write the number
    # sentence for each." The `exercise` companion carries the teacher's page ("Let us
    # Do, p.30", 7 + 5 and 7 − 5 on the same frames). Rule 7's stated default — the
    # figure is reached through the companion block — is exactly this item's case.
    "ch_04_canonical.json": {
        "ARV-D-185": [
            {"item_where": {"id": "Q-A-2"},
             "field": "visual_stimulus",
             "old": "number_line: [Frame 1: 8+4] | [Frame 2: 8−4]",
             "new": ""},
        ],
    },
    # ★ ARV-D-187 · iii ch 5 Q-C-2 IS A SHELL, and this entry AUTHORS TEXT — read it
    # before certifying. Declared MCQ, `verified: false`, and it asks nothing: prompt "",
    # visual_stimulus "", options [], expected_answer "", method_one_line "",
    # what_each_option_reveals {}, and an inclusivity field carrying the generator's own
    # failure marker ("[Verification failed] Refer to the book task anchored to S5.").
    # The one thing the model did fill is the `exercise` companion — "Let us Do Q1, p.55 ·
    # Mark the square corners in these shapes" — so it knew what it meant to ask and
    # stopped. This is the defect the S8 pre-flight flagged as the stage's only
    # non-repairable one, and it has quarantined the pilot library on every certify run
    # since 2026-08-13.
    #
    # AUTHORED UNDER THE ARV-D-180 PRECEDENT (founder ruling 2026-08-19, one day old and
    # identical in shape): "generate an equivalent question" — equivalent to what the
    # shell was anchored on — rather than re-buying a 14-period standard and the two
    # compacts whose briefs are built from its registry. THE FOUNDER SHOULD READ THIS ITEM
    # AT THE HUMAN GATE. It is the one place in the stage where text was written rather
    # than repaired, and `verified` is deliberately left FALSE: this has not been through
    # a verification pass and must not claim it has.
    #
    # THE QUESTION IS THE EXERCISE'S OWN TEST, MADE SELF-CONTAINED. "Mark the square
    # corners in these shapes" needs the p.55 figures, and Rule 7 gives this stage no way
    # to carry them (pipe-table and `number_line:` only, SVG prohibited) — so the item asks
    # about the TESTING PROCEDURE the section teaches instead of about a particular shape,
    # which is answerable from the stem alone and is the thing a child must know before the
    # book task means anything. The notebook-corner test is the section's method, not an
    # invention.
    #
    # THE THREE DISTRACTORS ARE THE THREE WAYS A CLASS III CHILD MISREADS THAT TEST, not
    # filler: accepting a gap, accepting an overlap, and testing along a side instead of at
    # the point where two sides meet. Each reveals a different repair, and each is stated
    # that way in `what_each_option_reveals`.
    #
    # NOT ONE LETTER APPEARS IN THE GUIDE PROSE — ARV-D-180's rule, and the reason for it:
    # STEP 6 arranges the options and remaps the reveals' dict KEYS with them, but it
    # cannot rewrite prose, so guide text names the ANSWER ("a square corner"), never the
    # label beside it. The reveals below are keyed to the options AS DECLARED HERE, option
    # for option; get that agreement right and any arrangement preserves it.
    #
    # `visual_stimulus` stays "" — Rule 7's stated default, with the figure reached through
    # the `exercise` companion, which is untouched. `intent`, `section_ref` and
    # `section_title` are untouched.
    "ch_05_canonical.json": {
        "ARV-D-187": [
            {"item_where": {"id": "Q-C-2"},
             "field": "prompt",
             "old": "",
             "new": "Meena tests one corner of a shape by placing the corner of her "
                    "notebook on it. The notebook corner fits exactly — no gap is left "
                    "over, and nothing sticks out past the shape's sides. What has Meena "
                    "found?"},
            {"item_where": {"id": "Q-C-2"},
             "field": "options",
             "old": [],
             "new": [{"label": "A", "text": "A square corner", "is_correct": True},
                     {"label": "B", "text": "A corner smaller than a square corner",
                      "is_correct": False},
                     {"label": "C", "text": "A corner larger than a square corner",
                      "is_correct": False},
                     {"label": "D", "text": "A side, not a corner", "is_correct": False}]},
            # The guide goes in as ONE object, not four dotted edits (ARV-D-180's lesson:
            # `get_nested` reads plain keys and `name[i].leaf` only, so a dotted
            # "teacher_guide.expected_answer" reads None and the edit refuses). It is also
            # the right shape — the four fields are one authored act and land together or
            # not at all. Unlike ARV-D-180, `inclusivity` is NOT carried through: what is
            # there is the generator's failure marker, not the model's teaching.
            {"item_where": {"id": "Q-C-2"},
             "field": "teacher_guide",
             "old": {"expected_answer": "", "method_one_line": "",
                     "what_each_option_reveals": {},
                     "inclusivity": "[Verification failed] Refer to the book task "
                                    "anchored to S5."},
             "new": {"expected_answer":
                     "A square corner. The corner of a notebook is itself a square "
                     "corner, so any corner it sits on exactly — nothing left over and "
                     "nothing sticking out — is a square corner too. If a gap shows, the "
                     "shape's corner is the smaller one; if the notebook edge crosses over "
                     "a side, the shape's corner is the larger one.",
                     "method_one_line":
                     "Use the notebook corner as the tester: an exact fit means a square "
                     "corner, a gap means smaller, an overlap means larger.",
                     "what_each_option_reveals": {
                         "B": "The child is accepting a gap as a fit. Ask them to look "
                              "along the join for daylight between the notebook edge and "
                              "the shape's side.",
                         "C": "The child is accepting an overlap as a fit. Ask whether "
                              "the notebook edge crosses over the shape's side or runs "
                              "along it.",
                         "D": "The child is testing along an edge instead of at the point "
                              "where two edges meet. Point to that meeting point and ask "
                              "them to test again there."},
                     "inclusivity":
                     "Support: give the child a cut-out square corner of card to test "
                     "with, so a whole notebook is not in the way; stretch: ask the child "
                     "to find one square corner and one corner that is not square on the "
                     "same shape."}},
        ],
    },
  },
  # ── S8 · mathematics · preparatory · BATCH WAVE 2 (2026-08-20) ───────────────────────
  # FIVE `number_line:` mis-tags, all caught by the declared-type gate before a human read
  # anything, and all ONE defect wearing five faces: THE TICK LINE IS BEING USED AS A
  # GENERAL-PURPOSE DIAGRAM SLOT. It is the only structured visual this stage is permitted
  # (Rule 7: pipe table, `number_line:`, or nothing — inline SVG prohibited), so when the
  # model wants a sorting grid, a set of nets, a part-whole bar or a ratio pairing, the tag
  # is the nearest thing to hand. W1 saw the same pressure twice (ARV-D-185/186); at wave 2
  # it is five of five. Worth carrying into any future diagram-primitive work: the demand
  # is real and it is not for number lines.
  #
  # The remedy splits cleanly in two, and the split is the useful part:
  #   * the content IS legitimately a pipe table -> strip the tag and keep the cells, so it
  #     renders as the table it always was. A single row falls to PROSE (assessment v1.4),
  #     so these are shaped as header + one data row.
  #   * the content DUPLICATES the stem or the options -> drop the whole field. Rule 7's
  #     stated default is "" with the figure reached through the `exercise` companion.
  ("mathematics", "iii"): {
    # ARV-D-190 · iii ch 11 p06 Q-B-6 is a two-column SORTING grid, not a line: "Lighter
    # than 1 kg | ... | ... | Heavier than 1 kg | ...". The two real cells are category
    # HEADINGS with blanks scattered between them, which is what a tick line's placeholder
    # syntax looks like when it is asked to be a table. Re-shaped as the table it is —
    # the two headings kept verbatim, the blanks becoming the row the child fills. The
    # object list is in the stem already ("pencil, pillow, water bottle full of water,
    # balloon"), so nothing is lost.
    "ch_11_canonical_p06.json": {
        "ARV-D-190": [
            {"item_where": {"id": "Q-B-6"},
             "field": "visual_stimulus",
             "old": "number_line: Lighter than 1 kg | ... | ... | Heavier than 1 kg | ...",
             "new": "Lighter than 1 kg | Heavier than 1 kg\n... | ..."},
        ],
    },
  },
  ("mathematics", "iv"): {
    # ARV-D-191 · iv ch 1 p11 Q-B-5: the four "nets" in the strip are the four OPTIONS,
    # written twice. The options are the fuller version too — "Net with 1 square in the
    # centre surrounded by 4 rectangles" against the strip's "1 square + 4 rectangles
    # (cross shape)" — so the strip is a lossy duplicate that would print above the very
    # list it repeats. Field dropped.
    "ch_01_canonical_p11.json": {
        "ARV-D-191": [
            {"item_where": {"id": "Q-B-5"},
             "field": "visual_stimulus",
             "old": "number_line: 1 square + 4 rectangles (cross shape) | 1 square + 2 "
                    "rectangles (row) | 6 squares (row) | 5 rectangles (row)",
             "new": ""},
        ],
    },
    # ARV-D-192 · iv ch 5 p08 Q-B-7 is a PART-WHOLE BAR — four parts of one shape, three
    # shaded — and that is a table, not a line. Kept as one, with the parts as the header
    # and their shading as the row beneath, which is also how a child reads it. The
    # question ("Ravi says 3/4 is shaded — is he right?") needs exactly this and nothing
    # more.
    "ch_05_canonical_p08.json": {
        "ARV-D-192": [
            {"item_where": {"id": "Q-B-7"},
             "field": "visual_stimulus",
             "old": "number_line: part 1 (shaded) | part 2 (shaded) | part 3 (shaded) | "
                    "part 4 (unshaded)",
             "new": "part 1 | part 2 | part 3 | part 4\nshaded | shaded | shaded | unshaded"},
        ],
    },
    # ARV-D-193 · iv ch 11 p06 Q-C-1: coordinates and an axis position, both already stated
    # in the stem in words ("dots at positions (0,0), (0,2), (2,2), and (2,0)"), and the
    # four candidate completions are the options. The strip adds nothing and cannot be a
    # tick line — "axis at x=2" is a caption, not a tick. Dropped.
    "ch_11_canonical_p06.json": {
        "ARV-D-193": [
            {"item_where": {"id": "Q-C-1"},
             "field": "visual_stimulus",
             "old": "number_line: (0,0)–(0,2)–(2,2)–(2,0) | axis at x=2 | ... | ... | ... | ...",
             "new": ""},
        ],
    },
  },
  ("mathematics", "v"): {
    # ARV-D-194 · v ch 8 p11 Q-B-6 carries TWO tags in one field, on separate lines —
    # "number_line: 6 people | 12 people" and "number_line: 900 g | ...". Neither is a
    # line; together they are a RATIO TABLE, the two rows of a doubling relationship, which
    # is exactly what the question asks the child to complete. Both tags stripped and the
    # rows kept as they stand, so the table renders and the blank stays blank.
    # ★ ARV-D-195 · v ch 9 p08 Q-B-4 IS A SHELL, and this entry AUTHORS TEXT — read it
    # before certifying. Declared SCR, `verified: false`, prompt/answer/method all empty,
    # and an `inclusivity` carrying the generator's failure marker. Second of the campaign
    # after ARV-D-187, and the same treatment: the ARV-D-180 precedent (founder ruling
    # 2026-08-19) authorises an EQUIVALENT question rather than re-buying a compact.
    #
    # THE ANCHOR IS ITS OWN `exercise` BLOCK — "Let Us Do Q4, p.122 · Place numbers 1-8 in
    # boxes so all four operations are correct with no repetition" — and the section is
    # "Patterns in division and place value". The book puzzle is a search task, which is a
    # poor SCR (a child either finds an arrangement or does not, and the guide cannot
    # judge partial work), so the item asks for the PATTERN the section is named for
    # instead. That keeps intent "reason" honest: the child must state a relationship, not
    # hunt for one arrangement.
    #
    # DELIBERATELY NOT A COPY OF THE STANDARD'S Q-B-4, which is built on the same book
    # task ("Place the numbers 2, 3, 6 and 9 into the four boxes"). A teacher served the
    # compact and later the standard would meet the same puzzle twice; the two plans
    # should differ where they can.
    #
    # THE ARITHMETIC IS CHECKED, and stated here so a reader can check it too:
    # 6,000÷6=1,000 · 6,000÷60=100 · 6,000÷600=10 · 6,000÷6,000=1. Every quotient is a
    # whole number and the pattern closes exactly, which is what makes the "next line"
    # answerable rather than a matter of taste. `verified` is left FALSE: this text has
    # not been through a verification pass and must not claim it has.
    "ch_09_canonical_p08.json": {
        "ARV-D-195": [
            # `old: None`, not `""` — the tool refuses an empty-string `old` because
            # `str.replace("")` inserts between every character. None is the SET branch and
            # still refuses on drift.
            {"item_where": {"id": "Q-B-4"},
             "field": "prompt",
             "old": None,
             "new": "Rani writes a pattern:\n6,000 ÷ 6 = 1,000\n6,000 ÷ 60 = 100\n"
                    "6,000 ÷ 600 = 10\nWrite the next line of Rani's pattern. Then explain "
                    "in one sentence what happens to the answer each time the divisor "
                    "becomes ten times bigger."},
            {"item_where": {"id": "Q-B-4"},
             "field": "teacher_guide",
             "old": {"expected_answer": "", "method_one_line": "",
                     "what_each_option_reveals": {},
                     "inclusivity": "[Verification failed] Refer to the book task "
                                    "anchored to S2."},
             "new": {"expected_answer":
                     "The next line is 6,000 ÷ 6,000 = 1. Each time the divisor is "
                     "multiplied by 10, the answer is divided by 10 — so the quotient "
                     "goes 1,000, 100, 10, 1. A child may say this as 'the answer loses a "
                     "zero each time', which is the same observation in place-value "
                     "language and should be accepted; press once for WHY, so the "
                     "reasoning is about the divisor growing rather than about zeros "
                     "disappearing.",
                     "method_one_line":
                     "Read down the divisors: each is ten times the one above, so each "
                     "answer is one tenth of the one above.",
                     "what_each_option_reveals": {},
                     "inclusivity":
                     "Support: write the three quotients in a column (1,000 · 100 · 10) so "
                     "the child sees the pattern in the answers before writing the fourth "
                     "line; stretch: ask what the line AFTER that would be, and why 6,000 "
                     "÷ 60,000 does not give a whole number."}},
        ],
    },
    "ch_08_canonical_p11.json": {
        "ARV-D-194": [
            {"item_where": {"id": "Q-B-6"},
             "field": "visual_stimulus",
             "old": "number_line: 6 people | 12 people\nnumber_line: 900 g | ...",
             "new": "6 people | 12 people\n900 g | ..."},
        ],
    },
  },
  ("mathematics", "v", "APPLIED-20260819"): {
    # ARV-D-186 · v ch 3 Q-B-7 is the opposite case and must NOT be treated like the one
    # above. "12 o'clock (top) | 3 o'clock (right) | 6 o'clock (bottom) | 9 o'clock
    # (left)" is a genuine tick line — four ordered positions on a circle, which is
    # precisely the picture the question needs — and it is the representation assessment
    # v1.4 was amended to permit (the tick-line ruling: a cell is "a number, or a short
    # word naming what sits at that tick"). It fails on ONE clause only: two cells run
    # 17 and 18 characters against the ≤16 bound.
    #
    # So the repair shortens the LABELS and keeps the line. Each cell keeps both facts it
    # carries — the clock number and the compass position — and drops only the repeated
    # word "o'clock", which the item's own `prompt` states for the reader anyway ("an
    # arrow pointing to the right (the 3 o'clock position)"). After: 8, 9, 10 and 8
    # characters. The figure the teacher draws on the board is unchanged.
    "ch_03_canonical.json": {
        "ARV-D-186": [
            {"item_where": {"id": "Q-B-7"},
             "field": "visual_stimulus",
             "old": "number_line: 12 o'clock (top) | 3 o'clock (right) | "
                    "6 o'clock (bottom) | 9 o'clock (left)",
             "new": "number_line: 12 (top) | 3 (right) | 6 (bottom) | 9 (left)"},
        ],
    },
  },
  ("english", "iii"): {
    # ARV-D-189 · english III ch 2 p04 Q-WW-B-2 — the FIRST kind-1 item off C5 check 12's
    # english advisory shortlist, found by the founder reading the list rather than by a
    # gate. English does not gate (stem_deixis._GATES), so the shortlist is exactly this:
    # a reader deciding which entries are real. This one is.
    #
    # "Choose any one action word from the list below." ORAL_PROMPT, `options: []`,
    # `visual_stimulus: ""`, no word bank, no `exercise` block. The list is nowhere in the
    # item, and its `source_context` says so in passing — "action words from a mixed list".
    # A Class III child asked to choose from a list they cannot see cannot start.
    #
    # THE LIST EXISTS, and the chapter summary has it with its page: task A on **p.7** —
    # "carrot, laugh, dance, leg, eat, cry, swim, potato, sleep, play, sun, dig, jump, run,
    # book, face, write, cat, smile, push". So the repair is the T1 move (point at the page
    # the referent is actually on), taken as a DECLARED edit rather than a generic one
    # because english items carry no `exercise.book_ref` for the pass to derive it from.
    # This is english·preparatory Rule 9's own doctrine: "The teacher has the book."
    #
    # Twenty words is also too many to inline into an oral prompt a teacher reads aloud,
    # and the four distractors in that list (carrot, leg, potato, sun, book, face, cat) are
    # the point of the exercise — the child must pick an action word OUT of a mixed set, so
    # the set has to stay whole and stay where it is.
    "ch_02_canonical_p04.json": {
        "ARV-D-189": [
            {"item_where": {"id": "Q-WW-B-2"},
             "field": "item_stem",
             "old": "Choose any one action word from the list below. Say it aloud clearly, "
                    "then make up one sentence using that word to describe something you or "
                    "a friend do every day.",
             "new": "Choose any one action word from the mixed list on p.7. Say it aloud "
                    "clearly, then make up one sentence using that word to describe "
                    "something you or a friend do every day."},
        ],
    },
  },
  # ── S7 · mathematics · middle · BATCH WAVE 2 (2026-08-19) ────────────────────────────
  # The two compacts certification quarantined, each for one item. Both restored from
  # backup/quarantine/ before these ran (runbook trap 1: a quarantined file skips every
  # later sweep, so it must be back on disk to be repaired AND to be re-scanned).
  ("mathematics", "vi"): {
    # ARV-D-179 · vi ch 9 p14 Q-C-5 declares `number_line:` on something that is not a
    # tick line: "Original L (5 sq) | + vertical mirror | + horizontal mirror | =
    # Complete figure" — four cells over the 16-char label bound, because they are
    # narration, not labels. Certification is right to reject it, and the fix is NOT to
    # shorten the cells.
    #
    # The stimulus is wrong twice over, which is why the whole field goes rather than
    # just the tag (founder ruling 2026-08-19, on reading the item):
    #   1. it is not the picture the question needs. The item asks how many squares
    #      complete an L so that it gains BOTH lines of symmetry; what would help is the
    #      L drawn on squared paper with the mirror lines marked. Rule 7 forbids a tick
    #      line from being that — "the ticks are drawn as an ordered line, never as a
    #      grid" — and prohibits SVG at this stage, so no permitted format can carry it.
    #   2. what it DOES carry is the method. Compare the strip to the item's own
    #      `method_one_line` ("reflect the original across the vertical axis, then reflect
    #      the combined figure across the horizontal axis") — the same two steps. Printed
    #      for the student, it converts an `apply` item into an instruction to follow.
    #
    # "" is not a fallback here, it is Rule 7's stated DEFAULT for exactly this item:
    # "the default for almost all geometry items — the figure, if needed, is reached via
    # the `exercise` companion block, which points the teacher to a textbook figure".
    # This item already carries that block (Figure it Out Q12, section 9.1 p.229 — the six
    # partial drawings with their mirror lines printed in blue). Nothing is lost.
    "ch_09_canonical_p14.json": {
        "ARV-D-179": [
            {"item_where": {"id": "Q-C-5"},
             "field": "visual_stimulus",
             "old": "number_line: Original L (5 sq) | + vertical mirror | "
                    "+ horizontal mirror | = Complete figure",
             "new": ""},
        ],
    },
    # ── F1 · mathematics · middle · CLOSING-SYNTHESIS REPAIR WAVE (2026-08-20) ─────────
    # Brief: docs/f1_maths_repair_brief.md. The resynthed closers shipped mathematical
    # defects certification cannot see (it never checks whether an answer is right):
    # wrong answers, ill-posed problems, invalid routes, statement/solution disagreement,
    # plus drafting scratch. Every problem in every touched table was RECOMPUTED from
    # scratch before its edit was declared (brief §8); evidence is quoted per defect on
    # the campaign register (data/testing/campaign_state.json, mathematics/middle · F1).
    # The two §7 method-availability items — vii ch 11 P3 (needs HCF × LCM = product)
    # and vii ch 14 P3's colouring method vs the shorter plan — are NOT repaired here:
    # they are content decisions in ARV-D-181's family, flagged for the founder.
    #
    # ── F1 · NOTES PASS (second pass, 2026-08-20) — docs/f1_maths_notes_pass_brief.md ──
    # The audit that closed the first pass found `teacher_notes` the weakest layer:
    # notes naming a method the problem does not use, or warning about an error the
    # problem cannot produce — and the closing routine has the class NAME THE METHOD
    # ALOUD from these notes. All 39 chapters were read against their own tables
    # (two tests per note: method named = method used; warned error can arise).
    # Solution-cell edits in this pass exist ONLY where an actual error was found and
    # are reported as their own defects (brief §4). ARV-D-222…255.
    "ch_01_canonical.json": {
        # ARV-D-232 · P2 solution calls 36 "the 36th square" — it is the 6th.
        "ARV-D-232": [
            {"unit": 8, "field": 'visual_aids[0].table',
             "old": 'The result is the 36th square — equivalently, the square of 6, because adding',
             "new": 'The result is 36, the 6th square number — equivalently, the square of 6, because adding'},
        ],
    },
    "ch_02_canonical.json": {
        # ARV-D-233 · P3 names "protractor reading" for a computed 180° − 55° (no
        # protractor, no scale anywhere); P4 warns about 22.5° — a value no route
        # through 30 < m < 45 produces. Real hazard: the boundary values 30 and 45.
        "ARV-D-233": [
            {"unit": 20, "field": 'teacher_notes',
             "old": 'Problem 3 uses protractor reading and the straight-angle property (180°); the common error is reading the wrong scale and failing to subtract.',
             "new": 'Problem 3 uses the straight-angle property (180°); the common error is failing to subtract the given 55° from 180°.'},
            {"unit": 20, "field": 'teacher_notes',
             "old": 'watch for students who treat 22.5° as a valid whole-number answer.',
             "new": 'watch for students who include the boundary values 30° and 45°, where one of the conditions becomes exactly 90° and fails.'},
        ],
    },
    "ch_04_canonical.json": {
        # ARV-D-235 · "reading each band aloud as it opens" is drafting language (the
        # problems live in the Prepared Table, not in bands); the P4 example bar of
        # "3 400 units" is the SUM of all six values — no bar is that tall; the
        # tallest (Farhan) is 1 000.
        "ARV-D-235": [
            {"unit": 14, "field": 'teacher_notes',
             "old": 'Pose all four problems at once by writing them on the board (or reading each band aloud as it opens).',
             "new": 'Pose all four problems at once by writing them on the board from the Prepared Table.'},
            {"unit": 14, "field": 'teacher_notes',
             "old": 'students choosing a scale in P4 that produces unwieldy heights (e.g. 1 unit = 1 rupee gives a 3 400-unit bar) instead of one that fits the page.',
             "new": 'students choosing a scale in P4 that produces unwieldy heights (e.g. 1 unit = 1 rupee gives a 1 000-unit bar for Farhan) instead of one that fits the page.'},
        ],
    },
    "ch_05_canonical.json": {
        # ARV-D-236 · P1 names "LCM reasoning" for a common-factor (HCF) method — a
        # jump lands on both treasures iff it divides both; P2 says "when sieving" but
        # the solution factorises 77, no sieve appears.
        "ARV-D-236": [
            {"unit": 25, "field": 'teacher_notes',
             "old": 'Problem 1 — students listing multiples instead of using LCM reasoning from common factors;',
             "new": 'Problem 1 — students testing jump sizes by listing multiples of each candidate instead of reasoning from common factors;'},
            {"unit": 25, "field": 'teacher_notes',
             "old": "Problem 2 — confusing 'prime' with 'odd' when sieving;",
             "new": "Problem 2 — confusing 'prime' with 'odd' when checking the two factors of 77;"},
        ],
    },
    "ch_10_canonical.json": {
        # ARV-D-238 · P2's warned error runs the wrong way: the CORRECT answer is
        # +145; the direction-reversal error gives −145, not the other way round.
        "ARV-D-238": [
            {"unit": 16, "field": 'teacher_notes',
             "old": 'the most common error is reversing the direction, giving +145 instead of −145.',
             "new": 'the most common error is reversing the direction, giving −145 instead of +145.'},
        ],
    },
    "ch_03_canonical.json": {
        # ARV-D-213 · drafting scratch (brief §6): "the number 4-digit number 3,5,2,1"
        # and "0468 = 0468, treated as 0468" — duplicated fragments, pure tightening.
        "ARV-D-213": [
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'Apply the Kaprekar process to the number 4-digit number 3,5,2,1 (i.e., 3521)',
             "new": 'Apply the Kaprekar process to the 4-digit number 3521'},
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'smallest = 0468 = 0468, treated as 0468 (pad to four digits)',
             "new": 'smallest = 0468 (pad to four digits)'},
        ],
        # ── notes pass ──
        # ARV-D-222 · PRIORITY 1 of the notes brief: "the largest number is always a
        # supercell" is FALSE (two adjacent copies of the maximum beat neither
        # neighbour), and Problem 1 — 41, 78, 65, 78, 52 — plants exactly that
        # near-case and asks about it. The clause is unused by the solution, which
        # argues from the definition alone. Struck.
        "ARV-D-222": [
            {"unit": 12, "field": 'teacher_notes',
             "old": '(a cell is a supercell only if it exceeds every adjacent neighbour; the largest number is always a supercell)',
             "new": '(a cell is a supercell only if it exceeds every adjacent neighbour)'},
        ],
        # ARV-D-234 · known attribution defects: "reading each band aloud" is drafting
        # language (the problems live in the Prepared Table); the P3 padding warning
        # names an error that cannot change the answer (8640 − 468 = 8640 − 0468).
        "ARV-D-234": [
            {"unit": 12, "field": 'teacher_notes',
             "old": 'Pose all four problems at once by reading each band aloud and writing the problems on the board.',
             "new": 'Pose all four problems at once by writing them on the board from the Prepared Table.'},
            {"unit": 12, "field": 'teacher_notes',
             "old": 'in Problem 3, students who forget to pad a four-digit result with a leading zero before rearranging;',
             "new": 'in Problem 3, students who start round 2 from the digits of the original number instead of the digits of the round-1 result;'},
        ],
    },
    "ch_06_canonical.json": {
        # ARV-D-203 · brief §5.8 + §6: as stated, the two 5×4 pieces joined along their
        # 4 cm edges simply rebuild the original 10×4 — nothing changes and the method is
        # never exercised; the cell then answered a second, unasked configuration. The
        # problem now poses THAT configuration (join along the 5 cm edges → 5×8, P=26 vs
        # 28), so one question gets one answer and the perimeter genuinely changes.
        "ARV-D-203": [
            {"unit": 21, "field": 'visual_aids[0].table',
             "old": 'The two pieces are placed side by side along their 4 cm edges to form one long rectangle. What is the perimeter of the new shape?',
             "new": 'The two pieces are then joined along their 5 cm edges (one piece stacked against the other along the 5 cm side) to form a new rectangle. What is the perimeter of the new shape, and how does it compare with the perimeter of the original rectangle?'},
            {"unit": 21, "field": 'visual_aids[0].table',
             "old": 'The new shape is 10 cm × 4 cm — the same rectangle. Perimeter = 2 × (10 + 4) = 28 cm. Now the pieces are instead stacked along their 5 cm edges (one on top of the other along the 5 cm side), forming a 5 cm × 8 cm rectangle. Perimeter = 2 × (5 + 8) = 26 cm. The perimeter changes depending on which edges are joined: joining along the 4 cm edges gives 28 cm; joining along the 5 cm edges gives 26 cm.',
             "new": "Joining the two 5 cm × 4 cm pieces along their 5 cm edges forms a 5 cm × 8 cm rectangle. Perimeter = 2 × (5 + 8) = 26 cm. The original 10 cm × 4 cm rectangle has perimeter 2 × (10 + 4) = 28 cm, so the new shape's perimeter is 2 cm less: the cut exposed two 4 cm edges, but the join then hid two 5 cm edges."},
        ],
        # ── notes pass ──
        # ARV-D-237 · known: "flower bed" — Problem 2 is about FOUNTAINS. The error
        # named (area of only one of the four) is right; the object was not.
        "ARV-D-237": [
            {"unit": 21, "field": 'teacher_notes',
             "old": 'Problem 2, students finding area of only one flower bed rather than all four;',
             "new": 'Problem 2, students finding the area of only one fountain rather than all four;'},
        ],
    },
    "ch_09_canonical.json": {
        # ARV-D-202 · brief §5.7: "exactly 1 line of symmetry" does not follow from one
        # passed and one failed fold (an equilateral triangle passes a vertical fold,
        # fails the horizontal, and has THREE axes); the stem also had a horizontal fold
        # mapping left onto right. The question now asks what the folds actually settle.
        "ARV-D-202": [
            {"unit": 24, "field": 'visual_aids[0].table',
             "old": 'Then the same figure is folded along a horizontal line through its centre. The left half does NOT land on the right half. How many lines of symmetry does the figure have? Name the type of symmetry it has.',
             "new": "Then the same figure is folded along a horizontal line through its centre. The top half does NOT land exactly on the bottom half. Which of the two fold lines is a line of symmetry? Can these two folds alone tell you the figure's total number of lines of symmetry?"},
            {"unit": 24, "field": 'visual_aids[0].table',
             "old": 'The vertical fold produces exact overlap, so the vertical line is a line of symmetry. The horizontal fold does not produce exact overlap, so the horizontal line is not a line of symmetry. The figure has exactly 1 line of symmetry and possesses reflection symmetry.',
             "new": 'The vertical fold produces exact overlap, so the vertical line is a line of symmetry. The horizontal fold does not, so the horizontal line is not one. The figure therefore has reflection symmetry, with the vertical line as one line of symmetry — but the two folds alone cannot fix the total, because a figure may have further lines in other directions: an equilateral triangle passes a vertical fold, fails the horizontal one, and has three lines of symmetry.'},
        ],
        # ── notes pass ──
        # ARV-D-223 · PRIORITY 2 of the notes brief: P4 used divisibility (necessary)
        # as if it were sufficient — 360 ÷ 20 = 18 only fails to rule the figure out.
        # The solution now exhibits the witness (an 18-armed radial figure, the
        # closer's own idiom from P3) so the claim is established, and the note names
        # the test TOGETHER WITH the witness.
        "ARV-D-223": [
            {"unit": 24, "field": 'visual_aids[0].table',
             "old": 'Test: 360° ÷ 20° = 18, which is a whole number, so 20° is a valid smallest angle (it is a factor of 360). Yes, the claim is possible.',
             "new": 'Test: 360° ÷ 20° = 18, a whole number, so 20° passes the factor-of-360 test — necessary, but not yet a proof that such a figure exists. Exhibit one: a radial figure with 18 equally spaced arms repeats after a 20° turn and after no smaller turn, so its smallest angle of symmetry is exactly 20°. Yes, the claim is possible.'},
            {"unit": 24, "field": 'teacher_notes',
             "old": 'Problem 4 needs the factor-of-360 test; students may accept 20° without checking, or reject it by miscounting.',
             "new": 'Problem 4 needs the factor-of-360 test together with a witness figure; students may accept 20° from the test alone, or reject it by miscounting.'},
        ],
    },
  },
  ("mathematics", "vii"): {
    # ── F1 · CLOSING-SYNTHESIS REPAIR WAVE (2026-08-20) — see the vi key's header. ─────
    # ── F1 · NOTES PASS entries follow the same doctrine — see the vi key's header. ────
    "ch_01_canonical.json": {
        # ARV-D-225 · WRONG ANSWER found by the notes-pass audit (this chapter was not
        # among the 8 previously audited): P4 claims the 7-digit × 2-digit product "is
        # always 9 or 10 digits". Truth: 10,00,000 × 10 = 1,00,00,000 has EIGHT digits
        # (the cell mis-wrote it as 10,00,00,000) and 98,99,99,901 has NINE — the
        # answer is 8 or 9. The cell also carried "— wait, check:" drafting scratch.
        "ARV-D-225": [
            {"unit": 11, "field": 'visual_aids[0].table',
             "old": 'Smallest product: fewest digits occur when both factors are as small as possible. Smallest 7-digit number = 10,00,000; smallest 2-digit number = 10. Product = 10,00,00,000, which is 9 digits. Largest product: largest 7-digit = 99,99,999; largest 2-digit = 99. Product = 99,99,999 × 99 < 1,00,00,000 × 100 = 1,00,00,00,000 (10 digits), and 99,99,999 × 99 = 98,99,99,901, which is 10 digits. So the product is always either 8 digits — wait, check: 10,00,000 × 10 = 10,00,00,000 is already 9 digits. Try the true minimum: 10,00,000 × 10 = 10,00,00,000 (9 digits). Can we get 8 digits? The product would need to be less than 10,00,00,000, meaning less than 10,00,000 × 10 — but 10,00,000 is the smallest 7-digit number and 10 is the smallest 2-digit number, so no product of a 7-digit and a 2-digit number can be less than 10,00,00,000. The product therefore has either 9 digits (e.g., 10,00,000 × 10 = 10,00,00,000) or 10 digits (e.g., 99,99,999 × 99 = 98,99,99,901). It is always 9 or 10 digits.',
             "new": 'Smallest product: both factors as small as possible — smallest 7-digit number 10,00,000 × smallest 2-digit number 10 = 1,00,00,000, which has 8 digits. No 7-digit × 2-digit product can be smaller, so none has fewer than 8 digits. Largest product: 99,99,999 × 99 < 1,00,00,000 × 100 = 1,00,00,00,000 (a 10-digit number), so every product stays below 10 digits; and 99,99,999 × 99 = 98,99,99,901 does have 9 digits. The product therefore has either 8 digits (e.g., 10,00,000 × 10 = 1,00,00,000) or 9 digits (e.g., 99,99,999 × 99 = 98,99,99,901).'},
        ],
        # ARV-D-226 · P2's solution computed the exact sum (65,27,879) the stem forbids
        # and kept an inconclusive ten-lakh-rounding trial (bounds 50–70 lakh settle
        # nothing about 65 lakh). Only the valid rounded-down-lakh route remains.
        "ARV-D-226": [
            {"unit": 11, "field": 'visual_aids[0].table',
             "old": 'For the sum: round each number down to the nearest ten lakh — 30,00,000 + 20,00,000 = 50,00,000; round each up — 40,00,000 + 30,00,000 = 70,00,000. Both addends are closer to 37,00,000 and 28,00,000; their sum 36,84,729 + 28,43,150 = 65,27,879, which exceeds 65,00,000. A sufficient justification without exact arithmetic: rounding both down to the nearest lakh gives 36,84,000 + 28,43,000 = 65,27,000 > 65,00,000, so the exact sum must also exceed 65,00,000.',
             "new": 'For the sum: rounding both numbers down to the nearest lakh gives 36,84,000 + 28,43,000 = 65,27,000, which already exceeds 65,00,000 — and the true sum can only be larger than this rounded-down sum. So 36,84,729 + 28,43,150 is more than 65,00,000, with no exact addition needed.'},
        ],
        # ARV-D-239 · the P2 note branded the solution's own valid move (same-direction
        # rounding to trap the sum) as the error; the P4 note now matches the corrected
        # 8-or-9 answer.
        "ARV-D-239": [
            {"unit": 11, "field": 'teacher_notes',
             "old": 'Problem 2 — rounding to the wrong place, or rounding both numbers in the same direction when checking whether the sum crosses a boundary;',
             "new": 'Problem 2 — rounding to the wrong place, or rounding to the nearest and treating the rounded sum as conclusive, instead of rounding both numbers down (or both up) so the true sum is trapped on one side of the boundary;'},
            {"unit": 11, "field": 'teacher_notes',
             "old": 'Problem 4 — treating the 7-digit × 2-digit product as definitely 8-digit without checking the boundary case (smallest 7-digit × smallest 2-digit vs. largest 7-digit × largest 2-digit).',
             "new": 'Problem 4 — assuming every 7-digit × 2-digit product has the same digit-count without checking both boundary cases (smallest 7-digit × smallest 2-digit vs. largest 7-digit × largest 2-digit).'},
        ],
    },
    "ch_04_canonical.json": {
        # ARV-D-241 · the P2 warning's numbers ("10 − (−3) as 7 instead of 13")
        # describe an expression that is not this problem's (10 − 3k at k = −3 gives
        # 19); the P4 method claim "using remainder" — 5n + 1 = 96 solves exactly.
        "ARV-D-241": [
            {"unit": 9, "field": 'teacher_notes',
             "old": 'in Problem 2, students who compute 10 − (−3) as 7 instead of 13;',
             "new": 'in Problem 2, students who compute 10 − 3(−3) as 10 − 9 = 1 instead of 10 + 9 = 19;'},
            {"unit": 9, "field": 'teacher_notes',
             "old": 'Problem 4 needs deriving a general formula from a growing pattern and using remainder to identify a specific term (section 4.5).',
             "new": 'Problem 4 needs deriving a general formula from a growing pattern and inverting it to identify a specific term (section 4.5).'},
        ],
    },
    "ch_05_canonical.json": {
        # ARV-D-242 · "reading each board-row aloud" is the same drafting-language
        # family as vi ch 3's "band"; the P3 method line named alternate-angles for a
        # solution whose primary line is the co-interior supplementary property.
        "ARV-D-242": [
            {"unit": 15, "field": 'teacher_notes',
             "old": 'Pose all four problems at once by reading each board-row aloud.',
             "new": 'Pose all four problems at once by writing them on the board from the Prepared Table.'},
            {"unit": 15, "field": 'teacher_notes',
             "old": 'Problem 3 needs the alternate-angles result together with the linear-pair sum — the most common slip is treating co-interior angles as equal rather than supplementary.',
             "new": 'Problem 3 needs the co-interior (same-side interior) supplementary property — the alternate-angles result combined with the linear-pair sum — and the most common slip is treating co-interior angles as equal rather than supplementary.'},
        ],
    },
    "ch_15_canonical.json": {
        # ARV-D-227 · P4's diagnosis branded the student's CORRECT move (−9 crossing
        # as +9) as part of the mistake, in a sentence that then contradicted itself
        # ("not kept as −9 or mixed wrongly"). The one real error was +2y for −2y.
        "ARV-D-227": [
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'Mistake: when 2y was moved from the right to the left it should have become −2y, not +2y; and 9 moved from the left to the right should have become +9, not kept as −9 or mixed wrongly.',
             "new": 'Mistake: when 2y crossed from the right side to the left it should have become −2y, not +2y — the student added it instead of subtracting. (Moving −9 to the right as +9 was correct.)'},
        ],
    },
    "ch_03_canonical.json": {
        # ARV-D-204 · brief §5.9 + §6: 36.089 placed among "those with tenths digit 8"
        # (its tenths digit is 0), the ordering step 36.08 < 36.089 never given, "36.08_"
        # shorthand and a dangling "— look further:"; stem said four students record "the
        # same temperature" when only two readings are equal.
        "ARV-D-204": [
            {"unit": 9, "field": 'visual_aids[0].table',
             "old": 'Four students record the same temperature: 36.8°, 36.08°, 36.80°, and 36.089°. Arrange them in increasing order and state which two are equal.',
             "new": 'Four students read the same thermometer and write down: 36.8°, 36.08°, 36.80°, and 36.089°. Arrange the readings in increasing order and state which two are equal.'},
            {"unit": 9, "field": 'visual_aids[0].table',
             "old": 'Compare left to right. All have 36 as the whole-number part. Tenths: 36.08_ has 0 (smallest), the others have 8. Among those with tenths digit 8: hundredths of 36.8 = 36.80 = 0 (trailing zero), 36.089 has 0, 36.80 has 0 — look further: 36.089 has thousandths digit 9 > 0. So 36.80 = 36.8 (trailing zero does not change value). Order: 36.08 < 36.089 < 36.8 = 36.80. The two equal readings are 36.8 and 36.80.',
             "new": 'Compare left to right. All have 36 as the whole-number part. Tenths: 36.08 and 36.089 have tenths digit 0; 36.8 and 36.80 have tenths digit 8, so both of the first pair are smaller. Between 36.08 and 36.089: they agree up to the hundredths digit, and 36.089 carries a thousandths digit 9 against 0, so 36.08 < 36.089. Finally 36.80 = 36.8 — a trailing zero does not change the value. Order: 36.08 < 36.089 < 36.8 = 36.80. The two equal readings are 36.8 and 36.80.'},
        ],
        # ── notes pass ──
        # ARV-D-240 · known: the P1 note flagged the solution's own method as the
        # error (the solution multiplies by 0.1 / 0.01); the P3 method line named a
        # number line that appears nowhere.
        "ARV-D-240": [
            {"unit": 9, "field": 'teacher_notes',
             "old": 'in Problem 1, students multiplying instead of dividing when converting mm to m;',
             "new": 'in Problem 1, students moving the decimal point the wrong way — making the number larger — when converting mm to cm and m;'},
            {"unit": 9, "field": 'teacher_notes',
             "old": 'Problem 3 calls on left-to-right digit comparison to locate a decimal on the number line (section 3.6).',
             "new": 'Problem 3 calls on left-to-right place-value comparison to order decimals (section 3.6).'},
        ],
    },
    "ch_07_canonical.json": {
        # ARV-D-208 · brief §5.13: given AB = 8, BC = 6, CA = 5 the cell drew "base BC =
        # 8 cm" and swung 5 from B and 6 from C — building AB = 5, AC = 6. With the
        # correct triangle ∠C ≈ 92.9°, so the altitude foot falls beyond C (checked:
        # foot at 75/12 = 6.25 > 6 from B), which is exactly what the notes warn about.
        "ARV-D-208": [
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'Construction: draw base BC = 8 cm. Swing an arc of radius 5 cm from B and an arc of radius 6 cm from C; mark A at their intersection. Join AB and CA. Altitude: align the ruler along BC; place the set square against the ruler and slide until its vertical edge reaches A; draw the perpendicular from A to meet BC (or its extension) at foot H. AH is the altitude.',
             "new": 'Construction: draw base BC = 6 cm. Swing an arc of radius 8 cm from B (for AB = 8 cm) and an arc of radius 5 cm from C (for CA = 5 cm); mark A at their intersection. Join AB and CA. Altitude: align the ruler along BC; place the set square against the ruler and slide until its vertical edge reaches A. Here the foot of the perpendicular falls beyond C, so extend BC past C and draw the perpendicular from A to meet the extension at foot H. AH is the altitude.'},
        ],
    },
    "ch_08_canonical.json": {
        # ARV-D-205 · brief §5.10: "Since 4/7 < 1, the product is also less than 1" is a
        # non-sequitur (8/5 × 4/5 > 1). The valid reason is 8 × 4 = 32 < 35 = 5 × 7.
        "ARV-D-205": [
            {"unit": 9, "field": 'visual_aids[0].table',
             "old": 'Since 4/7 < 1, the product is also less than 1.',
             "new": 'The product is less than 1 because the product of the numerators, 8 × 4 = 32, is less than the product of the denominators, 5 × 7 = 35.'},
        ],
        # ── notes pass ──
        # ARV-D-243 · the P3 warning "adding fractions before multiplying (the chain
        # must be multiplied in order)" names an error this problem cannot produce —
        # nothing in it invites addition, and there is no chain.
        "ARV-D-243": [
            {"unit": 9, "field": 'teacher_notes',
             "old": 'Problem 3 — students adding fractions before multiplying (the chain must be multiplied in order);',
             "new": 'Problem 3 — students stopping at 3/5 × 2/3 of the plot without ever multiplying by the side 7/4 km, so no area in sq km is produced;'},
        ],
    },
    "ch_09_canonical.json": {
        # ARV-D-206 · brief §5.11: with P↔S, Q↔T, R↔U, reordering the first triangle as
        # Q,P,R forces △TSU; the offered "△QPR ≅ △TUS" asserts PQ = TU and PR = TS, both
        # false. (△RQP ≅ △UTS was already correct and stays.)
        "ARV-D-206": [
            {"unit": 15, "field": 'visual_aids[0].table',
             "old": 'One other correct statement (swap both names consistently): △QPR ≅ △TUS (or any permutation that preserves the same vertex-to-vertex matching, e.g. △RQP ≅ △UTS).',
             "new": 'One other correct statement (reorder both names by the same matching P↔S, Q↔T, R↔U): △QPR ≅ △TSU (or any permutation that preserves the matching, e.g. △RQP ≅ △UTS).'},
        ],
        # ARV-D-218 · found (§8): the register bans stated minute-quantities in these
        # units; "18 minutes" is pacing, not measured data.
        "ARV-D-218": [
            {"unit": 15, "field": 'teacher_notes',
             "old": 'give students 18 minutes of silent individual work before any comparison',
             "new": 'give students a sustained stretch of silent individual work before any comparison'},
        ],
        # ── notes pass ──
        # ARV-D-224 · PRIORITY 3 of the notes brief: P4's stem opened "In the figure…"
        # — no figure exists anywhere in the unit and this stage may not carry one.
        # The two right angles put A, M, B on the perpendicular at M, so the
        # configuration is fully determined in words; the muddled "included angle
        # between the known angle and the equal side" sentence is restated cleanly.
        "ARV-D-224": [
            {"unit": 15, "field": 'visual_aids[0].table',
             "old": 'In the figure, M is the midpoint of segment PQ. ∠PMA = ∠QMB = 90° and ∠APM = ∠BQM = 55°.',
             "new": 'M is the midpoint of a segment PQ. A line through M perpendicular to PQ is drawn; point A lies on it on one side of PQ and point B on the other side. This makes ∠PMA = ∠QMB = 90°, and additionally ∠APM = ∠BQM = 55°.'},
            {"unit": 15, "field": 'visual_aids[0].table',
             "old": '∠PMA = ∠QMB = 90° (given), so the included angle between the known angle and the equal side is 90° in both triangles. The two angles 55° and 90° are known in each triangle, with the side PM = QM between ∠APM and ∠PMA (and BQM, QMB respectively), so by ASA, △APM ≅ △BQM.',
             "new": '∠PMA = ∠QMB = 90° because A, M, and B lie on the perpendicular to PQ at M. In each triangle two angles and the side between them are now known: in △APM the side PM lies between the 55° angle at P and the 90° angle at M, and in △BQM the side QM lies between the 55° angle at Q and the 90° angle at M. With PM = QM, by ASA, △APM ≅ △BQM.'},
        ],
        # ARV-D-244 · known: "proved via RHS congruence" — P3 CITES the base-angle
        # result; it proves nothing via RHS.
        "ARV-D-244": [
            {"unit": 15, "field": 'teacher_notes',
             "old": 'Problem 3 uses the isosceles base-angle result proved via RHS congruence;',
             "new": 'Problem 3 uses the isosceles base-angle result (equal sides give equal opposite angles) together with the angle-sum property;'},
        ],
    },
    "ch_10_canonical.json": {
        # ARV-D-200 · brief §5.5 + §6: +3/−2 over all 20 attempts gives score = 5c − 40,
        # always a multiple of 5 — the stated 11 is unattainable (5c = 51); the cell knew,
        # answered for 10 while the stem read 11, and shipped five abandoned trials plus a
        # bracketed working note. Stem now says 10 and the solution is the clean route.
        "ARV-D-200": [
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'Priya attempts all 20 questions and scores 11.',
             "new": 'Priya attempts all 20 questions and scores 10.'},
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'Let c = correct answers. Wrong answers = 20 − c. Score: 3c + (−2)(20 − c) = 11. So 3c − 40 + 2c = 11, giving 5c = 51, c = 51 ÷ 5. Since that is not a whole number, try: let c correct and w wrong with c + w = 20. Score = 3c − 2w = 11 and w = 20 − c, so 3c − 2(20 − c) = 11 → 5c = 51. Re-check the problem: score 11, 20 questions. Try c = 9: 3(9) − 2(11) = 27 − 22 = 5. Try c = 13: 3(13) − 2(7) = 39 − 14 = 25. Try c = 11: 3(11) − 2(9) = 33 − 18 = 15. Try c = 10: 3(10) − 2(10) = 30 − 20 = 10. Try c = 7: 3(7) − 2(13) = 21 − 26 = −5. [Working note: score 11 with 20 questions requires 5c = 51, not a whole number. Adjust to score 10: 5c = 50, c = 10.] The problem uses score 10. Score = 3c − 2(20 − c) = 10 → 5c = 50 → c = 10. Priya answered 10 questions correctly (and 10 wrongly), scoring 3 × 10 + (−2) × 10 = 30 − 20 = 10. ✓',
             "new": 'Let c = correct answers. Wrong answers = 20 − c. Score: 3c + (−2)(20 − c) = 10. So 3c − 40 + 2c = 10, giving 5c = 50 and c = 10. Priya answered 10 questions correctly (and 10 wrongly). Check: 3 × 10 + (−2) × 10 = 30 − 20 = 10. ✓'},
        ],
        # ARV-D-217 · found (§8): "Unlike-sign rule reversed" names the wrong rule for a
        # sitting whose design has the class name the method aloud; it is the LIKE-sign
        # rule. The arithmetic was already right.
        "ARV-D-217": [
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'Unlike-sign rule reversed: negative ÷ negative = positive.',
             "new": 'Like signs give a positive quotient: negative ÷ negative = positive.'},
        ],
        # ── notes pass ──
        # ARV-D-245 · the P3 warning distinguishes wrong from BLANK answers — the stem
        # says all 20 are attempted, so blanks cannot arise.
        "ARV-D-245": [
            {"unit": 12, "field": 'teacher_notes',
             "old": 'forgetting to count only wrong answers (not blank) in Problem 3;',
             "new": 'forming the score as 3c − 2c instead of 3c − 2(20 − c) in Problem 3;'},
        ],
    },
    "ch_12_canonical.json": {
        # ARV-D-207 · brief §5.12: the remainder is 4 tenths regrouped to 40 HUNDREDTHS
        # giving 5 hundredths — the cell said "40 tenths ÷ 8 = 5 tenths", which reads as
        # quotient 6.3 against its own correct 5.85; the decimal point was also placed a
        # step late.
        "ARV-D-207": [
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'Divide 46.8 by 8 using long division. 46 ÷ 8 = 5 remainder 6. Bring down 8: 68 ÷ 8 = 8 remainder 4. Place decimal point. Regroup: 40 tenths ÷ 8 = 5 tenths. So 46.8 ÷ 8 = 5.85 litres each.',
             "new": 'Divide 46.8 by 8 using long division. Units: 46 ÷ 8 = 5, remainder 6. Place the decimal point in the quotient now, before the tenths digit is written. Bring down the 8: 68 tenths ÷ 8 = 8 tenths, remainder 4 tenths. Regroup: 4 tenths = 40 hundredths, and 40 hundredths ÷ 8 = 5 hundredths. So 46.8 ÷ 8 = 5.85 litres each.'},
        ],
        # ── notes pass ──
        # ARV-D-246 · known: "division by a power of ten" attributed to P2, whose
        # divisor is 8; powers of ten belong to P3, separately and correctly credited.
        "ARV-D-246": [
            {"unit": 12, "field": 'teacher_notes',
             "old": 'Problem 2 — students moving the decimal point the wrong way or losing track of which way division by a power of ten shifts the point (division by powers of ten, then long division with a decimal dividend);',
             "new": 'Problem 2 — students misplacing the decimal point in the quotient, or regrouping the leftover tenths into tenths instead of hundredths (long division with a decimal dividend);'},
        ],
    },
    "ch_14_canonical.json": {
        # ARV-D-196 · brief §5.1, WRONG ANSWER, fixed first: on a 4×4 board the four
        # corners are NOT one colour ((1,1)/(4,4) vs (1,4)/(4,1)); removal leaves 6 and 6
        # and a tiling EXISTS, so "cannot be tiled" was false. All-corners-same-colour
        # holds only on odd×odd boards. The problem now removes TWO OPPOSITE corners —
        # same colour, 6 vs 8, impossibility real — keeping the unit's colouring method
        # and its conclusion. (The separate §7 method-availability question on this
        # problem — the shorter plan teaches only total-count parity — stays with the
        # founder; it is not papered over here.)
        "ARV-D-196": [
            {"unit": 17, "field": 'visual_aids[0].table',
             "old": 'with the four corner unit squares removed, leaving 12 unit squares',
             "new": 'with two opposite corner unit squares removed, leaving 14 unit squares'},
            {"unit": 17, "field": 'visual_aids[0].table',
             "old": 'Colour the region like a chessboard. In the full 4 × 4 grid the 16 squares alternate black and white, giving 8 of each. The four corner squares of a 4 × 4 grid are all the same colour — they sit at positions (1,1), (1,4), (4,1), (4,4), and in chessboard colouring these are all the same colour (say black, if (1,1) is black). Removing all four leaves 4 black and 8 white squares. Every 2 × 1 tile covers exactly one black and one white square, so any tiling would require equal numbers of each colour. Since 4 ≠ 8, the region cannot be tiled.',
             "new": 'Colour the region like a chessboard. In the full 4 × 4 grid the 16 squares alternate black and white, giving 8 of each. Two opposite corner squares — (1,1) and (4,4) — carry the same colour (say black, if (1,1) is black). Removing both leaves 6 black and 8 white squares. Every 2 × 1 tile covers exactly one black and one white square, so any tiling would require equal numbers of each colour. Since 6 ≠ 8, the region cannot be tiled.'},
        ],
        # ARV-D-209 · brief §5.14 + §6: pairing 6 columns gives THREE 5×2 blocks, not
        # six; the surrounding "in fact … but …" restart after a complete route goes too.
        "ARV-D-209": [
            {"unit": 17, "field": 'visual_aids[0].table',
             "old": '(tile each pair of rows horizontally: five rows give two complete pairs plus one row of 6, which is tiled by three horizontal tiles along the remaining row — in fact since 6 is even, tile column by column: each column of 5 has odd squares, but grouping the 6 columns in pairs of adjacent columns gives six 5 × 2 blocks each tileable by five horizontal tiles, so the whole grid is tileable).',
             "new": ': group the 6 columns into three pairs of adjacent columns, giving three 5 × 2 blocks, and tile each block with five horizontal tiles, one per row.'},
        ],
        # ARV-D-215 · found (§8): the bisection justification named triangles on a vertex
        # O that appears nowhere in the construction (the vertex is T, the cut-points and
        # arc crossing are unnamed). Restated on the points the cell actually builds.
        "ARV-D-215": [
            {"unit": 17, "field": 'visual_aids[0].table',
             "old": 'Each bisection uses the congruence ∆OBC ≅ ∆OAC (SSS) to confirm the bisecting ray divides the angle exactly in half.',
             "new": 'Each bisection uses SSS congruence: the two triangles formed by T, one arc cut-point on each arm, and the crossing point of the equal arcs have three pairs of equal sides (two pairs of equal radii and the common segment from T to the crossing point), confirming the bisecting ray divides the angle exactly in half.'},
        ],
        # ARV-D-219 · found (§8): register — stated minute-quantities in the notes.
        "ARV-D-219": [
            {"unit": 17, "field": 'teacher_notes',
             "old": 'give the class twelve minutes of individual silent work with full working in their notebooks. Then allow five minutes in pairs or threes:',
             "new": 'give the class a first stretch of individual silent work with full working in their notebooks. Then allow a shorter stretch in pairs or threes:'},
        ],
        # ── notes pass ──
        # ARV-D-247 · the P2 note reads as false as written — one bisection of 45°
        # DOES give 22.5°; the intended warning is about reaching 22.5° from 90° in a
        # single step.
        "ARV-D-247": [
            {"unit": 17, "field": 'teacher_notes',
             "old": 'watch for students who assume a 22.5° angle can be produced in one bisection step.',
             "new": 'watch for students who try to reach 22.5° from the 90° angle in a single bisection.'},
        ],
    },
  },
  # RETIRED TO AN APPLIED KEY 2026-08-20 (F1): the ch 11 closer was re-authored again
  # after these two ran (the F1 read found the ant problem in its cube form, not the
  # 3 cm × 12 cm cuboid these edits assume), so ARV-D-185's old/new no longer match
  # disk — left live it would refuse on every F1 run — and ARV-D-186's old string
  # REAPPEARS once ARV-D-216 below removes the duplicated pointer, so left live it
  # would re-fire and reintroduce the duplicate. Kept as the record, unreachable by
  # the 2-tuple lookup.
  ("mathematics", "viii", "APPLIED-20260819"): {
    # ── S7 · the ch 11 RESYNTH read (2026-08-19) ─────────────────────────────────
    # The re-authored closing synthesis (ARV-D-181's fix, first chapter) was read in full
    # at the human gate. Its four worked solutions are correct — 73 holes, 64 cm, 15 cm,
    # and the cylinder's three views all check out, and the 8 cm shortest-path error the
    # FIRST resynth carried is gone. Two faults remain, both in prose around correct
    # mathematics, and both are declared here rather than re-bought.
    "ch_11_canonical.json": {
        # ARV-D-185 · the alternative unfolding is mis-costed. Over a 3 cm × 12 cm face
        # the ant leaves its end face 2 cm from the fold (half of 4), crosses 12, and
        # enters the far face 2 cm: 2 + 12 + 2 = 16. The note used the full 3 cm width
        # twice (3 + 12 + 3 = 18). The VERDICT is untouched and was already right — 15 cm
        # is the shortest path either way — but a teacher who follows the check gets a
        # wrong number, and this is the one line in the unit a teacher would work through
        # aloud at the board.
        "ARV-D-185": [
            {"unit": 17, "field": "visual_aids[0].table",
             "old": "Checking the alternative unfolding over the top face: ant at (0, 1.5), "
                    "crumb at (3 + 12 + 3, 1.5) = (18, 1.5), distance 18 cm.",
             "new": "Checking the alternative unfolding over a 3 cm x 12 cm face: the ant "
                    "leaves its end face 2 cm from the fold, crosses 12 cm, and enters the "
                    "far face 2 cm, giving 2 + 12 + 2 = 16 cm."},
        ],
        # ARV-D-186 · the notes name the prepared table (founder, 2026-08-19). The
        # solutions moved OUT of teacher_notes and into `visual_aids` so the Material tab
        # carries them; without a pointer the notes read as though the working were
        # missing. Science's polish pass settled the convention — "(see material: '…')" —
        # and this follows it in the founder's own words.
        "ARV-D-186": [
            {"unit": 17, "field": "teacher_notes",
             "old": "Pose all four problems on the board at once.",
             "new": "Pose all four problems on the board at once; refer to Prepared Table "
                    "(see material: 'Problems and solutions') for the full statements and "
                    "worked solutions."},
        ],
    },
  },
  ("mathematics", "viii"): {
    # ── F1 · CLOSING-SYNTHESIS REPAIR WAVE (2026-08-20) — see the vi key's header. ─────
    # ── F1 · NOTES PASS entries follow the same doctrine — see the vi key's header. ────
    "ch_01_canonical.json": {
        # ARV-D-248 · stated minute-quantities in the notes (register), and a P3
        # warning describing an impossible action — with exponents 2, 2, 2 no
        # "correct prime-factor triplets" can be formed.
        "ARV-D-248": [
            {"unit": 9, "field": 'teacher_notes',
             "old": 'give students 18 minutes of silent individual working. Then 8 minutes in groups of three:',
             "new": 'give students a sustained stretch of silent individual working. Then a shorter stretch in groups of three:'},
            {"unit": 9, "field": 'teacher_notes',
             "old": 'in Problem 3, students who form correct prime-factor triplets for the cube but forget to re-check the square condition;',
             "new": 'in Problem 3, students who see even exponents and conclude 1764 is a perfect cube as well, without checking that every exponent is a multiple of 3;'},
        ],
    },
    "ch_02_canonical.json": {
        # ARV-D-249 · stated minute-quantities in the notes (register).
        "ARV-D-249": [
            {"unit": 12, "field": 'teacher_notes',
             "old": 'give students 18 minutes to work individually with full written working. Then 8 minutes in groups of three:',
             "new": 'give students a sustained stretch of individual work with full written working. Then a shorter stretch in groups of three:'},
        ],
    },
    "ch_03_canonical.json": {
        # ARV-D-231 · P4's stem describes cuneiform digit groups no scribe could
        # write — "2×10+15" (15 unit-wedges) and "1×10+10" (10 unit-wedges) — in a
        # system whose units run 1–9 within a digit. Values unchanged (35 and 20).
        "ARV-D-231": [
            {"unit": 6, "field": 'visual_aids[0].table',
             "old": 'the left group shows 2×10+15 = 35, and the right group shows 1×10+10 = 20.',
             "new": 'the left group shows 3×10+5 = 35, and the right group shows 2×10 = 20.'},
        ],
    },
    "ch_04_canonical.json": {
        # ARV-D-250 · the P1 note tells the teacher to watch for a co-interior-angles
        # slip in a GENERAL quadrilateral — no parallel sides are given, so no
        # co-interior relationship exists to use or misuse.
        "ARV-D-250": [
            {"unit": 15, "field": 'teacher_notes',
             "old": 'watch for students who stop after finding one unknown angle and forget to use co-interior angles for the second.',
             "new": 'watch for students who find x but stop before converting it into the actual sizes of ∠Q and ∠S.'},
        ],
    },
    "ch_09_canonical.json": {
        # ARV-D-253 · garbled P3 warning ("scaling a non-triple and mistakenly
        # concluding it is primitive") replaced by the slip this problem can produce.
        "ARV-D-253": [
            {"unit": 14, "field": 'teacher_notes',
             "old": 'Problem 3 — scaling a non-triple and mistakenly concluding it is primitive;',
             "new": 'Problem 3 — declaring the triple a scaled one because an entry is even, without computing the GCD of all three numbers;'},
        ],
    },
    "ch_13_canonical.json": {
        # ARV-D-228 · "= 23 − 0" drafting residue in P2's algebra. ARV-D-229 · "the
        # only rival grouping" — 84 × 6 is the strongest rival, not the only one
        # (86 × 4, 68 × 4, 48 × 6, 46 × 8 also exist). ARV-D-255 · stated
        # minute-quantity in the notes (register).
        "ARV-D-228": [
            {"unit": 6, "field": 'visual_aids[0].table',
             "old": 'So 5 + 2k + 3 = 23, giving 2k + 8 = 23 − 0, i.e. 2k = 23 − 8 = 15, so k = 7.5.',
             "new": 'So 5 + 2k + 3 = 23, giving 2k + 8 = 23, i.e. 2k = 15, so k = 7.5.'},
        ],
        "ARV-D-229": [
            {"unit": 6, "field": 'visual_aids[0].table',
             "old": 'Checking the only rival grouping: 84 × 6 = 504 < 512.',
             "new": 'Checking the strongest rival: 84 × 6 = 504 < 512.'},
        ],
        "ARV-D-255": [
            {"unit": 6, "field": 'teacher_notes',
             "old": 'give students 20 minutes of individual silent working before any discussion.',
             "new": 'give students a sustained stretch of individual silent working before any discussion.'},
        ],
    },
    "ch_14_canonical.json": {
        # ARV-D-230 · "A second altitude from P to QR" — the altitude from P to QR is
        # unique; "second" is drafting residue.
        "ARV-D-230": [
            {"unit": 14, "field": 'visual_aids[0].table',
             "old": 'A second altitude from P to QR has foot X on QR.',
             "new": 'The altitude from P to QR has foot X on QR.'},
        ],
    },
    "ch_05_canonical.json": {
        # ARV-D-197 · brief §5.2, WRONG ANSWER: "No solution exists for AB × 7 = CBA" is
        # false — 97 × 7 = 679. The enumeration excluded B = 7 as "repeated digit", but
        # B = 7 forces A = 9 and repeats nothing. Recomputed algebraically:
        # 7(10A+B) = 100C+10B+A ⇒ 3(23A−B) = 100C ⇒ C ∈ {3,6,9}; only C = 6 lands
        # (23·9 = 207, B = 7). The old cell's tail — five abandoned cryptarithm searches
        # and a fourth pipe column with a substitute KL × 9 = MLK — was §6's worst
        # scratch and goes with it; the table is three columns again.
        "ARV-D-197": [
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'Units digit: B × 7 ends in A. Tens and hundreds: the product is a three-digit number whose hundreds digit is A and units digit is B, reversing the original tens-and-units. Try values of B whose units digit of 7B equals A, and check that A (the hundreds digit of CBA) matches the leading digit of AB. B = 4: 7 × 4 = 28, so A = 8; AB = 84; 84 × 7 = 588. Hundreds digit is 5, but A = 8 — no. B = 7: repeated digit — ruled out. B = 2: A = 4; AB = 42; 42 × 7 = 294. CBA should have C in hundreds, B = 2 in tens, A = 4 in units: 294 → C = 2, but B = 2 already — digits not distinct. B = 6: 7 × 6 = 42, A = 2; AB = 26; 26 × 7 = 182. CBA: units = 2 = A ✓, tens = 8 = B? B = 6 ≠ 8 — no. B = 8: A = 6 (since 7 × 8 = 56, units digit 6); AB = 68; 68 × 7 = 476. CBA: units = 6 = A ✓, tens = 7 = B? B = 8 ≠ 7 — no. B = 3: A = 1 (7 × 3 = 21); AB = 13; 13 × 7 = 91 — only two digits, not three. B = 5: A = 5 — repeated. B = 9: A = 3 (7 × 9 = 63); AB = 39; 39 × 7 = 273. CBA: units = 3 = A ✓, tens = 7 = B? B = 9 ≠ 7 — no. B = 1: A = 7 (7 × 1 = 7); AB = 71; 71 × 7 = 497. CBA: units = 7 = A ✓, tens = 9 = B? B = 1 ≠ 9 — no. No solution exists for AB × 7 = CBA with all digits distinct. (Use AB × 9 = CBA instead: B = 1, A = 9 — repeated; B = 8, A = 2 (9×8=72): AB = 28, 28×9 = 252 — C=2,B=5,A=2 repeated; B = 9 repeated. Use the cryptarithm MN × 4 = NM: units digit of 4N = M; N=3,M=2: 32×4=128 three digits; N=8,M=2: 4×8=32 units=2=M✓, 28×4=112 three digits; N=2,M=8: 28×4=112 nope. Use AB × 3 = CBA: B×3 units = A; B=5,A=5 repeated; B=7,A=1: AB=17,17×3=51 two digits; B=8,A=4: AB=48,48×3=144,CBA=144,C=1,B=4,A=4 repeated. Use the well-formed cryptarithm MN × 4 = NNM — not standard. Use KL × 9 = MLK: L×9 units=K; L=9 gives K=1(81): KL=19,19×9=171,MLK→M=1=K repeated; L=1,K=9: KL=91 but L=1 means units=9 and 91×9=819,MLK=819,M=8,L=1✓,K=9✓, all distinct. Solution: 91×9=819, so K=9,L=1,M=8.) | Use the cryptarithm KL × 9 = MLK. Units step: L × 9 must end in K. Try L = 1: 9 × 1 = 9, so K = 9. Then KL = 91. Check: 91 × 9 = 819. Write as MLK: M = 8, L = 1, K = 9. All three digits distinct and non-zero. ✓ Solution: K = 9, L = 1, M = 8.',
             "new": 'Units digit: B × 7 must end in A. Write the whole product: 7 × (10A + B) = 100C + 10B + A, so 70A + 7B = 100C + 10B + A, which simplifies to 69A − 3B = 100C, i.e. 3(23A − B) = 100C. Since 3 divides the left side and 3 does not divide 100, C must be a multiple of 3: C = 3, 6, or 9. C = 3 needs 23A − B = 100: no digit A puts 23A in the range 100–109. C = 6 needs 23A − B = 200: A = 9 gives 23 × 9 = 207, so B = 7. C = 9 needs 23A − B = 300: no digit A reaches 300–309. So A = 9, B = 7. Check: AB = 97 and 97 × 7 = 679 = CBA with C = 6, B = 7, A = 9 — the units digit of 7 × 7 = 49 is 9 = A ✓, and the digits 9, 7, 6 are all distinct. Solution: A = 9, B = 7, C = 6.'},
        ],
        # ARV-D-201 · brief §5.6 + §6: 3A5B72 needs A+B ∈ {1,10} (by 9) and A+B ∈ {2,13}
        # (by 11) — empty intersection, "find all pairs" had no answer. The cell's own
        # editorial note proposed 3A5B18; that is now THE problem (A+B = 1: 305118 and
        # 315018, both verified ÷99), and the note plus the fourth pipe column go.
        "ARV-D-201": [
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'form 3A5B72, where A and B',
             "new": 'form 3A5B18, where A and B'},
            {"unit": 12, "field": 'visual_aids[0].table',
             "old": 'Divisibility by 9: digit sum = 3 + A + 5 + B + 7 + 2 = 17 + A + B must be divisible by 9, so A + B = 1 or A + B = 10 (since A, B are digits, A + B ≤ 18; next would be 19, impossible). Divisibility by 11: alternating sum (units upward) = 2 − 7 + B − 5 + A − 3 = A + B − 13 must be 0 or a multiple of 11, so A + B − 13 = 0 giving A + B = 13, or A + B − 13 = −11 giving A + B = 2, or A + B − 13 = 11 giving A + B = 24 (impossible). The two conditions together require A + B to satisfy both lists: {1, 10} ∩ {2, 13} = empty — no pair satisfies both simultaneously. (Teacher note: if the problem is to have a solution, replace 72 with 18: digit sum becomes 3 + A + 5 + B + 1 + 8 = 17 + A + B, same constraint; alternating sum = 8 − 1 + B − 5 + A − 3 = A + B − 1, must be 0 or ±11, giving A + B = 1 or A + B = 12. Intersection with {1, 10}: A + B = 1. With A + B = 1, single-digit pairs: (0,1) and (1,0). Both valid. Use the number 3A5B18 in class.) | Use the number 3A5B18. Digit sum = 3 + A + 5 + B + 1 + 8 = 17 + A + B divisible by 9 → A + B = 1 or A + B = 10. Alternating sum (from units) = 8 − 1 + B − 5 + A − 3 = A + B − 1 must be 0 or ±11 → A + B = 1 or A + B = 12. Intersection: A + B = 1. Digit pairs: (A, B) = (0, 1) giving 305118, and (A, B) = (1, 0) giving 315018. Both are divisible by 9 and by 11.',
             "new": 'Divisibility by 9: digit sum = 3 + A + 5 + B + 1 + 8 = 17 + A + B must be divisible by 9, so A + B = 1 or A + B = 10 (the next multiple of 9 would need A + B = 19, impossible for digits). Divisibility by 11: alternating sum (units upward) = 8 − 1 + B − 5 + A − 3 = A + B − 1 must be 0 or a multiple of 11, so A + B = 1 or A + B = 12. Both conditions hold only for A + B = 1. Digit pairs: (A, B) = (0, 1) giving 305118, and (A, B) = (1, 0) giving 315018. Both are divisible by 9 and by 11.'},
        ],
        # ARV-D-214 · found (§8): the notes' Problem-4 watch-for referenced "the
        # units-digit of KKK" — a cryptarithm the problem does not contain (a draft
        # survivor). Repointed at the problem actually posed.
        "ARV-D-214": [
            {"unit": 12, "field": 'teacher_notes',
             "old": 'in Problem 4, students not using the units-digit of KKK to pin K before trying other digits',
             "new": 'in Problem 4, students not using the units-digit constraint (B × 7 must end in A) to narrow the search before trying digits'},
        ],
    },
    "ch_07_canonical.json": {
        # ARV-D-212 · brief §6: a wrong direct-proportion trial ("? = 960 ÷ 15 = 64")
        # stated before being retracted, and a retraction that contradicts itself. The
        # Rule of Three stays (it is the unit's named method) but runs through the fixed
        # volume, which is the inverse-proportion route that actually holds.
        "ARV-D-212": [
            {"unit": 17, "field": 'visual_aids[0].table',
             "old": 'Using the Rule of Three: 15 litres : 40 minutes :: 24 litres : ? minutes. Cross multiply: 15 × ? = 24 × 40, so ? = 960 ÷ 15 = 64 — but this applies only if more litres per minute means more time, which it does not. The direct proportion here is between litres per minute and the number of minutes to fill: more rate, fewer minutes, so the proportion is inverse. Correct route: time = total volume ÷ rate = 600 ÷ 24 = 25 minutes.',
             "new": 'The rate and the time are in inverse proportion — more litres per minute means fewer minutes — so the Rule of Three runs through the fixed volume: 24 × ? = 15 × 40 = 600, giving ? = 600 ÷ 24 = 25 minutes.'},
        ],
        # ── notes pass ──
        # ARV-D-251 · P3 names the two-part formula m·x/(m+n) for a THREE-part share;
        # P4 claims "a unit conversion" and warns about HECTARES — no conversion
        # happens and hectares appear nowhere; the pre-proportion step is the area.
        "ARV-D-251": [
            {"unit": 17, "field": 'teacher_notes',
             "old": 'Problem 3 needs the sharing formula (m·x/(m+n)).',
             "new": 'Problem 3 needs the sharing formula (each share = its ratio part ÷ the sum of parts × the total).'},
            {"unit": 17, "field": 'teacher_notes',
             "old": 'Problem 4 needs a proportion set up after a unit conversion.',
             "new": 'Problem 4 needs a proportion set up after computing the area.'},
            {"unit": 17, "field": 'teacher_notes',
             "old": 'students in Problem 4 who skip the conversion step and proportion straight from hectares to square metres.',
             "new": 'students in Problem 4 who proportion from a side length instead of the area.'},
        ],
    },
    "ch_08_canonical.json": {
        # ARV-D-198 · brief §5.3: the stem's "compared with the start of the first year"
        # gives 100 + 8 − 15 = 93 (−7%), while the solution's 1.08 × 0.85 = 0.918 (−8.2%)
        # needs the fall measured against the END of year 1. The stem drops the clause;
        # solution and notes (which rightly brand percent-adding as the error) now agree.
        "ARV-D-198": [
            {"unit": 14, "field": 'visual_aids[0].table',
             "old": 'fell by 15% in the second year compared with the start of the first year.',
             "new": 'fell by 15% in the second year.'},
        ],
        # ── notes pass ──
        # ARV-D-252 · the P2 warning names "the reduced one" — nothing is reduced at
        # the point the 20% applies; the discount is computed on the MARKED price.
        "ARV-D-252": [
            {"unit": 14, "field": 'teacher_notes',
             "old": 'Problem 2 — computing the second percentage on the original price instead of the reduced one (the multiplier chain corrects this);',
             "new": 'Problem 2 — computing the discount on the cost price instead of the marked price (the multiplier chain 1.25 × 0.80 corrects this);'},
        ],
    },
    "ch_10_canonical.json": {
        # ARV-D-210 · brief §5.15: "every problem … was solved by the same idea: … a
        # fixed ratio" is false for Problem 4 (inverse proportion — constant PRODUCT) and
        # reverses the distinction the preceding sitting is built on.
        "ARV-D-210": [
            {"unit": 12, "field": 'time_bands[4].activity',
             "old": 'was solved by the same idea: when two quantities share a fixed ratio, knowing one tells you the other. That single idea, used carefully, is all the chapter needed.',
             "new": 'was solved by naming how its two quantities are tied: in direct proportion the ratio stays fixed, in inverse proportion the product does. Once the tie is named, knowing one quantity tells you the other — and that habit, used carefully, is all the chapter needed.'},
        ],
        # ── notes pass ──
        # ARV-D-254 · known: P1 has exactly ONE pair of ratios, so "check only one
        # pair and stop" describes the complete method, not an error. The real rival
        # is additive comparison.
        "ARV-D-254": [
            {"unit": 12, "field": 'teacher_notes',
             "old": 'watch for students who check only one pair of ratios and stop.',
             "new": 'watch for students who compare the mixtures by subtracting (9 − 3 against 24 − 8) instead of testing the ratios.'},
        ],
    },
    "ch_11_canonical.json": {
        # ARV-D-211 · brief §5.16: both endpoints were face centres, so the offset is
        # zero and the cell's own line reads √(0 + 64) = 8 — a plain sum wearing the
        # Baudhayana–Pythagoras theorem's name; the described four-face strip also is
        # not the net the coordinates use. Endpoints moved to diagonally opposite cube
        # corners (the classic): unfold two faces, √(4² + 8²) = √80 = 4√5 ≈ 8.9 cm, and
        # the theorem is genuinely needed. Notes and bands already name exactly this
        # method and stand unchanged.
        "ARV-D-211": [
            {"unit": 17, "field": 'visual_aids[0].table',
             "old": 'An ant sits at the centre of one 4 cm × 4 cm face of a 4 cm × 4 cm × 4 cm cube (a standard cube). A grain of sugar sits at the centre of the opposite face.',
             "new": 'An ant sits at a bottom corner of a 4 cm × 4 cm × 4 cm cube. A grain of sugar sits at the top corner of the cube farthest from the ant (the diagonally opposite corner).'},
            {"unit": 17, "field": 'visual_aids[0].table',
             "old": "Unfold the cube by laying the ant's face flat, then unrolling the four side faces in a strip, then the sugar's face at the far end. The ant is at (2, 2) on the first face; the sugar maps to (2, 10) after unfolding (2 + 4 + 4 = 10). The straight-line distance on the unfolded net = √((2−2)² + (10−2)²) = √(0 + 64) = 8 cm. Shortest surface path = 8 cm.",
             "new": 'Unfold the front face and the top face of the cube into one flat 4 cm × 8 cm rectangle. The ant is at (0, 0); the sugar, at the far corner of the top face, maps to (4, 8). By the Baudhayana–Pythagoras theorem, the straight-line distance on the unfolded net = √(4² + 8²) = √80 = 4√5 ≈ 8.9 cm. Any unfolding across two faces gives the same figure, and the route along the edges (4 + 4 + 4 = 12 cm) is longer. Shortest surface path = 4√5 ≈ 8.9 cm.'},
        ],
        # ARV-D-216 · found (§8): the notes carried the Prepared-Table pointer TWICE —
        # the ARV-D-186 declared insertion and the ARV-D-187 generic prepend landed
        # together. The second (mid-notes) copy goes; the opening pointer stays.
        "ARV-D-216": [
            {"unit": 17, "field": 'teacher_notes',
             "old": "Pose all four problems on the board at once; refer to Prepared Table (see material: 'Problems and solutions') for the full statements and worked solutions.",
             "new": 'Pose all four problems on the board at once.'},
        ],
    },
    "ch_12_canonical.json": {
        # ARV-D-199 · brief §5.4: "City B has the higher mean" is not derivable from the
        # three points given (14 Jan · 38 May · 16 Dec); the justification imported
        # "May–September above 30 °C" from nowhere, and a plain monotone reading puts
        # B's mean BELOW A's. The question now asks what the given points settle: range,
        # and who is warmer in January and in May.
        "ARV-D-199": [
            {"unit": 16, "field": 'visual_aids[0].table',
             "old": 'Which city has the higher mean annual temperature? Which has the higher temperature range? Justify both answers without computing exact means.',
             "new": 'Which city has the higher temperature range? And which city is warmer in January, and which in May? Justify each answer from the shape of the lines, without computing.'},
            {"unit": 16, "field": 'visual_aids[0].table',
             "old": "Mean annual temperature: City A's values are clustered tightly around 26°C all year; City B's values are much higher in the summer months (May–September above 30°C) but lower in winter — a rough balance suggests City B's annual mean is higher than City A's 24–28°C band. City B has the higher mean. Range: City A's range = 28−24 = 4°C; City B's range = 38−14 = 24°C. City B has the higher range. (Inference from graph pattern; exact computation not required.)",
             "new": "Range: City A's line stays inside a band from 24°C to 28°C, so its range is at most 28 − 24 = 4°C; City B's range = 38 − 14 = 24°C. City B has the far higher range. January: City B reads 14°C while City A never falls below 24°C, so City A is warmer. May: City B reads 38°C while City A never rises above 28°C, so City B is warmer. (All three answers come from comparing the positions of the lines; no means are computed.)"},
        ],
    },
    # ARV-D-180 · viii ch 12 p13 Q-C-10 is a SHELL. Declared MCQ, and it asks nothing:
    # prompt "", options [], expected_answer "", method_one_line "",
    # what_each_option_reveals {}. The one field the model did fill is the `exercise`
    # companion — "Figure it Out Q5, section 5.2 p.127 · check whether each statement is
    # true (with algebraic justification): (i) average of two even numbers is even;
    # (ii) average of any two multiples of 5 is a multiple of 5; (iii) average of any 5
    # multiples of 5 is a multiple of 5" — so it knew what it meant to ask and stopped.
    # Nothing here can be repaired by substitution; there is no text to substitute.
    #
    # ★ THIS ENTRY AUTHORS TEXT, like amend_missing_questions.py and unlike a normal
    # declared repair. Founder ruling 2026-08-19: "generate an equivalent question" —
    # equivalent to what the shell was anchored on, rather than re-buying the compact.
    #
    # THE QUESTION IS BUILT ON STATEMENT (ii) OF THE BOOK EXERCISE, and asks for the
    # counterexample rather than the verdict. Three reasons, all constraints rather than
    # taste: the item's declared type is MCQ and an MCQ cannot carry the "with algebraic
    # justification" the exercise wants; all THREE statements are false in general
    # (5,10 → 7.5 · 2,4 → 3 · 5,5,5,5,10 → 6), so "which is true?" would need a
    # none-of-these option and Rule 10 bans by-label options outright; and a
    # counterexample IS the algebraic point in miniature — 5a and 5b average to
    # 5(a+b)/2, which leaves the multiples of 5 exactly when a+b is odd.
    #
    # The three distractors are the three ways to misread the task, not filler: each is a
    # pair whose average IS a multiple of 5, so choosing any of them means the student
    # looked for a pair that CONFIRMS the claim. what_each_option_reveals says so per
    # option. `goal` stays "apply", `section_ref` stays "section 5.2", the exercise block
    # is untouched, and `verified` is left false — this text has not been through a
    # verification pass and must not claim it has.
    #
    # NOT ONE LETTER APPEARS IN THE GUIDE PROSE, and the first draft of this entry got
    # that wrong. It opened the expected answer with "B." and had two of the reveals
    # refer to "the same error as A". STEP 6 then arranged the options and moved the
    # correct pair to A — it remaps the reveals DICT KEYS (normalize_options.py:180-182,
    # written for exactly this) but it cannot rewrite prose, so the guide was left
    # pointing at the wrong letters the moment it was installed. The draft was rolled
    # back from backup/c3_repair/ and rewritten rather than patched, so the artefact
    # carries one declared repair instead of a mistake and its correction. The rule this
    # leaves behind is general: a label is the platform's to assign, so guide text names
    # the PAIR ("5 and 10"), never the letter beside it.
    "ch_12_canonical_p13.json": {
        "ARV-D-180": [
            {"item_where": {"id": "Q-C-10"},
             "field": "prompt",
             # `None`, not "" — see the empty-`old` guard in apply_declared. This entry is
             # what found that hazard: declared as a replace, it re-fired on 2026-08-20 and
             # exploded the prompt to 17,955 characters. As a SET it is idempotent, and it
             # still refuses if anything but the expected value is on disk.
             "old": None,
             "new": "Meera claims: 'The average of any two multiples of 5 is itself a "
                    "multiple of 5.' Which pair of numbers shows that her claim is "
                    "false?"},
            {"item_where": {"id": "Q-C-10"},
             "field": "options",
             "old": [],
             # DECLARED ORDER IS NOT THE SERVED ORDER and does not try to be — STEP 6
             # arranges, and it remaps the reveals keys with the options. What matters,
             # and what the second draft of this entry got wrong, is that the reveals
             # below are keyed to the pairs AS DECLARED HERE, pair for pair. Get that
             # agreement right and any arrangement preserves it; get it wrong and the
             # remap faithfully carries the mismatch through.
             "new": [{"label": "A", "text": "5 and 10", "is_correct": True},
                     {"label": "B", "text": "10 and 20", "is_correct": False},
                     {"label": "C", "text": "15 and 25", "is_correct": False},
                     {"label": "D", "text": "20 and 30", "is_correct": False}]},
            # THE GUIDE GOES IN AS ONE OBJECT, not four dotted edits. `get_nested` reads
            # `name[i].leaf` and plain keys only — "teacher_guide.expected_answer" is
            # taken as a literal key and reads None, which is how this first refused.
            # Declaring the whole block is the better shape anyway: the four fields are
            # one authored act and must land together or not at all. `inclusivity.support`
            # is carried through byte-for-byte — it is the model's, not ours.
            {"item_where": {"id": "Q-C-10"},
             "field": "teacher_guide",
             "old": {"expected_answer": "", "method_one_line": "",
                     "what_each_option_reveals": {},
                     "inclusivity": {
                         "support": "Refer to the book exercise(s) anchored to "
                                    "section 5.2.",
                         "challenge": ""}},
             "new": {"expected_answer":
                     "The pair 5 and 10. Their average is 7.5, which is not a multiple "
                     "of 5 — it is not even a whole number — so that one pair is enough "
                     "to bring the claim down. The other three pairs average to 15, 20 "
                     "and 25, every one a multiple of 5, so none of them settles "
                     "anything. Algebraically, two multiples of 5 are 5a and 5b and "
                     "their average is 5(a+b)/2: it stays a multiple of 5 exactly when "
                     "a+b is even, and leaves as soon as a+b is odd. For 5 and 10, "
                     "a+b = 1+2 = 3.",
                     "method_one_line":
                     "Average each pair and test the result against 'multiple of 5'; one "
                     "pair that fails is enough to disprove a claim about ALL pairs.",
                     "what_each_option_reveals": {
                         "A": "5 and 10 average to 7.5 — not a multiple of 5, and not a "
                              "whole number. This is the counterexample the claim cannot "
                              "survive.",
                         "B": "10 and 20 average to 15, a multiple of 5. The student has "
                              "offered a pair that CONFIRMS the claim as though it "
                              "disproved it, so the logic of a counterexample has not "
                              "landed.",
                         "C": "15 and 25 average to 20, again a multiple of 5. Same "
                              "confirming-instead-of-refuting error; may also mean the "
                              "student is hunting for the pair that looks hardest rather "
                              "than testing the claim.",
                         "D": "20 and 30 average to 25, a multiple of 5. Worth asking "
                              "this student what a single counterexample is FOR."},
                     "inclusivity": {
                         "support": "Refer to the book exercise(s) anchored to "
                                    "section 5.2.",
                         "challenge":
                         "Ask for the general rule: for which pairs of multiples of 5 "
                         "does the average stay a multiple of 5? Then push on to "
                         "statement (iii) of the book exercise — five multiples of 5 "
                         "average to a+b+c+d+e, always a whole number but a multiple of "
                         "5 only when that sum is."}}},
        ],
    },
  },
  ("science", "ix"): {
    # ── S3 · science · IX · ch 7 p18 (2026-08-17, batch wave 2) ──────────────────────
    # ARV-D-172 · `question_text: null` on the file's single OPEN_TASK (7.6.3 Lever,
    # the beam-balance table task). Unlike ARV-D-120b nothing is authored here: on an
    # OPEN_TASK the stem MUST be empty ("" — the prompt lives in `task`, where this
    # item's already is, in full). null -> "" is the whole repair; the certifier's
    # str(None) rendering ('None') is what tripped the gate.
    "ch_07_canonical_p18.json": {
        "ARV-D-172": [
            {"item_where": {"question_type": "OPEN_TASK", "section_label": "7.6.3 Lever"},
             "field": "question_text",
             "old": None, "new": ""},
        ],
    },
  },
  ("science", "vi"): {
    # ── S6 · science · middle · VI ch 12 third-pass resynth unit (2026-08-18) ─────────
    # ARV-D-176 · the F1-resynth read's ruling on "Postcards from the Dark Sky Camp":
    # identification layer fully within every compact, but two teacher-notes MANDATES
    # grade mechanisms p08 never taught (Venus orbit-position; comet evaporation/tail
    # direction — and the Milky-Way disc geometry no plan teaches). Founder-approved
    # rewording to supply-if-unmet: a teacher closing a synthesis legitimately adds a
    # fact at the margin; she must not be told to withhold credit for it. Third edit
    # deletes the early-finisher extension that duplicates Postcard 2 (already the
    # Milky Way faint band) — pure deletion, no replacement authored.
    "ch_12_canonical.json": {
        # ── ARV-D-178 · F2 (C14) ruling, 2026-08-18: the batch's single longest
        # verbatim run (28 words) — an MCQ option carrying the planetary inner/outer
        # contrast in the BOOK's phrasing. Facts stay, expression becomes ours.
        # (First declared as a SECOND "ch_12_canonical.json" key — the duplicate-dict-key
        # silent-shadow trap, hit for the second time today; merged here, where it runs.)
        "ARV-D-178": [
            {"item_where": {"question_type": "MCQ", "progression_stage": 3,
                            "question_text": "Which of the following correctly "
                            "describes the structural difference between the inner "
                            "four planets and the outer four planets of the Solar "
                            "System?"},
             "field": "options[2].text",
             "old": "The inner four planets are smaller and have solid rocky surfaces; "
                    "the outer four are much larger, mostly made of gas and ice, and "
                    "have ring-like structures.",
             "new": "The four planets nearest the Sun are compact worlds of rock with "
                    "firm surfaces, while the four beyond them are giants built chiefly "
                    "of gas and ice, each carrying a system of rings."},
        ],
        "ARV-D-176": [
            {"unit": 14, "field": "teacher_notes",
             "old": "check that replies include both the orbit-position reasoning and "
                    "the atmosphere explanation for its brightness; neither alone is "
                    "sufficient.",
             "new": "check that replies explain its brightness; if the orbit-position "
                    "reasoning surfaces in no group, supply it as the chapter's fact "
                    "and ask groups to fold it into their reply."},
            {"unit": 14, "field": "teacher_notes",
             "old": "the tail points away from the Sun); prompt those groups to add "
                    "the 'why it looks that way' sentence.",
             "new": "the tail points away from the Sun); if no group produces the "
                    "mechanism, supply it and ask them to add the 'why it looks that "
                    "way' sentence."},
            {"unit": 14, "field": "teacher_notes",
             "old": "If a group finishes early, ask them to add a fifth 'reply' for a "
                    "hypothetical postcard describing the Milky Way as a faint band — "
                    "this extends to Section 12.4 without being required of all "
                    "groups. ",
             "new": ""},
        ],
    },
    # ── S6 · science · middle · VI ch 2 resynth unit (2026-08-18, F1-resynth read) ────
    # ARV-D-175 · factual slip in the re-authored synthesis's model answer: the money
    # plant's card evidence ("soft green stem needing support") is the chapter's own
    # diagnostic for a CLIMBER (takes support; a creeper crawls on the ground), yet the
    # band labels it "creeper". One word; the card evidence, venation, root and habitat
    # readings all stay. Run: repair_c3.py science vi 2 --declared-only
    "ch_02_canonical.json": {
        "ARV-D-175": [
            {"unit": 21, "field": "time_bands[2].activity",
             "old": "soft green stem needing support — creeper",
             "new": "soft green stem needing support — climber"},
        ],
    },
    # ── S6 · science · middle · VI ch 8 (2026-08-17, batch wave 1) ───────────────────
    # ARV-D-173 · same defect as ARV-D-172, next stage over: `question_text: null` on the
    # file's single OPEN_TASK (the water-cycle classification table, stage 5). The item is
    # complete — task, scaffold, format_of_output, full guide — so null -> "" is again the
    # whole repair. Science·middle items carry no section_label (stage-anchored), so the
    # selector is question_type alone, which the certify report confirms is unique in this
    # library. Run as: python3 genon/repair_c3.py science vi 8 --declared-only
    "ch_08_canonical.json": {
        "ARV-D-173": [
            {"item_where": {"question_type": "OPEN_TASK"},
             "field": "question_text",
             "old": None, "new": ""},
        ],
    },
  },
  ("science", "vii"): {
    # ── S6 · science · middle · VII ch 4 p09 (2026-08-17, batch wave 2) ──────────────
    # ARV-D-174 · third instance of the ARV-D-172 family (172 science·ix ch 7 p18,
    # 173 science·vi ch 8): `question_text: null` on the compact's single OPEN_TASK,
    # item otherwise complete. null -> "" again. The rate — 3 in ~190 authored files
    # across two stages — says the schema's `// "" for OPEN_TASK` comment reads as
    # optional to the model roughly 1.5% of the time; a constitution-side fix is only
    # worth it if the rate holds at S7+. Run: repair_c3.py science vii 4 --declared-only
    "ch_04_canonical_p09.json": {
        "ARV-D-174": [
            {"item_where": {"question_type": "OPEN_TASK"},
             "field": "question_text",
             "old": None, "new": ""},
        ],
    },
    # ── ARV-D-177 · polish-fidelity read findings (2026-08-18, founder-licensed). The
    # gap-fill inventions were ACCEPTED as authored content; these five edits are the
    # read's specific corrections. All on the FINAL (synthesis) unit's visual_aids;
    # units are the top's last period per chapter.
    "ch_02_canonical.json": {
        "ARV-D-177": [
            # the response-sheet aid dropped the old materials' neutralisation-equation
            # box; restored as a footer row so the printed sheet has somewhere to write.
            {"unit": 15, "field": "visual_aids[1].table",
             "old": "4 — Stream water (downstream) | Red rose extract turns red to "
                    "green | | |",
             "new": "4 — Stream water (downstream) | Red rose extract turns red to "
                    "green | | |\nWrite the neutralisation reaction for one "
                    "correction: | | | |"},
        ],
    },
    "ch_03_canonical.json": {
        "ARV-D-177": [
            # "Semiconductor" is above the chapter's register (the chapter treats the
            # LED only through polarity / long-wire-positive); "Resistive" likewise.
            {"unit": 18, "field": "visual_aids[1].table",
             "old": "Semiconductor component; polarity must be respected",
             "new": "Polarity-sensitive component; long wire connects to positive"},
            {"unit": 18, "field": "visual_aids[1].table",
             "old": "Resistive component; no polarity requirement",
             "new": "Glows whichever way current flows; no polarity requirement"},
        ],
    },
    "ch_05_canonical.json": {
        "ARV-D-177": [
            # "particulate reasoning" is not a strand this chapter's plans teach —
            # unsourced concept claim in two aids.
            {"unit": 15, "field": "visual_aids[2].text",
             "old": "reversibility with particulate reasoning",
             "new": "reversibility"},
            {"unit": 15, "field": "visual_aids[3].text",
             "old": "desirability, particulate reasoning, slow natural change",
             "new": "desirability, slow natural change"},
        ],
    },
    "ch_11_canonical.json": {
        "ARV-D-177": [
            # the scene-card aid claims luminous vs non-luminous is covered but its
            # mapping table assigns it to no scene — the claim goes, the scenes stand.
            {"unit": 18, "field": "visual_aids[0].text",
             "old": "Principles covered across the five scenes: luminous vs. "
                    "non-luminous sources; rectilinear propagation",
             "new": "Principles covered across the five scenes: rectilinear "
                    "propagation"},
        ],
    },
  },
  ("mathematics", "ix"): {
    "ch_04_canonical.json": {
        "ARV-D-069": [
            {"unit": 3, "field": "time_bands[2].activity",
             "old": "— that is the focal error today.",
             "new": "— that is the focal error to watch for."},
        ],
        "ARV-D-070": [
            {"unit": 12, "field": "time_bands[0].activity",
             "old": "Students who judged the derivations in the previous unit share their "
                    "verdicts",
             "new": "Students who judged these two derivations share their verdicts"},
            {"unit": 12, "field": "time_bands[2].activity",
             "old": "not finished in the previous unit,",
             "new": "not yet finished,"},
        ],
        "ARV-D-030": [
            {"row": 7, "field": "section_context",
             "old": "binomial cube identities, sum and difference of cubes, three-variable cube "
                    "identity, factorisation and numerical application",
             "new": "binomial cube identities, sum and difference of cubes, three-variable cube "
                    "identity"},
            {"row": 9, "field": "section_context",
             "old": "integrative identity selection, expansion, factorisation, rational "
                    "simplification, geometric and numerical application across the chapter",
             "new": "integrative identity selection, expansion, factorisation, and rational "
                    "simplification across the chapter"},
        ],
        "ARV-D-074": [
            {"row": 6, "field": "period_numbers", "old": [8, 9], "new": [8]},
            {"row": 7, "field": "period_numbers", "old": [10, 11, 12], "new": [10, 11]},
        ],
        "ARV-D-075": [
            {"row": 5, "field": "c_code", "old": "C-9.3", "new": "C-3.1"},
        ],
    },
    "ch_04_canonical_p12.json": {
        "ARV-D-069": [
            {"unit": 7, "field": "teacher_notes",
             "old": "two skills that will recur when simplifying rational expressions",
             "new": "two skills that also underpin the simplification of rational expressions"},
            {"unit": 7, "field": "teacher_notes",
             "old": "may be set for later self-study once section 4.7 has been taught.",
             "new": "may be set for self-study by students who have already met the cube "
                    "identities."},
            {"unit": 7, "field": "homework[0]",
             "old": "End of Chapter Q1, p.88 — complete any remaining parts (vii)–(ix) after "
                    "section 4.7 is covered.",
             "new": "End of Chapter Q1, p.88 — complete any remaining parts (vii)–(ix), which "
                    "draw on the cube identities."},
            {"unit": 12, "field": "teacher_notes",
             "old": "a natural place for a final unit that advances coverage",
             "new": "a natural place for a unit that advances coverage"},
        ],
        "ARV-D-070": [
            {"unit": 3, "field": "teacher_notes",
             "old": "Having derived (a+b)² in the previous unit, this unit runs",
             "new": "Having derived (a+b)², this unit runs"},
            {"unit": 6, "field": "teacher_notes",
             "old": "Having seen middle-term splitting via the tile model in the previous unit, "
                    "students now",
             "new": "Having seen middle-term splitting via the tile model, students now"},
            {"unit": 9, "field": "teacher_notes",
             "old": "Having derived the binomial-cube identities in the previous unit, this unit",
             "new": "Having derived the binomial-cube identities, this unit"},
            {"unit": 11, "field": "teacher_notes",
             "old": "a higher demand than the rational-expression simplification of the previous "
                    "unit.",
             "new": "a higher demand than rational-expression simplification."},
        ],
    },
    "ch_04_canonical_p09.json": {
        "ARV-D-070": [
            {"unit": 2, "field": "time_bands[0].activity",
             "old": "Revisit the identity (a+b)^2 = a^2+2ab+b^2 from the previous unit's work and "
                    "pose",
             "new": "Revisit the identity (a+b)^2 = a^2+2ab+b^2 and pose"},
            {"unit": 9, "field": "time_bands[2].activity",
             "old": "for any items not completed in the previous unit.",
             "new": "for any items not yet completed."},
        ],
        "ARV-D-030": [
            {"row": 5, "field": "section_context",
             "old": "x^2, x, and unit tiles; rectangle model for (x+3)(x+4) and (2x+3)(3x+1); "
                    "middle-term split validated spatially",
             "new": "x^2, x, and unit tiles; rectangle model validating the middle-term split "
                    "spatially"},
        ],
        "ARV-D-075": [
            {"row": 5, "field": "c_code", "old": "C-9.3", "new": "C-3.1"},
            {"row": 6, "field": "c_code", "old": "C-3.1", "new": "C-9.3"},
        ],
    },
    # ── C3 content-correctness check, Part II · chapter 9 (2026-10-02) ──────────────────
    # Findings: genon/out/content_checks/mathematics_ix_part2_findings.md, ids C9-nn.
    # Founder-approved the same day ("go ahead and apply fix"). Text-only edits; no unit,
    # item, anchor or handoff structure changes.
    "ch_09_canonical.json": {
        "C9-01": [
            {"unit": 6, "field": "time_bands[1].activity",
             "old": "(b) no, it does not matter how they cross as long as the endpoints are joined.",
             "new": "(b) it may matter — equal diagonals are only a necessary condition for type Q, so the way the equal sticks are crossed may decide whether the quadrilateral is of type Q."},
        ],
        "C9-02": [
            {"unit": 6, "field": "time_bands[2].activity",
             "old": "(a) yes — we want any quadrilateral with equal diagonals to be of type Q, so the construction must produce one by using equal sticks; (b) now it does matter — different placements of equal sticks produce different shapes (a rectangle versus an isosceles trapezium), and not all of them may be 'of type Q', so the placement constrains the category.",
             "new": "(a) equal sticks are enough — any quadrilateral with equal diagonals is of type Q; (b) no — however the equal sticks are placed, the quadrilateral has equal diagonals and is therefore of type Q (a rectangle and an isosceles trapezium both qualify)."},
        ],
        "C9-03": [
            {"unit": 15, "field": "time_bands[2].activity",
             "old": "Part (i)(b): does placement matter? No — any crossing of equal sticks gives equal diagonals.",
             "new": "Part (i)(b): does placement matter? It may — equal diagonals are needed for type Q but need not be enough, so some crossings of equal sticks may not give a type-Q quadrilateral."},
        ],
        "C9-04": [
            {"unit": 15, "field": "time_bands[2].activity",
             "old": "Part (ii)(b): does placement matter? Yes — different crossings of equal sticks give different quadrilaterals, and not all may be type Q.",
             "new": "Part (ii)(b): does placement matter? No — every crossing of equal sticks gives equal diagonals, and every quadrilateral with equal diagonals is of type Q."},
        ],
        "C9-09": [
            {"unit": 12, "field": "time_bands[1].activity",
             "old": "Type A requires larger n (e.g. n = 10: 401 — prime; n = 15: 901 = 17 × 53).",
             "new": "Type A finds n = 4 gives 65 = 5 × 13."},
        ],
        "C9-11": [
            {"unit": 11, "field": "teacher_notes",
             "old": "'e.g. 6 is divisible by 2 and 4 but not by 8, therefore the converse is false'",
             "new": "'e.g. 12 is divisible by 2 and 4 but not by 8, therefore the converse is false'"},
        ],
        "C9-13": [
            {"unit": 13, "field": "time_bands[2].activity",
             "old": "Draw out that the altitude was chosen because it creates a right angle, enabling AAS — a different construction from A would have created a different pair of triangles without a known angle.",
             "new": "Draw out that the altitude works because it gives a right angle on each side, enabling AAS; the bisector of angle A works too (equal angles at A and at B, C, with AD common), but the median from A does not lead to a congruence criterion."},
        ],
        "C9-14": [
            {"item_where": {"question_type": "OPEN_TASK"}, "field": "guide.OPEN_TASK.reading_the_scaffold",
             "old": "The hint for Proposition B points to the ±y root structure, which is the counterexample mechanism for the converse.",
             "new": "The hint for Proposition B points to the ±y root structure, which is the counterexample mechanism for Proposition B itself; its converse (if x = y then x² = y²) is true."},
        ],
        "C9-17": [
            {"unit": 11, "field": "time_bands[1].activity",
             "old": "Step 1 applies 'if a + x = a + y then x = y' (add 3 to both sides), Step 2 applies the squaring analogue. Ask students to identify which proposition and which converse are being applied at each step, and why it is safe to apply the converse (both the proposition and converse are true for real-number addition).",
             "new": "Step 1 adds 3 to both sides (the proposition of Q4: if x = y then a + x = a + y), Step 2 divides both sides by 2 (if x = y then x/2 = y/2). Ask students to identify the proposition applied at each step, and why each step can also be undone safely (for Step 1, Q4's converse — if a + x = a + y then x = y — is also true)."},
        ],
        "C9-18": [
            {"unit": 1, "field": "homework[0]",
             "old": "Exercise Set 9.1 Q2, p.5 — frame the converse of the given proposition about multiples of 6 and multiples of 3",
             "new": "Exercise Set 9.1 Q2, p.5 — frame the converse of 'If a quadrilateral is a square, then all its angles are equal'"},
        ],
        "C9-19": [{"unit": 5, "field": "homework[0]", "old": "Exercise Set 9.1 Q10, p.6 —", "new": "Exercise Set 9.1 Q11, p.6 —"}],
        "C9-20": [{"unit": 7, "field": "homework[0]", "old": "Exercise Set 9.1 Q12, p.6 —", "new": "Exercise Set 9.1 Q13, p.6 —"}],
        "C9-21": [{"unit": 10, "field": "homework[0]", "old": "Exercise Set 9.1 Q11, p.6 —", "new": "Exercise Set 9.1 Q12, p.6 —"}],
        "C9-25": [{"unit": 8, "field": "time_bands[2].activity",
                   "old": "Discuss the Euler–Fermat connection from Example 1:",
                   "new": "Discuss the Euler–Fermat note that precedes Example 2, p.2:"}],
        "C9-26": [{"unit": 8, "field": "teacher_notes",
                   "old": "The Euler–Fermat example from Example 1, p.1 is",
                   "new": "The Euler–Fermat note before Example 2, p.2 is"}],
        "C9-27": [{"unit": 7, "field": "time_bands[1].activity",
                   "old": "For Q9: proposition true; converse is false — counterexample needed (a number divisible by both 5 and 12 is divisible by 60, so check: is divisibility by 5 and 12 enough? No — 60 is LCM(5,12), so divisibility by both does imply divisibility by 60; prompt groups to reconsider).",
                   "new": "For Q9: proposition true; converse also true — lcm(5, 12) = 60, so a number divisible by both 5 and 12 is divisible by 60."}],
        "C9-28": [{"unit": 16, "field": "time_bands[1].activity",
                   "old": "Q: 'If n² is even, then n is even' — the converse of this is 'If n is even, then n² is even', which is also true",
                   "new": "Q: 'If n is even, then n² is even' — also true"}],
        "C9-29": [
            {"unit": 8, "field": "time_bands[1].activity",
             "old": "n = 5 gives 101 (prime), n = 5: try factoring 4(25) + 1 = 101 — prime; try n = 10: 4(100) + 1 = 401 — prime; n = 15: 4(225) + 1 = 901 = 901; is 901 prime? 901 = 17 × 53 — composite.",
             "new": "n = 4 gives 65 = 5 × 13 — composite."},
        ],
        "C9-36": [{"item_where": {"question_type": "OPEN_TASK"}, "field": "scaffold",
                   "old": "For the converse of A: try n = 60, n = 120 — do these satisfy both conditions? Is every such n divisible by 60?",
                   "new": "For the converse of A: if n is divisible by 60, must it be divisible by 5 and by 12? Do 5 and 12 divide 60?"}],
        "C9-37": [{"item_where": {"question_type": "OPEN_TASK"}, "field": "guide.OPEN_TASK.reading_the_scaffold",
                   "old": "unless lcm(5,12) = 60 — which it does, making the converse also true.",
                   "new": "unless lcm(5,12) = 60 — which it does, making Proposition A true; its converse is true because 5 and 12 both divide 60."}],
        "C9-S3": [
            {"unit": 12, "field": "time_bands[0].activity", "old": "Recall the Fermat Fermat numbers discussed in Unit 1", "new": "Recall the Fermat numbers from the start of the chapter"},
            {"unit": 3, "field": "time_bands[3].activity", "old": "hold the full discussion for the next unit.", "new": "hold the full discussion for later."},
            {"unit": 9, "field": "time_bands[0].activity", "old": "Compare with Q8 from the previous unit (", "new": "Compare with Q8 ("},
            {"unit": 9, "field": "time_bands[3].activity", "old": "the propositions studied across units 6–9", "new": "the propositions studied so far"},
            {"unit": 15, "field": "time_bands[1].activity", "old": "write the gcd argument from Unit 9.", "new": "write the gcd argument (any common factor of n and n + 3 divides 3)."},
            {"unit": 5, "field": "time_bands[3].activity", "old": "one of today's proof steps", "new": "one of the proof steps"},
            {"unit": 16, "field": "time_bands[3].activity", "old": "from today's chapter", "new": "from the chapter"},
            {"unit": 13, "field": "time_bands[3].activity", "old": "Statement 1 was proved (presumably in an earlier grade) without a construction, while Statement 2 required one.", "new": "Statement 1 was proved in an earlier grade, while Statement 2 needed a construction here."},
            {"unit": 14, "field": "time_bands[0].activity", "old": "(pp.6)", "new": "(p.6)"},
            {"unit": 7, "field": "time_bands[1].activity", "old": "(24 = 4 × 6 with overlap managed by 24's prime factorisation 2³ × 3)", "new": "(4 and 6 both divide 24, so they divide every multiple of 24)"},
            {"unit": 7, "field": "teacher_notes", "old": "A common error for Q8/Q9 is", "new": "A common error for Q8 is"},
            {"unit": 7, "field": "time_bands[2].activity", "old": " Draw out the idea that tighter conclusions leave less room for the converse to fail.", "new": ""},
            {"unit": 12, "field": "time_bands[3].activity", "old": "try large n; try n equal to the modulus.", "new": "try large n."},
            {"unit": 16, "field": "time_bands[1].activity", "old": "the chapter's framework allows this deductive approach", "new": "this is a valid deductive approach"},
            {"item_where": {"question_type": "OPEN_TASK"}, "field": "task", "old": "investigate two propositions about positive integers", "new": "investigate two propositions"},
            # clock durations
            {"unit": 2, "field": "time_bands[1].activity", "old": "Students work individually for eight minutes, then compare", "new": "Students work individually, then compare"},
            {"unit": 4, "field": "time_bands[0].activity", "old": "After three minutes, take a class poll", "new": "Then take a class poll"},
            {"unit": 4, "field": "time_bands[1].activity", "old": "After three minutes, share and discuss;", "new": "Then share and discuss;"},
            {"unit": 6, "field": "time_bands[0].activity", "old": "After eight minutes, take up Q1:", "new": "Then take up Q1:"},
            {"unit": 6, "field": "time_bands[1].activity", "old": "Students sketch and discuss in pairs for five minutes, then share answers.", "new": "Students sketch and discuss in pairs, then share answers."},
            {"unit": 7, "field": "time_bands[0].activity", "old": " Give groups twelve minutes.", "new": ""},
            {"unit": 8, "field": "time_bands[1].activity", "old": "Students compare their findings with a neighbour after twelve minutes.", "new": "Students then compare their findings with a neighbour."},
            {"unit": 10, "field": "time_bands[0].activity", "old": "Give students three minutes, then ask", "new": "Give students time to think, then ask"},
            {"unit": 12, "field": "time_bands[1].activity", "old": "After twelve minutes of searching, pairs share findings:", "new": "When pairs have searched, they share findings:"},
            {"unit": 16, "field": "time_bands[0].activity", "old": "Students write answers individually for five minutes.", "new": "Students write answers individually."},
            {"unit": 16, "field": "time_bands[1].activity", "old": "Students work individually for eight minutes.", "new": "Students work individually."},
            {"unit": 16, "field": "time_bands[2].activity", "old": "Groups have eight minutes to write; then", "new": "Groups write; then"},
        ],
    },
    "ch_09_canonical_p13.json": {
        "C9-05": [{"unit": 11, "field": "time_bands[1].activity",
                   "old": "(No — any angle and any crossing point will produce a quadrilateral of type Q as long as the sticks have equal length.)",
                   "new": "(It may — equal diagonals are required for type Q but need not be enough, so the angle or crossing point may decide whether the result is of type Q.)"}],
        "C9-06": [
            {"unit": 11, "field": "time_bands[2].activity",
             "old": "(Yes, same reason — equal diagonals require sticks of equal length.)",
             "new": "(Equal sticks are enough — any quadrilateral with equal diagonals is of type Q.)"},
            {"unit": 11, "field": "time_bands[2].activity",
             "old": "(This time it might — if the angle or crossing point is constrained by the definition of Q, any deviation produces a quadrilateral not of type Q that still has equal diagonals, i.e. a counterexample to the converse.)",
             "new": "(No — every placement of equal sticks gives equal diagonals, so every placement gives a quadrilateral of type Q.)"},
        ],
        "C9-07": [{"unit": 11, "field": "teacher_notes",
                   "old": "students sometimes struggle to articulate why the placement matters differently in part (ii) — the key is that in (ii), any quadrilateral with equal diagonals is supposed to be of type Q, so any configuration not of type Q that still has equal diagonals is a counterexample to the converse.",
                   "new": "students sometimes struggle to articulate why placement stops mattering in part (ii) — the key is that in (ii) any quadrilateral with equal diagonals is of type Q, so every placement of equal sticks gives a type-Q quadrilateral, whereas in (i) equal diagonals alone may not be enough."}],
        "C9-10": [{"unit": 10, "field": "teacher_notes",
                   "old": "The formula n² + n + 11 produces primes for n = 0 through 10 and fails at n = 11",
                   "new": "The formula n² + n + 11 produces primes for n = 0 through 9 and fails first at n = 10 (121 = 11 × 11)"}],
        "C9-12": [{"unit": 4, "field": "time_bands[2].activity",
                   "old": "(a) P true, Q false (the rain example and this area example); (b) P true, Q true (the factor-count result from Example 3, p.2); (c) P false, Q true (the converse of the rain example could be taken as a proposition whose 'original' was false).",
                   "new": "(a) P true, Q false (the rain example); (b) P true, Q true (the factor-count result from Example 3, p.2); (c) P false, Q true (this area example)."}],
        "C9-15": [{"item_where": {"question_type": "MCQ"}, "field": "guide.MCQ.what_each_option_reveals.D",
                   "old": "Confuses the converse with the contrapositive ('If not Y then not X'); also incorrectly claims it is true.",
                   "new": "Confuses the converse with the contrapositive ('If not Y then not X'); the statement in D is true, but it is not the converse."}],
        "C9-30": [{"unit": 10, "field": "time_bands[1].activity",
                   "old": "Group A takes formula (i) 4n² + 1: test n = 1 (5, prime), n = 2 (17, prime), n = 3 (37, prime), n = 5 (101, prime), n = 10 (401 = 401, prime?) — direct them to n = 5: 4(25)+1 = 101 (prime), n = 10: 401 (prime); they may need to try n = 5 is prime but n = ... actually guide them to note 4(5²)+1 = 101; the counterexample appears at n with 4n²+1 composite — e.g. n = 5 gives 101 (prime) but n = 10 gives 401 (prime); direct groups to try n where the number factors: 4n²+1 factors when it equals (2n+1)(2n-1)+2 — actually the simplest counterexample is n = 5: 4(25)+1 = 101 prime; n = 10: 401; n = 15: 4(225)+1=901 = 17×53.",
                   "new": "Group A takes formula (i) 4n² + 1: n = 1, 2, 3 give 5, 17, 37 (prime), but n = 4 gives 65 = 5 × 13."}],
        "C9-33": [{"unit": 2, "field": "time_bands[2].activity",
                   "old": "justify the true one, and give a counterexample for the false one.",
                   "new": "justify each true statement, and give a counterexample for any that is false."}],
        "C9-34": [{"unit": 4, "field": "teacher_notes",
                   "old": "Students frequently assume that a true proposition guarantees a true converse; this unit directly confronts that assumption through a geometric counterexample they construct themselves.",
                   "new": "Students frequently assume a proposition and its converse stand or fall together; this unit confronts that assumption with a false proposition whose converse is true, using a counterexample they construct themselves."}],
        "C9-35": [{"unit": 9, "field": "time_bands[0].activity",
                   "old": "Guide students to construct a deductive argument for P: if 3 | n and 3 | (n + 3), then 3 | their difference = 3 — true always — so 3 always divides gcd(n, n+3) when 3 | n, contradicting the hypothesis.",
                   "new": "Guide students to construct a deductive argument for P: if 3 | n, then 3 | (n + 3) as well, so 3 is a common factor of n and n + 3 — contradicting the hypothesis."}],
        "C9-S3": [
            {"unit": 2, "field": "time_bands[0].activity", "old": "established in the previous unit", "new": "established earlier"},
            {"unit": 12, "field": "time_bands[2].activity", "old": "the coprimality principle identified in Unit 7", "new": "the coprimality principle"},
            {"unit": 13, "field": "teacher_notes", "old": "The fresh argument in the 15–30 band", "new": "The fresh argument in the second activity"},
            {"unit": 4, "field": "teacher_notes", "old": "steer students to vary both shape and orientation", "new": "steer students to vary the shape while keeping the area"},
            {"unit": 9, "field": "time_bands[0].activity", "old": "P is vacuously not being tested here", "new": "this n does not test P"},
            {"unit": 12, "field": "time_bands[1].activity", "old": "After 15 minutes, they pair", "new": "They then pair"},
            {"unit": 13, "field": "time_bands[1].activity", "old": "Collect written arguments after 12 minutes.", "new": "Collect written arguments."},
        ],
    },
    "ch_09_canonical_p10.json": {
        "C9-08": [
            {"unit": 10, "field": "time_bands[0].activity",
             "old": "(No — the length condition does not constrain where they cross or the angle between them.)",
             "new": "(It may — equal diagonals are needed for type Q but need not be enough, so how the sticks cross may decide whether the result is of type Q.)"},
            {"unit": 10, "field": "time_bands[0].activity",
             "old": "In part (ii), for a quadrilateral to qualify as type Q it needs equal diagonals — same stick-length requirement — but now the converse puts the equal-diagonal condition on the hypothesis, meaning any equal-diagonal quadrilateral must be of type Q, so arrangement still does not affect length but may affect other properties.",
             "new": "In part (ii), equal sticks are enough: any quadrilateral with equal diagonals is of type Q, so it no longer matters how the equal sticks are placed."},
        ],
        "C9-16": [{"unit": 8, "field": "teacher_notes",
                   "old": "remind them that Fermat's formula gave four primes before failing",
                   "new": "remind them that Fermat's formula gave five primes (n = 0 to 4) before failing"}],
        "C9-22": [{"unit": 7, "field": "homework[0]",
                   "old": "Exercise Set 9.1 Q12, p.6 and Q13, p.6",
                   "new": "Exercise Set 9.1 Q13, p.6 and Q14, p.6"}],
        "C9-23": [{"unit": 3, "field": "teacher_notes",
                   "old": "Exercise Set 9.1 Q9, p.6 (square of a prime has exactly three factors)",
                   "new": "Exercise Set 9.1 Q10, p.6 (square of a prime has exactly three factors)"}],
        "C9-24": [{"unit": 6, "field": "teacher_notes",
                   "old": "Exercise Set 9.1 Q11, p.6 (n and n+3 sharing no factors)",
                   "new": "Exercise Set 9.1 Q12, p.6 (n and n+3 sharing no factors)"}],
        "C9-31": [{"unit": 8, "field": "time_bands[1].activity",
                   "old": "Note: for (i), n = 5 gives 4(25)+1 = 101 (prime); n = 10 gives 401 (prime); students may need guidance that n = 0 gives 1, which is not prime — discuss whether 1 counts.",
                   "new": "Note: for (i), n = 1, 2, 3 give 5, 17, 37 (prime), but n = 4 gives 65 = 5 × 13."}],
        "C9-32": [{"unit": 7, "field": "time_bands[1].activity",
                   "old": "since x² + xy + y² > 0 for real x, y not both zero... guide the class toward the conclusion that x = y.",
                   "new": "and x² + xy + y² = (x + y/2)² + 3y²/4 is zero only when x = y = 0, so in every case x − y = 0, that is, x = y."}],
        "C9-38": [{"item_where": {"question_type": "MCQ"}, "field": "guide.MCQ.what_each_option_reveals.D",
                   "old": "Confuses the converse ('If Y then X') with the contrapositive ('If not-Y then not-X')",
                   "new": "Negates both parts instead of swapping them ('If not-X then not-Y' — the inverse, not the converse)"}],
        "C9-S3": [
            {"unit": 1, "field": "time_bands[3].activity", "old": "an open question the class will explore in upcoming units", "new": "an open question"},
            {"unit": 1, "field": "time_bands[2].activity", "old": "(b) 'If it is noon, the sun is overhead.'", "new": "(b) 'If a number is divisible by 10, it is even.'"},
            {"unit": 4, "field": "time_bands[1].activity", "old": "(ii) both proposition and converse true (perfect squares and odd factor count).", "new": "(ii) both proposition and converse true (perfect squares and odd factor count); (iii) a false proposition with a true converse (area and congruence, just worked)."},
            {"unit": 5, "field": "time_bands[0].activity", "old": "Write the converse the class produces: 'If a² + b² = c², then the triangle is right-angled.'", "new": "Write the converse the class produces: 'Let a, b, c be the side lengths of a triangle. If a² + b² = c², then the triangle is right-angled.'"},
            {"unit": 6, "field": "time_bands[3].activity", "old": "the forward direction from a larger divisor to its parts is usually true", "new": "the forward direction from a larger divisor to its factors is always true"},
            # clock durations
            {"unit": 2, "field": "time_bands[3].activity", "old": "Students write the converse on their notebooks in 60 seconds.", "new": "Students write the converse in their notebooks."},
            {"unit": 4, "field": "time_bands[0].activity", "old": "After five minutes of individual work, pairs compare.", "new": "After individual work, pairs compare."},
            {"unit": 4, "field": "time_bands[1].activity", "old": "Give them three minutes individually, then share.", "new": "Give them time to think individually, then share."},
            {"unit": 6, "field": "time_bands[3].activity", "old": "with one word of justification in 90 seconds.", "new": "with one word of justification."},
            {"unit": 7, "field": "time_bands[0].activity", "old": "Give students two minutes to think and write before sharing.", "new": "Give students time to think and write before sharing."},
            {"unit": 9, "field": "time_bands[0].activity", "old": "Students think individually for two minutes.", "new": "Students think individually first."},
        ],
    },
    # ── C3 content-correctness check, Part II · chapter 10 (2026-10-02, founder-approved) ──
    # Findings: genon/out/content_checks/mathematics_ix_part2_findings.md, ids C10-nn.
    'ch_10_canonical.json': {
        'C10-01': [
            {'item_where': {'question_text': 'A school has two sections in Grade IX. Section A has 40 students with an average mark of 68, and Section B has 25 students with an average mark of 74. A student claims the overall average is (68 + 74)/2 = 71. Show why this claim is incorrect and find the correct overall average mark for Grade IX. Round your answer to two decimal places if needed.'}, 'field': 'expected_answer', 'old': '70.15', 'new': '70.31'},
        ],
        'C10-02': [
            {'item_where': {'question_text': 'The average daily rainfall at a location in June (30 days) is 12 mm, in July (31 days) is 18 mm, and in August (31 days) is 9 mm. Write an expression for the combined average daily rainfall over the three months and evaluate it. Round your answer to two decimal places.'}, 'field': 'expected_answer', 'old': '13.02', 'new': '13.01'},
        ],
        'C10-03': [
            {'item_where': {'question_text': 'A chemist mixes three solutions: 400 mL with 6% acid, 300 mL with 10% acid, and 200 mL with 15% acid. Find the percentage concentration of acid in the resulting mixture. Round your answer to two decimal places.'}, 'field': 'expected_answer', 'old': '9.22', 'new': '9.33'},
        ],
        'C10-04': [
            {'item_where': {'question_text': 'A tank contains 500 litres of a solution with 4% salt. A second solution with 12% salt is pumped in. After mixing, the combined solution has 7% salt. How many litres of the second solution were added? Show your working.'}, 'field': 'expected_answer', 'old': '375', 'new': '300'},
        ],
        'C10-05': [
            {'item_where': {'question_text': "A company evaluates employee performance on three criteria: punctuality (score 72), teamwork (score 80), and output quality (score 65), combined in the ratio 2 : 3 : 5. Find the employee's overall performance score using the weighted mean formula. Then verify your answer by writing out the repeated-value list implied by the weights."}, 'field': 'expected_answer', 'old': '71.4', 'new': '70.9'},
        ],
        'C10-09': [
            {'unit': 2, 'field': 'time_bands[3].activity', 'old': 'Q1 answer (73.78)', 'new': 'Q1 answer (73.82)'},
        ],
        'C10-10': [
            {'unit': 6, 'field': 'time_bands[0].activity', 'old': "Rashi's agility advantage over Keerthi (70 vs 75) needs checking.", 'new': "Keerthi's agility advantage (75 vs 70) has to be set against Rashi's strength advantage (60 vs 55)."},
        ],
        'C10-13': [
            {'item_where': {'question_text': 'Priya scores 55% in her class test, 62% in her project and 78% in her final exam. Her school combines these in the ratio 3 : 2 : 5. Which of the following expressions correctly gives her annual percentage?'}, 'field': 'guide.MCQ.inclusivity', 'old': 'check which reduces to (55+62+78)/3; only option A does.', 'new': 'check that option C, with weights 1 : 1 : 1, reduces to the simple mean (55+62+78)/3 — option A — which shows C is the weighted version of A.'},
        ],
        'C10-18': [
            {'unit': 16, 'field': 'time_bands[1].activity', 'old': 'Students annotate each chart with one question it answers well and one question it cannot answer, drawing on the distinctions established in Sections 10.2.1 and 10.2.2.', 'new': "Students notice that, because every bar totals 24 hours, the two charts have the same shape (as with the 'average Indian' chart in Section 10.2.2), explain why, and say which chart they would need if the bars had different totals."},
        ],
        'C10-19': [
            {'unit': 5, 'field': 'time_bands[2].activity', 'old': 'identify which of the four given expressions is the correct weighted mean. They must justify why the others are wrong', 'new': 'identify which of the four given expressions give the correct weighted mean — two do, (iii) and (iv). They must justify why (i) and (ii) are wrong'},
        ],
        'C10-23': [
            {'unit': 1, 'field': 'homework[0]', 'old': 'Exercise Set 10.3 Q2 (End of Chapter Q2, p.15)', 'new': 'Exercise Set 10.3 Q2, p.15'},
        ],
        'C10-24': [
            {'unit': 10, 'field': 'visual_aids', 'old': "Fig. 10.5 from the textbook — 100% stacked bar chart of seasonal blooms in Fatima's and Naveen's gardens, Cases 1 and 2", 'new': "Example 8 charts, pp.24–25 — 100% stacked bar chart of seasonal blooms in Fatima's and Naveen's gardens, and the stacked bar charts for Cases 1 and 2"},
        ],
        'C10-25': [
            {'unit': 15, 'field': 'time_bands[0].activity', 'old': 'For six possible next transactions — buying or selling at ₹30k or ₹10k, different quantities — students estimate where the new average price falls on a number line before computing. The estimation task requires recognising that buying more of a cheaper stock pulls the average down proportionally to the quantity bought.', 'new': 'For six possible next purchases — at ₹30k, ₹10k or ₹15k, in different quantities — students estimate where the new average price falls on a number line before computing. The estimation task requires recognising that the more cheaper gold she buys, the further the average is pulled down — though never below ₹10k.'},
        ],
        'C10-26': [
            {'unit': 16, 'field': 'time_bands[0].activity', 'old': "Students must find the January overall rating and reason about whether the February scores, averaged across the two months with January's taste score carried forward, change the overall weighted mean — and by how much. This scenario uses the weighted mean of averages (Section 10.1.1), custom weights (Section 10.1.3) and the invariance result from End of Chapter Q6.", 'new': "Students find the January overall rating, (5 × 4.2 + 4 × 3.8 + 3 × 4.5)/12 = 49.7/12 ≈ 4.14, and the February rating with January's taste score carried forward, (5 × 4.2 + 4 × 4.0 + 3 × 4.7)/12 = 51.1/12 ≈ 4.26, and explain why the rise is small. Then ask: if all three weights were doubled, would either rating change? (No — End of Chapter Q6.)"},
        ],
        'C10-27': [
            {'unit': 16, 'field': 'teacher_notes', 'old': 'The canteen problem is constructed so that the weight-scaling invariance from End of Chapter Q6 and the combining-averages logic from Section 10.1.1 both appear naturally.', 'new': 'The canteen problem combines custom weights (Section 10.1.3) with a weight-scaling check (End of Chapter Q6).'},
        ],
        'C10-S3': [
            {'unit': 4, 'field': 'time_bands[2].activity', 'old': '(p.16, book_ref: Exercise Set 10.3 Q4, p.16)', 'new': '(p.16)'},
            {'unit': 6, 'field': 'time_bands[3].activity', 'old': "in each of today's three problems", 'new': 'in each of the three problems'},
            {'unit': 8, 'field': 'teacher_notes', 'old': 'Having established the motivation for stacking in unit 7,', 'new': 'Having established the motivation for stacking,'},
            {'unit': 9, 'field': 'teacher_notes', 'old': 'must be made explicit before the next unit deepens it.', 'new': 'must be made explicit.'},
            {'unit': 9, 'field': 'teacher_notes', 'old': 'sharpens this and is the focus of the next unit.', 'new': 'sharpens this.'},
            {'unit': 10, 'field': 'time_bands[0].activity', 'old': "Today's work tests", 'new': 'This unit tests'},
        ],
    },
    'ch_10_canonical_p13.json': {
        'C10-08': [
            {'item_where': {'question_text': 'A chemist has two solutions of salt water: Solution X is 400 mL at 6% salt and Solution Y is 200 mL at 12% salt. She mixes them together, then adds an unknown volume V mL of pure water (0% salt) to bring the salt concentration of the final mixture down to 4%. Find V. Show your working.'}, 'field': 'expected_answer', 'old': 'V = 300 mL', 'new': 'V = 600 mL'},
        ],
        'C10-14': [
            {'item_where': {'expected_answer': '2010 totals: 1000 units. Percentages: Heating 30%, Cooling 20%, Lighting 40%, Other 10%. 2020 totals: 1000 units. Percentages: Heating 15%, Cooling 50%, Lighting 20%, Other 15%.'}, 'field': 'guide.NUM.inclusivity', 'old': 'explain why the 100% stacked bar chart looks identical for both years even though total consumption may have changed — and in this specific case, to note that the totals happen to be the same (1000 units each year) but the proportional picture still changed markedly.', 'new': 'notice that because both years total 1000 units, the stacked bar chart and the 100% stacked bar chart of this data have the same shape, and explain why.'},
        ],
        'C10-15': [
            {'item_where': {'question_text': 'A chemist has two solutions of salt water: Solution X is 400 mL at 6% salt and Solution Y is 200 mL at 12% salt. She mixes them together, then adds an unknown volume V mL of pure water (0% salt) to bring the salt concentration of the final mixture down to 4%. Find V. Show your working.'}, 'field': 'method_one_line', 'old': 'so V = 600. Wait — re-verify: 48/1200 = 0.04. So V = 600 mL.', 'new': 'so V = 600 mL.'},
        ],
        'C10-16': [
            {'item_where': {'question_text': 'A chemist has two solutions of salt water: Solution X is 400 mL at 6% salt and Solution Y is 200 mL at 12% salt. She mixes them together, then adds an unknown volume V mL of pure water (0% salt) to bring the salt concentration of the final mixture down to 4%. Find V. Show your working.'}, 'field': 'guide.NUM.inclusivity', 'old': 'explain intuitively why more than 600 mL of water is needed', 'new': 'explain intuitively why as much as 600 mL of water is needed'},
        ],
        'C10-17': [
            {'item_where': {'expected_answer': '2010 totals: 1000 units. Percentages: Heating 30%, Cooling 20%, Lighting 40%, Other 10%. 2020 totals: 1000 units. Percentages: Heating 15%, Cooling 50%, Lighting 20%, Other 15%.'}, 'field': 'question_text', 'old': 'state one thing the 100% stacked bar chart reveals that a stacked bar chart of the same data would not, and one thing the stacked bar chart would reveal that the 100% stacked bar chart would not.', 'new': 'state, in general, one thing a 100% stacked bar chart shows more easily than a stacked bar chart and one thing a stacked bar chart shows that a 100% stacked bar chart cannot; then explain why, for this data, the two charts look the same.'},
        ],
        'C10-20': [
            {'unit': 5, 'field': 'time_bands[2].activity', 'old': 'They must identify which of the four given expressions is correct', 'new': 'They must identify which of the four given expressions are correct — (iii) and (iv) both are'},
        ],
        'C10-28': [
            {'unit': 1, 'field': 'time_bands[1].activity', 'old': "Pose the chapter's opening question: a school has two groups", 'new': 'Pose an opening question: a school has two groups'},
        ],
        'C10-S3': [
            {'unit': 8, 'field': 'time_bands[0].activity', 'old': 'Give students two minutes to think individually', 'new': 'Give students time to think individually'},
            {'unit': 13, 'field': 'time_bands[0].activity', 'old': 'After two minutes of solo work', 'new': 'After solo work'},
            {'item_where': {'question_text': "A school has two classes. Class P has 40 students with an average score of 65, and Class Q has 10 students with an average score of 85. A student claims the school's overall average score is (65 + 85) ÷ 2 = 75. Which statement best explains why this claim is incorrect?"}, 'field': 'guide.MCQ.what_each_option_reveals.A', 'old': 'Misremembers that the combined average must lie strictly between the two group averages — this is true, but', 'new': 'Misapplies the rule that a combined average lies between the two group averages —'},
            {'item_where': {'question_text': "A school tracks three clubs' (Drama, Science, Sports) membership numbers across four years. A student wants to know: 'Which club grew the most in total membership from Year 1 to Year 4?' Which chart type is best suited for this comparison, and why?"}, 'field': 'guide.MCQ.what_each_option_reveals.C', 'old': 'Chooses clustered-by-year correctly but inverts the grouping variable —', 'new': 'Chooses a clustered chart but groups it by year —'},
        ],
    },
    'ch_10_canonical_p10.json': {
        'C10-06': [
            {'item_where': {'question_text': 'A wildlife sanctuary records that its 12 adult elephants have an average mass of 4200 kg and its 5 juvenile elephants have an average mass of 1800 kg. Calculate the average mass of all 17 elephants at the sanctuary. Show your working.'}, 'field': 'expected_answer', 'old': '3,600 kg', 'new': '3,494 kg (approximately)'},
        ],
        'C10-07': [
            {'item_where': {'question_text': 'A pharmacist mixes three saline solutions: 400 mL at 2% salt, 150 mL at 6% salt, and 200 mL at 4% salt. (a) Before calculating, explain in one sentence why you expect the resulting concentration to be closer to 2% than to 6%. (b) Calculate the salt concentration of the combined solution. Show your working.'}, 'field': 'expected_answer', 'old': '3.07% (approximately)', 'new': '3.33% (approximately)'},
        ],
        'C10-11': [
            {'unit': 10, 'field': 'time_bands[0].activity', 'old': 'who finished first (yes, totals visible)', 'new': 'who finished first (no — every bar is drawn to the same length, so total times are hidden)'},
        ],
        'C10-12': [
            {'unit': 5, 'field': 'time_bands[3].activity', 'old': 'since Keerthi scores lower on strength and flexibility but higher on agility', 'new': 'since Keerthi scores lower on strength, the same on flexibility and higher on agility'},
        ],
        'C10-21': [
            {'unit': 5, 'field': 'time_bands[2].activity', 'old': 'identify which of the four expressions is structurally correct', 'new': 'identify which of the four expressions are correct — (iii) and (iv) both are'},
        ],
        'C10-22': [
            {'unit': 5, 'field': 'time_bands[1].activity', 'old': '(food 4 stars, service 3 stars, ambience 5 stars, combined 4 : 3 : 2) as a second context. Students compute the weighted mean (4×4 + 3×3 + 2×5)/9 = (16+9+10)/9 = 35/9 ≈ 3.89', 'new': '(food 5 stars, service 3 stars, ambience 4 stars, combined 4 : 3 : 2) as a second context. Students compute the weighted mean (4×5 + 3×3 + 2×4)/9 = (20+9+8)/9 = 37/9 ≈ 4.11'},
        ],
        'C10-29': [
            {'unit': 6, 'field': 'time_bands[1].activity', 'old': 'Establish that the chart grouped by category answers the first question well but makes overall totals hard to see, while the chart grouped by family reverses this.', 'new': "Establish that the chart grouped by category answers the first question well, but that neither clustered chart shows a family's overall total at a glance."},
        ],
        'C10-30': [
            {'unit': 9, 'field': 'teacher_notes', 'old': 'for example, that the group with the highest share of learning time necessarily spends the most hours learning.', 'new': 'for example, in the family-expenditure chart, that the family with the highest share of spending on healthcare necessarily spends the most on healthcare.'},
        ],
        'C10-S3': [
            {'unit': 1, 'field': 'teacher_notes', 'old': 'can look at Example 1, p.8, ahead of the next unit.', 'new': 'can look at Example 1, p.8.'},
            {'unit': 1, 'field': 'time_bands[2].activity', 'old': 'Ask pairs to discuss for a couple of minutes, then collect responses.', 'new': 'Ask pairs to discuss, then collect responses.'},
            {'unit': 1, 'field': 'time_bands[2].activity', 'old': 'a key insight that the next unit will formalise.', 'new': 'a key insight that Example 1 formalises.'},
            {'unit': 1, 'field': 'time_bands[2].activity', 'old': "Pose the chapter's entry problem in the students' own words:", 'new': "Pose Exercise Set 10.1 Q1, p.13 in the students' own words:"},
            {'unit': 6, 'field': 'time_bands[3].activity', 'old': ', motivating the next unit.', 'new': ', motivating the 100% stacked bar chart.'},
            {'unit': 8, 'field': 'teacher_notes', 'old': 'on their own before the next unit.', 'new': 'on their own.'},
            {'unit': 8, 'field': 'visual_aids', 'old': 'Fig. 10.4 (100% stacked bar chart of family expenditure, p.22)', 'new': 'Fig. 10.4 (100% stacked bar chart of family expenditure, p.23)'},
            {'unit': 1, 'field': 'time_bands[0].activity', 'old': 'Let students agree or disagree briefly before moving on.', 'new': 'Let students agree or disagree briefly, then confirm it is 7 — both halves have 10 overs — and note that the next problem is different.'},
            {'item_where': {'question_type': 'SCR'}, 'field': 'question_text', 'old': 'On the axes below, sketch', 'new': 'On squared paper, sketch'},
        ],
    },
    # ── C3 content-correctness check, Part II · chapter 11 (2026-10-02, founder-approved) ──
    # Findings: genon/out/content_checks/mathematics_ix_part2_findings.md, ids C11-nn.
    'ch_11_canonical_p08.json': {
        'C11-01': [
            {'item_where': {'question_text': "(a) Count the exact number of reductions that Euclid's subtraction algorithm (replacing gcd(m,n) with gcd(n, m−n)) needs to compute gcd(21, 3). Show each step.\n(b) Count the number of reductions that Āryabhaṭa's division algorithm (replacing gcd(m,n) with gcd(n, m mod n)) needs for the same pair. Show each step.\n(c) Explain in general terms why the division algorithm needs far fewer reductions than the subtraction algorithm when one of the two numbers is much smaller than the other."}, 'field': 'look_for[0]', 'old': 'That is 10 reductions (or the student may count differently depending on swap handling — accept any systematic count consistent with the algorithm as stated).', 'new': "That is 7 reductions (21 − 3 = 18, 18 − 3 = 15, 15 − 3 = 12, 12 − 3 = 9, 9 − 3 = 6, 6 − 3 = 3, then gcd(3, 3) → gcd(3, 0)); the swaps are not counted as reductions, as in the book's gcd(375, 825) example. A student who also counts the swaps (12 steps) has the method right."},
        ],
        'C11-02': [
            {'item_where': {'question_text': "(a) Count the exact number of reductions that Euclid's subtraction algorithm (replacing gcd(m,n) with gcd(n, m−n)) needs to compute gcd(21, 3). Show each step.\n(b) Count the number of reductions that Āryabhaṭa's division algorithm (replacing gcd(m,n) with gcd(n, m mod n)) needs for the same pair. Show each step.\n(c) Explain in general terms why the division algorithm needs far fewer reductions than the subtraction algorithm when one of the two numbers is much smaller than the other."}, 'field': 'look_for[0]', 'old': 'Part (a): gcd(21,3)→gcd(3,18)? No — m≥n required; gcd(21,3): 21≥3, so gcd(3,18) is wrong. Correct trace: gcd(21,3)→gcd(3,18)? 21-3=18, gcd(3,18) but now 3<18 so swap: ', 'new': 'Part (a): gcd(21,3) → gcd(3,18), swap to '},
        ],
        'C11-03': [
            {'item_where': {'question_text': "(a) Count the exact number of reductions that Euclid's subtraction algorithm (replacing gcd(m,n) with gcd(n, m−n)) needs to compute gcd(21, 3). Show each step.\n(b) Count the number of reductions that Āryabhaṭa's division algorithm (replacing gcd(m,n) with gcd(n, m mod n)) needs for the same pair. Show each step.\n(c) Explain in general terms why the division algorithm needs far fewer reductions than the subtraction algorithm when one of the two numbers is much smaller than the other."}, 'field': 'guide.ECR.inclusivity', 'old': "verify the chapter's claim that gcd(2k+1, 2) needs exactly one division-algorithm step but about k subtraction steps", 'new': "verify the chapter's claim that gcd(2k+1, 2) needs exactly two division-algorithm steps but about k subtraction steps"},
        ],
        'C11-04': [
            {'item_where': {'question_text': 'The chapter decomposes the problem of finding gcd(m, n) into two smaller problems before writing any algorithm. Which of the following correctly identifies both sub-problems and explains why together they are sufficient?'}, 'field': 'guide.MCQ.inclusivity', 'old': 'explain in writing why option B, while it gives the correct gcd, is not the decomposition described in this section.', 'new': 'explain in writing why option D, although repeated subtraction can also lead to the gcd, is not the decomposition described in this section.'},
        ],
        'C11-05': [
            {'item_where': {'question_type': 'OPEN_TASK'}, 'field': 'guide.OPEN_TASK.reading_the_scaffold', 'old': 'A strong response for (b) replaces step (3) with building the all-divisors union and step (4) with reporting the smallest element greater than max(m,n), or equivalently finds multiples; any correct algorithmic formulation is acceptable.', 'new': 'A strong response for (b) replaces the divisor lists with lists of multiples of m and of n (up to m × n) and reports the smallest number in both, or computes m × n ÷ gcd(m, n) = 42 × 56 ÷ 14 = 168; any correct algorithmic formulation is acceptable.'},
        ],
        'C11-06': [
            {'item_where': {'question_type': 'OPEN_TASK'}, 'field': 'scaffold', 'old': 'consider what set of divisors you would combine and which element you would report.', 'new': 'instead of lists of divisors, think about lists of multiples — or use the fact that lcm(m, n) × gcd(m, n) = m × n.'},
        ],
        'C11-07': [
            {'item_where': {'question_type': 'OPEN_TASK'}, 'field': 'guide.OPEN_TASK.inclusivity', 'old': "which element of which list is 168, and what modification to the algorithm's reporting step would select it?", 'new': 'where would 168 appear if the algorithm listed multiples of 42 and of 56 instead of divisors, and which element should it report?'},
        ],
        'C11-12': [
            {'unit': 4, 'field': 'teacher_notes', 'old': 'the lcm algorithm parallels the gcd algorithm but takes the rightmost element of the union rather than the intersection of divisors.', 'new': 'the lcm algorithm parallels the gcd algorithm but works with common multiples instead of common divisors, and reports the smallest one.'},
        ],
        'C11-14': [
            {'unit': 5, 'field': 'teacher_notes', 'old': 'scanning backwards stops at the first common divisor found, which is the largest, so only one check is needed.', 'new': 'scanning backwards stops at the first common divisor found, which is the largest — though it may still check many values of k before it gets there (for gcd(97, 100), every k from 97 down to 1).'},
        ],
        'C11-15': [
            {'item_where': {'question_text': "(a) Prove that for natural numbers m ≥ n, gcd(m, n) = gcd(n, m − n) by showing that d divides both m and n if and only if d divides both n and m − n. Write both directions of the argument clearly.\n(b) Use Euclid's subtraction algorithm to compute gcd(45, 30). Show each reduction step."}, 'field': 'look_for[3]', 'old': ' (Alternatively: gcd(45,30) → gcd(30,15) → gcd(15,0) = 15, noting 15 < 30 requires a swap step first depending on implementation.)', 'new': ''},
        ],
        'C11-16': [
            {'unit': 6, 'field': 'time_bands[0].activity', 'old': 'Students calculate how many steps gcd(99, 2) takes under the scan algorithm versus the dot-counting method for addition.', 'new': 'Students calculate how many values of k the scan algorithm checks when min(m, n) is 99, 999 and 9999.'},
        ],
        'C11-17': [
            {'unit': 1, 'field': 'teacher_notes', 'old': '(shown on p.35–36)', 'new': '(shown on p.37)'},
        ],
        'C11-S3': [
            {'unit': 3, 'field': 'teacher_notes', 'old': 'an ordering property that is exploited heavily in the sections that follow.', 'new': 'an ordering property that the gcd algorithm relies on.'},
            {'unit': 4, 'field': 'time_bands[1].activity', 'old': 'verify it gives 27000 for 54000 and 81000 (using the stated divisor counts)', 'new': "verify it gives 27000 for 54000 and 81000 (using the book's divisor lists, p.41–42)"},
            {'unit': 7, 'field': 'time_bands[3].activity', 'old': 'reflect on the journey from listing all divisors to this two-step algorithm.', 'new': 'reflect on the journey from listing all divisors to this division algorithm.'},
        ],
    },
    'ch_11_canonical_p11.json': {
        'C11-11': [
            {'unit': 6, 'field': 'teacher_notes', 'old': 'but take the leftmost rather than rightmost common multiple, confusing minimum with maximum.', 'new': "but take the rightmost (largest) common multiple instead of the leftmost (smallest), carrying over 'report the rightmost element' from the gcd."},
        ],
        'C11-S3': [
            {'unit': 3, 'field': 'teacher_notes', 'old': 'a step-by-step divisors algorithm in the next unit.', 'new': 'a step-by-step divisors algorithm.'},
            {'unit': 7, 'field': 'time_bands[3].activity', 'old': 'Leave the comparison open for the next unit.', 'new': 'Leave the comparison open.'},
            {'unit': 9, 'field': 'teacher_notes', 'old': "this contrasts sharply with Āryabhaṭa's improvement in the next unit.", 'new': "this contrasts sharply with Āryabhaṭa's improvement."},
            {'unit': 11, 'field': 'time_bands[1].activity', 'old': 'are precisely the Indian procedures Al-Khwārizmī transmitted to Europe.', 'new': 'are Indian procedures of the kind Al-Khwārizmī transmitted to Europe.'},
        ],
    },
    'ch_11_canonical.json': {
        'C11-08': [
            {'item_where': {'question_type': 'SCR'}, 'field': 'expected_elements[4]', 'old': 'or equivalently finds the smallest multiple of m that appears in divisors-of-n (alternative valid formulation)', 'new': 'or equivalently finds the smallest multiple of m that is also a multiple of n (alternative valid formulation)'},
        ],
        'C11-09': [
            {'item_where': {'question_type': 'SCR'}, 'field': 'guide.SCR.inclusivity', 'old': 'instead building the list of all multiples of m up to m×n and checking which appear in divisors-of-(m×n) — and discuss why this is less efficient.', 'new': 'instead building the list of all multiples of m up to m×n and keeping those that are also multiples of n — the smallest is the lcm — and discuss why this is less efficient.'},
        ],
        'C11-10': [
            {'unit': 6, 'field': 'time_bands[1].activity', 'old': 'or equivalently find all divisors of m that are also divisors of both m and n and take the smallest multiple.', 'new': 'or equivalently list the multiples of m and take the smallest one that is also a multiple of n.'},
        ],
        'C11-13': [
            {'unit': 11, 'field': 'time_bands[1].activity', 'old': 'The number of reductions is proportional to the value of the smaller number, not to its digit count.', 'new': 'The number of reductions is proportional to the value of the larger number, not to its digit count.'},
        ],
        'C11-S3': [
            {'unit': 3, 'field': 'time_bands[2].activity', 'old': 'Set up the structure that the next unit will execute in full.', 'new': 'Set up the structure the algorithm will use.'},
            {'unit': 10, 'field': 'time_bands[3].activity', 'old': 'Close with the observation — to be explored next unit — that', 'new': 'Close with the observation that'},
            {'unit': 11, 'field': 'time_bands[3].activity', 'old': "This motivates Āryabhaṭa's improvement introduced in the next unit.", 'new': "This motivates Āryabhaṭa's improvement."},
            {'unit': 5, 'field': 'time_bands[1].activity', 'old': 'Trace the method briefly for a small example on the board to confirm it yields gcd(54000, 81000) = 27000.', 'new': "Trace the method briefly for a small example on the board, then state that, applied to the book's lists, it gives gcd(54000, 81000) = 27000."},
            {'unit': 9, 'field': 'time_bands[1].activity', 'old': '3-digit minimum (about 100 candidates), 4-digit minimum (about 1000), 5-digit minimum (about 10000)', 'new': '3-digit minimum (up to 999 candidates), 4-digit minimum (up to 9999), 5-digit minimum (up to 99999)'},
            {'unit': 14, 'field': 'time_bands[1].activity', 'old': '(Draw out: both process the numbers column by column or digit step by step rather than repeatedly counting or subtracting by value.)', 'new': '(Draw out: in both, the number of steps grows with the number of digits rather than with the value of the numbers.)'},
            {'item_where': {'question_text': 'Use the five steps of the addition algorithm exactly as written in the chapter — write the numbers one below the other aligned from the right, add the rightmost digits first, set carry to 0 or 1 according to the rule, move left column by column, and write any final carry — to compute 3856 + 7479. Show the carry value after each column addition, and state the final sum.'}, 'field': 'guide.NUM.inclusivity', 'old': 'and explain how Step 5 applies when two leading carries accumulate.', 'new': 'and explain how Step 5 applies to the final carry.'},
            {'item_where': {'question_type': 'OPEN_TASK'}, 'field': 'task', 'old': '(c) whether its efficiency is proportional to the VALUE of the smaller input or to the NUMBER OF DIGITS of the inputs.', 'new': '(c) whether its efficiency is proportional to the VALUE of the inputs or to the NUMBER OF DIGITS of the inputs.'},
        ],
    },
    # ── C3 content-correctness check, Part II · chapter 12 (2026-10-02, founder-approved) ──
    # Findings: genon/out/content_checks/mathematics_ix_part2_findings.md, ids C12-nn.
    'ch_12_canonical_p10.json': {
        'C12-12': [
            {'unit': 8, 'field': 'time_bands[0].activity', 'old': "Guide them: choose any point A' in the plane; since P is the midpoint of A'B', reflect A' through P to get B'; repeat at Q for B' and C', at R for C' and D'.", 'new': 'Guide them: place A′ in the same position relative to PQRS as A (copy triangle SPA from the original, so that PA′ = PA and SA′ = SA); since P is the midpoint of A′B′, reflect A′ through P to get B′; repeat at Q for B′ and C′, at R for C′ and D′.'},
        ],
        'C12-17': [
            {'unit': 10, 'field': 'time_bands[2].activity', 'old': 'the angle sum of the two triangles formed gives ∠A + ∠B + ∠C + ∠D = (∠A + ∠B + ∠AEB) + (∠C + ∠D + ∠CED) − 180° = 360° − 180° = 180°, so the sum is strictly less than 360°. Ask: can it equal 2°? Yes — students construct an example with very thin angles.', 'new': 'the two triangles are AED and BEC: ∠A + ∠D = 180° − ∠AED and ∠B + ∠C = 180° − ∠BEC = 180° − ∠AED (vertically opposite), so ∠A + ∠B + ∠C + ∠D = 360° − 2∠AED, strictly less than 360°. Ask: can it equal 2°? Yes — make ∠AED = 179°.'},
        ],
        'C12-25': [
            {'item_where': {'implied_lo_assessed': 'Students can prove the Centroid Theorem (the three medians of a triangle are concurrent and the centroid divides each median in the ratio 2:1) using the Midpoint Theorem applied to sub-triangles.'}, 'field': 'question_text', 'old': '(Q is the midpoint of AC, P is the midpoint of BC)', 'new': '(Q is the midpoint of AC, P is the midpoint of AB)'},
        ],
        'C12-26': [
            {'item_where': {'implied_lo_assessed': 'Students can prove the Centroid Theorem (the three medians of a triangle are concurrent and the centroid divides each median in the ratio 2:1) using the Midpoint Theorem applied to sub-triangles.'}, 'field': 'expected_answer', 'old': 'In ∆ABC: P is the midpoint of BC and Q is the midpoint of AC', 'new': 'In ∆ABC: P is the midpoint of AB and Q is the midpoint of AC'},
        ],
        'C12-27': [
            {'unit': 2, 'field': 'homework[0]', 'old': 'show that the angle bisectors of a non-square parallelogram meet in a rectangle.', 'new': 'show that the angle bisectors of a parallelogram with unequal adjacent sides (AB ≠ BC) meet in a rectangle.'},
        ],
        'C12-39': [
            {'unit': 5, 'field': 'time_bands[1].activity', 'old': 'apply the Midpoint Theorem in triangles ABD and BDC to get EM and MF each parallel to the bases and each a known fraction of them, then combine.', 'new': 'apply the Midpoint Theorem in △ABD to get EM ∥ AB and EM = AB/2, so M lies on EF; then Theorem 7 in △BDC gives F as the midpoint of BC and MF = DC/2; combine.'},
        ],
        'C12-44': [
            {'item_where': {'question_text': "A student claims: 'If the diagonals of a quadrilateral are equal in length, then the quadrilateral must be a rectangle.' Evaluate this claim. Either prove it, or give a specific counterexample and explain which additional condition would make the claim true."}, 'field': 'look_for[1]', 'old': 'Gives a valid counterexample: e.g. an isosceles trapezium, or a non-rectangular parallelogram whose diagonals happen to be equal only in the special rectangular case — the clearest counterexample is any isosceles trapezium', 'new': 'Gives a valid counterexample — the clearest is any isosceles trapezium'},
        ],
        'C12-45': [
            {'unit': 5, 'field': 'time_bands[0].activity', 'old': 'introduce the midpoint of AD and apply the Midpoint Theorem in the appropriate triangle, using the converse to locate where the midpoint line meets BC.', 'new': 'apply Theorem 7 in triangle ABD (M is the midpoint of AB and MN ∥ BD) to show that MN meets AD at its midpoint.'},
        ],
        'C12-46': [
            {'unit': 6, 'field': 'teacher_notes', 'old': 'End of Chapter Q13, p.79 (does the Centroid Theorem generalise to non-convex triangles?) is outside scope, but', 'new': ''},
        ],
        'C12-47': [
            {'unit': 7, 'field': 'time_bands[1].activity', 'old': 'Students verify PQ ∥ SR still holds by the same argument on ∆ABD and ∆CBD.', 'new': 'Students verify that it gives the other pair, PS ∥ QR, by the same argument on ∆ABD and ∆CBD.'},
        ],
        'C12-48': [
            {'unit': 8, 'field': 'time_bands[1].activity', 'old': "Key step — show that S is collinear with A' and D': since S is the midpoint of DA in the original, and the same construction gives ∆SDR ≅ ∆SD'R by SAS (SR = SR, ∠DSR = ∠D'SR, SD = SD' as S reflects D to D'), we get D'S = DS and D' lies on line A'S.", 'new': 'Key step — show that S is the midpoint of A′D′, so S is collinear with A′ and D′ (the book suggests proving ∆SDR ≅ ∆SD′R); then A′B′C′D′ has the same vertex A and the same side midpoints as ABCD, so it is congruent to ABCD.'},
        ],
        'C12-S3': [
            {'unit': 3, 'field': 'time_bands[3].activity', 'old': 'Preview that the next unit introduces the Midpoint Theorem, whose proof', 'new': 'Preview the Midpoint Theorem, whose proof'},
            {'item_where': {'question_type': 'OPEN_TASK'}, 'field': 'task', 'old': 'the relationship between the diagonals of PQRS and those of ABCD.', 'new': 'the relationship between the sides of PQRS and the diagonals of ABCD.'},
            {'unit': 5, 'field': 'visual_aids', 'old': 'auxiliary median BD', 'new': 'auxiliary diagonal BD'},
        ],
    },
    'ch_12_canonical_p13.json': {
        'C12-89': [
            {'unit': 4, 'field': 'time_bands[2].activity', 'old': "Bridge to the chapter's internal purpose: the text presents", 'new': "Turn to the chapter's own use of them: the text presents"},
        ],
        'C12-07': [
            {'unit': 10, 'field': 'time_bands[1].activity', 'old': "identify the shared sides (MP and MC/2) and prove congruence by SSS using the Centroid Theorem's 2 : 1 ratio.", 'new': 'place each pair of pieces along their equal half-sides (for example ∆MPB and ∆MPC along PB = PC) and show the angles at P are supplementary, so each pair forms a triangle with sides AM, BM, CM.'},
        ],
        'C12-16': [
            {'unit': 13, 'field': 'time_bands[0].activity', 'old': 'express ∠A + ∠B + ∠C + ∠D in terms of the angles of triangles ABE and CDE, showing the sum is less than 360°. Then decide whether a self-intersecting quadrilateral with angle sum 2° is constructible (students argue a limiting case approaching two very thin triangles).', 'new': 'express ∠A + ∠B + ∠C + ∠D in terms of the angles of triangles AED and BEC, showing the sum is 360° − 2∠AED, which is less than 360°. Then decide whether a self-intersecting quadrilateral with angle sum 2° is constructible (yes — make ∠AED = 179°).'},
        ],
        'C12-18': [
            {'unit': 13, 'field': 'time_bands[3].activity', 'old': 'convex, non-convex and even self-intersecting planar quadrilaterals all tile, each for the same reason.', 'new': 'convex and non-convex quadrilaterals both tile, for the same reason; a self-intersecting 4-gon is not a tile at all — its angles do not even sum to 360° (End of Chapter Q3).'},
        ],
        'C12-19': [
            {'unit': 9, 'field': 'time_bands[1].activity', 'old': "For part (ii), students use the Varignon parallelogram's diagonal lengths: PR corresponds to diagonal BD (via the other pair of triangles) and QS to AC. They explore when the diagonals of PQRS are equal and perpendicular, linking to the condition AC = BD.", 'new': "For part (ii), students use the Varignon parallelogram's side lengths: PQ = SR = AC/2 and QR = PS = BD/2. If AC = BD, all four sides are equal, so PQRS is a rhombus and its diagonals PR and QS are perpendicular."},
        ],
        'C12-24': [
            {'item_where': {'question_text': "A student proposes a tiling procedure: 'Take any quadrilateral ABCD and rotate a copy through 180° about the midpoint of side AB. Keep repeating this about the midpoints of newly created shared edges to fill the plane.' Which statement best describes whether this procedure works and why?"}, 'field': 'guide.MCQ.what_each_option_reveals.A', 'old': 'a 180° rotation does reverse orientation (it is a half-turn), but this is precisely what makes the copy share the full edge', 'new': 'a 180° rotation does not reverse orientation (only a reflection does), and the half-turn is precisely what makes the copy share the full edge'},
        ],
        'C12-38': [
            {'unit': 7, 'field': 'time_bands[1].activity', 'old': 'Apply it in △BCD to get MF ∥ DC and MF = DC/2. Since EF ∥ AB ∥ DC and E, M, F are collinear, F is the midpoint of BC and EF = EM + MF = (AB + DC)/2.', 'new': 'Since EM ∥ AB and EF ∥ AB, M lies on EF. In △BCD, M is the midpoint of BD and MF ∥ DC, so by Theorem 7 F is the midpoint of BC and MF = DC/2; hence EF = EM + MF = (AB + DC)/2.'},
        ],
        'C12-40': [
            {'unit': 13, 'field': 'time_bands[1].activity', 'old': '(connecting AB-BC-CD-DA, or AB-BD-DC-CA, or AB-BC-CD in all cyclic orders)', 'new': '(ABCD, ABDC and ACBD — every other ordering names one of these three)'},
        ],
        'C12-41': [
            {'unit': 10, 'field': 'teacher_notes', 'old': 'the key insight is that DM can be viewed as a median of a triangle formed by extending sides of the parallelogram.', 'new': 'the key insight is that DM and AO (O the centre of the parallelogram) are medians of triangle ABD, so they meet at its centroid, one-third of the way along AC.'},
        ],
        'C12-42': [
            {'item_where': {'question_text': "The chapter warns that not every mathematical argument can be reversed, using 'if x = y then x² = y²' as an example of an implication whose converse is false. Which of the following correctly describes why the proof of Theorem 2 (if opposite sides of a quadrilateral are equal, it is a parallelogram) can be obtained by reversing the proof of Theorem 1(a)?"}, 'field': 'options[0].text', 'old': 'and in both cases the conclusion follows from alternate angles on transversal AC.', 'new': 'using the alternate angles in Theorem 1(a) and producing them in Theorem 2.'},
        ],
        'C12-43': [
            {'item_where': {'question_text': 'A pantograph is a drawing device built as a parallelogram linkage ABCD. As one vertex traces the original drawing, another vertex traces a scaled copy. Which property of a parallelogram is most directly responsible for the pantograph producing an exact copy (at a fixed scale) rather than a distorted one?'}, 'field': 'options[3].text', 'old': 'so every position of the moving vertex is a fixed ratio away from the tracing vertex.', 'new': 'so the fixed pivot, the tracing point and the copying point stay on one straight line at a fixed ratio of distances.'},
        ],
        'C12-S3': [
            {'unit': 4, 'field': 'time_bands[2].activity', 'old': 'the text says parallelograms will be used as a tool to prove facts about triangles.', 'new': 'the text presents parallelograms as a tool for proving facts about triangles.'},
            {'unit': 11, 'field': 'time_bands[3].activity', 'old': 'Preview that Method 2, using the Varignon parallelogram grid, will be developed next unit.', 'new': 'Note that Method 2 uses the Varignon parallelogram grid.'},
            {'unit': 3, 'field': 'time_bands[2].activity', 'old': 'After five minutes, pairs compare', 'new': 'Then pairs compare'},
            {'unit': 3, 'field': 'teacher_notes', 'old': 'Building on the Theorem 1 proofs completed in the previous unit,', 'new': 'Building on the Theorem 1 proofs,'},
            {'unit': 13, 'field': 'time_bands[2].activity', 'old': '(it may cross itself for self-intersecting ones)', 'new': ''},
            {'item_where': {'question_text': 'A pantograph is a drawing device built as a parallelogram linkage ABCD. As one vertex traces the original drawing, another vertex traces a scaled copy. Which property of a parallelogram is most directly responsible for the pantograph producing an exact copy (at a fixed scale) rather than a distorted one?'}, 'field': 'guide.MCQ.inclusivity', 'old': 'calculate the scale factor of the pantograph if AB = 10 cm and the extension arm beyond B is 5 cm.', 'new': 'explain, with a sketch, why the copy is larger when the pen is farther from the pivot than the tracer.'},
        ],
    },
    'ch_12_canonical.json': {
        'C12-01': [
            {'unit': 9, 'field': 'time_bands[1].activity', 'old': 'For part (i): extend EF to meet line AB extended at a point; identify a triangle and apply Theorem 7 to conclude F is the midpoint of BC; then compute EF using the Midpoint Theorem in appropriate triangles to get EF = (AB + CD)/2.', 'new': 'For part (i): draw diagonal BD, meeting EF at M. In △ABD, E is the midpoint of AD and EM ∥ AB, so M is the midpoint of BD and EM = AB/2 (Theorem 7). In △BDC, M is the midpoint of BD and MF ∥ DC, so F is the midpoint of BC and MF = DC/2. Hence EF = EM + MF = (AB + CD)/2.'},
        ],
        'C12-02': [
            {'unit': 9, 'field': 'teacher_notes', 'old': 'the key move is extending EF to the line through A and B to create a triangle in which E and F become midpoints; students who work only inside the trapezium get stuck.', 'new': 'the key move is drawing the diagonal BD, which splits the trapezium into two triangles in which Theorem 7 applies; students who do not draw it get stuck.'},
        ],
        'C12-03': [
            {'item_where': {'question_text': 'In trapezium ABCD, AB is parallel to DC. E is the midpoint of AD. A line through E, parallel to AB, meets BC at F. Given that AB = 11 cm and DC = 5 cm, find the length EF. Show all steps of your working.'}, 'field': 'method_one_line', 'old': 'Extend EF to meet line AB extended at a point G; apply the Converse Midpoint Theorem in triangle DAG to show F is the midpoint of BC; then use the Midpoint Theorem in triangle DAG to compute EF = (AB + DC)/2.', 'new': 'Draw diagonal BD meeting EF at G; in △ABD, E is the midpoint of AD and EG ∥ AB, so G is the midpoint of BD and EG = AB/2; in △BDC, GF ∥ DC, so F is the midpoint of BC and GF = DC/2; EF = (11 + 5)/2 = 8 cm.'},
        ],
        'C12-04': [
            {'item_where': {'question_text': 'In trapezium ABCD, AB is parallel to DC. E is the midpoint of AD. A line through E, parallel to AB, meets BC at F. Given that AB = 11 cm and DC = 5 cm, find the length EF. Show all steps of your working.'}, 'field': 'guide.NUM.inclusivity', 'old': 'suggest extending the line EF beyond F until it meets line AB (or line AB extended), creating a triangle in which E and F become midpoints.', 'new': 'suggest drawing the diagonal BD and looking at the two triangles it makes with the trapezium.'},
        ],
        'C12-05': [
            {'unit': 10, 'field': 'time_bands[2].activity', 'old': 'show ∆MPB ≅ ∆MPC by SSS (using MP = MP, PB = PC since P is midpoint of BC, and BM = CM by 2:1 ratio); assemble these into a larger triangle.', 'new': 'place ∆MPB and ∆MPC together along the equal sides PB and PC (P with P, B with C); since ∠MPB + ∠MPC = 180°, the two pieces form a triangle with sides MB, MC and 2MP = AM.'},
        ],
        'C12-06': [
            {'unit': 10, 'field': 'time_bands[2].activity', 'old': 'Find side lengths of the assembled triangles using the 2:1 ratio.', 'new': 'Show that each assembled triangle has sides AM, BM and CM — two-thirds of the three medians.'},
        ],
        'C12-08': [
            {'unit': 5, 'field': 'time_bands[1].activity', 'old': 'Discuss why AB = BC would make adjacent bisectors parallel (no intersection inside the figure).', 'new': 'Discuss why AB = BC would make the four bisectors lie along the two diagonals, so they all meet at one point and the rectangle shrinks to a point.'},
        ],
        'C12-09': [
            {'unit': 7, 'field': 'time_bands[1].activity', 'old': "With BP = CR and BP ∥ CR (both parallel to AC's direction), invoke Theorem 5", 'new': 'With BP = CR and BP ∥ CR (BP lies along AB, and CR was drawn parallel to BA), invoke Theorem 5'},
        ],
        'C12-10': [
            {'unit': 11, 'field': 'time_bands[2].activity', 'old': 'if AC = BD, then PQ = QR = BC/2 = half-diagonal, making PQRS a rhombus', 'new': 'if AC = BD, then PQ = AC/2 = BD/2 = QR, making PQRS a rhombus'},
        ],
        'C12-11': [
            {'unit': 12, 'field': 'time_bands[0].activity', 'old': "Discuss a counterexample: choose P at one-third of AB, Q at one-third of BC, etc. and show PQRS can still be a parallelogram. Ask: what extra condition would force them to be midpoints? (Answer: if ABCD is any quadrilateral and the parallelogram is specifically the one from Varignon's Theorem, then the midpoints are exactly what produce it.)", 'new': 'Discuss a counterexample: take P with AP = AB/3, Q with BQ = 2BC/3, R with CR = CD/3 and S with AS = AD/3; then PQ and SR are both parallel to AC and PS and QR are both parallel to BD, so PQRS is a parallelogram though no point is a midpoint. Ask: what extra condition would force the midpoints? (For example, PQRS having sides of length exactly AC/2 and BD/2.)'},
        ],
        'C12-13': [
            {'unit': 12, 'field': 'time_bands[3].activity', 'old': 'why knowing only the Varignon parallelogram is enough to reconstruct the original quadrilateral (up to a free choice of where to place A).', 'new': 'why the Varignon parallelogram together with the position of one vertex is enough to reconstruct the original quadrilateral.'},
        ],
        'C12-14': [
            {'unit': 13, 'field': 'teacher_notes', 'old': 'clarify that Method 1 produces one specific tiling and the three vertex-arrangements are just alternative descriptions of local vertex configurations that all arise in it.', 'new': 'clarify that Method 1 produces one specific tiling, and only one of the three vertex arrangements occurs in it — the book asks students to find which.'},
        ],
        'C12-15': [
            {'unit': 15, 'field': 'teacher_notes', 'old': 'the AAS congruence requires verifying the angle at Q (vertical angles) and the angle at A (alternate angles via PQ ∥ CS).', 'new': 'the congruence is SAS: AQ = QC, PQ = QS by construction, and the vertical angles at Q are equal; it then gives CS = AP = PB and CS ∥ AB (alternate angles).'},
        ],
        'C12-20': [
            {'item_where': {'question_text': 'Quadrilateral PQRS has all four vertices in one plane, no three vertices collinear, and no self-intersection. Its diagonals PR and QS are drawn. Diagonal PR lies entirely inside the quadrilateral, but diagonal QS passes partly outside it. Which of the following correctly describes PQRS?'}, 'field': 'options[3].text', 'old': 'PQRS is non-convex, because its diagonals do not intersect each other inside the figure.', 'new': 'PQRS is non-convex, because one of its diagonals is longer than the other.'},
        ],
        'C12-21': [
            {'item_where': {'question_text': 'Quadrilateral PQRS has all four vertices in one plane, no three vertices collinear, and no self-intersection. Its diagonals PR and QS are drawn. Diagonal PR lies entirely inside the quadrilateral, but diagonal QS passes partly outside it. Which of the following correctly describes PQRS?'}, 'field': 'guide.MCQ.what_each_option_reveals.D', 'old': 'Applies the intersection test correctly in direction (non-convex ↔ diagonals do not cross inside) but the stated reason is incomplete — the issue is that QS passes outside the figure, not merely that the diagonals fail to intersect inside; a student choosing D has partially correct reasoning but conflates the failure modes.', 'new': 'Reaches the right verdict for an irrelevant reason — the lengths of the diagonals say nothing about convexity; the test is where the diagonals lie.'},
        ],
        'C12-22': [
            {'item_where': {'question_text': "Quadrilateral ABCD has the property that its diagonals AC and BD bisect each other at point E (that is, AE = CE and BE = DE). A student writes the following proof that ABCD is a parallelogram:\n\n'Since AE = CE and BE = DE, triangles AEB and CED are congruent by SAS, using the vertical angles at E. Therefore AB = CD. Since the opposite sides are equal, ABCD is a parallelogram.'\n\n(i) Identify the logical error or gap in this proof. (ii) Write a complete, correct proof that ABCD is a parallelogram, naming every congruence criterion and theorem you use."}, 'field': 'look_for[1]', 'old': 'such as a kite', 'new': 'such as an isosceles trapezium'},
        ],
        'C12-23': [
            {'item_where': {'question_text': 'A pantograph is a mechanical device that uses four rigid links forming a parallelogram to produce a scaled copy of a drawing. As one vertex of the parallelogram traces the original figure, a second vertex traces the copy. Which property of a parallelogram is the essential reason the copy has the same shape and orientation as the original?'}, 'field': 'options[3].text', 'old': 'The opposite sides of a parallelogram are equal and parallel, so the direction and relative displacement between the tracing vertex and the copying vertex remain constant as the device moves.', 'new': 'The opposite sides of a parallelogram stay equal and parallel as the device moves, so the fixed pivot, the tracing point and the copying point stay on one straight line at a fixed ratio of distances.'},
        ],
        'C12-30': [
            {'unit': 16, 'field': 'time_bands[2].activity', 'old': '(2) for PQRS to be a rectangle, the diagonals AC and BD of ABCD must be equal (by the square condition in Exercise E-13 part (iii) — not perpendicular for rectangle); identify the exact condition (AC = BD makes PQRS a rhombus, AC ⊥ BD makes PQRS a rectangle since then PQ ⊥ QR) and correct the claim.', 'new': '(2) PQRS is a rectangle exactly when PQ ⊥ QR, that is when AC ⊥ BD (AC = BD instead makes it a rhombus); for a parallelogram ABCD this happens only when ABCD is a rhombus, so the claim is false in general — correct it.'},
        ],
        'C12-31': [
            {'unit': 7, 'field': 'time_bands[2].activity', 'old': 'Preview the proof strategy (running the proof backwards) to be developed in the next unit.', 'new': 'Note that the book returns to this question in End of Chapter Q22; the next result, Theorem 7, answers a different question — the line through a midpoint parallel to a side.'},
        ],
        'C12-32': [
            {'unit': 8, 'field': 'time_bands[0].activity', 'old': "applying Theorem 6 to triangles ABD or ACD to locate MN's relationship to AD.", 'new': 'applying Theorem 7 in triangle ABD (M is the midpoint of AB and MN ∥ BD) to show that MN passes through the midpoint of AD.'},
        ],
        'C12-33': [
            {'unit': 12, 'field': 'time_bands[1].activity', 'old': 'this means A′ is the reflection of both B′ through P and D′ through S; use a ruler to place A′ at 2·SP – S (the point such that S is the midpoint of A′D′), then construct B′, C′, D′ in turn. Part (ii): show ∆SDR ≅ ∆SD′R by SAS (SD = SD′ since S is the midpoint, SR = SR, ∠DSR = ∠D′SR as constructed), so D = D′ in position and S is correctly collinear with A′ and D′.', 'new': "place A′ where A sits relative to PQRS (copy triangle SPA), then reflect A′ in P to get B′, B′ in Q to get C′, and C′ in R to get D′. Part (ii): show that S is the midpoint of A′D′ — for example via ∆SDR ≅ ∆SD′R, as the book's hint suggests — so A′B′C′D′ has the same side midpoints and the same vertex A as ABCD, and is congruent to it."},
        ],
        'C12-34': [
            {'unit': 14, 'field': 'time_bands[1].activity', 'old': "each gap is bounded by the midpoint-segments of the four surrounding copies, which by Varignon's Theorem form a parallelogram congruent to the Varignon parallelogram of SOME, so it has the right shape to hold another copy.", 'new': 'each gap is bounded by one side of each of the four surrounding copies, and its own Varignon parallelogram is the unshaded cell of the grid; matching sides and midpoints is what makes it a copy of SOME.'},
        ],
        'C12-35': [
            {'unit': 15, 'field': 'time_bands[0].activity', 'old': 'By the Converse Midpoint Theorem, the midpoints of the portions of the crossing lines between the ruled lines are collinear — use this to locate the midpoint of the drawn segment.', 'new': 'Because the ruled lines are equally spaced and parallel, they cut the drawn segment into equal parts (apply Theorem 7, or End of Chapter Q7, repeatedly) — so its midpoint is where it crosses the ruled line halfway between its two ends.'},
        ],
        'C12-36': [
            {'unit': 15, 'field': 'time_bands[2].activity', 'old': 'argue that APCS is a parallelogram (AP ∥ CS with AP = CS from the congruence ∆APQ ≅ ∆CSQ by AAS), giving PQ ∥ BC.', 'new': 'argue that ∆APQ ≅ ∆CSQ by SAS, so CS = AP = PB and CS ∥ AB; then PBCS is a parallelogram (Theorem 5), giving PQ ∥ BC and PS = BC, so PQ = BC/2.'},
        ],
        'C12-37': [
            {'item_where': {'question_text': "Quadrilateral ABCD has the property that its diagonals AC and BD bisect each other at point E (that is, AE = CE and BE = DE). A student writes the following proof that ABCD is a parallelogram:\n\n'Since AE = CE and BE = DE, triangles AEB and CED are congruent by SAS, using the vertical angles at E. Therefore AB = CD. Since the opposite sides are equal, ABCD is a parallelogram.'\n\n(i) Identify the logical error or gap in this proof. (ii) Write a complete, correct proof that ABCD is a parallelogram, naming every congruence criterion and theorem you use."}, 'field': 'guide.ECR.inclusivity', 'old': 'ask them to also verify that the correct proof cannot be shortened by using Theorem 5 (one pair of equal and parallel sides) — and to explain why that theorem does not apply directly here (we do not yet know the sides are parallel, only equal).', 'new': 'ask them to notice that the same congruence also gives ∠ABE = ∠CDE, so AB ∥ CD — and with AB = CD, Theorem 5 finishes the proof in one step.'},
        ],
        'C12-49': [
            {'unit': 12, 'field': 'visual_aids', 'old': '(for End of Chapter Q13 variant and Exercise E-13)', 'new': '(for Exercise Set 12.3 Q5)'},
        ],
        'C12-S3': [
            {'unit': 2, 'field': 'time_bands[3].activity', 'old': '(Exercise E-24, p.78', 'new': '(p.78'},
            {'unit': 2, 'field': 'homework[0]', 'old': ' (Exercise E-4)', 'new': ''},
            {'unit': 4, 'field': 'homework[0]', 'old': ' (Exercise E-7)', 'new': ''},
            {'unit': 7, 'field': 'homework[0]', 'old': ' (Exercise E-10)', 'new': ''},
            {'unit': 9, 'field': 'teacher_notes', 'old': ' (Exercise E-29)', 'new': ''},
            {'unit': 11, 'field': 'homework[0]', 'old': ' (Exercise E-28)', 'new': ''},
            {'unit': 13, 'field': 'homework[0]', 'old': ' (Exercise E-16)', 'new': ''},
            {'unit': 12, 'field': 'time_bands[2].activity', 'old': 'Exercise E-13', 'new': 'Exercise Set 12.3 Q5'},
            {'unit': 16, 'field': 'teacher_notes', 'old': 'from Exercise E-13', 'new': 'from Exercise Set 12.3 Q5'},
            {'unit': 3, 'field': 'time_bands[2].activity', 'old': 'note that this is exactly Theorem 3, which the class will prove in the next unit.', 'new': 'note that this is exactly Theorem 3.'},
            {'unit': 3, 'field': 'time_bands[2].activity', 'old': 'Students work individually for a few minutes then share', 'new': 'Students work individually, then share'},
            {'unit': 6, 'field': 'time_bands[2].activity', 'old': 'This is the Midpoint Theorem, to be proved formally in the next unit.', 'new': 'This is the Midpoint Theorem, to be proved formally.'},
            {'unit': 13, 'field': 'time_bands[0].activity', 'old': 'and experiment for a few minutes trying to arrange', 'new': 'and experiment, trying to arrange'},
            {'unit': 13, 'field': 'time_bands[3].activity', 'old': 'the formal argument is developed in the next unit.', 'new': 'the formal argument comes later.'},
            {'unit': 4, 'field': 'time_bands[3].activity', 'old': "as a concise restatement of Theorem 3's converse.", 'new': 'as a concise restatement of Theorem 3.'},
            {'unit': 7, 'field': 'time_bands[1].activity', 'old': '(alternate angles, PQ extended and CR ∥ AP)', 'new': '(alternate angles, transversal AC, since CR ∥ AP)'},
            {'unit': 6, 'field': 'time_bands[1].activity', 'old': 'folds and cuts along PQ, MN (midpoints of the other two sides), producing four small triangles.', 'new': 'folds and cuts along the three segments joining the three midpoints, producing four small triangles.'},
            {'unit': 15, 'field': 'visual_aids', 'old': 'Board diagram for End of Chapter Q13 showing ABCD as a non-convex quadrilateral with its Varignon parallelogram PQRS still intact', 'new': 'Board diagrams for End of Chapter Q2 (the ruled-paper segment) and Q12 (parallelogram ABCD with DM and BN trisecting AC)'},
            {'unit': 16, 'field': 'time_bands[1].activity', 'old': '(d) if the diagonal of ∆ABC (where the diagonal AC is drawn) has its midpoint marked, state what Theorem 7 says about the line through that midpoint parallel to BC.', 'new': '(d) in ∆ABC (cut off by the diagonal AC), mark the midpoint P of AB and state what Theorem 7 says about the line through P parallel to BC.'},
            {'item_where': {'question_text': "A student wants to tile the entire plane using congruent copies of a single irregular quadrilateral SOME, whose four interior angles are labelled 1, 2, 3 and 4.\n\n(i) Explain why four copies of SOME can always be arranged around a common point so that their angles fit together with no gap and no overlap.\n\n(ii) Describe Method 1 (rotation about an edge midpoint) precisely, and justify why each new copy placed by this method fits perfectly along its shared edge and why the angles at each vertex of the tiling always sum to 360°.\n\n(iii) The student claims: 'This only works if SOME is convex.' State whether this claim is correct and give a brief justification."}, 'field': 'look_for[1]', 'old': 'the midpoint M of edge OM', 'new': 'the midpoint of edge OM'},
        ],
    },
    # ── C3 content-correctness check, Part II · chapter 13 (2026-10-02, founder-approved) ──
    # Findings: genon/out/content_checks/mathematics_ix_part2_findings.md, ids C13-nn.
    'ch_13_canonical_p10.json': {
        'C13-07': [
            {'unit': 2, 'field': 'time_bands[3].activity', 'old': 'and that a rational coefficient such as √2 is valid.', 'new': 'and that an irrational coefficient such as √2 is valid, since a, b and c may be any real numbers.'},
        ],
        'C13-08': [
            {'item_where': {'question_text': 'The ordered pair (2, -1) is a solution of the equation 2mx + 3y = 7 and also a solution of the equation 4x + ny = -10. Find the values of m and n. Show your working and verify each value in its respective equation.'}, 'field': 'expected_answer', 'old': 'm = 2, n = 6', 'new': 'm = 5/2, n = 18'},
        ],
        'C13-09': [
            {'item_where': {'expected_answer': 'x = 4, y = 3'}, 'field': 'question_text', 'old': '2x - y = 3', 'new': '2x - y = 5'},
        ],
        'C13-10': [
            {'item_where': {'expected_answer': 'x = 4, y = 3'}, 'field': 'guide.NUM.inclusivity', 'old': 'from 2x - y = 3, write y = 2x - 3,', 'new': 'from 2x - y = 5, write y = 2x - 5,'},
        ],
        'C13-23': [
            {'unit': 2, 'field': 'time_bands[1].activity', 'old': 'and to the case with decimal coefficients cleared by multiplication.', 'new': 'and to (i) and (iii), where the book keeps the decimal coefficients and shows that multiplying through by -1 gives another valid set of values.'},
        ],
        'C13-24': [
            {'item_where': {'question_text': 'The ordered pair (2, -1) is a solution of the equation 2mx + 3y = 7 and also a solution of the equation 4x + ny = -10. Find the values of m and n. Show your working and verify each value in its respective equation.'}, 'field': 'method_one_line', 'old': 'Substitute x = 2, y = -1 into each equation separately: 2m(2) + 3(-1) = 7 gives 4m = 10 so m = 2.5 — re-check: 2(2)(2) + 3(-1) = 8 - 3 = 5 ≠ 7. Re-derive: 4m - 3 = 7, 4m = 10, m = 5/2; and 4(2) + n(-1) = -10 gives 8 - n = -10, n = 18.', 'new': 'Substitute x = 2, y = -1 into each equation separately: 2m(2) + 3(-1) = 7 gives 4m - 3 = 7, so m = 5/2; 4(2) + n(-1) = -10 gives 8 - n = -10, so n = 18.'},
        ],
        'C13-25': [
            {'item_where': {'question_text': 'Argue, with full justification, why the equation 3x + 4y = 12 has infinitely many solutions. In your argument, explain the role of choosing a value for one variable and show how to generate three distinct solutions. Also explain why each solution you generate is guaranteed to be different from the others.'}, 'field': 'look_for[2]', 'old': 'Argues that different x-values produce different ordered pairs — if (u1, v1) and (u2, v2) were the same with u1 ≠ u2, this contradicts the uniqueness of the solution for each chosen x.', 'new': 'Notes that solutions generated from different x-values are different ordered pairs, because their first coordinates differ.'},
        ],
        'C13-26': [
            {'item_where': {'implied_lo_assessed': 'Students can determine the number of solutions of a pair of linear equations by comparing the coefficient ratios a1/a2, b1/b2 and c1/c2, and find parameter values that produce a specified outcome.'}, 'field': 'question_text', 'old': '(b) For what value of k does the pair have no solution? Justify.', 'new': '(b) Is there a value of k for which the pair has no solution? Justify.'},
        ],
        'C13-S3': [
            {'unit': 9, 'field': 'time_bands[1].activity', 'old': "Briefly mention the 'Pinch of History' context: this type of elegant manipulation was known to Āryabhaṭa and Brahmagupta long before Gauss.", 'new': "Briefly mention the 'Pinch of History' context: elimination was used in China's Nine Chapters and studied by Āryabhaṭa and Brahmagupta, centuries before Gauss's name became attached to it; this problem itself comes from Mahāvīrāchārya's Gaṇita sāra saṅgraha (c. 850 CE)."},
        ],
    },
    'ch_13_canonical_p13.json': {
        'C13-11': [
            {'item_where': {'question_text': 'The ordered pair (4, -1) is a solution of both 5x + py = 17 and qx - 3y = 19. Find the values of p and q.'}, 'field': 'expected_answer', 'old': 'p = -3/1 = -3 (from 20 + p(-1) = 17 ⟹ p = 3; recheck: 5(4) + p(-1) = 17 ⟹ 20 - p = 17 ⟹ p = 3). q: q(4) - 3(-1) = 19 ⟹ 4q + 3 = 19 ⟹ q = 4. So p = 3, q = 4.', 'new': 'p = 3, q = 4. Substituting (4, -1): 5(4) + p(-1) = 17 gives 20 - p = 17, so p = 3; q(4) - 3(-1) = 19 gives 4q + 3 = 19, so q = 4.'},
        ],
        'C13-12': [
            {'item_where': {'question_text': 'Solve the pair of equations 3x + 5y = 26 and x - 2y = -4 using the elimination method. Verify your solution in both equations.'}, 'field': 'expected_answer', 'old': 'x = 2, y = 4. Verification: 3(2) + 5(4) = 6 + 20 = 26 ✓; 2 - 2(4) = 2 - 8 = -6 ≠ -4. Recheck: x = 2, y = 4: x - 2y = 2 - 8 = -6. Re-solve: multiply x - 2y = -4 by 3: 3x - 6y = -12. Subtract from 3x + 5y = 26: 11y = 38, y = 38/11. Back-substitute: x = -4 + 2(38/11) = (-44 + 76)/11 = 32/11. Verification: 3(32/11) + 5(38/11) = 96/11 + 190/11 = 286/11 = 26 ✓; 32/11 - 2(38/11) = 32/11 - 76/11 = -44/11 = -4 ✓. Answer: x = 32/11, y = 38/11.', 'new': 'x = 32/11, y = 38/11. Multiply x - 2y = -4 by 3 to get 3x - 6y = -12; subtract from 3x + 5y = 26 to get 11y = 38, so y = 38/11; then x = 2y - 4 = 76/11 - 44/11 = 32/11. Check: 3(32/11) + 5(38/11) = 286/11 = 26 ✓ and 32/11 - 2(38/11) = -44/11 = -4 ✓.'},
        ],
        'C13-18': [
            {'unit': 9, 'field': 'time_bands[1].activity', 'old': 'Ask: why is 42 the unique answer?', 'new': 'Ask: the solution assumed that the tens digit is the larger one — what if it is the smaller? (Then x - y = -2, giving 24, and 24 + 42 = 66 as well, so two numbers fit the conditions.)'},
        ],
        'C13-19': [
            {'unit': 10, 'field': 'time_bands[2].activity', 'old': 'Students apply the rules to Exercise Set 13.5 Q8, p.118 (End of Chapter Q8):', 'new': 'Students apply the rules to End of Chapter Q8, p.120:'},
        ],
        'C13-20': [
            {'unit': 10, 'field': 'textbook_items_in_class[0].book_ref', 'old': 'Exercise Set 13.5 Q8, p.118', 'new': 'End of Chapter Q8, p.120'},
        ],
        'C13-21': [
            {'unit': 10, 'field': 'time_bands[3].activity', 'old': 'and Exercise Set 13.5 Q9, p.121 (find a and b', 'new': 'and End of Chapter Q9, p.121 (find a and b'},
        ],
        'C13-22': [
            {'unit': 10, 'field': 'textbook_items_in_class[1].book_ref', 'old': 'Exercise Set 13.5 Q9, p.121', 'new': 'End of Chapter Q9, p.121'},
        ],
        'C13-S3': [
            {'unit': 1, 'field': 'teacher_notes', 'old': ', ahead of the next unit.', 'new': '.'},
            {'unit': 11, 'field': 'time_bands[3].activity', 'old': 'one problem type from today where', 'new': 'one problem type from these problems where'},
            {'unit': 13, 'field': 'teacher_notes', 'old': 'A common error in Exercise Set 13.5 Q3, p.117 is computing c1/c2 from the equations before moving c to the standard-form side — remind students to rearrange to ax + by + c = 0 first.', 'new': 'The pairs in Exercise Set 13.5 Q3, p.117 are already in standard form; when a pair is not (as in End of Chapter Q3, p.120), a common error is to take c1 and c2 from the right-hand side without changing sign — remind students to rearrange to ax + by + c = 0 first.'},
        ],
    },
    'ch_13_canonical.json': {
        'C13-01': [
            {'unit': 5, 'field': 'time_bands[1].activity', 'old': '(vi) (1, 2) is a solution of 2x + 3y = 7 — TRUE by substitution.', 'new': '(vi) (1, 2) is a solution of 2x + 3y = 7 — FALSE: 2(1) + 3(2) = 8 ≠ 7.'},
        ],
        'C13-02': [
            {'item_where': {'implied_lo_assessed': 'Students can rewrite a linear equation in two variables in the standard form ax + by + c = 0 and correctly identify the coefficients a and b and the constant c.'}, 'field': 'question_text', 'old': 'is rewritten in the standard form ax + by + c = 0. Which set', 'new': 'is rewritten in the standard form ax + by + c = 0 with integer coefficients and a = 1. Which set'},
        ],
        'C13-03': [
            {'item_where': {'implied_lo_assessed': 'Students can rewrite a linear equation in two variables in the standard form ax + by + c = 0 and correctly identify the coefficients a and b and the constant c.'}, 'field': 'guide.MCQ.what_each_option_reveals.C', 'old': 'Multiplies through by -3 instead of 3, reversing all signs and giving a = -1, b = 2, c = 6 — a valid representation (multiplying by -1 gives another valid set), but with the wrong sign choice relative to option A; confuses valid sign-reversal with the required rearrangement.', 'new': 'Multiplies through by -3 instead of 3. This is also a valid standard form of the same line (multiplying by -1 gives another valid set), but it does not meet the condition a = 1 in the question.'},
        ],
        'C13-04': [
            {'item_where': {'implied_lo_assessed': 'Students can rewrite a linear equation in two variables in the standard form ax + by + c = 0 and correctly identify the coefficients a and b and the constant c.'}, 'field': 'guide.MCQ.what_each_option_reveals.D', 'old': 'Reads off the coefficients before multiplying through by 3 — treats the fractional form x/3 - (2/3)y - 2 = 0 as the standard form without clearing fractions, leaving a = 1/3 and b = -2/3.', 'new': 'Reads off the coefficients before multiplying through by 3: x/3 - (2/3)y - 2 = 0 is a valid standard form (the book allows fractional coefficients), but the question asks for integer coefficients with a = 1.'},
        ],
        'C13-05': [
            {'item_where': {'implied_lo_assessed': 'Students can rewrite a linear equation in two variables in the standard form ax + by + c = 0 and correctly identify the coefficients a and b and the constant c.'}, 'field': 'guide.MCQ.inclusivity', 'old': 'verify that option D is also a mathematically valid standard form (obtained by multiplying through by -3) and discuss why the section notes that multiplying by -1 gives another equally valid set of values.', 'new': "explain why options C and D describe the same line as option A (C is A multiplied by -1; D is A divided by 3), and why the condition 'integer coefficients with a = 1' picks out exactly one set."},
        ],
        'C13-06': [
            {'item_where': {'question_text': 'Solve the pair of equations 5x + 3y = 29 and 2x - y = 4 using elimination. Show your working and verify the solution in both equations.'}, 'field': 'expected_answer', 'old': 'x = 41/11, y = 37/11. Verification: 5(41/11) + 3(37/11) = 205/11 + 111/11 = 316/11 ≠ 29... Correction: solve correctly. From 2x - y = 4, multiply by 3: 6x - 3y = 12. Add to 5x + 3y = 29: 11x = 41, so x = 41/11. Then y = 2(41/11) - 4 = 82/11 - 44/11 = 38/11. Verification: 5(41/11) + 3(38/11) = 205/11 + 114/11 = 319/11 ≠ 29. Re-solve: multiply 2x - y = 4 by 3 gives 6x - 3y = 12. Add to 5x + 3y = 29: 11x = 41, x = 41/11. y = 2(41/11) - 4 = 82/11 - 44/11 = 38/11. Check: 5(41/11) + 3(38/11) = (205 + 114)/11 = 319/11. This does not equal 29 = 319/11? 29 × 11 = 319. Yes! 319/11 = 29. Verified. x = 41/11, y = 38/11.', 'new': 'x = 41/11, y = 38/11. Multiply 2x - y = 4 by 3 to get 6x - 3y = 12; add to 5x + 3y = 29 to get 11x = 41, so x = 41/11; then y = 2x - 4 = 82/11 - 44/11 = 38/11. Check: 5(41/11) + 3(38/11) = 319/11 = 29 ✓ and 2(41/11) - 38/11 = 44/11 = 4 ✓.'},
        ],
        'C13-13': [
            {'item_where': {'question_text': 'Priya buys x notebooks at ₹15 each and y pens at ₹8 each, spending exactly ₹79 in total. Which equation correctly models this situation?'}, 'field': 'guide.MCQ.what_each_option_reveals.D', 'old': 'Moves the total to the left as a negative constant (standard form), but uses -79 when the standard form from ax + by + c = 0 would require +79 as c and a correct rearrangement gives 15x + 8y - 79 = 0; this option uses +79 instead of -79, incorrectly.', 'new': 'Moves the total to the left-hand side without changing its sign: 15x + 8y = 79 rearranges to 15x + 8y - 79 = 0, not 15x + 8y + 79 = 0.'},
        ],
        'C13-14': [
            {'item_where': {'question_text': 'A line passes through the points P(−3, 7) and Q(5, −1). What is the slope of this line?'}, 'field': 'options[1].text', 'old': '3/4', 'new': '3'},
        ],
        'C13-15': [
            {'item_where': {'question_text': 'A line passes through the points P(−3, 7) and Q(5, −1). What is the slope of this line?'}, 'field': 'guide.MCQ.what_each_option_reveals.B', 'old': 'Reverses the formula, computing run/rise = (5 - (-3))/(-1 - 7) = 8/(-8) with a sign error, or confuses the order of subtraction partially.', 'new': 'Adds the coordinates instead of subtracting them: (7 + (-1))/((-3) + 5) = 6/2 = 3.'},
        ],
        'C13-16': [
            {'item_where': {'question_type': 'OPEN_TASK'}, 'field': 'scaffold', 'old': 'For part (b): read a, b, c from each equation in the standard form ax + by + c = 0 and compute the three ratios.', 'new': "For part (b): write each equation in the standard form ax + by + c = 0 and compare a1/a2 with b1/b2 (Plan Q's equation has c = 0, so c1/c2 cannot be formed; it is not needed once a1/a2 ≠ b1/b2)."},
        ],
        'C13-17': [
            {'unit': 15, 'field': 'time_bands[3].activity', 'old': 'Connect to the parallel-line criterion: equal slopes mean no intersection. Confirm the results algebraically.', 'new': 'Treating each path as a straight line from its starting point: in (i) the slopes 4/3 and 2 differ and the lines meet at (30, 40), a point both robots reach (Robot 1 after 10 moves, Robot 2 after 20). In (ii) the slopes 1 and -3/5 also differ and the lines meet at (4.5, 1.5); but Robot 2 never goes left of x = 7, so that point is not on its path. Different slopes guarantee that two lines meet, not that two paths starting from given points do.'},
        ],
        'C13-S3': [
            {'unit': 5, 'field': 'time_bands[1].activity', 'old': 'After five minutes, pairs compare verdicts.', 'new': 'Pairs then compare verdicts.'},
            {'unit': 5, 'field': 'teacher_notes', 'old': ', which foreshadows the infinite-solution case for pairs.', 'new': '.'},
            {'unit': 6, 'field': 'teacher_notes', 'old': 'The Think-and-Reflect prompt about extending line AB foreshadows the constancy of slope, which the next unit proves formally.', 'new': 'The Think-and-Reflect prompt about extending line AB suggests that slope is the same all along a line; section 13.3.2 proves it.'},
            {'unit': 16, 'field': 'teacher_notes', 'old': ' — without requiring any specific prior activity to have taken place', 'new': ''},
            {'unit': 16, 'field': 'time_bands[1].activity', 'old': 'Students work individually for five minutes, then pairs compare.', 'new': 'Students work individually, then pairs compare.'},
            {'item_where': {'question_text': 'A school canteen sells sandwiches for ₹x each and juice cartons for ₹y each. On Monday, a group bought 3 sandwiches and 5 juice cartons for ₹115. On Tuesday, another group bought 5 sandwiches and 2 juice cartons for ₹130. Which pair of equations models this situation correctly?'}, 'field': 'guide.MCQ.inclusivity', 'old': 'A student ready for a challenge can find the actual price of a sandwich and juice carton and verify both original conditions.', 'new': 'A student ready for a challenge can solve the pair, find that the prices are not whole rupees (x = 420/19, y = 185/19), and suggest a Tuesday total that would make them whole (for example ₹141 gives x = 25, y = 8).'},
        ],
    },
    # ── C3 content-correctness check, Part II · chapter 14 (2026-10-02, founder-approved) ──
    # Findings: genon/out/content_checks/mathematics_ix_part2_findings.md, ids C14-nn.
    'ch_14_canonical_p10.json': {
        'C14-10': [
            {'item_where': {'question_text': 'A cuboid has dimensions 8 cm × 5 cm × 4 cm and a cube has the same volume as this cuboid. Find (i) the side length of the cube and (ii) the difference between the total surface area of the cuboid and the total surface area of the cube.'}, 'field': 'expected_answer', 'old': '(i) side of cube = 4√10^(1/3) — wait, let us compute exactly. Volume of cuboid = 8×5×4 = 160 cm³. Cube side a: a³ = 160, so a = ∛160 ≈ 5.43 cm. TSA of cuboid = 2(8×5 + 5×4 + 4×8) = 2(40+20+32) = 2(92) = 184 cm². TSA of cube = 6a² = 6×(∛160)² ≈ 6×29.49 ≈ 176.9 cm². Difference ≈ 184 − 176.9 ≈ 7.1 cm². To give a clean problem: use volume 125 cm³ (cube side 5 cm) and cuboid 25 cm × 5 cm × 1 cm. TSA cuboid = 2(125+25+5) = 310 cm². TSA cube = 6×25 = 150 cm². Difference = 160 cm². Using cuboid 5 cm × 5 cm × 5 cm is the cube itself. Use cuboid 10 cm × 5 cm × 2.5 cm, V = 125 cm³. TSA cuboid = 2(50+12.5+25) = 2(87.5) = 175 cm². TSA cube = 150 cm². Difference = 25 cm². Final answer: side of cube = 5 cm; TSA of cuboid = 175 cm²; TSA of cube = 150 cm²; difference = 25 cm².', 'new': "(i) Volume of cuboid = 8 × 5 × 4 = 160 cm³, so the cube's side is a = ∛160 ≈ 5.43 cm. (ii) TSA of cuboid = 2(40 + 20 + 32) = 184 cm²; TSA of cube = 6a² = 6 × (∛160)² ≈ 176.8 cm². Difference ≈ 184 − 176.8 = 7.2 cm²; the cuboid has the larger surface area."},
        ],
        'C14-11': [
            {'item_where': {'question_text': 'A right triangle with legs 9 cm and 12 cm and hypotenuse 15 cm is rotated through 360° about its 9 cm leg. Which of the following correctly gives the volume of the solid formed?'}, 'field': 'options[1].text', 'old': '(1/3) × π × 12² × 9 cm³ — wait, rotation about 9 cm leg makes r = 12 cm and h = 9 cm. V = (1/3)π(12²)(9) = (1/3)π×144×9 = 432π cm³. Correct option should state r=12, h=9.', 'new': '(1/3) × π × 12² × 9 cm³'},
        ],
        'C14-12': [
            {'item_where': {'question_text': 'A right triangle with legs 9 cm and 12 cm and hypotenuse 15 cm is rotated through 360° about its 9 cm leg. Which of the following correctly gives the volume of the solid formed?'}, 'field': 'options[0].text', 'old': '(1/3) × π × 12² × 9 cm³', 'new': 'π × 12² × 9 cm³'},
        ],
        'C14-13': [
            {'item_where': {'implied_lo_assessed': 'Students can derive and apply the curved surface area CSA = 2πr², total surface area TSA = 3πr², and volume V = (2/3)πr³ of a hemisphere, distinguishing which surface area formula applies to a given real-world context.'}, 'field': 'question_text', 'old': 'a curved surface area of 1386 m²', 'new': 'a curved surface area of 2772 m²'},
        ],
        'C14-14': [
            {'item_where': {'implied_lo_assessed': 'Students can derive and apply the curved surface area CSA = 2πr², total surface area TSA = 3πr², and volume V = (2/3)πr³ of a hemisphere, distinguishing which surface area formula applies to a given real-world context.'}, 'field': 'expected_answer', 'old': '(i) CSA = 2πr² = 1386. So r² = 1386/(2 × 22/7) = 1386 × 7/44 = 9702/44 = 220.5. Hmm, not a perfect square. Adjust: use CSA = 2πr² and set r² = 1386 × 7 / (2 × 22) = 9702/44 = 220.5. Let me try a clean value: if r = 21 m then CSA = 2 × (22/7) × 441 = 2 × 22 × 63 = 2772 m². Use CSA = 693 m²: r² = 693 × 7/44 = 4851/44 = 110.25, r = 10.5 m. Clean: r = 10.5 m, CSA = 2×(22/7)×(10.5)² = 2×(22/7)×110.25 = 2×22×15.75 = 693 m². Use the problem as stated with CSA = 1386: r² = 1386/(2π) = 1386×7/(2×22) = 9702/44 = 220.5. Not clean. Use CSA = 2772 m²: r = 21 m, volume = (2/3)πr³ = (2/3)×(22/7)×9261 = (2/3)×22×1323 = (2×22×1323)/3 = 58212/3 = 19404 m³. Final clean problem answer: CSA = 2772 m², r = 21 m, V = 19404 m³. (Note: question text says 1386 m² — adjusting: r² = 1386×7/44 = 220.5, r ≈ 14.85 m, not clean. The problem will be re-stated with CSA = 2772 m² in the verified version. Using CSA = 2772: (i) r = 21 m; (ii) V = (2/3)×(22/7)×21³ = (2/3)×(22/7)×9261 = (44×9261)/21 = (44×441) = 19404 m³.)', 'new': '(i) 2πr² = 2772, so r² = 2772 × 7 / 44 = 441 and r = 21 m. (ii) V = (2/3)πr³ = (2/3) × (22/7) × 9261 = 19404 m³.'},
        ],
        'C14-15': [
            {'item_where': {'implied_lo_assessed': 'Students can model an unfamiliar quantity-estimation problem by identifying the relevant solid shapes, stating explicit assumptions, applying appropriate volume or area formulas, and interpreting different answers arising from different assumptions.'}, 'field': 'question_text', 'old': "Student B assumes only 80% of each slice's volume is edible, because she accounts for the rind.", 'new': "Student B assumes only 80% of the watermelon's volume is edible flesh, because she accounts for the rind, and that each slice is cut from the flesh."},
        ],
        'C14-16': [
            {'item_where': {'implied_lo_assessed': 'Students can model an unfamiliar quantity-estimation problem by identifying the relevant solid shapes, stating explicit assumptions, applying appropriate volume or area formulas, and interpreting different answers arising from different assumptions.'}, 'field': 'look_for[1]', 'old': 'Student B: edible volume per slice = 0.8 × 432π = 345.6π cm³; slices = 4500π / 345.6π = 4500/345.6 ≈ 13.0, so 13 complete slices.', 'new': 'Student B: edible volume = 0.8 × 4500π = 3600π cm³; slices = 3600π / 432π ≈ 8.3, so 8 complete slices.'},
        ],
        'C14-17': [
            {'item_where': {'implied_lo_assessed': 'Students can model an unfamiliar quantity-estimation problem by identifying the relevant solid shapes, stating explicit assumptions, applying appropriate volume or area formulas, and interpreting different answers arising from different assumptions.'}, 'field': 'look_for[2]', 'old': '(10 vs 13)', 'new': '(10 vs 8)'},
        ],
        'C14-32': [
            {'unit': 7, 'field': 'time_bands[1].activity', 'old': 'the string length equals the surface area of the ball, and each circle has area πr².', 'new': "the string covers the whole surface of the ball, so the area it fills on paper equals the ball's surface area; each circle has area πr²."},
        ],
        'C14-33': [
            {'item_where': {'question_text': "In the string-winding activity, a string is wound tightly over the entire surface of a rubber ball of radius r, then unwound and used to fill circles of radius r drawn on paper. The string is found to fill exactly four such circles. (i) Explain, step by step, how this result verifies the formula Surface Area = 4πr². (ii) A student claims: 'This activity proves that the surface area of any sphere is 4πr².' Is this claim correct? Justify your answer by distinguishing between experimental verification and mathematical proof."}, 'field': 'look_for[0]', 'old': 'states that the string length represents the surface area of the ball;', 'new': "states that the string covers the ball's surface, so the area it fills on paper equals the ball's surface area;"},
        ],
        'C14-34': [
            {'item_where': {'question_text': "In the string-winding activity, a string is wound tightly over the entire surface of a rubber ball of radius r, then unwound and used to fill circles of radius r drawn on paper. The string is found to fill exactly four such circles. (i) Explain, step by step, how this result verifies the formula Surface Area = 4πr². (ii) A student claims: 'This activity proves that the surface area of any sphere is 4πr².' Is this claim correct? Justify your answer by distinguishing between experimental verification and mathematical proof."}, 'field': 'look_for[0]', 'old': 'the total string length covers 4 × πr² = 4πr²;', 'new': 'the string covers 4 × πr² = 4πr²;'},
        ],
        'C14-35': [
            {'unit': 7, 'field': 'teacher_notes', 'old': 'End of Chapter Q31 (p.145) can guide self-study for students who want to work through the enclosing-cylinder argument more carefully.', 'new': 'Students who want more can redo End of Chapter Q9 (p.145) for a hemisphere and its enclosing cylinder of height r (the ratio is again 2/3).'},
        ],
        'C14-36': [
            {'unit': 10, 'field': 'teacher_notes', 'old': 'End of Chapter Q36 (p.146)', 'new': 'End of Chapter Q18(i) (p.146)'},
        ],
        'C14-S3': [
            {'item_where': {'question_type': 'SCR'}, 'field': 'expected_elements[0]', 'old': 'Names the solid as a rectangular pyramid (or square-based pyramid if student notes 9 ≠ 4 and correctly calls it rectangular).', 'new': 'Names the solid as a pyramid with a rectangular base (a rectangular pyramid).'},
        ],
    },
    'ch_14_canonical_p13.json': {
        'C14-06': [
            {'unit': 9, 'field': 'time_bands[2].activity', 'old': '882π ≈ 2771.3 cm²; TSA = 3π × 441 = 1323π ≈ 4156.9 cm²', 'new': '882π = 2772 cm² (π = 22/7); TSA = 3π × 441 = 1323π = 4158 cm²'},
        ],
        'C14-07': [
            {'item_where': {'question_text': 'A solid wooden cuboid measures 10 cm × 6 cm × 4 cm. A solid wooden cube is made from wood of the same volume as this cuboid. Find (i) the side length of the cube, correct to one decimal place, and (ii) the difference in total surface areas between the cuboid and the cube, correct to one decimal place. State clearly which solid has the greater total surface area.'}, 'field': 'expected_answer', 'old': 'TSA of cube = 6 × (6.2)² = 6 × 38.44 = 230.6 cm². Difference = 248 − 230.6 = 17.4 cm²;', 'new': 'TSA of cube = 6 × (∛240)² ≈ 6 × 38.62 ≈ 231.7 cm² (using the rounded side 6.2 here gives 230.6, which is too small). Difference ≈ 248 − 231.7 = 16.3 cm²;'},
        ],
        'C14-08': [
            {'item_where': {'question_text': 'A solid wooden cuboid measures 10 cm × 6 cm × 4 cm. A solid wooden cube is made from wood of the same volume as this cuboid. Find (i) the side length of the cube, correct to one decimal place, and (ii) the difference in total surface areas between the cuboid and the cube, correct to one decimal place. State clearly which solid has the greater total surface area.'}, 'field': 'guide.NUM.inclusivity', 'old': 'use 6² = 216 and 7² = 343 to bracket the cube root', 'new': 'use 6³ = 216 and 7³ = 343 to bracket the cube root'},
        ],
        'C14-09': [
            {'item_where': {'question_type': 'OPEN_TASK'}, 'field': 'guide.OPEN_TASK.reading_the_scaffold', 'old': 'Ordered packing: diameter 14 cm ÷ 2 cm = 7 marbles per row, 7 rows per layer (square grid), 20 cm ÷ 2 cm = 10 layers; estimate = 7 × 7 × 10 = 490. The gap between 735 and 490 reflects packing inefficiency.', 'new': 'Ordered packing: the base is a circle of diameter 14 cm, so rows get shorter away from the centre; a square grid of 2 cm marbles fits about 32 per layer (7 × 7 = 49 would need a 14 cm × 14 cm square base), and 20 cm ÷ 2 cm = 10 layers, so the estimate is about 320. The gap between 735 and 320 reflects the gaps between marbles and the space lost at the curved wall.'},
        ],
        'C14-22': [
            {'unit': 13, 'field': 'time_bands[4].activity', 'old': "the chapter's formulas all follow from one of two geometric ideas — unfolding a curved surface into a flat shape or picturing a solid as a stack of thin slices —", 'new': "the chapter's formulas come from flattening or matching surfaces (nets; Archimedes' cylinder for the sphere) and from stacking slices or comparing with a cylinder (the one-third rule) —"},
        ],
        'C14-25': [
            {'unit': 2, 'field': 'time_bands[1].activity', 'old': 'cut along a slant edge of the curved surface and unroll it into a rectangle', 'new': 'cut straight down the curved surface, parallel to the axis, and unroll it into a rectangle'},
        ],
        'C14-26': [
            {'unit': 4, 'field': 'teacher_notes', 'old': 'Exercise Set 14.3 Q3 (p.133)', 'new': 'Exercise Set 14.3 Q3 (p.134)'},
        ],
        'C14-27': [
            {'unit': 4, 'field': 'homework[0]', 'old': 'Exercise Set 14.3 Q3, p.133', 'new': 'Exercise Set 14.3 Q3, p.134'},
        ],
        'C14-28': [
            {'unit': 5, 'field': 'time_bands[3].activity', 'old': 'CSA = πrl = π × 6 × 10 = 60π cm³.', 'new': 'CSA = πrl = π × 6 × 10 = 60π cm².'},
        ],
        'C14-29': [
            {'unit': 9, 'field': 'time_bands[3].activity', 'old': 'CSA = 2π × (5.6)² ≈ 197.1 m² = 1,971,000 cm²; cost = (1,971,000 / 100) × 10 = ₹197,100.', 'new': 'with π = 22/7, CSA = 2 × (22/7) × (5.6)² = 197.12 m² = 1,971,200 cm²; cost = (1,971,200 / 100) × 10 = ₹1,97,120.'},
        ],
        'C14-30': [
            {'unit': 9, 'field': 'teacher_notes', 'old': 'which applies to a dome but not to a solid or a bowl', 'new': 'which is right for a dome or an open bowl but not for a solid hemisphere'},
        ],
        'C14-31': [
            {'item_where': {'question_type': 'OPEN_TASK'}, 'field': 'scaffold', 'old': 'Ordered packing: find how many marbles fit along the diameter, how many rows fit along the diameter at right angles, and how many layers fit along the height. Multiply to get the realistic estimate.', 'new': 'Ordered packing: draw the circular base to scale and count how many marbles fit in one layer (rows are shorter away from the centre), then multiply by the number of layers that fit along the height.'},
        ],
        'C14-S3': [
            {'unit': 2, 'field': 'time_bands[4].activity', 'old': 'Preview that the next unit revisits why these formulas hold through a slice-stacking argument.', 'new': 'Note that a slice-stacking argument also explains why these formulas hold.'},
            {'unit': 3, 'field': 'time_bands[3].activity', 'old': '(No — this foreshadows the cone.)', 'new': '(No — the base area would change from slice to slice.)'},
            {'unit': 4, 'field': 'time_bands[4].activity', 'old': '— to be established experimentally in the next unit.', 'new': '— a result the book checks by experiment.'},
            {'unit': 10, 'field': 'homework[0]', 'old': 'bring your measurements and estimate to the next unit.', 'new': 'bring your measurements and estimate to class.'},
            {'unit': 12, 'field': 'teacher_notes', 'old': 'A frequent error in the marble problem (End of Chapter Q15, p.146) is computing the volume of marbles needed and forgetting that the water is also displaced — make sure students set up the displacement equation correctly.', 'new': "A frequent error in the marble problem (End of Chapter Q15, p.146) is dividing the rise in height, or the extra water volume by a marble's surface area — make sure students write 'extra volume = n × marble volume' before solving."},
        ],
    },
    'ch_14_canonical.json': {
        'C14-01': [
            {'unit': 13, 'field': 'time_bands[0].activity', 'old': 'the water level must rise from 16 cm to 20 cm in a cylinder of radius 3.5 cm. Students compute the extra volume needed: π(3.5)²(4) = 49π cm³. Each marble has volume (4/3)π(1)³ = (4/3)π cm³. Number of marbles = 49π ÷ (4/3)π = 49 × 3/4 ≈ 36.75, so 37 marbles.', 'new': 'the water level must rise from 16 cm to 20 cm in a cylinder of radius 4 cm. Students compute the extra volume needed: π(4)²(4) = 64π cm³. Each marble has volume (4/3)π(1)³ = (4/3)π cm³. Number of marbles = 64π ÷ (4/3)π = 64 × 3/4 = 48 marbles.'},
        ],
        'C14-02': [
            {'unit': 13, 'field': 'teacher_notes', 'old': 'frequently leads to the error of computing the number of marbles as 49 (forgetting to divide by the marble volume)', 'new': 'frequently leads to the error of giving the number of marbles as 64 (forgetting to divide by the marble volume)'},
        ],
        'C14-03': [
            {'unit': 13, 'field': 'textbook_items_in_class[0].description', 'old': 'cylindrical glass (diameter 7 cm, water height 16 cm)', 'new': 'cylindrical glass (radius 4 cm, water height 16 cm)'},
        ],
        'C14-04': [
            {'item_where': {'question_type': 'ECR'}, 'field': 'guide.ECR.inclusivity', 'old': 'As a challenge, ask: would the argument still work for an oblique cylinder sliced parallel to the base (giving elliptical cross-sections)? What changes?', 'new': 'As a challenge, ask: would the argument still work for an oblique circular cylinder? (Slices parallel to the base are still circles of area πr², so V = πr²h still holds, with h the perpendicular height.)'},
        ],
        'C14-05': [
            {'item_where': {'implied_lo_assessed': 'Students can select among the surface-area and volume formulas for cuboids, cubes, cylinders, cones, pyramids, spheres and hemispheres to solve composite-solid and real-world estimation problems, justifying their formula choice and handling shared surfaces correctly.'}, 'field': 'guide.OPEN_TASK.inclusivity', 'old': 'if the cylinder height is doubled but the radius is halved (same cylinder volume) — does the hemispherical dome change things?', 'new': "if the radius is halved and the cylinder height is made four times as great (which keeps the cylinder's volume the same) — what happens to the dome's share of the total?"},
        ],
        'C14-18': [
            {'unit': 1, 'field': 'time_bands[3].activity', 'old': 'the class decides whether the cube or the elongated cuboid makes a better swimming pool for a given capacity,', 'new': "the class weighs the book's two pool options, (A) 8 ft deep × 50 ft × 20 ft and (B) 6 ft deep × 100 ft × 15 ft (8000 ft³ against 9000 ft³),"},
        ],
        'C14-19': [
            {'unit': 9, 'field': 'teacher_notes', 'old': 'End of Chapter Q9, p.145 is the formal companion — a short algebraic argument that is the true proof.', 'new': 'End of Chapter Q9, p.145 is a short algebraic argument, but it starts from the stated formula V = (4/3)πr³; it is not a proof of SA = 4πr², which the book takes from Archimedes.'},
        ],
        'C14-20': [
            {'unit': 16, 'field': 'time_bands[0].activity', 'old': "for pyramids, cones and — as the sphere's V = (1/3) × 4πr² × r shows — the sphere itself.", 'new': 'for pyramids and cones; the sphere fits a related pattern, V = (1/3) × surface area × radius = (1/3) × 4πr² × r, from the thin cones that meet at its centre.'},
        ],
        'C14-21': [
            {'unit': 16, 'field': 'time_bands[3].activity', 'old': "Close by locating the chapter's big idea: every solid's surface area comes from unfolding its faces into flat shapes, and every solid's volume comes from stacking thin cross-sectional slices.", 'new': "Close by locating the chapter's two big ideas: surface area is found by flattening or matching surfaces (nets for cuboids, cylinders and cones; Archimedes' cylinder for the sphere), and volume by stacking thin slices or comparing with a cylinder (the one-third rule for cones and pyramids)."},
        ],
        'C14-23': [
            {'item_where': {'question_text': 'A cylindrical tin closed at both ends has radius 3.5 cm and height 10 cm. Find its total surface area in cm², using π = 22/7. Show all working.'}, 'field': 'guide.NUM.inclusivity', 'old': 'As a challenge, ask students to find the height that minimises the TSA for a fixed volume of 385π cm³, leading to h = 2r.', 'new': "As a challenge, keep the volume fixed at this tin's 385 cm³ and compare the TSA for radii 2.5, 3.5, 4 and 5 cm; the smallest TSA is at r = 4 cm, the tin whose height (about 7.7 cm) is closest to its diameter."},
        ],
        'C14-24': [
            {'item_where': {'implied_lo_assessed': 'Students can select among the surface-area and volume formulas for cuboids, cubes, cylinders, cones, pyramids, spheres and hemispheres to solve composite-solid and real-world estimation problems, justifying their formula choice and handling shared surfaces correctly.'}, 'field': 'task', 'old': 'if 1 m³ of grain (at 75% packing) has a mass of about 600 kg', 'new': 'if the grain itself (not counting the air gaps between grains) has a mass of about 600 kg per m³'},
        ],
        'C14-S3': [
            {'unit': 5, 'field': 'teacher_notes', 'old': 'Exercise Set 14.3 Q5, p.134 is a good diagnostic: students who substitute h instead of l will get an inconsistent radius.', 'new': 'Exercise Set 14.3 Q3, p.134 is a good diagnostic: it gives h = 16 and r = 12, and students who put h into πrl instead of first finding l = 20 get the wrong CSA.'},
            {'unit': 6, 'field': 'time_bands[3].activity', 'old': 'what is the ratio of their lateral surface areas for the same r and h?', 'new': 'what is the ratio of their curved surface areas for the same r and h? (Not 1 : 3 — it is πrl : 2πrh = l : 2h, which depends on the shape.)'},
            {'unit': 9, 'field': 'time_bands[0].activity', 'old': "using pins at the 'fullest' part to mark the equator,", 'new': "using pins at the 'fullest' part to hold the string in place,"},
            {'unit': 16, 'field': 'time_bands[2].activity', 'old': 'approximately 540 times', 'new': 'approximately 250 times'},
            {'item_where': {'question_text': 'Cylinder P has radius r and height h. Cylinder Q has radius 3r and height h/3. Find (i) the ratio of the volume of P to the volume of Q, and (ii) the ratio of the curved surface area of P to the curved surface area of Q. Show all working.'}, 'field': 'guide.NUM.inclusivity', 'old': 'As a challenge, ask students to find a scaling of r and h that keeps both volume and CSA unchanged simultaneously.', 'new': 'As a challenge, ask students whether any change of r and h, other than leaving both alone, keeps both volume and CSA unchanged, and to explain why not.'},
            {'item_where': {'question_text': 'In the string-winding activity for verifying the surface area of a sphere, the string wound around the ball is unwound and used to fill circles drawn on paper with the same radius as the ball. The string fills exactly four such circles. What does this show, and why does it not count as a mathematical proof of SA = 4πr²?'}, 'field': 'guide.MCQ.inclusivity', 'old': "As a challenge, students can read about Archimedes' cylinder-enclosing argument from section 14.5 and explain why that IS a proof.", 'new': "As a challenge, students can explain why a deductive argument such as Archimedes' (which section 14.5 describes but does not reproduce) would count as a proof."},
        ],
    },
  },
  ("science", "viii"): {
    # ── ARV-D-177 (continued) · the mangrove data table's salinity row is the one
    # gap-fill whose DIRECTION has no source anywhere (DO and silt directions come from
    # band 4; salinity is wholly new). Student-facing data the task computes on — the
    # row goes rather than stands unsourced.
    "ch_12_canonical.json": {
        "ARV-D-177": [
            {"unit": 12, "field": "visual_aids[1].table",
             "old": "\nSalinity | 18 ppt | 22 ppt",
             "new": ""},
        ],
    },
  },
  ("the_world_around_us", "v"): {
    # ── S5 · the_world_around_us · V · ch 5 (2026-08-12) ─────────────────────────────
    # ARV-D-120 · the U11 item, two breaches on one item, and only ONE of them is mechanical.
    #
    # (a) `question_type: "HI"` — a `dominant_mode` code, outside the closed taxonomy
    #     {MCQ, SCR, ECR, OPEN_TASK}. The correct value is not guessed: the item's OWN
    #     `guide` is keyed `SCR`, it carries three `expected_elements` and an empty
    #     `options` — the SCR shape in every particular — so the file already declares what
    #     it is, and this pass makes the label agree with it. The cause is visible in
    #     assessment Rule 3, whose guidance table puts `dominant_mode` in the LEFT column and
    #     the type in the right ("HI / CG-6 inquiry steps … | SCR"); the model emitted the left.
    #
    # (b) `question_text: null` — A1 permits "" or [], never null, and for an SCR the stem IS
    #     the question, so as authored there was nothing to ask. THIS HALF IS AUTHORED, NOT
    #     DERIVED, and is therefore a DECLARED repair in the strictest sense: the stem below is
    #     written to the item's own three `expected_elements`, one clause each —
    #       1 "names one type of traditional headgear from the section"      -> "Name one …"
    #       2 "identifies at least one reason … climate, cultural occasion,
    #          or material available locally"                               -> "why … suits the
    #                                                                          region it comes from"
    #       3 "connects … to the broader idea that clothing reflects where
    #          people live and who they are"                                -> "what it tells us
    #                                                                          about the people who wear it"
    #     — and grounded in the section the item is anchored to (Diversity Everywhere: saafa/pagri
    #     from Rajasthan, topi from Himachal Pradesh, Textbook p. 87) and in its unit's activity
    #     (U11 "Headgear from Every Region"). No element is added that the guide does not already
    #     expect, and none is left unasked. The item's Rule 7 regional-variation annotation
    #     already covers the answer's regional spread and is untouched.
    "ch_05_canonical.json": {
        "ARV-D-120a": [
            {"item_where": {"period_ref": [11]}, "field": "question_type",
             "old": "HI", "new": "SCR"},
        ],
        "ARV-D-120b": [
            {"item_where": {"period_ref": [11]}, "field": "question_text",
             "old": None,
             "new": ("Name one traditional headgear worn in a particular region of India. "
                     "In two or three sentences, explain why that headgear suits the region "
                     "it comes from, and what it tells us about the people who wear it.")},
        ],
    },
  },
}


# =======================================================================================
# plumbing
# =======================================================================================

def iter_items(obj):
    if isinstance(obj, dict):
        if isinstance(obj.get("questions"), list):
            yield from obj["questions"]
        if isinstance(obj.get("assessment_items"), list):
            yield from obj["assessment_items"]
        for value in obj.values():
            yield from iter_items(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from iter_items(value)


def unit_of(result, number):
    for period in result["lesson_plan"]["periods"]:
        if period["period_number"] == number:
            return period
    raise KeyError(f"no unit {number}")


def _dotted(field):
    # Dotted dict path (2026-10-02): reaches a guide sub-field such as
    # guide.MCQ.what_each_option_reveals.D, which the name[idx].leaf form cannot.
    return re.fullmatch(r"\w+(?:\.\w+)+", field) is not None


def get_nested(container, field):
    if _dotted(field):
        for key in field.split("."):
            container = container[key]
        return container
    match = re.fullmatch(r"(\w+)\[(\d+)\](?:\.(\w+))?", field)
    if not match:
        # An ABSENT top-level field reads as None rather than raising (2026-08-17,
        # ARV-D-172): science·ix ch 7 p18's OPEN_TASK omitted `question_text` entirely,
        # and the certifier's str(item.get(...)) renders absent and null identically —
        # a declared edit with old=None must be able to reach both states. The
        # refuse-on-drift guard is unchanged: any OTHER current value still mismatches
        # the declared old and refuses.
        return container.get(field) if isinstance(container, dict) else container[field]
    name, idx, leaf = match.group(1), int(match.group(2)), match.group(3)
    target = container[name][idx]
    return target[leaf] if leaf else target


def set_nested(container, field, value):
    if _dotted(field):
        *path, last = field.split(".")
        for key in path:
            container = container[key]
        container[last] = value
        return
    match = re.fullmatch(r"(\w+)\[(\d+)\](?:\.(\w+))?", field)
    if not match:
        container[field] = value
        return
    name, idx, leaf = match.group(1), int(match.group(2)), match.group(3)
    if leaf:
        container[name][idx][leaf] = value
    else:
        container[name][idx] = value


def apply_declared(result, table, filename):
    """Substring replacement inside a named field, or whole-value replacement for non-strings."""
    edits, refusals = [], []
    for defect, entries in table.items():
        for entry in entries:
            if "item_where" in entry:
                # THE ITEM SELECTOR (added 2026-08-12, S5 · ARV-D-120). The declared table
                # could reach a period or a handoff row, but not an assessment item — so a
                # defect in an item's own field had nowhere to be repaired.
                #
                # Selection is by EXACT MATCH on the item's own declared fields, never by a
                # computed join. That is deliberate: how an item finds its unit is the verified
                # 8-rule table's business and varies by subject·stage, so a selector that
                # re-derived it here would be genon inventing linkage — exactly what P5.5's
                # doctrine forbids. Matching literal field values invents nothing and reads the
                # same on every stage. `raw_item_list` returns the LIVE items (it is
                # container-shape aware), so the edit reaches the file.
                where = entry["item_where"]
                cands = [it for it in _carriers.raw_item_list(result)
                         if all(it.get(k) == v for k, v in where.items())]
                if len(cands) != 1:
                    refusals.append(f"{filename}: item_where {where!r} matched "
                                    f"{len(cands)} items, expected exactly 1")
                    continue
                container, label = cands[0], f"item{where}"
            elif "row" in entry:
                # .get, not [] (2026-08-17): a stage without section-numbered handoff
                # rows (science·middle) must REFUSE a foreign declaration, not crash.
                rows = [r for r in result["coverage_handoff"]
                        if r.get("section_number") == entry["row"]]
                if not rows:
                    refusals.append(f"{filename}: no handoff row {entry['row']}")
                    continue
                container, label = rows[0], f"sec#{entry['row']}"
            else:
                container, label = unit_of(result, entry["unit"]), f"U{entry['unit']}"

            current = get_nested(container, entry["field"])

            if isinstance(entry["old"], str):
                # AN EMPTY `old` IS A SET, NOT A REPLACE (2026-08-20). `"abc".replace("", x)`
                # inserts x between every character, so a declaration meaning "this field is
                # empty, fill it" corrupts the field the SECOND time it runs — the first time
                # `current` is "" and the result looks perfect. ARV-D-180's authored MCQ
                # prompt was declared that way and re-ran during an unrelated sweep: 133
                # characters became 17,955, and only the tool's own backup saved it.
                # Refuse rather than guess: the non-string branch below already does a safe
                # set with a real drift check, and a declaration that wants one should use
                # `"old": None`.
                if entry["old"] == "":
                    refusals.append(
                        f"{filename} {label}.{entry['field']}: `old` is the empty string. "
                        "That is a SET, not a replace — str.replace('') inserts between "
                        "every character. Declare it as `\"old\": None` (the non-string "
                        "branch sets the value and still refuses on drift).")
                    continue
                # Order matters: `new` is often a PREFIX of `old` (a shortened label), so the
                # already-repaired test must run only after the old text is ruled out.
                if entry["old"] in (current or ""):
                    updated = current.replace(entry["old"], entry["new"])
                elif entry["new"] in (current or ""):
                    continue                              # already repaired
                else:
                    refusals.append(
                        f"{filename} {label}.{entry['field']}: expected text absent — "
                        f"{entry['old'][:60]!r}")
                    continue
            else:
                if current == entry["new"]:
                    continue
                # `old: None` MEANS "this field is empty; fill it" (2026-08-20). The
                # refusal above tells a declaration to use None for exactly this case, and
                # then a strict `!=` rejected it — `'' != None` — so the advice could not
                # be followed. A shell's empty field arrives as "" (ARV-D-187, ARV-D-195),
                # as an absent key, or as [] / {} for the list and dict fields, and all
                # four mean the same thing to a human writing the declaration. Drift is
                # still refused: a field with real content in it does not match None.
                empty_ok = entry["old"] is None and current in (None, "", [], {})
                if not empty_ok and current != entry["old"]:
                    refusals.append(
                        f"{filename} {label}.{entry['field']}: expected {entry['old']!r}, "
                        f"found {current!r}")
                    continue
                updated = entry["new"]

            set_nested(container, entry["field"], updated)
            edits.append({"defect": defect, "where": label, "field": entry["field"],
                          "old": entry["old"], "new": entry["new"]})
    return edits, refusals


def load_summary_items(subject, grade, chapter):
    path = CHAPTERS / subject / grade / "summaries" / f"ch_{chapter:02d}_summary.json"
    if not path.exists():
        return {}
    summary = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for key in ("enumerated_worked_examples", "enumerated_exercises"):
        for item in summary.get(key, []):
            out[item["id"]] = item
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("subject")
    parser.add_argument("grade")
    parser.add_argument("chapter", type=int)
    parser.add_argument("--dry-run", action="store_true")
    # --declared-only (2026-08-17, founder ruling at S3 wave 2): touch certified artefacts
    # only where a gate flagged them. The generic passes stay available for the corpus
    # pre-warm, but a declared repair must be appliable without dragging them along.
    parser.add_argument("--declared-only", action="store_true")
    # --pass ARV-D-nnn (2026-08-20): run ONE generic pass. `--declared-only` exists so a
    # declared repair does not drag the generic suite along; this is the same argument in
    # the other direction. S7's Material-tab pointer had to reach 35 chapters, and running
    # the whole suite to deliver it would have applied ARV-D-073 and ARV-D-077 across a
    # stage that has never been through them — unrelated edits, unannounced, on certified
    # artefacts. A pass a founder asked for is not a licence for the ones they did not.
    parser.add_argument("--pass", dest="one_pass", metavar="ARV-D-nnn")
    args = parser.parse_args()

    folder = PLANS / args.subject / args.grade / _config.LP_YEAR
    files = sorted(folder.glob(f"ch_{args.chapter:02d}_canonical*.json"))
    if not files:
        print(f"no library at {folder}")
        return 1

    # `subject` rides in ctx so a pass whose AUTHORITY is one subject's constitution can gate
    # itself (see pass_open_task_substitution, 2026-08-12). A pass that needs this is, by that
    # fact, not generic — the gate is a declaration, not a convenience.
    ctx = {"summary_items": load_summary_items(args.subject, args.grade, args.chapter),
           "subject": args.subject, "grade": args.grade, "chapter": args.chapter}
    repaired_any = False
    now = datetime.datetime.now().replace(microsecond=0).isoformat()
    stamp = now.replace("-", "").replace(":", "").replace("T", "_")
    refused_any = False

    for path in files:
        doc = json.loads(path.read_text(encoding="utf-8"))
        result = doc["result"]
        by_defect = {}

        _generic = [] if args.declared_only else [
            g for g in GENERIC_PASSES
            if not args.one_pass or g[0] == args.one_pass]
        for defect, label, fn in _generic:
            edits = fn(result, ctx)
            if edits:
                by_defect.setdefault(defect, {"label": label, "edits": []})["edits"].extend(edits)

        declared, refusals = apply_declared(
            result,
            DECLARED.get((args.subject, args.grade), {}).get(path.name, {}),
            path.name)
        for edit in declared:
            by_defect.setdefault(edit["defect"], {"label": "declared edit", "edits": []})
            by_defect[edit["defect"]]["edits"].append(
                {k: v for k, v in edit.items() if k != "defect"})
        for line in refusals:
            refused_any = True
            print(f"  REFUSED {line}")

        if not by_defect:
            print(f"OK    {path.name} — nothing to repair")
            continue

        summary = ", ".join(f"{d} ×{len(v['edits'])}" for d, v in sorted(by_defect.items()))
        if args.dry_run:
            print(f"WOULD REPAIR {path.name} — {summary}")
            continue

        backup_dir = BACKUP / stamp
        backup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy(path, backup_dir / path.name)

        doc.setdefault("genon_canonical", {}).setdefault("repairs", []).append({
            "tool": TOOL,
            "at": now,
            "reason": "C3 defect repair (testing.md C3 · S4 mathematics·secondary). Generic "
                      "passes derive their value from the summary, the Pedagogy document or the "
                      "schema; declared edits are hand-written per instance and listed with "
                      "their defect id. No pedagogical content was regenerated: register and "
                      "continuity edits delete or rephrase a clause whose content is already "
                      "named, and word-count edits shorten a label without adding a fact.",
            "defects": {d: {"note": v["label"], "edits": v["edits"]}
                        for d, v in sorted(by_defect.items())},
        })

        path.write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
        print(f"REPAIRED {path.name} — {summary}")
        repaired_any = True

    if not args.dry_run:
        print(f"\nbackups: backup/c3_repair/{stamp}/")
        # PURGE THE DERIVED PLANS (testing.md C10.2b, ARV-D-034). An in-place repair does not
        # move the cache key, so any served plan built before this run would keep serving
        # pre-repair bytes until something dislodged it — the pilot did exactly that for four
        # hours. Every other repair tool calls this; omitting it here was found at S4's C10.
        if repaired_any:
            purge(args.subject, args.grade, args.chapter,
                  reason=f"{TOOL} — C3 defect repair")
    return 1 if refused_any else 0


if __name__ == "__main__":
    sys.exit(main())
