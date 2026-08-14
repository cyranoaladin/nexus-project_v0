import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';
import { parseJsonBody } from '@/lib/api/helpers';
import { z } from 'zod';
import { withParentStudentConsentTransaction } from '@/lib/bilans/parent-student-consent';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import {
  buildStudentLoginIdentifier,
  isStudentLoginIdentifierConflict,
} from '@/lib/services/student-login-identifier';
import { createId } from '@paralleldrive/cuid2';
import { createActivationToken } from '@/lib/auth/activation-token';
import { buildAccountActivationEmail, buildTrustedActivationUrl } from '@/lib/auth/parent-activation';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';

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
      rawBody = await parseJsonBody(request);
    } catch {
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

    // Generate email in the same format as bilan-gratuit
    const email = buildStudentLoginIdentifier({
      firstName,
      lastName,
      uniqueSuffix: createId(),
    });

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

    // Normaliser le niveau scolaire
    const gTrack = normalizeStudentLevelAndTrack(grade);
    if (!gTrack) {
      return NextResponse.json(
        { error: `Niveau scolaire non reconnu : ${grade}` },
        { status: 400 }
      );
    }

    // Générer un token d'activation unique (validité 72h)
    const {
      rawToken: rawActivationToken,
      tokenHash: hashedActivationToken,
      expiresAt: activationExpiry,
    } = createActivationToken('student');

    // Create child in transaction
    const result = await withParentStudentConsentTransaction(
      prisma,
      async ({ transaction: tx, preparePending }) => {
        // Create user in inactive state. The student chooses a password later via activation.
        const user = await tx.user.create({
          data: {
            email,
            password: null,
            firstName,
            lastName,
            role: 'ELEVE',
            activatedAt: null,
            activationToken: hashedActivationToken,
            activationExpiry: activationExpiry,
          }
        });

        // Create student
        const student = await tx.student.create({
          data: {
            userId: user.id,
            parentId: parentProfile.id,
            gradeLevel: gTrack.level,
            academicTrack: gTrack.track,
            grade,
            school: school || ''
          },
          include: {
            user: true
          }
        });

        await preparePending({
          parentUserId: userId,
          studentId: student.id,
          now: new Date(),
        });

        const activationMessage = buildAccountActivationEmail({
          displayName: `${firstName} ${lastName}`,
          rawToken: rawActivationToken,
          accountRole: 'ELEVE',
        });
        await enqueueEmailIntent(tx, {
          aggregateId: user.id,
          messageType: 'STUDENT_ACTIVATION',
          dedupeKey: hashedActivationToken,
          to: session.user.email,
          subject: activationMessage.subject,
          html: activationMessage.html,
          text: activationMessage.text,
        });

        return student;
      },
    );

    const activationUrl = buildTrustedActivationUrl(rawActivationToken, undefined, 'student').toString();
    kickEmailOutboxDrain();

    return NextResponse.json(
      {
        success: true,
        child: {
          id: result.id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          grade: result.grade,
          school: result.school
        },
        activation: {
          activationUrl,
          expiresAt: activationExpiry.toISOString(),
          message: "Lien d'activation généré pour le parent authentifié. À transmettre uniquement à l'élève concerné."
        }
      },
      { headers: activationResponseHeaders },
    );

  } catch (error) {
    if (isStudentLoginIdentifierConflict(error)) {
      return NextResponse.json(
        { error: 'STUDENT_LOGIN_IDENTIFIER_CONFLICT' },
        { status: 409 },
      );
    }
    logNonSensitiveFailure('Error creating child', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
