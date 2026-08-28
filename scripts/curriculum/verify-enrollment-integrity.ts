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

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.studentAcademicEnrollment.findMany({
      select: { id: true, studentId: true, courseKey: true, kind: true, curriculumVersion: true },
    });

    const anomalies: { anomaly: Anomaly; student: string; courseKey: string; detail: string }[] = [];

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

    process.stdout.write(
      `${JSON.stringify(
        {
          check: 'ENROLLMENT_INTEGRITY',
          curriculumVersion: CURRICULUM_VERSION,
          rows: rows.length,
          anomalies,
          ok: anomalies.length === 0,
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = anomalies.length === 0 ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
