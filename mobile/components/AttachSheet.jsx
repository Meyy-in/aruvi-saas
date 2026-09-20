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
import { useEffect, useMemo } from "react";
import { View, Modal, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform }
  from "react-native";
import { Text } from "./Text";
import PrepareCta from "./PrepareCta";
import { pretty, classNum, pad } from "@aruvi/shared/format";
import { readHistory } from "@aruvi/shared/sectionHistory";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTourAnchor, useTour, tourNext, tourBack, tourSkip,
         setTourOverlayHost } from "../lib/tour";
import GuidedTour from "./GuidedTour";
import { readLocalSection } from "@aruvi/shared/sectionState";
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
export function Sheet({ visible, onClose, onBack, kicker, title, sub, confirm, scroll = false,
                        tour = null, children }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const tourRef = useTourAnchor(tour);   // only the attach picker passes a name (steps 9, 15)
  /* WALK-A-041 (founder, 2026-09-20, Android): a tall sheet rode over the app bar and the status
     bar. The Modal is statusBarTranslucent, so the overlay owes the safe area its own room. */
  const insets = useSafeAreaInsets();
  /* ★ THE SHEET DRAWS THE TOUR WHILE IT IS UP (founder, reported on three walks: at steps 9 and
     15 *"pressing next shows the erroneous window"*). A React Native `Modal` is presented in its
     OWN NATIVE WINDOW above the whole app, so the overlay in the shell could never appear over
     this card: she saw the previous step's ring, could not reach Next, and the only thing she
     COULD press was a lesson row — which attaches and closes the sheet while the step never
     moves. That is the "erroneous window" in the report.
     ⚠️ CLAIMED ONLY WHILE THIS SHEET IS THE TOUR'S OWN (`tour` is the anchor name, and only the
     attach picker passes one). Every other sheet — untrack, confirm, the growth window — leaves
     the shell to draw, because the tour never rings one of those.
     ⚠️ AND RELEASED ON UNMOUNT, so a sheet closed mid-tour hands the job straight back. */
  const tourNow = useTour();
  const ownsTour = !!tour && visible;
  useEffect(() => {
    if (!ownsTour) return undefined;
    setTourOverlayHost("sheet");
    return () => setTourOverlayHost(null);
  }, [ownsTour]);
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
      <View style={[ws.ap_overlay, { paddingTop: Math.max(20, (insets.top || 0) + 12),
                                     paddingBottom: Math.max(20, (insets.bottom || 0) + 12) }]}>
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
        <View ref={tourRef} collapsable={false}
          style={[ws.ap_modal, confirm && ws.ap_confirm, scroll && ws.ap_modal_tall,
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
      {/* LAST CHILD, inside the Modal — order, not zIndex, is what puts it over the card. */}
      {ownsTour && tourNow.step > 0 ? (
        <GuidedTour step={tourNow.step} info={tourNow.info}
          onNext={tourNext} onBack={tourBack} onSkip={tourSkip} />
      ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const scope = (c) => `${pretty(c.subjectSlug)} · Class ${classNum(c.grade)} · ${c.sectionTag}`;
const chLabel = (p) => `${p.chapter_number ? `Ch. ${pad(p.chapter_number)}: ` : ""}${p.chapter_title}`;

/* One chapter row — "Ch. 05: Force and Pressure" as ONE sentence (founder, 2026-07-25), the
   number in pine before the colon, a light chevron as the tap affordance. */
function ChapterRow({ plan, onPress, year, tourRow }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  /* Step 9's HAND points at a row inside the window, not at the window — only the first. */
  const rowRef = useTourAnchor(tourRow ? "attach-pop-row" : null);
  /* ★ WHICH EDITION THIS PLAN IS (app. 05 row B15). Two different years live in this system and
     conflating them is the bug the 2026-08-27 foldering fixed: the TEACHER's academic year, and
     the LIBRARY EDITION a plan IS. She only ever sees the stamp for a PRIOR edition — the server
     decides that by returning `lp_year_display` only when it differs, so the screen cannot
     disagree with the rule. Inside a prior-year folder the folder's own year IS the stamp, and
     the server flag is absent by construction, so the caller passes it. */
  const stamp = year || plan.lp_year_display || plan.prepared_source_year;
  return (
    <Pressable ref={rowRef} onPress={onPress} style={ws.ap_row} accessibilityRole="button">
      <View style={ws.ch_meta}>
        <Text style={ws.ch_name} numberOfLines={2}>
          {plan.chapter_number ? <Text style={ws.ch_no}>{`Ch. ${pad(plan.chapter_number)}: `}</Text> : null}
          {plan.chapter_title}
        </Text>
        <Text style={ws.ch_go}>›</Text>
      </View>
      {plan.duration_label ? <Text style={ws.sc_durline}>{plan.duration_label}</Text> : null}
      {stamp ? <Text style={[ws.sc_yearstamp, { color: t.ochre }]}>{stamp} version</Text> : null}
    </Pressable>
  );
}

export function AttachSheet({ target, plans, boundFile, alsoAttachable, onAttach, onClose,
                              onPrepareNew, priorYears, openPrior, onOpenPrior, priorPlans,
                              onAttachPrior }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const list = useMemo(() => {
    if (!target) return [];
    if (!plans) return null;          // not asked yet — a different fact from "none"
    return Object.values(plans)
      .filter((p) => (p.prepared || (alsoAttachable && alsoAttachable.has(p.filename)))
        && p.filename !== boundFile && !p.archived)
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  }, [target, plans, boundFile, alsoAttachable]);

  if (!target) return null;
  return (
    <Sheet visible onClose={onClose} kicker={scope(target.c)} tour="attach-pop"
      title="Track a chapter for this section"
      sub={"Pick a chapter you’ve already prepared to track for this section, or build a new one."}>
      {/* The web caps the list at two rows and wheels through the rest so the modal can never
          grow tall enough to push its own ✕ off the top. Same cap, as a bounded scroller. */}
      <ScrollView style={{ maxHeight: 160 }} contentContainerStyle={ws.ap_list}
        showsVerticalScrollIndicator={false}>
        {/* ★ THREE STATES, NOT TWO (app. 05 row B14). `null` is "this device has never asked",
            and it used to be flattened into `{}` by the caller — so the picker told a teacher
            with a full shelf that she had nothing prepared, then filled in a beat later. The
            web draws `.ap-loading` here for the same reason. */}
        {list === null ? (
          <Text style={ws.ap_loading}>Loading lessons…</Text>
        ) : list.length === 0 ? (
          <Text style={ws.ap_none}>No other lessons prepared for this section yet.</Text>
        ) : list.map((p, i) => (
          <ChapterRow key={p.filename} plan={p} tourRow={i === 0}
            onPress={() => onAttach(target.c, target.sectionKey, p)} />
        ))}
      </ScrollView>
      {/* ★ "PREPARE A NEW ONE", LIVE AT LAST (founder, 2026-09-15: "My Class + allows generation
          from there in web app but not yet in expo/Iphone"). The web's `.mlp-allocate` footer,
          same two lines, same `prepare-cta`.
          ⚠️ THE REASON IT WAITED WAS THE RETURN, NOT THE DESTINATION — this file said so — and
          the return is what shipped with it. A footer that prepares and then drops her on My
          Lessons, with the section she started from forgotten, is worse than no footer: she came
          here to fill THAT slot. `onPrepareNew` carries the SECTION into /prepare; the wait is
          then drawn on that section's own card in My Classes, and the finished plan settles onto
          it already attached (founder, 2026-09-15). She never picks from this list again for the
          chapter she just asked to be built. */}
      {/* ★ LAST YEAR'S LESSONS, RIGHT HERE IN THE PICKER (founder, 2026-08-26; app. 05 rows B16,
          A17). She taught Ch 5 last June and wants it again this June — asking her to regenerate
          a plan she already owns would be absurd. It sits BELOW this year's list and ABOVE
          "prepare a new one", and it is COLLAPSED, so it never competes with current work.
          ⚠️ Attaching one MAKES IT THIS YEAR'S WORK — that is what `onAttachPrior` is for, and
          why it is not the same handler as the list above. */}
      {(priorYears || []).map((yid) => {
        const rows = priorPlans && priorPlans[yid];
        return (
          <View key={yid} style={[ws.ap_prior, { borderTopColor: t.line }]}>
            <Pressable onPress={() => onOpenPrior(openPrior === yid ? null : yid)}
              accessibilityRole="button" accessibilityState={{ expanded: openPrior === yid }}
              style={ws.ap_prior_head}>
              <Text style={[ws.ap_prior_caret, { color: t.ink_soft }]}>
                {openPrior === yid ? "▾" : "▸"}
              </Text>
              <Text style={[ws.ap_prior_yr, { color: t.ink }]}>{yid}</Text>
              <Text style={[ws.ap_prior_note, { color: t.ink_soft }]}>
                lessons you prepared last year
              </Text>
            </Pressable>
            {openPrior === yid ? (
              rows === undefined ? (
                <Text style={ws.ap_loading}>Loading lessons…</Text>
              ) : rows.length === 0 ? (
                <Text style={ws.ap_none}>Nothing prepared for this class in {yid}.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 160 }} contentContainerStyle={ws.ap_list}
                  showsVerticalScrollIndicator={false}>
                  {rows.map((p) => (
                    <ChapterRow key={p.filename} plan={p} year={yid}
                      onPress={() => onAttachPrior(target.c, target.sectionKey, p, yid)} />
                  ))}
                </ScrollView>
              )
            ) : null}
          </View>
        );
      })}

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

/* ───────── Section history — "where each chapter stands for this section" (app. 05 row B19) ─────────
 *
 * ★ THE LEDGER IS THE ONLY RECORD THAT A CHAPTER WAS EVER TAUGHT. `SectionState` holds the
 * CURRENT binding and deletes the row the moment a chapter leaves the slot, so without this
 * popup a finished term is invisible — which is why the ledger became server-backed on
 * 2026-09-07 and why untracking deliberately cannot reach it.
 *
 * ⚠️ THE CURRENT CHAPTER IS SYNTHESISED, NOT STORED, and it has to be: `recordHistory` fires only
 * when a chapter is FINISHED or UNTRACKED, so the chapter she is teaching right now has no row
 * yet — and that is the one line she is most likely opening this for. The web does the same
 * (MyPlans.jsx:743-758): build a row from the live pointer, mark it ongoing or completed, and
 * stamp `ts = now + 1` so it sorts above every stored row.
 * ⚠️ The `done || >= 1 unit` gate is the untrack path's own anti-noise rule — a chapter attached
 * and not yet started is not history, it is the card.
 * ⚠️ `normStatus` maps the legacy `set_aside` to `untracked`; rows written before that rename are
 * still on teachers' devices AND on the server, so it cannot be dropped.
 */
const HISTORY_LABEL = { ongoing: "Ongoing", completed: "Completed", untracked: "Untracked" };
const normStatus = (s) => (s === "set_aside" ? "untracked" : s);

export function HistorySheet({ target, plans, onClose }) {
  const { t } = useTheme();
  const ws = useWebStyles();

  const rows = useMemo(() => {
    if (!target) return [];
    const { sectionKey } = target;
    const byFile = {};
    readHistory(sectionKey).forEach((h) => { byFile[h.file] = { ...h }; });

    const sec = readLocalSection(sectionKey);
    const curFile = sec.chapter;
    if (curFile) {
      const done = !!sec.done;
      const unitsDone = sec.unit ? Number(sec.unit) : 0;
      if (done || unitsDone >= 1) {
        const cp = plans ? plans[curFile] : null;
        const prev = byFile[curFile];
        const total = cp ? (cp.total_units || null) : (prev ? prev.total_units : null);
        byFile[curFile] = {
          file: curFile,
          chapter_number: cp ? cp.chapter_number : (prev ? prev.chapter_number : null),
          chapter_title: cp ? cp.chapter_title : (prev ? prev.chapter_title : ""),
          status: done ? "completed" : "ongoing",
          units_done: done ? total : unitsDone,
          total_units: total,
          ts: Date.now() + 1,   // the live chapter sorts to the top
        };
      }
    }
    return Object.values(byFile).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [target, plans]);

  if (!target) return null;

  /* The pill palette is the section cards' own, carried verbatim, plus the slate "untracked"
     code that has no card equivalent (a chapter set aside before it was finished). */
  const pillInk = { ongoing: t.pine_d, completed: "#a04a25", untracked: "#566169" };
  const pillBg = { ongoing: "#e3efe9", completed: t.tint_clay, untracked: "#e7ebee" };

  return (
    <Sheet visible onClose={onClose} kicker={scope(target.c)}
      title="Section history"
      sub="Where each chapter stands for this section.">
      <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={ws.ap_list}
        showsVerticalScrollIndicator={false}>
        {rows.length === 0 ? (
          <Text style={ws.ap_none}>No chapters taught yet.</Text>
        ) : rows.map((r, i) => {
          const st = normStatus(r.status) || "untracked";
          const doneUnits = r.units_done || 0;
          return (
            <View key={r.file}
              style={[ws.ch_row, i > 0 ? { borderTopWidth: 1, borderTopColor: t.line_soft } : null]}>
              <View style={ws.ch_meta}>
                {/* One sentence — "Ch. 05: Force and Pressure" — the picker's own phrasing, with
                    the status pinned to the right end of that line. */}
                <Text style={ws.ch_name} numberOfLines={2}>
                  <Text style={ws.ch_no}>Ch. {r.chapter_number ? pad(r.chapter_number) : "\u2014"}:</Text>
                  {" "}{r.chapter_title}
                </Text>
                <Text style={[ws.ch_pill, { backgroundColor: pillBg[st], color: pillInk[st] }]}>
                  {HISTORY_LABEL[st] || "Untracked"}
                </Text>
              </View>
              {r.total_units ? (
                <View style={ws.ch_rail}
                  accessibilityLabel={`${doneUnits} of ${r.total_units} units completed`}>
                  {Array.from({ length: r.total_units }).map((_, u) => (
                    <View key={u} style={[ws.sc_tick, {
                      backgroundColor: u < doneUnits ? t.pine
                        : (st === "ongoing" && u === doneUnits) ? t.ochre : t.card_tick,
                    }]} />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
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
