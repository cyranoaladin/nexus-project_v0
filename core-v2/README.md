# Core v2 — greenfield foundation (not wired into the running app)

This directory holds the Core v2 schema (`prisma/schema.prisma`) and its baseline migrations. Since `feat/core-v2-greenfield-foundation`, this schema has a real, isolated Prisma Client, a real baseline migration, and a minimal repository layer (`lib/core-v2/`) — but it is still **not** referenced by the app's build, `prisma generate`, or any deploy step. The live app continues to use the repository-root `prisma/schema.prisma` exactly as before, and no `nexus_core_v2` database exists anywhere except a disposable one created and destroyed by tests/CI.

## Bootstrapping a disposable Core v2 database

Never point `CORE_V2_DATABASE_URL` at anything but a throwaway database — the client refuses to start if it equals `DATABASE_URL` (see `lib/core-v2/client.ts`).

```bash
# 1. Start any empty, disposable PostgreSQL (example: Docker)
SCRATCH_PW="$(openssl rand -hex 16)"
docker run -d --name core-v2-scratch -e POSTGRES_PASSWORD="$SCRATCH_PW" -e POSTGRES_DB=core_v2_scratch -p 55432:5432 postgres:16

export CORE_V2_DATABASE_URL="postgresql://postgres:${SCRATCH_PW}@127.0.0.1:55432/core_v2_scratch"

# 2. Generate the isolated Prisma Client (outputs to core-v2/generated/client — gitignored)
npx prisma generate --schema=core-v2/prisma/schema.prisma

# 3. Apply the baseline + SQL-invariants migrations to the empty database
npx prisma migrate deploy --schema=core-v2/prisma/schema.prisma

# 4. Confirm no drift between the applied DB and the schema
npx prisma migrate diff --from-url "$CORE_V2_DATABASE_URL" --to-schema-datamodel core-v2/prisma/schema.prisma --script
# → should print "-- This is an empty migration."

# 5. Run the Core v2 test suites
npx jest --config jest.unit.config.js __tests__/architecture/core-v2-legacy-guards.test.ts __tests__/architecture/core-v2-client-authority-guard.test.ts
npx jest --config jest.core-v2.config.js   # Golden Empty DB, negative tests, client guards, RAG independence

# 6. Tear down
docker rm -f core-v2-scratch
```

CI runs the exact same sequence in `core-v2-foundation` (`.github/workflows/ci.yml`) against its own disposable Postgres service container — see that job for the canonical, always-current version of these steps.

## Layout

- `prisma/schema.prisma` — the schema. `prisma/migrations/0001_core_v2_baseline` is generated verbatim from it (`prisma migrate diff --from-empty`); `0002_core_v2_sql_invariants` adds the `CHECK`/partial-unique-index invariants Prisma's DSL can't express.
- `../lib/core-v2/client.ts` — the only supported way to obtain a Core v2 database connection (fail-closed on missing/colliding `CORE_V2_DATABASE_URL`).
- `../lib/core-v2/repositories/` — minimal repository layer, one file per model family, no framework. Nothing outside `lib/core-v2/**`/`core-v2/**`/`scripts/core-v2/**`/`__tests__/core-v2/**` may import from any of them — enforced by `__tests__/architecture/core-v2-legacy-guards.test.ts`'s `CORE_V2_MUST_NOT_BE_IMPORTED_BY_LIVE_RUNTIME` guard.
- `../__tests__/core-v2/golden-empty-db.test.ts` — THE reference test: full lifecycle from an empty database.
- `../__tests__/core-v2/negative-golden.test.ts` — proves each invariant is actually enforced, not just documented.

## Operational domain (migration 0006, `lib/core-v2/services/`)

The foundation is now completed by the operational domain — still **not** wired into any user-facing route (the `CORE_V2_MUST_NOT_BE_IMPORTED_BY_LIVE_RUNTIME` guard is unchanged); the staff API layer is the next, dependent increment.

- **Authorities**: `User.accountStatus` (PENDING_ACTIVATION / ACTIVE / SUSPENDED / DISABLED) is the account-state authority; `activatedAt` is a derived timestamp. `Invitation` has its own lifecycle (hashed token, TTL, single use, at most one open per user). `AuditEvent` is append-only at the DB level (trigger). Enrollment is created `PENDING` and only an explicit `approveEnrollment` makes it `ACTIVE`.
- **Race-safe invariants** (partial unique indexes, migration 0006): one CURRENT academic year, one primary contact per household, one open invitation per user, case-insensitive email uniqueness — proven under real concurrency in `__tests__/core-v2/services/concurrency.test.ts` with an open-transaction barrier (no timing luck).
- **RBAC**: `lib/core-v2/rbac.ts` is the only place a role is compared; `CORE_V2_NO_INLINE_RBAC` fails the build otherwise. ADMIN-only: `ACCOUNT_SUSPEND`, `ACCOUNT_REACTIVATE`, `AUDIT_READ`.
- **Services** (`lib/core-v2/services/index.ts`): every operation validates input (zod), checks a capability, runs in one transaction, appends its audit rows inside that transaction, and throws only the `lib/core-v2/errors.ts` taxonomy (VALIDATION / FORBIDDEN / NOT_FOUND / CONFLICT / INVALID_STATE) for business outcomes.
- **Configuration (no defaults, fail-closed)**: `CORE_V2_ORGANIZATION_TIMEZONE` (IANA zone captured on each PlanningSeries), `CORE_V2_INVITATION_TTL_HOURS` and `CORE_V2_PASSWORD_RESET_TTL_MINUTES` — see `lib/core-v2/config.ts`. Academic-year dates are configured input at creation, never derived from a built-in calendar.
- **Database identity generation** is now 3; a client built from this schema refuses a generation-2 database.

Run the operational-domain suites exactly like the foundation ones (step 5 above) with the two configuration variables set; CI's `core-v2-foundation` job does.

## HTTP surface and staff UI (`app/api/v2/**`, `components/dashboard/core-v2/**`)

- `app/api/v2/staff/**` is the **only** live-runtime location allowed to bind Core v2 (guard `CORE_V2_MUST_NOT_BE_IMPORTED_BY_LIVE_RUNTIME`). Every route goes through `lib/core-v2/http/staff-route.ts`: correlation id, CSRF, session, Core v2 client (**503 `CORE_V2_UNAVAILABLE`** when `CORE_V2_DATABASE_URL` is unset — no v1 fallback), explicit session→actor mapping (the Core v2 `users` row with the same id is the role/state authority), one error envelope. `POST /api/v2/auth/activate` is the public, rate-limited activation endpoint.
- The staff workspace lives at `/dashboard/assistante/familles` and `/dashboard/admin/familles` (+ `/annees`). It talks only to `/api/v2` (never imports Core v2 code), offers each action only when `/api/v2/staff/me` grants the capability, checks duplicates before creating a person, paginates and searches server-side, announces every outcome inline (`role="status"` / `role="alert"`), and reports success only on a 2xx envelope.
- On a deployment without `CORE_V2_DATABASE_URL`, these pages render the 503 explanation — they never show mock data.

## Related

- `docs/architecture/adr/0001-core-v2-single-source-of-truth.md` — the decision record.
- `docs/audits/core-v2-canonical-architecture.md` — full audit report, mission checklist, and the §34 correction note with the actual current PR status.
- `scripts/core-v2/generate-roster-candidates.ts` — real, runnable tool that classifies students against genuine contractual 2026-2027 signals (never account-creation recency alone). Read-only; writes nothing to any database.
- `scripts/core-v2/extract-to-core-v2.ts` — design-time skeleton for the eventual one-shot migration extractor. Deliberately throws `NOT_IMPLEMENTED` — it must not run until a roster is explicitly approved and each extraction function is implemented and reviewed separately. **Unchanged by this foundation PR — still fail-closed.**

Nothing in this directory authorizes a production migration, a database creation, or a data deletion. No legacy student is migrated by anything here.
