# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [2025-09-04]
- db: Enforce compound unique on payment_records (provider, externalId), with data dedup migration.
- db: Add partial unique index on credit_tx (provider, externalId) where externalId IS NOT NULL, with data dedup migration.
- api: Replace paymentRecord.create with idempotent upsert and unique externalId generation in:
  - app/api/payments/checkout/route.ts
  - app/api/payments/cash/reserve/route.ts
  - app/api/payments/konnect/intent/route.ts
- tests: Add unit tests for upsertPaymentRecord (idempotency + concurrency) at __tests__/lib/payments.upsertRecord.test.ts.
- ci: Ops workflow now guards against duplicate payment_records and uploads compose logs on failure.
- docs: Update README to reflect compound unique constraint and upsert strategy.


