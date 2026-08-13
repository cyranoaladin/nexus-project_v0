import { readFileSync } from 'node:fs';

describe('A86 worker idempotence migration', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const regenMigration = readFileSync(
    'prisma/migrations/20260814090000_add_report_regeneration/migration.sql',
    'utf8',
  );
  const migration = readFileSync(
    'prisma/migrations/20260802170000_harden_canonical_scoring_worker/migration.sql',
    'utf8',
  );

  it('enforces one score, artifact and scoring revision per attempt chain', () => {
    expect(schema).toMatch(/model ScoreSnapshot[\s\S]*@@unique\(\[assessmentAttemptId\]\)/);
    expect(schema).toMatch(/model ReportArtifact[\s\S]*@@unique\(\[assessmentAttemptId\]\)/);
    // Depuis la régénération (13/08/2026) : une génération de rendu par
    // snapshot ET par version de règle — le snapshot reste unique par attempt,
    // la révision est unique par [snapshot, génération].
    expect(schema).toMatch(/model ReportRevision[\s\S]*@@unique\(\[scoreSnapshotId, generation\]\)/);
    expect(migration).toContain('canonical_score_snapshots_assessmentAttemptId_key');
    expect(migration).toContain('canonical_report_artifacts_assessmentAttemptId_key');
    expect(migration).toContain('canonical_report_revisions_scoreSnapshotId_key');
    expect(regenMigration).toContain('canonical_report_revisions_scoreSnapshotId_generation_key');
  });

  it('keeps validation failures blocked and permits only a traced rejection', () => {
    expect(migration).toContain("NEW.\"status\" IN ('COACH_VALIDATED', 'REJECTED')");
    expect(migration).toContain("ELSE 'REJECTED'::\"ReportReviewDecision\"");
    expect(migration).toContain('canonical report revisions are append-only');
  });
});
