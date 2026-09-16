# Lists + Prepare — My Classes · My Lessons · Year Plan · Prepare a lesson

Scope: `MyPlans.jsx` (My Classes), `Readiness.jsx` (dead — 1 row), `MyLessonPlans.jsx` (My Lessons incl. Reports modal, prior-year folders, tour offer), `YearPlan.jsx`, `PrepareLesson.jsx` + `GenerateTab.jsx` + `ViewModelView.jsx`. Mobile: `app/(app)/index.jsx`, `app/(app)/lessons.jsx`, `app/(app)/prepare.jsx`, `components/{AttachSheet,ProposedCard,PrepareCta,RollWheel,CardGrid,YearPlan}.jsx`, `lib/preparing.js`, `theme/web.js`, `@aruvi/shared`.

Headline: these screens are ~85% ported and the residue is concentrated in SIX clusters — (1) everything hanging off the **academic-year record** (`GET /academic-year`: cutover offer/result, `.ap-prior`, `.mlp-prior`, `YearStamp` on section cards, `notePlansYear`), (2) **file downloads** (Reports modal, Year Plan Word export), (3) the **section-history glyph + popup** (computed on the phone, never rendered), (4) **subject bands** on My Classes, (5) the **return-with-section** path (picker footer → prepare → auto-attach), (6) the **tour surfaces** (offer nudge, one-shot "Are these your sections?", `data-tour` anchors). Plus a handful of small guards the phone silently lost (loading-vs-empty states, the modal-open sync hold, verify-mismatch routing).

## Web source map
- `web/app/components/MyPlans.jsx` (1201)
  - 33–37 `YearStamp` — "{year} version" chip; prefers `lp_year_display` (server-filtered) over `prepared_source_year`. Exported; reused by MyLessonPlans.
  - 44–66 glyphs + constants: `RouteIcon` (tour nudge), `HistoryIcon`, `HISTORY_LABEL`, `normStatus` (legacy `set_aside`→`untracked`).
  - 73–93 `classesFromReadiness` — one entry per subject·grade·section (walks canonical `readiness.subjects[]`).
  - 100–105 `SectionTag` — tag, or class number + her section name in fine print.
  - 107–122 `MyPlans` props + state (`openPlan`, `attachFor`, `untrackFor`, `historyFor`, `plansByKey`, `apPrior`, `apPriorPlans`).
  - 134–139 onboarding gate (`anyBoundTop`, `tourResolved`) for the welcome copy.
  - 176–188 `sectionCheck` effect — re-bind latest prepared plan to any unbound card when the tour ends.
  - 209–223 plans fetch per distinct subject·grade via shared store (`cachedPlans`/`fetchPlans`), `notePlansYear`, re-runs on year change.
  - 236–281 section-state + history reconcile (`pullSectionState`, `pullSectionHistory`) on mount / visibility / focus / 20 s interval; skipped while a modal/lesson is open or an auto-attach is pending; `reconciled` gate.
  - 285–297 `pendingOpen` deep-link → `/plans/{s}/{g}/{file}/view` → LessonView.
  - 303–322 `pendingAttach` — return from Prepare launched from a card: invalidate + refetch, `bindSectionChapter`, consume.
  - 341–392 tour orchestration (steps 8–15: bind/unbind, open lesson 11–13, picker at 9/15, demo-done at 14/15), `onTourInfo`.
  - 397–424 prior-year picker fetch: `/plans/{s}/{g}?year_id=` filtered to prepared, not bound, not already in this year's list.
  - 427–433 tour-end cleanup.
  - 436–456 `!ready` branch: Screen 2a welcome → `<Readiness/>` (UNREACHABLE — see Readiness row).
  - 458–512 helpers: `openLesson`, `pointerFor`, `unitsDoneFor`, `currentChapterFile`, `boundFilesForGrade`, `isDone`.
  - 523–593 actions: `attachPriorChapter` (markPrepared with sourceYear + optimistic upgrade), `attachChapter`, `clearBinding`, `untrackChapter` (history gate ≥1 unit), `moveOnFromCompleted`.
  - 595–596 loading spinner / LessonView mount.
  - 602–707 `attachModal` — "Track a chapter for this section" picker: header, capped list, rows with YearStamp, `.ap-prior` folders, "prepare a new one" footer.
  - 711–731 `untrackModal` — "Stop tracking this chapter?".
  - 737–802 `historyModal` — "Section history" rows with pills + rail.
  - 805–812 greeting + `firstName` rule.
  - 815–832 empty-profile state.
  - 836–871 `anyBound`, `bindingsKnown`, `anyPlans`, subject `bands` (adjacency).
  - 873–1065 render: greeting row / welcome row / cutover offer / cutover result / tour nudge / banded or flat `sc-list` / modals.
  - 1073–1200 `renderCard` — loading-bound card, st-new card, bound card (st-going/st-done) with rail, right-slot actions, history glyph.
- `web/app/components/Readiness.jsx` (744) — legacy 6-step wizard (subjects → grades → sections → durations → weekly GRID → budget). DEAD: see row R1.
- `web/app/components/MyLessonPlans.jsx` (1111)
  - 37–56 slugs, `subjectLabel` (TWAU), `CLASS_NUM`, per-user `lsGet/lsSet`.
  - 59–87 `ArchiveIcon`, `OpenArchiveIcon`, `ReportIcon`.
  - 92–96 `REPORT_COMPS`.
  - 105–197 `ReportModal` — composition radio ×3, "Include answers" tick, PDF/Word, blob download from `GET /api/plans/{s}/{g}/{file}/export/{comp}?format=…[&answers=1]`.
  - 201–212 `ReportButton` (`.sc-report`, tour anchor `lesson-report`).
  - 233–238 `matrixLabel` (exported; dedupe key + duration line phrasing).
  - 240–278 `ProposedCard` (busy / failed).
  - 280–338 `MyLessonPlans` state: `LS_SUBJECT`/`LS_CLASS` (`userKey("mylessons_subject"|"mylessons_class")`), `openPrior`/`priorPlans`, `view`, `pane` (+ `paneIntent` one-shot), `toast`.
  - 349–359 follow the lesson being prepared (steer subject/class/view/pane).
  - 378–394 keep subject/class valid vs profile.
  - 406–412 `onScope` (second "check your set-up" moment).
  - 425–461 `plansNonce` refetch-on-completion + shared-store fetch (`notePlansYear`, `invalidatePlans`).
  - 472–495 section-state reconcile (mount / visibility / focus / 20 s; skipped while a plan is open).
  - 497–516 `onSubject`, `onGrade`, `openLesson` (read-only preview), `openPlanView`.
  - 522–550 prior-year folders (`yearInfo.prior_years`), lazy `/plans/{s}/{g}?year_id=` filtered to prepared and not already in this year.
  - 558–598 tour steps 3–7 orchestration, `statusFor`, `isAttached`, `tourPlanOf`.
  - 602–683 archive/restore: optimistic flag, `verifiedWrite` vs `GET /plan-archive`, `POST`/`DELETE /plan-archive`, toasts (3.2 s).
  - 688–697 publishes `--mlp2-frozen-h` (ResizeObserver) for YearPlan's sticky head.
  - 711–718 memoised wheel items.
  - 720–730 spinner / LessonView(preview) / "No subjects set up yet" early returns.
  - 739–746 `prepareCTA` (hidden when `lapsed`).
  - 766–835 `byRecency`, `preparedPlans` (this-year filter), active/archived split, `showProposed`, dedupe `matchIdx`, hoist busy card.
  - 837–1109 render: frozen header (paired switch + archive box + wheels) → YearPlan pane OR lessons pane (loading / empty / `sc-list` of cards) → prepareCTA → `.mlp-prior` folders → tour nudge → toast.
- `web/app/components/YearPlan.jsx` (381)
  - 51–73 `Pencil`, `ExportIcon`.
  - 102–117 fetch `/subjects/{s}/{g}/chapters` + shared `fetchPlans`.
  - 119–183 model: committed per chapter, budget (`annualBudgetPeriods` → recSum), `largestRemainder` suggestion, rows, totals.
  - 194–249 `downloadWord` — `POST /api/year-plan/export-docx` with the SCREEN's own rows/totals; 404/501/network wording.
  - 251–253 loading / error / empty.
  - 258–379 render: `.yp-table` (col header, rows, totals row with pencil + export), export status line, `.yp-note`.
- `web/app/components/PrepareLesson.jsx` (685)
  - 37–92 state: chapters, `chapterNo`, `trialInfo` (`fetchEntitlement`), `periods`, `step` ("chapter"|"preview"), plans (`readPlans`), busy/error/note, `preparing` (fallback wait), `showInfo`, `showBreakdown`, `warnRegen`, genon (`genonChs`, `canonMinutes`, `canonPeriods`), `inFlight`, `syllabusW`.
  - 95–109 loads `/subjects/{s}/{g}/chapters` (no placeholders), plans, `/genon/{s}/{g}/chapters`.
  - 123–152 `classProfile` (durations + `ppw_by_duration`), `seedRows` (largest remainder across her lengths).
  - 155–222 `annualBudget`, `sumW`, `sugByChapter` (largestRemainder incl. synthetic missing bucket), `suggestionFor`, seed periods on chapter pick.
  - 230–294 `rows`, `mixLabel`, `attachedFiles` (localStorage bindings), `committed` (dedupe newest per chapter), `chosenAlreadyPrepared`, totals.
  - 305–420 `onPrepareClick` → `doGenerate` → `runGenerate`: descriptor → `onPreparing` handshake → `POST /genon/{s}/{g}/{ch}/plan {rows}` → `verifiedWrite` vs `GET /plans-prepared` → `holdPreparing` (5 s unless `already_yours`) → `onPrepared` | preview; errors → 402 `onPaywall` / `onPrepareError` / inline; no canonical → "No underlying chapter yet.".
  - 423–442 fallback in-place `prep-wait` card (attach path only).
  - 445–455 `preview` step (`ViewModelView`) — only when no `onPrepared` handler.
  - 459–634 chapter step render: header row + back, scope kicker, instruction, trial note, chapter wheel, stepper + mix + floor/surrender note, Suggestion box (i / ✓ / use / tip), budget box (Total / Used ⓘ / Available), error line, savebar CTA + hint.
  - 636–682 re-prepare confirm modal, committed breakdown modal.
- `web/app/components/GenerateTab.jsx` (115) — `!ready` gate (unreachable), `entry.mode==="pick"` subject/grade picker (`.gpick`), else `<PrepareLesson/>`.
- `web/app/components/ViewModelView.jsx` (156) — the old whole-document renderer (LP groups → PeriodCard; assessment groups → QItem). Used ONLY by PrepareLesson's `preview` step (447–452).

## Mobile counterpart map
- `mobile/app/(app)/index.jsx` (456) — My Classes: `pointerOf`/`unitsDone` (32–40), `classesFrom` (47–61), `Home` (63–297: paint-first `load`, attach/untrack/moveOn handlers 175–222, `boundFilesForGrade` 227–235, render 237–296 with `DashHead`, card list, temporary foot [entitlement line + theme segments], `AttachSheet`, `UntrackSheet`), `DashHead` (306–335), `ClassCard` (346–449).
- `mobile/components/AttachSheet.jsx` (139) — `Sheet` (38–63, shared modal chrome), `ChapterRow` (70–85), `AttachSheet` (87–114), `UntrackSheet` (116–137). Header 16–25 names the two deferrals.
- `mobile/app/(app)/lessons.jsx` (775) — `MyLessons` (111–675): readiness from shared store, `LS_SUBJECT/LS_CLASS`, steering effect 156–165, validation 205–220, plans fetch 236–243, refetch-on-completion 258–268, AppState sync 274–290, archive/restore 331–402, lists 419–462, render 498–673 (frozen header 508–587, ScrollView with RefreshControl 589–644, paywall Sheet 651–660, toast 664–672); `PlanCard` (691–775). Header 29–46 names the four deferrals.
- `mobile/components/YearPlan.jsx` (216) — model 75–127, render 144–215; header 24–35 names pencil + export as deferred.
- `mobile/app/(app)/prepare.jsx` (605) — `Prepare` (77–560), `CoverageNote` (581–605).
- `mobile/components/ProposedCard.jsx` (124) — `matrixLabel`, `ProposedCard` (Animated bar, failed state, `bare` mode).
- `mobile/components/PrepareCta.jsx` (101) — the clay→ochre CTA identity (svg gradient), sizes `primary`/`allocate`.
- `mobile/lib/preparing.js` (91) — module-level `{descriptor, paywall}` store: `subscribePreparing`, `startPreparing`, `clearPreparing`, `failPreparing`, `paywallPreparing`, `clearPaywall`.
- `mobile/components/RollWheel.jsx` (221) — peek + base modes, `clamp`, `padLeft`; no `large`/`fit` props (auto-fit via `adjustsFontSizeToFit`).
- `mobile/components/CardGrid.jsx` (59) — svg `<Pattern>` graph rule.
- `mobile/theme/web.js` — key families present: `dash_*`(5) `sc_*`(30 incl. `sc_metarow`, `sc_yearstamp`, `sc_proposed`, `sc_prep*`, `sc_round*`) `ap_*`(15) `ch_*`(4: meta/name/no/go) `mlp2_*`(25) `mlp_allocate*`(4) `rw_*`(13) `prep_*`(40) `pcta_*`(10) `yp_*`(25) `trial_note`. ABSENT: `sc_hist`, `sc_add`/`sc_remove` (subsumed by `sc_round`), `sc_bands`/`sc_band_hd`, `ch_row`/`ch_pill`/`ch_rail`, `ap_prior*`, `ap_loading`, `mlp_prior*`, `dash_nudge*`, `yr_nudge*`/`yr_x`, `dash_welcome` (row/box), `rpt_*`, `sc_report`, `yp_budget_edit`/`yp_export_btn`/`yp_export_msg`, `mlp_empty`, `prep_wait*` (deleted with 5b, correctly), `gpick*`.
- `packages/shared/src`: `plans.js` (`cachedPlans`, `fetchPlans`, `readPlans`, `invalidatePlans`, `notePlansYear`, `clearPlans`), `readiness.js` (`cachedReadiness`, `fetchReadiness`, `invalidateReadiness`), `sectionState.js` (`bindSectionChapter`, `unbindSection`, `readLocalSection`, `pullSectionState`, `clearLocalSectionCache`), `sectionHistory.js` (`readHistory`, `recordHistory`, `hasHistory`, `pullSectionHistory`, `clearLocalHistoryCache`), `verify.js` (`verifiedWrite`, `planIsPrepared`, `planIsArchived`), `format.js` (`markPrepared(subject, grade, filename, periods, sourceYear)`, `largestRemainder`, `annualBudgetPeriods`, `fetchEntitlement`, `userKey`, `classNum`, `pad`, `pretty`), `budget.js` (`setGradeBudget`, `gradeBudgetRecord`, `normalizeBudget`, `findScope`) — the budget writer the pencil needs.

## Inventory table

### A. My Classes — data, sync and guards (MyPlans.jsx)

| # | Feature / UI element | Web ref (file:lines) | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| A1 | `classesFromReadiness` — one card per subject·grade·section, in profile order, carrying `sectionName` | MyPlans.jsx:73–93 | DONE | index.jsx:47–61 | `readiness.subjects[]` | Identical walk; mobile adds `sectionKey` on the entry. |
| A2 | Plans per distinct subject·grade from the shared store; device copy painted first | MyPlans.jsx:209–223 | DONE | index.jsx:109–149 | `@aruvi/shared/plans` | Mobile indexes by filename (`indexPlans`). |
| A3 | `notePlansYear(yearInfo.current_year)` before reading the store; refetch on year change | MyPlans.jsx:211, 223 | MISSING | — | `GET /academic-year` (page.jsx:792) | Phone never reads the year record, so a cutover on the web leaves the phone's `prepared`/`archived` flags stale until sign-out. Wire once `yearInfo` exists on the phone (see F-rows). |
| A4 | Section-state reconcile on mount + visibility + focus + 20 s interval | MyPlans.jsx:246–281 | PARTIAL | index.jsx:151–156, 160 | `pullSectionState` | Phone pulls ONCE per load plus `useFocusEffect` re-read of the cache. No AppState-foreground re-pull, no 20 s interval (lessons.jsx:274–290 has both — copy that pattern). |
| A5 | Skip the sync while a modal / lesson / history popup is open (`uiBusyRef`) and while an auto-attach is pending (`autoBindHoldRef`) | MyPlans.jsx:236–239, 253 | MISSING | — | — | Only matters once A4's interval exists; then it is load-bearing (an in-flight attach must not be clobbered). |
| A6 | Teaching-ledger reconcile `pullSectionHistory(keys)` alongside, own tick | MyPlans.jsx:265–267 | MISSING | — | `sectionHistory.pullSectionHistory` (shared, exists) | Phone reads `hasHistory` (index.jsx:351) from a cache it never fills from the server → the glyph would be wrong on a second device even if rendered (C13). |
| A7 | `reconciled` / `bindingsKnown` gate — never treat an empty cache as "new teacher" before the server confirmed | MyPlans.jsx:245–257, 836–840 | MISSING | — | — | On the phone `DashHead` computes `anyBound` straight from the cache (index.jsx:312); welcome copy can flash before the pull lands on a fresh device. |
| A8 | `pendingOpen` deep-link → open a section's plan with tracking | MyPlans.jsx:285–297 | WEB-ONLY-BY-NATURE | — (route params on `/lesson`) | — | On the phone LessonView is a route (`router.push("/lesson", {section})`, index.jsx:163); no prop-based deep link needed. |
| A9 | `pendingAttach` — return from Prepare launched FROM a card: invalidate, refetch, `bindSectionChapter`, bump | MyPlans.jsx:303–322 | DEFERRED (AttachSheet.jsx:17–23 "wire the return, then the footer") | — | prepare route accepting a `section` param; a way to hand `{subject,grade,sectionTag,filename}` back across the route change (a module store like `lib/preparing.js`, or `startPreparing` carrying `returnSection`) | Pairs with D12. Design: `prepare.jsx` receives `section`, on success `bindSectionChapter(sectionKey, resp.filename)` in its closure + `invalidatePlans`, and navigates to `/` instead of `/lessons`; the web deliberately shows NO proposed card on this path (page.jsx:585). |
| A10 | `sectionCheck` effect — re-bind the latest prepared plan to unbound cards when the tour ends | MyPlans.jsx:176–188 | NOT-PORTED-BY-DECISION | — | GuidedTour (deferred) | Tour-only. |
| A11 | Tour orchestration steps 8–15, `tourTarget`, `onTourInfo`, prev-tour cleanup | MyPlans.jsx:341–392, 427–433 | NOT-PORTED-BY-DECISION | — | GuidedTour | — |
| A12 | `pointerFor` (absent → null, card reads `|| 1`), `unitsDoneFor`, `isDone` | MyPlans.jsx:475–512 | DONE | index.jsx:32–40, 395–396 | `readLocalSection` | Same rule stated on both surfaces (2026-09-14). |
| A13 | `boundFilesForGrade` (sibling-section pass-through) | MyPlans.jsx:499–507 | DONE | index.jsx:227–235 | — | — |
| A14 | `attachChapter` — bind, close, bump, invalidate + refetch listing | MyPlans.jsx:554–562 (+548–551) | DONE | index.jsx:175–198 | `bindSectionChapter`, `invalidatePlans` | — |
| A15 | `untrackChapter` with the ≥1-unit history gate | MyPlans.jsx:571–580 | DONE | index.jsx:201–210 | `recordHistory` | — |
| A16 | `moveOnFromCompleted` — record "completed", unbind, open picker | MyPlans.jsx:584–593 | DONE | index.jsx:213–222 | — | — |
| A17 | `attachPriorChapter` — `markPrepared(..., sourceYear)`, optimistic upgrade of the cached row, close folder, attach, invalidate + refetch | MyPlans.jsx:523–552 | DEFERRED (AttachSheet.jsx:24) | — | `format.markPrepared` (shared, exists), `yearInfo.prior_years`, `GET /plans/{s}/{g}?year_id=` | Part of the `.ap-prior` cluster (B13–B16). |
| A18 | 401 from `/readiness` ends the session | (page.jsx) | DONE (phone adds it here) | index.jsx:127 | `lib/session.endSession` | Phone-side capability; not a divergence. |
| A19 | Pull-to-refresh (`force`) | — | DONE (capability the phone adds) | index.jsx:248 | — | Named in code; fine under rule (2). |

### B. My Classes — screen chrome, states, modals

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| B1 | Screen 2a welcome ("Welcome to Meyy" / "Let's get your week set up" / "Let's begin →") + `<Readiness/>` | MyPlans.jsx:436–456 | NOT-PORTED-BY-DECISION (dead on web) | — | — | Unreachable: page.jsx:1081 returns `<FirstRun/>` whenever `!ready`, so MyPlans never mounts with `ready=false`. Copy also contradicts the calendar purge ("weekly grid"). See R1. |
| B2 | Loading spinner "Opening plan…" while fetching a view | MyPlans.jsx:595 | WEB-ONLY-BY-NATURE | — | — | Phone navigates to `/lesson`, which owns its own loading. |
| B3 | LessonView mount with `sectionKey` (tracking) | MyPlans.jsx:596 | DONE | index.jsx:163–164 | `/lesson` route | — |
| B4 | Greeting "Good morning/afternoon/evening{, name}!" — numeric id greets plainly | MyPlans.jsx:805–812, 882–888 | DONE | index.jsx:306–322 | `dash_hd`, `dash_title`, `dash_sub` | Web renders the greeting row ONLY when `anyBound`; phone always renders the title and only gates the sub-line. Small copy-order difference: on the web the first-time view has NO greeting, just "Your classes are ready". |
| B5 | Sub-line "Continue where you left off with every class." | MyPlans.jsx:886 | DONE | index.jsx:320 | — | — |
| B6 | Empty profile: "No classes set up yet" / "Set up your teaching profile from the settings gear above to start planning." (`.slotcard.slot-empty`) | MyPlans.jsx:815–832 | PARTIAL | index.jsx:255 | Settings/FirstRun on phone | Phone copy is a placeholder: "No classes yet — set up your teaching profile (first run comes in a later step)." Replace with the web's two lines once first run/Settings exist. |
| B7 | Welcome row "Your classes are ready" with 3-way sub copy (tour-unresolved / lesson waiting / tap +) | MyPlans.jsx:891–907 | PARTIAL | index.jsx:323–332 | `dash_welcome_title/sub` (no `dash_welcome` box style) | Phone has 2 of the 3 strings — the tour-pending "Your first lesson is saved in My Lessons — it will wait there for you." is absent (tour deferred, acceptable). The web's `.dash-welcome.dash-welcome-row` box style is not in web.js; phone renders plain text. Measure and add. |
| B8 | Academic-year cutover OFFER (`.dash-nudge.yr-nudge`): ✕ "Not now — ask me next time", title "{current_year} has begun — start your classes fresh?", body copy, "Start my classes fresh →" (busy: "Clearing…"), "Not yet" | MyPlans.jsx:916–959 | MISSING | — | `GET /academic-year` → `{current_year, prior_years[], cleanup_due ?? cutover_due}`; `POST /academic-year/cutover {confirm:true}`; `clearLocalSectionCache`, `clearLocalHistoryCache`, `clearPlans`/`notePlansYear`; per-user session-only `cutoverDismissed`; styles `dash_nudge*`, `yr_nudge*`, `yr_x` | Whole cluster lives in page.jsx:761–835 on the web (fetch on focus/visibility, keyed to `user`). On the phone: a `lib/year.js` store (same pattern as `preparing.js`) read on the `(app)` layout, re-read on AppState active. |
| B9 | Cutover RESULT card (`.yr-done`): "Ready for {opened_year}." / "Your classes are already set for {opened_year}." · "{n} section(s) cleared and ready for your new batch." · "Your {k} {closed_year} lesson plan(s) is/are still in My Lessons under {closed_year}." · "Got it" | MyPlans.jsx:962–996 | MISSING | — | B8's result `{already_done, opened_year, sections_cleared ?? sections_carried, plans_archived, closed_year}` | — |
| B10 | Tour offer nudge (`.dash-nudge.dash-nudge-click`, role=button, Enter/Space): RouteIcon, "Let me show you around first", body, "Show me how →" | MyPlans.jsx:1005–1031 | NOT-PORTED-BY-DECISION | — | GuidedTour | The keyboard handler is WEB-ONLY-BY-NATURE regardless. If the tour is ever ported, this row and MyLessons' twin (C40) share one component. |
| B11 | Subject BANDS when >1 subject: `.sc-bands > .sc-band > .sc-band-hd` (mono kicker, subject name) + `.sc-list`; banded cards drop the subject from the kicker ("Ch 4" / no kicker) | MyPlans.jsx:865–871, 1035–1049, 1095, 1117, 1153–1155 | **DONE** (2026-09-16) | index.jsx:77–85 (`bandsOf`), 295–309, 332–345, 497, 519, 559–566 | `sc_bands`, `sc_band_gap`, `sc_band_hd`, `sc_band_list` (web.js:94–100) | Founder-reported against the phone: "the expo/iphone My classes shows all subjects in one list". Ported verbatim, ADJACENCY not a keyed map — `classesFrom` already walks subjects → grades → sections in profile order, so same-subject cards were already adjacent and nothing MOVES; a map would silently reorder if that walk ever changed, where adjacency can only mis-SPLIT, which is visible. The phone's `sectionKey` stands in for the web's positional `i` (nothing here addresses a card by index, so the tour's re-indexing trap does not apply). One card renderer for both paths (`card(c, banded)`), so they cannot drift. `.sc-band .sc-list`'s 7px top becomes `sc_band_list` rather than overriding `sc_list`. |
| B11a | Section TAG: un-named `6A`; NAMED, the letter gives way to her word — `classNum(grade)` alone with `.sc-tag-name` beneath | MyPlans.jsx:96–105 | **DONE** (2026-09-16) | index.jsx:452–460, 465–470 | `sc_tag`, `sc_tag_name` (both existed) | **A row this inventory never had, and the gap it left was live on the phone**: the nickname line was ported in step 4 but not the RULE above it, so a named section read "3A" over "Aruvi" where the web reads "3" over "Aruvi" (founder, 2026-09-16). Two labels to find one card is exactly what the 2026-08-30 web change removed. DISPLAY ONLY — `c.sectionTag` is still the key behind every binding, pointer, bookmark and `sectionKey`, and the a11y label on the bound card was moved back onto it. |
| B12 | The card grid rule (`CardGrid`) | (globals.css `--card-grid`) | DONE | index.jsx:376, 411 | react-native-svg | 5%/4% weight from tokens; the index.jsx header (343–344) still says "the graph rule is the one thing not ported" — stale comment. |
| B13 | Attach picker: overlay, ✕, kicker "{Subject} · Class {n} · {tag}", title "Track a chapter for this section", sub "Pick a chapter you've already prepared to track for this section, or build a new one." | MyPlans.jsx:617–625 | PARTIAL | AttachSheet.jsx:99–101 | `ap_*` | Sub-copy trimmed to "…for this section." because the footer is absent — restore ", or build a new one." with D12/A9. |
| B14 | Picker list: `Loading lessons…` (undefined) / "No other lessons prepared for this section yet." / rows; cap at 2 visible rows + scroll (`ap-list-capped`) | MyPlans.jsx:629–655 | PARTIAL | AttachSheet.jsx:89–111 | — | (a) No LOADING state: `plans` is `{}` before the listing arrives, so the sheet says "No other lessons prepared…" falsely on a cold cache — thread `undefined` through like the web. (b) Phone sorts by `chapter_number`; web keeps API order — harmless but not 1:1. (c) `maxHeight:160` stands in for the 2-row cap — fine. |
| B15 | Picker row: `Ch. 05: Title` + `›` + `sc-durline` + `YearStamp` | MyPlans.jsx:638–652 | PARTIAL | AttachSheet.jsx:70–85 | `sc_yearstamp` (exists) | YearStamp on the row is missing (no `lp_year_display`/`prepared_source_year` rendered). One line to add. |
| B16 | `.ap-prior` folders in the picker: per prior year a head (▸/▾, `{yid}`, "lessons you prepared last year"), then "Loading lessons…" / "Nothing prepared for this class in {yid}." / capped list of rows with `YearStamp year={yid}`; tap → `attachPriorChapter` | MyPlans.jsx:661–695 | DEFERRED (AttachSheet.jsx:24) | — | `yearInfo.prior_years` (B8), `GET /plans/{s}/{g}?year_id={yid}` filtered `prepared && !archived && !bound && !in this year's list`, cache key `${yid}|${key}|${here.length}`, A17, styles `ap_prior*`, `ap_loading` | Exact dependency: the year record. Everything else (endpoint, filter, `markPrepared`) already exists in shared. |
| B17 | Picker footer `.mlp-allocate`: "Need a chapter you don't have yet?" + `Prepare a new lesson →` → `onEnterGenerate({subject, grade, single:true, returnSection})` | MyPlans.jsx:697–703 | DEFERRED (AttachSheet.jsx:17–23) | — | A9 return path; `PrepareCta size="allocate"` exists; `/prepare` route accepting `section` | The destination exists; only the return is missing. |
| B18 | Untrack confirm: kicker, "Stop tracking this chapter?", sub "{tag} will stop tracking "{Ch. 05: Title}". It will be available to track again for this section.", "Keep tracking" / "Stop tracking" | MyPlans.jsx:711–731 | DONE | AttachSheet.jsx:116–137 | `ap_actions`, `ap_btn` | — |
| B19 | Section HISTORY popup: kicker, "Section history", "Where each chapter stands for this section.", rows `Ch. NN: title` + pill (Ongoing/Completed/Untracked, `ch-pill ch-{status}`) + mini rail; current bound chapter overlaid live only with ≥1 unit; "No chapters taught yet." | MyPlans.jsx:737–802 | MISSING | — | `readHistory`, `normStatus`, A6 pull; styles `ch_row`, `ch_pill` (+3 status colours), `ch_rail` | Entire popup absent. |
| B20 | History GLYPH button (`.sc-hist`, `HistoryIcon`) on every card state when `hasHistory` | MyPlans.jsx:1126–1129, 1183–1186, 1192–1195 | MISSING | index.jsx:351 (computed, unused) | B19, style `sc_hist` | `hist` is computed and never rendered — the clearest residual on this screen. |
| B21 | Card: "Loading your lesson…" state when bound but the listing has not arrived (`gradePlans === undefined`) | MyPlans.jsx:1090–1100 | PARTIAL | index.jsx:373 | — | `plansBySG[key]` is `{}` (not `undefined`) when there is no device copy, so a bound section on a fresh phone flashes "Pick a chapter to begin" until `/plans` lands — the very defect the web fixed on 2026-09-14 by copying the phone's earlier design. Re-introduce a `null` listing state. |
| B22 | st-new card: muted tag, kicker (subject unless banded), "Pick a chapter to begin", `+` "Attach a lesson to this section", history glyph | MyPlans.jsx:1104–1133 | PARTIAL | index.jsx:512–526 | — | Banding landed 2026-09-16 (B11) — the card drops its kicker entirely inside a band, as the web does. Still missing the history glyph (B20). |
| B23 | Bound card: tag, kicker "{Subject} · Ch N", title, `YearStamp`, unit rail (done pine / cur ochre / rest `--card-tick`), tap → open lesson with tracking | MyPlans.jsx:1145–1171 | PARTIAL | index.jsx:409–434 | `sc_yearstamp` | YearStamp under the title is MISSING on the section card (phone has it only on My Lessons' cards). |
| B24 | Right slot — done: "Complete" + `+` "Finish with this chapter and track the next" + history; going: `−` "Stop tracking this chapter" + history | MyPlans.jsx:1176–1197 | PARTIAL | index.jsx:435–446 | — | Actions DONE (split press target, named divergence); history glyph missing. |
| B25 | Card tap target = whole card; buttons `stopPropagation` | MyPlans.jsx:1148, 1182, 1191 | DONE (named divergence: tag+body only) | index.jsx:402–415 | — | — |
| B26 | Temporary foot: entitlement status line + Auto/Light/Dark segments | — | (phone-only, transitional) | index.jsx:269–286 | Settings (step 6) | Not on the web's My Classes; remove when Settings lands. |

### C. My Lessons (MyLessonPlans.jsx)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| C1 | Remembered Subject/Class per user (`mylessons_subject`/`mylessons_class`) with profile-validated fallback | MyLessonPlans.jsx:283–308, 378–394 | DONE | lessons.jsx:115–116, 205–220 | `userKey`, `storage` | — |
| C2 | Pane state not persisted; `paneIntent` one-shot (budget pencil round trip returns to Year plan) | MyLessonPlans.jsx:334–337 | PARTIAL | lessons.jsx:140 | E7 | Pane logic DONE; the one exception waits on the pencil. |
| C3 | Follow the lesson being prepared (steer subject/class, view active, pane lessons) | MyLessonPlans.jsx:349–359 | DONE | lessons.jsx:154–165 | `lib/preparing` | — |
| C4 | `onScope` — report settled subject·class up for the "check your set-up" second moment | MyLessonPlans.jsx:406–412 | MISSING | — | ProfilePortal + page-level queue (`queueSetupCheck`/`takeSetupCheck`, page.jsx:210–260) | Belongs to the ProfilePortal family; noted here because the hook fires from this screen. |
| C5 | Refetch on prepare completion (`plansNonce`; failed prepare skipped) | MyLessonPlans.jsx:425–461 | DONE | lessons.jsx:258–268 | — | — |
| C6 | Shared-store fetch + `notePlansYear(current_year)` | MyLessonPlans.jsx:449–461 | PARTIAL | lessons.jsx:236–243 | B8 | `notePlansYear` not called (header 41–42 says so). |
| C7 | Section-state reconcile (mount / visibility / focus / 20 s), skipped while a plan is open | MyLessonPlans.jsx:472–495 | DONE | lessons.jsx:274–293 | AppState | — |
| C8 | `openLesson` → read-only LessonView `preview` | MyLessonPlans.jsx:507–516, 721–726 | DONE | lessons.jsx:306–309 | `/lesson` route w/o `section` | — |
| C9 | Prior-year folders state (`openPrior` always starts closed, re-closes on scope change) + lazy fetch filtered to `prepared && !in this year` | MyLessonPlans.jsx:317–318, 522–550 | DEFERRED (lessons.jsx:39–42) | — | `yearInfo.prior_years` (B8), `GET /plans/{s}/{g}?year_id=` | — |
| C10 | Tour steps 3–7 orchestration, `tourPlanOf`, `data-tour="lesson-first"` | MyLessonPlans.jsx:558–567, 592–598, 949 | NOT-PORTED-BY-DECISION | — | GuidedTour | — |
| C11 | `statusFor` / `isAttached` | MyLessonPlans.jsx:570–586 | DONE | lessons.jsx:313–329 | — | — |
| C12 | Archive / restore: optimistic flag, `verifiedWrite` vs `GET /plan-archive`, `POST`/`DELETE /plan-archive`, invalidate after settle, mismatch revert + toast | MyLessonPlans.jsx:602–676 | DONE | lessons.jsx:331–396 | `verify.js` | — |
| C13 | Toasts "Moved to Archive — find it in the box above." / "Restored to your lessons." / "That didn't archive — it's still in your lessons." / "That didn't restore — it's still archived."; 3.2 s auto-dismiss | MyLessonPlans.jsx:644–683, 1106–1108 | DONE | lessons.jsx:369–402, 664–672 | `mlp2_toast` | Phone positions it above the bottom bar (56.85 + inset). |
| C14 | `--mlp2-frozen-h` publish for YearPlan sticky head | MyLessonPlans.jsx:688–697 | WEB-ONLY-BY-NATURE | — | — | RN has no sticky-within-child; YearPlan header travels (named in YearPlan.jsx:150–153). |
| C15 | Spinner "Opening plan…" | MyLessonPlans.jsx:720 | WEB-ONLY-BY-NATURE | — | — | Route owns it. |
| C16 | "No subjects set up yet. Finish setup in My Classes to see your lessons here." (`.mlp-empty`) | MyLessonPlans.jsx:728–730 | DONE (+ "not asked yet" guard, + error line) | lessons.jsx:485–496 | `mlp2_emptybody` | Phone adds "Couldn't reach Meyy right now." and "Loading your lessons…" — capability, fine. |
| C17 | `prepareCTA` hidden when `lapsed` | MyLessonPlans.jsx:739–746 | PARTIAL | lessons.jsx:631–643 | `fetchEntitlement` → `lapsed` (page.jsx `entLapsed`) | Phone shows the bar for everyone; needs the entitlement read on this screen (or a shared entitlement store). |
| C18 | `byRecency` + this-year filter + active/archived split + `effView` fallback | MyLessonPlans.jsx:766–799 | DONE | lessons.jsx:419–432 | — | — |
| C19 | Proposed-card dedupe (`matchIdx` on chapter + `matrixLabel`), hoist busy card to head | MyLessonPlans.jsx:804–835 | DONE | lessons.jsx:444–462 | `ProposedCard.matrixLabel` | — |
| C20 | Frozen header — paired switch "Your lessons" (reads "Archive" when inside) / `/` / "Year plan", clay rule on the live word | MyLessonPlans.jsx:857–873 | DONE | lessons.jsx:522–535 | `mlp2_vtab*`, `mlp2_vsep` | — |
| C21 | Archive box (closed: ArchiveIcon + count, "Open archive (n)"; open: OpenArchiveIcon + count, "Close archive, back to your lessons"), only on lessons pane | MyLessonPlans.jsx:876–890 | DONE | lessons.jsx:539–553 | `mlp2_archfolder`, `mlp2_archcount` | Phone tints the open state (pine border/tint) — check against `.mlp2-archfolder.open` on the web. |
| C22 | Subject wheel (`RollWheel large rowPx=72 fit peek`, TWAU label, A–Z) or static box; Class wheel or "Class {n}" static; 2:1 columns | MyLessonPlans.jsx:892–907 | DONE | lessons.jsx:559–585 | `RollWheel`, `mlp2_wcol_s/g`, `mlp2_static*` | `large`/`fit` map to `adjustsFontSizeToFit`; `padLeft` is a phone-side tuning. |
| C23 | Year plan pane mount with `onEditBudget` bound to display name + Roman class | MyLessonPlans.jsx:910–917 | PARTIAL | lessons.jsx:602 | E7 | `onEditBudget` not passed (prop accepted by mobile YearPlan). |
| C24 | "Loading plans…" / empty copy ×3 ("Nothing archived here." / "Every prepared lesson for {S} · Class {n} is archived." / "There are no lesson plans prepared for {S} · Class {n} yet.") | MyLessonPlans.jsx:920–929 | DONE | lessons.jsx:603–612 | `mlp2_loading`, `mlp2_emptybody` | — |
| C25 | `ProposedCard` first in the list (busy / failed with Dismiss) | MyLessonPlans.jsx:240–278, 935 | DONE (named divergence: Animated bar) | ProposedCard.jsx; lessons.jsx:618–620 | `lib/preparing`, `sc_prep*` | Web's `title` attr with the full failure sentence has no touch equivalent (clamped to two lines on both). |
| C26 | Lesson card: `sc-tag` NN, title (2-line clamp), meta row (duration_label + `YearStamp`), status: busy bar / "Archived" / "Completed 6A, 6C · Teaching now 6B" / "Ready to teach"; plane `card_doc`, spine sage/pine/clay | MyLessonPlans.jsx:947–994 | DONE | lessons.jsx:691–759 | `sc_metarow`, `sc_yearstamp`, `mlp2_status*`, `mlp2_ready`, `mlp2_cardpad` | — |
| C27 | Card tap → open; `aria-busy` on the re-preparing card; not tappable while busy | MyLessonPlans.jsx:947–948 | DONE (split press target, named) | lessons.jsx:709–711 | — | — |
| C28 | Archive icon button top-right (only when not attached), `aria-label="Archive {title}"`, tour anchor `lesson-archive` | MyLessonPlans.jsx:1002–1008 | DONE (anchor n/a) | lessons.jsx:767–772 | `mlp2_iconbtn` | — |
| C29 | "Restore" button on archived cards | MyLessonPlans.jsx:995–997 | DONE | lessons.jsx:761–766 | `mlp2_restore*` | — |
| C30 | `ReportButton` (`.sc-report`, bottom-right, `ReportIcon`, "Create a report"), tour anchor `lesson-report` | MyLessonPlans.jsx:201–212, 1009–1010 | DEFERRED (lessons.jsx:35–38) | — | D-cluster below; style `sc_report`; the card already reserves the column (`mlp2_cardpad`) | — |
| C31 | REPORTS modal chrome: `.rpt-overlay/.rpt-modal`, title "Reports", ✕, sub "Create a report of this lesson or its assessment." | MyLessonPlans.jsx:146–152 | DEFERRED | — | `Sheet` can host it; styles `rpt_*` (none in web.js) | — |
| C32 | Composition options (single-select, `.rpt-opt` + `.rpt-radio`): "Lesson Plan — Teaching plan, activities, steps and resources" (default) · "Assessment — Questions and instructions" · "Lesson Plan + Assessment — Teaching plan together with assessment" | MyLessonPlans.jsx:92–96, 154–180 | DEFERRED | — | — | — |
| C33 | "Include answers / model responses" checkbox inside the chosen box, only for assessment/integrated, default off (`answers=1`) | MyLessonPlans.jsx:168–176 | DEFERRED | — | — | — |
| C34 | Format: "PDF" (default) / "Word" (`.rpt-fmt-btn`) | MyLessonPlans.jsx:182–186 | DEFERRED | — | — | — |
| C35 | Footer "Cancel" / "Download PDF|Word" (busy "Preparing…") | MyLessonPlans.jsx:188–193 | DEFERRED | — | — | — |
| C36 | Download: `GET /api/plans/{s}/{g}/{filename}/export/{lesson|assessment|integrated}?format={pdf|docx}[&answers=1]` with `X-Aruvi-User`; blob → `<a download>`; filename from `Content-Disposition` else `report.pdf`/`report.docx`; `alert("Couldn't create the report.\n\n{msg}")` on failure | MyLessonPlans.jsx:112–143 | DEFERRED | — | expo-file-system (`downloadAsync` / `writeAsStringAsync` base64 to cacheDirectory) + expo-sharing (`shareAsync` with `mimeType` application/pdf or application/vnd.openxmlformats-officedocument.wordprocessingml.document); the shared `withUser` headers; founder decision on landing (share sheet vs Files) | Native answer is the share sheet (capability the phone adds). `alert` → a `Sheet` or toast. |
| C37 | `.mlp-prior` folders below the CTA: head (▸/▾, `{yid}`, "lessons you prepared last year"), "Loading…" / "No lessons were prepared for this class in {yid}.", cards on the shelf state with `YearStamp year={yid}`, tap → read-only open | MyLessonPlans.jsx:1028–1073 | DEFERRED (lessons.jsx:39–42) | — | C9; styles `mlp_prior*` | Cards reuse `PlanCard` in shelf state (no status line). |
| C38 | `prepareCTA` bar: "Need a chapter you don't have yet?" + `Prepare a new lesson →` → `onAllocate(sSlug,gSlug)` | MyLessonPlans.jsx:739–746, 1019 | DONE | lessons.jsx:637–643 | `PrepareCta size="allocate"` | — |
| C39 | Paywall window ("Your free chapters are used up" + server sentence) | (page.jsx `onPaywall`) | DONE (phone hosts it here) | lessons.jsx:651–660 | `lib/preparing.paywall` | Web's window lives in page.jsx (Subscribe button below it); phone has only "Close" — subscribe not ported by decision. |
| C40 | Tour offer nudge below the list (lessons pane, not archived): "→", "Let me show you around first", "…Your lesson stays here in My Lessons…" | MyLessonPlans.jsx:1082–1102 | NOT-PORTED-BY-DECISION | — | GuidedTour | Twin of B10. |
| C41 | Pull-to-refresh (readiness force + plans force) | — | DONE (phone capability) | lessons.jsx:594–599 | — | — |
| C42 | `onOpenSection` prop | page.jsx:1288 | WEB-ONLY-BY-NATURE (dead prop) | — | — | Passed by page.jsx, never destructured in MyLessonPlans — dead on the web. |

### D. Prepare a lesson (PrepareLesson.jsx · GenerateTab.jsx · ViewModelView.jsx)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| D1 | GenerateTab `!ready` gate ("Preparing lessons unlocks after setup", "Finish setup →") | GenerateTab.jsx:29–41 | NOT-PORTED-BY-DECISION (dead) | — | — | Unreachable: page.jsx:1081 renders FirstRun for `!ready`. |
| D2 | GenerateTab `mode:"pick"` subject → grade picker (`.gpick`: "Prepare a lesson · choose what to plan", "Which subject do you want to plan for?", "{n} grades", "For which grade do you want to plan?", "Class {n}", "{n} sections", "← choose a different subject", single-grade auto-enter) | GenerateTab.jsx:44–103 | NOT-PORTED-BY-DECISION (dead in practice) | — | — | Every live caller passes subject+grade (`onAllocateScoped` page.jsx:509–515; the picker footer MyPlans.jsx:700); `mode:"pick"` (page.jsx:538) fires only for a multi-class teacher entering with no scope, which no surface does. Phone's `/prepare` takes `subject`/`grade` params — equivalent to `scoped`. |
| D3 | `ViewModelView` — old whole-document renderer (Group/PeriodCard/QItem, `dangerouslySetInnerHTML` for svg stimuli) | ViewModelView.jsx:1–156 | NOT-PORTED-BY-DECISION (dead in practice) | — | — | Only import is PrepareLesson.jsx:7, rendered in the `preview` step (447–452), which runs only when `onPrepared` is absent — page.jsx always passes it. Named on the phone as "NO PREVIEW STEP" (prepare.jsx:46–49). |
| D4 | Fallback in-place `prep-wait` card (attach path: `onPreparing` returns false) | PrepareLesson.jsx:423–442 | DEFERRED (with A9/D12) | — | A9 | On the phone this path does not exist yet; when the section-return lands, decide whether it keeps the web's in-place wait (web rule) or reuses the proposed card on My Classes. |
| D5 | Loads: `/subjects/{s}/{g}/chapters` (drop `placeholder`), plans via shared store, `/genon/{s}/{g}/chapters` (`chapters`, `canonical_minutes`, `canonical_periods`), `fetchEntitlement` | PrepareLesson.jsx:45, 95–109 | DONE | prepare.jsx:103–129 | — | — |
| D6 | `classProfile` / `seedRows` / `annualBudget` / `sumW` / `sugByChapter` / `suggestionFor` / seed-on-pick | PrepareLesson.jsx:123–222 | DONE | prepare.jsx:135–206 | `largestRemainder`, `annualBudgetPeriods` | Arithmetic identical. |
| D7 | `attachedFiles` from bindings, `committed` (newest per chapter), `chosenAlreadyPrepared`, totals | PrepareLesson.jsx:238–294 | DONE | prepare.jsx:224–268 | `readLocalSection` | — |
| D8 | `runGenerate`: descriptor → hand off → `POST /genon/{s}/{g}/{ch}/plan {rows}` → `verifiedWrite` vs `GET /plans-prepared` → 5 s hold unless `already_yours` → resolve | PrepareLesson.jsx:325–404 | DONE | prepare.jsx:276–340 | `lib/preparing` | — |
| D9 | Verify MISMATCH surfaces on the card she is watching: `onPrepareError(descriptor, "The lesson was built but didn't reach your lessons — please prepare it again.")` | PrepareLesson.jsx:363–371 | PARTIAL (bug) | prepare.jsx:308–316 | `failPreparing` | Phone calls `setError(...)` on a screen it has already navigated away from (`router.navigate("/lessons")` pops `/prepare`), so the sentence is lost — the same ARV-D-087 shape the web fixed. Should call `failPreparing(msg)`. |
| D10 | Error routing: 402 → paywall window; else failed card; inline `setError` for the mounted case | PrepareLesson.jsx:387–398 | DONE | prepare.jsx:324–336 | — | — |
| D11 | "No underlying chapter yet." when no canonical; "Add at least one duration row." | PrepareLesson.jsx:332, 419 | DONE | prepare.jsx:283, 288 | — | — |
| D12 | Return-with-section: `returnSection` → `prepareReturn` → `onPrepared` → `pendingAttach` → My Classes | page.jsx:540–565 | DEFERRED | — | A9 | See A9/B17. |
| D13 | Header "Prepare a lesson plan" + "← back" → My Lessons (`onBack`=goLessons) | PrepareLesson.jsx:461–473 | DONE | prepare.jsx:364–374 | — | — |
| D14 | Scope kicker "{Subject} · Class {n}", instruction "Pick one chapter and enter the periods you plan to spend teaching it." | PrepareLesson.jsx:474–477 | DONE | prepare.jsx:375–378 | `prep_scope`, `prep_instr` | — |
| D15 | Trial note "{used} of {cap} free chapters used. Regenerating same chapter allowed." (enforced ∧ trial ∧ used>0) | PrepareLesson.jsx:482–488 | DONE | prepare.jsx:385–391 | `trial_note` | — |
| D16 | "No chapter mappings for this subject & grade yet." | PrepareLesson.jsx:490–491 | DONE | prepare.jsx:393–394 | `empty` | — |
| D17 | Chapter `RollWheel` (rowPx 92, chip = number), clears error on change | PrepareLesson.jsx:497–499 | DONE | prepare.jsx:400–402 | `RollWheel` base mode, `clamp={2}` | Web's keyboard stepping is WEB-ONLY-BY-NATURE (RollWheel.jsx header). |
| D18 | "Periods for this chapter" stepper (– / number input / +), `mixLabel` small print | PrepareLesson.jsx:503–510 | DONE | prepare.jsx:406–426 | `prep_stepper`, `prep_step_*` | Phone adds `selectTextOnFocus` (capability). |
| D19 | Floor / surrender note (`.prep-floor`): "Above {top} periods, the extra {k} return(s) to your budget — this chapter's fullest plan uses {top}." / "Below {floor} periods the plan compresses; some sections may move to guided self-study — the plan still closes the chapter and names them." | PrepareLesson.jsx:511–557 | DONE | prepare.jsx:427–429, 581–605 | — | — |
| D20 | Suggestion box: "Suggestion", `i` button ("How the suggestion is made"), value, `✓` "matches the suggestion" / `use`, tip text | PrepareLesson.jsx:562–582 | DONE (named divergence: tip rendered under the columns, not a popover) | prepare.jsx:434–454, 486–494 | `prep_sugg*`, `prep_tip` | — |
| D21 | Budget box: "Total periods" (pine) / "Used ⓘ" button → breakdown (disabled when nothing committed) / "Available" (clay when over, `−n`) | PrepareLesson.jsx:584–601 | DONE | prepare.jsx:456–478 | `prep_brow*` | — |
| D22 | Chapter-step error line (`role=alert`) | PrepareLesson.jsx:612 | DONE | prepare.jsx:498–500 | — | — |
| D23 | Savebar: CTA "Prepare the lesson →" / "Prepare again →" / busy "Building the lesson…" + spinner; hints "Working on it…" / "Pick a chapter to continue." / "Already prepared — preparing again replaces the tracked version." | PrepareLesson.jsx:614–632 | DONE | prepare.jsx:502–515 | `PrepareCta size="primary"`, `prep_hint` | — |
| D24 | Re-prepare confirm: "Prepare this chapter again?", sub, "Cancel" / "Prepare again" | PrepareLesson.jsx:636–656 | DONE | prepare.jsx:521–536 | `Sheet confirm` | — |
| D25 | Committed breakdown: "Committed so far", sub, rows `Ch NN · title · n`, "Total committed — {n} periods" | PrepareLesson.jsx:658–682 | DONE | prepare.jsx:539–556 | `prep_brk*` | — |
| D26 | `inFlight` re-entry guard | PrepareLesson.jsx:91, 311–315 | DONE | prepare.jsx:98–101, 342–346 | — | — |
| D27 | Readiness fetched on the phone for `classProfile`/budget | — | DONE (route-level need) | prepare.jsx:83, 104 | shared readiness store | Web gets it as a prop. |

### E. Year Plan (YearPlan.jsx)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| E1 | Fetch chapters + plans; reset on scope change | YearPlan.jsx:102–117 | DONE | YearPlan.jsx(m):58–73 | — | — |
| E2 | Model: committed, budget fallback to `recSum`, `largestRemainder` suggestion, rows (`awaited` placeholders), totals | YearPlan.jsx:119–183 | DONE | YearPlan.jsx(m):75–127 | `annualBudgetPeriods`, `largestRemainder` | Web also computes `delta`, `left`, `pct`, `remaining` — unused in render; mobile drops them (no visible difference). |
| E3 | "Loading your year…" / "Couldn't load the year plan just now. Please try again." / "No chapters found for {subject}." | YearPlan.jsx:251–253 | DONE | YearPlan.jsx(m):129–137 | `yp_loading` | Web uses `.yp-empty` for the last two; mobile reuses `yp_loading` — measure `.yp-empty` if it differs. |
| E4 | `.yp-table` raised plane; sticky `.yp-head` under `--mlp2-frozen-h` | YearPlan.jsx:268–285 | DONE (named divergence: no sticky) | YearPlan.jsx(m):146–163 | — | — |
| E5 | Column header "Chapter" / "Suggested periods" / "Your\nplan"; rows NN · title · sug (— when null) · plan (`—` awaited · number · "set" · `—` + "not yet") | YearPlan.jsx:280–309 | DONE | YearPlan.jsx(m):159–192 | `yp_*` | — |
| E6 | Totals row "Total periods" + sug total + plan total, hairline below | YearPlan.jsx:312–347 | DONE (label plain) | YearPlan.jsx(m):196–200 | — | — |
| E7 | Budget PENCIL on the totals row ("Change your annual periods", aria "Change your annual period budget for {subject}") → `onEditBudget` → page.jsx `onEditYearBudget(subjectName, grade)` → TeachingProfile `editNums` budget step with `exact` portal scope, `paneIntent="plan"` on return | YearPlan.jsx:331–337; page.jsx:1034–1042 | DEFERRED (YearPlan.jsx(m):26–29) | prop accepted at (m):47 | Either the TeachingProfile port (Track D "FirstRun → PrepareLesson → profile") OR a lightweight budget sheet: `budget.gradeBudgetRecord`/`setGradeBudget` (shared, exists) + `POST /readiness {subjects}` + `invalidateReadiness()`; then `paneIntent` (C2); style `yp_budget_edit` | Mobile YearPlan already threads the prop; lessons.jsx:602 must pass it. |
| E8 | Word EXPORT icon (`ExportIcon`, "Download this table as a Word document") → `POST /api/year-plan/export-docx` body `{subject: displayName, grade: gSlug, budget, generated_at, rows:[{n,title,sug,plan,prepared,awaited}], sug_total, plan_total}`; filename from `Content-Disposition` else `year-plan-{s}-{g}.docx` | YearPlan.jsx:194–249, 338–343 | DEFERRED (YearPlan.jsx(m):30–33) | — | expo-file-system + expo-sharing (as C36); `withUser`; style `yp_export_btn` | Same native answer as the Reports modal — build the download helper once (`lib/download.js`: fetch → base64 → cache file → `Sharing.shareAsync`). |
| E9 | Export status line: "Preparing your Word document…" / "Couldn't download the year plan. {reason} Tap the arrow to try again." with 404 → "This Meyy server doesn't have the export yet.", 501 → "Word export isn't available on this server.", network → "Couldn't reach Meyy just now.", else "{status} — {detail}" | YearPlan.jsx:212–247, 354–360 | DEFERRED | — | E8; style `yp_export_msg` | Carry the four-way wording verbatim. |
| E10 | `.yp-note` prose (budget bolded, "Suggested periods", "Your plan", Ask Meyy pointer) | YearPlan.jsx:369–378 | DONE | YearPlan.jsx(m):207–213 | `yp_note`, `yp_note_b` | — |
| E11 | `onAllocate` prop | YearPlan.jsx:75 | WEB-ONLY-BY-NATURE (unused) | — | — | Passed by MyLessonPlans:912, never used inside YearPlan. |

### R. Readiness.jsx

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| R1 | Legacy 6-step readiness wizard (subjects → grades → sections → durations → weekly GRID → budget) | Readiness.jsx:97–627 (+ `MultiDropdown` 629, `PagedDropdown` 669, `PickList` 707, `StepProgress` 733) | NOT-PORTED-BY-DECISION (dead code) | — | — | Evidence: the only importer is MyPlans.jsx:7, rendered at MyPlans.jsx:451 solely under `if (!ready)`; page.jsx:1081 `if (!ready || firstGenNeeded) return <FirstRun …/>` runs before `<MyPlans/>` is ever reached, so `ready` is always true inside MyPlans. FirstRun.jsx/TeachingProfile.jsx mention it only in comments. Its weekly-grid step is also the thing the 2026-07-02 calendar purge retired. Treat like Allocate/MyCalendar: on disk, not part of the product. |

## Dependency notes

**Must land before this family is complete on the phone**
- **The academic-year record on the phone** — one read of `GET /academic-year` (`{current_year, prior_years[], cleanup_due|cutover_due}`) kept in a module store on the `(app)` layout, re-read on AppState-active, cleared on sign-out. It unblocks A3, B8, B9, B16, C6, C9, C37 and the `YearStamp` on section cards (B23). `POST /academic-year/cutover {confirm:true}` + `clearLocalSectionCache` + `clearLocalHistoryCache` + `clearPlans` for B8.
- **A native download/share helper** (expo-file-system + expo-sharing, one `lib/download.js`) — unblocks the Reports modal (C30–C36) and the Year Plan export (E8–E9). Founder decision needed on the landing (share sheet is the natural phone answer).
- **Section history on the phone** — `pullSectionHistory` wired into the My Classes reconcile (A6), then the glyph (B20) and popup (B19). No new backend; shared helpers exist.
- **The return-with-section path** (A9/D12) — `/prepare` gains a `section` param; on success bind + invalidate in the closure and navigate to `/`; then the picker footer (B17) and the web's "or build a new one" copy (B13).
- **Budget writer for the pencil** (E7) — either the TeachingProfile port or a minimal budget `Sheet` over `@aruvi/shared/budget` + `POST /readiness`; plus the `paneIntent` return (C2).
- **Entitlement on My Lessons** (C17) — a `lapsed` read (shared entitlement store) to hide the prepare bar.
- ~~**Subject bands** (B11) — pure port, measure `.sc-band-hd` into web.js.~~ DONE 2026-09-16, with B11a (the named-section tag) alongside it.
- **Small guards**: `undefined`-vs-`{}` listing state on My Classes/AttachSheet (B14, B21); AppState + 20 s re-pull with the modal-open hold (A4/A5); `bindingsKnown` (A7); `failPreparing` on verify mismatch (D9).
- **web.js measures owed**: `sc_hist`, `ch_row`/`ch_pill` (3 states)/`ch_rail`, `ap_prior*`, `ap_loading`, `mlp_prior*`, `dash_welcome` box, `dash_nudge*`/`yr_nudge*`/`yr_x`, `rpt_*`, `sc_report`, `yp_budget_edit`/`yp_export_btn`/`yp_export_msg`, `yp_empty`.

**What this family unlocks**
- Cutover on the phone makes the year boundary consistent across devices (today a web cutover leaves the phone reading stale year-scoped flags until sign-out).
- The download helper is shared by every export in the product (LP/assessment reports, year plan, later data-rights export).
- The section-return path is the last piece of the web's "+" loop (card → picker → prepare → card).

## Open questions for the founder
1. **Where does a downloaded document land on the phone** — the iOS/Android share sheet (open in Files / WhatsApp / mail) or a silent save to Files? Both the Reports modal and the Year Plan export wait on this one answer.
2. **Section-return wait**: on the web the prepare-from-a-card path deliberately keeps the in-place wait on the Prepare screen (no proposed card, because it lands on My Classes). On the phone, should that path (a) keep the web's in-place wait, or (b) land on My Classes with the new chapter already bound after the 5 s beat? (b) is one screen fewer but diverges from the web.
3. **Year Plan pencil**: acceptable to ship a minimal budget sheet on the phone before the full TeachingProfile port, or must it wait so both surfaces route through the same profile screen?
4. **Cutover offer on the phone**: the web re-offers on every sign-in until she acts (session-only dismiss). On a phone the app is rarely "signed in again" — should the dismissal be per app-launch, per day, or as the web (never persisted)?
