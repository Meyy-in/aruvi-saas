/* ───────── the shell's notices — what the APP has to say, not what a screen has ─────────
 *
 * ★ WHY THEY LIVE IN THE SHELL (Track D 6a F10, 2026-09-16). Each of these is true of the whole
 * app rather than of whichever screen happens to be showing: a section that did not save is a
 * fact about her classes, and a bumped Privacy Notice is a fact about Meyy. On the web they sit
 * at the top of `.bodycontent > main`, above every view, and there is one of each. Threading
 * them through four route files is how two of them end up disagreeing.
 *
 * ★ PINNED, NOT SCROLLED, and that is the phone's own answer rather than a divergence. The web
 * has ONE scroll region and these ride at the top of it; here every screen owns its scroller, so
 * a notice inside one would scroll away and a notice inside all four would be four notices. They
 * sit between the bar and the Stack — the same shape My Classes' greeting and My Lessons' frozen
 * header already use: above the scroller, which is a sticky without a sticky.
 *
 * ★ AND THEY ARE ROLE-MARKED DIFFERENTLY ON PURPOSE. The section bar is an `alert` — something
 * she did has not happened. The privacy bar is a `status` — nothing is wrong and nothing is
 * being asked; a notice is GIVEN (DPDP §5), so it is announced, never re-ticked.
 *
 * ⚠️ NOT HERE: the profile's own save-failed caption. The web renders that in the shell too, but
 * the phone's `ProfileEditor` already draws it INSIDE the window the write happened in, and
 * keeps her there looking at the server's copy — a named divergence with a reason (its own
 * comment: "sending her back with a banner would put the message on one screen and the wrong
 * number on another"). A second one up here would be the same sentence twice.
 */
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* A VERIFIED section mismatch (app. 01 row 43) — the server was read back and the class is not
 * on the chapter she just attached, or not marked complete. Never on a throw and never when the
 * server could not be reached: those are "we cannot tell", not "it failed".
 * ⚠️ Until 2026-09-16 the phone installed NO handler at all, so this disagreement was SILENT
 * here while the web said one sentence about it. */
export function SectionFailedBar({ message, onDismiss }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  if (!message) return null;
  return (
    <View style={[ws.tp_savefail, { borderColor: t.edge_clay, backgroundColor: t.paper_2,
                                    marginHorizontal: 18, marginBottom: 12 }]}
      accessibilityRole="alert">
      <Text style={[ws.tp_savefail_t, { color: t.ink }]}>{message}</Text>
      <Pressable onPress={onDismiss} accessibilityRole="button" hitSlop={8}
        style={[ws.tp_savefail_btn, { borderBottomColor: t.edge_clay }]}>
        <Text style={[ws.tp_savefail_bt, { color: t.clay }]}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

/* "Meyy's Privacy Notice has been updated" (app. 01 row 44; the web's rule, 2026-09-04).
 * ★ ACKNOWLEDGED, NOT SIGNED. A notice is given, so a new version is ANNOUNCED — one quiet bar —
 * and both actions stamp it seen, because a teacher who read it has plainly seen it. The server
 * decides what counts as an update by comparing the version on her account with the highest file
 * on disk, and an account with no recorded version is silent (founder, same day: no pop-up for
 * existing users). */
export function PrivacyNoteBar({ version, onRead, onDismiss }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  if (!version) return null;
  return (
    <View style={[ws.pn_note, { borderColor: t.line, borderLeftColor: t.pine,
                                backgroundColor: t.paper_2 }]}
      accessibilityRole="summary">
      <Text style={[ws.pn_note_t, { color: t.ink }]}>
        Meyy’s Privacy Notice has been updated (version {version}).
      </Text>
      <View style={ws.pn_note_acts}>
        <Pressable onPress={onRead} accessibilityRole="button" hitSlop={8}
          style={[ws.pn_note_btn, { borderBottomColor: t.pine }]}>
          <Text style={[ws.pn_note_bt, { color: t.pine }]}>Read it</Text>
        </Pressable>
        <Pressable onPress={onDismiss} accessibilityRole="button" hitSlop={8}
          style={[ws.pn_note_btn, { borderBottomColor: t.line }]}>
          <Text style={[ws.pn_note_bt, { color: t.ink_soft }]}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
