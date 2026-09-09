-- Additive only: a new nullable commercial-tier dimension on Entitlement.
-- No existing column, row, or constraint is changed. Pre-existing rows keep
-- ariaTier = NULL; application code treats NULL as ARIA_AUTONOMIE (the lowest
-- tier) for backward compatibility — see lib/aria/kernel/entitlements.ts.

CREATE TYPE "AriaTier" AS ENUM ('ARIA_AUTONOMIE', 'ARIA_SUIVI', 'ARIA_ACCOMPAGNEE');

ALTER TABLE "entitlements"
  ADD COLUMN "ariaTier" "AriaTier";
