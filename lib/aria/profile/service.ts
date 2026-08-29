/**
 * ARIA Learning Profile Service.
 *
 * Seul point d'écriture et de lecture du profil pédagogique ARIA.
 *
 * Invariants stricts :
 * - N'écrit QUE dans la table aria_learning_profiles.
 * - Ne modifie JAMAIS Student, ni ses inscriptions scolaires, ni ses abonnements.
 * - ARIA_SELECTION_IS_NOT_ACADEMIC_TRUTH=PASS.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { isKnownCourseKey } from '@/lib/curriculum/catalog';
import { resolveStudentCourses } from '@/lib/curriculum/enrollment';
import type { StudentWithEnrollments } from '../access';
import type { AriaCourseKey, AriaLearningProfileDTO } from '../contracts';

/**
 * Récupère le profil d'apprentissage ARIA d'un élève.
 */
export async function getLearningProfile(studentId: string): Promise<AriaLearningProfileDTO | null> {
  const profile = await prisma.ariaLearningProfile.findUnique({
    where: { studentId },
  });

  if (!profile) return null;

  return {
    studentId: profile.studentId,
    selectedCourseKeys: (profile.selectedCourseKeys as string[]) || [],
    uiPreferences: (profile.uiPreferences as Record<string, unknown>) || {},
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/**
 * Crée ou met à jour le profil d'apprentissage ARIA d'un élève.
 */
export async function upsertLearningProfile(
  studentId: string,
  data: {
    selectedCourseKeys?: readonly AriaCourseKey[];
    uiPreferences?: Record<string, unknown>;
  },
  studentValidationContext?: StudentWithEnrollments
): Promise<AriaLearningProfileDTO> {
  let validKeys: string[] | undefined;

  if (data.selectedCourseKeys !== undefined) {
    // 1. Validation : chaque clé doit exister dans le catalogue
    for (const key of data.selectedCourseKeys) {
      if (!isKnownCourseKey(key)) {
        throw new Error(`Clé de cours inconnue dans le catalogue : ${key}`);
      }
    }

    // 2. Si le contexte élève est fourni, vérification que les cours sont académiquement pertinents
    if (studentValidationContext) {
      const academicCourses = resolveStudentCourses(
        {
          gradeLevel: studentValidationContext.gradeLevel,
          academicTrack: studentValidationContext.academicTrack,
          stmgPathway: studentValidationContext.stmgPathway ?? null,
        },
        studentValidationContext.academicEnrollments ?? []
      );
      const relevantKeys = new Set(
        academicCourses
          .filter((c) => c.academicStatus !== 'NOT_ENROLLED')
          .map((c) => c.course.courseKey)
      );

      for (const key of data.selectedCourseKeys) {
        if (!relevantKeys.has(key)) {
          throw new Error(`Le cours ${key} n'est pas au programme suivi par l'élève.`);
        }
      }
    }

    validKeys = Array.from(new Set(data.selectedCourseKeys));
  }

  const existing = await prisma.ariaLearningProfile.findUnique({
    where: { studentId },
  });

  const selectedJson = validKeys !== undefined
    ? (validKeys as Prisma.InputJsonValue)
    : existing
      ? (existing.selectedCourseKeys as Prisma.InputJsonValue)
      : ([] as unknown as Prisma.InputJsonValue);

  const preferencesJson = data.uiPreferences !== undefined
    ? (data.uiPreferences as Prisma.InputJsonValue)
    : existing
      ? (existing.uiPreferences as Prisma.InputJsonValue)
      : ({} as unknown as Prisma.InputJsonValue);

  const saved = await prisma.ariaLearningProfile.upsert({
    where: { studentId },
    create: {
      studentId,
      selectedCourseKeys: selectedJson,
      uiPreferences: preferencesJson,
    },
    update: {
      selectedCourseKeys: selectedJson,
      uiPreferences: preferencesJson,
    },
  });

  return {
    studentId: saved.studentId,
    selectedCourseKeys: (saved.selectedCourseKeys as string[]) || [],
    uiPreferences: (saved.uiPreferences as Record<string, unknown>) || {},
    updatedAt: saved.updatedAt.toISOString(),
  };
}

/**
 * Assure qu'un profil par défaut existe pour l'élève.
 * Sélectionne automatiquement les cours principaux supportés.
 */
export async function ensureDefaultProfile(
  student: StudentWithEnrollments
): Promise<AriaLearningProfileDTO> {
  const existing = await getLearningProfile(student.id);
  if (existing) return existing;

  const academicCourses = resolveStudentCourses(
    {
      gradeLevel: student.gradeLevel,
      academicTrack: student.academicTrack,
      stmgPathway: student.stmgPathway ?? null,
    },
    student.academicEnrollments ?? []
  );
  const defaultKeys = academicCourses
    .filter((c) => c.academicStatus !== 'NOT_ENROLLED')
    .map((c) => c.course.courseKey);

  return upsertLearningProfile(student.id, {
    selectedCourseKeys: defaultKeys,
    uiPreferences: { defaultView: 'cockpit' },
  }, student);
}
