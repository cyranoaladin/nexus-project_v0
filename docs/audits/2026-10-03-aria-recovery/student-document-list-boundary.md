# Direct student document listing

Date: 2026-10-04.

The standalone `/api/student/documents` endpoint independently listed ADMIN_ONLY metadata for the authenticated owner. It now uses the same student visibility policy as the dashboard and downloads. All response classes are private/no-store; unexpected errors emit a fixed operational code, never arbitrary exception content. Other roles retain the existing 401 behavior before database access.

Six new regression cases failed before correction (visibility query, private caching, role exclusions, exception redaction). After correction, four list/download suites pass: 45 tests. The actual PostgreSQL fixture extended from the dashboard boundary proves direct listing excludes eleven administrative records and returns all four permitted scopes: the combined real suite passes two tests. Full typecheck, changed-file lint, secret scan and diff check pass. The older list test expectation was strengthened to require the exact scope filter.

No schema, business price, file byte, production or frozen-worktree change. This is metadata/access qualification only, not upload, storage availability, virus scanning or complete UX qualification. Rollback is an isolated reviewed application revert.
