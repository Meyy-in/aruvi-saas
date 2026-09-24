"""WALK-A-066 — download names. Stdlib only; run: python3 tests/test_report_names.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
from report_names import report_filename as rf, year_plan_filename as yp, chapter_label

CASES = [
    (rf("lesson", False, "iii", "english", "Madhu's Wish (Madhu's Wish)", "pdf"), "English-III-LP-Madhus Wish.pdf"),
    (rf("lesson", True, "iii", "english", "Madhu's Wish (Madhu's Wish)", "pdf"), "English-III-LP-Madhus Wish.pdf"),
    (rf("assessment", False, "iii", "english", "Madhu’s Wish (Madhu’s Wish)", "pdf"), "English-III-Assess-Madhus Wish.pdf"),
    (rf("assessment", True, "iii", "english", "Madhu's Wish", "docx"), "English-III-Assess-Answers-Madhus Wish.docx"),
    (rf("integrated", False, "iii", "english", "Out in the Garden (Toys and Games)", "pdf"), "English-III-LP-Assess-Out in the Garden (Toys and Games).pdf"),
    (rf("integrated", True, "iii", "english", "Thank God! (Thank God!)", "pdf"), "English-III-LP-Assess-Answers-Thank God.pdf"),
    (rf("integrated", False, "iii", "english", "Madhu's Wish", "pdf", unit=2), "English-III-LP-Assess-Madhus Wish-Unit 2.pdf"),
    (rf("lesson", False, "ix", "social_sciences", "Chapter 8: Building Blocks in Economics: The Problem of Choice", "pdf"),
     "Social Sciences-IX-LP-Building Blocks in Economics - The Problem of Choice.pdf"),
    (rf("lesson", False, "iv", "the_world_around_us", "Food We Eat", "pdf"), "The World Around Us-IV-LP-Food We Eat.pdf"),
    (rf("lesson", False, "vi", "science", "", "pdf", chapter_number=5), "Science-VI-LP-Ch 5.pdf"),
    (yp("iii", "English"), "English-III-YearPlan.docx"),
    (yp("ix", "Social Sciences"), "Social Sciences-IX-YearPlan.docx"),
]
bad = 0
for got, want in CASES:
    ok = got == want
    bad += not ok
    print(("PASS " if ok else "FAIL ") + got + ("" if ok else f"   (want {want})"))
long = chapter_label("A very long chapter title that goes on and on well past any sensible filename length limit")
ok = len(long) <= 60 and not long.endswith(" ")
bad += not ok
print(("PASS " if ok else "FAIL ") + f"cap: {long!r} ({len(long)})")
for t in ["Madhu's Wish", "Thank God!", "Chapter 8: Economics: Choice", "Café — “quotes”"]:
    n = rf("lesson", False, "iii", "english", t, "pdf")
    try:
        n.encode("latin-1"); ok = all(c not in n for c in '\\/:*?"<>|')
    except UnicodeEncodeError:
        ok = False
    bad += not ok
    print(("PASS " if ok else "FAIL ") + f"header-safe: {n}")
print("\nALL PASS" if not bad else f"\n{bad} FAILED")
sys.exit(1 if bad else 0)
