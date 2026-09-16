/* ───────── the academic-year cutover, offered and then reported (Track D 6a F6) ─────────
 *
 * Two cards that never show together, at the TOP of My Classes. The store
 * (`@aruvi/shared/year`) holds the reasoning about WHEN; this file is what she reads.
 *
 * ★ IT IS AN OFFER, NEVER A TIMER (founder, 2026-08-26). The YEAR has already turned — Meyy does
 * that on its own date — so the question is not about the calendar, it is about her CLASSES:
 * whether to clear last year's tracking so the new cohort meets empty cards. A teacher still
 * finishing a chapter in early June must not find her pointers wiped from under her.
 *
 * ★ AND IT SAYS PLAINLY WHAT WILL NOT HAPPEN. The fear here is losing last year's work, and the
 * answer is that nothing is deleted at all — the class list stays, and every plan and note stays
 * in My Lessons under its year. Stating that is most of the card's job.
 *
 * ★ TWO WAYS TO DEFER, BOTH REAL. The ✕ in the corner is for the corner-tap habit; "Not yet"
 * sits BESIDE the start button, where a teacher choosing between two options actually looks
 * (founder, 2026-08-26 — "Not now" had been a plain span on the web, so tapping it did nothing).
 * Neither is remembered beyond this launch: Q17, answered 2026-09-16, took the web's rule.
 */
import { View, Pressable } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../theme/ThemeContext";
import { useWebStyles } from "../theme/web";

export function CutoverOffer({ info, busy, onStart, onDismiss }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  if (!info) return null;
  const priorYear = (info.prior_years || []).slice(-1)[0] || "earlier";
  return (
    <View style={[ws.dash_nudge, { backgroundColor: t.tint_pine, borderColor: t.pine,
                                   borderLeftWidth: 3, borderLeftColor: t.ochre }]}>
      <Text style={[ws.dash_nudge_title, ws.yr_title_pad, { color: t.pine_d }]}>
        {info.current_year} has begun — start your classes fresh?
      </Text>
      <Text style={[ws.dash_nudge_sub, { color: t.ink_soft }]}>
        You are still tracking last year’s chapters, so you can finish anything you were
        part-way through. When you’re ready for the new batch, clear them and your section cards
        start empty. Your class list stays as it is, and nothing is deleted — every {priorYear}{" "}
        lesson plan and note stays in My Lessons under that year.
      </Text>
      <View style={ws.yr_nudge_row}>
        <Pressable onPress={busy ? undefined : onStart} disabled={busy}
          accessibilityRole="button" accessibilityState={{ disabled: !!busy }}
          style={[ws.yr_nudge_go, { backgroundColor: t.pine, opacity: busy ? 0.55 : 1 }]}>
          <Text style={[ws.yr_nudge_go_t, { color: t.paper }]}>
            {busy ? "Clearing…" : "Start my classes fresh →"}
          </Text>
        </Pressable>
        <Pressable onPress={onDismiss} accessibilityRole="button" style={ws.yr_nudge_later}>
          <Text style={[ws.yr_nudge_go_t, { color: t.ink_soft }]}>Not yet</Text>
        </Pressable>
      </View>
      {/* Rendered LAST so it is painted above the body — the `ap_close` lesson (`63adafaf`):
          an absolutely-positioned control written before its siblings sits under them, visible
          and untappable, and order settles it where zIndex would need elevation on Android. */}
      <Pressable onPress={onDismiss} accessibilityRole="button" hitSlop={6}
        accessibilityLabel="Not now — ask me next time" style={ws.yr_x}>
        <Text style={[ws.yr_x_glyph, { color: t.ink_soft }]}>✕</Text>
      </Pressable>
    </View>
  );
}

/* What actually happened, stated as fact rather than promise. */
export function CutoverDone({ result, onDismiss }) {
  const { t } = useTheme();
  const ws = useWebStyles();
  if (!result) return null;
  /* `sections_cleared ?? sections_carried` — the newer field wins, the older is the fallback.
     The web spells the same pair; one server, two ages of it. */
  const n = result.sections_cleared ?? result.sections_carried;
  const archived = result.plans_archived || 0;
  return (
    <View style={[ws.dash_nudge, { backgroundColor: t.tint_pine, borderColor: t.pine,
                                   borderLeftWidth: 3, borderLeftColor: t.pine }]}>
      <Text style={[ws.dash_nudge_title, { color: t.pine_d }]}>
        {result.already_done
          ? `Your classes are already set for ${result.opened_year}.`
          : `Ready for ${result.opened_year}.`}
      </Text>
      <Text style={[ws.dash_nudge_sub, { color: t.ink_soft }]}>
        {result.already_done ? "Nothing changed." : (
          <>
            {n} section{n === 1 ? "" : "s"} cleared and ready for your new batch.
            {archived > 0 ? (
              <>
                {" "}Your {archived} {result.closed_year} lesson plan{archived === 1 ? "" : "s"}{" "}
                {archived === 1 ? "is" : "are"} still in My Lessons under{" "}
                {/* The web bolds the year with <b>; a phone names a semibold FACE and no size,
                    or the run grows mid-sentence (the `lgl_b` lesson, 2026-09-16). */}
                <Text style={{ fontFamily: ws.dash_nudge_sub_b.fontFamily }}>{result.closed_year}</Text>.
              </>
            ) : null}
          </>
        )}
      </Text>
      <View style={ws.yr_nudge_row}>
        <Pressable onPress={onDismiss} accessibilityRole="button"
          style={[ws.yr_nudge_go, { backgroundColor: t.pine }]}>
          <Text style={[ws.yr_nudge_go_t, { color: t.paper }]}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}
