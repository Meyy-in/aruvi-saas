# Track D implementation map — from step 5c to full migration

> **How this document is maintained.** It is the live tracker, not a snapshot: §0 carries what has landed
> and its commit, each step in §2 is marked DONE/IN PROGRESS as it goes, and §4's questions are struck
> through with their answers rather than deleted. **Update it in the same commit as the work** — a plan
> that has to be reconstructed afterwards is a plan nobody trusts. Where the build DIVERGED from what was
> planned here, say so and say why: those notes are the most useful lines in the file.

*Drawn 2026-09-15 against the repo as it stands on the Mac (HEAD `e8f91436`, plus the uncommitted step-5c
files: `packages/shared/src/budget.js`, `packages/shared/test/budget.test.js`, `web/app/lib/budget.js`,
and the 63-line trim of `TeachingProfile.jsx`). Companion to `docs/mobile_migration_plan.md` §2 Track D
(the history — what landed, step by step) — this document is the FORWARD plan: every web feature and UI
element the phone still owes, line-referenced, in dependency order.*

**The six appendices are the line-by-line inventories.** Each walks one screen family top to bottom in the
web's JSX order and gives every element a status against its mobile counterpart, with `file:lines` on both
sides, the strings verbatim, the endpoint, the shared helper, and the `theme/web.js` key it needs:

| Appendix | Family | Rows | DONE | PARTIAL | MISSING | DEFERRED | Not ported |
|---|---|---|---|---|---|---|---|
| `mobile_implementation_map/01-shell.md` | page.jsx shell · layout · GuidedTour · ProfilePortal | 118 | 19 | 16 | 43 | 8 (tour — now SCHEDULED, step 8b) | 4 |
| `mobile_implementation_map/02-profile.md` | TeachingProfile · wheels · shared budget | 97 | 14 | 5 | 70 | 3 | 3 |
| `mobile_implementation_map/03-firstrun-login.md` | Login · PrivacyNotice · Agreement · FirstRun | 122 | 37 | 20 | 44 | 2 | 16 |
| `mobile_implementation_map/04-settings-askmeyy.md` | Settings (7 subviews) · Ask Meyy · Dropdown | 120 | 12 | 10 | 91 | 1 | 3 |
| `mobile_implementation_map/05-lists-prepare.md` | My Classes · My Lessons · Prepare · Year Plan | 125 | 66 | 15 | 10 | 18 | 10 |
| `mobile_implementation_map/06-lessonview.md` | LessonView · ChapterOrg · Assess · Bookmark · Notes | 140 | 100 | 20 | 4 | 1 | 1 |

Status vocabulary (used identically in every appendix): **DONE** · **PARTIAL** · **MISSING** · **DEFERRED**
(named in a component header or the plan, with its reason) · **NOT-PORTED-BY-DECISION** (SubscribeFlow,
dead web code — ⚠️ the TOUR rows still carry these two labels throughout app. 01 and app. 05; they were
written while it was deferred and are a BUILD SPEC as of 2026-09-15, see step 8b) · **WEB-ONLY-BY-NATURE** (keyboard, `window`, measured CSS vars — no phone counterpart is
owed) · **PARITY-CHECK OWED** (a web class with no `web.js` key yet).

---

## 0. Where we are

*Kept current as work lands (founder, 2026-09-15: "keep updating the map about the progress so that it is
tracked"). Every step below carries its commit; a step is only moved to DONE once it has been walked, and the
walk says on WHICH surface — the two are not interchangeable (see the 2026-09-15 iOS entry).*

**Committed and verified on the phone:** steps 1 (shared package), 2 (scaffold + Login/OTP), 3 (LessonView),
4a (My Classes "+" binding), 4b (My Lessons library + Year Plan read), 5a (Prepare), 5b (proposed card +
the wait moves to My Lessons), the bottom bar, the org-page-until-taught rule, the parity checker.

**Landed 2026-09-15 — foundations F1, F2, F4, F8 and the numbers editor.**

| | What | Commit | Walked on |
|---|---|---|---|
| — | Two crashes opening a lesson: a hook below an early return (web) and a const read from a dep array before it existed (phone) | `ed8fc93d` | both |
| **F1** | `shared/readiness.saveReadiness()` — the one way a profile is written; the read-after-write doctrine and its three outcomes. **And the annual budget JOINED `readinessFingerprint`** — it was excluded as "derived", which stopped being true the day an editor changed only it, so a dropped year read back as verified | `7593264f` | 17 tests |
| **F2** | `shared/ppw.js` (the weekly split, lifted from `wheels.jsx`) and `shared/profile.js` (the draft ⇄ record family, from `TeachingProfile.jsx`); `rekeyBudget` → `budget.js` | `1786523a` | web + 25 tests |
| **F4** | `shared/account.js` — her NAME on the bar and in the greeting. Founder-reported: the phone was still calling her 9000000003 after she had subscribed and given her name | `eadaad65` | Expo + 10 tests |
| **F8** | `PickWheel` + `shared/pick.js` (the clustering rule, shared so the phone cannot approximate it) | `ceb3d742` | 12 tests |
| **5c/5d** | The numbers editor: `(app)/profile.jsx` with `budget` · `ppw` · `duration` intents, `PpwSplitCell`, `setGradeNumbers`, and **the Year Plan's budget pencil lit** | `ff8cf0c1` | Expo, end to end |
| — | "Total periods" vanished on iOS — `flex: 1` on a label that had stopped being the whole cell. ⚠️ Two earlier explanations (a zero flex-basis; a wrapper View breaking baseline alignment) were confidently wrong; the handset settled it | `f2dda0c0`, `+1` | iPhone (founder) ✅ |
| **F3·F7** | `shared/setupCheck.js` (the check-window queue, 11 tests) and `mobile/lib/portal.js` (origin route + the window to restore) | `65c1bf1d` | tests only — the web tab's session had expired; walk owed |
| **5d·2** | The **ProfilePortal window**, mounted in the layout above the BottomNav. **Q3 and Q4 answered**; Q4's stale "basket on the class" hint fixed on the WEB too | `fe818c73` | 🔴 unreachable — `onAdd` dark by design |
| **5d·4** | **Manage classes** — the class wheel, its removal confirm, and the cascade. The fourth of the window's rows, so **ADD went live** in the same commit | `9a1546ec` | Expo |
| — | **Every profile edit became a WINDOW, not a full screen, on BOTH surfaces** (founder: "the ADD opens a window but individual changes open full screen — suggest the changes also be contained in a window"). The web's spot edit renders BESIDE the tab content so the scrim has something to haze; the phone's `(app)/profile.jsx` route became `components/ProfileEditor.jsx`. `lib/paneIntent.js` was DELETED — the mechanism went away rather than gaining a case | `0e7227da` | web + Expo |
| — | The window's CORNERS do the navigating: ✕ top-right, ← only where a step has one. Bottom back buttons gone, and the height they cost with them | `2d7ac21d` | Expo |
| — | The section hint cut to one sentence (both surfaces); the Expo kicker's colour and its gap to the heading matched to the web | `522b377d` | web + Expo |
| — | The ✕ was untappable on the handset: the corners were painted BEFORE the ScrollView body, so a transparent scroller lay over them. Order, not `zIndex` (which needs `elevation` on Android). And `openEdit` was nulling the window `closeEdit` then tried to restore — `winBack` remembers it | `63adafaf` | iPhone (founder) |
| — | **ONE Sheet, whose children swap** (founder: "when ✕ is used to click off, it goes back to my classes for a moment before showing 'what would you like to change?' — that time gap should not be there"). The portal and the editor each owned a Modal, so moving between them unmounted one and mounted another: two fades back to back with NO scrim in the gap, and the bare screen flashed through. The state was already batched — the flash was the Modals. `ProfilePortal` and `ProfileEditor` are now body-only; the layout owns the Sheet and the editor reports its ← up through `onChrome` | `dac26eb0` | Expo, end to end |
| — | **What Meyy HAS and what she has BOUGHT are two different lists** (founder: "the web app only shows those classes that the teacher has subscribed for … but expo shows all classes"). `paidScopesOf` / `entLapsed` / `allowedStagesFor` lifted from `page.jsx` and `TeachingProfile.jsx` into `shared/format.js` (7 tests), and the phone's class wheel filters by them. 9000000003 was being offered Classes 6–9 she cannot buy from that screen; she now sees 3, 4, 5 and the subscription note, exactly as the web does | `dac26eb0` | Expo + 7 tests |
| — | The web's windowed steps still drew a bottom **Cancel** beside their Continue (founder, twice: periods-a-week, then the annual budget). The 2026-09-15 rule was right and its SELECTOR was short — `.tp > .fr-link` reached only direct children. Widened to the step's own `.fr-foot`, with `:not(.fr-center)` so the confirm blocks keep their "Keep it" | `dac26eb0` | ✅ web, walked — see the row below |
| — | **The wheels in the window would not turn on the handset** (founder: "the 'How many periods a week' window of Add button does not allow wheeling up and down the numbers. The arrow of course works"). The window's ground was a `Pressable` WRAPPING a `Pressable` card — outer closes, inner swallows — which puts a press responder directly above every scroller in the window, and on iOS a ScrollView inside a Pressable loses the drag. The arrows kept working because they are taps that commit the pick themselves, which is exactly what said the data was fine and the GESTURE was not. The scrim is now an absolutely-positioned Pressable UNDER the card and the card is a plain View; both tap behaviours are unchanged. ⚠️ NOT the ppw wheel's bug — every wheel in the window had it (RollWheel and PickWheel nest identically); the numbers step is just where a thumb rolls first, and the class/section wheels had only ever been walked on Expo, where react-native-web hands the DOM scroller the drag regardless. Phone-only: the web's overlay is a div whose click handler cannot block scrolling, so no web half is owed | *this commit* | 🟡 Expo web (opens · wheel rolls · scrim closes editor→portal and portal→away) — **iPhone walk owed, and it is the only surface that can sign this off** |
| — | **ONE WAIT, ON THE CARD THE LESSON IS FOR — on BOTH surfaces** (founder: "invoking 'prepare a lesson plan' from section card gives different experience from invoking it in Lesson plan and differently in web app and iphone … It should show progress on the section card from which it was generated and upon completion, settle in the section card with the new LP attached"). Three behaviours became one. **The web** waited on an otherwise-empty Generate screen and then attached; **the phone** showed a grey "generating" button and then reopened the picker. ★ **THIS OVERRULES THE WEB'S OWN 2026-08-06 EXCLUSION**, whose reasoning was that this path "lands in My Classes, not My Lessons, so there is nowhere to put this card" — that read the rule as being about MY LESSONS. It is not: the rule is that the wait happens **where the lesson will appear**, and launched from a section card that is THAT CARD. The premise was wrong, not the rule. Now on both: hand off immediately → the section card wears the chapter title and a progress bar (same fill, same height, dashed edge + clay spine as the only "not yet" signal — structure, never colour) → on success it settles **already attached**, because she opened the picker for that slot and has already answered the question. `ProposedCard`'s `bare` mode is reused on the phone and the web's `.sc-prep` markup on the web, so the two screens cannot drift in wording, timing or the failed row. The picker-reopen and `pendingAttach` store I had added hours earlier are GONE — the mechanism went away rather than gaining a case. ⚠️ `.sc-card.st-new.sc-proposed` re-asserts the card's own fill: `.sc-proposed` repaints to `--paper-2` for a DOCUMENT in My Lessons, and a CLASS card's fill is its status (the `.ap-row-line` source-order trap, fifth sighting) | *this commit* | 🟡 both render clean, no console errors. **The wait itself is UNWALKED on either surface** — it needs a real generation. ⚠️ **A real generation WAS run on 2026-09-16** (it is what walked the prepare steer and the "+" return leg), so this is now the cheapest confirm left on the board — it was simply not on the five-item list the founder walked |
| **5d·B17+A9** | **"PREPARE A NEW ONE" IS LIVE ON A SECTION CARD'S "+"** (founder: "My Class + allows generation from there in web app but not yet in expo/Iphone"). The destination has existed since step 5; what was missing was the RETURN, and `AttachSheet`'s own header said so. Both shipped together: the web's `.mlp-allocate` footer in the picker → `/prepare` carrying `section`+`tag` → **the in-place wait, which is the WEB's rule for this path** (page.jsx:578-586 excludes it from the My Lessons wait: "it lands in My Classes, so there is nowhere to put this card") → `pendingAttach` hands the section back across the route change → My Classes REOPENS the picker on that section, listing the new chapter. Reopens rather than auto-attaches, again the web's choice — she asked for a chapter to exist, not for it to be bound. ★ **Q16 answered by the web rather than asked**: its behaviour here is explicit and reasoned, and the phone matches by default. Cancel now returns her to My Classes too — a back hardcoded to `/lessons` stranded her with the slot still empty | *this commit* | ✅ **iPhone — founder, 2026-09-16** (walked with the five-item list: *"1-5 ran and looks fine"*) — **including the RETURN leg**, which also needed a real generation |
| — | ★ **THE BOOKMARK ON THE PHONE, SETTLED: PRESS → FRAME + HIGHLIGHT → SLIDE → LIFT** (founder, 2026-09-15: "after pressing the red button when it gets enclosed in that frame and highlights the current phase, enable holding it and moving up and down when the highlight also moves. Taking hand off the red button removes the frame and highlight and leaves it in the desired position. No need for that row that pops up how to use in the top"). A **named divergence** — the web keeps its pointer drag, because a mouse has no body and hides nothing. ★ **IT IS A DRAG, AND DRAGGING WAS NEVER THE PROBLEM.** Four attempts were needed to see that what had failed was not the gesture but BOTH of its feedback channels at once: her fingertip (~45px) covered the arrow (26px), so the thing she aimed with hid the thing she aimed at; and the spine scrolled under her, so the arrow appeared to drift. Fix those two and the gesture everyone already knows works fine. So **the HIGHLIGHT is the feedback** — the phase the arrow is over lights up, a whole row wide and nowhere near her thumb, and it FOLLOWS the arrow as she slides; the frame says the bookmark is in hand; the spine FREEZES for the length of the touch. ⚠️ **Feedback on touch-DOWN, never after a delay** — see the rejected hold below. ⚠️ Rows are inert (a tappable row is only a way to move this mark by accident mid-lesson, the one moment it must not move). ⚠️ No instruction banner: one explaining a gesture she is already performing arrives too late. ⚠️ The arrow keeps `left: -4` over the minutes column — no gutter is reserved for a touch that lasts a second. `onPanResponderTerminationRequest: () => false` is still what makes any of it work on iOS (row below) | `de4309e8` | ✅ **iPhone — founder, 2026-09-16** (walked with the five-item list: *"1-5 ran and looks fine"*) — **the fifth design is the right one.** Four attempts, and the one that worked left the gesture alone and repaired its feedback |
| — | ~~**THREE REJECTED BOOKMARK DESIGNS**~~ — *superseded within the hour by the row above; kept because the REASONING is why that one is shaped as it is.* **(1) Press-and-hold to lift** (280ms, then drag): "no..this is unnatural". A hold that must fire before anything happens reads as **the app not responding** — its own kind of unnatural, and the reason feedback now lands on touch-down. **(2) Press-then-place** (arrow becomes a button; press to arm, tap a phase to place): removed the gesture entirely and lit EVERY phase as a target. Founder: "highlights all of the phases and is not movable". Tinting every row is true and is also a wall of colour, and it leaves the one fact she needs — WHERE THE BOOKMARK IS NOW — with nothing to say it. ★ **The highlight marks the answer, not the question.** **(3) An instruction banner** ("TAP A PHASE TO MOVE THE BOOKMARK"), added when "not movable" was read as a discoverability problem: "No need for that row that pops up how to use in the top". ★ A mode nobody can read is a mode nobody can use — but the fix is feedback she can read, **not prose explaining a gesture she is already making**. Also from this stretch, worth keeping: a row that arms becomes a Pressable, which made the minutes cell a **button inside a button** (LessonView warns about this two screens down — RNW renders `accessibilityRole="button"` as a real `<button>`, and a nested one presses unreliably) | *superseded* | — |
| — | **THE CLAY RULE BETWEEN PHASES WAS A NEUTRAL HAIRLINE ON THE PHONE** (founder: "the clay thin separator line in web app for each phase is missing in expo/phone"). The web is `.uv-phase + .uv-phase { border-top: 1px solid var(--clay) }` — adjacent-sibling, so the rule falls only BETWEEN phases. The phone drew `line_soft`, its quiet neutral hairline. The GEOMETRY was right (a bottom border dropped on the last row renders identically); the COLOUR had drifted, and this is not a quiet rule — it is the one that says a phase has ended, and globals.css names it as the weight the bottom nav's own edge matches. One token. ⚠️ Fixed alongside: `uv_phase_arm_on` set `borderColor`, which would have repainted that clay rule pine for as long as a finger was down — it deepens the FILL only now | `10d0516b` | ✅ **iPhone — founder, 2026-09-16** (walked with the five-item list: *"1-5 ran and looks fine"*); Expo web too |
| — | **THE BOOKMARK WOULD NOT DRAG ON THE HANDSET** (founder: "bookmark moves in web app as well as expo but not in iphone"). `onPanResponderTerminationRequest` **defaults to TRUE** — "yes, you may take this touch from me". The bookmark lives inside a ScrollView, and on iOS that is a real UIScrollView: the moment the finger moves vertically it asks for the responder, the default says yes, and the drag ends before it starts. react-native-web's scroller never asks, which is why the web and the Expo web target both looked fine. Now it claims on capture and refuses to hand back (+ `onShouldBlockNativeResponder` for Android). ⚠️ **THE THIRD OF THIS EXACT FAMILY THIS SESSION** — the ✕ painted under a transparent scroller, the wheels losing their drag to a Pressable, and now this. On iOS a native container will take a JS gesture unless the gesture says no; react-native-web hands it over regardless, so the parity page CANNOT see any of them | `6c8f9f4a` | ✅ **iPhone — founder, 2026-09-16** (walked with the five-item list: *"1-5 ran and looks fine"*) — **reasoned for a day, then confirmed.** No surface in the sandbox has this bug; only the handset could close it |
| — | **A PREPARE NO LONGER LANDS IN THE WRONG SUBJECT'S LIST** (founder: "on iPhone, when lesson generation is initiated it defaults to pre-existing subject (English) list on My Lessons and remains there. I have to toggle to second subject to see if the LP is there"). The STEER was never missing — `lessons.jsx` has followed the descriptor's subject·class since 5b. What was missing was a wheel that would MOVE: `RollWheel`'s parking effect is keyed on `[items, rowPx]` and deliberately NOT on `value` (parking on value cancels the ▼'s own roll — its comment records that), so a value set from OUTSIDE left the box on English while the screen went to Mathematics; then the box's own settle timer read that stale offset, rounded it to English and committed it BACK. **The picture of the scope overwrote the scope.** Three fixes, all in `RollWheel`: a `mine` ref tells the wheel's own commits from everyone else's, so it can follow an external `value` without fighting its animation; a programmatic roll is authoritative until it ARRIVES (`pending` + a 700ms safety land), because `onScroll` fires mid-glide and the settle was committing the row it was travelling away from; and the loop branch now lands exactly on a row, which the non-loop branch has always done. Measured on the running app: a 72px wheel resting at **172** — between rows — about to commit the wrong one | *this commit* | ✅ **iPhone — founder, 2026-09-16** (walked with the five-item list: *"1-5 ran and looks fine"*) — the steer needed a **real generation** to prove, and got one |
| — | **THE ✕ GOT ITS OWN ROW, on both surfaces** (founder: "the 'how many periods a week?' window of the add button has its 'x' too close to top row. create an empty row above and place x at its right end … or better, put 'periods/week' in the second row as it is in the expo"). Measured on both running pages BEFORE changing anything, because the eye said Expo was fine and the numbers said otherwise: the ✕ occupies 13→43px from the card's top on each, and the kicker began at 29 on the web and 23 on Expo — **overlapping by 14px and 20px respectively**. So this was never a web-only defect and "as it is in the expo" was not a shape to copy; the phone only LOOKED better because `tp_kicker_pad` reserves 30px on the right, so its text can never run under the glyph even when its box does. Fixed at the one place each: `.tp-window-card .tp` padding-top 2 → 22, and `tp_kicker_pad` gains `paddingTop: 26`. Now a 6px gap on the web, the same on the phone. ⚠️ Costs 20-ish px of a card whose height is the standing problem — the trade was made knowingly, and there must be exactly ONE source of this gap (do not also margin the kicker) | *this commit* | web + Expo, measured |
| **5d·3** | **THE TWO PICK SCREENS** — "In which subject?" and "Which class?" (`components/ProfilePick.jsx`), the third body of the layout's one Sheet. Until now a portal row on a profile with more than one subject·class did NOTHING — deliberate and honest, and a dead end. The routing rule is `resolvePortalPick` in `@aruvi/shared` (9 tests) rather than JSX: it was spelled twice in the layout within twenty lines, and the two spellings have to agree or a screen shows with one row on it, or is skipped when two were owed. Both skips are the web's own — *a question with one possible answer is not a question* — so a one-subject-one-class teacher meets neither screen, exactly as before. ⚠️ Three things this turned up: **(a)** `portalGradeIdxs` had been lifted to shared by F2 and the web was STILL running a byte-identical copy — the precise drift CLAUDE.md §3 exists to stop; the web now delegates. **(b)** the portal row stamped an invented `exact: true` scope, which means "she is standing on it, do not ask" — true of the Year Plan pencil, false of a portal row, and wrong the moment a pick screen exists; it now carries the window's own scope. **(c)** the phone's manage-classes kicker read "English · Class 3 · classes", naming an arbitrary member of the set being edited — the web has always said `{subject} · classes`, and only a one-class teacher could reach it before | `670047e7` | ✅ **BOTH PICK SCREENS WALKED, Expo web, 2026-09-16** — with English now holding Class 3 AND Class 4: Add → Section → "In which subject?" (English · Mathematics, ✕ only) → English → **"Which class?" · Class 3 · Class 4**, ← top-left and ✕ top-right, and the ← returns to the subject question, where it correctly disappears. ⚠️ The stage-scope narrowing is still unwalkable on this profile — every class he teaches is preparatory |
| — | **The web grew the window's ← corner** — the last piece of "the corners do the navigating", which the phone got in `2d7ac21d` and the web did not. Hiding the footer links in the window took the duration step's `← Back` with them, and duration is the ONE step reached THROUGH another: inside the window her only two answers became Save (a write she may not want) or ✕ (abandon the lot). `TeachingProfile` now reports `{ onBack }` up through `onChrome` exactly as `ProfileEditor` does on the phone, `page.jsx` draws the corner it already drew the ✕ in, and `.ap-back` is `.ap-close` mirrored — the phone's `theme/web.js` geometry to the pixel (top 12, left 12, 30×30). `.tp-window-back` indents the kicker on that step alone | *this commit* | web, walked end to end |
| — | **MY CLASSES NOW BANDS BY SUBJECT ON THE PHONE, AND A NAMED SECTION READS THE WEB'S WAY** (founder, 2026-09-16: "the expo/iphone My classes shows all subjects in one list … also, the naming of sections is like 3A, 3B with nick name. When nick name is there only class 3 with nick name below"). Two rows of appendix 05, one of which the inventory never had. **(a) The bands** (B11, MISSING since the map was drawn, newly visible the day he began teaching two subjects): `ENGLISH` / `MATHEMATICS` mono kickers under a ledger hairline, and banded cards drop the subject from the kicker — "Ch 1", or NO kicker at all on an unattached card, because the subject is overhead and an empty line is all that would be left. Built by **adjacency**, the web's own choice: `classesFrom` already walks subjects → grades → sections in profile order, so nothing MOVES — a keyed map would silently reorder if that walk ever changed, where adjacency can only mis-SPLIT, which is visible. ONE card renderer serves both paths. **(b) The tag** (B11a, a row this inventory never had — the gap is why it was live): the phone had ported the nickname LINE in step 4 but not the rule above it, so a named section read "3A" over "Aruvi" where the web reads "3" over "Aruvi". ★ **The letter gives way to her word** — a teacher who calls that room "Aruvi" scans the list for "Aruvi", and two labels to find one card is exactly what the web's 2026-08-30 change removed. Display only: `sectionTag` is still the key behind every binding, pointer, bookmark and `sectionKey`. ⚠️ `sc_bands`/`sc_band_gap`/`sc_band_hd`/`sc_band_list` are NEW keys in `web.js`, so `useWebStyles`' `useMemo` cannot see them until a real app start — walked after a full reload for exactly that reason | *this commit* | 🟡 Expo web (both bands drawn, kickers correct, "3 / Aruvi" corner, no console errors) — **iPhone confirm owed** |
| **5d·10** | **THE CHECK-MOOD WINDOW — "would you like to check your set-up?", with its VALUES** (app. 01 rows 72-76). A subscriber who adds a subject or a class meets the same three assumptions Meyy made for her first class — a section, a periods-a-week, a year's total — so she is asked the same question about the new one, **at first USE and not at the moment she adds it** (§0's benefit-first rule: no configuration stacked on the screen where she was configuring). Three pieces: a **diff** over her profile in the layout (a subject·class key that appears where none was IS an add, whichever door it came through — including one made on the web); `noteLessonsScope` in `lib/portal`, which spends the queued key when My Lessons settles on that scope and opens the window **after a one-second beat** (opening in the same tick would land it on top of the selection she just made); and the window's own words. ★ **`setupCheckSub` and `setupCheckValues` were LIFTED to `@aruvi/shared/setupCheck` and the WEB NOW DELEGATES** — CLAUDE.md §3 and the `portalGradeIdxs` lesson: the rule about which value is safe to show is one rule, and the day two copies disagree, one window is inventing an answer about her record. They return PARTS, not a sentence, because the web bolds with `<b>` and a phone by naming a semibold face. ⚠️ Values are computed at RENDER, never frozen into the window: she changes her periods a week, the window comes back, and it must say the NEW figure. ⚠️ Check mood only — the "+" window is the whole profile, so "6, 7, 8" against Class would be noise on a row she is using to navigate. ⚠️ `subscribeReadiness` is NEW on the shared store: the web diffs in a `useEffect` because `readiness` is page state there; on the phone it is a module, so nothing re-renders on a write unless the store says so | *this commit* | 🟡 **Expo web, walked end to end** — a queued key raised the window over My Lessons after the beat, reading "You've added **Mathematics**. **Preparatory stage**." with 5 · 5B, 5C · 5 a week · 160 periods; ✕ closed it; two more wheel turns did NOT re-ask (asked once, ever) and the Add window still shows no values. No console errors. **iPhone confirm owed** |
| — | **THE LEGAL DOCUMENTS ARE THE WEB'S TYPE NOW** (founder, 2026-09-16: "privacy notice of expo/iphone to match font of web app"). `Markdown.jsx` was the last family still drawing from `theme/type`, whose `body` is **17px against the web's 13px prose** — so the whole notice rendered a third larger, every heading and kicker with it. ★ **And the difference COMPOUNDED**: `type.bodyStrong` states a SIZE as well as a face, so a bold phrase inside a paragraph grew mid-sentence — a nested Text that names a size stops inheriting the block it sits in. `lgl_b`/`lgl_i` now carry a FACE AND NOTHING ELSE. Measured off the running web at 390 by injecting the renderer's own markup (`.lgl-h2` · `.lgl-h3` · `.lgl-p` · `.lgl-ul li` · `.lgl-hr` · the stacked table's `tr`/`td`/`td::before` · `.lgl-version` · the framed `.ob-title` · `.lgl-fail`) and filed under `lgl_*`. ⚠️ `.ob-title` computes at weight 700 and the bundled Fraunces stops at 600 — the semibold cut is the heaviest we ship, and the same caveat now sits on three keys | *this commit* | ✅ **Expo web, measured against the web's own numbers**: paragraph Newsreader 13/22.1, heading Fraunces semibold 15.5/24.025, the stacked table's kicker in pine_d mono with its cell text at 13 and bold runs at the SAME size. No console errors |
| — | **THE ← IS THE JOURNEY'S, NOT ONLY THE SCREEN'S** (founder, 2026-09-16: "can we have back arrow for Add button not just for class but for subject, periods a week and annual period budget"). It was drawn only where a SCREEN knew of a step before it — the duration step, and the "Which class?" question — so every other destination arrived with ✕ as its only corner. And ✕ goes all the way back to the window's four rows: to fix the class she had just answered, she had to answer the subject again too. `openEdit` was DISCARDING the pick it came through; it now remembers it as `pickBack`, the same idiom as `winBack` a line along, and `editBackToPick` steps back one question with her answer still on it. ★ The two halves stay separate because they know different things: the EDITOR reports its own internal step (duration → periods a week) through `onChrome`, and the LAYOUT, which owns the journey, supplies the step behind that. ⚠️ No ← on the FIRST question ("In which subject?"): its one step back is the window, which is exactly where ✕ already goes from inside a journey — and two corners doing the same thing is what the 2026-09-15 corner rule removed. ⚠️ `hasBack` reaches the editor only so its kicker clears a corner the layout is drawing; the editor never navigates with it | *this commit* | ✅ **Expo web, walked all four rows**: Add → Periods a week → English → Class 3 → the editor now carries ← beside its ✕, and ← returns to "Which class?" with English still chosen, then to "In which subject?"; Mathematics (one class, both screens correctly skipped) lands in the editor and its ← returns to the subject question |
| — | **THE CHECK WINDOW NOW HAS A TRIGGER ON THE PHONE** (founder, 2026-09-16, walking his own first run: "the window that pops up after first run did not pop up … since the tour is not built in expo it should have come immediately when My Classes is chosen after first run"). On the web this window is raised by `finishTour` — Done and Skip alike. The phone has no tour until 8b, so **nothing raised it at all**: a teacher finished first run, met her first card, and was never shown what Meyy had ASSUMED for her — a section, a periods a week, a year's total — which is the entire reason the window exists. ★ **Q9's answer said the tour-end trigger "simply starts firing when 8b lands"; that left a hole nobody had looked through, and the founder walked straight into it.** First run now leaves a one-shot (`queueFirstRunCheck`) and My Classes spends it (`takeFirstRunCheck`) — **stored, not held in memory**, because she lands on My LESSONS (the lesson is the promise) and may close the app before she ever taps My Classes; a session flag would lose the question for good. On FOCUS, not on mount: the bar `navigate`s, which does not remount that screen. `raisePortalCheck` refuses to open over a window, an edit or a question she opened herself. ⚠️ **At 8b this becomes a SECOND trigger beside the tour's own — retire one, or she is asked twice** (the note is in `lib/firstRun.js` where whoever builds the tour will read it) | *this commit* | ✅ **Expo web, on his real first-run account (9000000002)**: My Classes shows the one card with the lesson attached, and a second later "Would you like to check your set-up? · Meyy started you off with **Section 3A** and its own suggested periods for the year", values Class 3 · Section 3A · 5 a week · 148 periods. The flag is spent — it cannot ask twice |
| **5e·front door** | **THE FRONT DOOR MATCHES THE WEB AGAIN** (app. 03 rows 4, 13, 17, 20, 27-29, 31, 36-38, 47; privacy 49-52, 56). Product copy had been DROPPED in the port rather than diverged from on purpose: the sign-in screen went straight to a bare input where the web opens by ASKING something. Restored — the `.ob-rule` hairline, the "Sign in" kicker and "Who's planning today?", the web's own field label and placeholder, "Enter →", the arrow on "New to Meyy? Get started →", and the trust line with the Privacy Notice link, which the web's DPDP reasoning puts on BOTH doors and the phone had only on the OTP screen. Dropped: a phone-only line with no counterpart and no founder note. ★ **And the three foot links became the web's `.fr-link`** (founder, 2026-09-16: "align look and font 'New to Meyy? Get started →' … with same in the web app"): they were 17px Newsreader with an UNDERLINE, where the web's are the house mono at 12px in pine, unadorned — the same control first run and the profile window use, which is why the front door read as a different product. Changed at the primitive (`components/ui.jsx` `Link`), whose only callers are those three feet. **Q21b** — `MOBILE_TAKEN`/`EMAIL_TAKEN` lifted to `@aruvi/shared/format`; the phone's own wording ("…Tap Sign in below.") is exactly what the web's comment had rejected, because she is at the CREATE door and whoever typed the number is not owed the news that it holds an account. **Q21a** — the create-path number locks once the code is in flight, now the rule on BOTH surfaces. ★ **AND A LOCKED FIELD NOW LOOKS LOCKED** (founder, 2026-09-16: "when mobile is entered and OTP is being asked, grey the mobile box — an empty fill gives the impression it can be changed"): the lock was real and INVISIBLE, the box still wearing the app's "type here" surface, so it invited a tap that did nothing. Sunk paper and soft ink on every read-only field, on both surfaces — nothing added, the affordance withdrawn. ⚠️ The CSS sits AFTER the field-bg rule it overrides (same specificity, source order decides — the `.ap-row-line` trap, sixth sighting), and the `:focus` half is load-bearing: a readonly input still takes focus, and `.login-field input:focus` would light it pine at the exact moment she taps it. The privacy screen became the web's LOCKED FRAME: Back at the top, above the title, in a pinned head (founder, 2026-09-04 — "the way out is visible from the first line"), where the phone had it at the foot of a long document | *this commit* | 🟡 Expo web: the sign-in screen and the privacy frame walked, version line and all; the greyed field measured on the web (sunk paper + soft ink against white + full ink) and **code-verified on the phone — its own OTP screen needs a real code sent, so the founder sees it at the next sign-in** |
| **5e** | **FIRST RUN, AND THE ACTIVATION GATE** — `app/first-run.jsx` (outside `(app)`, so Phase 1 stays shell-less: no bottom nav, and the bar carries her identity but **no gear**, founder Q). Welcome → Subject → Class → Chapter, the three-step rail, and then **no waiting screen at all**: the chapter CTA fires the serve and hands off in the SAME tick, the shell opens on My Lessons and the ORDINARY preparing card holds the wait — one wait, one place, learnt once. Ported whole: the `periodsTouched`/`durationTouched` refs with their DIFFERENT reset points (periods are per chapter, duration is a property of the class — the "it generated at the default" bug, where a late fetch turned 60×16 into 50×19); `pickChapter` setting the chapter and its estimate in ONE event so the estimate cannot trail the wheel by a frame; the calibrated `annual_budget_periods` seeding the budget and `ppwFromAnnual` deriving periods-a-week FROM IT rather than from the stored record (which is itself ppw×30 — a fixed point that justifies whatever it held); the subscribed-entry scope filter; the sanity band that stays SILENT while she sits on Meyy's own recommendation; the 0.6 coverage floor tested in PERIODS, not minutes; and the 5-second hold, never skipped, because on first run nothing can be already hers. **Q5 answered — the gate lives in `(app)/_layout.jsx`**, so a profile wiped mid-session re-routes instead of leaving her in a shell with nothing behind it; it paints from the device copy first and only a phone with nothing stored waits on paper. ⚠️ `hasActivated()` is what stops the BOUNCE: her profile is written through the store before she leaves, but the serve is still in flight, so "has she ever generated?" would truthfully answer no and send her back to the welcome screen seconds after her first success. ⚠️ `adoptReadiness` is NEW in `shared/readiness` — the optimistic half of the activation write, the phone's answer to the web's `setReadiness`; the verified write still runs behind it and still adopts the SERVER's copy on a mismatch. ⚠️ A 402 raises the paywall window rather than a failed card (prepare.jsx's rule; the web's first run has no such branch — app. 03 Q5 taken as recommended) | *this commit* | 🟡 Expo web, walked to the edge: welcome → subject → class ("We'll start you with **Section 3A**") → chapter with the two default boxes, their live tags, and the duration wheel opening in place; the gate verified from the other side — with the device copy DELETED the shell held on paper and landed in My Classes, never flashing first run at a veteran. **The handoff itself is UNWALKED and is the founder's to run**: it writes a real profile and spends a trial chapter, so it needs a fresh number |
| **6a·F10** | ★ **ONE BAR, IN THE SHELL — Q8 answered YES** (founder: *"yes agreed"*). Every route inside `(app)` drew its own `<Bar>`: My Classes one, My Lessons THREE (one per branch), Prepare one, the lesson route two and LessonView three more — **eleven copies of a strip that never changes**, where the web has written `.topbar` once in `page.jsx` since the day it existed. ★ **This is not tidiness; it is the removal of a bug CLASS.** Five of those eleven passed no `user`, so the bar shed its whole right-hand half — gear, identity, Log out — on exactly the screen a teacher spends her lesson in (founder, 2026-09-14: *"when in iphone/expo I open a lesson plan from My Class or My Lessons, the login and wheel on top right bar disappears"*). Giving `user` a default PATCHED that; a screen can no longer forget a bar it does not draw. ★ **And it is the anchor the rest of 6a needs**: the notices (save-failed, a section mismatch, a bumped privacy notice) belong to the APP and not to whichever screen happens to be showing, and so do the gear and Ask Meyy's panel — threading each through four route files is how they end up disagreeing. Done FIRST, deliberately, before those land on top of it. Also in this commit: **`BNAV_H = 56.85` is published from `BottomNav`** (app. 01 row 10) and the My Lessons toast reads it instead of carrying its own copy of the number — a copy is a thing that goes stale the day the nav is re-measured and nobody re-measures the toast. `activeNav` → `null` on `/settings*`, the web's rule, drawn now so the route lands into it. ⚠️ **The gear is still INERT** and lights when `/settings` exists (6b): a gear that navigates nowhere is worse than one the bar's own `disabled={!onSettings}` visibly marks as not-yet-live. ⚠️ The three shell-LESS screens — login, the privacy notice, first run — live OUTSIDE `(app)` by design (§0, Q23) and keep their own bars; first run's still carries `gear={false}` | *this commit* | 🟡 **Syntax-clean across all eleven touched files; UNWALKED.** The first thing to look at on the next Expo start is that the bar is there once, on every route, with her name on it — and that nothing under it has moved by a row |
| **6a·F5** | ★ **HER SUBSCRIPTION IS A STORE NOW, AND THE PHONE OBEYS IT — Q7 answered PORT NOW** (app. 01 rows 50-55, 47). The phone asked `/entitlement` in three places for three different reasons — My Classes for its status line, Prepare for the free-chapter counter, first run for its trial card — and derived **nothing** from the answer, so every consequence the web hangs off a lapse was simply absent and would have stayed absent on the day enforcement is switched on at Render, because nothing here was watching. `@aruvi/shared/entitlement` (10 tests) is the copy; `format.js` keeps the meaning (`entLapsed`, `paidScopesOf`, and `entTrial` lifted from page.jsx). ★ **IT IS THE OPPOSITE OF `readiness.js`, ON PURPOSE**: a teaching profile is the most stable record she has, so that store revalidates once a session; a subscription is the least stable — the founder revokes one in a terminal and switches back to the phone to watch — so this one is POLLED on the web's own cadence (mount · foreground · 20 s while active, the timer stopped in the background). ★ **AND THE DEVICE COPY PAINTS THE FIRST FRAME.** The web needs none, its tab stays open; a phone COLD-STARTS, so without one a lapsed teacher relaunches, meets My Classes and Add for the length of a round trip, and has them vanish under her thumb — a failure only the phone can produce. The stored copy is a HINT: the server wins the moment it answers, either way. The reading room is now real — My Classes and Add leave the bar (`showClasses`/`showAdd` have existed unpassed since the nav was ported), a lapse mid-session MOVES her off My Classes, the "+" window will not open and anything open closes, the Year Plan's budget pencil goes dark, and the prepare CTA hides. ⚠️ Enforcement is off server-side, so all of it is **dormant, not dead**. ⚠️ **Three screens stopped asking for themselves** — My Classes fired `/entitlement` on every mount, and it remounts on every crossing, while the shell above it polls the same endpoint. ⚠️ **A THIRD SPELLING OF `paidScopesOf` WAS FOUND IN FIRST RUN, AND IT HAD DRIFTED**: it read `scopes` where the rule reads `live_scopes`, so a teacher arriving with one expired subject-stage and one running would have been offered both on her very first screen — the `portalGradeIdxs` lesson exactly, third sighting. It calls the rule now. ★ **AND THE PAYWALL BECAME THE WEB'S — Q6.** Founder: *"mimic web to add 'Not Now' button + Subscribe button … clicking the latter can simply show up window saying 'Subscription page in development'"*. Two things were wrong: the title "Your free chapters are used up" was hardcoded over all three walls, so a teacher blocked for a subject she has not bought was told she had spent chapters she never touched (`paywallKicker` is now shared, and **the web delegates**); and one "Close" is not the web's shape. ★ **The SHAPE is what is being preserved, not the wiring** — a teacher who learns this window today must not meet a differently-shaped one the week Subscribe starts working. ⚠️ ONE Sheet, whose children swap (the `dac26eb0` lesson): the "in development" note is a second BODY, never a second Modal. ⚠️ `paywall_*` are NEW keys in `web.js` — `useWebStyles`' `useMemo` cannot see them until a real app start, so **reload before judging that window** | *this commit* | 🟡 **150 shared tests pass (13 new); syntax-clean. UNWALKED, and most of it is UNWALKABLE here** — enforcement is off, so nothing on the deployed API can make a teacher lapsed. What CAN be walked: the paywall (spend the trial, or point the app at a 402), and that nothing REGRESSED for a teacher who is not lapsed |

**★ 5c IS NOT A SEPARATE STEP ANY MORE.** Founder's answer to Q1 was HOLD: the budget screen's own
sense-check pencil leads to the ppw wheel, so shipping it before the numbers editor would only have moved
the dead end one level down. Both pencils lit together in `ff8cf0c1`.

**Still owed on 5d** (the order below is §2's, minus what landed): the **two pick screens** (for a teacher
with more than one subject·class — until they exist a row on such a profile is honestly left on the window
rather than guessing a scope) · **add a subject** (Q3: add mode only) · the **check-mood window** — whose
ADDED-subject trigger ships here, its tour-end trigger arriving with the tour (Q9 dissolved 2026-09-15,
founder un-deferred the tour; it is step 8b). **No founder question blocks 5d any more.** ✅ `onAdd` is LIVE since `9a1546ec` — all four rows lead somewhere.
⚠️ When F5 lands (6a), the window must NOT open while she is lapsed: the growth entry points hide on an
expired subscription. That is the web's rule and the phone owes it; enforcement is off server-side for
every teacher today, so it is a note to keep, not a gap to close now.

### Picking this up in a new session

*Three hand-offs live here. The **2026-09-16 (evening) block at the END of this section is the current
one** — read it last and act on it. The two above it are earlier runs of the same day and the day before,
kept because their constraints and lessons are still in force. Read §0 above first; this is only what is NOT
in the commits.*

**Standing instruction from the founder:** *"Going by `mobile_implementation_map.md` and the
`mobile_implementation_map/` appendix, proceed with implementation. Ask the founder's questions listed there
whenever needed during the development as relevant to that stage of development."* And: keep this file
updated **in the same commit as the work**.

**Constraints that are not negotiable and are easy to forget:**
- **`git push` is Kumar's.** This sandbox has no GitHub credentials and never will. Commit, then say how many
  commits are ahead — `git log --oneline @{u}..HEAD`, never a guess. (He pushes promptly and often without
  saying so: `dac26eb0` was on `origin/main` within minutes of being written.)
- **Computer-use / Screen-Recording permission was declined and revoked.** Do not drive the Mac's UI. The
  Chrome extension against `localhost:8081` is the way to walk the phone build; use `find` → `ref` clicks,
  because raw pixel coordinates do not land reliably.
- **Signing in is the founder's act, not ours**, and writing to his LIVE profile on Render needs his say-so.
  A Class 4 was once added to his real account while testing; it had to be confessed and removed.
- The dev servers run on the **Mac**, not in the agent's shell. `device_bash` edits DO reach the Mac's disk
  (Metro picks them up), but `curl localhost:3000` from that shell reaches nothing. If the web needs walking,
  ask him to start `npm run web`.
- `git config user.name/email` may be unset in a fresh shell — the repo's own author is
  `kumarradhakrishnan2-hue <kumar.radhakrishnan2@gmail.com>`.

**The pick screens are WALKED — the founder added Mathematics·preparatory to his own profile the same
hour and made the walk possible.** "In which subject?" renders on both surfaces with English and
Mathematics as rows; picking English goes STRAIGHT to its section editor, because English has one class
and a question with one possible answer is not a question. The portal → pick → editor journey is one
window throughout, no flash.

~~⚠️ **STILL OWED: the "Which class?" screen itself.**~~ **DRAWN AND WALKED 2026-09-16** — the founder
added **English·Class 4** that morning, which is exactly what the screen needed, and the whole path opens:
Add → Section → "In which subject?" (English · Mathematics) → English → **"Which class?" with Class 3 and
Class 4**, kicker "ENGLISH · SECTIONS", sub "Pick the class whose sections you want to change.", **← top-left
and ✕ top-right**; the ← returns to the subject question (where it correctly disappears, that step having
nothing before it). ⚠️ **The stage-scope narrowing is still unwalked and cannot be walked on this profile** —
English III · IV and Mathematics V are all PREPARATORY, so the stage filter has nothing to narrow. It is
unit-tested (`portalGradeIdxs`, 6 cases) and will first show itself on a teacher who buys a second stage.

~~⚠️ **AND THE PHONE DOES NOT BAND BY SUBJECT.**~~ **CLOSED 2026-09-16** — reported as predicted, and
fixed in the same pass as the section tag (see the last row of the table above; appendix 05 B11 + B11a).
`sc_bands` / `sc_band_gap` / `sc_band_hd` / `sc_band_list` are in `web.js` now.

**All three items owed at the last hand-off are CLOSED (2026-09-15, second run — the dev server was up
this time). What they turned out to be:**

1. **The `dac26eb0` web walk — clean.** *How many periods a week?* shows CONTINUE alone and *How many
   periods for the year?* shows SAVE alone; both keep the ✕. The class wheel offered 9000000003 exactly
   **Class 3, 4, 5** and the subscription note — her paid preparatory stage, no 6–9 — so `allowedStagesFor`
   reads the same on both surfaces.
   ⚠️ **The confirm blocks were never at risk, and `:not(.fr-center)` is not what saves them.** Every
   "Keep it" / "Keep them" / "Cancel" in this file lives in `.fr-modal-bg > .fr-modal` — the subjects
   confirm, the classes confirm, the sections confirm and the accordion's — so it is neither a direct child
   of `.tp` nor inside an `.fr-foot`, and NEITHER hide rule can reach it. That was settled by reading all
   four sites rather than by triggering a removal on a live profile. `:not(.fr-center)` still earns its
   keep as the guard for the day a confirm is written inline, but the note in `globals.css` overstates it.
2. **The web does NOT flash between its two windows, and structurally cannot.** `.ap-overlay` and
   `.ap-modal` carry no transition, animation or keyframe — the phone's flash was the two **RN `Modal`s**
   and their fades, which is a thing the web never had. And `onProfilePortal` closes the portal and opens
   the editor in ONE batched handler, so React commits both in a single render: there is no frame in which
   neither is painted. Nothing to fix; the phone's `dac26eb0` fix has no web half.
3. **The web owed the CORNER, not the link back — and now has it.** Settled by the phone's own precedent
   rather than by a new decision: `2d7ac21d` already answered "corner or footer link?" with *corner*, and a
   rule that lives on one surface is a rule the other does not have (CLAUDE.md §3). Un-hiding the footer
   link would have re-bought the row of card height that commit was spending. See the §0 row.

**Then, in order:** the two **pick screens** (subject and class, for a teacher with more than one — today a
portal row on such a profile deliberately does nothing rather than guess) · **add a subject** (Q3 answered:
add mode only) · the **check-mood window**, which needs **Q9**, the last unanswered founder question in §4.
Nothing blocks the pick screens; **Q9 has been put to the founder ahead of its stage** so the check-mood
window does not stall on it.

**Two lessons this run is the evidence for, both already in MEMORY.md:**
- *Web tolerance is not correctness either.* The parity page renders react-native-web in both panes, so it
  cannot see an iOS-vs-web divergence. Anything touching baseline, intrinsic sizing or text metrics is only
  settled by the handset in the founder's hand.
- *A rule that lives in one surface's component is a rule the other surface does not have.* Both the class
  scope filter and the ppw/budget arithmetic were found missing on the phone for exactly that reason.
  When a fix is a RULE, lift it to `@aruvi/shared` and make both callers call it — CLAUDE.md §3.

**What the phone is today, in one sentence:** a teacher who already has a profile can teach (LessonView,
full), track (My Classes), browse and prepare (My Lessons, Prepare, Year Plan), and now **amend her week and
her year** (periods a week, period lengths and their split, the annual budget) — and still cannot *become* a
teacher (no first run), *add or remove* what she teaches (Add is inert), *reach* Settings (gear is inert),
*ask* Meyy (item is inert), or *export* anything.

**The remaining inert doors** are the shape of the remaining work (ADD opened on 2026-09-15):
`(app)/_layout.jsx` — `onAsk={() => {}}`; `Bar.jsx` — gear `disabled={!onSettings}`
and no screen passes one; `(app)/index.jsx:255` — "No classes yet — set up your teaching profile (first run
comes in a later step)."

**★ AND ONE THING THE TOOLING CANNOT CHECK, learnt the hard way on 2026-09-15.** The parity page puts two
renderings side by side — but BOTH panes are react-native-web. A divergence between iOS and
react-native-web is therefore invisible to it: it showed a perfect match of two wrong answers while
"Total periods" was missing on the handset. Anything touching **baseline alignment, intrinsic sizing or
text metrics** has only one authority, and it is the phone in the founder's hand. Budget a founder walk for
those; do not report them as verified off the parity page. (MEMORY.md, same date, has the full account —
it is the other face of "native tolerance is not correctness".)

### ★ CURRENT HAND-OFF — written 2026-09-16, end of the LessonView-feedback run

**What this run was.** Not a step from §2. The founder was walking the phone build and reporting what he
saw, and every commit in it came from one of his sentences. That is worth naming, because the work it
produced is not in the step plan and the next session should not go looking for it there.

**★ THE FIVE THINGS THAT WERE OWED ARE NOW WALKED — founder, 2026-09-16: *"1-5 ran and looks fine".***
That closes the largest verification debt this port has carried, and two of the five could only ever have
been closed this way:

1. **The phase bookmark** — press → frame + highlight → slide → lift. Unwalked *anywhere* when it was
   written; the fifth design, and the right one. ★ If it is ever reopened, read the superseded row beneath
   it in §0 first: three rejected designs rule out more than they look like they do.
2. **The iOS `onPanResponderTerminationRequest` fix** — reasoned for a day and impossible to reproduce in
   the sandbox, because **no surface available to the agent has the bug**. The handset was the only
   authority that could close it, and did.
3. **The prepare STEER** and **4. the section-card "+" RETURN leg** — both needed a **real generation**,
   which spends a trial chapter on the founder's live account. That is why they sat unwalked for two runs;
   they are done now.
5. **The clay phase rules** — confirmed on both.

⚠️ **The lesson to carry, not the list:** four of these five were *correct when written* and still had to
wait for a handset. Two of them no tool in the agent's reach could have tested. Budget the founder walk as
part of the work rather than as a step after it — and when something is unwalked, the map must **say so in
the row**, because a green test suite beside an unwalked row reads as verified to anyone skimming.

**Three tooling traps this run walked into, all of which cost a wrong diagnosis:**
- **`useWebStyles` is `useMemo(() => webStyles(t, scheme), [t, scheme])`.** A style key you have just ADDED
  is therefore invisible to Fast Refresh until a real app start. A style that "isn't applying" after an edit
  deserves a full reload *before* it deserves debugging. This cost a confident, wrong report that an armed
  tint was not rendering when the code was correct.
- **A JSX syntax error blanks the Expo web app with an EMPTY ROOT AND NO REDBOX.** `{/* … */` with no
  closing brace did it. If the page is blank, `document.getElementById('root').children.length === 0` and
  the console is silent, suspect a syntax error in a file just edited — not the dev server, not the API.
- **Navigating the Expo web target by pixel coordinates is unreliable** and cost many turns this run; the
  layout reflows between screenshots. Prefer `find` → ref clicks (already a standing note above), and expect
  the session to expire — when it does, **stop, and say so, rather than signing in.**

**What the founder's four bookmark rejections actually taught**, because it generalises past this widget:
the gesture was never the problem. Dragging failed on the phone because **both of its feedback channels
failed at once** — her fingertip covered the arrow, and the spine scrolled under it so the arrow appeared to
drift. Two replacement designs (a hold, then a tap-to-place mode) tried to fix the *gesture*, and both were
rejected on sight. The fix was to leave the gesture alone and repair the feedback: light a whole row,
somewhere her hand is not, and freeze the surface for the length of the touch. ★ **When a touch interaction
feels wrong on a phone, ask what she cannot SEE before you ask what she should DO differently.**

**Still true from the previous hand-off:** the inert doors are still Ask Meyy, the Settings gear, and first
run. (The subject bands that stood here were reported and CLOSED on 2026-09-16, with the named-section tag
alongside them; the "Which class?" screen was drawn and walked the same day — see below.)

**Where §2 picks back up.** ★ **STEP 5d IS CLOSED AS FAR AS IT CAN BE CLOSED (2026-09-16).** All three of
the things that were owed moved on one day: the **"Which class?" screen** was finally DRAWN and walked (the
founder added English·Class 4 that morning, which is exactly what it needed — two classes in one subject);
the **check-mood window** landed with its sub-line and its row values, the web delegating to the same two
shared helpers; and **"add a subject" is HELD to 6a** by the founder's call (Q22) — there is no door to it
on the phone until the Settings accordion exists, and shipping a screen nothing reaches is the mistake Q1
already declined. What is genuinely left inside 5d is the **stage-scope narrowing of the class list**, which
CANNOT be walked on this profile (English III · IV and Mathematics V are all preparatory, so the filter has
nothing to narrow) and waits on a teacher with a second stage. The map is linear again: **5e** first run,
then **6a** the shell layer, which is what lights the Settings gear, Ask Meyy and add-a-subject's door.

---

### Hand-off — 2026-09-16, evening (the current one)

**Where the build stands.** 5d is closed as far as it can be, **5e is BUILT**, and the founder has walked
first run end to end on a fresh number (9000000002) — the lesson generated, landed attached on 3A, and the
check window rose over it. Everything below 6a is done bar two named gaps.

**What landed today, in order:** My Classes banded by subject + the named-section tag (B11, B11a) · the
check-mood window and its values, `setupCheckSub`/`setupCheckValues` lifted to shared with the web
delegating · the "Which class?" screen drawn and walked · the front-door parity pass (Q21a/Q21b, the
privacy frame, `MOBILE_TAKEN` to shared) · **first run + the activation gate (Q5: the layout)** · the
legal documents wearing the web's type · a locked field that looks locked · the window's ← belonging to the
journey rather than to one screen · **Privacy Notice v0.2 with §3a "Where we use AI"** · the front door's
foot links as `.fr-link` · the check window's phone trigger.

**The two gaps, both named and both deliberate:**
1. **Add a subject is HELD to 6a (Q22).** There is no door to it on the phone until the Settings accordion
   exists — the pick-subjects wheel and the per-class run are built there, not before. Consequence the
   founder hit today: the check window's SECOND moment (first use of an added subject) cannot be tested on
   the phone yet, because he cannot add one there.
2. **The stage-scope narrowing is unwalkable on his profile** — English III · IV and Mathematics V are all
   preparatory. It waits on a teacher with a second stage.

**⚠️ THE ONE THING THAT WILL BITE AT 8b.** First run now leaves a one-shot that My Classes spends to raise
the check window (`lib/firstRun.js` `queueFirstRunCheck`/`takeFirstRunCheck`), because the phone has no tour
to raise it the web's way. When the tour lands, `finishTour` raises it too and **she is asked twice** —
retire one. The note is in `lib/firstRun.js`; this line is the second place it is written down.

**What is owed on the HANDSET** (everything below was walked on Expo web only): the subject bands and the
named-section tag · the check window (both triggers) · the ← on every Add journey · the privacy notice's
type · the greyed locked field (its own screen needs a real OTP, so it gets its eye at the next sign-in) ·
first run's own screens on a phone rather than a browser.

**Still unwalked from before, and still the cheapest confirm on the board:** the "one wait, on the card the
lesson is for" row — prepare from a section card's "+", watch the bar on THAT card, see it settle attached.

**Deploys.** `git push` to `main` is all it takes: Render's `meyy-api` is `autoDeploy: true` on that branch
and the Dockerfile copies `data/cloud/content/`, so a legal document ships with the image. Confirmed live
today — `https://meyy-api.onrender.com/legal/privacy` answers `version 0.2`. Both surfaces read the deployed
API, so nothing in `data/cloud/content/` is visible to anyone until a push.

**Where §2 picks up: step 6a, the shell layer.** It lights the Settings gear, Ask Meyy and add-a-subject's
door. Its founder questions are **Q6** (paywall wording with no Subscribe), **Q7** (lapsed rules during the
beta) and **Q8** (`<Bar>` into the layout — it changes every route file).

---

## 1. The dependency graph

Everything left divides into **foundations** (pure JS in `packages/shared`, a shell layer, two primitives)
and **screens**. Screens cannot be finished until their foundation exists; foundations are cheap, testable in
node, and each unblocks several screens at once. Build them first.

```
FOUNDATIONS                                        SCREENS THEY UNBLOCK
───────────────────────────────────────────────    ────────────────────────────────────────────
F1 ✅shared/readiness.js: saveReadiness()      ──►  5c budget editor · 5d profile portal · 5e FirstRun
F2 ✅shared/profile.js + shared/ppw.js         ──►  5d (ppw/duration/sections) · 5e (chapter step seeds)
F3  shared/setupCheck.js (ProfilePortal queue)──►  5d check-mood window · 6a shell
F4 ✅shared/account.js  (GET /account store)   ──►  6a bar name + greeting · 5e first name · Settings › Personal
F5 🟡shared/entitlement.js — the SCOPE half landed 2026-09-15 in shared/format.js
     (paidScopesOf · entLapsed · allowedStagesFor); the POLL half (focus/visibility/interval) is owed
                                               ─►  6a bar hiding · 5d scope filters ✅ · Settings › Subscription · My Lessons CTA
F6  shared/year.js (GET /academic-year + cutover) ─► 6a cutover offer/result · prior-year folders (My Classes picker, My Lessons) · YearStamp
F7  mobile/lib/portal.js (origin store, preparing.js idiom) ─► 5d every exit · Year Plan pencil round trip
F8 🟡PickWheel + PpwSplitCell done; SecNameCell owed ─► 5d sections/classes/subjects/durations · 5e (none — FirstRun uses RollWheel)
F9  mobile/lib/download.js (expo-file-system + expo-sharing) ─► 7 Reports modal · Year Plan export · data exports · invoice PDF · delete-flow docx
F10 (app)/_layout.jsx becomes a real shell (askOpen, portalWin, notices, Bar in the layout) ─► 6a · 6c Ask Meyy · every bar door
F11 mobile/components/Dropdown replacement (sheet/picker) ─► Settings › Personal profile (Role/State) · Support
F12 tour anchor REGISTRY (ref + measureInWindow, keyed by the web's own `data-tour` strings)
                                               ─► 8b the guided tour (un-deferred 2026-09-15) — and NOTHING else,
                                                  which is why it is last: no other screen is waiting on it
```

Two ordering facts that decide the step sequence below:

1. **The profile family is the critical path.** It is the biggest MISSING block (70 rows), it owns F1/F2/F7/F8,
   and both the Year Plan pencil (deferred since 4b) and FirstRun's seeding depend on its writer. The web
   itself took the portal-first order (the accordion became "a view" on 2026-08-27; every edit lives in the
   portal) — so the phone ports the **three portal doors before the Settings accordion**.
2. **Settings is not a prerequisite of anything except its own subviews** — but the shell layer it needs (F4,
   F5, F10) is also what FirstRun and the profile need. So the shell layer lands in the middle (6a), not at
   the end, and Settings/Ask Meyy follow it.

---

## 2. The steps, in order

Each step: **entry** (what must already exist) · **build** (the line-level items, by appendix row) · **web.js
keys to measure** · **exit** (the phone walk that signs it off) · **web owed** (changes the web must take at the
same time — CLAUDE.md §0: every UI change is made on BOTH surfaces).

### Step 5c — the budget editor and the Year Plan pencil  ✅ **DONE 2026-09-15** (`7593264f`, `ff8cf0c1`, `f2dda0c0`)

**★ FOLDED INTO 5d.** Q1 asked whether to ship the budget screen with a dead sense-check pencil as a named
divergence, or hold until the ppw editor existed. **Founder: HOLD.** So the screen was built and left
unreachable until 5d's numbers editor landed, and both pencils lit in the same commit. Shipping the outer
one first would only have moved the dead end one level down — the thing 4b held the Year Plan pencil back
for in the first place.

**Built, against the plan below:**
- **F1 `saveReadiness(subjects)`** — as specified, plus a finding the spec could not have known: writing its
  tests showed `readinessFingerprint` **excluded the annual budget**. That exclusion was sound while the
  budget was only ever a by-product of the class run and stopped being sound the moment an editor changed
  only it — a save that dropped her year read back as VERIFIED. Now included, with every artefact spelling
  normalised (both index-key spellings, both spellings of "not set", numeric strings) and the map read
  BEFORE the grades are sorted. ⚠️ **This makes every save on both surfaces stricter.**
- **The budget screen** — all of it: kicker, `fr-q`, the value row, the weeks sense-check, the
  recommendation lines, Save/Cancel, and the mismatch banner with its Dismiss.
  ⚠️ The banner sits ABOVE the loading split: a mismatch clears `value` so the field can re-seed from the
  server, so written inside the `value != null` branch — where it first was — it could never once appear.
- **Route:** `(app)/profile.jsx` with `intent`, as the plan asked, so 5d's steps land beside it rather than
  as four more routes each with its own save path, scope resolver and exit rule.
- **Year Plan pencil** — lit, returning to the Year Plan pane.
  ⚠️ The plan proposed "a route param on the way back". It is a module one-shot (`lib/paneIntent`) instead:
  a param STAYS on the route, so an ordinary /lessons → /lesson → back would re-read it and re-steer her.
  And it is consumed on FOCUS, not mount — /profile is PUSHED on top of My Lessons, so the return pops to a
  screen still mounted and a mount-only read would steer nothing at all.

**Two corrections to the plan's `web.js` line, both from measuring rather than reading:**
- **There is no `kicker_ochre` to add.** `.kicker-ochre` has NO rule anywhere in globals.css — four web
  files render it and it computes as a plain pine `.kicker`. `ws.kicker` is the faithful port.
- `.fr-cta` declares font-size 16 and border-radius 12 and **the browser applies neither**: the element is
  `button.primary.fr-cta` and `button.primary` (0,1,1) beats `.fr-cta` (0,1,0) on SPECIFICITY, so the live
  values are 12 and 3. The plan's note about the `.fr-q` 27-vs-32 media-query trap was right and was heeded.
- The pencil's aria label matches the WEB verbatim ("…for {subject}"); the plan's row adds ", Class {n}",
  which the web does not say. CLAUDE.md §4 — the web wins.

**Also fixed here:** the parity checker resolved `em` against whichever font-size came first across all worn
sets rather than the winner for the SAME set, so it called a correct 0.96 wrong at 1.28 — the class of
mistake it exists to catch. Pairing is now by index; diffing old against new showed exactly one line gone.

### Step 5d — the profile portal: Add, and the three portal doors  🟡 **IN PROGRESS**

**Entry:** 5c (F1). F5 for scope filters (can be stubbed as "unscoped" until 6a — the deployed API has
enforcement off, so `paidScopes` is null for every teacher today).

**Progress (2026-09-15).** Items **7** (F2) and **8** (the numbers editor) are DONE, out of order and
deliberately: Q1's HOLD made the numbers editor the thing that unblocked 5c, so it was built first and the
two pencils lit together. **F8** (`PickWheel`) came with it, since item 8's duration step is its first
caller. **F4** (`shared/account.js`) was pulled forward out of 6a by a founder report — the phone was still
showing her mobile number on the bar after she had subscribed.

- ✅ **7 · F2** — `shared/ppw.js` + `shared/profile.js` + `rekeyBudget` → `budget.js`, 25 tests (`1786523a`).
  The stake is not tidiness: the fingerprint compares what a teacher can change, so a phone that composed a
  record differently would report every save as lost work. `profile.test.js` asserts draft → record is a
  no-op under the fingerprint.
- ✅ **8 · the numbers editor** — ppw step → duration step with the split column, saving together
  (`ff8cf0c1`). ⚠️ The lengths and their split save TOGETHER, which is why ppw has only Continue: the size
  of a week and its division are one answer. ⚠️ The last length cannot be unticked.
- ✅ **4 (part) · `PickWheel` + `PpwSplitCell`** (`ceb3d742`, `ff8cf0c1`). Two-column mode, clustering via
  the shared rule, the trailing column. **`SecNameCell` is still owed** — nothing renders one until the
  section editor (item 5).
  ⚠️ `PpwSplitCell`'s picker is a `Sheet`, not the web's position:fixed listbox. The web's reason for a
  hand-built listbox (macOS draws a native select's popup and the palette cannot reach it) is a DOM reason;
  on a phone the opposite constraint applies.
  ⚠️ And the Sheet is MOUNTED/UNMOUNTED, not toggled — returned from `PickWheel`'s `trailing` callback, it
  sits inside the wheel's ScrollView, so a pick rebuilds the surrounding subtree in the frame the Modal
  starts its fade-out and the exit never completes. Other sheets in the app toggle `visible` and close
  perfectly; this position is what differs.

- ✅ **1 (part) · F3 `shared/setupCheck.js`** — the check-window queue lifted from `ProfilePortal.jsx`,
  11 tests (`setupKey`, `queueSetupCheck`, `takeSetupCheck`, `pruneSetupCheck`, the 24 cap, the 1s delay).
  Web re-exports it. ⚠️ Verified by tests and by parse only: the web tab's Supabase session had expired by
  the time I went to walk it, and signing in is not mine to do. The change is a pure re-export.
- ✅ **1 (part) · F7 `mobile/lib/portal.js`** — origin route + the window to restore, with a subscription;
  the `lib/preparing` idiom. Not yet consumed — the window (item 2) is its first caller.

- ✅ **2 · The ProfilePortal window** — `mobile/components/ProfilePortal.jsx`, mounted in
  `(app)/_layout.jsx` BELOW the Stack and ABOVE the BottomNav, so the bar stays live behind it (a
  window that took the whole nav away would be the one screen she could not leave — Ask Meyy's
  September mistake on the web). Four rows, no subject row, no decline button, the footer outside the
  list.
  ~~🔴 `onAdd` IS STILL DARK~~ — **superseded: it went live with item 6 below** (`9a1546ec`), the
  commit that gave the fourth row its screen. The rule it records still stands and is worth keeping:
  the window stays dark until EVERY row in it leads somewhere, because a window offering four things
  to change, half of which do nothing, is the call the founder made twice already.
  ⚠️ When it lights: the window never opens while she is lapsed (F5, 6a).
  ⚠️ `subscribePortal` sits ABOVE the sign-in redirect — a hook may not follow a conditional
  return (the "Rendered fewer hooks than expected" lesson of 2026-09-14).

- ✅ **5 · The section editor** — `/profile?intent=section`, with `SecNameCell` (so F8 is complete).
  Q4's amended hint ships on both surfaces. Removal is confirmed and addition is not: ticking costs her
  nothing, unticking takes a card and a bookmark away. Save is disabled at zero sections — removing the
  last one cascades the whole class away, which is a different and more destructive act than this screen
  is for.
  ⚠️ `clearSectionState` moved to `shared/sectionState.js` (it reached into `window.localStorage`
  directly) and PUSHES as part of the removal — without that the section reappears on her next device
  the moment state is pulled back down.
  Walked on Expo: the wheel opens with 3A/3B/3C ticked and Aruvi/Kadal/Vanam in the customize column;
  unticking 3C and saving raises "Remove 3C? … Your lessons stay in the library" with Keep it / Yes,
  remove 3C; Keep it dismisses and her record is untouched. **The remove itself is the founder's to
  press** — it clears real bookmarks.

- ✅ **6 · Manage classes** — `/profile?intent=class`, and **`onAdd` IS NOW LIVE**: all four of the
  window's rows lead somewhere.
  ⚠️ Save is NOT disabled at zero classes, unlike the section wheel, and the difference is the point:
  zero sections is not an act she can mean (it cascades the class away by a side door), zero classes
  is — it removes the subject, and the confirm says exactly that before she presses it. The first
  draft copied the section wheel's disable and made that path unreachable with its warning dead.
  ⚠️ `rekeyBudget` runs before any write: remove Class VII from a teacher of VI·VII·VIII and VIII
  slides from index 2 to 1, inheriting VII's year unless it does.
  ⚠️ Scope: with the pick screens still owed (item 3), a row resolves its subject·class only when she
  teaches exactly ONE — the web's own "straight in when only one is in play" rule. A teacher with more
  is left on the window rather than sent somewhere guessed.
- ★ **`accessibilityState` does not reach the DOM on this react-native-web version.** A ticked row
  carried only aria-label/role/tabindex/class/style — so on the web target a screen reader announced
  "Class 3" whether or not it was ticked. The ticked state is now stated in the LABEL too, for every
  PickWheel. iOS honours the state properly, so this is belt to that braces. **Anything relying on
  `accessibilityState` alone should be treated as unverified on the web target.**

- ✅ **EVERY EDIT IS A WINDOW** (founder, 2026-09-15: *"ADD opens a window but individual changes —
  sections/class/week — open full screen both on web and expo. Suggest the changes also be contained in
  a window."*). The journey started in a window and then threw her onto a full page for one small
  change. Now the editor floats over the screen she was on, so "each item changes only itself" is true
  of the NAVIGATION as well as of the record.
  · **Phone:** `(app)/profile.jsx` → `components/ProfileEditor.jsx`, rendered from the layout off
    `portal.edit`. `Sheet` gained `scroll` (an 82% cap + inner scroller — the phone's window had NO
    height cap before, because nothing tall had ever been put in one) and a `KeyboardAvoidingView`,
    since a CENTRED modal is the worst case for a keyboard and both the section name and the budget
    figure are typed.
  · **Web:** a PORTAL visit renders `TeachingProfile` inside `.ap-overlay/.ap-modal`; a SETTINGS visit
    keeps the page, because that one is the panorama. `profileViaSettings` is the discriminator, NOT
    `profilePortal` — that flag is consumed the moment the screen launches and would flip the layout
    back to a page mid-edit.
  · ⚠️ **`lib/paneIntent` was DELETED, not adapted.** It existed only to put her back on the Year Plan
    pane after the editor navigated her away; she is not navigated away now. The good kind of change —
    a mechanism went away rather than gaining a case.
  · ⚠️ **`PpwSplitCell` no longer owns an overlay.** Its picker was a `Sheet`, which became a window
    over a window the moment the editor was one — two cards, two ✕s, the inner covering the row she
    had just tapped. It now reports that it is active and the duration step draws the 0…total strip
    INLINE under the wheel. A stepper was the other candidate and was rejected: at a 14-period week,
    setting 7 would be seven taps where this is one.
  🔴 **The web half is UNVERIFIED** — the web tab's Supabase session expired and signing in is not
  mine to do. Walked end to end on Expo: budget over the Year Plan, ✎ → ppw → duration with the inline
  strip, and the tall section wheel over My Classes, one modal throughout.

- ✅ **THE CORNERS DO THE NAVIGATION** (founder, 2026-09-15: *"each of them should have 'x' on top
  right to click off back to previous screen instead of back button saving height"*). ✕ closes from
  every step; ← appears top-LEFT only on `duration`, the one step reached THROUGH another. Every
  footer "Cancel" and "← Back" is gone — each cost a whole row of a window whose height is the
  standing problem. The budget step's 88px lift also drops to 28 inside a window: the card's own edge
  already separates "what I am being told" from "what I am about to do", and 108px pushed Save under
  the fold of a capped card.
- ✅ **BLANK BACKGROUND BEHIND A WEB EDIT — FIXED.** The first windowing pass wrapped the profile in
  `.ap-overlay` but still routed through `editFlow = "profile"`, which renders the profile INSTEAD of
  the tab content — so the scrim was dimming an empty page. There was nothing behind it to haze.
  `editFlow` now stays where she was and the edit renders BESIDE the main content, off a `profileWin`
  flag, which is the phone's architecture.
  ⚠️ It also retires `lessonsPaneIntentRef` — the web's twin of `lib/paneIntent`, and deleted for the
  same reason: she is not navigated away from My Lessons any more. Both surfaces lost that mechanism
  on the same day.
  ⚠️ A SETTINGS visit still keeps the full page: she asked to SEE the whole profile, which is the
  panorama, not a spot edit. Walked on the web with the founder signed in: Add → Section opens over a
  hazy My Classes, ✕ closes it and the portal window comes back.

- ✅ **The section hint is ONE sentence** (founder, 2026-09-15). It carried three: what ticking does,
  what a removal costs, and where to remove a whole class. The last was stale for weeks (Q4); the
  middle warns about a thing she has not done, and is read by every teacher who came to ADD a section.
  The removal confirm says it at the moment she is actually removing something. Both surfaces.
- ✅ **The Expo kicker is the EDITOR's, not the window's.** `.ap-kicker` is ochre at .12em — right for
  a window whose title IS the window. This screen is the web's `.tp`, whose kicker is `.kicker`: pine,
  weight 500, .18em, and FLUSH against the heading (measured on the running page: kicker bottom and
  heading top are the same pixel). `Sheet` now skips its header block entirely when a window brings
  its own.

- ✅ **The ✕ was untappable on Expo/iPhone** (founder, 2026-09-15). Absolutely positioned, so it LOOKED
  right wherever it sat in the tree — but paint and hit-testing follow sibling ORDER, and the card's
  body became a ScrollView filling it when edits moved into windows. Written before that scroller, the
  corner buttons were painted under a transparent sheet: visible, completely untappable. Nothing about
  the ✕ was wrong; the thing in front of it was new. They now render LAST. Order, not `zIndex` —
  zIndex needs `elevation` to mean anything on Android, a last sibling needs neither.
- ✅ **And the portal window was not coming back** on close, found while fixing the above. `openEdit`
  set `win: null` and `closeEdit` restored `state.win` — which was by then the null it had just
  written, so a teacher who amended one item was dropped onto the bare screen instead of the list she
  opened it from. The window she came from is now remembered (`winBack`). The web has restored it
  since 2026-08-27: "a teacher who has just amended one item is exactly the person most likely to want
  the next."

**Still to build, in this order:**
1. **F7 `mobile/lib/portal.js`** — `{originRoute, win:{mode, reason, subject, grade}, scope}` with
   `subscribePortal`; the phone's `portalOriginRef` (app. 01 rows 77-78). **F3** `shared/setupCheck.js` — the
   queue lifted verbatim from `ProfilePortal.jsx:135-184` (`setupKey`, `queueSetupCheck`, `takeSetupCheck`,
   `pruneSetupCheck`, `SETUP_CHECK_DELAY_MS=1000`, key `setup_check_pending_{user}`, cap 24); web re-exports.
2. **The ProfilePortal window** over the exported `Sheet` (app. 01 rows 65-76): kicker "Your teaching" · title
   "What would you like to change?" (change) / "Would you like to check your set-up?" (check) · sub-line per
   mood · rows **Class · Section · Periods a week · Annual period budget** with `›` (values right-aligned in
   check mood only, `setupCheckValues` rules row 76) · footer "Want to see your full teaching profile?" `›` ·
   NO subject row, NO decline button. `(app)/_layout.jsx` owns `portalWin`; the sheet renders above the Stack,
   under the BottomNav; **Add** = `{mode:"change"}` (row 38); never when lapsed.
3. **Pick screens** (app. 02 rows 19-21): `portalSubject` ("Your teaching · {what}" · "In which subject?" ·
   hint per goal) → `portalClass` ("{subject} · {what}" · "Which class?" · rows "Class {n}" from
   `portalGradeIdxs`: exact → that class; stage → that stage's classes; fallback all).
4. **F8 `PickWheel`** (app. 02 rows 78-85): fixed 4-row window (52 px rows) · tap toggles `.fr-sec-opt` with
   `.fr-sec-check` "✓" · `clusterOrder` (ticked options gather in one ascending run; `cluster={false}` opt-out
   for the swallowed-Mathematics rule) · `restOn` · running summary `.fr-pick-summary` "Chosen ({n}):
   **{summary}**" / "Nothing chosen yet — tap the rows above" · CTA rendered inside the column · ▲▼ side arrows
   when > 4 · `initialScrollTo` · **two-column mode** (`leadingHeader`/`trailingHeader`, `trailing(option,
   isSelected)`, `summaryFor`). Plus `SecNameCell` (row 88: maxLength 8) and `PpwSplitCell` (row 87: anchor
   row bare `.fr-ppw-num`; other rows a `.fr-ppw-sel` chip opening a 0…total listbox — a `Sheet` on the phone,
   named divergence from the web's position:fixed pop).
5. **Section editor** (rows 47-49): "Edit sections of Class {n}" · hint verbatim (see Q4 — the stale "basket"
   sentence) · A…Z pre-ticked, customize column seeded with her names · **Save** · removal confirm "Remove
   {9A, 9C}?" / "Its card and bookmark"/"Their cards and bookmarks" + " will be removed. Your lessons stay in
   the library." / "Yes, remove {tags}" / "Keep it/them" · `applyEditSections` clears `lu_pointer_`,
   `current_chapter_`, `lu_done_` for each removed key then `pushSectionState` (row 14), regenerates `grids`,
   persists.
6. **Manage classes** (rows 33-39): "Which classes do you teach {subject} to?" · "Tick a class to add it —
   untick one to remove it. A new class starts with Section A; change that under Section." · enrolled
   pre-ticked · **Save** · "Loading classes…" · empty sentence · stage filter · confirm "Remove {Class n, …}
   from {subject}?" incl. " No class is left — {subject} goes with it." · adds applied WITHOUT the per-class
   run: `sections:["A"]`, `DEFAULT_DURATION`, ppw from `/ncf-periods` (`ppwFromAnnual`) or `DEFAULT_PPW`,
   `rekeyBudget` on removal (row 15).
7. ✅ **DONE** (`1786523a`) — **F2** the arithmetic out of `wheels.jsx:434-483` into `packages/shared/src/profile.js` (row 89:
   `DEFAULT_DURATION=40`, `DEFAULT_PPW=6`, `DURATION_CHOICES`, `PPW_CHOICES`, `ppwMapSum`, `lowestDuration`,
   `ppwAnchor`, `normPpw`, `setPpwSplit`, `setPpwTotal`) and the draft⇄record family out of
   `TeachingProfile.jsx` (rows 15-17: `gradeDraftFrom`, `finalizeSubject`, `secObj`, `cleanSecName`,
   `namesFromSections`, `secSummary`, `rekeyBudget`, `portalGradeIdxs`). Node tests for each.
8. ✅ **DONE** (`ff8cf0c1`) — **The numbers editor** (rows 51-54): ppw step ("How many periods a week?" · "A number, not a timetable —
   you’ll set the period lengths next." · `PpwTotalWheel` = RollWheel base `large`, 1…14, "period(s) a week")
   → duration step ("How long are the periods?" · single/multi hints · PickWheel 20…120 min with
   `PpwSplitCell`, last duration cannot be unticked · **Save**) → and the budget step's pencil now leads
   somewhere (closes Q1).
9. **Add a subject** (rows 22, 24, 26-27, 29-32, 40-46): pick-subjects wheel (`cluster=true`, catalogue from
   `GET /subjects`, paid-scope filter) → per-class run per subject (sections → ppw → durations → budget with
   "Save ✓" / "Next class →") → `subjectDone` ("✓ {subject} saved." · "Continue to {next} →" / "Finish for
   now") · multi-subject queue kicker " · subject {i} of {n}". The web's only live door to this is the
   accordion's "+ add a subject" — see Q3 for the manage-subjects wheel.
10. ✅ **DONE** (2026-09-16) — **The check-mood window** (app. 01 rows 72-76): the readiness diff in the
    layout → `queueSetupCheck(added)`; `lessons.jsx` reports its settled scope → `noteLessonsScope` →
    `takeSetupCheck` → the 1 s beat → `{mode:"check", reason:"added"}` with its sub-line and its row values.
    `subscribeReadiness` added to the shared store; `setupCheckSub`/`setupCheckValues` lifted to
    `@aruvi/shared/setupCheck`, **the web delegating to both**. The TOUR-end trigger arrives with the tour
    (8b) — the added-subject one ships here, exactly as Q9's answer says.

**web.js (≈40 families, app. 02 dependency notes):** `.fr-hint`, `.fr-sec-*` (3110-3183), `.fr-ppw-*`
(3202-3245), `.fr-sec-arrows-side/.fr-sec-arrow-btn`, `.tp-secname`, `.tp-portal-list/-row/-go`,
`.tp-remove-confirm`, `.tp-implies-edit`, `.tp-rm-keep`, `.fr-ready-note`, `.fr-loading`, `.tp-nomore`,
`.trial-note`; `ap_grow`, `ap_row_line`, `ap_row_label`, `ap_row_val`, `ap_foot`, `ap_foot_go`, `ch_go`.

**Exit:** Add → window → Section → subject → class → untick 9B, name 9A "Rose" → confirm → Save → back on My
Classes with the card gone and "9A (Rose)" showing → Add → Class → add Class X → Save → new card with Section
A → Add → Periods a week → 7 → durations 40×5 + 60×2 → Save → Prepare screen's mix line reflects it → Add →
budget → matches 5c → web shows every change.

**Web owed:** `ProfilePortal.jsx` re-exports `setupCheck.js`; `wheels.jsx`/`TeachingProfile.jsx` import the
lifted arithmetic; amend or keep the "basket" hint (Q4) on both.

### Step 5e — First run, and the activation gate  🟡 **BUILT 2026-09-16 — the handoff is the founder's to walk**

**Entry:** 5c/5d foundations F1, F2 (seeds), F4 (first name), `lib/preparing.js` + `ProposedCard` (5b),
RollWheel base (5a) gaining a `large` label (`.fr-wheel-lg`, 17 px).

**Build (app. 03 sections G-L, rows 72-118):**
- **The gate** (app. 01 rows 14-16; app. 03 dependency notes): after `getUser()`, hold on
  `fetchReadiness()`; `subjects.length === 0` OR `firstGenNeeded` → `/first-run`. `firstGenNeeded` = ready AND
  nothing in `GET /plans-prepared` AND nothing bound in `GET /section-state` AND no prior year in
  `GET /academic-year`; per-user module latch (`everGeneratedRef`/`latchUserRef`, page.jsx:399-439); unknown →
  never force. The route renders WITHOUT the bottom bar and without the gear (Phase 1 is shell-less — Q5 on
  where the gate lives; the web re-evaluates whenever `ready` flips).
- **Plumbing, bar, rail** (rows 72-86): `GET /account` first name · `GET /subjects` · `/subjects/{s}/grades` ·
  `/subjects/{s}/{g}/chapters` (`standard_duration_minutes`, `annual_budget_periods`, `recommended_periods`) ·
  `/genon/{s}/{g}/chapters` · `GET /entitlement` · the three-step marginal rail Subject · Class · Chapter.
- **Welcome** (rows 87-90) · **Step 1 Subject** (91-94) · **Step 2 Class** (95-99, with the stated section:
  "We'll start you with Section 9A", changeable in the profile) · **Step 3 Chapter** (100-109: chapter wheel
  `rowPx=92 clamp=2` from prepare.jsx, duration/periods boxes with the `periodsTouched`/`durationTouched` refs
  reset at different points — periods per chapter, duration per class — CoverageNote floor half, the CTA).
- **Activation + handoff** (rows 110-118): `buildActivationPayload(over)` / `finishActivation(over)` take the
  values as an ARGUMENT (one tick); seeds `DEFAULT_PPW 6` → `ppwFromAnnual(annual)` = round(annual/30), budget
  `{periods, annual}` from `/chapters`' `annual_budget_periods` (the 180-vs-245 lesson), all-−1 grid;
  `prepareAndHandOff` fires `POST /genon/{s}/{g}/{ch}/plan` un-awaited, holds `PREPARING_MS`, `startPreparing`,
  navigates to `/lessons` in the same tick → the ordinary proposed card; `POST /plans-prepared`;
  `saveReadiness` with the read-after-write; `onPrepareError` → failed card stays. Port prepare.jsx's
  `paywallPreparing` branch too (app. 03 open question 5 — recommended).
- **Login parity fixes** (cheap, no dependency — app. 03 rows 4, 6, 13, 20, 27-38): "Sign in" kicker + "Who's
  planning today?" · field label "Mobile number or email" + placeholder "98xxxxxxxx or you@example.com" ·
  "Enter →" · "🛡 Your data is private and secure · Privacy Notice" on the sign-in screen · `.ob-rule` · "→"
  on "New to Meyy? Get started →" · `MOBILE_TAKEN`/`EMAIL_TAKEN` into shared (row 47, the wording question Q21) · privacy screen version line / older-version hint / Back pinned at the head (rows 48-57).

**web.js:** app. 03 section N (`.fr-wheel-lg`, `.fr-rail*`, `.fr-welcome*`, `.fr-trial*`, `.fr-dur-*`,
`.fr-per-*`, `.fr-sec-stated`, the CTA sizes).

**Exit (a fresh test number):** sign in → Welcome → Subject → Class ("We'll start you with Section 9A") →
Chapter with 60 min × 16 → Prepare → lands in My Lessons on the proposed card → real card replaces it → My
Classes shows 9A → the profile on the web shows ppw/budget seeded from `/chapters` → sign out / in → no first
run again → erase the account → first run again.

### Step 6a — the shell layer (what page.jsx keeps above the tab)  🟡 **IN PROGRESS — F10's bar landed 2026-09-16; Q6, Q7, Q8 all answered**

*(**F4 `shared/account.js` already landed** — pulled forward on 2026-09-15 by a founder report that the bar still showed her mobile number after she had subscribed. `eadaad65`.)*

**Entry:** none; every item here is independent of the screens and most are stores. Do it before Settings so
Settings has state to read.

**Build (app. 01 sections C-G, J, K):**
- **F10** `(app)/_layout.jsx` becomes the shell: ✅ **`<Bar>` HAS MOVED INTO THE LAYOUT (Q8 = yes, 2026-09-16)**;
  `onSettings` → `/settings` waits for that route to exist in 6b (an inert gear is honest, a gear that
  navigates nowhere is not); `askOpen` + the Ask panel slot; `portalWin` (5d); a notices slot at the top of
  the scroller for `saveFailed` (row 18), `sectionFailed` (row 43 — install `setSectionMismatchHandler`, never
  installed today: a verified server disagreement is SILENT on the phone) and the privacy-note bar (row 44:
  `GET /legal/privacy/status` once per sign-in, "Meyy’s Privacy Notice has been updated (version {n})." ·
  "Read it" · "Dismiss" · `POST /legal/privacy/seen`). Export `BNAV_H` from BottomNav and replace the literal
  `56.85` in `lessons.jsx:665` (row 10) ✅ **DONE — `BNAV_H`**. `refreshBank()` on layout mount (row 24).
  `activeNav` → `null` on `/settings*` ✅ **DONE**.
- **F4** `shared/account.js` (row 29): `GET /account` → `display_name` first word capitalised ("" when
  numeric), `tour_offered_at`; cached like readiness; invalidated on `entSyncTick`. Bar shows the name over
  Log out; DashHead greets by name (row 28; app. 05 B7).
- **F5** `shared/entitlement.js` (rows 50-55): `fetchEntitlement` on mount + AppState active + 20 s while
  active; `lapsed` (`e.lapsed` ∥ `enforced && status==="expired"`), `trial`, `paidScopes`; lapsed → forced onto
  My Lessons, bar hides My Classes and Add (`showClasses={!lapsed}` `showAdd={ready && !lapsed}` — the props
  exist, never passed), prepare CTA hidden (app. 05 C17), profile read-only. ✅ **Q7 answered: PORT NOW** and let the
  server flag drive it (enforcement is off on Render, so this is dormant, not dead).
- **F6** `shared/year.js` (rows 56-57): `GET /academic-year` on ready + AppState active; `runCutover` = `POST
  /academic-year/cutover {confirm:true}` → `clearLocalSectionCache`, `clearLocalHistoryCache`, `clearPlans` /
  `notePlansYear(newYear)`, latch, re-pull. Then the My Classes **cutover offer** `.dash-nudge.yr-nudge` and
  **result card** `.yr-done` (app. 05 B8-B9; dismissal cadence Q17) and `notePlansYear` before every
  listing read (A3, C6).
- **Paywall parity** (row 47): the phone's sheet hardcodes "Your free chapters are used up" + "Close"; the web
  derives the kicker from the server sentence ("Free trial ends" / "Separate subscription" / "Subscription
  ended") and offers Subscribe / Not now. Align to the kicker rule. ✅ **Q6 answered: KEEP BOTH BUTTONS** — the web's
  shape exactly, Subscribe raising "Subscription page in development" until 6b's billing view
  exists and then pointing at it. The shape is what is being preserved: a teacher who learns this
  window today must not meet a differently-shaped one the week Subscribe starts working.

**web.js:** `set_bar_title/gear/x`, `tp_savefail`, `pn_note*`, `paywall_card/msg/later`, `dash_nudge*`,
`yr_nudge*`, `yr_x`, `yr_done*`.

**Exit:** bar shows "Priya" on every route; a forced section mismatch shows the caption; a bumped privacy
version shows the bar and "Read it" opens Legal; backgrounding and returning re-pulls entitlement; a lapsed
test account loses two bar items and lands on My Lessons; the cutover offer appears on a due account.

**Web owed:** page.jsx adopts the shared readiness/account/entitlement/year stores (today it fetches each
inline — app. 01 row 11 notes the readiness store is phone-only).

### Step 6b — Settings (seven subviews)

**Entry:** 6a (F4, F5, F10, the notices), F9 for the two exports and the invoice PDF, F11 Dropdown
replacement, Agreement read mode (app. 03 rows 59-71 MISSING (read)).

**Build (app. 04, in the web's JSX order):**
- **A. Entry, chrome, exit** (A1-A12): gear → `/settings` stack; frozen bar `⚙ {label}` + `✕` "Close {label}"
  with labels Settings · Personal profile · Subscription & billing · Your data & export · Support · About Meyy
  · Legal · Teaching profile; `settingsClose` = `router.back()` except the erased branch (→ `endSession`);
  bottom bar STAYS up (commit d87c7d99; fix BottomNav.jsx's stale header comment).
- **B. HOME list** (B1-B18) in the founder's frequency order, incl. Appearance (Q10: cycling glyph
  ◐ → ☀ → ☾ vs the phone's interim segmented control at `index.jsx:278-284`, which is deleted here), plan
  status (the counter is NOT gated on `enforced` — web rule 2026-09-11), Ask Meyy row, Sign out.
- **C. Personal profile** (C1-C13; hidden on trial): name, email (`EMAIL_TAKEN` via `idInUse`), Role/State via
  F11, school, `POST /account`, marketing email `/account/marketing-email`. ROLES/STATES lifted out of
  SubscribeFlow into shared.
- **D. Subscription & billing** (D1-D9): read-only status, scopes, `GET /invoices`, `GET /invoices/{number}`
  → `Meyy-invoice-{number}.pdf` via F9; "Subscribe" / "Add subjects & stages" NOT-PORTED — what shows instead
  is Q11.
- **E. Your data & export** (E1-E4; hidden on trial): `GET /data-rights/export?format=docx|pdf` →
  `aruvi-your-data.{docx|pdf}` via F9.
- **F. Support** (F1-F14; never hidden): form, `POST /support` with `context.screen` (Q13),
  "Message sent" + the MEY-S reference, `GET /support` history, the "add an email" link (Q12 — it
  dead-ends on trial on the web too).
- **G. Legal** (G1-G5): pinned pill band Agreement | Privacy; Agreement READ mode over `Markdown.jsx`
  ("Legal Agreement with User" · "✓ Accepted on {date} · version {v}" · intro + five `.lgl-ack` blocks ·
  version line) from `GET /legal/consent`; PrivacyNotice with the full version line and `?version=`.
- **H. About, farewell, delete** (H1-H6): typed "erase" → "Last step" modal → `POST /data-rights/erase` →
  receipt card; the delete-flow Word export via F9; both exits sign out (`onErased`, app. 01 row 23).
- **F11 Dropdown** (J1-J8): three live Settings uses; a `Sheet`-based picker styled to `.dd-btn` / `.dd-pop`.

**web.js:** the whole family is unmeasured — `set_*`, `acct_*`, `sup_*`, `lgl_*`, `dd_*`, `ob_field`,
`login_field`, `ob_email_view/addr` (list in app. 04 dependency notes; mind the ≤600 overrides).

**Exit:** gear → every row opens and ✕ returns one level → Support ticket lands with the next MEY-S number →
theme cycles and survives sign-out → export shares a docx → invoice PDF opens → delete flow signs out on the
receipt → the web sees the same profile/ticket.

### Step 6c — Ask Meyy

**Entry:** 6a (F10 `askOpen` slot). Bank/ETag/search/priming/clearing are DONE in shared.

**Build (app. 04 I1-I25):** the overlay component in the layout — scrim from bar bottom to `BNAV_H` (the bar
stays live, Ask item carries the clay, destinations lose it while open — app. 01 rows 83-85); top (title,
search with autofocus — the step-2 finding), count line, categories with the `accent` → `t.sec_a…d`/`t.ss_plum`
mapping (Q14: the stored `accent` strings), items expanding to answers via `Markdown`; Settings ›
Ask row opens the same panel.

**web.js:** `aa_*` (scrim, panel, top, title, q, close, search, count, body, cat*, item*).

**Exit:** bar item toggles the panel; search narrows; a category opens; My Classes closes it and goes; the
bank refreshes with a 304 on relaunch.

### Step 7 — exports (F9) and the lists' deferred items

**Entry:** F9 `mobile/lib/download.js` — one `saveAndShare(bytes, filename, mime)` over expo-file-system +
expo-sharing; **needs the founder's landing decision** (Q15: share sheet vs silent save). Native
dependency → the first development-build milestone (Expo Go may not carry it).

**Build (app. 05):**
- **Reports modal** (C30-C36): `ReportButton` "Create a report" bottom-right of each card; modal "Reports" ·
  sub · composition radio Lesson Plan / Assessment / Integrated · "Include answers / model responses"
  (assessment/integrated only) · PDF (default) / Word · Cancel / "Download {PDF|Word}" → `GET
  /api/plans/{s}/{g}/{file}/export/{lesson|assessment|integrated}?format=pdf|docx[&answers=1]`.
- **Year Plan export** (E8-E9): `ExportIcon` "Download this table as a Word document" → `POST
  /api/year-plan/export-docx`; status "Preparing your Word document…" / "Couldn't download the year plan.
  {reason} Tap the arrow to try again."
- **Prior years** (needs F6): `.ap-prior` folders in the attach picker (B16; `attachPriorChapter` A17 with
  `markPrepared(..., sourceYear)`), `.mlp-prior` folders in My Lessons (C37, C9), `YearStamp` on cards
  (B15/B23).
- **Return-with-section** (A9, D12, B17, D4): `/prepare` takes a `section` param; on success bind +
  invalidate in the closure and navigate to `/`; then the picker footer "Need a chapter you don't have yet?" ·
  "Prepare a new lesson →" and the web's "or build a new one" copy (B13). Q16 on the wait.
- **Section history** (A6, B19-B20): `pullSectionHistory` in the reconcile; the `.sc-hist` glyph; the popup
  "Section history" · "Where each chapter stands for this section." (`hasHistory` is computed at
  `index.jsx:351` and never rendered).
- ~~**Subject bands** (B11) when > 1 subject~~ — DONE 2026-09-16, with B11a (the named-section tag).
- **Small guards** the phone silently lost: `undefined`-vs-`{}` listing state → false "Pick a chapter to
  begin" / "No other lessons prepared" flash on a cold cache (B14, B21, B22 — `index.jsx:115,136`,
  `AttachSheet.jsx:89-95`); AppState + 20 s re-pull with the modal-open hold (A4/A5); `bindingsKnown` (A7);
  verify-mismatch in `prepare.jsx:308-316` must `failPreparing` on the card, not `setError` on a popped
  screen (D9 — the ARV-D-087 shape).

**web.js:** `sc_hist`, `ch_row`/`ch_pill` (3 states)/`ch_rail`, `ap_prior*`,
`ap_loading`, `mlp_prior*`, `rpt_*`, `sc_report`, `yp_export_btn/msg`, `yp_empty`.

### Step 8 — LessonView residuals and the parity debt

**Entry:** none. The port is full (100/140 DONE); this is polish, but it is also the family the teacher lives
in, so it precedes TestFlight.

**Build (app. 06 dependency notes, ordered):**
1. `web.js` — the 21 real checker disagreements (skip the 3 false positives: `lv_pvmid`, `assess_corr_row`,
   `assess_revrow`); measure the OWED classes (audio, choicepop, assess-table, nl, match, tf-row, otg,
   va-table, va-legacy, chev, donemark disc, undo pill, chapterdone tints); the assess green `#0f6e56` as a
   token (Q19); re-run `node mobile/theme/check-parity.mjs` to clean.
2. `LessonView.jsx` — `writePointer` clears `done` below the last unit (row 5); write the bookmark reset on a
   genuine unit change (row 81); AppState resync + re-pull (row 83 — the web listens on focus/pageshow/
   storage); bookmark centre offset from `ws.uv_phase`, not the literal 13 (row 75).
3. `ChapterOrg.jsx` — scroll the `cur` card into view (row 31); maths-prep 4-unit window + fade (row 30, app. 06 open question 4);
   SS `co-acc-name` 13 px and hide `co-count` for science/SS (rows 16/26); SVG chevron; `CN_ROMAN` full
   range; identity-coloured dots → the web's ink (row 37).
4. `AssessPanel.jsx` — inline forward-nav on the last row (row 95); audio icon + left rule (row 101); legacy
   `.assess-card` chrome (row 94); `SvgXml` on real corpus SVGs (row 102).
5. Mobile-only additions to name in headers or remove (rows 132-140): KeyboardAvoidingView on notes,
   error-screen copy and notes window below the bar (Q20), pine border on done cards.

### Step 8b — the GUIDED TOUR  ★ **UN-DEFERRED 2026-09-15 (founder: "yes undefer the tour")**

**It was never a product decision.** `docs/mobile_migration_assessment.md` §3 dropped it from the beta for
one reason — it is "the most DOM-bound file" — and the founder has now reversed that. So the phone gets the
web's twenty steps, and **Q9 dissolves rather than being answered**: the check-mood window keeps the web's
own tour-end trigger and the phone owes no substitute and no named divergence.

**Entry: THIS STEP IS A CAPSTONE, and that is a fact about its ANCHORS, not a preference.** §0's own rule —
"a section-less tour would point the hand at nothing and render `section undefined`" — applies to every step,
so the tour cannot be built before the things it tours. Audited against the phone as it stands
(2026-09-15): **16 of the 20 steps have a live anchor today**; four do not.

| Step | Anchor | On the phone today | Waits for |
|---|---|---|---|
| 1, 2 | `nav-classes`, `nav-lessons` | ✅ BottomNav | — |
| 3, 6 | `lesson-first` | ✅ My Lessons cards (4b) | — |
| 4 | `lesson-report` | ❌ `ReportButton` DEFERRED (app. 05 C30) | **step 7** (F9 downloads) |
| 5 | `lesson-archive` | ✅ DONE (app. 05 C28) | — |
| 7 | `preview-root` | ✅ LessonView (step 3) | — |
| 8, 14 | `section-add` | ✅ My Classes "+" (4a) | — |
| 9, 15 | `attach-pop` | ✅ `AttachSheet` | — |
| 10 | `section-card-target` | ✅ | — |
| 11 | `lesson-root` · `unit-tabs` | ✅ LessonView, full | — |
| 12 | `phase-bookmark` | ✅ `PhaseBookmark` | — |
| 13 | `mark-complete` | ✅ | — |
| 16 | `grow-add` | ✅ LIVE since `9a1546ec` | — |
| 17 | `settings-gear` | ❌ inert (`Bar.jsx disabled={!onSettings}`) | **step 6b** |
| 18, 19 | `ask-aruvi`, `ask-aruvi-root` | ❌ inert (`onAsk={() => {}}`) | **step 6c** |
| 20 | none (centred welcome) | ✅ | — |

So it lands **after 6b, 6c and 7** and before the build that goes to testers — hence 8b, not a renumber.
⚠️ Do NOT ship a partial tour that skips the four steps: they are the steps that introduce reports,
Settings and Ask Meyy, which is precisely what a first-time teacher has no other way to discover.

**Build.** Everything is already recorded in app. 01 rows 96-118 — all 20 steps' copy, anchors, placement
and chrome — so this is transcription plus re-measurement, not a redesign. What has to be REBUILT rather
than ported is the machinery, and it is the whole of the cost:
1. **A target registry replaces the DOM query.** The web does `document.querySelector('[data-tour]')`; the
   phone needs a context every anchor registers its ref with, measured on demand with `measureInWindow`.
   One registry, keyed by the SAME `data-tour` strings the web uses, so the step table stays one table.
2. **Measurement replaces the poll.** The web re-measures on a 200 ms interval plus resize plus a
   capture-phase scroll listener (`GuidedTour.jsx:159-214`). On the phone, measure on step change, on
   layout of the anchor, and on orientation — an interval is a battery cost with no payer.
3. **The ring is not a `box-shadow`.** The web cuts its spotlight with a 9999px box-shadow. RN has no such
   trick: draw the scrim as four Views around the ring's rect (or one `<Svg>` with an even-odd mask), which
   also gives the hit-blocking for free. The 2px ochre ring, r12, 180 ms transitions are in row 116.
4. **Scrolling.** `scrollTop` steps pin `.bodycontent` to 0 (row 118) — the phone has no such scroller, so
   each route's own ScrollView ref is what gets pinned; `scrollIntoView({block:"center"})` becomes
   `scrollTo` computed from the measured rect.
5. **`finishTour`** — the single exit for Done AND Skip — closes Ask, clears the tour, session-dismisses,
   goes to My Classes and raises the check window `{mode:"check", reason:"tour"}` (app. 01 rows 62, 74-75).
   **That last clause is what closes Q9**, and `shared/setupCheck.js` (F3, `65c1bf1d`) already holds the queue.
6. **The offer** (app. 01 rows 59-61): `tourEligible` (GET `/section-state` → ≤1 bound section and no
   progress), `tourSpent` from `/account`'s `tour_offered_at` (F4 `shared/account.js` already fetches it),
   POST `/account/tour-offered` once, and the "Let me show you around first" nudge on BOTH My Classes and
   My Lessons. Copy verbatim in row 61.

**web owed:** none — the web has had the tour since before this map.

**Exit:** run all twenty on the handset, end to end, on a profile that qualifies (≤1 bound section, no
progress) — and the twenty-first thing to check is that Done AND Skip both land on the check window.

### Step 9 — TestFlight / Play internal

**Entry:** everything above that touches a native module (F9) forces a **development build** (EAS) — Expo Go
carried the product this far because every dependency so far was JS or bundled (`expo-sqlite/kv-store`,
react-native-svg, safe-area). The MMKV swap the plan reserved for this milestone is optional (the kv-store shim
holds the contract).

Real SMS (DLT) is the external long pole and is outside this map (Track B).

### Deferred beyond the beta (recorded, not scheduled)

- ~~**GuidedTour**~~ — ★ **UN-DEFERRED 2026-09-15 (founder). It is now step 8b**, a capstone after 6b/6c/7
  because four of its twenty steps anchor on doors the phone has not opened yet. Its rows (app. 01 96-118)
  are a BUILD SPEC now, not a record. Q9 dissolved with it.
- **SubscribeFlow / purchase** — beta on manual grants (assessment §5B). Eleven rows across app. 03 D and
  app. 04 D name exactly what stays out.
- **Dead web code, never ported:** Readiness.jsx (app. 05 R1 — only importer `MyPlans.jsx:7`, unreachable since
  `page.jsx:1081` returns FirstRun for every `!ready`), GenerateTab's `!ready` gate and `mode:"pick"` picker,
  ViewModelView (reached only from PrepareLesson's `preview` step, which never runs with `onPrepared`),
  TeachingProfile's generic `confirm`/`doRemove`, `addSection` screen, auto-add plumbing, `portalIntent=
  "subject"`. Worth deleting on the web so the next reader does not port them.

---

## 3. Cross-cutting rules for every step

- **Parity is checked, not assumed.** Before a screen reaches the phone: `node mobile/theme/check-parity.mjs`
  clean for its classes; the standing `ws.*`/`type.*` key-existence check; the parity page at 390 beside the
  web. Look for a LAYERED class before measuring a button (`prepare-cta` on `.mlp-allocate-btn` — the lesson
  of 5a). Phone sizes are the ≤600 px values, placed AFTER the base rules (the `.ap-row-line` trap, four
  sightings).
- **The phone matches the web by default.** Every divergence in this map is either a technical limitation
  (no keyboard, no CSS gradient/keyframes, no position:fixed pop, nested buttons on react-native-web, routes
  instead of a shell) or a phone capability (share sheet, OTP autofill, AppState refresh) — and each is named
  in the component header. Anything else in the "Open questions" lists is a product change and waits for the
  founder.
- **One function, both surfaces.** Any arithmetic the phone needs that lives in a web JSX file is lifted to
  `packages/shared` first, with a node test, and the web re-imports it (`budget.js` is the template;
  `wheels.jsx:434-483` is next). The 2026-08-21 Year Plan defect (14 vs 19) is the reason.
- **Stores, not props, above the routes.** The phone's routes have no shell; `lib/preparing.js` proved the
  idiom (module descriptor + subscribe that fires immediately). Data (entitlement, account, year, readiness)
  goes in shared stores; UI state (`askOpen`, `portalWin`) in `(app)/_layout.jsx`.
- **Every screen paints from the device copy** (the 4b speed pass) and treats a 401 as a refusal, not a
  network failure (`endSession`).
- **Web changes ride along.** Each step lists what the web takes at the same time; the shared stores in
  particular should replace page.jsx's inline fetches so the two surfaces cannot drift.

---

## 4. Founder decisions this map waits on

Consolidated from the six appendices (their numbering in brackets). The first five block a step; the rest can
be answered when the step is reached. **Answered questions stay in the table, struck through with their
answer** — the reasoning is worth more than the row.

**Due next:** none blocking. **Q6, Q7 and Q8 were answered on 2026-09-16** as 6a opened; the next questions bind at 6b (Q10, Q11, Q12, Q13) and 6c (Q14).

| # | Blocks | Question |
|---|---|---|
| ~~Q1~~ | 5c | ✅ **ANSWERED 2026-09-15 — HOLD.** The budget screen was built and left unreachable until the numbers editor existed; both pencils lit together in `ff8cf0c1`. 5c folded into 5d. |
| ~~Q2~~ | 5c | ✅ **ANSWERED 2026-09-15 — LEAVE BOTH, RECORDED.** They cannot disagree on the one shape now written; the divergence is written into `budget.js`'s header and revisited the day a legacy record turns up. |
| ~~Q3~~ | 5d | ✅ **ANSWERED 2026-09-15 — ADD MODE ONLY.** Port the pick-subjects wheel in add mode, matching the only door the web offers. Removing a subject stays in the Settings accordion (step 6); nothing on the phone the web cannot also do. |
| ~~Q4~~ | 5d | ✅ **ANSWERED 2026-09-15 — AMEND ON BOTH.** Now "To remove the whole class, use Class in the Add window." Fixed on the web in the same commit as the port; the phone never carried the stale wording. |
| ~~Q5~~ | 5e | ✅ **ANSWERED 2026-09-16 — THE LAYOUT.** `(app)/_layout.jsx`, so the question is re-asked whenever her profile changes: decided once on the way in, a profile wiped mid-session would leave her in a shell with nothing behind it until she relaunched. It paints from the device copy first, so a returning teacher meets no gate at all. |
| ~~Q6~~ | 6a | ✅ **ANSWERED 2026-09-16 — MIRROR THE WEB, BOTH BUTTONS.** Founder: *"for now, mimic web to add 'Not Now' button + Subscribe button. Clicking the latter can simply show up window saying 'Subscription page in development'. Once we develop the Subscribe page under settings, we will connect it to the former."* So the phone takes the web's derived kicker and the server's own sentence, and keeps the two-button shape — ★ **the shape is what is being preserved, not the wiring**: a teacher who learns the paywall today must not meet a differently-shaped one the week Subscribe starts working. Subscribe raises a plain "Subscription page in development" until 6b's Subscription & billing view exists, and then points at it. Struck the option of naming support@meyy.in: an email address is what you offer when there is nothing coming, and there is. |
| ~~Q7~~ | 6a | ✅ **ANSWERED 2026-09-16 — PORT NOW, THE SERVER FLAG DRIVES IT.** `shared/entitlement.js` and every consequence the web has (forced onto My Lessons · My Classes and Add out of the bar · the prepare CTA hidden · the profile read-only · the "+" window refusing to open) ship with 6a, dormant until enforcement is turned on at Render. The alternative was a phone that quietly disagrees with the web for however long the beta runs, and a list of consequences to remember on the day the flag flips. `paidScopes` is needed by 6b's choosers regardless, so the store was never really optional. |
| ~~Q8~~ | 6a | ✅ **ANSWERED 2026-09-16 — YES** (founder: *"yes agreed"*). Eleven per-route copies became one, in `(app)/_layout.jsx`. It is not tidiness: five of those eleven passed no `user` and so shed the bar's right-hand half (the 2026-09-14 "the login and wheel on top right bar disappears" report) — the default added that day PATCHED it; this removes the thing that can be got wrong. And the rest of 6a needs the anchor: the notices belong to the app rather than to whichever screen is showing, as do the gear and Ask Meyy's panel. Done FIRST, before those land on top of it. |
| ~~Q9~~ | 6a | ⚠️ **AMENDED 2026-09-16 — the phone needed the trigger BEFORE the tour.** The answer below left first run's own check window with nothing to raise it until 8b, and the founder met exactly that on his first walk: the window never came. My Classes now raises it from a one-shot first run leaves; when the tour lands, one of the two triggers must go. Original answer: ✅ **DISSOLVED 2026-09-15 — THE TOUR IS UN-DEFERRED** (founder: "yes undefer the tour"). The question only existed because deferring the tour removed the web's tour-end trigger and left a brand-new teacher with no moment to check what Meyy guessed for her. With the tour ported (step 8b) the phone inherits that trigger unchanged: **no substitute, no named divergence.** The added-subject trigger is unaffected and ships with 5d; the tour-end one simply starts firing when 8b lands. |
| ~~Q23~~ | 5e | ✅ **ANSWERED 2026-09-16 — HIDE IT.** The phone's bar drew an inert ⚙ wherever a user existed, including on first run, where the web has no gear at all (Phase 1 is shell-less). `Bar` takes `gear={false}`; identity and Log out stay, as they do on the web. [03·4] |
| ~~Q24~~ | 5e | ✅ **TAKEN AS RECOMMENDED 2026-09-16.** A 402 on first run raises the paywall window rather than rendering a failed card — prepare.jsx's rule, which the web's own first run lacks. A paywall is not a failed build. [03·5] |
| Q10 | 6b | **Appearance control shape**: the web's cycling glyph (◐ → ☀ → ☾) 1:1, or keep the phone's Auto/Light/Dark segments as a named divergence? [04·1] |
| Q11 | 6b | **Subscription & billing with no purchase screen**: nothing, or a sentence pointing at the website/support? (Also "Online payments open soon…" reads oddly with no button.) [04·3] |
| Q12 | 6b | **Support's "add an email" link on trial** dead-ends on the web too (Personal profile hidden). Hide on trial, or open Personal profile for the email field alone? [04·2] |
| Q13 | 6b | **Support `context.screen`**: same string as the web, or an "(app)" marker so tickets say which surface? [04·4] |
| Q14 | 6c | **Bank `accent` values**: confirm the five stored strings, or add a token NAME field to the bank so neither surface parses CSS. [04·5] |
| Q15 | 7 | **Where a downloaded document lands**: share sheet (Files / WhatsApp / mail) or silent save to Files? Both Reports and Year Plan wait on this. [05·1] |
| Q16 | 7 | **Prepare-from-a-card wait**: keep the web's in-place wait, or land on My Classes with the chapter bound after the 5 s beat? [05·2] |
| Q17 | 7 | **Cutover offer dismissal cadence** on a phone that is rarely "signed in again": per launch, per day, or never persisted as the web? [05·4] |
| Q18 | 8 | **Speak** only focuses the text area on both surfaces (the web never used the Web Speech API). Intended, or add a real recogniser as a phone capability? [06·1] |
| Q19 | 8 | **Assess accent green `#0f6e56`** (distinct from `--pine` on the web) — add a token, or let the phone's pine stand? [06·5] |
| Q20 | 8 | **Chapter Notes placement** (phone: below the bar; web: centred) and the phone-only error-screen copy — which surface follows which? [06·2, 06·3] |
| ~~Q22~~ | 5d | ✅ **ANSWERED 2026-09-16 — HOLD TO 6a.** *Where does "add a subject" get reached from on the phone?* The web's only door is the Settings accordion's "+ add a subject", and the portal footer ("Want to see your full teaching profile?") is a no-op until Settings lands. Offered three ways — hold; pull a minimal read-only panorama forward behind the footer; or a temporary Subject row in the Add window — the founder chose **HOLD**, the same call as Q1: do not ship a screen nothing reaches. The pick-subjects wheel and the per-class run (§2 item 9) are built with the accordion in 6a. The window's own rule stands: no Subject row, in either mood. |
| ~~Q21~~ | 5e | ✅ **ANSWERED 2026-09-16 — BOTH SETTLED.** (a) The OTP lock is KEPT and is now the rule on both surfaces, named rather than an unnamed phone divergence: the code went to that number, so an editable field under the boxes lies about where it went. (b) `MOBILE_TAKEN` takes the WEB's words — she is at the create door, where the instruction is to create, and whoever typed the number is not owed the news that it holds an account. Both constants now live in `@aruvi/shared/format`. |

---

## 5. Reading the appendices

Each appendix has the same shape: **Web source map** (every function/block with line ranges) → **Mobile
counterpart map** → **Inventory table** grouped in the web's JSX order (`#` · feature · web ref · status ·
mobile ref · depends on · notes/native answer) → **Dependency notes** (what must land first; what the family
unlocks) → **Open questions**. A row's "Depends on" column is the join to §1 above. When a step in §2 cites
"app. 04 F1-F14", that is the row range in that appendix's section F.

Snapshot caveat recorded in 01/04: `web/app/lib/{format,verify,sectionState,sectionHistory,auth}.js` and
`web/app/ask-aruvi/{bank,askAruviSearch}.js` are one-line re-exports and were not staged; their refs point at
`packages/shared/src`, which is the real logic on both surfaces. App. 06's parity-checker section is a RUN
(node 22), not a derivation.
