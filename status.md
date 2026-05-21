# CCFBC Line Up Manager — Status

**Updated:** 2026-05-21  
**Basis:** Full code review against `native-app-tutorial.md` (8 phases) + accumulated fixes from `review.md`

## Strategic Decisions

- **Android only** — iOS support dropped. The project targets Android / Google Play Store exclusively. Xcode, CocoaPods, APNs, Apple Developer Account, and the `ios/` Capacitor platform are all out of scope.
- **No paid services until quality-verified** — No money will be spent until the app is fully functional and tested on a real Android device. Firebase (free tier) is the only external service used and stays within free limits at current scale.
- **Google Play Developer account ($25)** — deferred to the very last step, after the app passes end-to-end testing on a real Android device.

---

> **Phase 1 migration ready** — `phase1-migration.sql` has been generated. Paste it into the Supabase SQL Editor in one shot. After it runs without errors, mark steps 1-1 through 1-4 as ✅ Done.

---

## Overall Progress

**~45% complete** — Web PWA is production-ready and deployed. React auth flow, church join/create, and Capacitor wiring are all done. The project now targets Android only; iOS has been dropped. The critical remaining blockers are the Phase 1 database SQL (which must be applied to Supabase before anything else can be tested end-to-end), and Phase 4 native push (Firebase/FCM setup + missing code files).

| Phase | Description | % Done | Status |
|---|---|---|---|
| Phase 0 | Prerequisites (tools, accounts) | 33% | 🔄 Partial — Android Studio pending; Google Play account deferred to end |
| Phase 1 | Multi-tenancy DB schema + RLS | 20% | 🔄 SQL not applied; API routes done |
| Phase 2 | React auth + church join flow | 95% | ✅ All code done (better than tutorial spec) |
| Phase 3 | Capacitor setup | 100% | ✅ Complete |
| Phase 4 | Native push notifications | 20% | ❌ Plugin installed; iOS dropped; Android FCM + code files missing |
| Phase 5 | Offline access | 60% | 🔄 IDB works; @capacitor/network missing |
| Phase 6 | Member access control UI | 5% | ❌ Depends on Phase 1 |
| Phase 7 | Icons + splash screen | 0% | ❌ Not started |
| Phase 8 | Store deployment | 50% | 🔄 Web ready; Android native blocked; iOS N/A |

---

## Code Errors & Warnings

Issues found during this review. Severity: 🔴 Bug / 🟡 Warning / 🔵 TODO

| # | Severity | File | Line | Issue |
|---|---|---|---|---|
| 1 | 🟡 | `api/church/join.js` | 21 | Uses `.single()` instead of `.maybeSingle()`. When no church matches the invite code, `.single()` returns a PGRST116 error rather than `null`. The `churchError \|\| !church` check handles this correctly so it's not a visible bug, but `.maybeSingle()` is the correct Supabase idiom for "zero or one row." |
| 2 | 🔵 | `src/hooks/useOffline.js` | 1–6 | Delegates to `useSyncStatus.isOnline` (browser `navigator.onLine`). Phase 5 requires updating this to use `@capacitor/network` so native apps get accurate network state. The current implementation works in browsers but is unreliable in the Capacitor WebView on iOS/Android. |
| 3 | 🔴 | `src/utils/nativePush.js` | — | **FILE MISSING.** Phase 4 step 4-4 requires creating this file to register native push permissions and FCM/APNs tokens. Without it, native push cannot be enabled. |
| 4 | 🔴 | `api/push/subscribe-native.js` | — | **FILE MISSING.** Phase 4 step 4-5 requires this API endpoint to store device tokens. `nativePush.js` will call `POST /api/push/subscribe-native` which 404s today. |
| 5 | 🔴 | `package.json` | — | `firebase-admin` not installed. Required for Phase 4 step 4-6 (server-side native push via Firebase). |
| 6 | 🔵 | `package.json` | — | `@capacitor/network` not installed. Required for Phase 5 step 5-1. |
| 7 | 🔵 | `package.json` | — | `@capacitor/splash-screen` not installed. Required for Phase 7. |
| 8 | 🟡 | `supabase-schema.sql` | — | Schema file is missing Phase 1 tables (`churches`, `church_members`), RLS helper functions (`my_church_id`, `is_church_admin`), church-scoped RLS policies, and the Phase 4 `native_push_tokens` table. The deployed Supabase DB is ahead of the repo file — schema drift creates a risk if the DB is ever reset or cloned. |
| 9 | 🟡 | `storage.js` — `getSongs`, `getSongById`, `getLineups` | 459, 509 | Supabase queries fetch all rows without a `church_id` filter. This is intentional (RLS will enforce isolation once Phase 1 SQL is applied), but until it is, all authenticated users see all churches' data. |
| 10 | 🟡 | `api/push/send-lineup.js`, `api/push/send-test.js` | — | Push is sent to all active subscribers globally, not scoped to a church. After Phase 1 is applied, these need a `church_id` filter on the `push_subscriptions` query. |
| 11 | 🟡 | `src/utils/pushNotifications.js` | ~369 | Full subscription payload (contains endpoint URL) logged unconditionally in the client. Should be gated behind a `DEBUG` flag or removed. |
| 12 | 🟡 | `api/_push.js` — `createLineupNotificationRecords()` | — | Dual-writer pattern: both the DB trigger and this API function write to `lineup_notifications`. Only `type='lineup_created'` has a unique index to dedupe. Other event types can produce unbounded duplicate rows. Fix: remove the API-side insert and let the DB trigger be the single writer. |

### Improvements vs Tutorial Spec (things coded BETTER than tutorial)

| Area | Tutorial Spec | Actual Implementation |
|---|---|---|
| `JoinChurchPage.jsx` — create church | Direct `supabase.from('churches').insert()` from browser (would fail RLS) | Calls `POST /api/church/create` (trusted server route) — RLS-safe |
| `api/church/create.js` | No rollback on member insert failure | Deletes the church row if the membership insert fails — atomic |
| `App.jsx loadChurch()` | Uses `.single()` (throws on empty) | Uses `.maybeSingle()` — returns `null` instead of throwing |
| `AuthPage.jsx` | `<Auth>` from `@supabase/auth-ui-react` (React 18 dep, crashes React 19) | Custom Tailwind form — no external dep, no crash |

---

## Native App Tutorial Progress

### Phase 0a — Free / Local Tools (do early)

| Item | Status | Notes |
|---|---|---|
| Node 18+ | ✅ Done | Node 24.15.0 confirmed |
| Android Studio | ⏳ Pending | Must be installed manually — do before Phase 4 testing |

### Phase 0b — Paid Accounts (defer to end)

| Item | Status | Notes |
|---|---|---|
| Google Play Account ($25) | ⏳ Pending | Purchase ONLY after app is fully tested and quality-verified on a real Android device — the very last step |

> **Dropped (iOS):** Xcode, CocoaPods, Apple Developer Account ($99/yr) — iOS support removed from project scope.

---

### Phase 1 — Multi-tenancy (database + auth)

| Step | Status | Notes |
|---|---|---|
| 1-1. Enable Supabase Auth in dashboard | 🟢 Ready to Apply | **Dashboard action** — see manual steps below and `phase1-migration.sql` header |
| 1-2. New DB tables (`churches`, `church_members`, `church_id` columns) | 🟢 Ready to Apply | SQL extracted to `phase1-migration.sql` §1-2 — run in Supabase SQL Editor |
| 1-3. Helper RLS functions (`my_church_id()`, `is_church_admin()`) | 🟢 Ready to Apply | SQL extracted to `phase1-migration.sql` §1-3 |
| 1-4. Rewrite RLS policies (church-scoped) | 🟢 Ready to Apply | SQL extracted to `phase1-migration.sql` §1-4 (includes DROP of old wide-open policies) |
| 1-5. `api/church/join.js` invite-code route | ✅ Done | Implemented with auth check, upsert-on-conflict, and error handling |
| 1-6. `api/church/create.js` create route | ✅ Done | **Added beyond tutorial** — trusted server route with slug generation, rollback on member insert failure |

**Action required:** Complete the Step 1-1 dashboard steps first (listed below), then paste `phase1-migration.sql` into the Supabase SQL Editor and run it. Steps 1-1 through 1-4 will be marked ✅ Done only after you confirm the script ran without errors.

#### Step 1-1 — Manual Dashboard Steps (do these BEFORE running the SQL)

1. Go to **Authentication → Settings** in your Supabase project dashboard.
2. Under **Email Auth**: toggle ON **Enable Email Signups**.
3. Under **Site URL**: set to your Vercel domain (e.g. `https://your-app.vercel.app`).
4. Under **Redirect URLs → Add URL**: add `http://localhost:5173` (for local dev).
5. Click **Save**.

---

### Phase 2 — Auth in the React app

| Step | Status | Notes |
|---|---|---|
| 2-1. Install auth helpers | ⚠️ Superseded | `@supabase/auth-ui-react` was installed then **uninstalled** — it ships React 18 internally, crashing under React 19. See `bug-report-auth-crash.md`. |
| 2-2. Update `src/utils/supabase.js` | ✅ Done | Auth options added: `persistSession`, `autoRefreshToken`, `detectSessionInUrl` |
| 2-3. Create `src/pages/AuthPage.jsx` | ✅ Done | Custom email/password form using `supabase.auth.signInWithPassword` + `signUp` directly — no auth-ui-react dep |
| 2-4. Create `src/pages/JoinChurchPage.jsx` | ✅ Done | Join-by-invite-code + create-church flows; both call trusted API routes (not direct Supabase) |
| 2-5. Gate `App.jsx` with auth | ✅ Done | `session`, `churchId`, `authLoading` state + `useEffect` + `loadChurch()` (uses `maybeSingle()`) + 3 early returns |
| 2-6. Pass `church_id` through storage | ✅ Done | `setActiveChurch` / `getActiveChurchId` in `storage.js`; injected into `saveSong` and `saveLineup`; called from `loadChurch` and on sign-out |

---

### Phase 3 — Capacitor setup

| Step | Status | Notes |
|---|---|---|
| 3-1. Install Capacitor | ✅ Done | `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android` all installed |
| 3-2. Init Capacitor | ✅ Done | `npx cap init` run; `capacitor.config.ts` generated |
| 3-3. Update `capacitor.config.ts` | ✅ Done | `server.androidScheme`, `PushNotifications`, `SplashScreen` plugin config present |
| 3-4. Add iOS and Android platforms | ✅ Done | `ios/` and `android/` native project folders created |
| 3-5. Daily dev workflow | 📖 Documented | `npm run build && npx cap sync`, then `npx cap open ios` / `npx cap open android` |

---

### Phase 4 — Native push notifications

| Step | Status | Notes |
|---|---|---|
| 4-1. Install `@capacitor/push-notifications` + `cap sync` | ✅ Done | v8.1.1 installed; synced to Android |
| 4-2. iOS APNs setup | ❌ N/A (iOS dropped) | Xcode, APNs key (.p8), Firebase iOS app, `GoogleService-Info.plist` — not needed; iOS support dropped |
| 4-3. Android FCM setup | ❌ Pending | Requires: Firebase Android app, `google-services.json`, Gradle plugin edits |
| 4-4. Create `src/utils/nativePush.js` | ❌ Missing | File does not exist — must be created (see tutorial §4-4) |
| 4-5. Create `api/push/subscribe-native.js` | ❌ Missing | File does not exist — must be created (see tutorial §4-5) |
| 4-6. Server-side Firebase Admin SDK send | ❌ Missing | `firebase-admin` not installed; `api/_nativePush.js` not created; Firebase env vars not set |

---

### Phase 5 — Offline access

| Step | Status | Notes |
|---|---|---|
| 5-1. `@capacitor/network` + `useOffline.js` update | ❌ Pending | Package not installed; `useOffline.js` still uses `useSyncStatus` (browser-only) |
| 5-2. IndexedDB offline cache (no change needed) | ✅ Already working | Existing IDB strategy works unchanged in Capacitor WebView |

---

### Phase 6 — Member-facing access control

| Item | Status | Notes |
|---|---|---|
| Role enforcement (admin vs member) | ❌ Pending | Depends on Phase 1 DB/RLS being applied first |
| Settings page with invite code display | ❌ Not built | No Settings page exists; `invite_code` is not surfaced to admins |

---

### Phase 7 — App icons and splash screen

| Item | Status | Notes |
|---|---|---|
| `@capacitor/splash-screen` install | ❌ Pending | Not in `package.json` |
| `@capacitor/assets` icon generation (Android only) | ❌ Pending | Requires 1024×1024 source PNG; `public/icon-512.png` exists and can be upscaled — generate Android sizes only; iOS not targeted |

---

### Phase 8 — Build and deploy

| Target | Status | Notes |
|---|---|---|
| iOS (Xcode → App Store) | ❌ N/A (iOS dropped) | iOS support dropped; project targets Android only |
| Android (Android Studio → Play Store) | ❌ Pending | Blocked by Phases 4, 7 |
| Vercel (web) | ✅ Ready | `npm run build` passes cleanly; procedure in `deployment.md` |

---

## Review.md Findings — Current Status

### Critical

| ID | Finding | Status |
|---|---|---|
| C1 | Public RLS on songs/lineups | ✅ Fixed — write policies restored as anon-permissive (intentional until church-scoped RLS from Phase 1 is applied); `church_id` injected into every write |
| C2 | Unauthenticated push routes | ✅ Fixed — `PUSH_ADMIN_TOKEN` set in `.env` (64 chars); `requireAdminToken` enforced in `send-lineup.js` and `send-test.js` |
| C3 | Public `push_subscriptions` access | ✅ Fixed in schema — pending SQL application to Supabase |

### High

| ID | Finding | Status |
|---|---|---|
| H1 | Duplicate `lineup_notifications` rows | 🔄 Partially fixed — type normalization improved; dual-writer pattern (DB trigger + API) still exists; unbounded growth risk for non-`lineup_created` event types |
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
| L1 | Verbose push logging in production | 🔄 Partially fixed — server logs gated; client subscription log still unconditional (`pushNotifications.js:~369`) |
| L2 | Unusual dependency major versions | ✅ Verified — build passes cleanly with Vite 8 / plugin-react 6 |
| L3 | Redundant Realtime subscriptions | ✅ Fixed — removed duplicate `lineups` channel from `useLineupNotifications`; single channel via `LineupRealtimeContext` |
| L4 | SW message listener re-bound on notification changes | ✅ Fixed — `lineupNotificationsRef` pattern |
| L5 | TOCTOU race on save | ✅ Fixed — `saveSong` and `saveLineup` use `upsert({ onConflict: 'id' })` |
| L6 | `getRequestBody()` swallows malformed JSON | ✅ Fixed — `console.warn` added in catch |

---

## Bugs Fixed Previously (2026-05-19)

### BUG-AUTH-01 — Dual React Instances Crash

`@supabase/auth-ui-react@0.4.7` bundles React 18 as a direct dependency. With React 19, npm installed two React copies → hook dispatcher mismatch → error boundary on every page load.

**Fix:** Replaced `<Auth>` with custom email/password form; uninstalled both auth-ui packages.

### BUG-AUTH-02 — Truncated `.env` Values

`VITE_SUPABASE_ANON_KEY` and `PUSH_ADMIN_TOKEN` contained literal `...` suffixes — blurred display values pasted instead of real keys.

**Fix:** Updated `.env` with full 208-char JWT anon key and freshly generated 64-char hex admin token.

---

## Environment Variables

| Variable | Status | Length | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ Set | 40 chars | |
| `VITE_SUPABASE_ANON_KEY` | ✅ Set | 208 chars | Full JWT |
| `SUPABASE_URL` | ✅ Set | 40 chars | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set | 41 chars | |
| `VAPID_PUBLIC_KEY` | ✅ Set | 86 chars | |
| `VAPID_PRIVATE_KEY` | ✅ Set | 43 chars | |
| `VAPID_SUBJECT` | ✅ Set | 33 chars | |
| `PUSH_ADMIN_TOKEN` | ✅ Set | 64 chars | |
| `FIREBASE_PROJECT_ID` | ❌ Not set | — | Required for Phase 4 native push (Android FCM only) |
| `FIREBASE_CLIENT_EMAIL` | ❌ Not set | — | Required for Phase 4 native push (Android FCM only) |
| `FIREBASE_PRIVATE_KEY` | ❌ Not set | — | Required for Phase 4 native push (Android FCM only) |

---

## Build & Test Status

| Task | Status | Notes |
|---|---|---|
| `npm run dev` | ✅ Pass | Vite dev server at `http://localhost:5173` |
| `npm run build` | ✅ Pass | 1686 modules, clean output |
| `npm test` | ✅ Pass | 20 Vitest tests passing |
| `npm run lint` | ✅ Pass | ESLint 9.19 flat config, no errors |
| `vercel dev` | ✅ Pass | Frontend + serverless API together |
| Service Worker (dev) | ⚠️ Expected error | SW requires HTTPS or production build — not a bug |

---

## ✅ Completed Steps

- Phase 0: Node 18+ confirmed, Capacitor CLI installed
- Phase 1: `api/church/join.js` — invite-code join endpoint
- Phase 1: `api/church/create.js` — create-church endpoint with rollback *(improvement beyond tutorial)*
- Phase 2: `src/utils/supabase.js` — auth options configured
- Phase 2: `src/pages/AuthPage.jsx` — custom email/password form (no auth-ui-react)
- Phase 2: `src/pages/JoinChurchPage.jsx` — join + create flows using API routes
- Phase 2: `src/App.jsx` — full auth gate (session + churchId + authLoading), `loadChurch()`, `handleSignOut()`
- Phase 2: `src/utils/storage.js` — `setActiveChurch` / `getActiveChurchId` / `clearChurchData`, `church_id` in `saveSong` + `saveLineup`
- Phase 3: All 5 steps — Capacitor installed, inited, config updated, iOS/Android platforms added
- Phase 4 (partial): `@capacitor/push-notifications` v8.1.1 installed and synced
- Phase 5 (partial): IndexedDB offline cache working in Capacitor WebView
- Phase 8 (partial): Vercel web deployment ready

---

## 🔄 In-Progress / Broken Steps

- **Phase 1 SQL** — tables and RLS not applied to Supabase; blocks all multi-tenancy
- **Phase 4 native push** — plugin installed but no code wired; `nativePush.js` and `subscribe-native.js` are missing files
- **Phase 5 offline** — `useOffline.js` uses browser API instead of `@capacitor/network`
- **H1 duplicate notifications** — dual-writer pattern still exists in `api/_push.js` + DB trigger
- **L1 client push log** — subscription payload still logged unconditionally in `pushNotifications.js:~369`
- **Schema drift** — `supabase-schema.sql` does not reflect deployed DB (Phase 1 tables, functions, RLS policies, `native_push_tokens` table all missing from repo file)

---

## ❌ Missing Steps (Not Started)

- Phase 1: Run SQL for `churches`, `church_members`, `church_id` column additions, `my_church_id()`, `is_church_admin()`, church-scoped RLS policies
- Phase 1: Enable Supabase Auth in dashboard (email signups + redirect URLs)
- Phase 4: Create `src/utils/nativePush.js`
- Phase 4: Create `api/push/subscribe-native.js`
- Phase 4: Install `firebase-admin`, create `api/_nativePush.js`
- Phase 4: Create `native_push_tokens` table in Supabase
- Phase 4: Android — `google-services.json`, Gradle plugin edits
- Phase 4: Add Firebase env vars to Vercel + `.env`
- Phase 5: Install `@capacitor/network`, update `useOffline.js`
- Phase 6: Build Settings page with invite code display for admins
- Phase 7: Install `@capacitor/splash-screen`
- Phase 7: Run `npx capacitor-assets generate` for Android sizes only
- Phase 8: Android Play Store submission (Android Studio AAB)

---

## 📋 Next Steps (Priority Order)

1. **Install Android Studio** (free, local)  
   Required for running the Android emulator and building signed APKs/AABs. Do this before any native Android testing.

2. **Run Phase 1 SQL in Supabase SQL Editor** ← highest impact unblock  
   Creates `churches`, `church_members`, adds `church_id` columns, applies `my_church_id()` + `is_church_admin()` RLS functions, and church-scoped RLS policies. This is the foundation for everything below.

3. **Enable Supabase Auth in dashboard** (Phase 1-1)  
   Email signups + Site URL + `http://localhost:5173` redirect. Takes 2 minutes in the dashboard.

4. **Test full auth flow end-to-end in browser**  
   Sign up → confirm email → login → `JoinChurchPage` (create or join) → main app. Verify `church_id` is set and data is isolated.

5. **Fix `api/church/join.js:21` — `.single()` → `.maybeSingle()`**  
   One-line fix. Prevents a potential PGRST116 error from leaking to users if invite code lookup returns 0 rows via a different error path.

6. **Fix H1 dual-writer** — remove `createLineupNotificationRecords()` API-side insert in `api/_push.js`; rely on DB trigger only.

7. **Fix L1 client push log** — gate subscription payload log behind `import.meta.env.DEV` in `pushNotifications.js`.

8. **Phase 5 — Install `@capacitor/network`, update `useOffline.js`**  
   `npm install @capacitor/network && npx cap sync`, then update the hook with the `Capacitor.isNativePlatform()` branch from tutorial §5-1.

9. **Phase 6 — Settings page** with invite code display for admins (fetch `churches.invite_code` after Phase 1 SQL is applied).

10. **Phase 4 (code only)** — Create `src/utils/nativePush.js` and `api/push/subscribe-native.js`. Add `native_push_tokens` table to Supabase. Install `firebase-admin`. No Firebase account needed yet.

11. **Test thoroughly on Android emulator and physical Android device** — verify all features work end-to-end before spending any money. Quality gate before any paid steps.

12. **Phase 7 — Icons + splash (Android only)** — `npm install @capacitor/splash-screen`, run `npx capacitor-assets generate` for Android sizes only.

13. **Create free Firebase project** — add Android app, download `google-services.json`, add Gradle plugin edits, set Firebase env vars in Vercel + `.env`, finish Phase 4 push end-to-end. Firebase free tier is sufficient at current scale.

14. **Test push notifications on real Android device** — confirm FCM delivery works end-to-end on hardware.

15. **Pay $25 and register Google Play Developer account** — only after all the above is verified working on real hardware.

16. **Phase 8 — Android Play Store** — build signed AAB in Android Studio, submit to Play Store.
