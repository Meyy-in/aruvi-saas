# Aruvi-SaaS — Project Context for Cowork Sessions

Standing briefing for every Cowork session on this repo. Update it whenever meaningful
progress is made. A fresh session starts cold — this file is how context carries forward.

---

## ★ WHATSAPP SUPPORT CHANNEL — WEB DONE, MOBILE PENDING (2026-09-26)

Opt-in second support channel on the Meyy WhatsApp Business number (+91 93637 95723;
`api/config.WHATSAPP_NUMBER` ↔ `@aruvi/shared/format` `WHATSAPP_NUMBER` — move one, move the other).
**On the sign-in mobile only** (OTP-verified, no second-number field). **Service only, never
marketing** (keeps privacy notice §9 / agreement §K true). Stored on `Account.notify`
{`whatsapp`, `whatsapp_at`, `whatsapp_version`}; `POST /account/whatsapp` ADDS only (one-way, below);
`GET /account` and `GET /support` return it; export lists it.
- **Subscribe › About you:** "Support on WhatsApp?" Yes/No, neither preselected, asked BEFORE email.
  Yes ⇒ email becomes optional (a half-typed email still blocks). `profileKnown` accepts
  `email || whatsapp`. Checkout sends `whatsapp` (null on the known-profile skip = unchanged).
- **Done screen** (WhatsApp customers only): "Say hello on WhatsApp" wa.me tap-to-chat with a
  prefilled note — SHE starts the chat (opt-in proof + opens the 24h window); founder replies with
  the welcome from the Business app. Founder sales-log mail now goes even with no customer email
  and says "WhatsApp: YES — send the welcome to …".
- **Settings › Support:** opted-in ⇒ "Chat on WhatsApp" card under Ask Meyy. Opted-in AND no email
  ⇒ the email form is replaced by "add an email to use email support; meanwhile use WhatsApp".
  ★ **ONE-WAY — NO OFF SWITCH (founder, same day).** She chose WhatsApp knowingly as her channel
  to Meyy (often instead of email); switching it off would leave a paying customer with no channel,
  and Meyy does not answer mail from addresses not on her profile (abuse / privacy risk). Settings
  home shows "Add WhatsApp support" ONLY to a subscriber who said No; once on, no row at all.
  `POST /account/whatsapp {enabled:false}` → 400. The ONLY way off is replying STOP on WhatsApp
  (webhook) — kept because Meta's policy requires honouring opt-out requests.
- **API WIRED (same day):** `WhatsAppClient` port + `FileWhatsApp` (dev → `state/whatsapp_outbox/`) +
  `CloudWhatsApp` (Graph `/{phone_number_id}/messages`, template sends only). Chosen at startup like
  the Notifier: Cloud only when `ARUVI_WA_TOKEN` + `ARUVI_WA_PHONE_NUMBER_ID` are set. Welcome =
  approved template `meyy_welcome` ({{1}} = first name), sent ONCE per account
  (`notify.whatsapp_welcomed_at`) at checkout or when toggled on; done screen says "we've sent a
  welcome" when Meta accepted it, else falls back to the tap-to-chat hello. Webhook
  `GET/POST /whatsapp/webhook` (verify token handshake; HMAC `X-Hub-Signature-256` under the app
  secret, refused otherwise; events logged to `state/whatsapp_inbox/`; a "STOP" withdraws the
  opt-in). Chats are answered in the Business app (coexistence) — not turned into support cases.
  `tests/test_whatsapp.py`. Invoice over WhatsApp still owed: needs a fetchable PDF URL for the
  template's document header (`WhatsAppTemplate.document`).
- **Owed:** privacy notice update naming WhatsApp/Meta as a processor (versioned — a consent bump
  re-prompts everyone; batch it); mobile app (`mobile/app/(app)/settings/support.jsx`, subscribe flow).

## 0. CURRENT DIRECTION — mobile-first, progressive acquisition (2026-07-01) ★ READ FIRST

> ★★ **AMENDED 2026-07-02 — THE CALENDAR PURGE (overrides every day/week reference below and
> in §11).** Aruvi never organizes by days. The timetable is cyclic, the pointer is cumulative;
> the organizing question is "where did I stop?", never "what is due" (full reasoning: MEMORY.md
> 2026-07-02). Concretely, and now implemented: **no My Week, no Calendar, no arrange-week step,
> no weekly-grid collection anywhere** (first run OR profile editing). Nav = **two centre tabs
> on all viewports: My Classes** (home — a flat list of section cards with an LU progress rail;
> MyPlans.jsx) **and My Lessons** (the plan repository; MyLessonPlans.jsx). No sidebar, no
> hamburger. The teaching profile is parked behind the header settings gear —
> **TeachingProfile.jsx** (rebuilt 2026-07-02: an ACCORDION — one subject open at a time — with
> a MASTER EDIT toggle that reveals red dustbins per subject/class/section, "edit →" for the
> numbers, and green add buttons; adds run through the first-run wheels from wheels.jsx;
> NO whole-profile delete or redo — the profile is only edited at a point).
> ★ **SUPERSEDED — THE PROFILE IS NOW READ-ONLY (settled by the founder; recorded 2026-09-24,
> WALK-A-060).** No master toggle, no pencils, no dustbins, and **no way to remove a subject
> anywhere** (adding one is a purchase; the Add window has no Subject row). Every edit — add or
> remove a class, sections, periods a week, budget — runs through **Add on the bottom nav**. A
> subject whose classes are all removed stays listed, classless, with the line "You teach no class
> of {Subject} at the moment… To teach it again, add a class under Class in the Add window from
> the bottom tool bar." My Classes with no classes reads "No classes set up yet" / "To start
> planning, add the classes you teach under Class in the Add window from the bottom tool bar."
> Copy must say "the Add window from the bottom tool bar", never "the + window" or "the settings
> gear". Every entry below describing the edit toggle, dustbins or subject removal is HISTORY.
> The MyClasses.jsx
> drill-down editor is RETIRED (dead code on disk, like SidebarNav.jsx and MyCalendar.jsx).
> "+ Prepare Lesson" is a verb — an action inside both views, never a tab. The only
> time-facts Aruvi keeps are NUMBERS (durations, periods/week — now asked directly and stored
> as `periods_per_week` on the grade record — and the annual budget via the 4-method
> estimator) — never a grid of days. Where this section or the v0.2 spec says "My Week
> becomes Home", "arrange the week", "Calendar", or shows a 4-item bottom bar, read it as
> superseded by this note.
>
> ★ **ADDED 2026-07-06, AMENDED 2026-08-21 — the standing "+" profile portal (the gliding
> path).** ★★ **The "Do you teach {subject} to other classes?" window is GONE and the "+" is
> UNGATED (founder, 2026-08-21).** The window used to appear once ever after first generation +
> tour resolution, and the "+" unlocked only once it was resolved (used / ✕-ed / spent in a past
> session). It was struck for two reasons: it asked for more configuration at the exact moment of
> her FIRST successful generation — inverting this section's own benefit-first rule — and it was
> the third mechanism for one job, alongside tour step 15 and the "+" itself. **The coupling
> mattered:** the window was the only thing that set the unlock keys, so deleting the modal alone
> would have left a new one-class teacher — precisely the person the gliding path exists for —
> with no "+" at all. So `plusShow` is now simply `onProfilePortal && ready && (tourStep === 15
> || !tourActive)`; the sticky `plus_portal_{user}` flag, the four `expand_*_{user}` keys, the
> three unlock paths, `onExpandClasses` and the `.dash-expand*` CSS are all deleted. She now
> reaches the "+" EARLIER than before (no wait on tour resolution). Do not re-gate it, and do not
> reintroduce a push nudge. `profileAutoAdd`/`autoAddClassSubject` survive as permanently-null
> plumbing (TeachingProfile's auto-add flow is still wired, just uncalled).
> A permanent prominent **"+"** sits in My Classes —
> its own row, right side, below "Your classes are ready", above the section cards. It opens a
> Subject · Class · Section chooser routing into TeachingProfile's SAME flows (one-shot
> `profilePortal` intent in page.jsx), in **manage mode**: enrolled options pre-ticked, untick =
> removal behind the dustbins' scoped warning — warned, never blocked (★ keep-≥1-subject
> RETIRED 2026-08-24, kumar3 live: removing the only subject is allowed, warned like any
> removal; an emptied profile shows the empty state's "+ add a subject" in-session and lands
> on first run after a fresh sign-in). A portal visit always exits to My Classes, never the profile accordion. **ALL growth is
> pull via the + — there is no push nudge anywhere, ever.** STATIC-verified only (babel-parse
> clean on page.jsx/MyPlans.jsx/format.js/TeachingProfile.jsx/GuidedTour.jsx, CSS braces balanced
> 1987/1987, zero surviving references); live + mobile pass pending (MEMORY.md 2026-07-06 entry).

> ★★ **ADDED 2026-08-21 — FIRST RUN IS THREE STEPS, AND ONLY THREE.** The rail promises
> Subject · Class · Chapter. Until now, four MORE screens stood between the generated lesson and
> the shell — `acqSections` → `acqPpw` → `acqDurations` → `acqBudget` — demanded at the moment of
> her FIRST success. Same inversion of the benefit-first rule the "teach other classes?" window
> was struck for, four screens deep instead of one; and annual budget is the most abstract
> question in the product, put to someone ninety seconds old who has not yet seen a lesson.
> **All four deleted.** Where each went: **sections** are now STATED on the Class step ("We'll
> start you with Section 9A", changeable in the profile) — the founder first asked for a picker
> there, then cut it too ("too complicated in first run"); **duration** was already asked on the
> chapter step and was a straight duplicate; **periods/week + annual budget** are seeded with the
> very defaults those screens opened on (`startAcquisition`) and are met later in TeachingProfile
> and Year Plan. She still gets a real section card before the tour, which matters because tour
> steps **7–14 all anchor on one** (`section-add`, `attach-pop`, `section-card-target`,
> `mark-complete`) — a section-less tour would point the hand at nothing and render "section
> undefined". **Landing moved to MY LESSONS** (`onFirstRunComplete` → `goLessons()`): the promise
> was a lesson plan, not an empty card. The tour offer (the same `.dash-nudge`) now renders on
> BOTH surfaces; `startTour` calls `goClasses()` first so step 1 still opens where it always did.
> **`finishTour` — the single exit for Done AND Skip — raises a one-shot "Are these your
> sections?" prompt** on My Classes: EDIT, not add, routing into TeachingProfile's existing
> section manage screen via `onProfilePortal("section")`. It exists because Aruvi assumed the
> section on her behalf, and tour's end is the first moment she can judge that. Deleted with the
> screens: `SectionPicker`, `SECTION_LETTERS`, `toggleSection`, `ACQ_STEPS`, `METHOD_ORDER`,
> `budgetPeriods`, `toggleDuration`, `goPpwToDur`, `setPpwCount`, `ncfTotal`/`recTotal` and the
> `/ncf-periods` fetch gated on the dead step.
>
> ★★ **AND THERE IS NO "LESSON PLAN READY!" SCREEN (founder, same day).** Screen 4 went through
> two designs in one day — the `--paper-sunk` stats card with a pale tick, then the four-unit
> GLIMPSE on the marginal rail that replaced it — and then the founder cut the screen itself.
> **First run has no waiting screen of its own, because the shell already has one.** The chapter
> CTA calls `prepareAndHandOff`: it fires the serve, hands off in the SAME tick, and page.jsx
> opens My Lessons with the ordinary preparing card (`onPreparing`'s descriptor — real title,
> real period shape, progress bar where "Ready to teach" will be), replaced in place by
> `onPrepared` when the plan lands. Exactly what a normal run does — one wait, one place, learnt
> once. The request is deliberately NOT awaited before the handoff: FirstRun unmounts instantly
> but the fetch keeps running in its closure and still resolves to page.jsx's own
> `onPrepared`/`onPrepareError` (now passed down as props) — the same trick PrepareLesson relies
> on. **`finishActivation(over)` / `buildActivationPayload(over)` take the profile values as an
> ARGUMENT** because seeding and handoff happen in one tick, so reading them back off state would
> read the previous render's. Gone with the screen: `startAcquisition`, `goCreateCards`, the
> 1.8s `creatingCards` beat, all five `preview*` states, `GLIMPSE_*`, and the `.fr-plan-*` /
> `.fr-teaser-*` / `.fr-glimpse-*` / `.fr-celebrate-*` / `.fr-standin` CSS. FirstRun.jsx: 920 → 702 lines.
> **Two follow-ons the same day, both from live testing:** (a) **the bar never appeared** — the
> five-second hold lives in `PrepareLesson` (`PREPARING_MS`), which this path bypasses, so the
> ~0.3 ms serve replaced the card in the breath it was drawn. `prepareAndHandOff` now holds the
> same beat itself (not shared, because PrepareLesson also skips it for an `already_yours` plan,
> which can never apply on first run). (b) **Year Plan contradicted the chapter step** — ch 4
> recommended at 19, suggested at 14. Year Plan does not show the per-chapter recommendation; it
> distributes HER BUDGET across chapters by weight. The seeded budget was a plausible-looking
> `30 weeks × DEFAULT_PPW(6) = 180` against SS·ix's calibrated year of **245**, so every chapter
> scaled by 180/245 — 19 × 180/245 = 13.96 → 14, exactly what was reported. First run now seeds
> the budget from `/chapters`' own `annual_budget_periods`, and since `sum(recommended_periods)
> == annual_budget_periods == 245`, the two screens agree by construction. **Whenever first run
> stops ASKING for something, check what still DERIVES from it** — periods/week is the remaining
> approximation (it drives the weekly split, not any figure she is shown).
>
> ★ **THE "IT GENERATED AT THE DEFAULT" BUG (fixed 2026-08-21).** Amending duration/periods on the
> chapter step was silently discarded — SS·ix ch 4 asked at 60 min × 16 came back 50 × 19. **The
> engine was never at fault** (verified directly against the library: `serve_plan` returns exactly
> 16 units with `{duration: 60, count: 16}`). Two seeding effects overwrote her values when their
> fetches resolved: the periods one carried a comment claiming it "never clobbers a manual edit"
> because React bails on an unchanged value — true only when the values MATCH, and 16 ≠ 19. Now
> guarded by `periodsTouched` / `durationTouched` refs, reset at different points because the
> facts differ: the periods recommendation is per CHAPTER (so `pickChapter` re-earns the seed),
> duration is a property of the CLASS (so only changing class does).

The product is **pivoting** from an "upfront-profile-first" flow to a **mobile-first,
progressive-acquisition** model. Full spec: `docs/Aruvi_Mobile_First_Progressive_Acquisition_Model_v0.2.md`
(read it in sync with `docs/mobile pics/` — the annotated mobile mockups). This does NOT change
the engine, the subject plugins, the view model, or the ports/adapters — it **re-sequences the
interaction order and reflows the web UI mobile-first**. §§1–8 below are unchanged and still true;
§9 (roadmap) and §11 (web arch) are now read *through the lens of this section*.

**The shift (same destination, different journey):**
- OLD: Profile → Allocate → Generate → Track (asks for a full teaching profile before any value).
- NEW: **Generate first lesson → attach it to one or more sections → (optionally) arrange the
  week → teach → the profile fills in as a by-product.** The teacher never feels she is "building
  a profile"; it accretes from useful work.
- Governing principle: **benefit first, data second** — reveal only what helps the teacher's very
  *next* teaching moment.

**Mobile-first is now the primary design target** (was a standing check under §4; now it *drives*
the design). Assume a teacher on a vertically-held phone during the school day, one-handed.
Desktop is a larger rendering of the same mobile model; landscape is not a target. Verify every
UI change at phone widths **first** (stress-test **360×800**, then check 375 / 390 / 412), desktop
second. Dev workflow: **Chrome + mobile DevTools device mode** (iPhone SE 375, iPhone 14 390,
Pixel 7 412, custom 360×800 Android for the Indian budget-phone case); final iPhone pass in real
iOS Safari for safe-area/`100vh`/sticky quirks Blink won't catch. Live render is local
(`next dev` can't run in the Cowork sandbox — see §11).

★ **WHERE EACH VIEW IS VERIFIED — amended 2026-09-13 (founder).** Now that the Expo app
exists, the two surfaces divide the work: **the phone view is verified on the Expo app**
(Expo Go / a build on the founder's iPhone), and **the web app is verified as the website
view** (desktop widths). Chrome DevTools device mode (⌘⌥I → 360/375/390/412) is RETIRED as
the mobile check; the "mobile-first" paragraph above still describes how the web was
designed and remains the reference the phone port draws on, but a phone-width screenshot of
the web is no longer the evidence that a change works on a phone — the Expo screen is.
**Every UI change is made on BOTH surfaces** (or, where a technical limitation prevents
parity, the component header names it — see the rule below), and a change is "done" only
when the website view and the Expo view have both been seen. Two apps, one product, one
source of design truth.

★ **THE PHONE APP MATCHES THE WEB BY DEFAULT (founder, 2026-09-12).** The web was designed
mobile-first *with the eventual phone interface in mind*, so the Expo app (Track D) is a port of
the web's screens — the same information architecture, the same tabs, labels, order, copy, and
interaction model — not a re-design. Divergence is allowed in exactly two cases, and each one is
named in the component's header comment: (1) a **technical limitation** of the phone (no cursor →
a drag becomes drag-or-tap; no measured `--nav-h` → native layout; browser-only APIs replaced per
docs/mobile_migration_assessment.md §3), or (2) a **capability the phone adds** that clearly
improves the teacher's experience (a share sheet, SMS-code autofill, haptics). Anything else —
adding a field to a tab, dropping a sub-tab, moving a navigator, relabelling — is a product change
and needs the founder's say-so first. When porting, read the web component and reproduce its
structure; simplify only with a written reason. Redoing the design on the phone would mean doing
the whole design exercise twice.
**How the SKIN matches (2026-09-13):** `mobile/theme/web.js` holds the web's styles keyed by
the web's own CSS class names (`ws.uv_tab`, `ws.kicker`, `ws.co_card`…), with values READ
FROM THE LIVE WEB at phone width (Chrome, iPhone 12 Pro emulation, `getComputedStyle`),
colours mapped to tokens. Components use those keys, never an invented type scale — the first
LessonView cut used 17px Newsreader where the web sets 13px phase text, 11px mono tabs, 10.5px
mono kickers, and read "bigger" for exactly that reason. When globals.css changes, re-measure
and update web.js; `theme/tokens.js` is likewise generated from globals.css.
**How parity is SEEN (2026-09-13):** the Expo app has a web target (`npx expo start` → `w`,
`localhost:8081`, react-native-web; storage = localStorage via the shared adapter). Open
**`http://localhost:3000/parity.html`** — the web app and the Expo web target side by side, each
in a true 390px frame — and compare the same screen in the same state. Claude does this itself
through Claude in Chrome before any change reaches the founder's phone; the phone remains the
sign-off (react-native-web is close, not pixel-identical — e.g. the web's variable Fraunces with
optical sizing vs the bundled static cut reads a touch heavier on the phone side).
**★ AMENDED 2026-09-18 (founder): text size is now the iPhone's, capped at 1.2× — or the
teacher's own choice.** Settings › Appearance › **Text size** cycles *Match iPhone* (default; the
Control Centre / Settings slider, capped at `MAX_FONT_SCALE` 1.2) · *Standard* (the design's
sizes, the 2026-09-13 behaviour) · *Large* 1.1× · *Larger* 1.2×. The in-app choice overrides the
iPhone. `components/Text.jsx` does both paths (fixed modes turn OS scaling off and multiply
fontSize/lineHeight/letterSpacing); the preference is `aruvi-text-size` in `ThemeContext`, a
device setting that survives sign-out. Phone-only — the web follows browser zoom. Check tight
spots (bottom bar labels, section cards, lesson tabs, tables, top bar) at 1.2× before calling a
screen done. The paragraph below is the history.
**Font scaling (founder decision, 2026-09-13): the design OWNS its sizes — the web's sizes are
the sizes, on every phone.** iOS scales native text by the phone's system text size; a web page
does not, so a phone with enlarged text drifted 12–15% from the web and wrapped lines the design
does not wrap. The app does NOT consult the iPhone's text-size slider (`maxFontSizeMultiplier`
1.0 in `mobile/components/Text.jsx`, which every Text/TextInput imports instead of
react-native's — React 19 ignores defaultProps, so there is no global switch). Rationale: a
capped multiplier still breaks the target look; app designers who offer larger text do it as an
in-app option at sizes they have designed and tested. If teachers ask, that is how Meyy adds it —
in Settings, checked on the parity page — never as an uncontrolled scale.

**Two product phases (the big structural change):**
- **Phase 1 — Guided First Experience:** there is **NO app shell** (no sidebar, no tabs, no nav)
  until the teacher has (a) generated one lesson, (b) attached it to ≥1 section, and (c) completed
  *or skipped* weekly arrangement. She simply completes one meaningful task. Screens: Welcome →
  Subject (one) → Grade (one) → Chapter + NCF-default duration/periods (40 min / 12 periods, with
  an optional "Want to change?" reusing the duration editor) → generate → "Add to Class" section
  picker → per-section cards → "Arrange my week? / Maybe later".
- **Phase 2 — Workspace:** once the first lesson is attached, the shell opens. This is the
  **activation moment**. Nav is a **hamburger sidebar** (My Class · Calendar · Lesson Plans ·
  Settings · Help). **My Week becomes Home** (no separate home page); it auto-opens to today's
  weekday. The **Generate tab disappears** — generation becomes a universal **+ Prepare Lesson**
  action available wherever appropriate.

**Net-new work** (the audit, 2026-07-01): the shell-less first-run wrapper + activation gate; the
**section-card fan-out** ("Add to Class" → tick sections → one independent lesson card per section)
and the **+ Prepare Lesson** universal action (neither exists today — sections are currently
implicit from the upfront readiness profile); the benefit-first Calendar empty state; a mobile
bottom-tab bar (My Week / My Class / Calendar / Lesson Plans per the mockups). **Reused, re-sequenced:**
LessonView, MyPlans (→ My Week/Home), MyLessonPlans (→ repository), MyClasses (→ progressively-filled
profile), MyCalendar, the duration/section/week-grid pieces of Readiness, Allocate's generate path.
**Retired as the entry point:** the upfront 6-step `Readiness.jsx` gate (its pieces live on inside
the progressive flow + My Class). Progressive profile = each first-run step quietly appends to the
canonical `readiness.subjects[]` (no explicit "build profile" step). See MEMORY.md 2026-07-01 for
the full component map.

**Also specced in v0.2 (deferred UI, note now):** Period Notes (belong to a section's plan
instance; pull-based, 📝 indicator, written from the period view after class) and Chapter Notes
(belong to the shared lesson-plan asset; live on the Chapter Organization page, prompted only at
chapter end). Plain text + voice + multilingual, ~250-word soft cap, no rich formatting. Needs
stable period identifiers within a plan; notes never migrate across regenerated plans.

---

## 1. What this is

The greenfield rebuild of **Aruvi** (NCF-aligned lesson planning + assessment for Indian
K–12 teachers) as a cloud-hosted, multi-tenant SaaS. It **lifts the proven IP** out of the
prototype monolith (`../Project Aruvi`, frozen at git tag `prototype-final`) into a clean,
plugin-based architecture. The prototype is the **proven spec + data source**; this repo is
the future product.

Builder context: solo founder + Claude. Architecture favours **managed/serverless** services
and **validation-first** sequencing (ship the visible product on saved data; defer scale).

---

## 2. Architecture & data flow

```
teacher → web (Next.js) → HTTP → FastAPI (api/) → aruvi_core (Python engine)
```
- **`aruvi_core`** = the engine (UI-free, vendor-neutral). Generates/normalizes, allocates.
- **Generate flow:** engine asks the subject plugin to build a prompt → LLM → the SAME
  plugin normalizes the raw JSON into the **canonical view model** → renderer shows it.
  (Live LLM generation is wired but DEFERRED; the API serves saved plans as previews.)
- **Allocate flow:** read each chapter's weight via the plugin → distribute a multi-row
  period schedule across chapters (per-duration columns, remainder method, exact totals).

---

## 3. Conventions (the rules — keep these)

- **Subjects are plugins, not conditionals.** Each subject is a package under
  `aruvi_core/subjects/{name}/` implementing the `Subject` interface; importing it registers
  it in the registry. The engine never branches on subject. Add a subject = implement the
  interface + drop in data; zero edits to shared code.
- **One renderer, many subjects.** Subjects normalize to ONE structure-preserving view model
  (`aruvi_core/view_model.py`). Subject/stage differences (progression-stage vs A/B/C vs
  section→spine vs competency) live as typed/labeled/nestable Groups — NOT in the renderer.
  Visual stimuli are typed (svg / table / prose); never dump raw markup as text.
- **One timed spine per period (2026-07-09).** `Period.phases` (typed `Phase` with integer
  start/end minutes, parsed once in `normalize.phases_from`) is THE timed sequence; display
  shows the duration ("8 min") in the marginal rail. `Period.materials` is first-class.
  Everything else (tasks, textbook items, visual aids) is an UNTIMED supporting block; Science
  `roles` are ignored for now. Standard period anatomy: kicker/title/duration → teacher notes →
  materials → phases → homework → 📝 note-invoke. Spec: `docs/mockups/lesson-period-layout.html`.
  **On screen (2026-07-10) that anatomy sits behind four per-unit TABS** — Overview (chapter ·
  spine · time · pedagogy as ledger rows) · Material · Lesson (teacher notes as a collapsed
  clay teaser ribbon on top — their ONLY home — then phases + homework) ·
  Assess (green cards inline, tab EXISTS only when the unit anchors items; replaced the
  full-screen 3b sub-view) — the unit header keeps only the clay number + title; spec
  `docs/mockups/lesson-unit-tabs.html`, impl `LessonView.jsx` (`UnitTabs`, keyed by unit so
  paging resets to Overview; tour step 8 anchors `data-tour="unit-tabs"`). **Inside ASSESS,
  each item carries its own four tabs (2026-07-10): Overview (bold "Learning outcome"
  heading + LO paragraph, then Type · Cognitive demand · Competency ledger rows) ·
  Question (class-facing:
  stem/stimulus/PLAIN options — no tick — scaffold, open-task reading guide) · Answer
  (correct option ✓, model answer/key, choice-reveals, elements, look-fors, method; only
  when populated) · Inclusivity (own tab, only when populated). Items sit FLAT on the
  unit's paper (`.assess-flat`; the green box, card chrome and Q{n}/type header are
  retired — legacy items keep the old card). `strong_vs_weak_markers` is carried but
  NEVER rendered. A PINE pager (pine ≠ clay unit strip, deliberately) sits directly
  under the unit tab row only when a unit anchors >1 item. Spec
  `docs/mockups/assessment-item-tabs.html`.**
  `activities` still carries legacy flat lines until the renderers adopt phases. Raw bands drift
  ("0–5"/"0-10"; `phases[]` vs `time_bands[]` — Science secondary uses time_bands) — always
  parse via `normalize.parse_minutes_band`, never re-split strings.
- **Standard LP display rules (founder, 2026-07-09; tests: `tests/test_lp_standard.py`):**
  (a) ~~LO is NEVER shown in a lesson plan~~ — **SUPERSEDED (founder, confirmed 2026-09-22,
  WALK-A-067): the Learning Outcome DOES show in the lesson plan** — on the spine band and in the
  period card, in the PDF and the Word document alike. The data is carried as before
  (`Period.learning_outcomes` / group meta) and still links the assessment. (b) **`Period.approach`**
  is the ONE canonical "how do I run this?" line ("40 min · {approach}"): Science
  `pedagogical_approach` · Maths `pedagogical_method` · English joined `pedagogical_methods` ·
  TWAU `dominant_mode` SPELLED OUT ("Hands-on Investigation", never "HI"). SS now emits
  **`pedagogical_approaches`** — a list of 1-to-few approaches verbatim from the NCF Pedagogy doc
  (SS middle LP constitution **v2.7**, 2026-07-15); the SS port JOINS them with "; " into
  `Period.approach` (same pattern as English), so the Overview "Pedagogy" row now populates for SS
  like every other subject. Maths-prep still has NO source field → empty. Founder decision: the
  source keys are too diverse to flatten — `Period.approach` is the single normalization point. (c) **Science secondary is
  section-anchored flat** — grouped by `section_anchor` (type "section"), LO rejoined from
  result-level `coverage_handoff` into group meta; the "Stage None" phantom is fixed and must
  not regress. (d) **English singleton-section collapse** — chapters are split into constituent
  sections (one section per saved plan), so a lone section wrapper collapses and SPINES are the
  top-level axis; multi-section legacy plans keep section→spine. (e) Callers pass the **FULL
  saved `result`** to `lesson_plan_to_view` (plugins unwrap `lesson_plan` themselves) so
  handoff-dependent subjects work. (f) Prototype homework word-caps are DROPPED (full text);
  English's inline task-ref substitution into phase text is KEPT (renderer follow-up).
- **Stage is derived from grade, never a separate input.** Single source:
  `aruvi_core/grades.stage_for(grade)`. Everyone calls it; nobody re-implements the mapping.
- **Ports & adapters** (`aruvi_core/ports.py`): core depends only on `LLMClient`,
  `OutputCache`, `Storage`, `Repository`, `AuthProvider`, `BillingProvider`. Each vendor is a
  thin adapter → no lock-in.
- **Allocate UX:** show the *answer* (periods), not the raw weight number. The flow is four
  explicit steps in `web/app/page.jsx`'s `Allocate` component, gated by its `step` state
  (`"periods" | "select" | "adjust" | "final"`, 2026-06-21): (1) **periods** — define period
  types/durations; (2) **select** — plain checkbox list of chapters, default all selected, no
  allocation numbers yet; the LRM does NOT run live as checkboxes toggle. "Allocate Periods"
  runs it once for whatever is checked; (3) **adjust** — shows the suggested allocation table
  scoped ONLY to the chapters chosen in step 2 (unselected chapters are never displayed, not
  just greyed out), with a collapsible "How are periods allocated?" note
  (`Subject.allocation_basis(grade)`, no numbers, deeper "why" deferred to Ask Aruvi) and a
  binary choice — **Accept Allocation** (saves as-is, Δ=0, no edit UI ever shown) vs **Modify
  Allocation** (styled `.modify-btn`, solid `--ochre` fill, to visually flag the temporary/
  unsaved state before it reveals per-chapter Δ columns, live balance check, Save Allocation
  bar); (4) **final** — read-only Final Period Allocation table. The "Why did Aruvi allocate
  periods this way?" card (`.howbox`) uses fixed copy (not the per-subject factors list as
  bullets) pointing teachers to the Ask Aruvi "How time is allocated across chapters" tab.
  Every period-duration column header is two lines — teacher's chosen name (`.sub-h-name`)
  stacked over its minutes (`.sub-h-min`), e.g. "Core" / "45 min" — in both the suggested and
  Δ column groups, and the Δ group header no longer uses a distinct clay/red color (matches
  the suggested-periods group styling).
- **Output caching** keyed by (subject, grade, chapter, period_profile, constitution_version)
  is the #1 economic lever at seasonal scale — wire it at the service layer when live gen lands.
- **The variant-canonical serve engine IS the genon architecture (v2.0, 2026-08-03) — the
  deterministic partition engine is RETIRED.** Standing spec:
  `docs/variant_canonical_architecture.md` — **read §0 first** (v2.0 supersedes the fill
  ladder, the solver and the closing-span mandates). A chapter is a LIBRARY of canonicals
  authored FREE at counts fixed by EQUAL DISPERSION over [floor, standard] ({A, ⌈(A+C)/2⌉, C}
  when A−C ≥ 4, {A, C} when smaller, degenerate {A}; `master_plan.py canonical_periods` +
  `variant_plans.py` → `canonical_plan` per row — no sigma, no solver, no mandated spans;
  ARV-D-025: a mandated closing synthesis in a compact imported the lending plan's priors —
  the jumpy Xth unit). The ONE mandate: the STANDARD canonical closes with a whole-chapter
  synthesis unit, `section_anchor` exactly the reserved token `synthesis` (§0.3; excluded
  from the registry; forbidden in compacts — certified by `build_library.py`'s
  synthesis-anchor gate). Serving is SELECTION, never composition: next-highest canonical
  (full richness; surrender only above the top, declared) · X−1+1 form · **the Xth-unit
  CHOICE SET (§0.4, engine e12)**: Case 1 (prefix covers all sections) borrows the
  standard's synthesis; Case 2 borrows, from ANY canonical, the unit that FIRST deals the
  next-due section M (first-exposure units' only backward dependency is prior sections —
  the structural no-jumpiness guarantee; preference forward-reach > M-alone > backward
  combos, ties **SELF FIRST** — the chosen plan's own candidate wins every tie it enters
  (e14, 2026-08-04, architecture v2.1: pacing distance used to decide, so the engine
  borrowed a stranger's unit while the plan being served had its own) — then the count
  nearest X, then denser); dropped sections ride from the
  LENDER's subsequent units; Case 3 (empty set — structurally impossible on a certified
  library) truncates with NO drops and asks for the reference canonical's count ·
  proportional per-unit duration scaling (the only arithmetic; weekly dispersion kept) ·
  per-canonical assessments (borrowed unit brings its own items). Assessment anchoring is
  UNIT-level (item unit_ref from period_ref; band ids are internal, derived positionally by
  compile v0.5 — never demanded of the model).
  SS·sec LP v1.10 (Rules 14/15/16 removed; register stands), assessment v1.7 (A9's whole
  arrangement sentence struck 2026-08-03 — option order is now STEP 6,
  `genon/normalize_options.py`; SS·middle amended to LP v2.8 · assessment v2.4 on 2026-08-04)
  (phase_ref removed); A2/A3/A4 cancelled + X3 void for the ten un-amended constitutions,
  V-series (brief §7, V3 struck by §0) replaces them; `partition.py`/`polish.py`/
  `variant_solver.py` live in `_to_delete/`. DO NOT reintroduce cutting below the unit,
  seam text, role weighting, compression regimes, or mandated closing spans — the brief
  §§0–1 record why they failed.
- ★ **ENGLISH ASSESSMENT IS A PAIR PER CELL, NOT ONE ITEM (2026-08-12, all three stages).**
  Analysis: `docs/english_secondary_item_density.md`. English was the only subject whose
  assessment axis is **capacity-bounded** — the SPINE, six of them, fixed — rather than
  content-bounded (sections / competencies / LOs / goals / periods, which is what every other
  subject indexes on). Post-split a chapter is ONE main_section, so the grid collapsed to 1×6
  and the item ceiling was 6 **at any period count**: english·secondary measured **0.35
  items/unit** (next lowest 0.93) and only **6 of 17 units** of the ch 7 canonical carried an
  Assess tab at all. Fix, in two halves because doubling alone would have moved the ratio and
  not the coverage: (a) **Rule 2 emits TWO items per `section_contribution`** on a
  **prescriptive per-spine SLOT TABLE** (SS Rule 4's style) — slot 1 at the comprehension/
  application rung, slot 2 at analysis/creation, types MUST differ (sole exception
  Speaking/Writing, one permitted type each → differ by mode/form); both items carry the SAME
  `source_lo` and must take DIFFERENT strands of a compound `implied_lo`. Item count = 2 ×
  contributions. (b) **Rule 8A declares TWO-STAGE SCOPING** (slot 1 → the cell's early
  teaching, slot 2 → its completion), which licenses `cell_resolver` to **disperse** a cell's
  items across the units that taught it: new `_disperse()` cuts M units into N contiguous
  blocks by largest-remainder, item i takes block i, `stamp()` anchors each at its own block's
  close. **The 2026-07-11 N-to-N pairing is now the M == N case of that same arithmetic — one
  code path, not two.** M < N and N == 1 (a true span) keep the full set, unchanged. Versions:
  assessment english/secondary **v1.6** · middle **v3.6** · preparatory **v1.4** (Rule 8A is
  NEW at middle + preparatory). The `period_ref`/`unit_ref` prohibition is untouched — scoping
  is declared by SLOT, never by number. STATIC + unit-verified only; **no english library has
  been generated under any of it and the three certified ch 7 canonicals are pre-amendment
  6-item files.** The remaining gap (most cells are single-unit, so coverage reaches ~9/17 not
  17/17) is closed only by raising the number of CELLS upstream in LP Rule 10 — option C of the
  analysis doc, deliberately deferred.
- ★ **SCIENCE·MIDDLE IS BATCH-RELEASED, and its top synthesis units are RE-AUTHORED +
  POLISHED (2026-08-18).** The F1 full enumeration found the K+1 synthesis borrow
  produced double capstones (101/114 serves) and floor-gap jumps certification cannot
  see; the founder struck a same-day separate-CODA design (one flow across eleven
  stages, no new asset) in favour of re-authoring the TOP'S synthesis in place against
  the whole library (`genon/resynth.py`, `batch_api --wave resynth`), then a POLISH pass
  (`--wave polish`) that moved prepared content into **typed `visual_aids`**
  ({table|prose, title, payload}; tables pre-split via `normalize.parse_table` in the
  science port — renderers consume structure, never re-split) with 2–3-sentence notes,
  "(see material)" pointers, and 2–5-word `pedagogical_approach` labels. Rendered on
  screen (LessonView `MaterialPanel`), PDF and DOCX with content-weighted column widths.
  Gap-fill doctrine: the model may SPECIFY content a unit tells the teacher to prepare
  unspecified (founder licence 2026-08-18); specified content is moved, never rewritten.
  Read-derived per-chapter brief notes (`resynth.EXCLUSIONS` / `POLISH_NOTES`) are the
  mechanism when the generic brief misses. Spec `docs/science_middle_stage_serve.md` §6
  v1.3; full story MEMORY.md 2026-08-17/18. Material-tab live render + mobile pass OWED.
  **Addendum 2026-08-19:** the polish pass had left enumerable card/event/scene sets as dense
  prose aids; `genon/repair_prose_tables.py` tabulated 29 of them (32 new typed tables across
  24 chapters, content moved verbatim, titles referenced by note-pointers kept exact — e.g.
  vi ch 4 'Shipwreck card content' → Card | Question | Expected reasoning). MEMORY.md 2026-08-19.
- ★ **ONE STAGE IS SERVED DIFFERENTLY — science·middle (2026-08-07, engine e17).** Spec:
  `docs/science_middle_stage_serve.md`. Its LP is organised by the chapter's COGNITIVE
  PROGRESSION ARC, not by textbook sections, so it has no `section_anchor`, no registry, and
  no valid prefix of a canonical (a stage is taught whole or not at all). It serves at **PLAN
  granularity**: identity at X=K · K complete + the TOP's synthesis unit at X=K+1 · truncation
  with declared drops ONLY below the lowest canonical · surrender only above the top. Its
  canonical counts step down by exactly 2 (`genon/master_plan.py`), which is what makes "no
  surrender inside the band" true; certification enforces it. Its register is a **two-ban** cut
  (forward reference is legal — every unit of a canonical is served with every other), and
  stages are NEVER borrowed between canonicals (arcs are derived fresh per generation and may
  differ). The engine never branches on subject: `Subject.genon_serve_granularity` /
  `genon_has_section_axis` declare it and `aruvi_core/genon/carriers.py` asks. Corollary worth
  keeping: `compile.py` models only what SERVING needs, so every other authored period field
  rides in `unit["extra"]` and is spliced back by `serve._period_from_unit` — without it a
  served plan loses whatever its subject's port groups on.
- **The calibrated standard is the default (2026-07-26)** — two period tables live under
  `data/cloud/content/allocation_norms/` and they disagree: `ncf_period_norms.json` (NCF adaptation,
  by subject·**stage**, in flat **40-minute** periods) and `master_plan.json` (OUR calibration —
  the founder's allocation workbook via `genon/master_plan.py`, by subject·**class**, at
  **class-banded durations: 40 ≤VII · 45 VIII · 50 IX**, with a precomputed per-chapter
  `recommended_periods`). SS IX is 245 calibrated periods vs 150 NCF; TWAU preparatory 140 vs
  300. The bands are the basis the certified canonicals were authored at (SS IX ch 5 = 21×50).
  **Every default a teacher sees now reads the master plan first, NCF norms only as fallback.**
  `api/data.py` exposes `standard_duration_minutes(grade, subject=None)` (class X extends the
  50-min band; counts still fall back to NCF there), `master_annual_budget`,
  `master_recommended_periods`. `GET /subjects/{s}/{g}/chapters` returns `recommended_periods` +
  `recommended_source` (`master_plan`|`ncf`|null) per chapter plus top-level
  `standard_duration_minutes` / `annual_budget_periods`; `GET …/ncf-periods` adds
  `recommended_total_periods`. `ncf_estimated_periods` is RETAINED, unchanged — it is a
  published norm, shown alongside ours on the budget screen, and drives nothing. Consumers:
  `FirstRun.jsx` (chapter step — the DURATION tag stays "NCF recommended" (its bands are
  NCF-derived), the new PERIODS tag reads "Aruvi recommended"; this reverses the
  2026-07-08 flat-12 "neutral default", which was never reading a table at all),
  `YearPlan.jsx`, `TeachingProfile.jsx`. Test: `tests/test_calibrated_defaults.py`.
  STATIC + unit-verified only — live + mobile pass pending. Full reasoning: MEMORY.md 2026-07-26.
- ★ **SUPERSEDED 2026-07-26 by the bullet above** — kept as history: this is how the NCF
  norms were wired in, and it is still the FALLBACK path when the master plan has no row.
- **NCF period norms — wired into first-run's estimated-periods field (2026-07-01)** —
  `data/cloud/content/allocation_norms/ncf_period_norms.json` (+ the original
  `NCF_adapted_for_Aruvi.xlsx` kept alongside for provenance) holds the National Curricular
  Framework's recommended teaching periods per subject per stage
  (preparatory/middle/secondary, in 40-minute periods/year). This is Bucket A read-only
  CONTENT (§7), founder-supplied. `api/data.py`'s `ncf_total_periods(subject, stage)` reads
  it; `GET /subjects/{subject}/{grade}/chapters` (api/main.py) uses `stage_for(grade)` to look
  up the subject·stage total, then runs the SAME effort-index allocator Allocate.jsx uses
  (`allocate_for_subject`) to distribute that annual total across the grade's chapters by
  weight — each chapter comes back with `ncf_estimated_periods` (always a whole number; the
  allocator's largest-remainder method sums exactly to the NCF total, no separate rounding
  needed). `FirstRun.jsx`'s chapter step reads this per chosen chapter to set the "Estimated
  teaching periods" default (falls back to the flat `DEFAULT_PERIODS` placeholder only when
  the norm table has no figure for that subject·stage, e.g. Science·preparatory,
  TWAU·middle/secondary, Social Sciences·preparatory — all `null` in the JSON). NOT yet wired
  into `Allocate.jsx`'s G4 step (its "periods in total" input is still teacher-entered) — that
  remains a follow-on. Note the English figures are a three-language-formula average
  (documented in the JSON's `_meta.note_on_languages`), not English-only.

---

## 4. Design system — "scholarly planner on warm paper"

Calm, credible, academic-but-warm, content-first (the plan is the hero). Defined in
`web/app/globals.css` (CSS variables). Keep new UI consistent with this — don't drift to a
generic look.

- ★ **THE BRAND MARK IS THE MEYY WORDMARK (2026-09-03).** Source assets live in
  `web/app/icons/`: `3a-wordmark-{light,dark}.svg/.png` (web/mobile) and
  `4a/4b-app-icon-{light,dark}` (the store tile). The typeset "Aruvi." + red dot is GONE from
  all four bars (shell `page.jsx` · `Login` · `FirstRun` · `SubscribeFlow`); each renders
  `<MeyyMark/>` (`components/MeyyMark.jsx`) — the wordmark's paths INLINED with
  `stroke="currentColor"`, so ONE component serves both variants (the two SVGs differ only in
  stroke colour) and on the pine bar it is simply `--bar-ink` in either theme. Sizing is in
  globals.css (`.brand-mark` 22px / 19px ≤600px — first cut at 26/22 matched the Fraunces
  line's box and read "a wee bit larger than Aruvi was", so one notch down; the bar is ~4px
  shorter and the measured `--nav-h`/`--fr-bar-h` absorb it). The dots are `--brand-dot`: the brand's #d63a2f by
  default, lifted to #e0705f on the bar (2.35:1 → 3.48:1 on pine — the same call the old dot
  got). "lesson studio" kicker kept. ★ **AND THE NAME FOLLOWED THE MARK, same day: every
  TEACHER-FACING "Aruvi" is now "Meyy"** (title case in prose, matching support@meyy.in; the
  wordmark alone is MEYY). Done by AST, not sed — Babel string/JSX-text nodes in the web (67),
  Python STRING tokens in the emails, PDF/DOCX exports, reports, data-rights receipt and the
  API's teacher-visible `detail`s (64) — so code comments, docstrings, identifiers, the
  `X-Aruvi-User` header, localStorage keys, CSS classes, file/module names, LLM prompt
  preambles, the OpenAPI title and the founder's own `[Aruvi] New subscription` notice are all
  deliberately UNTOUCHED (grep will still find "Aruvi" everywhere it should). Ask Aruvi is
  "Ask Meyy"; its bank is renamed in place (V3.2, `meyy` added beside `aruvi` in the indexer's
  stop-list) and the ETag ships it. The user agreement is republished as
  `consent_and_disclaimer_v0.2.md` (v0.1 kept beside it, as the version-by-filename rule
  requires — every existing signer re-takes the six ticks once). ★ **v0.3 the same day** names
  the contracting entity **Meyy (OPC) Private Limited** (founder) — a THIRD file, because two
  test accounts had already ticked v0.2 that afternoon and ticked text is never edited. The same
  legal name is `config.SELLER_NAME`, printed on the invoice under the letterhead (new
  `Invoice.seller_name`; blank on records issued before the field) and in the GST note. **The
  invoice series is `MEY/2026-27/NNNN`** (`INVOICE_PREFIX` default; the `_series/` counter is
  keyed by year only, so numbering continues from 7864 — ARV-numbered records stay valid). The
  support reference series followed on 2026-09-03: `MEY-S-…` (`SUPPORT_PREFIX`; same plain counter, so numbering continues and ARV-S records stay valid). Tests that pin the wording (data_rights · invoice · notifier ·
  support · year_plan_export) moved with it; backend suite green bar the three pre-existing
  content defects of 2026-08-27. ★ **AND THE WORDMARK REACHED EVERY LETTERHEAD, same day:**
  `aruvi_core/brand.py` + ONE shipped raster `aruvi_core/brand/meyy-wordmark-pine.png`
  (pine stroke, brand-red dots, transparent; drawn from the SAME paths as MeyyMark.jsx, trimmed
  to the ink so its bottom IS the baseline; `render_png()` regenerates it — cairosvg at
  authoring time only, the runtime just reads the file, bundled like `fonts/`). ★ **The mark carries a CIRCLED ™** at the top-right of the
  cap height (founder, same day — chosen from three placements and a plain/circled pair shown
  as visuals first; ring ≈ 40% of cap, in the stroke colour, `TM` in bold sans; ~4px on the
  phone bar, which is the convention). Drawn in BOTH sources — MeyyMark.jsx and
  `brand.wordmark_svg` — with the trimmed box widened 373 → 413 units to the ring's outer
  edge; every export width follows from `WORDMARK_ASPECT` automatically. NOT on the store
  tiles or favicons (app icons carry no ™ by convention). Six PDF
  templates use `brand.pdf_img_html(16)` — ⚠️ it emits **`align="top"`, deliberately not
  `baseline`**: xhtml2pdf maps an inline image's `baseline` to `bottom` and hangs it 0.2×its
  height below the text, and `top` computes to exactly zero for an inline image (fontSize is
  its draw height); every CSS `vertical-align` value, keyword or length, CRASHES the library.
  Four DOCX builders use `brand.add_wordmark(p, 17)`, which sets `distL/R/T/B="0"` on
  `wp:inline` because LibreOffice pads a python-docx picture ~9pt left when they are absent
  (Word reads absence as 0). Email: the frames reference `cid:meyy-wordmark`; the image is a
  new **`EmailMessage.inline`** list (`Attachment.content_id`), embedded by SmtpNotifier as a
  `multipart/related` part INSIDE the HTML alternative — never an attachment, so the invoice
  count stays honest and a text-only client gets no stray PNG; data: URIs were rejected because
  Gmail strips them. `mail_templates.inline_images()` is what the two teacher-mail routes pass;
  `test_letterhead_wordmark_travels_inline_by_cid` pins the MIME shape. ★ **The export lockup is STACKED, as the web bar is** (founder, same day): the mark on
  its own line, LESSON STUDIO beneath it, and the "NCF 2023 aligned" line is GONE from all ten
  letterheads (the `.brand-ncf` CSS rules remain, unused). The two email frames were
  stacked the same way an hour later (founder) — mark as a block image, LESSON STUDIO beneath,
  NCF line gone; every letterhead in the product now shares one lockup. All ten exports were
  rasterised and inspected (PDFs via pdftoppm, DOCX via LibreOffice); suite 42 green. Store icons: `icons/apple-icon.png` is now the
  4a LIGHT tile at 1024² RGB (App Store: no alpha) and `icons/play-icon.png` the same at 512²
  (Play's exact size); light because a dark tile vanishes on a dark wallpaper. `icons/icon.png`
  (the old spiral, 512²) is untouched. ⚠️ **`web/app/icon.png` and `web/app/apple-icon.png`
  are Next.js CONVENTION files** (favicon · iPhone home-screen icon) — they had been moved
  into `icons/`, which silently removed both from the app; restored at the convention paths
  with the MEYY tile (512² / 180²). Do not move them again. STATIC-verified (babel-parse
  clean ×5, CSS braces 2297/2297, mark rasterised on pine at both heights) — live + 360px
  bar pass owed.
- ★ **THE SETTINGS BAR NAMES THE CHOSEN ITEM, AND SUBVIEWS HAVE NO HEADING (founder,
  2026-09-03).** The frozen bar reads "⚙ Support" / "⚙ Subscription & billing" / "⚙ Teaching
  profile" — `settingsBarLabel` in page.jsx, the card's own words — with ✕ right; "Settings"
  shows only at the home list. Every subview `<h1 class="set-title">` and the frozen
  `.set-title-stick` (2026-08-26) are GONE from the subviews (only "Message sent" keeps a
  heading — it is a state, not the item); each subview's first element carries `.set-first`,
  which hands back most of `main`'s top padding (18px air desktop / 12px phone). Do not
  reintroduce a per-screen title under the bar. **Support is mail-shaped** the same day:
  `TO  support@meyy.in` on one row (hardcoded `SUPPORT_ADDRESS` in Settings.jsx mirroring
  `api/config.SUPPORT_ADDRESS` — the running API had served the founder's Gmail from a
  pre-change process, and an address a teacher is told must not depend on which server
  answered; both `--ink-soft`, so the row reads frozen) · **Subject** dropdown · message
  box opening at 4 lines on a phone so Send sits inside the 360×800 fold. STATIC-verified;
  live + 360px pass owed.
  ★ **AND THE ✕ NOW CLOSES THE ITEM THE BAR NAMES (founder, 2026-09-07).** It closed Settings
  ENTIRELY from anywhere inside it, so ✕ on "⚙ Personal profile" landed her on My Classes — a
  screen she had not asked for, two taps from the list she came in by. Once the bar names the
  chosen item, "close" must be read against THAT screen: a subview (and the teaching profile
  reached through the list, which restores `editFlow` as well) closes back to the Settings
  list; only the list itself closes to the tab she was on at gear-press. One control in one
  slot — the 2026-08-24 rule (no back-and-title pair; one titled row, one ✕) is untouched, and
  no back arrow was added. `settingsClose` in page.jsx is the single branch point; the
  `aria-label` is now "Close {the named screen}", and Settings.jsx's stale "page.jsx
  settingsBack" comment (a control that never existed) went with it. STATIC-verified
  (babel-parse clean ×2); live + 360px pass owed.
- **Type:** Fraunces (`--f-display`, headings/titles) · Newsreader (`--f-body`, lesson prose)
  · IBM Plex Mono (`--f-mono`, structural labels/kickers/numbers). No Inter/system fonts.
- **Palette tokens:** `--paper` warm cream + subtle grain · `--ink` warm near-black ·
  `--pine` (primary accent) · `--clay` + `--ochre` (warm highlights) · hairline `--line` rules.
- **Signature patterns:** a **marginal numbering rail** (period `01`, question `Q1` in the
  margin); **mono uppercase kickers** for structure (PROGRESSION STAGE / SPINE / COMPETENCY /
  SECTION); ledger hairlines; italic-serif sub-labels.
- The on-screen plan/assessment view is a React renderer in `web/app/page.jsx`
  (`ViewModelView` and friends). `aruvi_core/render/html.py` is the separate **export/PDF**
  renderer — keep the two visually aligned.
- ★ **THE SECTION CARD IS A SURFACE NOW — level-2 fills, state-hued edges, one constant grid
  (founder, 2026-08-30).** Mockup: `docs/mockups/my-classes-card-contrast.html`. The founder's
  read — "perhaps the issue is not difference among the section cards but overall colour
  difference with background" — measured out worse than it looked: against `--paper` the fills
  sat at **1.10** (unstarted), **1.04** (ONGOING) and **1.17** (complete). Under ~1.2 nothing
  reads as a separate plane, so the card was held up almost entirely by a 1px border — and the
  ranking was INVERTED, the card she teaches from separating least and the one she has finished
  with most. Three changes, in order of how much they actually do: (a) **the edge** — it was
  `--line-soft` at **1.05:1 against its own fill**, which is not an edge; each state now has one
  in its own hue (`--card-*-edge`) at ~1.3–1.4, and it costs nothing in text contrast, which is
  why it is the cheap win; (b) **the fills** levelled at **1.32**, each darkened toward its own
  accent rather than toward grey so the tints read as green and terracotta instead of tinted
  white; (c) **a constant 11px graph rule on every card** (`--card-grid`, 7.5% — 5% vanishes,
  13% competes with the serif title). Constant is the whole point: it is a MATERIAL, not a code
  — it says nothing, needs no legend, and cannot collide with status the way a per-class colour
  or pattern would. Paper keeps its grain, cards get their rule, each surface its own substance.
  ★ **The rejected sibling is worth keeping:** distinguishing CLASSES by colour or by per-class
  texture (`docs/mockups/my-classes-class-grid.html`, three options) was struck because colour
  on that screen is already spoken for — a fourth hue meaning "6B" makes green stop reliably
  meaning "teaching now" — and because a teacher tops out at ~6 sections, which fit one phone
  screen, so there was no problem to solve. **Scope:** new `--card-*` tokens, NOT edits to
  `--paper-sunk` / `--tint-pine` (37 and 35 other uses); My Lessons shares this palette on
  purpose and moves with it. Dark was measured separately against `#161d19` (it had the same
  defect: 1.06 / 1.18 / 1.09) and the grid inverts to a light rule there. ⚠️ **Two traps this
  cost:** every card background is now **`background-color`, never the `background` shorthand**
  — the shorthand resets `background-image` and would silently erase the grid on exactly the
  cards that have a status, i.e. all of them (the `--sel-chevron` trap of 2026-08-27, in a
  second place); and **darkening a surface breaks whatever was drawn in a hairline ON it** — the
  unit rail's empty ticks were `--line`, already weak at 1.08–1.21 and 1.04 at the new depth,
  and those ticks ARE the denominator of "unit 3 of 6", so they moved to `--card-tick`.
  `--card-muted` is `--ink-soft` darkened just enough to hold 4.5:1 on the deeper fills, applied
  by re-pointing `--ink-soft` **on `.sc-card` itself** so every muted descendant follows without
  a list that can drift. STATIC + contrast-verified (light and dark, every foreground on every
  fill); live + 360px pass owed — the one thing to look for is **moiré on the 1px grid** when
  the list scrolls on a low-DPI Android; if it shimmers, redraw it as an SVG data-URI at a
  device-pixel-friendly pitch rather than a CSS gradient.
- ★ **MY CLASSES BANDS BY SUBJECT — but only for a teacher who teaches more than one (founder,
  2026-08-30).** "Teachers compartmentalize subjects", and the flat list made her read the
  subject off every card to find the three that belong together. A **single-subject teacher —
  the common case — sees exactly what she saw before**: no heading, no band, nothing added to a
  screen where the grouping would have one member (`banded = bands.length > 1`). Under a band the
  existing rules are untouched: same cards, same three status colours, same "+".
  ★ **NOTHING MOVES.** `classesFromReadiness` already walks subjects → grades → sections in
  profile order, so same-subject cards were always adjacent; this only inserts headings into an
  order that already existed. Bands are built by **ADJACENCY, not by a map keyed on subject** —
  a map would silently reorder if that walk ever changed, where adjacency can only mis-SPLIT,
  which is visible on screen. Each item keeps its **ORIGINAL index**: the guided tour addresses
  its target card by position (`i === tourIdx`, on three separate elements), so re-indexing
  inside a band would put the hand on the wrong card. The card is ONE renderer (`renderCard`,
  a hoisted declaration below the return) for both paths, so they cannot drift; the only thing
  the band changes is the **kicker** — the subject is overhead, so a banded card reads "Ch 4",
  and an unattached one carries no kicker at all rather than an empty line. The heading is the
  house mono-uppercase kicker in `--pine-d` under a ledger hairline, never a display-serif title
  that would compete with the chapter names below it. STATIC + unit-verified (5 grouping cases);
  live + 360px pass owed.
- ★ **A LESSON PLAN IS A DOCUMENT, NOT A CLASS — MY LESSONS GOES PLAIN (founder, 2026-08-30).**
  The two tabs shared one status palette ("reused verbatim so the two tabs share one status
  palette"), so a lesson card and a section card were the same object to the eye while affording
  different things — no bookmark on one, no export on the other — and the founder's worry was
  that she acts on a card without registering which tab she is on. The tab bar cannot settle it
  either, because the two genuinely co-occur: the "+" attach picker inside My Classes lists
  lessons, and prior-year lessons render as `.sc-card`s. **The PLANE now says what KIND of thing
  a card is; only the 4px spine says where it stands.** ★ The asymmetry that makes this free:
  the lesson card ALREADY spells its status out in words ("Completed 6A, 6C · Teaching now 6B"),
  where the section card has no such line and colour is its only carrier — so the tint was
  redundant on one side and load-bearing on the other. **Three planes were built and compared
  live in one hour** — **manila** `#f1e7cf` (the folder metaphor, and the nicest idea; but a WARM
  neighbour of the unstarted sand card, the one thing it exists to be told apart from — a mid
  manila sits 1.08 away, near-identical in weight, and only the lightest of three depths keeps a
  usable 1.15 gap), **cool slate** `#e6eaef` (the only COOL candidate, so unmistakable in any
  light, at the cost of a new hue in the app), and **PLAIN PAPER, where it settled**: `--card-doc`
  now ALIASES `--paper-2` / `--edge`, so the dark theme needs no second pair and "plain paper"
  means the ordinary card surface in whichever theme is on. Plain measures strongest of the three
  — **1.41 from every status fill in LUMINANCE**, so it holds in sunlight, on a cheap screen and
  for colour-blind eyes, where a same-weight hue swap vanishes — and it states the idea plainly:
  the tint is what marks a class she teaches, so the document is the one card with no tint at
  all. Swapping the tone again is two lines, and the two rejected values are in the token's own
  comment.
  ⚠️ **Three things this cost, all from one root — a light plane carries nothing by itself:**
  (a) at 1.07 against the page the fill cannot hold the card up at all, so the EDGE is the whole
  of the separation (`--edge` at 1.82 against the fill, never `--line-soft` — do not soften it
  back); (b)
  `.sc-card:hover` is (0,2,0) and the plane rule is (0,4,0), so the hover affordance had to be
  **restated at the higher specificity** or the card would silently stop answering the pointer;
  (c) the shelf spine was a hardcoded `#8aa79b` at **2.60:1** on a light plane — under the 3:1 a
  non-text mark needs, and now the ONLY carrier of the lifecycle — so it darkened to
  `--spine-shelf` (#75998c, 3.14 on white) in light and kept the lighter value in dark, where it
  was already at 5.97. ⚠️ **Re-measure that spine whenever the plane's tone changes**: sage was
  re-solved three times in one hour (white → manila → slate → white) because the plane kept
  moving under it, and every darkening walks sage toward pine — which is the shelf-versus-
  teaching distinction it exists to hold. #75998c is the LIGHTEST value that clears 3:1 on white,
  chosen for exactly that reason: it stays as far from pine as the threshold allows.
  Scoped `.mlp2 .sc-card:not(.mlp2-arch):not(.sc-proposed)`: the archive keeps its sunk plane and
  a re-preparing card keeps `.sc-proposed`'s. The `:not()`s are load-bearing, not tidiness —
  `.sc-card.mlp2-arch` ties on specificity and sits EARLIER in the file, so without them source
  order alone would decide it (the `.ap-row-line` bug of 2026-08-27). Options considered and
  parked, with numbers: the chat-only comparison covered slate · plain · manila · ledger rules ·
  a top rule instead of the spine · a folded corner; **ledger rules + a dog-ear remain the
  strongest pair if plain proves too quiet**, since both differ by material or silhouette and so
  survive greyscale without spending a colour. STATIC + contrast-verified both themes; live +
  360px pass owed.
- ★ **A NATIVE `<select>` CANNOT BE THEMED ON macOS — so Aruvi stopped using one
  (`Dropdown.jsx`, 2026-08-27).** Reported as "the dropdowns use a dark background"
  (Support's category chooser, the subscribe flow's Subject/Stage) and chased in the
  wrong direction twice before the browser was actually asked. The CLOSED control was
  never the problem — `.ob-field select` had worn house colours since 2026-08-25. The
  dark thing was the **OPEN LIST**. First fix: **`color-scheme` was declared nowhere in
  globals.css**, so browsers drew all native UI from the OS preference. That is a real
  bug and the fix is KEPT (`:root { color-scheme: light }`, flipped to `dark` in the
  ≤600px `[data-theme-effective="dark"]` block — it is what stops scrollbars, autofill
  and date pickers following macOS instead of Aruvi). **But it did not fix the popup.**
  Measured live, on the founder's Mac, page light and OS dark: `html`, `select` AND
  `select option` all computed `color-scheme: light` with `background: rgb(255,255,255)`
  — and the menu still came up black. On macOS Chrome hands a select's popup to a native
  NSMenu that reads neither the page's `color-scheme` nor the `option` rules. **There is
  no CSS fix.** `wheels.jsx` reached this same conclusion on 2026-07-26 and built
  `PpwSplitCell` as a button + listbox to escape it; `Dropdown.jsx` is that pattern
  generalised so the app escapes it ONCE. Same API as a select (`value` ·
  `onChange(value)` · `options`), position:FIXED (an `overflow:auto` ancestor would clip
  it), flips above when below is tight, closes on select/Escape/outside/scroll/resize,
  full keyboard + `aria-activedescendant`. **Converted: Support category · Personal
  profile and subscribe Role/State · the cart's Subject/Stage · Allocate's chapter
  adder.** No native `<select>` remains in a live component. Two traps found by
  measuring: (a) `all: unset` resets `text-transform`/`letter-spacing` to **inherit**,
  so inside a field label the button read "CHOOSE ONE" in spaced caps — both are now
  stated explicitly on `.dd-btn`/`.dd-opt`/`.dd-pop`; (b) sizing the popup from a
  row-count estimate clipped the last option whenever a label WRAPPED, so a flip-above
  now sets `bottom` and lets the list size itself under a room-based cap. The base
  `select` rule still carries the house treatment (appearance:none · `--sel-chevron` ·
  `--field-bg`) for anything native that remains — ⚠️ a select rule setting
  **`background:`** instead of **`background-color:`** silently WIPES that chevron.
  LIVE-VERIFIED in Chrome (Support + Personal profile, 5- and 23-option lists, flip,
  scroll, current-value marking); the subscribe cart's two rows are static-verified only.
- **ONE EMAIL FORMAT (founder, 2026-08-27).** `mail_templates._html_shell` (support)
  is now the subscription confirmation's `_html_body` frame **row for row and padding
  for padding** — brand + "NCF 2023 aligned", the 2px ink rule, greeting, lead, k/v
  ledger, closing paragraphs, hairline footer. It was deliberately different at first
  (the reasoning: a letter borrowing a receipt's shape reads like a receipt); overruled,
  because a teacher does not receive "a receipt" and "a letter" — she receives mail from
  Aruvi, and the second one arriving in an unfamiliar shape is a small reason to doubt
  it came from us. Only the CONTENT differs (no priced rows; a quoted block of her own
  words). **Change one frame, change both** — they are separate functions only because
  `_html_body` bakes subscription facts into its rows.
- **One shell measure — `--shell-w` (860px) / `--shell-pad` (34px), 2026-08-21.** The signed-in
  shell is ONE centred column and the chrome aligns TO it, never to the screen. `main`,
  `.topbar .hdr` (brand · gear · user/log-out — ⚠️ NOT a theme toggle: this line said "theme"
  until 2026-09-13, when the parity audit measured `.hdr-user` and found exactly two children,
  the gear and the identity block; appearance is chosen in Settings) and the Ask-Aruvi mark's right offset all
  derive from these two tokens; the `.topbar` pine fill and `.main-tabs` paper strip still span
  edge to edge (only their CONTENTS are capped — that is what makes the bar read as a bar).
  Before this only `main` was capped, so on a Mac the content sat as an 860px column mid-screen
  while the brand pinned far left and Ask Aruvi far right, adrift from the content they belong
  to. `.ask-q` uses `calc((100% - min(100%, var(--shell-w)))/2 + var(--shell-pad))` — the
  centring term collapses to zero below 860px, so narrow viewports keep the plain gutter they
  always had. Do NOT reintroduce a per-component width; change the measure here.
  STATIC-verified only (csstree clean, braces balanced) — live + mobile pass owed.
- **ONE BAR, TWO PHASES — first run wears the shell's chrome (2026-08-21).** `FirstRun.jsx`'s
  `<Brand/>` was a centred paper brand with the user stacked above it — a visibly older Aruvi
  that the teacher met for her ENTIRE first session, sign-in through to her section cards. It
  now renders the shell's own markup (`.hdr` › `.brand`/`.hdr-brand-tag` + `.hdr-user` ›
  ThemeToggle + `.hdr-user-id`) inside `.fr-brand`, and globals.css lists `.fr-brand` beside
  `.topbar` on every bar-painting rule (and in the dark-theme flip), so the two CANNOT drift —
  only the five `--bar-*` token values are duplicated, because custom properties inherit by DOM
  subtree and `.fr-brand` is not inside `.topbar`. What first run deliberately does NOT get is
  NAV: no tab row, no settings gear — Phase 1 is shell-less by design (§0). Login keeps its
  centred card, no bar. `.fr-brand` is `position: fixed` (as the shell's bar is) because
  `.fr-wrap` is a centred flex column at ≥700px and an in-flow bar would float down the page
  with the step content; `--fr-bar-h` is measured in FirstRun.jsx and reserved as `.fr-wrap`
  padding-top (74px fallback for first paint, the `--nav-h`/`.topbar-spacer` idiom) — note the
  ≥700px `.fr-wrap` rule must keep adding it or tall steps slide under the bar. Contents cap to
  the FIRST-RUN column (480/560px), not `--shell-w`: chrome aligns to its own content.
  STATIC-verified only (babel-parse clean, braces 1984/1984, csstree clean bar the known
  `env()` false positives) — live + mobile pass owed.
- **Mobile compatibility is a standing requirement — check it on a regular basis (VERY
  IMPORTANT).** Many Indian K–12 teachers will reach Aruvi on a phone, so the web UI must
  stay usable on small screens, not just desktop. Treat mobile as a first-class viewport:
  - **Every UI change must be verified at a mobile width before it is considered done** —
    use the Cowork preview `preview_resize` (e.g. 390×844, iPhone-class) and `preview_snapshot`
    in addition to the desktop check. No layout regression ships unverified on mobile.
  - Watch for the usual breakages: horizontal overflow / sideways scroll, fixed-width tables
    (Allocate period columns, competency tables), the marginal numbering rail crowding text,
    tap targets too small, and font sizes that don't scale down.
  - Keep responsive rules in `web/app/globals.css` (`@media` breakpoints); don't hardcode
    desktop-only widths in component styles.
- **The Monday-morning feel (design principle, not yet built).** The product still reads as
  planner-centric — built around the plan as artifact, not the teacher's morning as
  experience. The opening moment should land emotionally before it lands technically. A
  teacher opens Aruvi at 8:20 AM; the first five seconds shouldn't show a dashboard, they
  should feel like being met. Something like: "Good morning. Today you teach three classes."
  followed by a short, scannable list —
  - 7A → Period 4
  - 7B → Period 6
  - 8A → Start Chapter 3

  — and one tap from there into the actual lesson. This is a north star for a future
  home/landing view (not yet specced or scheduled — see §9), but every screen built between
  now and then should be judged against it: does this feel like a planner serving the
  teacher's day, or like the teacher serving the tool's structure? When the home view is
  eventually designed, keep it consistent with §4's "scholarly planner on warm paper" system
  (Fraunces/Newsreader/mono kickers) — warmth comes from the words and pacing, not a
  different visual language.

- ★ **THE PRIMARY NAV IS AT THE FOOT (founder, 2026-09-13: "switch My Classes / My Lessons,
  Ask Meyy and the big plus to the bottom").** The app's ENTIRE nav is one bar at the bottom of
  the shell — `.bnav` in `web/app/globals.css`, rendered after `.bodycontent` in `page.jsx`.
  Four items, icon over a 10.5px uppercase mono label: **My Classes · My Lessons · Add · Ask
  Meyy**. The top bar keeps only the brand row (and the frozen ⚙ Settings `set-bar` while she is
  in Settings); the old `.tabs.main-tabs` are gone, and so are the two greeting-row "+" buttons
  in `MyPlans.jsx` — the standing "+" portal is now the bar's **Add**. Skin (chosen from a
  bottom-nav mock, "option A + edge 4, light edge"): **sunk paper** (`--paper-sunk`) under a
  **1 px `--edge` top rule** — the same weight as the clay rule between lesson phases, which is
  why the last phase drops its own (`.uv-phase:last-child { border-bottom: 0 }`) — and nothing
  under the bar. Active item is **clay**, with a short clay underline. In the app shell it is
  static flow at the foot of the body column (`html.app-shell .bnav`), so like the top bar it
  cannot scroll away; pre-shell it is fixed and `.bodycontent` reserves 62px. The safe-area
  bottom inset is padding INSIDE the bar, so the sunk paper runs to the physical edge and the
  items sit above the home indicator. Contents cap to `--shell-w`, so on a Mac the four items
  sit over the 860px content column, not the screen's corners. ★ **UP ON EVERY SCREEN,
  SETTINGS INCLUDED** (founder, 2026-09-14) — it used to hide behind the frozen Settings bar on
  the reasoning that Settings is a modal room whose ✕ is its only exit; struck the day after Ask
  Meyy's scrim, for the same reason: the nav is the app's nav, and a screen that takes it away
  leaves exactly one way out of itself. Which item lights up is `activeNav`: My
  Lessons only when the repository is open; Settings/profile light neither; everything else —
  the class cards, Generate, a lesson opened from them — reads as My Classes. Lapsed hides My
  Classes and Add (§2.5 as amended). GuidedTour's four anchors (`nav-classes`, `nav-lessons`,
  `grow-add`, `ask-aruvi`) are `place: "above"`. **Ported 1:1 to Expo** as
  `mobile/components/BottomNav.jsx`, mounted in `mobile/app/(app)/_layout.jsx`, measures in
  `mobile/theme/web.js` under `bnav*` (measured 390×844: bar 56.85 tall, items 84 wide, label
  10.5/13.75, letter-spacing 1.05) — same four items, same glyphs.
  ★ **AND NOTHING COVERS IT (founder, 2026-09-13).** Ask Meyy's scrim ran to the foot of the
  screen, so opening it took the app's ENTIRE nav away and the panel's own ✕ became the only way
  out — the one screen she could not simply leave. A panel that is a DESTINATION must not cover
  the nav that reaches it. `page.jsx` now publishes **`--bnav-h`** beside `--nav-h`/`--hdr-h`
  (measured live, ResizeObserver on `.bnav` as well as `.topbar`, **0px wherever the bar is not
  rendered** — so one expression is correct on every screen, including Settings, where Ask Meyy
  is reached from a row instead and rightly gets the full height), and `.aa-scrim` stops at it.
  The bar is then not merely visible but LIVE, so each item states what it does to an open panel:
  the three destinations close it and go, **Ask Meyy toggles**, and while the panel is up Ask Meyy
  carries the clay and My Classes / My Lessons do not. `aria-modal` on the panel is now **false** —
  the bar sits outside the dialog and works, and claiming otherwise lies to a screen reader.
  ⚠️ Still covering the bar, by design for now: `.ap-overlay` (the ProfilePortal window, `inset:0`,
  z 60) — a true modal with one question and its own ✕, not a destination.

- ★ **THE BOTTOM NAV STAYS AT FOUR — YEAR PLAN IS A LENS, NOT A PLACE (founder, 2026-09-13).**
  Considered as a fifth item and declined on two grounds. **Measured:** "MY LESSONS" is 73.7px
  at the bar's type; five items leave a 70.4px slot at the 360px stress width, so a label would
  have to shrink or truncate on every phone (390 leaves ~1px of air per side; only 412 is
  comfortable). **Structural:** Year Plan is a view of ONE subject·class, and that choice is made
  by the wheels inside My Lessons — a bar item would have to guess the class or drop her into My
  Lessons to ask, which is where she already was. The other four are places; this is a lens on
  one of them. The discoverability worry behind the question was real and is answered where it
  belongs — see the paired switch below.
- ★ **"YOUR LESSONS / YEAR PLAN" ARE PAIRED (founder, 2026-09-13).** The 2026-08-06 switch put the
  two words at OPPOSITE ends of `.mlp2-titlerow` with the archive box between them, and its own
  note ("nothing told a teacher the pane existed") had not actually been answered: a word alone at
  the far end reads as a HEADING for what sits under it, not as the other half of a choice.
  **Adjacency is the fix** — the pair now holds the left behind a hairline `.mlp2-vsep` ("/", in
  `--edge`, aria-hidden), and the archive box takes the right end (still rendered only while the
  lessons pane is live — it is a sub-state of THAT pane wherever it sits). Everything else is
  unchanged: same face, same size, live word `--ink` + the 1px clay rule, resting word
  `--ink-soft`. **Two treatments were built and rejected:** inking the resting word pine, alone or
  with the pairing — it makes the option she is NOT on the more colourful one, inverting the
  hierarchy. If the pair still reads too quiet on a phone, a 1px dashed rule under the resting
  word is the one-line addition; a box is not (this switch was designed without chrome).
  Measured paired at 360px: 231px of the 324px row, no wrap, 93px spare.
- ★ **A BOUND CHAPTER IS BEING TAUGHT, FROM UNIT 1 (founder, 2026-09-14).** A section card is
  green the moment a chapter is attached, and stays so until it is complete; the sand `st-new`
  card belongs to the NO-chapter case alone. The web already behaved this way **by accident** —
  `pointerFor` read the stored pointer straight into `Number()`, and `Number(null)` is `0`, which
  passed `n >= 0` and came back as unit 1 — so the rule was right and the reason was not, and the
  `: "st-new"` branch for a bound plan was unreachable dead code. The phone guarded for null
  honestly and rendered the SAME section sand, which is how the parity audit found it. Both
  surfaces now state the rule instead of inheriting it: `pointerFor` is honest (absent → null) and
  the card reads `pointerFor(sk) || 1`. ⚠️ `unitsDoneFor` still counts 0 for an untouched section,
  so the untrack history gate (≥1 unit) is unaffected — do not "tidy" the two into one helper.
- ★ **THE GRAPH RULE IS ON BOTH SURFACES, AND LIGHTER (founder, 2026-09-14).** It was web-only
  because React Native has no repeating gradient; the phone now tiles a react-native-svg
  `<Pattern>` instead — a true 11px tile, line on the top and left edge of each cell, exactly what
  the web's two gradients draw. Weight dropped to **5%** light / **4%** dark (from 7.5 / 5.5): it
  is a material, and it must not interfere with reading. ⚠️ The weight lives in ONE place,
  `--card-grid` in globals.css — `mobile/theme/gen-tokens.py` regenerates `theme/tokens.js` from
  it, so changing it there changes both. Run that script after any token edit.
    ⚠️ **AND IT UNCOVERED THE `.ap-row-line` TRAP IN A THIRD PLACE.** `.mlp2-vtab { font-size:20px }`,
  `.mlp2-titleleft { gap:6px }` and `.mlp2-archfolder { padding:4px 5px }` sat in the ≤600px block
  at ~line 2231 while their BASE rules sit ~2400 lines further down at the same specificity — so
  source order beat them and **the title row had been rendering at its DESKTOP size on every
  phone** (measured: 23px, not 20px; gap 9px, not 6px). Only `.mlp2-titlerow` worked, because its
  base rule happens to sit earlier. All four now live in a ≤600px block placed immediately AFTER
  the base rules. **A same-specificity override placed before its base rule does nothing — in this
  file, always check source order.**

---

## 5. Repo layout

```
aruvi_core/            engine (Python, no UI deps)
  view_model.py        canonical structure-preserving contract
  subjects/            base.py (Subject interface) + __init__.py (registry) + one pkg/subject
  ports.py  engine.py  normalize.py  grades.py  allocate.py  render/html.py
  adapters/            the ports' implementations — every Bucket-B repository over ONE
                       document_backend.py (FileBackend = the tree, PostgresBackend = one
                       `documents` table; Track C 2026-09-09) + auth/billing/notifier/storage
api/                   FastAPI service (main.py, data.py, config.py) — wraps the engine
web/                   Next.js app (app/page.jsx = login gate + 2 tabs: My Plans + Generate; see §11; app/globals.css = design)
packages/shared/       ★ @aruvi/shared (Track D step 1, 2026-09-11) — the client logic BOTH apps run:
                       format (API helpers), sectionState, sectionHistory, verify, legalmd (parser),
                       auth (client-injected), ask-aruvi bank+search, signout. Pure ESM, no JSX,
                       ZERO dependencies; storage.js (sync shim: localStorage / MMKV) + config.js
                       (API base + token provider) are the seams. web/app/lib/*.js are now thin
                       wrappers over it (shared-setup.js installs the web's storage/API/Supabase
                       client). `npm test` there = node --test, no platform needed.
mobile/                ★ the Meyy phone app (Track D step 2, 2026-09-11): Expo managed + Expo
                       Router, presentation only. lib/boot.js installs the shared package's seams
                       (storage = expo-sqlite/kv-store — sync, inside Expo Go; MMKV waits for a dev
                       build), theme/tokens.js is GENERATED from globals.css (theme/gen-tokens.py),
                       the three faces are bundled. app/login.jsx is the front door (OTP via
                       Supabase), app/(app)/ the signed-in shell. mobile/README.md has the run steps.
tests/                 test_*.py + fixtures/ (real saved plans + mappings as parity fixtures)
data/                  ★ the data root, laid out along the CLOUD/LOCAL boundary (2026-08-23,
                       CLOUD_DATA_MODEL.md §0.5) — see §7
  cloud/               ★ THE MIGRATION UNIT — everything here goes to production, byte for byte
    content/           Bucket A-serve → object store (DATA_DIR): allocation_norms,
                       chapters/**/mappings, framework, saved_plans (libraries + serve cache)
    content/legal/     ★ the user agreement, ONE copy, versioned by FILENAME (2026-08-27);
                       + privacy_policy_v0.1.md (2026-09-04, DRAFT, not yet served — its
                       brackets + audit findings: docs/legal/privacy_policy_considerations.md)
    content/ask_aruvi/ ★ the Ask Aruvi question bank, ONE copy, hand-written (2026-08-30) —
                       served by GET /ask-aruvi behind X-Aruvi-User, never bundled
    state/             Bucket B → Supabase Postgres (STATE_DIR): accounts, academic_years,
                       readiness, allocations, section_state, prepared_plans, plan_archive,
                       plan_notes, support — all {tenant}/{user}[/{year}]-keyed; PLUS three
                       stores that deliberately sit OUTSIDE that shape so the erase
                       traversal cannot reach them: invoices/_series/ (the seller's number
                       series), support/_series/ (the support reference series) and
                       consents/_ledger/ (proof the agreement was accepted)
  authoring/           ★ FOUNDER-SECURE, never syncs: constitutions, chapters/**/summaries
                       (read only by the genon pipeline + chapter skill, NEVER by api/)
  testing/             local testing-campaign state (TESTING_DIR) — outside the migration unit
docs/                  architecture-plan.md, ALLOCATION_REPORT_*.md, flow PNG, mockups/ (design refs, not loaded by code)
  administrative_architecture.md  ★ the ADMIN half — account · academic year · cutover ·
                       notes · data rights · entitlement, as a 0→6 dependency chain with the
                       exact PORTS an external partner implements. Vendor-neutral by design
                       (roadmap §4 forbids pre-picking the cloud/gateway). Read before any
                       work on auth, billing, privacy, subscriptions or the academic year.
backup/                ★ MISNAMED — it is NOT an archive and must not be moved or renamed.
                       It is the genon pipeline's WORKING directory (build_library.py moves
                       failed canonicals to backup/quarantine/; the repair_*.py scripts write
                       their before-copies here) AND the test suite's fixture source
                       (tests/test_genon_carriers.py loads real prototype-era plans from
                       backup/saved_plans/ at six sites). Renaming it was considered and
                       REJECTED 2026-09-17: several hundred references exist, and most are
                       RECORDS — provenance blocks inside ~90 certified canonicals under
                       data/cloud/content/saved_plans/, constitution CHANGELOGs, genon/out/
                       stage sign-offs and the testing campaign register. Rewriting those
                       would falsify the record of what happened; leaving them stale would
                       recreate the dead-path bug of 2026-08-23 (data/content/saved_plans in
                       purge_derived.py, which silently purged nothing for weeks). The name
                       is wrong; the cost of fixing it is not worth paying.
archive/               stray root files with nothing referencing them, parked for deliberate
                       deletion (2026-09-17). Nothing reads it.
cowork prompts/        ★ authoring prompts for the `chapter` skill (chapter_summary +
                       competency_mapping/effort_index, per subject/stage) — copied over
                       wholesale from Project Aruvi 2026-07-01 (see §10); this is now the
                       authoritative copy the `chapter` skill reads from, NOT Project Aruvi's.
CLAUDE.md MEMORY.md CLOUD_DATA_MODEL.md   standing docs (stay at root by convention)
```

Cleanup/reorg done 2026-06-28: junk purged (out/, .next/, caches, others/), docs consolidated
under `docs/`. `data/` is now the self-contained root (§7). ★ **Everything under `data/` IS
TRACKED in git** (corrected 2026-09-09 — `.gitignore` had said so since the GitHub-backup
decision; only `/textbooks/` and regenerable/secret items are excluded). Consequence: a
container image must copy NAMED runtime paths, never `COPY . .` — `data/authoring/` is in
the same clone. `Dockerfile` + `.dockerignore` enforce it.

---

## 6. How to run

Two dev servers (use the Cowork preview, configs in `.claude/launch.json`):
- **API:** `python3 -m uvicorn api.main:app --port 8000`  (preview name `aruvi-api`)
- **Web:** `npm --prefix web run dev`  → http://localhost:3000  (preview name `aruvi-web`)

First time: `pip install -r api/requirements.txt` and **`npm install` at the repo ROOT** —
the root `package.json` is an npm workspace (`web`, `packages/*` — NOT `mobile`, see below) and links `@aruvi/shared` into `node_modules`; `npm --prefix web install` no longer
works on its own (the shared package is not on any registry). One root `package-lock.json`.
- **Phone:** `cd mobile && npx expo start` → scan with Expo Go (same WiFi). First time
  `npm install` IN mobile/ (it is NOT a workspace — its React 19 tree must not hoist beside the
  web's React 18; it links packages/shared by `file:` path), `npx expo install --fix`, and
  `mobile/.env.local` from `.env.example` (`EXPO_PUBLIC_API_URL` = Render, or the Mac's LAN
  IP:8000 for the dev API).

**Deploying (Track A, 2026-09-09):** `render.yaml` + `Dockerfile` + `deploy/` — one Render
Docker service with a persistent disk at `/var/aruvi` for Bucket B. Steps and the
container's layout: `deploy/README.md`; the plan it belongs to: `docs/mobile_migration_plan.md`.
`ARUVI_CORS_ORIGINS` fences the web channel on the deployed host (`*` locally).
Web fonts load via a Google Fonts `@import` (needs internet, else serif fallbacks).

---

## 7. Data source — laid out along the cloud/local boundary (restructured 2026-08-23)

The app no longer reads from the prototype mirror at runtime. **`data/cloud/` is the literal
migration unit** — everything under it goes to production, byte for byte; everything outside
it stays founder-local (`CLOUD_DATA_MODEL.md §0.5`, the third axis on top of the A/B split).
Consequence of the genon architecture: serving is deterministic selection from certified
libraries, so constitutions, summaries and prompt-texts are authoring inputs the production
runtime NEVER reads. `api/config.py` exposes three seams:

- **`DATA_DIR`** (env `ARUVI_DATA_DIR`) — **Bucket A-serve**, shared read-only content the
  RUNTIME reads: `allocation_norms/`, `chapters/**/mappings/`, `framework/` (the runtime
  reads its competency glossaries + english `spine_to_cg.json`; the NCF-derived cg/pedagogy
  .txt ride along — public-source, not worth splitting a second tree), `saved_plans/`
  (certified canonical libraries + the served-plan cache), `legal/`, and
  `ask_aruvi/` (the Ask Aruvi question bank — served by `GET /ask-aruvi` to signed-in
  teachers only, and cached on the device; never bundled into the web build). Defaults to
  `data/cloud/content/`. The app never writes here except `save_generated_plan` (the shared
  serve cache). Cloud home: object store.
- **`STATE_DIR`** (env `ARUVI_STATE_DIR`) — **Bucket B**, per-user/tenant STATE. Defaults to
  `data/cloud/state/` (accounts, academic_years, readiness, allocations, section_state,
  prepared_plans, plan_archive, plan_notes). ★ **Cloud home built 2026-09-09 (Track C):**
  `ARUVI_STATE_BACKEND=postgres` + `ARUVI_DATABASE_URL` put every store on ONE Supabase
  `documents` table keyed by the same folder path (`config.state_backend()`,
  `aruvi_core/adapters/document_backend.py`); `aruvi-scripts/migrate_state_to_postgres.py`
  moves and verifies. File mode stays the default for dev and tests.
- **`TESTING_DIR`** (env `ARUVI_TESTING_DIR`) — the testing-campaign register, LOCAL-only,
  `data/testing/` — deliberately outside the migration unit.

**`data/authoring/`** (constitutions, `chapters/**/summaries/`; env `ARUVI_AUTHORING_DIR`
for the genon pipeline's `prompt_assembly.py`) is FOUNDER-SECURE and never syncs. Grep-able
invariant: nothing under `api/` or `aruvi_core/` may read it — a runtime feature wanting an
authoring artifact is a promotion decision recorded in CLOUD_DATA_MODEL.md first.
Migration was `aruvi-scripts/migrate_cloud_layout.py` (idempotent, re-runnable).

Both default-derive from the repo root (never hardcoded to a machine). So a fresh clone is
runnable with **no env vars and no sibling `Project Aruvi` folder**. The prototype is still
the *authoring* source for new content (§10), but it is not a runtime dependency.

**Tenanting (no auth yet).** The teacher's user ID arrives in the **`X-Aruvi-User`** request
header (set by the login portal, §11); the API's `_current_identity()` reads it, with
`tenant_id == user_id` (one teacher = one individual tenant — the ICP). Both readiness and
allocations are keyed `{tenant}/{user}/…` on disk, so two teachers never share or overwrite
state. Phase 4 swaps the header read for the Supabase auth token — that one function is the
only change. (Current dev data is under user **`Kumar1`**.)

---

## 8. Tests

Stdlib only; run any directly, e.g. `python3 tests/test_render.py`. Suites: view_model,
science/english/maths/ss/twau ports, render, allocate, **allocation (tenant-keyed register
merge + isolation), readiness (per-tenant persistence + projection-stripping)**, api. Each
subject's parity test runs a REAL saved prototype plan through its normalizers — fixtures are
the acceptance spec. Full suite is **11/11 green** (2026-06-28; the two previously-stale
allocation/api tests were fixed). `test_*` that hit content need `ARUVI_DATA_DIR=$PWD/data/cloud/content` (the default since the 2026-08-23 cloud/local restructure — so usually no env var at all).

Tooling note: the Cowork browser preview only rasterizes the first viewport, so scrolled
screenshots can come back blank — verify via DOM (`preview_eval`) or bring content to the top.

**Mobile check is part of "tested" (see §4):** for any UI work, after the desktop pass, run
`preview_resize` to a phone width (~390×844) and re-snapshot to confirm no horizontal overflow,
broken tables, or unreadable text. Do this every session that touches the web UI — mobile
parity is verified routinely, not just at the eventual Expo milestone.

---

## 9. Status & roadmap

> ⚠️ **Re-prioritized 2026-07-01 by §0 (mobile-first progressive acquisition).** The "Done"
> capabilities below still stand, but the *sequence* they're presented in changes: the immediate
> track is now Phase 1 (shell-less guided first experience) + Phase 2 (workspace shell, My Week as
> Home, + Prepare Lesson). Auth/live-gen/PDFs/payments (the "Next" list) remain, but are read after
> the mobile-first re-sequencing lands. Treat §0 as the current north star.

**Done:** engine + all 5 subjects (parity-tested) · grade→stage · allocate (multi-row
schedule) · FastAPI · HTML redesign (warm-editorial) · factors note · allocation-report
PDF/DOCX export.

**Editable teaching-profile drill-down — `MyClasses.jsx` (2026-06-28).** The "wizard-as-profile"
pattern (re-launching `Readiness` to edit) is RETIRED. Profile editing now uses a new focused
drill-down: **Subject → Grade → Section**, view-first, one level in focus at a time (back +
breadcrumb). The grade screen is **three tabs** (Annual budget · Duration · Sections →) styled
like the top tabs. **Editing is gated behind an explicit Edit toggle — nothing mutates in view
mode** (every mutator early-returns when `!editing`; budget/durations/day-grid are read-only
displays until Edit); switching grade tabs cancels an in-progress edit. Weekly days are **per
section** (no schema change — the readiness `grids[gradeIdx][secIdx][dayIdx]` was always
per-section). Guided **add** flows (subject → grades multi → sections multi, paged 3/4 at a time
in 5-min duration steps) reuse the readiness "Let us begin" patterns; **delete** warns about
downstream children. The component operates DIRECTLY on the canonical `readiness.subjects[]`,
deep-clone-mutates, `POST /readiness {subjects}` (full replace, same as first-time setup), and
calls `onChange(projectReadiness(...))` so MyPlans/Allocate consumers stay in sync. Budget edits
are stored as `{method:"periods", value}`. Wired in `page.jsx`'s `editFlow` slot (both sidebar
"Edit profile"/"Edit calendar" links land here); `Readiness` is now used ONLY for first-time
setup (in `MyPlans`). Design spec/source: `docs/mockups/editable-profile-tree.html` (the
iterated mockup). **STATICALLY verified only** (babel-parse clean, CSS balanced, pure data-helper
unit tests pass) — per §11 the sandbox can't `next dev`; **live render + mobile (~390px) check is
the immediate must-do before further work.**

**Administrative architecture Steps 0+1 (2026-08-22) — account record + year-scoped
addressing, BUILT and migrated.** Per `docs/administrative_architecture.md` §5: `Account`/
`AccountRepository` + `Identity`/expanded `AuthProvider` + `AcademicYear`/
`AcademicYearRepository` in ports.py, each with a file adapter (`data/accounts/…`,
`data/academic_years/…`, `header_auth_provider.py`). `_current_identity()` now resolves
through the account record (JIT-created on first request) — tenant_id and user_id are
separate values that happen to be equal. The four TEACHING-state repos (allocations,
section_state, prepared_plans, plan_archive) are year-scoped: `year_id` after `user_id` in
every method, paths `{kind}/{tenant}/{user}/{year}/…`. Readiness deliberately NOT
year-scoped (the class list carries, spec §2.7). Year resolution is SERVER-side: routes take
optional `?year_id=`, absent → the teacher's current year, bootstrapped April-anchored
("2026-27"). Zero web changes. Dev data migrated via `aruvi-scripts/migrate_step01.py`
(idempotent, re-runnable). New tests: test_account / test_academic_year / test_year_scope /
test_migration. Full entry: MEMORY.md 2026-08-22.

**A FREE TRIAL IS ONCE PER MOBILE NUMBER, EVEN ACROSS AN ERASURE (2026-09-18, founder).** Erasure
still forgets her profile; the one thing kept is `trial_ledger/{hmac}.json` — an HMAC of the number
under `ARUVI_TRIAL_LEDGER_KEY` (never the number), the trial chapters it used (a purchase = spent),
forgotten after 24 months. Outside the erase walk; written in `data_rights_erase` before the
entitlement goes; read by `_entitlement_of`'s JIT trial; `/onboarding/verified` returns
`trial_remaining` and both front doors send 0 to Subscribe. **FIVE places now agree** on what
survives an erasure: Privacy Notice v0.3 §7 · User Agreement v0.5 §C and §G · `_KEPT` (7 rows) ·
the ledger's placement. ⚠️ Never rotate the key (render.yaml generates it once) — a new key
silently reopens the loophole. Counsel item: `docs/legal/privacy_policy_considerations.md §8`.
**An attached lesson is never archived** (server 409 + both UIs; the tour skips step 5 then), and
**a paid subject is never removed** — she empties its classes instead.

**THE TEACHING LEDGER LEAVES THE BROWSER — `section_history` is server-backed (2026-09-07).**
The last teaching state living in localStorage alone. `SectionState` holds only the CURRENT
binding and deletes the row the moment a chapter leaves the slot, so this ledger is the ONLY
record that a chapter was ever taught — and every other store already reconciled from the
server, meaning a teacher on a phone AND a laptop agreed about everything except what her
classes had been taught (`docs/mobile_migration_assessment.md` §4; sectionHistory.js's own
header had said the mirror was owed). Built to the sectionState pattern:
`SectionHistoryRepository` + file adapter (`section_history/{tenant}/{user}/{year}/
history.json`; atomic write, process lock, `raw_decode` self-heal) + `GET`/`POST
/section-history` + localStorage as a **synchronous** optimistic cache (`readHistory`/
`hasHistory` run during render and must never become promises).
★ **THE ONE DELIBERATE DIFFERENCE — IT MERGES, IT DOES NOT SNAPSHOT.** Section state is CURRENT
state, so the last writer rightly holds the truth; history is CUMULATIVE, so a whole-map write
from a phone that has never seen the laptop's rows would DELETE them. Entries upsert under their
own chapter FILE with latest-`ts`-wins on both sides of the wire (`_ts_of` / `tsOf`, pinned
against each other by a test that reads the JS — a malformed `ts` LOSES: *a merge may not
destroy what it cannot prove is stale*); a TIE keeps the stored row, so a replay is a true
no-op and the client can push fire-and-forget. The pull UNIONS, which is why **sectionState's
wholesale-empty guard is unnecessary here by construction**.
⚠️ **THE PUSH-BACK IS A CROSS-ACCOUNT WRITE IF LEFT UNGUARDED.** The reconcile must push rows
the server lacks (an existing teacher's ledger has been accumulating in one browser since
2026-07-04), but sign-out does not clear the section caches — the privacy notice's own
"sign-out residue" FIX item — so on a shared browser teacher A's leftover rows would merge
into B's server ledger. The owner stamp (`section_history_owner`) CLAIMS the cache before every
reconcile and wipes it first if it belongs to someone else; an ABSENT stamp counts as the
current teacher's (the pre-migration browser, which is exactly what the push-back is for).
Sign-out clears it too. **Whenever a sync gains a push-back, ask whose rows it is pushing.**
★ **UNTRACK STILL CANNOT REACH IT, STRUCTURALLY** — "untracking a chapter must not erase the
record that it was once taught", so the port has NO per-entry delete and a test asserts the
absence. `delete_section` exists for the stronger act (the SECTION leaving the profile) and is
wired at the two sites that already delete its POINTER; the trial purge needed a SECOND sweep
over the ledger's own keys, since a taught-then-untracked section has a trail but no pointer.
★ **Cutover carries then clears**: `_auto_roll_year` carries the ledger with the bindings (until
she starts fresh she is still teaching the old cohort), `start_fresh` clears both, and the
browser needs `clearLocalHistoryCache()` because a UNION can never delete a local row itself.
★ **Export folds history into the SAME teaching rows**, current binding winning — ⚠️ a test
caught the dedupe keyed on chapter NUMBER, which derives from the filename and can be `None`
for a legacy row while the ledger carries the stamped number, so one class appeared twice
("set aside" beside "at Learning Unit 3"). **The file is the identity; the number is a display
value.** `_YEAR_KINDS` + receipt label ("chapters taught") moved with it.
`tests/test_section_history.py` 16 green, two sabotages verified biting; backend suite green;
babel-parse clean; routes/export/receipt/both cutover halves exercised end to end via
TestClient. **Live + 360px pass owed** — sign in on two devices, complete a chapter on one,
confirm the glyph and popup on the other.

**Administrative architecture Step 3 (2026-08-22, same session) — chapter notes
server-backed.** `PlanNoteRepository` + file adapter (`plan_notes/{tenant}/{user}/{year}/
notes.json`) + GET/POST `/plan-notes`. **ONE note per chapter per academic year** (founder:
notes split only across years; key = `{subject}/{grade}/{chapter_number}`, never a plan
filename — spec §7's "notes split per plan" item resolved). §2.4 enforced: empty-text save
IS delete; no history; stale write (older `updated_at`) → 409 carrying the newer copy, which
the client adopts. Web: ChapterOrg treats localStorage as an optimistic cache, reconciles
from the server on mount, migrates a legacy browser-only note up once, and the notes modal
discloses "Saved to your account". Web half STATIC-verified only — owes a live pass.
CLOUD_DATA_MODEL §2.8's invariant violation is closed. Full entry: MEMORY.md 2026-08-22.

**Administrative architecture Step 4 (2026-08-22, same session) — export + erase.**
`DataRightsService` + `ErasureReceipt` in ports.py; `data_rights_service_file.py` walks
every Bucket-B store; `export_data_rights_docx.py` renders the export as ONE editable Word
document (founder: Word only, everything Bucket-B, never the shared library). Routes:
`GET /data-rights/export` (docx download) · `POST /data-rights/erase` (typed confirmation
`{"confirm": "erase"}`; account record last; empty ancestor folders removed; idempotent;
receipt's `kept` wording pinned by test_data_rights and must match the privacy policy).
No entitlement gate on either route, ever (§2.5). Erased IDs are not reserved — re-signin
JIT-creates a fresh account. test_data_rights.py includes the export-as-tenant-isolation
test. No web UI yet (Step 6). Full entry: MEMORY.md 2026-08-22.

**Administrative architecture Step 5 (2026-08-24) — the entitlement seam, built to the
SETTLED SUBSCRIPTION MODEL: `docs/subscription_model_discussion.md` §0 (read it before
any pricing/entitlement/monetization work — it supersedes its own earlier hypotheses).**
Billing unit = teacher × SUBJECT-STAGE, unlimited serves in scope; ~~Individual = mobile
app only · Enterprise = website (the channel split is the price fence)~~ — **SUPERSEDED
(founder, 2026-09-13): individual teachers get the WEB TOO, fenced by a DEVICE CAP of three
(one mobile + up to two computers) instead of by channel.** Reasoning: the mobile is "a
travelling promise but not the contained space of operation" — teachers prepare on personal
and school PCs, and denying that costs far more adoption than channel-sharing ever leaks.
The fence now rests on what the product already does: the account IS a mobile number and
every web sign-in (typed as mobile OR email — email is only a lookup) sends the OTP to that
phone, so the subscriber's handset must be present at every laptop login; the subscription
is scoped per subject-stage, so "one subscription supplies the school" is impossible in any
channel; and one account holds one profile/one pointer per section, so sharing collides and
degrades to exports only. Accepted residual leak: a school buying N subject-stage
subscriptions and running them on one phone + two PCs. TO BUILD (after Track D step 6): the
device registry — sign-in registers the Supabase session against the account, cap 3, the
API refuses a fourth with a clear sentence, Settings › "Your devices" lists and signs one
out. OPEN KNOB: a web idle timeout — today the web session persists like the phone's; a
timeout is friction for honest teachers too, so default = none for the beta, revisit on
evidence. The Expo app stays the primary individual product; trial = all 11 subject-stages, ANY 3 chapters, unlimited
re-serves per chapter, no time limit; trial-exhausted keeps plans + tracker,
lapsed keeps plans but not the tracker (**§2.5 amended in place** — no longer
export-and-delete-only); upsell only at the profile-expansion moment, pull never push;
paid choosers show only her scope. Built: `Entitlement` (scopes = "{subject}/{stage}",
"*" = all; `trial_chapters` counter; `source` = the channel fence) + tenant-keyed
`EntitlementRepository` + expanded `BillingProvider` with `ManualBillingProvider` (the
founder IS the gateway) + CLI `aruvi-scripts/entitlement.py` grant|revoke|status|
trial-reset. THE one gate sits in genon_make_plan only (402s speak in CHAPTERS, never
"generations"; counting happens after success so 400/404 never burn a chapter; data
rights never gated). **Enforcement default OFF** (`ARUVI_ENTITLEMENT_ENFORCED`;
`ARUVI_TRIAL_CHAPTERS` default 3). `GET /entitlement` feeds the future Step-6 counter.
test_entitlement.py green. Remaining: Steps 2, 6 — Step 6 next (trial counter,
exhausted state, upsell screen, subscription status, export/erase buttons), then the
persona pass with enforcement ON. Full entry: MEMORY.md 2026-08-24.

**ASK ARUVI IS SIGNED-IN CONTENT NOW, CACHED ON THE DEVICE — AND THE QUESTION BANK
FINALLY HAS A HOME (2026-08-30).** The bank was `import kb from "./qa_knowledge_base.json"`
inside `AskAruvi.jsx`, so all 120 answers compiled into the **main page chunk — a public url,
served before sign-in, machine-readable**. It states how period allocation is weighted (the
four effort-index signals, the bounded-tier normalisation, SS's 3/2/1) and how each subject's
assessment is built; that is the cheapest half of the IP to copy and the most expensive to
derive. ★ **The two requirements pull opposite ways and both are met:** `GET /ask-aruvi`
(api/main.py) sits behind `X-Aruvi-User` — a free trial still reaches it, so this is a fence
and not a wall; what ends is it being PUBLIC — and `web/app/ask-aruvi/bank.js` fetches it ONCE
and keeps it in localStorage, so the help screen still answers when the network does not,
which on a school Android is exactly when it is needed. **The ETag is what makes freshness
free**: page.jsx re-checks on every app load with `If-None-Match` and normally gets a 304 with
no body, so the ~90KB is paid only in the month the answers change. Primed at SIGN-IN (the one
moment she is certainly online), cleared at sign-out (licensed content in a shared browser).
★ **A side effect worth having:** the bank had ALSO been living in two places — official +
bundled copy — with `sync_ask_aruvi.py` copying and a test guarding drift. Serving from
DATA_DIR leaves exactly ONE copy, so drift is now impossible by construction; the helper
shrank to re-indexing and the test swapped its byte-identity check for
`test_bank_is_not_bundled`, **a security guard, not tidiness** — both sabotage-verified.
⚠️ **Transport is only half of it.** Every parameter is still readable by anyone who signs
up. The redaction pass over the Tier-1/Tier-2 answers (the effort-index signals, the
per-weight item tables) is OWED and is the fix that actually works. Bucket-A row added to
CLOUD_DATA_MODEL §1 — the bank had never been classified, which is why the 2026-08-23
restructure walked straight past it. STATIC + unit-verified (7 tests green, babel-parse clean
on AskAruvi.jsx/bank.js/page.jsx); **live pass owed** — sign in, confirm the bank downloads,
kill the network, confirm Ask Aruvi still answers.

**The user agreement — six ticks before the subject cart, kept as evidence (2026-08-27).**
`data/cloud/content/legal/consent_and_disclaimer_v0.1.md` is the ONE copy (Bucket A-serve —
the runtime serves it to every teacher before she pays, so it travels inside the migration
unit; `docs/legal/README.md` is only a pointer). `api/legal.py` parses it into {intro, five
acknowledgements, agreement body, final tick} — nothing is retyped in JSX, and **the version
is the FILENAME**: publish v0.2 by adding a file, never by editing text somebody has already
ticked. A document that loses a tick raises `ConsentDocumentError` → 503 rather than serving
a four-box consent screen. Surfaces: the subscribe wizard's **Agreement step** (Verify ·
About you · **Agreement** · Subjects · Pay — deliberately BEFORE the cart, because the five
points say what Aruvi IS and she should know them before choosing what to buy) and
**Settings › Legal** (its own card; About Aruvi keeps only "Version info"). Both render
`Agreement.jsx` (`mode="sign"|"read"`) over `web/app/lib/legalmd.js` — a hand-rolled markdown
renderer that builds React NODES, never `dangerouslySetInnerHTML`, on the one screen where a
teacher signs something. **Re-consent is per document VERSION** (§J's promise): a subscriber
adding a subject-stage walks past; after a new version she takes all six again. The rule
lives in ONE function, `_consent_outstanding` — the screen and the gate cannot disagree.
`POST /onboarding/checkout` 409s without a current signature, in words she can act on (the
client routes on them). Routes: `GET /legal/consent` (doc + her status; `?version=` serves an
older published version) · `GET /legal/consent/status` (the yes/no, without shipping the
document) · `POST /legal/consent`, which refuses a PARTIAL acceptance rather than storing
one. ★ **The record is RETAINED THROUGH ERASURE** (founder): `ConsentRepository` + adapter
store it at `consents/_ledger/{tenant}.json`, outside every `{kind}/{tenant}/{user}` folder
the erase traversal walks (the `invoices/_series/` precedent). **Three places state that and
must move together:** §G of the agreement, `_KEPT` in `data_rights_service_file.py`, and the
ledger's placement. It holds ids, version, language and per-tick timestamps — no teaching
content. The account's `consent` field carries a mirror that IS erased with her, and the
data-rights export renders it. ★ **The front door has no localStorage identity** (Login calls
`setUser` only after checkout), so `Agreement` takes a `userId` prop and uses an explicit
`X-Aruvi-User` header on that path — without it a signature files against the fallback
identity and the gate then refuses a teacher who just ticked all six boxes. Tests:
`tests/test_consent.py`. Web half STATIC-verified only — live + mobile pass owed.

**THE PRIVACY NOTICE — GIVEN, NOT SIGNED (2026-09-04).** `data/cloud/content/legal/
privacy_policy_v0.1.md` (draft for counsel; decisions settled, see `docs/legal/
privacy_policy_considerations.md` §7; `[value]` blanks + `[AT LAUNCH]` code items remain).
DPDP §5 makes a notice something a fiduciary GIVES at or before collection; consent (§6) is
asked only where consent is the basis (the agreement's marketing tick). So: **no tick, no
ledger** — `api/legal.py`'s second document family, `GET /legal/privacy` **OPEN** (no
`X-Aruvi-User`; the OTP screen links it before a number is typed), and the ONE record is
`Account.privacy_notice` {version, seen_at, context} — stamped server-side at
`/onboarding/verified`, `POST /legal/consent` and on dismissing the update bar; in the
export; erased with her. Surfaces: `PrivacyNotice.jsx` — pre-sign-in as a LOCKED FRAME
(`.lgl-frame`: bar + "Privacy Notice" pinned, Back at the TOP, document scrolls); a SHEET
over the wizard from the final tick's own words; Settings › Legal as two pills (User
agreement · Privacy notice) + the document heading as ONE band FROZEN flush under the bar
(`.lgl-stick`, outside the card — `.set-card` is overflow:hidden and would pin it to the
card). ⚠️ In the shell `.bodycontent` is the scroller (app-shell rule, 2026-08-09), so every
inner sticky must be in the `html.app-shell … { top: 0 }` list — `.lgl-stick` floated by
exactly the bar's height (115px) until it was, found live.
`legalmd.js` renders pipe tables (`data-th`; ≤600px stacks rows into cards). The shell's
`.pn-note` bar appears ONLY on a real version bump — an account with no recorded version is
silent (founder: internal demo). **`_KEPT` is SIX rows** and `tests/test_privacy_notice.py`
pins it to notice §7 both ways; four places must agree: notice §7 · agreement §G · `_KEPT` ·
the ledger's placement. Owed: agreement v0.5 (§F/§G → the notice), self-hosted fonts,
dormancy job, ids out of URLs, sign-out clearing; live + 360px pass on every new screen.

**Settings › Support — email is the ONLY channel, and the acknowledgement is the
feature (2026-08-27).** No phone, no WhatsApp, no chat, no LLM answering tickets; Ask
Aruvi stays the instant answer for "how does this work?" and sits ABOVE the form so the
slowest channel in the product does not become its FAQ. Email's one failure mode is
SILENCE, so everything is aimed there: she picks one of **four categories** (problem ·
plan · billing · suggestion — a choice, never a subject line to compose), writes, and
gets back a **REFERENCE** on screen and by mail within seconds. The series opens at a
three-digit offset (`ARV-S-742`, `config.SUPPORT_START`) for the invoice series' exact
reason — "ARV-S-1" tells her she is the first person who ever needed help. **The reply
window is stated and comes from the server** (`GET /support` → `reply_days`, billing its
own firmer `billing_reply_days`), because the screen's promise and the mail's promise
must be one value: a teacher told "2 working days" on screen and "3" by email has been
told nothing. **Not a `mailto:`** — that assumes a configured mail client (dead on a
budget Android with only Gmail web), leaves no record and cannot attach what the app
knows; the address is still spelled out for the teacher with no email on her account
(every TRIAL teacher — the trial asks for a mobile and nothing else). Built:
`SupportRequest` + `SupportRepository` in ports.py + file adapter
(`support/{tenant}/{user}/ARV-S-742.json`; counter at `support/_series/`, **outside**
every folder the erase traversal walks — invoice-series precedent, or one teacher's
erasure hands the next a used reference) · `mail_templates.support_acknowledgement`
(+ `_html_shell`, a LETTER layout distinct from the subscription's receipt-shaped
`_html_body`) · `POST /support` (stores FIRST, mails second — `notifier.send` never
raises, so the worst case is a saved case with `acknowledged: false`, never lost words)
and `GET /support` (her history + the screen's categories and windows) · `SupportForm`
in Settings.jsx + `.sup-*` CSS. **Never gated** — not on subscription, not on trial,
not on entitlement (a teacher whose subscription is the broken thing must be able to
say so; §2.5's reasoning). Her messages joined the export + erase traversal the day the
store was born, `category_label` stored not re-derived (the consent record's principle:
a record says what she SAW). `tests/test_support.py` green (13 tests). Web half
STATIC-verified only (babel-parse clean, CSS braces 2236/2236, csstree clean bar the
known `env()` false positives) — live + mobile pass owed. **Second pass the same day
(founder, live):** the "Support" title alone FREEZES (`.set-title-stick` + `.sup-title`'s
-26px pull out of `main`'s 40px top padding — the gap read as the page starting late);
the Ask Aruvi row carries the tab row's own stream-and-dot MARK, not a generic icon;
the five categories became a **`<select>`** (chips wrapped to three rows at 360px and
pushed the message box under the fold — the one thing that must be visible) with
**"Something else"** added last; the textarea lost its placeholder (prompt text tells a
teacher what shape her trouble should be, and she trims to fit). ★ **And the live bug
worth remembering:** account 1000000001 was told "no email on your account" when it has
one. `getJSON` THROWS on any non-2xx, and the first build's `.catch` fell back to `{}`,
which every downstream check then read as a FACT about her record — so an old server
without the route (or any transient failure) made the screen invent an answer about her
account. `metaErr` now keeps "we could not ask" apart from "you have none", and the
claim is made only when the server actually said so. **A screen may say it does not
know; it may never invent an answer about her record.** Next natural step: a
"this plan looks wrong" report FROM the lesson, which can carry the plan id and unit
that Settings cannot.

**ONE window asks "is my set-up right?" and "what do I want to change?" — `ProfilePortal.jsx`
(2026-08-27).** The standing "+" grow portal and the once-per-tour "Would you like to check your
set-up?" prompt were the same question at two moments, and the check prompt was the weaker of the
two: it NAMED the assumptions (a section, periods a week, a year's total) and then handed her a
generic "open my teaching profile" row to go find them. They are now ONE component; only the
title and the sub-line differ. **FIVE rows, not three** — `subject` · `class`
· `section` · **`ppw`** · **`budget`**, because first run asks three things and ASSUMES the other
three, and a window offering only the structural levels cannot answer the question it poses. The
two new intents route through TeachingProfile's EXISTING `editNums` screens (`PER_CLASS_GOALS` /
`GOAL_WORD`; `portalOpen(goal, si, gi)` takes the goal as an ARGUMENT, since the one-subject case
routes in the same tick the state is set — FirstRun's `finishActivation` rule). Rows are NAMES
ONLY (founder, same day: five sub-lines turned a glanceable list into a page and pushed the last
row below the fold at 360px). A footer — "Want to see your full teaching profile?" — opens the
profile **under Settings**, where she can read it whole and amend directly. **★ SECOND MOMENT:** a
subscriber who ADDS a subject or a class meets the same three assumptions again, so she gets the
same question — the first time she OPENS that subject·class in My Lessons, never at the moment
she adds it (§0's benefit-first rule: no configuration stacked on configuration). Mechanism: ONE
effect in page.jsx diffs `readiness`'s subject·class keys (every add path is a key that appears
where none was — no per-door wiring), queues them per user in localStorage, and MyLessonPlans'
`onScope` spends the key. The first resolved profile only seeds the baseline, and the ref is
keyed by user so a shared browser never diffs one teacher's profile against another's.
Consequently the window renders at SHELL level (page.jsx), not inside MyPlans — its second moment
lands on My Lessons. ★ **AND THE CSS BUG WORTH REMEMBERING (same day, founder, live):** the rows
rendered with the name on one line and the "›" on the next, doubling the window's height and
pushing the ✕ off the top of a phone. `.ap-row` is `flex-direction: column` (chapter rows need two
lines) and the override `.ap-row-line` TIED it on specificity (0,1,0) — but sat 30 lines EARLIER
in globals.css, so the base rule won on source order and the override was a silent no-op. Fixed as
`.ap-row.ap-row-line` (0,2,0) AND moved below `.ap-row`. **A same-specificity override placed
before its base rule does nothing — always check source order in this file.** Two hardening
changes rode along: the closing "Not now" button went entirely — first shrunk from a
first-run-sized `.fr-cta` slab to a quiet `.ap-decline` line, then struck in BOTH moods (founder),
because a whole row restating what the ✕ already offers is the last thing a height-constrained
window needs — and `.ap-modal`'s cap became `min(82vh, 100%)` — on iOS `vh` counts the area
behind the browser chrome, so a tall modal overruns at the TOP and takes the absolutely-positioned
✕ with it; the `100%` term is the overlay's own content box, which is the real ceiling. **And a portal visit exits by the door it came in, which is
the WINDOW ITSELF** (founder, same day: "back should lead to the window and not to class"). Every
row used to be a ONE-WAY door — amend the section, land on your cards, go find the window again
for the periods. `portalOriginRef` now carries `{ home, win }` and `goPortalHome` restores the
tab and then the window over it, on save AND cancel alike (TeachingProfile funnels both through
one `setScreen("view")`, and the teacher who just amended one item is the likeliest to want the
next); the back link reads a plain "← Back". **This is why page.jsx owns the "+" window too** —
it was `growOpen` inside MyPlans, and a window that says "amend any of these items" must still be
there for the second item. Copy: the added-a-subject line is three short sentences ("You've added
X. **Middle stage**. Amend any of these items below.") — it named the CLASS first, which was the
wrong unit: what she added is a subject-STAGE (the billing unit, and the scope the rows are
filtered to), and a class is one of three inside it. The last row reads **Annual period budget**.
★ The stage mapping now lives ONCE, as `stageOfGrade` in `lib/format.js` — the web had FOUR
byte-identical copies (FirstRun · SubscribeFlow · TeachingProfile, and nearly a fifth here),
against §3's own "nobody re-implements the mapping"; the components alias it. ★ **And the added-a-subject window is SCOPED**
(founder, same day): it is about one subject·class, so its rows must not open on "In which
subject?" listing everything she teaches. `profilePortalScope` `{subject, grade}` travels with
the intent and TeachingProfile routes straight past BOTH pick screens — resolved against `canon`
rather than trusted, so a scope naming something since removed falls back to the ordinary
screens. The scope also carries the STAGE: a Science·Middle teacher who buys
Science·Secondary is asked about classes 9 and 10, never about the 6/7/8 she settled long ago
(`portalStage` filters the classes screen; `portalGradeIdxs` the portal class picker). ⚠️ **The
scope narrows the subject, never the class** — it used to route straight into the class she was
SEEDED with, so a teacher who added SS·Middle and ticked 6, 7 and 8 tapped Section and landed in
6's letters, never asked which of the three she meant. The scope's grade is a STAGE marker only;
which class is a question, and the pick screen asks it — skipped only when the stage leaves one.
`portalGradeIdxs` is ONE definition used by both the skip test and the screen, or they drift. Safe because
`startManageClasses` pre-ticks EVERY enrolled grade into `picked` and removals are read off
`picked`, not off the visible list — a hidden class can never be read as an unticking.
★ **The `subject` row is GONE FROM BOTH MOODS** (founder, same day, in two steps): from the check
window because the subject is the one thing Aruvi never guessed (she BOUGHT it — billing unit =
teacher × subject-stage — or just added it, which is what raised the window), and then from the
"+" window too because **she cannot add a subject there anyway** (a new subject is a purchase),
which left REMOVAL as the row's only working half — the most destructive act in the profile, one
tap from a window opened to add a section. The subject dustbin stays in Settings › profile behind
the master EDIT toggle. Four rows now: class · section · ppw · budget.
★ **AND EACH ROW CHANGES ONLY ITSELF — no row runs downstream** (founder, same day). Ticking
Class 7 in the window used to run 7 through sections · durations · periods · budget, so one row
asked four questions and her classes split into one that had been interrogated and one that had
not ("it asks only 7's sections and leaves 6 behind"). `applyManageClasses` now adds a class the
way FIRST RUN adds one — **Section A**, `DEFAULT_DURATION`, `DEFAULT_PPW`, auto budget — and
stops; everything else is set from the row that names it, which is why the window comes back after
every visit. Manage mode only (both windows AND the accordion's class pencil, the same
tick-to-add/untick-to-remove screen); the green "+ add a class" keeps `continueWithGrades` and its
conversational run, because there she is building something new and has asked to be asked.
**The BUTTON says which it is** (founder, same day): manage-classes now reads **Save**, because it
ends. The only "Continue" left inside a portal visit is periods a week, which continues into the
period lengths; the per-class run behind "+ add a class" keeps its Continues because each step
really does lead to the next. STATIC-verified only (babel-parse clean on page.jsx
/ ProfilePortal.jsx / MyPlans.jsx / MyLessonPlans.jsx / TeachingProfile.jsx, CSS braces
2273/2273) — live + mobile pass owed.

**ONE BUDGET METHOD, A DERIVED PERIODS/WEEK, AND A PROFILE THAT IS A VIEW (2026-08-27).** Closes
`administrative_architecture.md §7`'s periods/week item, whose own premise was wrong twice: ppw
is displayed in SIX places (not "nothing reads it"), and `setMethod` **replaced** the annual total
with a fresh default rather than converting it — so a first-run teacher on a calibrated 245 who
merely tapped "weeks" silently got 180, **reproducing the 19→14 defect of 2026-08-21 through a
second door**. Measured: a flat `DEFAULT_PPW = 6` contradicted the master plan's own annual figure
for **18 of 25 subject·grades**, and the profile printed both on one line — "≈ 245 periods for the
year, at 6 a week" = 40.8 weeks, which is not a school year.
★ **THE FOUR BUDGET METHODS ARE NOW ONE — the annual period count** (founder). They existed
because Aruvi could not say what a year should be; the calibrated master plan ended that, so she
DISAGREES with a number ("I say 245, you say 215") rather than constructing one from weeks, days
or a count. They also manufactured inconsistency — founder's own example: at 7 a week, "200
periods" implies 28.6 weeks, "170 working days" 24, "220" 31, three inputs for one year with
nothing reconciling them. Collapsing also kills a CIRCULAR definition: with weeks/days/auto gone
from the WRITER, budget never derives from ppw, so ppw can be derived from the standard without
the two defining each other. ⚠️ **The READER still understands all four shapes and must keep
doing so** — teachers have saved weeks/days/auto records and retiring the reader would move their
years; only the writer collapsed. `normalizeBudget` is the ONE place a stored record becomes the
editable count, and it reads `{method:"auto", value:0}` as **not set** (that is what
`finalizeSubject` writes for an unanswered class, and reading it as a real figure is why the
calibrated year was never consulted on that path — every such class landed on 180 while Aruvi's
own answer was 245).
★ **A SENSE-CHECK REPLACES THE METHODS**: "Based on **8 periods a week** ✎ for this subject, **245
periods** is about **31 teaching weeks**." It gives her the weeks READING those methods were
clumsily providing, without a second input that can contradict the first — and it is **advisory
only**: Aruvi adjusts neither number, or the silent overwrite is back. The pencil goes to ppw for
when that is the side that looks wrong.
★ **ppw IS DERIVED FROM `annual_budget_periods`, THE API FIELD — never from the stored budget
record**, which is itself `ppw × 30` when there is no master-plan row: `round(ppw×30/30) = ppw`, a
fixed point that justifies whatever it already held. `ppwFromAnnual` / `weeksFromAnnual` /
`ESTIMATE_WEEKS` live ONCE in `lib/format.js` — 30 is not a new assumption, it was already
hardcoded in three places.
★ **THERE ARE THREE SEEDING PATHS AND ALL THREE HAD TO CHANGE** (the third found live, founder,
account 1000000001): FirstRun · `TeachingProfile.applyManageClasses` (fetches per added class,
since the calibrated total is per subject·CLASS) · and **`api/main._default_grade_record`, the
SERVER path a subscriber takes**. The first fix missed the third, so buying SS·secondary still
provisioned "245 periods for the year, at 6 a week" — 41 teaching weeks, which the new
sense-check then reported to her in words. `api/main.ppw_from_annual` mirrors the JS helper
across the language boundary (no seam between them — move one, move the other) and falls back to
6 only where the master plan has no row. **When a default is seeded in more than one place,
count the places before declaring it fixed.**
★ `aruvi-scripts/repair_ppw.py` re-derives the records already written, ALWAYS from the
calibrated standard and never from the stored budget (which is itself ppw × 30 for an unset
record and would hand back the value being replaced). Conservative by default: it rewrites ppw
only where the stored value is exactly the flat 6, only where a standard exists, and it **never
touches a budget** — a wrong-looking total is reported and left alone, because the annual figure
is the number she is invited to disagree with and silently rewriting it is the very defect this
work removed. `--all` drops the flat-6 guard (founder: "amend all the periods per week in
existing records — these are test records only"); ⚠️ against live data it overwrites deliberate
answers. Multi-duration classes are always skipped — their `ppw_by_duration` is a distribution
the script has no basis to redistribute. **Ran `--all` 2026-08-27: 26 values across 13 profiles;
the estate now has 73 grade records agreeing with the standard and 0 disagreeing.** The write
falls back from atomic-rename to in-place because some mounts refuse the `.tmp` sidecar, and a
repair that dies half way through the estate is worse than one that writes in place.
★ **THE TEACHING PROFILE IS A VIEW.** Every pencil went — class, section, ppw, budget all live in
the "+" portal, and two doors onto one record is how they drift. The ONE exception is **removing a
subject**, which the portal deliberately cannot do (adding one is a purchase, so removal would be
its only working half, one tap from a window opened to add a section). It stays behind the master
toggle, now labelled for that single act (a control promising editing and delivering only deletion
is a trap), with a **DOUBLE confirmation**: step 1 names what goes AND what does not — lesson plans
are shared library content and survive, and a teacher who thinks she is deleting her plans will
not read the rest — step 2 asks her to mean it. Deleted with the methods: `METHODS`,
`METHOD_ORDER`, `defaultValueFor`, `setMethod`, `estimateSubLine`, FirstRun's dead copies, and the
`.tp-methods`/`.tp-method`/`.tp-total`/`.fr-bud-row`/`.fr-bud-detail` CSS. Unit-verified on 10
budget shapes (legacy weeks/days/auto records read back UNMOVED; unset → the calibrated year; a
calibrated total cannot be silently recomputed at any ppw); babel-parse clean on all touched JSX,
CSS braces 2276/2276, backend suite unchanged at 37. Live + 360px pass owed.

**The check window SHOWS its values — a set-up you can actually check (2026-08-27).** Closes
`administrative_architecture.md §5 Step 6`'s second rule ("disclose the assumptions"). The window
is titled "Would you like to check your set-up?" and offered four bare nouns — so checking meant
opening every row in turn, four round trips to answer one glance-sized question. Each row now
carries its CURRENT value: `Class 9 · Section 9A · Periods a week 6 · Annual period budget 245
periods`. ★ **A value is not the sub-line struck earlier the same day** — that decision (rows are
NAMES ONLY, because five sub-lines turned a glanceable list into a page and pushed the last row
below the 360px fold) stands untouched, because the value is short and sits RIGHT-ALIGNED on the
row's existing single line. `.ap-row-label` gained `flex: 1` so the value and the chevron pack
right — with three children, the row's own `justify-content: space-between` would otherwise
strand the value mid-line, reading as a second label; `.ap-row-val` is `flex: none` + `nowrap` so
it can never wrap into the two-line row the `.ap-row-line` bug already cost a fix. ★ **CHECK MOOD
ONLY** (founder: "values only for first time including when new subject stage added, not during
'what would you like to change' rounds") — the "+" window is unscoped by nature, so "6, 7, 8"
against Class would be noise on a row she is using to navigate. ★ **The budget reads through
`annualBudgetPeriods`** — the same function Year Plan displays from — not off `subject.budget[gi]`
directly, which holds a method (periods|weeks|days) and is ABSENT while the budget is still the
auto estimate: a direct read would show nothing for most teachers and a raw week-count for some,
and two screens quoting different annual totals for one class is worse than silence. Where scoped
classes disagree the row shows nothing; a missing value renders NOTHING — never a dash, a zero or
a guess (the Support `metaErr` rule: a screen may say it does not know, it may never invent an
answer about her record). Unit-verified on 5 profile shapes (tour end · added subject-stage
correctly scoped to IX/X leaving settled VI/VII alone · disagreeing budgets · no budget set →
the estimate · "+" mood → null). ★ Still open BY DECISION (founder: "ignore"): first run itself
names neither periods/week nor the budget — the tour-end window is the disclosure moment.
STATIC + unit-verified; live + 360px pass owed.

**The annual budget is edited WHERE ITS NUMBER IS — Year Plan's pencil (2026-08-27).** Closes
`docs/administrative_architecture.md §5 Step 6`'s own first rule, the last of that step's three
gaps to have gone untouched by the ProfilePortal work. The distinction that made it worth
building even though the "+"/check window ALREADY has a budget row: a portal row reaches the
same screen from a WINDOW — she changes the total blind, comes back, looks. Here she is looking
at the chapter split when she decides the total is wrong (Ch 4 given 19 periods, her year is
smaller than that), and the control is beside the figure she is judging. `YearPlan.onEditBudget`
→ `MyLessonPlans` (binds the pane's own `current.name` + `activeGrade` — the DISPLAY name and
Roman class the profile keys on, not the slugs YearPlan fetches with) → `page.jsx
onEditYearBudget` → `TeachingProfile` `editNums` budget step. ★ **It travels as an `exact`
portal scope** — a deliberate exception to the 2026-08-27 rule "the scope narrows the subject,
never the class". That rule protects the teacher who just bought a STAGE and may teach several
classes in it; Year Plan is the opposite case, already standing in one subject·class, so both
pick screens would re-ask what the pane has answered. Written as a narrower FILTER inside
`portalGradeIdxs` rather than a second routing branch, so the single-index case falls through
`portalPickClass`'s existing "straight in when only ONE class is in play" and the skip test
cannot drift from the screen; a named class since removed falls back to the stage filter.
`win: null` in `portalOriginRef` (she came from a page, not a window), and the return to the
PLAN pane rides the one-shot `lessonsPaneIntentRef` (★ amended 2026-08-29: **the pane is no
longer persisted** — founder: My Lessons defaults to "Your lessons" on EVERY ordinary revisit,
so a Year Plan left open yesterday cannot hide the repository today; `LS_PANE` is retired,
`onEditYearBudget` stamps the intent, the MyLessonPlans remount consumes it, `goClasses` clears
it) — ⚠️ **if that stamp ever goes, the pencil becomes the one-way door the portal rows were
just fixed for.**
★ **WHERE IT ENDED UP, after three placements (founder, live).** First beside the "a budget of
N periods" sentence — which labels the number in words, and was wrong: that sentence sits in the
"Your plan" note, which defaulted CLOSED, so the control was invisible on arrival ("cant see
pencil"). **A control is only as reachable as its number.** The note therefore moved BELOW the
totals row and now defaults OPEN (it can, there: below the table it pushes no chapter rows down,
and the chevron became a "hide this" rather than a "reveal this"). The pencil itself sits on the
**TOTAL PERIODS row**, in the LABEL cell — the `1fr` column, so `.yp-tot`'s two numeric columns
stay aligned with the chapter rows keyed to the same 3-column grid. Its CSS has to respect that
grid: `vertical-align` puts it on the label's baseline (the grid is `align-items: baseline`, so a
misaligned glyph drags the row's numbers with it) and a negative margin-block hands back the
padding that gives it a phone-sized tap target, so the button cannot grow the row. Pine against
the label's `--ink-soft` is the affordance. ONE pencil — the sentence below stays plain prose.
`.yp-tot` also gained a **hairline `border-bottom`**: the 2px rule opens the total, the hairline
closes it, and it is load-bearing now that prose follows the row — without it the figures and the
note read as one block and the numbers stop being the end of the table (a hairline, not a second
2px: two heavy rules fence the row off as a box instead of finishing a column of numbers).
Unit-verified (6 cases on the exact/stage/no-scope filter, incl. the unchanged added-a-subject
behaviour), babel-parse clean on all four touched JSX files, CSS braces 2275/2275 — live +
360px pass owed.

**The lesson-plan library is foldered by EDITION YEAR, and the year is a LABEL (2026-08-27).**
Spec: `docs/administrative_architecture.md §2.2` (rewritten the same day; its status header was
stale and now carries a per-step table). ★ **Two different years live in this system and
conflating them is the bug:** the TEACHER's academic year (Bucket B, `AcademicYear.year_id`,
the year she is teaching in) versus the LIBRARY's edition (Bucket A, which authored edition a
plan IS). She can teach one 2026-27 plan for years; My Lessons was showing HER year and
`YearStamp` was using it as a proxy for the edition because nothing recorded the edition.
Now: `saved_plans/{subject}/{grade}/{year}/…`, `config.LP_YEAR` is the edition being served and
`data.lp_library_dir` is the ONE place the year enters a path (flat-tree fallback kept for
un-migrated checkouts); `generate_canonical.py` stamps `academic_year` at authoring time;
`migrate_lp_year.py` backfilled the 990 pre-stamp files (990 stamped + moved, verified
byte-identical to a pre-move tarball bar the new field). **★ THE YEAR IS NEVER IN A FILENAME** —
derived plans stay keyed `(engine, constitution-run)` via `canonical_version`'s `ledger_ts`, and
that is the whole economic point: `carry_over_year.py` copies an unchanged chapter's canonical
AND its derived plans into the next edition, rewriting only `academic_year` (+ `carried_from`),
so the copied cache still HITS. Copy the canonical alone and every variant regenerates on first
request — in June, at peak, which is the bill §2.2 exists to prevent. The doc's "mark each
canonical carried or new" step was DROPPED as already-implicit in `ledger_ts`. **Display rule
(founder): every canonical carries the stamp, but she only SEES it for a PRIOR edition** — the
comparison is server-side (`get_plans` → `lp_year_display`, null otherwise) so screen and rule
cannot drift. **Two silent pre-existing bugs fixed en route:** `genon/purge_derived.py` and
`generate_canonical.py`'s install path both still named `data/content/saved_plans`, dead since
the 2026-08-23 restructure — so the ARV-D-034 invalidation invariant had been purging NOTHING
and authored canonicals were landing where the API never looks; both now read `config.DATA_DIR`,
and purge sweeps every edition (a carried canonical shares its `ledger_ts`, so its copy shares
the cache key). `generate_canonical` also gained redirectable `LIB_ROOT`/`BACKUP_ROOT` — moving
its path onto config silently removed the redirection `test_genon_plan_key` relied on, and the
test reached for the live english/ix ch 7. Tests: `tests/test_lp_year.py` (17, incl. a
sabotage-verified cache-key guard). ★ **`tests/corpus.py` is now the ONE way a test reaches the
library** — ten files carried their own flat globs and matched ZERO plans after foldering;
making them run surfaced three pre-existing content defects (4 empty-stem items in 13,115, 8
re-ordered plans, 1 unitize corruption) that are REAL and unfixed. Suite 37 green (was 20).
Static + unit-verified; live + mobile pass owed on the `YearStamp` change.

**THE PROFILE PENCIL IS A PENCIL AGAIN — ADDING A SUBJECT IS A PROFILE ACT WHEN SHE ALREADY
PAID FOR IT (founder, 2026-08-30).** Reported live on **account 1000000002**: she removed every
subject but English and then had no way to add one back, with an `individual_annual` entitlement
covering all 11 subject-stages sitting unused. **The bug was one condition** — `+ add a subject`
rendered only on an EMPTY profile (`canon.length === 0`), so one surviving subject closed the
door; and the "+" portal deliberately has no Subject row (2026-08-27: "a new subject is a
purchase, so removal would be its only working half"). That reasoning holds for a teacher who
must BUY the subject and is simply wrong for one who already holds it. Now: the master toggle is
a **Pencil again** (it became a `Bin` on 2026-08-27 because removal really was all it did — the
"trap" objection dissolves once editing goes both ways), and edit mode reveals the per-subject
dustbins **and** an add-a-subject row beneath them. ★ **That row is a `.tp-sub`, not a button**
(founder, same day): the green pill said "here is a control", where an empty subject row says
"here is where the next subject goes" — same card, same padding, same display-serif name as the
subjects above it, so the list reads as a list with one slot still open. Only a DASHED edge (the
`.sc-proposed` idiom — structure, never colour) and pine ink mark it as not-yet-a-subject; it
carries no periods/week and no caret because it has neither. It renders on an empty profile too,
where it is the only way in, so there is ONE add affordance rather than two. The green pills
(`.tp-add*`) went with their last caller. The chooser needed no new billing logic — its
`paidScopes` filter has scoped the wheel since 2026-08-24 — only an honest EMPTY state: unscoped
it still reads "every subject Aruvi offers is already in your profile", but **scoped** that
sentence is a false claim about the catalogue, so it now says her subscription covers what she
already teaches and offers `onSubscribe`, the SAME `SubscribeFlow` the front door and Settings
open (passed from page.jsx; the screen learns nothing about billing beyond asking for it). The
`scoped` upsell line is gated to `options.length > 0` so it cannot restate the empty block.
⚠️ Still open, found in the same data: two `the_world_around_us/iii` plans sit in her
`prepared.json` for a subject not in her profile — detached, archivable, and unreachable,
because My Lessons' subject wheel only offers what she teaches. STATIC-verified; live pass owed.

**A WEEKLY TOTAL IS COUNTED PER SECTION, AND A SECTION MAY CARRY HER OWN NAME (2026-08-30).**
Two founder asks on the teaching profile, one data shape between them.
★ **The totals were counting classes.** `periods_per_week` is a property of the CLASS — it is what
she was ASKED for ("How many periods a week does Class 9 get for Science?") — but she does not
teach Class 9; she teaches 9A, 9B and 9C, and each of them gets those 8. The headline stat and the
subject header summed the class figure, so a teacher of three sections was told her week is 8
periods long when she stands in front of 24. Both aggregates now multiply by the enrolled section
count (`gradePpw`); the per-class card still states the per-SECTION week (that is the figure she
entered and the one the budget derives from) and its label says **"Periods / week per section"**,
or the subject header would not add up from the rows beneath it. `.length` is safe as the
multiplier because removing a class's last section cascades the class away. ⚠️ The annual budget
has the same per-class-not-per-section reading and is UNTOUCHED — a 245-period year is per section
too, and nothing yet shows her the subject's true annual load.
★ **Sections can be renamed, and the LETTER stays the key.** The pick screens stopped repeating
"Section" on all 26 options (the word moved to `leadingHeader`, once), and ticking a row now opens
a box in a **"customize"** trailing column — PickWheel's existing two-column mechanism, the same
one the duration question uses for its periods/week split, so sections and durations are ONE
format. Up to **8 characters** (it has to sit in a card corner and in the 96px column on a 360px
phone). Stored as an optional `name` on the section record beside `tag`/`sec`; blank is ABSENT,
never `""`, so "has a name" is one truthiness test. **Nothing keys off it** — every bookmark,
chapter binding and localStorage row is still built from `tag`, which is exactly why a rename can
never orphan the work attached to a section, and why the server's `_diff_profiles` (which reads
tags) does not see a rename as a removal. Display rule, and the two directions are deliberate:
**My Classes shows the class number with her name in fine print BELOW it** (she scans that list
for "Rose"; "6A · Rose" would be two labels for one card), while the **profile chip keeps the tag
FIRST** and appends the name (that screen is where she audits her set-up). `readinessFingerprint`
gained the name the same day — a rename changes nothing else about the record, so without it the
read-after-write check would be silent about the one thing that edit changed. Not autofocused on
tick: PickWheel re-rests the wheel on every toggle, and pulling focus into a field inside that
animating scroller throws the phone keyboard over the list she is still picking from.
STATIC + unit-verified (15 helper cases, 5 fingerprint cases; babel-parse clean on
TeachingProfile/MyPlans/verify/wheels, CSS braces 2281/2281) — live + 360px pass owed.

**THE YEAR PLAN TABLE EXPORTS TO WORD — and the file says what the SCREEN said (2026-08-30).**
`YearPlan.jsx`'s own header calls the pane "a LIVING mobile view, never a PDF", and that stands:
the struck thing was the ALLOCATION REPORT, a document she was asked to read INSTEAD of the
screen. This is the opposite direction — she reads the year on the pane and then needs the same
three columns somewhere the screen cannot go (a staff meeting, an HOD's file, a printout).
**Word only, by decision:** this is the one artifact she hands to someone else, and the thing she
most often wants first is to amend a row — a PDF freezes exactly what needs to be loose.
★ **THE CLIENT POSTS ITS OWN MODEL; THE SERVER ONLY RENDERS IT.** `sug` is computed in
YearPlan.jsx's `useMemo` (her budget distributed by chapter weight, largest-remainder) and `plan`
comes from her prepared plans. A server-side rebuild would be a SECOND implementation of that
arithmetic, and the day the two drift she holds a Word document contradicting the screen she
exported it from — **the 2026-08-21 defect (Year Plan said 14 where the chapter step said 19)
reached through a new door.** So the seam is closed by not opening it: `YearPlanExportRequest`
carries rows + totals, and `test_total_row_carries_the_payloads_totals_not_a_resum` posts totals
that deliberately DISAGREE with the column above them and asserts the document still says what
the pane said. Corollary: the route looks nothing up, so it is not gated (it exports what she can
already see) and needs no entitlement check. ★ **A missing value is an em-dash, never a zero** —
the Support `metaErr` rule in a document: no suggestion and a suggestion of 0 are different facts.
`plan` keeps the pane's four-way render including **"set"** for a legacy prepare that stored no
periods, where a dash would misreport a prepared chapter as untouched. **The export is the table
and nothing else** — a test asserts "competency", "effort index", "weight" and "executive summary"
never appear; if it is not on the pane it is not in the file.
Built: `aruvi_core/export_year_plan_docx.py` (importing the allocation report's helpers, not
copying them — the `export_data_rights_docx.py` convention, so the three Aruvi documents cannot
drift) · `POST /api/year-plan/export-docx` (lazy import → 501, never a broken API import) ·
an **UPWARD-ARROW icon beside the budget pencil** on the totals row.
★ **PLACEMENT, settled in two moves (founder, same day).** It was first built as a labelled
`.filebtn` in its own row below the card, on the reasoning that a download and an edit are
different KINDS of act and should not share a `1fr` cell at 360px. Overruled, and the wrong unit
of difference: **both are things you do to the TABLE AS A WHOLE**, and the totals row is where
the table's own controls live — two icons also cost less height than a whole row, which is the
scarce thing on a phone, and the chapter column runs uninterrupted to the note. So it inherits
`.yp-budget-edit` wholesale (baseline alignment, the negative margin-block that stops a
tap target growing the row, pine-against-`--ink-soft`), and the pair reads as a set.
★ **The glyph is an arrow LEAVING A TRAY, upward** — deliberately not the allocation report's
file-page glyph, which sits beside a written "Word" label and can afford to name the FORMAT
where this one sits bare and must name the ACT; upward rather than a download-tray's downward
arrow because the sense is "take this away with me", not "pull something into this device".
⚠️ **Deleted with the labelled button: its `.filebtn` plane overrides and a `flex: none` fix.**
If a labelled button ever returns, the trap to remember is the ≤600px `.filebtn { flex: 1 }`
written for the allocation report's ROW of two buttons — inside a COLUMN container that is
flex-basis:0 on the button's HEIGHT.
★ **AND THE ERROR NAMES ITSELF (founder, live: "it says could not download - try again").** The
first build printed ONE sentence for every failure — the Support `metaErr` defect in miniature:
a screen that cannot tell "this server has no such route" from "the server refused" from "the
network dropped" tells her nothing to act on and the next debugger nothing at all. It now unwraps
FastAPI's `detail`, gives 404 its own words (**"This Aruvi server doesn't have the export yet"**
— an API process older than the route, i.e. restart uvicorn, which is the overwhelmingly likely
cause of that first report) and 501 its own (python-docx absent), keeps "couldn't reach Aruvi"
for a fetch that never got a status, and logs to the console either way. Said in a line under the
totals row that PUSHES the note down — never an `alert()` covering the table she is trying to
take away, and never `position: absolute` overlapping the prose on a narrow screen. Nothing
renders when idle: a permanent caption explaining an icon is a sign the icon is wrong.
★ **AND THE NOTE IS A SECOND COPY OF `.yp-note` (founder, live: the closing "To know how Aruvi
suggests, refer to Ask Aruvi time allocation section." was missing from the file).** The prose is
hand-carried across the JS/Python boundary, so it drifts silently by construction — the same
class of defect as `ppw_from_annual` mirrored in two languages, and the same answer: not a shared
string table, but a TEST. `test_note_matches_the_panes_own_words` reads YearPlan.jsx, replaces
each `{…}` expression — nested ones included, which needs a depth counter, not a regex — with a
sentinel, and asserts every fixed RUN of prose between the interpolations appears in the
document. Cutting at the interpolations rather than at sentence boundaries is what keeps it
robust: the budget clause and the chapter count legitimately differ. Sabotage-verified (deleting
the sentence fails it, and the by-name guard beside it).
`tests/test_year_plan_export.py` 15 green; backend suite unaffected (the three red files are the
pre-existing content defects logged 2026-08-27). Route live-verified end to end via TestClient
(200, correct Content-Disposition, correct cells); **browser + 360px pass owed.**

**Persistence + tenanting groundwork (2026-06-28) — the front-end-only state is now
server-persisted and per-tenant, ahead of full Phase-4 auth.** Built: (a) a **user-ID login
portal** (`web/app/components/Login.jsx`) gating the app — no password yet; the ID travels as
the `X-Aruvi-User` header (§7). (b) **Readiness persistence** — a `ReadinessRepository` port +
file adapter (`/readiness` GET/POST/DELETE); the teaching profile (subjects/grades/sections/
durations) survives refresh/restart/new browser, keyed `{tenant}/{user}`. (c) **Allocation
register made tenant-keyed** — the `AllocationRepository` port + adapter + engine fns + API
routes all thread `tenant_id/user_id`; path is now `{tenant}/{user}/{subject}/{grade}/`, so
teachers are isolated (was a real multi-tenancy hole). (d) **Self-contained `data/` root**
(§7) — content copied to `data/content/`, state to `data/`; no runtime dependency on the
prototype mirror. All keyed `tenant_id==user_id` today (stub), a clean drop-in for Supabase.
Repo cleanup/reorg also done (§5). NOTE: front-end still verified statically only (see below).

**Planning-layer rebuild (2026-06-27) — the web app was restructured from 3 sibling tabs to
the finalized two-tab, readiness-gated, hub-and-spoke flow** (mocked in
`docs/mockups/index.html`; flow chart in `docs/aruvi_saas_full_lifecycle_flow.png`). See
§11 for the new web architecture. Phases done: 1 (two-tab shell + readiness lock), 2
(readiness setup flow), 3 (Generate hub G2 + generate spoke G7 + G4 total-periods model + G5
howbox), 5 (My Plans dashboard + Learning-Unit lesson view + assessment artifact).
**IMPORTANT — these phases are code-complete and STATICALLY verified only; they have NOT been
live-rendered** (the Cowork sandbox can't load Next.js's arm64 SWC binary, so `next dev`/
`build` don't run there). A local smoke test of the full loop — readiness → unlock Generate →
allocate → accept → hub → generate → My Plans dashboard → teach (Learning Units) → assessment
— at desktop AND mobile widths is the immediate must-do before further UI work.

**Next (in order):**
1. **Phase 4** — Auth + DB + multi-tenancy (Supabase). Groundwork now in place (2026-06-28):
   identity flows via `X-Aruvi-User`/`_current_identity()`; readiness + allocations are
   server-persisted and tenant-keyed behind ports. Remaining: real Supabase Auth (replace the
   header stub + `tenant_id==user_id`), write the Supabase adapters behind the existing
   `ReadinessRepository`/`AllocationRepository` ports, move the lesson pointer + `ready` flag
   off localStorage, enable RLS. See `CLOUD_DATA_MODEL.md §4` checklist (§2.1/§2.2 already
   half-done — tenant key landed early).
2. **Live generation** — Anthropic `LLMClient` adapter + output cache (prompt builders are
   already lifted per subject); wire it into the G7 generate spoke (which currently serves
   saved-plan previews).
3. **LP + assessment PDFs** (same language; screen ↔ print parity).
4. **Payments** (Razorpay) → **mobile** (Expo). ★ Reuse assessment + migration path measured
   against the code 2026-09-04: `docs/mobile_migration_assessment.md` — the seam is clean
   (Next is a static host, zero `next/*` imports, 57 REST routes), backend untouched; first
   task is a deployed API, not UI; beta on manual grants, no in-app purchase screen.
   ★ **STARTED 2026-09-09** — stack chosen (Render · Supabase · Indian SMS OTP · payments
   deferred), plan in `docs/mobile_migration_plan.md`, Track A (the deployable container)
   built and rehearsed; deploy + Supabase Auth next. Phase 4 (item 1) now runs INSIDE this
   track, port by port under the screens.
5. **Deferred polish:** G6 selective-reset screen still uses the old modal (not yet the
   G2-aligned select-to-clear danger-zone screen from the mockup); "sample plans" pre-readiness
   surface deliberately parked (it shows only an LP, not the execution/My-Plans value — needs
   a better approach, see mockups Screen S note).

---

## 10. Relationship to the prototype

`../Project Aruvi` (tag `prototype-final`) is the source of: the constitutions, the
`mirror/` data, and the behavioural spec for rendering. It still runs independently. Lift
from it; don't depend on its code.

**Authoring prompts moved home 2026-07-01.** The `cowork prompts/` folder (the `chapter`
skill's per-subject/stage authoring prompts — chapter_summary + competency_mapping/
effort_index) was copied wholesale from `../Project Aruvi/cowork prompts/` into this repo's
own `cowork prompts/` (§5). **The `chapter` skill's own source ALSO moved home 2026-07-15:
`.claude/skills/chapter/SKILL.md` in THIS repo** (founder decision; `../Project Aruvi/Aruvi
skills/chapter/SKILL.md` is now the stale copy — edit here. The read-only cached skill loaded
into a live session can't be edited from inside Cowork; re-paste into Settings > Capabilities
after any edit). It resolves its subject→prompt-file path table against **this repo's root**,
not Project Aruvi's. Edit prompts here going forward (e.g. the English middle Step 7d
chapter-level effort-signal addition, 2026-07-01) — Project Aruvi's copy is now stale and
should not be edited. **Pipeline I/O also fully lives here as of 2026-07-15:** textbook PDFs
sit at `textbooks/{subject}/{grade}/` (repo root — the one true PDF home; Project Aruvi's
`knowledge_commons/textbooks/` no longer exists on disk), outputs deliver to
`data/authoring/chapters/.../summaries/` + `data/cloud/content/chapters/.../mappings/` (split 2026-08-23), and the skill's "Data
paths" section instructs translating any older prompt's `mnt/data/...` path table to these.
SS secondary (Grade IX) added to the skill the same day (see MEMORY.md 2026-07-15).

**Remaining `../Project Aruvi` dependencies, audited 2026-07-01** — everything else is
either historical/documentation-only or already severed:
- **Live/runtime:** none. `api/config.py`'s `DATA_DIR` defaults to this repo's own
  `data/cloud/content/` (§7); no env var or sibling folder needed to run the app (confirmed by
  grep — the only `ARUVI_DATA_DIR=../Project Aruvi/...` reference left was a stale
  MEMORY.md smoke-test command from before the 2026-06-28 `data/` migration, now corrected).
- **Authoring-time, still real and NOT yet migrated:** `../Project Aruvi/knowledge_commons/`
  — the source textbook PDFs, source DOCX constitutions, and framework PDFs the `chapter`
  skill reads when authoring a brand-new chapter's summary/mapping from scratch. This is the
  one genuine standing dependency; migrating it (copying `knowledge_commons/` here too) is
  an open item, not yet done.
- **Documentation-only (no action needed):** `docs/allocation reports/
  ALLOCATION_REPORT_DESIGN_NOTES.md`'s comparison notes, and CLAUDE.md's own historical
  references in §1/§7 (the prototype as authoring source / lifted-IP framing) — these
  describe provenance, they don't drive any runtime or authoring-time file read.

---

## 11. Web app architecture (post 2026-06-27 planning-layer rebuild)

> ⚠️ **Superseding direction 2026-07-01 (§0).** This section describes the *current* two-tab,
> readiness-gated shell. The mobile-first pivot changes the top-level IA: the **two top tabs
> (My Plans / Generate) go away**, replaced by a hamburger sidebar + **My Week as Home** and a
> universal **+ Prepare Lesson** action; the **upfront `Readiness` gate is retired** in favour of
> a shell-less Phase-1 first-run that only opens the shell once a lesson is attached to a section.
> The component *inventory* below is still accurate and is the reuse map — read it alongside §0
> and the 2026-07-01 MEMORY.md audit.

The visual + behavioural spec is `docs/mockups/index.html` (screen-by-screen
mockups) and `docs/aruvi_saas_full_lifecycle_flow.png` (the conceptual flow). The
`docs/mockups/readiness-grid-flow.html` is the interactive prototype the readiness
React component was ported from.

**Login gate first.** `page.jsx` renders `Login.jsx` (user-ID portal, no password) until a
user ID is set; the ID is stored in localStorage and sent as `X-Aruvi-User` on every API call
(`web/app/lib/format.js` `withUser()` wraps fetch). Sign-out clears it. `tenant_id == user_id`
server-side (§7).

**Two tabs, not three.** Once signed in, `web/app/page.jsx` renders **My Plans** (default) and
**Generate**. The old standalone "Allocate" tab is folded into Generate. `Generate.jsx` (the
old thin input-panel component) is now DEAD CODE — left on disk, not imported.

**Readiness gates Generate, and is now PERSISTED per user (2026-06-28).** `page.jsx` holds
`ready` + `readiness`, but these are **rehydrated on sign-in from `GET /readiness`** (not just
front-end state): on completing setup it `POST`s the canonical `subjects[]` to the server, and
`projectReadiness()` regenerates the active-subject projection on read. So the teaching profile
survives refresh/restart/new browser. Until readiness exists, Generate shows the locked G1
state (`GenerateTab.jsx`). **Phase 4** swaps the file store for Supabase behind the same
`/readiness` endpoints + `ReadinessRepository` port; the lesson pointer is still localStorage-
only (next to migrate).

**Component map (`web/app/components/`):**
- `Readiness.jsx` — ported from `readiness-grid-flow.html`. Three steps looped per grade:
  class durations (chips) → weekly grid (tap to mark a class at shortest duration, hold/
  right-click to cycle longer; clash detection) → annual budget (4 methods: weeks / periods /
  working days / estimate). **As of 2026-06-27 the flow opens with the conversational
  collection steps 1–4** (the missing piece between Screen 2a and the grid): (1) subjects —
  multi-select, "Tell us what you teach"; (2) grades per subject; (3) sections per subject·
  grade; (4) class durations per subject — then the existing weekly grid + annual budget loop
  PER grade WITHIN each subject, and the whole thing loops per subject. One question per
  screen, "Step N of 6" progress, reassurance microcopy. The hardcoded seeded grade plan is
  gone; the structure is collected. On finish calls `onComplete(payload)`. The payload's
  **canonical** shape is `payload.subjects[]` (self-contained per-subject record:
  name/durations/grades[{grade,sections[{tag,sec}]}]/grids/budget); it ALSO carries a
  denormalized active-subject projection `{subject, grades, durations, grids, budget}` purely
  for backward compat with `MyPlans.classesFromReadiness` + `Allocate.weeklyRatioFromReadiness`
  (do not persist that projection — see CLOUD_DATA_MODEL.md §2.1).
- **`CLOUD_DATA_MODEL.md` (root) is the single source of truth for the Supabase/cloud data
  boundary** (added 2026-06-27): which data is shared read-only CONTENT vs per-user/tenant
  STATE, the proposed tables (incl. the readiness teaching-profile), and the ordered migration
  checklist for Phase 4. Read it before any DB/persistence work.
- `GenerateTab.jsx` — readiness gate (G1) in front of `Allocate`; passes `readiness` through.
- `Allocate.jsx` — the Generate tab's working component. Steps: `periods` (G4) → `select`
  (G3) → `adjust` (G5) → `final` (G2 hub) → `generate` (G7). **G2 hub** = the `final` step:
  allocation table + budget bar + nav buttons (Continue to Allocate → `select`/G3 flow ·
  Continue to Generate → `generate`/G7 spoke · Reset in a danger zone). **G4** = single
  "periods in total" input split across period types by the weekly ratio
  (`weeklyRatioFromReadiness` + `splitByRatio`, largest-remainder; falls back to period-rows
  when readiness absent). Internally the split is written back into `rows` so the rest of the
  flow (engine allocate call, adjust, persist, export) is unchanged. **G5** howbox uses the
  live `allocation_basis` (basis + per-subject factors). The server-backed allocation register
  + PDF/DOCX export are preserved untouched. The `generate` spoke serves saved-plan previews
  (live gen deferred).
- `MyPlans.jsx` — when `!ready` shows the **Screen 2a welcome landing** first ("Let's get
  your week set up" + 1·Weekly grid / 2·Annual budget checklist; gated by local `setupStarted`
  state), and only on tapping "set up →" renders the `Readiness` grid flow. When ready renders
  the **weekly dashboard** (2c): classes from the readiness grid grouped by day, crossed with
  saved plans;
  populated rows show "On: Learning Unit N" (from the localStorage pointer) and open
  `LessonView` on tap; the 2b empty/forward state shows a single CTA to Generate. Falls back to
  a plans-list of openable cards when readiness has no schedule.
- `LessonView.jsx` — Screen 3 + 3b. Flattens `lesson_plan.groups[].periods[]` into Learning
  Units on a continuous rail (done/now/future); activities = phase rows (no fabricated
  minutes); Move-to-next / Stay; **pointer (current LU) persists per section in localStorage**
  key `lu_pointer_{sectionKey}`. "assessment here →" opens the dedicated green assessment
  artifact built from the view model's assessment items.
- `PeriodRows.jsx` (exports `Stepper`, `toPeriodRows`, `periodTypeNames`), `ViewModelView.jsx`
  (the document renderer — used by LessonView's flatten source), `StatePill.jsx`,
  `AllocationReportView.jsx` unchanged.

**Status is execution, and lives in My Plans — never in Generate.** Started / in-progress /
locked is teaching state (the LU pointer); Generate only knows allocated vs. plan-made. This
was a deliberate split during the rebuild.

**Verification reality in Cowork:** the sandbox cannot run `next dev`/`build` (arm64 SWC
binary won't load) and Google-Fonts `@import` stalls the build. So web changes here are
verified **statically** (balanced braces, default exports, prop-contract greps, CSS brace
balance, unit-testing pure helpers like `splitByRatio`). **Live render + mobile check must be
done locally:** `python3 -m uvicorn api.main:app --port 8000; npm --prefix web run dev` — no
`ARUVI_DATA_DIR` needed now (defaults to `data/cloud/content/`, §7). Sign in with any user ID
(e.g. `Kumar1`, which has seeded data) to pass the login gate.
