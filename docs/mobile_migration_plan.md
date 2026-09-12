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

Next: step 4, My Classes "+" binding and the full My Lessons library (Year Plan, prepared filter).

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
