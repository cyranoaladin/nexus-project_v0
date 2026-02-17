/**
 * Backfill Script — Canonical Domain Scores for Historical Assessments
 *
 * For each COMPLETED MATHS assessment in the database, this script:
 *   1. Reads existing domain_scores rows
 *   2. Identifies missing canonical domains (from CANONICAL_DOMAINS_MATHS)
 *   3. Inserts missing domains with score=0
 *
 * This ensures cohort analytics and dashboard aggregation work on a stable
 * domain set, even for assessments persisted before the canonical fix.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/backfill-canonical-domains.ts
 *
 * Safe to run multiple times (idempotent — only inserts missing domains).
 */

import { PrismaClient } from '@prisma/client';

const CANONICAL_DOMAINS_MATHS = [
  'analyse',
  'combinatoire',
  'geometrie',
  'logExp',
  'probabilites',
] as const;

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('[Backfill] Starting canonical domain backfill...');

    // Find all COMPLETED/SCORED/GENERATING MATHS assessments
    const assessments = await prisma.$queryRawUnsafe<{ id: string; subject: string }[]>(
      `SELECT "id", "subject" FROM "assessments"
       WHERE "subject" = 'MATHS' AND "status" IN ('COMPLETED', 'SCORED', 'GENERATING')`
    );

    console.log(`[Backfill] Found ${assessments.length} MATHS assessments to check.`);

    let totalInserted = 0;
    let assessmentsFixed = 0;

    for (const assessment of assessments) {
      // Get existing domain_scores
      const existing = await prisma.$queryRawUnsafe<{ domain: string }[]>(
        `SELECT "domain" FROM "domain_scores" WHERE "assessmentId" = $1`,
        assessment.id
      );

      const existingDomains = new Set(existing.map((r) => r.domain));
      const missing = CANONICAL_DOMAINS_MATHS.filter((d) => !existingDomains.has(d));

      if (missing.length > 0) {
        for (const domain of missing) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "domain_scores" ("id", "assessmentId", "domain", "score", "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, 0, NOW())`,
            assessment.id,
            domain
          );
          totalInserted++;
        }
        assessmentsFixed++;
        console.log(`  [${assessment.id}] +${missing.length} domains: ${missing.join(', ')}`);
      }
    }

    console.log(`\n[Backfill] Done.`);
    console.log(`  Assessments checked: ${assessments.length}`);
    console.log(`  Assessments fixed:   ${assessmentsFixed}`);
    console.log(`  Domains inserted:    ${totalInserted}`);
  } catch (error) {
    console.error('[Backfill] FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
