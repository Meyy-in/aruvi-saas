"""Genon: annotate master_plan.json with a per-chapter CANONICAL PLAN — v2.0 (2026-08-03).

v2.0 (architecture §0) RETIRES the reverse-deduction solver, sigma, and the mandated
closing spans. The pilot proved the mandate wrong at its root (ARV-D-025): a compact's
mandated closing synthesis imported the assumption that the BORROWING plan's class had
the lending plan's own priors for those sections — jumpiness by construction. Canonicals
are now authored FREE at counts fixed by pure arithmetic (equal dispersion over
[floor, standard], master_plan.py `canonical_periods`); the ONE surviving mandate is the
standard canonical's closing whole-chapter synthesis, `section_anchor` exactly the
reserved token `synthesis`. The serve engine picks slot X from first-exposure units
(serve.py e12, §0.4) — safety comes from the RIGHT PICK, not from a mandate on the lender.

This script's two jobs:
  * annotate — write each chapter row's `canonical_plan` {counts, provisional, basis,
    registry_sections, authored} into master_plan.json (idempotent; drops any stale
    v1.x `variant_plan`). provisional=True until the standard canonical is on disk.
  * briefs — compose the standard brief (self-containment + the synthesis-anchor
    mandate) and the compact briefs (free authoring: registry discipline + total
    coverage, NO closing mandate).

Re-run after any canonical is authored/regenerated or the floor policy changes:
    python3 genon/variant_plans.py
    python3 genon/variant_plans.py brief <subject> <CLASS> <ch>
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from aruvi_core.genon import compile_stream                      # noqa: E402
from aruvi_core.genon.serve import authored_registry              # noqa: E402
from api import config                                            # noqa: E402

MP = os.path.join(ROOT, "data/cloud/content/allocation_norms/master_plan.json")
# ★ PATH FIX 2026-10-02. Since 2026-08-27 the served library is foldered by EDITION YEAR
# (saved_plans/<subject>/<grade>/<LP_YEAR>/), and generate_canonical.py writes there via
# api.config. Read from the same place — otherwise every authored chapter looks unauthored
# and a re-annotation flips it back to provisional (and briefs_for then refuses it).
SAVED = os.path.join(config.DATA_DIR, "saved_plans")

GRADE_KEY = {"III": "iii", "IV": "iv", "V": "v", "VI": "vi", "VII": "vii",
             "VIII": "viii", "IX": "ix", "X": "x"}


def canonical_counts(a, c):
    """Equal dispersion over [floor, standard] — keep in lockstep with
    genon/master_plan.py canonical_periods() (that script can't be imported:
    it runs its workbook pass on import). Rows written by master_plan.py
    v2.0 already carry `canonical_periods`; this is the fallback."""
    a, c = int(a), int(c)
    if c >= a - 1:
        return [a]
    if a - c < 4:
        return [a, c]
    return [a, (a + c + 1) // 2, c]


def library_paths(subject, klass, chapter):
    d = os.path.join(SAVED, subject, GRADE_KEY.get(klass, klass.lower()), config.LP_YEAR)
    ch = int(chapter)
    return (os.path.join(d, f"ch_{ch:02d}_canonical.json"),
            lambda k: os.path.join(d, f"ch_{ch:02d}_canonical_p{k:02d}.json"))


def standard_registry(subject, klass, chapter):
    """The chapter's section registry from the AUTHORED standard canonical, as the BRIEF
    must see it. None when the standard is not on disk or does not compile.

    Reads `authored_registry`, not `section_registry` (ARV-D-157, 2026-08-14): the serve
    registry omits the standard's synthesis unit, so a cell taught ONLY there never reached
    the brief — and the brief's "drawn verbatim from this list" then FORBADE the compact from
    teaching it. Six english·ix floor compacts were briefed against four cells instead of six
    and dropped `writing`. The same function now feeds certification, so the two cannot
    disagree again."""
    top_path, _ = library_paths(subject, klass, chapter)
    if not os.path.isfile(top_path):
        return None
    try:
        return authored_registry(compile_stream(json.load(open(top_path))))
    except Exception as e:                           # noqa: BLE001
        # WHY THIS RECORDS RATHER THAN JUST SWALLOWING (2026-08-19, S7 · W1).
        # The bare `except` was correct — a standard that does not compile has no
        # registry, and the row must stay provisional — but it discarded the ONE fact
        # that says which of two very different situations you are in. On S7's wave 1,
        # four chapters whose standard was on disk, complete and structurally sound
        # reported "Row is provisional — author and certify the standard canonical",
        # which reads as "the file is missing" and sent the triage looking for files
        # that had been there all along. The real cause (an item anchored to no unit)
        # was three layers down and visible only by re-running compile by hand.
        # Behaviour is UNCHANGED — None still means provisional. Only the diagnosis is
        # kept, on the function, where the caller that prints the message can reach it.
        # Runbook trap 5's lesson, applied one level lower: a gate that cannot say why
        # it failed is a gate you debug twice.
        standard_registry.last_error = f"{type(e).__name__}: {e}"
        return None


# ── briefs ────────────────────────────────────────────────────────────────────

def _serving_block():
    """The serving facts every canonical must be authored against — identical
    for the standard and the compacts, because under §0.4 ANY unit that
    first-deals a section may be borrowed as another plan's closing sitting."""
    return [
        "- ITS UNITS ARE SERVED WHOLE AND IN PARTS. A teacher whose budget differs "
        "receives another plan's first X-1 units followed by ONE unit borrowed from "
        "this plan — the unit that FIRST introduces the section her class has reached. "
        "So ANY unit of this plan may be somebody's last sitting, met by a class that "
        "never had the units before it.",
        # ── REWRITTEN 2026-08-15 (ARV-D-1xx, S10 · W1) — THE BRIEF WAS THE CAUSE ─────
        # This bullet used to be three prohibitions with their reasoning attached: "it
        # names no other unit, promises nothing that follows it, and never claims the
        # chapter has been covered". A model told what not to assume writes that it is
        # not assuming it. The brief's own rationale came back as teacher-facing prose —
        # "no prior draft or homework is assumed", "without claiming coverage is
        # complete" (that one verbatim, twice) — 67 self-containment disclaimers in 2297
        # authored units, against ZERO in the 385 units of the pre-brief corpus
        # (backup/saved_plans/, measured 2026-08-15). Nothing else changed between the
        # two corpora, and the same measurement shows the brief doing the job it was
        # written for: forward references fell 88.3 → 19.2 per 1000 units.
        #
        # So the fix belongs HERE and nowhere else (founder ruling 2026-08-15: "let us
        # not touch a constitution for an issue the brief created"). Stated positively,
        # with the negative form given ONCE as its consequence rather than as three
        # separate bans to be echoed back.
        "- Therefore every unit CLOSES ON ITS OWN GROUND. Write each unit as though it "
        "were the only sitting this class receives: it stands up on the material it "
        "teaches inside its own minutes. Where continuity helps, name the CONTENT "
        "already taught — the idea, text, method or phenomenon — never a unit's "
        "position or existence.",
        # ── added 2026-08-15, same finding ───────────────────────────────────────────
        # The missing instruction, and the reason a prohibition alone could never have
        # produced it: the model was told not to DEPEND on another unit and obeyed, but
        # nothing told it not to DISCUSS the dependency. Reassuring the teacher that no
        # prior sitting is assumed tells her there is a version of her lesson in which
        # one would have been — which is the serve engine's business, never hers. 59% of
        # these land on the closing unit and 19% in the first half of the plan, so this
        # is addressed to EVERY unit, not to the synthesis.
        "- THE SERVE MODEL IS NEVER THE TEACHER'S BUSINESS. Everything above constrains "
        "how you BUILD the plan; none of it is a subject the plan may discuss. Do not "
        "reassure the teacher that a unit assumes no prior draft, requires no earlier "
        "activity, needs no particular sitting to have happened, or stands alone — simply "
        "write a unit of which those things are true. State what THIS sitting does; say "
        "nothing about what it does not need. If a sentence would be pointless to a "
        "teacher who had never heard of variant plans, cut it.",
        "- MATERIALS, OPENING MOVES AND HOMEWORK ARE PER-UNIT. No unit may require "
        "that another unit was taught, or that its homework was set, in order to run.",
        # ARV-D-119 (2026-08-12, S5). The line above was already there and was already
        # obeyed in the letter: nothing in TWAU V ch 5 said "as we did last time". The
        # standard's closer instead listed `materials: ["Group posters and charts prepared
        # previously"]` and opened "Groups set up their posters" — a dependency on an
        # ARTEFACT that a DIFFERENT unit produces. Slot X then dropped the unit that made
        # them, and the teacher arrived needing posters her plan never built.
        #
        # A materials list is not prose, so the register's three bans do not reach it, and
        # "no unit may require that another unit was taught" reads to a model as a rule
        # about REFERENCES rather than about THINGS. This says the quiet part.
        "- NO UNIT MAY DEPEND ON A PHYSICAL ARTEFACT ANOTHER UNIT PRODUCES. If a unit "
        "needs a poster, chart, model, collection or draft to exist, it must make it "
        "itself within its own minutes, or the material must be something any classroom "
        "already has. A unit that lists 'prepared previously', 'their charts from "
        "earlier' or 'the models they built' in `materials`, `visual_aids` or an opening "
        "band is asking for a sitting that may not have happened — it is the same failure "
        "as naming another unit, arriving through the props instead of the prose. Where "
        "the chapter genuinely wants a make-then-present pair, put BOTH acts inside ONE "
        "unit. "
        # ── added 2026-08-12 (S11 · C8) ──────────────────────────────────────────────
        # "draft" was already in the list above and the model split an article across two
        # units anyway — twice in one chapter (english·IX ch 7: U15 drafts paragraphs 1-2
        # and U17 completes 3-4; p14's U11 writes it and U12 revises it). A student's own
        # page does not read as a "physical artefact" the way a poster does, so the rule
        # has to name it.
        "A STUDENT'S OWN PIECE OF WRITING COUNTS: an article, essay, letter or story "
        "drafted in one unit and continued, revised or finished in another is the same "
        "dependency in a thinner disguise. Plan every writing task to begin AND end "
        "inside a single unit — drafting, peer response and revision together, on a "
        "scale that fits the minutes available.",
    ]


def _is_plan_granularity(subject, klass):
    """Does this subject·stage serve at PLAN granularity? Asked of the subject plugin,
    exactly as the engine asks it — never a name check here either."""
    try:
        sys.path.insert(0, ROOT)
        from aruvi_core.genon.carriers import serve_granularity
        return serve_granularity(subject, klass) == "plan"
    except Exception:                                       # noqa: BLE001
        return False


def _anchor_field_present(subject, klass):
    """Does this subject·stage's constitution define a `section_anchor` FIELD on the
    period object, or is the anchor mediated out of another field?

    Asked of the subject plugin, exactly as `_is_plan_granularity` above asks its own
    question — never a name check here either. True (the platform default) on any error,
    which is the safe direction: it keeps the wording every certified library was authored
    against.

    WHY A BRIEF CARES (2026-08-10, S7). The standard canonical's synthesis mandate has two
    carriers for one fact (`carriers.is_synthesis`, architecture §0.3): the reserved token
    in `section_anchor`, or an explicit `"synthesis": true` on the period object. Until now
    the boolean form was reserved to the PLAN-granularity stage, on the reasoning that it
    is the one with no section axis. That was the wrong test. What decides the carrier is
    whether the FIELD exists to hold a token — and mathematics·middle has a section axis
    (its anchor is mediated from `textbook_segments[].ref`) and no field. Asking it for
    `section_anchor` would demand a field its constitution never defines, at metered STEP 1,
    and the certifier's synthesis gate would then find no synthesis unit in the library it
    had just paid for. This is the S7 analogue of S4's synthesis-handoff defect
    (`_synthesis_handoff_lines` below), and like it, it is a BRIEF matter: no constitution
    is amended (founder ruling 2026-08-10)."""
    try:
        sys.path.insert(0, ROOT)
        from aruvi_core.genon.carriers import anchor_field_present
        return anchor_field_present(subject, klass)
    except Exception:                                       # noqa: BLE001
        return True


def _arc_brief(count, dur, chapter, standard):
    """The brief for a PLAN-GRANULARITY stage (science·middle;
    docs/science_middle_stage_serve.md). Two things make it different from the
    section-axis briefs, and both follow from the same fact — the plan's axis is the
    chapter's cognitive progression arc, derived fresh from the summary at generation
    time, not the textbook's section list.

    1. THERE IS NO REGISTRY, and none is supplied. Arcs may differ freely between this
       chapter's own canonicals in stage count, labels and structure; nothing is shared
       and nothing is ever borrowed between them (founder, 2026-08-07). Each canonical
       is authored as if it were the only plan of this chapter.
    2. EVERY CANONICAL IS COMPLETE BY CONSTRUCTION. It is not "cover all sections" here
       — the constitution's own Rules 1, 2 and 5 already require every arc stage to be
       taught and the final stage to reach the dissolution test's operation. The brief
       only has to say that the plan will never be cut, so it must be whole at this
       count."""
    lines = [
        f"CANONICAL BRIEF — {count} periods (platform-computed; binding)",
        "",
        f"- This is a COMPLETE, self-sufficient lesson plan for the whole chapter at "
        f"{count} units x {dur} minutes (period_schedule: exactly one row "
        f"{{{dur}, {count}}}). It is NOT a compression, summary or edit of any other "
        f"plan of this chapter — author it from the chapter summary as if it were the "
        f"only plan, deriving its cognitive progression arc afresh at this length.",
        "- THE ARC IS YOURS AT THIS COUNT. Stage count, stage labels and the shape of "
        "the progression are decided by this chapter's content AT THIS BUDGET; they "
        "need not match any other plan of this chapter, and nothing is ever borrowed "
        "between them. The one fixed point is the terminus: the final stage must "
        "correspond to the operation named in the dissolution test sentence.",
        "- THE PLAN IS SERVED WHOLE OR NOT AT ALL. This platform never cuts a plan of "
        "this stage mid-arc, so every stage you open must be completed inside these "
        f"{count} units. There is no coverage note and no budget shortfall available: "
        "an arc that does not close at this count is an authoring failure.",
        "- MATERIALS, OPENING MOVES AND HOMEWORK ARE PER-UNIT. No unit may require "
        "that another unit's homework was set in order to run. Forward and backward "
        "references BETWEEN THE UNITS OF THIS PLAN are welcome — they are always "
        "served together (LP constitution v2.2, THE SELF-CONTAINED REGISTER).",
        # ARV-D-119, the plan-granularity half. The reference ban is correctly relaxed here
        # (every unit of a canonical is served with every other), but the ARTEFACT rule is
        # NOT a reference rule and survives the relaxation: the closer of a K-unit arc is
        # borrowed into a K+1 serve, where the unit that would have made its props is not
        # guaranteed to be present.
        "- NO UNIT MAY DEPEND ON A PHYSICAL ARTEFACT ANOTHER UNIT PRODUCES. Naming a "
        "prior unit is fine here; needing its OUTPUT is not. If a unit needs a poster, "
        "chart, model or draft to exist, it makes it itself, or the material is something "
        "any classroom already has — the closing unit especially, since it is the one "
        "that travels.",
        "- NO CLOCK QUANTITY and NO CALENDAR TIME in any band or note: the platform "
        "scales band minutes to the sitting that carries them, and keeps no calendar.",
    ]
    if standard:
        lines += [
            f"- THE SYNTHESIS MANDATE (this plan alone carries it): unit {count}, the "
            "final unit, is a WHOLE-CHAPTER SYNTHESIS and carries the field "
            '`\"synthesis\": true` on its period object (this stage has no '
            "section_anchor field, so the boolean is how the platform recognises it). "
            "It draws the entire chapter together as a real unit-arc.",
            "- THAT UNIT TRAVELS. It is the ONE unit of this chapter the platform may "
            "serve into a companion canonical's plan — a class that covered this same "
            "chapter through a DIFFERENT arc, with different stages and different "
            "activities. So it may assume the chapter's CONTENT has been taught and "
            "that the class has reached the dissolution test's operation, and it may "
            "name concepts. It must NOT assume any particular earlier stage, activity, "
            "reading, discussion, homework or material actually happened, and must not "
            "name a stage label.",
            f"- COVERAGE COMPLETES BEFORE THE SYNTHESIS: the full arc is taught across "
            f"units 1..{count - 1}.",
            f"- Save as: ch_{int(chapter):02d}_canonical.json",
        ]
    else:
        lines += [
            "- NO SYNTHESIS UNIT. The closing whole-chapter synthesis is reserved to "
            "this chapter's STANDARD canonical; never emit `\"synthesis\": true` here. "
            "End the plan the way this count teaches best.",
            f"- The assessment for this plan is generated from THIS plan's "
            f"coverage_handoff in the normal way; it references no other plan of this "
            f"chapter.",
            f"- Save as: ch_{int(chapter):02d}_canonical_p{count:02d}.json",
        ]
    return "\n".join(lines) + "\n"


def _synthesis_handoff_lines(subject, klass, count):
    """The synthesis unit's OWN coverage_handoff row — asked for only where it is needed.

    On a HANDOFF-BRIDGED stage (the 8-rule table's derived-anchor family: science both
    stages, mathematics·secondary) an assessment item reaches its unit only through a
    `coverage_handoff` row. The synthesis unit is not a textbook section, so it gets no row
    unless asked — and then nothing can be anchored to it, which makes C9.2 ("a borrowed
    unit brings its own items") unsatisfiable on exactly the Case-1 synthesis borrow the
    serve engine relies on.

    This was not hypothetical. Measured on the installed, CERTIFIED science·ix ch 8 library
    (2026-08-08): the model invented a synthesis row unprompted, and no item used it — item
    `section_number`s stopped at 10 while the synthesis sat at unit 12, so its questions
    simply did not exist. Asking is cheaper than hoping, and free.

    Emits nothing on the item-self-sufficient family (items carry `period_ref`, so the
    synthesis unit is reachable without a row) or on the period-field family.
    """
    try:
        sys.path.insert(0, ROOT)
        from aruvi_core.genon.carriers import item_anchor_is_derived
        if not item_anchor_is_derived(subject, klass):
            return []
    except Exception:                                       # noqa: BLE001
        return []
    return [
        f"- GIVE THE SYNTHESIS UNIT ITS OWN coverage_handoff ROW. At this stage an "
        f"assessment item names a GROUP (its section number), never a unit, and the "
        f"platform resolves the unit from that group's handoff row — so a unit with no row "
        f"can hold no question. Emit one final handoff entry for unit {count}: the next "
        f"number in sequence, its period_numbers exactly [{count}], its title/ref the word "
        f"synthesis (this is the ONE row whose label is not copied from the chapter "
        f"summary, because the unit is not a section), and its implied_lo the integrative "
        f"outcome the closing sitting actually builds. Then write its items against that "
        f"row like any other. Do NOT count this row in total_sections — that is the number "
        f"of SECTIONS the chapter has, and synthesis is not one of them.",
    ]


def top_brief_for(subject, klass, chapter):
    """The STANDARD canonical's brief — platform-composed, prepended to the
    generation prompt (v2.0: gains the synthesis-anchor mandate, §0.3)."""
    mp = json.load(open(MP))
    combo = mp["combos"][f"{subject}|{klass}"]
    row = next(c for c in combo["chapters"] if c["chapter"] == int(chapter))
    dur = combo["standard_duration_minutes"]
    count = int(row["recommended_periods"])
    if _is_plan_granularity(subject, klass):
        return _arc_brief(count, dur, chapter, standard=True)
    # WHICH CARRIER THIS STAGE'S SYNTHESIS UNIT WEARS (2026-08-10, S7). One fact, two
    # carriers, exactly as `carriers.is_synthesis` reads it: the reserved token in
    # `section_anchor` where that field exists, the explicit boolean where it does not.
    # The wording below is byte-identical to the pre-S7 brief on every stage that HAS the
    # field, which is the point — ten certified stages must not be re-briefed by a change
    # made for the eleventh.
    field = _anchor_field_present(subject, klass)
    marker = ("its section_anchor is exactly the single word: synthesis (the "
              "reserved token — NOT a section name, no joining)"
              if field else
              "it carries the field `\"synthesis\": true` on its period object "
              "(the boolean is how the platform recognises it; this stage's periods "
              "have no field to hold a reserved token, so do not invent one)")
    no_other = ("No other unit may use the synthesis token." if field else
                "No other unit may carry `\"synthesis\": true`.")
    return "\n".join([
        f"STANDARD CANONICAL BRIEF — {count} periods (platform-computed; binding)",
        "",
        f"- This is the chapter's fullest plan: {count} units x {dur} minutes "
        f"(period_schedule: exactly one row {{{dur}, {count}}}).",
        *_serving_block(),
        f"- THE SYNTHESIS MANDATE (this plan alone carries it): unit {count}, the "
        f"final unit, is a WHOLE-CHAPTER SYNTHESIS and {marker}. It draws the entire "
        "chapter together as a real unit-arc. It may "
        "assume every SECTION'S CONTENT has been taught, and may connect back to "
        "concepts BY NAME — but it must NOT assume any particular earlier activity, "
        "reading, discussion, homework or material actually happened: it will be "
        "served to classes that covered the same sections through DIFFERENT units.",
        # ── added 2026-08-12 (S11 · C8, from ARV-D-136) ───────────────────────────────
        # The sentence above forbids ASSUMING an earlier activity. english·IX ch 7's
        # synthesis unit obeyed that in its discussion bands and broke it in its last one,
        # because CONTINUING a piece of work is not obviously "assuming an activity": U17
        # asked the class to "complete the draft article (Paragraphs 3 and 4)" begun at U15.
        # Read inside the standard that is coherent. Served, it is not — this unit is the
        # Case-1 borrow, and BOTH compacts of that chapter write the whole article in one
        # sitting, so every borrowing class arrives having already finished it. The prose
        # rule needed the same treatment the artefact rule got at S5: say the quiet part.
        "- THE SYNTHESIS UNIT STARTS AND FINISHES ITS OWN WORK. It may DRAW ON what the "
        "chapter taught; it must not CONTINUE, complete, revise or hand back a piece of "
        "student work another unit began — no 'complete the draft', no 'finish the poster', "
        "no 'return to the essay you started'. A borrowing class may have done that work in "
        "one sitting, or in a different form, or not yet at all. Any writing, making or "
        "performing in this unit begins and ends inside its own minutes.",
        f"- COVERAGE COMPLETES BEFORE THE SYNTHESIS: all registry sections "
        f"first-appear across units 1..{count - 1}. {no_other}",
        # ── added 2026-08-19 (S7 · W1, four chapters lost to this) ────────────────────
        # The line above was the whole mandate and it was read as satisfied by
        # construction. "All REGISTRY sections" is circular from the model's seat — the
        # registry is derived from what the body units name, so a model that puts the
        # chapter's last section only in the closer has not obviously broken anything it
        # can see. mathematics vi ch 3 (3.12), vi ch 10 (10.5), vii ch 3 (3.8) and
        # viii ch 3 (3.4.IV) all did exactly that, wrote an item on the section, and did
        # not compile: `carriers.items_by_period_field` indexes non-synthesis units only
        # (the S7 fix that stopped every item collapsing onto the closer), so the item
        # anchored nowhere. Four artefacts, otherwise clean, unusable.
        # So say the quiet part, name the section that is at risk, and state the cost.
        f"- THE SYNTHESIS UNIT INTRODUCES NOTHING. Every section it names must "
        f"ALREADY HAVE BEEN TAUGHT by one of units 1..{count - 1}: unit {count} "
        f"revisits, it never delivers. This binds the chapter's LAST section hardest, "
        f"because saving a short closing section for the closing unit reads natural and "
        f"is the exact failure — a section whose first and only teaching is unit "
        f"{count} enters no section list, so no shorter plan of this chapter can teach "
        f"it, and an assessment item written on it resolves to no unit and the file is "
        f"rejected. If the chapter's final section is slight, teach it inside unit "
        f"{count - 1} beside its neighbour; do not hold it back for the close.",
        *_synthesis_handoff_lines(subject, klass, count),
        f"- Save as: ch_{int(chapter):02d}_canonical.json",
    ]) + "\n"


def briefs_for(subject, klass, chapter):
    """{compact_count: brief_text} for the chapter's compact canonicals —
    FREE authoring (v2.0): registry discipline + total coverage, no closing
    mandate, no synthesis token. Raises SystemExit when the standard canonical
    is missing or the row is not annotated."""
    mp = json.load(open(MP))
    combo = mp["combos"][f"{subject}|{klass}"]
    row = next(c for c in combo["chapters"] if c["chapter"] == int(chapter))
    plan = row.get("canonical_plan")
    if not plan or plan.get("provisional"):
        why = getattr(standard_registry, "last_error", None)
        if why is None:                     # the annotate pass may not have run in THIS process
            standard_registry(subject, klass, chapter)
            why = getattr(standard_registry, "last_error", None)
        raise SystemExit(
            "Row is provisional — author and certify the standard canonical, run this "
            "script's annotate pass, then ask again."
            + (f"\n  the standard IS on disk and did not compile: {why}" if why else ""))
    dur = combo["standard_duration_minutes"]
    if _is_plan_granularity(subject, klass):
        # No registry is read, because there is none to read: this stage's canonicals
        # share no axis, so a compact needs nothing at all from the standard.
        return {k: _arc_brief(k, dur, chapter, standard=False)
                for k in plan["counts"][1:]}, plan
    reg = standard_registry(subject, klass, chapter)
    if reg is None:
        raise SystemExit("No standard canonical on disk — author it first; if the row "
                         "says finalized it is stale: re-run the annotate pass.")
    # The compact's registry paragraph names the field the anchor goes in and forbids the
    # synthesis carrier. Both are stage-dependent for the same reason `top_brief_for`'s
    # mandate is (2026-08-10, S7): a mediated-anchor stage has no `section_anchor` field to
    # name, and its synthesis carrier is the boolean, not the token. A compact carrying a
    # synthesis unit is exactly the ARV-D-025 failure v2.0 exists to prevent, so the
    # prohibition has to be stated in the carrier that stage actually uses — forbidding a
    # token it was never going to emit forbids nothing. Byte-identical where the field
    # exists.
    if _anchor_field_present(subject, klass):
        registry_rule = (
            "  Every unit's section_anchor MUST be drawn verbatim from this "
            "list (a multi-section unit joins its sections with \" / \" in "
            "list order). Sections must FIRST APPEAR in registry order. The "
            "token `synthesis` is RESERVED to the chapter's standard canonical "
            "— never use it here.")
    else:
        registry_rule = (
            "  Every unit's section reference MUST be drawn verbatim from this "
            "list, in the field your own constitution already defines for it (a "
            "unit teaching several sections lists them all, in list order). "
            "Sections must FIRST APPEAR in registry order. The closing "
            "whole-chapter SYNTHESIS is RESERVED to the chapter's standard "
            "canonical. Emit `\"synthesis\": false` on every unit.")
    out = {}
    for k in plan["counts"][1:]:
        lines = [
            f"CANONICAL BRIEF — {k} periods (platform-computed; binding)",
            "",
            f"- This is a COMPLETE, self-sufficient lesson plan for the whole "
            f"chapter at {k} periods x {dur} minutes (period_schedule: exactly "
            f"one row {{{dur}, {k}}}). It is NOT a compression, summary, or "
            f"edit of any other plan of this chapter — author it from the "
            f"chapter summary as if it were the only plan.",
            "- SECTION REGISTRY (verbatim; the chapter's ordered sections):",
        ]
        lines += [f"    {i}. {a}" for i, a in enumerate(reg, 1)]
        lines += [
            registry_rule,
            # COVERAGE: THE CONSTRAINT ONLY, NEVER A MECHANISM (founder, 2026-08-10, S7·C9).
            # What stood here mandated the method as well as the outcome — "ADJACENT sections
            # share a unit… where the count demands it" — and that is where p10's composite
            # U10 came from: with 5 sections across 10 units nothing demanded merging at all,
            # yet the brief presented it as the technique for achieving coverage. Ordering
            # already lives in the registry bullet ("Sections must FIRST APPEAR in registry
            # order"); run length and merging are Rules 1 and 2's, and the brief must not
            # have a second opinion. What is LEFT is the one thing no constitution can know:
            # four of them (maths·secondary, science·secondary, SS middle and secondary)
            # explicitly offer a section_coverage_note escape, which is a SERVE-time concept
            # and not available to a canonical; and six others forbid dropping nowhere at all.
            "- A canonical covers the whole chapter: section_coverage_note is "
            "not available here.",
            *_serving_block(),
            # NOTHING IS SAID TO A COMPACT ABOUT HOW IT ENDS (2026-08-10, founder ruling at
            # S7 · C9). What stood here encouraged one: "A final unit that condenses the last
            # adjacent sections is WELCOME when the count demands it". ARV-D-025 retired the
            # MANDATED closing span; it did not authorise a recommendation in its place, and
            # nobody signed off on turning a removal into an invitation. The line described
            # p10's composite U10 in advance and, with the revisit permission above, meant
            # four LP amendments (v3.5-v3.8) were arguing with an instruction in the same
            # request that kept granting what they forbade.
            #
            # THE DIVISION IS THE POINT (testing.md §3): the brief carries the V-SERIES — the
            # serving contract, the registry, verbatim anchors, first-appear order, total
            # coverage, per-variant assessment. HOW A PLAN IS SHAPED IS PEDAGOGY, and pedagogy
            # is the constitution's. Rules 1 and 2 govern run length, contiguity and merging;
            # the brief must not have a second opinion.
            "- The assessment for this plan is generated from THIS plan's "
            "coverage_handoff in the normal way; it references no other "
            "plan of this chapter.",
            f"- Save as: ch_{int(chapter):02d}_canonical_p{k:02d}.json",
        ]
        out[k] = "\n".join(lines) + "\n"
    return out, plan


def print_briefs(subject, klass, chapter):
    """`python3 genon/variant_plans.py brief <subject> <CLASS> <ch>`."""
    briefs, plan = briefs_for(subject, klass, chapter)
    print(f"# Canonical briefs · {subject} {klass} ch {chapter} · "
          f"library {plan['counts']}\n")
    for k, text in briefs.items():
        print("=" * 72)
        print(text)


# ── annotate ─────────────────────────────────────────────────────────────────

def main():
    mp = json.load(open(MP))
    n_real = n_prov = 0
    for key, combo in mp["combos"].items():
        subject, klass = key.split("|")
        for ch in combo["chapters"]:
            if ch.get("reserve"):
                # Budgeted time with no chapter behind it (master_plan.py RESERVE_PREFIX,
                # 2026-10-02): nothing to author, so no canonical plan to annotate.
                ch.pop("canonical_plan", None)
                continue
            a = int(ch["recommended_periods"])
            c = int(ch["floor_periods_at_standard"])
            counts = list(ch.get("canonical_periods") or canonical_counts(a, c))
            reg = standard_registry(subject, klass, ch["chapter"])
            top_path, p_path = library_paths(subject, klass, ch["chapter"])
            authored = ([counts[0]] if os.path.isfile(top_path) else []) + \
                       [k for k in counts[1:] if os.path.isfile(p_path(k))]
            provisional = reg is None
            n_prov += provisional
            n_real += not provisional
            ch.pop("variant_plan", None)            # stale v1.x solver annotation
            ch["canonical_plan"] = {
                "counts": counts,                    # standard first, descending
                "provisional": provisional,
                "basis": "arithmetic" if provisional else "authored_standard",
                "registry_sections": None if reg is None else len(reg),
                "authored": authored,
            }
    mp["_meta"].pop("variant_plans", None)
    mp["_meta"]["canonical_plans"] = (
        "each chapter carries canonical_plan (v2.0 2026-08-03, genon/variant_plans.py): "
        "the canonical counts by equal dispersion over [floor, standard] — no solver, "
        "no sigma, no mandated closing spans (architecture §0). Canonicals are authored "
        "FREE; the standard alone closes with the mandated whole-chapter synthesis "
        "(section_anchor = the reserved token `synthesis`). provisional=true until the "
        "standard canonical is on disk — re-run this script after each authoring pass.")
    json.dump(mp, open(MP, "w"), ensure_ascii=False, indent=2)
    print(f"canonical plans written: {n_real} on authored standards, {n_prov} provisional")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "brief":
        print_briefs(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        main()
