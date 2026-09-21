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
 * ★ TWO MODES, as the web has (step 5, 2026-09-14). `peek` is the compact white one-row box My
 * Lessons uses for Subject and Class — continuous, one cycling ▼. WITHOUT it this is the BASE
 * wheel the first-run and Prepare steps use: the tint-pine box, a ▲▼ pair that steps one row
 * each, no wrapping (the list has ends, and on a 40-chapter list a wrap is disorienting rather
 * than convenient), and an optional `chip` — the chapter number, in its own square, inked pine
 * when that row is the pick.
 *
 * ⚠️ ONE DELIBERATE DIVERGENCE, named as CLAUDE.md §4 requires: the web also steps on arrow keys.
 * There is no keyboard to serve on a phone, so that handler has no counterpart. Nothing visible
 * differs.
 *
 * Measures live in theme/web.js under `rw_*` (§4 rule 2). rowPx is the caller's — My Lessons
 * passes 72 — and it MUST equal the snap interval or the box settles between rows.
 */
import { useEffect, useRef } from "react";
import { View, ScrollView, Pressable, Platform } from "react-native";
import { Text } from "./Text";
import { useWebStyles } from "../theme/web";

/* WALK-A-006 (2026-09-20) — the web's `wheelChapterTitle`, same rule, same wheel: the row's chip
 * already shows the number, so a title that begins "Chapter 4: …" said it twice. */
export const wheelChapterTitle = (t) =>
  String(t || "").replace(/^\s*chapter\s+\d+\s*[:.\-\u2013\u2014]\s*/i, "") || String(t || "");

export const WHEEL_ROW = 64;   // the web's WHEEL_ROW; My Lessons overrides it with 72

/* `large` is the web's `.fr-wheel-lg`, which is one rule and one rule only: the label goes from
   15 to 17. It is for SHORT lists — "7 periods a week" — where a longer list like a chapter title
   stays at 15 and needs the room. */
export function RollWheel({ items, value, onChange, ariaLabel, rowPx = WHEEL_ROW,
                            align = "left", padLeft = 16, peek = false, clamp = 1, large = false,
                            loop: loopProp = false }) {
  const ref = useRef(null);
  const settle = useRef(null);
  /* ★ WHAT THIS WHEEL ITSELF LAST COMMITTED (2026-09-15). The parking effect below deliberately
     does NOT run on `value` — doing so cancels the ▼'s own roll, which is the bug its comment
     records. But that left the opposite hole: a value changed from OUTSIDE never moved the box,
     so the wheel went on showing the old item while the screen showed the new one. This ref is
     how the two cases are told apart — if `value` is what we just committed, the scroll is
     already where it belongs; if it is anything else, somebody else set it and the box must
     follow. */
  const mine = useRef(null);
  /* ★ A ROLL WE STARTED OURSELVES IS AUTHORITATIVE UNTIL IT ARRIVES (2026-09-15).
     `onSettle` is wired to `onScroll` — it has to be, or the web target never commits a
     trackpad scroll at all (the founder's 2026-09-14 report). But `onScroll` also fires all the
     way through a PROGRAMMATIC `scrollTo({animated:true})`, and if those events stop arriving
     before the glide finishes, the 120ms timer reads an offset that is still in flight and
     rounds it to whichever row it happens to be nearest. Measured: a 72px wheel mid-roll at 172
     was read as row 2 and committed the item it was travelling AWAY from — so the ▼ appeared to
     do nothing, and, worse, quietly reverted the pick it had already made.
     So: the target is recorded here before the glide starts, the settle ignores any offset while
     one is outstanding, and a safety timer lands the wheel on that target if the glide is
     interrupted. The pick itself was committed by `stepCycle`/`step` before the glide began — it
     has never depended on the animation arriving. */
  const pending = useRef(null);
  const pendingTimer = useRef(null);
  const N = items.length;
  /* Continuous wheeling is a PEEK behaviour. The base wheel's list has ends and the ▲▼ pair
     respects them — the web's `stepScroll` clamps to [0, N-1] for exactly this reason. */
  /* WALK-A-005 (founder, 2026-09-20): first run's SUBJECT and CLASS wheels roll continuously too
     (`loop`); the chapter wheel keeps its ends, so its list still says where the book ends. */
  const loop = (peek || loopProp) && N > 1;
  /* The real index of the current value. A value that is not in the list at all is corrected by
     the effect below, which tells the PARENT — it is never silently displayed as item 0.
     ⚠️ AND `Math.max(0, …)` WAS DOING EXACTLY THAT (WALK-A-049, founder 2026-09-21, Pixel 7:
     "for every change of subject, English flashes and then the new subject comes"). A missing
     value gives findIndex −1, which that clamp turned into ITEM 0 — so for the render or two
     between a list changing and the parent being told, the box sat on the first row. The class
     wheel does it on every subject change, because its grades reload underneath it while it is
     still holding the old one. Holding the LAST GOOD index instead keeps the box where she left
     it until the correction arrives, which is the honest answer to "we don't know yet". */
  const lastIdx = useRef(0);
  const foundIdx = items.findIndex((it) => String(it.id) === String(value));
  if (foundIdx >= 0) lastIdx.current = foundIdx;
  const selIdx = foundIdx >= 0 ? foundIdx : Math.min(lastIdx.current, Math.max(0, N - 1));
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
    /* WALK-A-026: keyed on the LIST'S SIZE, not the array's identity. Callers build their items
       inline, so a new array arrived on every parent render and this effect re-parked the box
       mid-gesture — one more hand on the wheel while she was turning it. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N, rowPx]);

  /* ★ FOLLOW A VALUE SET FROM OUTSIDE (founder, 2026-09-15: "on iPhone, when lesson generation
     is initiated it defaults to pre-existing subject (English) list on My Lessons and remains
     there. I have to toggle to second subject to see if the LP is there").
     My Lessons STEERS these wheels when a prepare starts, so the proposed card is drawn in the
     list she is looking at — that is the web's rule and the phone had the effect for it. What the
     phone did not have was a wheel that would MOVE: the box stayed parked on English, and then
     its own settle timer read that stale offset, rounded it to English and committed it BACK,
     undoing the steer. The scope she had chosen was overwritten by the picture of the scope she
     had left. Measured on the running app: rows are 72px and the scroller was resting at 172 —
     between two rows, with the settle about to round it to the wrong one.
     ⚠️ `animated: false`, deliberately. This is not her gesture and not the ▼'s roll; it is the
     box catching up with a decision already made, and a 300ms glide would draw the eye to a
     movement that means nothing. */
  useEffect(() => {
    if (mine.current === String(value)) return;   // our own commit — the scroll is already right
    const el = ref.current;
    if (!el || !N) return;
    // Somebody else decided; whatever we were rolling towards is out of date.
    pending.current = null;
    if (pendingTimer.current) { clearTimeout(pendingTimer.current); pendingTimer.current = null; }
    const idx = items.findIndex((it) => String(it.id) === String(value));
    if (idx < 0) return;                          // not in the list; the effect above corrects it
    const y = (loop ? N + idx : idx) * rowPx;
    // Defer a frame for the same reason the mount effect does: a scroller that has not laid out
    // yet silently drops the offset.
    const id = setTimeout(() => { try { el.scrollTo({ y, animated: false }); } catch {} }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // The settle timer must not outlive the wheel — it calls onChange, and the parent may be gone.
  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
  }, []);

  /* Whatever settles in the box becomes the pick.
     ⚠️ AND `onScroll` IS THE ONE THAT MAKES IT WORK ON THE WEB TARGET (founder, 2026-09-14: "on
     the parity screen when I prepare a new lesson plan it goes back to chapter 1; iPhone works
     properly"). Native sends `onMomentumScrollEnd` after a flick and `onScrollEndDrag` after a
     slow drag, and one of the two always arrives. react-native-web sends NEITHER for a trackpad
     or mouse-wheel scroll — only `onScroll` — so the box moved, the pick was never committed,
     and the next render put it back where the value still said. On the phone the same code
     committed and looked correct, which is the same shape as the absolutely-positioned <Svg>:
     native is forgiving, the DOM is not, and the parity page is where it shows.
     The 120ms timer is what makes `onScroll` safe on native too — it fires continuously during
     a flick and each event resets the timer, so the commit still happens once, when the wheel
     actually stops. */
  /* Start a programmatic roll to `y` and hold it as the truth until the wheel gets there. */
  const rollTo = (y) => {
    const el = ref.current;
    if (!el) return;
    if (__DEV__ && global.__RW_TRACE) console.log("[rw]", ariaLabel, "rollTo", y, "row", y / rowPx, "sel", selIdx, "value", String(value));
    pending.current = y;
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    /* If the glide is interrupted — a re-render, a finger, a browser that drops the smooth
       scroll — put the wheel on the row anyway. Without this the box can rest between two rows
       for good, which is both wrong to look at and the state the settle used to misread. */
    pendingTimer.current = setTimeout(() => {
      pending.current = null;
      const el2 = ref.current;
      if (!el2) return;
      try { el2.scrollTo({ y, animated: false }); } catch {}
    }, 700);
    try { el.scrollTo({ y, animated: true }); } catch {}
  };

  const onSettle = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (__DEV__ && global.__RW_TRACE) console.log("[rw]", ariaLabel, "at", Math.round(y), "row", (y / rowPx).toFixed(2), "pending", pending.current);
    /* ⚠️ NEVER COMMIT FROM AN OFFSET THAT IS STILL TRAVELLING. The pick for a programmatic roll
       was made before it started; all that is left is to notice it has landed. */
    if (pending.current != null) {
      if (Math.abs(y - pending.current) <= 1) {
        pending.current = null;
        if (pendingTimer.current) { clearTimeout(pendingTimer.current); pendingTimer.current = null; }
      }
      return;
    }
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el || !N) return;
      const raw = Math.round(y / rowPx);
      if (loop) {
        const real = ((raw % N) + N) % N;
        if (items[real]) { mine.current = String(items[real].id); onChange(String(items[real].id)); }
        /* ★ ALWAYS LAND EXACTLY ON THE ROW — not only when the box has drifted out of the middle
           copy (2026-09-15). The recentring hop was the only correction here, so a wheel resting
           BETWEEN two rows inside the middle copy was left there: `snapToInterval` is native, and
           react-native-web has to express it as CSS scroll-snap, which does not catch a
           programmatic `scrollTo` that gets interrupted. Measured on the running app: 72px rows
           resting at 172, which `Math.round` then reads as row 2 — so the wheel not only LOOKED
           half-way, it committed the item it was half-way from.
           The non-loop branch below has had this nudge since it was written, and for the same
           reason; the loop branch simply never got it. On native the offset already matches and
           this is a no-op, and the `> 1` guard is what stops scrollTo → onScroll → settle from
           looping. */
        const y2 = (N + real) * rowPx;
        if (Math.abs(y - y2) > 1) { try { el.scrollTo({ y: y2, animated: false }); } catch {} }
      } else {
        const idx = Math.min(N - 1, Math.max(0, raw));
        if (items[idx]) { mine.current = String(items[idx].id); onChange(String(items[idx].id)); }
        /* Land ON the row. `snapToInterval` is a native prop; react-native-web has to express it
           as CSS scroll-snap and may not, in which case the box comes to rest between two rows
           and the pick is ambiguous to the eye even though it committed correctly. Nudging it
           here is right on both: on native the offset already matches and this is a no-op, and
           the guard stops the scrollTo→onScroll→settle loop from repeating. */
        const y2 = idx * rowPx;
        if (Math.abs(y - y2) > 1) { try { el.scrollTo({ y: y2, animated: false }); } catch {} }
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
    mine.current = String(items[next].id);   // ours, so the follow effect leaves the roll alone
    onChange(String(items[next].id));
    rollTo((loop ? N + selIdx + 1 : next) * rowPx);
  };

  /* The base wheel's ▲▼: exactly one row, CLAMPED at both ends — the web's `stepScroll`. The
     pick is committed before the box moves, for the same reason the ▼ does it. */
  const step = (dir) => {
    if (!N) return;
    // Looping wheels wrap at the ends (WALK-A-005); the rest clamp, as the web's stepScroll does.
    const next = loop ? ((selIdx + dir) % N + N) % N
                      : Math.min(N - 1, Math.max(0, selIdx + dir));
    if (next === selIdx) return;
    mine.current = String(items[next].id);   // ours, so the follow effect leaves the roll alone
    onChange(String(items[next].id));
    rollTo((loop ? N + next : next) * rowPx);
  };

  const ws = useWebStyles();
  return (
    <View style={[peek ? ws.rw_shell : ws.rw_shell_base, { height: rowPx + 2 }]}
      accessibilityLabel={ariaLabel}>
      <ScrollView ref={ref} showsVerticalScrollIndicator={false}
        snapToInterval={rowPx}
        /* WALK-A-037 (founder, 2026-09-20): on Android a flick raced past several rows. "fast"
           is 0.9; 0.8 stops the fling nearer the finger, so one flick moves about one row. iOS
           keeps the feel it was signed off with. */
        decelerationRate={Platform.OS === "android" ? 0.8 : "fast"} disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={onSettle} onMomentumScrollEnd={onSettle} onScrollEndDrag={onSettle}
        contentContainerStyle={{ paddingRight: 0 }}>
        {rendered.map((it) => {
          const sel = String(value) === String(it.id);
          return (
            <View key={it._k} style={[peek ? ws.rw_row : ws.rw_row_base, { height: rowPx },
              { justifyContent: align === "left" ? "flex-start" : "center", paddingLeft: padLeft }]}>
              {it.chip != null ? (
                <View style={[ws.rw_chip, sel && ws.rw_chip_on]}>
                  <Text style={[ws.rw_chip_t, sel && ws.rw_chip_t_on]}>{it.chip}</Text>
                </View>
              ) : null}
              {/* `adjustsFontSizeToFit` only makes sense on ONE line — it is the peek wheel's
                  stand-in for the web's measured auto-fit. A clamped multi-line label (the
                  Chapter wheel's two lines) keeps its size and wraps, as the web's does. */}
              <Text style={[peek ? ws.rw_label : ws.rw_label_base, !peek && large && ws.rw_label_lg]}
                numberOfLines={clamp}
                adjustsFontSizeToFit={clamp === 1} minimumFontScale={0.7}>
                {it.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      {/* The cue sits OUTSIDE the scroller so it never scrolls away — the web pins it with
          `position: absolute` on the shell for the same reason. It does not bob: the web's
          `fr-cue-bob` animation is a "this box moves" hint for a mouse user who has never met a
          wheel, and a thumb on a phone finds that out by touching it. */}
      {/* WALK-A-025: the ▲▼ PAIR sits apart in the taller box, with air kept from its top and
          bottom edges; the peek wheel's single ▼ stays centred. */}
      {N > 1 ? (
        <View style={[ws.rw_cue, !peek && { justifyContent: "space-between", paddingVertical: 10 }]}
          pointerEvents="box-none">
          {peek ? (
            <Pressable onPress={stepCycle} style={ws.rw_cue_btn} hitSlop={8}
              accessibilityRole="button" accessibilityLabel={`Next ${ariaLabel || "item"}`}>
              <Text style={ws.rw_cue_glyph}>▼</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={() => step(-1)} style={ws.rw_cue_btn} hitSlop={6}
                accessibilityRole="button" accessibilityLabel={`Previous ${ariaLabel || "item"}`}>
                <Text style={ws.rw_cue_glyph}>▲</Text>
              </Pressable>
              <Pressable onPress={() => step(1)} style={ws.rw_cue_btn} hitSlop={6}
                accessibilityRole="button" accessibilityLabel={`Next ${ariaLabel || "item"}`}>
                <Text style={ws.rw_cue_glyph}>▼</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default RollWheel;
