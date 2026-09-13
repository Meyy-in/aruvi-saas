# Aruvi-SaaS — Accumulated Learnings & Carry-Forward Notes

---

## ★ AMENDMENTS TO BE TESTED — the pre-warming checklist (standing; keep updated) ★

**Why this list exists.** We have been changing prompts and constitutions and then validating
those changes NOT by running them, but by **back-writing the summaries / saved plans
synthetically** (hand-edits, in-place migrations, split scripts, corpus rewrites). That proves
the *renderers, normalizers and view model* are happy with the target shape — it does NOT prove
the **generator actually emits that shape** when it runs live. Every amendment below is owed a
real generation check. **Run this whole list when the pre-warming runs sweep the entire
subject portfolio** (live LLM generation, all subjects × stages × chapters). Tick items off
there; add any new synthetic amendment here the moment it is made, don't let it hide inside a
dated entry.

Each item: what changed · how it was validated so far (synthetic) · what a live pre-warm run
must confirm · source entry.

1. **SS + TWAU assessment constitutions bumped for `guide.{TYPE}` nesting** — SS assessment
   constitution → **v1.7**, TWAU → **v1.3**: Rule 9 + the JSON-schema blocks now MANDATE
   `guide.{question_type}` nesting (matching Science + registry §1), with a new PROHIBITION
   against flat `guide.what_each_option_reveals` placement; population-table header changed to
   "guide.{TYPE} keys required". *Validated synthetically:* all SS/TWAU saved plans were
   migrated in place (pure structural relocation, deep-diff-clean; corpus scan 194 nested / 0
   flat) — the constitution text itself was never exercised by a generation run. *Pre-warm must
   confirm:* live SS + TWAU assessment generation actually emits `guide.{TYPE}`-nested rubrics,
   never flat. (src: 2026-07-10 "Normalized assessment items + 3b renderer".)
   **★ SS HALF TESTED LIVE + PASSED 2026-08-03 (SS·secondary C4, v2.0 ch 3 library).** All
   **54 items** across {12, 10, 7} nest under exactly their own `question_type` key, every type's
   mandated fields present (MCQ `what_each_option_reveals`, SCR `expected_elements`, ECR
   `look_for`, SI `stimulus_rationale` + `sub_question_expectations`, OPEN_TASK's five), and ZERO
   flat placements. The constitution text now has a live run behind it for SS·secondary.
   **★ SS·MIDDLE TESTED LIVE + PASSED 2026-08-04 (C4, VIII ch 3 library {16,13,10}).** All **59
   items** across the three files nest under exactly their own `question_type` key — guide-key
   mismatches 0, FLAT placements of `what_each_option_reveals` / `expected_elements` / `look_for`
   0. Every type's mandated fields present (MCQ reveals keyed to the three non-correct labels and
   never the correct one; SCR `expected_elements`; ECR `look_for`; OPEN_TASK's five).
   **★★ CLOSED 2026-08-12 — TWAU TESTED LIVE + PASSED (S5 · C4, V ch 5 library {16,13,10}).**
   All **39 items** across the three files nest under exactly their own `question_type` key —
   FLAT placements **0**, guide-key mismatches **0**, missing mandated fields **0** — and all 7
   MCQs key `what_each_option_reveals` to exactly the non-correct labels, never the correct one.
   **This item is now fully discharged: all three of its subjects (SS·secondary 2026-08-03,
   SS·middle 2026-08-04, TWAU 2026-08-12) have a live run behind the constitution text.**
   Nothing is owed. Do not reopen.

2. **English MCQ option-reveals rewrite — owed into the generation prompt wrappers** — the
   corpus MCQs had their prose-`note` option analyses rewritten into the keyed
   `what_each_option_reveals` map (last stragglers cleaned 2026-07-10). *Validated
   synthetically:* only the saved plans were rewritten; **mirroring the rewrite into the
   generation prompt wrappers is explicitly still deferred** (spec §7.4). *Pre-warm must
   confirm:* the English generation prompt itself produces keyed reveals (not prose notes) so
   new plans don't reintroduce the old shape. (src: 2026-07-10, "still deferred to generation
   milestone".)
   **★ NOT TESTABLE AT S11 (C4, 2026-08-12), and the reason is structural rather than an
   oversight:** the english·IX ch 7 library contains **zero MCQ items** across all three
   canonicals — 18 items, all EXTRACT_ANALYSIS · TRUE_FALSE · FILL_IN · SCR · ORAL_PROMPT ·
   WRITING_TASK · ECR. At secondary, Rule 4 prefers EXTRACT_ANALYSIS/ECR for analytical Reading
   LOs and the other five spines default to non-MCQ types, so a six-cell english chapter can
   legitimately produce none. **The item stays OWED, and its owner is now "the first
   MCQ-bearing english chapter" rather than a stage** — S9 (preparatory, whose type set is
   MCQ-heavier) is the likeliest place it fires. A9's arrangement half is in the same position
   (C3 recorded it): one options-bearing item in the library, a TRUE_FALSE.
   **★ TESTED LIVE + PASSED 2026-08-13 (S10 · C4, VI ch 8 *What a Bird Thought*, library
   {12, 10, 7}) — the owner S11 named turned up at the very next stage.** Ch 8 carries an MCQ in
   EVERY canonical (`Q-RFC-B-1` ×3): assessment v3.6's PAIR slot table puts a lower-rung item at
   Reading slot 1 and MCQ leads its permitted set, so at middle the type is structurally likely
   rather than incidental — which is why secondary could legitimately produce none and this stage
   produces three. All three emit `what_each_option_reveals` **keyed to exactly the incorrect
   labels and never the correct one** (A·B·D against correct C in the standard and p10; A·C·D
   against correct B in p07 — the labels differ because STEP 6 re-ordered them, which is the
   arrangement stage visibly working), `suggested_answer` empty as Rule 5 requires of MCQ, and
   `note` empty on all three, so nothing fell back to the prose-`note` shape the 2026-07-10
   rewrite took out of the corpus. **The generation prompt wrapper produces keyed reveals
   unaided. Discharged for english·middle.** english·preparatory (S9) is the last stage owing
   it; secondary owes it only if a later chapter of that class ever yields an MCQ.

3. **Constitution exact-counts audit (spec §J.3)** — deferred to the generation milestone: the
   per-type item-count expectations in the constitutions have not been reconciled against what
   the generator emits. *Pre-warm must confirm:* generated assessments hit the constitutions'
   exact counts per type. (src: 2026-07-10, "still deferred to generation milestone".)
   **★ SS·SECONDARY TESTED LIVE 2026-08-03 (C4, v2.0 ch 3 library) — COUNTS PASS, SLOT TYPES DO
   NOT.** All three files carry exactly the mandated slate per competency: Central 5
   (MCQ·SCR·SI·ECR·OPEN_TASK), Substantive 3, Present 2 → 18 items each, no competency over or
   short. **But the count being right does not make the SLOT right:** three Substantive third
   slots took an ECR where the competency owned a source-capable LO and Rule 4 mandates
   SOURCE_INTERPRETATION (ARV-D-028). So this item splits: *counting* is solved and can be
   gated (`build_library.py`'s advisory census already does), *slot-type resolution* is a
   separate deterministic pre-step the model does not run. The p07 17-vs-18 miss of 2026-08-02
   (ARV-D-019) did not recur. Other stages still owed at their own C4.

4. **English Unit→true-chapter splits (Grades VI, VII, VIII; plus III & IX)** — the 5 Unit-level
   summaries/mappings/saved-plans per grade were cut into true per-section chapters by
   `split_english_chapters.py` + hand `section_id` walks (periods renumbered, coverage_handoff /
   assessment_items filtered, NCF totals reconciled). *Validated synthetically:* structural
   splitting + JSON/period/tiling checks only — **none of the split chapters was regenerated
   through the chapter pipeline or the LP generator.** *Pre-warm must confirm:* generating these
   true chapters from scratch yields coherent, single-section plans consistent with the split
   artifacts (title format `"<section> (<unit>)"`, per-chapter period spread, spine-top axis).
   (src: 2026-07-01 VI/VII/VIII entries; 2026-07-09 III/IX same-session split.)
   **★ IX HALF TESTED LIVE + PASSED 2026-08-12 (S11 · C4, ch 7 *Vitamin-M*, library {17,14,10}) —
   the first time a split chapter has been regenerated from scratch.** All three canonicals
   reproduce the split contract exactly: title `"Vitamin-M (Vitamin-M)"` in the
   `<section> (<unit>)` form; `main_sections_inventory` a single entry `{A, "Vitamin-M", prose}`;
   `section_id: "A"` on all 41 units; and the port's singleton-section collapse putting SPINES at
   the top level. Period spread 17 for a 29-page section, consistent with the `effort_index` 9.6
   that set `recommended_periods`. **Grades VI, VII, VIII and III are still owed, by S10 and S9.**
   **★ VI HALF TESTED LIVE + PASSED 2026-08-13 (S10 · C4, ch 8 *What a Bird Thought*, library
   {12, 10, 7}).** The split contract is reproduced on all three canonicals: title
   `"What a Bird Thought (Nurturing Nature)"` in the `<section> (<unit>)` form;
   `main_sections_inventory` a single entry `{B, "What a Bird Thought", poem}`; `section_id: "B"`
   on all **29 units** across the three files; the singleton-section collapse putting SPINES on
   top. Period spread 12 for an 8-page section, consistent with `effort_index` 16.5.
   **ONE THING THE IX RUN COULD NOT SHOW, AND THIS ONE DOES: the section id is `B`, not `A`.**
   The split kept each chapter's position inside its original textbook Unit — ch 8 is the SECOND
   section of "Nurturing Nature" — so across a class the ids run A, B, C, D and only the first
   chapter of each Unit gets `A`. IX's ch 7 was an `A`, which made the id look like a constant.
   Anything keyed on `A` is wrong for eleven of VI's sixteen chapters; S10's P5.2 recorded the
   trap and this is the live confirmation. **Grades VII and VIII are owed by the pre-warm sweep
   — both are true multi-section classes, which neither IX nor VI exercises — and III by S9.**
   **★ III HALF TESTED LIVE + PASSED 2026-08-13 (S9 · C4, ch 11 *The Big Laddoo*, library
   {12, 10, 7}).** Title `"The Big Laddoo (The Big Laddoo)"` in the `<section> (<unit>)` form;
   `main_sections_inventory` a single `{B, "The Big Laddoo", poem}`; **`section_id: "B"` on all
   29 units** across the three files; the singleton-section collapse putting SPINES on top.
   Period spread 12 for an 8-page section, consistent with `effort_index` 11.5. **`B` again, not
   `A` — the second independent confirmation of S10's trap**, and III is fully split at 17
   chapters with the ids running A/B across a Unit's chapters (five of the seventeen are `B`).
   **Only VII and VIII are still owed, and they are the ones that matter most: both are true
   MULTI-SECTION classes, which none of IX, VI or III exercises.**

5. **English-middle Step 7d effort-index calibration reused across grades unverified** — the
   `task_density` tier cutoffs (≤2.0 / 2.1–2.9 / ≥3.0) calibrated on Grade VI were **reused
   unchanged for VII and VIII** despite each grade's raw distribution differing (VIII's fit is
   admittedly weak — pins most chapters at tier 3). The prompt file
   `cowork prompts/english/middle/step_1_chapter_summary_and_mapping.md` Step 7d still carries
   only the "Verified 2026-07-01 (Grade VI)" note and the flagged (unfixed) doc gap that
   task_density needs a per-grade raw-distribution audit before reuse. *Validated
   synthetically:* effort_signals were computed by the split script, not by a live authoring
   run. *Pre-warm must confirm:* re-running the chapter authoring pipeline reproduces the
   integer-tier `effort_signals` shape and a sane `effort_index` spread per grade; recalibrate
   cutoffs if a grade collapses to a near-binary signal. (Also the standing English-middle Step
   7d chapter-level effort-signal addition, CLAUDE.md §10 / 2026-07-01, is prompt-only and
   untested by a live run.)

6. **"Wire time into the constitutions" — not yet built; carry-forward binds its shape** — once
   built, the constitutions must receive time as an **ordered per-period duration vector**
   (e.g. `[40,60,40,…]`), NOT a scalar total Tm (Tm becomes a derived checksum = Σ of the
   vector). The count-multiset budget ("14 periods: 11×40, 3×60") + MARKING the long sessions
   ("longer session — best in a full period") is the intended generation contract; each chapter
   starts at cycle position 0 (no cross-chapter phase tracking). *Nothing wired yet* — this is a
   constitution change still to be made. *Pre-warm must confirm (once wired):* the generator
   consumes the duration vector, produces exactly the right number of long sessions, and marks
   them; feasibility holds globally. (src: 2026-07-05 "Period durations & the LLM's time
   budget".)
   **★ CLOSED BY DESIGN 2026-08-02 (recorded at SS·secondary C4, per testing.md C4's footnote).**
   The duration vector will never be wired: Amendment A1 fixes the constitutions at exactly ONE
   standard period row (class-standard duration × count) and the variant-canonical serve engine
   owns every timetable variation — proportional per-unit scaling plus weekly dispersion
   (`genon.duration_sequence`). There is nothing left for a constitution to receive. No pre-warm
   check is owed. Do not reopen.

7. **`Period.approach` — confirmed NO constitutional change (verify the empties are acceptable
   live)** — founder decided NOT to flatten the diverse per-subject "how do I run this?" source
   keys at source; `Period.approach` absorbs the diversity in normalization and is empty where
   no source field exists (Maths-preparatory, SS). Not an amendment to a constitution, but note
   it here so a pre-warm reviewer doesn't mistake the empty approach line for a generation bug:
   *confirm* Maths-prep and SS plans legitimately render no approach line, and every other
   subject·stage carries one. (src: 2026-07-09 "LP display standardized".)
   **★ TESTED LIVE + PREMISE CORRECTED 2026-08-02 (SS·secondary C4, ch 3 library {12,9,7}).**
   **SS is no longer an empty-approach subject.** SS·secondary LP v1.10 Rule 9 mandates
   `pedagogical_approaches` (a LIST, verbatim from the NCF Pedagogy doc, `[]` only when a unit is
   genuinely diffuse), and the port joins it with "; " into `Period.approach` exactly as English
   does. Measured on all 28 authored units (12 + 9 + 7): **0 empty** — Inquiry · Project work ·
   Issues-based learning · Reflective essays · Role plays and simulations, all five verbatim in
   `framework/social_sciences/secondary/pedagogy_secondary_social_sciences.txt`. **The remaining
   legitimate empty is mathematics·preparatory alone** (no source field in its constitution);
   SS·middle emits `pedagogical_approaches` too (v2.7) and is expected to populate at its own C4.
   The pre-warm check for this item is now: maths-prep empty is fine; SS empty is a DEFECT.
   **★ RE-CONFIRMED on the v2.0 library 2026-08-03 (C4):** 0 empty across all 29 units of
   {12, 10, 7}, and the JOIN is now visibly exercised — p10 U6 "Inquiry; Project work", p10 U7
   and U10 "Issues-based learning; Reflective essays", p07 U5/U6 likewise. Rule 9 P5's
   multi-approach list survives the port into `Period.approach` intact.
   **★ SS·MIDDLE CONFIRMED 2026-08-04 (C4, VIII ch 3 {16,13,10}) — the prediction held:** 0 empty
   across all **39 units**, and the JOIN is exercised (p10 has five two-approach units, e.g. U5
   "Issues-based learning; Inquiry"). **Mathematics·preparatory is now the ONLY legitimate empty
   left.** One caveat this run added, carried as ARV-D-043 (accepted): populated ≠ valid — the
   standard's U3/U8/U12 record "Source analysis task", which is NOT in
   `framework/social_sciences/middle/pedagogy_middle_social_sciences.txt` but IS a verbatim entry
   in the ASSESSMENT constitution's Rule 8 Open Task menu. The pre-warm check gains a second half:
   SS empty is a defect, and so is an approach no Pedagogy document contains.
   **★ TWAU CONFIRMED 2026-08-12 (S5 · C4, V ch 5 {16,13,10}):** 0 empty across all **39 units**,
   every value SPELLED OUT (Observe and Record · Hands-on Investigation · Discussion and Connection
   · Create and Express · Reflect and Act), **zero acronyms leaked** into `Period.approach` and zero
   off-taxonomy values. The ARV-D-043 caveat cannot arise on this stage: TWAU's five `dominant_mode`
   values are a CLOSED set fixed in LP Rule 3 with an NCF §7.4 citation each, so "populated" and
   "valid" are the same question — unlike SS, where the approach is drawn from a prose document.
   **Mathematics·preparatory remains the only legitimate empty**; english (S9–S11) is the last
   stage-family still unchecked.
   **★★ CLOSED 2026-08-12 — ENGLISH·SECONDARY CONFIRMED (S11 · C4, IX ch 7 library {17,14,10}),
   AND WITH IT THE WHOLE ITEM.** `unit_approaches` and the port's `Period.approach` are non-empty
   for **41 of 41 units** across the three canonicals — english reads `pedagogical_methods`, a
   `{spine: method}` DICT, joined in first-seen order ("comprehension-discussion",
   "listen-and-respond; oral-presentation"), which is the one shape ARV-D-086 had returned `[]`
   for. Every value is drawn from its spine's permitted list in LP Rule 4, so ARV-D-043's
   populated-but-invalid caveat cannot arise here either: english's methods are a closed
   per-spine enumeration inside the constitution, not a prose document to quote from. **The
   field is identical at all three english stages, so S9 and S10 inherit the answer and owe
   nothing.** What survives as a standing fact: **mathematics·preparatory is the only legitimate
   empty in the portfolio, and an empty approach anywhere else is a defect.** Nothing is owed.
   Do not reopen.

8. **English (preparatory) FILL_IN + MATCH question types — assessment constitution rewritten**
   (`data/content/constitutions/assessment/english/preparatory/assessment_constitution.txt`,
   edited 2026-07-13). The current mandated shapes:
   - **FILL_IN** — "Blanks in ONE cloze set; one skill, one task (**no Part A/B**)";
     `teacher_guide.suggested_answer` = each blank's answer **numbered to its blank**. It is a
     CLOSED type (Rule 5), so answer-verification (Rule 6) + the Rule-7 fallback apply.
   - **MATCH** — answer stored as a STRUCTURED, machine-parseable `answer_key`: an array of
     `{left, right}` objects, one per pair (`left` = Column A text matching the
     `visual_stimulus` table; `right` = the Column B match, or a position number for an
     ordering task), PLUS a short `suggested_answer` fallback string (e.g. "1-c, 2-a, 3-b").
     **Never a prose paragraph or inline-glossed pairs.** The pipe-table lives entirely in
     `visual_stimulus`; `item_stem` carries ONLY the task instruction (e.g. "Match each animal
     with its young one.") and must NOT repeat the column entries.
   *Validated synthetically:* the constitution text was edited; no live English-prep generation
   was run against it (there is in fact NO English-prep saved-plan corpus on disk to have even
   back-checked it against — grades I/II have no chapters yet). *Pre-warm must confirm:* live
   English-prep generation emits single-cloze-set FILL_IN with per-blank numbered answers, and
   MATCH with a structured `{left,right}` `answer_key` (+ fallback string) and a clean pipe-table
   stimulus. ⚠️ **Confirm the exact intent with the founder** — this item was reconstructed from
   the current constitution file, not from a logged change description.
   **★ TESTED LIVE 2026-08-13 (S9 · C4, ch 11, all three canonicals) — MATCH PASSES, FILL_IN
   FAILS, and this was the item's FIRST test by anything.** MATCH: 5 of 5 carry the structured
   `answer_key: [{left, right}]` (4–6 pairs) PLUS the short fallback string, with the pipe-table
   entirely in `visual_stimulus` and an instruction-only stem — the whole contract, satisfied on
   first contact. FILL_IN: **4 of 4 fail the answer shape.** The rule wants "each blank's answer
   NUMBERED TO ITS BLANK"; the model emits column-grouped or object-keyed prose ("That can be
   eaten: Apple, Orange, Grape. That cannot be eaten: Football, Globe, Coin."). **There is
   nothing to number, because these are not cloze items** — they are a two-column sorting table
   and a predict-and-record grid. **Same root as ARV-D-146** (C3): FILL_IN was chosen for
   `writing` slot 1 in 3 of 3 files, where the slot table prescribes SCR, because the content IS
   a sort; the type choice then drags in an answer contract the content cannot satisfy. One
   decision, two rule breaches — **decide them together**: if `writing` slot 1 legitimately
   admits FILL_IN, this item needs a second permitted answer shape for non-cloze FILL_INs.
   ARV-D-151.

9. **★ WHOLE recent constitution-edit WAVE (Jul 12–13) is untracked and untested ★** — item 8 is
   one instance of a broader batch. Memory's newest dated entry is 2026-07-11, but 11 constitution
   files were edited AFTER it and appear in NO memory entry. All are git-ignored (**no diff trail
   exists — the baseline is gone**), so the per-file lines below are the load-bearing **emit
   contract to ASSERT at generation**, not a verified before/after. None has been through a live
   run. The version string in each header is the only edit fingerprint; where a footer disagrees
   it's flagged. Confirm intent with the founder per file.

   **English — assessment (spine-keyed; one item per spine-cell `implied_lo`; items ordered by
   `section_id` A→B→C):**
   - `assessment/english/preparatory` · **v1.0** (07-13 07:29) — types MCQ·SCR·MATCH·FILL_IN·
     TRUE_FALSE·ORAL_PROMPT·WRITING_TASK·PROJECT; **ECR BANNED**. Check: MATCH structured
     `answer_key` `[{left,right}]` + `"1-c,2-a,3-b"` fallback; FILL_IN one cloze set / per-blank
     numbered; MCQ `suggested_answer:""` + `what_each_option_reveals` (one per INCORRECT option,
     `note` reserved for Rule-7 fallback only); Rule-7 failed item still emitted with `item_stem:""`.
   - `assessment/english/middle` · **v3.1** (07-13 07:41) — same shapes as prep **plus ECR + PROJECT**;
     TRUE_FALSE answer format "N. True/False — justification", one per line (no grouping). Check the
     same MATCH/FILL_IN/MCQ contracts + spine default map (Reading/Listening/Speaking/Writing/
     VocGram/Beyond-text).
   - `assessment/english/secondary` · **v1.0, forked from middle v3.1** (07-13 07:29) — every
     addition is tagged `[SECONDARY DELTA]`: new **EXTRACT_ANALYSIS** type (verbatim extract in
     `visual_stimulus` + 1–3 analytical sub-Qs); prefer EXTRACT_ANALYSIS/ECR for analytical LOs;
     drama anchors; **listening transcript baked into the summary** (generator does NOT open the
     appendix). Check the deltas actually fire on a secondary drama/poem chapter.

   **English — lesson plan (periods array + `coverage_handoff` keyed by spine):**
   - `lesson_plan/english/preparatory` · **v1.0** (07-12 14:06)
   - `lesson_plan/english/middle` · **header v1.5 / footer still says v1.4 — STALE FOOTER, fix it**
     (07-12 14:06). Check Rule 4 methods are drawn STRICTLY from the per-spine NCF list (generator
     must not invent), no spine's method repeats across >2 consecutive periods; Rule 2 allocation
     capacity-first, proportional by section.
   - `lesson_plan/english/secondary` · **v1.0, forked from middle v1.5** (07-12 14:07) — Rule 3 task
     selection + Rule 4 methods carry secondary additions (reported speech, sentence-type
     conversion, phrasal verbs, etc.). Check those methods appear and stay within the permitted list.

   **Mathematics — assessment (MCQ needs exactly 4 options / one `is_correct` / populated
   `what_each_option_reveals`; `teacher_guide.expected_answer` + `method_one_line`):**
   - `assessment/mathematics/preparatory` · **v1.1** (07-12 20:55) — intent sections A–D
     (Explore/Reason/Practise/Solve), one item per handoff task; types **MCQ·SCR·NUM only (ECR
     banned)**. Check the A→D section schema + NUM emitted for `solve`.
   - `assessment/mathematics/middle` · **v3.2** (07-12 20:55) — three sections Recall/Reason/Apply;
     types MCQ·SCR·ECR·NUM by `goal`. Check goal→type default mapping.
   - `assessment/mathematics/secondary` · **v1.0** (07-12 20:54) — cognitive-demand HINGE drives
     format (Recall/Understanding→MCQ · Application→NUM/SCR · Analysis/Evaluation→ECR ·
     integrative `co_central`→OPEN_TASK from the Maths menu); **exactly one item per `implied_lo`**
     (no bonus/wrap items); guide block per question. Check: `effort_index` does NOT leak into
     assessment format/count/demand (explicit prohibition).

   **Science — assessment:**
   - `assessment/science/middle` · **v1.2** (07-12 20:55) — table-formatted; **stage-position
     architecture** governs format (First stage = 2×MCQ; Middle stages = 2 MCQ + 1 SCR; Final
     stage = 2 MCQ + 1 ECR + 1 Open Task); format is set by stage position, NOT the implied-LO
     type; guide block per Rule 9; only the two inputs (coverage_handoff + summary). Check the
     stage-position counts come out right end-to-end.
   - `assessment/science/secondary` · **v1.0** (07-12 20:54) — same cognitive-demand→format hinge
     as Maths secondary, with a Science open-task menu (Rule 8) + reasoning floor. Check demand-tag
     drives format and the open task appears for integrative LOs.

   *Pre-warm rule:* treat **every** constitution touched since 2026-07-11 as UNTESTED — the
   pre-warming sweep must generate live for each subject·stage above and diff the emitted JSON
   against these contracts. Whenever a constitution is edited going forward, add a line here (what
   changed + what to check) at edit time and bump BOTH the header and footer version — `data/`
   carries no VCS trail, so this list is the only record.

10. **English assessment Rule 4 — "NAME THE REFERENCED WORD" added (middle + secondary)** —
    `assessment/english/middle` **v3.1 → v3.2** and `assessment/english/secondary` **v1.0 → v1.1**
    (both header + footer bumped; edited 2026-07-13). New two-line clause appended inside Rule 4:
    when an item requires the student to perform a cognitive act on a specific word/words within a
    larger sentence, the stem MUST state that word/those words explicitly in parentheses — never
    indicate them by underlining/bold/italics (typographic emphasis has no representation in the
    item JSON and is silently lost, leaving the question unanswerable). **Preparatory deliberately
    excluded.** *Why:* saved plan `english/vii/ch_01_20260510_175736.json` item **Q-VG-A-1** (SCR,
    prep/adverb tagging) says "the underlined word" but carries no underline and empty
    `visual_stimulus` — the target token was unrecoverable. Decided against a `marked_text`/stimulus
    schema type (over-engineers a plain-text problem, adds tokens); the parenthetical naming is the
    right-sized fix and this is a generator-time rule, not a cowork-authoring-prompt issue.
    *Validated synthetically:* constitution text edited only; no live generation run against it, and
    the existing corpus still contains the defect (Q-VG-A-1 is `"verified": true`). *Pre-warm must
    confirm:* live English middle + secondary assessment generation, on any in-text word-identification
    LO (Vocabulary/Grammar prep-vs-adverb, article/tense tagging, etc.), emits the referenced word
    named in the stem and never relies on emphasis. *Also owed:* a one-off corpus rewrite pass to
    repair already-saved items of this family (cheap text patch — parenthetical annotation, no
    regeneration), and optionally a normalizer/validation guard flagging any item whose stem says
    "underlined/circled/highlighted" while `visual_stimulus` is empty. (src: 2026-07-13.)

11. **English LP homework `task_brief` MUST carry a "(p.NN)" page locator** — Rule 8 (Homework) +
    Rule 9 (Phase Narration / `task_brief` format) in ALL THREE English lesson-plan constitutions
    (`lesson_plan/english/{preparatory,middle,secondary}`). Every homework item's `task_brief` must
    read `"<Subheading> (p.NN): <plain brief>"` — identical to an in-class brief — with the page
    taken from the task's `page_ref` and a **fallback to the section's page range** when the task
    has none. Rationale in-text: "a homework item a teacher cannot locate is a defect." This is the
    earlier homework-page-reference amendment; it was folded into the Jul-12 LP-constitution wave
    (item 9 lists these files' versions but its check bullets cover only Rule 4 methods + Rule 2
    allocation — NOT this locator), so it had no explicit test entry until now. *Validated
    synthetically:* constitution text only; no live LP generation run against it. *Pre-warm must
    confirm:* generated English LP homework items every carry a `(p.NN)` locator sourced from
    `page_ref` (section-range fallback when absent), and NO homework brief is emitted locator-less —
    across prep, middle, and secondary. (src: 2026-07-13 review; rule predates this note.)

12. **English assessment FILL_IN table anti-duplication rule — added to all three stages** —
    Rule 9 (Visual Stimulus) in `assessment/english/{preparatory,middle,secondary}` now carries an
    explicit FILL_IN clause paralleling the existing MATCH one: a FILL_IN item with a
    `visual_stimulus` table must carry that table (header + every data/blank row) ENTIRELY in
    `visual_stimulus`, never reproduced as pipe-markdown / plain text / paraphrased list in
    `item_stem`; combined with Rule 4's "one cloze set; no Part A/B" a FILL_IN item owns at most
    ONE table. Versions bumped **prep 1.0→1.1, middle 3.2→3.3, secondary 1.1→1.2**. Cause: the
    anti-duplication prohibition had only ever been written for MATCH (and MCQ/TRUE_FALSE options),
    never FILL_IN — so `english/vii/ch_02` **Q-VG-B-1** (generated 2026-05-10, pre-amendment) had
    its Part A antonym table inlined as pipe-markdown in `item_stem` AND partially in
    `visual_stimulus`, plus an illegal Part A/B split. *Validated synthetically:* constitution text
    edited; TWO offending saved items back-filled in place and the whole 41-file corpus re-scanned
    (0 inline-table-in-stem remaining, JSON clean) — the rule was NOT exercised by a generation run.
    The back-fills: **Q-VG-B-1 (FILL_IN, vii/ch_02)** reduced to Part A only (stem = instruction
    only, table lives in `visual_stimulus`, Part B dropped, `suggested_answer` trimmed);
    **Q-LIS-B-1 (MATCH, vii/ch_05)** had its duplicated (a)–(d) event list stripped from the stem
    (events remain only in the `visual_stimulus` table). *Pre-warm must confirm:* live English
    FILL_IN generation emits table-bearing items with the table ONLY in `visual_stimulus` and an
    instruction-only stem, one table per item, no Part A/B — prep, middle, secondary. (src:
    2026-07-13 "FILL_IN table anti-duplication".)

13. **"no Part A/B" decoupled from the visual rule — the ban was a proxy, now narrowed** —
    the blanket "one skill, one task, no Part A/B" (items 8 & 12) was traced to its origin: it
    was never a pedagogical principle but the *mechanism* invoked to guarantee the real
    rendering rule ("a FILL_IN owns at most ONE `visual_stimulus`"; the schema slot is single).
    It over-caught **purely textual** multi-part items (e.g. `english/viii/ch_06` **Q-VG-C-1** —
    synonyms Part A + expressions Part B, both prose word-boxes, `visual_stimulus:""`, renders
    A & B cleanly). Rule 4's FILL_IN line + Rule 9's combination clause in
    `assessment/english/{preparatory,middle,secondary}` rewritten to split the two: HARD rule =
    ≤1 visual + no inlining (kept); the A/B ban is now **narrowed** — "a FILL_IN MAY carry
    multiple parts (A/B) ONLY if every part is textual/prose; any part needing its own table or
    visual must be a separate item." Versions bumped **prep 1.1→1.2, middle 3.3→3.4, secondary
    1.2→1.3**. *Validated:* constitution text edited only — NOT run live, and the corpus was NOT
    re-swept (Q-VG-C-1 is now legal under the new rule, so it needs no back-fill; items 8/12's
    old "no Part A/B" wording in this list is now superseded for the textual case). *Pre-warm
    must confirm:* live English FILL_IN generation keeps tables solely in `visual_stimulus`,
    emits at most one visual, and only splits into A/B parts when all parts are textual. ⚠
    Founder-directed change (2026-07-13), reconstructed rationale — confirm intent.

14. **Maths number-line stimulus — explicit `number_line:` type added to prep + middle Rule 7** —
    prep/middle maths assessment constitutions permitted only a pipe-table or "" for
    `visual_stimulus` and prohibited SVG, so a number line had nowhere legal to go; the generator
    shoehorned it into a header-less pipe row (`| 200 | ... | ... | ... | 260 |` + a pipe-less
    parenthetical), which the shared classifier correctly types TABLE → the renderer boxed it
    (reported: `mathematics/iii/ch_06` **Q-C-3/Q-C-4**). Fix: a 4-line bullet added to Rule 7
    "Permitted" in **preparatory + middle** (schema comment `"" , pipe-table, or number_line:`) —
    a stimulus tagged `number_line:` then ticks split by "|", each cell a number (labelled tick)
    or "..." (blank tick), endpoints numeric, task wording stays in `prompt`, never a faked table.
    Secondary NOT changed (it already permits SVG figures, VS-2). Engine side (already built,
    earlier this session): `StimulusType.NUMBER_LINE`; maths-only `_maths_number_line` reads ONLY
    the `number_line:` tag (declared intent, no guessing) — the earlier single-numeric-pipe-row
    heuristic was DROPPED once the corpus was tagged, so an untagged numeric row now stays an
    ordinary table rather than being silently re-typed; SVG number-line renderer `ANumberLine` in
    `LessonView.jsx`. Q-C-3/Q-C-4 back-filled to the tagged form. *Validated synthetically:* tagged + legacy + spaced/negative variants all
    parse to number_line; corpus typing unchanged (43 table, 2 number_line; Q-C-1 tile table stays
    table); full suite 17/17. *Pre-warm must confirm:* live prep/middle maths generation emits
    number lines in the tagged `number_line:` form (not as a pipe-table), one line, instruction in
    `prompt`. (src: 2026-07-13, founder-directed.)

   **★ TESTED LIVE 2026-08-11 (S8 · C4, maths III ch 5) — AND THE AMENDMENT WAS TOO NARROW.**
   First live use was Q-C-4, an alternating SHAPE pattern (`number_line: line | curve | …`) for a
   repeat-unit question. The model reached for the tag correctly; the RULE was wrong. Cells were
   words, the then-numeric tick test rejected them, typing fell through to TABLE and the literal
   token `number_line: line` rendered to the teacher (ARV-D-113, accepted-then-fixed). Founder
   ruled the tick line the better representation, so: Rule 7 widened to a TICK LINE with word or
   numeric labels (prep **v1.4**, middle **v3.5**); `_nl_block` now validates structure not cell
   type; a failed tag strips itself and falls to prose, never a table; and `build_library.py`
   gained a declared-type gate so the next mis-tag stops the run instead of being found by eye.
   The item now renders as a tick line with no file edit — the engine fix alone corrected it.
   **What this item taught, beyond itself:** a permitted FORM with no gate is a convention, and
   the convention held for exactly one live use. When a constitution licenses a declared type,
   the certifier has to check the declaration, or the first misuse ships.

15. **Maths homework locator restored at the RENDERER (middle) + prep homework field INTRODUCED
    (constitution)** — two coupled changes, founder-directed 2026-07-14. *The problem:* middle
    maths homework items are dicts carrying the page + section in a dedicated `book_ref`
    (e.g. `"Figure it Out Q8, section 5.1 p.111"`) alongside `description`, but the maths
    normalizer `_hw` → `text_lines` picked ONLY `description` and silently DROPPED `book_ref` /
    `source_section` — so a teacher saw "Guna erased numbers from a Venn diagram…" with no way to
    locate it (reported: `mathematics/vi/ch_05_20260523_170838` Period 2, item E-14). Note this is
    a RENDER-layer drop, NOT a generation defect — the data was always complete (contrast the
    English homework amendment, item 11, which bakes `(p.NN)` into the text at generation). *Fixes:*
    (a) **`_hw` rewritten** (`aruvi_core/subjects/mathematics/subject.py`, new `_hw_line` helper):
    for dict items keep BOTH — `"{description} (**{book_ref}**)"`, appending the locator only when it
    is not already inside the text; string items (secondary, page baked in) pass through untouched;
    empty/absent → dropped. Covers all three stages by shape, not by stage-branch: middle dicts
    (live now), prep dicts (future — see (b)), secondary strings (unchanged). **The locator is
    wrapped in `**…**` (markdown bold) so the reference alone (e.g. "Figure it Out Q11, section 5.2
    p.115") renders weighted** — new shared React helper `boldMarks()` in `web/app/lib/format.js`
    (splits `**…**` → `<strong>`) wired into BOTH homework renderers (`LessonView.jsx` unit LESSON
    tab + `ViewModelView.jsx`); export/print parity via new `_esc_bold()` in `render/html.py`
    (escape → `**…**`→`<b>`). NB `format.js` now contains JSX (fine for Next's SWC on `.js`) —
    STATIC-verified only (no `next dev` in sandbox), so the bold spans need a live/mobile eyeball. (b) **Prep LP
    constitution given a homework field** it never had — new **RULE 9 | HOMEWORK IS OPTIONAL AND
    UN-OWNED** (mirrors middle Rule 9) + `"homework": [ <same shape as tasks_in_class entry> ]`
    added to the `<period>` JSON schema, `book_ref` mandatory. Prep uses the same `book_ref` dict
    idiom as middle, so `_hw` already renders it correctly the day prep starts emitting it. *Validated
    synthetically:* `_hw` unit-checked on real middle Period-2 data (locator now present), secondary
    string (unchanged), a synthetic prep dict (`Activity 3, p.107` appended), empty list, and an
    already-contains-ref guard (no double-append); `tests/test_maths_port.py` green. *Pre-warm must
    confirm:* (i) live middle maths LP homework renders `description (book_ref)` with the page +
    section visible AND the reference bold, never description-only; (ii) newly-generated PREP maths LPs actually EMIT a
    `homework[]` array in the new dict shape with a populated `book_ref`, and it renders with the
    locator; (iii) secondary maths homework (plain strings) is unchanged. (src: 2026-07-14,
    founder-directed.)

16. **Middle-maths `teacher_guide.inclusivity` made STRUCTURED `{support, challenge}`** (was a
    single free string). Audit finding: Rule 6 mandates "vary the surface form … not canned", so
    generated inclusivity legitimately drifts (ch_09 VIII uses verb-form "challenge them", "hesitant/
    confident/advanced", 2 items with neither keyword) — renderer keyword-bolding of "struggling"/
    "challenge:" is therefore unreliable by design. Fix: `assessment/mathematics/middle` Rule 6 +
    JSON schema + verification-fail default now emit an object with two bare-clause keys (no
    "Support:"/"Challenge:" label prefix — renderer supplies emphasis). *Follow-on NOT yet done:*
    `assessment_norm.from_maths` still reads `inclusivity` as a string, and `LessonView.InclusivityText`
    still keyword-matches — both must adopt the `{support, challenge}` object (bold the two known
    parts, drop the regex) before this renders. Prep/secondary maths left as string for now. *Pre-warm
    must confirm:* live middle-maths assessment emits `inclusivity` as `{support, challenge}`, each a
    label-less clause. (src: 2026-07-14, founder-directed.)

17. **Social Sciences (middle) LP constitution — `teacher_notes` INTRODUCED (v1.5 → v1.6)** —
    SS-middle was the ONLY subject/stage whose LP constitution never asked for teacher notes:
    the pipeline already carried them (`social_sciences/subject.py:104` reads `teacher_notes`,
    view model + `LessonView` ribbon render them) but the constitution had no rule and no schema
    field, so the Lesson-tab notes ribbon was always empty for SS. Added **RULE 11 · TEACHER
    NOTES — PER-UNIT GUIDANCE** (2–3 sentences; link to previous unit / one chapter-grounded
    confusion, never fabricated / optional facilitation pointer; MUST NOT restate the activity,
    cite C-codes, or open with "Transition"/a section label — ported from Science-middle Rule 10
    and adapted to SS content) + a `teacher_notes` field in the A3 period schema (placed before
    `competency`). *Validated synthetically:* the 4 saved SS plans (VI ch6 ×7, VII ch4 ×7, VIII
    ch4 ×11, VIII ch5 ×10 = **35 periods**) were **backfilled in place** with hand-authored,
    chapter-grounded notes (`outputs/backfill_ss_notes.py`); JSON valid, every period non-blank,
    all 35 confirmed flowing through `SocialSciencesSubject.lesson_plan_to_view` into the view
    model; `test_ss_port` + `test_lp_standard` still green. The constitution text itself was
    never exercised by a generation run, and the backfilled notes are synthetic (not generator
    output). *Pre-warm must confirm:* live SS-middle LP generation actually emits a non-blank
    Rule-11 `teacher_notes` per period, and the emitted notes obey the constraints (no verbatim
    activity restatement, no C-codes, no "Transition" opener). (src: 2026-07-14, founder-directed.)
    **★ TESTED LIVE + PASSED 2026-08-04 (SS·middle C4, VIII ch 3 library {16,13,10}) — THIS ITEM IS
    DISCHARGED.** The rule is now generator output, not backfill. Across all **39 authored units**:
    zero blank notes; every note **2–3 sentences**; **zero** C-code citations; **zero** notes opening
    with "Transition" or a section label; **zero** verbatim restatement of the unit's own band text
    (tested as any shared 8-word run between a note and a band). The continuity link names CONTENT
    rather than position, as the v2.8 register requires — standard U13: "The civilian administration
    unit covered the internal structure of Shivaji's government; this unit addresses the external
    revenue mechanism that funded it." **DRIFT — the rule moved:** this entry says "RULE 11" and "the
    A3 period schema"; in the live LP v2.8 it is **RULE 10** and the field sits in the **A1** schema
    (renumbered between v1.6 and v2.7). Chasing this item by rule number elsewhere will fail.

18. **MCQ correct-answer POSITION rule added — Science + SS assessment constitutions (all four
    middle+secondary files)** — audit finding (2026-07-16, founder-reported): within a single
    chapter's assessment every MCQ shares the SAME correct position, so the correct letter is
    constant for the whole chapter. Scan of the saved corpus: **SS is worst — all four chapters
    single-letter** (`social_sciences/ix/ch_05` 11/11 → A / pos 0; `vii/ch_04` 10/10 → A; `viii/ch_04`
    14/14 → A; `vi/ch_06` 16/16 → B / pos 1). **Science 4 of 6 chapters pure single-letter**
    (`science/ix/ch_02` & `ix/ch_08` all B; `vi/ch_04` & `vii/ch_11` all A; `vii/ch_02`, `viii/ch_05`
    one-letter-dominant). **Mathematics is the healthy counter-example** (genuinely mixed within
    chapters — proves this is a *generation artifact*, not a schema constraint); English/TWAU have
    too few MCQs per chapter to judge (English also mixes numeric "1"/"2" vs letter labels — a
    separate normalization inconsistency, noted, not fixed). *Fix:* a MUST-NOT added to Rule 7 in
    each file — the correct option must vary in position across the assessment; distribute
    `is_correct` across labels A–D so no single letter dominates a chapter; never place the correct
    answer at the same label across consecutive items. Placement per file: **SS middle** (Rule 7 ·
    MCQ Distractor Design, prohibition line) **v2.2→2.3**; **SS secondary** (Rule 7 · MCQ Design,
    new prohibition item 3) **v1.0→1.1**; **Science secondary** (Rule 7 · MCQ Distractor Design,
    leaning on its existing "position carries no signal" language) **v1.0→1.1** (header+footer);
    **Science middle** (Rule 7 prohibition cell, re-padded into the ASCII table) **v1.2→1.3**. The
    "exactly one `is_correct`, labels A–D" schema rule was left untouched. *Validated:* constitution
    text edited + version-bumped ONLY — NOT run live, and **the existing corpus was NOT back-filled**
    (SS IX ch5 etc. still carry the clustered answers). *Pre-warm must confirm:* live SS + Science
    MCQ generation spreads the correct position ~uniformly across A–D, no chapter clustering on one
    letter, no same-label runs. *Also owed:* a one-off corpus repair pass (deterministic
    position-shuffle of the already-saved SS/Science MCQs, re-tagging `is_correct` + the option
    order) to fix the clustered plans retroactively — separate from generation. (src: 2026-07-16,
    founder-reported audit.)
    **★ SUPERSEDED BY AMENDMENT A9, 2026-08-02 (recorded at SS·secondary C4, per testing.md C4's
    footnote).** The position PROHIBITION is replaced by a CONVENTION: author the four options,
    then as the LAST step before emission arrange all four — the correct one included, never led
    with — alphabetically from the first word at which they differ (ascending where numeric) and
    label them A–D in that order. Under A9 **uneven letters across a chapter are coincidence, not
    a defect**, so the old "spread the correct position / no same-label runs" check is retired and
    ARV-D-003 (5/6 on B) is moot as framed. What is now checked is whether the ORDERING STEP ran.
    *First live result (SS·IX ch 3 library, 18 MCQs across {12,9,7}):* **FAIL — 10/18 are not in
    alphabetical order**, most breaking at the 2nd–4th word (top 3/6 · p09 2/6 · p07 5/6);
    ARV-D-018. Also surfaced: A9's two clauses can COLLIDE — on 2 of the 18, strict alphabetical
    puts the correct option at label A, which "never led with" forbids, and the constitution does
    not say which clause wins. **RULED same day: the ban is REMOVED — SS·secondary assessment
    v1.5 → v1.6** — two words struck, nothing added. An affirmative replacement naming A as a
    legal landing was drafted and REJECTED: mentioning label A in the rule at all makes A salient
    and invites the model to reason about position, which is what the convention exists to
    prevent. The rule now states only what the arrangement is. Prohibition 3 unchanged, now the
    whole guard.
    **★★ CLOSED BY CODE 2026-08-03 — the arrangement LEAVES the constitution (SS·secondary
    assessment v1.6 → v1.7, ARV-D-032).** Measured on the v2.0 library under v1.6: **15 of 18
    MCQs unarranged** — worse than v1.5's 10/18 — with the correct option at A or B on 16 of 18
    and never at D. Three amendments, one ₹6 probe and three weeks RAISED the rate, so wording
    was never the lever: the rule is a SORT of four 40-word strings, asked of a generation 26k
    output tokens deep (the break sat at word 2–4 in 11 of the 15). Founder ruling: enforce in
    code and strike the sentence. **`genon/normalize_options.py` v1.0** is STEP 6 of
    `build_library.py` — sorts word-wise (ascending numeric only when an option OPENS with a
    number), relabels A–D, remaps `guide.MCQ.what_each_option_reveals`; option text and
    `is_correct` are never touched; idempotent; runs under `--certify-only`, so it repairs
    existing libraries at ₹0; records `items_scanned`/`items_moved` into
    `genon_canonical.repairs[]` **so the generation-quality rate survives as a statistic instead
    of being silently absorbed**. Certification gains a ninth check ("MCQ options in arrangement
    order") whose job is to prove the stage ran. v1.7's Rule 7 says only that order carries no
    meaning; prohibition 3 now bans an option that references another option BY LABEL ("both A
    and B", "none of the above") — the one construction a downstream sort cannot reorder without
    rewriting. ch 3 normalised in place: 15/18 moved, distribution A6·B10·C2·D0 → **A3·B7·C4·D4**,
    library re-certified ALL PASS, ₹0, no re-author. **The other ten assessment constitutions
    must receive the v1.7 form at their own P2 — the arrangement sentence is never re-added;
    only the label-reference prohibition travels.** ARV-D-018's ordering half is closed with it.
    Pre-warm check for this item is now: `items_moved` per library — a stage where it drops to 0
    is the model doing it unaided, which is worth knowing but changes nothing.
    (Historical note follows.) This partially reverses v1.4,
    which had added the ban on probe evidence ("distractors sorted, correct answer pulled to A") —
    that diagnostic is deliberately given up; a correct answer at A is now caught only as an
    ordering failure. Relaxing amendment: no v1.5 artefact becomes non-compliant. **The other ten
    assessment constitutions must receive A9 in this v1.6 form at their own P2 — never v1.4/v1.5's
    wording.** *(That instruction is STRUCK, 2026-08-04 — superseded by the v1.7 form stated
    above: the arrangement sentence is never re-added at all. `docs/testing.md` §3 P2 (template
    2.5) and the rollout brief §3 were rewritten the same day so no stage inherits it; SS·middle
    was the first stage amended under the corrected text — LP v2.8 · assessment v2.4, artefacts
    in `genon/out/stage_prep_ss_middle/`.)* ARV-D-018's ordering half (10/18) stands open and
    unaffected.

19. **The CURLY-QUOTE narration format (5 LP constitutions, 2026-08-11)** — maths middle
   v3.9 · maths prep v1.4 · english prep/middle/secondary v1.1/v1.6/v1.1. The Format and
   Example lines now show `book_ref (“brief....”)` instead of straight double quotes, to
   remove the JSON escape hazard rather than repair it. *Validated so far:* the amendment
   itself is unexercised — every artefact on disk was authored under the straight-quote
   text (which the amendment explicitly keeps valid). *Must confirm live:* that generation
   actually EMITS curly marks and that nothing downstream chokes on U+201C/U+201D — the
   register scan, the copyright scan, the PDF/DOCX exports and the on-screen renderer all
   read this text. **The next paid call tests it for free: maths III ch 5's 8-period
   compact is the first generation under the new wording.** If it comes back with straight
   quotes anyway, the Format line is not where the model is taking its cue and the
   amendment needs re-siting, not re-wording.
   **★ TESTED LIVE 2026-08-13 (S9 · C4) — FAILED, AND THIS CLAUSE IS WHAT FIRED.** Curly marks
   emitted across the english family: **0 / 0 / 0** in S9's three files, **21** at english VI
   (S10), **0** at english IX (S11). Straight DOUBLE quotes: **0 everywhere**. The model wrote
   111 / 168 / 71 straight SINGLE quotes instead. So **the amendment's PURPOSE is fully met** —
   the JSON escape hazard cannot occur in any english library — **and its FORMAT is not**, at two
   of the three stages. The operative cue is "do not put a double quote inside a JSON string",
   which the model obeys perfectly; not "use U+201C". Per this clause the amendment needs
   **RE-SITING, not re-wording**. **And C3 reached the same conclusion from the other end the
   same day:** ARV-D-145 found Rule 9's *narration Format* followed by 1 of 199 bands across
   three stages. The curly marks and the parenthetical shape are **the same two lines of the same
   rule** — two independent measurements now say Rule 9's Format block is not load-bearing on
   generation. ARV-D-152.

20. **TWAU assessment v1.4 → v1.5 (2026-08-12, from ARV-D-120)** — three brief additions, no
   mapping changed: Rule 3 Prohibition 3 (a `dominant_mode` code — O&R/HI/D&C/C&E/R&A — is
   never a `question_type`; the mode is the LEFT column of Rule 3's table, the type is the
   RIGHT); the A1 schema's `question_text` line now requires a NON-EMPTY stem on MCQ/SCR/ECR;
   A1 Prohibition 8 forbids `null` on any field. *Cause:* the pilot's U11 item emitted
   `question_type: "HI"` with `question_text: null` — a correct SCR wearing the wrong column's
   label and asking nothing. Founder authorised the artefact back-fill; this closes the source.
   The table itself was deliberately NOT inverted (founder, same day). *Validated:* text only.
   *Wave 1 must confirm:* every `question_type` in `{MCQ, SCR, ECR, OPEN_TASK}`, zero mode
   codes, every non-OPEN_TASK item with a non-empty stem, no `null` anywhere. Detection is
   already gated (`build_library.py` item-shape gates, ARV-D-123) — this is the prevention half.
   **Same table shape exists on science (mode) and SS (weight tier): amend at S9–S11's P-prep,
   not mid-campaign.**

21. **English·secondary LP v1.2 + assessment v1.4 (2026-08-12, S11's P-prep)** — the
   carry-forward (A1 · register · A6-as-Rule-8A · A9's two lines · P3) plus four measured
   edits: **FULL SPINE COVERAGE** (Rule 2 STEP 3 no longer lets a short plan drop a spine),
   Rule 1's closing-unit exception, `task_brief` ≤12 → ≤18, `section_context` 10–15 → 10–18,
   and a 50-minute row in Rule 2 STEP 1's task budget. *Validated:* text only, plus a corpus
   measurement of the two word caps and of the ch 12 spine drop the coverage mandate forbids.
   No english library has ever been generated under any of it. *C1/C3 must confirm:* every
   canonical of ch 7 teaches all six spines at 17, 14 AND 10 periods (the whole point of the
   amendment, and the floor is where it binds); the closing unit of the standard names several
   spines without the constitution having named a synthesis; `task_brief`s carry the locator
   and fit 18; `section_context`s fit 10–18; and the bands arrive as `time_bands`/`activity`
   with no `phases` residue. **Two numeric limits in this pair are still unexercised by any
   generation and should be read at C3 with the S4 lesson in hand:** Rule 9's `≤10-word brief`
   inside band narration (the corpus does not use the quoted-brief format at all) and Rule 11's
   `expected_elements` "3–5 bullets, each ≤ 12 words". **The pilot is PROSE, so the whole
   [SECONDARY DELTA] drama branch — `drama_summary`, role-assigned reading, act-splitting
   through Rules 1/2A/3/4 — is untested by S11; ch 11 is class IX's only drama and the pre-warm
   sweep owes it a run.**
   **★ AMENDED AGAIN AT C14 (2026-08-12): assessment v1.4 → v1.5, the POEM LOCATOR (ARV-D-138).** Rule 9's extract block copied `poem_text` verbatim, and `poem_text` is the NCERT poem — measured: 13 of ch 2's 16 lines appear verbatim in the textbook PDF, and 8 of english IX's 16 chapters are poems. A poem item would have put 3–8 published lines into a CANONICAL, which is what goes to the cloud: finding F2 of the copyright review, landing on the stage that owns it. Closed by replacing the block, for poem sections only, with a LOCATOR — `Read lines N–M on p.PP, beginning "<incipit>"`, incipit ≤ 8 words, no ellipsis, lines copied into no field. Five edit sites (Rule 4 type definition incl. its 'or inline' escape · Rule 3 REQUIRED · Rule 9 opening · Rule 9 formats · schema comment). READING `poem_text` stays legal (INPUTS §2, Rule 2(a), Rule 6) — the summary never leaves the machine. *Validated:* text only, plus the measurement above. *C1/C3 of the first POEM chapter must confirm:* the stimulus is a one-line locator, the incipit is ≤ 8 words, and no poem line appears in any field. **S9 and S10 owe the same five edits at their own P2** — free until their first poem chapter is authored, ~₹80 a library afterwards.

22. **English preparatory + middle assessment — the POEM LOCATOR carried early (2026-08-12,
   from S11's C14 · ARV-D-138)** — `assessment/english/preparatory` **v1.2 → v1.3** and
   `assessment/english/middle` **v3.4 → v3.5**. Rule 3's REQUIRED line ("a specific line, image,
   or phrase from `poem_text`") invited the poem into `item_stem` with nothing capping it; it now
   reads ADDRESSED BY ITS PLACE, NOT COPIED OUT — a stanza/line reference plus an incipit of at
   most eight words — and a matching PROHIBITED clause bans copying the lines into `item_stem`,
   `visual_stimulus`, `suggested_answer` or any rubric field. Two edits per file, not secondary's
   five, because neither stage carries the EXTRACT_ANALYSIS 3–8 line extract block. Reading
   `poem_text` stays legal at both. *Validated:* text only. *C1/C3 of the first POEM chapter at
   either stage must confirm:* no poem line in any field, the incipit ≤ 8 words, no ellipsis
   continuation. **Sidecar CHANGELOGs created for both files** (neither had one) with the
   pre-2026-08-12 history reconstructed from item 9's inventory and flagged as each stage's own
   P4 to complete.

23. **English assessment — THE PAIR: two items per spine-cell, all three stages (2026-08-12)** —
   `assessment/english/secondary` **v1.5 → v1.6**, `middle` **v3.5 → v3.6**, `preparatory`
   **v1.3 → v1.4**. Rule 2 now emits **TWO** items per `section_contribution`, not one, on a
   **prescriptive per-spine SLOT TABLE** (SS Rule 4's weight-table style, chosen by the founder
   over science-secondary's advisory-budget style): slot 1 at the comprehension/application rung,
   slot 2 at analysis/creation, and the two MUST NOT share a `question_type` — sole exception
   Speaking/Writing, whose spines permit exactly one type and whose pair differs by MODE/FORM.
   Rule 8A (NEW at middle + preparatory, which had none; amended at secondary) declares
   **TWO-STAGE SCOPING** — slot 1 scoped to the cell's early teaching, slot 2 to its completion —
   which is what licenses the platform to disperse them; the `period_ref`/`unit_ref` prohibition
   is unchanged and now carried at all three stages. Item count = **2 × section_contributions**.
   *Cause:* english·secondary measured **0.35 items/unit**, the lowest of any subject·stage (next
   lowest 0.93, TWAU 1.0, SS 1.3–1.6) — and worse, only **6 of 17 units** of the ch 7 canonical
   carried an Assess tab at all. Root cause in `docs/english_secondary_item_density.md`: english
   is the only subject whose assessment axis is CAPACITY-bounded (six spines, fixed) rather than
   content-bounded, and post-split a chapter is one main_section, so the ceiling is 6 items at
   any period count. *Validated:* text only, plus a simulation over the three real ch 7 plans
   (17/14/10 units) with each item duplicated into a pair — ratio 0.35 → 0.71 / 0.43 → 0.86 /
   0.60 → 1.20, assessed units 6 → 9 of 17. **No english library has ever been generated under
   any of it, and the three certified ch 7 canonicals are all pre-amendment (6 items each).**
   *Pre-warm/C1/C3 must confirm:* exactly 2 items per contribution and never 1 or 3; slot 1
   emitted BEFORE slot 2 within each contribution and contributions never interleaved (the
   platform's dispersion depends on it); the two items differ in `question_type` everywhere
   except Speaking/Writing; both carry the SAME `source_lo`/`source_context`; the pair takes
   DIFFERENT strands of a compound `implied_lo` rather than the same strand twice; and at
   preparatory the pair stays light (no two WRITING_TASKs, oral preferred for slot 2).
   **★ PREPARATORY TESTED LIVE + PASSED 2026-08-13 (S9 · C1/C3/C4, ch 11, 15 pairs across three
   canonicals) — THE FIRST ENGLISH LIBRARY EVER GENERATED UNDER THE PAIR.** Every clause holds:
   exactly 2 per contribution **15/15** (and **10 items at 12, 10 AND 7 units** — v1.4's
   invariance line proved live); slot 1 before slot 2 with no interleaving; types differ 15/15;
   same `source_lo`/`source_context` 15/15; different strands of a compound LO where the LO is
   genuinely compound (`word_work` splits MATCH→animal pairs, ORAL_PROMPT→describing words;
   weaker on `reading`, where both slots lean structure); and the **preparatory lightness clause
   holds** — zero double-WRITING_TASK pairs, slot 2 oral in **11 of 15**. **Live density: 0.83
   items/unit at the top and 1.43 at the floor**, against the 0.35 that caused the amendment.
   **The one clause that FAILS is the SLOT TABLE** — `writing` slot 1 emitted FILL_IN in 3 of 3
   files where the table prescribes SCR, plus two one-offs (ARV-D-146). Counting is solved;
   slotting is not — the same split SS·secondary's C4 found on 2026-08-03.
   **Middle and secondary are still owed a live PAIR run.**

> Process rule: `data/` (constitutions + saved plans) is git-ignored, so these amendments have
> **no VCS trail** beyond this list and their dated entries — this checklist is the only durable
> index of "changed but not run". Keep it current.

---

## 2026-09-11 (newest, later) — TRACK D STEP 1: `packages/shared` LIFTED, WEB ON IT

- **What:** `packages/shared` (`@aruvi/shared`), an npm workspace at the repo root (root
  `package.json` new; `web/package-lock.json` retired — ONE root lockfile, generated by
  `npm install` at the root). Contents: web/app/lib's format · sectionState · sectionHistory ·
  verify · legalmd · auth + ask-aruvi bank · search, plus three new modules — `storage.js` (the
  synchronous shim, memory → localStorage → MMKV), `config.js` (API base + token provider,
  `API` a live binding), `signout.js` (`clearTeacherCaches`). Full account in
  docs/mobile_migration_plan.md §Track D step 1.
- **Design calls:** the package has ZERO dependencies and NO JSX — the supabase client is
  created by each app and handed to `configureAuth`; `boldMarks`/`renderMarkdown` became
  `parseBold`/`parseMarkdown` (data), and the web's thin wrappers in `web/app/lib/` render
  them as before (components import paths unchanged). Every wrapper imports `shared-setup.js`
  first so boot has happened whichever wrapper a component pulled in.
- **Sign-out residue fixed** (yesterday's finding): page.jsx's onSignOut now calls
  `clearTeacherCaches([...web userKey prefixes])` — section state, history + owner stamp,
  chapter notes, the bank, the user id, and the per-user screen prefs all go.
- **Verified (Cowork VM + the cloud sandbox, neither can `next build` or reach npm):**
  node --test 9/9 on the package; babel-parse clean ×23 (Next's bundled Babel); old-vs-new
  `renderMarkdown` byte-identical on all 5 legal docs + `boldMarks` ×5 (react-dom/server);
  138 imports in web/app resolve (incl. the `@aruvi/shared/*` subpaths through a symlink
  standing in for the workspace link); CSS braces 2360/2360.
- **OWED on the Mac:** `git push` (the VM's egress refused github.com — commit f8c3d84b + this
  one are local); `npm install` at the root; `npm --prefix web run build`; a quick live pass
  (sign in → LessonView → sign out → confirm localStorage is empty of `current_chapter_`,
  `lu_`, `chapter_notes_`, `section_history_`, `aruvi_ask_bank`).
- **Step 1 closed on the Mac (founder):** push, root `npm install`, `next build` clean.

### later the same day — TRACK D STEP 2: `mobile/` AUTHORED (Expo), first phone run owed
- `mobile/` joins the workspace: Expo SDK 57 + Expo Router; `lib/boot.js` installs the shared
  seams; `theme/tokens.js` generated from globals.css (48 colours × 2 themes,
  `theme/gen-tokens.py`); fonts bundled; `MeyyMark`/`Bar`/`OtpBoxes`/`Markdown`/`ui`;
  screens: gate · login (choose → OTP → in; returning → known → OTP) · privacy · a proof
  screen with loading state, entitlement + readiness from the API, theme switch, sign-out via
  `clearTeacherCaches`. Full account: docs/mobile_migration_plan.md §Track D step 2.
- **Two decisions to confirm:** (1) storage is `expo-sqlite/kv-store` (sync, in Expo Go), not
  MMKV — MMKV needs a development build; swap later at the shim. (2) No Subscribe card on the
  phone's front door — beta on manual grants, no purchase screen; the web keeps its flow.
- `mobile/.env.local` written from web/.env.local (Supabase + Render; LAN line commented) —
  git-ignored with `mobile/.env*.local`.
- **Owed on the Mac:** `npm install` → `cd mobile && npx expo install --fix && npx expo-doctor
  && npx expo start` → Expo Go. Nothing in mobile/ has run yet — the sandboxes cannot install
  Expo; expect version nits from `expo install --fix`, not logic errors.
- **Next:** step 3, LessonView.

### 2026-09-12 — STEP 2 VERIFIED ON THE FOUNDER'S iPHONE + a production regression fixed
- **Meyy runs on a real phone.** Expo Go (tunnel mode — LAN was blocked; needed `expo login` +
  `@expo/ngrok` devDep), SDK bumped 54→**57** (the store Expo Go had moved on; iOS only carries
  the latest). Signed in `9000000003` / `123456` → the proof screen shows the REAL record from
  Render+Supabase: "Social Sciences · Class IX", trial 1 of 3 — not the stub. Fonts, dark theme,
  OTP boxes, sign-out all correct. Full chain proven: phone → Supabase OTP → Bearer → Render API
  (supabase mode) → Supabase Postgres.
- **Regression found & fixed — render.yaml was reverting the cutover.** The phone first showed
  "local" (header-mode fallback). Root cause: `ARUVI_AUTH_PROVIDER` and `ARUVI_STATE_BACKEND` had
  the 2026-09-10 cutover values set ONLY in the Render DASHBOARD, while render.yaml still said
  `header`/`file`. Render is Blueprint-managed, so every deploy re-syncs the file over the
  dashboard for keys with an explicit `value:` — a redeploy reverted the whole product (web too)
  to disk + header auth. Fix: pinned `supabase`/`postgres` IN render.yaml (commit 41be8c6d), with
  comments so it isn't undone. Secrets (ARUVI_SUPABASE_URL, ARUVI_DATABASE_URL) are `sync:false`
  so they survived; confirmed present, deploy Live, dashboard now reads supabase/postgres.
  ⚠️ RULE: env that must persist goes in render.yaml with a `value:`, never a dashboard-only edit.
- **Next:** step 3, LessonView against live `/plans/…/view`.

### 2026-09-12 (later) — TRACK D STEP 3: LessonView + My Classes AUTHORED (phone test owed)
- `mobile/components/LessonView.jsx` (the teaching screen, ported from web), `app/(app)/lesson.jsx`
  (route: pull section state → fetch /view → render), and `app/(app)/index.jsx` rebuilt as My
  Classes (one card per subject·grade·section; attached chapter = CONTINUE + unit N, opens tracked;
  others read-only). Unit model = periods; four tabs Overview/Material/Lesson/Assess; phases spine
  + tappable bookmark; mark-complete/undo/reopen. Data shape confirmed against a REAL /view dumped
  from the engine (/tmp/sample_view.json): units at view.lesson_plan.groups[].periods[], assess
  filtered by meta.anchor_period===unit.number.
- Shared gained additive helpers readUnitPointer/setUnitPointer/readChapterDone/setChapterDone
  (same lu_ keys + pushSectionState as the web's inline writes); shared tests 9/9.
- Verified: babel-parse ×3, all @aruvi/shared imports resolve. OWED: reload on the phone and walk
  9A → Continue → Social Sciences Ch1 → tabs → bookmark → mark complete → undo.
- **Founder rule (2026-09-12, now CLAUDE.md §4): THE PHONE MATCHES THE WEB BY DEFAULT.** The web
  was designed mobile-first with the phone in mind; the Expo app is a port, not a re-design.
  Divergence only for a named technical limitation or a phone capability that clearly improves
  UX — anything else is a product change needing the founder's say-so. My first LessonView cut
  had drifted (top pip strip, LO in Overview, flat Assess, no ChapterOrg) — re-ported 1:1:
  LessonView shell + pvNav + completion strings, PhaseBookmark (drag), ChapterOrg (incl. the SS
  competency map + chapter-notes modal), the whole Assess family. Pure logic (itemTabSet etc.)
  verified identical to the web on the real items. Phone re-test owed.
- **2026-09-13 — the SKIN gap, found by the founder's side-by-side (web at iPhone 12 Pro
  emulation vs the Expo screen).** The 1:1 port had the web's structure but a guessed type
  scale. Diagnosed with Claude in Chrome: the DevTools tab was first at a 304px viewport (hence
  "looks large"); at a true 390 the web's computed styles are far smaller than I'd used —
  phase text 13px, notes 14.5px italic, unit tabs 11px uppercase mono, kickers 10.5px mono,
  "← ORGN." a 30px pine pill, mark-complete a mono uppercase 44px bar, pvNav a clay strip with
  11px bold mono. Measured EVERY LessonView/ChapterOrg/Assess/SS-map class from the live page
  → `mobile/theme/web.js` (keyed by web class names, token-mapped); re-skinned LessonView,
  ChapterOrg (+notes modal, SS map), AssessPanel, Bar onto it; fonts gained Fraunces 600
  italic + Plex Mono 700. Rule added to CLAUDE.md §4. Phone re-check owed. Note for the
  comparison: a CSS px is ~10% physically larger on the Mac than on the iPhone, so DevTools at
  100% always looks a touch bigger than the handset — proportions are what to compare.
- **Next:** step 4, My Classes "+" binding + full My Lessons library — and measure the web's
  My Classes / My Lessons classes into web.js the same way before building them.

## 2026-09-11 (newest) — THE WHOLE PRODUCT ON THE PRODUCTION STACK, DRIVEN LIVE

`NEXT_PUBLIC_API_URL` (web/.env.local; `format.js` falls back to `<host>:8000` when unset)
pointed the local web at Render; Claude in Chrome walked a fresh teacher end to end against
Render + Supabase Auth + Supabase Postgres: Create sign-in (test number) → first run
(SS · IX · ch 1, calibrated 50 min × 15) → served + attached to 9A → chapter note saved →
LessonView (notes, phases) → My Classes → unit 1 marked complete (server pointer → unit 2,
bookmark set) → Settings › Support sent (`MEY-S-752` — the series CONTINUED from the migrated
counter) → legal docs, Year Plan DOCX and data export all 200 → sign out → caches wiped →
returning sign-in by OTP → 9A restored at unit 2 from Supabase alone. **Everything passed.**
Three findings, none blocking: (1) the class-step sentence ("We'll start you with Section
NA") lags the wheel by ~2 s while it rolls; (2) ★ on a real network My Classes flashes "Pick a
chapter to begin" until `/plans` arrives — a false EMPTY state that never showed on localhost;
give it a loading state; (3) sign-out residue (the privacy-audit FIX item) — `current_chapter_*`,
`lu_pointer_*`, `lu_bookmark_*`, `chapter_notes_*` survive log-out; the second-device test had
to wipe them by hand. Test teacher `9000000003` left in place for the founder's own look.
Render free instance was NOT asleep during the walk (calls 100–600 ms).
★ **Founder, same day, from the phone: tour step 19 was hidden behind the keyboard** — Ask Meyy's
search box `autoFocus`ed on open, and step 19 opens the panel to SHOW it. Fix: `AskAruvi` takes
`autoFocus` (page.jsx passes `tour == null`) and focuses only at ≥601px (the 2026-08-08 Login
rule) — on a phone a focused field is half the screen gone. Placeholder "Search Ask Meyy…" →
"Search…" (founder).
★ **SETTINGS HOME REORDERED BY FREQUENCY (founder, same day):** Teaching profile · Help ·
Support · Subscription & billing · Personal profile (subscribers) · Appearance · Marketing
emails · Legal · About Meyy · ACCOUNT { Your data & export (subscribers) · Log out · Delete }.
The "Emails"/"App" captions are gone; Appearance and Marketing emails now wear the SAME card
as every other item (bold title + one-line description, `.set-bigcard-static`, the control
where the chevron sits) — the ⓘ and its hint went, the description says it; Your data &
export moved into the Account card as a row. Babel-parse clean, CSS 2358/2358; live + 360px
pass owed on both.
★ **"WHY NO SUBSCRIBE BUTTON FOR 9000000003?" (founder, same day)** — because `entTrial`
(page.jsx) and Settings' `onTrial` required `ent.enforced`, and Render runs the beta with
enforcement OFF: no teacher was ever "on trial" to the screens, so no Subscribe door and
Personal profile shown to a trial account. Fixed on the 2026-08-26 principle already applied to
`active` — **enforcement decides what is REFUSED, the record decides what is TRUE** — trial now
= `status === "trial" || plan_id === "trial"`. The two `enforced &&` sites that remain
(PrepareLesson's "N of 3 used", FirstRun's trial card) describe the CAP, which exists only when
the gate is on, so they stay. ⚠️ Consequence: with the gate off locally, dev accounts without a
grant now see the trial UI (no Personal profile / export) — that is the truth, and `./dev.sh
grant` is one command. Decision owed: flip `ARUVI_ENTITLEMENT_ENFORCED=1` on Render for the beta
(the persona pass CLAUDE.md §9 already lists) so trial means 3 chapters and Subscribe means it. ★ **DONE the same hour (founder: "yes render should enforce"):**
`ARUVI_ENTITLEMENT_ENFORCED=1` on Render and in render.yaml; verified from Chrome —
`enforced=true`, 9000000003 on trial at 1/3 (yesterday's chapter COUNTED even with the gate
off: counting was never gated, so nobody gets a hidden extra), Subscribe button present with
"FREE TRIAL · 1 of 3 chapters used", Personal profile + export correctly hidden. Appearance
card now hides at ≥601px (`.set-appearance`) — ThemeToggle is phone-only, and a card with no
control was a question with no answer. Production is now the beta configuration end to end.

---

## 2026-09-09 — TRACK C: ONE DOCUMENT BACKEND UNDER FIFTEEN PORTS

**Founder chose "individual ports, combined storage".** `document_backend.py`: FileBackend
(the tree, byte for byte, default) + PostgresBackend (one `documents` table, jsonb body,
bytea blob, key = the folder path). All 15 adapters refactored to it — domain logic
untouched, private read/write/lock copies gone, `slug` centralised (now strips `_` too, so
no tenant can slug into `_series`/`_ledger`). `config.state_backend()` +
`ARUVI_STATE_BACKEND` + `ARUVI_DATABASE_URL`; main.py's wiring block builds it once.
`migrate_state_to_postgres.py` (copy + verify, idempotent). ★ **Verified in the cloud
sandbox on a real Postgres 16:** contract on both backends, 198/198 documents migrate
equal, API journey on postgres end to end, and the EXISTING API suites in postgres mode
14/14. ⚠️ Two lessons: (a) `lock()` must be an RLock — the first cut deadlocked on a
nested lock in one thread; (b) the erase tidy-up climbs only through EMPTY ancestors —
a school tenant with other teachers keeps its folder, and a test that forgot that was
the test's bug, not the code's. Postgres does neither (a DELETE by prefix is the whole
erase). Docs: CLOUD_DATA_MODEL §4 header rewritten to say how it actually landed. ★ **CUT OVER 2026-09-10** — 198/198 into Supabase (session pooler, from the Mac), Render on
`ARUVI_STATE_BACKEND=postgres`, migrated accounts read back from the public host. Lessons: pool
retries tripped Supabase's circuit breaker on a bad password → `PostgresBackend` now fails
fast; DB password was pasted into chat → reset. Render disk = rollback for a week, then drop.
`ARUVI_AUTH_PROVIDER=supabase` flipped on Render the same hour and verified from Chrome: dev
header → 401, no credential → 401, a Supabase OTP session (test number) → registered, account,
entitlement, erase all 200. **The production stack is now complete on the stub-free path:
Render API · Supabase Auth · Supabase Postgres.** Still owed: Supabase Pro before teachers;
drop the Render disk after a week; real SMS after DLT.

---

## 2026-09-09 — MOBILE MIGRATION BEGINS: THE STACK IS CHOSEN, TRACK A IS BUILT

**Founder settled the external stack:** Render (FastAPI + aruvi_core) · Supabase (Postgres,
Auth, RLS/backups/admin) · an Indian SMS provider for OTP · payments deferred. Plan:
`docs/mobile_migration_plan.md` (four tracks A–D, 7-week phasing). Two defaults taken there
pending objection: the web channel moves to Supabase Auth with the app, and the first mobile
screens ship against the Render disk while Postgres adapters land underneath, port by port.

**Track A built, not yet deployed:** `Dockerfile` (named COPYs only), `.dockerignore`,
`render.yaml` (Singapore, starter, 1 GB disk at `/var/aruvi`, `/health` check),
`deploy/entrypoint.sh` (seeds ONLY `invoices/_series` · `support/_series` ·
`consents/_ledger` onto an empty disk, so numbering continues), `deploy/smoke.sh`,
`deploy/README.md`. `config.CORS_ORIGINS` (`ARUVI_CORS_ORIGINS`) replaces the hardcoded `*`
and the middleware now exposes `ETag` + `Content-Disposition` — cross-origin JS could not read
either before, which means bank.js's `If-None-Match` was probably never conditional across
the :3000→:8000 split (worth a live check).
★ **Two stale beliefs corrected:** (1) `data/cloud/` — and `data/authoring/` — ARE tracked in
git (`.gitignore` says so; CLAUDE.md §5 said the opposite). Render therefore has the content
with no sync step, and the image must never `COPY . .`. (2) The serve cache lives in the
image's content tree and is lost on redeploy — fine by CLOUD_DATA_MODEL §1's own reading.
★ **Verified on Python 3.12 + dash (the image's runtime; the Mac is 3.10):** seeding; second
boot does not re-seed; smoke green; SS·ix ch 4 serve at 16×60 → 200 in 34 ms; DOCX export;
erase leaves only the seller-side stores + erasure log; CORS refuses a foreign origin, allows
the configured one. Docker Hub was 403 from the sandbox, so the first real `docker build` is
Render's — watch that log. ★ **DEPLOYED the same afternoon — https://meyy-api.onrender.com is LIVE.** GitHub org
`Meyy-in` created (business: Meyy (OPC) Private Limited, contact support@meyy.in), repo
transferred there, clone re-pointed; Render account under the meyy.in Google login, free
workspace + Starter instance + 1 GB disk; Blueprint applied with the four SMTP secrets. Smoke,
SS·ix ch 4 serve and erase all green against the public host (~100–200 ms/call). ⚠️ Neither
Cowork sandbox can reach `onrender.com` (proxy 403) — checks go through Claude in Chrome
(`fetch` with the header from a page on the host). `deploy/smoke.sh` was rewritten to fail
loudly (it had printed "ok" on a failed curl). **Track B code BUILT the same evening** (see the plan doc §Track B): `SupabaseAuthProvider`
(offline JWT verification, JWKS + HS256) behind `ARUVI_AUTH_PROVIDER=header|supabase`;
`_current_identity` reads bearer OR header, never both; identity = the 10-digit mobile from
the token's `phone` claim (`identity_from_claims` is the one place to flip to `sub`);
web `lib/auth.js` + real six-box OTP in Login.jsx, returning sign-in now OTP-verified too;
`next build` clean on the Mac; `tests/test_supabase_auth.py` 14 green. ⚠️ `PyJWT[crypto]` is a
new API dependency — Render rebuilds with it on the next push. ★ **LIVE LOCALLY the same night.** Supabase project `meyy` (Mumbai, Free, ES256 keys, phone
provider on with Textlocal placeholders, test numbers 919000000001–3 = 123456): Create→OTP→in,
returning→OTP→in, stale stub session→front door (page.jsx rehydrate now treats 401 as REFUSED,
not "no profile" — before this a rejected id got first-run). Full record: plan doc §Track B.
Owed: flip Render to supabase mode; live 360px screenshot; real SMS after DLT.

---

## 2026-09-07 — THE TEACHING LEDGER LEAVES THE BROWSER

The last piece of teaching state living in localStorage alone. `sectionHistory.js`'s own
header had said the mirror was owed "when Phase 4 lands"; the mobile-migration assessment
(§4) made the cost concrete — **every other store already reconciles from the server, so a
teacher on a phone AND a laptop would have agreed about everything except what her classes
have actually been taught.** The exact two-device split-brain `sectionState.js` was built to
end, surviving in the one store nobody had migrated. Founder: "do it right away".

Built to the sectionState pattern — `SectionHistoryRepository` port + file adapter
(`section_history/{tenant}/{user}/{year}/history.json`, atomic write, process lock,
`raw_decode` self-heal) + `GET`/`POST /section-history` + localStorage as a **synchronous**
optimistic cache (`readHistory`/`hasHistory` are called during render and must never become
promises).

★ **THE ONE DELIBERATE DIFFERENCE: IT MERGES, IT DOES NOT SNAPSHOT.** Section state is
CURRENT state, so a per-section snapshot is right — the last writer holds the truth. History
is CUMULATIVE, so a whole-map write from a phone that has never seen the laptop's rows would
DELETE them. Every entry is upserted under its own chapter FILE with latest-`ts`-wins, both
sides of the wire; the pull UNIONS rather than replaces. Three consequences worth keeping:
(a) convergence from any device in any order with no loss; (b) every write is idempotent, so
the client can push fire-and-forget and replay freely (a TIE keeps the stored row — that is
what makes a replay a true no-op rather than a churn); (c) **the wholesale-empty guard
sectionState needs is unnecessary here by construction** — a merge that adopts nothing
changes nothing, so a transient empty read cannot wipe a ledger the way a corrupt state.json
once flashed every card back to "pick a chapter". A malformed `ts` LOSES, in both languages
(`_ts_of` / `tsOf`, pinned against each other by a test that reads the JS): *a merge may not
destroy what it cannot prove is stale.*

★ **THE BUG I ALMOST SHIPPED — the push-back is a cross-account WRITE.** The reconcile must
push rows the server is missing, or an existing teacher's ledger (accumulating in one browser
since 2026-07-04) would look empty on her second device and she would conclude the feature
lost it. But sign-out does not clear the section caches (the privacy notice's own "sign-out
residue" FIX item), so on a shared staff-room browser teacher A's leftover rows for any
section key B also teaches would be merged **into B's server ledger**. For sectionState the
same residue is merely stale — its pull OVERWRITES local from the server and only pushes on
an explicit act of hers. Fixed with an owner stamp (`section_history_owner`): the cache is
CLAIMED before every reconcile and wiped first if it belongs to someone else. An ABSENT stamp
counts as the current teacher's — that is the pre-migration browser, whose ledger is exactly
what the push-back exists to carry up, and before this feature a cache could only have come
from the one teacher using that browser. Sign-out clears it too, as the belt to that brace.
**Whenever a sync gains a push-back, ask whose rows it is pushing.**

★ **UNTRACK STILL DOES NOT REACH THE STORE, AND THAT IS STRUCTURAL.** "Untracking a chapter
must not erase the record that it was once taught" — so the port has **no per-entry delete**,
and a test asserts its absence rather than trusting the convention. What DOES reach it is the
stronger act: the SECTION leaving the profile (`delete_section`, wired at the two sites that
already delete its POINTER — the readiness profile drop and the trial purge), or re-adding the
same tag would inherit a phantom trail. The trial purge needed a SECOND sweep over the
ledger's own keys: a section she taught and then untracked has a trail but no pointer, so the
pointer-keyed sweep walked straight past it.

★ **CUTOVER: CARRY, THEN CLEAR — and the two halves are different moments.** `_auto_roll_year`
carries the ledger with the bindings, because until she chooses to start fresh she is still
teaching the old cohort and a trail that emptied itself at midnight on 1 April would tell her
she had taught nothing all year. `start_fresh` clears both — *that* is where a new cohort
begins. The browser cache needs the explicit `clearLocalHistoryCache()` for the same reason
`clearLocalSectionCache()` exists, and one it does not: the pull UNIONS, so it can never
delete a local row on its own.

★ **EXPORT: FOLDED INTO THE SAME TEACHING ROWS, NOT A SECOND TABLE.** It is the ONLY record
that a chapter was ever taught (the pointer deletes its row when a chapter leaves the slot),
so an export without it would show her today's classes and call that everything Meyy holds.
A chapter finished in July and one she is teaching today are the same kind of fact about the
same class, so they share a row; the CURRENT binding wins. ⚠️ **A test caught the dedupe being
keyed on the wrong thing**: chapter NUMBER is derived from the filename and a legacy row's
shape derives `None`, while the ledger carries the number the app stamped — so the same class
on the same chapter landed in two rows and the document said both "set aside" and "at Learning
Unit 3" about it. **The file is the identity; the number is a display value.** `_YEAR_KINDS`
and the receipt label ("chapters taught") moved with it.

Verified: `tests/test_section_history.py` 16 green, two sabotages confirmed biting (merge →
replace; the store dropped from the erase traversal); backend suite green; babel-parse clean
on sectionHistory.js / page.jsx / MyPlans.jsx; the routes, export document, erasure receipt
and both cutover halves exercised end to end through TestClient. **Live + 360px pass owed** —
the one thing to check is a real second device: sign in on two, complete a chapter on one,
confirm the history glyph and popup appear on the other.

---

## 2026-09-04 — PRIVACY NOTICE DRAFTED, v0.1, WITH ITS AUDIT

Founder: "now its time to draft a specific privacy policy keeping in mind the nature of
the service". Two files. **`data/cloud/content/legal/privacy_policy_v0.1.md`** — the
teacher-facing notice, written to the DPDP Rules 2025 standard (Rule 3: standalone,
itemised data + purpose + basis per row, the three links) for the LAUNCH state, with
every not-yet-true statement bracketed `[AT LAUNCH: …]` and every open call `[DECIDE: …]`;
Grievance Officer = the founder by name (answered). Safe beside the agreement:
`api/legal.py`'s `_FILE_RE` matches only `consent_and_disclaimer_v*.md` (verified — versions
still 0.1–0.4, current 0.4). Not served yet. **`docs/legal/privacy_policy_considerations.md`**
— legal frame in dates (DPDP hard date 14 May 2027; SPDI Rules till then; E-Commerce Rules;
Companies Act §128 = 8 years for invoices), why Meyy's shape keeps the notice short (adults
only, fiduciary direct to the teacher, ONE free-text field, no runtime LLM, no analytics,
one person), and **15 audit findings** the notice must disclose or the code must fix first.
The ones that matter: sign-in ids in `?id=` query strings land in uvicorn access logs with
IPs (3.2); sign-out leaves notes/pointers on a shared device (3.3); the erasure log stores
the MOBILE while its docstring says "no personal data" (3.5); Google Fonts `@import` sends
every pre-login visitor's IP to Google (3.6 — self-host, all three faces are OFL);
`outbox/` retains full mail copies outside the erase walk (3.7); the notice is not shown at
trial sign-in where the mobile is first collected (3.13); the export card is hidden on
trial (3.14); `_KEPT` must grow to match notice §7 (3.15). **Four places must now agree on
what survives erasure:** notice §7 · agreement §G · `_KEPT` · the ledger's placement.
Consent claimed ONLY for marketing email; everything else on DPDP §7(a) — counsel to confirm.
**Same day, eleven decisions settled one by one (considerations §7):** role/state/city on the
service basis · dormancy 3 y → email → 48 h → erase · grievance resolved in 30 days ·
support@meyy.in only · mail copies kept 8 y with the invoices · erasure log keeps the mobile
and SAYS so · trial export: ignore · invoices 8 y [accountant] · fonts self-hosted · English
only · registered office `[ ]`. **Hosting: unknown and law-neutral** — DPDP has no
localisation duty for a non-SDF (Act §16 blacklist, Rules r.15), so the notice reads
`[country / region]`. No `[DECIDE]` remains; only `[value]` blanks and `[AT LAUNCH]` code
items. `_KEPT` must grow to six rows.
**Then BUILT, same day — GIVEN, NOT SIGNED.** Founder asked the normal practice (sign at
subscription vs. lives under Settings): the second, because DPDP §5 makes a notice something
a fiduciary GIVES at or before collection and consent (§6) is asked only where consent is the
basis (marketing). A tick would put the account on a withdrawable footing the notice does not
claim. `api/legal.py` second document family (`privacy_policy_v{V}.md`, no acks, title =
first `# `, dated footer → `published`); `GET /legal/privacy` OPEN (no identity — linked from
the OTP screen before a number is typed) · `/legal/privacy/status` · `POST /legal/privacy/seen`;
`Account.privacy_notice = {version, seen_at, context}` stamped server-side at
`/onboarding/verified`, at `POST /legal/consent`, on dismissal — rendered in the export,
erased with her. Web: `PrivacyNotice.jsx`; `legalmd.js` grew pipe TABLES (`data-th` per
cell; ≤600px stacks rows into cards — 3 tables/30 rows/90 cells smoke-rendered via sucrase);
Login: "By continuing you confirm you are 18 or older and have read Meyy's Privacy Notice"
on the OTP screen + a link beside "private and secure"; Agreement: the final tick's own
words "Privacy Notice" open a SHEET over the wizard; Settings › Legal: two pills, one card.
`_KEPT` → SIX rows; `tests/test_privacy_notice.py` pins it to notice §7 BOTH ways
(sabotage-verified); role/state/city now in the export; erasure-log docstring corrected.
**Three founder asks mid-build:** (1) the Legal pill switch is FROZEN under the Settings bar
(`.lgl-switch-stick`, the `.dash-hd` sticky idiom; OUTSIDE `.set-card` — overflow:hidden
would pin it to the card); (2) **no "updated" bar for existing accounts** — internal demo:
`updated = bool(seen_version) and seen_version != current`, an account with no record is
silent; (3) the pre-sign-in notice is a LOCKED FRAME (`.lgl-frame`, shares the sign frame's
CSS) — bar + "Privacy Notice" title pinned (title is now bare "Privacy Notice", not "Meyy —
…"), document scrolls, **Back at the TOP** inside the pinned head. All backend suites green
(fastapi/xhtml2pdf/python-docx now installed in the sandbox — the TestClient tests RUN here);
babel-parse clean ×6, CSS braces 2348/2348.
**Fourth ask + the live find (same evening, Chrome on the founder's localhost, 288×592 CSS
px):** "the buttons are fixed and texts are still floating" — the Legal band stuck 115px
BELOW the Settings bar with the document scrolling through the gap. Root cause is the
2026-08-09 **app-shell scroll ownership rule**: in the signed-in shell the document never
scrolls, `.bodycontent` is the scroller and the bar sits above it in flow, so every inner
sticky must be `top: 0` there — `html.app-shell .dash-hd/.lv-stick/.co-stick/… { top: 0 }`.
The new `.lgl-stick` was missing from that list and honoured `--nav-h` (115px) inside a
scrollport that already starts under the bar. ⚠️ **Any new inner sticky in the shell must be
added to that `html.app-shell … { top: 0 }` list, or it floats by exactly the bar's height.**
Band is now ONE pinned unit — pills + "Legal Agreement with User" / "Privacy Notice" heading
(hardcoded in Settings; the components' own `.lgl-head` hidden via `.set-legal-headless`) —
flush under the bar, verified live on both documents with the table stacking at 288px.

---

## 2026-09-03 — THE SUPPORT ADDRESS IS support@meyy.in, AS ONE TOKEN

Founder: "amend the email ID of support of Aruvi to support@meyy.in". Until now the
address a teacher was told to write to was `config.MAIL_REPLY_TO`, which fell through to
`MAIL_FROM` → `SMTP_USER` → the founder's Gmail — the support ID was a side effect of the
sending account. Now `config.SUPPORT_ADDRESS` (env `ARUVI_SUPPORT_ADDRESS`, default
`support@meyy.in`) is the ONE token, used in three places that must agree: the `address`
both `/support` routes hand the screen (the no-email trial fallback), the acknowledgement's
reply-to, and the destination of every filed case's copy (was `MAIL_FROM`). `MAIL_REPLY_TO`
now defaults to it, so subscription confirmations reply there too. `MAIL_FROM` deliberately
UNCHANGED — Gmail rewrites a From it does not own, so the SMTP account keeps sending and
the support address receives; do not set them equal unless the mailbox itself sends.
⚠️ The mailbox must actually exist and be read — case copies go nowhere else now.
Not touched: `consent_and_disclaimer_v0.1.md` still carries `[support email]` /
`[founder contact email]` placeholders — the agreement is versioned by FILENAME and
already ticked, so filling them is a v0.2 file, never an edit. test_support.py pins the
address (14 green). **Same session: the support reference series is `MEY-S-…`**
(`SUPPORT_PREFIX` default + the adapter's fallback; the invoice series' ARV → MEY move).
The counter is one plain integer (`support/_series/support.json`, `{"last": 743}`), not
keyed by prefix, so numbering continues at MEY-S-744 and the two ARV-S records stay valid
handles — never renamed.

## 2026-08-29 — THE COMPLETION TOAST WAS TELLING THE TRUTH: our own stale
push was clobbering the done-flag (found live, 1000000002, Class 6 Roja + Neithal, ch 1)

**The report.** Marking the LAST unit complete sometimes raised "That didn't save — your
classes are as Aruvi has them"; doing it again succeeded. Two live instances, both on the
completion transition, never on ordinary unit advances.

**The mechanism.** `markComplete` on the last unit ran `writePointer(...)` then `setDone(true)`.
Each calls `pushSectionState`, and each push SNAPSHOTTED localStorage at call time — so push #1
carried `done:false` (lu_done not yet written) and push #2 `done:true`. Two in-flight POSTs,
different payloads, racing: whenever the network delivered the stale one second, the server
ended `done:false`, the read-after-write verifier (2026-08-10 doctrine) truthfully found the
mismatch, and the toast fired. **"Random" because it needed the reorder; completion-only
because ordinary advances push two IDENTICAL payloads, which converge under any ordering.**
The server file adapter's process-wide lock keeps the file whole but decides nothing about
arrival order — the race was purely client-side.

**The fix — at the shared writer, not the dozen call sites** (`web/app/lib/sectionState.js`):
`pushSectionState` now COALESCES same-tick calls (the snapshot is taken in a microtask, after
every localStorage write of the tick has settled → one push, final state) and SERIALIZES
pushes per section (a call landing mid-flight queues one follow-up that snapshots fresh,
instead of racing the wire). Cross-section pushes still parallel. Queue-logic unit-tested in
isolation (one push with `done:true` for the markComplete sequence; serialized follow-up for
mid-flight calls); babel-parse clean. **Live pass owed**: complete a chapter's last unit and
confirm no toast + server row `done:true`.

★ **The keep-lesson: a fire-and-forget writer that snapshots at CALL time turns any
multi-write UI action into a payload race.** Coalesce at the writer, snapshot after settle.
Same class as the 2026-08-21 seeding-effects clobber (two writers, one value, no ordering) —
this one just needed the network to shuffle it.

**Same session, two founder-driven UI reversals, both recorded in-code:** (a) My Lessons no
longer persists its pane (`LS_PANE` retired) — every ordinary revisit opens on "Your lessons";
the Year-Plan budget pencil's round trip survives via the one-shot `lessonsPaneIntentRef`
(page.jsx stamps, MyLessonPlans remount consumes, `goClasses` clears) — CLAUDE.md's pencil
bullet amended. (b) The manage-mode class + section wheels CLUSTER again (founder overrode
his own 2026-07-26 "never cluster an add/remove wheel" rule, knowingly accepting that A+R
ticked hides B–Q); the SUBJECT manage wheel keeps the old rule — it is the site of the
original swallowed-Mathematics defect. Both static-verified only; live + 360px pass owed.

## 2026-08-27 — THE USER AGREEMENT IS A STEP, NOT A CHECKBOX:
## SIX TICKS BEFORE SHE CHOOSES SUBJECTS, KEPT AS EVIDENCE

**What changed.** `docs/legal/aruvi_consent_and_disclaimer_v0.1.md` — the founder's draft
agreement, five acknowledgements plus a final one — is now IN the product. Three surfaces:

1. **The subscribe wizard grew a step.** Verify · About you · **Agreement** · Subjects ·
   Pay. Five individually-ticked acknowledgement cards, then the full agreement body,
   then the final tick; Continue is dead until all six are down.
2. **Settings › Legal** — its own card (About Aruvi's subtitle drops "/ legal"), the same
   document read-only, with her acceptance record at the top.
3. **`POST /onboarding/checkout` refuses without a current-version signature** (409, in
   words she can act on — the client routes on them and sends her back to the step).

**Why BEFORE the cart, not before Pay.** The founder's placement, and it is the right one:
the five points say what Aruvi IS — a teaching aid, not endorsed by any board, no student
data, AI-assisted, personally licensed. Those are facts you want before choosing what to
buy. Placed after the cart the agreement arrives as an obstacle between a teacher and a
purchase she has already assembled, which is exactly the inversion of §0's benefit-first
rule that the "teach other classes?" window and first run's four extra screens were both
struck for.

**One source, or it will disagree with itself.** The markdown moved to
`data/cloud/content/legal/consent_and_disclaimer_v0.1.md` (Bucket A-serve — the runtime
serves it to every teacher before she pays, so it must travel inside the migration unit),
and `api/legal.py` PARSES it into {intro, five acknowledgements, agreement body, final
tick}. Nothing is retyped in JSX. **The version is the filename**: publishing v0.2 means
adding a file, never editing text somebody has already ticked, because her consent record
names the version she saw and that file has to still exist to be shown back to her. A
document that loses a tick raises `ConsentDocumentError` (503) rather than serving a
consent screen with four boxes — the kind of bug nobody would notice.

**Re-consent is per VERSION** (founder's choice of three): a subscriber adding a
subject-stage walks past the step; the same teacher after v0.2 takes all six ticks again.
That is what §J of the agreement already promised. The rule lives in ONE function
(`_consent_outstanding`) so the screen and the gate cannot disagree.

**The record is retained through erasure — deliberately, and said out loud in three
places.** Founder's call: proof the other party can delete is not proof. So the ledger
sits at `consents/_ledger/{tenant}.json`, OUTSIDE every `{kind}/{tenant}/{user}` folder
the erase traversal walks — the same reasoning that put the invoice number series in
`invoices/_series/`. Because a silent remnant is worse than none, the erasure receipt's
`_KEPT` list now names it, and §G of the agreement was amended to say what survives an
erase and why. **Those three must move together or none of them.** The record holds
tenant id, user id, document version, language and per-tick timestamps — no teaching
content, no notes, no profile. That minimum is what makes retaining it defensible. The
account's existing `consent` field carries a convenience mirror, which IS erased with her
account, and which the data-rights export now renders as an "Agreement accepted" row.

**Two things live testing would have caught and static work nearly didn't.**
(a) **The front door has no localStorage identity.** `getJSON`/`postJSON` attach
X-Aruvi-User from localStorage, and Login only calls `setUser` AFTER checkout — so a
signature taken on the front door would have been filed against the fallback identity,
and the gate, running as her real id, would then have refused a teacher who had just
ticked all six boxes. Agreement takes a `userId` prop and every request on that path uses
an explicit header (Settings passes none — there she is signed in). (b) **A consent 409 at
Pay has a place to send her**, so it sends her there rather than printing advice she
cannot act on from the Pay screen — the same lesson as the taken-email 409.

**Verified:** `tests/test_consent.py` (7 tests: the document parses to 5+1, a malformed one
refuses to serve, the ledger appends and isolates tenants, consent survives an erase and
the receipt names it, per-tick recording, partial/stale acceptance refused and NOT stored,
checkout gated then passed then not re-asked). test_entitlement/test_invoice gained
`accept_current` at their checkout calls (imported from test_consent, not re-derived — the
tick ids belong to the document). Full suite otherwise unchanged; the three red corpus
tests (normalized_item, unitize, unit_order) are pre-existing content issues, untouched
here. **Web half is STATIC-verified only** (babel-parse clean on Agreement.jsx /
SubscribeFlow.jsx / Settings.jsx / legalmd.js, CSS braces 2193/2193, every `.lgl-*` class
used has a rule) — **live + mobile (360×800) pass is OWED**, and the agreement is the
longest single scroll in the product, so the sticky footer and the 22px tick targets are
the two things to look at first.

---

## 2026-08-27 — THE FRONT DOOR OFFERS THE TRIAL ONE LAST TIME,
## AT THE CART, BEFORE ANY MONEY SCREEN

**What changed.** In the DIRECT subscription path (front door: choose Subscribe → OTP →
SubscribeFlow), the cart's **Continue →** no longer walks straight to Review & pay. It
raises a two-option box — **Trial** · **Subscribe**. Subscribe goes to Pay exactly as
before; Trial signs her straight in, the same landing the choose-screen's Free-to-try card
has always had (first run next, entitlement defaults to trial).

**Why the cart and not the Pay button.** The cart is the last moment that is still free to
undo. Once she is on Review & pay she has been shown a total, and an offer to go free at
that point reads as a discount haggle rather than an invitation. It also keeps the money
screen single-purpose: everything on it is about paying.

**Why front door ONLY (the coupling that matters).** The wizard has two doors, ONE
implementation (2026-08-25). The in-app door is the trial-exhausted paywall and Settings —
a teacher there has already spent or lost her trial, so a Trial button would be an offer
Aruvi cannot honour. The offer is therefore keyed to a new optional prop, **`onTrial`**:
present → the box exists; absent → the plain Continue it always was. `Login.jsx` passes
`() => enter(mobile.trim())`; `page.jsx` passes nothing, deliberately. **Do not make the
box unconditional** — that is the whole design, not an oversight.

**Honesty note on screen:** the box says her subject choices are not carried into the
trial. They are not (no cart is persisted); discovering that afterwards is exactly the
kind of small surprise that costs trust at the moment she is deciding whether to pay.

**Files:** `web/app/components/SubscribeFlow.jsx` (prop + `offerTrial` state + the box),
`web/app/components/Login.jsx` (passes `onTrial`), `web/app/globals.css`
(`.ob-offer-*`, reusing `.modal-backdrop`/`.modal-box`; own title because the shared
`.modal-title` is DANGER-coloured and this is an invitation, not a warning; z-index 80
clears the in-app `.subflow-overlay`).

**STATIC-verified only** — babel-parse clean on both components, CSS braces balanced
2157/2157. **Live + mobile (360×800) pass OWED**, and the walk that matters is: front door →
Subscribe → OTP → About you → cart → Continue → **Trial** → lands in first run; then the
same walk choosing **Subscribe** → Pay unchanged; then the in-app paywall's Subscribe →
Continue → **no box**.

---

## 2026-08-26 (late) — WHAT OF TODAY'S WORK IS NOW VERIFIED LIVE

Everything below this entry was written "STATIC ONLY — live pass owed". This records what
has since been walked in a real browser, on the founder's Mac, so the next session knows
what is still owed rather than re-testing what is proven.

**PASSED LIVE (teacher `1000000001`, Science · Middle retired to 25-Aug-2026, Science ·
Secondary live; 3 class-9 plans, two bound to 9A and 9C):**
- **Per-scope retirement** — the 8B card stays on My Classes (readiness is deliberately
  NOT scope-filtered: the class list carries); preparing a class-8 chapter is refused
  naming *"Science · Middle ended on 25-Aug-2026"*; 9A and 9C open, track and mark
  complete exactly as before; the profile "+" offers class 9 only; Settings shows one
  card "ended" in clay and one "until".
- **The full lapsed lockout** with nothing live — My Classes tab gone, "+" and pen and
  prepare bar gone, plans still open, Word and PDF exports still work, chapter notes
  read-only, no tour offer. Then restored, nothing lost.
- **Additive purchase + invoicing** — `1000000001` bought Science Middle and Secondary,
  the second purchase kept the first, and the invoice issued as `ARV/2026-27/7834`
  (the offset series), stored with its PDF under her account.
- **The subscription page** — a card per subscription, own validity, invoice download.
- **Back from the Add-subjects cart** now leaves the wizard instead of walking into a
  personal-details form she was never shown (found live, fixed same session).

**★ FOUND LIVE, SAME SESSION — the cutover dismissal outlived its session (and its
teacher).** Founder: *"I said NOT YET, then logged out and logged in — it's gone."* The
flag is documented as session-only ("it returns on her next sign-in until she actually
cuts over") and the code did not do it: `cutoverDismissed` sat in `page.jsx`, **and
sign-out is not a remount**, so the dismissal survived into her next sign-in — and into
the NEXT TEACHER's session on that tab. Byte for byte the defect A2 found in
`everGeneratedRef` this morning, in different clothes. Fixed by keying it to the teacher
(`useEffect(..., [user])` clearing both `cutoverDismissed` and `cutoverResult`), not by
adding a line to `onSignOut` — an identity can change without passing through it.
**Verified live the same session: NOT YET → sign out → sign in, and the offer is back.**
**The standing rule earned this morning has now been broken twice in one day: ANY state
holding a per-teacher answer must be keyed to the teacher.** Worth grepping page.jsx for
the remaining candidates before the next persona run.

**★ FOUND LIVE — the tour came back every cutover, and every time a card was cleared.**
Founder: *"It should come only once at end of trial or for a direct subscriber at the end
of first generation. If he skips it deliberately it's gone. We cannot keep invoking it
again and again."* The gate was DERIVED — at most one bound section and no progress
anywhere — with an explicit note in the code that a stored flag was avoided on purpose
("no localStorage desync trap"). **But that derivation describes a teacher who LOOKS new,
and a veteran looks new every June**: the academic-year cutover clears her bindings by
design, so the 20-step tour was offered to her again each year, and again whenever she
cleared a card. A heuristic cannot express "once, ever" — only a fact can.
Now `Account.tour_offered_at` (write-once, `POST /account/tour-offered`), spent the moment
the offer is RENDERED rather than when she takes it, because ignoring it is as deliberate
an answer as skipping it. On the account rather than in localStorage so "once" survives
sign-out and a second device. The local flag is deliberately not set on write — that
would pull the nudge out from under the teacher who is looking at it — and the
session ref that guards against a mid-session re-read is cleared on identity change,
per the rule above. Old accounts have no field, which correctly reads as "never
offered", so everyone still gets their one showing.

**★ ALSO CORRECTED: the cutover design in the docs is STALE.** `PART H` of the persona
run (and the step-7 checklist built from it) describes "Start the 2027-28 school year?"
as an offer that opens the year. The code now **rolls the year automatically** on the
cutover date (`_auto_roll_year`, carrying tracking across so she can finish a chapter
mid-June), and what she is offered is the SECOND half — clearing the carried-over
tracking, button *"Start my classes fresh →"*, `cleanup_pending` / `cleanup_due`.
`cutover_due` survives only as an alias for older clients. Anyone testing from PART H
will look for a prompt that no longer exists; the checklist needs rewriting against the
route, not the write-up.

**STILL OWED A LIVE PASS:** the trial purge (needs a fresh trial persona with chapters in
two subjects, buying only one) · the confirmation email actually SENDING over SMTP (every
attempt so far landed in the file outbox) · the front-door guards (mobile already in use,
email already in use at the field, duplicate cart rows) · trial Settings hiding Personal
profile and Your data & export · the academic-year cutover at a simulated June · the
20-step tour · and every one of these at 360×800 and on a real iPhone.

**Two terminal traps that cost most of the session, both now defended:**
- `lsof -ti:8000 | xargs kill` kills EVERY process holding a socket on 8000 — including
  the Next dev server, which talks to the API. It took down localhost:3000 twice and
  looked like a broken build. Use `kill $(lsof -nP -iTCP:8000 -sTCP:LISTEN -t)`.
- A missing SMTP variable and a malformed `ARUVI_TODAY` were both SILENT: mail went to
  the file outbox and the real date was used, while every screen looked plausible. Both
  now print a line at startup (`[aruvi] mail: …`, `[aruvi] date: …`). **A testing seam
  that fails quietly is worse than one that fails loudly** — it turns a two-minute
  configuration error into an hour of debugging the product.

---

## 2026-08-26 (evening) — INVOICING: A NUMBERED DOCUMENT PER PURCHASE,
## STORED, MAILED AND SHOWN BESIDE THE SUBSCRIPTION IT PAID FOR

Founder brief, with a Stripe/Anthropic receipt mail as the reference: *"create a
professional mail output as shown here. Create an invoice format similar that gets loaded
onto the account folder for the tenant/user and gets sent along as pdf. This also gets
uploaded onto the client subscription page with each respective subscription. The mail
sends the latest invoice along."*

**Two decisions taken first, because they are legal, not aesthetic.**
- **No tax, no GSTIN.** Aruvi is not GST-registered, so the document says *"No tax charged
  — Aruvi is not registered for GST."* **in words** rather than printing a ₹0.00 tax row,
  which reads like a rate that happens to be zero rather than a seller who does not charge
  it. `ARUVI_GSTIN` / `ARUVI_TAX_RATE` / `ARUVI_TAX_INCLUSIVE` exist and are honoured, so
  registering is a config change and one template branch — not a schema migration.
  TAX_INCLUSIVE is explicit because the answer changes what she PAYS.
- **One gapless per-financial-year series**, `ARV/2026-27/0001`, April→March — the same
  anchor the academic year already uses, so her invoice series and her school year turn
  over together. Assigned once at issue and **never reused even if the purchase is later
  revoked**: a numbered series with holes in it is worse than useless.

**Three design points that will matter later:**
1. **The counter lives OUTSIDE any tenant folder** (`invoices/_series/{fy}.json`). Erasure
   walks a teacher's tree; a series stored inside one would take the seller's books with
   it and the next invoice would reuse a number already issued to someone else. A test
   erases a tenant and asserts the numbers never rewind. (`_series` is unreachable as a
   tenant slug — `_slug` strips the leading underscore.)
2. **The PDF is STORED, not re-rendered on download.** A document she may show an
   accountant must not change because a template did; re-rendering would quietly reissue
   history every time the house style moves. A test asserts the download equals the stored
   bytes.
3. **An invoice can never cost her the subscription.** The whole build-render-store block
   is wrapped; a render failure keeps the record if it can, drops the invoice if it
   cannot, and the activation stands. Tested by making `_build_invoice` raise.

**The mail** now carries the PDF as an attachment (new `Attachment` on `EmailMessage`;
`SmtpNotifier` moved to the stdlib `EmailMessage` so it degrades to plain text/plain when
there is nothing to attach; `FileNotifier` writes attachments BESIDE the message, because
an outbox the founder cannot open is not a preview). **The invoice number is in the BODY
as well** — an attachment can be stripped, blocked or lost, and the number is how she
refers to the purchase in any question she ever asks about it.

**On screen**, the invoice sits in the card of the subscription it paid for — not in a
separate billing list to go hunting in. "What did I pay for this?" is asked while looking
at the thing. The number shows even when the PDF is missing: the number is the record, the
file is a convenience.

**One consequence worth stating:** the erasure receipt has always promised that tax records
outlive the account (§2.6), and invoices are exactly that — so deletion does NOT destroy
them, and `invoices/` is deliberately absent from the erase walk. But she loses the ACCOUNT
that reaches them, so the last delete window now tells her to save any she needs first.

**Two founder edits on first sight of the document, both with reasons worth keeping:**
- **The big "AMOUNT PAID" band belongs on the INVOICE and not in the EMAIL.** *"Remove
  the amount paid row where it is shaded and big font"* was read as being about the
  document on screen — the invoice — and applied there; the correction came back as *"in
  the email body alone (not the invoice)"*, and the band was restored on the PDF and
  struck from the mail. **The two documents want opposite things**, which is the part
  worth keeping: the mail's job is to say WHAT is now hers and for how long, so the
  amount is one line of its ledger; the invoice IS the document about the money, so the
  amount is its headline. ★ Lesson for the next ambiguous instruction of this kind: when
  one sentence could apply to two artifacts on screen at once, ASK which — a wrong guess
  costs a round trip either way, and a guess that reads as "he'll tell me" is the more
  expensive of the two.
- **No "(Class 10 coming soon)" on an invoice, and classes are derived PER SUBJECT.**
  His reasoning is the valuable part: *"tomorrow, one subject may be in and another out
  in Class 10."* A promise about next year has no place on a document of record, and a
  stage-wide constant would be wrong for BOTH subjects the day Class 10 lands for one of
  them — too small for the one that has it, a promise for the one that does not. So
  `_scope_classes` intersects the stage's grades with the grades the subject is actually
  AUTHORED for: science·secondary reads "Class 9" today and becomes "Classes 9 and 10"
  by itself when its class-10 chapters exist. No constant to remember to edit, and no
  invoice that was ever untrue. The test asserts the derivation, not the values.

**HTML mail (same session).** The confirmation is now multipart/alternative — a designed
HTML part beside the plain text, with the text as a true equal: every fact appears in
both, asserted by a test, so a client that refuses HTML loses styling and nothing else.
Built for MAIL CLIENTS, which is an older craft than web layout: tables (Outlook has no
flexbox), every style INLINE (Gmail strips `<style>` blocks), no web fonts (Georgia +
Helvetica exist everywhere and are the house pairing anyway), 600px. FileNotifier writes
the `.html` beside the `.txt` so the outbox can actually preview what she will see. The
founder's BCC stays plain text on purpose: a sales log is read as a list.

**Files.** `aruvi_core/ports.py` (`Attachment`, `Invoice`, `InvoiceLine`,
`InvoiceRepository`), `adapters/invoice_repository_file.py` (new),
`export_invoice_pdf.py` (new — house style, Indian digit grouping), both notifiers,
`api/config.py` (tax seam), `api/main.py` (`_financial_year`, `_build_invoice`, checkout
wiring, `GET /invoices`, `GET /invoices/{number:path}`), `api/mail_templates.py`,
`web/app/components/Settings.jsx`, `globals.css`, `tests/test_invoice.py` (7 cases).
**Verified:** two purchases → 0001 and 0002, listed newest first, download byte-identical
to storage, another tenant 404s, mail carries both PDF and number, render failure leaves
the subscription intact. 12 suites green including py39-compat. **Live pass owed.**

---

## 2026-08-26 (evening) — THE TRIAL PURGE, ONE BOX PER SUBSCRIPTION,
## AND A PROMISE WITHDRAWN THE SAME DAY IT WAS BUILT

**★ The reversal worth remembering.** This morning (PART B1 of the persona run) an
out-of-scope subject she had prepared plans in was deliberately KEPT after she
subscribed, so the paywall's *"Your 3 chapters stay yours"* would not be broken. By
evening the founder had seen it live and struck it: *"the {x,y} stands there in My
Lessons with no use, clogging the space for a trial reason that is no longer valid."*

Both readings were right about different things, and that is the lesson. The morning
argued from the PROMISE; the evening argued from the SCREEN. A subject she trialled and
did not buy cannot be prepared in, tracked, or given sections — **every card of it is a
door that no longer opens**, and a shelf of dead doors is not a kindness. When a promise
and a screen disagree, the screen is the thing she experiences; **change the promise.**
So the 402 no longer says the chapters stay hers.

**★ And an hour later it stopped saying anything about survival at all.** The repair —
*"the chapters you made in a subject you subscribe to come with you"* — was true, and
still wrong: founder, *"if a teacher pays for a new subject and ditches trial chapters,
she does not care."* Three chapters are a DEMONSTRATION, not a body of work, and a
conditional rule about what survives is a poor thing to hand someone in the second she is
deciding whether to pay. The paywall now states the fact and the action and stops: *"Your
free trial covers 3 chapters, and you have used them. Subscribe to keep preparing."*
**Worth keeping as a pattern: when a promise turns out to be false, the first instinct is
to make it accurate — the better question is whether it needed saying at all.**

**The purge** (`_purge_trial_artifacts`, called from checkout when the prior entitlement
was a trial). Three boundaries, each load-bearing:
- **First purchase only.** A later addition purges nothing — there is nothing left by
  then, and a teacher adding her fourth subject must never fear for her third.
- **Only subjects outside the purchase.** A subject she trialled and BOUGHT keeps every
  chapter, pointer and note. That is what a trial is for, and it is the half the paywall
  still promises.
- **Never the plan FILES.** Saved plans are shared library content in DATA_DIR; the same
  file may be served to another teacher a minute later. What is hers — and what goes —
  are the records in STATE_DIR that put those plans on her screen: prepared-plan marks
  (new `unmark` on the repo + port), section state, chapter notes.

**Told before the money, not after.** The Pay screen names the subjects that will be
cleared (`droppedTrial`, derived from `trial_chapters`, which `GET /entitlement` already
returns — nothing new is fetched). It sits on the one screen where she can still change
the cart. Named, because "some trial lessons" would send her hunting for which.

**One box per subscription, latest first.** They had been rows inside a single card under
one shared "Validity" — which, once each scope carried its own date, could only ever be
true of one of them. Each subject-stage is its own purchase with its own year, so each
gets its own card. **Order is by expiry descending, and that is only correct because
every term is exactly one year** — latest expiry IS latest purchase, and a renewal
correctly returns to the top. If terms ever differ, this needs a real purchase date to
sort on; the comment in Settings.jsx says so. Ties (bought in one checkout) keep cart
order. An expired one is still listed, in clay, as "ended" — she owned it, and that row
is the explanation for anything she can no longer prepare there.

**Also fixed: the Add button that never appeared.** `active` required `ent.enforced`, so
with `ARUVI_ENTITLEMENT_ENFORCED` unset — the DEFAULT, and easy to lose on an API restart
— a teacher who had really paid saw "Your plan details will appear here" and no button.
**Enforcement decides what is REFUSED, never what is TRUE.**

**Files.** `api/main.py` (purge, reworded 402, B1 block removed), `aruvi_core/ports.py` +
`prepared_plans_repository_file.py` (`unmark`), `web/app/components/Settings.jsx`,
`SubscribeFlow.jsx`, `globals.css`, `tests/test_entitlement.py` (10 cases now),
`docs/persona_test_checklist.md`.
**Verified:** the purge test asserts both halves (un-bought subject's plans/sections/notes
gone, bought subject's untouched, a later addition purging nothing); 10 suites green. Web
half babel-parse clean, CSS balanced — **live pass owed**.

---

## 2026-08-26 — SUBSCRIPTIONS ADD INSTEAD OF OVERWRITING, AND EACH
## SUBJECT·STAGE CARRIES ITS OWN EXPIRY

**The bug, reported live by the founder:** *"English was there in trial. I first
purchased science middle and science secondary. Then I added English middle through My
Lessons. The English addition overwrote the previous subscriptions."* Exactly what a
TestClient run against a copy of live state had shown an hour earlier:

```
buy SS/middle        → ['social_sciences/middle']
then buy English/mid → ['english/middle']       ← the first purchase is GONE
```

`ManualBillingProvider.create_subscription` wrote a WHOLE NEW `Entitlement` from the
cart, and checkout passed the cart alone. **She paid ₹500 and lost two subjects.** The
same call also passed the cart to `_apply_subscription_profile`, so her teaching profile
lost them too — the same bug twice, in two layers.

**The founder's feature request came with the fix's shape:** *"for subscribed accounts
too, 'add subjects and stages' should be there. it will have separate expiry of its own
based on date of subscription."* A subject added in November runs to the following
November, so **one date for the whole entitlement cannot describe her**.

**Model.** `Entitlement.scope_valid_until: Dict[scope, ISO date]` is now the authority;
`valid_until` survives as the LATEST of them — derived, for display and for readers that
predate the field. **A scope with no entry falls back to `valid_until`, so there is no
migration script: the fallback IS the migration**, and the next grant stamps real dates.
A test pins that legacy path so it cannot be optimised away.

**Two decisions the founder took** (both change what the code had to be):
- **Lapsed means NOTHING is live.** One live subject keeps the tracker, the profile and
  notes open — she is still a paying customer, and those tools are not per-subject.
  Generation is refused per scope; that gate is the one that knows which subject she
  asked for. Revocation still lapses everything at once (it is a withdrawal, not a date).
- **A live scope is not offered again.** Renewal is for something that has ENDED; selling
  her a year she already owns is not a renewal. The chooser omits it ("· you have this"),
  and checkout 409s with the date it runs to. So a re-stamp only ever happens after
  expiry, which is why the arithmetic stays "a year from today" and never has to stack.

**Where it landed.** `ports.Entitlement` + file adapter (per-scope map, tolerant load) ·
`ManualBillingProvider.create_subscription` **additive by default**, `replace=True` for
the CLI's deliberate wipe · `api/main.py` helpers `_scope_until` / `_scope_live` /
`_live_scopes` / `_entitlement_lapsed`, both gates rebuilt on them, checkout's
prior-holding guard, `_apply_subscription_profile` given the FULL held list ·
`GET /entitlement` gains `scope_valid_until` + **`live_scopes`** so the client never
compares a date (the A3 rule: one rule, one place — and only the server honours
`ARUVI_TODAY`) · Settings shows validity INSIDE each subscription block, an expired one
still listed in clay with "ended" · **"Add subjects & stages"** button for an active
teacher, opening the same wizard at the cart · `paidScopes` is now the LIVE scopes.

**One bug the tests caught in the fix itself:** the first cut skipped `"*"` when stamping
per-scope dates, so an enterprise `"*"` granted on top of an old expired scope inherited
THAT scope's past date through the derived top-level field — **a grant that was dead the
moment it was written**. `"*"` is now dated like any other scope.

**Mail (founder, same session): every purchase reports the whole holding.** Additive
subscriptions with independent dates mean a mail about the one subject she just bought
would leave no statement anywhere of what she owns or when each part ends. It now says
what she just added (with the amount she paid), then *"Everything you have with Aruvi
now"* with each scope's own date. On a first purchase the second block is omitted rather
than printing the list twice.

**Verified** against a copy of live state: add keeps prior scopes · per-scope dates
correct · one expired scope → live list shrinks, `lapsed` false, its own generation 402s
naming *"English · Middle ended on 01-Jan-2025"* while science still serves 200 · all
expired → `lapsed` true and readiness writes 402 · re-buying a live scope 409s · mail
renders both shapes. `test_entitlement.py` 9/9 with two new cases; account, api,
year-scope, cutover, migration, plan-notes, academic-year, notifier all green. Web half
babel-parse clean, CSS balanced — **live pass owed**.

**Founder's own account still needs repair:** `1000000000` holds only `english/middle`.
`python3 aruvi-scripts/entitlement.py grant 1000000000 --scopes science/middle,science/secondary`
now ADDS (it would have wiped English before this change).

---

## 2026-08-26 — "ALREADY IN USE" IS SAID OUT LOUD, AT THE FIELD, NOT AT
## THE TILL — AND A SUBJECT·STAGE MAY BE BOUGHT ONCE

**How it surfaced.** Testing `1000000000`: choose subject & stage → Pay → *"Couldn't
complete the activation. Try again in a moment."* Reproduced against a copy of live
state (`ARUVI_STATE_DIR=/tmp/st`, TestClient): checkout **409s on a taken email and
200s on any free one**. The on-disk evidence agreed exactly — her account record still
had empty name/role/state and her entitlement was still `trial`, and
`_guard_email_not_taken` sits precisely between the in-memory field assignment and
`account_repo.save`, so a 409 there leaves both stores untouched.

**★ The defect was not the refusal — it was that the refusal could not be heard.** The
server had sent a sentence written for her (*"already used by another Aruvi account…"*)
and `SubscribeFlow.doCheckout` threw the response body away and printed *"Try again in a
moment"* — **advice that can never work for a deterministic 409**. `PersonalProfile.save`
swallowed it the same way. So the entire teacher-facing half of this morning's A5 fix
had never been visible on any screen: the persona run verified that 409 **by curl**, and
curl is not a user. A correct server behaviour looked like a broken product for an hour.

**Three places, one rule.**
1. **The 409 is now shown.** New `errDetail(response, fallback)` in format.js — the
   raw-fetch twin of `postJSON`'s `err.detail`. Note what this means: **the fix already
   existed in the codebase** (ARV-D-088, 2026-08-10, same lesson, same words) and these
   two callers had simply hand-rolled `fetch` and bypassed it. `postJSON` could not be
   used here because checkout runs BEFORE sign-in and sets `X-Aruvi-User` by hand.
2. **She is told at the FIELD, not at the till.** New `idInUse(value, selfId)` asks
   `/onboarding/known` (which answers for mobile AND email, and creates nothing) at the
   moment she confirms an email — checkout and Personal profile both. Arriving at the
   end of a checkout was what made the 409 useless: she had chosen subjects and pressed
   Pay before anything told her. A shared address (`ambiguous_email`) counts as in use —
   more so, not less. A network failure returns false: this check exists to tell her
   early, never to be the thing that decides. The server stays the authority.
3. **A registered MOBILE cannot create a second sign-in.** That screen's button says
   "Create sign in" and the mobile IS the account id, so a number already in the tenant
   database is not a new teacher — it is her, at the wrong door. Checked before the OTP
   is sent. **Copy settled the same day:** *"This mobile number is already in use. Create
   using a different number."* — and nothing else. The first cut added a "Sign in →" link
   carrying her number across; the founder struck it. **A screen that creates a sign-in
   keeps its refusal inside that job**: the instruction at the create door is to create,
   and the sign-in door is already reachable from the choose screen behind her.

**And the cart may not hold the same pair twice** (founder, same session). The billing
unit is subject × stage; `cartScopes` de-dupes, so two identical rows meant **two rows
shown and one charged** — a discrepancy that reads as a bug whichever way she notices
it. Not validated after the fact: **the choice is not offered**. A pair taken by another
row is `disabled` and says *"· already added"*; a subject whose every stage is spoken for
is disabled whole; "+ Add another" dies when nothing is left. A row never disables its
OWN value, or changing your mind would strand the select on a dead option.

**Copy lives in two places by necessity** — `EMAIL_TAKEN`/`MOBILE_TAKEN` in
SubscribeFlow.jsx and `_guard_email_not_taken` in api/main.py — because the early check
has no sentence of its own to return. Both say "already in use"; reword one, reword both.

**Files.** `api/main.py` (wording), `web/app/lib/format.js` (`idInUse`, `errDetail`),
`web/app/components/SubscribeFlow.jsx`, `Login.jsx`, `Settings.jsx`, `globals.css`.
**Verified** server-side against a copy of live state: taken email → 409 with the new
wording on both routes · her OWN address → 200 · `/onboarding/known` answers correctly
for mobile, unique email and shared email. Duplicate-guard logic unit-checked. Web half
babel-parse clean, CSS balanced 2139/2139 — **live pass owed** (a parse check is not a
render check).

**Field note, worth keeping:** while diagnosing this, `1234567899`'s account.json
vanished mid-session — the founder had erased it on the suggestion above. The erase
left the directory in place because a Mac `.DS_Store` sits in it, so the "empty ancestor
folders are removed" behaviour is silently defeated on macOS. Harmless (`find_all_by_email`
globs `*/*/account.json`), but it means an erased id looks half-present on disk.

---

## 2026-08-26 — TRIAL SETTINGS ARE NARROWER: NO PERSONAL PROFILE,
## NO "YOUR DATA & EXPORT"

Founder decision taken straight after the persona run above: **while the free trial runs,
Settings offers neither "Personal profile" nor "Your data & export".** The trial is a look
at the TEACHING product; the account around it — her details, her export — belongs to a
teacher who has one. Both cards return whole the moment she subscribes.

**Two boundaries deliberately not crossed, and both matter more than the change itself:**

1. **This is UI, not a gate.** `POST /account` and `/data-rights/*` stay open. Gating
   them would have been the tidy-looking move (A3's "one rule, one place"), and it is
   wrong here for two independent reasons: **checkout itself writes the account record**,
   so a trial-time `/account` refusal would break the path OUT of the trial; and §2.5's
   "data rights are never gated on subscription state, ever" is a promise about the
   ROUTES. What Settings chooses to SHOW is a product decision; what the server refuses is
   a rights decision. A3's lesson is that a rule must not be *derived* in two places — not
   that every UI hide needs a 402 behind it.
2. **Delete my account keeps its download.** G3's last window ("Have you downloaded your
   Aruvi data?") still offers "Download my data first" on trial, and it is now the ONLY
   export door a trial teacher has. Deletion is irreversible and the export is the only
   copy she can keep — hiding the card must never mean destroying her work with no copy.

**Where the flag lives, and why not in Settings.** `entTrial` is held in `page.jsx`'s
entitlement sync (beside `entLapsed`, same TDZ-safe position) and passed down as `trial`.
Settings keeps its own `ent` fetch as the fallback, so a state change landing while
Settings is open is still caught — but the shell has already synced by the time the gear
is pressed, so the cards are never drawn and then withdrawn. **Two cards appearing for a
beat and then vanishing is worse than either state**; the same reasoning as A3's derive-once
rule, applied to timing rather than logic. The subscription subview no longer re-derives
`onTrial` either — one flag, one place.

Also guarded: `view === "personal"` / `view === "data"` render only when not on trial, and
an effect snaps `view` home if the trial answer lands while she is standing in one of them.

**Files.** `web/app/page.jsx`, `web/app/components/Settings.jsx`.
**STATIC ONLY** — babel-parse clean on both, no surviving entry point to either subview
(the Settings home cards are the only doors; the header person icon was retired 2026-08-24).
**A parse check is not a render check** (H4.4): a live pass on a trial identity is OWED —
confirm the two cards are absent, the remaining five keep their order, and the delete
flow's download still works.

---

## 2026-08-26 — THE DRIVEN PERSONA RUN: FOUR BUGS THE STATIC PASS COULD NOT
## SEE, PLUS THE Notifier PORT (SUBSCRIPTION CONFIRMATION MAIL)

The first time the persona checklist was actually DRIVEN (Claude in Chrome against the
live pair, enforcement on, throwaway mobiles 1234567890-98, erase between personas).
Everything below was found by walking the product, not by reading it — and every one of
the four had passed babel-parse, the unit suites and a human's own phone testing.

**★ The lesson worth keeping: three of the four were RACES OR STALE STATE, the exact
class of defect static verification cannot reach, and two of them were invisible on the
happy path a developer walks.** §11's "verified statically only" caveat is not a
formality; drive the flows.

1. **First run bounced back to the welcome screen after the first successful
   generation.** `firstGenNeeded` asks the server "has she ever generated?"; completing
   first run flips `ready`, re-running the effect while `prepareAndHandOff`'s serve is
   STILL IN FLIGHT, so the server truthfully said "nothing prepared" and the heuristic
   re-armed first run. Her plan was fine on disk; only a reload escaped. Fix: a one-shot
   `everGeneratedRef` latch.
2. **…and the latch then leaked ACROSS TEACHERS.** Sign-out does not remount page.jsx,
   so the previous teacher's latch suppressed the next one's first run — which is
   exactly the founder's earlier "direct subscriber went straight to My Lessons", blamed
   at the time on a stale environment. It was real. Fix: `latchUserRef` — the latch
   belongs to one user and clears on identity change. **Corollary: any ref that caches a
   per-teacher answer must be keyed to the teacher, because sign-out is not a remount.**
3. **A subscription that ran out BY DATE kept its productivity tools.**
   `_check_entitlement` tested `valid_until`; `_check_productivity` and the whole web
   half tested only `status == "expired"`. So a revoked teacher was locked out correctly
   while a date-lapsed one — **which is how every real lapse will happen once payments
   are live; manual revocation is the founder-only rarity** — kept her My Classes tab,
   "+", edit pen and tracker, and read "SUBSCRIBED" in Settings, while generation was
   already 402ing her. Fix: `GET /entitlement` now DERIVES `lapsed` (revoked OR date
   passed) and page.jsx + Settings consume it; `active` explicitly excludes lapsed. One
   rule, one place — the duplication was the bug.
4. **Renaming yourself did not change the name on screen.** The account is fetched on
   `[user, entSyncTick]` and a profile save bumped neither. Settings now bumps the tick.
5. **A shared email signed you into the WRONG account.** `find_by_email` did a linear scan
   and returned the FIRST match, so two accounts carrying one address meant an arbitrary
   winner. **Email became a CREDENTIAL the moment sign-in started accepting it, and a
   credential that points at two accounts points at neither** — the likely field case is
   not two teachers sharing an address but ONE teacher registering a second mobile with
   the same email and silently splitting herself in two. Fixed at both ends: prevention
   (`_guard_email_not_taken` 409s an address held by a different account, on checkout AND
   Personal-profile save; re-saving your own is fine) and a safety net (`find_by_email`
   returns None on ambiguity — never a guess — and sign-in says "More than one Aruvi
   account uses this email. Please sign in with your mobile number", the mobile being
   always unambiguous). New `find_all_by_email` on the adapter + port. **The partner's DB
   adapter should add a UNIQUE constraint on email when Supabase lands** — the file store
   cannot enforce it.

Founder decisions taken the same session (all three built):
- **Trial plans stay reachable.** The paywall promises "Your 3 chapters stay yours", but
  `_apply_subscription_profile` dropped the out-of-scope subject, leaving the plans on
  disk with no chooser entry able to reach them. Now an out-of-scope subject she has
  PREPARED PLANS in survives untouched; one with no plans is still a trial artifact and
  still goes. Not a licence to prepare more there — the generation gate still answers
  "covers a different subject" (verified live: english 402, social_sciences 200).
- **No tour offer when lapsed** (it teaches attaching/tracking/preparing — all removed).
- **First run greets her by first name** (she types it at checkout, then met her raw
  mobile on the very next screen).
- **Notes LOCK when lapsed** (checklist test 49, ruled the same day). They had been left
  writable on the argument that a note is her own writing; the founder placed them in
  Aruvi's working half instead, alongside the tracker and the profile. `_check_productivity`
  now guards POST /plan-notes; GET stays ungated, so every note she wrote is still
  readable and still exports. The modal opens READ-ONLY with "Renew to write notes —
  what you wrote stays yours." `ChapterOrg` asks `fetchEntitlement()` for `lapsed`
  itself rather than threading a prop from two different calling surfaces.

**NEW: the `Notifier` port + subscription confirmation mail** (founder: send from
kumar.radhakrishnan2@gmail.com). `EmailMessage`/`Notifier` in ports.py; `FileNotifier`
writes to `STATE_DIR/outbox/` (the notification twin of ManualBillingProvider — the whole
flow runs with NO vendor and no credential in the repo), `SmtpNotifier` sends for real
when ARUVI_SMTP_HOST/USER/PASSWORD are all set (Gmail needs an APP password); main.py
picks one at startup. Copy lives in `api/mail_templates.py`, never in routing or the
adapter. `_send_subscription_confirmation` NEVER raises — **a mail server having a bad
minute must not turn a successful subscription into an error** — and checkout returns
`email_status` so the UI can be honest. MAIL_BCC_FOUNDER (default on) copies every sale
to the founder: his sales log until invoicing exists. tests/test_notifier.py (7) green.
Standing note: personal Gmail is a stop-gap — daily caps and deliverability mean a
transactional provider (SES/Postmark/Resend) belongs behind this same port before scale.

**Late-session additions (the founder's four items).** (a) **Chapter notes carry a
child-privacy rule** — "Private data like name, age of child must not be recorded. Aruvi
reserves right to delete if entered." — clay, hairline above, stated WHERE SHE TYPES
because notes are free text written right after class. (b) **Deletion now takes two
windows**: type "erase" (intent) → a modal asking whether she has downloaded her data
(possession). Server refuses `{"confirm":"erase"}` alone. **The confirmation is written
BEFORE anything is destroyed, into `STATE_DIR/erasure_log/{tenant}.json` — the ONE store
outside the erase walk, so it survives the erasure it records.** Identifiers and
timestamps only; a test asserts no name/email/note text can leak in, since that would
reintroduce what she asked to have destroyed. (c) **Bulk/school purchase DEFERRED** with
tenant == user standing — full reasoning in `subscription_model_discussion.md` §0-bis; the
short version is that the bulk flow **has no natural home on a phone** and every attempted
fix invented a mechanism whose real home is a website. (d) **Cutover remains unbuilt** and
is blocked on one product decision (offered vs automatic in June), not on code.

**★ ACADEMIC-YEAR CUTOVER BUILT (Step 2) and walked through a simulated 1 June 2027.**
Founder: offered, never automatic. **The design that made it small: cutover MOVES NOTHING
AND DELETES NOTHING** — Step 1 had year-scoped every teaching store by path while leaving
readiness un-scoped, so opening the next year and pointing her at it yields all four
promises for free (new year's folders empty → clean cards + cleared pointers; old folders
untouched → last year readable; notes stay in the closed year; profile carries). New:
`CutoverResult`/`YearCutover` in ports, `year_cutover_file.py`, `GET /academic-year` +
`POST /academic-year/cutover` (idempotent), the ochre offer on My Classes (with TWO real defer controls — an ✕ top-right and a
"Not yet" beside Start; the first build's "Not now" was a plain `<span>` that looked like
a choice and did nothing, caught by the founder on sight — and **dismissal is session-only,
never persisted**, since a stored "don't ask again" would strand her in last year), the collapsed
prior-year folder in My Lessons (founder polish the same day: **the SAME `.sc-card`
markup the current year uses — not a row list** — status line "Taught in {year}"; the same
"lessons you prepared last year" sentence as the picker; **always closed by default**,
never persisted and re-closed on any subject/class change; and **anything already brought
back into this year is excluded**, after his screenshot caught one chapter showing twice
on one screen) AND in the "+" attach picker (the founder caught the
omission same-day; his spec had always said she should see the old folder when ADDING a
plan — attaching a prior-year lesson marks it prepared in the CURRENT year first, because
teaching it again makes it this year's work and the tracker cannot show a plan the year
does not hold), `tests/test_cutover.py` (5). `ARUVI_CUTOVER_MONTH_DAY`
(default 06-01) is config; **`ARUVI_TODAY` is a TESTING-ONLY seam routed through ONE
`_today()` so a simulated date makes the whole service agree what day it is** — remove it
before ordinary testing. **Four bugs the live June walk caught, none visible to
babel-parse or unit tests:** (1) the second tap returned "the 2028-29 year opens on…"
instead of already_done — now distinguished by whether a prior year exists; (2) section
cards still read "Teaching now Ch 5" because `pullSectionState` deliberately deletes
nothing on a wholesale-empty response (its anti-corruption guard) — **cutover is the one
moment when empty genuinely means empty**, fixed with an explicit `clearLocalSectionCache()`
rather than by weakening the guard; (3) **a ten-year veteran was thrown into the guided
FIRST RUN**, because `firstGenNeeded` reads year-scoped stores and the morning after
cutover they truthfully say "nothing prepared, nothing bound" — it now also reads her year
history, since **a prior year is proof she has been here before**; (4) a **TDZ
ReferenceError white-screened the entire app** (`entLapsed` used in `tourOnOffer` above its
own `useState`) — **a parse check is not a render check; load the page.** Latent hazard
noted, not fixed: prepared-plan keys are CASE-SENSITIVE (`…/IX/…` ≠ `…/ix/…`); the app
always writes lowercase, but `_plan_key` should normalise.

**★ PYTHON 3.9 IS THE FOUNDER'S RUNTIME.** `Dict[str,int] | None` in a new adapter shipped
green (sandbox = 3.10) and refused to boot on his Mac — PEP 604 unions are evaluated at
def time on 3.9. `tests/test_py39_compat.py` now guards both the union rule (unless the
module defers annotations) and the 3.9 grammar, and was verified to catch the exact line
that broke. New runtime modules should carry `from __future__ import annotations`.

Verified passing in the same run: front door Z1–Z13 (choose page, four-box OTP with real
auto-advance, registered-only sign-in now MOBILE-OR-EMAIL with free-form ids refused,
double-blind email end to end, cart-of-dropdown-rows, honest Pay, default profile per
scope, scope-filtered first run, first-name display, ledger); trial mechanics 14–22
(re-serve free, 4th chapter → popup with no ghost card, paywall Subscribe opens the
in-app wizard); lapsed 30–34; renewal 35; settings 36–39; enterprise 46; multi-scope 47;
date-expiry 48; tour = 20 steps, step 12 = `phase-bookmark` place "above", hands absent
from 4/5/6/12/16/18 (verified against the steps array). OPEN: notes stay writable while
lapsed (49) — confirmed as current behaviour, founder to rule.

**Tooling note for the next driven run:** the Chrome side panel pins the tab viewport at
~222px wide and `resize_window` cannot move it, so LAYOUT verdicts (test 51, the visual
half of 1/6) still need a human at a real phone width. Everything functional is
reachable; drive the wheels by scrolling `.fr-wheel` by one row height rather than
clicking the ▲▼ buttons, whose handlers do not always take from a synthetic click.

---

## 2026-08-25/26 — STEP 6 LIVE-ITERATED ON THE FOUNDER'S PHONE: FRONT DOOR,
## SETTINGS SUITE, PERSONAL PROFILE, TOUR 20-STEP, SIGN-IN MOBILE/EMAIL-ONLY

Two marathon live sessions after Step 5. Everything below is BUILT and static-verified;
the founder is about to run the full persona pass (docs/persona_test_checklist.md, rewritten
2026-08-26 — 52 numbered tests, now including a "Notes for an automated (Claude in Chrome)
run" preamble: servers must already be running with `ARUVI_ENTITLEMENT_ENFORCED=1` on the
SAME command line + `--host 0.0.0.0`; the browser agent can't run the entitlement CLI, so
grants/revokes are founder steps — erase alone is reachable as an HTTP POST).

- **Front door** (`Login.jsx`): first-time device → CHOOSE (compact one-paragraph pine-tick
  benefits, "…in seconds", Free-to-try default-highlighted, honest Subscribe bullets only)
  → OTP (mobile IS the id; four auto-advancing boxes, stub 0000 disclosed;
  `/onboarding/verified` registers) → trial straight in, or `SubscribeFlow.jsx` (shared
  wizard, also opened in-app by the paywall's Subscribe: About you → Subjects-as-CART of
  Subject▾/Stage▾ dropdown ROWS (+add row, ✕, no per-row price, total at bottom, secondary
  = "Class 9 (Class 10 coming soon)") → honest Pay stub). Sticky footers for iPhone CTAs.
- **Sign-in is registered-only AND mobile/email-only (2026-08-26).** `/onboarding/known`
  never JIT-creates; an "@" id resolves via `account_repo.find_by_email` and returns the
  CANONICAL id (the mobile) which the session runs under; plain ids echo `id` back. Client
  gates Enter on 10-digit-or-email shape — free-form IDs (kumar1) can no longer pass the
  screen (dev testing of them = curl/X-Aruvi-User).
- **Checkout writes the default teaching profile per scope** (lowest class of stage,
  section "{n}A", standard duration, ppw 6, calibrated budget; in-scope records kept,
  out-of-scope trial artifacts dropped) — fixes "bought SS+English, saw only SS". Direct
  subscribers still walk first run, scope-filtered (`frPaidScopes`).
- **Settings**: frozen "⚙ Settings ✕" bar (Ask-Aruvi idiom); cards Personal profile /
  Teaching profile / Subscription & billing (ledger + Subscribe button when trial/lapsed)
  / data / Help / Support / About. **PersonalProfile**: labels ABOVE fields (placeholder-only
  experiment reverted same day — "not clear what they represent"), fields on `--field-bg`
  (#fff light / #232d27 dark), mobile under name, email DOUBLE-BLIND only when changing it,
  Save not gated on email stage, **Save exits back to the Settings cards**. Name → first
  name only, capitalized, in hdr + greeting.
- **Tour is 20 steps**: step 12 = bookmark (anchor `phase-bookmark`, place "above" so the
  box doesn't cover it, no hand); hands removed from 4/5/6/12/16/18.
- Env lessons (recurring): stale Next bundles + old uvicorn on :8000 mimic product bugs —
  hard-reload/`lsof -ti:8000 | xargs kill` before diagnosing; entitlement changes surface
  in ≤20s or on focus.

---

## 2026-08-24 — ADMIN ARCHITECTURE STEP 5 BUILT: THE ENTITLEMENT SEAM,
## TO THE SUBSCRIPTION MODEL OF docs/subscription_model_discussion.md §0

The subscription model was settled first (two long founder sessions, recorded in
`docs/subscription_model_discussion.md` — §0 is the current model, read it before
touching pricing/entitlement anything). Headlines: billing unit = teacher ×
SUBJECT-STAGE, unlimited serves in scope (a quota would create anxiety with no economic
basis — serving is cached selection); Individual = MOBILE APP ONLY, Enterprise = website
(the channel split IS the price fence; Expo app promoted to being THE individual
product); trial = ALL 11 subject-stages open, capped at ANY 3 CHAPTERS, unlimited
re-serves per chapter (period-fitting takes 3–4 attempts and that IS the trial), NO time
limit; trial-exhausted keeps plans + tracker on her chapters, lapsed keeps plans but
LOSES the tracker ("the unfairness is fair" — each state keeps exactly what converts
her); renewal = the living fit to her time, since teachers cannot fix chapter 9's
periods months ahead. **Admin architecture §2.5 amended in place** (lapsed is no longer
export-and-delete-only). Gating is at ADD time, not generate time: paid choosers show
ONLY her scope (no clogged dropdowns, no add-now-pay-later dissonance); the profile-
expansion moment is the ONE upsell surface, pull never push.

BUILT (all STATIC + unit-verified, enforcement OFF by default so nothing changes live):
`Entitlement` (plan_id/status/valid_until/source/scopes/trial_chapters — scopes are
"{subject}/{stage}", "*" = all; `source` ios/android/web/manual/trial is the channel
fence and why the seam precedes any gateway) + `EntitlementRepository` (TENANT-keyed,
NOT year-scoped — subscriptions roll) in ports.py; `entitlement_repository_file.py`
(`entitlements/{tenant}/entitlement.json`); `BillingProvider` expanded (cancel,
fetch_status) with `manual_billing_provider.py` — the founder IS the gateway, webhooks
raise loudly; founder CLI `aruvi-scripts/entitlement.py`
grant|revoke|status|trial-reset (trial-reset is the persona-testing aid).
`api/config.py`: `ENTITLEMENT_ENFORCED` (env ARUVI_ENTITLEMENT_ENFORCED, default OFF) +
`TRIAL_CHAPTER_CAP` (env ARUVI_TRIAL_CHAPTERS, default 3). api/main.py: `_entitlement_of`
(JIT trial on first touch), `_check_entitlement` (raises 402; messages speak in CHAPTERS
and subscriptions, never "generations"/"scope" — the §0 language rule), and
`_count_trial_chapter` called AFTER each of genon_make_plan's three success returns
(identity / cache-hit / fresh) so a typo-guard 400 or unauthored-chapter 404 never burns
a trial chapter; the check itself sits after the library 404, before serving. THE gate
is in genon_make_plan ONLY; data rights stay ungated forever. `GET /entitlement` feeds
the future Step-6 counter UI ("2 of 3 chapters used") + `enforced` flag. Tests:
test_entitlement.py (repo isolation, manual provider grant/expire/revoke, flag-off
default, 3-chapter cap + free re-serves + idempotent counting, paid scope/date/revoke +
"*", route JIT). Suite 30 files green (same 5 pre-existing content failures excluded).
NEXT: Step 6 minimal surfaces (trial counter, exhausted state, upsell screen,
subscription status, export/erase buttons), then the persona end-to-end pass with
enforcement ON (trial → exhaust → grant → lapse; one school tenant with two users) as
dress rehearsal for the 20-teacher field test.

**Same-day live find (kumar3's iPhone trial) → THE PAYWALL WINDOW, built early.** Two
things from the first real 4th-chapter block: (a) mobile testing needs uvicorn started
with `--host 0.0.0.0` (the enforcement env var restart had dropped it — subjects
wouldn't load on the phone); (b) the 402 rendered as a message INSIDE the proposed
section card via the ordinary ARV-D-087 failed-card path — wrong: **a paywall is not an
error** (founder). Built: PrepareLesson catches `e.status === 402` and calls a new
`onPaywall(msg)` (threaded through GenerateTab) instead of onPrepareError/setError;
page.jsx pulls the preparing card DOWN (never a card for a blocked prepare) and raises
`.paywall-bg/.paywall-card` — kicker "Free trial", the server's own sentence verbatim
(single source of copy; amended to "Your 3 chapters stay yours"), **Subscribe** bold
(pine button; closes the window until a purchase flow exists — no gateway yet), and a
quiet italic "Not now". CSS beside the notes modal's family. STATIC-verified only
(babel ×3 clean, css braces 1970/1970) — kumar3's next live 4th-chapter attempt is the
live pass. Trial-disclosure moments (a)(b) of the Step-6 brief (chapter-step line +
counter) remain unbuilt — deliberately waiting for Step 6 proper.
**Step 6 slice 1 — trial disclosures (a)+(b), same day.** The paywall popup's kicker is
"Free trial ends" (founder). New `format.js fetchEntitlement()` (null on failure = show
nothing, never block). Moment (a): FirstRun's chapter step, above the CTA — "Your free
trial covers any 3 chapters — unlimited plans for each" (cap dynamic). Moment (b):
PrepareLesson's chapter step under the instruction line — "N of 3 free chapters used.
Re-preparing these is always free." (fresh trial shows the coverage sentence instead of
"0 of 3"); founder chose the chapter step as the ONLY counter home — the moment she is
about to spend a chapter is when the number informs a decision; no ambient chip
anywhere. Both lines render ONLY when `enforced && status === "trial"` — gate off (dev)
= no trial chrome at all. `.trial-note` CSS (quiet italic, centered). STATIC-verified
(babel ×3, css 1971/1971); live pass = kumar3's next run.
**EMAIL DOUBLE-BLIND + PERSONAL/TEACHING PROFILE SPLIT (founder, 2026-08-25/26):**
(a) the subscribe wizard's About-you acquires EMAIL via double-blind confirmation —
typed once, then HIDDEN, retyped fresh; only a case-insensitive match confirms ("✓
Email confirmed: k•••@x" + change link); Save disabled until confirmed; checkout body +
Account.email carry it. (b) Settings' profile card split in two: **Personal profile**
on top ("Your name, email, role and school details") → NEW self-contained editor
(`PersonalProfile` in Settings.jsx; GET/POST `/account` — new routes, partial update,
mobile shown read-only as her sign-in, email edits reuse the same double-blind stages,
never subscription-gated) and **Teaching profile** below ("Subjects, classes, sections
and periods you teach") → TeachingProfile as before. ROLES/STATES now exported from
SubscribeFlow (one list). Tour hands trimmed to action steps only (3, 8, 9, 10, 13, 14
— founder removed 4, 5, 6, 12, 16, 18).
**TOUR IS 20 STEPS — the BOOKMARK step added at 12 (founder, 2026-08-25):** anchor
`data-tour="phase-bookmark"` on the `.uv-bkmk` button; box placed ABOVE it (below
covered the thing itself — live fix); hand on the bookmark; copy: "Move this bookmark
to any particular phase… Each section will have independent bookmarks." Sits between
the tracking view (11) and mark-complete (now 13) — the lesson view is already open on
the Lesson tab, the bookmark's home. RENUMBERED +1 from 12 on, everywhere: page.jsx
tourNext/tourBack shell-nav maps (15/16/17/18/19/20), MyPlans `tourDemoDone` (14||15),
lesson-open steps (11||12||13), popup steps (9||15), `plusShow` (tourStep 16);
GuidedTour header/step list; counter derives from TOTAL. Any future step insert must
walk this same list.
**DIRECT SUBSCRIBER STILL GETS FIRST RUN (founder, 2026-08-25 follow-on):** the guided
first generation is how she LEARNS to generate, so a ready profile must not skip it.
Server-derived heuristic, no stored flag: `ready && nothing-ever-prepared &&
nothing-bound` → `firstGenNeeded` → FirstRun renders (scope-filtered to her purchase,
clean welcome — both already built); fetch-failure → never force it on a veteran.
`onFirstRunComplete` now MERGES her one walked-through subject record into the
checkout-created defaults (same-name replaced, others keep their place; the merged set
is what verifyReadiness writes) — so English survives her SS walk-through. Post-trial
subscribers have prepared plans → skip first run, as they should. Brief shell flash
possible while the heuristic resolves (accepted).
**SUBSCRIPTION CREATES THE DEFAULT PROFILE (founder, 2026-08-25 — "I subscribed for SS
and English but the dropdown shows only SS"):** `/onboarding/checkout` now calls
`_apply_subscription_profile` after activation — every purchased scope lands as a
profile entry immediately: the stage's LOWEST class the content offers, section A,
standard duration, 6 ppw, CALIBRATED annual budget (master plan; ppw×30 fallback).
Rules: a subject she already has KEEPS its record (sections/numbers never reset; only
grades inside purchased stages survive; each purchased stage's default grade added if
missing; prior budgets kept for surviving grades); subjects OUTSIDE every purchased
scope are DROPPED (trial artifacts — the subscription overrides the trial profile) and
their section pointers cleared server-side; their PLANS stay and resurface if that
subject is ever bought. Safe because the tour-end "Are these your sections?" prompt is
the designed amend moment (confirmed present — finishTour, both Done and Skip).
CONSEQUENCES: (a) direct-subscribe now lands in the SHELL with ready cards (profile
exists → first run skipped; §0b's scope-filtered first run remains only for the
erased-profile path); (b) out-of-scope trial plans disappear from My Lessons' profile-
driven dropdowns until that subject is subscribed; (c) in-app subscribe onDone
rehydrates GET /readiness so the new cards appear without reload. Verified: TWAU trial
artifact + purchase of SS·middle + English·prep → profile becomes exactly SS VI (6A,
210) + English III (3A, 140). Same session:
**ONBOARDING ITERATION 2 (founder live, 2026-08-25):** (a) the CART is now DROPDOWN
ROWS — Subject ▾ + Stage ▾ per row (stage options limited to what the subject offers),
"+ Add another subject & stage", ✕ per row, the chosen stage's classes said in small
pine text ("Class 6, 7 & 8"), running total of complete de-duplicated rows.
(b) **`SubscribeFlow.jsx` EXTRACTED — one wizard, two doors:** Login's post-OTP path
AND the trial-exhausted paywall's Subscribe button, which now opens the SAME flow
full-screen in-app (`.subflow-overlay`), landing at About you (she's already verified);
onDone bumps `entSyncTick` so the trial→active flip lands immediately (scope filters,
counters, paywall). (c) OTP is FOUR AUTO-ADVANCING BOXES (backspace steps back).
(d) Numeric ids never greet by number — "Good evening!" plain until a name exists.
Earlier same day:
**SIGN-IN GATED ON REGISTRATION (founder live find, 2026-08-25):** the sign-in screen
was letting a brand-new number straight in (the dev any-ID JIT), skipping OTP. Now: OTP
verify calls `POST /onboarding/verified` (registration = the JIT, made explicit);
sign-in probes `GET /onboarding/known` — an existence check that deliberately does NOT
go through _current_identity (which would JIT-create) — and refuses unknown identities
with "We don't know this number yet — use Create sign in". Dev accounts (kumar1…)
exist, so they still sign in. The raw API keeps JIT for curl/CLI convenience.
Production: app-identified number + face/biometrics for returning users (doc §0 action
7). Also same-day iPhone fix: `.ob-foot` + all `.fr-foot`s are STICKY-BOTTOM with
dvh + safe-area, so every CTA is visible without scrolling; choose-page polish
(compact tick paragraph in pine, headline "in seconds", honest-bullets trimmed,
"switch anytime" line cut, welcome "free to try" line cut, the ONE `.fr-brand` bar
reused un-fixed).
**THE ONBOARDING FRONT DOOR BUILT (founder-designed, 2026-08-24/25 — the biggest web
slice yet).** Login.jsx is now the onboarding shell. FIRST-TIME device (localStorage
`aruvi_device_seen` unset) → CHOOSE page: benefits + two plan cards (Free-to-try
highlighted by default, NO badge; Subscribe's bullets HONEST-ONLY — "priority support"/
"export & more" struck, since trial exports too and support doesn't exist) + "Create
sign in". → OTP page: **MOBILE NUMBER IS THE IDENTITY** (one field, +91, 10 digits; the
id contract unchanged — mobile is just the id's new shape); ★ OTP STUB: code 0000
verifies, labeled honestly in-UI ("Preview build: enter 0000") — a dummy OTP protects
nothing; the real SMS vendor sits behind the AuthProvider seam later, and the
trial-farming fence is only real then. → TRIAL path: straight in (slimmed welcome →
first run). → SUBSCRIBE path with step rail Verify·About you·Subjects·Pay: About you =
name/role/state/city/school-optional (Account gained role/state/city fields —
checkout-only, never trial; DPDP-minimal); Subjects = **the picker IS the cart** —
subject·stage combos DERIVED from /subjects+grades (never hardcoded), live total at
`config.PRICE_PER_SUBJECT_STAGE` (env ARUVI_PRICE_PER_SUBJECT_STAGE, default ₹500,
served via /entitlement); Pay = ★ HONEST STUB `POST /onboarding/checkout` — no fake
gateway screen: saves demographics onto the Account, activates via ManualBillingProvider
(source "web"), UI says "online payment opens soon — this activates right away"; iOS
later swaps this one screen for Apple IAP. RETURNING device → SIGN-IN screen: benefits
block + "Who's planning today?" (sub-text removed, founder) + one field accepting
mobile-or-legacy-ID + "New to Aruvi? Get started →". **WELCOME SLIMMED to the approved
frame:** "Welcome to Aruvi!" · (trial-only) "Aruvi is free to try." + the trial CARD
(tick, "Your free trial" terms, "To get started") · clean version for subscribed
entrants; benefits list left the welcome (it lives at the front door now);
`.fr-trial-terms` CSS orphaned. Verified: checkout roundtrip (2 scopes → ₹1000, account
fields saved, entitlement active), empty-cart 400; suite 30 green; babel+css clean.
Live pass owed on the whole flow (fresh device = clear localStorage or private tab).
**SUBSCRIBED-ENTRY FIRST RUN (founder tested subscribe-before-first-signin):** (a) the
first-run bar had the STALE ThemeToggle (Appearance moved into Settings) — removed;
first-run bar = brand + identity only, no gear (Phase 1 stays shell-less). (b) §0b flow
(a)'s scope filter built: a teacher who arrives already PAID sees only what she bought —
FirstRun's subject wheel filters to her scopes' subjects, the class wheel to her scopes'
STAGES (one subject = a one-item wheel; no mid-first-run paywall possible); trial and
"*" see all 11. Uses the same trialInfo (/entitlement) fetch; no trial-terms line shows
for paid (status-gated already).
**LAPSED = THE READING ROOM, and revocation lands MID-SESSION (founder, persona
pass):** the founder's definition, implemented — a lapsed subscriber can only access
MY LESSONS (choose subject/class from her profile-driven dropdowns, open LPs, export/
print) plus SETTINGS with the profile locked; "a dummy system to access the LPs and
export them". Concretely: the **My Classes tab HIDES** for lapsed; a lapsed teacher
standing on My Classes (including the instant a mid-session revoke lands) is moved to
My Lessons; the **"Prepare a new lesson →" bar in My Lessons is GONE** (renewal lives
in Settings, never pushed here); profile pen + "+" already hidden. **Mid-session
detection:** page.jsx's entitlement fetch became a SYNC on the section-state cadence
idiom — focus/visibilitychange + 20s visible interval — so a terminal revoke reaches
the phone UI within seconds (server 402s authoritative regardless).
**THE POST-TRIAL SCOPE FILTER built (founder, persona pass — §0's gating-at-add-time,
the last unbuilt piece of it):** a PAID teacher's profile choosers show ONLY her
entitled scope — subjects wheel filtered to her scopes' subjects, classes wheel to her
scopes' STAGES (client `stageOfRoman`); the quiet `.trial-note` line below the wheel is
the ONE upsell ("Your subscription covers what's shown here. Another subject or stage
is a separate subscription.") — her moment, pull never push. **CRITICAL GUARD: enrolled
entries always stay listed even when unpaid** — trial-era additions are her profile,
and hiding them from a pre-ticked manage list would silently count them as REMOVALS on
Continue. Trial and "*" grants see all 11, unchanged. Plumbing: page.jsx's entitlement
fetch also yields `paidScopes` (null unless enforced && active/grace) → TeachingProfile
prop. My Lessons dropdowns needed no change — they are PROFILE-driven, never catalogue-
driven, so trial-era plans in unpaid subjects stay reachable (plans are hers).
**PERSONA-PASS FIXES (founder, live):** (a) Subscribed card = LEDGER ROWS — Subject /
Stage / Class (derived from stage: prep 3-4-5 · middle 6-7-8 · secondary 9-10; the
billing unit is subject-STAGE so classes are a fact, not a choice) / Validity
(dd-Mmm-yy); one trio per scope, "*" reads All subjects · 3 to 10. (b) Paywall KICKER
matches the wall — read off the server's sentence: "Free trial ends" / "Subscription
ended" (revoked/lapsed) / "Separate subscription" (out-of-scope). (c) **THE LAPSED
LOCKOUT built** (§2.5 amended was spec'd but only generation was gated — founder caught
revoked kumar3 still adding sections/subjects): `_check_productivity` 402s POST/DELETE
/readiness + /section-state when status==expired & enforced (trial/active/grace pass;
reads, plans, export, notes, archive stay open — test_entitlement pins all of it);
UI half: page.jsx fetches entitlement on ready → `lapsed` prop → MyPlans hides the "+"
portal, TeachingProfile hides the edit pen (profile read-only). Welcome copy: "Lesson
plan in SECONDS, not hours".
**FIFTH PASS (founder, live, final for the day):** ONE "Settings" only — the bar's
title is THE title (19px display font + ⚙ glyph at 20px beside it, Ask-Aruvi placement),
the in-content h1 + subtitle removed (home and farewell); no hairline under the bar. All
function icons (👤💳⬇?✉ⓘ◐↪🗑📄) stripped from cards and rows — text + chevron only; the
bar's gear is identity, not function. **PROFILE FIXES (kumar3 live):** (a) keep-≥1-
subject RETIRED — removing the only subject continues, warned like any removal; emptied
profile → empty state in-session, first run after fresh sign-in (CLAUDE.md §0 amended in
place); manage-subjects Continue is never disabled in manage mode. (b) **"Keep it" now
MEANS keep it** — both confirm modals (subjects + classes) re-tick the about-to-be-
removed entries on Keep, instead of returning an unticked picker that forced re-
selection. Class-manage remove-all already cascaded correctly (subject goes with it,
warned). All STATIC-verified; the day's screens are live-tested by the founder on
iPhone as built.
**FOURTH PASS (founder, live): the Settings bar is the ASK-ARUVI IDIOM — title left,
✕ right.** No "← back" + title pair: the frozen row reads "Settings · ✕", and the ✕
closes the WHOLE of Settings (home, any subview, or the profile reached through it)
straight back to wherever she was at gear-press (`settingsClose`; the hierarchical
`settingsBack` is gone). Subviews deliberately have no back-to-home — reopen the gear
("rest fine", founder). `.set-bar` = space-between, `.set-bar-x` styled like the app's
close marks.
**THIRD PASS same day (founder, live on phone): ONE GEAR, FROZEN SETTINGS BAR,
PROFILE CARD ON TOP, COMPACT CARDS.** The person icon is REMOVED (fewer buttons):
the gear is the only door and **Profile is Settings' TOP card** ("Profile · Your
teaching profile" → TeachingProfile). While in Settings — or the profile reached
THROUGH it — the tab row + Ask mark are REPLACED by a **frozen Settings bar** (`.set-bar`
in the same `.main-tabs` nav slot, so it pins identically): "← back · Settings". The
tabs/Ask had no role there and read as stale chrome (the founder's exact complaint).
**Back is hierarchical** (`settingsBack` in page.jsx): profile→settings home,
subview→home, home→ORIGIN (captured in `settingsOriginRef` at gear-press:
lessonplans/profile/null → goLessons/goProfile/goClasses). Settings' `view` state is
LIFTED to page.jsx for this. Profile via portal/tour keeps the ordinary tab row
(those paths exit through their own flows); TeachingProfile's own back button hides
when entered via settings (the bar has the one back). Subview back-links removed.
Cards COMPACTED (9px padding, 7px gaps, 14.5/11px type) so the list fits one phone
screen. **The big edit pen is back at the RIGHT END of the "Your teaching profile"
title row** (mid-turn founder correction — not below the cards; `.tp-edit-below`
CSS orphaned). STATIC-verified (babel ×3, css 2028/2028); live pass owed.
**SECOND PASS same day (founder): SETTINGS AS FIVE CARDS + PROFILE PENS.** Settings home
is now the founder's card structure in his order — Subscription & billing ("Plan,
billing & usage") · Your data & export ("Download your Aruvi data") · Help ("Ask Aruvi
guide", opens Ask Aruvi) · Support ("Email & feedback") · About Aruvi ("Version info /
legal") — each a `.set-bigcard` on the existing `--card-bg` token (plain fill distinct
from paper, dark-flipped already), leading to SUBVIEWS; Subscription shows the live plan
state + an honest "billing arrives with online payments" line; Support/About are
deliberate UI-FIRST placeholders (founder: shape the surface now, fill as features
land). NO Profile card (the person icon is the profile's dedicated door). Below the
cards: Appearance (ThemeToggle) + Account (Log out · Delete). **TeachingProfile edit
rework (supersedes the "don't touch profile" hold):** the big green pen moved BELOW the
subject cards (`.tp-edit-below`; header clean); in edit mode ONE idiom — a pen per
dimension: subject pen → `startManageSubjects()` (full pre-ticked list), class pen →
`startManageClasses(si)`, sections/ppw/budget pens unchanged; the red dustbins and the
green "+ add a class"/"+ add a subject" buttons are RETIRED (adds happen by ticking in
the same manage lists that remove; scoped warnings unchanged; empty profile keeps its
one "+ add a subject"). The confirm-modal kinds "subject"/"grade" and `Bin`/
`startAddClass` are now dead paths on disk. STATIC-verified (babel ×3, css 2025/2025) —
live pass owed on both screens at 360×800.
**SLICE 2 SUPERSEDED SAME DAY → THE PROFILE/SETTINGS SPLIT (founder; mockup
`docs/mockups/profile-settings-split.html`).** The gear stopped being a synonym for the
teaching profile. Header is now: brand · **PERSON icon** (SVG, → TeachingProfile,
carries the tour's `data-tour="settings-gear"` anchor since that step is about the
profile) · **GEAR** (→ NEW `components/Settings.jsx`) · user/logout — **ThemeToggle
moved off the bar** into Settings › App › Appearance (the toggle IS the row control).
Settings = grouped list (mockup frame 2, PRUNED to what exists per the junk-drawer
rule): Subscription card (trial counter / subscribed·scopes·valid-until / ended;
enforcement-gated) · Profile › "What you teach" row (subtitle "N subjects · M classes";
second door to the same TeachingProfile) · Your data (Word/PDF download rows) · App
(Appearance + Ask Aruvi) · Account (Log out · Delete my account with the typed-"erase"
flow). Deliberately absent: Security/passwords, Preferences, invoices, School &
Academic Year (Step 2), demographics (arrive with subscription checkout — will live
here), Reports, bottom tab bar (two-tabs decision stands). `editFlow` gains "settings";
AccountPanel.jsx is DEAD CODE on disk (dissolved into Settings). **TeachingProfile
itself deliberately untouched** (founder: no profile redesign yet — the chip-based
direct-manipulation mockup frames 1+4 await a separate decision). `.set-*` CSS.
STATIC-verified (babel ×2, css 2015/2015) — live pass owed: person-icon SVG sizing in
the bar, Settings on 360×800, downloads, delete flow, tour step 16 anchoring the person
icon.
**STEP 6 SLICE 2 — "YOUR ACCOUNT" GEAR SURFACE (same day, now superseded above).** New
`components/AccountPanel.jsx`, rendered below TeachingProfile inside the settings-gear
editflow (page.jsx): (1) SUBSCRIPTION in plain words from /entitlement — trial counter,
"Subscribed · {scopes}" + valid-until, or "Subscription ended — your plans remain yours"
— shown ONLY when the gate is enforced (a card describing unenforced rules would lie);
(2) DOWNLOAD MY DATA as Word/PDF — fetch→blob→anchor because a bare href can't carry
X-Aruvi-User (iPhone Safari opens its viewer, the platform's save path); (3) DELETE MY
ACCOUNT — Apple 5.1.1(v)'s in-app deletion: typed "erase" confirmation mirroring the
API guard, success shows a farewell + backup-purge note then onSignOut (the account no
longer exists). Data-rights actions never gated on subscription state (§2.5). `.acct-*`
CSS (ledger rows, outline pine download buttons, danger-bordered delete zone).
STATIC-verified (babel ×2, css 1993/1993) — live pass owed: downloads on iPhone Safari,
the typed-confirm flow, and post-erase sign-out. NEXT: persona end-to-end pass, then
the "+" upsell / scope-filtered choosers.
**TRIAL DISCLOSURES REWORKED to the two-flow front door (founder, 2026-08-24 —
subscription doc §0b supersedes the first placements).** Login page will offer
Subscribe | Free trial (future, with the purchase flow); both land on WELCOME first.
Trial welcome now states the terms PROMINENTLY above "Let's get started" ("Your free
trial covers any 3 chapters. For any single chapter, you can generate unlimited number
of Lesson plans") — `.fr-trial-terms`, with a sibling rule reclaiming the h2's 56px top
margin so the screen height barely grows and the prepare bar needs no scroll. Because
the welcome says it, FirstRun's CHAPTER step no longer carries the coverage line, and
PrepareLesson's counter (its only home) shows ONLY once a chapter is spent, reworded to
"x of 3 free chapters used. Regenerating same chapter allowed." Subscribed customers
(future flow): welcome clean of trial terms, subject pre-scoped to the paid plan, class
list stage-filtered, no gating. STATIC-verified (babel ×2, css 1973/1973); live check
at 360×800 owed — CTA visibility on the welcome with the terms line is the thing to eye.
**KUMAR1'S PHANTOM TOUR (same day) — the offer is now SERVER-CONFIRMED ELIGIBILITY.**
He was offered the 19-step tour despite 27 bound sections. Two defects found: (a) the
reconcile race — MyPlans reads bindings off the localStorage cache, and a cleared
browser + a server-restart window left it empty, so the app believed "nothing attached";
FIXED by `pullSectionState` now resolving true/false (false = server unanswered, cache
NOT trustworthy) and MyPlans gating the welcome copy + its nudge on `bindingsKnown`
(anyBound || first successful reconcile; no-keys profiles count as reconciled). (b) the
REAL bug — the 2026-08-21 "offer on both surfaces" change: only MyPlans carried a gate;
MyLessonPlans rendered the nudge purely on `onStartTour` being passed, i.e. for EVERY
teacher EVERY session. And the obvious gate ("nothing attached") is WRONG because first
run AUTO-BINDS the lesson to the default section — it would kill the offer for the exact
person it exists for (the ungated MyLessonPlans render had been silently load-bearing
since 2026-08-21). FIX at the source: page.jsx fetches /section-state once per sign-in
and computes `tourEligible` = **at most ONE bound section AND no teaching progress
anywhere** (no unit_index set, nothing done) — self-closes forever the moment she
actually teaches, no stored flag (the 2026-07-06 no-client-flag rule kept); null/
unreachable = no offer (unknown must never look new). `onStartTour` is passed to BOTH
surfaces only when `tourEligible === true`. Verified against real data: kumar1 bound 27
/ progressed → ineligible; a fresh first-runner (1 auto-bound, no progress) → eligible.
STATIC-verified (babel ×3) — live check: kumar1 reload shows NO tour offer anywhere; a
fresh teacher still gets it after first run.
**And the erase walk learned about entitlements (same day):** Step 4's traversal
predated Step 5's store, so an erased teacher's used-up trial counter would have
SURVIVED her erasure (a remnant + an infinite-trial loophole in reverse: erase would
have reset nothing). data_rights erase now removes `entitlements/{tenant}` — but ONLY
when tenant == user, so erasing one teacher of a school never destroys the school's
subscription; receipt lists "subscription record"; test_data_rights pins it. STANDING
RULE: a new Bucket-B store joins the erase/export traversal the day it is born.

## 2026-08-23 — THE CLOUD/LOCAL RESTRUCTURE: data/cloud/ IS THE
## MIGRATION UNIT, data/authoring/ IS FOUNDER-SECURE

**Why.** The founder asked, given the genon architecture (authored canonicals + deterministic
serve + on-demand exports), what the MINIMUM production cloud artifacts are. Tracing actual
runtime reads settled it: serving is selection, never generation, so **no constitution, no
framework prompt-text, no chapter summary and no LLM is read at serve time**. The old
"everything under data/ migrates" promise (CLAUDE.md §5) was therefore FALSE for the minimum —
`data/content/` interleaved runtime serve content with the deepest authoring IP. Two findings
against the standing docs while tracing: (a) **chapter summaries are read by NOTHING at
runtime** — `GET /chapters` builds its list from MAPPINGS + the master-plan combo (summaries
are authoring inputs + the certification registry-of-record only); (b) **framework/ is
split-use** — the runtime DOES read `competency_descriptions_*.json` + english
`spine_to_cg.json`, while the cg/pedagogy .txt are prompt inputs (public-NCF-derived, so the
whole framework/ tree rides in cloud rather than splitting a second tree).

**The layout (CLOUD_DATA_MODEL.md §0.5, the new authority).** `data/cloud/` goes to
production byte for byte: `content/` (allocation_norms · chapters/**/mappings · framework ·
saved_plans = certified libraries + the served-plan cache) → object store behind `DATA_DIR`;
`state/` (accounts · academic_years · readiness · allocations · section_state ·
prepared_plans · plan_archive · plan_notes) → Supabase behind `STATE_DIR`. `data/authoring/`
(constitutions, chapters/**/summaries) is FOUNDER-SECURE, never syncs, and — grep-able
invariant — is NEVER read by `api/` or `aruvi_core/`; promotion of an authoring artifact to
runtime is a recorded decision first. `data/testing/` stays local behind the new
`TESTING_DIR` seam (`ARUVI_TESTING_DIR`), deliberately outside the migration unit. The
served-plan store is a CACHE (deterministic ~ms serves, deterministically named): it may
start empty in cloud, but the read path has no regen-on-miss yet, so sync it or build that
first (§4 step 4 records this).

**What changed.** `aruvi-scripts/migrate_cloud_layout.py` (idempotent, move-never-copy,
refuses to merge) performed the physical move. `api/config.py`: DATA_DIR → `data/cloud/
content`, STATE_DIR → `data/cloud/state`, new TESTING_DIR; `api/testing_campaign.py` uses
TESTING_DIR. `genon/prompt_assembly.py` grew `AUTHORING_ROOT` (`ARUVI_AUTHORING_DIR`) and
routes constitutions + summaries there, framework + mappings to DATA_ROOT. Living genon
modules repointed (master_plan, variant_plans, build_library, extract_determinate,
recover_from_raw, polish_plan); **spent one-shot repair/amend scripts deliberately left on
the old paths** — they are history, not tooling. All `tests/` defaults/docstrings updated
(the TWAU summary fixture now under `data/authoring/`). Skills: `chapter` SKILL.md's path
table splits summaries→authoring / mappings→cloud; `canonical` SKILL.md repointed —
**both need re-pasting into Settings > Capabilities** (the loaded cache is read-only).
CLAUDE.md §5/§7 rewritten. A `.DS_Store`-only husk of `data/content/` remains (sandbox
cannot delete); founder removes by hand.

**Cross-confirmation.** The parallel 2026-08-23 mapping session below hit the move mid-flight,
briefly read it as data loss, then verified the full corpus intact at the new root and all ten
content-reading tests green there — see its item (4) for the carry-forward lesson.

---

## 2026-08-23 — SS JUSTIFICATIONS SHORTENED UNDER 120 WORDS, THE
## SECOND MACHINERY SWEEP, AND A NOTE ON THE data/cloud RELOCATION

Follow-on to the de-leak entry below. Three things happened.

**(1) Length banding exposed a tail.** Word-count bands per subject (now a **Word bands**
tab in `docs/aruvi_mapping_internal_references.xlsx`) showed social sciences alone carrying
a long tail: 48 justifications at 121–180 words and **29 above 180**, one at 251. Maths,
TWAU and science topped out inside 81–120 with a handful of outliers. A 250-word paragraph
in the LP competency table is unreadable whether or not it cites Rule 5(b) — length is the
second half of the same problem.

**(2) The 77 SS justifications over 120 words were rewritten, 13,170 → 8,288 words (−37%).**
Not a regex job: each was condensed by hand (four parallel subagents on a fixed brief, then
verified centrally). The brief: keep the named sections/activities **in their exact quoted
form and spelling, diacritics included** — that is how a teacher locates the material — keep
the closing judgement of centrality, cut restatement of the competency's own wording and
repeated enumeration, invent nothing. Verification was independent of the agents' own
claims: every capitalised phrase and quoted name in a proposal was traced back to its source
(**zero fabricated section names**), the banned machinery vocabulary was re-checked, and word
counts recomputed. Longest result 117 words, median 108. Applied with the same byte-safe swap
+ structural deep-diff as the first pass, with a pre-write assert that each field still
matched the text the proposal was written against (`aruvi-scripts/mapping_shorten_ss.py`).

**(3) A SECOND machinery sweep — the first scan had missed 92 instances, and the lesson is
about CASE and word-FORM.** The original classifier was case-sensitive and matched only the
exact phrases seen in samples, so it never saw: **`architecturally` / `architectural`** (109
across every subject — "the chapter is architecturally organised around", "the chapter's
architectural spine"; the adverb is always droppable, the adjective nearly so),
**"Named structural element qualifying as present."** as a whole sentence (capital N — 18,
SS·vii ships it in eight chapters), **"qualifying as weight 1"** (lowercase w), and
**"Remove C-6.4 and … dissolves"** (a C-code where the pattern expected "this competency").
All 92 fixed (`mapping_deleak_fixup2.py`), plus one article slip (`an passing reference`,
`mapping_deleak_fixup3.py`). **Two survivors are deliberate and must stay:** "spanning its
sub-disciplines" (SS·ix ch 5 — NCF curriculum vocabulary) and "the dissolution of the Maurya
Empire" (SS·vii ch 6 — actual history). A third, "substantive from procedural justice"
(SS·viii ch 11), is a legal term of art. **Corpus state: 942 justifications, 66,176 words,
zero machinery hits under a case-insensitive scan, no SS field over 120 words.** All four
scripts are idempotent and now re-run as clean no-ops — that is the regression check.

**(4) ⚠ THE DATA ROOT MOVED MID-SESSION — `data/content/` → `data/cloud/content/`.** Another
session performed the physical Bucket A/B split while this work was in flight (`api/config.py`
now defaults `DATA_DIR` to `data/cloud/content` and `STATE_DIR` to `data/cloud/state`; new
`data/authoring/` and `data/testing/` trees alongside). **Nothing was lost — the move carried
the amended files** (verified: 334 mapping files at the new path, 942 justifications, zero
machinery, zero SS fields over 120 words, and the amended SS·ix ch 4 C-2.4 text present).
For five minutes it LOOKED like the corpus had been deleted, because `data/content/` was left
behind holding only `.DS_Store` files. Two things to carry forward: **when a path under
`data/` suddenly reads empty, look for the tree having MOVED before assuming loss** (the
`find`-by-name across the repo root is the fast check); and **any tooling that hardcodes
`data/content/` is now pointing at an empty directory** — the four `mapping_deleak_*`
scripts and `mapping_shorten_ss.py` were re-pointed at `data/cloud/content/chapters`, and the
test invocation is now `ARUVI_DATA_DIR=$PWD/data/cloud/content`. All ten content-reading tests
green at the new root.

---

## 2026-08-22 — THE MAPPING JUSTIFICATIONS ARE DE-LEAKED: THE
## CONSTITUTION'S MACHINERY NO LONGER REACHES THE TEACHER

**The leak.** `export_lesson_pdf.targeted_competencies` copies each mapping's
`justification` field VERBATIM into the lesson plan's competency table. Those fields were
written as an audit trail for the *authoring* pipeline, so they argue the weighting the way
the constitution reasons about it — and the teacher was reading it. The founder's example:
SS·ix ch 4 C-2.4 ended "…is developed substantively across multiple named sections,
**satisfying Rule 5(b)**." A teacher has no need for Rule 5(b), or for Weight 2, or for the
dissolution test.

**The corpus scan (all 334 mapping files).** 346 sentences in 87 files, five kinds:
(A) **rule citations** — "satisfying Rule 5(a)", "Weight 1 under Rule 6", "Rule 7 permits
Weight 3", "Rule 8's positional test", "under Rules 4 and 7" — 101; (B) **weight machinery**
— "Weight 2, not Weight 3", "confirming Weight 3 eligibility" — 29; (C) **the dissolution
test** — "Complete removal of this competency structurally dissolves…" — 34; (D) **the rule
wording quoted verbatim without naming a rule** — "architecturally distinct", "could stand
alone as a learning unit", "developed substantively and deliberately across multiple named
sections", "the sub-discipline governing the chapter's primary structural activity" — 117
(the largest class, and the one a grep for "Rule" misses); (E) **classification words used as
verdicts** — substantive / incidental / adjunct / co-central — 65. Concentration:
**social_sciences 303** (viii 15 files, vi 14, vii 12, ix 9), mathematics 34, science 7,
TWAU 2. **English mappings carry no `justification` at all**, so nothing leaked there.

**Applied 2026-08-22.** 321 sentences rewritten in teacher language (Weight 3 → "the
chapter's central focus", Weight 2 → "a major strand", Weight 1 → "a supporting mention",
"could stand alone as a learning unit" → "could be taught as a lesson in its own right",
"Complete removal … dissolves" → "the chapter would have no purpose without it"); **25
deleted outright** because the sentence WAS the verdict and nothing else — SS·viii ships a
bare "Rule 6 is satisfied." in thirteen chapters, and SS·vii a bare "History
sub-discipline." **Two kept on purpose:** "substantive from procedural justice" (SS·viii
ch 11) is a legal term of art, and "spanning its sub-disciplines" (SS·ix ch 5) is NCF
curriculum vocabulary — neither is Aruvi machinery.

**How, and why it is safe.** `aruvi-scripts/mapping_deleak_{common,scrub,patch,fixup}.py`.
The write is a **byte-safe swap in the raw file text** — the old justification is re-encoded
with `json.dumps` (both `ensure_ascii` variants tried) and replaced only when it occurs
exactly once — never a re-serialisation, so indentation, key order and unicode escaping are
untouched everywhere else. Every file is re-parsed after the swap and deep-compared to the
original with `justification` blanked; the run aborts on any structural drift. Verified:
334 files parse, every `weight`/`c_code`/`cg` and list length identical, 87 files changed,
all five subject-port parity tests + `test_lp_standard` + `test_calibrated_defaults` green,
and every one of the 321 rewrites located on disk. **Re-running the scripts is a no-op** —
they are idempotent, which is the cheapest regression check there is. Backup:
`outputs/backup/mappings_backup_20260822.tar.gz` (data/ is git-ignored — there is no other
safety net). Audit record with every before/after pair:
`docs/aruvi_mapping_internal_references.xlsx`.

**Two traps worth remembering.** (1) The scrub is *sentence-scoped*, and the sentence
splitter must treat `.'` and `."` as sentence ends — without that, a dissolution sentence
following a quoted clause is not sentence-initial and comes back lowercase mid-paragraph.
(2) A naive `\b([A-Z][A-Za-z ]+?) sub-discipline\b` eats "**Because the** sub-discipline";
the discipline names had to be enumerated (History|Geography|Political Science|Economics).
Both were caught by reading the output, not by the residual-machinery regex — a clean
scanner says nothing about grammar.

**NOT changed, still open.** 146 mapping files carry `"summary_path": "mirror/chapters/…"`,
a path into the retired prototype mirror rather than this repo's `data/content/` — stale
plumbing, nothing reads it today. science + mathematics mappings keep a chapter-level
`dissolution_test` FIELD; the name is internal but its prose is fine and it does not reach
the LP. **The real fix is upstream:** the authoring prompts under `cowork prompts/` are what
taught the model to argue this way, so a regenerated chapter will re-introduce the machinery
unless they are amended to say the justification is read by TEACHERS.

---

## 2026-08-22 — ADMIN ARCHITECTURE STEP 4 BUILT: EXPORT + ERASE
## (DataRightsService) — DPDP PORTABILITY, DPDP ERASURE, APPLE 5.1.1(v)

Same session as Steps 0+1+3 below. **Founder decisions:** export is a WORD DOCUMENT ONLY
(no JSON half — the spec's "notes to her future self" argument taken whole); scope is
EVERYTHING Bucket-B (account, profile, notes across every year — each beside its chapter
identity — allocations, section progress, prepared register, archive flags), never the
shared plan library; after erase the user ID is NOT reserved — signing in again
JIT-creates a fresh empty account (a tombstone would itself be a remnant, §2.6).
Built: `ErasureReceipt` + `DataRightsService` in ports.py;
`data_rights_service_file.py` (reads via the same file adapters the API uses; the ONE
filesystem read is enumerating which subject·grade allocation registers exist — the
port deliberately has no listing method; `_year_ids` unions opened years with on-disk
year folders so orphaned data is never invisible to its owner);
`export_data_rights_docx.py` (python-docx, style-matched to export_allocation_docx);
routes `GET /data-rights/export` (docx download) + `POST /data-rights/erase` (requires
the literal body `{"confirm": "erase"}` — a typed confirmation so no stray client call
can destroy an account). **Erase mechanics:** account record LAST; `_rm` climbs and
removes now-empty ancestor folders up to each store root (an empty folder named after
her is still a remnant — the first test run caught exactly this; a school tenant's
folder survives because it is non-empty); idempotent (second erase → empty `erased`,
no error). **The receipt's `kept` wording is PINNED by test_data_rights** (backups
purged ≤30 days · GST/tax records · shared library) — it must match the privacy policy;
change both together or neither. NO entitlement gate on either route, ever (§2.5 —
rights don't lapse with payment). Tests: NEW test_data_rights.py — export contents,
**export-as-tenant-isolation-test** (tenant B's text must not appear in A's export),
shared-library exclusion disclosure, erase completeness + receipt + idempotency +
neighbour-untouched, route roundtrip (PK magic bytes, confirm guard, post-erase fresh
start). Suite 29 files green (same 5 pre-existing content failures excluded). No web
change this step (UI surfaces are Step 6) — founder smoke check: restart uvicorn, then
`curl -H "X-Aruvi-User: kumar1" -o mydata.docx localhost:8000/data-rights/export` and
open it in Word. Remaining: Steps 2 (cutover), 5 (entitlement), 6 (UI).
**Export REFORMATTED same day (founder review of the first live export — six points):**
(1) house format — the builder now IMPORTS the allocation report's helpers
(`export_allocation_docx._run/_cell/_hairlines/_set_widths/_section_head/_rule` + palette),
so the two documents cannot drift; (2) a PURPOSE paragraph at top — the spirit
("everything you create in Aruvi belongs to you…"), deliberately no regulation names;
(3) teaching profile as a TABLE (Subject · Class · Sections); (4) chapter notes NUMBERED,
each a separated block with a bold identity line "N. Subject · Class N · Chapter N —
Title"; (5) teaching state as a TABLE (No. · Subject · Class · Chapter · Sections ·
Status) with **NO filenames, canonical identities, raw section keys or period counts** —
test_data_rights now asserts their ABSENCE; (6) the closing note adds the pre-deletion
advisory (export first; deletion removes all personal data within a short period,
unrecoverable). Plumbing this needed: `_parse_section_key` (parse from the RIGHT — subject
slugs contain underscores), `_chapter_num_from_file` ("ch_05_canonical.json" → 5, bare "3"
tolerated), `_teaching_rows` grouping sections by subject·grade·chapter with plain-words
status ("started" / "at Learning Unit N" / "completed"), and a `chapter_title` resolver
INJECTED from api/main.py over `data.list_saved_plans` — the export's one window into
Bucket-A content, kept at the API layer so the service never crosses the bucket boundary.
Verified against kumar23's real data: profile table row "The World Around Us · IV · 4A",
note block "1. … · Chapter 5 — Food for Health", state row "Ch. 5 — Food for Health · 4A ·
4A: started".
**PDF twin added, same day (founder: "both pdf and word options like all other
exports"):** `export_data_rights_pdf.py` — the SAME payload through xhtml2pdf (the
allocation report's engine and CSS vocabulary: Georgia brand header + clay dot, rule as
1-cell table, hairline tables), so the two formats cannot disagree on content. Port +
service `export()` gained `fmt: str = "docx"` ("docx" | "pdf", ValueError otherwise);
route takes `?format=pdf` (400 on anything else). Both deps already in
api/requirements.txt. Verified on kumar23's real data (pdftotext shows purpose, profile
table, numbered note with chapter name, teaching-state table).
**Live-export find, same day (kumar23):** the first real export showed the note key
stored as "the_world_around_us/Grade IV/5" — the client sends the view model's DISPLAY
grade, which varies by subject port, while every sibling store keys by the slug ("iv").
Fixed by NORMALIZING the grade in the key on BOTH sides — api/main.py `_note_key`
(authoritative; lowercases subject, strips grade/class prefix, spaces→_) and format.js
`planNoteKey` (the GET-side lookup MUST mirror it or reconcile misses server notes) —
plus a regression test (display form and slug form hit the SAME note) and a one-off
rewrite of kumar23's stored key. Also confirmed NOT a bug: his "ch 4" note text sits
under chapter 5 because he actually prepared ch_05 "Food for Health" (section state
proves it) — the filing was correct, the memory was not.

## 2026-08-22 — ADMIN ARCHITECTURE STEP 3 BUILT: CHAPTER NOTES SERVER-BACKED
## (PlanNoteRepository) — THE LAST DATA GAP CLOSED

Same session as Steps 0+1 below. **The founder resolved spec §7's open item:** ONE note per
chapter within an academic year — notes split only when two YEARS are involved — so the key
is the CHAPTER's identity `{subjectSlug}/{gradeSlug}/{chapter_number}` (title fallback),
never a plan filename, and the 2026-07-23 "one surface" decision stands within a year.
Built: `PlanNote` + `StaleNoteWrite` + `PlanNoteRepository` in ports.py;
`plan_note_repository_file.py` (`plan_notes/{tenant}/{user}/{year}/notes.json`, atomic
writes + process lock like section_state); routes GET/POST `/plan-notes` (year-resolved
server-side like the rest). §2.4's two rules enforced mechanically: **empty-text save IS
delete** (no separate lifecycle, no tombstone) and **anti-clobber without history** — a
save whose `updated_at` is older than the stored copy raises StaleNoteWrite → HTTP 409
carrying the NEWER copy, which the client adopts; equal timestamps accepted (idempotent).
Web (LessonView `ChapterOrg` + format.js `fetchPlanNotes`/`savePlanNote`): localStorage
demoted to optimistic cache; mount shows cache instantly then reconciles from the server
(server wins); a cache-only note with no server copy is a LEGACY browser-only note and is
migrated up once — nothing written before this landed is stranded; the notes modal now
discloses "Saved to your account · opens on any device you sign in from" (the spec's
"done when she is told" clause). Tests: NEW test_plan_notes.py (roundtrip, empty-delete,
stale-refused/equal-accepted, no-history-on-disk, year+tenant isolation, full API
roundtrip incl. 409-with-newer and traversal guard); suite 28 files green (same 5
pre-existing content failures excluded). CLOUD_DATA_MODEL §2.8/§5 updated — the "notes
are the exception" invariant violation is CLOSED. Web half STATIC-verified only
(babel-parse clean) — **owes the live pass**: note surviving a cache clear/device change,
the legacy-lift firing once, and the 409 path. Period notes remain deferred/unbuilt.
Step 4 (export/erase) is now unblocked.

## 2026-08-22 — ADMIN ARCHITECTURE STEPS 0+1 BUILT: ACCOUNT RECORD +
## YEAR-SCOPED ADDRESSING, DEV DATA MIGRATED

Built `docs/administrative_architecture.md` §5 Steps 0 and 1 together (both are re-filing
jobs on the same repositories). **Step 0:** `Account` + `AccountRepository` and `Identity` +
an expanded `AuthProvider` in ports.py; file adapters `account_repository_file.py`
(`data/accounts/{tenant}/{user}/account.json`) and `header_auth_provider.py` (the
X-Aruvi-User stub, now behind the port). `_current_identity()` in api/main.py — still the
ONLY identity derivation point — now resolves header → AuthProvider → account record,
**JIT-creating the account on first request** (preserves "any user ID signs in"), and returns
`(account.tenant_id, account.account_id)` — separate values that today happen to be equal.
**Step 1:** `AcademicYear` + `AcademicYearRepository` (+ file adapter,
`data/academic_years/{tenant}/{user}/years.json`; exactly one `is_current`, oldest-first
listing, `set_current` refuses unopened years). The four TEACHING-state repos — allocations,
section_state, prepared_plans, plan_archive — gained `year_id` after `user_id` in every
method (13 signatures; SectionState's impl-only `clear_all` promoted into the Protocol) and
file under `{kind}/{tenant}/{user}/{year}/…`. engine.py's 4 allocation wrappers thread
`year_id` as pure pass-through. **Readiness is deliberately NOT year-scoped** (class list
carries, §2.7) — founder confirmed over the spec's blanket "every repository" sentence.
**Year resolution is server-side** (founder choice): year-scoped routes take an OPTIONAL
`?year_id=`; absent → `_resolve_year()` reads the teacher's current year, bootstrapping the
April-anchored default (`2026-27`, CBSE Apr–Mar) on first touch. **ZERO web changes** — no
static-only React edit owed. Migration: `aruvi-scripts/migrate_step01.py` (one-shot,
idempotent — second run prints "Nothing to do"); RUN on the real dev data 2026-08-22: 13
folders moved into `2026-27/`, 7 accounts + year records created (identities discovered as
the UNION across all Bucket-B kinds, so kumar9/10/11 — prepared_plans-only — weren't
stranded). Tests: test_allocation updated (+ cross-year + tenant≠user cases); NEW
test_account, test_academic_year, test_year_scope, test_migration (idempotency proven on a
fixture tree). 27 test files green incl. test_api end-to-end on migrated data; the 5 failing
files (genon_plan_key, link_resolver, normalized_item, unit_order, unitize) fail on CONTENT
assertions predating this work and import nothing changed here. Steps 2–6 NOT started.
Housekeeping for the founder: (a) a stale `.git/index.lock` (+ `.git/objects/5f/tmp_obj_*`)
was left by a failed stash in the Cowork sandbox (the mount forbids deletes under .git) —
remove locally before the next git op; (b) `data/accounts/stranger1/` +
`data/academic_years/stranger1/` are leftovers of a live isolation check the sandbox could
not delete — `rm -rf` them at leisure.

## 2026-08-20 — F1 · NOTES PASS (second pass): TEACHER_NOTES AUDITED ON ALL
## 39 CLOSERS, ONE MORE WRONG ANSWER FOUND, 46 REPAIR RECORDS CORRECTED

Executed `docs/f1_maths_notes_pass_brief.md` in full, same doctrine (declared old → new
via `repair_c3.py --declared-only`, never a hand edit): **34 edits across 28 chapters,
ARV-D-222…256**, all three priority items done (vi ch 3's false "the largest number is
always a supercell" struck; vi ch 9 P4 now exhibits the 18-arm witness instead of using
divisibility as proof; vii ch 9 P4's "In the figure…" rewritten so words alone determine
the configuration). All 39 closers were read against their own tables with the brief's two
tests; beyond the 8 known attribution defects the audit found ~18 more — including **one
more WRONG ANSWER (ARV-D-225): vii ch 1 P4 claimed the 7-digit × 2-digit product "is
always 9 or 10 digits"; truth is 8 or 9** (the cell mis-wrote ten lakh × 10 as
10,00,00,000 — it is 1,00,00,000, eight digits — and carried "— wait, check:" scratch;
ch 1 was NOT among the 8 chapters the "30 of 30 correct" audit covered). Other notables:
vii ch 15 P4's diagnosis branded the student's correct move as wrong; viii ch 3 P4
described cuneiform digits no scribe could write (15 unit-wedges); minute-quantities
survived in viii ch 1/2/13 (the pass-1 register sweep covered only the 16 touched
closers); several notes flagged their own solution's method as the student error (vii
ch 1 P2, vii ch 3 P1). **§3: the prepend-recorded-as-replace pattern was corpus-wide —
46 ARV-D-187 records across all 39 chapters** (8 chapters carried two, from an earlier
partial run); all corrected in place (op='prepend', old=None, full pointer as new,
originals kept under `as_first_recorded`, each verified against the live notes), and
`pass_synthesis_points_at_its_table` now emits the truthful shape (ARV-D-256).
Invariants verified corpus-wide after apply: every closer's notes still open with the
exact Prepared-Table pointer, all ≤ 1,600 chars, zero minute-quantities. Re-certified
**39/39 ALL PASS, zero register ban hits**. ARV-D-220/221 remain OPEN for the founder,
untouched per brief §5. Backups: `backup/c3_repair/20260820_140*/`.

---

## 2026-08-20 — F1 · MATHEMATICS·MIDDLE CLOSING-SYNTHESIS REPAIR WAVE:
## 16 BRIEFED DEFECTS + 8 FOUND, ALL BY DECLARATION, 39/39 RE-CERTIFIED

Executed `docs/f1_maths_repair_brief.md` in full. The resynthed maths·middle closers had
shipped mathematical defects certification cannot see (it checks structure/anchors/register/
coverage, never whether an answer is right): 4 wrong answers, 2 ill-posed problems, 7 invalid
routes, 3 statement/solution disagreements, plus drafting scratch. Everything went through
`genon/repair_c3.py` DECLARED entries (old → new by assertion, recorded in
`genon_canonical.repairs[]`) — **no artefact was hand-edited**. Every problem in every touched
table was recomputed from scratch before its edit was declared (brief §8), which surfaced
**8 defects beyond the brief's floor** (ARV-D-214–219 among them: a "KKK" cryptarithm draft
survivor in viii ch 5's notes, undefined vertex O in vii ch 14 P2's congruence, a duplicated
Prepared-Table pointer in viii ch 11's notes, a mislabelled sign rule in vii ch 10 P4, and
stated minute-quantities in vii ch 9 / ch 14 notes — the register's only hits corpus-wide).
The headline fixes: vii ch 14 P3's "four corners same colour" was FALSE on 4×4 (repaired to
the two-opposite-corners classic, 6 vs 8); viii ch 5 P4's "no solution for AB × 7 = CBA" was
false (97 × 7 = 679; algebraic route 3(23A−B) = 100C now in-cell) and its P2 became the
3A5B18 problem its own editorial note proposed; viii ch 11's ant now walks corner-to-corner
so the Baudhāyana–Pythagoras theorem the unit names is actually needed (4√5 ≈ 8.9 cm);
viii ch 12 P4 asks only what its given points settle. Ledger: **ARV-D-196…219 repaired**
(evidence quoted on the campaign register, combo mathematics/middle · step F1),
**ARV-D-220/221 OPEN for the founder** — the two §7 method-availability items (vii ch 11 P3
needs HCF × LCM = product; vii ch 14 P3 needs the colouring argument; the shorter plans teach
neither) are content decisions in ARV-D-181's family and were deliberately not papered over.
Mechanics worth carrying: the applied viii ch 11 ARV-D-185/186 entries were **retired to a
("mathematics","viii","APPLIED-20260819") key** — the closer was re-authored after they ran,
so 185 would refuse on every run, and 186's old string *reappears* once ARV-D-216 removes the
duplicated pointer, so left live it would re-fire and reintroduce the duplicate. All `old`
strings were extracted byte-exact from disk by marker-pair script before declaring (zero
refusals first dry-run). Purge: no derived plans existed (cache empty, trivially satisfied).
Re-certified: `batch_build mathematics vi vii viii --certify-only` → **39/39 ALL PASS, 114
files register-clean, zero ban hits**. Backups: `backup/c3_repair/20260820_1331*/`.

---

## 2026-08-19 — DENSE PROSE VISUAL AIDS IN SCIENCE·MIDDLE SYNTHESIS UNITS
## BECAME TYPED TABLES (founder direction, starting from vi ch 4's shipwreck cards)

**What happened.** The founder flagged vi ch 4 "Exploring Magnets": the polished synthesis
unit's 'Shipwreck card content' visual aid was a 2.7k-character PROSE block whose content is
actually eight parallel RECORDS (card · question · expected reasoning). Direction: tabulate
it (columns Card | Question | Expected reasoning) and sweep the whole science·middle stage
for the same pattern. The sweep found the polish pass (2026-08-18) had left this class of
aid as prose across the stage — enumerable card/event/scene/stall/fault/observation sets
flattened into dense text. On screen that is a wall of words; **in DOCX it is objectively
broken** (export_docx renders prose by `\n\n` chunk and collapses single `\n` to a space, so
single-newline lists mash into run-on lines — the Ramnagar decision cards printed as one
paragraph in Word).

**The repair: `genon/repair_prose_tables.py` v1.0** (the declared-edit idiom of
repair_worksheet_split/repair_courier_table). **29 prose aids across 24 chapters became 32
typed tables** (+ companion prose for genuine scene-setting/facilitation text). Discipline
held throughout: content MOVED verbatim, never rewritten — record labels ('Card 1 –',
'Description:', 'Expected reasoning:') became rows/columns; one-line scene-setters became
parse_table leading-CAPTION rows; multi-sentence format notes became companion prose aids.
Each edit sha1-asserted against the installed text (artefact drift refuses the run); old
aids archived under `genon_canonical.repairs`; files backed up to `backup/prose_tables/`;
`purge_derived` run per chapter (no derived plans existed — free). Three flagged candidates
were deliberately LEFT prose (vi ch5 coverage notes, vi ch11 gap prompts, viii ch11
design-sheet questions — flowing narrative, not records).

**Title discipline that mattered:** teacher_notes/materials carry literal pointers
("see visual aid: 'Shipwreck card content'"), so the converted TABLE keeps the original
title exactly in every split; companions get derived titles. Where the pointed-at content
went multi-aid (vii ch12 keeper's log → 5 aids, viii ch06 weather notebook → 5, viii ch12
legend strip → 4), the referenced title stayed on the aid carrying the pointed-at content.

**Verified end-to-end:** view model builds clean for all 37 science·middle canonicals
(73 synthesis tables, uniform widths after parse_table); vi ch 4 exported to real PDF and
DOCX with every table cell present (DOCX uppercases header cells by design — probe
case-insensitively); suites test_science_port · test_lp_standard · test_render ·
test_phases · test_genon_serve · test_genon_plan_granularity all pass. NO code changed —
data only; the renderers already consumed typed tables everywhere. **Owed (unchanged from
2026-08-18): the Material-tab LIVE render + mobile pass** — now with materially more
tables on screen, the ~360 px table behaviour check matters more, not less.

**Same day, follow-up (founder): the INTEGRATED (lesson plan + assessment) PDF was the
one renderer left unformatted.** `export_integrated_pdf.py` OWNS a consolidated
stylesheet (its own docstring warns: "If the lesson-plan or assessment styling changes,
re-check the mirrored rules here") — and it had drifted twice: (a) the 2026-08-18 polish
added the `.va-*` family (typed prepared tables/prose) to `_period_block` +
export_lesson_pdf's CSS but NEVER mirrored it here, so integrated PDFs printed every
prepared table/card as bare unstyled default-font text; (b) the assessment exporter had
since grown `.q`, `.qm-rk`, `.qm-rv`, `.stim-tbl-cap`, `.stim-tbl-src`, also absent. Fix:
mirrored all of them in (+ `G_EDGE` import). **Lesson for next time:** the consolidated
stylesheet is a MIRROR with no parity check — the verification harness that caught the
full extent was a class diff (regex `class="…"` out of the rendered HTML vs `.class`
selectors in `_css()`); worth re-running whenever either fragment exporter's CSS moves.
Also learned: verifying exports MUST replicate the API's assembly (`link_context` +
`carriers.from_engine_items`) — calling `assessment_to_view` bare leaves every
`anchor_period` None and all items fall to the defensive "Further assessment" tail,
which looks like a placement bug but is only a harness artefact. Verified through the
API-identical path across all 37 chapters: every class styled, every item anchored
(2026-08-05 last-unit rule), zero leftovers, 37 valid PDFs; test_api (fastapi installed
in-sandbox) + test_render + test_science_port + test_lp_standard pass.

---

## 2026-08-17/18 — S6 · SCIENCE·MIDDLE BATCH-RELEASED, AND THE STAGE'S
## ONE STRUCTURAL EXCEPTION EARNED A DESIGN CORRECTION READ OUT OF ITS OWN SERVES

**The stage is released**: W1·W2·F1·F2 all pass, **₹2,395.71 / 236 metered runs all-in**
(pilot ₹151.65 · 36 standards ₹600.05 · 114 compacts ₹1,529.19 · 43 synthesis re-authors
₹79.75 · 38 polish runs ₹35.06). 154 canonicals + 37 re-authored-and-polished synthesis
units, every X in every band servable, zero register hits, zero canonicals re-bought —
every repair across the stage was a free declared edit. Tracker rows and rulings:
`docs/testing_tracker.html` BATCH RELEASE tab, science·middle (the fullest single record).

**THE HEADLINE FINDING — the K+1 synthesis borrow was pedagogically wrong, and only
READING found it.** Certification was ALL PASS when the F1 full enumeration (all 114 K+1
serves — this stage has NO self-fills and NO content borrows; every seam is the top's
synthesis appended to a complete compact) returned **10 CLEAN · 57 MATERIAL · 44 MILD ·
3 JUMPY**. Two families, one root: the top's synthesis was authored against the top's own
arc by a brief that never knew compacts existed. (a) **Double capstone** — every compact
correctly closes its own arc, so K+1 served two chapter-closings on consecutive days,
half the corpus repeating the same signature device (the Gandhian quote read aloud twice,
the shell question re-answered, "Happy investigating!" twice). (b) **Intersection
violations** — the synthesis demanded skills a compact never taught (distance-time graphs
vs p08/p10; the §13.6 response framework vs p06), a family certification is structurally
blind to on a stage with no section registry. **The founder's correction is the entry's
biggest lesson**: the first design (a per-chapter CODA asset with its own serve mode,
fallback and staleness gate — built, engine-verified) was **struck within the hour**
because it gave one stage of eleven its own algorithm and a maintenance surface forever.
v1.3 instead RE-AUTHORS THE TOP'S SYNTHESIS IN PLACE against the whole library
(`genon/resynth.py`, `--wave resynth`, ~₹2/run): serve law byte-identical, nothing new to
maintain, residual lightness confined to the top's identity serve. Spec:
`docs/science_middle_stage_serve.md` §6 (v1.3; §6.2 records the struck design and why).

**EVIDENCE-FED-FORWARD BRIEFS, proven three rungs deep.** The first resynth killed both
acid-test jumps but the read found 4 NEW ones — the model checks compacts in aggregate
and misses the floor, and once INVENTED untaught content (viii ch 4's parallel-circuit
reasoning: taught by NO plan in the chapter, the standard included). Two generic brief
lines fixed 3 of 4 ("the SHORTEST plan's map is the binding one"; "the setting is new,
its physics is entirely the chapter's"). vi ch 12 missed TWICE more — the general
instruction cannot tell the model what "Beyond Earth" cut from an 8-unit plan — and
landed only when the read's findings were fed into the brief VERBATIM as a per-chapter
EXCLUSIONS note (craters, Pleiades/Krittika, Mars-by-colour, named). The pattern is now
mechanism: `resynth.EXCLUSIONS` + `resynth.POLISH_NOTES`, read-derived, never guessed.
**The reading is part of the authoring loop, not a gate after it.**

**THE POLISH PASS + LICENSED GAP-FILL (a doctrine change).** Founder flagged 259-word
mean teacher notes (constitution: 2–3 sentences; corpus norm 79w) — the resynth brief
had given card text and table designs nowhere else to live. One ₹1/run pass per unit
moved prepared content into **typed `visual_aids`** ({table|prose, title, payload};
tables pre-split through `normalize.parse_table` at the PORT — one splitter, every
renderer), condensed notes to ≤3 sentences with "(see material)" pointers, and rendered
across screen (`MaterialPanel`), PDF and DOCX with content-weighted column widths
(xhtml2pdf collapses empty columns and cannot wrap mid-word — widths must be computed;
verified by rendering the actual PDF and reading the page image). The fidelity read
found ZERO losses and 12 "inventions" that were really the model SPECIFYING content the
old plans told the teacher to prepare unspecified — **founder LICENSED the category**
(brief now permits filling unspecified teacher-prepared blanks with chapter-level
science; specified content is moved, never rewritten) with 5 read corrections
(ARV-D-177) and two template-style aids filled deterministically by hand-declared
arithmetic (ch 10's observation cards + evidence grid split for print; ch 8's courier
table computed against its own design note's constraints, avg 12.14 vs the promised 12).
Also: `pedagogical_approach` came back as 62-word essays into a 2-word label field —
37 read-derived labels declared (`repair_approach_labels.py`), brief + validator capped.

**TRAPS, new and repeated.** (1) **The duplicate-dict-key silent shadow struck TWICE in
one day** (repair_c3's filename-keyed DECLARED let maths·ix edits reach science files
AND let a second same-name key silently drop the first — re-keyed by (subject, grade);
then ARV-D-178 was shadowed the same way inside one grade's dict). A startup
duplicate-key assertion in the repair tools is OWED. The mandatory post-repair rescan is
what caught both. (2) **Collect's skip guard must be batch-aware**: `is_reauthored` is
always true after wave 3, so a --redo re-run's collect silently discarded paid results —
rescued only because batches keep 29 days; guard now compares the manifest's own
ledger_ts. (3) **parse_with_repair grew its second repair family** — the one-character
wrong-closer (`{"stage": 4)`) — after a complete ₹14 response sat unrecoverable;
`recover_from_raw.py` learned batch filenames. (4) The clock homonym recurred THREE
times (moonrise 50-minutes, eclipse totality ×2 — the polish re-phrased the same fact
back onto the pattern from a different surface); founder's standing ruling each time:
**repair the text, keep the scanner strict**. (5) `repair_register._get_set` grew a
`visual_aid:<i>` locator — new artefact surfaces need repair reach the day they exist.

**F2 in one line**: 155 files enumerated, 117 runs ≥12w, all laws/definitions/answer-key
facts except one 28-word book-phrased MCQ option — founder ruled rephrase (ARV-D-178);
third-party and attribution clean (fabricated settings throughout; WHO + Gandhian quote
attributed inline).

**CARRY-FORWARD to S7 (mathematics·middle, next Group B):** (a) run resynth + polish as
standard waves after W2 — the brief now carries every lesson above; (b) expect the
synthesis-note meta-leak family at W1 (8/36 here) and the OPEN_TASK null stem (~1.5% —
ARV-D-172/173/174; constitution-side fix only if S7 holds the rate); (c) the polish
brief should author split tables from the start (prose column + write-in grid never
merge on portrait A4) and watch the re-author's house style (6 of 13 viii vehicles were
coastal); (d) science·middle's Material-tab live render + mobile pass is STILL OWED
(statically verified only); (e) the repair-tool duplicate-key assertion.

---

## 2026-08-13 — S9 · ENGLISH·PREPARATORY STAGE PREP: A CONSTITUTION
## NAMED A DURATION THE PLATFORM DOES NOT USE, AND `_NOT_YET` IS NOW EMPTY

Full note: `genon/out/stage_prep_english_preparatory/STAGE_SIGNOFF_S9_english_preparatory.md`.
Landed pair: english·preparatory LP **v1.1 → v1.2** · assessment **v1.4 → v1.5**. Drawn class
**III**, pilot **ch 11 *The Big Laddoo*** (section B, poem, [12, 10, 7]). **The first stage in
the campaign to sign with every P-step closed — P5.4 included, so no amber at all.**

**1 · A1 IS NOT ONLY A QUESTION ABOUT THE ROW COUNT. IT IS A QUESTION ABOUT THE NUMBER.**
Ten stages read A1 as "replace *one or more rows* with one row" — a shape correction, and at
every one of them that was the whole of it. Preparatory needed that too, but its real defect was
that the number was wrong: INPUTS 3 said *"`period_duration_minutes` is 30 or 35 at prep (35
default)"*, Rule 2 STEP 1's ceiling table was written for 30- and 35-minute periods and named no
40, and the schema comment said `// 30 or 35`. `master_plan.json` carries english III, IV **and**
V at `standard_duration_minutes: 40`. A library authored under v1.1 would have run 12 × 35 = 420
minutes against the row's own `canonical_minutes: 480` — internally consistent, externally wrong,
and nothing in the pipeline compares the two. **It was live:** three of the four saved
preparatory plans carry MIXED durations *inside one plan* (iii ch 2 = 2×40 + 2×35 · iv ch 1 =
5×35 + 2×40 · v ch 1 = 3×35 + 2×40 + 1×30). **The carry-forward:** read every stage's A1 against
`master_plan.json`'s `standard_duration_minutes` for its classes, not only against the phrase
"one or more rows". A stage whose stated duration was never reconciled with the calibration
bands looks compliant while being wrong, because the sentence it fails is one nobody thought to
write. The cheap proof is the dry pre-flight's header line — ours now reads `12 × 40 min`.

**2 · THE PAIR AMENDMENT LEFT THREE COPIES BEHIND, AND EACH WAS FOUND A STAGE LATER.**
2026-08-12 moved three *assessment* constitutions to TWO items per cell. It did not move: the
three *LP* constitutions beside them (S10 struck middle's, S9 struck preparatory's, secondary's
is an open defect against a certified stage), **nor `genon/prompt_assembly.py`** — the english
prompt builder, which said "one item per cell" in two places, **both citing Rule 2 while
contradicting it**, and which is stage-agnostic so it said it to all three. S9's dry pre-flight
caught it by sweeping the *assembled prompt* for stale strings rather than by reading a
constitution, which is why two stages of P-prep had missed it. **It did not bite at S10** — its
library came in at 12 items across 6 cells, the model following the constitution over the builder
— and that is the argument for fixing it, not against: a coin-flip resolved favourably once, by a
model that (curly quotes) keeps a habit for a whole run or drops it for a whole run. Fixed free,
worded to defer to Rule 2 rather than restate a number. **Standing rule: after any cross-stage
amendment, sweep the ASSEMBLED PROMPT, not only the files that were edited.** The prompt is where
the constitution, its sibling and the builder finally meet, and it is free to read.

**3 · `carriers._NOT_YET` IS EMPTY — every subject·stage in the 11-stage matrix is carried.**
Row 7 for the third time; again no new code, again because a predecessor's note said what to
*confirm* rather than what to build. The one difference it flagged was real — **preparatory's
spine set is FIVE, not six** (`reading`, `oracy` with listening and speaking merged, `writing`,
`word_work`, `beyond_text`) — and it cost nothing precisely because **no part of the carrier
reads a spine NAME**: `cell_resolver` joins whatever `spines_taught[]` holds against whatever
`source_spine` holds. A carrier that had hard-coded the six middle keys would have passed S11 and
S10 and failed every chapter of this stage; that is now a test rather than a comment.
**The table is KEPT though empty**, with the reason written above it: an empty `_NOT_YET` is not
a dead switch but the pre-flight that makes `carrier_gap()` free, and the next subject·stage
brought into genon belongs in it *before* it is authored, not after it is paid for. Three tests
that only existed because a stage was owed were **kept alive against the empty table by a
synthetic entry** rather than deleted — the refusal machinery, the stage/row reporting contract,
and the conservative gradeless read. Deleting them would have retired the pre-flight silently.
`tests/test_genon_carriers.py` 122 (6 failing) → **131, green**.

**4 · Two class-V chapter summaries are UNPARSEABLE JSON** (ARV-D-143) — unescaped straight
double quotes inside a string value, in *authored content*, which is the 2026-08-11 curly-quote
hazard on the side of the pipe no constitution governs. Neither chapter can be read by anything.
Nothing has ever asserted that every chapter summary parses; a corpus-wide `json.load()` belongs
in the certifier's free checks.

**5 · Smaller, worth carrying.** Preparatory's `task_brief` had **no word cap at all** against a
Rule 9 that mandates a page locator — a hole, not a licence, and the kind that only shows when
you measure the corpus *with the mandate simulated* (14 of 29 briefs go over 12 once the locator
is costed at +4 words; 0 over 16). **55% of preparatory's 167 cells carry a MERGED
`section_name`**, the longest 28 words — where middle's figure was 17% — so S10's "which
subheading" clause is this stage's ordinary operating condition, not a tail risk.

---

## 2026-08-13 — CERTIFICATION COULD NOT SEE WHAT IT WAS BUILT FROM.
## C5 CHECK 11, AND THE PILOT IT CAUGHT

**The hole, stated exactly.** Every section check in `certify()` measures the library
against the section registry, and the registry is DERIVED from the top canonical. So a
section the chapter has and the top canonical never named is invisible to all of them:
check 3 (anchors verbatim) passes because no unit anchors it, check 4 (first-visit order)
passes because it is not in the walk, check 5 (coverage reaches the final registry
section) passes because the registry it is measured against is the short one. The compacts
then inherit the omission through their briefs, which `variant_plans.briefs_for` builds
from that same registry. **The check cannot see what it is built from** — it was written
down as batch-runbook trap 5 with the remedy "compare by eye", and by-eye does not survive
a 926-run corpus.

**It was live, on a certified pilot.** `science·ix ch 8` — the S3 pilot chapter, ALL PASS,
human-gated — has **no unit in any canonical anchoring `8.5 Atomic Number`**, a top-level
numbered section its summary carries in full. Found in the first minute the check existed,
on a stage that had been through the whole cycle.

**AND THE SAME SWEEP'S OTHER TWO HITS WERE WRONG, which is the more useful lesson.** TWAU
`iii ch 1` and `iii ch 9` were reported as omitting `Let us reflect`. They do not.
`section_registry` SKIPS the synthesis unit deliberately — it is the one unit whose only
prior is full coverage, so it must never enter first-visit arithmetic — and the 2026-08-10
note argued that skipping the unit and filtering its one anchor "are the same operation".
**On a mediated-anchor stage they are not.** There the anchor is whatever the period fields
yielded, and a census of every installed canonical shows it is a REAL section on **all**
TWAU, mathematics and english tops (`Let us reflect`, `S1 / S2 / … / S8`,
`A|reading_for_comprehension / A|beyond_text`) and the reserved token only on the
token-carrying stages. Both TWAU chapters anchor `Let us reflect` on their closing unit and
teach its tasks in full — ch 1's word-search, drawing and writing prompts, ch 9's weekly
health table and 24-hour day circle, all verifiably present in the unit. So `reconcile()`
now takes the standard's closing anchors as a third object and reports anything reached
only that way on its own line, gating nothing. science·ix ch 8 is untouched: its synthesis
unit carries the token, and the token is excluded from the allowance precisely so it cannot
launder a real omission. **Generalisable:** a check built on the registry inherits every
deliberate exclusion the registry makes, and the exclusions are only safe for the arithmetic
they were reasoned about.

**The fix: `genon/summary_sections.py` + C5 check 11** (testing.md 2.10; §9 treats it as a
certifier change — free, `--certify-only`, no rupees). Design notes worth keeping:

- **Asymmetric, like the handoff/anchor check.** A summary section no unit anchors GATES;
  a registry entry the summary does not name is ADVISORY (SS quite properly names an
  unlabelled opening — "Introduction to the Atmosphere" — and merges and renames are
  legitimate). Gating both directions would have failed good chapters immediately.
- **It does not quarantine, and its remedy is not a repair.** The library serves perfectly
  well; what is wrong is what it teaches. But unlike a register breach there is no
  `repair_*` for it — the fix is a re-author of the top AND its compacts (~₹37/run × the
  plan size), or an accepted-omission ruling at the human gate. It is the first defect
  family in the runbook's triage table that costs money.
- **It gates only where the summary DECLARES its sections** — JSON `sections[]` /
  `main_sections[]` (mathematics, TWAU, english — english's entries are the SPINE CELLS,
  since post-split a chapter is one main_section and a section-level list would reconcile
  1 against 6) and numbered headings (science). **social_sciences gets an ADVISORY
  shortlist instead**: its summaries are prose that declares sections differently in every
  chapter ("Title: This section explains…" in IX ch 3, "Plate Tectonics presents…" in IX
  ch 2, a bare heading paragraph in VIII ch 3 — each an independent generation), and every
  extractor tried recovered real sections AND sub-topics (Waterfall, Deltas, GLOFs under
  Running Water). A gate firing on those would be switched off in a week (runbook trap 4).
  **The real fix is upstream — a section list in the SS chapter-summary prompt's output —
  and it is NOT scheduled.** Until then SS is "compare by eye" reduced from a whole summary
  to one-to-seven leads, which is the honest thing to claim for it.
- **The bug that nearly shipped it silent.** The first draft gave `8.5` the parent `8`,
  matched ancestors by containment, and `"8"` is contained in `"8.1 Rediscovering…"` — so
  every section in the chapter was "covered by its ancestor" and the gate reported ALL PASS
  on the one library already proved defective by hand. A top-level ref has NO parent: its
  parent is the chapter, and a chapter is not a section anything can anchor. Refs are now
  matched by boundary, titles by containment. `tests/test_summary_sections.py` (16 green)
  locks exactly this.

**Corpus state after the sweep (2026-08-13, `--certify-only` over both batched stages).**
TWAU iii·iv·v: **33 chapters, ALL PASS, zero failures**; iii ch 1 and ch 9 carry the
closing-unit line. SS·IX: 9 chapters, **0 gating failures** (prose → advisory), 6 advisory
shortlists of 1–7 leads — `Secondary-Stage Social Science` (ch 1), `Assemblies during Vedic
Period` (ch 5), `Inside India's Election Machinery` (ch 7), `Economic Survey` (ch 8),
`Tariffs by hotels` (ch 9) are the ones that read like real sections rather than sub-topics
and are owed a ruling. Unrelated and pre-existing, surfaced by the same sweep: **SS·IX ch 1
and ch 5 p13 each carry 1 register ban hit** — `repair_register.py`, free.

**Owed, not done.** C8 (the X−1→X transition) and C14 (copyright) remain founder-run by
hand across the batched corpus; they are irreducibly judgement and no tooling was built for
them. The other batch-vetting gaps discussed the same day and deliberately NOT taken up: a
self-correction-marker regex (ARV-D-085, still a C5 tooling gap) and a copyright n-gram
shortlist against the textbook text.

**The BATCH RELEASE tab, same day (founder).** Those two owed steps now have somewhere to
live. A fifth tracker scope, `batch`, keyed like `combos`, four steps: **W1** (top canonicals:
collect + certify) · **W2** (compacts + the runbook's closing checklist) · **F1** (C8 across
the batch) · **F2** (C14 across the batch) — F for final. `api/testing_campaign.py` gained the
scope; the UI gained a tab, a renderer and a stat card. Two things the build surfaced that
were not the point of it:

1. **No stage carries a recorded human GATE.** All eleven have C1–C14 green and SIGN unset —
   which means the two stages already batch-authored were authored without one. Hence the tab's
   CYCLE column is THREE-state (✓ signed · ◐ C1–C14 pass, gate unrecorded · ⛔ C-steps
   outstanding): collapsing it to two would either read as an accusation or hide the gap.
2. **The rate is the deliverable.** The runbook said the founder "samples at a rate they
   choose"; F1/F2 now require the sample size and stratification to be written into the step's
   comment BEFORE the reading starts. Stratify by period-count band and take 100% of any chapter
   that needed a repair.

Prefilled from the run artefacts: **TWAU·preparatory W1 pass · W2 pass** (32 chapters, 93
canonicals, ₹1,212.90, 28 declared repairs, zero re-bought; re-certified 2026-08-13 ALL PASS
under check 11). **SS·secondary W1 pass · W2 GREEN the same day** — it opened amber on two
register ban hits and closed on one repair plus one founder ruling:

- **ch 05 REPAIRED, free** (`repair_register.py`, one declared deletion, 1 → 0 ban hits).
  `ch_05_canonical_p13.json` U13 `time_bands[3]` was **the model narrating its own brief into
  teacher-facing text** — "an integrative question that surveys the chapter's full arc *without
  claiming the chapter is complete*", i.e. the compact brief's self-containment instruction
  quoted back, tripping the completion pattern on the very words it uses to disclaim completion.
  A scanner cannot rule on that and a reader does in one look. **This is the SECOND subject in
  which a breach turned out to be the brief being paraphrased back** — mathematics·IX had one
  where the model paraphrased the brief's description of the synthesis unit. Two subjects, same
  shape: *a brief phrased as a prohibition hands the model a sentence to repeat.* That is an
  argument about the BRIEF, not about `register_scan.py`, and it is now logged in
  `repair_register.py`'s set header as a pattern to watch rather than a hit to repair forever.
- **ch 01 ACCEPTED, not fixed — founder ruling, ARV-D-157.** U13 `teacher_notes`, "Having
  covered all four disciplines…". The reasoning that always made it a judgement call is why the
  ruling went this way: U13 of 15 sits after all four discipline sections **in the standard**,
  where the sentence is simply TRUE; it is false only in a compact that drops a discipline, and
  a compact borrowing U13 borrows the note with it. The question was never "is this text wrong"
  but "is the completion ban about the TEXT or about the SERVE". **Consequence, to be repeated
  wherever this stage is called clean:** `--apply` still exits 1 on the surviving hit and ch 01's
  report still says FAILURES. SS·IX is **8 of 9 ALL PASS plus one accepted breach**, and must
  never be written as 9 of 9.

F1/F2 pending on both stages.

---

## ★ F1 RAN ON TWAU THE SAME DAY, AND THE SAMPLE TURNED OUT TO BE UNNECESSARY

**The founder's correction is the whole method.** F1 was specced as "sample the batch, record
the rate". Two objections, both right: (a) **only a GENUINELY BORROWED Xth unit is at risk** —
when the slot is filled from the plan being served (a self-fill, which the e14 SELF-FIRST
tie-break makes the common case) the borrowed unit's priors are that plan's own earlier units,
so there is no foreign prior and nothing to read; and (b) if the population is that small,
enumerate and read it in FULL rather than sampling. `serve.py` has carried
`slot_fill.self_fill` since e12 and **nothing was reading it**.

Measured over all 32 TWAU chapters, every X in [floor−2, top+2] — 325 serves:

| no borrow (identity · truncation · surrender) | 157 |
| **SELF-fill — nothing to read** | **138** |
| **cross-canonical borrow — read in full** | **30** |

30 rows collapse to **19 distinct borrowed units** (one synthesis unit met from several
prefixes), each read against its SHORTEST prefix — the hardest case. Enumerator:
`genon/borrowed_seams.py`. **No sample, no rate to defend, which is strictly better than a
defensible sample.** F1's step text in the tracker should be rewritten from sampling to
enumeration for every remaining stage.

**Result: one jumpy, and the founder closed it without a fix.** TWAU iv ch 1 at X=7 — the
class completes the p.16 community action table at the close of sitting 6 and does the same
table again at the open of the borrowed sitting 7. Not the "assumes what was never taught"
half of jumpy but the other half, repetition. **Ruled NO ACTION (founder, 2026-08-13):** the
only edit available is to strip the table out of p06's U6, and U6 is served at exactly two
counts — X=7 (fixed) and X=6, where it is the plan's LAST sitting and the p.16 table's only
appearance in that canonical. It fixes X=7 by unfixing X=6, and would orphan the unit's own
title. The founder's diagnosis is the durable one: **a synthesis unit that runs a specific
book activity can always collide with an earlier unit that ran it; a general synthesis cannot.
We never asked synthesis to carry a named activity — but we cannot stop the model doing it.**
Corollary the fix would not have reached anyway: the top canonical runs p.16's riddle task at
U9 and p.16's table at U10, so **X=10 served as plain identity has the same collision with no
borrowing involved at all.**

**The cross-cutting finding was the valuable one — and it is now fixed corpus-wide.**
See ARV-D-158/159/160. In one line: **the brief says "this unit must not assume another unit"
and the model writes the instruction down instead of obeying it**, in text the teacher reads:

> "This surfaces the full conceptual map of the chapter *without requiring any specific
> earlier activity to have occurred*."  — TWAU iv ch 2 U17, **band** text

Unlike the other three register bans this is not a FALSE claim; it is a true one addressed to
the wrong reader. She has never heard of a canonical or a slot fill, so all she can infer is
that another version of her lesson exists and she has not got it. **35 instances, four
subjects, 24 files, 17 chapters, 12 of them in band text** — all repaired by
`genon/repair_meta_leak.py` (declared old→new pairs, pure deletions but for five
capitalisations; corpus now scans **0**), and `register_scan.py` gained a fourth ban family so
the seven unauthored stages cannot reintroduce it. **The scanner outperformed the hand list
in both directions** — it found three the reading missed (including one in the STANDARD's
synthesis unit, the widest-read unit there is) and the post-apply re-scan found a fourth, a
second leak in a unit already repaired for a first. Sequence worth keeping: *read to find the
pattern, then scan to find its instances.*

**Two things the sandbox could not finish, and they are founder actions:** 8 derived plans
under `english/iii` could not be deleted (`Operation not permitted`), so ARV-D-034 applies —
they will serve pre-repair bytes until removed by hand; and the superseded
`backup/quarantine/mathematics/iii/*` copies likewise need deleting.

---

## 2026-08-12 — S-SS · SOCIAL_SCIENCES · SECONDARY (IX) SHIPPED IN ONE DAY,
## ₹488.76 — AND A COMPACT CAUGHT A DEFECT IN THE PLAN IT WAS AUTHORED FROM

**The stage.** 9 real chapters (ch 10–18 are NCERT placeholders with no summary/mapping and
were never eligible), 25 canonicals, 22 bought in two batch waves, ch 3 pre-installed from the
v2.0 pilot. **Wave 1** (8 standards, 108 periods) ₹193.23 · **wave 2** (14 compacts, 139
periods) ₹295.53 · **total ₹488.76**, against ~₹950 sync. Zero canonicals re-bought. Closed at
**7 of 9 ALL PASS** with two declared exceptions (below).

**Pricing: the runbook's curve is TWAU's, and it under-prices this stage by ~40%.** The
runbook fit (`out ≈ 1.2k + 1.435k × periods`) predicted ₹272 for the 22 runs; fitting SS·IX's
own 9 logged runs gives **`out ≈ 5.0k + 2.14k × periods`** — ~1.7× the output per period — and
predicted ₹450 against ₹488.76 actual. **Fit the curve per stage from its first three runs;
do not carry another stage's.**

**THE FINDING THAT MATTERS — the registry is derived from the standard, so the standard's
reading of the chapter is never independently tested** (runbook §4 trap 5, in the wild).
`ch_02_p09` and `ch_08_p04` were QUARANTINED for anchoring sections the registry did not
contain. Every one of those sections is a real heading in the chapter summary, and the
STANDARDS teach them and say so in their own unit titles — ch 2 U5 "Agents of Gradation AND
RUNNING WATER: Valley to Delta", ch 8 U5 "Planned AND MARKET Economies", ch 8 U4 "The Three
Key Questions — What, How, and For Whom to Produce" — while anchoring one section each.
**ch 8's registry held 6 of the chapter's 10 sections; MARKET ECONOMY, a whole section of an
economics chapter, was not in it.** Certification passed ch 8 on "every anchor verbatim in the
top registry" and "first-visit order follows the registry" because both compare the registry
to the anchors it was derived FROM.
- **p04's brief SHOWED it the 6-section registry** and said anchors MUST be drawn verbatim from
  that list. It named seven sections anyway, three absent from its brief, because it had read
  the summary. **The compact was right about the chapter and was quarantined for it.**
- **Cheap check, not yet built:** diff every canonical's anchor set against its siblings' and
  flag disagreement. That alone catches ch 2 and ch 8 automatically, free, before quarantine.
- **Second gap:** certification's only coverage check is "coverage reaches the FINAL registry
  section". A section in the middle can go unanchored and pass. Market Economy is section 9 of
  10 with Mixed Economy at 10 — had it been in the registry, p04's omission would have sailed
  through. **A total-coverage check is owed.**

**THE PARENT-FOR-CHILD ANCHOR PATTERN — 4 for 4 across two chapters.** Where a chapter has a
PARENT section with named children, this stage's model anchors the parent and teaches the
child (ch 2 top U5, ch 2 p07 U4, ch 8 top U4, ch 8 top U5, plus p04 U4). p07's instance only
became visible AFTER its standard was repaired and the registry grew — a repair can surface
the next defect, so re-certify after every anchor change. Nothing in the brief says a unit
teaching a sub-section must anchor the sub-section. **That is a brief-level gap, not nine
independent slips.**

**REGISTER: the clock ban carried two-thirds of the breach, in BOTH waves.** Wave 1: 9 clock /
2 forward / 2 calendar / 1 completion over 14 hits. Wave 2: 11 clock / 1 forward / 1 calendar
over 14 hits (recall wave 1 = 8 files, wave 2 = 14). Two independent waves, ~0.8 clock hits
per file both times — not variance, the brief. Every hit is the same sentence shape:
`"<group> for N minutes, then <share|compare>"`. The ban is stated; nothing tells the model how
to express intra-band pacing WITHOUT a quantity, and a model with teaching instincts fills that
silence. **Owed to the SS·secondary LP constitution, not to repair_register.py forever.**
- All 27 edits across both waves were **pure deletions**; the grouping ("individually", "in
  pairs") and the output ("then share") carry the pedagogy, never the number.
- **ch 8 p04 U1 independently reproduced the exact calendar breach struck from the ch 8
  STANDARD** ("things their parents bought this month"). Both authored free from the same
  summary, whose LET'S EXPLORE carries the window. The phrasing is the SOURCE's, surfacing
  twice — which strengthens the case (argued and recorded in repair_register.py, struck anyway
  on founder instruction) that "this week"/"this month" about a student's OWN LIFE should be
  demoted to advisory like "today"/"yesterday" already were.
- **THE MODEL NARRATES ITS OWN COMPLIANCE, AND BREACHES IN THE SAME SENTENCE.** Three
  instances: ch 1 U5 "previewing the four dedicated discipline sections WITHOUT NAMING UPCOMING
  UNITS"; ch 1 U13 "...connects back to the four-discipline structure without naming specific
  earlier units" (in a note opening "Having covered all four disciplines"); ch 5 p13 U13
  "surveys the chapter's full arc WITHOUT CLAIMING THE CHAPTER IS COMPLETE" — which made the
  scanner match inside its own negation. Constraint-compliance prose does not belong in
  teacher-facing text at all; a `repair_leaked_deliberation` sweep would catch the class.

**TWO DECLARED EXCEPTIONS — closed knowingly, not overlooked (founder, 2026-08-12).** Both are
family `completion`, one hit each, and each keeps its chapter off ALL PASS permanently since
the checker has no exception mechanism. Released at **7/9 ALL PASS**, so runbook §5 gate 4 is
NOT met as written and this entry is the record of why.
1. **ch_01_canonical.json U13** — "Having covered all four disciplines, this unit turns to…".
   TRUE in the 15-period standard (U6–U12 cover the four disciplines). False only where U13 is
   borrowed or served to a class that never had those units in that shape — and ch 1's compacts
   are 12 and 9 units against 9 sections, so the 9-period plan certainly does not spend four
   units on four disciplines. A five-word deletion would have fixed it.
2. **ch_05_canonical_p13.json U13** — a SCANNER FALSE POSITIVE: the pattern
   `the chapter is (now )?complete` fired inside "without claiming the chapter is complete".
   Per trap #4 the correct fix is at the scanner (negation guard) or as leaked deliberation,
   never by striking the text. **Neither was done.** The pattern will keep firing on any future
   canonical that declares this particular compliance.

**Closing state.** 25/25 canonicals on disk · quarantine cleared (both restored, both repaired
on the way back in) · registries ch 2 8→9 and ch 8 6→10 sections, every plan covering its full
registry · 2 register ban hits library-wide, both exceptions above · no derived plans on disk ·
serve sweeps clean across each band (ch 5: identity at 21/17/13, fill/rescue between, surrender
only above 21). Repairs declared in `repair_anchors.py` (8 edits) and `repair_register.py`
(27 edits); applied wave-1 sets retired to 3-tuple SUPERSEDED keys so the live keys stay
re-runnable. **Human gate not yet run** — the serve table, ch 5's synthesis unit in full, each
compact's ending, and the trap-5 eyeball on ch 1, 5, 6, 7, 9 (unproven, not clean — ch 2 and
ch 8 both failed exactly that check).

**Two operational traps met the hard way, both worth carrying:**
- `sorted(glob.glob('DRY_*top*.json'))[-1]` is ALPHABETICAL: it returned an old
  `the_world_around_us` payload when verifying social_sciences' constitution version, which
  would have "verified" a stale constitution and bought a wave against it. **Glob the subject
  and sort by mtime.** Same class as `--latest`-by-name.
- The runbook's example line is TWAU-flavoured (`the_world_around_us v iv iii --certify-only`)
  and got pasted verbatim against the wrong stage. Free and idempotent, so ₹0 — but read the
  first line of the output before trusting the last.

---

## 2026-08-12 — ENGLISH'S ASSESSMENT AXIS WAS CAPACITY-BOUNDED, AND THE
## RATIO WAS THE SMALLER HALF OF THE DEFECT

Founder observation: english·secondary carries too few assessment items — "just one per spine
per section, the lowest ratio of any subject/stage group" — and asked whether it can go to two.
It can, it now does at all three english stages, and the investigation found the *coverage*
problem underneath the ratio problem was the worse one. Full analysis:
`docs/english_secondary_item_density.md`. Amendment recorded as checklist item 23.

**THE MEASUREMENT.** Items ÷ units across the whole saved corpus: maths·prep 2.1–3.9 ·
SS 1.25–2.6 · science·middle 1.5–1.75 · science·sec 1.0 · TWAU 1.0 · maths middle/sec
0.93–1.08 · **english·secondary 0.35–0.60**. The certified english IX ch 7 canonical is
**17 units, 6 items**.

**THE ROOT CAUSE — the one structural difference, and it is not a tuning value.** Every other
subject's assessment axis SCALES WITH CONTENT: sections, competencies, LOs, goals, periods.
English's axis is the SPINE, and there are exactly six, fixed by NCF and never re-sequenced
(LP Rule 1). Since the 2026-07-01 chapter split an english chapter is ONE main_section, so the
(section × spine) grid collapsed from 3×6 to **1×6** and the item ceiling became

    item ceiling = spines present ≤ 6

at ANY period count. Assessment Rule 2 stated the flatness as a feature ("never a shorter
assessment"); the unstated corollary was that it is also never a longer one. **English was the
only subject whose item count is flat in plan length.** Worth carrying: when a count looks low,
ask what the count is *indexed by* before tuning the count.

**THE WORSE HALF — coverage, which the ratio hides.** Running the real resolver over the three
certified ch 7 plans: **only 6 of 17 units carried an Assess tab.** Units 1–7 — the entire
reading arc — had none. Reading for Comprehension is taught across 8 units, carries EIGHT
anchored tasks in the handoff and a compound `implied_lo` ("character motivation, theme, AND
authorial purpose"), and yielded ONE item anchored at the close. The substance was demonstrably
there; the constitution was collapsing it. **Doubling the items alone would NOT have fixed
this** — both items of a pair take the same cell, so both anchor at the same close: the ratio
would double and the coverage would not move. That is why the amendment has two halves.

**WHAT THE SISTER CONSTITUTIONS ALREADY DO** (the survey that shaped the fix): SS Rule 4 —
competency weight is "the sole architectural governor", EXACT counts per tier (Central 5 /
Substantive 3 / Present 2) with types prescribed BY SLOT, not chosen. Science·middle — floors by
stage POSITION, uncapped above. Science·secondary — per-section count, "a rich section MAY carry
more than one and MAY mix types", with an explicit anti-inflation guard. Maths·secondary — "a
two-LO section yields two items, typically at two different cognitive demands." **Common shape:
more than one item per anchor is normal, and the second is distinguished by DEMAND RUNG or TYPE,
never by being another one of the same.** English was the outlier in kind, not degree.

**THE AMENDMENT (founder chose: relax scoping · prescriptive slots · all three stages).**
Rule 2 → TWO items per contribution on a per-spine SLOT TABLE (secondary Reading =
MCQ/TRUE_FALSE/SCR + EXTRACT_ANALYSIS/ECR, which mirrors the textbook's OWN pairing of "Check
Your Understanding" with "Critical Reflection"); pair must differ on demand AND type, sole
exception Speaking/Writing (one permitted type each — they differ by mode/form). Rule 8A →
TWO-STAGE SCOPING, and a new Rule 8A added to middle + preparatory, which had none.

**THE CODE HALF — and the pleasant discovery that it was 90% already there.**
`subjects/english/subject.py :: cell_resolver` has carried N-TO-N POSITIONAL PAIRING since
2026-07-11 (M == N ⇒ one unit per item), shared by the display path and the genon carrier, with
a *synthetic* test guarding a shape the corpus never produced ("Rule 10 emits one item per
cell"). The amendment makes that shape real and generalises it: **new `_disperse()` cuts M units
into N contiguous blocks by largest-remainder** (the same arithmetic `master_plan.canonical_periods`
uses), item i takes block i, `stamp()` then anchors each at its own block's close. **M == N falls
out of the same arithmetic**, so the old behaviour is now one code path rather than two that
could drift. M < N and N == 1 (a TRUE span) keep the full set unchanged.

**Measured on the three real ch 7 plans, items duplicated into pairs:**

| plan | units | ratio | assessed units |
|---|---|---|---|
| canonical | 17 | 0.35 → **0.71** | 6 → **9** |
| p14 | 14 | 0.43 → **0.86** | 6 → **10** |
| p10 | 10 | 0.60 → **1.20** | 5 → **7** |

Coverage improves but does not reach 1:1 because most cells are single-unit (Listening, Writing,
Beyond each occupy one) — only Reading and Vocabulary/Grammar are long enough to disperse. **The
remaining gap is option C of the analysis doc and is NOT closed by this work:** raise the number
of CELLS upstream in LP Rule 10 (one contribution per section × spine × topic cluster, which is
what every other subject's handoff already does) rather than items per cell. That would need an
LP amendment and a regeneration of the certified canonicals; deliberately deferred.

**Tests.** `test_genon_carriers.py` +3: the PAIR disperses over M > N (asserted BOTH pre-stamp
blocks and post-stamp anchors), a TRUE span still keeps the union, more items than units keeps
the shared set. The existing N-to-N test is retained and re-documented as the M == N case.
`test_link_resolver`'s corpus sweep still reports **2017 items / 149 saved plans / 0 orphans**.
**Trap worth remembering:** `unit_ref` on a carrier item is POST-stamp (always one number) — two
of the new tests were first written against the pre-stamp span and failed for that reason alone.
Assert spans through `cell_resolver` directly, anchors through `assessment_items`.

**Suite state:** 16/21 green. Five failures are PRE-EXISTING and unrelated to this work —
`test_api` + `test_link_resolver` reference saved plans that no longer exist on disk
(`data/content/saved_plans/english/iv/` is now empty), and `test_genon_plan_key` /
`test_normalized_item` / `test_unit_order` fail on SS + TWAU artefacts from today's batch runs.
None touch the english path.

**STATIC + unit-verified only.** No live generation has ever run under any of the three amended
constitutions, and the three certified english ch 7 canonicals are all pre-amendment 6-item
files — they must be regenerated before the pair is visible to a teacher. Live + mobile render
check of a paired assessment (two items under one unit's ASSESS tab, pine pager active) pending.

## 2026-08-12 — S11 · ENGLISH·SECONDARY STAGE PREP: the family helper was
## the WRONG thing to delegate to, and delegating to it would have looked right.

**Landed:** LP **v1.1 → v1.2** · assessment **v1.3 → v1.4** · carrier row 7 open ·
`_NOT_YET` down to english's two remaining stages. Class IX (already drawn), pilot **ch 7
*Vitamin-M*** (1 main_section · 6 spines · 23 tasks · rec 17 · floor 10 · counts
[17, 14, 10]). Full note:
`genon/out/stage_prep_english_secondary/STAGE_SIGNOFF_S11_english_secondary.md`.
P1–P5.5 complete and **P5.4 closed the same day** (9A · 9D · 9F, kumar3 at [50, 60]), so S11
enters its C-cycle with a **clean P5 and no gate** — the fourth stage to do so.

**THE REUSABLE LESSON — "delegation" is a claim about CODE, not about vocabulary.** P5.5's
doctrine says a stage's carrier work delegates what the plugin already does. English is the
period-field family, so `items_by_period_field` is the obvious call, and S7 and S8 both made
it. Here it is wrong twice, and **the first way would have passed every test this campaign
runs**: the helper takes ONE code, english's key is a PAIR (`source_section_id` +
`source_spine`), and passing the spine alone produces correct anchors on the whole certified
class — because every english IX chapter is ONE main_section post-split — and fails only on
the multi-section chapters S9 and S10 are full of. The second way is quieter still: the helper
anchors every item of a group at the group's last unit, which silently undoes the N-to-N
pairing the DISPLAY path has carried since 2026-07-11 (two items of one cell taught over two
units belong one per unit). So the delegation was made literal — the join, the pairing and the
fallback were lifted out of `assessment_to_view` into `english/subject.py::cell_resolver` and
**both paths call it**. Genon contributes only the anchoring RULE, via a new
`carriers.items_with_units`. **The generalizable form: if the "delegation" is a call to a
shared helper rather than a call to the plugin's own code, check whether the helper's
CONTRACT is the plugin's rule — same family is not same join.**

**THE CORPUS DECIDED THE CONSTITUTION AGAIN — third stage running (S7, S8, now S11).** Rule 2
STEP 3 let a short plan stop and leave later spines unanchored, and `backup/saved_plans/
english/ix/ch_12_*.json` does exactly that at 4 periods: **no `beyond_text` contribution at
all**. Under v2.0 that makes a chapter's compacts a *different chapter* from its standard —
they carry a shorter registry, and the Xth-unit choice set borrows "the unit that FIRST deals
the next-due section", which cannot exist for a cell the compact never taught. Amended to
FULL SPINE COVERAGE at every count, curation pushed down to TASK level where Rule 3 already
lives. The arithmetic it introduces was swept before it was accepted: a six-spine chapter needs
≥4 periods (VocGram alone + five spines at ≤2 adjacent), and **exactly one chapter in the class
binds — ch 12, floor 3** → P5.1 override to 4, owed at pre-warm, not now. Three more numeric
edits came off the same measurement: `task_brief` ≤12 → ≤18 (17 of 28 real briefs breach 12,
because Rule 9's mandated page locator eats 3–4 words of it), `section_context` 10–15 → 10–18,
and a 50-minute line in a task budget that named 40 and 60 but **not the class standard the
stage authors at**.

**ENGLISH'S SECTION AXIS IS NOT A SECTION — it is the (section × spine) CELL** (P5.2, the step
testing.md wrote english's name into). Post-split every chapter is one `main_section`, so
`section_id` is a constant and looks like no axis; what varies, in strict never-re-sequenced
on-page order, is the spine. The token is `"<section_id>|<spine>"` — `A|reading_for_comprehension`,
joined `A|listening / A|speaking` — both halves authored closed vocabulary, so the registry is
stable across a chapter's canonicals by construction. **Two orders now coexist and must not be
compared:** walking/registry order is the summary's on-page order; the handoff is keyed in
canonical enumeration order. Rule 2 STEP 3 has always said they are independent; a C5 check that
conflates them will fail a good plan. Consequence for C8: **six registry members against
seventeen units is the thinnest ratio in the campaign.**

**Three platform items landed with the stage, none of them stage-specific.** (a)
`carriers.group_key` — containers were keyed on `section_code` with a fallback to the LIST
INDEX; english keys `spine_code`, and a positional key is safe only until a unit and its item
are BORROWED from a canonical that grouped differently. (b) `_ENGLISH_SPINE_CELL` — a THIRD
handoff shape (spine-keyed dict of `section_contributions[]`) that fell through
`to_engine_handoff` unfiltered, so a served 8-unit plan would have carried the 17-unit
canonical's whole coverage. Same defect as S7's `_MATHS_GOAL_CLUSTER`, third shape, same seam;
one deliberate difference — an empty spine is DROPPED where an empty goal cluster is kept,
because assessment Rule 1 omits a spine with zero contributions. (c) The
synthesis-reads-as-Synthesis probe's docstring had said "English has no genon carrier yet; when
it lands, decide which shape it is" — it is a section-grouped port, so its closer would have
read "Listening + Writing". **A note that names the decision its successor must make is worth
what S7's was to S8; this is the second time one paid off.**

**One quieter catch that P3 does not announce.** The english plugin read `p["phases"]` only.
Converting the constitution to `time_bands` without touching the plugin would have rendered the
ENTIRE existing english corpus — all three stages — with no timed spine the moment a new plan
arrived. `_bands` (both keys, newest first) landed with the conversion, as mathematics carries
it. **P3's exit criterion is about the constitution and says nothing about the reader; check the
plugin every time.**

`tests/test_genon_carriers.py` 97 with 8 failures → **113, green** (the eight were the "english
is a declared-field stage / english is still owed" assertions this step invalidates).

---

## 2026-08-11 — A CONSTITUTION MANDATED A JSON-BREAKING FORMAT, AND THE
## PIPELINE'S REPAIR BOUND WAS AN ORDER OF MAGNITUDE TOO SMALL. Both fixed; ₹40.72
## recovered rather than re-spent.

**What happened.** Five LP constitutions mandate band/phase narration as
`book_ref ("brief....")`. A plan is emitted as JSON, whose strings are delimited by `"`,
so that inner pair must be written `\"` — and nothing enforces it. maths III ch 5 proved
on two consecutive calls that this is a **whole-run mode, not a scatter**: the standard
canonical escaped all 45 of its pairs and parsed clean; the 11-period compact escaped
**none** of its 42 and died. `generate_canonical`'s auto-repair was bounded at **10**
(set when the glitch looked like a rare 4-quote slip in July), so it fixed ten, gave up,
and reported the uninformative *"output is not valid JSON"* — naming neither cause nor
count, while the ledger quietly held the real evidence (*"auto-repaired 10 naked
quotes"*). ₹40.72 spent, no file.

**Three fixes, in increasing order of how much they matter.**

1. **Bound 10 → 500**, sized against the corpus rather than the incident: worst observed
   45 pairs, largest canonical anywhere 25 units ≈ 125 pairs at ~5 bands/unit.
2. **`genon/recover_from_raw.py`** — the raw output is written to disk BEFORE parsing
   (`generate_canonical:457`), so a run that streams to completion has already bought
   everything it needs. There was no way to use it: the only path back was `--redo`,
   paying twice for output already in hand. The script re-parses, validates and installs
   with **no API call**. ch 5's compact came back for ₹0, 42 repairs, validator clean.
3. **The constitutions changed so the mistake cannot be made** — Format and Example lines
   now show CURLY marks (“ ”), which have no meaning in JSON and need no escaping.
   Straight single quotes would be equally safe but collide with apostrophes, which this
   content is full of. Worded as a **licence, not a switch** ("the straight form remains
   valid and is not a defect"), which is what keeps it relaxation-only under §9 and stops
   two authored libraries re-opening.

**THE LESSONS, and the first is the one to carry.**

- **Prefer removing a failure mode to repairing it.** The bound fix catches the mistake
  after the fact with a heuristic that has its own magic numbers (`MAX_REPAIR_SPAN = 300`,
  unaudited, the same species as the 10). Changing the quote character makes the mistake
  *unmakeable*. When both are available, the second is worth a constitution amendment.
- **A constitution can mandate something the serialization cannot carry.** Nothing in the
  P-step checklist asks whether a mandated FORMAT is safe in the output encoding. It
  should: at P1, read every `Format:`/`Example:` line and ask what it becomes inside JSON.
- **An error message that omits the count hides the cause.** "Not valid JSON" sent the
  first diagnosis toward truncation (25,922 output tokens looked suspiciously close to the
  standard's 26,023); it was nothing of the kind — `max_tokens` is 64,000 and the file was
  complete, closing braces and all. The ledger had the answer the whole time.
- **Two copies of a heuristic are one bug waiting.** The first draft of `recover_from_raw`
  hand-copied the repair loop with a comment claiming it was "byte-identical" — a promise
  a copy cannot keep, and the same shape as the defect being fixed. `parse_with_repair` is
  now one extracted function both paths call. This matters most for the deferred **batch
  mode**: an inline block invites a third copy carrying the original bug back in.
- **Check whether the thing you are "fixing for the future" exists yet.** Asked whether
  batch runs are now safe, the honest answer was that batch mode is *not written*
  (`generate_canonical`'s docstring defers it to the mass pre-warm sweep), so the fix
  covers today's single-chapter path and will only reach batch if batch calls the shared
  parser. Stated as a condition, not a guarantee.

---

## 2026-08-11 — S8 · MATHS·PREPARATORY STAGE PREP: the cheapest prep of the
## campaign, because S7 left a good note. And a numeric cap measured BEFORE it is paid for.

**Landed:** LP **v1.1 → v1.3** (v1.2 the carry-forward, v1.3 the Rules 1–2 alignment) ·
assessment **v1.2 → v1.3** · carrier row 5 open ·
`_NOT_YET` down to english alone. Class III (already drawn), pilot **ch 5 *Fun with Shapes***
(8 sections · rec 14 · floor 8 · counts [14, 11, 8]). Full note:
`genon/out/stage_prep_mathematics_preparatory/STAGE_SIGNOFF_S8_mathematics_preparatory.md`.
P1–P5.5 complete, **no gate carried into C1**; P5.4 amber by design (needs the live app,
C6 is its hard stop).

**The reusable lesson is about S7, not S8.** S7 wrote both halves of the seam preparatory
would need — `items_by_period_field` and `genon_unit_anchor`'s prep branch — and then
deliberately did NOT wire them up, leaving instead a comment saying *"Treat this branch as
unexercised until S8 certifies it"* and a `CarrierNotImplemented` message naming this stage's
row, field and owing stage. A session later that turned P5.5 from an investigation into three
lines of delegation plus a deletion. **The pattern to keep: when you find yourself writing
code a later stage will need, write it, refuse to use it, and say in the refusal exactly what
the later stage must check.** It costs nothing and it is the difference between S4's carrier
surprise and this one.

**Mathematics is now carried at all three stages** (secondary row 6 · middle row 4 ·
preparatory row 5). Middle and preparatory share a container shape and are separated ONLY by
item vocabulary — `goal` vs `intent` — never by `stage_for(grade)`, which is `None` on the
very call the carrier makes. Both fields are now load-bearing in both directions, and the
neither-field case still refuses rather than guessing. Verified on the real prototype-era
saved plan (`backup/saved_plans/mathematics/iii/ch_06_*.json`): 26 items, **zero orphans**,
every anchor equal to the independently computed "last period that lists this section".
`tests/test_genon_carriers.py` 82 (4 failing — all S7-era "preparatory is still owed"
assertions) → **92, green**.

**THE FINDING WORTH CARRYING FORWARD — and I got it wrong first, which is the useful part.**
testing.md's standing lesson says a limit stated as a number is what live generation most
often breaks; S7 proved it at LP v3.6 and paid a full re-author. Preparatory carried the same
cap (Rule 2: a heavy section may split across **two adjacent periods**), so I measured the
whole class at P-prep: **4 of 14 chapters cannot satisfy it at their top canonical** (ch 3, 8,
10, 13), while the pilot dodges it (ch 5: 13 body vs cap 16). **I then recommended leaving it
alone** — the pilot doesn't exercise it, and prep sections are "small and task-dense" in a way
middle's are not. The founder challenged it in four words and the data broke all of it:

- **The arithmetic case is not the only failure case, and I tested only that.** The real prep
  corpus ALREADY exceeds the cap *with slack in hand* — `backup/saved_plans/mathematics/iv/
  ch_08_*.json` runs section S5 across periods **6, 7 and 8** on 9 body units against a cap of
  12. Nothing forced it; the content did. The cap breaks whenever a heavy section warrants a
  third period, which is a property of the SECTION, not of the budget. So the pilot dodging
  the arithmetic bought nothing at all, and the sweep I was proud of was the wrong sweep.
- **My pedagogical premise held for the median and failed at the tail.** Class III's 98
  sections: median 3 tasks, mean 4.2 — but max 13 and nine sections above eight. Those are
  exactly the sections a two-period cap mis-sizes. I argued from the sections that were never
  the problem.
- **Preparatory had become the sole outlier in the maths family** and I did not check.
  Secondary never had the cap; middle's went at v3.6. S7's own changelog names the tell — *"the
  only one of the three that named a number"* — and after v3.6 it pointed here.
- **Rule 1's cap was never a risk, it was a certainty.** The brief mandates a closing
  whole-chapter synthesis unit; "one or at most two adjacent sections" cannot describe one.
  S7 met exactly this at C3 (ARV-D-094). Knowing that and authoring anyway pays twice.

**Amended at LP v1.3, cost zero** (§9 full sense — two relaxations, three new obligations — but
no library exists). **The generalizable rules, both earned here:**

1. **At P-prep, check every stated number against the corpus AND the arithmetic.** A sweep over
   `sections × canonical_plan.counts` finds the chapters where a cap is *impossible*; only a
   real saved plan finds the chapters where it is merely *wrong*. The second is the larger set
   and it is the one that decided this.
2. **When a number comes out, GREP THE NUMBER, NOT THE RULE.** Removing the cap from Rule 1
   left it standing in three other places — the DESIGN PRINCIPLE, a stale cross-reference in
   Rule 2A ("Before bin-packing"), and worst, **the schema comment** (`// 1–2, e.g. ["S3"]`),
   which is the surface the model actually copies from. S7's v3.7 hit the identical schema
   residue in middle. Two stages, same miss.
3. **Port a stage's END STATE, not the text at the moment it changed.** Middle's v3.6 removed
   the cap and introduced a SURPLUS bullet; v3.8 deleted that bullet as the cause of the
   hoarding it tried to cure. Porting v3.6 verbatim would have imported a clause its own stage
   had already retired. Guards assert it never arrived — as they assert no `section_goal` was
   invented for a stage that has no per-period goal.

**Two smaller things, both worth a line.** (a) An amendment to one stage silently damaged
another: S7's `apply_s7_distractors_only.py` rewrote the FIRST of two lines of the
`what_each_option_reveals` example in the *preparatory* file and left the second, leaving
`{"A", "C", "C", "D"}` — four keys, "B" missing — contradicting its own prose for a day. **A
cross-stage edit needs the same exactly-one-occurrence guards as an in-stage one**, and the
prep file had no CHANGELOG to notice it in. (b) Both preparatory footers were stale (the
assessment one by two bumps), which is the third stage running where the footer drifted from
the header — worth a one-line assertion in every future edit script.

---

## 2026-08-08 — TWO STACKED STICKIES ARE NOT ONE FROZEN BAR, AND `sticky` DOES NOT
## WORK ON A DIRECT CHILD OF <body> IN A HOME-SCREEN iOS WEB APP. Top chrome is now one
## FIXED bar + spacer.

**Symptom (founder, on an iPhone with Aruvi saved to the home screen — i.e. a standalone
web app, not a Safari tab):** the top row carrying the Aruvi logo was not on screen at rest
and only surfaced on scrolling. Second report sharpened it: *"it is as if the top row alone
is not frozen while frozen headings stay"* — the My Classes / My Lessons tab row and the
inner `--nav-h` stickies (`.dash-hd`, `.lv-stick`, `.mlp2-frozen`) all held their position;
only the brand row did not.

**Cause.** The top chrome was **two independent sticky siblings**: `.hdr` at `top: 0` and
`.main-tabs` at `top: var(--hdr-h)`. That arrangement only *looks* like one frozen bar — the
two rows are separately stuck, and it has two failure modes we hit at once:
1. `--hdr-h` is measured by JS on mount. Until that effect runs (or if fonts land late and
   change the brand row's height), `.main-tabs` sticks at its **fallback 72px** — a number
   that has no relationship to the real header. On a slow phone the first scroll can beat the
   measurement.
2. Nothing structurally ties the two rows together. Whatever made `.hdr` fail to stick on the
   standalone webview left `.main-tabs` happily stuck 72px down, so the tab row visually
   *replaced* the brand row instead of sitting under it — exactly the reported picture.

Compounding it, a standalone iOS web app **restores its previous scroll position on relaunch**,
so the app could come up mid-page with the brand row already scrolled past.

**Fix (the general lesson).** *If two rows must move as one, make ONE element sticky and put
both rows inside it.* Never stack stickies whose offsets depend on a JS-measured height —
a measurement in the freeze path is a race, and the fallback is a magic number that will be
wrong at some breakpoint. Concretely:
- New `<div className="topbar">` in `page.jsx` wraps `<header className="hdr">` +
  `<nav className="tabs main-tabs">`. `.topbar` is the ONLY sticky element (`top: 0`, z-index 6,
  `--paper` background); `.hdr` and `.main-tabs` are now **static** — their `position: sticky`
  and `top` declarations are gone from `globals.css`.
- `env(safe-area-inset-top)` padding moved onto `.topbar` (counted once, and it is part of the
  frozen bar rather than something that scrolls out from under the notch).
- `--nav-h` / `--hdr-h` are still published for the INNER stickies, but are now measured
  **relative to `.topbar`'s top edge** (`--nav-h` = the bar's full height; `--hdr-h` =
  `.hdr`'s bottom minus the bar's top, which is what AskAruvi's `.aa-scrim` hangs off) and a
  **ResizeObserver** on `.topbar` re-publishes them, so late fonts or a changing status-bar
  inset can't leave stale offsets. The old code summed two `getBoundingClientRect().height`s
  and would have silently double-counted or dropped the safe-area inset.
- `history.scrollRestoration = 'manual'` in `layout.jsx`'s pre-paint script — we own the entry
  point; a relaunched home-screen app opens at the top.

**Also fixed in the same pass, a genuinely separate bug on the LOGIN screen:**
`.login-wrap` was `display:flex; align-items:center`. When the flex child is TALLER than the
box, `align-items:center` pushes the child's top into **negative overflow — unreachable by
normal scrolling**, visible only for the instant an iOS rubber-band overscroll drags it in.
The login card (brand + kicker + question + prose + field + button + note) is taller than a
phone's visual viewport, so the Aruvi logo row was exactly that clipped strip. Now top-aligned
by default, centred only `@media (min-height: 780px)`, on `100dvh` with safe-area padding.
**Standing rule: vertical centring is a nice-to-have, never a clipper — guard every
`align-items: center` full-height wrapper with a min-height query or `safe center`.**
Login autofocus is now desktop-only (`min-width: 601px`): focusing an input on load makes a
phone scroll it into view and shove the brand off the top before the teacher touches anything.

**ROUND 2, same day — the wrapper had to go from `sticky` to `fixed`.** With one sticky
wrapper in place the founder reported the bar *still* left the screen: it hid on dragging up
(going down the page) and reappeared on dragging back to the top — i.e. it was behaving as
**ordinary in-flow content**, not as a stuck element. Read literally, `position: sticky` was
**not taking effect at all** for this element on that webview, while the inner stickies inside
`<main>` (`.dash-hd`, `.lv-stick`, `.mlp2-frozen` at `top: var(--nav-h)`) kept working. The
distinguishing feature is depth: the failing element is a **direct child of `<body>`**, the
working ones are nested inside `.bodycontent > main`. **Carry-forward rule: do not rely on
`position: sticky` for a direct child of `<body>` — WebKit in a standalone home-screen web app
does not honour it. Use `position: fixed` plus an explicit in-flow spacer for top chrome.**
`.topbar` is now `position: fixed; top/left/right: 0`, with `.topbar-spacer`
(`height: var(--nav-h, 118px)`, 108px fallback ≤600px) reserving its height. Fixed has no
sticky-containing-block dependency, so it cannot fail this way. The `--nav-h` measurement and
the ResizeObserver are unchanged and still feed both the spacer and every inner sticky offset.

**Status: STATIC-verified only** (babel-parse clean on `page.jsx` / `layout.jsx` /
`Login.jsx`, CSS braces balanced, single `.topbar` wrapper + spacer, no other `.hdr` in the
tree).
Per §11 the sandbox can't `next dev`. **Owed: a live pass on the founder's iPhone home-screen
web app** — brand row pinned at rest and through a full card-list scroll, tab row directly
beneath it, inner frozen headings landing under the bar with no gap and no overlap, plus the
desktop check that nothing shifted.

**Open follow-on, not done:** there is still **no `manifest.json`** in `web/` (no `public/`
dir at all). The home-screen app's chrome is therefore whatever iOS defaults to, which is why
`env(safe-area-inset-*)` may resolve to 0 — those insets are only non-zero under
`viewport-fit=cover`. A proper manifest (`display: standalone`, name, icons, theme colour)
plus `viewportFit: "cover"` in `layout.jsx`'s `viewport` export would make the standalone
shell deterministic instead of inherited. Do this before trusting any safe-area rule.

---

## 2026-08-07 — SCIENCE·MIDDLE IS THE ONE STRUCTURAL EXCEPTION: it serves at PLAN
## granularity, not unit granularity. Found at S6's stage prep, before a rupee was spent.

**Spec of record: `docs/science_middle_stage_serve.md` (v1.0).** Read it before any S6 work.

**What was found.** `compile.py` hard-reads `p["section_anchor"]`. Science·middle emits no such
field and honestly cannot: its LP is organised by the CHAPTER'S COGNITIVE PROGRESSION ARC (Rule
1 derives the arc from the whole summary at generation time), not by textbook sections. The
first `build_library.py` run would have died before any certification check executed. Caught at
P-prep by reading the constitution against the engine rather than assuming the template's
carry-forward covered it.

**Why the standard engine cannot serve this stage** (founder rulings, 2026-08-07):
- **No prefix of a canonical is a valid plan.** A stage spans several units (Rule 2), its
  implied LO is the outcome of the *complete* stage (Rule 5), and its items test that LO.
  Truncate a 15-unit plan to 13 and the class is tested on an operation it was taught 60% of —
  and unlike a dropped section, there is no honest sentence to declare it with. Truncation dies,
  and borrowing (which exists only to fill truncation's hole) dies with it.
- **Arcs are not comparable across canonicals.** Stage count, labels and structure are derived
  freshly per generation and may legitimately differ between a chapter's own canonicals.
  **No cross-canonical registry of any kind; stages may NEVER be borrowed.** The one shared fact
  is the arc's terminus — Rule 1 binds every arc to the dissolution-test operation — and that is
  the only thing a borrowed synthesis unit may assume.

**The serve law that replaces it.** X = a canonical's count → identity · X = K+1 → that
canonical whole plus the TOP's synthesis unit · X < lowest → truncate the lowest with declared
drops (partial stages ARE tolerated below the floor: that range is declared-deficit already, and
showing her what she won't reach beats refusing) · X > top → surrender. **Canonical counts step
down by exactly 2** from the standard, floor included — the bridge is one synthesis unit, so a
gap of 2 is the largest the law can cross, and the spacing is FORCED, not a tuned tolerance.
That removes surrender inside the band. **Landed the same day** in `genon/master_plan.py`
(`SERVE_GRANULARITY` table, one read point — never an `if subject ==` in the body), runbook pair
completed. Measured cost, not extrapolated: science·middle goes **107 → 154 authoring runs,
+47 ≈ ₹1,739**. Diff vs HEAD: 34 chapters changed, all science·middle, zero other combos touched.

**Two rulings worth keeping separately.**
1. **The register is a TWO-BAN cut here, and only here.** Ban 2 (forward reference / completion
   language) is deliberately not ported: every unit of a canonical is served with every other
   unit of that canonical, so "in the next unit" is never wrong for anyone and a closing
   completion claim is simply true. **Bans 1 and 3 stand in full** — the argument for dropping
   ban 2 reaches neither. Ban 1 exists because the platform scales every band's minutes to the
   sitting that carries it (universal, unaffected by the serve model); ban 3 is Calendar Purge
   doctrine. Consequently VOCABULARY keeps its positional cross-reference examples and Rule 10
   keeps position-linked continuity — both of which every other stage had to strike.
2. **The synthesis unit carries its own assessment items and brings them along.** The working
   assumption was the opposite. An audit of the installed libraries found SS·VIII ch 3 anchors
   items to synthesis unit 12 and SS·IX ch 3 to unit 16, and C9.2 mandates a borrowed unit bring
   its own items. Ruling: keep it, and align science·middle rather than except it. **General
   lesson: an "I guess that's already the case" is a claim to check, not a premise** — this one
   was inverted, and it would have been discovered at C9 with a library already paid for.

**Landed at P-prep:** LP **v2.1 → v2.2**, assessment **v1.3 → v1.4**, P3 converted (the first
stage where P3 was not N/A). Artefacts + per-item sign-off in
`genon/out/stage_prep_science_middle/`. **The engine work landed the same day** (e16 → e17): the
plugin declares granularity and section axis, `compile.py`'s anchor read is mediated,
`serve.select_whole_plan` implements the four laws as ONE rule (largest sittings ≤ X that is a
canonical's K or K+1 — identity wins ties over the borrow), briefs supply no registry, and
certification's checks 3/4/5 go N/A while check 8 is redefined and joined by a
no-surrender-inside-the-band gate. `tests/test_genon_plan_granularity.py` covers it; S6's
C-cycle is OPEN.

**The defect the four laws would never have caught.** The engine's unit projection models what
SERVING reasons about, not what DISPLAY needs: `progression_stage`/`stage_label` were dropped, so
every served plan collapsed into one "Stage None" group — the phantom CLAUDE.md §3 records for
science secondary, reappearing on the serve side. Only rendering a served plan through the
subject port exposed it. Fixed generically (`compile._MODELLED` → `unit["extra"]`, spliced back
first so engine keys win), which pre-pays the same debt for mathematics and english. **Standing
lesson: a serve test that never renders its own output is testing half the pipeline.**

**★ S6 CERTIFIED 2026-08-07** — human gate signed, P1-P5 + C1-C14 all pass. Third stage
certified, and the FIRST served by an engine other than the standard one. Pilot: ch 6, library
[12, 10, 8, 7] x 45, Rs 151.65 over 5 runs. Four defects raised and fixed inside the cycle —
ARV-D-065 (Rule 4's item counts were a table column, not a mandate; proven by a re-author that
went 13 -> 18 items), ARV-D-066, ARV-D-067 (the borrowed synthesis dragged the lender's whole
stage and its items — the ruling made that morning reversed the same day), ARV-D-068.

**The answer to the pilot's open question, now that it has run:** the arcs did NOT come back
identical — the 12-unit top derived SIX stages where the compacts derived five — and that is
exactly what the architecture assumes and permits. What holds is the terminus: every canonical
closes on the dissolution test's operation, and the borrowed synthesis leans on nothing else.
C8 rated both joints clean/serviceable with zero jumpy. The design decision to let arcs differ
freely, and to forbid stage borrowing between canonicals, is validated by the first real library
rather than argued from principle.

**Original open question, kept for the record:** do arcs authored at 12 and at 7 units of the
same chapter reach a recognisably similar terminal operation? The synthesis borrow leans entirely on the
dissolution-test sentence being honoured consistently. That is C8's inspection for this stage,
and with one joint to look at it is a sharp, cheap test.

---

## 2026-08-06 — DERIVE ONCE, STAMP, READ THE STAMP: assessment anchoring stops going
## through a plan-local mediator (ARV-D-064, S1; engine e14 → e16). Found at science·secondary C9.

**The founder's rule, and it is the whole entry.** *If p07 U7 is filled with p12 U11, the
question indexed to p12 U11 must be brought along — and stay attached to it.* Unit identity,
carried, never recomputed.

**What was wrong.** The serve engine has always stamped the true answer on every item
(`compile.py::_anchor_items` writes `unit_ref`; `serve.py` writes `period_ref` = the sitting,
**borrowed units included**). Three of the five ports threw that stamp away and re-derived the
anchor at render time by joining a **mediating key** — `section_number` (science, maths·sec),
a spine/section code (english, maths·mid) — through the *receiving* plan's index. Those keys are
**plan-local**: the model cuts and merges sections against the time it is given, so on science·ix
ch 8, p12's section 3 is *8.2.2 gold foil* while p07's section 3 is *8.2.3 Bohr* — S2 through S7
all disagree. Cross a plan boundary (which the serve engine does by design) and the question
lands on the wrong sitting, or nowhere. **social_sciences and the_world_around_us never had the
bug** because they already did the right thing — `stamp(meta, as_list(it["period_ref"]), lo)` —
which is the strongest possible argument that this was never a missing feature, just four
subjects not doing what two subjects already did.

**Two halves, and the second was already shipping.** (a) The ANCHOR half is latent on today's
corpus — science·secondary is the only certified handoff-bridged stage and its one cross-plan
borrow (the e15 rescue of the TOP's synthesis) carries no questions. (b) The **LO half was
LIVE on two certified stages**: measured against a clean HEAD checkout, SS·IX ch 3 X=9 and
SS·VIII ch 3 X=12 are real cross-plan synthesis borrows carrying 1 and 2 questions on the
borrowed closing sitting, and the served plan's `coverage_handoff` stopped at sitting 8 / 11 —
**questions asked on a sitting the plan claimed no learning outcome for**, breaking the identity
serve.py's own dropped-unit comment says must never break (invisible on screen, since the LP
never displays LOs; it would surface only in a coverage audit).

**The fix (4 files).** (1) `link_resolver.platform_anchor(item)` — the platform's stamp beats
every subject join. (2) science / english / mathematics ports read it first and fall back to
their own mediator ONLY for an un-served library file (one plan, self-consistent, safe).
(3) science's assessment grouping keys on the item's **own `section_label`**, not on the number —
otherwise a borrowed question is filed under whatever the host calls that number. (4) `serve.py`
carries a borrowed served unit's handoff row, remapped to the fill sitting, `_order` beyond the
host's so it reads last — **for the LO and the coverage ledger, never for the join**. Safe
verbatim because the engine handoff is keyed on the section LABEL
(`carriers.to_engine_handoff` chose that key for exactly this reason).

**The rejected fix, recorded because the reasoning matters.** C9 first proposed restoring the
lender's handoff row *so the join would work*. That repairs the mediator instead of removing it,
and it is actively dangerous: `handoff_period_index` is a dict, so a lender row carrying a
colliding number **overwrites the host's row** — the new test demonstrates the host's own
question being dragged onto the borrowed sitting. A number-keyed join clobbers in both
directions.

**Test: `tests/test_borrowed_anchor.py`** — supplies the case the corpus withholds: a
science·secondary-shaped library whose borrowed unit carries two questions numbered 6, where the
host's section 6 is a different section on a *served* sitting. Discriminating: against clean HEAD
it fails on the missing handoff row; with serve fixed but the old port it fails with the borrowed
questions filed under "8.6 Mass Number". **No behaviour change on the real corpus** — every
science·ix ch 8 plan and canonical re-rendered before/after, anchors and headings diff-identical.
Suite unchanged (same 4 pre-existing missing-fixture failures). Re-served at e16: science·ix ch 8,
SS·IX ch 3 and SS·VIII ch 3, all clean, 24/24 exports 200, no orphaned item in any view.

**Also fixed the same session — ARV-D-063 (S2), the sibling of ARV-D-060 on the export path.**
`api/main.py`'s unscheduled-item filter iterated `result["assessment_items"]` as a bare list;
science wraps it, so the walk yielded the wrapper's KEYS and every science·secondary export died
with an AttributeError **before any renderer ran** — the plain identity canonical included, so
that stage had never exported at all. Routed through the carrier seam ARV-D-060 built, wrapper
restored (the port reads it to decide the stage). 30/30 exports now 200; SS control byte-identical.
**Standing lesson from both defects: `result["assessment_items"]` is never read directly — always
through `genon/carriers.py`.**

---

## 2026-08-04 — SELF-PREFERENCE in the Xth-unit tie-break (architecture v2.1, engine e14)

**The rule.** In §0.4's Case-2 choice set, **the chosen plan's own candidate now wins every tie
it enters** — inserted between reach and pacing distance in `serve.py::fill_slot`'s sort:

```python
(overlap == 0, overlap, -reach, 0 if c["self"] else 1, abs(count - requested), -count)
#                                ^^^^^^^^^^^^^^^^^^^^ e14
```

**What was wrong.** §0.4 named the chosen plan's unit "the identity candidate" and then gave it
no privilege whatever; the tie fell straight to `abs(count − requested)` ("pacing context"). So
the engine handed the teacher **a stranger's closing unit while the plan she was being served
had its own, equally first-exposure**. Every candidate is first-exposure by construction and
therefore SAFE — which is exactly why nothing broke and no gate could see it. This is
continuity, not correctness: the home unit is written *for this arc* and names the content the
class just had. SS·IX p10 U8 opens *"The climate change mechanism examined in the unit on
greenhouse gases and fossil fuels…"* — a precise back-reference to the sitting just taught,
where the borrowed p07 U7's equivalent is generic.

**Where it bit.** SS·IX X=8 (p10's own U8 lost to p07 U7 on |7−8| < |10−8|); SS·VIII X=11 (p10
U10 over p13's own U11) and X=14 (p13 U11 over the top's own U14). After the patch **every
Case-2 fill in both chapters is `self_fill: true`**, and the SS·VIII band's two in-band fills
become pure single-plan prefixes — no cross-lending anywhere in [floor, top].

**Scope.** Tie-break only. It sits BELOW reach, so it never promotes a home unit past a better
preference class — a home unit that re-crosses still loses to a foreign forward-reaching one
(asserted in `tests/test_genon_serve.py`, along with the case proving pacing distance still
governs a tie between two foreigners). Identity, synthesis, surrender and below-floor serves
are byte-identical; only Case-2 fills change.

**The process lesson, which is the bigger one.** I raised this at **SS·IX's C8 on 2026-08-03**
(`genon/out/library_reports/social_sciences_ix_ch03_SEAM_READ_20260803.md`, finding A1) with
this exact one-line patch. It was written into a C8 narrative report and **never filed as a
tracker row** — no ID, no owner, no status — so nothing carried it forward and it recurred at
SS·VIII. **A recommendation that lives only in prose has no mechanism to come back. File it as
an ARV-D row or it did not happen.**

**Second gap, worth fixing.** testing.md §9's cheap path for an engine change is "re-run
`--certify-only` and diff the reports; identical → stages stay certified." Both reports here
came back **byte-identical apart from the timestamp** — because the sweep line records the
*mode* (`fill/single`) and never the *lender*. §9's diff test is lender-blind and would have
declared this change invisible. Adding `borrowed_from` to the sweep string would close it.

**Consequences handled:** `GENON_ENGINE_VERSION` 13 → **14** (served bytes change, so the cache
re-keys and every `_e13_` file is stale by construction, never overwritten); the ladder comment
in `api/data.py` also **backfills the missing e13 entry** (ARV-D-037 shipped without one).
Canonicals, briefs and constitutions are untouched — no regeneration, ₹0.

---

## 2026-08-04 — ARV-D-034's fix MOVED: the cache key is clean, the repair tools purge

**The problem, unchanged:** `repair_anchors` / `repair_register` / `normalize_options` rewrite a
canonical IN PLACE. The serve cache keys on (chapter, matrix, engine, canonical `ledger_ts`) —
none of which a repair moves — so plans derived before the repair keep being served. Measured on
the pilot: the 8-period plan carried a repaired-away register breach and five unarranged MCQs
four hours after the repair, and only a manual delete dislodged it.

**First fix (2026-08-03), now REVERTED:** a repair fingerprint in `canonical_version` —
`…_c20260803143426r4d21e.json`, where `r4` = four repairs and `d21e` hashes them. Correct, and
unreadable: every served filename grew a hash tail, and the founder deleted the derived plans and
asked for the plain convention back.

**Second fix (2026-08-04), current:** `genon/purge_derived.py`. A canonical change DELETES the
chapter's derived plans (`ch_NN_<matrix>_e*_c*.json`, never a `ch_NN_canonical*.json`, never
another chapter), called automatically from all three repair tools. Names stay plain
(`ch_03_50m8_e13_c20260803142658.json`) and the next request rebuilds in ~11 ms — the rebuild
being free (C11: 0.3 ms of engine work) is what makes purging affordable where it would not be
for a generated artefact.

**The trade, stated:** a teacher holding a purged plan loses that file and re-prepares. Her
prepared-plans register still names it; `GET /plans/{subject}/{grade}` walks the DIRECTORY and
marks what is prepared, so a dangling key is silently skipped rather than erroring (verified —
30 such keys exist across kumar1/2/3 today and My Lessons is unaffected). The re-key branch is
the alternative if that ever stops being acceptable; do not invent a third mechanism.
`tests/test_genon_plan_key.py::test_repairs_do_not_rekey` pins BOTH halves: the key must stay
stable across repairs, and the purge pattern must never match a canonical.

---

## 2026-08-03 — ARCHITECTURE v2.0: mandates OUT, the first-exposure choice set IN (engine e12; solver retired)

**The defect (ARV-D-025).** The solver-mandated closing spans failed at their root: by
mandating a synthesizing closing unit in each compact and lending it into slot X, we
imported the assumption that the BORROWING plan's class had the lending plan's own priors
for those sections. It never does — it reached slot X through a different prefix. The
jumpy X−1→X profile of served plans was the proof. Mandated synthesis is jumpiness by
construction; no wording repair fixes it.

**The fix (architecture §0, the new spec-of-record — read it before touching genon):**

- **Free canonicals at arithmetic counts.** No solver, no σ, no closing spans. Counts by
  EQUAL DISPERSION over [floor, standard]: {A, ⌈(A+C)/2⌉, C} when A−C ≥ 4, {A, C} when
  1 < A−C < 4, {A} degenerate (so small chapters naturally get two canonicals, founder
  ruling 2026-08-03 with placement/collapse choices). `master_plan.py` emits
  `canonical_periods`; `variant_plans.py` v2.0 annotates `canonical_plan` {counts,
  provisional, basis, registry_sections, authored} and composes the new briefs
  (`variant_plan` keys are purged from master_plan.json).
- **The one surviving mandate — the synthesis anchor (§0.3).** The STANDARD canonical's
  last unit is a whole-chapter synthesis, `section_anchor` exactly the reserved token
  `synthesis` — excluded from the registry, forbidden in compacts, gated by
  `build_library.py` (which replaced the closing-span check). Safe because it is only
  borrowed in Case 1, where the prefix covers the whole registry — full coverage is the
  only prior a whole-chapter synthesis needs.
- **The Xth-unit choice set (§0.4, serve.py e12).** Case 1: prefix covers all → borrow
  the standard's synthesis. Case 2: borrow, from ANY canonical (chosen included — its own
  unit X is the identity candidate), the unit that FIRST deals the next-due section M in
  its own plan — a first-exposure unit's only backward dependency is "prior sections
  taught", which the prefix guarantees: the structural no-jumpiness argument, e11's
  "anchoring is not teaching" promoted to the selection principle. Preference:
  forward-reach-no-recross (furthest first) > M alone > backward combos (redundancy is
  not jumpiness); ties → **SELF FIRST** (e14, 2026-08-04), then count nearest X, then
  denser. Contiguity (V2) makes every candidate adjacent, so on a certified library
  Case 3 is structurally impossible.
  Dropped sections now ride FROM THE LENDER's subsequent units (provenance consistency;
  was: from the chosen plan). Case 3 (defensive): truncate, NO drops, message asks for
  the REFERENCE canonical's count — not the floor (the gap being diagnosed is between
  the request and the depth it implies; below C the reference IS the floor canonical).
- **Retired:** `variant_solver.py` + `test_variant_solver.py` → `_to_delete/`;
  `lendable_unit()` and the exact/superset/suffix ladder (absorbed by first-exposure
  selection); the projected-vs-actual certification diff (the serve sweep is the table
  of record, now with per-X fill class + drop counts and a no-Case-3 gate).
- **Ripples:** api `GENON_ENGINE_VERSION` → "12" (every e11 cache entry stale);
  `data.master_canonical_plan()` / `canonical_plan` in GET chapters (frontend never read
  `variant_plan` — grep-verified); `test_genon_serve.py` rewritten for e12 (all pass;
  duration-order + plan-key suites untouched and green; the fastapi/fixture failures
  pre-date this session, CLAUDE.md §8).
- **testing.md → template v2.3 (same day):** §0.7's σ machinery struck (floor stands);
  C1/C5/C6/P5/§6/§9 aligned to canonical_plan, the synthesis-anchor gate and e12 sweep
  modes; **C8 replaced** (founder) — LLM-need flags give way to the X−1→X TRANSITION
  INSPECTION: read sitting X−1 and X in full consecutively per exercised fill class +
  the synthesis borrow, rate clean/serviceable/jumpy with quoted evidence, every jumpy
  a defect citing ARV-D-025 with a deterministic remedy first; the HUMAN GATE now reads
  the sweep table, C8's worst transition, the standard's synthesis and each compact's
  free ending. §10 carries the pilot's v2.0 note (library must re-author; old serve
  modes extinct); the 2026-08-01 corrections note superseded by a dated re-check.
- **Standing consequence for ch 3's pilot library:** counts move {12, 9, 7} → {12, 10, 7}
  and the on-disk artefacts are PRE-v2.0 (top has no synthesis unit; p09/p07 carry the
  old mandated closers). The library still serves through legacy fallbacks, but v2.0
  certification would rightly fail it — the chapter re-authors under the new briefs
  before the template is called portable. p09 is orphaned by the new counts.

---

## 2026-07-31 — THE VARIANT-CANONICAL PIVOT: partition engine retired, serve engine lands (genon e08; SS·sec LP → v1.8)

**The founder's verdict on the first realistic partition (SS·IX ch 3 at 9×50, e06) killed the
partition architecture, and the evidence supported it completely:** every one of the nine
sittings straddled a unit joint (handoff_used 9/9), so every teacher note was a Rule-16
pivot-note and the authored unit notes appeared zero times; three sittings ended on the NEXT
unit's hook (the boundary CUT_COST punishes hardest — the fill-tolerance window overrides role
cost by construction); role-weighted compression scaled every dev band by exactly 0.8 and every
hook/cons by 0.714 — a uniform percentage, not a pedagogical judgment. Root cause: **the
pedagogy's quantum is the unit-arc; the engine's quantum was the phase.** Full reasoning,
settled rules, and the demolition manifest: **`docs/variant_canonical_architecture.md`** (the
standing spec for this architecture — read it before touching genon).

**The replacement (all landed today, suite-verified):**
- **Architecture:** a chapter = a LIBRARY of variant canonicals (same section list authored at
  2–3 period counts, each a complete plan + its own assessment, at the class-standard
  duration). Serving = SELECTION: next-highest variant (full richness; surrender only above the
  top, declared); **X−1+1 form** (first X−1 units verbatim, one whole unit per sitting; slot X
  from the fill ladder); **ladder** = exact fill > superset (minimal overlap, "revision
  runway") > longest suffix (closure kept, gap named + handed over) > truncation (founder's
  11-vs-12 ruling: never skip inside the chosen plan). Section arithmetic on the shared
  registry (chapter summary's section list, verbatim anchors) is the join key. Per-variant
  assessments compose for free (borrowed closing unit brings its own items, band ids
  namespaced F…). Proportional per-unit duration scaling is the ONLY arithmetic left; weekly
  dispersion ordering kept from v0.4.
- **Reverse deduction:** `aruvi_core/genon/variant_solver.py` solves the variant counts +
  MANDATED CLOSING SPANS from the top canonical before the compact variants are authored
  (covering condition: inter-variant gaps ≤ σ, the largest defensible closing span;
  demand-weighted toward master_plan recommended_periods) and emits the per-chapter
  adaptation table (X → full/partial/truncation) — a certification artifact and a future
  budget-time UI surface.
- **Code:** `serve.py` (new engine) + `variant_solver.py`; `compile.py` → v0.5 (roles optional
  passthrough, unit_handoff no longer read; SECOND PASS same day: the BAND LAYER left the
  declaration surface too — band ids DERIVED positionally, never demanded of the model;
  assessment anchoring is UNIT-level via unit_ref, normalized from period_ref — 'linkage is
  an identity' — with legacy phase_ref fallback, so ch 3/ch 5 still compile+serve. LP
  constitution → v1.9 (Rule 14 removed; schema loses band_id/band_refs), assessment → v1.5
  (phase_ref removed, reversing v1.2). A2 joins A3/A4 as CANCELLED for the ten un-amended
  constitutions; X3 (generalise _check_declarations) is VOID; A6 reduces to confirming each
  subject's items carry their anchor unit. Brief §6a records the reasoning);
  `partition.py` + `polish.py` moved to `_to_delete/`; `GENON_ENGINE_VERSION` → **"08"**
  (every e07 entry stale); `load_genon_library`/`load_genon_streams` (variant files
  `ch_NN_canonical_pKK.json`); genon route serves the library — identity generalised to any
  variant's std row, cache keyed by the CHOSEN variant's version, response gains a `serve`
  block (`compression`/`seam_periods` keys kept frontend-compatible; seams always []).
- **Constitution:** SS·secondary LP **v1.8** — Rules 15 (role_handoff) + 16 (unit_handoff)
  REMOVED with their A1 schema keys; SELF-CONTAINED REGISTER rebound to Rules 10+13 with the
  whole-unit rationale (position/calendar/clock bans all still stand — a unit may be served
  beside a companion variant's units); Rule 14 kept. CHANGELOG has the dated row. Assessment
  constitution untouched. **A3/A4 are CANCELLED for the ten un-amended constitutions**; A1,
  A2, A5/A7, A6 and Group-B P3 all stand; NEW V-series (V1 variant brief · V2 shared registry
  · V3 closing mandate · V4 per-variant assessment) ready-to-port in the brief §7.
- **Tests:** NEW `test_genon_serve.py` (synthetic 3-variant library: selection, all four
  ladder rungs, surrender, tiling at 40/60, assessment remap + namespacing, dispersion) and
  `test_variant_solver.py` (covering condition, σ degradation, weighting) — both green;
  `test_genon_unit_handoff.py` retired to `_to_delete/`; duration-order test repointed to
  serve (green); plan-key test asserts e08 (green). NOTE (pre-existing, NOT from this pivot):
  test_api / test_link_resolver / test_lp_standard / test_normalized_item / test_stimulus
  fail on missing english/science sample saved plans under data/content/saved_plans — they
  fail identically on the pre-pivot tree; reconcile against CLAUDE.md §8's 11/11 note.
- **testing.md impact (template change owed, brief §9):** P1 loses A3/A4, gains V1–V4; C1
  generates per variant with the solver between top and compacts; C5 becomes a serve-table
  sweep (identity per variant / exact / superset / suffix / surrender + C6 mix); C7 drops
  seam + wide-span checks; C10 asserts e08 + chosen-variant keys. Corpus pre-warm at 3
  variants ≈ **₹20–35k batch** (July token log: ₹60/canonical live mean; compacts smaller;
  assessments extra but fractional). Pilot (SS·IX ch 5): run the solver, author variants,
  read borrowed seams aloud before porting.
- **docs/partition_constitution_rollout.md REWRITTEN (same day):** now carries ONLY what
  still ports — the serve-era hard contract S1–S5; A1 · A5/A7 register · A6-as-confirmation ·
  A9 (+ the item-18 corpus-repair debt) · P3 · P4 · the V-series (V1–V4, incl. the English
  registry-definition question); A2/A3/A4/X3 recorded as cancelled with a pointer to the
  brief. Filename kept for testing.md references; "partition" in the name is historical.
- **Register re-cut to v1.10 (same day, founder challenge):** the backward-position ban's
  engine justification died with the partition (X−1 units serve in canonical order), so the
  register now carries exactly three bans, each traced to a live mechanism — clock quantity
  (rule-4 scaling falsifies numbers), forward reference/completion language (X varies, so ANY
  unit may be terminal or precede a companion variant's unit — this ban is GLOBAL, not a tail
  concern), calendar time (Calendar Purge doctrine). Backward references freed; content-named
  continuity stays as best practice. Rollout brief's A5/A7 entry now ports v1.10.
- **master_plan floors corrected to nearest-whole rounding (founder, same day):** floor_periods_at_standard was ceil(floor_minutes/duration); now round() — 143 of 339 chapter rows changed (SS·IX ch3 8→7, ch5 14→13); genon/master_plan.py fixed alongside so regeneration holds. Solver's demand inputs are both calibrated data now: recommended_periods (weight centre, via variant_solver.demand_weights) + floor_periods_at_standard (the C anchor). ch3 re-solves to {12, 9, 7}, spans {9:1, 7:2}, full coverage 7–12. Note the floor is still 0.6×rec by definition — the ratio itself is partition-era and open to pedagogical re-setting.
- **Frontier arithmetic (founder ruling, same day):** ch 5's tail exposed backward-anchored
  SYNTHESIS sittings (units 19-21 revisit Economy/Religious Life/the opening section) — the
  missing-span-as-suffix premise broke. Ruling: keep synthesis tails legal; coverage is the
  prefix's FIRST-VISIT FRONTIER (uncovered span stays a registry suffix); when the frontier
  reaches the last section the withheld tail is synthesis-only — slot X borrows a companion
  variant's closing synthesis (new fill mode "synthesis", nearest-in-scale) or truncates with
  an every-section-is-covered note. V2 = first-visit order (not per-unit monotonicity); V3 =
  closing synthesis anchored to the mandated last-k sections. serve.py + variant_solver.py +
  tests updated (all green, incl. synthesis-tail cases); both briefs carry the ruling.
  Ch 5 re-solved trustworthily: {21, 17, 13}, spans {17:1, 13:1}, FULL coverage 13-21 at
  sigma=2 — NO fourth variant needed even for the largest chapter; ch 3: {12, 9, 7} full 7-12.
- **Industrial variant plans (same day):** genon/variant_plans.py annotates EVERY chapter
  row of master_plan.json with variant_plan {sigma, counts, closing_spans, provisional,
  basis, registry_sections, full_coverage, partials_at} — 2 rows solved on authored
  canonicals (SS·IX ch3/ch5), 337 provisional (modeled top, 1 section/unit; re-run the
  script after each top canonical certifies to finalize its row in place). Small chapters
  degrade gracefully (2-variant and 1-variant plans where recommended−floor < 3). API:
  data.master_variant_plan() + variant_plan on every chapter in GET /subjects/{s}/{g}/chapters.
  SIGMA table in the script (default 2, per-stage overrides) is the founder's dial. Wide
  provisional rows (e.g. SS·IX ch4: rec 19, floor 11) show midband partials — expected to
  improve on real registries (synthesis tails shrink effective section count) or resolve via
  the 4th-variant/sigma decision per stage.
- **master_plan.md RETIRED (same day):** it misled the founder with a stale ceil'd floor
  within hours of the rounding correction — a derived human view nothing consumes and
  nothing keeps fresh. master_plan.json is the single artifact; eyeball it fresh (json.tool)
  or via GET /subjects/{s}/{g}/chapters. genon/master_plan.py no longer emits it (comment at
  the removal site records why). RUNBOOK PAIR: master_plan.py regeneration wipes derived
  annotations — always run genon/variant_plans.py immediately after it.
- **NEW SKILL .claude/skills/canonical (same day):** one invocation runs the whole library
  loop on desktop — top canonical (LP + assessment) under live constitutions -> variant_plans.py
  finalize -> brief extraction consumed in-session -> compact variants + their assessments ->
  deterministic certification (compile, registry/first-visit/closing-mandate checks, serve
  sweep, projected-vs-actual table diff) -> HUMAN GATE (seam reading + diff verdict, never
  self-approved; sampled in batch mode). Kills the human relay of printed briefs; the FastAPI
  is never involved (generation was always cowork-side; serve reads files by glob). Sibling to
  the chapter skill, which remains the summary/mapping ground.
- **Metered generation wired for variants (2026-08-01):** generate_canonical.py gains
  --brief (prepended verbatim as the first user block) + --variant KK (count override,
  installs ch_NN_canonical_pKK.json, logs variant_generation; requires --brief); its
  validator rewritten for the serve-era contract (anchors/tiling/period_ref — band layer
  checks gone with the retired partition import). Verified by --dry: model claude-sonnet-4-6,
  brief first block, count from --variant, guard fires without --brief. canonical skill v2
  routes ALL certified generation through this path (on-computer + ANTHROPIC_API_KEY;
  in-session authoring forbidden for installable artifacts — constitutions are calibrated
  to Sonnet 4.6). NOTE: founder cleared data/content/saved_plans/social_sciences/ix (olds in
  backup/saved_plans/) — annotate pass will show ch3/ch5 provisional until fresh tops land;
  variant_plans.py brief now refuses gracefully when the canonical is missing.
- **SANDBOX NETWORK FINDING + the one-command driver (2026-08-01):** the Cowork sandbox
  proxy blocks credentialed API calls in EVERY mode (on-computer included) — x-api-key
  requests return identical plain-text 401s for bogus and real keys; keyless requests reach
  Cloudflare. So metered generation runs ONLY in the founder's own Terminal. Response:
  genon/build_library.py — ONE command (subject grade ch) runs top canonical -> annotate ->
  briefs (genon/out/briefs/) -> compact variants -> re-annotate -> deterministic
  certification (compile, registry/first-visit/closing-mandate, serve sweep,
  projected-vs-actual) -> report in genon/out/library_reports/; --certify-only re-runs the
  free steps. variant_plans.py refactored (briefs_for() returns {count: text}). canonical
  skill v3: session does preflight, hands the user the command, then reads the report and
  runs the HUMAN GATE — it never generates and never works around the proxy. Pilot ceremony:
  Social Science · Grade IX · ch 3 — 12 × 50 min (LP+A; constitution serve-era)
  schedule : Total: 12 periods · 10h 0min
  system   : 37,241 chars   user: 27,842 chars

== STEP 1 · top canonical (metered, Sonnet 4.6) == then gate in any session.
- **V-SERIES IS NOT CONSTITUTIONAL (founder ruling, 2026-08-01):** the variant brief is
  post-constitution — composed by the platform, prepended to the prompt, invisible to the
  constitution; the certifier enforces every V-requirement in code. NO constitution carries
  a V-rule, an INPUTS acknowledgment, or a precedence line (founder rejected even that).
  Constitutional carry-forward per stage is EXACTLY: A1 · A5/A7 (v1.10 register) ·
  A6-confirm · A9 · P3 · P4 — nothing more. Economics: brief wording iterates at failure
  speed (ch 3 hardened it twice in a day, Rs 35, no cascade); a constitutional amendment
  reopens every certified combo under testing.md §9. Both briefs updated (rollout §3+§5,
  architecture §7); rollout header/table synced to LP v1.10 reference.
- **testing.md rewrite brief written (docs/testing_rewrite_brief.md, 2026-08-01):** the
  handoff for rewriting the campaign template. HEADLINE: certification collapses from 25
  class combos to 11 subject·STAGE rows — ONE randomly chosen class per stage (constitutions
  are per stage; record the pick; cover both stage durations deterministically where a stage
  spans 40/45). Encodes everything settled: serve-era test object, constitutional
  carry-forward list, Terminal-only generation + build_library + quarantine + human gate,
  ch 3 pilot evidence (Rs 145.70 all-in incl. the caught coverage defect), C-step by C-step
  rewrite guidance, and the three-way regression distinction (constitution vs engine/brief
  vs master_plan changes).
- **DROPPED SECTIONS shipped (founder spec, 2026-08-01; engine e09):** below the floor,
  the served plan carries its unreached units verbatim (result.dropped_units, unscheduled,
  authored minutes as guidance) — the 'give her access to it' promise made literal. /view
  renders them through the subject adapter (view.dropped_lp + dropped_sections); EXPORTS
  DELIBERATELY UNCHANGED (her printed artifact stands as generated; online is an option,
  never forced). UI (LessonView, all three surfaces — preview, tracking, chapter-org): one
  collapsible 'Dropped sections' row below the planned units; the paging strip chains
  'Next' from the last served unit into the dropped units and 'Back to unit N' from the
  first dropped unit returns to the last served one; dropped units badge 'for self-study ·
  not scheduled' and never enter pointer/completion arithmetic. Also same-day UI fixes:
  archived plans excluded from section-attach chooser + tour; floor small-print now
  round()-based ('Below 7 periods…') with serve-era wording in Prepare + FirstRun;
  duration_label on ALL plans incl. canonicals ('50 min × 12/9/7' — supersedes the
  2026-07-25 no-label rule). Every e08 cache entry stale by construction (e09 bump).
- **Surrender surfacing settled (founder, 2026-08-01): the drop channel, at generation,
  nothing else.** serve.py routes surrender_note into section_coverage_note (mutually
  exclusive with coverage loss, no collision); genon.surrender_note stays as provenance.
  No org-header line, no card reconciliation, no view surface — same-day fold into e09
  (no surrendered e09 artefact existed). ALSO: the org-page 'Dropped sections' collapsible
  row was REMOVED on founder order — the paging-strip chaining (last unit -> dropped units,
  back returns to last served unit) is the sole access path, plus the generation-time note.
- **Generation-note interstitial (2026-08-01):** PrepareLesson's onPrepared early-return was
  SILENTLY DISCARDING coverage_note in the normal flow (launched from My Lessons/My Classes) —
  drops at 5/6 and surrender at 13+ never showed. Fix: when the serve returns a note and a
  return handler exists, a one-screen interstitial ("Lesson plan prepared" + note + Continue)
  shows once, then continues; no note -> zero-click as before. Cached responses carry the note
  too, so repeats still surface it. FirstRun's guided path untouched (its flow predates floors).
- **Edge-warning placement FINALIZED + served-schedule prints (founder, 2026-08-01; e10):**
  the warning lives INLINE in the Prepare form (prep-floor line, before Generate) —
  context-aware: floor note below 60%, surrender note ('Above 12 periods, the extra N return
  to your budget') above the top; the post-generate interstitial was REMOVED (double-warned).
  Engine e10: period_schedule_display + duration_label build from genon.served_matrix — a
  13-ask PRINTS 12 periods everywhere teacher-facing; the request stays in genon.matrix as
  provenance. test_genon_plan_key asserts e10. Stale e09 13-file moved to _to_delete.
- **Open (founder):** floor + σ per subject·stage; 4th-variant threshold for big chapters
  (ch 5 is 21 units); adaptation-table UI (deferred); retire `compression`/`seam_periods`
  response keys at the next web pass; apply §9 to testing.md itself.

---

## 2026-07-26 — THE CALIBRATED STANDARD IS NOW THE DEFAULT (first run was showing 12×40 for every chapter of every class)

**The report.** Founder: "the first time plan default was showing periods not in line with the
calibrated standard we created." Confirmed, and it was worse than a drift — first run was not
reading any period table at all.

**Two tables, silently disagreeing.** `data/content/allocation_norms/` holds both:

| | `ncf_period_norms.json` | `master_plan.json` (OUR calibration) |
|---|---|---|
| keyed by | subject · **stage** | subject · **class** |
| source | NCF adaptation (`NCF_adapted_for_Aruvi.xlsx`, 2026-07-01) | founder's `ncf_chapterwise_period_allocation.xlsx` → `genon/master_plan.py` (2026-07-24) |
| period length | **flat 40 min** everywhere (its own `_meta.unit`) | **class-banded: 40 ≤VII · 45 VIII · 50 IX** (`std_duration`) |
| per chapter | annual total ÷ effort weight, computed in the API | `recommended_periods`, precomputed by largest remainder |

They disagree, both ways: SS IX **245** calibrated vs **150** NCF (1.63×); TWAU preparatory **140**
vs **300** (0.47×). And they are not even in the same unit at secondary — 245×50 min against
150×40 min. The bands ARE the basis the certified canonicals were authored at: SS IX ch 5 is the
21×50 canonical, i.e. 1050 min.

**What first run actually did (the bug).** `FirstRun.jsx` shipped `DEFAULT_DURATION = 40` and
`DEFAULT_PERIODS = 12` as flat constants. `estimateFor()` existed, read `ncf_estimated_periods`
— and was **never called**: the 2026-07-08 "neutral flat default" decision had `pickChapter` and
its sibling effect both hard-set `DEFAULT_PERIODS`. So every chapter of every class opened at
12 periods × 40 min = **480 minutes**, against SS IX ch 5's canonical **1050**. The teacher was
being handed a default that contradicted the plan the very next tap would generate.

**The fix — master plan first, NCF norms only as fallback.** Founder call, all four choices:
switch everywhere (not just first run) · show BOTH figures on the budget screen · extend the
50-min band to class X.

- `api/data.py` — new `standard_duration_minutes(grade, subject=None)` (prefers the combo's own
  `standard_duration_minutes` so the JSON stays authoritative over the band table; falls back to
  the band, then 40), `master_annual_budget(subject, grade)`, `master_recommended_periods(subject,
  grade) → {chapter: periods}`. **Class X gets the 50-min band** (same secondary band as IX) even
  though it has no master-plan row — its period counts still fall through to the NCF norms until
  the workbook carries X's chapters.
- `api/main.py` `/chapters` — new `recommended_periods` + `recommended_source`
  (`"master_plan" | "ncf" | null`) per chapter, plus top-level `standard_duration_minutes` and
  `annual_budget_periods`. **`ncf_estimated_periods` is retained, computed exactly as before** —
  it is a published norm, not a bug; it just no longer drives anything.
- `api/main.py` `/ncf-periods` — now returns `recommended_total_periods` (calibrated budget,
  NCF as fallback), `recommended_source` and `standard_duration_minutes` alongside the unchanged
  `ncf_total_periods`. Endpoint name kept so nothing else had to move.
- `FirstRun.jsx` — `estimateFor` reads `recommended_periods` and **is wired in** (this reverses
  2026-07-08); duration seeds from `standard_duration_minutes` into new `stdDuration` state (the
  "recommended" tag can no longer compare against a constant); the periods field gains its own live
  tag. **Tag copy splits deliberately (founder, same day):** the DURATION keeps **"NCF
  recommended"** — the 40/45/50 bands trace back to the NCF-adapted workbook — while the
  PERIOD count reads **"Aruvi recommended"**, because that figure is our own effort-weighted
  share of the class budget. Two different strings on one screen, on purpose; don't harmonise
  them (there is a comment in the JSX saying so). The soft 5–25 sanity band
  is **suppressed while she sits ON the recommendation** — five calibrated chapters are genuinely
  below 5 periods (English III ch 5/10/14, English VI ch 16, Science VI ch 1) and warning her
  about a number Aruvi just proposed reads as a bug.
- `YearPlan.jsx` — budget fallback and per-chapter suggestion moved to `recommended_periods`.
- `TeachingProfile.jsx` — budget estimator reads both totals; the two duplicated sub-lines
  collapse into one `estimateSubLine()` helper, shared wording with FirstRun:
  *"(based on a 30-week year. Aruvi recommends 245 periods a year for this class (NCF norm: 150).)"*

**New test — `tests/test_calibrated_defaults.py`** (stdlib, passes on the real repo). Pins the
duration bands incl. X→50 and the unknown-grade fallback; pins **SS IX ch 5 = 21 periods × 50 min
= 1050**, matching the canonical; asserts per-chapter figures sum EXACTLY to the annual budget
(largest remainder, no drift); pins the science·preparatory double-empty fallback; and asserts the
two tables still differ — if they ever converge, the test says the fix is moot, not broken.

**STATIC + unit-verified only.** Python compiles, the new suite passes against real data, all
three JSX files babel-parse clean with default exports intact. Per §11 the sandbox can't
`next dev` — **live render + mobile (360×800 first) pass on the chapter step and both budget
screens is the immediate must-do.** Watch specifically: the "Aruvi recommended" tag on both
fields at 360px (two tags now, one per field), and the longer both-figures budget sub-line
wrapping.

**Open.** Class X has no chapter weights in the workbook, so X still falls back to NCF norms for
counts (duration is right). `Allocate.jsx`'s G4 "periods in total" input is still teacher-entered
and untouched by this — the 2026-07-01 follow-on is still open.

---

## 2026-07-15 — SS SECONDARY joins the chapter pipeline; all pipeline paths now resolve inside aruvi-saas
Social Sciences secondary (Grade IX) is now runnable end-to-end for chapter summary + competency
mapping. What landed: (a) the `chapter` skill SOURCE (`../Project Aruvi/Aruvi skills/chapter/
SKILL.md`) updated — SS is middle/secondary (the "middle only" reject is gone; preparatory-SS
still rejects → TWAU; Grade X rejects until its PDFs land), SS secondary prompt-map row added,
and a NEW "Data paths" table: **all pipeline I/O resolves inside aruvi-saas** — PDFs
`textbooks/{subject}/{grade}/`, outputs `data/content/chapters/{subject}/{grade}/{summaries|
mappings}/`, CG `data/content/framework/{subject}/{stage}/`, constitutions stage-routed under
`data/content/constitutions/...`; older prompts' `mnt/data/...` internal tables are translated,
never written to Project Aruvi. **The skill's authoritative home is now THIS repo:
`.claude/skills/chapter/SKILL.md`** (founder decision 2026-07-15 — "the chapter skill in Aruvi
SaaS is the right one to use"; copied from the updated Project Aruvi source, which is now the
stale copy — edit here going forward). ⚠️ The live CACHED skill in Settings > Capabilities is
still the old version until the founder re-pastes this file there. (b) Both SS secondary prompts (`cowork prompts/
social_sciences/secondary/step_1_chapter_summary.md` + `step_2_competency_mapping.md` — the
step_2 already existed, contrary to the skill's old claim) had their path tables repointed from
`mnt/data/mirror|knowledge_commons` to the aruvi-saas paths above. Note the ix textbook files
are lowercase `chapter NN - Title.pdf` — step_1 now says match case-insensitively. (c) Output
folders `data/content/chapters/social_sciences/ix/{summaries,mappings}/` created (empty). The
mapping constitution is one dual-stage document (middle/secondary copies identical, diff-verified);
the CG documents differ per stage — never carry middle C-codes into a secondary run. Textbook
corpus discovery: `textbooks/` at the aruvi-saas ROOT (outside `data/content/`) is the one true
PDF home for ALL subjects (english/maths/science/SS/TWAU per grade incl. ix) — Project Aruvi's
`knowledge_commons/textbooks/` no longer exists on disk, so CLAUDE.md §10's "authoring still
draws on Project Aruvi knowledge_commons" is stale for textbooks (framework source PDFs do still
live there).

---

## 2026-07-15 — SS Chapter Organization = the bipartite FLOW VIEW (edge model; full suite 18/18 green; live + mobile pass pending)
The rewritten middle-SS constitutions (docs/middle_ss_constitution_rewrite_brief.md; LP v2.7+
emits `competency_edges[]` per period — zero/one/many (unit × competency) edges, each owning one
implied LO + cognitive demand) make competency a MANY-TO-MANY overlay, not a spine: a 3-edge unit
would live in three accordion folders, a 0-edge unit in none. Founder explored four visual
concepts on the real vii ch_04 edge plan (`docs/mockups/ss-chapter-organization.html` — teaching
rail + tags / loom threads / two lenses / bipartite flow) and picked **Concept 4, the flow view**,
with amendments: (a) weight tier is NEVER a colour — plain name + the allocation report's dots
(●●● Central · ●● Substantive · ● Present); colour is reserved for competency IDENTITY;
(b) tapping either side opens an inline POPUP below the tapped element (competency → its full
text; unit → number · full title · minutes) — so navigation moved INTO the unit popup as
"open unit →"; (c) NO tick rail in the header for this view (unit rows already carry
taught/now states). Implemented:
- **SS port (`social_sciences/subject.py`):** edge-model plans detected by `competency_edges` →
  `_edge_model_lp()` emits ONE flat `Group(type="unit", label="Units", meta.edge_model)` in the
  plan's own teaching order; edges carried VERBATIM on `Period.meta.competency_edges`;
  `learning_outcomes` gathers the edges' LOs (data for the assessment link, never LP display);
  `inclusivity` + `section_context` carried in meta; chapter-level `competency_gap_note` rides
  `LessonPlanView.meta`. Old single-`competency` plans keep the contiguous-run competency
  accordion unchanged (viii ch_04 verified). `_join_approaches` factored out (shared by both
  branches). NOTE: `as_list()` stringifies dicts — never use it on edge lists.
- **Renderer (`LessonView.jsx` `SSFlowBody`, gated by `ssFlow` in `ChapterOrg`):** units left
  (47%, pre-colon short titles, done/cur states, "—" on zero-edge units), competency ledger right
  (33%, code coloured by identity, tier name + dots, "N of 11 units"), SVG cubic-bézier ribbons
  between (measured via `useLayoutEffect` + refs, re-measured on focus change since popups push
  layout, and on window resize). Ribbons are CONNECTIONS, never time (a unit's minutes are never
  divided across edges — weights are emphasis, not arithmetic): width = tier (5/3.5/2.5), rest
  opacity .28, focused .75, others .05. Tap-to-focus on either side; gap note renders as a dashed
  quiet card only when non-empty; mono hint line when nothing focused. Axis legend row: "The map".
  Identity palette: pine, clay, ochre + NEW tokens `--ss-slate`/`--ss-plum` (:root + dark palette
  block — dark works free via var redefinition); 6th+ competency falls back to ink-soft.
  `OverviewPanel` axis row extended: groupType "unit" + section_anchor → "Section" row (same rule
  as the old SS competency suppression).
- **Tests:** new fixture `tests/fixtures/ss_vii_ch04_edge_saved.json`; `test_ss_port.py` gains
  edge-model parity tests (flat unit group in teaching order; edges carried with count parity;
  zero-edge units allowed; gap note in meta). FIXED pre-existing failure: `test_lp_standard.py`'s
  approach SRC map never learned SS v2.7's `pedagogical_approaches` (list) — the vii edge plan
  failed "approach unexpectedly set" BEFORE this work; now handled like English's list case.
  Full suite **18/18 green**; `test_unit_order` passes 38 plans incl. the flat SS group.
  JSX babel-parses clean, CSS balanced. STATIC only — sandbox can't `next dev`; live render +
  mobile (360×800 first) pass pending, incl. ribbon geometry on real iOS Safari.
- **REV (founder, same day):** (a) the header FREEZE ends at the hairline rule for the SS flow
  view only — the axis blurb ("The map …") + Notes tab now SCROLL with the unit list there
  (`axisWrap` extracted in ChapterOrg, placed inside co-stick for every other subject,
  after it for ssFlow); (b) competency card is STACKED — code on top, tier name in the middle,
  PROMINENT dots at the bottom (10px/4px tracking) — and the "N of 11 units" count is REMOVED
  (the ribbons say where it lives); (c) **popup style = "lifted note + identity rule"**
  (founder-picked from three shown options; the sunk-paper fill read dull) — paper-white card,
  soft lift shadow, 3px LEFT rule carrying the tapped competency's thread colour, unit popups
  taking their STATE colour on the rule (clay = now, pine = taught, hairline = ahead; echoes
  the Chapter Notes notebook's clay margin rule); (d) **"open unit →" moved to the TOP of the
  unit popup** as a plain pine text link (a solid pine-filled pill variant was tried then
  UNDONE, founder same day); (e) **unit focus also opens its connected competencies' popups**
  in the right column — **always FULL text; NO automatic wheeling** (final rule, converged
  over FOUR same-day founder iterations and settled by a LIVE Claude-in-Chrome verification:
  three successive measured criteria — vs unit column, vs unit column with a single-popup
  exemption, vs viewport allowance — ALL over-triggered, because competency texts run 6–13
  lines against ~30–85px of column slack, and on phone-width viewports (verified at 280×629
  device emulation) any height threshold trips for every multi-edge unit, capping exactly
  the text the teacher opened to read). Popups in this layout PUSH the cards — a box can
  never physically hit another — so the page simply grows and scrolls. The wheel apparatus
  (`wheelOn` state, `focusTo` reset, `.cof-pop-wheel/-scroll/-fade` CSS, the mockup's
  `render(second)` two-pass) is KEPT DORMANT in code should a genuine collision case appear;
  nothing sets wheelOn today. Ribbons stay correct because measure re-runs on focus +
  wheelOn change. Live-verified 2026-07-15 in Chrome (localhost:3000, Kumar1, SS vii ch_04):
  flow view renders, freeze ends at the hairline, zero-edge "—" on units 10/11, unit-8 focus
  highlights 3 ribbons + opens 3 full competency texts + unit popup with top "open unit →".
  Mockup Concept 4 synced.
- **Axis blurb trim (founder, same day):** removed the "Lines are links, never time."
  sentence from "The map" legend (app + mockup).
- **Navigation moved OUT of the popup (founder, same day, live-verified):** users struggled
  to find "open unit →" inside the graphic — the per-popup link is REMOVED; instead ONE
  `.cof-opentop` link ("open unit NN →") renders above the unit column, directly under the
  axis blurb, only while a unit is focused, and opens that unit. Unit popups now carry just
  number · title · minutes (+ the zero-edge quiet note). Mockup synced.
- **TRIED AND ROLLED BACK IN FULL (founder, same day) — mobile map overlay + freeze trim.**
  Two companion changes were built, live-verified, then UNDONE at founder request: (a) a
  mobile-only (≤600px) full-screen map overlay — inline map as non-interactive preview, tap
  opened a portaled full-screen popup with ✕, body scroll locked, "open unit →" closed and
  navigated; (b) a freeze trim where only the Aruvi app header stayed pinned (tabs + org
  header scrolled; chapter title 23 → 17px via a `body[data-ssflow-org]` flag). The org page
  keeps the INLINE interactive map and the standard co-stick freeze (ending at the hairline
  under the meta). If the overlay idea returns, two hard-won findings from the attempt:
  (1) `<main>` is a stacking context (position:relative; z-index:1) BELOW the z-6 sticky
  header — any position:fixed overlay rendered inside main paints UNDER the header regardless
  of its own z-index; portal to document.body (the app's other in-place fixed modals —
  chapter-notes, mc-modal, choice-pop — may share this defect, unaudited); (2) `--hdr-h`
  (measured in page.jsx) is the right top offset to keep the app header visible above an
  overlay. Incidental keeps from the live pass: edge-model Overview rows confirmed live
  (Section "The Varṇa–Jāti System" + Pedagogy "Issues-based learning" on unit 8's tabs).
  NOTE a "row opens / edge-dots
  focus" tap-contract variant was built then UNDONE (founder, same day) — unit-row tap stays
  FOCUS + popup, with navigation inside the popup as "open unit →". If tap-to-open ever comes
  back, the reverted approach (per-edge identity-coloured dots cluster as the focus handle)
  is in this chat's history / git if needed.

## 2026-07-14 — Maths-secondary LP section TITLES rejoined from coverage_handoff (suite green)
Reported: maths secondary (e.g. ix ch_02_20260618_102702.json) showed bare section numbers
("2.1") as LP group labels, while the prototype showed the section names. Cause: secondary maths
periods carry only `section_anchor`; the human title lives in the result-level
`coverage_handoff` (`section_ref` + `section_title` + `period_numbers`) and
`MathematicsSubject.lesson_plan_to_view` never joined it — the prototype's app.py
maths-secondary branch DOES (`_ho_by_period` primary / anchor fallback →
`section_title: ho.section_title or anchor`). Fix (aruvi_core/subjects/mathematics/subject.py):
same rejoin as science's `_secondary_lp_groups` — build ho_by_period (period_numbers) +
ho_by_ref (section_ref, with section_label fallback) from `raw.get("coverage_handoff") or
lp.get(...)` (works because callers pass the FULL saved result, §3e); secondary group label is
now the section NAME (founder amendment same day: the section NUMBER is noise in maths LP
labels — secondary shows `"Introduction"`, middle shows `"Simple Expressions"`; the anchor/ref
stays the grouping KEY and lives in group meta, surfacing as the label only when no title
exists), and group meta carries `section_anchor` + `section_title`. Shared-section chapters
join correctly (ix ch_02: 2.3 → periods [3,9], 2.6 → [6,7,8,10]). Prep ("Lesson" +
per-period section_label meta) verified unchanged. Label flows to the UI
via `u.context` → Overview "Section" row + chapter-organization accordion, and to the export
renderer via `Group.label` — no renderer change needed. Tests: maths_port, lp_standard,
view_model, render all green. Live + mobile pass pending as usual.
**Same day — SECONDARY PERIOD SEQUENCING: contiguous-run grouping replaces first-appearance
merge (maths + science).** Reported: ix maths ch_02's unit order differed between prototype
and SaaS. The prototype renders `periods[]` flat in period_number order; SaaS grouped by
`section_anchor` via a first-appearance dict, so REVISIT periods (the plan returns to 2.3 at
period 9 and 2.6 at period 10, after teaching in between) were pulled up into the earlier
group — the flattened LU rail (and the POINTER) read 1,2,3,**9**,4… steering the teacher into
a consolidation revisit out of sequence. Founder rule: **the plan's period_number teaching
order is the contract.** Fix in BOTH `mathematics.lesson_plan_to_view` and
`science._secondary_lp_groups`: group by contiguous runs of the same anchor (new group
whenever the anchor changes; a revisited section appears again as its own group). Science had
the same latent bug live (ix ch_02 revisits §2.3.1 at period 10). Verified: maths ix ch_02 →
1–10 in order, ch_07 → 1–11 (its consolidation period 11 had shown as unit 8); science
ix ch_02 → 1–11; middle/prep orders unchanged; maths, science, lp_standard, view_model,
render, allocate suites all green.
**Made STRUCTURAL (same day):** a corpus sweep found Social Sciences ALSO reordering (5
plans — interleaved competencies; viii ch_04 read 1,3,10,2,5,…), so
`social_sciences.lesson_plan_to_view` got the same contiguous-run grouping (a competency the
plan returns to appears again as its own group), and **NEW standing test
`tests/test_unit_order.py`** sweeps EVERY saved plan in the corpus asserting flattened
view-model order == the plan's periods[] teaching order (same depth-first walk as
LessonView's flattenUnits) — any translator regression, or a new subject repeating the
first-appearance-merge idiom, fails the suite the day its first plan is saved. All 41 plans
pass; all port suites green. English + science-middle kept their dict-merge idiom (no corpus
violations today) — the test is the guard, not a rewrite.
**"(Revisit)" marker (same day, founder):** a repeated section heading on the chapter-org page
could read as a mistake — so when a maths/science SECTION group re-opens for an anchor already
seen, the engine appends " (Revisit)" to the group label (+ `meta.revisit: true`), done in the
translators so the export renderer inherits it. Marked only on exact-anchor repeats: science
ix ch_02 period 10 gets it, period 11 does not (its anchor "…(Nucleus sub-section)" is a
DIFFERENT anchor, i.e. deferred depth, not a repeat). SS competency repeats deliberately NOT
marked — content marches forward there; only the tag repeats, so "Revisit" would be false.
Constitutions untouched (founder: tightening the revisit rule risks unintended consequences).
**Same day — maths-prep axis legend (LessonView.jsx):** the chapter-organization axis legend
was gated `axisTypes.length && !mathsFlat`, so maths PREP (the flat single-"Lesson" case) was
the ONE subject·stage with no axis description. Founder: it must not vanish. Fix: mathsFlat
gets its own legend row — name "Units", blurb "one continuous run of learning units in the
textbook's own teaching order — the activity-led, play-way flow the NCF asks of the
preparatory stage. Tap a unit to open it." (tap hint differs from the accordion's "Click each
card to access units underneath" because flat cards ARE units). Babel-parse clean; STATIC
only — live + mobile pass pending.

## 2026-07-14 — Scaffold row-split: fill-in templates no longer run together in one paragraph (full suite green; live pass pending)
Reported bug: TWAU (and any constitution/maths-family) assessment SCAFFOLD blocks rendered as
one continuous paragraph — numbered/step items ran together. Cause: `n.scaffold` was carried as
raw text and rendered inside `.assess-look-t`, which collapses whitespace, so authored `\n`
breaks vanished; and the TWAU V ch05 shape packs "Step 1 — … Step 2 — … Step 3 — …" inline with
NO newlines at all. Fix follows the split-once-in-the-engine rule (like `split_parts`): new
`assessment_norm.split_scaffold_lines()` → `NormalizedItem.scaffold_lines` (set in `_finish`, so
every family gets it). Authored newlines are always row breaks; a single line packing a
sequential `Step N` / `(N)` / `N.` run (≥2) is additionally split; a blank authored line survives
as `""` (Part A / Part B spacer); a lone unnumbered line / empty → `[]` (renderer falls back to
plain prose, e.g. the Science single-paragraph scaffold). Renderer: new `AScaffold` in
`LessonView.jsx` (replaces the `<ABlock k="SCAFFOLD">` call) renders rows via `.assess-scaf-row`
(`white-space:pre-wrap` keeps fill-blank spacing like "Name: ___   Role: ___"); flat + dark
overrides added. Verified against all real corpus scaffold shapes (rangoli parens, name-rows,
inline steps, newline steps, Part A/B, science prose). Full suite **17/17 green** (added
`test_split_scaffold_lines_breaks_rows`); JSX babel-parses clean, CSS balanced. STATIC only — the
sandbox can't `next dev`; live + mobile render check still owed.

## 2026-07-13 — Table-in-stem dedup: structural strip in the normalizer (full suite green)

An assessment stem that packs a table AS raw pipe-markdown (`| 283 | ___ | 285 | ___ |`)
while ALSO carrying it in `visual_stimulus` made the figures render TWICE — once as raw pipe
prose in the stem, once as the typed table. Reported on `mathematics/iii/ch_06_20260603_180712`
**Q-C-1**. Fixed STRUCTURALLY (not by back-editing the JSON) at the shared normalization point,
mirroring the maths-MCQ `expected_answer` drop: new `assessment_norm._dedupe_stem_table(n)`,
called first in `_finish()` so it runs for EVERY family. If the stem's pipe lines classify as a
TABLE, they are stripped from the stem; when no `visual_stimulus` carries the table yet, the
stem's table is PROMOTED into `visual_stimulus` (never overwriting an authored one — that copy
is authoritative and usually more complete, e.g. Q-C-1's has the `Tile 1..6` header). Non-table
stems (a stray single pipe) are untouched. Corpus scan found 4 affected items, all now
instruction-only stems + table in `visual_stimulus`: **Q-C-1 / Q-C-3** (iii/ch_06 SCR, dup
stripped), **Q-B-2** (vii/ch_04 ECR, matchstick table stripped, before/after prose kept),
**TWAU iv/ch_07 OPEN_TASK** (empty Floaters/Sinkers grid promoted — it had no `visual_stimulus`).
Reads clean without regeneration. Full suite **17/17 green** (test_api needs `pip install
fastapi httpx` in the sandbox). Render path unchanged (renderer already types tables / shows
instruction-only stems), so no UI/mobile change. Parallels the English FILL_IN anti-duplication
rule (item 12 in the pre-warm checklist) but does it in the engine, not the constitution + data.

## 2026-07-11 — Assessment sub-part parsing lives ONCE in the engine + English N-to-N item→period pairing (STATIC + full suite green; live pass pending)

Two structural fixes to the assessment path today, both driven by the same principle:
**a change is only "once, everywhere" if it operates on a MODELED structure in the canonical
view model — not on prose whose surface form varies by authoring convention.** Render-time
heuristics silently miss any notation they weren't written for.

**1. Numbered/lettered sub-parts are now parsed ONCE, in normalization — never at render time.**
- **The problem (recurring):** answer keys AND question stems pack multi-part lists into ONE
  prose string — Maths `(a) … (b) … (c) …`, English FILL_IN `1. … 2. … 3. …` (often with a
  lead-in + `[Box: …]`). The renderer printed them as a paragraph. A first fix put a regex
  splitter in the React renderer (`splitAnswerParts`) — but that only knew `(a)/(b)/(1)`, so
  English's `1. 2. 3.` still rendered as a blob (English IV *Together We Can*, P5 Q-WW-A-2).
  Classic authoring-convention coupling.
- **The fix (structural):** `assessment_norm.split_parts(text) → (lead, [{marker,text}])` is the
  ONE place notation knowledge lives (parenthesized `(a)/(i)/(1)` with opening-paren required;
  plain `1. 2. 3.` only when the run starts at 1 — guards against a lone `15. …` answer or
  scattered figures `Factors of 8: … 8. … 21.`). `_finish()` — the shared tail EVERY subject
  normalizer already calls — runs it on both `stem` and `model_answer`, populating new
  `NormalizedItem` fields: `stem_lead`/`stem_parts`, `answer_lead`/`answer_parts`
  (`view_model.py`). Pruned on the wire when empty.
- **Renderer is now dumb:** `APartsList` in `LessonView.jsx` renders whatever list it's handed
  (question stem + answer block both use it). The JS `splitAnswerParts` heuristic is **DELETED**.
  ⚠️ **Do NOT re-add a render-side splitter.** If a NEW notation ever appears, extend
  `split_parts` in the engine — every subject and both surfaces pick it up automatically.
- **Corpus effect:** structured 95 stems + 46 answers across 382 items (incl. multi-part science
  `(a)/(b)/(c)`); non-lists left whole. Tests: `test_normalized_item.py`
  ::`test_split_parts_structures_prose_once` (unit cases + real English item);
  serialization-prune + full suite still green (16/16, `test_api` needs `pip install fastapi
  httpx --break-system-packages` in the sandbox).

**2. English item→period link: N items ↔ N periods now pair POSITIONALLY (anchor step unchanged).**
- **The bug:** the Rule-7 `(section, spine)` join is coarse. When ONE (section,spine) is taught
  across several topic-periods each with its OWN item (English IV: section A `word_work` over
  P4 *Collective Nouns* + P5 *Position Words*, with a MATCH item and a FILL_IN item), the join
  gave BOTH items the union `[4,5]` and `stamp()` anchored both at the close (5). So P5 showed
  the collective-nouns item (mismatch) and P4 showed nothing.
- **Key distinction (founder):** the anchor mechanism is for a REAL span — one item re-tested
  across periods (e.g. one oracy item over P2–P3, correct). The word_work case is a FALSE set:
  two items, each belonging to one period. Fix = stop building the false set, not touch anchoring.
- **The fix (`subjects/english/subject.py` `assessment_to_view`):** group items by key; when a key
  has N items AND exactly N periods (N≥2), pair positionally (authoring order ↔ teaching order)
  → each item gets a singleton, anchors to its own period. Every other shape (1 item / many
  periods = true span, or a count mismatch) keeps the full set + existing anchor-at-close.
  `stamp()` is never changed. Result: Q-WW-A-1→P4, Q-WW-A-2→P5; oracy `[2,3]→3` intact.
  Test: `test_link_resolver.py`::`test_english_n_to_n_positional_pairing` (382 items / 41 plans,
  0 orphans still hold).
- **Standing caveat:** positional pairing assumes items are authored in teaching order (true across
  the current corpus). The fully-robust version needs a period/task ref on the item, which the
  data doesn't carry today — revisit if a plan ever authors items out of order.

Both are SERVER-SIDE Python — a running uvicorn won't pick them up until restarted
(`python3 -m uvicorn api.main:app --port 8000`) + browser hard-refresh. Sandbox can't run the
live server (§11), so live + mobile render check on English IV *Together We Can* P4/P5 is pending.

## 2026-07-10 — PER-ITEM ASSESSMENT TABS: Overview · Question · Answer · Inclusivity (STATIC only — live + mobile pass pending)

> ★ **REV. 2, same day (founder) — palette + layout revision, supersedes the green-box
> details below.** The green artifact box, the "ASSESSMENT · THIS UNIT" tag, the white
> card chrome and the Q{n}/type header are ALL RETIRED for normalized items — the item
> sits FLAT on the unit's paper in the site palette (`.assess-flat` wrapper re-palettes
> the shared ABlock/ATicks/AReveals/options/otg pieces to pine via CSS overrides; the
> shared classes themselves are untouched — legacy cards still use them green-on-white).
> Order inside the ASSESS tab: **PINE question pager** (top, immediately below the unit
> tab row, ONLY when >1 item; pine — NEVER clay — is what distinguishes it from the clay
> unit strip) → per-item tabs (pine underline, one notch smaller than the unit bar) →
> panel. Overview ledger: ONLY the Outcome value is right-aligned (`.assess-ovv-r`);
> Type / **"Cognitive demand"** (label renamed from "Demand") / Competency read left
> beside their labels (`.assess-ovrow-l`). Dark mode: the new rows/tabs use theme tokens
> (`--line`/`--line-soft`/`--pine`), so the earlier hardcoded-green dark overrides for
> them were removed. Spec `docs/mockups/assessment-item-tabs.html` rewritten to rev. 2.
> Single-item units render the bare tabs directly under the unit bar (two pine underline
> bars adjacent — flagged to founder, accepted pending live look).
>
> ★ **REV. 3, same day (founder) — the UNIT tab bar's active underline is now CLAY**
> (`.uv-tab.on` → `var(--clay)`). Color grammar: **CLAY = unit level** (unit tabs +
> clay unit strip), **PINE = assessment level** (question pager + per-item tabs) — this
> also dissolves the adjacent-twin-bars concern from rev. 2. Both mockup specs updated.
>
> (A rev. 4 — pine underline on the ASSESS unit tab alone + assessment Overview labels
> matched to the unit kicker — was applied and then **UNDONE at founder request the same
> day**; final state is rev. 3: all four unit tabs clay, `.assess-ovk` mono 10px / .1em /
> ink-soft. Don't reintroduce without a fresh ask.)
>
> ★ **REV. 12 (founder) — Chapter Organization polish.** (a) Accordion axes: the OPEN
> axis stays filled (warm `--paper`) while CLOSED axes are the **SAGE TINT** —
> `--tint-pine` fill + `--edge-green` border, pine border on hover (candidate A of
> three shown; white was tried first but matched the unit capsules and read confusing;
> clay rejected — it's the unit-level color; sunk paper rejected — reads disabled).
> Pine tint = "this responds to touch". `.co-acc.open` class added in ChapterOrg JSX.
> (b) The org page top kicker is now `{subject} · {CLASS} · Ch. NN` — class as
> uppercase Roman only (any "grade"/"class" word stripped from the value), chapter
> zero-padded "Ch. 01" (was "{subject} · Chapter N").
>
> ★ **REV. 11 (founder) — preview header merged to one row.** The unit view's back
> button no longer costs the top row: the topbar (empty span + back) is gone; the
> name-plate moved UP into row one — title left (`flex:1, min-width:0`, wraps freely),
> `← back` beside it top-right (`.lv-hd-merge`; data-tour="preview-back" rides along).
> Tour step 4's hand still finds the button. Tracking view header untouched.
>
> ★ **REV. 10 (founder) — teacher notes moved to the LESSON tab, one home only.**
> Rationale (discussed in-session): notes are read WITH the lesson (prep + mid-class
> reminder), not with the Overview ledger — but a full clay block would push phase 1
> below the fold. Resolution: a **collapsed clay teaser ribbon** at the top of the
> lesson spine (`.uv-tnotes-rib`, `<details>` — kicker + first words ellipsized on one
> line, +/– affordance, expands in place to the full italic margin note; same clay
> voice as the classic `.uv-tnotes`). OverviewPanel no longer renders notes at all
> (its empty-state check drops the notes clause); `data-tour="lesson-notes"` moved
> with the ribbon. NOTE: founder's local Overview now also carries a "Chapter" row.
>
> ★ **REV. 9→9b (founder):** when a unit anchors **>1 item**, a **"Q{n}." marker**
> (`.assess-qmark`, italic display serif, pine) appears on EVERY panel. 9b: it is
> **13px (two notches down from 16) and FLOATED left** — shares the row with the
> panel's opening words (Learning outcome / stem / answer / inclusivity), never a full
> row of its own. Single-item units show no marker (`qn` prop on `AssessBody`, set only
> when `many`); legacy cards get the same marker. Float-vs-first-line vertical
> alignment (padding-top:3px compromise across the four panels' differing top offsets)
> is a live-pass tuning point.
>
> ★ **REV. 8 (founder):** the Overview's "Type" label is now **"Question type"**, and
> question-type VALUES always render as full words, never acronyms — `QTYPE_NAME` map in
> LessonView.jsx (MCQ → "Multiple choice question", SCR → "Short constructed response",
> ECR → "Extended constructed response", TRUE_FALSE → "True or false", FILL_IN → "Fill
> in the blanks", MATCH → "Match the following", NUM → "Numerical problem", ORAL_PROMPT
> → "Oral prompt", EXTRACT_ANALYSIS → "Extract analysis", plus Open task / Project /
> Writing task); unknown types fall back to underscore-spaced raw. Applied to the legacy
> card's type line too (`qtypeName(it.item_type)`).
>
> ★ **REV. 7 (founder) — frozen assess chrome + one text size.** (a) Under ASSESS,
> everything down to and including the item tab bar stays pinned: `AssessPanel` now owns
> the item-tab state (lifted out of the card — `AssessCard` became `AssessBody`, active
> panel only; `itemTabSet()` computes the tab list) and renders pager + item tabs in ONE
> sticky `.uv-assess-stick` group whose `top` is measured at mount (app nav + preview's
> `.lv-stick` height — variable with title wrap; re-measured on resize). Integrates with
> the founder's own local split of UnitTabs into `useUnitTabsParts` + `PreviewUnit`
> (which pins the UNIT bar inside `.lv-stick` in preview) — so in preview the frozen
> stack is header → unit tabs → pager → item tabs; in tracking the pager + item tabs
> pin at nav height. z-index 3 (below .lv-stick's 4). (b) QUESTION and ANSWER share one
> text size — stem, options, answer blocks, ticks, reveal rows all 13.5px (stem was 15,
> options 14, blocks 13).
>
> ★ **REV. 5→6 (founder, final):** the assessment Overview's LO is no longer a
> label/value ledger row — **"Learning outcome" is a BOLD single-row heading**
> (`.assess-ovk-b`) **with the outcome text below it as a normal left paragraph**
> (`.assess-ovlo`/`.assess-ovlo-t`; the brief two-line-label + right-aligned-value
> form of rev. 5 was superseded within the hour — `.assess-ovv-r` is gone). Type /
> Cognitive demand / Competency stay as left-reading ledger rows. Specs + CLAUDE.md §3
> synced.

Founder-directed follow-on to the unit tabs (same day): inside the unit's green ASSESS
tab, EVERY normalized item now carries its own four-tab set — same interaction grammar,
one notch quieter, assessment green. Spec `docs/mockups/assessment-item-tabs.html`;
impl `LessonView.jsx` (`AssessCard` + `AOverviewPanel`/`AQuestionPanel`/`AAnswerPanel`).

- **Slotting (the audience test, agreed in-session):** OVERVIEW = why it's asked (LO —
  absent-not-blank when null, the old always-visible `.assess-lo` strip retired into
  this tab — · type · cognitive demand · competency, as green ledger rows
  `.assess-ovrow`). QUESTION = everything said/shown to the class: extract → stem →
  listening cue → stimulus → **PLAIN options, NO correct tick** (founder: the phone can
  face the class) → what-to-produce → scaffold → the open-task reading guide (format /
  what-this-demonstrates / reading-the-scaffold — still a collapsed `<details>`) →
  textbook ref (numeric's `exercise_ref` is task-setting, moved out of the marking
  surface). ANSWER = everything work is checked against: correct option(s) ✓
  (`.assess-corr-row`), model answer / key, **what-each-choice-reveals (moved here from
  the guide slot — diagnosis happens at marking time)**, expected elements, look-fors,
  method line; tab EXISTS only when populated. INCLUSIVITY = its own tab (founder:
  class diversity is first-class); exists only when populated.
- **`strong_vs_weak_markers` is DATA-ONLY** (founder 2026-07-10): carried in
  NormalizedItem, never rendered — verbose (~70 words in the Science VI magnets
  example, `saved_plans/science/vi/ch_04_20260522_130837.json` item 11) and largely a
  restatement of expected elements + look-fors. Same carry-don't-render pattern as LO
  in the LP, Science roles, homework caps. 16 saved plans carry the field.
- **Pager gated on item count** (`AssessPanel`): >1 anchored item → the green
  one-question-at-a-time strip (`.uv-apager`, the assessment's version of the clay
  unit pager; card keyed by index so paging resets its tabs to Overview). Exactly 1
  item → plain card, no pager chrome.
- Card header is now `Q{n}` (italic display serif, green) + "TYPE · demand" mono —
  the old `.assess-metarow` type/cog pills are gone. Legacy (pre-contract) items keep
  the flat card + LO strip, no tabs. Dark mode: `.assess-mtabs`/`.assess-ovrow`
  borders → `--edge-green` in the dark border block.
- Verified STATICALLY only (esbuild clean, CSS balanced, strong_vs_weak referenced
  only in the design comment). **Live render + 360 px pass pending** — check tabs
  inside tabs (unit bar vs card bar) legibility, and a real multi-item unit for the
  pager (most units anchor 1–3 items per the §I-ter anchor rule).

## 2026-07-10 — TABBED UNIT ANATOMY: Overview · Material · Lesson · Assess (STATIC only — live + mobile pass pending)

Founder-directed restructure of the Learning-Unit view (the LP screen read "jumbled"):
the 2026-07-09 stacked anatomy is UNCHANGED in content but re-organized behind four
per-unit tabs (`UnitTabs` + panel components in `LessonView.jsx`; spec mockup
`docs/mockups/lesson-unit-tabs.html`).

- **Header keeps only the name-plate** — clay unit number + title (+ chapter kicker,
  unit count / pv-nav). Spine, time and pedagogy MOVED OUT of both the tracking header
  (old stage-kicker + durline) and the preview sticky header (old `lv-topspine`
  "Spine:…" + `lv-tpline` Time/Pedagogy) into the OVERVIEW tab as ledger rows
  (`.uv-ovrow`: mono label left — group-type spelled via `CTX_LABEL`, e.g. spine→Spine,
  section→Section — serif value right) above the clay teacher-notes block. The preview
  topbar now shows the chapter-title kicker instead of the spine.
- **LESSON tab** = the timed phase spine + homework only (nothing to scroll past
  mid-class). MATERIAL = the checklist (quiet empty line when a unit needs nothing).
  Overview/Material/Lesson always render; **ASSESS exists only when the unit anchors
  items** (`unitAssessItems` — the same §I-ter anchor logic the retired 3b sub-view
  used, legacy no-anchor fallback preserved). The ASSESS panel renders the SAME
  green cards (`AssessCard` untouched) inline in `.uv-assess`; the full-screen
  3b artifact branch + `showAssess` state are REMOVED (its `.assess-*` CSS remains —
  cards still use most of it). `UnitTabs` is keyed by unit index (`key={cur}` /
  `key={previewAt}`) so paging resets to Overview.
- **Tab bar** `.uv-tabs`: four equal-width mono-kicker buttons, pine underline when
  active, green for ASSESS; sized to hold at 360 px without scrolling. Dark mode:
  `.uv-assess` added to the paper-2 surface list.
- **GuidedTour step 8** re-anchored: tipAnchor `["unit-tabs", "lesson-phase-1"]`
  (`data-tour="unit-tabs"` on the bar; body copy now names the four tabs).
  `lesson-notes` / `lesson-phase-1` data-tour attrs kept on their blocks.
- Verified STATICALLY only (esbuild-parse clean both files, CSS braces balanced,
  no stale refs to UnitBody/showAssess, external callers unaffected — MyPlans/
  MyLessonPlans pass only view/sectionKey/onExit/preview). **Live render + 360 px
  mobile pass is the immediate must-do**; check the tour step-8 placement live.

## 2026-07-10 — NORMALIZED ASSESSMENT ITEMS + 3b TEMPLATE RENDERER (STATIC only — live pass pending)

The question-type-registry build order (spec §7) steps 1–3 are DONE; suite **16/16 green**
(new `tests/test_normalized_item.py`; test_api needs `pip install fastapi httpx` in a fresh
sandbox).

- **Contract landed** (`aruvi_core/view_model.py`): `QuestionType` enum + `RENDER_TEMPLATE`
  (type→template map) + `NormalizedItem` dataclass; `AssessmentItem.normalized` carries it.
  ⚠️ **The registry doc says "11 types" but its own §3/§5 lists — and the corpus — hold
  TWELVE** (MCQ, TRUE_FALSE, SCR, ECR, OPEN_TASK, PROJECT, WRITING_TASK, FILL_IN, MATCH,
  ORAL_PROMPT, NUM, EXTRACT_ANALYSIS; all 12 exercised by saved plans). Enum has 12; the
  spec prose miscounts. Templates: selected_response·scr·ecr·open_task·cloze_match +
  oral/numeric/passage (T6's three variant bodies keyed flat).
- **Family builders** (`aruvi_core/assessment_norm.py`): `from_constitution` (Sci/SS/TWAU),
  `from_maths`, `from_english` — the spec §4 mapping. Called by each plugin's
  `assessment_to_view` AFTER `stamp()`; link fields mirrored into the normalized item.
  Discovered/locked: **Maths secondary is a hybrid** (top-level expected_answer/
  method_one_line + constitution-style `guide{TYPE}` + look_for/expected_elements — builder
  reads both shapes). **SS + TWAU wrote the guide FLAT by their own constitutions'
  design** (`guide.what_each_option_reveals` etc. directly under `guide`) while Science
  nests under the type key — RESOLVED at source per the English-fix playbook (founder
  directive, same day): **SS assessment constitution → v1.7 and TWAU → v1.3 amended**
  (Rule 9 + JSON schema blocks now mandate `guide.{TYPE}` nesting, matching Science + the
  registry §1 shape; new PROHIBITION against flat placement; population-table column header
  now "guide.{TYPE} keys required"), and **all SS/TWAU saved plans migrated in place** —
  pure structural relocation (`guide` → `{question_type: guide}`), strict pre-write deep-diff
  proved zero content change outside the relocation; corpus scan post-migration: 194 nested,
  0 flat. The builder's flat read is retained as a corpus-unused legacy fallback (mirror of
  the English `note` tolerance). Also converted the **third English prose-note MCQ** the
  earlier English migration missed (`english/iii/ch_02_20260526_184454.json` Q-READ-B-1:
  A:/C:/D: prose parsed into the keyed map, reassembly-verified, note cleared) — the ONLY
  note-only MCQ left in the corpus is the genuine `[Verification failed]` fallback
  (ch_02_20260510, which also deliberately flags ALL options correct — test asserts ≥1
  correct, not ==1). SS/TWAU duplicate SCR/ECR rubrics into the guide, but top-level fields
  carry them too (top stays the single read). `annotation` prose → `option_reveals["note"]`
  kept as a true last resort (now fires on nothing). TWAU `observation_rubric`
  (performance_task=true) added to _OT_GUIDE_KEYS — no corpus item carries it yet.
  cognitive_demand ""≡absent → None; audio_ref only English+listening; EXTRACT_ANALYSIS
  extract → `passage`. Note: saved plans + constitutions under data/ are git-ignored — the
  migration has no VCS trail beyond this entry. Sandbox quirk: overwriting some saved-plan
  files via the mount hits EPERM — write a `.tmp` sibling + `os.replace`.
- **Serialization**: `ViewModel.to_dict` prunes normalized blocks — **omitted, not blanked**
  (keep-set: question_type/template/stem/linked_periods/anchor_period). Maths mid/prep ship
  with NO `linked_lo` key. **Tables ship PRE-SPLIT** (`{"type":"table","content",
  "table":{header,rows}}` via parse_table) so no JS re-splits pipes. Verified through the
  live API: all 41 plans / 382 items serve well-formed normalized blocks (149 selected ·
  95 scr · 34 open_task · 32 numeric · 30 ecr · 25 cloze · 15 oral · 2 passage; 11 audio
  cues; 44 pre-split tables).
- **3b renderer rebuilt** (`LessonView.jsx`): `AssessCard` + ATyped/ABlock/ATicks/AReveals
  switch on `n.template` ONLY — subject never consulted. Card anatomy: per-item LO (absent
  not blank) → type + cognitive chip → stem (pre-line) → audio cue ("🔊 Listening passage ·
  p.NN (read aloud)") → typed stimulus (passage BEFORE stem for EXTRACT_ANALYSIS) → the
  template's marking surface (options w/ quiet ✓ + what-each-choice-reveals · suggested
  answer/look-for · answer key · worked answer/method/textbook · speaking rubric · what-to-
  produce/expected elements + collapsible OPEN_TASK guide `<details>`) → inclusivity.
  Legacy items (no `normalized`) fall back to the old card. CSS: `.assess-*` additions +
  dark-theme mirrors in globals.css. Unit-scoping filter unchanged (meta.linked_periods).
  **3b is reachable from PREVIEW too** (founder, same day): `showAssess` is now a unit
  INDEX (null = closed) — tracking opens it scoped to `cur`, the unit preview scoped to
  `previewAt` (§I-ter: preview shows future periods, their assessment comes for free);
  back returns exactly where she was. Chapter-Org page still has no link (assessment
  belongs to the period viewer, not chapter altitude).
- **Verification: STATIC only** (acorn-jsx parse clean, CSS balanced, class/field greps,
  full pytest suite + API sweep). ⚠️ Live render + mobile 360px pass owed: 3b from
  "assessment here →" on a Science/Maths/English plan, table overflow, `<details>` tap
  target, dark mode.
- **Still deferred to generation milestone** (spec §7.4): constitution exact-counts audit
  (§J.3) + mirroring the English MCQ reveals rewrite into the generation prompt wrappers.

## 2026-07-09 — RENDERERS REBUILT to the standard anatomy (STATIC only — live pass pending)

The founder green-lit implementation; both LP renderers now speak the standard anatomy:

- **`LessonView.jsx` rebuilt.** (a) New `UnitBody` = teacher notes (clay margin-note, TOP) →
  materials (hairline box) → phases with **duration in the marginal rail** ("8 / min", from
  `Phase.start_min/end_min`; falls back to legacy `activities` lines when a view predates
  phases) → homework (tinted, full text) — **LO never rendered**. (b) New **`ChapterOrg`
  altitude** (the front door): section-card language — chapter tick rail (pine taught / ochre
  now / hairline ahead), one `co-card` per unit under quiet group-kicker dividers, collapsed
  "Chapter notes" control (placeholder). **Preview opens at chapter altitude** (org page →
  card tap → read-only unit doc → back to org); tracking defaults to the live unit with a
  "chapter organization →" link (navigation NEVER moves the pointer). (c) Header durline
  "**{dur} min · {approach}**". (d) 📝 "Add a note about this class" invoke (tracking only,
  honest coming-soon reply). (e) All copy says **Unit** (assess-sub, pvnav, aria labels,
  mark-complete cards; also fixed in MyPlans + SectionProgress aria/labels). PRESERVED
  contracts: `lu_pointer_/lu_done_` keys, pushSectionState sync, undo model, tour anchors
  (preview-root/preview-back moved WITH the landing to the org page; lesson-notes now on the
  top teacher-notes block).
- **`ViewModelView.jsx`** (Generate/PrepareLesson/Allocate preview doc): same anatomy in
  `PeriodCard` (durline·approach, notes top, materials box, phase rail, homework tint, no LO,
  Tags row dropped); group headers show description only (implied_lo stays data).
- **CSS:** `co-*` + `uv-*` blocks appended to globals.css (tokens only, dark-safe).
- **Verification: STATIC only** (acorn-jsx parse all components OK, CSS braces balanced,
  contract greps). ⚠️ Live render + mobile 360px pass on the founder's machine is the
  immediate must-do: org page (all 6 axes), unit doc, tour steps 4/7/8 anchors, dark mode.

## 2026-07-09 — LP display STANDARDIZED (founder rules) + audits

Founder rules, all implemented (details in CLAUDE.md §3 "Standard LP display rules"; suite now
14/14 incl. new `tests/test_lp_standard.py`): **LO never in LP** (assessment only; data kept);
**`Period.approach`** canonical field (TWAU dominant_mode spelled out via `_MODE_FULL`);
**Science secondary fixed** (section_anchor groups, handoff rejoin — API now passes the FULL
`result` to `lesson_plan_to_view`, both call sites); **English singleton-section collapse**
(spines = top axis for split chapters). Homework word-caps dropped; time-plan/lesson-view tabs
dropped; English inline task-refs kept.

**Audit findings (2026-07-09, 39 plans):**
- Approach coverage is NOT universal: Science ✓(approach) · Maths middle+secondary ✓(method) ·
  English ✓(methods dict) · TWAU ✓(dominant_mode) · **Maths PREPARATORY: none** · **SS: none**
  (SS periods carry competency instead). **FOUNDER DECISION (same day): NO constitutional
  change** — the field names are too diverse to flatten at source; `Period.approach` is the
  single normalization point and absorbs the diversity (empty where no source exists).
- English split confirmed: 14/16 plans were single-section; the 2 stragglers were then SPLIT
  in-repo (2026-07-09, same session) following the existing `_split_from` precedent (vi/vii/viii
  splits): Grade III old ch_01 → **ch_01 "Fun with Friends (Picture Reading)" (A, 3 periods) +
  ch_02 "Colours" (B, 4 periods)**; Grade IX old ch_06 → **ch_11 "Twin Melodies" (A, 7) +
  ch_12 "A Friend Found in Music" (B, 4)** — titles taken verbatim from the re-split summaries,
  periods renumbered 1..n, coverage_handoff spine dict + assessment spine groups filtered by
  section_id, period_rows_snapshot/schedule recomputed from actual durations, stale ix ch_06
  deleted (its content slot now belongs to "Canvas of Soil"). Library = **41 plans**, all
  prepared for Kumar1 (register updated); every English plan is now spine-top. Suite 14/14;
  287/287 phases tile. NOTE: ix ch_06 SUMMARY ("Canvas of Soil") has an empty
  main_sections_inventory — authoring-pipeline flag, not touched.
- dominant_mode ≠ free-form approach: it's TWAU's closed 5-mode taxonomy (O&R/HI/D&C/C&E/R&A),
  but it answers the same teacher question, so it maps into `approach` with full names.

## 2026-07-09 (later) — Prototype UI study: per-subject·stage element decisions (the display spec)

Founder asked how per-subject·stage display elements are decided → studied the prototype
(`../Project Aruvi`, mounted this session). The decisions live in TWO files:
**`app/aruvi_streamlit/app.py :: _normalise_lo_handoff`** (lines ~2368–2921 — detects each
subject·stage by DATA SHAPE, maps raw fields to a common render dict) and
**`app/lpa_page.html :: renderLPA`** (lines ~2364–2917 — per-subject render paths). Print
variants in `lp_pdf_generator.py`. The element matrix the prototype settled:

| | axis/grouping | header 4th col | competency/LO bars | materials | homework | notes |
|---|---|---|---|---|---|---|
| Science middle | collapsible Stage groups (first open) | pedagogical_approach | NONE (deliberate) | yes | — | Time-plan/Lesson-view TABS; roles in tab 2 |
| Science secondary | FLAT (section-anchored) | anchored section | LO at END (from coverage_handoff) | **deliberately NONE** | — (field exists, not rendered) | approach bar top; visual_aids row |
| English | collapsible Section A/B/C groups (+type pill) | TWO cols: spines + ped methods | none | yes | task_brief ≤12 words, after phases | phases substitute task refs inline |
| Maths (all stages) | flat | section title (secondary centre-aligned) | SUPPRESSED (Rule 8); ped method rides materials row | yes | book_ref+desc ≤15 words | escMath superscripts (x^2) |
| Social Sciences | flat | anchored section | competency bar TOP (c_code+weight+text); LO at end | yes | — | |
| TWAU | flat | section_ref | mode bar TOP (dominant_mode FULL name: Observe and Record…); LO at end | yes | — | teacher_facilitation_note → notes slot |

Universal: every header = Period # · duration · activity name · (subject-specific col);
time slots ("Time | description") universal; teacher notes near end for all. **How to decide
for a NEW subject·stage: the LP constitution defines what the generator emits; the prototype's
verdict per element is the mapping above — in the SaaS this translates to (a) the Group
type/label (the axis), (b) the kicker/4th-column choice, (c) which optional anatomy slots fill.**

**GAP FOUND in our normalizer:** Science SECONDARY plans misroute through the middle path —
groups come out as **"Stage None"** (progression_stage is absent; secondary is section-anchored
like Maths secondary), per-period LO/section_context (in coverage_handoff) never extracted, and
the prototype deliberately renders NO materials for sci-secondary. Fix when renderers adopt
phases: science normalizer needs a secondary branch (group by section_anchor, LO via handoff
rejoin — see prototype `_ho_by_period`/`_ho_by_label`). Also note prototype truncation rules
(homework 12/15 words) vs our full-text mockup, and English's phase-text task-ref substitution
(`renderEnglishTimeSlots`) — carry or drop deliberately when building the new renderer.

## 2026-07-09 — LP/Assessment layout principles DECIDED + all-plans Kumar1 profile

**Layout discussion with founder (LP first; assessment next session). Decisions, all final:**

- **Standard period anatomy (every subject, every period, same slots, same order):**
  rail number + axis kicker + title + duration → **Teacher notes** (top — prep reading; italic
  Newsreader, clay left rule) → **Materials** (hairline box, mono kicker) → **Phases** (the hero,
  unboxed, time in the marginal rail) → **Homework** (bottom, the one tinted block — ochre wash)
  → **Period note 📝** as an *invokable input affordance* (a control to tap, never an empty box
  taking space). Differentiation via typography + hairlines + a single tint — no colored cards.
- **Phase time display = duration, "5 min"** (not band "0–5") — fits the Learning-Unit concept
  (periods → LUs, absolute durations per arch-plan §F). Times live in the marginal numbering
  rail (same signature pattern as period `01` / `Q1`), giving a perfectly aligned time column
  at 360px with full width left for prose.
- **One timed spine per period:** phases only. Subject extras (English `tasks_in_class`, Maths
  textbook items, visual aids) render as *untimed* kicker'd supporting blocks — never a second
  timeline. **Science `roles` are IGNORED for now** (founder call).
- **View-model change required first (not yet done):** promote `Phase {start_min, end_min, text}`
  + `materials: List[str]` to first-class on `Period`; update the 5 normalizers (today
  `_phase_lines`/`band_lines` DISCARD the minutes into flat strings). Raw saved plans already
  carry per-phase minutes — parse en-dash "0–5" AND hyphen "0-10", keys `phases[].description`
  vs `time_bands[].activity` — so this is a normalizer change, NO plan regeneration. Validate
  phases tile 0 → period_duration_minutes.
- **Chapter Organization = the chapter's front door** (first open / previews); the recede rule
  stands — pointer live ⇒ opens at period, "see chapter organization" links back. Chapter Notes
  slot (collapsed control) reserved on Chapter Org; Period Note slot in the period footer.
- **Next deliverable:** VM + normalizer change, then static 360×800 mockups in `docs/mockups/`
  for the standard period view + Chapter Org page; then assessment layout (Q-rail exists).

**IMPLEMENTED same day (the VM/normalizer step + mockups; all decisions above are now code):**

- **`Phase` + `materials` are first-class on `Period`** (`aruvi_core/view_model.py`): Phase
  {text, start_min, end_min, label(raw band)}. ADDITIVE — `activities` still carries the legacy
  flat lines so the current UI renders unchanged; the renderers switch to `phases` when the new
  layout lands (then drop phase lines from activities).
- **`normalize.py` gains** `parse_minutes_band` (en/em-dash, hyphen, spaced, "to"; reversed →
  None), `phases_from` (handles the `description` vs `activity` key drift), and
  `phase_tiling_issues` (0-start, contiguity, ends-at-duration; never raises — feeds tests/QA).
- **All 5 normalizers populate phases + materials.** Gotcha found: **Science secondary saves
  carry `time_bands`, not `phases`** (like Maths secondary) — Science now reads
  `phases or time_bands`. English still ALSO concatenates tasks+phases into activities (legacy).
- **`tests/test_phases.py`** (stdlib, needs ARUVI_DATA_DIR): parser forms + phases_from +
  tiling units, then the whole library — **33 plans, 238 periods: 238 with phases, 238 parse,
  238 tile cleanly (100%)**. Full suite now 12/12 green. `test_link_resolver.py` corpus assert
  changed from hardcoded-5-subjects to subjects-on-disk (TWAU has no saved plans).
- **Mockup for founder review: `docs/mockups/lesson-period-layout.html` (v2, 2026-07-09)** — two
  360×800 frames with real Prime Time (Maths VI ch.5) content, REBUILT after founder feedback to
  speak the My Classes **section-card language**: (a) Chapter Organization = "the section card,
  opened up" — chapter head carries the SAME tick rail (pine taught / ochre now / hairline ahead)
  that the section card shows, and each unit is an sc-style card (11px radius, 4px left accent
  pine/ochre/edge, tint-cream current with NOW pill, paper-sunk upcoming, serif number); sections
  are quiet mono dividers, not boxed accordions. (b) Unit view opens with a header card that
  ECHOES the tapped org card (ochre accent, cream tint, serif 03, mini rail), then the document
  flows on plain paper: teacher notes → materials → collapsed extras → phases (8/14/11/7 in the
  rail) → homework → 📝 invoke. **NAMING DECIDED: user-facing copy says "Unit n of N" — never
  "LU" / "Learning Unit"** (founder: confusing, unnecessary acronym). Applies to app copy
  (LessonView "Learning Unit N", sc-rail aria, My Classes meta) when renderers adopt the new
  layout; internal identifiers/CSS may keep lu_/LU. Assessment layout is the NEXT discussion.

**Data/state work done same session:**

- **Deleted 7 saved plans — 4 later RESTORED (the audit was WRONG, see below):** ss/vi ch_06 ×3,
  ss/viii ch_04_20260520, twau iii/iv/v one each.
  > **CORRECTION (same day):** the "old-schema / no time bands" flag was a FALSE POSITIVE — the
  > audit script counted `coverage_handoff[]` rows (which carry `period_number` but rightly no
  > `time_bands`; they're the LP→assessment link table) as periods. The files' REAL periods all
  > had clean bands. Lesson: **a dict with `period_number` is not necessarily a period — only
  > `lesson_plan.periods[]` entries are.** Founder re-uploaded the 3 TWAU files (restored to
  > data/content/saved_plans), ss/vi ch_06_20260520_161946 was restored from
  > tests/fixtures/ss_vi_ch06_saved.json, and founder later restored ss/vi ch_06_20260520_190601
  > + ss/viii ch_04_20260520_195842 from his own copies (both validated clean). Only
  > ss/vi ch_06_20260520_172638 (a 3rd version of the same chapter) remains lost — immaterial.
  > **Library = 39 plans, all 5 subjects, every subject·stage covered**; all 39 marked prepared
  > for Kumar1 (verified via TestClient, 39/39); test_phases: 287/287 periods parse + tile
  > cleanly; link_resolver: 382 items, 0 orphans, 5 subjects.
- **Kumar1 profile REPLACED with full-coverage profile** (founder request: see every LP in one
  place): all 24 subject·grade combos with chapter content — English III–IX, Maths III–IX,
  Science VI–IX, SS VI–VIII, TWAU III–V — one section each ("{n}A"/sec A, preserving old "A"
  section tags), durations [40], ppw 6, budget = NCF totals via `ncf_total_periods` (fallback
  180). Written directly to `data/readiness/Kumar1/Kumar1/profile.json`.
- **All 33 plans marked prepared for Kumar1** in `data/prepared_plans/Kumar1/Kumar1/prepared.json`
  ({at, periods} records; the 2 pre-existing timestamps preserved) — My Lessons filters to
  `prepared || attached`, so this is what makes the shared library visible.
- **Verified via FastAPI TestClient** (pip-installed fastapi/httpx in sandbox): /readiness
  returns all 5 subjects · 24 grades; /plans lists 33/33 prepared; 4 spot-check /view calls
  200 with lesson_plan present. Live browser + mobile pass still pending as ever (§11).

## 2026-07-06 — The standing "+" profile portal: the gliding path to acquisition (STATIC only)

**The problem (founder):** class expansion inside the first subject worked because acquisition
left HOOKS on screen (unbound section cards, the per-subject expand window). A second subject had
NO artifact anywhere — My Classes only renders enrolled cards, the My Lessons wheels are
restricted to the enrolled set, and the only door was the settings gear (data-first). Founder
rejected a "ghost card" as a back-door ask; instead: **once comfort is established (first gen →
tour → attach → the expand window has been seen), a permanent, prominent "+" opens** — the
standing portal for ALL profile change (new subject, new class, new/dropped section). Nudge
campaigns end; furniture begins.

- **Trigger (founder-precise, REVISED same day):** the expand window ("Do you teach {subject} to
  other classes?") appears **ONCE, EVER** — after the first generation, once the tour resolves
  (completed or skipped), pinned to the first one-class subject (`expand_shown_{user}` +
  `expand_subject_{user}` in localStorage; `expand_session`/`expand_dismiss` keep it up across
  tab-hops within its one session). The founder's earlier per-subject 3-appearance budget is
  **superseded**: after this single window, reminding about adding ANYTHING is an irritation —
  all growth is pull via the +, never push. The + unlocks on any of the window's three endings:
  (1) she used it (add-class completed; derived: any subject >1 class), (2) she clicked ✕,
  (3) she ignored it (spent in a past session, never returns). Persistent forever after
  (per-user `plus_portal_{user}`, sticky even if the profile shrinks back); never competes with
  the tour (`tourResolved` gate).
- **Placement (founder-precise, refined same day):** on the REPEAT view (anything bound) the +
  sits IN the greeting row ("Good evening, {user}!"), right side — no row of its own ("we cannot
  lose so much real estate"), and it rides the sticky `.dash-hd` so it stays reachable while the
  cards scroll. On the FIRST-TIME view it keeps its own row BELOW "Your classes are ready" and
  ABOVE the section cards — classes encompass new subjects too, so the portal governs the whole
  card list, never sits above the welcome. `.sc-growrow`/`.sc-grow` in globals.css —
  founder-specified glyph + finish (same day): a plus RINGED BY A CIRCLE with FOUR DOTS outside
  the ring ("grow in every direction", `GrowIcon` in MyPlans.jsx, pine) on a 46px RAISED TILE with real depth — paper
  gradient face, inset top-edge highlight, layered contact + ambient shadows, hover lifts,
  :active flips the light inward (pressed-key feel). Not a flat circle.
- **Chooser:** tapping + opens an ap-modal ("What would you like to change?") with three rows —
  Subject · Class · Section. Each routes via page.jsx's one-shot `profilePortal` intent
  (`onProfilePortal(kind)`, consumed like `profileAutoAdd`) into TeachingProfile, which launches
  the matching screen ("shared flows, two doors" — same wheels + warnings as the gear; no drift).
- **Manage modes (NEW in TeachingProfile):** `pickMode`/`classMode` "add" | "manage". Manage =
  enrolled options PRE-TICKED; unticking = removal behind ONE scoped confirm in the dustbins'
  voice (names what goes, "your lessons stay in the library") — **warned, never blocked**
  (founder: mid-year reassignment is real). Subject → manage-pickSubjects (keep ≥1 enforced by
  the disabled CTA — whole-profile delete stays impossible by design); Class → manage-classes on
  the same classes screen (removing the last class takes the subject, said in the warning);
  Section → the existing editSections screen (already add+remove+warn). Class/Section goals pass
  through light portalSubject/portalClass pick screens, skipped when only one option. Adds after
  removals queue the normal per-class question flow (`continueWithGrades` extracted so add +
  manage share it). All removals run `clearSectionState` per section, and `persist` already
  sends `cascade:true`.
- **A portal visit ALWAYS ends in My Classes (founder, same day)** — never on the profile
  accordion. Implemented as ONE seam: every flow ending (completion, cancel, all seven back
  links) funnels through `setScreen("view")`, and a `fromPortal` bounce effect forwards that to
  `onBack()` (= page.jsx's goClasses). The back links relabel to "← Back to My Classes" on
  portal visits (`backLabel`) so they say where she'll actually land; gear visits unchanged.
- **VERIFIED STATICALLY ONLY** (babel-parse clean ×3, CSS balance 0, prop/hook-order greps; the
  sandbox can't `next dev`). Live must-do next session: resolve an expand window as a test user →
  + appears → all three chooser paths, incl. a subject removal WITH attached sections, portal
  exits landing in My Classes, and the mobile 360×800 pass.

## 2026-07-06 — Tour revised to 12 STEPS + transparent hand + popup-always attach (LIVE-verified)

Second revision pass, same day. All 12 steps + Back boundaries re-verified live as kumar23.

- **APP change:** the section card's "+" now ALWAYS opens the "Track a chapter" picker — the
  first-run direct-attach shortcut is RETIRED (the card still names the ready chapter). One true
  way to attach, so the tour teaches the real flow.
- **NEW step 6:** after the "+" step, the tour OPENS the track-a-chapter popup with the hand on
  the just-generated lesson row (`data-tour="attach-pop-row"` on listPlans[0]); title "Select a
  lesson plan to track for Section {tag}". Next from 6 performs the real attach. So: popup at
  steps 6 AND 11 (at 6 nothing bound → lesson in list; at 11 bound excluded). MyPlans boundaries
  moved: bind ≥7 / unbind ≤6, lesson open 8–9, demoDone 10–11; page.jsx: 11→12 goProfile.
- **Hand is now a TRANSPARENT outline SVG** (translucent white fill + ink stroke, custom
  index-up path in GuidedTour.jsx) — not the filled emoji. Also appears on step 3 (lesson row).
- **Placement fixes:** step 8's box uses `tipAnchor:["lesson-notes","mark-complete"]` + place
  "above" + `scrollAnchor:"mark-complete"` so the teacher notes AND Mark-complete stay visible
  below the box (lv-tnote carries data-tour="lesson-notes"). Step 10's box is pinned to the
  viewport bottom ("over") so the progress rail and the SECOND section card stay visible; its
  copy renders the circled + (.gt-plus, a mini .sc-add). Step 12 rings the header SETTINGS GEAR
  (data-tour="settings-gear") with the profile open behind — "here's where profile lives".
- **Auto-scroll is INSTANT with ≤5 retries/step** (scrollRef) — smooth scrollIntoView silently
  no-oped on some layouts and made mid-scroll screenshots look broken. Carry-forward: never use
  behavior:"smooth" for tour scrolls.
- **Nudge reworded + new glyph:** title "Allow me to show you how to track sections and handle
  Lesson plans", sub "It only takes a few steps — I'll walk you through it."; the 👋 emoji is
  replaced by a stroke-only ROUTE icon (start dot → dashed path → destination, pine, transparent).
- Chrome `resize_window` stopped constraining the viewport mid-session (stuck ~1120px) — the
  12-step pass ran at desktop width; round-1's 390px pass validated the mobile geometry (all
  tour positioning is viewport-clamped). A manual DevTools 360×800 pass remains worthwhile.
- **Round-3 refinements (same day, live-verified):** step 4 = scrollTop + box LIFTED 130px above
  the sticky attach bar + hand moved to the "← back to lesson plans" button
  (data-tour="preview-back") + copy now directs "go back … and attach this plan to section
  {tag}"; steps 6/7 hands CENTRED on the row/card (cfg.handPos:"center"); step 8 = scrollTop +
  box hangs below phase 1 (data-tour="lesson-phase-1" on UnitBody's first phaserow) so header →
  progress bar → phase 1 stay visible; step 10 subtext = "Once all units of the chapter are
  marked complete by you…" + box lifted 10% of vh (cfg.lift: fraction<1 = vh-fraction, number =
  px) — 10% balances "well above the bottom" against keeping the second card visible (22%
  covered card 3B). Default anchor-scroll CENTRES a taller-than-viewport target — full-view
  steps must set scrollTop:true or the top of the view (back button etc.) scrolls away.
- **Round-7 — first-run stand-in made LOUD (founder chose "deposit stand-in, say so clearly").**
  kumar23 picked Maths VIII ch 5; only saved test plan is ch 9 → FirstRun substituted ch 9 AND
  deposited it (unlike PrepareLesson, which only marks the EXACT chapter). Root causes: the
  teaser screen SET previewNote but never rendered it, and showed the CHOSEN chapter's title
  over the stand-in's numbers. Fix: `.fr-standin` ochre notice box on the teaser (names the
  stand-in and says it's what lands in My Lessons), and the teaser title now names the plan
  actually deposited. Behavior stays deposit-the-stand-in (keeps activation + tour testable
  until live gen); PrepareLesson's exact-only rule unchanged. Once live generation lands,
  the substitution path dies naturally.
- **Round-6 BUG FIX — "guide switched to a chapter I never generated" (kumar23, 2026-07-06).**
  `/plans/{subject}/{grade}` returns the WHOLE shared library with per-tenant `prepared`/
  `prepared_at` flags; My Lessons filtered client-side but **MyPlans consumed the raw list**.
  Four spots fixed to prepared-only: (1) the tour target plan is now the MOST RECENTLY PREPARED
  lesson (`latestPrepared`, prepared_at desc) — was `gp[0]`, an arbitrary library entry (kumar23
  generated Science IX ch 2; the guide walked ch 8 "Journey Inside the Atom", prepared:false);
  (2) the "+" track-a-chapter popup list; (3) the card's `readyOne` ("Chapter N ready");
  (4) `anyPlans` (nudge/welcome gate — a raw library entry must never trigger the nudge).
  MyLessonPlans steps 3–4 now key off the same `tourPlanOf()` (most recent prepared), so the
  row spotlight and the auto-opened preview can never diverge from the tour's target. RULE:
  any client list fed to teachers must filter `p.prepared || attached` — never trust the raw
  /plans order.
- **Round-5 (same day):** "below"-placed tour boxes are now CLAMPED to the viewport
  (top ≤ vh−260) — on phones a long chapter title pushed phase 1's underside past the fold and
  step 8's box rendered off-screen; it now settles onto the plan body. scrollTop pins capped at
  2 tries so the guide never snap-scrolls against the teacher's own reading. ALSO FOUND (not
  fixed, plan-DATA issue, out of tour scope): the saved Science IX ch_02 plan renders LU1 with
  "No phases recorded for this unit" and a "STAGE NONE" kicker — the plan's first unit carries
  no activities and no stage label through normalization; this is the "garbled" look kumar
  reported on step 8. Investigate the science secondary saved plan / normalizer next session.
- **Round-4 (same day):** the My Lessons preview's "Attach to a class" CTA + section chooser are
  RETIRED app-wide (LessonView attach bar removed, MyLessonPlans attachPick/attachToSection/
  onAttached deleted) — attaching happens ONLY via the section card's "+" → track-a-chapter
  window, so tour step 4 no longer shows a button that "does not exist in reality". Step 9
  subtext → "Track chapter progress of {chapter} with section {tag} unit by unit…"; step 11 →
  "…the same window shown in step 6…". Live-verified; the tour proved profile-agnostic when
  kumar23's profile changed to Science IX mid-test (targets/copy followed the new first class).

## 2026-07-06 (later) — Guided tour RESTRUCTURED to 11 guide-driven steps (verified LIVE, mobile Chrome)

Kumar respecified the tour top-to-bottom. The 4-step wait-for-real-taps walk is GONE; the tour is
now **11 steps, fully guide-driven** — every step has Back · Skip · Next, a "N of 11" counter, and
Next itself performs the move (nav, open preview, the attach, popup, profile) with a bobbing 👆
hand showing where the real tap would land. All 11 steps + Back across every view boundary
verified live at localhost:3000 as kumar23 at 390px.

- **Steps:** 1 My Classes tab → 2 My Lessons tab → 3 the lesson row (guide navigates) → 4 preview
  auto-opens → 5 hand on the section card's "+" → 6 REAL attach (the activation; Back from 6
  unbinds) → 7 tracking view opens → 8 hand on Mark-complete (never really clicked) → 9 card
  DEMOED as Complete + hand on its "+" (render-only — `tourDemoDone` forces the completed look;
  her real pointer/done untouched) → 10 the "Track a chapter" popup (opened by the tour) →
  11 the teaching profile, Done.
- **Architecture:** GuidedTour.jsx is presentational (numeric step, one anchor per step, poll +
  scrollIntoView, `place: below/above/over` — "over" pins the box to the viewport bottom for
  full-view targets). page.jsx owns shell transitions (2→3 goLessons, 4→5 goClasses, 10→11
  goProfile); **MyPlans owns steps 5–10 via IDEMPOTENT state-keyed effects** (bind/unbind at the
  6/5 boundary, open/close lesson at 7–8, popup at 10, prev-ref cleanup on Skip) — hooks sit ABOVE
  the !ready early-return (rules of hooks). MyLessonPlans owns 3–4 (auto-open first prepared plan).
  MyPlans reports `{tag, chapter}` up (onTourInfo) so step copy names them. The old "success"
  banner step is gone. Anchors: nav-classes/nav-lessons (tabs), lesson-first, preview-root/
  lesson-root + mark-complete (LessonView), section-add/section-card-target (target card = first
  class WITH a prepared plan), attach-pop (ap-modal), profile-root (page.jsx editflow div).
- **Tooltip is the thematic box:** .gt-tip restyled to the SAME sage-pine window as .dash-nudge
  (#eef4f0, 1.5px pine border, r14) — one visual voice for the whole first-run journey. Dots
  replaced by a mono "N of 11" counter. .gt-root z-index 70 (ABOVE ap-overlay's 60) so step 10
  annotates the popup; scrim blocks taps on every step (guide-driven).
- **Live-verify gotchas:** screenshots taken during the smooth scrollIntoView LOOK broken (blank
  paper, header mid-screen) — always re-shoot after the scroll settles; the ring transition
  (.18s) can also lag a capture. `resize_window` 390×844 DID constrain the viewport this time
  (~304 CSS px content width) — footer needed white-space:nowrap on the three buttons to stay on
  one line. Test state restored after the run (section-state DELETE + localStorage clear), so
  kumar23's nudge re-offers the tour on reload.

## 2026-07-06 — Tour refinements + "lesson not in My Lessons" bug (all verified LIVE in Chrome)

Kumar reviewed the tour and asked for changes; also hit a real bug. Verified live at localhost:3000
as kumar23 (Chrome), steps 1→4 + Back all confirmed on screen.

- **BUG FIX — "I ran a lesson but it's not in My Lessons" (kumar23).** NOT a deposit failure — the
  plan WAS marked prepared on disk (`data/prepared_plans/kumar23/.../english/iii/ch_01…`). The bug
  was My Lessons' DEFAULT CLASS: `mylessons_class` localStorage is neither user-namespaced nor
  validated, so a stale class (from another user in the browser, or from before a profile delete)
  made the tab open on a class where her prepared lesson doesn't live → "no lessons prepared". Fix
  (MyLessonPlans.jsx `activeGrade` initializer): default to a class she actually TEACHES for the
  initial subject, derived from the current server profile — trust the taught-grades list, not the
  persisted value. Same server-derived principle as the tour-flag fix. Confirmed live: My Lessons
  now opens English·Class 3 and shows "Fun with Friends — Ready to teach".
- **Tour changes (all live-verified):** (1) removed the confusing "Tap any class… your place only
  moves…" `dash-foot`. (2) Nudge is now a distinct sage-pine WINDOW (`.dash-nudge`, speech-bubble
  tail, pine border — clearly not paper) with a CONVERSATIONAL italic-serif "Show me how →" link,
  not a solid button. (3) Step 1 CYCLES the spotlight through every section card (`data-tour=
  "section-card"` on each unbound card; GuidedTour rotates cycleIdx every 1.1s, tooltip anchored to
  the first card, stable). (4) Step-2 copy = "To attach a lesson plan to a section, you tap the +
  symbol on its card. But first, let's see where your lesson plans sit." (5) Steps 1–2 have Next;
  after step 2 there is NO Next — steps 3–4 are real-tap with Back+Skip only. Step-2 Next
  AUTO-navigates to My Lessons. (6) BACK on every step (except 1) returns to the previous step's
  animation; back from preview closes the open preview (MyLessonPlans effect on `tourStep==="lesson"`)
  and re-highlights the lesson. page.jsx `tourNext`/`tourBack` own the transitions.
- **Also:** the preview "Attach to a class" CTA is now STICKY to the viewport bottom (`.lv-attachbar`
  position:sticky) so it's always reachable on a long plan and the step-4 spotlight is never below
  the fold. Verified live.
- NOTE: `resize_window` to 390 didn't actually constrain the content viewport in this Chrome (still
  rendered desktop-width), so the true 360×800 phone pass is still worth a manual DevTools device-mode
  check — but the flow, copy, spotlight, and back-nav are all confirmed working.
- **BUG FIX — "+ works late" (kumar23, live-confirmed).** Tapping "+" on the first-run ready card
  wrote the binding (server confirmed) but the card didn't refresh until the next incidental render
  (20s sync / tab focus) — because the DIRECT-attach path calls `setAttachFor(null)` while attachFor
  is ALREADY null, so React skips the re-render. Fix (MyPlans `attachChapter`): also
  `setSyncTick((t)=>t+1)` to force an immediate re-render. Verified live: card now flips to "Fun with
  Friends" instantly on tap.
- **Removed the nudge speech-bubble tail** (`.dash-nudge::before`). Kumar flagged it as an "uninvited
  arrow" on desktop — it was an unrequested flourish I'd added; the nudge is now just the clean
  rounded sage window. (Reminder for future: don't add decorative flourishes beyond what's asked.)

## 2026-07-06 — First-run GUIDED TOUR: the helping hand from blank cards → first attach

**The blank-landing problem (founder).** After the 2026-07-05 full-profile first run, she lands in
My Classes on empty section cards (3A, 3B) with the promised lesson one un-obvious tap away (via +
on a card, or My Lessons → preview). She's blank, doesn't know what to do. Ask Aruvi is the wrong
tool here — it's PULL (she must know what to ask); the first-run moment needs PUSH. Solution: a
one-time, skippable coach-mark tour, launched from a "Show me how" nudge, that walks her My Classes
→ My Lessons → preview → attach. Founder decisions this session: **full 6-step walk** (nudge + 4
coach-marks + success, not a compressed 3-beat); **+ attaches the ready lesson directly** (first-run
card copy reconciled from "Pick a chapter to begin" → "Chapter N ready · tap + to add"; picker still
used when >1 prepared); **wait-for-real-taps** (the tour does NOT auto-drive — she performs the real
taps, page.jsx advances); Ask Aruvi placement parked for now.

**Built (all STATIC-verified only — esbuild parses clean, CSS balanced; live + 360×800 pass is
Kumar's must-do next):**
- `GuidedTour.jsx` (NEW) — presentational coach-mark overlay. Positions by `data-tour` attribute +
  getBoundingClientRect on a 200ms poll (survives tab switches / late-loading targets). Spotlight =
  a transparent ring with `box-shadow:0 0 0 9999px rgba(...)` cutout. Scrim is pointer-transparent
  on action steps (real tap reaches the app), blocking on the one informational step. Steps:
  card (Next) → lessons (tap My Lessons) → lesson (tap the lesson) → preview (tap Attach). Success
  is NOT an overlay step — it's a banner in My Classes.
- `page.jsx` — tour controller (crosses `editFlow`, so it must live here). State `tour`
  (card|lessons|lesson|preview|success), `tourTag` (attached section, for success copy),
  `tourDismissed` (SESSION-ONLY, never persisted — see the fix note below). Advances on REAL events:
  goLessons → lesson; MyLessonPlans onPreviewOpen → preview; onAttached → success (+ goClasses).
  Success auto-dismisses after 7s. `data-tour="nav-lessons"` on the My Lessons tab.

  ⚠️ **FIX 2026-07-06 (kumar23): the tour offer must be SERVER-DERIVED, not a persisted client
  flag.** First cut stored "tour done" in localStorage (`aruvi_tour_done_{user}`). Kumar skipped for
  kumar23, deleted profile+allocations server-side, logged in again → the fresh first run never
  re-offered the guide, because the stale browser flag survived the server-side delete. This is the
  identical desync the top-of-page activation-flag note already warns about. Fixed: dropped the
  persisted flag entirely. The nudge is gated purely by server-derived first-run state (MyPlans:
  `!anyBound && anyPlans`), which self-closes forever once she attaches; `tourDismissed` is
  in-memory only (skipping hides it for the session; a fresh login re-derives from the server). The
  old `aruvi_tour_done_*` localStorage keys are now dead/ignored — no migration needed. Carry-forward:
  do NOT reintroduce a client-side "onboarded/seen" flag; if skip must persist across sessions, put
  it on the server profile record so a profile delete clears it too.
- `MyPlans.jsx` — first-run card copy "Chapter N ready · tap + to add" + direct attach when exactly
  one prepared plan; `data-tour="add-first"` on the first unbound card's +; "Show me how" nudge
  card; success banner (step 6). attachChapter/clearBinding now call the shared writers.
- `MyLessonPlans.jsx` — `data-tour="lesson-first"` on first card (tour only); `onPreviewOpen`
  callback; "Attach to a class" from the preview opens a section chooser → `bindSectionChapter` →
  `onAttached(tag)`. Preview attach is a NEW capability (was read-only); gated behind an `onAttach`
  prop so the in-view "View full lesson plan" preview stays read-only.
- `LessonView.jsx` — optional `onAttach` renders the "Attach to a class" CTA (`data-tour="attach-cta"`)
  in My-Lessons preview only.
- `lib/sectionState.js` — NEW shared `bindSectionChapter` / `unbindSection` writers, so My Classes'
  "+" and the preview attach can never drift.
- CSS: `.gt-*` (overlay, z-index 55 — above sticky chrome, below `.ap-overlay` z60 so the section
  picker layers over the tour), `.dash-nudge*`, `.dash-success*`, `.lv-attachbar/.lv-attach-btn`.

**Open / to confirm with Kumar:** the 'card' step is informational (Next), NOT an action, so she
isn't nudged into a direct attach that skips the My-Lessons half of the walk — reworded away from
"tap +". Whether preview-attach should stay general (current) or be gated to first run only. Ask
Aruvi's post-first-run home (header vs permanent footer) still parked.

## 2026-07-06 — PickWheel shows a running "chosen so far" line under the button

**The stray-tick problem (founder).** `PickWheel` (wheels.jsx) shows only 4 rows at a time; a
teacher picking durations/sections from a later batch can't see her earlier picks and may leave a
stray tick behind she never meant to keep. Fix: PickWheel now renders a running confirmation UNDER
the Continue/Done button — `Chosen (N): …` listing the FULL current selection in option order
(independent of scroll position), or an italic "Nothing chosen yet" empty state. Built once in the
shared component, so EVERY multi-select flow inherits it (FirstRun acqSections/acqDurations + the
SectionPicker modal; TeachingProfile add-subject/classes/sections/durations). Uses each caller's
existing `labelFor` (subjects list is already pretty-mapped, so no labelFor needed there). Opt out
with `summaryLabel={false}`. CSS: `.fr-pick-summary` / `.fr-pick-summary-empty` in globals.css
(added under `.fr-sec-wheel-col`), `aria-live="polite"`. Statically verified (esbuild parses
wheels.jsx clean; CSS braces balanced); live/mobile render still pending per §11.

## 2026-07-05 — First-gen now acquires the FULL profile (reveal-on-attach, unattached cards)

**The orphaned-first-class problem (founder).** The old first-run tail generated a lesson then just
asked her to NAME a section, auto-attaching a single-duration LP to the fanned-out sections. That
left the first class looking "done" while its profile was never acquired (defaulted duration, no
periods/week, no budget) — and once "complete" cards exist, nothing ever pulls her back to finish
it; she moves on to other classes/subjects and the first class stays orphaned. The one moment she's
motivated is right after generation (desperate to see the lesson), so we now acquire the WHOLE
profile there. Founder decisions this session: **reveal-on-attach** (she does NOT see the full LP
before the profile questions; she sees it after landing in My Classes and tapping "+"), and
**full profile incl. annual budget** (not a lighter subset).

**New FirstRun tail:** welcome → subject → grade → chapter(+default duration) → preview (facts
teaser, "your lesson is ready") → **acqSections → acqDurations → acqPpw → acqBudget** (the full
per-class profile for this subject·grade) → creatingCards → lands in My Classes. The old preview
section-picker fan-out + `SectionPicker` modal usage are gone (the component is left defined but
unused). `buildActivationPayload` now emits the full canonical grade record: sections, durations
(multi), `ppw_by_duration`, derived `periods_per_week`, and `budget: { 0: … }`.

**UNATTACHED cards (the key mechanism).** `finishActivation` deposits the lesson in My Lessons
(`markPrepared`) but NO LONGER binds it to any section (removed the `current_chapter_*` writes +
`pushSectionState` import). Cards land in the "pick a chapter" state; MyPlans already renders those
with a "+" that opens the attach picker listing the deposited lesson. So the reveal path is: acquire
profile → land → tap "+" → attach → tap card → see LP. MyPlans' `!anyBound` welcome banner now
guides to "+": "Your lesson is waiting in My Lessons — tap + on a class to start teaching it" (falls
back to "tap + … to prepare its first lesson" when `anyPlans` is false, e.g. a later subject added
with nothing generated).

**Reuse:** `PpwCapture` + `normPpw` + `ppwMapSum` + the duration/ppw constants were EXPORTED from
`wheels.jsx` and FirstRun imports them; the annual-budget estimator (METHODS/defaultValueFor/
budgetPeriods + NCF `/ncf-periods` fetch) is duplicated into FirstRun (self-contained). **Cleanup
TODO:** `TeachingProfile.jsx` still carries its OWN identical copies of `PpwCapture`/`normPpw`/
`ppwMapSum` + those constants — left untouched on purpose to avoid destabilising the working editor;
migrate it to import from `wheels.jsx` when next in there.

**Stale-binding bug (found via `kumar23`, fixed 2026-07-05).** After the unattached-cards change,
`kumar23`'s first-gen still showed 3A already attached to "Fun with friends". Cause: the section
teaching-state (`current_chapter` etc.) is SERVER-backed + localStorage-cached and survives profile
deletion, so a reused section key (`english_iii_3A`) resurrected its old chapter via
`pullSectionState` — the new code never binds, but old rows persisted. Three-part fix: (1)
`finishActivation` now explicitly CLEARS each created section's binding — localStorage keys removed
+ `pushSectionState` (which DELETEs the server row when no chapter is cached) — guaranteeing fresh
cards regardless of stale state (safe because first-gen only runs for an empty profile); (2)
**`DELETE /readiness` now also `section_state_repo.clear_all(...)`** (new repo method — unlink the
state.json, fallback empty-write) so "start setup over" truly resets teaching state; (3) wiped
`kumar23`'s stale `state.json` → `{}`. **Caveats for the local test:** restart uvicorn (Python
change) and note that the `serverEmpty` guard in `pullSectionState` KEEPS local cache on a
wholesale-empty pull — so a device that already cached the 3A binding only clears it by re-running
first-gen (which now self-clears) or clearing site storage; wiping the server alone won't update
that device's view.

**Copy/layout refinements (founder, 2026-07-05):** the four acquisition screens now carry a
4-step **progress rail** (`ACQ_STEPS` = Sections · Durations · Periods · Budget, via the generalised
`Progress` component) so she sees the run ends soon. Preview lead-in is "Your lesson plan needs a
home. Help us set up your class to receive the plan." + bold "Now let's set up your class"; CTA is
**"Set up my class"** (singular, both the preview and the final button). Sections hint: "Pick all
the sections you teach." Periods question is grade+subject-specific ("How many periods a week does
Class N get for English[ for each duration]?") with NCF-framed sub-copy. **Budget step restyled:**
each method carries its OWN result (stepper/estimate + "≈ N periods…") DIRECTLY below it, not one
shared block at the end — so the number sits where she chose; and once she picks a method the other
three **dim** (`.fr-dim`, siblings wrapped in `.fr-bud-row` with `.fr-bud-detail`). No method is
pre-selected (budget starts null); the finish button is disabled until she picks one.

**Verified (static only — sandbox can't `next dev`):** acorn-jsx parse clean on wheels/FirstRun/
MyPlans/TeachingProfile; globals.css balanced; FirstRun no longer references `pushSectionState`/
`durOptions`; "Set up my class" is singular everywhere; 4 acquisition progress rails present. Local
+ mobile pass owed (§11): run first-gen end to end (single AND 2-duration), confirm the 4 screens +
progress rail render, the profile persists, cards land UNATTACHED, the "+" picker lists the deposited
lesson, and the budget number appears under the chosen method with the others dimmed.

## 2026-07-05 — Period durations & the LLM's time budget: order is dead, counts survive (Issues 1 & 2 resolved)

A design conversation settling how the constitution should receive TIME once the calendar was
purged. Two problems were on the table and are now resolved; a third (collection UX) is decided
in principle but deliberately NOT built into first run yet.

**The root diagnosis.** Both problems come from trying to hand the LLM time as a SCALAR — either
"N periods" (durations unknown) or a single "total time Tm = ΣD·T" (mix and order unknown). A sum
throws away exactly the structure the problems are about. The fix is to hand the LLM an **ordered
vector of per-period durations** (e.g. `[40,60,40,40,60,…]`), NOT a scalar. This keeps the proven
ordered-period constitution instead of migrating it to a gross-time model. **Carry-forward for the
pending "wire time into the constitutions" task: do NOT wire a scalar total-time Tm — wire a
per-period duration field/vector. Tm becomes a derived checksum (Σ of the vector), never an input.**
This supersedes the earlier "give the LLM total time to gross up" drift (which was never wired).

**ISSUE 1 (the mix) — where does T1/T2 come from once the weekly grid is gone?** With a single
duration D and total T, Tm = D·T trivially. With two durations we know D1,D2 but not the counts
T1,T2. We must NOT let the LLM pick them (it would go to an extreme — all-short or all-long — i.e.
iterate on time itself). So the counts must be COLLECTED. Resolution: collect the per-week duration
split as COUNTS (e.g. 6 periods/week = 4×40 + 2×60); the counts give the ratio.

**ISSUE 2 (clumping / un-teachable layout) — and why ORDER cannot save us.** Even given the counts,
the LLM could clump all longs together, or place an indivisible 60-min activity where the teacher
only has a 40-min period. The tempting fix was to collect the ORDERED weekly rhythm per section and
stamp period *i* → rhythm[i mod k]. **This idea is DEAD, killed by a per-section objection that is
fatal, not cosmetic:** order is the ONE time-fact that genuinely varies across sections of a grade
(7A has the subject Mon-P1, 7B Tue-P3, …). Periods/week and the duration split are set by curriculum
+ the school bell schedule → grade-UNIFORM and factually answerable; only the slotting (order)
differs per section. Since we generate ONE plan per GRADE (per-section generation is too expensive
and breaks the shared-asset model), a per-grade plan cannot carry a per-section order, and asking
"what's the order?" is unanswerable when her three sections differ. **The old design's latent sin:
it collected section-wise day order and then the gross-time constitution grossed it away — paying
to collect the one fact the model can't consume. Dropping order is what makes the per-grade plan
CONSISTENT for the first time.** Everything the plan needs (total periods, duration split) is
grade-level; only the unanswerable thing leaves.

**How Issue 2 is actually handled WITHOUT order:** hand the LLM the **count multiset** ("14 periods:
11×40, 3×60"). Counts are GIVEN (no free iteration); the LLM only decides WHICH pedagogical moments
are the long ones — a pedagogical judgment (the sessions that need sustained time: experiment,
project, extended write), which is arguably BETTER than honoring any one section's calendar accident.
Feasibility is guaranteed globally (she has exactly 3 long slots over the chapter; the plan has
exactly 3 long sessions). The only residue is LOCAL (a long session may surface in the plan before
her next long slot) — handled by the flow pointer + trivial teacher agency, and made cheap by
**MARKING** the long sessions in the view ("longer session — best in a full period"). Marking is the
whole mitigation; she never has to split an indivisible activity because it's flagged to wait for a
slot that fits, and she's guaranteed to have one. Generation assumes each chapter **starts at cycle
position 0** (no cross-chapter phase tracking — keeps chapters independent, matches "notes never
migrate across regenerated plans").

**At generation:** allocation stays in period COUNTS (NCF norms → allocator, unchanged). The split
enters one layer downstream: total periods → split by the grade ratio via **`splitByRatio`
(largest-remainder, already in Allocate.jsx, already unit-tested, sums exactly)**. The calendar
purge only removed `splitByRatio`'s INPUT (it used to derive the ratio from the weekly grid via
`weeklyRatioFromReadiness`); we restore the input as a **direct two-number question** (the duration
split), not a grid. Small restoration, existing engine.

**Approach A (default) vs B (override).** A = store the grade duration split once, derive the
per-chapter split by rounding at generation (low friction, reused across section cards + My Lessons).
B = ask the split at every generation. B's "exactness" is mostly illusory — the split she'd type is
her weekly ratio × the total, i.e. the arithmetic A already does. **Decision: A is the default;**
expose B only as an optional per-chapter **"Modify split"** override, reusing the existing Allocate
**Accept / Modify** idiom (§3).

**Collection UX (decided in principle):** wherever a duration is captured (first gen, direct edit in
My Profile, or indirect acquisition as she navigates), if she picks >1 duration type, ask the
per-week COUNT per type RIGHT THERE (40→4, 60→2) — do NOT introduce periods/week as a separate
number and then ask the split; periods/week = Σ of the per-type counts. This will feed a schema
where the grade record carries the per-duration weekly counts (ratio) + derived `periods_per_week`.

**BUT — first-run scope decision (founder, this session): do NOT build multi-duration into first
generation.** It would force a `durations` schema change (today `durations` is a flat number array,
consumed by Allocate/MyCalendar/MyClasses/TeachingProfile/format.projectReadiness) and add friction
to a deliberately minimal, benefit-first flow. **Interim shipped:** in `FirstRun.jsx`, when she taps
"Change" on Class duration, a small `fr-hint fr-dur-note` line now reassures her — "Some classes run
longer than others. Let’s keep to one duration for now — you can add more later." First run still
collects a SINGLE duration. The mixed-duration capture (per-week count per type → count multiset at
generation) + the actual `splitByRatio` wiring land LATER, in gradual profile acquisition, together
with live generation (the preview currently serves a canned saved plan, so a split can't affect it
yet anyway).

**Implemented in My Profile (`TeachingProfile.jsx`) this session — the per-duration periods/week
capture (founder scoped it to My Profile now; first run stays single-duration).** The single
"periods per week" question is REPLACED by per-duration capture wherever duration is captured
(the add-a-subject / add-a-class conversational flow AND the spot-edit pencils):
- **Schema (additive, server-safe):** the grade record gains `ppw_by_duration: { [minutes]: count }`
  (e.g. `{"40":4,"60":2}`). `periods_per_week` is KEPT as the DERIVED sum, so every existing
  consumer is untouched (budget estimator, the view totals `stats.ppw`/`subPpw`, the per-class
  column, `format.projectReadiness`). Confirmed end-to-end: POST /readiness stores `subjects`
  verbatim and the file adapter's `_PROJECTION_KEYS` strip is TOP-LEVEL only, so a grade-level field
  rides through save→reload; `projectReadiness` returns `subjects` intact. NO api/adapter/other-
  component changes were needed — the whole change is `TeachingProfile.jsx` + a `.tp-ppw-*` CSS block.
- **Two helpers + one component:** `ppwMapSum`, `normPpw(durations, map, fallbackPpw)` (reconciles
  the map to the CURRENT durations — keep surviving counts, new duration defaults to the total when
  single / to 1 when multi), and `<PpwCapture>` — the ONE idiom, two shapes: single duration → the
  same large periods/week wheel as before (no visible change); >1 duration → a two-column table
  (Duration · a −/number/+ stepper per row, reusing `.tp-val-btn/.tp-val-input`) with a live
  weekly total. **Total is never asked directly — it's the sum.** Handles up to 3 duration types.
- **Flow:** the durations step now CHAINS into the per-duration question (add flow: durations→ppw
  reconciles the map on Continue; spot-edit "duration" screen shows **Continue** when >1 duration —
  routing to the per-duration ppw screen — and **Save** when only one). Save paths (`finalizeSubject`,
  `saveEditNums`, the new-grade seed, `gradeDraftFrom`) all write `ppw_by_duration` + the derived
  `periods_per_week` via `normPpw`/`ppwMapSum`.
- **View (2026-07-05, final — "Option C" total-forward, empty-row fixed):** the accordion class
  card's **Periods / week** column shows the weekly TOTAL as the big number, with the per-duration
  split as a caption directly below it ("6×40 · 1×50") when >1 duration; single-duration shows just
  the number. **The caption (`.tp-cc-col-cap`) is `position:absolute; top:100%`** so it lives in the
  card's bottom padding and does NOT stretch the centre column — that height difference (centre 3
  lines vs Duration/Budget 2 lines) was what left an empty row hanging under the card. `.tp-classcard`
  padding-bottom bumped 13→16px to hold the caption. (History, so no one re-breaks it: tried
  positional "4/2" — ambiguous; then the caption in normal flow — caused the empty row; then folding
  the split into the value line inline — founder wanted the total-forward look back; landed on the
  absolute-caption version, which keeps total-forward AND removes the empty row.) The weekly total
  also still shows in the subject header.
- **Legacy caveat:** a pre-existing MULTI-duration record with no `ppw_by_duration` can't have its
  old total re-split (we never had the per-type data — that's the whole point), so `normPpw` seeds
  each type at 1; she re-enters the split once. Single-duration legacy records migrate exactly
  (`{[dur]: periods_per_week}`).

**Verified (static only — sandbox can't `next dev`):** acorn-jsx parse clean on TeachingProfile.jsx
+ FirstRun.jsx; globals.css brace-balanced (1261/1261). Live render + mobile (360×800 first) owed
locally per §11: confirm the FirstRun note appears under the duration wheel only in edit mode; and
in My Profile that picking a 2nd/3rd duration shows the two-column table, the running total is
right, Save persists across refresh, and the class card reads "40/60 min ↔ 4/2".

## 2026-07-04 — Archive (not delete) for lesson plans in My Lessons

**Founder decision: there is NO hard delete of a lesson plan — only Archive.** Two reasons that
compound: (1) a generated plan is the most expensive artifact the teacher owns (prototype ~Rs 23/
chapter), and the planned output cache means even a "deleted" plan is cheaply regenerable — but
(2) the cache does NOT hold the teacher-specific state wrapped around the plan (section
attachments, the LU pointer = where she stopped, period/chapter notes). THAT is irreplaceable, and
it's the real reason to preserve rather than destroy. So a hard delete was rejected; archive is the
only removal affordance.

**Archive is a FLAG, not a place.** The plan asset itself is shared read-only CONTENT under
DATA_DIR (Bucket A) — archiving can't and doesn't relocate it. Instead a per-tenant Bucket-B store
records the plan's key `{subjectSlug}/{gradeSlug}/{filename}`. My Lessons lists un-archived plans;
an **Archived** view lists the rest; **Restore** just drops the key. Frozen identity + all
back-references untouched ⇒ restore is lossless. To the teacher it *looks* like it moved to
"Archive"; architecturally nothing moved — "Archive" is a second filtered view over one list.

**Attached ⇒ NO archive affordance at all (founder, 2026-07-04 — refined from "block+warn").**
"Attached" = any section is currently teaching or has completed the chapter (the same signal that
colours the card; `isAttached()` in MyLessonPlans). The earlier design showed the archive control
and blocked it with a warning toast; the founder's point was that showing-then-blocking is
inconsistent — so the archive icon is simply **not rendered** on an attached card. No warning path
exists. `archivePlan()` keeps a silent `isAttached` guard purely as defensive dead-code. So
archived plans are only ever detached ones — no orphaned pointers to reason about on restore.

Implementation (all behind existing seams, Supabase-swap-ready at Phase 4):
- **Port** `PlanArchiveRepository` (ports.py) + **file adapter**
  `aruvi_core/adapters/plan_archive_repository_file.py` — atomic write, tenant-keyed, stored at
  `STATE_DIR/plan_archive/{tenant}/{user}/archive.json` as `{plan_key: archived_at_iso}`. Mirrors
  the section_state repo pattern. `archive()` is idempotent; `restore()` a no-op if absent.
- **API** (main.py): `GET /plan-archive` (all keys), `POST /plan-archive`, `DELETE /plan-archive`
  (both take `{subject, grade, filename}`); `GET /plans/{subject}/{grade}` now takes identity and
  annotates each listing with `archived` + `archived_at`. Phase-4 swap = an `archived_at` column /
  small `plan_archive` table behind the same port; routes + components unchanged.
- **UI** (MyLessonPlans.jsx + globals.css) — NO pills (founder). Archive is a "folder" you open and
  close via ONE symmetric control: an **archive-box icon + count to the right of the title**. In
  your lessons it's a **closed box** (tap to open the archive); inside, the title switches to
  **"Archive"** and the same control becomes an **OPEN box** (lid lifted = you're in it) — tapping
  it closes the box and drops you back to your lessons. This replaced an earlier "‹ Your lessons"
  back link the founder found confusing. Each *un-attached* active card carries a small
  **closed-box archive icon at its top-right corner** (absolutely placed; card reserves right
  padding; the old `›` chevron was dropped); attached cards show NO archive icon. Archived cards
  carry an explicit **green "Restore" text button** (founder: the undo-arrow glyph was unclear;
  the word on a solid pine fill is direct). Icons are inline SVG (`ArchiveIcon`/`OpenArchiveIcon`,
  currentColor). Pressing archive optimistically drops the card from the active list and STAYS on
  the active page (no view switch) with a brief bottom toast; restore optimistically removes it
  from the folder and, when the folder empties, `effView` auto-falls-back to active.
  Revert-on-failure on both.
- **Scope:** archive affects ONLY the My Lessons library view. Other `/plans` consumers (Generate,
  PrepareLesson, MyPlans dashboard, SectionProgress) select a plan by chapter/filename and are
  intentionally left seeing the plan — you can still preview/regenerate an archived chapter; it's
  just decluttered from the library list. Since attached plans can't be archived, the MyPlans
  weekly dashboard (driven by section pointers) never surfaces an archived plan anyway.
- **No purge / no auto-expiry** (superseding the earlier junk-basket-for-1-week idea): the economic
  argument says keep it. A future explicit, gated "empty archive" would be the only place a true
  hard delete could ever live — noted, not built.
- **Verified:** adapter unit test (archive/restore/idempotent/tenant-isolation) green; `api.main`
  imports + route registered; globals.css brace-balanced; MyLessonPlans.jsx babel-parses. Live
  render + mobile (~390px) pass still owed per §11 (sandbox can't `next dev`).

## 2026-07-04 — Section history + the long-chapter-title standard + My Lessons wheel tweaks

> **Naming (founder, 2026-07-04):** the feature is **"Section history"** (UI title + glyph label),
> NOT "Chapter history". Vocabulary: **Class = grade** (7), **Section = the letter within** (7A).
> The history belongs to a SECTION and lists the CHAPTERS it has taught. "Chapter history" is
> deliberately RESERVED for a future per-chapter concept — the LP version trail across repeat
> regenerations of one chapter. The data module stays `sectionHistory.js` (correctly section-scoped).
> Also swept the class/section slips this exposed: the "+" picker + section-card aria-labels now say
> "section", not "class".

**Section history — a per-section teaching ledger (the natural completion of "where did I
stop?").** Before this, a section only held its CURRENT chapter binding + pointer + done flag
(`sectionState.js`); the moment a chapter left the current slot (untrack, or move-on from a
completed chapter) that record was DELETED, so the trail of what a section had taught lived
nowhere. Built:
- **`web/app/lib/sectionHistory.js`** — a per-section MAP keyed by chapter FILE (so exactly ONE
  row per chapter and the latest action wins automatically). Value:
  `{ file, chapter_number, chapter_title, status, units_done, total_units, ts }`,
  `status ∈ {completed, untracked}` (renamed from "set_aside" 2026-07-04 to match the app's
  track/untrack vocabulary). `units_done`/`total_units` stamp progress so each row can draw a
  completion bar.
  `readHistory` / `recordHistory` / `hasHistory`. **localStorage only for now** (matches the
  lesson pointer's status, CLAUDE.md §9) — gains a server mirror like `sectionState.js` in Phase 4
  so history follows the teacher across devices. Deliberately NOT cleared by `clearBinding` —
  untracking must not erase the record that a chapter was once taught.
- **The anti-noise gate (founder's rule):** a chapter enters history only when it earned its place
  — **≥1 learning unit marked complete** before it left. Completed chapters always qualify (all
  units done); an untracked chapter qualifies only if the pointer advanced ≥1. Casual attach→untrack
  with no progress logs NOTHING. The gate lives in `MyPlans.jsx` where the pointer is known
  (`unitsDoneFor()` = raw pointer index): `untrackChapter(sectionKey, plan)` logs `untracked` only
  if `unitsDoneFor≥1`; `moveOnFromCompleted(c, sectionKey, plan)` always logs `completed`.
- **UI:** a small history glyph (clock + counter-clockwise arrow SVG, `HistoryIcon`) stacked BELOW
  the card's action button in a `.sc-right` column, shown ONLY when `hasHistory` is true (the
  current still-bound chapter is not "history"). Kept **conditional, not always-visible** (founder
  confirmed "ok now"). Tapping it opens `historyModal` — an instant popup (reuses `.ap-overlay`/
  `.ap-modal`) listing one row per chapter, newest first, with the current bound chapter overlaid
  LIVE as "Ongoing"/"Completed" only if it has progress. Statuses carry the section-card palette
  plus a NEW **slate** code for "Untracked" (`.ch-untracked` #e7ebee/#566169) — a chapter untracked
  before finishing, distinct from warm completed-clay and cream not-started grey. Each row also
  shows a completion bar under the name — the section card's `.sc-rail`/`.sc-tick` reused (pine =
  completed units, ochre = current unit when ongoing), so history and cards read as one surface.

**The long-chapter-title standard (applies everywhere a title renders — cross-cutting).** Long
NCERT titles were breaking layouts. The fix + its rules:
- **Root cause = the flexbox trap:** a title in a flex row won't shrink below its own text width
  unless the parent has `min-width:0`, so it overflowed / shoved action buttons out. `.sc-body`
  already had `min-width:0`; the `.sc-title` clamp now actually engages.
- **Anchor on the NUMBER, clamp the title.** The chapter number is the stable identity, so it's
  folded into the kicker (`Science · Ch 12`) where it never truncates, and the bare title clamps.
  Section cards + My Lessons share `.sc-title` → **2-line clamp** applied once covers both.
- **Two title FORMS (founder's standardization):** (1) **popup lists** (the "+" track picker and
  the history popup — untrack is a single-chapter confirm, exempt) use a **stacked row**: a meta
  line on top (**just `Ch NN`** now — subject/grade REMOVED 2026-07-04 since the modal header
  already shows subject·grade·section) with the Track action / status pill pinned to its right end,
  and the chapter NAME below spanning full width across up to 2 lines, truncated beyond. Shared
  classes `.ch-row/.ch-meta/.ch-meta-tx/.ch-name/.ch-act/.ch-pill` in `globals.css`; `.ap-row`
  restructured from the old horizontal `[CH | name | Track]` strip. (2) **screen bodies** (My
  Lessons) keep their structure, just cap the title at 2 lines.
- **Never truncate the reading surface** (LessonView shows the full title). Hover `title=""` is a
  desktop-only extra — NOT relied on (phones have no hover); full text comes from the picker's
  2-line wrap and from opening the lesson.

**My Lessons wheel tweaks (founder, `.mlp2` scoped):** the **Class number left-aligned** (was
centred) with a 28px inset — centre-aligned, the number sits under the rolling finger and vanishes;
inset-left keeps it visible beside the thumb. **▲▼ cue arrows tightened** (`.mlp2 .fr-wheel-cue
{gap:0}` + `.fr-wheel-cue-btn{height:21px}`) — the button BOX height, not the gap, is what spaces
the glyphs apart.

All of the above is **static-verified only** (Babel-parse clean via a temp `@babel/parser`, CSS
braces balanced, class/prop greps) — the sandbox still can't `next dev`. Live render + mobile pass
(360×800 first) is the founder's local must-do: confirm the history glyph appears after a
taught-then-untracked chapter, slate reads distinctly, and long titles clamp without shoving.

## 2026-07-03 — My Lessons rebuilt to the My Classes idiom + section-state corruption bug fixed

**My Lessons (`MyLessonPlans.jsx`) redesigned, scoped to ONE class at a time.** The founder's
insight: a teacher opens this tab with one class in mind ("what's left to prepare for VI
Science"), so showing all grades/subjects at once is cognitive overload — scope to a single
subject·grade and give the whole body to that list. What shipped:
- Header **"Your lessons"** at the `dash-title` size (mirrors My Classes' greeting), then
  **Subject + Grade as the first-run `RollWheel`s** (from `wheels.jsx`) side by side — only the
  subjects/grades she teaches; a single-option axis shows a static box, not a pointless wheel.
  Both default to the first entry. Header is a **frozen (sticky) band**; the lesson list scrolls
  beneath. No scope-repeat header, no "N of M prepared" meta (removed at founder's request).
- Cards **reuse `.sc-card`** verbatim so size/shape match the "pick a chapter" section cards.
- **Card colour = teaching lifecycle lifted from section to lesson** (the chosen basis): sage
  rail = ready to teach (on the shelf, distinct from My Classes' grey "not started" — a prepared
  lesson isn't unstarted), green (`st-going`) = any section teaching it now, clay (`st-done`) =
  all engaged sections done and none live. Precedence: teaching-now wins over completed.
- **Status line is EXHAUSTIVE and single-colour** (founder: don't colour completed differently —
  looked odd): "Completed 6A, 6C · Teaching now 6B, 6D", completed first; fully done reads all
  sections. Read from the same server-backed section cache My Classes writes (`readLocalSection`),
  so the two tabs always agree. Section tags are already stored as "6A" in readiness.
- **Tap a card = read-only `LessonView` (preview)**; PDF attachment later. NO per-section
  drill-down (that's the section card's job) and the old **Track button is removed** — attaching
  a lesson to a section now happens only via the "+" on My Classes cards. `SectionProgress.jsx`
  is now dead code (like `SidebarNav`/`MyCalendar`). `onOpenSection` prop is unused but still
  passed by `page.jsx` (harmless). Empty state: "There are no lesson plans prepared for {subject}
  · {grade} yet." with the Prepare CTA ALWAYS present below, in every state.
- New CSS lives under `.mlp2-*` in `globals.css` (frozen header, wheel row, static box, sage
  shelf accent, single-colour status). Verified statically only (sandbox can't `next dev`).

**Founder tweaks to My Lessons — DONE 2026-07-03 (items 1 & 2; item 3 was blank/dropped):**
1. **"Your lessons" header aligned to My Classes' greeting.** It sat 8px low because My Lessons
   renders inside `.editflow` (`padding-top:8px`) while My Classes doesn't — cancelled with
   `.mlp2 { margin-top:-8px }`. Title was already `.dash-title` spec (Fraunces 500 / 23px); added
   the mobile `.mlp2-title{font-size:20px}` under the 600px breakpoint to match `.dash-title`.
2. **Compact Subject/Class wheels.** The `RollWheel` height is hard-tied to `WHEEL_ROW=64` (row
   height === scroll-snap step, or snapping lands between rows), so shrinking the CSS alone would
   break it. Added a backward-compatible **`rowPx` prop** to `RollWheel` (`wheels.jsx`) that sets
   both the container + row height AND the scroll math; first-run passes nothing → stays 64. My
   Lessons passes `rowPx={48}`; `.mlp2-static` reduced to 48 to match. Arrows sit naturally closer
   at the shorter height.
3. Founder's list cut off at "3." with no content — nothing to do.

**NAMING CONVENTION (cross-cutting, honour everywhere user-facing) — "Class", plain numbers:**
The teacher's word is **"Class"**, never "Grade", and the number is **Arabic, never Roman**
("Class 6", not "Grade VI"). Readiness still STORES the grade as Roman ("VI") — convert to the
display number only at the UI boundary (`classNum()` map in `MyLessonPlans.jsx`: iii→3 … x→10).
Wheel layout (refined 2026-07-03): **Class** wheel = short number, **centred**; **Subject** wheel
= **left-aligned + auto-fit font** (new opt-in `fit` prop on `RollWheel` measures the longest
option via an offscreen canvas at the base/bold size and shrinks the label so a long word like
"Mathematics" never clips on a narrow phone column — first-run passes no `fit`, unchanged). The
settled/chosen value renders **bold** (`.fr-wheel-row[aria-selected] .fr-wheel-label`).

**SCOPE RULE — Subject restricted to hers, Class is NOT (2026-07-03).** In My Lessons the Subject
wheel offers only `readiness.subjects[]` (what she teaches), but the **Class wheel offers every
class Aruvi has CONTENT for** in that subject (`useSupportedGrades(subject)` — a superset of her
taught classes), so she can browse/prepare for a class she doesn't currently teach. Picking a
class with no prepared LPs falls through to the empty message + always-present Prepare CTA. The
per-section status line only has sections when the chosen class IS one she teaches
(`taughtGradeObj`); a non-taught class shows every lesson as "Ready to teach" (no sections).

Apply the Class/plain-number rule to any NEW surface too — the older screens (Allocate, first-run,
TeachingProfile) still say "Grade"/Roman and are candidates for the same cleanup when next touched.

**Section-state corruption bug (data-loss) — root-caused and fixed.** Symptom: after marking a
chapter complete, all My Classes cards flashed correct status then reverted to "pick a chapter".
Cause chain: `markComplete` fires two rapid fire-and-forget POSTs (pointer, then done); the file
repo did a **non-atomic** read-modify-write of one shared `state.json`, the two writes interleaved
and left a stray `}` → invalid JSON → server `_read` silently falls back to `{}` → GET returns
empty → the client reconcile treated "server empty" as "untrack everything" and **deleted every
local binding**. Fixes (all shipped):
- **Server writes now atomic** — temp file + `os.replace` (+ fsync) in
  `section_state_repository_file.py`; concurrent writers can't tear the file. Verified under
  40×15 concurrent writes.
- **Process-level `threading.Lock`** around the read-modify-write — atomicity alone still let
  writes to DIFFERENT sections lose each other's rows (stress: 40→13 survived; with the lock,
  40→40). One module-level repo instance → the lock is process-wide. Multi-instance deployment
  moves this to a DB row-lock (Supabase, CLOUD_DATA_MODEL §2.4).
- **Client reconcile hardened** (`sectionState.js` `pullSectionState`): a WHOLESALE-empty server
  response now deletes NOTHING (keeps local optimistic state) — only a NON-empty payload clears
  the keys it omits (genuine cross-device untrack). Guard var `serverEmpty`.
- Repaired the live corrupt `data/section_state/Kumar1/Kumar1/state.json` (both sections restored
  via `raw_decode`). **Carry-forward:** the section-state POST is fire-and-forget + full-snapshot;
  never assume ordering between the pointer and done pushes — the last write wins, so keep
  `setDone` firing after `writePointer` on the completion path. Restart uvicorn to load the repo
  change (Python).

**Follow-up 2026-07-03 (same bug, second episode) — RESTART-REQUIRED gotcha + self-heal read.**
The file corrupted AGAIN after the first repair, and one device (the phone) never recovered while
the Mac did. Root cause: **a Python server-code change is NOT live until uvicorn is restarted** —
the running process was still the OLD non-atomic writer, so normal use re-corrupted the file, and
the OLD `_read` still returned `{}` on the corrupt file. Two lessons, both now permanent:
- **Always restart the API after editing anything under `api/` or `aruvi_core/`** (no auto-reload
  in the run recipe). A repaired data file + un-restarted server = it just corrupts again. The web
  side is different — Next dev hot-reloads, but a fix only reaches a device after that device
  RELOADS the page (localStorage is per-device; a server repair doesn't heal a client — the client
  must re-pull the good state into its own cache). A device that can't reach the API (wrong LAN IP,
  server down) or is signed in under a different **case-sensitive** user id (`Kumar1` ≠ `kumar1`,
  a different tenant) will look "not recovered".
- **Self-heal read added** (`section_state_repository_file._read`): on `JSONDecodeError` it now
  `raw_decode`s the valid leading object instead of returning `{}`, so the classic stray-brace
  corruption can no longer wipe a device even before the atomic-write fix is deployed. (Note the
  2nd corruption truncated INSIDE the file, so only 1 of 2 sections survived salvage — the other
  was restored by hand from the known-good values. Salvage recovers the valid prefix, not
  necessarily every row.)

**My Lessons remembers its Subject + Class across tab switches (2026-07-03).** The tab reset to
the first subject/class every time she toggled to My Classes and back, because the component
unmounts on tab switch and re-initialised to defaults. Fixed by persisting `activeSubject` +
`activeGrade` to localStorage (`mylessons_subject` / `mylessons_class`), restored on mount (falls
back to first taught subject/class on first visit; a stale saved class is harmless — the RollWheel
self-corrects). She flips between the two tabs to pick chapters, so the selection must be sticky.

## 2026-07-02 — THE CALENDAR PURGE: day-organization is a category error; nav = two centre tabs

A design conversation with the founder overturned the day/week framing that had crept into the
product, and the first slice of the restructure is now implemented. The reasoning, so no future
session re-invents the calendar:

- **The core insight: the timetable is cyclic, the pointer is cumulative.** A teacher's calendar
  repeats identically every week; her curriculum progress never repeats. Housing cumulative
  state (the section pointer) inside a cyclic container (weekday buckets) constantly asserts
  something the content doesn't — if 6A's card sits under "Monday" and she didn't advance the
  pointer, the app displays a falsehood that reads as an accusation. Tuesday's content for a
  section is CONTINGENT on Monday's outcome, so a forward-looking week view can only ever render
  one truthful day. Aruvi's organizing question is **"where did I stop?"**, never "what is due".
  An app that makes no claims about her schedule can never be wrong about it (substitutions,
  exam weeks, sports day — no reconciliation class of bugs exists at all).
- **How the calendar crept in (genealogy, for vigilance):** time entered legitimately ONCE, as
  allocation arithmetic (weekly grid → period supply → effort-index distribution). The input
  then mission-crept into an interface (grid on screen → week view → "My Week is Home" →
  day-bucketed cards). Watch for this pattern; the only time-facts Aruvi keeps are NUMBERS
  (periods/week, durations, annual budget), never a grid of days.
- **Aruvi's product story, restated:** a lesson-plan artifact tool (constitutions = the IP). The
  section card is her working copy of the plan; the pointer is her pen mark; five cards replace
  five PDF printouts. The profile accretes as a by-product (progressive acquisition unchanged).

**Implemented this session (deliberately scoped by the founder — no more, no less):**
1. **FirstRun.jsx** — arrange-week step REMOVED (WeekGrid/DurationEditor/DateBadge/BenefitIcon
   components deleted; sectionCards is now the final screen, CTA "Go to my classes →"). The
   canonical payload still ships `grids[]` all -1 for readiness-shape compat; DAYS survives
   only to shape that.
2. **page.jsx** — sidebar/hamburger/drawer/My Week/Calendar ALL GONE. Nav = **two centre tabs,
   all viewports** (`.bottom-tabs` no longer mobile-only): **My Classes** (home, editFlow null)
   and **My Lessons** (renamed from "Lesson Plans"; = MyLessonPlans). Teaching profile
   (MyClasses.jsx) parked behind a header **settings gear** (`goProfile`); Generate is reached
   only via "+ Prepare Lesson" (a verb — never a tab). SidebarNav.jsx + MyCalendar.jsx are now
   DEAD CODE on disk (unimported), like Generate.jsx.
3. **MyPlans.jsx (home)** — day buckets/`daylabel`/"today floats first" logic deleted; FLAT
   list of section cards (`.sc-card` in globals.css): serif section tag · subject kicker ·
   "Ch N — title" · **LU progress rail** (done=pine, current=ochre, remaining=hairline) ·
   "LU n of N" meta. NO dates, NO pace pills. Phase-level (within-LU) marking is specced in
   the conversation but deliberately NOT built yet.
4. **api/main.py** — `GET /plans/{subject}/{grade}` now enriches each listing with
   `total_units` (recursive LU count via `_count_units`, same flatten as LessonView.jsx) so
   the card rail doesn't fetch every view. Verified against real data (science vii ch_02 → 7,
   english vii ch_01 → 5 incl. nested groups).

**Verified:** acorn-jsx parse clean on all touched JSX (use `web/node_modules/acorn`+`acorn-jsx`
— no @babel/parser in the sandbox), CSS braces balanced, `py_compile` + tests pass
(test_api needed `pip install fastapi httpx2 --break-system-packages` in the sandbox; the
failure was environmental, not ours). Live render + mobile pass still pending locally (§11).

**Approved-but-not-built (from the same conversation, in order):** phase-level pointer ("mark
the last phase you covered" — needs stable phase IDs at generation time, same requirement as
Period Notes), pace-against-allocation on the card (periods consumed vs allocated).
Mockups of all of this live in the Cowork conversation (2026-07-02).

**Same day, second slice — TeachingProfile (Settings) built; MyClasses editor retired:**
- **Copy:** first run now asks "What do you teach?" / "Which class do you teach {Subject} to?"
  (statements of fact, not intent). The redo flow uses the plurals ("What subjects…", "Which
  classes…").
- **wheels.jsx** (new) — RollWheel + PickWheel extracted from FirstRun.jsx, imported by both
  FirstRun and TeachingProfile. ONE selection UI everywhere (founder rule: no multiple UI
  types). CSS class names unchanged (.fr-wheel*/.fr-sec-*), so the extraction is CSS-invisible.
- **TeachingProfile.jsx** (new, behind the settings gear) — VIEW (read-only cards per subject·
  class: sections · durations · ppw · ≈periods/yr) + REDO (conversational: subjects multi →
  per subject: classes multi → per class: sections → durations → periods/week → annual budget
  4-method estimator; existing answers PRE-TICKED; unticking a subject at Q1 removes it
  immediately) + DELETE (DELETE /readiness + clears `lu_pointer_*`/`current_chapter_*` from
  localStorage; lessons stay; page.jsx onDeleted flips ready=false → back through FirstRun).
- **Checkpoint semantics (founder spec):** each finished subject POSTs the merged canonical
  subjects[] to /readiness at the "subject saved ✓" interstitial → "Continue to {next} /
  Finish for now". She can leave AFTER any subject, never mid-subject (mid-subject state is
  component-local and simply evaporates).
- **Budget estimator without a grid:** Readiness.jsx's 4 methods derived periods/week from
  the weekly grid; grids are gone, so the loop asks the number directly and stores it as
  `periods_per_week` on the grade record (ADDITIVE schema field — older records lack it, all
  consumers tolerate that). weeks→ppw×w · periods→direct · days→ppw×d/6 · auto→ppw×30.
- **MyClasses.jsx is now dead code** (retired per founder decision — Settings shows view +
  Redo + Delete only). page.jsx imports TeachingProfile instead.
- Verified: acorn-jsx parse clean (page, FirstRun, wheels, TeachingProfile, MyPlans), CSS
  balanced, DELETE /readiness endpoint confirmed present. Live render still pending locally.

**Same day, third slice — brand + tab placement (founder polish):**
- **One logo everywhere:** the brand dot is now upright and RED (#c0392b) in every surface
  (shared `.brand-row em` rule), matching the first-run welcome page; the shell header stacks
  "Aruvi." over the mono LESSON STUDIO tag exactly like first run.
- **Tabs moved from bottom to TOP** (under the header), centred (`.tabs.main-tabs`), reusing
  the ORIGINAL `.tab.active` treatment — clay-red underline — that the old My Plans/Generate
  tab row used. `.bottom-tabs`/`.bt-item` CSS removed; body no longer pads for a fixed bar.
- **No tab-name echoes:** the "My Classes" / "My lessons" kickers inside the two tab bodies
  are removed — the active tab already says where she is.

**Same day, fourth slice — TeachingProfile REBUILT as accordion + granular editing (founder
iterated past the redo/delete design within hours; the "second slice" description below is
historical):**
- **Accordion:** one subject (and its classes) open at a time; collapsed rows show just the
  name + class count. **Master Edit toggle** (top right) reveals ALL mutation controls at
  once; view mode is clean data only, no prose.
- **Granular ops:** red dustbin (inline SVG, #c0392b) per subject / class / section chip;
  each behind ONE scoped confirm naming exactly what goes + "lessons stay in the library".
  Removals cascade upward (last section takes its class; last class takes its subject),
  clear the removed sections' lu_pointer_*/current_chapter_* keys, and RE-KEY the per-index
  budget map (rekeyBudget — budget is keyed by grade index, so any structural change must
  re-key or budgets silently attach to the wrong class).
- **Structure vs values rule:** tree things (subject/class/section) are added/removed in
  place — green .tp-add buttons (+ section · + add a class · + add a subject, pine bg);
  numbers (duration · ppw · budget) open the SAME single-question wheel screens, prefilled,
  as a 3-step edit → Save. Add-a-class asks questions ONLY for the new classes (pendingIdxs
  mechanism); add-a-subject runs the full per-subject loop with the "saved ✓ — continue /
  finish for now" checkpoint between multiple additions.
- **REMOVED: "Delete profile" and "Redo whole profile"** (and the delete→redo flow from the
  second slice). The profile is only ever edited at a point. Emptying it entirely (deleting
  the last subject) leaves the "+ add a subject" button; server profile empties via the same
  POST /readiness full-replace.
- **Delete profile → straight into rebuild:** after the warning + deletion, she lands
  DIRECTLY in the same conversational flow "Redo profile" opens (nothing pre-ticked). The
  shell stays open — `ready` untouched, onDeleted prop removed from TeachingProfile/page.jsx;
  a signed-out return without rebuilding still hits first run naturally (server profile gone).
- **First-run handoff is now DIRECT** (founder: a "Go to my classes →" button is meaningless
  to someone who has never seen the shell). creatingCards beat → finishActivation, landing
  straight on the My Classes home; the interstitial sectionCards screen + LessonCard component
  are deleted. **Bug fixed en route:** nothing ever wrote `current_chapter_{sub}_{grade}_{tag}`
  (MyPlans reads it to bind a chapter to a card), so post-first-run cards showed empty
  "pick a chapter" states — finishActivation now binds the previewed plan's filename to every
  fan-out section, so she lands on cards already carrying her lesson.

## 2026-07-01 — English Grade VIII Unit→true-chapter split (audit found + replaced a stale prior attempt)

Repeated the VI/VII true-chapter split for Grade VIII. Unlike VI/VII, this one started from a
**discovered, undocumented, stale prior attempt** — worth reading in full before trusting any
similar staging folder found in future sessions.

- **What was found before any new work started:** `data/content/chapters/english/viii/
  {summaries_split,mappings_split}/` already existed (15 files each, all timestamped earlier the
  same day, before this conversation's own edits). Live `summaries/`/`mappings/` still held the
  original 5 unsplit Unit files — so a split had been staged but never cut over, and neither
  MEMORY.md nor CLAUDE.md had any record of it (`data/` is git-ignored, so no commit trail
  either). Auditing the staged files' `effort_signals` showed fractional values (e.g.
  `spine_load: 1.0, task_density: 0.3, writing_demand: 0.3, project_load: 1.0, effort_index:
  4.0`) — NOT the integer 1–3/0–2/0–3 tiers the current Step 7d methodology produces. Structurally
  it matched (`_source_unit`, `page_share_of_unit`, etc.) but the effort-index formula was clearly
  an earlier/different one, quite possibly the page-count-weighted proration the script's own
  docstring flags as explicitly rejected for VI. **Deleted both stale staging folders and redid
  the split from scratch** rather than trust or repair the old output.
- **Tier-cutoff audit:** VIII's raw `task_density` distribution (2.67–4.33 across 15 sections) is
  narrower and shifted higher than VI (1.67–3.83) or VII (1.83–4.17). Reusing VI/VII's cutoffs
  (≤2.0/2.1–2.9/≥3.0) never reaches tier 1 at all for VIII — pins 11/15 chapters at tier 3,
  collapsing task_density to an effectively binary (2-or-3) signal. A recalibrated cutoff
  (≤3.0→1, 3.1–3.4→2, ≥3.5→3) would restore real 3-tier use (5/6/4 split), though both options
  land on 7 distinct `effort_index` values overall (11.5–16.5). Presented both to the user —
  **decision: reuse VI/VII's cutoffs unchanged anyway**, accepting the weaker task_density
  discrimination for a single shared config across all three grades. `split_english_chapters.py`
  needed NO changes (already in its VI/VII single-cutoff form). `spine_load` is degenerate for
  VIII too (all 15 sections use all 6 spines).
- **Split + verify:** ran `python3 aruvi-scripts/split_english_chapters.py viii` into staging;
  verified valid JSON, sequential 1–15 numbering, title format, and NCF allocation
  (`ncf_total_periods('english','middle')` = 157) sums exactly to 157 with a compressed but real
  spread (9–12 periods per chapter — narrower than VI/VII's spread, consistent with VIII's own
  compressed effort_index range).
- **Cutover:** done — old 5 Unit-level files deleted, staged files moved into live
  `summaries/`/`mappings/`, each mapping's `summary_path` corrected `summaries_split/` →
  `summaries/`, staging folders removed.
- **Saved-plans — a NEW wrinkle vs. VI/VII:** `data/content/saved_plans/english/viii/` had **two**
  separate whole-Unit saved plans, both for Unit 2 "Values and Dispositions" (true chapters
  4/5/6) — `ch_02_20260519_122152.json` (12 periods) and `ch_02_20260609_101904.json` (11
  periods) — two independent generation runs of the same Unit, not two different chapters (a
  first pass at reading period counts alone could mistake this for a genuine duplicate-chapter
  bug; a full section_id walk on both confirmed they cover identical sections A/B/C). Asked the
  user how to resolve the duplicate before touching anything: **decision — keep only the newer
  2026-06-09 run, discard the 2026-05-19 one entirely.** Split the kept file into `ch_04`/`ch_05`/
  `ch_06` (periods renumbered per chapter, `coverage_handoff`/`assessment_items` filtered by
  section_id, homogeneity-checked same as VI/VII); period counts reconcile (5+4+2=11 orig). Both
  original whole-Unit files (kept-then-split, and discarded) deleted.
- **Process note for future grades:** when a `summaries_split`/`mappings_split` staging folder is
  found already on disk, don't assume it's this session's own leftover or safe to cut over as-is
  — check `effort_signals` for the right *shape* (integer tiers, not fractions) before trusting
  it, since the workspace folder persists across sessions and past undocumented attempts can
  linger silently.
- **Doc gap flagged (not yet fixed):** `cowork prompts/english/middle/step_1_chapter_summary_and_
  mapping.md` Step 7d's "Verified 2026-07-01" note still only cites the Grade VI calibration
  (16 chapters, 4.5–16.5) — it hasn't been updated to note that `task_density` is the one signal
  requiring a per-grade raw-distribution audit before reuse (VII reused VI's numbers after
  checking; VIII reused them too despite a weaker fit). Worth a doc update next time this file is
  touched, so a future read doesn't assume the VI numbers are grade-invariant by default.

## 2026-07-01 — English Grade VII Unit→true-chapter split (repeat of the VI process)

Repeated the VI true-chapter split (§CLAUDE.md, `aruvi-scripts/split_english_chapters.py`) for
Grade VII, per the standing handoff. Live now: `data/content/chapters/english/vii/{summaries,
mappings}/` hold **15 true chapters** (5 Units × 3 sections each), numbered/titled the same way
as VI (`"<section title> (<unit title>)"`).

- **Tier-cutoff audit (Step 1):** extracted VII's raw per-section signals and compared applying
  VI's existing chapter-scale Step 7d tiers unchanged vs. a VII-recalibrated `task_density`
  (VII's raw avg range 1.83–4.17 vs. VI's 1.67–3.83, so VI's cutoffs left 8/15 chapters tied at
  the top tier vs. a possible even 5/5/5 split). Presented both to the user with a full table —
  **decision: reuse VI's cutoffs unchanged, no VII-specific retiering.** `spine_load` is fully
  degenerate for VII (every chapter uses all 6 spines, tiers to 3 for all 15 — more so than VI,
  which had one 2-cell outlier); `writing_demand`/`project_load` already sat on VII's natural
  data breaks. Result: `effort_index` spans 7.5–16.5 across 8 distinct values, no collapse.
  `split_english_chapters.py`'s tier functions are therefore UNCHANGED from the VI version — the
  only edit kept was making `ROOT` derive from the script's own location instead of a hardcoded
  stale sandbox path (portability fix, unrelated to the tiering decision).
- **Split + verify (Step 2):** ran `python3 aruvi-scripts/split_english_chapters.py vii` into
  staging (`summaries_split/`/`mappings_split/`); verified valid JSON, sequential 1–15 numbering,
  title format, and that NCF period allocation (`allocate_for_subject` + `ncf_total_periods
  ('english','middle')` = 157) sums exactly to 157 with a real per-chapter spread (6–14 periods).
- **Cutover (Step 3):** done — old 5 Unit-level files deleted, staged files moved into the live
  `summaries/`/`mappings/` folders, each mapping's `summary_path` corrected from
  `summaries_split/` → `summaries/`, staging folders removed. (Files under the connected
  `aruvi-saas` workspace folder can't be `rm`'d without first calling
  `mcp__cowork__allow_cowork_file_delete` on a path inside the folder — needed once per session.)
- **Saved-plans loose end — RESOLVED for both VI and VII.**
  `data/content/saved_plans/english/vii/` held 2 pre-split test plans
  (`ch_01_20260510_175736.json`, `ch_02_20260512_122542.json`); `.../vi/` held 1
  (`ch_02_20260518_104012.json`). All three turned out to be **whole-Unit** plans (every true
  chapter's periods/coverage_handoff/assessment_items bundled into one file) — on first read
  VI's looked like it covered only one true chapter ("The Unlikely Best Friends"), but a full
  section_id walk showed it actually spans all 3 sections of the "Friendship" Unit (A/B/C =
  true chapters 4/5/6), same shape as VII's two. Sliced each by `section_id` (confirmed to align
  with new true-chapter order — VII: 1-2-3 and 4-5-6; VI: 4-5-6) into separate per-chapter saved-
  plan files: periods renumbered from 1 within each, `coverage_handoff` and `assessment_items`
  filtered to that section's entries only (empty spine/group keys dropped), `chapter_number`/
  `chapter_title` set to match the new mapping JSON exactly, filename keeps the original save
  timestamp with the new chapter number prefix. Period counts reconcile exactly in all 3 source
  files (VII Unit 1: 5+4+2=11 orig; VII Unit 2: 6+4+1=11 orig; VI "Friendship": 5+3+2=10 orig).
  Old whole-Unit files deleted in both grades. **No open saved-plans loose end remains for
  English VI or VII** — worth re-running this same section_id-walk check (don't trust content
  from a partial read) on any grade/subject that gets a Unit→true-chapter split in future.

## 2026-07-01 — Strategic pivot: mobile-first, progressive-acquisition model (Phase 0)

### What changed (direction, not code yet)
- Adopted the **mobile-first progressive-acquisition model** (`docs/Aruvi_Mobile_First_
  Progressive_Acquisition_Model_v0.2.md` + `docs/mobile pics/`) as the standing direction.
  Recorded in **CLAUDE.md §0** (new, read-first banner) with pointers added to §9 and §11.
- **Core reframe:** OLD Profile→Allocate→Generate→Track becomes NEW Generate-first-lesson →
  attach-to-sections → (optional) arrange-week → teach → profile accretes as a by-product.
  Principle: **benefit first, data second.** Engine/plugins/view-model/ports UNCHANGED — this is
  interaction re-sequencing + a mobile-first reflow only.
- **Two phases:** Phase 1 = shell-less "Guided First Experience" (no sidebar/tabs/nav until a
  lesson is generated + attached to ≥1 section + week arranged-or-skipped). Phase 2 = workspace
  shell opens (activation moment): hamburger sidebar, **My Week = Home** (auto-opens to today),
  Generate tab replaced by universal **+ Prepare Lesson**.
- **Dev workflow decision:** development moves to **Chrome + mobile DevTools device mode**,
  mobile-first then desktop. Stress-test **360×800** (Indian budget Android; custom preset, UA
  type = Mobile), then 375 (iPhone SE) / 390 (iPhone 14) / 412 (Pixel 7). Final iPhone pass in
  real iOS Safari for safe-area/`100vh`/sticky-header quirks Blink won't reproduce. `next dev`
  still can't run in the Cowork sandbox → live render + mobile checks are local.

### Component audit — reuse map (existing `web/app/components/` vs new IA)
- **Reuse ~as-is:** `LessonView.jsx` (before/after-complete matches the LP-view mockups),
  `ViewModelView.jsx`, `PeriodRows.jsx`, `StatePill.jsx`, `AllocationReportView.jsx`,
  `SectionProgress.jsx`, `Login.jsx`.
- **Reuse, re-sequenced / re-skinned:** `MyPlans.jsx` → **My Week / Home** (already the weekly
  dashboard grouped by day; needs mobile reflow + "auto-open today"); `MyLessonPlans.jsx` →
  **repository** (already subject→grade→chapter); `MyClasses.jsx` → **progressively-filled
  profile** (already the editable subject→grade→section drill-down); `MyCalendar.jsx` → Calendar
  (add the benefit-first empty state); `Allocate.jsx` → keep its generate path, but surfaced via
  **+ Prepare Lesson** not a tab; `SidebarNav.jsx` → hamburger sidebar (already has My Class /
  Calendar / My Week / Lesson Plans + Settings/Help — close to the mockup).
- **Harvest pieces, retire as a gate:** `Readiness.jsx` (the upfront 6-step wizard) is **retired
  as the entry point**; its duration editor / section multi-picker / weekly grid are lifted into
  the progressive first-run + My Class.
- **Net-new (the real work):**
  1. **Shell-less Phase-1 wrapper + activation gate** — `page.jsx` currently renders the shell
     (header + tabs + rail) immediately after Login; the new flow must suppress ALL shell until an
     activation flag (lesson generated + attached to a section) flips. That gate is the single
     biggest structural change.
  2. **Section-card fan-out** — "Add to Class" → multi-select section picker → one independent
     lesson card per section. Does NOT exist today: sections are currently implicit from the
     readiness profile, and MyPlans derives cards by day. This is the activation mechanism.
  3. **+ Prepare Lesson** universal action (replaces the Generate tab as a destination).
  4. **Mobile bottom-tab bar** (My Week / My Class / Calendar / Lesson Plans) per the mockups —
     distinct from the current desktop left rail.
  5. **Benefit-first Calendar empty state** ("your calendar is waiting for a little more info").
- **Deferred but specced (note now):** Period Notes (section plan-instance, pull-based, 📝) and
  Chapter Notes (shared plan asset, Chapter Organization page, chapter-end prompt). Needs stable
  per-plan period identifiers; notes never migrate across regenerated plans.

### Carry-forwards
- `page.jsx` is the pivot's center of gravity: the `tab` state + `TABS` array + the `navOpen`
  rail all assume the two-tab shell. The activation gate replaces `ready`-gates-Generate with
  `activated`-gates-the-whole-shell. Don't delete the reused components — re-wire the router.
- Keep the §4 "scholarly planner on warm paper" system (Fraunces / Newsreader / IBM Plex Mono,
  warm palette) intact — the mockups already use it; warmth comes from words + pacing, not a new
  visual language. This is a reflow, not a rebrand.

## 2026-06-28 — Persistence + tenanting + self-contained `data/` + repo cleanup

### What changed (big session — see CLAUDE.md §5/§7/§9/§11)
- **User-ID login portal** (`web/app/components/Login.jsx`) now gates the app. No password
  yet: the ID is stored in localStorage and sent as the **`X-Aruvi-User`** header on every
  API call (`format.js` `withUser()` wraps fetch). Server `_current_identity()` reads it;
  `tenant_id == user_id` (one teacher = one individual tenant). Phase-4 swaps for Supabase Auth.
- **Readiness is now server-persisted** (was front-end only — that gap is closed). New
  `ReadinessRepository` port + file adapter; `/readiness` GET/POST/DELETE. Profile survives
  refresh/restart/new browser. Stores ONLY canonical `subjects[]`; the denormalized projection
  is stripped on save and regenerated on read via `projectReadiness()` (format.js).
- **Allocation register made tenant-keyed** (it was NOT — a real multi-tenancy hole: all
  teachers shared one register per subject·grade). Threaded `tenant_id/user_id` through the
  `AllocationRepository` port → file adapter → engine fns → API routes. Path is now
  `allocations/{tenant}/{user}/{subject}/{grade}/allocation.json`.
- **Self-contained `data/` root.** Content copied prototype-mirror → `data/content/`
  (`ARUVI_DATA_DIR` default); state at `data/` (`ARUVI_STATE_DIR` default). Both repo-derived,
  no machine hardcoding. **App no longer reads the prototype mirror at runtime.** Two seams in
  `api/config.py`: `DATA_DIR` (Bucket A content) vs `STATE_DIR` (Bucket B state).
- **Repo cleanup/reorg.** Purged junk (`out/`, `web/.next/`, caches, `.DS_Store`, `others/`);
  consolidated design docs under `docs/` (incl. `docs/mockups/`, `docs/architecture-plan.md`).
  All moved-file references were comment/doc-only (no code paths) — rewritten to new paths.
- **Tests:** added `test_readiness.py` + rewrote `test_allocation.py` (tenant isolation, new
  signatures, redraw-ready record schema); fixed stale `/health` assert in `test_api.py`.
  **Full suite 11/11 green.**

### Key decisions / carry-forwards
- **`tenant_id == user_id` is the deliberate stub** until Supabase Auth. Every Bucket-B record
  already carries both keys, so Phase-4 is a value swap in `_current_identity()`, not a schema
  change. Grep invariant (CLOUD_DATA_MODEL §5): no teacher data without a tenant key.
- **Never persist the readiness active-subject projection** (subject/grades/grids/durations/
  budget top-level keys) — derived sugar, regenerated on read. The file adapter strips it
  defensively even if the frontend sends it.
- **Sandbox cannot DELETE files in the mounted repo** (`Operation not permitted`) — only
  create/overwrite. So destructive cleanup must be a script the USER runs on their Mac
  (`tidy_repo.sh` was the vehicle this session). `clear_*` adapter methods fall back to
  overwriting-empty when unlink is blocked, so resets never 500.
- Current dev data is under user **`Kumar1`** (`data/readiness/Kumar1/…`, `data/allocations/Kumar1/…`).

### Verification limitation (unchanged, still important)
- Web/React changes are verified **statically only** (sandbox can't run `next dev`). The full
  login→readiness→allocate→teach loop must be smoke-tested locally at desktop + mobile widths.
  Local run is now `python3 -m uvicorn api.main:app --port 8000; npm --prefix web run dev`
  with **no `ARUVI_DATA_DIR` needed** (defaults to `data/content/`).

## 2026-06-27 — Planning-layer rebuild (web app restructured to the finalized flow)

### What changed
- Web app went from **3 sibling tabs** (Allocate / Generate / My Plans) to the finalized
  **two-tab, readiness-gated, hub-and-spoke** flow. Spec: `docs/mockups/index.html`
  + `docs/aruvi_saas_full_lifecycle_flow.png`. Full architecture documented in **CLAUDE.md §11**.
- New components: `Readiness.jsx` (ported from `readiness-grid-flow.html`), `GenerateTab.jsx`
  (readiness gate + folds in Allocate), `LessonView.jsx` (Learning-Unit lesson view +
  assessment artifact). Rebuilt: `MyPlans.jsx` (weekly dashboard). Reshaped: `Allocate.jsx`
  (added G2 hub `final` step, G7 `generate` spoke, G4 total-periods model, G5 howbox).
- `Generate.jsx` (old thin component) is now **dead code** — not imported; safe to delete later.

### Key decisions / carry-forwards
- ~~**Readiness state is front-end only**~~ **(SUPERSEDED 2026-06-28: now server-persisted +
  tenant-keyed via `/readiness`; see top entry.)** Original note: lived in `page.jsx`, threaded
  to GenerateTab/MyPlans. Still front-end-only: the **LU pointer** (`localStorage` key
  `lu_pointer_{sectionKey}`) — next to migrate.
- **G4 weekly ratio** comes from the readiness grid (`weeklyRatioFromReadiness`) and splits the
  single total-periods input via `splitByRatio` (largest-remainder — unit-tested, always sums
  exactly). Falls back to period-rows when readiness data absent. Internally still writes into
  `rows` so the engine allocate call + persist + export path is unchanged.
- **Status belongs in My Plans, not Generate** (deliberate): started/in-progress/locked is
  execution state (the LU pointer); Generate only knows allocated vs. plan-made.
- **G7 generate spoke serves saved-plan previews** — live generation still deferred.

### Verification limitation (important, recurring)
- **The Cowork sandbox cannot run `next dev`/`next build`** — Next.js's arm64 SWC native
  binary fails to load, and the Google-Fonts `@import` stalls the build. So all web work this
  session was verified **statically only** (brace/export/prop-contract greps, CSS brace
  balance, unit-testing pure helpers). **None of Phases 1/2/3/5 has been live-rendered.**
  A local smoke test of the whole loop at desktop + mobile is the must-do before more UI work:
  `python3 -m uvicorn api.main:app --port 8000; npm --prefix web run dev`. (Stale as of
  2026-06-28: no `ARUVI_DATA_DIR` env var or sibling Project Aruvi folder needed anymore — the
  app defaults to the self-contained `data/content/` copy, per CLAUDE.md §7.)

### Deferred / parked
- **G6 selective-reset screen** not yet aligned to the mockup (still the old modal, not the
  G2-styled select-to-clear danger-zone screen).
- **Sample-plans pre-readiness surface** parked — it exposes only an LP, not the execution/
  My-Plans value; needs a better approach (mockups Screen S note).

## 2026-06-22  *(allocations note below SUPERSEDED 2026-06-28 — register is now file-persisted AND tenant-keyed; only the Supabase swap remains)*

### Allocations persistence (accumulation model)
- **What was built:** The Allocate tab now accumulates allocations — when a teacher allocates a second set of chapters, both sets persist in the Final view, not just the latest one.
- **Current scope:** In-memory during the session (state-based). Survives page navigation but resets on browser refresh.
- **Portability note:** When moving to Supabase, allocations must be persisted to the DB keyed by (subject, grade, user/teacher_id). Each allocation set should be a row with (chapter_numbers[], period_rows[], final_allocation_data). The UI `allAllocations` array becomes a DB query + cache in the API layer.
- **Migration path:** Add a `POST /subjects/{subject}/{grade}/save-allocation` endpoint in the FastAPI layer (api/main.py) that writes to Supabase. The web component calls it instead of just updating local state. Keep the in-memory `allAllocations` as a display cache during the session.

### Text updates (2026-06-22)
- Changed "AI Suggested Allocation" → "Suggested allocation" (line 248, Allocate.jsx)
- Changed period-definition subtitle to "To begin, set the total number of periods available and how long each period type lasts below." (line 370, Allocate.jsx)


---

## 2026-07-23 — Gen-on-gen (genon) architecture settled + partition v0.3 shipped

Full state, locked decisions, agreed 8-step plan, deployed test plans (Kumar1), and
open items are in **genon/HANDOVER.md — the next genon session MUST read it first.**
Headlines: phase-centric pipeline (canonical → compile → phase stream → deterministic
partition → optional Sonnet seam polish); canonical durations 40/≤VII, 45/VIII, 50/IX,
single row, duration mix never reaches the generator; three-regime compression
(rescale ≥0.8 · role-weighted 0.6–0.8 · drop trailing units <0.6 with Rule-4-style
coverage note); golden-8 link resolution relocates to compile-time unchanged; corpus
back-fill to v1.1 schema approved but NOT done (pre-warm checklist entry owed when run);
SS-secondary v1.1 constitution drafts in genon/amended/. Adaptation economics measured:
partition Rs.0/ms + polish Rs.1.75–3.88/14–36s vs Rs.67.6/minutes original generation.

---

## 2026-09-13 — The primary nav moved to the foot (web + Expo)

Founder: "switch My Classes / My Lessons, Ask Meyy and the big plus to the bottom." The top
`.tabs.main-tabs` are gone; the app's entire nav is one bottom bar — **My Classes · My Lessons ·
Add · Ask Meyy** — on both surfaces. Skin chosen from a mock: "option A + edge 4, light edge" —
sunk paper under a 1px `--edge` top rule (so the last lesson phase drops its own rule), clay
active item with a short clay underline, nothing under the bar. Static flow at the foot of the
app shell, so it cannot scroll away; hidden entirely in Settings; safe-area inset is padding
INSIDE the bar; contents cap to `--shell-w` so on a Mac the items sit over the content column.
The standing "+" portal left the My Classes greeting row and became the bar's **Add**.

Web `bbe00d7a` (`page.jsx` · `globals.css` · `MyPlans.jsx` · `GuidedTour.jsx`, whose four bar
anchors flipped to `place: "above"`). Expo port this commit: `mobile/components/BottomNav.jsx`
mounted in `app/(app)/_layout.jsx`, measures in `mobile/theme/web.js` under `bnav*`. Full
decision text in CLAUDE.md §4; verification log in docs/mobile_migration_plan.md (Track D
step 3). Owed: the iPhone 14 pass over the home indicator.
