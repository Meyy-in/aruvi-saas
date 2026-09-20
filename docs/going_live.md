# Going live — hosting the website, DNS, and what the stores require

**Status: PLAN, nothing done.** Opened 2026-09-20. Covers the PUBLISHING side of launch: where
the website is served from, how `meyy.in` points at it, and the public pages Google Play and the
App Store require before a listing can be submitted. The BUILD side — that the last port is a
simple switch — lives in `docs/walk_tracker.html`'s Release-switch gate and in the implementation
map's Step 9. Read with `deploy/README.md` (the API container) and `STORAGE_POLICY.md`.

---

## 1. What is served from where

| Piece | Host | Notes |
|---|---|---|
| API (`meyy-api.onrender.com`) | Render, Docker, free tier | Already live. Bucket B on Supabase Postgres. |
| Website (the Next.js app) | **Cloudflare Pages** (proposed) | Static files. Not yet hosted anywhere. |
| Phone app | App Store / Play | Step 9. |

### The website is a STATIC SITE, and this was verified, not assumed

`web/` has **no server-side features whatsoever** — no route handlers, no `middleware`, no
`use server`, no `next/headers`, no dynamic route segments. `web/app` contains `layout.jsx`,
`page.jsx` and three non-route folders (`components`, `lib`, `icons`, plus `ask-aruvi`). It is a
pure client-side app that talks to Render over REST, exactly as the phone does.

**So add `output: "export"` to `web/next.config.mjs`** and `next build` emits a plain `out/`
folder. Nothing needs a Node host. ⚠️ Note `next.config.mjs` has a sibling
`next.config.build-check.mjs` (which sets `distDir: /tmp/aruvi-build`) — they must not drift.

### Why Cloudflare Pages

- **Free, unlimited bandwidth, commercial use fine, no production caveat.**
- **India presence.** Far more points of presence in India than the alternatives. Our teachers are
  on budget Android handsets and school connections; that is precisely where CDN reach shows.
- Deploys from a GitHub push, the same motion as Render.

**Considered and rejected — Render Static Sites.** Tempting for one-vendor simplicity (same
account, already under the meyy.in Google login, `render.yaml` already exists). Rejected because
Render's own free-tier documentation says *"do not use them for production applications"* and free
bandwidth counts against workspace allowances. Not a tier to build a paid product on. If one
vendor ever matters more than the above, this is the fallback and the decision is cheap to revisit.

**Considered and rejected — Vercel.** Best-in-class for Next.js, but another vendor for no gain
over Pages here, and its free tier's commercial-use terms need checking for a paid product.

**Considered and rejected — Hostinger's own hosting.** The domain is there, but deployment is
FTP-shaped rather than git-shaped, and the CDN reach is weaker.

---

## 2. The domain

### Put the app at `app.meyy.in`, not at the root

★ **Decide this before anyone bookmarks anything.** Play requires a publicly reachable privacy
policy URL for the listing (§3), and the App Store the same, so `meyy.in` will need to serve an
ordinary web page regardless. Keeping the root free for that page — and later for anything
marketing-shaped — costs nothing today and saves a migration once teachers have the app
bookmarked.

| Host | Serves |
|---|---|
| `meyy.in` | the public pages: privacy notice, user agreement, support address, a one-screen "what Meyy is" |
| `app.meyy.in` | the teacher's app (the Next.js export) |
| `meyy-api.onrender.com` | the API (no custom domain needed; revisit only if it becomes teacher-visible) |

### DNS at Hostinger — and the one thing that must not break

Add a **CNAME** for `app` pointing at the Pages target. Leave every other record alone.

⚠️ **Do not switch nameservers casually.** Google Workspace's MX records live in that zone, and
`support@meyy.in` is printed on every invoice, every support acknowledgement, in the user
agreement and inside the app itself (`config.SUPPORT_ADDRESS`, mirrored in `Settings.jsx`).
Breaking mail breaks the support channel, which is the product's only support channel by design.
If DNS is ever moved to Cloudflare for the CDN benefits, copy **MX, SPF, DKIM and DMARC** across
first and verify mail flows both ways BEFORE cutting over.

### Then update CORS

`ARUVI_CORS_ORIGINS` on Render must name the new origin (`https://app.meyy.in`, and
`https://meyy.in` if the root ever calls the API). Until it does, every API call from the hosted
site is blocked by the browser and the app appears completely broken while the API is perfectly
healthy.

---

## 3. ⚠️ The privacy policy URL — THE BLOCKER, and it is three problems, not one

Google requires a privacy policy to complete the **Data safety** form, without which a listing
cannot be submitted, and states that where it finds *"a discrepancy between your app behavior and
your declaration"* it may take enforcement action. The App Store requires the same URL plus its
own privacy labels. As things stand **we would not pass**, for three separate reasons.

> ★ **FOUNDER'S TRIAGE, 2026-09-20.** (a) **3a rides with the site rejig** — the public
> `/privacy` and `/agreement` pages are built when `docs/web_desktop_view.md`'s work is done, not
> as a separate errand. (b) **3b is already in hand** — the notice has to be right for every mode
> of Meyy, not just for a store listing, and that work is running. (c) **3c is not a worry** — the
> design came at this correctly from inception, so the form has true answers to give; the task is
> transcribing them faithfully, not discovering them.
>
> ⚠️ **One dependency 3b carries that is not ours to schedule.** Two of the sixteen blanks —
> **[SMS provider]** and **[registered office address]** — cannot be filled by writing. DLT/SMS is
> parked on company registration (implementation map, §2 Step 9), and Textlocal shut down
> 2026-07-31, so real SMS has no provider named yet. That chain — company registration → DLT →
> a named SMS provider → the notice's blank → the store listing — is the longest pole in the
> launch, and it is external. Worth starting before the walk ends rather than after.

### 3a. No public URL renders the notice at all  ← structural

`data/cloud/content/legal/privacy_policy_v0.1.md` exists, and `GET /legal/privacy` is
deliberately **open** (no `X-Aruvi-User`) so a teacher can read it before typing her number. But:

- That route returns **JSON from the API host**. A reviewer opening it sees raw data, not a policy.
- The notice's human form is `PrivacyNotice.jsx`, **a screen inside the app** reached by tapping a
  link. `web/app` has no routes, so there is no `meyy.in/privacy` to give anybody.

**Fix:** a real HTML page at `https://meyy.in/privacy`, generated from the same markdown file so
there is never a second copy to drift (the one-copy-versioned-by-filename rule, CLAUDE.md §4).
Plain HTML, no app shell and no JavaScript needed to read it — a reviewer, a regulator and a
teacher on a dying connection all get the same page. Same treatment for the user agreement.

### 3b. The document is still a draft, and says so

16 bracketed placeholders remain, including **[registered office address]**, **[hosting and
database provider]**, **[payment gateway]**, **[SMS provider]**, **[country]**, **[value]**,
**[DECIDE]** and **[accountant to confirm]** — and the footer reads *"Draft v0.1 · 2026-09-04 ·
For legal review before publication."* A reviewer who opens that sees an unfinished document.
Open items are tracked in `docs/legal/privacy_policy_considerations.md`.

**Fix:** fill the brackets, take counsel's review, publish as `privacy_policy_v1.0.md` (a NEW
file — published text is never edited).

### 3c. The Data safety form must agree with it

Whatever the notice says we collect, share, retain and transfer has to match the Play Console
declarations line for line. Ours has genuinely unusual entries a form will ask about and which we
must answer consistently:

- the **trial ledger** (an HMAC of the mobile number) deliberately **survives erasure**;
- the **consent ledger**, **invoice series** and **support series** likewise sit outside the
  erasure walk;
- mobile number as the account identifier; SMS OTP via a third party.

Five places already state what survives an erasure (notice §7, agreement §C and §G, `_KEPT` in
`data_rights_service_file.py`, and the ledger's placement). **The Data safety form becomes the
sixth, and it must not be the one that disagrees.**

---

## 4. The cold start, which publishing makes real

The API is on Render's free tier and spins down after ~15 minutes idle. Today only we notice.
The morning a teacher opens Meyy from a public URL, she waits for a cold start — plausibly 30
seconds or more — on the screen that is supposed to feel like being met (§4, "the Monday-morning
feel"). A paid instance removes it. This is a product decision, not a hosting one, but publishing
is the moment it starts costing something.

---

## 5. Order of work

1. Finish the walk (`docs/walk_tracker.html`). Nothing below depends on it, but it is the
   priority and §6 items touch the web build.
2. `output: "export"`; confirm a clean `out/`.
3. Public pages built from the legal markdown: `/privacy`, `/agreement`.
4. Privacy notice v1.0 — brackets filled, counsel reviewed.
5. Cloudflare Pages project; `app.meyy.in` CNAME at Hostinger; MX untouched.
6. `ARUVI_CORS_ORIGINS` updated on Render; sign in end-to-end from the hosted site.
7. Decide on the paid API instance (§4).
8. Store listings: privacy URL, Data safety form, App Store privacy labels.
