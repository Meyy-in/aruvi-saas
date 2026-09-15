/* ───────── The "+" track-a-chapter picker, and the "−" untrack confirm ─────────
 *
 * A 1:1 port of the web's `attachModal` / `untrackModal` (MyPlans.jsx + the `.ap-*` rules in
 * globals.css), per CLAUDE.md §4. Both are MODALS layered over the cards, not screens: the
 * question is about ONE section and she comes straight back to her class list.
 *
 * What the picker lists is the web's rule exactly, and every clause of it matters:
 *   · only chapters SHE PREPARED — /plans returns the whole shared library, so without this
 *     every sample plan in the catalogue would be offered as hers;
 *   · plus any chapter already bound to a SIBLING section of the same subject·class (she is
 *     teaching it to 9A, so offering it to 9B is the common case, not an edge one);
 *   · never the chapter already bound to THIS section — she is here to pick a different one;
 *   · never an ARCHIVED plan (founder, 2026-08-01): the archive holds a plan out of
 *     circulation, so it is restored in My Lessons first and attached after.
 *
 * Deliberately NOT ported yet, and both are Track D's own sequence rather than omissions:
 *   · "prepare a new one" — the destination now EXISTS (step 5 landed /prepare), so the reason
 *     has changed and is worth restating honestly: what is missing is the RETURN. The web's
 *     footer leaves the picker, prepares, and comes back to attach the new chapter to the very
 *     section she opened this window for — an auto-attach return path that has to carry the
 *     section across a route change and survive a cancel. A footer that prepares and then drops
 *     her on My Lessons, with the section she started from forgotten, is worse than no footer:
 *     she came here to fill THAT slot. Wire the return, then the footer.
 *   · last year's lessons (`.ap-prior`) — it needs the year record the phone does not read yet.
 * Neither changes the shape of the modal, so both drop in without moving anything.
 */
import { useMemo } from "react";
import { View, Modal, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform }
  from "react-native";
import { Text } from "./Text";
import { pretty, classNum, pad } from "@aruvi/shared/format";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* The shared chrome of both windows: the dimmed ground, the card, the ✕, the header block. */
/* ★ EXPORTED (step 5, 2026-09-14) — Prepare needs the same window for its re-prepare confirm,
   its committed breakdown and the paywall, and a second implementation of a window is how two
   windows start to differ. One shape, one file. */
/* ★ `scroll` MAKES THE WINDOW HOLD A TALL EDIT (founder, 2026-09-15: "ADD opens a window but
 * individual changes open full screen — suggest the changes also be contained in a window").
 * The web's `.ap-modal` has always been capped at `min(82vh, 100%)` with its list scrolling
 * inside; the phone's copy had NO cap at all, because until now nothing tall was ever put in one.
 * A section wheel is 260px before its hint, Save and summary, so the cap and the inner scroller
 * are what make windowed edits possible rather than a window that runs off the screen.
 *   ⚠️ `min(82vh, 100%)` on the web is not a style flourish: on iOS Safari `vh` counts the area
 *   BEHIND the browser chrome, so a bare 82vh can overrun the visible viewport — and it overruns
 *   at the TOP, taking the ✕ with it. RN has no viewport units, so the phone caps against the
 *   window's measured height instead, which is the same intent said in the units RN has.
 *
 * ★ AND THE KEYBOARD MOVES IT, rather than squeezing it. A section name and the budget figure are
 * both typed, and a CENTRED modal is the worst case for a keyboard — it gets compressed from both
 * sides. `KeyboardAvoidingView` lifts the card instead, with `padding` on iOS and `height` on
 * Android, which is the pair those two platforms actually want.
 */
export function Sheet({ visible, onClose, kicker, title, sub, confirm, scroll = false, children }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const body = scroll
    ? (
      <ScrollView style={ws.ap_scrollbody} contentContainerStyle={ws.ap_scrollpad}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      )
    : children;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}
      statusBarTranslucent>
      {/* Tapping the ground closes, as the web's overlay onClick does; the card stops it. */}
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable style={ws.ap_overlay} onPress={onClose}>
        <Pressable style={[ws.ap_modal, confirm && ws.ap_confirm, scroll && ws.ap_modal_tall,
                           { backgroundColor: t.paper, borderColor: t.line }]}
          onPress={() => {}}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"
            style={[ws.ap_close, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
            <Text style={[ws.ap_close_glyph, { color: t.ink_soft }]}>✕</Text>
          </Pressable>
          <View style={ws.ap_head}>
            <Text style={ws.ap_kicker}>{kicker}</Text>
            <Text style={ws.ap_title}>{title}</Text>
            {sub ? <Text style={ws.ap_sub}>{sub}</Text> : null}
          </View>
          {body}
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const scope = (c) => `${pretty(c.subjectSlug)} · Class ${classNum(c.grade)} · ${c.sectionTag}`;
const chLabel = (p) => `${p.chapter_number ? `Ch. ${pad(p.chapter_number)}: ` : ""}${p.chapter_title}`;

/* One chapter row — "Ch. 05: Force and Pressure" as ONE sentence (founder, 2026-07-25), the
   number in pine before the colon, a light chevron as the tap affordance. */
function ChapterRow({ plan, onPress }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <Pressable onPress={onPress} style={ws.ap_row} accessibilityRole="button">
      <View style={ws.ch_meta}>
        <Text style={ws.ch_name} numberOfLines={2}>
          {plan.chapter_number ? <Text style={ws.ch_no}>{`Ch. ${pad(plan.chapter_number)}: `}</Text> : null}
          {plan.chapter_title}
        </Text>
        <Text style={ws.ch_go}>›</Text>
      </View>
      {plan.duration_label ? <Text style={ws.sc_durline}>{plan.duration_label}</Text> : null}
    </Pressable>
  );
}

export function AttachSheet({ target, plans, boundFile, alsoAttachable, onAttach, onClose }) {
  const ws = useWebStyles();
  const list = useMemo(() => {
    if (!target || !plans) return [];
    return Object.values(plans)
      .filter((p) => (p.prepared || (alsoAttachable && alsoAttachable.has(p.filename)))
        && p.filename !== boundFile && !p.archived)
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  }, [target, plans, boundFile, alsoAttachable]);

  if (!target) return null;
  return (
    <Sheet visible onClose={onClose} kicker={scope(target.c)}
      title="Track a chapter for this section"
      sub="Pick a chapter you've already prepared to track for this section.">
      {/* The web caps the list at two rows and wheels through the rest so the modal can never
          grow tall enough to push its own ✕ off the top. Same cap, as a bounded scroller. */}
      <ScrollView style={{ maxHeight: 160 }} contentContainerStyle={ws.ap_list}
        showsVerticalScrollIndicator={false}>
        {list.length === 0 ? (
          <Text style={ws.ap_none}>No other lessons prepared for this section yet.</Text>
        ) : list.map((p) => (
          <ChapterRow key={p.filename} plan={p} onPress={() => onAttach(target.c, target.sectionKey, p)} />
        ))}
      </ScrollView>
    </Sheet>
  );
}

export function UntrackSheet({ target, onUntrack, onClose }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  if (!target) return null;
  const { c, sectionKey, plan } = target;
  return (
    <Sheet visible confirm onClose={onClose} kicker={scope(c)}
      title="Stop tracking this chapter?"
      sub={`${c.sectionTag} will stop tracking “${chLabel(plan)}”. It will be available to track again for this section.`}>
      <View style={ws.ap_actions}>
        <Pressable onPress={onClose} accessibilityRole="button"
          style={[ws.ap_btn, { backgroundColor: t.paper_2, borderColor: t.line }]}>
          <Text style={[ws.ap_btn_label, { color: t.ink_soft }]}>Keep tracking</Text>
        </Pressable>
        <Pressable onPress={() => onUntrack(sectionKey, plan)} accessibilityRole="button"
          style={[ws.ap_btn, { backgroundColor: t.clay, borderColor: t.clay }]}>
          <Text style={[ws.ap_btn_label, { color: "#fff" }]}>Stop tracking</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

export const _unused = StyleSheet.create({});
