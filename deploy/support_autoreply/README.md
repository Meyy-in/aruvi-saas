# Support auto-reply for unknown senders (WALK-A-135)

> **DEFERRED (founder, 2026-09-29). Do not install.** This waits until WhatsApp support is live,
> when it becomes part of a fuller reply protocol. It is kept here as a draft.

**Policy (founder, 2026-09-28):** Meyy corresponds only with the email or mobile on record.
Mail to support@meyy.in from an address that is on no Meyy account gets **one** polite reply
pointing to Settings › Support in the app. After that, nothing more goes to that address.

`Code.gs` is a Google Apps Script. It runs **inside the support@meyy.in Workspace mailbox**,
so replies come from support@meyy.in itself.

## Set it up (about 5 minutes)
1. Sign in to Google as **support@meyy.in** and open <https://script.google.com> › **New project**.
   Name it `Meyy support auto-reply`.
2. Delete the sample code, paste the whole of `Code.gs`, and **Save**.
3. From the function menu, pick **installTrigger** and press **Run**. Approve the permissions
   Google asks for: read and label mail, send replies, and fetch meyy-api.onrender.com.
4. Done. Every 10 minutes it checks new inbox mail. You'll see two labels appear:
   - `meyy/checked`: looked at. On an account, answer as usual.
   - `meyy/unknown-sender`: on no account. It got the one reply, unless that address had one before.

## Good to know
- It checks with the same public lookup the sign-in screen uses (`/onboarding/known`), so it
  needs **no API change and no redeploy**.
- If the API doesn't answer (for example, Render asleep), the mail is left unlabelled and tried
  again on the next run. It never guesses.
- It never answers automated mail (no-reply, bounces, lists, other auto-replies) or Meyy's own mail.
- To stop it: script.google.com › the project › **Triggers** › delete the trigger.
- The addresses already answered are kept in the project's Script Properties (`replied_unknown`).
