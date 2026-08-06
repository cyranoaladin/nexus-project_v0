import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260805100000_add_report_review_reviewer/migration.sql',
  ),
  'utf8',
)

describe('additive reviewer column on canonical_report_reviews', () => {
  test('makes coachId optional and adds a reviewerId pointing at users', () => {
    expect(migration).toMatch(/ALTER TABLE "canonical_report_reviews" ALTER COLUMN "coachId" DROP NOT NULL/)
    expect(migration).toMatch(/ALTER TABLE "canonical_report_reviews" ADD COLUMN\s+"reviewerId" TEXT/)
    expect(migration).toMatch(/FOREIGN KEY \("reviewerId"\) REFERENCES "users"\("id"\)/)
  })

  test('enforces exactly one of coachId or reviewerId, never both, never neither', () => {
    expect(migration).toMatch(/CHECK\s*\(\s*\("coachId" IS NOT NULL\)\s*(?:!=|<>)\s*\("reviewerId" IS NOT NULL\)\s*\)/)
  })

  test('is purely additive: no destructive statements', () => {
    expect(migration).not.toMatch(/\bDROP\s+COLUMN\b/i)
    expect(migration).not.toMatch(/^\s*(?:DELETE|TRUNCATE)\b/im)
    expect(migration).not.toMatch(/\bUPDATE\s+"/i)
  })
})
