/* ───────── "Report a problem" — what a lesson knows about itself ─────────
 * Founder, 2026-10-03. A teacher reporting a fault in a plan should never have to say WHICH
 * plan: the lesson she is standing on already knows. This builds the three things both
 * surfaces need from it, so the web pop-up and (later) the phone's send the same words:
 *
 *   ref     — a short code that names the unit ("IX-MAT-02-U3"). It travels inside the
 *             WhatsApp text and the support case, so whoever answers can find the plan even
 *             if she edits the rest of her message.
 *   line    — the human version ("Class IX · Mathematics · Ch 2 Polynomials · Unit 3 …"),
 *             shown read-only at the top of the pop-up.
 *   context — the support case's context dict (POST /support), rendered back to her as
 *             ledger rows in the acknowledgement mail (api/mail_templates._context_rows).
 *
 * Pure: no React, no fetch. Mirrors nothing on the server — the server only stores it. */

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function gradeRoman(grade) {
  const m = String(grade || "").match(/\d+/);
  if (m) return ROMAN[parseInt(m[0], 10)] || m[0];
  return String(grade || "").replace(/grade|class/gi, "").trim().toUpperCase();
}

export function subjectWords(subject) {
  return String(subject || "").replace(/_/g, " ").trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// First three letters of the subject's first word: MAT, SCI, SOC, ENG, THE→TWA special-cased.
function subjectCode(subject) {
  const s = String(subject || "").toLowerCase();
  if (s === "the_world_around_us") return "TWA";
  return (s.replace(/[^a-z]/g, "").slice(0, 3) || "GEN").toUpperCase();
}

/* "Phase 2 - 15 min" — the picker's option label; minutes left off when the plan has none. */
export function phaseOptionLabel(n, mins) {
  return mins != null && mins !== "" && Number.isFinite(Number(mins)) ? `Phase ${n} - ${mins} min` : `Phase ${n}`;
}

export function romanNumeral(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return "";
  return ROMAN[v] || String(v);
}

/* `phase` is the 1-based phase number inside the unit's Lesson tab, or null for the whole unit.
   `part` is the tab she reported from: "lesson" (default) or "assess" (→ "Assessment").
   What SHE sees (founder, 2026-10-03): two short rows and nothing else —
     line1  "Class IX · Mathematics"
     line2  "Polynomials · Unit 3 · Phase 2"   (Arabic, as in the phase picker "Phase 2 - 15 min")
   The activity's name is left out (the unit number is enough for Meyy), and the plan code is
   internal: it rides in `context` for us, never on her screen or in her WhatsApp. */
export function problemReport({ lp, unitNumber, unitTitle = "", dropped = false, phase = null, part = "lesson",
                                planFile = "" } = {}) {
  const p = lp || {};
  const g = gradeRoman(p.grade);
  const subj = subjectWords(p.subject);
  const chNum = p.chapter_number != null && String(p.chapter_number).trim() !== ""
    ? String(p.chapter_number).trim() : "";
  const chTitle = String(p.chapter_title || "").trim();
  const n = Number.isFinite(Number(unitNumber)) ? Number(unitNumber) : null;
  const assess = part === "assess";
  const ph = !assess && phase != null && phase !== "" && Number.isFinite(Number(phase)) && Number(phase) >= 1
    ? Number(phase) : null;

  const ref = [g || "X", subjectCode(p.subject),
    chNum ? chNum.padStart(2, "0") : "00",
    n != null ? `${dropped ? "D" : "U"}${n}` : "",
    ph != null ? `P${ph}` : "", assess ? "A" : ""].filter(Boolean).join("-");

  const unit = n != null ? `${dropped ? "Dropped section" : "Unit"} ${n}` : "";
  const phaseWords = assess ? "Assessment" : (ph != null ? `Phase ${ph}` : "");
  const line1 = [g ? `Class ${g}` : "", subj].filter(Boolean).join(" · ");
  const line2 = [chTitle || (chNum ? `Ch ${chNum}` : ""), unit, phaseWords].filter(Boolean).join(" · ");
  const line = [line1, line2].filter(Boolean).join(" · ");

  const chapter = [chNum ? `Ch ${chNum}` : "", chTitle].filter(Boolean).join(" ");
  const context = { screen: "Lesson › Report a problem", subject: String(p.subject || ""),
    grade: g, chapter, unit, phase: phaseWords,
    unit_title: String(unitTitle || "").trim(), plan_ref: ref,
    plan_file: String(planFile || "").trim() };   // the saved variant she read — internal, like plan_ref
  Object.keys(context).forEach((k) => { if (!context[k]) delete context[k]; });
  return { ref, line, line1, line2, context };
}

/* The WhatsApp text: where she was, then her words. No internal code — the line plus her
   number (which Meyy already knows) is enough to find the plan. She can still edit it in
   WhatsApp before sending; that is the point of sending from her own WhatsApp. */
export function reportWhatsAppText(report, message) {
  const r = report || {};
  const head = `Problem in: ${r.line || ""}`.trim();
  const body = String(message || "").trim();
  return body ? `${head}\n\n${body}` : head;
}
