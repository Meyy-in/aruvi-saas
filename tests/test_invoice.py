"""
Tests for invoicing (2026-08-26): a purchase produces a numbered invoice, stored under
her account, attached to the confirmation mail and downloadable from the subscription
page.

The properties worth pinning are the ones that are expensive to discover later: the
number series must be gapless and per financial year, the stored PDF must be the bytes
that were sent (never a re-render), one teacher must not reach another's invoice, and a
failure to render must not cost her the subscription she paid for.

Run standalone:  python3 tests/test_invoice.py     (also pytest-compatible)
"""
from __future__ import annotations

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_TMP_STATE = tempfile.mkdtemp(prefix="aruvi-test-invoice-")
os.environ.setdefault("ARUVI_STATE_DIR", _TMP_STATE)

from aruvi_core.ports import Invoice, InvoiceLine  # noqa: E402
from aruvi_core.adapters.invoice_repository_file import InvoiceRepositoryFileImpl  # noqa: E402

# ★ The checkout gate now needs a signature (2026-08-27) — the agreement's six ticks are
# taken before the subject cart. Imported, not re-derived: the tick ids belong to the
# document.
from tests.test_consent import accept_current  # noqa: E402


def _sample(number="MEY/2026-27/7834") -> Invoice:
    return Invoice(
        number=number, issued_at="2026-08-26T10:30:00+00:00",
        tenant_id="T1", user_id="T1", bill_to_name="Kumar R",
        bill_to_email="k@example.com", bill_to_phone="1000000000",
        lines=[InvoiceLine("science/middle", "Science · Middle — Classes 6, 7 and 8",
                           1, 500, "2026-08-26", "2027-08-26")],
        subtotal=500, tax_amount=0, tax_note="No tax charged — Meyy (OPC) Private Limited is not registered for GST.",
        seller_name="Meyy (OPC) Private Limited",
        total=500, amount_paid=500, payment_method="Recorded manually")


def test_repo_roundtrip_series_and_isolation():
    with tempfile.TemporaryDirectory() as tmp:
        repo = InvoiceRepositoryFileImpl(tmp)
        # Gapless, 4-digit, per financial year — and each year OPENS at `start`, not at
        # 1 (founder, 2026-08-26): a customer can read volume off an invoice number, and
        # "0001" announces that she is the first sale ever made. An offset, not a
        # fiction — the series still counts real invoices, one per purchase.
        assert [repo.next_number("2026-27") for _ in range(3)] == [
            "MEY/2026-27/7834", "MEY/2026-27/7835", "MEY/2026-27/7836"]
        assert repo.next_number("2027-28") == "MEY/2027-28/7834"

        repo.save("T1", "T1", _sample(), b"%PDF-fake")
        got = repo.load_all("T1", "T1")
        assert len(got) == 1 and got[0].number == "MEY/2026-27/7834"
        assert got[0].lines[0].valid_until == "2027-08-26", "lines survive the roundtrip"
        assert repo.load_pdf("T1", "T1", "MEY/2026-27/7834") == b"%PDF-fake"
        # Another teacher sees nothing of hers.
        assert repo.load_all("T2", "T2") == []
        assert repo.load_pdf("T2", "T2", "MEY/2026-27/7834") is None
        # Newest first.
        second = _sample("MEY/2026-27/7835")
        second.issued_at = "2026-09-01T09:00:00+00:00"
        repo.save("T1", "T1", second, b"%PDF-2")
        assert [i.number for i in repo.load_all("T1", "T1")] == [
            "MEY/2026-27/7835", "MEY/2026-27/7834"]
        print("✓ Invoice repo: gapless FY series, roundtrip, newest-first, isolated")


def test_series_survives_an_erase():
    """The counter lives OUTSIDE any tenant folder on purpose: an erase walks a
    teacher's tree, and a series stored inside one would take the seller's books with
    it — the next invoice would reuse a number already issued to someone else."""
    with tempfile.TemporaryDirectory() as tmp:
        repo = InvoiceRepositoryFileImpl(tmp)
        repo.next_number("2026-27")
        import shutil
        from pathlib import Path
        repo.save("T1", "T1", _sample(), b"%PDF")
        shutil.rmtree(Path(tmp) / "invoices" / "T1")        # she erases her account
        assert repo.next_number("2026-27") == "MEY/2026-27/7835", "numbers never rewind"
        print("✓ The number series outlives the teacher who triggered it")


def test_classes_come_from_the_content_not_a_constant():
    """★ Founder, 2026-08-26: an invoice may not say "Class 10 coming soon".

    A promise about next year has no place on a document of record — and the answer is
    per SUBJECT, not per stage: Class 10 will land for one subject before another, and a
    stage-wide constant would then be wrong for both. So the classes are derived from
    the grades the subject is actually authored for. This test is the guard against
    someone reintroducing a constant: it asserts the DERIVATION, not the values, by
    checking that a subject with only class 9 authored says exactly "Class 9".
    """
    from api.main import _scope_classes
    from api import data
    assert _scope_classes("science/middle") == "Classes 6, 7 and 8"
    assert "coming soon" not in _scope_classes("science/secondary")
    # Secondary today = whatever is authored. If class 10 ever appears for a subject,
    # this line changes by itself — which is the whole point.
    offered = set(data.list_grades("science"))
    expected = "Classes 9 and 10" if {"ix", "x"} <= offered else "Class 9"
    assert _scope_classes("science/secondary") == expected
    assert _scope_classes("*") == "" and _scope_classes("") == ""
    print("✓ Invoice classes are derived per subject, never a stage-wide constant")


def test_financial_year_boundary():
    from api.main import _financial_year
    from datetime import date
    assert _financial_year(date(2026, 8, 26)) == "2026-27"
    assert _financial_year(date(2027, 3, 31)) == "2026-27", "March is still last FY"
    assert _financial_year(date(2027, 4, 1)) == "2027-28", "April opens the new one"
    print("✓ Financial year runs April→March")


def test_pdf_renders_the_facts():
    from aruvi_core.export_invoice_pdf import export_invoice_pdf, rupees
    assert rupees(500) == "500" and rupees(100000) == "1,00,000", "Indian grouping"
    pdf = export_invoice_pdf(_sample())
    assert pdf[:4] == b"%PDF" and len(pdf) > 1000
    print("✓ Invoice PDF renders")


def test_checkout_issues_stores_attaches_and_serves():
    from fastapi.testclient import TestClient
    from api import main as api_main

    c = TestClient(api_main.app, raise_server_exceptions=False)
    H = {"X-Aruvi-User": "InvoiceTeacher"}
    body = {"scopes": ["science/middle", "science/secondary"], "name": "Kumar R",
            "email": "invoice-test@example.com", "role": "Teacher", "state": "Kerala",
            "city": "Kochi", "school": "KV"}
    accept_current(c, H)          # the agreement gate (2026-08-27)
    r = c.post("/onboarding/checkout", headers=H, json=body).json()
    assert r["invoice_number"].startswith("MEY/"), r
    assert r["amount_inr"] == 2 * api_main.config.PRICE_PER_SUBJECT_STAGE

    listed = c.get("/invoices", headers=H).json()["invoices"]
    assert len(listed) == 1
    inv = listed[0]
    assert inv["total"] == 2 * api_main.config.PRICE_PER_SUBJECT_STAGE and inv["has_pdf"] is True
    assert set(inv["scopes"]) == {"science/middle", "science/secondary"}
    assert all(ln["valid_until"] for ln in inv["lines"]), "each line carries its own end"

    dl = c.get(f"/invoices/{inv['number']}", headers=H)
    assert dl.status_code == 200 and dl.content[:4] == b"%PDF"
    assert "attachment" in dl.headers.get("content-disposition", "")
    # The download is the STORED file, byte for byte — not a re-render.
    stored = api_main.invoice_repo.load_pdf("InvoiceTeacher", "InvoiceTeacher", inv["number"])
    assert dl.content == stored

    # Another teacher cannot reach it, even knowing the number.
    assert c.get(f"/invoices/{inv['number']}",
                 headers={"X-Aruvi-User": "Nosy"}).status_code == 404

    # A SECOND purchase issues its OWN invoice for just that purchase.
    r2 = c.post("/onboarding/checkout", headers=H,
                json=dict(body, scopes=["english/middle"])).json()
    assert r2["invoice_number"] != r["invoice_number"]
    listed = c.get("/invoices", headers=H).json()["invoices"]
    P = api_main.config.PRICE_PER_SUBJECT_STAGE
    assert [i["total"] for i in listed] == [P, 2 * P], "newest first, this purchase only"
    print("✓ Checkout issues, stores and serves an invoice per purchase")


def test_mail_carries_the_invoice():
    """The PDF is attached AND the number is in the body — a transport that strips
    attachments must still deliver a complete message."""
    from api import main as api_main, mail_templates
    body = mail_templates.subscription_confirmation(
        name="Kumar", scopes=["science/middle"], amount_inr=500,
        valid_until="2027-08-26", mobile="1000000000",
        scope_valid_until={"science/middle": "2027-08-26"},
        added=["science/middle"], invoice_number="MEY/2026-27/0007")
    assert "MEY/2026-27/0007" in body["text"]
    assert "invoice is attached" in body["text"]

    sent = {}
    real = api_main.notifier.send

    def spy(msg):
        sent["msg"] = msg
        return real(msg)

    api_main.notifier.send = spy
    try:
        from aruvi_core.export_invoice_pdf import export_invoice_pdf
        inv = _sample()
        api_main._send_subscription_confirmation(
            to="mailtest@example.com", name="Kumar", scopes=["science/middle"],
            amount_inr=500, valid_until="2027-08-26", mobile="1000000000",
            scope_valid_until={"science/middle": "2027-08-26"}, added=["science/middle"],
            invoice=inv, invoice_pdf=export_invoice_pdf(inv))
    finally:
        api_main.notifier.send = real
    msg = sent["msg"]
    assert len(msg.attachments) == 1
    att = msg.attachments[0]
    assert att.filename == "Meyy-invoice-MEY-2026-27-7834.pdf"
    assert att.mime_type == "application/pdf" and att.content[:4] == b"%PDF"
    assert inv.number in msg.text
    print("✓ The confirmation mail carries the PDF and names the number in the body")


def test_render_failure_does_not_cost_the_subscription():
    """An invoice is a document ABOUT a purchase; it must never be able to undo one."""
    from fastapi.testclient import TestClient
    from api import main as api_main

    c = TestClient(api_main.app, raise_server_exceptions=False)
    H = {"X-Aruvi-User": "BrokenPdfTeacher"}
    real = api_main._build_invoice

    def boom(*a, **k):
        raise RuntimeError("no fonts today")

    accept_current(c, H)          # the agreement gate (2026-08-27)
    api_main._build_invoice = boom
    try:
        r = c.post("/onboarding/checkout", headers=H, json={
            "scopes": ["science/middle"], "name": "P", "email": "", "role": "Teacher",
            "state": "Kerala", "city": "Kochi", "school": ""})
    finally:
        api_main._build_invoice = real
    assert r.status_code == 200 and r.json()["status"] == "active"
    assert r.json()["invoice_number"] == "", "no invoice, but the subscription stands"
    assert api_main.entitlement_repo.load("BrokenPdfTeacher").scopes == ["science/middle"]
    print("✓ A failed invoice never costs her the subscription")


if __name__ == "__main__":
    test_repo_roundtrip_series_and_isolation()
    test_series_survives_an_erase()
    test_classes_come_from_the_content_not_a_constant()
    test_financial_year_boundary()
    test_pdf_renders_the_facts()
    test_checkout_issues_stores_attaches_and_serves()
    test_mail_carries_the_invoice()
    test_render_failure_does_not_cost_the_subscription()
    print("\n✅ All invoice tests passed!")
