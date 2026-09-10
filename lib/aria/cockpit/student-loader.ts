/**
 * Lecture Student partagée par les routes du cockpit ARIA.
 *
 * Isole l'accès Prisma hors de `app/api/aria/**` (H001/H003,
 * `__tests__/architecture/aria-application-boundary.test.ts` et
 * `aria-persistence-boundary.test.ts`) : ces routes ne doivent importer ni
 * `@/lib/prisma` ni `@prisma/client` directement.
 */

import 'server-only';

import { prisma } from '@/lib/prisma';

const STUDENT_SELECT = {
  id: true,
  gradeLevel: true,
  academicTrack: true,
  stmgPathway: true,
  school: true,
} as const;

export function loadOwnCockpitStudent(userId: string) {
  return prisma.student.findUnique({ where: { userId }, select: STUDENT_SELECT });
}
