-- Audit DB — Anomalies minimales
-- Exécution: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f audit-db/sql_checks.sql
\set ON_ERROR_STOP on

-- 1) Wallet vs transactions: diff non nul interdit
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM credit_wallets w
    LEFT JOIN credit_tx t ON t."walletId" = w.id
    GROUP BY w.id, w.balance
    HAVING (w.balance - COALESCE(SUM(t.delta),0)) <> 0
  ) THEN
    RAISE EXCEPTION 'Audit: wallet balance mismatch';
  END IF;
END $$;

-- 2) Payment records externals uniques par provider
DO $$ BEGIN
  IF EXISTS (
    SELECT "externalId", provider
    FROM payment_records
    WHERE "externalId" IS NOT NULL
    GROUP BY "externalId", provider
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Audit: duplicate (provider, externalId) in payment_records';
  END IF;
END $$;

-- 3) Orphelins: sessions référencent utilisateurs inexistants
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM sessions s
    LEFT JOIN coach_profiles cp ON cp.id = s."coachId"
    WHERE cp.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Audit: session with missing coach profile';
  END IF;
END $$;
