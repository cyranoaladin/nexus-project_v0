import { readFileSync } from 'node:fs';

describe('A86 worker idempotence migration', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const migration = readFileSync(
    'prisma/migrations/20260802170000_harden_canonical_scoring_worker/migration.sql',
    'utf8',
  );

  it('enforces one score, artifact and scoring revision per attempt chain', () => {
    expect(schema).toMatch(/model ScoreSnapshot[\s\S]*@@unique\(\[assessmentAttemptId\]\)/);
    expect(schema).toMatch(/model ReportArtifact[\s\S]*@@unique\(\[assessmentAttemptId\]\)/);
    expect(schema).toMatch(/model ReportRevision[\s\S]*@@unique\(\[scoreSnapshotId\]\)/);
    expect(migration).toContain('canonical_score_snapshots_assessmentAttemptId_key');
    expect(migration).toContain('canonical_report_artifacts_assessmentAttemptId_key');
    expect(migration).toContain('canonical_report_revisions_scoreSnapshotId_key');
  });

  it('keeps validation failures blocked and permits only a traced rejection', () => {
    expect(migration).toContain("NEW.\"status\" IN ('COACH_VALIDATED', 'REJECTED')");
    expect(migration).toContain("ELSE 'REJECTED'::\"ReportReviewDecision\"");
    expect(migration).toContain('canonical report revisions are append-only');
  });
});
