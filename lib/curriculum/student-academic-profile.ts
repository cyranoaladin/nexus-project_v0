/**
 * Commande atomique et révisionnée de la fiche scolaire d'un élève.
 *
 * Amendement 2 (docs/superpowers/specs/2026-09-06-core-family-academic-
 * planning-design.md) : une mutation staff de la carte scolaire d'un élève
 * doit changer, en une seule transaction, l'identité scolaire (niveau, voie,
 * voie STMG, statut de scolarisation) ET les enseignements choisis
 * (`StudentAcademicEnrollment`) ET `Student.academicRevision` — avec un
 * contrôle de concurrence optimiste (CAS) sur cette révision : le client
 * renvoie la révision qu'il a lue, et l'écriture échoue si la base a changé
 * entre-temps plutôt que d'écraser silencieusement une édition concurrente.
 *
 * N'écrit JAMAIS les enseignements choisis directement : délègue au cœur
 * partagé `replaceStudentChosenCoursesWithinTransaction`
 * (`lib/curriculum/enrollment.ts`), qui reste la SEULE implémentation de
 * cette validation/écriture — ne jamais dupliquer cette logique ici, et ne
 * jamais appeler `setStudentChosenCourses` (transaction imbriquée refusée
 * par Prisma).
 */

import type { AcademicTrack, GradeLevel, SchoolingStatus, StmgPathway } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  AcademicEnrollmentError,
  listStudentEnrollments,
  replaceStudentChosenCoursesWithinTransaction,
  resolveStudentCourses,
  type EnrollmentWriteProvenance,
  type StudentAcademicIdentity,
  type StudentCourseView,
} from './enrollment';

/**
 * Conflit de révision optimiste : la révision lue par l'appelant n'est plus
 * la révision courante en base. Catégorie d'échec distincte d'un choix
 * d'enseignement incohérent (`AcademicEnrollmentError`, 400) — celle-ci se
 * traduit en 409 par les routes.
 */
export class AcademicRevisionConflictError extends Error {
  readonly code = 'ACADEMIC_REVISION_CONFLICT';

  constructor() {
    super(
      "La fiche scolaire de cet élève a été modifiée entre-temps : relisez la révision courante avant de réessayer.",
    );
    this.name = 'AcademicRevisionConflictError';
  }
}

/**
 * Changements demandés sur l'identité scolaire. Sémantique « partiel = ne pas
 * toucher » : une clé absente laisse le champ inchangé ; une clé présente
 * avec `null` efface explicitement (pertinent pour `stmgPathway` et
 * `schoolingStatus`, tous deux nullables).
 */
export interface StudentAcademicProfileChanges {
  readonly gradeLevel?: GradeLevel;
  readonly academicTrack?: AcademicTrack;
  readonly stmgPathway?: StmgPathway | null;
  readonly schoolingStatus?: SchoolingStatus | null;
}

export interface StudentAcademicProfileResult {
  readonly studentId: string;
  readonly academicRevision: number;
  readonly gradeLevel: GradeLevel;
  readonly academicTrack: AcademicTrack;
  readonly stmgPathway: StmgPathway | null;
  readonly schoolingStatus: SchoolingStatus | null;
  /** Carte scolaire recalculée : obligatoire (DERIVED), spécialités, options. */
  readonly courses: StudentCourseView[];
}

/**
 * Met à jour l'identité scolaire d'un élève ET remplace ses enseignements
 * choisis, atomiquement, avec CAS sur `academicRevision`.
 *
 * @param expectedRevision Révision lue par l'appelant avant sa modification.
 * @throws {AcademicRevisionConflictError} si la révision est périmée (409).
 * @throws {AcademicEnrollmentError} si l'élève est introuvable ou si un choix
 *   d'enseignement / la provenance est incohérent (400).
 */
export async function updateStudentAcademicProfile(
  studentId: string,
  changes: StudentAcademicProfileChanges,
  courseKeys: readonly string[],
  expectedRevision: number,
  provenance: EnrollmentWriteProvenance,
): Promise<StudentAcademicProfileResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.student.findUnique({
      where: { id: studentId },
      select: {
        gradeLevel: true,
        academicTrack: true,
        stmgPathway: true,
        schoolingStatus: true,
        academicRevision: true,
      },
    });
    if (!current) {
      throw new AcademicEnrollmentError([`élève introuvable: ${studentId}`]);
    }

    const nextIdentity: StudentAcademicIdentity = {
      gradeLevel: changes.gradeLevel ?? current.gradeLevel,
      academicTrack: changes.academicTrack ?? current.academicTrack,
      stmgPathway: 'stmgPathway' in changes ? changes.stmgPathway ?? null : current.stmgPathway,
    };
    const nextSchoolingStatus: SchoolingStatus | null =
      'schoolingStatus' in changes ? changes.schoolingStatus ?? null : current.schoolingStatus;

    // CAS : la révision lue par l'appelant doit toujours être la révision
    // courante. `academicRevision` est un `Int` non nullable (défaut 0) : pas
    // de piège de comparaison NULL en SQL à trois valeurs ici, contrairement
    // à un champ nullable comme `richStatus` ailleurs sur cette branche.
    const cas = await tx.student.updateMany({
      where: { id: studentId, academicRevision: expectedRevision },
      data: {
        gradeLevel: nextIdentity.gradeLevel as GradeLevel,
        academicTrack: nextIdentity.academicTrack as AcademicTrack,
        stmgPathway: nextIdentity.stmgPathway as StmgPathway | null,
        schoolingStatus: nextSchoolingStatus,
        academicRevision: expectedRevision + 1,
        updatedTrackAt: new Date(),
      },
    });
    if (cas.count === 0) {
      throw new AcademicRevisionConflictError();
    }

    // Même transaction : jamais un second aller-retour, jamais un chemin
    // d'écriture différent de `setStudentChosenCourses`.
    await replaceStudentChosenCoursesWithinTransaction(tx, studentId, nextIdentity, courseKeys, provenance);

    const enrollments = await listStudentEnrollments(studentId, tx);
    const courses = resolveStudentCourses(nextIdentity, enrollments);

    return {
      studentId,
      academicRevision: expectedRevision + 1,
      gradeLevel: nextIdentity.gradeLevel as GradeLevel,
      academicTrack: nextIdentity.academicTrack as AcademicTrack,
      stmgPathway: nextIdentity.stmgPathway as StmgPathway | null,
      schoolingStatus: nextSchoolingStatus,
      courses,
    };
  });
}
