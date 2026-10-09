# Bank-transfer child mutation authority

## Acceptance criteria

No child payment lookup, creation or staff notification may occur if canonical family authority denies a mutation or is unavailable. Read-only Core membership must never become a financial write capability. Preserve the current catalog and the sale suspension gates before business DB access. Preserve the explicitly unmigrated legacy-family path. No actual transfer, payment validation or external notification is performed in tests.

## Reproduced defect and correction

Three unit scenarios failed on the old route: DENIED, CORE_VERIFIED_READ and AUTHORITY_UNAVAILABLE all led to pending payment creation using stale V1 ownership. The route now requests the canonical facade's mutation decision before the historical ownership checks. Denial returns 404; outage returns private/no-store 503. Only LEGACY_ALLOWED proceeds. This deliberately follows the existing cross-store fail-closed contract: Core-controlled families require a transactional write fence before legacy financial mutations can be opened.

## Proof

Two API suites: 17 passed, including the unchanged canonical 750 TND price, suspension and historical pending-payment scenarios. Real dual-store migrator/authority suite: 24 passed, including two new HYBRID/V2_ONLY scenarios. A disabled legacy parent, pending Core guardian, verified read-only guardian and revoked guardian cannot declare a payment; real Payment and targeted Notification counts remain unchanged. The verified guardian can still read its authorized document. Synthetic data and disposable databases only. Full typecheck passed.

## Remaining critical finance work

This is an authorization correction, not finance go-live qualification. The inherited pending declaration matcher still omits beneficiary/item identity and remains check-then-create without a concurrency fence. The Core→V1 transactional writer fence remains necessary. Immutable economic snapshot, safe monetary representation, signed-provider reconciliation, sandbox journey and invoice authority remain separately unqualified. No production migration or commercial value changes were made.

## Rollback

Normal forward correction/commit only; restoring the stale-parent bypass is unsafe. No schema change or data rewrite.
