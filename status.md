# CCFBC Line Up Manager — Status
**Updated:** 2026-05-25  
**Basis:** Full code review against `native-app-tutorial.md` (8 phases)

---

## Today's Accomplishments — May 25, 2026

- **Notification sound fix** — Android channel renamed `lineup_updates` → `lineup_updates_v2` across all 4 files; `MainActivity.java` updated with explicit `setSound`, `AudioAttributes`, `setVibrationPattern`; debug APK built and confirmed

- **12 security + bug fixes from full code audit** — C1 (cross-church data leak), H1 (FCM token schema mismatch), H2 (admin token exposed in client bundle → switched to Supabase JWT), H3/H4 (FCM token logged in prod, hardcoded URL), M1 (unauthenticated native push subscribe), M2/M3 (no church_id filter on push token + subscription loads), M5 (notification tap did nothing → now navigates in-app), M6/M7 (`.single()` throwing on empty queries), L4 (prod console.log unguarded)

- **Phase 1 multi-tenancy confirmed complete** — live DB audit confirmed all 8 tables, both RLS helper functions, and all church-scoped policies already active; 5 orphan `lineup_notifications` rows (pre-church_id era) deleted via `phase1-backfill-delete.sql`

- **Production deployment hardened** — `VITE_PUSH_ADMIN_TOKEN` removed from client bundle; all push send routes now authenticate via Supabase JWT; `requireAdminToken` accepts either JWT or server-to-server admin token

---

## Strategic Decisions

- **Android only** — iOS support dropped. The project targets Android / Google Play Store exclusively. Xcode, CocoaPods, APNs, Apple Developer Account, and the `ios/` Capacitor platform are all out of scope.
- **No paid services until quality-verified** — No money will be spent until the app is fully functional and tested on a real Android device. Firebase (free tier) is the only external service used and stays within free limits at current scale.
- **Google Play Developer account ($25)** — deferred to the very last step, after the app passes end-to-end testing on a real Android device.

---

## Recent Updates (since 2026-05-22)

- **Song notifications** — `api/push/send-song.js` created; `saveSong` now sends FCM + web push on add/update; `SongDetail.jsx` sends push on delete; all three call `dispatchLocalNotification` so the saving device also sees the notification in the bell panel
- **Notification panel simplified** — removed sound toggle, diagnostic UI, phone push settings; replaced with clean bell icon + dropdown (unread badge, mark-all-read, time-ago, Music icon for song events)
- **`NotificationsContext.js`** created; `App.jsx` provides `dispatchLocalNotification` via context; `SongForm.jsx` and `SongDetail.jsx` consume it
- **FCM as primary delivery** — `send-lineup.js` and `send-song.js` both now call native FCM first (via `loadNativePushTokens` + `sendNativePush`), web push as fallback for browser users
- **`_nativePush.js` helpers** — `loadNativePushTokens(supabase)` and `deactivateInvalidNativeTokens(supabase, tokens)` added
- **Firebase env vars** — `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` now set in `.env`; `VITE_PUSH_ADMIN_TOKEN` also set
- **`google-services.json`** — now present in `android/app/`; Gradle plugin conditionally applies when file exists (already configured in `android/app/build.gradle`) → Phase 4.3 complete
- **Notification sound fix (May 25)** — channel renamed to `lineup_updates_v2` in `AndroidManifest.xml`, `api/_nativePush.js`, `src/utils/nativePush.js`; `MainActivity.java` updated with `setSound(RingtoneManager…)` + `AudioAttributes` + `setVibrationPattern`; debug APK built successfully
- **SettingsPage.jsx** built — shows church name, invite code (admin only, with copy button), member list with role badges; wired into Navbar and BottomNav
- **`send-song.js` excludeEndpoint bug fixed** — was silently ignoring `excludeEndpoint` from request body

---

## Overall Progress

**~78% complete** — Phase 1 multi-tenancy confirmed live. All 12 audit issues fixed and deployed. Web PWA production-ready with hardened auth. Single remaining code blocker before device testing: `MainActivity.java` channel ID (one line). After that: device test → Phase 7 icons → signed APK → Play Store.

| Phase | Description | % Done | Status |
|---|---|---|---|
| Phase 0 | Prerequisites (tools, accounts) | 33% | 🔄 Partial — Android Studio status unknown; Google Play account deferred |
| Phase 1 | Multi-tenancy DB schema + RLS | 100% | ✅ Confirmed live 2026-05-25 — all tables, functions, policies active; orphan rows cleaned |
| Phase 2 | React auth + church join flow | 95% | ✅ All code done (better than tutorial spec); E2E test pending |
| Phase 3 | Capacitor setup | 100% | ✅ Complete |
| Phase 4 | Native push notifications | 95% | 🔄 Code + config done; `MainActivity.java` CHANNEL_ID confirmed `lineup_updates_v2`; notification sound confirmed on Xiaomi 2026-05-25; remaining: verify Firebase env vars in Vercel |
| Phase 5 | Offline access | 100% | ✅ Complete |
| Phase 6 | Member access control UI | 80% | 🔄 Settings page done; Phase 1 now live — needs E2E test of invite code + role enforcement |
| Phase 7 | Icons + splash screen | 0% | ❌ Not started |
| Phase 8 | Store deployment | 50% | 🔄 Web ready; Android blocked on Phase 4 device test + Phase 7 |

---

## Notification Sound Fix — May 25, 2026

### Channel ID renamed: `lineup_updates` → `lineup_updates_v2`

Android locks notification channel settings (sound, vibration) permanently after first creation. Because the `lineup_updates` channel was created without explicit sound settings on first install, Android ignores any `setSound` updates to that channel. The fix is a new channel ID.

| File | Change | Status |
|---|---|---|
| `android/app/src/main/AndroidManifest.xml` | `android:value="lineup_updates_v2"` | ✅ Updated |
| `api/_nativePush.js` | `channelId: 'lineup_updates_v2'` | ✅ Updated |
| `src/utils/nativePush.js` | `id: 'lineup_updates_v2'` in `createChannel` | ✅ Updated |
| `android/…/MainActivity.java` | **`CHANNEL_ID = "lineup_updates"`** — still OLD | ❌ NOT updated |

> **Action required:** Update `MainActivity.java` line 11: `static final String CHANNEL_ID = "lineup_updates_v2";`
> Without this, the Java channel created on app start uses the old ID and Android falls back to it instead of the v2 channel.

### Additional `MainActivity.java` changes (applied)
- `setSound(RingtoneManager.getDefaultUri(TYPE_NOTIFICATION), audioAttributes)` with `AudioAttributes.USAGE_NOTIFICATION`
- `setVibrationPattern(new long[]{0, 250, 250, 250})`
- Added imports: `AudioAttributes`, `RingtoneManager`, `Uri`

### FCM payload changes (applied in `api/_nativePush.js`)
- `android.priority: 'high'`
- `android.notification.channelId: 'lineup_updates_v2'`
- `android.notification.sound: 'default'`
- `android.notification.defaultSound: true`
- `android.notification.vibrateTimingsMillis: [0, 250, 250, 250]`
- `android.notification.defaultVibrateTimings: false`

### Build status
- ✅ Debug APK built successfully on 2026-05-25
- ❌ Signed release APK: not yet generated

### What still needs to be done
1. Fix `MainActivity.java` `CHANNEL_ID` to `"lineup_updates_v2"` (see action above)
2. Fix `src/utils/nativePush.js` createChannel call — missing required `name` field (see Code Errors #13)
3. Test on connected Xiaomi M2102J20SG — verify notification sound actually plays
4. Generate signed release APK in Android Studio (Build → Generate Signed Bundle/APK)

---

## Code Errors & Warnings

Issues found during this review. Severity: 🔴 Bug / 🟡 Warning / 🔵 TODO

| # | Severity | File | Line | Issue |
|---|---|---|---|---|
| 1 | 🟡 | `api/church/join.js` | 21 | Uses `.single()` instead of `.maybeSingle()`. When no church matches the invite code, `.single()` returns PGRST116 rather than `null`. The error-check handles it but `.maybeSingle()` is the correct idiom. |
| 2 | ✅ | `src/hooks/useOffline.js` | — | **FIXED.** Now uses `@capacitor/network` `Network.getStatus()` + `addListener` on native, falls back to `useSyncStatus` on web. |
| 3 | ✅ | `src/utils/nativePush.js` | — | Created and functional. |
| 4 | ✅ | `api/push/subscribe-native.js` | — | Created with CORS headers, OPTIONS preflight, UUID validation. |
| 5 | ✅ | `firebase-admin` + `api/_nativePush.js` | — | Installed; `sendNativePush()` functional with `sendEachForMulticast` + invalid token cleanup. |
| 6 | ✅ | `package.json` | — | `@capacitor/network@8.0.1` installed. |
| 7 | 🔵 | `package.json` | — | `@capacitor/splash-screen` not installed. Required for Phase 7. |
| 8 | 🟡 | `supabase-schema.sql` | — | Schema file still missing Phase 1 tables (`churches`, `church_members`), RLS functions, church-scoped policies, and `native_push_tokens`. Deployed DB is ahead of repo file — schema drift risk if DB is reset or cloned. |
| 9 | 🟡 | `storage.js` — `getSongs`, `getSongById`, `getLineups` | — | Supabase queries fetch all rows without a `church_id` filter. Intentional until Phase 1 RLS is applied; after that, RLS enforces isolation automatically. |
| 10 | 🟡 | `api/push/send-lineup.js`, `api/push/send-song.js` | — | Push sent to all active subscribers globally, not scoped to a church. After Phase 1, these need a `church_id` filter on `push_subscriptions` and `native_push_tokens` queries. |
| 11 | 🟡 | `src/utils/pushNotifications.js` | ~369 | Full subscription payload (contains endpoint URL) logged unconditionally. Should be gated behind `IS_DEV` or removed. |
| 12 | 🟡 | `api/_push.js` — `createLineupNotificationRecords()` | — | Dual-writer pattern: both the DB trigger and this API function write to `lineup_notifications`. Unbounded duplicate rows for non-`lineup_created` event types. Fix: remove API-side insert; rely on DB trigger only. |
| 13 | 🔴 | `src/utils/nativePush.js` | createChannel | `createChannel` call is missing the required `name` field. Capacitor `Channel` interface requires both `id` and `name`. The call may fail silently or create a channel with an empty visible name. **Fix:** add `name: 'Lineup Updates'` to the object. |
| 14 | 🔴 | `android/…/MainActivity.java` | 11 | `CHANNEL_ID = "lineup_updates"` — still uses old channel ID. All other files now reference `lineup_updates_v2`. This means the Java channel (created on every app start) has the wrong ID and wrong settings. **Fix:** change to `"lineup_updates_v2"`. |
| 15 | 🟡 | `api/push/subscribe-native.js` | 42 | Upserts with column `fcm_token` and `onConflict: 'fcm_token'`, but `phase1-migration.sql` creates the column as `token`. If the migration was run as written, all token registrations from this route silently fail (42703 column-not-found). Verify actual column name in Supabase; fix either the migration or the route to match. |
| 16 | 🟡 | `api/push/subscribe-native.js` | — | No JWT verification — accepts `userId` from request body without validating a session token. Any caller can register any UUID as the userId. Low risk for a church-internal app but should be hardened before Play Store. |

### Improvements vs Tutorial Spec

| Area | Tutorial Spec | Actual Implementation |
|---|---|---|
| `JoinChurchPage.jsx` — create church | Direct `supabase.from('churches').insert()` from browser | Calls `POST /api/church/create` (trusted server route) — RLS-safe |
| `api/church/create.js` | No rollback on member insert failure | Deletes the church row if membership insert fails — atomic |
| `App.jsx loadChurch()` | Uses `.single()` (throws on empty) | Uses `.maybeSingle()` — returns `null` instead of throwing |
| `AuthPage.jsx` | `<Auth>` from `@supabase/auth-ui-react` (React 18 dep, crashes React 19) | Custom Tailwind form — no external dep, no crash |
| Notification delivery | Web push only | Native FCM primary + web push fallback in both `send-lineup.js` and `send-song.js` |
| Song notifications | Not in tutorial | Full song add/update/delete push + local panel notification |

---

## Phase-by-Phase Detail

### Phase 0 — Prerequisites

| Item | Status | Notes |
|---|---|---|
| Node 18+ | ✅ Done | Node 24.15.0 confirmed |
| Android Studio | ⏳ Pending | Must be installed manually before APK signing |
| Google Play Account ($25) | ⏳ Deferred | Purchase ONLY after app is fully tested on real Android device — last step |
| iOS / Xcode / CocoaPods / Apple Developer Account | ❌ N/A | iOS dropped from scope |

---

### Phase 1 — Multi-tenancy (database + auth)

| Step | Status | Notes |
|---|---|---|
| 1-1. Enable Supabase Auth in dashboard | ⏳ Unconfirmed | Dashboard action: email signups + Site URL + localhost redirect — cannot verify from code alone |
| 1-2. New DB tables (`churches`, `church_members`, `church_id` columns) | ✅ Done | **Confirmed live 2026-05-25:** all 8 tables exist; `church_id` on songs, lineups, push_subscriptions, lineup_notifications; `native_push_tokens` with `UNIQUE(fcm_token)` |
| 1-3. Helper RLS functions (`my_church_id()`, `is_church_admin()`) | ✅ Done | **Confirmed live 2026-05-25:** both functions present in public schema |
| 1-4. Rewrite RLS policies (church-scoped) | ✅ Done | **Confirmed live 2026-05-25:** songs (4), lineups (4), churches (2), church_members (2), native_push_tokens (1) all active. push_subscriptions / lineup_notifications / push_delivery_logs intentionally have no client policies — service role only via API routes |
| 1-5. `api/church/join.js` invite-code route | ✅ Done | Auth check, upsert-on-conflict, UUID validation |
| 1-6. `api/church/create.js` create route | ✅ Done | **Beyond tutorial** — trusted server route, atomic rollback |
| Orphan cleanup | ✅ Done | 2026-05-25: 5 pre-church_id `lineup_notifications` rows deleted via `phase1-backfill-delete.sql`; songs (3) and lineups (1) already had `church_id` set |

> **Phase 1 complete.** Live DB confirmed via `phase1-pre-migration-check.sql` + `phase1-orphan-check.sql` on 2026-05-25. All schema, RLS functions, and church-scoped policies are active. Only unconfirmed item is Supabase Auth dashboard settings (email signups, Site URL, redirect URL) which cannot be verified from code.

---

### Phase 2 — Auth in the React app

| Step | Status | Notes |
|---|---|---|
| 2-1. Install auth helpers | ⚠️ Superseded | `@supabase/auth-ui-react` installed then **uninstalled** — ships React 18 internally, crashes React 19 |
| 2-2. Update `src/utils/supabase.js` | ✅ Done | `persistSession`, `autoRefreshToken`, `detectSessionInUrl` configured |
| 2-3. Create `src/pages/AuthPage.jsx` | ✅ Done | Custom email/password form using Supabase auth directly |
| 2-4. Create `src/pages/JoinChurchPage.jsx` | ✅ Done | Join-by-invite-code + create-church, both via trusted API routes |
| 2-5. Gate `App.jsx` with auth | ✅ Done | `session`, `churchId`, `authLoading` + `loadChurch()` using `maybeSingle()` + 3 early returns |
| 2-6. Pass `church_id` through storage | ✅ Done | `setActiveChurch` / `getActiveChurchId` in `storage.js`; injected into `saveSong` + `saveLineup` |

---

### Phase 3 — Capacitor setup

| Step | Status | Notes |
|---|---|---|
| 3-1. Install Capacitor | ✅ Done | `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` all present in `package.json` |
| 3-2. Init Capacitor | ✅ Done | `capacitor.config.ts` present with correct `appId` and `webDir` |
| 3-3. Update `capacitor.config.ts` | ✅ Done | `server.androidScheme`, `PushNotifications.presentationOptions`, `SplashScreen` config present |
| 3-4. Add iOS and Android platforms | ✅ Done | `android/` native project folder present |
| 3-5. Daily dev workflow | 📖 Documented | `npm run build && npx cap sync`, then `npx cap open android` |

---

### Phase 4 — Native push notifications

| Step | Status | Notes |
|---|---|---|
| 4-1. Install `@capacitor/push-notifications` | ✅ Done | v8.1.1 in `package.json` |
| 4-2. iOS APNs setup | ❌ N/A | iOS dropped from scope |
| 4-3. Android FCM setup | ✅ Done | `google-services.json` in `android/app/`; `build.gradle` (project): `classpath 'com.google.gms:google-services:4.4.4'`; `app/build.gradle`: conditionally applies plugin when JSON present |
| 4-4. `src/utils/nativePush.js` | 🔄 Done (with bug) | `registerNativePush()` + `createChannel` call present; **missing `name` field** in `createChannel` (see Error #13) |
| 4-5. `api/push/subscribe-native.js` | 🔄 Done (with bug) | CORS, UUID validation, Supabase upsert present; **column name mismatch** `fcm_token` vs `token` (Error #15); no JWT verification (Error #16) |
| 4-6. Server-side Firebase Admin SDK | ✅ Done | `firebase-admin` installed; `api/_nativePush.js` has `sendNativePush()` + `loadNativePushTokens()` + `deactivateInvalidNativeTokens()`; FCM integrated as primary in both `send-lineup.js` and `send-song.js`; Firebase env vars set in `.env` |

> **Remaining Phase 4 blockers before declaring complete:**
> - Fix `nativePush.js` `createChannel` missing `name` field (Error #13)
> - Fix `MainActivity.java` channel ID inconsistency (Error #14)  
> - Verify Firebase credentials are set in **Vercel** project settings (`.env` local only)
> - Verify `native_push_tokens` table column name matches `subscribe-native.js` usage (`fcm_token` vs `token`)
> - End-to-end test: install debug APK → receive FCM push with sound on Xiaomi M2102J20SG

---

### Phase 5 — Offline access

| Step | Status | Notes |
|---|---|---|
| 5-1. `@capacitor/network` + `useOffline.js` update | ✅ Done | `@capacitor/network@8.0.1` in `package.json`; `useOffline.js` uses `Network.getStatus()` + `addListener` on native, falls back to `useSyncStatus` on web |
| 5-2. IndexedDB offline cache | ✅ Done | Existing IDB strategy unchanged, works in Capacitor WebView |

---

### Phase 6 — Member-facing access control

| Item | Status | Notes |
|---|---|---|
| `src/pages/SettingsPage.jsx` | ✅ Done | Built — shows church name, invite code (admin-only) with copy button, member list with role badges; wired into Navbar + BottomNav |
| Invite code display working end-to-end | ⏳ Blocked | Depends on Phase 1 SQL being applied so `churches.invite_code` column exists |
| Role enforcement (admin vs member) | ⏳ Blocked | Depends on Phase 1 DB + RLS |

---

### Phase 7 — App icons and splash screen

| Item | Status | Notes |
|---|---|---|
| `@capacitor/splash-screen` install | ❌ Pending | Not in `package.json` |
| `@capacitor/assets` icon generation | ❌ Pending | Source `public/icon-512.png` exists; run Android sizes only (iOS dropped) |

---

### Phase 8 — Build and deploy

| Target | Status | Notes |
|---|---|---|
| iOS | ❌ N/A | iOS dropped from scope |
| Android (Play Store) | ❌ Pending | Blocked by Phase 4 end-to-end test + Phase 7 + signed APK |
| Vercel (web) | ✅ Ready | `npm run build` passes cleanly; deployed |

---

## Review.md Findings — Current Status

### Critical

| ID | Finding | Status |
|---|---|---|
| C1 | Public RLS on songs/lineups | ✅ Fixed — `church_id` injected into every write; RLS will enforce once Phase 1 SQL applied |
| C2 | Unauthenticated push routes | ✅ Fixed — `PUSH_ADMIN_TOKEN` set (64 chars); `requireAdminToken` enforced; `VITE_PUSH_ADMIN_TOKEN` also set |
| C3 | Public `push_subscriptions` access | ✅ Fixed in schema — pending SQL application to Supabase |

### High

| ID | Finding | Status |
|---|---|---|
| H1 | Duplicate `lineup_notifications` rows | 🔄 Partial — type normalization improved; dual-writer pattern (DB trigger + API) still exists |
| H2 | Duplicate legacy API endpoints | ✅ Fixed |
| H3 | Cross-channel notification dedup | ✅ Fixed |

### Medium / Low

| ID | Finding | Status |
|---|---|---|
| M1–M5 | Various storage/offline/dedup fixes | ✅ All fixed |
| L1 | Client push log unconditional | 🔄 Partial — server logs gated; client subscription log still unconditional (`pushNotifications.js:~369`) |
| L2–L6 | Dep versions, realtime, TOCTOU, malformed JSON | ✅ All fixed |

---

## Bugs Fixed Since May 22

- `saveSong` was not calling `sendSongPushNotification` — now does on add/update
- `send-song.js` silently ignored `excludeEndpoint` from request body — now reads and passes it
- `addNotification` guard rejected all non-lineup notifications (`!notification.lineupId`) — now accepts song + URL types
- Cross-channel dedup key `null:song_created` shared by all songs — now uses `entityId || songId`
- `createLineupNotificationFromPush` returned null for song payloads — now handles `song_*` types
- `NotificationBell.jsx` — sound toggle, diagnostic UI, phone push settings all removed; clean bell UI implemented
- `send-lineup.js` and `send-song.js` — native FCM integrated as primary delivery

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
| `VITE_PUSH_ADMIN_TOKEN` | ✅ Set | 64 chars | Client-accessible copy; must also be set in Vercel |
| `FIREBASE_PROJECT_ID` | ✅ Set | — | Set in `.env`; **must also be set in Vercel project settings** |
| `FIREBASE_CLIENT_EMAIL` | ✅ Set | — | Set in `.env`; **must also be set in Vercel project settings** |
| `FIREBASE_PRIVATE_KEY` | ✅ Set | — | Set in `.env`; **must also be set in Vercel project settings** |

> All Firebase vars are now present in local `.env`. Verify they are also set in Vercel → Settings → Environment Variables before testing FCM delivery from deployed API.

---

## Build & Test Status

| Task | Status | Notes |
|---|---|---|
| `npm run build` | ✅ Pass | Clean; last confirmed 2026-05-25 |
| `npm test` | ✅ Pass | 20 Vitest tests passing |
| `npm run lint` | ✅ Pass | No errors |
| `vercel dev` | ✅ Pass | Frontend + serverless API together |
| Debug APK (Android) | ✅ Built | Built 2026-05-25; notification banners working; sound under test |
| Signed release APK | ❌ Pending | Android Studio → Build → Generate Signed Bundle/APK |

---

## Next Steps (Priority Order)

1. ~~**Fix `MainActivity.java` CHANNEL_ID**~~ ✅ Already `lineup_updates_v2`; notification sound confirmed on device 2026-05-25

2. **Set Firebase env vars in Vercel** — `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` must be in Vercel project settings for the deployed API to send FCM pushes. (`VITE_PUSH_ADMIN_TOKEN` is now removed — do not re-add it.)

3. **Test notification sound on Xiaomi M2102J20SG** — `npm run build && npx cap sync android`, open in Android Studio, build + install debug APK, trigger a lineup push, verify banner appears with sound.

4. **Test full auth + church flow end-to-end** — sign in → join/create church → verify songs + lineups load correctly under RLS → verify invite code visible to admin in Settings.

5. **Confirm Supabase Auth dashboard settings** — email signups enabled, Site URL set to Vercel domain, `http://localhost:5173` in Redirect URLs.

6. **Phase 7 — Icons + splash (Android only)** — `npm install @capacitor/splash-screen`, then `npx capacitor-assets generate` for Android sizes using `public/icon-512.png`.

7. **Generate signed release APK** — Android Studio → Build → Generate Signed Bundle/APK.

8. **Install Android Studio** if not already done — required for signed APK generation.

9. **Pay $25 and register Google Play Developer account** — only after end-to-end device test passes.

10. **Phase 8 — Play Store submission** — signed AAB upload to Google Play Console internal test track.
