/* ───────── RollWheel (peek) — the one-row picker, ported for Expo (Track D step 4b) ─────────
 *
 * The web's `RollWheel ... peek` from `web/app/components/wheels.jsx`, which is what My Lessons
 * uses for its Subject and Class axes: a single compact white box the footprint of ONE option
 * row, showing only the item in use. Rolling it cycles the list through the box and whatever
 * settles in the box IS the pick — no separate confirm tap (founder ask, 2026-07-21).
 *
 * What the web does with scroll-snap, this does with `snapToInterval` + `decelerationRate="fast"`
 * on a ScrollView, which is the same contract: the box can only come to rest on a row boundary.
 * Three pieces carried over verbatim in effect:
 *   · CONTINUOUS WHEELING — with more than one item the list is rendered THREE times and the box
 *     rides the middle copy, silently recentring after each settle, so rolling wraps for ever.
 *     The recentred row shows the identical item, so the hop is invisible.
 *   · THE SINGLE ▼ CUE — a real step button, not decoration: it advances one item and wraps from
 *     the last back to the first. The pick is committed on tap BEFORE the box is moved, so a
 *     throttled animation can never leave the arrow a no-op (the web's B1 fix, same reasoning).
 *   · AUTO-FIT — the web measures the longest label and shrinks the font just enough that it
 *     shows in full. RN has `adjustsFontSizeToFit`, which does the same job per-row against the
 *     real box width, so the longest subject ("Mathematics", "Social Sciences") is never clipped.
 *
 * ⚠️ ONE DELIBERATE DIVERGENCE, named as CLAUDE.md §4 requires: the web's ▲▼ pair is a single ▼
 * here, which is what `peek` already is on the web (`.fr-wheel-cue.single`) — but the web ALSO
 * keeps arrow-key stepping for a keyboard, and there is no keyboard to serve on a phone. Nothing
 * visible differs; the keyboard handler simply has no counterpart.
 *
 * Measures live in theme/web.js under `rw_*` (§4 rule 2). rowPx is the caller's — My Lessons
 * passes 72 — and it MUST equal the snap interval or the box settles between rows.
 */
import { useEffect, useRef } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "./Text";
import { useWebStyles } from "../theme/web";

export const WHEEL_ROW = 64;   // the web's WHEEL_ROW; My Lessons overrides it with 72

export function RollWheel({ items, value, onChange, ariaLabel, rowPx = WHEEL_ROW,
                            align = "left", padLeft = 16 }) {
  const ref = useRef(null);
  const settle = useRef(null);
  const N = items.length;
  const loop = N > 1;
  // The real index of the current value. A value that is not in the list at all is corrected by
  // the effect below, which tells the PARENT — it is never silently displayed as item 0.
  const selIdx = Math.max(0, items.findIndex((it) => String(it.id) === String(value)));
  const rendered = loop
    ? Array.from({ length: 3 * N }, (_, i) => ({ ...items[i % N], _k: i }))
    : items.map((it, i) => ({ ...it, _k: i }));

  /* If the value is not in the list at all, TELL THE PARENT rather than quietly showing item 0.
     The web does this and it matters here: `subjectItems` is sorted alphabetically while the
     screen's fallback subject is `subjects[0]` in profile order, so a silent correction would put
     one subject in the box while the list below belonged to another. On `items` only — this is
     about the list changing under the wheel, never about her turning it. */
  useEffect(() => {
    if (!items.length) return;
    if (!items.some((it) => String(it.id) === String(value))) onChange(String(items[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  /* Park the box on the current pick when the wheel mounts or THE LIST CHANGES — on `items`, and
     deliberately not on the value.
     ⚠️ It ran on the value first, which quietly broke the ▼: `stepCycle` commits the pick and
     THEN animates, so the commit re-rendered, this effect fired within the frame, and its
     `animated: false` landed on the same target and cancelled the roll. The arrow snapped on the
     phone where it rolls on the web — and the animation was the whole reason the commit comes
     first. It also hid a second fault: on Android a programmatic animated scroll does not
     reliably fire `onMomentumScrollEnd`, so the recentring below would never have run; it only
     appeared to work because this effect was reparking into the middle copy every time.
     The middle copy is where it parks when looping, so there is a full copy to roll into in
     either direction from the very first touch. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, items.findIndex((it) => String(it.id) === String(value)));
    const y = (loop ? N + idx : idx) * rowPx;
    // Defer a frame: on first mount the ScrollView has no content height yet and the offset is
    // silently dropped.
    const id = setTimeout(() => { try { el.scrollTo({ y, animated: false }); } catch {} }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, rowPx]);

  // The settle timer must not outlive the wheel — it calls onChange, and the parent may be gone.
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

  /* Whatever settles in the box becomes the pick. `onMomentumScrollEnd` fires after a flick;
     `onScrollEndDrag` covers the slow drag that never gains momentum — RN sends only one of the
     two, so both are wired and the 120ms settle timer (the web's) coalesces them. */
  const onSettle = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el || !N) return;
      const raw = Math.round(y / rowPx);
      if (loop) {
        const real = ((raw % N) + N) % N;
        if (items[real]) onChange(String(items[real].id));
        // Drifted out of the middle copy — hop back into it. The recentred row shows the
        // identical item, so this is invisible and there is always more list to roll into.
        if (raw < N || raw >= 2 * N) {
          try { el.scrollTo({ y: (N + real) * rowPx, animated: false }); } catch {}
        }
      } else {
        const idx = Math.min(N - 1, Math.max(0, raw));
        if (items[idx]) onChange(String(items[idx].id));
      }
    }, 120);
  };

  /* The ▼: advance one item and WRAP from the last back to the first. Indexed off the CURRENT
     VALUE, never the live scroll offset (which may be mid-animation), and the pick is committed
     first so the tap always changes the selection even if the scroll is throttled. Always DOWN,
     so the wrap reads as a continuation rather than a jump back up. */
  const stepCycle = () => {
    if (!N) return;
    const next = (selIdx + 1) % N;
    onChange(String(items[next].id));
    const el = ref.current;
    if (!el) return;
    try {
      el.scrollTo({ y: (loop ? N + selIdx + 1 : next) * rowPx, animated: true });
    } catch {}
  };

  const ws = useWebStyles();
  return (
    <View style={ws.rw_shell} accessibilityLabel={ariaLabel}>
      <ScrollView ref={ref} showsVerticalScrollIndicator={false}
        snapToInterval={rowPx} decelerationRate="fast" disableIntervalMomentum
        onMomentumScrollEnd={onSettle} onScrollEndDrag={onSettle}
        contentContainerStyle={{ paddingRight: 0 }}>
        {rendered.map((it) => (
          <View key={it._k} style={[ws.rw_row,
            { justifyContent: align === "left" ? "flex-start" : "center", paddingLeft: padLeft }]}>
            <Text style={ws.rw_label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {it.label}
            </Text>
          </View>
        ))}
      </ScrollView>
      {/* The cue sits OUTSIDE the scroller so it never scrolls away — the web pins it with
          `position: absolute` on the shell for the same reason. It does not bob: the web's
          `fr-cue-bob` animation is a "this box moves" hint for a mouse user who has never met a
          wheel, and a thumb on a phone finds that out by touching it. */}
      {N > 1 ? (
        <View style={ws.rw_cue} pointerEvents="box-none">
          <Pressable onPress={stepCycle} style={ws.rw_cue_btn} hitSlop={8}
            accessibilityRole="button" accessibilityLabel={`Next ${ariaLabel || "item"}`}>
            <Text style={ws.rw_cue_glyph}>▼</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default RollWheel;
