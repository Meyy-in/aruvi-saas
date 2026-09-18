"""
Data-rights export — PDF twin of export_data_rights_docx.py.

Same document, same sections, same founder directions (2026-08-22: house format ·
purpose statement · profile table · numbered notes with chapter names · teaching-state
table free of filenames/periods · pre-deletion advisory) — rendered via xhtml2pdf, the
same pure-Python engine the allocation report's PDF uses (reportlab + html5lib, no
system libraries, identical output on a teacher's machine and a cloud server). The CSS
vocabulary is ported from export_allocation_pdf.render_pdf_html so the two PDFs read
as one family: Georgia brand header with the clay dot, heavy rule as a 1-cell table
(xhtml2pdf draws table borders reliably), serif section heads over hairline rules,
hairline tables.

Consumes the same plain-dict payload the docx builder does — assembled by
adapters/data_rights_service_file.py, storage never touched here.
"""

from __future__ import annotations

import html as _html
from datetime import datetime, timezone
from typing import Any, Dict

from .pdf_fonts import font_face_css
from . import brand   # the MEYY wordmark raster (2026-09-03)
from .report_competency import date_long, subject_display


def _esc(s) -> str:
    return _html.escape(str(s or ""))


def _class_of(grade_slug: str) -> str:
    return str(grade_slug or "").replace("grade", "").replace("_", " ").strip().upper()


def _subj(slug: str) -> str:
    return subject_display(slug) if slug else ""


def render_pdf_html(payload: Dict[str, Any]) -> str:
    """xhtml2pdf-friendly document (table layout, no flexbox)."""
    acct = payload.get("account") or {}
    try:
        when = datetime.fromisoformat(str(payload.get("exported_at", "")))
    except ValueError:
        when = datetime.now(timezone.utc)
    who = acct.get("display_name") or acct.get("account_id") or ""

    # ── account rows ──
    acct_rows = "".join(
        f'<tr><td class="kv-k">{_esc(label)}</td>'
        f'<td class="kv-v">{_esc(str(acct.get(key))[:10] if key == "created_at" else acct.get(key))}</td></tr>'
        for label, key in (("Name", "display_name"), ("User ID", "account_id"),
                           ("Email", "email"), ("Phone", "phone"),
                           ("School", "school_name"), ("Member since", "created_at"))
        if acct.get(key))
    acct_html = (f'<table class="kv-table">{acct_rows}</table>' if acct_rows
                 else '<p class="empty">No account record found.</p>')

    # ── teaching profile table ──
    prows = ""
    for s in ((payload.get("profile") or {}).get("subjects")) or []:
        # A paid subject with no classes is still hers — see the docx twin (app. 04 E2).
        if not (s.get("grades") or []):
            prows += (f'<tr><td class="t-left">{_esc(s.get("name"))}</td>'
                      f'<td>—</td><td>—</td></tr>')
        for g in s.get("grades") or []:
            secs = ", ".join(x.get("tag", "") for x in (g.get("sections") or [])) or "—"
            prows += (f'<tr><td class="t-left">{_esc(s.get("name"))}</td>'
                      f'<td>{_esc(_class_of(g.get("grade")))}</td>'
                      f'<td>{_esc(secs)}</td></tr>')
    profile_html = (
        f'<table class="d-table"><thead><tr><th class="t-left">Subject</th>'
        f'<th>Class</th><th>Sections</th></tr></thead><tbody>{prows}</tbody></table>'
        if prows else '<p class="empty">No teaching profile on record.</p>')

    # ── per year ──
    years_html = ""
    for yr in payload.get("years") or []:
        notes = yr.get("notes") or {}
        notes_html = ""
        for n_i, key in enumerate(sorted(notes), start=1):
            n = notes[key]
            subj, grade, chapter = (key.split("/") + ["", "", ""])[:3]
            title = n.get("chapter_title") or ""
            head = (f"{n_i}.  {_subj(subj)} · Class {_class_of(grade)} · "
                    f"Chapter {chapter}" + (f" — {title}" if title else ""))
            edited = (f'<p class="note-edited">Last edited {_esc(str(n["updated_at"])[:10])}</p>'
                      if n.get("updated_at") else "")
            notes_html += (f'<div class="note-block"><p class="note-head">{_esc(head)}</p>'
                           f'<p class="note-text">{_esc(n.get("text"))}</p>{edited}</div>')
        if not notes_html:
            notes_html = '<p class="empty">No notes this year.</p>'

        trows = ""
        for i, row in enumerate(yr.get("teaching") or [], start=1):
            num = row.get("chapter_number")
            title = row.get("chapter_title") or ""
            chap = (f"Ch. {num}" if num else "—") + (f" — {title}" if title else "")
            secs = ", ".join(s["tag"] for s in row.get("sections") or [])
            status = " · ".join(f'{s["tag"]}: {s["status"]}'
                                for s in row.get("sections") or [])
            trows += (f'<tr><td class="seq">{i}</td>'
                      f'<td class="t-left">{_esc(_subj(row.get("subject")))}</td>'
                      f'<td>{_esc(_class_of(row.get("grade")))}</td>'
                      f'<td class="t-left">{_esc(chap)}</td>'
                      f'<td>{_esc(secs)}</td>'
                      f'<td class="t-left">{_esc(status)}</td></tr>')
        teaching_html = (
            f'<table class="d-table"><thead><tr><th>No.</th><th class="t-left">Subject</th>'
            f'<th>Class</th><th class="t-left">Chapter</th><th>Sections</th>'
            f'<th class="t-left">Status</th></tr></thead><tbody>{trows}</tbody></table>'
            if trows else '<p class="empty">No teaching activity this year.</p>')

        years_html += (
            f'<div class="section-head">Academic year {_esc(yr.get("year_id"))}</div>'
            f'<div class="sub-head">Your chapter notes</div>{notes_html}'
            f'<div class="sub-head">Your teaching state</div>{teaching_html}')

    # ── messages she sent support (2026-08-27) ──
    # Rendered only when there are some, and worded exactly as the Word export words it:
    # the two formats are one payload through two renderers and must never disagree.
    support_html = ""
    for s in payload.get("support") or []:
        head = (f"{s.get('reference', '')} · "
                f"{s.get('category_label') or s.get('category') or ''}")
        support_html += (
            f'<div class="note-block"><p class="note-head">{_esc(head)}</p>'
            f'<p class="note-text">{_esc(s.get("message"))}</p>'
            + (f'<p class="note-edited">Sent {_esc(str(s.get("created_at"))[:10])}</p>'
               if s.get("created_at") else "")
            + '</div>')
    if support_html:
        support_html = ('<div class="section-head">Messages you sent us</div>'
                        '<p class="closing">Support messages you have written to Meyy, '
                        'newest first, with the reference each was given.</p>'
                        + support_html)

    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><style>{font_face_css()}
  @page {{
    size: a4 portrait; margin: 1.6cm 1.3cm 1.4cm 1.3cm;
    @frame footer {{ -pdf-frame-content: footerContent; bottom: 0.7cm; margin-left: 1.3cm; margin-right: 1.3cm; height: 0.6cm; }}
  }}
  body {{ font-family: Helvetica; font-size: 8pt; color: #1a1917; }}

  .hdr {{ width: 100%; }}
  .brand-aruvi {{ font-family: Georgia, "Times New Roman", serif; font-size: 16pt; font-weight: bold; color: #164436; }}
  .brand-dot {{ font-family: Georgia, serif; font-size: 16pt; font-style: italic; color: #b65a31; }}
  .brand-studio {{ font-size: 7pt; letter-spacing: 1.5px; color: #6b6a63; }}
  .brand-ncf {{ font-family: Georgia, serif; font-style: italic; font-size: 7.5pt; color: #6b6a63; }}
  .rep-title {{ font-family: Georgia, serif; font-size: 11pt; font-weight: bold; color: #164436; }}
  .rep-sub {{ font-size: 7pt; color: #555; }}
  .rule-tbl {{ width: 100%; margin-top: 10px; margin-bottom: 12px; }}
  .rule-tbl td {{ border-bottom: 2px solid #1a1917; font-size: 1pt; line-height: 1pt; }}

  .purpose {{ font-family: Georgia, serif; font-style: italic; font-size: 8.5pt; color: #333;
              margin-bottom: 12px; }}

  .section-head {{ font-family: Georgia, serif; font-size: 10.5pt; font-weight: bold; color: #1a1917;
                   border-bottom: 1.25px solid #1a1917; padding-bottom: 3px; margin-top: 14px; margin-bottom: 7px; }}
  .sub-head {{ font-family: Georgia, serif; font-size: 9pt; font-weight: bold; color: #164436;
               margin-top: 9px; margin-bottom: 4px; }}
  .empty {{ font-size: 7.5pt; color: #aaa; font-style: italic; }}

  .kv-table {{ width: 100%; margin-bottom: 4px; }}
  .kv-k {{ width: 3.2cm; font-size: 7.5pt; color: #888; padding: 3px 6px; border-bottom: 0.5px solid #efefef; }}
  .kv-v {{ font-size: 8pt; color: #1a1917; padding: 3px 6px; border-bottom: 0.5px solid #efefef; }}

  .d-table {{ width: 100%; }}
  .d-table th {{ font-size: 6.5pt; color: #888; font-weight: normal; text-transform: uppercase;
                 letter-spacing: 0.5px; text-align: center; padding: 4px 6px;
                 border-top: 0.75px solid #cccccc; border-bottom: 0.75px solid #dddddd; }}
  .d-table td {{ font-size: 8pt; color: #2a2a2a; padding: 4px 6px; text-align: center;
                 border-bottom: 0.5px solid #efefef; }}
  .d-table .t-left, .d-table th.t-left {{ text-align: left; }}
  .seq {{ color: #888; font-size: 7pt; }}

  .note-block {{ margin-bottom: 8px; }}
  .note-head {{ font-family: Georgia, serif; font-size: 8.5pt; font-weight: bold; color: #1a1917;
                margin-bottom: 2px; }}
  .note-text {{ font-size: 8pt; color: #333; }}
  .note-edited {{ font-size: 6.5pt; color: #aaa; font-style: italic; margin-top: 1px; }}

  .closing {{ font-size: 7.5pt; color: #666; font-style: italic; margin-top: 6px; }}
  .footer-line {{ font-size: 6pt; color: #bbb; }}
</style></head>
<body>
  <table class="hdr"><tr>
    <td>{brand.pdf_img_html(16)}<br/>
      <span class="brand-studio">LESSON STUDIO</span></td>
    <td align="right"><span class="rep-title">Your data export</span><br/>
        <span class="rep-sub">{_esc(who)} · {_esc(date_long(when))}</span></td>
  </tr></table>
  <table class="rule-tbl"><tr><td></td></tr></table>

  <p class="purpose">Everything you create in Meyy belongs to you — your notes, your
  teaching profile, your progress through the year. This document is a complete copy of
  all of it, in one place, so your work is always yours to keep, carry and continue —
  with Meyy or without it.</p>

  <div class="section-head">Your account</div>
  {acct_html}

  <div class="section-head">Your teaching profile</div>
  {profile_html}

  {years_html}

  {support_html}

  <div class="section-head">About lesson plan content</div>
  <p class="closing">Lesson plans and assessments themselves are Meyy's shared library
  content and are not personal data; export them any time as PDFs from the app. If you
  are considering deleting your Meyy account, we suggest you export this document first
  and keep it safely: when an account is deleted, Meyy removes all personal data
  relating to your activity within a short period of time, and it cannot be recovered
  afterwards.</p>

  <div id="footerContent" class="footer-line">Meyy · Your data export · Confidential</div>
</body></html>"""


def export_data_rights_pdf(payload: Dict[str, Any]) -> bytes:
    """Render the export to PDF bytes via xhtml2pdf (pure-Python, no system libs)."""
    from io import BytesIO
    from xhtml2pdf import pisa
    buf = BytesIO()
    result = pisa.CreatePDF(render_pdf_html(payload), dest=buf, encoding="utf-8")
    if result.err:
        raise RuntimeError(f"xhtml2pdf failed with {result.err} error(s)")
    return buf.getvalue()
