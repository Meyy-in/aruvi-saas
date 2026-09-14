/* ───────── My Classes — the home screen (Track D step 3, 2026-09-12) ─────────
 *
 * The teaching loop's front door: one card per class the teacher handles (subject · grade ·
 * section, from her readiness profile). A class with an attached chapter shows CONTINUE —
 * the chapter title and where she stopped (unit N) — and opens it in LessonView with tracking.
 * Any other prepared chapter opens read-only. Section state is reconciled from the server on
 * load (pullSectionState), and a LOADING state holds until /plans arrives so no false
 * "pick a chapter" flashes on a real network (the live-walk finding, designed in).
 *
 * Plan status, theme and sign-out live at the foot for now; they move to Settings in step 6.
 * The section→lesson binding ("+") and the full My Lessons library are step 4. */
import { useEffect, useState, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet, RefreshControl } from "react-native";
import Svg, { Defs, Pattern, Path, Rect } from "react-native-svg";
import { Text } from "../../components/Text";
import { useRouter, useFocusEffect } from "expo-router";
import { getUser, getJSON, fetchEntitlement, subjectSlug } from "@aruvi/shared/format";
import { cachedPlans, fetchPlans, invalidatePlans } from "@aruvi/shared/plans";
import { endSession as endSessionShared } from "../../lib/session";
import { pullSectionState, readLocalSection, bindSectionChapter, unbindSection } from "@aruvi/shared/sectionState";
import { recordHistory, hasHistory } from "@aruvi/shared/sectionHistory";
import Bar from "../../components/Bar";
import { AttachSheet, UntrackSheet } from "../../components/AttachSheet";
import { useTheme } from "../../theme/ThemeContext";
import { useWebStyles } from "../../theme/web";
import { type } from "../../theme/type";

/* The web's pointerFor / unitsDoneFor, over the shared cache rather than window.localStorage.
   The stored pointer is 0-BASED; the rail and "unit N" are 1-based, and an ABSENT pointer means
   untouched — which is why a bound-but-unstarted chapter is still the sand "st-new" card. */
const pointerOf = (sectionKey) => {
  const raw = readLocalSection(sectionKey).unit;
  const n = Number(raw);
  return raw != null && raw !== "" && Number.isFinite(n) && n >= 0 ? n + 1 : null;
};
const unitsDone = (sectionKey) => {
  const n = Number(readLocalSection(sectionKey).unit);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const gradeSlug = (g) => (g || "").toLowerCase();
const classNo = (g) => (g || "").replace(/grade/i, "").trim().toUpperCase();
const dash = (v) => (v == null || v === "" ? "—" : String(v));

/* readiness → one entry per subject·grade·section */
function classesFrom(readiness) {
  const out = [];
  ((readiness && readiness.subjects) || []).forEach((s) => {
    const sSlug = subjectSlug(s.name);
    (s.grades || []).forEach((g) => {
      const gSlug = gradeSlug(g.grade);
      (g.sections || []).forEach((sec) => out.push({
        subjectName: s.name, subjectSlug: sSlug, grade: g.grade, gradeSlug: gSlug,
        sectionTag: sec.tag, sectionName: (sec.name || "").trim(),
        sectionKey: `${sSlug}_${gSlug}_${sec.tag}`,
      }));
    });
  });
  return out;
}

export default function Home() {
  const { t, pref, setPref } = useTheme();
  const ws = useWebStyles();
  const router = useRouter();
  const user = getUser();
  const [st, setSt] = useState({ loading: true, err: "", classes: [], plansBySG: {}, ent: null });
  const [tick, setTick] = useState(0);   // re-read local section state after returning from a lesson

  /* ★ ENDING THE SESSION IS ONE ACT, AND A 401 IS ONE OF ITS DOORS (2026-09-13).
     The web has held this since its own live check: "a 401 is not 'no profile' — the server
     REFUSED this session" (page.jsx), and it signs out on the spot. The phone only PRINTED
     "your sign-in has expired" and carried on rendering the shell, with getUser() reading the
     stale `aruvi_user` out of local storage — so an ERASED account went on announcing "signed
     in as 9000000003", over its own cached pointers and bookmarks, for ever. Found live after
     a real account deletion. The pieces were all here; nothing called them.
     Note it is only a 401 — an unreachable server is NOT a refusal and must never sign her
     out mid-lesson on a school network (the existing "couldn't reach Meyy" path). */
  const endSession = useCallback(() => endSessionShared(router), [router]);

  const load = useCallback(async ({ force = false } = {}) => {
    let err = "";
    const ent = await fetchEntitlement();
    let readiness = null;
    let refused = false;
    try { readiness = (await getJSON("/readiness"))?.readiness || null; }
    catch (e) {
      if (String(e.message) === "401") refused = true;
      else err = "Couldn't reach Meyy right now.";
    }
    if (refused) { await endSession(); return; }
    const classes = classesFrom(readiness);
    // reconcile every section's server state, then fetch plans for each distinct subject·grade
    if (classes.length) { try { await pullSectionState(classes.map((c) => c.sectionKey)); } catch {} }
    /* The listing comes from the SHARED STORE (@aruvi/shared/plans), which the web uses too —
       one copy per subject·class kept in module memory and on the device, one request in
       flight, and one revalidation per session unless something invalidated it. This screen
       remounts on every trip through the bottom bar, and without the store each trip re-read a
       list that had not moved (the web measured six such calls in one session). Pull-to-refresh
       passes force, which is the teacher's own "check again". */
    const plansBySG = {};
    await Promise.all([...new Set(classes.map((c) => `${c.subjectSlug}/${c.gradeSlug}`))].map(async (key) => {
      plansBySG[key] = {};
      const index = (rows) => { plansBySG[key] = {}; (rows || []).forEach((p) => { plansBySG[key][p.filename] = p; }); };
      index(cachedPlans(key));                 // synchronous: the cards can paint from this
      try { index(await fetchPlans(key, { force })); } catch {}
    }));
    setSt({ loading: false, err, classes, plansBySG, ent });
  }, [endSession]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { setTick((n) => n + 1); }, []));


  const openAttached = (c, plan) => router.push({ pathname: "/lesson",
    params: { subject: c.subjectSlug, grade: c.gradeSlug, filename: plan.filename, section: c.sectionTag } });

  /* ── the "+" / "−" binding (Track D step 4) — the web's MyPlans handlers, verbatim in effect.
     Every write goes through @aruvi/shared, so the phone and the web agree on disk and on the
     server; this screen only decides WHEN. `bump` forces the re-render that shows the new state
     at once: the card reads its binding from the local cache during render, so without it the
     card would only refresh on the next incidental render — the web's own "+ works late" lag. */
  const [attachFor, setAttachFor] = useState(null);    // { c, sectionKey }
  const [untrackFor, setUntrackFor] = useState(null);  // { c, sectionKey, plan }
  const bump = () => setTick((n) => n + 1);

  const attachChapter = (c, sectionKey, plan) => {
    bindSectionChapter(sectionKey, plan.filename);
    setAttachFor(null);
    bump();
    /* ★ THE ATTACH CHANGED THE LISTING, NOT JUST THE BINDING (2026-09-14) — the web has done
       this since MyPlans.jsx:548 and the phone had not caught up. It became visible with the
       speed work's part 3: `total_units` is now computed only for chapters she ACTUALLY HOLDS
       (api/main.py derives it from her bound files), so attaching is itself a payload change.
       Without the invalidation the store answers the next read from its `fresh` copy, where this
       chapter still has total_units = null — and the card renders with NO UNIT RAIL until the app
       is restarted and the once-per-session revalidation finally sees a different ETag.
       Invalidate, then re-read: the binding is already written locally, so the card is correct on
       screen throughout and the fetch only fills the rail in. A failed fetch changes nothing —
       the optimistic card stands, exactly as the web's does. */
    const key = `${c.subjectSlug}/${c.gradeSlug}`;
    invalidatePlans(key);
    fetchPlans(key)
      .then((rows) => setSt((prev) => {
        const byFile = {};
        (rows || []).forEach((p) => { byFile[p.filename] = p; });
        return { ...prev, plansBySG: { ...prev.plansBySG, [key]: byFile } };
      }))
      .catch(() => {});
  };
  /* Untracking logs a history row ONLY when at least one unit was done — the anti-noise gate, so
     a casual attach-then-untrack leaves no trace — and stamps how far the section got. */
  const untrackChapter = (sectionKey, plan) => {
    const done = unitsDone(sectionKey);
    if (plan && done >= 1) {
      recordHistory(sectionKey, {
        file: plan.filename, chapter_number: plan.chapter_number, chapter_title: plan.chapter_title,
        status: "untracked", units_done: done, total_units: plan.total_units || null, ts: Date.now(),
      });
    }
    unbindSection(sectionKey); setUntrackFor(null); bump();
  };
  /* A finished chapter has no progress to lose, so moving on needs no confirm: it frees the
     section and opens the picker for the next chapter. It always earns its history row. */
  const moveOnFromCompleted = (c, sectionKey, plan) => {
    if (plan) {
      recordHistory(sectionKey, {
        file: plan.filename, chapter_number: plan.chapter_number, chapter_title: plan.chapter_title,
        status: "completed", units_done: plan.total_units || null,
        total_units: plan.total_units || null, ts: Date.now(),
      });
    }
    unbindSection(sectionKey); setAttachFor({ c, sectionKey }); bump();
  };

  /* Every chapter bound to ANY section of this subject·class. A chapter she already teaches to
     9A is the ordinary thing to offer 9B, so the picker lets those through even though the
     plans listing marks only HER prepared ones. */
  const boundFilesForGrade = (sSlug, gSlug) => {
    const set = new Set();
    st.classes.forEach((c) => {
      if (c.subjectSlug !== sSlug || c.gradeSlug !== gSlug) return;
      const f = readLocalSection(c.sectionKey).chapter;
      if (f) set.add(f);
    });
    return set;
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar user={user} />
      {/* ★ THE GREETING (the web's .dash-hd). It is sticky on the web — pinned under the bar at
          the top of the one scroll region — so here it sits ABOVE the scroller, which is the
          same thing without a sticky. The "My classes" mono label that used to open this screen
          is GONE: the web has no such label, and two headers is worse than either. */}
      {!st.loading && !st.err ? <DashHead classes={st.classes} plansBySG={st.plansBySG} user={user} /> : null}
      {/* The header sits outside the scroller, so it takes main's 26px top padding with it and
          the scroller must not repeat it — otherwise the card list starts 26px too low. */}
      <ScrollView contentContainerStyle={[ws.main, (!st.loading && !st.err) && { paddingTop: 0 }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load({ force: true })} tintColor={t.pine} />}>

        {st.loading ? (
          <View style={s.loading}><ActivityIndicator color={t.pine} /><Text style={[type.small, { color: t.ink_soft, marginLeft: 10 }]}>Loading your classes…</Text></View>
        ) : st.err ? (
          <Text style={[type.body, { color: t.danger, marginTop: 18 }]}>{st.err}</Text>
        ) : st.classes.length === 0 ? (
          <Text style={[type.body, { color: t.ink_soft, marginTop: 14 }]}>No classes yet — set up your teaching profile (first run comes in a later step).</Text>
        ) : (
          <View style={ws.sc_list} key={tick}>
            {st.classes.map((c) => (
              <ClassCard key={c.sectionKey} c={c}
                plans={st.plansBySG[`${c.subjectSlug}/${c.gradeSlug}`] || {}}
                onOpen={openAttached}
                onAttach={() => setAttachFor({ c, sectionKey: c.sectionKey })}
                onUntrack={(plan) => setUntrackFor({ c, sectionKey: c.sectionKey, plan })}
                onMoveOn={(plan) => moveOnFromCompleted(c, c.sectionKey, plan)} />
            ))}
          </View>
        )}

        {/* foot — moves to Settings in step 6 */}
        {!st.loading && (
          <View style={[s.footcard, { borderTopColor: t.line }]}>
            {/* Identity and Log out moved to the bar (2026-09-13), where the web has always had
                them; what is left here is the trial counter and the appearance choice, both of
                which belong in Settings at step 6. */}
            <Text style={[type.small, { color: t.ink_soft }]}>
              {st.ent ? `${dash(st.ent.status)}${st.ent.enforced ? ` · ${dash(st.ent.trial_chapters_used)} of ${dash(st.ent.trial_chapter_cap)} trial chapters used` : ""}` : ""}
            </Text>
            <View style={s.segs}>
              {[["system", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([v, label]) => (
                <Pressable key={v} onPress={() => setPref(v)} style={[s.seg, { borderColor: t.edge, backgroundColor: pref === v ? t.tint_pine : t.paper_2 }]}>
                  <Text style={[type.small, { color: pref === v ? t.pine : t.ink }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <AttachSheet target={attachFor}
        plans={attachFor ? (st.plansBySG[`${attachFor.c.subjectSlug}/${attachFor.c.gradeSlug}`] || {}) : null}
        boundFile={attachFor ? readLocalSection(attachFor.sectionKey).chapter : null}
        alsoAttachable={attachFor ? boundFilesForGrade(attachFor.c.subjectSlug, attachFor.c.gradeSlug) : null}
        onAttach={attachChapter} onClose={() => setAttachFor(null)} />
      <UntrackSheet target={untrackFor} onUntrack={untrackChapter} onClose={() => setUntrackFor(null)} />
    </View>
  );
}

/* ───────── The greeting (the web's .dash-hd) ─────────
 * Time of day, and her name only when there IS one: the id is a mobile number for every teacher
 * who has not subscribed, and "Good evening, 9000000003!" is nobody's name (founder, 2026-08-25).
 * A named dev id keeps the personal touch.
 * The sub-line is the web's rule too: "Continue where you left off" appears only once at least
 * one section is actually bound. Before that the WELCOME copy speaks instead — telling a teacher
 * to tap "+" the second her classes appear is an instruction she has no context for yet. */
function DashHead({ classes, plansBySG, user }) {
  const ws = useWebStyles();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const rawId = (user || "").trim();
  const firstName = /^\d+$/.test(rawId) ? "" : rawId;
  const anyBound = classes.some((c) => !!readLocalSection(c.sectionKey).chapter);
  const anyPlans = Object.values(plansBySG || {}).some((m) => Object.values(m || {}).some((p) => p.prepared));

  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 26 }}>
      <View style={ws.dash_hd}>
        <Text style={ws.dash_title}>{greeting}{firstName ? `, ${firstName}` : ""}!</Text>
        {classes.length > 0 && anyBound ? (
          <Text style={ws.dash_sub}>Continue where you left off with every class.</Text>
        ) : null}
      </View>
      {classes.length > 0 && !anyBound ? (
        <View style={{ paddingBottom: 10 }}>
          <Text style={ws.dash_welcome_title}>Your classes are ready</Text>
          <Text style={ws.dash_welcome_sub}>
            {anyPlans
              ? "Your lesson is waiting in My Lessons — tap + on a class to start teaching it."
              : "Tap + on a class to prepare its first lesson."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ───────── The constant graph rule (founder, 2026-08-30; on the phone too, 2026-09-14) ─────────
 * The same 11px rule on every card whatever its state. It is a MATERIAL, not a code: because it
 * never varies it carries no meaning, needs no legend, and cannot compete with the status colours
 * the way a per-class pattern would. Paper keeps its grain, cards get their rule.
 * The web draws it with two repeating linear-gradients; React Native has no repeating gradient,
 * so it is an SVG <Pattern> instead — a true tile, not an approximation. The line sits on the TOP
 * and LEFT edge of each 11px cell, as the web's gradients do.
 * ⚠️ The weight lives in ONE place, --card-grid in globals.css (theme/tokens.js is generated from
 * it), so lightening the rule lightens BOTH surfaces. It was taken from 7.5% to 5% on 2026-09-14
 * (founder: it should not interfere with reading); the dark theme's light rule went 5.5% → 4%. */
function CardGrid({ color }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="sc-grid" width={11} height={11} patternUnits="userSpaceOnUse">
          <Path d="M0 0.5 H11 M0.5 0 V11" stroke={color} strokeWidth={1} fill="none" />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#sc-grid)" />
    </Svg>
  );
}

/* ───────── ONE section card, in the web's three states (Track D step 4) ─────────
 * st-new (sand) · st-going (green) · st-done (clay) — the FILL carries the teaching status and
 * the 4px left spine repeats it (founder, 2026-08-30). A chapter bound but never opened is
 * still st-new: the status is about TEACHING, not about binding.
 * The right slot is one position holding opposite acts, exactly as the web: "+" to track (pine)
 * on an empty or finished card, "−" to untrack (clay) while she is teaching. Measures in
 * theme/web.js under sc_*; the web's 11px graph rule is the one thing not ported (RN has no
 * repeating gradient) — the card keeps its fill, which is what carries the status anyway. */
function ClassCard({ c, plans, onOpen, onAttach, onUntrack, onMoveOn }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  const sec = readLocalSection(c.sectionKey);
  const plan = sec.chapter ? plans[sec.chapter] : null;
  const hist = hasHistory(c.sectionKey);
  // sec.tag already carries the class number ("9A"); her own name for the section, when she gave
  // one, sits in fine print beneath it — the web's .sc-tag-name.
  const tag = c.sectionTag;
  const name = c.sectionName;

  const Round = ({ glyph, color, label, onPress }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={[ws.sc_round, { borderColor: t.line, backgroundColor: t.paper_2 }]}>
      <Text style={[ws.sc_round_glyph, { color }]}>{glyph}</Text>
    </Pressable>
  );
  const Tag = ({ muted }) => (
    <View style={{ minWidth: 40 }}>
      <Text style={[ws.sc_tag, muted && ws.sc_tag_muted]}>{tag}</Text>
      {name ? <Text style={ws.sc_tag_name} numberOfLines={1}>{name}</Text> : null}
    </View>
  );

  /* No chapter bound — "Pick a chapter to begin". The card is NOT tappable-to-generate; the
     "+" opens the picker (founder, 2026-07-09: a freshly generated lesson lands in My Lessons
     and is never auto-named onto a section card). */
  if (!plan) {
    return (
      <View style={[ws.sc_card, { backgroundColor: t.card_new, borderColor: t.card_new_edge }]}>
        <CardGrid color={t.card_grid} />
        <View style={[ws.sc_spine, { backgroundColor: t.edge }]} />
        <Tag muted />
        <View style={ws.sc_body}>
          <Text style={ws.sc_kicker}>{c.subjectName}</Text>
          <Text style={[ws.sc_title, ws.sc_title_muted]}>Pick a chapter to begin</Text>
        </View>
        <View style={ws.sc_right}>
          <Round glyph="+" color={t.pine_d} label="Attach a lesson to this section" onPress={onAttach} />
        </View>
      </View>
    );
  }

  /* ★ ATTACHING A CHAPTER MEANS SHE IS TEACHING IT, FROM UNIT 1 (founder, 2026-09-14).
     So a bound card is green unless it is finished, and the sand card belongs to the
     no-chapter case alone. The web reached the same place by accident — Number(null) is 0, so
     its pointer read an untouched section as unit 1 — and now says so on purpose in MyPlans;
     this is the same rule stated once on each surface. */
  const lu = pointerOf(c.sectionKey) || 1;
  const done = sec.done;
  const total = plan.total_units || null;
  const fill = done ? t.card_done : t.card_going;
  const edge = done ? t.card_done_edge : t.card_going_edge;
  const spine = done ? t.clay : t.pine;

  /* ⚠️ The tappable area is the tag + body, NOT the whole card — the right slot's "+"/"−" sit
     OUTSIDE it. The web can nest a <button> inside a clickable <div> and call stopPropagation;
     react-native-web renders an accessibilityRole="button" Pressable as a real <button>, and a
     button inside a button is invalid (it warns, and the inner one's press is unreliable). So
     the row is split instead: same flex row, same 13px gap, identical on screen, and the
     actions simply are not inside the card's own press target — which is what stopPropagation
     was simulating anyway. */
  return (
    <View style={[ws.sc_card, { backgroundColor: fill, borderColor: edge }]}>
      <CardGrid color={t.card_grid} />
      <View style={[ws.sc_spine, { backgroundColor: spine }]} />
      <Pressable onPress={() => onOpen(c, plan)} accessibilityRole="button"
        accessibilityLabel={`Open ${plan.chapter_title} for ${tag}`}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", columnGap: 13 }}>
      <Tag />
      <View style={ws.sc_body}>
        <Text style={ws.sc_kicker}>
          {c.subjectName}{plan.chapter_number ? ` · Ch ${plan.chapter_number}` : ""}
        </Text>
        <Text style={ws.sc_title} numberOfLines={2}>{plan.chapter_title}</Text>
        {total ? (
          <View style={ws.sc_rail} accessibilityLabel={
            done ? `${total} units, completed` : lu ? `Unit ${lu} of ${total}` : `${total} units, not started`}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[ws.sc_tick, {
                backgroundColor: done || (lu && i < lu - 1) ? t.pine
                  : lu && i === lu - 1 ? t.ochre : t.card_tick,
              }]} />
            ))}
          </View>
        ) : null}
      </View>
      </Pressable>
      {done ? (
        <View style={ws.sc_actions_col}>
          <Text style={ws.sc_status_done}>Complete</Text>
          <Round glyph="+" color={t.pine_d} label="Finish with this chapter and track the next"
            onPress={() => onMoveOn(plan)} />
        </View>
      ) : (
        <View style={ws.sc_right}>
          <Round glyph="−" color={t.clay} label="Stop tracking this chapter"
            onPress={() => onUntrack(plan)} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  footcard: { marginTop: 30, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
  segs: { flexDirection: "row", gap: 8, marginTop: 12 },
  seg: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
});
