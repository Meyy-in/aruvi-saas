"""
The public website — www.meyy.in (site/build.py, 2026-10-07).

Pinned here on purpose:
  * every page Razorpay's activation check asks for exists and is linked from EVERY page's
    footer (Pricing · Terms · Privacy · Cancellation & Refunds · Shipping · Contact);
  * ★ ONE COPY OF EVERY LEGAL WORD — the privacy page carries the CURRENT notice's own text,
    the terms page the current agreement's, the refunds page the agreement's §D verbatim; a
    new version file changes the site with no edit to site/;
  * the contact page's registered office is the one the Privacy Notice §10 prints, and the
    price / renewal window / support address / WhatsApp number come from api/config;
  * no {{token}} survives into a built page, and no script tag ships (the notice promises
    no advertising trackers);
  * "Start free" / "Sign in" lead to app.meyy.in's ?start / ?signin doors, which Login.jsx
    reads — the website and the app must agree on those two words.

Run standalone:  python3 tests/test_public_site.py     (also pytest-compatible)
"""
from __future__ import annotations

import html
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "site"))

from api import config, legal, public_pages  # noqa: E402
import build as site_build  # noqa: E402

_OUT = Path(tempfile.mkdtemp(prefix="meyy-site-")) / "out"
_BUILT = site_build.build(_OUT)


def _page(path: str) -> str:
    f = _OUT / ("index.html" if path == "/" else path.strip("/") + "/index.html")
    return f.read_text(encoding="utf-8")


def _text(html_s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", html_s)))


def test_every_razorpay_page_exists_and_every_footer_links_them_all():
    need = ["/about/", "/pricing/", "/terms/", "/privacy/", "/refunds/", "/shipping/", "/contact/"]
    for p in need:
        assert p in _BUILT, p
    for p in _BUILT + ["/404"]:
        page = (_OUT / "404.html").read_text() if p == "/404" else _page(p)
        foot = page.split('<footer class="foot">', 1)[1]
        for href in need:
            assert f'href="{href}"' in foot, (p, href)
    print("✓ About + the six policy pages exist and every footer links all seven")


def test_privacy_page_is_the_current_notice_word_for_word():
    d = legal.load_privacy_document()
    page = _page("/privacy/")
    assert public_pages.markdown_to_html(d["body"]) in page
    assert f"Version {d['version']}" in page
    print(f"✓ /privacy/ carries Privacy Notice v{d['version']} verbatim")


def test_terms_page_is_the_current_agreement():
    c = legal.load_consent_document()
    page = _page("/terms/")
    assert public_pages.markdown_to_html(c["agreement"]) in page
    for a in c["acknowledgements"]:
        assert public_pages.markdown_to_html(a["body"]) in page, a["id"]
    assert f"Version {c['version']}" in page
    print(f"✓ /terms/ carries User Agreement v{c['version']}: five points + full body")


def test_refunds_page_quotes_agreement_section_D():
    c = legal.load_consent_document()
    d = site_build.refunds_section(c["agreement"])
    assert "Refunds are considered" in d          # the section really is §D
    assert public_pages.markdown_to_html(d) in _page("/refunds/")
    print("✓ /refunds/ quotes the agreement's §D verbatim")


def test_contact_address_is_the_privacy_notices_registered_office():
    addr = site_build.registered_office(legal.load_privacy_document()["body"])
    assert "Nanganallur" in addr and "600061" in addr
    assert addr in _text(_page("/contact/"))
    assert config.SUPPORT_ADDRESS in _page("/contact/")
    assert "wa.me/" + config.WHATSAPP_NUMBER in _page("/contact/")
    print("✓ /contact/ shows the notice's §10 address, support address and WhatsApp")


def test_price_and_renewal_window_come_from_config():
    price = f"₹{config.PRICE_PER_SUBJECT_STAGE:,}"
    assert price in _text(_page("/pricing/")) and price in _text(_page("/"))
    assert f"last {config.RENEW_WINDOW_DAYS} days" in _text(_page("/pricing/"))
    print(f"✓ {price} and the {config.RENEW_WINDOW_DAYS}-day renewal window come from config")


def test_no_token_survives_and_no_script_ships():
    for f in _OUT.rglob("*.html"):
        s = f.read_text(encoding="utf-8")
        assert "{{" not in s and "}}" not in s, f
        assert "<script" not in s.lower(), f
    print("✓ No unfilled token and no <script> on any page")


def test_unknown_token_fails_the_build():
    try:
        site_build.fill("Hello {{nope}}", {"price": "1"})
    except site_build.BuildError:
        print("✓ An unknown token fails the build")
        return
    raise AssertionError("an unknown token was silently accepted")


def test_buttons_use_the_doors_login_reads():
    home = _page("/")
    assert 'href="https://app.meyy.in/?start"' in home
    assert 'href="https://app.meyy.in/?signin"' in home
    login = (ROOT / "web/app/components/Login.jsx").read_text(encoding="utf-8")
    assert 'q.has("start")' in login and 'q.has("signin")' in login
    print("✓ Start free / Sign in point at ?start / ?signin, which Login.jsx reads")


def test_web_app_is_a_static_export_in_both_configs():
    for name in ("next.config.mjs", "next.config.build-check.mjs"):
        s = (ROOT / "web" / name).read_text(encoding="utf-8")
        assert re.search(r'output:\s*"export"', s), name
    print("✓ Both Next configs build a static export")


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
    print("\n✅ All public-site tests passed!")
