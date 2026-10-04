# Migration rehearsal uses accepted synthetic credentials

At fb9738226, Real DB Integration job 111357810774 first fails with
MIGRATION_SOURCE_CREDENTIAL_UNSUPPORTED. Its synthetic family uses bcrypt cost 4,
which the new migration boundary correctly rejects. Later missing target-account
errors are consequences of the initial refused plan, not independent defects.
The local real-database reproduction fails 13 tests, with one passing.

The fixture now uses cost 10, the supported legacy lower bound; production
credential validation is unchanged. All 14 migration/authority tests then pass.
Every created synthetic user root is tracked immediately. The fixture uses the
canonical disposable graph cleanup instead of swallowing a foreign-key failure
from bulk user deletion. Both database clients disconnect in finally.
No source production credential or data is changed. No schema migration is added.
Final CI must re-execute the actual Real DB Integration lane on the new SHA.

Rollback is an ordinary commit revert of this test-only correction.
