# Subscription sale suspension consistency

2026-10-04. Parent source: `0ac1a3e61`.

The canonical suspension policy already closes `SUBSCRIPTION_PLAN` and
`ARIA_ADDON`. `/api/parent/subscription-requests` enforced it, but the alternate
`/api/parent/subscriptions` POST did not. A direct request could therefore create
a pending request for a suspended service.

The alternate route now uses the same policy and returns `409 SALE_SUSPENDED`
with private, no-store caching before catalog lookup, ownership queries,
request creation or notifications. Authentication and payload validation remain.
No price, commercial rule, permission, existing subscription or database was
changed. Reopening still requires qualification of the promised service.

Evidence: one failing reproduction before correction, then four suites and 24
passing tests. The boundary test uses the actual closed policy. Existing request
and ownership tests explicitly model a future open policy; their business
assertions remain unchanged. Private logs are
`.artifacts/recovery/parent-subscription-sale-red.log` and
`.artifacts/recovery/parent-subscription-sale-green.log`.

This closes the alternate sale entry point, not the full commerce qualification.
No migration is required. A rollback must retain the suspended-service refusal.
