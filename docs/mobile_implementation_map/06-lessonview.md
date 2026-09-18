# Lesson View family (LessonView · ChapterOrg · Assess · PhaseBookmark · Chapter Notes)

Scope: `web/app/components/LessonView.jsx` (2330 lines) against `mobile/components/LessonView.jsx`,
`mobile/components/lesson/{ChapterOrg,AssessPanel,PhaseBookmark}.jsx`, `mobile/app/(app)/lesson.jsx`,
`packages/shared/src/sectionState.js`, `mobile/theme/web.js`, `mobile/theme/check-parity.mjs`.
`mobile/components/Markdown.jsx` was read and is NOT a counterpart of anything here (it renders the
legal documents from `@aruvi/shared/legalmd`; nothing in LessonView is markdown — `boldMarks`/
`parseBold` handle the only inline markup, `**bold**` in homework).

Headline: the family is ported in full and the port is unusually faithful — every screen, state,
string and template branch in the web has a counterpart. What remains is (a) a short list of
BEHAVIOURAL residuals (cross-device bookmark resync, the org page's scroll-to-"now", the maths-prep
capped wheel window, the bookmark-reset write, the `done` clear on moving back, `writePointer`'s
last-unit rule), (b) the SKIN debt — the parity checker was RUN here (node 22, stdlib only) and the
LessonView-family disagreements are listed verbatim in §Parity-checker section, plus colour drifts
the checker does not look at, and (c) a handful of copy/structure nits.

I ran `node mobile/theme/check-parity.mjs` against the snapshot: **23 source-order ties, 33 value
disagreements** (the plan's "35" was the count on 2026-09-14; two have since been fixed). 22 of the 33
belong to this family.

---

## Web source map

`web/app/components/LessonView.jsx`
- 1-24 header comment: tracking vs preview modes, assess tags along as a tab.
- 28-39 `flattenUnits(lp)` — groups[].periods[] (children walked) → flat unit list carrying `context` ("A · B") + `groupType`.
- 42-43 `phaseMin(ph)` — end_min − start_min, null when unparsed.
- 61-66 `unitAssessItems(assessment, u)` — items whose `meta.anchor_period === u.number`; legacy (no anchors) → all.
- 69 `CTX_LABEL` axis names.
- 71-118 `OverviewPanel` — ledger rows Chapter · {Section|Spine|Stage|Competency} · Time · Pedagogy; SS/edge-model shows `section_anchor`; empty → "No overview details recorded for this unit."
- 120-159 `MaterialPanel` — `<ul>` materials, legacy string aid, typed `visual_aids` (table w/ caption/header/rows/source_note; prose) → "Nothing to prepare — this unit needs no materials."
- 178-262 `PhaseBookmark` — pointer-drag arrow (setPointerCapture), snaps to nearest `.uv-ph-time` centre, ↑/↓ keys, `aria-label`, `title`, `data-tour="phase-bookmark"`.
- 264-342 `LessonPanel` — teacher-notes `<details open>` ribbon (bold "Refer to Prepared Table…" lead), phase spine w/ bookmark, legacy `activities` fallback, Homework block via `boldMarks`.
- 355-419 `AssessPanel` — pager "← Previous / Question n / N / Next →", item sub-tab bar, sticky group measured against `--nav-h` + `.lv-stick`; `AssessBody key={idx}`.
- 427-466 `useUnitTabsParts` — Overview · Material · Lesson · Assess(if items) bar + panel; `lessonFooter` only on Lesson tab; mathsMiddle/mathsSecondary flags.
- 471-482 `PreviewUnit` — `.lv-stick` (header + bar) + panel.
- 496-518 `ANumberLine` (SVG axis) · 521-548 `ATyped` (svg via `dangerouslySetInnerHTML` / number_line / table / prose|passage) · 551-559 `ABlock` · 565-581 `AScaffold` · 588-602 `APartsList`.
- 624-648 `GROUPED_LABEL` / `splitLabel` / `groupedOptionSets` (compound items, exported).
- 652-661 `AAnswerBlock` · 664-672 `ATicks` · 677-729 `AReveals` (+ "Choice X" popup dialog) · 732-749 `ALegacyCard`.
- 774-789 `QTYPE_NAME` / `qtypeName`.
- 791-838 `AOverviewPanel` (Competency · Learning outcome · Section · Question type · Cognitive demand; nav rides last row).
- 840-981 `AQuestionPanel` (passage, TF, compound interleaved, parts, plain stem; audio_ref cue; stimulus; plain options; WHAT TO PRODUCE; SCAFFOLD; `<details>` READING THIS TASK; TEXTBOOK EXERCISE).
- 983-1096 `AAnswerPanel` (TF key; CORRECT ANSWER ✓; per-template blocks).
- 1100-1117 `itemTabSet` (Overview · Question · Answer? · Inclusivity?).
- 1129-1164 `InclusivityText` (Support/Stretch/Challenge bolding, maths row split).
- 1170-1237 `AssessBody` (Q{n}. mark, tab panels, "Question →"/"Answer →"/"Next question →" inline nav with Enter/Space keys).
- 1248-1265 `CN_CAP`=500, `cnWordCount`, `CN_GUIDE` placeholder, `CN_ROMAN` I…XII, `cnSubjectGrade`.
- 1272-1351 `ChapterNotesModal` — backdrop-click close, head (kicker/title/subject·grade/child-privacy warning/✕), ruled textarea (autofocus unless readOnly), foot: Speak (focuses textarea) + "{wc} / 500 words" + Save, or lapsed: "Renew to write notes — what you wrote stays yours." + Close.
- 1360-1368 `sectionTitleOnly` · 1374-1378 `truncateWords`.
- 1393-1399 SS tier/dots/ribbon widths/colour list.
- 1401-1577 `SSFlowBody` — bipartite units↔competencies map, ribbons measured via `getBoundingClientRect`, tap-to-focus dims, unit popup (second door, keyboard), competency popup, dormant `wheelOn`, gap note, hint.
- 1584-1948 `ChapterOrg` — entitlement lapsed → notes locked; notes cache+`GET/POST /plan-notes` reconcile + legacy lift + 409 adopt; accordion (one open, defaults to pointer's group); scrollIntoView of `.cur`; mathsFlat (4-unit capped wheel window); ssFlow; frozen header (kicker · "← back", title, "{n} Learning Unit(s) 3 × 40 min", tick rail, hairline, axis legend + ochre "Notes" gutter tab).
- 1950-2330 `LessonView` — keys `lu_pointer_{sk}`/`lu_done_{sk}`; `cur`, `showOrg` (org until pointer>0 or done), `undoTo`, `showFullPlan` (dead), `previewAt`, `doneFlag`, `setDone`, `writePointer`, `markComplete`, `undoComplete`, bookmark phase state + reset-on-unit-change + focus/pageshow/storage resync; empty-plan state; org altitude; `pvGoto` scroll reset; `goOrg`; `pvNav` strip (dropped-section paging); preview header ("← Orgn."); tracking header; completionUI (Mark this unit complete / Mark chapter complete / ✓ Unit complete ↺ Undo / ✓ Chapter complete ↺ Reopen).

## Mobile counterpart map

`mobile/components/LessonView.jsx` (355)
- 1-19 header naming the translations (frozen header = View outside ScrollView; bookmark = PanResponder + tap-on-minutes; `<details>` = Pressable).
- 36-45 `flattenUnits` (exported) · 48-52 `unitAssessItems` · 54-55 `phaseMin` · 57 `CTX_LABEL`.
- 60-77 `OverviewPanel` · 80-100 `MaterialPanel` · 101-117 `AidTable` (horizontal ScrollView) · 120-177 `LessonPanel` (notes ribbon toggle, onLayout-measured phase rows → bookmark centres, homework via `parseBold`) · 183-210 `PreviewUnit` (pinned block + ScrollView with `tail`).
- 212-334 `LessonView` — `tracking = !!sectionKey && !preview`; `cur`/`showOrg`/`previewAt`/`doneFlag`/`undoTo`/`bkmkPhase`; `writePointer` → `setUnitPointer`; `setDone` → `setChapterDone`; empty state; org; `pvNav`; header ("← Orgn."); completionUI; `PreviewUnit key={previewAt}`.
- 336-350 `NavBtn` / `MarkBtn` / `DoneCard`.

`mobile/components/lesson/ChapterOrg.jsx` (463)
- 20-23 `kickerOf` · 25-37 `sectionTitleOnly`/`truncateWords` · 39-53 CN consts (`CN_ROMAN` = {3..10} only) · 55-61 `AXIS_INFO` · 63-65 SS consts.
- 70-90 `UnitCard` (`.co-card`, numberOfLines 2, `tight` for science/SS).
- 93-196 `SSFlowBody` (onLayout-measured ribbons, react-native-svg Path, focus/dim/popups, gap note, hint).
- 199-208 `MicIcon` · 223-304 `ChapterNotesModal` (Modal below the bar, ruled-paper Views behind a transparent TextInput, no autofocus — named, Speak focuses, counter, Save / lapsed Close).
- 306-455 `ChapterOrg` (entitlement lock, notes reconcile via `storage`, accordion, mathsFlat plain list, ssFlow, frozen header + axis legend + rotated "Notes" tab).
- 457-459 `AxisRow`.

`mobile/components/lesson/AssessPanel.jsx` (450) — the full family: consts 17-49, blocks 53-98, `ANumberLine` 101-120, `ATyped` 121-147 (`SvgXml`), `AOverviewPanel` 150-169, `OptList` 171-182, `AQuestionPanel` 184-250, `AReveals` 252-284 (Modal popup), `AAnswerPanel` 286-334, `InclusivityText` 336-359, `ALegacyCard` 361-371, `TabNav` 373-375, `AssessBody` 377-403, `AssessPanel` 405-444.

`mobile/components/lesson/PhaseBookmark.jsx` (68) — Animated + PanResponder; snaps; `accessibilityRole="adjustable"`.

`mobile/app/(app)/lesson.jsx` (62) — route: params `{subject, grade, filename, section}`; `pullSectionState([sectionKey])` then `GET /plans/{s}/{g}/{file}/view`; loading "Opening the lesson…"; errors; renders `LessonView` (never passes `preview`; preview ≡ no section).

`packages/shared/src/sectionState.js` — `readLocalBookmark`/`writeLocalBookmark` (147-176), `readUnitPointer`/`setUnitPointer`/`readChapterDone`/`setChapterDone` (183-207, added for the phone; web still writes inline), `pushSectionState` (coalesced), `pullSectionState`.

`mobile/theme/web.js` — keys `lv_*` (145-205), `uv_*` (151-215), `assess_*` (218-256), `co_*` (258-327), `cof_*` (330-346), `cn_*` (354-400). No `a_*` prefix exists; the assess keys are `assess_*`.

`mobile/theme/check-parity.mjs` — A: for every multi-class `className` in web JSX, properties two classes both declare (winner/loser). B: each `ws.<key>` whose `key.replace(/_/g,"-")` is a CSS class, compared on font-size / letter-spacing / text-transform ONLY (not colour, not spacing), combo-aware, own-value-first then `_child`/peer fallback. Exits 1 on any tie or mismatch.

---

## Inventory table

Status vocabulary: DONE · PARTIAL · MISSING · DEFERRED · NOT-PORTED-BY-DECISION · WEB-ONLY-BY-NATURE.
W = web LessonView.jsx; M = mobile LessonView.jsx; CO = lesson/ChapterOrg.jsx; AP = lesson/AssessPanel.jsx; PB = lesson/PhaseBookmark.jsx; R = app/(app)/lesson.jsx; SS = packages/shared/src/sectionState.js; WJ = mobile/theme/web.js.

### A. Entry, props, data, keys

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes / native answer |
|---|---|---|---|---|---|---|
| 1 | Props `{view, sectionKey="", onExit, preview=false}` | W:1950 | DONE | M:212 | — | Mobile also receives an unused `meta` prop from R:58 (mobile-only, harmless). |
| 2 | Preview mode = `preview` prop (My Lessons passes `preview`, MyLessonPlans.jsx:725); tracking = has `sectionKey` (MyPlans.jsx:596) | W:1950, 2120-2137 | PARTIAL | R:24, 58; M:219 | lessons.jsx:308, index.jsx:163 | Mobile never passes `preview`; it is INFERRED: `tracking = !!sectionKey && !preview`. Same outcome today (web never opens a section-less plan un-previewed), but the web's third combination — `sectionKey` empty AND `preview` false — falls to the legacy key `lu_pointer_{subject}_{grade}_{title}` (W:1961) which mobile has no equivalent for. Legacy path; note only. |
| 3 | `lu_pointer_{sk}` read → `cur`, clamped to `[0, units.length)` | W:1961, 1967-1971 | DONE | M:221 via SS:183 `readUnitPointer` | `@aruvi/shared/sectionState` | Web `Number(null)`→0; shared returns 0 for absent. Equivalent. |
| 4 | `lu_done_{sk}` read → `doneFlag` | W:1964, 2019-2022 | DONE | M:240 via SS:196 | shared | |
| 5 | `writePointer(i)`: clamp, set, store, **`setDone(false)` if moved off last unit**, push | W:2032-2039 | **DONE** (2026-09-17) | M:250 via SS:187 `setUnitPointer` | shared | Mobile does NOT clear `lu_done_` when the pointer moves back below the last unit. Reachable only via cross-device drift / `Reopen` paths; add `if (n < total-1) setDone(false)` to match. ★ **2026-09-17 reconcile:** `LessonView.jsx` `writePointer` now clears `done` when the pointer lands below the last unit. ★ Without it an undo from the final unit left `done` TRUE under a moved pointer — and `done` is what paints the section card clay and what the history ledger reads as "completed", so she would have undone the completion on screen and left the chapter still filed as finished. `setChapterDone` pushes, so the correction reaches her other device |
| 6 | Pointer stored as string; `0` stored as "0" | W:2035 | **DONE** (2026-09-18) | SS:190 | — | Shared `setUnitPointer` REMOVES the key at 0 ("mirror pullSectionState"). Reader-equivalent, but the web's own `writePointer` still writes "0" — the two apps disagree on disk shape for the same state; harmless, worth unifying by moving the web onto the shared helpers (plan says "web keeps its inline copy for now"). ★ **2026-09-18 reconcile:** the web's `writePointer` now goes through the shared `setUnitPointer` when tracking, so unit 0 is stored as no key on both surfaces (the section-less legacy key keeps its old write). |
| 7 | `setDone(v)`: state + key + `pushSectionState` | W:2023-2030 | DONE | M:251 via SS:201 | shared | |
| 8 | `markComplete`: last unit → pointer=last, done=true, `setUndoTo(null)`; else advance + `undoTo=from` | W:2044-2049 | DONE | M:252-255 | — | Mobile omits the explicit `setUndoTo(null)` on the last-unit branch; `undoTo` is already null there (pvGoto clears it), so same behaviour. |
| 9 | `undoComplete` | W:2050-2054 | DONE | M:256 | | |
| 10 | Landing rule: org page until pointer>0 OR done; preview always org | W:1972-1997 | DONE | M:222-238 | shared readers | Comment carried verbatim on both sides (founder 2026-09-14). |
| 11 | `previewAt` initial = stored pointer | W:2009-2013 | DONE | M:239 (= `cur`) | | |
| 12 | Empty-plan state: "← back" + "This plan has no units." | W:2115-2117 | DONE | M:259-268 | WJ `back_tr`, `empty` | Web uses class `back` (not `back-tr`) here; mobile uses `back_tr`. Skin nit. |
| 13 | Fetch of `/plans/{s}/{g}/{file}/view` happens in the CALLER | MyPlans.jsx:292, MyLessonPlans.jsx | DONE | R:25-27 | `getJSON`, `pullSectionState` | Mobile route pulls the section's server state BEFORE the fetch (loading holds until both). Web pulls at app load (page.jsx) — equivalent guarantee. |
| 14 | Loading copy while opening a plan | MyPlans.jsx:595 "Opening plan…" | **NOT-PORTED-BY-DECISION** (2026-09-17) | R:39 "Opening the lesson…" | | String differs. Belongs to the My Classes family's row list too; flagging here since it is in lesson.jsx. ★ **2026-09-17 reconcile:** ✅ **Q20 (2026-09-17) — A NAMED DIVERGENCE.** The phone's loading and failure copy is its own and STAYS; the web fails silently here. Named in `app/(app)/lesson.jsx`'s header as a phone ADDITION under CLAUDE.md §0's second allowance — not a gap in the port. ⚠️ The web still owes its teacher an answer here; recorded, not taken |
| 15 | Open-failure copy | MyPlans.jsx:294 `.catch(() => {})` (silent) | **NOT-PORTED-BY-DECISION** (2026-09-17) | R:29-30 "This lesson could not be found." / "Couldn't load this lesson right now." / "Nothing to show." / "‹ Back" | | Web fails silently (stays on the list); mobile shows an error screen with strings the web never says. Better behaviour, but it is copy the web does not have — founder call whether the web adopts it. ★ **2026-09-17 reconcile:** ✅ **Q20 (2026-09-17)** — same answer as row 14: the phone keeps "This lesson could not be found." / "Couldn't load this lesson right now." with a way back, and the difference is recorded rather than resolved |

### B. Chapter Organization (front door)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes |
|---|---|---|---|---|---|---|
| 16 | Wrapper `.lessonview.co-view[data-subject]` (drives science/SS-specific CSS) | W:1821 | **DONE** (2026-09-17) | CO:403; `tight` prop CO:383 | | `data-subject` CSS does three things at ≤600px: `.co-utitle` 10.5px for science/SS (ported as `tight`), `.co-acc-name` 13px for SS (NOT ported — mobile 14.5 for all), `.co-count` hidden for science/SS (NOT ported — mobile always shows the count). ★ **2026-09-17 reconcile:** `ChapterOrg.jsx`'s accordion head reads its subject: `co_acc_name_ss` (13px) layers over the base 15px for Social Sciences, whose heads are COMPETENCY STATEMENTS — whole sentences where science has two or three words. ⚠️ A separate key rather than a branch inside `co_acc_name`, so the parity checker can still read the base rule |
| 17 | Frozen header block `.co-stick` | W:1824-1856 | DONE | CO:404-420 | WJ `co_stick` | Native: View above the ScrollView. |
| 18 | Top row: kicker "{subject}·{GRADE}·Ch. NN" + "← back" (`onBack`=onExit), `data-tour={backTour}` | W:1825-1833 | DONE | CO:405-408, `kickerOf` CO:20 | | Tour deferred. |
| 19 | `.co-title` chapter title | W:1835 | DONE | CO:410 | WJ `co_title` | |
| 20 | `.co-meta` "{n} Learning Unit(s){ 3 × 40 min. 4 × 50 min}" (durParts joined ". ") | W:1748-1758, 1836-1838 | DONE | CO:356-360, 411 | | Identical arithmetic + string. |
| 21 | Tick rail `.co-rail` (tracking, not ssFlow) w/ `aria-label "{taught} of {total} units taught"`; tick done=pine, cur=OCHRE, else `--line` | W:1841-1847; css 3735-3737 | **DONE** (2026-09-17) | CO:412-416; WJ:266-269 | WJ `co_rail/co_tick*` | Colour drift: web `.co-tick.cur` is `--ochre`; mobile `co_tick_cur` is `t.clay`. Base tick web `--line`, mobile `t.card_tick`; height 5 vs 4, gap 2 vs 3. Checker does not compare colour. ★ **2026-09-17 reconcile:** the rail's current tick is OCHRE at 5px, matching the section card's own rail. It was clay at 4px — and clay is the UNIT NUMBER's colour on this same screen, so the "you are here" mark and the unit strip read as one axis |
| 22 | `.co-headrule` clay hairline | W:1850 | DONE | CO:418; WJ:270 | | |
| 23 | Axis legend `.co-axiswrap/.co-axis` — rows "The map" (ssFlow) / "Units" (mathsFlat) / AXIS_INFO per type + " Click each card to access units underneath."; frozen except in ssFlow where it scrolls | W:1766-1807, 1855-1857 | DONE | CO:389-395, 419, 422 | | All five blurbs verbatim (incl. "Click each card…", a web word on a phone — same on both). |
| 24 | "Notes" gutter tab `.co-notetab` (vertical-rl text, ochre fill), `aria-label` "Chapter notes — edit/add", `title`=note text | W:1810-1817 | DONE (title WEB-ONLY-BY-NATURE) | CO:396-398 | WJ `co_notetab*` | Vertical text via `rotate -90deg` + fixed width 58 (translation). Hover title has no native answer (could be a long-press preview; not asked for). |
| 25 | Accordion: one open (`openIdx`), default = group holding the pointer, re-tap closes (-1), `aria-expanded` | W:1661-1675, 1902-1933 | DONE | CO:346-352, 430-447 | | |
| 26 | Accordion head: label (science section number stripped; SS competency truncated to 12 words while closed), `.co-count`, SVG chevron rotating 180° | W:1910-1929 | **DONE** (2026-09-17) | CO:435-443 | WJ `co_acchead/co_acc_name/co_count` | Chevron is a "⌄" text glyph rotated, not the web's 12×12 SVG path; count not hidden for science/SS on phone (row 16). ★ **2026-09-17 reconcile:** the unit COUNT is now hidden for science and social_sciences (both already carry a rail, and a bare number competes with a long label), and the rotated "⌄" Text glyph became a 12×12 SVG path — a rotated text node carries its own baseline offset, which is why it sat low in the row |
| 27 | Group bar `.co-groupbar/.co-subname` for nested labels | W:1712-1718 | DONE | CO:377 | WJ `co_subname` (checker: 9 vs 11) | |
| 28 | Flat index `idx` advances across ALL groups (open or not) so unit numbers are chapter-wide | W:1704-1746 | DONE | CO:365-387 | | Fixed on the phone 2026-09-14 (was per-section). |
| 29 | Unit card `.co-card{done|cur|up}`: "{n}." · title (2-line clamp) · side: "now" / dur "{n}" + "min" / "✓ taught" · "→" cue; whole card taps `onOpenUnit(n)` | W:1720-1741 | DONE | CO:70-90 | WJ `co_card*/co_num*/co_utitle*/co_now/co_dur*/co_mark/co_go` | Checker: `co_num` 16 vs 15, `co_go` 15 vs 14. `co_card_cur` ochre border ✓ (css 3809). `co_card_done` (WJ:297) adds a PINE border the web does not have — `.co-card.done` only recolours `.co-num`/`.co-go` pine and `.co-utitle` ink-soft (css 3811/3825/3841); mobile does not recolour `.co-go` on done. |
| 30 | Maths-prep flat list, >4 units → capped scroll window `.co-flatwrap/.co-flatscroll(max-h 348 phone)/.co-flatfade` | W:1696-1704, 1866-1901 | **DONE** (2026-09-17) | CO:425-429 | | Mobile renders the flat cards in the page ScrollView with NO 4-unit window and NO bottom fade. Not named as a divergence in the header. Native answer: a fixed-height inner ScrollView (`maxHeight: 348`) + a LinearGradient/absolute View fade. ★ **2026-09-17 reconcile:** the maths-prep flat list is a WINDOW: `co_flatscroll` 348px with a 26px bottom fade (`co_flatwrap`/`co_flatfade`). A 20-unit chapter used to push the chapter head, rail and notes button off the top. ⚠️ The fade is an SVG gradient — RN has no `linear-gradient` — the same substitution `PrepareCta` makes |
| 31 | scrollIntoView of the "now" card on open (tracking; accordion or SS map) | W:1679-1687 | **DONE** (2026-09-17) | — | ScrollView ref + onLayout y | Native: capture the `cur` card's `onLayout` y and `scrollRef.scrollTo({y, animated:false})` after mount. Matters for long SS/science chapters. ★ **2026-09-17 reconcile:** `ChapterOrg.jsx` `revealCur` — measureLayout → `scrollTo`, centred, once per open via `revealedRef`, wired from all three branches. Landed in `c7a36ce4` |
| 32 | SS flow view gate: `social_sciences` + single group + `meta.edge_model` | W:1702-1703 | DONE | CO:354 | | |
| 33 | SS map: competency ledger (weight desc, reach desc, code), tier Central/Substantive/Present, dots ●●●/●●/●, ribbon widths 5/3.5/2.5, colour list pine/clay/ochre/slate/plum/ink-soft | W:1393-1399, 1418-1437 | DONE | CO:63-65, 98-112 | tokens `ss_slate`, `ss_plum` | |
| 34 | Ribbons: cubic paths unit-right → competency-left, opacity .28 rest / .75 hot / .05 dim; measured after layout, re-measured on resize | W:1441-1477, 1486-1491 | DONE | CO:114-135 | react-native-svg | onLayout replaces getBoundingClientRect (named). |
| 35 | Unit row `.cof-u{done|cur|dim}`: "NN" · title before ":" (nowrap ellipsis) · "—" when no edges · "→" open button (`aria-label "Open unit NN"`, stopPropagation) | W:1493-1511 | DONE | CO:137-154 | WJ `cof_u*/cof_num/cof_utitle/cof_uopen` | Colour nits: web `.cof-num` is ink-soft (pine when done); mobile base pine, clay when cur. Web `.dim` opacity .3, mobile .35. |
| 36 | Unit popup `.cof-pop.cof-pop-open` (role=button, Enter/Space, left rule = state colour): "NN · title · N min →" + quiet "Taught in full — builds no competency edge, by design" | W:1518-1534 | DONE (keys WEB-ONLY-BY-NATURE) | CO:155-163 | WJ `cof_pop/cof_pop_quiet` | Checker: `cof_pop_quiet` 9 vs 12 and web is UPPERCASE mono; mobile body-italic 12 lowercase — a real skin miss. |
| 37 | Competency card `.cof-c`: code (identity colour) · tier name · dots; popup w/ full text on tap OR when a connected unit is focused; dormant `wheelOn` variant | W:1539-1571 | **DONE** (2026-09-17) | CO:168-190 | | `wheelOn` (`.cof-pop-wheel/.cof-pop-scroll/.cof-pop-fade`) is dormant on the web (never set true) — correctly omitted. Web `.cof-dots` colour is `--ink`; mobile colours dots with the competency colour (CO:180) — mobile-only divergence, not named. ★ **2026-09-17 reconcile:** the inline `{ color: c.color }` on `cof_dots` was removed in `c7a36ce4`; the dots now take the web's ink from `ws.cof_dots` alone |
| 38 | `gapNote` (`lp.meta.competency_gap_note`) `.cof-gap`; hint "Tap a unit or a competency to follow its connections" when nothing focused | W:1573-1574, 1864 | DONE | CO:192-193, 424 | | |
| 39 | `onOpenUnit(n)` → `setPreviewAt(n); setShowOrg(false)` (navigation, never pointer) | W:2126-2131 | DONE | M:274 | | |

### C. Chapter Notes (the notebook modal)

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes |
|---|---|---|---|---|---|---|
| 40 | Lapsed lock: `fetchEntitlement()` → `e.lapsed` → `notesLocked` | W:1589-1595 | DONE | CO:309-310 | `GET /entitlement` (shared `fetchEntitlement`) | |
| 41 | Cache key `userKey("chapter_notes_{subject}_{grade}_{title}")`; server key `planNoteKey(subject, grade, chapter_number‖title)` | W:1608-1611 | DONE | CO:312-313 | shared `userKey`, `planNoteKey`, `storage` | |
| 42 | Mount: show cache → `GET /plan-notes` (`fetchPlanNotes`) server wins → write-through cache; cache-only note → one-time `savePlanNote` lift; null (offline) keeps cache | W:1614-1634 | DONE | CO:316-331 | `GET /plan-notes` | |
| 43 | Save: state + cache (+ remove on empty) → `POST /plan-notes`; `409 stale` → adopt server text; close modal | W:1635-1652 | DONE | CO:332-342 | `POST /plan-notes` (shared `savePlanNote`) | |
| 44 | Modal shell: backdrop click closes, `.cn-modal` 468 max, centred | W:1286-1287 | DONE (placement DEFERRED-named) | CO:241-245 | WJ `cn_scrim/cn_modal` | Founder 2026-09-14: on the phone it opens BELOW the bar (`paddingTop: insets.top + BAR_CONTENT_H`), named in the component. Web is centred over the page. |
| 45 | Head: kicker "Chapter notes" · `.cn-title` · `.cn-sg` "Subject · IX" · child-privacy warning "Private data like name, age of child must not be recorded. Meyy reserves right to delete if entered." · ✕ (`aria-label "Close"`) | W:1288-1313 | DONE | CO:246-259 | WJ `cn_title/cn_sg/cn_scope/cn_warn/cn_x` | Checker landmine: `.cn-scope.cn-warn` — `cn-warn` wins (normal, clay) over `cn-scope` (italic, ink-soft); WJ:374 `cn_warn` restates family+colour so the phone lands on the winner. ✓ |
| 46 | `cnSubjectGrade`: `CN_ROMAN` array I…XII | W:1257-1265 | **DONE** (2026-09-17) | CO:47-53 | | Mobile map covers only 3–10; classes I, II, XI, XII would print the digit. Aruvi serves III–X today, so latent. Better: import a shared Roman helper. ★ **2026-09-17 reconcile:** `CN_ROMAN` covers I-XII. It stopped at 3-10, so a Class XI note was headed "Mathematics 11" while every other class read "Mathematics IX" |
| 47 | Ruled textarea `.cn-paper` (repeating gradient, `background-attachment: local`, 16/32px), `spellCheck=false`, placeholder `CN_GUIDE` (5 lines) or "No notes were written for this chapter." when readOnly | W:1314-1322, 1250-1255 | DONE (technique named) | CO:261-278, 41-46 | WJ `cn_paper_wrap/cn_rule/cn_paper` | Rules are absolute Views behind a transparent, `scrollEnabled=false` TextInput in a ScrollView (named). `placeholderTextColor "#b3ab9c"` is a literal, not a token. |
| 48 | Autofocus textarea on open (unless readOnly) | W:1276 | DEFERRED (named) | CO:267-269 comment | | Phone deliberately does not autofocus (keyboard would cover the privacy rule). Named in the file. |
| 49 | Hard cap: refuse input that GROWS the count past 500 (edits/deletes allowed) | W:1278-1284 | DONE | CO:230 | | Web comment says "400 words"; constant is 500 on both. Stale comment only. |
| 50 | Counter "{wc} / 500 words", `.over` (clay) at ≥500 | W:1343 | DONE | CO:293 | WJ `cn_count/cn_count_over` | |
| 51 | **Speak** button (mic SVG + "Speak") — `onClick={() => taRef.current?.focus()}` | W:1333-1342 | DONE | CO:289-292, `MicIcon` 199-208 | | **The web does NOT use the Web Speech API** (no `SpeechRecognition`/`webkitSpeechRecognition`/`speechSynthesis` anywhere in web/app — grepped). "Speak" only focuses the textarea so the OS keyboard's dictation key does the work. The phone does the same, and on iOS/Android the keyboard mic IS dictation, so parity is exact. `expo-speech` is text-to-SPEECH (wrong direction) — not the answer. If a true in-app recogniser is ever wanted it is `expo-speech-recognition` (community, needs a dev build + mic permission) on BOTH platforms — a product decision, see Open questions. |
| 52 | Save button `.cn-save` "Save" → `onSave(text)` | W:1345 | DONE | CO:295 | WJ `cn_save/cn_save_t` | |
| 53 | Lapsed foot: "Renew to write notes — what you wrote stays yours." + "Close" (=onClose) | W:1323-1329 | DONE | CO:281-285 | | |
| 54 | `readOnly` textarea when lapsed | W:1320 | DONE | CO:271 `editable={!readOnly}` | | |
| 55 | Mobile-only: `KeyboardAvoidingView` (iOS padding) around the modal | — | mobile-only (technical) | CO:242-243 | | A phone capability; fine, but not named in the header comment. |

### D. Unit view — header, tabs, paging

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes |
|---|---|---|---|---|---|---|
| 56 | Frozen `.lv-stick` = header + unit tab bar; only panel scrolls | W:471-482 | DONE (named) | M:183-210 | WJ `lv_stick` | View outside the ScrollView (named). |
| 57 | Header top row: kicker + "← Orgn." (preview: `setShowOrg(true)`; tracking: `goOrg`) — `data-tour="preview-back"` | W:2220-2230, 2263-2270 | DONE | M:298-303 | WJ `co_topbar/back_tr` | Both modes read "← Orgn." on both surfaces. The web's "← back" variant only appears under `showFullPlan`, which is DEAD (no `setShowFullPlan(true)` exists — the "View full lesson plan" button was retired). Correctly not ported. |
| 58 | Title `.lv-title.lv-title-full`: `.lv-unum` "{n}." or "✦ " + `pu.title`; dropped: `.uv-durline` "Dropped section · for self-study · not scheduled" | W:2231-2232, 2271-2272 | DONE | M:304-307 | WJ `lv_title/lv_unum/uv_durline` | Checker: `uv_durline` 11 vs 13 and tracking .44 vs .77 (web is MONO 11px; WJ:151 has body-italic 13 — wrong face too). `lv-title` landmine: `.lv-title-full` 19.5 wins — WJ:149 already 19.5 ✓. |
| 59 | Unit tabs `.uv-tabs` role=tablist: Overview · Material · Lesson · Assess(if items); active clay + 2px underline | W:437-453 | DONE | M:187-199 | WJ `uv_tabs/uv_tab/uv_tab_t/uv_tab_on*` | |
| 60 | Default tab "lesson" on both modes; paging remounts via `key={previewAt}` so tabs reset | W:427, 2240, 2323-2324 | DONE | M:184, 327-328 | | |
| 61 | `pvGoto(n)`: set `previewAt`, clear `undoTo`, scroll to the unit top (`.bodycontent` or window − `--nav-h`) | W:2152-2173 | DONE by construction | M:281 | | Remounting `PreviewUnit` (key) creates a fresh ScrollView at offset 0 — the scroll reset falls out of the remount. No explicit scroll needed. |
| 62 | `goOrg`: `setShowFullPlan(false); setShowOrg(true)` | W:2176 | DONE | M:282 | | |
| 63 | `pvNav` strip `.lv-pvnav.lv-pvnav-thin` at END of body: left "‹ Chapter org." (unit 1) / "← Back to unit {N}" (first dropped) / "← Previous unit"; middle "Unit n / N" or "Dropped n / M"; right "Dropped sections →" (last served + dropped exist) / "Next unit →" (disabled `.off` at end) | W:2180-2201 | DONE | M:285-296, `NavBtn` 336 | WJ `lv_pvnav/lv_pvbtn/lv_pvbtn_off/lv_pvmid` | Landmine: `.lv-pvnav-thin` wins background (clay) and radius (6) — WJ:202 is clay/6 ✓. Checker's `lv_pvmid` 10→11 / .80→.88 is a FALSE POSITIVE: `.lv-pvnav-thin .lv-pvmid` (css 1584) is 11px/700 and the checker cannot see descendant combos. `lv_pvbtn_off`: web `rgba(255,255,255,.5)` — verify WJ:204. |
| 64 | Dropped units (`view.dropped_lp`) page after served; never in pointer/completion arithmetic | W:1953-1958, 2146-2148 | DONE | M:217, 279-280 | | Mobile adds `!inDropped` guards on footer/bookmark (M:329-330); equivalent since `actUnit`/`cur` < units.length. |
| 65 | Tracking-only: `lessonFooter` (completionUI) only when `previewAt === actUnit` (`actUnit = undoTo ?? cur`) and only on the Lesson tab | W:2259, 2324, 461 | DONE | M:311, 329, 204 | | |
| 66 | Bookmark only when `sectionKey && previewAt === cur` | W:2325 | DONE | M:330 | | |
| 67 | `data-tour` hooks: `lesson-root`, `preview-root`, `preview-back`, `unit-tabs`, `lesson-notes`, `lesson-phase-1`, `mark-complete`, `phase-bookmark` | W:2122, 2237, 2317, 444, 291, 319, 2305/2311, 252 | NOT-PORTED-BY-DECISION | — | GuidedTour (deferred) | |

### E. Overview · Material · Lesson panels

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes |
|---|---|---|---|---|---|---|
| 68 | Overview ledger: Chapter · axis (SS/edge-model → "Section" + `section_anchor`; else `CTX_LABEL[groupType]‖"Spine"` + `section_label‖context`) · "Time" "{n} mins" · "Pedagogy" `approach`; nulls filtered; empty → "No overview details recorded for this unit." | W:71-118 | DONE | M:60-77 | WJ `uv_ovrows/uv_ovrow/uv_ovval/kicker` | Key column: web `.kicker.kicker-soft` (kicker-soft has no CSS rule); mobile `ws.kicker` + `width: 84` literal. |
| 69 | Material: `<ul>` materials; legacy string aid `.uv-va-legacy` (13px italic ink-soft); typed aids kicker "Prepared table · {title}" / "Prepared text · {title}"; table (`caption`, `thead`, rows, `.uv-va-src` source note); prose `.uv-va-prose`; empty "Nothing to prepare — this unit needs no materials." | W:120-159 | **DONE** (2026-09-18) | M:80-117 | WJ `uv_mat/uv_mat_li/uv_va_kicker/uv_va_prose/uv_va_src`; MISSING keys `uv_va`, `uv_va_table`, `uv_va_legacy`, `uv_va_title` | (a) legacy aid rendered with `uv_va_prose` (14 ink) instead of the web's italic ink-soft 13; (b) `.uv-va-table` has 8 CSS rules (content-weighted widths, header fill, caption style) that are NOT in web.js — the phone table is a hand-built `AidTable` with `minWidth:110` cells in a horizontal ScrollView, header cells styled with `assess_ovk` (an assess class) — PARITY-CHECK OWED: measure `.uv-va-table th/td/caption` into `uv_va_table*` keys; (c) caption styled as `uv_va_src`. Checker: `uv_va_src` 12 vs 12.5. ★ **2026-09-18 reconcile:** (a) FIXED — the legacy string aid uses a new `uv_va_legacy` (13 italic ink-soft). (b) the `.uv-va-table` measurements remain owed and need the running web at 390px. ★ **2026-09-18 reconcile:** (b) MEASURED on the running web at 390px and ported: `AidTable` was a boxed table with a sunk header in the assessment's overview type; it is now the web's ruled table — caption italic 13/20.15, th mono 700 10.5 ls 1.05 upper with an ink rule under it, td 13.5/19.58, line rules between rows, light column separators, first column flush (`uv_va_cap/th/td`). `uv_va_src` line height 17.28 → 18.6. |
| 70 | Teacher-notes ribbon `<details open>`: summary = kicker "Teacher notes" + one-line italic teaser (hidden when open; CSS `summary::after` "–" when open); body with bold `notesLead` ("Refer to Prepared Table…") + rest | W:264-302; css 4526-4528 | DONE (translation named) | M:122-144 | WJ `uv_tnotes_*` | Pressable toggle, open by default; the "–" glyph mirrors the web's `::after`. ✓ |
| 71 | Phase spine `.uv-phases` → `.uv-phase` rows: `.uv-ph-time` (mono minutes + "min", or label / "—") + `.uv-ph-t`; last row no bottom rule | W:305-328 | DONE | M:146-163 | WJ `uv_phases/uv_phase/uv_ph_time/uv_ph_n/uv_ph_u/uv_ph_t` | |
| 72 | Legacy `activities[]` fallback `.phaserow/.phasetext`; else "No phases recorded for this unit." | W:329-331 | DONE | M:164-166 | WJ `phaserow` (no `phasetext`) | |
| 73 | Homework `.uv-hw` kicker "Homework" + `boldMarks(text)` | W:334-339 | DONE | M:168-173 | shared `parseBold` | Bold runs styled `uv_tnotes_ref` (a notes class reused). Checker: `uv_hw` 14.5 vs 14 (`.uv-hw p`). |

### F. Phase bookmark

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes |
|---|---|---|---|---|---|---|
| 74 | Clay arrow SVG (viewBox 0 0 32 28, path M3 10 H15 V3 L30 14 L15 25 V18 H3 Z) in the left rail | W:256-259 | DONE | PB:60-62 | react-native-svg | Same path. |
| 75 | Rest position = centre of phase i's `.uv-ph-time` (measured, re-measured on layout/resize) | W:184-202 | **DONE** (2026-09-17) | M:128-129, 152-155; PB:26-32 | onLayout | Mobile centre = `rows[i].y + 13 + timeH/2` — the `13` is `uv_phase.paddingVertical` hard-coded in the panel; if WJ:182 changes, the arrow drifts. Derive from `ws.uv_phase.paddingVertical`. ★ **2026-09-17 reconcile:** the bookmark centre reads `ws.uv_phase.paddingVertical` instead of a literal `13`. ★ That 13 was the style's own padding hard-copied into arithmetic, so re-measuring `uv_phase` would have walked every bookmark centre off its row — and the checker cannot see a number that is not in `web.js` |
| 76 | Pointer drag with capture, clamp to spine, snap to nearest on release, `onMove(best)` only if changed | W:204-229 | DONE | PB:34-51 | PanResponder | `onPanResponderTerminate` does not snap back (web's `onPointerCancel` → `endDrag` snaps). Minor. |
| 77 | ↑/↓ keyboard nudge | W:231-237 | WEB-ONLY-BY-NATURE → translated | M:154 tap on a phase's minutes | | Named in both headers: tap on the minutes cell moves the bookmark. |
| 78 | `aria-label` "Lesson bookmark — on phase n of N; drag or use arrow keys to move"; `title` tooltip | W:250-251 | DONE / WEB-ONLY | PB:59 ("…; drag to move") | | Label correctly drops "arrow keys". |
| 79 | `.dragging` lift (scale 1.14 + shadow), hover shadow, `focus-visible` ring, `touch-action:none` | css 4586-4607 | **PARTIAL** (2026-09-17) | PB:58 `opacity .85` | | Drag affordance differs (opacity vs scale+shadow). Skin. ★ **2026-09-17 reconcile:** ⚠️ **RE-CITED 2026-09-17 — the evidence this row named no longer exists.** `PhaseBookmark` was rewritten into press-and-hold (`de4309e8`, `e5cbbbc7`, `b340a47c`), so there is no `opacity .85` at PB:58; the drag affordance is now a ring + tint at `PhaseBookmark.jsx:150`. Still short of the web's scale 1.14 + shadow, so the verdict stands — but anyone building against this row must read the new code, not the old citation |
| 80 | Bookmark phase init from `readLocalBookmark` when `b.unit === cur`, else 0 (read-only on mount) | W:2066-2070 | DONE | M:242-246 | shared | |
| 81 | On genuine unit change: restore saved phase for that unit, else reset to 0 AND `writeLocalBookmark(sk, cur, 0)` so the server row agrees | W:2071-2087 | **DONE** (2026-09-17) | M:248 | shared | Mobile effect runs on `[cur]` (incl. mount — harmless, read-only) but never WRITES the reset. After "Mark unit complete" the server bookmark still names the previous unit until she drags. Add the `writeLocalBookmark(sectionKey, cur, 0)` branch. ★ **2026-09-17 reconcile:** the bookmark reset is now WRITTEN, not just shown — `writeLocalBookmark(sectionKey, cur, 0)` on a genuine unit change. It set state and stopped, so after "Mark complete" the screen showed the new unit's top phase while the STORED row still pointed into the old unit, and `pushSectionState` carries the stored row. ⚠️ Guarded by `prevCurRef` so it cannot fire on mount and overwrite the phase she left off at |
| 82 | `moveBookmark(phase)` → state + `writeLocalBookmark` (pushes) | W:2088-2091 | DONE | M:257 | | |
| 83 | Cross-device resync: re-read bookmark on `window focus` / `pageshow` / `storage` | W:2092-2113 | **DONE** (2026-09-17) | — | `AppState` (react-native) | Native answer: `AppState.addEventListener("change", s => s === "active" && resync())`, optionally preceded by `pullSectionState([sectionKey])` so the phone that was backgrounded adopts the laptop's move. Also a good place to re-pull the pointer. ★ **2026-09-17 reconcile:** `AppState` "active" re-reads the bookmark in `LessonView.jsx` — the phone's equivalent of the web's focus/pageshow/storage listeners. ⚠️ Only when the stored row is for the unit she is ON; adopting another unit's bookmark would jump her mid-lesson |

### G. Completion UI

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes |
|---|---|---|---|---|---|---|
| 84 | "Mark this unit complete" (`.primary.lv-markbtn`, `data-tour="mark-complete"`) | W:2310-2312 | DONE | M:317, `MarkBtn` 339 | WJ `lv_markcard/lv_markbtn/lv_markbtn_t` | |
| 85 | Last unit, not done: "Mark chapter complete" | W:2304-2306 | DONE | M:316 | | |
| 86 | Just-marked: `.lv-donecard` "✓" (26px filled green circle, white) · "Unit complete" (pine-d 600) · "↺ Undo" (white pill w/ edge-green border) | W:2280-2289; css 1553-1559 | **DONE** (2026-09-17) | M:313, `DoneCard` 342-350 | WJ `lv_donecard/lv_donemark/lv_donetitle/lv_undo` | Skin: `lv_donemark` is plain 18px pine text (web: 14px white on a 26px #2f7d54 disc); `lv_donetitle` ink 500 (web pine-d 600); `lv_undo` bare text (web a bordered white pill, 44px min-height on phone). Checker caught `lv_donemark` 14 vs 18 and `lv_undo` tracking; the disc/pill boxes are outside its scope. ★ **2026-09-17 reconcile:** the done card's chrome: `lv_donemark` is a 26px filled disc with a white tick (it drew the glyph bare, so the card's strongest signal was missing) and `lv_undo` is a bordered pill on white |
| 87 | Chapter done: `.lv-chapterdone` (tint-clay bg, edge-clay border, mark clay, title clay) "Chapter complete" · "↺ Reopen" (`setDone(false)`) | W:2290-2301; css 1562-1564 | **DONE** (2026-09-17) | M:315; WJ:196 | | WJ `lv_chapterdone` = ochre border + `tint_cream`; web = `--tint-clay` + `--edge-clay`, and the mark/title recolour to clay is not applied. ★ **2026-09-17 reconcile:** `lv_chapterdone` is `tint_clay` on `edge_clay`, and the mark, title and undo pill all recolour with the card. It was ochre-on-cream — the PAYWALL's palette — so "chapter complete" read as a warning |

### H. Assess tab

| # | Feature / UI element | Web ref | Mobile status | Mobile ref | Depends on | Notes |
|---|---|---|---|---|---|---|
| 88 | Tab exists only when `unitAssessItems` non-empty | W:441 | DONE | M:187 | | |
| 89 | Frozen chrome group `.uv-assess-stick` (pager + item tabs) with measured `top` | W:368-395 | DONE (named) | AP:421-439 | | Plain View at panel top (named in AP header). |
| 90 | Pager (items>1): "← Previous" (disabled `.off`) · "Question n / N" · "Next →"; paging resets item tab to Overview | W:396-404, 366 | DONE | AP:422-428, 417 | WJ `uv_apager/uv_apgbtn/uv_apgbtn_off/uv_apgmid` | |
| 91 | Item tab bar `.assess-mtabs` role=tablist: Overview · Question · Answer(if hasAnswer) · Inclusivity(if any); guard falls back to "ov" | W:405-413, 365, 1100-1117 | DONE | AP:429-438, 416, 41-49 | WJ `assess_mtabs/assess_mt*` | `itemTabSet`/`groupedOptionSets`/`qtypeName` verified identical to the web's on 20 real items (plan). |
| 92 | mathsMiddle / mathsSecondary flags from `assessment.subject/grade` | W:433-435 | DONE | AP:406-408 | | |
| 93 | `AssessBody key={idx}`; `qn` only when >1 item; `Q{n}.` FLOATED mark sharing the panel's first line (`.assess-qmark` pine italic 13) | W:415-416, 1185-1189; css 1499 | **DONE** (2026-09-17) | AP:440, 381, 396; WJ:228 | | Mobile renders the mark as its own block line, and in CLAY (web: `var(--pine)`) at 15px (web 13). Colour miss is outside the checker's scope; size is in its list. ★ **2026-09-17 reconcile:** `assess_qmark` is PINE at 13px (it was clay at 15 — clay is the unit strip's colour, and using it here made the two read as one axis). ⚠️ The web FLOATS the marker beside each panel's opening words; RN has no float, so it keeps its own line — named in the key |
| 94 | Legacy item (no `normalized.template`): white `.assess-card` with LEARNING OUTCOME strip + `ALegacyCard` (type name, prompt, `<ol>` options, "Answer: …", LOOK FOR) | W:1190-1203, 732-749 | **DONE** (2026-09-17) | AP:382-388, 361-371 | WJ `assess_qtype/assess_lo_k`; no `assess_card` | Card chrome (#fff, edge-green border, radius 10) not ported — items sit flat. Options numbered "1." (web `<ol>` decimal) ✓. ★ **2026-09-17 reconcile:** `ALegacyCard` now carries `.assess-card`'s chrome — white fill, green edge, radius 10. A legacy item keeps the old card BY DESIGN, and that card is what tells a teacher she is looking at an older item rather than a mis-styled new one; drawing it bare made the distinction invisible. ⚠️ `#fff` literally in both themes, as the web has it |
| 95 | Forward nav "Question →" / "Answer →" (only when target tab exists) and "Next question →" (Answer + Inclusivity, not last item): inline `<span role=button tabIndex=0>` riding the last row, Enter/Space keys | W:1179-1184, 1212-1217; css 1485, 1518 | **DONE** (2026-09-17) | AP:373-375, 380, 393 | WJ `assess_tabnav` | Pressable ✓; but always on its OWN right-aligned line (`alignSelf:flex-end`), never sharing the last row as the web's flex-wrap does. Founder 2026-07-16 asked for the ride-the-row behaviour. ★ **2026-09-17 reconcile:** `QNavWrap` — the forward nav shares the panel's last row and wraps below it (still right) when that row is full, which is the behaviour the bordered `.assess-nextq-wrap` was retired for in 2026-07-16. It was pinned to its own line, leaving an empty row under a short answer |
| 96 | Overview panel rows: Competency ("code — text") · Learning outcome · Section · Question type (full words) · Cognitive demand; bold block key `.assess-ovk.assess-ovk-b` | W:791-838 | DONE | AP:150-169 | WJ `assess_ovlo/assess_ovk/assess_ovlo_t` | Web key is `font-weight:700` via `-b`; WJ:230 `assess_ovk` is mono 700 ✓. |
| 97 | Question: passage (`.assess-passage`, italic body, green tint box) before stem for `template==="passage"` | W:853; css 1654-1655 | DONE | AP:190, 144-145 | WJ `assess_passage` | Web box is `#f4f9f6`/edge-green at 12.5px; WJ:254 uses `tint_cream` + ochre left rule — different plane and hue. Skin. |
| 98 | TRUE_FALSE stem: lead + `tf_statements` rows (marker + text), options never shown | W:844, 854-865 | DONE | AP:185, 191-197 | | Web wraps in `.assess-prompt.assess-prompt-tab` (14px Newsreader); mobile uses `P` (`assess_look_t`, 13.5). Checker: `assess_prompt` 14 vs 13.5, `assess_look_t` 12 vs 13.5. |
| 99 | Compound interleaved (sets.length === stem_parts.length): each sub-question + its own A–D list | W:848, 866-888 | DONE | AP:186, 198-207 | | |
| 100 | `stem_parts` → `APartsList(lead, parts)`; else plain stem | W:889-897 | DONE | AP:208-210 | | |
| 101 | `audio_ref` cue: 5-bar equaliser SVG icon + "*Listening passage* — {ref}, read aloud" in a pine-left-ruled row | W:899-908; css 1719-1723 | **DONE** (2026-09-17) | AP:212-214 | | Text verbatim; the SVG icon and the 3px pine left rule are NOT ported; `audio_ref` mono 11 not applied. No web.js `assess_audio*` keys — PARITY-CHECK OWED. ★ **2026-09-17 reconcile:** the listening passage is a marked block — 3px pine left rule, equaliser glyph, reference in mono (`assess_audio*`). It rendered as one more grey sentence, so the teacher had to READ that this question needs something PLAYED |
| 102 | Visual stimulus `ATyped(n.visual_stimulus)`: **svg** via `dangerouslySetInnerHTML` | W:523 | DONE (translation; verification owed) | AP:123 `SvgXml xml width="100%"` | react-native-svg `SvgXml` | Risks to verify on the real corpus: no `height` given (relies on the xml's own viewBox/height — an SVG without a viewBox renders 0 tall); `SvgXml` ignores `<style>` blocks, CSS classes and `currentColor`; on the Expo WEB target `SvgXml` is fine. Plan §3 lists exactly this translation. |
| 103 | `number_line` → `ANumberLine` axis SVG (W 320, ticks, labels, arrows) + instruction | W:496-518 | DONE | AP:101-120 | | Mobile: `width="100%" height={52}`; web uses viewBox scaling. Colours: web `.assess-nl-*` classes (no web.js keys); mobile ink/ink_soft literals — PARITY-CHECK OWED (`assess_nl_axis/tick/lab/instr`). |
| 104 | `table` → `.assess-table` with caption above, header only if non-empty (word bank), rows, source note below | W:525-546 | DONE | AP:125-143 | | Horizontal ScrollView table; styles hand-built (`minWidth:100` cells) — no `assess_table*` keys. PARITY-CHECK OWED. |
| 105 | prose → `.assess-vs.assess-vs-prose` (green tint box, pre-line) | W:547 | **DONE** (2026-09-18) | AP:146 | | Mobile plain `P` — no box. ★ **2026-09-18 reconcile:** prose renders in the web's green box (`assess_passage` + new `assess_vs_prose_t`). ★ And the PASSAGE box was wrong too: `.assess-vs-prose, .assess-passage` are ONE web rule, but `assess_passage` carried an ochre left rule on cream — the parity checker compares only font-size on this family, so the box drifted unseen. Both now match globals.css:1665-1666, dark included. |
| 106 | Plain options `.assess-opts2` (label + text, NO tick); compound-but-not-interleaved → grouped under "Question N" (`.assess-opt-grp`) | W:912-941 | DONE | AP:216-223, `OptList` 171-182 | WJ `assess_opts2/assess_opt/assess_opt_lab/assess_opt_t` | "Question N" label styled `assess_ovk` (web `.assess-opt-grp`, 1 rule). |
| 107 | WHAT TO PRODUCE ticks (`format_of_output`) | W:942 | DONE | AP:224 | | |
| 108 | SCAFFOLD: `scaffold_lines` rows + gap spacers, else prose block | W:565-581 | DONE | AP:87-98 | WJ `assess_scaf/assess_scaf_row` | Gap = `height:10` (web `.assess-scaf-gap`, 1 rule). |
| 109 | `<details class="assess-otg">` "READING THIS TASK" (collapsed; native disclosure marker) → FORMAT ("type — rationale") · WHAT THIS DEMONSTRATES · READING THE SCAFFOLD | W:946-955; css 1726 | DONE | AP:226-237 | | "▸/▾" prefix stands in for the `<summary>` marker (web `list-style-position: inside` shows the triangle too). ✓ |
| 110 | TEXTBOOK EXERCISE: bold `exercise_ref` — “quoted” `exercise_desc` (quote added unless already quoted) | W:956-976 | DONE | AP:238-246 | WJ `assess_book_item` | Regex identical. |
| 111 | Answer, TRUE_FALSE: no reasons + model_answer → SUGGESTED ANSWER; else ANSWER KEY rows "True/False — reason" (`.assess-tf-t` #0f6e56 / `.assess-tf-f` clay, mono 600 12px) | W:987-1016; css 1692-1693 | DONE | AP:287-300 | | Mobile verdict is Newsreader 600 pine/clay (web mono 600). Skin. |
| 112 | CORRECT ANSWER rows (Q{n} tag for compound, label, "text ✓") | W:1019-1037 | DONE | AP:304-318 | WJ `assess_corr_row/assess_corr_q/assess_tickmark` | Checker `assess_corr_row` 13.5 vs 9 is a PEER false positive (the key declares no size; the fallback read `assess_corr_q`'s 9). `assess_corr_q` 9.5 vs 9 real; web is plain ink-soft text, WJ:248 adds a pine border box — skin. |
| 113 | Per-template answer blocks: selected_response (ANSWER + reveals) · scr (SUGGESTED ANSWER‖LOOK FOR + METHOD) · ecr (LOOK FOR, EXPECTED ELEMENTS, SUGGESTED ANSWER, METHOD) · open_task (EXPECTED ELEMENTS, LOOK FOR) · cloze_match (ANSWER KEY) · match (pairs "left → right" or ANSWER KEY) · oral (SPEAKING RUBRIC) · numeric (WORKED ANSWER, METHOD) · passage (EXPECTED ELEMENTS) | W:1038-1093 | DONE | AP:319-331 | | Order and headings verbatim. Match rows: web `.assess-match-*` grid (no web.js keys) — PARITY-CHECK OWED. |
| 114 | WHAT EACH CHOICE REVEALS: rows (Q tag · letter · text · "Choice X" pill button), "note" key → plain paragraph | W:677-713 | DONE | AP:252-270 | WJ `assess_rev/assess_revrow/assess_rev_lab/assess_rev_choice` | Checker `assess_revrow` "phone has 10.5 or 15 or…" is the peer-fallback noise (key declares no size). |
| 115 | Choice popup `.assess-choicepop` (role=dialog, ✕ top-LEFT, "Question N · Choice X" label, text; backdrop or ✕ closes) | W:716-726 | DONE (translation) | AP:271-281 | RN `Modal` | Popup box colours literal (`popBg rgba(0,0,0,.45)`); web `.assess-choicepop*` (6 rules) has no web.js keys — PARITY-CHECK OWED. |
| 116 | `ATicks` "✓" list (`.assess-ticks li::before`) | W:664-672 | DONE | AP:61-68 | WJ `assess_tick/assess_tickmark` | |
| 117 | `AAnswerBlock` (answer_parts rows or prose), `APartsList`, `ABlock` | W:588-661 | DONE | AP:57-86 | WJ `assess_look/assess_look_k/assess_look_t/assess_ansrow/assess_ans_lab/assess_parts_lead` | Checker: `assess_look_k` 9 vs 10 (+tracking), `assess_look_t` 12 vs 13.5, `assess_ans_lab` 11 vs 10. Web's assess accent is a DISTINCT green `#0f6e56` (22 uses: look-k, tickmark, opt-lab, ans-lab, tf-t, otg summary…); tokens.js has no token for it and web.js maps all of them to `t.pine` (#1e5c4a). Whole-panel hue drift, invisible to the checker. |
| 118 | `InclusivityText`: colon-label bolding (title-cased), middle-maths "struggling", maths row split on Support:/Challenge: | W:1129-1164 | DONE | AP:336-359 | WJ `assess_inc/assess_inc_strong` | Regexes identical. |
| 119 | `strong_vs_weak_markers` never rendered | W:767 | DONE | — | | Neither surface renders it. |

### I. `window` / `document` / `navigator` audit (every reference in the web file)

| # | Reference | Web ref | Mobile status | Notes |
|---|---|---|---|---|
| 120 | `window.addEventListener("resize")` in PhaseBookmark | W:199-200 | DONE (onLayout) | Rows re-measure via `onLayout`. |
| 121 | `document.documentElement.classList.contains("app-shell")`, `getComputedStyle(--nav-h)`, `document.querySelector(".lv-stick")`, `requestAnimationFrame`, resize/orientationchange — AssessPanel sticky top | W:376-390 | DONE (disappears) | Named: plain View. |
| 122 | `window.addEventListener("resize", measure)` — SS ribbons | W:1475-1476 | DONE (onLayout) | |
| 123 | `window.localStorage` ×11 — notes cache, pointer, done | W:1616-1647, 1969-2035 | DONE | `@aruvi/shared/storage` (expo-sqlite kv-store) via shared helpers. |
| 124 | `requestAnimationFrame` + `document.querySelector(".co-view .co-card.cur, .co-view .cof-u.cur").scrollIntoView` | W:1689-1691 | **DONE** (2026-09-17) | Row 31. ★ **2026-09-17:** `measureLayout` + `scrollTo` replace the rAF + `querySelector`, once per open via `revealedRef` (`ChapterOrg.jsx` `revealCur`, landed `c7a36ce4`). ⚠️ Web ref corrected — `LessonView.jsx` is 2336 lines now, not the 2330 this appendix's header states, and every W: citation in it has drifted ~6 lines. |
| 125 | `window.addEventListener("focus"/"pageshow"/"storage")` bookmark resync | W:2110-2116 | **DONE** (2026-09-17) | Row 83; `AppState`. ★ **2026-09-17:** `AppState` "active" is the phone's equivalent and the one that matters on a handset. ⚠️ Adopts the stored row ONLY when it belongs to the unit she is on. |
| 126 | `document.querySelector(".bodycontent")`, `window.scrollTo`, `getBoundingClientRect`, `--nav-h` — pvGoto scroll reset | W:2157-2172 | DONE by construction | Row 61. |
| 127 | `dangerouslySetInnerHTML` (svg stimulus) | W:523 | DONE (SvgXml) | Row 102. |
| 128 | `navigator.*`, `speechSynthesis`, `SpeechRecognition`, `window.print`, `URL.createObjectURL` | — | n/a | None in this file (grepped). No print/export lives in LessonView; PDF/DOCX exports are in MyLessonPlans/YearPlan/Settings. |
| 129 | `title=` hover tooltips (bookmark, notes tab, SS unit popup) | W:251, 1814, 1520 | WEB-ONLY-BY-NATURE | No native hover. |
| 130 | `:hover` affordances (`.co-card:hover` pine border, `.co-acchead:hover`, `.uv-bkmk:hover`, `.co-notetab:hover`, `.assess-tabnav:hover`) | css 3751, 3785-3786, 3809, 4600, 1512 | WEB-ONLY-BY-NATURE | Pressable `pressed` state could stand in; none wired. |
| 131 | `setPointerCapture` / `onPointerCancel` | W:207, 228, 248 | DONE (PanResponder) | Row 76. |

### J. Mobile-only additions (parity concerns in the other direction)

| # | Item | Mobile ref | Notes |
|---|---|---|---|
| 132 | `<Bar />` (the brand bar) rendered INSIDE LessonView/ChapterOrg/route screens | M:261, 272, 321; R:38, 47 | Structural: the web's topbar is the shell's; on the phone every route paints its own. Not a UI divergence. |
| 133 | Error/loading screen strings in the route | R:29-30, 39, 51-52 | Row 14-15. |
| 134 | `KeyboardAvoidingView` around the notes modal | CO:242 | Row 55; name it in the header. |
| ~~135~~ | ~~Competency dots coloured by identity colour~~ | CO:187 | ✅ **CLOSED 2026-09-17** — the inline `{ color: c.color }` was removed in `c7a36ce4`; the dots take `ws.cof_dots` (the web's ink) alone. Nothing left to name or strike: this mobile-only addition no longer exists. |
| 136 | `cof_num` clay when `cur` | CO:148 | Row 35; web number stays ink-soft. |
| 137 | `!inDropped` guards on footer/bookmark | M:329-330 | Equivalent; fine. |
| 138 | `AidTable` / assess table horizontal ScrollView + hand-built cell styles | M:101-117; AP:125-143 | Rows 69, 104 — measure into web.js. |
| 139 | `placeholderTextColor "#b3ab9c"` literal | CO:274 | Matches the web's own literal (`.cn-paper::placeholder { color:#b3ab9c; font-style:italic; font-size:13px }`, css 3957). What cannot be matched: RN styles the placeholder with the input's own face/size, so the guide renders at 16px regular, not 13px italic — a technical limitation worth naming in the header. |
| 140 | `useEffect(..., [cur])` bookmark effect fires on mount | M:248 | Read-only, so harmless; web guards with `prevCurRef`. |

---

## Parity-checker debt (RUN, not derived) — `node mobile/theme/check-parity.mjs`

Result on this snapshot: `✗ 23 tie-broken-by-source-order, 33 value disagreement(s)`. 183 of 366 web.js keys map to a same-named class; 183 unmapped.

**B-section disagreements in THIS family (22 of 33), verbatim:**

```
uv_durline      font-size: web 11, phone 13   [.uv-durline]          + letter-spacing .04em(=0.44) vs 0.77
uv_va_src       font-size: web 12, phone 12.5
uv_hw           font-size: web 14.5, phone 14   [.uv-hw p]
lv_donemark     font-size: web 14, phone 18
lv_undo         letter-spacing: web .04em (=0.44), phone 0.66
lv_pvmid        font-size: web 10, phone 11 · letter-spacing .08em(=0.80) vs 0.88   ← FALSE POSITIVE (.lv-pvnav-thin .lv-pvmid = 11px; descendant combo unseen)
assess_qmark    font-size: web 13, phone 15
assess_prompt   font-size: web 14, phone 13.5
assess_look_k   font-size: web 9, phone 10 · letter-spacing .1em(=0.90) vs 1
assess_look_t   font-size: web 12, phone 13.5
assess_corr_row font-size: web 13.5, phone 9                      ← peer-fallback noise (key has no size)
assess_revrow   font-size: web 12, phone 10.5 or 15 or …           ← peer-fallback noise
assess_corr_q   font-size: web 9.5, phone 9
assess_ans_lab  font-size: web 11, phone 10
assess_scaf_row font-size: web 12, phone 12.5
assess_qtype    font-size: web 9.5, phone 10.5 · letter-spacing .08em(=0.76) vs 1.89
assess_lo_k     font-size: web 8.5, phone 10 · letter-spacing .12em(=1.02) vs 1
co_subname      font-size: web 9 (≤600px), phone 11 · letter-spacing .03em(=0.27) vs 0.33
co_acc_name     font-size: web 15 (≤600px), phone 14.5
co_num          font-size: web 16, phone 15
co_go           font-size: web 15, phone 14
cof_pop         font-size: web 12.5, phone 13 or 12
cof_pop_quiet   font-size: web 9, phone 12 · text-transform: web uppercase, phone does not
```
(The other 11 are `dash_welcome_*`, `fr_cta` — other families.)

**A-section landmines touching this family** (all ties, source order decides; web.js already sides with the winner in each case):
- `lv-pvnav lv-pvnav-thin` — background (thin: clay wins), border-radius (6 wins).
- `lv-title lv-title-full` — font-size 19.5 wins (WJ ✓).
- `lv-donecard lv-chapterdone` — background `--tint-clay` wins (WJ:196 has `tint_cream` ✗ — see row 87).
- `cn-scope cn-warn` — font-style normal, colour clay win (WJ ✓).

**What the checker CANNOT see and I checked by hand (colour/box, all real):** `assess-qmark` pine→clay; `co-tick.cur` ochre→clay; `lv-donemark` disc; `lv-undo` pill; `lv-chapterdone` tints; `cof-num` ink-soft→pine; `cof-dots` ink→identity colour; `.assess-*` `#0f6e56` → `t.pine` across the panel; `assess-passage` `#f4f9f6`/edge-green → `tint_cream`/ochre; `assess-corr-q` bare → boxed.

**Classes in this family with NO web.js key (PARITY-CHECK OWED — nothing to check until measured):** `uv-va`, `uv-va-table`, `uv-va-legacy`, `uv-va-title`, `uv-bkmk`, `uv-assess-stick`, `assess-card`, `assess-audio(-ico/-t/-ref)`, `assess-choicepop(-box/-lab/-t/-x)`, `assess-table(-cap/-src)`, `assess-nl-*` (svg/axis/arrow/tick/lab/instr), `assess-match-*`, `assess-tf-row`, `assess-otg(-body)`, `assess-opt-grp`, `assess-opts(-sub)`, `assess-ovk-b`, `assess-ovlo-main`, `assess-ovrows`, `assess-qnavwrap/-main`, `assess-scaf-gap`, `assess-subq`, `assess-vs(-nl/-svg)`, `assess-lo(-t)`, `assess-ans(-t)`, `assess-ansrows`, `assess-inc-row`, `co-chev`, `co-flatwrap/-scroll/-fade`, `co-accbody`, `co-body`, `co-list`, `co-axis-blurb`, `co-topkick`, `co-view`, `cof-noedge`, `cof-svg`, `cof-pop-open/-go/-k`, `cof-pop-wheel/-scroll/-fade` (dormant), `cn-modal-bg`, `cn-head-t`, `cn-speak-mic`, `lv-doneleft/-donerow`, `lv-pvview`, `phasetext`, `primary`, `back`. Several are pure layout and rightly have no key; the ones that carry type or colour (audio, choicepop, table, nl, match, tf-row, otg, va-table, va-legacy, chev) are the measurement debt.

---

## Dependency notes

**Already in place (this family needs nothing new to run):** `@aruvi/shared` — `sectionState` (`readUnitPointer/setUnitPointer/readChapterDone/setChapterDone/readLocalBookmark/writeLocalBookmark/pushSectionState/pullSectionState`), `format` (`parseBold`, `userKey`, `planNoteKey`, `fetchPlanNotes`, `savePlanNote`, `fetchEntitlement`, `getJSON`), `storage` (sync kv); API routes `GET /plans/{s}/{g}/{file}/view`, `GET/POST /plan-notes`, `GET /entitlement`, `GET/POST/DELETE /section-state`; `react-native-svg` (Path/Rect/Line/Polygon/Text/SvgXml); `react-native-safe-area-context`; `mobile/components/Bar` (`BAR_CONTENT_H`); theme `ThemeContext`, `web.js`, `tokens.js`.

**To finish the residuals (ordered):**
1. `mobile/theme/web.js` — fix the 21 real checker rows above (skip the 3 false positives), then measure the OWED classes (audio, choicepop, assess-table, nl, match, tf-row, otg, va-table, va-legacy, chev, donemark disc, undo pill, chapterdone tints) and re-run `check-parity.mjs` until this family is clean. Add a token (or a `webStyles` local like `wheelBg`) for the assess green `#0f6e56` so the panel stops reading as pine.
2. `LessonView.jsx` (mobile) — `writePointer` clears `done` below the last unit (row 5); write the bookmark reset on a genuine unit change (row 81); `AppState` resync + re-pull (row 83); derive the bookmark centre offset from `ws.uv_phase` (row 75).
3. `ChapterOrg.jsx` (mobile) — scroll the `cur` card into view on open (row 31); maths-prep 4-unit capped window + fade (row 30); SS `co-acc-name` 13px and hide `co-count` for science/SS (row 16/26); SVG chevron (row 26); `CN_ROMAN` full range or a shared helper (row 46); dots colour (row 37).
4. `AssessPanel.jsx` (mobile) — inline forward-nav riding the last row (row 95); audio icon + left rule (row 101); legacy `.assess-card` chrome (row 94); verify `SvgXml` on real corpus SVGs (row 102).
5. Web side (optional but removes the disk-shape drift): move `LessonView.jsx`'s inline pointer/done writes onto the shared `setUnitPointer/setChapterDone` (row 6) — the plan already says the web "keeps its inline copy for now".

**What this family unlocks:** nothing downstream is blocked on it — My Classes (index.jsx) and My Lessons (lessons.jsx) already route into `/lesson`. The only cross-family string to reconcile is the open-loading copy (row 14).

---

## Open questions for the founder

1. **Speak.** On both surfaces "Speak" only focuses the writing area and relies on the keyboard's dictation key (the web never used the Web Speech API). Is that the intended meaning of the button, or should the phone add a real in-app recogniser (`expo-speech-recognition`, mic permission, dev build) — and if so, does the web get one too, or is this a named "capability the phone adds"?
2. **Opening a lesson that fails to load.** The web fails silently (stays on the list); the phone shows "This lesson could not be found." / "Couldn't load this lesson right now." with a back link. Adopt the phone's copy on the web, or drop it on the phone?
3. **Chapter Notes placement.** The phone opens the window below the bar (2026-09-14); the web centres it over the page. Is the web to follow (the Ask Meyy precedent says panels open beneath the frozen header), or is this a named phone divergence?
4. **Maths-prep flat list.** The web caps the list at ~4 units in a scroll window with a fade; the phone scrolls the whole page. Port the window, or accept the phone's plain list as the simpler answer on a screen that already scrolls?
5. **Assess accent green.** The web's assessment surfaces use `#0f6e56` (distinct from `--pine`); the phone maps it to pine. Keep the distinct green (add a token) or let the phone's simplification stand?
