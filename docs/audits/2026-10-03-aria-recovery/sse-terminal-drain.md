# SSE terminal publication after bounded EOF drainage

## Defect reproduced

The hook announced READY and cleared its active turn from onDone/onError while
`parseAriaSSEResponse` was still reading the fetch body. A following send calls
detach and aborts the attached controller; unmount can do the same. The browser
then reports an aborted business request although the terminal frame was valid.
A second defect was observable: onDone announced success even when a subsequent
frame made the response invalid.

Three deterministic tests failed before correction: done before EOF, error
before EOF, and success before an invalid trailing delta. They use a real native
ReadableStream with an explicitly controlled EOF, not sleeps or changed payloads.

## Correction and limits

The parser retains the terminal frame, validates the remaining response and
publishes its callback only after EOF. Other events retain streaming behavior.
Duplicated terminal or post-terminal frames remain failures. No network failure
is ignored. External abort remains ABORTED and cannot publish a stale terminal.
A transport which omits EOF is cancelled after a five-second terminal drainage
budget and raises TERMINAL_DRAIN_TIMEOUT exactly once. This budget begins only
after a terminal frame, never extends provider generation timeouts and never
marks a business turn complete after a transport/protocol failure. Timers and
external abort listeners are removed on all parser exits.

The EOF bound addresses a regression risk identified during read-only review:
waiting for a proxy to finish forever would otherwise keep the composer busy.
Its fake-clock test failed before the bound (zero cancels) and passed after it.
Additional tests reject an external abort and network failure during drainage
without publishing a successful terminal. No arbitrary E2E sleep was added.
The parser still depends on the caller/server generation policy before a terminal
frame; this is not a claim of a new whole-conversation timeout or buffer quota.

## Verification

Final targeted command: canonical `npm run test:unit -- --runInBand
--runTestsByPath` over terminal-drain, SSE, real-transport hook, conversation
engine, chat panel, Core reload and client suites: 7 suites, 236 tests passed.
All six new drainage cases passed. Existing streaming/cancellation/parser
assertions remained active. Full ARIA coverage, browser and final exact-SHA CI
must be renewed before qualification.

The full coverage run on 3ce315bae passed 2492 application, 352 PostgreSQL
and 27 concurrency tests, but the critical parser branch gate failed at 97.05%.
The internal abort controller makes the optional-signal path unreachable.
The refinement requires that controller and shares the abort-reason mapping;
it preserves caller cancellation and the drainage deadline. A seventh case
checks valid frames containing SSE comments and event IDs. Targeted parser
coverage is 100% across 114 lines, 16 functions, 140 statements and 98 branches.
The seven-suite targeted regression run passes 237 tests. These targeted results
do not replace the required renewed complete coverage gate on a committed SHA.

## Mobile CI attribution

On df266cc1fe1a0d86f1ab6a285a0019c2fb65c44f, mobile job111350885051
reported two POST /api/aria/chat ERR_ABORTED records. Its published allowlisted
artifact contains no network timestamps or raw trace. This race is proven
locally, but the exact cause of those two CI records remains unverified. The E018
assertion now includes only safe method/path/resource/flag/disposition metadata
in its failure message. It retains both empty-failure assertions. Browser rerun
must establish whether this correction resolves the observed mobile failure.

## Rollback

Ordinary commit revert only; no schema or migration change, no provider key,
no suppression of API failures or scanner findings.
