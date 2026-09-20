/* ───────── the PROPOSED lesson card (Track D step 5b) ─────────
 *
 * A port of `ProposedCard` in MyLessonPlans.jsx. The lesson she is waiting for, drawn as a real
 * card in the ordinary structure — number tag · title · duration line — at full strength, sitting
 * exactly where the finished plan will sit. The only difference is the last line: a determinate
 * progress bar instead of "Ready to teach".
 *
 * ★ FULL STRENGTH, NOT A PALE STAND-IN (founder, 2026-08-06). The first web version drew a faded
 * card with a "· · · · ·" line, and "a faded card reads as 'something is missing' when in fact
 * every fact on it is already known and final." Everything here came from what she just told the
 * prepare screen; nothing is fetched to draw it and nothing is invented. The one "not yet" signal
 * is STRUCTURE, never colour: a dashed edge and a clay spine.
 *
 * ★ IT IS DELIBERATELY NOT TAPPABLE — there is nothing to open yet — and it carries
 * `accessibilityLiveRegion` so a screen reader announces the wait rather than reading a dead card.
 *
 * ★ FAILED IS THE SAME CARD, AT REST (ARV-D-087, 2026-08-10). It is not pulled, because she is
 * looking at it, and a card that vanishes silently reads as a mis-tap. The bar stops, the message
 * takes the line the bar had, and Dismiss sits where the bar ended — ONE ROW, so the failed card
 * is the same HEIGHT as every other card in the list. A taller card reads as a different KIND of
 * thing and pulls the eye down the list; this is the same card, settled. The note clamps to two
 * lines so an unusually long 4xx sentence cannot grow it either.
 *
 * ⚠️ ONE DIVERGENCE, named as CLAUDE.md §4 requires: the web's bar is a CSS keyframe
 * (`sc-prep-fill`, 0 → 96% over `--prep-ms` on a cubic-bezier). RN has no keyframes, so it is an
 * `Animated.timing` with the same duration, the same easing curve and the same 96% end point —
 * it eases toward full and stops just short, because the card is replaced by the real one at that
 * moment and a bar that visibly completes and then lingers reads as stuck.
 *
 * Measures live in theme/web.js under `sc_prep*` (§4 rule 2).
 */
import { useEffect, useRef } from "react";
import { View, Animated, Easing, Pressable } from "react-native";
import { Text } from "./Text";
import { pad } from "@aruvi/shared/format";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export const PREPARING_MS = 5000;   // keep in step with the hold in app/(app)/prepare.jsx

/* The duration line, in the SERVER's exact phrasing (api/data.py duration_label): rows joined by
 * " · ". Extracted on the web in ARV-D-066 because the proposed card had drifted to " + " while
 * the finished card used " · ", so a MIXED matrix read
 *     proposed  60 min × 4 + 45 min × 6
 *     finished  60 min × 4 · 45 min × 6
 * — the wording changing under her. Single-row matrices were identical, so it stayed invisible
 * until a 60+45 week. One function, and it doubles as the dedupe key in My Lessons. */
export function matrixLabel(rows) {
  return (rows || [])
    .filter((r) => Number(r.count) > 0)
    .map((r) => `${Number(r.duration)} min × ${Number(r.count)}`)
    .join(" · ");
}

export default function ProposedCard({ preparing, onDismiss, onRetry, bare = false }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const grow = useRef(new Animated.Value(0)).current;
  const failed = !!preparing.failed;

  useEffect(() => {
    if (failed) return;                 // the bar STOPS — that is what "at rest" means
    grow.setValue(0);
    Animated.timing(grow, {
      toValue: 1,
      duration: PREPARING_MS,
      easing: Easing.bezier(0.25, 0.8, 0.3, 1),
      useNativeDriver: false,           // width is not native-drivable
    }).start();
  }, [failed, grow]);

  const rows = (preparing.rows || []).filter((r) => r.count > 0);
  const total = rows.reduce((a, r) => a + (Number(r.count) || 0), 0);
  const label = matrixLabel(rows);
  const msg = preparing.message || "Couldn’t build the lesson plan right now. Try again in a moment.";

  /* The progress line, or the failure. `bare` renders just this — My Lessons uses it to mark an
     EXISTING card busy in place, rather than drawing a second card above it. */
  const body = failed ? (
    /* WALK-A-019 (founder, 2026-09-20): the sentence shows IN FULL (the two-line clamp cut the one
       line that says what happened), and "Try again" sits beside Dismiss — she has already chosen
       the chapter, the duration and the periods. */
    <View style={[ws.sc_prep, ws.sc_prep_failed, { flexWrap: "wrap" }]}>
      <Text style={[ws.sc_prep_note, ws.sc_prep_note_failed, { flexShrink: 1 }]}>{msg}</Text>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {onRetry ? (
          <Pressable onPress={() => onRetry(preparing)} accessibilityRole="button" hitSlop={8}
            accessibilityLabel="Try preparing this lesson again"
            style={[ws.sc_prep_dismiss, { borderBottomColor: t.edge_clay }]}>
            <Text style={ws.sc_prep_dismiss_t}>Try again</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onDismiss} accessibilityRole="button" hitSlop={8}
          accessibilityLabel="Dismiss this failed lesson"
          style={[ws.sc_prep_dismiss, { borderBottomColor: t.edge_clay }]}>
          <Text style={ws.sc_prep_dismiss_t}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  ) : (
    /* ⚠️ At phone width the web stacks this: the NOTE leads and the bar sits under it at full
       width, rather than being squeezed to a stub beside it (globals.css ≤600px). That is the
       phone's shape, so it is the only one here. */
    <View style={ws.sc_prep}>
      <Text style={ws.sc_prep_note}>
        Preparing your {total} {total === 1 ? "period" : "periods"} lesson plan…
      </Text>
      <View style={[ws.sc_prep_bar, { backgroundColor: t.line_soft }]}>
        <Animated.View style={[ws.sc_prep_fill, {
          backgroundColor: t.clay,
          width: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", "96%"] }),
        }]} />
      </View>
    </View>
  );

  if (bare) return body;

  return (
    /* WALK-A-019: a FAILED card borrows no lifecycle colour — the clay spine read as "attached".
       Neutral edge and spine; the words carry the state. */
    <View style={[ws.sc_card, ws.mlp2_cardpad, ws.sc_proposed,
      { backgroundColor: t.paper_2, borderColor: failed ? t.edge : t.edge_clay },
      failed && { borderStyle: "solid" }]}
      accessibilityLiveRegion="polite">
      <View style={[ws.sc_spine, { backgroundColor: failed ? t.edge : t.clay }]} />
      <Text style={ws.sc_tag}>{pad(preparing.chapterNo)}</Text>
      <View style={ws.sc_body}>
        <Text style={ws.sc_title} numberOfLines={2}>{preparing.chapterTitle}</Text>
        {label ? (
          <View style={ws.sc_metarow}>
            <Text style={[ws.sc_durline, ws.sc_metarow_item]}>{label}</Text>
          </View>
        ) : null}
        {body}
      </View>
    </View>
  );
}
