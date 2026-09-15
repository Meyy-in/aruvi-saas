"use client";

/* ───────── ProfilePortal — ONE window for "what did Aruvi assume, and what do I want to change?"
 * (founder, 2026-08-27) ───────────────────────────────────────────────────────────────────────
 *
 * There used to be TWO windows on My Classes doing one job:
 *   • the standing "+" grow portal — "What would you like to change?" — Subject · Class · Section;
 *   • the once-per-tour "Would you like to check your set-up?" prompt, which offered a single row
 *     into the profile accordion.
 * They were the same question asked at two moments, and the check prompt was the weaker of the
 * two: it named the thing (sections, periods, the year's total) and then handed her a generic
 * "open my teaching profile" link to go find it. So the check prompt is now the SAME window,
 * wearing its own title. Only the title and the sub-line differ — the rows are identical,
 * because the rows are the answer in both moods.
 *
 * ★ FOUR rows — class · section · periods a week · annual budget (founder, 2026-08-27, arrived
 * at over the day). First run asks THREE things (subject · class · chapter) and ASSUMES the
 * rest on her behalf: the section, the periods-per-week, and the calibrated annual budget Year
 * Plan is then built on — so a window offering only the structural levels cannot answer "did
 * Aruvi get my set-up right?". Periods a week and the annual budget each route into the SAME
 * editNums screens the profile's pencils use (portalIntent "ppw" | "budget"). Subject was the
 * fifth and is gone — see the ROWS note below.
 *
 * ★ EACH ROW CHANGES ONLY ITSELF. No row runs downstream into the next level's questions: the
 * class row adds a class with first run's own defaults (Section A, default length, default
 * periods, auto budget) and stops. Anything else she wants set, she sets from the row that
 * names it — which is why the window comes back after every visit.
 *
 * ★ AND A WAY OUT TO THE WHOLE PROFILE (founder, same day). The rows are each a spot edit;
 * the footer is the panorama — "want to see your full teaching profile?" — because a teacher
 * checking her set-up may want to READ it all at once and be reassured, not amend one field.
 * It opens the profile under Settings, where she can amend directly too.
 *
 * Modes:
 *   "change" — she pulled the "+".
 *   "check"  — Aruvi is asking, at one of two moments (see the pending helpers below). Carries a
 *              caller-supplied `sub` line saying WHAT was assumed.
 * Neither has a closing button: the ✕ is the exit, and nothing here is a gate.
 */

/* ★ NAMES ONLY, no explanatory line under each (founder, 2026-08-27). The rows carried a
   sub-line apiece ("Add or remove a class in a subject") and five of them turned a glanceable
   list into a page — on a 360px phone the last row fell below the fold. They are the words the
   profile itself uses; a teacher standing in this window already knows what a Section is.
   One line each, the chevron on the right. */
/* ★ NO "Subject" ROW — IN EITHER MOOD (founder, 2026-08-27, in two steps). It went from the
   CHECK window first: that window asks "did Aruvi get this right?", and the subject is the one
   thing on the list Aruvi never guessed — she BOUGHT it (billing unit = teacher × subject-stage)
   or she just added it, which is what raised the window. Then from the "+" window too, for a
   blunter reason: **she cannot add a subject here anyway** (a new subject is a purchase, so it
   arrives through the subscribe flow), which leaves REMOVAL as the row's only working half — the
   most destructive act in the profile, one tap from a window she opened to add a section. The
   subject-level dustbin still exists, in Settings › teaching profile, behind the master EDIT
   toggle and its scoped warning. That is far enough away. */
const ROWS = [
  { kind: "class", label: "Class" },
  { kind: "section", label: "Section" },
  { kind: "ppw", label: "Periods a week" },
  { kind: "budget", label: "Annual period budget" },
];

/* ★ `values` — the CURRENT setting for each row, shown in the CHECK mood only (founder,
   2026-08-27: "values only for first time including when new subject stage added, not during
   'what would you like to change' rounds").

   The window's title asks whether her set-up is right, and four bare nouns cannot be checked —
   she had to open every row to discover what Aruvi had chosen, four round trips to answer one
   glance-sized question. A value is NOT the sub-line this file struck above: it is short and it
   sits right-aligned on the SAME line, so the "one line each" rule and the 360px fold both
   stand. The "+" mood keeps bare names — it is unscoped by nature, so "6, 7, 8" against Class
   would be noise on a row she is only using to navigate.

   A missing value renders NOTHING. Never a dash, never a zero, never a guess: a window asking
   whether Aruvi got her record right must not invent an answer about it. */
export default function ProfilePortal({ mode = "change", sub, values, onPick, onClose, onOpenProfile }) {
  const check = mode === "check";
  const val = (kind) => (check && values && values[kind]) || null;
  return (
    <div className="ap-overlay" onClick={onClose}>
      <div className="ap-modal ap-grow" onClick={(e) => e.stopPropagation()}>
        <button className="ap-close" aria-label="Close" onClick={onClose}>✕</button>
        <div className="ap-head">
          <div className="ap-kicker">Your teaching</div>
          <div className="ap-title">
            {check ? "Would you like to check your set-up?" : "What would you like to change?"}
          </div>
          <div className="ap-sub">
            {check
              ? (sub || <>Meyy started you off with its own suggested set-up. You can change any of
                  it — or leave it and carry on teaching.</>)
              : <>Each item changes only itself — pick another for the next. Your lessons always
                  stay in the library.</>}
          </div>
        </div>
        <div className="ap-list">
          {ROWS.map((r) => (
            <button key={r.kind} className="ap-row ap-row-line" onClick={() => onPick && onPick(r.kind)}>
              <span className="ap-row-label">{r.label}</span>
              {val(r.kind) ? <span className="ap-row-val">{val(r.kind)}</span> : null}
              <span className="ch-go" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        {/* The panorama, deliberately BELOW the scrolling row list and outside it: it is not a
            fifth thing to change, it is the whole picture. */}
        <button type="button" className="ap-foot" onClick={() => onOpenProfile && onOpenProfile()}>
          <span>Want to see your full teaching profile?</span>
          <span className="ap-foot-go" aria-hidden="true">›</span>
        </button>
        {/* No closing button in EITHER mood (founder, 2026-08-27). Declining had a control of
            its own — "Not now — my set-up is fine" — first as a first-run-sized `.fr-cta` slab,
            then as a quiet `.ap-decline` line. Both were a whole row of the window restating
            what the ✕ in the corner already offers, on a window whose height has been the
            standing problem. The ✕ and a tap outside are the exit, as in every other ap-modal. */}
      </div>
    </div>
  );
}

/* ── The "she just added something" queue ────────────────────────────────────────────────────
 * The check window has TWO moments. The first is the end of the guided tour (page.jsx's
 * finishTour) — her very first set-up, all of it assumed. The second is this one: a subscriber
 * ADDS a subject or a class, and Aruvi again assumes a section, a periods-per-week and a year's
 * total for it. She should be asked the same question about the new one — but NOT at the moment
 * she adds it (that is the profile screen she is already standing on, and §0's benefit-first rule
 * says do not stack configuration on configuration). She is asked the first time she actually
 * USES it: when My Lessons scopes to that subject·class.
 *
 * So an add writes a key here and My Lessons spends it. Per user (a shared browser must never
 * hand one teacher another's queue) and per subject·class, since a new CLASS in an existing
 * subject carries exactly the same assumptions as a new subject does.
 * localStorage, not the server: it is a prompt, not a record — losing it costs one question.
 */
/* ★ THE QUEUE MOVED to @aruvi/shared/setupCheck (Track D 5d F3, 2026-09-15) so the phone's check
 * window asks — and stops asking — by exactly the same rules. The reasoning above travelled with
 * it; this re-export keeps every existing import in this repo working.
 * ⚠️ Imported AND re-exported: `export … from` alone serves importers without binding the names
 * in this module's own scope, and the component below calls `setupKey` (the PPW_CHOICES lesson,
 * same day). */
import {
  setupKey, queueSetupCheck, takeSetupCheck, pruneSetupCheck, SETUP_CHECK_DELAY_MS,
} from "../lib/setupCheck";
export { setupKey, queueSetupCheck, takeSetupCheck, pruneSetupCheck, SETUP_CHECK_DELAY_MS };
