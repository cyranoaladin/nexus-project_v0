# Core-only session revocation

2026-10-05. NOT_READY; no production operation.

The legacy-first revocation order rejected Core-owned accounts without a V1
mirror before revoking the authoritative session version. Two causal unit
tests reproduced the failure. Revocation now updates Core first when Core owns
the identity, then updates an existing V1 mirror. Only exact missing-row P2025
is accepted after successful Core revocation; transport and other errors still
propagate. The returned version belongs to the authority used for validation.

Prior targeted run: five suites / 56 unit tests passed. Disposable PostgreSQL
proof 1791155199: twelve suites / 110 tests passed, including two HTTP cases for
HYBRID and V2_ONLY accounts with no V1 row. Real persisted session claims are
accepted before revocation and rejected afterwards. Authentication boundaries
are mocked for that HTTP proof: this is not an encrypted browser-cookie E2E.
Typecheck passed. No schema or migration change is required.

Exact-SHA remote CI, browser qualification and production gates remain open.
