# ARIA submitted transport failure observation

Date: 2026-10-04. Product/browser completion remains unqualified.

Remote b063036d5 mobile evidence artifact 11295058582 identifies E019's wait: the submitted citation request receives HTTP 200, then `ARIA_PHASE:transport:body` consumes 44,441 ms and times out. No layout/axe/screenshot stage follows. Mobile totals: one pass, one timeout, two serial dependents skipped.

Installed Playwright's BrowserContext._onRequestFailed records/emits failure but does not resolve Response._finishedPromise; requestFinished alone resolves it. The helper's response.finished wait therefore conceals a failed transport until the global test timeout. A faithful event fixture reproduces this: success passes; aborted and reset requests remain pending (two RED cases).

The helper now registers listeners before submission, binds the first matching same-origin POST/content request by object identity, and observes that request's finish or failure. A concurrent same-content request cannot settle it. HTTP 200 and successful completion remain required; every failure throws, including ERR_ABORTED. No failure is ignored, no API is allowlisted, no delay/budget/retry is changed. Listeners are disposed on terminal events and all exit paths. Fixed aborted/failed phase labels reveal failure class without arbitrary error strings, URL queries, headers or tokens.

Three neighboring harness/diagnostic suites pass: 38 tests. The private-report governance suite passes 21 tests, including nested private-canary redaction and idempotent sealing. Full typecheck, changed-file lint, secret scan and diff check pass.

This fixes the obscured causal signal, not the underlying failed browser transport. Twenty successful browser repetitions, all four visual sizes, auth multi-browser and exact-SHA remote CI remain required. No production changes. Rollback: isolated reviewed application/test commit revert.

Review follow-up, 2026-10-04: the fixture additionally exercises failure before response headers (response=null), rejection while obtaining the response, and a response whose body-finished read would reject while requestfailed reports the failed transport. All six transport cases settle without a sleep and leave no request/requestfinished/requestfailed listeners. These three added cases protect already-correct branches and pass before any helper change; they are not claimed as new RED reproductions. No product or helper behavior was changed for them.
