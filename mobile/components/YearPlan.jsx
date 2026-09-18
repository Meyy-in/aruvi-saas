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
 * ★ THE BUDGET PENCIL IS LIVE (Track D step 5d, 2026-09-15). It was held back TWICE, each time
 * for the same reason and each time correctly: in 4b because it opened the teaching profile's
 * budget step and there was no profile on the phone — "a pencil that leads nowhere is worse than
 * no pencil", the same call 4a made about the picker's "prepare a new one" footer — and again
 * when the budget screen shipped, because that screen's OWN sense-check pencil led nowhere until
 * the numbers editor existed (founder, Q1: hold). Both ends are real now. It opens
 * a WINDOW over this pane (`openEdit`), so she does not leave the Year Plan at all — which is
 * what retired the one-shot pane stamp the round trip used to need.
 * It sits in the LABEL cell, as on the web, so the two numeric columns stay aligned with the
 * chapter rows above (founder, 2026-08-27: this is the row a teacher is actually reading when
 * she judges her year, and the label is the last thing her eye passes before the figures).
 *
 * ★ THE WORD EXPORT LANDED 2026-09-17 (step 7, app. 05 E8-E9) — the last control of the web's
 * totals row to arrive. It was held because saving a file on a phone is a native dependency AND
 * a founder decision about where the document goes; Q15 answered the second on 2026-09-16 (the
 * SHARE SHEET, because what a teacher does with a year plan is send it to a head of department),
 * and `lib/download.js` is the first. So the arrow now sits beside the pencil, as on the web:
 * both are things you do to the TABLE AS A WHOLE, and the totals row is where the table's own
 * controls live.
 * ★ AND IT POSTS THE PANE'S OWN MODEL. `sug` is computed in this file — her budget distributed
 * by chapter weight — so asking the server to rebuild it would be a SECOND implementation of
 * that arithmetic, and the day the two drift she holds a Word document contradicting the screen
 * she exported it from. That is the 2026-08-21 defect (Year Plan said 14 where the chapter step
 * said 19) reached through a new door, and the web closed it by not opening it. Same here: the
 * payload IS the render.
 *
 * Measures live in theme/web.js under `yp_*` (§4 rule 2).
 */
import { useEffect, useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "./Text";
import { annualBudgetPeriods, getJSON, largestRemainder, pad } from "@aruvi/shared/format";
import { useRouter } from "expo-router";
import { canPreview, downloadDocument, fetchDocument, yearPlanExport } from "../lib/download";
import { fetchPlans } from "@aruvi/shared/plans";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

/* Pencil (edit) — the web's own glyph, path for path (YearPlan.jsx / TeachingProfile.jsx). It is
   duplicated there rather than shared because a four-line SVG is not worth a module; the same
   judgement holds here, and copying the PATH DATA rather than redrawing it is what keeps the two
   surfaces the same mark. */
const Pencil = ({ size = 13, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 20h4L18.5 9.5a1.5 1.5 0 0 0 0-2.12l-1.88-1.88a1.5 1.5 0 0 0-2.12 0L4 16v4z" />
    <Path d="M13.5 6.5l4 4" />
  </Svg>
);

/* Export — an arrow LEAVING A TRAY, upward. The web's own glyph, path for path, and deliberately
   NOT the allocation report's file-page mark: that one sits beside a written "Word" label and can
   afford to name the FORMAT, where this one sits bare beside the pencil and must name the ACT.
   Upward rather than a download tray's downward arrow because the sense is "take this out of Meyy
   and away with me", not "pull something down into this device". Same 24-box and stroke weight as
   `Pencil`, so the pair reads as one set. */
const ExportIcon = ({ size = 13, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 15V3" />
    <Path d="M8 7l4-4 4 4" />
    <Path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </Svg>
);

export default function YearPlan({ subjectName, sSlug, gSlug, readiness, onEditBudget }) {
  const router = useRouter();
  const { t } = useTheme();
  const ws = useWebStyles();
  const [chapters, setChapters] = useState(null);   // null = loading, [] = none
  const [plans, setPlans] = useState([]);
  const [err, setErr] = useState(false);
  /* "" · "working" · "failed" — the web's own three states, and the reason it is one value rather
     than a busy flag beside an error string: a retry must clear the previous failure in the same
     tick it starts, or the line contradicts the arrow. */
  const [exporting, setExporting] = useState("");
  const [exportErr, setExportErr] = useState("");

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

  /* ★ THE PAYLOAD IS THE RENDER — see the header. Every field the web sends, in the web's own
     shape, because the server is the same server and the document must not be able to tell which
     surface asked for it. */
  const downloadWord = () => {
    if (exporting === "working") return;
    setExporting("working"); setExportErr("");
    const doc = yearPlanExport({ sSlug, gSlug, payload: {
      subject: subjectName, grade: gSlug,
      budget: model.budget ?? null,
      generated_at: new Date().toISOString(),
      rows: model.rows.map((r) => ({
        n: r.n, title: r.title, sug: r.sug, plan: r.plan,
        prepared: !!r.prepared, awaited: !!r.awaited,
      })),
      sug_total: model.sugTotal, plan_total: model.committedTotal,
    } });
    /* ★ SHOWN BEFORE IT IS SENT (founder, 2026-09-18) — the invoice and the lesson report's path:
       the preview screen, the share sheet a choice from its arrow. */
    (canPreview(doc.mime)
      ? fetchDocument(doc).then((f) => router.push({ pathname: "/preview",
          params: { uri: f.uri, name: f.name, mime: f.mime, label: `Year plan · ${subjectName}` } }))
      : downloadDocument(doc))
      .then(() => setExporting(""))
      .catch((e) => {
        /* The web's four sentences, chosen from the same two facts (`lib/download.js` puts the
           status and the server's own `detail` on the throw). 404 is not a broken export — it is
           an API process older than the route — and saying so is the only useful thing there is
           to say about it. */
        setExportErr(
          e?.status === 404 ? "This Meyy server doesn’t have the export yet."
            : e?.status === 501 ? "Word export isn’t available on this server."
            : e?.status ? `${e.status}${e.detail ? ` — ${e.detail}` : ""}`
            : "Couldn’t reach Meyy just now."
        );
        setExporting("failed");
      });
  };

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
  /* The web nests `.yp-dash` INSIDE the 19px `.yp-plan` / `.yp-sug` cell, so it overrides only
     colour and weight and inherits the size. Composed here rather than relied on. */
  const Dash = () => <Text style={[ws.yp_plan, ws.yp_dash]}>—</Text>;

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
      <View style={[ws.yp_table, { borderColor: t.edge }]}>
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
            {r.sug != null
              ? <Text style={ws.yp_sug}>{r.sug}</Text>
              : <Text style={[ws.yp_sug, ws.yp_dash]}>—</Text>}
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

        {/* Totals. The pencil rides in the label cell, as on the web; the export is the one
            control still held back (see the header).

            ★ THE LABEL VANISHED ON iOS AND THE CAUSE WAS `flex` ON THE LABEL, NOT THE BASELINE
            ROW (founder, 2026-09-15: "iPhone does not show 'Total periods' at the bottom of the
            table of Year plan. Expo does"). Recorded properly because I guessed twice and both
            guesses are the kind that sound right:
              1. `flex: 0` at the call site, to stop the label stretching. In Yoga that is grow 0
                 / shrink 0 / basis ZERO — the words collapsed. Caught on the web target.
              2. A wrapper View around label + pencil, with `flexBasis: "auto"`. My theory was
                 that `.yp-tot` aligns on the BASELINE and a wrapper View has no text baseline,
                 so iOS collapsed the cell. I shipped that and the founder said it was STILL
                 missing — so the baseline story, however plausible, was not the fault.
              3. What actually fixed it: taking `flex: 1` off `yp_tot_l` altogether. It was there
                 because the label cell is the web grid's `1fr`; once the pencil joined it, every
                 attempt to neutralise that flex FROM HERE was worse than not having it. Note
                 `flexBasis: "auto"` was the only flexBasis in the whole app — reaching for a
                 property nothing else needed was the signal I was fighting the wrong thing.
            The `1fr` is now an explicit spacer below, so the label is a plain label that sizes to
            its own words. The unwrapped, direct-child arrangement stayed: it is simpler and reads
            closer to the web's inline span, and the pencil's `alignSelf` is cheap insurance — but
            it is NOT what fixed this, and nobody should believe it was. */}
        <View style={[ws.yp_tot, { borderBottomColor: t.ink }]}>
          <Text style={ws.yp_tot_l} numberOfLines={1}>Total periods</Text>
          {onEditBudget ? (
            <Pressable onPress={onEditBudget} accessibilityRole="button" hitSlop={10}
              accessibilityLabel={`Change your annual period budget for ${subjectName}`}
              style={[ws.yp_budget_edit, { alignSelf: "center" }]}>
              <Pencil color={t.pine_d} />
            </Pressable>
          ) : null}
          {/* ★ THE EXPORT SITS BESIDE THE PENCIL (founder, 2026-08-30, ported 2026-09-17). It was
              a labelled button in its own row on the web first, on the reasoning that a download
              and an edit are different KINDS of act; that was the wrong unit of difference —
              both are things you do to the table as a whole, and two icons cost less height than
              a whole row, which is the scarce thing on a phone. Same treatment as the pencil, so
              the pair reads as a set rather than as one control and one decoration. */}
          <Pressable onPress={downloadWord} disabled={exporting === "working"}
            accessibilityRole="button" hitSlop={10}
            accessibilityState={{ disabled: exporting === "working" }}
            accessibilityLabel={`Download the ${subjectName} year plan table as a Word document`}
            style={[ws.yp_budget_edit, ws.yp_export_btn, { alignSelf: "center" },
                    exporting === "working" && { opacity: 0.45 }]}>
            <ExportIcon color={t.pine_d} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text style={[ws.yp_tot_n, ws.yp_c_sug]}>{sugTotal}</Text>
          <Text style={[ws.yp_tot_n, ws.yp_c_plan]}>{committedTotal}</Text>
        </View>
      </View>

      {/* The export's only words — and only while there are any. An icon button cannot say
          "preparing" or why it failed, and both must still be said, so they are said here, under
          the row the arrow sits on. Nothing renders when idle: a permanent caption explaining an
          icon is a sign the icon is wrong. It PUSHES the note down rather than overlapping it —
          never an alert covering the table she is trying to take away. */}
      {exporting === "working" ? (
        <Text style={ws.yp_export_msg}>Preparing your Word document…</Text>
      ) : exporting === "failed" ? (
        <Text accessibilityRole="alert" style={[ws.yp_export_msg, ws.yp_export_bad]}>
          Couldn’t download the year plan. {exportErr} Tap the arrow to try again.
        </Text>
      ) : null}

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
