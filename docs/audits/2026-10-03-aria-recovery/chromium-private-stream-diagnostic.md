# Chromium private-stream diagnostic — 4 October 2026

Status: NOT_READY. No API failure exemption is implemented or authorized by this document.

## Application evidence

The full canonical mobile matrix E018–E021 completed locally: 4 expected, 0 unexpected, 0 skipped, duration 47,590 ms. A separate canonical E019 campaign, 20 repetitions, no retries and unchanged timeouts, yielded 17 expected / 3 unexpected / 0 skipped, duration 246,736 ms. Each failure emitted body-eof / body-read-ok / no-signal-abort followed by transport:aborted. These campaigns used the immutable b575187d application artifact and current test source; they do not qualify the final PR SHA.

A native browser/CDP correlation against the same isolated application observed a completed reader and releaseLock, then canceled=true / ERR_ABORTED / Fetch about 1 ms later, with no reader.cancel. The initial auxiliary runs lacked a disposable rate-limit reset; their non-SSE response was not a product transport failure. After the guarded reset, 10 requests returned HTTP 200; one produced the anomaly. Request 11 hit the real 429 limit and ended this auxiliary diagnostic, not the canonical campaign. No rate limiter was weakened.

## Independent reproduction

`node scripts/testing/chromium-private-stream-diagnostic.mjs` starts a synthetic loopback HTTP server on an ephemeral port. The server separates two writes by setImmediate, without an arbitrary client delay. It uses no credentials, database, provider, service worker, application framework or request interception. Private no-store streaming is compared with native JSON consumption and a no-cache streaming control. The latter is not a proposed privacy workaround.

Observed with the repository's official Playwright 1.58.1 image and Chromium 145.0.7632.6:

| Response / reader | Complete page bodies | requestfinished | ERR_ABORTED |
| --- | ---: | ---: | ---: |
| no-store / stream | 20 | 14 | 6 |
| no-store / native json | 20 | 20 | 0 |
| no-cache / stream | 20 | 20 | 0 |

Re-executing the versioned script reproduced 9 aborted events / 20 fully parsed no-store stream bodies; both controls again passed 20/20 without aborted events. Syntax check and targeted lint passed.

An exit 0 means the diagnostic program completed; it is not proof that the strict transport gate passed. The browser discrepancy also has an [upstream report](https://github.com/microsoft/playwright/issues/42742), open and unpatched at inspection. Local reproduction supplies our evidence independently.

## Decision gate

The mandate expressly forbids ignoring a business API failure. A narrowly bounded evidence-based harness exception was submitted for human decision: retain no-store, require application EOF and a valid terminal protocol/identity, no cancellation or read rejection, preserve CDP diagnostics and all genuine business failures. No answer is assumed. Until authorized, strict mobile checks remain blocking. No production cache policy, browser project, assertion or timeout was relaxed.
