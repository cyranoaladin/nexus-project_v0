import { runExtraction, MigrationPolicy, type MigrationInputs } from '@/scripts/core-v2/extract-to-core-v2';

const fakeInputs: MigrationInputs = {
  sourceBackupSha256: 'a'.repeat(64),
  sourceSchemaFingerprint: 'fingerprint',
  targetSchemaVersion: 'v0-baseline',
  approvedRosterDigest: 'digest',
  approvedStudentIds: new Set(),
};

describe('extract-to-core-v2 skeleton', () => {
  test('refuses to run — design-time skeleton, not wired to any database yet', async () => {
    await expect(runExtraction(fakeInputs)).rejects.toThrow('NOT_IMPLEMENTED');
  });

  test('policy never auto-migrates ambiguous/unresolved legacy assignment states', () => {
    const doesNot = MigrationPolicy.doesNotMigrateAutomatically.join(' ');
    expect(doesNot).toMatch(/BACKFILL_UNRESOLVED/);
    expect(doesNot).toMatch(/BACKFILL_AMBIGUOUS/);
  });

  test('policy requires assignments to be rebuilt from current truth, not copied wholesale from legacy scope state', () => {
    const migrates = MigrationPolicy.migrates.join(' ');
    expect(migrates).toMatch(/REBUILD/);
    expect(migrates).toMatch(/jamais copie de courseScopeState/);
  });
});
