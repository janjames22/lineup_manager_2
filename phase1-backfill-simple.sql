-- ============================================================
-- CCFBC Line Up Manager — Phase 1 Backfill (Option A: Simple assign)
-- Generated: 2026-05-25
--
-- WHAT THIS DOES:
--   Assigns all 5 orphan lineup_notifications rows to CCFBC.
--   1 row will match via its lineup (row 4, lineup 24e3b810).
--   4 rows have no usable lineup link (deleted lineups or song
--   events with NULL lineup_id) and get CCFBC by default.
--   Net effect: identical to a single blanket UPDATE.
--
-- CONSEQUENCE:
--   These 5 rows become visible again in the bell notification
--   panel as old notifications. They are stale (pre-church_id
--   era) and point to deleted or unknown data. Users may see
--   old entries reappear in their notification history.
--
-- SAFE TO RUN: idempotent — WHERE church_id IS NULL means
--   re-running touches 0 rows after the first successful run.
-- ============================================================

-- Assign all NULL church_id rows to CCFBC
UPDATE public.lineup_notifications
SET church_id = 'b5818c43-e949-403a-bc84-68aafe3582a7'  -- CCFBC
WHERE church_id IS NULL;

-- Verify: 0 NULL rows remain
SELECT
    COUNT(*)                                   AS total_rows,
    COUNT(*) FILTER (WHERE church_id IS NULL)  AS null_remaining,
    COUNT(*) FILTER (WHERE church_id IS NOT NULL) AS assigned
FROM public.lineup_notifications;

-- Expected: null_remaining = 0, assigned = 5 (or whatever total exists)
