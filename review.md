# Code Review — CCFBC Line Up Manager

Reviewed: 2026-05-18
Scope: React 19 PWA (`src/`), Vercel serverless API routes (`api/`), Supabase
schema (`supabase-schema.sql`), service worker (`src/sw.js`), build config.

## Summary

The app is a local-first worship lineup/chord-chart PWA with Supabase as the
shared backend, Web Push notifications, and an offline cache. The notification
and PWA-update code is mature and defensive. The **biggest risks are in the
data-access layer**: the Supabase Row Level Security policies are fully open to
the public, and the push API routes are unauthenticated and abusable. There are
also several real bugs around duplicate notification records and dead/duplicated
code.

Findings are grouped by severity. Each has a location, the problem, the risk,
and a concrete fix.

---

## Critical

### C1. Supabase RLS allows the public to read, modify, and delete all data

**Location:** `supabase-schema.sql:465-497`

```sql
CREATE POLICY "Allow public read on songs"   ... USING (true);
CREATE POLICY "Allow public insert on songs" ... WITH CHECK (true);
CREATE POLICY "Allow public update on songs" ... USING (true);
CREATE POLICY "Allow public delete on songs" ... USING (true);
-- identical policies for `lineups`
```

**Problem:** The anon key is shipped in the client bundle (`VITE_SUPABASE_ANON_KEY`,
`src/utils/supabase.js:4`). With these `USING (true)` policies, *anyone* who
opens the site — or just extracts the anon key from the JS bundle — can
`DELETE` every song and every lineup, or overwrite them with arbitrary content,
directly against the REST endpoint. There is no authentication anywhere in the
app.

**Risk:** Total data loss / vandalism of the church's song library and
schedules. Irreversible without backups.

**Fix options (pick one):**

1. **Add auth.** Gate writes behind Supabase Auth and restrict
   `INSERT/UPDATE/DELETE` policies to `authenticated`, leaving `SELECT` public
   if the catalog is meant to be readable:
   ```sql
   CREATE POLICY "songs_write" ON songs FOR ALL
     TO authenticated USING (true) WITH CHECK (true);
   ```
2. **Keep it login-free but move writes server-side.** Drop the public
   write policies, and route all create/update/delete through Vercel API
   functions that use `SUPABASE_SERVICE_ROLE_KEY` (the pattern already used for
   `push_subscriptions`). The client keeps public `SELECT` only.
3. **Minimum stopgap:** enable Supabase Point-in-Time Recovery / scheduled
   backups so a wipe is recoverable, and remove the public `DELETE` policy at
   minimum.

### C2. Push API routes are unauthenticated and can spam every device

**Location:** `api/push/send-test.js`, `api/push/send-lineup.js`,
`api/send-lineup-push.js`

**Problem:** `POST /api/push/send-test` with an empty body calls
`sendPushPayload(supabase, payload, {})`, which loads **all active
subscriptions** and pushes to them (`api/push/send-test.js:30-31`,
`_push.js:968-971`). `POST /api/push/send-lineup` with any valid `lineupId`
does the same. None of these routes check an API key, a session, or an origin.

**Risk:** Anyone on the internet can blast a notification to every subscribed
phone, repeatedly — harassment / notification spam, and it burns the push
quota. `send-lineup` also lets an attacker enumerate which lineup IDs exist.

**Fix:**
- Require a shared secret on the privileged routes (`send-test`, `send-lineup`):
  read an `Authorization` header and compare against an env var
  (`PUSH_ADMIN_TOKEN`) before sending. The frontend, when it legitimately needs
  to notify after `saveLineup`, should call a route that derives recipients
  server-side and is itself protected, or trigger pushes from a Supabase DB
  webhook/Edge Function instead of an open HTTP endpoint.
- Add basic rate limiting (per-IP) on all `api/` routes.
- Restrict `send-test`'s "send to everyone" branch to authenticated/admin
  callers only; the device self-test should always pass `targetEndpoint`.

### C3. `push_subscriptions` table is publicly readable and writable

**Location:** `supabase-schema.sql:512-526`

```sql
CREATE POLICY "Allow public read push subscriptions"   ... USING (true);
CREATE POLICY "Allow public insert push subscriptions" ... WITH CHECK (true);
CREATE POLICY "Allow public update push subscriptions" ... USING (true);
```

**Problem:** All subscription handling already goes through service-role API
routes (`api/push/*` → `getSupabaseAdmin()`), and the schema even restricts the
`upsert_push_subscription` RPC to `service_role` only. But these blanket public
policies on the underlying table re-open everything the RPC was locked down to.
The public `SELECT` exposes every device's `endpoint`, `p256dh`, `auth`,
`user_agent`, `timezone`, `platform`, and `device_label` to anyone with the
anon key.

**Risk:** Privacy leak of device/PII metadata for the whole congregation, and
public `INSERT/UPDATE` lets an attacker poison the table (e.g. flip
`is_active`, inject junk rows that later get pushed to).

**Fix:** Drop all three public policies on `push_subscriptions`. RLS stays
enabled with **no** policies — the service-role key bypasses RLS, so the API
routes keep working and the public loses all direct access (the same pattern
already used intentionally for `lineup_notifications` and `push_delivery_logs`).

---

## High

### H1. Duplicate `lineup_notifications` rows from two writers with mismatched `type`

**Location:** `supabase-schema.sql:622-657` (DB trigger) vs.
`api/_push.js:759-812` (`createLineupNotificationRecords`)

**Problem:** Two independent code paths insert into `lineup_notifications`:

1. The DB trigger `create_lineup_notification_on_insert` inserts a row with
   `type = 'lineup_created'` on every `lineups` INSERT.
2. `createLineupNotificationRecords()` inserts a row with
   `type = notification.type || 'lineup'`. The push payload built by
   `createPushPayload` always sets `type: 'lineup'` (see
   `api/push/send-lineup.js:43` → `createPushPayload({ type: 'lineup', ... })`).

The unique partial index that is supposed to dedupe these only covers
`type = 'lineup_created'`:

```sql
CREATE UNIQUE INDEX ... idx_lineup_notifications_unique_lineup_created
ON public.lineup_notifications (type, lineup_id)
WHERE type = 'lineup_created' AND lineup_id IS NOT NULL;
```

So the API-path rows (`type = 'lineup'`) are **not** deduped. The existence
check in `createLineupNotificationRecords` also queries
`.eq('type', 'lineup')`, never matching the trigger's `'lineup_created'` row.

**Risk:** Every push send for the same lineup appends another
`type = 'lineup'` row. The table grows unbounded; any future UI or report built
on `lineup_notifications` will show duplicates.

**Fix:** Make the writers agree on `type`. Simplest: have
`createLineupNotificationRecords` normalize to `'lineup_created'` /
`'lineup_updated'` (it already receives event context upstream) and either
extend the unique index to cover `'lineup_updated'` too, or do a proper
`upsert(..., { onConflict: 'type,lineup_id' })`. Better: since the DB trigger
already creates the canonical record, **remove the API-side insert entirely**
and let the trigger be the single source of truth.

### H2. Two near-identical, divergent implementations of the same endpoints

**Location:** `api/push/subscribe.js` vs `api/push-subscriptions.js`;
`api/push/send-lineup.js` vs `api/send-lineup-push.js`

**Problem:** `api/push-subscriptions.js` is a legacy copy of
`api/push/subscribe.js`, and `api/send-lineup-push.js` duplicates
`api/push/send-lineup.js` — but they have **drifted**: the root
`send-lineup-push.js` hardcodes `title: 'New lineup added'` even for updates,
while `api/push/send-lineup.js:44` correctly switches between
"New lineup added" / "Lineup updated". The frontend only calls the `api/push/*`
versions (`pushNotifications.js:8` → `API_BASE = '/api/push'`).

**Risk:** Dead routes remain publicly callable with stale/incorrect behavior,
widening the attack surface (see C2) and confusing future maintainers about
which file is authoritative.

**Fix:** Delete `api/push-subscriptions.js` and `api/send-lineup-push.js` after
confirming nothing references them. Keep only the `api/push/*` routes.

### H3. Cross-channel notification de-duplication is fragile

**Location:** `src/hooks/useLineupNotifications.js` (Supabase Realtime path) +
`src/App.jsx:257-262` (foreground push path); ID construction in
`src/utils/lineupNotifications.js:114-136` and `api/push/send-lineup.js:49`

**Problem:** A newly created lineup can reach the open app through **two**
channels at once: the Supabase Realtime `postgres_changes` subscription and a
foreground `LINEUP_NOTIFICATION` message from the service worker. De-duplication
relies entirely on the two paths computing an **identical** notification `id`:

- Realtime: `lineup-created-${lineupId}-${safeTimestamp}` where `safeTimestamp`
  is derived from `updated_at`/`created_at` of the Realtime row.
- Push: `notificationId` from the payload —
  `lineup-${actionSlug}-${lineupId}-${safeTimestamp}` built server-side from
  `loadLineup()`'s `updated_at`.

If the two timestamps differ by even a millisecond (or one path has
`updated_at` and the other only `created_at`), the IDs diverge and the user
sees the same lineup notified twice.

**Risk:** Intermittent duplicate banners/toasts/sounds. Hard to reproduce, easy
to ship.

**Fix:** Make the de-dupe key independent of timestamp — e.g. key the
`notifiedNotificationIdsRef` set and the stored list by `lineupId` + a coarse
event type (`created`/`updated`), not by a timestamped string ID. Then a second
arrival for the same `(lineupId, eventType)` is dropped regardless of which
channel delivered it first.

---

## Medium

### M1. `read()` silently persists default data into localStorage

**Location:** `src/utils/storage.js:266-276`

```js
function read(key, fallback) {
  const stored = localStorage.getItem(key);
  const value = safeParse(stored, fallback);
  if (!stored) localStorage.setItem(key, JSON.stringify(value)); // side effect
  return value;
}
```

**Problem:** A pure-looking read writes back the fallback. The first call to
`getLocalSongs()` permanently seeds `worshipSongs` with `[sampleSong]`, even on
a Supabase-backed deployment where local storage is only a fallback. The sample
song then lingers in local fallback results forever.

**Fix:** Remove the write side effect from `read()`. Seed defaults explicitly
and intentionally where a default genuinely needs to persist.

### M2. Offline cache and "live cache" are not consulted together

**Location:** `src/utils/storage.js:475-513` (`getSongById`), `622-711`
(`getLineupById`)

**Problem:** When offline, `getSongById`/`getLineupById` only check the
*explicit* offline downloads (`getOfflineSongById`) and, if Supabase is
configured, return `null` otherwise — they never fall back to
`worshipSongsLiveCache` / `worshipLineupsLiveCache`, which `getSongs()` populates
on every successful online load. A song the user viewed online minutes ago is
unavailable offline unless they explicitly "downloaded" it.

**Risk:** Confusing offline UX (item visible in a list view that was list-cached
but 404s when opened).

**Fix:** In the offline branches, after the explicit-offline lookup misses, also
check the live cache (`getLiveCachedSongs()/getLiveCachedLineups()`), or
document that only explicitly downloaded items work offline by design.

### M3. `withTimeout` does not cancel the underlying request

**Location:** `src/utils/storage.js:248-259`

**Problem:** `Promise.race` rejects after 10s, but the Supabase query keeps
running in the background. Under a slow network, multiple stacked queries can
pile up.

**Risk:** Wasted bandwidth/connections; minor. Acceptable for a small app but
worth noting.

**Fix:** Pass an `AbortController` signal to the Supabase client call and abort
it in the `finally` block.

### M4. `consumeLocalLineupCreation` only suppresses one Realtime event

**Location:** `src/utils/lineupNotifications.js:57-75`, used in
`useLineupNotifications.js:168`

**Problem:** When this tab saves a lineup, `markLineupCreatedLocally` records it
so the echoed Realtime event is ignored. But `consumeLocalLineupCreation`
*removes* the marker on first match. If Supabase emits both an `INSERT` and a
follow-up `UPDATE` for the same save (or the event is re-delivered), the second
event is no longer suppressed and the saver gets notified about their own
lineup.

**Fix:** Either keep the marker for the full TTL window instead of consuming it
on first match, or also exclude self-notifications by `lineupId` for a short
grace period.

### M5. No automated tests or CI

**Location:** repo-wide (`package.json` has only `dev`/`build`/`lint`/`preview`).

**Problem:** The notification/PWA-update logic is intricate and full of edge
cases (exactly the kind of code that regresses silently). There is no test
runner and no CI workflow.

**Fix:** Add a minimal Vitest setup covering the pure logic that's easy to get
wrong: `normalizeLyricsMonitor`, `toSnakeCase*/toCamelCase*`, notification ID
construction, `consumeLocalLineupCreation`. Wire `lint` + tests into a CI check.

---

## Low / Polish

- **L1. Verbose logging in production paths.** `api/push/subscribe.js:41`,
  `_push.js:logPushServer`, and `pushNotifications.js:369`
  (`console.info('... RESUBSCRIBE_THIS_DEVICE payload ...')`) log full
  subscription payloads (endpoints, metadata) unconditionally — `logPushServer`
  is not gated by `IS_PRODUCTION` the way `debugPushServer` is. Trim these or
  gate them; endpoints are sensitive.

- **L2. Unusual dependency major versions.** `package.json` pins
  `vite ^8.0.10`, `@vitejs/plugin-react ^6.0.1`, `vite-plugin-pwa ^1.3.0`.
  These are far ahead of the versions known at review time — confirm `npm
  install` actually resolves them and the `injectManifest` build still works,
  and that `workbox-*` packages imported in `src/sw.js` are resolvable (they are
  not listed as direct dependencies; they currently come transitively via
  `vite-plugin-pwa`).

- **L3. Redundant Realtime subscriptions to `lineups`.** `useLineupNotifications`
  and `useRealtimeItems` (via `useLineups`) each open a separate channel on the
  same table. Functional, but two websocket channels where one would do.

- **L4. `App.jsx` SW message listener re-binds on every notification change.**
  The effect at `App.jsx:254-292` depends on `lineupNotifications`, so the
  `message` listener is removed/re-added whenever the notification list changes.
  Use a ref for the current notifications to keep the listener stable.

- **L5. TOCTOU on save.** `saveSong`/`saveLineup` do a `select` existence check
  then `insert`/`update` (`storage.js:527-563`, `724-763`). Two concurrent
  editors can race. Low impact for this app's traffic; an `upsert` on `id`
  would remove the window.

- **L6. `getRequestBody` swallows malformed JSON.** `_push.js:44-54` returns
  `{}` on a JSON parse failure, so a malformed body becomes a generic
  "Missing ..." 400 rather than a clear "Invalid JSON" message. Minor DX issue.

---

## What looks good

- The PWA update lifecycle (`App.jsx`) is careful: version-json polling,
  `waitForWaitingWorker`, `controllerchange` handling with a fallback timer, and
  a reload marker. This is hard to get right and is handled well.
- `useRealtimeItems` correctly degrades from Realtime to a polling fallback,
  pauses polling when the tab is hidden/offline, and — because `useSongs`/
  `useLineups` pass module-level stable `loadItems`/`mapRow`/`sortItems` — does
  not suffer from re-subscription churn.
- Service-role keys and `VAPID_PRIVATE_KEY` are kept server-only; the README is
  explicit about it.
- `lineup_notifications` and `push_delivery_logs` correctly use RLS-enabled,
  no-policy tables so only the service role can touch them — this is exactly the
  pattern that C3 recommends applying to `push_subscriptions` as well.
- Endpoint/key validation in `validatePushSubscription` plus the SQL
  `CHECK` constraints provide good defense in depth for subscription data.

---

## Suggested priority order

1. **C1** — lock down `songs`/`lineups` RLS (and/or enable backups) — data loss.
2. **C3** — drop public `push_subscriptions` policies — quick, low-risk change.
3. **C2** — authenticate/rate-limit the push API routes.
4. **H2** — delete the duplicate legacy API routes.
5. **H1** — fix the duplicate `lineup_notifications` writer/`type` mismatch.
6. **H3** — make notification de-dup timestamp-independent.
7. Medium/Low items as cleanup.
