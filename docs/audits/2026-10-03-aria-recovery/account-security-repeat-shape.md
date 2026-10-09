# Mobile repetition evidence: the actual Playwright report contract

## Observed failure

On PR #337 head `df266cc1fe1a0d86f1ab6a285a0019c2fb65c44f`, auth job
`111350884938` passed its ordinary 80 tests and both mobile security scenarios
20 times each (40 passed, no retries). Qualification failed at
`check-account-security-repeat.mjs:29`: it expected two specs containing twenty
records. The allowlisted artifact `11292232583` actually contains forty specs,
one execution each, and stats expected=40, unexpected=0, flaky=0, skipped=0.
Playwright's JSON reporter serializes each repeated test as a spec; its opaque
id contains the repeat index (see installed `common/suiteUtils.js`).

## Correction and acceptance

The publisher now retains only a SHA-256 reference to the opaque execution id,
never the raw id, paths, headers, credentials or user text. It is idempotent
when republishing an already sanitized report. Qualification requires forty
specs, one result each, forty distinct references, the two exact allowed
file/title signatures, and exactly twenty results per signature. Existing
project, status, annotation, retry, error and SHA checks remain mandatory.
Duplicating a successful result cannot manufacture an additional repetition.
The former two-spec fixture was replaced by the actual producer shape, rather
than weakening the gate to accept a console total.

## Verification

Before correction the real-shape contract test failed at the same spec-count
check (19 other assertions passed). After correction the complete governance
suite passed: 24 suites, 258 tests. Added negative tests reject missing and
repeated execution references. No failing browser test, retry or skip was
accepted. The old artifact lacks execution references and is not retroactively
qualified. The new HEAD must execute and qualify all forty repetitions again.

## Scope and rollback

Only privacy publication, evidence validation and contract fixtures changed.
No browser cancellation filter or product behavior changed in this commit.
A normal revert restores the previous stricter-but-incompatible validator;
never bypass the qualification step in order to deploy.
