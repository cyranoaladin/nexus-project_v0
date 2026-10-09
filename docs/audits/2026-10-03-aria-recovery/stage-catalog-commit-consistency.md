# Commit-time public stage catalog consistency

October 4, 2026. Base `d6ccc7b1076567b20d4ceef6bf0f71ca125af852`.

Read-only review identified a catalog race outside the new notification
transaction. Three unit cases first failed: no catalog lock, a stage closed before
commit still returned 201, and a removed stage still attempted creation.

The transaction now acquires a parameterized FOR SHARE lock on the canonical
stage row before re-reading its visibility, opening, slug and lifecycle filter.
Missing/closed stages yield the existing controlled 404 without a lead or intent.
Current title and price are used consistently for the lead and both notification
templates. The lock remains held through commit and therefore orders concurrent
catalog updates/deletion against creation. This is a public lead, not a payment
or issued invoice: no charge is performed and no new commercial price is set.
Existing legacy lead storage still uses its numeric price representation;
financial ledger/immutable invoice qualification remains separate.

Eight targeted suites passed 94 tests. Three PostgreSQL suites passed 16 tests in
`.artifacts/recovery/stage-lead-decision-green-1791150199` after synthetic
old-schema restore and migration replay. Two new real concurrency cases hold a
catalog update, observe the submission waiting on FOR SHARE, commit closure or
price change, then assert refusal/no lead or the latest canonical price. Polling
waits for the observed database lock, not an arbitrary delay. Targeted lint,
typecheck and diff-check passed. No migration was introduced.

These tests do not qualify stage capacity, academic eligibility, canonical
confirmed reservation, financial reconciliation, actual notification delivery
or production rollout. No frozen source, production database, provider or
historical queued payload was modified. Status NOT_READY; PR remains Draft.
