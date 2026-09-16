/* ───────── Settings › Teaching profile — the accordion (6d; TeachingProfile.jsx:1491-1660) ─────
 *
 * What a teacher has told Meyy she teaches, laid out to be READ: four headline tiles, one row per
 * subject, one card per class inside the open row. Nothing here is stored — every number is
 * derived from `readiness` each time it is drawn, which is the only way a profile screen cannot
 * go stale.
 *
 * ★ THE ARITHMETIC IS NOT IN THIS FILE, and that is deliberate. `profileStats`, `subjectPpw` and
 * `classCard` live in `@aruvi/shared/profile` and the WEB WAS CHANGED IN THE SAME COMMIT to read
 * them too. "41 periods a week" is a claim about her working life; a phone that counted sections
 * where the web counted classes would not look broken on either surface — it would simply tell
 * her two different things about one account, with no way to know which was right.
 *
 * ★ READ-ONLY, BY SCOPE (founder, 2026-09-16). The web's header also carries a pencil that opens
 * edit mode: per-subject dustbins and "+ add a subject". Neither is here yet, because both lead
 * into families the phone has not built — the subjects wheel, the classes wheel and the per-class
 * run — and the dustbin without the "+" is the exact shape the web tried on 2026-08-27 and
 * retired the same week: "a control that promises editing and delivers only deletion is a trap".
 * So the phone offers the reading and not the half. Everything a teacher can CHANGE is already
 * reachable from the bar's "+" — class, section, periods a week, annual budget.
 * ⚠️ WITH ONE GAP, AND IT IS A REAL ONE: the "+" portal has no Subject row, so on the phone there
 * is today NO door to add a subject at all. On the web that dead end is what stranded account
 * 1000000002 — she removed her way down to one subject and found the way back gone, with
 * entitlement for four more sitting unused. Recorded in the map under §H; it wants the subjects
 * wheel, not a button here.
 *
 * ★ NO HEADING. The frozen Settings bar reads "⚙ Teaching profile" — the web deleted its own
 * `h1` when that bar landed, and the phone never ports one back in (components/SettingsBar.jsx).
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { cachedReadiness, fetchReadiness, subscribeReadiness } from "@aruvi/shared/readiness";
import { classCard, profileStats, subjectPpw } from "@aruvi/shared/profile";
import { Text } from "../../../components/Text";
import { useTheme } from "../../../theme/ThemeContext";
import { useWebStyles } from "../../../theme/web";

/* One headline tile. The label is set in mono at 8px — small, but it is a caption under a 19px
   figure and never the thing being read. */
function Stat({ n, label }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <View style={[ws.tp_stat, { backgroundColor: t.paper_2, borderColor: t.line_soft }]}>
      <Text style={[ws.tp_stat_n, { color: t.ink }]} numberOfLines={1} adjustsFontSizeToFit>{n}</Text>
      <Text style={[ws.tp_stat_l, { color: t.ink_soft }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

/* A class card: its name, its section chips, and the two value lines. Both lines come from
   `classCard` — including their em-dashes, which are what an unset budget looks like. */
function ClassCard({ cc, first }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    /* The open header already rules its own bottom edge, so the FIRST card must not draw a
       second one 1px under it (`.tp-sub.open > .tp-sub-hd + .tp-classcard`). */
    <View style={[ws.tp_classcard, { borderTopColor: t.line_soft }, first && { borderTopWidth: 0 }]}>
      <View style={ws.tp_cc_hd}>
        <Text style={[ws.tp_cc_name, { color: t.pine_d }]} numberOfLines={1}>{cc.className}</Text>
        <View style={ws.tp_cc_right}>
          <Text style={[ws.tp_cc_seclbl, { color: t.ink_soft }]}>Sections</Text>
          <View style={ws.tp_chips}>
            {cc.chips.map((c) => (
              /* The tag rides in the accessibility label, which is what a screen reader
                 announces — the web's `title` said the same thing for the same reason. */
              <Text key={c.sec} accessibilityLabel={`Section ${c.tag}`}
                style={[ws.tp_chip, { backgroundColor: t.pine, color: "#f2f7f4" },
                        c.named && ws.tp_chip_named]}>
                {c.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
      <View style={ws.tp_cc_cols}>
        <View>
          {/* "per section" is load-bearing, not decoration: the subject row above sums the
              sections, so without it a class of three reading "8 × 45 min" makes the 24 up
              there look like a mistake. */}
          <Text style={[ws.tp_cc_col_l, { color: t.ink_soft }]}>Periods / week per section</Text>
          <Text style={[ws.tp_cc_col_v, { color: t.ink }]}>{cc.perWeek}</Text>
        </View>
        <View>
          <Text style={[ws.tp_cc_col_l, { color: t.ink_soft }]}>Annual budget</Text>
          <Text style={[ws.tp_cc_col_v, { color: t.ink }]}>{cc.annual}</Text>
        </View>
      </View>
    </View>
  );
}

export default function TeachingProfileScreen() {
  const { t } = useTheme();
  const ws = useWebStyles();

  /* Paint from the device copy, then re-read. `cachedReadiness()` is synchronous by design, so a
     returning teacher never sees this screen empty on its way to being right.
     ⚠️ `useFocusEffect`, not `useEffect`: Settings subviews are PUSHED on top of the home list and
     never unmount, so a mount-only read would go stale the moment she changed a section through
     the "+" and came back — which is the one thing a teacher is most likely to do right after
     looking at this screen. Settings home learnt this on 2026-09-16; so does this. */
  const [readiness, setReadiness] = useState(() => cachedReadiness());
  useFocusEffect(useCallback(() => {
    let live = true;
    const off = subscribeReadiness((r) => { if (live) setReadiness(r); });
    fetchReadiness().catch(() => {});      // unreachable server → the device copy stands
    return () => { live = false; off(); };
  }, []));

  const subjects = (readiness && readiness.subjects) || [];
  const stats = profileStats(subjects);

  /* ONE open at a time, and nothing open to begin with — the web's own behaviour. A teacher
     opening this screen is answering "what have I set up?", and four expanded subjects is the
     stats block restated at four times the length. */
  const [openSubject, setOpenSubject] = useState(null);

  return (
    <ScrollView contentContainerStyle={[ws.main, { paddingTop: 12 }]}>
      {subjects.length === 0 ? (
        /* The web adds "— add a subject to begin", which is true there because its next line is
           the row that does it. Here there is no such row (see the header), so the sentence stops
           where the phone can actually deliver. */
        <Text style={[ws.tp_empty, { color: t.ink_soft }]}>No profile yet.</Text>
      ) : (
        <>
          <View style={ws.tp_stats}>
            <Stat n={stats.subjects} label="Subjects" />
            <Stat n={stats.classes} label="Classes" />
            <Stat n={stats.sections} label="Sections" />
            <Stat n={stats.ppw} label="Periods / week" />
          </View>

          <View style={{ marginTop: 16 }}>
            {subjects.map((s) => {
              const open = s.name === openSubject;
              return (
                <View key={s.name}
                  style={[ws.tp_sub, { backgroundColor: t.paper_2,
                                       borderColor: open ? t.edge_green : t.line_soft }]}>
                  <Pressable onPress={() => setOpenSubject(open ? null : s.name)}
                    accessibilityRole="button" accessibilityState={{ expanded: open }}
                    style={[ws.tp_sub_hd,
                            open && ws.tp_sub_hd_open,
                            open && { backgroundColor: t.tint_pine, borderBottomColor: t.edge_green }]}>
                    {/* The clay spine. A View rather than a pseudo-element, inset 13 top and
                        bottom exactly as the web's ::before is. */}
                    {open ? <View style={[ws.tp_spine, { backgroundColor: t.clay }]} /> : null}
                    <View style={ws.tp_sub_left}>
                      <Text style={[ws.tp_sub_name, { color: open ? t.pine_d : t.ink }]}
                        numberOfLines={1}>{s.name}</Text>
                    </View>
                    <View style={ws.tp_sub_side}>
                      {/* Per SECTION and multiplied up, like the headline tile — see
                          `gradePpw` in shared/profile. */}
                      <Text style={[ws.tp_sub_ppw, { color: t.pine_d }]}>
                        {subjectPpw(s)} periods / week
                      </Text>
                      <Text style={[ws.tp_caret, { color: open ? t.pine_d : t.ink_soft }]}>
                        {open ? "▾" : "▸"}
                      </Text>
                    </View>
                  </Pressable>

                  {open ? (s.grades || []).map((g, gi) => {
                    const cc = classCard(s, gi);
                    return cc ? <ClassCard key={g.grade} cc={cc} first={gi === 0} /> : null;
                  }) : null}
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}
