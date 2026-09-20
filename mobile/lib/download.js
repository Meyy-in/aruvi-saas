/* ───────── F9 — how a document LEAVES the phone (Track D, founder's Q15, 2026-09-16) ─────────
 *
 * ★ THE ANSWER IS THE SHARE SHEET. Founder's choice over a silent save to Files, and the reason
 * is what a teacher actually DOES with these files: a year plan goes to a head of department, an
 * invoice goes to her own inbox, her data export goes wherever she is keeping it. The OS sheet is
 * also its own receipt — something visibly happened — where a silent save invites the question
 * every downloads feature eventually gets, which is "where did it go?".
 *
 * ★ THE WEB'S HALF IS NOT A FALLBACK, IT IS THE SAME DECISION ON A DIFFERENT SURFACE. Expo web
 * has no share sheet and no native file system, so there it does exactly what web/Settings.jsx
 * does — an object URL and an `<a download>`. That keeps this walkable on Expo web (the request,
 * the auth, the FILENAME and the failure sentence are all exercised) while the sheet itself is
 * only ever real on a handset.
 *
 * ★ FILENAMES ARE THE WEB'S, TO THE CHARACTER. `aruvi-your-data.docx`, `Meyy-invoice-2026-27-014.pdf`
 * — a teacher who has both surfaces must not end up with two naming schemes in one folder, and the
 * invoice's `/` → `-` substitution is a filesystem rule on every platform, not a web quirk.
 *
 * ⚠️ WHAT THIS DELIBERATELY DOES NOT DO: decide what to say when it fails. Each caller owns its own
 * sentence, because the web's differ by screen ("Couldn't prepare your download right now." vs
 * "Couldn't fetch that invoice right now.") and those words are the founder's. This throws; the
 * screen speaks.
 *
 * ⚠️ AND IT IS UNWALKABLE BY ANYTHING BUT A HANDSET. `expo-sharing` and `expo-file-system` are
 * native modules: on Expo web the branch below runs instead, so the sheet, the temporary file and
 * its cleanup have exactly one authority, and it is the phone in the founder's hand.
 */
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { API } from "@aruvi/shared/config";
import { withUser } from "@aruvi/shared/format";
import { IS_WEB } from "./boot";

/* base64 without pulling in a polyfill: RN has no Buffer, and `btoa` chokes on binary strings
 * assembled from a large byte array (call-stack limits on `String.fromCharCode(...bytes)`), which
 * an invoice PDF will reach. Chunked, and using the global `btoa` react-native supplies. */
function toBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/* `filename="…"` off Content-Disposition. Deliberately the web's own one-line regex rather than
   a full RFC 5987 parse: the only producer is this API, it always quotes and never sends a
   `filename*`, and a parser written for headers we do not emit is a parser nothing tests. */
function dispositionName(r) {
  const m = (r.headers.get("content-disposition") || "").match(/filename="([^"]+)"/);
  return m ? m[1] : "";
}

/* Fetch a document from the API and hand it to the teacher.
 *
 *   path      — API path, already encoded (e.g. `/invoices/2026-27%2F014`)
 *   filename  — what the file is CALLED once it leaves; the web's name, unchanged
 *   mime      — for the share sheet's own routing (which apps it offers)
 *
 * Resolves when the sheet has been dismissed (or the browser download has started). Throws on
 * anything that went wrong, with no message of its own. */
/* The request, the error unwrap and the NAME — everything the two public paths share. Returns
   the live Response, so whoever called it still owns the body. */
async function requestDocument({ path, filename, mime, method = "GET", body,
                                 fromDisposition = false }) {
  /* A GET needs no body and must not declare a content type; the year-plan export POSTs the
     SCREEN'S OWN MODEL (web YearPlan.jsx: the server renders what it is given and looks nothing
     up, so the file can never contradict the table it came from). One call shape, both verbs. */
  const r = await fetch(API + path, body === undefined
    ? withUser({ method })
    : withUser({ method, headers: { "Content-Type": "application/json" },
                 body: JSON.stringify(body) }));
  if (!r.ok) {
    /* ⚠️ THE STATUS AND THE SERVER'S OWN WORDS RIDE ON THE THROW — and this is still not this
       file speaking. Each caller owns its sentence (see the header), but no caller can choose
       between "this Meyy server doesn't have the export yet" and "Word export isn't available
       on this server" without knowing which status it was, and the web picks those same two
       sentences from exactly these two facts. Read HERE because it can only be read here: a
       Response body is consumed once, and by the time the caller has the error it is gone. */
    let detail = "";
    try {
      const j = await r.json();
      detail = typeof j.detail === "string" ? j.detail
        : Array.isArray(j.detail) ? j.detail.map((d) => d.msg).join("; ") : "";
    } catch { /* not JSON — the status alone is what we have */ }
    const e = new Error(String(r.status));
    e.status = r.status;
    e.detail = detail;
    throw e;
  }

  /* ★ WHO NAMES THE FILE. The two Settings documents are named by US, to the character, because
     a teacher with both surfaces must not end up with two naming schemes in one folder. The
     report and the year plan are named by the SERVER: the name carries the chapter, the
     composition and the class, and only the renderer knows how it rendered them. The web reads
     the same header for the same reason, with the same literal fallback. */
  const name = fromDisposition ? (dispositionName(r) || filename) : filename;
  return { r, name, mime };
}

/* ★ CAN THIS DOCUMENT BE SHOWN BEFORE IT IS SENT? (founder, 2026-09-17: "it displays the pdf on
   the full screen and from there gives option to choose. Whereas our current export does not
   display and directly opens app".)
   Three conditions, and each is a real limit rather than caution:
     · not the web target, where the browser's own download IS the whole gesture;
     · iOS only — WKWebView renders a PDF natively, and Android's WebView does not (it would
       show a blank page or offer to download it again, which is worse than no preview);
     · PDF only — a .docx has no renderer in any WebView. iOS's own Quick Look previews Word
       too, but that is `QLPreviewController`, which has no Expo module and cannot run inside
       Expo Go; the day this app moves to a dev build, that is the upgrade to make.
   ⚠️ So the YEAR PLAN, being Word-only, still goes straight to the sheet. That raggedness is
   deliberate and named, not an oversight — closing it means giving the year-plan route a PDF
   format, which is backend work nobody has asked for yet. */
/* ★ AMENDED 2026-09-18 (founder: the Year Plan export "again does not display the report but
   invokes apps — render it like we do for invoices and PDF LPs"). The note above said a .docx has
   no renderer in any WebView; on iOS that is not so — WKWebView hands Office documents loaded
   from a file URL to the same Quick Look machinery that draws them in Files, read-only. So Word
   is previewed too, and what the arrow sends is still the editable .docx she asked for (the Year
   Plan is Word-only by decision: she amends a row before handing it on). Android stays PDF-less
   and Word-less: its WebView renders neither. ⚠️ Handset-verify: if a .docx ever draws blank, the
   preview's own "Tap the arrow above to send or save it" is the way out, not a dead end. */
const PREVIEWABLE = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
export const canPreview = (mime) =>
  !IS_WEB && Platform.OS === "ios" && PREVIEWABLE.has(mime);

/* ★ ANDROID SHOWS THE DOCUMENT TOO (WALK-A-030, founder 2026-09-20: "open in phone's viewer").
 * iOS has Quick Look, which is what `canPreview` routes to. Android has no in-app renderer for a
 * .docx, but it does have the teacher's own document apps — so the file is handed to the system
 * VIEW intent (Docs, Word, Drive, whichever she has), from where her own share is one tap away.
 * Falls back to the share sheet when nothing can view it, so she is never left with nothing. */
export async function openInViewer({ uri, name, mime }) {
  if (Platform.OS !== "android") return false;
  try {
    const IntentLauncher = require("expo-intent-launcher");
    /* `getContentUriAsync` lives in the LEGACY entry point in expo-file-system 57 — a file:// URI
       cannot be handed to another app on Android (FileUriExposedException), so the content:// one
       is what the intent carries. */
    const { getContentUriAsync } = require("expo-file-system/legacy");
    const contentUri = await getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      flags: 1,                    // FLAG_GRANT_READ_URI_PERMISSION
      type: mime,
    });
    return true;
  } catch {
    return false;                  // no viewer, or the intent was refused — the caller shares
  }
}

/* The cache directory's own URI — WKWebView will not read a `file://` it has not been granted
   access to, and `allowingReadAccessToURL` is how that grant is spelled. */
export const cacheDirUri = () => Paths.cache.uri;

/* Fetch the document and write the courier copy, handing it NOWHERE. The preview path needs
   the file to outlive this call, so the delete that `downloadDocument` does in its `finally`
   is the caller's here — see `discardFile`. */
export async function fetchDocument(doc) {
  const { r, name, mime } = await requestDocument(doc);
  /* ⚠️ THE CACHE DIRECTORY, NOT THE DOCUMENT DIRECTORY. What is written here is a COURIER copy:
     the teacher's real copy is wherever the share sheet sends it, and this one exists only long
     enough to hand over. `Paths.document` is for files the app itself keeps, and filling it with
     every invoice she has ever opened would be a slow leak the OS may not reclaim. */
  const file = new File(Paths.cache, name);
  const bytes = new Uint8Array(await r.arrayBuffer());
  file.create({ overwrite: true, intermediates: true });
  file.write(toBase64(bytes), { encoding: "base64" });
  return { uri: file.uri, name, mime };
}

/* Hand a written file to the OS. Resolves when the sheet has been dismissed. */
export async function shareFile({ uri, name, mime }) {
  if (!(await Sharing.isAvailableAsync())) {
    /* Rare — a device with no share targets at all. The file is written and named; saying so
       is better than a silent success, and the caller's own sentence is the wrong one. */
    throw new Error("sharing-unavailable");
  }
  await Sharing.shareAsync(uri, {
    /* ⚠️ Both of these are ANDROID-ONLY in expo-sharing 57: `ios/SharingModule.swift` declares
       `mimeType` and `UTI` on its options record and never reads either — the sheet's contents
       come from the file extension alone. Kept because they are the documented API and are
       correct if a later version starts honouring them. */
    mimeType: mime,
    UTI: mime === "application/pdf" ? "com.adobe.pdf" : undefined,
    dialogTitle: name,
  });
}

/* Best-effort: a cache file that outlives this is the OS's to reclaim, and a failed delete must
   never turn a completed share into an error. */
export function discardFile(uri) {
  try { new File(uri).delete(); } catch {}
}

/* Fetch a document from the API and hand it straight to the teacher — the path Settings uses,
   unchanged. Resolves when the sheet has been dismissed (or the browser download has started).
   Throws on anything that went wrong, with no message of its own. */
export async function downloadDocument(doc) {
  if (IS_WEB) {
    /* The web's own mechanism, because on this target it IS the web. */
    const { r, name } = await requestDocument(doc);
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* The web waits 30s before revoking; same number, same reason — a revoke that races the
       browser's own save turns a finished download into a broken one. */
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }
  const file = await fetchDocument(doc);
  try {
    await shareFile(file);
  } finally {
    /* ⚠️ AFTER the sheet resolves, never before: iOS reads the file when the teacher picks a
       destination, not when the sheet opens, so deleting early hands Mail an empty attachment. */
    discardFile(file.uri);
  }
}

/* The two documents Settings offers, named once so no screen spells them itself. */
export const dataExport = (fmt) => ({
  path: `/data-rights/export?format=${fmt}`,
  filename: `aruvi-your-data.${fmt}`,
  mime: fmt === "pdf" ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});

/* ★ THE REPORT (app. 05 C36) — the one document whose SHAPE she chooses, so unlike the two
   above it takes arguments instead of being a constant. The query is assembled here so that no
   screen spells the route, and `answers` rides ONLY where the composition can carry it: that is
   what makes "a clean copy can never carry answers" a property of the descriptor rather than a
   rule the modal has to keep remembering. */
export const planReport = ({ sSlug, gSlug, filename, comp, fmt, answers }) => ({
  path: `/api/plans/${sSlug}/${gSlug}/${filename}/export/${comp}?format=${fmt}`
    + (answers ? "&answers=1" : ""),
  /* The web's literal fallback, kept to the character; the server normally names this itself. */
  filename: `report.${fmt === "pdf" ? "pdf" : "docx"}`,
  fromDisposition: true,
  mime: fmt === "pdf" ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});

/* ★ THE YEAR PLAN POSTS THE PANE'S OWN MODEL (app. 05 E8). `sug` is the teacher's budget
   distributed by chapter weight, computed in YearPlan.jsx; asking the server to rebuild it
   would be a SECOND implementation of that arithmetic, and the day the two drift she holds a
   Word document contradicting the screen she exported it from — the 2026-08-21 defect (Year
   Plan said 14 where the chapter step said 19) reached through a new door. So the payload IS
   the render, on this surface exactly as on the web. */
export const yearPlanExport = ({ sSlug, gSlug, payload }) => ({
  path: "/api/year-plan/export-docx",
  method: "POST",
  body: payload,
  filename: `year-plan-${sSlug}-${gSlug}.docx`,
  fromDisposition: true,
  mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});

export const invoicePdf = (number) => ({
  path: `/invoices/${encodeURI(String(number))}`,
  /* `/` is a path separator on every filesystem there is — the web substitutes it for the same
     reason, not as a browser quirk. */
  filename: `Meyy-invoice-${String(number).replace(/\//g, "-")}.pdf`,
  mime: "application/pdf",
});
