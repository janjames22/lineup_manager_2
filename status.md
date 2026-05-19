# CCFBC Line Up Manager — Status

**Updated:** 2026-05-19  
**Basis:** `native-app-tutorial.md` implementation progress + accumulated fixes from `review.md`

---

## Native App Tutorial Progress

### Phase 0 — Prerequisites

| Item | Status | Notes |
|---|---|---|
| Node 18+ | ✅ Done | Node 24.15.0 confirmed |
| Xcode (iOS) | ⏳ Pending | Must be installed manually on Mac |
| Android Studio | ⏳ Pending | Must be installed manually |
| CocoaPods | ⏳ Pending | `sudo gem install cocoapods` not yet run |
| Apple Developer Account ($99/yr) | ⏳ Pending | Required for real-device iOS |
| Google Play Account ($25) | ⏳ Pending | Required to publish Android |

---

### Phase 1 — Multi-tenancy (database + auth)

| Step | Status | Notes |
|---|---|---|
| 1-1. Enable Supabase Auth in dashboard | ⏳ Pending | Dashboard action required: enable email signups, set Site URL, add `http://localhost:5173` redirect |
| 1-2. New DB tables (`churches`, `church_members`, `church_id` columns) | ⏳ Pending | SQL from tutorial §1-2 not yet run in Supabase SQL Editor |
| 1-3. Helper RLS functions (`my_church_id()`, `is_church_admin()`) | ⏳ Pending | SQL from tutorial §1-3 not yet applied |
| 1-4. Rewrite RLS policies (church-scoped) | ⏳ Pending | SQL from tutorial §1-4 not yet applied |
| 1-5. `api/church/join.js` invite-code route | ✅ Done | File created at `api/church/join.js` |

**Blocker:** Phases 1-1 through 1-4 are pure database/dashboard actions. Nothing can be tested end-to-end until the SQL is applied. Run all SQL blocks from the tutorial in order in the Supabase SQL Editor before proceeding.

---

### Phase 2 — Auth in the React app

| Step | Status | Notes |
|---|---|---|
| 2-1. Install auth helpers | ⚠️ Superseded | `@supabase/auth-ui-react` was installed then **uninstalled** — it ships React 18 internally, crashing the app under React 19. See `bug-report-auth-crash.md`. |
| 2-2. Update `src/utils/supabase.js` | ✅ Done | Auth options added: `persistSession`, `autoRefreshToken`, `detectSessionInUrl` |
| 2-3. Create `src/pages/AuthPage.jsx` | ✅ Done | Custom email/password form using `supabase.auth.signInWithPassword` + `signUp` directly (no auth-ui-react dependency) |
| 2-4. Create `src/pages/JoinChurchPage.jsx` | ✅ Done | Join-by-invite-code + create-church flows implemented |
| 2-5. Gate `App.jsx` with auth | ✅ Done | `session`, `churchId`, `authLoading` state + `useEffect` + `loadChurch()` + 3 early returns |
| 2-6. Pass `church_id` through storage | ✅ Done | `setActiveChurch` / `getActiveChurchId` in `storage.js`; injected into `saveSong` and `saveLineup`; `setActiveChurch` called from `loadChurch` and on sign-out |

**Note on 2-3:** Tutorial spec used `<Auth supabaseClient={supabase} />` from `@supabase/auth-ui-react`. This was replaced with a custom Tailwind form due to a React 18/19 dual-instance crash. Functionally equivalent — sign in, sign up, error display, loading state all present.

---

### Phase 3 — Capacitor setup

| Step | Status | Notes |
|---|---|---|
| 3-1. Install Capacitor | ✅ Done | `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android` all installed |
| 3-2. Init Capacitor | ✅ Done | `npx cap init` run; `capacitor.config.json` generated |
| 3-3. Update `capacitor.config.ts` | ✅ Done | `.json` replaced with `.ts` (added `server.androidScheme`, `PushNotifications`, `SplashScreen` plugin config); `typescript` added as devDependency |
| 3-4. Add iOS and Android platforms | ✅ Done | `ios/` and `android/` native project folders created |
| 3-5. Daily dev workflow | 📖 Documented | Workflow: `npm run build && npx cap sync`, then `npx cap open ios` / `npx cap open android` |

---

### Phase 4 — Native push notifications

| Step | Status | Notes |
|---|---|---|
| 4-1. Install `@capacitor/push-notifications` + `cap sync` | ✅ Done | v8.1.1 installed; synced to both iOS and Android projects |
| 4-2. iOS APNs setup | ⏳ Pending | Requires: Xcode Signing & Capabilities, Apple Dev Portal APNs key (.p8), Firebase project with iOS app, `GoogleService-Info.plist` in Xcode |
| 4-3. Android FCM setup | ⏳ Pending | Requires: Firebase Android app, `google-services.json` at `android/app/`, Gradle plugin edits |
| 4-4. Create `src/utils/nativePush.js` | ⏳ Pending | Not yet created |
| 4-5. Create `api/push/subscribe-native.js` | ⏳ Pending | Not yet created |
| 4-6. Server-side Firebase Admin SDK send | ⏳ Pending | `firebase-admin` not installed; `api/_nativePush.js` not yet created; Firebase env vars not set |

---

### Phase 5 — Offline access

| Step | Status | Notes |
|---|---|---|
| 5-1. `@capacitor/network` + `useOffline.js` update | ⏳ Pending | Plugin not installed; hook not yet updated |
| 5-2. IndexedDB offline cache (no change needed) | ✅ Already working | Existing IDB strategy works unchanged in Capacitor WebView |

---

### Phase 6 — Member-facing access control

| Item | Status | Notes |
|---|---|---|
| Role enforcement (admin vs member) | ⏳ Pending | Depends on Phase 1 DB/RLS being applied |
| Settings page with invite code display | ⏳ Pending | Not yet built |

---

### Phase 7 — App icons and splash screen

| Item | Status | Notes |
|---|---|---|
| `@capacitor/splash-screen` install | ⏳ Pending | |
| `@capacitor/assets` icon generation | ⏳ Pending | Requires 1024×1024 source PNG |

---

### Phase 8 — Build and deploy

| Target | Status | Notes |
|---|---|---|
| iOS (Xcode → App Store) | ⏳ Pending | Blocked by Phases 4, 7 |
| Android (Android Studio → Play Store) | ⏳ Pending | Blocked by Phases 4, 7 |
| Vercel (web) | ✅ Ready | `npm run build` passes cleanly; deployment procedure documented in `deployment.md` |

---

## Review.md Findings — Current Status

### Critical

| ID | Finding | Status |
|---|---|---|
| C1 | Public RLS on songs/lineups | ✅ Fixed — write policies restored as anon-permissive (intentional for app without forced auth until church-scoped RLS from Phase 1 is applied); `church_id` now injected into every write |
| C2 | Unauthenticated push routes | ✅ Fixed — `PUSH_ADMIN_TOKEN` set in `.env` (64 chars); `requireAdminToken` enforced in `send-lineup.js` and `send-test.js` |
| C3 | Public `push_subscriptions` access | ✅ Fixed in schema — pending SQL application to Supabase |

### High

| ID | Finding | Status |
|---|---|---|
| H1 | Duplicate `lineup_notifications` rows | ⚠️ Partially fixed — type normalization improved; dual-writer pattern (DB trigger + API) still exists |
| H2 | Duplicate legacy API endpoints | ✅ Fixed — `api/push-subscriptions.js` and `api/send-lineup-push.js` deleted |
| H3 | Cross-channel notification dedup | ✅ Fixed — secondary dedup key `lineupId:eventSlug` in `addNotification`; single Realtime channel via `LineupRealtimeContext` |

### Medium

| ID | Finding | Status |
|---|---|---|
| M1 | `read()` persisted fallback to localStorage | ✅ Fixed |
| M2 | Offline by-id lookups skipped live cache | ✅ Fixed |
| M3 | `withTimeout()` no AbortController | ✅ Fixed — refactored to factory function; all 10 call sites use `.abortSignal(signal)` |
| M4 | `consumeLocalLineupCreation()` consumed marker on first match | ✅ Fixed — marker kept for full TTL window |
| M5 | No automated tests | ✅ Fixed — Vitest added; 20 tests across `normalizeLyricsMonitor`, snake↔camelCase conversion, notification construction |

### Low

| ID | Finding | Status |
|---|---|---|
| L1 | Verbose push logging in production | ⚠️ Partially fixed — server logs gated; client subscription log still unconditional |
| L2 | Unusual dependency major versions | ✅ Verified — build passes cleanly with Vite 8 / plugin-react 6 |
| L3 | Redundant Realtime subscriptions | ✅ Fixed — removed duplicate `lineups` channel from `useLineupNotifications`; single channel via `LineupRealtimeContext` piped to `useLineups` |
| L4 | SW message listener re-bound on notification changes | ✅ Fixed — `lineupNotificationsRef` pattern |
| L5 | TOCTOU race on save | ✅ Fixed — `saveSong` and `saveLineup` use `upsert({ onConflict: 'id' })` |
| L6 | `getRequestBody()` swallows malformed JSON | ✅ Fixed — `console.warn` added in catch |

---

## Bugs Fixed This Session (2026-05-19)

### BUG-AUTH-01 — Dual React Instances Crash

`@supabase/auth-ui-react@0.4.7` bundles React 18 as a direct dependency. With React 19 in the project, npm installed two separate React copies → hook dispatcher mismatch → error boundary on every page load.

**Fix:** Replaced `<Auth>` with custom email/password form; uninstalled both auth-ui packages (removed 10 packages).

### BUG-AUTH-02 — Truncated `.env` Values

`VITE_SUPABASE_ANON_KEY` (31 chars) and `PUSH_ADMIN_TOKEN` (35 chars) contained literal `...` suffixes — Claude's display-blurred values were pasted instead of real keys.

**Fix:** Updated `.env` with full 208-char JWT anon key and freshly generated 64-char hex admin token.

See `bug-report-auth-crash.md` for full root-cause analysis.

---

## Environment Variables — Current Status

| Variable | Status | Length |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ Set | 40 chars |
| `VITE_SUPABASE_ANON_KEY` | ✅ Set | 208 chars (full JWT) |
| `SUPABASE_URL` | ✅ Set | 40 chars |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set | 41 chars |
| `VAPID_PUBLIC_KEY` | ✅ Set | 86 chars |
| `VAPID_PRIVATE_KEY` | ✅ Set | 43 chars |
| `VAPID_SUBJECT` | ✅ Set | 33 chars |
| `PUSH_ADMIN_TOKEN` | ✅ Set | 64 chars |
| `FIREBASE_PROJECT_ID` | ❌ Not set | Required for Phase 4 native push |
| `FIREBASE_CLIENT_EMAIL` | ❌ Not set | Required for Phase 4 native push |
| `FIREBASE_PRIVATE_KEY` | ❌ Not set | Required for Phase 4 native push |

---

## Dev Server

- Running at `http://localhost:5173` — HTTP 200
- `npm run build` — clean, no errors (1686 modules)
- `npm test` — 20 tests passing (Vitest)
- SW registration error in Vite dev mode — **expected**, not a bug (service workers require HTTPS or production build)

---

## Next Actions (Priority Order)

1. **Run Phase 1 SQL in Supabase** — `churches`, `church_members` tables, `church_id` columns, `my_church_id()` + `is_church_admin()` functions, church-scoped RLS policies
2. **Enable Supabase Auth in dashboard** (Phase 1-1) — email signups + redirect URL config
3. **Test full auth flow** — sign up → confirm email → login → JoinChurchPage → main app
4. **Phase 4 native push setup** — Firebase project, APNs key, `nativePush.js`, `subscribe-native.js`
5. **Phase 5** — install `@capacitor/network`, update `useOffline.js`
6. **Phase 6** — Settings page with invite code display
7. **Phase 7** — icons + splash screen
8. **Phase 8** — App Store + Play Store submission
