/**
 * Contrôle d'intégrité des inscriptions académiques en base.
 *
 * `courseKey` référence un catalogue versionné en données, pas une table SQL :
 * aucune clé étrangère ne peut donc garantir sa validité. Ce contrôle comble
 * cet écart en confrontant les lignes réellement présentes au catalogue.
 *
 *   DATABASE_URL=... npx tsx scripts/curriculum/verify-enrollment-integrity.ts
 *
 * Sortie JSON, code de sortie non nul si une anomalie est détectée.
 * Aucune donnée nominative n'est écrite.
 */

import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { CURRICULUM_VERSION, getCourse } from '@/lib/curriculum/catalog';

type Anomaly =
  | 'UNKNOWN_COURSE_KEY'
  | 'KIND_MISMATCH'
  | 'NON_CHOICE_STORED'
  | 'UNKNOWN_CURRICULUM_VERSION';

function opaque(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export interface EnrollmentIntegrityAnomaly {
  readonly anomaly: Anomaly;
  readonly student: string;
  readonly courseKey: string;
  readonly detail: string;
}

export interface EnrollmentIntegrityResult {
  readonly check: 'ENROLLMENT_INTEGRITY';
  readonly curriculumVersion: string;
  readonly rows: number;
  readonly anomalies: readonly EnrollmentIntegrityAnomaly[];
  readonly ok: boolean;
}

type EnrollmentIntegrityClient = Pick<PrismaClient, 'studentAcademicEnrollment'>;

/**
 * The reusable check itself, independent of process exit codes / stdout —
 * this is what both the CLI entrypoint below and the CI integration test
 * (real DB, both a clean-seed PASS case and an orphan-courseKey RED case)
 * call directly.
 */
export async function checkEnrollmentIntegrity(
  prisma: EnrollmentIntegrityClient,
): Promise<EnrollmentIntegrityResult> {
  const rows = await prisma.studentAcademicEnrollment.findMany({
    select: { id: true, studentId: true, courseKey: true, kind: true, curriculumVersion: true },
  });

  const anomalies: EnrollmentIntegrityAnomaly[] = [];

  for (const row of rows) {
    const course = getCourse(row.courseKey);

    if (!course) {
      anomalies.push({
        anomaly: 'UNKNOWN_COURSE_KEY',
        student: opaque(row.studentId),
        courseKey: row.courseKey,
        detail: 'absente du catalogue',
      });
      continue;
    }

    if (course.kind !== 'SPECIALTY' && course.kind !== 'OPTION') {
      anomalies.push({
        anomaly: 'NON_CHOICE_STORED',
        student: opaque(row.studentId),
        courseKey: row.courseKey,
        detail: `${course.kind} est dérivé, il ne doit jamais être stocké`,
      });
      continue;
    }

    if (course.kind !== row.kind) {
      anomalies.push({
        anomaly: 'KIND_MISMATCH',
        student: opaque(row.studentId),
        courseKey: row.courseKey,
        detail: `ligne=${row.kind}, catalogue=${course.kind}`,
      });
    }

    if (row.curriculumVersion !== CURRICULUM_VERSION) {
      anomalies.push({
        anomaly: 'UNKNOWN_CURRICULUM_VERSION',
        student: opaque(row.studentId),
        courseKey: row.courseKey,
        detail: `ligne=${row.curriculumVersion}, courant=${CURRICULUM_VERSION}`,
      });
    }
  }

  return {
    check: 'ENROLLMENT_INTEGRITY',
    curriculumVersion: CURRICULUM_VERSION,
    rows: rows.length,
    anomalies,
    ok: anomalies.length === 0,
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const result = await checkEnrollmentIntegrity(prisma);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
