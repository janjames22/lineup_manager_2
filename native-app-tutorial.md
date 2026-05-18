# Step-by-Step: PWA → Native App with Multi-Church Support

Written for the **CCFBC Line Up Manager** codebase (React 19 + Vite + Supabase + Vercel).

---

## What we are building

| Feature | Current state | Target state |
|---|---|---|
| Platform | Browser PWA | iOS + Android native apps (+ web still works) |
| Push notifications | Web Push (VAPID) | Native APNs/FCM via Capacitor |
| Offline | localStorage + IDB | localStorage + IDB (unchanged, works in Capacitor WebView) |
| Data isolation | All churches share one table | Each church has its own `church_id` partition, RLS-enforced |
| Member access | No auth at all | Supabase Auth — sign up → join a church → see only that church's data |

**Technology choice — Capacitor (not React Native):**
Capacitor wraps your existing React/Vite web build inside a native iOS/Android shell. You keep 100 % of your existing code and add native plugins on top. This is the lowest-effort path for an existing PWA.

---

## Phase 0 — Prerequisites

Install once on your machine:

```bash
# Node 18+
node -v

# Xcode (Mac only — needed for iOS)
xcode-select --install

# Android Studio + Android SDK
# Download from: https://developer.android.com/studio
# Install SDK Platform 34, Build Tools, Emulator

# Capacitor CLI
npm install -g @capacitor/cli

# iOS tooling
sudo gem install cocoapods
```

Apple Developer Account: $99/year — required to run on a real iPhone.
Google Play account: $25 one-time — required to publish on Android.

---

## Phase 1 — Multi-tenancy (database + auth)

This phase is the foundation. Everything else builds on it.

### 1-1. Enable Supabase Auth

In the Supabase dashboard → **Authentication → Settings**:
- Enable Email signups
- Set "Site URL" to your Vercel domain (e.g. `https://your-app.vercel.app`)
- Add `http://localhost:5173` under "Additional Redirect URLs" for dev

### 1-2. New database tables

Run this in **Supabase SQL Editor**:

```sql
-- ============================================
-- CHURCHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.churches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,           -- short identifier e.g. "ccfbc-main"
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHURCH MEMBERS TABLE
-- ============================================
-- Roles: 'admin' (leader who manages songs/lineups) or 'member' (read-only)
CREATE TABLE IF NOT EXISTS public.church_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    display_name TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (church_id, user_id)
);

-- ============================================
-- ADD church_id TO EXISTING TABLES
-- ============================================
ALTER TABLE public.songs
    ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE;

ALTER TABLE public.lineups
    ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE;

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL;

ALTER TABLE public.lineup_notifications
    ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_songs_church_id ON public.songs(church_id);
CREATE INDEX IF NOT EXISTS idx_lineups_church_id ON public.lineups(church_id);
CREATE INDEX IF NOT EXISTS idx_church_members_user_id ON public.church_members(user_id);
CREATE INDEX IF NOT EXISTS idx_church_members_church_id ON public.church_members(church_id);

-- updated_at triggers
CREATE TRIGGER update_churches_updated_at BEFORE UPDATE ON public.churches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 1-3. Helper function for RLS

```sql
-- Returns the church_id for the calling user (first membership found)
-- Use in RLS policies so every row filter is one function call.
CREATE OR REPLACE FUNCTION public.my_church_id()
RETURNS UUID
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT church_id
    FROM public.church_members
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

-- Returns true if caller is an admin of a given church
CREATE OR REPLACE FUNCTION public.is_church_admin(cid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.church_members
        WHERE church_id = cid
          AND user_id = auth.uid()
          AND role = 'admin'
    );
$$;
```

### 1-4. Rewrite the RLS policies

Replace the wide-open `USING (true)` policies with church-scoped ones:

```sql
-- ---- SONGS ----
DROP POLICY IF EXISTS "Allow public read on songs" ON public.songs;
DROP POLICY IF EXISTS "Allow public insert on songs" ON public.songs;
DROP POLICY IF EXISTS "Allow public update on songs" ON public.songs;
DROP POLICY IF EXISTS "Allow public delete on songs" ON public.songs;

-- Members can read their church's songs
CREATE POLICY "songs_select" ON public.songs
    FOR SELECT TO authenticated
    USING (church_id = public.my_church_id());

-- Only admins can write songs
CREATE POLICY "songs_insert" ON public.songs
    FOR INSERT TO authenticated
    WITH CHECK (church_id = public.my_church_id() AND public.is_church_admin(church_id));

CREATE POLICY "songs_update" ON public.songs
    FOR UPDATE TO authenticated
    USING (church_id = public.my_church_id() AND public.is_church_admin(church_id));

CREATE POLICY "songs_delete" ON public.songs
    FOR DELETE TO authenticated
    USING (church_id = public.my_church_id() AND public.is_church_admin(church_id));

-- ---- LINEUPS ----
DROP POLICY IF EXISTS "Allow public read on lineups" ON public.lineups;
DROP POLICY IF EXISTS "Allow public insert on lineups" ON public.lineups;
DROP POLICY IF EXISTS "Allow public update on lineups" ON public.lineups;
DROP POLICY IF EXISTS "Allow public delete on lineups" ON public.lineups;

CREATE POLICY "lineups_select" ON public.lineups
    FOR SELECT TO authenticated
    USING (church_id = public.my_church_id());

CREATE POLICY "lineups_insert" ON public.lineups
    FOR INSERT TO authenticated
    WITH CHECK (church_id = public.my_church_id() AND public.is_church_admin(church_id));

CREATE POLICY "lineups_update" ON public.lineups
    FOR UPDATE TO authenticated
    USING (church_id = public.my_church_id() AND public.is_church_admin(church_id));

CREATE POLICY "lineups_delete" ON public.lineups
    FOR DELETE TO authenticated
    USING (church_id = public.my_church_id() AND public.is_church_admin(church_id));

-- ---- CHURCHES ----
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "churches_select" ON public.churches
    FOR SELECT TO authenticated
    USING (id = public.my_church_id());

CREATE POLICY "churches_insert" ON public.churches
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

-- ---- CHURCH MEMBERS ----
ALTER TABLE public.church_members ENABLE ROW LEVEL SECURITY;

-- Members can see who is in their own church
CREATE POLICY "members_select" ON public.church_members
    FOR SELECT TO authenticated
    USING (church_id = public.my_church_id());

-- Service role only for insert/delete (handled through API routes)
```

### 1-5. Invite-code join API route

Create `api/church/join.js`:

```js
import { getSupabaseAdmin } from '../_push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { invite_code, display_name } = req.body || {};
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });

  // Validate the caller is authenticated
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const supabase = getSupabaseAdmin();

  // Verify token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  // Find church by invite code
  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('invite_code', invite_code.trim().toLowerCase())
    .single();
  if (!church) return res.status(404).json({ error: 'Invalid invite code' });

  // Add member (ignore duplicate)
  await supabase.from('church_members').upsert(
    { church_id: church.id, user_id: user.id, role: 'member', display_name },
    { onConflict: 'church_id,user_id', ignoreDuplicates: true }
  );

  res.status(200).json({ church_id: church.id });
}
```

---

## Phase 2 — Add auth to the React app

### 2-1. Install auth helpers

```bash
cd ccfbc_lineup_manager_code
npm install @supabase/auth-ui-react @supabase/auth-ui-shared
```

### 2-2. Update `src/utils/supabase.js`

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isSupabaseConfigured = () => !!supabase;
```

### 2-3. Create `src/pages/AuthPage.jsx`

```jsx
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../utils/supabase';

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6">
        <h1 className="text-white text-xl font-bold mb-6 text-center">Line Up Manager</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="dark"
          providers={[]}
          redirectTo={window.location.origin}
        />
      </div>
    </div>
  );
}
```

### 2-4. Create `src/pages/JoinChurchPage.jsx`

```jsx
import { useState } from 'react';
import { supabase } from '../utils/supabase';

export default function JoinChurchPage({ session, onJoined }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/church/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ invite_code: code, display_name: name }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    onJoined(data.church_id);
  }

  async function handleCreateChurch(e) {
    e.preventDefault();
    setError('');
    // Inline creation — you can move this to its own API route
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { data: church, error: err } = await supabase
      .from('churches')
      .insert({ name, slug, created_by: session.user.id })
      .select()
      .single();
    if (err) { setError(err.message); return; }
    // Add self as admin
    await supabase.from('church_members').insert({
      church_id: church.id,
      user_id: session.user.id,
      role: 'admin',
      display_name: name,
    });
    onJoined(church.id);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 space-y-6">
        <h2 className="text-white text-lg font-bold">Join or create a church</h2>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <form onSubmit={handleJoin} className="space-y-3">
          <input
            className="w-full rounded-lg bg-slate-700 text-white p-2"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg bg-slate-700 text-white p-2"
            placeholder="Invite code (ask your admin)"
            value={code}
            onChange={e => setCode(e.target.value)}
          />
          <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg">
            Join with invite code
          </button>
        </form>
        <div className="text-center text-slate-400 text-sm">— or —</div>
        <form onSubmit={handleCreateChurch} className="space-y-3">
          <input
            className="w-full rounded-lg bg-slate-700 text-white p-2"
            placeholder="Church name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-lg">
            Create new church (I'm an admin)
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 2-5. Gate `App.jsx` with auth

Near the top of `App.jsx`, add this auth gate before the existing route tree:

```jsx
import { useEffect, useState } from 'react';
import AuthPage from './pages/AuthPage';
import JoinChurchPage from './pages/JoinChurchPage';
import { supabase } from './utils/supabase';

// Inside App():
const [session, setSession] = useState(null);
const [churchId, setChurchId] = useState(null);
const [authLoading, setAuthLoading] = useState(true);

useEffect(() => {
  supabase?.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    if (session) loadChurch(session.user.id);
    else setAuthLoading(false);
  });
  const { data: { subscription } } = supabase?.auth.onAuthStateChange((_e, session) => {
    setSession(session);
    if (session) loadChurch(session.user.id);
    else { setChurchId(null); setAuthLoading(false); }
  }) ?? { data: { subscription: { unsubscribe: () => {} } } };
  return () => subscription.unsubscribe();
}, []);

async function loadChurch(userId) {
  const { data } = await supabase
    .from('church_members')
    .select('church_id')
    .eq('user_id', userId)
    .limit(1)
    .single();
  setChurchId(data?.church_id ?? null);
  setAuthLoading(false);
}

if (authLoading) return <LoadingScreen />;
if (!session) return <AuthPage />;
if (!churchId) return (
  <JoinChurchPage
    session={session}
    onJoined={(id) => setChurchId(id)}
  />
);
```

### 2-6. Pass `church_id` through storage calls

In `src/utils/storage.js`, every Supabase insert/update needs `church_id`.
The simplest pattern: export a `getChurchId()` helper that reads from a
module-level variable set at login, then include it in every write:

```js
// src/utils/storage.js  — add near top
let _activeChurchId = null;
export function setActiveChurch(id) { _activeChurchId = id; }
export function getActiveChurchId() { return _activeChurchId; }
```

Then in `saveSong`/`saveLineup`:

```js
const church_id = getActiveChurchId();
// add church_id to the insert/update payload
await supabase.from('songs').insert({ ...songData, church_id });
```

Call `setActiveChurch(churchId)` in `App.jsx` after `loadChurch` resolves.

---

## Phase 3 — Capacitor setup (PWA → native shell)

Capacitor wraps your existing Vite build in a native iOS/Android WebView.
Your existing PWA, service worker, and push subscription code continue working
inside the WebView for the web push fallback path. Native push is layered on
top in Phase 4.

### 3-1. Install Capacitor

```bash
cd ccfbc_lineup_manager_code
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
```

### 3-2. Init Capacitor

```bash
npx cap init "Line Up Manager" "com.ccfbc.lineupmanager" --web-dir dist
```

This creates `capacitor.config.ts` in the project root.

### 3-3. Update `capacitor.config.ts`

```ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ccfbc.lineupmanager',
  appName: 'Line Up Manager',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
  },
};

export default config;
```

### 3-4. Add iOS and Android platforms

```bash
npm run build          # always build before adding platforms
npx cap add ios
npx cap add android
```

### 3-5. Daily dev workflow

```bash
npm run build && npx cap sync   # after every code change
npx cap open ios                # opens Xcode
npx cap open android            # opens Android Studio
```

---

## Phase 4 — Native push notifications

### 4-1. Install the plugin

```bash
npm install @capacitor/push-notifications
npx cap sync
```

### 4-2. iOS — APNs setup

1. In Xcode → **Signing & Capabilities** → `+ Capability` → **Push Notifications**.
2. In **Apple Developer Portal** → Certificates, Identifiers & Profiles → Keys
   → create an **APNs key** (`.p8` file). Keep the Key ID and Team ID.
3. In Firebase Console (you need a Firebase project for Capacitor push):
   - Add an iOS app with your bundle ID (`com.ccfbc.lineupmanager`).
   - Upload the `.p8` APNs key under **Project Settings → Cloud Messaging → APNs Auth Key**.
   - Download `GoogleService-Info.plist` → drop it into the `ios/App/App/` folder in Xcode.

### 4-3. Android — FCM setup

1. In Firebase Console:
   - Add an Android app with package name `com.ccfbc.lineupmanager`.
   - Download `google-services.json` → place it at `android/app/google-services.json`.
2. In `android/build.gradle` (project level):
   ```groovy
   classpath 'com.google.gms:google-services:4.4.1'
   ```
3. In `android/app/build.gradle` (app level), at the bottom:
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```

### 4-4. React — request permission and register token

Create `src/utils/nativePush.js`:

```js
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export function isNative() {
  return Capacitor.isNativePlatform();
}

export async function registerNativePush(churchId, session) {
  if (!isNative()) return;   // fall back to existing web-push flow

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  // Listen for the FCM/APNs token
  PushNotifications.addListener('registration', async (token) => {
    // Send the device token to your server so it can push to this device
    await fetch('/api/push/subscribe-native', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        token: token.value,
        platform: Capacitor.getPlatform(),  // 'ios' | 'android'
        churchId,
      }),
    });
  });

  // Foreground notification handler
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[NativePush] received in foreground:', notification);
    // You can dispatch a custom event here to show your in-app banner
    window.dispatchEvent(new CustomEvent('LINEUP_NOTIFICATION', {
      detail: notification.data,
    }));
  });

  // Tap handler
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification.data?.url;
    if (url) window.location.hash = url;
  });
}
```

### 4-5. Create `api/push/subscribe-native.js`

```js
import { getSupabaseAdmin } from '../_push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const { token: deviceToken, platform, churchId } = req.body || {};
  if (!deviceToken || !platform) return res.status(400).json({ error: 'token and platform required' });

  await supabase.from('native_push_tokens').upsert(
    {
      user_id: user.id,
      church_id: churchId,
      token: deviceToken,
      platform,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,platform' }
  );

  res.status(200).json({ ok: true });
}
```

Add the `native_push_tokens` table in Supabase:

```sql
CREATE TABLE IF NOT EXISTS public.native_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, platform)
);

ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;
-- No public policies — service role only
```

### 4-6. Send native push from the server

Install the Firebase Admin SDK on the server:

```bash
npm install firebase-admin
```

In `api/_push.js` (or a new `api/_nativePush.js`), add a helper:

```js
import admin from 'firebase-admin';

let _firebaseApp = null;

function getFirebaseApp() {
  if (_firebaseApp) return _firebaseApp;
  _firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  return _firebaseApp;
}

export async function sendNativePush(supabase, churchId, payload) {
  const app = getFirebaseApp();
  const messaging = admin.messaging(app);

  // Load active tokens for this church
  const { data: tokens } = await supabase
    .from('native_push_tokens')
    .select('token, platform')
    .eq('church_id', churchId)
    .eq('is_active', true);

  if (!tokens?.length) return;

  const messages = tokens.map(({ token }) => ({
    token,
    notification: { title: payload.title, body: payload.body },
    data: { url: payload.url || '/', lineupId: String(payload.lineupId || '') },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    android: { priority: 'high', notification: { sound: 'default' } },
  }));

  await messaging.sendEach(messages);
}
```

Add `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
to your Vercel environment variables.

---

## Phase 5 — Offline access (verified working in Capacitor)

Your existing service worker + IndexedDB strategy already works in the
Capacitor WebView. No code changes needed for basic offline.
Two additions improve the native experience:

### 5-1. Network status detection

```bash
npm install @capacitor/network
npx cap sync
```

Update `src/hooks/useOffline.js`:

```js
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

export function useOffline() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      Network.getStatus().then(s => setOffline(!s.connected));
      const handle = Network.addListener('networkStatusChange', s => setOffline(!s.connected));
      return () => { handle.then(h => h.remove()); };
    } else {
      // existing browser handlers
      const set = () => setOffline(!navigator.onLine);
      window.addEventListener('online', set);
      window.addEventListener('offline', set);
      return () => { window.removeEventListener('online', set); window.removeEventListener('offline', set); };
    }
  }, []);

  return offline;
}
```

### 5-2. Keep IndexedDB offline cache — no change needed

Your existing `src/lib/offlineStorage.js` uses the `idb` package, which works
in both browser and Capacitor WebView. Songs/lineups saved offline remain
accessible natively without any migration.

---

## Phase 6 — Member-facing access control (summary)

| Role | Can do |
|---|---|
| **Admin** | Create church, invite members, add/edit/delete songs, create/edit/delete lineups, send push |
| **Member** | View songs, view lineups, read-only, receive push |

Admins share their church's **Invite Code** (shown in a Settings page).
Members enter the code to join. The `church_members.role` column + the
`is_church_admin()` RLS function enforce this at the database level — even if
the frontend is bypassed.

To show the invite code to admins, add a Settings page that fetches:

```js
const { data: church } = await supabase
  .from('churches')
  .select('name, invite_code')
  .eq('id', churchId)
  .single();
```

---

## Phase 7 — App icons and splash screen

```bash
npm install @capacitor/splash-screen
npx cap sync
```

Use **Capacitor Assets** to auto-generate all icon sizes from one 1024×1024 PNG:

```bash
npm install -g @capacitor/assets
npx capacitor-assets generate --assetPath public/icon-512.png
```

This writes all required icon sizes into `ios/App/App/Assets.xcassets/`
and `android/app/src/main/res/`.

---

## Phase 8 — Build and deploy

### iOS

```bash
npm run build && npx cap sync
npx cap open ios
# In Xcode: Product → Archive → Distribute → App Store Connect
```

### Android

```bash
npm run build && npx cap sync
npx cap open android
# In Android Studio: Build → Generate Signed Bundle/APK → Android App Bundle
# Upload the .aab to Google Play Console
```

### Vercel (web)

No changes needed. The `vercel.json` already handles the SPA routing and
cache headers. Deploy as normal:

```bash
git push origin main
```

---

## Environment variables checklist

Add all of these to **Vercel → Settings → Environment Variables**
(and to a local `.env` for development):

```env
# Supabase
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Server-only (never expose to frontend)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Web Push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@yourchurch.com

# Native Push (Firebase)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Push route protection (see review.md C2)
PUSH_ADMIN_TOKEN=a-long-random-secret
```

---

## Summary — migration order

```
Phase 1  →  Multi-tenant DB schema (SQL) + RLS rewrite
Phase 2  →  Supabase Auth + church join flow in React
Phase 3  →  Capacitor init + iOS/Android platform add
Phase 4  →  Native push tokens + Firebase Admin SDK
Phase 5  →  Network plugin for native offline detection
Phase 6  →  (Logic already in DB) — expose Settings/InviteCode UI
Phase 7  →  Icons + splash screen
Phase 8  →  Submit to App Store + Play Store
```

Phases 1 and 2 can be done entirely in the browser without touching Xcode or
Android Studio. Only Phase 3 onwards requires native tooling.
