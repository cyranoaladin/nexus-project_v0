# Preserve the invitation revision while waiting for the account lock

2026-10-05. The user-first lock order prevented deadlock but serialized a new
resend over a competing invitation change instead of reporting the existing
domain conflict. The unchanged concurrency test reproduced this: proof
1791155115, 1 failed / 109 passed. A new command now observes the open issuance
before waiting, then compares it after acquiring the lifecycle lock. A changed
issuance returns ConflictError. A valid replay of the same command still returns
the original durable intent before that new-command check.

GREEN proof 1791155199: 12 suites / 110 real-PostgreSQL tests, including original
concurrency assertions and concurrent command retries. No assertions weakened,
no migration, no new secret, no production operation. Remote CI remains required.
