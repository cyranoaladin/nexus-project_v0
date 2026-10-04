# Unexpected Core errors avoid raw exception logging

The Core HTTP error boundary previously logged the raw thrown value as err.
Pino can serialize its message, stack and custom properties, including private
request/provider/database details. Synthetic tests reproduce five failures of
the intended safe event contract; no real secret or personal record is used.

The boundary now emits CORE_V2_ROUTE_UNEXPECTED_ERROR, correlationId and a
bounded error category. An own data property matching a Prisma Pdddd code is
retained; arbitrary codes, names, messages, stacks and objects are omitted.
No accessor is evaluated to obtain a code. The client retains its stable 500
envelope. Domain, configuration and availability response mappings are unchanged.
The five focused tests, typecheck and targeted ESLint pass.
The neighboring public ARIA-error, reset non-enumeration and student-context
suites pass together with this boundary: four suites, 32 tests.

Operators can correlate the event to the request and recognized database code.
They must not restore raw exception logging for diagnosis. This is a correction
of this boundary only: global logger redaction, other log sites and error-tracking
providers remain separate qualification work. It does not prove all application
logs are free of private information.

Rollback uses an ordinary commit revert; no schema or production change.
