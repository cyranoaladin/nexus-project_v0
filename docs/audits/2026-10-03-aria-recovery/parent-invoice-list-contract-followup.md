# Parent invoice list contract follow-up

Date: 2026-10-04.

Clean source SHA 3caa2d1e905f9cbd4192f511bdd28333065edba4: Core PostgreSQL 76 suites/754 tests passed; general integration 62 suites/351 tests passed. Full unit campaign: 1,295 suites passed, one failed; 14,479 tests passed, one failed; seven snapshots passed. Sources remained unchanged throughout each campaign.

The failure was the phone-only parent list query expectation, which still demanded the pre-publication-guard WHERE without `status != DRAFT`. Production already included that mandatory guard. This follow-up strengthens the exact assertion to include it, preserving the owned-beneficiary constraint and the negative no-empty-email test. Three targeted canonical unit suites pass: 30 tests, with detectOpenHandles enabled. Changed-file lint, secret scan and diff check pass.

The full unit campaign additionally warned that a worker did not exit gracefully; the targeted rerun emitted no such warning. Root-cause investigation/full requalification remains required; no leak is declared flaky or resolved from that targeted result alone. No production code, schema, source price, ownership rule or frozen worktree was changed by this follow-up.
