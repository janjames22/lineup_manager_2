# Debugging Report
_Last updated: 2026-05-19_

## Summary
I audited the React app, serverless API routes, Supabase schema, environment configuration, build tooling, native Capacitor files, and project status documents. The current app code has the recommended `/api/church/create` server endpoint and `JoinChurchPage` now calls it, so the original direct browser insert bug is fixed in source. The largest remaining risks are database/schema drift, incomplete church scoping across reads/realtime/cache/push, and a broken lint setup. I found 5 critical issues, 9 high-priority issues, and 11 lower-priority warnings. `npm test` passes, `npx vite build` passes, `npm run lint` fails.

## 🔴 Critical Issues
### Repository Schema Does Not Contain Required Church Tables
- **File:** `supabase-schema.sql` (lines 11, 31, 455-459); `native-app-tutorial.md` (lines 68-105, 123-148, 156-219); `status.md` (lines 27-33)
- **Problem:** The canonical repo schema creates `songs`, `lineups`, and push tables, but does not create `churches`, `church_members`, `church_id` columns, `my_church_id()`, `is_church_admin()`, or church-scoped RLS policies. The app now depends on those objects in `src/App.jsx`, `src/pages/Dashboard.jsx`, `api/church/create.js`, and `api/church/join.js`.
- **Impact:** A fresh Supabase database created from `supabase-schema.sql` cannot support login-to-church onboarding. The deployed DB appears to have at least a `churches` table because the user saw a `churches` RLS error, but that state cannot be reproduced safely from the repo.
- **Fix:** Move Phase 1 SQL from `native-app-tutorial.md` into `supabase-schema.sql`: create `public.churches`, `public.church_members`, add `church_id` to `songs`, `lineups`, `push_subscriptions`, and `lineup_notifications`, add indexes, add helper functions, enable RLS, and create authenticated church-scoped policies. Then run the reconciled migration in Supabase SQL Editor.

### Songs And Lineups Are Still Publicly Writable
- **File:** `supabase-schema.sql` (lines 466-483, 491-506)
- **Problem:** RLS is enabled, but policies use `USING (true)` and `WITH CHECK (true)` for public read, insert, update, and delete on both `songs` and `lineups`.
- **Impact:** Anyone with the anon key embedded in the frontend can read, create, update, or delete all songs and lineups. This defeats admin/member separation and church isolation.
- **Fix:** Drop the public policies and replace them with authenticated policies scoped by `church_id = public.my_church_id()`, with writes requiring `public.is_church_admin(church_id)`.

### Frontend Data Access Is Not Church-Scoped
- **File:** `src/utils/storage.js` (lines 451, 501, 530-531, 581, 615, 659, 693-694, 765); `src/hooks/useRealtimeItems.js` (lines 129-134); `src/lib/offlineStorage.js` (lines 3-10, 63-82)
- **Problem:** Writes attach `church_id` when `getActiveChurchId()` is set, but reads, detail fetches, deletes, realtime subscriptions, live caches, and offline stores are not filtered or namespaced by church.
- **Impact:** If public policies remain, users can see and mutate all church data. Even after RLS is fixed, local caches/offline records can leak prior church data after account switches or logout. Realtime currently listens to every row change on a table.
- **Fix:** Require an active church before loading data. Add `.eq('church_id', getActiveChurchId())` to list/detail queries and deletes. Add a Realtime filter such as `filter: church_id=eq.${churchId}`. Namespace localStorage/IndexedDB cache keys by `userId:churchId` or clear them on church change/sign out.

### Push Notifications Are Not Scoped By Church
- **File:** `api/_push.js` (lines 695-727, 904-909, 965-971); `api/push/send-lineup.js` (lines 36-57); `src/utils/pushNotifications.js` (lines 378-385, 871-883); `native-app-tutorial.md` (lines 101-105)
- **Problem:** `loadPushSubscriptions()` loads every active subscription unless a specific endpoint is targeted. Subscription save payloads do not include `church_id`, and `send-lineup` does not filter subscribers by the lineup's church.
- **Impact:** A lineup save can send a notification to every subscribed device across all churches. This is a privacy and trust issue once multiple churches use the app.
- **Fix:** Add and populate `push_subscriptions.church_id`, pass `churchId` when subscribing, load the lineup including `church_id`, and filter push recipients with `.eq('church_id', lineup.church_id)`.

### Sign Out Leaves Church Data In Browser Storage
- **File:** `src/App.jsx` (lines 567-590); `src/utils/storage.js` (lines 12-15); `src/lib/offlineStorage.js` (lines 3-10); `src/utils/lineupNotifications.js` (lines 53, 94)
- **Problem:** Sign out clears `churchId` and `_activeChurchId`, but it does not clear live caches, offline saved items, localStorage fallback data, notification state, or push device metadata.
- **Impact:** On a shared browser or after switching accounts, a new user can see old cached songs, lineups, and notifications from the prior church.
- **Fix:** On sign out, clear church-scoped cache keys and notification keys, or migrate every cache to a `userId:churchId` namespace and switch namespaces when the active church changes.

## 🟡 High Priority Issues
### Create-Church Endpoint Exists But Is Not Atomic
- **File:** `api/church/create.js` (lines 19-61)
- **Problem:** The endpoint correctly uses `getSupabaseAdmin()`, verifies the bearer token, inserts `churches`, inserts `church_members` with `role = 'admin'`, and returns `{ church_id }`. However, the two inserts are not wrapped in a database transaction/RPC. If member insert fails and the cleanup delete fails, an orphan church can remain.
- **Impact:** Partial church records can be created without an admin membership, leaving users stuck at the join screen or creating duplicate slug conflicts later.
- **Fix:** Create a Postgres RPC such as `create_church_for_user(church_name, slug, display_name, user_id)` that inserts both rows in one transaction, then call it from the service-role endpoint.

### Join-Church Endpoint Ignores Critical Errors
- **File:** `api/church/join.js` (lines 12, 15, 19-24, 27-32)
- **Problem:** The route does not check whether `getSupabaseAdmin()` returned `null`, ignores the select error when looking up `invite_code`, and ignores the `upsert` result when adding `church_members`.
- **Impact:** A missing service-role key can crash the route. Failed membership writes can still return `200`, so the UI thinks the user joined but `loadChurch()` later finds no membership.
- **Fix:** Mirror the defensive style in `api/church/create.js`: return a clear 500 if admin Supabase is unavailable, check `{ data, error }` for the church lookup, check `{ error }` for the upsert, and return 500/404 as appropriate.

### Auth Bootstrap Can Hang Or Hide RLS Failures
- **File:** `src/App.jsx` (lines 561-584); `src/utils/supabase.js` (lines 6-16)
- **Problem:** If Supabase env vars are missing, `supabase?.auth.getSession()` never runs and `authLoading` remains true forever. `loadChurch()` also ignores the `error` from `church_members` and has no try/catch.
- **Impact:** The app can get stuck on `LoadingScreen`, and RLS or network failures are indistinguishable from "user has no church."
- **Fix:** If `supabase` is `null`, set `authLoading(false)` and show a configuration error. Wrap `getSession()` and `loadChurch()` in try/catch, log/display `church_members` errors, and only treat missing data as no church when the query succeeds.

### Frontend Push Calls Do Not Send The Required Admin Token
- **File:** `api/_push.js` (lines 58-67); `api/push/send-lineup.js` (lines 13-15); `src/utils/pushNotifications.js` (lines 704-714, 871-883); `deployment.md` (lines 73-88)
- **Problem:** Server routes require `PUSH_ADMIN_TOKEN` for broadcast sends, but browser calls to `/api/push/send-lineup` and all-device test sends do not include an Authorization header. The deployment guide says the app passes the token, but the source does not.
- **Impact:** With `PUSH_ADMIN_TOKEN` set, lineup saves can succeed while push delivery silently fails with `401 Unauthorized`. If the token is removed to make the frontend work, broadcast routes become abusable.
- **Fix:** Do not expose `PUSH_ADMIN_TOKEN` to the browser. Instead, authenticate the user bearer token server-side and verify admin membership for the lineup's church before sending push notifications.

### API Routes Do Not Handle CORS Or OPTIONS
- **File:** `api/_push.js` (lines 112-116); `api/church/create.js` (lines 19-23); `api/church/join.js` (lines 3-4)
- **Problem:** API handlers only allow their concrete methods and do not respond to `OPTIONS` with CORS headers.
- **Impact:** Same-origin Vercel web calls work, but Capacitor/native WebViews, alternate domains, previews, or future cross-origin clients can fail preflight requests.
- **Fix:** Add shared CORS handling: allow `OPTIONS`, set `Access-Control-Allow-Origin` to the approved app origins, and allow `Authorization, Content-Type`.

### Full Lint Is Broken
- **File:** `eslint.config.js` (line 7); `src/components/EmptyState.jsx` (line 3); `src/sw.js` (line 5); `src/components/ShareAppQrModal.jsx` (line 7)
- **Problem:** `npm run lint` scans generated native web bundles under `android/app/src/main/assets/public` and `ios/App/App/public`. It also finds two source errors and one Fast Refresh warning.
- **Impact:** CI cannot rely on `npm run lint`, and real source regressions are buried under generated bundle errors. Current result: 334 errors and 1 warning.
- **Fix:** Ignore `android/**`, `ios/**`, `dist/**`, and `dev-dist/**` in ESLint. Remove unused `cleanupOutdatedCaches`, adjust `EmptyState` so `Icon` is not flagged, and move `APP_SHARE_URL` to a utility module or accept the warning.

### Deployment Documentation Is Out Of Sync With The Schema
- **File:** `deployment.md` (lines 20-32, 73-88); `supabase-schema.sql` (lines 11, 31, 477-506)
- **Problem:** The guide says the schema is safe to re-run because tables use `CREATE TABLE IF NOT EXISTS`, but `songs` and `lineups` use plain `CREATE TABLE`. It also says song/lineup writes are restricted to service role, while the schema currently allows public writes.
- **Impact:** Following the deployment guide can fail on an existing database or give a false sense of security.
- **Fix:** Update the guide after reconciling `supabase-schema.sql`, and make the schema idempotent for `songs` and `lineups`.

### Vite Dev Server Only Shims Church API Routes
- **File:** `vite.config.js` (lines 56-60); `src/utils/pushNotifications.js` (line 8)
- **Problem:** Local Vite middleware handles `/api/church/create` and `/api/church/join`, but no `/api/push/*` or `/api/lineup-notifications/*` routes.
- **Impact:** Push notification setup and tests fail under `npm run dev` unless using Vercel dev or deployment. This can look like a notification bug when it is a dev-server routing gap.
- **Fix:** Either document that push testing requires `vercel dev`, or extend the Vite API shim to load all local API routes.

### Dashboard Invite Code Query Silently Fails
- **File:** `src/pages/Dashboard.jsx` (lines 20-31)
- **Problem:** The admin invite-code query ignores Supabase errors and only sets invite code if `created_by === session.user.id`.
- **Impact:** If RLS denies `churches` reads or the user is an admin through `church_members.role` but not `created_by`, the UI shows no invite code and no error.
- **Fix:** Check `{ data, error }`, show a clear admin/setup message on error, and determine admin status from `church_members.role = 'admin'`.

## 🟢 Low Priority / Warnings
### Native Push Implementation Is Still Incomplete
- **File:** `status.md` (lines 64-74, 181-187); `native-app-tutorial.md` (lines 641-746); `.env` (lines 1-8)
- **Problem:** `@capacitor/push-notifications` is installed and configured, but `src/utils/nativePush.js`, `api/push/subscribe-native.js`, Firebase Admin code, and Firebase env vars are missing.
- **Impact:** Native iOS/Android push will not work yet. Web Push still works independently once API and environment issues are resolved.
- **Fix:** Complete Phase 4: add Firebase files/env, native subscribe route, native token table, and server-side native send helper.

### Capacitor Offline Network Plugin Is Pending
- **File:** `status.md` (lines 77-82); `src/hooks/useOffline.js` (lines 1-6); `native-app-tutorial.md` (lines 756-794)
- **Problem:** Offline detection uses browser `navigator.onLine`; `@capacitor/network` is not installed.
- **Impact:** Native WebView offline/online transitions may be less reliable than browser/PWA behavior.
- **Fix:** Install `@capacitor/network` and update `useOffline`/`useSyncStatus` to listen to Capacitor network status when running natively.

### Vite Env Values Are Loaded After Version Constants Are Computed
- **File:** `vite.config.js` (lines 12-17, 103-114)
- **Problem:** `APP_VERSION` and `BUILD_VERSION` are computed before `applyEnv(mode)` loads `.env` into `process.env`.
- **Impact:** `VITE_APP_VERSION` or `VITE_SERVICE_WORKER_VERSION` from `.env` may be ignored by Vite config. Current `.env` does not set them, so this is a latent config bug.
- **Fix:** Move `readVersionInfo()` and version constant computation inside `defineConfig` after `applyEnv(mode)`.

### Source Lint Errors Are Small But Real
- **File:** `src/components/EmptyState.jsx` (line 3); `src/sw.js` (line 5)
- **Problem:** ESLint flags `Icon` as unused in a destructured default parameter and `cleanupOutdatedCaches` as an unused import.
- **Impact:** These block lint even after generated native assets are ignored.
- **Fix:** Destructure `icon` as `IconComponent` inside the function body, and remove the unused `cleanupOutdatedCaches` import.

### Share QR Modal Has A Fast Refresh Warning
- **File:** `src/components/ShareAppQrModal.jsx` (line 7)
- **Problem:** The file exports both a component and `APP_SHARE_URL`.
- **Impact:** Fast Refresh can be less reliable during development.
- **Fix:** Move `APP_SHARE_URL` to `src/utils/shareUrl.js` and import it into the modal.

### Client Push Logging Still Prints Sensitive Subscription Details
- **File:** `src/utils/pushNotifications.js` (lines 24-30, 360-369)
- **Problem:** `logPush()` is unconditional, and line 369 prints the subscription payload including endpoint metadata.
- **Impact:** Browser console logs can expose semi-sensitive push endpoint/device details.
- **Fix:** Gate `logPush()` behind `import.meta.env.DEV` or a dedicated debug flag, and never log full endpoints in production.

### Duplicate Notification Writers Remain
- **File:** `supabase-schema.sql` (lines 621-656); `api/_push.js` (lines 787-841, 969-971)
- **Problem:** Both the database trigger and API helper can create `lineup_notifications` records for lineup events.
- **Impact:** Deduplication is better than before, but the architecture still has two writers that can drift.
- **Fix:** Choose one writer. Prefer the database trigger for created-lineup records, or remove the trigger and make the API the single source.

### API Routes Have No Rate Limiting
- **File:** `api/church/create.js` (lines 19-61); `api/church/join.js` (lines 3-32); `api/push/send-test.js` (lines 13-60)
- **Problem:** Authenticated church creation/join and push routes have no per-user/IP rate limits.
- **Impact:** Abuse can create slug conflicts, spam invalid invite attempts, or flood notification endpoints if auth checks are weakened.
- **Fix:** Add rate limiting at Vercel edge/middleware, Supabase audit tables, or a small server-side throttling store.

### Native Bundled Web Assets Can Become Stale
- **File:** `capacitor.config.ts` (line 6); `status.md` (line 60)
- **Problem:** Capacitor serves from `dist`, but native project assets under `ios/App/App/public` and `android/app/src/main/assets/public` only update after `npx cap sync`.
- **Impact:** After a web build, native shells can still contain older JS/CSS until sync is run.
- **Fix:** Always run `npm run build && npx cap sync` before native testing or release. Consider adding a script such as `build:native`.

### Production Bundle Is Large
- **File:** `vite.config.js` (lines 115-181)
- **Problem:** `npx vite build` warns that the main JS chunk is larger than 500 kB after minification.
- **Impact:** Initial load can be slower on mobile networks.
- **Fix:** Code-split route pages with `React.lazy()` and dynamic imports, or raise the warning only after measuring.

### README Still Describes Public/Local-First Assumptions
- **File:** `README.md` (lines 33, 47)
- **Problem:** README says the member-facing notification panel does not need login and data is stored in generic `worshipSongs`/`worshipLineups` localStorage keys.
- **Impact:** Documentation no longer matches the authenticated, multi-church direction of the app.
- **Fix:** Update README after schema and cache namespacing are finalized.

## ✅ What Is Working Correctly
- `api/church/create.js` exists and uses `getSupabaseAdmin()` from `api/_push.js`.
- `api/church/create.js` only accepts `POST`, requires `Authorization: Bearer <token>`, verifies the token with `supabase.auth.getUser(token)`, inserts `churches`, inserts `church_members` with `role = 'admin'`, and returns `{ church_id }`.
- `src/pages/JoinChurchPage.jsx` calls `/api/church/create` with `session.access_token` and no longer directly inserts `churches` from the browser.
- `src/App.jsx` calls `setActiveChurch(id)` in the `onJoined` callback after `setChurchId(id)`.
- App routes are protected by the top-level auth/church gates in `src/App.jsx`; unauthenticated users see `AuthPage`, authenticated users without a church see `JoinChurchPage`.
- `src/utils/supabase.js` keeps service-role credentials out of the frontend and only exposes Vite public env vars.
- `.gitignore` ignores `.env`.
- `npm test` passes: 1 test file, 20 tests.
- `npx vite build` passes: 1681 modules transformed and the service worker builds.
- A local Vite dev server started successfully with elevated local-network permission; `/` returned HTTP 200.
- Local `/api/church/create` dev probes returned expected JSON errors: `401 Not authenticated` with no bearer token and `401 Invalid token` with a fake token.
- Supabase storage calls use `AbortController` timeouts in `withTimeout()`.
- Push subscription, notification history, and delivery log tables have RLS enabled with no public policies in the repo schema.

## 🔧 Recommended Next Actions (in order)
1. Reconcile `supabase-schema.sql` with Phase 1 multi-tenancy: church tables, `church_id` columns, helper functions, indexes, and church-scoped RLS.
2. Apply the reconciled SQL in Supabase, then test: sign up, confirm email, log in, create church, reload, and verify `church_members` contains the admin row.
3. Add church filters to all song/lineup reads, detail fetches, deletes, realtime subscriptions, live caches, and offline storage.
4. Clear or namespace all local data on sign out and church changes.
5. Scope push subscriptions and push sends by `church_id`; replace static browser-inaccessible `PUSH_ADMIN_TOKEN` flow with server-side user/admin authorization.
6. Harden `api/church/join.js` and `api/church/create.js` with full error handling and a transactional RPC for create.
7. Fix ESLint ignores and the two source lint errors, then make `npm run lint` green.
8. Update `deployment.md`, `README.md`, and `status.md` so they match the actual schema, auth model, and create-church endpoint.
9. Decide whether local push testing should use `vercel dev` or extend the Vite API shim for all API routes.
10. Complete native push and Capacitor network phases only after the web/auth/RLS foundation is stable.
