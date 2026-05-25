-- ============================================================
-- CCFBC Line Up Manager — Phase 1 RLS State Check
-- Generated: 2026-05-25
--
-- PURPOSE: Confirm whether RLS is enabled on the three tables
-- that have no policies (push_subscriptions, lineup_notifications,
-- push_delivery_logs). No policies + RLS enabled = service-role-only
-- access, which is the INTENDED design. No policies + RLS disabled
-- = fully open table, which needs to be fixed.
--
-- SAFE TO RUN: SELECT only.
-- ============================================================

-- RLS enabled state for the three policy-less tables
SELECT
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
      'lineup_notifications',
      'push_subscriptions',
      'push_delivery_logs'
  )
ORDER BY tablename;

-- Expected result:
--   lineup_notifications  | true
--   push_delivery_logs    | true
--   push_subscriptions    | true
--
-- If any row shows false → RLS needs to be enabled on that table
-- (one-liner: ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;)
-- No policies are needed — service role bypasses RLS entirely.
