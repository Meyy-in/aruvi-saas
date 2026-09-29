/**
 * Meyy — one polite auto-reply to mail from an address that is on NO Meyy account.
 * (WALK-A-135, founder 2026-09-28: "Meyy corresponds only with and on the email or mobile on
 *  record. Mail from an unknown address: ONE polite auto-reply pointing to the app, then none.")
 *
 * Runs INSIDE the support@meyy.in Google Workspace mailbox as an Apps Script, on a 10-minute
 * timer. For each new inbox thread it asks the Meyy API whether the sender's address belongs to
 * an account (the same public check the sign-in screen uses: GET /onboarding/known?id=<email>).
 *   · on an account      → left alone, labelled meyy/checked. Answer it as usual.
 *   · on no account      → ONE reply (per address, ever), labelled meyy/unknown-sender.
 *   · API unreachable    → left unlabelled, so the next run tries again. Never a guess.
 * It never replies to automated mail (no-reply, bounces, mailing lists, auto-replies) or to
 * Meyy's own mail, so two robots can never talk to each other.
 *
 * Setup: see README.md beside this file.
 */

const API = "https://meyy-api.onrender.com";
const OWN_DOMAINS = ["meyy.in"];                         // our own mail — never answered
const SKIP_SENDERS = ["kumar.radhakrishnan2@gmail.com"]; // the API's fallback sending account
const QUERY = "in:inbox newer_than:3d -label:meyy/checked";
const REPLIED_KEY = "replied_unknown";                   // Script Properties: addresses already answered

const REPLY_BODY =
  "Thank you for writing to Meyy.\n\n" +
  "Meyy replies only to the email address on a Meyy account, and this address is not on one, " +
  "so we cannot answer your message here.\n\n" +
  "If you use Meyy, please write to us from inside the app: Settings › Support. Your message " +
  "reaches us at once, and our reply comes to the email address on your account.\n\n" +
  "— Meyy support";

function checkSupportInbox() {
  const checked = label_("meyy/checked");
  const unknown = label_("meyy/unknown-sender");
  const props = PropertiesService.getScriptProperties();
  const replied = new Set(JSON.parse(props.getProperty(REPLIED_KEY) || "[]"));

  GmailApp.search(QUERY, 0, 50).forEach((thread) => {
    const first = thread.getMessages()[0];
    const from = addressOf_(first.getFrom());
    if (!from || isAutomated_(first, from)) { thread.addLabel(checked); return; }

    const known = isKnown_(from);
    if (known === null) return;                           // API down — try again next run
    thread.addLabel(checked);
    if (known) return;

    thread.addLabel(unknown);
    if (replied.has(from)) return;                        // ONE reply per address, ever
    first.reply(REPLY_BODY);
    replied.add(from);
  });

  props.setProperty(REPLIED_KEY, JSON.stringify([...replied]));
}

/* true = on an account (or ambiguous — never auto-reply to a real teacher), false = on none,
   null = could not ask. */
function isKnown_(email) {
  try {
    const r = UrlFetchApp.fetch(`${API}/onboarding/known?id=${encodeURIComponent(email)}`,
                                { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return null;
    const d = JSON.parse(r.getContentText() || "{}");
    if (d.reason === "ambiguous_email") return true;
    return !!d.known;
  } catch (e) {
    return null;
  }
}

function isAutomated_(msg, from) {
  const domain = from.split("@")[1] || "";
  if (OWN_DOMAINS.includes(domain) || SKIP_SENDERS.includes(from)) return true;
  if (/^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce)/i.test(from)) return true;
  const h = (name) => String(msg.getHeader(name) || "").toLowerCase();
  if (h("Auto-Submitted") && h("Auto-Submitted") !== "no") return true;
  if (/bulk|list|junk/.test(h("Precedence"))) return true;
  if (h("List-Id") || h("List-Unsubscribe")) return true;
  return false;
}

function addressOf_(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return String(m ? m[1] : from || "").trim().toLowerCase();
}

function label_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/* Run once by hand to install the 10-minute timer. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "checkSupportInbox")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("checkSupportInbox").timeBased().everyMinutes(10).create();
}
