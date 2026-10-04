# PostgreSQL fixture ownership and unavailable-database failures

## Reproduced defects

On a new isolated migrated PostgreSQL database, the normalization suite passes
five tests once and fails its unchanged 201 assertion on the second run: 409.
Its teardown selected users by an email prefix, while the public family service
creates a parent and student with generated login identifiers. Those fixture
roots remained in the database and changed the next execution's duplicate check.

The visibility and nullable-stage suites also passed six tests against a closed
local database port: their setup caught connection errors and each test returned
before assertions. This was not real integration coverage.

## Correction

All three suites guard the disposable target before connecting or writing. Setup
errors propagate to Jest. No scenario silently returns when the database fails.
Normalization tracks explicit seeded user roots and the parent/student roots
returned by its successful public service call. Visibility tracks its own created
user IDs instead of deleting every household named Foyer/Test. Stage cleanup uses
the exact stage ID it created. Disconnect runs in finally blocks. Existing
business payloads and 201/409, visibility and null-safe assertions remain intact.
The historical residual fixture is retained in its original isolated database;
there is no deletion by a guessed phone number or production access.

## Verification

On a second new database after versioned migrations, all three suites pass twice:
11 tests per run, zero skips. With an unavailable disposable database they fail:
three suites and 11 tests. Typecheck and targeted ESLint pass. The aggregate
post-run fixture count is recorded privately; no user data or database URL is
included in this document. Final exact-SHA CI must still be renewed.

## Rollback

Ordinary commit revert. No application or database migration is changed.
