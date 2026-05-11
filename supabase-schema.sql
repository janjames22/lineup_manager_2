-- Supabase Schema for Worship Chords App
-- This schema reflects the actual data model used in the React application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- SONGS TABLE
-- ============================================
CREATE TABLE songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    artist TEXT DEFAULT '',
    original_key TEXT DEFAULT 'C',
    selected_key TEXT DEFAULT 'C',
    tempo TEXT DEFAULT '',
    category TEXT DEFAULT 'Worship',
    language TEXT DEFAULT '',
    youtube_link TEXT DEFAULT '',
    chord_chart TEXT DEFAULT '',
    lyrics_monitor JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LINEUPS TABLE
-- ============================================
CREATE TABLE lineups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    service_time TEXT DEFAULT '9:00 AM',
    worship_leader TEXT DEFAULT '',
    songs JSONB DEFAULT '[]'::jsonb,
    musicians JSONB DEFAULT '{}'::jsonb,
    general_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PUSH SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SONGS POLICIES
-- ============================================
-- Allow public read access
CREATE POLICY "Allow public read on songs" ON songs
    FOR SELECT USING (true);

-- Allow public insert
CREATE POLICY "Allow public insert on songs" ON songs
    FOR INSERT WITH CHECK (true);

-- Allow public update
CREATE POLICY "Allow public update on songs" ON songs
    FOR UPDATE USING (true);

-- Allow public delete
CREATE POLICY "Allow public delete on songs" ON songs
    FOR DELETE USING (true);

-- ============================================
-- LINEUPS POLICIES
-- ============================================
-- Allow public read access
CREATE POLICY "Allow public read on lineups" ON lineups
    FOR SELECT USING (true);

-- Allow public insert
CREATE POLICY "Allow public insert on lineups" ON lineups
    FOR INSERT WITH CHECK (true);

-- Allow public update
CREATE POLICY "Allow public update on lineups" ON lineups
    FOR UPDATE USING (true);

-- Allow public delete
CREATE POLICY "Allow public delete on lineups" ON lineups
    FOR DELETE USING (true);

-- ============================================
-- PUSH SUBSCRIPTION POLICIES
-- ============================================
DROP POLICY IF EXISTS "Allow public insert on push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow public update on push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow public push subscription insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow public push subscription update" ON public.push_subscriptions;

CREATE POLICY "Allow public push subscription insert"
ON public.push_subscriptions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public push subscription update"
ON public.push_subscriptions
    FOR UPDATE USING (true) WITH CHECK (true);

-- No public SELECT policy is added. Server/admin logic should send notifications
-- with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_category ON songs(category);
CREATE INDEX idx_lineups_date ON lineups(date);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- ============================================
-- FUNCTION TO AUTO-UPDATE updated_at TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for songs table
CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for lineups table
CREATE TRIGGER update_lineups_updated_at BEFORE UPDATE ON lineups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
