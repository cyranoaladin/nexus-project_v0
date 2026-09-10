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

## Related

- `docs/architecture/adr/0001-core-v2-single-source-of-truth.md` — the decision record.
- `docs/audits/core-v2-canonical-architecture.md` — full audit report, mission checklist, and the §34 correction note with the actual current PR status.
- `scripts/core-v2/generate-roster-candidates.ts` — real, runnable tool that classifies students against genuine contractual 2026-2027 signals (never account-creation recency alone). Read-only; writes nothing to any database.
- `scripts/core-v2/extract-to-core-v2.ts` — design-time skeleton for the eventual one-shot migration extractor. Deliberately throws `NOT_IMPLEMENTED` — it must not run until a roster is explicitly approved and each extraction function is implemented and reviewed separately. **Unchanged by this foundation PR — still fail-closed.**

Nothing in this directory authorizes a production migration, a database creation, or a data deletion. No legacy student is migrated by anything here.
