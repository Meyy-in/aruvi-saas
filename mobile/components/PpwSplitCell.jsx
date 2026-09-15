/* ───────── one cell of the split column (Track D step 5d) ─────────
 *
 * The trailing column on the duration question: how many of her weekly periods are at each length.
 * A port of `PpwSplitCell` in web/app/components/wheels.jsx.
 *
 * ★ THE ANCHOR SHOWS A BARE NUMBER, AND IT IS NOT EDITABLE. The lowest ticked length carries the
 * REMAINDER — anchor = total − Σ(others) — so it is derived, not answered, and moving any other
 * row moves it by the same amount. That is what keeps her week the same SIZE however she divides
 * it (the 2026-07-26 rule: naming a second length tells us how her same week is split, not that
 * she gained a class). No label beside it either: the column heading already says what it is, and
 * the word "rest" only competed with the figure.
 *
 * ★ THE CHIP IS A FORM FIELD ONLY WHILE IT IS STILL ASKING. At 0 it reads as a pine-bordered box;
 * the moment she picks a number it settles INTO the row — surface and edge transparent, caret
 * dimmed, figure in the row's own ink — so answered rows read as one column of figures beside the
 * anchor's, rather than as a heading with two kinds of control hanging off it.
 *
 * ⚠️ THE DIVERGENCE, named as CLAUDE.md §4 requires, and it changed once. The web opens a
 * `position: fixed` listbox, hand-built rather than a native `<select>` because on macOS the OS
 * draws a select's popup and ignores `option { background }`, so the warm-paper palette could
 * never reach the open menu. That is a DOM reason and it does not travel.
 *   The phone's first answer was the app's own `Sheet`. That was wrong for a reason only the
 *   running screen showed: once the EDITOR itself became a window (founder, 2026-09-15), the
 *   picker was a window on top of a window — two cards overlapping, two ✕s, the inner one
 *   covering the very row she had just tapped.
 *   So the cell no longer owns an overlay at all. It reports that it is the ACTIVE one, and the
 *   duration step draws a strip of choices INLINE beneath the wheel. One tap to set, as the
 *   listbox had; no second layer; and it costs the window about 40px, which is why `Sheet`
 *   scrolls. A stepper was the other candidate and was rejected: at a 14-period week, setting 7
 *   would have been seven taps where this is one.
 */
import { Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export default function PpwSplitCell({ duration, selected, map, isAnchor, onOpen, open, show }) {
  const { t } = useTheme();
  const ws = useWebStyles();

  // Nothing at all on an unticked row, or while only one length is in play: the column only earns
  // its space once a second length is ticked.
  if (!show || !selected) return null;

  const v = Number((map || {})[duration] ?? (map || {})[String(duration)]) || 0;
  if (isAnchor) return <Text style={[ws.ppw_num, { color: t.ink }]}>{v}</Text>;

  const answered = v > 0;
  return (
    <Pressable onPress={() => onOpen(open ? null : duration)}
      accessibilityRole="button"
      accessibilityLabel={`Periods a week at ${duration} minutes: ${v}`}
      accessibilityState={{ expanded: !!open }}
      style={[ws.ppw_sel, open
        ? { borderColor: t.pine_d, backgroundColor: t.tint_pine }
        : answered
          ? { borderColor: "transparent", backgroundColor: "transparent" }
          : { borderColor: t.pine, backgroundColor: t.paper_2 }]}>
      <Text style={[ws.ppw_sel_t, { color: answered && !open ? t.ink : t.pine_d }]}>{v}</Text>
      <Text style={[ws.ppw_caret, { color: t.pine, opacity: answered && !open ? 0.4 : 1 }]}>▾</Text>
    </Pressable>
  );
}
