"""Standard LP anatomy rules (founder decisions 2026-07-09).

  1. Period.approach is populated wherever the raw plan carries an approach-like
     field (Science pedagogical_approach · Maths pedagogical_method · English
     pedagogical_methods · TWAU dominant_mode spelled out). SS and Maths-prep
     have no source field — approach stays "" (constitution follow-up).
  2. Science SECONDARY plans group by section_anchor (type "section") — the
     "Stage None" phantom group must never appear for any subject.
  3. English split-chapter plans (single section) collapse the section wrapper:
     top-level groups are spines. Multi-section legacy plans keep section->spine.
  4. The LO data is PRESERVED on the Period. (This rule used to read "LO is NEVER displayed in
     the LP"; superseded — founder, 2026-09-22, WALK-A-067: the LO DOES show in the lesson plan.
     What this file asserts is unchanged: the data is carried, for display and assessment alike.)

Run:  ARUVI_DATA_DIR=$PWD/data/cloud/content python3 tests/test_lp_standard.py
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from corpus import plan_paths, split_path, grade_dir, require_corpus  # noqa: E402

import aruvi_core.subjects.english      # noqa: F401
import aruvi_core.subjects.mathematics  # noqa: F401
import aruvi_core.subjects.science      # noqa: F401
import aruvi_core.subjects.social_sciences      # noqa: F401
import aruvi_core.subjects.the_world_around_us  # noqa: F401
from aruvi_core import subjects

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAVED = os.path.join(REPO, "data", "cloud", "content", "saved_plans")

failures = []


def check(name, cond, detail=""):
    print(("  ok   " if cond else "  FAIL ") + name + ("" if cond else f"  {detail}"))
    if not cond:
        failures.append(name)


def walk_groups(groups):
    for g in groups:
        yield g
        yield from walk_groups(g.children)


def walk_periods(groups):
    for g in walk_groups(groups):
        yield from g.periods


views = []  # (slug, grade, filename, raw_periods, lp_view)
for f in plan_paths():
    slug, grade_dir, fn = split_path(f)
    saved = json.load(open(f))
    result = saved.get("result", {})
    inner = result.get("lesson_plan", {})
    raw_periods = inner.get("lesson_plan", inner).get("periods", []) if isinstance(inner, dict) else []
    lp = subjects.get(slug).lesson_plan_to_view(
        result,   # full result — plugins unwrap; science secondary needs coverage_handoff
        grade=saved.get("grade", ""),
        chapter={"chapter_number": saved.get("chapter_number"),
                 "chapter_title": saved.get("chapter_title")})
    views.append((slug, grade_dir, fn, raw_periods, lp))

# ── 2. no phantom stage groups, science secondary sectioned ────────────────────
print("group axis:")
ghosts = [(s, g, fn, grp.label) for s, g, fn, _, lp in views
          for grp in walk_groups(lp.groups) if "None" in str(grp.label)]
check("no 'Stage None' phantom groups anywhere", not ghosts, str(ghosts[:3]))
sci_sec = [(fn, lp) for s, g, fn, _, lp in views if s == "science" and g == "ix"]
check("science secondary plans exist in corpus", bool(sci_sec))
for fn, lp in sci_sec:
    check(f"science/ix {fn[:20]}… grouped by section",
          all(grp.type == "section" for grp in lp.groups) and len(lp.groups) > 1,
          f"types={[grp.type for grp in lp.groups][:4]}")
sci_mid = next(lp for s, g, fn, _, lp in views if s == "science" and g != "ix")
check("science middle still stage-grouped",
      all(grp.type == "progression_stage" for grp in sci_mid.groups))

# ── 1. approach coverage ───────────────────────────────────────────────────────
print("approach:")
SRC = {"science": "pedagogical_approach", "mathematics": "pedagogical_method",
       "the_world_around_us": "dominant_mode"}
for s, g, fn, raw_periods, lp in views:
    vps = list(walk_periods(lp.groups))
    if s == "english":
        has_src = any(p.get("pedagogical_methods") or p.get("pedagogical_method")
                      for p in raw_periods)
    elif s == "social_sciences":
        # v2.7 (2026-07-15) emits pedagogical_approaches (list, joined by the port);
        # older SS plans carry no source field → approach stays "".
        has_src = any(p.get("pedagogical_approaches") for p in raw_periods)
    else:
        has_src = any(p.get(SRC.get(s, "—")) for p in raw_periods)
    got = sum(1 for p in vps if p.approach)
    if has_src:
        if got != len(vps):
            check(f"{s}/{g}/{fn[:18]} approach filled", False, f"{got}/{len(vps)}")
    else:
        if got:
            check(f"{s}/{g}/{fn[:18]} approach unexpectedly set", False, f"{got}")
check("approach filled wherever source exists (see any FAILs above)", True)
twau_p = next(p for s, g, fn, _, lp in views if s == "the_world_around_us"
              for p in walk_periods(lp.groups))
check("TWAU approach is spelled out (no acronym)",
      twau_p.approach not in ("O&R", "HI", "D&C", "C&E", "R&A") and bool(twau_p.approach),
      repr(twau_p.approach))

# ── 3. english singleton collapse ──────────────────────────────────────────────
print("english axis:")
for s, g, fn, raw_periods, lp in views:
    if s != "english":
        continue
    n_secs = len({p.get("section_id") for p in raw_periods})
    if n_secs == 1:
        check(f"english/{g}/{fn[:18]} spine-top (split chapter)",
              all(grp.type == "spine" for grp in lp.groups),
              f"types={[grp.type for grp in lp.groups][:3]}")
    else:
        check(f"english/{g}/{fn[:18]} keeps section nesting ({n_secs} sections)",
              all(grp.type == "section" for grp in lp.groups))

# ── 4. LO data preserved (display suppression is the renderer's job) ───────────
print("LO data carried on the Period:")
ss_p = next(p for s, g, fn, _, lp in views if s == "social_sciences"
            for p in walk_periods(lp.groups))
check("SS learning_outcomes still carried on Period (data, not display)",
      isinstance(ss_p.learning_outcomes, list))
sci_sec_lp = sci_sec[0][1]
check("science secondary LO rejoined from coverage_handoff into group meta",
      any(grp.meta.get("implied_lo") for grp in sci_sec_lp.groups))

print()
if failures:
    print(f"FAILED: {len(failures)} -> {failures[:6]}")
    sys.exit(1)
print("ALL LP-STANDARD TESTS PASSED")
