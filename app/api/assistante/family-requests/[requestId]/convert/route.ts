export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import type { FamilyRequestStatus } from '@prisma/client';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CanonicalApiError } from '@/lib/bilans/api/errors';
import { canonicalErrorResponse } from '@/lib/bilans/api/http';
import { assertStaffActor } from '@/lib/bilans/saisie-papier/access';
import { addChildToExistingFamily, createFamily } from '@/lib/families/create-family';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getDefaultTrackForLevel, gradeLevelLabel } from '@/lib/utils/grade-utils';

/** Statuts depuis lesquels une conversion peut encore être tentée. */
const CONVERTIBLE_STATUSES: ReadonlySet<FamilyRequestStatus> = new Set(['SUBMITTED', 'QUALIFIED', 'IN_PROGRESS']);

type RouteContext = { params: Promise<{ requestId: string }> };

/**
 * POST /api/assistante/family-requests/[requestId]/convert
 *
 * Convertit une FamilyRequest en foyer réel (Amendement 7) :
 * - `BILAN_GRATUIT` (pas de parent existant) -> `createFamily()`.
 * - `ADD_CHILD` (parent déjà existant) -> `addChildToExistingFamily()`.
 *
 * Le passage à `COMPLETED` (+ `processedById`/`processedAt`) et la création
 * du foyer se font dans la même transaction Postgres : un crash ne peut donc
 * jamais laisser la demande `COMPLETED` sans foyer créé, ni l'inverse. Le
 * statut est repris par CAS (`updateMany` avec le statut lu en clause `WHERE`)
 * -- une conversion concurrente ou rejouée ne peut donc jamais créer un
 * second foyer depuis la même demande.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const actor = assertStaffActor(await auth());

    const throttled = await guardSensitiveRateLimit(request, { scope: 'family-create', identity: actor.userId });
    if (throttled) return throttled;

    const { requestId } = await params;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const familyRequest = await tx.familyRequest.findUnique({
        where: { id: requestId },
        include: { children: true },
      });
      if (familyRequest === null) throw CanonicalApiError.notFound();
      if (!CONVERTIBLE_STATUSES.has(familyRequest.status)) {
        throw CanonicalApiError.conflict('FAMILY_REQUEST_ALREADY_PROCESSED');
      }

      // CAS sur le statut lu ci-dessus : une conversion concurrente qui a
      // déjà gagné (ou un rejeu après succès) ne trouve plus la ligne dans
      // cet état précis et échoue proprement, sans créer de second foyer.
      const claim = await tx.familyRequest.updateMany({
        where: { id: requestId, status: familyRequest.status },
        data: { status: 'COMPLETED', processedById: actor.userId, processedAt: now },
      });
      if (claim.count !== 1) throw CanonicalApiError.conflict('FAMILY_REQUEST_ALREADY_PROCESSED');

      if (familyRequest.type === 'ADD_CHILD') {
        if (familyRequest.requestingParentProfileId === null) {
          throw CanonicalApiError.conflict('FAMILY_REQUEST_MISSING_PARENT');
        }
        const parentProfile = await tx.parentProfile.findUnique({
          where: { id: familyRequest.requestingParentProfileId },
          select: { id: true, userId: true, user: { select: { email: true } } },
        });
        if (parentProfile === null) throw CanonicalApiError.notFound();

        const studentIds: string[] = [];
        for (const child of familyRequest.children) {
          const created = await addChildToExistingFamily(tx, {
            parentProfileId: parentProfile.id,
            parentUserId: parentProfile.userId,
            parentEmail: parentProfile.user.email,
            child: {
              firstName: child.firstName,
              lastName: child.lastName,
              grade: gradeLevelLabel(child.gradeLevel),
              gradeLevel: child.gradeLevel,
              academicTrack: child.academicTrack ?? getDefaultTrackForLevel(child.gradeLevel),
              school: child.school,
            },
            now,
          });
          studentIds.push(created.studentId);
        }

        return { requestId, type: familyRequest.type, parentUserId: parentProfile.userId, studentIds };
      }

      const family = await createFamily(tx, {
        input: {
          parentEmail: familyRequest.contactEmail ?? undefined,
          parentPhone: familyRequest.contactPhone,
          parentFirstName: familyRequest.contactFirstName,
          parentLastName: familyRequest.contactLastName,
          children: familyRequest.children.map((child) => ({
            firstName: child.firstName,
            lastName: child.lastName,
            grade: gradeLevelLabel(child.gradeLevel),
            schoolingStatus: child.schoolingStatus ?? undefined,
            school: child.school ?? undefined,
          })),
        },
        children: familyRequest.children.map((child) => ({
          firstName: child.firstName,
          lastName: child.lastName,
          grade: gradeLevelLabel(child.gradeLevel),
          level: child.gradeLevel,
          track: child.academicTrack ?? getDefaultTrackForLevel(child.gradeLevel),
          schoolingStatus: child.schoolingStatus ?? undefined,
          school: child.school ?? undefined,
        })),
        parentEmail: familyRequest.contactEmail,
        parentPhone: { display: familyRequest.contactPhone, normalized: familyRequest.contactPhoneNormalized },
        now,
        mode: 'PAPER_ENTRY',
        createdByUserId: actor.userId,
      });

      return {
        requestId,
        type: familyRequest.type,
        parentUserId: family.parentUserId,
        studentIds: family.children.map((created) => created.studentId),
      };
    });

    kickEmailOutboxDrain();
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    return canonicalErrorResponse(error);
  }
}
