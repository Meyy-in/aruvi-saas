/* ───────── the teaching profile, one edit at a time (Track D step 5c/5d) ─────────
 *
 * ★ ONE ROUTE, MANY INTENTS — the shape the web itself arrived at. `TeachingProfile.jsx` is
 * 1,700 lines because it is a dozen screens under one roof, reached by `portalIntent`; every
 * spot edit she can make (a class, a section, periods a week, the period lengths, the annual
 * budget) is the SAME journey with a different destination. The phone takes that structure
 * rather than a route per edit: `/profile?intent=budget&subject=…&grade=…` today, and 5d's
 * `ppw`, `duration`, `section` and `class` intents land here beside it. A route per edit would
 * have meant a save path, a scope resolver and an exit rule copied five times.
 *
 * Today it serves ONE intent, `budget` — a port of the web's budget step, `renderBudgetStep`
 * reached through `editNums` with `step: "budget"`.
 *
 * ★ ONE INPUT, BECAUSE SHE IS DISAGREEING, NOT BUILDING (founder, 2026-08-27). There used to be
 * four ways to construct the figure — teaching weeks · period count · working days · estimate —
 * and they existed because Aruvi could not tell her what her year should be. The calibrated
 * master plan ended that: Aruvi says 245 for social_sciences·ix, and she is answering "I say
 * 215". That is one number. The full account, and the four shapes the READER still understands,
 * are in @aruvi/shared/budget.
 *
 * ★ THE WEEKS LINE IS THE REASON THE OTHER THREE COULD GO. It gives her the weeks those methods
 * were clumsily trying to provide, without a second input to contradict the first: she types 215,
 * Aruvi says "27 weeks (@ 8 periods/week)", and she can tell at once whether that is her year.
 * A READING, not a sentence (founder, 2026-08-28) — it sits in the small mono of a caption
 * directly under the figure it describes. Aruvi adjusts NOTHING on her behalf.
 *
 * ★ AND SAVE SITS WELL CLEAR OF IT (same day): 88px of air above the footer, because the gap is
 * what separates "what I am being told" from "what I am about to do".
 *
 * ★ THE SENSE-CHECK PENCIL IS WHY THIS SCREEN IS NOT YET REACHABLE (founder, Q1, 2026-09-15).
 * The web's weeks line carries a second pencil, through to periods-a-week and then durations —
 * "if the weeks look wrong because the ppw is wrong, go and fix that side". Asked whether to
 * ship the budget screen without it as a named divergence or hold until the ppw editor exists,
 * the founder chose HOLD. So this screen is complete and the Year Plan's pencil stays dark
 * (`lessons.jsx`), and both light together when 5d's numbers editor lands and the pencil below
 * leads somewhere. A screen whose own control leads nowhere is the thing 4b held the outer
 * pencil back for; shipping it one level down would only have moved the dead end.
 *
 * ★ SHE IS RETURNED TO THE PANE SHE CAME FROM, on save AND on cancel (`lib/paneIntent`). The
 * pencil is reached only from the Year Plan; a return that landed on the card list would make it
 * a one-way door out of the pane it belongs to.
 */
import { useEffect, useMemo, useState } from "react";
import { View, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "../../components/Text";
import {
  classNum, getJSON, getUser, pretty, subjectSlug, weeksFromAnnual,
} from "@aruvi/shared/format";
import { normalizeBudget, setGradeBudget, gradeBudgetRecord, clampPeriods } from "@aruvi/shared/budget";
import { cachedReadiness, fetchReadiness, saveReadiness } from "@aruvi/shared/readiness";
import { stampPane } from "../../lib/paneIntent";
import Bar from "../../components/Bar";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";

const DEFAULT_PPW = 6;   // wheels.jsx; the phone has no ppw wheel yet, so it is only a fallback

export default function ProfileScreen() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  /* `intent` is the destination; `subject`/`grade` the scope it acts on. The web resolves a
     scope through two pick screens when it is ambiguous — the Year Plan's pencil is the
     opposite case, "she is standing on Class 7's year plan", so it passes `exact` and both
     pick screens are skipped (`portalGradeIdxs`, 5d row 21). Today `budget` is the only
     intent, and an unrecognised one is treated as it. */
  const { intent = "budget", subject = "", grade = "" } = useLocalSearchParams();

  /* Seeded synchronously from the device copy, like every other screen on this app: her profile
     is already in module memory, so the figure is on screen before any network is consulted. */
  const [readiness, setReadiness] = useState(() => cachedReadiness());
  const [recTotal, setRecTotal] = useState(null);   // Aruvi's calibrated annual periods
  const [ncfTotal, setNcfTotal] = useState(null);   // the published NCF norm
  const [value, setValue] = useState(null);         // null until the record is normalized
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { fetchReadiness().then(setReadiness).catch(() => {}); }, []);

  const subjects = useMemo(() => (readiness && readiness.subjects) || [], [readiness]);
  const gradeRec = useMemo(() => {
    const sub = subjects.find((s) => s.name === subject);
    const want = String(grade || "").toLowerCase();
    return (sub && (sub.grades || []).find((g) => (g.grade || "").toLowerCase() === want)) || null;
  }, [subjects, subject, grade]);
  const ppw = (gradeRec && gradeRec.periods_per_week) || DEFAULT_PPW;

  // Aruvi's own recommendation for this subject·class — the figure she is invited to disagree with.
  useEffect(() => {
    if (!subject || !grade) return;
    let live = true;
    setRecTotal(null); setNcfTotal(null);
    getJSON(`/subjects/${subjectSlug(subject)}/${String(grade).toLowerCase()}/ncf-periods`)
      .then((d) => {
        if (!live || !d) return;
        setNcfTotal(d.ncf_total_periods != null ? d.ncf_total_periods : null);
        setRecTotal(d.recommended_total_periods != null ? d.recommended_total_periods : null);
      })
      .catch(() => { if (live) { setNcfTotal(null); setRecTotal(null); } });
    return () => { live = false; };
  }, [subject, grade]);

  /* ★ THE FIELD OPENS ON THE YEAR SHE ALREADY HAS, whatever shape it is stored in — that is the
     whole of `normalizeBudget`, and the conversion the old four-method `setMethod` never did (it
     replaced the value with a fresh default, which is how a calibrated 245 silently became 180).
     Seeded ONCE the record and the recommendation are both in: seeding earlier would open her on
     the ppw estimate and then jump under her when the calibrated figure arrived. */
  useEffect(() => {
    if (value != null || !gradeRec) return;
    const stored = gradeBudgetRecord(subjects, subject, grade);
    const hasChoice = stored && !(stored.method === "auto" && !stored.value);
    if (!hasChoice && recTotal == null) return;    // wait for Aruvi's figure to lead
    setValue(normalizeBudget(stored, ppw, recTotal).value);
  }, [gradeRec, subjects, subject, grade, ppw, recTotal, value]);

  const weeks = weeksFromAnnual(value, ppw);
  const recLine = recTotal != null
    /* ★ "based on general norms" (founder, 2026-08-28) — the figure is a calibrated standard for
       the CLASS, not a reading of HER year, and the line has to say so: she is being invited to
       disagree with it, which she cannot do if it sounds like a fact about her. */
    ? `Meyy recommends ${recTotal} periods a year based on general norms for this class.`
      + (ncfTotal != null && ncfTotal !== recTotal ? ` (NCF norm: ${ncfTotal})` : "")
    : ncfTotal != null ? `As per NCF, this class requires ${ncfTotal} periods.` : null;

  const leave = () => { stampPane("plan"); router.navigate("/lessons"); };

  /* ── SAVE ────────────────────────────────────────────────────────────────────────────
     The write itself is `saveReadiness` (@aruvi/shared/readiness), which owns the whole
     read-after-write doctrine — the POST throwing is not failure, an unreachable server is not
     failure, and only a verified MISMATCH is. Its three outcomes map onto exactly two things
     this screen does: leave, or stay and say so.
     ★ AND ON A MISMATCH SHE STAYS, LOOKING AT THE SERVER'S COPY. Sending her back to the Year
     Plan with a banner would put the message on one screen and the wrong number on another;
     the store has already adopted the server's array, so re-seeding the field from it is what
     makes the banner's sentence literally true of what she is reading. */
  const save = () => {
    if (saving || value == null) return;
    const next = setGradeBudget(subjects, subject, grade, value);
    setSaving(true); setErr("");
    saveReadiness(next).then(({ status, profile }) => {
      setSaving(false);
      setReadiness(profile);
      if (status !== "mismatch") { leave(); return; }
      setValue(null);                 // re-seeds from the adopted server copy
      setErr("That change didn’t save — this is your teaching profile as it stands.");
    }).catch(() => { setSaving(false); leave(); });
  };

  const step = (d) => setValue((v) => clampPeriods((Number(v) || 0) + d));

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar user={getUser()} />
      <ScrollView contentContainerStyle={ws.main} keyboardShouldPersistTaps="handled">
        <Text style={ws.kicker}>
          {pretty(subject)} · Class {classNum(grade)} · annual budget
        </Text>
        {/* No sub-hint (founder, 2026-08-27). It restated the heading in longer words, and the
            screen already answers it twice more below: the weeks reading, then Aruvi's figure. */}
        <Text style={ws.fr_q}>How many periods for the year?</Text>

        {/* ★ THE BANNER SITS ABOVE THE FIGURE, AND OUTSIDE THE LOADING SPLIT. It is raised on a
            mismatch, and a mismatch is exactly when `value` is cleared so the field can re-seed
            from the server's copy — so written INSIDE the `value != null` branch it could never
            once appear, which is how it was first written. A message about a value cannot live
            in a subtree that only exists when the value does.
            `role="alert"` on the web; `assertive` is its RN counterpart, so a teacher using a
            screen reader hears that the number under her has changed rather than being left
            with a figure she did not type. */}
        {err ? (
          <View style={[ws.tp_savefail, { borderColor: t.edge_clay, backgroundColor: t.paper_2 }]}
            accessibilityLiveRegion="assertive">
            <Text style={[ws.tp_savefail_t, { color: t.ink }]}>{err}</Text>
            <Pressable onPress={() => setErr("")} accessibilityRole="button" hitSlop={8}
              style={[ws.tp_savefail_btn, { borderBottomColor: t.edge_clay }]}>
              <Text style={[ws.tp_savefail_bt, { color: t.clay }]}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

        {value == null ? (
          <ActivityIndicator style={{ marginTop: 28 }} color={t.pine} />
        ) : (
          <>
            <View style={ws.tp_val_row}>
              <Pressable onPress={() => step(-1)} hitSlop={6} accessibilityRole="button"
                accessibilityLabel="Fewer periods"
                style={[ws.tp_val_btn, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
                <Text style={ws.tp_val_btn_t}>−</Text>
              </Pressable>
              {/* `selectTextOnFocus` so tapping replaces the year rather than making her clear it
                  digit by digit — the prepare screen's stepper made the same call. */}
              <TextInput value={String(value)} keyboardType="number-pad" selectTextOnFocus
                onChangeText={(v) => setValue(v === "" ? "" : clampPeriods(parseInt(v, 10)))}
                onBlur={() => setValue((v) => clampPeriods(v))}
                accessibilityLabel="Annual period budget"
                style={[ws.tp_val_input, { borderColor: t.line, backgroundColor: t.paper_2 }]} />
              <Pressable onPress={() => step(1)} hitSlop={6} accessibilityRole="button"
                accessibilityLabel="More periods"
                style={[ws.tp_val_btn, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
                <Text style={ws.tp_val_btn_t}>+</Text>
              </Pressable>
              <Text style={ws.tp_val_unit}>periods / year</Text>
            </View>

            {/* The sense-check, directly under the figure it reads. Advisory, never corrective. */}
            {weeks && ppw > 0 ? (
              <Text style={ws.tp_weeks}>{weeks} weeks (@ {ppw} periods/week)</Text>
            ) : null}
            {recLine ? <Text style={ws.tp_estimate_sub}>{recLine}</Text> : null}

            <View style={ws.fr_foot}>
              <Pressable onPress={save} disabled={saving} accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
                style={[ws.fr_cta, { backgroundColor: saving ? t.paper_sunk : t.pine }]}>
                {saving
                  ? <ActivityIndicator size="small" color={t.ink_soft} />
                  : <Text style={[ws.fr_cta_t, ws.fr_cta_ink]}>Save</Text>}
              </Pressable>
              <Pressable onPress={leave} accessibilityRole="button" hitSlop={8} style={ws.fr_link}>
                <Text style={ws.fr_link_t}>Cancel</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
