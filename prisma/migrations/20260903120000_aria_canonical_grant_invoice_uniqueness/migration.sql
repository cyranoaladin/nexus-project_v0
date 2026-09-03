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

CREATE UNIQUE INDEX "entitlements_aria_access_invoice_key"
  ON "entitlements" ("userId", "sourceInvoiceId")
  WHERE "productCode" = 'ARIA_ACCESS' AND "sourceInvoiceId" IS NOT NULL;
