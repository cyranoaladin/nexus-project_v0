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

The existing live-browser diagnostic remains the source of truth for the direction's Chrome session. The required cause-classification evidence consists of one trace in the normal Chrome profile and one trace in Incognito/Guest without extensions, both against production `ca2b86...` and the same student workflow.

The test harness must independently execute the final candidate-individual scenarios on the same standalone artifact with bundled Chromium and installed Google Chrome 152. These automated runs validate compatibility but do not replace the two human traces.

Classification is fail-closed:

- normal profile fails and clean Chrome passes: `CLIENT_ENVIRONMENT_PROVEN`;
- both clean and normal production sessions fail with a reproducible application boundary: apply a minimal TDD correction, then require a controlled human trace against the exact final standalone artifact with safe fixture data before assigning `PROVEN_AND_FIXED`;
- insufficient or contradictory evidence: `OPEN`, which blocks cutover.

The controlled pre-cutover artifact trace does not mutate production. Post-cutover human acceptance remains separately required to close P1-B and the overall production incident.

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

Lead search request is exactly:

```json
{ "query": "bounded string", "limit": 20 }
```

Its response is exactly:

```json
{
  "items": [
    {
      "contactLeadId": "opaque-id",
      "displayName": "human label",
      "email": "responsible email shown in the identity summary"
    }
  ]
}
```

It excludes phone, status, notes, student linkage, merge/audit metadata, diagnostics and every field not displayed or persisted by the identity step. Both candidate search routes require ADMIN or ASSISTANTE and `ACTIVE_INTERNAL`, apply bounded strict Zod schemas, rate limiting, `Cache-Control: private, no-store`, and perform no mutation. When the pipeline is OFF, they return a stable `409 PIPELINE_INACTIVE`; the page remains accessible through the existing OFF shell and performs no search.

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

From that exact SHA, one clean immutable artifact is built once. Its immutable build manifest records:

- final source SHA;
- build ID;
- SHA-256;
- Node, npm, Next, Prisma, PostgreSQL and browser versions;
- migrations `88 -> 88`;
- toolchain versions needed to reproduce the build.

After the unchanged artifact passes DB, security and dual-browser qualification, a separate hashed qualification attestation records test counts, DB/browser versions, rollback target, pipeline/public state, the final source SHA, build ID and artifact SHA-256. The attestation is a release sidecar, not a mutation or reconstruction of the artifact. Its schema/template and generation tool are versioned before the final SHA; the generated attestation is stored alongside the immutable artifact after qualification.

The exact source SHA receives an annotated immutable release tag. The release branch is protected against force-push through GitHub settings when permissions allow; otherwise an actually enforced tag protection/ruleset and documented no-force-push process must be applied and verified remotely. A merely unprotected branch plus prose is insufficient.

The qualified artifact is retained unchanged for cutover. No reconstruction is allowed after the final gate.

## 10. Cutover boundary

Pre-cutover reporting must show every requested gate as PASS and `P1_A` as `PROVEN_AND_FIXED` or `CLIENT_ENVIRONMENT_PROVEN`. Otherwise `FINAL_VERDICT=NOT_READY` and production is untouched.

Immediately before any cutover, the deploy procedure must fail closed unless all of the following still hold:

- production resolves to the recorded `ca2b86...` release, or an explicitly audited later baseline;
- production has exactly 88 applied Prisma migrations and the final source has zero pending migrations;
- no `prisma migrate deploy`, `db push` or schema write is run for this zero-migration release;
- `OLD_RELEASE` is captured from the live symlink and remains available;
- annotated release tag, final source SHA, build manifest, build ID, artifact SHA-256 and qualification attestation all agree;
- the immutable artifact still contains the qualified standalone server and scanner result.

After authorization already embodied by the mission and only when every gate is green, the immutable release may be cut over atomically through the existing symlink convention. Restart only PM2 process `nexus-prod`; verify its child runs as `nexusapp`; run local and public health; check Nginx 5xx and application/auth/quote/family-link/DB logs without exposing secrets or PII.

Any P0/P1, digest mismatch, baseline drift, unexpected migration or health failure aborts or rolls back atomically to `OLD_RELEASE`, restarts only `nexus-prod`, and repeats local/public health. No DB rollback occurs because no schema change is allowed. P1-B closes only after human production acceptance. The final production verdict is permitted only when P0 through P3 and technical debt are all NONE, the pipeline is `ACTIVE_INTERNAL`, and public activation remains NO.
