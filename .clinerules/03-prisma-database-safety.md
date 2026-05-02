# Prisma and Database Safety

## Before editing Prisma

Always inspect:
- `prisma/schema.prisma`
- existing migrations
- code that uses the affected models
- tests around the affected models
- production implications if the feature is deployed

## Rules

- Never use `prisma db push` for production migrations.
- Use migrations.
- Prefer additive migrations.
- Do not remove columns or tables without explicit approval.
- Do not rename production columns unless a migration path is written.
- For new enum values, verify PostgreSQL compatibility.
- If Prisma schema and migrations drift, create a corrective migration.
- Do not edit an already-applied migration unless explicitly instructed for a local-only state.

## Required commands after schema changes

Run:
- `npx prisma validate`
- `npx prisma generate`
- relevant tests
- `npm run typecheck` if schema types affect application code

## Production safety

Before deployment:
- backup database;
- run `npx prisma migrate deploy`;
- verify app health;
- verify affected routes manually;
- keep rollback instructions.

## Generated reports

For generated pedagogical reports, database uniqueness must prevent duplicate jobs:
- `studentId`
- `stageSlug`
- `subject`
- `kind`
- `inputChecksum`

Never rely only on frontend checks to prevent duplicates.

## EAF lifecycle fields

If working on `EafPreparationReport`, verify:
- `status`
- `completionRatio`
- `validatedAt`
- `validatedBy`

The draft save route must not allow the client to force validation.
