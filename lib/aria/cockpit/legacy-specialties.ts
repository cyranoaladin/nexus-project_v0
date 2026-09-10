/**
 * Spécialités réellement suivies par l'élève — SSoT d'inscriptions.
 *
 * `Student.specialties: Subject[]` a été retiré du schéma et remplacé par
 * `StudentAcademicEnrollment` (`lib/curriculum/enrollment.ts`). Ce module ne
 * réinvente pas cette dérivation : il suit exactement le même motif que
 * `lib/dashboard/student-payload.ts` (`enrolledSpecialtyCourses`) — seules les
 * inscriptions `SPECIALTY` comptent, et `legacySubject` (catalogue canonique,
 * `lib/curriculum/catalog.ts`) n'est utilisé QUE pour l'interopérabilité avec
 * les surfaces historiques indexées par l'enum `Subject` (dont le resolver
 * ARIA — `lib/aria/curriculum/resolver.ts`). Une spécialité canonique
 * dépourvue de `legacySubject` (ex. HGGSP, HLP) est ignorée plutôt que
 * rattachée arbitrairement.
 */

import 'server-only';

import type { Subject } from '@prisma/client';
import { getCourse } from '@/lib/curriculum/catalog';
import { listStudentEnrollments } from '@/lib/curriculum/enrollment';

export async function resolveLegacySpecialties(studentId: string): Promise<Subject[]> {
  const enrollments = await listStudentEnrollments(studentId);
  const specialties: Subject[] = [];
  for (const enrollment of enrollments) {
    if (enrollment.kind !== 'SPECIALTY') continue;
    const course = getCourse(enrollment.courseKey);
    if (course?.legacySubject) specialties.push(course.legacySubject as Subject);
  }
  return specialties;
}
