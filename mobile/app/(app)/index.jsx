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
import { Text } from "../../components/Text";
import { useRouter, useFocusEffect } from "expo-router";
import { getUser, getJSON, fetchEntitlement, subjectSlug, classNum } from "@aruvi/shared/format";
import { signOutAuth } from "@aruvi/shared/auth";
import { clearTeacherCaches } from "@aruvi/shared/signout";
import { pullSectionState, readLocalSection } from "@aruvi/shared/sectionState";
import Bar from "../../components/Bar";
import { Button } from "../../components/ui";
import { useTheme } from "../../theme/ThemeContext";
import { type } from "../../theme/type";
import { display } from "../../theme/fonts";

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
  const endSession = useCallback(async () => {
    await signOutAuth();
    clearTeacherCaches(["setup_check_pending_", "mylessons_subject_", "mylessons_class_", "allocations_"]);
    router.replace("/login");
  }, [router]);

  const load = useCallback(async () => {
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
    const plansBySG = {};
    await Promise.all([...new Set(classes.map((c) => `${c.subjectSlug}/${c.gradeSlug}`))].map(async (key) => {
      try {
        const [sub, gr] = key.split("/");
        const d = await getJSON(`/plans/${sub}/${gr}`);
        const rows = d.plans || d || [];
        plansBySG[key] = {};
        rows.forEach((p) => { plansBySG[key][p.filename] = p; });
      } catch { plansBySG[key] = {}; }
    }));
    setSt({ loading: false, err, classes, plansBySG, ent });
  }, [endSession]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { setTick((n) => n + 1); }, []));

  const signOut = endSession;

  const openAttached = (c, plan) => router.push({ pathname: "/lesson",
    params: { subject: c.subjectSlug, grade: c.gradeSlug, filename: plan.filename, section: c.sectionTag } });
  const openPreview = (c, plan) => router.push({ pathname: "/lesson",
    params: { subject: c.subjectSlug, grade: c.gradeSlug, filename: plan.filename } });

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <Bar />
      <ScrollView contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.pine} />}>
        <Text style={[type.label, { color: t.ink_soft }]}>My classes</Text>

        {st.loading ? (
          <View style={s.loading}><ActivityIndicator color={t.pine} /><Text style={[type.small, { color: t.ink_soft, marginLeft: 10 }]}>Loading your classes…</Text></View>
        ) : st.err ? (
          <Text style={[type.body, { color: t.danger, marginTop: 18 }]}>{st.err}</Text>
        ) : st.classes.length === 0 ? (
          <Text style={[type.body, { color: t.ink_soft, marginTop: 14 }]}>No classes yet — set up your teaching profile (first run comes in a later step).</Text>
        ) : (
          <View style={{ marginTop: 12, gap: 14 }} key={tick}>
            {st.classes.map((c) => (
              <ClassCard key={c.sectionKey} t={c && t} c={c}
                plans={st.plansBySG[`${c.subjectSlug}/${c.gradeSlug}`] || {}}
                onContinue={openAttached} onOpen={openPreview} />
            ))}
          </View>
        )}

        {/* foot — moves to Settings in step 6 */}
        {!st.loading && (
          <View style={[s.footcard, { borderTopColor: t.line }]}>
            <Text style={[type.small, { color: t.ink_soft }]}>
              {st.ent ? `${dash(st.ent.status)}${st.ent.enforced ? ` · ${dash(st.ent.trial_chapters_used)} of ${dash(st.ent.trial_chapter_cap)} trial chapters used` : ""}` : ""} · signed in as {user}
            </Text>
            <View style={s.segs}>
              {[["system", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([v, label]) => (
                <Pressable key={v} onPress={() => setPref(v)} style={[s.seg, { borderColor: t.edge, backgroundColor: pref === v ? t.tint_pine : t.paper_2 }]}>
                  <Text style={[type.small, { color: pref === v ? t.pine : t.ink }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Button kind="link" title="Sign out" onPress={signOut} style={{ marginTop: 14, alignSelf: "flex-start" }} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ClassCard({ c, plans, onContinue, onOpen }) {
  const { t } = useTheme();
  const [browse, setBrowse] = useState(false);
  const sec = readLocalSection(c.sectionKey);          // {chapter(filename), unit, done}
  const attached = sec.chapter ? plans[sec.chapter] : null;
  // the tag she has always seen — "9A" — unless she named the section, then her word.
  // sec.tag already carries the class number (readiness stores "9A"), exactly as the web's
  // SectionTag renders it; the earlier `${classNum(grade)}${tag}` doubled it to "99A".
  const tag = c.sectionName || c.sectionTag;
  const prepared = Object.values(plans).filter((p) => p.prepared).sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  const list = prepared.length ? prepared : Object.values(plans).sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  return (
    <View style={[s.card, { backgroundColor: t.card_going, borderColor: t.card_going_edge }]}>
      <View style={s.chead}>
        <Text style={[s.tag, { color: t.ink, backgroundColor: t.paper_2, borderColor: t.edge }]}>{tag}</Text>
        <Text style={[type.small, { color: t.card_muted, flex: 1 }]}>{c.subjectName}</Text>
      </View>

      {attached ? (
        <Pressable onPress={() => onContinue(c, attached)} style={[s.continue, { borderColor: t.pine, backgroundColor: t.paper_2 }]}>
          <Text style={[type.mono, { fontSize: 11, color: t.pine }]}>CONTINUE · {sec.done ? "chapter complete" : `unit ${Number(sec.unit || 0) + 1}`}</Text>
          <Text style={[type.bodyStrong, { color: t.ink, marginTop: 3 }]}>Ch {attached.chapter_number} · {attached.chapter_title}</Text>
        </Pressable>
      ) : (
        <Text style={[type.body, { color: t.card_muted }]}>No chapter open yet — pick one to start.</Text>
      )}

      <Pressable onPress={() => setBrowse((b) => !b)} hitSlop={6} style={{ marginTop: 12 }}>
        <Text style={[type.small, { color: t.pine }]}>{browse ? "Hide chapters" : (attached ? "Open another chapter" : "Pick a chapter")}</Text>
      </Pressable>
      {browse ? (
        <View style={{ marginTop: 8, gap: 2 }}>
          {list.length ? list.map((p) => (
            <Pressable key={p.filename} onPress={() => (attached && p.filename === attached.filename ? onContinue(c, p) : onOpen(c, p))} style={s.prow}>
              <Text style={[type.mono, { fontSize: 12, color: t.ink_soft, width: 34 }]}>{p.chapter_number != null ? `Ch${p.chapter_number}` : ""}</Text>
              <Text style={[type.body, { color: t.ink, flex: 1 }]} numberOfLines={1}>{p.chapter_title}</Text>
            </Pressable>
          )) : <Text style={[type.small, { color: t.card_muted }]}>No chapters available for this class yet.</Text>}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 44 },
  loading: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  card: { borderWidth: 1, borderRadius: 13, padding: 15 },
  chead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  tag: { fontFamily: "Fraunces_600SemiBold", fontSize: 15, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, borderWidth: 1, overflow: "hidden" },
  continue: { borderWidth: 1, borderRadius: 10, padding: 13 },
  prow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(128,128,128,0.15)" },
  footcard: { marginTop: 30, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
  segs: { flexDirection: "row", gap: 8, marginTop: 12 },
  seg: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
});
