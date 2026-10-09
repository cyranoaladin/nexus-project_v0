# ARIA module resolution excludes retained build evidence

Historical build contexts under `.artifacts/recovery` contain copied manual mocks.
ARIA's shared Jest module configuration previously discovered these generated
copies, producing duplicate-mock warnings and risking resolution against a build
snapshot instead of the current canonical source.

A regression test inspects the actual resolved PostgreSQL Jest configuration.
It failed because the generated mock path was visible. The shared module boundary
now excludes `.artifacts/`, while the canonical `__mocks__/` remains visible.
No business test pattern, coverage threshold or assertion is removed.
The four harness ownership tests pass, including exact ownership of the real
PostgreSQL and concurrency suites. Typecheck passes. Full ARIA coverage must be
renewed on the committed source; retained evidence is left intact.

Rollback uses an ordinary commit revert. There is no database change.
