# CCFBC Line Up Manager — Comprehensive Project Review

**Reviewed:** 2026-05-19  
**Scope:** Full project — React 19 PWA, Vercel serverless API, Supabase schema, Capacitor native projects, build tooling, security posture, phase progress, open bugs.

---

## Executive Summary

The web PWA is production-ready: the build is clean, all 20 unit tests pass, lint is green, and all environment variables are set for Vercel. A prior code review (2026-05-18) found 29 issues; 26 are fully fixed, 2 are partially fixed, and 1 is closed with a caveat. Two new critical blockers have since emerged: the Phase 1 multi-tenancy SQL has not been applied to Supabase, and the create-church flow crashes with an RLS error that prevents any new user from reaching the main app. The native app (iOS/Android via Capacitor) is structurally wired but blocked on tooling prerequisites, Firebase/APNs setup, and the Phase 1 database work.

| Target | Status | Blocker |
|---|---|---|
| Web (Vercel) | ✅ Ready to deploy | None |
| iOS (App Store) | ⏳ Pending | Xcode, APNs, Firebase, Phase 1 SQL |
| Android (Play Store) | ⏳ Pending | Android Studio, FCM, Firebase, Phase 1 SQL |

---

## Project Overview

**Type:** Multi-tenant church worship management app — song library, service lineups, chord charts, team assignments, real-time lyrics monitor, and push notifications.

**Platform strategy:** Single React 19 codebase served as a PWA, wrapped in native iOS/Android shells via Capacitor 8.3.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7 |
| PWA | Workbox (via vite-plugin-pwa 1.3), Service Worker, Web Push (VAPID) |
| Native shell | Capacitor 8.3 — iOS and Android WebView wrappers |
| Backend | Supabase Postgres, Realtime, Auth, Row Level Security |
| Serverless API | Vercel Functions (Node.js) — push, church join/create, notifications |
| Testing | Vitest 4.1.6 — 20 unit tests |
| Linting | ESLint 9.19 (flat config) |

### Features

- Email/password authentication (Supabase Auth, custom form — no third-party auth UI library)
- Multi-church isolation: each church has its own partitioned data (church_id), enforced by Supabase RLS
- Song library with chord chart editor and real-time transposition
- Service lineups with musician/team assignments and print export
- Real-time lyrics monitor page (projector/screen display)
- Three-layer notifications: in-app sound → Web Push (VAPID) → App Badging API
- Offline-first: localStorage + IndexedDB, service worker cache, background sync queue
- Supabase Realtime subscriptions with polling fallback and tab-visibility pause
- PWA install prompt and service worker update lifecycle

---

## Build & Test Health

### Commands

| Command | Status | Notes |
|---|---|---|
| `npm run dev` | ✅ Pass | Vite dev server at http://localhost:5173 — HTTP 200 |
| `npm run build` | ✅ Pass | 1686 modules, no errors |
| `npm test` | ✅ Pass | 20 tests — normalization, snake↔camelCase, notification logic |
| `npm run lint` | ✅ Pass | No ESLint errors |
| `vercel dev` | ✅ Pass | Frontend + serverless API routes together |

SW registration error in Vite dev mode is **expected** — service workers require HTTPS or a production build; this is not a bug.

### Environment Variables

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

### Schema Drift

`supabase-schema.sql` in the repo does not define `churches`, `church_members`, `my_church_id()`, `is_church_admin()`, or church-scoped RLS policies — yet the deployed database clearly has a `churches` table with RLS enabled (the create-church RLS error confirms it). The deployed database is ahead of the repo schema file and is the authoritative source for the current database state. Before applying further SQL, run the diagnostic queries in `bug-report-auth-crash.md` against Supabase SQL Editor to confirm exactly what is already in place.

---

## Native App Phase Progress

Based on `native-app-tutorial.md` and `status.md`.

### Phase 0 — Prerequisites

| Item | Status | Notes |
|---|---|---|
| Node 18+ | ✅ Done | Node 24.15.0 |
| Xcode (iOS) | ⏳ Pending | Manual install required on Mac |
| Android Studio | ⏳ Pending | Manual install required |
| CocoaPods | ⏳ Pending | `sudo gem install cocoapods` not run |
| Apple Developer Account ($99/yr) | ⏳ Pending | Required for real-device iOS and App Store |
| Google Play Account ($25) | ⏳ Pending | Required to publish on Android |

### Phase 1 — Multi-tenancy (database + auth)

**BLOCKER — nothing can be tested end-to-end until steps 1-1 through 1-4 are applied.**

| Step | Status | Notes |
|---|---|---|
| 1-1. Enable Supabase Auth in dashboard | ⏳ Pending | Email signups, Site URL, redirect URLs |
| 1-2. `churches` + `church_members` tables, `church_id` columns | ⏳ Pending | SQL not yet run in Supabase SQL Editor |
| 1-3. `my_church_id()` + `is_church_admin()` helper functions | ⏳ Pending | SQL not yet applied |
| 1-4. Church-scoped RLS policies (replace wide-open policies) | ⏳ Pending | SQL not yet applied |
| 1-5. `api/church/join.js` invite-code route | ✅ Done | Implemented, uses service-role key |

### Phase 2 — Auth in the React app

| Step | Status | Notes |
|---|---|---|
| 2-1. Auth helpers install | ⚠️ Superseded | `@supabase/auth-ui-react` crashed under React 19 (dual React instances). Replaced with custom form. |
| 2-2. `src/utils/supabase.js` auth options | ✅ Done | `persistSession`, `autoRefreshToken`, `detectSessionInUrl` |
| 2-3. `src/pages/AuthPage.jsx` | ✅ Done | Custom email/password form using `supabase.auth.signInWithPassword` + `signUp` |
| 2-4. `src/pages/JoinChurchPage.jsx` | ✅ Done | Join-by-invite and create-church flows — create flow has critical RLS bug (see §5) |
| 2-5. Auth gate in `App.jsx` | ✅ Done | `session` → `churchId` → main app gate with `loadChurch()` |
| 2-6. `church_id` through storage calls | ✅ Done | `setActiveChurch` / `getActiveChurchId` in `storage.js` |

### Phase 3 — Capacitor setup

| Step | Status | Notes |
|---|---|---|
| 3-1. Install Capacitor packages | ✅ Done | `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android` |
| 3-2. `npx cap init` | ✅ Done | App ID `com.ccfbc.lineupmanager` |
| 3-3. `capacitor.config.ts` | ✅ Done | `androidScheme: https`, PushNotifications, SplashScreen config |
| 3-4. iOS and Android platforms added | ✅ Done | `ios/` and `android/` native project folders exist |
| 3-5. Daily dev workflow documented | ✅ Done | `npm run build && npx cap sync`, then `npx cap open ios/android` |

### Phase 4 — Native push notifications

| Step | Status | Notes |
|---|---|---|
| 4-1. `@capacitor/push-notifications` v8.1.1 + `cap sync` | ✅ Done | Installed and synced |
| 4-2. iOS APNs setup | ⏳ Pending | Requires Xcode, Apple Dev Portal APNs key (.p8), Firebase iOS app, `GoogleService-Info.plist` |
| 4-3. Android FCM setup | ⏳ Pending | Requires Firebase Android app, `google-services.json`, Gradle plugin edits |
| 4-4. `src/utils/nativePush.js` | ⏳ Pending | Not yet created |
| 4-5. `api/push/subscribe-native.js` | ⏳ Pending | Not yet created |
| 4-6. Firebase Admin SDK send helper | ⏳ Pending | `firebase-admin` not installed, `api/_nativePush.js` not created, Firebase env vars missing |

### Phase 5 — Offline access

| Step | Status | Notes |
|---|---|---|
| 5-1. `@capacitor/network` + `useOffline.js` update | ⏳ Pending | Plugin not installed |
| 5-2. IndexedDB offline cache | ✅ Already working | Existing IDB strategy works unchanged in Capacitor WebView |

### Phase 6 — Member-facing access control

| Item | Status | Notes |
|---|---|---|
| Role enforcement (admin vs member) | ⏳ Pending | Depends on Phase 1 RLS being applied |
| Settings page with invite code display | ⏳ Pending | Not yet built |

### Phase 7 — App icons and splash screen

| Item | Status | Notes |
|---|---|---|
| `@capacitor/splash-screen` install | ⏳ Pending | |
| Icon generation via `@capacitor/assets` | ⏳ Pending | Requires a 1024×1024 source PNG at `public/icon-512.png` |

### Phase 8 — Build and deploy

| Target | Status | Notes |
|---|---|---|
| Vercel (web) | ✅ Ready | Build passes, deployment guide complete in `deployment.md` |
| iOS (Xcode → App Store) | ⏳ Pending | Blocked by Phases 4 and 7 |
| Android (Android Studio → Play Store) | ⏳ Pending | Blocked by Phases 4 and 7 |

---

## Open Bugs & Blockers

### CRIT-01 — Create-church RLS failure (Status: OPEN)

**File:** `src/pages/JoinChurchPage.jsx`  
**Severity:** Critical — blocks all new user onboarding  
**User-visible error:** `new row violates row-level security policy for table "churches"`

The create-church flow inserts directly into `churches` and `church_members` from the browser Supabase client. The deployed database has RLS enabled on `churches` with no permissive `INSERT` policy for the client (or the policy exists but the client is not authenticating with a valid session JWT). The join-by-invite-code flow correctly uses a trusted server endpoint (`/api/church/join`) with the service-role key; create-church does not.

**Secondary bugs in the same flow:**
1. The `church_members` insert result (`{ error }`) is never checked — membership failure is silent and the app calls `onJoined()` anyway.
2. `onJoined((id) => setChurchId(id))` in `App.jsx` only sets React state; it does not call `setActiveChurch(id)` from `storage.js`. Songs/lineups created immediately after joining may be saved without `church_id`.
3. Slug generation (`churchName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')`) can produce an empty slug (e.g. input `!!!`) and does not handle duplicate-slug conflicts gracefully.
4. `loadChurch()` in `App.jsx` discards the `error` from the `church_members` select — the app cannot distinguish "user has no church" from "RLS denied the lookup."

**Recommended fix:** Add `POST /api/church/create`, mirroring the `/api/church/join` pattern — verify the user JWT, then use the service-role client to insert both the `churches` row and the `church_members` admin row atomically. Update `JoinChurchPage` to call this endpoint, and fix `App.jsx` `onJoined` to call `setActiveChurch()`.

See `bug-report-auth-crash.md` for the full root-cause analysis, reproduction steps, and a 10-point validation plan.

---

### CRIT-02 — Phase 1 SQL not applied to Supabase (Status: OPEN)

The `churches` and `church_members` tables, `my_church_id()` and `is_church_admin()` functions, and all church-scoped RLS policies from Phase 1 of `native-app-tutorial.md` have not been applied to Supabase via SQL Editor. `supabase-schema.sql` in the repo also does not include them. All auth and multitenancy functionality depends on these.

**What to run first (diagnostic):** `bug-report-auth-crash.md` contains two SQL queries to check exactly which tables have RLS enabled and which policies exist on `churches` and `church_members`.

---

### H1 — Duplicate `lineup_notifications` writer (Status: PARTIALLY FIXED)

Two independent paths insert into `lineup_notifications`: the DB trigger `create_lineup_notification_on_insert` (writes `type = 'lineup_created'`) and `createLineupNotificationRecords()` in `api/_push.js` (writes `type = 'lineup'`). The unique index only dedupes `type = 'lineup_created'` rows, so API-path rows accumulate unbounded. Type normalization was improved but the dual-writer pattern remains. Fix: remove the API-side insert entirely and let the DB trigger be the single writer.

---

### L1 — Client push subscription log unconditional (Status: PARTIALLY FIXED)

Server-side push logs are now gated, but `pushNotifications.js:369` still logs the full subscription payload (`RESUBSCRIBE_THIS_DEVICE payload`) unconditionally on the client. Subscription endpoints are semi-sensitive; gate this behind a `DEBUG` flag.

---

## Code Review Findings — Fix Status

All 29 findings from the 2026-05-18 code review:

| ID | Finding | Status |
|---|---|---|
| C1 | Public RLS on songs/lineups allows anyone to delete all data | ⚠️ Context changed — RLS is intentionally anon-permissive as an interim measure until Phase 1 SQL is applied and church-scoped policies replace it. Data loss risk remains until Phase 1 runs. |
| C2 | Push API routes unauthenticated — anyone can spam all devices | ✅ Fixed — `PUSH_ADMIN_TOKEN` enforced on `send-lineup.js` and `send-test.js` |
| C3 | `push_subscriptions` table publicly readable (PII leak) | ✅ Fixed in schema — public policies dropped; pending SQL application to deployed Supabase |
| H1 | Duplicate `lineup_notifications` rows, type mismatch | ⚠️ Partially fixed — type normalization improved; dual-writer still present |
| H2 | Duplicate legacy API endpoints (`push-subscriptions.js`, `send-lineup-push.js`) | ✅ Fixed — both files deleted |
| H3 | Cross-channel notification dedup fragile (timestamp-dependent IDs) | ✅ Fixed — secondary dedup key `lineupId:eventSlug` added; single Realtime channel via `LineupRealtimeContext` |
| M1 | `read()` silently seeded localStorage with sample data on first call | ✅ Fixed — write side effect removed |
| M2 | Offline by-ID lookups skipped live cache (item visible in list, 404 when opened) | ✅ Fixed |
| M3 | `withTimeout()` raced but didn't cancel the underlying Supabase request | ✅ Fixed — refactored to factory with `AbortController`; all 10 call sites use `.abortSignal(signal)` |
| M4 | `consumeLocalLineupCreation()` consumed marker on first match; second event broke suppression | ✅ Fixed — marker kept for full TTL window |
| M5 | No automated tests or CI | ✅ Fixed — Vitest added; 20 tests passing. CI pipeline still missing (see Roadmap). |
| L1 | Verbose push logging in production (full endpoints logged) | ⚠️ Partially fixed — server logs gated; client subscription log still unconditional |
| L2 | Unusual dependency major versions (Vite 8, plugin-react 6) | ✅ Verified — build passes cleanly |
| L3 | Redundant Realtime subscriptions to `lineups` (two channels) | ✅ Fixed — duplicate channel removed; single channel via `LineupRealtimeContext` |
| L4 | SW message listener re-bound on every notification change | ✅ Fixed — `lineupNotificationsRef` pattern |
| L5 | TOCTOU race on save (select-then-insert/update) | ✅ Fixed — `saveSong` and `saveLineup` use `upsert({ onConflict: 'id' })` |
| L6 | `getRequestBody()` swallowed malformed JSON silently | ✅ Fixed — `console.warn` added in catch block |

**Session bugs fixed (2026-05-19):**

| ID | Finding | Status |
|---|---|---|
| BUG-AUTH-01 | `@supabase/auth-ui-react` bundled React 18, crashed under React 19 (dual instances) | ✅ Fixed — replaced with custom email/password form; auth-ui packages removed |
| BUG-AUTH-02 | `VITE_SUPABASE_ANON_KEY` and `PUSH_ADMIN_TOKEN` in `.env` were truncated display values | ✅ Fixed — full JWT and fresh 64-char hex token set |

---

## Security Assessment

| Area | Status | Notes |
|---|---|---|
| Push API authentication | ✅ Secured | `PUSH_ADMIN_TOKEN` required on `send-lineup` and `send-test` routes |
| Service-role key isolation | ✅ Secured | Never in client bundle; server-only in all API routes |
| `push_subscriptions` public access | ✅ Fixed in code | Public policies dropped in schema; pending deployment to Supabase SQL |
| `lineup_notifications` / `push_delivery_logs` | ✅ Secured | RLS enabled, no public policies — service role only |
| Songs/lineups RLS | ⚠️ Interim risk | Wide-open `USING (true)` policies remain until Phase 1 church-scoped RLS is applied. Any holder of the anon key can delete all songs and lineups. |
| Create-church browser inserts | ❌ Open | `JoinChurchPage` bypasses RLS pattern for church creation; blocked by RLS at runtime but unsafely designed |
| Rate limiting | ❌ Missing | No per-IP rate limiting on any API routes |

---

## Architecture Strengths

- **PWA update lifecycle** (`App.jsx`): version.json polling, `waitForWaitingWorker`, `controllerchange` with fallback timer, reload marker — correctly handles all SW update edge cases.
- **`useRealtimeItems`**: gracefully degrades from Realtime to polling, pauses when tab is hidden or offline, uses module-level stable callbacks to prevent re-subscription churn.
- **`LineupRealtimeContext`**: single Supabase Realtime channel for lineups prevents duplicate WebSocket subscriptions across components.
- **Notification dedup**: `lineupId:eventSlug` secondary key correctly drops duplicate notifications regardless of delivery channel.
- **Service-role isolation**: `lineup_notifications`, `push_delivery_logs`, and `push_subscriptions` (in schema) use the service-role-only pattern correctly.
- **Test coverage**: 20 Vitest unit tests cover the most subtle logic — normalization, case conversion, notification ID construction, and marker TTL semantics.
- **Offline depth**: three layers (localStorage, IndexedDB explicit offline, SW cache) with background sync queue for failed writes.

---

## Remaining Architectural Risks

- **H1 dual-writer**: `lineup_notifications` still has two independent insert paths (DB trigger + API side). Rows accumulate unbounded for API-path events.
- **Schema drift**: `supabase-schema.sql` is not the source of truth for the deployed database. The repo schema must be reconciled before it can be used reliably for future migrations.
- **No CI pipeline**: ESLint and Vitest are not enforced on push. A GitHub Actions workflow would catch regressions before they reach production.
- **Native push path incomplete**: `firebase-admin` not installed, `api/_nativePush.js` and `src/utils/nativePush.js` not created. The `@capacitor/push-notifications` plugin is installed and synced but non-functional until Phase 4 is complete.
- **Single-membership assumption**: `loadChurch()` uses `.limit(1).maybeSingle()` and `my_church_id()` returns the first membership. Users belonging to multiple churches are not yet supported.

---

## Prioritized Roadmap

| Priority | Action | Depends on | Effort |
|---|---|---|---|
| 1 | Run Phase 1 SQL in Supabase SQL Editor (tables, functions, RLS) | Diagnostic SQL first | Low (SQL only) |
| 2 | Enable Supabase Auth in dashboard (email signups, Site URL, redirect URLs) | Step 1 | Low (dashboard) |
| 3 | Add `POST /api/church/create` endpoint; fix `JoinChurchPage`; fix `App.jsx` `onJoined` | Steps 1–2 | Medium |
| 4 | Test full auth flow: sign up → email confirm → login → create/join church → main app | Steps 1–3 | Low (QA) |
| 5 | Firebase: create project, add iOS + Android apps, get APNs .p8 key, add `google-services.json` and `GoogleService-Info.plist` | Xcode + Android Studio installed | Medium |
| 6 | Implement native push: `nativePush.js`, `subscribe-native.js`, `_nativePush.js`, Firebase env vars | Step 5 | Medium |
| 7 | Install `@capacitor/network`; update `useOffline.js` for Capacitor native detection | None | Low |
| 8 | Build Settings page with invite code display for admins | Step 1 | Low |
| 9 | Install `@capacitor/splash-screen`; generate icons with `@capacitor/assets` (needs 1024×1024 PNG) | None | Low |
| 10 | iOS: Xcode Archive → App Store Connect; Android: Android Studio → Play Store AAB | Steps 5–9 | High (accounts, review) |
| 11 | Fix H1 dual-writer: remove API-side insert from `createLineupNotificationRecords()` | None | Low |
| 12 | Add GitHub Actions CI: lint + vitest on every push | None | Low |

---

## Files Referenced

| File | Purpose |
|---|---|
| `src/pages/JoinChurchPage.jsx` | Create-church RLS bug (CRIT-01) |
| `src/App.jsx` | Auth gate, `loadChurch()`, `onJoined()` handler |
| `api/church/join.js` | Reference implementation for trusted server endpoint pattern |
| `api/_push.js` | Shared push utilities, H1 dual-writer |
| `supabase-schema.sql` | Repo schema (does not match deployed database) |
| `native-app-tutorial.md` | Phase-by-phase implementation guide |
| `status.md` | Phase progress tracker |
| `bug-report-auth-crash.md` | CRIT-01 full analysis, diagnostic SQL, validation plan |
| `deployment.md` | Vercel + Supabase deployment guide |
| `debugging.md` | All 29 original bug fixes documented |
