import type { Prisma } from '@prisma/client';

/** V1 students, including DEFER, keep their own V1 authority independently of Core. */
export async function lockV1AriaSubject(tx: Prisma.TransactionClient, userId: string, commercial: boolean): Promise<void> {
  await tx.$queryRaw`SELECT id FROM public.students WHERE "userId" = ${userId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM public.student_academic_enrollments
    WHERE "studentId" IN (SELECT id FROM public.students WHERE "userId" = ${userId}) ORDER BY id FOR SHARE`;
  if (!commercial) return;
  await tx.$queryRaw`SELECT id FROM public.entitlements WHERE "userId" = ${userId} ORDER BY id FOR SHARE`;
  await tx.$queryRaw`SELECT s.id FROM public.aria_entitlement_scopes s JOIN public.entitlements e
    ON e.id = s."entitlementId" WHERE e."userId" = ${userId} ORDER BY s.id FOR SHARE OF s`;
}
