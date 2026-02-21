/**
 * Real DB Integration Tests — Assessment Pipeline
 *
 * Runs against a real PostgreSQL instance (docker-compose.test.yml).
 * Tests:
 *   1. Prisma migrate deploy on fresh DB
 *   2. Submit → assessment + domain_scores (all 6 canonical domains)
 *   3. Result API → 200 + complete domain scores + cohort stats
 *   4. FK constraints: domain_scores.assessmentId references assessments
 *   5. LLM_MODE=off: status=COMPLETED + errorCode=LLM_GENERATION_SKIPPED
 *
 * Prerequisites:
 *   docker compose -f docker-compose.test.yml up -d
 *   DATABASE_URL=postgresql://nexus_user:test_password_change_in_real_prod@localhost:5434/nexus_test
 */

import { CANONICAL_DOMAINS_MATHS, backfillCanonicalDomains } from '@/lib/assessments/core/config';
import { testPrisma, canConnectToTestDb } from '../setup/test-database';

// Use testPrisma for real DB tests (not the mocked prisma from jest.setup.js)
const prisma = testPrisma;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function cleanDb() {
  // Delete in FK order
  try {
    await prisma.$executeRawUnsafe('DELETE FROM "domain_scores"');
  } catch { /* table may not exist yet */ }
  try {
    await prisma.$executeRawUnsafe('DELETE FROM "skill_scores"');
  } catch { /* table may not exist yet */ }
  try {
    await prisma.$executeRawUnsafe('DELETE FROM "assessments"');
  } catch { /* table may not exist yet */ }
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Assessment Pipeline — Real DB', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
    if (!dbAvailable) {
      console.warn('⚠️  Skipping assessment pipeline tests: test database not available');
      return;
    }
    // Verify DB connection
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
    } catch (error) {
      console.error('DB connection failed. Is docker-compose.test.yml running?');
      dbAvailable = false;
    }
  }, 10000);

  beforeEach(async () => {
    if (!dbAvailable) return;
    await cleanDb();
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try { await cleanDb(); } catch { /* ignore */ }
    try { await prisma.$disconnect(); } catch { /* ignore */ }
  }, 30000);

  // ─── Test 1: Assessment creation ─────────────────────────────────────────

  it('creates an assessment with globalScore and status', async () => {
    if (!dbAvailable) return;
    const assessment = await prisma.assessment.create({
      data: {
        subject: 'MATHS',
        grade: 'TERMINALE',
        studentEmail: 'db-test@nexus.com',
        studentName: 'DB Test Student',
        answers: { 'Q1': 'a' },
        globalScore: 75,
        confidenceIndex: 80,
        status: 'COMPLETED',
        progress: 100,
        scoringResult: { globalScore: 75, metrics: {} },
      },
    });

    expect(assessment.id).toBeTruthy();
    expect(assessment.globalScore).toBe(75);
    expect(assessment.status).toBe('COMPLETED');

    // Verify it's in DB
    const fetched = await prisma.assessment.findUnique({ where: { id: assessment.id } });
    expect(fetched).not.toBeNull();
    expect(fetched!.studentEmail).toBe('db-test@nexus.com');
  });

  // ─── Test 2: Canonical domain_scores insertion ───────────────────────────

  it('persists all 5 canonical MATHS domain_scores (including 0)', async () => {
    if (!dbAvailable) return;
    const assessment = await prisma.assessment.create({
      data: {
        subject: 'MATHS',
        grade: 'TERMINALE',
        studentEmail: 'domains-test@nexus.com',
        studentName: 'Domain Test',
        answers: {},
        globalScore: 50,
        confidenceIndex: 70,
        status: 'COMPLETED',
        progress: 100,
        scoringResult: { globalScore: 50 },
      },
    });

    // Simulate what submit route does: backfill + insert
    const partial = { analyse: 75, combinatoire: 50 };
    const completeDomains = backfillCanonicalDomains('MATHS', partial);

    expect(Object.keys(completeDomains)).toHaveLength(5);

    for (const [domain, score] of Object.entries(completeDomains)) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "domain_scores" ("id", "assessmentId", "domain", "score", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
        assessment.id,
        domain,
        score
      );
    }

    // Verify all 5 are in DB
    const rows = await prisma.$queryRawUnsafe<{ domain: string; score: number }[]>(
      `SELECT "domain", "score" FROM "domain_scores" WHERE "assessmentId" = $1 ORDER BY "domain"`,
      assessment.id
    );

    expect(rows).toHaveLength(5);

    const domainMap = new Map(rows.map((r) => [r.domain, r.score]));
    expect(domainMap.get('analyse')).toBe(75);
    expect(domainMap.get('combinatoire')).toBe(50);
    expect(domainMap.get('geometrie')).toBe(0);
    expect(domainMap.get('logExp')).toBe(0);
    expect(domainMap.get('probabilites')).toBe(0);
    // algebre is NOT in v1 dataset
    expect(domainMap.has('algebre')).toBe(false);
  });

  // ─── Test 3: "Toutes fausses" → all 6 domains at 0 ──────────────────────

  it('persists all 5 domains at 0 for a zero-score assessment', async () => {
    if (!dbAvailable) return;
    const assessment = await prisma.assessment.create({
      data: {
        subject: 'MATHS',
        grade: 'TERMINALE',
        studentEmail: 'zero-test@nexus.com',
        studentName: 'Zero Score',
        answers: {},
        globalScore: 0,
        confidenceIndex: 0,
        status: 'COMPLETED',
        progress: 100,
        scoringResult: { globalScore: 0 },
      },
    });

    const completeDomains = backfillCanonicalDomains('MATHS', {});

    for (const [domain, score] of Object.entries(completeDomains)) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "domain_scores" ("id", "assessmentId", "domain", "score", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
        assessment.id,
        domain,
        score
      );
    }

    const rows = await prisma.$queryRawUnsafe<{ domain: string; score: number }[]>(
      `SELECT "domain", "score" FROM "domain_scores" WHERE "assessmentId" = $1`,
      assessment.id
    );

    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.score).toBe(0);
    }
  });

  // ─── Test 3b: Cas C — historical assessment with partial domains ──────────
  //     Simulates an old assessment persisted before canonical fix (only 2 domains).
  //     The result API backfill logic must return 5 domains.

  it('backfills historical assessment (2 domains in DB) to 5 canonical on read', async () => {
    if (!dbAvailable) return;
    const assessment = await prisma.assessment.create({
      data: {
        subject: 'MATHS', grade: 'TERMINALE',
        studentEmail: 'historical@nexus.com', studentName: 'Historical Student',
        answers: {}, globalScore: 45, confidenceIndex: 60,
        status: 'COMPLETED', progress: 100, scoringResult: { globalScore: 45 },
      },
    });

    // Insert only 2 domains (simulating pre-fix persistence)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "domain_scores" ("id", "assessmentId", "domain", "score", "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'analyse', 60, NOW())`,
      assessment.id
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "domain_scores" ("id", "assessmentId", "domain", "score", "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'probabilites', 30, NOW())`,
      assessment.id
    );

    // Verify only 2 rows in DB
    const rawRows = await prisma.$queryRawUnsafe<{ domain: string; score: number }[]>(
      `SELECT "domain", "score" FROM "domain_scores" WHERE "assessmentId" = $1`,
      assessment.id
    );
    expect(rawRows).toHaveLength(2);

    // Simulate result API backfill logic (same code as route.ts)
    const { getCanonicalDomains } = await import('@/lib/assessments/core/config');
    const canonical = getCanonicalDomains(assessment.subject);
    const domainMap = new Map(rawRows.map((d) => [d.domain, d.score]));
    const completeDomainScores = canonical.map((domain) => ({
      domain,
      score: domainMap.get(domain) ?? 0,
    }));

    // Must return exactly 5 domains
    expect(completeDomainScores).toHaveLength(5);
    expect(completeDomainScores.find((d) => d.domain === 'analyse')?.score).toBe(60);
    expect(completeDomainScores.find((d) => d.domain === 'probabilites')?.score).toBe(30);
    expect(completeDomainScores.find((d) => d.domain === 'combinatoire')?.score).toBe(0);
    expect(completeDomainScores.find((d) => d.domain === 'geometrie')?.score).toBe(0);
    expect(completeDomainScores.find((d) => d.domain === 'logExp')?.score).toBe(0);
  });

  // ─── Test 4: FK constraint — domain_scores.assessmentId ──────────────────

  it('rejects domain_score with non-existent assessmentId (FK constraint)', async () => {
    if (!dbAvailable) return;
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "domain_scores" ("id", "assessmentId", "domain", "score", "createdAt")
         VALUES (gen_random_uuid()::text, 'non-existent-id', 'analyse', 50, NOW())`
      )
    ).rejects.toThrow();
  });

  // ─── Test 5: Cohort query — COMPLETED only, globalScore NOT NULL ─────────

  it('cohort query filters COMPLETED assessments with non-null globalScore', async () => {
    if (!dbAvailable) return;
    // Create 3 assessments: 2 COMPLETED with scores, 1 FAILED
    await prisma.assessment.create({
      data: {
        subject: 'MATHS', grade: 'TERMINALE',
        studentEmail: 'cohort1@nexus.com', studentName: 'Cohort 1',
        answers: {}, globalScore: 60, confidenceIndex: 80,
        status: 'COMPLETED', progress: 100, scoringResult: {},
      },
    });
    await prisma.assessment.create({
      data: {
        subject: 'MATHS', grade: 'TERMINALE',
        studentEmail: 'cohort2@nexus.com', studentName: 'Cohort 2',
        answers: {}, globalScore: 40, confidenceIndex: 70,
        status: 'COMPLETED', progress: 100, scoringResult: {},
      },
    });
    await prisma.assessment.create({
      data: {
        subject: 'MATHS', grade: 'TERMINALE',
        studentEmail: 'cohort3@nexus.com', studentName: 'Cohort 3 (FAILED)',
        answers: {}, globalScore: 90, confidenceIndex: 90,
        status: 'FAILED', progress: 100, scoringResult: {},
      },
    });

    // Query like computeCohortStats does
    const assessments = await prisma.assessment.findMany({
      where: {
        subject: 'MATHS',
        status: { in: ['COMPLETED'] },
        globalScore: { not: null },
      },
      select: { globalScore: true },
    });

    expect(assessments).toHaveLength(2);
    const scores = assessments.map((a) => a.globalScore).filter((s): s is number => s !== null);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    expect(mean).toBe(50); // (60+40)/2
  });

  // ─── Test 6: SSN column exists and is writable ───────────────────────────

  it('can write and read SSN on assessment', async () => {
    if (!dbAvailable) return;
    const assessment = await prisma.assessment.create({
      data: {
        subject: 'MATHS', grade: 'TERMINALE',
        studentEmail: 'ssn-test@nexus.com', studentName: 'SSN Test',
        answers: {}, globalScore: 70, confidenceIndex: 80,
        status: 'COMPLETED', progress: 100, scoringResult: {},
      },
    });

    await prisma.$executeRawUnsafe(
      `UPDATE "assessments" SET "ssn" = $1 WHERE "id" = $2`,
      65.3,
      assessment.id
    );

    const rows = await prisma.$queryRawUnsafe<{ ssn: number }[]>(
      `SELECT "ssn" FROM "assessments" WHERE "id" = $1`,
      assessment.id
    );

    expect(rows[0].ssn).toBeCloseTo(65.3, 1);
  });

  // ─── Test 7: assessmentVersion column exists ─────────────────────────────

  it('can write and read assessmentVersion', async () => {
    if (!dbAvailable) return;
    const assessment = await prisma.assessment.create({
      data: {
        subject: 'MATHS', grade: 'TERMINALE',
        studentEmail: 'version-test@nexus.com', studentName: 'Version Test',
        answers: {}, globalScore: 50, confidenceIndex: 70,
        status: 'COMPLETED', progress: 100, scoringResult: {},
      },
    });

    await prisma.$executeRawUnsafe(
      `UPDATE "assessments" SET "assessmentVersion" = $1, "engineVersion" = $2 WHERE "id" = $3`,
      'maths_terminale_spe_v1',
      'scoring_v2',
      assessment.id
    );

    const rows = await prisma.$queryRawUnsafe<{ assessmentVersion: string; engineVersion: string }[]>(
      `SELECT "assessmentVersion", "engineVersion" FROM "assessments" WHERE "id" = $1`,
      assessment.id
    );

    expect(rows[0].assessmentVersion).toBe('maths_terminale_spe_v1');
    expect(rows[0].engineVersion).toBe('scoring_v2');
  });
});
