/* ───────── PickWheel — the tick-list wheel (Track D step 5d F8) ─────────
 *
 * A port of `PickWheel` in web/app/components/wheels.jsx. Every profile question that takes MORE
 * THAN ONE answer comes through here: which sections, which classes, which subjects, which period
 * lengths. It is the sibling of `RollWheel` and the difference between them is the whole design:
 * on a RollWheel the RESTING ROW is the answer, so there is exactly one; here ticking is
 * INDEPENDENT of scroll position, so any visible row can be tapped and as many stay picked as she
 * likes.
 *
 * ★ THE CLUSTERING RULE IS SHARED, NOT REIMPLEMENTED (`@aruvi/shared/pick`). Which rows show, in
 * what order, and where the wheel rests is the whole behaviour of this control, so the phone runs
 * the web's own function. Only the markup below is a port; the rule is the same code.
 *
 * ★ EVERY TOGGLE RE-RESTS THE WHEEL on the cluster's first row, so "the lowest pick is the top
 * row" holds as an invariant rather than only at the moment of choosing. Without it the reorder
 * is invisible from a scrolled position — she taps 90 min low down, it moves into the cluster off
 * screen, and all she sees is the row vanish from under her finger (founder, 2026-07-26).
 *
 * ★ TWO-COLUMN MODE. The duration question carries its own periods-a-week split as a trailing
 * column, so there is no separate periods-per-duration screen, and the section question uses the
 * same column for her own name for a section — one two-column format, not two. `trailingHeader`
 * labels it, and `leadingHeader` names the LEFT column, which a single-column wheel never needed.
 * `summaryFor` overrides `labelFor` in the "Chosen (n)" line so it can carry the split
 * ("40 min × 3, 45 min × 4") rather than just naming the lengths.
 *
 * ⚠️ DIVERGENCES, named as CLAUDE.md §4 requires — all three are the DOM standing in for
 * something RN has no equivalent of:
 *   · CSS `scroll-snap-type` has no counterpart, so the snap is `snapToInterval={PW_ROW}` with
 *     `decelerationRate="fast"`. The web's own note here is that the row wrapper must be the
 *     ONLY snap target — nesting a second one made the scroller fight itself and the arrows land
 *     and get pulled back. `snapToInterval` is one interval per scroller, so that class of bug
 *     cannot arise on this surface at all.
 *   · `scrollTo({behavior:"smooth"})` and the reduced-motion check become `scrollTo({animated})`
 *     off `AccessibilityInfo.isReduceMotionEnabled`, read once on mount.
 *   · The web guarantees its ▲▼ step with a fallback that snaps `scrollTop` when a throttled
 *     smooth-scroll silently no-ops (B1, 2026-07-06). RN's `scrollTo` does not no-op, so the
 *     guarantee is the call itself — but the POSITION is still tracked from `onScroll` rather
 *     than assumed, because a drag moves it without telling the arrows.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ScrollView, AccessibilityInfo } from "react-native";
import { Text } from "./Text";
import { clusterOrder } from "@aruvi/shared/pick";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* ⚠️ THE TICKED STATE IS IN THE LABEL AS WELL AS IN `accessibilityState`, and it has to be
 * (2026-09-15). `accessibilityState={{ checked }}` on a Pressable produces NO `aria-checked` at
 * all on this react-native-web version — inspected on the running page, the row carries only
 * aria-label, role, tabindex, class and style. So on the web target a screen reader announced
 * "Class 3" whether or not it was ticked, which for a multi-select wheel is the one thing it
 * needs to say. iOS maps the state properly, so this is belt to that braces rather than a
 * replacement: `accessibilityState` stays for the platform that honours it.
 * The web app words it as a listbox (`role="option"` + `aria-selected`) and appends "(selected)"
 * in its own two-column branch; RN has no listbox role worth the name, so the checkbox role plus
 * a stated label is the faithful reading of the same intent. */
const a11yLabel = (label, on) => `${label}${on ? " (selected)" : ""}`;

export default function PickWheel({
  options, selected, onToggle, labelFor, initialScrollTo, ariaLabel, children,
  summaryLabel = true, trailing, trailingHeader, leadingHeader, summaryFor, cluster = true,
}) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const ref = useRef(null);
  const row = ws.PW_ROW;
  const hasTrail = !!(trailing && trailingHeader);

  /* Where the scroller actually is, in rows. Tracked from onScroll because a DRAG moves it
     without going through the arrows — assuming the last programmatic target would make the
     next arrow tap jump back to wherever the arrows last left it. */
  const at = useRef(0);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setReduce(!!v); }).catch(() => {});
    return () => { live = false; };
  }, []);

  /* ⚠️ Bounds and the ▲▼ cue key off the VISIBLE list, not `options`: clustering drops the
     unchosen rows between her lowest and highest pick, so the wheel can be materially shorter
     than the option list. Reading options.length here let the arrows scroll into empty space past
     the end, and kept the arrows on show for a list that no longer needed them. */
  const { ordered } = useMemo(
    () => (cluster ? clusterOrder(options, selected) : { ordered: options || [], start: 0 }),
    [options, selected, cluster]);

  const scrollToRow = useCallback((r) => {
    const el = ref.current;
    if (!el) return;
    const max = Math.max(0, ordered.length - 1);
    const want = Math.min(max, Math.max(0, r));
    at.current = want;
    el.scrollTo({ y: want * row, animated: !reduce });
  }, [ordered.length, reduce, row]);

  const step = (dir) => scrollToRow(at.current + dir);

  const pick = (o, wasOn) => {
    onToggle(o);
    if (!cluster) return;
    // Rest on the NEXT selection's cluster, not the current one — onToggle's state lands later.
    const next = wasOn ? (selected || []).filter((x) => x !== o) : (selected || []).concat([o]);
    scrollToRow(clusterOrder(options, next).start);
  };

  /* Open resting on her cluster; a seeded suggestion is only consulted when she has chosen
     NOTHING yet — an existing selection wins. Once, on mount. */
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !ref.current || initialScrollTo == null) return;
    opened.current = true;
    const { start } = cluster ? clusterOrder(options, selected) : { start: 0 };
    const idx = (selected || []).length ? start : ordered.indexOf(initialScrollTo);
    if (idx >= 0) { at.current = idx; ref.current.scrollTo({ y: idx * row, animated: false }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In option order, independent of scroll position, so a stray tick from an earlier batch stays
  // visible even after it has scrolled away.
  const chosen = (options || []).filter((o) => (selected || []).includes(o));
  const summary = chosen
    .map((o) => (summaryFor ? summaryFor(o) : labelFor ? labelFor(o) : String(o))).join(", ");
  const showCue = ordered.length > 4;

  const Check = ({ on }) => (
    <View style={[ws.pw_check, on
      ? { backgroundColor: t.pine, borderColor: t.pine }
      : { borderColor: t.line }]}>
      {on ? <Text style={[ws.pw_check_t, { color: "#fdfaf4" }]}>✓</Text> : null}
    </View>
  );

  return (
    <View style={ws.pw_wrap}>
      <View style={ws.pw_col}>
        {hasTrail ? (
          <View style={ws.pw_colhead} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={[ws.pw_colhead_t, ws.pw_colhead_lead, { color: t.ink_soft }]}>{leadingHeader}</Text>
            <View style={[ws.pw_colhead_tail, { borderLeftWidth: 1, borderLeftColor: t.line }]}>
              <Text style={[ws.pw_colhead_t, { color: t.ink_soft }]}>{trailingHeader}</Text>
            </View>
          </View>
        ) : null}

        <ScrollView ref={ref}
          style={[ws.pw_wheel, hasTrail && ws.pw_wheel_trail,
            { borderColor: t.line_soft, backgroundColor: t.paper_2 }]}
          snapToInterval={row} decelerationRate="fast" scrollEventThrottle={16}
          onScroll={(e) => { at.current = Math.round(e.nativeEvent.contentOffset.y / row); }}
          /* So a tap on a row still toggles while the section-name keyboard is up, rather than
             being eaten as a dismiss. */
          keyboardShouldPersistTaps="handled"
          accessibilityRole="list" accessibilityLabel={ariaLabel}>
          {ordered.map((o, i) => {
            const on = (selected || []).includes(o);
            const last = i === ordered.length - 1;
            const label = labelFor ? labelFor(o) : String(o);
            const tint = on ? { backgroundColor: t.tint_pine_2 } : null;
            const hair = { borderBottomColor: last ? "transparent" : t.line_soft };

            if (!trailing) {
              return (
                <Pressable key={String(o)} onPress={() => pick(o, on)}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  accessibilityLabel={a11yLabel(label, on)}
                  style={[ws.pw_opt, tint, hair]}>
                  <Check on={on} />
                  <Text style={[ws.pw_label, { color: t.ink }]} numberOfLines={1}>{label}</Text>
                </Pressable>
              );
            }
            /* With a trailing cell the row is a WRAPPER, not a button — the cell holds its own
               control, and a control cannot sit inside a pressable that would swallow its taps. */
            return (
              <View key={String(o)} style={[ws.pw_optrow, tint, hair]}>
                <Pressable onPress={() => pick(o, on)} style={[ws.pw_opt, ws.pw_opt_grow]}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  accessibilityLabel={a11yLabel(label, on)}>
                  <Check on={on} />
                  <Text style={[ws.pw_label, { color: t.ink }]} numberOfLines={1}>{label}</Text>
                </Pressable>
                <View style={[ws.pw_trail, hasTrail && ws.pw_trail_rule,
                  hasTrail && { borderLeftColor: t.line }]}>
                  {trailing(o, on)}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {children}

        {summaryLabel ? (
          <Text style={[ws.pw_summary, { color: t.ink_soft }]} accessibilityLiveRegion="polite">
            {chosen.length ? (
              <>Chosen ({chosen.length}): <Text style={[ws.pw_summary_b, { color: t.pine_d }]}>{summary}</Text></>
            ) : (
              <Text style={ws.pw_summary_empty}>Nothing chosen yet — tap the rows above</Text>
            )}
          </Text>
        ) : null}
      </View>

      {showCue ? (
        <View style={[ws.pw_arrows, hasTrail && ws.pw_arrows_trail]}>
          <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Scroll up"
            style={ws.pw_arrow_btn} hitSlop={4}>
            <Text style={[ws.pw_arrow_t, { color: t.pine }]}>▲</Text>
          </Pressable>
          <Pressable onPress={() => step(1)} accessibilityRole="button" accessibilityLabel="Scroll down"
            style={ws.pw_arrow_btn} hitSlop={4}>
            <Text style={[ws.pw_arrow_t, { color: t.pine }]}>▼</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
