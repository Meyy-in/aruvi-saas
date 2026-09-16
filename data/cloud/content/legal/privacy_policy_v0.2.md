# Privacy Notice (Draft v0.2)

> **Status:** Founder draft for legal review. Not yet reviewed by a lawyer. **Served since
> 2026-09-04** — `GET /legal/privacy` (open, no identity), Settings › Legal (second pill),
> the sign-in screens' links, and the agreement's final-tick words. GIVEN, NOT SIGNED: no
> tick, no ledger; only the version shown is stamped on the account (`api/legal.py`).
> A new version = a new file; the shell shows a one-line "updated" bar once per version.
> **Baseline:** this describes the LAUNCH set-up. Founder decisions were settled 2026-09-04
> (the eleven questions in `docs/legal/privacy_policy_considerations.md §7`); no `[DECIDE]`
> remains. Two kinds of bracket are left: **[value]** — a fact not yet known (hosting
> provider and country, SMS provider, gateway, registered office, backup days, accountant's
> confirmation) to paste in; and **[AT LAUNCH: …]** — a code change that must land before
> the sentence is true (real OTP, gateway, ids out of URLs, sign-out clearing, HTTPS,
> log rotation, the Board's complaint link). Publish only when both kinds are gone.
> **Why a separate document:** DPDP Rules, 2025, Rule 3(a) requires the notice to be
> "understandable independently of any other information". The User Agreement's §F/§G
> summarise data handling; this notice is the full account, and must stand on its own.
> **Versioning:** by FILENAME, like the agreement — publish v0.3 by adding a file, never by
> editing text a teacher has already been shown. This blockquote is a note to the lawyer and
> is never shown to a teacher.
> **What changed in v0.2 (founder, 2026-09-16), and why:** v0.1 promised that nothing a teacher
> types is ever *sent to* an AI model. That is true of the running product — serving is selection
> from a pre-authored library and Ask Meyy is searched on the device — but it also bound the
> founder's own hands: a teacher's support message could not be put to an AI to diagnose, and no
> non-identifying count could be used to see what to fix. v0.2 keeps the promise teachers actually
> remember — **nothing you give Meyy trains an AI model** — and states plainly where AI IS used
> (new §3a), following the shape the sector has settled on: a hard ban on training, an explicit
> permission for information that does not identify her, and a person in the loop. Three
> consequential edits went with it, and they must stay consistent with §3a: the last line of §2
> (the absolute word "analytics" removed, the promise kept about advertising and tracking CODE),
> the AI bullet in §3, and the short version. Nothing about collection, retention, rights or
> §7 changed.
> **Legal frame:** Digital Personal Data Protection Act, 2023 + DPDP Rules, 2025 (phased;
> notice/consent/rights/breach provisions in force 14 May 2027); until then the IT Act
> (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information)
> Rules, 2011 still require a published privacy policy — this notice is written to satisfy
> both. Companies Act, 2013 §128 (books of account) governs invoice retention.
> **Companion rule (grep-able):** §7 "What we keep after you erase" must match `_KEPT` in
> `aruvi_core/adapters/data_rights_service_file.py` and §G of the User Agreement. Four places
> now, not three. Change all together or none.

---

## The short version

Meyy is a lesson-planning tool for **teachers**, and the person whose data we hold is **you**
— an adult who signed in with a mobile number. We keep what we need to run your account,
bill you, and remember where you stopped teaching. We do not keep anything about your
students, and we ask you not to give us any. We do not show advertisements, we do not use
trackers or cookies, and we do not sell or share your data for anyone else's purposes. We use
AI to build and improve Meyy, and where that meets your data the rules are short: **nothing you
give Meyy is used to train an AI model**, a person stays in the loop, and no AI decides anything
about you (§3a). You can download everything we hold about
you and delete your account yourself, from Settings, at any time — whether or not you are
subscribed.

The rest of this notice is the full account.

---

## 1. Who we are, and who you are

**Meyy** is a product of **Meyy (OPC) Private Limited**, a one-person company registered in
India ("we", "us"). Under India's Digital Personal Data Protection Act, 2023 we are the
**Data Fiduciary** for the personal data described here, and you are the **Data Principal**.

You are an **individual adult** — a teacher, trainer, home educator or other person — using
Meyy in your personal capacity. Your account is between you and us. It is not connected to
your school, and your school cannot see it. Meyy does not offer school or institutional
accounts.

**Meyy is not for children, and holds no data about them.** You must be 18 or older to use
Meyy. Meyy is not directed at students, and no part of it is designed to receive information
about a student (see §4).

---

## 2. What we collect, why, and on what basis

The table lists every item of personal data Meyy holds, in the order you meet it. "Basis" is
the ground on which the DPDP Act allows us to process it: **to provide the service you asked
for** (data you give us voluntarily for a purpose you can see — DPDP Act §7(a)), or **your
consent** (DPDP Act §6), which you can withdraw.

| When | What | Why we need it | Basis |
|---|---|---|---|
| **Free trial** — signing in | Your **mobile number**. It becomes your account identifier and your sign-in. | To give you an account, to send the one-time code that signs you in, and to keep your work separate from every other teacher's. | To provide the service |
| Free trial | The one-time sign-in code, sent by SMS through the provider named in §6 **[AT LAUNCH: real OTP replaces the preview stub]** | To confirm the number is yours. The code is not stored after use. | To provide the service |
| **Subscribing** | Your **name** and **email address** | To issue your invoice, send your payment confirmation and receipts, reply to your support messages, and let you sign in by email as well as by mobile. | To provide the service |
| Subscribing | Your **role** (Teacher, Academic coordinator, Head of school, Other), **state** and **city**; **school name** (optional) | Your state and role tell us where Meyy is used and by whom, so we can decide which boards, languages and subjects to add next. School name, if you give it, is printed on your invoice. None of these connects your account to your school. | To provide the service |
| Subscribing — payment | The payment gateway named in §6 collects your payment details. Meyy receives only the confirmation: amount, date, a transaction reference, and the payment method type (e.g. "UPI"). **Meyy never sees or stores card numbers, UPI PINs or bank credentials.** **[AT LAUNCH: true once the gateway is wired; today payment is recorded manually]** | To take payment and to issue a valid invoice. | To provide the service |
| Subscribing | Your **acceptance of the User Agreement**: which version you saw, when you ticked each point, the language it was shown in, and your browser's identification string (up to 300 characters). **We do not record your IP address with it.** | Evidence that you read and accepted the agreement. | To provide the service (the agreement is the contract) |
| Subscribing (optional) | Your **marketing-email choice** — one tick, default off | To know whether we may email you about new subjects, features and teaching ideas. | **Your consent** — withdraw any time in Settings › Emails or from the link in any such email |
| **Using Meyy** | Your **teaching profile**: the subjects, classes and sections you teach (labels such as "9A"; you may give a section a short nickname of up to 8 characters), period lengths, periods a week, and your annual period budget per class | This is what Meyy plans around. It is the only description of your teaching we hold. | To provide the service |
| Using Meyy | Your **teaching progress**: for each section, the chapter you are on, the learning unit you reached, which chapters you marked complete, bookmarks, and which plans you archived | So that "where did I stop?" has an answer on any device. | To provide the service |
| Using Meyy | Your **chapter notes** — free text you write about a chapter, up to 500 words, one note per chapter per academic year. **The only free-text field in Meyy.** | Saved to your account so your note opens on any device. There is **no version history**: editing a note replaces it, and clearing it deletes it. | To provide the service |
| Using Meyy | Your **support messages**: the category you chose, what you wrote, the reference number we gave you, which screen you were on, and the name and email on your account if any | To answer you, and to keep a record of what was asked and answered. | To provide the service |
| Using Meyy | **Your subscription record**: which subject-stages you hold, the trial chapters you used, when your subscription runs to, and where it was bought (web, or an app store) | To know what you are entitled to. | To provide the service |
| Using Meyy | **Technical records**: our web server records the address (IP) each request came from, the time, and the page or action requested, as every web server does. | To keep the service running, detect abuse, and investigate faults. **[AT LAUNCH: sign-in identifiers are removed from request paths so they do not appear in these records — see considerations §3.2.]** | To provide the service (and, once in force, the DPDP Rules' one-year log-retention requirement) |

**What Meyy does not collect, and has no way to collect:** your location, contacts, photos,
camera or microphone (the "Speak" button on the notes screen only opens the keyboard — no
audio is recorded), your device's identifiers, or anything from other apps or websites. Meyy
sets **no cookies** and includes **no advertising or tracking code** of any kind.

---

## 3. What we do with it — and what we never do

We use your data to run Meyy for you: to sign you in, plan around your profile, remember
your progress, save your notes, answer your support messages, take payment and issue
invoices, and send you the service emails listed in §9.

We **never**:

- sell your personal data, or share it with anyone for their own purposes;
- show you advertisements, or let anyone else advertise to you through Meyy;
- track you across other sites or apps, build a profile of you, or make automated decisions
  about you;
- use anything of yours to train an AI model, or let any AI decide anything about you. Meyy's
  lesson plans are authored in advance, with the help of AI, from textbooks and curriculum
  frameworks — **your data is not an input to that process**. Where AI is used, §3a says so;
- send anything you type into **Ask Meyy** anywhere. The questions and answers are downloaded
  to your device once and searched there; your question never leaves your phone;
- share anything with your school or employer.

---

## 3a. Where we use AI

We use AI to build and improve Meyy — its lesson content, its software, and the way it works
for you. Where that meets your data, these are the rules:

- **Nothing you give Meyy is used to train an AI model.**
- Information that **does not identify you** may be used to fix faults, keep Meyy secure, and
  make the product better.
- When you **write to us** — about a problem, your subscription or an invoice — we may use AI to
  help work out the answer, using only what you sent and only to answer it. A person reads your
  message and a person replies.
- **A person stays in the loop, and no AI decides anything about you** — your teaching, your
  subscription or your billing.

---

## 4. Students and children — the one rule

Meyy is for the teacher. It has **no student roster, no marks, no attendance, no student
records of any kind**, and we do not want them. Chapter notes are the only place you can
type freely, and the agreement you accepted asks you never to put a student's name, roll
number, marks, health or family details there — or anywhere else in Meyy.

If we notice that student-identifying information has reached us despite this, we treat it
as entered in error and **delete it**; we do not seek parental consent for it, because Meyy
should never have held it. If you realise you have entered such information, edit the note
to remove it — that deletes it from our servers immediately, with no history kept — or
write to us and we will remove it.

The same applies to a section nickname: name a section after a colour or a flower, never
after a child.

---

## 5. What stays on your device

Meyy keeps a small amount of data in your browser's or phone's local storage so the app is
fast and works when the network does not:

- your sign-in identifier, so you stay signed in;
- your theme choice;
- your current chapter, learning-unit position, bookmarks and completion marks per section,
  and a history of the chapters each section has been through (this history exists **only**
  on the device);
- a local copy of each chapter note you have opened;
- the Ask Meyy question bank;
- small preferences such as the last subject and class you looked at.

**On a shared or borrowed device**, sign out when you finish. Signing out removes your
sign-in identifier and the Ask Meyy bank **[AT LAUNCH: and every other item above — see
considerations §3.3]**. Nothing on the device is readable by other websites or apps.

---

## 6. Who else handles your data

Meyy is built and run by one person, and your data is seen by that one person only when
running the service requires it (answering your support message, fixing a fault, issuing
a refund). No employees, contractors or agencies have access.

We use a small number of service providers ("Data Processors") who handle data only on our
instructions and only to do the job named:

| Provider | What they do | What they handle | Where |
|---|---|---|---|
| **Google Workspace** (Google LLC / Google India) | Sends and receives Meyy's email — confirmations, invoices, support replies | Your name, email, sign-in mobile and the invoice PDF, as they appear in mail to you; your support messages | Google's infrastructure, which may be outside India |
| **[hosting and database provider]** | Runs the Meyy service and stores your account and teaching data | Everything in §2 | **[country / region]** |
| **[SMS provider]** | Delivers your one-time sign-in code | Your mobile number and the code | **[country]** |
| **[payment gateway]** | Takes your payment | Your payment details (which Meyy never sees), name, email, mobile, amount | India |
| **Apple or Google**, only if you subscribe inside their app store **[AT LAUNCH: when the app ships]** | Takes the payment and manages that subscription under their own privacy policy | Your app-store account and payment; Meyy receives a purchase confirmation and no payment details | Their infrastructure |

That is the complete list. Nobody else receives your personal data, with two exceptions any
Indian company has: we will disclose data **if the law requires it** (a court order, or a
lawful request from a government authority under the DPDP Act or the IT Act), and if Meyy
is ever **sold or merged**, your data would pass to the new owner under this same notice,
and you would be told before it happens.

**Where your data is.** Your account and teaching data are held by the hosting provider
named above, in **[country / region]**. Email passes through Google's systems, which may
process it outside India. Indian law (DPDP Act §16, DPDP Rules rule 15) permits personal data
to be processed outside India except in countries the Central Government restricts by
notification; we will not transfer your data to any such country, and we will move
providers if one is ever named.

---

## 7. How long we keep it, and what we keep after you erase

| Data | Kept for |
|---|---|
| Account, teaching profile, progress, notes, support messages, subscription record | As long as your account exists. Deleted from the live system **immediately** when you erase your account (§8). |
| Disaster-recovery backups | Purged within **[30] days** of erasure. **[AT LAUNCH: set to what the hosting provider's backup retention actually is; 30 is the ceiling promised in the erasure receipt]** |
| Your invoices (name, email, mobile, school name if given, place, amount) | **8 years** from the end of the financial year **[accountant to confirm]** — books of account under the Companies Act, 2013 §128, and GST records if and when Meyy is GST-registered. These outlive your account because the law requires it. |
| Email we exchanged — payment confirmations with their invoices, and support threads | Kept in our business mailbox as part of the same business records, for the same **8 years**, then deleted. |
| The record that you accepted the User Agreement | Kept after erasure as evidence of the agreement itself: your sign-in mobile number, the version, the date and time of each tick, the language shown, and your browser's identification string. It holds no teaching content, notes, profile or school details. It no longer applies from the day you erase: if you use Meyy again, you are asked to read and accept afresh. |
| The record that you asked us to erase | Kept as evidence of the erasure: your sign-in mobile number, the time you confirmed, and a count of what was removed. Nothing else. |
| Web-server technical records (IP address, time, action) | **One year**, as the DPDP Rules, 2025 require of every data fiduciary, then deleted. They are not linked to your account. **[AT LAUNCH: log rotation set to 12 months; sign-in identifiers removed from request paths]** |
| Shared lesson-plan library | Not personal data. Lesson plans are Meyy's shared library; your account holds references to them, and erasure removes the references. |
| An account you stop using | If you neither sign in nor hold a subscription for **3 years**, we email you, wait **48 hours**, and then erase the account exactly as if you had asked (§8). |

---

## 8. Your rights, and exactly how to use them

Every right below works **whether or not you are subscribed, and whether or not your
subscription has lapsed**. None is ever gated on payment.

**See and download everything** — Settings › **Your data & export**. One editable Word file
(or PDF) with your account details, your teaching profile, your support messages, and every
chapter note beside the chapter it belongs to, for every academic year. It is ready in
seconds; nothing is held back. On a free-trial account the same download is offered inside
**Delete my account** ("Download my data first"), and you can always ask for it by email
(§10).

**Correct it** — Settings › **Personal profile** for your name, email, role, state, city and
school name (a trial account holds none of these yet). Your teaching profile is edited from
My Classes. Your sign-in mobile number is your account's identity; to change it, write to us
(§10) and we will verify you on both numbers.

**Erase your account** — Settings › **Delete my account**. You confirm you have downloaded
your data (we insist, because it cannot be recovered), type the word *erase*, and everything
in §2 is deleted from the live system at once. You receive an **erasure receipt** listing
what was removed and what is kept, with the reason for each — the same list as §7. Your
number is not reserved: if you sign in again later, you start with an empty account and are
asked to accept the agreement afresh.

**Withdraw consent** — the one thing you consent to, marketing email, is switched off in
Settings › **Emails** or from the unsubscribe link in any such email. It takes effect
immediately. Withdrawing consent to the service itself means erasing your account, above.

**Nominate someone** — under DPDP Act §14 you may name a person to exercise these rights for
you if you die or are incapacitated. Write to us (§10) with their name and contact; we will
confirm it back to you.

**Raise a grievance** — write to the Grievance Officer in §10. We acknowledge within
**2 working days** and resolve within **30 days**; the DPDP Rules set 90 days as the outer
limit and we will never exceed it.

**Complain to the regulator** — if you are not satisfied with our answer, you may complain to
the **Data Protection Board of India** **[AT LAUNCH: link to the Board's complaint portal once
published]**. The DPDP Act asks that you give us the chance to resolve it first.

---

## 9. Emails we send

**Service emails** (always sent; not marketing): your sign-in code; payment confirmation
with your invoice attached; replies and acknowledgements to your support messages; notices
about changes to the User Agreement, this notice, or your subscription; and anything the law
or your account's security requires. A copy of each payment confirmation is kept in our
records as the sales record.

**Marketing emails** (only if you ticked the optional box): occasional mail about new
subjects, features and teaching ideas. Email only — we will never market to you by SMS,
WhatsApp or phone, even though your mobile number is your sign-in. Unsubscribe from any such
email or in Settings › Emails; it takes effect immediately.

---

## 10. Contact — questions, rights, grievances

**Grievance Officer** (DPDP Act §13; IT Rules 2011, rule 5(9)):
**Kumar Radhakrishnan**, Director
Meyy (OPC) Private Limited
**[registered office address]**
Email: **support@meyy.in** — put *Privacy* in the subject line so it is handled as a
data-protection request.

Every data-protection request gets a reference number and an acknowledgement within
2 working days. Writing to us is free. Please write in English for now; we will answer in
English.

---

## 11. Keeping your data safe

- Your data is kept separately from every other teacher's, and every request is answered
  only for the account it was made from.
- There are no passwords to steal: you sign in with a one-time code to your mobile.
- **[AT LAUNCH:** All traffic between your device and Meyy is encrypted (HTTPS); data is
  encrypted at rest by the hosting provider named in §6.**]**
- One person has access to the systems, on named accounts with two-step verification
  **[AT LAUNCH: confirm]**.
- Mail is sent through an authenticated business account; mail credentials are never stored
  in the product's code.

**If a breach ever happens** — if your personal data is lost, exposed or accessed without
authority — we will tell you without delay what happened, what data was involved, what we
have done and what you can do, and we will report it to the Data Protection Board of India
within 72 hours, as the DPDP Rules require.

---

## 12. Changes to this notice

This notice carries a version number and date. When it changes, the new version is published
as a new document — the version you were shown is never edited — and you will see the new
version in Meyy before you continue, with a short note of what changed. Material changes to
what we collect or why will ask for your fresh acceptance. The current and all previous
versions are always available under Settings › Legal.

This notice is in English, and the English text governs. Translations will follow; until a
certified translation exists, the English version is the one that applies.

---

*Draft v0.2 · 2026-09-16 · For legal review before publication.*
