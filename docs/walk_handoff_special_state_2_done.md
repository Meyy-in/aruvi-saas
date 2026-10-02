# THE WALK — hand-off after the remaining special-state rows (written 2026-10-02, evening)

Read `docs/walk_session_brief.md` first, then `walk_handoff_special_state_done.md`; this note
records what changed since.

## Where things stand
- **Every row held for special states is now walked on web, iPhone and Android:**
  01.18 · 01.19 · 01.27 · 01.28 (phone-only) · 01.29 · 02.30 · 04.10 · 04.32 · 04.34 · 04.37 ·
  05.26 (01.30 was done in the cutover walk).
  One web cell is still marked fail: **04.37 web**, for wording only. The fix (170) passed on both
  phones; re-look at the web Support box once to turn it green.
- **Re-walks closed:** WALK-A-048 (trial count survives purchase and erasure: ledger
  chapters_used 3, spent false; rejoin lands on Subscribe) and WALK-A-077 (web: a refused
  session signs her out). 077's phone half cannot be faked in Expo Go, so it goes with X.12's
  real-build pass.
- **Last amendment: WALK-A-173. Next: 174.** Open: **158 PARKED** (invoice to both channels).
  The founder reports the WhatsApp invoice template is approved and delivering to his own
  phone, so 158 may now be only a check with a real number.

## Still pending in the tracker (not special-state)
- 05.11, 05.12, 05.19 (web): need an account with a prior academic year. **028 now has one**
  (2026-27 → 2027-28 cutover); 164/165 already exercised most of it. Supabase OTP for 028 was
  removed, so add it back first.
- 06.14 (all three): chapter notes read-only while lapsed. Quick: revoke 027, open a chapter
  note, then grant it again (the scopes list is in the "Test accounts" section below).
- X.12: cold relaunch in airplane mode, real build only.

## Amendments this session (166–173)
- **166 web+phone (founder)**: done-screen invoice line, one shared `invoiceLine()` in
  @aruvi/shared/format. It names only the channels the invoice actually went by, then adds
  "You can also download it anytime from Settings › Subscription." Made-up test numbers never
  get WhatsApp (Meta refuses them), so the line says "by email".
- **167 server**: a newly bought stage gets its lowest class (Section A) even in a subject she
  emptied; a stage she held and emptied stays empty (`held_before` in
  `_apply_subscription_profile`).
- **168 web**: no Year Plan budget pencil while lapsed (the phone already hid it).
- **169 DECLINED (founder)**: once an email is on record it can be changed, not removed.
- **170 web+phone (founder)**: "our replies need somewhere to go." removed from the Email
  support box.
- **171 server**: a revoked teacher could not re-buy her own lapsed stage (the checkout guard
  read the dates only). Now it uses `_live_scopes`.
- **172 server**: signing in stamped the new privacy-notice version, so the "updated" bar never
  showed. Now sign-in stamps only when nothing is recorded yet.
- **173 web+phone**: a stage bought into an emptied subject raises the "You've added…" window.
  The checkout notes the scopes it is buying, in storage, before it posts;
  `setupCheckAdds(prev, next, bought)` reads them.

## Content published this session
- **Privacy Notice v0.4** (`data/cloud/content/legal/privacy_policy_v0.4.md`): WhatsApp. §2 has
  a WhatsApp row (consent, STOP), and email is optional with WhatsApp on; §6 names Meta as a
  processor; §7 erases WhatsApp messages with the account; §9 says service messages only and
  "we reply on the channel you wrote to us on". It carries a note for counsel.
- **Ask Meyy bank V3.3**: d38 ("How do I get help…") now names WhatsApp support.

## Standing rules (founder, 2026-10-02)
- **Reply on the channel she wrote on.** An email request gets an email reply; a WhatsApp chat
  gets a WhatsApp reply. Account notices (invoices, legal) may go to every channel she has on.
- An email on record can be changed, never removed (169).

## Test-only aids used today
- To put an account back on an older notice version (so the "updated" bar can be walked):
  `python3 -c "from api import config; from aruvi_core.adapters.account_repository_file import AccountRepositoryFileImpl as A; r=A(config.state_backend()); [ (lambda a: (setattr(a,'privacy_notice',{'version':'0.3','seen_at':'2026-10-01T00:00:00+00:00','context':'walk_reset'}), r.save(a)))(r.load(n,n)) for n in ['9000000003']]"`
- `entitlement.py trial-reset` + `ledger-forget` give a number a fresh trial. A RE-prepared
  chapter is not counted, so use chapters the number has never had.
- To fake a refused session on the web: in the console, wrap `window.fetch` to send
  `Authorization: Bearer broken`, then close that window afterwards (the patch survives sign-out).
- Every push redeploys Render (502 "Bad gateway" for a minute or two), even a tracker-only
  push. Suggested later: a Render build filter so pushes of `data/testing` and `docs` do not
  deploy.

## Test accounts (end of 2026-10-02)
- **003**: subscribed; notice v0.4 seen (Android Dismiss).
- **026**: erased; ledger chapters_used 3 → Subscribe screen ("already used its free trial").
- **027**: active, 10 scopes (social_sciences/secondary, science/secondary, mathematics/middle,
  mathematics/secondary, mathematics/preparatory, english/middle, english/secondary,
  english/preparatory, social_sciences/middle, science/middle); Mathematics and English were
  emptied and then refilled with Class 3.
- **029 (iPhone) / 030 (Android)**: subscribed, WhatsApp-only, no email. Science was emptied
  and then Secondary was bought.
- **028**: in 2027-28 (OTP removed from Supabase).
- Remove the Supabase test OTPs for 026, 027, 029, 030 when they are no longer needed.
