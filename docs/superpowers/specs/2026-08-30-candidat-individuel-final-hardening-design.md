# Candidat individuel - Final Hardening Design

## Status

Validated by direction on 2026-08-30. Production cutover is forbidden until P1-A and every pre-cutover gate are closed.

## Goal

Turn RC `622b5da2088f7b4a4b59fba842d376b5ce02ed61` into one reproducible final release that preserves the validated candidate-individual business engine, closes the contextual student workflow, eliminates search PII exposure and oversized directory payloads, makes the DB runner order-independent, and proves the exact final artifact in Chromium and Google Chrome 152.

## Non-negotiable boundaries

- Production remains on `ca2b86efa0c552277bc3a98c03c3944be8459835` during implementation and qualification.
- P1-A remains open until two human traces on that production baseline prove either the application cause or the client environment cause.
- No behavioral diagnosis may be inferred from clean Playwright runs alone.
- No Prisma migration is allowed; the migration count stays 88.
- `ACTIVE_PUBLIC` and `ACTIVE_PUBLIC_PERCENTAGE` remain forbidden.
- No production cutover is permitted before every listed gate passes.
- P1-B is `FIXED_IN_RC` before deployment and can become `CLOSED` only after production cutover and human acceptance.

## 1. P1-A evidence boundary

The existing live-browser diagnostic remains the source of truth for the direction's Chrome session. The required evidence consists of one trace in the normal Chrome profile and one trace in Incognito/Guest without extensions, both against production `ca2b86...` and the same student workflow.

The test harness must independently execute the final candidate-individual scenarios on the same standalone artifact with bundled Chromium and installed Google Chrome 152. These automated runs validate compatibility but do not replace the two human traces.

Classification is fail-closed:

- normal profile fails and clean Chrome passes: `CLIENT_ENVIRONMENT_PROVEN`;
- both clean and normal production sessions fail with a reproducible application boundary: `PROVEN_AND_FIXED` only after a minimal TDD correction and a repeated human trace;
- insufficient or contradictory evidence: `OPEN`, which blocks cutover.

## 2. Dedicated search contracts and SSOT services

Candidate-individual search uses dedicated staff-only read routes with POST JSON bodies. Routes remain thin adapters over shared services; Prisma queries, normalization rules, selectable-state rules, and lead lookup are defined once in server-side SSOT modules.

Student directory request:

```json
{ "query": "bounded string", "page": 1, "limit": 20 }
```

Student directory response contains only fields required to render and select a row:

```json
{
  "items": [
    {
      "studentId": "opaque-id",
      "displayName": "human label",
      "email": "optional student email",
      "grade": "optional grade",
      "school": "optional school",
      "selectable": true,
      "unavailableReason": null
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Parent data needed to decide selectability stays server-side. No parent email, user id, parent id, coach assignment, subscription, credit value, aggregate counter, activation state, merge metadata, or unrelated Student scalar is returned.

Lead search receives the same strict POST treatment and returns only the responsible fields rendered or persisted by the workspace. Both routes require ADMIN or ASSISTANTE, enforce `ACTIVE_INTERNAL` where appropriate, apply bounded Zod schemas, rate limiting, `Cache-Control: private, no-store`, and perform no mutation.

The existing general students/credits and assignment APIs keep their existing contracts. Candidate routes reuse shared services rather than importing those oversized DTOs.

## 3. Logging and privacy

Names, emails and phone numbers never appear in search URLs. Stable request metadata may be logged, but route failures log only a stable error code, request id, HTTP status and non-PII operation name. Raw `Error.message`, Prisma invocation text, query bodies and response bodies are forbidden for these routes.

Privacy tests cover:

- Nginx access and error log formats;
- PM2/application logger calls;
- `serializeError` boundaries;
- browser console and `pageerror`;
- Playwright artifact names/content metadata;
- Google Analytics/dataLayer and collect requests;
- HTTP URLs, headers and referrers.

The production smoke uses synthetic data and reports only boolean leak indicators. It must never print matched PII.

## 4. Contextual handoff and native navigation

The handoff remains same-tab `sessionStorage`, versioned, role-bound, TTL-limited, consume-once and deleted before authoritative resolution. It never uses URL parameters or durable browser storage.

Existing-student selection stages the handoff synchronously in the activation of a native same-tab link to the role-derived simulator route. If staging fails, navigation is prevented, the handoff is cleared, the control is unlocked and a human retry message is shown. The browser owns the navigation rather than `router.push`.

Contextual creation stages the returned `Student.id` only after the existing creation API succeeds, then performs a hard same-tab navigation. A bounded watchdog clears the handoff, unlocks the UI and offers retry if navigation cannot leave the directory page.

Tests cover reload, back, forward, double consumption, two tabs, role switch, OFF pipeline, expired/corrupt handoff, failed staging, failed navigation and successful retry.

## 5. Contextual creation disclosure

The contextual primary action is labelled `Creer les comptes et utiliser pour ce devis` in the rendered French UI. Before confirmation, the dialog states that the operation may:

- create or update Nexus parent and student accounts;
- send the student activation email;
- send the responsible password definition/reset email when applicable.

No email or account side effect occurs before explicit confirmation. The existing transactional creation and notification service remains authoritative; no second account-creation mechanism is introduced.

## 6. Identity copy and release mismatch UX

Identity copy states that selecting a student automatically attaches the Nexus responsible, while optional responsible search can verify the dossier. Obsolete text implying that the responsible must always be selected first is removed.

The server exposes a non-secret `SERVER_RELEASE_SHA`; the client bundle embeds `CLIENT_RELEASE_SHA`. Staff surfaces compare them. On mismatch they show `Une nouvelle version de Nexus est disponible - Recharger` with an explicit reload action. There is no automatic reload and no interruption of active form input.

## 7. Hermetic DB runner

Test cleanup never executes `SET session_replication_role=replica`. It may assert that every observed session is `origin`.

Migrations run once on one fresh PostgreSQL database. A central reset enumerates application tables only, excludes `_prisma_migrations`, quotes identifiers, and executes one controlled `TRUNCATE ... RESTART IDENTITY CASCADE`. Any discovery, truncation or reset failure is fatal.

The runner proves:

- all 12 DB suites and at least 203 tests pass on one fresh DB;
- normal order passes;
- reverse order passes;
- a recorded seeded random order passes;
- concurrent checked-out sessions all report `session_replication_role=origin`;
- the canonical FK DDL remains present and enforced.

The full DB runner becomes a required remote CI gate or part of the applied immutable release mechanism.

## 8. Dual-browser and interaction matrix

The exact final standalone artifact is exercised in bundled Chromium and Google Chrome 152 with:

- fresh context;
- warm cache;
- hard reload;
- at least 60 seconds idle before interaction;
- inline and contextual existing-student selection;
- contextual creation roundtrip;
- back and forward navigation;
- desktop 1440+, tablet 1024 and mobile 390;
- mouse, Tab, Enter and Space.

Every identity path proves exactly one successful `identity/resolve`, authoritative Student and ContactLead state, enabled profile CTA and navigation to step 2. Candidate-owned console errors, page errors, unexpected HTTP failures and unexpected request failures remain zero. No new warning is accepted in the candidate-individual scope.

## 9. Release governance and immutable artifact

One final source SHA is created only after implementation and tests are complete. No commit, including documentation, may follow the final gate.

From that exact SHA, one clean immutable artifact is built once. Its release manifest records:

- final source SHA;
- build ID;
- SHA-256;
- Node, npm, Next, Prisma, PostgreSQL and browser versions;
- migrations `88 -> 88`;
- all test counts and results;
- rollback target;
- pipeline/public state.

The exact source SHA receives an annotated immutable release tag. The release branch is protected against force-push through GitHub settings when permissions allow; otherwise an actually enforced tag protection/ruleset and documented no-force-push process must be applied and verified remotely. A merely unprotected branch plus prose is insufficient.

The qualified artifact is retained unchanged for cutover. No reconstruction is allowed after the final gate.

## 10. Cutover boundary

Pre-cutover reporting must show every requested gate as PASS and `P1_A` as `PROVEN_AND_FIXED` or `CLIENT_ENVIRONMENT_PROVEN`. Otherwise `FINAL_VERDICT=NOT_READY` and production is untouched.

After authorization already embodied by the mission and only when every gate is green, the immutable release may be cut over atomically. P1-B closes only after human production acceptance. The final production verdict is permitted only when P0 through P3 and technical debt are all NONE, the pipeline is `ACTIVE_INTERNAL`, and public activation remains NO.
