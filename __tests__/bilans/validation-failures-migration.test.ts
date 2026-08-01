import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ReportRevision validationFailures persistence', () => {
  it('is additive, defaults empty, and blocks validated publication paths', () => {
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const migration = readFileSync(resolve(
      process.cwd(),
      'prisma/migrations/20260801090000_add_report_revision_validation_failures/migration.sql',
    ), 'utf8');

    expect(schema).toMatch(/validationFailures\s+String\[\]\s+@default\(\[\]\)/);
    expect(migration).toContain('ADD COLUMN "validationFailures" TEXT[]');
    expect(migration).toMatch(/cardinality\([^)]*"validationFailures"[^)]*\)\s*=\s*0/);
    expect(migration).not.toMatch(/\b(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)\b/i);
  });
});
