# Invoice queue fixture credential remediation

## Date
2026-10-04, Africa/Tunis.

## Cause
CI at 4756cc4d3196821b10effc451a32cf264dd0ab1c: Lint and Unit Tests both fail the versioned credential scanner at the invoice queue real-PostgreSQL fixture. Unit campaign: 14,577 passed, one failed, 1,304 suites passed, one failed. The literal was synthetic but should not be committed as a service encryption key.

## Correction
Generate a CSPRNG 256-bit encryption key for each disposable suite. Preserve and restore the caller environment. Do not change the scanner, its exclusions or allowed digests. No provider sends are performed by this fixture.

## Verification
Red: canonical credential scanner reports one finding, with value redacted. Green: zero findings; three targeted suites, 127 tests pass (scanner, subscription request route, FK inventory). The latter two suites also contain uncommitted requester-ownership work and are not evidence of remote CI. Real-PostgreSQL queue suite must be renewed after this change; previous four-test result belongs to the predecessor source.

## Scope
Test-only correction. No migration, production secret or security waiver.
