# Deployment Guide — CCFBC Line Up Manager

Stack: React 19 + Vite 8 · Tailwind CSS 4 · Vercel (frontend + serverless API) · Supabase (Postgres + Realtime)

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 20 LTS |
| npm | 10+ |
| Vercel CLI (optional) | `npm i -g vercel` |
| Supabase project | Any plan (free tier works) |

---

## 1. Supabase — first-time setup

### 1a. Apply the database schema

Open the **Supabase SQL Editor** for your project and paste the full contents of `supabase-schema.sql`. Run it. This is safe to re-run — all statements use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS`, and `DROP TRIGGER IF EXISTS`.

What the schema creates:

- `songs` table with RLS (public SELECT, writes restricted to service role)
- `lineups` table with RLS (public SELECT, writes restricted to service role)
- `push_subscriptions` table with RLS (no public policies — all access via service role API routes)
- `lineup_notifications` table (no public policies)
- `push_delivery_logs` table (no public policies)
- Realtime publication on `songs` and `lineups`
- DB trigger: `trigger_create_lineup_notification_on_insert` — records a `lineup_created` notification on every new lineup row

### 1b. Enable Realtime

In the Supabase dashboard go to **Database → Replication** and confirm `songs` and `lineups` are included in the `supabase_realtime` publication. The schema migration handles this automatically, but verify it is on.

### 1c. Collect your Supabase credentials

| Value | Where to find it |
|---|---|
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key (keep secret) |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → `anon` / `public` key |

---

## 2. VAPID keys — one-time generation

Web Push requires a VAPID key pair. Generate them once and store them permanently.

```bash
npx web-push generate-vapid-keys
```

Output:
```
Public Key:  BAxxx...
Private Key: xxx...
```

| Env var | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | The public key from above |
| `VAPID_PRIVATE_KEY` | The private key from above (keep secret) |
| `VAPID_SUBJECT` | `mailto:your-admin@yourdomain.com` |

> **Important:** Once devices subscribe using a VAPID key pair, the keys cannot be rotated without all existing subscriptions becoming invalid. Store them safely.

---

## 3. Push admin token

The `/api/push/send-lineup` and `/api/push/send-test` (broadcast mode) routes are protected by an admin token. Generate a random secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set this as:

| Env var | Value |
|---|---|
| `PUSH_ADMIN_TOKEN` | The hex string above |

The app passes this token as `Authorization: Bearer <token>` when sending lineup push notifications. Callers without the token receive `401 Unauthorized`.

---

## 4. Vercel — environment variables

In the Vercel dashboard go to your project → **Settings → Environment Variables** and add every variable below. Set each one for **Production**, **Preview**, and **Development** unless noted otherwise.

### Frontend variables (exposed to the browser)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

### Server-only variables (API routes only — never commit to source)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL (used by API routes) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — full DB access, bypasses RLS |
| `VAPID_PUBLIC_KEY` | VAPID public key (served by `/api/push/public-key`) |
| `VAPID_PRIVATE_KEY` | VAPID private key — signs push payloads |
| `VAPID_SUBJECT` | `mailto:admin@yourdomain.com` |
| `PUSH_ADMIN_TOKEN` | Random secret protecting broadcast push routes |

> **Never** put `SUPABASE_SERVICE_ROLE_KEY` or `VAPID_PRIVATE_KEY` in any `VITE_` prefixed variable. Vite embeds `VITE_` vars into the client bundle.

---

## 5. Deploy to Vercel

### Option A — Git-connected deploy (recommended)

1. Push your code to a GitHub/GitLab/Bitbucket repository.
2. In the Vercel dashboard click **Add New → Project** and import the repository.
3. Leave **Framework Preset** as **Vite**.
4. Vercel auto-detects `vercel.json` — no additional build settings needed.
5. Click **Deploy**.

Every subsequent push to `main` triggers a production deploy automatically.

### Option B — Vercel CLI

```bash
# First deploy
vercel

# Subsequent production deploys
vercel --prod
```

### Build output

The build runs two steps before deploying:

1. `node scripts/write-version-json.mjs` — writes `public/version.json` with the build timestamp and commit SHA. This powers the in-app update detection.
2. `vite build` — compiles the React app and service worker into `dist/`.

Vercel serves `dist/` as the static frontend and the `api/` directory as Node.js serverless functions.

---

## 6. Post-deploy verification checklist

Run these checks after every first deploy and after significant infrastructure changes.

- [ ] **App loads** — open the production URL, confirm the dashboard renders.
- [ ] **Supabase connection** — add a test song; confirm it persists and appears on other devices.
- [ ] **Realtime** — open the app on two browser tabs; add or edit a lineup on one and confirm the other updates within a few seconds.
- [ ] **PWA install** — on Android Chrome, tap the browser menu → "Add to Home Screen". On iOS Safari (17+), tap Share → "Add to Home Screen". Confirm the app opens standalone.
- [ ] **Service worker** — open DevTools → Application → Service Workers; confirm the SW is registered and active.
- [ ] **Push notifications** — go to Settings in the app → enable push → tap "Send test". Confirm the notification arrives on the device.
- [ ] **Lineup push** — save a new lineup; confirm subscribed devices receive the push.
- [ ] **Offline mode** — disable network in DevTools; confirm previously loaded lineups and songs are still accessible.
- [ ] **Print view** — open a lineup → Print; confirm the layout is clean and left-border accents are suppressed.

---

## 7. Updating an existing deployment

### Schema changes

If `supabase-schema.sql` was changed, re-run the file in the Supabase SQL Editor before deploying the new code. The schema is additive (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and safe to re-apply.

### Code-only changes

Push to `main` (or run `vercel --prod`). The service worker version is stamped at build time using the commit SHA via `VERCEL_GIT_COMMIT_SHA`. Users already on the app will see the in-app update prompt within the next polling interval (5 minutes) or on their next visit.

### Forcing a cache bust

If a deployment gets stuck behind a cached service worker:

1. In the Vercel dashboard bump any env var value slightly (add a trailing space, then remove it) to force a redeploy.
2. Or increment `version` in `package.json` and redeploy — this changes the version stamp in `public/version.json` and triggers the update flow for all active clients.

---

## 8. Environment variable reference (complete)

| Variable | Side | Required | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Client | Yes | Supabase project URL for the browser SDK |
| `VITE_SUPABASE_ANON_KEY` | Client | Yes | Supabase anon key for the browser SDK |
| `SUPABASE_URL` | Server | Yes | Supabase project URL for API routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes | Service role key for API routes (bypasses RLS) |
| `VAPID_PUBLIC_KEY` | Server | Yes | Served to the browser via `/api/push/public-key` |
| `VAPID_PRIVATE_KEY` | Server | Yes | Signs outgoing Web Push payloads |
| `VAPID_SUBJECT` | Server | Yes | `mailto:` contact URI for push service providers |
| `PUSH_ADMIN_TOKEN` | Server | Yes | Bearer token for broadcast push routes |
| `VITE_VAPID_PUBLIC_KEY` | Client | No | Legacy fallback; use `VAPID_PUBLIC_KEY` instead |

---

## 9. Local development

```bash
# Install dependencies
npm install

# Create a local env file (not committed)
cp .env.example .env.local   # or create manually

# .env.local minimum for Supabase-backed dev:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# VAPID_PUBLIC_KEY=your-vapid-public-key
# VAPID_PRIVATE_KEY=your-vapid-private-key
# VAPID_SUBJECT=mailto:you@example.com
# PUSH_ADMIN_TOKEN=your-local-test-token

# Start dev server (Vite + Vercel Functions via Vercel CLI)
vercel dev

# Or for frontend-only without API routes:
npm run dev
```

> `npm run dev` starts Vite only. Push notification API routes (`/api/*`) will 404 in this mode. Use `vercel dev` to run both the frontend and serverless functions locally.

### Local test and lint

```bash
npm test       # Vitest unit tests (pure logic functions)
npm run lint   # ESLint
npm run build  # Full production build — run this before any deploy
```

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Songs/lineups don't save | Missing `SUPABASE_SERVICE_ROLE_KEY` on server, or RLS write policies were added | Check Vercel env vars; re-apply `supabase-schema.sql` |
| Push notifications not delivered | Missing VAPID keys or `PUSH_ADMIN_TOKEN` | Verify all server env vars in Vercel; check Vercel Function logs |
| `401 Unauthorized` on `/api/push/send-lineup` | `PUSH_ADMIN_TOKEN` not set or doesn't match | Set the token in Vercel env vars and in any internal callers |
| Realtime not updating | `songs`/`lineups` not in `supabase_realtime` publication | Re-run the Realtime section of `supabase-schema.sql` |
| SW stuck on old version | Browser cached the old service worker | Force-reload with Shift+Reload, or wait for the 5-minute polling cycle |
| `push_subscriptions` table errors | Schema not applied or partially applied | Re-run full `supabase-schema.sql` in SQL Editor |
| "Lineup notifications are not connected" toast | Supabase Realtime quota exceeded or `VITE_SUPABASE_*` keys wrong | Check Supabase Realtime usage; verify anon key |
