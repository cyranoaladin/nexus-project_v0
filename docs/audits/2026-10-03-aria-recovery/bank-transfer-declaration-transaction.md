# Atomic pending transfer declaration identity

## Reproduction and acceptance

Real disposable PostgreSQL reproduction: six failures, one pass. Same-parent same-price requests collapsed two children; different item keys/types, missing beneficiary metadata and another currency incorrectly reused historical payments. A controlled barrier made all six legacy non-transactional lookups observe an empty state: six distinct pending payments resulted. No thresholds, payload protections or financial assertions were weakened.

Required behavior: canonical server catalog, exact parent/item/type/student/currency/price identity; equivalent historical CREDIT_PACK allowed only for the same pack metadata; no implicit beneficiary assignment; six concurrent identical requests return one Payment and one staff notification set; replay preserves existing metadata and accepted CGV; partial notification failure rolls back the payment.

## Architecture

The route retains sale-suspension and canonical family mutation gates. The new V1 service takes only server-resolved facts. It locks the existing parent User FOR UPDATE, then rechecks child/profile ownership under FOR SHARE OF both rows. Parameterized Prisma.sql is used throughout. Pending lookup includes TND, current canonical amount/description, itemKey/itemType and exact studentId JSON. Explicit JSON null matches explicit null; SQL null, malformed JSON and missing keys do not prove identity. Payment creation and in-app Notification intents share the transaction. No provider send or payment completion occurs.

A replay performs reads/locks only. The former unit assertion “no transaction” was an implementation detail and is replaced by one transaction plus all original zero-DML assertions. No CGV date/version/IP, amount, metadata or immediate-execution proof is overwritten.

## Evidence

Real PostgreSQL suite: 16 tests passed, including a bounded loop of at most 250 DB-state observations without sleeps to establish blocked concurrent Student.parentId and ParentProfile.userId reassignments. Those writes finish after declaration commit; subsequent declaration refuses changed ownership. Notification fault injection runs inside a real transaction; Payment and Notification counts stay zero, then retry produces one declaration. Seven additional metadata/rollback cases complement the original seven.

API neighbors: 17 tests passed. Full typecheck passed. Changed-file lint, redacted secret scans and diff whitespace checks passed. No migrations, tariff changes or production writes.

## Limits and rollback

The service lock is not a global SQL uniqueness constraint and does not protect an unrelated writer that bypasses this service. Cross-store migration/writer fencing remains unqualified. Payment.amount is still a legacy Float column: this lot does not qualify all monetary handling or provider reconciliation. The caller retains responsibility for authentication, catalog and canonical mutation authority. Invoice, provider sandbox, retention and production operations remain separate gates.

Rollback is an ordinary forward corrective commit; no down migration, data deletion or historical payment rewrite.
