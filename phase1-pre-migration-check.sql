-- ============================================================
-- CCFBC Line Up Manager — Phase 1 Pre-Migration Check
-- Generated: 2026-05-25
--
-- PURPOSE: Run this in the Supabase SQL Editor BEFORE applying
-- phase1-migration.sql. Paste the full output back so a safe,
-- idempotent migration can be generated that matches the actual
-- live schema state.
--
-- SAFE TO RUN: All SELECT only — no writes, no schema changes.
-- ============================================================


-- ============================================================
-- 1. ALL TABLES IN PUBLIC SCHEMA
-- Expected: songs, lineups, push_subscriptions,
--           lineup_notifications, push_delivery_logs
-- Unknown: churches, church_members, native_push_tokens
--          (may or may not already exist)
-- ============================================================
SELECT '1_ALL_TABLES' AS section, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;


-- ============================================================
-- 2. COLUMN INVENTORY FOR PHASE 1 TABLES
-- Looking for: church_id columns, exact column names/types,
-- nullable/not-null state, and defaults.
-- ============================================================

-- 2a. CHURCHES (does it exist? what columns?)
SELECT '2a_churches_cols' AS section,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'churches'
ORDER BY ordinal_position;

-- 2b. CHURCH_MEMBERS (does it exist? what columns?)
SELECT '2b_church_members_cols' AS section,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'church_members'
ORDER BY ordinal_position;

-- 2c. SONGS — check for church_id column
SELECT '2c_songs_cols' AS section,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'songs'
ORDER BY ordinal_position;

-- 2d. LINEUPS — check for church_id column
SELECT '2d_lineups_cols' AS section,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lineups'
ORDER BY ordinal_position;

-- 2e. PUSH_SUBSCRIPTIONS — check for church_id column
SELECT '2e_push_subscriptions_cols' AS section,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'push_subscriptions'
ORDER BY ordinal_position;

-- 2f. LINEUP_NOTIFICATIONS — check for church_id column
SELECT '2f_lineup_notifications_cols' AS section,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lineup_notifications'
ORDER BY ordinal_position;

-- 2g. NATIVE_PUSH_TOKENS — full column inventory
--     (live DB may differ from migration: fcm_token vs token,
--      UNIQUE(fcm_token) vs UNIQUE(user_id, platform))
SELECT '2g_native_push_tokens_cols' AS section,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'native_push_tokens'
ORDER BY ordinal_position;


-- ============================================================
-- 3. ROW COUNTS (to know if backfill is needed)
-- ============================================================
SELECT '3_row_counts' AS section, 'songs'               AS table_name, COUNT(*) AS total_rows, COUNT(church_id) AS rows_with_church_id FROM public.songs
UNION ALL
SELECT '3_row_counts', 'lineups',               COUNT(*), COUNT(church_id) FROM public.lineups
UNION ALL
SELECT '3_row_counts', 'push_subscriptions',    COUNT(*), COUNT(church_id) FROM public.push_subscriptions
UNION ALL
SELECT '3_row_counts', 'lineup_notifications',  COUNT(*), COUNT(church_id) FROM public.lineup_notifications;

-- Note: the above will error if church_id doesn't exist yet on a table.
-- If it errors, that confirms the column is missing and a backfill IS needed.
-- In that case the error message itself is useful information.


-- ============================================================
-- 4. ALL RLS POLICIES ON PHASE 1 TABLES
-- ============================================================
SELECT '4_rls_policies' AS section,
       tablename,
       policyname,
       cmd,
       roles,
       qual,
       with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
      'songs', 'lineups', 'push_subscriptions',
      'lineup_notifications', 'churches',
      'church_members', 'native_push_tokens'
  )
ORDER BY tablename, policyname;


-- ============================================================
-- 5. RLS ENABLED STATE PER TABLE
-- ============================================================
SELECT '5_rls_enabled' AS section,
       relname AS table_name,
       relrowsecurity AS rls_enabled,
       relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
  AND relname IN (
      'songs', 'lineups', 'push_subscriptions',
      'lineup_notifications', 'churches',
      'church_members', 'native_push_tokens'
  )
ORDER BY relname;


-- ============================================================
-- 6. EXISTING FUNCTIONS (my_church_id, is_church_admin)
-- ============================================================
SELECT '6_functions' AS section,
       routine_name,
       routine_type,
       security_type,
       data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('my_church_id', 'is_church_admin')
ORDER BY routine_name;


-- ============================================================
-- 7. UNIQUE CONSTRAINTS ON PHASE 1 TABLES
-- Checks: UNIQUE(church_id, user_id) on church_members,
--         UNIQUE(fcm_token) vs UNIQUE(user_id, platform) on native_push_tokens,
--         UNIQUE(slug) and UNIQUE(invite_code) on churches
-- ============================================================
SELECT '7_unique_constraints' AS section,
       tc.table_name,
       tc.constraint_name,
       tc.constraint_type,
       string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
  AND tc.table_name IN (
      'churches', 'church_members', 'native_push_tokens',
      'songs', 'lineups', 'push_subscriptions'
  )
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;


-- ============================================================
-- 8. CHECK CONSTRAINTS ON PHASE 1 TABLES
-- Checks: role IN ('admin','member') on church_members,
--         platform IN (...) on native_push_tokens
-- ============================================================
SELECT '8_check_constraints' AS section,
       tc.table_name,
       tc.constraint_name,
       cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.table_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
      'churches', 'church_members', 'native_push_tokens'
  )
ORDER BY tc.table_name, tc.constraint_name;


-- ============================================================
-- 9. EXISTING TRIGGERS ON PHASE 1 TABLES
-- Checks: update_churches_updated_at (migration creates this
--         WITHOUT DROP TRIGGER IF EXISTS — will error if it exists)
-- ============================================================
SELECT '9_triggers' AS section,
       trigger_name,
       event_object_table AS table_name,
       event_manipulation AS event,
       action_timing AS timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
      'churches', 'church_members', 'native_push_tokens',
      'songs', 'lineups'
  )
ORDER BY event_object_table, trigger_name;


-- ============================================================
-- 10. FOREIGN KEY CONSTRAINTS REFERENCING churches
-- Checks: does songs.church_id FK already exist?
--         Same for lineups, push_subscriptions, lineup_notifications.
-- ============================================================
SELECT '10_foreign_keys' AS section,
       tc.table_name,
       kcu.column_name,
       tc.constraint_name,
       ccu.table_name AS foreign_table,
       ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (
      ccu.table_name = 'churches'
      OR tc.table_name IN ('churches', 'church_members', 'native_push_tokens')
  )
ORDER BY tc.table_name, kcu.column_name;


-- ============================================================
-- END OF CHECK SCRIPT
-- Paste ALL output back (every section) so the safe migration
-- can be tailored to the actual live state.
-- ============================================================
