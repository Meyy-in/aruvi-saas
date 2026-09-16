/* ───────── The settings gear, drawn (founder screenshot, 2026-09-16) ─────────
 *
 * ★ BECAUSE iOS WILL NOT LET "⚙" BE TEXT. U+2699 has EMOJI presentation by default, so the two
 * bars that carried the bare character rendered Apple's metallic blue-grey 3D gear on the
 * handset while the web drew a flat glyph in `--ink-soft`. Measured off the founder's screenshot:
 * the gear regions hold ~2,000 distinct colours with a 38-point channel spread and sample
 * rgb(200,210,218) — an emoji — where the word "Settings" beside it holds 222 colours with a
 * spread of 9. It also means `color` was doing nothing: an emoji ignores it, so the one control
 * we had over the glyph was already gone.
 *
 * ★ SO IT IS AN SVG, like the bottom nav's four. A variation selector (U+FE0E) was the smaller
 * change and was rejected: iOS honours it only where a text-presentation glyph exists in an
 * installed font, so it is a guess that fails differently on different phones, and the failure
 * is either the same emoji or a missing-glyph box. Drawing it is the only answer that is the
 * same on every device and takes the ink we give it.
 *
 * ★ ONE COPY, TWO BARS. The brand bar and the frozen Settings bar both use it; a path duplicated
 * across two files is the drift this repo keeps finding (`AskMark`, `stageOfGrade`, `ppw`).
 *
 * ⚠️ NAMED DIVERGENCE (CLAUDE.md §4): the web keeps the character, because a browser renders it
 * as text. Same mark, different mechanism — a technical limitation of the phone, which is one of
 * the two sanctioned reasons to diverge.
 */
import Svg, { Circle, Path } from "react-native-svg";

/* Eight teeth at 45°, from r=7.4 to r=9.8 on a 24-unit box — computed, not traced, so the mark
   is the app's own. The hub is r=3.2 and the ring r=7.4, which is where the teeth start. */
const TEETH = "M19.40 12.00L21.80 12.00M17.23 17.23L18.93 18.93M12.00 19.40L12.00 21.80"
  + "M6.77 17.23L5.07 18.93M4.60 12.00L2.20 12.00M6.77 6.77L5.07 5.07"
  + "M12.00 4.60L12.00 2.20M17.23 6.77L18.93 5.07";

export default function GearIcon({ color, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={3.2} />
      <Circle cx={12} cy={12} r={7.4} />
      <Path d={TEETH} />
    </Svg>
  );
}
