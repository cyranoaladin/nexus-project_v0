import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';
import { z } from 'zod';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';
import { FAMILY_BODY_MAX_BYTES } from '@/lib/families/create-family';
import { createFamilyRequest } from '@/lib/families/requests';

const createChildSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  grade: z.string().trim().min(1).max(80),
  school: z.string().trim().max(120).optional().default(''),
}).strict();

const activationResponseHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
} as const;

function logNonSensitiveFailure(context: string, error: unknown): void {
  console.error(context, {
    name: error instanceof Error ? error.name : 'UnknownError',
    code: typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined,
  });
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // First get the parent profile
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: userId },
    });

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Parent profile not found' },
        { status: 404 }
      );
    }

    const children = await prisma.student.findMany({
      where: { parentId: parentProfile.id },
      include: {
        user: true,
        sessions: {
          where: {
            scheduledAt: {
              gte: new Date()
            }
          },
          include: {
            coach: {
              include: {
                user: true
              }
            }
          },
          orderBy: {
            scheduledAt: 'asc'
          }
        }
      }
    });

    const formattedChildren = children.map((child) => {

      return {
        id: child.id,
        firstName: child.user.firstName,
        lastName: child.user.lastName,
        email: child.user.email,
        grade: child.grade,
        school: child.school,
        upcomingSessions: child.sessions.length,
        createdAt: child.createdAt
      };
    });

    return NextResponse.json(formattedChildren);

  } catch (error) {
    console.error('Error fetching children:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const blocked = await guardSensitiveRateLimit(request, {
      scope: 'child-create',
      identity: session.user.id,
    });
    if (blocked) return blocked;

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(await readBoundedRequestBody(request, FAMILY_BODY_MAX_BYTES));
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return NextResponse.json({ error: { code: 'REQUEST_BODY_TOO_LARGE' } }, { status: 413 });
      }
      return NextResponse.json(
        { error: 'JSON invalide' },
        { status: 400 }
      );
    }
    const parsedBody = createChildSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid child payload' },
        { status: 400 }
      );
    }
    const { firstName, lastName, grade, school } = parsedBody.data;

    const userId = session.user.id;

    // First get the parent profile, and the caller's own contact details --
    // Amendement 7 : ce POST ne crée plus de compte élève. Il capture
    // l'intention dans une FamilyRequest (type ADD_CHILD) rattachée au
    // ParentProfile de l'appelant ; seul le staff (ADMIN/ASSISTANTE) la
    // convertit ensuite en élève réel via addChildToExistingFamily().
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: userId },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true, phone: true, phoneNormalized: true },
        },
      },
    });

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Parent profile not found' },
        { status: 404 }
      );
    }

    // Normaliser le niveau scolaire
    const gTrack = normalizeStudentLevelAndTrack(grade);
    if (!gTrack) {
      return NextResponse.json(
        { error: `Niveau scolaire non reconnu : ${grade}` },
        { status: 400 }
      );
    }

    const contactUser = parentProfile.user;
    await prisma.$transaction(async (tx) => {
      await createFamilyRequest(tx, {
        type: 'ADD_CHILD',
        requestingParentProfileId: parentProfile.id,
        contactFirstName: contactUser.firstName ?? '',
        contactLastName: contactUser.lastName ?? '',
        contactEmail: contactUser.email ?? null,
        contactPhone: contactUser.phone ?? '',
        contactPhoneNormalized: contactUser.phoneNormalized ?? contactUser.phone ?? '',
        now: new Date(),
        children: [{
          firstName,
          lastName,
          gradeLevel: gTrack.level,
          academicTrack: gTrack.track,
          school: school || null,
        }],
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Votre demande d'ajout d'enfant a bien été reçue. Notre équipe la traitera puis vous transmettra le lien d'activation.",
      },
      { headers: activationResponseHeaders },
    );

  } catch (error) {
    logNonSensitiveFailure('Error creating child request', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
