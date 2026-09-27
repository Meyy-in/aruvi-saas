"""Public, no-sign-in HTML pages served by the API (2026-09-26).

Meta requires a PUBLIC privacy-policy URL before the WhatsApp app can go Live, and Meyy has
no website yet — so the API serves one: GET /privacy renders the CURRENT Privacy Notice (the
same markdown file the app shows in Settings › Legal, via legal.load_privacy_document) as a
plain, self-contained HTML page. One source: publishing a new privacy_policy_v*.md updates
this page with no code change.

The renderer is deliberately tiny and escapes everything first — headings, paragraphs,
lists, pipe tables, **bold**, *italic*, `code`, [links](url) and --- rules, which is all the
notice uses. "[AT LAUNCH: …]" notes are drafting notes for the founder and are removed from
the public page.
"""
from __future__ import annotations

import html
import re
from typing import List

# The note, together with any **…** / *…* wrapped round it (else "****" is left behind).
_AT_LAUNCH = re.compile(r"\s*\**\s*\[AT LAUNCH:[^\]]*\]\s*\**")


def _inline(s: str) -> str:
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![*\w])\*([^*\n]+)\*(?![*\w])", r"<em>\1</em>", s)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+|mailto:[^)\s]+)\)",
               r'<a href="\2">\1</a>', s)
    return s


def markdown_to_html(md: str) -> str:
    md = _AT_LAUNCH.sub("", md)
    out: List[str] = []
    para: List[str] = []
    lines = md.splitlines()
    i = 0

    def flush():
        if para:
            # Source lines are hard-wrapped prose: join with spaces, then format, so a
            # **bold** run that spans a wrap still closes.
            out.append("<p>" + _inline(" ".join(para)) + "</p>")
            para.clear()

    while i < len(lines):
        raw = lines[i]
        s = raw.strip()
        if not s:
            flush(); i += 1; continue
        if s == "---":
            flush(); out.append("<hr>"); i += 1; continue
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            flush()
            lvl = min(max(len(m.group(1)), 2), 4)   # the page's own <h1> is the title
            out.append(f"<h{lvl}>{_inline(m.group(2))}</h{lvl}>")
            i += 1; continue
        if s.startswith("|"):
            flush()
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                    rows.append(cells)
                i += 1
            if rows:
                head, body = rows[0], rows[1:]
                t = ["<table><thead><tr>"] + [f"<th>{_inline(c)}</th>" for c in head]
                t.append("</tr></thead><tbody>")
                for r in body:
                    t.append("<tr>" + "".join(f"<td>{_inline(c)}</td>" for c in r) + "</tr>")
                t.append("</tbody></table>")
                out.append("".join(t))
            continue
        if re.match(r"^([-*]|\d+\.)\s+", s):
            flush()
            ordered = bool(re.match(r"^\d+\.", s))
            tag = "ol" if ordered else "ul"
            items: List[str] = []
            while i < len(lines):
                t = lines[i].strip()
                mm = re.match(r"^([-*]|\d+\.)\s+(.*)$", t)
                if mm:
                    items.append(mm.group(2)); i += 1
                elif t and lines[i].startswith((" ", "\t")) and items:
                    items[-1] += " " + t; i += 1        # a wrapped continuation line
                else:
                    break
            out.append(f"<{tag}>" + "".join(f"<li>{_inline(x)}</li>" for x in items) + f"</{tag}>")
            continue
        para.append(s)
        i += 1
    flush()
    return "\n".join(out)


def privacy_page(doc: dict) -> str:
    title = html.escape(doc.get("title") or "Privacy Notice")
    version = html.escape(str(doc.get("version") or ""))
    published = html.escape(str(doc.get("published") or ""))
    body = markdown_to_html(doc.get("body") or doc.get("markdown") or "")
    stamp = " · ".join(x for x in (f"Version {version}" if version else "", published) if x)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meyy — {title}</title>
<style>
 :root {{ color-scheme: light; }}
 body {{ margin: 0; background: #f7f3ea; color: #23201b;
        font: 16px/1.6 Georgia, "Times New Roman", serif; }}
 main {{ max-width: 760px; margin: 0 auto; padding: 32px 18px 64px; }}
 .brand {{ font: 700 13px/1 ui-monospace, Menlo, monospace; letter-spacing: .14em;
          color: #2f5d50; text-transform: uppercase; }}
 h1 {{ font-size: 28px; margin: 10px 0 4px; }} h2 {{ font-size: 21px; margin-top: 34px; }}
 h3, h4 {{ font-size: 17px; margin-top: 22px; }}
 .stamp {{ color: #6b645a; font-size: 14px; margin-bottom: 24px; }}
 table {{ border-collapse: collapse; width: 100%; font-size: 14.5px; margin: 12px 0; display: block;
         overflow-x: auto; }}
 th, td {{ border: 1px solid #d9d1c2; padding: 7px 9px; text-align: left; vertical-align: top; }}
 th {{ background: #efe8da; }} hr {{ border: 0; border-top: 1px solid #d9d1c2; margin: 28px 0; }}
 a {{ color: #2f5d50; }} code {{ font-size: 90%; }}
 footer {{ margin-top: 40px; font-size: 14px; color: #6b645a; }}
</style></head>
<body><main>
<div class="brand">Meyy</div>
<h1>{title}</h1>
<div class="stamp">Meyy (OPC) Private Limited{(" · " + stamp) if stamp else ""}</div>
{body}
<footer>Questions about this notice: <a href="mailto:support@meyy.in">support@meyy.in</a></footer>
</main></body></html>"""
