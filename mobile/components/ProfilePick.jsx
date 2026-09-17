/* ───────── the two PICK screens — "In which subject?" and "Which class?" (5d item 3) ─────────
 *
 * The web's `screen === "portalSubject"` and `screen === "portalClass"` from
 * `web/app/components/TeachingProfile.jsx`, ported for Expo. They exist for one reason: a portal
 * row names a THING to change (sections, periods a week, the annual budget) and every one of
 * those belongs to ONE subject·class. A teacher with a single subject and a single class is never
 * asked — there is nothing to ask — but the moment she has two, the window cannot know which she
 * meant, and until today the phone's answer was to do NOTHING (5d shipped that deliberately:
 * "a teacher with more than one is left on the window, which is honest, until item 3 lands").
 * This is item 3.
 *
 * ★ BODY-ONLY, like ProfilePortal and ProfileEditor. The Sheet belongs to the layout since
 * `dac26eb0` — one window whose children swap, so moving between the portal, a pick and the
 * editor shows no gap. This file draws the web's `.tp` header and its rows and nothing else.
 *
 * ★ THE ROWS ARE THE WEB'S `.tp-portal-row`, NOT A PickWheel, and that is the right shape: a
 * wheel is for CHOOSING FROM A SET where the resting row is the answer and ticking is the act.
 * Here the tap is NAVIGATION — pick a subject and the next question opens. The web makes exactly
 * this distinction (its portal list is buttons; its section letters are a wheel), and a teacher
 * tops out at a handful of subjects, so there is no list long enough to need a wheel's economy.
 *
 * ★ WHAT IT DOES NOT DECIDE. Which classes a subject may offer is `portalGradeIdxs` in
 * @aruvi/shared — the scope filter, with 6 node tests — so a scoped visit shows the purchased
 * stage's classes only and an `exact` scope skips both screens entirely. The words are shared
 * too (`goalWord`): a phone saying "period budget" where the web says "annual period budget"
 * would be a divergence nobody chose and nobody could see without holding the two side by side.
 */
import { useEffect } from "react";
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { classNum } from "@aruvi/shared/format";
import { goalWord, portalGradeIdxs } from "@aruvi/shared/profile";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* One navigation row. `label` is what she reads; the "›" is the affordance and is hidden from
   assistive tech, which reads the row's own label instead. */
function PortalRow({ label, onPress }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [ws.tp_portal_row,
        { borderColor: pressed ? t.pine : t.line, backgroundColor: pressed ? t.tint_cream : t.paper_2 }]}>
      <Text style={ws.tp_portal_label} numberOfLines={1}>{label}</Text>
      {/* ★ THE PRESSED STATE IS THE WEB'S `:hover`, MOVED (a technical limitation, CLAUDE.md §4).
          A phone has no pointer to hover, so the pine border and cream fill the web shows on
          hover are shown on PRESS instead — the same two values, at the only moment a phone can
          show them. */}
      <Text style={[ws.tp_portal_go, { color: t.ink_soft }]} accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">›</Text>
    </Pressable>
  );
}

/* `goal` — the portal row she tapped ("section" | "ppw" | "budget" | "class").
   `subject` — null on the SUBJECT screen; the chosen subject's name on the CLASS screen.
   `subjects` — her canonical `readiness.subjects[]`.
   `scope`   — the portal scope, so the class list narrows exactly as the web's does.
   `onPickSubject(name)` / `onPickClass(grade)` — the layout routes; this screen only asks.
   `onChrome` — reports the window's ← up, exactly as ProfileEditor does. */
export default function ProfilePick({ goal, subject = null, subjects = [], scope = null,
                                      onPickSubject, onPickClass, onBackToSubject, onChrome }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const what = goalWord(goal);
  const asking = subject ? "class" : "subject";

  /* ★ ← ON THE CLASS SCREEN ONLY — the same rule the duration step follows, and for the same
     reason: it is the one screen reached THROUGH another, so it is the one with a previous step
     to return to. The subject screen is entered from the portal, whose way back is the ✕.
     ⚠️ And the web owed this too. Its pick screens carry a bottom "← Back" that goes to the
     ACCORDION rather than to the previous question, and inside the window that link is hidden
     anyway (`.tp-window-card .tp > .fr-link`) — so on the web "Which class?" had no way back to
     "In which subject?" either. Same defect as the duration step, fixed on both surfaces in the
     same commit as this port.
     ⚠️ AND ONLY WHEN THE SUBJECT QUESTION WAS ACTUALLY ASKED. A teacher with ONE subject and
     several classes is routed straight to this screen — the subject question is skipped because
     it has one possible answer — so a ← here would walk her BACK into a screen she never saw,
     listing the single subject she obviously meant. `subjects.length > 1` is the same test the
     routing rule used to decide whether to show that screen in the first place. */
  const back = asking === "class" && subjects.length > 1 ? onBackToSubject : undefined;
  useEffect(() => { if (onChrome) onChrome({ onBack: back }); }, [onChrome, asking]); // eslint-disable-line react-hooks/exhaustive-deps

  const rec = subject ? subjects.find((s) => s.name === subject) : null;
  /* A subject that has gone since the window opened (removed in another session) leaves nothing
     to ask about. Render the empty sentence rather than a blank card — a screen may say it does
     not know; it may never invent an answer about her record (the Support `metaErr` rule). */
  const grades = (rec && rec.grades) || [];
  const idxs = portalGradeIdxs(grades, scope && scope.subject === subject ? scope : null);

  return (
    <View>
      {/* The web's `.tp` header: kicker, then the question flush against it, then the hint.
          `tp_kicker_pad` and the ← indent are the editor's own rule — the corners are absolutely
          positioned over this line, so the line moves for them. */}
      <Text style={[ws.kicker, ws.tp_kicker_pad, back && { paddingLeft: 34 }]}>
        {asking === "subject" ? `Your teaching · ${what}` : `${subject} · ${what}`}
      </Text>
      <Text style={ws.fr_q}>{asking === "subject" ? "In which subject?" : "Which class?"}</Text>
      <Text style={[ws.fr_hint, { color: t.ink_soft }]}>
        {asking === "subject"
          ? (goal === "class"
            ? "Pick the subject whose classes you want to change."
            : `Pick the subject, then the class whose ${what} you want to change.`)
          : `Pick the class whose ${what} you want to change.`}
      </Text>

      <View style={ws.tp_portal_list}>
        {asking === "subject"
          ? subjects.map((s) => (
            <PortalRow key={s.name} label={s.name} onPress={() => onPickSubject && onPickSubject(s.name)} />
          ))
          /* Rendered from `portalGradeIdxs` — the SAME list the layout counted when it decided
             whether to show this screen at all, so the two can never disagree. */
          : idxs.map((gi) => {
            const g = grades[gi];
            return (
              <PortalRow key={String(g.grade)} label={`Class ${classNum(g.grade)}`}
                onPress={() => onPickClass && onPickClass(g.grade)} />
            );
          })}
      </View>

      {asking === "class" && idxs.length === 0 ? (
        <Text style={[ws.fr_hint, { color: t.ink_soft }]}>
          {/* ★ IT NAMES THE WAY BACK (2026-09-17). It used to state the dead end and stop — true,
              and no use to a teacher standing in it. Since a subject she owns now SURVIVES losing
              its last class, this screen is reachable by design rather than by accident, and the
              row that fixes it is one tap away in the window she came from. */}
          {subject} has no classes in your profile. Add one under Class — your lessons are kept
          either way.
        </Text>
      ) : null}
    </View>
  );
}
