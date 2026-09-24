"""The names of the files Meyy hands a teacher (WALK-A-066, founder-approved 2026-09-24).

    {Subject}-{class}-LP-{chapter}                  the lesson plan
    {Subject}-{class}-Assess-{chapter}              the assessment
    {Subject}-{class}-Assess-Answers-{chapter}      … with answers
    {Subject}-{class}-LP-Assess-{chapter}           the integrated report
    {Subject}-{class}-LP-Assess-Answers-{chapter}   … with answers
    … -Unit {n}                                     integrated, scoped to one unit
    {Subject}-{class}-YearPlan                      the Year Plan

★ SUBJECT FIRST (founder, same day, revising his own kind-first draft): "when teacher indexes
it all class and subject will come together" — a sorted folder groups by subject, then class,
then document type, then chapter.

WHY THE CHAPTER NAME AND NOT ITS NUMBER: English chapters are split into their sections, so the
number no longer says what she is holding, and she searches her files by chapter NAME.

THE RULES, written down once (the founder approved each):
  · class in Roman numerals, as the app shows it (III, IX);
  · subject as the app shows it ("Social Sciences");
  · the chapter name keeps its ordinary spaces; hyphens separate the PARTS only;
  · ! ? and apostrophes are DROPPED (Madhu's -> Madhus); the Windows-illegal set \\ / * < > | "
    is removed; a colon becomes " - ";
  · a doubled parenthetical collapses ("Thank God! (Thank God!)" -> "Thank God"); a
    parenthetical that adds information stays ("Out in the Garden (Toys and Games)");
  · a leading "Chapter N:" is stripped (the WALK-A-072 rule);
  · the chapter name is capped at 60 characters, cut at a word — the prefix is never cut;
  · ASCII only: the name travels in an HTTP header, which is Latin-1, and a curly quote there
    is a 500. Accented letters fold to their base letter; anything else is dropped;
  · no date — a second download of the same file takes the browser's own "(1)".
Pure stdlib, so it is testable without the app: tests/test_report_names.py."""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

NAME_CAP = 60

_KIND_PREFIX = {
    ("lesson", False): "LP",
    ("lesson", True): "LP",
    ("assessment", False): "Assess",
    ("assessment", True): "Assess-Answers",
    ("integrated", False): "LP-Assess",
    ("integrated", True): "LP-Assess-Answers",
}


def _ascii(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or ""))
    return s.encode("ascii", "ignore").decode("ascii")


def class_label(grade: str) -> str:
    """'iii' / 'grade_iii' / 'Class 3'-ish slugs -> 'III'. Roman by founder decision."""
    g = str(grade or "").strip().lower()
    for pre in ("grade_", "grade-", "grade ", "class_", "class-", "class "):
        if g.startswith(pre):
            g = g[len(pre):]
    if g.isdigit():
        n = int(g)
        vals = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
        out = ""
        for v, r in vals:
            while n >= v:
                out += r
                n -= v
        return out or g
    return _ascii(g).upper()


def subject_label(subject: str) -> str:
    """'social_sciences' or 'Social Sciences' -> 'Social Sciences'."""
    s = _ascii(str(subject or "")).replace("_", " ").replace("-", " ")
    s = re.sub(r"\s+", " ", s).strip()
    # every word capitalised — the app's own `pretty` ("The World Around Us")
    return " ".join(w[:1].upper() + w[1:] for w in s.split(" ")) if s else "Subject"


def chapter_label(title: str, fallback: str = "") -> str:
    t = str(title or "").strip()
    t = re.sub(r"^\s*chapter\s+\d+\s*[:.\-–—]\s*", "", t, flags=re.I) or t
    # a doubled parenthetical: "X (X)" -> "X" (compared after the same cleaning both sides)
    m = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", t)
    if m and _clean(m.group(1)).lower() == _clean(m.group(2)).lower():
        t = m.group(1)
    t = _clean(t)
    if len(t) > NAME_CAP:
        cut = t[:NAME_CAP + 1]
        t = cut[:cut.rfind(" ")] if " " in cut[:NAME_CAP] else t[:NAME_CAP]
        t = t.rstrip(" -.,(")
    return t or fallback


def _clean(t: str) -> str:
    t = str(t or "").replace("’", "'").replace("‘", "'")
    t = t.replace(":", " - ")
    t = re.sub(r"[!?'\"`\\/*<>|]", "", t)
    t = _ascii(t)
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"(\s-\s)+", " - ", t)
    return t.strip(" .-")


def report_filename(kind: str, answers: bool, grade: str, subject: str, chapter_title: str,
                    ext: str, unit: Optional[int] = None, chapter_number=None) -> str:
    prefix = _KIND_PREFIX.get((kind, bool(answers) and kind != "lesson"), "LP")
    fallback = f"Ch {chapter_number}" if chapter_number not in (None, "") else "Chapter"
    name = chapter_label(chapter_title, fallback)
    u = f"-Unit {unit}" if (kind == "integrated" and unit is not None) else ""
    return f"{subject_label(subject)}-{class_label(grade)}-{prefix}-{name}{u}.{ext}"


def year_plan_filename(grade: str, subject: str) -> str:
    return f"{subject_label(subject)}-{class_label(grade)}-YearPlan.docx"
