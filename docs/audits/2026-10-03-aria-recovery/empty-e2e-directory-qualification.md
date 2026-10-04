# Local empty E2E directory and qualification

2026-10-04, source `326c73598`.

The full canonical unit campaign encountered one failure in
`__tests__/scripts/e2e-bootstrap-contract.test.ts`: the retired second E2E tree
was expected absent, but an empty directory remained in the integration clone.
It contained zero files, had no tracked Git paths and was not a symlink. No
assertion or test configuration was changed.

After checking emptiness and current ownership, only that exact directory
`__tests__/e2e` was removed with `rmdir` (which refuses nonempty directories).
Removed content: zero bytes, zero files. No historical worktree, private recovery
evidence, database, upload, secret or release was touched. The canonical E2E
sources remain under `e2e`; no test was deleted or quarantined.

The isolated contract then passed all 16 tests. The earlier complete campaign
must retain its failure and cannot be described as green; a fresh complete
campaign is required. Private metadata:
`.artifacts/recovery/empty-e2e-directory-removal.json`; targeted result:
`.artifacts/recovery/e2e-bootstrap-empty-directory-green.log`.
