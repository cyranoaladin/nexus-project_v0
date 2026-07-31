# Global go-live coherence audit

## Date

2026-07-31, Africa/Tunis.

## Verdict and scope

`SYSTEM_COHERENCE_AUDIT_COMPLETE_REMEDIATION_PLAN_READY` is the target of this
documentary lot. It is not a production or go-live approval. No merge,
deployment, migration, process restart, production write, email delivery,
OpenRouter call, or real-minor-data transfer was performed.

The audit compares three states which must not be conflated:

1. deployed/current `main` at `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b`;
2. stacked pull requests #87, #88, #89, #90, #91 and #93;
3. the production runtime observed read-only on 2026-07-31.

## Verified Git baselines

| Ref | State | Draft | Base SHA | Head SHA | Merge state | Human approvals |
| --- | --- | ---: | --- | --- | --- | ---: |
| `main` | active | n/a | n/a | `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b` | n/a | n/a |
| #87 | open | yes | `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b` | `053868b3237cd6cb89916255626720672a945330` | blocked | 0 |
| #88 | open | yes | `053868b3237cd6cb89916255626720672a945330` | `45f3cd92ca8f9caaef1dd86504d3cdc0bdd999d1` | clean | 0 |
| #89 | open | yes | `45f3cd92ca8f9caaef1dd86504d3cdc0bdd999d1` | `05f99f24ad7de032e0ba527c30705a2eb0deae65` | clean | 0 |
| #90 | open | yes | `05f99f24ad7de032e0ba527c30705a2eb0deae65` | `ae56389dcf1b92ca4bece39e71961327455e2489` | clean | 0 |
| #91 | open | no | `ae56389dcf1b92ca4bece39e71961327455e2489` | `cb9237b4cd20ecc14f7f52528fb66c18a6956840` | exact-head review and code CI green; external document job running at audit close | 0 |
| #93 | open | yes | `cb9237b4cd20ecc14f7f52528fb66c18a6956840` | `9d7349e1888c314a1da9b696635181b2f0313706` | checks running after explicit foundation merge; benchmark invalidated | 0 |

GraphQL `reviewThreads` reports zero unresolved P1 and zero unresolved P2 on
#91. Codex completed its exact-head automated review on `cb9237b4c` without a
new major finding. This is not a human approval.

The documentation-only audit PR is intentionally based on the exact `main`
baseline. Its Dependency Integrity and Security Scan jobs reproduce
`BOUND_SHA_MISMATCH` because that baseline still contains the superseded
SHA-bound dependency exception and vulnerable dependency graph. Unit,
integration, real-DB, E2E, build, lint, typecheck, documents, CodeQL and
GitGuardian pass on that PR. D0 does not rebind or approve an exception; the
native dependency correction remains on #88 and must reach the integration
stack through the documented merge order.

## Component coherence matrix

| Component | Current main | Stacked PR | Production | Source of truth | Consumers | Duplicates | State | Risk | Owner | Remediation PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Free-bilan intake | legacy public route | #87 adds canonical intake | main release | Prisma workflow in #87 | family/API/staff | legacy and canonical paths coexist until integration | stack-only | P0 | product + engineering | D2 |
| Canonical assessments | absent | #89 adds assignments, attempts, scoring and publication | absent | canonical pedagogy catalogue plus Prisma workflow | family/staff | legacy `Bilan` remains readable | stack-only | P0 | pedagogy + engineering | D5/D6/D7 |
| OpenRouter transport | absent | #90/#91 contract and local-first boundary | unconfigured | `lib/llm/openrouter/` plus versioned policy | future async worker only | Mistral/Ollama/Chutes remain other-domain/legacy | not connected | P1 | security + engineering | D6 |
| Parent benchmark | absent | #93 | absent | synthetic fixtures and benchmark journal | model-selection review only | prior run invalidated | invalid | P1 | owner + reviewers | rerun after D0, outside D1–D8 |
| Email transport | four implementations | unchanged materially | SMTP absent | none canonical | auth, billing, stage, leads, reports | four transports/eight template sources | incoherent | P0 | operations + engineering | D1 |
| Registration identity | implicit states | #87 improves free-bilan workflow | main schema/data | multiple routes plus Prisma | public/staff/family | six entrypoints, seven token producers | partial | P0 | product + identity engineering | D2 |
| Authentication | NextAuth credentials/JWT | canonical magic-link additions in #87 | active main | `auth.ts`, `auth.config.ts`, middleware | all dashboards/APIs | role policy copied three times | active with gaps | P1 | security | D3 |
| Dashboard route policy | role prefix middleware | #89 adds shared canonical dashboard | active main | no single source | pages, middleware, nav | three policy sources | shared route blocked | P0 | frontend + security | D4 |
| Pedagogy corpus | absent on main baseline | #87 adds 17 modules/408 items | absent | `content/pre-rentree-2026` through server catalogue | #89 assessment engine | no public copy observed | technically valid, human-unapproved | P0 | named subject reviewers + pedagogical owner | D5 |
| RAG | programme clients on main | unchanged by canonical stack | token absent | external RAG client/routes | two programme routes | one backend, multiple consumers | dormant/unconfigured prod | P2 | ARIA/RAG owner | separate domain review |
| Legacy LLM | Mistral/Ollama/Chutes present | architecture guards canonical imports | keys absent | per-domain clients | historical bilans/NPC/legacy generator | five provider implementations including stack OpenRouter | legacy active in code | P1 | architecture | D6 plus legacy retirement gate |
| Runtime proxy | Nginx plus Node processes | no deployment | active main SHA | Nginx vhosts/systemd/process manager | public HTTP | unrelated public Node listeners exist | operational | P1 | infrastructure | D8 |

## Production read-only observations

- Active Nexus release code: `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b`.
- Active application process runs as `nexusapp` from the matching standalone
  release directory. No active-release symlink was proven; the direct release
  path is the only observed fact.
- Node `20.20.0`, npm `10.8.2`, Nginx `1.24.0`, PostgreSQL `16.14`, Redis
  `7.0.15`. A production Next.js version and PM2 version were not proven.
- Root filesystem utilization observed at 86%; memory pressure was not observed
  at audit time. This is one observation, not monitoring coverage.
- Nginx redirects HTTP to HTTPS, forwards Host, `X-Forwarded-Host` and
  `X-Forwarded-Proto`, and emits HSTS, CSP, frame, MIME and referrer headers.
- `/` and `/auth/signin` returned 200. Unauthenticated
  `/dashboard/bilans-canoniques` returned 307 to sign-in.
- Several loopback upstreams exist. Two unrelated Node listeners were observed
  on public interfaces at ports 3003 and 3006. Ownership and intended exposure
  require infrastructure review; D0 made no firewall or process change.
- No dedicated document-volume mount was proven.

The production env file is regular, not a symlink, owned by `root:nexusapp`,
and mode `0640`. The redacted presence report contains no values or complete
fingerprints.

## Credentials and email infrastructure

| Gate | Observation | Evidence class |
| --- | --- | --- |
| Database credentials | present and format-valid | file-presence check plus successful read-only query |
| NextAuth secret/URL | present and format-valid | file-presence/format check |
| Dedicated password-reset secret | absent; code fallback to NextAuth secret | code plus presence check |
| SMTP credentials | absent | canonical env presence check |
| Redis/Upstash credentials | absent | canonical env presence check |
| OpenRouter credentials/mode | absent/unset | canonical env presence check |
| Mistral/Chutes/OpenAI/Ollama/RAG credentials | absent | canonical env presence check |
| Secret in process arguments or PM2 dumps | none observed | redacted scan, not a universal historical guarantee |

`transporter.verify()` was not run because SMTP credentials are absent. No live
email was sent. The permitted status is
`SMTP_LIVE_DELIVERY_TEST=NOT_RUN_OWNER_RECIPIENT_REQUIRED`.

DNS observed:

- MX points to Google SMTP;
- no SPF record was observed at the apex;
- DMARC is present with `p=quarantine`;
- MTA-STS and TLS-RPT records were not observed;
- the DKIM selector is unknown and remains `OWNER_INPUT_REQUIRED`;
- mailbox existence and monitoring for `no-reply@`, `contact@` and `support@`
  are not proven.

Target identity policy must distinguish `SMTP_AUTH_USER`, `ENVELOPE_FROM`,
`HEADER_FROM`, `REPLY_TO`, `PUBLIC_CONTACT` and `INTERNAL_NOTIFICATIONS`.

## Email workflow findings

The inventory contains 17 trigger rows. Four independent transporter
implementations and eight template sources exist. Confirmed defects include:

- assistant student activation has a commented send call but returns a success
  claim containing the recipient email;
- free-bilan intake catches delivery failure and still claims the link was sent;
- password reset deliberately absorbs send failure and returns a generic
  anti-enumeration response, but has no durable delivery state;
- resend activation replaces the token before delivery, uses per-process memory
  rate limiting and swallows send failure;
- parent-child creation starts an unawaited send;
- inline dynamic HTML is not uniformly escaped;
- provider message IDs are not persisted consistently;
- no canonical retry/dead-letter/bounce lifecycle exists.

The anti-enumeration response for password reset is appropriate at the HTTP
boundary; the defect is the absence of a durable internal delivery result, not
the generic public wording.

## Registration and identity

Production read-only counts are recorded in `data-integrity-summary.json`:

- structural User/Student/Parent orphan counts: zero observed;
- expired unactivated user tokens: 5;
- activation tokens without an outbox event: 6;
- stage reservations without Student: 1 (legacy classification unresolved);
- duplicate normalized ContactLead groups: 2;
- orphan canonical publications: zero observed.

The current system has no persisted registration state machine. State is
inferred from profiles, tokens and timestamps. User email is unique in the DB,
but login and several creation paths do not establish one canonical trim,
Unicode normalization and lowercase policy before lookup/write. Public
free-bilan responses return internal parent/student IDs. Creation and delivery
are not one recoverable workflow.

## Authentication and sessions

- Credentials login performs a raw email lookup, without a single proven
  trim/lowercase/NFKC boundary.
- No distributed brute-force control was proven on Credentials login.
- JWT sessions contain role state without a token/session version; a role
  change or suspension does not demonstrably revoke existing JWTs.
- An explicit session `maxAge` and an explicit cookie policy were not found;
  framework defaults must not be reported as verified product policy.
- `trustHost` is enabled behind the observed reverse proxy.
- Bcrypt cost is inconsistent: most onboarding/reset paths use 12, while one
  staff coach update path uses 10.
- The password-reset HMAC contains user ID and email, falls back to
  `NEXTAUTH_SECRET`, and permits multiple concurrent tokens until a password
  change invalidates the password-derived signature.
- Activation/reset routes need one durable token lifecycle, replay protection,
  concurrency tests and audit events.

The 240-row API route/method matrix is a static characterization. A value such
as `NONE_FOUND` or `UNPROVEN` is a remediation signal, not proof that a route is
intentionally public.

## Dashboards, RBAC and IDOR

The stacked canonical page permits `ADMIN`, `ASSISTANTE` and `COACH` in its
server guard. Current middleware only permits dashboard paths underneath each
role prefix. Therefore all three authorized roles are redirected away from
`/dashboard/bilans-canoniques`: the server guard and middleware disagree.

The canonical student report API scopes to the current Student and published
state. No family exposure of internal comments, provider cost or OpenRouter
metadata was found in the inspected path. The response still includes a raw DB
report ID that the family UI does not require. The family view renders report
text in a plain `<pre>` rather than raw JSON; UX and accessible structured
rendering remain D4 work.

## LLM, RAG and agents

- Canonical scoring in #89 is local, deterministic and versioned.
- Manual responses remain human-reviewed.
- #90/#91 provide one canonical OpenRouter transport boundary but no business
  call, worker, Prisma model or production activation.
- Mistral has two legacy clients. `lib/bilan/generator.ts` contains a silent
  deterministic fallback after LLM failure; it must not serve new canonical
  public reports.
- Chutes is scoped to NPC in inspected imports. No canonical-bilan import was
  found.
- Ollama and `LLM_MODE` remain legacy configuration/code paths.
- RAG has an external client used by two programme routes; no production token
  was observed. No runtime autonomous agent implementation was proven beyond
  product copy/documentation.
- Production CSP still allows `https://api.openai.com`; no matching direct
  browser client was found, so necessity must be revalidated.

Policy remains:

`PARENT_MODEL_POLICY=UNDECIDED`,
`STUDENT_MODEL_POLICY=UNTESTED`,
`NEXUS_MODEL_POLICY=UNTESTED`.

The parent benchmark run
`4d37da5866ba575ff05df8af610bf273c2e13137c53d040a531384da443171ca`
is `INVALIDATED_BY_SECURITY_AND_GROUNDING_CONTRACT_CHANGE`. Its results and
human-review package are unusable. D0 performed zero new OpenRouter calls.

## Questionnaire corpus

Machine verification of the stacked canonical corpus reports exactly 17
modules, 141 nodes, 136 evaluated nodes, 408 items, 33 manually reviewed
responses and 85 sessions. The item CSV has exactly 408 data rows and the
module CSV exactly 17 data rows.

These are structural results only. Every module remains
`HUMAN_VALIDATION_REQUIRED`; reviewer identities are empty. D0 did not approve
content or invent reviewers. The 408-row matrix therefore marks disciplinary
judgements as requiring a subject-matter review even when the technical schema
and references are present.

Future pilot metrics are specified but have no final thresholds: item
difficulty, point-biserial correlation, distractor effectiveness, non-response,
time per item, KR-20/alpha where applicable, inter-rater agreement, rubric
consistency and human revision rate. Calibration policy remains a human/product
dependency.

## Source-of-truth counts

| Counter | Observed |
| --- | ---: |
| `EMAIL_TRANSPORT_IMPLEMENTATION_COUNT` | 4 |
| `EMAIL_TEMPLATE_SOURCE_COUNT` | 8 |
| `AUTH_ROLE_POLICY_SOURCE_COUNT` | 3 |
| `ACTIVATION_TOKEN_IMPLEMENTATION_COUNT` | 7 |
| `PASSWORD_RESET_TOKEN_IMPLEMENTATION_COUNT` | 1 |
| `REGISTRATION_ENTRYPOINT_COUNT` | 6 |
| `BILAN_GENERATION_IMPLEMENTATION_COUNT` | 4 |
| `LLM_PROVIDER_IMPLEMENTATION_COUNT` | 5, including stack-only OpenRouter |
| `RAG_BACKEND_ACTIVE_COUNT` | 1 code integration; production credential absent |
| `DASHBOARD_ROUTE_POLICY_SOURCE_COUNT` | 3 |

No code was deleted in D0. Candidates require consumer proof and migration
gates before retirement.

## D6 architecture prepared without implementation

ADR 010 and the state-machine, budget-ledger, worker-lease and rollback
documents define the future asynchronous boundary. They deliberately contain
no Prisma model, migration, worker, route or business integration. Their
invariants are: network outside DB transactions, idempotent enqueue, atomic
budget reservation, lease ownership, `UNKNOWN_OUTCOME` without automatic
replay, delayed retry, dead letter, immutable invocation provenance and no
automatic publication.

## Findings register

Each finding below includes all mandatory fields. Evidence paths are relative
to the repository unless explicitly marked production read-only.

### D0-EMAIL-001

- **Severity:** P0
- **Domain:** Email/onboarding
- **Evidence:** `app/api/assistante/students/[id]/activate/route.ts`,
  `app/api/bilan-gratuit/route.ts`, `app/api/auth/resend-activation/route.ts`
- **Reproduction:** inspect success responses while forcing the respective
  sender to fail; one send is commented and two failures are absorbed.
- **Impact:** families/staff can be told an activation link was sent when no
  durable delivery occurred.
- **Owner:** platform engineering and operations.
- **Remediation:** canonical transactional email outbox and truthful state.
- **Test:** Mailpit plus SMTP 4xx/5xx, retry/dead-letter and public-response E2E.
- **Dependencies:** SMTP identity/DNS decision.
- **Target PR:** D1.
- **Go-live gate:** `FALSE_EMAIL_SENT_CLAIM_COUNT=0`, `EMAIL_OUTBOX_E2E_SUCCESS=true`.

### D0-CONFIG-001

- **Severity:** P0
- **Domain:** Production configuration
- **Evidence:** `production-env-presence.redacted.json`.
- **Reproduction:** redacted key-presence validation of the canonical env file.
- **Impact:** SMTP, Redis/Upstash and OpenRouter-dependent workflows cannot be
  qualified or safely activated.
- **Owner:** infrastructure/owner.
- **Remediation:** provision dedicated secrets in the canonical runtime store,
  retain modes/ownership, then run non-PII preflights.
- **Test:** SMTP verify and owner-recipient delivery, Redis fail-closed test,
  OpenRouter private preflight on exact release SHA.
- **Dependencies:** D1/D6, owner credentials.
- **Target PR:** D8 for preflight automation; secret action remains operational.
- **Go-live gate:** SMTP, Redis and OpenRouter configuration gates.

### D0-ROUTE-001

- **Severity:** P0
- **Domain:** Dashboard authorization
- **Evidence:** stacked `app/dashboard/bilans-canoniques/page.tsx` versus
  `middleware.ts` role-prefix policy.
- **Reproduction:** authenticate separately as ADMIN, ASSISTANTE or COACH and
  deep-link to `/dashboard/bilans-canoniques`; middleware redirects before the
  page guard.
- **Impact:** every intended staff role is blocked from the canonical workflow.
- **Owner:** frontend/security.
- **Remediation:** one typed route/role policy consumed by middleware, page,
  navigation and API tests.
- **Test:** role matrix E2E including allowed and denied roles.
- **Dependencies:** #89 integration.
- **Target PR:** D4.
- **Go-live gate:** `DASHBOARD_INACCESSIBLE_ALLOWED_ROUTE_COUNT=0`.

### D0-PED-001

- **Severity:** P0
- **Domain:** Pedagogy
- **Evidence:** 17 module statuses and reviewer fields in the canonical corpus.
- **Reproduction:** run the corpus verifier and inspect module review manifests.
- **Impact:** no module is legally/product-wise publishable or production
  assignable.
- **Owner:** named subject teachers and pedagogical owner.
- **Remediation:** hash-bound subject, owner and publication approvals.
- **Test:** approval invalidates on hash change; unapproved assignment refused.
- **Dependencies:** human review and calibration policy.
- **Target PR:** D5 plus human governance.
- **Go-live gate:** `MODULE_PUBLICATION_APPROVED_COUNT=17` for full rollout.

### D0-STACK-001

- **Severity:** P0
- **Domain:** Delivery governance
- **Evidence:** #87–#93 remain open; approvals are zero; #87 remains blocked.
- **Reproduction:** query pull requests, checks, review decisions and GraphQL
  review threads.
- **Impact:** none of the canonical assessment/OpenRouter stack is on main.
- **Owner:** repository owner and eligible reviewers.
- **Remediation:** integrate and requalify in documented order without force
  push; no bypass of review/check policy.
- **Test:** checks and review on each retargeted final head.
- **Dependencies:** D0 review closure and human approvals.
- **Target PR:** existing #87/#88/#89/#90/#91/#93.
- **Go-live gate:** stack merged and release SHA equals qualified SHA.

### D0-AUTH-001

- **Severity:** P1
- **Domain:** Authentication/session security
- **Evidence:** `auth.ts`, `auth.config.ts`, password reset/activation routes.
- **Reproduction:** inspect JWT callback and mutate role/suspension after a token
  is issued; no token/session version invalidation is present.
- **Impact:** stale authorization can survive role or account-state change.
- **Owner:** security engineering.
- **Remediation:** canonical normalized identity, session/token version,
  distributed brute-force protection and dedicated reset secret.
- **Test:** role-change, suspension, logout/revocation and replay concurrency.
- **Dependencies:** D2 identity normalization.
- **Target PR:** D3.
- **Go-live gate:** JWT/session revocation gates.

### D0-IDENTITY-001

- **Severity:** P1
- **Domain:** Registration integrity
- **Evidence:** `registration-identity-state-machine.md` and read-only DB counts.
- **Reproduction:** inspect free-bilan check/create transaction boundaries and
  activation token delivery; query aggregate counts in read-only transaction.
- **Impact:** duplicate leads, ambiguous activation state and unrecoverable
  partial onboarding.
- **Owner:** product/identity engineering.
- **Remediation:** persisted lifecycle, idempotency, normalized unique keys and
  outbox linkage.
- **Test:** duplicate submissions, concurrent activation and orphan prevention.
- **Dependencies:** D1 email outbox.
- **Target PR:** D2.
- **Go-live gate:** orphan/duplicate/replay counts zero.

### D0-LLM-001

- **Severity:** P1
- **Domain:** LLM source of truth
- **Evidence:** `llm-provider-consumer-matrix.csv`, legacy generators and #90/#91.
- **Reproduction:** trace consumers of Mistral/Ollama/Chutes/OpenRouter and
  `LLM_MODE`; inspect legacy deterministic fallback.
- **Impact:** a new canonical report could acquire a competing provider or
  silent public fallback if integration ignores architecture boundaries.
- **Owner:** architecture/security.
- **Remediation:** D6 async OpenRouter-only canonical path, architecture tests,
  legacy read-only gate and no dual write.
- **Test:** provider-boundary, failure/dead-letter, no-auto-publication tests.
- **Dependencies:** approved model policy, valid privacy attestation, #91 merged.
- **Target PR:** D6.
- **Go-live gate:** canonical provider count one; legacy write count zero.

### D0-E2E-001

- **Severity:** P1
- **Domain:** End-to-end assurance
- **Evidence:** `docker-compose.e2e.yml`, existing Playwright specs and
  `system-e2e-characterization.md`.
- **Reproduction:** inspect services: current ephemeral stack lacks Redis,
  Mailpit and fake OpenRouter; the canonical family test intercepts core APIs.
- **Impact:** the claimed complete workflow and its failure modes are not
  characterized through real integration boundaries.
- **Owner:** QA/platform.
- **Remediation:** disposable Postgres/Redis/Mailpit/fake-provider environment
  and unmocked application API journey.
- **Test:** 26-step happy path plus failure matrix.
- **Dependencies:** D1–D7 implementation.
- **Target PR:** D7/D8.
- **Go-live gate:** full synthetic E2E and rollback smoke success.

### D0-NET-001

- **Severity:** P1
- **Domain:** Host exposure
- **Evidence:** production read-only listener/process inventory.
- **Reproduction:** enumerate listening sockets and owning processes without
  changing firewall or services.
- **Impact:** two unrelated Node services are reachable on public interfaces;
  intended exposure and hardening are unproven.
- **Owner:** infrastructure.
- **Remediation:** confirm ownership/need, bind privately or firewall through an
  approved operations change.
- **Test:** external port inventory after approved change.
- **Dependencies:** service-owner confirmation.
- **Target PR:** D8 runbook; operational ticket required.
- **Go-live gate:** approved exposed-port inventory.

### D0-DNS-001

- **Severity:** P1
- **Domain:** Email deliverability
- **Evidence:** read-only DNS queries.
- **Reproduction:** query MX/TXT/DMARC/MTA-STS/TLS-RPT; DKIM selector unknown.
- **Impact:** authenticated delivery and bounce reputation cannot be qualified.
- **Owner:** domain/email owner.
- **Remediation:** publish/verify SPF, DKIM alignment, DMARC, MTA-STS and TLS-RPT
  as decided by the mail provider.
- **Test:** DNS validators plus owner-recipient delivery and provider headers.
- **Dependencies:** canonical SMTP provider and selector.
- **Target PR:** D8 documentation; DNS change is external.
- **Go-live gate:** SPF/DKIM/DMARC and live-delivery success.

### D0-API-001

- **Severity:** P1
- **Domain:** API privacy
- **Evidence:** free-bilan response and canonical student report response.
- **Reproduction:** inspect serialized success DTOs.
- **Impact:** unnecessary raw internal identifiers reach public/family clients.
- **Owner:** API/security.
- **Remediation:** public opaque handles or omit unused IDs; preserve IDOR scope.
- **Test:** response-schema snapshots and parent A/parent B IDOR tests.
- **Dependencies:** D2/D4 contracts.
- **Target PR:** D2/D4.
- **Go-live gate:** `PUBLIC_INTERNAL_ID_EXPOSURE_COUNT=0`.

### D0-ASSESS-001

- **Severity:** P1
- **Domain:** Legacy assessment generation
- **Evidence:** `app/api/assessments/submit/route.ts` and
  `lib/assessments/generators/index.ts`.
- **Reproduction:** submit the public legacy assessment contract in a disposable
  environment; it persists PII/answers, returns a raw assessment ID and starts
  an untracked fire-and-forget Ollama generation.
- **Impact:** duplicate submissions and permanently stuck processing states are
  possible; this is a competing generation path to the future canonical engine.
- **Owner:** assessment architecture/product.
- **Remediation:** explicitly classify the route as legacy or migrate its public
  entrypoint to D2/D6 contracts; add idempotency and durable jobs before use.
- **Test:** duplicate submission, worker failure/recovery, non-enumerable public
  handle and architecture boundary tests.
- **Dependencies:** product decision on legacy assessment continuity and D6.
- **Target PR:** D2 for public contract, D6 for canonical generation.
- **Go-live gate:** one canonical generation implementation for new bilans and
  zero untracked fire-and-forget generation.

### D0-NOTIFY-001

- **Severity:** P1
- **Domain:** Public email trigger
- **Evidence:** `app/api/notify/email/route.ts`.
- **Reproduction:** from a same-origin browser, post `bilan_ack` with a
  caller-selected recipient; CSRF and distributed rate limiting exist, but no
  durable business-event binding or authenticated identity is required.
- **Impact:** email delivery can be triggered independently of a persisted
  bilan request, and delivery/deduplication cannot be reconciled.
- **Owner:** platform/security.
- **Remediation:** accept a server-side notification/business event reference,
  resolve recipient from trusted persisted state and enqueue through D1.
- **Test:** arbitrary-recipient refusal, event ownership, deduplication,
  fail-closed Redis and Mailpit delivery.
- **Dependencies:** D1/D2.
- **Target PR:** D1.
- **Go-live gate:** every outbound notification bound to an authorized durable
  event; zero caller-selected recipient in generic public send routes.

### D0-EMAIL-002

- **Severity:** P2
- **Domain:** Email maintainability
- **Evidence:** four transport implementations and eight template sources.
- **Reproduction:** search `createTransport`, `sendMail` and inline HTML.
- **Impact:** aliases, escaping, retries and observability diverge by trigger.
- **Owner:** platform engineering.
- **Remediation:** one `lib/notifications/email/` boundary and versioned templates.
- **Test:** architecture import test and template escaping/checksum tests.
- **Dependencies:** D1.
- **Target PR:** D1.
- **Go-live gate:** one canonical transport and zero direct transports outside it.

### D0-AUTH-002

- **Severity:** P2
- **Domain:** Password policy
- **Evidence:** staff coach update cost 10 versus onboarding/reset cost 12.
- **Reproduction:** inspect `bcrypt.hash` call sites.
- **Impact:** policy drift and inconsistent work factor.
- **Owner:** security engineering.
- **Remediation:** one versioned password hashing policy and rehash-on-login.
- **Test:** hash-cost characterization and upgrade test.
- **Dependencies:** D3.
- **Target PR:** D3.
- **Go-live gate:** single password hash policy.

### D0-UX-001

- **Severity:** P2
- **Domain:** Family report UX
- **Evidence:** current family report rendering in a plain `<pre>`.
- **Reproduction:** open a published synthetic report as the owning family.
- **Impact:** poor accessibility/readability despite no raw JSON leak observed.
- **Owner:** frontend/product.
- **Remediation:** typed audience-safe renderer, keyboard/mobile tests and PDF
  decision.
- **Test:** accessibility and family E2E before/after revocation.
- **Dependencies:** D6 report schema and D7 publication.
- **Target PR:** D4/D7.
- **Go-live gate:** accessible non-technical family report.

### D0-CONFIG-002

- **Severity:** P2
- **Domain:** Browser security policy
- **Evidence:** production CSP permits `https://api.openai.com`; no direct browser
  consumer was found.
- **Reproduction:** inspect live CSP and repository browser imports.
- **Impact:** unnecessarily broad outbound browser policy if confirmed unused.
- **Owner:** security/infrastructure.
- **Remediation:** prove consumer or remove permission in an approved deploy.
- **Test:** CSP smoke with critical pages and APIs.
- **Dependencies:** frontend inventory.
- **Target PR:** D8.
- **Go-live gate:** least-privilege CSP.

### D0-CODE-001

- **Severity:** P3
- **Domain:** Code quality
- **Evidence:** lint passes with 295 pre-existing warnings on #91.
- **Reproduction:** `npm run lint`.
- **Impact:** warning budget hides unused and weakly typed code; not an immediate
  D0 functional regression.
- **Owner:** engineering.
- **Remediation:** ratchet warnings by bounded domain PRs without mass rewrite.
- **Test:** no-new-warning gate and progressive cap reduction.
- **Dependencies:** none.
- **Target PR:** debt register after D1–D4 critical fixes.
- **Go-live gate:** no new warnings; critical paths typed.

## Audit gate status

| Gate | Status |
| --- | --- |
| PR91 unresolved P1/P2 | 0/0 on `cb9237b4c`; exact-head automated review complete |
| Email trigger inventory | complete, 17 rows |
| Auth route inventory | complete, 240 route/method rows |
| Registration flow inventory | complete |
| Dashboard role matrix | complete, 71 data rows |
| LLM provider matrix | complete |
| Questionnaire item matrix | complete, 408 data rows |
| Questionnaire module matrix | complete, 17 data rows |
| Production env presence | complete, values never emitted |
| Production write count | 0 |
| Data integrity counts | complete |
| Source-of-truth matrix | complete |
| E2E characterization | complete; end-to-end implementation remains blocked |
| Remediation backlog | complete in `docs/plans/global-remediation-backlog.md` |

## Rollback

This branch contains documentation only. Rollback is removal of its audit
commit. The #91 fixes are isolated commits and can be reverted by normal revert
after review if a regression is proven; no history rewrite is required. No
production state changed, so no production rollback action applies.
