# THE WALK — hand-off after family 04 (written 2026-09-29)

Read `docs/walk_session_brief.md` first; this note records what changed since
`walk_handoff_family01_done.md` (family 01 was already complete on 2026-09-27).

## Where things stand
- **Family 04 (Settings & Ask Meyy): 32 of 37 rows pass on web, iPhone and Android** (n/a where
  by design: 04.06/04.07 web — phone-only; 04.24 everywhere — About removed).
- **Held for the special-state session** (with 01.18/19, 01.27–30, 02.30, 05.26, 048):
  04.10 privacy-notice bar (needs a version bump) · 04.32 edited Ask Meyy answer (needs a bank
  edit + deploy) · 04.34 the WhatsApp hello screen (needs a completed checkout) · 04.37
  WhatsApp-only teacher with no email.
- **Last amendment: WALK-A-143. Next: 144.** Open: 048 (parked), 077 (on watch), 142 (WhatsApp
  on the phone — walked except 04.34/04.37).

## What family 04 changed (all closed unless noted)
125 one email flow everywhere (`EmailEntry`, web + phone): frozen address + change, New email +
Type it again, one Confirm, mismatch resets nothing, no paste in box 2 · 126 Role "Other" → a
required "Your role" box; the typed words are the stored role (shared `roleToSave`) · 127 all
28 states + 8 UTs · 128 closed-no-defect (a 134 symptom) · 129 subscriptions earliest-expiry
first; a purchase lands on Subscription & billing scrolled to a "New" card · 130 invoice error
on its card · 131 "The total amount updates as you add." · 132 export named
Meyy_{First}_{Mon}_{YYYY}_data (last 4 of mobile when no name) · 133 unsaved Personal profile →
"Save your changes?" (Save default / Leave without saving) · 134 a tab reloads when another tab
signs out or in as someone else · 135 **policy: Meyy writes only to what is on record** — a
no-email teacher adds one (typed twice, no code) before the Support form opens; the API refuses
a send with no email (409) and caps 5/day (429) · 136 About Meyy removed; version line at the
foot of Settings and in Support context · 137 subscribe: no line under an unconfirmed email ·
138 phone theme name beside the glyph · 139 Android caps text at 1.2× itself · 140 no leave
question after a real Save (iPhone) · 141 Android: Save reachable with the keyboard up · 142
WhatsApp support ported to the phone · 143 iPhone Ask Meyy search text centred.

## Owed outside the code
- **Push + Render redeploy** for 135 (support refusal + cap) and 132 (export header). The screens
  already behave; the server rule protects old builds and other clients.
- **Deferred by the founder:** the one-time auto-reply to unknown senders
  (`deploy/support_autoreply/`, NOT installed) — folded into a fuller reply protocol once
  WhatsApp is live. The privacy-notice line for trial emails needs a notice version bump (which
  also serves 04.10) — to be scheduled.

## Test accounts (2026-09-29)
- 9000000024 / 025 used for the subscribe-door WhatsApp question (no payment).
- 003 left with WhatsApp OFF. Others unchanged.

## Environment lessons (2026-09-29)
- Run Expo from `mobile/` without `cd mobile`. If port 8081 is taken, stop the old server
  (Ctrl+C or `kill <pid>`) — do NOT accept 8082, or the phones keep the old bundle.
- Android font size: Settings › Display › Display size and text › Font size, or
  `adb shell settings put system font_scale 1.3` (reset with 1.0).
- The web keeps no device copy of the account (the shared account store is the phone's) — read
  /account directly when the web needs her name.

## Uncommitted
Everything above, on top of the family-01/02 hand-offs' uncommitted lists.
