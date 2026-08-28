# V1 Candidat Individuel — Production Runbook

**RC_CANDIDATE_SHA**: `3037c4392411d942dd27ac3ba10738593670dfc5`
**Branch**: `release/candidat-individuel-v1-rc1` (worktree `.worktrees/release-candidate-v1-rc1`)
**Status**: T6 hardening complete. `PUBLIC_RELEASE = NO_GO`. **This runbook documents the mechanism — it does not authorize any deployment.**

This document uses only commands and mechanisms that already exist in this repository
(`docker-compose.prod.yml`, `Dockerfile.prod`, `scripts/`, `lib/env-validation.ts`) — no
placeholder infrastructure invented for this document.

---

## 0. CANONICAL_PRODUCTION_BUILD

```
CANONICAL_PRODUCTION_BUILD = docker compose -f docker-compose.prod.yml up -d --build
                              (Dockerfile.prod, multi-stage: deps → builder [`npm run build`,
                              RELEASE_SHA build-arg] → migrator → runner [standalone
                              server.js, non-root `nextjs` user, HEALTHCHECK on /api/health])
```

Confirmed by reading `docker-compose.prod.yml` (`nexus-app` service builds `Dockerfile.prod`,
`nexus-migrate` runs `prisma migrate deploy` via the `migrator` stage before app start) and
`.github/workflows/ci.yml`'s own `build` job, which runs the equivalent steps directly
(`npx prisma generate` → `npm run build` → `npm run artifact:traces` → `npm run artifact:audit`
→ standalone smoke test on `/api/health`) rather than through Docker, for CI speed — both
chains produce and validate the same standalone artifact. `Dockerfile.e2e` is a **separate**,
test-only chain (`docker-compose.e2e.yml`) — confirmed NOT the production build path; it exists
purely to give the E2E suite a Docker-built, production-equivalent app to drive with Playwright.

---

## 1. PRECHECK

- [ ] `RC_CANDIDATE_SHA` matches the commit the direction approved (`3037c4392...` for this RC).
- [ ] `docs/candidat-individuel/v1-release-candidate-manifest.md` reviewed — CANONICAL_UNIT,
      CANONICAL_FULL_TEST_GATE, SECURITY_GATE, MIGRATION_AUDIT all PASS.
- [ ] `pricing.candidatIndividuelPipeline.state` confirmed `OFF` or `SHADOW` on the target
      environment (never `ACTIVE_PUBLIC`/`ACTIVE_PUBLIC_PERCENTAGE` — see §Kill Switch below;
      the admin-config schema itself refuses those two values, `lib/config/schemas.ts` Invariant 6).
- [ ] Target `.env.production` reviewed against `docs/candidat-individuel/v1-config-secrets-matrix.md`
      — every REQUIRED variable present, every SECRET rotated/unique to this environment.
- [ ] Deploying operator identified (OWNER for this deploy — see Rollback §TRIGGER/WHO DECIDES).

## 2. BACKUP

```
PRE_DEPLOY_BACKUP = docker exec <postgres-prod-container> \
  pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB} -F c -f /path/to/backup-$(date +%Y%m%d-%H%M%S).dump
BACKUP_VERIFICATION = pg_restore --list <dump-file>   # confirms TOC readable, non-empty
```

Drilled on the disposable test database during T6 (§11 of this runbook's audit trail): a marker
row was inserted, `pg_dump -F c` taken, the row deleted (simulated loss), and
`pg_restore --clean --if-exists --no-owner` restored it correctly. One real nuance found and
documented: `--clean` can drop-then-recreate a custom SQL function used inside a functional
index (`users_household_name_key_idx` / `nexus_household_name_key()`,
`prisma/migrations/20260813100000_add_household_name_key_index/migration.sql`) in the wrong
order, leaving that one index missing after restore — recreating it from that migration file's
SQL (or re-running `prisma migrate deploy` against a schema-only-restored DB) fixes it. **Any
real restore must explicitly re-verify this specific index exists afterward.**

- **RPO**: as fresh as the last successful `PRE_DEPLOY_BACKUP` (this repo has no continuous
  WAL-archiving/PITR mechanism today — a gap, not assumed away; see Owner action below).
- **RTO**: dependent on dump size and restore time; not benchmarked against a production-sized
  database in this drill (only the disposable test DB, ~360KB dump, restores in seconds).
- **OWNER**: whoever owns the production Postgres host/backup schedule (outside this repo's
  scope — `docker-compose.prod.yml` deliberately does not expose the Postgres port externally,
  so backups must run via `docker exec` on the host, or via the host's own backup tooling for
  the `postgres_data_prod` volume).

## 3. DEPLOY

```
docker compose -f docker-compose.prod.yml up -d --build \
  --build-arg RELEASE_SHA=<RC_CANDIDATE_SHA>
```

(Or, if the deploy host pulls a pre-built image from a registry instead of building locally:
substitute the registry pull command — this repo does not itself define a registry push step,
see §12/§13 below on why no registry push happens in T6.)

## 4. MIGRATE (if applicable)

```
MIGRATION_REQUIRED = NO for this RC (see docs/candidat-individuel/t6-db-migration-audit.md)
```

`docker-compose.prod.yml`'s `migrate` service (`Dockerfile.prod` `migrator` stage) runs
`prisma migrate deploy` unconditionally before `nexus-app` starts — this is a no-op when there
are no pending migrations (confirmed: `npx prisma migrate deploy` against a fully-migrated DB
prints "No pending migrations to apply." and exits 0), so leaving it in the compose graph is
safe and requires no special-casing for a no-migration release.

## 5. HEALTH

```
HEALTH_CHECK = curl -f http://<app-host>:3000/api/health
              → {"status":"ok","timestamp":"..."}
```

Verified during T6 on the standalone artifact built from this exact RC_CANDIDATE_SHA
(`node .next/standalone/server.js`, all `lib/env-validation.ts` REQUIRED vars set): responded
`{"status":"ok",...}` within the container's own `HEALTHCHECK --start-period=40s` window.
`Dockerfile.prod` already declares this exact HEALTHCHECK — `docker compose ps` / `docker ps`
will show `(healthy)` once satisfied.

## 6. SMOKE

Minimum smoke checks performed during T6 against the standalone artifact (all confirmed):

| Check | Result |
|---|---|
| `GET /api/health` | `200 {"status":"ok"}` |
| `GET /api/assistante/candidat-individuel/profils` (no auth) | `401` |
| `GET /dashboard/assistante/candidat-individuel` (no auth) | `307` (redirect to sign-in) |
| `GET /api/quotes/public/<random-64-char-token>` | `404` (fail-closed, no info leak) |

Add, for a real deploy: sign in as a real ADMIN/ASSISTANTE account, confirm the candidat-
individuel workspace loads with the flag at its intended state; confirm a real (or synthetic-
staging) family link resolves.

## 7. ENABLE (only after the gate)

`pricing.candidatIndividuelPipeline.state` stays at its pre-deploy value through deploy — this
runbook's DEPLOY step never changes it. Any change to `ACTIVE_INTERNAL` (staff-visible) is a
separate, explicit `PATCH /api/admin/config` action, ADMIN-only, audited
(`business_config_audit`). `ACTIVE_PUBLIC`/`ACTIVE_PUBLIC_PERCENTAGE` cannot be set through
this endpoint at all today (§Kill Switch).

## 8. OBSERVE (first 30 minutes)

What the deploying operator should watch, and where:

| Signal | Where | Why |
|---|---|---|
| App container health | `docker compose -f docker-compose.prod.yml ps` | Catches an immediate crash-loop (e.g. a missing REQUIRED env var — `lib/env-validation.ts` fails fast) |
| 5xx rate | reverse-proxy access logs (nginx/traefik — whatever fronts `nexus-app-prod`; not defined inside this repo) | Catches a broad regression the health check alone wouldn't |
| Auth failures | app logs, `[AUTH] Login` / `[AUTH]` prefixed lines (pino JSON, `role`/`env` fields — matches the exact log lines seen throughout this mission's own E2E runs) | Distinguishes a real outage from a credentials/config issue |
| Quote creation failures | `POST /api/assistante/candidat-individuel/profils/:id/quote` non-2xx in logs | Direct signal for this release's own surface |
| Publication failures | `POST /api/assistante/candidat-individuel/quotes/:id/publish` non-2xx | Same |
| Family-link issuance failures | `POST .../family-link` non-2xx | Same — and check for `500`s specifically, since a misconfigured `NEXTAUTH_URL` fails this exact route (`getTrustedApplicationOrigin()`, discovered during this same T6 audit) |
| Email outbox drain | `EMAIL_OUTBOX_DRAIN_METRICS` / `EMAIL_OUTBOX_DRAIN_FAILED` log events (already emitted periodically, seen throughout every E2E run this mission) | Family-link/activation emails depend on this |

No raw token (family link, session, API key) may ever appear in any of the above — confirmed by
this mission's own family-link tests (T5R2) that a token is only ever present in the full
`familyUrl` returned once to the issuing staff member, never logged, never in an audit row by
itself (`quote_audit_logs` stores the *action*, not the token).

## 9. ROLLBACK

| Field | Value |
|---|---|
| **TRIGGER** | Health check failing past its start-period, a P0 surfaced within the observe window, or the deploying operator's own judgment call |
| **WHO DECIDES** | The deploying operator, or whoever direction designates as on-call for this release |
| **APP VERSION ROLLBACK** | Redeploy the previous known-good `RELEASE_SHA` via the same `docker compose -f docker-compose.prod.yml up -d --build --build-arg RELEASE_SHA=<previous-sha>` (or previous registry image) |
| **DB ACTION** | None required for this RC (`MIGRATION_REQUIRED = NO` — the previous app version is schema-compatible with the current DB; confirmed by drilling exactly this in T6, see below) |
| **PUBLIC PIPELINE STATE** | Unchanged — rollback never needs to touch `pricing.candidatIndividuelPipeline.state` since this RC never sets it to a public value in the first place |
| **VALIDATION AFTER ROLLBACK** | Re-run the HEALTH + SMOKE checks (§5/§6) against the rolled-back version |

**Rollback drill performed during T6** (local, disposable-equivalent — never on a production
resource): built the standalone artifact for the immediate parent release
(`feec4a427`, T5R6's own final HEAD, pre-RC-merge), booted it against the *same* disposable
Postgres database this RC's own tests use, and confirmed `GET /api/health` returns
`{"status":"ok",...}` — proving the rollback mechanism (swap build, restart, re-check health)
works, and that no DB migration undo is needed for this specific rollback target (T6 introduced
zero migrations of its own).

```
ROLLBACK_PLAN = PASS
ROLLBACK_DRILL = PASS
```

---

## Kill Switch — `pricing.candidatIndividuelPipeline.state`

The single governed rollout flag for the entire candidat-individuel engine
(`lib/quotes/pipeline-flag.ts`, backed by the existing `BusinessConfig` namespace/audit
mechanism — `lib/config/schemas.ts`, `business_configs`/`business_config_audit` tables — no
separate feature-flag system exists in this repo).

| State | Meaning |
|---|---|
| `OFF` (default, fail-closed) | Legacy quote engine only; new pipeline entirely inert |
| `SHADOW` | New pipeline runs in parallel for comparison, never visible to a family, never a contractual Quote |
| `ACTIVE_INTERNAL` | ADMIN/ASSISTANTE may use the new pipeline directly (still gated by every regulatory/pricing guard — never a public bypass) |
| `ACTIVE_PUBLIC_PERCENTAGE` / `ACTIVE_PUBLIC` | **Cannot be set via `PATCH /api/admin/config`** — `lib/config/schemas.ts` Invariant 6 explicitly rejects both values with a descriptive error naming the real precondition (14 commercial arbitrations, real cost source, internal pilot, real shadow corpus). Enabling public activation requires a **code change** to remove that block — never a config write, by design. |

- **How to activate** (ADMIN only): `PATCH /api/admin/config` with
  `{"namespace":"pricing.candidatIndividuelPipeline","key":"state","value":"ACTIVE_INTERNAL"}` —
  audited to `business_config_audit`.
- **How to deactivate**: same endpoint, `value: "OFF"` (or `"SHADOW"`).
- **Who can do it**: ADMIN role only (`requireAnyRole` gate on `/api/admin/config`).
- **How to verify current state**: `GET` the same config endpoint, or query
  `business_configs` directly for `namespace='pricing.candidatIndividuelPipeline'`.
- **Fail-closed behavior**: absent any override, `getPipelineState()` defaults to `'OFF'`
  (`lib/quotes/pipeline-flag.ts`) — there is no canonical-JSON fallback for this namespace,
  confirmed by reading the source; a missing/corrupt config row means the engine is inert, never
  silently active.

**End of T6**: `PUBLIC_PIPELINE_STATE = LOCKED` (`OFF` on every environment this mission has
touched; the schema-level block above additionally prevents it from ever being flipped to a
public-facing value through the normal admin path).

---

*This runbook is prepared, not executed. No production deploy, staging deploy, registry push,
or public-pipeline activation happened during T6 — see
`docs/candidat-individuel/v1-release-candidate-manifest.md` for the full T6 verdict.*
