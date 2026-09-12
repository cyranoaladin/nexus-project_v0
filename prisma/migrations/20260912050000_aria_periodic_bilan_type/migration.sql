-- ARIA periodic bilans (P7b): a single new enum value on the existing,
-- shared canonical `BilanType`. No new table, no drift beyond this value —
-- the bilan itself is a plain `bilans` row like any other `BilanType`.
ALTER TYPE "BilanType" ADD VALUE 'ARIA_PERIODIC';
