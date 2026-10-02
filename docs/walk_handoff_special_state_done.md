# THE WALK — hand-off after the special-state session (written 2026-09-29)

Read `docs/walk_session_brief.md` first, then `walk_handoff_familyX_done.md`; this note records
what changed since.

## Where things stand
- **Family X is now 19 of 19 done.** The six held rows — **X.02, X.03, X.04, X.05, X.13, X.14 —
  pass on web, iPhone and Android** (X.08/X.18 phone-only, X.19 n/a on web, as before).
  X.12's cold relaunch in airplane mode still needs a real build (Expo Go loses Metro).
- **Last amendment: WALK-A-160 (closed, no change). Next: 161.** Open: 048 and 077 (as before), 142 (WhatsApp on the
  phone — 04.34/04.37 still to walk), **158 PARKED** (invoice to both channels, see below).

## Still held for special states (not walked today)
01.18 · 01.19 · 01.27 · 01.28 · 01.29 · 01.30 · 02.30 · 04.10 · 04.32 · 04.34 · 04.37 · 05.26.
★ Several were effectively exercised today and should be quick to tick with the same setups:
01.27 / 05.26 (paywall — 026 has a spent trial), 01.29 / 02.30 (lapsed — 027 is expired),
01.18 (added subject asks once — seen via X.04's purchase half), 01.28 (Subscribe from the
paywall), 04.34 (hello screen — needs a checkout with WhatsApp ON).
Still genuinely hard: 01.30 (year rollover — the NEXT session, below), 04.10 (privacy-notice version bump), 04.32 (bank
edit + deploy), 04.37 (WhatsApp-only, no email).

## ★ NEXT SESSION — the academic-year cutover (founder, 2026-09-29)
Row **01.30** and everything that fires only on cutover morning have never been walked. Meyy
rolls every teacher into the new year automatically on **1 June** (`config.CUTOVER_MONTH_DAY`,
`_resolve_year` → `_auto_roll_year` in api/main.py), so left alone the first real cutover is
**1 June 2027, with real teachers in it** — one morning, everyone at once. Walk it before launch.

**Plan:**
1. ✅ **BUILT 2026-10-02** — `ARUVI_TEST_CUTOVER` (api/config.py + `_test_cutover_due` in
   api/main.py; tests/test_test_cutover.py; render.yaml). A listed number still in TODAY's year
   rolls into the next on its next request — ONCE — and logs `TEST cutover applied for …NNNN →
   2027-28`. ⚠️ Build 028's state with the switch OFF: the roll fires on the first request after
   it is on. Note the lesson LIBRARY stays on the 2026-27 edition (config.LP_YEAR), so a plan
   prepared AFTER the roll is still a 2026-27 edition — only the TEACHER's year moves. Original
   spec: `ARUVI_TEST_CUTOVER` = mobile numbers for
   which `_resolve_year` treats the cutover as already due — same pattern as the two below (env,
   default empty, per-number, logged, declared in render.yaml, tested). Never a global clock
   change: everyone else must stay in 2026-27.
2. **Prepare a fresh number (e.g. 028)** in Supabase with a real teaching state BEFORE switching
   it on: a profile, a lesson attached to a section, a chapter part-taught (pointer moved), one
   chapter completed, a chapter note — so there is something to carry.
3. **Turn the switch on for 028** (Render: set, Save, rebuild, and deploy; check the log line).
4. **Walk on web → iPhone → Android:**
   - the roll itself: bindings carried, so her cards look as they did and she can finish the
     chapter she is in; pointer and completion intact;
   - provenance: the carried plans sit in the prior-year folder and stamp "2026-27 version";
   - **01.30** — the new-year offer on My Classes: dismiss it, relaunch (does it come back?),
     then accept it (start fresh for the new cohort) — what is cleared, what is kept;
   - My Lessons' prior-year folder and Year Plan after the roll;
   - the section-history ledger carries on roll and clears on start-fresh (both halves);
   - chapter notes: one per chapter per YEAR — the old note stays with the old year;
   - the first-run heuristic must NOT fire for a veteran the morning after (prior year counts);
   - Settings › Your data export after the roll (both years represented correctly);
   - a lapsed or trial account crossing the cutover (optional, if time).
5. **Turn the switch off** and record results; amendments from WALK-A-161.

## ✅ DONE 2026-10-02 — renewal after a lapse: PASS on web, iPhone and Android
027 given real state (9A Science Ch 02 at unit 4, 3 completed, a chapter note), revoked →
reading room (My Lessons + Ask Meyy; Ch 02 still readable in My Lessons), granted again → My
Classes + Add back, 9A card at the same position, progress bar right, chapter note kept, Prepare
open without a paywall — identical on all three surfaces. The CLI grant leaves an emptied
paid subject empty (SS stayed classless). **WALK-A-160 closed, no change needed:** a renewal
covering FEWER subject-stages keeps the rest — the provider merges previously paid scopes into
`held`; only a trial is superseded. Pinned by tests/test_renewal_keeps_profile.py.
The original plan for the check follows, kept for reference.

## (plan) — renewal after a lapse (founder, 2026-09-29)
The founder's promise: a lapse HIDES, it never deletes. While lapsed she keeps her lessons
(read + export), her teaching profile (read-only; the server refuses edits), her class tracker
(pointers, completions, chapter notes — kept server-side, only My Classes is off the bar) and
Settings. On renewal My Classes and Add return with every card exactly where she left it.
**The 2026-09-29 session walked the LAPSE on all three surfaces, not the RETURN.** Quick check
with 027:
```
cd ~/main/kumar/AI/aruvi-saas && export $(grep -v '^#' .env | xargs) && export ARUVI_STATE_BACKEND=postgres && python3 aruvi-scripts/entitlement.py grant 9000000027 --scopes social_sciences/secondary,science/secondary,mathematics/middle
```
Then on web → iPhone → Android (a phone already open picks it up within ~20s or on foreground):
My Classes and Add are back; the class cards show the same lesson, position and completions as
before the revoke; chapter notes intact; the profile is editable again; Prepare returns. Also
check a renewal through the SUBSCRIBE screen (not the CLI) restores the same state. Any
difference is an amendment from WALK-A-161.

## The two TEST-ONLY server switches (built today, now OFF)
Both are env-driven, default empty = off for everyone; code stays in `api/main.py` +
`api/config.py`, tests in `tests/test_readback_skew.py`, keys declared in `render.yaml`.
- **`ARUVI_TEST_READBACK_SKEW`** (X.02): for listed numbers, a GET /readiness within 20s of that
  account's own POST answers periods-a-week +1 on the first class → the read-after-write check
  sees a mismatch. The WRITE really lands. Logs `TEST read-back skew applied for …NNNN`.
- **`ARUVI_TEST_SUBJECTS_FAIL`** (X.13, phones): for listed numbers, GET /subjects answers 503
  for 60s after the account record is created. Logs `TEST /subjects failure served`.
- Founder cleared both on Render at the end of the session. To reuse: set the number(s), Save,
  rebuild, and deploy, and check the Render log for the `… ON for N number(s)` line.
- On the WEB, X.13 needs no switch: DevTools › Request conditions › block `*://*/subjects`.

## What the session changed (all closed unless noted)
- **151 web** — a profile save through the Add window that failed its read-back said NOTHING
  (TeachingProfile's banner unmounted with the window). The window host now passes
  `onSaveFailed`; the SHELL caption shows. Settings' profile keeps its own banner.
- **152 phone** — the 402 paywall lived only in My Lessons; a prepare from a CLASS CARD settles
  on My Classes, so the card vanished and nothing showed. New `mobile/components/PaywallSheet.jsx`,
  mounted once in `(app)/_layout.jsx`.
- **153 web+phone (founder)** — Subscribe › About you: the WhatsApp Yes/No pair is replaced by
  Personal profile's SWITCH and words ('WhatsApp support' · 'Off' / 'On — Meyy support on
  WhatsApp from your sign-in number') + 'Service messages only — never marketing.' Starts OFF;
  `wa` stays null until touched (server: keep the stored choice). SUPERSEDES 04.33's "neither
  preselected, Continue blocked until chosen".
- **154 phone (founder)** — About you: the notice and the foot (Save & continue · ← Back) now
  SCROLL with the form; only the step rail stays frozen. SUPERSEDES WALK-A-031's always-visible
  CTA on this screen.
- **155 phone** — the WhatsApp switch's OFF track is `t.edge` grey on both phones
  (`ios_backgroundColor`); iOS drew it white.
- **156 phone** — with the keypad up the form could not scroll to Save & continue. The strip the
  keys still COVER (keyboard top vs the scroller's measureInWindow bottom) is added as scroll
  room, both phones. (The first cut added the full keypad height and over-scrolled.)
- **157 web+phone (founder)** — Agreement: one paragraph, 'Confirm each of the five points and
  accept the full agreement to continue. Tap a box to go straight to that point.'
- **158 PARKED (founder rule)** — when a teacher has given BOTH email and WhatsApp, the invoice
  goes to BOTH. Blocked on WhatsApp going live (Meta lock) and a fetchable PDF URL for the
  template's document header.
- **159 phone** — lapsed: the shell moved her to My Lessons from EVERY other path, so the ⚙ gear
  bounced and Settings was unreachable (renew, export/erase, Support — §2.5 says never gated).
  Now only My Classes ('/') and /prepare send her back.

## Behaviour confirmed, worth remembering
- A returning teacher with 0 trial chapters goes into her app if she has anything set up; only
  an ERASED-and-rejoined (or never-set-up) number lands on Subscribe with "already used its free
  trial" (WALK-A-086). Deleting an account does not refund trial chapters (the trial ledger).
- A direct subscriber who has never prepared a lesson gets the guided first run on the next
  surface she opens (founder rule 2026-08-25), scoped to what she bought.

## Test-account state (2026-09-29, end of session)
- **026** — erased on Android at the end; trial ledger says SPENT (front door → Subscribe).
- **027** — subscribed (social_sciences/secondary, science/secondary, mathematics/middle), then
  **REVOKED → expired** for the lapsed rows; one trial chapter used (english/iii/1); one paid
  subject has no classes (X.05). Several test invoices exist for it.
- Supabase test OTPs for 919000000026 and 919000000027 (=123456) are still listed — remove when
  no longer needed.

## Committed
Everything above is committed and pushed (last: `d8d49a85`), bar this note and the tracker's
final closures of 154–157 — commit them with the next change.
