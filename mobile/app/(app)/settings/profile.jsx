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
 * ★ "+ ADD A SUBJECT" IS HERE, AND IT IS NOT BEHIND A PENCIL (founder, 2026-09-16: "the edit
 * button to add subject is missing in expo"). On the web this row appears only inside edit mode,
 * because there the pencil reveals TWO things and removal is the other one. The phone has no
 * removal yet, so a toggle would hide the one door behind a control with nothing else to offer —
 * and hiding the only way to add a subject is precisely the dead end being fixed. The web keeps
 * its toggle because it has a second reason to; this screen does not, so the row simply shows.
 * ⚠️ IT MATTERS MORE HERE THAN ON THE WEB, because the phone's "+" portal carries four rows —
 * Class · Section · Periods a week · Annual budget — and deliberately no Subject row. Until this
 * landed, a teacher holding entitlement for a subject she had not set up could not set it up on
 * the phone at all: the same dead end that stranded account 1000000002 on the web, arrived at
 * from the other side.
 *
 * ★ REMOVAL IS STILL NOT HERE, and that is the deliberate half. The web's dustbin takes a
 * subject's classes, sections, bookmarks and chapter bindings with it behind two confirms; it
 * ships when it ships, with its cascade tested. Adding without removing is a control that
 * promises adding and delivers adding — the shape the web retired on 2026-08-27 was the OTHER
 * way round ("a control that promises editing and delivers only deletion is a trap").
 *
 * ★ NO HEADING. The frozen Settings bar reads "⚙ Teaching profile" — the web deleted its own
 * `h1` when that bar landed, and the phone never ports one back in (components/SettingsBar.jsx).
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { cachedReadiness, fetchReadiness, subscribeReadiness } from "@aruvi/shared/readiness";
import { classCard, profileStats, subjectPpw } from "@aruvi/shared/profile";
import { entitlementState, subscribeEntitlement } from "@aruvi/shared/entitlement";
import { openEdit } from "../../../lib/portal";
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

/* The empty slot at the foot of the list. It opens the ONE Sheet the shell owns, on the subject
   step — the same window every other profile edit uses, so adding a subject is not a different
   kind of journey from changing a section. */
function AddSubjectRow() {
  const { t } = useTheme();
  const ws = useWebStyles();
  return (
    <Pressable onPress={() => openEdit({ intent: "subject" })}
      accessibilityRole="button" accessibilityLabel="Add a subject"
      style={[ws.tp_sub, { backgroundColor: t.paper_2, borderColor: t.line,
                           borderStyle: "dashed" }]}>
      <View style={ws.tp_sub_hd}>
        <Text style={[ws.tp_sub_name, { color: t.pine }]}>+ add a subject</Text>
      </View>
    </Pressable>
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

  /* ★ LAPSED MAKES THE PROFILE READ-ONLY (§2.5 as amended; the server refuses the write anyway).
     She keeps seeing what she teaches — that is the reading room — but the one control that would
     GROW the account goes, exactly as My Classes and the bar's "+" already do for her. */
  const [ent, setEnt] = useState(() => entitlementState());
  useEffect(() => subscribeEntitlement(setEnt), []);
  const canAdd = !ent.lapsed;

  return (
    <ScrollView contentContainerStyle={[ws.main, { paddingTop: 12 }]}>
      {subjects.length === 0 ? (
        /* The web adds "— add a subject to begin", which is true there because its next line is
           the row that does it. Here there is no such row (see the header), so the sentence stops
           where the phone can actually deliver. */
        <>
          <Text style={[ws.tp_empty, { color: t.ink_soft, marginBottom: 14 }]}>
            No profile yet — add a subject to begin.
          </Text>
          {canAdd ? <AddSubjectRow /> : null}
        </>
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
            {/* ★ AN EMPTY SUBJECT ROW, NOT A BUTTON (founder, 2026-08-30). A green pill said
                "here is a control"; the row says "here is where the next subject goes" — the same
                card, the same padding, the same display serif as every subject above it, so the
                list reads as a list with one slot still open. Two departures, both saying
                not-yet-a-subject: a DASHED edge (structure, never colour) and pine ink, because
                this is the one row here that ACTS rather than opens. No periods a week and no
                caret: it has neither. */}
            {canAdd ? <AddSubjectRow /> : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}
