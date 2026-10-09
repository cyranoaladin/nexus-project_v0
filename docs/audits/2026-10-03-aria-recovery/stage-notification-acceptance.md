# Stage notification acceptance criteria

2026-10-04. Pending work identified against source
`ef6330bc05759c94cb8a0cefc9ac3b8ab454af9e`; no implementation or delivery proof
is claimed by this plan. The current complete unit run is allowed to finish
before another source change.

## Slice 1: bank-transfer HTML boundary

Reproduce a submitted parent/student name containing active HTML and a catalog
title containing markup. The queued HTML must contain no injected element,
event attribute or link; DOM text must preserve the intended literal value,
including Unicode and ampersands. Null student name and ordinary text retain the
existing message. Assertions must not dump the message, address or banking
configuration. Queue persistence failure propagates; queue acknowledgment is
not proof of delivery. Use the existing HTML escape helper at the output sink;
do not change prices, sender configuration or payment state. No real SMTP call.

## Slice 2: durable public lead notification

A synthetic fresh lead and required internal notification intent must commit in
one transaction. Intent persistence failure must roll back the lead. A successful
retry must create one lead and one intent, using a stable transition key rather
than the clock. Concurrent duplicates must acknowledge without overwriting a
lead or adding an extra intent. A unique conflict from the outbox must not be
misclassified as proof of an already-existing reservation. Queue draining starts
only after commit; worker failure must not change creation or payment status.

Bank-transfer acknowledgment must have a clearly defined durable intent contract
before being moved into this transaction. Preserve compatibility of prior queued
messages and avoid duplicate delivery. Do not silently retrofit historical leads
or send bulk messages. Add real PostgreSQL transaction/concurrency tests on a
guarded disposable synthetic database; unit mocks alone are insufficient.

## Unclosed operational gates

SMTP/provider configuration, allowlist, real delivery/bounces, backup recovery,
retention, canonical payment confirmation and production rollout remain separate
requirements. These slices do not qualify the full notification capability or
authorize a pilot.
