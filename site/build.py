#!/usr/bin/env python3
"""The public website — www.meyy.in (2026-10-07).

    python3 site/build.py            → writes site/out/ (a plain static site, no JavaScript)

WHAT THIS IS. Meyy has two front doors (docs/going_live.md §2): www.meyy.in, the shop window —
what Meyy is, the price, and the policy pages Razorpay and the app stores require — and
app.meyy.in, the teacher's app (the Next.js export in web/). This script builds the first.
Nobody signs in here; every "Start free" / "Sign in" button leads to app.meyy.in.

★ ONE COPY OF EVERY LEGAL WORD. The Privacy Notice and the User Agreement are NOT retyped:
they are read through api/legal.py — the same loader the app's Settings › Legal and the API's
GET /privacy use — and rendered with api/public_pages.markdown_to_html. Publishing
privacy_policy_v1.1.md (or a new agreement) and rebuilding updates the website with no edit
here. The Refunds page quotes the agreement's §D the same way, and the Contact page takes the
registered office from the notice's §10, so the address cannot drift between them.
tests/test_public_site.py pins all of it.

★ STDLIB ONLY, ON PURPOSE. Cloudflare Pages runs this as the build command
(`python3 site/build.py`, output `site/out`); api.legal / api.config / aruvi_core.brand import
nothing outside the standard library, so the build needs no `pip install`.

The pages' own words (home, pricing, refunds & cancellation, shipping & delivery, contact) are
in site/content/. They carry {{tokens}} for every fact the product already states somewhere
else (price, renewal window, support address, WhatsApp number, seller name, registered
office) — an unknown token FAILS the build rather than shipping "{{price}}" to a reviewer.
"""
from __future__ import annotations

import html
import os
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from api import config, legal, public_pages  # noqa: E402
from aruvi_core import brand  # noqa: E402

SITE = ROOT / "site"
CONTENT = SITE / "content"
OUT = Path(os.environ.get("MEYY_SITE_OUT", SITE / "out"))

SITE_URL = "https://www.meyy.in"
APP_URL = (os.environ.get("MEYY_APP_URL", "").strip() or "https://app.meyy.in").rstrip("/")

# The footer, in this order, on every page. Razorpay's activation check looks for exactly
# these: Pricing · Terms · Privacy · Cancellation & Refunds · Shipping · Contact.
FOOTER = [
    ("Home", "/"),
    ("Pricing", "/pricing/"),
    ("Terms", "/terms/"),
    ("Privacy", "/privacy/"),
    ("Refunds & cancellation", "/refunds/"),
    ("Shipping & delivery", "/shipping/"),
    ("Contact", "/contact/"),
]


class BuildError(RuntimeError):
    pass


# ── Facts read from where the product already states them ────────────────────────

def _section(body: str, head_re: str) -> str:
    """The text of the '## …' section whose heading matches head_re, up to the next '## '."""
    m = re.search(rf"^##\s+{head_re}.*?$\n(.*?)(?=^##\s|\Z)", body, re.S | re.M)
    if not m:
        raise BuildError(f"Section matching {head_re!r} not found.")
    return m.group(1).strip()


def registered_office(privacy_body: str) -> str:
    """The registered office as the Privacy Notice §10 prints it, on one line."""
    sec = _section(privacy_body, r"10\.")
    lines = sec.splitlines()
    try:
        i = next(i for i, ln in enumerate(lines) if "Grievance Officer" in ln)
    except StopIteration:
        raise BuildError("Privacy Notice §10 no longer names the Grievance Officer.")
    addr = []
    for ln in lines[i + 1:]:
        s = ln.strip()
        if not s or s.startswith("Email"):
            break
        addr.append(s.rstrip(","))
    if not addr:
        raise BuildError("No registered office found under Privacy Notice §10.")
    return ", ".join(addr)


def refunds_section(agreement_body: str) -> str:
    """The User Agreement's §D, verbatim (markdown)."""
    return _section(agreement_body, r"D\.\s*Refunds")


def agreement_published(version: str) -> str:
    """The date in the agreement file's own footer ('*Version 1.1 · 2026-10-07*')."""
    dates = re.findall(r"\d{4}-\d{2}-\d{2}", legal._read(version).strip().splitlines()[-1])
    return dates[-1] if dates else ""


def whatsapp_display(n: str) -> str:
    n = re.sub(r"\D", "", n)
    if len(n) == 12 and n.startswith("91"):
        return f"+91 {n[2:7]} {n[7:]}"
    return "+" + n


def facts() -> dict:
    privacy = legal.load_privacy_document()
    consent = legal.load_consent_document()
    return {
        "price": f"{config.PRICE_PER_SUBJECT_STAGE:,}",
        "renew_days": str(config.RENEW_WINDOW_DAYS),
        "support_email": config.SUPPORT_ADDRESS,
        "seller": config.SELLER_NAME,
        "whatsapp_display": whatsapp_display(config.WHATSAPP_NUMBER),
        "whatsapp_link": "https://wa.me/" + re.sub(r"\D", "", config.WHATSAPP_NUMBER),
        "registered_office": registered_office(privacy["body"]),
        "refunds_section": refunds_section(consent["agreement"]),
        "app_start": APP_URL + "/?start",
        "app_signin": APP_URL + "/?signin",
        "year": "2026",
    }


def fill(text: str, f: dict) -> str:
    def sub(m):
        k = m.group(1)
        if k not in f:
            raise BuildError(f"Unknown token {{{{{k}}}}} in site content.")
        return f[k]
    return re.sub(r"\{\{\s*([a-z_]+)\s*\}\}", sub, text)


# ── The page shell ───────────────────────────────────────────────────────────────

def mark_svg() -> str:
    return brand.wordmark_svg()


def shell(*, path: str, title: str, body: str, description: str, kind: str, f: dict) -> str:
    page_title = "Meyy — lesson plans for teachers" if path == "/" else f"{title} — Meyy"
    foot = " ".join(f'<a href="{href}">{html.escape(label)}</a>' for label, href in FOOTER)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(page_title)}</title>
<meta name="description" content="{html.escape(description)}">
<link rel="canonical" href="{SITE_URL}{path}">
<meta property="og:title" content="{html.escape(page_title)}">
<meta property="og:description" content="{html.escape(description)}">
<meta property="og:url" content="{SITE_URL}{path}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#1e5c4a">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400&family=IBM+Plex+Mono:wght@500&display=swap">
<link rel="stylesheet" href="/site.css">
</head>
<body class="{kind}">
<header class="bar">
  <div class="wrap bar-in">
    <a class="mark" href="/" aria-label="Meyy home">{mark_svg()}</a>
    <nav class="top-nav">
      <a href="/pricing/">Pricing</a>
      <a href="{f['app_signin']}">Sign in</a>
      <a class="btn small" href="{f['app_start']}">Start free</a>
    </nav>
  </div>
</header>
<main>
{body}
</main>
<footer class="foot">
  <div class="wrap">
    <nav class="foot-nav">{foot}</nav>
    <p>© {f['year']} {html.escape(f['seller'])}</p>
  </div>
</footer>
</body>
</html>
"""


def doc_body(title: str, stamp: str, inner_html: str, kicker: str = "") -> str:
    # ★ An explicit way home on every inner page (founder, 2026-10-07: on a phone the only way
    # back was the hardware back button — the wordmark is a link, but nothing says so). A plain
    # "← Home" at the top (the footer's first link is Home too).
    k = f'<div class="kicker">{html.escape(kicker)}</div>' if kicker else ""
    s = f'<div class="stamp">{html.escape(stamp)}</div>' if stamp else ""
    back = '<a class="back" href="/">&larr; Home</a>'
    return f'<article class="wrap doc">{back}{k}<h1>{html.escape(title)}</h1>{s}\n{inner_html}\n</article>'


# ── Pages ────────────────────────────────────────────────────────────────────────

def page_from_markdown(name: str, f: dict) -> str:
    return public_pages.markdown_to_html(fill((CONTENT / name).read_text(encoding="utf-8"), f))


def terms_html(f: dict) -> str:
    c = legal.load_consent_document()
    parts = [public_pages.markdown_to_html(c["intro"])]
    parts.append("<h2>The five points you confirm</h2>")
    for a in c["acknowledgements"]:
        parts.append(f"<h3>{a['n']}. {public_pages._inline(a['title'])}</h3>")
        parts.append(public_pages.markdown_to_html(a["body"]))
    parts.append("<hr>")
    parts.append("<h2>Full User Agreement</h2>")
    parts.append(public_pages.markdown_to_html(c["agreement"]))
    parts.append("<h2>Accepting this agreement</h2>")
    parts.append("<p>When you subscribe, the app asks you to confirm the five points above and "
                 "then to tick: <em>“" + html.escape(c["final"]["text"]) + "”</em></p>")
    stamp = " · ".join(x for x in (
        f["seller"], f"Version {c['version']}", agreement_published(c["version"])) if x)
    return doc_body("User Agreement", stamp, "\n".join(parts), kicker="Terms")


def privacy_html(f: dict) -> str:
    d = legal.load_privacy_document()
    stamp = " · ".join(x for x in (f["seller"], f"Version {d['version']}", d.get("published")) if x)
    return doc_body(d["title"], stamp, public_pages.markdown_to_html(d["body"]), kicker="Privacy")


PAGES = [
    # path, title, kind, description
    ("/", "Meyy", "home",
     "Meyy prepares NCF-aligned lesson plans and assessments for Indian teachers, chapter by "
     "chapter, for Classes 3 to 9. Try any 3 chapters free."),
    ("/pricing/", "Pricing", "doc-page",
     "Free to try for any 3 chapters. Subscribe for one year per subject-stage."),
    ("/terms/", "User Agreement", "doc-page", "Meyy's User Agreement and Disclaimer."),
    ("/privacy/", "Privacy Notice", "doc-page", "How Meyy collects, uses and protects your data."),
    ("/refunds/", "Refunds & cancellation", "doc-page", "Meyy's refund and cancellation policy."),
    ("/shipping/", "Shipping & delivery", "doc-page", "How Meyy is delivered: online, at once."),
    ("/contact/", "Contact", "doc-page", "How to reach Meyy."),
]


def render(path: str, title: str, kind: str, f: dict) -> str:
    if path == "/":
        return fill((CONTENT / "home.html").read_text(encoding="utf-8"), f)
    if path == "/terms/":
        return terms_html(f)
    if path == "/privacy/":
        return privacy_html(f)
    name = path.strip("/") + ".md"
    # No company-name line under Pricing or Contact (founder, 2026-10-07): Contact names the
    # company in its Grievance Officer block, and Pricing does not need it.
    stamp = "" if path in ("/pricing/", "/contact/") else f["seller"]
    return doc_body(title, stamp, page_from_markdown(name, f))


def build(out: Path = OUT) -> list:
    f = facts()
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    written = []
    for path, title, kind, desc in PAGES:
        page = shell(path=path, title=title, body=render(path, title, kind, f),
                     description=desc, kind=kind, f=f)
        if "{{" in page:
            raise BuildError(f"Unfilled token left on {path}.")
        dest = out / path.strip("/") / "index.html" if path != "/" else out / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page, encoding="utf-8")
        written.append(path)

    nf = doc_body("Page not found", "", '<p>That page is not here. '
                  '<a href="/">Go to the Meyy home page</a>.</p>')
    (out / "404.html").write_text(
        shell(path="/404", title="Page not found", body=nf, description="Page not found.",
              kind="doc-page", f=f), encoding="utf-8")

    shutil.copyfile(SITE / "site.css", out / "site.css")
    shutil.copyfile(ROOT / "web" / "app" / "icon.png", out / "favicon.png")
    shutil.copyfile(ROOT / "web" / "app" / "apple-icon.png", out / "apple-touch-icon.png")
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n")
    urls = "".join(f"<url><loc>{SITE_URL}{p}</loc></url>" for p, *_ in PAGES)
    (out / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
    # Cloudflare Pages reads _headers. No tracking, no third-party script: the Privacy
    # Notice promises "no advertising trackers or cookies", and this site sets none.
    (out / "_headers").write_text(
        "/*\n"
        "  X-Content-Type-Options: nosniff\n"
        "  X-Frame-Options: DENY\n"
        "  Referrer-Policy: strict-origin-when-cross-origin\n"
        "  Permissions-Policy: camera=(), microphone=(), geolocation=()\n")
    return written


if __name__ == "__main__":
    try:
        pages = build()
    except (BuildError, legal.ConsentDocumentError) as exc:
        print(f"✗ site build failed: {exc}", file=sys.stderr)
        sys.exit(1)
    print(f"✓ built {len(pages)} pages into {OUT}")
    for p in pages:
        print("   ", p)
