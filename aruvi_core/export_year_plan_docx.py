"""
Year Plan — DOCX export of the Year Plan TABLE (and only the table).

Why this module exists at all, given YearPlan.jsx's own header says the year plan is
"a LIVING mobile view, never a PDF": that decision was about the ALLOCATION REPORT —
a document the teacher was asked to read INSTEAD of the screen. This is the opposite
direction. She reads the year on the screen and then needs the same three columns
somewhere the screen cannot go: a staff meeting, a HOD's file, a printout on a
noticeboard. So the export is deliberately the table, the header that identifies it
and the note that explains the two columns — never a report built around it. No
competencies, no effort-index values, no summary strip, no executive prose. If it is
not on the pane, it is not in the file.

★ THE PAYLOAD IS THE SCREEN'S OWN MODEL, NOT A RE-COMPUTATION.

The suggested-periods column is computed CLIENT-side (YearPlan.jsx's `useMemo`:
budget from the readiness projection, distributed by chapter weight with
largest-remainder). Recomputing it here would put a second implementation of that
arithmetic in the product, and the day the two drift the teacher has a Word document
that contradicts the screen she exported it from — the exact defect the calibrated-
budget work of 2026-08-21 was about (Year Plan said 14 where the chapter step said
19). So the client POSTs what it is displaying and this module only renders it. That
is also why every value arrives pre-formatted-or-null: a missing number renders as an
em-dash, NEVER as a zero (the Support `metaErr` rule — a document may say it does not
know; it may never invent an answer about her record).

House style is IMPORTED from export_allocation_docx, not copied, so the three Aruvi
documents cannot drift (the convention export_data_rights_docx.py set).

Payload shape (see api/main.YearPlanExportRequest):
    {subject: "Science" (display) | "science" (slug), grade: "vii",
     budget: int|None, generated_at: iso|None,
     rows: [{n: int, title: str, sug: int|None, plan: int|None,
             prepared: bool, awaited: bool}],
     sug_total: int, plan_total: int}
"""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Any, Dict, List, Optional

from docx import Document
from docx.shared import Pt, Inches, Cm
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from . import brand   # the MEYY wordmark raster (2026-09-03)

from .export_allocation_docx import (
    _bg, _cell, _no_borders, _rule, _run, _set_widths,
    INK, PINE, CLAY, GRAY, MUTED, BODY, SERIF,
)
from .report_competency import grade_roman, subject_display, date_long

# ★ LAID OUT LIKE THE LESSON-PLAN PDF (founder, 2026-09-18, reading it in the phone's preview:
# "not well formatted … must fill the width with adequate space in rows of the 1 page … the
# alternate rows have background filling but there should be none … the tops should be similar
# to LP pdf"). So: A4 with the LP's margins, the LP's letterhead sizes, the LP grid's light full
# borders and warm header row (`.gh` — GREY_HEAD, 6.5pt bold uppercase), NO row striping, and
# rows sized to spread the table down one page.
GREY_HEAD = "F1ECE2"      # export_lesson_pdf GREY_HEAD — the header row, and only the header row
GRID = "DDDDDD"           # export_lesson_pdf LINE
PAGE_W_IN, PAGE_H_IN = 8.27, 11.69                       # A4
MARGIN_TB_CM, MARGIN_LR_CM = (1.5, 1.4), 1.3
CONTENT_W_IN = PAGE_W_IN - 2 * (MARGIN_LR_CM / 2.54)     # ≈ 7.25in
TABLE_BUDGET_IN = 6.2   # measured: a row never renders shorter than ~0.3in, so leave the note its room     # height left for the table once letterhead + note are placed
ROW_MIN_IN, ROW_MAX_IN = 0.24, 0.55   # 0.24 keeps a 22-chapter year on one page


def _grid(table, color=GRID):
    """The LP grid: light full borders on every edge (table.grid, 0.75px LINE)."""
    tblPr = table._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{edge}")
        e.set(qn("w:val"), "single"); e.set(qn("w:sz"), "6")
        e.set(qn("w:space"), "0"); e.set(qn("w:color"), color)
        b.append(e)
    tblPr.append(b)


def _full_width(table):
    """Span the whole content width — Quick Look and Word both honour a 100% table width."""
    tblPr = table._tbl.tblPr
    w = OxmlElement("w:tblW"); w.set(qn("w:w"), "5000"); w.set(qn("w:type"), "pct")
    for old in tblPr.findall(qn("w:tblW")):
        tblPr.remove(old)
    tblPr.append(w)


def _grid_cols(table, widths_in):
    """Write the table's own column grid. Per-cell widths alone are ignored by LibreOffice and
    Quick Look when the grid says otherwise — the first render came out as four EQUAL columns
    with the chapter titles wrapping to three lines."""
    grid = table._tbl.tblGrid
    cols = grid.findall(qn("w:gridCol"))
    for gc, w in zip(cols, widths_in):
        gc.set(qn("w:w"), str(int(w * 1440)))


def _row_height(row, inches):
    trPr = row._tr.get_or_add_trPr()
    h = OxmlElement("w:trHeight")
    h.set(qn("w:val"), str(int(inches * 1440))); h.set(qn("w:hRule"), "atLeast")
    trPr.append(h)


def _vcenter(cell):
    v = OxmlElement("w:vAlign"); v.set(qn("w:val"), "center")
    cell._tc.get_or_add_tcPr().append(v)


def _pad(table, top=40, side=115):
    """Cell padding in twips — the LP grid's `padding: 5px 8px`."""
    tblPr = table._tbl.tblPr
    m = OxmlElement("w:tblCellMar")
    for edge, v in (("top", top), ("bottom", top), ("left", side), ("right", side)):
        e = OxmlElement(f"w:{edge}"); e.set(qn("w:w"), str(v)); e.set(qn("w:type"), "dxa")
        m.append(e)
    tblPr.append(m)


# The em-dash the screen uses for "no number here" (.yp-dash). One constant so the
# three places that need it cannot disagree.
DASH = "—"


def _fmt(v: Optional[int]) -> str:
    """A number, or the em-dash. Zero is a real answer and prints as 0; None is not."""
    return DASH if v is None else str(v)


def _plan_cell(row: Dict[str, Any]) -> str:
    """The "Your plan" cell, mirroring YearPlan.jsx's four-way render exactly.

    A chapter can be prepared with no periods recorded (legacy prepares stored no
    `prepared_periods`) — the screen shows "set" for those, and so does this, because
    a dash there would read as "not prepared" and misstate her year.
    """
    if row.get("awaited"):
        return DASH
    if row.get("plan") is not None:
        return str(row["plan"])
    if row.get("prepared"):
        return "set"
    return DASH


def _when(generated_at: Optional[str]) -> datetime:
    if generated_at:
        try:
            return datetime.fromisoformat(generated_at)
        except ValueError:
            pass
    return datetime.now()


def export_year_plan_docx(payload: Dict[str, Any]) -> bytes:
    """Render the Year Plan table as an editable Word document. Returns docx bytes."""
    rows: List[Dict[str, Any]] = list(payload.get("rows") or [])
    subject = payload.get("subject") or ""
    grade = payload.get("grade") or ""
    budget = payload.get("budget")

    # Display strings. `subject` may arrive as a slug ("social_sciences") or as the
    # profile's display name ("Social Sciences"); subject_display normalizes either.
    subj = subject_display(subject)
    g = grade_roman(grade)

    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Inches(PAGE_W_IN)
    sec.page_height = Inches(PAGE_H_IN)
    sec.top_margin = Cm(MARGIN_TB_CM[0])
    sec.bottom_margin = Cm(MARGIN_TB_CM[1])
    sec.left_margin = Cm(MARGIN_LR_CM)
    sec.right_margin = Cm(MARGIN_LR_CM)

    # ── Header — the same mark, rule and right-hand identification block as the
    # allocation report and the data export. Only the title differs.
    ht = doc.add_table(rows=1, cols=2)
    _no_borders(ht)
    _full_width(ht)
    _set_widths(ht, [CONTENT_W_IN * 0.6, CONTENT_W_IN * 0.4])   # the LP's 60/40 letterhead
    _grid_cols(ht, [CONTENT_W_IN * 0.6, CONTENT_W_IN * 0.4])
    lc = ht.rows[0].cells[0]
    lc.paragraphs[0].clear()
    lp = lc.paragraphs[0]
    lp.paragraph_format.space_after = Pt(0)
    brand.add_wordmark(lp, 16)   # the MEYY wordmark — the LP PDF's 16
    lp2 = lc.add_paragraph()   # kicker beneath the mark; NCF line gone (founder, 2026-09-03)
    lp2.paragraph_format.space_before = Pt(1)
    _run(lp2, "LESSON STUDIO", size=7, color=GRAY, font="Calibri")

    rc = ht.rows[0].cells[1]
    rc.paragraphs[0].clear()
    rp = rc.paragraphs[0]
    rp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    rp.paragraph_format.space_after = Pt(0)
    _run(rp, "Year plan", size=11, bold=True, color=PINE, font=SERIF)   # LP .rep-title
    rp2 = rc.add_paragraph()
    rp2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    # "Class VII" — the teacher-facing word on this pane is Class, not Grade (the web
    # side says "Class 7"); the allocation report says Grade because that document
    # predates the change and its own wording is settled.
    _run(rp2, f"Class {g} · {subj} · {date_long(_when(payload.get('generated_at')))}",
         size=7, color=GRAY)                                                  # LP .rep-sub

    gap = doc.add_paragraph()
    gap.paragraph_format.space_before = Pt(6)
    gap.paragraph_format.space_after = Pt(12)
    _rule(gap, color="1A1917", sz=16)

    _year_plan_table(doc, rows, payload)
    _note(doc, rows, budget)

    buf = BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.getvalue()


def _year_plan_table(doc, rows: List[Dict[str, Any]], payload: Dict[str, Any]) -> None:
    """The three columns of the pane: Chapter · Suggested periods · Your plan.

    Column ORDER and wording are the screen's, deliberately — a teacher who exports
    what she is looking at should be able to lay the two side by side.
    """
    headers = ["#", "Chapter", "Suggested periods", "Your plan"]
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    _grid(t)
    _full_width(t)
    _pad(t)
    # One page: rows share the height left once the letterhead and the note are placed, within
    # a floor (never cramped) and a ceiling (a short year does not float in empty boxes).
    row_h = max(ROW_MIN_IN, min(ROW_MAX_IN, TABLE_BUDGET_IN / (len(rows) + 2)))
    body_pt = 10 if row_h >= 0.42 else 9 if row_h >= 0.30 else 8.5
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]
        _cell(c, h.upper(), size=6.5, bold=True, color=GRAY,
              align="left" if i == 1 else "center")
        _bg(c, GREY_HEAD)
        _vcenter(c)
    _row_height(t.rows[0], 0.32)

    for idx, r in enumerate(rows, 1):
        row = t.add_row()
        cells = row.cells
        _row_height(row, row_h)
        _cell(cells[0], str(r.get("n", idx)).zfill(2), size=body_pt - 1, color=MUTED, align="center")
        title = r.get("title") or ""
        if r.get("awaited"):
            # "Book awaited" chapters hold periods in the budget but can carry no plan
            # (API flag, 2026-08-06). They belong in the year; the screen greys them
            # and so does this — MUTED ink rather than a note that would need a legend.
            _cell(cells[1], title, size=body_pt, color=MUTED, align="left", font=SERIF)
        else:
            _cell(cells[1], title, size=body_pt, align="left", font=SERIF)
        _cell(cells[2], _fmt(r.get("sug")), size=body_pt, align="center")
        _cell(cells[3], _plan_cell(r), size=body_pt, align="center",
              color=MUTED if _plan_cell(r) == DASH else INK)
        for cell in cells:
            _vcenter(cell)
        # ✂ No row striping (founder, 2026-09-18) — the LP grid has none.

    # Total row — the analogue of .yp-tot, and it carries the SCREEN's totals rather
    # than a sum of the column above it. They agree today; if a future row type ever
    # counts differently, the document must still say what the pane said.
    trow = t.add_row()
    _row_height(trow, row_h)
    cells = trow.cells
    _cell(cells[0], "", size=body_pt)
    _cell(cells[1], "Total periods", size=body_pt, bold=True, align="left")
    _cell(cells[2], _fmt(payload.get("sug_total")), size=body_pt, bold=True, align="center")
    _cell(cells[3], _fmt(payload.get("plan_total")), size=body_pt, bold=True, align="center")
    for cell in cells:
        _vcenter(cell)          # no fill here either — the bold carries the total

    # The full content width (≈7.25in on A4 with the LP's margins).
    w = CONTENT_W_IN
    widths = [0.55, w - 0.55 - 1.45 - 1.2, 1.45, 1.2]
    _set_widths(t, widths)
    _grid_cols(t, widths)


def _note(doc, rows: List[Dict[str, Any]], budget: Optional[int]) -> None:
    """The pane's own explanatory note — ALL of it, and in the pane's own words.

    It is here because the two period columns are not self-explanatory off the screen:
    a colleague reading the printout has no way to know that "Suggested" is Aruvi's
    proposal and "Your plan" is the teacher's own commitment.

    ⚠️ THIS PROSE IS A SECOND COPY OF `.yp-note` IN YearPlan.jsx — change one, change
    the other. The closing "To know how Aruvi suggests…" sentence was dropped on the
    first build (founder, live) precisely because nothing tied the two together, so
    `test_note_matches_the_panes_own_words` now reads the JSX and checks every
    non-interpolated sentence of the pane's note appears here. Splitting is not worth
    a shared string table across the language boundary; the test is.
    """
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    _run(p, "Your teaching year at a glance — how ", size=9, color=BODY, font=SERIF)
    if budget is not None:
        _run(p, "a budget of ", size=9, color=BODY, font=SERIF)
        _run(p, f"{budget} periods", size=9, bold=True, color=INK, font=SERIF)
    else:
        _run(p, "your periods", size=9, color=BODY, font=SERIF)
    _run(p, f" spread across all {len(rows)} chapters. ", size=9, color=BODY, font=SERIF)
    _run(p, "Suggested periods", size=9, bold=True, color=INK, font=SERIF)
    _run(p, " is Meyy's proposal, giving heavier chapters more room. Each time you "
            "prepare a lesson you set your own periods for that chapter; those appear in ",
         size=9, color=BODY, font=SERIF)
    _run(p, "Your plan", size=9, bold=True, color=INK, font=SERIF)
    _run(p, ", beside the suggestion, so you can see where you've adjusted and how much "
            "of the year you've committed. To know how Meyy suggests, refer to Ask Meyy "
            "time allocation section.", size=9, color=BODY, font=SERIF)
