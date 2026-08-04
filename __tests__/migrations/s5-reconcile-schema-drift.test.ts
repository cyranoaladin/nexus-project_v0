import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260804210000_reconcile_schema_drift/migration.sql',
  ),
  'utf8',
)

describe('S5 additive schema drift reconciliation', () => {
  test('adds only CLICTOPAY and the missing copy submission unique index', () => {
    expect(migration).toMatch(
      /ALTER TYPE "InvoicePaymentMethod" ADD VALUE IF NOT EXISTS 'CLICTOPAY'/,
    )
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "copy_submissions_aiJobId_key"[\s\S]*ON "copy_submissions"\("aiJobId"\)/,
    )
    expect(migration).not.toMatch(/\b(?:DROP|DELETE|UPDATE|TRUNCATE)\b/i)
    expect(migration.match(/\bALTER\s+(?:TYPE|TABLE)\b/gi)).toHaveLength(1)
    expect(migration.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/gi)).toHaveLength(1)
  })

  test('fails explicitly before indexing duplicate non-null aiJobId values', () => {
    expect(migration).toMatch(/WHERE "aiJobId" IS NOT NULL/)
    expect(migration).toMatch(/GROUP BY "aiJobId"/)
    expect(migration).toMatch(/HAVING COUNT\(\*\) > 1/)
    expect(migration).toMatch(/IF duplicate_group_count > 0 THEN/)
    expect(migration).toMatch(/RAISE EXCEPTION/)
  })
})
