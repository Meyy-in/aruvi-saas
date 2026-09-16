/* The legal documents on the phone: @aruvi/shared's parseMarkdown blocks → Text/View. The same
 * `lgl-*` roles as the web's renderer (h2/h3/p/ul/hr/table); a table stacks each row into a card
 * with the column heading before each cell — the web's ≤600px rule, here the only rule. Nothing
 * here can emit markup: every branch is an element we constructed.
 *
 * ★ AND IT IS THE WEB'S TYPE (founder, 2026-09-16: "privacy notice of expo/iphone to match font
 * of web app"). This was the last family still drawing from `theme/type`, whose `body` is 17px
 * against the web's 13px prose — so the whole notice rendered a third larger, and the difference
 * compounded: `type.bodyStrong` states a SIZE as well as a face, so a bold phrase inside a
 * paragraph grew mid-sentence. Measures now live in `theme/web.js` under `lgl_*`, and emphasis
 * carries a FACE AND NOTHING ELSE, so it inherits the paragraph it sits in.
 */
import { View } from "react-native";
import { Text } from "./Text";
import { parseMarkdown } from "@aruvi/shared/legalmd";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export default function Markdown({ md }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  /* The web's `inline()`: a run is bold, italic or plain. Nested Texts inherit size and colour
     from the block they sit in — which is the whole point (see the header). */
  const Runs = ({ runs }) => runs.map((r, i) => (
    <Text key={i} style={r.bold ? ws.lgl_b : r.italic ? ws.lgl_i : null}>{r.text}</Text>
  ));

  return parseMarkdown(md).map((b, k) => {
    switch (b.type) {
      case "h2": return <Text key={k} style={ws.lgl_h2}><Runs runs={b.runs} /></Text>;
      case "h3": return <Text key={k} style={ws.lgl_h3}><Runs runs={b.runs} /></Text>;
      case "p": return <Text key={k} style={ws.lgl_p}><Runs runs={b.runs} /></Text>;
      case "hr": return <View key={k} style={[ws.lgl_hr, { borderTopColor: t.line }]} />;
      case "ul": return (
        <View key={k} style={ws.lgl_ul}>
          {b.items.map((runs, i) => (
            <View key={i} style={{ flexDirection: "row", columnGap: 8 }}>
              {/* The web has a real list marker; RN has none, so the bullet is drawn — at the
                  paragraph's own size, so it sits on the line rather than above or below it. */}
              <Text style={[ws.lgl_li, { color: t.ink_soft, marginBottom: 0 }]}>•</Text>
              <Text style={[ws.lgl_li, { flex: 1 }]}><Runs runs={runs} /></Text>
            </View>))}
        </View>);
      case "table": return (
        <View key={k} style={ws.lgl_tablewrap}>
          {b.rows.map((row, ri) => (
            <View key={ri} style={[ws.lgl_tr, { backgroundColor: t.card_bg, borderColor: t.line }]}>
              {row.map((runs, ci) => (
                <View key={ci} style={ws.lgl_td}>
                  <Text style={ws.lgl_th}>{b.headText[ci]}</Text>
                  <Text style={ws.lgl_td_t}><Runs runs={runs} /></Text>
                </View>))}
            </View>))}
        </View>);
      default: return null;
    }
  });
}
