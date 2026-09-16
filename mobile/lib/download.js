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

/* Fetch a document from the API and hand it to the teacher.
 *
 *   path      — API path, already encoded (e.g. `/invoices/2026-27%2F014`)
 *   filename  — what the file is CALLED once it leaves; the web's name, unchanged
 *   mime      — for the share sheet's own routing (which apps it offers)
 *
 * Resolves when the sheet has been dismissed (or the browser download has started). Throws on
 * anything that went wrong, with no message of its own. */
export async function downloadDocument({ path, filename, mime }) {
  const r = await fetch(API + path, withUser());
  if (!r.ok) throw new Error(String(r.status));

  if (IS_WEB) {
    /* The web's own mechanism, because on this target it IS the web. */
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* The web waits 30s before revoking; same number, same reason — a revoke that races the
       browser's own save turns a finished download into a broken one. */
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }

  /* ⚠️ THE CACHE DIRECTORY, NOT THE DOCUMENT DIRECTORY. What is written here is a COURIER copy:
     the teacher's real copy is wherever the share sheet sends it, and this one exists only long
     enough to hand over. `Paths.document` is for files the app itself keeps, and filling it with
     every invoice she has ever opened would be a slow leak the OS may not reclaim. */
  const file = new File(Paths.cache, filename);
  try {
    const bytes = new Uint8Array(await r.arrayBuffer());
    file.create({ overwrite: true, intermediates: true });
    file.write(toBase64(bytes), { encoding: "base64" });

    if (!(await Sharing.isAvailableAsync())) {
      /* Rare — a device with no share targets at all. The file is written and named; saying so
         is better than a silent success, and the caller's own sentence is the wrong one. */
      throw new Error("sharing-unavailable");
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: mime,
      UTI: mime === "application/pdf" ? "com.adobe.pdf" : undefined,
      dialogTitle: filename,
    });
  } finally {
    /* ⚠️ AFTER the sheet resolves, never before: iOS reads the file when the teacher picks a
       destination, not when the sheet opens, so deleting early hands Mail an empty attachment.
       Best-effort — a cache file that outlives this is the OS's to reclaim, and a failed delete
       must not turn a completed share into an error. */
    try { file.delete(); } catch {}
  }
}

/* The two documents Settings offers, named once so no screen spells them itself. */
export const dataExport = (fmt) => ({
  path: `/data-rights/export?format=${fmt}`,
  filename: `aruvi-your-data.${fmt}`,
  mime: fmt === "pdf" ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});

export const invoicePdf = (number) => ({
  path: `/invoices/${encodeURI(String(number))}`,
  /* `/` is a path separator on every filesystem there is — the web substitutes it for the same
     reason, not as a browser quirk. */
  filename: `Meyy-invoice-${String(number).replace(/\//g, "-")}.pdf`,
  mime: "application/pdf",
});
