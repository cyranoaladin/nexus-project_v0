# Mobile timeout phase attribution

## Observed evidence

PR #337 remote head fa9c018fdc3659139e23d3aa01b7465fab4df2da, run 37177369627, mobile job 111362797278. E018 completed in 14461 ms. E019 timed out under the unchanged 45000 ms budget; its last published capture was feedback-submitted. No raw trace was included in the curated artifact. The blocking operation is not yet established: transport, RAG alert, layout, axe or screenshot remain candidates. Context teardown appears in the final stack and is not sufficient causal evidence.

## Acceptance criteria

Publish fixed phase labels, durations and failure booleans through the existing privacy allowlist. Do not publish content, URLs, headers, errors, cookies, identifiers or arbitrary step titles. Preserve privacy sealing idempotence, existing test assertions, retries and budgets. This instrumentation does not constitute a product fix or successful mobile qualification.

## Change

Transport send/request/response/body and each visual layout/axe/screenshot operation use Playwright steps. RAG and timeout sends/alerts have separate fixed labels. The report publisher retains only explicitly allowed labels and numeric durations; nested diagnostics stay redacted.

## Verification

New publisher regression: RED one failure with 20 passing existing tests; GREEN 21 tests. Full typecheck passed. Targeted lint passed. Neighboring publisher and harness contracts passed: two suites, 74 tests. Source contracts now require the awaited phase wrappers in the same layout → axe → screenshot → attachment order; no assertion was removed. Full governance suite passed: 24 suites, 259 tests. Browser reproduction remains pending the next exact-head CI execution: available local disk remains below the official browser build guard, and no undocumented alternate build procedure is used.

## Rollback

Revert only this diagnostic instrumentation by a normal follow-up commit. No schema, production data, timeout, security assertion or ignored-request policy is changed.
