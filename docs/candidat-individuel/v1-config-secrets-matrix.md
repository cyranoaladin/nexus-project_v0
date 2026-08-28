# V1 Candidat Individuel — Configuration &amp; Secrets Matrix

T6 §8. No values are disclosed anywhere in this document. Source: `lib/env-validation.ts`
(the authoritative REQUIRED/RECOMMENDED/OPTIONAL contract, enforced fail-fast at server boot
via the Next.js instrumentation hook), `docker-compose.prod.yml`, `Dockerfile.prod`.

**The candidat-individuel V1 feature introduces zero new environment variables** — confirmed
by `git diff` across every T1-T6 commit touching this feature: it reuses the existing
Quote/family-link/auth/DB infrastructure entirely. The variables below are the pre-existing
app-wide contract this feature depends on transitively (auth, DB, rate limiting, email for
family-link-adjacent notifications) plus the ones genuinely irrelevant to it (payments, AI
services) — included for completeness since T6 asked for the full artifact-required set, not a
candidat-individuel-only subset.

| NAME | PURPOSE | SERVER/CLIENT | REQUIRED/OPTIONAL | VALIDATION EXISTING | FAIL_CLOSED_IF_MISSING | SECRET | PROVISIONING_OWNER |
|---|---|---|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Server | REQUIRED | `lib/env-validation.ts` | Yes — throws at boot in production | Yes | Infra/DBA |
| `NEXTAUTH_URL` | Canonical app URL for NextAuth callbacks, family-link origin (`getTrustedApplicationOrigin()`, `lib/auth/parent-activation.ts`) | Server (read server-side; also exposed as `NEXT_PUBLIC_APP_URL`) | REQUIRED (prod only) | `lib/env-validation.ts` | Yes — family-link issuance and NextAuth both throw without it (confirmed directly during T6: family-link route returns 500 with this unset) | No (a URL, not a credential) | Infra/Deploy |
| `NEXTAUTH_SECRET` | NextAuth.js JWT/session signing secret | Server | REQUIRED (prod only) | `lib/env-validation.ts` (also warns if &lt;32 chars) | Yes | Yes | Infra/Deploy (generate via `openssl rand -base64 32`, per `docker-compose.prod.yml`'s own comment) |
| `RATE_LIMIT_BACKEND` | Distributed rate-limit backend selector | Server | REQUIRED (prod only) | `lib/env-validation.ts` + `assertRateLimitRuntimeConfiguration()` | Yes — `memory` is explicitly *refused* in production (`RATE_LIMIT_PRODUCTION_MEMORY_REFUSED`, reproduced live during T6's rollback drill) | No | Infra/Deploy |
| `RATE_LIMIT_KEY_SECRET` | HMAC secret for opaque rate-limit keys | Server | REQUIRED (prod only) | `lib/env-validation.ts` | Yes | Yes | Infra/Deploy |
| `RATE_LIMIT_KEY_NAMESPACE` | Rate-limit key namespace (multi-env isolation) | Server | REQUIRED (`docker-compose.prod.yml`: `?RATE_LIMIT_KEY_NAMESPACE is required`) | compose-level `:?` guard | Yes | No | Infra/Deploy |
| `RATE_LIMIT_TRUST_PROXY_HOPS` | Exact trusted reverse-proxy hop count | Server | REQUIRED (prod only) | `lib/env-validation.ts` | Yes | No | Infra/Deploy (must match the real proxy topology) |
| `REDIS_URL` | Redis backend for rate limiting | Server | Effectively REQUIRED when `RATE_LIMIT_BACKEND=redis` (the only production-legal value) | `assertRateLimitRuntimeConfiguration()` | Yes | No (a URL; credential may be embedded — treat the whole URL as sensitive) | Infra/Deploy |
| `NPC_STORAGE_ROOT` | NPC persistent source storage root, bind-mounted **outside** the release directory | Server | REQUIRED (`docker-compose.prod.yml`: `?NPC_STORAGE_ROOT is required`) | compose-level `:?` guard + app-level `NPC_STORAGE_PREFLIGHT_FAILED` fail-closed check (reproduced live during T6) | Yes | No | Infra/Deploy |
| `DOCUMENT_STORAGE_ROOT` | Document storage root, same outside-release-tree contract as NPC storage | Server | REQUIRED in production (same fail-closed pattern; confirmed via CI's own "Prepare isolated document storage" step) | app-level preflight | Yes | No | Infra/Deploy |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` / `EMAIL_FROM` | Transactional email (family-link-adjacent notifications, parent activation) | Server | `SMTP_HOST`/`SMTP_FROM` RECOMMENDED (graceful degradation), rest OPTIONAL/paired | `lib/env-validation.ts` | No — warns only | `SMTP_PASSWORD` yes, rest no | Infra/Deploy |
| `EMAIL_OUTBOX_ENCRYPTION_KEY` | Encrypts queued outbound email payloads at rest | Server | REQUIRED when `EMAIL_OUTBOX_WORKER_ENABLED=true` (confirmed via CI's own build-job smoke-test env) | app-level fail-closed at worker start | Yes | Yes | Infra/Deploy |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` / `OPENAI_EMBEDDINGS_MODEL` / `MISTRAL_API_KEY` / `CHUTES_API_KEY` / `CHUTES_BASE_URL` | AI services (ARIA, NPC worker) — **not used by candidat-individuel** | Server | OPTIONAL for this feature (app-wide RECOMMENDED/OPTIONAL per `lib/env-validation.ts`) | `lib/env-validation.ts` | No | Yes (the `*_API_KEY` ones) | Infra/Deploy |
| `KONNECT_*` / `CLICTOPAY_*` / `NEXT_PUBLIC_KONNECT_PUBLIC_KEY` | Payment gateways — **not used by candidat-individuel V1** (no payment integration in this feature's scope; billing reuses the existing Quote acceptance flow, no new gateway call) | Server (+1 client-exposed public key) | OPTIONAL for this feature | `lib/env-validation.ts` (`CLICTOPAY_API_KEY` RECOMMENDED app-wide) | No | Yes (except the explicitly-named `NEXT_PUBLIC_*` key) | Infra/Deploy |
| `RAG_INGESTOR_URL` / `RAG_API_TOKEN` | RAG service — **not used by candidat-individuel** | Server | RECOMMENDED app-wide, irrelevant here | `lib/env-validation.ts` | No | `RAG_API_TOKEN` yes | Infra/Deploy |
| `NEXT_PUBLIC_JITSI_SERVER_URL` | Video conferencing — unrelated to this feature | Client | OPTIONAL | n/a | No | No | Infra/Deploy |
| `SENTRY_DSN` | Error tracking | Server | OPTIONAL | `lib/env-validation.ts` | No | Debatable (DSN is not a secret in the traditional sense but shouldn't be public-tampered) | Infra/Deploy |

## Fail-closed behavior summary

`lib/env-validation.ts::validateEnv()` runs at server boot (Next.js instrumentation hook,
confirmed executing on every standalone-server start during T6's own smoke tests — the
`RATE_LIMIT_PRODUCTION_MEMORY_REFUSED` and `NPC_STORAGE_PREFLIGHT_FAILED` crashes were both
reproduced live). Any REQUIRED variable missing in `NODE_ENV=production` throws and the process
never becomes ready — the container's own `HEALTHCHECK` then correctly reports unhealthy,
rather than serving with a degraded/insecure configuration.

## No secrets in the delivered artifact

Confirmed during T6:
- `node scripts/security/check-versioned-credentials.mjs` → `OK: 0 versioned password, service
  secret, or complete signed bilan token` (repo-wide, at the RC HEAD).
- `npm run artifact:audit` (`scripts/audit-production-artifact.js`) → `OK: No runtime data
  leaked into the artifact` (standalone build output).
- The client bundle never receives a server secret by construction — every `*_SECRET`/`*_KEY`
  above lacking a `NEXT_PUBLIC_` prefix is unreachable from client code (Next.js's own
  `NEXT_PUBLIC_` convention, unrelated to and unmodified by this feature). This mission also
  fixed one real client/server boundary leak risk during T6 itself (§3 of the lineage audit —
  `SPECIALITE_ABANDONNEE_WARNING` accidentally importable into a client component via a
  transitive `'server-only'` chain — caught by the production build, not by a secret scanner,
  and fixed by extracting the constant to a dependency-free module).
