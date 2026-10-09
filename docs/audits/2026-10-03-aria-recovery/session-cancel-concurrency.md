# Conditional cancellation preserves concurrent state and ownership

2026-10-04, source da88a33dbaa69778a8c18bcd189999ef9fee7898 plus
manifested working diff. NOT_READY; no production operation.

The V1 cancellation route read status/participants, then unconditionally wrote
CANCELLED by id. A completion or reassignment committed between those operations
was overwritten. Unit RED: 2 failed / 10 passed. Disposable PostgreSQL RED
1791154391: 3 failed / 8 passed. A deterministic promise barrier holds the route
immediately after its real read; the competing write commits before release.
No timing sleep controls the ordering.

The SQL write now matches the read status and both participant ids atomically.
A miss returns controlled 409 and preserves the competing state. Existing
ownership refusals and completed/cancelled read refusals remain. No balance,
refund, price, schema or cancellation-window policy is changed.

GREEN 1791154442: 2 real-DB suites / 11 tests; 3 cancellation races and 8 existing
stage decision tests. Source identity remained stable; the owned temporary
instance was stopped. Unit 12 tests and targeted lint pass. The same runner
restores its encrypted synthetic V1 fixture, not any production data.
Command: python3 scripts/db/rehearse-stage-decision-migration.py --old-ref
43058877aa13d2e4ff793b951d5aceb7c2a13dbb --include-session-cancel

This closes the demonstrated stale-write defect. Full cancellation workflow,
append-only business audit, cancellation windows, notification and financial
policy are not qualified by this proof. Remote CI and production gates remain.

## Historical-state protection, 2026-10-05

NO_SHOW and RESCHEDULED were also writable through cancellation. Two new unit
tests failed (2 failed / 12 passed). Real PostgreSQL proof 1791155514 reproduced
both defects (2 failed / 11 passed). An earlier real fixture omitted the required
reason and therefore failed validation before reaching the state check; its pass
is explicitly excluded from state-protection evidence.

Cancellation now accepts only SCHEDULED, CONFIRMED and IN_PROGRESS, retaining
the atomic participant/status comparison. No attendance or report history is
rewritten. GREEN: 14 unit tests; PostgreSQL proof 1791155664: 2 suites / 13 tests,
with stable source identity, encrypted synthetic restore and interruption replay.
No production database or commercial cancellation-window rule was changed.
