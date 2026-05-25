-- ============================================================
-- CCFBC Line Up Manager — Phase 1 Backfill (Option B: Delete orphans)
-- Generated: 2026-05-25
--
-- WHAT THIS DOES:
--   Deletes the 5 lineup_notifications rows that have NULL church_id.
--   These rows are:
--     • 2 × song_created with NULL lineup_id (song events, no lineup link)
--     • 2 × lineup_created whose lineup was later deleted
--     • 1 × lineup_created linked to CCFBC lineup 24e3b810
--   All 5 are already invisible through church-scoped RLS queries
--   because church_id IS NULL never matches my_church_id().
--
-- WHY DELETE IS BETTER THAN BACKFILL HERE:
--   • Backfilling makes stale notifications reappear in the bell
--     panel — worse UX than leaving them invisible.
--   • These rows predate multi-tenancy; they carry no useful
--     state (is_read is already meaningless for orphaned records).
--   • lineup_notifications is notification history, not source of
--     truth — deleting old entries has no effect on songs or lineups.
--
-- CONSEQUENCE: Permanent. These 5 rows will not be recoverable
--   without a DB backup restore. Given they are already invisible
--   to all app users, the practical impact is zero.
--
-- SAFE TO RUN: WHERE church_id IS NULL means re-running after a
--   successful run deletes 0 rows (no double-delete risk).
-- ============================================================

-- Preview what will be deleted (run this first, verify before proceeding)
SELECT id, type, lineup_id, title, created_at
FROM public.lineup_notifications
WHERE church_id IS NULL
ORDER BY created_at;

-- ============================================================
-- STOP — confirm the rows above match the 5 expected orphans.
-- Then run the DELETE block below.
-- ============================================================

-- Delete all orphan notifications
DELETE FROM public.lineup_notifications
WHERE church_id IS NULL;

-- Verify: 0 NULL rows remain, and total count decreased by 5
SELECT
    COUNT(*)                                   AS total_rows,
    COUNT(*) FILTER (WHERE church_id IS NULL)  AS null_remaining
FROM public.lineup_notifications;

-- Expected: null_remaining = 0, total_rows = 0 (since all 5 rows were orphans)
