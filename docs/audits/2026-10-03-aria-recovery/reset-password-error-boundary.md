# Password reset error boundary and redaction

2026-10-04. Parent source: `326c73598`.

The V1 reset endpoint logged arbitrary exception messages from the outer request
boundary and the recovery dispatch/authority boundary. It also returned the
asynchronous confirmation handler without awaiting it inside the try/catch,
allowing a failed confirmation database read to reject outside the controlled
public response.

The two handlers are now awaited. Unexpected outer failures retain a generic500
response and log only `PASSWORD_RESET_REQUEST_FAILED`. Dispatch/authority failure
retains the identical non-enumerating request response and logs only
`PASSWORD_RESET_DISPATCH_FAILED`. No token, password, email, provider exception
or database detail is logged. Existing expiry, credential CAS, session-version
invalidation, password KDF and rate-limit behavior are unchanged. No migration
or dependency change is required.

## Evidence and corrected test assumption

The initial parse test incorrectly expected500: malformed JSON already returns
a controlled400 before the outer catch. That failure is not a production defect.
The corrected reproduction injects a failing sensitive-request guard and a
failing reset authority; both tests failed specifically because exception detail
appeared in logs. They pass after redaction.

A third reproduction failed with the rejected confirmation promise before
`return await`; it passes with a generic response and no private exception in
logs or response. Final targeted campaign: two suites, 20 passing tests.
Read-only review found no new P0/P1; it did not execute tests.

Private evidence under `.artifacts/recovery/`:
`reset-password-error-redaction-red-causal.log`,
`reset-password-confirmation-boundary-red.log`, and
`reset-password-error-redaction-complete-green-final.log`.
Full final-SHA CI and a renewed complete local campaign remain separate gates.
