# Chromium E2E contracts after restrictive financial corrections

2026-10-04. Reproduced remotely on exact published source
`81baf60b773e6d536386b4ad45c88dc5989415d8`, CI run `37221155886`.
Parent source of this test-only change: `f36c4db01`.

## Six observed failures

The Chromium job ended with 521 passed, six failed and one serial dependent test
not run. The previous logout timeout was not the observed cause of these failures.

| Failure | Proven cause | Updated contract |
|---|---|---|
| Two legacy assistant credit redirects | Test expected “Validation des Paiements”; canonical assistant is read-only and page says “Consultation des paiements” | Preserve URL/redirect checks, require actual heading and forbid validation/rejection buttons |
| Parent grouped billing heading | Test expected obsolete “Facturation Groupée” | Require “Vos factures” for payer/delegation access |
| Parent monthly total | Test expected a derived 0 TND from subscription metadata removed by the financial ownership correction | Forbid monthlyPrice/ariaCost in child subscription DTOs and any invented TND total in that rubrique |
| Parent offers link in billing | Billing now links to the protected invoice list, not suspended-sale offers | Require exact protected invoice href; forbid the obsolete offer link |
| Payment validation200 | Actual403: server-side APIRequestContext sent no Origin | Prove missing/hostile Origin403 with private cache and unchanged pending payment; only then send the current application's origin and retain the full payment/invoice/PDF assertions |

No permission, financial ownership rule, timeout, API refusal or production UI
was relaxed. These tests now protect the user's restrictive financial mandate.
The serial dependent scenario must execute successfully in the renewed campaign;
its previous non-execution is not an optional skip.

## Local checks and limitations

Canonical collection:
`npx playwright test --config=playwright.auth.config.ts --project=chromium dialog-all-roles-proof.spec.ts parent-dashboard.spec.ts payments.invoice.documents.spec.ts --list`
collected 63 scenarios. Typecheck, targeted lint, credential scan and diff-check
passed. The initial list attempt used the default public config and found zero
tests; it is not browser evidence. An initial TypeScript headers-union error was
fixed with an explicit readonly string-header map, without an any cast.

No current-source browser execution is claimed locally: available diagnostic
artifact is an older SHA, and heavy current builds are delegated to exact-SHA CI
under the disk constraint. A renewed full Chromium job must pass before review.
Private logs are `.artifacts/recovery/ci-81baf60b-auth-chromium-private.log`
and `auth-financial-contract-list-canonical.log` in that directory.

## Separate mobile failure

The same CI source failed E020 at1366×768 with ARIA_CHAT_TRANSPORT_ABORTED, leaving
one visual scenario not run; REPORT_STATS invalidity is downstream. No request
failure ignore or cache-policy change is authorized by this contract adjustment.
