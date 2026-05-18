# CCFBC Line Up Manager Status

Generated: 2026-05-18  
Basis: `review.md` plus current source/config/schema/API review

## Scope

I reviewed the owned project files under `ccfbc_lineup_manager_code`, including:

- App source: `src/`
- Serverless API routes: `api/`
- Supabase schema: `supabase-schema.sql`
- PWA/service worker config: `src/sw.js`, `vite.config.js`, `index.html`, `vercel.json`
- Project docs/config: `README.md`, `debugging.md`, `native-app-tutorial.md`, `package.json`, `eslint.config.js`

Excluded from source review: `node_modules/`, `.git/`, `dist/`, `dev-dist/`, lockfiles, generated/built assets, PNG files, and WAV files.

## Executive Summary

The repository has already changed since `review.md`. Several review findings are now fixed or partially fixed in the working tree, especially the Supabase RLS schema and duplicate legacy API routes. However, some fixes are incomplete and create new operational risks.

The most important current blocker is the mismatch between the locked-down Supabase schema and the client data layer. The schema now says writes go through Vercel service-role API routes, but the app still writes songs and lineups directly from the browser using the public anon Supabase client. If the new schema is applied as written, create/update/delete for songs and lineups will fail unless server-side CRUD routes or authenticated write policies are added.

Push route protection is also only partially implemented. The code supports `PUSH_ADMIN_TOKEN`, but it is optional. If the env var is missing, privileged routes remain open. If it is set, the current frontend call to `/api/push/send-lineup` does not send an authorization header, so legitimate lineup saves can fail to send pushes.

Current lint status is not clean. `npm run lint` fails with two errors and one warning:

- `src/components/EmptyState.jsx:3` - `Icon` is reported as unused.
- `src/sw.js:5` - `cleanupOutdatedCaches` is imported but unused.
- `src/components/ShareAppQrModal.jsx:7` - Fast Refresh warning for a non-component export.

I did not run `npm run build` because `prebuild` updates `public/version.json`, and that file was already modified before this report.

## Current Bug Status From `review.md`

### C1. Public RLS on `songs` and `lineups`

Status: Partially fixed, but now a functional blocker unless matching app changes are made.

Current evidence:

- `supabase-schema.sql` now keeps public `SELECT` only for `songs` and `lineups`.
- The public insert/update/delete policies from `review.md` are gone.
- Comments in the schema say writes should go through Vercel API routes using `SUPABASE_SERVICE_ROLE_KEY`.
- The frontend still uses the anon client from `src/utils/supabase.js`.
- `src/utils/storage.js` still performs direct browser Supabase writes for `saveSong`, `saveLineup`, `deleteSong`, and `deleteLineup`.
- There are no `api/songs/*` or `api/lineups/*` CRUD routes in the current `api/` directory.

Risk now:

- If the deployed database still has the old public write policies, the original data-loss/vandalism risk remains.
- If the new schema is applied, anonymous client writes will be blocked and the app cannot save/delete songs or lineups through Supabase.

Recommended next action:

Choose one coherent write model:

- Add Supabase Auth and authenticated write policies, then update the UI to require login for writes.
- Or keep the app login-free and add service-role Vercel CRUD routes for songs and lineups, then update `storage.js` to call those routes instead of writing through the anon client.

### C2. Unauthenticated push send routes

Status: Partially fixed, still unsafe by default and incompatible with the current frontend when enabled.

Current evidence:

- `api/push/send-lineup.js` calls `requireAdminToken()`.
- `api/push/send-test.js` calls `requireAdminToken()` only for broadcast sends.
- `api/_push.js` returns `false` from `requireAdminToken()` when `PUSH_ADMIN_TOKEN` is not set, so routes stay open if the env var is missing.
- `src/utils/pushNotifications.js` calls `/api/push/send-lineup` with only `Content-Type`; it does not send `Authorization` or `x-admin-token`.

Risk now:

- Without `PUSH_ADMIN_TOKEN`, the spam route risk remains.
- With `PUSH_ADMIN_TOKEN`, normal app saves can stop sending lineup pushes unless the client is changed or the push is triggered server-side.

Recommended next action:

- Make privileged push routes fail closed in production if `PUSH_ADMIN_TOKEN` is missing.
- Do not expose the admin token to the browser. Instead, move lineup writes and push triggering into one trusted server route, or trigger pushes from a Supabase function/webhook.
- Add rate limiting for all push routes.

### C3. Public access to `push_subscriptions`

Status: Fixed in schema, pending confirmation that the SQL has been applied to Supabase.

Current evidence:

- `supabase-schema.sql` enables RLS on `push_subscriptions`.
- The schema explicitly drops known public push subscription policies.
- No replacement public policies are created.
- Subscription writes/reads use service-role API routes.

Remaining risk:

- The repository is fixed, but production is only fixed after the updated SQL is applied in the Supabase project.

Recommended next action:

- Apply the schema in Supabase.
- Verify with the anon key that direct `select`, `insert`, and `update` on `push_subscriptions` are rejected.

### H1. Duplicate `lineup_notifications` rows and mismatched notification type

Status: Partially fixed, but still inconsistent.

Current evidence:

- The DB trigger inserts canonical rows with `type = 'lineup_created'`.
- `api/push/send-lineup.js` computes `payloadType` as `lineup_created` or `lineup_updated` and passes `notificationType` to `createPushPayload`.
- `api/_push.js` `createPushPayload()` does not accept or include `notificationType` in the JSON payload.
- `createLineupNotificationRecords()` therefore falls back from `type: 'lineup'` to `recordType = 'lineup_created'`.
- The unique index still only covers `type = 'lineup_created'`.

Risk now:

- Insert duplicates are reduced because API-side records now map to `lineup_created`.
- Update notifications can be stored as `lineup_created`, so notification history is semantically wrong.
- The app still has two writers for the same notification table: the DB trigger and the API push path.

Recommended next action:

- Best option: remove the API-side `lineup_notifications` insert and let the DB trigger own canonical create records.
- If update records are needed, include `notificationType` in `createPushPayload()` output and add a unique strategy for `lineup_updated`.
- Avoid two independent writers with different event semantics.

### H2. Duplicate legacy API endpoints

Status: Fixed in working tree.

Current evidence:

- Current `api/` contains only `_push.js`, `lineup-notifications/`, and `push/`.
- `api/push-subscriptions.js` and `api/send-lineup-push.js` are deleted in the working tree.
- `rg` finds no live frontend references to those legacy endpoints.

Recommended next action:

- Keep the deletions.
- Make sure Vercel removes old deployed serverless functions on the next deployment.

### H3. Cross-channel notification de-duplication

Status: Attempted, but still fragile.

Current evidence:

- `useLineupNotifications` now tries a secondary key based on `lineupId:eventType`.
- Realtime notifications use types like `lineup_created` and `lineup_updated`.
- Foreground push notifications still use payload `type: 'lineup'`, because `notificationType` is not preserved by `createPushPayload()`.
- That means Realtime may key as `lineupId:created` while push keys as `lineupId:lineup`.
- `addNotification()` adds the secondary key to `notifiedNotificationIdsRef`, but `updateNotifications()` later rebuilds that ref from notification IDs only, dropping the secondary keys.

Risk now:

- Duplicates are less likely in some timing windows, but the original duplicate Realtime-plus-push problem can still happen.

Recommended next action:

- Normalize event type into the notification object for both push and Realtime.
- Persist or recompute secondary de-dupe keys from stored notifications instead of keeping them only in the transient ref.
- Use a stable key such as `lineupId + normalizedEventType`, independent of timestamps.

### M1. `read()` persisted fallback data into localStorage

Status: Fixed.

Current evidence:

- `src/utils/storage.js` `read()` now parses and returns fallback data without writing it back to localStorage.

Recommended next action:

- No immediate action, aside from tests to lock this behavior.

### M2. Offline by-id lookups skipped live cache

Status: Fixed for `getSongById()` and `getLineupById()`.

Current evidence:

- Offline `getSongById()` checks explicit offline storage, then live song cache, then local fallback.
- Offline `getLineupById()` checks explicit offline storage, then live lineup cache, then local fallback.

Remaining note:

- Offline list loading in `getLineups()` still returns explicit offline lineups or an empty list when Supabase is configured. The review item was specifically about by-id detail lookups, which are fixed.

Recommended next action:

- Decide whether list views should also use live cache when offline.

### M3. `withTimeout()` does not cancel Supabase requests

Status: Open.

Current evidence:

- `withTimeout()` still uses `Promise.race()` and clears only the timeout.
- It does not create or pass an `AbortController` signal.

Risk:

- Slow Supabase requests can continue in the background after the app has already handled a timeout.

Recommended next action:

- Add abortable request support where Supabase query builders support `abortSignal()`, or document this as accepted technical debt for the small app scale.

### M4. `consumeLocalLineupCreation()` only suppressed one event

Status: Fixed.

Current evidence:

- `consumeLocalLineupCreation()` now keeps the local-created marker for the full TTL window instead of removing it on first match.

Recommended next action:

- Add a small test around duplicate INSERT/UPDATE self-notification suppression.

### M5. No automated tests or CI

Status: Open.

Current evidence:

- `package.json` has `dev`, `build`, `lint`, and `preview` scripts only.
- There is no `.github/` workflow directory.
- No test runner is configured.

Risk:

- The app has complex PWA, offline, Realtime, and notification behavior with no regression safety net.

Recommended next action:

- Add Vitest.
- Start with tests for pure functions: notification ID/type normalization, local-created suppression, storage case conversion, chord transposition, and lyrics monitor normalization.
- Add CI for `npm run lint` plus tests.

## Low / Polish Status

### L1. Verbose logging of sensitive push metadata

Status: Partially fixed, still open.

Current evidence:

- `api/_push.js` `logPushServer()` is now gated in production.
- `api/push/subscribe.js` still has an unconditional `console.log()` for subscription metadata.
- `src/utils/pushNotifications.js` still has an unconditional `console.info()` logging the resubscribe payload, including the full endpoint and user agent metadata. It masks `p256dh` and `auth`, but the endpoint is still sensitive.

Recommended next action:

- Gate client and server subscription logs behind development checks.
- Avoid logging full endpoints in normal production paths.

### L2. Unusual dependency major versions

Status: Still needs confirmation.

Current evidence:

- `package.json` uses `vite ^8.0.10`, `@vitejs/plugin-react ^6.0.1`, and `vite-plugin-pwa ^1.3.0`.
- `npm run lint` executes, so dependencies are installed locally.
- A production build was not run during this report because it would mutate `public/version.json`.

Recommended next action:

- Run a clean build in a controlled branch.
- Confirm Workbox imports resolve and the generated service worker is valid.

### L3. Redundant Realtime subscriptions to `lineups`

Status: Open.

Current evidence:

- `useLineupNotifications` subscribes to `public.lineups`.
- `useLineups()` also subscribes to `public.lineups` through `useRealtimeItems()`.

Recommended next action:

- Keep as accepted overhead, or centralize lineups Realtime events into one subscription that updates both list state and notification state.

### L4. `App.jsx` service worker message listener re-bound on notification changes

Status: Fixed.

Current evidence:

- `App.jsx` stores `lineupNotifications` in `lineupNotificationsRef`.
- The service worker message effect no longer depends directly on `lineupNotifications`.

Recommended next action:

- No immediate action.

### L5. TOCTOU race on save

Status: Open.

Current evidence:

- `saveSong()` still performs `select('id')` followed by insert/update.
- `saveLineup()` still performs `select('id')` followed by insert/update.

Risk:

- Two concurrent editors can race between existence check and write.

Recommended next action:

- Use server-side writes with `upsert` or transactional logic once the C1 write-model decision is made.

### L6. `getRequestBody()` swallows malformed JSON

Status: Open.

Current evidence:

- `getRequestBody()` logs a warning and returns `{}` when JSON parsing fails.
- Callers then usually produce generic missing-field errors instead of a clear invalid JSON response.

Recommended next action:

- Return a structured parse result or throw a 400-level error that handlers can report as `Invalid JSON`.

## Additional Current Issues Found While Verifying Status

### A1. Lint fails after partial fixes

Severity: Medium

Details:

- `cleanupOutdatedCaches()` was removed from behavior but left in the import list in `src/sw.js`.
- ESLint reports `Icon` in `EmptyState.jsx` as unused even though it is rendered as a JSX component. This is likely a lint parser/rule edge case caused by destructured aliasing in function params.
- `ShareAppQrModal.jsx` exports a constant alongside a component, producing a Fast Refresh warning.

Recommended next action:

- Remove the unused Workbox import.
- Refactor `EmptyState` to assign the icon inside the function body, or adjust lint config if desired.
- Move the share URL helper/constant out of the component file or keep the warning as accepted.

### A2. Schema comments describe server-side CRUD routes that do not exist

Severity: High

Details:

- `supabase-schema.sql` comments say writes go through Vercel API routes using `SUPABASE_SERVICE_ROLE_KEY`.
- Current `api/` routes only cover push and notification-read behavior.

Recommended next action:

- Either create the missing service-role CRUD routes or revise the schema/write policy strategy.

## Suggested Priority Order

1. Decide and implement the Supabase write model for songs and lineups.
2. Make privileged push sends truly protected without breaking legitimate lineup saves.
3. Fix notification payload/type handling so created and updated notifications are stored and de-duped correctly.
4. Fix current lint errors.
5. Apply and verify the `push_subscriptions` RLS schema in Supabase.
6. Add focused tests and CI.
7. Clean up remaining medium/low polish items.

## Verification Performed

Command run:

```bash
npm run lint
```

Result: failed with 2 errors and 1 warning.

Build: not run, to avoid mutating `public/version.json` through the existing `prebuild` script.
