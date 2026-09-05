# System E2E characterization

## Date and boundary

2026-07-31. This is a read-only characterization of existing test coverage,
not a claim that the future canonical workflow passes end to end.

The required target environment is disposable PostgreSQL, disposable Redis,
Mailpit and a local fake OpenRouter HTTP server. No production service, real
mailbox, real OpenRouter endpoint or real minor data may be used.

## Existing harness finding

`docker-compose.e2e.yml` currently provisions PostgreSQL, the application and
Playwright. It does not provision Redis, Mailpit or a fake OpenRouter server.
The existing canonical family Playwright test intercepts core browser API
requests, so it verifies UI behavior but not the primary server/database/email
contract. This distinction blocks any complete-E2E claim.

## Happy-path characterization

| Step | Required behavior | Current main | Stacked PR | Evidence/test status | Target PR |
| ---: | --- | --- | --- | --- | --- |
| 1 | submit free-bilan form | legacy route exists | canonical intake in #87 | partial API tests; no full journey | D2 |
| 2 | create idempotent request | legacy identity side effects | #87 request workflow | stack tests only | D2 |
| 3 | queue notification | synchronous/best-effort sends | intake outbox exists for some canonical events, no canonical email outbox | missing | D1 |
| 4 | observe email in Mailpit | no Mailpit service | unchanged | missing | D1 |
| 5 | activate parent | token flow exists | canonical magic link plus legacy activation coexist | fragmented tests | D2/D3 |
| 6 | set password | route exists | unchanged | unit/API only | D3 |
| 7 | authenticate | NextAuth Credentials | canonical magic auth addition | unit/API only | D3 |
| 8 | redirect parent dashboard | exists | unchanged | browser coverage partial | D4 |
| 9 | assign approved synthetic module | absent | #89 assignment; real modules remain unapproved | stack service tests | D5 |
| 10 | start attempt | absent | #89 | stack API/service tests | D6 integration |
| 11 | autosave | absent | #89 | stack concurrency tests | D6 integration |
| 12 | resume | absent | #89 | stack tests | D6 integration |
| 13 | submit and seal | absent | #89 | stack tests | D6 integration |
| 14 | manual correction | absent canonical path | #89 | stack tests | D6 integration |
| 15 | deterministic score | legacy generators differ | #89 canonical scoring | stack tests | D5/D6 |
| 16 | local-first snapshot | absent | #91 contract only | local unit tests | D6 |
| 17 | fake OpenRouter draft | absent | client contract only | fake transport unit tests, no worker | D6 |
| 18 | grounding | absent | #91 local validator | unit tests | D6 |
| 19 | fixture-driven human review | absent | #89 review model, #93 benchmark review unrelated | no workflow E2E | D6/D7 |
| 20 | approve revision | absent | #89 deterministic report approval only | partial stack tests | D6/D7 |
| 21 | publish parent audience | legacy publication exists | #89 canonical publication | stack API tests | D7 |
| 22 | queue publication email | best-effort transports | no canonical email notification outbox | missing | D7 |
| 23 | observe publication email in Mailpit | no Mailpit | unchanged | missing | D7 |
| 24 | render parent report, non-JSON | legacy/plain text paths | canonical student path; parent narrative not connected | missing | D4/D7 |
| 25 | revoke | legacy varies | #89 revocation | stack API tests | D7 |
| 26 | deny report after revocation | partial legacy guards | #89 audience/status guard | not full-stack E2E | D7 |

## Failure characterization

| Failure | Expected invariant | Existing proof | Gap/observed behavior | Target PR |
| --- | --- | --- | --- | --- |
| SMTP absent | queued, retryable or dead-letter; no sent claim | none full-stack | several routes claim or imply success | D1 |
| SMTP 4xx | delayed retry with bounded attempts | none | synchronous transports diverge | D1 |
| SMTP 5xx | classified and monitored | none | no common error taxonomy | D1 |
| Redis absent | sensitive endpoints fail closed in production | #87 rate-limit tests | not in current E2E harness/prod config | D8 |
| duplicate submission | one business request/result | stack idempotency tests | no full journey | D2/D6 |
| double activation | one terminal activation | fragmented token tests | multiple token producers | D3 |
| expired token | generic refusal, audited | route tests partial | expired tokens remain in production data | D3 |
| reused link | replay denied | magic-link tests in #87 | legacy activation paths coexist | D3 |
| revoked session | immediate denial | no tokenVersion | not supported end to end | D3 |
| OpenRouter timeout | deferred retry, then dead-letter; no report | fake client tests | no job/worker allowed yet | D6 |
| invalid LLM schema | reject draft | #91 validator tests | no durable invocation path | D6 |
| invalid grounding | reject draft | #91 validator tests | no durable invocation path | D6 |
| provider unavailable | deferred retry, alert, no publish | client mapping tests | no worker/alert | D6 |
| worker crash | lease expiry, no duplicate completion | C2 docs only | no implementation | D6 |
| duplicate notification | one delivery per dedup key | none | no canonical email outbox | D1/D7 |
| concurrent publication | one publication version/audience | #89 DB/service tests | no complete UI/email journey | D7 |

## Required disposable topology

The future test job must add named health-checked services and must not silently
mock them:

```text
Playwright → Next.js test server → PostgreSQL disposable
                              ├→ Redis disposable
                              ├→ Mailpit SMTP/API
                              └→ fake OpenRouter HTTP server
```

Browser tests must not intercept the primary application API contract. Fake
OpenRouter is permitted only at the provider HTTP boundary. A synthetic
`PUBLICATION_APPROVED` module fixture must be visibly test-only and must not
alter the canonical 17-module human-validation status.

## Required assertions

- No outbound network except explicitly allowlisted local services.
- Mailpit contains expected template ID/version and recipient hash association,
  without exposing content in test logs.
- No duplicate request, attempt, notification or publication row.
- Every asynchronous transition is observable and audit-linked.
- Redis loss produces the documented fail-closed status.
- OpenRouter failures never synthesize a public final narrative.
- Family HTML/hydration contains no answer key, internal note, model metadata,
  cost, raw provider error or other audience content.
- Revocation removes family access without deleting immutable history.

## Result

`E2E_CHARACTERIZATION_COMPLETE=true`.

`FULL_SYNTHETIC_SYSTEM_E2E_SUCCESS=false` because D1–D7 do not yet exist on
main and the current harness lacks three required integration services. This is
an explicit go-live blocker, not an historical failure waiver.
