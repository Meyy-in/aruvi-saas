/* ───────── The Assess tab — ported 1:1 from the web's AssessPanel family (2026-09-12) ─────────
 * web/app/components/LessonView.jsx: AssessPanel · itemTabSet · AssessBody · AOverviewPanel ·
 * AQuestionPanel · AAnswerPanel · InclusivityText · ALegacyCard · ATyped/ANumberLine · ABlock ·
 * AScaffold · APartsList · AAnswerBlock · ATicks · AReveals · groupedOptionSets · qtypeName.
 * Same pager ("← Previous · Question n / N · Next →"), same sub-tabs (Overview · Question ·
 * Answer? · Inclusivity?), same headings (verbatim, uppercase as the web sets them), same
 * template branches, same "Next question →" / "Question →" / "Answer →" inline nav.
 * Translations only: the pinned .uv-assess-stick is a plain View at the top of the panel
 * (the panel already scrolls under the pinned unit header); <details> "READING THIS TASK" is a
 * Pressable toggle, collapsed by default as on the web; the choice popup is a Modal; the SVG
 * stimulus goes through react-native-svg's SvgXml. */
import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import Svg, { Line, Polygon, Text as SvgText, SvgXml } from "react-native-svg";
import { type } from "../../theme/type";
import { display, mono } from "../../theme/fonts";

const QTYPE_NAME = {
  MCQ: "Multiple choice question", TRUE_FALSE: "True or false", SCR: "Short constructed response",
  ECR: "Extended constructed response", OPEN_TASK: "Open task", PROJECT: "Project", WRITING_TASK: "Writing task",
  FILL_IN: "Fill in the blanks", MATCH: "Match the following", ORAL_PROMPT: "Oral prompt", NUM: "Numerical problem",
  EXTRACT_ANALYSIS: "Extract analysis", SOURCE_INTERPRETATION: "Source interpretation",
};
const qtypeName = (q) => QTYPE_NAME[q] || String(q || "").replace(/_/g, " ");

const GROUPED_LABEL = /^(.+?)[\s\-_.]*([A-Z])$/;
function splitLabel(label) {
  const m = String(label || "").match(GROUPED_LABEL);
  if (!m) return null;
  const digits = m[1].match(/\d+/);
  return digits ? [digits[0], m[2]] : null;
}
export function groupedOptionSets(opts) {
  const list = opts || [];
  if (list.length < 2) return null;
  const marks = list.map((o) => splitLabel(o.label));
  if (marks.some((m) => !m)) return null;
  const order = []; const by = new Map();
  list.forEach((o, i) => { const [group, letter] = marks[i]; if (!by.has(group)) { by.set(group, []); order.push(group); } by.get(group).push({ ...o, display: letter }); });
  return order.length > 1 ? order.map((group) => ({ group, opts: by.get(group) })) : null;
}
function itemTabSet(n) {
  const opts = (n.options || []).map((o, i) => ({ ...o, label: o.label || String.fromCharCode(65 + i) }));
  const correct = opts.filter((o) => o.is_correct);
  const hasAnswer = !!(correct.length || n.model_answer || (n.expected_elements && n.expected_elements.length)
    || (n.look_fors && n.look_fors.length) || Object.keys(n.option_reveals || {}).length || n.method_one_line
    || (n.tf_statements && n.tf_statements.length) || (n.match_pairs && n.match_pairs.length));
  return { opts, correct, sets: groupedOptionSets(opts),
    tabs: [["ov", "Overview"], ["q", "Question"], ...(hasAnswer ? [["an", "Answer"]] : []), ...(n.inclusivity ? [["inc", "Inclusivity"]] : [])] };
}

/* ── small blocks ── */
const K = ({ t, children }) => <Text style={[type.label, { color: t.ink_soft, marginBottom: 4 }]}>{children}</Text>;
const P = ({ t, children, style }) => <Text style={[type.body, { color: t.ink }, style]}>{children}</Text>;
const Look = ({ t, children }) => <View style={s.look}>{children}</View>;

function ABlock({ t, k, text }) {
  if (!text) return null;
  return <Look t={t}><K t={t}>{k}</K><P t={t}>{text}</P></Look>;
}
function ATicks({ t, k, items }) {
  if (!items || !items.length) return null;
  return (
    <Look t={t}><K t={t}>{k}</K>
      {items.map((x, i) => <View key={i} style={s.tick}><Text style={{ color: t.pine }}>✓</Text><P t={t} style={{ flex: 1 }}>{x}</P></View>)}
    </Look>
  );
}
function APartsList({ t, lead, parts }) {
  return (
    <View>
      {lead ? <P t={t} style={{ marginBottom: 6 }}>{lead}</P> : null}
      {parts.map((p, i) => (
        <View key={i} style={s.row}>
          {p.marker ? <Text style={[s.lab, { color: t.ink_soft }]}>{p.marker}</Text> : null}
          <P t={t} style={{ flex: 1 }}>{p.text}</P>
        </View>
      ))}
    </View>
  );
}
function AAnswerBlock({ t, k, n }) {
  if (!n || !n.model_answer) return null;
  if (!n.answer_parts || !n.answer_parts.length) return <ABlock t={t} k={k} text={n.model_answer} />;
  return <Look t={t}><K t={t}>{k}</K><APartsList t={t} lead={n.answer_lead} parts={n.answer_parts} /></Look>;
}
function AScaffold({ t, n }) {
  if (!n.scaffold) return null;
  const lines = n.scaffold_lines;
  if (!lines || !lines.length) return <ABlock t={t} k="SCAFFOLD" text={n.scaffold} />;
  return (
    <Look t={t}><K t={t}>SCAFFOLD</K>
      <View style={[s.scaf, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
        {lines.map((ln, i) => ln ? <Text key={i} style={[type.mono, { fontSize: 14, color: t.ink, lineHeight: 22 }]}>{ln}</Text> : <View key={i} style={{ height: 10 }} />)}
      </View>
    </Look>
  );
}

/* ── typed visual stimulus ── */
function ANumberLine({ t, nl }) {
  const ticks = (nl && nl.ticks) || [];
  if (!ticks.length) return null;
  const W = 320, padX = 26, y = 26, n = ticks.length, step = n > 1 ? (W - 2 * padX) / (n - 1) : 0;
  const x = (i) => padX + i * step;
  return (
    <View style={{ marginVertical: 8 }}>
      <Svg viewBox={`0 0 ${W} 52`} width="100%" height={52} accessibilityLabel="Number line">
        <Line x1={padX - 12} y1={y} x2={W - padX + 12} y2={y} stroke={t.ink} strokeWidth={1.5} />
        <Polygon points={`${padX - 12},${y} ${padX - 4},${y - 4} ${padX - 4},${y + 4}`} fill={t.ink} />
        <Polygon points={`${W - padX + 12},${y} ${W - padX + 4},${y - 4} ${W - padX + 4},${y + 4}`} fill={t.ink} />
        {ticks.map((tk, i) => (
          <SvgText key={`l${i}`} x={x(i)} y={y + 20} fontSize={11} fill={t.ink_soft} textAnchor="middle" fontFamily={mono(400)}>{tk.label || ""}</SvgText>
        ))}
        {ticks.map((_, i) => <Line key={`t${i}`} x1={x(i)} y1={y - 6} x2={x(i)} y2={y + 6} stroke={t.ink} strokeWidth={1.5} />)}
      </Svg>
      {nl.instruction ? <Text style={[type.small, { color: t.ink_soft }]}>{nl.instruction}</Text> : null}
    </View>
  );
}
function ATyped({ t, b, passage = false }) {
  if (!b || !b.content) return null;
  if (b.type === "svg") return <View style={{ marginVertical: 8 }}><SvgXml xml={b.content} width="100%" /></View>;
  if (b.type === "number_line" && b.number_line) return <ANumberLine t={t} nl={b.number_line} />;
  if (b.type === "table" && b.table) {
    const header = b.table.header || [];
    return (
      <View style={{ marginVertical: 8 }}>
        {b.table.caption ? <Text style={[type.small, { color: t.ink_soft, marginBottom: 6 }]}>{b.table.caption}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 6, overflow: "hidden" }}>
            {header.length ? <View style={{ flexDirection: "row", backgroundColor: t.paper_sunk }}>{header.map((c, i) => <Text key={i} style={[type.label, s.td, { color: t.ink }]}>{c}</Text>)}</View> : null}
            {(b.table.rows || []).map((r, i) => (
              <View key={i} style={{ flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }}>
                {r.map((c, j) => <Text key={j} style={[type.small, s.td, { color: t.ink }]}>{c}</Text>)}
              </View>
            ))}
          </View>
        </ScrollView>
        {b.table.source_note ? <Text style={[type.small, { color: t.ink_soft, marginTop: 6 }]}>{b.table.source_note}</Text> : null}
      </View>
    );
  }
  return passage
    ? <View style={[s.passage, { borderLeftColor: t.ochre, backgroundColor: t.tint_cream }]}><Text style={[type.bodyItalic, { color: t.ink }]}>{b.content}</Text></View>
    : <P t={t} style={{ marginVertical: 8 }}>{b.content}</P>;
}

/* ── the four sub-panels ── */
function AOverviewPanel({ t, n, lo, nav }) {
  const comp = n.competency ? [n.competency.code, n.competency.text].filter(Boolean).join(" — ") : null;
  const rows = [];
  if (comp) rows.push(["Competency", comp]);
  if (lo) rows.push(["Learning outcome", lo]);
  if (n.section) rows.push(["Section", n.section]);
  rows.push(["Question type", qtypeName(n.question_type)]);
  if (n.cognitive_demand) rows.push(["Cognitive demand", n.cognitive_demand]);
  return (
    <View>
      {rows.map(([k, v], i) => (
        <View key={i} style={[s.ovrow, { borderBottomColor: t.line_soft }]}>
          <Text style={[type.bodyStrong, { color: t.ink, fontSize: 15 }]}>{k}</Text>
          <P t={t} style={{ marginTop: 2 }}>{v}</P>
          {i === rows.length - 1 ? nav : null}
        </View>
      ))}
    </View>
  );
}

function OptList({ t, opts, showKey = "label" }) {
  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      {opts.map((o, i) => (
        <View key={i} style={s.row}>
          <Text style={[s.lab, { color: t.ink_soft }]}>{o[showKey]}</Text>
          <P t={t} style={{ flex: 1 }}>{o.text}</P>
        </View>
      ))}
    </View>
  );
}

function AQuestionPanel({ t, n, opts, sets, nav }) {
  const isTF = n.template === "true_false" && n.tf_statements && n.tf_statements.length;
  const interleaved = !!(sets && !isTF && n.stem_parts && n.stem_parts.length === sets.length);
  const [otgOpen, setOtgOpen] = useState(false);
  return (
    <View>
      {n.template === "passage" ? <ATyped t={t} b={n.passage} passage /> : null}
      {isTF ? (
        <View>
          {n.stem_lead || n.stem ? <P t={t} style={{ marginBottom: 6 }}>{n.stem_lead || n.stem}</P> : null}
          {n.tf_statements.map((st, i) => (
            <View key={i} style={s.row}>{st.marker ? <Text style={[s.lab, { color: t.ink_soft }]}>{st.marker}</Text> : null}<P t={t} style={{ flex: 1 }}>{st.text}</P></View>
          ))}
        </View>
      ) : interleaved ? (
        <View>
          {n.stem_lead ? <P t={t} style={{ marginBottom: 6 }}>{n.stem_lead}</P> : null}
          {sets.map((set, si) => (
            <View key={set.group} style={{ marginBottom: 12 }}>
              <View style={s.row}>{n.stem_parts[si].marker ? <Text style={[s.lab, { color: t.ink_soft }]}>{n.stem_parts[si].marker}</Text> : null}<P t={t} style={{ flex: 1 }}>{n.stem_parts[si].text}</P></View>
              <OptList t={t} opts={set.opts} showKey="display" />
            </View>
          ))}
        </View>
      ) : n.stem_parts && n.stem_parts.length ? (
        <APartsList t={t} lead={n.stem_lead} parts={n.stem_parts} />
      ) : <P t={t}>{n.stem}</P>}

      {n.audio_ref ? (
        <Text style={[type.small, { color: t.ink_soft, marginTop: 8 }]}><Text style={type.bodyItalic}>Listening passage</Text> — {n.audio_ref}, read aloud</Text>
      ) : null}
      <ATyped t={t} b={n.visual_stimulus} />
      {opts.length && !isTF && !interleaved ? (
        sets ? sets.map((set) => (
          <View key={set.group} style={{ marginTop: 8 }}>
            <Text style={[type.label, { color: t.ink_soft }]}>Question {set.group}</Text>
            <OptList t={t} opts={set.opts} showKey="display" />
          </View>
        )) : <OptList t={t} opts={opts} />
      ) : null}
      <ATicks t={t} k="WHAT TO PRODUCE" items={n.format_of_output} />
      <AScaffold t={t} n={n} />
      {n.open_task_guide ? (
        <View style={s.look}>
          <Pressable onPress={() => setOtgOpen((o) => !o)} hitSlop={6}><Text style={[type.label, { color: t.pine }]}>{otgOpen ? "▾" : "▸"} READING THIS TASK</Text></Pressable>
          {otgOpen ? (
            <View style={{ marginTop: 6 }}>
              <ABlock t={t} k="FORMAT" text={[n.open_task_guide.format_type, n.open_task_guide.format_rationale].filter(Boolean).join(" — ")} />
              <ABlock t={t} k="WHAT THIS DEMONSTRATES" text={n.open_task_guide.what_this_demonstrates} />
              <ABlock t={t} k="READING THE SCAFFOLD" text={n.open_task_guide.reading_the_scaffold} />
            </View>
          ) : null}
        </View>
      ) : null}
      {n.exercise_ref || n.exercise_desc ? (
        <Look t={t}><K t={t}>TEXTBOOK EXERCISE</K>
          <P t={t}>
            {n.exercise_ref ? <Text style={{ fontFamily: display(600) }}>{n.exercise_ref}</Text> : null}
            {n.exercise_ref && n.exercise_desc ? " — " : null}
            {n.exercise_desc ? (/^["'“‘]/.test(n.exercise_desc.trim()) ? n.exercise_desc : `“${n.exercise_desc.trim()}”`) : null}
          </P>
        </Look>
      ) : null}
      {nav}
    </View>
  );
}

function AReveals({ t, reveals, opts = [], sets = null }) {
  const entries = Object.entries(reveals || {});
  const [shown, setShown] = useState(null);
  if (!entries.length) return null;
  const optFor = (lab) => opts.find((o) => o.label === lab) || null;
  const setFor = (lab) => (sets && sets.find((st) => st.opts.some((x) => x.label === lab))) || null;
  const shownLab = (lab) => { const st = setFor(lab); return st ? st.opts.find((x) => x.label === lab).display : lab; };
  const popped = shown ? optFor(shown) : null;
  return (
    <Look t={t}><K t={t}>WHAT EACH CHOICE REVEALS</K>
      {entries.map(([lab, txt], i) => lab === "note" ? <P t={t} key={i}>{txt}</P> : (
        <View key={i} style={s.row}>
          {setFor(lab) ? <Text style={[s.qchip, { color: t.pine, borderColor: t.pine }]}>Q{setFor(lab).group}</Text> : null}
          <Text style={[s.lab, { color: t.ink_soft }]}>{shownLab(lab)}</Text>
          <P t={t} style={{ flex: 1 }}>
            {txt}{optFor(lab) ? <Text onPress={() => setShown(lab)} style={{ color: t.pine, textDecorationLine: "underline" }}>  Choice {shownLab(lab)}</Text> : null}
          </P>
        </View>
      ))}
      {popped ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShown(null)}>
          <Pressable style={s.popBg} onPress={() => setShown(null)}>
            <Pressable style={[s.popBox, { backgroundColor: t.paper_2, borderColor: t.edge }]} onPress={() => {}}>
              <Pressable onPress={() => setShown(null)} hitSlop={10} accessibilityLabel="Close" style={{ alignSelf: "flex-start" }}><Text style={{ color: t.ink_soft }}>✕</Text></Pressable>
              <Text style={[type.label, { color: t.pine, marginTop: 8 }]}>{setFor(shown) ? `Question ${setFor(shown).group} · ` : ""}Choice {shownLab(shown)}</Text>
              <P t={t} style={{ marginTop: 6 }}>{popped.text}</P>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </Look>
  );
}

function AAnswerPanel({ t, n, correct, opts = [], sets = null }) {
  if (n.template === "true_false" && n.tf_statements && n.tf_statements.length) {
    const hasReasons = n.tf_statements.some((st) => st.reason);
    if (!hasReasons && n.model_answer) return <ABlock t={t} k="SUGGESTED ANSWER" text={n.model_answer} />;
    return (
      <Look t={t}><K t={t}>ANSWER KEY</K>
        {n.tf_statements.map((st, i) => (
          <View key={i} style={s.row}>
            {st.marker ? <Text style={[s.lab, { color: t.ink_soft }]}>{st.marker}</Text> : null}
            <P t={t} style={{ flex: 1 }}><Text style={{ fontFamily: display(600), color: st.verdict ? t.pine : t.clay }}>{st.verdict ? "True" : "False"}</Text>{st.reason ? ` — ${st.reason}` : ""}</P>
          </View>
        ))}
      </Look>
    );
  }
  const tpl = n.template;
  return (
    <View>
      {correct.length ? (
        <Look t={t}><K t={t}>CORRECT ANSWER</K>
          {correct.map((o, i) => {
            const set = sets && sets.find((st) => st.opts.some((x) => x.label === o.label));
            const shown = set ? set.opts.find((x) => x.label === o.label).display : o.label;
            return (
              <View key={i} style={s.row}>
                {set ? <Text style={[s.qchip, { color: t.pine, borderColor: t.pine }]}>Q{set.group}</Text> : null}
                <Text style={[s.lab, { color: t.ink_soft }]}>{shown}</Text>
                <P t={t} style={{ flex: 1 }}>{o.text}<Text style={{ color: t.pine }}> ✓</Text></P>
              </View>
            );
          })}
        </Look>
      ) : null}
      {tpl === "selected_response" ? <><AAnswerBlock t={t} k="ANSWER" n={n} /><AReveals t={t} reveals={n.option_reveals} opts={opts} sets={sets} /></>
      : tpl === "scr" ? <>{n.model_answer ? <AAnswerBlock t={t} k="SUGGESTED ANSWER" n={n} /> : <ATicks t={t} k="LOOK FOR" items={n.expected_elements} />}<ABlock t={t} k="METHOD" text={n.method_one_line} /></>
      : tpl === "ecr" ? <><ATicks t={t} k="LOOK FOR" items={n.look_fors} /><ATicks t={t} k="EXPECTED ELEMENTS" items={n.expected_elements} /><AAnswerBlock t={t} k="SUGGESTED ANSWER" n={n} /><ABlock t={t} k="METHOD" text={n.method_one_line} /></>
      : tpl === "open_task" ? <><ATicks t={t} k="EXPECTED ELEMENTS" items={n.expected_elements} /><ATicks t={t} k="LOOK FOR" items={n.look_fors} /></>
      : tpl === "cloze_match" ? <AAnswerBlock t={t} k="ANSWER KEY" n={n} />
      : tpl === "match" ? (n.match_pairs && n.match_pairs.length ? (
          <Look t={t}><K t={t}>ANSWER KEY</K>
            {n.match_pairs.map((p, i) => <View key={i} style={s.row}><P t={t} style={{ flex: 1 }}>{p.left}</P><Text style={{ color: t.ink_soft }}>→</Text><P t={t} style={{ flex: 1 }}>{p.right}</P></View>)}
          </Look>) : <AAnswerBlock t={t} k="ANSWER KEY" n={n} />)
      : tpl === "oral" ? <ATicks t={t} k="SPEAKING RUBRIC" items={n.expected_elements} />
      : tpl === "numeric" ? <><AAnswerBlock t={t} k="WORKED ANSWER" n={n} /><ABlock t={t} k="METHOD" text={n.method_one_line} /></>
      : tpl === "passage" ? <ATicks t={t} k="EXPECTED ELEMENTS" items={n.expected_elements} />
      : null}
    </View>
  );
}

function InclusivityText({ t, text, mathsMiddle, mathsSecondary }) {
  if (!text) return null;
  const labels = mathsMiddle ? "support|stretch|challenge" : mathsSecondary ? "support|challenge" : "support|stretch";
  const render = (chunk, keyBase) => {
    const parts = [`\\b(?:${labels})\\b(?=\\s*:)`];
    if (mathsMiddle) parts.push(`\\b(?:struggling)\\b`);
    const re = new RegExp(`(${parts.join("|")})`, "gi");
    const out = []; let last = 0, m, k = 0;
    while ((m = re.exec(chunk)) !== null) {
      if (m.index > last) out.push(chunk.slice(last, m.index));
      const w = m[0];
      const isLabel = new RegExp(`^(?:${labels})$`, "i").test(w);
      out.push(<Text key={`${keyBase}-${k++}`} style={{ fontFamily: display(600) }}>{isLabel ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w}</Text>);
      last = m.index + w.length;
    }
    out.push(chunk.slice(last));
    return out;
  };
  if (mathsSecondary || mathsMiddle) {
    const rows = text.split(/(?=\b(?:support|challenge)\s*:)/i).map((x) => x.trim()).filter(Boolean);
    if (rows.length > 1) return <View style={{ gap: 8 }}>{rows.map((r, i) => <P t={t} key={i}>{render(r, i)}</P>)}</View>;
  }
  return <P t={t}>{render(text, 0)}</P>;
}

function ALegacyCard({ t, it }) {
  return (
    <View>
      <Text style={[type.label, { color: t.ink_soft }]}>{qtypeName(it.item_type)}</Text>
      <P t={t} style={{ marginTop: 6 }}>{it.prompt}</P>
      {it.options && it.options.length ? it.options.map((o, k) => <View key={k} style={s.row}><Text style={[s.lab, { color: t.ink_soft }]}>{k + 1}.</Text><P t={t} style={{ flex: 1 }}>{o}</P></View>) : null}
      {it.answer ? <P t={t} style={{ marginTop: 8 }}>Answer: {it.answer}</P> : null}
      {it.teacher_guide && it.teacher_guide.length ? <ABlock t={t} k="LOOK FOR" text={it.teacher_guide.join(" · ")} /> : null}
    </View>
  );
}

const TabNav = ({ t, label, onPress }) => onPress ? (
  <Pressable onPress={onPress} hitSlop={6} style={{ alignSelf: "flex-end", marginTop: 12 }}><Text style={[type.small, { color: t.pine }]}>{label} →</Text></Pressable>
) : null;

function AssessBody({ t, it, tab, qn, onNext, onTab, mathsMiddle, mathsSecondary }) {
  const n = it.normalized;
  const lo = n ? n.linked_lo : ((it.meta && it.meta.linked_lo) || it.implied_lo);
  const nextQ = onNext ? <TabNav t={t} label="Next question" onPress={onNext} /> : null;
  const qmark = qn ? <Text style={[s.qmark, { color: t.clay }]}>Q{qn}.</Text> : null;
  if (!n || !n.template) {
    return (
      <View>{qmark}
        {lo ? <Look t={t}><K t={t}>LEARNING OUTCOME</K><P t={t}>{lo}</P></Look> : null}
        <ALegacyCard t={t} it={it} />
      </View>
    );
  }
  const set = itemTabSet(n);
  const { opts, correct, sets } = set;
  const hasTab = (id) => set.tabs.some(([x]) => x === id);
  const tabNav = (id, label) => (onTab && hasTab(id) ? <TabNav t={t} label={label} onPress={() => onTab(id)} /> : null);
  return (
    <View>
      {qmark}
      {tab === "ov" ? <AOverviewPanel t={t} n={n} lo={lo} nav={tabNav("q", "Question")} /> : null}
      {tab === "q" ? <AQuestionPanel t={t} n={n} opts={opts} sets={sets} nav={tabNav("an", "Answer")} /> : null}
      {tab === "an" ? <View><AAnswerPanel t={t} n={n} correct={correct} opts={opts} sets={sets} />{nextQ}</View> : null}
      {tab === "inc" ? <View><InclusivityText t={t} text={n.inclusivity} mathsMiddle={mathsMiddle} mathsSecondary={mathsSecondary} />{nextQ}</View> : null}
    </View>
  );
}

export default function AssessPanel({ t, items, assessment }) {
  const g = String((assessment && assessment.grade) || "").toLowerCase().replace(/grade|class/g, "").trim();
  const mathsMiddle = assessment && assessment.subject === "mathematics" && ["vi", "vii", "viii"].includes(g);
  const mathsSecondary = assessment && assessment.subject === "mathematics" && ["ix", "x"].includes(g);
  const [at, setAt] = useState(0);
  const [itab, setITab] = useState("ov");
  const idx = Math.min(at, items.length - 1);
  const many = items.length > 1;
  const it = items[idx];
  const n = it && it.normalized;
  const set = n && n.template ? itemTabSet(n) : null;
  const tab = set && set.tabs.some(([id]) => id === itab) ? itab : "ov";
  const goto = (i) => { setAt(i); setITab("ov"); };
  if (!it) return null;
  return (
    <View>
      <View style={[s.stick, { borderBottomColor: t.line }]}>
        {many ? (
          <View style={s.pager}>
            <Pressable disabled={idx <= 0} onPress={() => goto(idx - 1)} hitSlop={6}><Text style={[type.small, { color: t.pine, opacity: idx <= 0 ? 0.35 : 1 }]}>← Previous</Text></Pressable>
            <Text style={[type.mono, { fontSize: 12, color: t.ink_soft }]}>Question {idx + 1} / {items.length}</Text>
            <Pressable disabled={idx >= items.length - 1} onPress={() => goto(idx + 1)} hitSlop={6}><Text style={[type.small, { color: t.pine, opacity: idx >= items.length - 1 ? 0.35 : 1 }]}>Next →</Text></Pressable>
          </View>
        ) : null}
        {set ? (
          <View style={s.mtabs} accessibilityRole="tablist">
            {set.tabs.map(([id, label]) => (
              <Pressable key={id} onPress={() => setITab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}
                style={[s.mt, { borderColor: tab === id ? t.pine : t.edge, backgroundColor: tab === id ? t.tint_pine : "transparent" }]}>
                <Text style={[type.small, { color: tab === id ? t.pine : t.ink_soft }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <AssessBody key={idx} t={t} it={it} tab={tab} qn={many ? idx + 1 : null} mathsMiddle={mathsMiddle} mathsSecondary={mathsSecondary}
        onNext={many && idx < items.length - 1 ? () => goto(idx + 1) : null} onTab={setITab} />
    </View>
  );
}

const s = StyleSheet.create({
  stick: { paddingBottom: 10, marginBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mtabs: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  mt: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  qmark: { fontFamily: "Fraunces_600SemiBold", fontSize: 18, marginBottom: 8 },
  look: { marginTop: 14 },
  tick: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 4 },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 6 },
  lab: { fontFamily: "IBMPlexMono_500Medium", fontSize: 13, lineHeight: 24, minWidth: 20 },
  qchip: { fontFamily: "IBMPlexMono_500Medium", fontSize: 10, borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, lineHeight: 16, marginTop: 4 },
  ovrow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  scaf: { borderWidth: 1, borderRadius: 8, padding: 12 },
  passage: { borderLeftWidth: 3, padding: 12, borderRadius: 6, marginBottom: 10 },
  td: { paddingVertical: 7, paddingHorizontal: 10, minWidth: 100 },
  popBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  popBox: { borderWidth: 1, borderRadius: 12, padding: 18, width: "100%", maxWidth: 420 },
});
