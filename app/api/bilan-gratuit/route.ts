export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { bilanGratuitSchema } from '@/lib/validations';
import { normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';
import { UserRole } from '@/types/enums';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { checkCsrf, checkBodySize } from '@/lib/csrf';
import { synchronizePreRentreeCampaignContext } from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';
import { createId } from '@paralleldrive/cuid2';
import { NextRequest, NextResponse } from 'next/server';
import { withParentStudentConsentTransaction } from '@/lib/bilans/parent-student-consent';
import {
  buildStudentLoginIdentifier,
  isStudentLoginIdentifierConflict,
} from '@/lib/services/student-login-identifier';
import {
  createParentActivationToken,
  buildParentActivationEmail,
  normalizeParentEmail,
  PARENT_ACTIVATION_PUBLIC_MESSAGE,
  withActivationSecurityHeaders,
} from '@/lib/auth/parent-activation';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { requireUserEmail } from '@/lib/contact/user-email';

function publicSuccessResponse() {
  return withActivationSecurityHeaders(NextResponse.json({
    success: true,
    message: PARENT_ACTIVATION_PUBLIC_MESSAGE,
  }));
}

function secureResponse(response: NextResponse) {
  return withActivationSecurityHeaders(response);
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}

export async function POST(request: NextRequest) {
  let uniqueConstraintContext: 'parent' | 'student' = 'parent';
  try {
    const isTestEnv = process.env.NODE_ENV === 'test';

    // CSRF protection — verify same-origin
    const csrfResponse = checkCsrf(request);
    if (csrfResponse) return secureResponse(csrfResponse);

    // Body size limit — reject oversized payloads (1MB)
    const bodySizeResponse = checkBodySize(request);
    if (bodySizeResponse) return secureResponse(bodySizeResponse);

    const body = await request.json();

    // Honeypot check — bots fill hidden fields, humans don't
    if (body.website || body.url || body.honeypot) {
      // Silently reject bot submissions with a fake success response
      return publicSuccessResponse();
    }

    const blocked = await guardSensitiveRateLimit(request, {
      scope: 'parent-signup',
      identity: typeof body.parentEmail === 'string' ? body.parentEmail : null,
    });
    if (blocked) return secureResponse(blocked);

    // Validation des données
    const normalizedBody = body && typeof body === 'object' &&
      'parentEmail' in body && typeof body.parentEmail === 'string'
      ? { ...body, parentEmail: normalizeParentEmail(body.parentEmail) }
      : body;
    const validatedData = bilanGratuitSchema.parse(normalizedBody);
    const parentEmail = normalizeParentEmail(validatedData.parentEmail);
    const campaignContext = synchronizePreRentreeCampaignContext({
      campaignContext: validatedData.campaignContext ?? undefined,
      studentGrade: validatedData.studentGrade,
      subjects: validatedData.subjects,
    });

    // Vérifier si l'email parent existe déjà
    let existingUser = null;
    try {
      existingUser = await prisma.user.findUnique({ where: { email: parentEmail } });
    } catch (dbErr) {
      if (!isTestEnv) {
        console.error('[bilan-gratuit] Parent lookup failed', {
          code: dbErr && typeof dbErr === 'object' && 'code' in dbErr ? String(dbErr.code) : 'PARENT_LOOKUP_FAILED',
          at: new Date().toISOString(),
        });
      }
    }

    if (existingUser) {
      return publicSuccessResponse();
    }

    const resolvedStudentLastName = validatedData.studentLastName ?? validatedData.parentLastName;
    const {
      rawToken: rawActivationToken,
      tokenHash: hashedActivationToken,
      expiresAt: activationExpiry,
    } = createParentActivationToken();

    // Normaliser le niveau scolaire AVANT la transaction
    const gTrack = normalizeStudentLevelAndTrack(validatedData.studentGrade);
    
    if (!gTrack) {
      return secureResponse(NextResponse.json(
        { error: `Niveau scolaire non reconnu : ${validatedData.studentGrade}` },
        { status: 400 }
      ));
    }

    // Transaction pour créer parent et élève
    await withParentStudentConsentTransaction(
      prisma,
      async ({ transaction: tx, preparePending }) => {
        // Créer le compte parent
        const parentUser = await tx.user.create({
          data: {
            email: parentEmail,
            password: null,
            role: UserRole.PARENT,
            firstName: validatedData.parentFirstName,
            lastName: validatedData.parentLastName,
            phone: validatedData.parentPhone,
            activatedAt: null,
            activationToken: hashedActivationToken,
            activationExpiry,
          }
        });
        uniqueConstraintContext = 'student';

        // Créer le profil parent
        const parentProfile = await tx.parentProfile.create({
          data: {
            userId: parentUser.id
          }
        });

        // Créer le compte élève sans accès direct.
        // Email format: prenom.nom.random@nexus-student.local to ensure uniqueness
        const studentEmailSlug = buildStudentLoginIdentifier({
          firstName: validatedData.studentFirstName,
          lastName: resolvedStudentLastName,
          uniqueSuffix: createId().slice(0, 4),
        });

        const studentUser = await tx.user.create({
          data: {
            email: studentEmailSlug,
            role: UserRole.ELEVE,
            firstName: validatedData.studentFirstName,
            lastName: resolvedStudentLastName,
            password: null,
            activatedAt: null,
          }
        });

        const student = await tx.student.create({
          data: {
            parentId: parentProfile.id,
            userId: studentUser.id,
            grade: validatedData.studentGrade,
            gradeLevel: gTrack.level,
            academicTrack: gTrack.track,
            school: validatedData.studentSchool,
            birthDate: validatedData.studentBirthDate ? new Date(validatedData.studentBirthDate) : null
          }
        });

        await preparePending({
          parentUserId: parentUser.id,
          studentId: student.id,
          now: new Date(),
        });

        const campaignLead = campaignContext
          ? await tx.contactLead.create({
              data: {
                name: `${validatedData.parentFirstName} ${validatedData.parentLastName}`,
                email: parentEmail,
                phone: validatedData.parentPhone,
                profile: JSON.stringify(campaignContext.profile),
                interest: `${campaignContext.packCode} · ${campaignContext.level} · ${campaignContext.subjectIds.join(', ')}`,
                source: campaignContext.programme,
              },
            })
          : null;

        const activationMessage = buildParentActivationEmail({
          parentName: `${parentUser.firstName} ${parentUser.lastName}`,
          childFirstName: studentUser.firstName || 'votre enfant',
          rawToken: rawActivationToken,
        });
        await enqueueEmailIntent(tx, {
          aggregateId: parentUser.id,
          messageType: 'PARENT_ACTIVATION',
          dedupeKey: hashedActivationToken,
          to: requireUserEmail(parentUser.email),
          subject: activationMessage.subject,
          html: activationMessage.html,
          text: activationMessage.text,
        });

        return { parentUser, studentUser, student, campaignLead };
      },
    );

    // The intent was committed atomically with the account graph. Delivery is
    // post-commit and recoverable by the scheduler after a process crash.
    kickEmailOutboxDrain();

    return publicSuccessResponse();

  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return secureResponse(NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      ));
    }

    if (isUniqueConstraintError(error) && uniqueConstraintContext === 'parent') {
      return publicSuccessResponse();
    }

    if (isStudentLoginIdentifierConflict(error)) {
      return secureResponse(NextResponse.json(
        { error: 'STUDENT_LOGIN_IDENTIFIER_CONFLICT' },
        { status: 409 },
      ));
    }

    if (process.env.NODE_ENV !== 'test') {
      console.error('[bilan-gratuit] Registration failed', {
        code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'REGISTRATION_FAILED',
        at: new Date().toISOString(),
      });
    }

    return secureResponse(NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    ));
  }
}
