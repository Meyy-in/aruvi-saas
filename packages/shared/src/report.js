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

export function problemReport({ lp, unitNumber, unitTitle = "", dropped = false } = {}) {
  const p = lp || {};
  const g = gradeRoman(p.grade);
  const subj = subjectWords(p.subject);
  const chNum = p.chapter_number != null && String(p.chapter_number).trim() !== ""
    ? String(p.chapter_number).trim() : "";
  const chTitle = String(p.chapter_title || "").trim();
  const n = Number.isFinite(Number(unitNumber)) ? Number(unitNumber) : null;

  const ref = [g || "X", subjectCode(p.subject),
    chNum ? chNum.padStart(2, "0") : "00",
    n != null ? `${dropped ? "D" : "U"}${n}` : ""].filter(Boolean).join("-");

  const chapter = [chNum ? `Ch ${chNum}` : "", chTitle].filter(Boolean).join(" ");
  const unit = n != null
    ? `${dropped ? "Dropped section" : "Unit"} ${n}${unitTitle ? ` · ${String(unitTitle).trim()}` : ""}`
    : "";
  const line = [g ? `Class ${g}` : "", subj, chapter, unit].filter(Boolean).join(" · ");

  const context = { screen: "Lesson › Report a problem", subject: String(p.subject || ""),
    grade: g, chapter, unit, plan_ref: ref };
  Object.keys(context).forEach((k) => { if (!context[k]) delete context[k]; });
  return { ref, line, context };
}

/* The WhatsApp text: the lesson line and code on top, then her words. She can still edit
   it in WhatsApp before sending — that is the point of sending from her own WhatsApp. */
export function reportWhatsAppText(report, message) {
  const r = report || {};
  const head = `Problem in: ${r.line || ""}${r.ref ? ` (Ref ${r.ref})` : ""}`.trim();
  const body = String(message || "").trim();
  return body ? `${head}\n\n${body}` : head;
}
