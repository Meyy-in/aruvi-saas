/* ───────── ProfilePortal — "what did Meyy assume, and what do I want to change?" ─────────
 *
 * A port of `web/app/components/ProfilePortal.jsx` (Track D step 5d). ONE window doing a job that
 * used to need two: the standing "+" portal ("What would you like to change?") and the
 * once-per-tour "Would you like to check your set-up?" prompt. They were the same question asked
 * at two moments, and the check prompt was the weaker — it NAMED the thing (sections, periods,
 * the year's total) and then handed her a generic "open my teaching profile" link to go find it.
 * So it is now the same window wearing its own title. Only the title and the sub-line differ; the
 * rows are identical, because the rows are the answer in both moods.
 *
 * ★ FOUR ROWS — class · section · periods a week · annual budget (founder, 2026-08-27). First run
 * asks THREE things (subject · class · chapter) and ASSUMES the rest on her behalf: the section,
 * the periods a week, and the calibrated annual budget the Year Plan is then built on. A window
 * offering only the structural levels could not answer "did Meyy get my set-up right?".
 *
 * ★ EACH ROW CHANGES ONLY ITSELF. No row runs downstream into the next level's questions: the
 * class row adds a class with first run's own defaults and stops. Anything else she wants set,
 * she sets from the row that names it — which is why the window comes back after every visit.
 *
 * ★ NO "SUBJECT" ROW, IN EITHER MOOD, and the reason is worth keeping: she cannot ADD a subject
 * here (a new subject is a purchase, so it arrives through the subscribe flow), which leaves
 * REMOVAL as the row's only working half — the most destructive act in the profile, one tap from
 * a window she opened to add a section. The subject-level dustbin stays in Settings, behind the
 * master edit toggle and its scoped warning. That is far enough away.
 *
 * ★ AND NO CLOSING BUTTON, IN EITHER MOOD. Declining had a control of its own once — "Not now, my
 * set-up is fine" — and it was a whole row of the window restating what the ✕ already offers, on
 * a window whose height has been the standing problem. The ✕ and a tap outside are the exit, and
 * nothing here is a gate.
 *
 * Built on the app's own `Sheet`, which supplies the ✕, the scrim and the tap-outside close.
 */
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* Names only, no explanatory line under each (founder, 2026-08-27). The rows carried a sub-line
   apiece ("Add or remove a class in a subject") and five of them turned a glanceable list into a
   page — on a 360px phone the last row fell below the fold. They are the words the profile itself
   uses; a teacher standing in this window already knows what a Section is. */
export const PORTAL_ROWS = [
  { kind: "class", label: "Class" },
  { kind: "section", label: "Section" },
  { kind: "ppw", label: "Periods a week" },
  { kind: "budget", label: "Annual period budget" },
];

/* ★ THE WINDOW'S OWN WORDS, so the LAYOUT can put them on the one Sheet both this and the editor
 * share. Only the title and the sub-line differ between the two moods; the rows are identical,
 * because the rows are the answer in both. */
export function portalChrome(mode = "change", sub) {
  const check = mode === "check";
  return {
    kicker: "Your teaching",
    title: check ? "Would you like to check your set-up?" : "What would you like to change?",
    sub: check
      ? (sub || "Meyy started you off with its own suggested set-up. You can change any of it — or leave it and carry on teaching.")
      : "Each item changes only itself — pick another for the next. Your lessons always stay in the library.",
  };
}

/* ★ THE CHECK WINDOW'S SUB-LINE, RENDERED (app. 01 row 75, 2026-09-16). The PARTS come from
 * `setupCheckSub` in @aruvi/shared — the rule about what the line says is one rule, and the web
 * runs the same one — and only the emphasis is drawn here, because the web bolds with `<b>` and a
 * phone bolds by naming a different FACE. Returns null when there is nothing to say, which lets
 * `portalChrome`'s own default stand (it is this component's zero-sections sentence, word for
 * word).
 *
 * It names what Meyy ASSUMED, because that is the whole reason to ask: she never chose a section,
 * a periods-a-week or a year's total, and she cannot check what she does not know was set. */
export function SetupCheckSub({ parts }) {
  const ws = useWebStyles();
  if (!parts) return null;
  const B = ({ children }) => <Text style={ws.ap_sub_b}>{children}</Text>;
  if (parts.reason === "added") {
    return (
      <>You’ve added <B>{parts.subject}</B>. <B>{parts.stage} stage</B>. Amend any of these items below.</>
    );
  }
  /* ⚠️ "with 0 sections" is never a sentence worth showing — a profile that has moved under us
     names the assumption without counting it. */
  const phrase = !parts.count ? <>its own suggested set-up</>
    : parts.count === 1
      ? <>Section <B>{parts.tag}</B> and its own suggested periods for the year</>
      : <><B>{parts.count} sections</B> and its own suggested periods for the year</>;
  return (
    <>Meyy started you off with {phrase}. You can change any of it — or leave it and carry on teaching.</>
  );
}

/* ⚠️ RENDERS ITS BODY ONLY — the Sheet around it belongs to the layout (2026-09-15). This used to
 * own its own Sheet, and the editor owned a second one, so opening an edit UNMOUNTED one Modal and
 * MOUNTED another: two fade transitions back to back, with the bare screen showing in the gap
 * between them. Founder: "when 'x' is used to click off, it goes back to my classes for a moment
 * before showing 'what would you like to change?'". One window whose contents change has no gap
 * to show. */
export default function ProfilePortal({ mode = "change", values, onPick, onOpenProfile }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const check = mode === "check";
  const val = (kind) => (check && values && values[kind]) || null;

  return (
    <>
      <View style={[ws.ap_list, ws.ap_grow_list]}>
        {PORTAL_ROWS.map((r) => (
          <Pressable key={r.kind} onPress={() => onPick && onPick(r.kind)}
            accessibilityRole="button" accessibilityLabel={r.label}
            style={[ws.ap_row, ws.ap_row_line,
              { borderColor: t.line_soft, backgroundColor: t.paper_2 }]}>
            <Text style={[ws.ap_row_label, { color: t.ink }]} numberOfLines={1}>{r.label}</Text>
            {val(r.kind) ? (
              /* One line, always: a value that wrapped would recreate the two-line row the web
                 spent a bug fixing. Long lists are elided by the CALLER, never here, so this can
                 never silently hide part of an answer. */
              <Text style={[ws.ap_row_val, { color: t.ink_soft }]} numberOfLines={1}>{val(r.kind)}</Text>
            ) : null}
            <Text style={[ws.ch_go, { color: t.ink_soft }]}>›</Text>
          </Pressable>
        ))}
      </View>

      {/* The panorama, deliberately BELOW the row list and outside it: not a fifth thing to
          change, but the whole picture — because a teacher checking her set-up may want to READ
          it all at once and be reassured rather than amend one field. */}
      <Pressable onPress={() => onOpenProfile && onOpenProfile()} accessibilityRole="button"
        style={[ws.ap_foot, { borderTopColor: t.line_soft }]}>
        <Text style={[ws.ap_foot_t, { color: t.pine }]}>Want to see your full teaching profile?</Text>
        <Text style={[ws.ap_foot_go, { color: t.ink_soft }]}>›</Text>
      </Pressable>
    </>
  );
}
