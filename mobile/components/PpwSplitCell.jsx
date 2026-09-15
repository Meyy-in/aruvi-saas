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
 * ⚠️ THE DIVERGENCE, named as CLAUDE.md §4 requires: the web opens a `position: fixed` listbox,
 * hand-built rather than a native `<select>` because on macOS the OS draws a select's popup and
 * ignores `option { background }` outright, so the warm-paper palette could never reach the open
 * menu. That reasoning is a DOM reasoning. On the phone the same constraint does not exist and
 * the opposite one does: a small floating menu pinned near a chip inside a scroller is exactly
 * what a phone should not do — it lands under a thumb, it fights the scroll, and it has nowhere
 * to flip to on a short screen. So the choices open in the app's own `Sheet`, which is where
 * every other phone-side choice in this app is made. The web's flip-above-when-tight logic, its
 * outside-press/Escape/scroll/resize closers and its fixed rect all go with it — a sheet needs
 * none of them.
 */
import { useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Text } from "./Text";
import { Sheet } from "./AttachSheet";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export default function PpwSplitCell({ duration, selected, map, total, isAnchor, onSet, show }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const [open, setOpen] = useState(false);

  // Nothing at all on an unticked row, or while only one length is in play: the column only earns
  // its space once a second length is ticked.
  if (!show || !selected) return null;

  const v = Number((map || {})[duration] ?? (map || {})[String(duration)]) || 0;
  if (isAnchor) return <Text style={[ws.ppw_num, { color: t.ink }]}>{v}</Text>;

  const answered = v > 0;
  const choices = Array.from({ length: (Number(total) || 0) + 1 }, (_, i) => i);

  return (
    <>
      <Pressable onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Periods a week at ${duration} minutes: ${v}`}
        accessibilityState={{ expanded: open }}
        style={[ws.ppw_sel, answered
          ? { borderColor: "transparent", backgroundColor: "transparent" }
          : { borderColor: t.pine, backgroundColor: t.paper_2 }]}>
        <Text style={[ws.ppw_sel_t, { color: answered ? t.ink : t.pine_d }]}>{v}</Text>
        <Text style={[ws.ppw_caret, { color: t.pine, opacity: answered ? 0.4 : 1 }]}>▾</Text>
      </Pressable>

      {/* ⚠️ MOUNTED AND UNMOUNTED, NOT TOGGLED — and the reason is specific to where this sheet
          lives. Handing `visible={open}` to the Modal left it on screen after a pick even though
          this cell had already re-rendered with `open === false`: the console said so. The other
          sheets in this app toggle the same prop and close perfectly (prepare.jsx's breakdown was
          checked directly), so toggling is not broken in general. What is different HERE is that
          this sheet is returned from PickWheel's `trailing` CALLBACK, deep inside the wheel's
          ScrollView — so the pick re-creates the surrounding subtree in the very frame the Modal
          begins its fade-out, and the exit never completes. Mounting conditionally, the idiom
          `AttachSheet` has always used, sidesteps the race entirely.
          The lesson, general: a Modal whose visibility flips in the same commit that rebuilds the
          subtree around it cannot be relied on to finish leaving. */}
      {open ? (
      <Sheet visible onClose={() => setOpen(false)}
        kicker={`${duration} min`} title="Periods a week at this length">
        <ScrollView style={{ maxHeight: 320 }}>
          {choices.map((n) => (
            /* ⚠️ CLOSE FIRST, THEN SET. `onSet` lifts state into the duration screen, which
               re-renders the whole wheel and hands this cell back through PickWheel's `trailing`
               callback — and a close queued behind that update did not survive the round trip:
               the sheet stayed open over the very figure she had just chosen. Closing first
               commits this cell's own state before the parent's re-render is triggered. */
            <Pressable key={n} onPress={() => { setOpen(false); onSet(duration, n); }}
              accessibilityRole="button" accessibilityState={{ selected: n === v }}
              style={[ws.ppw_opt, n === v && { backgroundColor: t.pine }]}>
              <Text style={[ws.ppw_opt_t, { color: n === v ? t.paper_2 : t.ink }]}>{n}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
      ) : null}
    </>
  );
}
