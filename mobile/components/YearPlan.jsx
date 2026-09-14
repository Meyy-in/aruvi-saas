/* ───────── YearPlan — the whole teaching year for ONE subject·class (Track D step 4b) ─────────
 *
 * A port of `web/app/components/YearPlan.jsx`, 1:1 in structure, copy and arithmetic. It answers
 * the one question My Lessons' per-chapter cards can't — "across all my chapters and my finite
 * annual periods, how does the year shape up, and how much have I committed so far?" — and it
 * reaches the teacher exactly where the web puts it: the "Year plan" half of My Lessons' paired
 * switch, inheriting that screen's Subject·Class scope.
 *
 * Two period figures, side by side, both computed HERE:
 *   · Suggested — her annual budget distributed across chapters by chapter weight
 *     (`largestRemainder`, whole periods, sums to budget). Client-side so it always reconciles
 *     to the budget with no extra call, and — the point — so the phone and the web run the SAME
 *     function over the same inputs. A second implementation is how the 2026-08-21 defect
 *     happened (Year Plan said 14 where the chapter step said 19); `@aruvi/shared/format` is the
 *     one copy and both surfaces call it.
 *   · Your plan — the periods she actually set when she prepared each lesson (prepared_periods
 *     from /plans). A class-level COMMITMENT, not classroom execution.
 *
 * What it deliberately does NOT show is the web's list unchanged: no competencies or weightages
 * (those live in the LP at chapter level), and no effort-index VALUES (an internal calibration
 * signal, meaningless to a teacher — its information survives only as its consequence, raw
 * periods).
 *
 * ⚠️ TWO CONTROLS FROM THE WEB'S TOTALS ROW ARE NOT PORTED YET, each for its own reason, named
 * here as CLAUDE.md §4 requires:
 *   · the budget PENCIL (`onEditBudget`) — it opens the teaching profile's budget step, and the
 *     profile portal is Track D step 5. A pencil that leads nowhere is worse than no pencil, and
 *     it is the same call step 4a made about the picker's "prepare a new one" footer. The prop is
 *     accepted and threaded so step 5 is a one-line wiring, not a re-port.
 *   · the WORD EXPORT — the web downloads a blob through an anchor with `download`, which has no
 *     counterpart here: saving a file on a phone is expo-file-system + expo-sharing, a native
 *     dependency and a founder decision about where a document lands (Files? the share sheet?).
 *     The server route is unchanged and waiting; this is a deliberate hold, not an oversight.
 * With both absent the totals row carries no controls at all, so `.yp-tot-l` is plain text here
 * and the export's status line (`.yp-export-msg`) has nothing to say and does not render.
 *
 * Measures live in theme/web.js under `yp_*` (§4 rule 2).
 */
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { annualBudgetPeriods, getJSON, largestRemainder, pad } from "@aruvi/shared/format";
import { fetchPlans } from "@aruvi/shared/plans";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export default function YearPlan({ subjectName, sSlug, gSlug, readiness, onEditBudget }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const [chapters, setChapters] = useState(null);   // null = loading, [] = none
  const [plans, setPlans] = useState([]);
  const [err, setErr] = useState(false);

  /* Scoped fetch: chapters (weights + the calibrated per-chapter recommendation) and this
     teacher's prepared plans (for the committed periods). The plans half goes through the SHARED
     STORE, so this pane costs nothing when My Lessons has already read the same subject·class —
     which it always has, since the switch is how you get here. Reset on subject/class change. */
  useEffect(() => {
    if (!sSlug || !gSlug) return;
    let live = true;
    setChapters(null); setPlans([]); setErr(false);
    Promise.all([
      getJSON(`/subjects/${sSlug}/${gSlug}/chapters`),
      fetchPlans(`${sSlug}/${gSlug}`).then((p) => ({ plans: p })).catch(() => ({ plans: [] })),
    ])
      .then(([ch, pl]) => {
        if (!live) return;
        setChapters(Array.isArray(ch.chapters) ? ch.chapters : []);
        setPlans(Array.isArray(pl.plans) ? pl.plans : []);
      })
      .catch(() => { if (live) { setErr(true); setChapters([]); } });
    return () => { live = false; };
  }, [sSlug, gSlug]);

  const model = useMemo(() => {
    const chs = (chapters || []).slice()
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

    /* Committed ("Your plan") periods per chapter, from prepared plans. prepared_periods can be
       null on legacy prepares — such a chapter counts as prepared (it shows "set") but adds
       nothing to the committed total, so the ledger only ever reflects periods she actually set. */
    const committedByCh = {};
    const preparedSet = new Set();
    (plans || []).forEach((p) => {
      if (!p.prepared) return;
      preparedSet.add(p.chapter_number);
      if (p.prepared_periods != null) committedByCh[p.chapter_number] = p.prepared_periods;
    });

    /* Budget: her configured annual budget; fall back to Aruvi's CALIBRATED year total when
       unset. `recommended_periods` is the master plan's per-chapter figure, with the API itself
       falling back to the NCF estimate where no master-plan row exists, so this one field is the
       single number the whole product defaults to. */
    const recSum = chs.reduce((s, c) => s + (c.recommended_periods || 0), 0);
    let budget = annualBudgetPeriods(readiness, sSlug, gSlug);
    if (!budget) budget = recSum || null;

    const weights = chs.map((c) => (typeof c.weight === "number" && c.weight > 0 ? c.weight : 0));
    const wSum = weights.reduce((a, b) => a + b, 0);
    const sugByCh = {};
    if (budget && wSum > 0) {
      const dist = largestRemainder(budget, weights);
      chs.forEach((c, i) => { sugByCh[c.chapter_number] = dist[i]; });
    } else {
      chs.forEach((c) => { sugByCh[c.chapter_number] = c.recommended_periods ?? null; });
    }

    const rows = chs.map((c) => {
      const cn = c.chapter_number;
      return {
        n: cn,
        title: c.chapter_title || "",
        /* Budgeted but unpublished — the API titles these "Book awaited" and flags them. They
           belong here: her year is 18 chapters whether or not the books have shipped, and their
           periods are already held in the budget. They just can't carry a plan, so the "not yet"
           pending tag is suppressed below — it isn't waiting on HER. */
        awaited: !!c.placeholder,
        sug: sugByCh[cn] ?? null,
        plan: committedByCh[cn] ?? null,
        prepared: preparedSet.has(cn),
      };
    });

    const committedTotal = Object.values(committedByCh).reduce((a, b) => a + b, 0);
    const sugTotal = rows.reduce((s, r) => s + (r.sug || 0), 0);
    return { rows, budget, committedTotal, sugTotal };
  }, [chapters, plans, readiness, sSlug, gSlug]);

  if (chapters === null) {
    return <Text style={ws.yp_loading}>Loading your year…</Text>;
  }
  if (err && !model.rows.length) {
    return <Text style={ws.yp_loading}>Couldn’t load the year plan just now. Please try again.</Text>;
  }
  if (!model.rows.length) {
    return <Text style={ws.yp_loading}>No chapters found for {subjectName}.</Text>;
  }

  const { rows, budget, committedTotal, sugTotal } = model;
  const Dash = () => <Text style={ws.yp_dash}>—</Text>;

  return (
    <View style={ws.yp}>
      {/* ★ THE TABLE IS RAISED OFF THE PAGE (founder, 2026-08-30): "there is lack of
          differentiation between the table and the rest". One wrapper, so the column header, the
          chapter rows and the totals read as ONE object on its own plane, with the prose note
          left outside on the page where it belongs.
          The web's head is `position: sticky` within the pane's scroll region; here the pane
          scrolls inside My Lessons' own ScrollView and RN has no sticky-within-a-child, so the
          header simply travels with its rows. Named as a divergence: nothing moves position, the
          column labels just don't pin. */}
      <View style={[ws.yp_table, { backgroundColor: t.card_bg, borderColor: t.edge }]}>
        {/* Column header — the last line of the web's frozen head. All three are plain labels
            (the disclosure chevron went in 2026-08-27 with the note it used to hide). The plan
            label breaks over two lines, which is what keeps this header level with the other
            two cells. */}
        <View style={[ws.yp_colhd, { borderBottomColor: t.line }]}>
          <Text style={[ws.yp_c, ws.yp_c_chap]}>Chapter</Text>
          <Text style={[ws.yp_c, ws.yp_c_sug]}>Suggested periods</Text>
          <Text style={[ws.yp_c, ws.yp_c_plan]}>Your{"\n"}plan</Text>
        </View>

        {rows.map((r) => (
          <View key={r.n}
            style={[ws.yp_row, { borderBottomColor: t.line }, !r.prepared && !r.awaited && ws.yp_row_pend]}>
            <View style={ws.yp_cell_ch}>
              <Text style={ws.yp_cn}>{pad(r.n)}</Text>
              <Text style={[ws.yp_cname, r.awaited && ws.yp_cname_await]} numberOfLines={3}>
                {r.title}
              </Text>
            </View>
            <Text style={ws.yp_sug}>{r.sug != null ? String(r.sug) : "—"}</Text>
            <View style={ws.yp_planw}>
              {r.awaited ? (
                <Dash />
              ) : r.plan != null ? (
                <Text style={ws.yp_plan}>{r.plan}</Text>
              ) : r.prepared ? (
                <Text style={ws.yp_set}>set</Text>
              ) : (
                <>
                  <Dash />
                  <Text style={ws.yp_pend}>not yet</Text>
                </>
              )}
            </View>
          </View>
        ))}

        {/* Totals. The web hangs the budget pencil and the export in this row's label cell —
            both deliberately absent here (see the header), so the label is plain. */}
        <View style={[ws.yp_tot, { borderBottomColor: t.ink }]}>
          <Text style={ws.yp_tot_l}>Total periods</Text>
          <Text style={[ws.yp_tot_n, ws.yp_c_sug]}>{sugTotal}</Text>
          <Text style={[ws.yp_tot_n, ws.yp_c_plan]}>{committedTotal}</Text>
        </View>
      </View>

      {/* ★ THE NOTE SITS BELOW THE TOTALS AND ALWAYS SHOWS (founder, 2026-08-27). It explains the
          figures directly above it, so it reads in the order the eye moves: table, total, then
          what the total means. It was a collapsed disclosure under the column header, which is
          why the budget figure could not be found. */}
      <Text style={ws.yp_note}>
        Your teaching year at a glance — how{budget != null ? <> a budget of <Text style={ws.yp_note_b}>{budget} periods</Text></> : <> your periods</>} spread
        across all {rows.length} chapters. <Text style={ws.yp_note_b}>Suggested periods</Text> is Meyy’s proposal, giving heavier chapters more
        room. Each time you prepare a lesson you set your own periods for that chapter; those appear
        in <Text style={ws.yp_note_b}>Your plan</Text>, beside the suggestion, so you can see where you’ve adjusted and how much of
        the year you’ve committed. To know how Meyy suggests, refer to Ask Meyy time allocation section.
      </Text>
    </View>
  );
}
