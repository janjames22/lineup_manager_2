# CCFBC Line Up Manager — Debugging Report
**Updated:** 2026-05-25
**Basis:** Full code audit of all config, API, frontend, and Android files

## Summary

The audit found **18 issues** across all severity levels: 1 critical (data integrity), 4 high (security/data), 7 medium (bugs affecting specific scenarios), and 6 low (code quality). The most urgent problems are: `getSongs`/`getLineups` have no `church_id` filter so they return all churches' data after the Phase 1 migration; `subscribe-native.js` uses `fcm_token` as the upsert conflict column but the schema defines `UNIQUE (user_id, platform)` with the column named `token`, causing all FCM token saves to fail; and `VITE_PUSH_ADMIN_TOKEN` is exposed in the frontend bundle, making the admin push token publicly readable.

---

## Issues Found

### Critical (breaks functionality or exposes data)

| # | File | Line | Issue | Suggested Fix |
|---|---|---|---|---|

---

### High (security / data integrity risk)

| # | File | Line | Issue | Suggested Fix |
|---|---|---|---|---|

---

### Medium (bugs that affect specific scenarios)

| # | File | Line | Issue | Suggested Fix |
|---|---|---|---|---|
| M2 | `api/_nativePush.js` | 57–67 | `loadNativePushTokens()` loads ALL active tokens with no `church_id` filter. In a multi-church deployment, every lineup or song push for one church is delivered to all churches' Android users. | Add a `churchId` parameter to `loadNativePushTokens` and append `.eq('church_id', churchId)` to the query. Pass `churchId` from `send-lineup.js` and `send-song.js` (they already have the lineup/song record which carries `church_id`). |
| M3 | `api/_push.js` | 695–728 | `loadPushSubscriptions()` has no `church_id` filter — web push also broadcasts across all churches once multiple churches are onboarded. | Add an optional `churchId` parameter and filter with `.eq('church_id', churchId)` when provided. |
| M4 | `api/push/send-song.js` | 55–62 | The `lineup_notifications` insert happens **before** the push is sent. If the push send throws an error and returns a 500, the notification record is already saved, so the bell icon shows a song event the user never received a push for. | Move the `lineup_notifications` insert to after the push calls succeed, or handle the case gracefully by not surfacing the insert error to the response if the push succeeded. |
| M5 | `src/utils/nativePush.js` | 51–53 | `pushNotificationActionPerformed` (notification tap) only does `console.log`. When a user taps an FCM notification banner while the app is backgrounded, the app opens but does not navigate to the relevant lineup or song URL. | Import a navigation method (e.g. emit a custom DOM event the React Router can listen to, or use Capacitor `App.addListener('appUrlOpen')` pattern) with `action.notification.data?.url`. |
| M6 | `api/church/join.js` | 17–22 | The church lookup uses `.single()`. If no church matches the invite code, Supabase JS throws PGRST116 "no rows returned" before the `if (churchError || !church)` check, causing an unhandled exception and an opaque 500 response instead of the intended 404. | Change `.single()` to `.maybeSingle()`. |
| M7 | `src/pages/Dashboard.jsx` | 23–34 | Two `.single()` calls query `church_members` and `churches`. If there is no membership row yet (race between join and first page load), PGRST116 is thrown and the dashboard silently fails to display the invite code for admins. | Change both `.single()` calls to `.maybeSingle()` and handle the null case. |

---

### Low (code quality, warnings, cleanup)

| # | File | Line | Issue | Suggested Fix |
|---|---|---|---|---|
| L1 | `supabase-schema.sql` | 467–506 | Wide-open `USING (true)` / `WITH CHECK (true)` policies are defined for `songs` and `lineups`. These are intentionally permissive for the pre-auth version, but Phase 1 migration drops and replaces them. If a developer re-runs `supabase-schema.sql` after the Phase 1 migration, it silently re-opens the policies. | Add a prominent warning comment in `supabase-schema.sql` that these policies are overridden by Phase 1, or guard with `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='songs' AND policyname='songs_select') THEN ...`. |
| L2 | `api/_push.js` and `supabase-schema.sql` | `_push.js:791`, `schema.sql:621` | **Dual-writer for lineup notifications**: The DB trigger `trigger_create_lineup_notification_on_insert` fires on lineup INSERT and inserts a `lineup_created` record. `createLineupNotificationRecords()` in `_push.js` also inserts after every push. The `ON CONFLICT DO NOTHING` in the trigger and the dupe-check in `createLineupNotificationRecords` prevent duplicate rows, but two attempts happen for every new lineup. | Document this in both files. Consider having `createLineupNotificationRecords` skip the insert when `notificationType === 'lineup_created'` since the DB trigger already covers that case. |
| L3 | `api/push/subscribe.js` | 41–53 | `console.log('[push subscribe api] received', {...})` runs unconditionally in production. It logs the first 50 chars of the push endpoint, `device_id`, and `platform` to Vercel logs on every subscription attempt. | Replace with `debugPushServer()` / `logPushServer()` which already guard on `IS_PRODUCTION`. |
| L5 | `android/app/build.gradle` | 20–23 | `minifyEnabled false` in the release build type — no code shrinking, no obfuscation, larger APK. | Set `minifyEnabled true` and add `proguard-rules.pro` entries for Capacitor/Firebase. |
| L6 | `package.json` | 19 | `@capacitor/network` is at `^8.0.1` while all other `@capacitor/*` packages are `^8.3.4` or `^8.1.1`. | Update `@capacitor/network` to `^8.3.4` for consistency. |

---

## Verified Working

- **Channel ID consistency (`lineup_updates_v2`)**: Confirmed identical in all 4 locations — `MainActivity.java` line 14, `AndroidManifest.xml` line 31, `api/_nativePush.js` line 22, `src/utils/nativePush.js` line 21. No stale `lineup_updates` references found.
- **`createChannel()` fields complete**: `nativePush.js` lines 20–29 includes `id`, `name`, `description`, `importance`, `visibility`, `sound`, `vibration`, `lights` — all required Capacitor `Channel` fields present.
- **`FIREBASE_PRIVATE_KEY` unescaped correctly**: `api/_nativePush.js` line 8 applies `.replace(/\\n/g, '\n')`.
- **`loadChurch()` uses `.maybeSingle()`**: `App.jsx` line 641 confirmed. Null `churchId` routes correctly to `<JoinChurchPage>` at lines 678–683.
- **`setActiveChurch()` called on login**: `loadChurch()` calls it at lines 649 (success) and 655 (error fallback). Also called on `onJoined` callback at line 681.
- **`clearChurchData()` called on logout**: `handleSignOut()` line 662 calls `clearChurchData()` before `supabase.auth.signOut()`.
- **`registerNativePush(userId)` called after login**: Called in `getSession()` callback (line 592) and in `onAuthStateChange` handler (line 609) when session is truthy.
- **`deactivateInvalidNativeTokens` called in both send routes**: `send-lineup.js` line 71 and `send-song.js` line 80 both call it with `nativeResult.invalidTokens` when non-empty.
- **`excludeEndpoint` flows end-to-end**: Read from request body in `send-lineup.js` line 30 and `send-song.js` line 25; passed to `sendPushPayload` in both routes.
- **`dispatchLocalNotification` called after song save**: `SongForm.jsx` lines 280–286.
- **`dispatchLocalNotification` called after song delete**: `SongDetail.jsx` lines 63–69.
- **`sendSongPushNotification` called before delete**: `SongDetail.jsx` line 61 fires it fire-and-forget before `deleteSong`.
- **`NotificationsContext.Provider` wraps all routes**: `App.jsx` lines 722/740 confirmed.
- **`addNotification` guard allows song notifications**: `useLineupNotifications.js` line 66 — the guard `if (!notification.lineupId && !notification.songId && !notification.url) return false` correctly passes song notifications that carry a `songId`.
- **`appId` matches `applicationId`**: Both are `com.ccfbc.lineupmanager` (`capacitor.config.ts` line 4, `android/app/build.gradle` line 6).
- **SDK versions meet Play requirements**: `variables.gradle` — `compileSdkVersion = 36`, `targetSdkVersion = 36`, `minSdkVersion = 24`. Both compile and target exceed Play's minimum of 34.
- **Kotlin `resolutionStrategy` block present**: `android/build.gradle` lines 25–32 force stdlib to 1.8.22 — duplicate class fix is in place.
- **All `@capacitor/*` on major v8**: Confirmed in `package.json`. `@capacitor/push-notifications` at `^8.1.1`, others at `^8.3.4`.
- **No `@supabase/auth-ui-react`** in `package.json` — no React 19 incompatibility risk from that package.
- **`google-services.json` exists**: Confirmed at `android/app/google-services.json` (contents not read — may contain secrets).
- **Supabase client null-safe**: `src/utils/supabase.js` exports `null` when env vars are missing; `App.jsx` checks `if (!supabase)` before calling `getSession`.
- **`api/church/create.js` and `api/church/join.js` verify Supabase JWT**: Both routes call `supabase.auth.getUser(token)` and return 401 on failure.
- **`_push.js` `requireAdminToken` returns `false` (not blocks) when `PUSH_ADMIN_TOKEN` env var is missing**: Line 60 — `if (!token) return false`. This means push routes are unprotected if the env var is not set. Acceptable for internal-use apps but worth noting.

---

## Recommended Fix Order

1. ~~**H1 — `subscribe-native.js` column mismatch**~~ ✅ Fixed
2. ~~**C1 — Missing `church_id` filter in `getSongs`/`getLineups`**~~ ✅ Fixed
3. ~~**M1 — `subscribe-native.js` accepts `userId` from body without JWT check**~~ ✅ Fixed
4. ~~**H2 — `VITE_PUSH_ADMIN_TOKEN` in client bundle**~~ ✅ Fixed
5. ~~**M5 — Notification tap does not navigate**~~ ✅ Fixed
6. ~~**M2/M3 — No `church_id` filter on native token and web push loads**~~ ✅ Fixed
7. ~~**M6/M7 — `.single()` on possibly-empty queries**~~ ✅ Fixed
8. ~~**H3/H4 — FCM token logged unguarded, hardcoded URL**~~ ✅ Fixed

---

## Items That Need Manual Verification

- **Whether Phase 1 migration has been run on the live DB**: C1 severity is highest if the Phase 1 church-scoped RLS policies are active. Verify: `SELECT policyname FROM pg_policies WHERE tablename = 'songs';` — if you see `songs_select` the migration ran.
- **Whether `VITE_PUSH_ADMIN_TOKEN` is set in Vercel**: If it is empty, push send calls succeed without auth (because `requireAdminToken` returns `false` when the env var is unset). If it is set, it is exposed. Either way needs a fix.
- **Whether `google-services.json` in the repo matches the production Firebase project**: Confirm the `project_id` in the file matches `FIREBASE_PROJECT_ID` in Vercel env vars.

---

## ✅ Fixed in This Session (2026-05-25)

| # | File(s) | What was done |
|---|---|---|
| M1, H3, H4, L4 | `api/push/subscribe-native.js`, `src/utils/nativePush.js`, `src/App.jsx` | JWT verification added to `subscribe-native.js` — bearer token extracted from `Authorization` header, verified via `supabase.auth.getUser()`, `user.id` from JWT used directly (no `userId` body param or comparison needed). FCM token log gated behind `import.meta.env.DEV` + truncated. Hardcoded Vercel URL replaced with `/api/push/subscribe-native`. `subscribe-native.js` prod console.log gated behind `NODE_ENV !== 'production'`. `registerNativePush` signature changed to accept `accessToken`; `App.jsx` passes `session.access_token` at both call sites. |
| H2 | `src/utils/pushNotifications.js`, `api/_push.js`, `api/push/send-lineup.js`, `api/push/send-song.js`, `api/push/send-test.js`, `.env` | Removed `VITE_PUSH_ADMIN_TOKEN` from frontend entirely — const deleted, `.env` line removed. Added `import { supabase }` + `getAuthHeader()` helper that reads `supabase.auth.getSession()` and returns a Bearer header. Both send functions now call `await getAuthHeader()`. Server-side `requireAdminToken` made async and extended to accept a valid Supabase JWT (via `supabaseAdmin.auth.getUser()`) as an alternative to the static admin token. All three call sites updated to `await requireAdminToken(...)`. |
| M5 | `src/utils/nativePush.js`, `src/App.jsx` | `pushNotificationActionPerformed` now dispatches a `CustomEvent('nativePushNavigate', { detail: { url } })` on `window` when `action.notification.data?.url` is present. App.jsx adds a `useEffect` that listens for the event and calls `navigate(path)` using the same `new URL()` + origin-check guard pattern as the existing service worker message handler. |
| M2, M3 | `api/_nativePush.js`, `api/_push.js`, `api/push/send-lineup.js`, `api/push/send-song.js`, `src/utils/pushNotifications.js` | `loadNativePushTokens` and `loadPushSubscriptions` both accept optional `churchId` param and append `.eq('church_id', churchId)` when provided (no-op when null — preserves single-church behavior). `sendPushPayload` threads `churchId` through to `loadPushSubscriptions`. `send-lineup.js` passes `lineup.church_id` to both. `send-song.js` reads `churchId` from request body and passes it to both. `sendSongPushNotification` in frontend adds `churchId: song.churchId` to the POST body. Fallback query in `loadPushSubscriptions` intentionally omits the filter (column may not exist on old schemas). |
| M6, M7 | `api/church/join.js`, `src/pages/Dashboard.jsx` | `.single()` → `.maybeSingle()` on church lookup in `join.js` (null handled by existing `!church` guard) and on both `church_members` + `churches` queries in Dashboard (null handled by existing `member?.role` and `church?.invite_code` optional chains — no new guards needed). |
| C1 | `src/utils/storage.js` | 465, 515, 642, 686 | Added `.eq('church_id', getActiveChurchId())` to all 4 read paths: `getSongs()`, `getSongById()`, `getLineups()`, `getLineupById()`. Original audit only cited 2; full search found 4 unfiltered reads. Writes and deletes were already safe (writes carry `church_id` in payload; deletes scope by PK with RLS enforcement). |
| H1 | `api/push/subscribe-native.js`, `api/_nativePush.js`, `phase1-migration.sql` | **Live DB uses `UNIQUE (fcm_token)` as the only constraint** — audit was wrong on two counts: (1) column is `fcm_token` not `token`, (2) unique constraint is on `fcm_token` alone, not `(user_id, platform)`. Original `onConflict: 'fcm_token'` was correct and restored. `phase1-migration.sql` updated to match live reality: `fcm_token` column, `UNIQUE (fcm_token)`, `updated_at` instead of `last_seen_at`. `_nativePush.js` simplified to use `fcm_token` directly with no fallback. |
