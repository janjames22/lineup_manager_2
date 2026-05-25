-- ============================================================
-- CCFBC Line Up Manager — Phase 1 Orphan Row Check
-- Generated: 2026-05-25
--
-- PURPOSE: Count rows where church_id IS NULL in the four tables
-- that received a church_id column. Any non-zero count in
-- "null_church_id" means those rows are orphaned: after the
-- church-scoped RLS policies go live, my_church_id() returns
-- your church UUID, but these rows have church_id = NULL so
-- they will never match — they silently disappear from every
-- query. A backfill is required BEFORE enabling RLS.
--
-- SAFE TO RUN: SELECT only.
-- ============================================================

SELECT
    'songs'                AS table_name,
    COUNT(*)               AS total_rows,
    COUNT(*) FILTER (WHERE church_id IS NULL) AS null_church_id,
    COUNT(*) FILTER (WHERE church_id IS NOT NULL) AS has_church_id
FROM public.songs

UNION ALL

SELECT
    'lineups',
    COUNT(*),
    COUNT(*) FILTER (WHERE church_id IS NULL),
    COUNT(*) FILTER (WHERE church_id IS NOT NULL)
FROM public.lineups

UNION ALL

SELECT
    'push_subscriptions',
    COUNT(*),
    COUNT(*) FILTER (WHERE church_id IS NULL),
    COUNT(*) FILTER (WHERE church_id IS NOT NULL)
FROM public.push_subscriptions

UNION ALL

SELECT
    'lineup_notifications',
    COUNT(*),
    COUNT(*) FILTER (WHERE church_id IS NULL),
    COUNT(*) FILTER (WHERE church_id IS NOT NULL)
FROM public.lineup_notifications;

-- ============================================================
-- Also: confirm the CCFBC church row exists in churches table
-- and grab its UUID (needed for the backfill if null_church_id > 0)
-- ============================================================
SELECT id, name, slug, invite_code, created_at
FROM public.churches
ORDER BY created_at;
