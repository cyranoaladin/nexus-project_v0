import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('additive User sessionVersion migration', () => {
  it('declares a deterministic non-null monotone counter', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).toMatch(/sessionVersion\s+Int\s+@default\(0\)/)
  })

  it('adds only the safe PostgreSQL 15 column and never rewrites Users', () => {
    const sql = read('prisma/migrations/20260804120000_add_user_session_version/migration.sql')
    expect(sql).toMatch(/ALTER TABLE "users" ADD COLUMN\s+"sessionVersion" INTEGER NOT NULL DEFAULT 0/)
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE|DROP|TRUNCATE)\b/i)
    expect(sql.match(/ALTER TABLE/g)).toHaveLength(1)
  })
})
