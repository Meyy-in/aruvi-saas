# Meyy — the phone app (Track D)

Expo managed + Expo Router. Presentation only: client logic is `@aruvi/shared`
(`../packages/shared`), facts come from the API. Teacher-facing name **Meyy**; identifiers stay Aruvi.

## Run (first time, on the Mac)

```
cd <repo root>/mobile
npm install                      # mobile/ has its OWN node_modules (not a workspace — see below)
cp .env.example .env.local       # already written on the founder's Mac — Supabase + Render values
npx expo install --fix           # aligns every native package to the installed Expo SDK
npx expo-doctor                  # should be clean
npx expo start                   # scan the QR with Expo Go (same WiFi as the Mac)
```

Why not a workspace: the web runs React 18, the phone React 19. Hoisting the phone's packages
to the repo root gave react-native a stray third React (expo-doctor, 2026-09-11) — two Reacts
crash every hook. So mobile/ installs alone and links `@aruvi/shared` by path
(`file:../packages/shared`); the package has zero dependencies, so nothing else is shared.
metro.config.js only adds that folder to the watch list.

Test numbers `919000000001–3` sign in with OTP `123456` until DLT lands.

## Layout

```
app/_layout.jsx      boot → fonts → theme → stack
app/index.jsx        gate: signed in? → (app) : login
app/login.jsx        the front door (choose · OTP · sign-in) — the web's Login.jsx
app/privacy.jsx      Privacy Notice, no account needed
app/(app)/           the signed-in shell (step 2: proof screen; step 3: LessonView)
lib/boot.js          installs storage (expo-sqlite/kv-store, sync), API base, Supabase client
theme/tokens.js      GENERATED from web/app/globals.css — python3 theme/gen-tokens.py
theme/fonts.js       Fraunces · Newsreader · IBM Plex Mono, bundled
components/          MeyyMark (svg), Bar, OtpBoxes, Markdown (shared parser → Text), ui
```

Stress width 360×800 first, then 375 / 390 / 412 (CLAUDE.md §4).

## The web target — how parity is checked

`npx expo start` then press **`w`** (or `npx expo start --web`) renders this app in a browser at
`http://localhost:8081` via react-native-web. Open it at 390px beside the web app at
`http://localhost:3000` and compare — that is the check Claude runs before a change reaches the
phone. Not the product: react-native-web is close but not pixel-identical to iOS, so the phone
signs off. First time: `npx expo install react-dom react-native-web @expo/metro-runtime`.
