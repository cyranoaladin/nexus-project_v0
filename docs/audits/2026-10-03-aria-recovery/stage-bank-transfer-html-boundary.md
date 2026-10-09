# Bank-transfer acknowledgment HTML boundary

October 4, 2026. Base `d31562cd78440011dbcb87d664746a76fafb2b93`.

The public reservation caller passed submitted parent/student names into the
bank-transfer acknowledgment HTML, without output encoding. Catalog title was
also interpolated as HTML. Three DOM regression cases first failed because an
image/event handler, injected link or SVG became an actual element. Two other
cases already passed. No real SMTP, client document or production data was used.

The existing HTML escape helper now encodes these three values at the template
sink, including both title occurrences. Literal Unicode/ampersands remain
readable; an absent student remains absent. Prices, payment state, configuration
and mail worker behavior were not changed. The only observed production caller
is public reservation creation, whose duplicate path does not resend mail.
No historical queued payload was rewritten or retroactively sent.

Three targeted canonical unit suites passed 36 tests, including the five new
boundary tests. Targeted ESLint, `npm run typecheck` and diff-check passed. Tests
assert DOM booleans rather than dumping mail bodies or banking configuration.
The complete 14,837-test campaign previously proved the base source; it is not
claimed as a full campaign for this new correction.

Other legacy mail templates, atomic reservation/outbox persistence, real delivery,
provider configuration and production rollout remain unqualified. This correction
does not close the entire mail or payment capability. Status NOT_READY; Draft
retained, no production operation.
