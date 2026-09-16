# Settings + Ask Meyy

Repo snapshot note: `web/app/lib/format.js`, `lib/legalmd.js`, `lib/auth.js` and `web/app/ask-aruvi/{bank,askAruviSearch}.js`
are NOT in the snapshot (the thin re-export wrappers over `@aruvi/shared`, per docs/mobile_migration_plan.md Track D step 1);
line refs for shared logic point at `packages/shared/src/**`, which is what both apps actually run.

## Web source map

- `web/app/components/Settings.jsx` (1154 lines)
  - 1–8 imports: `API, withUser, fetchEntitlement, getJSON, pretty, idInUse, errDetail` (lib/format → shared), `ThemeToggle`, `ROLES, STATES, EMAIL_TAKEN` from SubscribeFlow, `Agreement`, `PrivacyNotice`, `Dropdown`.
  - 10 `EMAIL_OK` regex; 11–15 `maskEmail` (DEAD — defined, never called); 25–31 `emailFit(e)` → `""` / `" ob-email-addr-s"` (≤28) / `-xs` (≤36) / `-xxs` (type steps down, never truncates).
  - 33–64 header comment: the card list, the trial rule (`onTrial` hides Personal profile + Your data & export; routes stay open).
  - 66–67 `scopeLabel` (DEAD — never called; `scopeRows` is used).
  - 71–221 `PersonalProfile({onSaved})` — GET `/account` on mount, POST `/account` on Save; email change is a 3-stage double-blind (`ok | enter | confirm`) with `idInUse` → `/onboarding/known`.
  - 257–263 `SUPPORT_FALLBACK` (5 categories); 264 `SUPPORT_MAX = 4000`; 267 `SUPPORT_ADDRESS = "support@meyy.in"` (hardcoded by decision, mirrors `api/config.SUPPORT_ADDRESS`); 268 `replyWords(n)`.
  - 274–283 `AskMark` — the 20px stream-and-dot SVG (dot `#c0392b`).
  - 285–491 `SupportForm({onOpenProfile, onAsk})` — GET `/support` (meta: categories, reply_days, billing_reply_days, email, requests), POST `/support`; "Message sent" state 349–380; form 382–490.
  - 496–513 subscription helpers: `STAGE_CLASSES`, `MONTHS`, `todayISO`, `fmtValidity` ("DD-Mon-YY"), `scopeRows(scope)`.
  - 518–1154 `Settings` default export — props `view, setView, onOpenProfile, onAsk, onSignOut, onSubscribe, onAccountSaved, syncTick, trial, onErased, legalDoc, setLegalDoc`.
    - 529–553 state: `ent, invoices, busy ("docx"|"pdf"|"erase"|"inv-<n>"|""), confirmOpen, confirmText, failMsg, receipt, finalOpen, downloadConfirmed, didDownload, marketing (null=unknown), mktBusy, mktNote`.
    - 555–562 GET `/account` → `marketing_email` (re-runs on `syncTick`); 567–589 `saveMarketing` POST `/account/marketing-email` (optimistic, rollback on fail).
    - 592 `fetchEntitlement()` → GET `/entitlement` on `syncTick`; 597–603 GET `/invoices` → `invoices[]`.
    - 622 `onTrial = trial || ent.status==="trial" || ent.plan_id==="trial"`; 625–628 effect kicks her out of `personal`/`data` views if trial lands.
    - 630–650 `download(fmt)` GET `/data-rights/export?format=docx|pdf` → blob → `<a download="aruvi-your-data.{fmt}">`.
    - 655–673 `downloadInvoice(number)` GET `/invoices/{encodeURI(number)}` → blob → `Meyy-invoice-{number with / → -}.pdf`.
    - 679–706 `erase()` — gate 1 typed "erase", gate 2 `downloadConfirmed` else opens final window; POST `/data-rights/erase` `{confirm:"erase", downloaded_confirmed:true}` → `receipt`; calls `onErased()` (shell ends session).
    - 708–721 farewell render; 726 `back = null` (no in-content back links — the bar's ✕ is the exit).
    - 731–733 view `personal` (trial-hidden); 736–863 view `subscription`; 865–884 view `data` (trial-hidden); 889–892 view `support`; 894–906 view `about`; 915–962 view `legal`; 965–1153 view `home`.
- `web/app/components/ThemeToggle.jsx` (41) — 3-state cycle button (`system → light → dark`), glyphs `◐ ☀ ☾`, drives `window.__aruviTheme.set()`; hidden ≥601px by CSS (`.hdr-theme`).
- `web/app/layout.jsx` 29–62 — no-flash theme script: localStorage `aruvi-theme`, writes `data-theme` + `data-theme-effective`, updates `<meta theme-color>` (#14332a dark / #164436 light), exposes `window.__aruviTheme {get,set}`.
- `web/app/components/Dropdown.jsx` (205) — button + fixed-position listbox replacing `<select>`; keyboard (Arrows/Home/End/Enter/Space/Escape/Tab), `aria-activedescendant`, closes on outside mousedown / Escape / resize / page scroll (not list scroll), flips above when below is tight. Live uses: Settings ×3 (Role, State, Support Subject) + SubscribeFlow ×4 (Role, State, cart Subject, cart Stage). (The brief's "8 uses" counted Allocate's chapter adder, which is no longer on disk; `Readiness.jsx` has its own `MultiDropdown`/`PagedDropdown`, dead code.)
- `web/app/components/PrivacyNotice.jsx` (90) — bare fetch GET `/legal/privacy[?version=]` (NO identity header), renders `renderMarkdown(doc.body,"pn")`, version line; `frame` mode only on Login (not Settings).
- `web/app/components/Agreement.jsx` (293) — `mode="read"` from Settings: GET `/legal/consent` (via getJSON, signed in), acceptance line (`state.accepted / prior_version / accepted_at / accepted_version`), intro, five acknowledgements, agreement body, version line. Sign-mode pieces (ticks, tally, accept, marketing tick, privacy sheet) are SubscribeFlow's.
- `web/app/page.jsx` (relevant blocks)
  - 15, 20–21 imports Settings, AskAruvi, `primeBank, clearBank, refreshBank`.
  - 74 `askOpen`; 111–114 `refreshBank()` on every signed-in load (ETag check); 142 `entTrial`.
  - 306–333 measures `--nav-h`, `--hdr-h`, `--bnav-h` (ResizeObserver on `.topbar` and `.bnav`).
  - 632–638 `onEnter` → `primeBank()` at sign-in; 650–656 `onErased` (setErased, clearUser, signOutAuth, clearTeacherCaches); 658–675 `onSignOut` (clearTeacherCaches → clearBank inside).
  - 846–885 entitlement sync (focus / visibilitychange / 20s interval) → `entLapsed`, `entTrial`, `paidScopes`.
  - 897–980 Settings context: `settingsOriginRef`, `settingsView`, `profileViaSettings`, `legalDoc`, `goSettings`, privacy-note (`GET /legal/privacy/status`, `POST /legal/privacy/seen`), `readPrivacyNote`, `openProfileFromSettings`, `settingsClose`, `inSettingsBar`, `settingsBarLabel`.
  - 1065–1066 `activeNav` — Settings/profile light NOTHING.
  - 1212–1213 header gear `.hdr-gear` → `goSettings`; 1227–1244 frozen `.set-bar` (⚙ + label, ✕).
  - 1273–1281 `.pn-note` "Privacy Notice has been updated" bar (Read it / Dismiss).
  - 1315–1324 `<Settings …/>` mount under `editFlow === "settings" && ready`.
  - 1374–1420 `.bnav` (four items; Ask Meyy toggles `askOpen`, the three destinations `setAskOpen(false)` first).
  - 1448 `<AskAruvi onClose autoFocus={tour == null} />`.
- `web/app/ask-aruvi/AskAruvi.jsx` (291) — 24–35 autofocus rule (≥601px only, never during tour); 36–38 `query, openCat, openPair`; 45–51 `kb` from `loadBank()` sync then `refreshBank()` if empty; 59–62 `markedCat` (single moving rail); 64–65 `search()`; 68–74 `catMap`, `byCat`; 77–83 Escape closes + body scroll lock; 91–183 render (scrim → panel → `.aa-top` title bar → `.aa-search` → `.aa-body` with 3 states: no bank / search results / browse categories); 185–259 scoped `<style jsx>`; 262–275 global `.aa-item*` styles; 280–291 `Answer` row.
- `packages/shared/src/ask-aruvi/bank.js` (103) — keys `aruvi_ask_bank`, `aruvi_ask_bank_etag`; `loadBank()` sync; `refreshBank()` GET `/ask-aruvi` with `If-None-Match` (304 → stored); `primeBank()`; `clearBank()`.
- `packages/shared/src/ask-aruvi/askAruviSearch.js` (90) — `normalize`, `tokenize`, `search(pairs, query)` → `null | {count, results}`; field weights keyword 3 / question 2 / answer 1, prefix match ≥3 chars, sort by matched-count → score → original order.
- `packages/shared/src/signout.js` — `clearTeacherCaches()` calls `clearBank()`; `TEACHER_CACHE_PREFIXES` includes `aruvi_ask_bank`.

## Mobile counterpart map

- `mobile/app/(app)/index.jsx` 269–286 — the FOOT card: one line `"{ent.status}[ · {used} of {cap} trial chapters used]"` (only when `ent.enforced`), three-segment theme picker Auto / Light / Dark. Header comment (line 10) names it interim "until Settings (step 6)".
- `mobile/components/Bar.jsx` 50–56 — the ⚙ gear is MOUNTED but `disabled={!onSettings}`; no screen passes `onSettings` (index/prepare/lessons pass only `user`). Identity + "Log out" (`endSession`) are on the bar (web parity).
- `mobile/lib/session.js` — `endSession(router)`: `signOutAuth()` + `clearTeacherCaches(EXTRA)` (same 4 extra prefixes as page.jsx) + `router.replace("/login")`. This is the phone's `onSignOut`.
- `mobile/theme/ThemeContext.jsx` (22) — `pref` (`system|light|dark`) under storage key `aruvi-theme` (same key as web), resolved against `useColorScheme()`; `t` = light/dark token set. Not cleared by sign-out (device preference) — matches web.
- `mobile/components/Markdown.jsx` (55) — `parseMarkdown` blocks → Text/View (h2/h3/p/hr/ul/table-as-cards). Used by privacy.jsx; would serve Agreement read mode too.
- `mobile/app/privacy.jsx` (45) — pre-sign-in Privacy Notice (bare GET `/legal/privacy`, title, Markdown, "Version {v}", "← Back" foot). Reached from login.jsx:167. No `?version=`, no `older`-version hint, no `published · language` line.
- `mobile/app/login.jsx` 20, 76 — `primeBank()` at OTP success (bank priming DONE).
- `mobile/components/BottomNav.jsx` (111) — the four items; `onAsk` wired in `(app)/_layout.jsx:57` to `() => {}` (inert by design until step 6). Comment says Settings "hides the bar entirely" — STALE vs web 2026-09-14 (bar up in Settings).
- `mobile/theme/tokens.js` — `sec_a…sec_d(_bg)`, `ss_plum` in both light and dark: the Ask Meyy category palette IS present (confirmed).
- `mobile/theme/web.js` — NO `set_*`, `acct_*`, `sup_*`, `lgl_*`, `dd_*`, `aa_*`, `ob_field`/`login_field`, `pn_note` keys; only `hdr_gear`, `bnav*`, `fr_cta`, `fr_link` exist.
- Native deps present in `mobile/package.json`: `react-native-svg`, `expo-sqlite` (storage). ABSENT: `expo-file-system`, `expo-sharing`, any picker/sheet lib, `expo-web-browser`, `expo-clipboard`.
- No Settings route, no Ask Meyy component, no Dropdown equivalent exist under `mobile/`.

## Inventory table

### A. Entry, chrome and exit (page.jsx)

| # | Feature / UI element | Web ref (file:lines) | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| A1 | Header gear `⚙` (`.hdr-gear`, aria "Settings", `data-tour="settings-gear"`) opens Settings | page.jsx:1212–1213 | PARTIAL | Bar.jsx:50–56 | a `/settings` route; `Bar onSettings` prop | Gear rendered but disabled; every screen must pass `onSettings={() => router.navigate("/settings")}` (or Bar defaults it). |
| A2 | `goSettings()` — records origin tab (`settingsOriginRef` = editFlow at gear-press), resets `settingsView="home"`, `legalDoc="agreement"`, sets `editFlow="settings"`, `tab="myplans"` | page.jsx:903–907 | MISSING | — | router | Native: a `/settings` stack route; origin restore is what `router.back()` gives for free. |
| A3 | Frozen Settings bar `.set-bar` in the top bar: `⚙` + `settingsBarLabel`, ✕ right (`aria-label="Close {label}"`) | page.jsx:1227–1244; globals.css:4362–4373 | MISSING | — | web.js keys `set_bar, set_bar_title (19px display 600), set_bar_gear (20px ink-soft), set_bar_x (15px)`; `--nav-h` | Replaces the tab row slot; no hairline under it. Bar label is the CARD'S OWN WORDS. |
| A4 | `settingsBarLabel` map: personal→"Personal profile", subscription→"Subscription & billing", data→"Your data & export", support→"Support", about→"About Meyy", legal→"Legal", profile-via-settings→"Teaching profile", else "Settings" | page.jsx:977–980 | MISSING | — | A3 | Exact strings. |
| A5 | `settingsClose()` — ✕ closes THE ITEM THE BAR NAMES: `erased` → `onSignOut()`; profile-via-settings → Settings home (restores editFlow); any subview → home (and `legalDoc="agreement"`); home → origin tab (`lessonplans`→goLessons, `profile`→goProfile, else goClasses) | page.jsx:948–970 | MISSING | — | A2, D-rows | Native: subviews as pushed screens → ✕ = `router.back()`; home ✕ = back to origin. Erased branch must still route to `/login`. No back arrow — ONE control in one slot (2026-08-24 rule). |
| A6 | Bottom nav stays UP in Settings; `activeNav` lights nothing (`editFlow === "profile" \|\| "settings"` → "none") | page.jsx:1065–1066, 1350–1362 | PARTIAL | (app)/_layout.jsx:22, BottomNav.jsx:14–19 | `active=null` when pathname is `/settings*` | `_layout.jsx` derives `active` only from `/lessons`; a `/settings` path would light "classes". Header comment in BottomNav ("hides the bar entirely") is stale. |
| A7 | `--bnav-h`/`--hdr-h`/`--nav-h` measured live; Settings inner stickies use `--nav-h` | page.jsx:306–333 | WEB-ONLY-BY-NATURE | Bar.jsx `BAR_CONTENT_H = 64` | — | Native layout replaces the measurement (assessment §3). |
| A8 | Privacy-note bar `.pn-note` (`role="status"`): "Meyy's Privacy Notice has been updated (version {current_version})." + "Read it" (→ Settings › Legal on privacy, stamps `updated_note_read`) + "Dismiss" (stamps `updated_note_dismissed`); hidden while in Settings › Legal | page.jsx:909–935, 1273–1281; css:5259–5270 | MISSING | — | GET `/legal/privacy/status` (once per sign-in), POST `/legal/privacy/seen {context}`; web.js `pn_note*` | Renders at the top of `.bodycontent` on every shell screen; only on a REAL version bump (`d.updated`). |
| A9 | `<Settings …/>` mount props: `view/setView, legalDoc/setLegalDoc, onAccountSaved (bumps entSyncTick), onOpenProfile, syncTick=entSyncTick, trial=entTrial, onSubscribe, onAsk, onSignOut, onErased` | page.jsx:1315–1324 | MISSING | — | entitlement sync (page.jsx:846–885) | Phone has `fetchEntitlement` in index.jsx but no `entTrial`/`entLapsed`/`entSyncTick` shell state. |
| A10 | Entitlement re-sync on focus / visibility / 20s while signed in → `entTrial`, `entLapsed`, `paidScopes` | page.jsx:846–885 | PARTIAL | index.jsx:120 (one-shot per load) | GET `/entitlement` | Native: `AppState` "active" listener + interval. Needed for Settings' trial-hiding and Subscribe button. |
| A11 | `onSignOut` — idempotent; `clearUser`, `signOutAuth`, `clearTeacherCaches(4 extra prefixes)` (incl. `clearBank`), resets shell state | page.jsx:658–675 | DONE | session.js:19–23 | shared/signout.js | Phone version also `router.replace("/login")`. |
| A12 | `onErased` — `setErased(true)`, clear user + auth + caches, but `user` NOT cleared from React state so the farewell stays mounted; `settingsClose` then exits to front door | page.jsx:650–656 | MISSING | — | H-rows | Native: after the receipt, clear caches; farewell screen; its "Done" AND the bar ✕ both `router.replace("/login")`. |

### B. Settings HOME list (`view === "home"`, Settings.jsx:965–1153) — order is by frequency (founder 2026-09-11)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| B1 | `.setwrap` container (max-width 560), no page heading | Settings.jsx:966; css:4320 | MISSING | — | web.js `setwrap` | |
| B2 | Card "Teaching profile" / "Subjects, classes, sections and periods you teach" › → `onOpenProfile` (page.jsx `openProfileFromSettings`: TeachingProfile under `editFlow="profile"`, `profileViaSettings=true`, bar reads "⚙ Teaching profile", `onBack=null`) | 977–981; page.jsx:936–939, 1295–1313 | MISSING | — | TeachingProfile port (other family); `.set-bigcard` measures | `.set-bigcard`: 9px 14px pad, 10px radius, `--card-bg`, `--line` border, hover pine; `.set-biglab` 14.5px display 600; `.set-bigsub` 11px body ink-soft; `.set-chev` "›". |
| B3 | Card "Help" / "Ask Meyy guide" › → `onAsk` (opens Ask Meyy overlay over Settings) | 982–986 | MISSING | — | Ask Meyy (§I) | On the web the overlay opens over Settings with the bar still live (scrim stops at `--bnav-h`). |
| B4 | Card "Support" / "Write to us — we reply by email" › → `setView("support")` | 987–991 | MISSING | — | §F | Never hidden on trial. |
| B5 | Card "Subscription & billing" / "Plan, billing & usage" › → `setView("subscription")` | 992–996 | MISSING | — | §D | |
| B6 | Card "Personal profile" / "Your name, email, role and school details" › → `setView("personal")` — HIDDEN when `onTrial` | 997–1004 | MISSING | — | §C; `onTrial` | |
| B7 | Static card "Appearance" / "Light or dark, or follow your phone" with `<ThemeToggle/>` in the chevron slot (`.set-bigcard-static.set-appearance`; whole card hidden ≥601px) | 1015–1022; css:4357–4359 | PARTIAL | index.jsx:278–284 (3-segment picker at the foot of My Classes); ThemeContext.jsx | ThemeContext `pref/setPref` | Phone control exists but in the wrong place and a different shape (segments vs a cycling glyph button). Port: card + a control. Founder call: glyph-cycle (web) or segmented (current phone)? See open Q1. |
| B8 | ThemeToggle: cycles `system→light→dark`, glyph `◐/☀/☾`, aria/title "Theme: Auto (follows your phone)" / "Theme: Light" / "Theme: Dark"; persists `aruvi-theme`; effective theme + `<meta theme-color>` | ThemeToggle.jsx:11–40; layout.jsx:29–62 | PARTIAL | ThemeContext.jsx:11–17 (same key, same 3 values) | — | Phone: `StatusBar` style should follow `scheme` (web sets theme-color #14332a/#164436). Dark on web is ≤600px-only; on phone always applies (technical divergence, already the case). |
| B9 | Static card "Marketing emails" / "Occasional news on new subjects, features and teaching ideas — receipts, replies and agreement notices are sent either way" with `.set-switch` checkbox (aria "Send me occasional emails about new subjects and features"); rendered ONLY once `marketing !== null` (answer known); UNGATED (shown on trial + lapsed) | 1023–1034; css:5106–5109 | MISSING | — | GET `/account` → `marketing_email`; POST `/account/marketing-email {enabled}` | Native: RN `Switch` (22px web checkbox, `accent-color: --pine`). Optimistic flip, rollback on failure. |
| B10 | Marketing save note `.set-hint`: "Saved — you'll hear from us occasionally." / "Saved — no more marketing emails." / fail: server `detail` or "Couldn't save that just now — try again." | 567–589, 1035 | MISSING | — | B9 | |
| B11 | Card "Legal" / "User agreement & privacy notice" › → `setView("legal")` — shown on trial too | 1039–1043 | **DONE 2026-09-16** | `settings/index.jsx` → `/settings/legal` | §G | |
| B12 | Card "About Meyy" / "Version info" › → `setView("about")` | 1044–1048 | **DONE 2026-09-16** | `settings/index.jsx` → `/settings/about` | §H | |
| B13 | Group caption `.set-cap` "Account" (mono 10px uppercase .09em) over a `.set-card` of `.set-row`s | 1054–1056; css:4333–4336, 4374–4380 | MISSING | — | web.js `set_group, set_cap, set_card, set_row (9px 14px, 13px body, hairline `--line-soft` between rows)` | The only caption that survives (it sits over the destructive row). |
| B14 | Row "Your data & export" › → `setView("data")` — HIDDEN when `onTrial` | 1057–1062 | MISSING | — | §E | |
| B15 | Row "Log out" → `onSignOut` (no chevron) | 1063–1065 | PARTIAL | Bar.jsx:59–62 ("Log out" on the bar) | session.js | The bar's Log out exists (web parity); the Settings ROW is missing. |
| B16 | Row `.set-row-danger` "Delete my account…" › → `setConfirmOpen(true)` (label in `--danger`) | 1066–1069; css:4394 | MISSING | — | §H2 | |
| B17 | Inline typed-confirm block `.acct-del` (danger border): "This permanently deletes your account and all your data — it cannot be recovered afterwards. Type **erase** to continue; we'll ask you to confirm you have your data before anything is deleted." · input `.acct-del-input` placeholder `Type "erase"` (autoFocus, mono, 110px) · button "Continue →" (`.acct-del-go`, disabled until text == "erase" case-insensitive or busy) · "Cancel" (`.acct-del-cancel`, clears text) | 1073–1095; css:4208–4213, 4308–4314 | MISSING | — | H-rows | autoFocus on a phone raises the keyboard — acceptable here (she asked for the field). |
| B18 | `failMsg` line `.acct-fail` (`role="alert"`) under the home list | 1151 | MISSING | — | — | Strings: "Couldn't prepare your download right now. Try again in a moment." / "Couldn't fetch that invoice right now. Try again in a moment." / "Couldn't delete the account right now. Nothing was removed — try again." |

### C. Personal profile subview (`view === "personal" && !onTrial`, `PersonalProfile`, Settings.jsx:71–221)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| C1 | Mount: GET `/account` → `display_name, role, state, city, school_name, email, phone, account_id`; `emailStage = email ? "ok" : "enter"`; loading `.fr-loading` "Loading…" | 86–94, 122 | MISSING | — | GET `/account`; `withUser` | |
| C2 | `.setwrap.setwrap-tight` (margin-top −12px), no heading | 124–125; css:4144 | MISSING | — | | |
| C3 | Field "Your name" (label above, `.login-field.ob-field`), placeholder "Enter your full name" | 128–130 | MISSING | — | web.js `login_field / ob_field` (label mono uppercase; input `--field-bg`, 7px radius, 11px 12px) | `Field`/`Input` in mobile/components/ui.jsx are the nearest existing primitives. |
| C4 | Read-only row `.acct-row` "MOBILE" (`.acct-k` mono 10.5px, width 92) / `{acct.phone \|\| "—"}` | 131–132; css:4195–4200 | MISSING | — | web.js `acct_row, acct_k, acct_v` | Never editable — it is her sign-in. |
| C5 | Email stage `ok`: field "Email" as `.ob-email-view` (field-styled box) showing the FULL address at `emailFit` size step + link "change" (`.fr-link`) → stage `enter` | 134–146; css:4113–4143 | MISSING | — | `emailFit` (port as-is: 22/28/36 char thresholds) | Never masks, never truncates; wraps `anywhere` as last resort. |
| C6 | Stage `enter`: field "New email" (type email, autoComplete off, placeholder "Enter your email"); `emailErr` (`.ob-err`, role alert); link "Confirm this email →" only when `EMAIL_OK(emailNew)` | 147–162 | MISSING | — | `EMAIL_OK` | keyboardType "email-address". |
| C7 | Stage `confirm`: field "Re-enter your email" (autoFocus, placeholder "Type it again to confirm"); link "Verify →" / "Checking…" (disabled unless `EMAIL_OK(email2)` or busy). Logic: mismatch → "The two entries don't match — try again." + clear; `idInUse(emailNew, account_id)` → GET `/onboarding/known?id=` → taken → `EMAIL_TAKEN` ("This email is already in use by another Meyy account. Use a different address.") back to `enter`; else commit `email`, stage `ok` | 163–190 | MISSING | — | shared `idInUse`; `EMAIL_TAKEN` (currently exported from SubscribeFlow.jsx:15 — phone needs it from shared or its own copy) | |
| C8 | Field "Role" → `<Dropdown options={ROLES} placeholder="Select your role">` (ROLES = Teacher · Academic coordinator · Head of school · Other) | 192–194; SubscribeFlow.jsx:65 | MISSING | — | Dropdown native answer (§J); ROLES/STATES move to shared or a phone constants file | |
| C9 | Field "State" → `<Dropdown options={STATES} placeholder="Select your state">` (22 states + "Other", SubscribeFlow.jsx:66–69) | 195–197 | MISSING | — | §J | 23 options — needs a scrolling sheet/picker. |
| C10 | Field "City" placeholder "Enter your city"; field "School name (optional)" placeholder "Enter your school name" | 198–203 | MISSING | — | | |
| C11 | Save button `.primary.fr-cta.ob-cta` "Save" / "Saving…" → POST `/account` `{name, email, role, state, city, school}`; success → `onSaved()` (page bumps `entSyncTick`, view → home); 4xx → server `detail` via `errDetail`, else "Couldn't save right now — try again." | 96–120, 212–213 | MISSING | — | web.js `fr_cta` exists | Email is only included as the last CONFIRMED value — a half-done change is not saved. |
| C12 | Quiet note when `emailStage !== "ok"`: "Email isn't saved until you confirm it — everything else saves now." · `note` line `.ob-quiet` | 214–218 | MISSING | — | | |
| C13 | Marketing consent deliberately NOT here (lives on home, B9) | 205–207 | — | — | | Product rule; do not "tidy" it back. |

### D. Subscription & billing subview (`view === "subscription"`, Settings.jsx:736–863)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| D1 | `lapsed = ent.lapsed ?? (ent.enforced && status==="expired")`; `active = ent && !lapsed && plan_id!=="trial" && status in (active, grace)` — does NOT require `enforced` | 743–753 | MISSING | — | GET `/entitlement` fields `lapsed, enforced, status, plan_id, scopes, scope_valid_until, valid_until, live_scopes, trial_chapters_used, trial_chapter_cap` | Phone foot line (index.jsx:276) gates the counter on `enforced` — the OPPOSITE of the web's 2026-09-11 rule; drop that gate in the port. |
| D2 | `subs[]` = one row per `ent.scopes[]` with `until` (`scope_valid_until[scope] \|\| valid_until`), `live` (`live_scopes.includes` or date fallback `todayISO`), sorted by `until` desc then cart order | 755–763 | MISSING | — | | |
| D3 | Status card `.set-card.set-card-pad.set-first`: on trial → pill "Free trial" + "{trial_chapters_used} of {trial_chapter_cap} chapters used"; lapsed → pill `.set-pill-off` "Ended" + "Your plans remain yours to open, export and print"; neither → "Your plan details will appear here." | 770–782; css:4397–4403 | PARTIAL | index.jsx:275–277 (raw `status · used of cap trial chapters used`) | web.js `set_plan, set_pill (mono 10px uppercase, 12px radius, pine), set_pill_on (ochre), set_pill_off (clay), set_plan_txt (12.5px)` | Phone shows raw status word, not these strings. |
| D4 | One `.set-sub-card` per subscription: pill "Subscribed"(`set-pill-on`)/"Ended"(`set-pill-off`); ledger rows SUBJECT `{pretty(subj)}` · STAGE `{pretty(stage)}` · CLASS (`STAGE_CLASSES`: preparatory "3, 4 & 5", middle "6, 7 & 8", secondary "9 (10 coming soon)"; `*` → "All subjects"/"All stages"/"3 to 10") · VALIDITY "until {DD-Mon-YY}" or "ended {DD-Mon-YY}" (`.set-scope-done` clay) | 796–817, 496–513; css:4407–4415 | MISSING | — | `fmtValidity`, `scopeRows` (pure, port as-is) | |
| D5 | INVOICE row inside the sub card: `invoices.find(scopes includes scope)`; if `has_pdf` → link `.fr-link.set-inv-dl` "{number} ↓" / "Preparing…" → `downloadInvoice`; else plain number | 818–834; css:4410 | MISSING | — | GET `/invoices` → `{invoices:[{number, scopes[], has_pdf}]}`; GET `/invoices/{number}` (PDF blob) → filename `Meyy-invoice-{number//→-}.pdf`; expo-file-system + expo-sharing | Download site #1 of 4. Native: write to cache dir, open share sheet. |
| D6 | "Subscribe" button `.paywall-subscribe.set-subscribe` when `onTrial \|\| lapsed` → `onSubscribe` (SubscribeFlow overlay) | 840–844; css:3983–3986, 4158 | NOT-PORTED-BY-DECISION | — | SubscribeFlow (beta = manual grants) | Founder decision: no purchase screen in the app. Port needs a replacement sentence or nothing (open Q3). |
| D7 | "Add subjects & stages" button + hint "Anything you add runs for a full year from the day you add it, alongside what you already have." when `active && !onTrial` | 849–857 | NOT-PORTED-BY-DECISION | — | SubscribeFlow | Same. |
| D8 | `failMsg` `.acct-fail` (invoice failure) | 858 | MISSING | — | | |
| D9 | Closing hint `.set-hint`: "Online payments open soon. Your invoices are here already — one per purchase, on the subscription it paid for." | 859–860 | MISSING | — | | Copy may need a phone variant if D6/D7 are absent (open Q3). |

### E. Your data & export subview (`view === "data" && !onTrial`, Settings.jsx:865–884)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| E1 | Hint `.set-hint.set-first`: "Everything you've created — your profile, notes and teaching progress — in one document." | 869–870 | MISSING | — | | |
| E2 | `.set-card` with two `.set-row`s: "Download as Word" / "Preparing…" → `download("docx")`; "Download as PDF" / "Preparing…" → `download("pdf")`; both disabled while any `busy` | 871–880 | MISSING | — | GET `/data-rights/export?format=docx\|pdf` → blob → `aruvi-your-data.{fmt}`; expo-file-system + expo-sharing | Download sites #2 and #3. Route is ungated (§2.5) even though the card is trial-hidden. |
| E3 | `failMsg` "Couldn't prepare your download right now. Try again in a moment." | 646, 881 | MISSING | — | | |
| E4 | `didDownload` set true after a successful export (only to word the final delete question) | 643 | MISSING | — | H5 | |

### F. Support subview (`view === "support"`, `SupportForm`, Settings.jsx:285–491) — never hidden on trial

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| F1 | Mount: GET `/support` → `meta {categories[{key,label}], reply_days, billing_reply_days, email, requests[]}`; three-state: `emailKnown = meta && !metaErr`, `hasEmail`; failure → `metaErr` (never invents "no email") | 301–320 | MISSING | — | GET `/support` | Rule: a screen may say it does not know; never invent an answer about her record. `requests` deliberately unread (history list struck 2026-09-04). |
| F2 | Hint `.set-hint.set-first`: "Most questions about how Meyy works are answered straight away by Ask Meyy. For anything else, write to us below." | 391–392 | MISSING | — | | |
| F3 | Big card `.set-bigcard.sup-ask`: `AskMark` (20px, pine) + "Ask Meyy" / "Answers about how Meyy works — instantly" › → `onAsk` | 393–398, 274–283; css:4434–4436 | MISSING | — | react-native-svg (path data same as BottomNav's AskIcon) | Deflect before inviting — sits ABOVE the form. |
| F4 | Group caption "Write to us" + `.set-card.set-card-pad` form | 401–403 | MISSING | — | | |
| F5 | To row `.sup-to-row` (row direction): label "To" + value `support@meyy.in` (`.sup-to`, ink-soft, 14px body, not a field) | 410–413; css:4454–4460 | MISSING | — | `SUPPORT_ADDRESS` constant (hardcoded, mirrors api/config) | A VALUE, not a tappable field. |
| F6 | Field "Subject" → `<Dropdown placeholder="Choose one" ariaLabel="Subject">` over `cats` (server categories or `SUPPORT_FALLBACK`: problem "Something isn't working" · plan "Something in a lesson plan looks wrong" · billing "Billing or account" · suggestion "A suggestion" · other "Something else"); NO preselection | 414–421, 257–263 | MISSING | — | §J native picker/sheet | Labels wrap ("Something in a lesson plan looks wrong" is two lines at 360px). |
| F7 | Field "Your message" → `<textarea.sup-text rows=7 maxLength=4000>` NO placeholder; min-height 130px, resize vertical | 422–429; css:4471–4475 | MISSING | — | | Native: multiline TextInput, ~7 lines; on 360×800 Send must sit inside the fold (founder). |
| F8 | Counter `.ob-quiet` "{n} characters left" only when `text.length > 3500` | 432–434 | MISSING | — | | |
| F9 | Reply-to line (only `hasEmail`): "Our reply goes to **{meta.email}**." (`.sup-replyto`, full address, `overflow-wrap: anywhere`) | 454–457 | MISSING | — | | |
| F10 | No-email line (only `emailKnown && !hasEmail`): "There is no email address on your account, so we cannot write back — add one under Personal profile, or write to us directly at support@meyy.in." | 463–467 | MISSING | — | | Trial accounts (mobile only) hit this — the common case. |
| F11 | `err` `.ob-err` (role alert) · Send button `.primary.fr-cta.ob-cta` "Send message" / "Sending…", disabled unless `cat && text.trim() && !busy` → POST `/support` `{category, message, context:{screen:"Settings › Support"}}`; 4xx → server `detail`, else "Couldn't send that just now — try again." | 322–346, 468–471 | MISSING | — | POST `/support` → `{reference, emailed, email, reply_window, reply_days}` | Phone context string could read `"Settings › Support"` too (same screen name) — or a phone marker; open Q4. |
| F12 | "Message sent" state: `<h1.set-title>` "Message sent" (the ONE subview that keeps a heading — it is a state); card: caption `.sup-refcap` "Your reference" + `.sup-ref` `{sent.reference}` (mono 22px pine, e.g. `MEY-S-742`); paragraph if `emailed`: "A copy is on its way to **{email}**. You can expect a response within {reply_window \|\| replyWords(reply_days \|\| 2)}, Monday to Friday." else "Your message is with us and you can expect a response within {…}, Monday to Friday. There is no email address on your account, so write to us at **support@meyy.in** — quote your reference — and we will reply there." | 349–367; css:4476–4480 | MISSING | — | `replyWords` | Reply window comes from the SERVER (resolved once). |
| F13 | Link `.fr-link.sup-addmail` "Or add an email address to your account →" (only `!emailed`) → `onOpenProfile` (→ `setView("personal")`) | 371–375 | MISSING | — | §C; note Personal profile is trial-hidden, but this path opens it anyway on the web (view guard `!onTrial` at 731 then falls through to… the subscription/data/support checks and eventually HOME) — see open Q2 | |
| F14 | Hint: "Quote {reference} if you write to us about this again — it keeps everything in one place." | 376–377 | MISSING | — | | |

### G. Legal subview (`view === "legal"`, Settings.jsx:915–962) — shown on trial

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| G1 | Pinned band `.lgl-stick` (sticky at `--nav-h`, paper fill, hairline below; starts flush under the bar by pulling main's top padding): pill switch `.lgl-switch` (`role=tablist` "Legal documents") "User agreement" / "Privacy notice" (`.lgl-switch-btn`, mono 11px uppercase pills, `.on` = pine fill) + `<h1.ob-title.lgl-stick-title>` "Legal Agreement with User" / "Privacy Notice" | 944–956; css:5215–5245 | MISSING | — | `legalDoc/setLegalDoc` lifted to shell (page.jsx:902); web.js `lgl_stick, lgl_switch, lgl_switch_btn, lgl_stick_title (20px / 18px ≤600)` | Native: a non-scrolling header View above the ScrollView (no sticky needed). |
| G2 | Card `.set-card.set-card-pad.set-legal.set-legal-headless` (`.lgl-head` hidden inside) holding `<PrivacyNotice/>` or `<Agreement mode="read"/>` | 957–959; css:5177, 5238 | MISSING | — | G3, G4 | |
| G3 | `Agreement mode="read"`: `getJSON("/legal/consent")` → `{document:{version, language, intro, acknowledgements[{id,n,title,body}], agreement, final, optional}, accepted, accepted_at, accepted_version, prior_version, prior_accepted_at}`; loading "Loading the agreement…"; fail `.lgl-fail` "The agreement couldn't be loaded just now. Check your connection and try again."; acceptance line `.lgl-accepted` "✓ Accepted on {dateWords} · version {v}" (+ `.lgl-stale` " — a newer version applies from your next subscription" when only `prior_version`) else `.lgl-hint` "You haven't accepted this agreement yet — you'll be asked to when you subscribe. It's here to read at any time."; intro; `<ol.lgl-acks>` of five (`.lgl-ack-n` number, `.lgl-ack-title`, body); `.lgl-agreement` body; `.lgl-version` "Version {v} · English · This agreement is available at any time under Settings › Legal." | Agreement.jsx:80–99, 145–173, 182–206, 236–237 | MISSING | Markdown.jsx (renderer only) | GET `/legal/consent` (signed in); shared `parseMarkdown`, `dateWords`; web.js `lgl_accepted, lgl_tick, lgl_stale, lgl_hint, lgl_intro, lgl_ack*, lgl_agreement, lgl_version` | Sign-mode pieces (ticks, tally, accept, marketing tick, privacy sheet) are SubscribeFlow's — NOT-PORTED-BY-DECISION. |
| G4 | `PrivacyNotice` (read, unframed): bare fetch GET `/legal/privacy` (no identity); loading "Loading the privacy notice…"; fail "The privacy notice couldn't be loaded just now. Check your connection and try again."; `older` hint "This is version {v}, which you were shown. The current notice is version {current}." (only with `?version=`); body via `renderMarkdown(…,"pn")` incl. pipe tables (`data-th`, stacked ≤600px); `.lgl-version` "Version {v} · {dateWords(published)} · English · This notice is available at any time under Settings › Legal." | PrivacyNotice.jsx:41–80 | PARTIAL | privacy.jsx (pre-sign-in screen only; "Version {v}" only; no published/language line; no `?version=`) | Markdown.jsx tables DONE | Reuse privacy.jsx's body as a component inside Settings › Legal; add the published/language line. |
| G5 | `dateWords` en-IN "27 August 2026" | shared/legalmd.js:132–137 | DONE | shared | | |

### H. About, farewell, delete flow

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| H1 | About subview: card `.set-plan-txt` "Meyy · Lesson Studio — preview build." / "NCF 2023 aligned." + hint "Version details will live here. The user agreement and privacy notice are under Settings › Legal." | 894–906 | MISSING | — | | Phone may add build/version from `expo-constants` (capability the phone adds — name it in the header). |
| H2 | Final window `.acct-final-bg` (fixed scrim, click-outside closes) › `.acct-final` modal: kicker "Last step"; `<h2>` "Have you downloaded your Meyy data?"; p "Everything — your lesson plans, your teaching profile, your chapter notes and your progress — is deleted permanently and cannot be recovered. The download is the only copy you can keep."; p `.acct-final-inv` "Your invoices are kept as tax records, but you will no longer be able to download them here — save any you need from Subscription & billing first." | 1104–1121; css:4280–4292 | MISSING | — | RN `Modal` | Opened by `erase()` when typed "erase" but `!downloadConfirmed`. |
| H3 | Button `.acct-final-dl` "Download my data first (Word)" / "Preparing…" (only `!didDownload`) → `download("docx")` — WORKS ON TRIAL (the one export a trial keeps) | 1122–1127; css:4293–4299 | MISSING | — | E2 machinery (download site #4) | |
| H4 | Checkbox `.acct-final-check` "I confirm I have downloaded my Meyy data." (`accent-color: --clay`) + note "Your confirmation is recorded against your account." | 1128–1135; css:4300–4306 | MISSING | — | | Recorded server-side via `downloaded_confirmed: true`. |
| H5 | Row: "Delete forever" / "Deleting…" (`.acct-del-go`, disabled unless checked) → POST `/data-rights/erase` `{confirm:"erase", downloaded_confirmed:true}`; "Cancel" (closes, unchecks) | 1136–1146, 679–706 | MISSING | — | POST `/data-rights/erase` → receipt `{kept:[…], …}`; A12 | Failure: "Couldn't delete the account right now. Nothing was removed — try again." |
| H6 | Farewell (`receipt` set — replaces the whole Settings tree): `.acct-farewell` "Your account and all your data have been deleted." + " Backup copies are purged within 30 days." when `receipt.kept.length > 0`; button `.primary.acct-bye` "Done" → `onSignOut` | 708–721; css:4316–4317 | MISSING | — | A12 | Both Done and the bar ✕ land at the front door. |

### I. Ask Meyy overlay (AskAruvi.jsx + shared bank/search)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| I1 | Opened from the bottom bar "Ask Meyy" (toggles `askOpen`); the other three items close it and go; Ask Meyy carries clay while open and My Classes / My Lessons do not | page.jsx:1374–1420 | PARTIAL | BottomNav.jsx:97–108 (item rendered, `onAsk={() => {}}` in `_layout.jsx:57`) | an overlay/route + `askOpen` state in `(app)/_layout.jsx` | On the phone: a modal-ish overlay mounted in `(app)/_layout.jsx` ABOVE the Stack but BELOW BottomNav, so the bar stays live. |
| I2 | Also opened from Settings › Help card and Support › Ask Meyy card (`onAsk`) | Settings.jsx:982, 393 | MISSING | — | I1 | |
| I3 | `.aa-scrim`: fixed, `top: var(--hdr-h,72px)`, `bottom: var(--bnav-h,0px)`, `rgba(20,16,10,.34)`, `role=dialog aria-modal=false aria-label="Ask Meyy"`; `.aa-panel` max-width 720, full height, `--paper`, shadow, 16px bottom radius ≥721px | AskAruvi.jsx:91–93, 196–206 | MISSING | — | Bar.jsx `BAR_CONTENT_H`; web.js `aa_scrim, aa_panel` | Native: absolute View from under the Bar to above BottomNav; `accessibilityViewIsModal` FALSE (bar stays operable). |
| I4 | Title bar `.aa-top`: `.aa-q` badge (26px pine circle, white stream-and-dot SVG, dot `#e8b4a0`) + "Ask Meyy" (display 20px 600); ✕ `.aa-close` (aria "Close Ask Meyy") | 96–108, 214–221 | MISSING | — | react-native-svg | Dot colour here is `#e8b4a0` (on pine), not `#c0392b`. |
| I5 | Sticky search `.aa-search`: `<input type=search placeholder="Search…" aria-label="Search questions">` (16px body, `--paper-2`, `--line` border, 10px radius, focus pine); typing clears `openPair` | 111–117, 223–228 | MISSING | — | web.js `aa_search, aa_search_input` | `type=search` clear-x is browser-only; RN `clearButtonMode="while-editing"` (iOS). |
| I6 | Autofocus rule: focus only if `autoFocus` prop AND `matchMedia(min-width:601px)`; page passes `autoFocus={tour == null}` | 24–35; page.jsx:1448 | WEB-ONLY-BY-NATURE | — | | Phone = never autofocus (the founder's step-2 finding: a focused field is half the screen). Name in header. |
| I7 | Result count `.aa-count` (mono 11px uppercase): "No matches — try fewer or different words" or "{n} result"/"{n} results" | 118–124, 229–230 | MISSING | — | | |
| I8 | Bank load: `useState(() => loadBank())` (sync from storage); if null → `refreshBank()` once | 45–51 | MISSING (component) / DONE (shared) | bank.js | shared storage shim (expo-sqlite kv) | `loadBank` is synchronous — the panel never waits on the network. |
| I9 | No-bank state `.aa-empty`: "Ask Meyy needs to download its answers once before it can work offline." / "Open it again when you next have a connection, and it will be ready from then on." (quiet prose, not an error, no spinner) | 129–136, 210–212 | MISSING | — | | |
| I10 | Bank shape: `{ categories:[{id, title, description, tag, accent}], pairs:[{id, category, question, answer, keywords[]}] }`; `catMap` by id, `byCat` grouping | 53–74 | — (data) | — | GET `/ask-aruvi` (behind `X-Aruvi-User`) | `accent` per category resolves against `--sec-a…d` / `--ss-plum` (globals.css:1010–1014 comment: "cat_e's :root --ss-plum"); phone must map the JSON accent value → `t.sec_a…d / t.ss_plum` — the exact accent string format in the JSON needs confirming (open Q5). |
| I11 | Browse mode: five `<section.aa-cat>` with `style={{--accent}}`; header button `.aa-cat-head` (sticky top 0 within `.aa-body`, paper fill, `aria-expanded`): `.aa-cat-bar` 4px rail (painted only on `markedCat`), `.aa-cat-title` (display 16.5px 600), `.aa-cat-desc` (body 13px ink-soft), `.aa-cat-n` count (mono 12px accent), chevron `⌄` rotates when open; tap → toggle `openCat`, set `markedCat`, clear `openPair` | 145–180, 238–258 | MISSING | — | tokens `sec_*`, `ss_plum` (DONE in tokens.js) | ONE moving marker, not five. Sticky category header → RN `SectionList` `stickySectionHeadersEnabled`. |
| I12 | Open category list `.aa-cat-list` of `Answer` rows | 171–177 | MISSING | — | I14 | |
| I13 | Search mode: `.aa-results` — ranked flat list of `Answer` rows with the category `tag` pill (`.aa-item-tag`, mono 9px uppercase, bordered 20px radius); categories disappear entirely | 137–143, 271–272 | MISSING | — | shared `search()` (DONE) | |
| I14 | `Answer` row `.aa-item`: hairline top; button `.aa-item-q` (body 15.5px, `aria-expanded`) with `.aa-item-plus` "+"/"–" (mono 14px; clay when open), question text, optional tag; answer `.aa-item-a` (body 15px ink-soft, `white-space: pre-wrap`, padding-left 24) | 280–291, 262–275 | MISSING | — | web.js `aa_item*` | Answers are plain text with newlines — RN Text preserves `\n`. |
| I15 | Only one answer open at a time (`togglePair`) | 85 | MISSING | — | | |
| I16 | Escape closes; body scroll locked while open | 77–83 | WEB-ONLY-BY-NATURE | — | | Android hardware back should close (BackHandler) — phone-added capability. |
| I17 | `.aa-body` scroll region, padding `0 20px 40px`, `-webkit-overflow-scrolling: touch` | 234–235 | MISSING | — | | |
| I18 | Search algorithm: `tokenize` (a-z0-9 words ≥2 chars, accent strip, light stemming ies/es/s), weights keyword 3 / question 2 / answer 1, prefix hit for tokens ≥3, sort matched → score → index; index memoised on the pair object (`__idx`) | askAruviSearch.js:19–89 | DONE | shared | | Runs on device; no LLM. `normalize` must stay identical to the server-side indexer. |
| I19 | `refreshBank()`: GET `/ask-aruvi` with `If-None-Match: {etag}` only when a stored bank exists; 304 → stored; non-OK/empty → stored; OK → `store(kb, ETag)`; never throws | bank.js:63–84 | DONE | shared | `fetch` on RN honours ETag headers | |
| I20 | `primeBank()` at sign-in (`onEnter`) | page.jsx:632–638 | DONE | login.jsx:76 | | |
| I21 | `refreshBank()` on every signed-in app load (`useEffect([user])`) | page.jsx:111–114 | MISSING | — | | Phone: call in `(app)/_layout.jsx` on mount (and optionally on AppState active). |
| I22 | `clearBank()` at sign-out (via `clearTeacherCaches`) and on erase | page.jsx:658–675, 650–656 | DONE | session.js → shared/signout.js | | |
| I23 | Storage keys `aruvi_ask_bank`, `aruvi_ask_bank_etag`; `loadBank` treats a bank with no `pairs` as absent | bank.js:31–48 | DONE | shared | | |
| I24 | Tour hooks: `data-tour="ask-aruvi-root"` on the panel, `data-tour="ask-aruvi"` on the bar item | 93; page.jsx:1413 | DEFERRED (GuidedTour deferred by plan) | — | | |
| I25 | Dark theme: `.aa-panel` re-declares `--sec-a…d` under `[data-theme-effective="dark"]` | globals.css:3590–3599 | DONE | tokens.js dark block 94–103 | | Confirmed present. |

### J. Dropdown (the seven live uses; native answer)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| J1 | `Dropdown` API: `value, onChange(value), options (string or {value,label,disabled}), placeholder="Select", disabled, className, ariaLabel, id, unsetClass="ob-unset"`; closed button `.dd-btn` (field metrics: `--field-bg`, `--line` 7px radius, 11px 12px pad, body 14px / 16px ≤600) with `.dd-lab` (ellipsis) + chevron; `.dd-unset` grey placeholder | Dropdown.jsx:43–56, 171–184; css:312–333 | MISSING | — | web.js `dd_btn, dd_lab, dd_chev, dd_unset` | Assessment §3: "Native picker / bottom sheet. Its reason to exist is gone." Recommended: a bottom sheet listing options in house paper (matches `.dd-pop` look; 23-state list scrolls), closed control styled as the web's `.dd-btn`. |
| J2 | Open list `.dd-pop` (fixed, z 120, `--paper-2`, 9px radius, shadow, 4px pad, max-height from room; flips above) with `.dd-opt` rows (9px 10px, `.on` = pine 600 = current value, `.active` = `--tint-pine` cursor, `.dd-off` disabled) | 114–128, 185–202; css:336–356 | MISSING | — | | Sheet rows: current value in pine/600. |
| J3 | Close on outside mousedown / Escape (stopPropagation) / resize / page scroll (not list scroll); focus returns to button on pick | 58–95, 138–144 | WEB-ONLY-BY-NATURE | — | | Sheet: backdrop tap + hardware back. |
| J4 | Keyboard: Enter/Space/ArrowDown/ArrowUp open; Arrows/Home/End move (skip disabled); Enter/Space pick; Tab closes; `aria-activedescendant`; active row `scrollIntoView` | 97–103, 146–168 | WEB-ONLY-BY-NATURE | — | | |
| J5 | Use: Settings › Personal profile › Role (ROLES ×4) | Settings.jsx:193 | MISSING | — | J1 | |
| J6 | Use: Settings › Personal profile › State (STATES ×23) | Settings.jsx:196 | MISSING | — | J1 | The scroll-close bug (2026-09-14) is the web's; a sheet has no such trap. |
| J7 | Use: Settings › Support › Subject (5 categories, `{value:key,label}`) | Settings.jsx:418 | MISSING | — | J1 | |
| J8 | Uses: SubscribeFlow About-you Role/State; cart row Subject/Stage (`className="ob-rowdd" unsetClass="ob-ph"`, Stage disabled until Subject) | SubscribeFlow.jsx:454, 457, 582, 590 | NOT-PORTED-BY-DECISION | — | | Purchase flow not in the beta app. |

### K. Strings and endpoints index (for the port's checklist)

| # | Item | Web ref | Mobile status | Mobile ref | Depends on | Notes |
|---|---|---|---|---|---|---|
| K1 | GET `/account` (Settings home + PersonalProfile) · POST `/account {name,email,role,state,city,school}` · POST `/account/marketing-email {enabled}` | Settings.jsx:87, 99, 557, 571 | MISSING | — | | |
| K2 | GET `/entitlement` (`fetchEntitlement`) | 592; shared/format.js:267 | DONE (helper) | index.jsx:120 | | |
| K3 | GET `/invoices` · GET `/invoices/{number}` (PDF) | 599, 658 | MISSING | — | expo-file-system, expo-sharing | |
| K4 | GET `/data-rights/export?format=docx\|pdf` · POST `/data-rights/erase {confirm:"erase", downloaded_confirmed:true}` | 633, 684 | MISSING | — | expo-file-system, expo-sharing | Never gated. |
| K5 | GET `/support` · POST `/support {category, message, context}` | 303, 326 | MISSING | — | | Reference series `MEY-S-…`. |
| K6 | GET `/onboarding/known?id=` (`idInUse`, bare fetch, no identity) | shared/format.js:149–166 | DONE (helper) | shared | | |
| K7 | GET `/legal/consent` (signed in; Settings passes no `userId`) · GET `/legal/privacy[?version=]` (bare) · GET `/legal/privacy/status` · POST `/legal/privacy/seen {context}` | Agreement.jsx:82–85; PrivacyNotice.jsx:45; page.jsx:917, 926 | PARTIAL | privacy.jsx:20 (GET `/legal/privacy` only) | | `/legal/consent` POST is sign-mode only (NOT-PORTED-BY-DECISION). |
| K8 | GET `/ask-aruvi` (ETag / `If-None-Match`) | bank.js:74–78 | DONE | shared | | |
| K9 | localStorage/shared-store keys: `aruvi-theme` (device pref, survives sign-out) · `aruvi_ask_bank` · `aruvi_ask_bank_etag` · `aruvi_user` | layout.jsx:37; bank.js:31–32; format.js:43 | DONE | ThemeContext.jsx:10; shared | | |
| K10 | Download filenames: `aruvi-your-data.docx` / `aruvi-your-data.pdf` / `Meyy-invoice-{MEY-2026-27-NNNN}.pdf` | 639, 663 | MISSING | — | | Keep the same names for the share sheet. |

## Dependency notes

What must land BEFORE this family is complete on the phone:
- **A `/settings` route group + the frozen Settings bar.** The web's `settingsView` state machine (home + 6 subviews + profile-via-settings) maps onto pushed screens; `settingsClose` becomes `router.back()` except the erased branch. `Bar` needs `onSettings` wired on every signed-in screen (or defaulted inside Bar), and `(app)/_layout.jsx` must return `active=null` for `/settings*`. BottomNav's header comment ("Settings hides the bar") must be corrected to the 2026-09-14 rule.
- **Shell entitlement state** (`entTrial`, `entLapsed`, `entSyncTick`) with the web's focus/interval re-sync — Settings' trial-hiding, the Subscribe/Ended states and BottomNav's `showClasses/showAdd` all read it. Today only index.jsx fetches it, once, and gates the counter on `enforced` (contrary to the web's 2026-09-11 rule).
- **Native file delivery**: `expo-file-system` + `expo-sharing` for the four download sites (two exports, invoice PDF, the delete-flow Word export). This is also what MyLessons/YearPlan exports (other families) wait on — one helper (`saveAndShare(blob, filename)`) serves all six sites named in assessment §3.
- **A native Dropdown replacement** (bottom sheet or picker) styled to `.dd-btn` closed / `.dd-pop` open — three Settings uses; measures to be added to `theme/web.js` (`dd_*`).
- **ROLES / STATES / EMAIL_TAKEN** currently exported from `SubscribeFlow.jsx` (not ported) — move to `@aruvi/shared` or a phone constants module before Personal profile can build.
- **theme/web.js measures** for the whole family are absent: `set_*` (setwrap, bigcard, biglab, bigsub, chev, card, row, cap, plan, pill ×3, hint, first, bar ×3, switch), `acct_*` (row/k/v, del block, final modal), `sup_*` (to, text, refcap, ref, replyto), `lgl_*` (stick, switch, accepted, ack, agreement, version), `pn_note*`, `aa_*` (scrim, panel, top, title, q, close, search, count, body, cat*, item*), `ob_field`/`login_field`, `ob_email_view/addr`. Measure from the live web at 390 (and the ≤600 overrides: `.dd-btn` 16px, `.lgl-stick` 18px title, `.set-first` −22 / phone −12 via `main` padding).
- **Ask Meyy** needs only: an overlay component in `(app)/_layout.jsx` (above the Stack, below BottomNav, `askOpen` state), the `refreshBank()`-on-load call, and the accent mapping from the bank's category `accent` value to `t.sec_*`/`t.ss_plum` (tokens already present). Bank, ETag, search, priming and clearing are DONE in shared.
- **Markdown.jsx** already renders the legal documents; Settings › Legal needs Agreement read-mode chrome (acceptance line, five numbered acknowledgements) built over it, and privacy.jsx's body reused inside Settings with the fuller version line.

What this family unlocks:
- The phone's interim foot card in `index.jsx:269–286` (status line + theme segments) can be deleted once Settings › Appearance and Subscription & billing exist.
- The bar's gear and BottomNav's "Ask Meyy" item stop being inert.
- The privacy-note bar (A8) and the erasure exit (A12) — both are shell-level behaviours that only make sense once Settings › Legal and Delete my account exist.
- Support from a lesson ("this plan looks wrong", the web's own "next natural step") can reuse the same `SupportForm` with a richer `context`.

## Open questions for the founder

1. **Appearance control shape on the phone.** The web's ThemeToggle is a single glyph button that CYCLES (◐ → ☀ → ☾), hidden on desktop. The phone currently has a three-segment Auto / Light / Dark picker (index.jsx:278–284). Port the cycling glyph 1:1 into the Appearance card, or keep the segmented control as a named phone divergence (a phone has no hover title to explain the glyph)?
2. **"Or add an email address to your account →" on trial.** Support's "Message sent" offers this link to every trial teacher (the common no-email case), but Personal profile is HIDDEN on trial: `setView("personal")` at Settings.jsx:891 reaches the `view === "personal" && !onTrial` guard (731) and falls through to the HOME list with no explanation. Should the link be hidden on trial, or should Personal profile open for the email field alone?
3. **Subscription & billing on the beta phone with no purchase screen.** The web's "Subscribe" (trial/lapsed) and "Add subjects & stages" (active) open SubscribeFlow, which is NOT-PORTED-BY-DECISION. What does the phone show in their place — nothing, or a sentence pointing at the website/support? The closing hint "Online payments open soon…" also reads oddly if no button precedes it.
4. **Support `context.screen`.** The web sends `{screen: "Settings › Support"}`. Should the phone send the same string, or a phone marker (e.g. `"Settings › Support (app)"`) so the founder can tell which surface a ticket came from?
5. **Bank category `accent` value format.** The JSON's `accent` is applied as a CSS custom property (`style={{"--accent": c.accent}}`) and resolves against `--sec-a…d`/`--ss-plum`; the exact stored strings (e.g. `"var(--sec-a)"`) are in `data/cloud/content/ask_aruvi/` which is not in this snapshot. The phone needs a stable mapping — confirm the five values, or add a token NAME field to the bank so neither surface parses CSS.
6. **About Meyy on the phone.** The web card is a placeholder ("preview build"). May the phone show the app version/build from `expo-constants` as a named phone-added capability, or keep the placeholder text verbatim?
