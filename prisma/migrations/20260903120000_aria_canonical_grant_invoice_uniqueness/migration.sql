-- Cubic P1-C / P2 (concurrency): the canonical ARIA_ACCESS grant model is
-- redesigned to be invoice-scoped — EACH invoice that converges to ARIA
-- access gets its OWN Entitlement row (never a shared row extended in
-- place by a later invoice; see lib/entitlement/engine.ts
-- activateCanonicalAriaGrant()). The application layer already enforces
-- "at most one ARIA_ACCESS row per (userId, invoiceId)" via a
-- findFirst-then-create check, but that alone is not a hard boundary under
-- concurrent activation (two racing requests for the same invoice can both
-- pass the findFirst before either commits its create). This partial
-- unique index makes the invariant a real DB-enforced guarantee instead of
-- an application-level convention — additive only, touches no existing
-- row, and constrains nothing outside ARIA_ACCESS (every other productCode
-- keeps its current multi-row-per-invoice freedom, e.g. EXTEND-mode's own
-- audit "(extension)" trace rows).

-- Cubic P1 (confidence 8): if a database already contains duplicate
-- ARIA_ACCESS rows for the same (userId, sourceInvoiceId) — the exact
-- pre-existing concurrency race this migration closes — CREATE UNIQUE
-- INDEX below fails with a bare "could not create unique index" Postgres
-- error, giving ops no idea what to actually do about it. This preflight
-- turns that into a clear, actionable stop: it does NOT silently merge or
-- delete any row (this migration is data-preserving, and auto-merging
-- AriaEntitlementScope rows onto one survivor is a judgment call that
-- belongs to whoever investigates the specific duplicates, not to a blind
-- migration script).
DO $$
DECLARE
  duplicate_pair_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_pair_count
  FROM (
    SELECT "userId", "sourceInvoiceId"
    FROM "entitlements"
    WHERE "productCode" = 'ARIA_ACCESS' AND "sourceInvoiceId" IS NOT NULL
    GROUP BY "userId", "sourceInvoiceId"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_pair_count > 0 THEN
    RAISE EXCEPTION 'ARIA_CANONICAL_GRANT_MIGRATION_BLOCKED_BY_EXISTING_DUPLICATES: % (userId, sourceInvoiceId) pair(s) already carry more than one ARIA_ACCESS entitlement row. Reconcile before re-running this migration: for each pair, merge every AriaEntitlementScope row onto ONE surviving Entitlement row (union the courseKeys, keep the union of active-scope coverage), then delete the other row(s). See lib/entitlement/engine.ts activateCanonicalAriaGrant() for the invoice-scoped model this index enforces.', duplicate_pair_count;
  END IF;
END $$;

CREATE UNIQUE INDEX "entitlements_aria_access_invoice_key"
  ON "entitlements" ("userId", "sourceInvoiceId")
  WHERE "productCode" = 'ARIA_ACCESS' AND "sourceInvoiceId" IS NOT NULL;
