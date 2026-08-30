import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import {
  findOrCaptureResponsableLeadInTransaction,
  getContactLeadEmailLockKey,
  notifyContactLeadCaptureCommitted,
} from '@/lib/crm/contact-leads';
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { serializeStaffStudentSearchResult } from '@/lib/quotes/candidat-individuel-identity';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { serializeError } from '@/lib/utils/serialize-error';

const resolveIdentitySchema = z.object({
  studentId: z.string().trim().min(1).max(191),
}).strict();

export async function POST(request: NextRequest) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;

  const parsed = resolveIdentitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_STUDENT_ID', message: 'Sélection élève invalide.' },
      { status: 400 },
    );
  }

  try {
    const resolved = await prisma.$transaction(async (tx) => {
      const provisional = await tx.student.findUnique({
        where: { id: parsed.data.studentId },
        select: {
          id: true,
          user: { select: { id: true, email: true } },
          parent: { select: { id: true, user: { select: { id: true, email: true } } } },
        },
      });
      if (!provisional) return { error: 'STUDENT_NOT_FOUND' as const };
      if (!provisional.parent?.user.email?.trim()) {
        return { error: 'RESPONSIBLE_UNAVAILABLE' as const };
      }

      const provisionalStudentEmail = provisional.user.email?.trim()
        ? normalizeUserEmail(provisional.user.email)
        : null;
      const provisionalParentEmail = normalizeUserEmail(provisional.parent.user.email);
      const advisoryKeys = [...new Set([
        getContactLeadEmailLockKey(provisionalParentEmail),
        `nexus:user-email:${provisionalParentEmail}`,
        ...(provisionalStudentEmail ? [`nexus:user-email:${provisionalStudentEmail}`] : []),
      ])].sort();
      for (const lockKey of advisoryKeys) {
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          lockKey,
        );
      }

      // Staff identity writers take advisory locks first. Row locks then
      // follow Student -> ParentProfile -> Users, avoiding lock inversion.
      await tx.$queryRaw(Prisma.sql`
        SELECT "id", "parentId", "userId" FROM "students"
        WHERE "id" = ${parsed.data.studentId}
        FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT pp."id"
        FROM "parent_profiles" pp
        WHERE pp."id" = (
          SELECT s."parentId" FROM "students" s WHERE s."id" = ${parsed.data.studentId}
        )
        FOR UPDATE OF pp
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT u."id"
        FROM "users" u
        WHERE u."id" = (
          SELECT s."userId" FROM "students" s WHERE s."id" = ${parsed.data.studentId}
        ) OR u."id" = (
          SELECT pp."userId"
          FROM "parent_profiles" pp
          WHERE pp."id" = (
            SELECT s."parentId" FROM "students" s WHERE s."id" = ${parsed.data.studentId}
          )
        )
        ORDER BY u."id"
        FOR UPDATE OF u
      `);

      const student = await tx.student.findUnique({
        where: { id: parsed.data.studentId },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              mergedIntoUserId: true,
            },
          },
          parent: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  mergedIntoUserId: true,
                },
              },
            },
          },
        },
      });

      if (!student) return { error: 'STUDENT_NOT_FOUND' as const };
      if (student.user.mergedIntoUserId) return { error: 'STUDENT_UNAVAILABLE' as const };

      const responsible = student.parent?.user;
      const responsibleName = [responsible?.firstName, responsible?.lastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ');
      if (!student.parent || !responsible || responsible.mergedIntoUserId || !responsible.email?.trim() || !responsibleName) {
        return { error: 'RESPONSIBLE_UNAVAILABLE' as const };
      }
      if (
        student.user.id !== provisional.user.id
        || student.parent.id !== provisional.parent.id
        || (student.user.email?.trim() ? normalizeUserEmail(student.user.email) : null) !== provisionalStudentEmail
        || normalizeUserEmail(responsible.email) !== provisionalParentEmail
      ) {
        return { error: 'IDENTITY_CHANGED' as const };
      }

      const contactLead = await findOrCaptureResponsableLeadInTransaction(tx, {
        name: responsibleName,
        email: responsible.email,
        phone: responsible.phone,
        source: 'STAFF_CANDIDAT_INDIVIDUEL_IDENTITY',
      }, { emailLockAlreadyHeld: true });

      return {
        student: serializeStaffStudentSearchResult(student),
        contactLead: {
          id: contactLead.id,
          name: contactLead.name,
          email: contactLead.email,
          phone: contactLead.phone,
          status: contactLead.status,
        },
      };
    });

    if ('error' in resolved) {
      const status = resolved.error === 'STUDENT_NOT_FOUND' ? 404 : 409;
      const message = resolved.error === 'STUDENT_NOT_FOUND'
        ? 'Élève introuvable.'
        : resolved.error === 'IDENTITY_CHANGED'
          ? 'Le rattachement de cet élève vient de changer. Réessayez.'
        : resolved.error === 'STUDENT_UNAVAILABLE'
          ? 'Ce compte élève n’est plus disponible.'
          : 'Le responsable de cet élève ne peut pas être résolu automatiquement.';
      return NextResponse.json({ error: resolved.error, message }, { status });
    }

    notifyContactLeadCaptureCommitted();
    return NextResponse.json({ success: true, ...resolved });
  } catch (error) {
    console.error('[Candidat individuel identity resolve] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'IDENTITY_RESOLUTION_FAILED', message: 'Impossible de rattacher cet élève pour le moment.' },
      { status: 500 },
    );
  }
}
