# Student document metadata boundary

Date: 2026-10-04.

The dashboard queried every UserDocument owned by a student, exposing administrative titles, descriptions and links despite download authorization denying ADMIN_ONLY. Acceptance: only the four student-readable visibility scopes can enter either resource projection; apply the predicate before pagination and reject unknown scopes.

The shared `lib/documents/student-visibility.ts` policy now governs download authorization, the dashboard database query and defensive resource/Hub projection. No owner, role, parent or coach permission was widened. The response shape and authorized educational resources remain stable.

Regression: one new builder case failed before the fix (24 existing cases passed). After correction, six neighboring dashboard/cockpit/download suites pass: 112 tests. A real disposable PostgreSQL fixture with four permitted documents and eleven newer ADMIN_ONLY documents proves filtering before the ten-row limit, no administrative metadata in the payload, and consistent actual download authorization for each scope: one test passed. Physical file reading is not exercised by this database test.

Full typecheck passed. Changed-file lint has zero errors and one pre-existing unused `pastDate` warning in the dashboard payload test; no rule suppression. Diff check and redacted secret scans passed. No migration or production change.

Rollback: revert this isolated application commit via protected review. Complete document/upload/publication, browser accessibility and production qualification remain separate gates.
