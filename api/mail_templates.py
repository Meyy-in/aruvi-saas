"""The words Aruvi sends. Kept OUT of api/main.py so copy can be edited without
touching routing, and out of the adapters so the transport never owns the message.

House voice (CLAUDE.md §4): plain, warm, specific. No exclamation marks, no marketing
padding, no "certified" — Aruvi is NCF *aligned*. Amounts in ₹, dates as dd-Mmm-yyyy,
and scopes spelled the way the teacher bought them ("Social Sciences · Middle").
"""
from __future__ import annotations

import html as _html

from aruvi_core import brand   # the MEYY wordmark, inline by cid (2026-09-03); the lockup is
                                # STACKED — mark, LESSON STUDIO beneath, no NCF line — as the web bar
                                # and every export are (founder, same day)
from datetime import date
from typing import Dict, List, Tuple

# Classes a stage covers, for the line that tells her what her subscription reaches.
_STAGE_CLASSES = {
    "preparatory": "Classes 3, 4 and 5",
    "middle": "Classes 6, 7 and 8",
    "secondary": "Class 9 (Class 10 coming soon)",
}


def _pretty_subject(slug: str) -> str:
    """social_sciences → Social Sciences; the_world_around_us → The World Around Us."""
    words = str(slug or "").replace("-", " ").replace("_", " ").split()
    small = {"the", "of", "and", "around", "us"}
    out = []
    for i, w in enumerate(words):
        out.append(w.capitalize() if (i == 0 or w.lower() not in small) else w.lower())
    return " ".join(out) or slug


def fmt_date(iso: str) -> str:
    """2027-08-26 → 26-Aug-2027. Falls back to the raw string if it isn't a date."""
    try:
        return date.fromisoformat(str(iso)).strftime("%d-%b-%Y")
    except Exception:                                # noqa: BLE001
        return str(iso or "")


_fmt_date = fmt_date        # the name this module used before it had callers outside


def scope_line_text(scope: str) -> str:
    """"Science · Middle — Classes 6, 7 and 8" — one string, for an invoice line."""
    rows = scope_lines([scope])
    if not rows:
        return str(scope)
    label, classes = rows[0]
    return f"{label} — {classes}" if classes else label


def scope_label(scope: str) -> str:
    """"social_sciences/middle" → "Social Sciences · Middle". Public because the API's
    402 wording must name a scope exactly as the mail and the Settings ledger do."""
    rows = scope_lines([scope])
    return rows[0][0] if rows else str(scope)


def scope_lines(scopes: List[str]) -> List[Tuple[str, str]]:
    """[(label, classes)] for each purchased "subject/stage" scope. "*" = everything."""
    rows = []
    for s in scopes or []:
        if s == "*":
            rows.append(("All subjects · All stages", "Classes 3 to 10"))
            continue
        subject, _, stage = str(s).partition("/")
        rows.append((f"{_pretty_subject(subject)} · {stage.capitalize()}",
                     _STAGE_CLASSES.get(stage.lower(), "")))
    return rows


def _scope_block(scope_list: List[str], svu: Dict[str, str], *, dates: bool) -> str:
    """The bulleted "• Subject · Stage — Classes …" block, optionally with each row's
    own validity. `dates=True` wherever a row's date can differ from its neighbours'."""
    out = []
    for (label, classes), scope in zip(scope_lines(scope_list), scope_list):
        line = f"  • {label}" + (f" — {classes}" if classes else "")
        if dates and svu.get(scope):
            line += f" — valid to {fmt_date(svu[scope])}"
        out.append(line)
    return "\n".join(out)


def _rupees(n: int) -> str:
    """Indian digit grouping — 1,00,000, not 100,000. Same rule as the invoice PDF."""
    s = str(abs(int(n)))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    return s


# ── HTML mail (2026-08-26) ─────────────────────────────────────────────────────
# Written for MAIL CLIENTS, not for browsers, which is a different and older craft:
# tables for layout (Outlook has no flexbox or grid), every style INLINE (Gmail strips
# <style> blocks in some views), no web fonts (Georgia and Helvetica are the two faces
# that exist everywhere, and they happen to be exactly the house pairing), no background
# images, and a width of 600px because that is what narrow desktop panes assume.
#
# The plain-text part is not a fallback nobody reads — it is the message. Every fact in
# the HTML is in the text, so a client that refuses HTML loses styling and nothing else.
_PINE = "#164436"
_CLAY = "#b65a31"
_INK = "#1a1917"
_SOFT = "#6b6a63"
_PAPER = "#faf7f0"
_KRAFT = "#efe9dc"      # kept: the one tint available if a band is ever wanted again
_LINE = "#e3ddd0"


def _html_rows(scope_list: List[str], svu: Dict[str, str], *, dates: bool,
               amount_each: int = 0) -> str:
    out = []
    for (label, classes), scope in zip(scope_lines(scope_list), scope_list):
        right = (f"&#8377;{_rupees(amount_each)}" if amount_each
                 else (f"valid to {_html.escape(fmt_date(svu[scope]))}"
                       if dates and svu.get(scope) else ""))
        out.append(
            f'<tr>'
            f'<td style="padding:10px 0;border-bottom:1px solid {_LINE};'
            f'font-family:Georgia,serif;font-size:15px;color:{_INK};">'
            f'{_html.escape(label)}'
            + (f'<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;'
               f'color:{_SOFT};padding-top:3px;">{_html.escape(classes)}</div>'
               if classes else "")
            + f'</td>'
            f'<td align="right" style="padding:10px 0;border-bottom:1px solid {_LINE};'
            f'font-family:Helvetica,Arial,sans-serif;font-size:13px;color:{_SOFT};'
            f'white-space:nowrap;">{right}</td>'
            f'</tr>')
    return "".join(out)


def _html_body(*, hello: str, headline: str, new: List[str], also: List[str],
               held: List[str], svu: Dict[str, str], amount_inr: int, unit_amount: int,
               valid_until: str, mobile: str, invoice_number: str,
               has_attachment: bool) -> str:
    kv = (f'<tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:12px;'
          f'color:{_SOFT};padding:4px 0;width:110px;">{{k}}</td>'
          f'<td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;'
          f'color:{_INK};padding:4px 0;">{{v}}</td></tr>')
    meta = kv.format(k="Amount", v=f"&#8377;{_rupees(amount_inr)} for the year")
    if valid_until:
        meta += kv.format(k="Valid to", v=_html.escape(fmt_date(valid_until)))
    meta += kv.format(k="Sign in", v=_html.escape(mobile))
    if invoice_number:
        meta += kv.format(k="Invoice", v=_html.escape(invoice_number))

    holding_block = ""
    if also:
        holding_block = f"""
      <tr><td style="padding:26px 0 0;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;
             letter-spacing:1.2px;text-transform:uppercase;color:{_PINE};
             padding-bottom:6px;">Everything you have with Meyy now</div>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          {_html_rows(held, svu, dates=True)}
        </table>
      </td></tr>"""

    attach_line = ("Your invoice is attached to this email, and every invoice stays on "
                   "your Subscription page in Settings."
                   if has_attachment and invoice_number else
                   ("Your invoice is on your Subscription page in Settings."
                    if invoice_number else ""))

    # ★ NO BIG "AMOUNT PAID" BAND (founder, 2026-08-26) — struck from the invoice first,
    #   then from here. This mail's job is to say WHAT is now hers and for how long; the
    #   amount is one line of the ledger, not the headline. The document about the money
    #   is the invoice, and it travels attached.
    #   Written as a PYTHON comment, not an HTML one: an HTML comment would ship inside
    #   every teacher's email, where a note to ourselves has no business.
    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:{_PAPER};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:{_PAPER};padding:28px 12px;">
 <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" role="presentation"
         style="max-width:600px;width:100%;background:#ffffff;
                border:1px solid {_LINE};border-radius:4px;">

   <tr><td style="padding:26px 30px 0;">
     {brand.email_img_html(24, "display:block;")}
     <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;
          color:{_SOFT};padding-top:4px;">LESSON STUDIO</div>
   </td></tr>

   <tr><td style="padding:20px 30px 0;">
     <div style="border-top:2px solid {_INK};font-size:0;line-height:0;">&nbsp;</div>
   </td></tr>

   <tr><td style="padding:22px 30px 0;">
     <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px;color:{_INK};">
       {_html.escape(hello)}</p>
     <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:14px;
        line-height:1.55;color:{_INK};">{_html.escape(headline)}</p>
   </td></tr>

   <tr><td style="padding:22px 30px 0;">
     <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
       {_html_rows(new, svu, dates=False, amount_each=unit_amount)}
     </table>
     <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
            style="padding-top:12px;">{meta}</table>
   </td></tr>

   <tr><td style="padding:0 30px;">{holding_block and
     '<table width="100%" cellpadding="0" cellspacing="0" role="presentation">'
     + holding_block + '</table>'}</td></tr>

   <tr><td style="padding:24px 30px 0;">
     <p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:13px;
        line-height:1.6;color:{_INK};">
       Within {'each of these' if len(held) > 1 else 'that subscription'} you can prepare
       as many lesson plans as you like, for every class and section you teach, for the
       whole year. Everything you prepare stays yours.</p>
     <p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:13px;
        line-height:1.6;color:{_SOFT};">
       Meyy&rsquo;s plans follow the National Curriculum Framework and the NCERT
       textbooks. If a chapter does not look right for your class, prepare it again with
       different periods &mdash; it costs nothing.</p>
     {f'<p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:{_SOFT};">{_html.escape(attach_line)}</p>' if attach_line else ''}
     <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;
        line-height:1.6;color:{_SOFT};">
       Online payments are not open yet, so this activation was recorded by hand. Reply
       to this email if anything looks wrong and it will be put right.</p>
   </td></tr>

   <tr><td style="padding:22px 30px 26px;">
     <div style="border-top:1px solid {_LINE};padding-top:12px;
          font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9a968c;">
       Meyy &middot; Lesson Studio{f' &nbsp;&middot;&nbsp; {_html.escape(invoice_number)}' if invoice_number else ''}
     </div>
   </td></tr>

  </table>
 </td></tr>
</table>
</body></html>"""


def _html_shell(*, hello: str, lead: str, rows: List[Tuple[str, str]],
                quote: str, tail: List[str], footer: str) -> str:
    """The house email frame, identical to `_html_body`'s.

    ★ ONE EMAIL FORMAT (founder, 2026-08-27). This started life as a deliberately
    DIFFERENT layout — the reasoning being that a letter borrowing a receipt's shape
    reads like a receipt. Overruled, and rightly: a teacher does not receive "a receipt"
    and "a letter", she receives mail from Aruvi, and the second one arriving in an
    unfamiliar shape is a small reason to wonder whether it really came from us. So the
    frame here is the subscription confirmation's, row for row and padding for padding
    — brand + NCF line, the 2px ink rule, greeting, lead, a key/value ledger, then
    closing paragraphs and the hairline footer. What differs is only the CONTENT that
    fills it: no priced rows, and a quoted block of her own words.

    If either frame is changed, change both — or better, lift the frame into one
    function. They are kept apart today only because `_html_body` bakes subscription
    facts into its rows, and unpicking that is not a job to do inside a support fix."""
    kv = "".join(
        f'<tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:12px;'
        f'color:{_SOFT};padding:4px 0;width:110px;vertical-align:top;">{_html.escape(k)}</td>'
        f'<td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;'
        f'color:{_INK};padding:4px 0;">{_html.escape(v)}</td></tr>'
        for k, v in rows if v)
    quote_block = ""
    if quote:
        # The teacher's own words come back to her VERBATIM and escaped — never
        # re-flowed, never trimmed. A copy of what you sent is only reassuring if it is
        # actually what you sent.
        quote_block = (
            f'<tr><td style="padding:22px 30px 0;">'
            f'<div style="border-left:3px solid {_LINE};padding:2px 0 2px 14px;'
            f'font-family:Georgia,serif;font-size:14px;line-height:1.6;color:{_SOFT};'
            f'white-space:pre-wrap;">{_html.escape(quote)}</div></td></tr>')
    # First paragraph in ink, the rest quieter — the subscription mail's own rhythm.
    tail_block = "".join(
        f'<p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:13px;'
        f'line-height:1.6;color:{_INK if i == 0 else _SOFT};">{_html.escape(p)}</p>'
        for i, p in enumerate(tail))
    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:{_PAPER};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
       style="background:{_PAPER};padding:28px 12px;">
 <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" role="presentation"
         style="max-width:600px;width:100%;background:#ffffff;
                border:1px solid {_LINE};border-radius:4px;">

   <tr><td style="padding:26px 30px 0;">
     {brand.email_img_html(24, "display:block;")}
     <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;
          color:{_SOFT};padding-top:4px;">LESSON STUDIO</div>
   </td></tr>

   <tr><td style="padding:20px 30px 0;">
     <div style="border-top:2px solid {_INK};font-size:0;line-height:0;">&nbsp;</div>
   </td></tr>

   <tr><td style="padding:22px 30px 0;">
     <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px;color:{_INK};">
       {_html.escape(hello)}</p>
     <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:14px;
        line-height:1.55;color:{_INK};">{_html.escape(lead)}</p>
   </td></tr>

   {f'<tr><td style="padding:22px 30px 0;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation">{kv}</table></td></tr>' if kv else ''}
   {quote_block}

   <tr><td style="padding:24px 30px 0;">{tail_block}</td></tr>

   <tr><td style="padding:22px 30px 26px;">
     <div style="border-top:1px solid {_LINE};padding-top:12px;
          font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9a968c;">
       {_html.escape(footer)}
     </div>
   </td></tr>

  </table>
 </td></tr>
</table>
</body></html>"""


# ── Support (2026-08-27) ───────────────────────────────────────────────────────
# Email is the only support channel, and the acknowledgement is the whole of what a
# chat bubble would otherwise be doing: it says the message arrived, gives it a name,
# and states when a human will answer. Everything below serves those three jobs.
#
# The categories are the SAME four the Support screen offers, spelled the same way. She
# picks one on screen and reads it back in the mail; if the two ever disagree she has to
# wonder which one we actually recorded.
SUPPORT_CATEGORIES = {
    "problem": "Something isn't working",
    "plan": "Something in a lesson plan looks wrong",
    "billing": "Billing or account",
    "suggestion": "A suggestion",
    # ★ "Other" LAST and deliberate (founder, 2026-08-27). Four named buckets sort most
    # of the post, but a list with no escape hatch makes a teacher pick the nearest
    # wrong one — and then the category lies to us instead of helping. Better an honest
    # "Other" than four categories quietly misfiled.
    "other": "Something else",
}


def support_category_label(key: str) -> str:
    """"problem" → "Something isn't working". An unknown key comes back prettified
    rather than dropped — a category we stop offering must not erase the case."""
    k = str(key or "").strip().lower()
    return SUPPORT_CATEGORIES.get(k) or (k.replace("_", " ").capitalize() or "A message")


def reply_window_words(days: int) -> str:
    """"2 working days" / "1 working day". One function, because the screen, the
    acknowledgement and the founder's copy must all make the identical promise."""
    n = max(1, int(days or 1))
    return f"{n} working day" if n == 1 else f"{n} working days"


def _context_rows(context: Dict[str, str]) -> List[Tuple[str, str]]:
    """The app's own facts, as ledger rows. SHOWN TO HER, not just sent to us: the mail
    is the only place she can see what Aruvi attached on her behalf, and support context
    a teacher cannot inspect is a small surveillance rather than a small kindness."""
    c = dict(context or {})
    rows: List[Tuple[str, str]] = []
    if c.get("subject") or c.get("grade"):
        subj = _pretty_subject(c.get("subject", ""))
        grade = str(c.get("grade", "")).upper()
        rows.append(("Class", " · ".join([x for x in (subj, grade) if x])))
    if c.get("chapter"):
        rows.append(("Chapter", str(c["chapter"])))
    # From a lesson's "Report a problem" (2026-10-03): the unit she was on and its code.
    if c.get("unit"):
        rows.append(("Unit", str(c["unit"])))
    if c.get("plan_ref"):
        rows.append(("Plan ref", str(c["plan_ref"])))
    if c.get("screen"):
        rows.append(("Screen", str(c["screen"])))
    return rows


def support_acknowledgement(name: str, reference: str, category: str, message: str,
                            reply_days: int = 2, received_on: str = "",
                            context: Dict[str, str] = None) -> Dict[str, str]:
    """The message a teacher gets the moment she writes to support.

    It does three things and stops. (1) Confirms it ARRIVED — the single thing email
    cannot do on its own, and the reason a teacher on a slow channel writes twice. (2)
    Gives the case a REFERENCE, which is what turns a message into something somebody
    owes an answer on, for her and for us. (3) States WHEN, in working days, so the
    waiting has an end she can see.

    It deliberately does NOT answer, apologise, or promise an outcome. An automated
    message that pretends to be a reply is worse than one that plainly is not."""
    first = (name or "").strip().split(" ")[0]
    hello = f"Hello {first[:1].upper() + first[1:]}," if first else "Hello,"
    label = support_category_label(category)
    window = reply_window_words(reply_days)
    body = (message or "").strip()

    rows: List[Tuple[str, str]] = [
        ("Reference", reference),
        ("About", label),
        ("Received", fmt_date(received_on) if received_on else ""),
    ] + _context_rows(context)

    lead = ("Your message has reached us. It is now case "
            f"{reference} — quote that reference if you write about it again.")
    # ★ "You can expect a response", never "a person will reply" (founder, 2026-08-27).
    #   The second is a promise about WHO answers, which is not ours to make and not
    #   what she is waiting for — she wants to know an answer is coming and by when.
    #   It would also quietly become untrue the day triage is shared or automated.
    tail = [
        f"You can expect a response within {window} (Monday to Friday). If it turns out "
        f"to need longer than that, we will write and tell you so rather than leave you "
        f"waiting.",
        "You can reply straight to this email; it comes back to the same place.",
    ]
    if str(category or "").strip().lower() != "billing":
        # Said only where it is true: Ask Aruvi answers "how does this work?", not
        # "why was I charged twice?".
        tail.insert(1, "In the meantime, Ask Meyy — the guide inside the app — answers "
                       "most questions about how Meyy works, straight away.")

    ledger = "\n".join(f"  {k:<10} {v}" for k, v in rows if v)
    quoted = "\n".join(f"  > {ln}" for ln in body.splitlines()) if body else ""
    text = f"""{hello}

{lead}

{ledger}

{(chr(10) + chr(10)).join(tail)}
{f'''
This is what you sent, so you have your own copy:

{quoted}
''' if quoted else ''}
— Meyy
"""
    return {
        "subject": f"[{reference}] We have your message — Meyy support",
        "text": text,
        "html": _html_shell(hello=hello, lead=lead, rows=rows, quote=body, tail=tail,
                            footer=f"Meyy · Lesson Studio  ·  {reference}"),
    }


def subscription_confirmation(name: str, scopes: List[str], amount_inr: int,
                              valid_until: str, mobile: str,
                              scope_valid_until: Dict[str, str] = None,
                              added: List[str] = None,
                              invoice_number: str = "",
                              unit_amount: int = 0,
                              has_attachment: bool = False) -> Dict[str, str]:
    """The message a teacher gets the moment her subscription activates.

    Deliberately does three jobs and stops: confirms WHAT she bought, tells her WHEN it
    runs to, and shows the mobile her account is keyed to (that number is her sign-in,
    so it belongs in writing somewhere she can find it). No upsell, no feature tour —
    the app itself does that better.

    ★ EVERY PURCHASE REPORTS THE WHOLE HOLDING (founder, 2026-08-26). Subscriptions are
    now additive and each carries its own expiry, so a mail about the ONE subject she
    just bought would leave her with no statement anywhere of what she owns or when each
    part of it runs out. `added` is this purchase (with the amount she paid); the second
    block is everything she now has, each with its own date. When the two are the same —
    her first purchase — the second block is omitted rather than printing the list
    twice."""
    first = (name or "").strip().split(" ")[0]
    hello = f"Hello {first[:1].upper() + first[1:]}," if first else "Hello,"
    held = list(scopes or [])
    svu = dict(scope_valid_until or {})
    new = [s for s in (added if added is not None else held) if s in held] or held
    also = [s for s in held if s not in new]

    # ★ EACH SUBSCRIPTION MAY RUN TO ITS OWN DATE: a subject added in November runs to
    #   the following November, not to the first purchase's anniversary. Within ONE
    #   purchase every scope shares a date, so the "Valid to" summary line serves the
    #   top block; the holding block always dates every row, because that is the whole
    #   reason it exists.
    what = _scope_block(new, svu, dates=False)
    valid_line = f"  Valid to  {fmt_date(svu.get(new[0]) if new and svu.get(new[0]) else valid_until)}\n"
    plural = "subscriptions" if len(new) > 1 else "subscription"
    verb = "are" if len(new) > 1 else "is"
    opening = ("Your Meyy {p} {v} active. Here is what you have:"
               if not also else
               "Your Meyy {p} {v} active. Here is what you have just added:").format(
                   p=plural, v=verb)
    # The invoice number is in the BODY, not only on the attachment (2026-08-26): the
    # number is how she refers to this purchase in any question she ever asks about it,
    # and an attachment can be stripped, blocked or lost while the text survives.
    invoice_line = f"  Invoice   {invoice_number}\n" if invoice_number else ""
    holding = ""
    if also:
        holding = ("\nEverything you have with Meyy now:\n\n"
                   + _scope_block(held, svu, dates=True) + "\n")

    text = f"""{hello}

{opening}

{what}

  Amount    ₹{amount_inr:,} for the year
{valid_line}  Sign in   {mobile}
{invoice_line}{holding}
Within {'each of these' if len(held) > 1 else 'that scope'} you can prepare as many lesson plans as you like, for every class
and section you teach, for the whole year. Everything you prepare stays yours.

Meyy's plans follow the National Curriculum Framework and the NCERT textbooks. If a
chapter does not look right for your class, prepare it again with different periods —
it costs nothing.

{'Your invoice is attached, and every invoice stays on your Subscription page in Settings.' if invoice_number else ''}
Online payments are not open yet, so this activation was recorded by hand. Reply to
this mail if anything looks wrong and it will be put right.

— Meyy
"""
    subject = ("Your Meyy subscription is active"
               if len(new) == 1 else "Your Meyy subscriptions are active")
    html = _html_body(
        hello=hello, headline=opening, new=new, also=also, held=held, svu=svu,
        amount_inr=amount_inr,
        # Per-line price. Derived rather than passed when the caller doesn't say, since
        # every line of one purchase costs the same; 0 makes the rows show no price at
        # all, which is better than showing a wrong one.
        unit_amount=(unit_amount or (amount_inr // len(new) if new and
                                     amount_inr % len(new) == 0 else 0)),
        valid_until=(svu.get(new[0]) if new and svu.get(new[0]) else valid_until),
        mobile=mobile, invoice_number=invoice_number, has_attachment=has_attachment)
    return {"subject": subject, "text": text, "html": html}


def inline_images() -> list:
    """What every HTML mail built here must travel with: the letterhead wordmark the
    frames reference as `cid:` (2026-09-03). Pass as `EmailMessage(inline=...)`. A
    caller that forgets it sends a broken image — so the two frames and this list are
    kept in one module, and test_notifier checks the pairing."""
    return [brand.email_inline_attachment()]
