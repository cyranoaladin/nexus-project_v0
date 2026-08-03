import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('A90.3 immutable report materialization schema', () => {
  const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(resolve(
    process.cwd(),
    'prisma/migrations/20260803120000_add_immutable_report_materializations/migration.sql',
  ), 'utf8');

  test('keeps ReportArtifact and adds one materialization per revision and audience', () => {
    expect(schema).toMatch(/model ReportArtifact[\s\S]*@@unique\(\[assessmentAttemptId\]\)/);
    expect(schema).toMatch(/model ReportMaterialization[\s\S]*revisionId\s+String\s+@unique/);
    expect(schema).toMatch(/model ReportAudienceArtifact[\s\S]*@@unique\(\[materializationId, audience\]\)/);
    expect(schema).toMatch(/pdf\s+Bytes\?/);
  });

  test('migration is additive and makes both rendered tables insert-only', () => {
    expect(migration).toContain('CREATE TABLE "canonical_report_materializations"');
    expect(migration).toContain('CREATE TABLE "canonical_report_audience_artifacts"');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "canonical_report_materializations"');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "canonical_report_audience_artifacts"');
    expect(migration).not.toMatch(/DROP\s+(?:TABLE|COLUMN)/i);
  });
});
