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
    device_label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS device_label TEXT,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================
-- LINEUP NOTIFICATIONS TABLE
-- ============================================
-- Server-managed notification history/read-state. This app is public and
-- currently keeps the member-facing notification list device-local, so no
-- public SELECT/INSERT/UPDATE policy is added for this table.
CREATE TABLE IF NOT EXISTS public.lineup_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL DEFAULT 'lineup_created',
    lineup_id UUID,
    title TEXT NOT NULL,
    body TEXT,
    url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    subscription_endpoint TEXT,
    device_id TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lineup_notifications
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'lineup_created',
    ADD COLUMN IF NOT EXISTS lineup_id UUID,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS body TEXT,
    ADD COLUMN IF NOT EXISTS url TEXT,
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS subscription_endpoint TEXT,
    ADD COLUMN IF NOT EXISTS device_id TEXT,
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lineup_notifications'
          AND column_name = 'lineup_id'
          AND data_type <> 'uuid'
    ) THEN
        ALTER TABLE public.lineup_notifications
            ALTER COLUMN lineup_id TYPE UUID USING (
                CASE
                    WHEN lineup_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                    THEN lineup_id::text::uuid
                    ELSE NULL
                END
            );
    END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineup_notifications ENABLE ROW LEVEL SECURITY;

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
    FOR INSERT WITH CHECK (
        endpoint IS NOT NULL
        AND p256dh IS NOT NULL
        AND auth IS NOT NULL
    );

CREATE POLICY "Allow public push subscription update"
ON public.push_subscriptions
    FOR UPDATE USING (true) WITH CHECK (
        endpoint IS NOT NULL
        AND p256dh IS NOT NULL
        AND auth IS NOT NULL
    );

-- No public SELECT policy is added. Server/admin logic should send notifications
-- with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.

-- ============================================
-- LINEUP NOTIFICATION POLICIES
-- ============================================
DROP POLICY IF EXISTS "Allow public read on lineup notifications" ON public.lineup_notifications;
DROP POLICY IF EXISTS "Allow public insert on lineup notifications" ON public.lineup_notifications;
DROP POLICY IF EXISTS "Allow public update on lineup notifications" ON public.lineup_notifications;

-- No public policies are created for lineup_notifications. Vercel API routes
-- using SUPABASE_SERVICE_ROLE_KEY write notification records and may mark them
-- read later without exposing the service role key to frontend code.

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_category ON songs(category);
CREATE INDEX idx_lineups_date ON lineups(date);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON public.push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_lineup_notifications_lineup_id ON public.lineup_notifications(lineup_id);
CREATE INDEX IF NOT EXISTS idx_lineup_notifications_subscription_endpoint ON public.lineup_notifications(subscription_endpoint);
CREATE INDEX IF NOT EXISTS idx_lineup_notifications_user_id ON public.lineup_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_lineup_notifications_is_read ON public.lineup_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_lineup_notifications_created_at ON public.lineup_notifications(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lineup_notifications_unique_lineup_created
ON public.lineup_notifications (type, lineup_id)
WHERE type = 'lineup_created' AND lineup_id IS NOT NULL;

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

DROP TRIGGER IF EXISTS update_lineup_notifications_updated_at ON public.lineup_notifications;
CREATE TRIGGER update_lineup_notifications_updated_at BEFORE UPDATE ON public.lineup_notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- LINEUP INSERT NOTIFICATION TRIGGER
-- ============================================
-- Creates one server-side notification record whenever a new lineup is posted.
-- This preserves the public/no-login app behavior while documenting the
-- Supabase-side fix that feeds public.lineup_notifications.
CREATE OR REPLACE FUNCTION public.create_lineup_notification_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.lineup_notifications (
        type,
        lineup_id,
        title,
        body,
        url,
        is_read
    )
    VALUES (
        'lineup_created',
        NEW.id,
        'New lineup added',
        'A new worship lineup has been posted.',
        '/lineups/' || NEW.id::text,
        FALSE
    )
    ON CONFLICT (type, lineup_id)
    WHERE type = 'lineup_created' AND lineup_id IS NOT NULL
    DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_lineup_notification_on_insert ON public.lineups;
CREATE TRIGGER trigger_create_lineup_notification_on_insert
    AFTER INSERT ON public.lineups
    FOR EACH ROW
    EXECUTE FUNCTION public.create_lineup_notification_on_insert();
