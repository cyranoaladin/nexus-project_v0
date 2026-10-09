# Parent onboarding logout phase attribution

Date: 2026-10-04.

Remote b063036d5 auth Chromium: 527 expected passes, one 60,027 ms timeout, zero retries/flaky/skipped. Private-data-free artifact 11295173928 maps the failure to parent-email-onboarding.spec.ts:173; job 111369679167 logs identify the final logout invocation at line 290 and navigation wait at line 155, waiting for commit. Messages, cookies, activation links and provider payloads are not copied into this evidence.

Five fixed logout phase labels now preserve submission, response, cookie deletion assertion, navigation and cookie-absence assertion durations. All original assertions and 60-second budget remain unchanged. The privacy publisher accepts only those five labels, drops arbitrary labels and exception content, and remains idempotent. A governance canary was RED before the allowlist extension (one failure, 20 passes), then all 21 cases passed. Full typecheck, changed-file lint, publisher syntax check, secret scan and diff check pass.

This is diagnostic instrumentation, not a claimed browser fix. The independently reproduced logout single-navigation correction is documented separately. Browser rerun is pending; temporary GitHub DNS unavailability and insufficient local build space prevent claiming fresh browser execution. No production, configuration secret, migration or frozen-worktree change.
