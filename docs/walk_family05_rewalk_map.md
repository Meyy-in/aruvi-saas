# Family 05 — the web pass, and what a fix re-opens

Written 2026-09-24, at the web→fix batch boundary of THE WALK. Companion to
`docs/walk_session_brief.md`; the verdicts themselves live in `data/testing/walk_state.json`.

## 1. Where the web pass ended

All 32 rows of family 05 (My Classes · My Lessons · Prepare · Year Plan) walked on the web
against account 9000000003 (subscribed), web dev at localhost:3000 talking to Render.

**21 pass · 7 fail · 4 parked.** Amendments WALK-A-060 … WALK-A-077 (18 raised; 2 closed
during the walk as no-defect).

### The seven fails
| Row | What failed | Amendment |
|---|---|---|
| 05.18 | Word reports not at PDF parity — no period-row shading, cramped spine LO, no rule between questions | 067 (+066 filenames) |
| 05.24 | Fast double-tap opens an unrelated lesson (second click lands on the new screen) | 069 |
| 05.25 | "Prepare again" replaces nothing; a different length adds a second plan | 070 (copy fix — behaviour kept) |
| 05.27 | A failed RE-prepare has nowhere to be said; its bar never ends | 071 |
| 05.28 | Prepare and Year Plan disagree by one period; chapter number repeated in the row title | 074, 072 |
| 05.31 | Archiving never reaches the other device | 075 (+076 section context) |
| 05.32 | A 401 is swallowed as if it were a network failure | 077 |

### The four parked, and on what
- **05.11, 05.12, 05.19** — need an account with a PRIOR ACADEMIC YEAR. Also parks the
  prior-year folder and the `{year} version` chip left unexercised at 05.04.
  Plan: roll a year on a throwaway account (`aruvi-scripts/carry_over_year.py`; 9000000004 is
  expendable) and walk all four together.
- **05.26**, and the lapsed half of **05.21** — need ENTITLEMENT ENFORCEMENT on a trial
  account (`ARUVI_ENTITLEMENT_ENFORCED`), and the WALK-A-048 trial-quota deploy is not live.
  One entitlement sitting, on a throwaway account, covering trial-exhausted and lapsed.

## 2. The amber list — 12 of 32 rows need a fresh pass after the fixes

The seven fails above, plus **five rows that are green today and go amber when a fix lands**:

| Row | Currently | Goes amber because of |
|---|---|---|
| 05.02 | pass | 060 — the empty-state copy points at the read-only gear |
| 05.05 | pass | 061 — the completed chapter still offered in its own section's picker |
| 05.10 | pass | 062 — sand-grey flash before the card turns green |
| 05.16 | pass | 064 (offline archive claims success) + 065 (focus ring) |
| 05.22 | pass | 068 — the class-wheel rule change |

**Twenty rows stay green** and need no re-walk.

## 3. Blast radius — which surfaces each fix re-opens

- **Shared / API — re-opens ALL THREE surfaces:** 064, 066, 067, 068, 070, 072, 074, 075, 077
- **Both surfaces, separate code each side:** 060, 061, 069, 071, 076
- **Web only:** 062, 065

Family 05 has not been walked on the phones at all, so the shared fixes cost nothing there for
THIS family — which is the argument for doing them before the phone pass rather than after.

**But they reach back into families already walked.** `plans.js`, `account.js` and `verify.js`
are exercised by first run, sign-out and the subscribe flow in families 03 and 04. After 075 and
077 land, spot-check (not re-walk) the rows that read a cached listing or handle a refused
session.

## 4. Suggested fix order

1. **The network-honesty set — 064, 071, 077, and 05.18's offline alert.** One idea, four
   places: the app has no honest account of "the network did not answer". The template already
   exists in the product — the Year Plan export's *"Couldn't download the year plan. Couldn't
   reach Meyy just now. Tap the arrow to try again."* Decide the wording ONCE for every
   `verifiedWrite` caller and every cached fetcher, rather than patching each.
2. **074** — the one-period disagreement. A single pane suggests 22 and then says one period of
   it is surplus. One shared helper + a test pinning the two panes together.
3. **068** — the class-wheel rule. Also deletes the frozen-12 suggestion for free, by removing
   the only route into the state where it appears.
4. **075** — archive across devices (the ETag machinery is already built).
5. The copy and label set — **060, 070, 072, 066, 076** — and then **061, 062, 065, 069**.

## 5. The register, after the 2026-09-24 reconciliation

Carried-in amendments marked `fixed-awaiting-rewalk` were reconciled against the cells they
name. An amendment was closed only where EVERY recheck surface reads pass AND either the pass
was recorded after the fix, or the cell carries an explicit "re-walked … after WALK-A-0NN" note.

**23 closed.** **22 still genuinely amber** — 20 of them awaiting an `and_emu` or `ios` re-walk
that has not happened, plus WALK-A-043 and WALK-A-051, which list no recheck surface at all and
need one assigning.

**19 open**, being the 16 from family 05 plus the three carried in:
- **WALK-A-055** — a trial chapter counted for a lesson never delivered (founder's to decide)
- **WALK-A-056** — the ~5s email-in-use check (measure before choosing a fix)
- **WALK-A-059** — the Fabric crash at the first-run → My Lessons handover (cause unknown)

⚠️ Re-walks are recorded by APPENDING "✓ re-walked {date} after WALK-A-0NN" to the existing
cell comment, without changing the cell's timestamp. Keep doing that — the reconciliation above
depends on it, and a re-walk noted without the amendment id cannot be matched.
