/* The legal documents on the phone: @aruvi/shared's parseMarkdown blocks → Text/View. The
 * same `lgl-*` roles as the web's renderer (h2/h3/p/ul/hr/table); a table stacks each row
 * into a card with the column heading before each cell — the web's ≤600px rule, here the
 * only rule. Nothing here can emit markup: every branch is an element we constructed. */
import { View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { parseMarkdown } from "@aruvi/shared/legalmd";
import { useTheme } from "../theme/ThemeContext";
import { type } from "../theme/type";

function Runs({ runs, base }) {
  return runs.map((r, i) => (
    <Text key={i} style={r.bold ? type.bodyStrong : r.italic ? type.bodyItalic : null}>{r.text}</Text>
  ));
}

export default function Markdown({ md }) {
  const { t } = useTheme();
  const ink = { color: t.ink };
  return parseMarkdown(md).map((b, k) => {
    switch (b.type) {
      case "h2": return <Text key={k} style={[type.h2, ink, s.h2]}><Runs runs={b.runs} /></Text>;
      case "h3": return <Text key={k} style={[type.bodyStrong, ink, s.h3]}><Runs runs={b.runs} /></Text>;
      case "p": return <Text key={k} style={[type.body, ink, s.p]}><Runs runs={b.runs} /></Text>;
      case "hr": return <View key={k} style={[s.hr, { backgroundColor: t.line }]} />;
      case "ul": return (
        <View key={k} style={s.ul}>
          {b.items.map((runs, i) => (
            <View key={i} style={s.li}>
              <Text style={[type.body, { color: t.ink_soft }]}>•</Text>
              <Text style={[type.body, ink, { flex: 1 }]}><Runs runs={runs} /></Text>
            </View>))}
        </View>);
      case "table": return (
        <View key={k} style={s.table}>
          {b.rows.map((row, ri) => (
            <View key={ri} style={[s.card, { backgroundColor: t.paper_2, borderColor: t.edge }]}>
              {row.map((runs, ci) => (
                <View key={ci} style={s.cell}>
                  <Text style={[type.label, { color: t.ink_soft }]}>{b.headText[ci]}</Text>
                  <Text style={[type.body, ink]}><Runs runs={runs} /></Text>
                </View>))}
            </View>))}
        </View>);
      default: return null;
    }
  });
}

const s = StyleSheet.create({
  h2: { marginTop: 22, marginBottom: 6 }, h3: { marginTop: 14, marginBottom: 4 }, p: { marginTop: 8 },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: 18 },
  ul: { marginTop: 8, gap: 6 }, li: { flexDirection: "row", gap: 8 },
  table: { marginTop: 10, gap: 10 }, card: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 8 }, cell: { gap: 2 },
});
