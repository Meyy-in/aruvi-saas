# Mobile migration plan — the external stack, and the order of work

*Decided 2026-09-09. Companion to `mobile_migration_assessment.md` (the measurement, 2026-09-04);
this is the plan. Supersedes the assessment's §7 phasing where the two differ.*

## 0. The stack (founder, 2026-09-09)

| Concern | Choice | Behind which port |
|---|---|---|
| API host | **Render** — one Docker web service + one persistent disk | — |
| Database | **Supabase Postgres** | the 15 `*Repository` ports in `ports.py` |
| Identity | **Supabase Auth**, phone OTP | `AuthProvider` (`_current_identity()` is the ONE caller) |
| OTP delivery | **an Indian SMS provider** (Textlocal native in Supabase; MSG91/Kaleyra/Exotel via the Send-SMS hook) | inside Supabase Auth |
| RLS / backups / admin | Supabase | — |
| Payments | **deferred** — beta on `ManualBillingProvider` grants, no purchase screen in the app (assessment §5B) | `BillingProvider` |
| Content (Bucket A-serve) | in the image for the beta; Supabase Storage later | `Storage` (five methods) |

**What this changes in the assessment:** its Step 0 was "container + volume, Supabase can
follow." Choosing Supabase now folds Phase 4 (Auth + DB, CLAUDE.md §9 item 1) into the mobile
track. It stays *under* the screens: the rule from assessment §8 — **each step ships a screen
against the live API** — is kept, and the Postgres move happens port by port underneath.

## 1. Two decisions taken as defaults (say so if either is wrong)

1. **The web channel switches to Supabase Auth at the same time as the app.** One identity
   path; `HeaderAuthProvider` survives only behind an env flag for local dev and the stdlib
   tests.
2. **First mobile screens ship against the Render disk, not against Postgres.** The ports
   guarantee the screens cannot tell; waiting on 15 adapters before the first screen would
   invert the assessment's own rule.

## 2. Tracks

### Track A — deployed API on Render ★ LIVE 2026-09-09 — https://meyy-api.onrender.com

`Dockerfile` · `.dockerignore` · `render.yaml` · `deploy/entrypoint.sh` · `deploy/smoke.sh` ·
`deploy/README.md` (the deploy steps). `api/config.CORS_ORIGINS` (env `ARUVI_CORS_ORIGINS`,
comma-separated; `*` = today's open behaviour) replaces the hardcoded `*`; the middleware
also exposes `ETag` and `Content-Disposition`, which cross-origin JS could not read before.

Three facts the repo settled while building it:
- **`data/cloud/` is tracked in git** (CLAUDE.md §5's "everything under data/ is git-ignored"
  was stale — `.gitignore` says so itself). So Render's clone already carries the 81 MB
  content tree and no sync step exists. **`data/authoring/` is tracked too**, which is why the
  image copies NAMED paths only and `.dockerignore` refuses the founder-secure roots twice.
- State is never in the image. The disk at `/var/aruvi` holds Bucket B; the entrypoint seeds
  ONLY the three seller-side stores outside the tenant shape (`invoices/_series`,
  `support/_series`, `consents/_ledger`) and only onto an empty disk — numbering continues
  (MEY/2026-27/78xx, MEY-S-…) rather than restarting. A production disk starts with no teachers.
- The served-plan cache is written into the container's own content tree and is lost on
  redeploy — a reconstructible ~ms cache, warm-from-zero (CLOUD_DATA_MODEL §1).

Verified (Python 3.12 + dash, the image's runtime; Docker Hub was unreachable from the
sandbox so the first real `docker build` is Render's): seeding, no re-seed on second boot,
smoke green, plan serve 34 ms, DOCX export, erase, CORS fencing. **Deployed the same day** via Blueprint from `Meyy-in/aruvi-saas` (repo transferred to the
new GitHub org that afternoon; Render signed up under the meyy.in Google identity): the
smoke, a plan serve and an erase all passed against the public host, ~100–200 ms per call.
⚠️ `onrender.com` is unreachable from the Cowork sandboxes (proxy 403) — verify through the
browser, not curl.

### Track B — Supabase Auth + Indian OTP ★ LIVE LOCALLY 2026-09-09 (Render flip owed)

Built, both halves, behind a mode switch so nothing changes until it is flipped:
- **API:** `aruvi_core/adapters/supabase_auth_provider.py` verifies the Supabase access
  token offline (ES256/RS256 via cached JWKS, HS256 legacy secret); `config.AUTH_PROVIDER`
  (`ARUVI_AUTH_PROVIDER` = `header` | `supabase`) picks the adapter in `api/main.py`'s one
  wiring block; `_current_identity()` reads `Authorization: Bearer` in supabase mode and
  X-Aruvi-User in header mode — never both, so neither header can be forged into the other
  mode. A refused credential is a 401 in the provider's words. `Identity.phone` (new,
  optional) lands on the account record at JIT creation. `PyJWT[crypto]` added to
  `api/requirements.txt`. `tests/test_supabase_auth.py` (14 checks, no network).
- **Web:** `web/app/lib/auth.js` (supabase-js client, `sendOtp`/`verifyOtp`, a SYNCHRONOUS
  `accessToken()` because `withUser()` is sync, `authHeaders()` for the pre-sign-in fetches,
  `signOutAuth()`); `withUser()` sends the bearer when a session exists (the dev header rides
  along — the API honours exactly one); Login.jsx does the real OTP when
  `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` are set (six boxes, paste/autofill-aware, Resend) and
  **the returning sign-in now verifies by OTP too** — under the stub it admitted a known
  number on sight; the session id comes back from `/onboarding/verified`, not from the box
  she typed. Agreement/SubscribeFlow's hand-built headers go through `authHeaders`.
  `web/.env.local.example` documents the two public vars. `next build` clean.
- ★ **THE IDENTITY STAYS THE MOBILE.** Supabase verifies the number; the account key is the
  10-digit national number derived from the token's `phone` claim (`identity_from_claims`,
  the ONE decision point — flipping to `sub` is one line there). Every existing contract
  (`/onboarding/known`, email→mobile, invoices, localStorage keys) is untouched.
  Consequence: a changed number is a new account; Supabase's phone-change flow stays OFF.

**Supabase project `meyy`** (founder, same evening; org Meyy, Free plan, region Mumbai,
email login under meyy.in, Data API's "auto-expose new tables" OFF — the API is the fence):
`https://npgqolatfnpvxaehdjiu.supabase.co`, ES256 signing keys (legacy secret already
migrated, so no `ARUVI_SUPABASE_JWT_SECRET` anywhere). Phone provider enabled with
Textlocal placeholder credentials until DLT; OTP length 6 (Supabase's minimum — 4 was
asked for and is not offered), expiry 300 s, message `{{ .Code }} is your Meyy sign-in
code. Never share it with anyone.` (must later match the DLT-approved template exactly);
test numbers `919000000001–3 = 123456`, valid to 2026-12-31.
**Live pass on the Mac** (`.env` ARUVI_AUTH_PROVIDER=supabase, `web/.env.local` set):
Create → OTP → in as `9000000001`; token ES256 verified by the API; bearer → 200, the dev
header alone → 401; account file carries `phone`; returning sign-in → OTP (paste spreads
across six boxes) → in; a STALE stub session (localStorage id, no token) now bounces to the
front door — the readiness rehydrate treats 401 as "refused", not "no profile" (page.jsx).
Phone width by arithmetic (320px content, 304px row); live 360px screenshot owed.
★ **Render flipped to `ARUVI_AUTH_PROVIDER=supabase` 2026-09-10** and verified from Chrome:
dev header 401, no credential 401, a real Supabase session (test number, via Auth's REST)
→ `/onboarding/verified` registered `9000000002`, account/entitlement 200, erase 200. Only
bearer callers reach the deployed API now (`deploy/smoke.sh` takes `SMOKE_TOKEN`).
**Still owed:** real SMS after company registration →
DLT (Textlocal key + DLT header + approved template into Supabase's Phone settings; remove
the test numbers then).

- **DLT is the long pole** — and it waits on the company registration (in progress). Transactional SMS in India needs TRAI DLT entity registration, a
  sender header and an approved OTP template — days to weeks, regardless of provider. File
  it before writing code.
- Supabase issues/verifies/rate-limits the OTP; the provider only delivers. Textlocal is a
  native Supabase option; MSG91/Kaleyra/Exotel go through the *Send SMS* auth hook.
- Backend: `SupabaseAuthProvider.verify_token()` verifies the Supabase JWT (JWKS),
  `user_id = sub`, `tenant_id = sub` (the individual-teacher stub carries over);
  `_current_identity()` reads `Authorization: Bearer …`. The `0000` stub dies here, not at the
  assessment's step 5.
- Client: `supabase-js` `signInWithOtp` → `verifyOtp`; the access token goes to FastAPI.
- `Account.privacy_notice` stamping at `/onboarding/verified` and the consent ledger are
  keyed by the identity — they move unchanged; the ONLY thing that changes is what an id IS.

### Track C — Postgres under the ports ★ LIVE ON SUPABASE 2026-09-10

**Decision (founder, 2026-09-09): individual ports, ONE shared storage underneath.** Not
fifteen tables — one document table. Every file adapter was domain logic around the same
private "read JSON / atomic write / delete / list" copy; that copy is now
`aruvi_core/adapters/document_backend.py` (`FileBackend` = today's tree, `PostgresBackend`
= one `documents` table keyed by the same '/'-joined key). The fifteen repository classes
keep their ports, their names and every merge/ts/series rule; only their bottom changed.
`config.state_backend()` builds THE backend from `ARUVI_STATE_BACKEND=file|postgres` +
`ARUVI_DATABASE_URL`; `api/main.py` hands it to every store in its one wiring block; the
founder CLIs (`entitlement.py`, `erase.py`) use the same. `psycopg[binary,pool]` added.
- **Verified in the sandbox against Postgres 16:** the backend contract on both
  implementations (incl. 8-thread counter race, nested lock, prefix boundaries, escape
  refusal); `migrate_state_to_postgres.py` on the real dev estate — 198 documents, 0
  differing, re-run idempotent; the API in postgres mode through a full teacher journey
  (profile · sections · support `MEY-S-742` · invoice series · export · erase leaving
  only the seller-side rows); and **the existing API-level suites unchanged, in postgres
  mode: 14/14** (test_api, consent, support, data_rights, privacy, entitlement, invoice,
  year_scope, plan_notes, supabase_auth, academic_year, year_plan_export, notifier).
  File mode: the whole suite as before.
- RLS enabled on `documents`, no policies: the API connects as the table owner (bypasses),
  the anon key sees nothing — the fence stays `_current_identity()`, as decided.
- `repair_ppw.py` / `migrate_step01.py` are file-layout tools and stay so.
- ★ **CUT OVER 2026-09-10 (founder, from the Mac):** `migrate_state_to_postgres.py` against the
  Supabase session pooler — 198 copied, 0 missing, 0 differing; Render env
  `ARUVI_STATE_BACKEND=postgres` + `ARUVI_DATABASE_URL`; smoke through Chrome read the
  migrated accounts, profile, entitlement and support history back from the public host
  (100–600 ms/call). Two lessons: a mistyped password made the pool retry until Supabase's
  circuit breaker blocked the host for minutes — `PostgresBackend` now probes ONCE and fails
  fast; and the password was pasted into chat, so it was reset before the cut-over. The Render
  disk is a dead snapshot: keep it a week as the rollback (unset the two vars), then drop it
  from `render.yaml`. `data/cloud/state/` on the Mac is dev data + the pre-migration snapshot;
  production never writes there.
- **Was owed (kept for the record):** run the migration against Supabase from the Mac
  (`ARUVI_DATABASE_URL` = the project's *session pooler* string; Render is IPv4-only, the
  direct `db.<ref>` host is IPv6), verify, set `ARUVI_STATE_BACKEND=postgres` +
  `ARUVI_DATABASE_URL` on Render, smoke through Chrome; then the Render disk is a
  snapshot to retire. Supabase Pro before real teachers (backups/PITR, no auto-pause).

The original per-store ordering, kept for when a store graduates to its own table:

Follow `CLOUD_DATA_MODEL.md` table shapes. Each adapter sits behind its existing port, is
swapped in the one wiring block of `api/main.py`, and must pass the existing suite. Order =
the order a teacher meets them:

1. `accounts`, `academic_years` — identity lands → account row
2. `readiness`, `allocations` — FirstRun
3. `section_state`, `section_history`, `prepared_plans`, `plan_archive`, `plan_notes` — the teaching loop
4. `consents`, `entitlements`, `support`, `invoices`, `erasure_log`, `outbox` — Settings/admin
5. the three outside-the-shape stores get their own tables the erase traversal cannot reach —
   same rule, new home

`aruvi-scripts/migrate_state_to_postgres.py`, idempotent like `migrate_cloud_layout.py`.
RLS on every table, keyed `tenant_id, user_id` — and be plain about it: FastAPI holds the
service-role key, so RLS is defence in depth; **the fence stays `_current_identity()`.**
Point-in-time recovery on for the beta. When group 5 lands, the Render disk goes.

### Product check on the production stack ★ PASSED 2026-09-11

The full web product, local build pointed at Render (`NEXT_PUBLIC_API_URL`), driven live by
Claude in Chrome as a fresh teacher: sign-in → first run → serve → note → LessonView → mark
complete → support (`MEY-S-752`, series continued) → exports → sign out → returning OTP
sign-in restores 9A at unit 2 from Supabase alone. Findings (MEMORY.md 2026-09-11): wheel
sentence lag; **My Classes flashes "Pick a chapter" until `/plans` loads on a real network**;
sign-out residue. Track D can start.

### Track D — Expo ★ STEP 1 DONE 2026-09-11 (`packages/shared`)

Assessment §7 steps 1–4: `packages/shared` + the synchronous MMKV storage shim (web stays
green), scaffold + tokens + fonts, **LessonView first**, then the two list screens, FirstRun,
Settings/Ask Meyy/share-sheet exports. One difference: Login/OTP in step 1 is Supabase.

**Step 1 — `packages/shared` (`@aruvi/shared`, npm workspace at the repo root).** The whole of
`web/app/lib/` (format, sectionState, sectionHistory, verify, legalmd, auth) and
`ask-aruvi/{bank,askAruviSearch}.js` lifted verbatim except at three seams, all injected at boot:
- `storage.js` — `setStorage({getItem,setItem,removeItem,keys})`, SYNCHRONOUS (the caches are
  read during render — assessment §3's reason for MMKV over AsyncStorage). Web installs
  `webStorage()` (localStorage); the phone will install an MMKV adapter; until either does, an
  in-memory map stands in, which is how the node tests and SSR run.
- `config.js` — `configure({apiBase, accessToken})`; `API` is a live ESM binding, so the old
  `window.location`-derived host and the auth import are gone from shared code.
- `auth.js` — `configureAuth({client})`: the app creates its own supabase-js client (web:
  localStorage; phone: an MMKV adapter, `detectSessionInUrl:false`) and the package imports no
  Supabase code. Zero dependencies in the package, so Metro and webpack both see plain ESM.
- The two React-building helpers became data: `boldMarks` → `parseBold()` (runs), `renderMarkdown`
  → `parseMarkdown()` (blocks; never emits markup, the legalmd header's reason survives). The web
  wrappers render them to the same `lgl-*` elements — **byte-identical HTML on all five legal
  documents** (react-dom/server, old vs new).
- NEW `signout.js` — `clearTeacherCaches(extraPrefixes)`: the live walk's finding (sign-out left
  `current_chapter_*`/`lu_*`/`chapter_notes_*` behind) fixed at the source; page.jsx's onSignOut
  calls it and both apps share the list of per-teacher prefixes.
- Web: `web/app/lib/*.js` are thin re-exports (`shared-setup.js` installs storage/API/client and
  every wrapper imports it first); components untouched; `next.config` gets
  `transpilePackages`. Verified: `packages/shared` node tests 9/9; babel-parse ×23; every
  import in `web/app` resolves (138); CSS braces even. **`next build` on the Mac is owed** —
  neither sandbox reaches the npm registry, so run `npm install` at the root, then
  `npm --prefix web run build`.
`next build` on the Mac: clean (2026-09-11, founder).

**Step 2 — the Expo scaffold (`mobile/`, installed on its own — NOT a workspace: hoisting its React 19 tree beside the web's React 18 gave react-native a stray third React, expo-doctor 2026-09-11; it links `@aruvi/shared` by `file:` path and Metro refuses hierarchical lookup) ★ AUTHORED 2026-09-11, first run on
the phone owed.** Expo managed + Expo Router, presentation only:
- `lib/boot.js` — the phone twin of the web's shared-setup: storage → **`expo-sqlite/kv-store`**
  (synchronous `getItemSync…`, and it ships INSIDE Expo Go). ⚠️ Decision: the plan said MMKV;
  MMKV is a native module Expo Go does not carry, so it would have made "first screen via Expo
  Go" impossible. The shim makes it a one-adapter swap at the development-build milestone; the
  contract that matters (sync reads during render) holds either way. API base from
  `EXPO_PUBLIC_API_URL`; supabase-js client with the SAME kv-store as its session storage (so
  the shared `accessToken()` cold-start fallback works), `detectSessionInUrl:false`, auto-refresh
  tied to AppState.
- `theme/tokens.js` — **generated** from globals.css by `theme/gen-tokens.py`: 48 colours per
  theme (`:root`, the dark block, the pine bar's `--bar-*`, the Ask Meyy section palette),
  aliases resolved, unflipped tokens inheriting the light value as the cascade does. The web
  stays the source; never hand-edit. `theme/fonts.js` bundles Fraunces / Newsreader / IBM Plex
  Mono via @expo-google-fonts (static 400/500/600 + italics; RN picks a font by NAME, so
  `type.js` maps roles → families). `ThemeContext` = OS scheme + the `aruvi-theme` override,
  stored through the shim (a device preference, so sign-out leaves it).
- Components: `MeyyMark` (react-native-svg, the web's path data), `Bar` (pine, cream mark,
  safe-area — no measured --nav-h), `OtpBoxes` (six, auto-advance, backspace, paste spread,
  `oneTimeCode` autofill), `Markdown` (shared `parseMarkdown` blocks → Text; tables stack into
  cards, the ≤600px rule as the only rule), `ui` (Button/Link/Field/Input/Quiet/ErrorLine).
- Screens: `app/index.jsx` gate (sync `getUser()` → no front-door flash) · `app/login.jsx` =
  the web's Login.jsx on native inputs (choose → OTP → in; returning sign-in → `/onboarding/known`
  → OTP; the id comes from `/onboarding/verified`; stub 0000 when no Supabase env). **Not
  ported by decision:** the Subscribe card + SubscribeFlow — beta on manual grants, no purchase
  screen (§0). · `app/privacy.jsx` (GET /legal/privacy, no account) · `app/(app)/index.jsx`, a
  proof screen: signed-in id, `/entitlement`, `/readiness`, theme switch, Sign out — with a
  LOADING state until both calls land (finding 1 designed in) and sign-out through
  `clearTeacherCaches` (finding 3). Ask Meyy search autofocus (finding 2) is a step-6 note.
- Versions pinned for Expo SDK 57 in `mobile/package.json` (54 was pinned first; the store Expo Go had moved to 57); `npx expo install --fix` is the
  authority on the exact native set. Verified here: babel-parse ×16, every relative and
  `@aruvi/shared/*` import resolves. **Owed on the Mac:** `npm install` (root) →
  `cd mobile && npx expo install --fix && npx expo-doctor && npx expo start` → Expo Go on the
  founder's phone: sign in with a test number → the proof screen shows `9000000003`'s profile
  and 1/3 trial chapters from Render → Dark → Sign out → returning sign-in.
★ **STEP 2 VERIFIED on the founder's iPhone 2026-09-12** (Expo Go, tunnel; SDK 54→57): signed in
`9000000003`/`123456` → real record from Render+Supabase (Social Sciences · Class IX, trial 1/3).
En route, fixed a production regression: `ARUVI_AUTH_PROVIDER`/`ARUVI_STATE_BACKEND` were flipped
to supabase/postgres only in the Render dashboard, and a Blueprint sync reverts dashboard values
back to render.yaml's `value:` on every deploy — so a redeploy had knocked the WHOLE product back
to header auth + the disk. Now pinned in render.yaml (commit 41be8c6d). Rule: persistent env goes
in the file, not a dashboard-only edit.

**Step 3 — LessonView + My Classes (AUTHORED 2026-09-12, phone test owed).**
- `mobile/components/LessonView.jsx` — the teaching screen, ported from the web's. Data comes
  IN as `view` (never fetched here). A unit = one `view.lesson_plan.groups[].periods[]`
  (flattenUnits walks children too). Unit strip (scrollable pips, ‹/›, marks the teaching
  pointer). Four tabs: Overview (Chapter/Focus=`meta.section_anchor`/Time=`meta.duration_minutes`/
  Pedagogy=`approach` + learning_outcomes), Material (`materials` checklist + typed
  `meta.visual_aids` tables/prose), Lesson (teacher_notes ribbon → `phases[]` spine with a
  tappable bookmark → homework via parseBold → the completion footer), Assess (items filtered by
  `meta.anchor_period === unit.number`; MCQ options with reveal, teacher_guide, cognitive demand;
  `visual_stimulus.type==="svg"` via react-native-svg SvgXml). Mark-complete/undo/reopen and the
  bookmark use the shared sectionState helpers.
- NEW shared helpers (additive, web untouched): `readUnitPointer/setUnitPointer/readChapterDone/
  setChapterDone` — the phone's LessonView writes lu_pointer_/lu_done_ through these, same keys +
  pushSectionState as the web's inline writes.
- `mobile/app/(app)/lesson.jsx` — the route: params {subject,grade,filename,section}, pulls the
  section's server state, fetches `/plans/{s}/{g}/{file}/view`, renders LessonView (loading state
  until both are in). Opened WITH a section = tracking; without = read-only preview.
- `mobile/app/(app)/index.jsx` — now My Classes (was the proof screen): one card per
  subject·grade·section from readiness; the attached chapter shows CONTINUE + "unit N" and opens
  in tracking; other prepared chapters open read-only. pullSectionState on load; a loading state
  until /plans arrives (finding 1). Plan status + theme + sign-out sit at the foot until Settings
  (step 6). The section→lesson "+" binding and full My Lessons library are step 4.
- Verified here: babel-parse clean on all three + LessonView; every `@aruvi/shared/*` import
  resolves; shared tests still 9/9. **Owed on the phone:** reload → My Classes shows 9A → Continue
  opens Social Sciences Ch1 at unit 2 → tab through Overview/Material/Lesson/Assess → move the
  bookmark → Mark unit complete (pointer → unit 3, server updated) → Undo → back.

★ **PARITY PASS (founder rule, 2026-09-12): the phone matches the web by default** — now in
CLAUDE.md §4. The first cut had diverged (a top pip strip instead of pvNav, learning outcomes
added to Overview, a flat Assess, no ChapterOrg). Re-ported 1:1 from the web's JSX:
- `LessonView.jsx` — the web's anatomy: ChapterOrg landing (preview opens on it; tracking via
  "← Orgn."), pinned header (kicker "social sciences·IX·Ch. 01" · "← Orgn." · "{n}. title"),
  tab bar, panel, `pvNav` at the END of the body ("‹ Chapter org." / "← Previous unit" ·
  "Unit n / N" · "Next unit →"; dropped units paged after, "Dropped sections →", "✦" title +
  "Dropped section · for self-study · not scheduled"). Overview = the web's four ledger rows
  exactly (Chapter · Section/Spine/Stage… · Time · Pedagogy; SS shows `section_anchor`).
  Material = "Prepared table · title" / "Prepared text". Lesson = "Teacher notes" ribbon (open,
  tap collapses to a teaser; the "Refer to Prepared Table…" lead bolded), the phase spine with
  `phaseMin` (Number.isFinite, so string minutes fall back to the label as on the web), homework.
  completionUI strings verbatim ("Mark this unit complete" / "Mark chapter complete" / "Unit
  complete ↺ Undo" / "Chapter complete ↺ Reopen"). Paging remounts the tabs (key={previewAt}).
- `lesson/PhaseBookmark.jsx` — the clay arrow, PanResponder drag, snaps to the nearest
  measured phase centre; tap on the minutes = the web's arrow keys (named touch translation).
- `lesson/ChapterOrg.jsx` — topbar/title/"{n} Learning Units 1 × 50 min"/tick rail/axis legend
  ("The map" / "Units" / Stages·Sections·Competencies·Spines with the web's blurbs) + the ochre
  "Notes" gutter tab → ChapterNotesModal (all the web's strings incl. the child-privacy warning,
  "{wc} / 500 words", Speak, Save; lapsed → read-only "Renew to write notes…"); body = the SS
  competency MAP (ribbons drawn with react-native-svg between onLayout-measured rows, focus
  dims/opens exactly as the web, "Taught in full — builds no competency edge, by design", "Tap a
  unit or a competency to follow its connections"), the maths-prep flat list, or the accordion
  (science section titles stripped, SS competency labels truncated to 12 words while closed).
- `lesson/AssessPanel.jsx` — the full family: pager "← Previous · Question n / N · Next →",
  sub-tabs Overview · Question · Answer(if hasAnswer) · Inclusivity(if any), "Q{n}." mark,
  AOverviewPanel rows (Competency · Learning outcome · Section · Question type (full words) ·
  Cognitive demand), AQuestionPanel (passage / TF / interleaved / parts / plain stems, audio_ref,
  ATyped svg|number_line|table|prose, plain options, WHAT TO PRODUCE, SCAFFOLD, READING THIS
  TASK, TEXTBOOK EXERCISE with the quoted description), AAnswerPanel by template (CORRECT ANSWER
  ✓ rows, ANSWER, WHAT EACH CHOICE REVEALS with the "Choice X" popup, SUGGESTED ANSWER, LOOK FOR,
  EXPECTED ELEMENTS, METHOD, ANSWER KEY, SPEAKING RUBRIC, WORKED ANSWER), InclusivityText
  (Support/Stretch/Challenge emphasis, maths splits), ALegacyCard, "Question →"/"Answer →"/"Next
  question →" inline nav. `itemTabSet`/`groupedOptionSets`/`qtypeName` verified IDENTICAL to the
  web's on the 20 real items + a grouped case + 7 type names (node, transpiled side by side).
Phone re-test owed (same walk as before, plus: "← Orgn." → the SS map → tap a unit → "→";
Assess → page questions → sub-tabs → "Choice X"; drag the bookmark).

★ **BOTTOM NAV (founder, 2026-09-13; web `bbe00d7a`, Expo this commit).** The app's entire nav
moved from the top tabs to one bar at the foot — My Classes · My Lessons · Add · Ask Meyy — and
it lands on BOTH surfaces, as §4 requires. Web: `.bnav` after `.bodycontent` in `page.jsx`, skin
"option A + edge 4" (sunk paper, 1px `--edge` top rule, clay active + underline), static in the
app shell so it cannot scroll away, hidden in Settings, contents capped to `--shell-w`; the
greeting-row "+" buttons left `MyPlans.jsx` and the tour's four bar anchors flipped to
`place: "above"`. Expo: `mobile/components/BottomNav.jsx` mounted in `app/(app)/_layout.jsx`,
measures in `theme/web.js` under `bnav*` (390×844: bar 56.85, items 84 wide, label 10.5/13.75,
letter-spacing 1.05, rule 22×2.5), the four glyphs copied path for path, safe-area inset as
padding inside the bar.
- Verified on the parity page at 390: web bar sits at the foot with `.bodycontent` ending exactly
  at its top (786.90 = navTop), four items at x 10/105/201/296, Settings hides it and the body
  reclaims the space, the last lesson phase drops its rule so there is no double line, dark theme
  reads as a floor (bar #11170f under body #161d19), and at Mac width the items sit over the
  860px column. Expo web renders item-for-item beside it.
- **Owed on the phone (iPhone 14, `npx expo start --tunnel`):** the bar over the home indicator,
  the four glyph weights, and the active clay underline against the web frame.

**Step 4a — the My Classes "+" binding (2026-09-13).** The improvised "Open another chapter"
browse list is gone; the screen now carries the web's actual card and its actual picker.
- `mobile/components/AttachSheet.jsx` — `AttachSheet` (the "+" track-a-chapter picker) and
  `UntrackSheet` (the "−" confirm), both ports of MyPlans' `attachModal`/`untrackModal` over one
  shared `Sheet` (dimmed ground, ✕, ochre kicker / Fraunces title / sub). The picker's filter is
  the web's, clause for clause: only chapters SHE prepared, plus any bound to a SIBLING section of
  the same subject·class, never the one already on this section, never an archived plan.
- `app/(app)/index.jsx` — `ClassCard` rebuilt in the web's three states (st-new sand · st-going
  green · st-done clay, each with its own edge and a 4px spine), tag + optional section name,
  kicker, two-line title, duration line, the unit rail (done pine / current ochre / rest
  card_tick), and the right slot: "+" to track on an empty or finished card, "−" to untrack while
  teaching. Handlers mirror the web's: attach binds through the shared writer and bumps a tick so
  the card refreshes at once (the web's "+ works late" lag, designed out); untrack logs history
  only past ≥1 unit (the anti-noise gate); a completed card moves on with no confirm and opens the
  picker for the next chapter.
- `theme/web.js` — `sc_*`, `ap_*` and `ch_*` measures read off the live web at 390.
- ⚠️ **One deliberate structural difference, named as CLAUDE.md §4 requires:** the card's tap
  target is the tag + body, not the whole card. The web nests a `<button>` inside a clickable
  `<div>` and calls stopPropagation; react-native-web renders a role="button" Pressable as a real
  `<button>`, and a nested button is invalid (it warns, and the inner press is unreliable). The
  row is split instead — identical on screen, and the actions simply are not inside the card's
  press target, which is what stopPropagation was simulating.
- The web's 11px graph rule is not ported (RN has no repeating gradient); the fill carries the
  status, which is what the rule was never doing.
- Verified on the Expo web target: card in its going state with rail and "−", the untrack confirm
  opening with the web's exact words and cancelling cleanly. **Phone pass owed.**
- Deferred with their own reasons, neither changing the modal's shape: "prepare a new one"
  (PrepareLesson is step 5, so the footer would lead nowhere) and last year's lessons
  (`.ap-prior`, which needs the year record the phone does not read yet).

**Step 4b — the full My Lessons library (2026-09-14).** The bottom bar's My Lessons item is live;
the repository is a real screen on the phone, scoped to one subject·class like the web's.
- `mobile/app/(app)/lessons.jsx` — a port of `MyLessonPlans.jsx`. The frozen header carries the
  PAIRED switch ("Your lessons / Year plan" behind a hairline "/", founder 2026-09-13 — only the
  live word inked and ruled in clay, the archive box holding the right end) over the two wheels;
  the card list scrolls beneath. The web pins the header with `position: sticky`; here it sits
  ABOVE the scroller, which is the same thing on a screen that owns its scroll region (My Classes'
  greeting already does this). Cards are `.sc-card` on the DOCUMENT plane (founder 2026-08-30 — a
  lesson plan is not a class), the 4px spine alone carrying the lifecycle: sage on the shelf, pine
  teaching now, clay all done. The status line is the web's, exhaustive and single-colour,
  completed first. The prepared filter is clause for clause, `prepared_source_year && !prepared`
  excluded so last year's work cannot flood this year's list. Archive works both ways, through
  `verifiedWrite` + `planIsArchived`, with the web's optimistic flip, its two toasts and its rule
  that an attached plan simply has no archive affordance.
- `mobile/components/RollWheel.jsx` — the web's `peek` wheel. `snapToInterval` +
  `decelerationRate="fast"` for the web's scroll-snap; the list rendered THREE times with the box
  riding the middle copy and silently recentring, so rolling wraps for ever; one cycling ▼ that
  commits the pick BEFORE it moves the box, so a throttled animation can never leave it a no-op
  (the web's B1 fix). `adjustsFontSizeToFit` stands in for the web's measured auto-fit, so
  "Mathematics" shows in full on a narrow column. ⚠️ Divergence: the web also steps on arrow keys;
  there is no keyboard here, so that handler has no counterpart. Nothing visible differs.
- `mobile/components/YearPlan.jsx` — the whole teaching year for one subject·class. Suggested and
  Your plan side by side, both computed on this side from `largestRemainder` and
  `annualBudgetPeriods` in `@aruvi/shared/format` — the SAME functions the web calls, which is the
  point: a second implementation of that arithmetic is how the 2026-08-21 defect happened (Year
  Plan said 14 where the chapter step said 19). The table is one raised object; the note sits
  below the totals and always shows.
- `theme/web.js` — `mlp2_*`, `yp_*`, `rw_*`, `sc_metarow`, `sc_yearstamp`, read off globals.css at
  the **≤600px phone sizes**, not the base ones. That distinction is load-bearing: the switch's
  phone sizes live in a ≤600px block placed deliberately AFTER the base rules, because they were
  silently dead for months when they sat earlier in the file (the `.ap-row-line` trap, third
  occurrence). Taking the 23px base here would have reproduced that bug on the phone.
- ⚠️ **Four things deferred, each with its own reason** (CLAUDE.md §4 — divergences are named):
  (1) the PROPOSED card and the prepare CTA — both downstream of PrepareLesson, which is step 5;
  nothing on this phone can set `preparing`, and a CTA that leads nowhere is the call step 4a made
  about the picker's footer. (2) The REPORTS modal — the web downloads a blob through an anchor
  with `download`, and saving a file on a phone is expo-file-system + expo-sharing: a native
  dependency and a founder decision about where the document lands. The card already reserves the
  right column and the 82px floor, so adding it moves nothing. (3) Last year's folders and
  `notePlansYear` — they hang off `yearInfo.prior_years` and the phone does not read the year
  record yet, the same reason 4a deferred the picker's `.ap-prior`. (4) The guided tour's steps
  3–7, which have no phone counterpart to drive.
- ★ **Two store defects found on the way through, both fixed** — archive/restore never invalidated
  the shared listing (web, live since `cab83c07`), and the phone's attach never invalidated either,
  which since the speed work's `total_units` change meant a freshly attached card had no unit rail
  until the app restarted. Full account in MEMORY.md, 2026-09-14.
- Verified here: all five files babel-parse clean; every relative and `@aruvi/shared/*` import
  resolves, including each named export against the module it is imported FROM (not merely against
  the package); shared tests 18/18; API tests 32/32 once the committed test residue is cleared
  (see MEMORY.md — that residue is an open founder call, not a code defect).
- **Review pass, same day.** The founder caught the switch sitting almost on the top bar — the
  frozen header lives OUTSIDE the scroller, so it never took `main`'s 26px with it and
  `.mlp2-frozen`'s own 6px was the whole gap. An independent read of the port against the web
  then found six more, five of them unnamed divergences: no loading state (so `/readiness` in
  flight rendered "No subjects set up yet", a false statement about her record); no graph rule on
  the cards (the web carries it on the `.sc-card` BASE rule, so My Lessons inherits it); no
  "skip while a plan is open" guard on the section sync; a `key={tick}` that remounted every card
  on each 20s sync; the wheel and static boxes hardcoded to light; and the Year Plan's plane and
  dashes off their tokens. All fixed. One finding was WRONG and was not taken — `.sc-title`
  clamps to two lines in CSS, so `numberOfLines={2}` was already right; worth recording that the
  review's hit rate was six of seven, so its findings are worth checking rather than applying.
- ★ **The wheel's ▼ was broken on BOTH surfaces, and the port is what exposed it.** RollWheel
  reparks on `[items]` — "whenever the wheel (re)mounts or the list changes" — but `subjectItems`
  and `gradeItems` are rebuilt every render, so the effect fired every render, including the one
  `stepCycle` causes when it commits the pick before animating; its direct scroll then landed on
  the arrow's own target and cancelled the roll. Memoising both lists restores it, on the web too.
- **Owed on the phone (iPhone, `npx expo start --tunnel`):** My Lessons from the bar → the two
  wheels roll and wrap, and the ▼ cycles → a lesson card opens read-only and comes back → archive
  a detached plan, the box appears with its count, open it, Restore → cross to My Classes and back
  and confirm the archive HOLDS (this is the bug above, so it is the test that matters) → the Year
  plan half: the table, the totals, the note → attach a chapter on My Classes and confirm the unit
  rail appears at once.

★ **THE PARITY AUDIT'S LAST DIVERGENCE IS SETTLED (founder, 2026-09-14): the unit title on the
chapter-organization page takes the WEB's face** — Newsreader 12 over line-height 1.3, not
Fraunces 13.5. A unit title is read as content, so it takes the body face, and §4's default
(the phone matches the web) decides the rest. Settling it uncovered two more misses in the same
rule: `.co-utitle` drops a further notch to 10.5 for **science and social_sciences** on a phone
(globals.css 3819-3822 — those two carry the longest titles and were wrapping), and
`.co-card.done .co-utitle` dims to `--ink-soft` (3825), where the phone had been dimming only
the NUMBER so a taught unit read half-finished. All three now match.

★ **STEP 4b SPEED PASS (founder, same day): the phone's screens are ROUTES.** "Web My Classes is
instantaneous but on Expo it first shows 'Loading your classes' which takes a second." On the web
these two are COMPONENTS under one shell that fetched `/readiness` once; on the phone they are
routes that each asked for themselves. Three fixes: **(a)** My Classes was awaiting FOUR round
trips in series before painting — entitlement, readiness, the section-state reconcile, the plan
listings — of which only readiness is a precondition for drawing anything; it now paints from the
device copy and lets the rest land behind it. **(b)** `packages/shared/src/readiness.js`, the
plans store's shape line for line, gives the profile the synchronous device copy it never had
(⚠️ it rethrows a 401 rather than falling back — a refusal is not a network failure). **(c)** The
bottom bar uses `router.navigate`, not `push`: the four items are PLACES, and pushing stacked a
second copy of each screen on every crossing, which is what made the loads re-run at all.
`packages/shared/test/readiness.test.js` pins it (10 tests). **Owed on the phone:** cross between
the two screens twice — the second crossing should show no spinner at all.

**Step 5a — Prepare a lesson (2026-09-14).** `mobile/app/(app)/prepare.jsx`, a port of
`PrepareLesson.jsx`: the everyday single-chapter generate flow. The phone can now make a lesson
of its own rather than only teaching what was prepared on the web.
- ONE control, as the web has since 2026-07-26: a period stepper. The duration matrix is DERIVED
  from it — her declared lengths in the weekly ratio she teaches them — and echoed back as small
  print. A duration field here would be a second place for a timetable fact to live and a second
  place for it to disagree with the profile.
- The suggestion is `largestRemainder` over the whole chapter list, against the FULL syllabus
  weight (placeholder chapters included), from the shared `format.js` — the same function Year
  Plan and `master_plan.py` use. ARV-D-142 is the reason that matters: an independent per-chapter
  round is a different number that does not conserve the budget and can ask for more periods than
  the library holds.
- Both coverage warnings (floor and surrender), the Suggestion box with its explainer, the budget
  ledger with its committed breakdown, the trial counter, the re-prepare confirm, the 402 paywall
  as a window rather than an error, and the read-after-write verify against `/plans-prepared`.
- `RollWheel` gained the BASE mode the chapter step needs — tint-pine box, a ▲▼ pair clamped at
  both ends (the list has ends; a wrap through 40 chapters is disorienting, not convenient), and
  the numbered chip. My Lessons' two wheels now say `peek` explicitly.
- `AttachSheet`'s `Sheet` is EXPORTED and reused for all three of this screen's windows — a second
  implementation of a window is how two windows start to differ.
- ⚠️ **Two divergences, named in the header:** (1) the wait happens ON this screen (the web's own
  `prep-wait` fallback) rather than as a proposed card at the head of My Lessons — the web's shell
  holds `preparing` across a tab switch and the phone's routes have no shell between them; a
  cross-route store is what moves it, and is the next step, not a redesign. (2) No preview step:
  a successful prepare returns to My Lessons with the chapter in the list, because attaching stays
  a separate act from the "+" on a section card.
- The picker's "prepare a new one" footer is STILL deferred, but for a new and truer reason: the
  destination exists now; what is missing is the RETURN, which must carry the section she opened
  the window for across a route change. A footer that prepares and then forgets that section is
  worse than no footer.
- Verified here: babel-parse clean on all 32 mobile files; every relative and `@aruvi/shared/*`
  import resolves against the module it is imported FROM; **every `ws.*` and `type.*` key
  referenced across the app exists** (342 web keys — a new standing check, and the one that
  catches a silently unstyled element); shared tests 28/28; API 32/32.
- ★ **THE PREPARE CTA IS ITS OWN IDENTITY, AND THE FIRST PORT MISSED IT ENTIRELY** (founder,
  twice: "the color of 'prepare a new lesson' button and letters on expo must match web app").
  Both buttons carry `prepare-cta` LAYERED on a base class — `.mlp-allocate-btn` in My Lessons,
  `.primary` on the prepare screen — and globals.css 3371 is where the button actually gets its
  look: a clay→ochre gradient, a warm glow, a leading ✦, `#fdf8ef` at weight 600. Porting the
  base rules alone gave a pine button with a cream label: right for the layer underneath, wrong
  on screen. **A layered class is not decoration; check for one before measuring a button.**
  Now `components/PrepareCta.jsx` — one identity, a `size` per context, which is the web's own
  division of labour. Divergences named there: the gradient is drawn with react-native-svg (RN
  has no CSS gradient, and this adds no native dependency where expo-linear-gradient would —
  the same call the graph rule made), and the inset top highlight is a hairline because RN has
  only outer shadows. The glow needs two views: `overflow: hidden` clips the gradient to the
  radius and would clip the shadow with it on iOS.
- **Owed on the phone:** My Lessons → "Prepare a new lesson" → the chapter wheel rolls and its ▲▼
  clamp at both ends → the stepper, and the mix line under it → the Suggestion's "use" and its
  ⓘ → the budget ledger and the committed breakdown → prepare a chapter and watch the five-second
  card → land back in My Lessons with it listed → prepare the SAME chapter again and meet the
  confirm.

Next: step 5b — the profile portal, and the proposed-card store, which between them light the bar's "Add"
item and unlock what 4b deferred: the proposed card, the prepare CTA, and the Year Plan's budget
pencil. Ask Meyy is step 6.

**Step 5b — the proposed card, and the wait moves to My Lessons (2026-09-14).** Founder: "iPhone
and expo when preparing a new plan takes us out into a new screen, whereas web app shows the
lesson plan generating in My Lessons itself at the top with a progress bar." Step 5a shipped the
web's own `prep-wait` fallback and named it a divergence; this closes it.
- `mobile/lib/preparing.js` is the missing SHELL. On the web `preparing` lives in page.jsx, above
  the tab, so My Lessons unmounts and remounts around it; the phone's routes have nothing above
  them. One module-level descriptor with a subscription is the equivalent, and the callback fires
  immediately on subscribe so a screen mounting mid-prepare draws the card on its FIRST render.
- `prepare.jsx` hands the descriptor over and navigates in the SAME tick. ⚠️ The request is
  deliberately NOT awaited first: the component unmounts, but the async closure does not — it
  keeps running, holds the five-second beat and resolves into the store the screen she is now
  looking at is watching. Awaiting is exactly what would keep her on the old screen. Same trick
  the web's `prepareAndHandOff` relies on.
- `components/ProposedCard.jsx` — the card at full strength in the ordinary structure (number tag
  · title · duration line), the one "not yet" signal being STRUCTURE (a dashed edge, a clay
  spine), never colour. A faded card reads as "something is missing" when every fact on it is
  already known and final. Not tappable, and `accessibilityLiveRegion` so the wait is announced.
- Three terminal states, as the web has them: CLEARED (the real card replaces it in place), FAILED
  (the card STAYS, at rest, carrying the reason — ARV-D-087: she is looking at it, and a card that
  vanishes silently reads as a mis-tap; ONE ROW, so it stays the same height as its neighbours),
  and PAYWALL (a 402 is not an error — the card comes down and a window carries the server's own
  sentence, raised in My Lessons because by then the prepare screen is gone).
- The web's dedupe and hoist came with it: chapter + matrix is the key, because the served
  filename derives from that pair, so a re-prepare or an identity serve marks the EXISTING card
  busy instead of drawing her lesson twice (ARV-D-066) — and hoists it to the head, because
  marking a card busy in place puts the progress bar wherever that card happened to sit, often
  below the fold (ARV-D-068).
- ⚠️ One divergence, named in the component: the web's bar is a CSS keyframe (0 → 96% on a
  cubic-bezier); RN has no keyframes, so it is an `Animated.timing` with the same duration, curve
  and 96% end point — it stops just short because the card is replaced at that moment and a bar
  that visibly completes then lingers reads as stuck.
- The in-place `prep-wait` card and its measures are deleted with it.

**Step 5c — the Year Plan's budget pencil (2026-09-15).** The last of the three things 4b
deferred; the proposed card and the prepare CTA came with 5b. It was held back for a good reason —
it opened the teaching profile's budget step and there is no profile on the phone, and "a pencil
that leads nowhere is worse than no pencil" (the same call 4a made about the picker's footer). It
now opens `app/(app)/budget.jsx`, one screen that IS that step and only that step.
- `packages/shared/src/budget.js` (NEW, 8 tests) — the arithmetic lifted out of
  `TeachingProfile.jsx` so both surfaces read the same record by the same function:
  `budgetPeriods` (the reader, still understanding all four legacy shapes), `normalizeBudget`
  (the one place a stored record becomes the editable period count) and a writer,
  `setGradeBudget`. The web imports them through `web/app/lib/budget.js`; behaviour unchanged.
  The tests pin the conversion the old `setMethod` never did — a weeks record opens on the year
  it evaluates to, which is the 245 → 180 defect of 2026-08-21.
  ⚠️ `format.js` holds a SECOND reader, `annualBudgetPeriods`, deriving its weekly periods from
  the grid rather than `periods_per_week`. On the one shape now written they cannot disagree;
  recorded in the header rather than merged blind.
- One figure, the weeks sense-check under it, Aruvi's recommendation, Save 88px clear of the
  reading. Saves through the same `verifiedWrite` POST /readiness the web uses, same three
  outcomes — a mismatch keeps her on the screen and re-reads from the SERVER rather than from
  what she typed; unverified is silence.
- `mobile/lib/paneIntent.js` (NEW) — My Lessons opens on "Your lessons" every ordinary visit;
  this round trip is the one exception, as on the web. A module-level one-shot (the shape
  `lib/preparing.js` took), CONSUMED on read so the exception cannot quietly become the
  persistence that was retired. ⚠️ Consumed on FOCUS, not mount: /budget is PUSHED on top of My
  Lessons, so the return POPS to a screen still mounted and a mount-only read steers nothing.
- The bar lights NOTHING in the editor — the web's own answer for a profile screen
  (`activeNav`: `editFlow === "profile" → "none"`). Lighting My Classes under her would say she
  is somewhere she is not.
- ⚠️ One divergence, named in the file: the web's weeks line carries a pencil through to the
  periods-a-week wheel. No ppw editor exists on the phone until the profile lands, so the line
  renders without it. That pencil is the first thing to restore when it does.
- Two of my own measures were wrong and were caught mechanically: `.fr-cta` declares font-size
  16 and border-radius 12 and the browser applies NEITHER — `button.primary` (0,1,1) beats
  `.fr-cta` (0,1,0) on SPECIFICITY, so the live values are 12 and 3. And `flex: 0` on the totals
  label collapsed "Total periods" to nothing (Yoga: grow 0 / shrink 0 / **basis 0**).
- ★ AND THE CHECKER HAD THE SAME CLASS OF BUG IT EXISTS TO FIND: it resolved `em` against
  whichever font-size came first across ALL worn sets rather than the winner for the SAME set,
  so it reported a correct 0.96 as wrong at 1.28. Pairing is now by index. Diffing the old
  against the new shows exactly one line gone — the false positive — and no true finding lost.
- **Owed on the phone:** Year Plan → the pencil → change the figure → Save → back on the Year
  Plan with the suggested column redistributed to the new budget. Cancel and the back gesture are
  verified on the Expo web target; SAVE'S WRITE IS NOT YET EXERCISED.

★ **THE CHAPTER'S FRONT DOOR IS THE ORG PAGE UNTIL SHE HAS TAUGHT A UNIT (founder, 2026-09-14,
BOTH SURFACES).** "First time when someone clicks a lesson plan from My Lessons as well as My
Class, it should by default open in the org page. When they click on a specific spine or section,
it should open in the Lesson tab. Once they complete the first unit, clicking the lesson must
henceforth take them to the sitting that they are now teaching."
The landing is about PROGRESS, not about which screen she came from. Both LessonViews had
`useState(preview)` — preview landed on the map and tracking went straight to a unit, so a chapter
she had never opened dropped her into unit 1 with no sense of the shape of the thing. Now: no
progress → the map; any progress → the sitting she is on (`previewAt` already initialises from the
pointer on both surfaces, and the unit opens on the Lesson tab, so the other two thirds of the ask
were already true once that tab default was fixed).
⚠️ **The stored pointer IS the count of completed units** (it is the 0-based index of the current
unit), which is why the test is `> 0` and not `>= 0`. `doneAll` is checked beside it for the
one-unit chapter whose pointer never leaves 0 even when finished — without that, a completed
one-unit chapter would open on the map for ever. Preview has no pointer to consult and so always
lands on the map, which is what it already did and what "first time" means for a plan attached to
no class. On the web this needed `doneKey` hoisted to sit beside `storageKey`; both are pure
string expressions of the same inputs.

★ **A PARITY CHECKER (2026-09-14) — `node mobile/theme/check-parity.mjs`.** In one afternoon the
founder caught four parity misses by eye, each costing a round trip, and every one was the same
mechanical fault: `theme/web.js` mirrors a CSS class, but the value the BROWSER applies to that
element is not the one that class declares. The checker answers "which rule wins?" mechanically.

**A · cascade landmines.** For every element in the web's JSX carrying more than one class, any
property two of its classes both declare, with its winner and loser. No mobile involvement — it is
a web smell list in its own right, and a losing declaration at equal specificity is dead code.
First run: **27 ties decided by source order**, including `mlp-allocate-btn prepare-cta` · color
(today's bug) and `lv-pvnav lv-pvnav-thin` · background, which is why the phone's pager was right
to use `--paper` on clay.

**B · `theme/web.js` against the winner.** Each `ws.*` key whose name maps to a class, compared on
face size, tracking and case — combo-aware (a class is rarely worn alone: `.lv-title` declares
17.5 but every element carrying it also carries `.lv-title-full` at 19.5) and own-value-first on
the phone side (RN splits a container from its Text; CSS does not). First run: **35 disagreements**,
one of them mine from the same day (`prep-wait-meta` is uppercase at .06em and had been ported
lowercase at 0.44). The rest are drift from earlier sessions — `co-num` 16 vs 15, `co-go` 15 vs 14,
`dash-welcome-title` 17 vs 20, most of the assess panel — and are a task of their own, because
some may be deliberate and each wants checking against its component header before it is "fixed".

⚠️ **It is not a renderer.** It resolves the cascade for the properties a port transcribes; a clean
run means those values are the ones that win, not that the screens match. The parity page is still
the eye. `--dump .some-class` prints every parsed rule touching a class with its context,
specificity and order — the first thing to reach for when a finding looks wrong, and the thing
that showed the checker's own parser was silently dropping every landmine.

## 3. Phasing

| Wk | Backend | Mobile |
|---|---|---|
| 1 | Render live on disk; DLT filed | `packages/shared` + storage shim |
| 2 | `SupabaseAuthProvider`; SMS hook | Expo scaffold, tokens, fonts, Login via Supabase OTP |
| 3–4 | Postgres groups 1–3 | LessonView · My Classes · My Lessons |
| 5 | Postgres groups 4–5, RLS, backups | FirstRun → PrepareLesson → profile |
| 6 | Content → Supabase Storage (optional) | Settings · Ask Meyy · exports |
| 7 | — | TestFlight / Play internal |

Payments stay parked; `BillingProvider` is the seam when it is settled.
