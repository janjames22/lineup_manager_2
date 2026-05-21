-- ============================================================
-- CCFBC Line Up Manager — Phase 1 Migration
-- Generated: 2026-05-21
-- Source: native-app-tutorial.md §1-2, §1-3, §1-4 + Phase 4 native_push_tokens
--
-- BEFORE RUNNING:
--   1. Complete the Supabase dashboard steps in Step 1-1 (listed below).
--   2. Paste this entire file into Supabase SQL Editor → Run.
--   3. Confirm no errors in the Results tab.
--
-- ASSUMPTIONS:
--   • The `update_updated_at_column()` trigger function already exists in your
--     Supabase DB (it is used by existing tables like songs/lineups).
--   • RLS is already enabled on `songs` and `lineups` (verified in review.md C1).
--   • The `songs`, `lineups`, `push_subscriptions`, and `lineup_notifications`
--     tables already exist.
-- ============================================================


-- ============================================================
-- STEP 1-1 — Manual Dashboard Actions (no SQL needed)
-- ============================================================
-- Do these in the Supabase dashboard BEFORE running this script:
--
--   1. Go to: Authentication → Settings (in your project dashboard)
--   2. Under "Email Auth": toggle ON "Enable Email Signups"
--   3. Under "Site URL": set to your Vercel domain
--        e.g. https://your-app.vercel.app
--   4. Under "Redirect URLs" → "Add URL":
--        Add: http://localhost:5173
--        (This allows local dev sign-ups to redirect correctly)
--   5. Save settings.
--
-- Once done, continue with the SQL below.


-- ============================================================
-- STEP 1-2 — New tables: churches, church_members
--            + church_id columns on existing tables
-- ============================================================

-- ------------------------------------------------------------
-- CHURCHES TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.churches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,           -- short identifier e.g. "ccfbc-main"
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- CHURCH MEMBERS TABLE
-- Roles: 'admin' (manages songs/lineups) or 'member' (read-only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.church_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    display_name TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (church_id, user_id)
);

-- ------------------------------------------------------------
-- ADD church_id TO EXISTING TABLES
-- Using IF NOT EXISTS so this is safe to re-run.
-- ------------------------------------------------------------
ALTER TABLE public.songs
    ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE;

ALTER TABLE public.lineups
    ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE;

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL;

ALTER TABLE public.lineup_notifications
    ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- INDEXES for performance
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_songs_church_id          ON public.songs(church_id);
CREATE INDEX IF NOT EXISTS idx_lineups_church_id         ON public.lineups(church_id);
CREATE INDEX IF NOT EXISTS idx_church_members_user_id    ON public.church_members(user_id);
CREATE INDEX IF NOT EXISTS idx_church_members_church_id  ON public.church_members(church_id);

-- ------------------------------------------------------------
-- updated_at trigger for churches
-- Assumes update_updated_at_column() already exists in the DB.
-- ------------------------------------------------------------
CREATE TRIGGER update_churches_updated_at
    BEFORE UPDATE ON public.churches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- STEP 1-3 — RLS helper functions
-- ============================================================

-- Returns the church_id for the calling user (first membership found).
-- Used in RLS policies so every row filter is one function call.
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

-- Returns true if the caller is an admin of the given church.
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


-- ============================================================
-- STEP 1-4 — Rewrite RLS policies (church-scoped)
-- ============================================================
-- NOTE: RLS is assumed to already be ENABLED on songs and lineups.
-- The DROP statements below remove the current wide-open policies.
-- Add any additional old policy names if your DB uses different names.

-- ------------------------------------------------------------
-- SONGS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read on songs"   ON public.songs;
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

-- ------------------------------------------------------------
-- LINEUPS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read on lineups"   ON public.lineups;
DROP POLICY IF EXISTS "Allow public insert on lineups" ON public.lineups;
DROP POLICY IF EXISTS "Allow public update on lineups" ON public.lineups;
DROP POLICY IF EXISTS "Allow public delete on lineups" ON public.lineups;

-- Members can read their church's lineups
CREATE POLICY "lineups_select" ON public.lineups
    FOR SELECT TO authenticated
    USING (church_id = public.my_church_id());

-- Only admins can write lineups
CREATE POLICY "lineups_insert" ON public.lineups
    FOR INSERT TO authenticated
    WITH CHECK (church_id = public.my_church_id() AND public.is_church_admin(church_id));

CREATE POLICY "lineups_update" ON public.lineups
    FOR UPDATE TO authenticated
    USING (church_id = public.my_church_id() AND public.is_church_admin(church_id));

CREATE POLICY "lineups_delete" ON public.lineups
    FOR DELETE TO authenticated
    USING (church_id = public.my_church_id() AND public.is_church_admin(church_id));

-- ------------------------------------------------------------
-- CHURCHES
-- RLS enforcement for the churches table itself.
-- Note: api/church/create.js uses the service role key, which
-- bypasses RLS entirely — the churches_insert policy below is
-- a safety net for any future client-side paths.
-- ------------------------------------------------------------
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only see their own church
CREATE POLICY "churches_select" ON public.churches
    FOR SELECT TO authenticated
    USING (id = public.my_church_id());

-- Insert allowed when created_by matches the caller
-- (service role bypasses this; API routes are safe)
CREATE POLICY "churches_insert" ON public.churches
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

-- ------------------------------------------------------------
-- CHURCH MEMBERS
-- Service role only for insert/delete (handled through API routes).
-- ------------------------------------------------------------
ALTER TABLE public.church_members ENABLE ROW LEVEL SECURITY;

-- Members can see who else is in their church
CREATE POLICY "members_select" ON public.church_members
    FOR SELECT TO authenticated
    USING (church_id = public.my_church_id());


-- ============================================================
-- PHASE 4 PREP — native_push_tokens table
-- (Included here so the table exists before Phase 4 code is written)
-- ============================================================
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
-- No client-facing policies — service role only (API routes handle all writes)


-- ============================================================
-- DONE — verify with these queries after running:
-- ============================================================
--
-- Check tables exist:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN ('churches', 'church_members', 'native_push_tokens');
--
-- Check church_id columns added:
--   SELECT column_name, table_name FROM information_schema.columns
--   WHERE column_name = 'church_id'
--   AND table_schema = 'public';
--
-- Check functions exist:
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public'
--   AND routine_name IN ('my_church_id', 'is_church_admin');
--
-- Check RLS policies:
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
-- ============================================================
