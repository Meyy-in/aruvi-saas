#!/usr/bin/env python3
"""build_library.py — ONE Terminal command builds a chapter's whole variant library.

    python3 genon/build_library.py social_sciences ix 3

Why Terminal: the Cowork sandbox proxy blocks credentialed API calls in every mode
(proven 2026-08-01 — an x-api-key request never leaves the sandbox), so the metered
Sonnet-4.6 generations must run here, where runtime_data/anthropic.key works.
Everything deterministic runs here too, so the whole mechanical pipeline is one
command; the Cowork session's job is what remains — reading the certification
report at the human gate.

Steps (stops on the first failure; each is idempotent to re-run):
  1. top canonical (LP + assessment)          — generate_canonical.py, metered
  2. annotate master_plan.json                — variant_plans.py (row finalizes)
  3. variant briefs                            — written to genon/out/briefs/
  4. each compact variant (LP + assessment)    — generate_canonical.py --variant, metered
  5. re-annotate                               — variant_plans.py on the full library
  6. arrange MCQ options                       — normalize_options.py (deterministic, free,
     idempotent; option text and is_correct untouched — order, labels and guide keys only)
  7. DETERMINISTIC CERTIFICATION               — compile, registry/first-visit/synthesis
     checks, register scan, MCQ arrangement gate, serve sweep
  8. report                                    — genon/out/library_reports/ch_NN_<ts>.md
     (the Cowork session presents this at the human gate; approval is the
     founder's, never this script's)

    --certify-only   skip generations; run steps 2-8 on whatever library exists
    --redo           regenerate metered artefacts even if they are already on disk

RESUMABLE (2026-08-07): steps 1 and 4 SKIP any canonical already installed, so a build
that failed after paying for a file resumes instead of buying it again. --redo overrides.
"""
from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent            # genon/
REPO = HERE.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(HERE))

from aruvi_core.genon import compile_stream, serve_plan            # noqa: E402
from aruvi_core.genon.carriers import (                           # noqa: E402
    has_section_axis, raw_item_list, serve_granularity,
)
from aruvi_core.genon.serve import (                               # noqa: E402
    _norm, _unit_anchors, authored_registry, is_synthesis_unit, section_registry,
    unit_range,
)
from aruvi_core.assessment_norm import mistyped_tag                # noqa: E402
import variant_plans as vp_mod                                     # noqa: E402
from api import config                                             # noqa: E402
from register_scan import scan_plan, scanned_fields                # noqa: E402
import stem_deixis                                                 # noqa: E402  (C5 check 12)
from summary_sections import (                                     # noqa: E402
    NONE as SUMMARY_UNREADABLE, STRUCTURED as SUMMARY_STRUCTURED,
    closing_anchors, reconcile as reconcile_sections, section_waivers,
    summary_sections,
)

# Every `question_type` the corpus actually uses — a census over all saved plans and the
# backup corpus, 2026-08-12 (ARV-D-123). This is the union across ELEVEN stages, not one
# stage's closed set, and that is the point: the gate below quarantines, so it must never
# fire on a legal value. What it catches is a value that is not an assessment type in any
# constitution — which is what a type copied out of another enumeration always is.
# A stage that records its own set at P2 should be read in preference; until then this is
# the strongest statement that cannot be wrong.
KNOWN_ITEM_TYPES = {
    "MCQ", "SCR", "ECR", "NUM", "OPEN_TASK", "SOURCE_INTERPRETATION",
    "FILL_IN", "MATCH", "TRUE_FALSE", "ORAL_PROMPT", "WRITING_TASK", "PROJECT",
    "EXTRACT_ANALYSIS",
}

# The item's STEM, under whichever name its constitution gives it (ARV-D-127, S11 · C1).
# `question_text` is what SS, TWAU, science and mathematics·SECONDARY emit; **english's
# assessment constitution names it `item_stem`** at all three stages, and reading only the
# first quarantined a clean english library on the day the shape gate landed.
#
# ★ `prompt` ADDED 2026-08-13, AND THE COMMENT IT REPLACES WAS FACTUALLY WRONG. It read:
# "`prompt` appears 471 times in the PROTOTYPE-era maths corpus and in no canonical, so it
# is recorded here and deliberately not read: a gate should tolerate the shapes that exist,
# not the shapes that might." It is the stem field of **mathematics·preparatory and
# mathematics·middle** — 123 items across every canonical on disk — so the gate failed 30-33
# items per file and QUARANTINED the whole maths·iii ch 5 library, three paid canonicals,
# on a routine `--certify-only`. The 2026-08-12 census that produced the tuple cannot have
# read the maths family; the one that produced this line did, and is reproducible:
#
#   question_text 1772 (SS · TWAU · science · maths·ix) · prompt 123 (maths·iii, maths·vii)
#   · item_stem 96 (english, all three stages)
#
# The lesson is the one the old comment was reaching for and got backwards: a gate must
# tolerate the shapes that EXIST, and "exists" is settled by a census that covers every
# stage — not by one that stops at the subjects you happened to open. Note maths is diverse
# WITHIN itself (secondary parts company with its own middle and preparatory), which is why
# a subject-level check would have missed it too.
_STEM_FIELDS = ("question_text", "item_stem", "prompt")


def item_stem(it):
    """(field_name, value) for this item's stem — so a report can name the right field."""
    for f in _STEM_FIELDS:
        if f in it:
            return f, it.get(f)
    return _STEM_FIELDS[0], None
from normalize_options import normalize_library, unarranged        # noqa: E402

from aruvi_core.grades import stage_for                            # noqa: E402

KLASS = {"iii": "III", "iv": "IV", "v": "V", "vi": "VI", "vii": "VII",
         "viii": "VIII", "ix": "IX", "x": "X"}

# ── EXACT ITEM COUNTS PER COMPETENCY WEIGHT (2026-08-02) ─────────────────────────
# Added at SS·secondary C4 / ARV-D-019: the p07 variant shipped 17 items where its
# own constitution mandates 18 (a Substantive competency lost its third slot), and
# the eight structural checks could not see it — the miss surfaced only because a
# Cowork session counted by hand, which will not happen across 926 authoring runs.
#
# ADVISORY, NOT A GATE (founder ruling the same day): slot misses are generation
# variance, priced below a ~Rs 37 regeneration, and ch 3's p07 is accepted as
# authored. So this reports and never sets ok=False — the point is to turn a silent
# miss into a visible rate. Promote it to a gate by passing the flag through note()
# instead of lines.append(), once the founder prices the rate.
#
# One row per subject·stage, filled from that stage's assessment constitution as it
# is amended at its own P2. A stage with no row falls back to the library's own
# modal count per weight label, which still catches a variant disagreeing with its
# siblings (exactly the p07 shape) without knowing any constitution.
EXACT_ITEM_COUNTS = {
    # SS·secondary assessment v1.6 Rule 4 — Central 1 MCQ + 1 SCR + 1 SOURCE_INTERPRETATION
    # + 1 ECR + 1 Open Task · Substantive 1 MCQ + 1 SCR + 1 (SI or ECR) · Present 1 MCQ + 1 SCR.
    ("social_sciences", "secondary"): {"Central": 5, "Substantive": 3, "Present": 2},
}

# ── PER-STAGE ITEM MINIMUMS (2026-08-07, ARV-D-065 at S6·C3) ─────────────────────
# A second advisory, for stages whose assessment is grouped by PROGRESSION STAGE rather
# than by competency weight. It exists because the weight-based check above could not see
# this defect at all: it compares each file to the library's own MODAL count, and ch 6's
# four canonicals came in at 13/15/14/12 items against a mandated 15 — they disagreed with
# the CONSTITUTION, not with each other, so the modal fallback read them as consistent.
#
# Keyed by stage POSITION, which is what assessment v1.5 Rule 4 prescribes:
#   first  = 2 MCQ · middle = 2 MCQ + 1 SCR · final = 2 MCQ + 1 ECR + 1 Open Task
# Types are checked too — an ECR in a middle stage is a type intrusion, and one of the
# three breaches on ch 6's top canonical was exactly that.
STAGE_ITEM_MINIMUMS = {
    ("science", "middle"): {
        "first":  {"MCQ": 2},
        "middle": {"MCQ": 2, "SCR": 1},
        "final":  {"MCQ": 2, "ECR": 1, "OPEN_TASK": 1},
        "types":  {"first": {"MCQ"}, "middle": {"MCQ", "SCR"},
                   "final": {"MCQ", "ECR", "OPEN_TASK"}},
    },
}


def stage_item_report(subject, grade, lib):
    """ADVISORY per-stage item census against the constitution's own minimums.

    Reports and never gates — same founder ruling as the weight-based check (ARV-D-019):
    a slot miss is generation variance priced below a regeneration, and a hand back-fill is
    forbidden by testing.md §7. The point is to turn a silent miss into a RATE across 154
    authoring runs, which is what C3 had to find by hand."""
    spec = STAGE_ITEM_MINIMUMS.get((subject, stage_for(grade)))
    if not spec:
        return []
    out = ["", "per-stage item minimums — ADVISORY, does not gate; basis: "
           f"{subject}·{stage_for(grade)} assessment constitution Rule 4"]
    for name, s in lib:
        raw = json.loads((lib_dir_of(subject, grade) / name).read_text())
        items = raw_item_list(raw.get("result", raw))
        stages = sorted({i.get("progression_stage") for i in items
                         if i.get("progression_stage") is not None})
        if not stages:
            out.append(f"      {name}: no progression_stage on any item — check skipped")
            continue
        top = max(stages)
        short = []
        for s_no in stages:
            pos = "first" if s_no == 1 else ("final" if s_no == top else "middle")
            got = {}
            for i in items:
                if i.get("progression_stage") == s_no:
                    got[i.get("question_type")] = got.get(i.get("question_type"), 0) + 1
            for t, n in spec[pos].items():
                if got.get(t, 0) < n:
                    short.append(f"S{s_no}({pos[0]}) {t} {got.get(t, 0)}<{n}")
            for t in got:
                if t not in spec["types"][pos]:
                    short.append(f"S{s_no}({pos[0]}) {t} is not a {pos}-stage type")
        out.append(f"      {name}: {len(items)} items, "
                   + (f"{len(short)} shortfall(s) — " + "; ".join(short) if short
                      else "all stages meet their minimums"))
    return out


def run(label, argv):
    print(f"\n== {label} ==")
    r = subprocess.run([sys.executable] + argv, cwd=REPO)
    if r.returncode != 0:
        raise SystemExit(f"STOP: {label} failed (exit {r.returncode}); "
                         "fix and re-run — completed steps are idempotent.")


def lib_dir_of(subject, grade):
    # ★ PATH FIX 2026-10-02. The served library moved twice after this was written: under
    # data/cloud/content/ (2026-08-23) and into an edition-year folder (2026-08-27).
    # generate_canonical.py already writes to DATA_DIR/saved_plans/<s>/<g>/<LP_YEAR>; read
    # from the same api.config values so authoring, certification and serving agree.
    return Path(config.DATA_DIR) / "saved_plans" / subject / grade / config.LP_YEAR


def item_census(raw):
    """{c_code: (weight_label, n_items)} from a saved plan's assessment_items,
    plus the set of non-Incidental competencies its handoff says must be assessed.
    Weight-label spelling is the constitution's own (Central/Substantive/Present);
    a competency the handoff carries but the assessment never touches comes back
    with n = 0, which is the loudest version of the same defect."""
    r = raw.get("result", raw)
    census, order = {}, []
    for it in raw_item_list(r):          # carrier seam — never read the key directly
        code = ((it.get("competency") or {}).get("c_code") or "").strip()
        if not code:
            continue
        if code not in census:
            census[code] = [str(it.get("weight_label") or "").strip(), 0]
            order.append(code)
        census[code][1] += 1
    handoff = r.get("coverage_handoff")
    if isinstance(handoff, dict):
        for code, v in handoff.items():
            if not isinstance(v, dict):
                continue
            if str(v.get("weight", "")).strip() in ("0", "Incidental", "incidental"):
                continue
            if code not in census:
                census[code] = ["(from handoff)", 0]
                order.append(code)
    return [(c, census[c][0], census[c][1]) for c in order]


def load_library(subject, grade, ch, lines, fails):
    lib_dir = lib_dir_of(subject, grade)
    paths = [lib_dir / f"ch_{ch:02d}_canonical.json"]
    paths += sorted(lib_dir.glob(f"ch_{ch:02d}_canonical_p*.json"))
    streams = []
    for p in paths:
        if not p.is_file():
            continue
        try:
            streams.append((p.name, compile_stream(json.loads(p.read_text()))))
        except Exception as e:                     # noqa: BLE001
            lines.append(f"FAIL  {p.name}: does not compile — {e}")
            fails.add(p.name)
    streams.sort(key=lambda t: -len(t[1]["units"]))
    return streams


def certify(subject, grade, ch, row):
    lines = []
    fails = set()                       # file names with STRUCTURAL failures →
    ok = True                           # quarantined (founder doctrine 2026-08-01:
                                        # good files stay live; only failed ones move)

    def note(flag, msg, fname=None):
        nonlocal ok
        ok = ok and flag
        lines.append(("PASS  " if flag else "FAIL  ") + msg)
        if not flag and fname:
            fails.add(fname)

    lib = load_library(subject, grade, ch, lines, fails)
    if not lib:
        raise SystemExit("STOP: no library on disk to certify.")
    top_name, top = lib[0]
    reg = section_registry(top)
    ridx = {_norm(a): i for i, a in enumerate(reg)}
    vp = row["canonical_plan"]

    # ── THE SYNTHESIS-ONLY TAIL (2026-08-14, S11 · ARV-D-157) ────────────────────
    # `section_registry` skips the synthesis unit, and it MUST — serve's `unit_range`
    # depends on that unit being rangeless (§0.4 Case 1, the S7 fix). But on a stage
    # whose anchors are MEDIATED, the standard's closing unit may be the only place a
    # real cell is taught: a short english chapter folds `writing` and `beyond_text`
    # into the synthesis unit, so neither ever enters the registry.
    #
    # Checks 3-5 then measure the compacts against a registry MISSING those cells, and
    # the result inverts the test. A compact that teaches `beyond_text` anchors a cell
    # the registry does not contain and FAILS; a compact that silently DROPS it passes.
    # Wave 2 quarantined english·ix ch 2's 4-period compact — which covers all six
    # spines — while certifying ch 4's and ch 10's, which drop the chapter's only
    # Writing Task. Certification was rewarding the incomplete plan.
    #
    # The fix is scoped to authoring + certification and does not touch serve. It lives in
    # ONE function — `serve.authored_registry` — which BOTH this check and
    # `variant_plans.standard_registry` (the brief writer) now call, because the bug was not
    # that either was wrong alone: it was that the brief and the judge could drift apart.
    # `section_registry` itself is unchanged, so no serve arithmetic moves.
    reg_ext = authored_registry(top)
    synth_only = reg_ext[len(reg):]
    ridx_ext = {_norm(a): i for i, a in enumerate(reg_ext)}
    if synth_only:
        lines.append(f"      registry tail: {len(synth_only)} cell(s) taught ONLY in the "
                     f"standard's synthesis unit are legal anchors for a compact "
                     f"(ARV-D-157): " + "; ".join(synth_only))

    note(len(lib) == len(vp["counts"]),
         f"library complete: {[n for n, _ in lib]} vs plan {vp['counts']}")

    # ── WHICH CHECKS APPLY (2026-08-07, S6) ──────────────────────────────────────
    # Checks 3, 4 and 5 (anchors verbatim · first-visit order · coverage reaches the
    # final registry section) are all SECTION arithmetic. A PLAN-granularity stage has
    # no section axis at all — its units belong to a cognitive progression arc derived
    # fresh per canonical — so running them would not be a stricter test, it would be a
    # meaningless one against an empty registry. They report N/A and the stage is held
    # to the checks that do bear on it: library completeness, compilation, the synthesis
    # gate (via the boolean carrier), the register, MCQ arrangement, and a serve sweep
    # whose legal modes are narrower. Spec: docs/science_middle_stage_serve.md §4.7.
    granularity = serve_granularity(top["meta"].get("subject"), top["meta"].get("grade"))
    section_axis = has_section_axis(top["meta"].get("subject"), top["meta"].get("grade"))
    lines.append(f"serve granularity: {granularity}  ·  section axis: {section_axis}")
    if not section_axis:
        lines.append("N/A   anchors verbatim / first-visit order / registry coverage "
                     "— this stage has no section axis (checks 3-5 do not apply)")

    # ── REGISTRY ↔ CHAPTER SUMMARY (2026-08-13, batch-runbook trap 5) ────────────
    # THE ONE CHECK THAT LOOKS OUTSIDE THE LIBRARY, and it exists because every other
    # section check is built FROM the top canonical's registry and therefore cannot see
    # what the top canonical omitted. Checks 3-5 measure the compacts against that
    # registry; if the standard never named a section, the registry never had it and all
    # three agree happily. The runbook's instruction was "compare the registry against
    # the chapter summary's section list by eye until that check exists".
    #
    # It found science·ix ch 8 — the S3 pilot, certified ALL PASS — omitting **8.5 Atomic
    # Number**, and TWAU iii ch 1 and ch 9 omitting their closing `Let us reflect`.
    #
    # ASYMMETRIC, like the handoff/anchor check below it. A summary section no unit
    # anchors GATES: the chapter is not taught at any period count. A registry entry the
    # summary does not name is ADVISORY: SS quite properly names an unlabelled opening
    # ("Introduction to the Atmosphere"), and merges and renames are legitimate.
    #
    # It does NOT quarantine — the register-gate precedent. The library serves perfectly
    # well; what is wrong is what it teaches. Unlike a register breach it is NOT
    # repairable in place: the remedy is a regeneration of the top (and therefore the
    # compacts, whose briefs are built from its registry) or an accepted-omission ruling
    # at the human gate. That is a founder call, which is why this reports a failure
    # rather than moving files.
    #
    # It gates only where the summary DECLARES its sections — JSON `sections[]` /
    # `main_sections[]` (maths, english, TWAU) and numbered headings (science). Social
    # science summaries are prose that names its sections differently in every chapter,
    # so there it reports an advisory shortlist instead: measured over the corpus, every
    # extractor tried recovered real sections AND sub-topics ("Waterfall", "Deltas",
    # "GLOFs" under Running Water), and a gate that fails good chapters gets switched off
    # (runbook trap 4). The real fix is upstream — a section list in the SS summary
    # prompt's output. Reasoning and measurements: genon/summary_sections.py.
    if section_axis:
        secs, kind = summary_sections(subject, grade, ch)
        if kind == SUMMARY_UNREADABLE:
            lines.append("      ADVISORY: no section list readable from the chapter "
                         "summary — registry <-> summary NOT reconciled for this chapter")
        else:
            # The standard's SYNTHESIS unit is not in the registry (it must never enter
            # first-visit arithmetic) but on every mediated-anchor stage it anchors a real
            # section — "Let us reflect", "S1 / … / S8" — and teaches it. Passing its
            # anchors in is what stops the check reporting a chapter's closing section as
            # untaught; see summary_sections.reconcile.
            # `top` is the compiled stream; the raw artefact carries the coverage_handoff,
            # which on a token-carrying stage is the synthesis unit's only voice (2026-08-18).
            top_raw = json.loads((lib_dir_of(subject, grade) / top_name).read_text())
            missing, closing, extra = reconcile_sections(
                reg, secs, closing_anchors(top, top_raw))
            # DECLARED WAIVERS (2026-08-17): an accepted-omission ruling at the human gate
            # is recorded in summary_sections.SECTION_WAIVERS and read here, so a decided
            # question stops re-raising as a FAIL while any NEW omission still gates.
            waivers = section_waivers(subject, grade, ch)
            waived = [m for m in missing if m in waivers]
            missing = [m for m in missing if m not in waivers]
            for m in waived:
                lines.append(f"      WAIVED {top_name}: {m} — {waivers[m]}")
            shape = f"{len(secs)} summary section(s) vs {len(reg)} registry entr(ies)"
            if closing:
                lines.append(
                    f"      registry <-> summary: {len(closing)} section(s) reached only "
                    f"through the standard's closing synthesis unit (taught, but outside "
                    f"the registry — read it at the human gate): " + "; ".join(closing))
            if kind == SUMMARY_STRUCTURED:
                note(not missing,
                     f"{top_name}: every section the chapter summary carries is anchored "
                     f"by some unit ({shape})"
                     + (" — UNNAMED BY ANY UNIT: " + "; ".join(missing) if missing else ""))
            elif missing:
                lines.append(
                    f"      ADVISORY {top_name}: {len(missing)} prose lead(s) in the "
                    f"summary match no registry entry ({shape}) — rule on each by eye, "
                    f"a sub-topic is not a section: " + "; ".join(missing))
            else:
                lines.append(f"      registry <-> summary: no unmatched prose lead ({shape})")
            if extra:
                lines.append(
                    f"      ADVISORY {top_name}: {len(extra)} registry entr(ies) the "
                    f"summary does not name (an unlabelled opening, a merge or a rename "
                    f"— never a failure): " + "; ".join(extra[:6])
                    + (" …" if len(extra) > 6 else ""))

    for name, s in lib:
        is_top = name == top_name
        # ── THE SYNTHESIS-ANCHOR GATE (v2.0 §0.3, replaces the closing-span
        # check): the STANDARD canonical's last unit anchors exactly the reserved
        # token `synthesis`; no other unit — and no compact — may carry it. The
        # old solver-mandated spans are gone (ARV-D-025: a mandated closing
        # synthesis in a compact imported foreign priors — the jumpy Xth unit).
        syn_units = [u["unit"] for u in s["units"] if is_synthesis_unit(u)]
        if is_top:
            note(syn_units == [s["units"][-1]["unit"]],
                 f"{name}: standard closes with the mandated `synthesis` unit "
                 f"(and carries the token nowhere else)", name)
        else:
            note(not syn_units,
                 f"{name}: the `synthesis` token is reserved to the standard "
                 f"canonical", name)
        if not section_axis:
            continue                              # checks 3-5 are section arithmetic
        body = [u for u in s["units"] if not is_synthesis_unit(u)]
        # Measured against the EXTENDED registry (see the synthesis-only tail above), so a
        # compact teaching a cell the standard reached only in its closing unit is legal.
        rr = [unit_range(u, ridx_ext) for u in body]
        note(all(r is not None for r in rr),
             f"{name}: every anchor verbatim in the top registry", name)
        okorder, seen_hi = True, -1
        for r in rr:
            if r is None:
                okorder = False
                continue
            if r[1] > seen_hi:                    # this unit advances the frontier
                if r[0] > seen_hi + 1:            # …but skipped a section
                    okorder = False
                seen_hi = r[1]
        note(okorder, f"{name}: first-visit order follows the registry", name)
        # `>=`, not `==`: the TOP's body stops at the last BODY section by construction
        # (the tail is taught in the synthesis unit it excludes), while a compact may run
        # past it into the tail. Both are complete; only the compact reaches further.
        note(seen_hi >= len(reg) - 1,
             f"{name}: coverage reaches the final registry section"
             + (" before the synthesis unit" if is_top else ""), name)
        # ── REPORTED, NEVER GATED: cells this canonical does not teach at all ──────
        # The three checks above are ORDER and VALIDITY tests; none of them notices a
        # cell skipped INSIDE a unit's (lo, hi) span. That is how ch 4's and ch 10's
        # compacts certified while dropping the chapter's only Writing Task. Naming the
        # omission is the founder's to rule on — a compact legitimately teaches less —
        # but it must not be invisible, which is what it was until now.
        if not is_top:
            taught = {_norm(a) for u in s["units"] for a in _unit_anchors(u)}
            dropped = [a for a in reg_ext if _norm(a) not in taught]
            if dropped:
                lines.append(f"      OMITS {len(dropped)} cell(s) the standard teaches "
                             f"— {name}: " + "; ".join(dropped)
                             + "  (reported, not gated — rule at the human gate)")

    # ── HANDOFF ↔ ANCHOR AGREEMENT (2026-08-08, S4 · maths·IX ch 4) ───────────────
    # Added because nothing compared the two objects that BETWEEN them decide where an
    # assessment item lands. Checks 3-5 above test a unit's `section_anchor` against the
    # REGISTRY; nothing tested it against the `coverage_handoff`, which on a derived-anchor
    # stage is the item's only route to a unit. maths·IX ch 4's top canonical passed every
    # existing check while units 10-12 wore the `4.1` label and section 1's handoff row
    # listed only unit 1.
    #
    # THE TWO DIRECTIONS ARE NOT SYMMETRIC, and this is the whole design of the check.
    # Measured on that library before writing it (founder ruling 2026-08-08):
    #
    #   handoff lists a unit that does NOT anchor its section  ->  GATE. The item is routed
    #       to a sitting that never taught its section. There is no reading on which that is
    #       correct, and the item cannot be trusted.
    #
    #   a unit anchors a section the handoff does not route through  ->  ADVISORY, never a
    #       gate. The obvious "fix" — extend period_numbers to every unit bearing the label —
    #       was tried and LOSES QUESTIONS: an item anchors at its section's LAST unit, so
    #       extending sec#1 from [1] to [1,10,11,12] moved the Introduction item to unit 12
    #       and it vanished at X=12 (12 items -> 11). p11, which does list them, drops its
    #       Introduction item at X=9 and X=10 for exactly this reason. The shorter list is
    #       the truthful one: section 4.1 completes at unit 1, and consolidation units that
    #       revisit it do not re-open it.
    #
    # So the advisory is the honest signal: a unit wearing a section's label without teaching
    # it. Its real cause is architectural — the registry offers no token for a CONSOLIDATION
    # unit (`synthesis` is reserved to one closing unit), so a chapter with many more units
    # than sections has no legal label for the rest and the model picks the least-wrong
    # registry entry. Read the count; do not "repair" it into a gate pass.
    if section_axis:
        for name, s in lib:
            raw = json.loads((lib_dir_of(subject, grade) / name).read_text())
            handoff = (raw.get("result") or {}).get("coverage_handoff")
            if not isinstance(handoff, list) or not handoff:
                continue                     # dict-shaped handoffs are keyed by competency
            anchors_of = {}                  # unit -> its normalised anchor tokens
            for u in s["units"]:
                anchors_of[u["unit"]] = ({"synthesis"} if is_synthesis_unit(u)
                                         else set(_norm(a) for a in _unit_anchors(u)))
            mis, unrouted, missing_row, via_synth = [], [], [], []
            routed = set()
            for e in handoff:
                if not isinstance(e, dict):
                    continue
                ref = _norm(e.get("section_ref") or e.get("section_label")
                            or e.get("section_title") or "")
                pns = [int(p) for p in (e.get("period_numbers") or []) if p is not None]
                routed |= set(pns)
                for pn in pns:
                    have = anchors_of.get(pn)
                    if have is None:
                        mis.append(f"U{pn} (no such unit) <- {ref or '?'}")
                    elif have == {"synthesis"}:
                        # SYNTHESIS CARVE-OUT (founder, 2026-08-18 · maths·IX W1 triage).
                        # The SAME exception C5 check 11 already carries, applied to the
                        # other half of the reconciliation. A wrap-up section is taught in
                        # the closing synthesis unit and nowhere else (maths ix ch 3's
                        # "3.7 Conclusion": U17's last band poses √(-1) and names the
                        # section). That unit is anchored by the reserved token `synthesis`
                        # by design (architecture v2.0 §0.3), so the substring test can
                        # never match a section ref against it — routing such a row
                        # ANYWHERE fails: at a lettered unit because it does not teach the
                        # section, at the synthesis unit because it wears no section label.
                        # A check no artefact can satisfy is not a check. Reported, never
                        # failed — exactly as check 11 reports "reached only through the
                        # standard's closing synthesis unit".
                        via_synth.append(f"U{pn} <- {ref or '?'}")
                    elif ref and not any(ref in a or a in ref for a in have):
                        mis.append(f"U{pn} anchors {sorted(have)} but is routed as {ref!r}")
            note(not mis,
                 f"{name}: every handoff row routes to a unit that anchors its section"
                 + (f" — {len(mis)} mis-route(s): " + "; ".join(mis[:4]) if mis else ""),
                 name)
            if via_synth:
                lines.append(
                    f"      {len(via_synth)} handoff row(s) route to the closing synthesis "
                    f"unit, which carries no section label by design — taught there and "
                    f"reported, not failed: " + "; ".join(via_synth[:4]))
            # ADVISORY (never gates) — see the reasoning block above.
            for u in s["units"]:
                un = u["unit"]
                if un not in routed and not is_synthesis_unit(u):
                    unrouted.append(f"U{un}={'/'.join(sorted(anchors_of[un])) or '?'}")
            groups = len([e for e in handoff if isinstance(e, dict)])
            lines.append(
                f"      handoff/anchor: {groups} handoff group(s) for {len(s['units'])} "
                f"unit(s) — at most {groups} unit(s) can carry an item, so "
                f"{max(0, len(s['units']) - groups)} without one is arithmetic, not a defect")
            if unrouted:
                lines.append(
                    f"      ADVISORY {name}: {len(unrouted)} unit(s) wear a section label the "
                    f"handoff does not route items through: {', '.join(unrouted[:6])}"
                    + (" …" if len(unrouted) > 6 else "")
                    + "  (do NOT extend period_numbers to fix this — it moves the item to a "
                      "later unit and loses it on short serves)")

    # ── REGISTER GATE (2026-08-02) ────────────────────────────────────────────────
    # The register is stated as a prohibition in every constitution and the ch 3 pilot
    # proved a prohibition is not enforcement (testing.md C3: 9 breaches under v1.10,
    # which bans them in terms). Detection lives here, in code, where it is not a matter
    # of the model's attention. genon/repair_register.py is the intended response.
    #
    # A register hit FAILS certification but does NOT quarantine (founder call, 2026-08-02):
    # quarantine exists for files whose STRUCTURE breaks serving. A register breach makes
    # serving WRONG, not impossible, and the file is repairable in place — pulling it out of
    # the library would lose a good plan over a clause.
    for name, s_ in lib:
        raw = json.loads((lib_dir_of(subject, grade) / name).read_text())
        bans = [h for h in scan_plan(raw) if h["ban"]]
        seen = scanned_fields(raw)
        # A plan whose band array we cannot read would report "clean" having been SKIPPED.
        # The scanner knows time_bands[] and phases[] (with activity/description); anything
        # else is a new shape and must fail loudly rather than pass silently.
        bands_read = seen.get("time_bands", 0) + seen.get("phases", 0)
        note(bands_read > 0,
             f"{name}: register scan reached the band text ({bands_read} band(s) read: "
             f"{ {k: v for k, v in seen.items()} })", name)
        note(not bans, f"{name}: register clean ({len(bans)} ban hit(s))")
        # ARTEFACT ADVISORIES ARE PRINTED (2026-08-12, S11 · C8). The scanner has carried an
        # `artefact` family since S5 and a scoped pair since S11's C7, and every one of them is
        # ADVISORY — the rule they detect lives in the platform brief, not in a constitution, so
        # they must not fail a build. But advisories were never written to the report, which
        # meant the detector for the defect this stage is regenerating to remove (ARV-D-136)
        # would have fired into a void. A gate that cannot fail must at least be legible.
        arte = [h for h in scan_plan(raw) if h["family"] == "artefact" and not h["ban"]]
        if arte:
            lines.append(f"      ADVISORY {name}: {len(arte)} artefact-dependency hit(s) — a "
                         "unit reaching for something a PREVIOUS sitting produced. Read them: "
                         "the brief forbids it, certification cannot.")
            for h in arte[:6]:
                lines.append(f"        U{h['unit']} {h['field']}: {h['match']!r} — {h['excerpt']}")
        for h in bans[:8]:
            lines.append(f"      U{h['unit']} {h['field']} [{h['family']}] {h['excerpt']}")
        if bans:
            lines.append("      -> declare the fixes in genon/repair_register.py and re-run "
                         "--certify-only; do NOT hand-edit the artefact")

    # ── DECLARED-TYPE GATE (2026-08-11, ARV-D-113) ───────────────────────────────
    # A stimulus may DECLARE its type with a tag (`number_line:`). The whole value of a
    # declared type is that it removes guessing — which only holds if a tag that fails its own
    # contract is LOUD. It was not: maths III ch 5's Q-C-4 tagged a shape pattern, failed the
    # then-numeric tick test, fell through to TABLE, and printed the literal token
    # "number_line: line" to the teacher on screen and in the PDF. Nothing caught it. C3's
    # rule-by-rule pass read the item and moved on, because "tag present, no SVG" is what a
    # human checks; the mismatch between the declared type and the resolved one is exactly the
    # sort of thing a machine should be holding.
    #
    # Reported per item, not aggregated: a mis-tag is a property of one stimulus and the fix is
    # to that stimulus. The typing itself lives in `assessment_norm.mistyped_tag`, beside the
    # code it checks, so this gate and the renderer can never disagree about what a valid tag is.
    for name, s_ in lib:
        raw = json.loads((lib_dir_of(subject, grade) / name).read_text())
        bad = []
        for it in raw_item_list(raw.get("result", raw)):
            why = mistyped_tag(it.get("visual_stimulus"))
            if why:
                bad.append((it.get("id") or "?", why))
        note(not bad, f"{name}: every declared stimulus type resolves ({len(bad)} mis-tagged)",
             name if bad else None)
        for iid, why in bad[:6]:
            lines.append(f"      {iid}: {why}")
        if bad:
            lines.append("      -> either correct the stimulus to satisfy the tag it declares, "
                         "or drop the tag; a tagged stimulus that fails its contract renders as "
                         "prose and loses the representation it asked for")

    # ── C5 CHECK 12 · THE STEM POINTS AT A STIMULUS THAT IS NOT THERE ────────────
    # (2026-08-19, ARV-D-188 — founder-found by reading a served plan, not by a report.)
    #
    # mathematics III ch 5 Q-A-1: *"On the dot grid below, draw a simple rangoli design…"*
    # with `visual_stimulus: ""`. There is no dot grid. It certified ALL PASS, and so did
    # sixty others across english and mathematics.
    #
    # WHY EVERY EXISTING CHECK IS BLIND TO IT, and the reason is structural rather than an
    # oversight. The gate directly above validates what a model DECLARES — and an EMPTY
    # stimulus declares nothing, so `mistyped_tag` returns None on the first line. Every
    # other stimulus check reads the stimulus field alone. Nothing anywhere compares the
    # stem's LANGUAGE against the field beside it, which is the only place this defect
    # exists. Same shape as check 11: two fields certification reads separately and never
    # reconciles.
    #
    # ASYMMETRIC, like check 11. A promised FIGURE gates — the item cannot be answered at
    # any period count. A promised WORKSPACE ("draw in the box below") is ADVISORY: nothing
    # is missing in the content sense, the item wants a drawing area, and in 88% of measured
    # cases its own `exercise` block already names the textbook page that has one.
    #
    # It GATES ON MATHEMATICS ONLY, and `stem_deixis._GATES` carries the reasoning: english
    # stems talk about text that is itself full of the word ("the child imagines people
    # below staring up"), and where the referent is a real list it lives in a field that
    # varies by spine. A gate that fails a correct poem item is switched off in a week
    # (runbook trap 4), so english returns an advisory shortlist ruled on at C7 — the same
    # treatment social_sciences gets from check 11, for the same reason.
    for name, s_ in lib:
        raw = json.loads((lib_dir_of(subject, grade) / name).read_text())
        hits = stem_deixis.scan_plan(raw)
        figs = [h for h in hits if h["kind"] == stem_deixis.FIGURE]
        work = [h for h in hits if h["kind"] == stem_deixis.WORKSPACE]
        if stem_deixis.gates_for(subject):
            note(not figs, f"{name}: no stem points at a figure the item does not carry "
                           f"({len(figs)} does)", name if figs else None)
        elif figs:
            lines.append(f"      ADVISORY {name}: {len(figs)} stem(s) point at absent "
                         f"material — english stems quote their own text, so this is read, "
                         f"not failed")
        for h in (figs + work)[:8]:
            lines.append(f"      {h['id']} [{h['kind']}] {h['phrase']!r} — {h['stem'][:88]}")
        if work:
            lines.append(f"      ADVISORY {name}: {len(work)} workspace pointer(s) — the item "
                         f"wants a drawing area, not content; repoint at the `exercise` page "
                         f"(genon/repair_c3.py ARV-D-188) or supply one")

    # ── ITEM-SHAPE GATES (2026-08-12, ARV-D-123 — found at S5's C3) ──────────────
    # Two checks, both free, both closing the same hole: NOTHING IN THE PIPELINE READS AN
    # ITEM'S OWN FIELDS. The certifier checks structure, STEP 6 checks option order, and
    # `verified` is the model's claim about itself. That is how S4 shipped a wrong answer
    # (ARV-D-084) and how S5 shipped `question_type: "HI"` with `question_text: null`
    # (ARV-D-120) — both through a green certification, both found by eye.
    #
    # (1) THE TAXONOMY IS CLOSED, SO CHECK IT. Every assessment constitution names a closed
    #     set and prohibits anything outside it. S5's breach has a cause that will recur on
    #     every stage: the type-selection rule is a TABLE whose left column is some other
    #     enumeration (TWAU's `dominant_mode`, science's mode, SS's weight tier) and whose
    #     right column is the type. A model that copies the left column emits a value that
    #     looks like data because it IS data — just the wrong column. No amount of prose
    #     stops that; a membership test does.
    #
    #     TWO CHECKS, AND ONLY THE FIRST GATES — because the gate quarantines, and a gate that
    #     quarantines must not guess. The first tests membership of `KNOWN_ITEM_TYPES`, the
    #     union of every type the corpus actually uses (census over all saved plans, 2026-08-12).
    #     Deliberately weaker than a per-subject set: it cannot tell a legal type used by the
    #     wrong stage from a legal one, but it has ZERO false positives and it catches the
    #     failure mode above exactly, because a value copied from another enumeration is never
    #     an assessment type at all. The second reports a type used only ONCE in the whole
    #     library — the "one item disagrees with every sibling" signal — as an ADVISORY.
    #
    #     A first cut derived the set from the file's own frequencies and FAILED p10 on its
    #     single legitimate ECR, quarantining a good canonical. Recorded because it is the
    #     shape of mistake this gate exists to prevent: a rare-but-legal value and an illegal
    #     one look identical to a frequency test, and only the second should ever stop a build.
    #
    # (2) AN ITEM MUST HAVE SOMETHING TO ASK. Every schema in the corpus says the same two
    #     things in opposite directions: a non-OPEN_TASK item's stem is the stem field, and
    #     an OPEN_TASK carries it EMPTY with the prompt in `task`. Both directions are
    #     checked. `null` fails both — the schemas permit "" or [], never omitted and never
    #     null — which is the half of ARV-D-120 that could not be repaired mechanically,
    #     because a missing question has to be written.
    #
    #     THE FIELD IS NOT CALLED THE SAME THING EVERYWHERE (ARV-D-127, found at S11's C1,
    #     2026-08-12). This gate landed the same morning reading `question_text` alone, on a
    #     census that missed english: its assessment constitution names the field
    #     **`item_stem`** at all three stages, so a perfectly good english library came back
    #     with "6 without" on every file and all three canonicals were quarantined — a FALSE
    #     failure, on the first stage to meet the new gate. `item_stem_field` below is the
    #     serialization tolerance the rest of the platform already practises
    #     (`carriers.period_section_codes`, `carriers.unit_approaches`): read the names the
    #     constitutions actually use, report the one this item carries, and never assume a
    #     field name is universal because four subjects share it.
    lib_types = Counter()
    parsed = {}
    for name, s_ in lib:
        raw = json.loads((lib_dir_of(subject, grade) / name).read_text())
        parsed[name] = raw
        for it in raw_item_list(raw.get("result", raw)):
            lib_types[str(it.get("question_type") or "")] += 1

    for name, s_ in lib:
        raw = parsed[name]
        items = raw_item_list(raw.get("result", raw))

        unknown = [(it.get("id") or f"unit {it.get('period_ref')}", it.get("question_type"))
                   for it in items
                   if str(it.get("question_type") or "") not in KNOWN_ITEM_TYPES]
        note(not unknown,
             f"{name}: every question_type is a known assessment type ({len(unknown)} not)",
             name if unknown else None)
        for iid, t in unknown[:6]:
            lines.append(f"      {iid}: question_type {t!r} is not an assessment type at all")
        if unknown:
            lines.append("      -> check the assessment constitution's type-selection TABLE: "
                         "its left column is another enumeration (dominant_mode, weight tier, "
                         "CG theme) and this is usually a value copied from the wrong column")

        # ADVISORY, never a gate: a type nothing else in the library uses. Legal-but-rare and
        # illegal look the same here, so it reports and the reader decides.
        lonely = sorted({str(it.get("question_type") or "") for it in items
                         if lib_types[str(it.get("question_type") or "")] == 1})
        if lonely:
            lines.append(f"      ADVISORY {name}: {lonely} used by exactly one item in the "
                         "whole library — check it against the constitution's type table")

        nostem, badopen = [], []
        for it in items:
            qt = str(it.get("question_type") or "")
            field, stem = item_stem(it)
            ident = it.get("id") or f"unit {it.get('period_ref')}"
            if qt == "OPEN_TASK":
                if stem != "":
                    badopen.append((ident, field, stem))
            elif not (stem or "").strip():
                nostem.append((ident, qt, field, stem))
        note(not nostem,
             f"{name}: every non-OPEN_TASK item carries a stem ({len(nostem)} without)",
             name if nostem else None)
        for iid, qt, field, stem in nostem[:6]:
            lines.append(f"      {iid}: {qt} has {field} {stem!r} — "
                         "there is nothing to ask")
        note(not badopen,
             f"{name}: every OPEN_TASK carries an empty stem ({len(badopen)} not)",
             name if badopen else None)
        for iid, field, stem in badopen[:6]:
            lines.append(f"      {iid}: OPEN_TASK {field} is {str(stem)[:60]!r}, "
                         "not \"\" — the prompt belongs in `task`")

    # ── MCQ ARRANGEMENT GATE (2026-08-03, ARV-D-032) ─────────────────────────────
    # Rule 7's option arrangement is a SORT, and prose could not carry it: four constitution
    # versions and one probe took the failure rate from 5/6-on-B to 15 of 18 unarranged, with
    # the correct option at A or B on 16 of 18 and never at D. STEP 6 (normalize_options.py)
    # now does it deterministically, so this gate should ALWAYS pass — it exists to prove the
    # stage ran, not to catch the model. The rate is PRINTED by that step and nowhere stored:
    # the genon_canonical.repairs[] record was removed on 2026-08-04 (founder) because it never
    # produced the signal it was kept for. Read the printed count on a first pass only; on a
    # --certify-only re-run a 0 means nothing was left to move. Constitution sentence struck at v1.7.
    for name, _s in lib:
        left = unarranged(lib_dir_of(subject, grade) / name)
        note(not left,
             f"{name}: MCQ options in arrangement order"
             + (f" — items {left} unarranged; run STEP 6" if left else ""), name)

    # ── ASSESSMENT ITEM COUNTS — ADVISORY (2026-08-02, testing.md C4 / ARV-D-019) ──
    # See EXACT_ITEM_COUNTS above for why this reports rather than gates.
    censuses = {name: item_census(json.loads((lib_dir_of(subject, grade) / name).read_text()))
                for name, _ in lib}
    table = EXACT_ITEM_COUNTS.get((subject, stage_for(grade)))
    basis = "constitution"
    if not table:                       # no row for this stage yet — derive from the library
        seen = {}
        for cen in censuses.values():
            for _c, w, n in cen:
                seen.setdefault(w, []).append(n)
        table = {w: max(set(ns), key=ns.count) for w, ns in seen.items() if w}
        basis = "derived (modal count across this library — no constitution row yet)"
    says = "constitution says" if basis == "constitution" else "its siblings carry"
    short = 0
    lines.append("")
    lines.append(f"item counts per competency — ADVISORY, does not gate; basis: {basis}")
    lines.append(f"      expected {json.dumps(table, sort_keys=True)}")
    for name, cen in censuses.items():
        got = sum(n for _c, _w, n in cen)
        want = sum(table.get(w, n) for _c, w, n in cen)
        misses = [(c, w, n, table[w]) for c, w, n in cen
                  if w in table and n != table[w]]
        short += len(misses)
        lines.append(f"      {name}: {got} items vs {want} expected"
                     + ("" if not misses else "  <-- MISS"))
        for c, w, n, exp in misses:
            lines.append(f"          {c} ({w}) has {n}, {says} {exp}")
    if short:
        lines.append(f"      -> {short} competenc(ies) off the mandated count. Generation "
                     "variance, accepted by default (ARV-D-019); a hand back-fill is "
                     "forbidden (testing.md §7) — the only fix is regeneration, and that "
                     "is a founder call on cost, not a certification failure.")

    # The per-STAGE census, for stages whose assessment is grouped by progression stage.
    # The weight-based check above is blind to that axis (ARV-D-065).
    lines.extend(stage_item_report(subject, grade, lib))

    # ── serve sweep — the adaptation table of record (no solver projection to
    # diff against since v2.0; certification derives it from the authored
    # library directly). Per X: the fill mode/class + how many sections drop.
    floor = row["floor_periods_at_standard"]
    top_n = len(top["units"])
    dur = top["units"][0]["authored_duration_minutes"]
    streams = [s for _, s in lib]
    sweep = {}
    for x in range(max(1, floor - 2), top_n + 3):
        try:
            p = serve_plan(streams, [(dur, x)])
            g = p["genon"]
            fill = g["slot_fill"]
            if g["surrendered_periods"]:
                sweep[x] = "surrender"
            elif not fill:
                sweep[x] = "identity"
            elif fill["mode"] == "complete_rescue":
                # Case 1b (§0.4 v2.2 / e15): the upward serve would have dropped; a
                # canonical of count X-1 was served complete and closed with the
                # standard's synthesis. Named with the count it RESCUED FROM so the
                # sweep shows what the richness trade cost — read at the human gate.
                sweep[x] = f"rescue/complete (from {fill.get('rescued_from')})"
            elif fill["mode"] == "fill":
                ndrop = len(fill["uncovered_sections"])
                sweep[x] = (f"fill/{fill['fill_class']}"
                            + (f" -{ndrop}s" if ndrop else ""))
            elif fill.get("below_floor"):
                sweep[x] = "truncation -%du" % fill.get("dropped_unit_count", 0)
            else:
                sweep[x] = fill["mode"]
            if granularity == "plan":
                # CHECK 8, REDEFINED for a plan-granularity stage (spec §4.7).
                # Truncation is not a defect here — it is the honest answer BELOW the
                # lowest canonical, where no complete plan fits. What must never happen
                # is truncating INSIDE the band, or surrendering inside it: the first
                # would split a cognitive stage, the second would hand back periods the
                # step-2 density rule exists to make usable. Both indicate an
                # under-dense library, so the check is on the band, not on the mode.
                inside = floor <= x <= top_n
                note(not (inside and fill and fill["mode"] == "truncation"),
                     f"X={x}: no truncation inside [floor, top]")
                note(not (inside and g["surrendered_periods"]),
                     f"X={x}: no surrender inside [floor, top] "
                     f"(library dense enough at step 2)")
            else:
                # Case 3 must stay structurally impossible on a certified library
                # (§0.4); its appearance in the band is a certification failure.
                note(not (fill and fill["mode"] == "truncation"
                          and not fill.get("synthesis_only")),
                     f"X={x}: choice set non-empty (no defensive truncation)")
        except Exception as e:                     # noqa: BLE001
            sweep[x] = f"ERROR: {e}"
            note(False, f"serve X={x} raised: {e}")
    lines.append("")
    lines.append("serve sweep: " + json.dumps(sweep))
    return ok, lines, sweep, fails


def quarantine(subject, grade, ch, fails, lines):
    """Founder doctrine (2026-08-01): PASSING files stay live; a file with a
    structural failure is MOVED out of the served library into quarantine —
    backup/quarantine/<subject>/<grade>/ — which doubles as the fix worklist.
    If the TOP canonical fails, the whole library goes with it (the variants'
    registry has no ground without it)."""
    lib_dir = lib_dir_of(subject, grade)
    qdir = REPO / "backup" / "quarantine" / subject / grade
    top_name = f"ch_{ch:02d}_canonical.json"
    to_move = set(fails)
    if top_name in to_move:
        to_move |= {p.name for p in lib_dir.glob(f"ch_{ch:02d}_canonical_p*.json")}
        lines.append("NOTE  top canonical failed — the entire library is quarantined "
                     "with it (variants have no registry ground without the top)")
    qdir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    for name in sorted(to_move):
        src = lib_dir / name
        if src.is_file():
            dest = qdir / f"{name[:-5]}_{ts}.json"
            src.replace(dest)
            lines.append(f"QUARANTINED  {name} -> {dest.relative_to(REPO)}")
    return sorted(to_move)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    certify_only = "--certify-only" in sys.argv
    if len(args) != 3:
        raise SystemExit(__doc__)
    subject, grade, ch = args[0], args[1].lower(), int(args[2])
    klass = KLASS[grade]
    gen = str(HERE / "generate_canonical.py")
    vpn = str(HERE / "variant_plans.py")

    # STEP 0 · PRE-FLIGHT: does this subject·stage have a genon carrier? (2026-08-08, S4.)
    # This costs nothing and must stay FIRST. Without it the answer arrived at certification
    # — which runs after STEP 1 and STEP 4 — so a subject genon cannot resolve was authored
    # and PAID FOR in full, then reported as "does not compile" on every file, naming neither
    # the carrier nor the subject. testing.md P5.5 asks for this as a read; here it is as a
    # gate, because a gate cannot be forgotten.
    from aruvi_core.genon.carriers import CarrierNotImplemented, require_carrier
    try:
        require_carrier(subject, grade)
    except CarrierNotImplemented as e:
        raise SystemExit(f"STOP before spending — {e}")

    bdir = HERE / "out" / "briefs"
    bdir.mkdir(parents=True, exist_ok=True)
    # The TOP canonical gets a brief too (2026-08-02). It used to be the only artefact
    # generated without one — and the only one that breached the register nine times.
    top_bf = bdir / f"ch_{ch:02d}_top.txt"
    top_bf.write_text(vp_mod.top_brief_for(subject, klass, ch), encoding="utf-8")
    print(f"brief written: {top_bf}")

    # RESUMABILITY (2026-08-07). A metered step whose OUTPUT IS ALREADY ON DISK is
    # skipped. The steps were always idempotent in effect; they were not free to repeat,
    # and the docstring's "idempotent to re-run" quietly meant "will pay again". Found at
    # S6's C1: the top canonical generated perfectly, a stale validator failed the build
    # AFTER the model had been paid, and the only way forward was to buy the same file
    # twice. At 926 corpus runs a build that cannot resume is a standing tax on every
    # fixable failure. `--redo` forces regeneration.
    lib_dir = lib_dir_of(subject, grade)
    redo = "--redo" in sys.argv

    def skip_if_present(path, label):
        if redo or not path.is_file():
            return False
        print(f"\n== {label} == SKIPPED — already on disk: "
              f"{path.relative_to(REPO)}\n   (delete it, or pass --redo, to regenerate)")
        return True

    if not certify_only:
        top_path = lib_dir / f"ch_{ch:02d}_canonical.json"
        if not skip_if_present(top_path, "STEP 1 · top canonical (metered, Sonnet 4.6)"):
            run("STEP 1 · top canonical (metered, Sonnet 4.6)",
                [gen, "one", subject, grade, str(ch), "--brief", str(top_bf)])
    run("STEP 2 · annotate master plan", [vpn])

    briefs, vp = vp_mod.briefs_for(subject, klass, ch)
    bfiles = {}
    for k, text in briefs.items():
        bf = bdir / f"ch_{ch:02d}_p{k:02d}.txt"
        bf.write_text(text, encoding="utf-8")
        bfiles[k] = bf
        print(f"brief written: {bf}")

    # ── --top-only: stop after the standard canonical, for inspection ────────────
    # Added 2026-08-09. A re-author is the one time it is worth reading the top BEFORE
    # buying its compacts: the compacts are authored against the top's registry, so a
    # defect in the top is a defect in all three, and STEP 1 is resumable — re-running
    # without this flag skips it (skip_if_present) and goes straight to STEP 4. Everything
    # free has already run by this point, so the row is annotated and the compact briefs
    # are on disk, ready for the resume.
    if "--top-only" in sys.argv:
        print("\n== STOPPING AFTER THE STANDARD CANONICAL (--top-only) ==")
        print(f"   top:     {(lib_dir / f'ch_{ch:02d}_canonical.json').relative_to(REPO)}")
        print(f"   briefs:  {', '.join(str(b.name) for b in bfiles.values())} (written, unspent)")
        print(f"   resume:  python3 genon/build_library.py {subject} {grade} {ch}")
        print("            (STEP 1 is skipped — the file is on disk — and STEP 4 buys the "
              f"{len(bfiles)} compact(s))")
        return

    if not certify_only:
        for k, bf in bfiles.items():
            label = f"STEP 4 · {k}-period variant (metered, Sonnet 4.6)"
            if skip_if_present(lib_dir / f"ch_{ch:02d}_canonical_p{k:02d}.json", label):
                continue
            run(label, [gen, "one", subject, grade, str(ch),
                        "--variant", str(k), "--brief", str(bf)])
        run("STEP 5 · re-annotate on the full library", [vpn])

    # STEP 6 · arrange MCQ options (deterministic, free, idempotent, ALWAYS runs — including
    # under --certify-only, which is how a library authored before this stage existed gets
    # fixed for ₹0). Nothing is authored here: option text and is_correct are untouched.
    print("\n== STEP 6 · arrange MCQ options ==")
    opt_lines, opt_moved, opt_scanned = normalize_library(subject, grade, ch)
    print("\n".join(opt_lines))

    mp = json.loads((REPO / "data/cloud/content/allocation_norms/master_plan.json").read_text())
    row = next(c for c in mp["combos"][f"{subject}|{klass}"]["chapters"]
               if c["chapter"] == ch)
    ok, lines, sweep, fails = certify(subject, grade, ch, row)
    lines += [""] + opt_lines
    moved = quarantine(subject, grade, ch, fails, lines) if fails else []

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    rdir = HERE / "out" / "library_reports"
    rdir.mkdir(parents=True, exist_ok=True)
    report = rdir / f"{subject}_{grade}_ch{ch:02d}_{ts}.md"
    report.write_text(
        f"# Library certification · {subject} {klass} ch {ch} · {ts}\n\n"
        f"plan: counts {row['canonical_plan']['counts']} · "
        f"basis {row['canonical_plan']['basis']} · "
        f"registry {row['canonical_plan']['registry_sections']} sections\n\n"
        + "\n".join(lines)
        + "\n\nDETERMINISTIC CHECKS "
        + ("ALL PASS" if ok else "HAVE FAILURES — do not certify")
        + ((" Failed files are QUARANTINED under backup/quarantine/ (the fix "
            "worklist); regenerate them and re-run --certify-only.")
           if moved else "")
        + ".\nThe HUMAN GATE remains: read the borrowed seams and each closing "
          "synthesis in a Cowork session before calling this chapter certified.\n",
        encoding="utf-8")
    print(f"\n== report: {report.relative_to(REPO)} ==")
    print("deterministic checks:", "ALL PASS" if ok else "FAILURES — see report")
    for name in moved:
        print(f"QUARANTINED (not servable): {name}")
    print("Next: open a Cowork session and ask it to present this report "
          "for the human gate.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
