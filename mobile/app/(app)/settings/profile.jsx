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
 * button to add subject is missing in expo"). It appeared on the web only inside edit mode,
 * because there the pencil revealed TWO things and removal was the other; the phone has no
 * removal, so a toggle would have hidden its one door behind a control with nothing else to
 * offer. ✅ **AND THE WEB FOLLOWED THE SAME DAY** ("remove the pencil in web app and let us think
 * of better way to delete subject") — its pencil is gone, its add row simply shows, and the two
 * surfaces now agree. The web keeps `applyRemoveSubject` and its two-step confirm in place,
 * unreachable, because the cascade is the expensive part; the trigger is what was removed.
 * ⚠️ IT MATTERS MORE HERE THAN ON THE WEB, because the phone's "+" portal carries four rows —
 * Class · Section · Periods a week · Annual budget — and deliberately no Subject row. Until this
 * landed, a teacher holding entitlement for a subject she had not set up could not set it up on
 * the phone at all: the same dead end that stranded account 1000000002 on the web, arrived at
 * from the other side.
 *
 * ★ REMOVING A SUBJECT IS BEING REDESIGNED, on both surfaces (founder, 2026-09-16). It is the
 * most destructive act in the profile — classes, sections, bookmarks and chapter bindings go with
 * it — and it is getting a control of its own rather than a corner of a toggle that also meant
 * "add". ⚠️ Until it arrives there IS still one door on this app, and it is not a gap: unticking
 * a subject's LAST class removes the subject, and the confirm says so in those words
 * ("No class is left — English goes with it"). "+" → Class → untick all.
 *
 * ★ NO HEADING. The frozen Settings bar reads "⚙ Teaching profile" — the web deleted its own
 * `h1` when that bar landed, and the phone never ports one back in (components/SettingsBar.jsx).
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { cachedReadiness, fetchReadiness, subscribeReadiness } from "@aruvi/shared/readiness";
import { classCard, profileStats, subjectPpw } from "@aruvi/shared/profile";
import { entitlementState, subscribeEntitlement } from "@aruvi/shared/entitlement";
import { primeSubjectCatalogue } from "../../../components/ProfileEditor";
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

/* The empty slot at the foot of the list. ★ ADDING A SUBJECT IS SUBSCRIBING TO ONE (founder,
   2026-09-18): it opens the in-app subscribe wizard, whose checkout lands the subject with Meyy's
   defaults — the set-up check then asks about them. Same door as the web's row. */
function AddSubjectRow() {
  const { t } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/subscribe")}
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
    /* ★ WARM THE SUBJECT CATALOGUE WHILE SHE READS. She is looking at the list the add row sits
       under, which is both the moment she is most likely to be about to tap it and the moment the
       network is least in her way — so the window opens on an answer rather than on "Loading
       subjects…" being replaced a quarter of a second later. Fire and forget; once per launch. */
    primeSubjectCatalogue();
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
        /* ⚠️ The invitation only holds while there is something to accept it with. A LAPSED
           teacher gets no add row, so "add a subject to begin" would point at nothing — the
           profile is a reading room for her, and it should say so by not asking. */
        <>
          <Text style={[ws.tp_empty, { color: t.ink_soft, marginBottom: 14 }]}>
            {canAdd ? "No profile yet — add a subject to begin." : "No profile yet."}
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
                      {/* ★ "0 periods / week" IS NOT A WEEK (2026-09-17). A subject she owns
                          now survives losing its last class, so an empty record is a state she
                          can be looking at — and an arithmetic zero reads as a defect where the
                          plain fact reads as her own doing. The web says the same words. */}
                      <Text style={[ws.tp_sub_ppw, { color: t.pine_d }]}>
                        {(s.grades || []).length ? `${subjectPpw(s)} periods / week` : "No classes"}
                      </Text>
                      <Text style={[ws.tp_caret, { color: open ? t.pine_d : t.ink_soft }]}>
                        {open ? "▾" : "▸"}
                      </Text>
                    </View>
                  </Pressable>

                  {open && !(s.grades || []).length ? (
                    <Text style={[ws.fr_hint, { color: t.ink_soft }]}>
                      You teach no class of {s.name} at the moment. Its lessons are kept, and it
                      stays here for as long as you subscribe to it. To teach it again, add a class
                      under Class in the Add window from the bottom tool bar.
                    </Text>
                  ) : null}

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
