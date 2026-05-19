# Bug Report — Create New Church RLS Failure

**Date:** 2026-05-19  
**Severity:** Critical  
**Status:** Open — reviewed only, no code changed  
**User-visible error:** `new row violates row-level security policy for table "churches"`  
**Affected screen:** `Join or create a church`  

---

## Summary

Clicking **Create new church (I'm an admin)** fails because the create-church flow inserts directly into Supabase tables from the browser:

1. Insert a row into `public.churches`.
2. Insert the current user as an `admin` row in `public.church_members`.
3. Call `onJoined(church.id)` and enter the app.

That flow conflicts with the intended multi-tenant RLS design. Creating the first church is a bootstrapping operation: the user does not yet have a `church_members` row, but the app is trying to create both the church and the membership under normal client-side RLS. The invite-code join flow already uses a trusted server route with the service-role key; the create-church flow does not.

The screenshot error is thrown on the first insert into `public.churches`, before the admin membership insert runs.

---

## Reproduction

1. Sign in or sign up so `App.jsx` has a Supabase `session`.
2. Because the user has no church membership, the app renders `JoinChurchPage`.
3. Enter a display name, for example `JAN JAMES`.
4. Enter a church name, for example `CCFBC`.
5. Click **Create new church (I'm an admin)**.
6. The page shows:

```text
new row violates row-level security policy for table "churches"
```

---

## Primary Failing Code Path

File: `src/pages/JoinChurchPage.jsx`

```jsx
const { data: church, error: err } = await supabase
  .from('churches')
  .insert({ name: churchName, slug, created_by: session.user.id })
  .select()
  .single();
if (err) { setError(err.message); return; }
await supabase.from('church_members').insert({
  church_id: church.id,
  user_id: session.user.id,
  role: 'admin',
  display_name: name,
});
onJoined(church.id);
```

Relevant lines:

- `JoinChurchPage.jsx:26-35` inserts into `churches` directly from the browser.
- `JoinChurchPage.jsx:36-41` inserts the admin membership directly from the browser.
- `JoinChurchPage.jsx:36-41` does not check the `church_members` insert result.
- `JoinChurchPage.jsx:42` calls `onJoined()` even if the membership insert silently fails.

---

## Intended Policy From Tutorial

File: `native-app-tutorial.md`

The tutorial says:

```sql
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "churches_select" ON public.churches
    FOR SELECT TO authenticated
    USING (id = public.my_church_id());

CREATE POLICY "churches_insert" ON public.churches
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

ALTER TABLE public.church_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select" ON public.church_members
    FOR SELECT TO authenticated
    USING (church_id = public.my_church_id());

-- Service role only for insert/delete (handled through API routes)
```

Important implication: the tutorial explicitly expects `church_members` inserts to be handled by API routes using the service role. The join flow follows that pattern. The create flow does not.

---

## Current Repository/Database Mismatch

There is also schema drift:

- `native-app-tutorial.md` contains the planned `churches`, `church_members`, `my_church_id()`, `is_church_admin()`, and church-scoped RLS SQL.
- `status.md` says Phase 1 SQL was pending.
- `supabase-schema.sql` in the repo still does not define `churches`, `church_members`, `my_church_id()`, `is_church_admin()`, or church-scoped policies.
- The runtime Supabase database clearly has a `churches` table with RLS enabled, because the browser receives the RLS error for that table.

That means the production/dev database has at least part of Phase 1 applied, while the repo schema file is not the full source of truth for the deployed database.

---

## Most Likely Root Cause

The failing insert means Postgres rejected this browser request under RLS. For `INSERT`, Supabase/Postgres requires at least one matching `FOR INSERT` policy whose `WITH CHECK` expression evaluates to true for the new row.

Most likely causes:

1. `public.churches` has RLS enabled but no active `FOR INSERT TO authenticated` policy.
2. The `churches_insert` policy exists, but the browser request is not reaching PostgREST as an authenticated user, so `auth.uid()` is null.
3. The policy exists, but `created_by = auth.uid()` evaluates false because the JWT user does not match `session.user.id`.
4. Only part of the tutorial SQL was applied, leaving `churches` protected but the bootstrap path incomplete.

Given the current code, even if cause 1 is fixed and the `churches` insert succeeds, the next operation is still risky because `church_members` insert is expected to be service-role-only.

---

## Secondary Bugs Found

### 1. Admin membership insert error is ignored

`JoinChurchPage.jsx` awaits the insert but never reads `{ error }`.

Impact:

- The church row could be created successfully.
- The admin membership row could fail due to RLS.
- The app would still call `onJoined(church.id)`.
- On refresh, `loadChurch()` may not find a membership row, sending the user back to the join/create screen.

### 2. `onJoined()` does not update active storage church

File: `src/App.jsx`

```jsx
<JoinChurchPage
  session={session}
  onJoined={(id) => setChurchId(id)}
/>
```

`loadChurch()` calls both:

```js
setChurchId(data?.church_id ?? null);
setActiveChurch(data?.church_id ?? null);
```

But `onJoined()` only calls `setChurchId(id)`. It does not call `setActiveChurch(id)`.

Impact:

- After a successful join/create without a page refresh, `storage.js` may still have no active church id.
- `saveSong()` and `saveLineup()` only attach `church_id` when `getActiveChurchId()` returns a value.
- New songs/lineups created immediately after joining could be saved without `church_id`.

### 3. Create flow does not use the existing trusted API pattern

`handleJoin()` uses `/api/church/join` with:

```js
Authorization: `Bearer ${session.access_token}`
```

The server route verifies the JWT and writes `church_members` using `getSupabaseAdmin()`, which uses the service role.

`handleCreateChurch()` bypasses that pattern and writes directly through the browser Supabase client.

Impact:

- The two onboarding paths have different security models.
- Join is server-side and RLS-safe.
- Create is client-side and RLS-fragile.

### 4. Slug generation can create invalid or duplicate slugs

Current slug logic:

```js
const slug = churchName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
```

Risks:

- `!!!` produces an empty slug.
- `CCFBC` and `ccfbc` both produce `ccfbc`.
- `CCFBC Main` and `CCFBC   Main` both produce `ccfbc-main`.
- Duplicate slug failures are not handled with a friendly message.

This is not the current screenshot error, but it is the next likely user-facing failure after RLS is fixed.

### 5. `loadChurch()` ignores select errors

File: `src/App.jsx`

```js
const { data } = await supabase
  .from('church_members')
  .select('church_id')
  .eq('user_id', userId)
  .limit(1)
  .maybeSingle();
```

The `error` result is ignored.

Impact:

- If `church_members` RLS is wrong, the user only sees the join/create screen again.
- The app loses the distinction between "user has no church" and "database denied or failed the membership lookup."

---

## Why This Is a Critical Bug

The app now gates the entire main experience behind `churchId`:

```jsx
if (!session) return <AuthPage />;
if (!churchId) return <JoinChurchPage session={session} onJoined={(id) => setChurchId(id)} />;
```

If a new user cannot create the first church, they cannot reach the main app. If membership creation fails silently, they may enter the app temporarily but become stuck again after refresh.

This blocks onboarding for first-time churches and admins.

---

## Recommended Fix Direction

Do not fix this by making `churches` and `church_members` wide-open from the browser. That would undermine the multi-tenant security model.

Preferred approach:

1. Add a trusted server endpoint, for example `POST /api/church/create`.
2. The endpoint should require `Authorization: Bearer <user access token>`.
3. The endpoint should verify the token using `supabase.auth.getUser(token)`.
4. Using the service-role client, create the `churches` row.
5. Using the service-role client, create the matching `church_members` row with `role = 'admin'`.
6. Return `{ church_id }`.
7. Update `JoinChurchPage` to call the new endpoint instead of direct table inserts.
8. Update `App.jsx` `onJoined` to set both `churchId` and the active storage church id.

Alternative approach:

- Create a `SECURITY DEFINER` Postgres function such as `create_church_with_admin_membership(name, slug, display_name)` that atomically inserts both rows.
- Grant execute to `authenticated`.
- Keep direct table inserts blocked by RLS.

The server endpoint is easier to align with the existing `/api/church/join` route and avoids exposing any extra write surface to the browser.

---

## Database Checks To Run In Supabase

These checks should be run in Supabase SQL Editor to confirm the exact database state:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('churches', 'church_members', 'songs', 'lineups');
```

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('churches', 'church_members')
order by tablename, policyname;
```

Expected minimum:

- `churches` has RLS enabled.
- `churches` has a controlled insert path, either through a valid `FOR INSERT TO authenticated` policy or through a server/function bootstrap route.
- `church_members` should not allow arbitrary client inserts unless the policy is very carefully constrained.

---

## Validation Plan After Fix

After implementing a fix later, test these cases:

1. New signed-in user with no membership can create a church.
2. A `churches` row is created with `created_by` equal to the user id.
3. A `church_members` row is created with `role = 'admin'`.
4. `App.jsx` enters the main app immediately without requiring refresh.
5. `getActiveChurchId()` is set immediately after create/join.
6. A song created immediately after onboarding includes `church_id`.
7. A lineup created immediately after onboarding includes `church_id`.
8. Duplicate church slugs show a friendly error.
9. Unauthenticated requests to the create endpoint return 401.
10. A normal user cannot create admin membership rows for someone else's church.

---

## Files Involved

- `src/pages/JoinChurchPage.jsx`
- `src/App.jsx`
- `api/church/join.js`
- `src/utils/supabase.js`
- `src/utils/storage.js`
- `native-app-tutorial.md`
- `supabase-schema.sql`

---

## Work Performed For This Report

- Reviewed current create/join church UI flow.
- Reviewed auth session setup.
- Reviewed app gating by `churchId`.
- Reviewed existing trusted join API route.
- Reviewed tutorial RLS policy expectations.
- Reviewed current repo schema drift.
- Did not change application code.
- Did not run destructive commands.
