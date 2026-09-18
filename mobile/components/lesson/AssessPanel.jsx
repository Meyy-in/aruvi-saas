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
import { View, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { Text } from "../Text";
import Svg, { Line, Path, Polygon, Text as SvgText, SvgXml } from "react-native-svg";

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
/* the web's .assess-look block: uppercase mono key, then the text */
const K = ({ ws, children }) => <Text style={ws.assess_look_k}>{children}</Text>;
const P = ({ ws, children, style }) => <Text style={[ws.assess_look_t, style]}>{children}</Text>;
const Look = ({ ws, children }) => <View style={ws.assess_look}>{children}</View>;

function ABlock({ ws, t, k, text }) {
  if (!text) return null;
  return <Look ws={ws} t={t}><K ws={ws} t={t}>{k}</K><P ws={ws} t={t}>{text}</P></Look>;
}
function ATicks({ ws, t, k, items }) {
  if (!items || !items.length) return null;
  return (
    <Look ws={ws} t={t}><K ws={ws} t={t}>{k}</K>
      {items.map((x, i) => <View key={i} style={ws.assess_tick}><Text style={ws.assess_tickmark}>✓</Text><P ws={ws} t={t} style={{ flex: 1 }}>{x}</P></View>)}
    </Look>
  );
}
function APartsList({ ws, t, lead, parts }) {
  return (
    <View>
      {lead ? <P ws={ws} t={t} style={{ marginBottom: 6 }}>{lead}</P> : null}
      {parts.map((p, i) => (
        <View key={i} style={ws.assess_ansrow}>
          {p.marker ? <Text style={ws.assess_ans_lab}>{p.marker}</Text> : null}
          <P ws={ws} t={t} style={{ flex: 1 }}>{p.text}</P>
        </View>
      ))}
    </View>
  );
}
function AAnswerBlock({ ws, t, k, n }) {
  if (!n || !n.model_answer) return null;
  if (!n.answer_parts || !n.answer_parts.length) return <ABlock ws={ws} t={t} k={k} text={n.model_answer} />;
  return <Look ws={ws} t={t}><K ws={ws} t={t}>{k}</K><APartsList ws={ws} t={t} lead={n.answer_lead} parts={n.answer_parts} /></Look>;
}
function AScaffold({ ws, t, n }) {
  if (!n.scaffold) return null;
  const lines = n.scaffold_lines;
  if (!lines || !lines.length) return <ABlock ws={ws} t={t} k="SCAFFOLD" text={n.scaffold} />;
  return (
    <Look ws={ws} t={t}><K ws={ws} t={t}>SCAFFOLD</K>
      <View style={ws.assess_scaf}>
        {lines.map((ln, i) => ln ? <Text key={i} style={ws.assess_scaf_row}>{ln}</Text> : <View key={i} style={{ height: 10 }} />)}
      </View>
    </Look>
  );
}

/* ── typed visual stimulus ── */
function ANumberLine({ ws, t, nl }) {
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
          <SvgText key={`l${i}`} x={x(i)} y={y + 20} fontSize={11} fill={t.ink_soft} textAnchor="middle" fontFamily="IBMPlexMono_400Regular">{tk.label || ""}</SvgText>
        ))}
        {ticks.map((_, i) => <Line key={`t${i}`} x1={x(i)} y1={y - 6} x2={x(i)} y2={y + 6} stroke={t.ink} strokeWidth={1.5} />)}
      </Svg>
      {nl.instruction ? <Text style={ws.assess_look_t}>{nl.instruction}</Text> : null}
    </View>
  );
}
function ATyped({ ws, t, b, passage = false }) {
  if (!b || !b.content) return null;
  if (b.type === "svg") return <View style={{ marginVertical: 8 }}><SvgXml xml={b.content} width="100%" /></View>;
  if (b.type === "number_line" && b.number_line) return <ANumberLine ws={ws} t={t} nl={b.number_line} />;
  if (b.type === "table" && b.table) {
    const header = b.table.header || [];
    return (
      <View style={{ marginVertical: 8 }}>
        {b.table.caption ? <Text style={[ws.assess_look_t, { marginBottom: 6 }]}>{b.table.caption}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 6, overflow: "hidden" }}>
            {header.length ? <View style={{ flexDirection: "row", backgroundColor: t.paper_sunk }}>{header.map((c, i) => <Text key={i} style={[ws.assess_ovk, s.td]}>{c}</Text>)}</View> : null}
            {(b.table.rows || []).map((r, i) => (
              <View key={i} style={{ flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }}>
                {r.map((c, j) => <Text key={j} style={[ws.assess_look_t, s.td, { marginTop: 0 }]}>{c}</Text>)}
              </View>
            ))}
          </View>
        </ScrollView>
        {b.table.source_note ? <Text style={[ws.assess_look_t, { color: t.ink_soft }]}>{b.table.source_note}</Text> : null}
      </View>
    );
  }
  return passage
    ? <View style={ws.assess_passage}><Text style={ws.assess_passage_t}>{b.content}</Text></View>
    /* The web's `.assess-vs-prose` — the SAME green box as a passage, upright (app. 06 row 105;
       it was a bare paragraph here). */
    : <View style={ws.assess_passage}><Text style={ws.assess_vs_prose_t}>{b.content}</Text></View>;
}

/* ── the four sub-panels ── */
function AOverviewPanel({ ws, t, n, lo, nav }) {
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
        <View key={i} style={ws.assess_ovlo}>
          <Text style={ws.assess_ovk}>{k}</Text>
          <Text style={ws.assess_ovlo_t}>{v}</Text>
          {i === rows.length - 1 ? nav : null}
        </View>
      ))}
    </View>
  );
}

function OptList({ ws, t, opts, showKey = "label" }) {
  return (
    <View style={ws.assess_opts2}>
      {opts.map((o, i) => (
        <View key={i} style={ws.assess_opt}>
          <Text style={ws.assess_opt_lab}>{o[showKey]}</Text>
          <Text style={ws.assess_opt_t}>{o.text}</Text>
        </View>
      ))}
    </View>
  );
}

function AQuestionPanel({ ws, t, n, opts, sets, nav }) {
  const isTF = n.template === "true_false" && n.tf_statements && n.tf_statements.length;
  const interleaved = !!(sets && !isTF && n.stem_parts && n.stem_parts.length === sets.length);
  const [otgOpen, setOtgOpen] = useState(false);
  return (
    <View>
      {n.template === "passage" ? <ATyped ws={ws} t={t} b={n.passage} passage /> : null}
      {isTF ? (
        <View>
          {n.stem_lead || n.stem ? <P ws={ws} t={t} style={{ marginBottom: 6 }}>{n.stem_lead || n.stem}</P> : null}
          {n.tf_statements.map((st, i) => (
            <View key={i} style={ws.assess_ansrow}>{st.marker ? <Text style={ws.assess_ans_lab}>{st.marker}</Text> : null}<P ws={ws} t={t} style={{ flex: 1 }}>{st.text}</P></View>
          ))}
        </View>
      ) : interleaved ? (
        <View>
          {n.stem_lead ? <P ws={ws} t={t} style={{ marginBottom: 6 }}>{n.stem_lead}</P> : null}
          {sets.map((set, si) => (
            <View key={set.group} style={{ marginBottom: 12 }}>
              <View style={ws.assess_ansrow}>{n.stem_parts[si].marker ? <Text style={ws.assess_ans_lab}>{n.stem_parts[si].marker}</Text> : null}<P ws={ws} t={t} style={{ flex: 1 }}>{n.stem_parts[si].text}</P></View>
              <OptList ws={ws} t={t} opts={set.opts} showKey="display" />
            </View>
          ))}
        </View>
      ) : n.stem_parts && n.stem_parts.length ? (
        <APartsList ws={ws} t={t} lead={n.stem_lead} parts={n.stem_parts} />
      ) : <Text style={ws.assess_prompt}>{n.stem}</Text>}

      {/* ★ A LISTENING PASSAGE IS A DIFFERENT KIND OF THING (app. 06 row 101). It rendered as one
          more grey sentence in the flow, so the teacher had to READ that this question needs
          something PLAYED. The web marks it: a 3px pine left rule, an equaliser glyph, and the
          reference in mono beside the prose. Same three parts here. */}
      {n.audio_ref ? (
        <View style={[ws.assess_audio, { borderLeftColor: t.pine }]}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={t.ink}
            strokeWidth={2} strokeLinecap="round">
            <Path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 11v2" />
          </Svg>
          <Text style={ws.assess_audio_t}>
            <Text style={{ fontFamily: "Newsreader_400Regular_Italic" }}>Listening passage</Text>
            {" — "}<Text style={ws.assess_audio_ref}>{n.audio_ref}</Text>, read aloud
          </Text>
        </View>
      ) : null}
      <ATyped ws={ws} t={t} b={n.visual_stimulus} />
      {opts.length && !isTF && !interleaved ? (
        sets ? sets.map((set) => (
          <View key={set.group} style={{ marginTop: 8 }}>
            <Text style={ws.assess_ovk}>Question {set.group}</Text>
            <OptList ws={ws} t={t} opts={set.opts} showKey="display" />
          </View>
        )) : <OptList ws={ws} t={t} opts={opts} />
      ) : null}
      <ATicks ws={ws} t={t} k="WHAT TO PRODUCE" items={n.format_of_output} />
      <AScaffold ws={ws} t={t} n={n} />
      {n.open_task_guide ? (
        <View style={ws.assess_look}>
          <Pressable onPress={() => setOtgOpen((o) => !o)} hitSlop={6}><Text style={ws.assess_look_k}>{otgOpen ? "▾" : "▸"} READING THIS TASK</Text></Pressable>
          {otgOpen ? (
            <View style={{ marginTop: 6 }}>
              <ABlock ws={ws} t={t} k="FORMAT" text={[n.open_task_guide.format_type, n.open_task_guide.format_rationale].filter(Boolean).join(" — ")} />
              <ABlock ws={ws} t={t} k="WHAT THIS DEMONSTRATES" text={n.open_task_guide.what_this_demonstrates} />
              <ABlock ws={ws} t={t} k="READING THE SCAFFOLD" text={n.open_task_guide.reading_the_scaffold} />
            </View>
          ) : null}
        </View>
      ) : null}
      {n.exercise_ref || n.exercise_desc ? (
        <Look ws={ws} t={t}><K ws={ws} t={t}>TEXTBOOK EXERCISE</K>
          <P ws={ws} t={t}>
            {n.exercise_ref ? <Text style={ws.assess_book_item}>{n.exercise_ref}</Text> : null}
            {n.exercise_ref && n.exercise_desc ? " — " : null}
            {n.exercise_desc ? (/^["'“‘]/.test(n.exercise_desc.trim()) ? n.exercise_desc : `“${n.exercise_desc.trim()}”`) : null}
          </P>
        </Look>
      ) : null}
      {nav}
    </View>
  );
}

function AReveals({ ws, t, reveals, opts = [], sets = null }) {
  const entries = Object.entries(reveals || {});
  const [shown, setShown] = useState(null);
  if (!entries.length) return null;
  const optFor = (lab) => opts.find((o) => o.label === lab) || null;
  const setFor = (lab) => (sets && sets.find((st) => st.opts.some((x) => x.label === lab))) || null;
  const shownLab = (lab) => { const st = setFor(lab); return st ? st.opts.find((x) => x.label === lab).display : lab; };
  const popped = shown ? optFor(shown) : null;
  return (
    <Look ws={ws} t={t}><K ws={ws} t={t}>WHAT EACH CHOICE REVEALS</K>
      {entries.map(([lab, txt], i) => lab === "note" ? <P ws={ws} t={t} key={i}>{txt}</P> : (
        <View key={i} style={ws.assess_revrow}>
          {setFor(lab) ? <Text style={ws.assess_corr_q}>Q{setFor(lab).group}</Text> : null}
          <Text style={ws.assess_rev_lab}>{shownLab(lab)}</Text>
          <P ws={ws} t={t} style={{ flex: 1, marginTop: 0 }}>
            {txt}{optFor(lab) ? <Text onPress={() => setShown(lab)} style={ws.assess_rev_choice}>Choice {shownLab(lab)}</Text> : null}
          </P>
        </View>
      ))}
      {popped ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShown(null)}>
          <Pressable style={s.popBg} onPress={() => setShown(null)}>
            <Pressable style={[s.popBox, { backgroundColor: t.paper_2, borderColor: t.edge }]} onPress={() => {}}>
              <Pressable onPress={() => setShown(null)} hitSlop={10} accessibilityLabel="Close" style={{ alignSelf: "flex-start" }}><Text style={{ color: t.ink_soft }}>✕</Text></Pressable>
              <Text style={[ws.assess_look_k, { marginTop: 8 }]}>{setFor(shown) ? `Question ${setFor(shown).group} · ` : ""}Choice {shownLab(shown)}</Text>
              <P ws={ws} t={t} style={{ marginTop: 6 }}>{popped.text}</P>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </Look>
  );
}

function AAnswerPanel({ ws, t, n, correct, opts = [], sets = null }) {
  if (n.template === "true_false" && n.tf_statements && n.tf_statements.length) {
    const hasReasons = n.tf_statements.some((st) => st.reason);
    if (!hasReasons && n.model_answer) return <ABlock ws={ws} t={t} k="SUGGESTED ANSWER" text={n.model_answer} />;
    return (
      <Look ws={ws} t={t}><K ws={ws} t={t}>ANSWER KEY</K>
        {n.tf_statements.map((st, i) => (
          <View key={i} style={ws.assess_ansrow}>
            {st.marker ? <Text style={ws.assess_ans_lab}>{st.marker}</Text> : null}
            <P ws={ws} t={t} style={{ flex: 1, marginTop: 0 }}><Text style={{ fontFamily: "Newsreader_600SemiBold", color: st.verdict ? t.pine : t.clay }}>{st.verdict ? "True" : "False"}</Text>{st.reason ? ` — ${st.reason}` : ""}</P>
          </View>
        ))}
      </Look>
    );
  }
  const tpl = n.template;
  return (
    <View>
      {correct.length ? (
        <Look ws={ws} t={t}><K ws={ws} t={t}>CORRECT ANSWER</K>
          {correct.map((o, i) => {
            const set = sets && sets.find((st) => st.opts.some((x) => x.label === o.label));
            const shown = set ? set.opts.find((x) => x.label === o.label).display : o.label;
            return (
              <View key={i} style={ws.assess_corr_row}>
                {set ? <Text style={ws.assess_corr_q}>Q{set.group}</Text> : null}
                <Text style={ws.assess_opt_lab}>{shown}</Text>
                <P ws={ws} t={t} style={{ flex: 1, marginTop: 0 }}>{o.text}<Text style={ws.assess_tickmark}> ✓</Text></P>
              </View>
            );
          })}
        </Look>
      ) : null}
      {tpl === "selected_response" ? <><AAnswerBlock ws={ws} t={t} k="ANSWER" n={n} /><AReveals ws={ws} t={t} reveals={n.option_reveals} opts={opts} sets={sets} /></>
      : tpl === "scr" ? <>{n.model_answer ? <AAnswerBlock ws={ws} t={t} k="SUGGESTED ANSWER" n={n} /> : <ATicks ws={ws} t={t} k="LOOK FOR" items={n.expected_elements} />}<ABlock ws={ws} t={t} k="METHOD" text={n.method_one_line} /></>
      : tpl === "ecr" ? <><ATicks ws={ws} t={t} k="LOOK FOR" items={n.look_fors} /><ATicks ws={ws} t={t} k="EXPECTED ELEMENTS" items={n.expected_elements} /><AAnswerBlock ws={ws} t={t} k="SUGGESTED ANSWER" n={n} /><ABlock ws={ws} t={t} k="METHOD" text={n.method_one_line} /></>
      : tpl === "open_task" ? <><ATicks ws={ws} t={t} k="EXPECTED ELEMENTS" items={n.expected_elements} /><ATicks ws={ws} t={t} k="LOOK FOR" items={n.look_fors} /></>
      : tpl === "cloze_match" ? <AAnswerBlock ws={ws} t={t} k="ANSWER KEY" n={n} />
      : tpl === "match" ? (n.match_pairs && n.match_pairs.length ? (
          <Look ws={ws} t={t}><K ws={ws} t={t}>ANSWER KEY</K>
            {n.match_pairs.map((p, i) => <View key={i} style={ws.assess_ansrow}><P ws={ws} t={t} style={{ flex: 1 }}>{p.left}</P><Text style={{ color: t.ink_soft }}>→</Text><P ws={ws} t={t} style={{ flex: 1 }}>{p.right}</P></View>)}
          </Look>) : <AAnswerBlock ws={ws} t={t} k="ANSWER KEY" n={n} />)
      : tpl === "oral" ? <ATicks ws={ws} t={t} k="SPEAKING RUBRIC" items={n.expected_elements} />
      : tpl === "numeric" ? <><AAnswerBlock ws={ws} t={t} k="WORKED ANSWER" n={n} /><ABlock ws={ws} t={t} k="METHOD" text={n.method_one_line} /></>
      : tpl === "passage" ? <ATicks ws={ws} t={t} k="EXPECTED ELEMENTS" items={n.expected_elements} />
      : null}
    </View>
  );
}

function InclusivityText({ ws, t, text, mathsMiddle, mathsSecondary }) {
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
      out.push(<Text key={`${keyBase}-${k++}`} style={ws.assess_inc_strong}>{isLabel ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w}</Text>);
      last = m.index + w.length;
    }
    out.push(chunk.slice(last));
    return out;
  };
  if (mathsSecondary || mathsMiddle) {
    const rows = text.split(/(?=\b(?:support|challenge)\s*:)/i).map((x) => x.trim()).filter(Boolean);
    if (rows.length > 1) return <View style={{ gap: 8 }}>{rows.map((r, i) => <Text style={ws.assess_inc} key={i}>{render(r, i)}</Text>)}</View>;
  }
  return <Text style={ws.assess_inc}>{render(text, 0)}</Text>;
}

/* ★ A LEGACY ITEM KEEPS THE OLD CARD, AND THE CARD HAD NO CHROME (app. 06 row 94). Flat items
   sit on the unit's paper (2026-07-10), but items authored before that still render as the white,
   green-edged card `.assess-card` — that is what tells a teacher she is looking at an older
   item rather than a mis-styled new one. The phone drew a bare View, so the distinction was
   invisible. ⚠️ `#fff` literally, not `t.paper`: the web hard-codes white here in BOTH themes,
   because the card's whole job is to read as a pasted-in object from another era. */
function ALegacyCard({ ws, t, it }) {
  return (
    <View style={[ws.assess_card, { borderColor: t.edge_green }]}>
      <Text style={ws.assess_qtype}>{qtypeName(it.item_type)}</Text>
      <Text style={ws.assess_prompt}>{it.prompt}</Text>
      {it.options && it.options.length ? it.options.map((o, k) => <View key={k} style={ws.assess_opt}><Text style={ws.assess_opt_lab}>{k + 1}.</Text><Text style={ws.assess_opt_t}>{o}</Text></View>) : null}
      {it.answer ? <P ws={ws} t={t} style={{ marginTop: 8 }}>Answer: {it.answer}</P> : null}
      {it.teacher_guide && it.teacher_guide.length ? <ABlock ws={ws} t={t} k="LOOK FOR" text={it.teacher_guide.join(" · ")} /> : null}
    </View>
  );
}

const TabNav = ({ ws, t, label, onPress }) => onPress ? (
  <Pressable onPress={onPress} hitSlop={6}><Text style={ws.assess_tabnav}>{label} →</Text></Pressable>
) : null;

/* ★ THE FORWARD NAV SHARES THE PANEL'S LAST ROW (app. 06 row 95). It was pinned to its own
   right-aligned line (`alignSelf: "flex-end"`), which on a short answer left a whole empty row
   between the words and the link. The web wraps content and nav in ONE flex row that WRAPS
   (`.assess-qnavwrap`): a short last row keeps the link beside it, a full one pushes it below —
   still right — which is the behaviour the bordered `.assess-nextq-wrap` was retired for in
   2026-07-16. ⚠️ The main column must be `flex: 1` with `minWidth: 0`, or a long word refuses to
   wrap and shoves the link off the edge. */
const QNavWrap = ({ ws, children, nav }) => (nav ? (
  <View style={ws.assess_qnavwrap}>
    <View style={ws.assess_qnavmain}>{children}</View>
    {nav}
  </View>
) : <View>{children}</View>);

function AssessBody({ ws, t, it, tab, qn, onNext, onTab, mathsMiddle, mathsSecondary }) {
  const n = it.normalized;
  const lo = n ? n.linked_lo : ((it.meta && it.meta.linked_lo) || it.implied_lo);
  const nextQ = onNext ? <TabNav ws={ws} t={t} label="Next question" onPress={onNext} /> : null;
  const qmark = qn ? <Text style={ws.assess_qmark}>Q{qn}.</Text> : null;
  if (!n || !n.template) {
    return (
      <View>{qmark}
        {lo ? <View style={ws.assess_look}><Text style={ws.assess_lo_k}>LEARNING OUTCOME</Text><P ws={ws} t={t}>{lo}</P></View> : null}
        <ALegacyCard ws={ws} t={t} it={it} />
      </View>
    );
  }
  const set = itemTabSet(n);
  const { opts, correct, sets } = set;
  const hasTab = (id) => set.tabs.some(([x]) => x === id);
  const tabNav = (id, label) => (onTab && hasTab(id) ? <TabNav ws={ws} t={t} label={label} onPress={() => onTab(id)} /> : null);
  return (
    <View style={ws.assess_flat}>
      {qmark}
      {tab === "ov" ? <AOverviewPanel ws={ws} t={t} n={n} lo={lo} nav={tabNav("q", "Question")} /> : null}
      {tab === "q" ? <AQuestionPanel ws={ws} t={t} n={n} opts={opts} sets={sets} nav={tabNav("an", "Answer")} /> : null}
      {tab === "an" ? (
        <QNavWrap ws={ws} nav={nextQ}>
          <AAnswerPanel ws={ws} t={t} n={n} correct={correct} opts={opts} sets={sets} />
        </QNavWrap>
      ) : null}
      {tab === "inc" ? (
        <QNavWrap ws={ws} nav={nextQ}>
          <InclusivityText ws={ws} t={t} text={n.inclusivity} mathsMiddle={mathsMiddle} mathsSecondary={mathsSecondary} />
        </QNavWrap>
      ) : null}
    </View>
  );
}

export default function AssessPanel({ ws, t, items, assessment }) {
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
      <View style={{ backgroundColor: t.paper }}>
        {many ? (
          <View style={ws.uv_apager}>
            <Pressable disabled={idx <= 0} onPress={() => goto(idx - 1)} hitSlop={6}><Text style={[ws.uv_apgbtn, idx <= 0 && ws.uv_apgbtn_off]}>← Previous</Text></Pressable>
            <Text style={ws.uv_apgmid}>Question {idx + 1} / {items.length}</Text>
            <Pressable disabled={idx >= items.length - 1} onPress={() => goto(idx + 1)} hitSlop={6}><Text style={[ws.uv_apgbtn, idx >= items.length - 1 && ws.uv_apgbtn_off]}>Next →</Text></Pressable>
          </View>
        ) : null}
        {set ? (
          <View style={ws.assess_mtabs} accessibilityRole="tablist">
            {set.tabs.map(([id, label]) => (
              <Pressable key={id} onPress={() => setITab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}
                style={[ws.assess_mt, tab === id && ws.assess_mt_on]}>
                <Text style={[ws.assess_mt_t, tab === id && ws.assess_mt_on_t]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <AssessBody key={idx} ws={ws} t={t} it={it} tab={tab} qn={many ? idx + 1 : null} mathsMiddle={mathsMiddle} mathsSecondary={mathsSecondary}
        onNext={many && idx < items.length - 1 ? () => goto(idx + 1) : null} onTab={setITab} />
    </View>
  );
}

const s = StyleSheet.create({
  td: { paddingVertical: 7, paddingHorizontal: 10, minWidth: 100 },
  popBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  popBox: { borderWidth: 1, borderRadius: 12, padding: 18, width: "100%", maxWidth: 420 },
});
