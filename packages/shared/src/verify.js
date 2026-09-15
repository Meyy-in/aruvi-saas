/* ───────── verify.js — read-after-write verification (founder doctrine, 2026-08-10) ─────────
 *
 * THE RULE, in the founder's words: an error message requires a pre-fact state X, an action A,
 * and an expected post-fact state Y known UPFRONT. After A, pull the actual state Y′ from the
 * server. Raise an error IF AND ONLY IF Y′ ≠ Y.
 *
 * What that rules out, deliberately:
 *   · "the request threw" is NOT a criterion. A 200 can lie and a lost response can hide a write
 *     that succeeded. The transport is evidence about the transport, not about her data.
 *   · "the server is unreachable" is NOT an error. It is a state in which THE CHECK CANNOT BE
 *     PERFORMED. Presuming failure there would invent a fact, which is the one thing this rule
 *     exists to prevent. It returns "unverified" and the caller says nothing.
 *
 * So there are three outcomes, never two:
 *   ok          Y′ === Y     — say nothing, she saw it work
 *   mismatch    Y′ ≠ Y       — the ONLY case that earns a message
 *   unverified  no Y′        — silence; we do not know, and we do not guess
 *
 * THE COMPARATOR IS THE WHOLE RISK. Too strict and it fires on a harmless normalisation, she
 * learns the warning is noise, and the mechanism is worth less than nothing. So a comparator
 * must be written per action, in terms of the FACTS SHE CHANGED, never a deep-equal of raw JSON.
 * That is why `expect` is a function you supply rather than a value this module diffs.
 */

/* Run A, then verify.
 *
 *   write()   -> Promise; performs the action. Its own rejection is NOT treated as failure —
 *                the read decides. (A dropped response after a successful write is exactly the
 *                case that makes this worth doing.)
 *   read()    -> Promise<state>; pulls Y′ fresh from the server, tenanted.
 *   expect(y) -> boolean; true when y satisfies Y. Written per action, in her terms.
 *
 * Returns { status: "ok" | "mismatch" | "unverified", actual }.
 */
export async function verifiedWrite({ write, read, expect }) {
  try {
    await write();
  } catch {
    // Swallowed ON PURPOSE. The write may well have landed; the read is the arbiter.
  }
  let actual;
  try {
    actual = await read();
  } catch {
    return { status: "unverified", actual: undefined };
  }
  let holds = false;
  try {
    holds = !!expect(actual);
  } catch {
    // A comparator that throws is a bug in the comparator, not evidence about her data.
    // Fail SAFE — claim nothing.
    return { status: "unverified", actual };
  }
  return { status: holds ? "ok" : "mismatch", actual };
}

/* ── the readiness comparator (area 1 of the founder's six) ───────────────────────────
 * Compares the FACTS a teacher can change on the profile screen, and nothing else:
 * per subject — its name; per grade — the grade, its section tags, its durations, its
 * periods-per-week. Order is normalised away because she cannot control it and it carries no
 * meaning.
 *
 * ★ THE ANNUAL BUDGET JOINED ON 2026-09-15, and for the same reason the section NAME joined on
 * 2026-08-30: it became the only thing an edit changes. It was excluded while it was written
 * solely as a by-product of the class run — "derived or optional, and a mismatch there would be
 * a normalisation artefact rather than lost work". That is no longer true. The budget editor
 * (Track D step 5c) touches the budget and NOTHING else, so with it outside the fingerprint a
 * save that dropped her year read back as verified and the read-after-write check was silent
 * about the one fact that edit existed to change. A check that cannot see the edit it is
 * checking is not a check.
 *   ⚠️ SO THE ARTEFACT RISK IS ANSWERED BY NORMALISING, NOT BY LOOKING AWAY. Three shapes of
 *   noise exist and all three are collapsed below: the map is keyed by grade INDEX in either
 *   spelling (0 and "0" are written by different code paths); "not set" has two spellings
 *   (absent, and the `{method:"auto", value:0}` that `finalizeSubject` writes for a class she
 *   never answered for); and the value arrives as a number or a numeric string. What survives
 *   is her ANSWER, so a difference can only mean a different year.
 *   ⚠️ AND IT IS READ BEFORE THE GRADES ARE SORTED. The budget map is keyed by the grade's
 *   position in the record's OWN order, while this comparator sorts grades by name — so the
 *   lookup happens inside the map, against the original index, and rides on the grade object
 *   through the sort. Reading it after sorting would pair a teacher's Class X budget with her
 *   Class IX, which is a fingerprint that fails at random on any multi-class subject.
 * The ppw SPLIT stays out: it is genuinely derived from the total, which is already here.
 */
/* ── areas 2–5: PREDICATES, not equalities ───────────────────────────────────────────
 * The profile is the only area where Y is a value she composed. Everywhere else she cannot
 * know the artefact's name in advance — but she does know the PROPERTY that must hold, and
 * that is all the rule needs. Each of these answers one question, in her terms.
 */

/* Area 2 · "the lesson I asked for is now mine." The plans-prepared register is keyed
 * `{subject}/{grade}/{filename}`; the filename comes back from the serve, so by the time we
 * verify we do know it. */
export function planIsPrepared(prepared, subject, grade, filename) {
  const key = `${subject}/${grade}/${filename}`;
  if (Array.isArray(prepared)) return prepared.some((p) => (p && (p.key || p)) === key);
  return !!(prepared && Object.prototype.hasOwnProperty.call(prepared, key));
}

/* Area 3 · "that lesson is in the archive" / "it is back in my lessons." One predicate, a
 * flag for the direction, because archive and restore are the same fact inverted. */
export function planIsArchived(archive, subject, grade, filename) {
  const key = `${subject}/${grade}/${filename}`;
  if (Array.isArray(archive)) return archive.some((p) => (p && (p.key || p)) === key);
  return !!(archive && Object.prototype.hasOwnProperty.call(archive, key));
}

/* Areas 4 and 5 · the section card. Attaching asks "this class is now on that chapter";
 * marking complete asks "this class has finished it". Both read one row, so both share a
 * comparator: `want.chapter` (null = expect no row at all, i.e. an unbind) and, when given,
 * `want.done`. `done` is compared only when asked for, so an attach is not failed by a
 * done-flag it never set. */
export function sectionStateMatches(states, sectionKey, want) {
  const row = (states || {})[sectionKey];
  if (!want || want.chapter === null) return !row || !row.chapter;
  if (!row || row.chapter !== want.chapter) return false;
  if (typeof want.done === "boolean" && !!row.done !== want.done) return false;
  return true;
}

/* Her budget ANSWER for one grade, or "unset" — every spelling of the same fact collapsed. */
function budgetToken(budgetMap, i) {
  const b = (budgetMap || {})[i] ?? (budgetMap || {})[String(i)];
  if (!b) return "unset";
  const method = String(b.method || "");
  const value = Number(b.value) || 0;
  if (!method || (method === "auto" && !value)) return "unset";
  return `${method}:${value}`;
}

export function readinessFingerprint(subjects) {
  return JSON.stringify(
    (subjects || [])
      .map((s) => ({
        name: String(s?.name || "").trim(),
        grades: (s?.grades || [])
          .map((g, i) => ({
            budget: budgetToken(s?.budget, i),
            grade: String(g?.grade || "").toUpperCase(),
            /* Tag AND her own name for it (2026-08-30). The name had to join the fingerprint
               the day it became storable: a rename changes nothing else about the record, so
               without it a save that dropped the label would read back as verified — the
               read-after-write check would be silent about the ONE thing that edit changed. */
            sections: (g?.sections || [])
              .map((x) => {
                const tag = String(x?.tag || x?.sec || "").trim();
                const name = String(x?.name || "").trim();
                return name ? `${tag}:${name}` : tag;
              })
              .filter(Boolean)
              .sort(),
            durations: [...(g?.durations || [])].map(Number).sort((a, b) => a - b),
            ppw: Number(g?.periods_per_week) || 0,
          }))
          .sort((a, b) => a.grade.localeCompare(b.grade)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
}
