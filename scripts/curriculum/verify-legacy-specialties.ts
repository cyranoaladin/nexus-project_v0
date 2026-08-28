/**
 * Pré-vol de la migration `student_academic_enrollments`.
 *
 * La reprise de `students.specialties` ne devine RIEN : une valeur historique
 * sans correspondance univoque n'est pas migrée. Ce script se connecte à une
 * base et énumère précisément ces valeurs, AVANT que la colonne ne soit
 * supprimée, pour qu'aucune donnée ne disparaisse en silence.
 *
 * À exécuter sur une copie de la base cible avant d'appliquer la migration :
 *   DATABASE_URL=... npx tsx scripts/curriculum/verify-legacy-specialties.ts
 *
 * Sortie :
 *   LEGACY_SPECIALTIES_FULLY_MAPPABLE=true|false
 * Un `false` signifie qu'un arbitrage humain est requis avant de migrer.
 */

import { PrismaClient } from '@prisma/client';
import { findCourseByLegacySubject } from '@/lib/curriculum/catalog';

/**
 * Reproduit la correspondance de la migration SQL.
 * Un test d'intégrité vérifie que les deux restent alignées.
 */
export function mapLegacySpecialty(
  legacySubject: string,
  gradeLevel: string,
): { courseKey: string; kind: string } | null {
  if (gradeLevel !== 'PREMIERE' && gradeLevel !== 'TERMINALE') return null;

  const asSpecialty = findCourseByLegacySubject(legacySubject, gradeLevel, 'SPECIALTY');
  if (asSpecialty) return { courseKey: asSpecialty.courseKey, kind: 'SPECIALTY' };

  const asOption = findCourseByLegacySubject(legacySubject, gradeLevel, 'OPTION');
  if (asOption) return { courseKey: asOption.courseKey, kind: 'OPTION' };

  const asCore = findCourseByLegacySubject(legacySubject, gradeLevel, 'CORE');
  if (asCore) return { courseKey: asCore.courseKey, kind: 'CORE' };

  return null;
}

interface LegacyRow {
  id: string;
  gradeLevel: string;
  specialties: string[];
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // Requête brute : la colonne n'existe plus dans le client Prisma généré.
    const rows = await prisma.$queryRawUnsafe<LegacyRow[]>(
      'SELECT id, "gradeLevel"::text AS "gradeLevel", specialties::text[] AS specialties FROM students WHERE array_length(specialties, 1) > 0',
    );

    const unmappable: { studentId: string; gradeLevel: string; subject: string }[] = [];
    let mapped = 0;

    for (const row of rows) {
      for (const subject of row.specialties) {
        if (mapLegacySpecialty(subject, row.gradeLevel)) mapped += 1;
        else unmappable.push({ studentId: row.id, gradeLevel: row.gradeLevel, subject });
      }
    }

    console.log(`Élèves porteurs de spécialités héritées : ${rows.length}`);
    console.log(`Valeurs reprises automatiquement        : ${mapped}`);
    console.log(`Valeurs sans correspondance univoque    : ${unmappable.length}`);

    if (unmappable.length > 0) {
      console.log('\nDétail des valeurs nécessitant un arbitrage humain :');
      for (const entry of unmappable) {
        console.log(`  - élève ${entry.studentId} (${entry.gradeLevel}) : ${entry.subject}`);
      }
      console.log(
        '\nCes valeurs ne seront PAS migrées. Une langue vivante, par exemple, ne permet\n' +
          'pas de trancher entre LVA et LVB : il faut la renseigner explicitement.',
      );
    }

    console.log(`\nLEGACY_SPECIALTIES_FULLY_MAPPABLE=${unmappable.length === 0}`);
    process.exitCode = unmappable.length === 0 ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
