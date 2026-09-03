/**
 * Inscriptions académiques — service de domaine.
 *
 * Seul point de lecture/écriture des enseignements réellement suivis par un
 * élève. Remplace `Student.specialties`, qui ne pouvait porter que des matières
 * génériques et présentait donc le tronc commun comme des « spécialités ».
 *
 * ── Ce que le modèle stocke, et ce qu'il dérive ──────────────────────────────
 * Sont STOCKÉS les enseignements qui relèvent d'un choix de l'élève et qu'aucune
 * règle ne permet de déduire : spécialités et options.
 *
 * Sont DÉRIVÉS du couple (niveau × voie) les enseignements obligatoires — tronc
 * commun et modules de voie. Cette dérivation n'est pas une approximation : elle
 * vient du catalogue versionné, dont chaque cours porte une source prouvée.
 *
 * Une sélection dans un produit Nexus ne rend JAMAIS un enseignement scolaire
 * vrai : seule une inscription le fait.
 */

import type { AcademicEnrollmentKind, AcademicEnrollmentSource, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CURRICULUM_VERSION, getCourse, listCoursesFor, type CourseRecord } from './catalog';
import { validateChosenCourses, type StudentAcademicIdentity } from './validation';

export { validateChosenCourses };
export type { StudentAcademicIdentity };

/** Statut scolaire d'un cours pour un élève donné. */
export type AcademicStatus =
  /** Une inscription existe : l'élève suit réellement cet enseignement. */
  | 'ENROLLED'
  /** Obligatoire pour ce niveau et cette voie, dérivé du catalogue sourcé. */
  | 'DERIVED'
  /** Choix possible, non retenu par l'élève. */
  | 'NOT_ENROLLED';

export interface StudentCourseView {
  readonly course: CourseRecord;
  readonly academicStatus: AcademicStatus;
  readonly enrollmentSource: AcademicEnrollmentSource | null;
}

export interface EnrollmentRecord {
  readonly courseKey: string;
  /** Seuls les CHOIX sont persistés : le type ne connaît que SPECIALTY et OPTION. */
  readonly kind: AcademicEnrollmentKind;
  readonly source: AcademicEnrollmentSource;
}

/**
 * Client Prisma utilisé pour écrire.
 *
 * Injectable pour que les scripts de seed passent par CE service plutôt que
 * d'écrire en base directement : il n'existe qu'un seul chemin d'écriture, et
 * il valide.
 */
export type EnrollmentPrismaClient = Pick<PrismaClient, '$transaction' | 'studentAcademicEnrollment'>;

/**
 * Provenance d'une écriture d'inscription.
 *
 * Type discriminé volontairement : une saisie humaine DOIT dire qui l'a faite,
 * un seed ne peut pas prétendre l'avoir été. L'ancien couple
 * `(source, actor?)` laissait exprimer « ADMIN sans auteur » ou
 * « SEED avec auteur », deux états qui n'ont aucun sens.
 *
 * `BACKFILL_LEGACY_SPECIALTIES` est délibérément ABSENT : cette provenance
 * n'appartient qu'au SQL de migration. Aucun chemin applicatif ne doit pouvoir
 * fabriquer une ligne qui se présente comme une reprise historique — la
 * barrière de migration compare précisément cet ensemble.
 */
export type EnrollmentWriteProvenance =
  | { readonly source: 'ADMIN'; readonly verifiedById: string }
  | { readonly source: 'ASSISTANTE'; readonly verifiedById: string }
  | { readonly source: 'SEED' };

/** Erreur de cohérence académique, traduite en 400 par les routes. */
export class AcademicEnrollmentError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Inscriptions académiques invalides: ${issues.join('; ')}`);
    this.name = 'AcademicEnrollmentError';
    this.issues = issues;
  }
}

// ── Lecture ──────────────────────────────────────────────────────────────────

export async function listStudentEnrollments(
  studentId: string,
  client: EnrollmentPrismaClient = prisma,
): Promise<EnrollmentRecord[]> {
  const rows = await client.studentAcademicEnrollment.findMany({
    where: { studentId },
    select: { courseKey: true, kind: true, source: true },
    orderBy: { courseKey: 'asc' },
  });
  return rows;
}

/**
 * Carte scolaire complète d'un élève : ce qui est obligatoire pour son niveau
 * et sa voie, plus ce qu'il a réellement choisi.
 *
 * Fonction PURE : les inscriptions sont fournies par l'appelant, aucun accès
 * base ici, afin que les composants et les tests puissent l'utiliser librement.
 */
export function resolveStudentCourses(
  identity: StudentAcademicIdentity,
  enrollments: readonly EnrollmentRecord[],
): StudentCourseView[] {
  if (!identity.gradeLevel || !identity.academicTrack) return [];

  const enrollmentByKey = new Map(enrollments.map((entry) => [entry.courseKey, entry]));

  const applicable = listCoursesFor({
    gradeLevel: identity.gradeLevel,
    track: identity.academicTrack,
    stmgPathway: identity.stmgPathway,
  });

  const views: StudentCourseView[] = [];

  for (const course of applicable) {
    const enrollment = enrollmentByKey.get(course.courseKey);

    if (enrollment) {
      views.push({
        course,
        academicStatus: 'ENROLLED',
        enrollmentSource: enrollment.source,
      });
      continue;
    }

    // Tronc commun et modules de voie sont imposés par le niveau et la voie.
    if (course.kind === 'CORE' || course.kind === 'TRACK_MODULE') {
      views.push({ course, academicStatus: 'DERIVED', enrollmentSource: null });
      continue;
    }

    // Spécialité ou option non retenue : proposable, jamais présentée comme suivie.
    views.push({ course, academicStatus: 'NOT_ENROLLED', enrollmentSource: null });
  }

  // Une inscription peut porter sur un cours hors du couple (niveau × voie)
  // courant — typiquement après un changement de classe. On l'expose plutôt que
  // de la masquer : la donnée existe et doit rester visible.
  for (const enrollment of enrollments) {
    if (applicable.some((course) => course.courseKey === enrollment.courseKey)) continue;
    const course = getCourse(enrollment.courseKey);
    if (!course) continue;
    views.push({ course, academicStatus: 'ENROLLED', enrollmentSource: enrollment.source });
  }

  return views;
}

/**
 * Sépare les inscriptions qui appartiennent réellement au couple (niveau ×
 * voie) courant de celles qui n'y appartiennent plus (changement de classe,
 * donnée historique). `resolveStudentCourses` expose délibérément CES
 * DEUX catégories (pour l'affichage — une inscription passée reste visible,
 * jamais masquée) ; tout appelant qui doit accorder un droit réel (accès
 * ARIA runtime, grant commercial ARIA) doit filtrer ici en amont, jamais
 * traiter une inscription hors carte courante comme suivie.
 *
 * SSoT unique de ce filtre : `lib/aria/access.ts` (lecture runtime) et
 * `lib/entitlement/engine.ts` (grant commercial ARIA) l'utilisent tous deux
 * — jamais une seconde implémentation de cette règle.
 */
export function partitionEnrollmentsByCurrentMap(
  identity: StudentAcademicIdentity,
  enrollments: readonly EnrollmentRecord[],
): { readonly withinCurrentMap: EnrollmentRecord[]; readonly outsideCurrentMap: EnrollmentRecord[] } {
  if (!identity.gradeLevel || !identity.academicTrack) {
    return { withinCurrentMap: [], outsideCurrentMap: [...enrollments] };
  }
  const applicableCourseKeys = new Set(
    listCoursesFor({
      gradeLevel: identity.gradeLevel,
      track: identity.academicTrack,
      stmgPathway: identity.stmgPathway,
    }).map(({ courseKey }) => courseKey),
  );
  const withinCurrentMap: EnrollmentRecord[] = [];
  const outsideCurrentMap: EnrollmentRecord[] = [];
  for (const enrollment of enrollments) {
    (applicableCourseKeys.has(enrollment.courseKey) ? withinCurrentMap : outsideCurrentMap)
      .push(enrollment);
  }
  return { withinCurrentMap, outsideCurrentMap };
}

/** Cours réellement suivis (inscrits ou obligatoires). */
export function listFollowedCourses(views: readonly StudentCourseView[]): StudentCourseView[] {
  return views.filter((view) => view.academicStatus !== 'NOT_ENROLLED');
}

/** Spécialités réellement suivies. */
export function listEnrolledSpecialties(
  views: readonly StudentCourseView[],
): StudentCourseView[] {
  return views.filter(
    (view) => view.course.kind === 'SPECIALTY' && view.academicStatus === 'ENROLLED',
  );
}

/** `true` si l'élève suit réellement ce cours. */
export function isEnrolledIn(
  enrollments: readonly EnrollmentRecord[],
  courseKey: string,
): boolean {
  return enrollments.some((entry) => entry.courseKey === courseKey);
}

// ── Écriture ─────────────────────────────────────────────────────────────────

/**
 * Remplace l'ensemble des enseignements CHOISIS d'un élève (spécialités et
 * options). Les enseignements obligatoires ne sont jamais écrits : ils sont
 * dérivés du catalogue.
 *
 * @throws {AcademicEnrollmentError} si un choix est incohérent.
 */
export async function setStudentChosenCourses(
  studentId: string,
  identity: StudentAcademicIdentity,
  courseKeys: readonly string[],
  provenance: EnrollmentWriteProvenance,
  client: EnrollmentPrismaClient = prisma,
): Promise<EnrollmentRecord[]> {
  // Garde d'exécution : le type l'interdit déjà, mais un appelant en JavaScript
  // ou une désérialisation non typée ne passeraient pas par le compilateur.
  if ((provenance as { source: string }).source === 'BACKFILL_LEGACY_SPECIALTIES') {
    throw new AcademicEnrollmentError([
      "la provenance BACKFILL_LEGACY_SPECIALTIES n'appartient qu'au SQL de migration",
    ]);
  }
  if (
    (provenance.source === 'ADMIN' || provenance.source === 'ASSISTANTE') &&
    !(provenance as { verifiedById?: string }).verifiedById
  ) {
    throw new AcademicEnrollmentError([
      `une saisie ${provenance.source} doit désigner son auteur`,
    ]);
  }
  if (provenance.source === 'SEED' && (provenance as { verifiedById?: string }).verifiedById) {
    throw new AcademicEnrollmentError(["un seed n'a pas d'auteur humain"]);
  }

  const issues = validateChosenCourses(identity, courseKeys);
  if (issues.length > 0) throw new AcademicEnrollmentError(issues);

  const unique = [...new Set(courseKeys)];
  const now = new Date();

  await client.$transaction(async (tx) => {
    // Toutes les lignes sont des choix : il n'y a rien d'autre à préserver.
    await tx.studentAcademicEnrollment.deleteMany({ where: { studentId } });

    if (unique.length === 0) return;

    await tx.studentAcademicEnrollment.createMany({
      data: unique.map((courseKey) => ({
        studentId,
        courseKey,
        kind: getCourse(courseKey)!.kind as AcademicEnrollmentKind,
        source: provenance.source as AcademicEnrollmentSource,
        curriculumVersion: CURRICULUM_VERSION,
        ...(provenance.source === 'SEED'
          ? {}
          : { verifiedAt: now, verifiedById: provenance.verifiedById }),
      })),
      skipDuplicates: true,
    });
  });

  return listStudentEnrollments(studentId, client);
}
