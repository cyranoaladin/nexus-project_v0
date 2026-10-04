# Atomic stage lead and required notification intents

October 4, 2026. Base source `e21f8d659`.

Three RED unit cases demonstrated that public lead creation returned 201 after
internal notification persistence failed, did not use a shared transaction and
treated notification failure as nonblocking. A crash could therefore leave a
lead with no durable notification; the public duplicate path would not repair it.

Lead creation, internal alert and bank-transfer acknowledgment now share one
Prisma transaction. Each new intent has a stable creation-transition key. The
bank HTML builder is pure; its old asynchronous wrapper retains its signature
for compatibility. Queue draining occurs only after commit. A P2002 from any
part of the transaction is acknowledged only after a canonical lead is found
on the business key; an outbox conflict without a committed lead remains a
controlled failure. The acknowledgment never marks payment paid or account
activated. No old lead is silently retro-notified, and no queued payload is
rewritten. Existing jobs remain readable without recalculating their keys.

Eight targeted unit suites passed 91 tests, including five atomicity scenarios,
the bank HTML boundary and neighboring list/decision routes. Three real
PostgreSQL suites passed 14 tests in
`.artifacts/recovery/stage-lead-decision-green-1791150003`, after restoration of
the encrypted synthetic 131-migration fixture and application/replay of the
132-migration schema. A missing test encryption key forces intent failure:
the lead count stays zero, then retry creates one lead/intent. Concurrent
submissions preserve one row/intent. A bank-transfer creation commits two
pending intents and retry adds none. This is persistence/concurrency proof,
not delivery or production-backup proof. Targeted ESLint, typecheck and
diff-check passed; final staged secret scan is required before commit.

Read-only review found no new P0/P1 in this delta, no additional active bank-mail
caller and no delivery-semantic regression. It identified a separate catalog
race: open/price/title are read before the transaction. A concurrent closure or
price change is not yet serialized with submission; commit-time canonical
catalog validation is the next independent correction. No production
qualification is asserted until that invariant and the operational gates close.

No schema migration, SMTP delivery, payment, production connection or frozen-root
change occurred. Complete unit and exact-head CI must run on the subsequently
published source; the old full unit result is historical. Status NOT_READY,
PR Draft.
