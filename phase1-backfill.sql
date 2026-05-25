-- ============================================================
-- CCFBC Line Up Manager — Phase 1 Backfill
-- Generated: 2026-05-25
--
-- PURPOSE: Assign church_id to the 5 lineup_notifications rows
-- that were created before the church_id column was added.
--
-- WHY IT'S SAFE:
--   • Step 1 is SELECT only — shows every row before it's touched.
--   • Step 2 derives church_id from the associated lineup row
--     (more accurate than hardcoding a UUID).
--   • Step 3 is a fallback for any notifications whose lineup
--     was deleted — assigns to CCFBC as the safe default.
--   • Step 4 confirms 0 NULL rows remain.
--   • Songs and lineups already have church_id set — no changes
--     needed for those tables.
--
-- WHEN TO RUN:
--   Run BEFORE relying on church-scoped RLS policies. The policies
--   are already live in the DB; rows with church_id = NULL will
--   simply not appear in any authenticated query until backfilled.
--   No data loss risk — this is purely a SET operation on a nullable
--   column that currently holds NULL.
--
-- DO NOT MODIFY phase1-migration.sql — that file is the
-- authoritative tutorial reference. This file is additive.
-- ============================================================


-- ============================================================
-- STEP 1 — Preview: inspect the 5 orphan rows BEFORE touching them
-- Verify they are all CCFBC-era records (lineup_id should link
-- back to the one CCFBC lineup; created_at should be pre-backfill).
-- ============================================================
SELECT
    ln.id,
    ln.type,
    ln.lineup_id,
    ln.title,
    ln.created_at,
    ln.church_id,
    l.church_id AS lineup_church_id,   -- what we WILL assign (if lineup exists)
    c.name      AS lineup_church_name
FROM public.lineup_notifications ln
LEFT JOIN public.lineups l  ON ln.lineup_id = l.id
LEFT JOIN public.churches c ON l.church_id  = c.id
WHERE ln.church_id IS NULL
ORDER BY ln.created_at;

-- ============================================================
-- STOP HERE — review the output above before continuing.
-- Confirm every row's lineup_church_name is "CCFBC" (or whichever
-- church owns those lineups). If anything looks wrong, do NOT
-- proceed with the UPDATE steps below.
-- ============================================================


-- ============================================================
-- STEP 2 — Primary backfill: set church_id by joining to lineups
-- Each notification inherits the church_id of its parent lineup.
-- This is safe to re-run — WHERE church_id IS NULL means already-
-- backfilled rows are never touched again.
-- ============================================================
UPDATE public.lineup_notifications ln
SET church_id = l.church_id
FROM public.lineups l
WHERE ln.lineup_id = l.id
  AND ln.church_id IS NULL
  AND l.church_id IS NOT NULL;


-- ============================================================
-- STEP 3 — Fallback: for any rows still NULL after the JOIN
-- (e.g. the lineup was deleted), assign to CCFBC.
-- If all 5 rows matched the JOIN this will update 0 rows.
-- ============================================================
UPDATE public.lineup_notifications
SET church_id = 'b5818c43-e949-403a-bc84-68aafe3582a7'  -- CCFBC
WHERE church_id IS NULL;


-- ============================================================
-- STEP 4 — Verify: confirm 0 NULL rows remain
-- Expected: null_remaining = 0 for lineup_notifications.
-- ============================================================
SELECT
    'songs'               AS table_name,
    COUNT(*) FILTER (WHERE church_id IS NULL) AS null_remaining,
    COUNT(*)                                  AS total_rows
FROM public.songs
UNION ALL
SELECT 'lineups',              COUNT(*) FILTER (WHERE church_id IS NULL), COUNT(*) FROM public.lineups
UNION ALL
SELECT 'push_subscriptions',  COUNT(*) FILTER (WHERE church_id IS NULL), COUNT(*) FROM public.push_subscriptions
UNION ALL
SELECT 'lineup_notifications', COUNT(*) FILTER (WHERE church_id IS NULL), COUNT(*) FROM public.lineup_notifications
ORDER BY table_name;

-- All null_remaining values should be 0.
-- If lineup_notifications still shows > 0, re-run Step 3
-- with the correct CCFBC UUID and check for typos.
