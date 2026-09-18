# Privacy Notice — considerations and audit findings (2026-09-04)

Companion to `data/cloud/content/legal/privacy_policy_v0.1.md`. That file is the draft a
teacher will read; this one records **why it says what it says**, what the code audit found
that the notice must disclose or the product must fix, and the decisions still open. The
draft's `[AT LAUNCH: …]` and `[DECIDE: …]` brackets cross-reference the numbered findings
in §3 below.

---

## 1. The legal frame, in dates

**DPDP Act, 2023 + DPDP Rules, 2025.** Rules notified 14 Nov 2025 with three commencement
dates: 14 Nov 2025 (the Board exists; complaints can be filed), 14 Nov 2026 (consent
managers), **14 May 2027** — notice and consent, breach reporting, security safeguards,
data-principal rights, cross-border transfer, SDF obligations, and the repeal of IT Act
§43A. Meyy launches inside this window, so the notice is written to the 2027 standard now.
What the Rules require of the notice specifically (Rule 3): it must be **understandable on
its own** (not folded into terms), give an **itemised description of the personal data and
the purpose of each**, and give the **link/means to withdraw consent, exercise rights, and
complain to the Board**. Rule 6 sets minimum security measures and — new in the final
Rules — a **one-year retention of processing logs** for every fiduciary. Rule 7: breach
intimation to affected principals without delay and to the Board within **72 hours**.
Grievances must be resolved within **90 days** at the outside. Rule 8's fixed erasure
timelines (3 years' inactivity) bind only e-commerce, gaming and social-media entities above
user thresholds — not Meyy — but §8(7) of the Act still requires erasure once the purpose is
no longer served, so a dormancy rule is needed (finding 3.11).

**IT Act SPDI Rules, 2011 — still in force until 13/14 May 2027.** Rule 4 requires a body
corporate handling personal information to publish a privacy policy; Rule 5(9) requires a
named **Grievance Officer** who resolves within one month. The draft names one (§10) and so
satisfies both regimes with one document.

**Consumer Protection (E-Commerce) Rules, 2020.** Meyy sells a service online under its own
name, which likely makes it an e-commerce entity. They require a grievance officer with
48-hour acknowledgement and one-month resolution, and display of the seller's legal name,
address and contact. The notice's 2-working-day acknowledgement (already `SUPPORT_REPLY_DAYS`
in config) meets the 48-hour ask; the registered-office address must be printed (§10).
**Confirm applicability with counsel.**

**Companies Act, 2013 §128** — books of account, including invoices, for **8 financial
years**. This is the retention figure for invoices whether or not Meyy is GST-registered
(GST §36 is 72 months from the annual-return due date, shorter). The notice says 8 years,
bracketed for the accountant.

**App stores** (the Expo app is the individual product): Google Play requires a privacy
policy link in the listing and Data safety form, an **in-app account-deletion path plus a
web URL** for deletion requests; Apple 5.1.1(v) requires in-app deletion. Settings ›
Delete my account already exists; the web URL and the store forms are derived directly from
the notice's §2 and §6 tables.

---

## 2. What is special about Meyy — the shape that keeps the notice short

Most Indian ed-tech privacy policies are long because the product sits between three
parties (school, teacher, student/parent) and holds children's data. Meyy's founding
decisions remove all of that, and the notice should say so **as facts, not as disclaimers**:

- **Adults only; the teacher is the Data Principal.** No student rosters, marks, attendance
  or parent contacts exist anywhere in the schema. DPDP §9 (verifiable parental consent, the
  ban on tracking and targeted advertising to children) never engages. No "children's
  privacy" section copied from a student-facing app — a plain 18+ statement and the
  one rule about notes (§4 of the notice).
- **Meyy is the fiduciary, directly to the teacher.** Toddle, Teachmint and the school
  ERPs must explain that the school is the fiduciary and they the processor, and negotiate
  DPAs. Meyy's personal-licence model (agreement §A, §5) means one relationship, one
  notice, no DPA. Keep it that way in the notice's language: "your school cannot see it".
- **One free-text field.** Chapter notes, ≤500 words, one per chapter per year, no history
  (editing is deleting — a genuine privacy property, worth stating). Everything else the
  teacher can change is a label, a number or a pointer. The notice can therefore enumerate
  **every** item of data — which is exactly what Rule 3(b) wants and what generic policies
  cannot do.
- **No LLM in the runtime.** Serving is selection from a certified library; Anthropic is
  used offline at authoring time only. Her notes, profile and messages never reach a model.
  Agreement §F's "content generation uses third-party AI providers" is true of authoring,
  not of her data — the notice says both halves plainly (§3), and the `[verify with
  provider terms]` placeholder in the agreement can be resolved as "not applicable to
  teacher data".
- **No analytics, trackers, cookies, ads, SDKs.** Verified: `web/package.json` is
  next/react only; no cookie is set; localStorage only. Ask Meyy is searched on the device.
- **One person.** An OPC. "Who can see my data" has a one-word answer, and the notice gives
  it. This is a trust asset; do not hide it behind "authorised personnel".

---

## 3. Audit findings — what the notice must disclose, or the product must fix first

Numbered; the draft's brackets point here. Each item says which it is: **DISCLOSE** (write
it down truthfully), **FIX** (change the code before publishing), or **DECIDE** (founder).

**3.1 There is no authentication today.** FIX before launch. OTP is `0000` client-side; a
returning sign-in is an existence check on `?id=` (`Login.jsx:224-240`, `api/main.py:2087`).
Anyone who knows a registered mobile opens that account. The login screen's "Your data is
private and secure" (`Login.jsx:260`) currently sits above that. The notice describes the
launch state (real OTP via an SMS provider, named in §6) — it must not go live before the
code does.

**3.2 Sign-in identifiers travel in URL query strings and land in access logs.** FIX.
`GET /onboarding/known?id=<mobile>` (`format.js:146`) — uvicorn's access log, redirected to
`.devlogs/api.log` by `dev.sh:87`, holds `client_ip … ?id=<mobile>` lines with no rotation.
Under Rule 6 these logs must be kept a year; a year of IP↔mobile pairs is a record the notice
would have to disclose as linked to her account. Move the identifier to a header/POST body so
logs hold IP + path only, then the notice's "not linked to your account" (§7) is true.
Set log rotation to 12 months.

**3.3 Sign-out clears two keys and leaves the rest.** FIX (small). `page.jsx:619-621` removes
`aruvi_user` and the Ask bank; `chapter_notes_*`, `lu_pointer_*`, `section_history_*`,
`allocations_*`, prefs remain on a shared staff-room PC. The notice promises full clearing
`[AT LAUNCH]`; clear every key with the user suffix and the section-state keys on sign-out.

**3.4 Role / state / city need a stated purpose — and are missing from the export.** DECIDE +
FIX. DPDP purpose limitation means "we collect your state" must say what for. The draft
gives the honest reason (deciding which boards/languages/subjects to add) under the
service basis; the cleaner alternative is a separate optional tick at checkout ("help us
plan by telling us your role and state"), which makes them consent-based and withdrawable.
Either way: `export_data_rights_docx.py:120-122` gathers but does not render them — the
access right must be complete; render all three.

**3.5 Two retained records hold the mobile number.** DECIDE + FIX. The erasure log
(`erasure_log_file.py`) says "carries NO personal data" but stores `tenant_id/user_id` —
which IS the mobile number. Either store a one-way hash (SHA-256 with a fixed salt; it is
still matchable when she disputes a deletion) or add it to `_KEPT` and to agreement §G. The
consent ledger also holds the mobile + user-agent; agreement §G's "holds no lesson plans,
notes, teaching profile or school details" is true but should add "your sign-in identifier".
The notice already says so (§7).

**3.6 Google — three ways.** DISCLOSE + one FIX. (a) Google Workspace is a real processor
today (`smtp.gmail.com`, `.env.example:15-30`): name, email, mobile and invoice PDFs pass
through it, and copies persist in Sent and in the support inbox after an erase — decide a
mailbox retention (notice §7 bracket). (b) `MAIL_BCC_FOUNDER` defaults ON: a copy of every
confirmation, with mobile and invoice, goes to the founder's address — same entity, so not a
third party, but disclosed in §9 as "a copy is kept as the sales record". (c) **Google Fonts
`@import` in `globals.css:1`** sends every visitor's IP and user-agent to Google on every page,
including the pre-login screen, i.e. before any notice. FIX: self-host the three families
(Fraunces, Newsreader, IBM Plex Mono are all OFL) under `web/app/fonts/`; the design system
is unchanged and the disclosure disappears. Hosting region is undecided — the DPDP Rules use
a blacklist model (transfer allowed except to notified countries), so India-region hosting is
a trust choice, not a legal must; recommended.

**3.7 `outbox/` retains full mail copies and is not in the erase walk.** FIX. `FileNotifier`
writes every mail (name, email, mobile, invoice PDF) to `STATE_DIR/outbox/` when SMTP is
unset. Dev-only in practice, but a production box started without SMTP would silently
accumulate PII outside the traversal. Either fail loudly in production without SMTP, or add
`outbox/{tenant}/{user}` keying and walk it.

**3.8 Backups do not exist.** DECIDE. "Purged within 30 days" is promised in `_KEPT` about a
system not built (`administrative_architecture.md §7`). Whatever the partner's DB provides
(Supabase PITR is 7 days by default; snapshots configurable), set the retention **before**
publishing and make the notice's figure match it — 30 is a ceiling, not a target.

**3.9 Support messages live in two places.** DISCLOSE. `support/{t}/{u}` is erased; the
Gmail copy is not. Covered by the mailbox-retention decision in 3.6(a).

**3.10 Student data in notes: reserved right only, no detector.** DECIDE. `POST /plan-notes`
stores verbatim. The notice states the rule and the remedy (edit = delete, immediately, no
history). A lightweight server-side check (roll-number patterns, "marks", "absent" with a
capitalised name) could nudge — but a false positive on a teacher's note is a worse
experience than the risk, given the 18+ user and the tick-3 instruction. Recommendation:
keep it manual; revisit if support ever sees a real case. **Trigger to remember:** the v0.2
spec's voice notes would add a speech-to-text processor and a new row in §6 — a new notice
version on the day it ships.

**3.11 Dormant accounts.** DECIDE. DPDP §8(7) requires erasure once the purpose is no longer
served. A teacher who never subscribes and never returns is holding a mobile number and a
profile for no purpose. The draft proposes 3 years of no sign-in and no subscription → email →
48 hours → erase (mirroring Rule 8's pattern for the large classes, which is the figure the
Board will recognise as reasonable). Needs a small scheduled job — none exists.

**3.12 Rule 6's one-year log retention vs the 30-day backup purge.** DISCLOSE, correctly. Two
different things: her *account data* is erased immediately and purged from backups in ≤30
days; *server logs* (IP, time, path) are kept a year because the Rules require it. The
notice keeps them in separate rows (§7). This only holds if 3.2 is fixed so logs carry no
account identifier.

**3.13 The notice is not shown at the moment data is first collected.** FIX. The agreement
appears at subscription; the mobile number is collected at **trial** sign-in. Rule 3 wants the
notice before or with collection. The sign-in screen needs one line — "By continuing you
agree to the Privacy Notice" with the link — and the notice needs a home (§6 below). This
is a notice, not a consent tick: the basis for the mobile is §7(a), not §6.

**3.14 The export card is hidden on trial.** DECIDE. Settings hides "Your data & export" and
"Personal profile" on trial (`Settings.jsx:596-612`, founder 2026-08-26 — the trial is a look
at the teaching product). The routes stay open and the download button inside Delete my
account works on trial, so the right is exercisable — but a trial account already holds a
mobile, a profile, progress and notes, and DPDP §11 does not distinguish trial from paid. The
notice describes the door that exists; a visible one-line "Download my data" on trial would
let §8 read the same for everyone.

**3.15 `_KEPT` must grow to match notice §7.** FIX (with 3.5). The receipt today names four
kept things; the notice truthfully lists more — the erasure record and mailbox copies. The
receipt "listing what is kept … the same list as §7" is only true once `_KEPT` carries those
rows too (and the pinning test in `test_data_rights` moves with it).

---

## 4. What the Indian ed-tech policies teach — copy, and avoid

**Copy.** Toddle's is the best teacher-facing model seen: a **named** Grievance Officer /
DPO with an email **and a postal address**, a separate DPDPA page, and a clear statement of
who the fiduciary is. The draft names the founder with the registered office (§10). Its
"we collect only what the school shares" framing becomes, for Meyy, "we collect only what
you type, and here is the complete list".

**Avoid.** The SPDI-era template most Indian ed-tech and SaaS policies still run on:
"we may share with affiliates, partners and service providers" (Meyy can enumerate them —
do), "to improve our services" as a purpose (say which decision the data informs), a
cookies section (Meyy sets none — say so in one line rather than importing a cookie policy),
"we retain as long as necessary" (give the table), COPPA/GDPR clauses lifted from a US
template (irrelevant, and they signal a policy nobody wrote for this product), and the
consent-to-everything opening line — DPDP §6 wants consent free, specific and withdrawable,
so consent should be claimed **only for marketing email**; everything else is the service
basis. Counsel to confirm the §7(a) reading, which is the mainstream Indian view for
contract-necessary processing.

**Naming.** DPDP speaks of a *notice*; the agreement's final tick already says "User
Agreement and Privacy Notice". Keep "Privacy Notice" as the title so the tick's words and the
document's title are one.

---

## 5. Principles the draft follows

1. **Standalone** (Rule 3(a)): readable without the agreement; §F/§G of the agreement
   should shrink to a pointer at the next agreement version.
2. **Itemised, purpose per row, basis per row** (Rule 3(b)) — the §2 table is the notice's
   core; the prose around it is explanation.
3. **The three links** (Rule 3(c)): withdraw (Settings › Emails), exercise rights (Settings ›
   Download / Delete / Personal profile), complain (Grievance Officer, then the Board).
4. **Never invent an answer about her record** (the Support `metaErr` rule): every not-yet-
   true statement is bracketed; the published version contains no brackets.
5. **Same voice as the product**: second person, short sentences, the one-rule-per-section
   shape of the agreement. Teacher-facing English first; Hindi next.
6. **Versioned by filename; never edited once shown** — the agreement's rule, and `api/legal.py`
   already ignores non-`consent_and_disclaimer_*` files, so the new file sits safely beside it.

---

## 6. Wiring — BUILT 2026-09-04 (given, not signed)

The founder asked the normal practice — sign it at subscription, or leave it under
Settings? — and the answer is the second, because DPDP §5 makes a notice something a
fiduciary GIVES at or before collection, while consent (§6) is a separate act asked for
only where consent is the basis (marketing email). A tick "I accept the privacy policy"
would imply the service runs on consent — withdrawable — and put the account on a footing
the notice does not claim. So:

- **`api/legal.py`** — second document family `privacy_policy_v{V}.md`: same rules (one
  copy, version = filename, `>` front matter dropped), NO acknowledgement blocks; the title
  is the first `# ` line (draft marker stripped), the dated footer becomes `published`.
  `_FILE_RE` for the agreement was already anchored, so the two families cannot see each
  other (`test_consent_parser_ignores_the_notice`).
- **Routes** — `GET /legal/privacy` (+`?version=`) takes **no identity** (the sign-in
  screen links it before a number is typed); `GET /legal/privacy/status` and
  `POST /legal/privacy/seen` are identity-bound. `Account.privacy_notice = {version,
  seen_at, context}` is the ONE record — stamped server-side at `/onboarding/verified`
  (first collection), at `POST /legal/consent` (the final tick's words include the
  notice) and on dismissal of the update bar; rendered in the export as "Privacy notice
  shown"; erased with the account.
- **Web** — `PrivacyNotice.jsx` (bare fetch, no `withUser`); `legalmd.js` grew pipe
  TABLES (`data-th` per cell; ≤600px stacks each row into a card with mono kickers — a
  four-column table at 360px is otherwise unreadable); Login: the OTP screen's line "By
  continuing you confirm you are 18 or older and have read Meyy's Privacy Notice" + a
  link beside "Your data is private and secure", opening a pre-sign-in screen that
  returns to where she was; Agreement: the final tick's own words "Privacy Notice" are a
  link opening a SHEET over the wizard (she is mid-signature and must land back on the
  tick); Settings › Legal: two pills — User agreement · Privacy notice — one card, bar
  still "⚙ Legal"; page.jsx: the `.pn-note` bar ("updated", or "Meyy has a Privacy
  Notice" for an account with no record) with Read it → Legal on the notice, Dismiss →
  stamp; hidden while on Legal itself.
- **`_KEPT` is six rows** (backups · tax records 8 y · email copies 8 y · erasure record
  with the mobile · agreement acceptance with the mobile + user-agent · shared library),
  and `tests/test_privacy_notice.py` pins it to notice §7 in BOTH directions
  (sabotage-verified). The erasure-log docstring no longer says "no personal data".
  Role/state/city now render in the export (3.4).
- **Still owed:** agreement v0.5 (§F/§G → point to the notice; §G names the sign-in
  identifier and the six kept things; the final tick's "above" → "linked" — batch with
  the next agreement change, every bump re-ticks every signer); self-host the three
  font faces (3.6); the dormancy job (3.11) or a documented manual sweep; log rotation
  + ids out of URLs (3.2); sign-out clearing (3.3); `outbox/` (3.7); a Hindi
  translation, undated. **Live + 360px pass owed** on every screen above.
- Play Data safety form / Apple privacy labels: fill from §2 and §6 when the app ships;
  publish the account-deletion web URL.

---

## 7. Decisions — settled by the founder, 2026-09-04

| # | Decision | Settled as |
|---|---|---|
| 3.4 | Role/state/city basis | **Service basis**, purpose stated in the row (no separate tick) |
| 3.5 | Erasure log holds the mobile | **Keep the number, disclose it** — notice §7 names it; add a row to `_KEPT` and to agreement §G; fix the adapter docstring's "no personal data" claim |
| 3.6 | Mailbox copies after erasure | **Kept with the invoice records, 8 years**, then deleted — a `_KEPT` row too |
| 3.6 | Hosting region | **Unknown; law-neutral.** DPDP has no localisation duty for a non-SDF (Act §16 blacklist model; Rules r.15). Notice reads `[country / region]`; if a country is ever notified, move providers |
| 3.6 | Google Fonts | **Self-host** all three faces before launch; no disclosure needed |
| 3.8 | Backup retention figure | `[30]` — set to what the provider does; 30 is the ceiling in the receipt |
| 3.11 | Dormancy rule | **3 years → email → 48 h → erase**; needs a scheduled job (none exists) |
| 3.14 | Export card on trial | **Ignore** (founder: hardly anything is held on trial and there is no commercial contract). Notice describes the door that exists |
| §8 | Grievance resolution | **30 days** (acknowledge in 2 working days, as configured) |
| §8 | Nominee right | **By email** to support@; no Settings control |
| §10 | Contact address | **support@meyy.in only**, "Privacy" in the subject; no alias |
| §10 | Languages | **English only** for requests; notice in English, translations to follow, no date promised |
| §10 | Registered office | `[ ]` — to paste |
| §7 | Invoice retention | **8 years** (Companies Act §128) `[accountant to confirm]` |
| — | Grievance Officer | **The founder, by name** |

Consequence for `_KEPT` (3.15): it grows from four rows to **six** — add "The record that
you asked us to erase" (mobile, time, counts) and "Email we exchanged" (business mailbox,
8 years). Notice §7, agreement §G, `_KEPT` and the ledger's placement must all say the same.

---

*Sources consulted: MeitY notification of the DPDP Rules, 2025 (14 Nov 2025) and law-firm
summaries of the commencement schedule (Shardul Amarchand Mangaldas, 21 Nov 2025); DPDP Rules
text (Rule 3 notice, Rule 6 safeguards/log retention, Rule 7 breach, Rule 8 retention); IT
(SPDI) Rules, 2011 rr. 4–5; Toddle's privacy policy and DPDPA page; Google Play account-
deletion and Data safety requirements. Not legal advice — for counsel's review.*

---

## 8. For counsel — the trial ledger (added 2026-09-18, founder)

**What was built.** A free trial is once per mobile number, including across an account erasure.
On erasure Meyy keeps one line per number: an HMAC-SHA256 of the normalised mobile under a
server-held key (`ARUVI_TRIAL_LEDGER_KEY`), the number of trial chapters it used (or that a
purchase spent the trial), and the date it will be forgotten — **24 months** after the erasure.
The number itself is not stored. A returning number gets a new, empty account with its used
chapters already counted. Code: `aruvi_core/adapters/trial_ledger_file.py`; tests
`tests/test_trial_ledger.py`.

**Disclosed in:** Privacy Notice **v0.3** §2 (trial row) and §7 (new row); User Agreement **v0.5**
§C and §G; the erasure receipt (`_KEPT`, seventh row). Five places must agree.

**The question for counsel.** A keyed hash is still personal data — Meyy holds the key and can test
any number against it. DPDP §8(7) requires erasure when the purpose is served or consent is
withdrawn, "unless retention is necessary for compliance with any law", and preventing abuse of a
free offer is a business interest, not a legal duty. Is disclosed, time-limited, minimal retention
for this purpose defensible (e.g. as a term of the trial offer the teacher accepts), and is 24
months proportionate? If not, the fallbacks are: shorten the period; make it a condition shown
and accepted at trial sign-up; or drop it and accept the loophole.
