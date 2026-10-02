# Cold review: Grade 9 Maths Ch 10 "How Quantities Combine: Understanding Data" lesson plans

Files: C = ch_10_canonical.json (16 units), P13 = ch_10_canonical_p13.json (13 units), P10 = ch_10_canonical_p10.json (10 units).
Authority: textbook PDF, 29 pp, printed pp. 8–36 (printed page = PDF page + 7).

Every unit and every assessment item in all three files was read. Every number was recomputed in Python: the book examples and exercises, every item answer, every guide extension and every inline computation. All book references (Example n, Exercise Set x.y Qn, End-of-Chapter Qn, figure/table numbers, page numbers) were checked against the PDF. Charts on pp. 15, 20, 24, 25, 26, 27, 32, 33 and 34 were rendered and read.

## Findings

| # | file | unit/item | field | sev | exact current text | what's wrong | suggested fix |
|---|---|---|---|---|---|---|---|
| 1 | C | Item 1 (NUM, 10.1) | guide.NUM.inclusivity | **S1** | "first verify Method 1's error by multiplying 68 × 25 and 74 × 40, comparing totals" | The group sizes are swapped. In the stem, Section A has 40 students at 68 and Section B has 25 students at 74. The products should be 68 × 40 = 2720 and 74 × 25 = 1850. The guide's pairing gives 4660/65 ≈ 71.69, which would wrongly suggest the student's claim of 71 is almost right. (Checked twice.) | "…by computing the two section totals, 68 × 40 = 2720 and 74 × 25 = 1850, and comparing (2720 + 1850)/65 with 71…" |
| 2 | C | Unit 11 | teacher_notes | S2 (unsure: could be S1, a wrong data reading) | "Watch for students who judge a play superior purely from high 5-star share without noticing the total review count is tiny" | This misreads the EoC Q9 charts (p.33). The play with the highest 5★ share is Play C (≈39%), which has about 380 ratings, so its total is not tiny. Play C's real weakness is polarisation: about 33% of its ratings are 1★. The play with the tiny total (Play A, ≈210 ratings) has an ordinary 5★ share (≈27%) and about the same 4–5★ share as Play B (≈70% vs ≈72%). Play B has about 930 ratings. | Describe the charts as they are: C has the largest 5★ share but also the largest 1★ share; A's shares look like B's, but A has far fewer ratings than B (≈210 vs ≈930). |
| 3 | C | Unit 9 | time_bands[3] (42-50) | S2 | "Discuss what the resulting chart shows from Example 7: the shift from lighting to cooling dominates the change from 2005 to 2025." | The 100% chart does not support this. Lighting falls 36→11 (−25 pts), but the gain is split between cooling (+10 pts), kitchen appliances (+11 pts) and other appliances (+4 pts). Kitchen's share gain is slightly larger than cooling's. Only in absolute units is cooling the largest riser (+500). | "Lighting's share falls sharply (36% → 11%) while cooling and kitchen appliances each gain about 10 percentage points." |
| 4 | C | Item 9 (NUM, 10.2.1) | question_text / expected_answer | S2 | "(ii) In a stacked bar chart with one bar per year, which segment would you draw first and why?" ; ANS "(i) … (iii) 16/54 × 100 ≈ 29.6%." | Part (ii) has no single correct answer, because segment order is a free choice. The key skips (ii) entirely and gives no criteria, so it cannot be marked consistently. | Reword, e.g. "Which category would you place at the base if you most wanted to compare it across the two years, and why?" Add the expected answer: any category, justified by "only the base segment starts at 0". |
| 5 | C | Item 13 (OPEN_TASK) | task (iv) | S2 | "for AF, 30%, 50%, 20%" (AF has 25 participants) | Sub-part (a) asks for absolute Term-1 counts. For AF, 30% of 25 = 7.5 and 50% of 25 = 12.5, which are fractional participants. CC and YC give whole numbers. | Change AF's split to 40%, 40%, 20% (10/10/5), or change AF's size to 20 or 30. |
| 6 | C | Item 13 (OPEN_TASK) | task (PQS definition) | S2 | "combines B, S and Q for each programme using the weights 3 : 4 : 3 to produce a single Programme Quality Score" | The task averages quantities in different units: books per participant (8–12), sessions per participant (8–12) and a satisfaction score out of 10. The resulting "score" has no meaning. This also contradicts C Unit 5's own note: "stress that the formula averages comparable values." | Put all three metrics on a common scale first (e.g. each scored out of 10 or as a percentage), or give B and S as ratings out of 10. |
| 7 | P13 | Item 9 (ECR, 10.2.2) | question_text + look_for[0], [2] | S2 | "state whether it must be true, might be true, or cannot be inferred" ; LF "Claim (1): Cannot be inferred…" ; "Claim (3): Cannot be inferred…" | The three categories overlap. Claims (1) and (3) are both "might be true" and "cannot be inferred", so a student who answers "might be true" with a correct reason is equally right, but the look_for credits only "cannot be inferred". | Use two categories ("can be inferred / cannot be inferred"), or change the LFs to accept "might be true / cannot be inferred". |
| 8 | P10 | Unit 6 | time_bands[1] (10-25) | S2 | "Pose the in-text questions aloud: 'Which family spent most on education? Which family spent least overall?'" | "Which family spent most on education?" is not one of the book's in-text questions. Book Q1–5 (p.19) are: least on housing, most on healthcare, roughly how much Family A spent on education, Family B's largest category, and A's food vs healthcare. "Least overall" is book Q6, which the book poses after the clustered charts, and this plan poses it again in the 25-38 band. | Use the book's Q1–Q5 here (e.g. "Which family spent the least on housing? Which category did Family B spend most on?") and keep Q6–Q8 for the stacked chart. |
| 9 | P10 | Item 4 (NUM, 10.1.2) | guide.NUM.inclusivity | S2 | "ask what volume of the 6% solution would need to replace the 4% solution to bring the mixture concentration to exactly 3%" | This extension has no answer. Without the 4% component, 400 mL at 2% plus 150 mL at 6% is already 17/550 ≈ 3.09%, which is above 3%. Adding any 6% solution raises it further, and solving gives a negative volume. | Ask instead "what volume of 2% solution must replace the 4% solution to reach 3%?" (answer: (8 + 9 + 0.02v)/(550 + v) = 0.03 gives v = 50 mL, so 450 mL of 2% in total), or change the target to 3.5% with 6% solution. |
| 10 | C | Unit 8 | time_bands[0] (0-12) | S3 | "Verify that the three questions about Family C that were hard on clustered charts can now be read off." | Only two of the three questions (book Q7, Q8) are about Family C. Q6 asks which family spent least overall. | "Verify that the three totals questions (Q6–Q8) … can now be answered." |
| 11 | C | Units 8, 9 | time_bands[0] of each | S3 | U8: "Show Fig. 10.2 (stacked column chart) … each bar's full height is the total expenditure" ; U9: "They find it hard because bars are different heights." | Fig. 10.2 (p.20) is a horizontal stacked bar chart, so totals are bar lengths. The visual_aids field itself correctly says "stacked bar chart". | Change to "stacked bar chart" and "full length". |
| 12 | P13 | Unit 9 visual_aids & 0-15; Unit 10 0-12 | visual_aids / time_bands | S3 | "Stacked column chart for family expenditure (Fig. 10.2 from the textbook)" ; "Display the stacked column chart for family expenditure (Fig. 10.2)" ; "healthcare segments sit at different heights in different bars" | Same as #11: Fig. 10.2 is a horizontal bar chart. | "stacked bar chart", "positions/lengths". |
| 13 | P10 | Unit 6 visual_aids & 25-38; Unit 7 visual_aids | visual_aids / time_bands | S3 | "family expenditure clustered and stacked column charts, p.19–20" ; "Show Fig. 10.2 (stacked column chart)" ; "Textbook Fig. 10.2 (stacked column chart of family expenditure, p.20)" | Same as #11. | "stacked bar chart". |
| 14 | C | Units 9, 10 | teacher_notes; time_bands 5-28, 28-42; teacher_notes | S3 | "the think_reflect material in this section" ; "Discuss the think_reflect question" ; "Use the think_reflect prompts" ; "The think_reflect prompts in this section" | An internal schema label has leaked into teacher-facing text. | "Think and Reflect". |
| 15 | C | Unit 6 notes; Unit 7 43-50 & notes | teacher_notes / time_bands | S3 | "before the chapter moves to data visualisation" ; "This sets up the stacked chart as the next tool." ; "before the stacked chart is introduced" | Register: forward references. | Delete the clauses, or say "Clustered charts hide totals and shares." |
| 16 | P10 | Unit 1 (0-10, 10-25, 40-50); Unit 6 notes | time_bands / teacher_notes | S3 | "note that the next problem is different" ; "the chapter will look at this question through three lenses … before turning to charts" ; "Preview that the chapter's first worked example will show" ; "The unit closes on an open question to motivate the 100% stacked chart" | Register: forward references and "Preview". | Remove the forward-looking sentences. |
| 17 | P13 | Unit 1 | time_bands[2] (30-50) | S3 | "Introduce the chapter's two strands … through a brief reading of Section 10.1. Ask students to write … what a stacked bar chart might look like … orient the two threads that the chapter will develop." | Forward reference. Also, Section 10.1 does not mention stacked charts; visualisation starts in 10.2, p.18. | Keep this band on combining averages, e.g. Example 1's prediction. |
| 18 | C | Unit 14 | activity_title | S3 | "Algebraic Reasoning About Weighted Means — Cricket, Shuttlecocks and Gold" | The unit has no gold problem. Its items are EoC Q1, Q2, Q6 and Q4 (pool). The gold item (EoC Q5) is in Unit 15. | "…Cricket, Shuttlecocks and Brahmagupta's Pool" (or "Pṛthūdakasvāmī's Pool", see #35). |
| 19 | C | Unit 2 | time_bands[1] (12-28) | S3 | "State the three-group generalisation (ap + bq + cr)/(p + q + r) … and have students verify it reproduces the badminton result." | The badminton example has two groups, so the three-group formula only "reproduces" it with a dummy empty third group. | "…verify it reproduces the cycling result (p = q = r = 5)". |
| 20 | C | Item 11 METHOD; Item 12 look_for[2] | method_one_line / look_for | S3 | "supports within-school proportion comparisons (e.g. Science has a larger share in School A than School B)" ; "within-bar proportional comparisons are exactly what the 100% chart supports" (Claim 2 compares Q's share with P's) | The labels do not match the examples. Both examples compare shares across bars, not within one bar. The comparison is valid, but the label is wrong. | "supports share comparisons, both within a bar and across bars…" |
| 21 | C | Item 4 | guide.NUM.inclusivity | S3 | "verify by computing the total grams of acid and the total volume" | The quantities are mL × %, which gives mL of acid, not grams. | "total quantity (mL) of acid". |
| 22 | C | Item 13 | guide.OPEN_TASK.strong_vs_weak_markers | S3 | "showing the two-level and one-level approaches are equivalent (because the weights commute)" | Vague and inaccurate reason. The equality holds because the sums can be regrouped (distributivity), with the common factor 1/10 out front. | "(because Σnᵢ(3Bᵢ+4Sᵢ+3Qᵢ)/10 can be regrouped as one sum)". |
| 23 | C | Unit 13 | teacher_notes | S3 | "The common error in the langur problem is re-using 60 as the total after adding the new female" | Part (iii) asks for the female average, so the denominator that changes is 35 → 36, not 60 → 61. The note points to the wrong count. | "…using 35 (or 60) instead of 36 as the number of females after the admission…" |
| 24 | C | Unit 16 | time_bands[2] (30-43) | S3 (unsure) | "the choice between reporting a weighted mean and reporting a percentage breakdown mirrors the choice between the two chart types" | The analogy is muddled. Weighted mean vs breakdown does not map onto stacked vs 100% stacked. The time-use data also involves no weights. | Drop the "mirrors" sentence and keep the "compresses / keeps visible / shows only proportions" summary. |
| 25 | C | Unit 4 | time_bands[3] (43-50) | S3 | "Debrief Q3 and Q4." | Ambiguous: the two questions come from different sets (Ex 10.1 Q3 and Ex 10.3 Q4). | "Debrief Ex 10.1 Q3 and Ex 10.3 Q4." |
| 26 | C | Item 10 (MCQ) | question_text | S3 (unsure) | "split into salaries, materials and overheads. Which … is most difficult … A* Comparing the materials expenditure…" | The stem does not say materials is a middle segment. If it were the base segment, comparing it would be easy. The listed order implies it is in the middle, but this is not stated. | Add "(stacked in that order, salaries at the base)". |
| 27 | C, P13 | C U10 5-28; P13 U11 0-20 | time_bands | S3 | "necessarily true, possibly true, or cannot be inferred" / "must be true, might be true, or cannot be inferred" | Same overlapping categories as #7. | Use can / cannot be inferred. |
| 28 | P13 | Item 1 (MCQ) | guide.MCQ.inclusivity | S3 | "invite them to try four numbers: imagine Class P is 4 students … and Class Q is 1 student … ask what the five scores average to" | Says four numbers, then five scores. There are five. | "try five numbers". |
| 29 | P13 | Item 8 (NUM) | expected_answer / guide inclusivity | S3 | Stem asks for percentages, plus "one thing a 100% stacked bar chart shows more easily … one thing a stacked bar chart shows … explain why … the two charts look the same"; ANS gives only percentages; inclusivity: "can be challenged to notice that because both years total 1000 units, the stacked bar chart and the 100% stacked bar chart … have the same shape" | The key covers only the numerical part. The "challenge" in the guide is already a required part of the stem. | Add the expected text answers to the key (shares across years / absolute totals; both totals = 1000). Replace the challenge with something new. |
| 30 | P13 | Unit 12 | teacher_notes | S3 (unsure) | "a play with overwhelmingly positive ratings in the 100% chart may have very few total ratings, making it less reliable than one with a slightly lower share but far more responses" | Hedged, but it does not fit the chart (see #2). Play A's 4–5★ share (≈70%) is about the same as B's (≈72%), not "overwhelmingly" higher. | Tie the note to the real chart: A ≈ B in shares, with far fewer ratings; C is polarised. |
| 31 | P10 | Unit 5 | teacher_notes | S3 | "A recurring error is students adding the weights to the denominator count rather than summing the weights themselves: for ratio 3 : 2 : 5 the denominator is 10, not 3." | Self-contradictory wording: "adding the weights" is what students should do. The error meant is dividing by the number of components. | "…dividing by the number of components (3) instead of the sum of the weights (10)." |
| 32 | P10 | Unit 7 | teacher_notes | S3 | "Exercise Set 10.4 Q2, p.21 part (ii) is the harder chart to plan — students who are ready can attempt it as self-study." | Contradicts the unit's own 15-32 and 32-45 bands, where every student builds both charts in class. | Delete, or reword as "give extra support on part (ii)". |
| 33 | P10, P13, C | P10 U2 notes, U8 notes; P13 U2 notes, U5 notes, U9 notes, U10 notes; C U1 notes | teacher_notes | S3 | e.g. P10 U2: "can read Example 2, p.9 on their own" (the same unit's 12-25 band introduces it); P10 U8: "can read Example 9, p.26 … on their own" (U9 teaches it); P13 U2: "Example 2, p.9 is also suitable for … self-study" (its 28-42 band works it); P13 U5 "Q6 … can be read independently" (U6 works it); P13 U9 "EoC Q7 … self-study" (U13 works it); P13 U10 "Example 8 … independent reading" (U11 works it) | The notes label items as self-study even though the same plan teaches them in class, which contradicts the plan. | Remove the self-study pointers for items the plan teaches. |
| 34 | P10 | Unit 9 | teacher_notes | S3 | "The weighted-mean ideas from the first strand re-enter quietly here: because every bar totals 24 hours, the 100% stacked bar and the stacked bar coincide" | Bars coinciding because the totals are equal has nothing to do with the weighted mean. | "Because every bar totals 24 hours, the stacked and 100% stacked charts coincide…" |
| 35 | C | Unit 14 | textbook_items_in_class E-21 description | S3 | "Brahmagupta's pool: 30-hasta pool…" | The book attributes EoC Q4 to Pṛthūdakasvāmī's commentary on Brahmagupta (c. 864 CE). | "Pṛthūdakasvāmī's pool problem (commentary on Brahmagupta)". |
| 36 | P10 | Unit 10 | teacher_notes | S3 | "remind them it shows totals only when drawn at an absolute scale, not when proportional" | Muddled: a stacked bar chart always shows totals, and a proportional one is by definition a 100% stacked bar chart. | "…a stacked bar chart shows totals; a 100% stacked bar chart does not." |
| 37 | P10 | Item 6 (ECR) | guide.ECR.inclusivity | S3 | "the reversal in ranking under equal weights versus the tie under 5:3:2" | Not a reversal. Under equal weights Dev leads (78.33 vs 76.67); under 5:3:2 they tie at 76. | "Dev leads under equal weights but the two tie under 5 : 3 : 2". |
| 38 | P10 | Unit 9 | visual_aids | S3 | "Textbook Fig. 10.6 (age-group time-use stacked column chart, p.26–27)" | Fig. 10.6 is on p.27 only. Fig. 10.5 is on p.26. | "Fig. 10.5 (p.26) and Fig. 10.6 (p.27)". |
| 39 | C, P13, P10 | C U10; P13 U11; P10 U8 (Example 8) | teacher_notes | S3 (advisory, unsure whether in scope) | (all three use the chart's 40% / 25% / 35% for Naveen, which is correct) | Book quirk confirmed. The p.25 prose says Naveen had "40% in summer, 35% in monsoon, and 25% in winter". The p.24 chart and both Case charts (48/30/42 of 120; 96/60/84 of 240) show monsoon 25%, winter 35%. The plans are correct but do not warn the teacher, and students reading p.25 will see the contradiction. | Add one line: "Note: the p.25 text swaps Naveen's monsoon/winter shares; the chart (25% monsoon, 35% winter) is correct." |

## Verified correct (no finding)

These all match the PDF and recompute correctly.

**Worked examples**
- Example 1: 157.415 and 161.09; 149.33 × 3 = 447.99.
- Example 2: 15.53.
- Examples 3/4: 15%; 90/700 ≈ 12.9% ≈ 13%.
- Example 5: 0.55 × 320 = 176, giving y = 240.
- Example 6: 65.67% equal-weight (the book's "65.6%" is truncated); 67.3% weighted.
- Restaurant rating: 37/9 = 4.11 (food 5, service 3, ambience 4, as in the p.15 picture).
- Example 7: 2025 total 2000 → 11/40/23/26.

**Exercises**
- Ex 10.1: Q1 73.82; Q2 0.11; Q3 11.13 varṇa; Q5 11.67% / 8.33%.
- Ex 10.2 Q1: (iii) and (iv) correct.
- Ex 10.3: Q1 32.2%; Q2 45 km; Q3 option (v); Q4 10/3 L; Q5 65.67 vs 66.33.
- Ex 10.3 Q6: per-metric averages 4.3/3.3/2.8 → 3.57.
- Ex 10.3 Q7: 25 males; 13.84; 16.5; 16.46.
- Ex 10.3 Q8: 11.334%; ≈3777 L; impossible.
- Ex 10.4 Q2: totals 194/292; 234/149/103.

**End-of-Chapter exercises**
- Q1: 9 and 6.3.
- Q3: 115.71 and 10 shares.
- Q4: 5 hastas.
- Q5: 22.5/25/12.5/10.45/20/15.

**Charts**
- Healthcare shares: A 21.0%, B 16.6%, C 18.5%.
- Fig. 10.6 readings used by the plans: learning 22% → 11%; adults' paid 14% vs unpaid 15%.

**In-plan scenarios**
- C U16 canteen: 49.7/12 ≈ 4.14 and 51.1/12 ≈ 4.26.
- Student 24-h rows all sum to 24.

**Item keys**
- C items: 70.31, 13.01, 9.33, 300, 70.9, 29.6%, 60/30/10 & 30/50/20.
- P13 items: 69 (C key), 15.1, V = 600, 73, totals 240/260/280, 1000/1000 percentages.
- P10 items: 72 (B key), 3494, 3.33%, 1.8 L, 76/76, totals 240/300/280, 18/30/12/40 & 11.25/25/20/43.75.
- All MCQ keys (C 2, 7, 8, 10; P13 1, 6; P10 1, 3, 7) have exactly one correct option, and the option explanations describe the distractors correctly.
- Every page and question reference in the book_ref fields checks out.
- All time bands are contiguous and sum to 50.

## Summary

There are 39 findings: 1 S1, 8 S2 and 30 S3. Five of the S3 findings are marked unsure or advisory: #24, #26, #30, #39 and the S1/S2 boundary on #2.

The only S1 is a swapped-pairing computation in C Item 1's inclusivity guide.

The S2 findings are:
- a misreading of the EoC Q9 play charts (C U11);
- an unsupported Example 7 interpretation (C U9);
- an unanswerable sub-part with no key (C Item 9);
- fractional participants and unit-incompatible averaging in C Item 13;
- overlapping must/might/cannot categories in P13 Item 9's marking;
- an invented "in-text question" (P10 U6);
- an infeasible extension task (P10 Item 4).

The S3 findings are mostly:
- Fig. 10.2 described as a column chart;
- leaked "think_reflect" labels;
- forward-reference register;
- notes that call items "self-study" when the plan teaches them in class;
- some muddled wording.

All three plans use the chart's correct Naveen values (40/25/35). The book's p.25 prose does contradict its own chart (monsoon/winter swapped), and no plan warns the teacher.

**Could not verify.** I did not estimate exact readings for:
- the IUCN chart (Ex 10.4 Q1);
- the orbit chart (EoC Q7);
- the playground map (EoC Q8);
- the disability chart (EoC Q11).

None of the plans asserts specific values from these four charts. Play-chart counts in #2 and #30 are pixel estimates (±5%).
