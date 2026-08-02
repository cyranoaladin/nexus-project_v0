import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION = resolve(
  process.cwd(),
  'prisma/migrations/20260802120000_add_canonical_attempt_passation_fields/migration.sql',
);

describe('CanonicalAssessmentAttempt passation migration', () => {
  const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(MIGRATION, 'utf8');

  test('requires application-provided seed and expiry and defaults lifecycle to DRAFT', () => {
    const model = schema.match(/model CanonicalAssessmentAttempt \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(model).toMatch(/status\s+CanonicalAssessmentAttemptStatus\s+@default\(DRAFT\)/);
    expect(model).toMatch(/seed\s+String\s*\n/);
    expect(model).not.toMatch(/seed\s+String\s+@default/);
    expect(model).toMatch(/startedAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(model).toMatch(/expiresAt\s+DateTime\s*\n/);
    expect(model).not.toMatch(/expiresAt\s+DateTime\s+@default/);
  });

  test('adds and backfills only the Canonical attempt columns', () => {
    for (const column of ['seed', 'startedAt', 'expiresAt']) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
      expect(migration).toContain(`ALTER COLUMN "${column}" SET NOT NULL`);
    }
    expect(migration).toContain('incompatible canonical passation column type');
    expect(migration).toContain('"seed" = \'legacy:\' || "id"');
    expect(migration).toContain('ALTER COLUMN "status" SET DEFAULT \'DRAFT\'');
    expect(migration).not.toMatch(/\b(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE|RENAME)\b/i);
  });

  test('seals seed and passation timestamps after submission', () => {
    expect(migration).toContain('NEW."seed" IS DISTINCT FROM OLD."seed"');
    expect(migration).toContain('NEW."startedAt" IS DISTINCT FROM OLD."startedAt"');
    expect(migration).toContain('NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"');
    expect(migration).toContain('submitted canonical assessment provenance is immutable');
  });
});
