/**
 * Pré-vol opérateur de la migration `student_academic_enrollments`.
 *
 * La migration destructive porte sa PROPRE barrière : elle refuse de supprimer
 * `students.specialties` s'il reste une valeur historique sans correspondance.
 * Ce script ne protège donc rien — il DIAGNOSTIQUE, en amont, pour qu'un
 * opérateur sache ce qu'il aura à arbitrer avant de lancer le déploiement.
 *
 *   DATABASE_URL=... npx tsx scripts/curriculum/verify-legacy-specialties.ts
 *
 * Sortie : un objet JSON sur stdout, et un code de sortie non nul si un
 * arbitrage humain est nécessaire.
 *
 * Aucune donnée nominative n'est écrite : les élèves ne sont désignés que par
 * une empreinte tronquée de leur identifiant, suffisante pour recouper deux
 * exécutions sans exposer la base.
 */

import { createHash } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { findCourseByLegacySubject } from '@/lib/curriculum/catalog';

/** Valeurs historiques que le catalogue reproduit par dérivation. */
const REDUNDANT_LEGACY_CORE: Record<string, readonly string[]> = {
  QUATRIEME: ['MATHEMATIQUES', 'FRANCAIS'],
  TROISIEME: ['MATHEMATIQUES', 'FRANCAIS'],
  SECONDE: ['MATHEMATIQUES', 'FRANCAIS'],
  PREMIERE: ['FRANCAIS'],
  TERMINALE: ['PHILOSOPHIE', 'HISTOIRE_GEO'],
};

export type LegacyClassification = 'MIGRATED_CHOICE' | 'REDUNDANT_LEGACY_CORE' | 'UNRESOLVED';

/**
 * Classe une valeur historique. Reproduit exactement la logique des deux
 * migrations SQL ; un test d'intégrité vérifie qu'elles restent alignées.
 */
export function classifyLegacySpecialty(
  legacySubject: string,
  gradeLevel: string,
): LegacyClassification {
  if (gradeLevel === 'PREMIERE' || gradeLevel === 'TERMINALE') {
    if (findCourseByLegacySubject(legacySubject, gradeLevel, 'SPECIALTY')) return 'MIGRATED_CHOICE';
    if (findCourseByLegacySubject(legacySubject, gradeLevel, 'OPTION')) return 'MIGRATED_CHOICE';
  }
  if (REDUNDANT_LEGACY_CORE[gradeLevel]?.includes(legacySubject)) return 'REDUNDANT_LEGACY_CORE';
  return 'UNRESOLVED';
}

/** Empreinte courte et stable, non réversible, pour recouper sans exposer. */
function opaque(studentId: string): string {
  return createHash('sha256').update(studentId).digest('hex').slice(0, 12);
}

interface LegacyRow {
  id: string;
  gradeLevel: string;
  specialties: string[];
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // Après migration, la colonne n'existe plus : le dire clairement plutôt que
    // de laisser remonter une erreur SQL brute à l'opérateur.
    const [{ present }] = await prisma.$queryRaw<{ present: boolean }[]>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students' AND column_name = 'specialties'
      ) AS present
    `);

    if (!present) {
      process.stdout.write(
        `${JSON.stringify(
          {
            check: 'LEGACY_SPECIALTIES_PREFLIGHT',
            status: 'ALREADY_MIGRATED',
            detail: "la colonne students.specialties n'existe plus : la reprise a déjà été appliquée",
            destructiveMigrationWouldProceed: true,
          },
          null,
          2,
        )}\n`,
      );
      process.exitCode = 0;
      return;
    }

    // La colonne n'existe plus dans le client généré : une requête brute est
    // nécessaire. Elle est constante et sans paramètre interpolé.
    const rows = await prisma.$queryRaw<LegacyRow[]>(Prisma.sql`
      SELECT id, "gradeLevel"::text AS "gradeLevel", specialties::text[] AS specialties
      FROM students
      WHERE array_length(specialties, 1) > 0
    `);

    const counts = { MIGRATED_CHOICE: 0, REDUNDANT_LEGACY_CORE: 0, UNRESOLVED: 0 };
    const unresolved: { student: string; gradeLevel: string; subject: string }[] = [];

    for (const row of rows) {
      for (const subject of row.specialties) {
        const classification = classifyLegacySpecialty(subject, row.gradeLevel);
        counts[classification] += 1;
        if (classification === 'UNRESOLVED') {
          unresolved.push({ student: opaque(row.id), gradeLevel: row.gradeLevel, subject });
        }
      }
    }

    const ready = unresolved.length === 0;
    process.stdout.write(
      `${JSON.stringify(
        {
          check: 'LEGACY_SPECIALTIES_PREFLIGHT',
          studentsWithLegacyValues: rows.length,
          counts,
          unresolved,
          destructiveMigrationWouldProceed: ready,
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = ready ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
