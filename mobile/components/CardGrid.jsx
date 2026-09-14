/* ───────── The constant graph rule (founder, 2026-08-30; on the phone too, 2026-09-14) ─────────
 *
 * The same 11px rule on every card whatever its state. It is a MATERIAL, not a code: because it
 * never varies it carries no meaning, needs no legend, and cannot compete with the status colours
 * the way a per-class pattern would. Paper keeps its grain, cards get their rule.
 *
 * The web draws it with two repeating linear-gradients; React Native has no repeating gradient, so
 * it is an SVG `<Pattern>` — a true tile, not an approximation. The line sits on the TOP and LEFT
 * edge of each 11px cell, as the web's gradients do.
 *
 * ⚠️ THE WEIGHT LIVES IN ONE PLACE, `--card-grid` in globals.css (theme/tokens.js is generated
 * from it), so lightening the rule lightens BOTH surfaces.
 *
 * ★ WHY THIS IS MEASURED, AND WHY IT IS ONE FILE (2026-09-14, founder: the Prepare CTA's gradient
 * rendered on the iPhone and NOT on the Expo web target).
 *
 *   react-native-svg only defaults an `<Svg>` to 100% × 100% when it is NOT absolutely positioned
 *   — `elements/Svg.js`: `if (width === undefined && height === undefined && position !==
 *   'absolute') { width = height = '100%' }`. Every one of these was `<Svg style={absoluteFill}>`
 *   with no size, so on NATIVE the layout engine gave it bounds anyway and it drew, while on WEB
 *   it became an `<svg>` with no intrinsic size and collapsed to nothing. One symptom, two
 *   surfaces disagreeing, and the parity page is the only place it shows.
 *   So the box is measured with `onLayout` and the size passed explicitly. That is correct on
 *   both targets rather than accidentally correct on one.
 *
 *   And the pattern id is PER INSTANCE. On the web these become real DOM ids: a list of section
 *   cards all declaring `id="sc-grid"` is a document full of duplicate ids, and `url(#sc-grid)`
 *   resolves to whichever one the browser saw first — so every card would reference a pattern
 *   owned by a card that may unmount. It looked right only because the tiles are identical.
 */
import { useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, Pattern, Path, Rect } from "react-native-svg";

let seq = 0;

export default function CardGrid({ color }) {
  const id = useRef(`grid-${++seq}`).current;
  const [box, setBox] = useState(null);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        // Only on a real change — onLayout fires on every re-measure and this is behind content.
        setBox((b) => (b && b.width === width && b.height === height ? b : { width, height }));
      }}>
      {box && box.width > 0 && box.height > 0 ? (
        <Svg width={box.width} height={box.height}>
          <Defs>
            <Pattern id={id} width={11} height={11} patternUnits="userSpaceOnUse">
              <Path d="M0 0.5 H11 M0.5 0 V11" stroke={color} strokeWidth={1} fill="none" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width={box.width} height={box.height} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}
