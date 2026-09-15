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
import PrepareCta from "./PrepareCta";
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
export function Sheet({ visible, onClose, onBack, kicker, title, sub, confirm, scroll = false, children }) {
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
      <View style={ws.ap_overlay}>
        {/* ★ THE GROUND IS A SIBLING BEHIND THE CARD, NEVER ITS PARENT (founder, 2026-09-15:
            "the 'How many periods a week' window of Add button does not allow wheeling up and
            down the numbers. The arrow of course works").
            It was a `Pressable` WRAPPING a `Pressable` card — the outer closing, the inner
            swallowing the tap so it did not. That reads correctly and puts a press responder
            directly above every scroller in the window, and on iOS a ScrollView inside a
            Pressable loses the drag: the press claims the touch on start and the wheel never
            sees the pan. The ARROWS kept working precisely because they are taps that commit
            the pick themselves — which is what said the data was fine and the GESTURE was not.
            ⚠️ It is not the ppw wheel's bug. Every wheel in the window had it — RollWheel and
            PickWheel are nested identically — and the numbers step is simply where a thumb
            tries to roll first. The class and section wheels had only ever been walked on Expo,
            where react-native-web hands the DOM scroller the drag regardless.
            So: the scrim is now an absolutely-positioned Pressable UNDER the card, and the card
            is a plain View. Tapping off still closes (the scrim is what is hit), tapping the
            card hits the card and nothing happens — the same two behaviours, with no responder
            left in the wheel's ancestry. The no-op `onPress={() => {}}` goes with it; a press
            handler that exists only to swallow a press is the smell that pointed here. */}
        {/* Hidden from assistive tech on purpose: the ✕ is the labelled way out, and a
            full-screen second "Close" control would be an enormous duplicate target. The web's
            overlay carries no label either — it is a convenience for a pointer, not a control. */}
        <Pressable style={ws.ap_ground} onPress={onClose} accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants" />
        <View style={[ws.ap_modal, confirm && ws.ap_confirm, scroll && ws.ap_modal_tall,
                      { backgroundColor: t.paper, borderColor: t.line }]}>
          {/* ⚠️ SKIPPED ENTIRELY when a window brings its own heading. `.ap-head` is the WINDOW's
              header — an ochre kicker over a 21px title — and it is right for a window whose
              title is the window (the portal, the confirms). The profile editor is not one of
              those: it carries the web's `.tp` header, a PINE kicker flush against a 27px
              `.fr-q`, and rendering the window's header above it gave two headers, two kickers in
              two different colours, and 14px of dead space between them. */}
          {kicker || title || sub ? (
            <View style={[ws.ap_head, onBack && { paddingLeft: 34 }]}>
              {kicker ? <Text style={ws.ap_kicker}>{kicker}</Text> : null}
              {title ? <Text style={ws.ap_title}>{title}</Text> : null}
              {sub ? <Text style={ws.ap_sub}>{sub}</Text> : null}
            </View>
          ) : null}
          {body}
          {/* ⚠️ THE CORNERS ARE RENDERED LAST, AND THAT IS NOT A STYLE CHOICE (founder,
              2026-09-15: "the 'x' on the class/section/weeks/annual periods is not working when
              trying to click off on expo/iphone").
              They are absolutely positioned, so they LOOK right wherever they sit in the tree —
              but paint and hit-testing follow sibling ORDER, and `body` is now a ScrollView that
              fills the card. Written before it, the buttons were painted under a transparent
              scroller: still visible, completely untappable. Nothing about the ✕ was wrong; it
              was the thing in front of it that was new.
              Order, not `zIndex`: zIndex needs `elevation` to mean anything on Android, and a
              sibling that comes last needs neither. */}
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"
            hitSlop={8} style={[ws.ap_close, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
            <Text style={[ws.ap_close_glyph, { color: t.ink_soft }]}>✕</Text>
          </Pressable>
          {/* Only where there is a previous STEP to go back to. The ✕ always closes; this never
              does — two corners, two different acts, neither costing a row of the card. */}
          {onBack ? (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back"
              hitSlop={8} style={[ws.ap_back, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
              <Text style={[ws.ap_back_glyph, { color: t.ink_soft }]}>←</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
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

export function AttachSheet({ target, plans, boundFile, alsoAttachable, onAttach, onClose,
                              onPrepareNew }) {
  const { t } = useTheme();
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
      {/* ★ "PREPARE A NEW ONE", LIVE AT LAST (founder, 2026-09-15: "My Class + allows generation
          from there in web app but not yet in expo/Iphone"). The web's `.mlp-allocate` footer,
          same two lines, same `prepare-cta`.
          ⚠️ THE REASON IT WAITED WAS THE RETURN, NOT THE DESTINATION — this file said so — and
          the return is what shipped with it. A footer that prepares and then drops her on My
          Lessons, with the section she started from forgotten, is worse than no footer: she came
          here to fill THAT slot. `onPrepareNew` carries the section across the route change
          (lib/preparing's `pendingAttach`), and My Classes reopens this very picker when she
          lands, now listing the chapter she just built. */}
      {onPrepareNew ? (
        <View style={[ws.mlp_allocate, { backgroundColor: t.paper, borderColor: t.line }]}>
          <Text style={ws.mlp_allocate_q}>Need a chapter you don&rsquo;t have yet?</Text>
          <PrepareCta size="allocate" label="Prepare a new lesson →"
            onPress={() => onPrepareNew(target)} />
        </View>
      ) : null}
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
