/* ───────── the annual period budget, edited (Track D step 5c, 2026-09-15) ─────────
 *
 * The Year Plan's budget pencil, given somewhere to land. A port of the web's budget step —
 * `renderBudgetStep` in TeachingProfile.jsx, reached through `editNums` with `step: "budget"`.
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
 * ⚠️ ONE DIVERGENCE, named as CLAUDE.md §4 requires: the web's weeks line carries a PENCIL
 * through to the periods-a-week wheel — "if the weeks look wrong because the ppw is wrong, go
 * and fix that side". The phone has no periods-a-week editor yet; it arrives with the teaching
 * profile, which is a later step. So the line renders without it, rather than with a control
 * that leads nowhere. When the profile lands, that pencil is the first thing to restore here.
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
  API, classNum, getJSON, getUser, pretty, subjectSlug, weeksFromAnnual, withUser,
} from "@aruvi/shared/format";
import { normalizeBudget, setGradeBudget, gradeBudgetRecord, clampPeriods } from "@aruvi/shared/budget";
import { cachedReadiness, fetchReadiness, invalidateReadiness } from "@aruvi/shared/readiness";
import { verifiedWrite, readinessFingerprint } from "@aruvi/shared/verify";
import { stampPane } from "../../lib/paneIntent";
import Bar from "../../components/Bar";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";

const DEFAULT_PPW = 6;   // wheels.jsx; the phone has no ppw wheel yet, so it is only a fallback

export default function BudgetScreen() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  const { subject = "", grade = "" } = useLocalSearchParams();

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

  /* ── READ-AFTER-WRITE (founder doctrine, 2026-08-10; @aruvi/shared/verify) ──────────────
     Y is the subjects array she just composed, so we know it UPFRONT; Y′ is GET /readiness.
     Error IF AND ONLY IF Y′ ≠ Y. The POST throwing is not a criterion (a 200 can lie; a lost
     response can hide a write that landed), and an unreachable server is NOT an error — it is a
     state in which the check cannot be RUN, and presuming failure there would invent a fact.
     Hence three outcomes, and only the middle one speaks. The web's `persist` is the same call
     against the same endpoint; `cascade: true` rides along with it for the same reason. */
  const save = () => {
    if (saving || value == null) return;
    const next = setGradeBudget(subjects, subject, grade, value);
    setSaving(true); setErr("");
    const want = readinessFingerprint(next);
    // Optimistic locally, so the Year Plan she returns to is already showing her new year.
    setReadiness((r) => ({ ...(r || {}), subjects: next }));
    invalidateReadiness();
    verifiedWrite({
      write: () => fetch(`${API}/readiness`, withUser({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects: next, cascade: true }),
      })).then((r) => { if (!r.ok) throw new Error(String(r.status)); }),
      read: () => getJSON("/readiness").then((d) => (d && d.readiness) || d || {}),
      expect: (y) => readinessFingerprint(y.subjects) === want,
    }).then(({ status }) => {
      setSaving(false);
      if (status === "mismatch") {
        // Y′ is the truth. Keeping her edit on screen while telling her it failed would recreate
        // the exact divergence this check exists to catch, so she stays HERE and the figure
        // re-reads from the server rather than from what she typed.
        invalidateReadiness();
        fetchReadiness({ force: true }).then(setReadiness).catch(() => {});
        setValue(null);
        setErr("That didn’t save. Your year is shown as the server has it — try again.");
        return;
      }
      leave();
    }).catch(() => { setSaving(false); leave(); });   // unverified is silence, as on the web
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
            {err ? <Text style={[ws.tp_estimate_sub, { color: t.clay }]}>{err}</Text> : null}

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
